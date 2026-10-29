# Repository Testing Strategy

Canonical testing strategy for this repository. Use this file as the default rule when creating test plans and validating changes.

## Scope

- Applies to documentation/templates, `tools/`, `scripts/`, and the TypeScript workspace (`packages/`, `tests/`, root workspace configs) changes.
- Align with `AGENTS.md` and `.ai/rules/README.md`.
- For Bash-related changes, also load `.ai/rules/bash.md`.
- For TypeScript workspace changes, also follow `tsconfig.base.json`, `biome.json`, and `.dependency-cruiser.cjs`.

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
4. **TypeScript workspace checks (when TS changes)**
   - Runner: `bun test` (or `pnpm test`) for `tests/**/*.test.ts` — structure, boundaries, behaviour, and checks suites. Fixtures are never named `*.test.ts`, so temporary workspaces are not discovered as suites.
   - Repository invariants: `bun run scripts/checks/*.ts` must exit non-zero and name the offending field; `tests/checks/**` mutation-tests them.
   - Boundaries: `check:boundaries` chains `depcruise packages` → the ambient-globals AST guard → `scripts/checks/workspace-entrypoints.ts` (declared `workspaceImports` edges and undeclared package-name imports). `bun test tests/boundaries` runs every negative fixture in a temporary workspace against the production `.dependency-cruiser.cjs`; fixture manifests export `dist` targets with `dist` materialized, so package-name probes mirror production resolution. The fixture-coverage meta-check fails any rule without a failing fixture.
   - Aggregate: `pnpm check` is the single entry point (`lint → format:check → typecheck → test → check:boundaries`). Prefer it for final verification; use the narrow suites while iterating.
   - CI order: `pnpm install --frozen-lockfile` → typecheck, lint, format, test, boundaries → **build before** exports/publint/attw (those checks read `dist/`) → pins, publish guard, license audit, vulnerability gate, aggregate, commitlint.

## Module-to-test mapping

- `doc/**` and templates (`doc/templates/**`) → static/diff + content checks.
- `tools/<tool>` → corresponding `tools/.tests/test-<tool>.sh`.
- `scripts/<script>.sh` → corresponding `scripts/.tests/test-<script>.sh`.
- `packages/**` → `bun test tests/structure tests/behaviour`, the boundary suite, and `pnpm typecheck`.
- `scripts/checks/<check>.ts` → `bun run scripts/checks/<check>.ts` plus the matching `tests/checks/**` mutation tests.
- `.dependency-cruiser.cjs` or any boundary rule → `bun test tests/boundaries` (including the fixture-coverage meta-check).
- `packages/*/package.json` `workspaceImports` or any declared cross-package edge → `bun run scripts/checks/workspace-entrypoints.ts` (part of `check:boundaries`) plus the boundary suite.
- `.github/workflows/ci.yml` or `release.yml` → `bun run scripts/checks/ci-topology.ts`, `ci-bindingness.ts`, and `ci-supply-chain.ts`.
- Mixed changes → run all applicable layers for each touched area.

## Conventions

- Bash test files must follow `test-*.sh` naming in adjacent `.tests/` folders.
- TypeScript test files follow `*.test.ts` under `tests/<layer>/`; fixtures live in `tests/fixtures/**` or as committed case definitions. TypeScript tests use `bun:test`, not Jest or Vitest.
- Prefer narrow, changed-module checks first; escalate to broader checks only when risk requires it.
- Record evidence in change artifacts (commands run + result summary).

## Quality gates

- Required before completion:
  - Relevant tests/checks pass for touched modules.
  - No unresolved formatting issues from `git diff --check`.
  - For TypeScript workspace changes, `pnpm check` passes.
  - For docs-only/template-only changes, manual verification is completed and documented.

## Fallback rules

- If no automated tests exist for docs/template-only changes: mark automated tests as **N/A**, then require manual verification + `git diff --check`.
- If a shell/tool module lacks a matching test script: treat as a gap, document it in the plan/test-plan, and run at least targeted manual execution for changed behavior.
- If a boundary rule changes without a matching negative fixture, treat it as a gap: the fixture-coverage meta-check fails the rule as unenforced. Add the fixture in the same change.
