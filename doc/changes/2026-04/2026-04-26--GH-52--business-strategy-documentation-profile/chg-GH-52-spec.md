---
change:
  ref: GH-52
  type: docs
  status: Proposed
  slug: business-strategy-documentation-profile
  title: "Extend documentation handbook with optional business strategy documentation profile"
  owners: [juliusz]
  service: documentation-system
  labels: [documentation, business-strategy, templates, ai-agent-rules]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: medium
  dependencies:
    internal: [documentation-handbook, document-templates, decision-records, agent-instructions, documentation-validation]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Extend ADOS documentation standards with a profile-aware, optional business strategy documentation model while preserving the engineering repository default.

## 1. SUMMARY

This change adds an optional business/product strategy documentation profile to the ADOS documentation standard. It defines how central product/business repositories may organize strategy, market, customer, growth, marketing, sales, customer success, finance, metrics, operations, research, decisions, experiments, and structured registers without causing implementation repositories to create business folders by default.

The highest constraint is profile awareness: business documentation is an enabled documentation area, not a universal default. Agents and humans must be able to determine repository documentation responsibilities from a deterministic documentation profile before creating or updating business strategy artifacts.

## 2. CONTEXT

### 2.1 Current State Snapshot

- ADOS currently provides a per-repository documentation handbook focused on engineering delivery documentation, current system specifications, change artifacts, decisions, contracts, quality, operations, analytics, diagrams, and templates.
- The current change lifecycle already uses change specifications, test plans, implementation plans, PM notes, decisions, and post-change system specification updates.
- The existing decision-record model supports ADR, TDR, PDR, BDR, and ODR records in one decisions area, but business/product/operating decision metadata and examples are not yet explicit enough for a business strategy knowledge base.
- The existing template feature defines seven core templates and an agent template-reading model; business strategy templates and YAML register templates are not yet part of the documented inventory.
- The handbook currently treats overview north star and roadmap documents as repo-appropriate extracts, but it does not define a canonical strategy repository model for business/product truth.

### 2.2 Pain Points / Gaps

- ADOS documentation is engineering-centric and does not give teams a structured Markdown-first model for SaaS business/product strategy.
- Naively adding a business documentation tree to the shared handbook could cause AI agents to create business folders in every implementation repository.
- There is no deterministic repository-specific profile file that tells agents which documentation areas are enabled, where business documentation belongs, and which roots are forbidden.
- The current handbook does not distinguish enough between business current truth, raw evidence, working notes, structured registers, decisions, and change artifacts.
- Business strategy work needs validation guidance that is not forced into engineering test language.
- The template inventory does not yet include the business strategy documents and structured YAML registers needed for consistent authoring.

## 3. PROBLEM STATEMENT

Because the ADOS documentation standard is currently engineering-centric and lacks a profile-aware business strategy model, founders, product teams, and AI agents cannot reliably maintain SaaS business strategy knowledge in Markdown without risking accidental business-folder creation in implementation repositories, resulting in scattered strategy context, duplicated truth, and poor multi-repository traceability.

## 4. GOALS

- **G-1**: Define documentation profiles that preserve the existing engineering repository model and enable business strategy documentation only where appropriate.
- **G-2**: Introduce a deterministic repository-specific documentation profile with required front matter fields for agent-safe write decisions.
- **G-3**: Define an optional business documentation capability map for central product/business repositories without requiring empty folder trees or generic placeholder documents.
- **G-4**: Reuse the existing decisions area for ADR, TDR, PDR, BDR, and ODR records, including business/product/operating metadata and examples.
- **G-5**: Add an explicit template inventory for business strategy Markdown documents and optional YAML structured registers.
- **G-6**: Establish AI-agent context-loading and writing rules that prevent accidental business documentation creation in engineering repositories.
- **G-7**: Clarify current truth vs raw notes and ensure raw evidence is operationally marked with source and synthesis metadata.
- **G-8**: Keep the first iteration Markdown-first and usable without Astro or any custom UI while preserving future rendering compatibility.
- **G-9**: Ensure significant business changes reuse the existing change lifecycle rather than creating a parallel business change process.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Profile determinism | 100% of required documentation profile fields are defined, including `profile`, `business_docs_enabled`, write roots, owners, and last-updated metadata. |
| Default safety | If the documentation profile is missing, agents have exactly one documented fallback: assume `engineering-repo` and do not create business documentation unless explicitly requested. |
| Business capability coverage | 100% of required business areas are documented as optional capabilities with clear folder contracts. |
| Template coverage | 100% of the required business Markdown templates and YAML register templates are listed and defined. |
| Decision taxonomy coverage | ADR, TDR, PDR, BDR, and ODR are all documented with unified decision-record storage and business metadata. |
| AI usability | The handbook answers all 10 deterministic AI usability questions listed in this specification. |
| Plain Markdown usability | A human can navigate the model in a Markdown editor without Astro or custom UI. |
| Validation decision | Documentation validation support is either included in the change or explicitly documented as a follow-up; it is not silently omitted. |

### 4.2 Non-Goals

- **NG-1**: Build an Astro site, visual mind map, dashboard, or custom documentation UI.
- **NG-2**: Replace CRM, analytics, accounting, project management, or experimentation platforms.
- **NG-3**: Require all implementation repositories to include business strategy documentation.
- **NG-4**: Create a complete company operating system or exhaustive folder hierarchy from day one.
- **NG-5**: Create a parallel business-specific change lifecycle outside the existing change artifact model.
- **NG-6**: Move business, product, or operating decisions into a separate business decisions area.
- **NG-7**: Rewrite unrelated handbook content beyond the sections needed for this documentation profile extension.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Documentation profiles | Repositories need explicit roles so agents can distinguish engineering repositories, central product/business repositories, business-strategy repositories, and mixed repositories. |
| F-2 | Repository-specific documentation profile | Agents need a deterministic local source for enabled areas, disabled areas, allowed write roots, forbidden write roots, and canonical strategy repository information. |
| F-3 | Business documentation capability map | Central product/business repositories need a clear optional structure for strategy knowledge without mandating empty folder trees. |
| F-4 | Current truth and raw evidence rules | Business documentation must distinguish accepted strategy from research notes, interviews, feedback, and unsynthesized evidence. |
| F-5 | Markdown narrative and YAML register rules | Humans need readable strategy documents while agents and future tools need structured registers where appropriate. |
| F-6 | Unified business change lifecycle | Significant business strategy changes must remain traceable through the existing change artifact workflow. |
| F-7 | Unified decision record taxonomy | Business/product/operating decisions must reuse the existing decision-record model and avoid a separate decisions area. |
| F-8 | Business strategy template inventory | Agents and humans need consistent templates for strategy documents, validation plans, and structured registers. |
| F-9 | AI agent safety and context rules | Agents need deterministic rules for reading profile context, avoiding disabled areas, and linking business artifacts. |
| F-10 | Multi-repository guidance | Central product/business repositories and implementation repositories need clear ownership boundaries and linking rules. |
| F-11 | Overview vs business documentation distinction | Repo overview documents should remain short entry points or repo-scoped summaries, while canonical business truth lives in enabled central strategy repositories. |
| F-12 | Validation support decision | Documentation checks must be profile-aware where feasible, or a documented follow-up must make the gap explicit. |
| F-13 | Future rendering compatibility | Business documents should use stable metadata and links so future Astro rendering remains possible without requiring it now. |

### 5.1 Capability Details

- **F-1 Documentation profiles**: The handbook defines `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo`. Business documentation is disabled by default for engineering repositories.
- **F-2 Repository-specific documentation profile**: The repository profile uses deterministic front matter with `id`, `status`, `profile`, `business_docs_enabled`, `business_docs_root`, `canonical_strategy_repo`, `allowed_write_roots`, `forbidden_write_roots`, `owners`, and `last_updated`. The canonical field name is `profile`, not `repository_profile`.
- **F-3 Business documentation capability map**: The business documentation root is an optional capability map covering context, market, customers, product strategy, discovery, growth, marketing, sales, customer success, finance, metrics, operations, and research. The map must not be interpreted as a bootstrap requirement for every folder.
- **F-4 Current truth and raw evidence rules**: Strategy documents are current truth unless explicitly classified as raw notes, research, interviews, feedback, or working notes. Raw notes require `source_type` and `synthesis_status`, and significant conclusions must be synthesized into current-truth documents.
- **F-5 Markdown narrative and YAML register rules**: Markdown is canonical for narrative strategy and rationale. YAML is optional for structured registers such as roadmap items, experiments, metrics, and content calendars, and YAML register templates must be valid YAML where the intended output is YAML.
- **F-6 Unified business change lifecycle**: Significant business proposals use the existing change artifact convention. Business validation guidance may adapt test-plan concepts into experiments, interviews, landing-page checks, sales calls, metric checks, launch criteria, stop criteria, or pivot criteria.
- **F-7 Unified decision record taxonomy**: ADR, TDR, PDR, BDR, and ODR records remain together in the existing decisions area. Pricing decisions use BDR by default unless a product or operating scope is more appropriate.
- **F-8 Business strategy template inventory**: The handbook and template specification include templates for documentation profile, business north star, business model, strategic assumptions, ICP, persona, jobs-to-be-done, customer problem, roadmap, experiments, validation plans, metrics, marketing, sales, customer success, YAML registers, and decision-record business additions.
- **F-9 AI agent safety and context rules**: Agents read the handbook and documentation profile before creating documentation. If the profile is missing, agents assume `engineering-repo` and must not create business documentation unless explicitly requested.
- **F-10 Multi-repository guidance**: The central product/business repository owns canonical business strategy. Implementation repositories own technical specs, contracts, operations, local decisions, and links to central strategy when needed.
- **F-11 Overview vs business documentation distinction**: Overview north star and roadmap documents remain concise entry points or repo-scoped summaries. Canonical business north star, roadmap, ICP, pricing, experiments, and business metrics live in the enabled business documentation area of the canonical strategy repository.
- **F-12 Validation support decision**: The change must make profile-aware validation expectations visible. If validation checks cannot be updated in this iteration, the handbook must explicitly state the follow-up rather than implying enforcement exists.
- **F-13 Future rendering compatibility**: Important business documents use front matter, stable IDs, predictable links, and structured registers where useful, but no rendering implementation is part of this change.

## 6. USER & SYSTEM FLOWS

**Flow 1: Agent decides whether business documentation is allowed**

User requests a business strategy artifact → Agent reads the shared handbook and repository documentation profile → If business documentation is enabled, agent writes only under the configured business root or other allowed roots → If disabled or missing, agent does not create business documentation and instead asks whether to use the canonical strategy repository or update the profile.

**Flow 2: Founder creates or updates strategy current truth**

Founder identifies a strategic update → The change is captured through the standard change lifecycle when significant → Accepted conclusions update the relevant current-truth business document → Related decisions, experiments, metrics, and roadmap items are cross-linked.

**Flow 3: Raw evidence becomes strategy**

Research, interview, feedback, or meeting notes are recorded as raw evidence with source and synthesis metadata → Insights are reviewed → Accepted conclusions are synthesized into current-truth documents → Raw notes remain available as supporting evidence but do not override current truth.

**Flow 4: Business decision is accepted**

A pricing, ICP, GTM, roadmap, or operating choice requires durable rationale → A BDR, PDR, or ODR is authored in the unified decisions area → Related strategy documents, roadmap registers, experiments, metrics, and change artifacts are linked and updated after acceptance.

**Flow 5: Implementation repository needs business context**

An engineering change references business strategy → The implementation repository links to the canonical strategy repository or relevant central documents → The implementation repository does not duplicate canonical strategy unless its documentation profile explicitly permits mixed responsibilities.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Define documentation profiles: `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo`.
- Define repository-specific documentation profile fields and deterministic fallback behavior.
- Define optional business documentation areas for context, market, customers, product strategy, discovery, growth, marketing, sales, customer success, finance, metrics, operations, and research.
- Clarify the full business tree as a capability map, not a bootstrap tree.
- Define minimal examples only: engineering profile, central product docs profile, BDR example, experiment register example, and minimal business index example.
- Define current-truth vs raw-notes rules, including `source_type` and `synthesis_status` for raw notes.
- Define Markdown vs YAML rules and structured register expectations.
- Define business change and business validation plan guidance through the existing change lifecycle.
- Extend decision-record guidance for BDR, PDR, and ODR business/product/operating metadata.
- Add profile-aware AI-agent reading and writing rules.
- Add concrete multi-repo guidance for canonical strategy repositories and implementation repositories.
- Add or explicitly defer profile-aware documentation validation support.

### 7.2 Out of Scope

- [OUT] Building or configuring an Astro site or custom documentation renderer.
- [OUT] Creating exhaustive empty business folder trees or generic placeholder business documents.
- [OUT] Replacing current engineering documentation structure or change lifecycle conventions.
- [OUT] Introducing a separate business decisions hierarchy.
- [OUT] Forcing YAML registers when Markdown documents are sufficient.
- [OUT] Creating full fictional-company sample documentation.
- [OUT] Broadly rewriting unrelated handbook content.
- [OUT] Changing external CRM, analytics, accounting, or project management workflows.

### 7.3 Deferred / Maybe-Later

- Richer business documentation enablement levels beyond a boolean.
- Static-site rendering, dashboard, strategy map, roadmap board, experiment board, or graph navigation.
- Expanded sample business documentation for a fictional SaaS company.
- Automated dashboard generation from YAML registers.
- Organization-wide synchronization automation for central strategy documentation.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This documentation change does not introduce or modify HTTP endpoints.

### 8.2 Events / Messages

N/A. This documentation change does not introduce or modify runtime events or messages.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Documentation profile | Repository-specific metadata model declaring the active profile, business documentation enablement, business root, canonical strategy repository, allowed write roots, forbidden write roots, owners, and last-updated date. |
| DM-2 | Business document front matter | Common metadata for important business documents, including stable ID, status, owners, area, summary, and links to decisions, experiments, roadmap items, metrics, and changes. |
| DM-3 | Decision record metadata | Extended decision metadata for BDR, PDR, and ODR records, including decision area, scope, reversibility, review date, business impact, customer impact, and related links. |
| DM-4 | Raw evidence metadata | Raw notes, research notes, interviews, and feedback include `source_type` and `synthesis_status` so agents do not treat unsynthesized evidence as current truth. |
| DM-5 | Structured registers | Optional YAML registers for roadmap, experiments, metrics, and content calendars use valid YAML and stable IDs for future parsing. |

### 8.4 External Integrations

N/A. Future static-site rendering is a compatibility consideration only and is not an integration in this change.

### 8.5 Backward Compatibility

- Existing engineering repositories remain valid without business documentation enabled.
- Missing documentation profile defaults to `engineering-repo` behavior for agent safety.
- Existing change, decision, specification, and template conventions remain the foundation.
- Existing decision records remain valid; this change clarifies business/product/operating usage and metadata rather than replacing the model.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Profile fallback safety | 100% of agent-facing guidance states that missing documentation profile means `engineering-repo` and no business documentation creation unless explicitly requested. |
| NFR-2 | Required profile fields | The documentation profile schema documents 10/10 required fields: `id`, `status`, `profile`, `business_docs_enabled`, `business_docs_root`, `canonical_strategy_repo`, `allowed_write_roots`, `forbidden_write_roots`, `owners`, `last_updated`. |
| NFR-3 | Business tree restraint | Handbook language includes at least one explicit statement that the business tree is a capability map, not a bootstrap tree, and no empty full-tree creation is required. |
| NFR-4 | Template inventory completeness | 100% of required business templates and YAML register templates listed in this spec are included in the documented inventory. |
| NFR-5 | Plain Markdown usability | All required business strategy content remains readable as Markdown or YAML without generated UI; zero required Astro/custom UI dependencies. |
| NFR-6 | Validation explicitness | Documentation validation support is explicitly addressed with either profile-aware checks or a named follow-up; zero silent omissions. |
| NFR-7 | Examples minimality | The handbook uses no more than five minimal examples for the first iteration: engineering profile, central product docs profile, BDR example, experiment register example, and minimal business index example. |
| NFR-8 | AI usability question coverage | 10/10 deterministic AI usability questions are answered in the handbook or templates. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A for runtime telemetry. Documentation observability is satisfied through traceable front matter, cross-links, document history, validation checks where feasible, and change lifecycle artifacts.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | AI agents create business folders in every repository. | H | M | Make profile awareness the highest constraint, define missing-profile fallback as engineering repository, and add explicit forbidden-area behavior. | L |
| RSK-2 | The business structure becomes over-engineered and discourages adoption. | M | M | Treat the full tree as a capability map, require only minimal orientation documents where applicable, and provide templates without mandating all document types. | M |
| RSK-3 | Raw notes are mistaken for accepted strategy. | M | M | Require current-truth vs raw-evidence rules and raw metadata including source type and synthesis status. | L |
| RSK-4 | Strategy documents become stale. | M | M | Require owners, last-updated metadata, review cadence guidance, and review dates for strategic assumptions and decisions. | M |
| RSK-5 | Business validation is forced into engineering test language. | M | M | Add business validation plan guidance that supports interviews, experiments, landing-page checks, sales calls, metric checks, stop criteria, and pivot criteria. | L |
| RSK-6 | Decision records fragment into a separate business decisions area. | M | L | Reuse the unified decision-record location and document BDR/PDR/ODR taxonomy clearly. | L |
| RSK-7 | Validation support is implied but not actually available. | M | M | Require the change to either include profile-aware validation checks or explicitly document a follow-up in the handbook. | M |

## 12. ASSUMPTIONS

- The shared handbook remains the canonical documentation structure reference for ADOS-enabled repositories.
- Business documentation is primarily needed in central product/business repositories, not implementation repositories.
- Markdown remains the canonical format for narrative strategy documents in the first iteration.
- YAML registers are optional structured support, not a replacement for narrative strategy.
- The existing change lifecycle can support significant business strategy proposals when paired with business validation guidance.
- The existing decision-record model is the correct home for BDR, PDR, and ODR records.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Documentation handbook | The handbook is the shared standard being extended. |
| Depends on | Document templates model | Templates provide structural guidance for humans and agents. |
| Depends on | Decision records model | Business/product/operating decisions reuse the unified decision taxonomy. |
| Depends on | Agent instructions | Agent behavior must respect documentation profiles and disabled documentation areas. |
| Depends on | Documentation validation approach | Profile-aware checks must be included or explicitly marked as follow-up. |
| Blocks | Business strategy documentation adoption | Central product/business repositories need this standard before consistent use. |
| Blocks | Downstream implementation planning | Implementation planning should use this specification as the canonical scope source. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Which existing documentation validation mechanism should own profile-aware checks if the current checks cannot be extended in this iteration? | Human guidance requires validation support to be explicitly decided, not silently ignored. | Decision needed during planning; if architectural ownership is unclear, consult `@architect`. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Use a boolean `business_docs_enabled` for the first profile iteration. | A boolean is deterministic for agents and avoids premature complexity. | 2026-04-26 |
| DEC-2 | Use `profile` as the canonical documentation profile field name. | The field is short, deterministic, and preferred by the human final implementation remarks. | 2026-04-26 |
| DEC-3 | Treat the full business documentation tree as a capability map, not a bootstrap tree. | This prevents empty folder hierarchies and generic placeholder documents. | 2026-04-26 |
| DEC-4 | Reuse the existing change lifecycle for significant business changes. | A parallel lifecycle would reduce traceability and fragment ADOS conventions. | 2026-04-26 |
| DEC-5 | Add business validation guidance while preserving existing change artifact naming. | Business validation differs from engineering tests, but lifecycle compatibility matters. | 2026-04-26 |
| DEC-6 | Reuse the unified decision-record model for BDR, PDR, and ODR records. | Decisions should remain discoverable in one decision record taxonomy. | 2026-04-26 |
| DEC-7 | Keep Markdown canonical and YAML registers optional. | This preserves simple human authoring while enabling structured future use. | 2026-04-26 |
| DEC-8 | Include future Astro compatibility notes only. | Rendering is valuable later but outside the first iteration. | 2026-04-26 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Documentation handbook | Updated |
| Documentation profile standard | New |
| Business documentation standard | New optional capability |
| Template inventory | Expanded |
| Decision record guidance | Updated |
| AI agent documentation rules | Updated |
| Documentation validation guidance | Updated or explicitly deferred |
| System specifications for templates and decisions | Updated after implementation outcome |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a reader opens the handbook, **when** they review documentation profiles, **then** they can distinguish `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo`. | F-1 |
| AC-F1-2 | **Given** an engineering repository, **when** no business documentation profile enables business docs, **then** the handbook states that business documentation is disabled by default. | F-1, NFR-1 |
| AC-F2-1 | **Given** a repository-specific documentation profile, **when** an agent reads its front matter, **then** it can determine `profile`, `business_docs_enabled`, `business_docs_root`, `canonical_strategy_repo`, allowed write roots, forbidden write roots, owners, and last-updated date. | F-2, DM-1, NFR-2 |
| AC-F2-2 | **Given** no documentation profile exists, **when** an agent must decide whether to create business documentation, **then** it assumes `engineering-repo` and does not create business documentation unless explicitly requested. | F-2, F-9, NFR-1 |
| AC-F3-1 | **Given** a central product/business repository, **when** business documentation is enabled, **then** the handbook defines the optional business documentation capability map for all required business areas. | F-3 |
| AC-F3-2 | **Given** the optional business capability map, **when** a repository is initialized, **then** the handbook does not require creating a full empty business folder tree or generic placeholder documents. | F-3, NFR-3 |
| AC-F4-1 | **Given** raw interview, feedback, research, or meeting notes, **when** they are documented, **then** they include source and synthesis metadata and are not treated as current truth until synthesized. | F-4, DM-4 |
| AC-F4-2 | **Given** accepted strategic conclusions from raw evidence, **when** they become current truth, **then** the relevant current-truth business documents are updated or linked. | F-4 |
| AC-F5-1 | **Given** a narrative strategy document, **when** it is authored, **then** Markdown remains the canonical format. | F-5, NFR-5 |
| AC-F5-2 | **Given** a roadmap, experiment, metric catalog, or content calendar register, **when** YAML is used, **then** the register follows a valid YAML template with stable IDs. | F-5, DM-5 |
| AC-F6-1 | **Given** a significant business strategy proposal, **when** it needs review and traceability, **then** it uses the existing change lifecycle rather than a parallel business change area. | F-6 |
| AC-F6-2 | **Given** business validation work, **when** a validation plan is needed, **then** the guidance supports business validation methods without forcing engineering test terminology. | F-6, F-8 |
| AC-F7-1 | **Given** a new pricing decision, **when** it is durable enough to record, **then** it is written as a BDR/PDR/ODR as appropriate in the unified decision-record model, not in a separate business decisions area. | F-7, DM-3 |
| AC-F7-2 | **Given** a business decision is accepted, **when** related artifacts exist, **then** related strategy documents, roadmap items, experiments, metrics, and change artifacts are linked or updated. | F-7, F-13 |
| AC-F8-1 | **Given** the required template inventory, **when** the handbook or template specification is reviewed, **then** it explicitly includes documentation profile, business north star, business model, strategic assumptions, ICP, persona, jobs-to-be-done, customer problem, product roadmap, experiment, business validation plan, north star metric, content strategy, sales strategy, customer success strategy, and business decision additions. | F-8, NFR-4 |
| AC-F8-2 | **Given** structured register templates, **when** they are intended to output YAML, **then** roadmap, experiment register, metric catalog, and content calendar templates are valid YAML where practical. | F-8, F-5, DM-5 |
| AC-F9-1 | **Given** an AI agent is asked to create documentation, **when** it starts, **then** it loads the handbook and documentation profile before selecting a documentation area. | F-9 |
| AC-F9-2 | **Given** business documentation is disabled, **when** an agent is asked for a business artifact, **then** it explains the disabled area and suggests using the canonical strategy repository or changing the profile rather than writing into a forbidden root. | F-9, F-10 |
| AC-F10-1 | **Given** a multi-repository setup, **when** business strategy and implementation documentation both exist, **then** canonical business strategy is owned by the central product/business repository and implementation repositories own local specs, contracts, operations, and technical decisions. | F-10 |
| AC-F11-1 | **Given** both overview and business documentation exist, **when** a reader needs canonical business north star or roadmap content, **then** the handbook points them to the enabled business documentation area while overview remains an entry point or repo-scoped summary. | F-11 |
| AC-F12-1 | **Given** documentation validation support is feasible, **when** the change is implemented, **then** validation checks are profile-aware and do not require business docs when disabled. | F-12, NFR-6 |
| AC-F12-2 | **Given** documentation validation support is not feasible in this iteration, **when** the handbook is updated, **then** it explicitly marks validation support as a follow-up and describes the expected future checks. | F-12, NFR-6 |
| AC-F13-1 | **Given** future Astro rendering may be added later, **when** business documents are specified, **then** front matter, stable IDs, predictable links, and structured registers are supported without requiring a renderer now. | F-13 |
| AC-AI-1 | **Given** an agent asks “Is this repository allowed to contain business strategy docs?”, **when** it reads the documentation profile, **then** it can answer from `business_docs_enabled` and enabled/disabled documentation areas. | F-2, F-9 |
| AC-AI-2 | **Given** an agent asks “If yes, where is the business docs root?”, **when** business docs are enabled, **then** it can answer from `business_docs_root`. | F-2, F-9 |
| AC-AI-3 | **Given** an agent asks “If no, what should the agent do instead?”, **when** business docs are disabled or profile is missing, **then** the guidance says to avoid writing business docs, use the canonical strategy repository if configured, or ask before changing the profile. | F-2, F-9, F-10 |
| AC-AI-4 | **Given** an agent asks “Where should a new ICP document go?”, **when** business docs are enabled, **then** it can identify the customers area and use the ICP template. | F-3, F-8 |
| AC-AI-5 | **Given** an agent asks “Where should a new pricing decision go?”, **when** the decision is significant, **then** it uses the unified decision-record model with an appropriate BDR/PDR/ODR and links related pricing strategy. | F-7, DM-3 |
| AC-AI-6 | **Given** an agent asks “Where should a growth experiment be recorded?”, **when** business docs are enabled, **then** it can use the discovery or growth experiment guidance and update the experiment register if used. | F-3, F-5, F-8 |
| AC-AI-7 | **Given** an agent asks “Where should a business change proposal live?”, **when** the change is significant, **then** it uses the standard change artifact lifecycle. | F-6 |
| AC-AI-8 | **Given** an agent asks “What is current truth and what is raw evidence?”, **when** it reads the handbook, **then** it can distinguish current-truth documents from raw notes using the documented rules and metadata. | F-4, DM-4 |
| AC-AI-9 | **Given** an agent asks “Which templates should be used?”, **when** it reviews the template inventory, **then** it can choose from the explicit business Markdown and YAML templates. | F-8 |
| AC-AI-10 | **Given** an agent asks “Which documents must be updated after a business decision is accepted?”, **when** it reads the decision guidance, **then** it knows to update or link affected current-truth strategy documents, roadmap/register entries, experiments, metrics, and related change artifacts. | F-7, F-13 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Deliver as a documentation-system change scoped to the handbook, templates, decision-record guidance, agent rules, validation guidance, and reconciled system specifications.
- Preserve existing engineering documentation conventions and keep business documentation opt-in.
- Keep examples minimal and focused on deterministic AI behavior.
- After the change is accepted, downstream users can adopt the documentation profile in central product/business repositories without changing implementation repositories by default.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration is required. Existing repositories without a documentation profile are treated as engineering repositories for agent-safety purposes until they intentionally add a profile. Central product/business repositories may seed only a minimal business index and core current-truth documents when business documentation is enabled.

## 20. PRIVACY / COMPLIANCE REVIEW

This change is documentation-structure focused and does not introduce runtime personal-data processing. Business raw notes, customer interviews, feedback, and research may contain sensitive information in downstream repositories, so templates and guidance should remind authors to apply appropriate privacy practices and avoid exposing confidential customer data unnecessarily.

## 21. SECURITY REVIEW HIGHLIGHTS

No direct security impact is expected. The main safety concern is agent write safety: disabled documentation areas and forbidden write roots must be respected so agents do not create or modify business strategy documentation in inappropriate repositories.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Documentation profile owners must keep profile metadata and allowed/forbidden roots current.
- Business strategy owners must maintain current-truth documents and review stale strategic assumptions.
- Template maintainers must keep business templates aligned with the handbook and agent expectations.
- Decision owners must update linked strategy artifacts when business/product/operating decisions are accepted, superseded, or deprecated.
- Validation checks, if implemented, must remain profile-aware and avoid requiring disabled documentation areas.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Documentation profile | Repository-specific rules declaring the repository role, enabled documentation areas, disabled areas, write roots, owners, and business documentation policy. |
| Enabled documentation area | A documentation area that agents and humans may create or update according to the repository profile and change scope. |
| Disabled documentation area | A documentation area that agents must not create or update unless explicitly instructed to change the profile or use an allowed central repository. |
| Current truth | The accepted, maintained documentation that represents the latest agreed strategy, system behavior, or operating rule. |
| Raw notes | Unsynthesized evidence such as interviews, feedback, meeting notes, or research notes that must not be treated as accepted strategy. |
| Structured register | A Markdown or YAML list of structured items such as roadmap entries, experiments, metrics, or content calendar items. |
| Canonical strategy repository | The central product/business repository that owns accepted business and product strategy truth. |
| Implementation repository | A repository that owns technical implementation documentation such as specs, contracts, operations, local decisions, and links to central strategy. |
| Central product/business repository | A repository that owns product and business strategy, roadmap, customer understanding, metrics, experiments, and strategic decisions. |
| BDR | Business Decision Record. A durable record for business strategy choices such as ICP, pricing, GTM, positioning, or business model. |
| PDR | Product Decision Record. A durable record for product choices such as scope, roadmap priority, or product experience direction. |
| ODR | Operating Decision Record. A durable record for cadence, responsibilities, process, or operating model choices. |

## 24. APPENDICES

Required template inventory for this change includes, at minimum:

- Documentation profile template.
- Business north star template.
- Business model template.
- Strategic assumptions template.
- Ideal customer profile template.
- Persona template.
- Jobs-to-be-done template.
- Customer problem template.
- Product roadmap Markdown template.
- Product roadmap YAML template.
- Experiment template.
- Experiment register YAML template.
- Business validation plan template.
- North star metric template.
- Metric catalog YAML template.
- Content strategy template.
- Content calendar YAML template.
- Sales strategy template.
- Customer success strategy template.
- Business decision additions through the decision-record template.

Optional but permitted business templates may cover market overview, competitor analysis, customer interview notes, customer feedback synthesis, product vision, value proposition, pricing and packaging, opportunity brief, growth model, marketing strategy, sales playbook, financial model assumptions, unit economics, KPI tree, and operating model.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-26 | gpt-5.5 | Initial canonical change specification for GH-52. |

---

## AUTHORING GUIDELINES

- This specification was authored from the GitHub issue summary supplied in the planning context, the full planning specification, the documentation handbook, the document templates feature specification, the decision records feature specification, and GH-52 PM notes.
- Missing or implementation-dependent validation ownership is captured as an open question rather than assumed.
- The specification intentionally avoids implementation tasks and keeps business documentation profile behavior expressed as outcomes and contracts.
- The specification uses the requested vocabulary: documentation profile, enabled documentation area, disabled documentation area, current truth, raw notes, structured register, canonical strategy repository, implementation repository, and central product/business repository.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef`.
- [x] `owners` has at least one entry.
- [x] `status` is "Proposed".
- [x] All sections present in order (1-25 + guidelines + checklist).
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-).
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then.
- [x] NFRs include measurable values.
- [x] Risks include Impact & Probability.
- [x] No code-level implementation details or step-by-step implementation tasks.
- [x] No merge request template content.
- [x] Front matter validates per front_matter_rules.
