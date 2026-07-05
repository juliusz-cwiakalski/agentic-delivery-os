---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/decision-records-management.md
ados_distribution: redistributable
---
# Decision Records Management Guide

> **This guide is a record-artifact reference.** The decision **process** — the
> universal kernel (D0–D14), proportional rigor (R0–R3 + emergency overlay),
> four-axis classification, decision rights (DACI), the bounded AI-authority
> model, the per-type nuance matrix, and the constraints/drivers discipline —
> now lives in the **[Decision-Making Guide](decision-making.md)**. Read that
> guide first when deciding *how much process* a decision needs; this document
> covers the record artifact itself: naming, front matter, required sections,
> lifecycle, and governance.

> **Audience:** Engineers, product owners, architects, and AI agents.
>
> **Goal:** Establish a lightweight, tracker-agnostic standard for recording and managing decisions across all types — Architecture (ADR), Product (PDR), Technical (TDR), Business (BDR), and Operational (ODR).

---

## 1. Overview

Decision records capture the **context, drivers, alternatives, and rationale** behind significant decisions. They serve as durable artifacts that:

- Preserve institutional knowledge across team changes
- Enable future teams to understand *why* decisions were made
- Provide change triggers when underlying assumptions evolve
- Support onboarding by explaining the current state's origins

This guide defines the decision **record artifact** standard for ADOS-managed repositories (naming, front matter, sections, lifecycle, governance). It is **tracker-agnostic** — the same conventions work whether your project uses GitHub Issues, Jira, Linear, or any other tracker. For the decision *process* (when to record, how much ceremony, who decides), see the [Decision-Making Guide](decision-making.md).

---

## 2. Decision Types

| Type | Prefix | Scope | Examples |
|------|--------|-------|---------|
| **Architecture Decision Record** | `ADR` | System design, infrastructure patterns, API boundaries | Event bus selection, API versioning strategy, microservice decomposition |
| **Product Decision Record** | `PDR` | Feature scoping, UX strategy, product positioning | Feature prioritization framework, MVP scope, pricing model |
| **Technical Decision Record** | `TDR` | Technology choices, libraries, implementation approach | State management library, testing framework, build tooling |
| **Business Decision Record** | `BDR` | Business rules, compliance, process policies | Subscription tier structure, data retention policy, SLA definitions |
| **Operational Decision Record** | `ODR` | Infrastructure, deployment, monitoring, incident response | Deployment pipeline design, alerting thresholds, on-call rotation |

### ADR vs TDR — rule of thumb and tie-breaker

Both ADR and TDR can involve technology, so they blur:

- **TDR** — selecting a specific technology, library, framework, tool, build/test
  tooling, or implementation pattern *within an already-decided architecture*.
- **ADR** — system structure, service/module boundaries, integration patterns,
  API/event contracts, architecture-defining topology, durable cross-component
  constraints.

**Tie-breaker (when both fit):** prefer **ADR** when `reversibility: hard` **or**
`blast_radius ≥ team`; otherwise prefer **TDR**. The tie is recorded via
`classification.conditions`. The full rule of thumb and reasoning live in the
[Decision-Making Guide §7](decision-making.md).

### Common overlap guidance

Borderline cases route to the type whose concern is the **primary driver**:

| Case | Routing |
|------|---------|
| **Pricing** | **PDR** if packaging/value/tier design; **BDR** if revenue, contracts, or commercial policy |
| **Infrastructure** | **ADR** if it shapes the system (platform, topology, contract); **ODR** if it operates an existing system (runbooks, alerting, on-call) |
| **Data retention** | **BDR** (business/legal rule) · **ODR** (operational enforcement) · **ADR** (storage architecture/contracts) |
| **Security / privacy** | A `domains` tag (e.g., `[security]`, `[privacy]`) **plus** the primary owning type — there is no standalone "Security Record" type |

Specialized concerns (security, privacy, ML, vendor, UX, …) are routed to
`classification.domains` plus the owning type — **never** to a new top-level
prefix. See the [Decision-Making Guide §4](decision-making.md) for the
domains-first extension.

### When to Create a Decision Record

Create a record when:

- The decision is **hard to reverse** or sets a precedent
- It has **cross-component or cross-team impact**
- It involves a **trade-off** between competing goals
- It changes the **security or privacy posture**
- It introduces a **new dependency** (infrastructure, vendor, library)
- The rationale is likely to be **questioned later**

### When NOT to Create a Record (R0)

- Implementation details (covered in change specs and plans)
- Bug fixes (use change workflow)
- Documentation-only changes (unless they represent a policy decision)
- Routine, reversible, policy-covered choices — see the **R0 escape hatch** in the [Decision-Making Guide](decision-making.md); an optional note/commit/ticket comment is enough.

---

## 3. Location and Naming

### Location

All decision records live in a **flat directory**:

```
doc/decisions/
```

All types are co-located. Prefixes distinguish types.

### Naming Convention

```
<TYPE>-<zeroPad4>-<slug>.md
```

- **`<TYPE>`**: Decision type prefix (`ADR`, `PDR`, `TDR`, `BDR`, `ODR`)
- **`<zeroPad4>`**: Zero-padded 4-digit sequential number within the type
- **`<slug>`**: Kebab-case title, ≤60 characters

### Examples

```
ADR-0001-event-bus-selection.md
ADR-0002-api-versioning-strategy.md
PDR-0001-free-tier-scope.md
TDR-0001-state-management-library.md
BDR-0001-data-retention-policy.md
ODR-0001-deployment-pipeline-design.md
```

### Numbering

- Each type has its **own sequence** (ADR-0001 and PDR-0001 can coexist)
- Numbers are **never reused** — if a record is deprecated or superseded, its number remains
- To find the next number: scan `doc/decisions/<TYPE>-*-*.md`, take the highest, add 1

### Index File

Maintain `doc/decisions/00-index.md` as a table of all decision records. This can be manually updated or auto-generated.

---

## 4. Lifecycle

```
Proposed → Accepted → (Deprecated | Superseded)
```

| Status | Meaning |
|--------|---------|
| **Proposed** | Pre-merge working state on a feature/inception branch; open for discussion and revision. Records merged to `main` should be `Accepted` — `Proposed` is not a permanent state on `main`. |
| **Accepted** | Decision is finalized and merged to `main`; teams should follow it. `decision_date` and `review_date` are set. |
| **Deprecated** | No longer applicable but preserved for historical reference |
| **Superseded** | Replaced by a newer decision record (link via `superseded_by`) |

### Status Transitions

- `Proposed` → `Accepted`: PR is reviewed and merged; `decision_date` and `review_date` are set
- `Accepted` → `Deprecated`: Context has changed; decision no longer applies
- `Accepted` → `Superseded`: A new decision record explicitly replaces this one

### Iterative review

Every `Accepted` record carries a `review_date` (front matter). The retrospective
process is iterative:

1. **First retro** — shortly after implementation (days–weeks). Captures
   process/evidence/execution quality. Set `review_date` to a case-by-case
   horizon for a longer-perspective review.
2. **Subsequent retros** — at each `review_date`, assess the realized outcome
   with hindsight. Set a new `review_date` if further observation is warranted,
   or transition to `Deprecated`/`Superseded`.

Records with a `review_date` in the past are candidates for the next retro cycle.

### Immutability

Once **Accepted**, the core decision statement should not change. If the decision needs revision:

1. Create a **new** decision record
2. Set `supersedes: ["<TYPE>-<zeroPad4>"]` in the new record's front matter
3. Set `superseded_by: ["<TYPE>-<zeroPad4>"]` in the old record's front matter
4. Change the old record's status to `Superseded`

---

## 5. Front Matter

Every decision record must include YAML front matter. See
[`doc/templates/decision-record-template.md`](../templates/decision-record-template.md)
for the full skeleton, including the optional `classification`, `governance`,
`ai_assistance`, and `review_date`/revisit-trigger blocks (all optional and
additive). Minimum front matter:

```yaml
---
id: ADR-0001
decision_type: adr          # adr | pdr | tdr | bdr | odr
status: Proposed             # Proposed | Under Review | Accepted | Deprecated | Superseded
created: 2026-03-10
decision_date: null          # Set when status changes to Accepted
last_updated: 2026-03-10
summary: "Short one-line summary of the decision"
owners: ["team-platform"]
service: "delivery-os"       # Primary impacted service or domain
links:
  related_changes: []        # workItemRef identifiers (e.g., GH-32)
  supersedes: []             # Decision IDs this record replaces
  superseded_by: []          # Decision IDs that replace this record
  spec: []                   # Paths to related specs
  contracts: []              # Paths to related contracts
  diagrams: []               # Paths to related diagrams
  decisions: []              # Other related decision record IDs
---
```

### Front-matter

The template front matter uses `classification` as the canonical home for
routing metadata (`reversibility`, `domains`, `archetype`, `rigor`, etc.).
`decision_type` (adr/pdr/tdr/bdr/odr) and `classification.domains` together
provide type + domain routing without redundancy. See the
[template front matter](../templates/decision-record-template.md) for the exact
key set.

`review_date` (YYYY-MM-DD) drives the iterative review cycle: records with a
`review_date` in the past are candidates for the next retrospective. Set it on
Acceptance and update after each retro.

**Section depth follows the tiered-default model** (rigor is the primary axis;
type/archetype toggle only small enumerated add-ons) documented in the
[Decision-Making Guide §3](decision-making.md). The template remains the
section-order authority.

---

## 6. Required Sections

Every decision record must include these sections in order. The template
([`doc/templates/decision-record-template.md`](../templates/decision-record-template.md))
is the single source of truth for this order; **section depth is driven by the
tiered-default model** (rigor primary; type/archetype add-ons) — see the
[Decision-Making Guide §3](decision-making.md):

1. **Title**: `# <TYPE>-<zeroPad4>: <Title>`
2. **Context**: Background, triggers, and situational facts (the situation that prompted the decision — not pass/fail gates)
3. **Problem Framing**: Objective reframing of the problem
4. **Constraints (Hard Requirements)**: Binary pass/fail gates that eliminate alternatives, recorded as structured entries (see §6.1)
5. **Decision Drivers**: Prioritized factors (business, technical, operational)
6. **Decision Rights (DACI)**: Driver, decider/approver, contributors, required reviewers, performers, informed
7. **Evidence, Assumptions & Unknowns**: FACT / ASSUMPTION / TO-CONFIRM items, with technical-selection evidence packs when applicable
8. **Mental Models & Techniques Used**
9. **Alternatives Considered**: At least 2 options + do-nothing baseline; each alternative includes eligibility and constraint-compliance evaluation
10. **Decision**: Recommendation, Authorized Decision, and Constraint Compliance Attestation as separate surfaces
11. **Trade-offs & Consequences**: Positive outcomes, negative outcomes, unresolved questions
12. **Implementation Plan**
13. **Rollback / Reversal**
14. **Communication Plan**
15. **Verification Criteria**: How to measure the decision's success
16. **Confidence Rating**
17. **Structured Retrospective**
18. **Examples & Usage (Optional)**
19. **References**: Links to related artifacts

### 6.1 Constraints (Hard Requirements) — authoring discipline

**Constraints vs drivers.** *Decision drivers* are continuous preferences the decision optimizes for (tradeable; used to rank alternatives). *Constraints (hard requirements)* are binary, pass/fail gates that **eliminate** alternatives rather than rank them. Keeping them separate prevents an alternative from winning on driver scores while silently violating a disqualifying gate (`negotiable: no`).

**Constraint entry fields.** Each constraint is a structured entry with five fields, assigned a compact identifier so the *Alternatives Considered* and *Decision* sections can cross-reference it:

| Field | Value |
|-------|-------|
| **ID** | `C-1`, `C-2`, … (per record) |
| **Statement** | The requirement phrased as a pass/fail test |
| **Source** | One of: `regulatory` \| `contractual` \| `prior decision` \| `AC` \| `internal standard` |
| **Verification** | One of: `test` \| `audit` \| `code review` \| `architect sign-off` \| `demonstration` (not limited to automated checks) |
| **Negotiable** | `yes` \| `no` (`no` = a violation is disqualifying; `yes` = a documented accepted-risk exception may be recorded) |

**Empty section is a conscious choice.** When a decision genuinely has no hard requirements, the author states that explicitly (e.g., "No constraints identified.") so the emptiness is deliberate and reviewable — it is never an omission.

**Table-stakes constraints** (every alternative already satisfies them) receive a brief one-line acknowledgment rather than a per-constraint entry.

**Per-alternative compliance evaluation.** Every alternative must include an explicit evaluation of its compliance against each constraint (C-1, C-2, …), not only pros/cons against drivers. Choose the format via a readability heuristic: **prose** (1–2 sentences per alternative) when all alternatives comply or only one or two violations need explanation; a **matrix** (constraints × alternatives) when ≥3 constraints have mixed compliance or prose would exceed ~3 sentences per alternative. **Default to matrix when unsure.** When using the matrix form, use the notation: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (constraint must be `Negotiable: yes`). See the template for a worked example.

**Decision-section attestation.** The *Decision* section must explicitly attest that the chosen alternative satisfies every constraint. For any constraint it violates, the author documents an **accepted-risk exception** — permitted **only** for constraints marked `negotiable: yes`. A constraint marked `negotiable: no` that the chosen alternative violates is **disqualifying** by definition and must not be waved through.

---

## 7. Governance

### Who Can Propose

Anyone on the team can propose a decision record. Create a file with `status: Proposed` and open a PR or share for discussion.

### Who Reviews

| Decision Type | Reviewers |
|--------------|-----------|
| ADR | Architecture lead, affected service owners |
| PDR | Product owner, engineering lead |
| TDR | Tech lead, affected developers |
| BDR | Product owner, business stakeholders |
| ODR | SRE/platform lead, affected service owners |

### Who Accepts

The decision owner(s) listed in the front matter `owners` field, after receiving approval from the required reviewers. High-stakes (R3) decisions require a **human final decision** (see the [Decision-Making Guide §6](decision-making.md)).

### Escalation

If consensus cannot be reached, escalate to the architecture review forum (for ADR/TDR) or product leadership (for PDR/BDR). Document the escalation in the decision record's "Unresolved Questions" section.

---

## 8. Relationship to Changes

Decision records and change specs are complementary:

- A **change** may trigger one or more decision records (when the change requires a precedent-setting choice)
- A **decision record** may be referenced by one or more changes (when the decision informs implementation)

### Linking

- In the change spec front matter: `links.decisions: ["ADR-0001"]`
- In the decision record front matter: `links.related_changes: ["GH-32"]`
- In the change spec body: reference the decision record by ID with context

---

## 9. Agent Integration

### `@decision-advisor` Agent

The `@decision-advisor` agent owns the decision workflow for all decision types (ADR, PDR, TDR, BDR, ODR). It can:

- Create decision records via the `/plan-decision` + `/write-decision` workflow
- Scan `doc/decisions/` for existing records to inform new decisions
- Link decision records to change specs

In `/plan-decision`, hard requirements (constraints) are elicited as a **distinct factor class, separate from decision drivers**, with overlap detection that warns when the same factor appears in both buckets and requires the author to categorize it into exactly one. The captured constraints flow into a `hard_requirements:` field in the planning summary (distinct from `decision_drivers:`), which `/write-decision` then renders as the *Constraints (Hard Requirements)* section. See §6.1 for the authoring discipline.

### Other Agents

- `@pm`: Routes decision-requiring situations to `@decision-advisor`
- `@spec-writer`: References decision records in change spec `links.decisions`
- `@plan-writer`: References decision records as context for implementation plans

### Project-local conventions

This guide defines the **generic** record-artifact standard. Each project can create `.ai/agent/decision-instructions.md` to specify project-specific tracking conventions (tracker integration, identifier scheme, labels, status workflow) and strategic context (priorities, values, decision principles). See the [Decision-Making Guide §11](decision-making.md) and the [blueprint template](../templates/blueprints/decision-instructions--example.md).

---

## 10. Getting Started

1. **First decision**: Copy `doc/templates/decision-record-template.md` to `doc/decisions/ADR-0001-<slug>.md`
2. **Fill in the template**: Follow the inline guidance comments
3. **Set status**: `Proposed`
4. **Request review**: Open a PR or share for discussion
5. **Accept**: Update status to `Accepted` and set `decision_date`
6. **Update index**: Add the record to `doc/decisions/00-index.md`

For automated creation, use `/plan-decision` to shape the decision context, then `/write-decision` to generate the record.

---

## References

- [Decision-Making Guide](decision-making.md) — the decision *process* (kernel, rigor, classification, rights, AI authority)
- [Decision Record Template](../templates/decision-record-template.md)
- [Decision Records Directory](../decisions/)
- [Documentation Handbook](../documentation-handbook.md) — §3 standard tree, §6 lifecycle
- [`@decision-advisor` Agent](../../.opencode/agent/decision-advisor.md) — decision workflow
