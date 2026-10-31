# Review Iteration 1

Verdict: PASS
Work Item: GH-177 (M0-S8: verify change and exit taxonomy)
Date: 2026-10-31T07:32:44Z
Reviewer: @reviewer (local mode, first iteration)
Reviewed range: `origin/main-tools` (77119b9) … HEAD (253e9f0) on `feat/GH-177/verify-change-exit-taxonomy` (8 commits)
Inputs: spec v1.2, test plan v1.1 (21 TCs), plan v1.1 (PIN-1..7, D1..D12, 10 phases / 44 tasks), evidence artifact, pm-notes, readiness-review (iter-1 NOT_READY closed, iter-2 READY), TDR-0005 (Proposed)

Gate result: **PASS** — 0 blocker, 0 major, 2 minor (low), 2 info. All minors/infos
are non-blocking advisories (PM finalization bookkeeping + optional follow-up
hardening). Phase 8 code remediation is **not required**; advance to quality_gates /
dod_check / pr_creation.

## Facet Summary

| Dimension | Result |
|---|---|
| A. Spec compliance — AC-V1..V14 | PASS (each re-verified against delivered tests below; not taken from the coder's report) |
| A. Spec compliance — NFR-1..NFR-7 | PASS (every gate re-run by this review; thresholds reproduced) |
| A. Spec compliance — scope (NG-1..NG-8, C-1..C-8) | PASS (no protected path touched; no mutation/network/spawn surface; additive-only; delivered surface matches C-1..C-8 exactly) |
| A. Plan compliance — Phases 1–6, 9 | PASS (per-phase commits match completion signals; deviations 1–5 verified additive and documented) |
| A. Plan compliance — bookkeeping | PASS with minor F-1 (execution log/tasks never ticked) |
| A. Test plan — 21 TCs at pinned locations | PASS (all suites present, non-vacuous, green on re-run) |
| A. Evidence honesty | PASS (re-ran the battery; numbers reproduce exactly, incl. `pnpm check` 1106/1106 and sync entries=27 documented=27) |
| B. Correctness / edge cases | PASS with info F-4 (one unpinned identity corner) |
| B. Maintainability | PASS with minor F-2 (duplicated fold semantics) |
| B. Read-only / determinism | PASS (throwing mutation seams, digests, byte-identical replays, ambient/boundary gates — verified in source) |
| B. Tier / import / brand / exit-literal boundaries | PASS (depcruise 95 modules clean; `commands/verify.ts` not a state consumer; projection module sole exit owner; no brand literal) |
| Repo rules | PASS (AGENTS.md branch model, kebab-case, changeset for fixed group, `ados_distribution` markers, error-table two-way sync) |

## Verification Evidence (independently re-run at this gate)

1. `bun test` focused behaviour batch (classification, rejections, state, envelope,
   corpus) → **77 pass / 0 fail**, 1933 expects.
2. `bun test` focused structure batch (delivery-result-contract, verify-imports,
   error-table, error-table-sync, cli-edge-seam, state-scope, content-inventory) →
   **123 pass / 0 fail**, 1317 expects.
3. `bun test tests/boundaries` → **126 pass / 0 fail** (dependency-cruiser rule set
   and runtime allowlist pinned against pre-change sets).
4. Invariant checks → all exit 0: `error-table-sync` (`entries=27 documented=27
   S1=41 S3=14 corpus=13`), `ambient-globals`, `forbidden-literals`,
   `exit-code-literals` (projection module remains the only exit-digit owner),
   `workspace-entrypoints`.
5. `pnpm check` → exit 0: **1106 pass / 0 fail**, 9070 expects, 105 files; depcruise
   95 modules / 161 dependencies, secret-read-boundary, exports-parity green.
6. `bash scripts/.tests/test-doc-distribution.sh` → exit 0; `git diff --check` →
   clean. Working tree after all runs: only the pre-existing PM pm-notes edit — the
   suites write nothing.
7. Source-level audits (not just green ticks): overlay fixtures built through real
   `appendPhaseTransition` with contradicting derived projections (P1/P2) and
   directional controls that would fail declaration-only, registry-required, and
   projection-reading implementations; absent per-change record distinguished from
   corrupt payload in `readChangeTransitionsTolerant`; grammar rejections proven
   zero-read with a live-recorder positive control; bash usage-enum extraction
   fail-closed on missing/mutated reference; `DELIVERY_RESULT_TOKENS` equals the
   `scripts/deliver-ticket.sh:2322` enum in set and order; `state-unverified` is the
   only exit divergence (→ 2, per TDR-0005/DEC-5); corpus digests + `git status`
   guarded, read in place.

## Findings

None blocking. Full detail in [`../code-review/review-iter-1.yaml`](../code-review/review-iter-1.yaml).

- **F-1 (minor, plan-compliance)** — `chg-GH-177-plan.md` execution log and task
  checkboxes never updated (Phases 1–6 + 9 done and evidenced elsewhere).
  Fix at Phase 10.2 bookkeeping.
- **F-2 (minor, maintainability)** — `domain/verify-change.ts` `foldTransitions`
  duplicates `foldPhaseState` semantics (tier rules prevent reuse); identical today
  (operation set total over `complete|reopen`), but no equivalence oracle is wired
  (`foldedState` helper unused). Optional: add an equivalence test or consolidate
  the pure fold later.
- **F-3 (info)** — corpus suite spawns `git status` for the clean-tree assertion;
  test-plan §4.1's "no child process" intent (in-process CLI) holds. Comment optional.
- **F-4 (info)** — absent-key + registry complete-then-reopen classifies
  `verify.ledger.incomplete` (defensible per C-7 "absent after the registry
  overlay"); unpinned corner. Optional fixture before M0-S9.

## Residual risks / advisories for the PR

- **TDR-0005 is Proposed** — the `state-unverified` → exit `2` divergence from bash
  needs owner ratification at PR review (already flagged in the evidence artifact).
- **PIN-1..PIN-7** are delivery-bound spellings the owner may amend at review.
- The bash enum binding fails closed if `scripts/deliver-ticket.sh` moves — a
  deliberate STOP, never a test weakening (A-T8/GAP-5).
- Dual-run (M1-S9) compares tokens, not exits; the single numeric divergence is
  documented in C-5/TDR-0005.

Next step: PROCEED — Phase 8 not required (record it not-required backed by this
PASS); continue to quality_gates → dod_check (close F-1 there) → pr_creation
(PR targets `main-tools`; no merge by PM).
