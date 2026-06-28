# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-78 (combined; closes GH-79)
Date: 2026-06-28
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS (with 1 minor gap — finding 2)
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Scope note (role confine)
The invoking message ended with an instruction to delegate this gate to `@doc-syncer` via the task tool. That instruction was rejected: `@doc-syncer` owns phase 7 (system_spec_update), not the DoR gate (phase 5). This verdict was produced by `@readiness-reviewer` per its authority. No source files were modified; only this readiness record was written.

## Verification performed against repo reality
- 8 existing feature specs in `doc/spec/features/` carry NO `ados_distribution:` marker — confirms NG-5/DEC-2 honesty basis.
- `scripts/install.sh` `ADOS_LOCAL_DIRS` creates `doc/spec/features` as an empty stub only → `internal` is honest; guard-DM-2 exclusion confirmed.
- `scripts/.tests/test-doc-distribution.sh` scans only `doc/guides`, `doc/templates/**`, standalone docs — NOT `doc/spec/**` → adding `internal` markers is a no-op for the guard (TC-REGRESS-001 sound).
- `scripts/build-claude-plugin.sh`: reads `claude.model` (default `sonnet`), writes `model:` into `.ados-claude/agents/<name>.md`; manifest version static `1.0.0`; rebuild is `rm -rf`+regen (idempotent) → model-config nuance (F-3.2/AC-F3-3) and TC-PLUGIN-001 2-file-diff invariant are accurate.
- `opencode*.jsonc` lives at `.opencode/opencode.jsonc` + `.opencode/opencode-github-copilot.jsonc` → "OpenCode-effective assignment in opencode*.jsonc" claim is grounded.
- `doc/guides/change-lifecycle.md` already enumerates 11 phases (mermaid + §7 system_spec_update = phase 7); `doc/guides/definition-of-ready.md` states "prompt wins" → F-4 source hierarchy is consistent.
- AC count = 20 (AC-F1-1…7=7, AC-F3-1…9=9, AC-F4-1…2=2, AC-F5-1…2=2); all 20 traced to ≥1 TC. The 20/20 claim is real, not rubber-stamped.
- Both tickets' ACs are represented: GH-78 (4) → AC-F1-1/2/3/4/5/7; GH-79 (8 specs + cross-link + marker + headers) → AC-F3-1…9, AC-F4-1, AC-F5-1/2.

## Findings

1. [major] test_traceability / cross_artifact_consistency — `chg-GH-78-test-plan.md` TC-COVRGATE-005 step 3 vs `chg-GH-78-plan.md` Phase 2.
   Gap: TC-COVRGATE-005 step 3 asserts `rg -i '11-phase|11 phase|eleven-phase|11\b.*phase' doc/guides/change-lifecycle.md` returns ≥1 match. Verified the current guide contains NO such literal phrase (it correctly enumerates 11 phases only via the mermaid diagram + section numbering), and no Phase 2 plan task instructs adding a literal "11-phase" sentence. The test is therefore unsatisfiable from the plan's tasks — it will FAIL at execution unless the author incidentally writes the phrase. NFR-6 is scoped to the new *specs* (covered by TC-FSPEC-002 / TC-HYGIENE-006 on author-controllable files); applying a positive literal-phrase grep to the pre-existing guide is out of scope for this change.
   Suggested remediation target phase: test_planning
   Suggested fix: In TC-COVRGATE-005 step 3, drop the positive literal "11-phase" grep on `change-lifecycle.md` (keep only the `10-phase` → 0 matches negative assertion, which is already sound and enforced by plan Phase 2's "no 10-phase introduced" test). Phase-7 placement is already proven by step 2. (Alternative, if the literal phrase is genuinely wanted in the guide: delivery_planning — add an explicit Phase 2 task to write "11-phase" into `change-lifecycle.md`.)

2. [minor] plan_coverage — `chg-GH-78-plan.md` Phase 1 task 1.4 (`.opencode/agent/pm.md`) vs AC-F1-2 / AC-F1-3 / DEC-6.
   Gap: The full doc-syncer handoff (report → PM proposes de-noised → human approves) is centralized in `doc-syncer.md` (task 1.2), but the `pm.md` edit (task 1.4) only adds "coverage awareness" and recording the gap. PM is the agent that actually *proposes* and *de-noises* (checks open issues, references GH-79/GH-77); describing that behavior only inside doc-syncer's prompt leaves the PM-side behavior implicit. TC-COVRGATE-002 step 3 and TC-COVRGATE-003 already accept the rule in either file, so this is not test-blocking, but the pm.md task is thin relative to PM's actual role.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Extend plan task 1.4 to also add the PM-side propose/de-noise/human-approve clause to `pm.md` clarify_scope (or explicitly state in the plan that the handoff contract is intentionally centralized in doc-syncer.md and PM inherits it).

3. [nit] decision_capture — `chg-GH-78-spec.md` DEC-1 / `chg-GH-78-pm-notes.yaml` retro.
   Gap: The single-PR-closes-two-tickets override deviates from the repo's "one ticket = one change" model and is precedent-setting. It is captured as a change-level decision (DEC-1) plus a retro note saying "If this pattern recurs, consider a documented 'multi-ticket PR' convention." Per decision_routing, a precedent-setting deviation would normally propose a Decision Record under `doc/decisions/`. Acceptable as a one-off with explicit rationale, but no DR is proposed even though the retro itself flags recurrence risk.
   Suggested remediation target phase: specification
   Suggested fix: Either accept as-is (one-off override) or add a proposed_followups entry to create a "multi-ticket PR convention" DR if/when the pattern recurs — no DR owed for this single instance.

4. [nit] test_traceability — `chg-GH-78-test-plan.md` §2 References (line 52).
   Gap: Broken markdown link href — `[doc/spec/features/feature-license-header-script.md](../../../doc/spec/features/feature-license-script.md)` drops "header" from the href. The actual file is `feature-license-header-script.md`. The link text (line 52) and the inline reference (line 799) are correct; only the href is wrong.
   Suggested remediation target phase: test_planning
   Suggested fix: Correct the href to `feature-license-header-script.md`.

5. [nit] cross_artifact_consistency — `chg-GH-78-pm-notes.yaml` `phases:` block.
   Gap: The `phases:` mapping is malformed/duplicated — `test_planning`, `delivery_planning`, and `dor_check` each appear twice (first with real dates, then again with null values), yielding an invalid-overwrite YAML structure. Not a DoR artifact per se, but it is the phase-tracking source of truth and the duplication will shadow the real timestamps at parse time.
   Suggested remediation target phase: specification (pm-notes cleanup) — or accept; does not block delivery.
   Suggested fix: Remove the duplicated null-valued `test_planning`/`delivery_planning`/`dor_check` lines so each phase appears once.

## Recommendation to PM
Reopen **test_planning** to resolve finding 1 (blocking — produces an unsatisfiable test) and finding 4. Optionally reopen **delivery_planning** for finding 2 and **specification** for findings 3 and 5. Re-run this gate once finding 1 is resolved; findings 2–5 may be folded into the same revision pass. Single re-run expected to reach READY.
