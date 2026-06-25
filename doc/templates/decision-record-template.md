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
# --- optional additive blocks (all optional; omit for any record) ---
classification:                           # optional (DM-1): drives routing & rendering
  domains: []                             # e.g., [architecture, security]
  archetype: null                         # selection | design | policy | go_no_go | ...
  environment: null                       # Cynefin: clear | complicated | complex | chaotic
  rigor: null                             # R0 | R1 | R2 | R3 (R0 produces no record)
  reversibility: null                     # easy | moderate | hard
  stakes: null                            # low | medium | high
  urgency: null                           # low | medium | high
  uncertainty: null                       # low | medium | high
  blast_radius: null                      # local | team | org | customers | market
  recurrence: null                        # one-off | recurring
governance:                               # optional (DM-2): DACI decision rights
  driver: null                            # who coordinates the process
  decider: null                           # the one accountable authority
  contributors: []                        # expertise/evidence providers
  reviewers: []                           # required reviewers/agreers
  performers: []                          # who executes the decision
  informed: []                            # who is notified
ai_assistance:                            # optional (DM-3): provenance; recommendation != decision
  used: false                             # was AI assistance used in this record?
  roles: []                               # e.g., [researcher, analyst, critic, record-writer]
  external_data_shared: false             # was any data sent to an external AI?
  citations_verified: false               # were AI-provided citations checked?
  human_decider: null                     # the authorized human decider (required before Accepted for R2/R3)
  reviewers: []                           # human reviewers of the AI-assisted output
revisit_triggers: []                      # optional (DM-4): conditions that should reopen this decision
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
5. See doc/guides/decision-making.md for the decision PROCESS (kernel, rigor, rights, AI authority)
6. See doc/guides/decision-records-management.md for the record-artifact standard

PROPORTIONAL RENDERING (render by rigor; one template, scaled depth):
- R0 (routine/delegated): NO record — optional note/commit/ticket comment only.
- R1 (lightweight): compact brief — render ONLY: Context, Problem Framing,
  Constraints (Hard Requirements), Decision Drivers, Mental Models & Techniques,
  Alternatives Considered (baseline + >=1 option), Decision, owner, revisit
  trigger. Omit the R3-only sections (full Implementation Plan, Verification
  Criteria, Confidence Rating, Lessons Learned, Examples). R1 resolves within
  1 business day; it is a STRICT PROPER SUBSET of the R3 record.
- R2 (standard): the full canonical record below.
- R3 (high assurance): the full canonical record PLUS independent challenge
  (@decision-critic via /review-decision), a human final decision, and a
  review_date. status stays Proposed until an authorized human decides.
-->

# <TYPE>-<zeroPad4>: <Title>

<!-- Use a clear, descriptive title that captures the essence of the decision -->

## Context

<!-- Describe the situation that prompted this decision (situational facts, not pass/fail gates).
      Include:
      - What is happening now (current state)
      - Why a decision is needed (triggers)
      - Prior decisions, metrics, or events that inform this one
      NOTE: do NOT list binary constraints here — those belong in the
      Constraints (Hard Requirements) section below. Context is situational
      facts only.
-->

## Problem Framing (Clarified)

<!-- Reframe the problem in objective technical terms.
     Focus on underlying causes rather than symptoms.
     Separate facts from assumptions.
-->

## Constraints (Hard Requirements)

<!-- List the binary pass/fail gates that alternatives must satisfy to be eligible.
     Constraints are PASS/FAIL gates — they ELIMINATE alternatives rather than rank them.
     This is distinct from Decision Drivers (continuous preferences used to rank survivors).

     Authoring guidance:
     - An EMPTY section is a conscious author choice, not an omission. If a decision
       genuinely has no hard requirements, state that explicitly (e.g., "No constraints
       identified.") so the emptiness is deliberate and reviewable.
     - TABLE-STAKES constraints (those every alternative already satisfies) receive a brief
       acknowledgment rather than a per-constraint entry — list them once in a sentence.

     Record each constraint as a structured entry (see the template below). Assign compact
     identifiers C-1, C-2, … so the Alternatives Considered and Decision sections can
     cross-reference specific constraints.
-->

### C-1: <constraint statement>

<!-- State the requirement as a pass/fail test. -->

- **Statement:** <!-- The requirement, phrased so compliance is verifiable (pass/fail). -->
- **Source:** <!-- One of: regulatory | contractual | prior decision | AC | internal standard -->
- **Verification:** <!-- One of: test | audit | code review | architect sign-off | demonstration
      (verification is NOT limited to automated checks — non-code constraints such as
      regulatory requirements are first-class). -->
- **Negotiable:** <!-- yes | no. "no" = a violation disqualifies the alternative; "yes" = a
      documented accepted-risk exception may be recorded in the Decision section. -->

<!-- Duplicate this block for each constraint (C-2, C-3, …). -->

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

### Per-Alternative Constraint-Compliance Evaluation

<!-- Every alternative MUST include an explicit evaluation of its compliance with each
     documented constraint (C-1, C-2, …) from the Constraints section above — NOT only
     pros/cons against drivers. This eliminates silent constraint violations.

     Choose the presentation format via this readability heuristic:
     - PROSE (1–2 sentences per alternative): when all alternatives satisfy the constraints,
       or only one or two violations need explanation.
     - MATRIX (constraints × alternatives): when ≥3 constraints have mixed compliance across
       alternatives, or when prose would exceed ~3 sentences per alternative. Example:

       |          | C-1 | C-2 | C-3 |
       |----------|-----|-----|-----|
       | Alt 0    | ✅  | ❌  | ✅  |
       | Alt 1    | ✅  | ✅  | ✅  |
       | Alt 2    | ❌  | ✅  | ⚠️  |

       Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (the constraint must be marked `Negotiable: yes`)

     - DEFAULT TO MATRIX when unsure.
     - TABLE-STAKES constraints (every alternative satisfies them) get a brief one-line
       acknowledgment rather than a per-alternative compliance listing.
-->

### Alternative 0 — Do Nothing / Keep Current Approach

<!-- What happens if we make no change? -->

- **Summary:** <!-- Brief description -->
- **Pros:** <!-- Benefits of inaction -->
- **Cons:** <!-- Risks of inaction -->
- **Constraint compliance:** <!-- Explicit evaluation vs each constraint (C-1, C-2, …),
      or a matrix row. State pass/fail and reference the constraint ID for any failure. -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

### Alternative 1 — <Name>

- **Summary:** <!-- Brief description -->
- **Pros:** <!-- Benefits, aligned with drivers -->
- **Cons:** <!-- Risks, costs, constraints violated -->
- **Constraint compliance:** <!-- Explicit evaluation vs each constraint (C-1, C-2, …),
      or a matrix row. -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

### Alternative 2 — <Name>

- **Summary:** <!-- Brief description -->
- **Pros:** <!-- Benefits -->
- **Cons:** <!-- Risks -->
- **Constraint compliance:** <!-- Explicit evaluation vs each constraint (C-1, C-2, …),
      or a matrix row. -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

## Decision

<!-- State the final decision clearly.
      - Tie rationale explicitly back to decision drivers
      - List key assumptions
      - Note any conditions under which this decision should be revisited
-->

### Constraint Compliance Attestation

<!-- The Decision section MUST explicitly attest that the chosen alternative satisfies EVERY
     documented constraint (C-1, C-2, …). Two cases:

     1. FULL COMPLIANCE — attest it explicitly, e.g., "The chosen alternative satisfies all
        constraints C-1 … C-n."

     2. ACCEPTED-RISK EXCEPTION — for any constraint the chosen alternative violates,
        document an accepted-risk exception. This is permitted ONLY for constraints marked
         `negotiable: yes`. A constraint marked `negotiable: no` that the chosen
         alternative violates is DISQUALIFYING by definition and must not be waved through.

     Exception format (one per violated negotiable constraint):
     - Constraint ID: C-<n> (negotiable: yes)
     - Nature of the violation: <what fails>
     - Accepted risk: <why the violation is consciously accepted>
     - Mitigation / revisit trigger: <how/when this is revisited>
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
