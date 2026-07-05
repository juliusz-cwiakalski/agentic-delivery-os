# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-133
Date: 2026-07-05
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS (with nit — see finding 3)

## Summary

The artifact set is strong overall. The spec (23 ACs, all Given/When/Then, traceable to F-/DM-/NFR- IDs), the test plan (24 scenarios covering all 23 ACs), and the plan (8 phases + cross-artifact AC traceability matrix) are mutually consistent on substance: every ticket AC → spec AC → test scenario → plan task is mapped, and the 3-of-23 AC-ID schemes are reconciled by the plan's traceability matrix. Verified against the live ticket (GH-133 body), the 6 grandfathered records (confirmed to still carry legacy `decision_area`/`reversibility`), the template (confirmed pre-change state), and `feature-document-templates.md` (confirmed "14 sections" claim that Phase 5 will reconcile).

Two blocking defects were found, both structural/stale-reference issues rather than coverage gaps. Neither requires re-deriving requirements; both are small, surgical fixes.

## Findings

### 1. [critical] cross_artifact_consistency — `chg-GH-133-pm-notes.yaml` (whole file)

**Gap:** The PM-notes YAML is syntactically invalid and fails `yaml.safe_load()` with a `ParserError` at line 33. The cause: `open_questions: []` and `blockers: []` are declared as inline empty flow sequences, then immediately followed by indented `- text:` block-sequence items. YAML cannot attach a block sequence to a flow-style empty list, so the parser aborts. Concretely:

```yaml
open_questions: []
blockers: []
  - text: "Red-team R2 (artifacts review) completed. Verdict: PASS_WITH_RISKS. ..."
```

Impact: (a) `chg-GH-133-pm-notes.yaml` is a required DoR input and a tracked change artifact; any consumer (PM tracker sync, automation, downstream agents) that parses it will fail. (b) The R2 artifacts-review verdict (`PASS_WITH_RISKS`, commit `0671d2a`) — which the user cites as already-complete context for this gate — is recorded in a structurally-invalid location and is effectively invisible to any YAML reader. (c) The retro entry beneath it is likewise lost.

**Suggested remediation target phase:** specification (PM-notes are PM-authored during clarify_scope/specification)
**Suggested fix:** Remove the `[]` inline empty markers on `open_questions` and `blockers` (or place the list items directly under the keys with proper `- text:` indentation). Re-validate with `python3 -c "import yaml; yaml.safe_load(open('...'))"`. Preserve the R2 verdict + retro entries verbatim.

### 2. [major] cross_artifact_consistency / test_traceability — `chg-GH-133-test-plan.md` §2 References, §8.2 A-1, §8.3 OQ-1, §9 Revision Log

**Gap:** The test plan still asserts the change spec does not exist, even though `chg-GH-133-spec.md` was authored and committed (`04b2a46`) and the plan's own revision log records OQ-1 as resolved. Stale claims:
- Line 54: "the change spec is not yet authored — see Open Question OQ-1"
- Line 55: "Change spec — `./chg-GH-133-spec.md` (pending; …)"
- Line 815: "if the spec is not yet authored, the statement must appear there (see OQ-1)"
- Line 963, A-1: "(pending) change spec will mirror them"
- Line 970, OQ-1: "**OQ-1 (Blocking for DoR) — Change spec not yet authored.** … `chg-GH-133-spec.md` does not yet exist"
- Line 978, revision log: "spec not yet authored — see OQ-1"

The R2 remediation pass (commit `0671d2a`) updated the *plan* but did not propagate the resolution to the *test plan*. The test plan thus self-declares a "Blocking for DoR" condition that is factually resolved. This is the highest-weight DoR facet (cross-artifact consistency) and creates a live contradiction inside the artifact set.

**Suggested remediation target phase:** test_planning
**Suggested fix:** Update test-plan §2 (point to committed spec), A-1 (drop "pending"), OQ-1 (mark resolved with spec commit `04b2a46`, or remove), revision log (add v1.1 entry mirroring the plan's R2 remediation note). Optionally reconcile test-plan's `AC-01..AC-23` IDs against the spec's stable `AC-F#-#` IDs in §3.1 (see finding 4).

### 3. [nit] dod_defined — `chg-GH-133-spec.md` §17

**Gap:** The spec defines 23 testable acceptance criteria but has no explicit "Definition of Done" section stating that all ACs + plan tasks + quality gates must pass. ACs effectively serve as DoD, which is acceptable, but making it explicit removes ambiguity for `@pm` at the `dod_check` phase.
**Suggested remediation target phase:** specification
**Suggested fix:** Add a one-paragraph DoD block (e.g., in §17 or a new §17.1): "Done = all ACs above pass, all plan tasks complete, quality gates green (`test-doc-distribution.sh`, `test-build-claude-plugin.sh`), 6 grandfathered records untouched, `.ados-claude/` regenerated and idempotent."

### 4. [nit] cross_artifact_consistency — three AC-ID schemes (spec `AC-F#-#`, test-plan `AC-01..AC-23`, plan `AC-1..AC-11`)

**Gap:** Parallel artifact authoring produced three incompatible AC-ID schemes (already captured as a retro in pm-notes). The plan's Cross-Artifact AC Traceability Matrix reconciles them, so this is non-blocking, but a reviewer/developer must cross-walk IDs across artifacts. Adopting the spec's stable `AC-F#-#` IDs as the canonical set in the test plan would remove the cross-walk tax.
**Suggested remediation target phase:** test_planning (optional)
**Suggested fix:** Optional — rename test-plan `AC-01..AC-23` to the matching spec `AC-F#-#` IDs in §3.1 and scenario metadata.

## Non-blocking positive verification

- Ticket ACs (23) == spec ACs (23) == test-plan covered ACs (23) == plan traceability rows (23). ✓
- Grandfathering claim verified: `ADR-0001`, `TDR-0001` (sampled) still carry top-level `decision_area` + `reversibility`; no migration expected. ✓
- Template pre-change state verified: top-level `decision_area` (line 16) and `reversibility` (line 18) present, plus `classification.reversibility` (line 28) — matches the dedup target. ✓
- `feature-document-templates.md` "14 sections" claim verified (line 150); plan task 5.4 explicitly reconciles it. ✓
- Plugin-regen constraint (C-1) correctly applied to both Phase 3 and Phase 4 (`.opencode/agent/*.md` edits). ✓
- R1 red-team ship-with findings all folded into scope/plan tasks. ✓
- No `decision_routing` escalation needed; no `needs_human_input` pause. GH-63 "disregard" decision is recorded in pm-notes and spec DEC-4 (change-scoped, not precedent-setting). ✓

## Gate result

NOT_READY. Two blocking findings (1 critical, 1 major) require surgical fixes before delivery:

1. Fix `chg-GH-133-pm-notes.yaml` YAML syntax (critical) — reopen **specification**.
2. Reconcile stale "spec pending" claims in `chg-GH-133-test-plan.md` (major) — reopen **test_planning**.

After both fixes, re-run this gate (expected: iteration 2 → READY). Findings 3 and 4 are nits and do not block.
