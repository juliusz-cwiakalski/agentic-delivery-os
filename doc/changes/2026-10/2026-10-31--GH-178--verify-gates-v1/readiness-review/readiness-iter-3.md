# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-178
Date: 2026-10-31
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-2 Finding Closure

1. **Closed** — the CI matched-detail 404 rule is now one rule for `ci-green`/`push-parity`/`squash-preflight`: F-3 (line 173), the Section 8.3 read-failure table (line 336), AC-F3-5/AC-F5-4/AC-F7-2, TC-VGATES-061/067, and plan 4.3/4.4. OQ-T4 is removed from the plan and rewritten to the non-404 list/detail-head case in the test plan.
2. **Closed** — a check-run 404 is source outcome `absent` with gate `unknown` `read-failed`, never `failed`/`ci-no-runs`, in F-3/F-8/DM-14/Section 8.3/AC-F3-6/AC-F11-1 and TC-VGATES-039/061/068; plan 4.3.
3. **Closed** — the new pure domain symbols are re-exported additively from `packages/core/src/index.ts` and imported from `@delivery-os/core`; Section 8.5/16, AC-F13-1, plan 4.9, TC-VGATES-069.
4. **Closed** — TC-VGATES-013 now spies on the structured `EvaluateVerifyChange` and asserts no `classifyVerifyChange` dependency; the wrapper assertion stays in TC-VGATES-062.
5. **Closed** — plain `verify` and a wrong subcommand are handler grammar (`input.value.rejected`); only a third positional or an unknown flag is `fallback.invocation` (TC-VGATES-008).
6. **Closed** — the stale plan OQ-T4 was removed and the resolved detail-404 rule recorded; the test plan OQ-T4 now covers only the successful-detail/no-head-SHA case.
7. **Closed** — the combined runtime seam is explicit: `VerifyCommandRuntime.gates?`, first-positional dispatch in `createVerifyCommandDefinition`, one `ConfigProgramOptions.verify` option, edge composition; F-1/Section 8.5/DEC-20, AC-F1-1, plan 5.1/5.3/5.7, TC-VGATES-069.
8. **Closed** — DM-15 pins every outcome's fields (classified arrays/counts/registry evidence; terminal failure empty arrays/zero counts/`registry.present: false`; `failed`→`fail`, `state-unverified`→`unknown`); plan 4.1/4.2 and TC-VGATES-062.
9. **Closed** — CI denominators are declared in DM-11/Appendix F and AC-F3-1/AC-F3-3: `expected`/`missing` over the expected set, `runs` observed, one state bucket per run, unrecognized state cannot pass; TC-VGATES-018/019/022/070 and plan 4.3.
10. **Partially persistent** — the empty `squash-signals` representation is pinned, but the detail-404/failed-detail path still contradicts the empty-count/`not-attempted` rule. See Finding 1.
11. **Closed** — `failureClass` is the closed union `provider.payload.invalid`/`provider.not-found`; error-table codes use `failureCode` (F-8/DM-5, plan 1.1/4.7, TC-VGATES-040/041).
12. **Closed** — the no-live guard file is named: `tests/fixtures/verify-gates/cases/network-guard.ts` with `createNoNetworkGuard()` (test plan 1.2/4.1/6.2/6.3, plan 6.4, TC-VGATES-059).
13. **Closed for Phase 1/2** — the omitted structure/provider test files are now in the phase file lists. Generic phase-file wording remains in Phases 5/6 (nit; tasks name the files).

## Findings

1. [critical] cross_artifact_consistency / spec_completeness / ac_quality — `chg-GH-178-spec.md` F-7 (line 177), F-8 (line 178), DM-5 (line 269), DM-11 (line 275), AC-F8-1 (line 589), Appendix D (lines 791–792); `chg-GH-178-test-plan.md` TC-VGATES-039 step 3 (line 1322), TC-VGATES-040 steps 3–4 and Expected Outcome (lines 1350–1357), TC-VGATES-061 step 2 (line 1904), TC-VGATES-067 step 3 (line 2071); `chg-GH-178-plan.md` task 4.5 (line 269)
   Gap: On a matched PR-detail 404, and on a non-404 failed detail read, the squash citation is required to carry an empty `squash-signals` list (F-7/DM-11/TC-067/TC-039). F-8, DM-5, and AC-F8-1 simultaneously require `counts` and `names` to be empty only when the prerequisite read was **not attempted** and the source outcome is `not-attempted`; a detail 404 is `absent` and a failed detail read is `failed`. The only squash counts declared by DM-11 are `commits`/`changedFiles`, both sourced from the absent/failed detail, and DM-7 forbids aliasing absent counts to zero. The squash citation therefore has no valid counts and no valid names, so AC-F8-1 is unsatisfiable on the detail-404/failed-detail path; TC-VGATES-040's "at least one declared count or name list" assertion would fail while TC-VGATES-067/TC-039 assert the empty list and the `absent`/`failed` source. Appendix D compounds the contradiction by saying an empty `squash-signals` list implies the detail source is `not-attempted` (or a resolution failure), which a detail 404 is not. This is iteration-2 Finding 10 only partially closed on the newly added detail-404 path.
   Suggested remediation target phase: specification
   Suggested fix: Either allow `counts`/`names` to be empty when the dependent source outcome is `absent` or `failed` (with the reason naming it), or declare a list-derived squash count (for example `openCount`/`matchCount`) that remains available on a detail 404. Update F-8, DM-5, DM-11, AC-F8-1, Appendix D, TC-VGATES-039/040/061/067, and the plan's 4.5 citation wording to one rule; also pin the owner work-item 404 and CI check-run 404 count shape under the same rule.

2. [major] plan_coverage / cross_artifact_consistency — `chg-GH-178-plan.md` Phase 1.3 (line 167), Phase 1 Files (line 180), Phase 1 Tests (lines 185–188), Phase 6.5 (line 358), Test Scenarios TC-VGATES-047 (line 568); `tests/checks/error-table-sync.test.ts` (frozen baseline at lines 919–929)
   Gap: Phase 1.3 adds the two `verify` rows, but `tests/checks/error-table-sync.test.ts` freezes the old table and asserts `live.length === BASELINE_ROWS.length + 1` and exactly one `verify` row. The plan's scenario table assigns TC-VGATES-047 to Phase 1, yet Phase 1 never lists or runs the sync test and only Phase 6.5 extends it. The committed binding suite therefore goes red as soon as Phase 1.3 lands and stays red through Phases 2–5, contradicting the plan's "no half-added identity / no broken intermediate state" sequencing guard.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `tests/checks/error-table-sync.test.ts` to Phase 1's Files and Tests and update its frozen baseline plus the single-`verify`-row assertion in task 1.3/1.4, alongside the machine and documented rows; keep the additional mutation/negative controls in Phase 6.5.

3. [major] plan_coverage / plan sequencing — `chg-GH-178-plan.md` task 4.10 (line 274), Phase 4 Tests (line 299), Test Scenarios TC-VGATES-044 (line 565) and TC-VGATES-046 (line 567), Phase 5.6 (line 320); `chg-GH-178-test-plan.md` TC-VGATES-042/043/044/046 (lines 1385–1511)
   Gap: Phase 4.10 creates and runs `tests/behaviour/verify-gates-output.test.ts` and its AC/TC list includes `TC-VGATES-035..046`, including TC-VGATES-044 (machine success envelope, `assertEnvelopeContract`, `--json`) and TC-VGATES-046 (CLI exit/failure-identity matrix), which cannot pass until the `verify gates` CLI surface lands in Phase 5. The plan's own Test Scenarios table assigns TC-VGATES-044 and TC-VGATES-046 to phases 5–6, and Phase 5.6 owns the machine-envelope/failure-exclusivity assertions. The Phase 4 focused command would either fail or force CLI tests before their subject, violating the plan's sequencing guard.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Split the output suite explicitly — Phase 4.10 keeps only the pure renderer/overall-derivation assertions (TC-VGATES-042's summary grammar plus 043/045), and TC-VGATES-044/046 and the envelope parts of TC-VGATES-042 move to Phase 5.6 — then correct task 4.10's AC/TC list and Phase 4 Tests accordingly.

4. [minor] ac_quality / test_traceability — `chg-GH-178-spec.md` F-10 (line 180) and AC-F10-3 (line 596); `chg-GH-178-plan.md` task 5.4 (line 318); `chg-GH-178-test-plan.md` TC-VGATES-063 (lines 1958–1965); `packages/cli/src/index.ts` (lines 279–281); `packages/cli/src/output/serialize.ts` (lines 80–85)
   Gap: `verify change` human output is claimed byte-identical, but the chosen `humanText` path changes redaction order. The delivered output redacts the data object and then serializes (`humanJson`); the new hook serializes the data and then redacts the resulting string. With a registered secret whose raw form differs from its JSON-escaped form (or a secret spanning JSON syntax), the bytes can differ. TC-VGATES-063's golden uses fixed brand/clock/runId but no planted secret, so the byte-equality claim is not exercised under the redaction chokepoint.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a planted-secret `verify change` byte-equality control to TC-VGATES-063 (or prove and state redaction-order equivalence for the verify-change data shape); if equivalence cannot be proven, return a pre-redacted JSON string from the `change` branch or redact the data before serialization.

5. [nit] cross_artifact_consistency — `chg-GH-178-plan.md` Test Scenarios TC-VGATES-013 (line 534), TC-VGATES-015 (line 536), TC-VGATES-039 (line 560), TC-VGATES-054 (line 575); matching `Related IDs` in `chg-GH-178-test-plan.md` sections TC-VGATES-013/015/039/054
   Gap: Per-TC AC mappings drift: the plan omits AC-F2-4 for TC-VGATES-013/015 (the test plan includes it), omits AC-F7-3 for TC-VGATES-054, and adds AC-F3-5 to TC-VGATES-039 even though TC-VGATES-039 deliberately excludes PR/work-item 404s (owned by 061/067). The forward AC coverage table and the final acceptance trace are complete, so this is reverse-trace hygiene rather than a coverage hole.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Align the plan's per-TC AC column with the test plan's `Related IDs` for those four TCs.

## Adequacy Notes

- Iteration-2 closure is otherwise complete: the CI detail-404 rule, check-run 404 absence, package-root exports, combined verify runtime, DM-15 per-outcome fields, CI denominators, bounded `failureClass`, corrected TC-008/TC-013, the rewritten OQ-T4, and the named `network-guard.ts` are all present and consistent.
- Traceability is numerically complete: the spec defines 36 ACs, the test plan has 36 coverage rows, a 70-row Scenario Index, 70 detailed scenarios, and 70 automation rows, and the plan's scenario map and final acceptance trace contain all 70 TCs and all 36 ACs.
- Non-vacuity, read-only/no-merge/no-new-package/scope discipline, the three ticket negatives (red pipeline, missing job, vacuous green), the expected-job-set read, the shared open-PR resolution rule, the error-row two-way sync, and the current-truth documentation plan are adequate; `pnpm check` remains the binding aggregate.
- System-spec consistency was checked against the delivered code: `packages/core/src/index.ts` is an explicit named-export list with a root `.` entrypoint, `packages/core/package.json` has no `./domain` subpath, `packages/cli/package.json` already admits `@delivery-os/core` root and `@delivery-os/adapters/file`, `packages/cli/src/edge.ts` exposes `ConfigProgramOptions.verify?: VerifyCommandRuntime`, the error table has one `verify` row, the trap catalog requires `tests/fixtures/providers/` references, the CI workflow has 23 uniquely named jobs, and `tests/fixtures/result/no-spawn-guard.ts` exists. No current-truth contradiction was found.
- Decision capture is adequate: DEC-16 (read-specific 404), DEC-17 (structured ledger evaluation), and DEC-20 (combined verify runtime) record the change-level decisions in the spec; no system/precedent decision record or human pause is required.
- Delivery is blocked by Findings 1–3. Findings 4–5 are remediable in the same reopened phases. This is the third DoR iteration; if the same critical citation contradiction persists after the next revision, escalate to the human rather than looping again.
