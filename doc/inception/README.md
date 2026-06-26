---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/inception/README.md
---
# Inception Workspace

This directory is the committed home for a project's **inception** work: the
knowledge base that AI delivery agents operate against. It holds user-provided
inputs, intermediate agent analysis, and the inception record. It does **not**
hold the project's overview content — that lives under `doc/overview/`.

> Run inception with the [Project Inception guide](../guides/project-inception.md).

## Purpose

Inception produces a **knowledge base** that lets specialized AI agents deliver
changes autonomously. The deeper and more structured the knowledge base, the
more autonomous and reliable the delivery. This workspace is where that captured
knowledge is staged, analysed, and summarised before it graduates into
`doc/overview/`, `doc/spec/`, and `doc/decisions/`.

## Structure

```text
doc/inception/
├── README.md          # this file — workspace purpose + structure + lifecycle
├── inputs/            # user-provided materials (NOT agent-produced)
│   └── README.md
├── meetings/          # inception meeting notes (kickoff, interviews, gate reviews)
│   └── README.md
└── analysis/          # agent intermediate analysis (material inventory, assumptions, risks, repo analysis, tribal knowledge)
    └── README.md
```

## Lifecycle

- **Phase 0 (Intake):** user-provided materials are staged under `inputs/`; the
  agent scans them and builds a material inventory under `analysis/`.
- **Phases 1–7:** the agent drafts overview/spec artifacts, records decisions and
  assumptions, and updates inception state after each human gate.
- **Phase 7 (Handoff):** the inception summary is produced; the project is
  "incepted" and ready for autonomous delivery.

The workspace is retained after inception as the project's inception record.

## Templates live under `doc/templates/`

`inception-state.yaml` and `inception-summary.md` are **templates**, shipped as
`doc/templates/inception-state-template.yaml` and
`doc/templates/inception-summary-template.md`. They are instantiated into this
workspace (as `inception-state.yaml` / `inception-summary.md`) only when a
project runs inception. This repo ships **no live instances** — see DEC-1/DEC-8.
