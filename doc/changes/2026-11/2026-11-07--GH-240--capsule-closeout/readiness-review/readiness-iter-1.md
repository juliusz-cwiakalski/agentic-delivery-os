# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-240
Date: 2026-11-07
Pause Required: no

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS (with one non-blocking finding)
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS (with one non-blocking finding)
- plan_code_area_coverage: PASS (with one non-blocking finding)
- dod_defined: PASS

Facet score: **5/10 PASS**. Delivery is blocked. All findings have artifact-remediation targets; no human-input pause is required.

## Blocking Findings

1. [critical] plan_coverage — `chg-GH-240-plan.yaml`#D-13 / phase P1#coverage and phase P2#coverage; `chg-GH-240-test-plan.md`#TC-CAP-004 step 4 and TC-CAP-010 step 5
   Gap: TC-CAP-004 is mapped complete in P1, but its step 4 asserts “closeout apply surfaces `closeout.capsule-invalid` with a busy detail”; the closeout capsule step is P3 and P1’s scope excludes `packages/cli/src/commands/closeout.ts`. TC-CAP-010 is mapped complete in P2, but its step 5 runs closeout and asserts a `capsule-event-gap` residue and a valid close; the closeout capsule step is P3 and P2’s scope excludes `closeout.ts`. P1/P2 cannot be green at their commits as written.
   Reopened phase: delivery_planning
   Required fix: Add completing-phase markers (P1 structure half → P3 complete; P2 producer/self-containment half → P3 complete) for TC-CAP-004 and TC-CAP-010, and restrict the P1/P2 testGate to the runtime/domain halves; alternatively move the closeout assertions to P3. Do not re-shape the TCs’ oracles.

2. [critical] plan_coverage — `chg-GH-240-plan.yaml`#D-13 / phase P6#coverage; `chg-GH-240-test-plan.md`#TC-CAP-034 steps 5 and 9
   Gap: TC-CAP-034 is mapped complete in P6, but step 5 asserts the `closeout.step.<id>.failed` family row, which plan P10 task 10.2 adds, and step 9 asserts the worktree-refusal fixture, which plan P7 implements. The P6 attention-exit test cannot pass at P6 with the current staging.
   Reopened phase: delivery_planning
   Required fix: Split TC-CAP-034 (P6 attention/data-exit half → P10 family-row half; worktree-refusal assertion → P7, or move it to TC-CAP-037), record the completing phases in P6’s coverage, and adjust the P6 testGate so only the P6-completable assertions run there.

3. [major] cross_artifact_consistency / test_traceability — `chg-GH-240-test-plan.md`#TC-CAP-014 step 3; `chg-GH-240-plan.yaml`#P3
   Gap: TC-CAP-014 is mapped complete in P3, but step 3 asserts “the twelve step outcomes” and plan mode’s `mode: "plan"` payload; the twelve-step plan is only final in P10 (P3 has the seven delivered steps plus `capsule`). P3 cannot be green with this assertion.
   Reopened phase: test_planning
   Required fix: At P3 assert “the planned step outcomes” (the step count that exists at P3), and leave the exact twelve-step array assertion to TC-CAP-050 at P10. This is a wording/phase-correction, not an oracle change.

4. [major] spec_completeness / cross_artifact_consistency — `chg-GH-240-spec.md`#F-5, DM-6, OQ-1, RSK-5 and Appendix C; `chg-GH-240-test-plan.md`#§4.5 and TC-CAP-028 step 3; `chg-GH-240-plan.yaml`#task 1.1 and D-4
   Gap: The spec calls the merged-diff *action vocabulary* pinned and closed (“may not be rebound”), but Appendix C enumerates only the four marker kinds; the action vocabulary is never listed. TC-CAP-028 step 3 only asserts it is “closed and non-empty”; the plan’s contract-data task omits it and D-4 says only “pinned attribution/action rules”. A work-item-named hit with an undeclared action cannot be deterministically classified.
   Reopened phase: specification
   Required fix: Enumerate the action vocabulary in Appendix C (or define it explicitly as the marker-kind set), correct F-5’s “its kind is in the closed action vocabulary” wording to “its action …”, and add the exact set plus an out-of-vocabulary negative case to TC-CAP-028/TC-CAP-024/TC-CAP-025.

5. [major] ac_quality / cross_artifact_consistency — `chg-GH-240-spec.md`#AC-F5-1 vs F-5; `chg-GH-240-test-plan.md`#§4.5 classification table
   Gap: AC-F5-1 says markers that name this work item “are recorded as resolved owed-flip evidence”; F-5 and the test-plan classification table make a work-item-named hit with an out-of-vocabulary action an `ambiguous-flip-hit`. The AC is broader than the pinned rule, so the acceptance criterion is not unambiguous or mechanically testable as written.
   Reopened phase: specification
   Required fix: Qualify AC-F5-1 to “markers that name this work item **and carry a declared action** are resolved; an out-of-vocabulary action is `ambiguous-flip-hit`”, matching F-5 and the §4.5 table.

6. [major] cross_artifact_consistency — `chg-GH-240-spec.md`#F-3 vs EVT-2/DM-3; `chg-GH-240-test-plan.md`#TC-CAP-016 step 3, TC-CAP-023 step 2, TC-CAP-020 step 2
   Gap: F-3 defines the applied `capsule.candidates[]` entry as `{id, decision, home?, reason?}`; EVT-2/DM-3 say the promotion decision/output also carries class, mode (`home-write`/`handoff`) and the `supersedes` link; TC-CAP-016 asserts the entry key set is exactly `{id, decision}` plus `home`/`reason` but then says a handoff “carries its home/mode”; TC-CAP-023’s event key set omits the supersession link asserted by TC-CAP-020. These shapes cannot all be asserted together.
   Reopened phase: specification
   Required fix: Pin two explicit shapes — the `capsule.promotion` event payload and the applied `capsule.candidates[]` projection — including exactly where `class`, `mode`, `home`, `reason`, and `supersedes` appear; align TC-CAP-016/020/023 to those key sets.

7. [major] test_traceability / cross_artifact_consistency — `chg-GH-240-spec.md`#F-4, AC-F4-2/AC-F4-3; `chg-GH-240-test-plan.md`#§4.4 and TC-CAP-022 step 3; `chg-GH-240-plan.yaml`#task 4.3
   Gap: The test plan invents a “classified conflict” outcome for a pre-existing differing record file with the same id (“never an overwrite”). The spec defines no such outcome, no rejection reason and no error identity for it; the plan’s task says only “atomic” and “never push/rewrite history”. This is an unrepresented output shape outside the closed rejection/error vocabularies.
   Reopened phase: specification
   Required fix: Pin the differing-file outcome explicitly (for example `closeout.capsule-invalid` with a conflict detail, or a declared step-failure identity), or remove the differing-file case from TC-CAP-022. The test plan must not assert an outcome the spec cannot represent.

8. [major] spec_completeness / test_traceability — `chg-GH-240-spec.md`#F-4, DM-2 and Appendix C; `chg-GH-240-test-plan.md`#TC-CAP-017 steps 1 and 7; `chg-GH-240-plan.yaml`#tasks 1.1 and 4.1
   Gap: `status` is a required candidate field but no allowed value set is declared; `evidence` must parse as one of the “declared link shapes” but no shape set is declared. TC-CAP-017 asserts only class/scope/basis/trust and says “declared link shapes” without values. A candidate with an unknown status or a free-text evidence sentence cannot be deterministically classified.
   Reopened phase: specification
   Required fix: Pin the status vocabulary (the existing `.ai/memory/README.md` set `candidate | authoritative | superseded`) and the evidence link shapes as declared contract data, and assert both in TC-CAP-017.

9. [major] test_traceability / security — `chg-GH-240-plan.yaml`#task 4.3 (“path-confined under the injected memory root (no traversal)”); `chg-GH-240-test-plan.md`#§4.4, TC-CAP-021/TC-CAP-022 and NFR-9 coverage; `chg-GH-240-spec.md`#§21 promotion write boundary
   Gap: The plan claims path-confined promotion writes, but no TC asserts a traversal, symlink, or `supersedes` path escape. TC-CAP-021 covers routing/handoffs and TC-CAP-022 covers idempotency/index budget; neither proves that no write leaves the injected memory root. This is a security control the user’s DoR brief explicitly requires for promotion writes.
   Reopened phase: test_planning
   Required fix: Add a traversal/symlink case to TC-CAP-021 or TC-CAP-022 (candidate id or `supersedes` containing `..`, symlinked memory root) asserting zero writes outside the injected root and a classified refusal, and map it to AC-F4-2/NFR-9.

## Non-blocking Findings

10. [minor] plan_doc_update_coverage — `chg-GH-240-spec.md`#§18 names `doc/overview/ubiquitous-language.md`; `chg-GH-240-plan.yaml`#P11 scope/task 11.5 lists architecture, glossary and index but not the ubiquitous-language file.
    Gap: The neighbor list is incomplete for the terms this change introduces (capsule, judgment residue, attention outcome, pre-contract capsule, worktree cleanup, retro coverage, compaction checkpoint, two streams).
    Reopened phase: delivery_planning
    Required fix: Add `doc/overview/ubiquitous-language.md` to P11 scope/task 11.5, or record an explicit “no UL change” rationale.

11. [minor] plan_code_area_coverage — `chg-GH-240-test-plan.md`#§4.1 rule 5 references `bun run tests/fixtures/capsule/golden/regenerate.ts --write`; no `chg-GH-240-plan.yaml` phase scope or task authors/registers that file.
    Gap: The binding test-harness contract names a regeneration command that the plan does not place or own; the closeout goldens otherwise live under `tests/fixtures/closeout/golden`.
    Reopened phase: delivery_planning
    Required fix: Add the regeneration script to the P10/P11 scope and a task (or correct the path to the existing golden-regeneration mechanism).

12. [minor] test_traceability — `chg-GH-240-test-plan.md`#TC-CAP-050 precondition says “the delivered eleven-value step list fixture (`EXPECTED_STEP_IDS`)”; the delivered `CLOSEOUT_STEP_IDS` has seven values and the new set is twelve.
    Gap: A stale/incorrect fixture description; it does not change the oracle but can mislead the implementer.
    Reopened phase: test_planning
    Required fix: Change “eleven-value” to “delivered seven-value” (or “delivered step list”) in TC-CAP-050.

13. [minor] test_traceability — `chg-GH-240-test-plan.md`#§7 TC-CAP-005 execution command runs `tests/checks/capsule-bounds.test.ts`, but that file is created in P5 (TC-CAP-026), not P1.
    Gap: The P1 execution row names a later-phase test file; the plan’s P1 testGate correctly omits it, so the plan and test plan disagree on the P1 command.
    Reopened phase: test_planning
    Required fix: Move the `tests/checks/capsule-bounds.test.ts` part of the command to TC-CAP-026/P5, or create the file in P1 and keep the command.

14. [minor] test_traceability — `chg-GH-240-spec.md`#F-4 pins the `lesson-YYYY-NNN-<slug>.md`/`tacit-YYYY-NNN-<slug>.md` naming and the monotonic id-allocation rule (unique across lessons/tacit, never reused); `chg-GH-240-test-plan.md`#TC-CAP-021 step 1 asserts only “delivered record frontmatter” and TC-CAP-020 step 7 asserts only “id is not reused”.
    Gap: The naming and cross-family monotonic allocation rule has no direct assertion.
    Reopened phase: test_planning
    Required fix: Add a naming/allocation assertion to TC-CAP-021 (new record id follows the declared pattern and is unique across lessons/tacit).

15. [minor] decision_capture — `chg-GH-240-pm-notes.yaml`#notes “Routed decisions” proposes three candidate records (capsule-stream vs state-stream ownership; human-thread policy; `attention` projection class) but they are not authored; the spec §18 records them as “recommended, not authored here”.
    Gap: Precedent-setting decisions live only in the change DEC log at the gate. The PM notes consciously defer record authoring until after DoR; this is recorded, not silent.
    Reopened phase: (none for the gate; delivery_planning handoff)
    Required fix: Before PR creation, `@decision-advisor` should author at least the two precedent-setting records (capsule-vs-state stream, human-thread policy) and update the `attention` record if the runtime semantics change.

16. [nit] cross_artifact_consistency — `chg-GH-240-spec.md`#Appendix A “capsule lock failure identity” maps a busy lock to `closeout.capsule-invalid`, whose DEC-15 row is `user, non-retryable, not_landed`; the condition is transient and the obvious remedy is a re-run.
    Gap: The error metadata says non-retryable for a transient busy condition; TC-CAP-004 step 4 asserts only the code and busy detail, not the retryable flag.
    Reopened phase: test_planning
    Required fix: Pin the busy-lock retryable/detail semantics in the error row or test plan (or explicitly record why the busy detail overrides the non-retryable metadata).

## Reopened Phases

- **specification** — findings 4, 5, 6, 7, 8 (action vocabulary and F-5/AC-F5-1; applied capsule candidate/event shapes; differing-file outcome; status/evidence vocabularies).
- **test_planning** — findings 3, 8, 9, 12, 13, 14, 16 (TC-CAP-014 step 3; TC-CAP-017 status/evidence; traversal case; TC-CAP-050 wording; TC-CAP-005 command; naming/allocation assertion; busy-lock metadata).
- **delivery_planning** — findings 1, 2, 10, 11 (TC-CAP-004/010 split map; TC-CAP-034 split map; ubiquitous-language doc; golden regeneration script).

The five declared plan splits (TC-CAP-006, 011, 012, 016, 052) are legitimate column/staging moves and do not reshape any oracle. The plan’s 61-TC map is set-exact and duplicate-free. The blocking issue is that the split map is incomplete: four additional TCs (004, 010, 014, 034) reference surfaces delivered later and are still marked “complete” in the early phase.

## Verification Evidence (adversarial checks performed)

- **Ticket ↔ artifacts.** Read GH-240 body and the 2026-11-07 PM scope-decision comment. All five ticket AC clauses trace to spec ACs: AC 1 → AC-F1-1/AC-F3-1/AC-F4-2; AC 2 → AC-F4-1; AC 3 → AC-F5-1/AC-F6-1/AC-F7-1/AC-F8-1/AC-F11-1; AC 4 → AC-F10-1/AC-F10-2; AC 5 → AC-F12-2 plus the idempotency ACs. Ticket tasks (capsule events/candidates, memory step, self-containment, merged-diff sweep, comment-thread check, tracker hygiene, branch/worktree cleanup, retro coverage, residue, telemetry two-stream pin, session compaction) are all represented. Nothing in the ticket is dropped; the merge of the “one stream with the telemetry concept” sentence with the pinned two-stream clarification is explicit.
- **Coverage counts.** 26/26 spec ACs and 11/11 NFRs appear in test plan §3.1/§3.3 with named TCs. The 61 TC ids are set-equal across §5.1 index, §5.2 details, §7 automation mapping, and §10 execution log. Plan coverage maps 61/61 exactly once; no orphan/duplicate complete marker.
- **Closed vocabularies.** Step ids (12), event kinds (11), writers (4), candidate classes (8), capture-bar bases (5), rejection reasons (8), residue kinds (8), marker kinds (4), new error identities (2) and the `attention` class agree across spec §5.1/§17/Appendix C, test plan §4.2/§4.4/§4.8/§4.10, and plan tasks 1.1/10.1/10.2. The **action vocabulary** is the one exception: it is declared closed but not enumerated (finding 4).
- **Output-shape representability.** The result contract is `data` XOR `error`; the `attention` class is the additive data-plus-exit-1 outcome; the F-11 failure rule (error envelope, no structured `residue[]`, failed-step evidence plus plan-mode residue) is consistently stated in spec F-11/AC-F7-2/AC-F11-1 and test plan §4.8/TC-CAP-005/034/037. The one shape gap is the applied `capsule.candidates[]` vs `capsule.promotion` event fields (finding 6).
- **Idempotency/convergence.** Every new step has a mechanical re-run proof: capsule eventKey dedup and terminal close (TC-CAP-002/003/006/007/008/009/023), lock/concurrency (TC-CAP-004), caps (TC-CAP-005), promotion/home/index (TC-CAP-022/023), diff sweep (TC-CAP-027), thread resolution (TC-CAP-029/030), worktree (TC-CAP-038), retro coverage (TC-CAP-040), compaction checkpoint (TC-CAP-043), telemetry capture (TC-CAP-046), full restart (TC-CAP-055). No idempotency claim is unproven.
- **Security.** Worktree removal has the full predicate, fixed argv, no shell, no force, local-only, temp-repo matrix and a planted-force negative control (TC-CAP-036/037/038/039, §4.7). The diff sweep is one bounded local added-line read with zero source/remote mutation and no history walk (TC-CAP-024/025/026/027/028, §4.5). Promotion writes assert no push/commit/remote (TC-CAP-021 step 7) but lack a path-traversal case (finding 9). Telemetry is read-only, plan-silent, log-only, and non-gating (TC-CAP-045/046/047/048, §4.9). No remote write or force flag is introduced.
- **Plan green-at-every-commit.** The five declared splits are legitimate. Four further TCs have undeclared later-surface dependencies: TC-CAP-004 (P1→P3 closeout busy), TC-CAP-010 (P2→P3 closeout cross-check), TC-CAP-014 (P3→P10 twelve steps), TC-CAP-034 (P6→P10 family row; P6→P7 worktree fixture). Findings 1–3.
- **Backward compatibility.** `delivery.closeout.v1` is held; `residue`/`capsule`/step `detail` are additive; the delivered seven ids keep identity; consumers resolve by `stepId` and tolerate an injected unknown id; the synthetic legacy consumer plus MUT-CAP-42 prove non-vacuity; the three goldens are the only intended golden updates (TC-CAP-050/051/052, spec §8.5). PASS.
- **GH-233 review re-assessment.** Read `code-review/review-iter-1.yaml` F-8/F-9/F-11. F-8 (Claude full-file read before the byte cap) is genuinely resolved in scope by plan P9 task 9.3 and TC-CAP-047 (stat/bounded read, bytes-not-code-units, no full-transcript read, truncated warning). F-11 (store-wide orphan/invalid-identity disclosure) is genuinely resolved by plan P9 task 9.4 and TC-CAP-048 (delivery-scoped failed count, out-of-port orphans as a store-level warning, bounded scan). F-9 (host-runner SIGTERM/stderr/UTF-16 semantics) is explicitly re-deferred with the production-consumer reason and a characterization test (plan P9 task 9.5, TC-CAP-049). No issue.
- **DoD binding.** §17.1 DoD-1..20 bind every AC (DoD-14), every NFR (DoD-15), the §4.1 metrics (DoD-16), the aggregate/error-sync/doc-distribution/license/vulnerability gates (DoD-17), the single lockstep minor changeset (DoD-18), the neighbor docs (DoD-19) and the `main-tools` PR posture (DoD-20). PASS.
- **Current truth.** Verified against `doc/spec/features/feature-closeout.md` (seven-step dry-run transaction, 100-thread cap, no authorship distinction, four closeout error identities), `feature-result-contract.md` (success/user-validation/platform-provider, data XOR error, four closeout rows), `feature-harness-adapters.md` (no production composer yet), `feature-retro-pipeline.md` (`retro.run` mode collect/report), `feature-session-database-admin.md` (`db` metadata surface), `feature-state-layer.md`, `feature-merge-verify-deploy.md`, `packages/adapters/src/git/index.ts` (worktree list only), and `packages/core/src/contracts/closeout.ts` (`CLOSEOUT_STEP_IDS` seven ids). The spec’s current-state snapshot is accurate; the planned doc updates are the right neighbors. PASS.
- **Plan code areas.** Verified the named delivered files exist (`packages/adapters/src/file/plan-artifact.ts`, `packages/adapters/src/git/index.ts`, `packages/cli/src/projection.ts`, `packages/cli/src/commands/{phase,commit,verify-gates,closeout}.ts`, `packages/core/src/contracts/{closeout,result,error-table,ports}.ts`, the closeout test suites and fixtures). The plan adds files under the existing `./file`, `./git`, and `./harness` subpaths and claims no new subpath or dependency-cruiser allowance; this is consistent with `.dependency-cruiser.cjs`. The only missing artifact placement is the golden regeneration script (finding 11).
- **Prior readiness records.** None under `readiness-review/`; this is iteration 1. No duplicate findings to suppress.

## Artifact

Written: `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/readiness-review/readiness-iter-1.md`

No source, spec, test-plan or plan file was modified. No commit, push, or remote operation was performed.
