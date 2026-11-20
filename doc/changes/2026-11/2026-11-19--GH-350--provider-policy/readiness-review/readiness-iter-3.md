# Readiness Review — GH-350, iteration 3

- **Work item:** GH-350 (M4-S4 Declarative provider policy — quota, peak, cost routing)
- **Gate:** dor_check
- **Date:** 2026-11-19
- **Verdict:** `READY`
- **Iteration:** 3 of 3, plus a narrow remediation confirmation
- **Artifacts reviewed:** `chg-GH-350-spec.md` v1.3 (31 ACs), `chg-GH-350-test-plan.md` v1.5 (108 cases), `chg-GH-350-plan.yaml` (9 phases, validator green), `chg-GH-350-pm-notes.yaml`, `readiness-review/readiness-iter-1.md` and `-2.md`, TDR-0062 (corrected), TDR-0063, ADR-0013, PDR-0006, TDR-0058..0052

## Iteration-2 adjudication

| # | Verdict |
|---|---|
| D2-1 §7.2 "no edit / stays 26" | REMEDIATED |
| D2-2 spec §18 order | REMEDIATED |
| D2-3 TDR-0062 + spec §2.1 composition truth and mount cost | REMEDIATED (the record and the spec now state that the mount adds membership **and** the six-seam `ProviderComposition` wiring) |
| D2-4 engine/metrics/cli-entrypoint count sentences | REMEDIATED (owned by the phases that move them and pinned by TC-DOC-001/002) |
| D2-5 `.dependency-cruiser.cjs` | REMEDIATED (declared in the two rule phases; the other two promised rules have non-import-graph homes with failing fixtures) |
| D2-6 TC-MOUNT-003 harness | REMEDIATED (temp copy with **every** relative import rewritten; same-machinery control) |
| D2-7 TC-CONFORM-004 maximal evidence | REMEDIATED (chain-park union or constructed object; budget park = 13, peak = 9) |
| D2-8 TDR-0062 C-5 write-set | REMEDIATED (`profile resolve` named as a writer; identity neutrality separated from write behaviour) |
| D2-9 TC-MOUNT-008 owner/comparison | REMEDIATED |
| D2-10 plan header facts | REMEDIATED |
| D2-11 test-plan self-consistency | REMEDIATED |
| D2-12 scope noise / `withExtras()` | REMEDIATED |

## Iteration-3 blocking finding and its resolution

**N-1 — `tests/fixtures/ports/v1-contract-inventory.json` undeclared while phases 1–2 change the contracts export surface.** The two-way inventory pins 60 `provider.ts` and ~2903 `index.ts` exports; `PROVIDER_PEAK_TIMEZONES` occupied two rows (provider module and barrel), so the retirement falsified the fixture and `pnpm check` would have been red at the phase-1 boundary with the fix outside declared scope.

**Resolved:** the fixture and `tests/structure/port-contract-inventory.test.ts` are declared in every phase that changes a contracts export (1, 2, 3, 5, 7) as one edit-set with the export change, named in the multi-phase ownership list, protected by an escalation trigger, and reachable from each phase's gate.

**N-3 — two engine-page restatements unowned.** The announcement-evidence inline enumeration (eleven names → seventeen with the six added names in place) and the Quality Assurance "Bounded evidence" row (8 park fields / 8+3 announcement / 11-field → 14 / 14+3 / 17-field) were not in phase 1's obligation, leaving the page self-contradictory at every boundary.

**Resolved:** both are now in phase 1's one-edit-set obligation with the spread arithmetic stated, phase 9 explicitly does not re-move them, and `TC-DOC-002` pins both as required/stale pairs with a delta control that does not trip the stale direction.

**N-2 / N-4 confirmed** on re-inspection: the mount mutant rewrites every relative import with a same-machinery control; `provider-surface` is declared by no phase and is an unedited control whose arm is re-homed to the phase-3 budget contract suite.

## Regression check

Narrow, clean: plan validates (`verdict=valid`, `readyForDevelopment=true`), 9 phases, 29 escalation triggers, the declared phases are a correct superset of the export-changing set with no previously-required file dropped, and every count is coherent across ticket, spec, test plan and plan — 27 families (26 today), 167 entries and `documentedRows`, 166 delivered-rows metric, `+133`, corpus 84 (59/25), allowlist 66, evidence 14/17, vocabulary 6/8/9/13, watch 6, provider kind 16, 31 ACs, 108 cases.

## Non-blocking observations recorded for follow-up

- **A — doctor's wiring-neutral cause set.** `feature-doctor.md` and the engine page say "the five wiring-neutral causes"; GH-350 adds the park cause `budget-exhausted`, and `DOCTOR_WIRING_NEUTRAL_CONDITIONS` is a closed five-tuple. Doctor is not composed in the production binary, no AC or test in this change claims doctor's park classification, and the page's sentence remains literally true. Recommended disposition before doctor is mounted: extend the tuple to six with the engine-page sentence, doctor tests and both pages in a declared phase.
- **B —** `TC-DOC-002`'s Contract/Pages cells still say "five named vocabulary sentences" while its Action pins seven; the Action is complete, the label lags.

## Verdict

`VERDICT: READY` — iteration 3, remediation confirmed. Blocking findings: none.
