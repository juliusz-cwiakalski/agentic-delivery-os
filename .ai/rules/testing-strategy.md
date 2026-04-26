# Repository Testing Strategy

Canonical testing strategy for this repository. Use this file as the default rule when creating test plans and validating changes.

## Scope

- Applies to documentation/templates, `tools/`, and `scripts/` changes.
- Align with `AGENTS.md` and `.ai/rules/README.md`.
- For Bash-related changes, also load `.ai/rules/bash.md`.

## Test layers and types

1. **Static/diff checks (always)**
   - `git diff --check` (whitespace/conflict marker guard).
   - Changed-file review for naming/path conventions.
2. **Content checks (docs/templates changes)**
   - Manual traceability review against change spec/plan/AC.
   - Markdown rendering review (headings, lists, tables, code fences).
   - Link/path review for changed links and references.
   - YAML syntax check for changed `.yaml`/`.yml` files.
3. **Automated shell/tool tests (when code changes)**
   - `tools/`: run `bash tools/.tests/test-<tool-name>.sh`.
   - `scripts/`: run `bash scripts/.tests/test-<script-name>.sh`.

## Module-to-test mapping

- `doc/**` and templates (`doc/templates/**`) → static/diff + content checks.
- `tools/<tool>` → corresponding `tools/.tests/test-<tool>.sh`.
- `scripts/<script>.sh` → corresponding `scripts/.tests/test-<script>.sh`.
- Mixed changes → run all applicable layers for each touched area.

## Conventions

- Test files must follow `test-*.sh` naming in adjacent `.tests/` folders.
- Prefer narrow, changed-module checks first; escalate to broader checks only when risk requires it.
- Record evidence in change artifacts (commands run + result summary).

## Quality gates

- Required before completion:
  - Relevant tests/checks pass for touched modules.
  - No unresolved formatting issues from `git diff --check`.
  - For docs-only/template-only changes, manual verification is completed and documented.

## Fallback rules

- If no automated tests exist for docs/template-only changes: mark automated tests as **N/A**, then require manual verification + `git diff --check`.
- If a shell/tool module lacks a matching test script: treat as a gap, document it in the plan/test-plan, and run at least targeted manual execution for changed behavior.
