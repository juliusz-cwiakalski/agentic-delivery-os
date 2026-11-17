# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-295
Date: 2026-11-17
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Scope of Review

First DoR iteration for GH-295 (M2-S2: Supervise). Reviewed: spec v1.1
(F-1..F-8, AC-F1-1..AC-F8-1, DEC-1..DEC-8, DM-1..DM-4, NFR-1..7, RSK-1..6,
OQ-1), test plan v1.1 (51 TCs, TC-SUP-001..097, GAP-T1 closed by DEC-8),
plan delivery.plan.v1 rev 1.0 (tier full, 8 phases), pm-notes, backlog story
M2-S2 (doc/planning/oss-tooling/backlog.md:1069), M2 seeds SC-M2-S2-01/02,
and the delivered current-truth specs and source pins the artifacts declare.

## Verification Performed (evidence for the PASS facets)

- Ticket-task coverage: all five ticket tasks map to capabilities and ACs
  (tri-state → F-2/AC-F2-1; progress watchdogs → F-4/AC-F4-1;
  duplicate-supervisor detection → F-6/AC-F6-1; lying-liveness by artifact
  evidence → F-3/AC-F3-1; restart policies over the resident dispatch daemon
  → F-7/AC-F7-1; battery + stall park → F-1/F-5). The reading of "restart
  policies over the resident dispatch daemon" as stalled-lane restart
  composition (daemon restart itself [OUT]) is grounded in the backlog goal
  ("running over the M1 daemon's lanes") and the delivered never-signal
  discipline. No hidden scope inventions found.
- Repo-truth pins verified at review time: error table exactly 144 rows;
  allowlist exactly 62 members with five toHaveLength(62) mirror pins;
  sync arithmetic BASELINE_ROWS.length + 112 at three sites; family count
  exactly 23 with "steer" last (supervise mounts 24th); QUEUE_PARK_CAUSES
  delivered five in order, pairs at five rows (peak-window→provider-window
  precedent), recheck defaults at three keys, provider-window the sole
  expiry-carrying type; conditionTypeForCause resolver present in
  packages/core/src/domain/queue-park.ts; WATCHDOG_STALL_HEARTBEAT_MS =
  300_000; WATCHDOG_PROBES = [preflight, teardown, liveness];
  DAEMON_LANE_LIVENESS_CLASSIFICATIONS = ["progressing","stalled","unknown"];
  QUEUE_MAX_LANES = 200; no supervise command, contract, or spec page exists
  (fresh start confirmed).
- Seed reconciliation verified against test-scenarios.md verbatim bodies;
  parkReason→reason (parked:liveness-stall) and until→DM-3 are faithful to
  the delivered vocabularies.
- Consumed-truth boundaries verified: watchdog spec names supervise (M2-S2)
  as the probe consumer and keeps checks-never-supervise; daemon production
  composition remains supervise-only; closed-union discipline (exactly two
  identities, exactly one cause) declared with both-direction binding.
- Test traceability: 51 TCs, all 8 ACs Covered, DM/NFR/seed matrices
  complete; plan TC ownership partitions all 51 cases exactly once
  (5+6+9+12+11+1+6+1) with non-vacuity and split-suite notes consistent with
  the test plan's §7.1 case-to-file mapping.
- Decision capture: DEC-1..DEC-8 in the spec decision log; OQ-TP-1..TP-3
  resolved as plan-level design decisions; OQ-1 deferred with @decision-
  advisor routing; error-code spellings declared, not silent.

## Findings

1. [major] [blocking] plan_coverage / cross_artifact_consistency —
   chg-GH-295-plan.yaml#AC OWNERSHIP block (comment block, lines ~171-187)
   Gap: AC-F3-1 — the ticket's own acceptance criterion ("a stuck supervisor
   is detected by artifact evidence, not process state") — is owned by no
   plan phase. The block enumerates 7 distinct ACs (AC-F2-1, AC-F4-1 @
   phase 2; AC-F1-1 @ phase 3; AC-F5-1 @ phase 4; AC-F6-1, AC-F7-1, AC-F8-1
   @ phase 5), its own count sums to 7, yet it claims "all 8 ACs are met at
   the delivered HEAD" — an internal arithmetic contradiction. The TCs that
   evidence AC-F3-1 are owned (TC-SUP-020/022 @ phase 4; TC-SUP-021/054 @
   phase 5, mapped to AC-F3-1 in the test plan), so the defect is ownership
   bookkeeping, not coverage — but dod_check (lifecycle phase 10) verifies
   all ACs against per-phase evidence, and an unowned AC makes that
   verification undefined for the ticket's central criterion.
   Suggested remediation target phase: delivery_planning
   Suggested fix: declare AC-F3-1's owning phase(s) in the AC OWNERSHIP
   block — e.g., mirroring the AC-F8-1 split: lane-cell half (TC-SUP-020,
   TC-SUP-022) owned by phase 4, claim-cell half (TC-SUP-021, TC-SUP-054)
   by phase 5 — and correct the count line so the enumeration and the "all
   8" claim agree.

2. [minor] [advisory] system_spec_consistency / plan_doc_update_coverage —
   chg-GH-295-plan.yaml#LIFECYCLE PHASE 7 HANDOFF OBLIGATIONS and
   chg-GH-295-test-plan.md#§2 References
   Gap: both artifacts name doc/spec/features/feature-queue-lifecycle.md and
   doc/spec/features/feature-lanes-surface.md (the test plan links
   ../spec/features/lanes-surface.md) as reconciliation targets / binding
   references — neither file exists in doc/spec/features/. The park-cause
   and condition vocabulary, the lanes projection, and the parked:<cause>
   template actually live in feature-scheduling-engine.md,
   feature-queue-ready.md, and feature-peak-pausing.md (verified by scan).
   The lifecycle-phase-7 doc-syncer obligations therefore point at
   non-existent pages, risking either skipped reconciliation or improvised
   targets — the silent-drift risk this gate exists to catch.
   Suggested remediation target phase: delivery_planning
   Suggested fix: re-point the handoff block's queue/lanes reconciliation
   rows (and the test plan §2 reference rows) at the actual current-truth
   homes; the spec's own Appendix B already names them generically and
   needs no change.

3. [minor] [advisory] spec_completeness / ac_quality —
   chg-GH-295-spec.md#F-5 / DM-2 (and test plan TC-SUP-040)
   Gap: the supervised-stall park's re-entry instant is pinned to "the
   declared stall recheck horizon", but no artifact declares which constant
   that horizon derives from. The two candidate readings disagree
   numerically: WATCHDOG_STALL_HEARTBEAT_MS (300,000 ms) vs the mapped
   provider-window recheck default (60,000 ms; QUEUE_PARK_RECHECK_DEFAULTS,
   which governs recheckMs). recheckMs is pinned; the until derivation is
   not, so two conforming deliveries could land different values.
   Suggested remediation target phase: specification
   Suggested fix: one-line DEC-2 addendum naming the constant the horizon
   resolves to (imported, never a literal), so phase 1's contract
   declaration and the TC-SUP-040 golden agree by construction.

4. [nit] [advisory] plan_code_area_coverage —
   chg-GH-295-plan.yaml#Phase 5 scope.files
   Gap: phase 5 owns TC-SUP-072, whose structure half lives in
   tests/structure/supervision-error-family.test.ts (test plan §5.2/§7.1),
   but that file appears only in phase 1's scope. Extending it in phase 5
   edits a file outside the declared phase scope (friction for the commit
   primitive's staging discipline); the SPLIT-SUITE NOTES list omits it.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add tests/structure/supervision-error-family.test.ts to
   phase 5's scope files (or extend the SPLIT-SUITE NOTES to cover the
   phase-1→5 split) when fixing finding 1.

## Decision Routing

- Finding 1, 2, 4: change-level (plan revision) — reopen delivery_planning.
- Finding 3: change-level (spec one-liner) — reopen specification only if
  the PM prefers pre-delivery pinning; otherwise acceptable as a phase-1
  contract declaration recorded against DEC-2 (advisory, non-blocking).
- No needs_human_input items; OQ-1 remains correctly deferred with its
  decision-advisor routing intact.

## Gate Result

NOT_READY — one blocking finding (1). Reopen delivery_planning for the AC
ownership correction (findings 1, 2, 4 ride one plan revision); finding 3 is
advisory. Re-run this gate after revision; no pause flag is set.
