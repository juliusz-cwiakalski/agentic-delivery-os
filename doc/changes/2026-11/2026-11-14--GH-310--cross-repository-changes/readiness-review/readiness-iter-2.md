# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-310
Date: 2026-11-14
Pause Required: no

Artifacts reviewed (read-only): `chg-GH-310-spec.md` v1.3, `chg-GH-310-test-plan.md` v1.3,
`chg-GH-310-plan.yaml` revision 1.2, `chg-GH-310-pm-notes.yaml`; the recorded pattern in
`readiness-review/readiness-iter-1.md`; source ticket #310; `doc/planning/oss-tooling/milestones/m2/{contracts,architecture,test-scenarios}.md`;
current truth in `doc/spec/features/{feature-plan-schema,feature-verify-gates,feature-closeout,feature-scheduling-engine,feature-project-groups,feature-result-contract}.md`;
and delivered contract shapes in `packages/core/src/contracts/{verify-gates,closeout,plan,projects}.ts` and `packages/cli/src/commands/{verify-gates,verify,queue,closeout}.ts`.
No source, spec, test-plan, plan, or pm-notes file was modified; zero git operations.

## Facet Summary

| Facet | Result |
|---|---|
| spec_completeness | **FAIL** |
| ac_quality | PASS (ACs are clear/testable; the contradicting derivation rules are recorded under cross_artifact_consistency) |
| plan_coverage | PASS (37/37 ACs and 51/51 TCs owned) |
| test_traceability | PASS (37/37 ACs cited; 0 orphan TCs; TC wording issues are under the findings) |
| cross_artifact_consistency | **FAIL** |
| decision_capture | PASS |
| system_spec_consistency | **FAIL** |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | **FAIL** |
| dod_defined | PASS (DoD-1..15; DoD-5/DoD-8 need alignment with N1/N5) |

Requested additional rubric facets:

| Facet | Result |
|---|---|
| scope discipline | PASS (the DEC-18 supersession is now scoped and enumerated; N4/N10 are wording/type residuals) |
| risk coverage | PASS (RSK-10/RSK-11 added) |
| non-goals / supersession clarity | PASS (NG-7/§8.5 scoped; the closeout non-goal retirement is explicit) |
| testability | **FAIL** (N1, N3, N5 mean some cases cannot be authored unambiguously) |
| decision pinning | **FAIL** (N3, N5, N9) |

## Mechanical Verification (current artifacts)

- Spec §17 declares **37 ACs** (`AC-F1-1..AC-NFR7-1`); the test plan cites **37/37** in §3.1 and §5.1.
- Test plan declares **51 TCs**: 51 index rows, 51 detail headings, 51 §7 rows — exact match. §3.4 counts 36 automated + 1 gate-only = 37 ACs.
- Plan has **5 phases**; AC ownership sums to 37 (6 + 7 + 13 + 4 + 7); TC ownership sums to 51 (8 + 9 + 18 + 6 + 10). No AC or TC is unowned or double-owned.
- DM rows **10** (DM-1..DM-10), DEC rows **21**, RSK rows **11**, DoD rows **15**.
- Test-plan §7 suite homes: **38 unique `.test.ts` paths** (47 path references including fixtures/goldens); every one is inside at least one phase's declared scope. The pm-notes "41/41" literal is not reproducible from the §7 table (see N8); no path is missing.
- Ticket AC1–AC4 still map to at least one spec AC (Appendix B); SC-M2-S19-01..05 are inherited by name.

## Iteration-1 Closure Audit

| Finding | Status | Evidence |
|---|---|---|
| **B1** cross-repo `summary`/`gates[]` + member attribution | **Partially closed** | DM-9/F-3 pin one record per (member, gate), `member` discriminator, `summary` counts, single `read-failed` record. **Residual N3**: the synthetic unknown record's required `citation` is undefined. |
| **B2** DEC-18 honest scoped supersession | **Mostly closed** | DEC-18/NG-7/§8.5 now declare `overall` `"pass"`/`"fail"`, data-bearing negative report, `unknown` never emitted, delivered unknown/exit-2 and member-less failure envelope untouched; AC-F3-2/AC-F3-4 use `overall: fail`. **Residual N4**: the "member-less keeps the literal `"pass"` type" claim is not achievable with a widened shared type. **N9**: the `verify.gates.failed` "on data" carrier is unnamed. |
| **B3** every §7 suite home in a phase scope | **Not fully closed** | All §7 paths are in *some* phase scope, but the plan's own "first fully green" ownership still fails: TC-XBOUND-001 is phase-3-owned and its suite `tests/behaviour/cross-repository-determinism.test.ts` is not in phase 3's `scope.files` (only phases 2/4 declare it), while phase 3 obligation 3.6 says to edit it. See N2. |
| **B4** member-less `queue add` golden provenance | **Closed** | `tests/fixtures/queue/golden/queue-add-memberless.json` is declared in phase 1 `scope.files` and obligation 1.0; §6.4 and TC-XPAR-003 name it; capture from `404e9bf8` before production edits; `runId`/`timing` only normalized. |
| **B5** `MemberLandingObservation` | **Closed** | DM-10 names `{repoKey, merged, headSha?, landingPosition?}`; DEC-19/AC-F3-6/AC-NFR6-1 link it; plan 3.2 and TC-XDOD-007/TC-XCTR-006 use it. |
| **B6** `runId` covers PR-less members | **Closed** | DEC-8/DM-7 digest the declared set as `repoKey` + pull-request-or-empty marker; AC-F6-3 explicitly covers a PR-less member; TC-XREV-003 runs A/B/C/D including a PR-less member. |
| Invalid-plan echo | **Closed** | AC-F1-2: invalid verdict carries **no** `members` key; TC-XPLAN-002 asserts it. |
| Gate-id shape | **Closed** | F-1/DEC-9: non-empty string ≤64 chars; TC-XPLAN-005 covers empty/non-string/65-char. |
| `cleanup`/`issueClosure` precedence | **Partially closed** | Precedence is stated, but the member-specific `detail` shape and mode-specific `applied`/`satisfied` are not mechanically pinned (N5). |
| Test plan §2 staleness | **Remains** | §2 still says plan "revision 1.1 exists" and "must be reconciled in delivery_planning"; plan is revision 1.2 and already reconciled (N6). |
| TC-XCLOSE-004 / TC-XPLAN-005 AC linkage | **Closed honestly** | TC-XCLOSE-004 cites AC-NFR4-1 primary + AC-F5-1 supplement; TC-XPLAN-005 cites AC-F1-1/AC-F1-5/AC-F3-7 and marks the no-config assertion a supplement. |
| Phase-5 commit subject | **Remains** | Still `docs(GH-310)` while phase 5 ships test suites and a changeset (N7). |
| RSK-10 / RSK-11 | **Closed** | Both risks are present with mitigations. |

## Blocking Findings

### N1 [critical] cross_artifact_consistency / spec_completeness — member verdict aggregation ignores `gates.ci`, contradicting AC-F3-3/AC-F3-4/AC-F3-5

- Artifact/location: `chg-GH-310-spec.md` §5.1 F-3 (line 118), §8.3 DM-3 (line 220), §17 AC-F3-3/AC-F3-4/AC-F3-5 (lines 383–385); `chg-GH-310-plan.yaml` 3.2 (lines 549–551); `chg-GH-310-test-plan.md` TC-XDOD-003 (line 699).
- Gap: F-3/DM-3/plan 3.2 define a member's verdict as the aggregation of **that member's own gate records** only (`every record pass ⇒ pass; any fail ⇒ fail; otherwise unknown`). `gates.ci` is a separate per-member field, and a member's declared `gates` need not include a CI gate (`gates` is any 1..16 identifiers). If all declared gate records pass while `gates.ci` is `unavailable` or `absent`, the literal rule yields `pass`, directly contradicting AC-F3-3 (`unavailable` ⇒ verdict `unknown`), AC-F3-4 (`absent` ⇒ verdict not `pass`), AC-F3-5 (no cross-member reuse; unavailable ⇒ `unknown`), NFR-5, and RSK-2. TC-XDOD-003 asserts `gates.ci: unavailable` and `verdict: unknown` without requiring a CI gate record, so the test can fail under the literal rule unless the fixture silently includes a CI gate. This is a new contradiction introduced by the B1 remediation.
- Suggested remediation target phase: **specification** (then test_planning, delivery_planning).
- Suggested fix: include `gates.ci` in the verdict rule — e.g. `pass` only when `gates.ci: pass` **and** every record `pass`; `fail` when any record `fail`; otherwise `unknown` — or state that every member's `gates` must include the CI gate. Align DM-3, plan 3.2, AC-F3-3/4/5, and TC-XDOD-003.

### N2 [major] cross_artifact_consistency / plan_code_area_coverage — B3 residual: phase 3 owns TC-XBOUND-001 but its suite is not in phase 3 scope

- Artifact/location: `chg-GH-310-plan.yaml` phase 3 obligation 3.6 (line 608) and phase 3 `scope.files` (lines 94–116); `chg-GH-310-test-plan.md` §7 TC-XBOUND-001 (line 1786); plan TC ownership (phase 3 owns TC-XBOUND-001).
- Gap: the phase 3 obligation says "`tests/behaviour/cross-repository-determinism.test.ts` gate case (TC-XBOUND-001)", but that file appears only in phase 2 and phase 4 `scope.files` (lines 949/1025), not phase 3. This violates the plan's own "the phase where the TC's verdict is first fully green" ownership rule and is a delivery-time scope-drift risk: a phase 3 coder cannot edit the determinism suite it is told to extend. Secondary risk: TC-XQUEUE-003 (phase 2) "extends `tests/behaviour/closeout-queue-removal.test.ts` / `closeout-queue-removal-skips.test.ts`" (phase 4 only), and TC-XCTR-002 (phase 5) "extends `tests/behaviour/plan-readonly.test.ts`" (phase 1) / `verify-gates-read-budget.test.ts` (phase 3); if those "extends" are edits, the owning phase scopes are missing them too.
- Suggested remediation target phase: **delivery_planning** (with test_planning if the "extends" wording is only reuse-of-patterns and should say so).
- Suggested fix: add `tests/behaviour/cross-repository-determinism.test.ts` to phase 3 `scope.files` (or move TC-XBOUND-001 ownership to phase 2/4), and resolve the TC-XQUEUE-003/TC-XCTR-002 "extends" targets the same way.

### N3 [major] spec_completeness / decision_pinning — B1 residual: the synthetic `unknown` gate record's required `citation` is undefined, and TC-XDOD-008 forbids inventing one

- Artifact/location: `chg-GH-310-spec.md` §5.1 F-3 (line 118), §8.3 DM-9 (line 226); `packages/core/src/contracts/verify-gates.ts:303-317` (`VerifyGateRecord.citation` is required, with required `identity.changeRef`); `chg-GH-310-test-plan.md` TC-XDOD-008 step 7 (line 860).
- Gap: DM-9 says each cross-repository `gates[]` record is the delivered `VerifyGateRecord` shape (`id`, `verdict`, `reason`, `citation`) plus `member`. For an unresolvable declared identifier, DM-9 pins `id`, `member`, and the `read-failed` reason but not the required `citation`. The delivered type requires a citation with at least `identity.changeRef` and a citation shape; TC-XDOD-008 step 7 says "no gate record invents a gate id, a reason, or a citation for the unresolved identifier". A coder/test author must invent the synthetic citation sub-shape (or the test contradicts the required field).
- Suggested remediation target phase: **specification** (then test_planning).
- Suggested fix: pin the synthetic record's citation (e.g. empty `sources`/`counts`/`names`, `identity: {changeRef}`, `reasons: ["read-failed"]`) and reword TC-XDOD-008 step 7 to "no fabricated provider citation or name list".

### N4 [major] system_spec_consistency / cross_artifact_consistency — B2 residual: "member-less keeps the literal `"pass"` type" is not achievable with a widened shared type

- Artifact/location: `chg-GH-310-spec.md` §15 DEC-18 (line 332), NG-7 (line 98), §8.5 (line 239); `chg-GH-310-plan.yaml` 3.1 (lines 519–520); delivered `VerifyGatesReport.overall` is the literal `"pass"` (`packages/core/src/contracts/verify-gates.ts:332`).
- Gap: DEC-18 requires widening `overall` to `"pass" | "fail"` and promises a member-less report "keeps the delivered literal `"pass"` type". If the shared `VerifyGatesReport.overall` is widened, the member-less report's **static type** is no longer the literal `"pass"`; the spec defines no separate `CrossRepositoryVerifyGatesReport` or discriminated union to scope the type. Runtime value parity is tested (TC-XPAR-003), but the type-level contract claim is false and a consumer's compile-time guarantee changes for member-less reports too.
- Suggested remediation target phase: **specification** (then delivery_planning).
- Suggested fix: define a member-less `VerifyGatesReport` with `overall: "pass"` and a cross-repository report type with `overall: "pass" | "fail"` (discriminated by the presence of `definitionOfDone`/report shape), or drop the "literal `"pass"` type" claim and state only that the member-less **value** is always `"pass"`.

### N5 [major] spec_completeness / decision_pinning — closeout precedence is not mechanically pinned; `detail` keys and mode-specific `applied`/`satisfied` are undefined

- Artifact/location: `chg-GH-310-spec.md` §5.1 F-5 (line 120), §8.3 DM-5 (line 222), §15 DEC-12 (line 326), §17 AC-F5-1/AC-F5-3 (lines 401, 403); `chg-GH-310-plan.yaml` 4.2 (lines 675–687); `packages/core/src/contracts/closeout.ts:59-75,365-375` (mode-specific outcome vocabularies; `CloseoutStep.detail` is an open `Record<string, unknown>`); `chg-GH-310-test-plan.md` TC-XCLOSE-001 step 4 (line 968), TC-XCLOSE-003 steps 1–2 (lines 1022–1023).
- Gap: the precedence refers to "a member whose detail records a refuse condition / a declared gap / the effect already satisfied or applied" and "no member-specific detail entry", but the member-specific `detail` entry shape (keys/values) is never pinned; the delivered `detail` is an open map and the test plan does not name keys. Also "satisfied or applied respectively" is not mode-scoped: the delivered plan outcomes are `would-apply`/`satisfied`/`skipped-gap`/`skipped-noop`/`would-refuse` (no `applied`), while apply outcomes include `applied`/`failed`/`refused`. A plan-mode member carrying `applied` would be outside the plan-mode vocabulary, and TC-XCLOSE-003's "applied/satisfied" in plan mode is ambiguous. This is a new ambiguity introduced by the B11 remediation.
- Suggested remediation target phase: **specification** (then test_planning/delivery_planning).
- Suggested fix: pin the member-specific `detail` entry shape and the mode-specific matrix (plan: `would-apply`/`satisfied`/`skipped-gap`/`skipped-noop`/`would-refuse`; apply: `applied`/`satisfied`/`skipped-gap`/`skipped-noop`/`failed`/`refused`), or explicitly type `data.members[].cleanup`/`issueClosure` as the union with a mode-qualified derivation rule.

## Non-Blocking Observations

- **N6 [minor] cross_artifact_consistency — test plan §2 and §8.3 are stale vs plan 1.2.** `chg-GH-310-test-plan.md` §2 (line 53) still says the plan "revision 1.1 exists" and "must be reconciled in delivery_planning before delivery (phase scope for DM-9/DM-10 and the DEC-18 supersession)"; plan revision 1.2 already contains DM-9/DM-10/DEC-18 and the reconciled scopes. §8.3 rows B8 (Closed), B3 (Deferred), and B4 ("plan must declare it") are likewise stale. Refresh §2 to revision 1.2 and update the §8.3 closure rows. → **test_planning**.
- **N7 [minor] cross_artifact_consistency — phase-5 commit subject still `docs(GH-310)`.** `chg-GH-310-plan.yaml` line 157/749 declares `docs(GH-310)`, while phase 5 adds `cross-repository-contract`, `cross-repository-readonly`, and `cross-repository-hermetic` test suites and `.changeset/...`. Use `test(GH-310)` plus a separate `docs(GH-310)` bookkeeping commit, or justify `docs`. → **delivery_planning**.
- **N8 [minor] cross_artifact_consistency — the "41/41" suite-home count is not reproducible from §7.** `chg-GH-310-pm-notes.yaml` line 155 says "Plan revision 1.2 declares every §7 suite home (41/41)"; mechanical extraction yields **38 unique `.test.ts` paths** (47 path references including fixtures/goldens), all covered by some phase scope. No path is missing; the literal count is a claim that cannot be regenerated from the §7 table. State the counting rule (e.g. 38 test files + 3 fixture modules) or correct the count. → **delivery_planning/test_planning**.
- **N9 [minor] decision_pinning — `verify.gates.failed` "on its data" has no named carrier.** `chg-GH-310-spec.md` F-3/DEC-18 and `chg-GH-310-plan.yaml` 3.1 say the negative report "carries the delivered `verify.gates.failed` classification on its data"; DM-2/DM-9 add no `classification` field, and TC-XDOD-002 step 5 asserts it without a field name. The delivered row's trigger is "overall result is `fail`", so `overall: fail` may be the intended carrier; say so explicitly (or name the additive data key and its shape). → **specification**.
- **N10 [minor] spec_completeness — §8.5's "every extension is an additive optional key" remains overbroad next to the scoped `overall` widening.** §8.5 line 235 still says every extension is an additive optional key, while line 239 enumerates the required-field `overall` widening. The scoped bullet clarifies, but qualify line 235 with "except the enumerated scoped supersession below". → **specification**.
- **Good closures:** DM-9's `gates[]`/`summary`/`member` projection, DEC-18's scoped supersession, `MemberLandingObservation` (DM-10), the declared-set `runId` (DEC-8), the `queue-add-memberless.json` provenance (B4), the invalid-plan no-`members` pin, the ≤64-char gate-id shape, the honest TC-XCLOSE-004/TC-XPLAN-005 supplements, and RSK-10/RSK-11 are all genuinely present in the text and mutually consistent on their own terms.
- **Counts:** 37 ACs, 51 TCs, 5 plan phases, 37/37 AC ownership, 51/51 TC ownership, DM-1..DM-10, DEC-1..DEC-21, RSK-1..RSK-11, DoD-1..DoD-15 all reconcile mechanically.
- **No human input is required** to remediate the blocking findings; they are artifact-authoring changes. If the team cannot choose between the N4 union-type vs value-only wording, or the N5 union-type vs mode-matrix wording, that is a spec-author choice, not a human escalation.

## Iteration Notes

- This is iteration 2; iteration 1 is at `readiness-review/readiness-iter-1.md`. Findings B1, B2, B4, B5, B6 and the non-blocking invalid-echo/gate-shape/linkage/RSK items are substantially closed; B1/B2/B3 retain residuals and the B1/B11/B2 remediation introduced N1/N3/N4/N5.
- The highest-value new catch is **N1**: the new member-verdict aggregation rule can return `pass` for an unavailable/absent CI reading when the member's declared gate list does not include a CI gate, which would defeat the change's central fail-closed invariant.
- DoR findings never reopen `delivery`; remediation targets are `specification`, `test_planning`, and `delivery_planning` only.
