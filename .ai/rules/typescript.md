---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/.ai/rules/typescript.md
---
# TypeScript Workspace Coding Rules

Load this file before editing anything under `packages/`, `tests/`, or
`scripts/checks/`, and before changing root workspace configs
(`tsconfig*.json`, `biome.json`, `.dependency-cruiser.cjs`, `bunfig.toml`).

Authority order: this file, then the checker configs it points to. If this
file and a checker disagree, the checker wins: fix the file, never the rule.
This file states non-inferable policy only; it does not restate what
`tsconfig.base.json`, `biome.json`, and `.dependency-cruiser.cjs` enforce.

## 0) Non-negotiables

- No `any`, no `!` non-null assertion, no `as` cast used to silence a type
  error, no `@ts-expect-error` or `biome-ignore` without a one-line reason.
- No `require`, `__dirname`, or `__filename`: the workspace is ESM only.
- No runtime API (`node:*`, `bun:*`, `process`, `fetch`, `fs`) outside the
  allowed locations in section 4.
- Never widen a public type so a caller compiles; fix the caller.
- Never edit `dist/**`, generated files, or a package `exports` map to make
  a check pass.
- Run `pnpm check` before finishing. Do not hand-format: Biome owns style.
- If a rule here blocks a legitimate need, stop and raise it in the plan or
  a decision record; do not route around the checker.

## 1) Stack and packages

- pnpm + Bun, ESM (`"type": "module"`), strict TS per `tsconfig.base.json`.
- Six packages: `core`, `adapters`, `cli`, `mcp`, `opencode`, `testkit`.
  Shared vocabulary lives in `@delivery-os/core` subpath `./contracts`.
- Node builtins are always `node:`-prefixed. `Bun.*` APIs only in packages
  that already declare Bun as their runtime; portable code uses `node:`.
- New dependencies: add the license-registry verdict (fail-closed audit) in
  the same change; never bump versions by hand (changesets owns it).

## 2) Module system and imports

- Type-only imports use `import type` / `export type`; mixed lines use
  `import { a, type B }`. `verbatimModuleSyntax` is on.
- Intra-package imports use the declared `#` aliases (`#domain/*`,
  `#contracts`, `#app/*`, and per-package equivalents). No `../../` jumps
  that cross a tier; no relative path that escapes the package root.
- Cross-package imports use `@delivery-os/<pkg>` plus a declared subpath.
  Never `/src/`, never `/dist/`, never deep relative paths.
- Keep `#imports` maps pointing at `./src/**/*.ts`; do not "normalize" them
  to `.js`.
- No star imports and no import renames; name the export instead.

## 3) Types under strict flags

- `exactOptionalPropertyTypes`: `prop?: T` means absent. Add
  `| undefined` only when callers may pass explicit `undefined`. Build
  optional fields conditionally (`...(v !== undefined ? { v } : {})`).
- `noUncheckedIndexedAccess`: every indexed read is `T | undefined`.
  Early-return, `??`, or validate once at the boundary; never assert.
- Exported signatures get explicit return types; locals use inference.
  Prefer `satisfies` when you want shape checking plus a narrow type.
- Validate unknown input once, at the edge, then pass typed values inward.
- Exhaustive `switch` over a union ends with a `default` that calls an
  `assertNever`-style helper.

## 4) Layering (mechanical; see .dependency-cruiser.cjs)

- Package matrix: `core` imports no sibling package; `adapters` may not
  import `cli`/`mcp`/`opencode`; `cli`, `mcp`, `opencode` are surfaces.
- `core` tiers: `domain`, `config`, `branding`, and `state` import
  `./contracts` only; `app` composes `domain` and `config`.
- Runtime and I/O access only in: `core/src/state/driver/`, the `adapters`
  I/O subpaths (`repo`, `file`, `host`, `session`, `legacy`, `credentials`),
  `cli`, and `opencode`. The two configuration environment readers
  (`adapters/src/file/yaml-parser.ts`, `adapters/src/legacy/index.ts`) are
  the only other ambient-env exceptions the secret-read boundary allows.
  Everything else stays pure.
- Inner code never imports or constructs a concrete adapter; composition
  roots (`cli` entry, MCP entry, OpenCode host) wire adapters in.
- On a boundary violation: fix the dependency (move or invert the port),
  never loosen the rule. A new allowed edge requires a matrix update plus a
  failing negative fixture in the same change (fixture-coverage meta-check
  enforces this).

## 5) Purity: time, randomness, environment

- Time, randomness, env, and I/O arrive as parameters. If you need the
  clock, take a `Clock`; IDs, take an `IdGen`; env, take a resolved config
  object.
- No `Date.now`, `Math.random`, ambient `process`, `Bun`, `fetch`, or
  timers in neutral tiers; the ambient-globals AST guard enforces the set.
- Same input plus same injected dependencies must produce the same output.
  If a function cannot be tested without a real clock or disk, the seam is
  missing.

## 6) Dependency injection without frameworks

- Inject via constructor arguments or a single options object; ports are
  plain interfaces in `./contracts`.
- In-memory fakes live in `testkit` and `tests/`; no decorators, no DI
  container, no service locator, no module-level singletons.
- Factories return ports; composition happens at the edges (section 4).

## 7) Errors and results

- Command surfaces return the workspace result envelope; error values
  carry registry error codes (symbolic `domain.reason.detail` with
  category, retryability, consequence, remediation). The code table and
  the registry are synced by a binding check: never add one without the
  other.
- Do not `throw` across a port boundary unless the contract says so.
- `catch (e: unknown)`: narrow (`e instanceof Error`) before reading
  fields.
- Error messages name the failing input and the next action. Never log or
  emit secrets, credentials, or full environment dumps; the emission
  chokepoint redacts, keep it that way.

## 8) Branding

- No hardcoded product or binary names anywhere: every name-derived value
  resolves through the branding seam (config-driven working name).
- Seed-token lists exist only inside the scanner mechanism and its tests;
  nowhere else.

## 9) Test authoring (bun:test)

Run commands, placement rules, and CI order live in
`.ai/rules/testing-strategy.md`; this section is authoring rules only.

- Prefer injected fakes over `mock.module()`. `mock.module` is
  process-global and sticky: `mock.restore()` does not undo it. Use it
  only for third-party edges, and restore in `afterEach`.
- Never assign `obj.fn = mock()`: use
  `spyOn(obj, "fn").mockImplementation(...)` plus `mock.restore()`.
- Deterministic: no real clock, network, `$HOME`, sleeps, or
  order-dependent tests. Fixtures are never named `*.test.ts`.
- Golden files: committed fixtures, output normalized (no absolute paths,
  timestamps, or unstable ordering), regenerated by an explicit script so
  a diff stays human-reviewable.
- Snapshots are code: commit and review them; never blanket
  `--update-snapshots` to get green.
- Test real behavior through ports with fakes; do not re-implement the
  logic under test in the test.

## 10) Gates and commands

- Iterate: `pnpm typecheck`, `bun test <path>`, `biome check --write
  <paths>`.
- Finish: `pnpm check` (lint, format check, typecheck, tests, boundaries,
  exports parity).
- Do not run `tsc` directly; use the workspace scripts.
- CI parity: checks must hold in a clean checkout (no built `dist`, packed
  tarball resolution, fetched baseline commits). If a check depends on
  local state, fix the check's environment contract, not the CI job.

## 11) Do not

- Add a dependency without a license-registry verdict and a stated reason.
- Deep-import another package or reach into `/src/` of another package.
- Introduce a new ambient global, singleton, or module side effect.
- Copy code from private corpora; public code states engineering
  rationale generically and stands alone.
- Add `any`-typed escape hatches "temporarily".

## 12) Pre-finish checklist

- [ ] No `any` / `!` / unjustified `as` / `@ts-expect-error` /
      `biome-ignore`
- [ ] All imports via `#` aliases or declared package subpaths
- [ ] No runtime API or ambient global outside allowed locations
- [ ] Optional props modelled as absent, not `undefined`
- [ ] Errors use the envelope, registry-synced codes, and redact secrets
- [ ] No hardcoded product names
- [ ] Tests use fakes; deterministic; golden files normalized
- [ ] `pnpm check` green; changeset or license verdict added if
      dependencies changed
