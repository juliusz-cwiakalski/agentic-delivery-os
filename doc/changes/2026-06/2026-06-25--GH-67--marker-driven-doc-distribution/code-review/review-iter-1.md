# Code Review — Iteration 1

**Change**: GH-67 — Marker-driven doc distribution + install-manifest drift guard
**Branch**: `feat/GH-67/marker-driven-doc-distribution` (base `main` @ d521ace, HEAD 8f74e30)
**Date**: 2026-06-25
**Reviewer**: @reviewer (post-delivery review, iteration 1)
**Diff range**: `git diff d521ace..HEAD` (5 commits, 63 files, +578/−43)

## Status: **PASS**

## Summary

The change delivers what the spec and plan specify: 54 in-scope docs carry a valid `ados_distribution` marker (51 `redistributable` + 3 `internal`, verified by direct grep), `install.sh` derives the guide install set from markers and copies templates recursively (`*.md` + `*.yaml` + `blueprints/**`), and a new CI guard `test-doc-distribution.sh` enforces all five failure modes plus a `get_marker()` two-path parser with seven committed self-tests. The guard is a genuine independent oracle (it observes a real sandbox `install.sh --local` run for the ACTUAL set, and reimplements the install rule for the EXPECTED set — only the parser is shared). All 19 ACs are genuinely satisfied; all 5 plan phases are done; all 5 test suites pass (guard 0 / 54 docs; install 49/49; uninstall 29/29; add-header 19/19; build-claude 15/15).

The two-path `get_marker()` parser handles the documented edge cases correctly — verified by the committed self-tests (no-frontmatter, body-only string, commented line, second-block occurrence for `.md`; top-level/absent/indented for `.yaml`). The mixed-frontmatter handbook (`documentation-handbook.md`, which carries real keys like `id`/`status`/`owners` alongside `# Copyright` comments) parses cleanly. Manual injection of a missing marker and an invalid enum value (`redistibutable`) both produced the correct `::error::` annotation and non-zero exit (modes 1 & 2 confirmed; modes 3/4/5 share the same emit_error mechanism).

No Critical or Major-correctness defects. Five non-blocking findings below (1 Major scope-completeness, 2 Minor, 2 Nit).

## Findings Count

**5 issues (0 critical / 1 major / 2 minor / 2 nit)**

| # | Sev | File | Title |
|---|-----|------|-------|
| 1 | major | scripts/uninstall.sh:75 | uninstall.sh retains hand-listed guide manifest — drift hole for the uninstall path |
| 2 | minor | scripts/.tests/test-doc-distribution.sh:222 | Negative-mode coverage for the 5 drift modes is ephemeral, not committed |
| 3 | minor | scripts/.tests/test-doc-distribution.sh:151 | Guard relies on bash 4+ globstar with no declared dependency |
| 4 | nit | .github/workflows/ci.yml:48 | ci.yml has no trailing newline |
| 5 | nit | scripts/.tests/test-doc-distribution.sh:31 | Guard's STANDALONE_INSTALL_TARGETS is an unsynchronized mirror of install.sh manifest |

See `findings-iter-1.json` for full evidence + suggested fixes.

## Spec / Plan Audit

- **19 / 19 ACs satisfied** (matches the plan's AC Coverage Map). Spot-reverified the high-risk ones:
  - AC-F1-1/2/3 — 54 markers present, 12 redist + 3 internal guides, all 34 templates + 5 blueprints + 5 standalone redist (grep-confirmed).
  - AC-F1-4 — missing-marker mode fires (injection test).
  - AC-F2-1/2/3/4 — install.sh derive loop (L718-730), recursive template glob (L744 `**/*.md` + `**/*.yaml`), internal skip via marker, `decision-making.md` installs (test `test_local_install_decision_making_blueprint_yaml_internal`).
  - AC-F3-1..5 — guard modes 1-5; CI job `doc-distribution-guard` wired (`.github/workflows/ci.yml`).
  - AC-F4-1/2 — both AGENTS.md + pm-instructions.md carry the marker requirement; code-review-instructions.md has the checklist item.
  - AC-F6-1 — `test_local_install_idempotent_content_sync` committed; re-run produces a byte-identical tree.
  - AC-F7-1/2 — `decision-making.md` in mock + assertions; `ados-tools-system-dependencies.md` fixture renamed in both test and uninstall.sh.
- **Plan tasks**: all 5 phases checked, DONE_BUT_UNCHECKED=0, CHECKED_BUT_MISSING=0, OPEN_TASKS=0. The unrelated `pm-instructions.md` commit (a25e5ab) is correctly isolated as a non-GH-67 message per the HARD RULE.
- **RT1 items**: CRIT-1 (two-path parser / YAML marker home), MAJ-1/2/3/4 — all genuinely addressed in the delivered artifacts (not just claimed).
- **Guard independence (oracle, not tautology)**: confirmed. EXPECTED set is computed from the guard's own reimplementation of the install rule + markers; ACTUAL set is observed from a sandbox `install.sh --local` execution. Only `get_marker()` is shared code (and it is self-tested). This catches structural/runtime bugs in install.sh (missing dirs, glob misbehaviour, marker-filter regressions) that a fully shared derivation would mask.
- **Security**: marker value is captured via `awk sub` and only used in `[[ "$x" == "redistributable" ]]` comparisons and `printf '%s'` error output. No `eval`, no command substitution of marker content. No injection surface.

## Key Themes

1. **Asymmetric drift protection** — install path is now self-healing (marker-driven), but the uninstall path retains the exact hand-listed-manifest disease this change eliminates. The drive-by uninstall edit is itself a symptom.
2. **Negative modes are trusted-but-unverified-by-commit** — the guard's pass on the green repo proves today's repo is clean, but the 5 drift-detection branches have no committed regression fixture, so a future logic regression could pass silently.
3. **Parser quality is high** — the two-path awk parser and its 7 committed self-tests are the strongest part of the delivery; the RSK-1/OQ-1 risk is well mitigated.

## Plan Status: ALL_TASKS_DONE
## Plan Gaps: none (OPEN_TASKS=0, DONE_BUT_UNCHECKED=0, CHECKED_BUT_MISSING=0)
## Test Coverage Gaps: negative-mode regression fixtures for guard modes 3/4/5 (finding #2)
## Next Step: PROCEED (no blockers). Recommend addressing finding #1 (uninstall drift hole) as a follow-up change, and #2/#3 as cheap in-scope polish before PR.
