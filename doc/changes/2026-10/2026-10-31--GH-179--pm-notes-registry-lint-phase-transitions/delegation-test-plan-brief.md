# Delegation brief: @test-plan-writer → chg-GH-179-test-plan.md (test_planning)

workItemRef: GH-179 — "M0-S10: pm-notes and registry lint, and phase transitions"
Input artifact (COMPLETE, authoritative): `chg-GH-179-spec.md` in this folder — read it fully before writing.
Output file: `chg-GH-179-test-plan.md` in this folder.
Format: follow the canonical format of `doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-test-plan.md`.

## Coverage requirements (traceability is the point)

- Every spec AC (AC-L1..AC-L6) maps to at least one TC id; every TC cites its AC(s). Zero uncovered ACs.
- The 8-cell idempotency matrix (spec C-4) each get explicit TC coverage — no-op cells (2, 5) MUST assert zero appended ledger records AND no-op evidence; row 3 asserts a new transition record.
- Rejection classes (spec QA table): unparseable document; each missing required top-level key; wrong-typed top-level value; phase entry missing started/completed; non-timestamp typed value; missing target; unknown variant value — each mapped to its pinned lint.* identity, exit 1, zero ledger records (AC-L1).
- LITE-missing-phase: per pinned LITE phase (6 phases), a fixture omitting exactly that phase fails lint.phases.incomplete naming it, passes once restored (AC-L4).
- Corpus acceptance (AC-L6): lint over the full committed pm-notes corpus → zero failures; pinned as a permanent CI fixture (NFR-4).
- Error-table binding (NFR-5): 5 lint codes round-trip with documented rows; two-directional drift fails; fallback.internal containment; multi-row-kind rule for lint.
- Tier/boundary (NFR-1): contracts data-only; domain pure (no I/O); state tier imports ./contracts only; runtime APIs only in existing driver edge; CLI owns rendering/projection; zero product literals.
- Machine output (NFR-2): envelope validity for every invocation class; --json always valid; exit projection {0,1,2}.
- Determinism (NFR-3): lint verdict drift zero across replays; read-only lint writes zero bytes.
- Storage failures (AC-L5): torn/mismatch registry fixtures → classified state.* identities, never silent zeros.

## Constraints

- Tests are in-process (no spawned processes), deterministic, per .ai/rules/testing-strategy.md and bun:test conventions.
- TC ids: TC-LINT-### for lint/notes, TC-PHASE-### for phase transitions/registry, TC-SYNC-### for error-table sync, TC-BOUND-### for boundaries.
- Include: objective, traceability table (AC→TC), per-TC sections (setup, steps, expected with EXACT pinned identities/codes — no alternative-code oracles), non-vacuity controls, and an implementation-notes section for @coder (fixture location conventions, injection seams: clock/paths via existing CLI deps pattern).
- Fixtures must NOT depend on gitignored local scratch dirs inside the repo (GH-174 CI lesson: seed fixtures via os tmpdir siblings or self-materializing setup).

## Report back

Test-plan path; TC count and AC→TC traceability summary; any spec defects found (if a spec AC is untestable or contradicts another section, STOP and report instead of writing the plan — PM will reopen specification).
