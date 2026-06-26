---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/ubiquitous-language-template.md
ados_distribution: redistributable
id: UBIQUITOUS-LANGUAGE
status: Draft
created: 2026-06-26
last_updated: 2026-06-26
owners: [<owner-or-team>]
area: domain
document_classification: current-truth
links:
  related_decisions: []
  related_changes: []
summary: "Ubiquitous language — the precise, bounded-context vocabulary binding domain experts and code."
---

# Ubiquitous Language

_The authoritative, binding vocabulary for one bounded context. Names core domain concepts (aggregates, entities, value objects, domain events) and their relationships. Distinct from the reader-friendly glossary (see `glossary-template.md` and Documentation Handbook §9). Optional — produce for DDD / complex domains._

## Bounded context scope
_Name the context this vocabulary governs and its boundaries._

## Terms
| Term | Meaning | Type (aggregate / entity / value object / domain event) | Relationships |
|---|---|---|---|

## Context map
_How this context relates to neighbouring bounded contexts (customer/supplier, conformist, ACL, etc.)._

## Binding rules
_The rules that keep code and conversation using these terms consistently (renaming, translation at context boundaries)._
