# Readiness Review Iteration 4

Verdict: **READY**
DoR gate result: **READY** — 0 blocking findings; delivery may start at `delivery` phase 1.
Work Item: GH-273 (`fix(queue): production binding sends repository key without root, so queue add is refused and dispatch cannot start`)
Date: 2026-11-08
Pause Required: no
Owning artifact phase to reopen: none (two advisory corrections are optional; they do not block delivery).

> Read-only gate. This pass modified nothing except this verdict file. No git operation was performed.

## What This Iteration Re-checked

Artifacts reviewed:

- `chg-GH-273-spec.md` v1.4 (F-1..F-6, 18 ACs, DM-1..DM-3, NFR-1..NFR-8, DEC-1..DEC-8, OQ-1..OQ-3, RSK-1..RSK-8, §17 evidence classes, §18, Appendix A, document history v1.4).
- `chg-GH-273-test-plan.md` v5 (TC-BIND-001..018, §3.1/§3.2/§3.3 coverage, §4 layers, §5.2 scenarios, §6 environments, §7 automation, §8.3 resolved OQ-A..OQ-G, §9 revision log v5, §10 execution log).
- `chg-GH-273-plan.yaml` — revalidated in this pass: `bun packages/cli/bin/delivery-os.ts plan validate GH-273 --json` → `verdict: "valid"`, `readyForDevelopment: true`, exit 0; 5 `delivery` phases, every phase declares `scope.files`.
- `chg-GH-273-pm-notes.yaml` (autonomous; D1/D2 ratifications; D3 authorizes this fourth iteration; iteration-1/2/3 blocker + retro notes).
- `readiness-review/readiness-iter-1.md`, `-2.md`, `-3.md`.
- Ticket GH-273 context as carried in previous iterations (symptom, repro, expected, acceptance).
- Current truth re-verified in source: `packages/cli/src/production.ts` (`repositoryTargetOf` L167, facts L253-254, target L263, queue construction L352-357, config-seam `findGitRoot` L958), `packages/adapters/src/repo/index.ts` (`RepositoryFacts` L94-98, `readRepositoryFacts` L256+), `packages/cli/src/edge.ts` (field-wise binding forwarding L4228-4233), `tests/fixtures/pilot/harness.ts` (binding L436, seeds L573-576), `tests/fixtures/queue/cli/harness.ts` (fallback pair L131), `tests/structure/dispatch-composition.test.ts` (injected facts / fabricated checkouts L76-88, L194-197, L370-378, L424-427, L690-698).

Executable probes re-run in this pass (not accepted from prose):

```
normalizeRepositoryKey("https://github.com/Owner/Repo.git")    -> "github.com/owner/repo"
normalizeRepositoryKey("git@github.com:Owner/Repo.git")        -> "github.com/owner/repo"
normalizeRepositoryKey("https://gitlab.com/owner/repo.git")    -> "gitlab.com/owner/repo"
normalizeRepositoryKey("not-a-url")                            -> undefined
normalizeRepositoryKey("./repo")                               -> undefined
normalizeRepositoryKey("../local/repo")                        -> "../local/repo"
normalizeRepositoryKey("/home/user/repo")                      -> "home/user/repo"
normalizeRepositoryRemote("https://github.com/Owner/Repo.git") -> "github.com/Owner/Repo"
parseGitHubRemote(github forms)                                -> ok:true
parseGitHubRemote(gitlab / not-a-url / ./repo / ../local/repo / /home/user/repo) -> ok:false
```

The key guard is redundant behind the GitHub target gate for every parseable remote, and `key === undefined` implies `target unresolved` under the production ordering — exactly as the artifacts now state.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS (B5 closed; P1 sets now identical in plan header, plan phase 2, plan phase 5, test plan TC-BIND-018/§3.3/§10)
- test_traceability: PASS (18/18 ACs mapped in §3.1, 18/18 TCs indexed, detailed, automated/assigned; A16 wording defect fixed)
- cross_artifact_consistency: PASS (A16, A17, A18, A19 all genuinely fixed; two stale-citation advisories remain, neither changes a red/green set or a procedure)
- decision_capture: PASS (D1/D2 in pm-notes ratify DEC-3/DEC-8; DEC-1..DEC-8 in-spec; no system decision required)
- system_spec_consistency: PASS (`doc/spec/features/feature-scheduling-engine.md` already states key+root-together, normalized key, root internal; cli-entrypoint reconciliation is declared for lifecycle phase 7)
- plan_doc_update_coverage: PASS (phase 5 names both spec pages and keeps them out of `scope.files`/`interactions`)
- plan_code_area_coverage: PASS (phase 1 producer site; phases 2-4 enumerate every new/changed test and fixture path; phase 5 release artifacts)
- dod_defined: PASS (spec §17 evidence classes + AC set + plan phase exit obligations are jointly testable)

## Iteration-3 Remediation Verification

- **B5 — genuinely fixed.** Four independent locations now agree with the code and with each other:
  - Plan header P1: RED = composition add path (TC-BIND-001, TC-BIND-010, plus TC-BIND-003..009/017), the `present` **and** `root-unresolved` cells of TC-BIND-002, and TC-BIND-014; GREEN = `target-unresolved`, `key-unresolved`, the whole TC-BIND-015 fixture-shape suite, the domain negatives (TC-BIND-011/012/013/016); explicit sentence "`present` is never a P1 green cell; it is green only under P3."
  - Plan phase 2 summary: "the `present` and `root-unresolved` cells ... must be shown red ... while the `target-unresolved` and `key-unresolved` cells stay green, the whole fixture-shape suite stays green, and the domain negatives stay green."
  - Plan phase 5 summary: producer-revert red set = composition add plus the `present` and `root-unresolved` cells, fixture-shape green, domain negatives green.
  - Test plan TC-BIND-018 steps 4/expected outcome, §3.3 NFR-4 (L111) and §10 P1 row: identical sets.
  Code verification: pre-fix construction, key-only whenever the target resolves, reds exactly `present` (refused at `queue.ts` invariant) and `root-unresolved` (also key-only, because the revert ignores the root); `target-unresolved` and `key-unresolved` fixtures never pass the target gate, so both stay absent/green. The set is now internally coherent as well as cross-artifact consistent.
- **A16 — genuinely fixed.** TC-BIND-015 step 2 form (c) now defines the pair as the **right-hand/fallback** operand of `??` (true-branch of a conditional) and explicitly allows an arbitrary caller-supplied left operand (`options.overrides?.repositoryBinding`), matching `tests/fixtures/queue/cli/harness.ts:131`. Expected outcome, notes, §3.1 AC-F6-3 row and revision log v5 all repeat the fallback phrasing.
- **A17 — genuinely fixed.** Spec AC-F6-1, §18 verification bullet and Appendix A; test plan TC-BIND-018 steps 10-13, expected outcome, notes, §3.1 AC-F6-1 row, §3.3 NFR-4, §8.3 OQ-A and §10 P3 row; plan header P3 and phase 3 — all state that the test-only asymmetric branch is evaluated **before** the unchanged target gate, that this is required because key-undefined implies target-unresolved under production ordering, that production keeps target-gate-first ordering, and that the mutation is restored. The resulting red set (exactly `key-unresolved`) is provable: the inserted branch fires only when the key is undefined, so `present`, `target-unresolved` and `root-unresolved` remain green.
- **A18 — fixed in substance.** Plan header L10 now cites test plan v5. TC-BIND-018 step ranges were corrected in the header (P3 = steps 10-13, P4 = steps 14-15), matching the delivered test plan's step numbering.
- **A19 — genuinely fixed.** Spec §18 now orders the change producer-first ("the producer derivation, then the regression coverage layer by layer, then the fixture correction, then documentation reconciliation"), keeps the one-PR atomicity guarantee, and moves pre-fix-failure capture to review time (in-place revert/mutation), matching plan phase order 1→2→3→4→5.

## Blocking Findings

None.

No previous-iteration blocking finding persists: B1/B2 (iteration 1), B3/B4 (iteration 2) and B5 (iteration 3) are all closed and none is repeated below.

## Advisory Findings (non-blocking; fix opportunistically, do not reopen delivery)

### A20 [minor] cross_artifact_consistency — `chg-GH-273-plan.yaml` L5 and L85; `chg-GH-273-test-plan.md` L49, L824, L911, L923

Gap: the spec is now v1.4, but the plan header still cites "Spec: ./chg-GH-273-spec.md (v1.3 ...)" and "spec v1.3 §9 NFR-4", and the test plan still cites "(v1.3)" in §2 and "aligned with spec v1.3 NFR-4" / "re-checked against spec v1.3" in §8.3. This is citation drift only (the same class as iteration-3 A18): every cited clause exists unchanged in v1.4, and no red/green set, procedure, or AC depends on the version string.

Suggested remediation target phase: **delivery_planning** (plan header L5/L85) and **test_planning** (test-plan version citations). Safe to fold into phase 5's plan/test-plan touch-up if not done earlier.

### A21 [minor] cross_artifact_consistency — `chg-GH-273-plan.yaml` phase 3 summary (YAML L210, parenthetical inside the AC-F6-1 key-unresolved obligation)

Gap: phase 3 cites "TC-BIND-018 steps 6-8, P3", but the delivered test plan's P3 procedure is steps 10-13 (steps 6-8 are the P1 restore and the P2 fixture revert). The plan header (L108) and the test plan agree on 10-13; only this one parenthetical is stale — a residue of the A18 correction, which updated the header but not this summary. Not blocking: the same sentence, after the colon, specifies the whole P3 procedure verbatim (mutated branch ahead of the unchanged gate, root-only emission, domain refusal, exactly one red cell, restore), so a reviewer cannot act on steps 6-8 without contradicting the instructions in the adjacent clause, and the correct range is present in the plan header and the test plan.

Suggested remediation target phase: **delivery_planning** (one-token fix: "steps 10-13").

## Adversarial Checks That Passed

- **No residual P1/P3 contradiction.** The `present` cell is red in every P1 list and green only in P3; the `key-unresolved` cell is green in P1 and red in P3; `target-unresolved` is green in P1 and P3; `root-unresolved` is red in P1 and green in P3. Every composition-add TC (001, 003-010, 017) depends on an add through the production composition, so all genuinely red under P1 (TC-BIND-007's resolver half also reds because its precondition add is refused). I found no artifact asserting a green where the code would refuse.
- **Phase 1 is executable in one file and stays green.** `packages/cli/src/production.ts` is the only producer: `repositoryTargetOf` (L167) and the target (L263) are the gate the plan must preserve, `repositoryFacts` is resolved at L253-254, the queue construction is at L352-357, and `repositoryFacts.originUrl` is consumed at L486/L530 — so an origin-overlay keeps every existing consumer byte-identical. `RepositoryFacts` (adapter L94-98) already carries `root`, and `readRepositoryFacts` (L256+) returns it in the same call, so the three-condition derivation needs no second resolution and no adapter change.
- **DEC-5's semantics change cannot red an existing suite.** Every `createProductionComposer` call site in tests uses a fabricated checkout whose `.git/config` origin equals the injected origin (or is absent when the injection is empty), so overlaying the injected origin over a real `readRepositoryFacts(cwd)` yields the same `originUrl` values those tests already observe; `head` is not consumed by `production.ts`; and no existing test runs `queue add` through the production composition (`repositoryBinding` appears in fixtures only at `queue/cli/harness.ts:131` and `pilot/harness.ts:436`, plus the empty override at `queue-cli.test.ts:472`). Phase 1's "suite stays green" claim holds.
- **The root-unresolved cell is reachable and honest.** Injecting an origin while `cwd` has no git root yields target+key resolved and root undefined; the plan/test plan keep that fixture under the OS temp root precisely so `findGitRoot` cannot ascend into this repository, and `§6` requires asserting `findGitRoot(cwd) === undefined` first.
- **The root path is genuinely executed.** Composition tests inject only `originUrl`, so the recorded root comes from real on-disk `.git` metadata; §6 forbids any harness that accepts a synthetic root, which is the RSK-4 false-green guard.
- **Phase 3's structural claims match the source.** `production.ts` has exactly one `readRepositoryFacts` call today; the one `findGitRoot` call is the pre-existing config-seam call at L958 (and `resolveCheckoutGitDirectories` at L259 is a different callee) — exactly as phase 3/TC-BIND-016 describe it, so "count === 1" and "do not count the config seam" are implementable as written.
- **Phase 4 is complete and inert.** The pilot binding at `pilot/harness.ts:436` is the only one-field fixture binding, and its seeds at L573-576 already carry `PILOT_REPOSITORY` with `/pilot/${PILOT_REPOSITORY}`; the queue edge consumes the binding only in the add mutation (`edge.ts:4228-4233`), which the pilot never runs, so no golden churn and no privacy hit. The shape rule's form (c) is the only way the untouched queue CLI harness can pass, and A16's fix now states it on the correct side.
- **Phase 5 respects the boundary.** `scope.files` contains only the changeset plus the two change artifacts; both `doc/spec/**` pages appear as prose handoff targets for lifecycle phase 7; `mergeRequestUrl` explicitly assigns PR creation to lifecycle phase 11 and is not a deliverable.
- **No scope creep.** Phase 1 adds no export (`tests/structure/content-inventory.test.ts` pins `["createProductionComposer"]`; `normalizeRepositoryKey` is already exported from core); no phase touches the queue domain, error table, envelopes, grammar or exits; the `new-export-from-production-composition-module` escalation trigger is present in `tier.escalationTriggers`.
- **AC/TC accounting is exact.** 18 ACs in the spec (§17), 18 rows in test plan §3.1, 18 TCs indexed/detailed/automated-or-assigned, 18 ACs assigned an owning phase in the plan header and phase summaries (AC-F4-1's two additive halves are declared as such); 0 unmapped, 0 invented.
- **Evidence classes are honest.** Permanent-suite claims map to committed suites; the revert-detecting claims (add, root-unresolved, shape) name the artifact that actually carries the behaviour; the unchanged-behaviour claims (domain negatives, error table) are mutation- or review-verified rather than claimed revert-detecting; AC-F5-3 and AC-F3-2 are correctly review/unit-verified.
- **Plan mechanics.** `plan validate` valid and `readyForDevelopment: true`; 5 `kind: delivery` phases, all with `scope.files` and `weightClass`; every cited gate command exists (`pnpm typecheck`, `pnpm check`, `pnpm check:boundaries`, `pnpm exec biome check`, `bun test ...`, `bun run scripts/checks/error-table-sync.ts`, `plan validate`, `git diff --check`).
- **Override not used and not available.** This change alters producer behaviour and a test-facing composition seam; no triviality override record exists or would be legitimate.

## Counts

- ACs: 18 in the spec; 18 mapped; 18 present in the plan; 0 unmapped, 0 invented.
- TCs: 18 indexed, 18 detailed, 18 in §7; 18 assigned to a phase.
- Phases: 5 (`kind: delivery`); `tier: full`; `plan validate` valid / `readyForDevelopment: true`.
- Blocking: 0. Advisory: 2 (A20, A21; both minor citation drift, no execution impact).
- Pause flags: none. Human escalation: not required (iteration-3 escalation clause expected a *new* contradiction in the evidence table; the P1/P3 evidence sets are now consistent, and A21 is a stale step citation inside one sentence, not a contradictory red/green claim).

## Next Action

Proceed to **`delivery`** phase 1 (`packages/cli/src/production.ts`): implement the single total three-condition derivation with the origin overlay and root from the real facts resolution, adding no export. Optionally fold A20 (spec v1.4 citations) and A21 (P3 = steps 10-13) into the plan/test-plan edits already scheduled for phase 5; neither needs a gate re-run.
