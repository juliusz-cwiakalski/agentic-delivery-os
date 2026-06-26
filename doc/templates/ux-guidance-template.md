---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/ux-guidance-template.md
ados_distribution: redistributable
id: UX-GUIDANCE
status: Draft
created: 2026-06-26
last_updated: 2026-06-26
owners: [<owner-or-team>]
area: ux
document_classification: current-truth
links:
  related_decisions: []
  related_changes: []
summary: "UX design guidance — design system, accessibility, interaction patterns, breakpoints."
---

# UX Design Guidance

_Conditional — for UI-bearing projects. Sets the project-level UX baseline that per-change UX work builds on._

## Design system / component library
_The chosen design system and component library, and how to extend it._

- Design system: <name / source>
- Component library: <name, version> — <how to add or extend components>

## Accessibility standards
_The WCAG conformance level and how it is verified (automated audit, manual test, assistive-tech check)._

- Target conformance: <WCAG 2.x level A / AA / AAA>
- Verification: <automated audit / manual test / assistive-tech check>

## Interaction patterns
_Reusable interaction patterns (navigation, forms, feedback, errors, loading)._

| Pattern | Usage |
|---|---|
| <pattern, e.g. inline form validation> | <when and how to apply> |
| <pattern> | <when and how to apply> |

## Responsive breakpoints
_The supported breakpoints and layout behaviour at each._

| Breakpoint | Min width | Layout behaviour |
|---|---|---|
| <name, e.g. mobile> | <px> | <layout> |
| <name, e.g. desktop> | <px> | <layout> |

## Theming and branding
_Colour, typography, spacing tokens, dark mode, and branding constraints._

- Tokens: <colour / typography / spacing token source>
- Dark mode / branding: <constraints>

## Relationship to per-change conventions
_Project-level guidance lives here. Per-change UX conventions (component tweaks, one-off patterns) live in `.ai/rules/ux-conventions.md`. Keep both aligned; do not duplicate project baseline into per-change rules._

- Project-level (here): <UX baseline token>
- Per-change (`.ai/rules/ux-conventions.md`): <one-off pattern token>
