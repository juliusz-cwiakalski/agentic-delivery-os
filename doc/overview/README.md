---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/overview/README.md
---
# Overview

High-level project context for this repository: the operational file set that
orients readers (human and AI) on the project's direction and domain. Create each
file as it becomes relevant to your project; classify it before producing it.

> Run inception to author this file set: see the
> [Project Inception guide](../guides/project-inception.md) and the
> "Inception Artifact Catalog" section of the
> [Documentation Handbook](../documentation-handbook.md).

## Recommended (all projects)

| File | Template | Purpose |
|------|----------|---------|
| `01-north-star.md` | `doc/templates/north-star-template.md` | Vision, mission, outcome (NSM), target users, problem, principles, decision filter |
| `02-roadmap.md` | `doc/templates/roadmap-engineering-template.md` | Engineering roadmap; "Current Milestone" = detailed scope (MVP for new, next milestone for legacy) |
| `architecture-overview.md` | `doc/templates/architecture-overview-template.md` | C4/Mermaid system overview diagrams, components, data flow, topology |
| `tech-stack.md` | `doc/templates/tech-stack-template.md` | Technologies, versions, rationale, alternatives |
| `glossary.md` | `doc/templates/glossary-template.md` | Reader-friendly list of terms and acronyms (see Documentation Handbook §9) |

## Conditional (produce when the condition holds)

| File | Template | Activation condition |
|------|----------|----------------------|
| `opportunity-solution-tree.md` | `doc/templates/opportunity-solution-tree-template.md` | Conditional — product has been through discovery |
| `user-journeys.md` | `doc/templates/user-journey-template.md` | Conditional — UI-bearing project |
| `screen-inventory.md` | `doc/templates/screen-inventory-template.md` | Conditional — UI-bearing project |
| `ux-guidance.md` | `doc/templates/ux-guidance-template.md` | Conditional — UI-bearing project |

## Optional

| File | Template | Activation condition |
|------|----------|----------------------|
| `ubiquitous-language.md` | `doc/templates/ubiquitous-language-template.md` | Optional — DDD / complex domain (see Documentation Handbook §9) |

## Getting Started

Create the documents listed above as they become relevant to your project. See
`doc/documentation-handbook.md` §4.2 for detailed guidance on each file.
