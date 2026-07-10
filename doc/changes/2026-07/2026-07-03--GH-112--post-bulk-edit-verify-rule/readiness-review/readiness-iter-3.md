# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-112
Date: 2026-07-03
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS  (15/15 ACs traced; TC-DIST-007 owns AC-F6-6)
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iter-2 Follow-up Status

- **Iter-2 Finding 1 (MAJOR — singular `.ados-claude/agent/` in test-plan, incl. 2 executable greps in TC-DISC-004): RESOLVED.** Independent grep confirms the test-plan now contains ZERO live singular references. The only remaining `\.ados-claude/agent/` string in `chg-GH-112-test-plan.md` is the **intentional before-state quote** inside the §9 v1.2 revision-log row (line 730) documenting the fix itself — not a live path reference and not executable. Plural `.ados-claude/agents/` count in the test-plan is now 7 (was 1 pre-remediation).
  - The two TC-DISC-004 step-4 executable greps (lines 373-374) now read `grep -Fq 'bulk-edit-verify' .ados-claude/agents/coder.md` and `…/agents/pm.md`.
  - Both target files exist on disk (verified: `ls .ados-claude/agents/coder.md .ados-claude/agents/pm.md` → both present). A correctly-delivered change will therefore pass these greps (exit 0) rather than false-fail with grep exit 2 against a nonexistent path.
  - The `.opencode/agent/` singular references were correctly left singular — that directory is the OpenCode *source* and exists on disk (singular).
  - Spec singular occurrences: only the v1.1 revision-log quote (line 327) documenting the fix — intentional. Plan: zero singular occurrences.

- **Iter-2 Finding 2 (NIT — DEC-1 rationale undercount): RESOLVED.** Spec §15 DEC-1 rationale (line 239) now carries the supersede annotation: "(Expanded to three lists in v1.1 — uninstall.sh ADOS_LOCAL_STANDALONE_DOCS added per DM-4 / AC-F6-6 / NFR-4.)" The decision's historical substance is preserved; the self-contradiction is removed.

- **Iter-2 Finding 3 (NIT — Appendix A stale AC range): RESOLVED.** Spec Appendix A (line 316) now reads "AC-F6-1 through AC-F6-6" with an added clause that uninstall closes the orphaned-files loop on adopting projects.

- **Iter-2 Finding 4 (NIT — Authoring Guidelines stale AC range): RESOLVED.** Spec Authoring Guidelines (line 336) now reads "(AC-F6-1..6)".

## Technical-Assumption Re-Verification (iter-3, all confirmed against source)

1. `install.sh` `ADOS_UPDATABLE_FILES` (L98-106): 4 entries pre-change (`doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `.ai/rules/README.md`). Confirmed — TC-DIST-003 / TC-GATE-002 expected count was-4→now-5 is correct.
2. `test-doc-distribution.sh` `STANDALONE_DOCS` (L71-77): 5 entries pre-change (the 4 above + `doc/decisions/00-index.md`). Confirmed.
3. `uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` (L103-109): 5 entries, mirrors the guard's 5-entry shape (NOT the install list's 4-entry shape). Confirmed. Its "MUST stay in sync with install.sh's standalone manifest" comment (L100-102) is the documented invariant.
4. **Guard mode-5 scope does NOT read uninstall.sh.** `grep uninstall scripts/.tests/test-doc-distribution.sh` → no matches. Install↔uninstall pair remains unobserved by CI; RSK-6 + TR-6 + OQ-TP-3 disclosures are accurate, and AC-F6-6 is correctly verified by grep+diff inspection (TC-DIST-007), not the guard.
5. **Header script preserves the `ados_distribution` marker.** `scripts/add-header-location.sh` operates only on the `source:` line inside frontmatter (L182-212 awk block keyed on `url_pattern`); it does NOT read, modify, or strip `ados_distribution`. The TC-DIST-001 + TC-DIST-002 sequence (apply header, then assert marker present) is consistent with the script's actual behavior.
6. `.ados-claude/agents/` (plural) is the real generated-mirror directory; `.ados-claude/agent/` (singular) does not exist. `.opencode/agent/` (singular) is the real source dir. TC-DISC-004 now targets real paths on both axes (source `.opencode/agent/`, mirror `.ados-claude/agents/`).
7. **Load-bearing Phase-2 ordering intact in the plan** (header/marker 2.1→2.2 → install 2.3 / uninstall 2.4 / guard 2.5 atomic → run-guard 2.6). Marker-before-guard-entry ordering prevents RSK-1 false-fail; the three list appends are atomic and use a byte-identical quoted string, satisfying NFR-4 triple.

## Previously-Passed Facets (re-confirmed, no regression from remediation)

- **spec_completeness:** Every ticket AC (1-4) maps to spec capabilities/ACs (AC1→F1-1/F2-1/F3-1/F4-1; AC2→F5-1/2/3; AC3→F1-2; AC4→F6-1..6). The AC4→AC-F6-1..6 expansion is justified by DEC-1 + Appendix A marker-truthfulness argument.
- **ac_quality:** 15 ACs, all Given/When/Then, testable, non-overlapping, each linked to ≥1 F-/NFR-/DM- ID.
- **plan_coverage:** Phase 2 covers all three lists (install 2.3 / uninstall 2.4 / guard 2.5 / run-guard 2.6), README index + agent load-refs, header/marker, and `.ados-claude/` regeneration; every AC has a check-listable task.
- **test_traceability:** 15/15 ACs traced in §3.1 (no blank cells); DM-1..4 in §3.2; NFR-1..5 in §3.3. TC-DIST-007 owns AC-F6-6 / DM-4.
- **cross_artifact_consistency:** All three artifacts agree on the three-list truth (install + guard + uninstall), byte-identical quoted string `".ai/rules/bulk-edit-verify.md"`, canonical names (`ADOS_UPDATABLE_FILES`, `STANDALONE_DOCS`, `ADOS_LOCAL_STANDALONE_DOCS`), DM-4/AC-F6-6/NFR-4-triple, and the plural `.ados-claude/agents/` mirror directory.
- **decision_capture:** DEC-1/2/3 captured in spec §15 + pm-notes; three-list expansion is annotated as a v1.1 supersede (change-level decision in the right place). No precedent-setting system decision uncaptured.
- **system_spec_consistency:** No contradiction with `doc/spec/features/feature-doc-distribution-marker.md` / `feature-license-header-script.md` / `feature-claude-plugin-generation.md`. The `feature-ai-rules.md` coverage gap is advisory (Appendix B / OQ-2) and correctly deferred to `@doc-syncer` at system_spec_update.
- **plan_doc_update_coverage:** Plan explicitly schedules system-spec reconciliation phase.
- **plan_code_area_coverage:** Plan lists affected files per phase (rule file, README, `.opencode/agent/{coder,pm}.md`, `.ados-claude/agents/` mirrors, `install.sh`, `test-doc-distribution.sh`, `uninstall.sh`).
- **dod_defined:** Spec §17 (15 testable ACs) + NFRs + test-plan PASS Criterion (#1-6) constitute a clear, testable Definition of Done.

## Findings

None blocking. The remediation introduced no new defect; all four iter-2 findings are closed and no new issue surfaced in the re-critique.

## Remaining Advisory Items (non-blocking; carry to delivery / system_spec_update)

1. **RSK-6 / TR-6 / OQ-TP-3 — install↔uninstall pair has no automated backstop.** Honestly disclosed across all three artifacts. Mitigation stack (AC-F6-6 + TC-DIST-007 3-way byte-identity diff as recurring quality-gate step + uninstall.sh "MUST stay in sync" comment + reviewer check + OQ-TP-3 follow-up for a future symmetry guard mode) is proportionate. Not a blocker. If uninstall drift recurs post-delivery, escalate OQ-TP-3 to a follow-up change.
2. **OQ-2 / Appendix B — no `feature-ai-rules.md`.** Advisory coverage gap; re-surface at system_spec_update (phase 7) by `@doc-syncer`. Human decides on a follow-up ticket. Non-blocking.
3. **OQ-TP-1 — direct vs README-discovery load-reference for `@coder`/`@pm`.** Test-plan recommends the direct named reference to keep TC-DISC-001/002 mechanically verifiable. Surfaced for `@coder` to honor during delivery; non-blocking.
4. **RSK-3 — prompt-level rule has no runtime enforcement.** Inherent to the change class (NG-4); residual risk M, disclosed. Non-blocking.

## Verdict

**READY.** All 10 DoR facets PASS. All iter-2 findings closed (1 MAJOR + 3 NITs). No new substantive blocker introduced by the remediation. The core technical assumptions (marker preserved by header script, drift guard stays green with the three-list addition, load-bearing Phase-2 ordering) hold against the source. Pause Required: no. Delivery (phase 6) may proceed.
