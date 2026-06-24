---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-onboarding-guide.md

id: SPEC-ONBOARDING-GUIDE
status: Current
created: 2026-03-10
last_updated: 2026-03-10
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-32"]
  guides:
    - "doc/guides/onboarding-existing-project.md"
summary: "Step-by-step guide for adopting ADOS in an existing project, covering mandatory and optional artifacts, tracker configuration, decision records setup, and first change walkthrough."
---

# Feature: Onboarding Guide for Existing Projects

## Overview

`doc/guides/onboarding-existing-project.md` provides a structured, step-by-step guide for engineers and tech leads adopting ADOS in an existing project. It clearly distinguishes mandatory artifacts (required for ADOS to function) from optional artifacts (recommended for a better experience), and includes configuration walkthroughs for both GitHub Issues and Jira tracker setups.

The guide serves as the manual adoption path, complementing the automated `/bootstrap` command.

## Business Context

### Problem Statement

- **Problem:** Teams adopting ADOS have no guided path — they must reverse-engineer the required files, their order, and content from multiple cross-referencing guides.
- **Affected Users:** Engineers and tech leads evaluating or adopting ADOS.
- **Business Impact:** Without clear onboarding documentation, potential adopters abandon the process or produce invalid setups.

### Goals & Success Metrics

- **Primary Goal:** Any team can adopt ADOS by following the guide without external help.
- **KPIs:** Guide covers 100% of mandatory ADOS artifacts with complete setup instructions.

## User Experience & Functionality

### Capabilities

- **Mandatory vs. optional distinction (F-1):** Clearly labels three mandatory artifacts (`AGENTS.md`, `.ai/agent/pm-instructions.md`, `doc/documentation-handbook.md`) and six optional artifact categories.
- **Tracker configuration walkthrough (F-2):** Includes complete YAML configuration examples for both GitHub Issues and Jira trackers.
- **Decision records setup (F-3):** Dedicated section with steps to create `doc/decisions/` infrastructure, linked to the Decision Records Management Guide.
- **First change walkthrough (F-4):** Demonstrates both autopilot (`@pm deliver change GH-1`) and manual command sequence for running the full 10-phase workflow.
- **Bootstrap alternative (F-5):** References the automated `/bootstrap` command as an alternative to manual setup.
- **Troubleshooting (F-6):** Covers common issues (tracker not found, templates not used, decision records workflow, wrong artifact location, missing directories).
- **Related guides table (F-7):** Links to all relevant ADOS guides (change lifecycle, change convention, agents & commands, tools convention, documentation handbook, decision records).
- **Multi-tool support (F-8):** Documents installation for OpenCode and Claude Code.

### Guide Structure

1. Prerequisites
2. Step 1: Mandatory Artifacts (AGENTS.md, pm-instructions.md, documentation-handbook.md)
3. Step 2: Recommended Artifacts (00-index.md, overview docs, feature specs, templates, decisions, guides)
4. Step 3: Decision Records Setup
5. Step 4: First Change Walkthrough (autopilot and manual)
6. Step 5: Automated Bootstrap (alternative)
7. Troubleshooting
8. Related Guides

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/guides/onboarding-existing-project.md` | Onboarding guide | Complete adoption walkthrough |

### Referenced Artifacts

The guide references and links to:

- `AGENTS.md` — bootstrap file for AI agents
- `.ai/agent/pm-instructions.md` — PM tracker configuration
- `doc/documentation-handbook.md` — documentation standard
- `doc/00-index.md` — documentation landing page
- `doc/overview/` — project overview documents
- `doc/spec/features/` — feature specifications
- `doc/templates/` — document templates (7 files)
- `doc/decisions/` — decision records directory
- `doc/guides/decision-records-management.md` — decision records standard

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Completeness | Lists all mandatory ADOS artifacts | 3/3 mandatory artifacts documented |
| NFR-2 | Completeness | Includes tracker configuration for GitHub Issues and Jira | Both examples present |
| NFR-3 | Completeness | Includes decision records setup instructions | Linked to management guide |
| NFR-4 | Completeness | Links to all relevant ADOS guides | All 6 guides linked |
| NFR-5 | Completeness | Documents multi-tool installation options | OpenCode + Claude Code coverage |

## Dependencies & Risks

- **Depends on:** All artifacts it references must exist (AGENTS.md, documentation handbook, decision records guide, templates)
- **Risk:** Guide becomes stale as ADOS evolves — mitigated by `@doc-syncer` reconciliation after each change

## Related Documentation

- **Guide:** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md)
- **Bootstrap command:** `/bootstrap` — automated alternative
- **Change lifecycle:** [doc/guides/change-lifecycle.md](../../guides/change-lifecycle.md) — detailed 10-phase workflow referenced by the walkthrough section
