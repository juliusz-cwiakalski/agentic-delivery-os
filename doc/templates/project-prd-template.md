---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/project-prd-template.md
ados_distribution: redistributable
id: PROJECT-PRD
status: Draft
created: 2026-06-26
last_updated: 2026-06-26
owners: [<owner-or-team>]
area: discovery
document_classification: current-truth
links:
  related_decisions: []
  related_changes: []
summary: "Project PRD — richer than north star, for non-trivial new products."
---

# Project PRD

_Conditional — for non-trivial new products. Richer than the north star (`doc/templates/north-star-template.md`): it adds a vision narrative, success metrics, and a validation plan. Produced in Phase 1._

## Problem statement
_The user/business problem, framed around pain and consequence._

- <pain> — <consequence if unsolved>
- <pain> — <consequence if unsolved>

## Vision narrative (Working Backwards)
_Write the vision from the user's future perspective (press-release format), not from an engineer's build list._

- <headline: the future user benefit>
- <who benefits and how>

## Target users
_Primary persona and the job they hire the product for (see `doc/templates/persona-jtbd-template.md`)._

- Primary persona: <persona> — <job they hire it for>
- Secondary (optional): <persona> — <job>

## Success metrics
_Outcome metrics that prove the product worked, with guardrails._

- Primary outcome metric: <metric> — <target>
- Guardrails: <constraints that must not be violated>

## Out of scope
_What is deliberately not being built and why._

- <excluded capability> — <why>
- <excluded capability> — <why>

## Assumptions
_Key assumptions, tagged by risk type (value/usability/feasibility/viability). Link to the assumption register (`doc/templates/assumption-register-template.md`)._

- <assumption> — <risk type> (see assumption register)
- <assumption> — <risk type> (see assumption register)

## Validation plan
_How the product will be validated before and after launch (cohorts, qualitative checks, experiments) and the decisions validation drives._

- Method: <cohort / qualitative check / experiment>
- Decision it drives: <proceed / pivot / kill>
