---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/quality/test-specs/test-spec-documentation-profiles.md
id: TEST-SPEC-DOCUMENTATION-PROFILES
status: Current
created: 2026-04-26
last_updated: 2026-04-26
owners: [Juliusz Ćwiąkalski]
service: documentation-system
links:
  related_changes: ["GH-52"]
  feature_spec: "doc/spec/features/feature-documentation-profiles.md"
  parent_test_plan: "doc/changes/2026-04/2026-04-26--GH-52--business-strategy-documentation-profile/chg-GH-52-test-plan.md"
summary: "Enduring test specification for profile-aware documentation safety and optional business strategy documentation."
---

# Test Specification: Documentation Profiles and Business Strategy Documentation Safety

## Overview

This test specification verifies that documentation profiles keep business strategy documentation opt-in, preserve the engineering repository default, and keep templates, decision guidance, and validation expectations synchronized.

## Test Scope

- **Under test:** `doc/documentation-handbook.md`, `doc/templates/**`, `doc/spec/features/feature-documentation-profiles.md`, related document-template and decision-record specs, and agent-facing profile guidance.
- **Integration points:** Existing change lifecycle under `doc/changes/**`, unified decision records under `doc/decisions/**`, and optional business docs under profile-enabled roots.
- **Exclusions:** Runtime APIs, events, UI behavior, Astro/static-site rendering, and full fictional business documentation samples.

## Test Levels

### Unit Tests

No source-code unit tests apply. The equivalent unit-level checks are document field and template inspections:

- profile front matter contains all required fields;
- YAML register templates parse as YAML where practical;
- decision-record metadata remains optional for ADR/TDR compatibility.

### Integration Tests

Integration coverage is documentation-flow based:

- handbook, profile template, business templates, and feature specs agree on profile names and field names;
- significant business changes reuse the existing `doc/changes/**` lifecycle;
- business/product/operating decisions remain in unified `doc/decisions/**` records;
- template README, handbook appendix, and feature specs list the same required business templates and YAML registers.

### End-to-End Tests

Manual end-to-end reviews simulate agent decisions:

1. Missing profile: agent assumes `engineering-repo` and does not create business docs.
2. Disabled profile: agent explains the disabled area and suggests the canonical strategy repository or profile change.
3. Enabled profile: agent uses `business_docs_root` and appropriate business templates/registers.

## Test Data

- No real customer or business data is required.
- Use template placeholders and scratch mental copy-tests only.
- Do not create real `doc/business/**` sample trees as test data unless a profile-enabled repository intentionally adopts them.

## Test Scenarios

### Scenario 1: Documentation profiles are distinguishable

- **Given:** A reader opens the documentation handbook.
- **When:** They review the documentation profiles section.
- **Then:** They can distinguish `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo`.

### Scenario 2: Missing profile prevents accidental business writes

- **Given:** `doc/documentation-profile.md` is absent.
- **When:** An agent is asked to create a business strategy artifact.
- **Then:** The agent assumes `engineering-repo`, treats business docs as disabled, and does not create `doc/business/**` unless explicitly instructed.

### Scenario 3: Documentation profile front matter is deterministic

- **Given:** A repository provides `doc/documentation-profile.md`.
- **When:** An agent reads the front matter.
- **Then:** It can determine `profile`, `business_docs_enabled`, `business_docs_root`, `canonical_strategy_repo`, allowed/forbidden roots, owners, and last-updated metadata.

### Scenario 4: Business capability map is optional and complete

- **Given:** Business docs are enabled.
- **When:** A repository adopts the business documentation map.
- **Then:** The map covers context, market, customers, product strategy, discovery, growth, marketing, sales, customer success, finance, metrics, operations, and research without requiring an empty full-tree bootstrap.

### Scenario 5: Raw evidence does not override current truth

- **Given:** Interviews, feedback, research, or meeting notes exist.
- **When:** They are documented as raw evidence.
- **Then:** They include `source_type` and `synthesis_status`, and accepted conclusions are synthesized into or linked from current-truth documents.

### Scenario 6: Business changes reuse existing lifecycle

- **Given:** A significant business strategy proposal needs traceability.
- **When:** A change is created.
- **Then:** It uses the standard `doc/changes/YYYY-MM/YYYY-MM-DD--REF--slug/` folder and `chg-*` artifacts with business-appropriate validation methods.

### Scenario 7: Business decisions stay unified

- **Given:** A pricing, ICP, GTM, roadmap, or operating choice needs durable rationale.
- **When:** A decision record is authored.
- **Then:** It uses BDR/PDR/ODR as appropriate under `doc/decisions/**`, with links to related strategy docs, roadmap/register items, experiments, metrics, and changes.

### Scenario 8: Template inventory is complete and synchronized

- **Given:** Template inventory docs are reviewed.
- **When:** Required GH-52 templates are compared to actual files.
- **Then:** Markdown strategy templates and YAML register templates are present and named consistently across README, handbook, and feature specs.

### Scenario 9: Validation support is explicit

- **Given:** No documentation validation entry point exists.
- **When:** Documentation validation guidance is reviewed.
- **Then:** It explicitly states the manual checks and future profile-aware validation follow-up instead of implying enforcement exists.

### Scenario 10: Future rendering compatibility does not require a renderer

- **Given:** Business strategy docs and registers are authored.
- **When:** They are read in a Markdown/YAML editor.
- **Then:** Stable IDs, front matter, links, and structured registers support future rendering without requiring Astro or custom UI.

## Performance & Load Tests

Not applicable. This feature has no runtime performance surface.

## Security Tests

- Verify disabled/forbidden write roots prevent agents from creating business strategy docs in implementation repositories by default.
- Verify raw evidence guidance warns that sensitive customer or business information must not be exposed unnecessarily.
- Verify no secrets, credentials, or private customer data are required in templates or test data.

## Negative Testing

| Category | Scenarios |
|----------|-----------|
| Missing profile | Agent must assume engineering profile and avoid business docs |
| Disabled profile | Agent must explain disabled area rather than write into forbidden root |
| Separate decisions area | Search/review must not direct business decisions to `doc/business/decisions/**` |
| Validation gap | If no validator exists, handbook/spec must document follow-up explicitly |
| Over-bootstrap | Guidance must not require a full empty `doc/business/**` folder tree |

## Automation Strategy

- Run `git diff --check` for changed docs.
- Parse changed `.yaml` register templates with an available YAML parser where practical.
- Use manual search/content review for profile fallback language, template inventory sync, and absence of contradictory business-write guidance.
- Run shell/tool tests only when `scripts/**` or `tools/**` are changed.

## Test Environment

Local repository checkout is sufficient. No external services or runtime environment are required.

## Test Coverage Metrics

| Coverage Area | Target |
|---------------|--------|
| Required profile fields | 10/10 documented and templated |
| Missing-profile fallback | Present in handbook and agent-facing guidance |
| Business capability areas | All required optional areas documented |
| Required templates/registers | 100% listed and present |
| Validation support | Implemented or explicitly deferred |

## Maintenance

Update this test spec when profile fields, business documentation roots, required business templates, validation tooling, or decision-record metadata change.

## References

- Feature spec: [doc/spec/features/feature-documentation-profiles.md](../../spec/features/feature-documentation-profiles.md)
- Change test plan: [chg-GH-52-test-plan.md](../../changes/2026-04/2026-04-26--GH-52--business-strategy-documentation-profile/chg-GH-52-test-plan.md)
- Documentation handbook: [doc/documentation-handbook.md](../../documentation-handbook.md)
- Documentation profile template: [doc/templates/documentation-profile-template.md](../../templates/documentation-profile-template.md)
