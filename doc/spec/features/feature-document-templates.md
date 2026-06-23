---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-document-templates.md

id: SPEC-DOCUMENT-TEMPLATES
status: Current
created: 2026-03-10
last_updated: 2026-04-26
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-32", "GH-52"]
  guides:
    - "doc/documentation-handbook.md"
    - "doc/guides/onboarding-existing-project.md"
summary: "Core ADOS templates plus optional profile-aware business/product strategy templates and YAML register templates in doc/templates/, all readable by agents at runtime with graceful fallback to embedded defaults."
---

# Feature: Document Templates

## Overview

ADOS maintains templates in `doc/templates/` that serve as the structural source of truth for core delivery artifacts and optional profile-aware business/product strategy artifacts. Agents read templates at runtime to guide document structure; if a template is absent, agents fall back gracefully to embedded defaults. Humans use the same templates for manual authoring.

## Business Context

### Problem Statement

- **Problem:** Agent prompts embed document structure inline, creating drift risk between what agents produce and what the Documentation Handbook prescribes. No canonical templates exist for humans to reference.
- **Affected Users:** AI agents (`@spec-writer`, `@plan-writer`, `@test-plan-writer`, `@doc-syncer`) and human contributors authoring ADOS documents.
- **Business Impact:** Without templates, structural inconsistency accumulates across documents, and the Documentation Handbook's template references (section 17) point to non-existent files.

### Goals & Success Metrics

- **Primary Goal:** Single source of structural truth for all core ADOS document types, readable by both agents and humans.
- **KPIs:** Core templates remain complete, required GH-52 business templates exist, YAML register templates parse as YAML, and inventories stay synchronized across handbook/README/spec.

## User Experience & Functionality

### Core ADOS Templates

| Template | Purpose | Agent Consumer |
|----------|---------|---------------|
| `change-spec-template.md` | Change specification structure | `@spec-writer` |
| `implementation-plan-template.md` | Implementation plan structure | `@plan-writer` |
| `test-plan-template.md` | Test plan structure | `@test-plan-writer` |
| `feature-spec-template.md` | Feature specification for `doc/spec/features/` | `@doc-syncer` |
| `decision-record-template.md` | Decision record (all types) | `@architect` |
| `test-spec-template.md` | Test specification for `doc/quality/test-specs/` | `@doc-syncer` |
| `north-star-template.md` | Product north star document for `doc/overview/01-north-star.md` | `@bootstrapper` |

### Meeting Notes Template

| Template | Purpose | Scope |
|----------|---------|-------|
| `meeting-notes-template.md` | Combined agenda + summary with research-informed sections (ideas, parked items, open questions, notes worth keeping) and transcript storage | Repo-scoped (`doc/meetings/`) or business (`doc/business/meetings/`) |

### Documentation Profile Contract Template

| Template | Purpose | Scope |
|----------|---------|-------|
| `documentation-profile-template.md` | Repository docs profile contract | Profile configuration |

Repositories may use this template to make the documentation profile explicit whether business docs are enabled or disabled.

### Optional Business/Product Strategy Templates (enabled business docs only)

| Template | Purpose | Scope |
|----------|---------|-------|
| `business-north-star-template.md` | Business north star narrative | Strategy |
| `business-model-template.md` | Business model narrative | Strategy |
| `strategic-assumptions-template.md` | Assumptions + validation cadence | Strategy |
| `ideal-customer-profile-template.md` | ICP definition | Customers |
| `persona-template.md` | Persona definition | Customers |
| `jobs-to-be-done-template.md` | JTBD analysis | Customers |
| `customer-problem-template.md` | Problem framing with raw-evidence metadata | Discovery |
| `product-roadmap-template.md` | Narrative roadmap | Product strategy |
| `business-experiment-template.md` | Experiment plan/results | Discovery/Growth |
| `business-validation-plan-template.md` | Validation plan for strategy changes | Discovery |
| `north-star-metric-template.md` | NSM definition and guardrails | Metrics |
| `content-strategy-template.md` | Content strategy | Marketing |
| `sales-strategy-template.md` | Sales strategy | Sales |
| `customer-success-strategy-template.md` | Customer success strategy | Customer success |

### Optional YAML Register Templates

| Template | Purpose |
|----------|---------|
| `product-roadmap-register-template.yaml` | Structured roadmap register |
| `experiment-register-template.yaml` | Structured experiment register |
| `metric-catalog-template.yaml` | Structured metrics catalog |
| `content-calendar-template.yaml` | Structured content calendar |

### Capabilities

- **Structural guidance (F-1):** Templates include front matter or stable register schema and concise section guidance.
- **Agent runtime reading (F-2):** Agents (`@spec-writer`, `@plan-writer`, `@test-plan-writer`, `@doc-syncer`) read the corresponding template from `doc/templates/` to guide document structure.
- **Graceful fallback (F-3):** If a template file does not exist, agents fall back to their embedded default structures with no errors. This ensures ADOS works in projects that haven't copied the templates directory.
- **Human authoring (F-4):** Templates include deterministic placeholders for manual and agent usage.
- **Profile-aware safety (F-6):** The profile contract template may be used to make disabled or enabled behavior explicit; business strategy templates are optional and should be used only when the repository profile enables business docs.
- **Structured registers (F-7):** `.yaml` register templates provide valid YAML skeletons with stable IDs and cross-link fields.
- **Consistency enforcement (F-5):** Templates define structure; agent prompts define quality rules and domain-specific logic. This separation prevents drift.

### Template Structure

Core ADOS templates follow a consistent pattern:

1. **License header** — Standard ADOS three-line header
2. **Front-matter skeleton** — YAML with placeholders and inline comments explaining each field
3. **Template instructions** — HTML comment block with copy/usage instructions
4. **Section headings** — All required sections for the document type
5. **Inline guidance** — HTML comments within each section explaining expected content

Business Markdown templates intentionally stay concise (front matter + headings + short section-level prompts) and YAML register templates prioritize parseable schema fields over narrative inline commentary.

### User Flow (Manual Authoring)

```
1. Navigate to doc/templates/
2. Copy the appropriate template to the target location
3. Replace all <...> placeholders with actual values
4. Remove template instruction comments
5. Fill in section content following available guidance (inline comments for core templates; concise section-level prompts/metadata for business templates)
```

### User Flow (Agent Authoring)

```
1. Agent receives task to create a document (e.g., change spec)
2. Agent attempts to read doc/templates/change-spec-template.md
3. If found: agent uses template as structural guide
4. If not found: agent uses embedded default structure
5. Agent applies quality rules from its prompt definition
6. Agent writes the document
```

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/templates/` | Templates directory | Contains core templates plus optional business/profile/register templates |
| `doc/templates/README.md` | Directory overview | Purpose, template inventory, usage instructions |
| `doc/templates/change-spec-template.md` | Change spec template | 25-section structure matching the change spec standard |
| `doc/templates/implementation-plan-template.md` | Plan template | Phased implementation plan structure |
| `doc/templates/test-plan-template.md` | Test plan template | Test plan structure with scope, strategy, and traceability matrix |
| `doc/templates/feature-spec-template.md` | Feature spec template | 9-section feature specification structure |
| `doc/templates/decision-record-template.md` | Decision record template | Front matter + 12 sections for all decision types |
| `doc/templates/test-spec-template.md` | Test spec template | Enduring test specification structure |

### Agent Integration

Agents that produce documents are configured to read templates at runtime:

- **`@spec-writer`** reads `change-spec-template.md` when creating change specifications
- **`@plan-writer`** reads `implementation-plan-template.md` when creating implementation plans
- **`@test-plan-writer`** reads `test-plan-template.md` when creating test plans
- **`@doc-syncer`** reads `feature-spec-template.md` when creating/updating feature specifications

The fallback-to-defaults pattern ensures agents work correctly even when templates are absent, which is expected for newly onboarded projects that haven't yet copied the templates directory.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Completeness | Core templates and required GH-52 business/register templates exist | 100% required files present |
| NFR-2 | Validity | Each template renders as valid GitHub-flavored Markdown | All sections render |
| NFR-3 | Guidance | Core templates contain inline HTML-comment guidance; business Markdown skeleton templates and YAML registers may use concise heading/schema guidance | 100% required template types follow documented guidance style |
| NFR-4 | Fallback | Agents produce valid documents when templates are absent | No errors, default structure used |
| NFR-5 | Consistency | Template structure matches the Documentation Handbook requirements | Handbook section 17 fulfilled |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Template rendering | Open changed Markdown templates; verify structure and readability |
| Automated | YAML parsing | Parse changed `.yaml` templates with a YAML parser |
| Manual | Agent fallback | Remove `doc/templates/` directory; run `/write-spec`; verify document is produced with embedded defaults |
| Manual | Agent template reading | With templates present; run `/write-spec`; verify document follows template structure |

## Operational & Support

### Maintenance

When agent prompt structure changes, the corresponding template should be updated. The fallback-to-defaults pattern provides a safety net during transition periods — if a template is outdated, the agent's embedded defaults take precedence for quality rules.

## Dependencies & Risks

- **Depends on:** Documentation Handbook (defines the template inventory in section 17)
- **Risk:** Template-prompt drift over time — mitigated by agents reading templates at runtime (single source) and prompts defining quality rules only

## Related Documentation

- **Documentation Handbook:** [doc/documentation-handbook.md](../../documentation-handbook.md) — section 17 defines core and optional template inventories
- **Templates directory:** [doc/templates/](../../templates/)
- **Onboarding guide:** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md) — recommends copying templates during adoption
