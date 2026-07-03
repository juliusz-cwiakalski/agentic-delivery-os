# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-112
Date: 2026-07-03
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Technical-Assumption Verification (confirmed before critique)

All five load-bearing assumptions the artifacts depend on were verified against source:

1. `scripts/add-header-location.sh` accepts a single `.md` file path. CONFIRMED — `process_path` (lines 504-555) has an explicit `[[ -f "${path}" && "${path}" == *.md ]]` single-file branch that calls `process_file`. The plan's invocation `scripts/add-header-location.sh .ai/rules/bulk-edit-verify.md` is valid.
2. `ensure_basic_header` PRESERVES non-header frontmatter lines (so `ados_distribution` survives). CONFIRMED — the awk (lines 314-352) classifies frontmatter lines into `header_copyright`/`header_mit`/`header_source` or an `other[]` array; `ados_distribution: redistributable` matches none of the header patterns and is re-emitted verbatim from `other[]` (lines 350-352). The header lines are emitted first, then `other[]`, then the closing `---` — so the marker survives (reordered after the header, which the guard's `get_marker` scans correctly). RSK-1 mitigation is sound.
3. Adding `.ai/rules/bulk-edit-verify.md` to BOTH `ADOS_UPDATABLE_FILES` and `STANDALONE_DOCS` keeps the guard green. CONFIRMED by reasoning through all 5 modes: Mode 1/2 (marker present + valid `redistributable`); Mode 3 (redistributable IS installed because it is in `ADOS_UPDATABLE_FILES` → sandbox copies it); Mode 4 (not internal); Mode 5 (expected marker-derived set includes it; actual sandbox set includes it → match).
4. `.ados-claude/agents/` (plural) exists. CONFIRMED — contains `coder.md`, `pm.md` (+ 21 others). (Note: the spec spells it `.ados-claude/agent/` singular — see Finding 2.)
5. `scripts/.tests/test-build-claude-plugin.sh` exists. CONFIRMED.
6. Reviewer auto-load claim. CONFIRMED — `.opencode/agent/reviewer.md` lines 118 & 144 reference `.ai/rules/`. No dedicated reviewer change needed (DEC-3 sound).
7. Baseline counts. CONFIRMED — `ADOS_UPDATABLE_FILES` = 4; `STANDALONE_DOCS` = 5; README index = 3 rule rows; coder/pm `bulk-edit-verify` refs = 0; `naming-and-types.md` does not exist (DEC-2 sound).

## Findings

### 1. [major] plan_coverage / cross_artifact_consistency / system_spec_consistency — spec §5.1 F-6, §8.3 DM-2/DM-3, §17 AC-F6-3/AC-F6-4; plan Phase 2; test-plan TC-DIST-003/004

**Gap:** The artifacts enumerate only TWO hand-synced distribution lists (`scripts/install.sh` `ADOS_UPDATABLE_FILES` and `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS`) and completely miss a THIRD hand-synced list: `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` (lines 103-109). This third list is used (uninstall.sh lines 414-422) to remove redistributable standalone docs during `uninstall.sh --local`, and is explicitly documented at uninstall.sh lines 100-102 as needing to "stay in sync with install.sh's standalone manifest (independent copies, like the guard's STANDALONE set, so a drift is observable)."

The mirror model for this change — `.ai/rules/README.md` (per DEC-1) — is present in ALL THREE lists (install.sh line 106, guard line 76, uninstall.sh line 108). DEC-1's stated rationale is "mirror README end-to-end," yet the F-6 enumeration (spec §5.1), the data-model table (§8.3 DM-2/DM-3), the ACs (AC-F6-3 install / AC-F6-4 guard), the plan (Phase 2 tasks 2.3/2.4), and the test-plan (TC-DIST-003/004) all cover only 2 of README's 3 mirror locations.

**Concrete impact if delivered as planned:** `install.sh --local` copies `.ai/rules/bulk-edit-verify.md` to adopting projects (it is in `ADOS_UPDATABLE_FILES`), but `uninstall.sh --local` does NOT remove it (absent from `ADOS_LOCAL_STANDALONE_DOCS`) → the file is orphaned as a stale leftover in every adopting project that later uninstalls/upgrades. This directly contradicts spec goal G-5 ("distributed truthfully") and DEC-1's "mirror README end-to-end" rationale. A one-directional distribution (install-only) is not truthful.

**No automated backstop:** the drift guard (mode 5) compares the marker-derived set vs the sandbox install set — it does NOT observe the uninstall list, so this drift is undetectable by CI. `test-uninstall.sh` does not check install/uninstall list parity either.

**Suggested remediation target phase:** specification (then cascade to test_planning + delivery_planning)
**Suggested fix:**
- Spec: add uninstall.sh to the F-6 wiring enumeration (§5.1) and the data-model table (new DM-4: `ADOS_LOCAL_STANDALONE_DOCS` +1 entry); add AC-F6-6 ("Given `scripts/uninstall.sh`, when `ADOS_LOCAL_STANDALONE_DOCS` is read, then it contains one entry for the new rule path, mirroring DM-2"). Update DEC-1 / Appendix A to acknowledge the third list. Note: this list mirrors the GUARD's STANDALONE_DOCS shape (5 entries incl. `doc/decisions/00-index.md`), not the install list's shape (4 entries) — clarify which shape the new entry follows (it should match README's presence: present in all three).
- Test-plan: add a TC asserting exactly one `ADOS_LOCAL_STANDALONE_DOCS` entry + byte-identical to the other two lists; extend TC-GATE-002 (additive-only) to cover the uninstall list.
- Plan: add a Phase 2 task to append `.ai/rules/bulk-edit-verify.md` to `ADOS_LOCAL_STANDALONE_DOCS` in `scripts/uninstall.sh` (adjacent to the existing `.ai/rules/README.md` entry); update Phase 4 task 4.3's touched-files list.

### 2. [minor] cross_artifact_consistency — spec §9 NFR-5, §16, §17 AC-F5-4

**Gap:** The spec spells the generated-mirror directory as `.ados-claude/agent/` (singular) in three places (NFR-5 line 193, Affected Components line 249, AC-F5-4 line 270). The actual directory is `.ados-claude/agents/` (plural), which the plan and test-plan use correctly throughout. The `.opencode/agent/` source path IS singular (correct), so the singular form in the spec reads as a plausible-but-wrong copy of the source path.

**Suggested remediation target phase:** specification
**Suggested fix:** Change the three spec occurrences of `.ados-claude/agent/` to `.ados-claude/agents/` to match the real generated-output directory and the plan/test-plan. (Non-blocking; the plan already uses the correct path so delivery would not stray, but the spec/plan/test-plan should agree.)

### 3. [nit] cross_artifact_consistency — test-plan frontmatter `links.implementation_plan` + §1.2

**Gap:** The test-plan frontmatter comment says "not yet authored at test-plan creation" and §1.2 lists the implementation plan as "not yet authored." The plan now exists (`chg-GH-112-plan.md`). Stale note only.

**Suggested remediation target phase:** test_planning
**Suggested fix:** Drop the "not yet authored" caveats now that the plan is present.

## What Passed (notable)

- Spec↔ticket alignment is otherwise tight: all 4 ticket ACs map to spec ACs (AC1→F1-1/F2-1/F3-1/F4-1; AC2→F5-1/2/3; AC3→F1-2; AC4→F6-1..5). The AC4→AC-F6-1..5 expansion is justified by DEC-1 and verified technically (a bare `redistributable` marker on an uninstalled file WOULD fail guard mode 3). AC-F5-4 (generated-plugin freshness) is a valid derived AC, not invented scope (editing `.opencode/agent/` necessarily obligates regeneration).
- No scope invented beyond ticket + justified PM decisions (NG-1..NG-4 faithfully exclude sed-banning, AST tools, existing-rule cleanup, hard gates; `@fixer` and `feature-ai-rules.md` correctly deferred to OQ-1/OQ-2).
- Test-plan traceability is complete for the 14 existing ACs (14/14, no blank cells); DM-1..3 and NFR-1..5 covered; layering per `testing-strategy.md` is correct (no app-logic tests; drift guard + plugin-build correctly identified as the automated gates).
- Plan phasing is sound; load-bearing ordering is correct: header-before-scan-list (Phase 2 task 2.1→2.2→2.3/2.4→2.5) and source+generated-in-one-commit (Phase 3 single-phase → single-commit execution model). No phantom steps.
- Decision capture is correct: DEC-1/2/3 recorded in both `pm-notes.yaml` and spec §15; classified as `change`-scope (no precedent-setting system decision warranting an ADR/PDR).
- DoD is defined: 14 testable Given/When/Then ACs + test-plan PASS criterion (6 conjuncts) + spec validation checklist.
- RSK-1 mitigation (header preserves marker) is technically verified, not assumed.

## Next Steps

Reopen **specification** to address Finding 1 (add uninstall.sh to F-6/DM/AC set) and Finding 2 (singular→plural path). Then cascade to **test_planning** (new TC + stale-note cleanup, Finding 3) and **delivery_planning** (new Phase 2 task for uninstall.sh). Re-run this gate (iteration 2). No human escalation needed (no `needs_human_input` decision; Pause Required: no).
