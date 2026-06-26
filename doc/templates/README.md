---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/README.md
ados_distribution: redistributable
---
# Document Templates

Authoring templates for all document types used in this repository.

## Purpose

Templates define the **structure** (sections, front-matter, ordering) for each document type. They are:

- **Read by agents at runtime** — `@spec-writer`, `@plan-writer`, `@test-plan-writer`, and `@doc-syncer` use these as structural guides.
- **Used by humans** — Copy a template when authoring a new document manually.

Agent prompts define quality rules and domain-specific logic; templates define only structure. If a template is absent, agents fall back to their embedded default structure.

## Core ADOS Templates

| Template | Purpose |
|----------|---------|
| `change-spec-template.md` | Change specification (`chg-<workItemRef>-spec.md`) |
| `decision-record-template.md` | Decision records of all types (ADR/PDR/TDR/BDR/ODR) |
| `feature-spec-template.md` | Feature specifications for `doc/spec/features/` |
| `test-spec-template.md` | Test specifications for `doc/quality/test-specs/` |
| `test-plan-template.md` | Per-change test plans (`chg-<workItemRef>-test-plan.md`) |
| `implementation-plan-template.md` | Per-change implementation plans (`chg-<workItemRef>-plan.md`) |
| `north-star-template.md` | Product north star document (`doc/overview/01-north-star.md`) |
| `pr-instructions-template.md` | PR/MR platform instructions (`.ai/agent/pr-instructions.md`) |

## Meeting Notes Template

| Template | Purpose |
|----------|---------|
| `meeting-notes-template.md` | Combined agenda + summary (decisions, action items, ideas, parked items, open questions, notes worth keeping) for repo-scoped meetings (`doc/meetings/`) or business meetings (`doc/business/meetings/`). Supports copy/paste agenda sharing and git-native PR-based invites. Transcripts stored in `transcripts/` subfolder. |

## Documentation Profile Contract Template

Use this template when a repository needs to make its documentation profile explicit, including repositories where business docs remain disabled.

| Template | Purpose |
|----------|---------|
| `documentation-profile-template.md` | Repository documentation profile contract (`doc/documentation-profile.md`) |

## Inception Templates

Templates for running ADOS project inception (see the
[Project Inception guide](../guides/project-inception.md) and the handbook
**Inception Artifact Catalog**). Templates define structure only; instances are
written into a project's `doc/inception/` workspace when inception runs.

### Engineering (always-produced)

| Template | Purpose |
|----------|---------|
| `inception-state-template.yaml` | Resumable inception state machine (project meta, phases, artifacts, decisions, assumptions, sessions) |
| `material-inventory-template.md` | Inventory of user-provided input materials and existing repo content |
| `roadmap-engineering-template.md` | Engineering roadmap with per-milestone success metrics, validation approach, and OST/discovery linkage |
| `tech-stack-template.md` | Technology stack: languages, frameworks, infrastructure, external services, rationale |
| `architecture-overview-template.md` | High-level architecture (C4 context/container, component map, key flows) |
| `glossary-template.md` | Concise repo-relevant terminology reference |
| `ubiquitous-language-template.md` | DDD ubiquitous language: bounded contexts, aggregates, domain events, commands |
| `repo-analysis-template.md` | Legacy/existing-code reconnaissance: layout, conventions, debt, migration constraints |
| `inception-summary-template.md` | Synthesized inception outcome (decisions, assumptions, risks, next steps) for the knowledge base |

(`north-star-template.md` and `documentation-profile-template.md`, also
always-produced, are listed above in Core ADOS Templates and the Documentation
Profile Contract section.)

### Product discovery (conditional)

| Template | Purpose |
|----------|---------|
| `opportunity-solution-tree-template.md` | Opportunity-solution tree linking product outcomes to solutions and experiments |
| `project-prd-template.md` | Product requirements for the current project/initiative |
| `persona-jtbd-template.md` | Persona × jobs-to-be-done cross-reference (who + what they are trying to accomplish + forces of progress) |

> `persona-jtbd-template.md` is a **cross-reference template**: it relates the
> business-strategy `persona-template.md` and `jobs-to-be-done-template.md`
> (see Business/Product Strategy Templates above) into a single inception
> artifact, rather than duplicating either.

### UX (conditional, web products)

| Template | Purpose |
|----------|---------|
| `user-journey-template.md` | End-to-end user journeys mapping steps, touchpoints, pain points, JTBD |
| `screen-inventory-template.md` | Catalog of screens/views with purpose, owner, and entry conditions |
| `ux-guidance-template.md` | UX constraints and heuristics (links the project to `.ai/rules/ux-conventions.md` when present) |

### Risk & assumption (conditional)

| Template | Purpose |
|----------|---------|
| `assumption-register-template.md` | Assumptions with validation method, status, owner, and due date |
| `risk-register-template.md` | Risks with likelihood, impact, mitigation, owner, and review cadence |

> At inception, `assumption-register-template.md` and `risk-register-template.md`
> capture the **inception four-risk relationship** (**Value / Usability /
> Feasibility / Viability**) as lean per-project registers. They are distinct from
> the business-strategy `strategic-assumptions-template.md`, which holds
> portfolio-level strategic assumptions across products.

## Business/Product Strategy Templates (Optional Profile)

Use these only when repository profile enables business docs.

| Template | Purpose |
|----------|---------|
| `business-north-star-template.md` | Canonical business north star document |
| `business-model-template.md` | Business model assumptions and choices |
| `strategic-assumptions-template.md` | Strategic assumptions with validation status |
| `ideal-customer-profile-template.md` | ICP definition and qualification criteria |
| `persona-template.md` | Persona profile and behavior expectations |
| `jobs-to-be-done-template.md` | Jobs-to-be-done analysis |
| `customer-problem-template.md` | Problem framing and evidence summary |
| `product-roadmap-template.md` | Narrative product roadmap |
| `business-experiment-template.md` | Experiment definition and execution notes |
| `business-validation-plan-template.md` | Validation plan for business/product changes |
| `north-star-metric-template.md` | North star metric definition and guardrails |
| `content-strategy-template.md` | Content strategy document |
| `sales-strategy-template.md` | Sales strategy document |
| `customer-success-strategy-template.md` | Customer success strategy document |

## YAML Register Templates (Optional Structured Registers)

| Template | Purpose |
|----------|---------|
| `product-roadmap-register-template.yaml` | Structured roadmap register |
| `experiment-register-template.yaml` | Structured experiment register |
| `metric-catalog-template.yaml` | Structured metric catalog |
| `content-calendar-template.yaml` | Structured content calendar |

## Conventions

- Templates are **shared** and versioned; link to canonical sources.
- Core lifecycle templates (change/test/spec/plan/decision) include YAML front-matter skeletons and inline HTML comment guidance; `pr-instructions-template.md` primarily points to blueprints, optional business Markdown templates stay concise with short section-level authoring prompts, and YAML register templates provide structured schema-only guidance.
- See `doc/documentation-handbook.md` §17 for the full template index and profile-aware usage rules.
