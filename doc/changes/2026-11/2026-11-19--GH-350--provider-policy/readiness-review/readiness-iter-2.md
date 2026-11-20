# Readiness Review — GH-350, iteration 2

- **Work item:** GH-350 (M4-S4 Declarative provider policy — quota, peak, cost routing)
- **Gate:** dor_check
- **Date:** 2026-11-19
- **Verdict:** `NOT_READY`
- **Iteration:** 2 of 3
- **Artifacts reviewed:** `chg-GH-350-spec.md` v1.2 (31 ACs), `chg-GH-350-test-plan.md` v1.2 (108 cases), `chg-GH-350-plan.yaml` (9 phases, `plan validate` = valid), `chg-GH-350-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, TDR-0061, TDR-0062, ADR-0013, PDR-0006, TDR-0057..0052

## Facet summary

| Facet | Result |
|---|---|
| spec_completeness | PASS |
| ac_quality | PASS |
| plan_coverage | PASS |
| test_traceability | FAIL |
| cross_artifact_consistency | FAIL |
| decision_capture | PASS |
| system_spec_consistency | FAIL |
| plan_doc_update_coverage | FAIL |
| plan_code_area_coverage | FAIL |
| dod_defined | PASS |

## Iteration 1 adjudication

| # | Verdict |
|---|---|
| B1 | REMEDIATED (with new accuracy defect D2-3) |
| B2 | REMEDIATED |
| B3 | REMEDIATED |
| B4 | REMEDIATED |
| B5 | REMEDIATED |
| B6 | REMEDIATED for the three original items; two count sites remain uncovered (D2-4) and one false claim was introduced (D2-3) |
| B7 | REMEDIATED |

## Count integrity

Confirmed against the tree and consistent across all artifacts: families 26 → 27; provider rows 13 → 16; entries/documentedRows 164 → 167; delivered-rows metric 163 → 166; arithmetic `+130` → `+133`; corpus 81 (56/25) → 84 (59/25); allowlist 66 unchanged; park evidence 8 → 14; announcement evidence 11 → 17; condition kinds 5 → 6; park causes 7 → 8; skip reasons 8 → 9; announcement codes 11 → 13; watch conditions 6. Two count sites outside the declared class remain (D2-4).

## Blocking findings

### D2-1 — critical — test plan §7.2 contradicts the mount

The final-but-one §7.2 row says `tests/structure/metrics-mounting.test.ts`, `tests/behaviour/entrypoint-two-bins.test.ts` and `tests/behaviour/entrypoint-composition.test.ts` need "No edit; re-run as controls. The family count stays 26". That contradicts the rows above it, TC-MOUNT-005/006/007, AC-F8-4, and plan phase 8, which declares all three as edited. A coder following it would leave three suites at 26.

**Remediation:** test_planning.

### D2-2 — critical — spec §18 order vs plan phases 5–8

Spec §18 orders "the family mount … then simulation, then migration, then watch freshness"; the plan is simulate → migrate → watch → mount, with the mount's rationale being that it lands after both new members so AC-F8-5 is one seven-member proof. Following the spec would mount at five members and split the criterion.

**Remediation:** specification.

### D2-3 — major — TDR-0061 and spec §2.1 claim the family is already registered/composed

Both assert the family is "registered in the command layer … and composed by the production composer", hence "membership plus a guard, not new wiring". Verified false by execution: `createProductionComposer(...)(brand)` registers 27 commands with `provider` absent (the 27th is `config`), and `production.ts`'s `configured` object has no `provider:` key — `createConfigProgram` registers provider only when `options.provider !== undefined`. Membership alone therefore yields `fallback.internal` for every invocation. Plan phase 8 declares `production.ts` and unconditional registration, so delivery is recoverable, but the binding record that lands in phase 1 understates the mount.

**Remediation:** decision record correction (TDR-0061) + specification §2.1.

### D2-4 — major — engine and metrics page count sites unowned and unasserted

Phase 1 moves skip reasons 8 → 9 and the allowlists 8 → 14 / 11 → 17, but `feature-provider-engine.md` is not declared until P2/P9 and its restatements — "eight skip reasons", "closed eight-value set", "eight-field park allowlist", "eleven-field allowlist", "the five provider-engine error identities" — are named by no obligation and pinned by no phrase. `feature-metrics.md` states "The family-count pins read 24" and "the 24-family mount" as current truth, and no case requires either to become 27. Both can ship behind AC-F8-3's "no page states an outgoing count as current truth".

**Remediation:** test_planning (required/stale directions) + delivery_planning (phase obligations).

## Major findings (non-blocking but to be fixed)

- **D2-5** — `.dependency-cruiser.cjs` is declared by no phase although TC-CONFORM-008 promises four new boundary rules; either declare it or re-home the case.
- **D2-6** — TC-MOUNT-003's mutation seam is unspecified: `selectPromptRequiredProgram` closes over a statically imported constant, so a copy of `prompt-required-commands.ts` alone cannot change selection; the working route is a temp copy of `entrypoint.ts` with rewritten imports and cache-busting, or an injected set.
- **D2-7** — TC-CONFORM-004's "maximal" fixture is described as a budget park, but `timezone` is a peak-writer field, so a real budget park carries 13 fields, not 14; construct the maximal object directly or use a chain park unioning `budget-exhausted` and `peak-window`.
- **D2-8** — TDR-0061 C-5 claims "a provider invocation under the alias writes nothing"; `provider resolve` persists parks and announcements under either bin. Restate as identity-neutrality plus read-only members writing nothing.
- **D2-9** — TC-MOUNT-008 names `provider-mounting.test.ts` as owner while §7.1/§7.3 and the plan name `provider-alias-baseline.test.ts`; the baseline comparison against `git show <capturedFrom>:…` is not named in setup/action.
- **D2-10** — plan header says eight decision records are untracked (only TDR-0061/0054 are) and says the obligation table has 21 rows (it has 22).
- **D2-11** — test plan still says "all 30 acceptance criteria" in one place, omits `OQ-TP-10` from its open list, labels two control-only suites "(extended)", and TDR-0061 §5-B19 says the coverage mutant drops `install` when it drops `merge`.
- **D2-12** — plan scope noise: `exports-parity.test.ts` and `provider-surface.test.ts` do not police the new adapter subpath; `entrypoint-composition.test.ts`'s `withExtras()` still lists `provider` as an extra after the mount.

## Residual open items

`OQ-TP-1`/`SEAM-TP-1`, `OQ-TP-2`/`SPEND-TP-1`, `OQ-TP-8`: non-blocking with concrete substitutes. `OQ-TP-10`/`MOUNT-TP-1`: not blocking on its own, but D2-6 is its weakest link; the case fails by name rather than passing.

## Verdict

`VERDICT: NOT_READY` — iteration 2 — blocking findings: D2-1, D2-2, D2-3, D2-4.

Reopened: `specification`, `test_planning`, `delivery_planning`.
