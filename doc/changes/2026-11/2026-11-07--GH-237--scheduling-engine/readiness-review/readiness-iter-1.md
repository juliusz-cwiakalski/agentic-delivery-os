# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-237 (M1-S17: Scheduling engine: queue, lanes, dependency batching)
Date: 2026-11-07
Pause Required: no

## Gate Summary

- Artifact set reviewed: `chg-GH-237-spec.md` v1.1, `chg-GH-237-test-plan.md` v1.1, `chg-GH-237-plan.yaml` (delivery.plan.v1), `chg-GH-237-pm-notes.yaml`, ticket GH-237, the M1 design pack, and the delivered specs/code the change builds on.
- Findings: 14 — **2 critical, 8 major, 4 minor** (plus 2 nits recorded inside minor entries). **8 blocking** (`B`), 6 non-blocking (`N`).
- Facets failing: `spec_completeness`, `ac_quality`, `plan_coverage`, `cross_artifact_consistency`, `system_spec_consistency`.
- Reopen targets: **specification** (R-01, R-03, R-04, R-05), **test_planning** (R-06), **delivery_planning** (R-07). Never `delivery`.
- The Definition-of-Ready override is **not** available: the change adds and alters behavior, introduces contracts (five record kinds, five error rows, a configuration branch), and changes the delivery workflow's command surface.
- Pause is **not** required. Two items need PM/human acknowledgement but are change-scoped decisions already recorded in `chg-GH-237-pm-notes.yaml` (see R-08 and the decision-routing note), not `needs_human_input` blockers.

Structural checks that passed (so the verdict is about substance, not bookkeeping):

- The plan **validates** through the repository's own validator (`validatePlan` + the edge's `parseConfigYaml` wrapper): `verdict: "valid"`, `readyForDevelopment: true`.
- 65 TCs declared in the index, 65 scenario details, no orphan in either direction; all 65 appear in plan `coverage`; no TC is marked "full" in two phases; 22 ACs (incl. the AC-F3-1(a)/(b) split) appear in both spec and test plan; all 14 NFRs are traced; all six seeded scenarios are mapped.
- Every substrate path the plan asserts exists in the tree (`contracts/queue-ready.ts`, `domain/queue-ready.ts`, `cli/commands/queue.ts`, `contracts/state.ts`, `state/merge.ts`, `contracts/plan.ts`, `domain/plan-validate.ts`, `domain/plan-overlap.ts`, `contracts/verify-deploy.ts`, `domain/verify-deploy.ts`, `contracts/economics.ts`, `domain/economics-view.ts`, `config/{catalog,schema,defaults}.ts`, `contracts/owner-gate-sla.ts`, `cli/edge.ts`, `tests/fixtures/state/harness.ts`, `tests/structure/inventory.json`, `tests/types/`).
- Delivered contract facts the artifacts rely on were verified: `QUEUE_READY_CONDITION_ORDER` / `_CONDITION_STATES` / `_EVIDENCE_REASONS` exist with the stated ids, order, tri-state and reason tokens (`addressing-unresolved`, `remote-unsupported`, `dependency-open`, `dependency-unobserved`, …); `BOARD_COLLECTOR_IDS = ["tracker"]`; `MERGE_DEPLOY_EXPECTATIONS_KEY = "merge.deploy-expectations"`; error categories/consequences/projection classes support Appendix F (`transient`, `not_landed`, `user-validation` are per-row fields, so a `platform` row may project to exit 1); timing defaults match `contracts.md` (90 s / 60 s / 300 s); `resolveLaneSettings` is the exact precedent for the planned `resolveQueueSettings`; `createQueueReadyCommandDefinition` and `options.queueReady` exist as the plan states.
- The three pinned decisions are carried as DEC-1..DEC-4 and contradicted nowhere: single-flight as the only structural cap with weight as a resource class (DEC-1, AC-F3-2, TC-LEASE-009/TC-WEIGHT-003), fence-token leases with stale takeover and daemon-down mutual exclusion (DEC-2, AC-F4-1, SC-M1-17b), per-type park recheck with recorded recovery and a classified stuck park (DEC-3, AC-F8-1/8-2), close-first and producer-first with deploy-verified gating (DEC-4).
- The declared scope boundaries are honest and mutually consistent: dispatch/session is NG-1 and consumed-by M1-S9; daemon/NDJSON/`--watch` streaming is NG-2/NG-3 with `--watch` refused through `fallback.invocation` (DEC-7); preemption execution is deferred with an explicit `queue release --park` (F-7, AC-F7-2); `queue ready` is preserved (NG-4, AC-F12-1); the battery is hermetic and concurrency is fixture/injected-clock proven (NFR-7, GAP-T3). The baseline divergences are named rather than smoothed over (DEC-6 claim/release not in the baseline synopsis; DEC-8 ref-as-lane-identity; RSK-9 stale digest story).

## Facet Summary

- spec_completeness: **FAIL** — the closed park-cause vocabulary is never enumerated while a closed set is mandated (R-02); the repository-root discovery that C-6/AC-F6-2 depend on is undefined (R-03); the stuck-park entry's schedule status is undefined (R-04); a claim's refusal ordering is self-contradictory (R-01).
- ac_quality: **FAIL** — AC-F3-1(b)/AC-F4-1 conflict with F-4's stated claim pipeline on the refusal identity (R-01); AC-F8-1's "within one recheck interval of T" is unsatisfiable on the no-engine path it also declares recovery for (R-09); AC-F1-1's "project with no queue state" presupposes queue state (R-10).
- plan_coverage: **FAIL** — TC rows marked "full" in Phases 3–5 require the `queue` command family that lands in Phase 7 (R-06), so those phase test gates are not achievable as sequenced.
- test_traceability: **PASS** — 65/65 TCs mapped, 22/22 ACs traced, 14/14 NFRs traced, six seeds mapped, no orphan in either direction. (The defects found are assertion correctness and phase placement, tracked under `cross_artifact_consistency` and `plan_coverage`.)
- cross_artifact_consistency: **FAIL** — NFR-3/TC-LEASE-002's "49 refusals" is unsatisfiable against F-4 and TC-LEASE-013's renewal rule (R-07); the plan conflates park causes with condition types, which rejects AC-F7-2's own park cause (R-02); the ticket's one-shot execution clause is narrowed in the spec without an approver (R-08); the spec/test-plan delivery order omits the CLI phase the plan inserts (R-13).
- decision_capture: **PASS** — DEC-1..DEC-13, OQ-1..OQ-12 dispositions and the PM scope/decision record are in the right places. R-08 asks for an explicit PM/human acknowledgement of the narrowed one-shot clause (change-scoped, already recorded; not a new system decision).
- system_spec_consistency: **FAIL** — F-11 attributes a "delivered lanes contract set" that is not the delivered lane vocabulary and silently adds `failed` (R-11); the status digest keeps a stale expected-story reference with no owner or follow-up record while the engine now exists (R-12).
- plan_doc_update_coverage: **PASS** — Phase 8 lists the new feature spec, the eight neighbour specs, the queue/lanes command docs, the CLI registry, the glossary, the changeset, and the distribution-marker guard; the digest is deliberately excluded (NG-10). R-12 asks only for an owner/ticket for the flagged follow-up.
- plan_code_area_coverage: **PASS** — every phase declares files and folders, and the declared substrate exists. R-14 (inventory registration) is the one shared file the phase scopes never name.
- dod_defined: **PASS** — 22 ACs, 14 NFRs, measurable §4.1 zero-tolerance metrics, plan task 8.8's DoD checklist and typed `doneArtifacts` form a testable definition of done.

## Findings

Ordered by severity. `B` = blocking (must be fixed in an artifact phase before delivery starts); `N` = non-blocking (may be handled in delivery or accepted as risk).

### R-01 [critical][B] spec_completeness / ac_quality — `chg-GH-237-spec.md` §5.1 F-4 (and §5.2 C-2, AC-F3-1(b), AC-F4-1) vs `chg-GH-237-test-plan.md` TC-LEASE-001 step 4, TC-LEASE-005 step 1, TC-LEASE-012

Gap: F-4 states the claim "evaluates parks and readiness first, then acquires the state fence", and that "claiming an entry that is not ready ... refuses with `queue.precondition.unmet`". `repo-free` is one of the six readiness conditions (F-2) and is sourced from lease truth. A claim on a repository whose live lease is held by another holder is therefore "not ready" and must refuse `queue.precondition.unmet` (category `user`, not retryable) under that sentence — yet the same paragraph and C-2 say a live lease by another holder, and "repeated claims", refuse `queue.lease-conflict` (category `transient`, retryable). TC-LEASE-005 asserts exactly that latter outcome for a sequential claim against a live lease; TC-LEASE-012 asserts the former for other gates. An implementer must guess whether `repo-free` is evaluated pre-fence (precondition) or only as an in-fence lease read (conflict); the two ACs cannot both hold for the same call.

Suggested remediation target phase: specification
Suggested fix: Pin the claim pipeline explicitly: either (a) the claim's pre-fence evaluation excludes `repo-free` and the in-fence lease read owns the refusal (`queue.lease-conflict` proven), or (b) keep `repo-free` in the pre-fence evaluation and state that a `repo-free` failure caused by another holder's live lease projects as `queue.lease-conflict`, not `queue.precondition.unmet`. Restate AC-F3-1(b)/AC-F4-1 to match, and confirm TC-LEASE-005/TC-LEASE-012 stay aligned.

### R-02 [critical][B] spec_completeness / cross_artifact_consistency — `chg-GH-237-spec.md` F-8, DM-5, DM-10, NFR-14, Appendix C/E/F vs `chg-GH-237-plan.yaml` task 1.1 and task 7.1

Gap: F-8, DM-5 and NFR-14 declare a **closed park-cause** set, but the spec never enumerates causes — it enumerates only the three *condition types* (`provider-window`, `provider-quota`, `preemption`). The only concrete cause in the whole artifact set is DM-10/AC-F7-2's `preempted-for-close-item`, which is not in the enumerated set. The plan then pins "park causes and condition types {provider-window, provider-quota, preemption}" as one closed set (task 1.1) and instructs task 7.1 to validate `--park <cause>` against a "closed park cause". Followed literally, `queue release GH-311 --park preempted-for-close-item` (AC-F7-2, TC-RANK-004, TC-LEASE-011, Flow 6) is an invocation rejection, and TC-VOCAB-005's closed-set inventory has no legal value for it.

Suggested remediation target phase: specification
Suggested fix: Declare two distinct closed sets: the cause set (including `preempted-for-close-item` and the cause for each provider condition) and the condition-type set, state the valid cause↔condition pairing, and amend Appendix C/E and NFR-14 to reference both. Update the plan's task 1.1/7.1 wording accordingly.

### R-03 [major][B] spec_completeness / system_spec_consistency — `chg-GH-237-spec.md` F-6 and §5.2 C-6 (AC-F6-2, DEC-13), §12 assumptions

Gap: C-6 requires the producer's deploy expectations to be read "from the producer repository's own configuration ... resolved against the repository root whose normalized remote matches that key", and says a config that is "not discoverable" degrades to `unknown`. Nothing in the spec, the test plan, or the delivered config/state contracts defines the **search space** that makes a producer root discoverable: an entry records only the normalized repository key (DM-1/DM-12), the delivered repository binding is a single checkout's projection, the state directory has no repository registry, and the plan's Phase 7 edge task names no mechanism. In a multi-repository state directory the coder must invent a discovery rule (scan siblings? add a config key — which Appendix E forbids? record a root at declaration — not in DM-1?). Any choice is a contract decision the spec has not made, and the wrong one silently weakens or blocks a high-severity gate (RSK-6).

Suggested remediation target phase: specification
Suggested fix: Define the producer-root discovery contract (source of the root set, the match rule, and the fail-closed `unknown` path when the key maps to no root, no root declares expectations, or two roots collide), add it to DM-12/§12 and Appendix E if it is configuration, and give AC-F6-2 a testable statement for the "not discoverable" case.

### R-04 [major][B] spec_completeness / ac_quality — `chg-GH-237-spec.md` F-7, F-8, Appendix B steps 7 and 10, AC-F8-1 vs `chg-GH-237-test-plan.md` TC-PARK-002, TC-RANK-005 step 5

Gap: A park that a mutating pass observed clear but that never recovered is the `queue.park-condition-stuck` class; a claim on it refuses at exit 1 with zero appends. Its condition *has* cleared, so Appendix B step 7 ("Active park whose condition has **not** cleared") does not exclude it, and step 10 would rank it `resume-parked` (2) — i.e. it can appear in `nextActions` as a scheduled action that `queue claim` is forbidden to execute, and a no-ref `queue claim` could select it and then fail, contradicting C-4/AC-F4-3's "top-ranked **eligible** action ... when no action is eligible, `no-eligible-action`". The spec never states the stuck park's schedule status, and no TC covers it (TC-PARK-002 exercises reads and claim only).

Suggested remediation target phase: specification
Suggested fix: Add an explicit hard-exclusion step (or extend step 7/8) for an active park whose recovery has not landed, carrying the `queue.park-condition-stuck` finding and a blocking reason, and state that such an entry is never a `resume-parked` candidate and never selected by a no-ref claim. Add one TC row for "stuck park is not a next action".

### R-05 [major][B] cross_artifact_consistency — `chg-GH-237-spec.md` F-3, F-9 and AC-F3-1(a) vs Appendix B (the declared "single authoritative precedence order")

Gap: AC-F3-1(a) requires the read surface to show "exactly one eligible action per repository" and F-3 says a schedule over N repositories yields "up to N concurrent leases". Appendix B is declared the ambiguity-deleting contract, but its only single-flight mechanism is step 8 ("repository lease held by another live holder"). With no lease held, two ready entries in one repository are both excluded by nothing and both survive to the ordering steps — the implemented schedule would list two eligible repo-alpha actions, violating the AC. The rule that the first selection in a pass virtually consumes the repository (and the reason the second entry then carries) is stated nowhere, and the reason token for that case is not declared (step 8's `lease-held` presumes an actual lease).

Suggested remediation target phase: specification
Suggested fix: Add the projection step to Appendix B (at most one scheduled action per repository per pass; the remainder is held with a named reason — `lease-held` once a lease exists, and a declared in-pass token before that), and reference it from F-3/F-9 and AC-F3-1(a).

### R-06 [major][B] plan_coverage — `chg-GH-237-plan.yaml` Phases 3, 4, 5 `coverage` and `testGate` vs `chg-GH-237-test-plan.md` scenario details; `chg-GH-237-plan.yaml` task 7.1

Gap: Phases 3–5 mark TCs "full" whose steps invoke the `queue` command family (`queue plan`, `queue list`, `queue claim`, `queue release`, exit codes, `result=`, `selectedRef`, `degraded[]`), but that family is created in Phase 7 task 7.1 — the delivered `packages/cli/src/commands/queue.ts` exposes only `ready`, and Phases 3–5' scopes do not touch it. Concrete examples marked full before their surface exists: TC-SCHED-004 step 6 (P3), TC-RANK-001 steps 1/4 (P3), TC-LEASE-001 steps 1–4 (P4), TC-LEASE-005/006/010/012/013 (P4), TC-WEIGHT-004 (P4), TC-SCHED-010 (P4, an end-to-end plan→claim→release scenario), TC-PARK-001/002/007 and TC-RANK-004 (P5). The Phase 3/4/5 `testGate` commands therefore cannot pass as written without the coder front-loading undeclared Phase-7 scope, and the plan's own claim that halves are marked with their completing phase is not met for this split.

Suggested remediation target phase: delivery_planning
Suggested fix: Either (a) move the `queue` command-definition surface (grammar + envelope + exit projection for list/plan/add/prioritize/dep/claim/release) ahead of Phase 3, or (b) re-mark these TCs as "domain/state half in Phase N, command/envelope rows complete in Phase 7" exactly as the header promises, and make each phase's test gate name only the rows it can actually run.

### R-07 [major][B] cross_artifact_consistency / test correctness — `chg-GH-237-spec.md` NFR-3 vs `chg-GH-237-test-plan.md` TC-LEASE-002 steps 3–4 and TC-LEASE-013

Gap: TC-LEASE-002 seeds "50 claim attempts GH-320 alternate between two holders" and asserts "exactly 1 claim returns `result=claimed` and 49 return `queue.lease-conflict`". F-4 and TC-LEASE-013 establish that a claim by the holder that already owns the lease refreshes the heartbeat (`result=renewed`) and is **not** a conflict. With two alternating holders, roughly half of the losing attempts are made by the winning holder and must renew, so "49 refusals" is unsatisfiable; a test written to satisfy it would force an implementation that wrongly refuses same-holder renewal and would break TC-LEASE-013 (and TC-LEASE-005 step 5). NFR-3's "1 acquires and 49 refuse" is only true for 50 *distinct* holders.

Suggested remediation target phase: test_planning
Suggested fix: State 50 distinct holders (or distinct holder+process identities) in TC-LEASE-002's preconditions, or split the expectation: exactly 1 acquisition, N renewals by the winner, and the remainder `queue.lease-conflict`; align NFR-3's wording to the same holder model.

### R-08 [major][N] cross_artifact_consistency / decision_capture — ticket GH-237 Tasks ("one-shot mode: the queue computes the next action and a CLI one-shot executes it") and AC 6 ("the queue operates end to end without the daemon") vs `chg-GH-237-spec.md` §1, NG-1, DEC-6, Appendix A (SC-M1-17 row); `chg-GH-237-pm-notes.yaml` decisions[0]

Gap: The ticket/backlog sentence includes *executing* a delivery one-shot; the spec narrows "one-shot" to plan→claim→release and defers execution to M1-S9. The narrowing is disclosed (DEC-6, NG-1, Appendix A says "the executor is the scheduling step, not `dispatch`"), and it is consistent with M1-S9 existing as a separate story this change unblocks — but no approver or acknowledgement is recorded, and SC-M1-17's `dispatch <ref>` clause is not explicitly assigned to M1-S9 as an inherited assertion. A DoD reading of ticket AC 6 literally would fail the delivered behavior.

Suggested remediation target phase: specification
Suggested fix: Record in the spec/pm-notes that the SC-M1-17 "dispatch executes one-shot" clause is inherited by M1-S9 (naming it), and have the PM confirm the narrowed reading with the human owner. If the human requires execution here, reopen specification rather than delivery.

### R-09 [minor][N] ac_quality — `chg-GH-237-spec.md` AC-F8-1 and NFR-5 vs `chg-GH-237-test-plan.md` TC-PARK-005

Gap: AC-F8-1 says a mutating pass after T records the resume "within one recheck interval of T", while the same AC and F-8/TC-PARK-003 require the no-engine path (a gap of several intervals) to recover with a gap-naming incident and never be stuck. Read literally, the no-engine recovery violates the first clause. NFR-5 scopes the bound to "clears while a mutating pass runs", so the AC wording is the outlier; TC-PARK-005's "bound + 1 ms" case does not say which of the two rules it asserts.

Suggested remediation target phase: specification
Suggested fix: Scope the interval clause in AC-F8-1 to "when a mutating pass runs within one recheck interval of T" and state the gap case explicitly; make TC-PARK-005's bound+1 ms expectation explicit.

### R-10 [minor][N] ac_quality / spec_completeness — `chg-GH-237-spec.md` AC-F1-1 and F-1 vs `chg-GH-237-test-plan.md` TC-SCHED-001 preconditions

Gap: AC-F1-1's given is "a project with no queue state **and GH-302 already declaring a dependency on GH-301**" — the second clause is queue state. TC-SCHED-001 reconciles by seeding GH-302→GH-301 while GH-301 has no entry, which quietly requires a rule the spec never states: may a declared edge name a ref with no entry, and what does `deps-satisfied` report for it? (`dependency-unobserved` exists in the delivered vocabulary but is not bound to this case.)

Suggested remediation target phase: specification
Suggested fix: Restate AC-F1-1's given (seeded GH-302 edge) and state whether edges may target non-entry refs and how that edge is evaluated (naming `dependency-unobserved`).

### R-11 [minor][N] system_spec_consistency — `chg-GH-237-spec.md` F-11 and DM-11

Gap: F-11 calls `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`, `failed` "the delivered lanes contract set". It is not delivered: the M1 pack lists only five (no `failed`), and the delivered lane vocabulary in `doc/spec/features/feature-status-digest.md`/`packages/core/src/contracts/status.ts` is `{delivering, idle-with-reason, idle-no-reason}` — overlapping but not identical, and `lane.idle-no-reason` is declared dormant "until the lane engine lands" (this change). Two closed lane vocabularies now exist with no declared relationship.

Suggested remediation target phase: specification
Suggested fix: Replace "delivered" with the true provenance, declare `failed` as this change's additive value, and state the relationship between the `lanes` command's state set and the digest's attention-state set (and whether `lane.idle-no-reason` remains dormant after this change).

### R-12 [minor][N] system_spec_consistency / plan_doc_update_coverage — `chg-GH-237-spec.md` §16, §22, RSK-9; `doc/spec/features/feature-status-digest.md` line 167/195; `doc/planning/oss-tooling/cli-command-registry.md` status row; `chg-GH-237-plan.yaml` task 8.3

Gap: The digest spec will still say the `lanes-or-queue` section is `not-delivered` with expected story `M2-S1` and reason `engine-not-delivered` after this engine ships. The spec correctly declines to change it (NG-10) and "flags" it, but no owner or follow-up ticket/decision is named, so "flagged" is unactionable. Meanwhile plan task 8.3 updates the CLI registry row to say the gap is "now backed by the engine", which contradicts the digest spec's expected-story text rather than merely annotating it.

Suggested remediation target phase: delivery_planning
Suggested fix: Record the digest reconciliation as a named follow-up (owner + ticket/decision) in the spec §22/RSK-9 or pm-notes, and word the registry row so it does not assert a state the digest spec denies (e.g. "engine shipped; the digest's declared gap and its expected-story reference remain pending its own reconciliation").

### R-13 [minor][N] cross_artifact_consistency — `chg-GH-237-spec.md` §18 delivery order vs `chg-GH-237-test-plan.md` §7 implementation-order mapping vs `chg-GH-237-plan.yaml` Phases 7–8

Gap: Spec §18 and test-plan §7 both present a 7-step order ending "lane view → documentation reconciliation", with no CLI-surface step; the plan inserts Phase 7 (the whole `queue` command family, envelopes, exits, hermetic battery) between them. The plan header reconciles several other placement differences but not this one, so the "no oracle reshaped, only placement" claim is incomplete.

Suggested remediation target phase: delivery_planning
Suggested fix: Add one reconciliation line to the plan header naming the CLI-surface phase and why it is separate from the lane view, or align spec §18/test-plan §7 to the eight phases.

### R-14 [minor][N] plan_code_area_coverage — `chg-GH-237-plan.yaml` Phase 1 scope vs Phases 2–6 new source files

Gap: `tests/structure/inventory.json` must equal the actual `packages/**` TypeScript file set exactly, and `tests/structure/content-inventory.test.ts` requires a per-file executable allowance (verified by running the suite's logic: unlisted files fail equality; a data-only contract module may not declare a `const` without an allowance). Phases 2–6 add ~11 source files (`domain/queue-graph|readiness|weight|deploy-gate|rank|precedence|lease|park|lanes.ts`, `state/queue.ts`, `cli/commands/lanes.ts`) but only Phase 1 declares `inventory.json` / `content-inventory.test.ts`, and no phase task says to register them. Phase 1's gate runs the inventory test before those files exist; Phases 2–6 do not run it; Phase 8's `pnpm check` fails. The plan header promises shared files are named in task text, and these two are not. (The GH-234 precedent has the same shape, which makes this a recurring plan-tooling gap rather than a novel design error.)

Suggested remediation target phase: delivery_planning
Suggested fix: Add "register the files this phase creates in `tests/structure/inventory.json` with executable allowances in `tests/structure/content-inventory.test.ts`" to each of Phases 2–6 (or move those two files into every phase's scope) and keep the inventory test in the affected phase gates.

### R-15 [nit][N] test_traceability — `chg-GH-237-plan.yaml` Phase 1 `testGate`

Gap: `bun test ... tests/types/queue-scheduling.type-test.ts` cannot pass: files named `*.type-test.ts` do not match bun's test discovery, and an explicit path produces exit 1 ("Tests need `.test`, `_test_`, `.spec` or `_spec_`"). Verified with the existing `tests/types/economics.type-test.ts` (exit 1). `.ai/rules/testing-strategy.md` §49 also places compiled type probes outside the `*.test.ts` convention; GH-243's plan handles this correctly ("compiled by the existing typecheck via `tests/types/tsconfig.json`").

Suggested remediation target phase: delivery_planning
Suggested fix: Drop the type-test file from the `bun test` invocation and rely on `pnpm typecheck` (already the first gate line), matching the GH-243 pattern.

### R-16 [nit][N] test_traceability — `chg-GH-237-test-plan.md` TC-LANES-002 step 4

Gap: "Assert no synthetic a synthetic `L` ordinal identity is produced." Typo only; the assertion intent is clear.

Suggested remediation target phase: test_planning
Suggested fix: "Assert no synthetic `L` ordinal identity is produced."

## Claims Checked (verification notes, not findings)

- **Ticket coverage.** All six ticket acceptance criteria map through Appendix G to spec ACs and TCs: same-repo single-flight → AC-F3-1(a)/(b), AC-F4-1, AC-F4-2; heavy not co-scheduled → AC-F5-1; producer before consumer → AC-F6-1; close beats opening → AC-F7-1/AC-F9-1 plus AC-F7-2; park resume + recheck + incident → AC-F8-1/AC-F8-2; daemon-free operation → AC-F10-1/AC-F10-2. Every ticket task (priority queue and graph, readiness, single-flight, weight classes, batching + deploy verification, close-first, preemption with a named park state, scope-carrying leases, fence-token acquisition + takeover, park recheck semantics) appears as an F-capability, an AC, a TC and a plan phase. The only narrowing is R-08.
- **Seeded scenarios.** SC-M1-08's read projection and mutating holder proof, SC-M1-09's per-runner heavy cap with standard work unaffected and active-repository count unchanged, SC-M1-10's first-place close item with reasons, SC-M1-11's `(T, T+interval]` timestamp plus the stuck finding, and SC-M1-17b's one lease with heartbeat + exit-1 holder evidence + stale takeover with evidence are all preserved. SC-M1-17's `dispatch <ref>` half is deferred and disclosed (R-08).
- **Readiness reuse.** The scheduler's six-condition model uses the delivered ids/order/tri-state/evidence vocabulary and changes only the three sources it owns (`deps-satisfied`, `repo-free`, `tier-known`), which is exactly DEC-5/NG-4. `queue ready` is preserved by fixture-equivalence plus structural vocabulary stability (GAP-T1 is honest: it does not claim the source file is untouched).
- **State layer feasibility.** `StateStorePort` exposes `readRecords`, `append`, `replaceDocument`, `acquireFence`, `releaseFence` and an unforgeable fence handle, so the in-fence re-read and post-append verification are implementable as specified; no central record-kind registry needs editing outside `contracts/queue.ts`.
- **Error-table feasibility.** The five `queue` rows fit the delivered table (multi-row domain kinds are normal; `transient`/`not_landed`/`user-validation` exist; `projectionClass` is per-row, so `queue.park-condition-stuck` may be `platform` yet project to exit 1 without redefining the exit taxonomy). The documented S2 surface is `doc/spec/features/feature-result-contract.md`, which Phase 1 updates in the same commit and Phase 8 re-verifies.
- **Config feasibility.** `queue.park-recheck` as a `record` plus a typed `resolveQueueSettings` projection that rejects unknown child names mirrors the delivered `resolveLaneSettings` exactly; `config.key.unknown` / `config.value.invalid` are the delivered identities; `merge.deploy-expectations` is the real key and the producer-bound reading matches the delivered config-layer contract.
- **Determinism / hermeticity.** Every park, TTL and heartbeat boundary is an injected instant tested at `bound-1/bound/bound+1`; concurrency is proven by a scheduled single-writer fence harness (an algorithmic contract, disclosed as GAP-T3); no live network, credential or sleep is required (NFR-7). The performance bound's environment sensitivity is disclosed and paired with environment-independent structural assertions (GAP-T6).
- **Bounds and purity.** NFR-9's caps, NFR-2's zero-write reads (including zero derived replacements), and `truncated`/`degraded` presence are each owned by at least one TC, and the empty/degraded cases are explicit rather than silent.

## Reopen Targets

| Artifact phase | Findings |
|---|---|
| `specification` | R-01, R-02, R-03, R-04, R-05, R-08, R-09, R-10, R-11 |
| `test_planning` | R-06 (assertion side), R-07, R-16 |
| `delivery_planning` | R-06 (placement side), R-12, R-13, R-14, R-15 |

`delivery` is not reopened. After the author agents revise, re-run this gate. Cap at ~3 iterations; if the same blocking gap persists, escalate to the human rather than looping.
