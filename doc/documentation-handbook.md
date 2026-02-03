---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/documentation-handbook.md
id: DOC-HANDBOOK
status: Accepted
created: 2025-09-22
last_updated: 2025-12-17
owners: ["engineering"]
summary: "Repository documentation structure, conventions, and workflow."
---

# Documentation Handbook - Structure, Conventions & Workflow (Per-Repository Standard)

> **Audience:** Engineers, product/design, operators, and AI coding/analysis agents.
>
> **Goal:** A single, predictable docs layout that scales across _all_ repositories (UI apps, microservices, libraries),
> is easy for humans to navigate, and is highly effective for AI agents to find the right context and write/update specs.

---

## 1) Where this document lives

- **Path in every repo:** `doc/documentation-handbook.md`
- **Linked from:**
  - `/README.md` → add a short **“Docs at a glance”** section linking here and to `doc/00-index.md`.
  - `doc/00-index.md` → add a prominent link **“Documentation Handbook (how docs work)”**.

> Keep _this_ file identical across repos. Treat it as **shared** (see §10) with your chosen sync mechanism (
> submodule/subtree/automation).

---

## 2) Principles

1. **Separation of Concerns:**
   - Humans primarily read and write under `/doc`.
   - OpenCode tooling (agents/commands) lives under `/.opencode`.
   - Repo-specific agent instructions live under `/.ai/agent`.
   - Local agent context lives under `/.ai/local` and is git-ignored.
2. **Single Source of Truth:** Contracts (OpenAPI/AsyncAPI/schemas) are canonical under `/doc/contracts` in the **owning
   ** repo; consumers pull them as versioned artifacts.
3. **Evolution is Trackable:** New behavior starts as a **Change** (`/doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`), settles with an **ADR**, and
   updates the **Spec** (`/doc/spec`).
4. **Predictable Conventions:** Numbering, front-matter, and naming are consistent and enforced by lightweight checks.

---

## 3) Repository Layout (Standard Tree)

```text
/README.md                        # Short repo intro + quick links to doc/
/CONTRIBUTING.md                  # PR/MR rules, coding & docs conventions
/CHANGELOG.md                     # Keep a Changelog style (optional)

/.opencode/                         # OpenCode agents + commands (repo-local tooling)
  /agent/                           # One file per agent prompt
  /command/                          # Repeatable commands/macros

/.ai/                               # Repo-specific agent config + local context
  /agent/                            # Repo-specific agent instructions (committed)
  /local/                            # Local agent context (git-ignored)
  /rules/                            # Optional org-wide rules

/doc/
  00-index.md                      # Manual TOC + “For humans”/“For AI agents” entry points
  /guides/                         # Developer how-to guides (local setup, tooling, debugging)
  /overview/
    01-north-star.md               # Repo-appropriate extract if not the product root
    02-roadmap.md                  # High-level phases + links to changes/ADRs
    architecture-overview.md       # C4/mermaid overview diagrams
    glossary.md                    # See §9 for scope
    ubiquitous-language.md         # See §9 for scope
  /spec/                           # Current truth (coherent, post-change)
    features/                      # Feature-level specs (UI or service)
    api/                           # Endpoint/operation descriptions (human layer)
    nonfunctional.md               # Perf, security, scalability envelopes
  /changes/                        # Proposed & accepted changes (evolution log)
    YYYY-MM/
      YYYY-MM-DD--<workItemRef>--<slug>/
        chg-<workItemRef>-spec.md       # Canonical change spec (with front-matter)
        chg-<workItemRef>-test-plan.md  # Per-change test plan (traceable to AC)
        chg-<workItemRef>-plan.md       # Implementation plan (phases/tasks)
        chg-<workItemRef>-pm-notes.yaml # PM progress + decisions + open questions
        chg-<workItemRef>-notes.md      # Optional free-form notes
  /adr/                            # Architecture Decision Records
    ADR-0001-short-title.md
  /contracts/
    rest/
      openapi.yaml                 # Can be generated; is canonical in owning repo
      examples/                    # HTTP request/response samples
    events/
      asyncapi.yaml                # Event catalog; channels, messages, bindings
      schemas/                     # JSON Schema / Avro for event payloads
    data/
      schemas/                     # DB/Dynamo/ES schemas (if applicable)
  /domain/
    ubiquitous-language.md         # (Mirrors /overview file or links to global)
    aggregates-and-entities.md     # Domain model at rest
    events-catalog.md              # Business events (domain perspective)
  /quality/
    test-specs/                    # Tessa’s output; manual/automated test specs
    performance/                   # Perf test plans & SLAs
    security/                      # Threat model (STRIDE/LINDDUN), controls
  /ops/
    runbooks/                      # On-call playbooks
    observability/                 # Metrics, logs, traces, dashboards
    troubleshooting/               # Known issues, fixes, log signatures
    incident-reviews/              # Post-incident docs (blameless)
  /analytics/
    tracking-taxonomy.md           # App/UX events mapping (UI repos esp.)
  /i18n/                           # Translation notes, error terms (UI repos)
  /diagrams/                       # Mermaid/PlantUML sources; exported PNG/SVG
  /examples/                       # Payloads, fixtures, UI mocks (shared samples)
  /templates/                      # ADR, change, feature, test, MR templates
  /prompts/                        # Human-facing generation prompts (copy/UX)

/scripts/
  doc/
    doc-checks.sh                    # Lints front-matter, numbering, links
    build-docs.sh                    # Optional mkdocs/docusaurus export
```

---

## 4) Folder-by-Folder Guide

### 4.1 `/.ai/` (for Agents)

- **`/agent/`**: Repo-specific instructions that agents must follow (committed).
- **`/local/`**: Local-only agent context (git-ignored). Never commit content from here.
- **`/rules/`**: Optional rules such as the spec workflow, naming conventions, review criteria.

### 4.1a `/.opencode/` (OpenCode tooling)

- **`/agent/`**: Agent prompts.
- **`/command/`**: CLI commands that compose agents.

  ```md
  # coding-agent-index.md (excerpt)

  ## Implementing a change

  Load these paths:

  - `/doc/changes/**/chg-<workItemRef>-spec.md` # Current change spec
  - `/doc/adr/**` # Any referenced ADRs from the spec
  - `/doc/spec/**` # Affected features/api sections
  - `/doc/contracts/rest/openapi.yaml` # If HTTP endpoints change
  - `/doc/contracts/events/**` # If events are added/modified
  - `/doc/quality/test-specs/**` # To align with tests
  ```

> **Why:** Agents become deterministic and fast by loading _only_ the relevant context.

---

### 4.2 `/doc/` (for Humans, yet agent-friendly)

- **`00-index.md`**: Landing page for docs. Include:
  - “Start here” (overview, architecture, current spec)
  - “Changing behavior?” (how to write a change)
  - “For AI agents” (link to `/.ai/context-maps/coding-agent-index.md`)

- **`/overview/`**:
  - `01-north-star.md` and `02-roadmap.md`: Keep concise, repo-relevant extracts (if the full product vision lives
    elsewhere, link to it).
  - `architecture-overview.md`: High-level C4/mermaid; link to `/doc/diagrams` for sources.
  - `glossary.md` vs `ubiquitous-language.md`: **See §9** for the difference and usage.

- **`/spec/`**:
  The coherent, up-to-date description of the system **after** applying accepted changes. Split into `features/`,
  `api/`, and a single `nonfunctional.md` (SLOs, auth, rate limits, perf goals).

- **`/guides/`**:
  Practical, step-by-step developer guides for common tasks. This is the home for "how-to" documentation, such as local
  environment setup, debugging procedures, and using repository-specific tooling (e.g., AI-powered MR helpers). While
  `/ops/runbooks` are for on-call procedures, `/guides` are for day-to-day development workflows.

- **`/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`**:
  - `chg-<workItemRef>-spec.md` (required): The proposal accepted change (CHANGE SPEC).
  - `chg-<workItemRef>-test-plan.md` (recommended): Per-change test plan aligned to the CHANGE SPEC.
  - `chg-<workItemRef>-plan.md` (recommended): Work breakdown, risks, rollout/rollback (IMPLEMENTATION PLAN).
  - `chg-<workItemRef>-pm-notes.yaml` (recommended): PM progress + decisions + open questions.
  - `examples.json` (optional): Requests/responses, UI screenshots links.

- **`/adr/ADR-####-short-title.md`**: Final decisions. A change may produce 0..n ADRs. Link them both ways:
  - From the change front-matter: `links.adr: ["ADR-0021"]`
  - From the ADR: reference the `workItemRef` in the body or via front-matter `links.related_changes`.

- **`/contracts/`**:
  - `rest/openapi.yaml`: HTTP contracts (server = owner). Generated clients should come from this file’s versioned
    release.
  - `events/asyncapi.yaml` + `events/schemas/`: Event channels and payload types. **Producer owns the event**.
    Consumers align via versioned schemas.
  - `data/schemas/`: Schema docs for databases/collections/tables (for operators & migration planning).

- **`/domain/`**:
  - `ubiquitous-language.md`: The authoritative terms for this **bounded context**.
  - `aggregates-and-entities.md`: Classifies aggregates, entities, value objects.
  - `events-catalog.md`: Business/domain events (their meaning, not transport details).

- **`/quality/`**:
  - `test-specs/` (Tessa output + human additions, organized by feature as `test-spec-<feature-slug>.md` (e.g., `test-spec-tenants.md`))
  - `performance/` (perf test plans, load profiles, thresholds)
  - `security/` (threat model, mitigations, test procedures)

- **`/ops/`**:
  - `runbooks/` (operational procedures)
  - `observability/` (dashboards, metrics, log fields, trace spans)
  - `troubleshooting/` (known issues, queries, checklists)
  - `incident-reviews/` (postmortems)

- **`/analytics/`**: Tracking taxonomy & mapping to GA/PostHog (mostly UI repos).
- **`/i18n/`**: Internationalization specifics (UI repos).
- **`/diagrams/`**: Source first (mermaid/PUML), plus exported artifacts.
- **`/examples/`**: Cross-cutting example payloads & mocks.
- **`/templates/`**: All authoring templates (ADR, change spec, feature spec, test spec, MR template).
- **`/prompts/`**: Human-facing content prompts (marketing copy, release notes). Agent system prompts remain in
  `/.ai/agents/`.

---

### 4.3 `/scripts/doc`

- **`doc-checks.sh`**: Lints front-matter and file naming, checks cross-links.
- **`build-docs.sh`**: Optional static site build (mkdocs + mermaid plugin recommended).

---

## 5) Front‑Matter & Naming

Use front-matter on **every** doc under `/doc` so humans & agents can parse metadata.

```yaml
---
id: GH-456 # or ADR-0021, SPEC-UNITS-DISPLAY, etc.
status: Proposed # Proposed | Accepted | Rejected | Superseded | Deprecated
created: 2025-09-05
last_updated: 2025-09-05
owners: ["juliusz"]
service: "recipes-service" # or "ui-app"
links:
  adr: ["ADR-0021"]
  supersedes: []
  related_changes: ["GH-455"]
  contracts:
    - "contracts/rest/openapi.yaml#/paths/~1recipes~1search"
summary: "Unify units display across UI using unit IDs + i18n."
---
```

**Change conventions:**

- Folder: `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`.
- Filenames are stable and slug-free:
  - `chg-<workItemRef>-spec.md`
  - `chg-<workItemRef>-test-plan.md`
  - `chg-<workItemRef>-plan.md`
  - `chg-<workItemRef>-pm-notes.yaml`
- `workItemRef` is tracker-linked (e.g., `PDEV-123`, `GH-456`).
- ADRs: `ADR-####-short-title.md` with zero-padded 4-digit numbers.
- Kebab-case filenames, short and descriptive.

---

## 6) Lifecycle: From Change → ADR → Spec → Contracts

1. **Propose a change** in `/doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/chg-<workItemRef>-spec.md` (or via `/write-spec <workItemRef>`).
2. **Discuss & revise** until Accepted/Rejected.
3. **If the change settles a decision**, write an ADR under `/doc/adr/` (or use `/plan-decision` + `/write-adr`) and link it from the change.
4. **Create or update the per-change TEST PLAN** alongside the spec as `chg-<workItemRef>-test-plan.md` (or via `/write-test-plan <workItemRef>`).
5. **Create or update the IMPLEMENTATION PLAN** alongside the spec as `chg-<workItemRef>-plan.md` (or via `/write-plan <workItemRef>`).
6. **Update `/doc/spec/`** to reflect the _final_, coherent behavior (ideally via `/sync-docs <workItemRef>`).
7. **Update `/doc/contracts/`** (OpenAPI/AsyncAPI/schemas) if any external surface changes.
8. **Align test specs** under `/doc/quality/test-specs/` with the per-change TEST PLAN.
9. **Implementation**: code + tests, referencing the change ID in commit/PR titles.
10. **Release notes**: Use `/doc/prompts/` to generate drafts, then publish.

> Agents: see `/.ai/context-maps/coding-agent-index.md` to load only relevant docs for each step.

---

## 7) How Humans Work with the Docs

- **New feature/behavior:** start with a Change spec (template in `/doc/templates/`).
- **Decision needed:** author an ADR; link it to the Change.
- **Keep Spec fresh:** any merged change must update `/doc/spec/` in the same PR.
- **Contracts:**
  - If you own the API/event: edit `/doc/contracts/**`, bump version, regenerate clients.
  - If you consume it: update the dependency version; never hand-edit owned contracts.
- **Ops knowledge:** add runbooks/troubleshooting as you learn.
- **Review checklist:** PRs must include updated docs or an explicit N/A with rationale.

---

## 8) How AI Agents Use the Docs

- **Plan & Implement:** load the current Change spec, referenced ADRs, impacted Spec sections, Contracts, and testing strategy per
  `/.ai/context-maps/coding-agent-index.md` and `.opencode/command/*.md`.
- **Write artifacts to the right place:**
  - Implementation plan -> `/doc/changes/**/chg-<workItemRef>-plan.md` (or via `/write-plan <workItemRef>`)
  - Per-change TEST PLAN -> `/doc/changes/**/chg-<workItemRef>-test-plan.md` (or via `/write-test-plan <workItemRef>`)
  - PM progress notes -> `/doc/changes/**/chg-<workItemRef>-pm-notes.yaml`
  - Broader test specs -> `/doc/quality/test-specs/`
  - Updated OpenAPI/AsyncAPI -> `/doc/contracts/**`
  - Final edits to `/doc/spec/**` per the change outcome (ideally via `/sync-docs <workItemRef>`)

- **Cross-linking:** update front-matter `links.*` so the web of docs stays navigable.

---

## 9) Glossary vs Ubiquitous Language (UL)

**Ubiquitous Language (DDD):**

- A precise, **bounded-context** vocabulary used by domain experts and developers.
- Names the **core domain concepts** (Aggregates, Entities, Value Objects, Domain Events) and their relationships.
- **Normative**: terms here are _binding_ within this context.
- Location: `/doc/overview/ubiquitous-language.md` (and mirrored under `/doc/domain/` if you prefer domain-centric
  grouping).

**Glossary:**

- A broader, **reader-friendly** list of terms and acronyms used in this repository.
- Includes general tech acronyms (e.g., P90, SLO, JWT), business abbreviations, and any terms that are _not_ part of the
  domain model but appear in docs/specs.
- **Descriptive**: helps new readers; not necessarily binding as model terms.
- Location: `/doc/overview/glossary.md`.

**Global vs Local:**

- Keep a **global UL** (product-level, authoritative across all repos) in a central product docs repo; each repo keeps a
  **local UL** that either mirrors the global terms relevant to this bounded context or refines them for this context (
  without contradictions).
- Keep a **global Glossary** for organization-wide acronyms/terms; each repo may keep a **local Glossary** for
  repo-specific terms.

> Rule of thumb: If a term names a domain model element or behavior, it belongs in **UL**. If it explains an acronym,
> tool, or a non-model concept, it belongs in the **Glossary**.

---

## 10) Multi‑Repo: Shared vs Repo‑Specific (and Sync)

The table below indicates what is **shared across repos** (kept identical or centrally managed), what is **domain-scoped
** (shared across a subset), and what is **repo-specific**.

| Area                               | Location                               | Scope                                | Ownership         | Sync Mechanism                                             |
| ---------------------------------- | -------------------------------------- | ------------------------------------ | ----------------- | ---------------------------------------------------------- |
| Documentation Handbook (this file) | `doc/documentation-handbook.md`        | **Shared (global)**                  | Platform/Product  | Git submodule/subtree; automated sync                      |
| Templates (ADR/Change/Test/MR)     | `doc/templates/`                       | **Shared (global)**                  | Platform/Product  | Submodule/subtree; versioned                               |
| AI Rules & Agents                  | `/.ai/rules/`, `/.ai/agents/`          | **Shared (global)**                  | Platform/Product  | Submodule/subtree; versioned                               |
| Context Maps                       | `/.ai/context-maps/`                   | **Shared baseline + local overlays** | Each repo         | Ship a base file globally; allow repo to extend            |
| Ubiquitous Language (Global)       | Central product docs repo              | **Shared (global)**                  | Domain leadership | Single source; repos link/mirror needed parts              |
| Ubiquitous Language (Local)        | `/doc/overview/ubiquitous-language.md` | **Repo (bounded context)**           | Repo owners       | Local file; must not contradict global                     |
| Glossary (Global)                  | Central product docs repo              | **Shared (global)**                  | Docs team         | Single source; repos may link                              |
| Glossary (Local)                   | `/doc/overview/glossary.md`            | **Repo**                             | Repo owners       | Local file                                                 |
| ADRs (Cross‑cutting)               | `/doc/adr/`                            | **Domain-scoped** (affected repos)   | Decision owner(s) | Copy or link to affected repos; reference canonical source |
| ADRs (Local)                       | `/doc/adr/`                            | **Repo**                             | Repo owners       | Local                                                      |
| Contracts (OpenAPI/AsyncAPI)       | `/doc/contracts/**`                    | **Owner = producer repo**            | Service owner     | Consumers import versioned artifact; do not fork           |
| Data Schemas                       | `/doc/contracts/data/`                 | **Repo**                             | Service owner     | Local (unless explicitly shared DB)                        |
| Domain Model Docs                  | `/doc/domain/**`                       | **Repo**                             | Repo owners       | Local with links to global UL                              |
| Quality/Test Specs                 | `/doc/quality/**`                      | **Repo**                             | Repo owners       | Local                                                      |
| Ops Runbooks                       | `/doc/ops/**`                          | **Repo**                             | SRE/Team          | Local                                                      |
| Analytics Taxonomy                 | `/doc/analytics/**`                    | **Domain-scoped** (UI apps)          | Product Analytics | Shared baseline + app overlays                             |

### Notes & Patterns

- **ADRs:** If an ADR affects multiple repos, keep a **canonical ADR** in the _decision’s home repo_ (or a central
  “architecture” repo) and replicate a copy (or link) to affected repos. Each copy should include a header referencing
  the canonical source and version.
- **Events & Schemas:** The **producer** is the single source of truth. Publish schemas as versioned artifacts (
  npm/maven/container images/docs package). Consumers **import** instead of copying.
- **Global Docs**: For UL, Glossary, templates, and AI rules/agents, prefer a **single central repo** and sync to all
  service repos via submodule/subtree or automation.

---

## 11) Ownership & Governance

- **Change specs**: authored by implementers or product; approved by tech lead/product.
- **ADRs**: authored by decision owner(s); approved by architecture reviewers.
- **Spec**: maintained by the feature owners; must be updated in the same PR as the change.
- **Contracts**: owned by the producer repo; versioned (SemVer); published artifacts.
- **UL/Glossary**: global maintained by domain leadership/docs; local by repo owners.

---

## 12) Quickstart Checklists

### New Feature/Change

- [ ] Create `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/chg-<workItemRef>-spec.md` from template or via `/write-spec <workItemRef>`.
- [ ] Add front-matter; link related ADRs/contracts.
- [ ] Create/Update per-change TEST PLAN as `chg-<workItemRef>-test-plan.md` (or via `/write-test-plan <workItemRef>`), then align broader test specs under `/doc/quality/test-specs/` to it.
- [ ] Create/Update IMPLEMENTATION PLAN as `chg-<workItemRef>-plan.md` (or via `/write-plan <workItemRef>`).
- [ ] Update `/doc/contracts/**` if surfaces change; bump version.
- [ ] Update `/doc/spec/**` to reflect final behavior (ideally via `/sync-docs <workItemRef>`).
- [ ] Ensure `/scripts/doc-checks.sh` passes.

### New Cross‑cutting Decision

- [ ] Draft ADR in home repo (or central arch repo).
- [ ] Cross-link impacting changes.
- [ ] Replicate/link ADR to affected repos with canonical reference.

### New Event/Schema

- [ ] Update `events/asyncapi.yaml` + `events/schemas/` in producer repo.
- [ ] Version bump & publish artifact.
- [ ] Notify consumers; update dependency versions.

---

## 13) Examples

### 13.1 Example Change Folder

```
/doc/changes/2026-01/2026-01-22--GH-456--units-unified-display/
  chg-GH-456-spec.md
  chg-GH-456-test-plan.md
  chg-GH-456-plan.md
  chg-GH-456-pm-notes.yaml
  chg-GH-456-notes.md
  examples.json
```

**`chg-GH-456-spec.md` (excerpt):**

```markdown
---
id: GH-456
status: Accepted
created: 2025-09-05
owners: ["juliusz"]
links:
  adr: ["ADR-0021"]
  contracts: ["contracts/rest/openapi.yaml#/paths/~1items~1display"]
summary: "Unify units display across UI using unit IDs + i18n with pluralization."
---

## Problem

Currently unit display is inconsistent across screens…

## Solution

- Introduce a `UnitDisplay` component reading i18n keys `units.<unitId>`…
- Add fallback rules for unknown units…

## Acceptance

- Given an item with unitId `bottle` and amount `1`…
```

### 13.2 Example ADR

```
/doc/adr/ADR-0021-unified-units-display.md
```

**ADR (excerpt):**

```markdown
---
id: ADR-0021
status: Accepted
created: 2025-09-05
links:
related_changes: ["GH-456"]
---

# Decision

We standardize UI unit rendering via `UnitDisplay` component and i18n keys…
```

### 13.3 Example Contracts Snippets

**OpenAPI (excerpt):**

```yaml
openapi: 3.0.3
paths:
  /recipes/search:
    get:
      operationId: searchRecipes
      parameters:
        - name: q
          in: query
          schema: { type: string }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SearchResult"
```

**AsyncAPI (excerpt):**

```yaml
asyncapi: 2.6.0
channels:
  recipe.created:
    publish:
      message:
        $ref: "#/components/messages/RecipeCreated"
```

### 13.4 Example Context Map (Agent)

```md
# coding-agent-index.md

## When implementing an HTTP change

Load:

- /doc/changes/_xx/\*\*/<N>-_-spec.md
- /doc/adr/\*\*
- /doc/spec/api/\*\*
- /doc/contracts/rest/openapi.yaml
- /doc/quality/test-specs/\*\*
```

---

## 14) Tooling & Automation

- **`/scripts/doc-checks.sh`** should validate:
  - Front-matter presence and required keys.
  - Change folder and file naming:
    - Folder: `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`
    - Files: `chg-<workItemRef>-spec.md`, `chg-<workItemRef>-test-plan.md`, `chg-<workItemRef>-plan.md` (and optionally `chg-<workItemRef>-pm-notes.yaml`).
    - ADRs: `ADR-####-short-title.md`.
  - No broken relative links in `/doc/**`.
  - Traceability: acceptance criteria in `chg-<workItemRef>-spec.md` are covered by `chg-<workItemRef>-test-plan.md`.
  - If a change is `Accepted`, Spec sections it touches were updated.
- **Docs site (optional):** Use `mkdocs` + `mkdocs-mermaid2-plugin` for a searchable site in CI.

---

## 15) FAQs

**Q: When does a term go to UL vs Glossary?**  
A: If it names domain model elements/behaviors → **UL**. If it’s an acronym, tool, or general term → **Glossary**. When
in doubt, add to Glossary and propose an UL entry if it becomes model-relevant.

**Q: Should ADRs be everywhere?**  
A: Only in repos impacted by the decision. Keep one canonical ADR and replicate/link where needed.

**Q: Where do I put “how to fix X error”?**  
A: `/doc/ops/troubleshooting/`.

**Q: Where do I put UX copy prompts?**  
A: `/doc/prompts/`. Agent system prompts belong in `/.ai/agents/`.

**Q: Who owns OpenAPI/AsyncAPI?**  
A: The **producer** (the service that exposes the API or publishes the event). Consumers import versioned artifacts.

---

## 16) Invariants & Style Guide

- Write in **present tense** for Spec (it describes current truth).
- One concern per doc; keep files short; link out liberally.
- Prefer mermaid/PUML sources for diagrams; commit generated images.
- Always cross-link Change ↔ ADR ↔ Spec ↔ Contracts via front-matter `links.*`.
- Docs update is **part of the PR**; code without docs is not done.

---

## 17) Appendix: Template Index

- `doc/templates/change-spec-template.md`
- `doc/templates/adr-template.md`
- `doc/templates/feature-spec-template.md`
- `doc/templates/test-spec-template.md`
- `doc/templates/mr-template.md`

(Keep these **shared** and versioned; link to canonical sources.)

---

### End of Handbook
