# Readiness Review Iteration 4

Verdict: READY
Work Item: GH-293
Date: 2026-11-18
Pause Required: no

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

## What I verified (not findings)

Artifacts read: spec v1.4 (770 lines), test plan v1.3 (1,781 lines, 46 cases), plan revision 1.3 (1,258 lines), `chg-GH-293-pm-notes.yaml`, issue #293 body (re-read), readiness iterations 1–3, and the delivered seams every oracle in the new case depends on.

**Targeted pressure tests requested for this iteration:**

- **(a) The new case exercises the refusal; it is not a tautology.** `TC-ENGINE-017` (test-plan lines 648-683) is a four-cell design, not a restatement: an uncorrupted control over the same store (step 1, asserting the five declared noop values and the three declared absences), a torn-handover-record cell (step 2), an unreadable-handover cell (step 5), and a diagnostic contrast cell (step 6) in which the attempts/divergences ledgers are corrupted and the handover ledger is intact ⇒ still exit `0`. Three things make it non-vacuous: (i) a **readability witness** per corruption cell — `dispatch dual-run summary --repo <alpha> --json` over the same store still exits `0` with full evidence (precondition, line 664), so the refusal is attributable to the handover ledger alone; (ii) the assertions are existential-negative (`Object.hasOwn(data) === false`, not `{}` or a partially formed noop payload) plus byte-identity of the handover ledger and the authority document (step 4); (iii) step 6 states the failure mode the case exists to catch — an implementation that drops the folded-handover read, hoists it below the noop branch, or fakes the noop from the authority document fails this step. A suite that fails everything also fails the control and the contrast cell.
- **(b) The exit is derived from `dispatch.state-unverified`'s declared row, not transcribed.** Step 3 asserts the identity from the oracle and derives the exit as `projectExitCode(ERROR_TABLE["dispatch.state-unverified"].projectionClass)`. I re-checked the delivered facts the derivation rests on: `packages/core/src/contracts/error-table.ts:1228-1237` declares the row `domainKind: "dispatch"`, `category: "platform"`, `projectionClass: "platform-provider"`; `packages/cli/src/projection.ts` maps `platform-provider → 2`, `user-validation → 1`, `success → 0`, `attention → 1`. The derived value is `2`, matching AC-F2-3 and NFR-11.
- **(c) The case is mechanically reachable against the delivered read order.** `revertDispatchHandoverEvidence` (`packages/core/src/app/dispatch-gate.ts:264-286`) calls `readDispatchHandover` and returns `{kind: "dispatch", code: "dispatch.state-unverified"}` on a failed fold **before** the `current === undefined || current.authority === "dual-run"` noop branch. The refusal the case asserts is therefore true of the delivered code and is exactly the read order the case pins. The harness precedent the case cites exists (`tests/behaviour/action-store-boundary.test.ts:136-142`, the `readRecords: () => storeFailure("state.store.torn")` pattern).
- **(d) Ownership is exactly once, and the case appears in all three indexes.** `TC-ENGINE-017` is owned by **plan phase 3 only** (plan lines 355-357: `Phase 3 … (8): TC-ENGINE-010 … 017`), its target file `tests/behaviour/dispatch-handover-conditions.test.ts` is in phase 3's `scope.files` (line 704), and phase 3's own coverage block names it as the fifth AC-F2-3 case (lines 657-660). Parsed mechanically: §5.1 index = 46 rows / 46 unique, §5.2 = 46 `#### ` headings / 46 unique, §7 = 46 table rows / 46 unique, with no missing and no duplicate id in any of the three; the plan's ownership rows sum 0+6+8+7+6+9+10 = 46 with every id in exactly one phase (the only repeated ids in the plan's phase-7 block are the DoD ASSERTIONS cross-references, not ownership).
- **(e) The three artifacts agree on the seven contested points.**
  - *Exemption scope*: spec NFR-11 (line 370), F-2 (189), AC-F2-3 (504), AC-F2-4 (505), DEC-12 (471), glossary (604), Appendix A (632-635), Appendix E.1 (703-713); test plan §1 (26), §1.1 (38), GAP-T1 (61), AC-F2-3 row (99), NFR-11 row (153), DM-2 row (128-130 region), DoD-2 (198), `TC-ENGINE-010` steps 5-7, `TC-ENGINE-011` step 6, `TC-ENGINE-014` step 5, `TC-ENGINE-017`, R-TP-2/R-TP-13, OQ-TP-3; plan phase 3 objective (642-654), escalation trigger (467). All eight state the same two-sided rule: 0 noops refused by an unreadable/torn **attempts or divergences** ledger; 100% of noops still refused `dispatch.state-unverified` at exit `2` with no data when the **handover** ledger is unreadable or torn. No artifact retains an unqualified "answers under a torn ledger" claim (searched).
  - *Exit projections*: credential read = `config.credential.missing` (kind `config`, `user-validation`) at exit `1` with exit `2` asserted absent; merge gate refusal exit `1`; `repos.state-unavailable` and `dispatch.state-unverified` exit `2`. No case asserts exit `2` for a missing credential; `TC-ENGINE-052` derives its exit from the row.
  - *`production` scope*: spec DEC-17/DM-4/AC-F3-5/A§A; test plan GAP-T8, AC-F3-5 row, `SCOPE-ENG-1`, `TC-ENGINE-020`/`021`/`022`/`093`; plan phase 4 objective and OQ-TP placements. Delivered `COUNTED_EVIDENCE_CLASS` (`packages/core/src/domain/dispatch-gate.ts:33-36`) is `production → "pilot"`, as declared.
  - *Identity binding*: spec DM-7/DEC-15/AC-F3-5; test plan `TC-ENGINE-020`/`021`/`023`/`094`, R-TP-10; plan OQ-TP-8. The delivered resolver (`packages/core/src/domain/dispatch-identity.ts:109-133`) resolves **marker → scheduler → remote** in its body, so with no scheduler key on the fleet path it resolves marker-then-remote — exactly the order the spec's fleet-path claim and RSK-14 rely on ("a persisted binding wins"). Note: the exported `DISPATCH_IDENTITY_SOURCES` array reads `["scheduler","remote","marker"]` while the body's priority is the reverse; that delivered constant is outside this change's declared scope and no artifact depends on it, so it is not a finding here.
  - *Emittable constant*: spec AC-F7-11/DM-6/NFR-12/Appendix E.3; test plan `TC-ENGINE-054` + AMB-ENG-4; plan OQ-TP-1 (declaration lives in `packages/cli/src/production.ts`, imported by the test, never copied).
  - *Lifecycle-phase-7 handoff with DoD-7*: spec F-8, §7.1, OQ-4, DEC-11, DEC-16, §16, AC-F8-12, DoD-7, §18 all read "lifecycle phase 7 (`system_spec_update`, `@doc-syncer`)" and §18 places the bounded lifecycle-prose edits in plan phase 6; test plan GAP-T7, `TC-ENGINE-061` step 6, §3.6 DoD-7 row, §10 attestation; plan DOC BOUNDARY handoff block (414-436), CLOSURE MODEL (438-448), phase 7 handoff (1073-1102), DoD-7 (1131-1144), escalation trigger (474). The chain is: plan Phase 7 records the handoff and closes inside lifecycle phase 6; lifecycle phase 7 runs `@doc-syncer`; lifecycle phase 10 verifies DoD-7 and reopens `system_spec_update` if absent. No artifact makes it a plan-phase exit test or a residual.
  - *Ticket AC1–AC4*: re-read from issue #293. AC1 (corroborated accrual) → AC-F1-1/AC-F1-2; AC2 (per-condition status) → AC-F2-3/AC-F3-5; AC3 (shell usable and documented) → AC-F4-7/AC-F8-12; AC4 (per-repository reversible flip) → AC-F2-4/AC-F3-5/AC-F4-8. v1.4 changed no requirement, so none weakened.
- **(f) Closure mechanics remain honest.** The closure rule is stated over *in-scope* obligations and repeated at all six closure sites — DECLARED RESIDUALS (316-323), CLOSURE MODEL (438-448), phase-7 handoff (1095-1102), phase-7 exit (1199-1221), DoD-7 (1138-1144), escalation trigger (474) — and the change-closure half (never close with an AC or DoD item outstanding) is retained in the trigger. Declared residuals are still exactly three (RSK-8 `verify deploy`, TDR-0031 D4 recorded-revert refusal, OQ-TP-5 fixture cost), none of which is an AC.

Tooling: `delivery-os plan validate GH-293` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `delivery-os lint GH-293` → `conforms`. 14/14 ACs covered, zero orphans (every §5.2 case names at least one AC in its Related IDs), 46/46 in each of the three case indexes.

## Iteration-3 finding closure

| Finding | Status | Evidence |
|---|---|---|
| 1 [major] test plan had not mirrored spec v1.3's two-sided NFR-11 / AC-F2-3 and had no case for the handover-ledger cell | **CLOSED** | NFR-11 row (153) is two-sided and matches spec NFR-11 verbatim in threshold; §1 (26), §1.1 (38), GAP-T1 (61), AC-F2-3 row (99), DM-2/§8.1 surface row (128-130 region), DoD-2 (198), R-TP-2, OQ-TP-3 all requalified; `TC-ENGINE-010` step 6, `011` step 6 and `014` step 5 now name their cell as the attempts/divergences one and point the corrupt-handover cell at 017; new `TC-ENGINE-017` is the missing cell with control, torn, unreadable and contrast cells, an oracle-derived exit, and no-record/byte-identity checks; `R-TP-13` declares the risk; AC-F2-3 now rests on five cases and NFR-11 on six. 46 cases, and 017 is owned once (phase 3) and present in §5.1/§5.2/§7. |
| 2 [nit] plan and test plan cited spec v1.2 (plan) / v1.2 (test plan) while the spec was v1.3 | **CLOSED at the level raised** | Plan SOURCES now re-pin spec **v1.4** and test plan **v1.3** (lines 107-144), and the revision-1.3 header records the re-pin. The test plan's own §2 binding now reads spec **v1.3** (line 74), which was current when v1.3 of the plan was authored; spec v1.4 is a later terminology-only pass. One-revision drift remains as a new nit (finding 2 below). |
| 3 [nit] spec named "the documentation phase" for lifecycle phase 7; mirrored in test-plan GAP-T7 | **CLOSED in the spec; PARTIALLY CLOSED in the test plan (persistent nit)** | Spec v1.4 corrected F-8, §7.1, OQ-4, DEC-11, DEC-16, §16, AC-F8-12, DoD-7, §18 (both occurrences), the v1.1 amendment note and the 1.1 history row — verified individually, and §18 now places the bounded lifecycle-prose edits in plan phase 6 (line 546). The test plan still says "the documentation phase (phase 7, `@doc-syncer`)" at lines 67, 1313 and 1771. Non-blocking: every occurrence names phase 7 and `@doc-syncer`, so ownership is unambiguous and no oracle depends on the label (see finding 1). |
| 4 [nit] absolute closure sentence ("no phase may close with an unmet AC") | **CLOSED** | The rule is now "no phase … may close with in-scope work unlanded or with an AC whose in-scope portion is unmet", with AC-F8-12's lifecycle-phase-7 portion explicitly carved out, quoted at DECLARED RESIDUALS (316-323), CLOSURE MODEL (438-448), phase-7 handoff (1095-1102), phase-7 exit (1213-1221), DoD-7 (1138-1144) and the escalation trigger (474). The deferral sentence is intact and the change-closure claim is preserved, so the rule no longer reads as violated at the phase-7 boundary. |

## Findings

1. [nit] **persistent** — cross_artifact_consistency — `chg-GH-293-test-plan.md` lines 67 (GAP-T7), 1313 (`TC-ENGINE-061` step 6), 1771 (§10 attestation)
   Gap: the spec v1.4 terminology correction ("the documentation phase" → "lifecycle phase 7 (`system_spec_update`, `@doc-syncer`)") was not mirrored in the test plan, so three test-plan strings still use the retired label.
   Why it is not blocking: each occurrence names "phase 7" and `@doc-syncer` in the same sentence, so the owning lifecycle phase is unambiguous; no AC, oracle, exit, or case id depends on the label; the substantive requirement (the reconciliation is lifecycle phase 7's, not test planning's) is stated correctly in all three.
   Suggested remediation target phase: test_planning
   Suggested fix: in the next test-plan touch, replace the three occurrences with "lifecycle phase 7 (`system_spec_update`, `@doc-syncer`)". Purely mechanical; no case, count, or trace changes.

2. [nit] cross_artifact_consistency — `chg-GH-293-test-plan.md` §2 reference table (line 74) binds `chg-GH-293-spec.md` **v1.3**, while the spec is at **v1.4**; the plan's SOURCES correctly cite spec v1.4 / test plan v1.3.
   Gap: provenance is one revision behind on the test-plan side. v1.4 is terminology-only, so the bound claims (14 ACs, NFR-1..13, DM-1..7, DEC-1..17, Appendix E) remain materially accurate and no oracle moves.
   Suggested remediation target phase: test_planning
   Suggested fix: re-pin the §2 row to spec v1.4 and note that v1.4 is the lifecycle-phase-naming pass only (mirroring the wording the plan's SOURCES already uses).

3. [nit] plan_coverage — `chg-GH-293-plan.yaml` OQ-TP-3 placement block (lines 204-211)
   Gap: the block still says "TC-ENGINE-010/011/012/014/016 assert both directions", which predates 017 and omits the case that carries the handover-ledger direction. Elsewhere the plan is correct: the TC → PHASE MAP puts 017 in Phase 3 (355-357), Phase 3's coverage block names it as the fifth AC-F2-3 case (657-660), its file is in Phase 3 `scope.files` (704), and DoD-2 includes it (1116-1121).
   Why it is not blocking: ownership, scope and coverage are declared correctly in the binding locations; this is a stale cross-reference inside a placement note and changes no phase, case, or coverage total.
   Suggested remediation target phase: delivery_planning
   Suggested fix: change the sentence to "`TC-ENGINE-010`/`011`/`012`/`014`/`016` assert the exemption and the gate-read half, `TC-ENGINE-017` the handover-ledger half" (the wording the test plan's OQ-TP-3 already uses).

4. [nit] test_traceability — `chg-GH-293-test-plan.md` §3.3 NFR-4 row (line 146)
   Gap: NFR-4's condensed threshold ("unreadable ledger ⇒ exit 2 with no data") covers the handover-ledger refusal in the spec (NFR-4, line 363), and its case list omits `TC-ENGINE-017`. The cell is bound elsewhere — NFR-11's row lists 017, and AC-F2-3's row lists 017 — so nothing is untested or untraced; only this one row's case list is incomplete.
   Suggested remediation target phase: test_planning
   Suggested fix: add `TC-ENGINE-017` to the NFR-4 row's case list.

5. [nit] spec_completeness — spec §17.1 DoD-2 (line 530)
   Gap: the DoD item's own prose states only the attempts/divergences half ("still answers under a torn attempts/divergences ledger") and not the handover-ledger refusal; the plan's DoD-2 and the test plan's DoD-2 state both halves. The item cites NFR-11 (which is two-sided), so a phase-10 check cannot close it without the missing half being verified — the risk is a checker reading DoD-2's prose alone.
   Suggested remediation target phase: specification
   Suggested fix: add "and is still refused `dispatch.state-unverified` at exit `2` with no data when the handover ledger is unreadable or torn" to DoD-2, matching the plan and test-plan wording.

## Gate result

READY. All ten facets pass; no pause flag; the single blocking finding of iteration 3 is closed on substance and evidence, and the four nits are cosmetic cross-reference/terminology residues that change no AC, contract, oracle, exit projection, scope boundary, or closure mechanic.

This is iteration **4**, so the ~3-iteration readiness cap is exceeded. Escalation is **not** required because the verdict is READY: the loop terminated on a passing gate, not on a stalemate. Had this iteration still been NOT_READY, the cap would have required human escalation with **test_planning** as the single phase to reopen (the only blocking gap was a test-plan mirror); that contingency did not arise.

Recommended next action: `@pm` records this verdict through the `commit` primitive (or `phase complete GH-293 dor_check`) and proceeds to lifecycle phase 6 (`delivery`) with the plan as revision 1.3. The five nits may be folded into the next touch of each artifact at zero risk; none of them blocks delivery, and none should reopen a phase on its own. Finding 1 (persistent across iterations 3 and 4) is the one to carry forward into the delivery notes so it is not silently forgotten.
