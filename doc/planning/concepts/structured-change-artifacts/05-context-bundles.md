---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/05-context-bundles.md
---
# 05. Just-in-time context bundles

Status: governed by `14-review-decisions.md` (decisions 1 to 3, 11, 14, 16 and 35) and by
`15-classification-and-rounds.md`.

## What a bundle is

A bundle is a **projection** of a change's contract for one role at one moment. It is not a
file and it is not a search result. It is an ordered set of sections with a source revision
and a `missing` list. The agent reads the bundle and starts work; if it needs a fact that was
omitted, it fetches that section by ID.

The rules of a bundle:

- **Deterministic and linked.** The same role, phase and contract revision produce the same
  sections, in the same order; the header names the revision and the bundle hash, so a stale
  bundle is visible.
- **Complete by contract, not by size.** Each role has a mandatory set: the facts it must
  have, the facts it may fetch on demand, and the facts it never needs.
- **Without a fixed budget.** No role has a byte ceiling. The removal test decides what goes
  in (`15-classification-and-rounds.md`, section 7); the bundle command measures and warns.
- **Measured.** Every on-demand fetch is recorded host-local. The miss rate is the share of
  bundles after which the agent fetched more.
- **Path-free.** The agent-facing envelope never contains the change folder or an artifact
  path. It carries repository paths for code only; the tool resolves the change from the
  worktree registry.
- **Declared.** The tool holds the mandatory set per role. A phase of the Work section can
  add a section for a role (`contextFor`); it can never remove a mandatory one.

## The roles and their mandatory sets

Ten roles read a bundle. The shape decides which ones run. The PM writes the card of a light
change at intake; the contract author writes the contract of a flagged or phased change. The
acceptance author is invoked only by the `security` and `data` flags. The pre-code reader
runs for a flagged or phased change; in a light change the coder is the first reader.

| Role | When | Anchor | Must have | Never served |
|---|---|---|---|---|
| `pm` | intake, every state boundary, resume | state and typed open items | the ticket; the state (the current state, the phase, the step and the next); open blockers, open questions with defaults, pending decisions; active flags with unmet add-ons; one line per accepted decision with its purpose; the summary of the last handover | timestamps, durations, tokens, evidence bodies |
| `contract-author` | the `contract` state, a contract revision | the ticket | the ticket with its typed block; the verified facts of the diagnosis; the decisions and invariants the ticket touches; the paths the ticket names, with the flags the tool proposes for them | the events; other changes |
| `acceptance-author` | the `delivery` state, before the coder starts (`security`, `data`) | the criteria and the oracle | the ticket; the non-goals; each criterion with its obligations (claim, observable, predicate, baseline); the repository's test conventions | the Work steps; the events |
| `coder` | each phase, a fix, resume | the Work phase | light: the ticket and the card. Flagged and phased: the ticket, the goal, the non-goals, the phase with its steps, paths, criteria and obligations, the previous handover, what the next phase expects, the flags that touch the phase | the steps of other phases; closed findings; the events |
| `pre-code-reader` | the `pre_code_read` state (flagged, phased) | the contract | the ticket; the non-goals; the seven sections; the lint and preflight results; the flags and their add-ons; the round and its ceiling | the events |
| `reviewer` | the `review` state | the diff | the ticket; the non-goals; the goal; the criteria with the oracle (commands and expected outputs); the decisions; the flags; the deviations of each handover; every command the tool ran, with its origin; the obligations whose watchlist the diff touches; the findings of earlier rounds | the Work steps (the diff is the truth); the events |
| `doc-syncer` | the `delivery` state, for each document in `docs:` | the documented behaviour that changed | the ticket; the goal; the interfaces and criteria the diff changes; the current-truth pages to reconcile | the Work steps; the events |
| `runner` | the `gates` state | the obligations and the verify commands | each command with its working directory, expected exit, environment and origin | everything else |
| `pr-manager` | the `pr` state | the contract and the review | the title; the goal; the criteria with the status of their obligations; the flags; the review verdict; the changeset | the Work steps; the events |
| `retrospective` | the retrospective | the events | cost per role, phase and gate; rounds and findings by category and materiality; catches per gate; handovers; the path audit | nothing; it reads and never writes |

Rules that hold for every row:

- **The ticket and the non-goals are mandatory for every reader.** A finding cites the ticket
  paragraph or the criterion it is about.
- **The coder is the first reader of a light change.** It does not start on a card that does
  not cover the ticket; a typed finding returns the card to its author (decision 35).
- **A bundle that lacks a section of its role's mandatory set is a bug in the bundle
  builder**, not a reason for the agent to read the whole file.
- **A role receives a fact only if it acts on it or if the fact constrains a decision it
  makes.** Everything else is fetched on demand or left to the audit.

## Sections and their identifiers

A bundle is built from sections of the contract and from what the tool holds beside it. The
section name is also the identifier of an on-demand fetch. Every fact carries its origin:
`tracker`, `author` or `tool` (`13-context-delivery.md`).

| Name | Holds | Origin |
|---|---|---|
| `ticket` | the ticket's title, body and typed block | tracker |
| `goal` | the statement; the scope in and out; the interfaces (`API-`); the current-truth documents to reconcile (`docs:`); the non-goals (`NG-`) | author |
| `facts` | the `VFACT-` items of the diagnosis, each with how it was checked | author |
| `criteria` | the `AC-` items | author |
| `decisions` | the `DEC-` items, and the open questions (`OQ-`) with their defaults | author |
| `oracle` | the `PROOF-` obligations (claim, observable, predicate, method, boundary, test or command, baseline) and the `TC-` tests | author; the runs are the tool's |
| `work` | the `PH-` phases and their `PH-nn_Snn` steps, with paths and verify commands | author |
| `flags` | the active flags and their add-ons; the flags removed at intake, with the reason; the risks (`RSK-`) | tool proposes; the PM confirms or removes |
| `slots` | at most three free-text slots, each naming its reader | author |
| `handover.PH-nn` | one handover | tool drafts, the coder confirms |
| `state` | the state, phase, step and next, with the typed open items | tool; the PM for the open items |

One item is fetched by its identifier: `oracle.PROOF-2`, `criteria.AC-2`, `work.PH-03`,
`decisions.DEC-1`, `handover.PH-02`.

## The filtering algorithm

0. **Read the declaration.** Take the role's mandatory set and what the phase's `contextFor`
   adds for the role. A mandatory section is never excluded.
1. **Anchor.** Start from the role and the state. The coder anchors on the Work phase; the
   reviewer on the diff; the pre-code reader on the contract; the contract author on the
   ticket; the PM on the state.
2. **Follow the links.** Phase to steps, paths and criteria; criterion to its obligations;
   obligation to its test reference; decision to the criteria it constrains; flag to its
   add-ons; phase to the handover of the phase before it.
3. **Add the framing.** The ticket, the goal and the non-goals, the accepted decisions and the
   repository invariants a step touches. They are small and they prevent local optimization.
4. **Add the next.** What the next phase expects: its inputs and the handover it will read.
5. **Exclude.** The steps of other phases, closed findings, superseded decisions, the events,
   timestamps and token counts, evidence bodies.
6. **Order.** Ticket and goal, criteria and obligations, paths and interfaces, steps and
   verify commands, handover, flags and add-ons, state and next, `missing`.
7. **Measure.** Compute the measures below, compare with the warning line of the shape, and
   print a warning when one is over. Nothing is dropped.
8. **Stamp.** Emit the shape, the flags, the contract revision and the bundle hash.

## Size: the removal test and the measures

No role has a fixed budget. A strict budget does not fit: the right size depends on the
change, and a ceiling that is too high for a small change is waste. Two things replace it.

**The removal test decides content.** A word, a sentence or a section stays only if removing
it would lower accuracy, value or content. Nothing is repeated across sections. The author
applies the test; the lint flags duplication and boilerplate.

**The measures stand in for a ceiling.** The bundle command computes them for every bundle,
from the same contract, so an author and a reader see the same numbers. The lint reports the
same three for the contract itself.

| Measure | What it is | What a warning means |
|---|---|---|
| Duplicate line share | the share of the bundle's lines that occur in more than one section | the contract states one fact twice; the author keeps one home |
| Free-text words per criterion | the words of free text carried by one `AC-` item | the criterion carries a rationale that belongs in a decision or in a slot |
| The warning line of the shape | the size of the bundle against a line set per shape | the bundle is larger than the changes of its shape; the author applies the removal test |

A warning never drops a section and never refuses a bundle. The line per shape starts from
the first bundles and is reset from the data; it is a signal to the author and to the
retrospective, not a gate.

## Example: coder, light change (`GH-77`, the card of `schemas/contract.yaml`)

```markdown
# Bundle: coder / GH-77 / PH-01
shape=light flags=none role=coder phase=PH-01 step=PH-01_S01
revision=contract:3 bundle=sha256:7f3a...
size=3.4KB line=6KB duplicate_lines=1% words_per_criterion=0

## Ticket (tracker)
GH-77: Add a JSON output to the export command.
A script that runs `export` parses the progress lines to learn when an export is finished,
which breaks whenever a message is reworded. With `--json`, the command should print one
JSON document instead.
The import command has the same problem and should get the same flag.

## Card (author)
Goal: the export command prints one JSON document when `--json` is passed, so a script can
use a finished export without parsing progress lines.
Scope in: a `--json` flag on the export command; a JSON renderer for the export summary.
API-1 (`export --json`, added): stdout carries one JSON document with a jobs array; the
exit codes are unchanged.
NG-1: this change does not alter the text output or any exit code.
Docs to reconcile: doc/guides/export.md.
DEC-1: stdout, with every progress line moved to stderr while `--json` is passed; a script
reads stdout and nothing else.
OQ-1: does the JSON document carry a version field? Default: no.
RSK-1: a script that parses the text output breaks when progress lines change stream. The
stream changes only while `--json` is passed.

## Verified facts (author)
| ID | Fact | How checked |
|---|---|---|
| VFACT-1 | The export command prints its progress through the shared logger, which writes to stdout. | read `src/cli/export.ts#run`: three `log.progress` calls; `log` writes to `process.stdout` |
| VFACT-2 | No JSON renderer for the export summary exists in `src/cli`. | `git grep -n render-json src/cli`: no match |

## Criteria and oracle (author; the runs are the tool's)
| ID | Statement | Proof: observable, predicate | Baseline |
|---|---|---|---|
| AC-1 | Given a finished export, when `--json` is passed, then stdout is one JSON document that parses. | PROOF-1 (test TC-EXPORT-001): one JSON object whose jobs array is not empty | red |
| AC-2 | With `--json`, no progress line reaches stdout, whatever the export writes to the terminal. | PROOF-2 (test TC-EXPORT-002): no line with the progress prefix | red |
| AC-3 | When `--help` is passed, the help text lists `--json`. | PROOF-3 (`node bin/export.js --help`, exit 0): the output contains `--json` | red |

## Work: PH-01, add the JSON output to the export command (author)
| Step | Action | Paths (read or write) | Verify |
|---|---|---|---|
| PH-01_S01 | Write the acceptance tests for the JSON output. | `tests/cli/export-json.test.ts` (write, add) | `pnpm typecheck`, exit 0 |
| PH-01_S02 | Add the JSON renderer and the `--json` flag. | `src/cli/render-json.ts` (write, add); `src/cli/export.ts` (write, modify) | `pnpm test tests/cli/export-json.test.ts`, exit 0 |

The phase also reads `src/cli/logger.ts`. Every command has the origin author and runs under
the command policy.

## Flags (tool proposed, PM confirmed)
None active. Removed at intake: `contract`, because the export command is used by a person at
a terminal and no service or client consumes its stdout.

## Slot for the coder (author)
renderer-note: the renderer reads the summary object that the text output already builds.
Do not add a second shape: a field added later to the summary then appears in both outputs
without another change here.

## State (tool)
state=delivery step=PH-01_S01 done=[] lint=pass preflight=pass

## Next (tool)
PH-01 is the last phase, so there is no handover. The doc-syncer reconciles the export guide, then the reviewer reads the diff.

## Missing (fetch on demand)
- decisions.DEC-1: the alternatives, if a new decision must be taken.
```

## Example: reviewer

```markdown
# Bundle: reviewer / GH-416 / round 1
shape=phased flags=data role=reviewer round=1 ceiling=3
revision=contract:5 bundle=sha256:b480...
diff=12 files, +940 -120 candidate=<commit digest>

## Ticket (tracker)
GH-416: A lane pushes its own last evidence commit before it stops.

## Goal and non-goals (author)
Goal: a lane pushes its last evidence commit before it stops, and the outcome is recorded.
NG-1: no change to branch protection or the merge path.

## Criteria, oracle and recorded runs (author; the runs are the tool's)
| ID | Statement | Proof: observable, predicate | Base | Candidate |
|---|---|---|---|---|
| AC-1 | `push <ref>` pushes once and reports the remote head. | PROOF-1: remote head equals the local head; one transport call | red | PASS |
| AC-2 | A refused transport is a data-bearing answer, exit 1, no new error identity. | PROOF-2: exit 1; cause from the vocabulary | red | PASS |
| AC-3 | `dispatch status` carries `lanePush` without changing an existing field. | PROOF-3: earlier fields unchanged; `lanePush` present | red | PASS |

## Decisions that constrain the diff (author)
DEC-1: the lane owns the push act; the engine's ensure-push is the backstop.
DEC-2: a refused transport is recorded with a closed cause token; no free-text reason.

## Flags and add-ons (tool proposed, PM confirmed)
`data`: the pre-code reader closed with no material finding; the concurrency rehearsal ran.

## Watchlist hits (tool)
| Obligation | Touched by the diff | What to check |
|---|---|---|
| PROOF-2 | its test file; a shared ledger fixture | is the assertion still the one that proves AC-2? |

## Commands the tool ran (tool)
| Command | Leg | Result | Origin |
|---|---|---|---|
| `pnpm test tests/behaviour/dispatch-lane-push-command.test.ts` | candidate | 16 run, 16 pass | author (PROOF-2) |
| the concurrency rehearsal of the `data` flag | candidate | 5 interleavings, 5 as specified | tool |

## Findings of earlier rounds (reviewer)
None: this is round 1.

## Missing (fetch on demand)
- work: the steps of each phase. The reviewer reads the diff from git.
```

## Example: pre-code reader

```markdown
# Bundle: pre-code reader / GH-416 / round 1
shape=phased flags=data role=pre-code-reader round=1 ceiling=3
revision=contract:4 bundle=sha256:9c21...
size=6.1KB line=9KB duplicate_lines=2% words_per_criterion=6

## Ticket (tracker)
GH-416: A lane pushes its own last evidence commit before it stops.

## Goal and scope (author)
Goal: a lane pushes its last evidence commit before it stops, and the outcome is recorded.
Scope in: a typed `push <ref>` command (one push, fast-forward only); a
`dispatch.lane-push` record kind with a closed cause vocabulary; an additive `lanePush` fact
on the dispatch status answer.
Out: a force push, a retry loop, a second push act, the merge path, branch protection.
NG-1: no change to branch protection or the merge path.

## Verified facts (author)
| ID | Fact | How checked |
|---|---|---|
| VFACT-1 | The engine's ensure-push runs on the merge path and not at the lane's stop. | read the merge path and its test |
| VFACT-2 | A parked lane can stop with its evidence commit unpushed. | one parked lane's local head against the remote |

## Criteria and oracle (author)
| ID | Statement | Proof: observable, predicate | Baseline |
|---|---|---|---|
| AC-1 | `push <ref>` pushes once and reports the remote head. | PROOF-1: remote head equals the local head; one transport call | red |
| AC-2 | A refused transport is a data-bearing answer, exit 1, no new error identity. | PROOF-2: exit 1; cause from the vocabulary | red |
| AC-3 | `dispatch status` carries `lanePush` without changing an existing field. | PROOF-3: earlier fields unchanged; `lanePush` present | red |

## Decisions and open questions (author)
DEC-1: the lane owns the push act; the engine's ensure-push is the backstop. Record TDR-0079.
DEC-2: a refused transport is recorded with a closed cause token; no free-text reason.
OQ-1: is the record written when the act fails? Default: yes, with the cause.

## Work (author)
| Phase | Title | Steps | Writes | Verify |
|---|---|---|---|---|
| PH-01 | Declare the contracts and the changeset | 3 | contracts, changeset | `pnpm typecheck` |
| PH-02 | Implement the push use case and the record append | 2 | use case, domain rules, ledger | `pnpm typecheck`, the behaviour suite |
| PH-03 | Add the push command and wire it into the composed program | 2 | command, renderer, composed program, help | `pnpm typecheck`, the behaviour suite |
| PH-04 | Update the surfaces, prompts, and docs | 2 | PM definition, feature page, decision record | the doc-conformance suite |

## Flags (tool proposed, PM confirmed)
| Flag | Proposed from | Confirmed | Add-ons |
|---|---|---|---|
| `data` | `packages/core/src/app/dispatch-ledger.ts` (write) | yes | this reader, a concurrency rehearsal |
| `contract` | `packages/cli/src/commands/` | removed: the command is new and has no consumer | none |

## Lint and preflight (tool)
lint: pass. preflight: 14 paths exist; 4 commands ran; 0 literals outside the declared paths;
2 named gates exist; every criterion has an obligation. The ticket has no typed block.

## State (tool)
state=pre_code_read round=1. Round 2 is allowed only if this round has a material finding.

## Missing (fetch on demand)
- oracle.PROOF-2 in full: fetch it if the fence refusal path needs it.
- work.PH-01: the steps of a phase; fetch the one under examination.
```

## Miss handling and the feedback loop

- Every bundle ends with `missing`. The agent fetches a section with
  `jaiship context get --section <id>`.
- The tool records each fetch **host-local**: the role, the phase, the section and the
  reason. A read writes nothing to the committed scope: no event, no commit, no dirty
  worktree.
- The miss rate is computed per role and phase from that store. It starts at its default, 10
  percent or less after two iterations, and is set from the data (Q9).
- The mandatory set is a **hypothesis that converges**. A section fetched in more than 20
  percent of the bundles for a role is promoted into the set. A section never fetched is a
  candidate for removal. After three to five changes the set has converged; the tuning
  itself continues with every retrospective.
- A miss is not a failure. A miss that causes rework is. The retrospective joins the fetches
  to the rework it finds in the events.

## Anti-patterns

- **A bundle that is the whole contract, in a flagged or phased change.** In a light change
  the card is the bundle by design; elsewhere it means the role has no mandatory set.
- **A reader's bundle without the ticket or the non-goals.** Its findings concentrate in
  coverage and format, the categories a tool can check.
- **A bundle without what the next phase expects.** The coder optimizes its phase and breaks
  the next.
- **A non-deterministic bundle.** The agent cannot cache or compare.
- **Prose the role does not need.** That is the 35x read amplification again.
- **A bundle padded to a line.** The line warns; the removal test decides.

## The one-command ideal, and its limit

The owner's ideal is that a coder runs one command and starts work. That holds for the
**contract** of a phase: the goal, the criteria, the paths, the obligations, the verify
commands, the handover and what comes next. It does not hold for **judgment**: the coder may
still need the surrounding code, the existing tests, or a decision's record. The bundle
gives the coder the contract; the repository gives the coder the code. The design goal is
that the agent never reads the artifact files, not that it never reads anything.

The delta protocol and the push model are deferred; both are in `13-context-delivery.md`.
