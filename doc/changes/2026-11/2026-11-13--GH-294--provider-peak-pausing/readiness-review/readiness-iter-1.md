# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-294
Date: 2026-11-13
Pause Required: no

Reviewer: @readiness-reviewer (adversarial DoR gate, local mode)
Inputs verified first-hand: spec v1.1, test-plan v1.0, plan.yaml (tier full, 10 phases),
pm-notes, GitHub issue #294 (loaded via tracker), backlog M2-S17 (~line 1331), M2 contracts
pack §"Provider profiles and peak windows (S17 additions)", TDR-0028/0029/0030 (on disk),
and current-truth anchors: feature-provider-profiles.md (F-6, UTC basis, resolve identities,
exit conventions), feature-event-taxonomy.md (v1 kinds, eight-field envelope, S17 extension
path), feature-resident-daemon.md (supervise-only, GH-238), feature-scheduling-engine.md
(park causes, `--until` rule, owner-hold precedence), feature-telemetry-v2.md,
feature-spend.md, feature-status-digest.md, feature-brief.md, feature-plan-schema.md.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

Note on plan_coverage: the phase structure, TC→PHASE map (41/41 ids, each owned exactly
once), and per-phase gates are complete and correct; the FAIL is carried by finding 2,
whose fix lands in the plan header (and one spec row), not in phase structure. Re-evaluate
this facet jointly with cross_artifact_consistency after remediation.

## Findings

1. [major] cross_artifact_consistency — chg-GH-294-test-plan.md §5.2 TC-PAUSE-052 (Preconditions + Step 1) vs chg-GH-294-spec.md §5.1 F-6, §8.3 DM-5, §9 NFR-4, §15 DEC-4
   Gap: Boundary-inclusion contradiction on the zero-spend scoping interval. The clean
   episode retains the seeds "park-timestamp exactly (boundary)" and "window-end exactly
   (boundary)" and asserts `billableCalls == 0` — an open interval (park, end). The spec
   pins the opposite: F-6/DM-5/NFR-4 all scope "from the park timestamp through the window
   end" (inclusive), and DEC-4 excludes only calls "before the park timestamp" (a call AT
   the park timestamp is not before it). Under the spec's semantics the clean episode must
   read 2, not 0; under the test's semantics the spec's wording is wrong. The step-1
   parenthetical ("park timestamp inclusive … window end inclusive … are excluded") is
   internally garbled whichever reading is taken. Whichever way delivery implements it, one
   binding artifact fails: TC-PAUSE-052 step 1 or F-6/DM-5/NFR-4/DEC-4.
   Suggested remediation target phase: test_planning
   Suggested fix: Align TC-PAUSE-052 with the spec's inclusive wording — move the two
   exact-boundary seeds out of the clean-zero episode into explicit boundary-inclusion
   assertions (a call at the park timestamp counts; a call at the window end counts), or
   split them into a dedicated boundary case. If exclusive-open boundaries are the intended
   truth instead, the spec (F-6, DM-5, NFR-4, DEC-4) must be sharpened by @spec-writer
   FIRST and the test plan then follows; the two artifacts may not disagree.

2. [major] plan_doc_update_coverage — chg-GH-294-plan.yaml header "DOC BOUNDARY" + chg-GH-294-spec.md §16 "System specification pages"
   Gap: The system-doc update enumeration omits `doc/spec/features/feature-scheduling-engine.md`
   and `doc/spec/features/feature-spend.md` — the two pages this change most directly
   alters. feature-scheduling-engine.md is the canonical home of the park-cause vocabulary
   whose delivered truth this change supersedes: causes/conditions "paired one-to-one"
   (DEC-2's `peak-window`-on-`provider-window` mapping decouples the pairing) and "the
   hold adds **no** park cause" (DEC-2 adds `owner-hold` as a park cause); TDR-0030's own
   spec-reconciliation list names "scheduling engine (park record fields)".
   feature-spend.md is the read-side home of DM-5's window-scoped zero-spend evidence
   (Phase 6 edits packages/core/src/domain/spend.ts, contracts/spend.ts,
   state/spend-reads.ts). Spec §16 lists "Scheduling engine / queue park causes" and
   "Spend read side / telemetry" as affected components yet omits both from the pages
   enumeration — internally inconsistent — and the plan's DOC BOUNDARY (the list lifecycle
   phase 7 consumes) inherits the omission, as does the pm-notes doc-risk note. Risk:
   stale closed-vocabulary truth after merge, contrary to the scheduling-engine page's own
   "synchronized in-change" discipline.
   Suggested remediation target phase: delivery_planning
   Suggested fix: @plan-writer adds both pages to the DOC BOUNDARY enumeration;
   @spec-writer adds both to the §16 "System specification pages" row (PM may mirror in
   the pm-notes doc-risk note). One coordinated fix across the two artifacts.

3. [minor] cross_artifact_consistency — chg-GH-294-test-plan.md §5.2 TC-PAUSE-072 Step 4 (vs spec §8.1, DM-4; plan OQ-TP pins)
   Gap: The CLI validation rule for `queue release --park owner-hold` is unpinned.
   Delivered truth requires `--until` for `provider-window` and refuses it for every other
   park cause. TC-PAUSE-072 step 4 pins the peak-window rule ("refused without --until")
   but leaves owner-hold at "carries the hold's expiry semantics" — ambiguous between (a)
   requiring `--until <hold expiry>`, (b) deriving the expiry from the active hold and
   refusing `--until`, (c) optional. Comparable delivery-owned shapes got plan pins
   (OQ-TP-6 precedent); this one has none.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Pin the rule in the plan header alongside the OQ-TP resolutions (e.g.
   "owner-hold parks require `--until <iso>` equal to the hold's expiry" or the
   derive-and-refuse alternative); TC-PAUSE-072 step 4 then states the pinned rule.

4. [nit] cross_artifact_consistency — chg-GH-294-plan.yaml header OQ-TP-5 pin
   Gap: The pin claims the per-kind payload lists derive "from the M2 contracts content
   and spec §8.2", but its `stop` list (grace deadline, profile, window end, recorded
   stop instant) is a superset: spec EVT-1 and the M2 contracts section name only the
   bounded-grace deadline as the stop payload's required content, and TC-PAUSE-060 step 3
   / TC-PAUSE-064 step 2 pin only the deadline. A declared superset is harmless (the spec
   pins required minimums) but the derivation claim overstates the sources.
   Suggested remediation target phase: delivery_planning
   Suggested fix: One-line wording correction (state that the deadline is the pinned
   required field and the remaining fields are delivery-declared additions within NFR-6).

## Verified as acceptable (assessed, not taken on faith)

- **TDR staging (untracked records, Proposed status).** All three records exist complete
  on disk with governance naming the owner as acceptor at the GH-294 PR review — the same
  posture as TDR-0025/0026/0027 (all Proposed in the committed index). Index rows are
  committed (b15af174); the plan declares the three files in Phase 1 scope, and the
  escalation triggers include "the three TDRs have not landed with Phase 1's commit".
  Landing them in the first delivery commit is the earliest a change commit could land
  them; acceptable for readiness. No pause flag.
- **OQ-TP-1..6 pins — consistent and complete.** TP-1/TP-2 pinned in Phase 1 (fail-closed
  non-UTC refusal; exact-duplicate refuses, distinct overlaps validate without
  arbitration); TP-3 pinned in Phase 5 (recovery emits NO `resumed`; asserted negatively
  in TC-PAUSE-041 step 5, positively in TC-PAUSE-064 step 5 — consistent with EVT-3's
  non-nullable session-state reference); TP-4 resolved in the plan header binding Phase 2
  (nomination gate immediately after input validation; refusal fixtures are
  ordering-agnostic by construction); TP-5 pinned in Phase 3; TP-6 pinned in Phase 8
  (`lanes --json` `peakEnforcement { mode, parkClaimed }`; code areas match the pin).
  Each pin honors its registered substitute assertion (AMB-P1..P4, BYTE-P1, LIT-P1).
- **Ticket coverage.** All 7 ticket ACs trace 1:1 (AC1→AC-F1-1 … AC7→AC-F8-7; verbatim
  against issue #294 and backlog M2-S17); all ticket tasks, dependencies (delivered set
  confirmed on main-tools), and delivery conventions (11-phase lifecycle, plan.yaml,
  commit primitive, TMPDIR-qualified `pnpm check` in the Phase 10 gate, PR → main-tools,
  backlog/status maintenance in Phase 10 scope) are carried.
- **Plan validity re-run independently:** `delivery-os plan validate GH-294` →
  verdict=valid, tier=full, readyForDevelopment=true.
- **Code-area coverage verified against the tree:** every declared delivered production
  path and every gate-referenced delivered suite exists (the hermetic precedents live
  under `tests/checks/`, matching the test plan's layer mapping); the only nonexistent
  declared files are the new modules/suites the plan creates. Blast radius is explicit
  per phase.
- **Current-truth anchors hold:** F-6 peak-window park + UTC-only evaluation + resolve
  identities/exits (provider.profile.* at 1/1/1/2) match feature-provider-profiles.md;
  taxonomy v1 frozen with the S17 extension path matches feature-event-taxonomy.md
  (six topics, v1 kind sets, eight-field envelope); supervise-only residual
  (GH-238) is acknowledged by RSK-8 + the plan's COMPOSITION NOTE; owner-hold precedence
  and the delivered park-cause set match feature-scheduling-engine.md.

## Non-blocking observation (outside this gate's remediation scope)

- chg-GH-294-pm-notes.yaml `phases.clarify_scope` reads started 15:40:00Z / completed
  15:01:08Z (completed before started) — likely residue of the timestamp-schema round-trip
  recorded in the retro note. Flagged for @pm; phase state must not be hand-edited.

## Gate result

NOT_READY. Two major findings (1, 2) require artifact revision before delivery; neither
needs human input, so no pause. Reopen `test_planning` for finding 1 and
`delivery_planning` for findings 2–4 (finding 2 additionally touches one spec §16 row —
coordinate spec + plan in one pass). Re-run this gate after revision.
