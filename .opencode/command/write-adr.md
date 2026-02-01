---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/write-adr.md
#
description: Generate canonical Architecture Decision Record (ADR) for a given ADR number.
agent: architect
---

<purpose>
Generate a COMPLETE, rationale-focused Architecture Decision Record for a given ADR number, strictly from planning-session context and existing documentation.

User invocation:
/write-adr <adrNumber>

Inputs other than <adrNumber> MUST be sourced from the active technical-decision planning context (especially the `<technical_decision_planning_summary>` block) and relevant repository docs; NOTHING may be invented.

The resulting ADR becomes the canonical record of the decision and its rationale, and should be linked from related changes and specs.
</purpose>

<inputs>
- adrNumber='$1': string — REQUIRED (digits only; will be normalized and zero-padded to 4 digits)
- allArguments='$ARGUMENTS': string — starts with adrNumber and may be followed by user hints (e.g., title refinements)
- previous conversation context from /plan-decision planning session, including `<technical_decision_planning_summary>`
</inputs>

<directory_rules>

- Normalize adrNumber: strip non-digits; pad left with '0' to length 4.
- groupFolder is NOT used; all ADRs live directly under `doc/adr/`.
- slug = normalized-from-title (lowercase ASCII kebab-case, <=60 chars), derived from the ADR title.
- filename = ADR-<adrNumber>-<slug>.md
- fullPath = doc/adr/ADR-<adrNumber>-<slug>.md
  </directory_rules>

<front_matter_rules>
A YAML front matter block MUST precede the ADR body and include at least these keys:

id: ADR-<adrNumber>
created: <YYYY-MM-DD> # UTC date when ADR file is first created
decision_date: null | <YYYY-MM-DD> # Date when status changed to Accepted; may be null for Proposed
last_updated: <YYYY-MM-DD> # UTC date of last modification
status: <Proposed|Accepted|Deprecated|Superseded>
summary: <Short one-line summary of the decision>
owners: [<at least one owner>]
service: <primary impacted service, system, or domain>
links:
related_changes: ["PDEV-123", ...]
supersedes: ["ADR-####", ...]
superseded_by: ["ADR-####", ...]
spec: ["doc/spec/...", ...]
contracts: ["doc/contracts/...", ...]
diagrams: ["doc/diagrams/...", ...]
adr: ["ADR-####", ...] # other relevant ADRs

Validation:

- id MUST be exactly `ADR-<adrNumber>` where <adrNumber> is the zero-padded string form.
- created and last_updated MUST be valid dates in ISO format YYYY-MM-DD (UTC calendar date).
- On first creation:
  - status MUST be "Proposed".
  - decision_date SHOULD be null (or omitted) until status becomes Accepted.
- owners MUST contain at least one entry (e.g., a team or person handle).
- related_changes MAY be empty; when present, values MUST be valid workItemRef identifiers (e.g., `PDEV-123`, `GH-456`).
- Additional front-matter fields allowed by doc/documentation-handbook.md (e.g., tags, security) MAY be added but MUST NOT replace the keys above.
  </front_matter_rules>

<context_lookup>
The ADR generator must base its content on:

- The `<technical_decision_planning_summary>` block produced by `/plan-decision <adrNumber>` in the current or recent conversation.
- Relevant change specs under `doc/changes/**/*--*--*/chg-*-spec.md` when `related_changes` are present.
- Existing ADRs under `doc/adr/**` referenced from planning context (for supersedes/related decisions).
- System specs under `doc/spec/**` and contracts under `doc/contracts/**` where the decision materially affects them.

If a `<technical_decision_planning_summary>` for this adrNumber is NOT available in context, the command MUST:

- Ask the user to either:
  - Re-run `/plan-decision <adrNumber>` and complete the planning summary, OR
  - Provide the missing fields explicitly.
- REFUSE to generate the ADR purely from vague or partial inputs.
  </context_lookup>

<adr_structure>
The ADR markdown body (after front matter) MUST follow this structure and order:

1. `# ADR-<adrNumber>: <Title>`
2. `## Context`
3. `## Problem Framing (Clarified)`
4. `## Decision Drivers`
5. `## Mental Models & Techniques Used`
6. `## Alternatives Considered`
7. `## Decision`
8. `## Trade-offs & Consequences`
9. `### Positive Outcomes`
10. `### Negative Outcomes`
11. `### Unresolved Questions`
12. `## Implementation Plan`
13. `## Verification Criteria`
14. `## Confidence Rating`
15. `## Lessons Learned (Retrospective)`
16. `## Examples & Usage (Optional)`
17. `## References`

No extra top-level sections may be introduced before or between these headings. Additional subsections may be added **within** these sections if they are clearly nested and consistent with the template.
</adr_structure>

<authoring_rules>

- Use ONLY planning context and existing documentation; do not invent new requirements, drivers, or constraints.
- "Context" MUST describe the architectural or technical situation, why the decision is needed now, and relevant constraints.
- "Problem Framing (Clarified)" MUST reframe the user problem in objective technical terms, highlighting underlying causes.
- "Decision Drivers" MUST list explicit, prioritized drivers (business, technical, operational, organizational) that the decision optimizes for.
- "Mental Models & Techniques Used" should summarize which reasoning tools were applied (e.g., First Principles, Inversion, Second-Order Thinking, 5 Whys) as captured in planning.
- "Alternatives Considered" MUST:
  - Include at least two substantive alternatives plus a "do nothing / keep current approach" baseline when applicable.
  - For each alternative, include summary, pros, cons, and why it was rejected or chosen.
- "Decision" MUST:
  - State the final decision clearly.
  - Tie rationale explicitly back to decision drivers.
  - List key assumptions.
- "Trade-offs & Consequences" MUST:
  - Separate positive outcomes, negative outcomes, and unresolved questions.
  - Make second-order and operational consequences explicit where known.
- "Implementation Plan" MUST remain high-level:
  - Requirements, refactors, migrations, rollout concepts, and risk mitigations.
  - NO low-level tasks, file names, or code instructions.
- "Verification Criteria" MUST list concrete KPIs or signals, with targets and timeframes, for evaluating the impact of the decision.
- "Confidence Rating" MUST state Low / Medium / High and be justified by reference to data, precedent, or gaps.
- "Lessons Learned (Retrospective)" MAY initially contain a brief TODO-style note if the decision has not yet been implemented; this section is expected to evolve over time.
- "Examples & Usage (Optional)" MAY be omitted for early ADRs, but when present should reference representative scenarios, not code internals.
- "References" MUST link to relevant changes, specs, contracts, ADRs, and external sources.
- Where planning context contains explicit labels like FACT, ASSUMPTION, TO CONFIRM, these MAY be retained as bold labels in the ADR where useful.
  </authoring_rules>

<placeholder_rules>

- Template placeholders such as `<...>` MUST NOT appear in final ADR content.
- If required information is genuinely unavailable (e.g., decision not yet fully implemented so Lessons Learned are unknown):
  - Use explicit TODO-style sentences (e.g., "TODO: Populate lessons learned after first production rollout.").
  - Add any significant unknowns to "### Unresolved Questions" with owners where possible.
- Under no circumstances may the ADR omit a required section; minimal but honest content is preferred over silence.
  </placeholder_rules>

<process>
1. Read `$1` as rawAdrNumber; normalize to digits-only and zero-pad to 4 digits.
2. Obtain or reconstruct the `<technical_decision_planning_summary>` for this adrNumber from the planning session or explicit user-provided data.
3. Derive:
   - Title from `adr.title`.
   - slugHint from `adr.slug_hint` or by slugifying the title.
   - owners, service, labels, related_changes, decision_scope, and other meta fields from the planning summary.
4. Compute slug from title/slugHint; validate length (<=60 chars) and allowed charset (lowercase letters, numbers, hyphens).
5. Compute fullPath = `doc/adr/ADR-<adrNumber>-<slug>.md`.
6. Determine whether the ADR file already exists:
   - If it exists: load existing front matter and body; treat this as an UPDATE, preserving historical narrative and only appending/adjusting content where appropriate.
   - If it does not exist: treat this as a NEW ADR.
7. Construct front matter per <front_matter_rules>:
   - On creation: set created = today (UTC); last_updated = today; status = Proposed; decision_date = null.
   - On update: preserve created; set last_updated = today; retain existing status and decision_date unless explicitly overridden by user.
8. Generate or update ADR body using <adr_structure>, <authoring_rules>, and planning context:
   - For NEW ADRs: synthesize complete sections from planning summary and referenced docs.
   - For UPDATES: merge new planning information without rewriting historical sections; append to "Unresolved Questions", "Lessons Learned", and "References" instead of erasing prior content.
9. Write ADR markdown to fullPath.
10. Stage ONLY this ADR file.
11. Commit with message:
    - On creation: `docs(adr): add ADR-<adrNumber>-<slug>`
    - On update: `docs(adr): refine ADR-<adrNumber>-<slug>`
12. Stop. Do not modify change specs, implementation plans, or system specs in this command; those are updated via their dedicated commands.
</process>

<embedded_template format="markdown">

---

id: ADR-<adrNumber>
created: <created-date-utc>
decision_date: <decision-date-or-null>
last_updated: <last-updated-date-utc>
status: <Proposed|Accepted|Deprecated|Superseded>
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
  adr: []

---

# ADR-<adrNumber>: <Title>

## Context

Concise description of the technical/architectural situation, triggers for this decision, and relevant constraints.

## Problem Framing (Clarified)

Objective reframing of the problem, focusing on underlying causes rather than symptoms.

## Decision Drivers

- Business drivers (e.g., cost, time-to-market, risk).
- Technical drivers (e.g., performance, reliability, coupling).
- Operational and organizational drivers (e.g., operability, cognitive load).

## Mental Models & Techniques Used

- List of mental models and techniques applied (e.g., First Principles, Inversion, Second-Order Thinking, 5 Whys).

## Alternatives Considered

1. **Alternative A — <Name>**
   - Summary: <short summary>
   - Pros: <bullets>
   - Cons: <bullets>
   - Why rejected / chosen: <link to drivers>

2. **Alternative B — <Name>**
   - ...

3. **Alternative 0 — Do nothing / keep current approach (if applicable)**
   - Summary: <what happens if we do nothing>
   - Pros / Cons compared to other options.

## Decision

- Final decision statement.
- Core rationale, explicitly linked to decision drivers.
- Explicit assumptions acknowledged.

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

- Linked change specs, technical docs, diagrams, prior ADRs.
- External sources or research influencing the decision.

---

</embedded_template>

<output_contract>

- Writes exactly one ADR file: `ADR-<adrNumber>-<slug>.md`.
- File is placed under: `doc/adr/`.
- Content follows <adr_structure> and is semantically aligned with `doc/templates/adr-template.md`.
- No `<...>` placeholders remain; any missing information is called out explicitly as TODO or unresolved questions.
  </output_contract>

<validation>
- Directory + filename follow <directory_rules>.
- Front matter validates per <front_matter_rules> (including allowed value sets and required keys).
- Section order EXACT per <adr_structure> (no missing / extra top-level sections).
- Alternatives section includes at least two real options plus baseline (where applicable).
- Decision section clearly references decision drivers.
- Verification criteria include measurable targets and timeframes.
- No low-level implementation tasks, file paths, or git commands appear in the body.
- If confirmUpdate=true (optional future flag), show diff prior to write.
- Only the target ADR file is staged & committed; abort if other staged changes exist.
</validation>

<notes>
- This command formalizes Archie-style technical decisions into repository-native ADRs under `doc/adr/`.
- It relies on `/plan-decision` for high-quality planning context; do not bypass planning by inventing content.
- After an ADR is Accepted, follow up with `/sync-docs <workItemRef>` (when related to a change) to reconcile `doc/spec/**` and `doc/contracts/**` with the decided architecture.
</notes>
