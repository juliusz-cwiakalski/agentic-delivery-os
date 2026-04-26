---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/00-index.md
---
# Documentation Index

> Landing page for this repository's documentation. For humans and AI agents.

## Start Here

| Document | Description |
|----------|-------------|
| [Overview](overview/) | North star, roadmap, architecture, glossary |
| [System Spec](spec/) | Current truth — feature specs, API descriptions, NFRs |
| [Documentation Handbook](documentation-handbook.md) | How docs work — structure, conventions, workflow |

## Changing Behavior?

| Document | Description |
|----------|-------------|
| [Changes](changes/) | Proposed and accepted changes (evolution log) |
| [Change Lifecycle Guide](guides/change-lifecycle.md) | 10-phase delivery workflow |
| [Change Convention](guides/unified-change-convention-tracker-agnostic-specification.md) | Naming, folders, branches |

## Guides

| Document | Description |
|----------|-------------|
| [Agents & Commands Guide](guides/opencode-agents-and-commands-guide.md) | How to use AI agents and commands |
| [Onboarding Existing Project](guides/onboarding-existing-project.md) | Adopt ADOS in an existing project |
| [Decision Records Management](guides/decision-records-management.md) | Decision record types, lifecycle, governance |
| [Tools Convention](guides/tools-convention.md) | Standard for building CLI tools |

## Templates

| Template | Purpose |
|----------|---------|
| [Change Spec](templates/change-spec-template.md) | Change specification |
| [Decision Record](templates/decision-record-template.md) | Decision records (ADR/PDR/TDR/BDR/ODR) |
| [Feature Spec](templates/feature-spec-template.md) | Feature specifications |
| [North Star](templates/north-star-template.md) | Product north star document |
| [Test Spec](templates/test-spec-template.md) | Test specifications |
| [Test Plan](templates/test-plan-template.md) | Per-change test plans |
| [Implementation Plan](templates/implementation-plan-template.md) | Per-change implementation plans |

Additional profile-aware templates are listed in [templates/README.md](templates/README.md), including optional business/product strategy templates and YAML register templates.

## Decision Records

| Document | Description |
|----------|-------------|
| [Decision Records](decisions/) | All decision records (ADR/PDR/TDR/BDR/ODR) |
| [Decision Records Index](decisions/00-index.md) | Index of all decisions |

## For AI Agents

- Agent definitions: `.opencode/agent/*.md`
- Command definitions: `.opencode/command/*.md`
- System bootstrap: `AGENTS.md`
- PM configuration: `.ai/agent/pm-instructions.md`
