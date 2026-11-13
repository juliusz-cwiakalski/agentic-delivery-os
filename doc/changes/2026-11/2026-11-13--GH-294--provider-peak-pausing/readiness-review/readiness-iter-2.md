# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-294
Date: 2026-11-13
Pause Required: no

Reviewer: @readiness-reviewer (adversarial DoR gate, local mode). Re-verified from
scratch: spec v1.2, test-plan v1.1, plan.yaml (10 phases), pm-notes, GitHub issue #294,
backlog M2-S17, M2 contracts pack, TDR-0028/0029/0030 (on disk, Proposed), and
current-truth anchors (provider-profiles, event-taxonomy, resident-daemon,
scheduling-engine, telemetry-v2, spend, status-digest, brief, plan-schema).
`delivery-os plan validate GH-294` re-run read-only: verdict=valid, tier=full,
readyForDevelopment=true.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-1 Finding Dispositions

1. [major] TC-PAUSE-052 zero-spend interval — **CLOSED.** Test plan v1.1 rewrites the
   case to the spec's inclusive semantics: per-position fixtures seed exactly one call
   each; the clean baseline carries no seeds; strictly-pre-park excluded (step 2 quotes
   DEC-4 verbatim); the park-timestamp and window-end instants asserted **counted**
   (steps 3–5: `billableCalls == 1`, `== 1`, combined `== 2`); strictly-after outside;
   breach falsifiability retained; the expected outcome explicitly fails an open-interval
   implementation. Wording verified consistent across frontmatter summary, §1, §3.2
   (DM-5 row), §5.1 index, §5.2, and the §7 automation row. Spec F-6/DM-5/NFR-4/DEC-4
   confirmed unchanged (inclusive). TC-PAUSE-050's strictly-before/after seeds remain
   consistent under the inclusive interval.
2. [major] doc-update enumeration — **CLOSED.** `feature-scheduling-engine.md` and
   `feature-spend.md` now appear with reasons in spec §7.1 (Documentation updates bullet),
   spec §16 (System specification pages row, naming the superseded paired-one-to-one and
   hold-adds-no-park-cause statements), and the plan's DOC BOUNDARY (with the Phase 6
   code areas for spend). Plan header cites spec v1.2 and mirrors the enumeration.
3. [minor] owner-hold `--until` pin — **OPEN (persistent, expanded to major).** The pin
   now exists and binds Phase 7 with a Phase 5 record-half cross-reference, but the
   remediation introduced a deeper inconsistency against delivered truth. See new
   findings A and B below.
4. [nit] OQ-TP-5 wording — **CLOSED.** The pin now derives the lists from the spec §8
   payload enumerations and explicitly declares `stop` a superset of the EVT-1/M2
   contract fields; no delivered v1 kind's list changes.

## New Findings

A. [major] system_spec_consistency (cross_artifact_consistency) — chg-GH-294-spec.md
   §8.3 DM-4 + chg-GH-294-plan.yaml header "OWNER-HOLD PARK `--until` PIN" (primary
   branch) + chg-GH-294-test-plan.md TC-PAUSE-044 step 1, TC-PAUSE-072 step 2,
   TC-PAUSE-094 objective — vs delivered truth `doc/spec/features/feature-scheduling-engine.md`
   (owner-hold section, #280).
   Gap: DM-4 ("`owner-hold` park carries the hold's expiry"), the pin's primary branch
   ("`--until` carries the hold's recorded expiry instant"), and three test assertions
   all presume the active hold **records an expiry**. Delivered #280 truth records no
   such fact: the hold resolves from an `<PREFIX>_OWNER_HOLD` environment value or an
   `owner-hold` marker whose content is "one control-free line bounded to 160
   characters" (a reason); the read payload carries "source and optional reason" — no
   expiry concept exists anywhere in the delivered hold. The pin's absence branch
   ("when the active hold records no expiry, the park carries `until` absent/null") is
   therefore the **only** branch realizable against delivered truth — and the delivered
   park payload already supports no-expiry conditions (`provider-quota` and `preemption`
   "carry no expiry"), so the absence branch lands cleanly on delivered machinery while
   the expiry branch references a fact nothing produces. As written, Phase 5/7 must
   either invent an undeclared hold-expiry source or fail TC-PAUSE-044(a)/TC-PAUSE-072
   step 2 naming the missing fact. Secondary ambiguity in the same chain: TC-PAUSE-044
   ordering (a) asserts an "`owner-hold` park record" exists while the hold is active,
   but the delivered hold is a read-time gate that parks nothing, and no artifact names
   who writes an `owner-hold` park record (the operator `queue release --park
   owner-hold` surface? the daemon under an active hold?). Note: shipping the absence
   branch as the delivered reality deviates from the M2 contracts' "each with an
   `until` timestamp" wording for owner-hold — a planning-contract nuance that should
   be recorded as a change-level decision (spec DEC row with the #280 rationale), not
   silently absorbed.
   Suggested remediation target phase: specification
   Suggested fix: @spec-writer sharpens DM-4's owner-hold half to the realizable branch
   — `until` carries the hold's expiry **when the hold records one**; the delivered
   hold (#280) records none, so the classified absence (`until` null/absent, reason
   stays `owner-hold`) is the delivered reality — and states who may write an
   `owner-hold` park record (the operator park surface, with the daemon governing by
   the hold without writing a park); record the M2-wording deviation as a DEC row.
   Plan pin and TC-PAUSE-044/072/094 then follow with the realizable branch asserted.
   Alternative (if the expiry branch is wanted): declare the hold-expiry fact source as
   in-scope in the spec — a larger change requiring its own decision.

B. [minor] cross_artifact_consistency — chg-GH-294-plan.yaml header "OWNER-HOLD PARK
   `--until` PIN" vs chg-GH-294-test-plan.md §5.2 TC-PAUSE-072 step 4 (v1.1).
   Gap: The pin claims "TC-PAUSE-072 step 4 asserts both halves on the command and
   projection surfaces." It does not: the test plan v1.1 revision log records only the
   TC-PAUSE-052 change, and step 4 still reads "`--park owner-hold` carries the hold's
   expiry semantics" — asserting neither the CLI requirement shape (`--until`
   required/refused/derived) nor the absence branch. The plan claims verification
   coverage that does not exist; the pin is binding on Phase 7 but verified by no case.
   Suggested remediation target phase: test_planning
   Suggested fix: Once finding A lands, extend TC-PAUSE-072 step 4 (and step 2) to
   assert the pinned branches — the CLI rule for `--park owner-hold` and the
   realizable `until` outcome on record and projection; or, minimally, correct the
   plan's coverage claim (delivery_planning) so pin and plan do not assert coverage
   the test plan lacks.

C. [nit] cross_artifact_consistency — chg-GH-294-test-plan.md §2 References.
   Gap: The binding-source row still cites "`chg-GH-294-spec.md` v1.1"; the spec is
   v1.2. The v1.1→v1.2 delta (pages enumeration only) changes no TC binding, but a
   stale version cite in the traceability table invites drift.
   Suggested remediation target phase: test_planning
   Suggested fix: One-line version bump to v1.2.

## Re-verified holistically (no carry-over credit)

- Versions: spec v1.2 (frontmatter + §25 history row), test plan v1.1 (frontmatter +
  §9 revision row), plan cites both correctly; `plan validate` re-run → valid, tier
  full, readyForDevelopment=true.
- Coverage intact: 41 TCs, each exactly once in §5.1/§5.2/§7 and exactly one owning
  phase in the TC→PHASE map; 7/7 ACs, 8/8 F, 10/10 NFR, 4/4 EVT, 6/6 DM, 11/11 DEC
  mapped; no orphans, no TODO rows.
- Ticket ACs 1–7 still trace 1:1 (issue #294 / backlog M2-S17 verbatim); TDR staging
  unchanged (records on disk, Proposed, index rows committed in b15af174, Phase 1
  scope, escalation trigger).
- OQ-TP-1..6 pins re-checked: unchanged and consistent, including the v1.1 TC-PAUSE-052
  rewrite against OQ-TP-1's evaluation half.
- Code-area coverage unchanged (no scope edits in remediation; iter-1 tree sweep and
  this run's `plan validate` both clean).

## Gate Result

NOT_READY. One major finding (A: the owner-hold `until` chain presumes a hold-recorded
expiry that delivered #280 truth does not have, plus the unnamed writer of an
`owner-hold` park record) and its dependent minor (B: the plan's false coverage claim
for TC-PAUSE-072 step 4), plus one nit (C). No human input required — route as a
change-level decision per the remediation in finding A. Reopen `specification` for
finding A (with plan/test-plan follow-through in the same pass), `test_planning` for
findings B and C. Iteration cap notice: this is iteration 2 of ~3; if the same blocking
gap persists after iteration 3, escalate to the human rather than looping.
