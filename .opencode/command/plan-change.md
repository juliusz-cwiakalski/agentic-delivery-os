---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/plan-change.md
#
description: Interactive change-planning session to prepare context for /write-spec.
agent: build
---

<purpose>
Guide the user through a structured, interactive planning conversation that transforms an initial idea or problem report into a complete, implementation-agnostic planning context for a single tracked change.

This command:

- Discovers or confirms the workItemRef (e.g., `PDEV-123`, `GH-456`) by scanning existing change specs or querying the tracker.
- Orients itself in the repository and high-level documentation under `doc/spec/` and related docs.
- Systematically elicits and refines all information needed by `/write-spec` (WHY, outcomes, boundaries, contracts, risks, NFRs, etc.).
- Concludes with a compact `<change_planning_summary>` plus a clear recommendation to invoke `/write-spec <workItemRef>`.

This command never writes files or modifies Git state; it operates purely via conversational planning and read-only repository inspection.
</purpose>

<command>
User invocation:
  /plan-change [<workItemRef>] [free-text idea / context]
Examples:
  /plan-change
    → Query tracker or discover next workItemRef, then ask what you want to change.
  /plan-change PDEV-123
    → Use PDEV-123 as the intended workItemRef, then start refinement questions.
  /plan-change GH-456 New tenant billing model for enterprise customers
    → Use GH-456 as workItemRef and seed initial understanding from the idea text.
</command>

<inputs>
  <item>rawArguments: content after the command name (available via $ARGUMENTS).</item>
  <item>workItemRefHint: first token matching `<PREFIX>-<digits>` pattern (e.g., `PDEV-123`, `GH-456`); OPTIONAL.</item>
  <item>ideaSeed: remainder of rawArguments after stripping workItemRefHint; may be empty.</item>
</inputs>

<workItemRef_resolution>
Primary goal: determine the canonical workItemRef for this planning session.

Resolution rules:

1. If workItemRefHint is provided:
   - Validate format: uppercase prefix + hyphen + digits (e.g., `PDEV-123`, `GH-456`).
   - Treat as proposed workItemRef; ask user to confirm or override.

2. If no workItemRefHint:
   - Discover existing specs by scanning: `doc/changes/**/chg-*-spec.md`.
   - For each match, parse the workItemRef segment (e.g., `chg-PDEV-123-spec.md` → `PDEV-123`).
   - Propose creating a new ticket via `@pm` or ask user to provide an existing reference.
   - If user provides a new reference, validate format and confirm.

3. Once confirmed, use workItemRef consistently in all summaries and handoff commands.

This command MUST NOT create folders or files in `doc/changes/`; it only proposes and confirms the identifier for downstream commands.
</workItemRef_resolution>

<context_sources>
The planning agent may read from the repository to ground questions, but must not modify files.

Primary sources:

- `doc/spec/**`: system-level and feature-level specifications.
- `doc/overview/**`: domain and product overview documents.
- `doc/adr/**`: architecture decision records.
- `doc/domain/**`, `doc/diagrams/**`: architecture, flows, constraints.
- Existing change specs under `doc/changes/**/chg-*-spec.md` for related changes.

Usage rules:

- When user describes the change, infer domain keywords and search documentation.
- Summarize only relevant parts in concise bullets; do not paste large documents.
- Quote document titles and short excerpts; ask user to confirm context anchors.
- Treat existing specs and ADRs as authoritative constraints unless explicitly revisiting.
  </context_sources>

<session_flow>

1. **Initialization & orientation**
   - Confirm single repository scope and target service/app.
   - Resolve and confirm workItemRef using workItemRef_resolution.
   - Ask for short, plain-language description of the desired change.
   - If ideaSeed provided, restate for confirmation.

2. **Clarify problem and context**
   - Elicit: current state, pain points, affected users, triggers, constraints.
   - Probe for singular, measurable problem statement.
   - Identify change type: feat|fix|refactor|docs|test|chore|perf|build|ci|revert|style.

3. **Define goals and success metrics**
   - Separate: business goals, user goals, operational goals.
   - For each goal, elicit measurable success metric (baseline, target, window).

4. **Outline functional capabilities and flows**
   - Translate idea into high-level Functional Capabilities (F-# style).
   - Clarify actors, triggers, observable outcomes.
   - Elicit key flows: happy path, edge/error paths, cross-service flows.

5. **Identify interfaces & integration contracts**
   - For UI changes: clarify main surfaces/components in logical terms.
   - For APIs: method, path, request/response examples.
   - For events: names, topics, payloads, consumers.
   - For data model: new entities, fields, constraints.

6. **Non-functional requirements and telemetry**
   - Performance targets, reliability/availability, security, privacy.
   - Observability (metrics, logs, traces, alerts).
   - Accessibility and usability.

7. **Dependencies, risks, assumptions**
   - Internal dependencies: services/components requiring coordination.
   - External dependencies: vendors/APIs/third-party systems.
   - Risks (RSK-# style) with Impact & Probability and mitigations.
   - Version impact (none|patch|minor|major) and risk level (low|medium|high).

8. **Affected components and scope boundaries**
   - List impacted components with `[CREATE]`, `[MODIFY]`, `[DEPRECATE]`, `[REMOVE]`.
   - Clarify "In Scope", "Out of Scope" (`[OUT]`), "Deferred / Maybe-Later".

9. **Acceptance criteria and rollout strategy**
   - Draft Given/When/Then acceptance criteria.
   - Discuss rollout: migration, dark launch, rollback triggers, communication.

10. **Consolidation and readiness check**
   - Maintain explicit list of Open Questions (BLOCKING / NON-BLOCKING with owner).
   - Resolve as many as possible; confirm user is comfortable proceeding.
   - Synthesize final `<change_planning_summary>`.
    </session_flow>

<questioning_strategy>

- Start from user's own words. Rephrase and ask if accurate.
- Never jump to output; ask questions first.
- When ambiguity detected:
  1. Call out explicitly.
  2. Propose 2-4 options with rationale.
  3. Recommend one as default.
  4. Ask user to confirm.
  5. Record decision.
- At most 3-7 focused questions per turn, grouped by theme.
- Maintain living summary: "What we know", "Decisions made", "Open questions".
- If user asks to "just generate the spec" too early, explain missing pieces.
  </questioning_strategy>

<planning_summary_structure>
When planning is complete, synthesize compact structured summary:

```md
<change_planning_summary>
change.workItemRef: PDEV-123
change.type: feat
change.slug_hint: new-tenant-billing-model
change.title: New tenant billing model for enterprise customers
version_impact: minor
risk_level: medium
owners: ["team-billing", "@product-owner"]
service: "billing-service"
labels: ["billing", "enterprise", "payments"]
audience: internal
security_impact: medium

summary: |
Short, 1-3 sentence elevator pitch of the change.

context: |
Current state, pain points, constraints.

problem_statement: |
"Because <limitation>, <user> cannot <outcome>, resulting in <impact>."

goals:
business: ["...", "..."]
user: ["...", "..."]
operational: ["...", "..."]

success_metrics:

- name: "Checkout conversion rate"
  baseline: "2.1%"
  target: "≥ 3.0%"
  window: "first 90 days after rollout"

functional_capabilities:

- id: "F-1"
  name: "Configurable tenant billing model"
  description: "..."
  rationale: "..."

user_and_system_flows:

- id: "Flow-1"
  name: "Tenant admin configures billing model"
  summary: "..."

interfaces:
rest_endpoints: - id: "API-1"
method: "POST"
path: "/api/billing/tenants/{tenantId}/billing-model"
purpose: "Create or update tenant billing model"
visibility: "internal"
events: - id: "EVT-1"
name: "TenantBillingModelChanged"
topic: "billing.tenant-model.changed"
data_model_impacts: - id: "DM-1"
summary: "New BillingModel entity..."

non_functional_requirements:

- id: "NFR-Perf-1"
  summary: "P95 latency ≤ 300ms under 200 RPS."

telemetry_and_observability:

- summary: "Metrics, logs, alerts required."

risks:

- id: "RSK-1"
  description: "..."
  impact: "H|M|L"
  probability: "H|M|L"
  mitigation: "..."

assumptions:

- "..."

dependencies:
internal: ["..."]
external: ["..."]

affected_components_high_level:

- tag: "[MODIFY]"
  component: "Billing Service"
  notes: "Add support for tenant-specific billing rules."

acceptance_criteria_examples:

- id: "AC-F1-1"
  text: "Given <precondition> When <action> Then <outcome>."

rollout_and_change_management: |
High-level rollout concept, migration notes, rollback triggers.

open_questions:
blocking: - id: "OQ-1"
question: "..."
owner: "..."
non_blocking: - id: "OQ-2"
question: "..."
owner: "..."

decisions:

- id: "DEC-1"
  title: "Chosen billing model representation"
  chosen_option_and_rationale: "..."
  status: "Final|Pending|Revisit"
  </change_planning_summary>
```

</planning_summary_structure>

<handoff_to_spec>
After emitting `<change_planning_summary>`:

1. Output concise human-readable recap.
2. Recommend exact next command: `/write-spec <workItemRef>`.
3. After spec approval: `/write-plan <workItemRef>`.
4. Do NOT call `/write-spec` or `/write-plan` automatically.
5. Do NOT output the full spec template or write any files.
   </handoff_to_spec>

<constraints>
- Never generate or suggest code.
- Never propose exact file paths or class/module names; use logical component names.
- Do not create, edit, or commit files; read-only filesystem and Git.
- Do not construct the canonical spec or plan; only gather planning context.
- Do not include MR templates, Git commands, or implementation tasks.
- Use only information from user and existing docs; expose missing details as assumptions or open questions.
- Respect allowed values from `/write-spec` (change.type, version_impact, etc.).
</constraints>

<examples>
Example 1 — New feature (no ref provided):
- User: `/plan-change` + "I want a new Quick Insights dashboard."
- Agent:
  - Queries tracker or proposes creating ticket via `@pm`.
  - Confirms change.type as `feat`, owners, service, labels.
  - Asks about current observability, goals, KPIs.
  - Identifies interfaces (UI, API, aggregations).
  - Gathers NFRs and dependencies.
  - Produces `<change_planning_summary>` and suggests `/write-spec <workItemRef>`.

Example 2 — Bug fix (ref provided):

- User: `/plan-change GH-456` + "Fix 500 errors on invoice download."
- Agent:
  - Validates GH-456 format and confirms.
  - Classifies as `fix`; clarifies if any behavior changes allowed.
  - Asks for error characteristics, affected customers, constraints.
  - Clarifies acceptance criteria.
  - Produces `<change_planning_summary>` for GH-456 and suggests `/write-spec GH-456`.
    </examples>
