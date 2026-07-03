# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-112
Date: 2026-07-03
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS  (15/15 ACs traced; TC-DIST-007 owns AC-F6-6)
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iter-1 Follow-up Status

- **Iter-1 Finding 1 (MAJOR — uninstall.sh missed): RESOLVED.** uninstall.sh is now covered end-to-end and consistently across all three artifacts. Verified: spec §5.1 F-6 names all three lists; §8.3 DM-4 (array L103-109, used at L414-422); §16 affected-components row; §9 NFR-4 (triple); §17 AC-F6-6; §11 RSK-6 (residual M). Plan Phase 2 tasks 2.3/2.4/2.5 form an atomic block with the byte-identical string; AC-F6-6 + NFR-4 triple in Phase-2 AC; RSK-2 carries dual residual L (install↔guard, CI-backed) / M (uninstall, manual). Test-plan TC-DIST-007 (AC-F6-6/DM-4) + 3-way byte-identity diff in TC-DIST-004; TC-GATE-002 step 3 covers uninstall additive-only; PASS criterion #6. All three artifacts AGREE on the canonical naming (`ADOS_LOCAL_STANDALONE_DOCS`, uninstall.sh, byte-identical quoted string `.ai/rules/bulk-edit-verify.md`) and the three-list scope.
- **Iter-1 Finding 2 (MINOR — singular `.ados-claude/agent/` typo): PARTIALLY RESOLVED — DEFECT PERSISTS (see Finding 1).** The spec was fixed to plural `.ados-claude/agents/` (lines 194/251/274). However, the iter-1 record incorrectly asserted "the plan and test-plan use the correct `.ados-claude/agents/` throughout" — that assertion was wrong for the test-plan. The remediation note's claim "fixed singular→plural everywhere" was applied only to the spec; the test-plan was never touched for this typo. 6 stale singular occurrences remain in the test-plan.
- **Iter-1 Finding 3 (NIT — stale "plan not yet authored" note): RESOLVED.** Frontmatter `links.implementation_plan` now points to `./chg-GH-112-plan.md`; §1.2 caveats removed.

## Technical-Assumption Re-Verification (all confirmed against source)

1. `uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` array at L103-109 (5 entries, mirrors the guard's 5-entry shape, incl. `doc/decisions/00-index.md` — NOT the install list's 4-entry shape). CONFIRMED.
2. `uninstall.sh` comment L100-102: "This list MUST stay in sync with install.sh's standalone manifest (independent copies, like the guard's STANDALONE set, so a drift is observable)." CONFIRMED — the documented invariant exists.
3. `uninstall.sh` usage L414-422: iterates `ADOS_LOCAL_STANDALONE_DOCS`, removes `redistributable`-marked files on `uninstall.sh --local`. CONFIRMED — install-without-uninstall would orphan the rule.
4. README.md present in all three lists (install L106, guard L76, uninstall L108). CONFIRMED — mirror model holds for the new rule.
5. Baseline counts pre-change: install=4, guard=5, uninstall=5, README index data rows=3. CONFIRMED.
6. `.ados-claude/agents/` (plural) exists; `.ados-claude/agent/` (singular) does NOT exist. CONFIRMED (ls -d) — this is what makes Finding 1 an executable defect, not cosmetic.
7. Guard mode 5 observes marker-derived set vs sandbox install set ONLY — does not read uninstall.sh. CONFIRMED (no `uninstall` reference in `test-doc-distribution.sh`). RSK-6 residual risk disclosure is accurate.

## Findings

### 1. [major] cross_artifact_consistency — test-plan §1.1 (L32), §3.1 AC-F5-4 row (L80), §3.3 NFR-5 row (L101), TC-DISC-004 Steps (L373-374), §7 automation table (L694)

**Gap:** The test-plan spells the generated-mirror directory as `.ados-claude/agent/` (singular) in 6 places, while the spec (lines 194/251/274, post-iter-1 fix) and the plan (lines 61/182/191/199/204/224/261/275/276 — 9 occurrences) both use `.ados-claude/agents/` (plural). The singular directory does not exist on disk (verified: only `.ados-claude/agents/` exists). This is the same defect class as iter-1 Finding 2, but the iter-1 reviewer wrongly reported the test-plan as already-correct, so the test-plan was never remediated; the remediation note's "fixed singular→plural everywhere" was applied only to the spec.

**Concrete impact:** Two of the six occurrences are EXECUTABLE assertions in TC-DISC-004 (the primary NFR-5/AC-F5-4 gate):
```
grep -Fq 'bulk-edit-verify' .ados-claude/agent/coder.md   → exit 0
grep -Fq 'bulk-edit-verify' .ados-claude/agent/pm.md       → exit 0
```
Both target nonexistent paths, so a `grep` on a missing file returns non-zero (exit 2) — against a correctly-delivered change these assertions FAIL. The test-plan as authored therefore cannot pass cleanly; the AC-F5-4/NFR-5 coverage claim (PASS criterion #5) is undermined by its own verification step. The other four occurrences (L32, L80, L101, L694) are prose path references that disagree with the spec/plan.

**Suggested remediation target phase:** test_planning
**Suggested fix:** Change all 6 occurrences of `.ados-claude/agent/` → `.ados-claude/agents/` in `chg-GH-112-test-plan.md`. (Trivial; ~2-minute edit. Iter-3 expected READY.)

### 2. [nit] cross_artifact_consistency — spec §15 DEC-1 rationale (L239)

**Gap:** DEC-1's parenthetical still reads "(one new file, +1 installer line, +1 drift-test line)" and its header lists only "`ADOS_UPDATABLE_FILES` entry + `STANDALONE_DOCS` entry." This undercounts the now-required three-list reality (install + uninstall + guard). The spec-writer flagged it as intentionally left immutable as a logged decision. Judgment: a Decision-Log entry is a historical record, but the literal "+1 drift-test line" actively contradicts the rest of the SAME spec (§5.1 F-6, §8.3 DM-2/3/4, §7.1, §9 NFR-4, §16 all clearly require three list edits). Defensible only if annotated as superseded; leaving it bare makes the spec self-contradictory in its decision rationale.

**Suggested remediation target phase:** specification
**Suggested fix:** Either (a) append a brief supersede-annotation to the DEC-1 parenthetical (e.g., "(expanded to three lists in v1.1 — see DM-4 / AC-F6-6)"), or (b) update the parenthetical to "+1 installer line, +1 uninstall line, +1 drift-test line." Keep the decision's substance; only reconcile the count.

### 3. [nit] cross_artifact_consistency — spec Appendix A (L316)

**Gap:** Appendix A closes with "expands, in this spec, into AC-F6-1 through AC-F6-5." The spec now defines AC-F6-6 as well, and Appendix A's two-list framing ("installer entry + drift-guard entry") misaligns with §5.1 F-6's three-list framing (install → guard → uninstall). Stale post-remediation.

**Suggested remediation target phase:** specification
**Suggested fix:** Update Appendix A to "AC-F6-1 through AC-F6-6" and add the uninstall list to its symmetry argument (or cross-reference §5.1 F-6 for the third list).

### 4. [nit] cross_artifact_consistency — spec Authoring Guidelines (L335)

**Gap:** Authoring guideline reads "expanded into explicit ACs (AC-F6-1..5)." Should be `..6` to match the current §17 AC set.

**Suggested remediation target phase:** specification
**Suggested fix:** Change `AC-F6-1..5` → `AC-F6-1..6`.

## On the Pre-Flagged Advisory Items

- **DEC-1 immutability (user-flagged):** Acceptable in principle (decisions are historical records), but the bare "+1 drift-test line" undercount makes the spec self-contradictory — Finding 2 (nit, non-blocking). Recommend a supersede-annotation rather than a silent leave-as-is.
- **RSK-6 residual risk (no automated uninstall-list observer):** Acceptable and honestly disclosed. Mitigation stack (AC-F6-6 + reviewer + uninstall's own "MUST stay in sync" comment + TC-DIST-007/TC-DIST-004 3-way byte-identity check as a recurring quality-gate step + OQ-TP-3 follow-up for a symmetry guard mode) is proportionate. Not a blocker.
- **Appendix B / OQ-2 (no `feature-ai-rules.md`):** Advisory, correctly deferred to `@doc-syncer` at system_spec_update. Non-blocking.

## What Passed (notable)

- **Iter-1 MAJOR fully resolved.** The three-list scope is now consistent across spec DM-4/AC-F6-6/NFR-4/§16/RSK-6, plan Phase 2 tasks 2.3-2.5/AC/Files/Tests, and test-plan TC-DIST-007/TC-DIST-004/TC-GATE-002/PASS-#6. All three artifacts agree on canonical naming and byte-identical-string scope.
- **Plan executability + load-bearing ordering intact.** Phase 2 ordering header (2.1) → marker verify (2.2) → append-to-three-lists (2.3/2.4/2.5 atomic) → run-guard (2.6) is correct and explicitly documented. Phase 3 keeps source + generated mirrors in one commit (NFR-5). Plan uses plural `.ados-claude/agents/` correctly throughout.
- **Spec↔ticket alignment tight** (AC1→F1-1/F2-1/F3-1/F4-1; AC2→F5-1/2/3; AC3→F1-2; AC4→F6-1..6). The AC4→AC-F6-1..6 expansion is justified by DEC-1 and the marker-truthfulness argument (a bare `redistributable` marker on an uninstalled file fails guard mode 3 — verified iter-1).
- **Test traceability complete** (15/15 ACs, no blank cells; DM-1..4, NFR-1..5 covered).
- **Technical assumptions re-verified** against source (uninstall list location/usage/comment, baseline counts, plural-agents directory existence, guard's mode-5 scope).

## Next Steps

Reopen **test_planning** to address Finding 1 (singular → plural `.ados-claude/agents/` in 6 test-plan spots, esp. the executable greps at L373-374). Optionally reopen **specification** for Findings 2-4 (DEC-1 supersede-annotation, Appendix A + Authoring-Guidelines stale AC range) — these are nits and can ride along. Re-run this gate (iteration 3) — expected READY; the substantive three-list scope is sound and the only blocking defect is a path-typo in executable test assertions. No human escalation needed (no `needs_human_input` decision; Pause Required: no).
