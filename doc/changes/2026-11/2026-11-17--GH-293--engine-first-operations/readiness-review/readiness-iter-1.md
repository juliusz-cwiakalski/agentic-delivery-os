# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-293
Date: 2026-11-18
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

## What I verified (not findings)

Artifacts read: spec v1.1, test plan v1.1 (44 cases, TC-ENGINE-001..095), plan YAML (7 phases), pm-notes, TDR-0031, issue #293 body + owner comment (2026-11-15), M2-S16 backlog story, SC-M2-S16-01/02/03, and the delivered current truth (`feature-dispatch-engine.md`, `feature-projects.md`, `feature-peak-pausing.md`, `feature-merge-verify-deploy.md`). Source was read only to verify factual claims the plan depends on:

- `packages/cli/src/production.ts:1477-1480` composes merge with `values: () => ({})` and `credentialRefusal` reads — the spec's merge-defect description is accurate; `config.credential.missing` is `domainKind: "config"` (`error-table.ts:395`), `fallback.internal` is `platform-provider` (exit 2), and `classify.ts` contains the kind/code contradiction — the defect chain is as stated.
- `resolveDispatchIdentity` (dispatch-identity.ts:109-138) resolves marker → scheduler → remote, so the spec's "persisted binding governs, then remote" is correct for the fleet path (no scheduler key), and `resolveProductionRepository(..., { persist: false })` exists as the non-persisting seam the plan consumes.
- `revertDispatchHandoverEvidence` (app/dispatch-gate.ts:266-286) answers the already-`dual-run` noop **before** `readDispatchGate` — DEC-12's "declared, not new" exemption is factually grounded, and Phase 3's "preserve the read order" is implementable.
- `readProjects` already creates one state store per `ready` row and reads the handover ledger (production.ts:2599-2621); `readRepos` is a projection (`reposListDataOf`) and the flat alias does not pass through it — the hosting claim and the byte-compatibility claim hold.
- `REPOS_ENTRY_FIELDS` has exactly the five delivered fields; `handoverConditionsSnapshot` (record shape) is distinct from the new `DispatchConditionStatus[]`; `DELIVERY_RESULT_TOKENS` has exactly 11 tokens (the SC-02 forcing fact); all 44 case suites/controls named in the test plan exist except the new ones the plan declares.
- Every file listed in a phase `scope.files` exists (or is a declared new file); every suite named in a phase gate exists or is declared; the plan's "declared controls, not edits" list does not collide with Phase 4's edited `repos-list-contract`.
- The merge-defect scope interpretation is accepted: the owner-authored comment is on this ticket and carries a "Needed:" list, and the story task "operate dispatch through the engine for regular delivery" cannot hold while the lifecycle merge path refuses every ref. It is recorded (DEC-8, OQ-3, pm-notes), surfaced for PR review, and not hidden expansion. See F-5 for the one clarification still owed.

## Findings

1. [critical] decision_capture + cross_artifact_consistency — `doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md` D2 and its exact-shape block vs `chg-GH-293-spec.md` §15 DEC-12 / AC-F2-3 / Appendix E
   Gap: TDR-0031 D2 says `conditions` is "**always present** with exactly four entries" and the handover shape block repeats "`conditions: [{condition, status} x4], // always present`" (lines 497, 589). The spec's v1.1 exemption declares the idempotent revert noop evidence-read-free with **no** `conditions`, and the test plan asserts that absence (TC-ENGINE-010/011/016). Phase 1 lands the TDR *unchanged* ("as authored"), so this change would ship a binding decision record that contradicts its own delivered contract and its own test oracle. The record also predates the amendment (mtime 23:16 vs spec 23:39) and therefore lacks the three other decisions v1.1 declares — the owner-principal source (DEC-13), the emittable-code constant (DEC-14), and the row repository binding (DEC-15) — each of which is precedent-setting beyond this change (it fixes how every merge resolves its principal and how every fleet row binds to a repository identity).
   Suggested remediation target phase: specification
   Suggested fix: Have `@decision-advisor` amend TDR-0031 (or add a dated addendum) recording (a) the single evidence-read-free exemption with its reason and its bound (exactly one outcome), (b) the owner-principal source, (c) `MERGE_COMPOSITION_EMITTABLE_CODES`, (d) the read-only non-persisting row binding; update D2 and the shape block to match, and record the owner's acceptance of the narrowing. Alternative (weaker): retract DEC-12 and make every handover outcome carry `conditions` — but that reintroduces the torn-ledger refusal this change deliberately removes, so amending the record is the right fix.

2. [major] cross_artifact_consistency — `chg-GH-293-test-plan.md` §5.2 TC-ENGINE-052 step 1 (line 1072)
   Gap: The case asserts the missing-credential merge dry run exits **2** "as the declared exit for the `config` row's projection class". `config.credential.missing` declares `projectionClass: "user-validation"` (`error-table.ts:399-401`), and `projectExitCode` maps `user-validation → 1` (`packages/cli/src/projection.ts:10-15`). Exit 2 belongs to `fallback.internal` (`platform-provider`) — i.e. the *defect* this change repairs. Delivered as written the case fails, or invites an exit-class special case that NG-7/NFR-5 forbid. Related: the spec never states that this path's observable exit moves 2 → 1, so a reviewer can read the change as breaking the delivered exit behaviour.
   Suggested remediation target phase: test_planning
   Suggested fix: Assert the exit derived from the resolved row's `projectionClass` (expect 1 for `config.credential.missing`), and add one sentence in the spec (AC-F6-10/AC-F7-11 or §8.5) recording that the credential-read path now projects its declared class at exit 1 instead of the contained fallback's exit 2, with the exit vocabulary itself unchanged.

3. [major] system_spec_consistency + plan_doc_update_coverage — `AGENTS.md:50` and `doc/guides/change-lifecycle.md:77` vs AC-F4-8 / spec §5.1 F-4 (line 186)
   Gap: Both lifecycle documents still state "`deliver-ticket.sh` and `ceo-loop.sh` remain retained primary entry points", while AC-F4-8 requires the engine to be "the documented regular delivery path" with the shell as "the documented fallback". The spec explicitly declines to rewrite `AGENTS.md`-level instructions and the plan's Phase 6 scope contains neither file, so the change can pass AC-F8-12's six-page + guide checks while two of the repository's own operational documents assert the opposite primary path.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `AGENTS.md` and `doc/guides/change-lifecycle.md` to Phase 6 scope with a bounded edit of those sentences (engine is the regular path; the shell entry points remain the supported fallback), and extend the Phase 6 doc-reconciliation case to assert the corrected wording — or, if the owner prefers those documents unchanged, record the contradiction as an explicit accepted residual with owner sign-off instead of leaving it implicit.

4. [major] plan_coverage — `chg-GH-293-plan.yaml` Phase 7 (lines 768-771 and 810-811) vs AC-F8-12
   Gap: AC-F8-12 requires that `doc/quality/test-specs/test-spec-dispatch-engine.md` and `test-spec-merge-verify-deploy.md` "are reconciled to the delivered contracts in the documentation phase (phase 7, `@doc-syncer`)". The plan pre-authorizes closing without that reconciliation: "If lifecycle phase 7 has not run when Phase 7 executes, the two rows are untouched and the obligation stays recorded as a residual of this plan", and Phase 7's exit list says the handoff is "either satisfied or recorded as the residual this phase declares". A plan whose exit criteria admit an unmet acceptance criterion contradicts the DoD gate ("every AC met") and will surface as a stalemate in phase 10.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Remove the residual escape hatch. Declare the reconciliation as a mandatory closure obligation with its owning phase and commit path (lifecycle phase 7 gives `@doc-syncer` the two files; the plan already declares them so the edit is committable), and make Phase 7's exit condition "satisfied" only. If the reconciliation genuinely cannot be owned by this change, move the obligation out of AC-F8-12 into a declared follow-up and state it in the spec instead of in a plan contingency.

5. [minor] spec_completeness — `chg-GH-293-spec.md` §15 DEC-8 / OQ-3 and `chg-GH-293-pm-notes.yaml`
   Gap: The merge-composition scope rests on an owner comment whose "Needed:" list was written for the GH-320 incident (landed via CEO-D-097) rather than for M2-S16. The interpretation is defensible and I do not dispute it, but the spec records only that the owner scoped it; it does not record that the scope is confirmed at PR review (the TDR-0031 owner-acceptance clause covers the record, not the scope), nor that GH-320 already consumed the workaround.
   Suggested remediation target phase: specification
   Suggested fix: Add one sentence to DEC-8 (and the pm-notes decision entry) making the confirmation explicit: the merge restoration is in scope on the authority of the 2026-11-15 owner comment, is confirmed by the owner at the GH-293 PR review, and is the second consumer of the same defect already routed around under CEO-D-097.

6. [minor] spec_completeness — `chg-GH-293-spec.md` §5.1 F-3 / DM-4 and §24 Appendix A (fleet row shape)
   Gap: The fleet row's evaluation needs a repository *scope*, and the scope selects the counted evidence class (`COUNTED_EVIDENCE_CLASS`: `production → pilot`, `controlled → controlled-proof`, `domain/dispatch-gate.ts:33-41`). Neither the spec nor the plan declares which scope the row folds with, yet AC-F3-5/NFR-10 require the row's `cleanDispatches`/`conditions` to equal the summary's over the same ledger — a comparison that is only meaningful when both use the same scope. The delivered production composition fixes `scope: "production"` for the gate surfaces (`production.ts:2250`, `2285`), so the answer exists but is implicit and untestable as stated.
   Suggested remediation target phase: specification
   Suggested fix: Declare in F-3/DM-4 (and mirror it in plan Phase 4) that the fleet row evaluates with the production scope, the same counted class the shipped summary and handover use, so the cross-surface equality has one declared basis.

7. [minor] decision_capture — `doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md` "Unresolved Questions"
   Gap: The record's open questions (provider reads in this change or not; lanes-gap remedy; runbook vs feature reference; out-of-repo consumers of the summary) remain unchecked, although spec OQ-1..OQ-3 resolve three of them. Landing the record "as authored" leaves a binding document asserting open questions beside a spec that answers them, and its D5/D1 summary wording ("documented defect") differs from the spec's cited resolution (a known limitation, defect optional).
   Suggested remediation target phase: specification
   Suggested fix: Resolve the checkboxes in the same amendment as F-1 and align the D5/D1 wording with OQ-2's resolution.

8. [minor] dod_defined — `chg-GH-293-spec.md` §17 (no change-specific Definition of Done)
   Gap: The repo convention requires every change to define its own DoD in its spec (`doc/guides/definition-of-done.md`: "Every change **must define its own DoD** in its spec"). GH-293 defines 14 ACs plus AC-NFR1-14 and a plan-level Phase 7 exit battery, which functionally serve as the DoD, but the spec never names a change-specific DoD, so phase 10 has no single spec-side checklist to verify against.
   Suggested remediation target phase: specification
   Suggested fix: Add a short "Definition of Done (change-specific)" subsection under §17 (or §18) that states: all 14 ACs verified; every declared plan phase complete with per-phase pm-notes evidence; the six feature pages, the new redistributable guide, the two broader test specs (phase 7), and the corpus restatements landed; TDR-0031 landed and amended (F-1); no repository flipped and zero authoritative records; `TMPDIR=$PWD/tmp/tmpdir pnpm check` plus the doc-distribution and shell suites green.

9. [minor] test_traceability — `chg-GH-293-test-plan.md` §3.5 TRUNC-ENG-1 and §7 TC-ENGINE-024
   Gap: The truncation fixture asserts `truncation: { bound: 5000, omittedRecords: 5 }` while the same fixture row also seeds "+ one foreign record". The attempt read is bounded over the whole ledger before the repository scope filter (`app/dispatch-ledger.ts:151-156` keeps the most recent `max` records and reports `total - max`), so with 5,005 identity-bound plus one foreign record the expected omission is 6, and the visible identity-bound count may be 4,999. The exact literal therefore encodes a coincidental arithmetic rather than the contract.
   Suggested remediation target phase: test_planning
   Suggested fix: Derive the expected `omittedRecords` from the fixture's actual seeded record count (or assert the contract: `bound == the delivered constant`, `omittedRecords > 0`, and `countedDeliveries < seeded identity-bound count`), and keep the printed record count and elapsed time as the diagnostic.

10. [nit] plan_coverage — `chg-GH-293-plan.yaml` OQ-TP-6 placement (lines 94-102)
   Gap: The refusal code for a ref whose request does not resolve stays delivery-bound, with `merge.transaction-aborted` named as a candidate "never re-meaned". Reusing a code whose declared consequence is "aborted cleanly before any landing mutation" for a resolution failure is semantically thin, and AC-F7-11's totality test cannot detect a wrong-but-declared choice.
   Suggested remediation target phase: delivery_planning
   Suggested fix: State the selection criterion, not just the candidate: the chosen member must name a failure whose declared summary/consequence matches "the ref's request could not be resolved", and the case must assert the declared row's `summary` shape in addition to kind/code agreement.

## Gate result

NOT_READY. One blocking (critical) finding and three major findings. The single upstream phase to reopen is **specification** (F-1 is the decisive one; F-5, F-6, F-7, F-8 are cheap to fold into the same pass). F-2 and F-9 belong to **test_planning**; F-3, F-4 and F-10 belong to **delivery_planning** — those reopens follow after the specification pass, in that order. Delivery is not reopened.

No pause flag: the merge-defect scope interpretation is authorized by the owner-authored comment on this ticket and is recorded, so no human input is required to proceed; the PR review remains the confirmation point (F-5).
