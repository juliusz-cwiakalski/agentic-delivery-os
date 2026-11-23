# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-394
Date: 2026-11-24
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: FAIL

## Facet Basis (evidence, not vibes)

- **spec_completeness PASS.** All six owner comments are encoded: D1–D11 (spec DEC-1..DEC-13, §5.1), symlink-resolved correction (DEC-6, AC-F2-2), `(reason, style)` per-entry remedies with host-aware/neutral texts (DEC-7, Appendix B), C-10 inert (NG-8, DEC-13, AC-F7-1 absence arm), tripwire enumerates host coordinates from configuration and passes on absence (F-7, TC-TRIP-001 step 5), boundary per READ ORDER (§7.2, NG-1..NG-10, §7.3), remedy-wording comments verbatim (Appendix B), OQ-1/OQ-2 delivery-time confirmations (§14), registerEdgeSecrets three sites (F-5, OQ-3), C-8 checked proof (AC-F6-3), ADR-0014 landing mechanics (§7.1, §18, plan phase 6 ADR fence). Appendix C maps the 10 owner-restated ACs one-to-one.
- **ac_quality PASS.** 20 ACs in Given/When/Then (spec §17), testable, non-overlapping, each linked to F-/DM-/NFR- ids.
- **test_traceability PASS.** Coverage matrix (test plan §3.1) maps all 20 ACs to the 37 TCs; no orphan TC; TC-COMP-004 correctly manual/post-merge, never a gate.
- **decision_capture PASS.** Change decisions in spec §15 (DEC-1..13) + plan header constants; system decision routed to ADR-0014 (Proposed, lands phase 6); OQ-T7 owner preference parked to PR as ruled.
- **Hermeticity probe (passing):** four injected seams, behaviour-based preload guard with misbehaving-probe mutation control, register-after-compose oracle with a sensitivity control (TC-REDACT-001 step 4), cap tests via declared short timeouts plus constant pinning — no hidden live dependency found in the planned environments. The only defect is the seam-count wording (Finding 7).
- **Traceability probe (passing):** every AC ↔ TC ↔ phase ownership resolves (phase 1 goldens feed TC-COMPAT-001; phase 5 owns 36 automated TCs + TC-COMP-004 manual). No orphan AC, no orphan TC, no phase-less TC.

## Findings

1. [critical] cross_artifact_consistency — spec §8.2/§10/AC-F4-2 + plan.yaml:57-63 (forwarding fence) and plan.yaml:4-6 (escalation trigger) vs TC-REMEDY-003 step 2 / TC-REDACT-001 surface list (test plan) vs code truth
   Gap: The **park/log-line surface is engine-owned and reconstructs/drops the failure variant**, so AC-F4-2's "fields survive on every surface (... park/log line)" and §8.2's "the classified reason is carried in the rendered refusal and the log line" are **unimplementable within the declared scope**. Verified in code: `packages/core/src/provider/engine.ts:296-310` builds park evidence from `{failureClass: "config.credential.missing", credentialRefName}` and discards the resolved failure object; `engine.ts:789-806` reconstructs `config.credential.missing` from the parked condition with a detail string only; the announcement line derives from `packages/core/src/provider/announcements.ts:48` (code mapping only). `engine.ts` is change-forbidden (plan fence) and `announcements.ts` is undeclared. The plan's answer — "TC-REMEDY-003's park/log-line arm proves survival WITHOUT engine edits; STOP if a reconstruction is found" — defers a contradiction that is **already verifiable at the gate**: the reconstruction exists, so the escalation trigger fires deterministically at phase 5, mid-delivery. A plan whose own header predicts a STOP is not a deliverable plan.
   Suggested remediation target phase: specification (primary), delivery_planning
   Suggested fix: Choose one and write it down before delivery: (a) spec pins the declared mechanism by which source/reason/remedy reach the park/log line without engine edits (e.g., the resolver emits the classified refusal log line as the referenced surface) and TC-REMEDY-003's arm asserts that mechanism; (b) owner reopens the engine.ts forwarding constraint (owner act — outside delivery, per the plan's own trigger); or (c) re-scope AC-F4-2/§8.2/TC-REMEDY-003 to the in-scope surfaces and state explicitly that the quota-path park line keeps the delivered announcement-only shape.

2. [major] plan_code_area_coverage — plan.yaml phase 4 scope (lines 173-184) vs spec §2.1 ("37 enumerated sites across 16 files") vs code
   Gap: The **merge credential-refusal chain reconstructs and drops the new fields in files no phase declares**: `packages/cli/src/commands/merge.ts:79-91` (envelope builder; `trustedRefusal` marker only), `packages/core/src/domain/merge-transaction.ts:362-374` (closed `MergeFailure` type — no source/reason/remedy members), `:296` (closed `MergeFailureEvidence`), `:604-620` (`landingFaultIdentityOf`/`landingFaultFailure` reduce the port failure to a code string), `:2023` (`renderMergeFailure`), `packages/cli/src/output/merge-text.ts:80` (`renderMergeRefusal`), plus undeclared `packages/cli/src/commands/dispatch.ts:69`, `packages/core/src/provider/simulate.ts:438`, `announcements.ts:48`. The merge refusal renders on human output + JSON envelope — both AC-F4-2 surfaces. The plan's forwarding fence ("every site that reconstructs must forward") cannot be executed or reviewed against a scope that does not contain the sites; the "37 sites across 16 files" enumeration lives in no committed artifact the coder can verify against.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add the reconstruction-site→file map to the plan (or land it via ADR-0014's context section in phase 6, before phase 4 needs it is not possible — so in the plan itself); extend phase 4 scope to the merge chain or declare each exempt site with the reconciled rule from Finding 5.

3. [major] plan_coverage — plan.yaml phase 7 comment (lines 237-238, 249-250) vs `.opencode/agent/doc-syncer.md:14` ("Do not modify source code")
   Gap: The companion update to `tests/checks/tracker-credential-provisioning-guide.test.ts` — which pins the exact sentence this change reverses (`.../tracker-credential-provisioning-guide.test.ts:34` asserts `toContain("only an environment source")`; guide line 19 carries it, line 33 carries the "never runs `gh auth token`" twin) — is assigned to **doc-syncer, whose contract forbids source-code edits**, with "no coder task exists for them". The pairing intent is right (the pinning test must move with the guide reversal) but the executor assignment is outside remit, and splitting doc edit vs test edit across owners leaves **no committed plan for a red-window-free sequencing**: whichever lands first, the pinning check is red until the other lands, and nothing owns that window.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Give the test re-pin to an owner within remit (a declared coder micro-task in phase 7 — the test file is not a doc, so the "no doc edit leaks into delivery phases" fence is not violated) and commit the guide reversal + test re-pin **together in one commit**; doc-syncer owns only the doc edits. State the sequencing explicitly so phase 8/9 never observe a red gate attributable to the pairing.

4. [major] dod_defined — chg-GH-394-spec.md (no Definition of Done section; §17 ACs, §18 rollout narrative only) and chg-GH-394-plan.yaml (no DoD checklist)
   Gap: No clear, testable Definition of Done exists in any artifact. The DoR mirror is explicit that delivery cannot start without one (`doc/guides/definition-of-ready.md:44-46`), and house precedent mirrors the plan's DoD checklist to the spec's DoD predicates item-for-item (cf. `doc/changes/2026-10/2026-10-30--GH-181--primitive-ports-credential-metadata/readiness-review/readiness-iter-1.md` finding 9).
   Suggested remediation target phase: specification
   Suggested fix: Add a DoD section with testable predicates: 20/20 ACs with traceable passing evidence; gate battery green (pnpm check incl. new tripwire; doc-distribution guard; decision-record content check); ADR-0014 landed as `Proposed`/`decision_date null` with index+register rows; guide reversal + re-pinned pinning check green; minor changeset recorded; OQ-1..OQ-3 typed outcomes recorded; real-store demo named manual/post-merge; open PR targeting main-tools with green CI.

5. [minor] system_spec_consistency — spec F-4 (chg-GH-394-spec.md:140) vs committed merge-landing rule (packages/core/src/domain/merge-transaction.ts:595-609: "the port's own failure token never reaches the evidence"; TDR-0012 name-only diagnostics)
   Gap: The new "fields survive every propagation site" requirement contradicts the delivered name-only evidence rule on the merge/landing path. The spec neither declares the supersession for credential refusals nor exempts the landing-fault mapping — two committed truths left in conflict, and §18's doc-reconciliation list does not include the posture note.
   Suggested remediation target phase: specification
   Suggested fix: State explicitly that F-4's identifier-only `source` + closed-set `reason` + fixed `remedy` supersede the name-only evidence rule for credential-shaped refusals (or exempt `landingFaultFailure` with the reason), and add the reconciliation note to §18's scope.

6. [minor] plan_doc_update_coverage — plan.yaml phase 7 scope (lines 241-250) vs pm-notes doc-impact note (chg-GH-394-pm-notes.yaml:110-123)
   Gap: pm-notes lists `doc/spec/features/feature-resident-daemon.md` and `feature-harness-adapters.md` as conditional reconciliation targets ("only as the forward-looking/construct-input sections require"); phase 7's declared doc scope omits both without an explicit exclusion. doc-syncer reconciling them would edit outside the declared boundary.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add the two files to phase 7's scope or record the explicit exclusion with its reason in the phase comment.

7. [nit] cross_artifact_consistency — plan.yaml:114, :167 ("store facts" among resolver construction inputs) vs test plan TA-1 (:1170) and the hermeticity fence (plan.yaml:64-69), which say exactly FOUR seams
   Gap: Seam-count wording drift; TC-HERM-001 and the strategy-construction assertions are expressed against "the four injected seams".
   Suggested remediation target phase: delivery_planning
   Suggested fix: Fold "store facts" into the four named seams or declare the fifth seam in TA-1 and the fence.

8. [nit] cross_artifact_consistency — test plan §2 (chg-GH-394-test-plan.md:13, :47) and OQ-T4 (:1184) still call the plan "pending — authored in phase 4" and defer the version window to delivery
   Gap: Stale pointers; the plan now fixes the window (`>=2.3.2 <3.0.0`, plan.yaml:40-43) and all OQ-T constants (plan.yaml:21-46).
   Suggested remediation target phase: test_planning
   Suggested fix: Refresh the two stale references so no delivery agent hunts for constants that already exist.

## PM Rulings — critique outcome

- **NG-10 ruling**: confirmed consistent with spec NG-10 (§4.2), §10, and the #398 boundary. No finding.
- **Constants closed by the plan**: confirmed at plan.yaml:21-46; TC-ALLOW-004/TC-EXEC-002/TC-HARNESS-007 correctly express boundaries against the named constants. No finding.
- **OQ-T6 (MCP placeholders under F-4 via TC-REMEDY-003)**: accepted — TC-REMEDY-003 step 2 names the MCP serve state placeholders explicitly; AC-F4-2's parenthetical reads as inclusive. No finding.
- **OQ-T7 (non-pinned cells contract-only)**: accepted — TC-REMEDY-002 step 3 asserts the content contract; byte-pinning preference correctly parked to PR review. No finding.

## Probe Answers (queued by PM)

- **engine.ts forwarding fence**: NOT credible as planned — Finding 1 (critical). The park/log-line arm of TC-REMEDY-003 is unimplementable without engine/announcements involvement; the STOP trigger fires deterministically.
- **Guide-pinning pairing**: intent sound, ownership broken — Finding 3 (major). doc-syncer cannot edit the test; no red-window-free sequencing exists as written. Phase 7 is the right stage; the executor split is the defect.
- **Hermeticity vs C-1 proof**: credible — Finding 7 (nit) only. Four seams, behaviour-based guard, mutation controls; no live dependency.
- **AC traceability**: clean — 20/20 ACs ↔ 37 TCs ↔ phase ownership; no orphans.

## Decision Routing

- Finding 1 option (b) (reopen the engine.ts constraint) is a **system/owner decision**: route to the owner via @pm if the authors choose it; options (a)/(c) are change-doc edits and need no human input.
- No `needs_human_input` finding; Pause Required: no.

## Gate Result

**NOT_READY** — reopen `specification` (Findings 1, 4, 5), `delivery_planning` (Findings 2, 3, 6, 7), and `test_planning` (Finding 8). DoR findings never reopen `delivery`. Re-run this gate after the artifact revisions; iteration cap ~3.
