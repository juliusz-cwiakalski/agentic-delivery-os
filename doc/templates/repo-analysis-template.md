---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/repo-analysis-template.md
ados_distribution: redistributable
id: REPO-ANALYSIS
status: Draft
created: 2026-06-26
last_updated: 2026-06-26
owners: [<owner-or-team>]
area: engineering
document_classification: current-truth
links:
  related_decisions: []
  related_changes: []
summary: "Repo analysis — structure, detected stack, entry points, module map, data flow, debt, and confidence flags."
---

# Repo Analysis

_Produced in Phase 0 for legacy onboarding (whole-repo ingestion). Mark areas of uncertainty explicitly so humans can confirm them — the agent may not fully understand legacy architecture._

## Repository structure
_Tree of the top-level layout (directories and their roles)._
## Detected tech stack
_Languages, frameworks, datastores, build/test tooling detected from the code._
## Entry points
_Where execution begins (main, handlers, routes, jobs) and how they are invoked._
## Module / component map
_Grouping of modules/components by responsibility._
## Data flow
_Primary data paths through the system._
## External dependencies
_Libraries, services, and integrations the repo depends on._
## Tech debt and known issues
_Detected debt, smells, TODO/FIXME clusters, and known bugs._
## Confidence flags
_Areas the agent is uncertain about and recommends human confirmation (architecture assumptions, ambiguous ownership, guessed data flows). Rate each low/medium/high confidence._
| Area | Observation | Confidence | Human-confirm question |
|---|---|---|---|
