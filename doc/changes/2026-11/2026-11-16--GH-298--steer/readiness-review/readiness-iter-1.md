# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-298
Date: 2026-11-16
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

## Verification performed (independent, against the live tree and sources)

- **Ticket fidelity.** GitHub issue #298 read via tracker: goal, tasks (owner briefs, escalation, resequencing heuristics with measured aging; queued notes at phase boundaries; typed message contract, not a bespoke owner-note channel), the three canonical ACs, dependencies (M0-S10, M1-S11), and delivery conventions all trace into the spec (Appendix B decomposition; §18; NFR-9/NFR-10; DoD-17/DoD-18). Nothing invented beyond ticket + planning truth + repo conventions; every extrapolation carries a DEC with rationale.
- **Ticket tasks not silently dropped.** "Escalation" is realized as the admitted filing kind `escalate` (DEC-2 filing subset) plus the priority classes of the shared rank (DM-5); "resequencing heuristics with measured aging" is realized as the derived shared rank recomputed at every read with injected-clock age (F-5, DM-5, DEC-11), with aging-based promotion explicitly deferred (NG-6, §7.3) — a recorded interpretation, not an omission. "Owner briefs" (the owner→delivery ask direction) is AC-1/F-4/DM-6, the batched asks at the read point.
- **Prior reopen remediation re-verified against the tree** (the last reopen was stale arithmetic, so every countable pin was re-checked independently):
  - `PROMPT_REQUIRED_COMMANDS` registers exactly **22** families, `board` at index 20, `ceremony` at index 21 → steer mounts 23rd, delta 22 → 23. Spec (5 sites), test plan (TC-STEER-060), and plan (phase 7 + repo-truth paragraph) now agree.
  - `ERROR_TABLE` imports to exactly **140** entries; **139** delivered (spend-exclusion, spend = 1 row); `RESERVED_TWO_SEGMENT_CODES` = **56** in both `scripts/checks/error-table-sync.ts` and the structural mirror; `BASELINE_ROWS.length + 106` oracle present; dispatch-taxonomy pins at 139/140; verify-suite-map at 140/140; carrier "140 machine identities" present. Zero existing `steer.*` rows; board 2, ceremony 2 — the declared widening 140→143 / 139→142 / 56→59 / +106→+109 is arithmetically exact.
  - Pin-site topology verified: `toHaveLength(140)` ×6, delivered `139` ×2, allowlist `56` ×4 in `tests/structure/error-table.test.ts`; family-count pins in entrypoint-bin, board-mounting (2), events-production (2), dispatch-attempts (1), daemon-production (2), the four family-help suites, cli-edge-seam derived — matching the plan's enumeration; the `22` in `queue-ready-negative-controls.test.ts` confirmed as a control-matrix count and correctly declared a non-count residual.
  - `steer read <id>` → `fallback.invocation` (read takes zero positionals), `steer.unknown-id` scoped to `complete` — consistent across spec §8.3/AC-F9-1, TC-STEER-070/071, plan phase 6.
  - Landing-uncapped vs payload-≤-20 split (AC-F3-4/DM-8) consistent across spec, TC-STEER-082/083, plan phase 5.
  - `--ttl` grammar `<positive-integer><unit>` (s|m|h|d, max 30d, default 24h) declared in spec §8.3 and asserted by TC-STEER-003/004; matches the concept's `14d` style.
- **Planning truth.** Backlog M2-S5 entry, m2 journeys ("Steering a running delivery", incl. step 4's board mention → resolved by DEC-1 per the pm-notes delegation), test-scenarios SC-M2-S5-01/02 exact assertions, contracts pack `phase.state` advisory, and the concept doc (vocabularies `session|change|repo|fleet` / `ask|answer|notify|request|escalate|report|heartbeat`, verbs "list, read, send, acknowledge, complete, query history", no-secrets rule, artifact-ref completion) all match the spec's declarations verbatim. PDR-0003, ADR-0003, TDR-0012 exist.
- **Coverage arithmetic.** Spec: 24 ACs (all Given/When/Then, each linked to F-/DM-/NFR-), DoD-1..18 each bound to a checkable outcome and a plan phase. Test plan: 57 TCs counted in §5.1 (8+9+6+3+3+4+4+7+6+7); §3.1 maps 24/24 ACs; ticket-AC and DoD bindings explicit; no orphan claimed and spot-verified. Plan: AC ownership 0+1+1+4+7+6+2+3 = 24 ✓; TC ownership 2+3+12+14+11+5+10 = 57 ✓; DoD mapping consistent with spec §17.1 "Proven in plan" columns; every phase declares scope files (phase 7 enumerates all 21 files incl. every pinning suite — all verified to exist).
- **System-spec consistency.** All consumed surfaces verified present (phase fold `packages/core/src/state/registry.ts`, asks join `packages/core/src/domain/owner-gate-sla.ts`); additive-only posture holds (NG-1 board untouched, NG-5 no event topic); the single in-boundary doc write (D-13 carrier, C-7) follows the GH-297 precedent and is test-enforced (TC-STEER-076).

## Findings

1. [nit] cross_artifact_consistency — chg-GH-298-spec.md#Appendix D (D-12)
   Gap: D-12 says the `+106 → +109` oracle moves "at all three sites" while the live tree holds four textual occurrences across those three logical sites (`tests/checks/error-table-sync.test.ts` ~1081/1082/1162/1185). The plan already corrects this ("four textual occurrences across those three logical sites; any further occurrence joins the same commit"), and the enforcement is the scan + sync suite, so delivery cannot miss the fourth site.
   Suggested remediation target phase: specification
   Suggested fix: none required before delivery; optionally align D-12's wording with the plan's three-logical/four-textual statement at the next spec touch.

2. [nit] cross_artifact_consistency — chg-GH-298-spec.md#§16.1 vs chg-GH-298-plan.yaml#phase 8.6
   Gap: §16.1 places the planning-corpus updates (backlog marker, status, CLI registry, entrypoint-delta, command page) under phase-7 reconciliation, while the plan delivers them in plan phase 8 at the release boundary (lifecycle phase 7 then verifies). The plan enumerates the exact files in phase 8 scope, so nothing can be dropped; the split is a phrasing difference, not a coverage gap.
   Suggested remediation target phase: delivery_planning
   Suggested fix: none required; @doc-syncer (lifecycle phase 7) should treat plan phase 8.6 as the delivery of record for the planning corpus and verify, not re-author, those rows.

Neither finding blocks delivery: both are wording-level, already reconciled by the plan's own declarations, and enforced by committed tests rather than prose.

## Gate Result

**READY** — all facets pass; no pause flag. Delivery (phase 6 of the lifecycle) may start against plan phases 1–8. Per the change's own conventions: commits through the commit primitive, `TMPDIR=$PWD/tmp/tmpdir pnpm check` green at every phase boundary, PR → `main-tools`, STOP open, never merge.
