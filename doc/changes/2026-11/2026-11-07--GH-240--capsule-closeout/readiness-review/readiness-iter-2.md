# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-240
Date: 2026-11-07
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

Facet score: **10/10 PASS**. No remaining blocker. Delivery is authorized. Seven non-blocking findings are recorded below; none reshapes a pinned vocabulary, AC, NFR, DEC, TC oracle, or phase split.

## Iteration-1 Blocking Findings — Independent Verification

| # | Iteration-1 blocker | Status | Clause and evidence at the original site |
|---|---|---|---|
| 1 | TC-CAP-004 and TC-CAP-010 marked complete in P1/P2 but assert closeout behaviour landing in P3 | **CLOSED** | Plan v1.2 header D-13 and the seven-split map now mark P1/P2 as runtime/producer halves and P3 as the completing phase (plan P1 coverage lines “TC-CAP-004 structure half… completes in P3”, P2 coverage “TC-CAP-010 producer/self-containment half… completes in P3”, P3 tasks 3.4 and coverage). P1/P2 `testGate` run only the runtime/producer halves; P3 `testGate` extends `capsule-lock.test.ts` and `capsule-producer-nongating.test.ts`. |
| 2 | TC-CAP-034 marked complete in P6 but needs P7 worktree fixtures and the P10 family row | **CLOSED** | Plan D-13 declares a three-way TC-CAP-034 split: P6 attention/data-exit subset, P7 worktree-refusal subset, P10 family-row/full-matrix completion. P6 task 6.2/6.4 explicitly omit the P10 family row and P7 worktree fixture; P7 task 7.4 adds the worktree half; P10 task 10.4 completes. P6/P7/P10 `testGate` include `closeout-attention-exit.test.ts`. |
| 3 | TC-CAP-014 asserted “twelve step outcomes” in P3 | **CLOSED** | Test plan v1.3 TC-CAP-014 step 3 now asserts “the planned step outcomes… the seven delivered steps plus `capsule`; the exact twelve-step array is asserted in TC-CAP-050 at P10.” The exact twelve-step oracle is preserved in TC-CAP-050. No AC/NFR/TC count changed. |
| 4 | Merged-diff action vocabulary declared closed but never enumerated; AC-F5-1 broader than F-5 | **CLOSED** | Spec v1.2/v1.3 F-5, DM-6, OQ-1, RSK-5 and Appendix C enumerate four action tokens (`remove-guard`, `retire-flag`, `rename-class`, `close-todo`) and the fixed 1:1 kind→action mapping (`todo-marker→close-todo`, `when-merges-note→remove-guard`, `feature-flag→retire-flag`, `class-string→rename-class`). AC-F5-1 now requires “names this work item **and** whose kind maps to a declared action”; out-of-vocabulary and kind-mismatched actions are `ambiguous-flip-hit`. Test plan §4.5, TC-CAP-024/025/028 and plan D-4 assert the exact set, mapping, and negatives. |
| 5 | AC-F5-1 conflicted with F-5/test plan on out-of-vocabulary actions | **CLOSED** | AC-F5-1 now explicitly says “a marker that is unattributed, names another work item, is a `class-string` without an attributable owner, or declares an out-of-vocabulary or kind-mismatched action becomes `ambiguous-flip-hit` residue (never resolved).” Test plan §4.5 classification table and TC-CAP-025 carry the same negative cases. |
| 6 | Applied `capsule.candidates[]` shape conflicted with EVT-2/DM-3 and TC-CAP-016/023 | **CLOSED** | Spec F-3/F-4, EVT-2, DM-3 and DM-5 now pin two distinct shapes: durable `capsule.promotion` payload `{id, class, decision, mode?, home?, reason?, supersedes?}` (mode/home iff promoted, reason iff rejected, supersedes iff declared) and applied `capsule.candidates[]` projection `{id, decision, home?, reason?}` (class/mode/supersedes explicitly absent). Test plan TC-CAP-016 step 3-4, TC-CAP-020 step 2 and TC-CAP-023 step 2-3 assert both shapes and the absence side. |
| 7 | Test plan invented a “classified conflict” outcome for a pre-existing differing record file | **CLOSED** | Spec v1.2 F-4, DEC-5, DEC-6, AC-F4-3 and DoD-4 pin the three pre-existing-target outcomes using the existing rejection set: byte-identical → `satisfied` no-op; same identity/different content → `duplicate:<existing-id>`; different identity declaring `contradicts` without matching `supersedes` → `contradiction-requires-supersession`; never an overwrite. Test plan §4.4 and TC-CAP-022 steps 2-7 assert the three outcomes and the no-overwrite structural scan. |
| 8 | Candidate `status` and evidence-link shapes required but not enumerated | **CLOSED** | Spec v1.2 F-4, DM-2 and Appendix C pin `status ∈ {candidate, authoritative, superseded}` (new promoted records are `candidate`; `authoritative` is read-only; only `superseded` is rewritten) and five evidence shapes (`review-verdict:<ref>`, `ci-verdict:<ref>`, `human-correction:<ref>`, `merged-pr:<ref>`, `test:<ref>`). Missing/empty evidence is `evidence-missing`; a non-empty malformed shape is `closeout.capsule-invalid`. Test plan TC-CAP-017 steps 7-9 and TC-CAP-018 step 4 assert the positive and negative cases. |
| 9 | Path-confined promotion writes had no traversal/symlink/`supersedes` path-escape test | **CLOSED** | Spec v1.3 F-4, AC-F4-1, AC-F4-2, F-11, AC-F11-2, §21, Appendix C and DoD-4 pin the exact identities: candidate id/record-name outside the slug shape (separator/`..`) → `closeout.capsule-invalid` before any write; resolved home outside `realpath(memoryRoot)` (symlink/absolute/traversal) → `closeout.step.capsule.failed` with zero writes and plan `would-refuse`; no new error row. Test plan TC-CAP-021 step 8(a)-(d) asserts both identities, the zero-write boundary, the outside-target snapshot, and the no-new-row rule; TC-CAP-053 reuses the family row and asserts no path-specific row. Plan P4 task 4.6 declares the family row, P10 proves the twelve-slot set. |

All nine iteration-1 blockers are **CLOSED** at the original sites. No finding is still open.

## v1.3 Clause Consistency (independent check)

1. **Four diff-sweep actions + kind→action mapping + AC-F5-1 — consistent.** Spec F-5/DM-6/OQ-1/RSK-5/Appendix C, test plan §4.5/TC-CAP-024/025/028, and plan D-4 all name the same four tokens and the same 1:1 mapping. AC-F5-1 requires attribution **and** the kind-mapped action; out-of-vocabulary, kind-mismatched, action-less, other-ref, and owner-less hits are all `ambiguous-flip-hit`. No fifth action or free-form action exists.
2. **Durable `capsule.promotion` payload vs applied `capsule.candidates[]` projection — consistent.** The durable event is `{id, class, decision, mode?, home?, reason?, supersedes?}` with conditional presence; the output projection is `{id, decision, home?, reason?}` and explicitly omits class/mode/supersedes. F-3/F-4/EVT-2/DM-3/DM-5, test plan TC-CAP-016/020/023, and plan P4 task 4.4 agree. The supersession link is durable-only.
3. **Three pre-existing-target outcomes — consistent.** F-4/DEC-5/DEC-6/AC-F4-3/DoD-4 and test plan §4.4/TC-CAP-022 use exactly: byte-identical `satisfied` no-op; same-identity different-content `duplicate:<existing-id>`; different-identity `contradicts` without matching `supersedes` → `contradiction-requires-supersession`; no overwrite. Target-existence-first (`supersedes-unknown`) is asserted before the pairing rule.
4. **Candidate status and evidence-shape sets — consistent.** Status is exactly `candidate | authoritative | superseded`; the change writes `candidate`, reads `authoritative`, rewrites only `superseded`. Evidence is exactly the five shapes; absent/empty is `evidence-missing`, non-empty malformed is `capsule-invalid`. F-4/DM-2/Appendix C, test plan TC-CAP-017/018, and plan task 4.1 agree.
5. **Path-escape identities — consistent.** Slug-shape violation → `closeout.capsule-invalid` before any write; realpath escape → `closeout.step.capsule.failed` with zero writes and plan `would-refuse`; no new error row. The family row is declared in P4 (slot validated against `CLOSEOUT_STEP_IDS`, which includes `capsule` from P3) and proved against all twelve slots in P10. Test plan TC-CAP-021/053 and plan D-5/P4 task 4.6/P10 task 10.2 agree.
6. **Explicit `contradicts`+`supersedes` predicate — consistent.** A candidate declares `contradicts: <record-id>` and must pair it with `supersedes: <record-id>` for the same target; target existence is checked first (unknown target → `supersedes-unknown`), otherwise missing/different `supersedes` → `contradiction-requires-supersession`. Dedup is exact normalized-statement equality; no similarity, embedding, or model judgment. F-4/DM-2/DEC-5/DEC-6/AC-F4-1/AC-F4-3/Appendix C/DoD-4, test plan §4.4/TC-CAP-017/020/022, and plan task 4.1/4.2 agree.

## Plan: Seven Split-TC Markers and Phase Green-at-Commit

The plan v1.2 maps 61/61 TCs exactly once and records exactly seven completing-phase splits. TC-CAP-052 is separately recorded as a golden-delta staging note (P5 human-thread delta → P10 final twelve-step golden), not one of the seven. No oracle was reshaped: TC ids, count (61), 26 ACs, 11 NFRs, and 44 mutants are unchanged.

| Split TC | Test-plan phase | Early half in plan | Completing phase | Evidence the early phase is green |
|---|---|---|---|---|
| TC-CAP-004 | P1 | P1 runtime lock (exclusive acquisition, serialized appends, bounded retry, runtime disclosure) | P3 closeout busy-lock (`state.lock.busy`, retryable, never `capsule-invalid`) | Plan P1 coverage + task 1.4 runtime half; P3 task 3.4 extends `capsule-lock.test.ts`; P3 `testGate` runs it. |
| TC-CAP-006 | P1 | P1 runtime terminal close | P3 applied `capsule.closed` payload and plan-mode absence | P1 task 1.4 `capsule-append.test.ts` runtime close; P3 `closeout-capsule-close`/`closeout-capsule-plan`; P3 `testGate`. |
| TC-CAP-010 | P2 | P2 producer non-gating (outcome/state/exit unchanged, classified disclosure, no fabricated event, torn-tail hash unchanged) | P3 closeout `capsule-event-gap` cross-check | P2 task 2.4/2.5 producer half; P3 task 3.4 extends `capsule-producer-nongating.test.ts`; P3 `testGate`. |
| TC-CAP-011 | P2 | P2 writer ownership/self-containment | P3 closeout cross-check | P2 task 2.4/2.5 structure half; P3 task 3.4 `closeout-capsule-gap`; P3 `testGate`. |
| TC-CAP-012 | P3 | P3 validation/damage rows | P4 candidate schema/decision rows and valid matrix row | P3 task 3.4 `closeout-capsule-validation` non-candidate rows; P4 task 4.5 candidate rows; P4 `testGate`. |
| TC-CAP-016 | P3 | P3 capsule-object shape/additivity | P4 decision mirror and full payload | P3 golden/envelope shape; P4 task 4.5 `closeout-capsule-payload`; P4 `testGate`. |
| TC-CAP-034 | P6 | P6 attention/data-exit subset; P7 worktree-refusal subset | P10 family-row/full attention matrix | P6 task 6.2/6.4 explicitly omit P10 family row and P7 worktree; P7 task 7.4 adds worktree; P10 task 10.4 completes; P6/P7/P10 `testGate` include `closeout-attention-exit.test.ts`. |

The P1/P2 phases now carry only their runtime/producer halves; the completing assertions are added in P3/P4/P7/P10. The plan’s `completionArtifacts` and coverage rows use “structure half”/“producer half”/“P6 subset” language consistently. No phase references a surface that lands later in the same phase boundary for these seven splits.

## Full Re-audit Against Ticket and Delivered Truth

- **Ticket AC traceability.** Read GH-240 and the 2026-11-07 PM scope comment. All five ticket AC clauses trace: AC 1 → AC-F1-1/AC-F3-1/AC-F4-2; AC 2 → AC-F4-1; AC 3 → AC-F5-1/AC-F6-1/AC-F7-1/AC-F8-1/AC-F11-1; AC 4 → AC-F10-1/AC-F10-2; AC 5 → AC-F12-2 plus the idempotency ACs. Ticket tasks (capsule events/candidates, memory consolidation, self-containment, merged-diff sweep, comment-thread check, tracker hygiene, branch/worktree cleanup, retro coverage, residue, telemetry two-stream pin, session compaction) are all represented. Nothing invented, nothing dropped. The ticket’s “one stream with the telemetry concept” is reconciled by the pinned two-stream clarification.
- **Coverage counts.** 26/26 spec ACs and 11/11 NFRs appear in test plan §3.1/§3.3 with named TCs. 61 TC ids are set-equal across §5.1 index, §5.2 details, §7 automation mapping, and §10 execution log. Plan maps 61/61 exactly once; no orphan/duplicate complete marker. 44 mutants remain.
- **Closed vocabularies and producer/consumer completeness.** Step ids (12), event kinds (11), writers (4), candidate classes (8), capture-bar bases (5), rejection reasons (8), residue kinds (8), marker kinds (4), action tokens (4) with fixed mapping, candidate statuses (3), evidence shapes (5), error identities (2 + `attention`) agree across spec §5.1/§17/Appendix C, test plan §4.2/§4.4/§4.5/§4.8/§4.10, and plan tasks 1.1/4.1/10.1/10.2. Every residue kind has a named producer and a consumer; every event kind has a producer and a consumer.
- **Result-envelope representability (data XOR error).** The envelope still carries exactly one of `data`/`error`; `attention` is the additive data-plus-exit-1 class for residue; a command-level failure returns the error envelope with no structured `residue[]` and failed-step evidence plus plan-mode residue (F-11 rule). Path-escape is a step failure (`closeout.step.capsule.failed`) in the error envelope; slug-shape violation is `closeout.capsule-invalid`; lock contention is the retryable `state.lock.busy` exit-2 error. No AC demands a shape the contract cannot represent.
- **Phase green-at-every-commit.** The seven splits above are the only test-plan phase-column mismatches (verified by set difference: 004, 006, 010, 011, 012, 016, 034). TC-CAP-052 is a golden staging note, not an eighth split. P1/P2 gates run only the early halves; P3/P4/P7/P10 gates run the completing halves. The P4 error-table gate declares the family row needed by TC-CAP-021’s P4 path escape; P10 proves the twelve-slot set. No oracle was reshaped.
- **Security predicates.** Diff sweep: one bounded added-line read anchored on the merge transaction squash SHA/parent, no history walk, no source edit/commit/push/remote, bounds 1 MiB/500 files/200 hits, 44-mutant non-vacuity (TC-CAP-024/025/026/027/028). Promotion writes: realpath-confined under the injected memory root, slug-shape violation → `capsule-invalid` before any write, realpath escape → `closeout.step.capsule.failed` with zero writes and plan `would-refuse`, path-shaped `supersedes`/`contradicts` → `supersedes-unknown` with no path join; no new error row; no push/remote/overwrite (TC-CAP-021/022, TC-CAP-053). Worktree removal: full predicate (merged evidence, convention, exact head, clean, not current, not locked/foreign, restore, earlier-failure gate), fixed argv, no shell, no force, no remote, temp-repo matrix and planted-force negative control (TC-CAP-036/037/038/039). Telemetry: read-only harness store, production composer injection, state-log-only landing, zero capsule statistics, plan silence, non-gating and idempotent (TC-CAP-045/046/047/048/049).
- **Idempotency/convergence.** Every new step has a mechanical re-run proof: capsule eventKey dedup/terminal close (TC-CAP-002/003/006/007/008/009/023), append lock (TC-CAP-004), caps (TC-CAP-005), promotion record/index-row/pre-existing target (TC-CAP-022/023), diff sweep (TC-CAP-027), thread resolution (TC-CAP-029/030), worktree (TC-CAP-038), retro coverage (TC-CAP-040), compaction checkpoint (TC-CAP-043), telemetry capture (TC-CAP-046), full restart convergence (TC-CAP-055). No idempotency claim is unproven.
- **Backward compatibility.** `delivery.closeout.v1` is held; `residue`/`capsule`/step `detail` are additive; the delivered seven step ids keep identity; consumers resolve by `stepId` and tolerate unknown ids; the synthetic legacy consumer plus MUT-CAP-42 prove non-vacuity; the three goldens are the only intended golden updates (TC-CAP-050/051/052; spec §8.5). The `comment-resolution` human-thread behavior change is the one deliberate behavioral change and is documented for consumers.
- **§17.1 DoD binding.** DoD-1..20 bind all 26 ACs (DoD-14), all 11 NFRs (DoD-15), every §4.1 metric (DoD-16), the aggregate/error-sync/doc-distribution/license/vulnerability gates (DoD-17), the single lockstep minor changeset (DoD-18), the neighbor docs (DoD-19), and the `main-tools` PR posture (DoD-20). DoD-4 now carries status/evidence vocabularies, the three target outcomes, path confinement, and no-similarity; DoD-5 carries the marker/action attribution; DoD-11 carries the failure-envelope rule. The DoD remains testable and fully bound.
- **Doc-sync coverage.** Plan P11 now lists the primary `feature-closeout.md` plus result contract, harness adapters, state layer, retro pipeline, session database admin, merge/verify deploy, commit primitive, pm-notes/phase transitions, verify gates, `.ai/memory/README.md`, AGENTS.md, architecture, glossary, `doc/overview/ubiquitous-language.md`, and `doc/00-index.md`. `doc/decisions/**` remains a recommended handoff (decision records not authored before DoR; see non-blocking finding 3).
- **Current system truth.** Verified against `feature-closeout.md` (seven-step dry-run transaction, 100-thread cap, four closeout error identities), `feature-result-contract.md` (success/user-validation/platform-provider, data XOR error, four closeout rows; the two new rows are additive), `feature-harness-adapters.md` (no production composer yet), `feature-retro-pipeline.md` (`retro.run` mode `collect`/`report`), `feature-session-database-admin.md` (`db` metadata surface), `feature-state-layer.md`, `feature-merge-verify-deploy.md`, `packages/adapters/src/git/index.ts` (worktree list only), `packages/core/src/contracts/closeout.ts` (`CLOSEOUT_STEP_IDS` seven ids), and `packages/core/src/contracts/error-table.ts` (`state.lock.busy` transient/retryable/platform-provider). The spec’s current-state snapshot and compatibility claims are accurate; the planned doc updates are the right neighbors.
- **GH-233 review re-assessment.** F-8 (Claude full-file read before the byte cap) is genuinely resolved on the production path by plan P9 task 9.3 and TC-CAP-047 (size/bounded read, bytes not UTF-16 units, truncated warning, no full-transcript read). F-11 (store-wide orphan/invalid-identity disclosure) is genuinely resolved by plan P9 task 9.4 and TC-CAP-048 (delivery-scoped failed count, out-of-port orphans as a store-level warning, bounded scan). F-9 (host-runner SIGTERM/stderr/UTF-16 semantics) is explicitly re-deferred with the production-consumer reason and a characterization test (plan P9 task 9.5, TC-CAP-049).
- **Plan code areas and validator.** Plan v1.2 is `delivery.plan.v1`, 11 phases, 51 tasks, 54 test-gate commands; the repo validator reports valid/readyForDevelopment=true. Named delivered files exist (`packages/adapters/src/file/plan-artifact.ts`, `packages/adapters/src/git/index.ts`, `packages/cli/src/projection.ts`, the closeout command/contracts/error-table, the closeout suites/fixtures). New files stay under the existing `./file`, `./git`, and `./harness` subpaths; no new subpath or dependency-cruiser allowance. `tests/fixtures/closeout/golden/regenerate.ts` is placed in P3 scope and invoked P3/P5/P7/P8/P10. The ubiquitous-language doc is in P11.

## Non-blocking Findings

1. [minor] spec_completeness / test_traceability — `chg-GH-240-spec.md`#F-4, DM-2 and Appendix C; `chg-GH-240-test-plan.md`#TC-CAP-017; `chg-GH-240-plan.yaml`#task 4.1
   Gap: `source` is a required candidate field but no allowed value set is pinned; the delivered `.ai/memory/README.md` comment lists `review_verdict | ci_verdict | human_correction | merged_pr`, and TC-CAP-017 asserts the class/scope/basis/trust/status sets but not `source`. A candidate with an arbitrary `source` could still be promoted; the memory-format lint is M2-S8.
   Suggested remediation phase: specification (reference/pin the existing source set or declare it delivery-bound), then test_planning (assert it in TC-CAP-017). Not a DoR blocker; no phase is reopened for delivery.

2. [minor] cross_artifact_consistency — `chg-GH-240-test-plan.md`#§4.1 rule 5 vs `chg-GH-240-plan.yaml`#D-10/P3/P10
   Gap: The test-plan harness contract still names `bun run tests/fixtures/capsule/golden/regenerate.ts --write`, while plan D-10 and the P3/P5/P7/P8/P10 tasks use `tests/fixtures/closeout/golden/regenerate.ts`. The plan explicitly records the test-plan path as illustrative/incorrect, but the two artifacts still spell different paths.
   Suggested remediation phase: test_planning (align §4.1 to the plan path). Not a DoR blocker.

3. [minor] cross_artifact_consistency / decision_capture — `chg-GH-240-pm-notes.yaml`#notes
   Gap: The PM notes still say “five split TCs … 052 P5→P10” and “the step family row + consolidated proof in P10”; plan v1.2 has seven splits (004, 006, 010, 011, 012, 016, 034) with TC-CAP-052 as a golden staging note, and the family row is declared in P4 with P10 proving the twelve-slot set. The notes are context, not the source of truth, but the stale rows are traceability noise.
   Suggested remediation phase: delivery_planning (refresh the PM record before PR). Not a DoR blocker.

4. [minor] test_traceability / security — `chg-GH-240-test-plan.md`#TC-CAP-021 oracle vs step 8(b); `chg-GH-240-spec.md`#F-4
   Gap: The TC-CAP-021 binding oracle says “zero writes occur outside the root”, while the spec F-4 and TC-CAP-021 step 8(b) say “zero writes”/“zero writes anywhere”. The step is stronger; the oracle summary is weaker. Tighten the oracle to “zero writes anywhere (inside or outside the root)” so a symlink/escape failure cannot leave a partial record inside the root.
   Suggested remediation phase: test_planning. Not a DoR blocker; the operative step already asserts zero writes.

5. [minor] plan_coverage — `chg-GH-240-test-plan.md`#TC-CAP-033; `chg-GH-240-plan.yaml`#P6 task 6.1/6.4
   Gap: TC-CAP-033 (P6) says “Run the full apply” with all eight residue kinds; the production closeout plan at P6 lacks the P7 worktree and P8 retro/session steps. The plan P6 task 6.1 defines all eight residue producers in `capsule-residue.ts`, so the P6 privacy test can use the producer-registry composition (as TC-CAP-035 does), but the plan should state that explicitly to avoid a coder running the production plan and finding three kinds unreachable.
   Suggested remediation phase: delivery_planning (one sentence in P6 task 6.4) or test_planning (clarify step 1). Not a DoR blocker; the producer registry is P6.

6. [nit] cross_artifact_consistency — `chg-GH-240-spec.md`#§18 P10 “error rows” vs `chg-GH-240-plan.yaml`#D-5
   Gap: The spec’s high-level delivery order says P10 handles “error rows”; plan D-5 declares the `closeout.step.<id>.failed` family row in P4 (needed by TC-CAP-021’s P4 path escape) and P10 proves the twelve-slot set. The plan records the staging; the spec sentence is a high-level ordering note, not a phase pin.
   Suggested remediation phase: specification/delivery_planning (optional wording). Not a DoR blocker.

7. [nit] spec_completeness — `chg-GH-240-spec.md`#F-4/DM-2
   Gap: `created` and `created_by` are required candidate fields but their formats are not pinned; the existing `.ai/memory/README.md` uses string values. Delivery-bound; the record format/lint owns the final validation (M2-S8).
   Suggested remediation phase: specification (optional one-line “delivery-bound string” note). Not a DoR blocker.

## Delivery Authorization

- Remaining blockers: **none**.
- Reopened phases: **none** (iteration-1 specification, test_planning, and delivery_planning blockers are all closed; the non-blocking findings are delivery-time corrections and do not require a DoR rerun).
- Delivery authorized: **yes** (READY).

## Verification Evidence (adversarial checks performed)

- Read the full iteration-1 verdict and re-checked every blocker at the original artifact site (not the PM notes’ summary).
- Read GH-240 body and the PM scope comment; re-checked the five ticket AC clauses and the pinned telemetry/compaction clarifications.
- Parsed the plan: `delivery.plan.v1`, 11 phases, 51 tasks, 54 test gates, 61/61 TCs exactly once, seven split markers (004, 006, 010, 011, 012, 016, 034), no duplicate/orphan.
- Parsed the test plan: 61 TC ids set-equal across index/details/automation/execution log; 26/26 ACs and 11/11 NFRs covered; 44 mutants; no orphan.
- Checked the four requested closed-vocabulary areas across spec §5.1/§17/Appendix C and test plan: step ids, event kinds, rejection reasons, residue kinds — set-equal. Also checked marker kinds/actions, candidate classes/bases/status/evidence, error identities, and the `attention` class.
- Checked the v1.3 clauses directly: four actions/mapping/AC-F5-1; durable promotion payload vs applied projection; three pre-existing-target outcomes; status/evidence sets; path-escape identities/no new row; explicit `contradicts`+`supersedes` existence-first/no similarity.
- Checked phase-green-at-every-commit: P1/P2 runtime/producer halves; P3/P4 completing halves; P6/P7/P10 TC-CAP-034 subsets; P4 family-row declaration vs P10 twelve-slot proof; P1/P2 testGates contain no closeout-dependent file; P3/P4/P7/P10 testGates contain the completing suites.
- Checked security: diff sweep bounded/local/no source/remote; promotion realpath confinement and no new error row; worktree full predicate/no force/no shell/local-only; telemetry read-only/plan-silent/state-log-only/non-gating.
- Checked idempotency for every new step and the full restart convergence case; checked `delivery.closeout.v1` additivity, consumer tolerance, and the three golden updates.
- Checked §17.1 DoD-1..20 binding: all ACs (DoD-14), all NFRs (DoD-15), metrics (DoD-16), gates (DoD-17), changeset (DoD-18), docs (DoD-19), PR posture (DoD-20); DoD-4/5/11 updated for the new clauses.
- Checked docs/current truth: closeout seven steps, result-contract three classes, harness no-composer, retro collect/report, db metadata, merge transaction, git worktree list, state records, `state.lock.busy`; P11 neighbor list includes the ubiquitous-language doc and `.ai/memory/README.md`.
- Checked GH-233 F-8/F-11/F-9 against `review-iter-1.yaml`; F-8/F-11 resolved in scope, F-9 re-deferred with reason and characterization test.
- Prior readiness records: iteration 1 only; no duplicate findings to suppress.

## Artifact

Written: `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/readiness-review/readiness-iter-2.md`

No spec, test-plan, or plan file was modified. No commit, push, or remote operation was performed.
