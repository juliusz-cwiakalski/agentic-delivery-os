---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/command/review-decision.md
description: Review a decision record via @decision-critic for an independent challenge (read-only; returns PASS / PASS_WITH_RISKS / REWORK).
agent: decision-critic
claude:
  model: sonnet
---

<purpose>
Run an **independent challenge** (decision kernel stage D10) against a drafted decision record and produce a review verdict — without modifying the record. Delegates the analysis to `@decision-critic`, which checks for framing errors, missing options, violated constraints, fragile assumptions, automation bias, and runs a premortem.

User invocation:

/review-decision <ID>

where `<ID>` is the decision record identifier (e.g., `ADR-0001`) or the record's number for the relevant type.

This command is **read-only by default**: it produces a review artifact/verdict in its response and does NOT write, edit, stage, or commit any file. The caller decides whether and how to act on the findings (e.g., feed them back to `@decision-advisor` via `/write-decision` update, or escalate to a human reviewer for R3).
</purpose>

<inputs>
- id='$1' or allArguments='$ARGUMENTS': the decision record ID or number (e.g., `ADR-0001`, `PDR-0003`, or `0001` which defaults to ADR when the type is genuinely unspecified).
<rawArguments>
$ARGUMENTS
</rawArguments>
</inputs>

<record_resolution>
1. Parse the ID into TYPE + zeroPad4 (e.g., `ADR-0001` → type `ADR`, number `0001`). If only digits are given, default the type to ADR only when the type is genuinely unspecified.
2. Locate the record file by scanning `doc/decisions/<TYPE>-<number>-*.md`.
3. If not found, return `NOT_FOUND` with guidance to run `/plan-decision` + `/write-decision` first, and stop.
</record_resolution>

<process>
1. Resolve and read the target decision record read-only (`read`/`grep`/`glob` only).
2. Hand the record's **problem, evidence, constraints, and options** to `@decision-critic`. Where practical, withhold the record's recommendation/decision initially so the critic forms its own view, then compare against the record's stated conclusion.
3. `@decision-critic` performs the independent challenge (see its prompt): framing, option space, constraint compliance, assumption/sensitivity check, premortem, stakeholder harm, confidence assessment, automation-bias check.
4. Capture the critic's verdict — exactly one of **PASS** / **PASS_WITH_RISKS** / **REWORK** — and its structured findings.
5. **Modify nothing.** Do not write/edit/stage/commit. Output the review verdict and findings only.
</process>

<independence_note>
State at the top of the review which independence level applies (per `@decision-critic`'s honesty framing):
- **Single-model configuration:** the critic is a first-pass check, NOT independent assurance (same-model/same-prompt lineage is not independent evidence).
- **Multi-model configuration:** the critic runs on a different model family, providing genuine independence (recommended for R3, not mandated).

Regardless of the verdict, **R3 decisions ALWAYS require a human reviewer.** A PASS from the critic does not authorize an R3 decision.
</independence_note>

<output_contract>
Return a structured review artifact (in the response only — no file writes):

- **Status**: `REVIEWED` | `NOT_FOUND` | `NEEDS_INPUT`
- **Record**: `<TYPE>-<number>` and path reviewed
- **Verdict**: PASS | PASS_WITH_RISKS | REWORK
- **Independence note**: single-model (first-pass check) | multi-model (independent) — plus the R3-requires-human-review reminder
- **Findings**: framing / option-space / constraint-compliance / assumption-sensitivity / premortem / stakeholder-harm / confidence / automation-bias
- **Accepted risks** (for PASS_WITH_RISKS): explicit list the human decider must accept
- **Required changes** (for REWORK): explicit, actionable list
- **Next step**: e.g., "Return findings to @decision-advisor to address" / "Escalate to human reviewer (R3)" / "Decision is sound; proceed to human authorization"
</output_contract>

<constraints>
- Read-only: do NOT use `write`/`edit`; do NOT stage/commit; do NOT modify the decision record or any file.
- Do NOT transition the record's status (no auto-Accept, no status change).
- Do NOT use the network.
- The verdict is advisory; it never authorizes a decision on its own. R3 always needs a human.
</constraints>
