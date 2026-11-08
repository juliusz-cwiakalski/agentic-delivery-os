# Readiness Review Iteration 2

Verdict: **NOT_READY**
DoR gate result: **NOT_READY** — 2 blocking findings; delivery must not start until the owning artifact phase is reopened.
Work Item: GH-273 (`fix(queue): production binding sends repository key without root, so queue add is refused and dispatch cannot start`)
Date: 2026-11-08
Pause Required: no (no human decision is required; both findings are change-local artifact edits)
Owning artifact phase to reopen: **delivery_planning**. One consequential `test_planning` edit (TC-BIND-018's revert procedure, see B4) must land in the same iteration but is not a second reopen.

> Read-only gate. This pass modified nothing except this verdict file.

## What This Iteration Re-checked

Artifacts reviewed:

- `chg-GH-273-spec.md` v1.2 (F-1..F-6, 18 ACs, DM-1..DM-3, NFR-1..NFR-8, DEC-1..DEC-8, OQ-1..OQ-3, RSK-1..RSK-8, Appendix A four-cell matrix).
- `chg-GH-273-test-plan.md` v3 (TC-BIND-001..018, §3 coverage, §4 layers, §5.2 scenarios, §6 environments, §7 automation, §8.3 resolved OQ-A..OQ-G, §9 revision log).
- `chg-GH-273-plan.yaml` — revalidated in this pass: `bun packages/cli/bin/delivery-os.ts plan validate GH-273 --json` → `verdict: "valid"`, `readyForDevelopment: true`, exit 0; 5 `delivery` phases, every phase declares `scope.files`.
- `chg-GH-273-pm-notes.yaml` (`autonomous`, D1/D2, iteration-1 blocker + retro notes).
- `readiness-review/readiness-iter-1.md` (B1/B2 + A1..A11).
- Ticket GH-273 via `gh issue view 273 -R juliusz-cwiakalski/agentic-delivery-os`.
- Current truth: `doc/spec/features/feature-scheduling-engine.md` (entry payload `repository`/`repositoryRoot` together; deploy expectation bound to the recorded key via the entry root), `doc/spec/features/feature-cli-entrypoint.md` (production composer wiring).
- Source/docs re-read where a revised claim is load-bearing: `packages/core/src/domain/queue-graph.ts` (`normalizeRepositoryKey`), `packages/core/src/domain/dispatch-identity.ts` (`normalizeRepositoryRemote`, `normalizeDispatchRepositoryKey`, `resolveDispatchIdentity`), `packages/adapters/src/repo/index.ts` (`parseGitHubRemote`, `readRepositoryFacts`), `packages/cli/src/production.ts` (facts/target/queue construction), `packages/cli/src/edge.ts` (`QueueComposition.repositoryBinding`, field-wise forwarding), `tests/fixtures/pilot/{harness,repo}.ts`, `tests/fixtures/queue/cli/harness.ts`, `tests/conformance/pilot/pilot-records.test.ts`, `tests/checks/pilot-privacy.test.ts`, `tests/fixtures/queue/graph/binding/cases.json`, `tests/structure/content-inventory.test.ts`, `package.json` scripts, and every test path named in the plan.

Executable probes run in this pass (not accepted from prose):

```
normalizeRepositoryKey("https://github.com/Owner/Repo.git")     -> "github.com/owner/repo"
normalizeRepositoryRemote("https://github.com/Owner/Repo.git")  -> "github.com/Owner/Repo"
normalizeRepositoryKey("git@github.com:Owner/Repo.git")         -> "github.com/owner/repo"
normalizeRepositoryRemote("git@github.com:Owner/Repo.git")      -> "github.com/Owner/Repo"
normalizeRepositoryKey("https://gitlab.com/owner/repo.git")     -> "gitlab.com/owner/repo"
normalizeRepositoryKey("not-a-url")                             -> undefined
normalizeRepositoryKey("./repo")                                -> undefined          # two segments
normalizeRepositoryKey("../local/repo")                         -> "../local/repo"    # three segments: normalizes
normalizeRepositoryKey("/home/user/repo")                       -> "home/user/repo"   # three segments: normalizes
resolveDispatchIdentity({schedulerKey:"github.com/owner/scheduler",
                         remoteUrl:"https://github.com/owner/remote.git"})
  -> { ok: true, repository: "github.com/owner/scheduler", source: "scheduler" }
```

No previous-iteration finding is repeated below: B1 and B2 are closed (verified), and every A-item is closed except where noted.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: **FAIL** (B4 — the spec-mandated `fixture shape` revert layer has no procedure anywhere and is omitted from the plan's evidence obligations; plan phase 1 also under-declares the gate, B3)
- test_traceability: PASS (18/18 ACs mapped, 18/18 TCs indexed/detailed/automated, 18/18 assigned to a phase)
- cross_artifact_consistency: **FAIL** (B3 plan phase 1 vs spec F-1/Appendix A/DM-3/§8.1; B4 TC-BIND-018 vs plan phase 4 + spec NFR-4)
- decision_capture: PASS
- system_spec_consistency: PASS (scheduling-engine spec already states key+root-together, root-internal, exact-equality deploy matching; no contradiction)
- plan_doc_update_coverage: PASS (phase 5 declares the lifecycle-phase-7 handoff; see A15)
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-1 Remediation Verification (genuinely fixed, not reworded)

- **B1 — closed.** `normalizeRepositoryKey` is now the declared single authority in spec F-3, §8.3 DM-1, §8.4, DEC-3, §12, §23 and Appendix B, with `normalizeRepositoryRemote`'s host-only lowercasing explicitly excluded and both probe values quoted. Test plan TC-BIND-006 steps 3–5 assert `record.repository === normalizeRepositoryKey(form)` and, for mixed-case rows, that `normalizeRepositoryRemote` yields `github.com/Owner/Repo`. Plan phase 1 names the function. Re-probed: the quoted values are exactly right for HTTPS, SSH and scp mixed-case forms.
- **B2 — closed in the spec.** F-1, Appendix A, DM-3 and §8.1 now define presence as the three-way gate (GitHub target resolves AND `normalizeRepositoryKey(origin)` defined AND root defined) and label the four cells by cause; the GitLab remote is correctly placed in `target-unresolved`, and `not-a-url`/`./repo` in `key-unresolved`. TC-BIND-002 precondition (iii) and OQ-A are aligned, and the asymmetry mutation is correctly scoped. **However, the revised gate was not carried into plan phase 1 — see B3.**
- **A1 — closed.** TC-BIND-015's runtime half is now `tests/conformance/pilot/pilot-records.test.ts`, which is in phase-4 `scope.files`, `interactions` and `tests`; §4/§6 distinguish spawning from non-spawning suites and the pilot's pre-existing `execFileSync` cost is named. Verified: the pilot builds a real repo (`tests/fixtures/pilot/repo.ts:92`) and seeds both fields (`harness.ts:570-577`).
- **A2 — closed.** Phase 5 no longer lists `doc/spec/**` in `scope.files`; it declares the lifecycle-phase-7 (`@doc-syncer`) obligation and the "reconcile the plan to what landed" clause is replaced with "correct only a wrong delivery-phase fact".
- **A3 — closed.** `mergeRequestUrl` is qualified as phase 11 `@pr-manager` and "not a deliverable of this phase".
- **A4/A5/A6/A8/A10/A11 — closed.** OQ-1/OQ-2 marked resolved with D1/D2 and the "scope expansion" framing corrected; DEC-5 states the pinned `{ originUrl?: string }` seam shape; plan phase 2 names both `addressing-unresolved` (evidence reason) and `repository-binding-unresolved` (blocking detail) — both tokens re-verified in `queue-readiness.ts:237` and `queue-precedence.ts:344`; the fresh-ledger qualifier is now in F-1, AC-F1-2, AC-F1-3, Appendix A and TC-BIND-002; F-4/§8.1 now say JSON projection carries the key and the human rendering is unchanged; the pinned `["createProductionComposer"]` export is in §7.2, phase 1 and a new escalation trigger.
- **A7 — closed.** `links.implementation_plan: ./chg-GH-273-plan.yaml` and §2 name the delivered plan.
- **A9 — addressed.** The header now states the additive AC-F4-1 two-half model.

## Blocking Findings

### B3 [major] cross_artifact_consistency — `chg-GH-273-plan.yaml` phase 1 `summary` (and phase 5's phase-7 doc note) vs `chg-GH-273-spec.md` §5.1 F-1, Appendix A, DM-3, §8.1 and `chg-GH-273-test-plan.md` TC-BIND-002

Gap: the spec now defines binding presence as a **three-way** gate, but the only phase that implements the derivation names **two** conditions.

- Spec F-1 / Appendix A / DM-3 / §8.1: present iff (a) the existing GitHub target resolution (`parseGitHubRemote` via `repositoryTargetOf`) succeeds, (b) `normalizeRepositoryKey(origin)` is defined, and (c) the resolved checkout root is defined.
- Plan phase 1: "The derivation emits either both repository fields or no repositoryBinding at all, **symmetrically for an unresolved key and an unresolved root** (DEC-4); no third state exists." Neither (a) nor `parseGitHubRemote`/`repositoryTargetOf`/`target` appears anywhere in phase 1 (grep: the only plan text mentioning the target gate is phase 2's test expectation).
- Current code gates the construction on `target === undefined` (`production.ts:263, 357`). A coder executing phase 1 literally can produce a two-conjunct derivation (key && root) and emit a binding for a checkout whose origin is `https://gitlab.com/owner/repo.git` — a parseable non-GitHub remote where both key and root resolve. That contradicts spec F-1 condition (a), the NG-5 boundary, `§12` assumption 2 and TC-BIND-002's `target-unresolved` cell (which would then record both fields instead of neither).

Severity is [major], not [critical]: phase 2's TC-BIND-002 would catch the deviation inside the same change, but the implementing artifact currently permits a delivery that the spec forbids, and the contradiction sits in the highest-value facet (spec ↔ plan gate definition). This is new in this revision: the target gate did not exist in spec v1.1, so phase 1 could not omit it before.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: in phase 1's summary, state that the derivation keeps the existing GitHub target gate and is present only when **target AND `normalizeRepositoryKey(origin)` AND resolved root** all hold, that a parseable non-GitHub remote yields no binding (the NG-5 boundary, not a key failure), and that the `target-unresolved` matrix cell must stay absent. Add the same clause to phase 5's phase-7 note for `feature-cli-entrypoint.md`.

### B4 [major] plan_coverage / cross_artifact_consistency — `chg-GH-273-plan.yaml` header "Evidence obligations" vs `chg-GH-273-spec.md` NFR-4, and `chg-GH-273-test-plan.md` TC-BIND-018 steps 2–4 / expected outcome vs plan phase 4

Gap: NFR-4 requires "1 in-place revert check for each behaviour-changing layer (composition add, root-unresolved branch, **fixture shape**)", but no artifact provides an executable fixture-shape revert, and TC-BIND-018 attributes that failure to the wrong revert.

- TC-BIND-018 step 2: "Revert **only** the producer derivation in `packages/cli/src/production.ts` (**leave the new tests and fixtures in place**)." Step 3 re-runs `tests/structure/queue-binding-fixture-shape.test.ts`. Step 4 and the expected outcome then require "the AST half of TC-BIND-015" to fail.
- That suite only parses `tests/fixtures/**/*.ts` (TC-BIND-015 steps 1–3). With the corrected pilot fixture left in place, it is **green** under a producer-only revert. Plan phase 4 says so itself: "the pre-fix pilot binding is one field, so it fails against the pre-fix **fixture**". The red must come from reverting the fixture line (`tests/fixtures/pilot/harness.ts:436`), which no step does.
- The plan header's evidence obligations repeat the omission: they list only the composition-add revert, the root-unresolved revert, the key-unresolved asymmetry mutation, the two domain predicate mutations and the second-`readRepositoryFacts` mutation — no fixture-shape revert. So NFR-4's third revert layer is unowned.

Consequence: a reviewer executing the prescribed procedure sees a green suite where the artifact predicts red, and either records a wrong red set (falsifying AC-F6-3/NFR-4 evidence) or improvises an unrecorded mutation. AC-F6-3's evidence class ("revert-detecting") is not actually demonstrated as written.

Suggested remediation target phase: **delivery_planning** (plan header + phase-4 evidence obligation), with the required consequential **test_planning** edit: split TC-BIND-018 into (i) producer revert → composition add, `root-unresolved`, TC-BIND-014 red, `present`/`target-unresolved`/`key-unresolved` and the fixture-shape suite green; and (ii) a separate fixture revert (restore `repositoryBinding: { repository: PILOT_REPOSITORY }`) → `tests/structure/queue-binding-fixture-shape.test.ts` red with the named fixture file, then restored. Do not treat TC-BIND-014 and the fixture-shape AST as producer-revert evidence.

## Advisory Findings (non-blocking; fix in the same artifact iteration where cheap)

### A12 [major] test_traceability — `chg-GH-273-test-plan.md` TC-BIND-015 step 2 (and plan phase 4, same wording)

Gap: the prescribed rule — "require an object literal with **both** keys, or an identifier reference to a same-file declaration that is such a literal" — rejects the existing, deliberately unchanged queue CLI harness. `tests/fixtures/queue/cli/harness.ts:131` is `repositoryBinding: options.overrides?.repositoryBinding ?? { repository: REPO_A, repositoryRoot: "/work/repo-alpha" }`; the initializer is a `??` expression, not an object literal and not an identifier. The same step's expected outcome ("`tests/fixtures/queue/cli/harness.ts` default pair remains a pair") therefore contradicts the rule that is supposed to establish it. A literal implementation reds on a fixture the phase is not scoped to edit.

Suggested remediation target phase: **test_planning**.
Suggested fix: allow `Left ?? PairLiteral` (assert the non-override side is a both-keys literal and, if desired, that the override is a *complete* pair or empty), or reference the default pair through a same-file constant; keep "zero fixtures compose a one-sided binding" as the invariant.

### A13 [minor] spec_completeness — `chg-GH-273-spec.md` §5.1 F-1, §6 Flow 2, Appendix A (key-unresolved row), AC-F1-2

Gap: the spec still says key-unresolved covers "a local path". Probed: `./repo` is `undefined` (two segments) but `../local/repo` → `../local/repo` and `/home/user/repo` → `home/user/repo`. A deep local path normalizes, so it is not key-unresolved; in a real composition it is also target-unresolved, so the observable outcome is unchanged and no implementation can be misled — the drift is in the example, not the contract. The test plan already gets this right ("a local-path variant the normalizer rejects such as `./repo` … a deeper path such as `../local/repo` would be misread as `host/owner/name` and must not be used here"), and the plan names only "`normalizeRepositoryKey(origin)` is undefined". Fixtures are therefore safe; only the spec prose is loose.

Suggested remediation target phase: **specification**.
Suggested fix: replace "a local path" with "a two-segment local path such as `./repo`" in F-1, Flow 2, Appendix A and AC-F1-2, and add one sentence that the key guard is redundant behind the target gate for parseable remotes (so `key-unresolved` is never observable independently of `target-unresolved`).

### A14 [nit] cross_artifact_consistency — `chg-GH-273-test-plan.md` TC-BIND-018 step 8 / expected outcome

Gap: the key-unresolved asymmetry mutation emits `{ repositoryRoot }`, which the queue edge forwards one-sided and the domain then refuses with `input.value.rejected` — so the cell reds at the add-outcome assertion, not with "a message naming a root-only binding (`repositoryRoot` present, `repository` absent)". The red set (exactly one cell) is still valid evidence; only the expected message is unattainable.

Suggested remediation target phase: **test_planning**.
Suggested fix: state that the key-unresolved cell fails at the add outcome (non-zero exit / `input.value.rejected`) as proof that the asymmetric branch fired, or assert the emitted binding before invoking the domain.

### A15 [nit] plan_doc_update_coverage — `chg-GH-273-plan.yaml` phase 5

Gap: the phase-7 handoff is correct in ownership and content, but the two system-spec pages are named by role ("the scheduling-engine page", "the CLI-entrypoint page") and not by path, so a phase-7 executor must re-derive the targets. Iteration-1 A2 allowed dropping them from `scope.files`; keeping the paths in the summary is free.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: name `doc/spec/features/feature-scheduling-engine.md` and `doc/spec/features/feature-cli-entrypoint.md` in the phase-5 summary while leaving them out of `scope.files`.

## Adversarial Checks That Passed (recorded so the findings are not read as blanket doubt)

- **Every remediated claim was re-probed, not accepted.** The normalizer discrimination (B1), the four-cell causes (B2), the dispatch resolver contract used by TC-BIND-007 step 4 (`{ schedulerKey, remoteUrl }` → `source: "scheduler"`), and the readiness/blocking token split (A6) all match delivered behaviour.
- **All AC-F3-1 remote forms are reachable through the declared target gate.** `parseGitHubRemote` accepts HTTPS, `ssh://` and scp (`packages/adapters/src/repo/index.ts:136-170`), so gating on it does not make AC-F3-1 unsatisfiable — the gate and the key taxonomy are jointly implementable.
- **The `root-unresolved` cell is implementable and correctly placed.** `readRepositoryFacts` returns `{ head: { detached: true } }` (no `root`, no `originUrl`) when no git root is found (`repo/index.ts:256-261`), so DEC-5's injected-origin/real-root split makes the cell reachable without a real checkout, and the OS-temp placement plus the `findGitRoot === undefined` pre-assert avoids this repo's own `.git`.
- **B2's fix did not silently break the "key guard" story.** The test plan explicitly declares the key guard redundant behind the target gate and prescribes an asymmetric emission branch (not conjunct deletion) for the mutation — this is the only mutation shape that can red exactly one cell, and it works for every cell (checked case by case).
- **The independence and green-after-every-phase claims still hold.** Phase 1 touches only `packages/cli/src/production.ts`; no existing suite asserts `repositoryBinding` or calls `queue add` through the production composer (grep: `repositoryBinding` appears in tests only in `queue-cli.test.ts:472`, `queue/cli/harness.ts:131`, `pilot/harness.ts:436`). The DEC-5 change adds a facts read when facts are injected, but `readRepositoryFacts` is a pure filesystem read that returns a partial record rather than throwing, so the phase-1 gate set stays green-capable.
- **Phase 4 scope is complete.** The corrected pilot binding, the new structural suite and the pilot conformance host are all declared with `scope.files`/`interactions`/`tests`; no additional fixture file is needed, `pilot-records.test.ts` exists, `Pilot.store` is exposed, `readQueueEntries` is importable, and `tests/checks/pilot-privacy.test.ts` scans for secret shapes only (a synthetic `/pilot/...` root is not a privacy hit).
- **Plan mechanics.** All 18 ACs and all 18 TCs appear (TC-BIND-014 via the `TC-BIND-011..014` range in the header and by full name in phase 3); every named test file, helper, script and gate command exists (`tests/structure/subpaths.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `tests/golden/**`, `tests/fixtures/queue/graph/binding/cases.json` incl. the mixed-case row, `pnpm check:boundaries`); `plan validate` is valid/ready.
- **AC text vs TC assertions were compared one by one.** No AC asserts something its TC does not, and no TC invents an AC. The only AC/TC wording gaps are A12–A14.
- **Override not used and not available.** This change adds producer behaviour and touches a composition contract seam; no triviality override record exists or would be legitimate.

## Counts

- ACs: 18 in the spec; 18 mapped; 18 present in the plan; 0 unmapped, 0 invented.
- TCs: 18 indexed, 18 detailed, 18 in §7; 18 assigned to a delivery phase.
- Phases: 5 (`kind: delivery`), each with `scope.files` and `weightClass`; `tier: full`.
- Blocking: 2 (B3, B4) — B1/B2 from iteration 1 are resolved, not persistent.
- Advisory: 4 (A12 major; A13 minor; A14, A15 nit).
- Pause flags: none.

## Next Action

Reopen **`delivery_planning`** for GH-273: carry the spec's three-condition gate into phase 1 (B3) and add the missing fixture-shape revert to the evidence obligations (B4). Route the two consequential test-plan edits to `@test-plan-writer` in the same iteration — TC-BIND-018's producer-revert/fixture-revert split (B4) and TC-BIND-015's AST rule for the `??` default pair (A12). A13/A14/A15 are cheap and should be folded in while those artifacts are open. Re-run this gate. Iteration 1 → 2 closed both original blocking findings with executed evidence; if B3/B4 persist across two further iterations, escalate to the human owner rather than looping.
