# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-297
Date: 2026-11-15
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Scope of Review

Sources loaded: GitHub issue #297 ("M2-S4: Board (M2)", milestone M2, OPEN) via
tracker; backlog mirror `doc/planning/oss-tooling/backlog.md` M2-S4 (line 1120);
M2 milestone pack (`commands/board.md`, `contracts.md` refs, `test-scenarios.md`
SC-M2-S4-01/02, `entrypoint-delta.md`); spec v1.1, test plan v1.1, plan
`delivery.plan.v1` rev 1.0, pm-notes; current truth `doc/spec/features/**`
(result contract, owner-gate SLA, status digest, brief, scheduling engine,
projects, blockers, peak pausing, CLI entrypoint); and read-only code checks
(`packages/core/src/contracts/owner-gate-sla.ts`, `error-table.ts`,
`status.ts`, `queue.ts`; `packages/cli/src/help/prompt-required-commands.ts`,
`production.ts`; `scripts/checks/error-table-sync.ts`;
`tests/structure/error-table.test.ts`; delivered board suites). No prior
readiness records existed.

## Verified Strengths (why most facets pass)

- Ticket traceability is complete and honest. The single backlog AC ("board,
  brief, and status share one state source") is decomposed in Appendix B
  without adding a second meaning; the spec's device (`stateSource` as an
  additive key on all three payloads, machine-asserted by AC-F2-1/TC-BOARD-003)
  makes the AC runtime-checkable exactly as seed SC-M2-S4-01 asserts. All six
  declared dependencies (GH-229/237/288/309/230/294 + result contract) are
  delivered; pm-notes records the check.
- Current-state claims verify against code: `PROMPT_REQUIRED_COMMANDS` is
  exactly 20 families with no `board`; delivered board bounds (8 gates,
  65 536 data bytes, 24/4 096 human, 160/120 field caps), collector id set
  `{tracker, lanes}`, gate-only payload shape, PDR-0003 two-row map with
  `owner-review-first`, `collectStatusFacts` shared by status/brief, unbound
  scope, host-index/repoKey naming, park causes (`peak-window`/`owner-hold`
  vs `provider-quota`), bare `ref: null` question view, `maintainsIndex`
  exception set — all confirmed.
- Counts reconcile across artifacts: 28 ACs and 48 TCs, each mapped both
  directions; plan AC ownership 1+11+9+3+4=28 and TC ownership 1+21+16+5+5=48
  re-counted and correct; DoD-1..18 each mapped to a plan phase (DoD-18 to
  lifecycle phase 11, declared); the 128-repository cap, byte-guard order,
  DEC-13..DEC-19 rules, phase-classification totality, post-append join, and
  the `fallback.invocation` grammar identity state one identical rule in all
  three artifacts. The v1.1 amendment genuinely closed the prior
  unbounded-`repositories[]` contradiction.
- The 24-line budget closes exactly: 1 header + 4 section lines + 6+6+4+3.

## Findings

1. [critical] plan_code_area_coverage — chg-GH-297-plan.yaml#phase-3 (obligations 3.5, scope.files; GATE ENVIRONMENT)
   Gap: Phase 3 adds two **two-segment** error codes (`board.repository-unknown`,
   `board.state-unavailable`) and declares `TMPDIR=$PWD/tmp/tmpdir pnpm check`
   green at its boundary — but the delivered error-table sync gate
   (`scripts/checks/error-table-sync.ts`) requires ≥3 dot segments unless the
   exact code is in `RESERVED_TWO_SEGMENT_CODES` (an exact per-code Set,
   currently 53 entries), mirrored by an independent Set in
   `tests/structure/error-table.test.ts` (line 57, asserted `toHaveLength(53)`
   at line 1406). The sync check rejects un-allowlisted two-segment rows
   (line 383) and its doc scanner silently skips them (line 312), so the C-7
   carrier would also read as undocumented. `scripts/checks/error-table-sync.ts`
   appears in **no** phase's scope.files, and no obligation declares the exact
   two-code allowlist addition (53→55 in BOTH owning files) or the structural
   count bumps (`entries` 136→138 asserted at four sites, `delivered`
   135→137, new board-kind count). As scoped, phase 3's own done-when is
   unsatisfiable; delivery must invent scope. Direct precedent: GH-230 GAP-17
   (same trap, rated "critical for the implementation phase"), GH-241
   readiness iterations 1–5.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `scripts/checks/error-table-sync.ts` to phase-3 scope and
   a non-negotiable obligation: exact two-code `RESERVED_TWO_SEGMENT_CODES`
   addition (53→55) in BOTH `scripts/checks/error-table-sync.ts` and
   `tests/structure/error-table.test.ts`, no wildcard/pattern widening, plus
   the pinned count-assertion updates (entries 136→138, delivered 135→137,
   board kind 2) — landing with the rows and the carrier in the same commit.

2. [major] system_spec_consistency — chg-GH-297-spec.md#DM-8 (§8.3, DEC-8, C-7, §16.1 feature-result-contract row)
   Gap: The delivered current truth (`doc/spec/features/feature-result-contract.md`
   line 118) declares the two-segment allowlist **closed** — "a closed exact
   two-segment allowlist of 52 declared identities … with no pattern or family
   widening". DM-8/DEC-8 introduce two two-segment codes under a new `board`
   domain kind without acknowledging that this requires a declared, exact
   widening of that closed set and the identity-table counts; §16.1's carrier
   row for feature-result-contract.md names only the kind, the two rows, and
   the generalized collector wording — not the allowlist or table-count
   updates the sync gate enforces. The spec's NG-6/§8.5 posture ("no silent
   drift from delivered contracts") is contradicted by this undeclared drift.
   Suggested remediation target phase: specification
   Suggested fix: Extend DM-8/DEC-8 and the §16.1 carrier row with the GH-230
   DEC-9-style implementation constraint: both codes are two-segment, both join
   the exact `RESERVED_TWO_SEGMENT_CODES` allowlist in both owning files
   (53→55), the documented identity table grows by the two rows and its
   totals are updated in-boundary; no `board.*` wildcard, no generic widening.

3. [minor] test_traceability — chg-GH-297-test-plan.md#TC-BOARD-053 (§3.2 "Error-table registration", §5.2)
   Gap: TC-BOARD-053 asserts the domain kind, the two rows, the carrier, and
   unchanged delivered families — but not the `RESERVED_TWO_SEGMENT_CODES`
   addition or the structural count bumps, so the gate-critical invariant of
   finding 1 has no owning case and a delivery that forgets the allowlist
   fails only at the aggregate gate instead of at a named case (contrast
   GH-230 TC-BLK-007 and GH-241 TC-COORD-081/082, which pin exact values and
   near-miss rejection).
   Suggested remediation target phase: test_planning
   Suggested fix: Extend TC-BOARD-053 (and its §3.2 row) to assert: both codes
   present in `RESERVED_TWO_SEGMENT_CODES` in BOTH gate files (53→55), the
   near-miss rejection (a third `board.*` two-segment code fails), and the
   entries/delivered count assertions updated to the new totals.

4. [minor] plan_code_area_coverage — chg-GH-297-plan.yaml#phase-2 (scope.files; obligation 2.8)
   Gap: Phase 2 replaces the gate-only board payload/human screen with the
   four-section surface (gate rows gain `repository`/`condition`/`owner`/
   `ownerSource`; `data` gains keys; human grid becomes four sections), which
   breaks shape/key-set assertions in six delivered board suites that appear
   in no phase's scope.files: `tests/behaviour/board-escalation.test.ts`,
   `board-aging.test.ts`, `board-records.test.ts`,
   `board-waiver-recording.test.ts`, `board-privacy.test.ts`,
   `board-corpus.test.ts` (verified present with shape assertions and golden
   references). The phase-2 aggregate gate cannot be green without updating
   them; TC-BOARD-020's home is left optional ("new, or board-escalation/
   board-aging extended"), so the update is nowhere declared.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add the six delivered suites to phase-2 scope.files with an
   obligation to update them to the declared additive delta (per TC-BOARD-022/
   063 subset semantics) in the same phase as the four-section flip.

5. [nit] decision_capture — chg-GH-297-spec.md#AUTHORING-GUIDELINES
   Gap: The guidelines claim every deviation from the pack's example snippets
   (the envelope shape with `ok`/`command`) is "recorded as a decision", but
   no DEC row records the envelope-shape deviation; only NFR-1 states the
   rule. Non-blocking (the spec follows delivered five-field truth correctly).
   Suggested remediation target phase: specification
   Suggested fix: Note the envelope-shape deviation in DEC-2 (or a DEC row) or
   drop the "recorded as a decision" claim for it.

## Non-Findings Checked and Cleared

- Ticket↔backlog dependency divergence (ticket omits M2-S18): superset, all
  delivered; no impact.
- Park `untilReason: "owner-hold-no-expiry"`: new board-owned vocabulary
  (delivered surfaces use an absent optional `until`), declared as a closed
  token consistently in spec DM-6, TC-BOARD-033, and plan C-13 block — additive
  and internally consistent; DEC-19's ask/park asymmetry is justified.
- `board.repository-unknown`/`board.state-unavailable` identities, exits, and
  grammar (`fallback.invocation`) match the M2 pack page and delivered truth.
- Plan doc-update coverage: phase-7 handoff list complete; planning corpus in
  phase 5; coverage page phase 4; C-7 carrier phase 3; `doc/planning/**` needs
  no `ados_distribution` marker.
- DoD: §17.1 binds every AC to verification and plan-phase ownership; no
  condition waivable; DoD-18 correctly a lifecycle matter.

## Gate Result

NOT_READY — findings 1–4 block. Reopen `delivery_planning` (findings 1, 4),
`specification` (finding 2), and `test_planning` (finding 3); re-run this gate
after revision. No human input required (Pause: no).
