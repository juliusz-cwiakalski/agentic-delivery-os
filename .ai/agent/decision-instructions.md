---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/agent/decision-instructions.md
---
# Decision Instructions

Repository-level configuration for the decision-making workflow. `@decision-advisor` and `@decision-critic` read this file to ground recommendations in THIS project's tracking conventions and strategic priorities. This file supplements the generic [Decision-Making Guide](../../doc/guides/decision-making.md) and [Decision Records Management Guide](../../doc/guides/decision-records-management.md) with project-specific details.

## Strategic Context

Read this section to calibrate decision drivers to what THIS project cares about.

### Mission

Agentic Delivery OS (ADOS) is a spec-driven software delivery system: AI agents and commands that turn a ticket into a reviewed, tested PR through a deterministic 10-phase workflow. The agents and their prompt definitions (`.opencode/agent/*.md`, `.opencode/command/*.md`) **are the product**.

### Core priorities (ranked)

1. **Prompt quality** — A degraded prompt degrades everything downstream. Agent/command definitions are treated with the same rigor as production code.
2. **Lean process** — Ceremony scales with stakes (R0–R3). Routine choices get no record; precedent-setting choices get full rigor. Never reach for ceremony a reversible choice doesn't need.
3. **Determinism** — The 10-phase workflow is gated and reproducible. Changes to the workflow must preserve or improve determinism.
4. **Efficiency** — ADOS is used to deliver ADOS. Process overhead that doesn't pay for itself is a bug. The system must be efficient for a solo developer + AI team.
5. **Single source of truth** — `.opencode/` is canonical; `.ados-claude/` is generated. Never hand-edit generated artifacts. One definition, multiple tool runtimes.

### Decision principles

- **Reversibility trumps theoretical optimality.** A reversible decision made quickly beats a theoretically optimal one delayed. Default to R0/R1 unless the choice is hard to reverse.
- **Prefer the paved road.** If an existing pattern works, follow it. Novelty must justify itself against the cognitive load it introduces.
- **No ceremony for routine work.** Most choices are implementation details, not precedent. Use the R0 escape hatch liberally.
- **The delivery process delivers itself.** Changes to ADOS are made through the ADOS workflow. Dogfooding exposes friction early.
- **Tight prompts win.** Verbose prompts waste tokens and reduce quality. Prefer XML structure for Claude models; keep descriptions short (routing hints, not instructions).
- **Self-contained agents.** An agent's prompt should not depend on external definitions it cannot read at runtime. Critical concepts get an inline glossary.

### Key constraints

- **License**: MIT (open source). No proprietary dependencies without explicit decision.
- **Team**: Solo developer + AI agents. Decisions must be executable by one person orchestrating AI.
- **Multi-tool**: ADOS maintains a single source of truth for OpenCode + Claude Code. Changes must work across both.
- **Redistributable**: ADOS is installed into other projects. Agent/command/guide content must not reference repo-specific ticket numbers or internal issue trackers.

## Operational: Decision Tracking

### Tracker

- **GitHub Issues** — workItemRef prefix: `GH-`
- Decision records are **not** tracked as individual GitHub issues. They are sequential files in `doc/decisions/`.
- A decision record may be linked from a change's GitHub issue via a comment when relevant.

### Decision identifier scheme

- **Format**: `<TYPE>-<zeroPad4>` (e.g., `ADR-0001`, `PDR-0003`)
- **Numbering**: Sequential per type. Each type has its own independent sequence.
- **Resolution**: Scan `doc/decisions/<TYPE>-*-*.md`, take the highest number, add 1.
- **Numbers are never reused.** Deprecated/superseded records keep their number.

### File location and naming

```
doc/decisions/<TYPE>-<zeroPad4>-<slug>.md
```

- Flat directory; all types co-located.
- Slug: kebab-case, ≤ 60 chars.
- Index: `doc/decisions/00-index.md` (manually maintained or auto-generated).

### Status lifecycle

```
Proposed → Under Review → Accepted → (Deprecated | Superseded)
```

- `decision_date` is set only when status becomes `Accepted`.
- R2/R3 records stay at `Proposed` until a human explicitly decides.
- AI never auto-Accepts R2/R3 records.

### Decision types

| Type | Prefix | Scope |
|------|--------|-------|
| Architecture Decision Record | `ADR` | System design, infrastructure patterns, API boundaries |
| Product Decision Record | `PDR` | Feature scoping, UX strategy, product positioning |
| Technical Decision Record | `TDR` | Technology choices, libraries, implementation approach |
| Business Decision Record | `BDR` | Business rules, compliance, process policies |
| Operational Decision Record | `ODR` | Infrastructure, deployment, monitoring, incident response |

### Agent and command integration

| Tool | Role |
|------|------|
| `@decision-advisor` | Orchestrates decisions (all types); writes records; requests human approval for R2/R3 |
| `@decision-critic` | Read-only independent challenger; returns PASS / PASS_WITH_RISKS / REWORK |
| `/plan-decision` | Interactive planning session → emits `<decision_planning_summary>` |
| `/write-decision` | Renders the record proportionally by rigor |
| `/review-decision` | Delegates independent challenge to `@decision-critic` |

### Linking decisions to changes

- In the decision record front matter: `links.related_changes: ["GH-46"]`
- In the change spec front matter: `links.decisions: ["ADR-0001"]`
- In the change spec body: reference the decision record by ID with context

## References

- [Decision-Making Guide](../../doc/guides/decision-making.md) — the decision *process* (kernel, rigor, classification, rights, AI authority)
- [Decision Records Management Guide](../../doc/guides/decision-records-management.md) — the record *artifact* (naming, front matter, lifecycle)
- [Decision Record Template](../../doc/templates/decision-record-template.md) — single source of truth for record body structure
