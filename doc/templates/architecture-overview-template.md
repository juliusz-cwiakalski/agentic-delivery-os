---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/architecture-overview-template.md
ados_distribution: redistributable
id: ARCHITECTURE-OVERVIEW
status: Draft
created: 2026-06-26
last_updated: 2026-06-29
owners: [<owner-or-team>]
area: engineering
document_classification: current-truth
links:
  related_decisions: []
  related_changes: []
summary: "System architecture overview — context, containers, components, data flow, topology."
---

# Architecture Overview

_A high-level picture of the system that agents and engineers navigate. Keep diagrams as the primary medium; use prose to explain why, not to restate what the diagram shows._

## System context (C4 L1)
_Show the system and its external actors/systems as a single diagram._
- <The system under description> — <one-line purpose>
- <External actor or system> — <interaction / data exchanged>
## Container diagram (C4 L2)
_Show the high-level deployable units (services, apps, databases) and how they interact. Use Mermaid._
- <Container, e.g. web app> — <technology, responsibility>
- <Container, e.g. database> — <technology, data owned>
## Components
_Within each container, name the key components/modules and their responsibilities._
| Component | Container | Responsibility |
|---|---|---|
| <component name> | <container> | <what it does> |
| <component name> | <container> | <what it does> |
## Module governance
_The rules that govern the modules above — where new code belongs, which dependencies are permitted, and what crosses each boundary — so an AI delivery team can place code deterministically and mock the right seams. Omit any subsection if it is trivial for a small repo._
### Module-residence rules
_Where each capability type of code should live (resolve capability-type → owning module/path, instead of guessing)._
<!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
| Capability type | Owning module / path pattern | Notes |
|---|---|---|
| new API endpoint | `src/<component>/api/` | HTTP entrypoints |
| new domain rule | `src/<component>/domain/<context>/` | business logic |
| new CLI command | `src/<component>/cli/commands/` | user-invoked |
| <capability type> | `src/<component>/<…>` | <notes> |
Rule: place new code by capability type, not by guess; if a capability type is unlisted, add a row before placing the code. Residence rules are scoped per component named in the Components table above. (Single-component repo: omit the `<component>/` segment — e.g. `src/api/`.)
### Dependency-direction / layering matrix
_Which modules may depend on which. Example tiers — adapt to your architecture._
Tiers (example): presentation → application → domain → infrastructure.
Invariant: no dependency may point upward or sideways across tiers; the matrix below specifies which downward dependencies are permitted.
<!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
| From → To | presentation | application | domain | infrastructure |
|---|---|---|---|---|
| presentation | — | ✓ | ✗ | ✗ |
| application | ✗ | — | ✓ | ✓ |
| domain | ✗ | ✗ | — | ✗ |
| infrastructure | ✗ | ✗ | ✗ | — |
| <your tier> | <…> | <…> | <…> | <…> |
Example: "API layer may import domain layer; domain layer may NOT import API layer." (Here "API layer" maps to the application/edge tier; map your project's real layer names to the tiers above.)
### Internal interface contracts
_Lightweight contracts for what crosses each module boundary (signature + return/error shape — not a versioned registry)._
<!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
| Boundary (A → B) | Operation | Signature | Returns | Errors |
|---|---|---|---|---|
| cart → inventory | checkAvailability | `checkAvailability(sku, qty)` | `AvailabilityResult{ available: bool, onHand: int }` | `ItemNotFound` |
| <A → B> | <operation> | `<signature>` | <returns> | <errors> |
Scope: signature + return/error shape only.
### Feature → component ownership map (OPTIONAL)
_One-hop lookup from a feature to its owning component(s). Omit for small repos where the Components table above suffices._
<!-- Example rows — replace with your project's modules/components. Keep one <...> placeholder row as a model. -->
| Feature | Owning component(s) |
|---|---|
| Checkout | cart, inventory, pricing |
| <feature> | <component(s)> |
### Module-boundary heuristics
_Cohesion/coupling triggers for when to split or merge modules._
- A module with **> `<N>` responsibilities** (example threshold: 3) **/ > 1 reason to change → split** by responsibility.
- Two modules that **always change together → consider merging**.
- High cohesion within a module; low coupling across modules.
- A dependency mocked in **> 1 unrelated test → consider an interface boundary**.
## Data flow
_Trace the primary flows (request, event, batch) end to end._
- <Flow name, e.g. "User request"> — <source → steps → sink>
- <Flow name, e.g. "Background event"> — <trigger → consumer → side effect>
## External dependencies and integrations
_Name every external system, API, and provider; note ownership and criticality._
| System / API / provider | Purpose | Ownership | Criticality |
|---|---|---|---|
| <name> | <what it provides> | <owner> | <low / medium / high> |
| <name> | <what it provides> | <owner> | <low / medium / high> |
## Deployment topology
_Where each container runs (regions, clusters, managed services) and how traffic reaches it._
| Container | Where it runs | How traffic reaches it |
|---|---|---|
| <container> | <region / cluster / managed service> | <load balancer / gateway / DNS> |
| <container> | <region / cluster / managed service> | <load balancer / gateway / DNS> |
## Key architectural decisions
_Link the precedent-setting decisions to their records in `doc/decisions/`._
| Decision | Decision record |
|---|---|
| <decision summary> | <ADR link, e.g. `doc/decisions/ADR-0001-...md`> |
| <decision summary> | <ADR link> |
## Known constraints and uncertainty flags
_List fixed constraints (cost, compliance, latency budgets) and explicitly flag areas of low confidence for human confirmation (especially for legacy reconstruction)._
- Constraint: <cost / compliance / latency budget>
- Uncertain: <area, e.g. legacy module X> — <confidence: low / medium / high>
