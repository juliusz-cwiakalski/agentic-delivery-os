# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-242
Date: 2026-11-07
Pause Required: no

Inputs reviewed: ticket GH-242 (`juliusz-cwiakalski/agentic-delivery-os`), readiness iterations 1–2, the revised `chg-GH-242-spec.md` (v1.2, §16.1.1 phrase table, `fallback.internal` composition identity, phase 2/3 feature-spec ownership), the revised `chg-GH-242-test-plan.md` (v0.3, 72 TCs, split scan ownership, deterministic pilot), the revised `chg-GH-242-plan.yaml` (10 phases, `validatePlanValue` → 0 errors), `chg-GH-242-pm-notes.yaml`, `TDR-0013-agent-session-commit-guard-reversal.md`, `doc/guides/definition-of-ready.md`, the current-truth pages named by §16.1.1, and the source seams that decide scope realism (`packages/core/src/contracts/error-table.ts`, `packages/cli/src/edge.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/golden/commit-envelope.test.ts`, `.opencode/agent/*.md`).

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Facet notes (no facet below PASS): `cross_artifact_consistency` carries one recorded ownership-cell defect (RR-28) and `ac_quality`/`test_traceability` carry one assertion-cardinality ambiguity (RR-29). Both are metadata/precision defects in the doc obligation; neither breaks phase independence, contradicts the operative phase ownership (plan header, §7.1, DoD-14 and test-plan §7.2 all agree), nor leaves any AC without evidence. They are listed below as non-blocking.

## Iteration-2 Blocker Closure

| Finding | Status | Evidence |
|---|---|---|
| RR-17 (pilot data scanned in phase 8) | CLOSED | Plan phase 8 summary now scans only `.opencode/**` + phase-7 docs and names the six non-pilot fixture classes; phase 9 owns `tests/checks/pilot-privacy.test.ts` and runs `TC-PSCAN-010` (plan lines 424, 452, 460, 467). Test plan splits `TC-PSCAN-009` (line 1523: pilot not required) from `TC-PSCAN-010` (lines 1541–1569); §7.2 row 8 excludes `TC-PSCAN-010`, row 9 owns it (lines 2550–2551); `TC-PILOT-006` and `TC-STAGE-009` unaffected. |
| RR-18 (`edge.ts` unowned in phase 2) | CLOSED | `packages/cli/src/edge.ts` is in phase 2 `scope.files` (plan line 101), and the phase-2 summary states the `sessionFacts` injection is removed from that file while the `CommitSessionFacts` contract and adapter export stay (line 133). Verified no structure test asserts the edge wiring (`sessionFacts` appears only in `tests/golden/commit-envelope.test.ts`, `tests/behaviour/commit-*` and the commit harness), so phase 2 does not need an undeclared test edit. |
| RR-19 (commit/phase feature specs unowned) | CLOSED | Spec §7.1 (line 244) and §16.1 (lines 493–494) assign ordering/staging to plan phase 3 with phase 2 co-owning session/five-row text; phase 3 scope includes both pages and `TC-DOCREC-004` is its scoped doc-conformance case (plan lines 158–159, 165, 180, 189; test plan lines 1760–1789). |
| RR-20 (invented `config.composition.unavailable`) | CLOSED | All occurrences are now the existing `fallback.internal` identity (F-1 line 144, §8.1 line 304, §4.1 line 107, NFR-2 line 345, AC-F1-6, DoD-4, DEC-13/14, §16 row 456, revision log 1.2). Verified against the machine table: `fallback.internal` is `category: platform`, `retryable: false`, `consequence: unknown`, `platform-provider` (`packages/core/src/contracts/error-table.ts` lines 121–130) and is already documented in `feature-result-contract.md` lines 66, 80, 134, 250. No `config.*` row is added and `feature-config-layer.md` is correctly left unchanged. |
| RR-21 (system-spec scan in phase 8) | CLOSED | `TC-PSCAN-001` step 7 and `TC-PSCAN-002` step 5 now exclude `doc/spec/features/**` and point at `TC-DOCREC-003` in phase 10 (test plan lines 1292, 1324); phase-8 summary (plan line 424), phase-7 `scope: docs` (lines 371, 373) and phase-10 `scope: full` (lines 504, 507) agree. |
| RR-22 (no named phrases for the generic row) | CLOSED | §16.1.1 exists as the single named-phrase table (spec lines 498–513) with rows for the two behavior-spec pages, result contract, the four omitted pages, and the generic behavioral-primitives row; NFR-13 (line 356), DoD-14 (line 580) and AC-F8-5 (line 548) are scoped to that table and drop the "every §16.1 row" claim; `TC-DOCREC-003` consumes it row by row (test plan lines 1721–1758). Residual precision issues are RR-29/RR-30 below. |
| RR-23 (`@pr-manager` "no commit") | CLOSED | Spec F-3 (line 146), §16.1 (line 480) and §8.4 (line 327) now say never merge / never raw git and allow a dirty-tree commit through `commit` or the thin `@committer`; `TC-ADOPT-002` step 3 explicitly allows the dirty-tree delegation and only forbids "no commit at all" (test plan lines 2026, 2033). Current `pr-manager.md` already satisfies the retained assertions (never merges; `@committer` delegation at lines 249/435). |
| RR-24 (phase-1 reference-page inventory) | CLOSED | Phase 1 creates `tests/fixtures/help-guide/coverage.json` (plan lines 13–15, 66) and `TC-ENTRY-004` now asserts only the see-also → inventory-row mapping, with page existence/parity deferred to `TC-HELP-001`/`TC-HELP-003` (test plan lines 382, 389, 395); §6.2 records the same phase-1 creation and phase-8 parity split (line 2418). |
| RR-25 (180 s pilot assertion) | ADDRESSED | NFR-8 (spec line 351) and §4.1 (line 111) are deterministic (fixed clock/ids, no sleeps, bounded budget, byte-identical replay, fixed suite timeout; wall-clock informational); `TC-PILOT-006` asserts no wall-clock threshold and says a >180 s duration alone does not fail (test plan lines 2384, 2394). No "180 s gate" remains. |
| RR-26 (object-database absence) | ADDRESSED | F-5 and AC-F2-4 now assert "no commit at HEAD, HEAD/commit count unchanged, no reachable commit object, no ledger transition" and explicitly disclaim object-database absence (spec lines 150, 526); `TC-STAGE-009` steps 2/expected outcome match (test plan lines 1080, 1087, 1092). |
| RR-27 (stale OQ-T6) | ADDRESSED | The open-questions table now ends at OQ-T5 (test plan lines 2614–2620); no `TC-DOCREC`/alignment residual remains. |

## Findings (all non-blocking)

### RR-28 [major] cross_artifact_consistency — `chg-GH-242-spec.md` §16.1.1 owning-phase column, rows for `feature-delivery-lifecycle`, `feature-quality-gates-and-pr`, `feature-autonomous-delivery`, `feature-local-code-review`

- **Artifact + location:** spec lines 507–510; contradicted by spec §7.1 line 244, DoD-14 line 580, plan phase 7 scope/summary (lines 332–358, 371), plan phase 10 scope/summary (lines 473–489, 504), and test-plan §7.2 rows 7/10 (lines 2549, 2552) plus line 74.
- **Gap:** Four §16.1.1 rows name "Phase 7" as the owning plan phase, but every other artifact assigns those pages to plan phase 10: §7.1 says "the final phase (plan phase 10) reconciles the remaining pages"; DoD-14 names Phase 10 for "remaining feature specs"; plan phase 7 is docs-only and states it "must not read any `doc/spec/features/**` page"; test-plan §7.2 row 10 owns full feature-spec conformance. The phrase table is declared the single source for the scan, so its ownership column is read as authoritative.
- **Why it does not block:** The delivery path is unambiguous — the plan header ownership block (lines 12–31), §7.1, DoD-14 and test-plan §7.2 all put these pages in phase 10, and phase 10's `scope: full` run asserts them. No phase loses independence and no AC loses evidence. Risk is reviewer confusion/duplicated effort, not a hidden dependency.
- **Suggested remediation target:** specification
- **Suggested fix:** Change the owning-phase cell for those four rows from "Phase 7" to "Phase 10" (or "Phase 10; §7.1/§16.1 guides-only phase 7") in spec v1.3 before phase 7 executes.

### RR-29 [minor] ac_quality / test_traceability — `chg-GH-242-spec.md` §16.1.1 generic row vs `chg-GH-242-test-plan.md` `TC-DOCREC-003` precondition

- **Artifact + location:** spec lines 511 and 513 ("one assertion per entry"); test plan line 1733 ("one assertion per page/phrase pair"); `TC-DOCREC-003` step 1 generic-row bullet (line 1746).
- **Gap:** The generic row names eight pages in one cell with one shared list of stale/required phrases. The spec's assertion cardinality (per entry) and the test plan's (per page/phrase pair) differ. Under the test-plan reading, every one of the eight pages must carry all three generic required phrases — e.g. `feature-brief.md` would have to contain "the PR URL is a pm-notes `notes:` entry" — which is not intended; under the spec reading, a required phrase need only appear somewhere in the row's page set, which allows a vacuous pass. The fixture cannot be written unambiguously.
- **Suggested remediation target:** specification + test_planning
- **Suggested fix:** Either give the generic row per-page phrase entries, or state the semantics explicitly ("each stale phrase absent from every page in the row; each required phrase present in the page that documents that behavior, enumerated by page") and align `TC-DOCREC-003`'s cardinality sentence to it.

### RR-30 [minor] system_spec_consistency — `chg-GH-242-spec.md` §16.1.1 stale-phrase entries miss verbatim stale text that the scan will therefore not catch

- **Artifact + location:** spec lines 504–506; current pages `doc/spec/features/feature-commit-primitive.md` lines 50 and 53 (`"… safety STOP, session refusal"` in both exit-1 projection cells), `feature-pm-notes-lint-and-phase-transitions.md` line 135 (`"the six \`commit\` rows"` in the related-links line), `feature-result-contract.md` line 9 (frontmatter summary `"the six commit-primitive rows"`).
- **Gap:** The named stale strings for `feature-commit-primitive` are the prose refusal sentence and `commit.session.context-refused`; the bare `"session refusal"` entries in the two exit-code cells survive a change that removes session refusal. Likewise the pm-notes page's `"the six \`commit\` rows"` cross-reference and the result-contract frontmatter `"the six commit-primitive rows"` do not match their rows' named phrases (`"the six \`commit.*\` identities"`, `"the six \`commit.*\` rows"`). NFR-13 is scoped to named phrases by design, so these stale statements can be delivered while the scan is green.
- **Suggested remediation target:** specification (phrase-table rows only)
- **Suggested fix:** Add `"session refusal"` as a stale phrase for `feature-commit-primitive` (its two exit-code cells), add `"the six \`commit\` rows"` to the `feature-pm-notes-lint-and-phase-transitions` row, and add `"the six commit-primitive rows"` (frontmatter summary) to the `feature-result-contract` row.

### RR-31 [nit] plan_doc_update_coverage — `feature-result-contract.md` phrase row is owned by phase 2 but asserted only in phase 10

- **Artifact + location:** spec line 506 ("Phase 2"); plan phase 2 scope line 107 (page is edited) but phase 2's test list contains no doc-conformance run (lines 134–145); plan phase 10 line 477.
- **Gap:** Phase 2 edits the page; no phase-2 test asserts its §16.1.1 phrase row, so a missed page edit is caught only at phase 10. This is acceptable (phase 2 does not depend on a later artifact and phase 10 owns the final assertion) but it means the "Owning plan phase: Phase 2" cell describes editing, not evidence.
- **Suggested remediation target:** delivery_planning (or leave as-is and record the split in §16.1.1)
- **Suggested fix:** Either add the result-contract phrase assertion to phase 2 (a small third doc-conformance scope) or annotate the row "edited in phase 2, asserted in phase 10" to match phase 3/7's wording.

## Scope Realism Judgment

The one-ticket/one-PR posture is correctly recorded and accepted (DEC-15, RSK-8, DoD-20), the ticket is a leaf story, and the plan now has no forward dependency that breaks phase independence. Verified in the revision:

- Phase 1 needs no phase-7/8 artifact (its own static coverage inventory is created there).
- Phase 2 owns only guard removal, the sanitized one-shot and the error-row retirement, including the `edge.ts` wiring removal; no test asserts the removed wiring.
- Phase 3 owns its two behavior-spec rows and proves them with a scoped doc-conformance parameter set, so it is green before phase 10.
- Phase 4 is limited to plan code/template/plan-writer plus code/template consumers; the prompt-text scan moved to phase 5/8.
- Phase 5 is limited to the foundation prompts; the role-purity assertions already hold against the current pure-writer prompts, and phase 6 re-runs the role check.
- Phase 7 is docs-only and does not read feature specs.
- Phase 8 scans only `.opencode/**` and the phase-7 docs plus non-pilot fixtures; it never reads pilot data or feature specs.
- Phase 9 creates the pilot data and immediately runs its own privacy/safety scan (`TC-PSCAN-010`), which is the only order that keeps it green.
- Phase 10 runs plugin freshness, the full §16.1.1 conformance and the aggregate gate.

Residual risk is review load on a large single PR, which is exactly the risk DEC-15/RSK-8 accept. The remaining findings (RR-28..RR-31) are documentation/assertion precision issues that do not change what gets delivered; fixing RR-28 and RR-30 in spec v1.3 is cheap and should be done, but they are not delivery blockers.

## Gate Result

`READY`. No pause. Delivery may open on the current artifact set; RR-28 and RR-30 should be corrected in spec v1.3 before phase 7/10 execute, and RR-29/RR-31 are optional precision improvements. Do not reopen any iteration-2 finding; none persists.

## Evidence Notes

- No source code, spec, test plan, or plan was modified by this review; this verdict is the only written artifact.
- `validatePlanValue` on `chg-GH-242-plan.yaml` returns 0 errors for 10 phases (`delivery.plan.v1`, tier `full`). The validator still ignores the not-yet-declared `summary` key and the non-schema `tests` key, which phase 4 addresses for `summary`; plan-header comment states `tests` is delivery evidence, not a schema field.
- Test plan contains 72 unique `TC-*` case headings, matching the declared "Seventy-two scenarios".
- External ticket context was loaded with `gh issue view 242`; its five acceptance clauses match spec Appendix C's six-row split.
- TDR-0013 remains `Proposed` with `decision_date: null`, indexed, and acceptance-pending at PR review (its lines 153, 158); this is consistent with the plan's `tdr-acceptance-required-at-pr` trigger and is not a DoR pause.
- `fallback.internal` is documented in `feature-result-contract.md` with exactly the properties the spec claims (platform, non-retryable, `consequence: unknown`, `platform-provider` → exit 2), so RR-20's no-new-row posture is factually correct.
- `feature-config-layer.md` line 137's "all config rows are user/exit-1" statement is untouched and not contradicted, because no composition row is added.
