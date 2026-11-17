# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-295
Date: 2026-11-17
Pause Required: no

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

## Scope of Review

Re-review after remediation iteration 1. Reviewed: spec v1.1 (unchanged this
cycle), test plan v1.3 (rev-log v1.2 reference-path fix, v1.3 DEC-range fix),
plan delivery.plan.v1 rev 1.1, pm-notes (incl. the iteration-1 decision and
retro entries), readiness-iter-1.md, and the delivered tree at the branch base
(main-tools tip 5f25da89; the branch adds only docs commits, working tree
clean). The plan YAML was parsed (delivery.plan.v1, 8 delivery phases, ids
1-8 stable); every repo-truth pin the artifacts declare was re-verified
against the live tree, not taken from the iteration-1 record.

## Remediation Verification (iteration-1 findings)

All four iteration-1 findings are CLOSED:

1. AC-F3-1 ownership (was blocking) — CLOSED. The AC OWNERSHIP block
   enumerates 8/8 ACs with owning phases; the per-phase listing and the final
   enumeration agree, and the count line no longer contradicts the "all 8"
   claim. The AC-F8-1-style split is sound: lane-cell half (TC-SUP-020,
   TC-SUP-022) @ phase 4, claim-cell half (TC-SUP-021, TC-SUP-054) @ phase 5
   — exactly the four TCs the test plan's §3.1 AC-F3-1 row names, no more, no
   fewer; AC-F8-1 splits binding half @ phase 1 / projection half @ phase 5,
   matching both phases' Bound lines. Each half's evidence contribution is
   declared (phase 4 proves the ticket AC's lane half plus the acted-on park;
   phase 5 the supervisor half), and each half's TCs appear in the owning
   phase's Test obligations (phase 4: 011, 020, 022, 023, 040-043, 046, 047,
   091, 093; phase 5: 021, 044, 051-054, 060-063, 072). Non-vacuity holds:
   TC-SUP-020 needs the park action (phase 4), TC-SUP-021/054 need the
   phase-5 action/process-seam mechanisms, so neither half is vacuously green
   in its owning phase. dod_check is now well-defined for the ticket's central
   criterion.
2. Phantom doc targets — CLOSED. The lifecycle phase-7 handoff block, the
   phase-8 scope, and test plan §2 now name feature-scheduling-engine.md,
   feature-queue-ready.md, and feature-peak-pausing.md; all exist in
   doc/spec/features/, as do every other referenced page (watchdog-lane-
   contracts, resident-daemon, result-contract, delivery-lifecycle,
   cli-entrypoint, doc/00-index.md). A change-folder grep finds the retired
   page names only inside the historical records (pm-notes finding log,
   readiness-iter-1), where they correctly remain as history.
3. Re-entry horizon — CLOSED and unambiguous. The RE-ENTRY HORIZON decision
   fixes until = runInstant + QUEUE_PARK_RECHECK_DEFAULTS[
   conditionTypeForCause("liveness-stall")], imported never literal, and
   explicitly names WATCHDOG_STALL_HEARTBEAT_MS (300,000 ms) as the
   corroboration bound, NOT the horizon — exactly one implementable reading
   for phase 4. Verified against the tree: the mapped type is provider-window
   (the sole expiry-carrying type) and its declared default is 60_000
   (packages/core/src/contracts/queue.ts), the resolver
   conditionTypeForCause exists (packages/core/src/domain/queue-park.ts:30),
   and TC-SUP-040's golden (until later than the run instant, equal to the
   horizon; recheckMs from the same constant) agrees by construction. The
   plan-level routing matches iteration 1's decision routing (recorded
   against DEC-2, no spec reopen required).
4. Phase-5 error-family scope — CLOSED. tests/structure/supervision-
   error-family.test.ts is in phase 5's scope.files, and the SPLIT-SUITE
   NOTES declare the phase-1→5 split for that suite.

## Verification Performed (evidence for the PASS facets)

- Ticket-task coverage unchanged from iteration 1 and still sound: spec §17
  traceability paragraph + Appendix A map all five ticket tasks and the
  ticket AC to ACs; seeds SC-M2-S2-01/02 confirmed present verbatim-shaped
  in doc/planning/oss-tooling/milestones/m2/test-scenarios.md; backlog story
  M2-S2 at backlog.md:1069; pm-notes carry the ticket AC restatement and
  delivery conventions (tracker load itself unavailable to this subagent;
  pm-notes + backlog + seeds are the recorded ticket context — same basis as
  iteration 1, no gap surfaced).
- Plan coverage: 8 phases cover all 8 ACs (ownership block), all 51 TCs
  partition exactly once (5+6+9+12+11+1+6+1 = 51, union equals the test
  plan's 51 TC IDs TC-SUP-001..097), and every spec requirement area (F, DM,
  EVT, NFR, NG, RSK, OQ routing) is bound in per-phase Bound lines.
- Test traceability: unchanged and complete (§3.1-§3.4 matrices; all 8 ACs
  Covered; DM/NFR/seed rows; §7.1 case-to-file mapping consistent with plan
  phase scopes including the split suites).
- Repo-truth pins re-verified against the live tree: allowlist exactly 62
  members (RESERVED_TWO_SEGMENT_CODES) with five toHaveLength(62) mirror
  pins; sync arithmetic BASELINE_ROWS.length + 112 present and green against
  the delivered table; QUEUE_PARK_CAUSES delivered five in order, pairs
  exactly five rows, QUEUE_PARK_RECHECK_DEFAULTS exactly three keys
  (provider-window 60_000 the sole expiry-carrying type);
  WATCHDOG_STALL_HEARTBEAT_MS = 300_000; WATCHDOG_PROBES = [preflight,
  teardown, liveness]; DAEMON_LANE_LIVENESS_CLASSIFICATIONS =
  ["progressing","stalled","unknown"]; QUEUE_MAX_LANES = 200;
  queue.single-flight identity present; DAEMON_DEFAULT_LOCK_STALENESS_MS
  present; prompt-required families exactly 23 with "steer" last; economics
  domain modules present; no supervise command/contract/spec page exists
  (fresh start confirmed).
- Delivered-file anchors: every delivered suite, fixture, and harness named
  by the plan or test plan exists (daemon-preemption.ts and its behaviour
  test for TC-SUP-043; daemon-lock/daemon-single-flight/coordinator-
  instance-lease/daemon-production-composition for TC-SUP-053; state/watchdog/
  queue/coordinator/queue-ready/daemon-mount-golden fixture seams; golden
  helpers; forbidden-literals registry; help-guide coverage fixture;
  planning-corpus targets for phase 8). Zero phantom paths in plan or test
  plan.
- Decision capture: OQ-1 deferral with @decision-advisor routing intact;
  OQ-TP-1..3 resolved as plan-level decisions; error-code spellings declared;
  the RE-ENTRY HORIZON decision recorded in the right place per iteration-1
  routing.
- DoD: spec §4.1 metrics + §17 ACs + per-phase "Done when" + pm-notes
  evidence convention give phase 10 a defined verification target.

## Findings

1. [major] [blocking] system_spec_consistency —
   chg-GH-295-plan.yaml#header "Repo truth verified at plan time" pin block
   (lines ~70-76) and Phase 1 obligation 1.4 (lines ~462-475)
   Gap: the plan's declared error-table base state is false against the
   delivered tree. The plan asserts "the error table holds 144 rows" and
   instructs phase 1 to move the structure mirror "144 -> 146 entries" with
   the header's post-append total "(146)". Delivered truth at the branch base
   (main-tools tip 5f25da89, the plan's own stated base): ERROR_TABLE holds
   exactly 146 rows and 62 allowlist members — verified three ways (runtime
   import ERROR_TABLE.length === 146; the delivered structure mirror asserts
   toHaveLength(146) at five sites and the carrier doc says "146
   identities"; GH-287's merge diff moved the mirror 143 -> 146 and the
   allowlist 59 -> 62). The correct phase-1 move is 146 -> 148 and the
   post-append total is 148; the no-leftover scan is mis-keyed (it scans for
   a stale "144" that does not exist anywhere in the tree and omits the real
   pre-change token "146"). All delta instructions are correct (+2 rows,
   62 -> 64 allowlist, +112 -> +114 sync arithmetic — the arithmetic is
   occurrence-relative and holds: BASELINE_ROWS.length + 112 = 146 today,
   +114 = 148 after), so the defect fails closed at the phase-1 boundary
   (exact-length mirror + sync oracle + doc counts) and cannot ship
   silently — but it is a provably false "verified at plan time" pin sitting
   in the plan's most count-sensitive atomic commit, whose no-leftover scan
   is keyed to the wrong token. Aggravating: iteration 1's verification
   section ("error table exactly 144 rows") and the pm-notes decision/retro
   entries ("base-state pins verified correct (144/62/+112)... confirmed the
   pins current") affirm this pin as verified — a false verification claim
   this record corrects; the gate cannot certify it forward.
   Suggested remediation target phase: delivery_planning
   Suggested fix: one plan-comment revision correcting the four token sites
   — header "holds 146 rows", "appends exactly 2 rows (148)", phase-1.4
   "146 -> 148 entries", and the no-leftover scan token set "146/62/+112" —
   and, alongside it, a PM-owned pm-notes correction noting that
   iteration-1's "144 rows" affirmation was mis-verified (the pin predates
   remediation and was carried forward, not introduced by it).
2. [nit] [advisory] cross_artifact_consistency —
   chg-GH-295-plan.yaml#SOURCES block ("Test plan: ./chg-GH-295-test-plan.md
   v1.1")
   Gap: the plan cites test plan v1.1; the artifact on disk is v1.3 after the
   remediation bumps (v1.2 reference paths, v1.3 DEC range — both explicitly
   "no case, ID, coverage row, or assertion changed", so the cited content is
   intact). A stale version pointer only; no substantive divergence.
   Suggested remediation target phase: delivery_planning
   Suggested fix: bump the cited version to v1.3 in the same plan revision as
   finding 1.

## Decision Routing

- Finding 1 (and 2): change-level plan revision — reopen delivery_planning
  only. Neither the spec nor the test plan needs to reopen; the RE-ENTRY
  HORIZON, AC ownership, doc targets, and phase scopes all stand.
- The pm-notes correction in finding 1 is PM-owned (this reviewer writes only
  readiness records).
- No needs_human_input items; OQ-1 remains correctly deferred with its
  decision-advisor routing intact.

## Gate Result

NOT_READY — one blocking finding (1), a stale, previously mis-verified
error-table base-count pin in the plan, plus one nit riding the same
revision. All four iteration-1 findings are verified closed and no new
coverage, traceability, or ownership gaps were introduced by the remediation.
Reopen delivery_planning for the pin correction; re-run this gate (iteration
3 of the ~3-iteration budget — the fix is four comment tokens plus a version
pointer, so no stalemate is expected). No pause flag is set.
