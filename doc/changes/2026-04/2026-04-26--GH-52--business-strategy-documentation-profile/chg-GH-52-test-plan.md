---
id: chg-GH-52-test-plan
status: Implemented
created: 2026-04-26T13:55:24Z
last_updated: 2026-06-20T00:00:00Z
owners: [juliusz]
service: documentation-system
labels: [documentation, business-strategy, templates, ai-agent-rules]
version_impact: minor
summary: >
  Test plan for extending ADOS documentation standards with an optional, profile-aware business strategy documentation model while preserving engineering repository defaults.
links:
  change_spec: ./chg-GH-52-spec.md
  implementation_plan: ./chg-GH-52-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Extend documentation handbook with optional business strategy documentation profile

## 1. Scope and Objectives

This test plan verifies that GH-52 documentation and template changes introduce business strategy documentation as an optional profile-aware capability without changing the default engineering-repository behavior. Verification is documentation-focused: static/diff checks, content traceability review, Markdown review, link/path review, YAML syntax checks for `.yaml` register templates, and targeted manual review of agent-facing rules.

### 1.1 In Scope

- Profile-aware handbook behavior, including deterministic `doc/documentation-profile.md` front matter and missing-profile fallback.
- Optional `doc/business/**` capability map and its relationship to `doc/overview/**` and central strategy repositories.
- Current-truth vs raw-notes rules, including `source_type` and `synthesis_status` metadata.
- Existing `doc/changes/**` lifecycle reuse for business strategy changes and business validation guidance.
- Unified `doc/decisions/**` decision-record model for ADR, TDR, PDR, BDR, and ODR without `doc/business/decisions/**` forking.
- Required Markdown templates, `.yaml` register templates, template inventory, minimal examples, and future rendering compatibility without Astro implementation.
- Explicit validation-script support or named follow-up for profile-aware documentation validation.
- Guardrails against broad unrelated handbook rewrites.

### 1.2 Out of Scope & Known Gaps

- Runtime product behavior, APIs, events, UI flows, performance benchmarks, or Astro/static-site implementation.
- Full fictional-company sample documentation or exhaustive `doc/business/**` tree creation.
- Broad prompt redesign; agent-facing updates must remain narrow unless routed through the appropriate tooling process.

## 2. References

- Change specification: `./chg-GH-52-spec.md`
- Implementation plan: `./chg-GH-52-plan.md`
- Testing strategy: `.ai/rules/testing-strategy.md`
- Source planning context: `doc/planning/tmp/ideas-and-issues/ados_business_strategy_documentation_extension_spec.md`
- Documentation handbook: `doc/documentation-handbook.md`
- Document templates spec: `doc/spec/features/feature-document-templates.md`
- Decision records spec: `doc/spec/features/feature-decision-records.md`
- Agent and repository guidance: `AGENTS.md`

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Functional IDs | Verification Focus | TC ID(s) | Status |
|-------|----------------|--------------------|----------|--------|
| AC-F1-1 | F-1 | Four documentation profiles are distinguishable. | TC-BIZDOCS-001 | Covered |
| AC-F1-2 | F-1, NFR-1 | Business docs disabled by default for engineering repos. | TC-BIZDOCS-002 | Covered |
| AC-F2-1 | F-2, DM-1, NFR-2 | Profile front matter includes deterministic required fields. | TC-BIZDOCS-003 | Covered |
| AC-F2-2 | F-2, F-9, NFR-1 | Missing profile fallback assumes `engineering-repo`. | TC-BIZDOCS-002 | Covered |
| AC-F3-1 | F-3 | Business capability map covers all required areas. | TC-BIZDOCS-004 | Covered |
| AC-F3-2 | F-3, NFR-3 | Capability map is not a full empty-tree bootstrap requirement. | TC-BIZDOCS-004 | Covered |
| AC-F4-1 | F-4, DM-4 | Raw notes require source and synthesis metadata. | TC-BIZDOCS-005 | Covered |
| AC-F4-2 | F-4 | Accepted conclusions update or link current-truth documents. | TC-BIZDOCS-005 | Covered |
| AC-F5-1 | F-5, NFR-5 | Narrative strategy remains Markdown canonical. | TC-BIZDOCS-006 | Covered |
| AC-F5-2 | F-5, DM-5 | YAML registers use valid YAML templates with stable IDs. | TC-BIZDOCS-007 | Covered |
| AC-F6-1 | F-6 | Significant business changes reuse `doc/changes/**`. | TC-BIZDOCS-008 | Covered |
| AC-F6-2 | F-6, F-8 | Business validation guidance avoids forced engineering test terminology. | TC-BIZDOCS-008 | Covered |
| AC-F7-1 | F-7, DM-3 | Pricing/business decisions use unified decision records. | TC-BIZDOCS-009 | Covered |
| AC-F7-2 | F-7, F-13 | Accepted decisions link/update related artifacts. | TC-BIZDOCS-009 | Covered |
| AC-F8-1 | F-8, NFR-4 | Required business Markdown/template additions are inventoried. | TC-BIZDOCS-010 | Covered |
| AC-F8-2 | F-8, F-5, DM-5 | YAML register templates are explicitly included and valid where practical. | TC-BIZDOCS-007, TC-BIZDOCS-010 | Covered |
| AC-F9-1 | F-9 | Agents load handbook and profile before selecting docs area. | TC-BIZDOCS-011 | Covered |
| AC-F9-2 | F-9, F-10 | Disabled business docs produce safe explanation and central-repo/profile-change path. | TC-BIZDOCS-002, TC-BIZDOCS-011 | Covered |
| AC-F10-1 | F-10 | Multi-repo ownership boundaries are clear. | TC-BIZDOCS-012 | Covered |
| AC-F11-1 | F-11 | `doc/overview/**` remains entry point/repo summary; canonical business truth lives in enabled business docs. | TC-BIZDOCS-012 | Covered |
| AC-F12-1 | F-12, NFR-6 | Profile-aware validation checks if feasible. | TC-BIZDOCS-013 | Covered as either/or with AC-F12-2 |
| AC-F12-2 | F-12, NFR-6 | Explicit validation follow-up if checks are not feasible. | TC-BIZDOCS-013 | Covered as either/or with AC-F12-1 |
| AC-F13-1 | F-13 | Front matter, stable IDs, predictable links, and structured registers support future rendering without requiring Astro. | TC-BIZDOCS-014 | Covered |
| AC-AI-1 | F-2, F-9 | Agent can answer whether business docs are allowed. | TC-BIZDOCS-003, TC-BIZDOCS-011 | Covered |
| AC-AI-2 | F-2, F-9 | Agent can find business docs root. | TC-BIZDOCS-003, TC-BIZDOCS-011 | Covered |
| AC-AI-3 | F-2, F-9, F-10 | Agent avoids disabled/missing-profile business writes and asks or uses canonical repo. | TC-BIZDOCS-002, TC-BIZDOCS-011 | Covered |
| AC-AI-4 | F-3, F-8 | Agent can place an ICP in customers area and use the ICP template. | TC-BIZDOCS-004, TC-BIZDOCS-010 | Covered |
| AC-AI-5 | F-7, DM-3 | Agent places pricing decisions in appropriate BDR/PDR/ODR under unified decisions. | TC-BIZDOCS-009 | Covered |
| AC-AI-6 | F-3, F-5, F-8 | Agent can record growth experiments and update register if used. | TC-BIZDOCS-007, TC-BIZDOCS-010 | Covered |
| AC-AI-7 | F-6 | Agent uses standard change artifact lifecycle for significant business proposals. | TC-BIZDOCS-008 | Covered |
| AC-AI-8 | F-4, DM-4 | Agent distinguishes current truth from raw evidence. | TC-BIZDOCS-005 | Covered |
| AC-AI-9 | F-8 | Agent can choose from explicit business Markdown and YAML templates. | TC-BIZDOCS-010 | Covered |
| AC-AI-10 | F-7, F-13 | Agent knows which artifacts to update/link after accepted business decisions. | TC-BIZDOCS-009, TC-BIZDOCS-014 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Element | Verification Focus | TC ID(s) | Status |
|--------------|---------|--------------------|----------|--------|
| API | REST/HTTP endpoints | Not applicable; no HTTP endpoints are introduced or modified. | None | N/A |
| EVT | Events/messages | Not applicable; no runtime event contracts are introduced or modified. | None | N/A |
| DM-1 | Documentation profile | Required profile fields and fallback behavior are documented and templated. | TC-BIZDOCS-003 | Covered |
| DM-2 | Business document front matter | Important business docs support stable IDs, status, owners, area, summary, and links. | TC-BIZDOCS-014 | Covered |
| DM-3 | Decision record metadata | BDR/PDR/ODR metadata remains in unified decision records. | TC-BIZDOCS-009 | Covered |
| DM-4 | Raw evidence metadata | Raw notes include `source_type` and `synthesis_status`. | TC-BIZDOCS-005 | Covered |
| DM-5 | Structured registers | Optional roadmap, experiment, metric, and content-calendar YAML registers parse and use stable IDs. | TC-BIZDOCS-007 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Profile fallback safety | TC-BIZDOCS-002, TC-BIZDOCS-011 | Covered |
| NFR-2 | Required profile fields | TC-BIZDOCS-003 | Covered |
| NFR-3 | Business tree restraint | TC-BIZDOCS-004 | Covered |
| NFR-4 | Template inventory completeness | TC-BIZDOCS-010 | Covered |
| NFR-5 | Plain Markdown usability | TC-BIZDOCS-006, TC-BIZDOCS-014 | Covered |
| NFR-6 | Validation explicitness | TC-BIZDOCS-013 | Covered |
| NFR-7 | Examples minimality | TC-BIZDOCS-015 | Covered |
| NFR-8 | AI usability question coverage | TC-BIZDOCS-011 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this docs/templates change uses:

- **Static/diff checks**: `git diff --check`; changed-file review for naming, path, and scope conventions.
- **Content checks**: manual traceability review against `chg-GH-52-spec.md`, Markdown rendering review, and link/path review for changed references.
- **YAML syntax checks**: parse changed `.yaml`/`.yml` register templates where a parser is available; otherwise perform documented manual YAML inspection.
- **Shell/tool tests**: only required if implementation adds or changes `tools/**` or `scripts/**`; otherwise automated shell/tool tests are N/A.

Module-to-test mapping:

| Changed Area | Applicable Test Layer | Target Location |
|--------------|-----------------------|-----------------|
| `doc/documentation-handbook.md` | Static/diff + content checks | `doc/documentation-handbook.md` |
| `doc/templates/**` Markdown templates | Static/diff + content checks | `doc/templates/*.md` |
| `doc/templates/**` YAML register templates | Static/diff + YAML syntax checks | `doc/templates/*.yaml` |
| `doc/spec/features/**` | Static/diff + content checks | `doc/spec/features/feature-document-templates.md`, `doc/spec/features/feature-decision-records.md` |
| Agent-facing docs/rules if changed | Static/diff + content/search checks | `AGENTS.md`, `.opencode/**`, `.ai/agent/**` |
| Validation script if changed | Script tests or targeted execution | Existing script/test path discovered during implementation |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-BIZDOCS-001 | Documentation profiles are distinguishable | Happy Path | Important | High | AC-F1-1 |
| TC-BIZDOCS-002 | Missing or disabled profile prevents business writes | Negative | Critical | High | AC-F1-2, AC-F2-2, AC-F9-2, AC-AI-3 |
| TC-BIZDOCS-003 | Documentation profile front matter is deterministic | Happy Path | Critical | High | AC-F2-1, AC-AI-1, AC-AI-2 |
| TC-BIZDOCS-004 | Business capability map is optional and complete | Happy Path | Critical | High | AC-F3-1, AC-F3-2, AC-AI-4 |
| TC-BIZDOCS-005 | Raw evidence does not override current truth | Edge Case | Important | High | AC-F4-1, AC-F4-2, AC-AI-8 |
| TC-BIZDOCS-006 | Narrative strategy remains Markdown-first | Regression | Important | Medium | AC-F5-1 |
| TC-BIZDOCS-007 | YAML register templates are valid and structured | Happy Path | Important | High | AC-F5-2, AC-F8-2, AC-AI-6 |
| TC-BIZDOCS-008 | Business changes reuse existing change lifecycle | Happy Path | Critical | High | AC-F6-1, AC-F6-2, AC-AI-7 |
| TC-BIZDOCS-009 | Business decisions stay in unified decision records | Regression | Critical | High | AC-F7-1, AC-F7-2, AC-AI-5, AC-AI-10 |
| TC-BIZDOCS-010 | Template inventory includes required Markdown and YAML templates | Happy Path | Critical | High | AC-F8-1, AC-F8-2, AC-AI-4, AC-AI-6, AC-AI-9 |
| TC-BIZDOCS-011 | Agent-facing rules are profile-aware | Negative | Critical | High | AC-F9-1, AC-F9-2, AC-AI-1, AC-AI-2, AC-AI-3, AC-AI-8 |
| TC-BIZDOCS-012 | Overview remains entry point while central strategy owns truth | Regression | Important | High | AC-F10-1, AC-F11-1 |
| TC-BIZDOCS-013 | Validation support is implemented or explicitly deferred | Edge Case | Important | High | AC-F12-1, AC-F12-2 |
| TC-BIZDOCS-014 | Future rendering compatibility requires no Astro implementation | Regression | Important | Medium | AC-F13-1, AC-AI-10 |
| TC-BIZDOCS-015 | Examples are minimal and handbook rewrite is scoped | Regression | Important | Medium | NFR-7, NG-7 |

### 5.2 Scenario Details

#### TC-BIZDOCS-001 - Documentation profiles are distinguishable

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Content review of `doc/documentation-handbook.md`
**Tags**: @docs, @manual

**Preconditions**:

- Handbook updates for GH-52 are present.

**Steps**:

1. Open the documentation profiles section in the handbook.
2. Confirm it defines `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo`.
3. Confirm each profile has distinct responsibilities and business-documentation expectations.

**Expected Outcome**:

- A reader can distinguish all four profile types and identify where business documentation may be enabled.

#### TC-BIZDOCS-002 - Missing or disabled profile prevents business writes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-9, F-10, AC-F1-2, AC-F2-2, AC-F9-2, AC-AI-3, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, agent-facing docs/rules if changed
**Tags**: @docs, @manual, @agent-safety

**Preconditions**:

- Handbook and any agent-facing documentation updates are present.

**Steps**:

1. Review missing-profile guidance.
2. Review engineering-repository default behavior.
3. Review disabled-business-docs behavior for a request to create a business artifact.
4. Search changed content for contradictory instructions that allow automatic `doc/business/**` creation in engineering repositories.

**Expected Outcome**:

- Missing profile means agents assume `engineering-repo` and do not create business documentation unless explicitly requested.
- Disabled business docs cause agents to explain the disabled area and suggest the canonical strategy repository or profile change instead of writing into a forbidden root.

#### TC-BIZDOCS-003 - Documentation profile front matter is deterministic

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-1, AC-F2-1, AC-AI-1, AC-AI-2, NFR-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/templates/documentation-profile-template.md`
**Tags**: @docs, @templates, @manual

**Preconditions**:

- The documentation profile template exists or the handbook explicitly defines the profile contract.

**Steps**:

1. Inspect documentation-profile front matter in handbook and template.
2. Verify required fields: `id`, `status`, `profile`, `business_docs_enabled`, `business_docs_root`, `canonical_strategy_repo`, `allowed_write_roots`, `forbidden_write_roots`, `owners`, and `last_updated`.
3. Confirm the canonical field is `profile`, not `repository_profile`.

**Expected Outcome**:

- Agents can determine enabled/disabled business docs, business docs root, owners, and write boundaries from deterministic front matter.

#### TC-BIZDOCS-004 - Business capability map is optional and complete

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-8, AC-F3-1, AC-F3-2, AC-AI-4, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, business templates
**Tags**: @docs, @templates, @manual

**Preconditions**:

- Business documentation guidance and template inventory updates are present.

**Steps**:

1. Confirm the handbook defines optional areas for context, market, customers, product strategy, discovery, growth, marketing, sales, customer success, finance, metrics, operations, and research.
2. Confirm the handbook states the map is a capability map, not a bootstrap requirement.
3. Confirm ICP guidance points to the customers area and the ICP template.

**Expected Outcome**:

- Central product/business repositories have a complete optional map, and no guidance requires creating a full empty business tree or generic placeholder documents.

#### TC-BIZDOCS-005 - Raw evidence does not override current truth

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, DM-4, AC-F4-1, AC-F4-2, AC-AI-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, raw-note/customer/research templates if added
**Tags**: @docs, @manual

**Preconditions**:

- Current-truth and raw-evidence guidance is present.

**Steps**:

1. Review guidance for interviews, feedback, research, and meeting notes.
2. Confirm raw notes require `source_type` and `synthesis_status` metadata.
3. Confirm accepted conclusions must be synthesized into or linked from current-truth documents.

**Expected Outcome**:

- Raw evidence remains distinguishable from accepted strategy, and agents know that current-truth documents must be updated or linked when conclusions are accepted.

#### TC-BIZDOCS-006 - Narrative strategy remains Markdown-first

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, AC-F5-1, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/templates/*.md`
**Tags**: @docs, @templates, @manual

**Preconditions**:

- Business strategy template changes are present.

**Steps**:

1. Review Markdown business strategy templates and handbook Markdown/YAML rules.
2. Confirm narrative strategy, rationale, playbooks, and decision records remain authored in Markdown.
3. Confirm no Astro or custom UI dependency is required to understand the content.

**Expected Outcome**:

- Narrative strategy documentation is readable as Markdown and does not require generated UI.

#### TC-BIZDOCS-007 - YAML register templates are valid and structured

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-8, DM-5, AC-F5-2, AC-F8-2, AC-AI-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/product-roadmap-register-template.yaml`, `doc/templates/experiment-register-template.yaml`, `doc/templates/metric-catalog-template.yaml`, `doc/templates/content-calendar-template.yaml`
**Tags**: @docs, @templates, @yaml

**Preconditions**:

- YAML register templates are added using `.yaml` extensions.

**Steps**:

1. Verify each required YAML register template exists.
2. Parse each `.yaml` template with an available YAML parser, or manually inspect indentation and list/scalar validity if no parser exists.
3. Confirm stable IDs and useful cross-link fields exist for roadmap items, experiments, metrics, and changes where relevant.
4. Confirm experiment guidance can update an experiment register if a register is used.

**Expected Outcome**:

- YAML register templates are valid where practical, use stable IDs, and support structured future parsing.

#### TC-BIZDOCS-008 - Business changes reuse existing change lifecycle

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-8, AC-F6-1, AC-F6-2, AC-AI-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/templates/change-spec-template.md`, `doc/templates/test-plan-template.md`, `doc/templates/business-validation-plan-template.md` if added
**Tags**: @docs, @manual

**Preconditions**:

- Lifecycle and validation guidance updates are present.

**Steps**:

1. Confirm significant business strategy proposals use the standard `doc/changes/YYYY-MM/YYYY-MM-DD--REF--slug/` folder pattern and `chg-*` artifact naming.
2. Confirm business validation guidance supports experiments, interviews, landing-page checks, sales calls, metric checks, launch criteria, stop criteria, and pivot criteria.
3. Confirm guidance does not force business validation into engineering-only test language.

**Expected Outcome**:

- Business strategy changes remain traceable through the existing change lifecycle while supporting business-appropriate validation methods.

#### TC-BIZDOCS-009 - Business decisions stay in unified decision records

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-3, F-13, AC-F7-1, AC-F7-2, AC-AI-5, AC-AI-10
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/templates/decision-record-template.md`, `doc/spec/features/feature-decision-records.md`
**Tags**: @docs, @decisions, @manual

**Preconditions**:

- Decision-record updates are present.

**Steps**:

1. Confirm ADR, TDR, PDR, BDR, and ODR records remain under `doc/decisions/**`.
2. Confirm pricing decisions default to BDR unless product or operating scope is more appropriate.
3. Confirm no guidance creates `doc/business/decisions/**` as a separate decision area.
4. Confirm accepted decisions link or update related strategy documents, roadmap items, experiments, metrics, and change artifacts.

**Expected Outcome**:

- Business/product/operating decisions use the unified decision-record taxonomy and maintain cross-links to related artifacts.

#### TC-BIZDOCS-010 - Template inventory includes required Markdown and YAML templates

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-5, AC-F8-1, AC-F8-2, AC-AI-4, AC-AI-6, AC-AI-9, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/README.md`, `doc/documentation-handbook.md`, `doc/spec/features/feature-document-templates.md`, `doc/templates/**`
**Tags**: @docs, @templates, @yaml

**Preconditions**:

- Template files and inventory/index updates are present.

**Steps**:

1. Compare template inventory against required templates from the change spec appendix.
2. Confirm explicit inclusion of documentation profile, business north star, business model, strategic assumptions, ICP, persona, jobs-to-be-done, customer problem, product roadmap, experiment, business validation plan, north star metric, content strategy, sales strategy, customer success strategy, and business decision additions.
3. Confirm `.yaml` register templates are explicitly inventoried for roadmap, experiment register, metric catalog, and content calendar.
4. Confirm template names in handbook, README/index, and feature spec agree.

**Expected Outcome**:

- Required business Markdown templates and YAML register templates are present or explicitly inventoried as intended deliverables, and agents can choose the correct template.

#### TC-BIZDOCS-011 - Agent-facing rules are profile-aware

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, F-4, DM-4, AC-F9-1, AC-F9-2, AC-AI-1, AC-AI-2, AC-AI-3, AC-AI-8, NFR-1, NFR-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `AGENTS.md`, `.opencode/agent/*.md`, `.opencode/command/*.md`, `.ai/agent/*.md`, `doc/documentation-handbook.md` where changed
**Tags**: @docs, @agent-safety, @manual

**Preconditions**:

- Agent-facing rule changes, if any, are present.

**Steps**:

1. Review changed agent-facing files for `doc/documentation-profile.md` context-loading guidance.
2. Confirm agents load the handbook and profile before selecting a documentation area.
3. Confirm guidance answers the deterministic AI usability questions from the spec.
4. Confirm missing-profile and disabled-profile behavior does not contradict the handbook.

**Expected Outcome**:

- Agents have deterministic, profile-aware rules for selecting documentation areas and safely refusing or redirecting disabled business documentation writes.

#### TC-BIZDOCS-012 - Overview remains entry point while central strategy owns truth

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, F-11, AC-F10-1, AC-F11-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/overview/**` guidance if changed
**Tags**: @docs, @manual

**Preconditions**:

- Multi-repo and overview/business guidance is present.

**Steps**:

1. Review guidance for central product/business repositories and implementation repositories.
2. Confirm central repositories own canonical business strategy.
3. Confirm implementation repositories own local technical specs, contracts, operations, and technical decisions.
4. Confirm `doc/overview/**` remains a concise entry point or repo-scoped summary and points to enabled business docs for canonical business north star, roadmap, ICP, pricing, experiments, and metrics.

**Expected Outcome**:

- Multi-repo ownership boundaries are clear, and overview documents do not duplicate canonical business truth.

#### TC-BIZDOCS-013 - Validation support is implemented or explicitly deferred

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-12, AC-F12-1, AC-F12-2, NFR-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: Existing validation entry point if found; otherwise `doc/documentation-handbook.md` and `doc/spec/features/**`
**Tags**: @docs, @validation, @manual

**Preconditions**:

- Validation scope handling from implementation Phase 4 is complete.

**Steps**:

1. Determine whether an existing validation entry point was updated.
2. If validation code was added, run the smallest relevant validation command/test and confirm profile-aware checks do not require business docs when disabled.
3. If validation code was not added, confirm handbook/spec explicitly name the follow-up and list expected future checks: profile field validation, boolean `business_docs_enabled`, forbidden business-folder warning for engineering profiles, decision prefix checks, and YAML register parsing.

**Expected Outcome**:

- Validation support is not silently omitted: either profile-aware checks exist and pass, or an explicit follow-up is documented.

#### TC-BIZDOCS-014 - Future rendering compatibility requires no Astro implementation

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-13, DM-2, DM-5, AC-F13-1, AC-AI-10, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, business templates, YAML register templates
**Tags**: @docs, @templates, @manual

**Preconditions**:

- Future rendering compatibility guidance and templates are present.

**Steps**:

1. Confirm important business documents use front matter, stable IDs, predictable links, and related artifact links.
2. Confirm structured registers remain optional support for future parsing.
3. Confirm there is no Astro implementation, dashboard, rendered site, or custom UI dependency introduced by this change.

**Expected Outcome**:

- Documentation remains Markdown/YAML-first and future-rendering-compatible without requiring or implementing Astro now.

#### TC-BIZDOCS-015 - Examples are minimal and handbook rewrite is scoped

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-7, NG-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/documentation-handbook.md`, `doc/templates/**`, changed docs
**Tags**: @docs, @manual, @scope-control

**Preconditions**:

- Documentation changes are ready for review.

**Steps**:

1. Count business examples in handbook/template guidance.
2. Confirm examples are limited to the specified first-iteration set: engineering profile, central product docs profile, BDR example, experiment register example, and minimal business index example.
3. Review changed handbook diff for unrelated rewrites outside the profile/template/decision/validation scope.

**Expected Outcome**:

- Examples remain minimal, and the handbook is not broadly rewritten outside GH-52 scope.

### 5.3 Meeting Documentation Scenarios (scope extension)

Added in Phase 8b to cover the meeting documentation conventions (F-14, DM-6, NFR-9).

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TC-MEETING-001 | Verify meeting-notes-template.md exists with required front-matter fields (meeting_date, meeting_type, attendees, recording_url, transcript_url, facilitator, note_taker, timekeeper, document_classification, source_type, synthesis_status, area, links) and body sections (agenda & preparation, discussion, decisions, action items, ideas, open questions, parked items, notes worth keeping, follow-up, links). | 8b | AC-F14-1, AC-F14-3, DM-6, NFR-9 |
| TC-MEETING-002 | Verify handbook §2b defines storage rules for repo-scoped meetings (doc/meetings/) and cross-repo/business meetings (doc/business/meetings/). | 8b | AC-F14-1, AC-F14-2 |
| TC-MEETING-003 | Verify documentation-profile-template.md includes doc/meetings in default allowed_write_roots (engineering-safe). | 8b | AC-F14-1 |
| TC-MEETING-004 | Verify handbook §2b documents transcript storage convention (doc/meetings/transcripts/ subfolder, transcript_url front-matter linkage) and two agenda-sharing workflows (copy/paste into invite, git-native PR link). | 8b | AC-F14-1, AC-F14-2 |

## 6. Environments and Test Data

- **Environment**: Local repository checkout is sufficient for docs/template verification.
- **Test data**: The changed handbook, templates, specs, and agent-facing files created or updated by GH-52.
- **Isolation**: Review only GH-52 changed files and their direct references. Do not create real business documentation under `doc/business/**` as test data unless the implementation explicitly adds minimal templates/examples allowed by the spec.
- **Cleanup**: Remove any scratch files used for manual copy-tests; do not commit scratch ADR/BDR/profile documents.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test File / Location | Execution Command or Review Method | Implementation Status |
|-------|----------------------|------------------------------------|-----------------------|
| TC-BIZDOCS-001 | `doc/documentation-handbook.md` | Manual content review | Manual Only |
| TC-BIZDOCS-002 | `doc/documentation-handbook.md`, agent-facing files if changed | Manual content/search review for fallback and forbidden-root behavior | Manual Only |
| TC-BIZDOCS-003 | `doc/templates/documentation-profile-template.md`, handbook | Manual field checklist | Manual Only |
| TC-BIZDOCS-004 | Handbook business capability map and ICP template | Manual coverage review | Manual Only |
| TC-BIZDOCS-005 | Handbook and raw-evidence templates if added | Manual metadata/current-truth review | Manual Only |
| TC-BIZDOCS-006 | Markdown templates and handbook | Markdown rendering/manual readability review | Manual Only |
| TC-BIZDOCS-007 | `doc/templates/*.yaml` register templates | YAML parser if available; otherwise documented manual YAML syntax inspection | Executed (YAML parser) |
| TC-BIZDOCS-008 | Handbook and change/test/validation templates | Manual lifecycle and validation-language review | Manual Only |
| TC-BIZDOCS-009 | Decision template, handbook, decision spec | Manual review and search for `doc/business/decisions` | Manual Only |
| TC-BIZDOCS-010 | Template README/index, handbook, template files, template spec | Manual inventory reconciliation; YAML check overlaps TC-BIZDOCS-007 | Manual Only |
| TC-BIZDOCS-011 | `AGENTS.md`, `.opencode/**`, `.ai/agent/**` if changed | Manual content/search review for profile loading and AI usability answers | Manual Only |
| TC-BIZDOCS-012 | Handbook multi-repo and overview guidance | Manual content review | Manual Only |
| TC-BIZDOCS-013 | Existing validation script if changed; otherwise handbook/spec follow-up text | Run smallest relevant script/test if changed; otherwise manual explicit-deferral review | Executed (manual + diff checks) |
| TC-BIZDOCS-014 | Handbook, business templates, YAML registers | Manual no-Astro/no-custom-UI and stable-link review | Manual Only |
| TC-BIZDOCS-015 | Handbook and changed docs/templates | Manual scope and example-count review | Manual Only |

Minimum quality gates before completion:

- Run `git diff --check`.
- Complete manual traceability review from every AC in `chg-GH-52-spec.md` to this test plan and implemented docs/templates.
- Review Markdown rendering for changed Markdown docs/templates.
- Review changed links/paths.
- Parse or manually inspect changed `.yaml` register templates.
- Run shell/tool tests only if scripts/tools are changed.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Business docs become a default in implementation repositories. | High | TC-BIZDOCS-002 and TC-BIZDOCS-011 focus on missing-profile fallback and disabled-area behavior. |
| Template inventory and actual files drift. | Medium | TC-BIZDOCS-010 reconciles README/index/spec/handbook/template files. |
| YAML templates are documented but not parseable. | Medium | TC-BIZDOCS-007 requires parser or documented manual YAML syntax inspection. |
| Validation support is implied but absent. | Medium | TC-BIZDOCS-013 requires either implemented checks or explicit follow-up. |
| Documentation change overreaches into Astro or unrelated handbook rewrites. | Medium | TC-BIZDOCS-014 and TC-BIZDOCS-015 verify no Astro implementation and scoped edits. |

### 8.2 Assumptions

- GH-52 is a documentation/template-focused change with no runtime API, event, or UI surface.
- The repository testing strategy requires static/diff and content checks for `doc/**` and `doc/templates/**` changes.
- Business validation may be represented in the existing test-plan/change artifact lifecycle without renaming canonical change files.
- If no suitable validation entry point exists, an explicit follow-up satisfies the validation decision requirement.

### 8.3 Open Questions

| ID | Question | Status | Owner |
|----|----------|--------|-------|
| OQ-TP-1 | Which existing validation mechanism should own future profile-aware documentation checks if no suitable script exists during implementation? | Mirrors spec OQ-1; must be resolved by implementation or documented follow-up. | juliusz / architect if needed |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-26 | test-plan-writer | Initial canonical test plan for GH-52. |
| 1.1 | 2026-04-26 | coder | Added remediation execution evidence for YAML parse and whitespace checks; updated implementation status for re-review readiness. |
| 1.2 | 2026-04-26 | coder | Reconciled execution log statuses for manual acceptance scenarios with explicit remediation evidence and file-level references. |
| 1.3 | 2026-04-27 | coder | Added focused PR #53 inline-guidance rerun evidence for business template readability/inventory checks and `main...HEAD` whitespace + YAML parsing checks. |
| 1.4 | 2026-04-27 | review-feedback-applier | Added focused PR #53 AI reviewer feedback handling evidence for profile root configurability, raw-evidence metadata placeholders, experiment register consistency, and template inventory wording. |
| 1.5 | 2026-06-19 | pm | Refreshed branch against current main (merged GH-54 external-researcher); conflict resolution verified coherent; no test-plan content changes required. |
| 1.6 | 2026-06-20 | pm | Added meeting documentation test scenarios (TC-MEETING-001..003) for scope extension. |
| 1.7 | 2026-06-20 | pm | Enhanced TC-MEETING-001 for research-informed sections; added TC-MEETING-004 for transcript storage and agenda-sharing workflows. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-BIZDOCS-001 | 2026-04-26 | Passed | Manual handbook review confirmed four distinct profiles in `doc/documentation-handbook.md` §2a. |
| TC-BIZDOCS-002 | 2026-04-26 | Passed | Manual fallback/agent-safety review confirmed missing-profile default and no business writes by default in handbook + `AGENTS.md` + `.opencode/agent/coder.md`. |
| TC-BIZDOCS-003 | 2026-04-26 | Passed | Reviewed `doc/templates/documentation-profile-template.md` required deterministic fields (`profile`, `business_docs_enabled`, roots, owners, `last_updated`). |
| TC-BIZDOCS-004 | 2026-04-26 | Passed | Handbook capability map reviewed as optional (not bootstrap tree) and aligned with ICP template pathing guidance. |
| TC-BIZDOCS-005 | 2026-04-26 | Passed | Manual review confirmed current-truth vs raw-evidence rules with `source_type` and `synthesis_status` metadata remain explicit in handbook/template guidance. |
| TC-BIZDOCS-006 | 2026-04-26 | Passed | Markdown template readability/render review completed for business templates and handbook narrative sections; Markdown remains canonical strategy format. |
| TC-BIZDOCS-007 | 2026-04-26 | Passed | `python3` YAML parse check completed for four register templates (`YAML_OK 4`). |
| TC-BIZDOCS-008 | 2026-04-26 | Passed | Manual lifecycle review confirmed business strategy changes remain on canonical `chg-*` artifacts; validation follow-up wording present where checks are deferred. |
| TC-BIZDOCS-009 | 2026-04-26 | Passed | Decision guidance review + search check confirmed no `doc/business/decisions/**` fork; unified `doc/decisions/**` model retained. |
| TC-BIZDOCS-010 | 2026-04-26 | Passed | Inventory reconciliation completed across `doc/templates/README.md`, handbook §17, and feature specs; stale wording corrected; no missing required template/register entries. |
| TC-BIZDOCS-011 | 2026-04-26 | Passed | Agent-facing review confirmed deterministic profile-loading behavior and missing-profile fallback in `AGENTS.md` and `.opencode/agent/coder.md`; stale rules README note removed. |
| TC-BIZDOCS-012 | 2026-04-26 | Passed | Handbook multi-repo ownership + overview guidance reviewed; implementation repos remain summary-oriented with canonical strategy repo preference. |
| TC-BIZDOCS-013 | 2026-04-26 | Passed | Executed `git diff --check` (clean) and post-commit `git diff --check main...HEAD` (clean); explicit validation-follow-up path remains documented. |
| TC-BIZDOCS-014 | 2026-04-26 | Passed | Manual review confirmed no Astro/custom UI implementation added; structured front matter/links in templates and registers remain future-rendering compatible. |
| TC-BIZDOCS-015 | 2026-04-26 | Passed | Scope/minimality pass confirmed no `doc/business/**` bootstrap tree and no broad unrelated handbook rewrite; remediation remained targeted. |
| TC-BIZDOCS-006 | 2026-04-27 | Passed | Re-reviewed all GH-52 business Markdown templates after inline authoring prompts were added; guidance remains concise and Markdown-first without heavy boilerplate. |
| TC-BIZDOCS-010 | 2026-04-27 | Passed | Reconciled `doc/templates/README.md` and `doc/spec/features/feature-document-templates.md` wording with the new concise section-level guidance style. |
| TC-BIZDOCS-013 | 2026-04-27 | Passed | Re-ran focused checks: `git diff --check main...HEAD` (no output) and YAML parse for four register templates (`YAML_OK 4`). |
| TC-BIZDOCS-003 | 2026-04-27 | Passed | PR #53 AI reviewer remediation added enabled-business-docs write-root example and verified profile fields remain deterministic. |
| TC-BIZDOCS-005 | 2026-04-27 | Passed | PR #53 AI reviewer remediation changed raw-evidence `source_type` to a placeholder with allowed examples. |
| TC-BIZDOCS-007 | 2026-04-27 | Passed | PR #53 AI reviewer remediation aligned experiment register `id`/`status` fields with Markdown experiment template; YAML parse rerun returned `YAML_OK 4`. |
| TC-BIZDOCS-010 | 2026-04-27 | Passed | PR #53 AI reviewer remediation separated profile contract template from enabled-business-doc templates in README/spec/handbook index. |
| TC-BIZDOCS-013 | 2026-04-27 | Passed | Post-remediation checks passed: `git diff --check main...HEAD` (no output) and YAML parse for four register templates (`YAML_OK 4`). |
