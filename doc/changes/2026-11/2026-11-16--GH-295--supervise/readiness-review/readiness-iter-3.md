# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-295
Date: 2026-11-17
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

## Scope of Review

Re-review after remediation iteration 2. Reviewed: spec v1.1 (unchanged this
cycle; rev-log 1.1 = the GAP-T1/DEC-8 resolution), test plan v1.3 (frontmatter
version 1.3; §2 cites DEC-1..DEC-8), plan delivery.plan.v1 rev 1.2, pm-notes
(including the iteration-2 decision entry and the PM-owned mis-verification
retro), readiness-iter-1.md and readiness-iter-2.md, and the delivered tree at
the branch base. Git state verified read-only: working tree clean; branch
feat/GH-295/supervise sits 7 docs-only commits ahead of local main-tools
(5f25da89 — the plan's stated base), all within this change folder. Per the
lesson recorded after iteration 2, every count-sensitive pin below was
re-verified by direct read at review time — runtime import, check execution,
or file scan — never inherited from a prior verdict, including this change's
own earlier iterations.

## Remediation Verification (iteration-2 finding)

CLOSED, with arithmetic verified end to end against the live tree:

- The sync check itself was executed read-only:
  `bun run scripts/checks/error-table-sync.ts` →
  `entries=146 documented=146 S1=455 S3=32 corpus=67 ignored=961`, exit 0, OK.
  This confirms, from the check's own semantics (the authority the plan's
  count-sourcing rule names first), exactly the three numbers the corrected
  pin declares: 146 table entries, 146 documented mirror rows, 67 corpus rows.
- Runtime import: `ERROR_TABLE.length === 146`. Allowlist:
  `RESERVED_TWO_SEGMENT_CODES` in scripts/checks/error-table-sync.ts holds
  exactly 62 string members (counted from the source set literal); the
  structure mirror tests/structure/error-table.test.ts pins
  `toHaveLength(146)` (7 entry sites) and `toHaveLength(62)` at exactly the 5
  sites the header names. The carrier doc feature-result-contract.md declares
  "146 machine identities ... the same 146 identities" — the "documented
  mirror at 146" pin is true.
- Sync arithmetic, verified against the check's real semantics:
  BASELINE_ROWS (defined in tests/checks/error-table-sync.test.ts:709) holds
  exactly 34 rows; the oracle asserts `live.length === BASELINE_ROWS.length +
  112` at its three sites (length check :1081, failure message :1082, counts
  assertion :1185 with :1162). 34 + 112 = 146 = the delivered table — so the
  expression is occurrence-relative exactly as the plan states, and the
  post-append arithmetic holds: appending exactly 2 supervise rows gives
  146 + 2 = 148 entries, 34 + 114 = 148 oracle, 62 + 2 = 64 allowlist. The
  plan's header ("146 rows at the branch base ... BASELINE_ROWS.length + 112
  (= 146 today) — supervise appends exactly 2 rows (148), 2 allowlist members
  (64), +2 sync arithmetic (+114 = 148 after)") and phase 1.4 ("146 -> 148
  entries, 62 -> 64 allowlist at every pin", "+112 -> +114 at every
  occurrence") now state precisely the delivered truth and the correct move.
- Count-sourcing rule, factually grounded: a `code: "` literal grep over
  packages/core/src/contracts/error-table.ts yields exactly 144 — the two
  delivered entries reference constants (code: FALLBACK_INVOCATION_CODE :133,
  code: FALLBACK_INTERNAL_CODE :143; 144 literals + 2 constant-referenced =
  146 actual). The rule's warning that a literal grep undercounts at 144 is
  not hypothetical; it is the delivered behavior. The no-leftover scan is now
  keyed to the real pre-change tokens 146/62/+112.
- Stale-token sweep: the only "144" occurrences remaining in the plan are the
  two correct undercount-explanation uses (header count-sourcing rule; phase
  1.4 scan instruction). No stale base-state pin survives.
- Riding the same revision, the iteration-2 nit is closed: the SOURCES block
  and header now cite test plan v1.3, matching the artifact on disk
  (frontmatter version 1.3; §2 reference rows; DEC-1..DEC-8 range).
- The PM-owned pm-notes correction requested by iteration 2 is present: the
  retro entry recording that iteration-1's "144 rows" affirmation was
  mis-verified and that count-sensitive pins must be confirmed by direct
  read, never inherited from a prior verdict.

## Prior-Finding Closure Re-Verified (iterations 1 and 2)

All remain closed; none regressed under rev 1.2:

1. AC-F3-1 ownership (iter-1, blocking) — still CLOSED. The AC OWNERSHIP
   block enumerates exactly the 8 distinct ACs AC-F1-1..AC-F8-1 (set verified
   by extraction); AC-F3-1's split (lane-cell TC-SUP-020/022 @ phase 4,
   claim-cell TC-SUP-021/054 @ phase 5) and AC-F8-1's split (binding half @
   phase 1, projection half @ phase 5) are unchanged, with each half's
   evidence contribution declared.
2. Phantom doc targets (iter-1) — still CLOSED. The lifecycle phase-7 handoff
   names feature-scheduling-engine.md, feature-queue-ready.md,
   feature-peak-pausing.md, feature-watchdog-lane-contracts.md,
   feature-resident-daemon.md, feature-result-contract.md; test plan §2 also
   cites feature-cli-entrypoint.md and feature-delivery-lifecycle.md — all
   exist in doc/spec/features/. The retired page names appear only inside
   historical records (pm-notes finding log, readiness-iter-1), where they
   correctly remain.
3. Re-entry horizon (iter-1) — still CLOSED and unambiguous. The RE-ENTRY
   HORIZON decision is unchanged; the mapped type's default re-verified live:
   QUEUE_PARK_RECHECK_DEFAULTS = { provider-window: 60000,
   provider-quota: 300000, preemption: 60000 }; resolver
   conditionTypeForCause at packages/core/src/domain/queue-park.ts:30.
4. Phase-5 error-family scope (iter-1) — still CLOSED.
   tests/structure/supervision-error-family.test.ts is in phase 5
   scope.files; the SPLIT-SUITE NOTES declare the phase-1→5 split.
5. Error-table base pin (iter-2, blocking) — CLOSED as detailed above.

## Verification Performed (evidence for the PASS facets)

- Structural integrity of rev 1.2: the plan YAML parses cleanly; the parsed
  document carries only the schema keys (schemaVersion delivery.plan.v1,
  workItemRef GH-295, tier full with phases [1..8], defaultLeases
  repo:main-tools, defaultWeightClass standard, phases); phase ids are
  exactly 1..8 in order, all kind delivery — no structural drift from the
  revision.
- TC ownership partition re-derived mechanically: the per-phase Test
  obligations enumerate 5 + 6 + 9 + 12 + 11 + 6 + 1 + 1 distinct TCs =
  51, and the expanded union equals exactly the test plan's 51 distinct
  TC IDs (set equality verified by extraction from both artifacts; no
  case double-owned, none orphaned).
- AC coverage: spec §17 lists exactly AC-F1-1..AC-F8-1; the plan ownership
  block's distinct-AC set matches; the test plan §3.1 matrix covers all 8.
- Cross-artifact version coherence: spec rev-log 1.1 / test plan v1.3 /
  plan revision 1.2 — every cross-reference in the plan's SOURCES and header
  matches the artifact on disk.
- Delivered-path existence: all 121 scope files across the 8 phases checked;
  the 56 present include every delivered anchor the plan and test plan name
  (classify.ts, queue-park-causes-s17, dispatch-attempts-taxonomy,
  verify-gates-suite-map-contract, help-guide coverage fixture, planning
  corpus targets, inventory registries, error-table suites); all 65 absent
  paths are the change's own new files, each explicitly declared as new in
  the plan text (contracts/supervise.ts, the supervision suites and
  fixtures, the reference page, the changeset, feature-supervise.md). Zero
  phantom delivered paths.
- Repo-truth pins re-verified live: QUEUE_PARK_CAUSES exactly the delivered
  five in order (provider-window, provider-quota,
  preempted-for-close-item, peak-window, owner-hold — liveness-stall
  appends sixth); QUEUE_PARK_CAUSE_CONDITION_PAIRS at 5 rows (+1);
  QUEUE_PARK_RECHECK_DEFAULTS at 3 keys; prompt-required families exactly
  23 with steer 23rd-last (supervise mounts 24th, delta 23 -> 24).
- Section cross-references resolve: test plan §2/§3.1-3.4/§4.2-4.3/§5.2/§6/
  §7.1-7.4/§8.3/§10 and spec §4.1/§5.1/§7/§8.5/§15-§18/§22-§23/§25 all
  exist as cited.
- Decision capture unchanged and intact: OQ-1 deferral with
  @decision-advisor routing; OQ-TP-1..3 and the error-code spellings
  recorded as plan-level decisions; the RE-ENTRY HORIZON decision recorded
  against DEC-2 per the iteration-1 routing. DoD: spec §4.1 metrics + §17
  ACs + per-phase done-when + pm-notes evidence convention.

## Findings

1. [nit] [advisory] system_spec_consistency —
   chg-GH-295-plan.yaml#header "Repo truth verified at plan time" family
   gloss ("registers exactly 23 families (`status` ... `board` 22nd,
   `ceremony` 22nd index, `steer` 23rd last)")
   Gap: the delivered array's tail ordinals are board = 21st member
   (index 20), ceremony = 22nd member (index 21), steer = 23rd/last — so
   "`board` 22nd" is off by one and "`ceremony` 22nd index" is garbled
   (ceremony is the 22nd member at index 21, not at index 22). Carried
   from rev 1.0; not touched by either remediation and not affirmed by
   any prior iteration (both verified only "exactly 23, steer last").
   Zero executable consequence: no obligation, count pin, or scan keys off
   board's or ceremony's position — the operative claims (exactly 23
   families, steer last, supervise mounts 24th, delta 23 -> 24,
   BASE_FAMILIES.length == 23) are all correct and are what phase 6
   asserts.
   Suggested remediation target phase: delivery_planning
   Suggested fix: correct the gloss to "`board` 21st, `ceremony` 22nd,
   `steer` 23rd last" in any future plan revision; no dedicated reopen is
   warranted for a non-load-bearing descriptive comment.

## Decision Routing

- Finding 1 is a change-level plan-comment nit, PM-discretionary; it may
  ride any future plan revision or the natural delivery documentation flow.
  No artifact reopen is required for it.
- No needs_human_input items; OQ-1 remains correctly deferred with its
  decision-advisor routing intact. No pause flag.

## Gate Result

READY — zero blocking findings, one nit advisory (a non-load-bearing ordinal
gloss in the header's family listing). All iteration-1 and iteration-2
findings are verified closed, and the iteration-2 blocking pin — the
error-table base state — is now correct against the delivered tree in every
stated number (146 entries / 146 documented / 67 corpus / 62 allowlist /
BASELINE_ROWS 34 with +112 = 146 today and +114 = 148 after), confirmed by
executing the sync check and importing the table directly rather than
trusting any prior record. The phase-1 atomic move, the re-keyed no-leftover
scan, the count-sourcing rule, and the version-pointer bump are all
internally consistent with that truth. This is iteration 3 of the ~3-iteration
budget and the gate concludes: the artifact set (spec v1.1, test plan v1.3,
plan rev 1.2) is ready for delivery; proceed to phase 6 (delivery).
