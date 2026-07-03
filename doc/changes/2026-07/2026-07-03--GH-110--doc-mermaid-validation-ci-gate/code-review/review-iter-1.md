# Code Review — GH-110 (Iteration 1)

**Date:** 2026-07-03
**Reviewer:** `@reviewer`
**Mode:** local (committed diff `main...feat/GH-110/doc-mermaid-validation-ci-gate`, 8 commits)
**Status:** **PASS**

## Finding Summary

| # | Severity | Confidence | File | Title |
|---|----------|------------|------|-------|
| 1 | minor    | high | `scripts/validate-mermaid.sh:397` | `parse_args` `--` handler trips errexit on the trailing `shift` (latent, untested path) |
| 2 | minor    | high | `.github/workflows/docs-mermaid-validate.yml:43` | mmdc install unpinned (spec RSK-2 mitigation not realized) |
| 3 | nit      | high | `scripts/validate-mermaid.sh:128` | `build_denylist` `:-` conflates empty-string override with unset (REPLACE-ambiguity) |
| 4 | nit      | high | `chg-GH-110-plan.md` | DONE_BUT_UNCHECKED: Phase 4/5/6 tasks complete in code but unchecked |

**Severity totals:** 0 Blocker · 0 Major · 2 Minor · 2 Nit
**Remediation Phase:** NONE (no Blockers/Majors; all findings advisory)

## Key Themes

- The load-bearing decision (DEC-7 dual-check AND-semantics) is **correctly implemented** and well-tested — the full 2×2 truth table (TC-MMD-012) including the motivating quadrant-2 (mmdc-OK + C4 → FAIL) is pinned, and the keyword guard provably runs without `mmdc` even under `--if-present`.
- Security posture is clean: untrusted mermaid input is rendered via a file-passed `mmdc -i -o` (no shell interpolation, no `eval`, consistent quoting, safe tmp handling under a `_WORKDIR` cleaned by an EXIT trap).
- Determinism, sorted enumeration, distinct exit codes, 3/3 failure messages, and the Chromium-free mock seam (`MMDC_CMD`) are all implemented and tested.
- The findings are all in non-AC, untested, or advisory territory — no shipped regression in a path the change is required to protect.

## DEC-7 Correctness Verdict

**PASS.** The dual-check AND-semantics is correctly realized in `validate_block` (lines 229-254):

1. `_keyword_guard` runs **unconditionally** first (cheap `grep -qF`, no `mmdc`).
2. Render runs only if `_mmdc_available`; on failure the first non-empty stderr line is surfaced.
3. Both failure kinds may be recorded for one block; aggregate exit precedence is keyword(5) > render(4) > missing-mmdc(3) > success(0).

The critical regression path — a C4 block that `mmdc` *would* render but GitHub does not — is provably blocked by TC-MMD-012 quadrant 2 and TC-MMD-005/006 (keyword guard effective without `mmdc`, closing RSK-4). The script's default denylist (`C4Context C4Container C4Component`) mirrors `.ai/rules/diagrams.md`, and TC-RULE-004 pins the parity (source-level + behavioral).

## AC Verdicts

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-F1-1 (broken block ⇒ non-zero + file + index + first error) | satisfied | TC-MMD-001/009; `_record_render_failure` emits file + 1-based index + first stderr line + `::error::` |
| AC-F1-2 (valid render-safe block ⇒ exit 0) | satisfied | TC-MMD-002; TC-BASE-001 (self-skips without mmdc) |
| AC-F1-3 (test runs & passes; bash.md conformance) | satisfied | strict mode + errtrace + inherit_errexit; ERR/EXIT/INT/TERM traps; context-tagged logging; testable main guard; documented exit codes; `MMDC_CMD` injection; `--if-present`/`--help`/`--version`. 14 tests, PM-green. |
| AC-F1-4 (C4 fails naming keyword; runs under `--if-present` w/o mmdc; denylist configurable) | satisfied | TC-MMD-005/006/007/008/012; `RENDER_SAFE_DENYLIST` REPLACE semantics pinned |
| AC-F2-1 (dedicated workflow; benign; installs mmdc; runs validator) | satisfied | `docs-mermaid-validate.yml`; `on: pull_request` + `paths:`; `permissions: contents: read`; no `pull_request_target`; no deploy; TC-CI-003 structural test |
| AC-F2-2 (broken block fails PR; `ci.yml` unchanged) | satisfied | `git diff main...HEAD -- .github/workflows/ci.yml` empty (reviewer-verified); DEC-1 honored |
| AC-F3-1 (rule states 4 render-safe families) | satisfied | `.ai/rules/diagrams.md` lines 10-13 |
| AC-F3-2 (C4 avoidance + flowchart fallback) | satisfied | `.ai/rules/diagrams.md` lines 15-24 |
| AC-F3-3 (README index row; `diagrams.md` no marker — DEC-5) | satisfied | `.ai/rules/README.md` line 31; 0 `ados_distribution` matches in `diagrams.md` (reviewer-verified) |
| AC-F4-1 (3 agents carry rule ref + self-check; plugin regenerated) | satisfied | all 3 `.opencode/agent/*.md` carry the rule + self-check; 3 corresponding `.ados-claude/agents/*.md` regenerated (reviewer-verified diff); excluded agents untouched |
| AC#5 (CEO-gated PR — DEC-3) | satisfied (non-runtime) | review/release flag surfaced at PR time; not a runtime gate |

**Coverage: 10/10 runtime ACs satisfied.**

## Spec/Plan Compliance Summary

- **Scope compliance:** all in-scope deliverables present; no out-of-scope additions.
- **CI isolation (DEC-1):** `ci.yml` byte-for-byte unchanged.
- **Agent set (DEC-4):** exactly `spec-writer`, `doc-syncer`, `bootstrapper` edited; `decision-advisor`/`editor`/`meeting-organizer` untouched.
- **No marker (DEC-5):** `.ai/rules/diagrams.md` carries no `ados_distribution`; distribution guard stays green.
- **Plugin regen (DEC-2):** source + generated committed together; `test-build-claude-plugin.sh` PM-green.
- **Phase-7 feature spec (PM decision #5):** `doc/spec/features/feature-doc-mermaid-validation.md` authored in-change; honest `ados_distribution: internal` marker (outside DM-2).
- **Plan gaps:** 4 DONE_BUT_UNCHECKED tasks (finding #4) — hygiene only.

## Next Step

**PROCEED.** The change is correct, complete, and all 10 runtime ACs are satisfied against a green test suite. The two Minors are advisory (no AC requires them); address finding #1 (the `--` errexit latent bug) opportunistically as it is a genuine code defect worth fixing before or shortly after merge. Finding #2 (mmdc pinning) is a maintenance-quality item worth a quick follow-up commit.
