# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-302
Date: 2026-11-14
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: FAIL

## Findings

1. [critical] dod_defined — chg-GH-302-spec.md#sections-1-25 (no Definition of Done section)
   Gap: The spec defines 11 testable ACs, success metrics, and NFR-6, but contains no Definition of Done section or statement anywhere (zero occurrences of "Definition of Done"). All ten prior November specs (GH-228, GH-233, GH-240, GH-242, GH-266, GH-239, GH-277, GH-284, GH-303, GH-292) carry one; the facet is a hard gate ("delivery cannot start without a DoD") and lifecycle phase 10 (dod_check) reads a spec-defined completion boundary.
   Suggested remediation target phase: specification
   Suggested fix: Add a Definition of Done section consolidating the scattered contract: all 11 ACs verified — including the manual evidence items (TC-MEMRESUME-002 live dry-run, TC-MEMKERN-003 fidelity verdict, TC-MEMSCAF-004/TC-MEMWIRE-004 review-time changed-file checks) — all five plan phases complete with per-phase pm-notes `notes:` evidence, the full gate battery green (`TMPDIR=$PWD/tmp/tmpdir pnpm check` + doc-distribution + inception-consistency + plugin guards), PDR-0004 landed beside its index row, and the M2-S9 backlog marker recorded.

2. [major] spec_completeness — chg-GH-302-spec.md#5.1-F-2 / #8.3-DM-2 / #17-AC-F2-1 (mirrored with chg-GH-302-test-plan.md#TC-MEMKERN-001)
   Gap: The enumerated "ten content classes" do not cover the current-truth "Agent memory" section of AGENTS.md. Verified against the source section, the enumeration omits: **Unique ids** (monotonic id allocation/validation across `lessons/` and `tacit/`), **Conflict reality**, the **advisory/untrusted preamble** rule (only implicit via spec §21), and the growth/split half of **Caps and growth**. Under the binding mirror constraint (C-1, DEC-1, NFR-1 "mirror exactly, zero drift") and the manual side-by-side fidelity review (TC-MEMKERN-003 compares against the *full* source section), a coder implementing exactly the enumerated ten classes produces drift findings at review — or the review standard gets silently loosened. The enumerated set, not the source section, is what DM-2 calls "the content-class contract".
   Suggested remediation target phase: specification
   Suggested fix: Either extend F-2/DM-2/AC-F2-1's enumerated set to the full source content-class list (adding unique-id rules, conflict reality, advisory/untrusted status, caps-and-growth split behavior), or explicitly bound the mirror set by naming each omission and its rationale (e.g., curator mechanics deferred to GH-301). Mirror the final set into TC-MEMKERN-001's anchor list and TC-MEMKERN-003's comparison standard so the automated pin and the fidelity review agree.

3. [major] cross_artifact_consistency — chg-GH-302-test-plan.md#1.1-bullet-4 + #4-bash-guard-bullet vs #5.1-scenario-index + #7-mapping; chg-GH-302-plan.yaml#phase-4.2
   Gap: The DEC-6/PDR-0004 self-containment negative invariant ("no `doc/planning/concepts` references inside installed carriers") is declared in test-plan scope (§1.1) and §4 states the inception guard's "existing self-containment pattern is reused for the PDR-0004 self-containment rule" — but no TC in the §5.1 scenario index owns it, no §7 mapping row carries it, and plan phase 4.2's Check 7 specification (allowlist identity, golden set, confirmation sentence, Phase 6 enumeration, Check 4 list extension) omits the self-containment extension entirely. A decision-of-record constraint with authoring obligation (plan phase-1 comment) but no verification anchor on any surface.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a TC (bun suite: assert zero `doc/planning/concepts` references across the nine memory templates and the rendered instruction carriers, citing public-repo-URL-only as the permitted further-reading form; or extend guard Check 7 with a concepts-ref scan), map it in §7, and add the assertion to plan phase 4's obligations so all three surfaces agree.

4. [major] system_spec_consistency — chg-GH-302-plan.yaml#pinned-contract-C-3 + #phase-1-done-when vs AGENTS.md#License-headers + scripts/add-header-location.sh:53 (DEFAULT_PATHS) + C-2
   Gap: C-3 and phase 1's done-when require every new template to carry "the license header … matching sibling templates" (siblings in `doc/templates/` do carry headers). But `doc/templates/` is NOT in `add-header-location.sh`'s DEFAULT_PATHS (verified: `.opencode/agent`, `.opencode/command`, `doc/guides`, `doc/documentation-handbook.md`, `doc/planning/concepts`, `tools` only), AGENTS.md forbids AI agents from adding license headers ("managed exclusively by" the script "for specific paths"), and C-2 forbids any `scripts/` change beyond the phase-4 test file. Every execution path (hand-add, skip, extend script scope) violates a stated constraint — phase 1 cannot be executed compliantly as written.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Per current repo truth (the script's scope list is the authority on where headers belong; template headers are pre-rule legacy), correct C-3 and phase 1's done-when to require the `ados_distribution: redistributable` marker only, noting the header inconsistency with legacy siblings as accepted; or explicitly declare and scope an approved alternative mechanism. Do not leave "license header … matching sibling templates" standing as an unsatisfiable instruction.

5. [minor] cross_artifact_consistency — chg-GH-302-spec.md#AC-F7-1 + chg-GH-302-test-plan.md#TC-MEMCONT-001/002 + chg-GH-302-plan.yaml#phase-2.4-and-pinned-golden-set vs doc/spec/features/feature-bootstrapper.md#Write-allowlist
   Gap: AC-F7-1 requires "the allowlist text is identical across the feature spec, the inception guide, and the bootstrapper prompt", and the golden set is a flat 22-entry enumeration "slotted after the four instruction files". But the feature spec's current allowlist uses compact brace entries (`.ai/agent/{pm,pr,decision,code-review}-instructions.md`, `doc/decisions/README.md`+`00-index.md`, `doc/planning/{backlog.md, epics/**, archive/**}` — 17 literal entries expanding to the prompt's 21). No phase states that the feature spec's allowlist is restated in the identical flat enumeration; TC-MEMCONT-001's normalization covers "bullet-list and table formats" but not brace expansion. If the compact form survives, AC-F7-1's identical-text contract fails literally while the TC passes, and the guard's extraction needs un-planned expansion logic.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Pin in phase 2.4 that `feature-bootstrapper.md` §Write allowlist is restated as the identical flat 22-entry list (replacing the compact brace entries), making the identical-text contract mechanically checkable by backticked-token extraction alone.

6. [nit] test_traceability — chg-GH-302-test-plan.md#TC-MEMBUDGET-001 vs chg-GH-302-spec.md#NFR-2
   Gap: NFR-2's threshold names three budgets (entry point ~150, index ≤200, kernel section ~200-line guidance), but only the first two have executable assertions; the delivered kernel-section template's line count is asserted nowhere (TC-MEMALIGN-002 checks only the concept doc's *guidance text*).
   Suggested remediation target phase: test_planning
   Suggested fix: Add a line-count assertion for `memory-kernel-section-template.md` with an explicit ceiling, following the "~150 → ≤150" precedent stated in TC-MEMBUDGET-001's notes.

7. [nit] test_traceability — chg-GH-302-test-plan.md#TC-MEMRESUME-002 vs chg-GH-302-spec.md#4.1-Success-Metrics-row-1
   Gap: The success metric demands the capability set present "in both `new` and `legacy` flows", but the single live dry-run does not state which flow it exercises or why the untested flow is covered.
   Suggested remediation target phase: test_planning
   Suggested fix: State in TC-MEMRESUME-002 which flow the dry-run exercises and that the memory wiring rides the flow-agnostic Phase 5 path (or run both flows).

## Notes

- Decisions of record verified, not gapped: DEC-1 (open-dependency delivery authorization) is mirrored in pm-notes, spec DEC-1/§13, and the plan's pinned contracts; PDR-0004 exists untracked with its committed `00-index.md` row (per the DEFER contract), its content states the repo-internal disposition, spec OQ-2/DEC-6 reference it, plan phase 3's `doc/decisions` folder scope satisfies the landing contract, and owner ratification is scheduled at the open-PR human gate — decision_capture PASS, no pause required.
- TC-MEMALIGN-003 intentionally red until phase 3 is a pinned contract in the plan ("never fix it prematurely") — consistent across artifacts; not a gap.
- Spec v1.1 reopen correction (`.ai/memory` exists, populated by GH-204) verified against repo truth (tree tracked at branch base); NG-4 now guards a populated tree; test-plan OQ-TP-1 resolution consistent.
- Ticket→artifact traceability verified: every ticket task and AC phrase is covered or explicitly bounded with rationale (retro "ceremony" bounded by DEC-4/NG-5 with the seed reconciliation documented in TC-MEMWIRE-003; meta-learning file install bounded by PDR-0004; doctor-manual-until-tooling is F-5/DEC-3). Plan covers all F-1…F-7 and all 11 ACs with exactly one owning phase each; 27/27 TCs accounted; repo-truth anchors (21-entry allowlist in the bootstrapper prompt, no guide enumeration today, zero memory mentions in all three carriers, zero memory templates, guard Check 4/5/6 shapes, `.ados-claude` regen targets, testing-strategy branch-diff rule) all confirmed.
