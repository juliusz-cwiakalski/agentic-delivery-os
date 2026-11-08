# Readiness Review Iteration 1

Verdict: **NOT_READY**
Work Item: GH-238 (M1-S18: Resident dispatch daemon)
Date: 2026-11-07
Pause Required: no

## Gate Summary

- Artifact set reviewed: `chg-GH-238-spec.md` v1.0 (17 capabilities, 36 ACs, 18 NFRs, 9 events, 16 data-model elements, 10 appendices), `chg-GH-238-test-plan.md` v1.0 (100 TCs), `chg-GH-238-plan.yaml` (delivery.plan.v1, 12 phases / 83 tasks), `chg-GH-238-pm-notes.yaml`, ticket `juliusz-cwiakalski/agentic-delivery-os#238`, the M1 design pack (`architecture.md`, `commands/daemon.md`, `interactions.md`, `contracts.md`, `test-scenarios.md`, `man-page.md`), `backlog.md` M1-S18, the delivered current-truth specs, and the delivered code the change builds on.
- Findings: **19 — 2 critical, 10 major, 6 minor, 1 nit**. **10 blocking** (`B`), 9 non-blocking (`N`).
- Facets failing: `spec_completeness`, `ac_quality`, `plan_coverage`, `cross_artifact_consistency`, `decision_capture`, `system_spec_consistency`, `plan_code_area_coverage`.
- Reopen targets: **specification** (R-01..R-07, R-14..R-16, R-18), **test_planning** (R-01, R-02, R-04, R-06, R-07, R-13, R-15, R-18), **delivery_planning** (R-05, R-08..R-12, R-17, R-19). Never `delivery`.
- The Definition-of-Ready override is **not** available and was **not** used: the change adds and alters behavior, introduces contracts (7 record kinds, 8 error rows, 2 configuration branches, a new wire protocol, a new adapters subpath), and changes the command surface.
- Pause is **not** required. All findings are change-scoped artifact corrections. R-01, R-02, and R-06 may instead be resolved by narrowing ticket clauses; if the PM chooses narrowing rather than delivering the mechanism, an explicit PM/human acknowledgement must be recorded in `chg-GH-238-pm-notes.yaml` (decision routing: `change`), not left implicit in a plan header.

Structural facts that pass (so the verdict is about substance, not missing bookkeeping):

- The plan is **schema-valid** through the repository's own validator (`validatePlan` + the real `parseConfigYaml` path): `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, all 12 phases echoed with `kind: delivery`, lease-taking, and the declared weight classes; `truncated: false`.
- Test plan: 100 TCs in the index = 100 scenario details = 100 automation rows; 36/36 AC rows present; 18/18 NFR rows present; EVT-1..EVT-9 and DM-1..DM-16 traced; seeded scenarios SC-M1-15/16/17/17b/18/20 mapped, with SC-M1-14 additionally mapped for AC-F9-2; forward and reverse mapping are complete.
- Plan: 12 phases, 83 tasks, 36 distinct ACs covered before the closure phases (Phase 12 carries all 36 as a closure safety net); every AC has a delivery phase before Phase 11/12.
- Every test/script path named by a phase gate exists in the tree or is declared in a phase scope, with the exceptions recorded below (`tests/behaviour/commit-act.test.ts`; the undeclared `lanes-watch-refusal` golden).
- Delivered substrate assertions verified: `BOARD_COLLECTOR_IDS = ["tracker", "lanes"]`; `QUEUE_LANE_STATES` has six values including `idle-with-reason`; `lane.liveness-interval` / `lane.restart-budget` exist with the stated defaults; `evaluateRestartBudget`, `appendEconomicsRestartEvent`, and `releaseQueueLease` exist; `watchRefusal` exists in both `packages/cli/src/commands/queue.ts` and `lanes.ts`; `tests/golden/lanes-watch-refusal.test.ts` + its fixture exist; `doc/spec/features/feature-adapter-ports.md`, `feature-watchdog-lane-contracts.md`, `feature-queue-ready.md`, and the other cited current-truth specs exist; `.changeset/config.json` fixes the five packages the plan names; Azure and CI adapters are type-only scaffolds, so the `poll.<platform>` pin `{github, gitlab, jira}` is honest; `feature-scheduling-engine.md` still records the no-composition-root and `--watch` refusal limits the plan removes.

## Facet Summary

- spec_completeness: **FAIL** — the mutating-request contract is undefined (R-01); the commit crash-safety mechanism is asserted but not delivered or added (R-02); the lock token is simultaneously forbidden and mandated on the wire (R-03); `outbox.effect` lacks the reserved caller-principal field (R-05); blocker-answer application is undefined (R-06); the systemd unit's command form is unpinned (R-07); several minor contract gaps (R-14..R-17).
- ac_quality: **FAIL** — AC-F6-2 cannot be constructed over the closed protocol (R-01); AC-F4-1 vs the v0 compatibility shape, and AC-F16-1 vs the additive field, cannot both hold (R-04); AC-F4-4 forbids the lock token the control frames carry (R-03); AC-F3-1's "applies" is tested as "records intent" (R-06); AC-F2-2 mixes a stale Given with a live-lock refusal (R-18).
- plan_coverage: **FAIL** — 99/100 TCs are mapped (`TC-META-001` absent, R-08); several TCs are marked "full" before a declared target suite lands (R-09); Phase 9 leaves a delivered golden asserting the superseded refusal out of scope and gate (R-10).
- test_traceability: **PASS** — 100/100 TCs exist, 36/36 ACs and 18/18 NFRs traced, EVT/DM and seeds mapped; the defects found are assertion correctness and phase placement, tracked under the other facets.
- cross_artifact_consistency: **FAIL** — R-01, R-02, R-03, R-04, R-05, R-06, R-09, R-12.
- decision_capture: **FAIL** — OQ-5 (blocker-answer application) is still "Decision needed" in the spec while the plan pins it in its header; the S-1..S-8 resolutions live only in the plan header while the spec ACs they contradict remain unchanged (R-04, R-06).
- system_spec_consistency: **FAIL** — the commit "SHA idempotency" claim overstates the delivered primitive (R-02); the systemd unit cannot supervise a resident daemon in its specified form (R-07); the scope identifier is unpinned against §20's no-absolute-path rule (R-17).
- plan_doc_update_coverage: **PASS** — Phase 11 lists the new resident-daemon spec, eight neighbour specs (including `feature-adapter-ports.md`), the command registry, the daemon man page, the glossary, the architecture overview, `doc/00-index.md`, the changeset, the doc-distribution guard, and the test-plan execution log; the status digest is deliberately excluded (NG-6/NG-10).
- plan_code_area_coverage: **FAIL** — Phase 1 modifies `packages/core/src/app/queue.ts`, which no phase scope declares (R-11); Phase 9 changes `--watch` but leaves the delivered refusal golden out of scope (R-10); test doubles are placed inside the published `./daemon` adapters subpath (R-19).
- dod_defined: **PASS** — 36 ACs, 18 NFRs, the §4.1 zero-tolerance metrics, the seeded scenarios (seven ids; R-18 corrects the "six" wording), and the plan's Phase 11/12 PR-ready checklist form a testable Definition of Done. R-08 means the checklist's "100/100 TCs" line is false until fixed.

## Findings

Ordered by severity. `B` = blocking (must be fixed in an artifact phase before delivery starts); `N` = non-blocking (may be handled in the owning artifact phase before that phase, or accepted as a recorded residual).

### R-01 [critical][B] cross_artifact_consistency / ac_quality — `chg-GH-238-spec.md` §5.1 F-6, §17 AC-F6-2, Appendix B; `chg-GH-238-test-plan.md` TC-CONC-002/TC-CONC-003; `chg-GH-238-plan.yaml` task 3.3

Gap: F-6 requires "every mutating request" to carry a client-supplied idempotency key and AC-F6-2 requires "two concurrent mutating requests carrying the same idempotency key and two carrying different keys, when they reach the daemon" to land once / serialize. But control protocol v1 has **no mutating request type**: Appendix B (line 685) says "The only mutating frames are `drain`, `stop`, and `takeover`", the closed wire types are `{poke, status, lane, subscribe, drain, stop, takeover, frame, degraded}` (plan S-2 / Appendix B), and the DM-6 envelope (line 347) has no idempotency-key field — only `v`, `id?`, `kind`, `type`, `callerPrincipal`, and one body field. The `intent` frame class is explicitly deferred to a later additive transport (F-5, NG-4, M4-S6). TC-CONC-002's "queue add intent relayed through the daemon path" and its assertion of "exactly one state append **and exactly one external effect**" invent a wire mutation and an external effect that a queue add does not have. The M1 pack's "mutating request carries a client id usable as an idempotency key" (architecture.md line 422) describes **state-layer** mutations, not a wire frame. As written, a test cannot construct the AC's input without violating the closed vocabulary and NFR-14.

Suggested remediation target phase: **specification** (with **test_planning** for the TCs)
Suggested fix: Either (a) define an explicit mutating request type and an `idempotencyKey` envelope field now (a protocol change, not the deferred additive `intent` class), or (b) restate F-6/AC-F6-2 as **state-path** at-most-once application: CLI mutations carry the key on the intent record and serialize through the single-writer fence; control frames are at-most-once by `id`/lock token. Rewrite TC-CONC-002/003 to drive concurrent state-path mutations (daemon down and up) and a separate control-frame duplicate test; delete the "queue add relayed through the daemon path" phrasing.

### R-02 [critical][B] system_spec_consistency / cross_artifact_consistency — `chg-GH-238-spec.md` §1, §8.4 (line 367), F-10, AC-F8-4, AC-F10-2, Appendix I; `chg-GH-238-test-plan.md` TC-RECON-007, TC-EFFECT-005; `chg-GH-238-plan.yaml` tasks 7.1/7.3/7.4

Gap: The spec claims commits are "additionally protected structurally by the delivered atomic record-plus-commit and **SHA idempotency**" and AC-F10-2 requires a re-drive to "**detect the landed SHA**, record `applied`, and create no second commit". The delivered primitive does not provide this. `packages/core/src/domain/commit-act.ts` (`runCommitAct`) always creates a commit and, on a failed transition append, calls `resetTo(baselineHead)` — protection that only runs while the process is alive. `packages/core/src/contracts/commit.ts` exposes `commitExists(sha)` and `classifyCommitDelta`, which classify **durable evidence already in hand**; `packages/cli/src/edge.ts` (lines 540–610) states that "commit presence is durable evidence, not a HEAD position" and uses the record-bound SHA or the telemetry event as the evidence, so an unrecorded orphan commit is not visible. In the exact window the AC names — commit object landed, transition record and telemetry not yet appended — `classifyCommitDelta` returns `neither`; `packages/cli/src/commands/phase.ts` then runs the normal act, gets `no-pending-work` on a clean tree, and returns `recordOnly("skipped-no-pending-work")`. The SHA is never discovered, no `applied` receipt exists, and the ledger loses the commit binding. The AC's "SHA idempotency" is therefore a false claim about delivered capability; TC-RECON-007/TC-EFFECT-005 make it pass by declaring "an injected git adapter with SHA idempotency", i.e. fixture fiat rather than a mechanism under test. (A simple in-process abort is not a crash-safety mechanism.)

Suggested remediation target phase: **specification** (with **test_planning** for the TCs)
Suggested fix: Either (a) add a durable pre-commit identity to the change (e.g. a recorded planned transition identity or a deterministic commit trailer) plus a bounded query that finds the orphan by that identity, and implement it in the commit-effect adapter; or (b) narrow F-10/AC-F8-4/AC-F10-2 to the delivered evidence states and record the kill-after-commit-before-record window as an explicit named residual with a PM/human acknowledgement. Make TC-RECON-007/TC-EFFECT-005 exercise the production adapter's contract (with a negative control that fails when the detection is removed), not an adapter that grants the property by declaration.

### R-03 [major][B] ac_quality / system_spec_consistency — `chg-GH-238-spec.md` F-4 (line 142), §21 (line 602), AC-F4-4 (line 550), Appendix B (lines 679–681); `chg-GH-238-test-plan.md` TC-WIRE-006 step 1

Gap: F-4 says "Secrets never transit: no credential value, **token**, or secret material appears in a frame", §21 says "no **token**, value, prompt, body, transcript, diff, or provider payload transits", and AC-F4-4 repeats "no credential value, **token**, ... appears". Appendix B, however, puts `lockToken` in the `drain`, `stop`, and `takeover` request payloads, and `takeover` carries previous-lock-token evidence. The spec never exempts the daemon lock token or classifies it as a non-secret same-user ownership capability. TC-WIRE-006 injects a "token" canary and asserts none appears, which is unsatisfiable for the control frames unless the canary excludes the mandated field — an ambiguous oracle. The test could pass while the AC is false, or fail while the implementation is correct.

Suggested remediation target phase: **specification** (with **test_planning** for the canary scope)
Suggested fix: Add an explicit clause that the daemon lock token is a same-user ownership capability, never a credential, and is permitted **only** in the three control-frame payloads and the durable lock/instance records; restate F-4/AC-F4-4 as "no credential value, credential token, secret material, prompt, body, transcript, diff, or provider payload" and make TC-WIRE-006's canary scope exclude the lock token while asserting it carries no credential-shaped value.

### R-04 [major][B] ac_quality / cross_artifact_consistency — `chg-GH-238-spec.md` AC-F4-1 (line 547), F-4 v0 (line 142), EVT-8 (line 333) vs Appendix B (line 675), AC-F16-1 (line 574), C-2 (line 164); `chg-GH-238-test-plan.md` TC-WIRE-001 step 2, TC-WIRE-002 step 2; `chg-GH-238-plan.yaml` S-1/S-3

Gap: Three spec contradictions are reported and "resolved" only in the plan header, while the spec ACs and test-plan steps that a coder/tester must satisfy remain unchanged:
1. AC-F4-1 says "every frame carries ... `callerPrincipal`", while F-4 v0 and TC-WIRE-002 accept "the v1 shape without the additive reserved fields". TC-WIRE-001 step 2 also asserts every frame fixture carries it.
2. EVT-8's closed type list includes `query`, while Appendix B types query requests as `status`/`lane` and event frames as `frame`/`degraded`; TC-WIRE-001's fixture precondition mixes interaction classes and wire types.
3. AC-F16-1 says "no existing ... payload shape changed" while the same sentence requires the additive `callerPrincipal` on existing intent records (C-2).
The plan's S-1/S-2/S-3 are good analysis, but a plan header is not the contract; two artifacts still disagree.

Suggested remediation target phase: **specification** (with **test_planning** for TC-WIRE-001)
Suggested fix: Restate AC-F4-1 as "v1 frames carry `callerPrincipal`; v0 frames omit the additive reserved fields"; make EVT-8's type list exactly Appendix B's set and state that `query` is an interaction class; restate AC-F16-1 as "no schema id, required field, required key, collector id, or breaking payload shape changes; the only additive changes are the optional `callerPrincipal` and the `--watch` flag". Align TC-WIRE-001's fixture list.

### R-05 [major][B] spec_completeness / cross_artifact_consistency — `chg-GH-238-spec.md` C-2 (line 164), AC-F4-5 (line 551), EVT-7 (line 332), Appendix D outbox bullet (line 716); `chg-GH-238-test-plan.md` TC-VOCAB-004; `chg-GH-238-plan.yaml` task 1.4

Gap: C-2 names `outbox.effect` as an intent record kind that must carry the additive optional `callerPrincipal`, and AC-F4-5 requires "any intent record ... produced by this change" to carry it. EVT-7 and Appendix D's `outbox.effect` field list omit it, and plan task 1.4 defines the `OutboxEffectRecord` shape without it. TC-VOCAB-004 preconditions list `outbox.effect` and step 1 asserts the field on "each intent kind" — so the test plan requires a field the plan and Appendix D do not create. This is a binding pinned-decision gap, not a style issue.

Suggested remediation target phase: **specification** (with **delivery_planning** for task 1.4)
Suggested fix: Add `callerPrincipal?` to EVT-7, the Appendix D `outbox.effect` bullet, and plan task 1.4's shape, with the same optional/backward-compatible rule as the other intent kinds; keep TC-VOCAB-004 as written.

### R-06 [major][B] cross_artifact_consistency / decision_capture — `chg-GH-238-spec.md` AC-F3-1 (line 545), OQ-5 (line 476); `chg-GH-238-test-plan.md` TC-STATE-003 steps 1–3; `chg-GH-238-plan.yaml` tasks 4.6, 6.2

Gap: AC-F3-1's Given includes `blockers answer`, and its Then says "when `daemon start` later runs, reconciliation sees each intent and **applies it exactly once** with zero loss". The ticket AC likewise says blocker-state mutations are "applied on reconcile with zero loss". Plan task 4.6 instead records that blocker answers "remain `applied: false`; the safe-boundary application call lands with lane supervision (Phase 6)", i.e. they are applied only when a lane exists and reaches a boundary. OQ-5 is still marked "Decision needed: consult `@decision-advisor` before M1-S9", yet the plan pins the answer in its header with no decision record and no PM acknowledgement. TC-STATE-003 quietly weakens the AC to "one blocker **application intent**". With no lane, the answer is never applied. A DoD reading of the ticket would fail.

Suggested remediation target phase: **specification** (with **test_planning** and, if the task text changes, **delivery_planning**)
Suggested fix: Define what "applied" means for a blocker answer and pin it consistently: if the full resume remains M1-S9, restate AC-F3-1/OQ-5 as "the answer is durably visible, remains `applied: false`, and is applied at the next safe boundary **when a lane exists**; full resume is M1-S9", record the PM acknowledgement in `pm-notes`, and rewrite TC-STATE-003 to assert the specified behaviour (not an "intent"). Alternatively, implement the reconciliation application path in this change.

### R-07 [major][B] system_spec_consistency / spec_completeness — `chg-GH-238-spec.md` F-1 (line 139), F-15 (line 153), AC-F15-1 (line 572); `chg-GH-238-test-plan.md` TC-INSTALL-001 step 2; `chg-GH-238-plan.yaml` tasks 10.1/10.3

Gap: The ticket requires the daemon to "run under a real process supervisor (systemd or equivalent)" and "an installed login unit starts the daemon". `daemon start` with no flag "returns after readiness and leaves the daemon resident" (F-1), and `--foreground` "keeps the process attached" (F-1, TC-LIFE-007). The artifacts never pin which form the systemd unit uses: TC-INSTALL-001 only asserts "uses the daemon start command", and F-15/plan task 10.1/10.3 say nothing about `--foreground` or `Type=`. A unit whose `ExecStart` is the default `daemon start` exits at readiness after spawning a detached child; under `Type=simple` systemd then considers the unit exited (or restarts it), so the daemon is not actually supervised and the login-start claim is not proven. AC-F15-1 does not test residency, only unit installation and linger.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: Pin the unit command form (`ExecStart=<binary> daemon start --foreground`, or the `daemon-main` entry) and the service type (`Type=simple`, restart policy) in F-15/AC-F15-1 and the daemon contract; add a TC-INSTALL assertion that the unit command is the foreground entry and that the installed unit keeps the daemon resident, while the default `daemon start` remains the interactive spawn-and-return form.

### R-08 [major][B] plan_coverage / dod_defined — `chg-GH-238-plan.yaml` header "all 100 TCs are mapped" / task 11.8; `chg-GH-238-test-plan.md` TC-META-001 (index line 359, detail line 2836, NFR-17 row line 226)

Gap: The plan's header claims "all 100 TCs are mapped onto Phases 1-12", and task 11.8's PR-ready checklist requires "100/100 TCs with a recorded result or a named gap". Exactly **99** distinct TC ids appear in the twelve phases' `coverage`: `TC-META-001` (the mutation/fixture meta-test that proves the key assertions fail when their rule is broken) is absent. Phase 11's gate runs `tests/checks/daemon-mutants.test.ts`, but no phase declares the TC, so its result cannot be tracked and the plan's own traceability invariant is false. This is the non-vacuity guard for NFR-1/NFR-3/NFR-4/NFR-17.

Suggested remediation target phase: **delivery_planning**
Suggested fix: Add `TC-META-001` to Phase 11's `coverage` (or Phase 1 with a "completes in Phase 11" note) and correct the header/DoD count; keep the existing `daemon-mutants` gate.

### R-09 [major][B] plan_coverage — `chg-GH-238-plan.yaml` Phase 1 `coverage` TC-VOCAB-004/008, Phase 3 TC-CONC-002, Phase 4 TC-RECON-006, Phase 5 TC-DEGRADE-003 vs each TC's Target Layer in `chg-GH-238-test-plan.md`

Gap: The plan header promises "no TC is marked 'full' before its real surface lands", but the flags are premature for at least:
- **TC-DEGRADE-003** is "full" in Phase 5, while its step 5 requires `tests/golden/daemon-status-matrix.test.ts`, which Phase 9 scope creates; Phase 5's gate does not run it.
- **TC-VOCAB-004** and **TC-VOCAB-008** are "full" in Phase 1, while their behavioural target `tests/behaviour/daemon-state-mediation.test.ts` is created in Phase 4 (and `daemon-hermetic.test.ts` in Phase 3).
- **TC-CONC-002** is "full" in Phase 3, while its second target `tests/behaviour/daemon-state-mediation.test.ts` is Phase 4.
- **TC-RECON-006** is "full" in Phase 4, while its `tests/behaviour/blockers-publish.test.ts` target is modified in Phase 6 and its digest assertion depends on that surface.
This is the same phase-surface split defect the plan header claims to have avoided; the Phase 5/Phase 1 "full" labels cannot be satisfied by the named phase gate.

Suggested remediation target phase: **delivery_planning**
Suggested fix: Re-mark these rows Partial in the earlier phase with the completing phase named (Phase 9 for TC-DEGRADE-003, Phase 4 for TC-VOCAB-004/008 and TC-CONC-002, Phase 6 for TC-RECON-006), or move the target suites into the earlier phase and run them in that phase's gate.

### R-10 [major][B] plan_coverage / plan_code_area_coverage — `chg-GH-238-plan.yaml` Phase 9 scope and `testGate` (lines 1284–1314, 1403–1408), task 9.4 (lines 1355–1361); delivered `tests/golden/lanes-watch-refusal.test.ts` + `tests/fixtures/queue/golden/lanes-watch-refusal.json`

Gap: Task 9.4 says "Update the delivered watch-refusal golden to the new accepted/degraded behaviour", but Phase 9 neither declares `tests/golden/lanes-watch-refusal.test.ts` nor its fixture in `scope.files`/`scope.folders`, and the Phase 9 gate does not run it. The delivered suite asserts `--watch` exits 1 with `fallback.invocation` and a resident-daemon hint (lines 22–38 of the test); once `--watch` is accepted, that suite fails. The phase can therefore be "green" only by editing an undeclared file, and a coder following the scope literally will leave a red suite until Phase 11. The new `tests/golden/watch-refusal-absent.test.ts` does not cover the old assertion.

Suggested remediation target phase: **delivery_planning**
Suggested fix: Add `tests/golden/lanes-watch-refusal.test.ts` and `tests/fixtures/queue/golden/lanes-watch-refusal.json` to Phase 9 scope and gate, and state explicitly whether the file is replaced/renamed or updated to the new accepted/degraded golden; keep `watch-refusal-absent` only if it has a distinct assertion.

### R-11 [major][N] plan_code_area_coverage — `chg-GH-238-plan.yaml` Phase 1 scope (lines 236–268) vs task 1.1 (lines 289–298)

Gap: Task 1.1 explicitly changes `packages/core/src/app/queue.ts` (queue payload builders/readers) and `packages/core/src/state/blockers.ts` (blocker key allow-lists, shapers, read validators). Phase 1 scope declares neither: `app/queue.ts` is declared in **no** phase, and `state/blockers.ts` appears only in Phase 4's scope. The blast radius of the first committable slice is therefore under-declared, and a reviewer following scope would miss two production edits.

Suggested remediation target phase: **delivery_planning**
Suggested fix: Add `packages/core/src/app/queue.ts` to Phase 1 scope and add `packages/core/src/state/blockers.ts` to Phase 1 (or move task 1.1's blocker-write changes to Phase 4 and say so).

### R-12 [major][N] plan_coverage / gate hygiene — `chg-GH-238-plan.yaml` Phase 7 gate (line 1194), Phase 6 gate (lines 1086–1090), Phase 6 task 6.6

Gap: Phase 7's gate runs `bun test tests/behaviour/commit-act.test.ts tests/...`. That path does not exist in the tree and **no task** describes creating it; the delivered commit suites are `commit-command.test.ts`, `commit-convergence.test.ts`, `commit-telemetry.test.ts`, etc. A missing test path makes the gate fail (or invites an empty stub that makes it vacuous). Separately, Phase 6 task 6.6 modifies `tests/behaviour/blockers-publish.test.ts`, but the Phase 6 gate does not run it. Both are phase-gate completeness defects.

Suggested remediation target phase: **delivery_planning**
Suggested fix: Point the Phase 7 gate at the existing commit suite(s) or add an explicit task defining `commit-act.test.ts`; add `tests/behaviour/blockers-publish.test.ts` to the Phase 6 gate.

### R-13 [minor][N] cross_artifact_consistency — `chg-GH-238-test-plan.md` front matter `implementation_plan: null` (line 13), §7 (line 2923), §7.1 (line 3030), §8.1 T-RSK-9 (line 3083), and several TC Target Layer lines

Gap: The test plan still says the implementation plan "is not yet authored", makes the spec's §18 order "the sequencing authority", and maps TCs to speculative stages 1–9, while the delivered plan is 12 phases and explicitly "supersedes the spec's §18 narrative order". Several TC Target Layer paths are never created by the plan: `tests/golden/daemon-status.test.ts` (TC-LIFE-003), `tests/golden/daemon-status-live.test.ts` (TC-LIFE-005), `tests/golden/watch-degraded.test.ts` (TC-WATCH-003); the plan's corresponding files are `daemon-lifecycle.test.ts`, `daemon-degradation.test.ts`, and `daemon-status-matrix.test.ts`/`watch-*`. A coder following the test-plan paths creates unplanned files or misses planned ones.

Suggested remediation target phase: **test_planning**
Suggested fix: Reconcile §7/§7.1/§8.1 with `chg-GH-238-plan.yaml` phases 1–12, set `links.implementation_plan` to the plan, and align every TC Target Layer with the plan's declared files (or add the missing files to the plan scope in the same edit).

### R-14 [minor][N] ac_quality / test correctness — `chg-GH-238-spec.md` F-17/DM-13 (line 354), AC-F17-1 (line 575); `chg-GH-238-test-plan.md` TC-MERGEABS-002 step 3

Gap: TC-MERGEABS-002 step 3 asserts "injecting a merge executor changes the computed value", but the spec defines only `mergeCodePath: "absent"` and no complement/other value, and NFR-14 makes value sets closed. The test either asserts an undefined value or must observe an inequality whose allowed value is unspecified; the mutation test is therefore not a complete oracle.

Suggested remediation target phase: **specification**
Suggested fix: Define the complement (e.g. `"present"`, with a classified reason) or reword the TC to assert the computed value is not `"absent"` when a merge executor is injected, and state that the value is a closed set in DM-13/NFR-14; add the matching boundary failure fixture.

### R-15 [minor][N] ac_quality / test correctness — `chg-GH-238-spec.md` F-5 (line 143), Appendix F (line 756); `chg-GH-238-test-plan.md` TC-TRANSPORT-002 step 3, TC-TRANSPORT-003 step 2

Gap: F-5 says a cross-user connection is "refused with a classified error", but no identity is named and the `daemon` row set is closed at eight rows with no permission row. TC-TRANSPORT-002 step 3 only asserts "a classified error", which is not falsifiable against a specific identity. Separately, TC-TRANSPORT-003 step 2 says an outside socket path exits "1/2 per the delivered config projection", but `config.value.invalid` is a user row projecting `user-validation` → exit 1; a hedged oracle lets either pass.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: Name the cross-user refusal identity explicitly (reuse `state.permission.denied` at exit 1 or add a row and raise the closed count deliberately), and pin `config.value.invalid` to exit 1 in TC-TRANSPORT-003.

### R-16 [minor][N] spec_completeness / privacy — `chg-GH-238-spec.md` §20 (line 595) vs Appendix C (line 689) and `chg-GH-238-test-plan.md` TC-LIFE-001 step 4 / TC-TRANSPORT-002 step 5

Gap: §20 says the socket path "is rendered only by local `daemon status` output and is never persisted to ... a golden", while the `daemon start` envelope in Appendix C carries `socket` (`path`, `transport`, `reachable`) and TC-LIFE-001 asserts that envelope. TC-TRANSPORT-002 step 5 forbids the path in a golden, so a deterministic start/status golden must normalize or omit a field the AC requires. The rule is inconsistent with the surface it governs.

Suggested remediation target phase: **specification**
Suggested fix: Either narrow §20 to "never persisted to a state record, log line, telemetry event, or a golden **un-normalized**" and define the golden placeholder (e.g. `<state-dir>/daemon.sock`), or remove the path from the `start` envelope and keep it only in `status`; align TC-LIFE-001/TC-TRANSPORT-002.

### R-17 [minor][N] system_spec_consistency / privacy — `chg-GH-238-spec.md` DM-1 (line 342), §20 (line 595), AC-F2-3; `chg-GH-238-plan.yaml` tasks 2.1–2.3 (lines 443–466)

Gap: §20 says the durable instance record stores "a state-directory scope identifier, not an absolute path", while DM-1 calls it "state-directory scope" and the plan's lock/instance tasks carry `scope` without pinning its derivation. If the coder uses the directory path, the instance/lock records violate the declared privacy invariant; if it uses a hash, the reconciliation-to-directory mapping is unspecified. TC-PRIVACY-001 step 3 asserts the invariant but not its derivation.

Suggested remediation target phase: **delivery_planning** (or **specification** if the scope id is contract-level)
Suggested fix: Pin the scope identifier as a stable non-path value (e.g. a digest of the canonical state-dir path with a declared derivation), state where the path→scope mapping is recoverable, and add the assertion to TC-PRIVACY-001/TC-LIFE-001.

### R-18 [nit][N] ac_quality / cross_artifact_consistency — `chg-GH-238-spec.md` AC-F2-2 (line 543); `chg-GH-238-test-plan.md` TC-LOCK-003; test-plan summary line 10 and `chg-GH-238-plan.yaml` line 1604

Gap: AC-F2-2's Given is "a lock whose heartbeat age is at or beyond `daemon.lock-staleness`" (stale), then its second clause says "when the lock is live, then takeover is refused with `daemon.takeover-refused`". A `daemon start` against a live lock returns `daemon.already-running` (AC-F2-1); `daemon.takeover-refused` is reachable only through the `takeover` control frame/state path (TC-LOCK-003). Separately, the test-plan summary says "six seeded scenarios" but lists seven ids (14/15/16/17/17b/18/20), and the plan repeats "six" while listing seven.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: Split AC-F2-2's live-lock clause into a `takeover` control-frame/state-path Given/When/Then (or state race semantics), and correct the seed count to seven (or name which one is not a seed).

### R-19 [minor][N] plan_code_area_coverage / architecture — `chg-GH-238-plan.yaml` task 3.4 (lines 583–590)

Gap: Task 3.4 places "an in-memory pair for tests (not production code)" inside `packages/adapters/src/daemon/transport.ts`, which is exported through the published `@delivery-os/adapters/daemon` subpath. Test doubles in a production package violate the repo's fixtures convention (`tests/fixtures/daemon/transport` is already declared) and risk becoming public API or an exports-parity/inventory exception. The phrase "not production code" does not change where it lives.

Suggested remediation target phase: **delivery_planning**
Suggested fix: Keep `packages/adapters/src/daemon/transport.ts` to the production transport binding and move the in-memory pair to `tests/fixtures/daemon/transport/` (declared in the same phase), with the conformance suite importing the fixture.

## Previous Finding Status

None — this is readiness-review iteration 1; there are no prior readiness records for GH-238.

## Reopen Targets

| Artifact phase | Findings | Required? |
|---|---|---|
| `specification` | R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-14, R-15, R-16, R-18 | Yes — blocking contracts/ACs (R-01..R-07) |
| `test_planning` | R-01, R-02, R-04, R-06, R-07, R-13, R-15, R-18 | Yes — assertion/oracle corrections tied to the spec fixes |
| `delivery_planning` | R-05, R-08, R-09, R-10, R-11, R-12, R-17, R-19 | Yes — coverage, placement, and code-area corrections |
| `delivery` | none | Not reopened by this gate. |

`delivery` is not a valid remediation target and is not reopened. Re-run this gate after the authors revise the artifacts; the same blocking gaps are expected to close in one iteration except R-01/R-02/R-06, whose resolution may require a PM decision (record it in `pm-notes` and re-run).

## Decision Routing

- R-01 (mutating wire request vs state-path idempotency), R-02 (commit crash-safety mechanism), and R-06 (blocker-answer application timing) can be resolved either by delivering the missing mechanism or by narrowing the ticket/spec clause with an explicit PM/human acknowledgement recorded in `chg-GH-238-pm-notes.yaml` (`change` scope). No `needs_human_input` pause is raised now because the artifact authors can implement the mechanism without a human decision.
- If the commit identity design becomes a system-level contract affecting M1-S9, route it to `@decision-advisor` for a decision record rather than leaving it in a plan header.
- No new system/precedent decision record is required for the remaining findings; they are change-scoped contract corrections.

## Verification Notes (not findings)

- **Plan validator**: `validatePlan` + the real `parseConfigYaml` path returns `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, `truncated: false`; all 12 phases echo `kind: delivery`, `lease: lease-taking`, and the declared weight classes (`heavy` for 4/5/6/7/9/11/12, `standard` for 1/2/3/8/10). The validator checks schema/shape, not coverage; the coverage defects above are outside its remit.
- **Counts**: spec 36 ACs, 18 NFRs, 17 capabilities, 9 events, 16 data-model elements, 13 decisions, 13 risks, 6 open questions, 10 appendices. Test plan 100 TCs (index = details = automation). Plan 83 tasks; 36 distinct ACs in phases 1–10 (all before closure); 99 distinct TC ids in `coverage` (R-08). The plan's `acCoverage` union is 36 because Phase 12 enumerates all of them as a closure safety net.
- **Gate paths**: every path named in a phase gate exists or is declared in a phase scope except `tests/behaviour/commit-act.test.ts` (declared in Phase 7 scope but described by no task, R-12) and the undeclared `lanes-watch-refusal` golden (R-10). `scripts/checks/{error-table-sync,workspace-entrypoints,privacy-literals}.ts` and `scripts/.tests/test-doc-distribution.sh` exist.
- **Delivered commit proof**: `packages/core/src/domain/commit-act.ts` `runCommitAct` stages, safety-scans, commits, then appends the transition/telemetry; the only crash protection is the in-process `resetTo(baselineHead)` on a failed append. `packages/core/src/contracts/commit.ts` exposes `commitExists` and `classifyCommitDelta`; `packages/cli/src/edge.ts` reads durable evidence and explicitly refuses to infer commit presence from HEAD. `packages/cli/src/commands/phase.ts` treats `delta.state === "neither"` as the normal path and returns `recordOnly("skipped-no-pending-work")` when the act has no pending work. No pre-commit SHA identity or orphan-detection query exists — the basis for R-02.
- **Delivered watch refusal**: `packages/cli/src/commands/queue.ts` line 216 and `packages/cli/src/commands/lanes.ts` line 43 define `watchRefusal`; `tests/golden/lanes-watch-refusal.test.ts` asserts exit 1 with `fallback.invocation` and the resident-daemon hint. Accepting `--watch` necessarily invalidates that suite — the basis for R-10.
- **Delivered state/config facts**: `BOARD_COLLECTOR_IDS = ["tracker","lanes"]`; `QUEUE_LANE_STATES = ["delivering","idle-with-reason","parked","merge-ready","in-review","failed"]`; `lane.liveness-interval = 30000` / `lane.restart-budget = 3`; `resolveConfig` is the current resolver and the plan's new `resolveDaemonSettings`/`resolvePollSettings` follow the `lane` precedent; `DOMAIN_KINDS` already includes `dispatch`/`queue` and adding `daemon` is additive; all current `transient` rows project `platform-provider`, while projection classes are per-row fields (so `daemon.takeover-refused`'s exit-1 projection is legal, though it diverges from every existing transient row — noted, not raised as a finding).
- **Doc-sync accuracy**: `doc/spec/features/feature-scheduling-engine.md` still records "no production composition root" (lines 257–259) and the `--watch` refusal (lines 154–156, 342, 347–348), so Phase 11's tasks 11.2/11.3 target real current-truth text. `doc/spec/features/feature-adapter-ports.md`, `feature-watchdog-lane-contracts.md`, and `feature-queue-ready.md` exist. `.changeset/config.json` fixes the five packages the plan names.
- **No override record** was needed or used; the change is behavioral and contract-bearing. No privacy/credential-shaped literal was introduced by this verdict.

## Accepted Non-Blocking Residuals

These are declared, bounded, and accepted; they are not findings:

- **Algorithmic, not OS-level, concurrency** (GAP-T1): 100-start and 100-subscriber proofs are deterministic interleavings; one bounded real-child smoke covers start/stop only. Accepted for hermeticity (NFR-7).
- **Environment-sensitive latency** (GAP-T3): NFR-6's 50 ms p99 is measured on the reference CI class; the structural properties (bounded buffer, one degraded event, continued service) are asserted independently.
- **Real cross-user kernel refusal and real systemd/launchd/Windows managers are not exercised** (GAP-T2, GAP-T4): the permission policy, unit content, and adapter outcomes are asserted through injected seams; actual OS enforcement is operations verification.
- **No production tracker/VCS write adapter** (RSK-9): the effect protocol is proven over injected adapters; commits are the only production effect adapter and the commit crash window is subject to R-02.
- **`daemon install` linger failure reuses `daemon.supervisor-unsupported`** (OQ-T1/S-8): tested as written; the semantic conflation is flagged to the spec owner.
- **Heartbeat `laneCounts` uses the separate `{delivering, idle, parked, failed}` count set** (S-6) while the lanes projection uses `idle-with-reason`: declared as a separate closed set; no vocabulary redefinition.
- **`daemon.preemption.withdrawn` is declared but never written** (S-4): accepted as a read-only declared state with no cancellation trigger; not a sixth record kind.
- **Deferred scope is explicit**: M1-S9 dispatch/handover, remote transport (M4-S6), `status --watch`, launchd/Windows adapters, and lane-scoped authorization are NG-1..NG-6/NG-10 with named owners; not leakage.
