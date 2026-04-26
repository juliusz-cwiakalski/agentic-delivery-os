---
id: SPEC-DOCUMENTATION-PROFILES
status: Current
created: 2026-04-26
last_updated: 2026-04-26
owners: [Juliusz Ćwiąkalski]
service: documentation-system
links:
  related_changes: ["GH-52"]
  guides:
    - "doc/documentation-handbook.md"
  templates:
    - "doc/templates/documentation-profile-template.md"
summary: "Profile-aware documentation safety model that keeps business strategy documentation opt-in and disabled by default for engineering repositories."
---

# Feature Specification: Documentation Profiles

> **Role of this Document:** Current source of truth for repository documentation profiles and profile-aware business strategy documentation safety.

## 1. Overview

ADOS uses documentation profiles to determine which documentation areas a repository may own before humans or agents create new docs. The profile model keeps the existing engineering repository layout as the safe default while allowing central product/business repositories to opt in to structured business strategy documentation.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** A shared documentation handbook that includes business strategy structure can cause agents to create business folders in every implementation repository unless each repository has deterministic write boundaries.
- **Affected Users:** AI agents, founders, product/business owners, engineering teams maintaining implementation repositories, and contributors onboarding ADOS into mixed repositories.
- **Business Impact:** Profile-aware write safety prevents duplicated business truth, accidental `doc/business/**` creation, and unclear ownership across multi-repository setups.

### 2.2 Goals & Success Metrics

- **Primary Goal:** Make repository documentation responsibility deterministic before docs are created or updated.
- **KPIs:** The missing-profile fallback is always `engineering-repo`; business docs are disabled unless enabled by profile or explicit user instruction; profile fields are complete; business docs are treated as an optional capability map rather than a bootstrap tree.

## 3. User Experience & Functionality

### 3.1 Supported Profiles

| Profile | Responsibility | Business documentation behavior |
|---------|----------------|---------------------------------|
| `engineering-repo` | Implementation specs, contracts, operations, quality docs, local technical decisions | Disabled by default; link to canonical strategy repository when needed |
| `central-product-docs-repo` | Product and business strategy truth across repositories | May enable `doc/business/**` and strategy templates |
| `business-strategy-repo` | Dedicated business strategy knowledge base | May enable business strategy docs as its primary documentation area |
| `mixed-product-engineering-repo` | Combined product/business and implementation responsibility | May enable business docs while retaining engineering current-truth docs |

### 3.2 Repository Profile Contract

When present, `doc/documentation-profile.md` is the deterministic local write-safety contract. Its front matter defines:

- `id`
- `status`
- `profile`
- `business_docs_enabled`
- `business_docs_root`
- `canonical_strategy_repo`
- `allowed_write_roots`
- `forbidden_write_roots`
- `owners`
- `last_updated`

The canonical profile field name is `profile`.

### 3.3 Missing-Profile Fallback

If `doc/documentation-profile.md` is absent, agents assume:

- `profile: engineering-repo`
- `business_docs_enabled: false`
- no new `doc/business/**` content is created unless the user explicitly requests a profile change or explicitly directs business-document creation.

When a user asks for business artifacts while business docs are disabled, agents explain the disabled area and suggest using the canonical strategy repository or intentionally updating the repository profile first.

### 3.4 Optional Business Capability Map

When business docs are enabled, `doc/business/**` is an optional capability map, not a required empty folder tree. Repositories create only the areas they need:

- `context/`
- `market/`
- `customers/`
- `product-strategy/`
- `discovery/`
- `growth/`
- `marketing/`
- `sales/`
- `customer-success/`
- `finance/`
- `metrics/`
- `operations/`
- `research/`

Canonical business north star, roadmap, ICP, pricing, experiments, and business metrics live in the enabled business documentation area of the canonical strategy repository. `doc/overview/**` remains a concise entry point or repo-scoped summary.

### 3.5 Current Truth and Raw Evidence

Current-truth business documents represent accepted strategy. Raw interviews, sales calls, support feedback, research notes, and meeting notes do not override current truth until synthesized.

Raw evidence includes `source_type` and `synthesis_status` metadata. Significant accepted conclusions are reflected in or linked from the relevant current-truth documents.

### 3.6 Business Change Lifecycle

Significant business or product strategy proposals use the standard ADOS change lifecycle under `doc/changes/**`. Business validation can use interviews, experiments, landing-page checks, sales calls, metric checks, launch criteria, stop criteria, and pivot criteria without creating a separate business change process.

### 3.7 Decision Record Integration

Business, product, and operating decisions use the unified `doc/decisions/**` model. Pricing decisions default to BDR unless product or operating scope makes PDR or ODR more appropriate. Accepted decisions link or update related strategy documents, roadmap/register entries, experiments, metrics, and change artifacts.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

Documentation profiles are a docs-only metadata contract interpreted by agents and humans before selecting write targets. There is no runtime API, event, database, or UI surface.

### 4.2 Core Components & Directory Structure

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/documentation-handbook.md` | Shared handbook | Defines profile behavior, fallback, capability map, lifecycle guidance, and validation follow-up |
| `doc/documentation-profile.md` | Repository-specific profile | Optional local contract that declares enabled/disabled areas and write roots |
| `doc/templates/documentation-profile-template.md` | Profile template | Reusable profile front-matter skeleton |
| `doc/templates/*business*template.md` and related templates | Business strategy templates | Optional authoring guidance when the profile enables business docs |
| `doc/templates/*.yaml` register templates | Structured registers | Optional roadmap, experiment, metric, and content-calendar YAML skeletons |
| `doc/decisions/**` | Unified decisions area | Stores ADR/TDR/PDR/BDR/ODR records together |

### 4.3 Data Architecture

The profile is represented as Markdown front matter. Business documents use Markdown front matter with stable IDs, status, owners, area, summary, and links. Optional structured registers use YAML with stable IDs and cross-link fields.

### 4.4 API & Interface Contracts

No REST, event, or database contracts are introduced or modified.

## 5. Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Default safety | Missing profile defaults to `engineering-repo` with business docs disabled | 100% of agent-facing guidance |
| NFR-2 | Profile determinism | Profile contract documents all required fields | 10/10 fields |
| NFR-3 | Capability restraint | Business tree is optional, not a bootstrap requirement | Explicit handbook/spec statement |
| NFR-4 | Plain Markdown usability | Business strategy docs remain readable without Astro/custom UI | No renderer dependency |
| NFR-5 | Validation explicitness | Profile-aware docs validation is implemented or explicitly deferred | Zero silent omissions |

## 6. Quality Assurance Strategy

| Level | Scope | Notes |
|-------|-------|-------|
| Manual content review | Handbook, profile template, business template inventory | Verify profile fields, fallback behavior, capability map, lifecycle, and decision guidance |
| Search review | Changed docs and agent-facing guidance | Confirm no contradictory automatic business-doc creation guidance |
| YAML syntax review | Register templates | Parse or manually inspect `.yaml` register templates |
| Diff/static check | Changed docs | Run `git diff --check`; run shell/tool tests only if scripts/tools change |

## 7. Operational & Support

### 7.1 Configuration

`doc/documentation-profile.md` is optional. Repositories that omit it are treated as engineering repositories for safety.

### 7.2 Observability

Documentation observability comes from front matter, stable IDs, cross-links to `GH-52` and future changes, and manual/automated docs validation when available.

### 7.3 Validation Follow-Up

This repository currently has no `scripts/doc-checks.sh` or `scripts/doc/doc-checks.sh` entry point. Until a validator exists, authors run `git diff --check`, manual front-matter/link checks, and YAML parsing for changed register templates. Future lightweight validation should check profile fields, boolean `business_docs_enabled`, forbidden business-folder creation for engineering profiles, decision prefixes, and YAML register syntax.

## 8. Dependencies & Risks

- **Depends on:** Documentation Handbook, document templates, decision-record guidance, and agent-facing profile safety rules.
- **Risk:** Agents create business folders in engineering repositories — mitigated by missing-profile fallback and forbidden-root guidance.
- **Risk:** Business strategy truth fragments across repositories — mitigated by central strategy repository guidance and cross-links.
- **Risk:** Validation support is assumed but absent — mitigated by explicit validation follow-up scope.

## 9. Glossary & References

- **Documentation profile:** Repository-specific metadata declaring enabled/disabled documentation areas and write roots.
- **Current truth:** Accepted, maintained documentation representing the latest agreed strategy, system behavior, or operating rule.
- **Raw evidence:** Unsynthesized interviews, feedback, research, or notes that must not override current truth.
- **Canonical strategy repository:** Central product/business repository that owns accepted business and product strategy truth.
- **Related change:** `GH-52`
- **Handbook:** [doc/documentation-handbook.md](../../documentation-handbook.md)
- **Profile template:** [doc/templates/documentation-profile-template.md](../../templates/documentation-profile-template.md)
