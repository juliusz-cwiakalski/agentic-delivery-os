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
  *(Done: `### Per-Alterative Constraint-Compliance Evaluation` block + `Constraint compliance:` field on each alternative.)*
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

- [ ] **3.1** **Delegate to `@toolsmith`** to update `.opencode/command/plan-decision.md`.
- [ ] **3.2** Add a **new hard-requirements elicitation step** between the current context/
  problem-framing step (step 2) and the decision-drivers step (step 3). Hard requirements
  are captured as a distinct factor class, separate from drivers (spec F-4, AC-GH60-5).
- [ ] **3.3** Add **driver/constraint overlap detection**: when the same factor is captured
  as both a driver and a constraint, warn and **require the author to categorize it into
  exactly one bucket** before proceeding — a **soft warning, not a hard block** (spec F-5,
  DEC-5, AC-GH60-6).
- [ ] **3.4** Add a **`hard_requirements:`** field to the emitted
  `<technical_decision_planning_summary>`, kept **distinct and separate** from the existing
  `decision_drivers:` list (spec DM-2, F-4, AC-GH60-7).

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

- [ ] **4.1** **Delegate to `@toolsmith`** to update `.opencode/command/write-decision.md`.
- [ ] **4.2** Update the **`<decision_structure>`** to insert the Constraints section
  **between Problem Framing and Decision Drivers**, matching the template exactly (spec F-6,
  AC-GH60-8).
- [ ] **4.3** Update the **embedded template** to render constraint entries (ID `C-n`,
  Statement, Source, Verification, Negotiable) and a per-alternative compliance evaluation
  (prose/matrix, default matrix) read from `hard_requirements:` (spec F-1, F-2, DM-1).
- [ ] **4.4** Update **`<authoring_rules>`** to **require compliance attestation** in the
  Decision section, with an accepted-risk exception permitted only for
  `negotiable: yes` constraints (spec F-3, AC-GH60-4).
- [ ] **4.5** Ensure the writer **reads `hard_requirements:` from the planning summary** and
  renders the section at the F-1 position; if the summary has no hard requirements, the
  section is rendered as a conscious empty choice (spec F-1, Flow 2 in §6).

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

- [ ] **5.1** **Delegate to `@toolsmith`** to update `.opencode/agent/architect.md`.
- [ ] **5.2** Update the **baked-in decision-record body section list (≈ lines 176–194)** to
  insert **Constraints (Hard Requirements)** in the same ordinal position — between *Problem
  Framing* and *Decision Drivers* — as the template and commands (spec F-8, AC-GH60-12).
- [ ] **5.3** Confirm **no other agent is touched**: `@spec-writer` and `@plan-writer` do
  **not** bake in the decision-record body structure and are therefore out of scope
  (spec DEC-9, NG-6).

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

- [ ] **6.1** **Extract the section order** from each of the four authoritative sources:
  (a) `doc/templates/decision-record-template.md`, (b) §6 of
  `doc/guides/decision-records-management.md`, (c) the `<decision_structure>`/embedded
  template in `.opencode/command/write-decision.md`, (d) the body-structure list in
  `.opencode/agent/architect.md`.
- [ ] **6.2** **Diff the four lists** and confirm **Constraints (Hard Requirements) appears
  in the identical ordinal position — immediately after *Problem Framing* and immediately
  before *Decision Drivers* — in 4 / 4 sources** (spec NFR-1).
- [ ] **6.3** Verify **per-alternative compliance evaluation** and **Decision-section
  attestation / accepted-risk exception** are present consistently in the template, the
  guide, and `write-decision` (spec F-2, F-3).
- [ ] **6.4** Verify the section and rules apply **uniformly across all five decision types**
  (ADR/PDR/TDR/BDR/ODR) — no type opts out (spec F-7, NFR-3).
- [ ] **6.5** If any drift is found, route the fix to the responsible track (documentation
  file → normal fix; `.opencode/` file → `@toolsmith`) and re-verify until 4 / 4 agree.

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

- [ ] **7.1** Walk **every AC-GH60-1 … AC-GH60-12** against the five artifacts and mark each
  satisfied (see the AC coverage map below).
- [ ] **7.2** Confirm **backward compatibility** (NFR-2: existing records valid, 0 require
  migration) and **no source-code / CI / build changes** (NFR-4: 0 changed).
- [ ] **7.3** Confirm **strictly additive**: no existing decision-record section renamed,
  renumbered, reordered, or removed across all five artifacts (spec NFR-2, RSK-3).
- [ ] **7.4** **Spec reconciliation**: reconcile `doc/spec/**` (system spec) with the
  completed change via `@doc-syncer` if any system-spec text describes the decision-record
  body structure; if none does, record that no system-spec edit is needed.
- [ ] **7.5** **Version impact = none**: confirm no version bump is required per repo
  conventions (this is a documentation/agent-prompt change; spec `version_impact: none`).
- [ ] **7.6** Produce the final review checklist and hand off to review (`/review GH-60`).

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

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Not started | — | — | — | — |
| 2 | Not started | — | — | — | — |
| 3 | Not started | — | — | — | Delegated to `@toolsmith` |
| 4 | Not started | — | — | — | Delegated to `@toolsmith` |
| 5 | Not started | — | — | — | Delegated to `@toolsmith` |
| 6 | Not started | — | — | — | Cross-source consistency verification |
| 7 | Not started | — | — | — | Finalize and release |
