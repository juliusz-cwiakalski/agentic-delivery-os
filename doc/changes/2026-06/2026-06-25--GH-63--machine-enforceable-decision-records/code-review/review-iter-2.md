# Code Review — Iteration 2 (re-review after remediation)

**Change**: GH-63 — Machine-Enforceable Decision Records
**Branch**: `feat/GH-63/machine-enforceable-decision-records` → `main`
**Date**: 2026-06-25
**Reviewer**: `@reviewer`
**New diff since iter-1**: commits `8e7e717`, `5203f52`

## Status: **PASS**

Iteration-1 returned FAIL on 4 findings (1 MAJOR blocking + 1 MINOR + 2 NITs). All four are
resolved in Phase 10. No new findings in this iteration.

**Findings**: 0 new (0c / 0m / 0n / 0nit)
**Spec compliance**: PASS (18 ACs hold; SD-12/13/14/15/16 honored)
**Plan status**: ALL_TASKS_DONE (Phase 10 tasks 10.1–10.5 all `[x]`)

## Iteration-1 findings — resolution confirmation

| # | Severity | Finding | Status | Evidence |
|---|----------|---------|--------|----------|
| 1 | MAJOR (blocking) | `links: {}` flow-map crash (exit 5 + raw `jq` trace) | **RESOLVED** | `parse_value()` handles flow maps `{}`/`{k:v}`; `_split_flow()` tracks `{}` nesting; validator access routed through type-safe `_safe_nested_len`/`_safe_nested_str` with explicit `if type=="object"` guard (the coder's flagged wrong-typed-string case is genuinely guarded — `// {}` alone would NOT have caught it). `links: {}` record now exit 0, no `jq:` trace. Edge probes all clean: `governance: {}`→0, `classification: {}`→0, `links: {supersedes:[ADR-0001]}`→0, and wrong-typed `links: "str"` + Superseded→exit 1 with the correct actionable error, **no crash**. Regression tests `test_valid_empty_links_flow_map_exit0` + `test_flow_map_never_crashes` green. |
| 2 | MINOR | `decision_date` pattern unenforced + coverage tautology | **RESOLVED** | `_check_date … decision_date` now called (validator:191). `ADR-9019` (`decision_date: "2026/06/25"`) rejected, exit 1. `--coverage` gained an **enforcement-strength pass**: requires a `negative/` fixture per pattern/enum rule and PROVES rejection by running the validator binary. Drift-injection sanity confirmed it surfaces `ENFORCEMENT_FAILURE` when a negative fixture is silently accepted. New negative fixtures 9019/9020/9021/9022. "12 N/A" is honest — 11 declarative-only classification/top enums + 1 planning-summary `decision_id` pattern, all genuinely outside the validator's §28.3 scope (documented in PDR-0001), not hidden uncovered rules. |
| 3 | NIT | dead `_extract_title()` | **RESOLVED** | Removed from `tools/generate-decision-index` (diff confirms deletion). |
| 4 | NIT | `_build_rows` used bare `jq` (mockability) | **RESOLVED** | `jq -nc …` → `_jq -nc …` in `_build_rows`. |

## No-regression verification

- **Suites**: validate **35/35**, index **13/13**, scripts **5/5** (test-all all PASS).
- **ADR-0001 + PDR-0001**: both validate clean (exit 0).
- **Index sync**: `generate-decision-index --dry-run` byte-identical to committed `00-index.md`.
- **Coverage**: `UNCOVERED: 0`, `ENFORCEMENT_PROVEN: 17`, no `NO_REJECTOR`/`ENFORCEMENT_FAILURE`.
- **`.ados-claude/` regen**: no `.opencode/` or `.ados-claude/` changes this iteration (diff `0917957..HEAD` empty for both) — regen correctly a no-op.
- **Forbidden-deps guard**: clean (TC-016 PASS; stdlib-only, no network).
- **Plan bookkeeping**: Phase 10 execution-log row updated (refs `8e7e717`); Plan Revision Log entry 1.1 added.

## Next step
PROCEED — clear for the post-delivery red-team + PR. No plan changes required.
