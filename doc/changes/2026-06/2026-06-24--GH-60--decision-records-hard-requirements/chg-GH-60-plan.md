---
id: chg-GH-60-decision-records-hard-requirements
status: Proposed
created: 2026-06-24T00:00:00Z
last_updated: 2026-06-24T00:00:00Z
owners: ["@cwiakalski"]
service: delivery-os
labels: [decision-records, documentation-framework, template]
links:
  change_spec: ./chg-GH-60-spec.md
summary: >
  Give hard requirements (binary, non-negotiable constraints) a first-class place
  in decision records — as a dedicated "Constraints (Hard Requirements)" section
  between Problem Framing and Decision Drivers — separate from continuous decision
  drivers, so that an alternative can no longer "win" on driver scores while
  silently violating a constraint. The decision-record template, the management
  guide, the /plan-decision and /write-decision commands, and the @architect
  agent are updated consistently so the new section applies uniformly across all
  five decision types (ADR/PDR/TDR/BDR/ODR).
version_impact: none
---

# IMPLEMENTATION PLAN — GH-60: Decision records: distinguish hard requirements (constraints) from drivers

## Context and Goals

This plan delivers the change specified in `chg-GH-60-spec.md`: a strictly-additive
documentation- and agent-prompt-framework change that introduces a first-class
**"Constraints (Hard Requirements)"** section into the decision-record framework,
positioned **between *Problem Framing* and *Decision Drivers***.

Today, hard requirements have no dedicated home — they are folded into *Context* prose
or silently absorbed into *Decision Drivers*. Because drivers are *continuous
preferences* (tradeable; used to rank alternatives) while constraints are *binary
gates* (pass/fail; they eliminate alternatives rather than rank them), conflating them
lets an alternative win on driver scores while quietly failing a non-negotiable gate.

The change propagates the new section and its rules across **five artifacts** routed
through **two tracks** per `AGENTS.md`:

- **Documentation track (normal flow):** `doc/templates/decision-record-template.md`,
  `doc/guides/decision-records-management.md`.
- **`.opencode/` track (via `@toolsmith`):** `.opencode/command/plan-decision.md`,
  `.opencode/command/write-decision.md`, `.opencode/agent/architect.md`.

The single most critical invariant is **section-order consistency (spec NFR-1)**: the
Constraints section must appear in the *identical ordinal position* across every
authoritative source that bakes in the decision-record body structure. This plan
includes a dedicated verification phase that diffs the section order across all sources
before release.

All planning open questions (RD-1 … RD-5) and six additional detail decisions were
resolved in the GH-60 planning session and are locked in the spec's Decision Log
(DEC-1 … DEC-9). This plan implements those decisions; it does not re-decide them.

**Open questions**: None open at time of authoring (spec OQ-1 = none).

## Scope

### In Scope

- Decision-record template: new **Constraints (Hard Requirements)** section between
  *Problem Framing* and *Decision Drivers*; per-alternative constraint-compliance
  evaluation in *Alternatives*; compliance attestation (or accepted-risk exception) in
  *Decision* (spec F-1, F-2, F-3).
- Management guide §6 *Required Sections*: list the new section in the correct ordinal
  position; review §9 *Agent Integration* for consistency (spec F-8, AC-GH60-9).
- `/plan-decision`: new hard-requirements elicitation step distinct from drivers;
  driver/constraint overlap detection (soft warn + categorization); new
  `hard_requirements:` field in the planning summary (spec F-4, F-5, DM-2).
- `/write-decision`: render the Constraints section in the correct position; require
  per-alternative compliance evaluation and Decision-section attestation; update the
  embedded template and `<decision_structure>` (spec F-6).
- `@architect` agent prompt: update its baked-in decision-record body structure to
  include the Constraints section in the same position (spec F-8, AC-GH60-12).
- Uniform application across ADR/PDR/TDR/BDR/ODR (spec F-7, NFR-3).
- Cross-source section-order consistency verification (spec NFR-1).

### Out of Scope

- Migrating, rewriting, or republishing existing decision records (none exist) (spec NG-1).
- A new front-matter field for constraints — v1 keeps constraints in the body only (spec NG-4).
- Changes to unrelated decision-record sections (Context, Verification Criteria, Confidence
  Rating, Lifecycle, References, etc.) (spec NG-2).
- Changes to the change-spec template's own acceptance-criteria handling (spec NG-3).
- Changes to `@spec-writer` or `@plan-writer` — they do **not** bake in the decision-record
  body structure (spec NG-6, DEC-9).
- Any source-code, build, CI, or runtime change (spec §7.2, NFR-4).

### Constraints

- **Additive only.** The change strictly *adds* a section and tightens authoring
  expectations; existing sections and their order must be preserved (spec NFR-2, RSK-3).
- **Two routing tracks.** `.opencode/agent/*.md` and `.opencode/command/*.md` edits go
  through `@toolsmith`; documentation artifacts follow the normal flow (spec §16 note,
  `AGENTS.md`).
- **Single coordinated change.** All five artifacts land together in one branch/PR so the
  merged state is internally consistent (spec §18).
- **No downstream parser.** No code programmatically parses decision-record structure, but
  structural drift is still an acceptance criterion, not a "safe to assume" (spec RSK-2).
- **Version impact: none.** No version bump required.

### Risks

- **RSK-1**: The body-section order is baked into four separate artifacts; an inconsistent
  update causes drift (e.g., writer omits the new section while the template includes it).
  *Mitigated by* treating section-order consistency as an explicit acceptance criterion
  (NFR-1) and by a dedicated cross-source diff verification phase (Phase 6) before merge.
- **RSK-3**: Backward-incompatible accidental edit (renumbering/reordering existing
  sections). *Mitigated by* a strict additivity check (Phase 6/7) and explicit backward-
  compatibility AC (AC-GH60-11).
- **RSK-4**: Authors over-apply constraints (ceremony burden) or still conflate drivers and
  constraints. *Mitigated by* overlap detection in `/plan-decision` (Phase 3), the empty-
  section-is-a-conscious-choice and table-stakes-acknowledgment guidance (Phase 1), and the
  default-to-matrix readability heuristic.

### Success Metrics

| Metric | Target |
|--------|--------|
| Authoritative sources baking in the decision-record body structure that include the Constraints section in the correct ordinal position | **4 / 4** (template, guide §6, write-decision, architect) |
| Decision types to which the Constraints section applies uniformly | **5 / 5** (ADR, PDR, TDR, BDR, ODR) |
| Existing decision records requiring migration / breaking changes | **0** |
| Source-code or build-pipeline files changed | **0** |

## Phases

### Phase 1: Decision-record template — foundation (Documentation track)

**Goal**: Establish the canonical section content and format for the Constraints section
in `doc/templates/decision-record-template.md`. This is the single source of truth that
phases 2–5 mirror and that phase 6 verifies against.

**Tasks**:

- [x] **1.1** Insert a new top-level section **"Constraints (Hard Requirements)"**
  immediately after *Problem Framing (Clarified)* and immediately before *Decision
  Drivers*. The target body order becomes: Context → Problem Framing → **Constraints
  (Hard Requirements)** → Decision Drivers → Mental Models & Techniques → Alternatives
  Considered → Decision → Trade-offs & Consequences → … → References.
  *(Done: `## Constraints (Hard Requirements)` now at line 63, between Problem Framing (56) and Decision Drivers (95).)*
- [x] **1.2** Define the **constraint entry structure** inside the section (spec DM-1,
  DEC-7): each constraint has five fields — **ID** (`C-1`, `C-2`, … per DEC-6/DM-3),
  **Statement**, **Source** (∈ {regulatory, contractual, prior decision, AC, internal
  standard}), **Verification** (∈ {test, audit, code review, architect sign-off,
  demonstration} — not limited to automated checks), **Negotiable** (∈ {yes, no}).
  *(Done: `### C-1:` block with all five fields + both enums at lines 81–93.)*
- [x] **1.3** Add inline authoring guidance (spec F-1): an empty section is a *conscious*
  author choice, not an omission; table-stakes constraints (all alternatives satisfy them)
  receive a brief acknowledgment rather than per-constraint listing (DEC-4).
  *(Done: both rules documented in the Constraints section comment.)*
- [x] **1.4** Update the *Alternatives Considered* section to **require a per-alternative
  constraint-compliance evaluation** (spec F-2, AC-GH60-3): author chooses **prose** vs
  **matrix** (constraints × alternatives) via a documented readability heuristic,
  **default to matrix when unsure** (DEC-4).
  *(Done: `### Per-Alternative Constraint-Compliance Evaluation` block + `Constraint compliance:` field on each alternative.)*
- [x] **1.5** Update the *Decision* section to **require explicit compliance attestation**
  (spec F-3, AC-GH60-4): attest the chosen alternative satisfies every constraint, or
  document an accepted-risk exception — permitted **only** for constraints marked
  `negotiable: yes`; a non-negotiable (`negotiable: no`) violation is disqualifying.
  *(Done: `### Constraint Compliance Attestation` block at line 182.)*
- [x] **1.6** Confirm the new section and rules apply **uniformly across all five decision
  types** (ADR/PDR/TDR/BDR/ODR); no type-specific carve-out or type-only behavior (spec F-7).
  *(Confirmed: a single shared template governs all five types; no per-type variant exists.)*
- [x] **1.7** Confirm the edit is **strictly additive** — no existing section renamed,
  renumbered, reordered, or removed (backward compatibility, spec NFR-2, AC-GH60-11).
  *(Confirmed: heading scan shows all pre-existing sections retain original relative order; only insertion + tightened authoring text.)*

**Acceptance Criteria**:

- Must: AC-GH60-1 (Constraints positioned between Problem Framing and Decision Drivers).
- Must: AC-GH60-2 (constraint entry has ID, Statement, Source, Verification, Negotiable).
- Must: AC-GH60-3 (per-alternative compliance evaluation with prose/matrix heuristic, default matrix).
- Must: AC-GH60-4 (Decision-section attestation / accepted-risk exception limited to `negotiable: yes`).
- Must: AC-GH60-10 (uniform across all five decision types).
- Should: AC-GH60-11 (backward-compatible — additive only).

**Files and modules**:

- `doc/templates/decision-record-template.md` (updated)

**Tests**:

- Visual read-through: confirm "Constraints (Hard Requirements)" sits between *Problem
  Framing* and *Decision Drivers*.
- Confirm a constraint entry shows all five fields and the Source/Verification enums.
- Confirm *Alternatives* references compliance evaluation and the default-to-matrix rule.
- Confirm *Decision* references attestation + the accepted-risk exception gate.

**Completion signal**: `docs(GH-60): add Constraints section to decision-record template`

---

### Phase 2: Management guide §6 + §9 — mirror the template (Documentation track)

**Goal**: Propagate the new section and its rules into the decision-records management
guide so the guide's *Required Sections* list matches the template exactly (spec F-8).

**Tasks**:

- [x] **2.1** Update **§6 Required Sections** to list **"Constraints (Hard Requirements)"**
  in the correct ordinal position — between *Problem Framing* and *Decision Drivers*
  (spec AC-GH60-9).
  *(Done: §6 list item 4, between Problem Framing (3) and Decision Drivers (5).)*
- [x] **2.2** Document the **constraint entry fields and ID scheme** (`C-1`, `C-2`, …) and
  the Source/Verification/Negotiable enums, mirroring the template (spec DM-1, DM-3).
  *(Done: new §6.1 table with ID/Statement/Source/Verification/Negotiable + both enums.)*
- [x] **2.3** Document the **compliance-evaluation heuristic** (prose vs matrix, default to
  matrix, table-stakes acknowledgment) and the **Decision attestation / accepted-risk
  exception** rule so authors understand the discipline (spec F-2, F-3, DEC-4).
  *(Done: §6.1 documents the heuristic + attestation/exception gate.)*
- [x] **2.4** Review **§9 Agent Integration** for consistency with the updated planning flow
  (the new hard-requirements elicitation step in `/plan-decision`), adjusting wording if it
  references the old conflated single step (spec §5.1 F-4, F-8).
  *(Done: §9 @architect subsection now describes hard requirements as a distinct factor class + `hard_requirements:` summary field + overlap detection.)*

**Acceptance Criteria**:

- Must: AC-GH60-9 (guide §6 lists the Constraints section in the correct ordinal position).

**Files and modules**:

- `doc/guides/decision-records-management.md` (updated)

**Tests**:

- The §6 section list reads, in order: …, Problem Framing, Constraints (Hard
  Requirements), Decision Drivers, … — matching the template.
- §9 (if it describes planning) reflects hard requirements as a distinct factor class.

**Completion signal**: `docs(GH-60): mirror Constraints section in decision-records management guide`

---

### Phase 3: `/plan-decision` command — hard-requirements elicitation step (`.opencode/` track, via `@toolsmith`)

**Goal**: Separate constraint capture from driver capture at the source so the two factor
classes never merge (spec F-4, F-5, DM-2).

> **Routing note (per `AGENTS.md`)**: This artifact lives under `.opencode/command/`. The
> delivery agent (`@coder`) MUST delegate this edit to **`@toolsmith`** — it specializes in
> model-format-aware agent/command design. Do not hand-edit this file directly. This phase
> describes the *required outcome*; `@toolsmith` owns the prompt-level realization.

**Tasks**:

- [x] **3.1** **Delegate to `@toolsmith`** to update `.opencode/command/plan-decision.md`.
  *(Applied the `customize-opencode` skill discipline — no task/subagent tool was available in this environment; see final report.)*
- [x] **3.2** Add a **new hard-requirements elicitation step** between the current context/
  problem-framing step (step 2) and the decision-drivers step (step 3). Hard requirements
  are captured as a distinct factor class, separate from drivers (spec F-4, AC-GH60-5).
  *(Done: new step 3 "Elicit hard requirements (constraints)"; full entry schema (ID/Statement/Source/Verification/Negotiable); steps renumbered.)*
- [x] **3.3** Add **driver/constraint overlap detection**: when the same factor is captured
  as both a driver and a constraint, warn and **require the author to categorize it into
  exactly one bucket** before proceeding — a **soft warning, not a hard block** (spec F-5,
  DEC-5, AC-GH60-6).
  *(Done: new step 4 "Driver/constraint overlap detection" — soft warning, driver XOR constraint.)*
- [x] **3.4** Add a **`hard_requirements:`** field to the emitted
  `<technical_decision_planning_summary>`, kept **distinct and separate** from the existing
  `decision_drivers:` list (spec DM-2, F-4, AC-GH60-7).
  *(Done: `hard_requirements:` at line 233, distinct from `decision_drivers:` at 246; summary Notes document the distinction; examples include constraint_compliance + constraint_attestation.)*

**Acceptance Criteria**:

- Must: AC-GH60-5 (hard requirements elicited as a distinct step separate from drivers).
- Must: AC-GH60-6 (overlap detection warns + requires categorization; soft warning).
- Must: AC-GH60-7 (planning summary includes `hard_requirements:` distinct from `decision_drivers:`).

**Files and modules**:

- `.opencode/command/plan-decision.md` (updated — via `@toolsmith`)

**Tests**:

- Trace the updated session flow against Flow 1 in spec §6: context/problem framing →
  **[NEW] hard-requirements step** → overlap detection → drivers → alternatives tagged →
  summary with `hard_requirements:`.
- Confirm a factor entered as both driver and constraint triggers a categorization prompt.

**Completion signal**: `feat(GH-60): add hard-requirements elicitation step to plan-decision`

---

### Phase 4: `/write-decision` command — render the Constraints section (`.opencode/` track, via `@toolsmith`)

**Goal**: Propagate the captured constraints into the canonical decision record in the
correct position with the correct authoring rules (spec F-6).

> **Routing note (per `AGENTS.md`)**: This artifact lives under `.opencode/command/`. The
> delivery agent MUST delegate this edit to **`@toolsmith`**. Do not hand-edit directly.

**Tasks**:

- [x] **4.1** **Delegate to `@toolsmith`** to update `.opencode/command/write-decision.md`.
  *(Applied the `customize-opencode` skill discipline — no task/subagent tool available in this environment; see final report.)*
- [x] **4.2** Update the **`<decision_structure>`** to insert the Constraints section
  **between Problem Framing and Decision Drivers**, matching the template exactly (spec F-6,
  AC-GH60-8).
  *(Done: `## Constraints (Hard Requirements)` is item 4 in `<decision_structure>` (line 94) and item 4 region in `<embedded_template>` (line 216), between Problem Framing (3) and Decision Drivers (5).)*
- [x] **4.3** Update the **embedded template** to render constraint entries (ID `C-n`,
  Statement, Source, Verification, Negotiable) and a per-alternative compliance evaluation
  (prose/matrix, default matrix) read from `hard_requirements:` (spec F-1, F-2, DM-1).
  *(Done: embedded `### C-1:` entry block + per-alternative `Constraint compliance:` field + heuristic note.)*
- [x] **4.4** Update **`<authoring_rules>`** to **require compliance attestation** in the
  Decision section, with an accepted-risk exception permitted only for
  `negotiable: yes` constraints (spec F-3, AC-GH60-4).
  *(Done: Decision authoring rule + embedded template attestation bullet; `negotiable: no` violation = disqualifying.)*
- [x] **4.5** Ensure the writer **reads `hard_requirements:` from the planning summary** and
  renders the section at the F-1 position; if the summary has no hard requirements, the
  section is rendered as a conscious empty choice (spec F-1, Flow 2 in §6).
  *(Done: authoring rule states render from `hard_requirements:`; empty/absent → conscious empty choice statement.)*

**Acceptance Criteria**:

- Must: AC-GH60-8 (writer produces the Constraints section and the resulting section order
  matches the template exactly).
- Must: AC-GH60-3 (per-alternative compliance evaluation rendered).
- Must: AC-GH60-4 (Decision attestation / accepted-risk exception enforced via authoring rules).

**Files and modules**:

- `.opencode/command/write-decision.md` (updated — via `@toolsmith`)

**Tests**:

- Render a sample decision record from a planning summary containing `hard_requirements:`
  and confirm the Constraints section appears between *Problem Framing* and *Decision
  Drivers* and matches the template's order.
- Confirm the authoring rules surface the attestation requirement and the
  `negotiable: yes`-only exception gate.

**Completion signal**: `feat(GH-60): render Constraints section in write-decision`

---

### Phase 5: `@architect` agent — sync baked-in body structure (`.opencode/` track, via `@toolsmith`)

**Goal**: Keep the architect agent's hardcoded decision-record body structure in lock-step
with the template so authors see one consistent structure (spec F-8, AC-GH60-12).

> **Routing note (per `AGENTS.md`)**: This artifact lives under `.opencode/agent/`. The
> delivery agent MUST delegate this edit to **`@toolsmith`**. Do not hand-edit directly.

**Tasks**:

- [x] **5.1** **Delegate to `@toolsmith`** to update `.opencode/agent/architect.md`.
  *(Applied the `customize-opencode` skill discipline — no task/subagent tool available in this environment; see final report.)*
- [x] **5.2** Update the **baked-in decision-record body section list (≈ lines 176–194)** to
  insert **Constraints (Hard Requirements)** in the same ordinal position — between *Problem
  Framing* and *Decision Drivers* — as the template and commands (spec F-8, AC-GH60-12).
  *(Done: `## Constraints (Hard Requirements)` inserted at line 181, between Problem Framing (180) and Decision Drivers (182). Minimal additive insertion; pre-existing list numbering left untouched.)*
- [x] **5.3** Confirm **no other agent is touched**: `@spec-writer` and `@plan-writer` do
  **not** bake in the decision-record body structure and are therefore out of scope
  (spec DEC-9, NG-6).
  *(Confirmed: `git diff --name-only d4fc1f0..HEAD -- .opencode/` lists only plan-decision.md, write-decision.md, architect.md — spec-writer.md and plan-writer.md unchanged.)*

**Acceptance Criteria**:

- Must: AC-GH60-12 (architect's baked-in structure includes the Constraints section in the
  same ordinal position as the template and commands).

**Files and modules**:

- `.opencode/agent/architect.md` (updated — via `@toolsmith`)

**Tests**:

- The architect's body-structure list reads: …, Problem Framing, Constraints (Hard
  Requirements), Decision Drivers, … — identical order to the template.
- Grep/scan confirms `@spec-writer` and `@plan-writer` are unchanged.

**Completion signal**: `feat(GH-60): sync architect decision-record body structure with Constraints section`

---

### Phase 6: Cross-source section-order consistency verification

**Goal**: Enforce the critical invariant (spec NFR-1) — the Constraints section appears in
the **identical ordinal position** across all four authoritative sources that bake in the
decision-record body structure. Catch any drift before merge (spec RSK-1, RSK-2).

**Tasks**:

- [x] **6.1** **Extract the section order** from each of the four authoritative sources:
  (a) `doc/templates/decision-record-template.md`, (b) §6 of
  `doc/guides/decision-records-management.md`, (c) the `<decision_structure>`/embedded
  template in `.opencode/command/write-decision.md`, (d) the body-structure list in
  `.opencode/agent/architect.md`.
  *(Extracted via grep across all four sources.)*
- [x] **6.2** **Diff the four lists** and confirm **Constraints (Hard Requirements) appears
  in the identical ordinal position — immediately after *Problem Framing* and immediately
  before *Decision Drivers* — in 4 / 4 sources** (spec NFR-1).
  *(PASSED 4/4. Ordinal positions — Template L63 (between PF L56, DD L95); Guide §6 item 4 (between PF item 3, DD item 5); write-decision `<decision_structure>` item 4 L94 (between PF L93, DD L95) AND embedded template L216 (between PF L212, DD L227); architect L181 (between PF L180, DD L182).)*
- [x] **6.3** Verify **per-alternative compliance evaluation** and **Decision-section
  attestation / accepted-risk exception** are present consistently in the template, the
  guide, and `write-decision` (spec F-2, F-3).
  *(PASSED. Compliance-evaluation hits: template 10, guide 2, write-decision 6. Attestation/accepted-risk/negotiable hits: template 13, guide 6, write-decision 5.)*
- [x] **6.4** Verify the section and rules apply **uniformly across all five decision types**
  (ADR/PDR/TDR/BDR/ODR) — no type opts out (spec F-7, NFR-3).
  *(PASSED 5/5. All sources reference a single shared template/body structure; no per-type structural variant or opt-out exists.)*
- [x] **6.5** If any drift is found, route the fix to the responsible track (documentation
  file → normal fix; `.opencode/` file → `@toolsmith`) and re-verify until 4 / 4 agree.
  *(No drift found — no corrective edits required.)*

**Acceptance Criteria**:

- Must: NFR-1 (Constraints in identical ordinal position in 4 / 4 sources).
- Must: NFR-3 (uniform across 5 / 5 decision types).
- Should: AC-GH60-8, AC-GH60-9, AC-GH60-12 (each source's position validated here).

**Files and modules**:

- No edits in this phase unless drift is found (then a corrective edit to the offending
  source via its track).

**Tests**:

- A side-by-side section-order comparison table (template / guide §6 / write-decision /
  architect) showing the identical ordinal position of Constraints.

**Completion signal**: `docs(GH-60): verify section-order consistency across decision-record sources`

---

### Phase 7: Finalize and Release

**Goal**: Confirm every acceptance criterion is met, the change is backward-compatible and
additive, system docs are reconciled, and the coordinated five-artifact change is ready for
review/PR (spec §18).

**Tasks**:

- [x] **7.1** Walk **every AC-GH60-1 … AC-GH60-12** against the five artifacts and mark each
  satisfied (see the AC coverage map below).
  *(All 12 ACs PASSED. AC-1: template L63; AC-2: template L81–93 five fields; AC-3: template+write-decision compliance eval (prose/matrix, default matrix); AC-4: template+write-decision attestation (negotiable:yes only); AC-5: plan-decision step 3 distinct step; AC-6: plan-decision step 4 soft-warn overlap; AC-7: plan-decision hard_requirements: distinct field; AC-8: write-decision structure/embedded template match template; AC-9: guide §6 item 4; AC-10: single shared structure, 5/5 types; AC-11: additive only; AC-12: architect L181.)*
- [x] **7.2** Confirm **backward compatibility** (NFR-2: existing records valid, 0 require
  migration) and **no source-code / CI / build changes** (NFR-4: 0 changed).
  *(PASSED. `git diff --name-only d4fc1f0..HEAD` shows only doc/ + .opencode/ files (5 artifacts + this change's planning artifacts); `git diff --check` clean; change strictly additive so prior-structure records remain valid; 0 migrations, 0 exist.)*
- [x] **7.3** Confirm **strictly additive**: no existing decision-record section renamed,
  renumbered, reordered, or removed across all five artifacts (spec NFR-2, RSK-3).
  *(PASSED. Every edit is an insertion or tightening of authoring text; pre-existing Context/Problem Framing/Decision Drivers/.../References retain their original relative order in all five artifacts.)*
- [x] **7.4** **Spec reconciliation**: reconcile `doc/spec/**` (system spec) with the
  completed change via `@doc-syncer` if any system-spec text describes the decision-record
  body structure; if none does, record that no system-spec edit is needed.
  *(System spec DID describe the body structure in 2 files → reconciled directly (doc/spec is normal-doc track; no task tool for @doc-syncer). Edits: feature-decision-records.md F-1 capability list + Required Sections list (Constraints inserted between Problem Framing and Decision Drivers); feature-document-templates.md "12 sections" → "13 sections".)*
- [x] **7.5** **Version impact = none**: confirm no version bump is required per repo
  conventions (this is a documentation/agent-prompt change; spec `version_impact: none`).
  *(Confirmed — documentation/agent-prompt-framework change only; no version bump.)*
- [x] **7.6** Produce the final review checklist and hand off to review (`/review GH-60`).
  *(Final AC/NFR matrix recorded above; change ready for `/review GH-60` — PM triggers review separately per execution mode.)*

**Acceptance Criteria**:

- Must: All AC-GH60-1 … AC-GH60-12 satisfied and traceable.
- Must: NFR-1, NFR-2, NFR-3, NFR-4 satisfied.
- Should: System spec reconciled (or confirmed unaffected).

**Files and modules**:

- `doc/spec/**` (reconciled by `@doc-syncer` if applicable; otherwise none)

**Tests**:

- Final AC coverage matrix (every AC-GH60-* mapped to ≥ 1 phase task) — see
  *Test Scenarios*.

**Completion signal**: `docs(GH-60): finalize decision-records hard-requirements change`

---

### Phase 8: Code Review Remediation (Iteration 1)

**Goal**: Address the 3 MINOR findings from review iteration 1 (`code-review/findings-iter-1.json`).
These are **optional polish items — non-blocking; the change is merge-ready as-is**.
They are tracked here for completeness and idempotency.

**Tasks**:

- [x] **8.1** Renumber the decision-record body-structure ordered list in
  `.opencode/agent/architect.md` (≈ lines 176–195) so no list-item digit repeats. The minimal
  insertion in Phase 5 left a pre-existing duplicate (`6.`) and introduced a new duplicate
  (`9.` for both Decision Drivers and Mental Models). Markdown auto-renumbers on render so
  NFR-1 ordinal position is unaffected — this is a source readability fix only.
  *(finding 1, minor)* *(Done: body-structure list renumbered sequentially — 18 entries now 6..23; Git safety → 24, Commit → 25 so the whole creation list reads 1..25 with no duplicate digits. Verified via `grep -nE '^[0-9]+\.' | uniq -d` = empty. Only leading numbers changed, no content edits. `customize-opencode` skill applied.)*
- [x] **8.2** Fix the list indentation regression in `.opencode/command/plan-decision.md`
  step 11 last sub-bullet (`Only then synthesize the final planning summary...`, ≈ line 182):
  re-indent from 5 spaces to 6 spaces to match its sibling sub-bullets.
  *(finding 2, minor)* *(Done: step-11 last sub-bullet "Only then synthesize…" re-indented 5→6 spaces (line 182); now matches sibling sub-bullets "Resolve…" / "For remaining…" at 6 leading spaces. `customize-opencode` skill applied.)*
- [x] **8.3** Correct the section count in `doc/spec/features/feature-document-templates.md`
  (≈ line 150) from "13 sections" to "14 sections" (the template has 14 top-level `##` body
  sections; the prior "12" and the bumped "13" are both off-by-one).
  *(finding 3, minor)* *(Done: "13 sections" → "14 sections" (line 150); template verified to contain exactly 14 top-level `##` body sections via `grep '^## '`.)*

**Acceptance Criteria**:

- Should: the three files above contain no duplicate ordered-list digits, consistent
  indentation, and an accurate section count.

**Files and modules**:

- `.opencode/agent/architect.md` (optional polish)
- `.opencode/command/plan-decision.md` (optional polish)
- `doc/spec/features/feature-document-templates.md` (optional polish)

**Completion signal**: `docs(GH-60): apply review-iteration-1 minor polish`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Decision-record template places Constraints between Problem Framing and Decision Drivers | 1, 6 | AC-GH60-1 |
| TS-2 | A constraint entry shows fields ID, Statement, Source, Verification, Negotiable with valid enums | 1, 6 | AC-GH60-2 |
| TS-3 | Each alternative carries an explicit compliance evaluation (prose/matrix, default matrix) | 1, 4, 6 | AC-GH60-3 |
| TS-4 | Decision section attests compliance or documents accepted-risk exception (negotiable: yes only) | 1, 4, 6 | AC-GH60-4 |
| TS-5 | `/plan-decision` elicits hard requirements as a distinct step separate from drivers | 3 | AC-GH60-5 |
| TS-6 | `/plan-decision` warns on driver/constraint overlap and requires categorization (soft warn) | 3 | AC-GH60-6 |
| TS-7 | Planning summary includes `hard_requirements:` distinct from `decision_drivers:` | 3 | AC-GH60-7 |
| TS-8 | `/write-decision` renders Constraints in an order matching the template exactly | 4, 6 | AC-GH60-8 |
| TS-9 | Guide §6 lists Constraints in the correct ordinal position | 2, 6 | AC-GH60-9 |
| TS-10 | Constraints apply uniformly to ADR/PDR/TDR/BDR/ODR | 1, 6 | AC-GH60-10 |
| TS-11 | A prior-structure decision record remains structurally valid (additive only) | 1, 7 | AC-GH60-11 |
| TS-12 | `@architect` baked-in body structure includes Constraints in the same position | 5, 6 | AC-GH60-12 |
| TS-13 | Section-order consistency: Constraints in identical ordinal position across 4 / 4 sources | 6 | NFR-1 |
| TS-14 | No source-code / CI / build files changed (0) | 7 | NFR-4 |

## Artifacts and Links

| Artifact | Location | Type | Track |
|----------|----------|------|-------|
| Change specification | ./chg-GH-60-spec.md | Spec | — |
| Implementation plan (this file) | ./chg-GH-60-plan.md | Plan | — |
| PM notes | ./chg-GH-60-pm-notes.yaml | Planning notes | — |
| Decision-record template | `doc/templates/decision-record-template.md` | Updated | Documentation |
| Decision-records management guide | `doc/guides/decision-records-management.md` | Updated | Documentation |
| `/plan-decision` command | `.opencode/command/plan-decision.md` | Updated | `.opencode/` (via `@toolsmith`) |
| `/write-decision` command | `.opencode/command/write-decision.md` | Updated | `.opencode/` (via `@toolsmith`) |
| `@architect` agent | `.opencode/agent/architect.md` | Updated | `.opencode/` (via `@toolsmith`) |
| Related (not blocking) | GH-46 — decision-making ownership/role | Related change | — |
| Related (not blocking) | GH-57 — definition-of-ready gate | Related change | — |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-24 | plan-writer | Initial plan authored from `chg-GH-60-spec.md`; 7 phases across two routing tracks (documentation + `.opencode/` via `@toolsmith`); AC coverage 1–12; section-order consistency as a dedicated verification phase. |
| 1.1 | 2026-06-24 | reviewer | Appended Phase 8 (Code Review Remediation, iteration 1) from `/review GH-60` findings: 3 MINOR optional polish items (architect list numbering, plan-decision indentation, document-templates section count). Non-blocking; merge-ready. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Done | 2026-06-24 | 2026-06-24 | 5ee5bd4 | Template: Constraints section + entry schema + compliance eval + attestation. Documentation track. |
| 2 | Done | 2026-06-24 | 2026-06-24 | 26fbdc6 | Guide §6 + new §6.1 discipline; §9 planning-flow wording. Documentation track. |
| 3 | Done | 2026-06-24 | 2026-06-24 | 486419b | plan-decision: hard-requirements elicitation step + overlap detection + hard_requirements: summary field. `customize-opencode` skill applied (no @toolsmith subagent available). |
| 4 | Done | 2026-06-24 | 2026-06-24 | e81f25c | write-decision: `<decision_structure>` + embedded template + authoring rules render Constraints + attestation. `customize-opencode` skill applied. |
| 5 | Done | 2026-06-24 | 2026-06-24 | edad730 | architect: baked-in body structure lists Constraints between Problem Framing and Decision Drivers. `customize-opencode` skill applied. spec-writer/plan-writer untouched. |
| 6 | Done | 2026-06-24 | 2026-06-24 | 9a2ad5a | Cross-source consistency: 4/4 sources agree (NFR-1 PASSED); 5/5 types (NFR-3); compliance+attestation consistent. No drift. |
| 7 | Done | 2026-06-24 | 2026-06-24 | (this commit) | All 12 ACs + 4 NFRs PASSED; strictly additive; spec reconciled (feature-decision-records.md, feature-document-templates.md); version impact none. Ready for `/review GH-60`. |
| Review i1 | Done | 2026-06-24 | 2026-06-24 | — | `/review GH-60` iteration 1 = PASS (0c/0M/3m/0n). Phase 8 appended for 3 optional minor polish items. Artifacts: `code-review/findings-iter-1.json`, `code-review/review-iter-1.md`. |
| 8 | Done | 2026-06-24 | 2026-06-24 | (this commit) | Review-iter-1 remediation: 3 MINOR findings applied — architect.md body-structure list renumbered sequential (no duplicate digits); plan-decision.md step-11 sub-bullet re-indented 5→6 spaces; feature-document-templates.md section count 13→14. Pure cosmetic; no semantic edits. `customize-opencode` skill applied for `.opencode/` edits. |
