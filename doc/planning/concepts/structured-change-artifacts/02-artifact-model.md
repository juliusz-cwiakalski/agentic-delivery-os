---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/02-artifact-model.md
---
# 02. The artifact model

Status: **Proposal** (2026-11-28). Governed by part 5 of `14-review-decisions.md` (decisions 11
to 42) and by sections 15 to 18; where this file and they disagree, they win.

## Three stored artifacts

A change owns three stored artifacts. Each owns one kind of fact, is written by the tool on a
role's typed commands, and is read by other roles through a bundle. The same fact is written
once and referenced by its identifier.

| Artifact | File | Owns | Written on the commands of | Read by |
|---|---|---|---|---|
| The contract | `chg-<REF>-contract.yaml` | What must be true, why, and what proves it: seven sections in one YAML file | The author: the PM for a light change, the contract author otherwise | Every role, the sections it needs |
| Typed open items | `chg-<REF>-open-items.yaml` | The PM's working state: blockers, questions, decisions to take, next actions | The PM | The PM and the CEO, in the PM brief |
| The handovers | `chg-<REF>-handovers.yaml` | What the next phase needs and what changed | The tool drafts from events, the coder confirms | The next coder, the PM, the reviewer |

Everything else is derived, or written by the tool alone, or kept outside the committed tree:

- **Derived, never stored:** state (the current phase and step, the flags with unmet add-ons,
  the last handover), coverage, the add-ons of a flag and the proposed flags.
- **Written by the tool alone:** the event log, the change capsule, which no role reads during
  delivery (`15-classification-and-rounds.md`, part 7).
- **Outside the committed tree:** evidence bodies, read telemetry and live cost.
- **Outside the three:** code and tests, decision records, and memory candidates.

```text
doc/changes/<YYYY-MM>/<date>--<REF>--<slug>/
  chg-<REF>-contract.yaml      # the contract
  chg-<REF>-open-items.yaml    # typed open items
  chg-<REF>-handovers.yaml     # one entry per phase
  events.jsonl                 # the event log, written by the tool only
  candidates/                  # memory candidates, written by the agents
```

## The contract's seven sections

| # | Section | Owner | Reader | Rules |
|---|---|---|---|---|
| 1 | Goal, scope and non-goals | The author | Every reader: the ticket and the non-goals are in every reader's bundle | One goal statement; the scope in; the interfaces (`API-`, `EVT-`, `DM-`); the current-truth documents to reconcile (`docs`); the non-goals (`NG-`) bind like the scope |
| 2 | Acceptance criteria | The author | The coder, the reviewer, the definition of done | Few (`AC-`): an example, a property or a table of vectors; a vague criterion cannot be proved and fails the lint |
| 3 | Verified facts | The PM at intake, the author after it | The author and the readers | `VFACT-`, each with how it was checked: a path and an anchor, a command, a version |
| 4 | Decisions and open questions | The author | The PM (one line each), the coder, the reviewer | `DEC-` with its purpose in one line; `OQ-` with a default, so delivery proceeds without an answer |
| 5 | The oracle | The author; only the author revises it | The coder, the reviewer, the gates | One `PROOF-` or more per criterion, each naming its observable and its predicate (`16-testing-in-a-change.md`) |
| 6 | The work | The author | The coder, the reviewer, the scheduler | `PH-` phases and `PH-02_S03` steps, each with its paths and its verify command; the phase title is a verb phrase with an object |
| 7 | Risk flags and their add-ons | The tool proposes, the PM confirms | The PM, the reviewer, the CEO | Eight enumerated flags; a removed proposal carries a reason; `RSK-` statements with a mitigation; the add-ons follow from the flags (`15-classification-and-rounds.md`, part 2) |

Free text lives only in declared slots: at most three per contract, each naming its reader or
archived. A slot without a reader is never served. A field's shape is in `03-schemas.md`.

## Identifiers

Identifiers follow `../id-prefix-catalog.md`: register before minting, one allocator per
space, monotonic, references by identifier. The register (`15-classification-and-rounds.md`,
part 10; decision 41):

| Prefix | Identifies | Scope | Allocator |
|---|---|---|---|
| `AC-` | A criterion: an example, a property or a table of vectors | change-local | The contract |
| `PROOF-` | An obligation: the link from a criterion to its proof | change-local | The contract |
| `VFACT-` | A verified fact of the diagnosis, with how it was checked | change-local | The contract |
| `PH-` | A phase; a step is `PH-02_S03` | change-local | The contract |
| `RSK-` | A risk statement with its mitigation | change-local | The contract |
| `RFIND-` | A reader's finding, with its category and materiality | change-local | The tool, in the change's event log |
| `TC-` | A test case: a test file and the case that proves an obligation | change-local | The contract |
| `DEC-`, `OQ-`, `NG-`, `API-`, `ALT-`, `EVT-`, `DM-` | A decision, an open question, a non-goal, an interface item, a rejected alternative, an event item, a data-model item | change-local | The contract |
| `INVAR-` | A repository invariant a criterion asserts | repo-local | The repository's register |

Rules:

- References use identifiers, never names. A reference that resolves to nothing fails lint.
- A phase and a step share one grammar, `PH-<nn>` and `PH-<nn>_S<nn>`. A reopened step keeps
  its identifier.
- Identifiers are monotonic. A revised criterion keeps its identifier; a criterion that stops
  applying is marked superseded and is never deleted or renumbered.
- Flags are enumerated names, not identifiers. Event names are code-native and never
  numbered. An open item has a number inside its file and no catalog identifier.
- `VFACT-` and `RFIND-` are the proposed names; the catalog owner decides them.

## One home per fact

| Fact | Home | Read from |
|---|---|---|
| What must be true, and what is out | Contract, sections 1 and 2 | The bundles, the definition of done |
| What was verified, and how | Contract, section 3 | The author, the readers |
| Why it was decided | Contract, section 4; a durable decision in its record | The PM brief, one line; the reader on demand |
| What proves it | Contract, section 5 | The gates, the reviewer |
| Which paths the change touches | Contract, section 6 | The scheduler, the lint, the audit |
| Which flags are active, and which were removed | Contract, section 7 | The PM brief, the reviewer, merge |
| What is open for the PM | Typed open items | The PM brief |
| What the next phase must adjust to | The last handover | The next coder's bundle |
| Where the change is, what was found, what each gate saw | The event log | `workflow next` and the PM brief, as a fold; the log itself is read by nobody during delivery |
| What it cost | Live cost in the host-local store; one aggregate record per change in the measurement log | The retrospective, `change cost` |
| What was learned | Memory candidates | The retrospective; promoted at closeout |

A bundle selects and orders facts; it never rewrites them. If a bundle needs a fact that has
no home, the model is missing a field, not the bundle. The full table, with every store, is
in `15-classification-and-rounds.md`, part 7.

## Lifecycle of the contract

| Stage | What happens |
|---|---|
| Written | The tool writes it on the author's commands: `contract form` and `contract set` for the first write, `contract add` and `contract set` for an edit, `contract revise` for a new revision. Every write is one transaction and one commit (`04-cli.md`). |
| Validated | `lint change` and `preflight` pass on a revision. The fact is in the event log; a reader's round closes on it. |
| Superseded | A change to what must be true is a new revision with a recorded reason: a finding, a decision, a changed expectation. Identifiers are kept. |
| Repaired | A file that fails lint, or was edited by hand, goes through `change repair`: the tool validates it and commits it with a `Repaired-By` trailer. |

The file has no status field: a write that succeeds is committed, and validation is an event.

## Three shapes

The shape follows the change's surface, its decisions and its repository's oracle, never its
size in lines (`15-classification-and-rounds.md`, parts 1 and 3).

| Shape | When | Who writes the contract | What it holds |
|---|---|---|---|
| Light | No flag, one phase, few decisions | The PM, at intake | A card: one phase, one to three criteria, each with an obligation |
| Flagged | One or more flags | The contract author | The card and each flag's add-ons: negative and boundary cases, properties for invariants, the flag's own evidence as obligations |
| Phased | Three or more phases, or decisions that need a record | The contract author | Phases with steps and handovers, verified facts, a decision log |

Who writes a light card before the classification ticket lands is in
`15-classification-and-rounds.md`, part 5.

Every shape keeps the safety checks: acceptance criteria, a recorded proof, a review, the
gates, the definition of done, the pull request and provenance.

## No fixed budgets

There is no fixed budget per role or per section. Content follows the removal test: a word, a
sentence or a section stays only if removing it would lower accuracy, value or content. The
test is the author's intent. What stands in for a ceiling is measured: the duplicate line
share across sections, the free-text words per criterion, and a warning line per shape. Each
warns and none refuses (`15-classification-and-rounds.md`, part 7). The caps that refuse are
the parsing caps in `03-schemas.md`; they protect the parser, not the content.

## Memory and retrospectives

- **Working memory** is the PM brief: the current state and the typed open items, read by the
  PM at every step.
- **Content** is the contract. A decision that outlives the change is a decision record; the
  `DEC-` in the contract links it.
- **Episodic memory** is the handovers, one bounded entry per phase.
- **Evidence** is the event log and the cost records. The retrospective reads both; the PM
  never does.
- **Learning** is the memory candidates in `candidates/`, promoted at closeout
  (`../memory-architecture.md`).

## Files a change in flight may still carry

A change in flight may carry a specification (`chg-<REF>-spec.md`), a test plan
(`chg-<REF>-test-plan.md`), a plan (`chg-<REF>-plan.yaml`) and a ledger
(`chg-<REF>-pm-notes.yaml`). The rules (decision 40; `08-migration.md`):

- They stay until that change lands. The compatibility reader reads them, and the tool never
  writes them.
- A new version of the tool reads every shape the previous one wrote and writes only the
  current one. The contract is the only new shape.
- `change migrate` moves a change to the contract and the typed open items. It refuses to drop
  content: what has no slot is named, and the migration stops.
- The compatibility reader is removed when no open change uses those files. The tool reports
  that state, and no fixed period applies.
