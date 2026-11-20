# Readiness Review — GH-350, iteration 1

- **Work item:** GH-350 (M4-S4 Declarative provider policy — quota, peak, cost routing)
- **Gate:** dor_check (Definition of Ready)
- **Date:** 2026-11-19
- **Verdict:** `NOT_READY`
- **Iteration:** 1 of 3
- **Artifacts reviewed:** `chg-GH-350-spec.md` v1.1, `chg-GH-350-test-plan.md` v1.1, `chg-GH-350-plan.yaml`, `chg-GH-350-pm-notes.yaml`, ticket #350, decision records ADR-0013 / PDR-0006 / TDR-0059..0064

## Facet summary

| Facet | Result |
|---|---|
| spec_completeness | FAIL |
| ac_quality | FAIL |
| plan_coverage | FAIL |
| test_traceability | FAIL |
| cross_artifact_consistency | FAIL |
| decision_capture | PASS |
| system_spec_consistency | FAIL |
| plan_doc_update_coverage | FAIL |
| plan_code_area_coverage | FAIL |
| dod_defined | PASS |

## Blocking findings

### B1 — critical — the provider family is unreachable in the production composition

`provider` is not mounted in the composed program. `packages/cli/src/entrypoint.ts` composes through `selectPromptRequiredProgram`, which keeps only `PROMPT_REQUIRED_COMMANDS` (26 names); `provider` is absent, `help.ts` has no provider entries, and `coverage.json` has no provider row. Observed on the built binary:

- `jaiship provider --help` → `unknown flag "--help"` (exit 1)
- `jaiship provider quota --json` → `fallback.invocation`, "unexpected argument" (exit 1)
- `jaiship provider parks list --json` → `fallback.invocation` (exit 1)
- `jaiship --help` lists 43 commands, none of them `provider`

Consequences: flows 5, 6 and 8 and the operator claims in AC-F4-1, AC-F5-*, AC-F6-* are false; the ticket's "complete and document `provider resolve|quota|parks|profile|watch`" and "policy simulation for offline verification" are unachievable; the suite stays green because tests drive `createConfigProgram`/`runCli` and never `runEntrypoint`. The spec's claim that the family is one of the twenty-six prompt-required families is also false. `feature-cli-entrypoint.md` is missing from the spec's documentation-obligation table, so the drift would never be reconciled.

**Remediation:** specification (declare the reachability decision and its count movement; add `feature-cli-entrypoint.md`; add a reachability AC) + test_planning (a case through the production composition with a negative control) + delivery_planning (the mounting phase and files).

### B2 — critical — the budget gate's work-item ref source is unspecified

DM-3's `ProviderSpendTotalsPort` takes `{ workItemRef }`, and F-2/Appendix C scope the `ticket` budget to "the ref's beginning", but no artifact states where the production composition obtains that ref. `provider resolve` accepts only `--chain`/`--profile`, the change forbids new environment variables, and the simulate fixture schema has no ref field — so a `ticket` budget cannot be evaluated in production or simulated offline. Tests inject the port, so a green suite can coexist with a gate that has no scope.

**Remediation:** specification (declare the ref source and precedence, the unresolvable-ref behaviour, and the simulate ticket-scope semantics) + test_planning.

### B3 — critical — phases 1 and 2 omit files they must edit

- `tests/fixtures/provider/evidence/park-allowlist.json` and `announcement-allowlist.json` — `provider-evidence-bounds.test.ts` asserts the contract arrays equal these fixtures and `toHaveLength(8)`/`toHaveLength(11)`; phase 1 runs that test but does not declare the fixtures.
- `tests/structure/content-inventory.test.ts` and `tests/structure/inventory.json` — declare the exact per-file export list for `core/src/contracts/provider.ts`, currently including `PROVIDER_PEAK_TIMEZONES`; declared only in later phases.
- `packages/core/src/contracts/index.ts` — the `#contracts` barrel re-exports `PROVIDER_PEAK_TIMEZONES`; new contract names and the retirement cannot land without it; declared in no phase.
- `scripts/checks/ambient-globals.ts` — TC-ZONE-010 requires zero `Intl`/`TZ` references in the provider tier, but neither `BANNED_GLOBALS` nor `BANNED_PROPERTY_ACCESS` contains them, so the required boundary fixture has no rule to fail.
- `tests/golden/provider-parks-list.test.ts` — test plan §7.2 says it gains a budget park and the `timezone` field, and it is in the gate glob, but no phase declares it.

**Remediation:** delivery_planning.

### B4 — major — `documentedRows` is 167 after the change, not 166

`bun run scripts/checks/error-table-sync.ts` reports `entries=164 documented=164` today, and `error-table-sync.test.ts` asserts `documentedRows === sourceEntries`. After three rows both are 167. The 163 → 166 figure is the page's *delivered-rows* metric (entries minus the single `spend` row), a different number. The test plan's expected signal is right (167); its "documentedRows 163 → 166" statement is wrong and would break the delivered equality assertion if followed.

**Remediation:** test_planning.

### B5 — major — evidence-count oracles and a paid-entry contradiction

- TC-BUD-015 describes fourteen as "nine delivered base fields plus `timezone` and the five budget fields" (= 15); the delivered base is eight, and 8 + 1 + 5 = 14.
- TC-ZONE-009 asserts "park evidence has 14 fields" in phase 2, where only `timezone` has a writer and a peak park can never carry the five budget fields; the allowlist size and an emitted object's field count are conflated. TC-CONFORM-004 owns the maximal case.
- AC-F2-3 clause 3 ("when the same chain contains a selectable paid entry, then it is not selected") contradicts F-2, which allows a paid entry when no subscription entry is *parked* for `budget-exhausted`. A ticket-scope crossing is a failed entry, not a park. No case exercises the clause; TC-BUD-010 covers the parked case and TC-BUD-005 selects "a later entry that is eligible" without naming its class.

**Remediation:** test_planning (B5a, B5b) + specification (B5c).

### B6 — major — false current-state claims and an inconsistent documentation page set

- Spec §2.1/§12 claim the engine gate, the profile gate and the daemon watcher share one boundary function today. `daemon-peak-pause.ts` computes the window instant itself from `utcSecondsOfDay`.
- The plan states the provider page is already registered under the M1 root and adds no coverage row; `coverage.json` and `PROMPT_REQUIRED_COMMANDS` contain no `provider`, so TC-CONFORM-006's "coverage and inventory agree in both directions" and its negative control are vacuous.
- The plan's phase 8 adds `doc/planning/oss-tooling/cli-command-registry.md` to the closed page set, but that page is absent from spec §16 and from the test plan's page list, while the M4 pack is in §16 and in phase 8 scope but absent from the test page set.

**Remediation:** specification (correct the current-state claims; add `feature-cli-entrypoint.md` and `cli-command-registry.md` to §16) + test_planning (page set) + delivery_planning (exception text).

### B7 — major — TC-ZONE-008's structural oracle is unsatisfiable as written

"`peakWindowOpenSeconds` and `peakWindowEndSeconds` are the only producers of those instants" cannot be made true: both return seconds-of-day, while the engine computes `expiresAtMs` and the watcher computes `endMsToday` themselves. No artifact declares a named shared expiry derivation.

**Remediation:** test_planning + specification/plan (name the shared expiry function).

## Non-blocking findings

1. TC-WFRESH-001 promises a `layer=defaults` origin for a record-child default (`maxAgeSeconds`); catalog paths stop at record fields, so verify before promising, and phase 7 declares neither `config/resolver.ts` nor `config/defaults.ts`.
2. pm-notes contradicted the plan on where the decision records and the provider reference page land (both corrected after this review).
3. Appendix E says "every mapping is literal-to-literal; no value is computed, concatenated, or inferred", yet one mapping derives a value from another variable and lowercases an agent name.
4. The plan's identity-window note undercounts which rows lack an emitter at phase 1.
5. The test plan's closing note still says the corpus total is plan-owned; spec v1.1 states 84 (59/25).
6. The plan declares a provider member tuple edit in `tests/behaviour/entrypoint-help-coverage.test.ts`; that suite derives its tuples from `allHelpEntries()` and holds no provider tuple, so the edit either has no work or names the wrong file.

## Judgement on the declared open items

- `OQ-TP-1`/`SEAM-TP-1`: not blocking on its own; the cases fail by name.
- `OQ-TP-2`/`SPEND-TP-1`: not blocking; declared, and the ticket clause is "spend attributable", which is delivered.
- `OQ-TP-6`/`VAC-TP-1`: not blocking; the clause should be restated as the implication the plan asserts.
- `OQ-TP-8`: not blocking; the in-process validator plus a composed `config` read is a concrete substitute.
- The ticket/DEC-7 divergence (per-ticket terminal refusal vs "park"): declared and justified; the delivered park invariant forbids a fabricated expiry. The residual problem is B5c, not the divergence.

## Verdict

`VERDICT: NOT_READY` — iteration 1 — blocking findings: B1, B2, B3, B4, B5, B6, B7.

Reopened phases: `specification`, `test_planning`, `delivery_planning`.
