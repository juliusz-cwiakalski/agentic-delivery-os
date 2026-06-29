---
ados_distribution: project-generated
id: CHG-GH-90
links:
  decisions: []
  spec: ["doc/spec/features/feature-document-templates.md"]
  changes: ["GH-73", "GH-69", "GH-71", "GH-72"]
change:
  ref: GH-90
  type: docs
  status: Proposed
  slug: architecture-module-governance
  title: "[inception:6] Architecture overview: module governance (residence, layering, contracts)"
  owners: ["Juliusz Ćwiąkalski"]
  service: inception-templates
  labels: ["inception", "templates", "architecture", "module-governance"]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["architecture-overview-template", "repo-analysis-template", "project-inception-guide", "doc-templates-README", "documentation-handbook"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the architecture overview template from an *inventory* (what modules exist) into *governance* (the rules that govern them) so an AI delivery team can deterministically place a new capability in the right module and stub/mock the right module boundaries — closing the M1–M5 modularization gaps surfaced by the inception review.

## 1. SUMMARY

This change enriches `doc/templates/architecture-overview-template.md` with five module-governance sections — **module-residence rules**, **dependency-direction / layering matrix**, **lightweight internal interface contracts**, an **optional feature→component ownership map**, and **module-boundary heuristics** — each shipped with concrete, AI-actionable placeholder examples. It aligns `doc/templates/repo-analysis-template.md`'s module/component map to the same governance dimensions so legacy reconstruction populates the identical fields, and it adds a minimal reference to the new sections in `doc/guides/project-inception.md` Phase 3.

It is a focused, additive **template + guide** change: no agent prompts, no bootstrapper workflow, no enforcement tooling, and no formal decision record. The layering/dependency-direction matrix is *example scaffolding* for project-specific inception fills, not a precedent-setting ADOS-wide architectural decision; its design rationale is captured within this spec. The core success criterion is **AI-actionability** — every governance section must be concrete enough for `@coder` and `@spec-writer` to apply, not vague prose.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `architecture-overview-template.md` (62 lines, `ados_distribution: redistributable`, `id: ARCHITECTURE-OVERVIEW`) captures **what exists**: C4 L1 system context, C4 L2 container diagram, a flat **Components** table (`Component | Container | Responsibility`), data flow, external dependencies, deployment topology, key decisions, and constraints/uncertainty flags. It is a navigation aid, not a rule set.
- `repo-analysis-template.md` (legacy Phase-0 reconnaissance, `id: REPO-ANALYSIS`) ships a flat **Module / component map** (`Module | Responsibility`) plus layout, stack, entry points, data flow, external deps, debt, and a confidence column (the discipline the tribal-knowledge template mirrors — its structural sibling per GH-72).
- `project-inception.md` Phase 3 ("Tech stack & architecture") references the architecture-overview template generically (activity 4 + output) but names only the inventory facets (C4, components, data flow, external deps, deployment, decisions, uncertainty).
- The template spec `doc/spec/features/feature-document-templates.md` treats templates generically (structure-only + graceful fallback). Adding governance sections does **not** conflict with it; its Core Components table predates the GH-69 inception templates and does not enumerate architecture-overview/repo-analysis — a pre-existing inventory gap, not one created here.
- The templates already carry `ados_distribution: redistributable` and license headers; CI enforces them via `scripts/.tests/test-doc-distribution.sh`.

### 2.2 Pain Points / Gaps

Inception review Axis 1 (`.ai/local/inception/review-2026-06-29-findings.md`) verdict: **inventory, not governance**. Five gaps drive this change:

| # | Gap | Impact |
|---|-----|--------|
| M1 | No module-residence rules — nothing tells `@coder`/`@spec-writer` which module owns a new capability. | High misplacement risk; review churn |
| M2 | No dependency-direction / layering rules — no allowed/forbidden matrix between modules. | Architectural drift; AI introduces cyclic/layering violations |
| M3 | No internal interface contracts — external deps are captured, but not contracts *between* internal modules. | Agents can't mock/stub correctly; integration tests guess boundaries |
| M4 | Components are a flat table, not a map — no feature→component ownership. | Every change re-derives "where does this go" |
| M5 | No module-boundary heuristics (cohesion/coupling, when to split). | Inconsistent modularization over time |

For a human team this is tolerable; for an AI team placing hundreds of changes it produces entropy: misplaced code, layering violations, and guessed mock boundaries.

## 3. PROBLEM STATEMENT

Because the architecture and repo-analysis templates capture *which* modules exist but not the *rules that govern* them, an AI delivery team placing hundreds of changes cannot deterministically decide where a new capability's code belongs, which dependencies are allowed or forbidden, or what crosses each module boundary — resulting in misplaced code, layering violations, and guessed mock/stub boundaries that compound into architectural drift and review churn.

## 4. GOALS

- **G-1**: Convert the architecture overview from inventory to governance by adding residence, layering, contracts, ownership, and boundary-heuristic sections.
- **G-2**: Make the governance **AI-actionable** — `@coder` can place a new capability in the right module; `@spec-writer`/`@test-plan-writer` can stub/mock the right boundaries — using concrete rules, not prose.
- **G-3**: Align legacy reconstruction (`repo-analysis-template`) to the *same* governance dimensions so greenfield and legacy fills populate identical fields.
- **G-4**: Keep the template lean and preserve the redistributable marker, license headers, and the doc-distribution gate.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Governance sections present in `architecture-overview-template.md` | 5/5 (residence, layering, contracts, ownership-map, heuristics) |
| Governance sections with ≥1 concrete AI-actionable placeholder example | 5/5 |
| `repo-analysis-template.md` module-map columns shared with architecture-overview governance fields | All new governance dimensions mirrored |
| `project-inception.md` Phase 3 references to governance facets | ≥1 (residence/layering/contracts/ownership/heuristics) |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 |
| Pre-existing template sections/columns removed or renamed | 0 (purely additive) |

### 4.2 Non-Goals

- **NG-1**: A full, versioned contract-registry system — contracts are deliberately lightweight here (a richer registry is a follow-on).
- **NG-2**: Enforcement tooling (dependency-cycle linter, import checker, etc.) — template + guidance only.
- **NG-3**: Any `.opencode/agent/**` edits or bootstrapper-workflow changes — this is a template + guide change; the `@toolsmith` rule does **not** apply.
- **NG-4**: Rewriting Phase 3 of `project-inception.md` — only a minimal reference is added.
- **NG-5**: A formal ADR/PDR — the layering matrix is example scaffolding, not a precedent-setting ADOS decision.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Module-residence rules section (M1) | Lets an agent resolve capability-type → owning module/path pattern instead of guessing placement |
| F-2 | Dependency-direction / layering matrix section (M2) | States allowed/forbidden dependencies between named layers with a direction invariant, preventing cyclic/layering violations |
| F-3 | Lightweight internal interface contracts section (M3) | Names each inter-module boundary's signature + return/error shape so agents can mock/stub correctly |
| F-4 | Feature→component ownership map section, OPTIONAL (M4) | One-hop lookup from a feature to its owning component(s); optional for small repos |
| F-5 | Module-boundary heuristics section (M5) | Concrete cohesion/coupling split/merge triggers for consistent modularization over time |
| F-6 | repo-analysis-template governance alignment | Legacy reconstruction populates the same governance fields as the greenfield architecture overview |
| F-7 | project-inception.md Phase 3 governance reference | Inception activity directs authors to fill the governance sections |

### 5.1 Capability Details

**F-1 — Module-residence rules (M1).** A capability-type → owning-module/path-pattern table plus a one-line rule. The placeholder example must demonstrate actionability: *"new API endpoint → `src/api/` module"*, *"new domain rule → `src/domain/<context>/`"*, *"new CLI command → `src/cli/commands/`"*. The rule: place new code by capability type, not by guess; when a capability type is unlisted, add a row before placing the code.

**F-2 — Dependency-direction / layering matrix (M2).** Named layers in tier order (default example: presentation → application → domain → infrastructure) with an explicit allowed/forbidden matrix between them and a stated dependency-direction invariant: *dependencies point DOWN the tier list; no upward or sideways cycles*. The canonical example: *"API layer may import domain layer; domain layer may NOT import API layer."* The template notes the tier names are an example to adapt to the project's architecture while preserving the invariant.

**F-3 — Internal interface contracts, lightweight (M3).** A table of named boundaries, each with an operation, a signature, a return shape, and an error shape — lightweight, not a versioned registry. The canonical example: *"interface between cart and inventory modules: `checkAvailability(sku, qty) → AvailabilityResult`"* (return `{ available: bool, onHand: int }`; error `ItemNotFound`). Scope: signature + return/error shape only.

**F-4 — Feature→component ownership map, OPTIONAL (M4).** A feature → owning component(s) table, clearly marked OPTIONAL/conditional — omit for small repos where the Components table suffices. Example: *"Checkout → cart, inventory, pricing."* One direction only (feature→component) — the lookup agents need.

**F-5 — Module-boundary heuristics (M5).** Cohesion/coupling guidance with concrete split/merge triggers: *"a module with > N responsibilities / > 1 reason to change → split by responsibility"*; *"two modules that always change together → consider merging"*; *"high cohesion within a module, low coupling across modules"*; *"a dependency mocked in >1 unrelated test → consider an interface boundary."*

**F-6 — repo-analysis-template alignment.** The existing `Module | Responsibility` map gains governance columns mirroring the architecture overview (a residence hint, a layering tier, and an interface-contract pointer), populated during legacy reconstruction at the same confidence discipline the template already enforces. Existing columns are preserved (additive).

**F-7 — Phase 3 reference.** Phase 3's architecture activity/output gains a short reference to the governance sections (residence/layering/contracts/ownership/heuristics). Minimal amendment — no rewrite of Phase 3.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Placement (where does new code land?)
  @coder/@spec-writer receives a new capability
  → reads Module-residence rules (F-1): resolve capability-type → owning module/path
  → if unlisted: add a residence row, then place
  → cross-check Dependency-direction matrix (F-2): the import is allowed (down-tier) and non-cyclic
  → place code in the owning module

Flow 2 — Boundary stub/mock (what do I fake in a test?)
  @test-plan-writer/@coder needs to isolate a module under test
  → reads Internal interface contracts (F-3): find the named boundary + signature + return/error shape
  → stub the boundary with the documented return/error shape
  → (optional) confirm owning component(s) via Feature→component map (F-4)

Flow 3 — Legacy reconstruction (repo-analysis)
  @bootstrapper ingests a legacy repo in Phase 0
  → populates the aligned module-map columns (residence hint / layering tier / contract pointer) (F-6)
  → low-confidence governance inferences are flagged for human gate confirmation (existing confidence discipline)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `architecture-overview-template.md`: add five governance sections (F-1–F-5), each with a concrete AI-actionable placeholder example.
- `repo-analysis-template.md`: align the module/component map with the governance dimensions (F-6); preserve existing columns.
- `project-inception.md` Phase 3: minimal reference to the governance sections (F-7).
- Preserve `ados_distribution: redistributable`, license headers, and the doc-distribution gate on the two templates.

### 7.2 Out of Scope

- [OUT] A versioned contract registry / contract-versioning scheme (NG-1).
- [OUT] Enforcement tooling — dependency-cycle linters, import checkers, CI gates on layering (NG-2).
- [OUT] Any `.opencode/agent/**` or bootstrapper-workflow change (NG-3).
- [OUT] Rewriting Phase 3 or any other inception phase (NG-4).
- [OUT] A formal ADR/PDR/TDR for the layering approach (NG-5).
- [OUT] Touching the template feature spec's Core Components table (pre-existing inventory gap; doc-syncer decides later).

### 7.3 Deferred / Maybe-Later

- A richer contract registry with versioning and compatibility rules (follow-on after lightweight contracts prove useful).
- Optional enforcement tooling (a dependency-direction lint hook) once governance conventions are field-tested.
- A reciprocal component→owned-features view if the one-directional map proves insufficient.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — documentation/template change.

### 8.2 Events / Messages

N/A — documentation/template change.

### 8.3 Data Model Impact

The "data model" here is the **structured content** (tables/columns) the templates carry. New/affected elements:

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Residence-rule row | `Capability type → Owning module / path pattern` (+ optional notes) |
| DM-2 | Layering tier + matrix cell | Named layer (tier) + an allowed/forbidden dependency cell between two layers |
| DM-3 | Interface-contract row | Boundary (A→B) + operation + signature + return shape + error shape |
| DM-4 | Ownership-map row | Feature → owning component(s) — OPTIONAL |
| DM-5 | Boundary-heuristic rule | A split/merge/cohesion/coupling trigger statement |
| DM-6 | repo-analysis module-map governance columns | `Residence hint`, `Layering tier`, `Interface-contract pointer` (appended to existing `Module | Responsibility`) |
| DM-7 | Existing Components table | Referenced, unchanged (additive governance sits alongside, not replacing it) |

### 8.4 External Integrations

N/A — no external APIs or services affected.

### 8.5 Backward Compatibility

Purely additive. No pre-existing section header in either template is removed or renamed; the repo-analysis module-map keeps its `Module | Responsibility` columns and appends new ones. Existing project instances of `architecture-overview.md` / `repo-analysis.md` are unaffected — the new sections follow the template's existing "omit if trivial" tone, so unfilled sections impose no obligation on already-authored docs.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | AI-actionability — each governance section ships ≥1 concrete placeholder example usable as a placement/mock decision | 5/5 sections (residence, layering, contracts, ownership, heuristics) each have ≥1 concrete example |
| NFR-2 | Weight control — keep the template lean and skimmable; mark optional sections clearly | Each governance section ≈ table + 1–2-line rule + concrete example; ownership-map flagged OPTIONAL/conditional |
| NFR-3 | Doc-distribution gate — both templates retain `ados_distribution: redistributable` + license header block | `bash scripts/.tests/test-doc-distribution.sh` exits 0 |
| NFR-4 | Backward compatibility — purely additive | 0 pre-existing section headers/columns removed or renamed |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A for runtime (documentation change). The sole observable gate is `bash scripts/.tests/test-doc-distribution.sh` (exit 0 required). Structural correctness of the templates is verified by manual review + the requested red-team rounds (R1 pre-delivery on artifacts, R2 post-delivery), not by automated probes.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Template bloat — the architecture-overview template is lean (~62 lines); five new sections could over-weight it for small repos | M | M | Keep each section tight (table + 1–2-line rule + concrete example); mark ownership-map OPTIONAL; preserve the "omit if trivial" tone | L |
| RSK-2 | Vague governance fails the AI-actionability bar — easy to write prose that reads well but isn't actionable | M | M | Mandate ≥1 concrete placeholder example per section (NFR-1); ship the three canonical examples the human specified verbatim; red-team R1 specifically probes actionability | L-M |
| RSK-3 | Drift between architecture-overview and repo-analysis governance fields if one is edited without the other | M | L | Define shared field names (DM-6 mirrors DM-1/2/3); call out the consistency contract in §22 | L |
| RSK-4 | Consistency touch-points (README one-liner, handbook §17) missed during delivery | L | M | Plan-writer includes a consistency-sweep task; verify-only, update if needed | L |
| RSK-5 | Reviewer reads the layering tier example as a mandated ADOS architecture | L | L | Template carries an explicit "adapt to your architecture" note; DEC-1 records it as example scaffolding | L |

## 12. ASSUMPTIONS

- The architecture-overview template is the correct home for module governance (not an agent prompt or a separate doc).
- A tiered layering model (presentation/application/domain/infrastructure) is a useful *default example* that gives agents a concrete mental model while remaining project-agnostic.
- Lightweight contracts (signature + return/error shape) are sufficient for mock/stub decisions at inception; a full registry is not yet warranted.
- No enforcement tooling is needed at the template stage — guidance plus human/AI review suffices.
- The red-team R1 round (pre-delivery) is the chosen validation gate for the AI-actionability quality bar.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Epic #73 (ADOS project inception effectiveness) | Parent epic |
| Depends on | GH-69 (inception catalog/templates) | Delivered — created both templates |
| Depends on | GH-71 (bootstrapper unified workflow) | Delivered — Phase 3 consumers in place |
| Sibling | GH-72 (tribal-knowledge) | Frontmatter discipline + confidence column to mirror; structural sibling of repo-analysis |
| Independent of | GH-89 (testing-strategy), GH-33 (tribal-knowledge) | Parallel-safe; no cross-dependency |
| Blocks | None | Downstream consumers (inception authors, `@coder`/`@spec-writer`) adopt via existing template usage |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the split-heuristic placeholder name a concrete `N` (e.g. "3 responsibilities") or stay `<N>` for the project to fill? | M5 heuristic "module > N responsibilities → split" | Proposed: ship `<N>` placeholder with an example value in parentheses; non-blocking. Red-team R1 may confirm. |
| OQ-2 | Should the governance block be one consolidated `## Module governance` section (with five subsections) or five top-level sections interleaved after the Components table? | Placement/organization of the new content | Proposed: one consolidated block placed after the Components table, before Data flow; non-blocking. Plan-writer/refinement decides final heading shape. |

> Note: per PM decision, none of these require escalation to `@decision-advisor`; both have a proposed resolution and are flagged for red-team R1 / plan refinement only.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | No formal ADR/PDR for the layering approach | The dependency-direction matrix is *example scaffolding* for project-specific inception fills, not a precedent-setting ADOS-wide architectural decision; rationale captured in-spec (Appendix B) | 2026-06-29 |
| DEC-2 | Lightweight contracts = boundary + signature + return/error shape | Sufficient for mock/stub decisions at inception; a versioned registry is deferred (NG-1) | 2026-06-29 |
| DEC-3 | Feature→component ownership map is OPTIONAL/conditional in the template | Small repos where the Components table suffices should not be forced to fill it | 2026-06-29 |
| DEC-4 | Tiered layering (presentation/application/domain/infrastructure) is the DEFAULT EXAMPLE, with an "adapt to your architecture" note | Gives agents a concrete mental model while staying project-agnostic | 2026-06-29 |
| DEC-5 | Governance block sits after the Components table; repo-analysis mirrors the same governance field names | Co-location with the inventory it governs; shared field names prevent drift (RSK-3) | 2026-06-29 |
| DEC-6 | AI-actionability is the core success criterion — every governance section ships ≥1 concrete placeholder example | The change's value is actionability, not prose; without concrete examples the entropy problem persists | 2026-06-29 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/templates/architecture-overview-template.md` | Updated — five governance sections added (F-1–F-5) |
| `doc/templates/repo-analysis-template.md` | Updated — module-map governance columns aligned (F-6) |
| `doc/guides/project-inception.md` | Updated — Phase 3 minimal governance reference (F-7) |
| `doc/templates/README.md` (line 62) | Consistency touch-point — one-liner may mention "module governance"; verify/update only if needed (plan sweep, not an AC) |
| `doc/documentation-handbook.md` §17 (Template Index) | Consistency touch-point — architecture-overview row purpose; verify/update only if needed (plan sweep, not an AC) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the architecture-overview template, **when** a reader looks for module-residence rules, **then** a capability-type → owning-module/path-pattern table + one-line rule + concrete example exists (e.g. "new API endpoint → `src/api/`"). | F-1, NFR-1 |
| AC-F2-1 | **Given** the architecture-overview template, **when** checked for a dependency-direction/layering section, **then** an allowed/forbidden matrix between named layers exists with a stated downward-only, no-cycles invariant and a concrete example ("API layer may import domain; domain may NOT import API"). | F-2, NFR-1 |
| AC-F3-1 | **Given** the architecture-overview template, **when** checked for internal interface contracts, **then** lightweight named-boundary contracts exist (boundary + signature + return/error shape) with a concrete example (e.g. cart↔inventory `checkAvailability(sku, qty) → AvailabilityResult`). | F-3, NFR-1 |
| AC-F4-1 | **Given** the architecture-overview template, **when** checked for a feature→component ownership map, **then** an OPTIONAL/conditional map (feature → owning component(s)) exists and is clearly marked optional for small repos. | F-4 |
| AC-F5-1 | **Given** the architecture-overview template, **when** checked for module-boundary heuristics, **then** concrete cohesion/coupling split/merge triggers exist (e.g. ">N responsibilities / >1 reason to change → split"; "two modules always change together → consider merging"). | F-5, NFR-1 |
| AC-F6-1 | **Given** the repo-analysis template's module/component map, **when** checked, **then** its columns align with the architecture-overview governance dimensions (adds a residence hint, a layering tier, and an interface-contract pointer) while preserving the existing `Module | Responsibility` columns. | F-6, DM-6, NFR-4 |
| AC-F7-1 | **Given** `project-inception.md` Phase 3, **when** checked, **then** it references the new governance sections (residence/layering/contracts/ownership/heuristics) in the architecture activity or output, without rewriting the phase. | F-7 |
| AC-NFR1-1 | **Given** the five governance sections, **when** an AI agent applies them, **then** each section contains ≥1 concrete placeholder example usable as a placement or mock/stub decision (5/5). | NFR-1, F-1–F-5 |
| AC-NFR3-1 | **Given** both modified templates, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 and both templates retain `ados_distribution: redistributable` + the license header block. | NFR-3 |
| AC-NFR4-1 | **Given** the modified templates compared to their pre-change versions, **when** diffed, **then** all pre-existing section headers and the module-map's `Module | Responsibility` columns remain (additions only; nothing removed or renamed). | NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order**: (1) architecture-overview governance sections → (2) repo-analysis alignment → (3) Phase 3 reference → (4) consistency sweep (README line 62 + handbook §17, verify/update only if needed) → (5) doc-distribution gate.
- **Validation**: red-team **R1 (pre-delivery)** critiques the spec/test-plan/plan and specifically probes the AI-actionability bar; **R2 (post-delivery)** verifies the shipped templates. Both rounds were explicitly requested.
- **Merge**: single PR; the doc-distribution gate must pass before merge.
- **Adoption**: no migration — existing project instances are unaffected (additive, "omit if trivial"). New inception runs and `@coder`/`@spec-writer` consumers adopt the governance via existing template usage; no agent-prompt change is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. Templates are scaffolds; no existing document instances are migrated. Already-authored `architecture-overview.md`/`repo-analysis.md` files remain valid — the new sections are optional and follow the existing "omit if trivial" tone.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — documentation/template change; no personal data, no data flows, no compliance-regulated content.

## 21. SECURITY REVIEW HIGHLIGHTS

N/A. No code, secrets, auth, or network surface. No `.opencode/agent/**` edits, so no prompt-injection/trust-boundary surface changes. The templates continue to inherit the existing "treat filled-in project content as project-owned" discipline; governance examples are illustrative placeholders only.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Consistency contract**: `architecture-overview-template` and `repo-analysis-template` now share governance field names (DM-1/2/3 ↔ DM-6). Editing one without the other is a drift risk (RSK-3); future changes to governance dimensions must update both templates together.
- **Evolving governance**: when ADOS or a project adds/renames modules, the residence rules and ownership map are the natural update surface; the heuristics guide future module splits/merges.
- **No operational burden**: no CI/runtime cost; the only recurring check is the doc-distribution gate already in CI.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Governance vs inventory | Inventory records *what* modules exist; governance records the *rules* that govern them (placement, dependencies, boundaries) |
| Residence rule | A capability-type → owning-module/path-pattern mapping that resolves where new code lands |
| Layering / dependency-direction | A tiered ordering of modules with an allowed/forbidden dependency matrix; invariant: dependencies point down the tiers, no cycles |
| Internal interface contract | A lightweight description of what crosses a module boundary: named boundary + operation + signature + return/error shape |
| Ownership map | A feature → owning component(s) lookup (optional) |
| Boundary heuristics | Cohesion/coupling rules with split/merge triggers for module evolution |
| Tier | A named layer in the dependency ordering (default example: presentation → application → domain → infrastructure) |

## 24. APPENDICES

### Appendix A — Intended governance section content (design intent, not implementation steps)

These sketches define *what each section must contain* so the plan-writer and coder have concrete, AI-actionable targets. They are content design, not step-by-step tasks.

**A.1 Module-residence rules (F-1)**
| Capability type | Owning module / path pattern | Notes |
|---|---|---|
| new API endpoint | `src/api/` | HTTP entrypoints |
| new domain rule | `src/domain/<context>/` | business logic |
| new CLI command | `src/cli/commands/` | user-invoked |
Rule: *place new code by capability type, not by guess; if a type is unlisted, add a row before placing.*

**A.2 Dependency-direction / layering matrix (F-2)**
Tiers (example — adapt to your architecture): presentation → application → domain → infrastructure.
| From \ To | presentation | application | domain | infrastructure |
|---|---|---|---|---|
| presentation | — | ✓ | ✗ | ✗ |
| application | ✗ | — | ✓ | ✓ (via ports) |
| domain | ✗ | ✗ | — | ✗ (abstractions only) |
| infrastructure | ✗ | ✗ | ✗ | — |
Invariant: *dependencies point DOWN the tier list; no upward or sideways cycles.* Example: *"API layer may import domain layer; domain layer may NOT import API layer."*

**A.3 Internal interface contracts, lightweight (F-3)**
| Boundary (A → B) | Operation | Signature | Returns | Errors |
|---|---|---|---|---|
| cart → inventory | checkAvailability | `checkAvailability(sku, qty)` | `AvailabilityResult{ available: bool, onHand: int }` | `ItemNotFound` |
Scope: signature + return/error shape only — not a versioned registry.

**A.4 Feature→component ownership map (OPTIONAL) (F-4)**
| Feature | Owning component(s) |
|---|---|
| Checkout | cart, inventory, pricing |
*Omit for small repos where the Components table suffices.*

**A.5 Module-boundary heuristics (F-5)**
- A module with **> N responsibilities / > 1 reason to change → split** by responsibility.
- Two modules that **always change together → consider merging**.
- High cohesion within a module; low coupling across modules.
- A dependency mocked in **> 1 unrelated test → consider an interface boundary**.

### Appendix B — Design rationale / alternatives (DEC-1)

Why these five dimensions (M1–M5): they map 1:1 to the placement and mocking decisions an AI agent makes every change — *where does this go* (residence), *may it depend on that* (layering), *what do I fake in a test* (contracts), *who owns this feature* (ownership), and *when do I restructure* (heuristics). Alternatives considered:

- **A full contract registry (rejected — NG-1)**: too heavy for inception; deferred until lightweight contracts prove insufficient.
- **Enforcement tooling (rejected — NG-2)**: governance + review before automation; ship guidance first.
- **A prescriptive tier set (rejected — DEC-4)**: forcing presentation/application/domain/infrastructure would not fit non-layered architectures; it is the default *example* with an adapt note.
- **Ownership map as mandatory (rejected — DEC-3)**: penalizes small repos; made optional.

Why an allowed/forbidden matrix shape: a direction invariant ("down only, no cycles") plus an explicit allowed/forbidden grid is the most compact representation an agent can query mechanically ("may A import B?"), which is the actionability goal.

### Appendix C — repo-analysis alignment column spec (F-6)

The legacy module/component map extends from:
`| Module | Responsibility |` →
`| Module | Responsibility | Residence hint | Layering tier | Interface-contract pointer |`

The three new columns mirror DM-1/2/3 so legacy reconstruction fills the **same** governance fields as the greenfield architecture overview, at the template's existing confidence discipline.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-29 | `@spec-writer` | Initial specification |

---

## AUTHORING GUIDELINES

- **Sources**: GitHub issue #90; inception review findings (`.ai/local/inception/review-2026-06-29-findings.md`, Axis 1 — M1–M5); ticket mapping (`.ai/local/inception/ticket-mapping.md`); PM notes (`chg-GH-90-pm-notes.yaml`); the current `architecture-overview-template.md`, `repo-analysis-template.md`, `tribal-knowledge-template.md`, and `project-inception.md` Phase 3; the template spec `feature-document-templates.md`; the change-spec template; sibling spec `chg-GH-72-spec.md` for frontmatter/AC conventions.
- **Approach**: capabilities map 1:1 to the five governance gaps (M1–M5) plus the two alignment/reference items; the AI-actionability bar is expressed as both a capability detail (§5.1) and a measurable NFR (NFR-1) with its own AC.
- **Constraints honored**: no implementation steps or file-level code paths beyond template/guide identifiers already public in the repo; no commit (PM/committer handles commits); no `.opencode/agent/**` or bootstrapper changes; PM design decisions recorded as DEC-1–DEC-6 (not re-debated, not escalated to `@decision-advisor`).
- **Open questions minimized**: only two non-blocking OQs remain, each with a proposed resolution for red-team R1 / plan refinement.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-90)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, AC-, DEC-, RSK-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths beyond public template/guide identifiers; no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
