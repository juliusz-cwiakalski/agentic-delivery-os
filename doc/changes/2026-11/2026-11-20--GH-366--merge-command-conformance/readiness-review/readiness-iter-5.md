# Readiness Review Iteration 5

Verdict: NOT_READY
Work Item: GH-366
Date: 2026-11-22
Pause Required: yes

## Basis of review

- Artifacts read: `chg-GH-366-spec.md` (**v2.4**, 1889 lines, 27 AC ids),
  `chg-GH-366-test-plan.md` (**v1.6**, 4178 lines, 54 cases),
  `chg-GH-366-plan.yaml` (**v15**, 1835 lines, 7 phases), and
  `chg-GH-366-pm-notes.yaml` (441 lines; CEO-D-116 recorded as a decision
  entry; top-level `branch` present).
- Prior records read: `readiness-iter-1.md` … `-iter-4.md`. Iteration 4's
  dispositions were **re-verified against the amended artifacts**, not accepted
  from the change summary (see the disposition table below).
- Decision records re-read: TDR-0072 (dated amendment row 2026-11-22, line 508)
  and TDR-0073 (dated amendment row 2026-11-22, line 503) supersede the
  count-shaped premise and recount the AC inventory at 27; both stay
  `Proposed`, no challenge or acceptance claimed. TDR-0071 untouched;
  TDR-0074/0075 exist on `main-tools`; TDR-0076 free — as the pm-notes state.
- **Source ticket fetched in this session** (read-only): issue #366 is OPEN;
  the CEO-D-116 ruling (comment 2026-11-22T15:13:00Z) matches the shape the
  artifacts implement point for point, and the only later comment
  (2026-11-22T18:13:57Z) is the intake acknowledgment of the same ruling plus
  the two folded findings — **no new requirement post-dates the ruling**, so
  the gate is run against current ticket state.
- **Tree re-verified in this session** (not accepted from the artifacts):
  `findMergedDeliveryRequest` collapses every non-2xx fault to
  `{ observation: "invalid", detail }` and only `provider.not-found`/no-match
  to `{ observation: "unavailable" }`, discarding `code` and `httpStatus`
  (`packages/adapters/src/github/client.ts:478,485-492`); the transport layers
  classify every non-2xx except 404 as `providerPayloadFailure`
  (`client.ts:311-323`); the delivered auth discrimination lives in
  `mergeReadCodeOf`'s `httpStatus === 401 || 403` rule over `{code,
  httpStatus}` failure objects (`packages/cli/src/production.ts:2541-2552`);
  `readDeliveryRequest` preserves the raw failure object and returns it
  (`client.ts:128,438-441`), so the mergeability read's fault classes stay
  distinguishable; `CloseoutReadObservation`'s arms are as iter-4 recorded.
- Mechanical re-derivation in this session: 54 index rows = 54 detail
  headings = 54 unique ids = 54 `Plan Phase(s)` lines; 0 duplicates, 0
  missing ids in TC-MRG-001…054; allocation 0 / 9 / 19 / 17 / 3 / 5 / 1 = 54;
  **the plan's TC allocation index ≡ the test plan's per-case phase lines,
  case for case, no case owned twice, no orphan** (verified by script); 27/27
  AC ids carry coverage; DOD-1's arithmetic adds up (22 + 2 + 1 + 2 = 27); the
  plan parses as a schema-strict `delivery.plan.v1` (7 phases, no `tasks`
  key), `tier: full` with 18 escalation triggers that carry the ruled shape
  (no-suppression, fault-is-not-zero, the mergeability trigger, the closeout
  boundary); no live `signals.mergedMatches` / count-field reference remains
  anywhere (the surviving mentions are document-history narration, which is
  correct); no live "at most two provider reads" claim remains (survivors are
  v2.2/v2.3/v1.5 history rows); no positional
  `findMergedDeliveryRequest(workItemRef, …)` citation remains; the nine-token
  `operation` vocabulary counts out to nine plus `-` in F-3, NFR-5, §24-B and
  the test plan.
- Working tree: the amended artifacts and both TDR amendments are committed
  (`164a0927`, 2026-11-22T20:29+01:00); only `readiness-iter-4.md` is
  untracked, as declared. No artifact was modified by this gate.

## Ruling compliance audit (CEO-D-116, point by point)

The ruled shape is the ceiling; this gate audits compliance with it. Every
point is implemented faithfully:

1. **Identities, not a bare count** — implemented everywhere the count used to
   be: F-1 step 3 (spec 434-480), §7.1 (1004-1016), §8.4 (1131-1141), §16
   (shared-read row), DM-2 (1113), DEC-13 (1369, with the withdrawal stated
   in the decision text itself), Appendix A step 3 (1687-1702), Appendix B row
   17 (1757), §17.6 trace; test plan §3.1 AC-F1-4/AC-F1-6 rows, TC-MRG-005 /
   043 / 049 / 047; plan READ BUDGET header, phase-3 comment and escalation
   triggers. The count is derived; no second field exists anywhere.
2. **Fault is not zero** — a distinct outcome refusing the declared provider
   identity naming `operation=github-delivery-request-list`, never
   `no-open-request`/`merge.request-unresolved`: F-1 step 3 bullet 4 (465-470),
   Flow 7 (972-983), AC-F1-4 (1404), Appendix A step 3, NFR-2/NFR-10,
   TC-MRG-052, plan phase 3, escalation trigger 7. The member-present-empty vs
   member-absent discriminator is decidable on the delivered arms (empty ⇒
   zero on `unavailable`; absent on `unavailable` = 404-class fault; the
   `invalid` arm carries no member, so a fault is never mistaken for zero).
   One oracle defect in the new carrier case — finding 1 below; it does not
   reopen the ruled outcome itself.
3. **Member on the `unavailable` arm; closeout unchanged** — §16 shared-read
   row, §18 (1488-1494), §19 (1538-1541), DEC-13, plan phase 3's "DECLARED
   ADDITIVE-SIGNAL EDIT, NOT A CLOSEOUT CHANGE" (client.ts + closeout.ts
   scoped; `edge.ts` a declared no-edit boundary), TC-MRG-054
   (empty/singleton/multi/absent shapes, byte-identical, consumer scan with
   planted control), escalation trigger 7.
4. **Budget truth, no suppression** — honest per-path counts (1 / 2 / 2 / 3,
   ceiling 3, the read's own review-thread query counted): §4.1 (336), F-1's
   budget paragraph (548-574), Flow 6/7, §8.1 API-1/API-2 (1096-1099), NFR-2,
   NFR-10, RSK-11, §22 (1592), Appendix B preamble (1731-1745), NG-8 (365-368);
   plan READ BUDGET header (96-133), phase-3 comment, escalation trigger 5;
   TC-MRG-034 (exact per-path multiset), TC-MRG-047 (duplicate-merged sub-run
   now three), TC-MRG-053 (counted query asserted positively and the
   no-suppression option asserted negatively with a planted control).
5. **ACs keep the identity requirement; DEC-13 withdrawal; recorded in DEC-13
   plus the two TDR amendments** — AC-F1-6 / AC-F3-6 / F-3 / Flow 6 /
   Appendix B row 17 all speak identity language; DEC-13's rationale states
   the withdrawal verbatim; TDR-0072/0073 carry dated 2026-11-22 amendment
   rows superseding the count shape and recounting the inventory at 27 ids.
6. **Folded findings** — LF-1: G-7, F-1's "What the merge decision reads"
   (603-615), §8.5, new AC-F1-7 (1411) with TC-MRG-050 (phase 4, pinned
   oracle: no-mergeability-fields list entry + clean single request must
   LAND; the re-read re-reads the single request, asserted on the transport
   log; the fault names `operation=github-delivery-request-detail`), plan
   phase 4 point 8 (1322-1341), `github-delivery-request-detail` restored to
   the nine-token vocabulary with a stated reason (F-3 708-714, DEC-15), NFR-8
   recount rationale ("the ruling adds no error identity" — verified: the
   fault maps to delivered identities, the mergeability read consumes a
   delivered read, the restored token is a vocabulary member, not a row).
   LF-2: F-3 (754-758), §8.5 (1200-1204), new AC-F3-7 (1429) with TC-MRG-051
   (phase 2, exit 2, the bare phrase asserted as a named failure,
   `operation=delivery-registry`), Appendix B row, plan phase 2 (609-610,
   647-648), escalation path via AC-F3-5.
7. **"What this is not"** — no scope expansion (§7.2 `[OUT]` items), not a
   closeout change (rule 3 above), the ceiling enforced (escalation triggers
   7/8 forbid wider signals and list-shaped mergeability reads).
8. **Process** — spec → test plan → plan amended in one pass (v2.4 / v1.6 /
   v15, same day, committed together in `164a0927` with the TDR amendments;
   the untracked iter-4 record rides the next checkpoint commit per the
   pm-notes directive), and this is the single re-run of the gate.

**No finding below restates, re-litigates, or second-guesses the ruling.**
Everything the ruling decided is implemented as ruled.

## Iteration 4 findings — disposition (re-verified, not accepted)

| # | Iter. 4 finding | Disposition | Where it now stands |
|---|---|---|---|
| 1 | A count cannot name the duplicate identities | **CLOSED by the ruling (CEO-D-116 A) and implemented** | Identities member everywhere (see audit point 1); abort names each identity, presents none as *the* request; TC-MRG-049 cell (i) and TC-MRG-024's control testable again. |
| 2 | Zero has no carrier; a fault would surface as `no-open-request` | **CLOSED by the ruling and implemented** | Empty set on the `unavailable` arm is a decidable zero (TC-MRG-005); the fault is the member-absent distinct outcome (TC-MRG-052, Flow 7). |
| 3 | The "verbatim" read is two requests (thread query) | **CLOSED by the ruling and implemented** | Budget counted (audit point 4); exact-multiset cases restated (TC-MRG-034/043/049/053); no suppression option (NG-8, TC-MRG-053 negative). |
| 4 | TC-MRG-043's oracle was impossible | **CLOSED** | Restated in place (test plan 2901-2930): dry run reports the replay object (`replayed=true`, zero mutations, never `result=merged`/`squash=`, no post-landing steps — the delivered step ids asserted as **not** reported); the live replay asserts its delivered contract (one `replayed: true` transaction, empty `postLanding`). Pinned by API-2/DM-2/§16. |
| 5 | Precedence questions (duplicate vs ambiguity; head-unresolved level; scan population) | **CLOSED** | F-1 step 5 (spec 489-502): duplicate check before the ambiguity check, population is the candidate set with the equality-⊆-candidates implication stated; step 1 (414-418): `head-unresolved` is a run-level refusal, the unusable candidate never read. |
| 6 | Saturation qualification of the "0 silent selections" metric | **CLOSED** | §4.1 (337): "within the bounded pages; a saturated closed page is not detectable on this path and is deferred with OQ-6". |
| 7 | Matrix cell 17's `duplicate-merged` operation token | **CLOSED** | Both duplicate sub-runs name `github-delivery-request-list` (test plan 1776-1780), matching F-3 and Appendix B row 17. |
| 8 | "AC-F3-6 is true at the phase-2 boundary" sentence | **CLOSED** | Plan 541-547: AC-F3-6 is an end-state criterion satisfied at the boundary by its two-cause subset; the third cause lands in phase 3; "neither boundary is false". |
| 9 | NG-5 cited for the closeout boundary | **CLOSED** | Plan phase 3 cites "the §7.2 `[OUT]` item on the shared read, and OQ-6" (858-861). |
| 10 | `feature-provider-client-seeds.md` in no phase scope | **PARTIALLY CLOSED — PERSISTENT** | Discharged in spec §16 (shared-read row names the page and both statements that move) and test plan §7.4 (names the page with the two statements). **Not discharged in the plan**: the page is named nowhere in `chg-GH-366-plan.yaml` (zero matches, comments included); phase 7's goal line cites test plan §7.4 by reference but its enumerated obligation list omits the page. Finding 2 below. |
| 11 | Positional-call citation | **CLOSED** | Object form `findMergedDeliveryRequest({ workItemRef, limit: TRUTH_PROVIDER_LIMIT })` at spec F-1 (438), Appendix A step 3, NFR-2, plan header/phase 3, and the test-plan cases. |
| 12 | AC-F1-2 "governs" wording | **CLOSED** | AC-F1-2 (spec 1401): "**not read at all**, so no worktree record can govern". |

## Findings

1. **[major] cross_artifact_consistency / test_traceability — test plan
   TC-MRG-052 expected outcomes (3601-3605) vs spec Appendix B
   `provider.outage` row (1772) and the delivered read boundary
   (`packages/adapters/src/github/client.ts:478,485-492`;
   `packages/cli/src/production.ts:2541-2552`; the transport's
   `providerPayloadFailure` classification at `client.ts:311-323`)
   Gap: the case asserts a **per-fault-class identity mapping the delivered
   seam cannot produce and the spec's own refusal matrix contradicts**.
   TC-MRG-052 parameterizes three fault classes and expects three distinct
   identities: "`provider.outage` for the transport and unclassified cells,
   `provider.auth.rejected` for the auth cell, and the delivered
   payload-invalid mapping for the payload cell". But the delivered
   `findMergedDeliveryRequest` collapses **every** non-2xx fault — HTTP 500,
   HTTP 401/403, connection failure — and every unparseable payload into the
   same observation `{ observation: "invalid", detail }`, discarding the
   `code` and `httpStatus` that the delivered auth discrimination
   (`mergeReadCodeOf`'s 401/403 rule) requires. All three fault cells are
   observationally identical at the seam. `provider.auth.rejected` is
   therefore unproducible for the auth cell without widening the shared
   read's fault observation — a second additive change to the shared read's
   contract beyond the ruled identities member, which no artifact declares
   and the ruling reserves ("the shape above is the ceiling; anything beyond
   it is a new decision"); the plan's phase-3 declared edit is "exactly one
   additive optional member … and NOTHING ELSE". The spec itself resolves the
   question the other way: Appendix B's `provider.outage` row enumerates "the
   merged-request read's **transport, auth or payload** fault" — all three
   classes on ONE row, one identity. A coder implementing per the spec fails
   the case's auth (and payload-distinctness) assertions in phase 3's gate; a
   coder implementing per the case must widen the shared read beyond the
   ruling. Note the neighbouring cases are sound: TC-MRG-050's fault cell and
   TC-MRG-014/TC-MRG-022's cells drive reads that preserve the raw failure
   object (`readDeliveryRequest` returns it; the open list returns it), so
   their per-class mappings are producible — the defect is confined to the
   merged read's collapsed boundary. TC-MRG-052's remaining assertions (the
   distinct outcome, `operation=github-delivery-request-list`, never
   `no-open-request`, budget 2, the paired zero control with TC-MRG-005) are
   correct and are the ruling's actual requirements — only the per-class
   identity refinement exceeds both the spec and the seam.
   Blocks: yes — a phase-3-owned case red by construction in the phase whose
   gate runs its suite, resolvable only by an unauthorized oracle narrowing
   or an unruled contract widening (same shape as iteration 4, finding 4).
   Suggested remediation target phase: test_planning
   Suggested fix: assert **one** declared identity for all member-absent
   fault cells — `provider.outage`, per Appendix B's enumeration and the
   delivered mapping's default (`mergeReadCodeOf` resolves non-401/403
   `provider.payload.invalid` to `provider.outage`) — keep the three fault
   classes in the precondition as coverage of the collapse, keep the paired
   healthy-read/empty-set control, and state in the case that the delivered
   boundary does not distinguish the classes. Optionally (specification, may
   ride the same mechanical pass): tighten F-1 step 3 / AC-F1-4's
   "(provider.outage, or the delivered payload-invalid mapping)" parenthetical
   to say the delivered payload-invalid mapping resolves to `provider.outage`
   at this seam, so the criterion and Appendix B read as one.

2. **[minor] [PERSISTENT — iteration 4 finding 10, plan half still open]
   cross_artifact_consistency / plan_doc_update_coverage —
   `chg-GH-366-plan.yaml` (whole file; phase 3 scope, phase 7 scope and
   comment block) vs spec §16 (shared-read row) and test plan §7.4
   Gap: the provider-client current-truth page
   (`doc/spec/features/feature-provider-client-seeds.md`) is declared as a
   moving documentation surface by the spec ("its operation set and its
   read-observation discriminator move with this member in the same change's
   reconciliation") and by the test plan (§7.4, naming the page and the two
   statements), but it is named **nowhere in the plan** — not in any phase's
   `scope.files`, not in any comment (zero matches file-wide). Phase 7's goal
   line cites test plan §7.4 by reference, but its enumerated doc-obligation
   list names eight other surfaces and omits this page, so a coder following
   the enumeration reconciles everything except the one page whose
   discriminator statement this change amends. The observation shape changes
   in phase 3 (the `unavailable` arm gains the member); the reconciliation is
   phase 7's.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add the page to phase 7's `scope.files` and to its
   enumerated obligation list (or to phase 3, where the arm changes), per
   iteration 4's original remediation.

3. **[nit] spec_completeness — spec F-1 step 3 (465-468), AC-F1-4 (1404),
   Flow 7 (978) vs Appendix B `provider.outage` row (1772)
   Gap: the fault outcome's parenthetical "(provider.outage, or the delivered
   payload-invalid mapping, for a payload the read cannot parse)" reads as
   two possible refusal identities, while Appendix B places all three fault
   classes on the single `provider.outage` row. Appendix B governs and the
   delivered mapping agrees (non-401/403 payload-invalid resolves to
   `provider.outage`), so the criterion is decidable — but the parenthetical
   is what TC-MRG-052's author over-read into three identities (finding 1).
   Suggested remediation target phase: specification
   Suggested fix: state that the delivered payload-invalid mapping resolves
   to `provider.outage` at this seam (may ride the same mechanical pass as
   finding 1).

## Notes that are not findings

- **The one blocking finding is genuinely NEW ground.** Nothing in it
  restates the ruling: the ruling fixed the fault outcome's existence, its
  operation token, and its never-`no-open-request` rule — all implemented and
  correctly asserted. The defect is that the new carrier case over-specifies
  the fault's **identity mapping** in a way the spec's own refusal matrix
  does not and the delivered boundary cannot produce. Iterations 1–4 never
  examined this surface (the fault outcome did not exist before the ruling).
  Because this was the final authorized iteration on the ruled ground, the
  finding is **escalated to the human** with this record. The escalation is
  narrow: the fix is author-level and sits inside the ruled ceiling (the
  spec's Appendix B already declares the answer), so the human need only
  authorize one mechanical `test_planning` reopen (or direct the correction
  to ride delivery with the named fix) — no new owner ruling on the merged-
  truth shape is required.
- The dry-run replay oracle is now declared, not invented: API-1/API-2/DM-2/
  §16 state the dry-run report gains the resolved object and the
  `replayed` flag, so TC-MRG-043's restated assertions have a contract
  carrier (this closes iteration 4, finding 4's "unspecified behaviour
  change" alternative).
- The 54-case allocation, the 27-AC inventory, DOD-1's arithmetic, §17.6's
  owner trace (now carrying AC-F1-7 and AC-F3-7 rows), the validation
  checklist recount, the plan's index and the golden-movement table (13 → 15
  → 19, unchanged from v1.5's declaration) agree exactly and are disjoint;
  the plan's SOURCES cite spec v2.4, test plan v1.6 and the amended records.
- Escalation trigger 5 now states the per-path counts including the counted,
  never-suppressible thread query; trigger 7 carries the fault-is-not-zero
  and closeout-unchanged rules; trigger 8 carries the mergeability trigger
  naming AC-F1-7/TC-MRG-050 — the ruled shape is guarded at the phase
  boundaries, not only described.
- The identity arithmetic is recounted and unchanged with the rationale
  stated (NFR-8: "the ruling adds no error identity"); the base at
  `origin/main-tools` `7cc71cd1` still supports 170 / 170 / 169 / 68 /
  `+ 136`, kind 9, and 167 stays a banned stale total.
- `decision_capture` passes: the ruling is recorded as a pm-notes decision
  entry (with the folded findings and the verification-precondition choice
  the ruling offered), in spec DEC-13 + §24-C + Appendix C, and in the two
  TDR amendment rows; the iteration-4 escalation question is dispositioned;
  TDR-0076 remains free and no new record id is claimed.
- `dod_defined` passes: DOD-1…DOD-8 are testable and evidence-bound; DOD-1's
  27-id arithmetic adds up; DOD-5 pins the recounted totals.
- Ticket state: the last owner comment (2026-11-22T18:13:57Z) is the ruling's
  intake acknowledgment — it restates the same shape and the two folded
  findings with the same pinned oracles (`readDeliveryRequest`,
  `mergeable: true, mergeable_state: "clean"`, `verify gates <ref>`), all of
  which the artifacts carry. No unread owner input exists.

## What remains, and why this gate stops here

The amended set is faithful to CEO-D-116 at every point the ruling decided:
identities not counts, fault never zero, the member on the unavailable arm
with closeout untouched, the honest counted budget with no suppression option,
DEC-13's withdrawal, the two TDR amendments, LF-1 and LF-2 folded with their
oracles, the restored detail token, and the recounted-unchanged arithmetic.
Nine of ten facets pass. What remains is one new, narrowly-scoped defect in
the newest test case — TC-MRG-052 asserts three distinct fault identities
through a delivered boundary that collapses all three into one — plus the
persistent plan-scope omission of the provider-client page. The first is
blocking under this gate's own standard (a red-by-construction oracle in a
phase-gated suite); the second is the unresolved half of an iteration-4
finding. Both are mechanical; neither reopens the ruled ground.

Because this was the final authorized iteration on this ground, the blocking
finding is escalated to the human rather than looped: authorize the one
mechanical `test_planning` correction (finding 1, with finding 3 optionally
riding it), add the page to the plan's phase scope (finding 2), and re-run
this gate once — or direct that the corrections ride delivery review under
the owner's named authority.

**Recommendation: human escalation on the narrow question above. Pause
required: yes.**
