# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-110
Date: 2026-07-03
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS (iter-1 Major resolved — AC-F2-1/F2-2 now backed by executable TC-CI-003)
- cross_artifact_consistency: PASS (one Minor drift noted below; non-blocking)
- decision_capture: PASS (DEC-7 softened consistently; no-TDR call stands)
- system_spec_consistency: PASS (DM-2 `.ai/local/` exclusion consistent; ci.yml unchanged; DEC-5 marker rule verified)
- plan_doc_update_coverage: PASS (phase-7 feature-spec handoff explicit)
- plan_code_area_coverage: PASS (file-per-phase; Phase 4 stages workflow + test file; executable-bit flag real)
- dod_defined: PASS (10 runtime ACs + §18 rollout; AC#5 consistently a non-runtime review flag)

## iter-1 Findings → Resolution Status

1. **[Major] test_traceability — AC-F2-1/F2-2 inspection-only → RESOLVED.**
   Evidence:
   - Test-plan §3.1 now maps AC-F2-1 → TC-CI-001, **TC-CI-003** and AC-F2-2 → TC-CI-001/002/**TC-CI-003**.
   - **TC-CI-003** is a real detail section (test-plan §5.2, "Workflow structural validity"): required-present grep + forbidden-absent grep + `actionlint` when available + YAML-parse when available — an **executable** test, not eyeball.
   - New file `scripts/.tests/test-docs-mermaid-workflow.sh` is created in **plan Phase 4.2** (with `chmod +x` — test-all.sh filters `-perm -u+x`; verified at `scripts/test-all.sh:88`); Phase 4 `Stage ONLY` stages **both** `.github/workflows/docs-mermaid-validate.yml` AND `scripts/.tests/test-docs-mermaid-workflow.sh`.
   - The malformed-workflow silent-pass class is now caught structurally (forbidden-absent assertions on `pull_request_target` / `continue-on-error` / `|| true` / deploy). AC-F2-1/F2-2 now trace to an executable test.
   - Portability confirmed: portable baseline = grep (steps 1–2); `actionlint`/YAML-parse are enhancements gated on tool availability ("never hard-fails solely because actionlint is absent") — test plan §5.2 Notes and plan Phase 4.2 agree.

2. **[Minor] DM-2 `.ai/local/` exclusion → RESOLVED.**
   Consistent across: spec §8.3 DM-2 ("excluding git-ignored paths (notably `.ai/local/`)... skips any `.md` under `.ai/local/`"); plan Phase 2.3 (same exclusion + skip); test-plan §3.2 DM-2 row (same); TC-BASE-001 runs the validator (which honors DM-2 internally). No contradiction. *(One residual nit, non-blocking: TC-BASE-001 step-2 parenthetical "(doc/**, .ai/**/*.md)" reads as if it scans all of `.ai/**`; the script's internal DM-2 exclusion makes the behavior correct — wording only.)*

3. **[Minor] DEC-7 drift-guard (TC-RULE-004) → RESOLVED.**
   TC-RULE-004 is a real detail section (test-plan §5.2): asserts the script's default denylist is byte-aligned with `diagrams.md`'s `C4Context`/`C4Container`/`C4Component` and flags any divergence. Present in plan Phase 3.10. Spec DEC-7 (§15) and DM-3 (§8.3) softened from "single source of truth" to "canonical ... script default **mirrors** it ... drift-guard test (TC-RULE-004) pins the parity" — consistent across all three docs.

4. **[Minor] NFR-2 reframed as CI-only observation → RESOLVED.**
   spec NFR-2: "**CI-only observation** — not assertable in the local fast suite." test-plan NFR-2 row: "**CI-only observation** — not a fast-suite assertion (cannot be asserted locally); observed on real PR runs." No false "Covered" claim. Consistent.

5. **[Minor] trigger hedge → RESOLVED.**
   test-plan TC-CI-001 step 1 now reads "triggers `on: pull_request` (pull_request only — DEC-1/spec F-2)" — no "(and push as configured)". spec F-2 and plan Phase 4.1 both specify `on: pull_request` only. Three-way consistent. (The direct-push coverage asymmetry vs `ci.yml` remains an accepted limitation; consciously consistent.)

6. **[Minor] AC#5 inspectable → RESOLVED (accepted as-is).**
   AC#5 / DEC-3 is consistently modeled as a non-runtime review/release flag across all three docs: spec §17 E + §18.5; test-plan §3.1 note ("intentionally absent from this matrix"); plan AC Coverage Map ("Review/release flag ... not a runtime AC"). The original suggestion to add a formal AC-F5-1 row was not adopted, but the re-check brief accepts this modeling as-is and the cross-artifact consistency now holds. No gap.

7. **[Minor] plan Phase 0 (artifacts commit) + staging correction → RESOLVED.**
   plan **Phase 0** (new) stages ONLY the four change artifacts (`spec/test-plan/plan/pm-notes`) as a `docs(GH-110)` commit. plan Constraints corrected: "DO commit the change artifacts (chg-GH-110-...pm-notes.yaml)... Never stage `.ai/local/`." The earlier conflation of git-ignored `.ai/local/pm-context.yaml` with the committed `doc/changes/*-pm-notes.yaml` is fixed. Correct.

## New Findings (introduced by the iter-1 edits)

1. [Minor] cross_artifact_consistency — `chg-GH-110-plan.md` lines 40, 494, 576 (Context, Test-Scenarios header, Artifacts table)
   Gap: the plan still references the test plan as **"20 TCs"** in three places (Context §line 40; Test Scenarios §line 494; Artifacts §line 576), but the test plan was bumped to **22 TCs** by the iter-1 remediation (test-plan §5.1 line 149: "Totals: 22 test cases"; revision log 1.1 line 779: "Totals now 22 TCs"). The count references were not refreshed when TC-CI-003 + TC-RULE-004 were added. This is a stale-reference drift between the two artifacts.
   Severity rationale: Minor — non-blocking. The plan explicitly defers to the test plan as the authoritative matrix ("The authoritative case matrix is `./chg-GH-110-test-plan.md`"), and the plan's own per-TC table already correctly lists all 22 TCs (TC-MMD-001..012, TC-CI-001/002/003, TC-RULE-001..004, TC-AGENT-001/002, TC-BASE-001), so the inconsistency is cosmetic, not a coverage gap.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Update the three "20 TCs" references in the plan to "22 TCs" (or reword to "see test plan for the authoritative count").

No other new contradictions found:
- "New files (3)" (test-plan §7) = 1 script + 2 test files; "Two new executable test files" (test-plan §5.1) = the 2 tests. Consistent — not a contradiction.
- Plan files-touched table lists all three (`validate-mermaid.sh`, `test-validate-mermaid.sh`, `test-docs-mermaid-workflow.sh`) in the correct phases. Phase 4 stages workflow + test file together. ✓
- TC-CI-003 + TC-RULE-004 are real detail sections (verified present, not invented IDs).

## Per-AC Coverage Verdict (re-confirmed)
- AC-F1-1 → covered (TC-MMD-001/009)
- AC-F1-2 → covered (TC-MMD-002, TC-BASE-001)
- AC-F1-3 → covered (TC-MMD-003/004/011)
- AC-F1-4 → covered (TC-MMD-005/006/007/008/012; full DEC-7 2×2 incl. Q2 mmdc-OK+C4→FAIL)
- AC-F2-1 → **covered** (TC-CI-001 + executable TC-CI-003) — Major gap closed
- AC-F2-2 → **covered** (TC-CI-001/002 + executable TC-CI-003) — Major gap closed
- AC-F3-1 → covered (TC-RULE-001)
- AC-F3-2 → covered (TC-RULE-002)
- AC-F3-3 → covered (TC-RULE-003 + distribution guard)
- AC-F4-1 → covered (TC-AGENT-001/002 + CI verify-claude-build)
- AC#5 (DEC-3) → non-runtime review flag, consistent across all three docs

AC coverage total: 10 / 10 runtime ACs. ✓

## Decision-Consistency Re-Check (DEC-1..DEC-7)
- DEC-1 (dedicated workflow; ci.yml unchanged) — consistent spec/test-plan/plan. Verified `git diff --stat HEAD -- .github/workflows/ci.yml` empty; test-all.sh:88 `-perm -u+x` confirmed.
- DEC-2 (.ados-claude regen, source+generated together) — consistent; plan Phase 5.
- DEC-3 (AC#5 review flag, not runtime) — consistent across all three.
- DEC-4 (agent set = spec-writer/doc-syncer/bootstrapper) — consistent; exclusions justified by audit.
- DEC-5 (diagrams.md no marker; only README index row) — consistent; verified individual rule files carry no `ados_distribution` marker.
- DEC-6 (markdownlint non-goal) — consistent; respected.
- DEC-7 (render + C4 keyword guard, AND-semantics) — consistent after the soften-to-"mirrors + drift-guard" edit; spec §15/§8.3/§5.1, test-plan TC-MMD-005..008/012 + TC-RULE-004, plan Phase 2/3 all aligned. No inter-decision contradictions.

## Feasibility Spot-Check (TC-CI-003)
- grep-required-present + grep-forbidden-absent = portable, no external deps.
- `actionlint`: "if available ... skip notice if absent" → self-adapting; won't hard-fail on a tool-less runner.
- YAML-parse: "if a YAML tool is available" → self-adapting.
- Portable baseline (grep) is sufficient to catch the malformed-workflow silent-pass class; enhancements are gated. Feasible and correctly hedged.

## Gate Result
The iter-1 Major (AC-F2-1/F2-2 inspection-only) is genuinely resolved by executable TC-CI-003, and every iter-1 Minor holds. No new blocker introduced. The single new finding (stale "20 TCs" count in the plan) is a non-blocking Minor cosmetic drift; the plan already lists all 22 TCs correctly in its per-TC table, so coverage is unaffected.

Verdict: **READY.** The new Minor may be cleaned up opportunistically at delivery time (or in a follow-on plan edit) but does not block the delivery gate.
