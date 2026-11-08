# Readiness Review Iteration 3

Verdict: **NOT_READY**
DoR gate result: **NOT_READY** — 1 blocking finding; delivery must not start until the owning artifact phase is corrected.
Work Item: GH-273 (`fix(queue): production binding sends repository key without root, so queue add is refused and dispatch cannot start`)
Date: 2026-11-08
Pause Required: no (no human decision is required; the blocker is a change-local plan edit)
Owning artifact phase to reopen: **delivery_planning**.

> Read-only gate. This pass modified nothing except this verdict file.

## What This Iteration Re-checked

Artifacts reviewed:

- `chg-GH-273-spec.md` v1.3 (F-1..F-6, 18 ACs, DM-1..DM-3, NFR-1..NFR-8, DEC-1..DEC-8, OQ-1..OQ-3, RSK-1..RSK-8, §17 evidence classes, §18, Appendix A).
- `chg-GH-273-test-plan.md` v4 (TC-BIND-001..018, §3 coverage, §4 layers, §5.2 scenarios, §6 environments, §7 automation, §8.3 resolved OQ-A..OQ-G, §9 revision log, §10 execution log).
- `chg-GH-273-plan.yaml` — revalidated in this pass: `bun packages/cli/bin/delivery-os.ts plan validate GH-273 --json` → `verdict: "valid"`, `readyForDevelopment: true`, exit 0; 5 `delivery` phases, every phase declares `scope.files`.
- `chg-GH-273-pm-notes.yaml` (autonomous, D1/D2, iteration-1/2 blocker + retro notes).
- `readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`.
- Ticket GH-273 via `gh issue view 273 -R juliusz-cwiakalski/agentic-delivery-os` (symptom, repro, expected, acceptance).
- Current truth: `doc/spec/features/feature-scheduling-engine.md` (key+root together, key form, root internal), `doc/spec/features/feature-cli-entrypoint.md`.
- Source/docs re-read where a revised claim is load-bearing: `packages/core/src/domain/queue-graph.ts` (`normalizeRepositoryKey`), `packages/core/src/domain/dispatch-identity.ts`, `packages/adapters/src/repo/index.ts` (`parseGitHubRemote`, `readRepositoryFacts`, worktree/commondir), `packages/cli/src/production.ts` (`repositoryTargetOf`, facts/target/queue construction), `packages/cli/src/edge.ts` (field-wise binding forwarding), `packages/core/src/app/queue.ts` (write/read predicates, `readQueueEntries`), `packages/core/src/domain/{queue-readiness,queue-precedence}.ts`, `packages/cli/src/commands/queue.ts`, `tests/fixtures/pilot/{harness,repo,stubs}.ts`, `tests/fixtures/queue/cli/harness.ts`, `tests/conformance/pilot/pilot-records.test.ts`, `tests/checks/pilot-privacy.test.ts`, `tests/checks/fixture-privacy.test.ts`, `tests/boundaries/fixture-coverage.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/dispatch-composition.test.ts`, `.changeset/config.json`, and every test path named in the plan.

Executable probes run in this pass (not accepted from prose):

```
normalizeRepositoryKey("https://github.com/Owner/Repo.git")     -> "github.com/owner/repo"
normalizeRepositoryRemote("https://github.com/Owner/Repo.git")  -> "github.com/Owner/Repo"
normalizeRepositoryKey("git@github.com:Owner/Repo.git")         -> "github.com/owner/repo"
normalizeRepositoryKey("https://gitlab.com/owner/repo.git")     -> "gitlab.com/owner/repo"
normalizeRepositoryKey("not-a-url")                             -> undefined
normalizeRepositoryKey("./repo")                                -> undefined   # two segments
normalizeRepositoryKey("../local/repo")                         -> "../local/repo"
normalizeRepositoryKey("/home/user/repo")                       -> "home/user/repo"
normalizeRepositoryKey("")                                      -> undefined
parseGitHubRemote("https://gitlab.com/owner/repo.git")          -> { ok:false, reason:"remote-unsupported" }
parseGitHubRemote("not-a-url")                                  -> { ok:false, reason:"addressing-unresolved" }
parseGitHubRemote("./repo")                                     -> { ok:false, reason:"addressing-unresolved" }
parseGitHubRemote("../local/repo")                              -> { ok:false, reason:"addressing-unresolved" }
resolveDispatchIdentity({schedulerKey:"github.com/owner/scheduler",
                         remoteUrl:"https://github.com/owner/remote.git"})
  -> { ok:true, repository:"github.com/owner/scheduler", source:"scheduler" }
```

Observation that matters for P3: for every key-unresolved fixture (`not-a-url`, `./repo`, absent origin) the GitHub target parse **also** fails, and every form `parseGitHubRemote` accepts yields a defined `normalizeRepositoryKey` (HTTPS and scp both produce three segments). The key guard really is redundant behind the target gate, as the spec states.

No previous-iteration blocking finding is repeated below: B1/B2 (iteration 1) and B3/B4 (iteration 2) are closed. One remediation introduced a new contradiction (B5).

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: **FAIL** (B5 — the plan's phase-2 exit evidence declares the `present` matrix cell green under the producer revert; that cell is the pre-fix refusal)
- test_traceability: PASS (18/18 ACs mapped; 18/18 TCs indexed, detailed and automated; 18/18 assigned to a phase; see A16 for a wording defect inside TC-BIND-015)
- cross_artifact_consistency: **FAIL** (B5 — plan header P1 + phase 2 summary vs test-plan TC-BIND-018 P1 / §3.3 NFR-4 / TC-BIND-002 notes)
- decision_capture: PASS
- system_spec_consistency: PASS (scheduling-engine spec already states key+root-together, root internal, exact-equality deploy matching)
- plan_doc_update_coverage: PASS (phase 5 names both spec pages and keeps them out of `scope.files`)
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-2 Remediation Verification

- **B3 — genuinely fixed.** Plan phase 1 now states all three conditions and names the existing resolution: "(a) the composition's existing GitHub target resolution from the origin succeeds (`parseGitHubRemote` via `repositoryTargetOf` ... must neither be removed nor duplicated); (b) `normalizeRepositoryKey(origin)` is defined; and (c) the resolved checkout root is defined", plus the GitLab `target-unresolved` boundary and the `present` absence requirement. Phase 5's phase-7 note repeats the same three conditions for `feature-cli-entrypoint.md`. Verified against source: `repositoryTargetOf` at `production.ts:167` and the target at `:263` are exactly that resolution, and `parseGitHubRemote` rejects GitLab while `normalizeRepositoryKey` accepts it (probes above), so the gate is substantive and implementable.
- **B4 — genuinely fixed.** Four distinct procedures exist in both artifacts with the right artifacts named: P1 producer revert (`packages/cli/src/production.ts`), P2 fixture revert (`tests/fixtures/pilot/harness.ts`), P3 key-unresolved asymmetry mutation (production derivation), P4 predicate mutations (`packages/core/src/app/queue.ts`, write side then read side). Spec NFR-4, AC-F6-1 and AC-F6-3, test-plan TC-BIND-018 (§3.3, §5.2, §7, §10), plan header and phases 2/3/4 all agree that a producer revert leaves the fixture-shape suite green and that the fixture revert is AC-F6-3's evidence. The P3 red signal is now the domain refusal, and the code confirms it: a root-only binding is forwarded field-wise by `edge.ts:4228-4235` and refused by `queue.ts:601-609` with `input.value.rejected` and `repository key and recorded root must be present together`. **However, the same rewrite introduced B5.**
- **A12 — partially fixed; see A16.** The rule now admits `(a)` a pair literal, `(b)` a same-file reference and `(c)` a `??`/conditional form, and the one-field negative assertion is retained. The fixture forms are real: `tests/fixtures/queue/cli/harness.ts:131` is `options.overrides?.repositoryBinding ?? { repository: REPO_A, repositoryRoot: "/work/repo-alpha" }`, and the pilot's pre-fix form is `tests/fixtures/pilot/harness.ts:436`. But the normative clauses in TC-BIND-015 step 2 and revision-log v4 name the **non-nullish** operand as the pair, while the pair is the **fallback** operand; see A16.
- **A13 — genuinely fixed.** Key-unresolved examples are now `not-a-url` and two-segment `./repo` in F-1, F-3, Flow 2, AC-F1-2 and Appendix A; multi-segment local paths are explicitly target-unresolved, matching the probes (`../local/repo` and `/home/user/repo` normalize; `parseGitHubRemote` rejects them).
- **A14 — genuinely fixed.** AC-F6-1, §18, Appendix A, TC-BIND-018 step 12 and the plan now describe the asymmetry mutation's red as the domain `input.value.rejected` refusal on an add expected to succeed unbound, with "no system-emitted root-only diagnostic". The exact summary string exists once in `queue.ts`.
- **A15 — genuinely fixed.** Plan phase 5 names `doc/spec/features/feature-scheduling-engine.md` and `doc/spec/features/feature-cli-entrypoint.md` in prose and keeps both out of `scope.files`/`interactions`.

## Blocking Finding

### B5 [major] cross_artifact_consistency / plan_coverage — `chg-GH-273-plan.yaml` header "Evidence obligations" P1 (GREEN line, ~L92) and phase 2 `summary` (L176) vs `chg-GH-273-test-plan.md` TC-BIND-018 step 4 and expected outcome (L800, L815), §3.3 NFR-4 (L111) and TC-BIND-002 notes (L235)

Gap: the plan's phase-2 exit evidence obligation declares the `present` matrix cell **green** under the P1 producer revert, while it must be **red** — it is the refusal the whole change exists to fix.

- Plan header P1: "GREEN: cells `present`, `target-unresolved`, `key-unresolved`; the fixture-shape suite; the domain negatives."
- Plan phase 2: "...this suite's composition add path and its root-unresolved matrix cell must be shown red ..., while the `present`, `target-unresolved`, and `key-unresolved` cells stay green — the last two already hold pre-fix."
- Test plan TC-BIND-018 step 4 and expected outcome: "**Red**: ... the `present` and `root-unresolved` cells of TC-BIND-002 ... **Green**: the `target-unresolved` and `key-unresolved` cells..."
- Test plan TC-BIND-002 notes: "Pre-fix failure: `present` is refused (exit 1, `input.value.rejected`)..."
- Code: the pre-fix construction (`production.ts:357`) emits `{ repository: `${target.owner}/${target.name}` }` whenever the GitHub target resolves — i.e. exactly the `present` cell — the edge forwards the key alone, and `queue.ts:601-609` refuses it. The cell cannot stay green.

The plan's own red list includes "the composition add path", which is the same origin/checkout combination as the `present` cell, so the sentence is internally contradictory as well as cross-artifact wrong.

Consequence: a reviewer executing P1 sees the `present` cell red where the plan predicts green. They must either record a green that did not happen (falsifying AC-F6-1's revert evidence) or declare the run invalid and improvise. This is the same evidence-class defect iteration 2 raised as B4, reintroduced in the artifact that iteration was meant to fix.

Suggested remediation target phase: **delivery_planning**.

Suggested fix: in the header P1 block and in phase 2's summary, make the sets identical to TC-BIND-018: **RED** = TC-BIND-001/010 and the other composition-add scenarios, the `present` **and** `root-unresolved` cells of TC-BIND-002, and TC-BIND-014; **GREEN** = the `target-unresolved` and `key-unresolved` cells, the whole fixture-shape suite, and the domain negatives. Remove `present` from every P1 green list; keep it green only for P3.

## Advisory Findings (non-blocking; fix in the same artifact iteration where cheap)

### A16 [major] test_traceability — `chg-GH-273-test-plan.md` TC-BIND-015 step 2 form (c) (and §9 revision-log v4); plan phase 4 is already correct

Gap: form (c) is defined as "a `??` (or conditional) expression whose **non-nullish** / true-branch operand is form (a) or form (b)". In `left ?? right`, the non-nullish operand is `left`; the pair in the actual fixture is the **right/fallback** operand (`options.overrides?.repositoryBinding ?? { repository: REPO_A, repositoryRoot: "/work/repo-alpha" }`). The same sentence then says "where the **fallback** operand is the pair", and the expected outcome says the unchanged harness must pass through form (c). Implemented literally from the normative clause, the rule rejects the untouched queue CLI harness — the exact A12 failure mode. Plan phase 4's wording ("`override ?? pairLiteral` whose **default side** is such a literal") is correct.

Suggested remediation target phase: **test_planning** (one-word correction: "nullish/fallback (or true-branch) operand"). Not blocking because the plan's phase-4 instruction and the same step's expected outcome both disambiguate to the fallback side.

### A17 [minor] cross_artifact_consistency — `chg-GH-273-test-plan.md` TC-BIND-018 step 10 and plan header P3 / phase 3 (P3 ordering)

Gap: because every key-unresolved fixture also fails the GitHub target gate (probed), the prescribed "emit `{ repositoryRoot }` when the key is undefined while leaving the GitHub target gate intact" is only observable if that asymmetric branch is sequenced **before** the target-gate check. Read as gate-first, the mutation produces no root-only binding and the `key-unresolved` cell stays green, contradicting the expected "exactly that cell reds". The procedure does converge if the branch is inserted ahead of the gate (the gate then remains intact for every key-resolving remote, so `target-unresolved` stays green), but the artifacts do not say so.

Suggested remediation target phase: **test_planning** (and mirror the clause in the plan P3 note): state that the mutation branch is inserted before the target check and that the gate condition itself is unchanged.

### A18 [minor] cross_artifact_consistency — `chg-GH-273-plan.yaml` header L10

Gap: the plan still cites `./chg-GH-273-test-plan.md` "(v3; ...)" while the delivered test plan is v4 (its own revision log and this review). No execution impact.

Suggested remediation target phase: **delivery_planning** (fold into the B5 edit).

### A19 [minor] cross_artifact_consistency — `chg-GH-273-spec.md` §18 "Order within the change" vs plan phase order

Gap: the spec says "negative and shape coverage first (so the pre-fix failure is recorded), then the producer derivation", while the plan runs the producer first (phase 1) and the coverage next (phases 2-4), which is required for every phase to be independently green. Pre-existing (present in v1.2, not introduced by v1.3); no AC depends on the order, and the intent — recording the pre-fix failure — is satisfied by the review-time P1/P2 reverts.

Suggested remediation target phase: **specification** (editorial: say "the coverage lands with the producer in one PR; the plan executes the producer first so each phase is green, and the pre-fix failure is recorded by the in-review revert").

## Adversarial Checks That Passed (recorded so the findings are not read as blanket doubt)

- **The four-artifact chain is complete.** Ticket acceptance → AC-F1-1/AC-F4-2 (add succeeds, entry observable), AC-F1-2..4 (no one-sided binding producible), AC-F6-1..4 (composition + domain regression coverage) map to TC-BIND-001..018 with no unmapped AC and no invented TC. Script check: 18 spec ACs, 18 TCs, all 18 ACs in §3.1 and in the plan, all 18 TCs in the plan.
- **Phase scopes are sufficient and executable.** Phase 1: `packages/cli/src/production.ts` is the only producer site (`repositoryTargetOf`/target at 167/263, construction at 352-357, facts at 253-254); no other file is needed. Phases 2-4: every new file is declared; all pre-existing paths the plan names exist (`tests/behaviour/production-composition.test.ts`, `entrypoint-composition.test.ts`, `queue-cli.test.ts`, `queue-edge-wiring.test.ts`, `tests/structure/dispatch-composition.test.ts`, `content-inventory.test.ts`, `subpaths.test.ts`, `queue-scheduling-contract.test.ts`, `error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/golden`, `tests/fixtures/queue/graph/binding/cases.json`, `tests/checks/pilot-privacy.test.ts`).
- **Phase 1 stays green.** No existing test runs `queue add` through `createProductionComposer`: the only production-composition suites are `tests/structure/dispatch-composition.test.ts` (seeds entries via `declareQueueEntry`) and the entrypoint composition tests; every `queue add` test uses `createQueueEdgeHarness`, which supplies a pair. `repositoryBinding` appears in tests only at `queue-cli.test.ts:472` (empty override), `queue/cli/harness.ts:131` and `pilot/harness.ts:436`.
- **Phase 4 scope is complete and honest.** The pilot binding at `pilot/harness.ts:436` is the only one-field fixture binding; the seeds at `:573-576` already carry `repository: PILOT_REPOSITORY` and `repositoryRoot: /pilot/${PILOT_REPOSITORY}`, so the plan's correction is internally consistent and inert (the pilot never calls `queue add`; it only runs `queue plan`). `Pilot.store` is exposed, `readQueueEntries(store)` exists (`packages/core/src/app/queue.ts:439`), and `tests/checks/pilot-privacy.test.ts` scans only secret shapes, so a synthetic `/pilot/...` root is not a privacy hit. No golden regeneration is warranted.
- **AC-F4-1's source allowlist matches reality.** `grep -rl repositoryRoot packages/*/src` today returns exactly `packages/cli/src/edge.ts`, `packages/core/src/app/queue.ts`, `packages/core/src/contracts/queue.ts`; phase 1 adds `packages/cli/src/production.ts`. No other source file (and no `packages/*/dist`, which is git-ignored) is in scope.
- **P3's red signal is code-verified.** `edge.ts:4228-4235` forwards each field independently; `queue.ts:601-609` refuses the resulting one-sided request with `input.value.rejected` and the exact summary; `readRecords`/`isEntryRecord` (`queue.ts:239, 417-421`) fail a one-sided stored record closed as `torn` / `state.store.torn`. The unbound entry projects `repo-free` as `unknown` with evidence reason `addressing-unresolved` (`queue-readiness.ts:237`) and state `not-ready` with blocking detail `repository-binding-unresolved` (`queue-precedence.ts:344`).
- **P4's surfaces are distinguishable.** Deleting the `desiredEntry` mutual-presence branch reds the add refusal (TC-BIND-011); deleting `isEntryRecord`'s predicate reds the stored-record read (TC-BIND-012). The control (both fields) succeeds in both cases.
- **P1/P2's green claims, apart from the `present` error, are sound.** Under P1 the fixture-shape suite parses only fixtures and stays green; under P2 every production-side test, including TC-BIND-015's runtime half, is untouched (the runtime half asserts seeded records, not the composition binding). AC-F6-3's evidence is correctly the fixture revert.
- **AC-F2-2 is reachable.** `readRepositoryFacts` reads `commonDir/config` for a linked worktree, so the fabricated `.git`-file/`commondir` shape yields the worktree root and the shared origin; a link-worktree test is implementable without a real `git worktree add`.
- **No forbidden scope.** Phase 1 adds no export (`tests/structure/content-inventory.test.ts:1642` pins `["createProductionComposer"]`; `normalizeRepositoryKey` is already exported from `@delivery-os/core`). Phase 5 edits no `doc/spec/**`, assigns PR creation to lifecycle phase 11 and qualifies `mergeRequestUrl` as not a deliverable. The changeset targets the existing fixed group (`.changeset/config.json`), so a patch entry is valid.
- **Plan mechanics.** `plan validate` is valid and `readyForDevelopment: true`; all 5 phases are `kind: delivery` with `scope.files` and `weightClass`; every plan test command exists (`pnpm typecheck`, `pnpm check:boundaries`, `pnpm check`, `bun test ...`, `bun run scripts/checks/error-table-sync.ts`).
- **Override not used and not available.** This change alters producer behaviour and a composition seam; no triviality override record exists or would be legitimate.

## Counts

- ACs: 18 in the spec; 18 mapped; 18 present in the plan; 0 unmapped, 0 invented.
- TCs: 18 indexed, 18 detailed, 18 in §7; 18 assigned to a delivery phase.
- Phases: 5 (`kind: delivery`), each with `scope.files` and `weightClass`; `tier: full`.
- Blocking: 1 (B5) — B1/B2/B3/B4 are resolved, not persistent.
- Advisory: 4 (A16 major; A17, A18, A19 minor).
- Pause flags: none.

## Next Action

Reopen **`delivery_planning`** for GH-273 and correct B5 in the two plan locations: the header P1 green list and phase 2's summary must both say RED = the `present` and `root-unresolved` cells of TC-BIND-002 (plus the composition-add scenarios and TC-BIND-014), GREEN = `target-unresolved`, `key-unresolved`, the fixture-shape suite and the domain negatives. Fold A18 (test-plan version) into the same edit. A16 is a cheap one-word `test_planning` correction (fallback operand) and A17 a one-clause clarification; neither blocks on its own, but both should land before phase 4/3 evidence is executed. A19 is an editorial spec alignment, pre-existing and non-blocking.

B3/B4 are genuinely closed; the remaining defect is a single evidence-set line, not the code contract. If iteration 4 finds a further *new* contradiction in this same evidence table, escalate to the human owner rather than looping a fourth artifact cycle.
