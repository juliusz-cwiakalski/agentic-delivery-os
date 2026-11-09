# Readiness Review Iteration 4

Verdict: **READY**
Work Item: GH-275
Date: 2026-11-09
Pause Required: no

Artifacts reviewed: `chg-GH-275-spec.md` v1.3 (30 ACs), `chg-GH-275-test-plan.md` v1.4 (46 TCs), `chg-GH-275-plan.yaml` revision 4 (`plan validate GH-275 --json` → `valid`, `readyForDevelopment: true`, 0 errors), `chg-GH-275-pm-notes.yaml` (iteration-4 authorization), `doc/decisions/TDR-0016-harness-streaming-spawn-seam.md`, `doc/decisions/00-index.md`, ticket GH-275, and delivered source/contracts used as oracles.

Counts: **0 blocking**, **0 gating-major**, **5 non-gating advisories**. Iteration-3 findings N-1..N-4 are fixed with file:line evidence. N-5 is fixed for the decision-index row and the spec version; its test-plan version label is stale by one minor version (advisory 4). No source-code, traceability, AC/TC ownership, or plan-schema defect remains.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS (30/30 ACs and 46/46 TCs each owned by exactly one phase; `plan validate` valid)
- test_traceability: PASS (every AC has at least one named TC; 46 TCs)
- cross_artifact_consistency: PASS (all iteration-3 contradictions fixed; the five remaining items are citation/count/version nits with no delivery effect)
- decision_capture: PASS (TDR-0016 body unchanged; index row correct; index format/order correct)
- system_spec_consistency: PASS (phase-7 reconciliation declared; no silent drift from delivered contracts)
- plan_doc_update_coverage: PASS (P6 names `feature-harness-adapters.md`, `feature-dispatch-engine.md`, and "any contract table")
- plan_code_area_coverage: PASS (per-phase file scopes complete; every plan-owned edit appears in test plan §7.1/§7.2)
- dod_defined: PASS (ACs + NFRs + E2E procedure + lease proof)

## Iteration-3 resolution (evidence)

| ID | Status | Proof / disproof |
|---|---|---|
| N-1 `failureReported` | **FIXED** | Plan P2 lines 380-384 now state the spec v1.3 explicit-fact rule: `failureReported` true iff a JSONL `error` event or the legacy envelope's `result.failure === true`/`result.status === "failed"`, and "a non-zero process exit is carried by `exitStatus` only and classifies `failed` through the classifier's exit branch (`packages/core/src/domain/harness-classify.ts:50-52`)". The contradicted clause survives only in the revision-4 note that quotes it as removed (line 70). Matches spec F-4/DEC-5 line 317, §8.4 line 226, AC-F1-5 line 345, AC-F4-3 line 357, AC-F4-4 line 358, and test plan §1.1 line 32 / TC-OCS-015 line 548 / 033 / 045 / 048. |
| N-2 P4 conformance obligation | **FIXED** | Plan P4 lines 530-541 now require a **multi-line** JSONL `spawnStdout` acquisition ("two or more lines whose first line carries a top-level `sessionID`, with a later terminal `step_finish`") and explicitly state that `HarnessConformanceIo`/`build` cannot expose a runner-vs-starter choice, so "never over the one-shot runner" is **NOT** asserted. This matches TC-OCS-061 step 1 at test plan line 1281 and M-15 at line 1935 (the mutation stays observable because a runner-only registration fails the multi-line acquisition). |
| N-3 P6 `liveness:` ref | **FIXED** | Plan P6 lines 706-713 now call the `liveness:` ref "CORROBORATION ONLY", state the production adapter receives no `livenessFacts` (`packages/cli/src/production.ts:443-458`; `packages/adapters/src/harness/opencode.ts:257`), and name the deterministic suite (TC-OCS-020/021/082) as the discriminator. Matches test plan lines 1722-1727, 1757, 1763; the PASS rule still requires the ref as corroboration, which the plan does not dispute. |
| N-4 §7.1/§7.2 inventory | **FIXED** | Test plan v1.4 §7.1 now lists `tests/fixtures/queue/production/harness.ts` (line 1800, plan P2) and `tests/structure/content-inventory.test.ts` (line 1814, plan P1) with the exact allowance `["createHostSpawnRunner"]` at `tests/structure/content-inventory.test.ts:682`, admitting `createHostSpawnStarter`. §7.2 lines 1895 and 1897 carry both with phases P2/P1 and no new TC. Probes: `content-inventory.test.ts:682` is exactly `"adapters/src/host/index.ts": ["createHostSpawnRunner"],`; the queue fixture injects only `harnessSpawnRunner` (`tests/fixtures/queue/production/harness.ts:205`) while `tests/behaviour/queue-production-binding.test.ts:504` runs `dispatch`, so the starter injection is required for NFR-5. |
| N-5 headers + index row | **FIXED for index; PARTIAL for version label** | `doc/decisions/00-index.md:42` has `[TDR-0016](TDR-0016-harness-streaming-spawn-seam.md) | TDR | Additive Harness Streaming Spawn Seam (`HarnessSpawnStarter`) | Proposed | 2026-11-09 | Juliusz Ćwiąkalski`, matching TDR-0016 front matter (`id` line 1, `status: Proposed` line 4, `created: 2026-11-09`, `owners` line 9) and H1 line 74; appended after TDR-0015 in numeric order with the same six-column/link format. Plan line 90 names spec v1.3 correctly. Plan line 94 and revision note line 64 still name **test plan v1.3**, while the artifact is v1.4 (header line 4). See advisory 4. |

## Probes executed

- `bun packages/cli/bin/delivery-os.ts plan validate GH-275 --json` → `verdict: valid`, `readyForDevelopment: true`, `errors: []`, `totalErrors: 0`.
- AC/TC ownership parse of the plan's `doneArtifacts` → 30 ACs / 46 TCs, no unmapped, no multi-owned, no invented IDs; header ownership lists (plan lines 127-154) agree with the per-phase `doneArtifacts`.
- Test plan definitions and §10 rows → 46 unique `#### TC-OCS-*` definitions, 46 unique TC rows, every AC in §3.1 has at least one TC.
- `doc/decisions/00-index.md:42` vs TDR-0016 → id/title/status/date/owner match; ordering after TDR-0015; format matches the neighbouring rows.
- P6 scope staging probe (`node` with `localeCompare("en")`) → `.changeset/gh-275-opencode-harness-contract-minor.md` sorts first; `doc/changes/...`, `doc/decisions/00-index.md`, `doc/decisions/TDR-0016-...md` follow. `00-index.md` is not ref-shaped.
- Commit-template probe: `commit-staging.ts:72` sorts the include list; `commit-act.ts:289` uses `include[0]`; `commit-message.ts:143-160` builds the template from `planSummary ?? topPath`; `commit.ts:405`/`phase.ts:558` pass the plan phase summary; the 72-char cap (`commit.ts:82`) cuts P6's summary before any ref token; model drafts are sanitized at `commit-message.ts:27-31,38`. A standalone `commit GH-275` of the TDR alone would still fail, but P6 is a single phase commit containing the changeset first, so the mitigation holds.
- `git status --short` → only `doc/decisions/TDR-0016-...md` untracked; the index row is already committed in `9eda3241` (accepted P6 constraint).
- `doc/spec/**` scope sweep → no `doc/spec` path in any phase's `scope.files`; the only mentions are the phase-7 handoff (plan lines 758-764 and 790-791).

## Non-gating advisories

1. **[minor] cross_artifact_consistency** — `chg-GH-275-test-plan.md` §7.1 line 1812
   Gap: "Six legacy cases + six JSONL counterparts" while TC-OCS-061 step 3 (line 1283) and plan P4 (line 542) specify **five** identified JSONL counterparts; `spawn-refusal` is legacy-only and its counterpart is the pre-session no-identifier refusal in TC-OCS-013. A coder following §7.1 literally could add an impossible sixth identified counterpart.
   Suggested remediation target phase: **test_planning**
   Suggested fix: change "six JSONL counterparts" to "five identified JSONL counterparts plus the TC-OCS-013 pre-session refusal control".

2. **[nit] cross_artifact_consistency** — `chg-GH-275-test-plan.md` §7.1 line 1805
   Gap: the stream-suite purpose lists "TC-OCS-010–017, 020–023, 040–048", but TC-OCS-023's target is `tests/behaviour/harness-stream-hygiene.test.ts` (line 703), §7.2 maps it there only (line 1856), and plan P5 owns it (line 152). The range implies a duplicate P2 copy.
   Suggested remediation target phase: **test_planning**
   Suggested fix: change the range to "TC-OCS-010–017, 020–022, 040–048".

3. **[nit] cross_artifact_consistency** — `chg-GH-275-plan.yaml` P6 lines 712-713
   Gap: the sentence cites "TC-OCS-100 step 6, TC-OCS-101 step 5" for "`collect` staying pending across at least one poll", but those steps assert the liveness ref and the lease proof; the actual assertion is TC-OCS-082 step 1. The same sentence already names `TC-OCS-020/021/082`.
   Suggested remediation target phase: **delivery_planning**
   Suggested fix: replace the parenthetical with "(TC-OCS-082 step 1)" or delete it.

4. **[nit] cross_artifact_consistency** — `chg-GH-275-plan.yaml` line 94 and line 64
   Gap: plan Sources/revision note say "Test plan ... v1.3" while the artifact is v1.4 (test plan line 4). The v1.4 delta is only the two §7.1/§7.2 inventory rows the plan already required, so substantive alignment is intact; the label is behind.
   Suggested remediation target phase: **delivery_planning**
   Suggested fix: change "v1.3" to "v1.4" in both places.

5. **[nit] cross_artifact_consistency** — `chg-GH-275-plan.yaml` P6 lines 745-749
   Gap: the plan says the TDR-0016 row in `doc/decisions/00-index.md` "lands in this commit", but the row was already committed in `9eda3241` (`doc/decisions/00-index.md:42`); P6 will stage no index change. The TDR file itself is still untracked and correctly in P6 scope.
   Suggested remediation target phase: **delivery_planning**
   Suggested fix: say the row is already committed and P6 stages the TDR alongside the changeset, or drop `doc/decisions/00-index.md` from the P6 scope if no edit is expected.

## New-vs-unapplied classification

- **N-1..N-4**: unapplied prior findings, now fully fixed; none recurs.
- **N-5**: index-row half fixed; the stale test-plan version label is a **genuinely new bibliographic drift** created by the test plan v1.4 bump after plan revision 4 (advisory 4).
- **Advisories 1-2**: pre-existing test-plan shorthand not raised in iterations 1-3; **newly surfaced**, not re-raised fixed findings.
- **Advisory 3**: **genuinely new**, introduced by revision 4's N-3 wording.
- **Advisory 5**: **genuinely new**, created when the index row was committed in `9eda3241` before P6.

## Required remediation per owning artifact

- **None gating.** Delivery is unblocked.
- Optional nits: `@test-plan-writer` for advisories 1-2; `@plan-writer` for advisories 3-5. None changes an AC, TC, bound, evidence rule, file ownership, or the E2E procedure, so they may be folded into the normal delivery revision rather than reopening an artifact phase.
