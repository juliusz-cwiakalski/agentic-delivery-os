# Readiness Review Iteration 1

Verdict: **NOT_READY**
DoR gate result: **NOT_READY** — 2 blocking findings; delivery must not start until the owning artifact phase is reopened.
Work Item: GH-273 (`fix(queue): production binding sends repository key without root, so queue add is refused and dispatch cannot start`)
Date: 2026-11-08
Pause Required: no (no human decision is required to start remediation; see A5 for a possible decision-record routing)
Owning artifact phase to reopen: **specification** (v1.1 → v1.2). Consequential alignment in `test_planning` and `delivery_planning` follows from the same two rulings but is not a second reopen.

> Read-only gate. This pass modified nothing except this verdict file.

## Gate Summary

Artifacts reviewed:

- `chg-GH-273-spec.md` v1.1 (F-1..F-6, 18 ACs `AC-F1-1`..`AC-F6-4`, DM-1..DM-3, NFR-1..NFR-8, DEC-1..DEC-8, OQ-1..OQ-3, RSK-1..RSK-8).
- `chg-GH-273-test-plan.md` v2 (TC-BIND-001..018, §3 coverage, §4 layers, §5.2 scenarios, §6 environments, §7 automation mapping, §8.3 resolved OQ-A..OQ-G, §10 execution log).
- `chg-GH-273-plan.yaml` (`delivery.plan.v1`, tier `full`, 5 delivery phases) — revalidated in this pass: `bun packages/cli/bin/delivery-os.ts plan validate GH-273 --json` → `verdict: "valid"`, `readyForDevelopment: true`, exit 0.
- `chg-GH-273-pm-notes.yaml` (delivery mode `autonomous`, decisions D1/D2, retro on the v1.0→v1.1 evidence-class correction).
- Ticket GH-273 (`gh issue view 273 -R juliusz-cwiakalski/agentic-delivery-os`): symptom, verified root cause, repro, fix direction, acceptance.
- Current-truth docs: `doc/spec/features/feature-scheduling-engine.md` (entry-record contract, root non-disclosure, deploy-expectation matching), `doc/spec/features/feature-cli-entrypoint.md` (production composer wiring), `doc/spec/features/feature-merge-verify-deploy.md`.
- Delivered source, read to verify every load-bearing claim: `packages/cli/src/production.ts`, `packages/cli/src/edge.ts` (`QueueComposition`, `createQueueCommandRuntime`, `resolveDeployExpectations`), `packages/core/src/app/queue.ts` (`isEntryRecord`, `desiredEntry`, `claimQueueLease`, `entryRepository`, `mutateIntent`), `packages/core/src/domain/queue-graph.ts` (`normalizeRepositoryKey`, `projectEntry`, `queueGraphDocument`), `packages/core/src/domain/dispatch-identity.ts` (`normalizeRepositoryRemote`, `normalizeDispatchRepositoryKey`, `resolveDispatchIdentity`), `packages/core/src/domain/queue-readiness.ts`, `packages/core/src/domain/queue-precedence.ts`, `packages/core/src/contracts/plan.ts`, `packages/cli/src/projection.ts`, `.changeset/config.json`.
- Existing fixtures and suites: `tests/fixtures/queue/cli/harness.ts`, `tests/fixtures/queue/schedule/harness.ts`, `tests/fixtures/pilot/{repo,harness}.ts`, `tests/structure/dispatch-composition.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/behaviour/{production-composition,entrypoint-composition}.test.ts`, `tests/checks/{fixture-privacy,pilot-privacy,queue-hermetic}.test.ts`, `tests/golden/queue-*`, `tests/conformance/pilot/*`.

Two executable probes were run to test artifact claims rather than accept them:

```
normalizeRepositoryKey("https://github.com/Owner/Repo.git")    -> "github.com/owner/repo"
normalizeRepositoryRemote("https://github.com/Owner/Repo.git") -> "github.com/Owner/Repo"   # host-only lowercasing
normalizeRepositoryKey("https://gitlab.com/owner/repo.git")    -> "gitlab.com/owner/repo"
normalizeRepositoryRemote("https://gitlab.com/owner/repo.git") -> "gitlab.com/owner/repo"
normalizeDispatchRepositoryKey("owner/repo")                   -> undefined                 # 2 segments
```

These two probes are the basis of blocking findings B1 and B2.

No previous readiness record exists for GH-273; this is iteration 1. The Definition-of-Ready override is **not** available and was **not** used: this change adds/changes behavior (a production composition now records state it previously could not) and touches a composition contract seam.

## Facet Summary

- spec_completeness: **FAIL** (B2 — "key resolved" is never defined and the spec's own definition contradicts the matrix fixture)
- ac_quality: **FAIL** (B1 — AC-F3-1 is not satisfiable under the spec's own stated normalizer reuse)
- plan_coverage: **PASS** (5 phases cover all 18 ACs and all 18 TCs; see A8/A9 for phase-ownership annotations)
- test_traceability: **PASS** (18/18 ACs mapped, 18/18 TCs assigned to a phase; the matrix cell labelled "key unresolved" is wrong — captured in B2, not as a traceability gap)
- cross_artifact_consistency: **FAIL** (B1 spec §8.4 vs AC-F3-1/TC-BIND-006/plan phase 1; B2 spec F-1/F-3/Appendix A vs TC-BIND-002; A6, A7, A11 annotation drift)
- decision_capture: **PASS** (DEC-1..DEC-8 recorded in the change Decision Log and ratified as pm-notes D1/D2; A4/A5 are status and routing nits)
- system_spec_consistency: **PASS** (`feature-scheduling-engine.md` §"State records" already states key+root together, root internal, key-only projection; no contradiction to reconcile)
- plan_doc_update_coverage: **PASS** (phase 5 lists both `doc/spec/**` pages; A2 records the phase-ownership conflict with lifecycle phase 7)
- plan_code_area_coverage: **PASS** (every phase declares files; A11 notes the pinned export set in `production.ts`)
- dod_defined: **PASS** (18 testable ACs + §4.1 zero-tolerance metrics + §18 verification/rollback; A4's stale OQ statuses do not weaken it)

## Blocking Findings

### B1 [critical] cross_artifact_consistency / ac_quality — `chg-GH-273-spec.md` §5.1 F-3 + §8.4 vs §17 AC-F3-1, `chg-GH-273-test-plan.md` TC-BIND-006, `chg-GH-273-plan.yaml` phase 1

Gap: the spec names the wrong normalizer, and the named one cannot produce the key AC-F3-1 requires.

- §8.4 says the key normalization is "Reused from the existing normalization used for dispatch identity" — i.e. `normalizeRepositoryRemote` in `packages/core/src/domain/dispatch-identity.ts`.
- AC-F3-1 requires that HTTPS±`.git`, SSH URL, scp-style **and mixed case** all record the **same lowercase** `host/owner/name`, and TC-BIND-006 is explicit: "no `Owner/Repo`".
- Verified by execution: `normalizeRepositoryRemote("https://github.com/Owner/Repo.git") === "github.com/Owner/Repo"` (only the host is lowercased), while `normalizeRepositoryKey` (`packages/core/src/domain/queue-graph.ts:76-91`, the queue-world contention-key normalizer already pinned by `tests/fixtures/queue/graph/binding/cases.json` and `tests/behaviour/queue-graph.test.ts`) returns `github.com/owner/repo`.
- Plan phase 1 repeats the ambiguity: "normalize the key from the same origin resolution with the delivered remote normalizer (no new parsing rule)". Two delivered remote normalizers exist; the phase does not say which.

Consequence: a coder following §8.4/plan phase 1 merges a key that fails AC-F3-1/TC-BIND-006; a coder following AC-F3-1 must pick `normalizeRepositoryKey`, which the spec currently describes as out of scope. There is also a latent consumer hazard: `normalizeRepositoryRemote` is what `resolveDispatchIdentity` uses, so the spec must state which function is the single authority for both the recorded key and the (future) deploy-expectation `normalizedRemote(root)` port, or the mixed-case form splits one contention domain into two — exactly spec RSK-1.

Suggested remediation target phase: **specification**.
Suggested fix: in §5.1 F-3, §8.4, Appendix B and the DM-1 row, name `normalizeRepositoryKey` as the producer's single normalization authority (fully lowercased, `host/owner/name`) and state that the same function is the contract for the deploy-expectation port's `normalizedRemote(root)`; delete the "reuse the dispatch-identity normalization" sentence or explain why the dispatch normalizer's host-only lowercasing is intentionally not the queue key. Then have `@plan-writer` replace "the delivered remote normalizer" in phase 1 with the exact function name. No code change beyond the composition.

### B2 [critical] spec_completeness / cross_artifact_consistency — `chg-GH-273-spec.md` §5.1 F-1/F-3, Appendix A, AC-F1-2 vs `chg-GH-273-test-plan.md` TC-BIND-002 precondition (ii) and OQ-A

Gap: the spec never defines what makes the repository key "resolved", and its only definition contradicts the matrix cell that is supposed to prove the key-unresolved branch.

- F-1/F-3/Appendix A define the unresolved cell as "no origin / **unnormalizable** remote", and F-3 says "a remote that cannot be normalized yields no binding".
- TC-BIND-002 builds the key✗/root✓ cell from `https://gitlab.com/owner/repo.git` (plus `not-a-url`).
- Verified by execution: `https://gitlab.com/owner/repo.git` **does** normalize, under both delivered normalizers, to `gitlab.com/owner/repo`. The only way that cell yields "no binding" is if the derivation is additionally gated on the GitHub-only `target` produced by `parseGitHubRemote` (`packages/cli/src/production.ts:263, 357`). The spec never requires that gate; NG-5 says non-GitHub remote support is out of scope but never says the binding is GitHub-gated.
- `not-a-url` is a valid unresolved case under either reading, so the scenario is implementable — but the fixture set and the AC's meaning are not.

Consequence: the two artifacts force different implementations. A spec-conforming producer emits `gitlab.com/owner/repo` for the "key unresolved" cell and fails TC-BIND-002 (and the asymmetry mutation in TC-BIND-018 steps 6–8 then reds the wrong cell); a test-conforming producer silently adds a GitHub-target gate that the spec does not declare. Either way AC-F1-2's evidence class ("mutation-verified symmetry guard") is not trustworthy as written.

Suggested remediation target phase: **specification**.
Suggested fix: define "key resolved" explicitly as either (a) "the GitHub target resolves via `parseGitHubRemote`" (state that a non-GitHub remote yields no binding by design and that this is the NG-5 boundary), or (b) "`normalizeRepositoryKey(originUrl)` resolves for any host" (then a GitLab checkout records a binding and the matrix's unresolved cell must use `not-a-url`/absent origin only). Whichever is chosen, restate AC-F1-2/AC-F6-1's asymmetry-mutation target and have `@test-plan-writer` correct TC-BIND-002's precondition and OQ-A wording to the chosen reading.

## Advisory Findings (non-blocking; fix in the same artifact iteration where cheap)

### A1 [major] test_traceability / spec_completeness — `chg-GH-273-test-plan.md` TC-BIND-015 step 4, §6, §4 runtime expectations; `chg-GH-273-plan.yaml` phase 4

Gap: TC-BIND-015's step 4 composes the pilot fixture at runtime and reads its seeded entries from a `tests/structure/queue-binding-fixture-shape.test.ts` suite. The pilot fixture creates a real temporary git repository with `execFileSync` (`tests/fixtures/pilot/repo.ts` header and helpers), which contradicts test-plan §6 ("No `git` binary is spawned by the new suites") and the structural-layer runtime budget in §4. It also re-proves coverage that `tests/conformance/pilot` already owns.

Suggested remediation target phase: **test_planning**.
Suggested fix: drop the runtime half from the structural file and assert the pilot seed shape in `tests/conformance/pilot/*` (which already builds the fixture), or relax §6/§4 to declare the pilot runtime cost explicitly. Keep the AST half of TC-BIND-015 as the revert-detecting evidence.

### A2 [major] plan_coverage (process ownership) — `chg-GH-273-plan.yaml` phase 5 (`doc/spec/features/*`, plan self-edit, doneArtifacts)

Gap: phase 5 asks the coder to reconcile `doc/spec/**` during delivery. The lifecycle assigns current-truth reconciliation to phase 7 (`system_spec_update`, owned by `@doc-syncer`, `doc/guides/change-lifecycle.md` §7), and the repository's established plan pattern declares the same scope but **executes** it at lifecycle phase 7 (GH-237 plan task 8.1: "declared as scope, executed at lifecycle phase 7 by @doc-syncer"). Phase 5 also says "Reconcile the plan to what actually landed if review changed placement" — review is lifecycle phase 8, after delivery completes, so that obligation cannot be discharged where it is placed. The `.changeset` part is fine and conventional (GH-239/242 also add it in a delivery phase).

Suggested remediation target phase: **delivery_planning**.
Suggested fix: keep both `doc/spec/**` pages and the changeset in phase-5 `scope.files`, but reword the summary to "declared scope, executed at lifecycle phase 7 by `@doc-syncer` (this PR)" as GH-237 did, or keep the edit and state that phase 7 re-verifies it. Move the "reconcile the plan to what landed" obligation to `review_fix`/pm-notes.

### A3 [minor] plan_coverage — `chg-GH-273-plan.yaml` phase 5 `doneArtifacts.mergeRequestUrl`

Gap: `mergeRequestUrl: "PR for fix/GH-273/queue-repository-binding targeting main-tools"` reads as a coder deliverable, though the schema slot is a declaration and PR creation is lifecycle phase 11 (`@pr-manager`). GH-238's plan qualifies the same slot as "PR targeting main-tools opened at lifecycle phase 11 (URL recorded in pm-notes)".

Suggested remediation target phase: **delivery_planning**.
Suggested fix: adopt the GH-238 phrasing so the phase boundary is unambiguous; no schema change needed.

### A4 [minor] decision_capture / spec_completeness — `chg-GH-273-spec.md` §14 OQ-1, OQ-2

Gap: OQ-1 and OQ-2 remain "Decision needed: consult `@decision-advisor`" although `chg-GH-273-pm-notes.yaml` `decisions:` D1 ratifies DEC-3 and D2 ratifies DEC-8, and DEC-3/DEC-8 are already in the spec's Decision Log. OQ-1 also calls the normalized key a "scope expansion that the PM must ratify", while the ticket's **Expected** section already requires "both the normalized repository key and its recorded root" — it is ticket-scoped, not an expansion.

Suggested remediation target phase: **specification**.
Suggested fix: mark OQ-1/OQ-2 `Resolved` with the D1/D2 references and correct the "scope expansion" framing to "ticket-required, previously unimplemented".

### A5 [minor] decision_capture — `chg-GH-273-spec.md` DEC-5, `chg-GH-273-plan.yaml` phase 1

Gap: DEC-5 changes the meaning of the exported `ProductionCompositionFacts.repositoryFacts` seam from "replace the whole facts value" to "replace only the origin; root always from cwd". That seam is a test contract every future composition suite will depend on (and the exact false-green mechanism that hid this defect). It is captured change-locally, which is defensible for this fix, but a future agent tuning the seam will not find the rationale outside this change folder.

Suggested remediation target phase: **specification** (route to `@decision-advisor` if the PM wants it promoted).
Suggested fix: either record the seam semantics as a business/technical decision record route, or (minimum) ensure phase 5's `feature-cli-entrypoint.md` note states the overlay semantics permanently — the plan already promises that note.

### A6 [minor] test_traceability — `chg-GH-273-plan.yaml` phase 2 summary vs `chg-GH-273-test-plan.md` TC-BIND-002 expected outcome

Gap: the plan says the unbound entry reports "the existing not-ready/addressing-unresolved state", while TC-BIND-002 asserts blocking detail `repository-binding-unresolved`. Both tokens exist but at different layers: `addressing-unresolved` is the readiness *evidence reason* (`queue-readiness.ts:237`), `repository-binding-unresolved` is the *blocking detail* (`queue-precedence.ts:344`, `queue.ts:977`). As written, an implementer can satisfy the plan wording and fail the test.

Suggested remediation target phase: **delivery_planning** (wording only).
Suggested fix: name both tokens with their layers in the phase-2 summary.

### A7 [nit] cross_artifact_consistency — `chg-GH-273-test-plan.md` frontmatter `links.implementation_plan: null`, §2 line 50

Gap: the test plan still says the implementation plan is "not authored yet"; `chg-GH-273-plan.yaml` now exists and validates.

Suggested remediation target phase: **test_planning**.
Suggested fix: point `implementation_plan` at `./chg-GH-273-plan.yaml` and update §2.

### A8 [minor] ac_quality — `chg-GH-273-spec.md` AC-F1-2 / AC-F1-3

Gap: both ACs assert "the entry carries neither repository field" without the "first add in a fresh ledger" qualifier. `desiredEntry` inherits the current entry's fields (`request.repository ?? current?.repository`, `queue.ts:600-601`), so a second add in a store that already holds a bound entry retains the earlier pair. The test plan mandates a fresh harness per cell (TC-BIND-002 step 1), so the tests pass, but the AC as written is not universally true and invites a wrong regression later.

Suggested remediation target phase: **specification**.
Suggested fix: qualify the two ACs to a first declaration, and add one explicit sentence (or a TC row) stating that a later unbound add retains the previously recorded pair rather than clearing it.

### A9 [nit] plan_coverage — `chg-GH-273-plan.yaml` header "each phase is independently green on its own slice" vs phase 2/3 split

Gap: phase 2 owns AC-F4-1, but AC-F4-1's source-allowlist half of TC-BIND-008 lives in phase 3's `tests/structure/queue-binding-derivation.test.ts`. Phase 2 is green, but AC-F4-1 is not fully discharged until phase 3. The additive-confirmation model is fine; the absolute claim is not literally true.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: say "each phase is independently green; an AC owner may be completed by a later additive confirmation named in the header".

### A10 [nit] cross_artifact_consistency — `chg-GH-273-spec.md` §5.1 F-4, §8.1 "queue list renders the normalized key"

Gap: `renderQueueHuman` (`packages/core/src/domain/queue-precedence.ts:704-720`) renders `ref state rankClass` and never the repository key; only the JSON projection carries it. "Renders the normalized key alone" reads as a new human-rendering requirement, which NG-2 forbids. TC-BIND-008 only asserts root absence in text, so the tests are safe, but the wording invites an out-of-scope human-output change.

Suggested remediation target phase: **specification**.
Suggested fix: say "the JSON projection carries the normalized key alone and no surface carries the root; the human rendering is unchanged".

### A11 [nit] plan_code_area_coverage — `chg-GH-273-plan.yaml` phase 1

Gap: `tests/structure/content-inventory.test.ts:1642` pins `packages/cli/src/production.ts`'s export set to exactly `["createProductionComposer"]`. A coder who exports the new derivation for a unit test breaks the inventory check. The phase-1 gate catches it, but the plan should not leave the trap implicit.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: add "no new export is added to `production.ts` (content-inventory pins its export set)" to the phase-1 summary or its `tests` note.

## Adversarial Checks That Passed (recorded so the findings above are not read as blanket doubt)

- **Root cause still matches the code.** `packages/cli/src/production.ts:352-357` still builds `repositoryBinding: { repository: `${target.owner}/${target.name}` }` (key only, host-less). `packages/core/src/app/queue.ts:230-240` still enforces the read-side together-predicate and `queue.ts:598-609` the write-side predicate with the exact summary `repository key and recorded root must be present together`. `packages/cli/src/edge.ts:4226-4234` still forwards each field independently. `packages/cli/src/edge.ts:3821-3846` declares the optional pair and `edge.ts:3895` collects deploy-expectation roots only from complete pairs. Production wires no deploy-expectation port. The ticket's chain (add refused → list empty → dispatch `queue.entry.unobserved`) is reproduced by `runDispatch`'s `claimLease` → `entryRepository` (`queue.ts:966-980`) with no attempt appended on refusal.
- **No other one-sided producer exists.** Exhaustive search of `repositoryBinding` / `createQueueCommandRuntime` / `QueueComposition` across `packages/**` and `tests/**`: the only construction sites are `production.ts:357`, `tests/fixtures/pilot/harness.ts:436` (one-sided, corrected by phase 4), and `tests/fixtures/queue/cli/harness.ts:131` (already a pair). `packages/mcp` and `packages/opencode` compose no queue. The pilot fixture never calls `queue add` (only `queue plan`), so the correction causes no golden churn — RSK-7 is correctly assessed.
- **No consumer requires a host-less key.** Every comparison site uses the entry key itself or a three-segment normalized key: lease identity (`queue.ts`), dispatch scheduler precedence (`dispatch-identity.ts:120-131`), `schedulerKeyForRef` (`production.ts:509-512`), deploy expectations (`edge.ts:3929`), park context. `normalizeDispatchRepositoryKey("owner/repo")` is `undefined`, confirming the host-less form would have silently fallen through to `remote`.
- **No over-reach detected.** The change touches no domain predicate, error identity, envelope, grammar, exit projection, state schema, or record kind. The root stays out of `projectEntry`/`queueGraphDocument` and out of `mutationData`; the source allowlist in phase 3 is exactly today's reference set (`edge.ts`, `production.ts`, `queue.ts`, `contracts/queue.ts`).
- **Evidence classes are honest, not an escape hatch.** The v1.1 correction is real: the key-unresolved guard genuinely passes pre-fix (pre-fix already emits no binding when `target` is unresolved), so it cannot be revert-detecting; the asymmetry mutation is the correct demonstration. Domain negatives genuinely cannot fail on a producer revert, so predicate mutation is the correct demonstration. AC-F5-3 genuinely has no permanent diff test and is correctly review-verified plus the pinned error-set suite. TC-BIND-016 passes pre-fix by design and is correctly labelled an anti-recurrence guard. TC-BIND-010's encoded pre-fix triple is weak on its own but is not claimed as revert evidence — TC-BIND-018 carries that, and the split is stated.
- **Phase independence and staging.** Phase 1 changes only `production.ts` and no existing suite exercises `queue add` through the production composer (verified: `createProductionComposer` appears only in `tests/structure/{dispatch-composition,entrypoint-bin,entrypoint-installer-absence,content-inventory}.test.ts`, none of which calls `queue add`); the phase-1 gate set is green-capable. The injection overlay is type-compatible with the existing narrow seam (`production.ts:191`) and changes no other production consumer of `repositoryFacts` (`originUrl` at 486/530, `target` at 263). `computeStagingPlan` includes tracked files and flags out-of-scope drift, so phase 1 cannot silently stage the later test files, and phase 5's declared scope covers its own edits.
- **Plan mechanics.** `plan validate GH-273` → valid/ready, tier `full`, phases [1..5]. All 18 ACs appear in the plan; all 18 TCs are assigned to phases (001–010, 017 → 2; 011–014, 016 → 3; 015 → 4; 018 → 5). Test file paths, gate commands, and helper suites named in the plan all exist (`tests/golden/queue-*`, `tests/checks/{error-table-sync,pilot-privacy}`, `tests/conformance/pilot`, `tests/fixtures/queue/graph/binding/cases.json`). `.changeset/config.json` is the five-package fixed group; a patch changeset matches `version_impact: patch`.
- **Conformance/registration claims verified.** `tests/structure/content-inventory.test.ts` enumerates `packages/**`; `tests/checks/fixture-privacy.test.ts` scans a fixed list excluding `tests/fixtures/queue/**`; `tests/boundaries/fixture-coverage.test.ts` cruises `packages/**`; `tests/checks/fixture-sanitization.test.ts` is scoped to `tests/fixtures/providers`. The plan's "no new registration" reasoning holds.

## Counts

- ACs: 18 in the spec; 18 mapped to at least one TC; 18 present in the plan; 0 unmapped, 0 invented.
- TCs: 18 in the index, 18 detail sections, 18 in the §7 automation table; 18 assigned to a phase (ranges used in the plan header for 001..010, 011..014).
- Phase count: 5 (all `kind: delivery`); all 5 declare `scope.files` and `weightClass`.
- Blocking findings: 2 (B1 critical, B2 critical). Advisory findings: 11 (A1 major, A2 major, A3–A6 minor, A7 nit, A8 minor, A9–A11 nit).
- Verified-and-passed checks: 7 groups above.

## Next Action

Reopen **`specification`** for GH-273 and resolve B1 and B2 in a v1.2, then have `@test-plan-writer` apply the consequential edits (TC-BIND-002 fixture/label, TC-BIND-015 runtime split, A7) and `@plan-writer` align phase 1's normalizer wording and phase 5's doc ownership (A2/A3/A6/A9/A11). Re-run this gate. If the same two gaps persist across two further iterations, escalate to the human owner rather than looping.
