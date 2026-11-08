# Code Review — GH-273 (Iteration 1)

- **Work item:** GH-273 — fix the production queue repository binding so key and root always travel together
- **Mode:** local
- **Branch:** `fix/GH-273/queue-repository-binding`
- **Base:** `origin/main-tools` (merge-base `1d00b48f`)
- **Reviewed HEAD:** `c177cfd1` (working tree clean)
- **Diff under review:** `origin/main-tools...HEAD` — 25 commits, 19 files, +4407 / −10
- **Artifacts:** spec v1.5, test-plan v5 (TC-BIND-001…018, §10 populated), plan (5 phases), pm-notes (delivery evidence), readiness iterations 1–4
- **Reviewer:** reviewer (iteration 1)
- **Status:** **PASS** — 0 blocking findings, 2 low + 5 info advisory findings

## 1. Summary

The producer fix is exactly what the ticket and the spec describe. `packages/cli/src/production.ts` now resolves repository facts once, lets an injected origin replace only the remote (the checkout root always comes from the working directory), and derives the queue repository binding as a single total three-condition outcome — present iff the GitHub target resolves **and** `normalizeRepositoryKey(originUrl)` is defined **and** the resolved checkout root is defined; otherwise the `repositoryBinding` key is absent entirely. The recorded key is the lowercase `host/owner/name` contention key and the recorded root is the declaring checkout root, so the pair is mutually consistent and consumable by the deploy-expectation and dispatch-identity consumers that already assume that form.

The domain, grammar, envelopes, exit projections, error table, and rendering are untouched: the only file under `packages/` in the diff is `production.ts`. The regression coverage is honest, not fixture-supplied: the new composition harness injects only `originUrl` and exposes no root seam, every add/list/plan/claim/dispatch scenario reads the real ledger of a real fabricated temp checkout, and the fixture-shape and domain-negative layers carry their own artifact-specific evidence (fixture revert / predicate mutation) as the spec's NFR-4 requires.

I independently re-ran the focused suites and the affected gates: the four new suites **29/29 pass**, pilot conformance **4/4**, the affected composition/queue/dispatch suites **70/70**, the error-table/queue-contract suites **193/193**, privacy-release + doc-conformance + content-inventory **24/24**, fixture/pilot privacy scans **7/7**, `pnpm typecheck` clean, biome clean on all eight changed source/test files, `plan validate GH-273` = `valid` / `readyForDevelopment: true`, and `git diff --check` clean. `verify change GH-273` reports only the expected `verify.ledger.incomplete` for the lifecycle phases that have not run yet (`review_fix`, `quality_gates`, `dod_check`, `pr_creation`).

No blocking defect was found. Seven advisory items are recorded below; none changes the delivered behaviour.

## 2. Spec compliance (AC-F1-1 … AC-F6-4)

All 18 ACs are mapped to a delivered test or a recorded review-verified procedure, and each holds.

| AC | Verdict | Evidence inspected |
|----|---------|--------------------|
| AC-F1-1 | **Pass** | `TC-BIND-001` / `TC-BIND-002` (present cell): add exits 0 / `added`, replay `noop`, ledger record carries `github.com/owner/repo` + the temp checkout path; envelope does not project `repositoryRoot`. |
| AC-F1-2 | **Pass** | `TC-BIND-002` `target-unresolved` (`https://gitlab.com/owner/repo.git` normalizes but fails the GitHub gate) and `key-unresolved` (`not-a-url`, `./repo`): add succeeds unbound, neither field recorded, one-sided count 0, readiness `repo-free` unknown with `addressing-unresolved`. |
| AC-F1-3 | **Pass** | `TC-BIND-002` `root-unresolved`: origin injected, cwd outside any work tree (pre-asserted), add succeeds with neither field; no key-only record. |
| AC-F1-4 | **Pass** | `TC-BIND-014`: exactly one `repositoryBinding` property site and one derivation variable in `packages/cli/src`, exactly one `{ repository, repositoryRoot }` literal, no one-sided literal, one shared queue/lanes composition. |
| AC-F2-1 | **Pass** | `TC-BIND-003`: nested cwd records the checkout root, not the nested path. |
| AC-F2-2 | **Pass** | `TC-BIND-004`: linked worktree records its own root (not main); top-level and nested invocations record the identical absolute root. |
| AC-F2-3 | **Pass** | `TC-BIND-005`: root is absolute; zero harness spawns, zero transport calls, zero git-child calls; `TC-BIND-016` carries the structural single-resolution half. |
| AC-F3-1 | **Pass** | `TC-BIND-006` over six remote forms: key equals `normalizeRepositoryKey(form)` = `github.com/owner/repo`, equals `normalizeRepositoryKey` of the recorded root's own `.git/config` remote; mixed-case rows prove `normalizeRepositoryRemote` yields `github.com/Owner/Repo` and is not the authority. |
| AC-F3-2 | **Pass** | `TC-BIND-007`: direct `resolveDispatchIdentity` with the recorded scheduler key against a disagreeing remote returns `source: "scheduler"`; end-to-end dispatch passes the observation gate and the persisted marker carries the scheduler key. |
| AC-F4-1 | **Pass** (one half review-verified) | `TC-BIND-008`: `queue list --json` projects the key; the root string appears in no queue/plan/lanes/claim/release output, no `status`/`brief` output (from a cwd outside the checkout), and not in the derived graph document. The "human rendering carries no repository key" half is review-verified (rendering unchanged) — see F-3. |
| AC-F4-2 | **Pass** | `TC-BIND-009` / `TC-BIND-010`: `queue plan` observes the ref; dispatch never returns `queue.entry.unobserved` and appends exactly one attempt carrying the key; dispatch envelope carries no root. |
| AC-F5-1 | **Pass** | `TC-BIND-011`: key-only and root-only requests refused with `input.value.rejected` and the exact `repository key and recorded root must be present together` summary, zero appends, both-fields control accepted. |
| AC-F5-2 | **Pass** | `TC-BIND-012`: key-only and root-only raw records read as `state.store.torn`, raw ledger unchanged, `queue list --json` exits 2 with no data. |
| AC-F5-3 | **Pass** (review-verified) | Diff inspection: no file under `packages/core` changed, no error-table/registry change, both invariant predicates (`desiredEntry`, `isEntryRecord`) untouched; pinned error-set/error-table-sync/queue-contract suites re-run 193/193 green. |
| AC-F6-1 | **Pass** (revert/mutation evidence) | I inspected the pre-fix base (`origin/main-tools:packages/cli/src/production.ts`): it emits `{ repository: \`${target.owner}/${target.name}\` }` whenever the target resolves, so the composition add tests, the present and root-unresolved cells, and the single-pair-literal assertion red under P1 while the target/key-unresolved cells, the shape suite, and the domain negatives stay green — matching the recorded P1/P3 sets. Execution of the in-place revert/mutation is forbidden to this reviewer (read-only source), so this is verified by base inspection plus the recorded procedure, not by re-running the mutation. |
| AC-F6-2 | **Pass** (mutation-verified) | `TC-BIND-011`/`TC-BIND-012` exist and target the write-side and read-side predicates respectively; pm-notes/test-plan record each predicate mutation reddening only its own layer (2/1 and 1/2 counts, consistent with the 3-test invariant suite). |
| AC-F6-3 | **Pass** (fixture-revert evidence) | `TC-BIND-015`: every fixture `repositoryBinding` is a literal pair, a same-file pair reference, or a `??`/conditional whose fallback is a pair (the untouched queue-CLI harness still accepted); pilot binding key `PILOT_REPOSITORY` equals every seed; pilot `pilot-records.test.ts` asserts the seeded pair at runtime. |
| AC-F6-4 | **Pass** | `TC-BIND-010`: encodes the pre-fix failure triple (`input.value.rejected`, 0 entries, `queue.entry.unobserved`) and asserts each observed outcome differs element-wise, on top of real add→list→dispatch. |

**Plan compliance.** All five delivery phases have a pm-notes `notes:` entry naming the phase, the commit (`fa8ecd03`, `7dc5d2f6`, `08153dea`, `939f2492`, `83adb968`), and the observed test results; the lifecycle `delivery` and `system_spec_update` phases are marked complete in the registry (`phase list` verified). Every changed path lies in a declared phase `scope.files` or is the phase-7 doc handoff, which the plan explicitly keeps out of `scope.files`/`interactions`. No scope deviation.

**Recorded deviations are documented and justified.** (1) TC-BIND-002's readiness projection: the production fact source has no work-item facts, so `held/dependency-unobserved` folds before `repo-free`; the suite asserts the binding-relevant facts at the layers that emit them (pm-notes retro + test-plan §10 execution note). (2) `status`/`brief` root-absence runs from a cwd outside the checkout because `status` independently renders its own local-context path (same retro + §8.3 OQ-F). (3) The changeset is `minor` rather than `patch` because the pinned `TC-RELEASE-001` requires the five fixed-group packages at `minor` (spec v1.5, pm-notes D4 + retro); the delivered `.changeset/gh-273-queue-repository-binding-minor.md` matches.

## 3. Code quality

- **Gate/derivation correctness.** The guard is a single conjunction (`target !== undefined && repositoryKey !== undefined && repositoryFacts.root !== undefined`) producing one literal pair; there is no asymmetric branch and no call-site field inspection, so a one-sided binding is unreachable from this producer. The three absence causes are distinguishable and behave symmetrically.
- **Injection semantics.** `resolvedRepositoryFacts = readRepositoryFacts({cwd})` is resolved once; the injected record supplies only `originUrl`; the root is always `resolvedRepositoryFacts.root`. `target`, `clientTarget`, dispatch `remoteUrl`, and `schedulerKeyOf`'s host all keep reading the same effective origin, so pre-fix consumer behaviour is preserved. The reconstructed facts object drops `head`, which `production.ts` never consumed.
- **No domain/grammar/error drift.** Only `packages/cli/src/production.ts` changed under `packages/` (confirmed with `git diff --name-only`); the queue edge's field-wise forwarding, the write/read invariant predicates, the error table, envelopes, and exits are untouched.
- **Root non-disclosure.** The root is only placed in the queue entry payload; the JSON projection carries the key alone, the human/text surfaces and the derived graph are asserted root-free, and new `repositoryRoot` references are pinned to a four-file source allowlist.
- **Security / privacy.** No secrets, no new output channel, no user-controlled input; the remote is normalized (scheme, userinfo, `.git` stripped, lowercased). The absolute root is treated as internal state.
- **Performance.** No new spawn, network call, or extra facts read on the add path; the single facts resolution replaces the pre-existing conditional resolution and is asserted structurally.
- **Repo rules.** `pnpm typecheck`, `biome check` on all changed files, `.dependency-cruiser` boundaries, ambient-globals, exports-parity, and the aggregate `pnpm check` (as recorded) are green; the module still exports only `createProductionComposer` (+ the unchanged facts type).
- **Docs.** The `feature-cli-entrypoint.md` composition note accurately describes the delivered gate, the origin overlay, the root sourcing, and root non-disclosure; `feature-scheduling-engine.md` already stated the key-and-root-together and non-disclosure contract and only gained the `GH-273` traceability link. Both keep `ados_distribution: internal`.

## 4. Test quality

- **Real derivation, not a fixture pair.** The new harness injects `repositoryFacts: { originUrl }` (or `{}`) only; root always resolves from the real fabricated `.git` on disk. No scenario supplies a synthetic root, so the RSK-4 false-green shape is closed. The nested/worktree/root-unresolved cells would fail if the root came from anywhere else.
- **Evidence arithmetic checks out.** Under P1 (composition add 15 tests): 3 pass / 12 fail — exactly TC-001, 003–009 (006 integration half), 010, 017, plus TC-002 `present` and `root-unresolved`. P2: shape suite 4/2. P3: `-t TC-BIND-002` 3/1. P4: invariant 2/1 then 1/2. Second-`readRepositoryFacts` mutation: derivation 4/1. These are internally consistent with the committed tests. Note: the recorded P1 derivation-suite count (3/2) assumes the documented *minimal* re-expression of the derivation; a whole-file `git revert` of `fa8ecd03` would also red TC-BIND-014's construction-site assertion (2/3) without changing the composition-suite split — see F-7.
- **Domain negatives are honestly mutation-verified**, not claimed revert-detecting; the fixture-shape layer is fixture-revert evidence and correctly not attributed to the producer revert.
- **Determinism.** No clock/network/real-`git` dependence in the new suites; the harness injects a recording spawn runner, a throwing transport, and a recording git child runner. `recordedAt` uses the composer's real clock but no assertion depends on it; TC-BIND-017 compares binding fields only.
- **Weak spots (advisory).** TC-BIND-016 counts identifier-text calls (accepted proxy, OQ-D); TC-BIND-008 does not assert key absence in the human rendering; the root-unresolved fixture's outside-repo fallback depends on a writable parent (documented TMPDIR parity). See F-3/F-4/F-5.

## 5. Advisory findings

| ID | Severity | Location | Note |
|----|----------|----------|------|
| F-1 | low | `chg-GH-273-pm-notes.yaml:276` | Phase-7 handoff note still says "no doc/spec/** edit in this change" while commit `d14b91f2` edits two spec pages; no note records that doc-sync commit though the registry marks `system_spec_update` complete. Append a completion note (or reword). |
| F-2 | low | `chg-GH-273-test-plan.md:844` | §7 "Implementation status" still says "To Implement" for the 17 new TCs; §10 is authoritative and correct. Update the status column to "Implemented". |
| F-3 | info | `tests/behaviour/queue-production-binding.test.ts:543` | TC-BIND-008 does not assert the human `queue list` rendering omits the normalized key; AC-F4-1's no-key half is review-verified only. |
| F-4 | info | `tests/structure/queue-binding-derivation.test.ts:230` | TC-BIND-016 counts direct identifier calls; alias/indirect resolutions are invisible. PM-ratified observable proxy (OQ-D); no action required. |
| F-5 | info | `tests/fixtures/queue/production/harness.ts:98` | The outside-repo fallback writes to `dirname(process.cwd())` when TMPDIR is inside the checkout; environment-dependent (documented), fails loudly if no candidate works. |
| F-6 | info | `packages/cli/src/production.ts:257` | An injected facts object with no `originUrl` suppresses a real checkout origin; harmless today (production never injects; existing fixture relies on `{}` = no origin), but DEC-5 does not state the absence case. |
| F-7 | info | `chg-GH-273-test-plan.md:941` | The P1 derivation-suite 3/2 red set is reproducible only with the documented minimal derivation re-expression; a whole-file revert would be 2/3 (construction-site assertion also reds). Clarify the procedure or record both counts. |

No finding is blocking. F-1/F-2 are artifact hygiene; F-3–F-7 are informational.

## 6. Verification performed

```
bun test tests/behaviour/queue-production-binding.test.ts \
         tests/behaviour/queue-binding-invariant.test.ts \
         tests/structure/queue-binding-derivation.test.ts \
         tests/structure/queue-binding-fixture-shape.test.ts        # 29 pass / 0 fail
bun test tests/conformance/pilot/pilot-records.test.ts              # 4 pass / 0 fail
bun test tests/behaviour/production-composition.test.ts \
         tests/behaviour/entrypoint-composition.test.ts \
         tests/structure/dispatch-composition.test.ts \
         tests/behaviour/queue-cli.test.ts \
         tests/behaviour/queue-edge-wiring.test.ts                  # 70 pass / 0 fail
bun test tests/checks/error-table-sync.test.ts \
         tests/structure/error-table.test.ts \
         tests/structure/queue-scheduling-contract.test.ts          # 193 pass / 0 fail
bun test tests/checks/privacy-release.test.ts \
         tests/checks/doc-conformance.test.ts \
         tests/structure/content-inventory.test.ts                  # 24 pass / 0 fail
bun test tests/checks/fixture-privacy.test.ts \
         tests/checks/pilot-privacy.test.ts                         # 7 pass / 0 fail
pnpm typecheck                                                      # exit 0
pnpm exec biome check <8 changed source/test files>                 # clean
bun packages/cli/bin/delivery-os.ts plan validate GH-273 --json     # valid / readyForDevelopment: true
git diff --check origin/main-tools...HEAD                           # clean
git status --porcelain                                              # empty
```

`TMPDIR=$PWD/tmp/tmpdir` was used for the runs, matching the repo-local gate setting. I did **not** execute the P1–P4 in-place revert/mutation procedures because this review is read-only over source; the recorded red/green sets were instead checked against the pre-fix base source and the committed test structure, and they are consistent (see AC-F6-1/§4).

## 7. Verdict

**PASS.** Every acceptance criterion is satisfied and traceable, all five plan phases are delivered with pm-notes commit/test evidence, and the delivered code implements the single total derivation the spec requires without touching the domain, grammar, error table, or outputs. The regression suites exercise the real producer derivation and are green, and the targeted gates I re-ran are clean. The two low and five info findings are advisory hygiene/documentation items that do not affect behaviour or compliance.

**Next step:** `PROCEED` (quality gates → DoD check). Fold F-1/F-2 opportunistically before PR if cheap; F-3–F-6 need no action for this change.
