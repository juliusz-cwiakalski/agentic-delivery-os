# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-381
Date: 2026-11-22
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: 0 critical, 1 major, 1 minor, 3 nit. One blocking root cause (finding 1), with one consequential sync (finding 2). No pause flag.

## Findings

1. [major] test_traceability — chg-GH-381-test-plan.md §3.1 (series-state claim and both coverage tables), §5.1 (scenario index + TC-REF-006 detail), §7 (automation mapping); consequential in chg-GH-381-plan.yaml phase 3 TC-ownership comment
   Gap: The plan asserts "TC-REF stands at 005 as of authoring" and assigns TC-REF-006 to the new provider-resolution case. Repo truth: the TC-REF series is a delivered cross-suite series already at 006 — `tests/structure/reference-behavior.test.ts` header declares "TC-REF-001..006" and implements `describe` blocks for TC-REF-001 (L488), 002 (L511), 003 (L559), 004 (L574), 005 (L591), and 006 (L613, "mapping documentation agrees with the seed"), with TC-REF-001/003/004 also used in `tests/checks/provider-budget-ref-cli.test.ts` and `provider-simulate-cli.test.ts`. TC-REF-005 is itself already duplicated across suites (reference-behavior.test.ts:591 vs provider-budget-ref.test.ts:233), so the "per-suite series" reading is untenable. The assigned TC-REF-006 therefore names a delivered, unrelated case; the series-state claim is factually false; and the AC-F4-2 traceability row maps to an ambiguous id.
   Why it matters: the test plan's core claim is unambiguous AC→TC traceability with "no orphan cases"; a colliding id breaks the provider-resolution proof's mapping, the plan's TC-ownership accounting, and future id allocation, and would leave two different `describe("TC-REF-006 …")` blocks in the delivered tree.
   Suggested remediation target phase: test_planning
   Suggested fix: renumber the new case to TC-REF-007 (free; delivered max is 006) in §3.1 (series sentence — corrected to "TC-REF stands at 006" — plus both tables), §5.1 (index row and detail heading/body), §7 (automation mapping row); sweep §2/§8 for stragglers. For calibration: the TC-TELEMETRY (max 039, 040–047 free) and TC-METRICS (max 112, 113 free) claims were audited and are correct.

2. [minor] cross_artifact_consistency — chg-GH-381-plan.yaml phase 3, `# TC ownership: TC-REF-006, TC-METRICS-113` comment
   Gap: repeats the colliding TC-REF-006 id from the test plan; after finding 1's renumber the two artifacts would disagree on the provider case's id.
   Why it matters: the plan and test plan must name the same case id or the DoD/plan-coverage accounting drifts — the exact cross-artifact consequence of finding 1.
   Suggested remediation target phase: delivery_planning
   Suggested fix: one-line sync of the phase-3 TC-ownership comment to the renumbered id; no scope, summary, or phase-structure change.

3. [nit] system_spec_consistency — chg-GH-381-spec.md §11 RSK-5
   Gap: RSK-5 says the reading bases "keep implying that any prefix hit outside the requested ref is damage"; the current docs are silent on foreign keys rather than affirming the old rule (feature-telemetry-v2.md §5/§5.1 describe fold bases and consumers, not the tear rule; feature-spend.md L210 degradation table and L241 seam-map sentence omit any per-ref statement; feature-state-layer.md L88 "Reads validate every owned record" is already compatible with the corrected rule).
   Why it matters: precise risk wording keeps the phase-7 scope honest — reconciliation adds the per-ref projection sentence; it does not overturn a stated contradiction.
   Suggested remediation target phase: specification
   Suggested fix: optionally reword RSK-5 to "omit the per-ref projection rule, leaving the delivered read's behavior as the de-facto contract". Non-blocking.

4. [nit] cross_artifact_consistency — chg-GH-381-test-plan.md §5.1 TC-REF-006 (post-renumber TC-REF-007) FX-7 precondition vs spec §7.1 fixture scope
   Gap: FX-7 seeds "steps, baselines, and the delivered v1 session records for both" refs — no capture-outcome records — while spec §7.1 scopes the interleaved fixtures with capture families per ref. AC-F4-2 requires only "a fixture ledger holding two refs' telemetry families", which FX-7 satisfies.
   Why it matters: a reconciler sees an apparent shortfall against §7.1; materially immaterial because the capture-outcome branch is ref-scoped by its ref-bearing prefix (verified in source) and cannot hit a foreign record.
   Suggested remediation target phase: test_planning
   Suggested fix: either add one capture-outcome record per ref to FX-7 or state the subset is deliberate because the capture branch cannot tear on foreign records. Non-blocking.

5. [nit] spec_completeness — chg-GH-381-spec.md §5.1 F-2 table / Appendix C
   Gap: for a degenerate empty `workItemRef`, the requested-key row and the bare-prefix row both match (the requested key IS the bare prefix), leaving success-vs-torn ambiguous; RSK-1 calls the table "exhaustive". No CLI path produces an empty ref.
   Why it matters: the table is the normative implementer rule; an unhandled degenerate row slightly overstates its exhaustiveness.
   Suggested remediation target phase: specification
   Suggested fix: add a sentence fixing row precedence (requested-key equality evaluated first, as delivered) or declaring the empty-ref request out of scope. Non-blocking.

## Verification Evidence (what was cross-checked)

- Source seams confirmed: `packages/core/src/state/telemetry.ts` `readTelemetryFamilies` — one verified pass over `store.readRecords()`; step branch `startsWith(TELEMETRY_STEP_KEY_PREFIX)` → `key !== stepKey || kind !== TELEMETRY_STEP_RECORD_KIND` → `torn(location)` (~L709–711); identical baseline branch (~L718–723); session branch exact-key match; capture branch ref-scoped by `capturePrefix = HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX + ref + ":"` — matches spec §2.1, Appendix C, DEC-3, and the owner comment. `packages/core/src/state/economics.ts` `readEconomicsRecords` loop opens with `if (record.key !== key) continue;` — the cited precedent is real. `packages/core/src/state/spend-reads.ts` exists (declared intentionally out of scope in plan phase 2).
- Plan validator re-run independently: `jaiship plan validate GH-381` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`. `kind: planning` is a legal phase kind (`packages/core/src/domain/plan-validate.ts` L323), so phase 4's declaration-only doc phase is schema-legal.
- Referenced files exist: `tests/behaviour/telemetry-storage-damage.test.ts` (TC-TELEMETRY-012, `expectTorn`, `appendRaw` via `withinFence` — the raw-append-in-fence seeding technique the FX-3/FX-4 assumptions rely on is delivered as claimed), `telemetry-storage-coexistence`, `spend-v2-fold-basis`, `spend-store-damage`, `metrics-store-damage`, `status-spend-section`, `provider-budget-ref.test.ts` (TC-REF-005 harness), `metrics-dispatch.test.ts`, `tests/checks/telemetry-hermetic.test.ts`, `tests/structure/error-table.test.ts` + `telemetry-contract.test.ts` (NFR-4 vocabulary pinning), `tests/fixtures/telemetry/index.ts` (exports `appendHarnessTelemetry`), `tests/fixtures/state/harness.ts`; new suite name `tests/behaviour/telemetry-foreign-ref-skip.test.ts` is unused. Doc targets exist: feature-telemetry-v2.md (with §5/§5.1/§7), feature-spend.md, feature-metrics.md, feature-state-layer.md, feature-status-digest.md. `.changeset/` has gh-*-minor.md precedent; `bunfig.toml` confirms fixtures not named `*.test.ts` are not test-discovered (the phase-1 golden files are safe).
- Decision baseline: `doc/decisions/00-index.md` max is TDR-0075 (TDR-0076+ absent) — pm-notes claim verified; no decision record planned (NG-7/DEC-4) with a recorded escalation trigger — correct routing (change-level decision in change docs; no contract change).
- Binding owner constraints — all honored across artifacts: no ledger mutation on any path (NG-1/G-6/DM-4; TC-TELEMETRY-045 byte-equality); single verified pass preserved (F-5/NFR-1/TC-TELEMETRY-045, structural call-count proof, ≥4,800-record scale); fixtures interleave two refs with the FOREIGN family first (FX-2/TC-TELEMETRY-041 = the record-3786 shape; FX-1 both directions; one-ref-fixture rationale stated); bare-prefix tear for BOTH families at the correct position (TC-TELEMETRY-042 step + baseline + absent-ref arm); requested-ref kind mismatch still tears (TC-TELEMETRY-043, plus payload arm); foreign keys skipped without kind/payload inspection (TC-TELEMETRY-044 wrong-kind + garbage-payload foreign records; DEC-2 jurisdiction boundary proven both directions); FX-5 golden captured from delivered behavior BEFORE the branch edit (plan phase 1 binding ordering constraint, capture entry named pre-fix, deliberately outside phase 2 scope); no doc edits in delivery phases (NG-8; phase-7 scope declared in plan phase 4 exactly matching spec §22's four files); no decision record planned; lockstep patch changeset for @delivery-os/core included (plan phase 3 `.changeset/gh-381-telemetry-foreign-ref-skip-patch.md`, matching `version_impact: patch`).
- Ticket traceability: all five ticket AC fixtures map one-to-one via spec Appendix B (AC-1→AC-F1-1, AC-2→AC-F2-1, AC-3→AC-F3-1, AC-4→AC-F4-1, AC-5→AC-F4-2) and required behavior 5 + the single-ref invariant → AC-F5-1/AC-F6-1/AC-NFR2-1; every spec AC has ≥1 owned TC in the plan (phase 2: TC-TELEMETRY-040…047; phase 3: TC-REF-006/007, TC-METRICS-113); required behaviors 1–5 map to F-1…F-5; delivery conventions land in spec §18 and pm-notes.
- Idempotency: iteration 1; no prior readiness records existed; nothing deduplicated.

## Gate Result

NOT_READY. Delivery is blocked until the test plan renumbers the new provider case off the delivered TC-REF-006 id (finding 1, test_planning) and the plan phase-3 TC-ownership comment is synced (finding 2, delivery_planning). Findings 3–5 are non-blocking nits and do not gate. After remediation, re-run this gate (iteration 2); the expected outcome is READY with the remaining nits optionally addressed.
