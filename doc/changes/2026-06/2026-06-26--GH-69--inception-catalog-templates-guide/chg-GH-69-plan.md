---
id: chg-GH-69-inception-catalog-templates-guide
status: Proposed
created: 2026-06-26T00:00:00Z
last_updated: 2026-06-26T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: documentation
labels: [inception, docs, templates, guide]
links:
  change_spec: ./chg-GH-69-spec.md
  pm_notes: ./chg-GH-69-pm-notes.yaml
summary: >
  Deliver the documentation, templates, and process foundation for ADOS project
  inception (epic GH-73, slice inception:1). Centerpiece: doc/guides/project-inception.md —
  a redistributable, human-executable 8-phase process guide with four embedded Mermaid
  diagrams. Around it: 17 new templates (engineering, product discovery, UX, risk/assumption),
  an enriched north-star template, a restructured operational doc/overview/README.md, a
  committed doc/inception/ workspace skeleton, and handbook/templates-index discoverability.
  No agent prompts change; no code changes. After GH-69 a human can run inception manually
  using only committed, redistributable artifacts.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-69: Inception artifact catalog, templates, and complete process guide

## Context and Goals

This plan turns the GH-69 change spec into a phased, reviewable execution sequence for
`@coder`. The spec (source of truth: `./chg-GH-69-spec.md`) defines **8 functional
capabilities (F-1..F-8)**, **17 new templates**, **1 centerpiece guide**, a **workspace
skeleton**, **3 edited docs**, and a hard **marker-driven distribution gate**. There is no
code, no CI logic, and no agent-prompt change — this is a documentation/templates/guide
change only (spec §4.2 NG-5/NG-6).

**Why this is hard (and how the plan de-risks it):** ~23 files in one change invite review
fatigue, merge conflicts, and dropped deliverables (RSK-1). The plan therefore splits work
into **10 logical commits**, each a single content area (NFR-8: no phase exceeds ~12 files),
each with its own acceptance criteria and a per-phase self-verify step. The two
recurring mechanical risks — missing/misplaced `ados_distribution` markers (RSK-4) and ghost
cross-references (RSK-2) — are guarded by a dedicated final phase that runs the repo's
distribution guard (`scripts/.tests/test-doc-distribution.sh`) and a no-ghost-references
cross-check.

**The guide is the hardest single artifact (F-1).** It must be self-contained (DEC-7): a
reader who never saw the gitignored research notes under `.ai/local/inception/` must be able
to run inception end-to-end. The guide therefore **embeds** the research content (it does
not link into `.ai/local/*`). All source material the coder needs is summarized in the
Content Sourcing Map below.

### How to read the marker/header rules (critical — encode in every content phase)

| Artifact location | Scanned by distribution guard? | Needs `ados_distribution`? | Gets license header? |
|---|---|---|---|
| `doc/templates/**/*.{md,yaml}` | YES (recursive) | YES — `redistributable` | `.md`: YES (header script). `.yaml`: NO (script ignores yaml) |
| `doc/guides/project-inception.md` | YES (top-level `*.md`) | YES — `redistributable` | YES (header script) |
| `doc/documentation-handbook.md` | YES (standalone) | already `redistributable` | already present |
| `doc/inception/**/*.md` | NO | NO (outside DM-2 set) | YES (header script, per user instruction) |
| `doc/overview/README.md` | NO | NO (outside DM-2 set) | already present |

**Authoring contract for every NEW `.md` template/guide:** write the frontmatter starting
with `ados_distribution: redistributable` followed by `id`/`status`/`owners`/`summary`
(mirror `north-star-template.md` / `persona-template.md`). This "starts with
`ados_distribution`" describes the **authoring order** — before `add-header-location.sh`
prepends the copyright/MIT/source lines; after the header script runs, frontmatter begins with
`# Copyright…`. Do **NOT** hand-write the copyright/MIT/source lines — then run
`scripts/add-header-location.sh <dir>`, which prepends those three lines into the existing
frontmatter block. The guard skips `^#` lines, so the marker is still detected after the header
is inserted. (Per AGENTS.md + DEC-6: agents never hand-add headers.)

**Authoring contract for the NEW `.yaml` template (`inception-state-template.yaml`):**
`ados_distribution: redistributable` must be **line 1, top-level, no `---` block**
(per ODR-0001; a `---` block would break `yaml.safe_load()` consumers and the guard's
column-0 anchoring). The header script does not touch `.yaml`, so write line 1 directly.
Mirror `content-calendar-template.yaml` / `product-roadmap-register-template.yaml`.

### Content Sourcing Map (what to pull from where)

The gitignored authoritative sources are read-only inputs. Embed their content; never link
to them.

| Guide/Template content | Source: `full-inception-bootstrap-process.md` § | Source: `inception-process-diagrams.md` |
|---|---|---|
| Philosophy + two-track model | §1 | Diagram 4 (two-track convergence) |
| Artifact catalog (always + conditional) | §2.1, §2.2 | — |
| User-provided inputs split | §2.3 | — |
| 8-phase process (each: Activities / Anti-sycophancy / Human gate / Outputs+template) | §3 (Phases 0–7) | — |
| Legacy-vs-new differences (Phases 0–4) | §4 table | Diagram 3 (new vs legacy) |
| Conditional-artifacts matrix (5 columns) | §5 | — |
| Anti-sycophancy per phase + concrete prompt text | §6 | — |
| `inception-state.yaml` schema + resume behavior | §7 | Diagram 1 (master flow), Diagram 2 (Phase 0) |
| Out-of-scope table | §9 | — |
| 10 design principles | §10 | — |
| 4 Mermaid diagrams (embed verbatim) | — | Diagrams 1, 2, 3, 4 |

Per-template section lists are derived from (a) the §2 catalog description of that artifact,
(b) the phase that produces it (§3), and (c) existing template front-matter style. They are
spelled out in each phase below.

### Open questions

None at planning time (spec §14). If a content/structural decision surfaces during delivery,
route it to `@decision-advisor` and record under the spec §15 decision log, then append a
revision-log entry here.

---

## Scope

### In Scope

- **F-1 / F-2**: Create `doc/guides/project-inception.md` — redistributable, self-contained,
  4 embedded Mermaid diagrams, 8-phase (0–7) process, artifact catalog, conditional matrix,
  anti-sycophancy, state schema, workspace guidance, out-of-scope, design principles.
- **F-3**: Create `doc/inception/` workspace skeleton — `README.md`, `inputs/README.md`,
  `meetings/README.md`, `analysis/README.md` (READMEs only; no live instances — DEC-1/DEC-8).
- **F-4**: Restructure `doc/overview/README.md` into an operational file set with
  Recommended/Conditional/Optional classification (README only; no content files — DEC-4).
- **F-5**: Create 17 new templates under `doc/templates/` (Engineering 9, Product discovery 3,
  UX 3, Risk/assumption 2).
- **F-6**: Enrich `doc/templates/north-star-template.md` additively (DEC: preserve structure).
- **F-7 / F-8**: Update `doc/documentation-handbook.md` (catalog + matrix + workspace section
  + forward-pointer) and `doc/templates/README.md` ("Inception templates" category).
- **Compliance**: `ados_distribution: redistributable` on every new distributable doc;
  license headers via `scripts/add-header-location.sh`; doc-distribution guard exits 0.

### Out of Scope

- [OUT] `@bootstrapper` phased workflow / agent automation (GH-71 — NG-1).
- [OUT] Legacy deepening — repo ingestion, behavioral-spec extraction, tribal-knowledge
  graduation (GH-72 / GH-33 — NG-2).
- [OUT] Layered planning sessions (GH-68 — NG-3).
- [OUT] Self-hosting ADOS / authoring ADOS's own overview content (GH-70 — NG-4).
- [OUT] Agent prompt changes, code, CI logic, tooling behavior (NG-5/NG-6).
- [OUT] Live overview content files (`01-north-star.md`, …) and live
  `inception-state.yaml` / `inception-summary.md` instances (NG-7 — those are per-project
  outputs when a project runs inception).

### Constraints

- **C-1**: This is a docs/templates/guide change only — no code, no agent prompts, no CI
  workflow logic (spec §7.2).
- **C-2**: `ados_distribution` placement follows ODR-0001: `.md` → inside first frontmatter
  block; `.yaml` → top-level line-1 key (no `---`).
- **C-3**: License headers added only via `scripts/add-header-location.sh`; agents never
  hand-add headers (AGENTS.md, DEC-6). The script processes `.md` (and bash), **not `.yaml`**.
- **C-4**: The guide must be self-contained — zero references to `.ai/local/inception/*`
  anywhere in new docs (DEC-7, NFR-4).
- **C-5**: Templates are shared/redistributable; instances live in per-project workspaces —
  `doc/inception/` holds READMEs only, templates ship under `doc/templates/` (DEC-1/DEC-8).
- **C-6**: Each phase is one logical commit (~3–8 files) to keep reviews tractable (NFR-8).

### Risks

- **RSK-1**: Large change (~23 files) → review fatigue, merge conflicts, dropped deliverables.
  *Mitigated by* 10 phased commits, per-phase AC + self-verify (NFR-8); DoD coverage table
  proves no AC is dropped.
- **RSK-2**: Ghost references — guide/handbook/overview/templates README cite a non-existent
  template/section. *Mitigated by* AC-NFR-5a + Phase 10 ghost-reference cross-check +
  self-verify in every content phase.
- **RSK-3**: Drift between guide content (sourced from research) and templates/handbook.
  *Mitigated by* single source of the catalog = the guide; handbook mirrors the matrix;
  templates README mirrors the template list; Content Sourcing Map keeps one mapping.
- **RSK-4**: Distribution-guard failure from a missing/misplaced marker (esp. the `.yaml`
  top-level rule). *Mitigated by* C-2/C-3 authoring contract, per-phase marker self-verify,
  and Phase 10 running the guard before merge.
- **RSK-5**: Overlap between new `persona-jtbd-template.md` and existing
  `persona-template.md` + `jobs-to-be-done-template.md`. *Mitigated by* DEC-2 — the new
  template explicitly states the relationship; templates README clarifies both categories.
- **RSK-6**: Scope creep into GH-71/72. *Mitigated by* explicit non-goals; this change ships
  the `inception-state-template.yaml` template, not its agent wiring.

### Success Metrics

| Metric | Target |
|--------|--------|
| New templates created | 17 (9 + 3 + 3 + 2) |
| Embedded Mermaid diagrams in the guide | 4 |
| Ghost cross-references in new docs | 0 |
| References from new docs to `.ai/local/inception/*` | 0 |
| `ados_distribution` markers on new distributable docs | 100% present + enum-valid |
| `bash scripts/.tests/test-doc-distribution.sh` exit code | 0 |
| Phases keeping any single review ≤ ~12 files | 10/10 |

---

## Phases

> **Recurring per-phase mechanics (do not repeat full text in each phase):**
> 1. Author files **without** hand-written copyright/MIT/source headers.
> 2. For NEW `.md` in `doc/templates/**` or `doc/guides/`, frontmatter starts with
>    `ados_distribution: redistributable` then `id`/`status`/`owners`/`summary` (authoring
>    order — before `add-header-location.sh` prepends the copyright/MIT/source lines; after
>    the header script runs, frontmatter begins with `# Copyright…`).
> 3. Run `scripts/add-header-location.sh <dir>` to insert the 3-line header (`.md` only).
> 4. Self-verify (marker present + header present + no `.ai/local/*` refs + no ghost refs).
> 5. Commit that phase with its completion-signal message.

---

### Phase 1: `doc/inception/` workspace skeleton

**Goal**: Establish the committed inception workspace as READMEs only (F-3, DEC-1, DEC-8) —
the home the guide (Phase 8) will describe.

**Tasks**:

- [x] **1.1** Create `doc/inception/README.md` — workspace purpose, full structure (inputs/,
  meetings/, analysis/), lifecycle (staged at Phase 0, populated through Phase 7, retained as
  the project's inception record), and the explicit note that `inception-state.yaml` and
  `inception-summary.md` are **templates** under `doc/templates/` instantiated only when a
  project runs inception (no live instances in this repo).
- [x] **1.2** Create `doc/inception/inputs/README.md` — what goes here: user-provided
  materials (mirror research §2.3 input-type table: strategy docs, user research,
  competitive analysis, existing docs, meeting notes, prototypes, technical docs, business
  model). State these are NOT agent-produced; scanned in Phase 0.
- [x] **1.3** Create `doc/inception/meetings/README.md` — inception meeting notes (kickoff,
  stakeholder interviews, gate reviews); link to `doc/templates/meeting-notes-template.md`.
- [x] **1.4** Create `doc/inception/analysis/README.md` — agent intermediate analysis only:
  `material-inventory.md`, `assumptions.md`, `risks.md`, `repo-analysis.md`,
  `tribal-knowledge.md` (legacy). Note these are produced during inception, not committed
  templates.
- [x] **1.5** Run `scripts/add-header-location.sh doc/inception` (these `.md` are outside the
  DM-2 guard set → no marker required, but headers are added per repo convention).

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F3-1 — workspace contains exactly the 4 READMEs and no live
  `inception-state.yaml`/`inception-summary.md`.
- Should: each README cross-links to the guide (Phase 8) once it exists — leave a clearly
  marked placeholder link `doc/guides/project-inception.md` (it will resolve after Phase 8;
  the Phase 10 ghost-check tolerates the link because the file is created in this change).

**Files and modules**:

- `doc/inception/README.md` (new)
- `doc/inception/inputs/README.md` (new)
- `doc/inception/meetings/README.md` (new)
- `doc/inception/analysis/README.md` (new)

**Tests**:

- `ls doc/inception` shows the 4 READMEs and no `.yaml`/`-summary.md`.
- Each new file carries the copyright/MIT/source header; grep confirms no `ados_distribution`
  needed (outside scan set).

**Completion signal**: `docs(GH-69): add doc/inception workspace skeleton`

---

### Phase 2: Engineering templates (9)

**Goal**: Create the 9 engineering templates under `doc/templates/` (F-5, AC-F5-1) including
the rich `roadmap-engineering-template.md` (DEC-3, AC-F5-5) and the
`inception-state-template.yaml` (DM-1, DEC-8).

**Tasks**:

- [x] **2.1** `architecture-overview-template.md` — id `ARCHITECTURE-OVERVIEW`. Sections:
  System context (C4 L1), Container diagram (C4 L2 / mermaid), Components, Data flow, External
  dependencies/integrations, Deployment topology, Key architectural decisions (link to ADRs),
  Known constraints & uncertainty flags. *(source: research §2.1 row "Architecture overview",
  §3 Phase 3.)*
- [x] **2.2** `tech-stack-template.md` — id `TECH-STACK`. Sections: Languages & runtimes,
  Frameworks & libraries, Datastores, Infrastructure & DevOps tooling, Observability stack,
  Rationale (why each), Alternatives considered (trade-off table), Upgrade/compatibility notes.
  *(source: §2.1 "Tech stack", §3 Phase 3; aligns with the Full-Stack Environment audit
  attributes in §3 Phase 3 step 5.)*
- [x] **2.3** `glossary-template.md` — id `GLOSSARY`. Sections: Terms table
  (term/acronym | definition | category | related UL term), Acronyms, See-also pointer to
  `ubiquitous-language.md`. Keep the handbook §9 glossary-vs-UL distinction (glossary =
  reader-friendly, broad, descriptive).
- [x] **2.4** `roadmap-engineering-template.md` — id `ROADMAP-ENGINEERING`. **NEW, distinct
  from the business `product-roadmap-template.md` (DEC-3).** Sections: Completed Milestones,
  **Current Milestone** (first-class; detailed scope: deliverables, IN/OUT, **success metrics
  per milestone = outcomes not outputs**, dependencies, **validation approach**, **OST /
  discovery linkage** — a row/section linking each milestone's outcomes to the Opportunity
  Solution Tree when discovery has been done), Future Milestones (rough), Links to
  changes/ADRs. *(source: §3 Phase 2, §8 GH-69 enrichment note. AC-F5-5 requires success metrics
  per milestone + a validation approach + OST/discovery linkage.)*
- [x] **2.5** `ubiquitous-language-template.md` — id `UBIQUITOUS-LANGUAGE`. Sections: Bounded
  context scope, Terms table (term | meaning | type [aggregate/entity/value object/domain
  event] | relationships), Context map (links to other bounded contexts), Binding rules.
  *(source: §2.2 "Ubiquitous language", handbook §9 UL definition.)*
- [x] **2.6** `repo-analysis-template.md` — id `REPO-ANALYSIS`. Sections: Repo structure
  (tree), Detected tech stack, Entry points, Module/component map, Data flow, External
  dependencies, Tech debt / known issues, **Confidence flags** (areas of uncertainty for human
  confirmation). *(source: §2.2 "Repo analysis", §4 legacy front-half; the confidence-flag
  section supports the "mark areas of uncertainty" legacy behavior.)*
- [x] **2.7** `inception-summary-template.md` — id `INCEPTION-SUMMARY`. Sections: Inception
  metadata (project/flow/profile/dates), Decisions made (with rationale), Deferred items (with
  reasons), Artifact confidence scores (which are high-confidence, which need refinement),
  Process improvement notes, Sign-off, Links. *(source: §3 Phase 7.)*
- [x] **2.8** `inception-state-template.yaml` — **line 1 = `ados_distribution: redistributable`
  (top-level, NO `---` block).** Implement the schema from research §7 / spec DM-1:
  `schema_version`, `project` (name/flow/profile/characteristics{ui_bearing,multi_user,
  complex_domain,code_project}), `phases[]` (id/name/status/started/completed), `artifacts{}`
  (status/path/confidence), `decisions[]`, `assumptions[]`, `sessions[]`, `last_updated`.
  Mirror `content-calendar-template.yaml` / `product-roadmap-register-template.yaml` style.
  Include inline `# comment` guidance. *(Template only — DEC-8; no live instance.)*
- [x] **2.9** `material-inventory-template.md` — id `MATERIAL-INVENTORY`. Sections: Inputs
  table (file | type | source | summary | **informs-phase** | key elements/concepts),
  Coverage gaps (what's missing per phase). *(source: §3 Phase 0, §2.3.)*
- [x] **2.10** Run `scripts/add-header-location.sh doc/templates` (inserts `.md` headers;
  idempotent on existing files; does not touch the `.yaml`).

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F5-1 — all 9 engineering templates exist.
- Must: AC-F5-5 — `roadmap-engineering-template.md` has success metrics per milestone and a
  validation approach.

**Files and modules**:

- `doc/templates/architecture-overview-template.md` (new)
- `doc/templates/tech-stack-template.md` (new)
- `doc/templates/glossary-template.md` (new)
- `doc/templates/roadmap-engineering-template.md` (new)
- `doc/templates/ubiquitous-language-template.md` (new)
- `doc/templates/repo-analysis-template.md` (new)
- `doc/templates/inception-summary-template.md` (new)
- `doc/templates/inception-state-template.yaml` (new)
- `doc/templates/material-inventory-template.md` (new)

**Tests**:

- Each new `.md` frontmatter starts (after header insert) with copyright/MIT/source then
  `ados_distribution: redistributable` then `id`/`status`/`owners`/summary`.
- `inception-state-template.yaml` line 1 is exactly `ados_distribution: redistributable`,
  has no `---`, and `python3 -c "import yaml,sys; yaml.safe_load(open('doc/templates/inception-state-template.yaml'))"`
  succeeds (placeholder values parse).
- `grep -Rn "\.ai/local" doc/templates/` returns nothing.

**Completion signal**: `docs(GH-69): add engineering inception templates`

---

### Phase 3: Product-discovery templates (3)

**Goal**: Create the 3 product-discovery templates (F-5, AC-F5-2), including the
DEC-2-relationship-aware `persona-jtbd-template.md` (RSK-5).

**Tasks**:

- [x] **3.1** `opportunity-solution-tree-template.md` — id `OST`. Sections: Desired outcome
  (link to NSM), Opportunities (with evidence/source), Solutions per opportunity, Experiments
  per solution (assumption tested, metric, stop criteria), embedded Mermaid tree
  (Outcome→Opportunities→Solutions→Experiments). *(source: §2.2 "OST", §3 Phase 1 step 3.)*
- [x] **3.2** `project-prd-template.md` — id `PROJECT-PRD`. Sections: Problem statement,
  Vision narrative (Working Backwards / press-release format), Target users, Success metrics,
  Out of scope, Assumptions, Validation plan. *(source: §2.2 "Project PRD", §10 principle 4.
  Richer than north star; for non-trivial new products.)*
- [x] **3.3** `persona-jtbd-template.md` — id `PERSONA-JTBD`. **Combined inception-flavored
  persona + JTBD (DEC-2).** Sections: Persona (role/context, goals & motivations,
  frictions & blockers, decision criteria — mirror `persona-template.md`) + JTBD (job
  statement "When… I want to… so I can…", functional/emotional/social outcomes, current
  alternatives, success criteria — mirror `jobs-to-be-done-template.md`) + an explicit
  **Relationship note**: "This is the lightweight inception combined view used in
  `doc/overview`/north-star context at project level. For business-profile deep dives use
  `persona-template.md` and `jobs-to-be-done-template.md`." *(RSK-5 mitigation.)*
- [x] **3.4** Run `scripts/add-header-location.sh doc/templates`.

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F5-2 — all 3 product-discovery templates exist.
- Must: `persona-jtbd-template.md` states its relationship to `persona-template.md` and
  `jobs-to-be-done-template.md` (DEC-2, RSK-5).

**Files and modules**:

- `doc/templates/opportunity-solution-tree-template.md` (new)
- `doc/templates/project-prd-template.md` (new)
- `doc/templates/persona-jtbd-template.md` (new)

**Tests**:

- Each new `.md` has header + `ados_distribution: redistributable` + `id`/`status`/`owners`/`summary`.
- `grep -n "persona-template.md\|jobs-to-be-done-template.md" doc/templates/persona-jtbd-template.md`
  returns the relationship note.

**Completion signal**: `docs(GH-69): add product-discovery inception templates`

---

### Phase 4: UX templates (3)

**Goal**: Create the 3 UX templates (F-5, AC-F5-3) — conditional artifacts for UI-bearing
projects.

**Tasks**:

- [x] **4.1** `user-journey-template.md` — id `USER-JOURNEY`. Sections: Persona & context,
  Journey stages, Steps table (action | thought/feeling | pain | opportunity |
  touchpoint/screen), embedded Mermaid flow, Opportunities surfaced. *(source: §2.2
  "User journeys", §3 Phase 2 step 4 — cross-feature flow maps.)*
- [x] **4.2** `screen-inventory-template.md` — id `SCREEN-INVENTORY`. Sections: Screens table
  (id | name | purpose | user flow | data requirements | status), Mapping to user journeys,
  Notes. *(source: §2.2 "Screen inventory", §3 Phase 2 step 4.)*
- [x] **4.3** `ux-guidance-template.md` — id `UX-GUIDANCE`. Sections: Design system / component
  library, Accessibility standards (WCAG conformance level + how it is verified), Interaction
  patterns, Responsive breakpoints, Theming/branding notes, Relationship to
  `.ai/rules/ux-conventions.md` (project-level guidance vs per-change conventions). *(source:
  §2.2 "UX design guidance", §3 Phase 4 step 6.)*
- [x] **4.4** Run `scripts/add-header-location.sh doc/templates`.

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F5-3 — all 3 UX templates exist.

**Files and modules**:

- `doc/templates/user-journey-template.md` (new)
- `doc/templates/screen-inventory-template.md` (new)
- `doc/templates/ux-guidance-template.md` (new)

**Tests**:

- Each new `.md` has header + `ados_distribution: redistributable` + `id`/`status`/`owners`/`summary`.

**Completion signal**: `docs(GH-69): add UX inception templates`

---

### Phase 5: Risk & assumption templates (2)

**Goal**: Create the 2 risk/assumption templates (F-5, AC-F5-4) — the four-risk framework
capture.

> Small phase by design: it is a distinct content category whose boundary aligns cleanly with
> AC-F5-4, keeping the AC→phase mapping 1:1 per category (kept separate rather than merged per
> the category structure in spec Appendix A).

**Tasks**:

- [x] **5.1** `assumption-register-template.md` — id `ASSUMPTION-REGISTER`. Sections:
  Assumptions table (id | assumption | **risk_type** [value/usability/feasibility/viability] |
  **validation_status** [unvalidated/testing/validated/invalidated] | validation_method |
  owner | due | evidence), Summary by risk type, Priorities. **Include an explicit relationship
  note (mirrors the DEC-2/RSK-5 persona-jtbd pattern): "This is the inception four-risk
  (Value/Usability/Feasibility/Viability) register for project inception. For business-profile
  strategic assumptions use `strategic-assumptions-template.md`."** *(source: §2.2 "Assumption
  register", §3 Phase 2 step 5, §7 state `assumptions[]` shape.)*
- [x] **5.2** `risk-register-template.md` — id `RISK-REGISTER`. Sections: Risks table
  (id | risk | **type** [value/usability/feasibility/viability] | likelihood | impact |
  mitigation | owner | residual), Heat-map summary, Cross-links to the assumption register.
  **Include the same relationship note as 5.1: this is the inception four-risk register; for
  business-profile strategic assumptions use `strategic-assumptions-template.md`.** *(source:
  §2.2 "Risk register", §3 Phase 2 step 6, §6 four-risk check.)*
- [x] **5.3** Run `scripts/add-header-location.sh doc/templates`.

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F5-4 — both risk/assumption templates exist.

**Files and modules**:

- `doc/templates/assumption-register-template.md` (new)
- `doc/templates/risk-register-template.md` (new)

**Tests**:

- Each new `.md` has header + `ados_distribution: redistributable` + `id`/`status`/`owners`/`summary`.
- Both templates tag items with the four risk types (value/usability/feasibility/viability).

**Completion signal**: `docs(GH-69): add risk and assumption inception templates`

---

### Phase 6: Enrich the north-star template

**Goal**: Enrich `doc/templates/north-star-template.md` additively (F-6, AC-F6-1) — preserve
the existing structure (DEC in spec §5.1 F-6: "additive edits only").

**Tasks**:

- [x] **6.1** Add **strategic-pyramid context** (mission → vision → strategy → outcome) as a
  short framing note near the Vision/Mission sections (do not rewrite existing sections).
- [x] **6.2** Reinforce the **outcome-vs-output distinction** in the North Star Metric section
  (NSM = the one outcome metric that captures user value, with guardrails; outcomes not
  outputs).
- [x] **6.3** Enhance **Target Users** with **JTBD framing** for the primary persona ("the job
  they hire the product for"), linking to `persona-jtbd-template.md`.
- [x] **6.4** Add a new **Four-risk awareness** section (Value/Usability/Feasibility/Viability
  lenses applied to the north-star decisions; link to `assumption-register-template.md` /
  `risk-register-template.md`).
- [x] **6.5** Run `scripts/add-header-location.sh doc/templates` (idempotent — header + marker
  already present; confirms no regression).

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F6-1 — the template now includes strategic-pyramid context, outcome-vs-output
  distinction, JTBD for the primary persona, and a four-risk awareness section; existing
  structure preserved.

**Files and modules**:

- `doc/templates/north-star-template.md` (updated, additive)

**Tests**:

- `grep -ni "strategic pyramid\|outcome\|jobs to be done\|four-risk\|four risk" doc/templates/north-star-template.md`
  returns hits in each of the four enriched/added areas.
- Existing sections (Vision, Mission, Problem We Solve, Guiding Principles, Decision Filter,
  Scope, Current Focus) still present and un-reordered.

**Completion signal**: `docs(GH-69): enrich north-star template with outcome, pyramid, JTBD, four-risk`

---

### Phase 7: Operational overview file set

**Goal**: Restructure `doc/overview/README.md` into an operational file set with conditional
classification (F-4, AC-F4-1, DEC-4). README-level only — no content files created.

**Tasks**:

- [x] **7.1** Rewrite `doc/overview/README.md` body to define the file set with classification
  (from spec Appendix B): `01-north-star`, `02-roadmap`, `architecture-overview`,
  `tech-stack`, `glossary` (Recommended); `opportunity-solution-tree`, `user-journeys`,
  `screen-inventory`, `ux-guidance` (Conditional); `ubiquitous-language` (Optional / DDD).
- [x] **7.2** For each Conditional/Optional file, name the template it is authored from
  (forward-references resolved in Phases 2–4) and state the activation condition (e.g.,
  "Conditional — UI-bearing project").
- [x] **7.3** Keep the existing copyright/MIT/source header (this file is outside the DM-2
  scan set → no `ados_distribution` needed; running the header script is a no-op/idempotent).
  Add a forward-pointer to `doc/guides/project-inception.md` (created Phase 8) and to the NEW
  **"Inception Artifact Catalog"** section created in `doc/documentation-handbook.md` by
  Phase 9.1 (point there, not to the generic §4.2). As a secondary pointer, also enrich §4.2
  in Phase 9.1 to reference the new "Inception Artifact Catalog" section so both pointers
  resolve (no ghost).

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F4-1 — defines the operational file set with Recommended/Conditional/Optional
  classification and creates no content files.

**Files and modules**:

- `doc/overview/README.md` (updated, restructured)

**Tests**:

- `ls doc/overview` shows no new content files (only the rewritten README).
- `grep -ni "Recommended\|Conditional\|Optional" doc/overview/README.md` returns the
  classification for each file.

**Completion signal**: `docs(GH-69): restructure overview README into operational file set`

---

### Phase 8: Centerpiece inception process guide

**Goal**: Author `doc/guides/project-inception.md` (F-1, AC-F1-1..10) — the single largest
artifact. Redistributable, self-contained (DEC-7, NFR-4), with all 4 Mermaid diagrams
embedded verbatim (NFR-7).

**Tasks**:

- [x] **8.1** Frontmatter: `ados_distribution: redistributable` + `id`/`status`/`owners`/
  `summary` (mirror a guide's frontmatter). After authoring, run
  `scripts/add-header-location.sh doc/guides`.
- [x] **8.2** **(a) Philosophy** — two principles (human gates at every phase;
  capture-don't-run) and the two-track model (Track A product context / Track B engineering
  setup, converging at Phase 2 and Phase 6). *(source: research §1.)*
- [x] **8.3** **(b) Artifact catalog** — always-produced + conditional tables (state,
  material inventory, north star, roadmap, tech stack, architecture, glossary, ADOS framework
  files, documentation profile/handbook, inception summary; conditional: OST, personas/JTBD,
  assumption register, risk register, user journeys, screen inventory, UX guidance,
  ubiquitous language, NFRs, repo analysis, tribal knowledge, project PRD, initial feature
  specs/decision records). **The catalog table carries columns `Artifact | Location | Template |
  Produced by`.** Annotate each row: which artifacts are **templated HERE (GH-69)** (the 17 new
  templates + `north-star-template.md` enrichment); which **reuse existing templates**
  (`feature-spec-template.md`, `decision-record-template.md`); and which are **produced by
  `@bootstrapper`/CI in GH-71** (testing-strategy, CI baseline, dev-environment guide) or
  **GH-33** (tribal-knowledge). This prevents the impression of missing deliverables (RT1-06).
  *(source: §2.1, §2.2.)*
- [x] **8.4** **(c) 8-phase process (0–7)** — for EACH of the 8 phases (0–7) render its four
  sub-parts as Markdown headings: `### Activities`, `### Anti-sycophancy technique`,
  `### Human gate`, `### Outputs` (naming the template to use; cross-link every output to the
  Phase 2–5 template that produces it). For phases with no anti-sycophancy technique, the
  `### Anti-sycophancy technique` heading MUST still appear with body text `None (intake phase)`
  (Phase 0), `None (framework-integration phase)` (Phase 5), `None (readiness-check phase)`
  (Phase 6), and `None (handoff phase)` (Phase 7) respectively. (This reaches the runbook's
  ≥32 sub-part count — 8 phases × 4 headings — and resolves test-plan OQ-2; the decision-dense
  phases 1–4 carry their real techniques per 8.8.) *(source: §3 Phases 0–7, §6.)*
- [x] **8.5** **(c-diagrams) Embed all 4 Mermaid diagrams VERBATIM** from
  `inception-process-diagrams.md`: Diagram 1 master flow, Diagram 2 Phase 0 decision,
  Diagram 3 new-vs-legacy, Diagram 4 two-track convergence. Copy the fenced ```mermaid blocks
  exactly. *(NFR-7: exactly 4 diagrams.)*
- [x] **8.6** **(d) Legacy-vs-new differences** — a table covering Phases 0–4 (new vs legacy
  behavior). *(source: §4 table.)*
- [x] **8.7** **(e) Conditional-artifacts matrix** — all 5 project-type columns. The column
  headers MUST be exactly these literals (no parentheses, matching spec DM-2 and the test
  runbook step 7): `CLI/API only` | `Library` | `Web app new` | `Web app legacy` |
  `Business repo`. (Note: the research source uses `Web app (new)`/`Web app (legacy)`; normalize
  to the no-paren form here so the runbook's `grep -F` matches.) *(source: §5; spec DM-2.)*
- [x] **8.8** **(f) Anti-sycophancy per phase** — each decision-dense phase lists its
  technique with the **concrete prompt text** (devil's advocate, pre-mortem, four-risk check,
  alternative comparison, unknown-unknowns). *(source: §6.)*
- [x] **8.9** **(g) `inception-state.yaml` schema + resume behavior** — document the schema
  (cross-reference `inception-state-template.yaml`) and how a fresh invocation reads state,
  determines the current phase, and resumes. *(source: §7; spec DM-1.)*
- [x] **8.10** **(h) `doc/inception/` workspace** — purpose, structure, lifecycle, and the
  inputs-vs-analysis split. *(source: spec F-3, research §2.3; cross-link to the Phase 1
  READMEs.)*
- [x] **8.11** **(i) Out of scope for inception** — the table (running interviews/experiments,
  prototyping with users, wireframing, competitive analysis, business strategy, org design,
  marketing) with the "inception captures OUTPUTS, does not run them" note. *(source: §9.)*
- [x] **8.12** **(j) 10 design principles** — outcome over output, fall in love with the
  problem, four-risk awareness, Working Backwards, validate assumptions, Product Trio
  alignment, AI as reviewer not author, capture depth enables autonomy, conditional artifacts,
  living documents. *(source: §10.)*

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F1-1 — guide exists, carries the license header, declares
  `ados_distribution: redistributable`.
- Must: AC-F1-2 — all 8 phases (0–7) each document Activities, Anti-sycophancy technique,
  Human gate, and Outputs (with the template to use).
- Must: AC-F1-3 — all 4 Mermaid diagrams embedded (master flow, Phase 0 decision,
  new-vs-legacy, two-track convergence).
- Must: AC-F1-4 — legacy flow differences for Phases 0–4 in a table.
- Must: AC-F1-5 — conditional-artifacts matrix present with all 5 project-type columns.
- Must: AC-F1-6 — each decision-dense phase lists its anti-sycophancy technique with concrete
  prompt text.
- Must: AC-F1-7 — `inception-state.yaml` schema and resume behavior documented.
- Must: AC-F1-8 — `doc/inception/` purpose, structure, lifecycle, and inputs-vs-analysis split
  explained.
- Must: AC-F1-9 — what is explicitly out of scope for inception is listed.
- Must: AC-F1-10 — a reader who never saw the research notes can execute inception end-to-end
  using the guide alone (self-contained).

**Files and modules**:

- `doc/guides/project-inception.md` (new)

**Tests**:

- `grep -cE '^[[:space:]]*```mermaid[[:space:]]*$' doc/guides/project-inception.md` == 4 (NFR-7; matches test-plan Runbook step 5).
- `grep -Rn "\.ai/local" doc/guides/project-inception.md` returns nothing (NFR-4).
- Every template name referenced in phase Outputs resolves to a file created in Phases 2–5
  (no ghost references).
- Frontmatter has `ados_distribution: redistributable` and (after header script) the
  copyright/MIT/source lines.

**Completion signal**: `docs(GH-69): add project inception process guide`

---

### Phase 9: Handbook + templates README discoverability

**Goal**: Make the catalog, conditional matrix, workspace, and template set discoverable from
the canonical docs entry points (F-7, F-8, AC-F2-1, AC-F8-1).

**Tasks**:

- [x] **9.1** `doc/documentation-handbook.md` — add (additive) an **"Inception Artifact
  Catalog"** subsection (use that exact heading so the Phase 7.3 overview-README pointer
  resolves with no ghost), covering always-produced + conditional (mirrored from the guide), the
  **conditional-artifacts matrix** (5 columns), a **"`doc/inception/` Workspace"** subsection
  (purpose/structure/lifecycle), and a **forward-pointer** to `doc/guides/project-inception.md`.
  Also enrich §4.2 to reference the new "Inception Artifact Catalog" section (secondary pointer
  for the overview README). Note: the handbook §17 "Template Index" is deliberately **NOT**
  extended — the canonical discovery surface for the 17 inception templates is
  `doc/templates/README.md` (AC-F8-1); §17 remains a curated subset. Update `last_updated`.
  (Header + `ados_distribution: redistributable` already present — idempotent header run.)
- [x] **9.2** `doc/templates/README.md` — add an **"Inception templates"** category listing
  all 17 new templates (grouped Engineering/Product discovery/UX/Risk & assumption, each row:
  template → purpose + the phase that produces it). The category blurb notes the relationship
  between the inception four-risk `assumption-register`/`risk-register` templates and the
  business `strategic-assumptions-template.md` (DEC-9), and between `persona-jtbd` and the
  business `persona`/`jobs-to-be-done` templates (DEC-2). Keep the existing
  `ados_distribution: redistributable` marker (already present).

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-F2-1 — handbook defines the inception artifact catalog and includes the
  conditional matrix.
- Must: AC-F8-1 — templates README includes an "Inception templates" category listing all 17
  new templates.

**Files and modules**:

- `doc/documentation-handbook.md` (updated, additive)
- `doc/templates/README.md` (updated, additive)

**Tests**:

- `grep -ni "inception" doc/documentation-handbook.md` returns the catalog, matrix, and
  workspace subsections + forward-pointer.
- The 17 template filenames all appear in `doc/templates/README.md` (count == 17).

**Completion signal**: `docs(GH-69): surface inception catalog, matrix, and templates in handbook/index`

---

### Phase 10: Headers, markers, and verification (merge gate)

**Goal**: Final consolidated header/marker pass and the formal verification that satisfies the
doc-distribution merge gate and the no-ghost-references / self-containment invariants
(NFR-1..7, AC-NFR-1a/3a/5a). This is the finalize-and-release phase.

**Tasks**:

- [x] **10.1** Run the consolidated header pass:
  `scripts/add-header-location.sh doc/templates doc/guides doc/inception` (idempotent; ensures
  every new `.md` has the 3-line header). Confirm the `.yaml` template is untouched by the
  script (it should be).
- [x] **10.2** Confirm every NEW distributable doc declares
  `ados_distribution: redistributable`: all 16 new `.md` templates +
  `doc/guides/project-inception.md` (the `.yaml` uses the line-1 rule). Enum-valid.
- [x] **10.3** Run the merge gate: `bash scripts/.tests/test-doc-distribution.sh` — **must
  exit 0** (AC-NFR-1a). If it fails, fix the named condition (missing/invalid marker,
  redistributable-not-installed, derived-set drift) and re-run.
- [x] **10.4** Ghost-reference cross-check (AC-NFR-5a): a "ghost" is a reference to an artifact
  **GH-69 ships** (the 17 templates + `doc/guides/project-inception.md`) that does not resolve;
  references to **per-project destination paths described as guidance** are EXEMPT by the §24
  definition — they are documented destinations, not shipped artifacts (e.g., `doc/overview/*.md`
  instances, `doc/inception/*.yaml` instances, `doc/documentation-profile.md`, `doc/business/*`,
  `doc/contracts/*`, `doc/decisions/*`, `doc/meetings/*`, `doc/spec/*`, `doc/guides/dev-setup.md`).
  Two-part check across `doc/guides/project-inception.md`, `doc/documentation-handbook.md`,
  `doc/overview/README.md`, and `doc/templates/README.md`: (a) every `doc/templates/<name>`
  reference `test -f`s to a file; (b) `test -f doc/guides/project-inception.md` (the only
  non-template shipped artifact). In particular: all 17 template names referenced from the
  guide/handbook/overview exist; the `persona-jtbd` relationship pointers resolve. (Mirrors the
  test-plan Runbook §7.1 step 15 so plan and test-plan agree.)
- [x] **10.5** Self-containment check (NFR-4):
  `grep -Rn "\.ai/local" doc/guides/project-inception.md doc/documentation-handbook.md
  doc/overview/README.md doc/templates/README.md doc/templates doc/inception` returns nothing.
- [x] **10.6** Header-coverage check (AC-NFR-3a): every new `.md` under `doc/templates/`,
  `doc/guides/project-inception.md`, and `doc/inception/**/*.md` carries the copyright/MIT/
  source header.
- [x] **10.7** Confirm scope boundaries: no agent-prompt file (`.opencode/**`) and no code/CI
  logic changed; no live overview content files or live `inception-state.yaml`/summary created.
- [x] **10.8** Cross-check the template manifest (spec Appendix A) against `doc/templates/` —
  exactly 17 new templates present, grouped as 9/3/3/2.

**Acceptance Criteria**:

> **Phase verdict: ALL PASSED** — evidence in Execution Log (per-phase commits); consolidated verification = Runbook §7.1 (17/17 PASS), `test-doc-distribution.sh` exit 0.

- Must: AC-NFR-1a — `bash scripts/.tests/test-doc-distribution.sh` exits 0.
- Must: AC-NFR-3a — 100% license-header coverage on new files.
- Must: AC-NFR-5a — 0 ghost references.

**Files and modules**:

- None created (verification sweep; minor header/marker fixes only if a check fails).

**Tests**:

- The guard exits 0; the four grep cross-checks return the expected (4 diagrams; 0 `.ai/local`
  refs; 0 ghosts; 17 templates listed).

**Release readiness / version & spec reconciliation**:

- **Version impact**: `minor` per spec — this change adds redistributable docs/templates but
  changes no behavior. There is no package version file in this docs-centric repo; record the
  impact in the change's PR description and the spec `version_impact` field (already `minor`).
- **Spec reconciliation**: per-change spec/plan/test-plan are change artifacts (not system
  spec). The ADOS system-spec reconciliation (`/sync-docs GH-69`, the `doc/spec/**` mirror) is
  performed by `@doc-syncer` in the subsequent delivery phase (Phase 6 of the ADOS workflow),
  not within this implementation plan. Phase 10 hands off with the catalog/matrix already
  mirrored into `doc/documentation-handbook.md` (the canonical docs standard), which is the
  durable spec surface for this change.

**Completion signal**: `docs(GH-69): verify distribution markers, headers, and cross-references`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Adopter with no `.ai/local/` access opens the guide and can run inception end-to-end | 8, 10 | AC-F1-1, AC-F1-10 |
| TS-2 | Reader inspects each phase 0–7 and finds Activities/Anti-sycophancy/Gate/Outputs+template | 8 | AC-F1-2 |
| TS-3 | Rendered guide shows exactly 4 Mermaid diagrams | 8, 10 | AC-F1-3 |
| TS-4 | Reader compares paths via the legacy-vs-new table (Phases 0–4) | 8 | AC-F1-4 |
| TS-5 | Reader selects artifacts via the 5-column conditional matrix | 8 | AC-F1-5 |
| TS-6 | Each decision-dense phase lists anti-sycophancy prompt text | 8 | AC-F1-6 |
| TS-7 | State schema + resume behavior documented; template ships | 2, 8 | AC-F1-7, DM-1 |
| TS-8 | Workspace READMEs explain purpose/structure/lifecycle/inputs-vs-analysis | 1, 8 | AC-F1-8, AC-F3-1 |
| TS-9 | Out-of-scope table present in guide | 8 | AC-F1-9 |
| TS-10 | All 9 engineering templates present; roadmap has metrics+validation | 2 | AC-F5-1, AC-F5-5 |
| TS-11 | All 3 product-discovery templates present; persona-jtbd states relationship | 3 | AC-F5-2 |
| TS-12 | All 3 UX templates present | 4 | AC-F5-3 |
| TS-13 | Both risk/assumption templates present | 5 | AC-F5-4 |
| TS-14 | North-star enriched (pyramid, outcome, JTBD, four-risk) | 6 | AC-F6-1 |
| TS-15 | Overview README classifies files Recommended/Conditional/Optional | 7 | AC-F4-1 |
| TS-16 | Handbook has catalog + matrix + workspace + forward-pointer | 9 | AC-F2-1 |
| TS-17 | Templates README has "Inception templates" category (17 listed) | 9 | AC-F8-1 |
| TS-18 | `test-doc-distribution.sh` exits 0 | 10 | AC-NFR-1a |
| TS-19 | 100% header coverage on new files | 2–10 | AC-NFR-3a |
| TS-20 | 0 ghost references across guide/handbook/overview/templates README | 10 | AC-NFR-5a |

---

## Definition of Done (AC → Phase coverage)

Every acceptance criterion in spec §17 is covered (100%).

| AC ID | Criterion (short) | Primary phase(s) | Final-verify phase |
|-------|--------------------|------------------|--------------------|
| AC-F1-1 | Guide exists, header, `ados_distribution` | 8 | 10 |
| AC-F1-2 | 8 phases × (Activities/Anti-sycophancy/Gate/Outputs) | 8 | 10 |
| AC-F1-3 | 4 Mermaid diagrams embedded | 8 | 10 |
| AC-F1-4 | Legacy-vs-new diff table (Phases 0–4) | 8 | 10 |
| AC-F1-5 | Conditional matrix, 5 columns | 8 | 10 |
| AC-F1-6 | Anti-sycophancy per phase w/ prompt text | 8 | 10 |
| AC-F1-7 | `inception-state.yaml` schema + resume | 2 (template), 8 (guide) | 10 |
| AC-F1-8 | `doc/inception/` workspace explained | 1, 8 | 10 |
| AC-F1-9 | Out-of-scope listed | 8 | 10 |
| AC-F1-10 | Self-contained (no `.ai/local/*`, runnable alone) | 8 | 10 |
| AC-F3-1 | Workspace skeleton = 4 READMEs, no live instances | 1 | 10 |
| AC-F2-1 | Handbook catalog + conditional matrix | 9 | 10 |
| AC-F4-1 | Overview README operational file set + classification | 7 | 10 |
| AC-F5-1 | 9 engineering templates | 2 | 10 |
| AC-F5-2 | 3 product-discovery templates | 3 | 10 |
| AC-F5-3 | 3 UX templates | 4 | 10 |
| AC-F5-4 | 2 risk/assumption templates | 5 | 10 |
| AC-F5-5 | roadmap-engineering: metrics per milestone + validation | 2 | 10 |
| AC-F6-1 | North-star enriched (pyramid/outcome/JTBD/four-risk) | 6 | 10 |
| AC-F8-1 | Templates README "Inception templates" category | 9 | 10 |
| AC-NFR-5a | 0 ghost references | 2–9 | 10 |
| AC-NFR-3a | 100% header coverage | 2–9 | 10 |
| AC-NFR-1a | `test-doc-distribution.sh` exits 0 | 2–9 (markers) | 10 |

**Coverage confirmation**: 23/23 acceptance criteria mapped; all terminate in Phase 10
verification. 100% covered.

---

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-69-spec.md | Spec (source of truth) |
| PM notes | ./chg-GH-69-pm-notes.yaml | Process notes |
| Implementation plan (this file) | ./chg-GH-69-plan.md | Plan |
| Process guide | doc/guides/project-inception.md | New — redistributable |
| Workspace skeleton | doc/inception/{README,inputs/README,meetings/README,analysis/README}.md | New |
| Engineering templates (9) | doc/templates/architecture-overview-template.md, tech-stack-template.md, glossary-template.md, roadmap-engineering-template.md, ubiquitous-language-template.md, repo-analysis-template.md, inception-summary-template.md, inception-state-template.yaml, material-inventory-template.md | New — redistributable |
| Product-discovery templates (3) | doc/templates/opportunity-solution-tree-template.md, project-prd-template.md, persona-jtbd-template.md | New — redistributable |
| UX templates (3) | doc/templates/user-journey-template.md, screen-inventory-template.md, ux-guidance-template.md | New — redistributable |
| Risk/assumption templates (2) | doc/templates/assumption-register-template.md, risk-register-template.md | New — redistributable |
| North-star template | doc/templates/north-star-template.md | Updated (additive) |
| Overview README | doc/overview/README.md | Updated (restructured) |
| Documentation handbook | doc/documentation-handbook.md | Updated (additive) |
| Templates README | doc/templates/README.md | Updated (additive) |
| Distribution guard | scripts/.tests/test-doc-distribution.sh | Verification (unchanged) |
| Header script | scripts/add-header-location.sh | Tooling (unchanged) |
| Decision reference | ODR-0001 | Distribution-marker contract |

Read-only research inputs (gitignored, never referenced from deliverables):
`.ai/local/inception/full-inception-bootstrap-process.md`,
`.ai/local/inception/inception-process-diagrams.md`,
`.ai/local/inception/README.md`.

---

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | plan-writer | Initial plan — 10 phased commits, 17 templates + guide + workspace + 3 enrichments; marker/header contract; DoD coverage 100%. |
| 1.1 | 2026-06-26 | coder | Verification-correctness fixes during Phase 10: (1) Runbook §7.1 step 15 ghost-check arm (b) refined — replaced the fragile exempt-prefix enumeration with the precise §24 definition (a ghost = a reference to a GH-69-shipped artifact; the only non-template shipped artifact is `doc/guides/project-inception.md`). The prefix list flagged ~28 legitimate per-project destinations documented in the handbook/guide (`doc/business/*`, `doc/contracts/*`, `doc/decisions/ADR-*`, `doc/documentation-profile.md`, `doc/guides/dev-setup.md`, etc.). Mirrored in plan §10.4 and TC-INCEPT-024. (2) Runbook step 11 header-coverage check fixed to skip non-`.md` files — `.yaml` register templates use the top-level `ados_distribution` marker with no header/no `---` block per ODR-0001, and `add-header-location.sh` only processes `.md`. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | done | 2026-06-26 | 2026-06-26 | f277e3f | `doc/inception/` workspace skeleton (4 READMEs); headers added. |
| 2 | done | 2026-06-26 | 2026-06-26 | 78341b7 | 9 engineering templates; `.yaml` line-1 marker fixed. |
| 3 | done | 2026-06-26 | 2026-06-26 | 22a3673 | 3 product-discovery templates; DEC-2 persona-jtbd note. |
| 4 | done | 2026-06-26 | 2026-06-26 | b445c72 | 3 UX templates; ux-guidance refs `.ai/rules/ux-conventions.md`. |
| 5 | done | 2026-06-26 | 2026-06-26 | 992b4d8 | 2 risk/assumption templates; DEC-9 four-risk notes. |
| 6 | done | 2026-06-26 | 2026-06-26 | 0a7a6fc | North-star enriched (pyramid, outcome-vs-output, JTBD, four-risk). |
| 7 | done | 2026-06-26 | 2026-06-26 | 81ea2d3 | Overview README restructured into Recommended/Conditional/Optional tables. |
| 8 | done | 2026-06-26 | 2026-06-26 | 2ed6fe7 | Centerpiece guide: 4 Mermaid diagrams, 8 phases × 4 sub-parts (33), 5-col matrix, schema+resume, anti-sycophancy. |
| 9 | done | 2026-06-26 | 2026-06-26 | d1d126c | Handbook §18 Inception Artifact Catalog + §4.2 pointer; templates README lists all 17 with DEC-2/DEC-9 notes. |
| 10 | done | 2026-06-26 | 2026-06-26 | 238d2af | Header pass clean; ghost-check refined; Runbook §7.1 = ALL VERIFICATION CHECKS PASSED (17/17); `test-doc-distribution.sh` exits 0 (72 in-scope docs, no drift). |
