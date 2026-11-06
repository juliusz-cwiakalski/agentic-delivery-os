# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-228
Date: 2026-11-06
Pause Required: no

Reviewed chain: ticket `juliusz-cwiakalski/agentic-delivery-os#228` (0 comments) → `chg-GH-228-spec.md` v1.1 → `chg-GH-228-test-plan.md` v1.1 (TC-BRIEF-001..022) → `chg-GH-228-plan.md` v1.0 (9 phases, D1..D12) → `chg-GH-228-pm-notes.yaml`, against current truth `feature-status-digest.md`, `feature-result-contract.md`, `feature-queue-ready.md`, `feature-verify-gates.md`, and the code (`packages/core/src/contracts/status.ts`, `packages/core/src/domain/status.ts`, `packages/cli/src/edge.ts`, `packages/cli/src/commands/status.ts`, `tests/fixtures/status/harness.ts`).

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
- dod_defined: FAIL

Counts: 0 critical, 1 major (blocking), 2 minor, 3 nits. All non-blocking findings can be folded into the same revision cycle; only F-1 blocks.

## Findings

1. [major] [BLOCKING] dod_defined — chg-GH-228-spec.md (no Definition of Done section anywhere in §1–§25)
   Gap: The spec contains strong completion ingredients (§4.1 measurable success metrics, §17 testable ACs, §18 rollout) but never binds them into an explicit change-specific Definition of Done. `doc/guides/definition-of-done.md` is explicit: "Every change must define its own DoD in its spec — concrete, testable, and traceable to its acceptance criteria… delivery cannot start without a clear, testable DoD written into the spec." Repo precedent enforces this at this exact gate: GH-173's DoR iteration 1 forced the same fix (spec v1.2 added "Definition of Done — open-PR handoff"). GH-228 has no equivalent statement of what "done" means for this change (e.g. all 10 ACs green with recorded evidence per test-plan §7.3/§10, error-table sync green with zero new rows, goldens committed and suite-untouched, docs synced per Phase 8, review PASS, `pnpm check` green on a clean checkout, lockstep-minor changeset, open PR targeting `main-tools` with CI green).
   Suggested remediation target phase: specification
   Suggested fix: Add one "Definition of Done" paragraph (mirroring GH-173's placement, before §18 or as §17.1) binding: all 10 ACs with passing traceable evidence; NFR-1..8 thresholds with measured evidence; TC-BRIEF-001..022 green incl. the TC-BRIEF-022 recorded manual half; error-table sync green with zero new rows/kinds/keys; current-truth `feature-brief.md` authored and cross-linked, registry row delivered, man page reconciled per DEC-2; independent review PASS; `pnpm check` green in a clean checkout; changeset recorded. Do not weaken or renumber existing ACs — this is additive.

2. [minor] test_traceability — chg-GH-228-test-plan.md#§3.1 (coverage matrix reverse-trace incompleteness)
   Gap: TC-BRIEF-002 declares `AC-F1-1` in its §5.1 Related IDs and TC-BRIEF-016 declares `AC-F6-1`, but the §3.1 rows for AC-F1-1 (lists 004, 005, 020) and AC-F6-1 (lists 014, 015, 017) omit them. Forward coverage is over-complete, not missing — no AC is uncovered and no TC is orphaned — but the matrix is not the declared bijection §3.4 implies.
   Suggested remediation target phase: test_planning
   Suggested fix: Add TC-BRIEF-002 to the AC-F1-1 row (Phase 3 already appears there) and TC-BRIEF-016 to the AC-F6-1 row; or drop the two Related-IDs entries if the linkage is not intended. Mechanical edit; do not renumber TCs.

3. [minor] cross_artifact_consistency — chg-GH-228-test-plan.md#§4.6 ("three anchored surfaces") vs chg-GH-228-spec.md#DM-5 and chg-GH-228-plan.md#D2/D4
   Gap: §4.6 enumerates the render surface story as "the three anchored surfaces (ready-to-merge, blocker questions, owner-gate ages), then one context surface per digest section…, then the placeholder entries", which reads as anchors being surface ids. Spec DM-5 and plan D2/D4 pin the opposite model: the surface-id set is exactly nine = six digest-section ids + three placeholder ids, with ready-to-merge and owner-gate ages as ranked anchored-action groups (DM-2 payload records), not surface ids. The plan explicitly reconciles this (D4), so delivery is unambiguous, but §4.6 is the section TC-BRIEF-001 step 2 cites as the closed-set authority ("exactly the §4.6 set") and a coder reading §4.6 alone could derive the wrong nine.
   Suggested remediation target phase: test_planning
   Suggested fix: Rewrite §4.6's first sentence to the DM-5/D2 id set (six digest-section ids + `typed-questions`, `gate-sla-states`, `lane-queue-engine`) with anchors described as action groups rendered first, keeping the fixed correspondence list unchanged.

4. [nit] cross_artifact_consistency — placeholder render position wording: test-plan §4.6 ("then the placeholder entries" — last) vs spec DM-5 / plan task 2.2 (`gate-sla-states` renders *beside* the owner-gate ages block, before contexts)
   Gap: Two orderings coexist for where placeholders appear in the human screen. No AC or TC breaks under either reading (TC-BRIEF-006 step 3 asserts only anchors-before-context), and OQ-1 explicitly parks exact line grammar to the Phase 4 goldens, so this is absorbed at delivery.
   Suggested remediation target phase: test_planning
   Suggested fix: One clarifying sentence in §4.6 (or fold into finding 3's rewrite): the trailing "placeholder lines" block is the catalog listing; adjacency claims (DM-5/plan 2.2) are satisfied by the golden-pinned grammar at Phase 4.

5. [nit] decision_capture — chg-GH-228-pm-notes.yaml (decisions: []) — spend placeholder scope-down vs clarify-scope expectation
   Gap: Clarify-scope notes expected four named placeholders including spend (M1-S19); the spec binds three (DEC-5: spend not surfaced in v0, deferred with M1-S19). The deviation is well-reasoned and decision-logged in the spec, and the ticket does not require spend — but the pm-notes `decisions` array is empty, so the chain ticket-expectation → deviation lives only in the spec decision log.
   Suggested remediation target phase: specification
   Suggested fix: Add one pm-notes decision entry ("v0 placeholder catalog closed at three; spend not surfaced, joins via additive change with M1-S19 — DEC-5") when the spec is revised for finding 1. No artifact re-opening needed for this alone.

6. [nit] test_traceability — chg-GH-228-test-plan.md#§7.1 (Execution Order vs plan phase mapping)
   Gap: §7.1's run order lists TC-BRIEF-002/003 (Phase 3) before TC-BRIEF-004 (Phase 2), which cannot be executed incrementally as written; the §7 table's Plan-phase column and the plan's phase tasks are the authoritative mapping.
   Suggested remediation target phase: test_planning
   Suggested fix: Reorder §7.1 to phase order (001 → 004/006..020 → 002/003/005/017 → 011..015 → 018/019/021 → 022) or retitle it "logical verification grouping" so it is not read as a delivery sequence.

## Verification Evidence (for iteration-2 dedup; not findings)

- Ticket coverage: all ticket tasks and both ACs trace to spec F-1..F-6 / AC-F1-1, AC-F4-1 (matches collector state) and AC-F3-1 (placeholders named, not silent); pinned decisions are recorded as DEC-1/DEC-3/DEC-6, not re-derived; the ticket's dead `m1/README.md` reference is correctly treated as non-normative (spec §12, pm-notes).
- GAP-T1 premise verified in code: `ownerHandBacksFamily` (`packages/core/src/domain/status.ts` ~L247–303) emits owner-hand-back items with no `ageDays`/`updatedAt`, while facts carry `updatedAt` and the digest's stall rule (L408 `Math.floor((nowMs - updatedAt) / DAY_MS)`) is exactly test-plan §4.5's oracle — spec v1.1's two-branch AC-F1-1 is jointly satisfiable with AC-F2-2 and implementable by plan D5.
- Plan bindings verified in code: all D3 import names exist in `packages/core/src/contracts/status.ts` (values 24/4096/65536); `collectStatusFacts` is exported from `packages/cli/src/commands/status.ts` (D6 mirrors the status handler exactly); `createStatusCommandRuntime` + `ConfigProgramOptions.queueReady` (edge.ts L862/L996/L1246) establish the D7 precedent; all reused harness exports (`baseFacts`, `statusRuntime`, `runStatusCli`, `capSizedFacts`, `sectionById`, failure builders) exist; every plan-referenced existing test file exists.
- System-spec consistency: §4.4/DEC-7 predicate matches `feature-queue-ready.md` ("merge-ready requires an observed approval on a non-draft open pull request"); §4.7 guard outcomes match `feature-status-digest.md` §credential posture; DEC-2 matches `feature-result-contract.md` §"Status evidence identity" (status family adds no error rows; `fallback.invocation`/`fallback.internal` only; `{0,1,2}` projection); NG-1 keeps merge verdicts with `feature-verify-gates.md`. The proposed man page's exit-2 row, `status.collector.<id>.unavailable`, `slaState:'escalated'`, and `placeholders: []` example all exist as claimed and are all reconciled by DEC-2/Phase 8.2/TC-BRIEF-022 steps 1–3.
- Phase↔TC consistency: plan "Test Scenarios" table (22/22 TCs mapped) matches test-plan §3.1 and §7 Plan-phase columns exactly, including the multi-phase AC rows (AC-F1-1 → 2,3; AC-F5-1 → 3,4,8; AC-F6-2 → 3,5).
- Doc-update coverage: Phase 8 lists `feature-brief.md` (new), `feature-status-digest.md` (incl. the "humanText hook consumed only by status" line, which becomes false when brief uses it — correctly planned), man page, and registry row.

## Gate Result

NOT_READY. One facet fails (dod_defined) on one blocking finding (F-1). Reopen `specification` for a single additive revision (DoD paragraph; optionally F-5's pm-notes decision entry). F-2/F-3/F-6 are non-blocking and should be folded into one `test_planning` touch-up in the same cycle so iteration 2 can close both. No human input required; no pause flag. Delivery remains blocked until a READY verdict.
