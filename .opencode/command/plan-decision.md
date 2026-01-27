---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
#
# MIT License - see LICENSE file for full terms
description: Interactive technical-decision planning session to prepare canonical context and ADR number for /write-adr.
agent: architect
---

<purpose>
Guide the user through a structured, interactive technical-decision conversation that transforms an initial architectural question or proposal into a complete, implementation-agnostic planning context for a single numbered Architecture Decision Record (ADR). The command:

- Discovers or confirms the ADR number (e.g. 0007) by scanning existing ADRs in doc/adr/.
- Orients itself in the current repository and high-level documentation under doc/spec/, doc/overview/, doc/changes/, and doc/contracts/.
- Systematically elicits and refines all information needed by /write-adr (context, problem framing, decision drivers, alternatives, trade-offs, assumptions, verification criteria, etc.), without generating the ADR file itself.
- Applies Archie-style decision-making discipline (clarify problem → confirm drivers → explore options → recommend) without exposing internal mechanics unless asked.
- Concludes with a compact, machine- and human-friendly planning summary block plus a clear recommendation to invoke `/write-adr <adrNumber>` and, where relevant, to link back to related changes (workItemRef).

This command never writes files or modifies Git state; it operates purely via conversational planning and read-only repository inspection.
</purpose>

<command>
User invocation (natural-language friendly):

/plan-decision [<adrNumber>] [free-text context]

Examples:

- `/plan-decision`  
  → Auto-discover next ADR number from doc/adr/, then ask what decision we are shaping.

- `/plan-decision 12`  
  → Treat 12 as the intended ADR number (normalized internally to 0012), then start refinement questions.

- `/plan-decision 0042 Choose data sharding strategy for multi-tenant billing`  
  → Use 0042 as ADR number and seed initial understanding from the idea text.

Notes:

- The command always operates within the current repository only (single codebase per session).
- If multiple technical-decision sessions are active in the same conversation, clearly separate them by ADR number and avoid mixing context.
  </command>

<inputs>
- rawArguments = content of xml tag <rawArguments>...</rawArguments> (entire argument string after the command name).
- adrNumberHint: first token that is purely digits (if any); OPTIONAL.
- ideaSeed: remainder of rawArguments after stripping the command name and optional adrNumberHint; may be empty.

All other planning inputs (context, problem framing, drivers, alternatives, trade-offs, verification criteria, etc.) must be elicited interactively from the user and/or derived from existing documentation by summarization. No unstated assumptions may be invented.
<rawArguments>
$ARGUMENTS
</rawArguments>
</inputs>

<adr_number_resolution>

Primary goal: determine the canonical numeric ADR number (zero-padded to exactly 4 digits) for this planning session.

Resolution rules:

1. If adrNumberHint is provided:
   - Validate that it is composed of digits only.
   - Normalize to zeroPad4 = adrNumberHint left-padded with zeros to length 4 (e.g. 7 → 0007; 123 → 0123).
   - Treat this as the proposed ADR number; ask the user to confirm or override.

2. If no adrNumberHint:
   - Discover existing ADRs by scanning for files matching: `doc/adr/ADR-*-*.md`.
   - For each match, parse the numeric segment immediately after `ADR-` up to the next `-` or `.md` (e.g. ADR-0001-short-title.md → 1, ADR-0042-something.md → 42).
   - If no existing ADRs are found, propose `0001` as the first ADR number.
   - Otherwise, let maxExisting be the highest parsed number; propose candidate = maxExisting + 1.
   - Normalize candidate to zeroPad4 as above.
   - Present the candidate to the user as the default (e.g. "Based on existing ADRs, I propose using ADR number 0007."); allow the user to accept or override with any other integer.

3. Once confirmed by the user, refer to this as:
   - adrNumber (integer form).
   - zeroPad4 (string form, exactly 4 digits; e.g. "0007").

4. Use zeroPad4 consistently when referencing this ADR in summaries, e.g. `ADR-<zeroPad4>` and `/write-adr <zeroPad4>`.

This command MUST NOT create folders or files in doc/adr/; it only proposes and confirms the numeric identifier for use by downstream commands.
</adr_number_resolution>

<context_sources>
The planning agent may read from the repository to ground its questions and synthesis, but must not modify any files.

Primary context sources:

- `doc/spec/**`: current system and feature-level specifications.
- `doc/overview/**`: domain and product overviews (north star, architecture overviews, glossary/ubiquitous language).
- `doc/changes/**/*--*--*/chg-*-spec.md`: change specifications that may have motivated or be impacted by this decision.
- `doc/adr/**`: existing ADRs for precedent or constraints.
- `doc/contracts/**`: REST, events, and data contracts relevant to the decision.
- `doc/domain/**`, `doc/diagrams/**`, and other documentation under `doc/` that inform architecture, flows, and constraints.

Usage rules:

- When the user describes the decision, infer likely domain/technical keywords (services, bounded contexts, modules, infrastructure components) and search documentation files for those terms.
- Summarize only the relevant parts in concise bullets; do not paste large documents.
- When useful, quote document titles and short excerpts and ask the user to confirm whether those are the correct context anchors for the decision.
- Treat existing specs, contracts, and ADRs as authoritative constraints unless the user explicitly states that a prior decision is being revisited.
  </context_sources>

<session_flow>
Overall planning session flow (per ADR number):

1. **Initialization & orientation**
   - Confirm that we are operating in a single repository and which service/application or domain this decision primarily affects.
   - Resolve and confirm adrNumber / zeroPad4 using <adr_number_resolution>.
   - Ask the user for a short, plain-language description of the architectural/technical decision and why it matters now.
   - If ideaSeed was provided on the command line, restate it back for confirmation.
   - Ask whether this ADR is linked to an existing change (workItemRef like `PDEV-123` or `GH-456`) or is broader/cross-cutting.

2. **Clarify context and problem framing**
   - Elicit: current state, pain points, gaps, and constraints (technical, organizational, regulatory).
   - Reframe the problem in objective technical terms, distinguishing symptoms from root causes.
   - Apply techniques such as 5 Whys or Ishikawa (textually) to probe underlying causes where appropriate.
   - Keep separate lists of **facts**, **assumptions**, and **to confirm** items.

3. **Identify and validate decision drivers**
   - Elicit and confirm decision drivers across:
     - Business (e.g., cost, time-to-market, risk reduction).
     - Technical (e.g., performance, reliability, scalability, consistency model, coupling).
     - Operational and team factors (e.g., operability, team skills, cognitive load).
   - Where helpful, ask the user to prioritize or rank drivers.
   - Confirm that drivers are agreed before evaluating options.

4. **Shape the option space (alternatives)**
   - Identify at least two substantive alternatives plus an explicit "do nothing / keep current approach" baseline.
   - For each alternative, capture:
     - Summary (one or two sentences).
     - Pros (aligned with drivers).
     - Cons (risks, costs, constraints violated).
     - Situations where the alternative would be preferable (if any).
   - Avoid premature convergence: ensure options are meaningfully distinct.

5. **Evaluate options and converge on a recommendation**
   - Compare alternatives explicitly against decision drivers (tables or structured bullets are encouraged).
   - Call out trade-offs, second-order effects, and interactions with existing ADRs.
   - Propose a recommended option, but clearly separate recommendation from final decision.
   - Explicitly list assumptions underpinning the recommendation.

6. **Trade-offs, consequences, and scope boundaries**
   - Catalogue positive outcomes, negative outcomes, and unknowns.
   - Clarify the scope of the decision (e.g., single service vs. cross-service vs. organization-wide).
   - Identify what is explicitly **not** addressed by this decision ([OUT] items) to avoid scope creep.

7. **High-level implementation and rollout concept**
   - Sketch, at a high level only:
     - Requirements / refactors / migrations implied by the decision.
     - Rollout strategy and guardrails.
     - Risk mitigation strategies during implementation.
   - Do not generate low-level tasks; those belong in change specs and implementation plans.

8. **Verification criteria and confidence**
   - Elicit KPIs or metrics that will be used to evaluate the decision post-implementation.
   - Define measurement windows and data sources where possible.
   - Ask the user for a confidence rating (Low / Medium / High) and factors influencing it.

9. **Consolidation and readiness check**
   - Maintain throughout the session an explicit list of **Open Questions**, each tagged as BLOCKING or NON-BLOCKING and with an owner.
   - Before concluding, review all captured elements with the user and:
     - Resolve as many open questions as possible via further targeted questions.
     - For remaining questions, confirm BLOCKING vs NON-BLOCKING and that the user is comfortable proceeding to ADR drafting with those unresolved items.
   - Only then synthesize the final planning summary for /write-adr and suggest running that command.
     </session_flow>

<questioning_strategy>
The command must enforce disciplined, high-signal questioning inspired by the Archie prompt, adapted for ADR planning:

- Always start from the user's own words. Rephrase the decision context back to them and ask if the restatement is accurate before diving into details.
- Never jump straight to an ADR-like output. Ask questions first, then synthesize.
- Always clarify decision drivers before evaluating options; if drivers are unclear, pause and refine them.
- When ambiguity, missing detail, or conflicting signals are detected, follow this pattern:
  1. Call out the ambiguity explicitly.
  2. Propose 2–4 viable options with concise rationale for each.
  3. Recommend one option as default, explaining why.
  4. Ask the user to confirm or choose a different option.
  5. Record the confirmed decision and its rationale in the planning notes.
- Explicitly label key statements during the session (e.g., **FACT**, **ASSUMPTION**, **TO CONFIRM**, **RISK**) to keep reasoning transparent.
- Prefer at most 3–7 focused questions per turn, grouped by theme (context, drivers, options, consequences), rather than one long unstructured questionnaire.
- Continuously maintain and expose a living summary:
  - "What we know so far" (context, drivers, candidate options).
  - "Options and trade-offs" (structured comparison).
  - "Open questions" (blocking/non-blocking, with owners).
- If the user asks to "just write the ADR" before enough context is gathered, respond by explaining what key pieces are still missing and ask for them explicitly instead of proceeding with guesswork.
  </questioning_strategy>

<planning_summary_structure>
When the user confirms that planning feels complete enough to draft the ADR, synthesize a compact, structured planning summary that is easy for both humans and the /write-adr command to consume.

The final message of a completed planning session MUST include a block in this form (field order and naming must match exactly; values are illustrative):

```md
<technical_decision_planning_summary>
adr.number: 0007
adr.slug_hint: data-sharding-strategy
adr.title: Choose data sharding strategy for multi-tenant billing
status_hint: Proposed
owners: ["team-platform", "@cto"]
service: "billing-service"
labels: ["architecture", "storage", "scalability"]
related_changes: ["PDEV-123"]
decision_scope: "service" # e.g. service | cross-service | organization-wide
audience: internal

summary: |
Short, 1–3 sentence summary of the decision: what architectural choice is being made and why it matters, without low-level solution detail.

context: |
Concise description of current state, triggering events, constraints, and any relevant prior ADRs or changes.

problem_framing: |
Reframed technical problem in objective terms, focusing on underlying causes rather than symptoms.

decision_drivers:

- "Reduce operational complexity while supporting 10x tenant growth."
- "Preserve strong consistency for billing and invoicing workflows."
- "Minimize migration risk over the next 6 months."

mental_models_and_techniques:

- "First Principles"
- "5 Whys"
- "Second-Order Thinking"

alternatives:

- id: "ALT-0"
  name: "Do nothing / keep current shared-table approach"
  summary: "Retain existing shared tables without explicit sharding strategy."
  pros: ["No migration effort", "Zero immediate risk"]
  cons: ["Unbounded tenant growth risk", "Operational complexity under load"]
- id: "ALT-1"
  name: "Single-tenant database per large tenant"
  summary: "Move high-value tenants to their own database instances."
  pros: ["Strong isolation", "Per-tenant performance tuning"]
  cons: ["Operational overhead", "Complex routing and management"]
- id: "ALT-2"
  name: "Shared database with schema-based sharding"
  summary: "Use a shared database with tenant_id-based sharding and guardrails."
  pros: ["Balanced isolation vs. operability", "Simpler migrations"]
  cons: ["Still shared blast radius if misconfigured"]

recommended_decision:
choice: "Shared database with schema-based sharding"
rationale: |
Summary of why this option best satisfies the validated drivers, including explicit trade-offs against alternatives.
assumptions: - "Peak tenant count remains within <X> over next 18 months." - "Team has capacity to build sharding middleware and observability."
non_goals: - "[OUT] Optimize for multi-region active/active in this ADR."

tradeoffs_and_consequences:
positive: - "Improved scalability for high-traffic tenants." - "Clearer ownership boundaries for sharded data."
negative: - "Increased complexity in routing and migration tooling." - "Potential for uneven shard utilization requiring rebalancing."
unknowns: - "Long-term cost profile of managing many shards."

implementation_plan_high_level:

- "Define sharding key and guardrails in contracts and specs."
- "Introduce sharding-aware data access layer behind current APIs."
- "Plan and execute phased migration of tenants to sharded layout."
- "Update observability and runbooks for sharded topology."

verification_criteria:

- metric: "P95 read latency for sharded tables"
  target: "≤ 200ms under 2x current peak load"
  window: "First 30 days after full rollout"
- metric: "Migration incident rate"
  target: "0 Sev-1 incidents during rollout"
  window: "Migration period"

confidence_rating: "medium" # low | medium | high
confidence_rationale: |
Short explanation of why confidence is low/medium/high, referencing data, precedent, or gaps.

open_questions:

- id: "OQ-ADR-1"
  question: "Do we require cross-region failover within this decision scope?"
  owner: "@platform-lead"
  blocking: false

references:

- "doc/changes/2026-01/2026-01-15--PDEV-123--new-billing-model/chg-PDEV-123-spec.md"
- "doc/spec/features/billing/tenants.md"
- "doc/adr/ADR-0003-database-vendor-choice.md"

</technical_decision_planning_summary>
```

Notes:

- The values above are examples; when generating a real summary, fill fields deterministically from the planning conversation and documentation context.
- It is acceptable for some lists to be empty if the user explicitly confirms that the aspect is not applicable (e.g., no related changes). Do not invent content.
- Open questions must retain their blocking flag; do not silently drop unresolved items.
- This summary block must reflect what the user has actually agreed upon; if something remains uncertain, state it as an assumption, open question, or explicitly deferred item.
  </planning_summary_structure>

<handoff_to_adr>
After emitting the `<technical_decision_planning_summary>` block:

1. Immediately output a concise, human-readable recap, for example:
   - "Planning for ADR-0007 looks complete. I have synthesized the planning summary above, which /write-adr will use to generate the canonical Architecture Decision Record."

2. Recommend the exact next command, using the confirmed zeroPad4 number:
   - `Next step: run "/write-adr <zeroPad4>" to generate the canonical ADR from this planning context.`

3. If the decision is clearly linked to one or more changes (workItemRef), also recommend ensuring that the corresponding change spec front-matter links back to this ADR once created.

4. Do NOT call `/write-adr` automatically. The user must trigger this command when ready.

5. Do NOT output the full ADR template as the final answer; only the `<technical_decision_planning_summary>` block is treated as the authoritative planning snapshot for downstream commands.
   </handoff_to_adr>

<constraints>
- Never generate or suggest code.
- Never propose or rely on exact file paths or concrete class/module names; always use logical component names that a coding agent can later map to actual files.
- Do not create, edit, or commit any files; this command is read-only with respect to the filesystem and Git.
- Do not construct the canonical ADR; only gather and structure planning context for it.
- Do not include merge request templates, git commands, or implementation task lists; those belong in change specs, implementation plans, and coding workflows.
- Use only information available from the user and existing docs; missing details must be exposed as assumptions or open questions, not silently filled in.
</constraints>

<examples>
Example 1 — New architectural decision (no number provided):

- User runs: `/plan-decision` and says: "We need to decide our long-term message broker strategy (Kafka vs. managed queues)."
- Agent:
  - Scans doc/adr/, finds existing max ADR number 0003, proposes ADR-0004.
  - Clarifies current messaging usage, pain points, and constraints.
  - Identifies decision drivers (operational burden, reliability, ecosystem fit, cost).
  - Shapes alternatives (stay on current queue, adopt Kafka, adopt managed cloud messaging) including do-nothing.
  - Compares options against drivers, highlights trade-offs and unknowns.
  - Once the user is satisfied, produces `<technical_decision_planning_summary>` for ADR-0004 and suggests: `/write-adr 0004`.

Example 2 — ADR driven by an existing change:

- User runs: `/plan-decision 21` and says: "PDEV-123 introduces a new billing pipeline; we need an ADR for how we model idempotency and retries."
- Agent:
  - Normalizes adrNumber to 0021 and confirms.
  - Loads the change spec for PDEV-123 and relevant specs/contracts as context.
  - Clarifies the problem framing (idempotency guarantees, failure modes, latency constraints).
  - Identifies drivers (correctness, operational simplicity, observability, impact on existing clients).
  - Enumerates alternatives (idempotency keys with dedupe store, exactly-once semantics via transactional outbox, best-effort with compensations), including do-nothing if relevant.
  - Records trade-offs and a recommended decision, plus verification criteria.
  - Produces `<technical_decision_planning_summary>` for ADR-0021 with `related_changes: ["PDEV-123"]` and suggests using `/write-adr 0021` next.
    </examples>

<notes>
- This command replaces the older free-form Archie prompt usage with a repository-aware, ADR-template–aligned planning conversation.
- Its primary output is clarity: a structured, explicit understanding of the technical decision that /write-adr can transform into the canonical ADR without guessing.
- Always prioritize precision, traceability, and user alignment over speed. If in doubt, ask.
</notes>
