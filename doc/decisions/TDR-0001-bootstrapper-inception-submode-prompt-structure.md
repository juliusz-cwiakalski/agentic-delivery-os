---
id: TDR-0001
decision_type: tdr
status: Proposed
created: 2026-06-27
decision_date: null
last_updated: 2026-06-27
summary: "Organize the @bootstrapper inception sub-mode as terse nested <phase_N_inception> sections under a <mode_new_project_inception> umbrella, parallel to the legacy <workflow_phases> block, referencing the guide for content detail (option a)."
owners:
  - "Juliusz Ćwiąkalski"
service: bootstrapper-agent
decision_area: architecture
decision_scope: repo
reversibility: moderate
review_date: null
business_impact: "None — internal agent-product structure."
customer_impact: "Adopters running new-project inception get a reliable, self-contained agent; legacy onboarding is unaffected."
classification:
  domains: [architecture, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: local
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: "Juliusz Ćwiąkalski (authority delegated by repo owner for GH-71 open-question resolution; final acceptance rides the GH-71 PR review)"
  contributors:
    - "@toolsmith (prompt author / implementer)"
    - "@pm (GH-71 driver)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-71 PR)"
  performers:
    - "@toolsmith"
  informed:
    - "ADOS users"
ai_assistance:
  used: true
  roles: [analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Prompt instruction-following measurably degrades after the inception sub-mode is added (RSK-1 realized) — re-evaluate splitting the companion detail out or splitting the agent."
  - "GH-72 (inception:3) reuses this sub-mode infrastructure for the legacy flow — revisit whether the shared back-half (Phases 5-7) should be factored into shared sections."
  - "The guide gains a structural counterpart that would make a referenced-detail split (option b) strictly better than inline control flow."
links:
  related_changes: ["GH-71"]
  supersedes: []
  superseded_by: []
  spec: ["doc/changes/2026-06/2026-06-26--GH-71--bootstrapper-new-project-inception-mode/chg-GH-71-spec.md"]
  contracts: []
  diagrams: []
  decisions: ["ADR-0001"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# TDR-0001: @bootstrapper Inception Sub-Mode Prompt Structure

## Context

Change **GH-71** extends the `@bootstrapper` agent with a new-project inception mode
(`mode: new`) implementing the 8-phase iterative workflow (phases 0-7) defined in
`doc/guides/project-inception.md` (delivered in GH-69). The existing agent file
(`.opencode/agent/bootstrapper.md`) is already **384 lines** and serves the legacy
existing-project 6-phase flow via a `<workflow_phases>` block plus dedicated
`<phase_1_repo_scan>` ... `<phase_6_write>` sections, a `<persistent_state>` schema, a
`<resume_behavior>` block, and a `<write_allowlist>`.

The change is **additive and parallel** (NFR-4, AC16, F-16): the legacy 6-phase flow, its
git-ignored state schema (`.ai/local/bootstrapper-context.yaml`), and its resume behavior must
remain byte-for-behavior unchanged. The inception additions use a *committed* state file
(`doc/inception/inception-state.yaml`, DEC-1) and a per-phase human gate (F-12).

Two locked prior decisions constrain the structure space:

- **DEC-2 / NFR-3 / NFR-5 / AC17:** the agent **references** `doc/guides/project-inception.md`
  (the human-readable authority) rather than recreating its prose; the prompt and guide must
  not contradict.
- **Research-stage decision (recorded in the spec):** *extend the existing `@bootstrapper`
  agent*, not a new agent. This mirrors ADR-0001's choice of *modes-within-one-agent* over
  per-domain agents.

The spec's OQ-1 asks how the 8-phase inception workflow should be organized inside
`bootstrapper.md` to manage prompt size and the `@toolsmith` hand-off. Risk RSK-1 flags that
prompt bloat degrades instruction-following; the ticket hint states: *"Use sub-mode sections in
the prompt to keep it organized."* Editing the agent is delegated to `@toolsmith` (DEC-4; the
hard rule in `AGENTS.md` "Extending the system").

This record resolves OQ-1 so the implementation plan can proceed.

## Problem Framing (Clarified)

The decision question is **not** "where should the human-readable content live?" (answered by
DEC-2: the guide). It is: **where should the agent's operational control flow for the 8 phases
live, and how is it structured, given the prompt IS the product and the file is already large?**

The root tension is between two failure modes:

- **Inline everything** → prompt bloat → instruction-following degradation (RSK-1), and
  duplicated prose that drifts from the guide (NFR-3/NFR-5 violation).
- **Offload the phase logic to an external file** → the agent stops being self-contained at
  runtime (it must re-read a large guide every turn to know what to do), and a *third*
  authority (a companion doc) is introduced that must be co-maintained with both the guide and
  the prompt — multiplying the drift surface (RSK-5).

Facts established from the repo:

- **FACT:** `bootstrapper.md` is 384 lines, structured as frontmatter + named XML-style
  sections (`<workflow_phases>`, `<phase_1..6>`, `<persistent_state>`, `<resume_behavior>`,
  `<write_allowlist>`, etc.).
- **FACT:** The project principle (`decision-instructions.md`) states: *"Self-contained agents
  — an agent's prompt should not depend on external definitions it cannot read at runtime.
  Critical concepts get an inline glossary."* The agent *can* read files at runtime, so
  referencing the guide is permissible; the principle guards against offloading **control
  flow** the agent needs to act.
- **FACT:** The guide (`doc/guides/project-inception.md`) already holds all phase detail
  (activities, anti-sycophancy prompts, outputs, conditional matrix).
- **ASSUMPTION:** A terse per-phase section (purpose, inputs, anti-sycophancy step, gate,
  state update, artifacts produced, guide reference) is substantially smaller than the guide's
  prose for the same phase.
- **TO CONFIRM:** The exact per-phase token budget is an `@toolsmith` implementation detail,
  not a decision-level concern.

## Constraints (Hard Requirements)

### C-1: Legacy behavioral parity  *(HISTORICAL — superseded by the addendum at the top of "## Decision"; the legacy 6-phase flow was eradicated in the GH-71 unification, so this constraint no longer applies. Kept for record integrity.)*

- **Statement:** The legacy 6-phase flow, its `<workflow_phases>` block, its `<phase_1..6_*>`
  sections, its git-ignored state schema, and its resume behavior remain byte-for-behavior
  unchanged; the inception additions are additive and isolated.
- **Source:** AC (AC16, F-16) / NFR (NFR-4)
- **Verification:** code review (legacy section + state schema diff is empty; a legacy-parity
  structural check passes)
- **Negotiable:** no

### C-2: Self-contained operational control flow, inline

- **Statement:** The prompt must contain the inception **operational control flow** inline —
  the phase sequence, the per-phase human gate, the anti-sycophancy→phase map, the state-update
  points, and the artifacts produced per phase. Only the human-readable **content detail** may
  be referenced from the guide (no prose duplication).
- **Source:** internal standard (NFR-3, NFR-5, AC17; `decision-instructions.md`
  "Self-contained agents" principle)
- **Verification:** code review (phase control flow present in the prompt; no guide prose
  copied; guide referenced)
- **Negotiable:** no

### C-3: Single agent — extend, do not split

- **Statement:** The inception capability is added to the existing `@bootstrapper` agent; no
  new agent file is created.
- **Source:** prior decision (GH-71 research-stage decision; spec In-Scope; consistent with
  ADR-0001)
- **Verification:** code review (exactly one agent file modified; no new file under
  `.opencode/agent/`)
- **Negotiable:** no

### C-4 (table-stakes): Guide remains the single human-readable authority

- **Statement:** `doc/guides/project-inception.md` remains the human-readable authority
  (DEC-2). Every alternative below preserves this; acknowledged once rather than per row.

## Decision Drivers

Ranked; all tradeable (none is a gate — gates live above in Constraints).

1. **Prompt maintainability / @toolsmith hand-off** (highest) — the structure must be
   navigable and cheaply editable by `@toolsmith`; one file, one hand-off, clear sub-mode
   boundaries.
2. **Instruction-following fidelity** — avoid bloat that degrades the agent at scale (RSK-1);
   terse sections that reference detail rather than duplicate it.
3. **Runtime self-containment** — the agent must know its control flow without re-reading an
   845-line guide every turn.
4. **Legacy isolation** — inception additions must not entangle the legacy flow (NFR-4).
5. **Minimal drift surface** — fewer co-maintained authorities; the guide is already the
   content authority (DEC-2), so no third artifact should be introduced (RSK-5).
6. **Future reuse** (lowest) — GH-72 (inception:3) will reuse this sub-mode infrastructure for
   the legacy flow; a clean, parallel structure lowers that future cost.

## Mental Models & Techniques Used

- **First Principles** — what *must* live in the prompt? Operational control flow (the
  self-contained-agent principle). What *may* be referenced? Content detail (the guide is the
  authority). This split resolves the tension directly.
- **Separation of Concerns** — control flow (prompt) vs content (guide): two authorities with
  a clean boundary, each owned where it is strongest.
- **Inversion** — how would this fail? Bloat → instruction degradation; offloading control
  flow → runtime fragility + drift; interleaving with legacy → legacy regression. The chosen
  option inverts all three.
- **Reversibility / YAGNI** — do not split the agent or introduce a companion doc until a
  concrete need forces it; restructuring within one file is reversible.
- **Reference class** — ADR-0001 chose *modes-within-one-agent* over per-domain agents; the
  analogous choice here is *modes-within-one-prompt* over separate prompts/agents.
- **Second-Order Thinking** — a "referenced companion" (option b) appears lean but creates a
  third authority that must track both the guide and the prompt, eroding the drift discipline.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (constraint must be
`negotiable: yes`)

|       | C-1 (legacy parity) | C-2 (self-contained control flow) | C-3 (single agent) | C-4 (guide authority) |
|-------|:-------------------:|:---------------------------------:|:------------------:|:---------------------:|
| ALT-0 | ✅ | ✅ (vacuous) | ✅ | ✅ |
| ALT-1 | ✅ | ✅ | ✅ | ✅ |
| ALT-2 | ✅ | ❌ | ✅ | ✅ |
| ALT-3 | ✅ | ✅ | ❌ | ✅ |

### Alternative 0 — Do Nothing / Leave the structure undecided

- **Summary:** Do not decide the structure now; let `@toolsmith` improvise at delivery time.
- **Pros:** Zero upfront design cost.
- **Cons:** Blocks the implementation plan (the plan-writer cannot write phase tasks without
  knowing the target structure); risks an ad-hoc structure that entangles legacy or duplicates
  the guide.
- **Constraint compliance:** Passes vacuously (nothing changes) but fails the change's purpose.
- **Why rejected:** The structure choice is exactly what unblocks the plan; deferring it moves
  the decision into the agent prompt with no record, against the "prompt IS the product"
  priority.

### Alternative 1 — Nested sub-mode sections under `<mode_new_project_inception>` — RECOMMENDED

- **Summary:** Add a single `<mode_new_project_inception>` umbrella section containing eight
  terse `<phase_0_inception>` ... `<phase_7_inception>` sub-sections, **parallel to** (not
  inside) the existing legacy `<workflow_phases>` block. Each phase section carries only
  control flow: purpose, inputs, the anti-sycophancy step (per the spec's Appendix B map), the
  human gate, the state-update, the artifacts produced (per Appendix C), and a one-line
  reference to `doc/guides/project-inception.md` for content detail. A small `<mode_selection>`
  block (F-1) routes `new` vs `legacy`; `<resume_behavior>` and `<write_allowlist>` are extended
  additively.
- **Pros:** Control flow is inline and self-contained (C-2, driver 3); the file stays
  navigable and `@toolsmith`-friendly (drivers 1, 2); legacy is untouched (C-1, driver 4); no
  third authority is introduced (C-4, driver 5); the parallel sub-mode is directly reusable by
  GH-72 (driver 6); single file = single hand-off (C-3).
- **Cons:** The agent file grows (mitigated by terse sections + guide reference; RSK-1
  residual risk tracked). Inception and legacy now co-reside in one large file (mitigated by
  clear sub-mode boundaries).
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4.
- **Why chosen:** Satisfies every constraint and dominates on all six drivers. Matches the
  ticket hint ("use sub-mode sections"). Consistent with ADR-0001's modes-within-one-agent
  precedent, applied at the prompt level.

### Alternative 2 — Referenced companion structure (offload phase detail to a doc/guides companion)

- **Summary:** Keep the prompt lean by pointing it at a companion doc (e.g. a
  `doc/guides/inception-phases.md`) that holds the phase-by-phase detail the agent follows.
- **Pros:** Smaller agent file on disk.
- **Cons:** Either the companion holds **control flow** (the gate, the anti-sycophancy map,
  the state-update points) — in which case the agent is no longer self-contained and must
  re-read the companion every turn (violates C-2 and the self-contained-agent principle) — or
  it holds only **content detail**, in which case it is redundant with the guide (which DEC-2
  already designates the content authority) and becomes a *third* co-maintained authority that
  erodes the drift discipline (RSK-5). Either reading is dominated by ALT-1.
- **Constraint compliance:** Fails **C-2** under the offloading interpretation (control flow
  not inline). Passes C-1, C-3, C-4.
- **Why rejected:** If control flow stays inline, the companion is redundant with the guide; if
  it does not, the agent stops being self-contained. No principled placement of content in a
  companion that the guide does not already cover.

### Alternative 3 — Split `@bootstrapper` into two agents (e.g. `@bootstrapper` + `@inceptor`)

- **Summary:** Create a dedicated inception agent so each prompt stays small.
- **Pros:** Each agent file is smaller in isolation; clean separation by responsibility.
- **Cons:** Reverses the locked research-stage decision ("extend `@bootstrapper`, not a new
  agent") and the spec's In-Scope; contradicts ADR-0001's rejection of agent proliferation in
  favor of modes; adds routing/discovery cost (which agent does `/bootstrap` invoke?) and
  duplicated shared logic (state, gates, write allowlist). Requires sweeping
  `AGENTS.md`/`.opencode/README.md` and the generated plugin.
- **Constraint compliance:** Fails **C-3** (a second agent file is created). Passes C-1, C-2,
  C-4.
- **Why rejected:** A mode within one agent/prompt captures the separation without the
  proliferation cost; the prior decision is not reopened by a size concern that terse sections
  + guide reference already address.

## Decision

> **ADDENDUM (2026-06-27, supersedes the "parallel to legacy" framing):** After GH-71
> delivery, the human directed that the GH-32 6-phase legacy flow and its git-ignored state
> file (`.ai/local/bootstrapper-context.yaml`) be **eradicated** — the bootstrapper now has
> ONE process: the 8-phase inception workflow, with `project.flow: new | legacy` selecting
> front-half differences (legacy = a pre-ADOS long-lived project → extract/reconstruct; new =
> greenfield → author). Single committed state: `doc/inception/inception-state.yaml`. No
> backward-compat. Consequently the "parallel to `<workflow_phases>`" / two-tier legacy-parity
> machinery below is **historical** (it described the since-removed preservation approach).
> The inline-vs-referenced boundary and the self-contained-agent principle below **remain
> authoritative**. See change GH-71 pm-notes REM-9/REM-10.

**Adopt Alternative 1.** The inception sub-mode is organized as eight terse
`<phase_N_inception>` sections nested under one `<mode_new_project_inception>` umbrella,
**parallel to** the legacy `<workflow_phases>` block. Each phase section carries only
operational control flow (purpose, inputs, anti-sycophancy step per Appendix B, human gate,
state update, artifacts per Appendix C) and references `doc/guides/project-inception.md` for
content detail. A `<mode_selection>` block routes `new` vs `legacy`; `<resume_behavior>` and
`<write_allowlist>` are extended additively. The legacy flow is left untouched.

### Inline-vs-referenced boundary (clarification added during GH-71 red-team remediation, REM-3/RT1-06)

To keep the "control flow inline / content referenced" split operationally crisp (and prevent
`@toolsmith` from duplicating guide prose — NFR-3/NFR-5/RSK-5), the boundary is:

- **INLINE in each `<phase_N_inception>`:** phase name; the human-gate presence; the
  anti-sycophancy technique **NAME** carried via an `<anti_sycophancy>technique-name</anti_sycophancy>`
  sub-tag anchor; the artifact **KEYS** produced (by name/key only, e.g. `north_star`, `roadmap`,
  `assumptions`); the state-update point; a one-line guide reference.
- **REFERENCED (NOT duplicated):** the substantive content of each artifact; the full
  anti-sycophancy prompt text; the conditional-artifact details; the four-risk definitions.

Consequence for `<resume_behavior>` / `<write_allowlist>`: these shared blocks are *extended*
(additive inception entries), so legacy parity is asserted via **legacy-line-presence** (every
baseline legacy entry still present verbatim; additions permitted), NOT whole-block
byte-identity — see NFR-4 / the test plan's TC-STRUCT-003 two-tier method. The truly-frozen
legacy blocks (`<workflow_phases>`, `<persistent_state>`, `<phase_1..6_*>`) remain
byte-for-behavior identical.

Rationale, tied to drivers: the irreducible requirement is that the prompt hold its own
**control flow** (self-contained-agent principle; driver 3) while the guide owns **content**
(DEC-2; driver 5). Terse per-phase sections satisfy both — they keep the file navigable and
cheap for `@toolsmith` to edit (drivers 1, 2) without duplicating guide prose, and nesting them
under a single umbrella parallel to `<workflow_phases>` isolates legacy (C-1; driver 4) and
gives GH-72 a reusable sub-mode shape (driver 6). Alternatives either reverse a locked decision
(ALT-3), create a redundant/fragile third authority (ALT-2), or block the plan (ALT-0).

**Authority note.** The repo owner delegated resolution of GH-71's open questions to the
PM/`@decision-advisor`, so this **recommendation is actionable now** and unblocks the
implementation plan (the plan-writer may write phase tasks against this structure). As an R2
record it remains `status: Proposed` with `decision_date: null`; final acceptance is confirmed
by the human at the **GH-71 PR review** (the standard ADOS human gate), at which point status
moves to `Accepted`.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies **all** constraints:

- **C-1 (legacy parity):** The legacy `<workflow_phases>` block and its `<phase_1..6_*>`
  sections, state schema, and resume behavior are untouched; inception content is additive and
  isolated under a separate umbrella.
- **C-2 (self-contained control flow):** Every phase's control flow (gate, anti-sycophancy
  map, state update, artifacts) is inline in the prompt; only content detail is referenced from
  the guide (NFR-3); no guide prose is duplicated (NFR-5/AC17).
- **C-3 (single agent):** Exactly one agent file (`.opencode/agent/bootstrapper.md`) is
  modified; no new agent is created.
- **C-4 (guide authority):** The guide remains the single human-readable authority; the prompt
  references, not recreates, it.

No accepted-risk exceptions are recorded (no `negotiable: yes` constraint is violated).

## Trade-offs & Consequences

### Positive Outcomes

- A single, self-contained, navigable agent file that `@toolsmith` can extend in one hand-off.
- Legacy onboarding is provably untouched (clean diff boundary).
- No drift-prone third authority; the guide stays the sole content authority.
- A parallel sub-mode shape GH-72 can reuse for the legacy flow with minimal restructuring.
- Generated Claude-plugin counterpart regenerates cleanly from a single source.

### Negative Outcomes

- The agent file grows beyond its current 384 lines (residual RSK-1 risk, mitigated by terse
  sections + guide referencing; tracked in the test plan's manual verification matrix).
- Inception and legacy now co-reside in one large file; future editors must respect the
  sub-mode boundaries (documented in the agent and in `AGENTS.md` "Extending the system").

### Unresolved Questions

- [ ] Exact per-phase token budget and whether Phases 5-7 (the "shared back-half" in the guide)
      warrant shared sections vs new-flow-only sections — defer to the implementation plan /
      `@toolsmith`. Lean: keep the new-flow self-contained; treat shared back-half factoring as
      a GH-72 concern. (owner: @plan-writer / @toolsmith)
- [ ] Whether `<mode_selection>` should live inside `<mode_new_project_inception>` or as a
      top-level router — an `@toolsmith` placement detail, not a decision-level concern.
      (owner: @toolsmith)

## Implementation Plan

1. `@toolsmith` adds the `<mode_new_project_inception>` umbrella + eight terse
   `<phase_N_inception>` sections + a `<mode_selection>` router, and extends
   `<resume_behavior>` (inception state) and `<write_allowlist>` (`doc/inception/**`,
   `.ai/agent/code-review-instructions.md`). Legacy sections are not modified.
2. Each phase section references `doc/guides/project-inception.md` for content detail; no prose
   is copied.
3. Regenerate the Claude Code plugin counterpart via `scripts/build-claude-plugin.sh`; commit
   the `.opencode/` source and the regenerated `.ados-claude/` output together (multi-tool
   rule; RSK-7).
4. The change's test plan verifies legacy parity (structural check), all-eight-sections
   presence, the anti-sycophancy→phase map, and guide referencing (NFR-3/AC17).

Rollout is via the standard ADOS delivery process for GH-71. No migration is required.

## Verification Criteria

- **Metric:** Legacy section diff vs pre-change — Target: empty (behavior-equivalent) —
  Window: post-merge
- **Metric:** Inception phase sections present — Target: 8 of 8 (phases 0-7) — Window:
  post-merge
- **Metric:** Anti-sycophancy→phase mappings correct — Target: 5 of 5 (devil's advocate→1;
  pre-mortem→2&3; alt comparison→3; unknown-unknowns→4; four-risk→1/2/3) — Window: post-merge
- **Metric:** Guide-prose duplication in the prompt — Target: 0 (guide referenced, not
  recreated) — Window: post-merge
- **Metric:** Agent files created/modified under `.opencode/agent/` — Target: exactly 1
  modified, 0 created — Window: post-merge
- **Metric:** `.ados-claude/` plugin counterpart freshness — Target: CI-fresh — Window:
  ongoing
- **Metric:** `bootstrapper.md` line count — Target: warn > ~650, fail > ~800 (tunable via
  the prompt-structure test TC-INFRA-001; env `BOOTSTRAPPER_WARN_LINES`/`BOOTSTRAPPER_FAIL_LINES`)
  — Window: post-merge — turns RSK-1 from a post-hoc revisit-trigger into a measured guardrail.

## Confidence Rating

**High.** The decision is grounded in the project's own self-contained-agent principle, the
locked research-stage decision, NFR-3/NFR-4/NFR-5, and ADR-0001's precedent. The main
uncertainty — instruction-following at the larger prompt size (RSK-1) — is a measurable,
mitigated residual risk tracked in the test plan, not a structural unknown.

## Lessons Learned (Retrospective)

TODO: Populate after implementation and observation (notably whether the larger prompt
degrades instruction-following in practice — the RSK-1 residual).

## Examples & Usage (Optional)

Target shape (illustrative; `@toolsmith` finalizes wording):

```
<mode_selection>
  Determine mode: new (empty repo / greenfield) vs legacy (existing code/history).
  Ambiguous → ask. See guide Phase 0.
</mode_selection>

<mode_new_project_inception>
  Reference doc/guides/project-inception.md for content detail; do not duplicate its prose.

  <phase_0_inception> purpose; inputs; gate; state update; artifacts; guide ref </phase_0_inception>
  <phase_1_inception> ... 🔒 devil's advocate ... </phase_1_inception>
  ...
  <phase_7_inception> ... </phase_7_inception>
</mode_new_project_inception>

<workflow_phases> ... legacy, unchanged ... </workflow_phases>
```

## References

- **Change spec (OQ-1):** [doc/changes/2026-06/2026-06-26--GH-71--bootstrapper-new-project-inception-mode/chg-GH-71-spec.md](../changes/2026-06/2026-06-26--GH-71--bootstrapper-new-project-inception-mode/chg-GH-71-spec.md) (§8, §9, §14, §15)
- **Human authority guide:** [doc/guides/project-inception.md](../guides/project-inception.md)
- **Agent file being extended:** [.opencode/agent/bootstrapper.md](../../.opencode/agent/bootstrapper.md)
- **Project decision conventions:** [.ai/agent/decision-instructions.md](../../.ai/agent/decision-instructions.md) ("Self-contained agents" principle)
- **Repo rules:** [AGENTS.md](../../AGENTS.md) ("Extending the system", "Multi-tool support")
- **Related decision:** `ADR-0001` (modes-within-one-agent over per-domain agents)
- **Decision-Making Guide:** [doc/guides/decision-making.md](../guides/decision-making.md)
- **Record-artifact guide:** [doc/guides/decision-records-management.md](../guides/decision-records-management.md)
