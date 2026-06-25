---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/plan-decision.md
#
description: Interactive decision planning session to prepare canonical context, classification, rigor, and decision rights for /write-decision. Supports all decision types (ADR/PDR/TDR/BDR/ODR).
agent: decision-advisor
claude:
  model: sonnet
---

<purpose>
Guide the user through a structured, interactive **decision** conversation that transforms an initial question or proposal (of any type — architecture, product, technical, business, or operating) into a complete, implementation-agnostic planning context for a single numbered Decision Record. The command:

- **Triages** the decision (record-worthiness; R0 escape hatch), **classifies** it on four axes (type × domain tags × archetype × conditions), **selects a rigor profile** (R0–R3 + emergency overlay), and **assigns decision rights** (DACI) — then plans at a depth scaled by rigor.
- Discovers or confirms the decision record number (e.g. 0007) by scanning existing records in doc/decisions/ for the relevant type (ADR, PDR, TDR, BDR, ODR; defaults to ADR only when type is genuinely unspecified).
- Orients itself in the current repository and high-level documentation under doc/spec/, doc/overview/, doc/changes/, and doc/contracts/.
- Systematically elicits and refines all information needed by /write-decision (context, problem framing, **hard requirements (constraints)**, decision drivers, alternatives, trade-offs, assumptions, verification criteria, etc.), without generating the decision record file itself.
- Applies decision-making discipline (clarify problem → classify → rigor → rights → confirm drivers → explore options → recommend) without exposing internal mechanics unless asked.
- Concludes with a compact, machine- and human-friendly planning summary block plus a clear recommendation to invoke `/write-decision <number>` and, where relevant, to link back to related changes (workItemRef).

This command never writes files or modifies Git state; it operates purely via conversational planning and read-only repository inspection. See `doc/guides/decision-making.md` for the full decision process.
</purpose>

<command>
User invocation (natural-language friendly):

/plan-decision [<number>] [free-text context]

Examples:

- `/plan-decision`  
  → Auto-discover next number from doc/decisions/ for the relevant type, then ask what decision we are shaping.

- `/plan-decision 12`  
  → Treat 12 as the intended record number (normalized internally to 0012), then start refinement questions.

- `/plan-decision 0042 Choose data sharding strategy for multi-tenant billing`  
  → Use 0042 as the number and seed initial understanding from the idea text.

Notes:

- The command always operates within the current repository only (single codebase per session).
- If multiple decision sessions are active in the same conversation, clearly separate them by record number and avoid mixing context.
  </command>

<inputs>
- rawArguments = content of xml tag <rawArguments>...</rawArguments> (entire argument string after the command name).
- numberHint: first token that is purely digits (if any); OPTIONAL.
- ideaSeed: remainder of rawArguments after stripping the command name and optional numberHint; may be empty.

All other planning inputs (context, problem framing, drivers, alternatives, trade-offs, verification criteria, etc.) must be elicited interactively from the user and/or derived from existing documentation by summarization. No unstated assumptions may be invented.
<rawArguments>
$ARGUMENTS
</rawArguments>
</inputs>

<number_resolution>

Primary goal: determine the canonical numeric record number (zero-padded to exactly 4 digits) for this planning session, for the chosen decision type.

Resolution rules:

1. If adrNumberHint is provided:
   - Validate that it is composed of digits only.
   - Normalize to zeroPad4 = numberHint left-padded with zeros to length 4 (e.g. 7 → 0007; 123 → 0123).
   - Treat this as the proposed record number; ask the user to confirm or override.

2. If no numberHint:
   - Discover existing decision records by scanning for files matching: `doc/decisions/<TYPE>-*-*.md` (where TYPE defaults to ADR only when the decision type is genuinely unspecified).
   - For each match, parse the numeric segment immediately after the type prefix (e.g. ADR-0001-short-title.md → 1, TDR-0042-something.md → 42).
   - If no existing records of this type are found, propose `0001` as the first number.
   - Otherwise, let maxExisting be the highest parsed number; propose candidate = maxExisting + 1.
   - Normalize candidate to zeroPad4 as above.
   - Present the candidate to the user as the default (e.g. "Based on existing ADRs, I propose using number 0007."); allow the user to accept or override with any other integer.

3. Once confirmed by the user, refer to this as:
   - recordNumber (integer form).
   - zeroPad4 (string form, exactly 4 digits; e.g. "0007").

4. Use zeroPad4 consistently when referencing this decision record in summaries, e.g. `<TYPE>-<zeroPad4>` and `/write-decision <zeroPad4>`.

This command MUST NOT create folders or files in doc/decisions/; it only proposes and confirms the numeric identifier for use by `/write-decision`.
</number_resolution>

<context_sources>
The planning agent may read from the repository to ground its questions and synthesis, but must not modify any files.

Primary context sources:

- `doc/spec/**`: current system and feature-level specifications.
- `doc/overview/**`: domain and product overviews (north star, architecture overviews, glossary/ubiquitous language).
- `doc/changes/**/*--*--*/chg-*-spec.md`: change specifications that may have motivated or be impacted by this decision.
- `doc/decisions/**`: existing decision records for precedent or constraints.
- `doc/contracts/**`: REST, events, and data contracts relevant to the decision.
- `doc/domain/**`, `doc/diagrams/**`, and other documentation under `doc/` that inform architecture, flows, and constraints.

Usage rules:

- When the user describes the decision, infer likely domain/technical keywords (services, bounded contexts, modules, infrastructure components) and search documentation files for those terms.
- Summarize only the relevant parts in concise bullets; do not paste large documents.
- When useful, quote document titles and short excerpts and ask the user to confirm whether those are the correct context anchors for the decision.
- Treat existing specs, contracts, and ADRs as authoritative constraints unless the user explicitly states that a prior decision is being revisited.
  </context_sources>

<session_flow>
Overall planning session flow (per decision number):

1. **Initialization & orientation**
   - Confirm that we are operating in a single repository and which service/application or domain this decision primarily affects.
   - Resolve and confirm the number / zeroPad4 using <number_resolution>.
   - Ask the user for a short, plain-language description of the decision and why it matters now.
   - If ideaSeed was provided on the command line, restate it back for confirmation.
   - Ask whether this decision is linked to an existing change (workItemRef like `PDEV-123` or `GH-456`) or is broader/cross-cutting.

2. **Triage — record-worthiness & the R0 escape hatch**
   - Determine whether the decision is record-worthy (hard to reverse, precedent-setting, cross-component, security/privacy posture change, new dependency/vendor, business/product/operating direction, or likely questioned later).
   - If it is routine/delegated/reversible/policy-covered, apply the **R0 escape hatch**: no record is needed (optional note/commit/ticket comment suffices). State this and stop the formal planning, unless the user insists on recording it.
   - Capture: what/why-now, deadline, proposed decision type, domains, archetype, conditions (reversibility, stakes, urgency, uncertainty, blast radius, recurrence).

3. **Classify (four axes)**
   - Classify on four axes: **type** (ADR/PDR/TDR/BDR/ODR) × **domain tags** (strategy, product, UX, pricing, architecture, security, privacy, finance, operations, …) × **archetype** (selection, design, prioritization, policy, go_no_go, experiment, exception_waiver, incident_response, …) × **conditions** (Cynefin environment, reversibility, stakes, urgency, uncertainty, blast radius, recurrence). These axes drive rigor, method, and authority — they are not collapsed to a single type.
   - Confirm the decision type; default to ADR **only when the type is genuinely unspecified** (not when a non-architecture decision was misrouted).

4. **Select rigor (R0–R3 + emergency overlay)**
   - Select a rigor profile:
     - **R0** — routine/delegated (no record; AI may act within delegated bounds).
     - **R1** — lightweight (low–medium impact, reversible; concise brief; ≤1 business day).
     - **R2** — standard (meaningful trade-off, may be questioned, multi-team, material cost; full record).
     - **R3** — high assurance (hard-to-reverse, critical/financial/security/privacy/legal/safety/ethical, org-wide, or deep-uncertainty + large downside; full record + independent challenge + human final decision + review date).
   - If an incident/deadline requires immediate action, apply the **emergency overlay** sequencing (declare owner+authority → act to stabilize → record retrospectively → post-review).
   - Scale the depth of all subsequent steps to the selected rigor (R1 skips R3-only depth; R3 adds premortem, sensitivity, dissent).

5. **Assign decision rights (DACI)**
   - Assign DACI roles: **Driver** (coordinates), **Decider/Approver** (one accountable authority), **Contributors** (expertise/evidence), **Required reviewers**, **Performers** (execute), **Informed**.
   - For R2/R3, note that a **human final decision** is required (recommendation ≠ decision). Capture the expected human decider for the `ai_assistance.human_decider` field.

6. **Clarify context and problem framing**
   - Elicit: current state, pain points, gaps, and situational facts (technical, organizational, regulatory context).
   - Reframe the problem in objective technical terms, distinguishing symptoms from root causes.
   - Apply techniques such as 5 Whys or Ishikawa (textually) to probe underlying causes where appropriate.
   - Keep separate lists of **facts**, **assumptions**, and **to confirm** items.

7. **Elicit hard requirements (constraints)**
   - Elicit **hard requirements as a distinct factor class, separate from decision drivers.** Constraints are binary, pass/fail gates that ELIMINATE alternatives rather than rank them; drivers are continuous preferences used to rank survivors. Never fold the two together.
   - For each constraint, capture a structured entry:
     - **ID**: `C-1`, `C-2`, … (compact, per-record identifiers used to cross-reference from Alternatives and Decision).
     - **Statement**: the requirement phrased as a pass/fail test.
     - **Source**: one of `regulatory` | `contractual` | `prior decision` | `AC` | `internal standard`.
     - **Verification**: one of `test` | `audit` | `code review` | `architect sign-off` | `demonstration` (not limited to automated checks).
     - **Negotiable**: `yes` | `no` (`no` = a violation is disqualifying; `yes` = a documented accepted-risk exception may be recorded in the Decision).
   - An empty constraint set is a CONSCIOUS author choice, not an omission. If the decision genuinely has no hard requirements, confirm that explicitly with the user so the emptiness is deliberate and reviewable.
   - Table-stakes constraints (ones every alternative already satisfies) may be captured once as a brief acknowledgment rather than elaborated per-entry.

8. **Driver/constraint overlap detection**
   - When the SAME factor is captured as both a decision driver and a constraint, WARN and REQUIRE the author to categorize it into EXACTLY ONE bucket before proceeding.
   - This is a SOFT WARNING: surface the conflict, explain that a factor cannot be both a continuous ranking preference and a binary gate, and ask the user to choose driver XOR constraint. It is NOT a hard block that halts the session.
   - Each factor must end up in exactly one bucket.

9. **Identify and validate decision drivers**
   - Elicit and confirm decision drivers across:
     - Business (e.g., cost, time-to-market, risk reduction).
     - Technical (e.g., performance, reliability, scalability, consistency model, coupling).
     - Operational and team factors (e.g., operability, team skills, cognitive load).
   - Where helpful, ask the user to prioritize or rank drivers.
   - Confirm that drivers are agreed before evaluating options. Re-run overlap detection (step 8) if a newly elicited driver duplicates an existing constraint.

10. **Shape the option space (alternatives)**
    - Identify at least two substantive alternatives plus an explicit "do nothing / keep current approach" baseline.
    - For each alternative, capture:
      - Summary (one or two sentences).
      - Pros (aligned with drivers).
      - Cons (risks, costs, constraints violated).
      - Constraint compliance: an explicit pass/fail evaluation against each documented constraint (C-1, C-2, …), not only pros/cons against drivers. Tag which constraints it satisfies or violates.
      - Situations where the alternative would be preferable (if any).
    - Avoid premature convergence: ensure options are meaningfully distinct.

11. **Evaluate options and converge on a recommendation**
    - Compare alternatives explicitly against decision drivers (tables or structured bullets are encouraged).
    - Screen on constraints FIRST, then rank on drivers: an alternative violating a disqualifying (`negotiable: no`) constraint is ineligible and must not be recommended. Note any negotiable (`negotiable: yes`) constraint the recommended alternative violates as a candidate accepted-risk exception.
    - Call out trade-offs, second-order effects, and interactions with existing decision records.
    - Propose a recommended option, but clearly separate recommendation from final decision.
    - Explicitly list assumptions underpinning the recommendation.

12. **Trade-offs, consequences, and scope boundaries**
    - Catalogue positive outcomes, negative outcomes, and unknowns.
    - Clarify the scope of the decision (e.g., single service vs. cross-service vs. organization-wide).
    - Identify what is explicitly **not** addressed by this decision ([OUT] items) to avoid scope creep.

13. **High-level implementation and rollout concept**
    - Sketch, at a high level only:
      - Requirements / refactors / migrations implied by the decision.
      - Rollout strategy and guardrails.
      - Risk mitigation strategies during implementation.
    - Do not generate low-level tasks; those belong in change specs and implementation plans.

14. **Verification criteria and confidence**
    - Elicit KPIs or metrics that will be used to evaluate the decision post-implementation.
    - Define measurement windows and data sources where possible.
    - Ask the user for a confidence rating (Low / Medium / High) and factors influencing it.

15. **Consolidation and readiness check**
    - Maintain throughout the session an explicit list of **Open Questions**, each tagged as BLOCKING or NON-BLOCKING and with an owner.
    - Before concluding, review all captured elements with the user and:
      - Resolve as many open questions as possible via further targeted questions.
      - For remaining questions, confirm BLOCKING vs NON-BLOCKING and that the user is comfortable proceeding to record drafting with those unresolved items.
      - Only then synthesize the final planning summary for /write-decision and suggest running that command.
     </session_flow>

<questioning_strategy>
The command must enforce disciplined, high-signal questioning inspired by the Archie prompt, adapted for ADR planning:

- Always start from the user's own words. Rephrase the decision context back to them and ask if the restatement is accurate before diving into details.
- Never jump straight to a record-like output. Ask questions first, then synthesize.
- Always clarify decision drivers AND elicit hard requirements (constraints) before evaluating options; keep the two factor classes separate and run overlap detection so no factor lives in both buckets. If either is unclear, pause and refine it.
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
- If the user asks to "just write the decision record" before enough context is gathered, respond by explaining what key pieces are still missing and ask for them explicitly instead of proceeding with guesswork.
  </questioning_strategy>

<planning_summary_structure>
When the user confirms that planning feels complete enough to draft the decision record, synthesize a compact, structured planning summary that is easy for both humans and the /write-decision command to consume.

The final message of a completed planning session MUST include a block in this form (field order and naming must match exactly; values are illustrative; `/write-decision` consumes this block directly):

```md
<decision_planning_summary>
decision_type: "adr"                  # adr | pdr | tdr | bdr | odr (defaults to adr ONLY when type genuinely unspecified)
record_number: "0007"                 # zeroPad4 number for the chosen type
slug_hint: data-sharding-strategy
title: Choose data sharding strategy for multi-tenant billing
status_hint: Proposed                 # Proposed | Under Review | Accepted
owners: ["team-platform", "@cto"]
service: "billing-service"
labels: ["architecture", "storage", "scalability"]
related_changes: ["PDEV-123"]
decision_scope: "service"             # service | cross-service | organization-wide
audience: internal

# --- classification, rigor, governance, AI-assistance (captured by the triage->rights front-end) ---
classification:
  domains: ["architecture", "storage"]
  archetype: "selection"
  environment: "complicated"          # clear | complicated | complex | chaotic (Cynefin)
  rigor: "R2"                         # R0 | R1 | R2 | R3 (R0 produces no record)
  reversibility: "moderate"           # easy | moderate | hard
  stakes: "high"
  urgency: "medium"
  uncertainty: "medium"
  blast_radius: "org"
  recurrence: "one-off"
governance:                           # DACI decision rights
  driver: "@platform-lead"
  decider: "@cto"                     # the accountable human authority (R2/R3 require a human decision)
  contributors: ["@data-eng"]
  reviewers: ["@security"]
  performers: ["@platform-lead"]
  informed: ["@billing-team"]
ai_assistance:
  used: true
  roles: ["researcher", "analyst", "record-writer"]
  external_data_shared: false
  citations_verified: true
  human_decider: "@cto"               # required before Accepted for R2/R3
  reviewers: ["@security"]

summary: |
Short, 1–3 sentence summary of the decision: what choice is being made and why it matters, without low-level solution detail.

context: |
Concise description of current state, triggering events, and any relevant prior decisions or changes (situational facts only — do NOT list binary constraints here; those go in hard_requirements).

problem_framing: |
Reframed problem in objective terms, focusing on underlying causes rather than symptoms.

hard_requirements:

- id: "C-1"
  statement: "PII at rest MUST be encrypted with a customer-managed key."
  source: "regulatory"            # regulatory | contractual | prior decision | AC | internal standard
  verification: "audit"           # test | audit | code review | architect sign-off | demonstration
  negotiable: "no"                # yes | no  ("no" = a violation is disqualifying)
- id: "C-2"
  statement: "Migration window MUST NOT exceed 4 hours of planned downtime."
  source: "contractual"
  verification: "demonstration"
  negotiable: "yes"

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
  constraint_compliance: "C-1: pass; C-2: pass (no migration)"
- id: "ALT-1"
  name: "Single-tenant database per large tenant"
  summary: "Move high-value tenants to their own database instances."
  pros: ["Strong isolation", "Per-tenant performance tuning"]
  cons: ["Operational overhead", "Complex routing and management"]
  constraint_compliance: "C-1: pass; C-2: fail (migration exceeds 4h window)"
- id: "ALT-2"
  name: "Shared database with schema-based sharding"
  summary: "Use a shared database with tenant_id-based sharding and guardrails."
  pros: ["Balanced isolation vs. operability", "Simpler migrations"]
  cons: ["Still shared blast radius if misconfigured"]
  constraint_compliance: "C-1: pass; C-2: pass"

recommended_decision:
  choice: "Shared database with schema-based sharding"
  rationale: |
    Summary of why this option best satisfies the validated drivers, including explicit trade-offs against alternatives.
  constraint_attestation: "Satisfies all constraints C-1 and C-2."   # OR, for a violated negotiable constraint: document an accepted-risk exception (only for negotiable: yes)
  assumptions:
    - "Peak tenant count remains within <X> over next 18 months."
    - "Team has capacity to build sharding middleware and observability."
  non_goals:
    - "[OUT] Optimize for multi-region active/active in this decision."

tradeoffs_and_consequences:
  positive:
    - "Improved scalability for high-traffic tenants."
    - "Clearer ownership boundaries for sharded data."
  negative:
    - "Increased complexity in routing and migration tooling."
    - "Potential for uneven shard utilization requiring rebalancing."
  unknowns:
    - "Long-term cost profile of managing many shards."

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
- "doc/decisions/ADR-0003-database-vendor-choice.md"

</decision_planning_summary>
```

Notes:

- The values above are examples; when generating a real summary, fill fields deterministically from the planning conversation and documentation context.
- It is acceptable for some lists to be empty if the user explicitly confirms that the aspect is not applicable (e.g., no related changes). Do not invent content.
- `hard_requirements:` is a DISTINCT field from `decision_drivers:`. Constraints (binary gates) and drivers (continuous preferences) must never be merged. An empty `hard_requirements:` list is a conscious author choice, not an omission — confirm the emptiness explicitly with the user. `/write-decision` reads this field to render the Constraints section.
- Open questions must retain their blocking flag; do not silently drop unresolved items.
- This summary block must reflect what the user has actually agreed upon; if something remains uncertain, state it as an assumption, open question, or explicitly deferred item.
- `decision_type` determines which TYPE prefix `/write-decision` will use. The canonical generic path uses **0** `adr.*` fields — the record number, slug, and title are generic fields (`record_number`, `slug_hint`, `title`).
- **Backward-compatibility alias (NFR-2).** Consumers (`/write-decision`) MUST ALSO accept the legacy tag and fields with 0 behavior change:
  - Legacy tag `<technical_decision_planning_summary>` is treated as an alias for `<decision_planning_summary>`.
  - Legacy `adr.number` → `record_number`; `adr.slug_hint` → `slug_hint`; `adr.title` → `title`.
  - If BOTH legacy and generic fields are present, the generic fields take precedence.
- The `rigor` field drives `/write-decision`'s proportional rendering (R1 compact subset / R2 standard / R3 full). R0 produces no record.
- The `governance` and `ai_assistance` blocks flow into the record's optional front matter; `ai_assistance.human_decider` is required before any R2/R3 record advances to Accepted.
  </planning_summary_structure>

<handoff_to_write_decision>
After emitting the `<decision_planning_summary>` block:

1. Immediately output a concise, human-readable recap, for example:
   - "Planning for ADR-0007 looks complete. I have synthesized the planning summary above, which /write-decision will use to generate the canonical decision record."

2. Recommend the exact next command, using the confirmed zeroPad4 number:
   - `Next step: run "/write-decision <zeroPad4>" to generate the canonical decision record from this planning context.`

3. If the decision is clearly linked to one or more changes (workItemRef), also recommend ensuring that the corresponding change spec front-matter links back to this decision record once created.

4. For R2/R3 decisions, remind the user that a **human final decision** is required before the record advances to Accepted (recommendation ≠ decision). Suggest running `/review-decision <ID>` for independent challenge if appropriate.

5. Do NOT call `/write-decision` automatically. The user must trigger this command when ready.

6. Do NOT output the full decision record template as the final answer; only the `<decision_planning_summary>` block is treated as the authoritative planning snapshot for downstream commands.
   </handoff_to_write_decision>

<constraints>
- Never generate or suggest code.
- Never propose or rely on exact file paths or concrete class/module names; always use logical component names that a coding agent can later map to actual files.
- Do not create, edit, or commit any files; this command is read-only with respect to the filesystem and Git.
- Do not construct the canonical decision record; only gather and structure planning context for it.
- Do not include merge request templates, git commands, or implementation task lists; those belong in change specs, implementation plans, and coding workflows.
- Use only information available from the user and existing docs; missing details must be exposed as assumptions or open questions, not silently filled in.
</constraints>

<examples>
Example 1 — New architectural decision (no number provided):

- User runs: `/plan-decision` and says: "We need to decide our long-term message broker strategy (Kafka vs. managed queues)."
- Agent:
  - Scans doc/decisions/, finds existing max ADR number 0003, proposes ADR-0004.
  - Clarifies current messaging usage, pain points, and constraints.
  - Identifies decision drivers (operational burden, reliability, ecosystem fit, cost).
  - Shapes alternatives (stay on current queue, adopt Kafka, adopt managed cloud messaging) including do-nothing.
  - Compares options against drivers, highlights trade-offs and unknowns.
  - Once the user is satisfied, produces `<decision_planning_summary>` for ADR-0004 and suggests: `/write-decision 0004`.

Example 2 — ADR driven by an existing change:

- User runs: `/plan-decision 21` and says: "PDEV-123 introduces a new billing pipeline; we need an ADR for how we model idempotency and retries."
- Agent:
  - Normalizes adrNumber to 0021 and confirms.
  - Loads the change spec for PDEV-123 and relevant specs/contracts as context.
  - Clarifies the problem framing (idempotency guarantees, failure modes, latency constraints).
  - Identifies drivers (correctness, operational simplicity, observability, impact on existing clients).
  - Enumerates alternatives (idempotency keys with dedupe store, exactly-once semantics via transactional outbox, best-effort with compensations), including do-nothing if relevant.
  - Records trade-offs and a recommended decision, plus verification criteria.
  - Produces `<decision_planning_summary>` for ADR-0021 with `related_changes: ["PDEV-123"]` and suggests using `/write-decision 0021` next.
    </examples>

<notes>
- This command provides a repository-aware, template-aligned decision planning conversation for all decision types (ADR/PDR/TDR/BDR/ODR).
- Its primary output is clarity: a structured, explicit understanding of the decision that /write-decision can transform into the canonical decision record without guessing.
- Always prioritize precision, traceability, and user alignment over speed. If in doubt, ask.
</notes>
