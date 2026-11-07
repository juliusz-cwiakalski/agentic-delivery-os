# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-236
Date: 2026-11-07
Pause Required: no

Reviewed at branch `feat/GH-236/spend-read-side` HEAD 7608dfe0 (base origin/main-tools a69b555e, which is the merged GH-233 dependency base — dependency satisfied as claimed). Artifacts: spec v1.1 (19 ACs, DEC-1..11), test plan v1.1 (34 TCs, TP-DEC-1..9), `chg-GH-236-plan.yaml` (delivery.plan.v1, 6 phases / 30 tasks, PIN-1..12), TDR-0011 (amended, Proposed). No prior readiness records (iteration 1; nothing to deduplicate).

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

No blocking findings. One required-non-blocking finding (F-1) and three nits; none gates delivery.

## Independent Verification (not taken from the authors' claims)

1. **Ticket re-read live** (`gh issue view 236`): both binding ACs and the pinned decision block match the spec's quotes word-for-word. Binding AC 1 — "a closed change reports its spend breakdown from the event log without re-querying harness stores" → quoted verbatim in spec §17 preamble + Appendix A → AC-F2-1 (+AC-F1-1, AC-F6-2) → TC-SPEND-003/006/032 → plan Phase 2 (task 2.2 read-contract half), Phase 3 (task 3.1 fold half), Phase 4 (tasks 4.2/4.5 runCli halves), Phase 5 (tasks 5.1/5.3). Binding AC 2 — "the resume-amplification metric reads approximately 1 for a healthy delivery and flags amplification events by name" → quoted verbatim → AC-F5-1 + AC-F5-2 (+AC-F5-3) → TC-SPEND-014/015/016/017 + TC-SPEND-034 → plan Phase 3 task 3.1(e), fixtures A-01..A-11 (task 2.3). Neither AC is weakened anywhere; "approximately 1" is strengthened to an exact deterministic 1 by DEC-3/TDR-0011 C-2 (satisfies, never weakens). Ticket tasks all map: per-ticket/per-phase/class tokens (F-1/F-3), calls (F-1), per-agent/model (F-4), amplification (F-5), restarts (F-4), text+JSON (F-6), alarms/burn-rate/quota deferred (NG-1). Pinned decisions honored (DEC-1 log-only; DEC-3; NG-1).
2. **Plan schema validity re-run myself** through the production path (`validatePlan` via `packages/core/src/domain/plan-validate.ts` with the edge's own `parseConfigYaml` port over the artifact file): **verdict `valid`, `readyForDevelopment: true`, `errors: []`, 6 phases**. The author's claim is reproduced, not trusted.
3. **Coverage counted, not assumed**: spec AC inventory = exactly 19 unique ids (AC-F1-1..AC-F8-3). Plan traceability matrix expanded: P1{001,009} P2{006,008} P3{003,004,005,010–019,021–024,033} P4{007,020,025–030,032} P5{002,034} P6{031} — union is exactly TC-SPEND-001..034, each in exactly one phase, zero missing, zero extra. Test plan §3.1 maps all 19 ACs to ≥1 TC (none TODO); §3.2 DM-1..6 and §3.3 NFR-1..7 all mapped; NFR-4's wall-clock half explicitly reference-only (GAP-2) with its CI-verifiable bounded-work half asserted. Phase scope files match the completing TC assignments; Phase-4 "extended in place" files (spend-read-contract, spend-store-damage, spend-breakdown, spend-phase-filter, spend-amplification-null, spend-determinism) are the declared runCli extensions of Phase-2/3 suites, consistent with the exactly-once rule ("earlier phases verify named halves in prose only").
4. **Oracle-fork hunt across all four artifacts** (spec / test plan / plan / TDR-0011) on the flagged surfaces — no fork found:
   - Amplification block shape `{ratio, progressRun, events[]}`: identical in spec DM-1/AC-F5-3, test plan §3.2 DM-1 row + TC-SPEND-001 step 5 + TC-SPEND-017 step 4 + TC-SPEND-020 step 4, plan task 1.1, TDR-0011 C-6 + Amendment A-1/A-3. Six top-level `data` keys unchanged everywhere; `delivery.spend.v1` a declared constant, never a `data` key (TP-DEC-9 = PIN-1).
   - Generalized null rule (ratio null for zero-token progress run, paid > 0 **and** paid = 0 ∧ all classes null, `progressRun` naming the run, null when progress > 0): identical in spec DM-3/AC-F5-3/DEC-11/Appendix C, test plan TP-DEC-1/A-04/A-05/TC-SPEND-017, plan task 3.1(e), TDR A-2 + Verification Criteria.
   - Capture-outcome-only store: pinned identically as PRESENT (never telemetry-absent) in plan task 2.2, test plan A-11/§8.2, TDR A-1 grounding. See finding F-1 for the spec-side silence.
   - Error row: exactly one new row `spend.telemetry-absent` (user / non-retryable / `not_landed` / user-validation → exit 1), no delivered row altered, exit taxonomy 0/1/2 — identical in spec DM-5/DEC-7/AC-F7-1, test plan §4.6 + TC-SPEND-009, plan tasks 1.2/1.3. Verified against delivered truth: `spend` absent from `DOMAIN_KINDS` (error-table.ts:13-30); `state.store.torn`/`state.schema.mismatch`/`state.store.unknown` → platform-provider (exit 2); `state.permission.denied` → user-validation (exit 1); projection mapping success 0 / user-validation 1 / platform-provider 2 per feature-result-contract.md.
   - Digest flip: placeholderSectionCount 2→1, sole placeholder `blockers`, `state-log` additive source, observed/absence-line/`state-unreadable` mappings — identical in spec DM-6/DEC-8/AC-F8-1..3, test plan TC-SPEND-027..030, plan tasks 4.3/4.4 (one commit, corpus+goldens regenerated together). Verified against delivered contracts: `STATUS_PLACEHOLDER_SECTION_IDS = ["spend","blockers"]` (contracts/status.ts:44), pinned line present in domain/status.ts:1710, `STATUS_EVIDENCE_SOURCES` has no `state-log` (additive as claimed), feature-status-digest.md pins exactly-2 and the always-`not-delivered` spend derivation row this change flips.
   - Read-only posture: enforced structurally (PIN-12 no append/fence/salvage member; tasks 2.1/2.2/4.2) and negatively (Phase 5 tasks 5.1/5.3: imports guard, M-07 harness-adapter probe mutant, M-10 fence+write mutant; TC-SPEND-032 byte-snapshot/fence/child-process/network/audit-failure on every path incl. failure paths; TC-SPEND-002 static half). `state.lock.busy` asserted unreachable.
5. **TP-DEC ↔ PIN alignment**: TP-DEC-2→PIN-4, TP-DEC-3→PIN-5, TP-DEC-4→PIN-5, TP-DEC-5→PIN-3, TP-DEC-6→PIN-6, TP-DEC-7→PIN-7, TP-DEC-8→PIN-8, TP-DEC-9→PIN-1; TP-DEC-1 is explicitly spec-backed (OQ-T1 resolved, cites DM-3/AC-F5-3/Appendix C) and carried by plan task 3.1(e) — accepted, not orphaned. OQ-T3..T7 → PIN-4/PIN-6/PIN-3/PIN-8/PIN-7 exactly as the plan claims. GAP-2→PIN-10/task 3.4, GAP-3→PIN-9/tasks 3.3+3.5, GAP-6→PIN-3/tasks 3.1+3.3 — every delivery-bound gap has an owning task.
6. **Scope discipline**: no phase scope touches `doc/changes/**` or `.ai/local/**` (checked every file/folder entry of phases 1–6). Changeset (task 6.2) + aggregate gate (task 6.1 `pnpm check`) + doc-distribution guard are in finalize. `doc/spec/**` reconciliation is declared Phase-6 scope for @doc-syncer's lifecycle-phase-7 work, never coder tasks; the single delivery-phase doc/spec touch (documented error-table row, task 1.3) is a declared exception structurally forced by the bidirectional error-table-sync gate binding from the first commit (GH-232 lesson) — accepted.
7. **Delivered-surface existence**: `readHarnessTelemetry`, `readHarnessCaptureOutcome` (singular, per-run — the additive per-ref plural read of PIN-12 is genuinely new), `readChangeTransitionsTolerant`, `CANONICAL_PHASE_IDS` (`quality_gates` canonical, `deployment` absent — P-13/P-14/L-07 correct), `HARNESS_WARNING_REASONS` (contains every reason the fixtures use: `optional-field-absent`, `non-numeric-value`, `cost-missing`, `truncated`, `session-capture-failed`), `tests/fixtures/state/harness.ts` helpers, `tests/fixtures/closeout/harness-telemetry.ts` builders, `tests/golden/redaction.test.ts` pattern, `tests/behaviour/brief-{placeholders,shared-truth}.test.ts`, `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, and the whole `scripts/checks/` battery the plan reuses — all exist. PIN-11's ref pattern `^[A-Z][A-Z0-9]*-\d+$` is byte-identical to the closeout precedent (`packages/cli/src/commands/closeout.ts:31`). No new `scripts/checks/*.ts` invariant is required, matching the delivered battery's coverage.

## OQ confirmations requested of this gate (test plan §8.3)

- **OQ-T3 / TP-DEC-2 / PIN-4 — CONFIRMED.** End-inclusive `complete`, start-inclusive `reopen`, reopen-wins on a shared stamp is the deterministic refinement DM-2's window wording requires (NFR-2 demands some pin; the alternative readings flip records between phases). Pinned once, asserted at P-03/P-05.
- **OQ-T4 / TP-DEC-6 / PIN-6 — CONFIRMED.** F-3 "restricts the report to one phase's attribution window" + AC-F3-3 "scoped selection" read naturally as one selection, one fold; a global-amplification carve-out would be a second, unpinned rule. The digest's ref scope is unaffected (spec §12, TC-SPEND-030 step 4).
- **OQ-T6 / TP-DEC-8 / PIN-8 — CONFIRMED.** F-1 counts warnings over records (not session-group records); a capture-outcome `session-capture-failed` vanishing under session-only accounting would hide exactly the incompleteness the block exists to disclose.
- **OQ-T7 / TP-DEC-7 / PIN-7 — CONFIRMED.** AC-F2-3 "never a zeroed or partial report served as truth" + AC-F3-2's fallback being scoped to *absent* transitions: an unreadable attribution source classifies; only absence falls back to `unknown`.
- **TC-SPEND-031 help-path reading — ACCEPTED** as plan-pinned: the locked grammar (AC-F6-1) admits no `--help` flag; help ships on the documented surfaces; TC-SPEND-025 step 7's "(or the documented help path)" is operative.

## Findings

1. [major — required-non-blocking, does not gate READY] cross_artifact_consistency — chg-GH-236-spec.md#§8.3 DM-3 (also §17 AC-F5-3, §15 DEC-11)
   Gap: DM-3 leaves `progress` (and therefore `ratio`/`progressRun`) undefined in the one reachable shape with **no record-bearing run**: a capture-outcome-only store (a run whose session captures all failed still lands a capture-outcome record — exactly the `session-capture-failed` shape). DM-3's parenthetical ("a success envelope always carries at least one record") addresses record presence, not run presence, and neither "names the run … (null when progress > 0)" nor DEC-11's "the progress run's identity exactly when the progress run contributed zero tokens" states the null/no-run combination. The other three artifacts pin it unanimously and identically — TDR-0011 Amendment A-1 (with explicit grounding), test plan §4.3 A-11 + §8.2 assumption, plan task 3.1(e) "null/null only when no record-bearing run exists (A-11)" + task 2.2 "capture-outcome-only store is PRESENT" — and the spec's OQ-1 resolution delegates amplification-block stability to TDR-0011, so no contradiction, no coder freedom, and no oracle fork exists today. The gap is authority-side completeness: the change-scoped formula definition should carry its own boundary. Not blocking because the delivery-facing pin is single-sourced (TDR A-1, cited by both plan and test plan) and the spec reading is derivable (nullable run-id-or-null field; undefined division → null).
   Suggested remediation target phase: specification
   Suggested fix: one additive DM-3 clause (with a DEC-11 addendum note): "when no record-bearing run exists (capture-outcome-only store), `ratio` is null and `progressRun` is null — a success report, never telemetry-absent"; per OQ-1's stability contract it rides the TDR-0011 addendum path the v1.1 amendment already established. Fold in at the next spec touch or as a pre-PR housekeeping commit; do not hold delivery.

2. [nit] cross_artifact_consistency — chg-GH-236-test-plan.md#§2 References (implementation-plan bullet) and §1.2 GAP-1
   Gap: Both still describe `chg-GH-236-plan.yaml` as "authored in phase 4 … does not exist yet / not yet present (GAP-1)"; the plan now exists and satisfies GAP-1's binding condition (34/34 mapped, no TC reshaped — verified here). Stale pointer only; §3 coverage and §7 automation mapping are accurate for the existing artifact. Same shape as GH-232 iter-2 finding 1, there classified a nit.
   Suggested remediation target phase: test_planning
   Suggested fix: mark GAP-1 resolved (like GAP-4/5) and update the §2 bullet; no oracle or coverage change.

3. [nit] decision_capture — chg-GH-236-spec.md#front matter `links.related_decisions`
   Gap: TDR-0011 is cited throughout (OQ-1, DEC-3, DEC-11, §22) but absent from the front-matter decisions list (ADR-0003, ODR-0003, TDR-0004, TDR-0005). Already recorded as an owned phase-7 handoff item in pm-notes (2026-11-07 note: "add TDR-0011 to the spec's links.related_decisions").
   Suggested remediation target phase: specification (or absorb via the recorded doc-sync handoff)

4. [nit] plan_coverage — chg-GH-236-plan.yaml#PIN-3 / test plan §4.9 TP-DEC-5
   Gap: `perPhase[]` ordering key "window start ASC" does not say which window start a multi-window phase entry uses (TP-DEC-4 aggregates `complete→reopen→complete` into one entry); natural reading is the phase's earliest window start, and the suite pins the invariant set (total, permutation-invariant, tail-drop, marker) with exact keys in one contract constant — so no oracle fork, just a note for the constant's author.
   Suggested remediation target phase: delivery_planning (one clarifying word in PIN-3 at the next plan touch; optional)

## Notes

- **Decision routing**: no new system-level or precedent-setting decision surfaced at this gate — the amplification formula decision is already captured as TDR-0011 (status Proposed; owner acceptance deliberately reserved at PR review per the TDR-0009 precedent and pm-notes). That reservation is a downstream PR-review obligation already routed, not a DoR pause. No human input required.
- **DoD**: operational and testable — spec §17's 19 ACs each map to automated TCs, §4.1 gives measurable KPIs (binding-AC pass rate 100%, determinism byte-identical, bounds, absence classification, zero harness reads), and plan Phase 6 confirms 34/34 TC + 19/19 AC + `pnpm check` + changeset + doc-distribution guard before completion.
- **Deduplication**: iteration 1, no prior records; all findings new.
- **Non-vacuity**: TC-SPEND-034's twelve-mutant meta-suite (M-01..M-12, incl. the formula mutants M-03/M-04/M-05/M-06 and the read-only mutants M-07/M-10) plus the §4.2 paired-control contract satisfy the mutant-meta-case requirement for the formula TCs.
- **Iteration cap**: iteration 1 of ~3; F-1 is remediable in one surgical sentence and nothing else blocks.
