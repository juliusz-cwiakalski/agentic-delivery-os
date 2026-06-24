---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/write-decision.md
#
description: Generate a Decision Record (ADR/PDR/TDR/BDR/ODR) from planning context.
agent: architect
---

<purpose>
Generate a COMPLETE, rationale-focused Decision Record for a given decision number, strictly from planning-session context and existing documentation. Supports all five decision types: ADR (Architecture), PDR (Product), TDR (Technical), BDR (Business), and ODR (Operational).

User invocation:
/write-decision <number>

Inputs other than <number> MUST be sourced from the active technical-decision planning context (especially the `<technical_decision_planning_summary>` block) and relevant repository docs; NOTHING may be invented.

The resulting decision record becomes the canonical record of the decision and its rationale, and should be linked from related changes and specs.
</purpose>

<inputs>
- number='$1': string — REQUIRED (digits only; will be normalized and zero-padded to 4 digits)
- allArguments='$ARGUMENTS': string — starts with number and may be followed by user hints (e.g., title refinements, decision type override)
- previous conversation context from /plan-decision planning session, including `<technical_decision_planning_summary>`
</inputs>

<directory_rules>

- Normalize number: strip non-digits; pad left with '0' to length 4.
- groupFolder is NOT used; all decision records live directly under `doc/decisions/`.
- decisionType defaults to ADR; may be overridden to PDR, TDR, BDR, or ODR based on planning context or user input.
- slug = normalized-from-title (lowercase ASCII kebab-case, <=60 chars), derived from the decision title.
- filename = <TYPE>-<number>-<slug>.md (e.g., ADR-0001-event-bus.md, TDR-0001-state-mgmt.md)
- fullPath = doc/decisions/<TYPE>-<number>-<slug>.md
  </directory_rules>

<front_matter_rules>
A YAML front matter block MUST precede the decision record body and include at least these keys:

id: <TYPE>-<number>                 # e.g., ADR-0001, PDR-0001, TDR-0001
decision_type: <adr|pdr|tdr|bdr|odr>
created: <YYYY-MM-DD>              # UTC date when file is first created
decision_date: null | <YYYY-MM-DD> # Date when status changed to Accepted; may be null for Proposed
last_updated: <YYYY-MM-DD>         # UTC date of last modification
status: <Proposed|Under Review|Accepted|Deprecated|Superseded>
summary: <Short one-line summary of the decision>
owners: [<at least one owner>]
service: <primary impacted service, system, or domain>
links:
related_changes: ["PDEV-123", ...]
supersedes: ["<TYPE>-####", ...]
superseded_by: ["<TYPE>-####", ...]
spec: ["doc/spec/...", ...]
contracts: ["doc/contracts/...", ...]
diagrams: ["doc/diagrams/...", ...]
decisions: ["<TYPE>-####", ...]    # other relevant decision records

Validation:

- id MUST be exactly `<TYPE>-<number>` where TYPE is ADR/PDR/TDR/BDR/ODR and <number> is the zero-padded string form.
- decision_type MUST be one of: adr, pdr, tdr, bdr, odr (lowercase).
- created and last_updated MUST be valid dates in ISO format YYYY-MM-DD (UTC calendar date).
- On first creation:
  - status MUST be "Proposed".
  - decision_date SHOULD be null (or omitted) until status becomes Accepted.
- owners MUST contain at least one entry (e.g., a team or person handle).
- related_changes MAY be empty; when present, values MUST be valid workItemRef identifiers (e.g., `PDEV-123`, `GH-456`).
- Additional front-matter fields allowed by doc/documentation-handbook.md (e.g., tags, security) MAY be added but MUST NOT replace the keys above.
  </front_matter_rules>

<context_lookup>
The decision record generator must base its content on:

- The `<technical_decision_planning_summary>` block produced by `/plan-decision <number>` in the current or recent conversation.
- Relevant change specs under `doc/changes/**/*--*--*/chg-*-spec.md` when `related_changes` are present.
- Existing decision records under `doc/decisions/**` referenced from planning context (for supersedes/related decisions).
- Use `doc/templates/decision-record-template.md` as the structural guide for generating the decision record body.
- System specs under `doc/spec/**` and contracts under `doc/contracts/**` where the decision materially affects them.

If a `<technical_decision_planning_summary>` for this number is NOT available in context, the command MUST:

- Ask the user to either:
  - Re-run `/plan-decision <number>` and complete the planning summary, OR
  - Provide the missing fields explicitly.
- REFUSE to generate the decision record purely from vague or partial inputs.
  </context_lookup>

<decision_structure>
The decision record markdown body (after front matter) MUST follow this structure and order:

1. `# <TYPE>-<number>: <Title>`
2. `## Context`
3. `## Problem Framing (Clarified)`
4. `## Constraints (Hard Requirements)`
5. `## Decision Drivers`
6. `## Mental Models & Techniques Used`
7. `## Alternatives Considered`
8. `## Decision`
9. `## Trade-offs & Consequences`
10. `### Positive Outcomes`
11. `### Negative Outcomes`
12. `### Unresolved Questions`
13. `## Implementation Plan`
14. `## Verification Criteria`
15. `## Confidence Rating`
16. `## Lessons Learned (Retrospective)`
17. `## Examples & Usage (Optional)`
18. `## References`

No extra top-level sections may be introduced before or between these headings. Additional subsections may be added **within** these sections if they are clearly nested and consistent with the template.
</decision_structure>

<authoring_rules>

- Use ONLY planning context and existing documentation; do not invent new requirements, drivers, or constraints.
- "Context" MUST describe the situation (architectural, product, technical, business, or operational as appropriate to the decision type), why the decision is needed now, and relevant constraints.
- "Problem Framing (Clarified)" MUST reframe the user problem in objective technical terms, highlighting underlying causes.
- "Constraints (Hard Requirements)" MUST be rendered from the planning summary's `hard_requirements:` field (distinct from `decision_drivers:`). Each constraint is rendered with the fields **ID** (`C-1`, `C-2`, …), **Statement**, **Source** (∈ regulatory | contractual | prior decision | AC | internal standard), **Verification** (∈ test | audit | code review | architect sign-off | demonstration), and **Negotiable** (yes | no). If `hard_requirements:` is empty or absent, render the section as a CONSCIOUS empty choice with an explicit statement (e.g., "No non-negotiable constraints identified.") — emptiness is never an omission. Constraints and drivers MUST be kept in their separate sections; never merge them.
- "Decision Drivers" MUST list explicit, prioritized drivers (business, technical, operational, organizational) that the decision optimizes for. Drivers are continuous preferences used to rank alternatives; they are NOT binary gates (those live in Constraints).
- "Mental Models & Techniques Used" should summarize which reasoning tools were applied (e.g., First Principles, Inversion, Second-Order Thinking, 5 Whys) as captured in planning.
- "Alternatives Considered" MUST:
  - Include at least two substantive alternatives plus a "do nothing / keep current approach" baseline when applicable.
  - For each alternative, include summary, pros, cons, and why it was rejected or chosen.
  - For each alternative, include an EXPLICIT constraint-compliance evaluation against each documented constraint (C-1, C-2, …), not only pros/cons against drivers. Choose format via a readability heuristic: PROSE (1–2 sentences/alternative) when all comply or few violations need explanation; a MATRIX (constraints × alternatives) when ≥3 constraints have mixed compliance or prose would exceed ~3 sentences/alternative. DEFAULT TO MATRIX when unsure. Table-stakes constraints (all alternatives satisfy) get a brief one-line acknowledgment rather than per-alternative listing.
- "Decision" MUST:
  - State the final decision clearly.
  - Tie rationale explicitly back to decision drivers.
  - List key assumptions.
  - Explicitly ATTEST that the chosen alternative satisfies every constraint, OR document an accepted-risk exception for any constraint it violates. An accepted-risk exception is permitted ONLY for constraints marked `negotiable: yes`; a non-negotiable (`negotiable: no`) constraint that the chosen alternative violates is DISQUALIFYING and must not be waved through.
- "Trade-offs & Consequences" MUST:
  - Separate positive outcomes, negative outcomes, and unresolved questions.
  - Make second-order and operational consequences explicit where known.
- "Implementation Plan" MUST remain high-level:
  - Requirements, refactors, migrations, rollout concepts, and risk mitigations.
  - NO low-level tasks, file names, or code instructions.
- "Verification Criteria" MUST list concrete KPIs or signals, with targets and timeframes, for evaluating the impact of the decision.
- "Confidence Rating" MUST state Low / Medium / High and be justified by reference to data, precedent, or gaps.
- "Lessons Learned (Retrospective)" MAY initially contain a brief TODO-style note if the decision has not yet been implemented; this section is expected to evolve over time.
- "Examples & Usage (Optional)" MAY be omitted for early decision records, but when present should reference representative scenarios, not code internals.
- "References" MUST link to relevant changes, specs, contracts, decision records, and external sources.
- Where planning context contains explicit labels like FACT, ASSUMPTION, TO CONFIRM, these MAY be retained as bold labels in the ADR where useful.
  </authoring_rules>

<placeholder_rules>

- Template placeholders such as `<...>` MUST NOT appear in final decision record content.
- If required information is genuinely unavailable (e.g., decision not yet fully implemented so Lessons Learned are unknown):
  - Use explicit TODO-style sentences (e.g., "TODO: Populate lessons learned after first production rollout.").
  - Add any significant unknowns to "### Unresolved Questions" with owners where possible.
- Under no circumstances may the decision record omit a required section; minimal but honest content is preferred over silence.
  </placeholder_rules>

<process>
1. Read `$1` as rawNumber; normalize to digits-only and zero-pad to 4 digits.
2. Obtain or reconstruct the `<technical_decision_planning_summary>` for this number from the planning session or explicit user-provided data.
3. Derive:
   - decisionType from planning summary `decision_type` field (defaults to ADR if not specified).
   - Title from planning summary title field.
   - slugHint from slug_hint or by slugifying the title.
   - owners, service, labels, related_changes, decision_scope, and other meta fields from the planning summary.
4. Compute slug from title/slugHint; validate length (<=60 chars) and allowed charset (lowercase letters, numbers, hyphens).
5. Compute fullPath = `doc/decisions/<TYPE>-<number>-<slug>.md` (TYPE from step 3).
6. Determine whether the decision record file already exists:
   - If it exists: load existing front matter and body; treat this as an UPDATE, preserving historical narrative and only appending/adjusting content where appropriate.
   - If it does not exist: treat this as a NEW decision record.
7. Construct front matter per <front_matter_rules>:
   - On creation: set created = today (UTC); last_updated = today; status = Proposed; decision_date = null; decision_type from step 3.
   - On update: preserve created; set last_updated = today; retain existing status and decision_date unless explicitly overridden by user.
8. Generate or update decision record body using <decision_structure>, <authoring_rules>, and planning context:
   - For NEW records: synthesize complete sections from planning summary and referenced docs.
   - For UPDATES: merge new planning information without rewriting historical sections; append to "Unresolved Questions", "Lessons Learned", and "References" instead of erasing prior content.
9. Write decision record markdown to fullPath.
10. Stage ONLY this decision record file.
11. Commit with message:
    - On creation: `docs(<type>): add <TYPE>-<number>-<slug>` (e.g., `docs(adr): add ADR-0001-event-bus`)
    - On update: `docs(<type>): refine <TYPE>-<number>-<slug>`
12. Stop. Do not modify change specs, implementation plans, or system specs in this command; those are updated via their dedicated commands.
</process>

<embedded_template format="markdown">

---

id: <TYPE>-<number>
decision_type: <adr|pdr|tdr|bdr|odr>
created: <created-date-utc>
decision_date: <decision-date-or-null>
last_updated: <last-updated-date-utc>
status: <Proposed|Under Review|Accepted|Deprecated|Superseded>
summary: <Short one-line summary of the decision>
owners:
  - <owner-or-team>
service: <primary impacted service or domain>
links:
  related_changes:
    - <workItemRef-or-empty>
  supersedes: []
  superseded_by: []
  spec: []
  contracts: []
  diagrams: []
  decisions: []

---

# <TYPE>-<number>: <Title>

## Context

Concise description of the technical/architectural situation, triggers for this decision, and relevant constraints.

## Problem Framing (Clarified)

Objective reframing of the problem, focusing on underlying causes rather than symptoms.

## Constraints (Hard Requirements)

Binary, non-negotiable gates that ELIMINATE alternatives (pass/fail) — distinct from Decision Drivers (continuous ranking preferences). Rendered from the planning summary `hard_requirements:` field. If no hard requirements exist, state that explicitly here as a conscious empty choice (e.g., "No non-negotiable constraints identified.").

### C-1: <constraint statement>

- **Statement:** <the requirement phrased as a pass/fail test>
- **Source:** <regulatory | contractual | prior decision | AC | internal standard>
- **Verification:** <test | audit | code review | architect sign-off | demonstration>
- **Negotiable:** <yes | no>  (`no` = a violation is disqualifying; `yes` = a documented accepted-risk exception may be recorded in the Decision)

## Decision Drivers

- Business drivers (e.g., cost, time-to-market, risk).
- Technical drivers (e.g., performance, reliability, coupling).
- Operational and organizational drivers (e.g., operability, cognitive load).

## Mental Models & Techniques Used

- List of mental models and techniques applied (e.g., First Principles, Inversion, Second-Order Thinking, 5 Whys).

## Alternatives Considered

Each alternative MUST include an explicit constraint-compliance evaluation against every documented constraint (C-1, C-2, …), not only pros/cons against drivers. Choose format via the readability heuristic (prose vs matrix; default to matrix when unsure). Table-stakes constraints all alternatives satisfy get a one-line acknowledgment.

1. **Alternative A — <Name>**
   - Summary: <short summary>
   - Pros: <bullets>
   - Cons: <bullets>
   - Constraint compliance: <explicit pass/fail per constraint C-1, C-2, …, or a matrix row>
   - Why rejected / chosen: <link to drivers>

2. **Alternative B — <Name>**
   - ...
   - Constraint compliance: <explicit pass/fail per constraint>

3. **Alternative 0 — Do nothing / keep current approach (if applicable)**
   - Summary: <what happens if we do nothing>
   - Pros / Cons compared to other options.
   - Constraint compliance: <explicit pass/fail per constraint>

## Decision

- Final decision statement.
- Core rationale, explicitly linked to decision drivers.
- Explicit assumptions acknowledged.
- Constraint compliance attestation: explicitly attest the chosen alternative satisfies every constraint, OR document an accepted-risk exception for any violated constraint — permitted ONLY for constraints marked `negotiable: yes` (a `negotiable: no` violation is disqualifying).

## Trade-offs & Consequences

### Positive Outcomes

- Benefits expected from this decision.

### Negative Outcomes

- Known downsides, additional complexity, or risks introduced by this decision.

### Unresolved Questions

- Remaining risks, information gaps, or areas requiring validation, each with an owner where possible.

## Implementation Plan

1. High-level requirements and refactors implied by the decision.
2. Rollout strategy and guardrails.
3. Risk mitigation during implementation.
4. Design details at the conceptual/architecture level (no low-level tasks or code).

## Verification Criteria

- KPIs or metrics to track decision impact.
- Timeframe and tools to validate success or failure.

## Confidence Rating

- Confidence: <Low|Medium|High>.
- Factors influencing confidence: data, precedent, validation.

## Lessons Learned (Retrospective)

- To be populated as the decision is implemented and observed.

## Examples & Usage (Optional)

- Representative flows, configurations, or scenarios where this decision is applied.

## References

- Linked change specs, technical docs, diagrams, prior decision records.
- External sources or research influencing the decision.

---

</embedded_template>

<output_contract>

- Writes exactly one decision record file: `<TYPE>-<adrNumber>-<slug>.md`.
- File is placed under: `doc/decisions/`.
- Content follows <decision_structure> and is semantically aligned with `doc/templates/decision-record-template.md`.
- No `<...>` placeholders remain; any missing information is called out explicitly as TODO or unresolved questions.
  </output_contract>

<validation>
- Directory + filename follow <directory_rules>.
- Front matter validates per <front_matter_rules> (including allowed value sets and required keys).
- Section order EXACT per <decision_structure> (no missing / extra top-level sections).
- Alternatives section includes at least two real options plus baseline (where applicable).
- Decision section clearly references decision drivers.
- Verification criteria include measurable targets and timeframes.
- No low-level implementation tasks, file paths, or git commands appear in the body.
- If confirmUpdate=true (optional future flag), show diff prior to write.
- Only the target decision record file is staged & committed; abort if other staged changes exist.
</validation>

<notes>
- This command formalizes technical and non-technical decisions into repository-native decision records under `doc/decisions/`.
- It relies on `/plan-decision` for high-quality planning context; do not bypass planning by inventing content.
- After a decision record is Accepted, follow up with `/sync-docs <workItemRef>` (when related to a change) to reconcile `doc/spec/**` and `doc/contracts/**` with the decided approach.
</notes>
