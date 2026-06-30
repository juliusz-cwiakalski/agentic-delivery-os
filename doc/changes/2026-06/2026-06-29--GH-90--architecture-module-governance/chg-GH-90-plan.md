---
id: chg-GH-90-architecture-module-governance
status: Updated
created: 2026-06-29T21:22:53Z
last_updated: 2026-06-29T21:41:14Z
owners: ["Juliusz Ćwiąkalski"]
service: inception-templates
labels: ["inception", "templates", "architecture", "module-governance"]
links:
  change_spec: ./chg-GH-90-spec.md
  change_pm_notes: ./chg-GH-90-pm-notes.yaml
  change_test_plan: ./chg-GH-90-test-plan.md
summary: >
  Convert `doc/templates/architecture-overview-template.md` from an inventory (what
  modules exist) into governance (the rules that govern them) by adding one
  consolidated `## Module governance` section with five subsections — module-residence
  rules, dependency-direction/layering matrix, lightweight internal interface
  contracts, an optional feature→component ownership map, and module-boundary
  heuristics — each carrying a concrete, AI-actionable placeholder example. Align
  `doc/templates/repo-analysis-template.md`'s module/component map to the same
  governance dimensions via additive columns, and add a minimal reference to the
  new sections in `doc/guides/project-inception.md` Phase 3. Template + guide change
  only: no agent prompts, no bootstrapper workflow, no enforcement tooling, no
  formal decision record, no application code.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-90: Architecture overview module governance (residence, layering, contracts)

> **Scope class:** Documentation/template-only. The implementing agent (`@coder`) edits Markdown exclusively: two redistributable templates and one redistributable guide. No source code, no `.opencode/agent/**` or `.opencode/command/**` changes, no `.ados-claude/**`, no `scripts/**`, no `tools/**`. The `@toolsmith` rule does **not** apply (no agent definitions touched).
>
> **Branch:** `docs/GH-90/architecture-module-governance` (already created and checked out from `main`). Do **not** create or switch branches during this plan.
>
> **Commit policy:** Each phase is independently committable. `@committer` creates the Conventional Commits; the plan states the suggested commit message per phase. The plan-writer does not commit.
>
> **Authoritative source of truth:** `./chg-GH-90-spec.md` (capabilities F-1..F-7, ACs AC-F1-1..AC-F7-1 + AC-NFR1-1/NFR3-1/NFR4-1, data elements DM-1..DM-7, decisions DEC-1..DEC-6, content sketches in Appendix A and the repo-analysis column spec in Appendix C). This plan derives every task from that spec; it does not invent requirements.

## Context and Goals

The inception review (Axis 1) found the architecture overview template is an **inventory** — it records *what* modules exist but not the *rules that govern* them. For a human team that is tolerable; for an AI delivery team placing hundreds of changes it produces entropy: misplaced code, layering violations, and guessed mock/stub boundaries. Five gaps drive this change (M1–M5): no module-residence rules, no dependency-direction/layering matrix, no internal interface contracts, no feature→component ownership map, and no module-boundary heuristics.

This plan closes all five gaps by enriching `architecture-overview-template.md` with one consolidated `## Module governance` section (five subsections, F-1..F-5), each shipping a concrete AI-actionable placeholder example; by aligning `repo-analysis-template.md`'s module/component map to the same governance dimensions (F-6); and by adding a minimal Phase 3 reference (F-7). The core success criterion is **AI-actionability** (DEC-6, NFR-1): `@coder` can resolve where new code belongs and `@spec-writer`/`@test-plan-writer` can stub/mock the right boundary using concrete rules — not vague prose.

The plan is fully additive and backward-compatible (NFR-4): no pre-existing section header or column is removed or renamed, both templates retain `ados_distribution: redistributable` and their license header blocks, and the doc-distribution gate must stay green (NFR-3).

**Resolved open questions (LOCKED by PM — baked into tasks, not re-debated):**

- **OQ-2 (block organization):** ONE consolidated `## Module governance` section, placed in `architecture-overview-template.md` **after** the existing `## Components` table and **before** `## Data flow`. The five governance dimensions are H3 subsections of that single H2. Groups related governance; keeps the template navigable; co-locates governance with the inventory it governs (DEC-5).
- **OQ-1 (split-heuristic threshold):** the `> N responsibilities` trigger ships as a `<N>` placeholder with an example value in parentheses, so the project fills its own threshold.

**Locked design decisions (DEC-1..DEC-6):** no formal ADR/PDR (the layering matrix is *example scaffolding* for project-specific inception fills, not a precedent-setting ADOS decision — rationale is in spec Appendix B); lightweight contracts = boundary + signature + return/error shape only; ownership map is OPTIONAL/conditional; tiered layering (presentation → application → domain → infrastructure) is the DEFAULT EXAMPLE with an "adapt to your architecture" note.

**Constraints honored (from the spec, not re-litigated here):** no `.opencode/agent/**` or bootstrapper changes; no Phase 3 rewrite (minimal reference only); no enforcement tooling; no touch to the template feature spec's Core Components table (pre-existing inventory gap — deferred to `@doc-syncer` in the system_spec_update phase).

**Open questions:** none remain. (OQ-1 and OQ-2 are resolved above; both are non-blocking and flagged for red-team R1 confirmation only.)

## Scope

### In Scope

- **F-1..F-5** — `doc/templates/architecture-overview-template.md`: one consolidated `## Module governance` section (after `## Components`, before `## Data flow`) with five H3 subsections, each with a concrete AI-actionable placeholder example.
- **F-6** — `doc/templates/repo-analysis-template.md`: extend the `## Module / component map` table with three additive governance columns (residence hint, layering tier, interface-contract pointer); preserve the existing `Module | Responsibility` columns.
- **F-7** — `doc/guides/project-inception.md` Phase 3: minimal reference to the governance sections (no phase rewrite).
- Preserve `ados_distribution: redistributable` + license header blocks on both templates; keep the doc-distribution gate green.

### Out of Scope

- [OUT] A versioned contract registry / contract-versioning scheme (NG-1).
- [OUT] Enforcement tooling — dependency-cycle linters, import checkers, CI gates on layering (NG-2).
- [OUT] Any `.opencode/agent/**`, `.opencode/command/**`, `.ados-claude/**`, or bootstrapper-workflow change (NG-3). The `@toolsmith` rule does not apply.
- [OUT] Rewriting Phase 3 or any other inception phase (NG-4).
- [OUT] A formal ADR/PDR/TDR for the layering approach (NG-5).
- [OUT] Touching the template feature spec (`doc/spec/features/feature-document-templates.md`) Core Components table — a pre-existing inventory gap; `@doc-syncer` decides in the system_spec_update phase (likely no change: this change is template *content*, not template identity/purpose/agent-consumer).
- [OUT] License-header edits — headers are managed exclusively by `scripts/add-header-location.sh`; both templates already carry headers. No task adds, removes, or modifies a header line.
- [OUT] The testing-strategy rules file (`.ai/rules/testing-strategy.md` / GH-89 territory).

### Constraints

- **Docs-only.** No build/compile/lint/test of source code applies. No package version bump — per repo convention, documentation-only changes carry no semver bump; the template `last_updated` date is the version signal.
- **Purely additive (NFR-4).** No pre-existing section header or column may be removed or renamed.
- **Redistributable markers + headers are invariant (NFR-3).** `ados_distribution: redistributable` and the license header block on both templates must remain byte-for-byte intact (marker present, value unchanged). The gate (`scripts/.tests/test-doc-distribution.sh`) scans `doc/templates/**/*.md` for marker presence + validity and must exit 0.
- **Branch is fixed.** All work lands on `docs/GH-90/architecture-module-governance`. Do not branch or switch.
- **Appendix A is the content design; Appendix C is the repo-analysis column spec.** The plan embeds those sketches verbatim as the target content so `@coder` has concrete, unambiguous targets.
- **Test plan is authored** (`chg-GH-90-test-plan.md` exists — 12 TCs, all 10 ACs traced). Its TC IDs map 1:1 onto the spec ACs; the traceability is reflected in the Definition of Done table and the Test Scenarios table.

### Risks

- **RSK-1: Template bloat.** The architecture-overview template is lean (~62 lines); five new subsections could over-weight it for small repos. *Mitigated by:* each subsection is a table + 1–2-line rule + one concrete example; the ownership map is explicitly OPTIONAL; the section intro preserves the existing "omit if trivial" tone.
- **RSK-2: Vague governance fails the AI-actionability bar.** Easy to write prose that reads well but is not actionable. *Mitigated by:* NFR-1 mandates ≥1 concrete example per subsection; the three canonical examples ship verbatim (residence "new API endpoint → `src/api/`"; layering "API layer may import domain; domain may NOT import API"; contract "cart → inventory `checkAvailability(sku, qty) → AvailabilityResult`"); Phase 6 cross-checks all 5/5.
- **RSK-3: Drift between architecture-overview and repo-analysis governance fields** if one template is edited without the other. *Mitigated by:* shared field names (DM-6 maps concept-for-concept to DM-1/2/3); Phase 2 uses the exact same dimension labels; the consistency contract is recorded in spec §22.
- **RSK-4: Consistency touch-points (README one-liner, handbook row) missed.** *Mitigated by:* Phase 4 is a dedicated verify/update sweep; the handbook row is confirmed to carry no purpose text (verify-only, no change).
- **RSK-5: Reviewer reads the layering tier example as a mandated ADOS architecture.** *Mitigated by:* the matrix subsection carries an explicit "example — adapt to your architecture" note (DEC-4).

### Success Metrics

| Metric | Target |
|--------|--------|
| Governance subsections present in `architecture-overview-template.md` | 5/5 (residence, layering, contracts, ownership-map, heuristics) |
| Governance subsections with ≥1 concrete AI-actionable placeholder example | 5/5 |
| `repo-analysis-template.md` module-map columns shared with architecture-overview governance fields | All three new dimensions mapped concept-for-concept (residence hint, layering tier, interface-contract pointer) |
| `project-inception.md` Phase 3 references to governance facets | ≥1 (in activity 4) |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 |
| Pre-existing template sections/columns removed or renamed | 0 (purely additive) |

## Phases

> Every phase lists the exact file, the exact section/heading names, and (where content is authored) the verbatim target content from spec Appendix A/C. Tasks must NOT touch license header lines (lines 1–4 of each template) or the `ados_distribution:` marker line.

### Phase 1: Author the consolidated `## Module governance` section in `architecture-overview-template.md`

**Goal**: Convert the architecture overview from inventory to governance — add one consolidated `## Module governance` H2 block (five H3 subsections, F-1..F-5), each with a concrete AI-actionable placeholder example, placed immediately after the `## Components` table and before `## Data flow`.

**Tasks**:

- [x] **1.1** In `doc/templates/architecture-overview-template.md`, insert one new `## Module governance` H2 section **between the end of the `## Components` table (currently the second `| <component name> | <container> | <what it does> |` row) and the `## Data flow` heading** (i.e., between current lines 36 and 37). Do **not** alter the `## Components` heading, its `_…_` intro line, its table header (`| Component | Container | Responsibility |`), or its rows; do **not** alter `## Data flow`. The block is a pure insertion.
- [x] **1.2** Under `## Module governance`, write the section intro line (italic, matching the template's existing `_…_` convention): a one-liner stating these are the rules that govern the modules above (placement, dependencies, boundaries) so an AI delivery team can decide where new code belongs and what to mock, and that any subsection may be omitted if trivial for a small repo (RSK-1 mitigation).
- [x] **1.3** **F-1 — `### Module-residence rules`:** an italic one-line purpose, then the **component-scoped** capability-type → owning-module/path-pattern table, then the one-line rule linking residence to the Components table. Target content (spec Appendix A.1, example rows — component-scoped per R1/F-2):

  ```markdown
  ### Module-residence rules
  _Where each capability type of code should live (resolve capability-type → owning module/path, instead of guessing)._
  <!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
  | Capability type | Owning module / path pattern | Notes |
  |---|---|---|
  | new API endpoint | `src/<component>/api/` | HTTP entrypoints |
  | new domain rule | `src/<component>/domain/<context>/` | business logic |
  | new CLI command | `src/<component>/cli/commands/` | user-invoked |
  | <capability type> | `src/<component>/<...>` | <notes> |
  Rule: place new code by capability type, not by guess; if a capability type is unlisted, add a row before placing the code. Residence rules are scoped per component named in the Components table above. (Single-component repo: omit the `<component>/` segment — e.g. `src/api/`.)
  ```

- [x] **1.4** **F-2 — `### Dependency-direction / layering matrix`:** an italic one-line purpose, the "example — adapt to your architecture" note (DEC-4 / RSK-5), the tier list, the **matrix-authoritative invariant**, the allowed/forbidden matrix, and the concrete example. Target content (spec Appendix A.2, R1/F-4 invariant phrasing + clean cells):

  ```markdown
  ### Dependency-direction / layering matrix
  _Which modules may depend on which. Example tiers — adapt to your architecture._
  Tiers (example): presentation → application → domain → infrastructure.
  Invariant: no dependency may point upward or sideways across tiers; the matrix below specifies which downward dependencies are permitted.
  <!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
  | From \ To | presentation | application | domain | infrastructure |
  |---|---|---|---|---|
  | presentation | — | ✓ | ✗ | ✗ |
  | application | ✗ | — | ✓ | ✓ |
  | domain | ✗ | ✗ | — | ✗ |
  | infrastructure | ✗ | ✗ | ✗ | — |
  | <your tier> | <...> | <...> | <...> | <...> |
  Example: "API layer may import domain layer; domain layer may NOT import API layer."
  ```

- [x] **1.5** **F-3 — `### Internal interface contracts`:** an italic one-line purpose, the named-boundary contract table, and the scope note. Target content (spec Appendix A.3, with replace-me marking per R1/F-3):

  ```markdown
  ### Internal interface contracts
  _Lightweight contracts for what crosses each module boundary (signature + return/error shape — not a versioned registry)._
  <!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
  | Boundary (A → B) | Operation | Signature | Returns | Errors |
  |---|---|---|---|---|
  | cart → inventory | checkAvailability | `checkAvailability(sku, qty)` | `AvailabilityResult{ available: bool, onHand: int }` | `ItemNotFound` |
  | <A → B> | <operation> | `<signature>` | <returns> | <errors> |
  Scope: signature + return/error shape only.
  ```

- [x] **1.6** **F-4 — `### Feature → component ownership map (OPTIONAL)`:** an italic one-line purpose that clearly marks it OPTIONAL/conditional (DEC-3) and instructs omission for small repos where the Components table suffices, then the feature → owning-component(s) table. Target content (spec Appendix A.4, with replace-me marking per R1/F-3):

  ```markdown
  ### Feature → component ownership map (OPTIONAL)
  _One-hop lookup from a feature to its owning component(s). Omit for small repos where the Components table above suffices._
  <!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
  | Feature | Owning component(s) |
  |---|---|
  | Checkout | cart, inventory, pricing |
  | <feature> | <component(s)> |
  ```

- [x] **1.7** **F-5 — `### Module-boundary heuristics`:** an italic one-line purpose, then the cohesion/coupling trigger bullets. The `> N responsibilities` trigger MUST use the `<N>` placeholder with an example value in parentheses (OQ-1 resolution). Target content (spec Appendix A.5, verbatim):

  ```markdown
  ### Module-boundary heuristics
  _Cohesion/coupling triggers for when to split or merge modules._
  - A module with **> `<N>` responsibilities** (example threshold: 3) **/ > 1 reason to change → split** by responsibility.
  - Two modules that **always change together → consider merging**.
  - High cohesion within a module; low coupling across modules.
  - A dependency mocked in **> 1 unrelated test → consider an interface boundary**.
  ```

- [x] **1.8** Update the template frontmatter `last_updated:` from `2026-06-26` to `2026-06-29` (the only frontmatter change). Do **not** touch the license header lines (1–4), the `ados_distribution: redistributable` line, or any other frontmatter key (`id`, `status`, `created`, `owners`, `area`, `document_classification`, `links`, `summary`).

**Acceptance Criteria**:

- Must: AC-F1-1 (residence rules table + one-line rule + concrete example "new API endpoint → `src/api/`"); AC-F2-1 (allowed/forbidden matrix between named layers + downward-only no-cycles invariant + concrete example "API layer may import domain; domain may NOT import API"); AC-F3-1 (lightweight named-boundary contracts: boundary + signature + return/error shape, concrete example cart→inventory `checkAvailability(sku, qty) → AvailabilityResult`); AC-F4-1 (OPTIONAL/conditional feature→component map, clearly marked); AC-F5-1 (concrete split/merge triggers, e.g. ">N responsibilities / >1 reason to change → split"); AC-NFR1-1 (5/5 subsections each carry ≥1 concrete AI-actionable example).
- Should: the section reads as governance co-located with the Components inventory it governs; subsection order is residence → layering → contracts → ownership → heuristics (DEC-5).

**Files and modules**:

- Code areas: none.
- System docs: `doc/templates/architecture-overview-template.md` (updated — one section inserted + `last_updated` bumped). Reconciliation of `doc/spec/features/feature-document-templates.md` is deferred to `@doc-syncer` (out of scope here).

**Tests**:

- Structural: the file still contains `## Components` immediately before `## Module governance`, and `## Module governance` immediately before `## Data flow` (`grep -n -E "^## (Components|Module governance|Data flow)" doc/templates/architecture-overview-template.md` shows the three in order).
- Marker/header invariant: license header lines 1–4 and `ados_distribution: redistributable` are unchanged (verified by diff in Phase 6).
- Example presence: each of the five H3 subsections contains its canonical example string (residence `src/api/`; layering `may NOT import API`; contracts `checkAvailability(sku, qty)`; ownership `Checkout`; heuristics `consider merging`).

**Completion signal**: `docs(gh-90): add module-governance section to architecture-overview-template`

---

### Phase 2: Align `repo-analysis-template.md` module map with the governance dimensions (F-6)

**Goal**: Make legacy reconstruction populate the same governance fields as the greenfield architecture overview, by extending the `## Module / component map` table with three additive columns while preserving the existing `Module | Responsibility` columns.

**Tasks**:

- [x] **2.1** In `doc/templates/repo-analysis-template.md`, locate the `## Module / component map` section (heading at current line 37; table header `| Module | Responsibility |` at current line 39). Extend the table **in place** to the five-column form from spec Appendix C. Preserve the existing `Module` and `Responsibility` columns and the two existing `<module path>` placeholder rows; append `Residence hint`, `Layering tier`, and `Interface-contract pointer`. Target content (spec Appendix C, additive — the three new columns map concept-for-concept to DM-1/2/3):

  ```markdown
  | Module | Responsibility | Residence hint | Layering tier | Interface-contract pointer |
  |---|---|---|---|---|
  | <module path> | <what it owns> | <residence rule / path pattern> | <presentation / application / domain / infrastructure / n-a> | <boundary→boundary operation, or n-a> |
  | <module path> | <what it owns> | <residence hint> | <layering tier> | <contract pointer> |
  These columns correspond to the Module governance section of the architecture overview (residence rules / layering matrix / interface contracts); populate the same concepts during legacy reconstruction.
  ```

  The new column labels map concept-for-concept to the architecture-overview Module governance section (RSK-3 drift mitigation): `Residence hint` ↔ F-1 residence; `Layering tier` ↔ F-2 tiers; `Interface-contract pointer` ↔ F-3 contracts.

- [x] **2.2** (Optional consistency) If the `## Module / component map` italic intro line exists, leave it as-is; do not add prose. If helpful, append a short clause to the existing intro noting the three new columns map concept-for-concept to the architecture-overview governance fields and are populated at the template's existing confidence discipline. Keep it to one clause; do not restructure the section.
- [x] **2.3** Update the template frontmatter `last_updated:` from `2026-06-26` to `2026-06-29` (the only frontmatter change). Do **not** touch the license header lines (1–4), the `ados_distribution: redistributable` line, `id: REPO-ANALYSIS`, or any other frontmatter key.

**Acceptance Criteria**:

- Must: AC-F6-1 (the module/component map columns align with the architecture-overview governance dimensions — adds a residence hint, a layering tier, and an interface-contract pointer — while preserving the existing `Module | Responsibility` columns); AC-NFR4-1 (the existing columns are not removed or renamed).
- Should: the three new column headers map concept-for-concept to the architecture-overview Module governance dimensions (residence rules / layering matrix / interface contracts) — same concepts, not a word-for-word header mirror; the cross-reference note records the correspondence so the two templates share one governance vocabulary.

**Files and modules**:

- Code areas: none.
- System docs: `doc/templates/repo-analysis-template.md` (updated — three columns added to one table + `last_updated` bumped).

**Tests**:

- Structural: the table header line reads `| Module | Responsibility | Residence hint | Layering tier | Interface-contract pointer |` (`grep -n "Interface-contract pointer" doc/templates/repo-analysis-template.md`).
- Additive check: `| Module | Responsibility |` substring is still present in the same table (verified by diff in Phase 6).
- Marker/header invariant: license header + `ados_distribution: redistributable` unchanged.

**Completion signal**: `docs(gh-90): align repo-analysis module map with governance dimensions`

---

### Phase 3: Minimal Phase 3 governance reference in `project-inception.md` (F-7)

**Goal**: Direct inception authors to fill the governance sections — without rewriting Phase 3.

**Tasks**:

- [x] **3.1** In `doc/guides/project-inception.md`, Phase 3 ("Tech stack & architecture"), activity 4 (current line 522), make a **minimal, surgical amendment** to the existing parenthetical so it names the governance facets alongside the existing inventory facets. Do **not** rewrite the activity, the phase, or any other activity. Replace exactly:

  ```text
  4. Draft the architecture overview using `doc/templates/architecture-overview-template.md` (C4 context + container diagrams, components, data flow, external dependencies, deployment topology, key decisions, and uncertainty flags).
  ```

  with:

  ```text
  4. Draft the architecture overview using `doc/templates/architecture-overview-template.md` (C4 context + container diagrams, components, module governance — residence rules, dependency-direction/layering, internal interface contracts, optional feature→component ownership, boundary heuristics — data flow, external dependencies, deployment topology, key decisions, and uncertainty flags).
  ```

- [x] **3.2** Do **not** alter the Phase 3 output line (current line 545) unless step 3.1 alone is judged insufficient — it is sufficient for AC-F7-1. If touched at all, keep the change to appending nothing more than a pointer to the governance sections; no new output artifact is introduced. Preserve the guide's license header and `ados_distribution: redistributable` marker (guide has both).

**Acceptance Criteria**:

- Must: AC-F7-1 (Phase 3 references the new governance sections — residence/layering/contracts/ownership/heuristics — in the architecture activity, without rewriting the phase).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/project-inception.md` (updated — one clause inserted into activity 4).

**Tests**:

- Structural: activity 4 contains `module governance` and at least one governance facet token (`grep -n -E "module governance|residence|layering|interface contract|heuristics" doc/guides/project-inception.md` within the Phase 3 region).
- No-rewrite check: Phase 3 still opens with `### Phase 3 — Tech stack & architecture` and retains all 9 activities and the existing human-gate/outputs structure.

**Completion signal**: `docs(gh-90): reference module governance in inception Phase 3`

---

### Phase 4: Consistency sweep (verify / update only — RSK-4)

**Goal**: Keep the template catalog discoverability in sync with the enriched content. These are consistency hygiene touch-points, **not** acceptance criteria.

**Tasks**:

- [x] **4.1** In `doc/templates/README.md` (line 62), update the architecture-overview one-liner **if** it currently omits module governance (it does — confirmed at plan time → update), so the catalog entry mirrors the template's enriched scope and readers discover the governance content. Replace exactly:

  ```text
  | `architecture-overview-template.md` | High-level architecture (C4 context/container, component map, key flows) |
  ```

  with:

  ```text
  | `architecture-overview-template.md` | High-level architecture (C4 context/container, component map, key flows, module governance) |
  ```

  Preserve the README's license header and frontmatter; the README carries no `ados_distribution` marker (it is not a `doc/` doc) — do **not** add one.
- [x] **4.2** **Handbook — verify only (no change expected).** Inspect `doc/documentation-handbook.md`: §17 "Appendix: Template Index" (current line 711) is a bare path bullet list (no purpose text); the §18 "Inception Artifact Catalog" row for Architecture overview (current line 774) is `| Architecture overview | `architecture-overview-template.md` |` with **no purpose-text column**. Because neither location carries a one-line purpose that describes the template, **no edit is required** — record this as an explicit finding and make no change. If, contrary to expectation, a descriptive purpose string is found, update it to mention module governance; otherwise leave the handbook untouched. Do not invent new rows or columns.

**Acceptance Criteria**:

- Must: none (this phase satisfies no spec AC — it is RSK-4 hygiene).
- Should: README line 62 mentions "module governance"; handbook verified and left unchanged (documented finding).

**Files and modules**:

- Code areas: none.
- System docs: `doc/templates/README.md` (updated — one one-liner). `doc/documentation-handbook.md` (verified, no change).

**Tests**:

- Structural: `grep -n "module governance" doc/templates/README.md` returns line 62.
- Handbook no-op confirmation: §17/§18 architecture-overview entries are byte-identical to their pre-change state (diff in Phase 6).

**Completion signal**: `docs(gh-90): consistency sweep for module-governance references`

---

### Phase 5: Doc-distribution gate verification (NFR-3)

**Goal**: Prove both modified templates still satisfy the redistributable-marker / install-set invariants enforced by CI.

**Tasks**:

- [x] **5.1** Run the gate (exact command):

  ```bash
  bash scripts/.tests/test-doc-distribution.sh
  ```

  **Expected: exit 0** (prints `(guard-doc-distribution)[OK] no drift …`). The gate scans `doc/templates/**/*.md` for marker presence + valid enum value (modes 1 & 2) and reconciles the marker-derived install set against a sandbox install (modes 3–5). Because both templates retain `ados_distribution: redistributable` and templates are installed wholesale, the expected result is green.
- [x] **5.2** If the gate exits non-zero, **remediate before proceeding** (do not skip): read the `::error::` annotation, confirm which mode fired, and restore any marker/header drift introduced in Phases 1–4 (most likely an accidentally edited `ados_distribution:` line or frontmatter `---` block). Re-run until exit 0. Do **not** disable or modify the gate script.
- [x] **5.3** (Optional, non-blocking) Confirm no other repo test script regressed as a side effect of the doc edits — this is a docs-only change, so no script should be affected.

**Acceptance Criteria**:

- Must: AC-NFR3-1 (`bash scripts/.tests/test-doc-distribution.sh` exits 0 AND both templates retain `ados_distribution: redistributable` + the license header block).

**Files and modules**:

- Code areas: none.
- System docs: none modified by this phase (verification only; remediation, if any, reverts drift introduced earlier).

**Tests**:

- The gate run **is** the test. Capture the exit code and the `[OK]` line in the execution log.

**Completion signal**: no commit (verification phase) — unless remediation reverted an earlier phase's drift, in which case amend that phase's commit. Record the gate result (exit 0) in the Execution Log.

---

### Phase 6: Finalize and Release — additive-diff self-check + Definition of Done

**Goal**: Prove the change is purely additive (NFR-4), confirm all 10 acceptance criteria are satisfied, and hand spec reconciliation to `@doc-syncer`.

**Tasks**:

- [x] **6.1** Additive-diff self-check. Diff every changed file against `origin/main` and assert additions-only:

  ```bash
  git diff --stat origin/main -- doc/templates/architecture-overview-template.md doc/templates/repo-analysis-template.md doc/guides/project-inception.md doc/templates/README.md doc/documentation-handbook.md
  ```

  Assert: no `-`-prefixed line removes or renames a pre-existing section header or column. In particular confirm **intact**: `## System context (C4 L1)`, `## Container diagram (C4 L2)`, `## Components`, `## Data flow`, `## External dependencies and integrations`, `## Deployment topology`, `## Key architectural decisions`, `## Known constraints and uncertainty flags` (architecture-overview); `## Module / component map` and the `| Module | Responsibility |` columns (repo-analysis); the Phase 3 heading and its 9 activities (inception guide). The only permitted `-` lines are the single replaced one-liners in Phase 1 (`last_updated` value), Phase 2 (`last_updated` value + the table-header/row line that gains columns), Phase 3 (activity 4 line), and Phase 4 (README line 62) — each of which is an in-place replacement that preserves the prior content's intent.
- [x] **6.2** Run the **Definition of Done — AC cross-check** (table below) and mark all 10 ACs satisfied. The test plan (`chg-GH-90-test-plan.md`) already exists; its TC IDs map 1:1 onto these ACs and are recorded in the table's "Test plan TCs" column (traceability is live, not pending).
- [x] **6.3** Red-team **R1 (pre-delivery)** is the user-chosen validation gate for the AI-actionability quality bar (per spec §18 / pm-notes). If R1 is run before delivery, incorporate its findings here or in a remediation phase; if it surfaces a genuine architecture decision, escalate to `@decision-advisor` (DEC-1 escape hatch). Red-team **R2 (post-delivery)** verifies the shipped templates.
- [x] **6.4** Version bump per repo conventions: docs-only — no package/semver bump. The template `last_updated` dates were bumped in Phases 1 and 2 (the version signal for templates). No further version action.
- [x] **6.5** Spec reconciliation hand-off: the template feature spec (`doc/spec/features/feature-document-templates.md`) Core Components table is a pre-existing inventory gap, explicitly **out of scope** for this change. `@doc-syncer` (system_spec_update phase) decides whether to enumerate architecture-overview/repo-analysis governance there — likely no change, since this change is template *content*, not template identity/purpose/agent-consumer. Record this hand-off; do not edit the feature spec here.

**Acceptance Criteria**:

- Must: AC-NFR4-1 (all pre-existing section headers and the module-map's `Module | Responsibility` columns remain; additions only). DoD: all 10 ACs in the table below satisfied.

**Files and modules**:

- Code areas: none.
- System docs: none modified by this phase (verification + hand-off only).

**Tests**:

- The `git diff` additive assertion (6.1) and the DoD table (6.2) are the tests.

**Completion signal**: `docs(gh-90): finalize module-governance templates (DoD)` — or fold into the preceding phase commits if no separate change is made (this phase is primarily verification).

---

## Test Scenarios

> The test plan (`chg-GH-90-test-plan.md`) is authored — 12 TCs tracing all 10 spec ACs. The scenarios below map 1:1 onto those ACs (and TCs); the authoritative AC↔TC matrix lives in the Definition of Done table below. Structural probes are runnable with `grep`/`git diff`; the AI-actionability and OPTIONAL/conditional judgments are manual (human + red-team R1/R2).

| ID | Scenario | Phases | AC | Method |
|----|----------|--------|----|--------|
| TS-1 | A reader finds module-residence rules: a capability-type → owning-module/path table + one-line rule + concrete example (`new API endpoint → src/api/`) | 1 | AC-F1-1 | `grep` structural + manual |
| TS-2 | A reader finds a dependency-direction/layering section: allowed/forbidden matrix + downward-only no-cycles invariant + example ("API may import domain; domain may NOT import API") | 1 | AC-F2-1 | `grep` structural + manual |
| TS-3 | A reader finds lightweight internal interface contracts: boundary + signature + return/error shape + cart→inventory example | 1 | AC-F3-1 | `grep` structural + manual |
| TS-4 | A reader finds an OPTIONAL/conditional feature→component ownership map, clearly marked | 1 | AC-F4-1 | manual |
| TS-5 | A reader finds concrete split/merge heuristics (">N responsibilities / >1 reason to change → split"; "always change together → consider merging") | 1 | AC-F5-1 | `grep` structural + manual |
| TS-6 | The repo-analysis module map gains residence-hint, layering-tier, and interface-contract-pointer columns while keeping `Module \| Responsibility` | 2 | AC-F6-1 | `grep` structural |
| TS-7 | `project-inception.md` Phase 3 references the governance facets without rewriting the phase | 3 | AC-F7-1 | `grep` structural + manual |
| TS-8 | Each of the 5 governance subsections carries ≥1 concrete AI-actionable example (5/5) | 1 | AC-NFR1-1 | manual (red-team R1) |
| TS-9 | `bash scripts/.tests/test-doc-distribution.sh` exits 0; both templates keep `ados_distribution: redistributable` + license header | 5 | AC-NFR3-1 | automated (gate) |
| TS-10 | Diff vs origin/main is purely additive — no pre-existing header/column removed or renamed | 6 | AC-NFR4-1 | `git diff` |

## Definition of Done — AC cross-check

| AC ID | Description (canonical, from spec §17) | Delivered in | Test plan TCs | Status |
|-------|----------------------------------------|--------------|---------------|--------|
| AC-F1-1 | Module-residence rules: capability-type → owning-module/path table + one-line rule + concrete example | Phase 1 (1.3) | TC-GOV-001, TC-GOV-006, TC-AIACT-001 | ☑ |
| AC-F2-1 | Dependency-direction/layering: allowed/forbidden matrix + downward-only no-cycles invariant + concrete example | Phase 1 (1.4) | TC-GOV-002, TC-GOV-006, TC-AIACT-001 | ☑ |
| AC-F3-1 | Internal interface contracts: boundary + signature + return/error shape + concrete example | Phase 1 (1.5) | TC-GOV-003, TC-GOV-006, TC-AIACT-001 | ☑ |
| AC-F4-1 | OPTIONAL/conditional feature→component ownership map, clearly marked | Phase 1 (1.6) | TC-GOV-004, TC-GOV-006, TC-AIACT-001 | ☑ |
| AC-F5-1 | Module-boundary heuristics: concrete split/merge triggers | Phase 1 (1.7) | TC-GOV-005, TC-GOV-006, TC-AIACT-001 | ☑ |
| AC-F6-1 | repo-analysis module map aligns governance dimensions; preserves `Module \| Responsibility` | Phase 2 (2.1) | TC-ALGN-001, TC-COMPAT-001 | ☑ |
| AC-F7-1 | project-inception Phase 3 references governance sections; no phase rewrite | Phase 3 (3.1) | TC-INC-001 | ☑ |
| AC-NFR1-1 | 5/5 governance subsections each carry ≥1 concrete AI-actionable example | Phase 1 (1.3–1.7) | TC-AIACT-001 (+ TC-GOV-001..005) | ☑ |
| AC-NFR3-1 | `bash scripts/.tests/test-doc-distribution.sh` exits 0; both templates keep marker + header | Phase 5 (5.1) | TC-DIST-001 | ☑ |
| AC-NFR4-1 | Purely additive — no pre-existing header/column removed or renamed | Phase 2 + Phase 6 (6.1) | TC-COMPAT-001 (+ TC-ALGN-001) | ☑ |

**Coverage: 10 / 10 ACs fully traced.** No orphan AC, no orphan phase.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-90-spec.md` | Spec (authoritative) |
| Implementation plan | `./chg-GH-90-plan.md` | Plan (this file) |
| PM notes | `./chg-GH-90-pm-notes.yaml` | Orchestration notes |
| Test plan | `./chg-GH-90-test-plan.md` | Test plan (authored — 12 TCs, all 10 ACs traced) |
| Parent epic | GitHub `#73` (ADOS project inception effectiveness) | Epic |
| Sibling / dependency | GH-69 (inception catalog/templates — delivered, created both templates) | Dependency |
| Sibling / dependency | GH-71 (bootstrapper unified workflow — delivered, Phase 3 consumers in place) | Dependency |
| Sibling | GH-72 (tribal-knowledge — frontmatter discipline + confidence column mirrored) | Structural sibling |
| Layering rationale | spec Appendix B (no separate ADR — DEC-1) | Design rationale |
| Governance content design | spec Appendix A | Content sketches |
| repo-analysis column spec | spec Appendix C | Column spec |
| Doc-distribution gate | `scripts/.tests/test-doc-distribution.sh` | CI quality gate |
| Inception review findings | `.ai/local/inception/review-2026-06-29-findings.md` (Axis 1 — M1–M5) | Source of gaps |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-29 | `@plan-writer` | Initial plan. Six phases; 10/10 ACs traced. PM-locked decisions baked in: consolidated `## Module governance` block after `## Components` / before `## Data flow` (OQ-2); `<N>` split-threshold placeholder with example value (OQ-1); ownership map OPTIONAL; tiered layering is the default example with an adapt note; no formal ADR (DEC-1). Appendix A/C content embedded verbatim as target content. |
| 1.1 | 2026-06-29 | `@plan-writer` | R1 remediation (PM-decided, surgical). F-1 (Major): Phase 2 alignment wording "word-for-word" → concept-for-concept; cross-reference note added to the repo-analysis fenced target. F-2 (Major): Phase 1 residence rows → component-scoped (`src/<component>/…`) + one-line rule linking residence to the Components table + single-component simplification note (omit `<component>/` → `src/api/`). F-3 (Major): replace-me HTML comment + ≥1 `<...>` placeholder row added to all four governance tables (residence, layering matrix, contracts, ownership map). F-4 (Minor): layering invariant rephrased (matrix authoritative; no upward/sideways deps), moved above the matrix; DIP cells cleaned (no bare "via ports"/"abstractions only"). F-6 (Minor): removed every stale "test plan pending / does-not-exist" annotation; DoD table gains a "Test plan TCs" column (TC-GOV-001..006, TC-ALGN-001, TC-INC-001, TC-AIACT-001, TC-DIST-001, TC-COMPAT-001) mapping 1:1 to the 10 ACs; frontmatter `change_test_plan` link added. F-7 (Minor): Phase 4 README one-liner reconciled to the spec's conditional framing with a one-line rationale. All six phases, completion signals, the gate command (`bash scripts/.tests/test-doc-distribution.sh`, exit 0), and the additive-diff self-check (Phase 6) preserved; AC coverage still 10/10. OQ-1/OQ-2 remain LOCKED. |

## Execution Log

<!-- Populated during execution by @coder / @committer / @runner. -->

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — Module governance section | ☑ | 2026-06-29 | 2026-06-29 | 8dd53cb | |
| 2 — repo-analysis alignment | ☑ | 2026-06-29 | 2026-06-29 | 4d7c562 | |
| 3 — inception Phase 3 reference | ☑ | 2026-06-29 | 2026-06-29 | e2950eb | |
| 4 — consistency sweep | ☑ | 2026-06-29 | 2026-06-29 | ede739a | |
| 5 — doc-distribution gate | ☑ | 2026-06-29 | 2026-06-29 | — | verification only — gate exit 0 / additive-diff PASS |
| 6 — finalize / DoD | ☑ | 2026-06-29 | 2026-06-29 | — | verification only — gate exit 0 / additive-diff PASS |

2026-06-29 — all 6 phases executed by @coder (commits 8dd53cb, 4d7c562, e2950eb, ede739a). Phase 5 gate exit 0; Phase 6 additive-diff PASS.
