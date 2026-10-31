# Delegation brief: @plan-writer → chg-GH-179-plan.md (delivery_planning)

workItemRef: GH-179 — "M0-S10: pm-notes and registry lint, and phase transitions"
Input artifacts (COMPLETE, authoritative — read both fully):
- `chg-GH-179-spec.md` v1.2 (435 lines)
- `chg-GH-179-test-plan.md` (25 TCs)
Output file: `chg-GH-179-plan.md` in this folder.
Format: canonical per `doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-plan.md` (10 phases, per-task checkboxes, TC mapping, delivery bindings, risks, OQs).

## Plan requirements

1. **Phased tasks**: ordered phases, each ending in a commit-able unit. Every task maps to TCs (from the test plan) and spec sections. All 25 TCs must be mapped; no orphan tasks.
2. **Pin the deferred OQs** the test plan left open: lint target selector spelling (how a change ref / registry target is passed), exclusion-manifest file location and format, projection file name, evidence field names.
3. **Delivery bindings to pin** (grounded in the real tree):
   - `packages/core/src/contracts/pm-notes.ts` (schema vocabulary, as-const variant enum + per-variant required phase sets), `contracts/registry.ts` (phase.transition payload + schema-version constant)
   - `packages/core/src/contracts/error-table.ts`: add `lint` to DOMAIN_KINDS + 5 rows (sync check green from the phase that adds them — GH-174 D3 precedent: rows ship in the SAME phase as the table change, with documented rows updated in the same commit)
   - `packages/core/src/domain/pm-notes-lint.ts`: pure rules (no I/O)
   - `packages/core/src/state/registry.ts`: composes the GH-174 state port (append / read with key-set assertions / atomic derived projection replace) — NO new runtime-API location
   - `packages/cli/src/commands/lint.ts`, `commands/phase.ts`, registered in `commands/index.ts` + `edge.ts`; grammar validation (reason required, canonical phase vocabulary) BEFORE state inspection
   - YAML parsing at the CLI edge (yaml 1.2 core schema via the repo's yaml dependency); parsed values (or parse failures) handed to pure tiers
4. **Fixture hygiene (GH-174 CI lesson)**: new test fixtures must NOT depend on gitignored repo-relative scratch dirs; use os tmpdir siblings or self-materializing setup. Corpus fixture reads committed files read-only (safe).
5. **Execution constraints for @coder** (this runtime): @coder CANNOT dispatch subagents — the plan must state that committer discipline is executed inline by @coder (one Conventional Commit per plan phase, `feat(GH-179): ...` style, explicit staging lists, never stage `.ai/local/` or `tmp/`), pnpm check runs inline with captured logs. Phases sized so each fits a single delegation window (~10 min) — prefer more small phases over fewer large ones.
6. **Quality gates**: no new CI jobs/checks; new tests join existing workspace suites; boundary/ambient gates extended to new paths only by ADDING rules (never weakening).
7. **Error-table sync**: the documented table lives in `doc/spec/features/feature-result-contract.md` — the 5 new rows must be added there in the SAME phase as the source rows (sync check is bidirectional and reads the spec doc). Note: doc/spec updates for THIS change happen formally in lifecycle phase 7, but the error-table documented rows are a binding sync fixture — the plan must add them in the code phase and lifecycle phase 7 reconciles the rest of the doc.

## Report back

Plan path; phase/task/TC counts; the pinned OQ resolutions (selector spelling, manifest location, projection name, evidence fields); risks; any spec/test-plan inconsistency found (if found: STOP and report — PM reopens the upstream phase).
