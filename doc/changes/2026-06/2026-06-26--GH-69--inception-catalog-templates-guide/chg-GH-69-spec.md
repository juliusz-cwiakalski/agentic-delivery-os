---
workItemRef: GH-69
title: "Inception artifact catalog, templates, and complete process guide"
links:
  decisions: ["ODR-0001"]
  related_changes: ["GH-32", "GH-52", "GH-67"]
  benefits: ["GH-71", "GH-72", "GH-70"]
change:
  ref: GH-69
  type: docs
  status: Proposed
  slug: inception-catalog-templates-guide
  title: "Inception artifact catalog, templates, and complete process guide"
  owners: ["Juliusz Ćwiąkalski"]
  service: documentation
  labels: ["inception", "docs", "templates", "guide"]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["doc/templates", "doc/guides", "doc/overview", "doc/inception", "doc/documentation-handbook.md", "scripts/.tests/test-doc-distribution.sh", "scripts/add-header-location.sh"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Author the canonical inception documentation set — a single artifact catalog, a committed workspace skeleton, 17 new templates, an enriched north star, and a standalone human-executable process guide — so any project can be incepted consistently by hand before agent automation (GH-71) exists.

## 1. SUMMARY

Deliver the documentation, templates, and process foundation for ADOS project inception (epic GH-73, slice inception:1). The centerpiece is `doc/guides/project-inception.md`: a complete, redistributable, human-executable 8-phase process guide with four embedded Mermaid diagrams. Around it, this change adds 17 new templates (engineering, product discovery, UX, risk/assumption), enriches the north-star template, restructures `doc/overview/README.md` into an operational file set, establishes the committed `doc/inception/` workspace skeleton, and records the conditional-artifact matrix in the documentation handbook. No agent prompts change; no code changes. After GH-69, a human can run inception manually using only committed, redistributable artifacts.

## 2. CONTEXT

### 2.1 Current State Snapshot

ADOS per-change delivery (the 10-phase workflow in `AGENTS.md`) is mature. Project inception — the knowledge base agents deliver against — is shallow and undocumented:

- **Overview docs are aspirational, not operational.** `doc/overview/README.md` lists five files descriptively but provides no templates for architecture-overview, tech-stack, glossary, engineering-roadmap, user journeys, screen inventory, or UX guidance.
- **No inception artifact catalog.** No authoritative list states what documents make a project "incepted."
- **No inception workspace.** No committed location for inception inputs, process state, or intermediate analysis. The design research currently lives only under gitignored `.ai/local/inception/`.
- **No product-discovery capture.** Opportunity Solution Tree (OST), personas/JTBD, assumption registers, and four-risk assessment have no templates, so inception cannot capture product knowledge even when it exists.
- **No UX artifacts at project level.** User journeys, screen inventory, and UX guidance are captured only per-feature in feature specs.
- **No process guide.** No `doc/guides/project-inception.md` describes how to run inception manually.

Templates and docs are redistributed to adopters via `scripts/install.sh` and gated by the marker-driven distribution guard `scripts/.tests/test-doc-distribution.sh` (GH-67, ODR-0001): every `.md`/`.yaml` under `doc/templates/**`, every `doc/guides/*.md`, and the standalone handbook must declare `ados_distribution`.

### 2.2 Pain Points / Gaps

- Inception process is locked inside gitignored research notes — invisible to humans and unreferenceable by agents.
- Agents and adopters have no shared, enforceable notion of "what an incepted project contains."
- Existing north-star template lacks outcome-driven (NSM, strategic pyramid) and product-discovery-aware (JTBD, four-risk) structure, so inception outputs are inconsistent.
- UX and product-discovery knowledge has no home at project level, forcing re-derivation on every change.
- The conditional nature of artifacts (UI vs. API vs. business repo) is undocumented, so teams either over- or under-produce.

## 3. PROBLEM STATEMENT

Because project inception is undocumented and has no artifact catalog, templates, workspace, or process guide, teams and agents cannot run inception consistently or capture product-discovery knowledge at the project level — resulting in shallow, inconsistent knowledge bases that cap downstream delivery autonomy and force every change to re-derive context that inception should have captured once.

## 4. GOALS

- **G-1**: Publish a standalone, redistributable process guide that a human can execute end-to-end without seeing the research notes.
- **G-2**: Define one canonical inception artifact catalog (always-produced + conditional by project type).
- **G-3**: Establish `doc/inception/` as the committed inception workspace (skeleton + READMEs, not live instances).
- **G-4**: Restructure `doc/overview/` README into an operational file set with conditional classification (content files stay per-project).
- **G-5**: Add the 17 missing templates across engineering, product discovery, UX, and risk/assumption.
- **G-6**: Enrich the north-star template with strategic-pyramid context, outcome-vs-output distinction, JTBD for the primary persona, and four-risk awareness.
- **G-7**: Make the catalog, conditional matrix, and workspace discoverable from the documentation handbook and the templates index.
- **G-8**: Keep every new/changed distributable doc compliant with the marker-driven distribution guard.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| New templates created | 17 (9 engineering + 3 product discovery + 3 UX + 2 risk/assumption) |
| Embedded Mermaid diagrams in the guide | 4 (master flow, Phase 0 decision, new-vs-legacy, two-track convergence) |
| Unresolved ("ghost") cross-references in new docs | 0 |
| References from new docs to `.ai/local/inception/*` (gitignored) | 0 (guide must be self-contained) |
| `ados_distribution` markers on new distributable docs | 100% present and valid |
| `bash scripts/.tests/test-doc-distribution.sh` exit code | 0 |

### 4.2 Non-Goals

- **NG-1**: [OUT] Extending `@bootstrapper` with the phased workflow (→ GH-71 / inception:2).
- **NG-2**: [OUT] Deepening legacy onboarding — repo ingestion, behavioral-spec extraction, tribal-knowledge graduation (→ GH-72 / inception:3, GH-33).
- **NG-3**: [OUT] Layered technical planning (data/API/UI per-layer sessions) (→ GH-68 / inception:4).
- **NG-4**: [OUT] Self-hosting ADOS — authoring ADOS's own overview content (→ GH-70 / inception:capstone).
- **NG-5**: [OUT] Agent prompt changes of any kind.
- **NG-6**: [OUT] Code, CI workflow logic, or tooling behavior changes.
- **NG-7**: [OUT] Creating live overview content files (`01-north-star.md`, etc.) or a live `inception-state.yaml` instance — those are per-project outputs (GH-70/when a project runs inception), not GH-69 deliverables.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Standalone inception process guide | The process currently lives only in gitignored notes; a redistributable, human-executable guide is the centerpiece that unblocks manual inception and is referenced by future agent automation. |
| F-2 | Canonical inception artifact catalog | Teams and agents need one authoritative list of always-produced and conditional artifacts to know what "incepted" means. |
| F-3 | `doc/inception/` workspace skeleton | Inception needs a committed home for inputs, process state, intermediate analysis, and summary — separate from templates and from per-project overview content. |
| F-4 | Operational overview file set | `doc/overview/README.md` must classify each file as Recommended / Conditional / Optional so teams produce the right subset per project type. |
| F-5 | Inception template library (17 templates) | Consistent inception requires reusable structures for engineering, product discovery, UX, and risk/assumption outputs. |
| F-6 | Enriched north-star template | The compass document must carry outcome (NSM), strategic-pyramid context, JTBD, and four-risk awareness to drive consistent, outcome-oriented inception. |
| F-7 | Handbook inception documentation | The handbook is the canonical docs standard; the catalog, conditional matrix, and workspace must be discoverable there with a forward-pointer to the guide. |
| F-8 | Template index discoverability | The templates README must surface the new "Inception templates" category so agents and humans find them. |

### 5.1 Capability Details

**F-1 — Standalone inception process guide.** A single `doc/guides/project-inception.md`, redistributable, readable by someone who never saw the research notes. It documents: (a) philosophy — two principles (human gates at every phase; capture-don't-run) and the two-track model (Track A product context, Track B engineering setup, converging at Phase 2 and Phase 6); (b) the 8-phase process (Phases 0–7) where each phase states Activities, Anti-sycophancy technique, Human gate, and Outputs (with the template to use); (c) all four Mermaid diagrams embedded verbatim; (d) legacy-vs-new differences for Phases 0–4; (e) the conditional-artifacts matrix (five project-type columns); (f) anti-sycophancy techniques per phase with concrete prompt text; (g) the `inception-state.yaml` schema and resume behavior; (h) the `doc/inception/` workspace purpose/structure/lifecycle and inputs-vs-analysis split; (i) what is explicitly out of scope for inception; (j) the 10 design principles.

**F-2 — Canonical artifact catalog.** Two groups: always-produced (inception state, material inventory, north star, roadmap, tech stack, architecture overview, glossary, ADOS framework files, documentation profile/handbook, inception summary) and conditional (OST, personas/JTBD, assumption register, risk register, user journeys, screen inventory, UX guidance, ubiquitous language, NFRs, repo analysis, tribal knowledge, project PRD, initial feature specs/decision records). The catalog is stated once in the guide and mirrored as a conditional matrix in the handbook.

**F-3 — Workspace skeleton.** Committed READMEs only — not live instances. `doc/inception/README.md` (purpose, structure, lifecycle), `doc/inception/inputs/README.md` (user-provided materials), `doc/inception/meetings/README.md` (inception meeting notes), `doc/inception/analysis/README.md` (agent intermediate analysis: material-inventory, assumptions, risks, repo-analysis, tribal-knowledge). Templates for `inception-state.yaml` and `inception-summary.md` ship under `doc/templates/` and are instantiated when a project runs inception.

**F-4 — Operational overview file set.** `doc/overview/README.md` defines the file set with conditional classification: `01-north-star`, `02-roadmap`, `architecture-overview`, `tech-stack`, `glossary` (Recommended); `opportunity-solution-tree`, `user-journeys`, `screen-inventory`, `ux-guidance` (Conditional); `ubiquitous-language` (Optional/DDD). README-level restructure only — no content files created.

**F-5 — Template library.** 17 new templates in `doc/templates/`, all `ados_distribution: redistributable`, license headers via `scripts/add-header-location.sh`, mirroring existing template front-matter style (`id`/`status`/`owners`/`summary`). Engineering (9), product discovery (3), UX (3), risk/assumption (2). See §24 appendix for the manifest.

**F-6 — Enriched north star.** Additive edits only, preserving existing structure: strategic-pyramid context (mission → vision → strategy → outcome), outcome-vs-output distinction (NSM + guardrails), JTBD framing for the primary persona, and a four-risk awareness section.

**F-7 / F-8 — Discoverability.** Handbook gains "Inception Artifact Catalog" (with conditional matrix), "`doc/inception/` Workspace", and a forward-pointer to the guide. Templates README gains an "Inception templates" category listing all 17.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Human runs inception manually (post-GH-69, no agent automation)
  Reader opens doc/guides/project-inception.md
    → reads philosophy + conditional matrix to pick applicable artifacts
    → executes Phase 0 (intake): stages inputs in doc/inception/inputs/, builds material inventory from the template
    → for each Phase 1–7: performs activities, runs the anti-sycophancy prompt, hits the human gate, records outputs in the matching template, updates inception-state.yaml (from the template)
    → Phase 6 readiness check verifies catalog completeness + four-risk coverage + ghost-reference check
    → Phase 7 produces inception-summary.md from the template; project is incepted.

Flow 2 — Agent references inception docs during per-change delivery
  @pm / @coder loads doc/guides/project-inception.md + doc/overview/** + doc/inception/**
    → confirms the project is incepted and which artifacts exist
    → delivers changes against the captured knowledge base.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Create `doc/guides/project-inception.md` (redistributable, self-contained, 4 diagrams).
- Create `doc/inception/` workspace: `README.md`, `inputs/README.md`, `meetings/README.md`, `analysis/README.md`.
- Restructure `doc/overview/README.md` (operational file set + conditional classification).
- Create 17 new templates under `doc/templates/` (engineering 9, product discovery 3, UX 3, risk/assumption 2).
- Enrich `doc/templates/north-star-template.md` (additive).
- Update `doc/documentation-handbook.md` (catalog + conditional matrix + workspace section + forward-pointer).
- Update `doc/templates/README.md` ("Inception templates" category).
- License headers via `scripts/add-header-location.sh`; `ados_distribution: redistributable` on every new distributable doc.

### 7.2 Out of Scope

- [OUT] `@bootstrapper` phased workflow / agent automation (GH-71).
- [OUT] Legacy deepening — repo ingestion, behavioral-spec extraction, tribal-knowledge graduation (GH-72, GH-33).
- [OUT] Layered planning sessions (GH-68).
- [OUT] Self-hosting ADOS / authoring ADOS's own overview content (GH-70).
- [OUT] Agent prompt changes, code, CI logic, tooling behavior.
- [OUT] Live overview content files and live `inception-state.yaml` / `inception-summary.md` instances.

### 7.3 Deferred / Maybe-Later

- Agent-driven execution of the documented process (GH-71).
- Wiring `inception-state.yaml` resume behavior into an agent (GH-71).
- `llms.txt` for inception artifacts (deferred per research consistency audit).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — documentation/templates/guide only.

### 8.2 Events / Messages

N/A.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `inception-state.yaml` schema | Documented in the guide and shipped as `doc/templates/inception-state-template.yaml`. Top-level keys: `schema_version`, `project` (name/flow/profile/characteristics), `phases[]` (id/name/status/started/completed), `artifacts{}` (status/path/confidence), `decisions[]`, `assumptions[]`, `sessions[]`, `last_updated`. Template instance only; no live file in this change. |
| DM-2 | Conditional-artifact matrix | Five project-type columns (CLI/API only, Library, Web app new, Web app legacy, Business repo) × artifact rows, encoded in the guide and mirrored in the handbook. Drives Phase 0 artifact activation. |

### 8.4 External Integrations

N/A.

### 8.5 Backward Compatibility

Fully additive and backward-compatible. No existing file is removed or repurposed; `doc/overview/README.md` is restructured (content rewritten, not relocated) and the north-star template is enriched additively. The marker-driven distribution contract (ODR-0001) is extended, not changed: new `.md` templates declare `ados_distribution` inside their frontmatter block; the new `.yaml` template (`inception-state-template.yaml`) declares it as a top-level line-1 key per ODR-0001 (no `---` block, to keep `yaml.safe_load()` consumers working).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Doc-distribution guard passes for all new/changed distributable docs | `bash scripts/.tests/test-doc-distribution.sh` exits 0 |
| NFR-2 | `ados_distribution` marker coverage on new distributable docs | 100% present and enum-valid |
| NFR-3 | License-header coverage on new files in `doc/templates/`, `doc/guides/project-inception.md`, `doc/inception/**/*.md` | 100% via `scripts/add-header-location.sh` |
| NFR-4 | Guide self-containment | 0 references to `.ai/local/inception/*` paths anywhere in new docs |
| NFR-5 | No ghost references | 0 unresolved template/section cross-references across the guide, handbook, overview README, and templates README |
| NFR-6 | Template front-matter consistency | 100% of new templates include `id`, `status`, `owners`, `summary` mirroring existing template style |
| NFR-7 | Diagram completeness in the guide | Exactly 4 embedded Mermaid diagrams |
| NFR-8 | Reviewable delivery | Phased so no single review phase exceeds ~12 files (size-risk mitigation) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — documentation/templates only. The doc-distribution guard (§9) is the only automated check and runs in CI; no runtime metrics, logs, or traces are introduced.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Large change (~23 files) — review fatigue, merge conflicts, dropped deliverables | M | M | Phased delivery (group by area: guide → workspace → templates → enrichments → handbook/index); per-area AC; NFR-8 | L |
| RSK-2 | Ghost references — guide/handbook/overview/templates README cite a template that does not exist | M | M | Explicit no-ghost-references AC (NFR-5); review checklist; template manifest appendix cross-checked at delivery | L |
| RSK-3 | Consistency drift between guide content (sourced from research notes) and the templates/handbook | M | L | Single source of the catalog = the guide; handbook mirrors the matrix; templates README mirrors the template list; review checks alignment | L |
| RSK-4 | Doc-distribution guard failure from a missing or misplaced marker (especially the `.yaml` top-level rule) | M | M | Follow ODR-0001 placement rules; run the guard per NFR-1 before merge | L |
| RSK-5 | Overlap/confusion between the new `persona-jtbd-template.md` (inception) and existing `persona-template.md` + `jobs-to-be-done-template.md` (business) | L | M | New template explicitly states the relationship (DEC-2); templates README clarifies both categories | L |
| RSK-6 | Scope creep into GH-71/GH-72 (agent automation, legacy deepening) | M | L | Explicit non-goals (NG-1/NG-2); this change ships the template for `inception-state.yaml`, not its agent wiring | L |
| RSK-7 | Overlap of the new `assumption-register-template.md` / `risk-register-template.md` (inception four-risk) with the existing business `strategic-assumptions-template.md` | L | M | The new templates are explicitly scoped as inception four-risk (Value/Usability/Feasibility/Viability) registers; the relationship is stated in-template and in the templates README (DEC-9); mirrors the RSK-5/DEC-2 persona-jtbd pattern | L |

## 12. ASSUMPTIONS

- The two authoritative research notes (`.ai/local/inception/full-inception-bootstrap-process.md`, `inception-process-diagrams.md`) are accurate and current; the guide embeds their content rather than re-deriving it.
- The 8-phase (0–7) unified model with inline legacy differences is the agreed process (will not be re-debated here).
- License-header and `ados_distribution` placement rules in ODR-0001 / AGENTS.md remain unchanged.
- `doc/templates/**` templates install recursively via `scripts/install.sh` without per-file allowlisting (GH-67), so adding new templates requires only a valid marker — no install-list edit.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-32 (bootstrap/onboarding consistency) | Delivered — inception builds on the bootstrap foundation. |
| Depends on | GH-67 (marker-driven doc distribution) + ODR-0001 | Delivered — provides the `ados_distribution` contract and the CI guard this change must satisfy. |
| Coordinates with | GH-52 (business docs profile) | Inception references repo profile classification; does not change profile-gating. |
| Blocks | GH-71 (inception:2 — phased workflow) | Automates the process documented here; consumes the `inception-state-template.yaml`. |
| Blocks | GH-72 (inception:3 — legacy deepening) | Extends the guide's legacy differences into agent behavior. |
| Feeds | GH-70 (inception:capstone — self-host) | Validates templates/process by dogfooding on ADOS itself. |

## 14. OPEN QUESTIONS

None at authoring time. All scoping decisions were resolved during planning (see §15). If a decision surfaces during delivery, route it to `@decision-advisor` and record under §15.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Templates live in `doc/templates/`; `doc/inception/` holds READMEs (skeleton) + pointers, not live instances | Templates are shared/redistributable artifacts; the workspace holds per-project instances produced when a project runs inception | 2026-06-26 |
| DEC-2 | `persona-jtbd-template.md` is the inception-flavored combined persona+JTBD (overview/north-star context); existing `persona-template.md` + `jobs-to-be-done-template.md` remain canonical business-profile deep-dives; the new template states the relationship | Inception needs a lightweight combined view at project level; avoid duplicating the deeper business artifacts | 2026-06-26 |
| DEC-3 | `roadmap-engineering-template.md` is new (distinct from the business `product-roadmap-template.md`), created rich (Current Milestone as first-class section, success metrics per milestone, validation approach) | The inception engineering roadmap has milestone/validation semantics distinct from the business narrative roadmap | 2026-06-26 |
| DEC-4 | `doc/overview/` restructured at README level only; content files are GH-70/per-project | Overview content is project-specific; GH-69 only establishes the operational file set and classification | 2026-06-26 |
| DEC-5 | Every `doc/templates/**` and `doc/guides/project-inception.md` declares `ados_distribution: redistributable` | Enforced by `scripts/.tests/test-doc-distribution.sh` per ODR-0001 | 2026-06-26 |
| DEC-6 | License headers added via `scripts/add-header-location.sh`; agents never hand-add headers | AGENTS.md rule; guarantees consistent headers across the redistributable set | 2026-06-26 |
| DEC-7 | The guide is standalone and self-contained — sourced from the research notes but embedding all needed content; it never references `.ai/local/*` paths | The guide is redistributable and must be readable without gitignored context (NFR-4) | 2026-06-26 |
| DEC-8 | `inception-state.yaml` ships only as `doc/templates/inception-state-template.yaml`; no live instance in `doc/inception/` in this change | State is per-project; agent wiring of resume behavior is GH-71 | 2026-06-26 |
| DEC-9 | The new `assumption-register-template.md` and `risk-register-template.md` are inception four-risk (Value/Usability/Feasibility/Viability) registers; the business-profile strategic deep-dive stays in `strategic-assumptions-template.md`; the relationship is stated in-template (mirrors DEC-2/RSK-5) | Symmetric to the persona-jtbd disambiguation (DEC-2); prevents duplication/confusion between inception and business assumption artifacts | 2026-06-26 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/guides/project-inception.md` | New |
| `doc/inception/` (README + `inputs/`, `meetings/`, `analysis/` READMEs) | New |
| `doc/overview/README.md` | Updated (restructured) |
| `doc/templates/` (17 new templates) | New |
| `doc/templates/north-star-template.md` | Updated (enriched, additive) |
| `doc/templates/README.md` | Updated (new category) |
| `doc/documentation-handbook.md` | Updated (catalog, matrix, workspace section, forward-pointer) |

## 17. ACCEPTANCE CRITERIA

### Process guide (links F-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an adopter with no access to `.ai/local/`, **when** they open `doc/guides/project-inception.md`, **then** it exists, carries the license header, and declares `ados_distribution: redistributable`. | F-1, NFR-2, NFR-3 |
| AC-F1-2 | **Given** the guide, **when** a reader reviews phases, **then** all 8 phases (0–7) each document Activities, Anti-sycophancy technique, Human gate, and Outputs (with the template to use). | F-1 |
| AC-F1-3 | **Given** the guide, **when** rendered, **then** all 4 Mermaid diagrams are embedded (master flow, Phase 0 decision detail, new-vs-legacy, two-track convergence). | F-1, NFR-7 |
| AC-F1-4 | **Given** the guide, **when** a reader compares paths, **then** legacy flow differences for Phases 0–4 are documented in a table. | F-1 |
| AC-F1-5 | **Given** the guide, **when** a reader selects artifacts, **then** the conditional-artifacts matrix is present with all 5 project-type columns. | F-1, DM-2 |
| AC-F1-6 | **Given** the guide, **when** a reader runs an anti-sycophancy step, **then** each decision-dense phase lists its technique with concrete prompt text. | F-1 |
| AC-F1-7 | **Given** the guide, **when** a reader manages state, **then** the `inception-state.yaml` schema and resume behavior are documented. | F-1, DM-1 |
| AC-F1-8 | **Given** the guide, **when** a reader inspects workspace guidance, **then** the `doc/inception/` purpose, structure, lifecycle, and inputs-vs-analysis split are explained. | F-1, F-3 |
| AC-F1-9 | **Given** the guide, **when** a reader checks scope boundaries, **then** what is explicitly out of scope for inception is listed. | F-1 |
| AC-F1-10 | **Given** a reader who has never seen the research notes, **when** they follow the guide alone, **then** they can execute inception end-to-end without external context. | F-1, NFR-4 |

### Catalog & workspace (links F-2, F-3, F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** the workspace, **when** committed, **then** `doc/inception/` contains `README.md`, `inputs/README.md`, `meetings/README.md`, and `analysis/README.md` (and no live `inception-state.yaml`/`inception-summary.md`). | F-3, DEC-1, DEC-8 |
| AC-F2-1 | **Given** the handbook, **when** a reader looks for inception guidance, **then** it defines the inception artifact catalog and includes the conditional matrix. | F-2, F-7 |
| AC-F4-1 | **Given** `doc/overview/README.md`, **when** a reader classifies files, **then** it defines the operational file set with Recommended/Conditional/Optional classification (no content files created). | F-4, DEC-4 |

### Templates (links F-5, F-6, F-8)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** engineering templates, **when** checked, **then** all 9 exist: architecture-overview, tech-stack, glossary, roadmap-engineering, ubiquitous-language, repo-analysis, inception-summary, inception-state-template.yaml, material-inventory. | F-5 |
| AC-F5-2 | **Given** product-discovery templates, **when** checked, **then** all 3 exist: opportunity-solution-tree, project-prd, persona-jtbd. | F-5 |
| AC-F5-3 | **Given** UX templates, **when** checked, **then** all 3 exist: user-journey, screen-inventory, ux-guidance. | F-5 |
| AC-F5-4 | **Given** risk/assumption templates, **when** checked, **then** both exist: assumption-register, risk-register. | F-5 |
| AC-F6-1 | **Given** `north-star-template.md`, **when** reviewed, **then** it includes strategic-pyramid context, outcome-vs-output distinction, JTBD for the primary persona, and a four-risk awareness section (existing structure preserved). | F-6 |
| AC-F5-5 | **Given** `roadmap-engineering-template.md`, **when** reviewed, **then** it has success metrics per milestone, a validation approach, AND OST/discovery linkage. | F-5, DEC-3 |
| AC-F8-1 | **Given** `doc/templates/README.md`, **when** reviewed, **then** it includes an "Inception templates" category listing all 17 new templates. | F-8 |

### Consistency & compliance (links NFR-1, NFR-3, NFR-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR-5a | **Given** all new docs, **when** cross-references are resolved, **then** no template/section referenced in the handbook, overview README, guide, or templates README points to a non-existent file (0 ghost references). | F-7, F-8, NFR-5 |
| AC-NFR-3a | **Given** all new files, **when** inspected, **then** each carries the ADOS license header (100% coverage). | NFR-3, DEC-6 |
| AC-NFR-1a | **Given** the repo after the change, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 (all new distributable docs marker-valid and installed). | NFR-1, DEC-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Single docs-only change, delivered in review phases by area to keep each review tractable (NFR-8): (1) `doc/inception/` workspace skeleton; (2) the 17 new templates; (3) north-star enrichment; (4) `doc/overview/README.md` restructure; (5) the centerpiece guide; (6) handbook + templates README updates. License headers applied via `scripts/add-header-location.sh`; markers verified before merge. The doc-distribution guard (CI) is the merge gate. No feature flags, no runtime rollout — docs are live on merge. Communication: note the new guide in `doc/00-index.md`-adjacent discoverability (if applicable within scope) and via the handbook forward-pointer.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no existing data migrated. The `inception-state.yaml` ships as a template only; projects instantiate it when they run inception.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — templates and the guide contain placeholders and structural guidance only; no personal or user data is captured. The guide references a `.env.example` convention as documentation of the practice, but authoring such a file is out of scope here.

## 21. SECURITY REVIEW HIGHLIGHTS

N/A — documentation/templates only; no secrets, credentials, or executable surfaces. Templates carry no real values.

## 22. MAINTENANCE & OPERATIONS IMPACT

Ongoing cost: keeping the catalog/matrix in the guide aligned with the handbook mirror, and the templates README aligned with the template set. The no-ghost-references AC (NFR-5) and doc-distribution guard (NFR-1) provide automated regression coverage. When GH-71 automates the process, the guide becomes the behavior reference and must stay the source of truth for the catalog.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Inception | The up-front process that produces the project knowledge base agents deliver against. |
| Knowledge base (KB) | The set of overview/spec/rules/decision docs that makes autonomous delivery possible. |
| Capture-don't-run | Principle that inception captures outputs of product discovery (if provided) rather than running interviews/experiments itself. |
| Two-track model | Track A (product context) + Track B (engineering setup), converging at Phase 2 and Phase 6. |
| Human gate | A per-phase human approval required before proceeding; non-negotiable for inception. |
| Anti-sycophancy | A structured adversarial prompt (devil's advocate, pre-mortem, alternative comparison, unknown-unknowns, four-risk) applied in decision-dense phases. |
| OST | Opportunity Solution Tree — Outcome → Opportunities → Solutions → Experiments. |
| JTBD | Jobs To Be Done — the "job" a user hires a product for. |
| NSM | North Star Metric — the one metric best capturing user value, with guardrails. |
| Four-risk | Value, Usability, Feasibility, Viability — the risk lenses applied to inception decisions. |
| Full-Stack Environment | A 10-attribute checklist of AI-friendly project characteristics, audited in Phase 3. |
| Material inventory | The Phase 0 mapping of user-provided inputs to the phases they inform. |
| Conditional artifact | An inception artifact produced only for certain project types (e.g., UX artifacts for UI-bearing projects). |

## 24. APPENDICES

### Appendix A — New template manifest (17)

| Category | Template |
|----------|----------|
| Engineering (9) | `architecture-overview-template.md`, `tech-stack-template.md`, `glossary-template.md`, `roadmap-engineering-template.md`, `ubiquitous-language-template.md`, `repo-analysis-template.md`, `inception-summary-template.md`, `inception-state-template.yaml`, `material-inventory-template.md` |
| Product discovery (3) | `opportunity-solution-tree-template.md`, `project-prd-template.md`, `persona-jtbd-template.md` |
| UX (3) | `user-journey-template.md`, `screen-inventory-template.md`, `ux-guidance-template.md` |
| Risk & assumption (2) | `assumption-register-template.md`, `risk-register-template.md` |

### Appendix B — Operational overview file set (from ticket)

| File | Classification |
|------|----------------|
| `01-north-star.md` | Recommended |
| `02-roadmap.md` | Recommended |
| `architecture-overview.md` | Recommended |
| `tech-stack.md` | Recommended |
| `glossary.md` | Recommended |
| `opportunity-solution-tree.md` | Conditional (if discovery done) |
| `user-journeys.md` | Conditional (UI project) |
| `screen-inventory.md` | Conditional (UI project) |
| `ux-guidance.md` | Conditional (UI project) |
| `ubiquitous-language.md` | Optional (DDD) |

### Appendix C — `doc/inception/` workspace skeleton

```text
doc/inception/
├── README.md          # workspace purpose + structure + lifecycle
├── inputs/README.md   # user-provided materials
├── meetings/README.md # inception meeting notes (brief)
└── analysis/README.md # agent intermediate analysis (material-inventory, assumptions, risks, repo-analysis, tribal-knowledge)
```

(No live `inception-state.yaml` / `inception-summary.md` here — those are templates under `doc/templates/`, instantiated when a project runs inception.)

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | Juliusz Ćwiąkalski | Initial specification |

---

## AUTHORING GUIDELINES

- Sources of truth: GitHub issue #69 (authoritative AC + scope); `.ai/local/inception/full-inception-bootstrap-process.md` (§2 catalog, §3 phases, §4 legacy diffs, §5 matrix, §6 anti-sycophancy, §7 state schema, §9 out-of-scope, §10 principles); `.ai/local/inception/inception-process-diagrams.md` (the 4 Mermaid diagrams to embed); `.ai/local/inception/README.md` (reading guide).
- Conventions mirrored: `doc/templates/north-star-template.md`, `persona-template.md`, `README.md`; `doc/overview/README.md`; `doc/documentation-handbook.md`; `doc/changes/.../chg-GH-67-spec.md` (front-matter style).
- This is a documentation/templates/guide change: no code, no agent prompts, no CI logic. License headers via `scripts/add-header-location.sh` only; `ados_distribution` per ODR-0001.
- The guide must be self-contained (DEC-7): all needed content is embedded; it never links into `.ai/local/`.
- Scope kept to GH-69 (inception:1); automation (GH-71), legacy (GH-72), layered planning (GH-68), and self-host (GH-70) are explicitly out of scope.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-69)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step coding tasks)
- [x] No content duplicated from linked docs (guide content is summarized structurally, not pre-written)
- [x] Front matter validates per front_matter_rules
