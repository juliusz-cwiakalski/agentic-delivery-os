---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/decision-record-template.md
ados_distribution: redistributable
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
decision_scope: null                      # optional: repo | product-line | org
review_date: null                         # YYYY-MM-DD — next scheduled review; set on Acceptance, updated after each retro
business_impact: null                     # optional short impact statement
customer_impact: null                     # optional short impact statement
# --- optional additive blocks (all optional; omit for any record) ---
classification:                           # optional: drives routing & rendering; canonical home for reversibility/domains
  domains: []                             # e.g., [architecture, security, ai/ml, vendor, ux]
  archetype: null                         # selection | design | policy | go_no_go | ...
  environment: null                       # Cynefin: clear | complicated | complex | chaotic
  rigor: null                             # R0 | R1 | R2 | R3 (R0 produces no record)
  reversibility: null                     # easy | moderate | hard — canonical reversibility location
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
ai_assistance:                            # optional: provenance
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
3. Remove guidance comments and this instruction block before finalizing
4. Business/product/operational metadata fields are optional for ADR/TDR; use when relevant
5. See doc/guides/decision-making.md for the decision PROCESS (kernel, rigor, rights, AI authority)
6. See doc/guides/decision-records-management.md for the record-artifact standard

TIERED-DEFAULT RENDERING (one template, scaled depth — rigor is the PRIMARY axis):
- R0 (routine/delegated): NO record — optional note/commit/ticket comment only.
- R1 (lightweight, STRICT PROPER SUBSET of R3): render ONLY —
    Context, Problem Framing, Constraints (Hard Requirements), Decision Drivers,
    Mental Models & Techniques, Alternatives Considered (baseline + >=1 option),
    and the Decision section (Recommendation + Authorized Decision + constraint
    attestation), plus owner + revisit trigger.
  R1 OMITS every R3-only / R2-R3 section: Decision Rights, Evidence/Assumptions/
  Unknowns, Trade-offs & Consequences, Implementation Plan, Rollback/Reversal,
  Communication Plan, Verification Criteria, Confidence Rating, Structured
  Retrospective, Examples. Never invent R3-only sections at R1. R1 resolves
  within 1 business day.
- R2 (standard): the full canonical record below EXCEPT the R3-expanded sections
  (Rollback/Reversal, Communication Plan, Structured Retrospective).
- R3 (high assurance): the full canonical record PLUS independent challenge
  (@decision-critic via /review-decision), Rollback/Reversal, Communication Plan,
  Structured Retrospective, a human final decision, and a review_date. status
  stays Proposed until an authorized human decides.

Each section below is tagged with its rigor applicability. Type/archetype toggle
only small enumerated add-ons (e.g., Technical-Selection Evidence pack only when
archetype=selection; Communication Plan only when governance.informed is
non-empty). There is NO full 2D type x rigor matrix — it defeats LLM rendering.
-->

# <TYPE>-<zeroPad4>: <Title>

<!-- Use a clear, descriptive title that captures the essence of the decision -->

> **Type-selection helper** *(authoring guidance — delete when finalizing the
> record; see [decision-making.md §7](../guides/decision-making.md) for the full
> rule and tie-breaker)*:
>
> | Mainly about… | Use | Notes |
> |---------------|-----|-------|
> | System structure, boundaries, patterns, API/event contracts | **ADR** | Architecture-defining |
> | Selecting a specific library/framework/tool/build tooling | **TDR** | Within an established architecture |
> | Feature scope, UX strategy, product positioning | **PDR** | |
> | Business rules, compliance, commercial policy, contracts | **BDR** | |
> | Infrastructure ops, deployment, monitoring, incident response | **ODR** | Operating an existing system |
>
> **Tie-breaker (ADR vs TDR):** prefer **ADR** when `reversibility: hard` **or**
> `blast_radius >= team`; otherwise prefer **TDR**. Specialized concerns
> (security, ML, vendor, UX, …) go in `classification.domains` + the owning type
> — never a new top-level prefix.

## Context

<!-- rigor: R1/R2/R3 (rendered at every rigor level) -->
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

<!-- rigor: R1/R2/R3 -->
<!-- Reframe the problem in objective technical terms.
      Focus on underlying causes rather than symptoms.
      Separate facts from assumptions.
-->

## Constraints (Hard Requirements)

<!-- rigor: R1/R2/R3 -->
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

<!-- rigor: R1/R2/R3 -->
<!-- List and prioritize the factors that this decision optimizes for.
      Group by category:

      **Business drivers:**
      - e.g., Cost reduction, time-to-market, risk mitigation

      **Technical drivers:**
      - e.g., Performance, reliability, maintainability, coupling

      **Operational drivers:**
      - e.g., Operability, observability, cognitive load, team skills
-->

## Decision Rights (DACI)

<!-- rigor: R2/R3 — omitted at R1 (owner in front matter suffices) -->
<!-- Surface the governance block early. Mirror the optional `governance:` front matter.
      Cross-reference: doc/guides/decision-making.md §5 (Decision rights).

      - Driver: who coordinates the process
      - Decider / Approver: the ONE accountable authority
      - Contributors: expertise/evidence providers
      - Required reviewers/agreers: verify mandatory requirements (constraints, policy)
      - Performers: who executes the decision
      - Informed: who is notified of the outcome
-->

## Evidence, Assumptions & Unknowns

<!-- rigor: R2/R3 — placed BEFORE Alternatives so ranking starts from a verified base.
      R1 keeps evidence inline (FACT/ASSUMPTION/TO-CONFIRM labels in Context/Problem Framing).
-->
<!-- Surface what is known vs assumed vs unconfirmed. Each item carries a label, a source,
      an impact-if-false, and a confidence note. This block precedes alternatives so that
      driver-based ranking runs on a vetted evidence base (eligibility-first, see Alternatives).

      Use three labels consistently:
      - FACT / ASSUMPTION / TO-CONFIRM   (each with a source reference)

      For technical/selection decisions (archetype: selection), gather a bounded
      evidence pack here — see the "Technical-Selection Evidence Pack" guidance
      later in this template and doc/guides/decision-making.md D2. Default:
      top-3 candidate options, ~10 highest-signal fields per candidate (expand
      when the decision warrants more alternatives); every signal
      tagged FACT / ASSUMPTION / TO-CONFIRM with canonical-source + as-of date.
-->

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| <!-- e.g., Lib X is actively maintained --> | FACT / ASSUMPTION / TO-CONFIRM | <!-- canonical URL --> | <!-- consequence --> | <!-- Low/Med/High --> |

### Technical-Selection Evidence Pack (archetype: selection)

<!-- Render ONLY for archetype: selection (a type/archetype add-on per the
     tiered-default model). Default: top-3 candidate options x ~10 highest-signal
     fields (expand when warranted). Matches doc/guides/decision-making.md D2 and the
     @external-researcher "Decision-evidence gathering mode". -->
<!-- Security controls (mandatory on every signal):
     - canonical-source  : official registry/repo URL, NOT an aggregator
     - as-of date        : when the signal was true/observed
     - data-minimization : only public identifiers were sent externally
                           (set ai_assistance.external_data_shared accordingly)
     Signals are EVIDENCE, not a blind numeric scorecard. Scorecard only if D9
     selects MCDA. License is recorded as a FACT string; compatibility is a
     human/R3 determination.
-->

**Candidate: <name>** — *researched via `@external-researcher`? yes/no*

| Signal | Label | Canonical source | As-of | Confidence |
|--------|-------|------------------|-------|------------|
| License string | FACT | <!-- registry/repo URL --> | <!-- YYYY-MM-DD --> | <!-- High --> |
| Project age / maturity | FACT/ASSUMPTION/TO-CONFIRM | | | |
| Latest release + cadence | | | | |
| Active contributors / commit activity (12mo) | | | | |
| Issue/PR responsiveness + bus factor | | | | |
| Security advisories + vulnerability handling | | | | |
| Adoption signals (stars/downloads — weak) | | | | |
| Migration/SemVer discipline | | | | |
| Integration fit | | | | |
| Lock-in / migration cost | | | | |

<!-- Duplicate the candidate block for each candidate (default 3; add more when warranted). -->

## Mental Models & Techniques Used

<!-- rigor: R1/R2/R3 -->
<!-- List reasoning tools applied during analysis.
      Examples: First Principles, Inversion, Second-Order Thinking,
      5 Whys, Ishikawa, Opportunity Cost, Expected Value, OODA Loop
-->

## Alternatives Considered

<!-- rigor: R1/R2/R3 -->
<!-- ELIGIBILITY-FIRST: screen every alternative against the Constraints (Hard Requirements)
      FIRST — eliminate failures — THEN rank survivors on Decision Drivers. Do not let a high
      driver score rescue an option that fails a `negotiable: no` constraint.

      Each alternative therefore leads with an explicit eligibility status:
        - Eligible            (passes every constraint)
        - Not eligible        (fails a `negotiable: no` constraint — eliminated)
        - Eligible-with-accepted-risk-exception (fails only a `negotiable: yes` constraint)
      followed by constraint compliance, driver fit, pros/cons, and why rejected/chosen.

      Include at least two substantive alternatives plus a do-nothing baseline.
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

- **Eligibility:** <!-- Eligible | Not eligible (fails C-<n>) | Eligible-with-accepted-risk-exception (C-<n>) -->
- **Summary:** <!-- Brief description -->
- **Constraint compliance:** <!-- Explicit evaluation vs each constraint (C-1, C-2, …), or a matrix row. -->
- **Driver fit:** <!-- How well it ranks against the decision drivers (after passing constraints). -->
- **Pros:** <!-- Benefits of inaction -->
- **Cons:** <!-- Risks of inaction -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

### Alternative 1 — <Name>

- **Eligibility:** <!-- Eligible | Not eligible | Eligible-with-accepted-risk-exception -->
- **Summary:** <!-- Brief description -->
- **Constraint compliance:** <!-- Explicit evaluation vs each constraint (C-1, C-2, …), or a matrix row. -->
- **Driver fit:** <!-- Ranking against drivers -->
- **Pros:** <!-- Benefits, aligned with drivers -->
- **Cons:** <!-- Risks, costs, constraints violated -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

### Alternative 2 — <Name>

- **Eligibility:** <!-- Eligible | Not eligible | Eligible-with-accepted-risk-exception -->
- **Summary:** <!-- Brief description -->
- **Constraint compliance:** <!-- Explicit evaluation vs each constraint (C-1, C-2, …), or a matrix row. -->
- **Driver fit:** <!-- Ranking against drivers -->
- **Pros:** <!-- Benefits -->
- **Cons:** <!-- Risks -->
- **Why rejected/chosen:** <!-- Link rationale to drivers -->

## Decision

<!-- rigor: R1/R2/R3 — rendered at every rigor level.
      The decision record captures the FINAL authorized decision. Recommendation,
      discussion, and dissent happen on the PR (or planning branch) before the
      record is merged to main with status: Accepted.

      Cross-reference: doc/guides/decision-making.md §6 (AI authority).
-->

- **Decision:** <!-- final choice -->
- **Rationale (tied to drivers):** <!-- why this option, referencing surviving drivers -->
- **Decider:** <!-- authorized human / role -->
- **Conditions for revisit:** <!-- when to reopen; cross-reference review_date front matter -->

### Constraint Compliance Attestation

<!-- The Decision MUST explicitly attest that the chosen alternative satisfies EVERY
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

<!-- rigor: R2/R3 — omitted at R1 -->

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

<!-- rigor: R2/R3 — omitted at R1 -->
<!-- High-level only — no low-level tasks, file names, or code.
     Include:
     1. Requirements and refactors implied by the decision
     2. Rollout strategy and guardrails
     3. Risk mitigation during implementation
-->

## Rollback / Reversal

<!-- rigor: R3 — mandatory for ADR/ODR with reversibility: hard (+ R3); optional elsewhere -->
<!-- How to revert if the decision proves wrong. Include:
     - Revert steps (high level)
     - Stop-conditions / blast-radius limits that trigger rollback
     - Data or state that cannot be recovered
-->

## Communication Plan

<!-- rigor: R2/R3 — render only when governance.informed is non-empty (or stakeholder impact is material) -->
<!-- Who needs to know, what message, via which channel, and when.
     - Audiences (map to governance.informed)
     - Message (one line)
     - Channel (e.g., eng-all, change spec, stakeholder email)
     - Timing (pre-rollout / at-rollout / post-rollout)
-->

## Verification Criteria

<!-- rigor: R2/R3 — omitted at R1 -->
<!-- Concrete KPIs or signals for evaluating the decision's impact.
     Include targets and timeframes:
     - Metric: <name> — Target: <value> — Window: <timeframe>
-->

## Confidence Rating

<!-- rigor: R2/R3 — omitted at R1 -->
<!-- State: Low | Medium | High
     Justify by reference to data, precedent, or gaps. (AI-generated confidence is NOT evidence.)
-->

## Structured Retrospective

<!-- rigor: R2/R3 — populate iteratively after implementation and observation.
     Separates quality dimensions to fight outcome bias.

     ITERATIVE REVIEW PROCESS:
     - First retro: shortly after implementation (days–weeks). Captures immediate
       process/evidence/execution quality. After this retro, set `review_date` in
       the front matter to a case-by-case horizon (weeks–months) for a longer-
       perspective review.
     - Second retro: at the `review_date`. Assesses whether the decision was right
       with the benefit of hindsight — realized outcomes, lessons learned, luck vs
       skill. After this retro, set a new `review_date` if further observation is
       warranted, or mark the decision Deprecated/Superseded if it no longer applies.
     - The `review_date` front-matter field is the driver: records with a
       `review_date` in the past are candidates for the next retro cycle.

     Initially: "TODO: First retro after implementation."
-->

### Process quality

<!-- Was the right process followed at the right rigor? -->

### Evidence quality

<!-- Was the evidence base sound, sourced, and current? -->

### Execution quality

<!-- Was the decision implemented as intended? -->

### Realized outcome

<!-- What actually happened vs the expected outcome? -->

### Luck & variance

<!-- How much of the outcome was skill vs luck / external factors? (Anti-outcome-bias.) -->

## Examples & Usage (Optional)

<!-- rigor: R3-expanded — omitted at R1/R2 unless useful -->
<!-- Representative scenarios, configurations, or flows where this decision applies.
     Omit this section if not yet applicable.
-->

## References

<!-- rigor: R1/R2/R3 -->
<!-- Links to related artifacts:
     - Change specs, implementation plans
     - System specs, contracts
     - Prior decision records
     - External sources or research
-->

---

## Appendix — Worked rendering examples

<!-- Authoring reference only. These compact examples show the tiered-default
     rendering (R1 strict subset of R3). Delete this appendix when finalizing a
     real record. They are NOT sections of the record body. -->

### R1 example — lightweight brief (compact)

```
# TDR-0007: Adopt `pino` for structured logging

Context: service logs are unstructured; on-call triage is slow. No prior logging decision.
Problem Framing: need structured, low-overhead logging across services.
Constraints: C-1 must not require a running sidecar (negotiable: no).
Decision Drivers: (1) performance/overhead, (2) structured-output ergonomics.
Mental Models: trade-off matrix, build/buy/partner.
Alternatives:
  - Alt 0 (do nothing): Not eligible (fails C-1 — keeps console-only). Rejected.
  - Alt 1 (pino): Eligible. Best driver fit. Chosen.
  - Alt 2 (winston): Eligible. Slower on the chosen benchmark.
Decision (Recommendation + Authorized Decision):
  - Recommendation: Alt 1 (pino) — best overhead + structured output.
  - Authorized Decision: Adopt pino. Decider: tech lead. Constraint attestation: satisfies C-1.
Owner: @platform; Revisit trigger: logging overhead regresses beyond budget.
References: pino repo (https://github.com/pinojs/pino).
```
*(R1 omits Decision Rights, Evidence/Assumptions/Unknowns, Trade-offs, Implementation
Plan, Rollback, Communication Plan, Verification Criteria, Confidence Rating,
Structured Retrospective, Examples.)*

### R2 example — standard record

The full canonical record **minus** the R3-expanded sections (Rollback/Reversal,
Communication Plan, Structured Retrospective). Renders every section above through
Confidence Rating + References, including Decision Rights, Evidence/Assumptions/
Unknowns, eligibility-first Alternatives, the Recommendation/Authorized Decision
split, Trade-offs, Implementation Plan, and Verification Criteria.

### R3 example — high assurance

The full canonical record **plus**: independent `@decision-critic` challenge
(`PASS` / `PASS_WITH_RISKS` / `REWORK` verdict recorded under Adversarial
Challenge), a populated Rollback/Reversal section, a Communication Plan,
a Structured Retrospective, a human final decision in the Authorized Decision
(`human_decider` set), and a `review_date`. Status remains `Proposed` with
`decision_date: null` until the authorized human decides.
