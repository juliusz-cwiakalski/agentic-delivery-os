---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/definition-of-ready.md
ados_distribution: redistributable
id: GUIDE-DEFINITION-OF-READY
status: Draft
created: 2026-06-28
owners: ["engineering"]
summary: "Human-readable mirror of the Definition of Ready gate (dor_check) that runs before delivery."
---

# Definition of Ready (DoR)

> **The authoritative Definition of Ready lives in the `@readiness-reviewer` agent prompt (`.opencode/agent/readiness-reviewer.md`). This guide is a human-readable mirror; where they differ, the prompt wins.** Enforcement detail (facet rubrics, verdict record schema, severity taxonomy) is not duplicated here — see the prompt.

The Definition of Ready is a **pre-delivery gate** (`dor_check`, phase 5 of the [change lifecycle](change-lifecycle.md)). Before any code is written, `@pm` delegates to `@readiness-reviewer`, which adversarially critiques the change's **spec + test-plan + plan together against the source ticket** and emits a `READY` or `NOT_READY` verdict. Its goal is to catch gaps, contradictions, and unstated assumptions early — when they are cheap to fix — rather than discovering them during delivery or review.

## When it runs

| Aspect | Value |
|--------|-------|
| Phase | 5. `dor_check` |
| Owner | `@pm` delegates to `@readiness-reviewer` |
| Command | `/check-readiness <ref>` |
| Inputs | source ticket + `chg-<ref>-spec.md` + `chg-<ref>-test-plan.md` + `chg-<ref>-plan.md` + `chg-<ref>-pm-notes.yaml` + **existing system spec (`doc/spec/**`) and system/quality docs** (source code may be read to verify code-area coverage) |
| Output | `READY` or `NOT_READY` + a persisted readiness-review record under `<change_folder>/readiness-review/` |

## DoR facets

`@readiness-reviewer` evaluates all facets together, prioritizing cross-artifact contradictions and missing AC coverage over style nits:

- **spec_completeness** — Spec addresses every ticket requirement; no gaps.
- **ac_quality** — Acceptance criteria are clear, testable, and non-overlapping.
- **plan_coverage** — Plan covers all requirements and all acceptance criteria with check-listable tasks.
- **test_traceability** — Test plan traces to every acceptance criterion via a full traceability matrix.
- **cross_artifact_consistency** — Ticket → spec → test-plan → plan align. This is the highest-value facet.
- **decision_capture** — Decisions are captured in the right place: change-scoped in change docs; system-wide or precedent-setting in `doc/decisions/**`.
- **system_spec_consistency** *(NEW)* — Spec is consistent with the **existing** system spec (`doc/spec/**`) and system/quality docs; no contradictions with current behavior or contracts.
- **plan_doc_update_coverage** *(NEW)* — Plan lists the system docs to update during delivery (e.g. `doc/spec/**`, guides).
- **plan_code_area_coverage** *(NEW)* — Plan lists the affected code areas (files/modules/classes) per phase.
- **dod_defined** *(NEW)* — Spec defines a clear, testable Definition of Done for this change; no delivery without a DoD.

> A change cannot enter delivery without a clear, testable Definition of Done defined in its spec (`dod_defined`). The DoR gate verifies the DoD exists; see [Definition of Done](definition-of-done.md).

## Gate verdict

The verdict is `READY` only when **all facets pass and no pause flag exists**; otherwise `NOT_READY`. Each `NOT_READY` carries a facet summary (PASS/FAIL per facet) plus findings. Each finding records: severity (`critical|major|minor|nit`), the artifact + section/location, the gap, the **suggested remediation target phase** (one of `specification | test_planning | delivery_planning` — never `delivery`), and a concise fix. The full verdict-record schema lives in the `@readiness-reviewer` prompt.

## Override discipline (hard gate)

DoR is a **hard gate by default**: delivery is blocked unless the verdict is `READY`.

- The only bypass is an **explicit, recorded override** for a **genuinely trivial** change.
- Required override record (in `chg-<workItemRef>-pm-notes.yaml`): `workItemRef`, triviality rationale, human approver, date.
- **Genuinely trivial** means no behavioral/spec impact and no cross-artifact consistency risk — e.g. docs typo, comment-only edit, or dependency bump with no contract change.
- Override is **not** available for changes that add or alter behavior, touch contracts, or modify the delivery workflow itself.
- **No silent or unconditional skip path exists.** A missing override means the gate applies in full.

## Decision routing

Decisions surfaced at the gate are classified and routed:

- **change** — recorded in change docs (`pm-notes` and/or spec).
- **system / precedent-setting** — proposed as a decision record under `doc/decisions/**`; `@pm` delegates authoring to `@decision-advisor`.
- **needs_human_input** — `Pause Required: yes`; the workflow STOPs and waits for a human.

## Reopening

On `NOT_READY`, `@pm` reopens the relevant **artifact-creation** phase — `specification`, `test_planning`, or `delivery_planning` — and re-delegates to the matching author agent, then re-runs the gate. DoR findings **never reopen `delivery`**. The loop repeats until `READY` or human escalation on stalemate.

## DoR / DoD pairing

The lifecycle has two gated acceptance checks that mirror each other, bracketing delivery:

| Gate | Phase | Agent | Command | Authority |
|------|-------|-------|---------|-----------|
| **Definition of Ready** (before code) | `dor_check` | `@readiness-reviewer` | `/check-readiness` | this guide (mirror); `.opencode/agent/readiness-reviewer.md` is authoritative |
| **Definition of Done** (after code) | `dod_check` | `@reviewer` (review) → `@pm` (final check) | `/review` | [definition-of-done.md](definition-of-done.md) (mirror); `.ai/agent/code-review-instructions.md` extends it project-locally |

DoR critiques **artifacts vs the ticket** before implementation; DoD verifies **implementation vs the spec/plan** after implementation. Together they make the workflow deterministic: gaps are caught at the cheapest moment.

## Related

- [Change Lifecycle](change-lifecycle.md) — full 11-phase workflow; `dor_check` is phase 5.
- [Definition of Done](definition-of-done.md) — the mirror gate that runs after implementation; `dod_defined` is one of the DoR facets.
- [Agents & Commands Guide](opencode-agents-and-commands-guide.md) — manual `/check-readiness` placement.
- `.opencode/agent/readiness-reviewer.md` — **authoritative** DoR prompt (facet rubrics, verdict schema, override rules, decision routing).
