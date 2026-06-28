# Code Review — Iteration 1 (GH-57)

**Date**: 2026-06-28
**Reviewer**: @reviewer (local mode, Definition-of-Done review vs spec/plan)
**Base**: main · **Head**: feat/GH-57/readiness-gate
**Status**: **FAIL**
**Findings**: 7 (1 critical / 3 major / 2 minor / 1 nit)

## CI / structural gates

| Gate | Result |
|------|--------|
| `test-doc-distribution.sh` | PASS (74 docs; new guide declares `ados_distribution: redistributable`) |
| `test-build-claude-plugin.sh` | PASS (15/15) — **but see finding #2: this test does not detect committed-source-vs-committed-generated drift**, so its green status is misleading |
| Renumbering sweep (NFR-1) | PASS — 0 stale "10-phase"/"phase 5 = delivery" refs across the swept OpenCode/doc surfaces |
| Plugin freshness (NFR-5) | **FAIL at HEAD** — committed `.ados-claude/` is stale and missing the new agent/command (finding #1) |

## Spec / plan audit

- **Plan-task audit:** OPEN_TASKS + DONE_BUT_UNCHECKED — every Phase A–G checkbox is `- [ ]` and the execution log is all "Pending" despite 5 delivery commits (finding #3).
- **AC compliance:**
  - AC1 PASS · AC3 PASS · AC4 PASS · AC5 PASS · AC6 PASS · AC7 PASS · AC9 PASS (reviewer.md diff vs main is empty).
  - **AC2/AC8 PARTIAL→FAIL** for the generated Claude Code surface: the committed plugin has no DoR gate and a 10-phase PM (finding #1); the change's own pm-notes omits `dor_check` (finding #4). OpenCode surfaces (.opencode/AGENTS.md/README/lifecycle/3 author agents) are correct.
  - AC10 honest surrogate (red-team) — as documented.

## Key themes

1. **The generated plugin is the product, and it is broken at HEAD.** `.ados-claude/agents/readiness-reviewer.md` + `skills/check-readiness/` were never committed, and `.ados-claude/agents/pm.md` still ships the 10-phase flow. A Claude Code user gets a PM agent that silently skips the DoR gate — the precise "silent skip" the change exists to eliminate, but at the tooling layer. This violates NFR-5 and the change's own governance rule (pm-notes line 39).
2. **The freshness CI does not catch this drift** (finding #2), which is why it reached review undetected. That is the highest-value process gap to close.
3. **The change's own artifacts weren't closed out** (findings #3, #4) — checkboxes, execution log, and the pm-notes phase map were never updated. Ironically this is exactly the class of cross-artifact gap the DoR gate is designed to catch.

## Recommendation

Fix findings #1, #3, #4 (and the enabling #2) before PR. #1 is the blocker: re-run `build-claude-plugin.sh` and commit source + generated together. #5–#7 are lower priority but should be addressed in the same remediation pass.

## Next step

CALL_CODER — execute the appended "Phase H: Code Review Remediation (Iteration 1)" in the plan, then re-review.
