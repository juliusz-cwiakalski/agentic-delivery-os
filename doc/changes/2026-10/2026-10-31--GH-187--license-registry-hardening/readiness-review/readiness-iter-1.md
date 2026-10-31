# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-187
Date: 2026-10-31
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: FAIL

Blocking findings: 4. Non-blocking findings: 6. No override record exists, and none would be available for a behavioral/contract change.

## Blocking Findings

1. [critical] dod_defined — `chg-GH-187-spec.md` §18 (L342-349); `chg-GH-187-plan.md` Phase 8 (L443, L451, L457)
   Gap: The specification defines goals, ACs, and success metrics but no change-specific Definition of Done. §18 is a rollout narrative only. The plan nevertheless requires "a clean DoD check" (L443), "the DoD checklist is complete" (L451), and "the DoD checklist is complete (all ACs; AC-F5-1)" (L457), but no such checklist or DoD predicates exist in the spec. `doc/guides/definition-of-done.md` requires every change to define its own concrete, testable DoD in the spec and says delivery cannot start without it.
   Suggested remediation target phase: specification
   Suggested fix: Add a "Definition of Done predicates" block to spec §18 (or a dedicated section) enumerating the testable end state: all 15 ACs have traceable passing evidence; the live registry validates `[]`; 20/20 baseline identifiers are present; the 18 malformed, 10 spawned, and preserved-compound cases pass; `pnpm check` and the inherited bash suites pass; no lockfile/manifest/workflow/dependency change; no SBOM/notice/checksum/review-date artifact; C-2 owner confirmation recorded on the PR; PR open against `main-tools` with `ts-license-audit` required/green. Then make plan Phase 8 reference that block instead of an undefined checklist.

2. [major] cross_artifact_consistency — `chg-GH-187-plan.md` L194, L238; `chg-GH-187-test-plan.md` L65
   Gap: The live `tests/checks/license-audit.test.ts` contains **13** pre-existing `test(...)` cases (L40-L142), not 12. The plan instructs "the 12 pre-existing tests pass, 0 fail" (L194) and "preserving all 12 existing test titles" (L238). The test plan says "twelve cases" but then lists 13 distinct items (L65). This contradicts TC-LICREG-029 step 1, which reads every pre-change title from `origin/main-tools` and requires all of them to remain (the no-test-removal control). A coder following the plan's stated count could merge or drop one of the 13 to "satisfy" 12 and still believe the task is complete.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Change 12 to 13 in the plan (L194, L238) and in test plan §2 (L65), and state explicitly that all 13 pre-existing titles must remain and pass. Keep TC-LICREG-029's dynamic title check as the authority.

3. [major] decision_capture — `chg-GH-187-spec.md` DEC-3 (L304) and Appendix C (L431-440); `chg-GH-187-plan.md` Phase 6 (L370-401); `doc/decisions/ADR-0003-oss-monorepo-structure.md` C-2 (L175) and license metric (L1202)
   Gap: The spec records a change-scoped decision (DEC-3) that reinterprets ADR-0003 C-2's "fails closed on ... compound expressions" as per-branch evaluation. That interpretation is defensible and matches the live audit and GH-170 behavior, but ADR-0003 remains an authoritative decision record whose C-2 statement and metric still say compound expressions fail closed. Plan Phase 6 reconciles only `doc/spec/features/feature-monorepo-scaffold-toolchain.md`; no ADR-0003 amendment or new decision record is authored or accepted, and no plan task covers it. After delivery the current truth and the ADR will still disagree about the controlling license policy.
   Suggested remediation target phase: specification
   Suggested fix: Route DEC-3 to `@decision-advisor` for an ADR-0003 amendment (or a new decision record) that states the per-branch compound interpretation and updates the C-2 statement and metric wording. Add the authoring/acceptance step and the ADR update to plan Phase 6 (and any `plan_doc_update_coverage` list). Do not leave the ADR contradicted by the delivered behavior.

4. [major] cross_artifact_consistency — `chg-GH-187-test-plan.md` TC-LICREG-013 steps 5 and 7 (L670, L672); `chg-GH-187-plan.md` task 2.2 (L212)
   Gap: TC-LICREG-013 step 5 removes a baseline identifier from `deny_list`, adds it to `allow_list`, sets an approved probe entry to it, and then expects the case to fail with "floor failure plus overlap plus denial". With the identifier removed from `deny_list`, neither overlap nor denial can occur; the only valid failure is the mandatory-floor failure. A test implemented literally would fail. Step 7 also asserts "the count of removal cases is 20", while step 5 adds five adversarial removals on top of the 20 single removals, and plan task 2.2 describes "20 single removals plus 5 adversarial removals" (25 total).
   Suggested remediation target phase: test_planning
   Suggested fix: Correct step 5's expected outcome to the floor failure (or keep the identifier in `deny_list` if overlap/denial is the intended combination), and align the removal-case count (20 vs 25) across TC-LICREG-013, TC-LICREG-024, and plan task 2.2.

## Non-Blocking Findings

5. [major] cross_artifact_consistency — `chg-GH-187-test-plan.md` §7 automation row TC-LICREG-026 (L1245) vs TC-LICREG-026 precondition (L1049) and `chg-GH-187-plan.md` task 3.3 (L254)
   Gap: TC-LICREG-026's precondition lists 13 representatives (denied single, denied branch, unknown reference, non-asserted, empty, unparseable, non-allow-listed, unregistered use, malformed policy, overlap, schema, floor, drift), and plan task 3.3 says "thirteen diagnosability representatives". The test plan's §7 automation mapping says "7 class representatives". A coder following §7 would under-cover NFR-6/spec §10 by six classes, including schema, floor, and drift.
   Suggested remediation target phase: test_planning
   Suggested fix: Align the §7 row to 13 representatives (or explicitly enumerate which 13 and why the narrower set still satisfies §4.2).

6. [minor] cross_artifact_consistency — `chg-GH-187-test-plan.md` TC-LICREG-004 step 1 (L391), TC-LICREG-024 step 2 (L996), TC-LICREG-016 step 1 (L755), expected outcome (L764), GAP-2 (L49), §6.1 (L1189)
   Gap: Summary/detail counts drift in three places: TC-004 lists six schema mutations while TC-024 declares "schema 5"; TC-016 lists 12 values in step 1 but its expected outcome says "13/13" (the 13th is `NONE`, added separately in step 3); GAP-2 says three TCs depend on `origin/main-tools` while §6.1 lists four (including TC-LICREG-029). This repeats the count-drift retro already recorded in `chg-GH-187-pm-notes.yaml` (L65).
   Suggested remediation target phase: test_planning
   Suggested fix: Reconcile each count in the test plan: make schema cases 5 (drop the duplicate "key removed" variant or declare 6 and update TC-024), state TC-016 as 12 listed plus `NONE` = 13, and make GAP-2 say four TCs.

7. [minor] cross_artifact_consistency — `chg-GH-187-spec.md` NG-1 (L86), §7.2 (L179), §7.3 (L194), CON-7 (L207), DEC-7 (L308); `chg-GH-187-test-plan.md` L41; `chg-GH-187-plan.md` L67; backlog M4-S2 (L779-782) and M4-S3 (L787-793); GH-170 DEC-10 (L286)
   Gap: The spec says SBOM, checksums, and notices belong to M4-S3. The backlog assigns "registry provenance and SBOM" to M4-S2 (publication and release automation); M4-S3 is docs, registry completeness, and public materials. GH-170 DEC-10 also explicitly assigned SBOM/notices and per-entry review-date governance to M0-S18, so GH-187's deferral should cite and supersede that prior decision rather than silently reassign it. The deferral itself is defensible for the GH-187 ticket, but the milestone attribution and prior-decision reconciliation are inaccurate.
   Suggested remediation target phase: specification
   Suggested fix: Correct the deferral target to M4-S2 for release-time SBOM/checksums/notices (or split release-artifact ownership from M4-S3 registry completeness), and cite/supersede GH-170 DEC-10 in DEC-7 and the PM notes. Align the repeated M4-S3 references in the test plan and plan.

8. [minor] plan_coverage — `chg-GH-187-plan.md` task 1.2 (L169) and task 1.3 (L170); `chg-GH-187-test-plan.md` §4.1 item 7 (L157); live `scripts/checks/license-audit.ts` L237
   Gap: The current audit rejects an unsupported `scope` together with an unsupported schema (`registry.schema_version !== 2 || registry.scope !== "direct-and-runtime-closure"`). Plan task 1.2 replaces this with a schema-only policy gate and never says to preserve the `scope === "direct-and-runtime-closure"` check; task 1.3's preserve list and test plan §4.1 item 7 omit scope; no TC asserts that a schema-v3 registry with a wrong scope fails. If the coder rewrites the old condition to `schema_version !== 3` only, the gate silently accepts a wrong-scope policy. This is an existing behavior not covered by an AC, so it is an advisory preservation gap rather than a ticket miss.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add a plan task (and a TC-LICREG-001/004 negative case) that keeps the scope check fail-closed for schema 3 and reports the observed scope.

9. [nit] delivery_planning — `chg-GH-187-plan.md` L43-44; `chg-GH-187-test-plan.md` revision log L1330, OQ-T3/OQ-T4 L1321-1322
   Gap: The plan says OQ-T1..OQ-T4 are "resolved as recorded there" (L43) and that the documentation issues are "RESOLVED by test plan v1.1 and spec v1.1" (L44), but the current test plan is v1.2 and OQ-T3/OQ-T4 are explicitly "Non-blocking", not resolved. The plan's own `last_updated` (15:10) predates test plan v1.2 (15:25).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Update the citations to test plan v1.2, say OQ-T1/OQ-T2 resolved and OQ-T3/OQ-T4 non-blocking, and (if desired) note the PM-ledger timestamp reconciliation.

10. [nit] delivery_planning — `chg-GH-187-plan.md` task 1.1 (L168); `chg-GH-187-spec.md` Appendix A (L418); `chg-GH-187-test-plan.md` A-T3 (L1307)
    Gap: Plan task 1.1 says the delivered deny list should contain the 20 Appendix A identifiers "(plus no accidental extras)", while the spec and test plan permit additional valid identifiers without a code change. If "no accidental extras" is read as exactly 20, it conflicts with the extension control (TC-LICREG-013 step 6, TC-LICREG-014 step 1).
    Suggested remediation target phase: delivery_planning
    Suggested fix: Reword to "at least the 20 baseline identifiers; additional valid identifiers are permitted" (or state "exactly 20 for this delivery" and remove the extension expectation, which would contradict the spec).

## Verification Performed

- Loaded the live ticket GH-187 via `gh`: OPEN, labels `change` + `planning`, no assignee/comments; body matches backlog M0-S18 at `doc/planning/oss-tooling/backlog.md` L353-361.
- Verified live repository facts used by the artifacts: `doc/legal/dependency-licenses.yaml` has schema 2, 16 `package:` entries, 20 registered uses, a four-entry allow list (`Apache-2.0`, `BSD-3-Clause`, `ISC`, `MIT`), and no deny list; `doc/legal/` has exactly one file; the live audit still rejects schema/scope and does per-branch compound evaluation; `tests/checks/license-audit.test.ts` has 13 tests; `tests/fixtures/license/cases.json` has the five claimed keys; `ts-license-audit` runs `bun run scripts/checks/license-audit.ts` with `permissions.contents: read`, no timeout, no bypass; `TS_JOBS` has 16 entries and `BASH_JOBS` 7, matching 23 workflow jobs; `package.json` `scripts.check` matches the pinned chain; Bun 1.4.4 and pnpm 10.18.3 match the test-plan environment table; `pnpm-lock.yaml` is ~59 KB as claimed; ADR-0003 C-2 is at L175 and the license metric at L1202; the `doc/spec` license section (L178-180) currently describes the registry/allow list/SPDX parsing without a deny list.
- Checked for prior GH-187 readiness records: none; this is iteration 1.

## Gate Result

**NOT_READY.** The blocking defects are the missing change-specific Definition of Done, the pre-existing test-count error (12 vs 13) that contradicts the no-test-removal control, the uncaptured ADR-0003 C-2 compound interpretation, and the impossible TC-LICREG-013 expected outcome plus its 20-vs-25 removal count. Reopen `specification` (DoD, ADR decision capture, milestone/prior-decision reconciliation), `test_planning` (12→13, TC-LICREG-013, TC-LICREG-026 and other count drift), and `delivery_planning` (plan counts, ADR/doc update, scope preservation, stale citations). Delivery is blocked; no override applies and no human-input pause is required at this gate.
