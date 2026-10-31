# Delegation brief: @spec-writer → chg-GH-179-spec.md (specification iteration 3)

workItemRef: GH-179 — "M0-S10: pm-notes and registry lint, and phase transitions"
Output file: `doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-spec.md`
Format: follow the canonical format of `doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-spec.md`.

## Problem

Phase state (pm-notes) and the delivery registry are written by agents with no schema conformance enforcement, and phase transitions have no single idempotent write path — so the ledger every verification reads (M0-S8 verify change, GH-177, delivered AFTER this story) can be malformed, inconsistent across variants, or silently torn.

## Goals (ticket intent, verbatim)

1. Schema and format conformance checks at write time for pm-notes and the delivery registry — surfaced as `ados lint`.
2. Error on parse failure (classified, never a crash); key-set assertions.
3. The pm-notes schema declares the change variant (full eleven-phase or LITE compressed set); lint validates the declared variant's required phases.
4. `ados phase` (`phase list <ref>`, `phase complete <ref> <phase>`, `phase reopen <ref> <phase> <reason>` — reason REQUIRED) as the ONLY write path for phase state; schema-validated and idempotent transitions.
5. The ledger read by verify change is safe.

## Acceptance criteria (machine-checkable, from ticket)

- Malformed notes are rejected at write.
- Transitions are idempotent.
- A reopen without a reason is rejected.
- A LITE declaration missing one of its required phases fails lint.
- The ledger read by verify change is safe.

## Scope boundaries

- IN: pm-notes schema + validation; delivery registry (schema-checked write path over the GH-174 state layer); `ados lint` command; `ados phase` command family; error-table rows for the new failure identities (ship in-change per GH-174 precedent).
- OUT (non-goals): M0-S8 verify change itself (GH-177); agent-side adoption changes to `.opencode/` prompts (operating model note only); registry expansion to retro/ceremony artifacts (M1-S2).

## PM decisions (adopt; flag disagreement in the spec's open questions)

- **D1 — fixed per-variant required phase sets.** Full = the canonical 11 phases from `doc/guides/change-lifecycle.md` (clarify_scope, specification, test_planning, delivery_planning, dor_check, delivery, system_spec_update, review_fix, quality_gates, dod_check, pr_creation). LITE = a compressed set THIS SPEC pins (you propose membership from the lifecycle guide; reversible schema constant; owner may amend at PR review).
- **D2 — the schema MUST accept the real corpus.** De-facto shape: `doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-pm-notes.yaml` — top-level `change_id/title/milestone/story_code/delivery_mode/phases` (map phase → `{started, completed, ...free-form extras}`) `/decisions[]/open_questions[]/blockers[]/notes[]` (text/type/date). Free-form extra keys on phase entries are legitimate (`commits`, `verdict`, `url`, `evidence`, extra phases like `ci_remediation`). Lint asserts parseability + required-key presence + types + variant/required-phase conformance — NOT a closed key set. "Reject malformed" and "accept real files" must both hold.
- **D3 — delivery registry = the state-layer store** (first consumer of GH-174); registry records are schema-versioned ledger records via the state port. Pin the minimal record kinds needed here (phase-transition records at minimum).

## Grounding (read before writing)

- Ticket: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/179 (= backlog M0-S10 verbatim)
- `doc/planning/oss-tooling/backlog.md` lines 238-254; `backlog-ranking.md` line 34 (position 6, before verify change)
- `doc/planning/oss-tooling/cli-command-registry.md` — `ados lint` + `ados phase` rows (delivery M0-S10); TERMINOLOGY (lint = document conformance; verify = evidence against reality)
- `doc/spec/features/feature-state-layer.md` (store port you build on)
- `doc/spec/features/feature-result-contract.md` (envelope, error table, classification chain; new rows additive; documented-table sync check binding BOTH directions)
- `doc/spec/features/feature-monorepo-scaffold-toolchain.md` + ADR-0003 (tier rules: contracts = types + as-const data only; state tier imports ./contracts only; runtime APIs only in state driver edge; CLI owns rendering/exit projection)
- `packages/core/src/contracts/error-table.ts`, `packages/core/src/state/*`, `packages/cli/src/*` (config command = command-registration precedent)
- `doc/guides/change-lifecycle.md` (11 canonical phases)
- Branding seam: no product-name literals; binary name via injected brand.

## Constraints

- Strict TS per `.ai/rules/typescript.md`.
- Error identity via the classification chain; new domain kind or rows under existing kinds — your call, pin it and document it.
- `--json` machine output via the CommandResult envelope, always.
- `ados lint` validates named targets (a change ref's pm-notes and/or the registry) AND is invoked by the write path (`ados phase`) before any mutation lands — write-time checking is the point of the story.
- Pin idempotent semantics precisely: complete on already-complete = no-op success with evidence (not an error); define reopen-on-open-phase, complete-on-reopened-phase, and out-of-order completion behavior explicitly.

## Required spec sections

Problem, goals, non-goals, ACs (each with a DoD-checkable predicate), capabilities, NFRs, architecture/codebase map, QA strategy, risks.

## Report back

Spec path; AC list (ids + one-line each); pinned LITE phase set + rationale; error-table additions; any unresolved open questions.
