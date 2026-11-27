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

## Remaining open points

The following still need an inline answer; the rest have a default that this revision
implements:

- The exact contents of each tier (Q1, Q2, Q9).
- The number and budget of extension slots (new, see `09-open-points.md` Q41).
- The audit policy for a path outside the change's scope (Q23).
- The handover prompt wording (new, Q42).
- Whether to launch the external researcher now (Q40).
- The pilot ticket and the token-reduction threshold (Q27, Q28).
