---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/decision-record-template.md
id: <TYPE>-<zeroPad4>                    # e.g., ADR-0001, PDR-0001
decision_type: <type>                    # adr | pdr | tdr | bdr | odr
status: Proposed                         # Proposed | Under Review | Accepted | Deprecated | Superseded
created: <YYYY-MM-DD>                    # UTC date when file is first created
decision_date: null                      # Set to YYYY-MM-DD when status changes to Accepted
last_updated: <YYYY-MM-DD>              # UTC date of last modification
summary: "<Short one-line summary>"
owners:
  - <owner-or-team>                      # At least one entry required
service: <primary-impacted-service>      # e.g., "delivery-os", "billing-service"
decision_area: null                       # optional: architecture | product | business | operations | mixed
decision_scope: null                      # optional: repo | product-line | org
reversibility: null                       # optional: easy | moderate | hard
review_date: null                         # optional: YYYY-MM-DD
business_impact: null                     # optional short impact statement
customer_impact: null                     # optional short impact statement
links:
  related_changes: []                    # workItemRef identifiers (e.g., "GH-32", "PDEV-123")
  supersedes: []                         # Decision IDs this record replaces
  superseded_by: []                      # Decision IDs that replace this record
  spec: []                               # Paths to related spec files
  contracts: []                          # Paths to related contract files
  diagrams: []                           # Paths to related diagram files
  decisions: []                          # Other related decision record IDs
  experiments: []                        # optional experiment IDs/docs
  metrics: []                            # optional metric IDs/docs
  roadmap_items: []                      # optional roadmap item IDs/docs
---

<!-- TEMPLATE INSTRUCTIONS
1. Copy this file to doc/decisions/<TYPE>-<zeroPad4>-<slug>.md
2. Replace all <...> placeholders with actual values
3. Remove these instructions before finalizing
4. Business/product/operational metadata fields are optional for ADR/TDR; use when relevant
5. See doc/guides/decision-records-management.md for the full standard
-->

# <TYPE>-<zeroPad4>: <Title>

<!-- Use a clear, descriptive title that captures the essence of the decision -->

## Context

<!-- Describe the technical/architectural situation that prompted this decision.
     Include:
     - What is happening now (current state)
     - Why a decision is needed (triggers)
     - Relevant constraints (technical, organizational, regulatory)
     - Prior decisions that inform this one
-->

## Problem Framing (Clarified)

<!-- Reframe the problem in objective technical terms.
     Focus on underlying causes rather than symptoms.
     Separate facts from assumptions.
-->

## Decision Drivers

<!-- List and prioritize the factors that this decision optimizes for.
     Group by category:

     **Business drivers:**
     - e.g., Cost reduction, time-to-market, risk mitigation

     **Technical drivers:**
     - e.g., Performance, reliability, maintainability, coupling

     **Operational drivers:**
     - e.g., Operability, observability, cognitive load, team skills
-->

## Mental Models & Techniques Used

<!-- List reasoning tools applied during analysis.
     Examples: First Principles, Inversion, Second-Order Thinking,
     5 Whys, Ishikawa, Opportunity Cost, Expected Value, OODA Loop
-->

## Alternatives Considered

<!-- Include at least two substantive alternatives plus a do-nothing baseline.
     For each alternative: -->

### Alternative 0 — Do Nothing / Keep Current Approach

<!-- What happens if we make no change? -->

- **Summary:** <!-- Brief description -->
- **Pros:** <!-- Benefits of inaction -->
- **Cons:** <!-- Risks of inaction -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

### Alternative 1 — <Name>

- **Summary:** <!-- Brief description -->
- **Pros:** <!-- Benefits, aligned with drivers -->
- **Cons:** <!-- Risks, costs, constraints violated -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

### Alternative 2 — <Name>

- **Summary:** <!-- Brief description -->
- **Pros:** <!-- Benefits -->
- **Cons:** <!-- Risks -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

## Decision

<!-- State the final decision clearly.
     - Tie rationale explicitly back to decision drivers
     - List key assumptions
     - Note any conditions under which this decision should be revisited
-->

## Trade-offs & Consequences

### Positive Outcomes

<!-- Benefits expected from this decision -->

### Negative Outcomes

<!-- Known downsides, additional complexity, or risks introduced -->

### Unresolved Questions

<!-- Remaining risks, information gaps, or areas requiring validation.
     Include owner where possible:
     - [ ] Question (owner: @person-or-team)
-->

## Implementation Plan

<!-- High-level only — no low-level tasks, file names, or code.
     Include:
     1. Requirements and refactors implied by the decision
     2. Rollout strategy and guardrails
     3. Risk mitigation during implementation
-->

## Verification Criteria

<!-- Concrete KPIs or signals for evaluating the decision's impact.
     Include targets and timeframes:
     - Metric: <name> — Target: <value> — Window: <timeframe>
-->

## Confidence Rating

<!-- State: Low | Medium | High
     Justify by reference to data, precedent, or gaps.
-->

## Lessons Learned (Retrospective)

<!-- Populate after the decision is implemented and observed.
     Initially: "TODO: Populate after implementation."
-->

## Examples & Usage (Optional)

<!-- Representative scenarios, configurations, or flows where this decision applies.
     Omit this section if not yet applicable.
-->

## References

<!-- Links to related artifacts:
     - Change specs, implementation plans
     - System specs, contracts
     - Prior decision records
     - External sources or research
-->
