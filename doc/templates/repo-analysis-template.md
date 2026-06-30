---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/repo-analysis-template.md
ados_distribution: redistributable
id: REPO-ANALYSIS
status: Draft
created: 2026-06-26
last_updated: 2026-06-29
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
- `<dir>/` — <role>
- `<dir>/` — <role>
## Detected tech stack
_Languages, frameworks, datastores, build/test tooling detected from the code._
- <language / framework / datastore / tool> — <version and how detected>
- <language / framework / datastore / tool> — <version and how detected>
## Entry points
_Where execution begins (main, handlers, routes, jobs) and how they are invoked._
| Entry point | Type | Invoked by |
|---|---|---|
| <path> | <main / handler / route / job> | <trigger> |
| <path> | <type> | <trigger> |
## Module / component map
_Grouping of modules/components by responsibility._
| Module | Responsibility | Residence hint | Layering tier | Interface-contract pointer |
|---|---|---|---|---|
| <module path> | <what it owns> | <residence rule / path pattern> | <presentation / application / domain / infrastructure / n-a> | <boundary→boundary operation, or n-a> |
| <module path> | <what it owns> | <residence hint> | <layering tier> | <contract pointer> |
These columns correspond to the Module governance section of the architecture overview (residence rules / layering matrix / interface contracts); populate the same concepts during legacy reconstruction.
## Data flow
_Primary data paths through the system._
- <flow name> — <entry → transformation → persistence>
- <flow name> — <entry → transformation → persistence>
## External dependencies
_Libraries, services, and integrations the repo depends on._
| Dependency | Type | Purpose |
|---|---|---|
| <name> | <library / service / integration> | <what it provides> |
| <name> | <type> | <what it provides> |
## Tech debt and known issues
_Detected debt, smells, TODO/FIXME clusters, and known bugs._
- <area, e.g. module X> — <debt type and severity>
- <area> — <debt type and severity>
## Confidence flags
_Areas the agent is uncertain about and recommends human confirmation (architecture assumptions, ambiguous ownership, guessed data flows). Rate each low/medium/high confidence._
| Area | Observation | Confidence | Human-confirm question |
|---|---|---|---|
