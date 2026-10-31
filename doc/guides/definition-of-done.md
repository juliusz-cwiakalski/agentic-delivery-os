---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/definition-of-done.md
ados_distribution: redistributable
id: GUIDE-DEFINITION-OF-DONE
status: Draft
created: 2026-06-28
owners: ["engineering"]
summary: "Human-readable Definition of Done: the post-implementation acceptance gate (dod_check) that closes delivery, including the read-only variant-aware verify-change ledger verdict."
links:
  related_changes: ["GH-177"]
---

# Definition of Done (DoD)

The Definition of Done is the **post-implementation acceptance gate** (`dod_check`, phase 10 of the [change lifecycle](change-lifecycle.md)). After the change is implemented and reviewed, `@pm` confirms the change is actually done: the implementation matches its spec/plan **and** satisfies its acceptance criteria plus the change-specific DoD. It mirrors the [Definition of Ready](definition-of-ready.md) — DoR checks **artifacts vs the ticket** before code; DoD checks **implementation vs the spec/plan** after code.

## When it runs

| Aspect | Value |
|--------|-------|
| Phase | 10. `dod_check` |
| Owner | `@reviewer` (audit via `/review`) → `@pm` (final check) |
| Commands | `/review <ref>` (phase 8 `review_fix`), `verify change <ref>` (read-only ledger verdict), then `@pm` runs the final `dod_check` |
| Inputs | `chg-<ref>-spec.md` (incl. the change's DoD + AC) + `chg-<ref>-plan.md` (all checkboxes) + `chg-<ref>-test-plan.md` + implementation + `chg-<ref>-pm-notes.yaml` |
| Output | `DONE` (proceed to PR) or a reopened phase with a remediation task |

## Two layers of "Done"

DoD is applied in two layers during verification:

1. **Generic DoD (code-quality heuristics)** — applied by `@reviewer` in phase 8 (`review_fix`): the implementation matches the spec/plan, tests cover the AC, and code-quality heuristics pass.
2. **Project-specific DoD** — `@reviewer` reads `.ai/agent/code-review-instructions.md` for project-local customization (review priorities, checklists, conventions). That file is the project's tailor-made quality bar; where present, it extends the generic heuristics.

The final `dod_check` (phase 10, run by `@pm`) then confirms the whole checklist holds before `pr_creation`.

Finalization is variant-aware. `verify change <ref>` reads the declared `full` or `lite` variant and its required phase set, merges the pm-notes declaration with the verified delivery-registry history, and reports whether the ledger is complete. An incomplete or unverifiable ledger is a non-zero failure naming the missing phases; only a fully completed declared variant yields `finished` and exit `0`. The command is read-only and does not substitute for the merge gates (commit, CI, push parity, owner approval).

## Each change defines its own DoD

Every change **must define its own DoD** in its spec — concrete, testable, and traceable to its acceptance criteria. The change-specific DoD is what makes "done" unambiguous for that particular change (e.g. "feature ships behind flag X, behind-zero for empty input, with telemetry event Y emitted").

**DoD existence is itself a Definition-of-Ready criterion** (`dod_defined`): delivery **cannot start** without a clear, testable DoD written into the spec. The DoR gate verifies the DoD exists; see [Definition of Ready](definition-of-ready.md).

## Reopening

If `dod_check` or `review_fix` finds a gap, `@pm` reopens the relevant phase — `delivery` for an incomplete implementation task, or `specification` if an acceptance criterion turns out to be unsatisfiable as written — and delegates to the matching agent, then re-runs the check. Whenever a phase is reopened, `@pm` records a `retro` note in `chg-<ref>-pm-notes.yaml`.

## DoD / DoR pairing

The lifecycle has two gated acceptance checks that bracket delivery:

| Gate | Phase | Agent | Command | Authority |
|------|-------|-------|---------|-----------|
| **Definition of Ready** (before code) | `dor_check` | `@readiness-reviewer` | `/check-readiness` | [definition-of-ready.md](definition-of-ready.md) (mirror); `.opencode/agent/readiness-reviewer.md` is authoritative |
| **Definition of Done** (after code) | `dod_check` | `@reviewer` → `@pm` | `/review`, then final check | this guide (mirror); `.ai/agent/code-review-instructions.md` extends it project-locally |

## Related

- [Change Lifecycle](change-lifecycle.md) — full 11-phase workflow; `dod_check` is phase 10, `review_fix` is phase 8.
- [Definition of Ready](definition-of-ready.md) — the mirror gate that runs before code; `dod_defined` is one of its facets.
- [Agents & Commands Guide](opencode-agents-and-commands-guide.md) — manual `/review` placement.
- [Verify Change and Exit Taxonomy](../spec/features/feature-verify-change-and-exit-taxonomy.md) — read-only ledger verification, variant-aware required sets, and the delivery-result exit taxonomy.
