---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-decision-records.md

id: SPEC-DECISION-RECORDS
status: Current
created: 2026-03-10
last_updated: 2026-07-05
owners: [Juliusz Ćwiąkalski]
service: delivery-os
links:
  related_changes: ["GH-32", "GH-52", "GH-46", "GH-133"]
  guides:
    - "doc/guides/decision-making.md"
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
- **KPIs:** Decision records directory exists and is integrated with agent tooling (`@decision-advisor`, `/plan-decision`, `/write-decision`).

## User Experience & Functionality

### Decision Types

| Type | Prefix | Scope |
|------|--------|-------|
| Architecture Decision Record | `ADR` | System design, infrastructure patterns, API boundaries |
| Product Decision Record | `PDR` | Product scope, roadmap priority, product experience direction |
| Technical Decision Record | `TDR` | Technology choices, libraries, implementation approach |
| Business Decision Record | `BDR` | ICP, pricing, GTM, positioning, business model choices |
| Operational Decision Record | `ODR` | Cadence, responsibilities, process, operating model choices |

### ADR vs TDR — rule of thumb and tie-breaker

Both ADR and TDR can involve technology, so they blur. **TDR** covers selecting a specific technology, library, framework, tool, or implementation pattern *within an already-decided architecture*; **ADR** covers system structure, boundaries, integration patterns, API/event contracts, and durable cross-component constraints. **Tie-breaker (when both fit):** prefer **ADR** when `reversibility=hard` **or** `blast_radius≥team`, otherwise prefer **TDR**; the tie is recorded via `classification.conditions`. The full rule of thumb and reasoning live in the [Decision-Making Guide §7](../../guides/decision-making.md).

### Common overlap guidance

Borderline cases route to the type whose concern is the **primary driver**: **pricing** → PDR (packaging/value) vs BDR (revenue/contracts); **infrastructure** → ADR (system-shaping) vs ODR (operating an existing system); **data retention** → BDR/ODR/ADR by primary driver; **security/privacy** → a `classification.domains` tag plus the owning type (there is no standalone "Security Record" type). Specialized concerns (security, privacy, ML, vendor, UX, …) always route to `classification.domains` plus the owning type — never a new top-level prefix.

### Capabilities

- **Structured authoring (F-1):** Template with front-matter skeleton and the required body sections, driven by a **tiered-default applicability model** (rigor is the primary axis; type/archetype toggle only small enumerated add-ons — no full 2D matrix). The template tags each section by rigor applicability (`R1/R2/R3`, `R2/R3`, `R3-expanded`) and surfaces Decision Rights (DACI), Evidence/Assumptions/Unknowns, a recommendation-vs-authorized-decision split, eligibility-first alternatives, Rollback/Reversal, Communication Plan, and a Structured Retrospective. Worked R1/R2/R3 examples demonstrate the tiered-default rendering.
- **Clean front-matter contract for new records (F-9):** New records carry **no** top-level `decision_area` or `reversibility` — both live only inside the `classification:` block. `classification.reversibility` is the single canonical location for reversibility; `decision_area` was redundant with `decision_type` + `classification.domains`. No duplicate fields remain without a one-line justification.
- **Backward compatibility / grandfathering (F-10):** The six pre-existing records — `ADR-0001`, `ADR-0002`, `PDR-0001`, `PDR-0002`, `ODR-0001`, `TDR-0001` — retain their legacy top-level `decision_area` and `reversibility` keys. There is **no migration pass**: they are durable artifacts and remain valid as-is. Only new records follow the simplified front-matter contract. (GH-133 defines the new contract; if GH-63 — machine-enforceable decision records — is revived, it must rebase onto it.)
- **Optional extended metadata (F-7):** `decision_scope`, `review_date`, `business_impact`, `customer_impact`, and optional links to experiments/metrics/roadmap items.
- **Compatibility (F-8):** ADR/TDR usage remains valid without extended fields.
- **Lifecycle management (F-2):** Status transitions from Proposed → Under Review → Accepted → (Deprecated | Superseded).
- **Immutability after acceptance (F-3):** Accepted decisions are not modified; changes create new superseding records.
- **Cross-linking (F-4):** Decision records link to change specs via `links.related_changes` and vice versa via `links.decisions`.
- **Agent integration (F-5):** `@decision-advisor` creates records via `/plan-decision` + `/write-decision`; records target `doc/decisions/`.
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
| `doc/guides/decision-making.md` | Decision-making guide | Process-first guide: decision kernel (D0–D14), rigor levels (R0–R3 + emergency overlay), tiered-default section applicability, four-axis classification + domains-first + ADR/TDR tie-breaker, DACI rights, AI-authority model, bounded technical-selection evidence pack + security controls, three decision modes |
| `doc/guides/decision-records-management.md` | Record-artifact reference | Record standard: types, ADR/TDR tie-breaker + overlap guidance, naming, lifecycle, front matter (clean new-record contract + grandfathering note), governance (thin redirect to decision-making.md for process) |
| `doc/templates/decision-record-template.md` | Authoring template | Single source of truth for the record body: type-selection helper, clean front matter (no top-level `decision_area`/`reversibility`), tiered-default applicability tags per section, Decision Rights, Evidence/Assumptions/Unknowns + Technical-Selection Evidence Pack, recommendation-vs-authorized-decision split, eligibility-first alternatives, Rollback, Communication Plan, Structured Retrospective, and worked R1/R2/R3 examples |
| `.opencode/agent/decision-advisor.md` | Decision advisor agent | Creates decision records; domain-neutral across all five types; targets `doc/decisions/`; delegates bounded evidence gathering to `@external-researcher` for selection decisions; applies the ADR/TDR tie-breaker and R1 default-local rule _(formerly `architect.md`)_
| `.opencode/agent/decision-critic.md` | Decision critic agent | Independent, read-only decision challenger; tri-state verdict (PASS / PASS_WITH_RISKS / REWORK) |
| `.opencode/command/write-decision.md` | Write Decision command | Generates decision record from planning context (tiered-default rendering by rigor level) |
| `.opencode/command/plan-decision.md` | Plan Decision command | Interactive decision planning session (triage → classify → rigor → rights) |
| `.opencode/command/review-decision.md` | Review Decision command | Independent decision challenge (delegates to `@decision-critic`) |

### Front Matter Schema

> **New-record contract (GH-133):** new records carry **no** top-level `decision_area` or
> `reversibility` — both live only inside `classification:`. The six legacy records
> (`ADR-0001`, `ADR-0002`, `PDR-0001`, `PDR-0002`, `ODR-0001`, `TDR-0001`) are
> grandfathered with their older top-level keys and remain valid.

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
decision_scope: null        # optional
review_date: null           # optional
business_impact: null       # optional
customer_impact: null       # optional
# --- optional additive blocks (all optional; omit for any record) ---
classification:             # canonical home for routing metadata + reversibility/domains
  domains: []               # e.g., [architecture, security, ai/ml, vendor, ux]
  archetype: null           # selection | design | policy | go_no_go | ...
  rigor: null               # R0 | R1 | R2 | R3 (R0 produces no record)
  reversibility: null       # easy | moderate | hard — CANONICAL reversibility location
  stakes: null              # optional
  urgency: null             # optional
  uncertainty: null         # optional
governance:                 # optional (DACI)
  driver: null
  decider: null
  contributors: []
  informed: []
ai_assistance:              # optional
  human_decider: null
  external_data_shared: false
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

The template is the single source of truth for this order; **section depth is driven by the tiered-default model** (rigor primary; type/archetype add-ons) — see the [Decision-Making Guide §3](../../guides/decision-making.md). Each section below is tagged by rigor applicability in the template:

1. Title (`# <TYPE>-<zeroPad4>: <Title>`)
2. Context (R1/R2/R3)
3. Problem Framing (Clarified) (R1/R2/R3)
4. Constraints (Hard Requirements) (R1/R2/R3)
5. Decision Drivers (R1/R2/R3)
6. Decision Rights (DACI) (R2/R3)
7. Evidence, Assumptions & Unknowns — `FACT`/`ASSUMPTION`/`TO-CONFIRM` labels + sources (R2/R3)
8. Mental Models & Techniques Used (R1/R2/R3)
9. Alternatives Considered — eligibility-first (screen on constraints, then rank on drivers); each alternative leads with an eligibility status + constraint-compliance evaluation (R1/R2/R3)
10. Decision — split into **Recommendation** (analyst/AI advice) and **Authorized Decision** (often human), plus the Constraint Compliance Attestation (R1/R2/R3)
11. Trade-offs & Consequences (R2/R3)
12. Implementation Plan (R2/R3)
13. Rollback / Reversal (R3; mandatory for ADR/ODR with `reversibility=hard` + R3)
14. Communication Plan (R2/R3; only when `governance.informed` is non-empty)
15. Verification Criteria (R2/R3)
16. Confidence Rating (R2/R3)
17. Structured Retrospective — process/evidence/execution/outcome/luck-variance (R3)
18. Examples & Usage (Optional) (R3-expanded)
19. References (R1/R2/R3)

The template also ships worked R1/R2/R3 rendering examples in an authoring appendix. For `archetype: selection`, a bounded **Technical-Selection Evidence Pack** (top-3 candidates × ~10 fields, with canonical-source + as-of date + data-minimization) renders under Evidence, Assumptions & Unknowns.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Completeness | Guide defines all 5 decision types with lifecycle, naming, and governance | 100% coverage |
| NFR-2 | Template validity | Template renders as valid GitHub-flavored Markdown and keeps extended metadata optional | All sections present; ADR/TDR-compatible |
| NFR-3 | Agent alignment | `@decision-advisor`, `/write-decision`, `/plan-decision` all target `doc/decisions/` | Zero references to `doc/adr/` |
| NFR-4 | Front-matter cleanliness | New records carry no top-level `decision_area`/`reversibility`; `classification.reversibility` is canonical | 0 un-justified duplicate fields |
| NFR-5 | Backward compatibility | The 6 grandfathered records are untouched and remain valid | 0 migrated; legacy top-level keys retained |
| NFR-6 | Applicability model | Section depth follows the tiered-default model (rigor primary; no full 2D matrix) | Template tags each section by rigor |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Template validation | Copy template to `doc/decisions/`; verify all sections render correctly |
| Manual | Agent workflow | Run `/plan-decision` + `/write-decision`; verify output lands in `doc/decisions/` with correct naming |
| Search | Reference consistency | Grep for `doc/adr/` across repo; expect zero matches |

## Dependencies & Risks

- **Depends on:** `@decision-advisor` agent for automated creation workflow
- **Depends on:** Document templates feature for the decision record template
- **Depends on:** `@external-researcher` for bounded evidence packs on selection decisions
- **Risk:** Process overhead may discourage adoption — mitigated by lightweight design (single template, flat directory, familiar lifecycle, tiered-default rendering that keeps R1 a strict subset)
- **Risk:** Front-matter drift between grandfathered and new records — mitigated by the documented grandfathering policy (no migration; the template is the contract for new records)

## Related Documentation

- **Process guide:** [doc/guides/decision-making.md](../../guides/decision-making.md) — decision kernel, rigor levels, tiered-default applicability, classification + domains-first + ADR/TDR tie-breaker, AI-authority model, evidence pack + security controls
- **Record standard:** [doc/guides/decision-records-management.md](../../guides/decision-records-management.md) — record artifact standard (ADR/TDR tie-breaker, overlap guidance, clean front-matter contract, grandfathering)
- **Template:** [doc/templates/decision-record-template.md](../../templates/decision-record-template.md)
- **Directory:** [doc/decisions/](../../decisions/)
- **Onboarding guide:** [doc/guides/onboarding-existing-project.md](../../guides/onboarding-existing-project.md) — includes decision records setup instructions
