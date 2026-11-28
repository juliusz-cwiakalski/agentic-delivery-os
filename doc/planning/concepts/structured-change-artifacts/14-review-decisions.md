---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/14-review-decisions.md
---
# 14. Review decisions (parts 3 and 4)

This file records the owner's answers to the challenges and the resulting design changes. It is
the authoritative delta to the pack; where a core file and this file disagree, this file wins
until the core file is updated in the same revision.

## Part 3: the first three challenges

### 1. Hybrid specification with a backdoor

**Owner:** a hybrid is reasonable; some parts are structured, some are open text, and sections
may carry additional free-text fields. Leave a backdoor that is used where useful and skipped
where not.

**Decision:** a typed contract plus **declared extension slots**. Free text is allowed only in
a named slot with an audience (`useIn`) and a word budget, or marked `archive: true` (stored,
never served). A facet has at most three slots. The default is `useIn: []`, so an unused slot
costs nothing at read time. Extension text is never used for control flow.

A second layer is **progressive depth** on the same fact: `summary` (always served), `detail`
(served to roles that need it), `rationale` (served to the spec-writer, reviewer, and decision
roles). `jaiship context get --section <id> --depth summary|detail|rationale`.

**Design changes:** specification schema gains `extensions`; `03-schemas.md` documents the
slot rules; `05-context-bundles.md` documents the depth parameter; `04-cli.md` documents
`context get --depth`.

### 2. Invisible artifacts versus path permissions

**Owner:** path permissions are tricky; better to instruct agents to use the tool and not
share the artifact location. The agent might find the file, but the tool should be the path.

**Decision:** invisible by default, detect, deny writes later.

1. The agent-facing envelope never contains the change folder or an artifact path; only
   repository paths for code.
2. The tool resolves the change from the worktree registry, so the agent does not need the ID
   to navigate.
3. The bundle is more convenient than the file; a well-meaning agent uses it because it is
   easier, not because it is forbidden.
4. A lint and CI check detect hand edits; telemetry counts `read` calls on artifact paths.
5. A path deny is added for **writes** only after the pilot shows accidental edits. Reads are
   behavior, not a security boundary; a hard read deny breaks legitimate work and is easy to
   bypass.

Keep `context get --raw` for debugging and a recorded human import for emergencies.

**Design changes:** `04-cli.md` gains a visibility and permission section; `05-context-bundles.md`
states that the envelope carries no artifact path; `08-migration.md` sequences the write deny
after the pilot.

### 3. Perfectly crafted context

**Owner:** if the lifecycle is known, the required information per phase and agent is known;
the tool could prepare the perfect context. It may be hard to design up front.

**Decision:** phase templates plus role overlays plus on-demand fetch plus a measured miss
rate. The template is a hypothesis that converges after three to five changes, not a truth
declared once. The context requirement is explicit in the plan:

```yaml
contextFor:
  coder:
    include: [phase.goal, phase.acceptance, phase.paths, phase.tests, phase.verify,
               handover.prev, invariants, next]
    exclude: [plan.otherPhases, pm.history]
```

The tool has a mandatory set per role; the plan can add, never remove; the lint enforces the
mandatory set. The tool perfects the **contract**, not the **judgment**; the coder still reads
the code.

**Design changes:** the delivery plan schema gains `contextFor`; `05-context-bundles.md`
documents the template, the overlay, and the feedback loop; `03-schemas.md` documents the
field.

## Part 4: the remaining seven challenges

### 4. Manual editing and attribution

**Owner:** manual editing is not the big problem; the point is that if an AI edits, we can
detect it. If it is broken and the AI fixes it, that is okay. Target the maximum share of
changes by the tool and minimize the AI changes; with a commit per change we can track which
was which.

**Decision:** attribution, not prohibition. Tool-first; every artifact change is attributable
to the tool (trailer) or to an untyped edit (no trailer). A broken artifact repaired by hand
is acceptable and recorded through a **repair path**: `jaiship change repair --facet <facet>
--file <path>`, which validates and commits with a `Repaired-By` trailer. The metric is the
tool-written share of artifact changes, target 95 percent or more after the pilot. A hand edit
is an untyped edit, not an accusation.

**Design changes:** `04-cli.md` gains `change repair` and the attribution rule; `01-analysis.md`
softens challenge 4; `09-open-points.md` Q14 is answered as "detect first, deny writes after
the pilot".

### 5. One commit per change means one squash merge

**Owner:** the one-commit rule means one merge to the integration branch. A change has many
commits during delivery; when it is ready and the gates pass, it is squash-merged into one
commit. Not every change in one commit.

**Decision:** many tool commits on the change branch, one squash commit on the integration
branch. The tool commits are the audit trail; the squash is the history. The squash subject is
derived from the change title; its body from the phase list and the handovers. The one-commit
rule applies to the merge, not to the branch.

**Design changes:** `04-cli.md` and `08-migration.md` state the distinction explicitly;
`01-analysis.md` challenge 5 is updated.

### 6. The plan's paths and the audit

**Owner:** if the plan-writer misses something or the coder changes more, it is okay. Worst
case the merge authority resolves a conflict. It is also a learning opportunity: compare the
planned manifest with the actual changes.

**Decision:** the audit is a **learning signal**, not a gate. `plan audit` records undeclared
and unchanged paths; the retro compares the planned manifest with the actual diff; the
misprediction rate improves the plan templates. A hard failure remains only for a path outside
the change's scope or a protected area. The conservative scheduling default (undeclared scope
serializes) stays.

**Design changes:** `07-parallelism.md` changes the audit policy; `09-open-points.md` Q23 is
answered as "record and learn, fail only out of scope"; `01-analysis.md` challenge 6 is
updated.

### 7. The handover is the essence

**Owner:** agree; the handover is the essence of status, what was done, and the next steps or
hints, not big prose. Provide good hints in the coding agent prompt on how to prepare it.

**Decision:** the handover is **tool-drafted and coder-confirmed**. The tool drafts the entry
from the phase's evidence (commits, tests, gate results, plan steps); the coder edits five
fields with a three-bullet limit each. The prompt hints are part of the coder definition, not
a separate document. The budget stays 1KB.

**Design changes:** `06-workflows.md` includes the handover prompt; `05-context-bundles.md`
states the tool-drafted flow; `03-schemas.md` keeps the five fields.

### 8. The milestone contract is deferred

**Owner:** no need for milestone-specific structures now; milestones are designed from time to
time; free text is fine; maybe later for autonomous long-term deliveries.

**Decision:** the milestone contract is **deferred**. The core pack has five facets:
specification, test plan, delivery plan, PM context, handover. The milestone contract and goal
verification move to a deferred appendix and a future slice. The specification's `milestone`
field is a free-text label, not a link to a goal graph.

**Design changes:** `README.md`, `02-artifact-model.md`, `03-schemas.md`, `08-migration.md`
and `11-glossary.md` mark the milestone contract deferred; `schemas/milestone.yaml` moves to
`schemas/deferred/`; the specification example drops the `goals` link; `09-open-points.md`
Q25 and Q26 are deferred.

### 9. Slimmer process for small changes

**Owner:** fine with slimmer versions for small or single-line changes; be careful not to
remove something relevant; review what goes into each tier and how they work.

**Decision:** tiers remove **artifact volume**, not **safety checks**. Every tier keeps:
acceptance criteria, tests, a review, the gates, the DoD, the pull request, and provenance.
The tiers slim the specification prose, the test-plan depth, the plan granularity, the
readiness depth, and the handover requirement. A tier review table is added.

**Design changes:** `02-artifact-model.md` expands the tier table; `03-schemas.md` states
what is mandatory in every tier; `08-migration.md` adds a tier review step.

### 10. Split or one big change

**Owner:** understands it is significant; wondering whether to split or deliver it all in one
big change; multiple delivery phases; sees a lot of gains; open to suggestions.

**Decision:** **one epic, multiple pull requests, one milestone.** Not one big-bang pull
request. The slices share a schema and a CLI, land behind flags, and are measured. The
recommendation is slice 0 (typed ledger) and slice 1 (data-first plan plus coder and reviewer
bundles) first, then slices 2 to 5 tightly sequenced. A single long-lived branch would be hard
to review and risky to land; the epic keeps the coherence the owner wants.

**Design changes:** `08-migration.md` states the epic-and-PRs model; `09-open-points.md` Q30
is answered as "one epic, multiple PRs, one milestone".

## Part 2: the eight challenges

### 1. Auto-discovery from the worktree registry

**Owner:** no need to use the branch name; if the delivery start is managed by Jaiship, it
creates a worktree for the change and records that the worktree is for this change. The change
ID is then known deterministically.

**Decision:** the **worktree registry is the primary resolution**, not the branch name. The
dispatch records the worktree, the branch, and the ref; the tool resolves the change from the
working directory. The branch name is a fallback for a legacy or manual worktree, validated
and untrusted. The invariant is one lane, one change: the tool refuses a write to another
change from a lane worktree unless explicitly authorized.

**Design changes:** `12-deterministic-core.md` changes the resolution order; `05-context-bundles.md`
notes that the envelope carries no artifact path.

### 2. The ID is implicit by default, not hidden

**Owner:** no need to hide the ID; the point is the agent does not have to specify "modify
change 1234" because the context is clear; one workstream, one lifecycle, one change; avoid
modifying multiple changes in one shot.

**Decision:** **implicit by default, explicit when needed.** The envelope carries the ID; the
commands default to the current change; `--change` is available for cross-change operations
(a reviewer comparing two changes, the CEO). One lane, one change.

**Design changes:** `12-deterministic-core.md` and `13-context-delivery.md` rephrase "hidden"
to "implicit"; `04-cli.md` documents the default.

### 3. A gated state machine with workflow templates

**Owner:** a state machine with gated transitions; the PM initially evaluates the change type
and chooses the workflow or reduces states for small changes; later an agent can add a review.

**Decision:** the state machine is **parameterized by a workflow template** selected at intake.
The PM or CEO classifies the change (tier, risk, type) and selects a template (S, M, L, or a
named workflow). The template defines the states, gates, and artifacts. The PM can **add** a
state with a recorded reason (for example an extra review); it cannot remove a mandatory gate.
The machine handles the gated transitions; the PM handles the exceptions.

**Design changes:** `12-deterministic-core.md` adds workflow selection and templates;
`02-artifact-model.md` links the tier to the template; `08-migration.md` sequences the
template work.

### 4. Deterministic commits from the phase story

**Owner:** the delivery plan's goal is also used for commits; each phase is named to tell the
story (what the phase is about, its goal); the phase name is the first line and the acceptance
criteria are the body; use deterministic commits wherever possible.

**Decision:** the phase title is the commit subject (`feat(<ref>): <phase title>`); the
acceptance criteria are the body; the handover's `done` and `deviations` follow. The phase
title is linted for a verb phrase with an object and a goal. The tool never invents a summary.

**Design changes:** `12-deterministic-core.md` strengthens the derivation; `03-schemas.md`
lints the phase title; the plan example is updated.

### 5. Keys that carry meaning stay

**Owner:** does not mind keys; if they help communication and understanding, keep them.

**Decision:** the projection keeps the **semantic keys** (ID, statement, evidence, path, kind)
and omits the **YAML structure keys** (`acceptanceCriteria:`, `- id:`, indentation). Tables
carry the meaning; the syntax noise goes.

**Design changes:** `13-context-delivery.md` states the rule; the envelope examples already
use tables with semantic keys.

### 6. Deltas are parked; focus on slicing

**Owner:** park versioning; focus on slicing what is provided in the context, for example a
phase with the handoff message instead of the full plan.

**Decision:** the delta protocol is **deferred**. The first version is stateless full bundles
per role and phase; the `--since` idea stays as a future option, not a slice.

**Design changes:** `13-context-delivery.md` marks the delta section deferred; `08-migration.md`
removes the delta slice.

### 7. The push model is out for now

**Owner:** keep it out; the messaging system is another concept for loosely coupled
coordination, not the strict single-change lifecycle.

**Decision:** the push model is **out of scope** for this pack; it is a related concept in
`../inter-agent-communication.md`, not a facet of the delivery lifecycle.

**Design changes:** `13-context-delivery.md` marks the push section deferred and links the
related concept; `README.md` removes it from the proposal summary.

### 8. The total-function boundary and the exception budget

**Owner:** agree; do not over-program; use scripting and algorithms where they fit; AI for
judgment and decisions; do not push program everywhere and end up with dozens of exceptions.

**Decision:** the total-function test plus an **exception budget**. If a deterministic rule
needs more than three exception cases, it is a judgment task, not a rule. The tool does the
deterministic 80 percent; the agent does the judgment 20 percent.

**Design changes:** `12-deterministic-core.md` adds the exception budget; `01-analysis.md`
references it.

## Part 5: classification, rounds and the contract

Owner review on 2026-11-28, after a study of real deliveries in product repositories. The
evidence note is kept outside this pack; the design is in `15-classification-and-rounds.md`.

### 11. One author, readers instead of co-authors

**Owner:** merging the writers into one is the right move, and the PM may write the card for a
light change; the reviewer probably stays a separate adversarial reader.

**Decision:** one contract with typed sections, written in one pass. The PM writes the card of
a light change at intake; one author subagent writes a larger contract. The test plan and the
plan become sections of the contract. The test-plan-writer and the plan-writer retire as
separate agents; their checklists move to two readers: an optional pre-code reader, and the
reviewer, which every change keeps as a separate agent. Refined by decision 24: the plan-writer
retires, and the test-plan-writer becomes the acceptance author.

**Design changes:** `02-artifact-model.md`, `03-schemas.md`, `schemas/`, `04-cli.md`,
`05-context-bundles.md`, `06-workflows.md`; section 15, parts 5 and 6.

### 12. Rounds are earned

**Owner:** cap the readiness rounds at two, and let it depend on scale: a re-review makes
sense when the previous round was substantial.

**Decision:** a further round is allowed only after a substantial round, one with at least one
material finding. Ceilings are two rounds for a small change and three for a large one. Past
the ceiling the PM or the CEO decides between the positions. Mechanical, wording and format
findings never earn a round. Escalation of the shape keys on the finding's category and
materiality, not on a severity word.

**Design changes:** `04-cli.md` gains `review rounds allowed`; `12-deterministic-core.md`;
section 15, part 6; Q20 and Q21 in `09-open-points.md`.

### 13. Low risk by default, flags on the surface

**Owner:** trivial work such as documentation edits and minor translation corrections is low
risk; the flag approach is accepted, on the condition that the evaluation is done properly.

**Decision:** low risk is the default. Eight starter flags key on the surface a change
touches. The tool proposes flags from the paths against a per-repository surface map, at
intake, when the contract is validated, at review and before merge. The PM confirms at
intake. Hints on the ticket are advisory. There is no classification agent.

**Design changes:** section 15, parts 1 to 4; Q1 and Q43 in `09-open-points.md`.

### 14. State, content and history are separate

**Owner:** timing data belongs in tool-written files that delivery agents never read; the plan
has phases and steps with stable identifiers; evidence stays out of the main change file; the
handover carries cross-phase facts; one interface, with the storage free to change.

**Decision:** four kinds of information (state, content, history, learning) and seven read
contexts. Progress is an event over a stable identifier, not an edit. Evidence is carried by
reference. The handover is the only cross-phase carrier. The commands and the bundles are the
interface; the files are implementation.

**Design changes:** section 15, part 7; `13-context-delivery.md`; Q19 and Q45 in
`09-open-points.md`.

### 15. Measure cost per role and phase

**Owner:** record sessions and tokens per agent per change; the harness session store already
holds them.

**Decision:** the tool records sessions and tokens per role at every boundary, from the
session store through the worktree registry, and derives cost per phase and per gate.

**Design changes:** section 15, part 8; the method of `10-evidence.md` becomes a product
capability.

### 16. Budgets are rules, not fixed numbers

**Owner:** strict budgets do not fit; the right size depends on the change, and a ceiling that
is too high for a small change is waste. Put in only what effective delivery needs, without
filler or repetition. The test: would removing this word, sentence or section lower accuracy,
value or content? If not, it goes.

**Decision:** no fixed budget per role. Content follows the removal test. A ceiling scales with
the contract and warns rather than refuses. The lint flags duplication and boilerplate. The
miss rate starts at its default and is set from data.

**Design changes:** `02-artifact-model.md` (budgets), `05-context-bundles.md`,
`13-context-delivery.md`; Q8 and Q9.

### 17. Pilot and tuning

**Owner:** pilot on at least one change of each size, then re-evaluate after each of the next
ten to twenty changes of different sizes. Twenty percent is a good start; tuning never ends.

**Decision:** as stated. The retrospective across products is the tuning mechanism.

**Design changes:** `08-migration.md` (the pilot); Q27 and Q28.

### 18. The handover's content is the coder's judgment

**Owner:** no single answer; the coder decides what the next phase needs and what is not
already in the plan. The tool may add what it can derive, such as the files changed.

**Decision:** the tool drafts the handover from events; the coder keeps only what the next
phase needs and what changed. The five-field, three-bullet shape is the skeleton of the draft,
not a quota.

**Design changes:** `03-schemas.md` (handover), `06-workflows.md`; Q42.

### 19. The surface map and the ceiling override

**Owner:** path patterns per repository, maintained by the CEO and the PM and improved as
retrospectives find discrepancies; the PM decides flag by flag; the creator of a ticket may
flag it first. The round rules as proposed, with the PM or the CEO free to override a ceiling
in a specific case.

**Decision:** as stated. A retrospective proposes a correction to the map; the correction
lands as a normal repository change.

**Design changes:** section 15, parts 2, 4 and 6; Q43 and Q44.

### 20. What the tool writes is YAML

**Owner:** it depends: anything written through a tool should be YAML, the balance between
human and agent readability and full machine readability.

**Decision:** written by the tool, YAML; served to an agent, the Markdown envelope; between
tools, JSON. The contract is one YAML file; there is no separate prose file.

**Design changes:** `03-schemas.md`, `schemas/`, `13-context-delivery.md`; Q35 and Q6.

### 21. Tickets that each deliver value alone

**Owner:** a roadmap with an initial ticket breakdown, where every ticket delivers value on
its own even if the rest is parked. One to three tickets are acceptable where splitting makes
no sense. No strict budget: time and return decide.

**Decision:** `17-roadmap.md`: six tickets in dependency order, each worth merging alone,
collapsing to three. Open for confirmation (Q30).

### 22. Testing inside a change

**Owner:** not yet clear; to be discussed in detail.

**Decision:** none yet. The proposal is `16-testing-in-a-change.md`: criteria and obligations
in the contract, native tests, red and green runs recorded by the tool, expectations protected
from the coder, the reviewer's mutation. Q47 decides. Q48 asks whether an emergency shape
exists.

### 23. Decided on the owner's behalf

**Owner:** no preference; decide on the best knowledge of the intent.

**Decision:** Q41: at most three free-text slots per contract, each naming its reader or
archived, with a guide of about 120 words; a warning and not a refusal. Q7: coverage is
traceability, derived by the lint, nothing stored.

### 24. Testing inside a change

**Owner:** the coder writes the tests, plus an independent author for `security` and `data`.

**Decision:** `16-testing-in-a-change.md` as proposed. The independent author is the acceptance
author: the existing test-plan-writer with this job instead of a test-plan document. It is
invoked only by those two flags and writes the acceptance tests before the coder starts. This
refines decision 11: the plan-writer retires; the test-plan-writer changes its job.

### 25. Identifiers come from the catalog

**Owner:** traceability needs well-scoped identifiers; use the identifier catalog and start
introducing it.

**Decision:** reuse the catalog's change-local prefixes. Register `AC-`, `PROOF-`, `FACT-`,
`PH-`, `FIND-` and `RSK-`, all change-local with the contract as the allocator. Do not
register `PRE-`, `ACT-` or the milestone goals. Section 15, part 10.

### 26. The roadmap is confirmed

**Owner:** six tickets, each deliverable alone from the top, and any prefix must leave a
consistent solution. The CEO is responsible for delivery and optimizes for a fast delivery,
because this work improves every later delivery.

**Decision:** `17-roadmap.md`, six tickets in order, with the prefix statement.

### 27. No emergency shape

**Owner:** an urgent code fix goes through a light version of the change process, still through
CI and the gates. A quick configuration fix outside the change process is out of scope.

**Decision:** no emergency shape (Q48).

### 28. The study's figures may be published

**Owner:** the private projects are the owner's; real figures may be published.

**Decision:** `18-delivery-study.md` carries the figures, without names, ticket references or
paths.

### 29. Two classes of evidence

**Owner:** persistent evidence is the audit record (tokens and time per phase and agent);
exact test evidence lives outside the committed scope, in the product's own store for the
repository and the change, auditable, with housekeeping and archiving rules.

**Decision:** audit facts are events and stay with the change. Evidence bodies live in the
tool-managed local store, per repository and per change, with retention rules. Section 15,
part 7; Q45.

### 30. Scope granularity, reads and writes

**Owner:** allow files and folders; the planning agent decides. Reads and writes may be modeled
separately; make it possible in the tool and experiment with the prompts.

**Decision:** the scope keys stay (files, folders, packages). Each path carries read or write.
Overlapping writes serialize; a read-only overlap may run in parallel with a re-sync note. The
pilot compares the two prompt policies. Q22 and Q24.

### 31. Removal, forms, imports, research, hints

**Owner:** remove what is no longer in use, never what is. The rest was explained and proposed.

**Decision:** the compatibility reader goes when no open change uses the earlier files (Q29).
A form is the default for the first write of a contract (Q36). A hand repair goes through
`change repair`, so Q17 is superseded by Q14. No external researcher while every point has a
conclusion (Q40). Ticket hints are a typed block, with labels still allowed (Q49).

## Summary of the design changes

| Area | Change |
|---|---|
| Facets | Five core facets; the milestone contract is deferred to an appendix |
| Specification | Typed contract plus declared extension slots and progressive depth |
| Delivery plan | `contextFor` per phase and role; the phase title is the commit subject |
| Handover | Tool-drafted, coder-confirmed, five fields, 1KB |
| Visibility | Invisible by default; detect; deny writes after the pilot; reads are behavior |
| Attribution | Tool trailer or an untyped edit; a repair path; tool-written share metric |
| Commits | Many branch commits, one squash merge; deterministic subjects and bodies |
| Audit | Learning signal, not a gate; fail only out of scope |
| Tiers | Slimmer artifacts, never slimmer safety checks; a tier review table |
| Delivery | One epic, multiple pull requests, one milestone |
| Discovery | Worktree registry primary; branch fallback; one lane, one change |
| ID | Implicit by default, explicit when needed |
| Workflow | Gated state machine parameterized by a template; PM can add, not remove |
| Output | Semantic keys stay; YAML structure keys go; tables |
| Deltas | Deferred; stateless full bundles first |
| Push | Out of scope; a related concept |
| Boundary | Total-function test plus an exception budget of three |
| Contract | One contract with typed sections, one author, two readers |
| Rounds | Earned by a material finding; ceilings two and three |
| Shape | Low risk by default; flags on the surface; the tool proposes, the PM confirms |
| Information | State, content, history and learning are separate; seven read contexts |
| Cost | Sessions and tokens recorded per role and phase by the tool |
| Budgets | No fixed budget per role; the removal test decides content |
| Storage | Written by the tool: YAML; served to an agent: the Markdown envelope |
| Testing | Criteria and obligations in the contract; runs recorded by the tool (proposal) |
| Roadmap | Six tickets that each deliver value alone, in dependency order |
| Identifiers | From the catalog: `AC-`, `PROOF-`, `FACT-`, `PH-`, `FIND-`, `RSK-` |
| Evidence | Audit facts are events; evidence bodies live in the tool's store |
| Testing | The coder writes the tests; an acceptance author for `security` and `data` |

## Remaining open points

Every numbered question now has an answer or a confirmed default in `09-open-points.md`
and `13-context-delivery.md`. Three were explained to the owner on 2026-11-28 and carry a
proposed answer: Q17 (superseded by Q14), Q29 (remove the compatibility reader when no open
change uses the earlier files) and Q36 (a form for the first write of a contract). They stand
unless the owner objects.
