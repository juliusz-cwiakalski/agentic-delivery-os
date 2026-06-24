---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-decision-records.md

id: SPEC-DECISION-RECORDS
status: Current
created: 2026-03-10
last_updated: 2026-04-26
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-32", "GH-52"]
  guides:
    - "doc/guides/decision-records-management.md"
summary: "Tracker-agnostic decision records standard supporting ADR/PDR/TDR/BDR/ODR with unified storage, optional business/product/operational metadata, and lifecycle integration."
---

# Feature: Decision Records Management

## Overview

ADOS provides a tracker-agnostic standard for recording and managing significant project decisions. The system supports five decision types — Architecture (ADR), Product (PDR), Technical (TDR), Business (BDR), and Operational (ODR) — all co-located in a flat `doc/decisions/` directory. GH-52 extends the template with optional metadata for business/product/operational context while preserving ADR/TDR compatibility.

## Business Context

### Problem Statement

- **Problem:** Significant decisions lack durable documentation, causing repeated debates, lost institutional knowledge, and onboarding friction.
- **Affected Users:** Engineers, architects, product owners, and new team members.
- **Business Impact:** Without decision records, teams lose the rationale behind architectural and product choices when team members rotate.

### Goals & Success Metrics

- **Primary Goal:** Every precedent-setting decision has a discoverable, structured record with context, alternatives, and rationale.
- **KPIs:** Decision records directory exists and is integrated with agent tooling (`@architect`, `/plan-decision`, `/write-decision`).

## User Experience & Functionality

### Decision Types

| Type | Prefix | Scope |
|------|--------|-------|
| Architecture Decision Record | `ADR` | System design, infrastructure patterns, API boundaries |
| Product Decision Record | `PDR` | Product scope, roadmap priority, product experience direction |
| Technical Decision Record | `TDR` | Technology choices, libraries, implementation approach |
| Business Decision Record | `BDR` | ICP, pricing, GTM, positioning, business model choices |
| Operational Decision Record | `ODR` | Cadence, responsibilities, process, operating model choices |

### Capabilities

- **Structured authoring (F-1):** Template with front-matter skeleton and required sections (Context, Problem Framing, Constraints (Hard Requirements), Decision Drivers, Alternatives, Decision, Consequences, Verification Criteria).
- **Optional extended metadata (F-7):** `decision_area`, `decision_scope`, `reversibility`, `review_date`, `business_impact`, `customer_impact`, and optional links to experiments/metrics/roadmap items.
- **Compatibility (F-8):** ADR/TDR usage remains valid without extended fields.
- **Lifecycle management (F-2):** Status transitions from Proposed → Under Review → Accepted → (Deprecated | Superseded).
- **Immutability after acceptance (F-3):** Accepted decisions are not modified; changes create new superseding records.
- **Cross-linking (F-4):** Decision records link to change specs via `links.related_changes` and vice versa via `links.decisions`.
- **Agent integration (F-5):** `@architect` creates records via `/plan-decision` + `/write-decision`; records target `doc/decisions/`.
- **Index maintenance (F-6):** `doc/decisions/00-index.md` provides a table of all records.

### Naming Convention

```
<TYPE>-<zeroPad4>-<slug>.md
```

- Each type has its own sequence (ADR-0001 and PDR-0001 can coexist)
- Numbers are never reused
- Slug is kebab-case, max 60 characters

Examples: `ADR-0001-event-bus-selection.md`, `PDR-0001-free-tier-scope.md`

### Lifecycle

```
Proposed → Under Review → Accepted → (Deprecated | Superseded)
```

| Status | Meaning |
|--------|---------|
| Proposed | Initial draft; open for discussion |
| Under Review | Actively being reviewed by stakeholders |
| Accepted | Finalized; teams should follow it |
| Deprecated | No longer applicable; preserved for history |
| Superseded | Replaced by a newer record (linked via `superseded_by`) |

### Governance

| Decision Type | Reviewers |
|--------------|-----------|
| ADR | Architecture lead, affected service owners |
| PDR | Product owner, engineering lead |
| TDR | Tech lead, affected developers |
| BDR | Product owner, business stakeholders |
| ODR | SRE/platform lead, affected service owners |

### When to Create a Decision Record

Create a record when a decision is hard to reverse, has cross-component impact, involves trade-offs, changes security posture, introduces a new dependency, establishes business/product/operating direction, or is likely to be questioned later. Pricing decisions default to BDR unless product or operating scope makes PDR or ODR more appropriate. Do not create records for implementation details, bug fixes, or routine documentation-only changes.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/decisions/` | Decision records directory | Flat directory containing all decision records, co-located by type prefix |
| `doc/decisions/README.md` | Directory overview | Purpose, naming convention, lifecycle summary, and references |
| `doc/decisions/00-index.md` | Index | Table of all decision records with ID, type, title, status, date, owners |
| `doc/guides/decision-records-management.md` | Management guide | Full standard: types, naming, lifecycle, front matter, required sections, governance |
| `doc/templates/decision-record-template.md` | Authoring template | Reusable template with front-matter skeleton, all sections, and inline HTML-comment guidance |
| `.opencode/agent/architect.md` | Architect agent | Creates decision records; targets `doc/decisions/` |
| `.opencode/command/write-decision.md` | Write Decision command | Generates decision record from planning context |
| `.opencode/command/plan-decision.md` | Plan Decision command | Interactive decision planning session |

### Front Matter Schema

```yaml
id: ADR-0001
decision_type: adr          # adr | pdr | tdr | bdr | odr
status: Proposed             # Proposed | Under Review | Accepted | Deprecated | Superseded
created: 2026-03-10
decision_date: null          # Set when Accepted
last_updated: 2026-03-10
summary: "Short one-line summary"
owners: ["team-platform"]
service: "delivery-os"
decision_area: null         # optional
decision_scope: null        # optional
reversibility: null         # optional
review_date: null           # optional
business_impact: null       # optional
customer_impact: null       # optional
links:
  related_changes: []        # workItemRef identifiers
  supersedes: []             # Decision IDs this record replaces
  superseded_by: []          # Decision IDs that replace this record
  spec: []                   # Related spec paths
  contracts: []              # Related contract paths
  diagrams: []               # Related diagram paths
  decisions: []              # Other related decision record IDs
  experiments: []            # optional
  metrics: []                # optional
  roadmap_items: []          # optional
```

### Required Sections

1. Title (`# <TYPE>-<zeroPad4>: <Title>`)
2. Context
3. Problem Framing (Clarified)
4. Constraints (Hard Requirements)
5. Decision Drivers
6. Mental Models & Techniques Used
7. Alternatives Considered (at least 2 options + do-nothing baseline; each alternative includes a constraint-compliance evaluation)
8. Decision (with constraint-compliance attestation or, for negotiable constraints, a documented accepted-risk exception)
9. Trade-offs & Consequences (positive outcomes, negative outcomes, unresolved questions)
10. Implementation Plan
11. Verification Criteria
12. Confidence Rating
13. Lessons Learned (Retrospective)
14. Examples & Usage (Optional)
15. References

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Completeness | Guide defines all 5 decision types with lifecycle, naming, and governance | 100% coverage |
| NFR-2 | Template validity | Template renders as valid GitHub-flavored Markdown and keeps extended metadata optional | All sections present; ADR/TDR-compatible |
| NFR-3 | Agent alignment | `@architect`, `/write-decision`, `/plan-decision` all target `doc/decisions/` | Zero references to `doc/adr/` |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Template validation | Copy template to `doc/decisions/`; verify all sections render correctly |
| Manual | Agent workflow | Run `/plan-decision` + `/write-decision`; verify output lands in `doc/decisions/` with correct naming |
| Search | Reference consistency | Grep for `doc/adr/` across repo; expect zero matches |

## Dependencies & Risks

- **Depends on:** `@architect` agent for automated creation workflow
- **Depends on:** Document templates feature for the decision record template
- **Risk:** Process overhead may discourage adoption — mitigated by lightweight design (single template, flat directory, familiar lifecycle)

## Related Documentation

- **Management guide:** [doc/guides/decision-records-management.md](../../guides/decision-records-management.md) — full standard
- **Template:** [doc/templates/decision-record-template.md](../../templates/decision-record-template.md)
- **Directory:** [doc/decisions/](../../decisions/)
- **Onboarding guide:** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md) — includes decision records setup instructions
