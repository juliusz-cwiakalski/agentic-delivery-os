---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/inception/inputs/README.md
---
# Inception Inputs

This directory holds **user-provided** materials that feed inception. These are
NOT produced by an agent — they are provided by humans and scanned in Phase 0
(Intake & material scan). The agent reads them, maps each to the inception phase
it informs, and extracts key elements into the
[material inventory](../analysis/) using
`doc/templates/material-inventory-template.md`.

## What goes here

| Input type | Examples | When |
|---|---|---|
| Strategy docs | Mission/vision statements, OKRs, strategic plans | New & legacy |
| User research | Interview notes, survey results, personas, JTBD analyses | New & legacy (more common new) |
| Competitive analysis | Competitor feature comparisons, market maps | New & legacy |
| Existing documentation | Confluence exports, wikis, README, API docs | Legacy |
| Meeting notes | Kickoff notes, strategy sessions, stakeholder interviews | New & legacy |
| Prototypes/wireframes | Figma links, mockup screenshots, prototype descriptions | New & legacy |
| Technical docs | Architecture diagrams, DB schemas, API specs, infra configs | Legacy |
| Business model | Business model canvas, pricing strategy, unit economics | New & legacy (if business repo) |

## Notes

- Keep originals as provided; the agent does not rewrite them.
- Inception **captures** the outputs of these materials — it does not run the
  activities that produced them (interviews, experiments, prototyping).
- See the [Project Inception guide](../../guides/project-inception.md) for the
  full intake process.
