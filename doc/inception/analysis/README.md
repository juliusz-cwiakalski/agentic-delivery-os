---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/inception/analysis/README.md
---
# Inception Analysis

This directory holds **agent intermediate analysis** produced during inception.
These are working artifacts, not shipped templates — they are produced when a
project runs inception.

## What goes here

| Artifact | Template / source | Produced in |
|---|---|---|
| `material-inventory.md` | `doc/templates/material-inventory-template.md` | Phase 0 |
| `assumptions.md` | `doc/templates/assumption-register-template.md` | Phase 2 |
| `risks.md` | `doc/templates/risk-register-template.md` | Phase 2 |
| `repo-analysis.md` | `doc/templates/repo-analysis-template.md` | Phase 0 (legacy) |
| `tribal-knowledge.md` | (extracted from PR/MR history) | Phase 0–1 (legacy) |

The inception state tracker and final summary live one level up (as
`inception-state.yaml` and `inception-summary.md`), instantiated from
`doc/templates/inception-state-template.yaml` and
`doc/templates/inception-summary-template.md`.

See the [Project Inception guide](../../guides/project-inception.md).
