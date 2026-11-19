# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-348
Date: 2026-11-19
Pause Required: no

## Inputs and checks performed

- Ticket GH-348 (`M4-S10: CEO loop supervision inside jaiship (M4)`, `gh issue view 348 --comments`, labels `change`, `spec-ready`): four ACs, seven tasks, "Depends on M4-S3a", F3 of the jaiship-only flip.
- Binding M4 blueprint: `doc/planning/oss-tooling/milestones/m4/flip-plan.md` (F3 row line 49, verification bar line 117, current-gap table line 33), `backlog.md` §M4-S10 lines 55-63, `ranking.md` row 4 line 17.
- `chg-GH-348-spec.md` v1.1 (41 ACs; 8 capabilities; 11 NFRs; 7 decisions; 9 DoD items), `chg-GH-348-test-plan.md` rev 0.2 (74 cases; 101 mutation rows), `chg-GH-348-plan.yaml` (9 delivery phases; 124 declared file entries over 80 unique paths), `chg-GH-348-pm-notes.yaml` (R1-R4, the ten declared divergences, the staging note).
- Current-truth pages the change touches: `feature-coordinator-supervision.md`, `feature-autonomous-delivery.md`, `feature-resident-daemon.md`, `feature-watchdog-lane-contracts.md`, `feature-harness-adapters.md`, `feature-config-layer.md`, `feature-result-contract.md`, `feature-state-layer.md`, `doc/overview/glossary.md`.
- Decision records `doc/decisions/TDR-0055-loop-supervision-as-a-profile-of-the-coordinator-engine.md` and `TDR-0056-durable-loop-stop-as-a-state-ledger-record.md` (both present, untracked, `Proposed`; both index rows present at `doc/decisions/00-index.md:85-86,96`).
- Delivered code/seams re-read: `packages/core/src/contracts/{coordinator,harness,dispatch,daemon,economics,error-table}.ts`, `packages/core/src/state/coordinator.ts`, `packages/core/src/domain/{coordinator-fence,coordinator-admission,coordinator-evidence}.ts`, `packages/adapters/src/daemon/process.ts`, `packages/adapters/src/host/index.ts`, `packages/adapters/src/harness/{opencode,telemetry-session-totals}.ts`, `packages/cli/src/production.ts`, `packages/cli/src/commands/coordinator-loop.ts`, `packages/cli/src/projection.ts`, `packages/cli/src/help/prompt-required-commands.ts`, `scripts/checks/{no-shell-dispatch,help-guide-coverage}.ts`, `tests/checks/{no-shell-dispatch,install-conformance-mutants,reference-page-parity}.test.ts`, `tests/structure/{metrics-mounting,provider-surface}.test.ts`, `scripts/ceo-loop.sh` (2.1.0).

Mechanical checks: AC count recomputed from spec §17 = 5+4+6+5+7+5+4+5 = **41** (matches §18's "41 criteria"); test-plan case headers = **74**; AC→case links = **77** (41 + 36 extras; the §3.1 arithmetic reconciles); mutation rows M1-M101 contiguous with group totals 4+4+6+8+5+9+8+9+7+7+8+9+4+5+8 = **101**; plan AC ownership 0+5+4+7+7+6+6+6+0 = **41** and TC ownership 1+11+7+12+10+9+13+11+0 = **74**; plan declares all **17** new test suites and all **9** new loop fixtures. The blocking findings below are semantic/contractual, not these headline counts (small count defects are R-10/R-11).

## Facet Summary

- spec_completeness: **FAIL** — the healthy-delivery corroborator is under-specified against the delivered lane facts (R-01, R-02); the delivered stuck-record fields the loop must populate are not declared (R-19); the at-bound "history reference" is undefined (R-20).
- ac_quality: **FAIL** — AC-F1-2's status-key source semantics are ambiguous (R-06); AC-F6-5's "resumes" is not objectively testable from the case as written (R-07); AC-F8-4 does not name the deliver primitive (R-03).
- plan_coverage: **PASS** — 41/41 ACs and 74/74 TCs each have exactly one owning phase, zero orphans and zero double-owned; the 9-phase order is coherent; 17/17 test suites and 9/9 fixtures are declared. The plan's test-surface gaps are recorded under `plan_code_area_coverage`.
- test_traceability: **FAIL** — the final-AC proof substitutes `phase complete` for the delivery primitive (R-03); the resume path is unasserted (R-07); the case inventory count is wrong (R-10); one closed degradation value is never observed (R-12); the required `--foreground` refusal is untested (R-13).
- cross_artifact_consistency: **FAIL** — R-01, R-02, R-04, R-06, R-08, R-09, R-15, R-17, R-18.
- decision_capture: **PASS** — DEC-1…DEC-7 are in spec §15; TDR-0055/TDR-0056 are present, `Proposed`, cited, indexed, and declared by plan phase 1; the restart-reason reuse is a recorded compromise (R-15 is a clarity finding, not a missing decision).
- system_spec_consistency: **FAIL** — the corroborator's start-time rule contradicts the delivered `DispatchLaneOwner` facts (R-01); `feature-state-layer.md`, the page that enumerates every record kind, is not in the doc plan (R-05); the INV-DM-2/5 citation is wrong (R-17).
- plan_doc_update_coverage: **FAIL** — `doc/spec/features/feature-state-layer.md` is missing from Appendix A and the plan's staging list (R-05); `doc/quality/test-specs/test-spec-loop-supervision.md` is missing from Appendix A/DOD-9 (R-14).
- plan_code_area_coverage: **FAIL** — TC-INSTANCE-004 row B runs `coordinator start` on a harness the plan declares as registering only `loop` (R-08); TC-CONTRACT-001's baseline fixture has no declared home (R-16).
- dod_defined: **FAIL** — DOD-7 claims a change-surface case that the test plan explicitly does not author (R-04); DOD-9 inherits the two doc omissions (R-05, R-14).

## Findings

### R-01 — The stuck corroborator's "matching start time" is unimplementable over the delivered lane owner (blocking)

- **Severity**: critical
- **Facet**: cross_artifact_consistency, system_spec_consistency, spec_completeness
- **Locations**:
  - `chg-GH-348-spec.md:153` (F-5): "the newest `dispatch.lane` record for any ref has state `active` and its recorded owner process is alive with a **matching start time** where the platform start-time source is readable".
  - `chg-GH-348-test-plan.md:1246` (TC-STUCK-010 row (c)): "active + owner alive but start time mismatched → `none` (an unverified owner is not a delivery)".
  - Delivered facts: `packages/core/src/contracts/dispatch.ts:585-593` defines `DispatchLaneOwner = { processId: number; startedAt: string }`; `packages/cli/src/production.ts:1690,3248` sets `startedAt` to `compositionStartedAt`, the composition's ISO start instant, not the OS process start time; `packages/adapters/src/daemon/process.ts:134-136` compares `port.startTimeMs(pid)` to a recorded **numeric process start time**.
- **Gap**: The spec requires the loop to verify the lane owner's "matching start time", but the delivered lane record carries no process start time — only a composition-start ISO timestamp. A faithful implementation that compares `Date.parse(owner.startedAt)` with `startTimeMs(owner.processId)` will mismatch for essentially every live delivery (the composition starts after the OS process), return `none`, and let the loop kill a CEO blocked on a healthy delivery. That is exactly the RSK-2 / INV-DM-3 failure the two-signal predicate exists to prevent. The battery passes only because the fixture seeds a synthetic matching timestamp; the live path is excluded from the proof boundary, so the contradiction is not caught by TC-STUCK-010.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Define the corroborator's owner-liveness rule over the delivered facts — either (a) `in-progress` when the owner pid is alive and its recorded `startedAt` is within a declared age bound (state the bound and its reason), or (b) add a process-start-time field to the lane owner as a separately recorded additive contract change (which would reopen the "no new fact" claim), or (c) drop the start-time requirement for the lane owner and state the weaker identity rule and its residual risk. Then update F-5, DM-6, the RSK-2 mitigation, the glossary, and TC-STUCK-010 row (c) to the chosen rule, and add a row proving a live owner whose composition timestamp differs from the platform start time is still `in-progress`.

### R-02 — The corroborator decision table's `unknown` and `none` cases are under-specified against TC-STUCK-010 (blocking)

- **Severity**: major
- **Facet**: cross_artifact_consistency, spec_completeness
- **Locations**:
  - `chg-GH-348-spec.md:153` (F-5): `unknown` "when the state read fails"; `none` "when neither holds over a **verified-empty store**".
  - `chg-GH-348-test-plan.md:1246` (TC-STUCK-010 rows b, c, e, h, i, j): `none` for a readable non-empty store with a terminal/no-live lane; `unknown` for "a start-time source that is unreadable".
  - Delivered `DaemonLaneRecord.processId?: number` (`packages/core/src/contracts/daemon.ts:142-156`) and `DaemonLaneState` includes `delivering`.
- **Gap**: The spec's `unknown` set is only "state read fails" and its `none` set is only "verified-empty store", while the test plan requires `none` over readable non-empty stores and `unknown` for an unreadable start-time source. A faithful spec implementation can return `none` for an unreadable owner-start-time source (killing a healthy CEO), and can return `unknown` for a store that merely contains terminal lane records. The `daemon.lane` `delivering` case with an **absent** `processId` is also unspecified: the type makes the pid optional, and TC-STUCK-010 row (e) reads "no live process → none", which would treat a healthy delivery with an unrecorded pid as no delivery.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Publish the complete corroborator decision table in F-5/DM-6: for each `(dispatch.lane newest state, owner pid presence, owner liveness result, start-time readability, daemon.lane newest state, daemon pid presence, store readability)` give the exact reading (`in-progress` / `none` / `unknown`) and state that an unreadable start-time source, an absent daemon pid on a `delivering` lane, and a non-empty readable store with no live lane are `unknown`/`none` as chosen. Then align TC-STUCK-010's ten rows and add the absent-daemon-pid row.

### R-03 — The final-AC proof substitutes `phase complete` for the delivery primitive (blocking)

- **Severity**: major
- **Facet**: test_traceability, ac_quality, cross_artifact_consistency
- **Locations**:
  - Ticket AC 4: "the loop drives a full pick-deliver-merge cycle using only jaiship primitives and no shell entry point".
  - `chg-GH-348-spec.md:534` (AC-F8-4): "the doubled session issues the pick, **deliver**, and merge primitives through the real command runtime".
  - `chg-GH-348-test-plan.md:1819-1830` (TC-BATTLE-006): "`queue claim` (pick), **`phase complete` (deliver)**, `merge` (merge)".
  - `chg-GH-348-plan.yaml:1600-1610` (phase 8 obligation 8.2): "wiring the scripted session to `queue claim` / `phase complete` / `merge`".
  - Delivered CEO contract: `.opencode/agent/ceo.md:87` — the CEO's deliver step is `scripts/deliver-ticket.sh <ref>`; the flip target is `jaiship dispatch <ref>` (`flip-plan.md:33`), not `phase complete`. `phase complete` is a PM lifecycle transition.
- **Gap**: The deterministic "pick-deliver-merge" proof never exercises the delivery primitive. `phase complete` marks a lifecycle phase, not a delivery; `dispatch` is the delivered jaiship replacement for `deliver-ticket.sh` and is the primitive the ticket's final AC is about. The battery therefore proves pick → lifecycle transition → merge, and the ticket's "using only jaiship primitives" claim for the deliver leg is untested. The not-proven list covers live outcomes, not the substitution of the primitive itself.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Drive the deliver leg through `dispatch` (double its nested PM session through the same scripted harness port, or declare the nested-dispatch seam) and assert its envelope and the loop's health, or — if `dispatch` cannot run nested — declare the substitution in the spec's AC-F8-4/Appendix C as a named proof-boundary limitation and narrow the ticket traceability claim. Do not label `phase complete` as the deliver primitive.

### R-04 — DOD-7 claims a change-surface case the test plan deliberately does not author (blocking)

- **Severity**: major
- **Facet**: dod_defined, cross_artifact_consistency
- **Locations**:
  - `chg-GH-348-spec.md:549` (DOD-7): "The change diff contains no modification to `scripts/ceo-loop.sh` and no modification to any file under `.opencode/agent/`; **both are asserted by a change-surface case**."
  - `chg-GH-348-test-plan.md:53-56` (§1.2): "`DOD-7` … the shell half is already a permanent tree invariant (`tests/structure/provider-surface.test.ts` …); the prompt half is a **PR-time change-surface review recorded in §10, not a diff assertion**."
  - `chg-GH-348-test-plan.md:2791` (§10): the DOD-7 prompt half is "Not run … PR-time change-surface review".
- **Gap**: DOD-7's stated observation does not exist. The test plan intentionally omits the prompt-half case (a permanent diff assertion is forbidden by the testing strategy), so the DoD check has no named case to read for the prompt half and must fall back to a manual review. A DoD item whose observation is not the one actually performed is not a testable DoD item.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Rewrite DOD-7's "How observed" to name the two actual observations: the `provider-surface.test.ts` sha256 pin for the shell, and the PR-time change-surface review (with the review record location) for the prompt half. If a machine-checked prompt-half assertion is required, add one case; otherwise stop claiming a change-surface case.

### R-05 — The state-layer current-truth page is missing from the doc plan (blocking)

- **Severity**: major
- **Facet**: system_spec_consistency, plan_doc_update_coverage
- **Locations**:
  - `chg-GH-348-spec.md:620-636` (Appendix A) and `:551` (DOD-9): the page list does not include `doc/spec/features/feature-state-layer.md`.
  - `chg-GH-348-plan.yaml:1800-1817` (phase 9 code areas / staging list): the same page is absent.
  - `doc/spec/features/feature-state-layer.md:9` and `:51`: the page's summary and consumer paragraph enumerate every delivered record kind, including the six `coordinator.*` kinds; it is the current-truth enumeration of the ledger's kinds.
  - `doc/decisions/TDR-0056-…:36` (performers): "`@doc-syncer (GH-348 documentation phase: the loop page, **the state-layer record-kind table**, …)`".
- **Gap**: The change adds two new record kinds (`loop.session`, `loop.stop`). The page that states which record kinds exist and who writes them is not in Appendix A, DOD-9, or the plan's staging list. DOD-9's "every page named in Appendix A is updated" and its "no page still describes the outer loop only as `scripts/ceo-loop.sh`" scan would both pass while the state-layer page remains silent about the two new kinds and their writer. TDR-0056 already names the page, so the omission is a cross-artifact contradiction, not a judgement call.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Add `doc/spec/features/feature-state-layer.md` to Appendix A with its required reconciliation (the two new kinds, their schemas/keys/folds, the loop supervisor as writer/reader, and the unchanged schema version), add it to DOD-9, and declare it in plan phase 9's staging list. Add the page to the doc-conformance guard's expected set if the guard enumerates pages.

### R-06 — The status keys' source semantics (`loop_id`, `ceo_pid`, `ceo_session`) are contradictory (blocking)

- **Severity**: major
- **Facet**: ac_quality, cross_artifact_consistency
- **Locations**:
  - `chg-GH-348-spec.md:269` (API-4): "loop id, instance folded from the lease (or `null`), state …, session facts (session id, alive, pid, title, progress state)".
  - `chg-GH-348-spec.md:272` (API-7) and `:461` (AC-F1-2): "every key whose value is absent renders as the empty string after `=` — `loop_pid=`, `ceo_pid=`, `ceo_session=`, **`loop_id=`**, …".
  - `chg-GH-348-spec.md:602` (glossary): "Supervisor identity … **`loop-main` for the loop**" — a constant.
  - `chg-GH-348-test-plan.md:363,380` (TC-VERB-003 world C): "no lease, no session record … every optional identifier is genuinely absent" and "`loop_id=`" bare.
  - `chg-GH-348-test-plan.md:362` (world B): "an `ended` session record with a pid" — the expected `ceo_pid`/`ceo_session` values are never stated.
  - Delivered shell parity: `scripts/ceo-loop.sh:760-775` sets `ceo_pid_val`/`ceo_sid` only from `ceo_pid_if_live`, so an ended session renders `ceo_pid=`/`ceo_session=` empty.
- **Gap**: The spec lists both a "loop id" and an "instance" but the human block exposes only `loop_id`, and then lists `loop_id` among the values that can be absent. If `loop_id` is the constant supervisor identity (`loop-main`), world C's `loop_id=` is wrong; if it is the lease instance, the spec's "loop id" and "instance" are two names for one field and the constant identity is not projected at all. The same ambiguity affects `ceo_pid`/`ceo_session` in world B: the shell parity says they are live-only and empty for an ended session, while the spec's "session facts (session id, alive, pid)" reads as recorded facts. Two different goldens can both be defended, which makes AC-F1-2 not objectively testable.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Define each status key's source in one table: `loop_running`/`loop_pid` (live lease holder), `ceo_alive` (live session liveness), `ceo_pid`/`ceo_session` (live session only, empty when not alive — the shell parity reading), `loop_id` (constant supervisor identity `loop-main`, always present, never empty), `budget_epoch` (persisted/lease epoch only, empty when none), and the recorded `ceo_title`/`last_*` facts. If `loop_id` is intended to be the instance id, rename it and add the constant identity as its own key. Then align AC-F1-2, API-4, API-7, Appendix F, the glossary, and TC-VERB-003 worlds B/C.

### R-07 — AC-F6-5's "resumes" is not asserted; the only resume path is unbound (blocking)

- **Severity**: major
- **Facet**: test_traceability, ac_quality
- **Locations**:
  - `chg-GH-348-spec.md:516` (AC-F6-5): "a recorded session is `active` with no process id … the loop treats it as unknown-liveness … **resumes it** rather than spawning a second session".
  - `chg-GH-348-spec.md:141` (F-2): "A resume carries no title."
  - `chg-GH-348-test-plan.md:1444` (TC-INSTANCE-006): "0 spawns and 0 kills; the recorded session is treated as **resumed/observed** rather than duplicated" — the hedge means the case passes whether or not `resume` is called.
  - `chg-GH-348-test-plan.md:499` (TC-SPAWN-002): "A resume carries no `--title` and the resume row is driven only by `TC-PARITY-005`'s **non-resume assertion**" — no case actually drives a resume.
  - `chg-GH-348-test-plan.md:2204` (TC-PARITY-005): "Zero resumes" on the restart path.
- **Gap**: The loop's only v1 resume path (a pid-less `active` session) is never asserted to call `resume`, and TC-SPAWN-002's "resume row" has no scenario. AC-F6-5's "resumes" and AC-F2-2's "given a resume, then no title" are therefore not objectively verified; an implementation that only observes the session satisfies the cases but not the AC. The contrast with TC-PARITY-005's "zero resumes" makes the gap easy to miss.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: In TC-INSTANCE-006 assert exactly one `resume` call with the recorded session id, no title, and the same session id in the returned handle (or, if the intended behavior is observation-only, change the spec's "resumes" to "observes" and record the divergence). Bind TC-SPAWN-002's resume row to TC-INSTANCE-006 and assert no `--title` on that call.

### R-08 — TC-INSTANCE-004 row B runs `coordinator start` on a harness that registers only `loop` (blocking)

- **Severity**: major
- **Facet**: plan_code_area_coverage, cross_artifact_consistency
- **Locations**:
  - `chg-GH-348-test-plan.md:1383` (TC-INSTANCE-004 row B): "run `coordinator start --foreground`; assert admission and the reads".
  - `chg-GH-348-test-plan.md:204` (D2): "a `createTestEdge`-composed edge registering the `loop` command → `runCli([...])`"; `:207`: `TC-INSTANCE-*` default to D2.
  - `chg-GH-348-plan.yaml:824-828` (phase 2 fixture): "`tests/fixtures/loop/harness.ts` (driver D2: **one composed edge registering `loop`** over a temp state root …)".
  - `chg-GH-348-plan.yaml:1000` (phase 3 code area): `harness.ts` "extend: seeds/counters" — no coordinator registration.
- **Gap**: The case that proves the two identities do not exclude each other invokes a command the declared D2 harness does not register. Row A seeds the coordinator lease through the delivered claim (so it needs no coordinator command), but row B does not. As declared, TC-INSTANCE-004 cannot execute its row B on the harness that owns the case.
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: Declare that `tests/fixtures/loop/harness.ts` also registers the `coordinator` family (the production composition already mounts it), or change TC-INSTANCE-004 row B to seed the `loop-main` lease and run the coordinator claim through the delivered claim function exactly as row A does. If D1 is used for row B, say so in the case.

### R-09 — NFR-5's fixed 652 000 ms bound contradicts the configurable collection interval (blocking)

- **Severity**: major
- **Facet**: cross_artifact_consistency, ac_quality
- **Locations**:
  - `chg-GH-348-spec.md:329` (NFR-5): "detection-to-restart ≤ **652 000 ms**".
  - `chg-GH-348-spec.md:153` (F-5): the bound is `600 000 + 30 000 + 20 000 + 2 000 = 652 000 ms` (window + **one collection interval** + grace + first backoff).
  - `chg-GH-348-spec.md:289` (DM-8): the loop consumes `coordinator.collection-interval` (default 30 000 ms), a configuration key.
  - `chg-GH-348-test-plan.md:1140-1141` (TC-STUCK-006): "elapsed ≤ 652 000 ms … a coarser poll granularity does not exceed the bound (the interval is a composed setting, so the bound is **recomputed** from the delivered keys, not hardcoded)".
- **Gap**: The spec fixes a numeric threshold that is only true at the shipped 30 000 ms interval, while declaring the interval configurable. If an operator sets `coordinator.collection-interval` to 60 000 ms, the formula gives 682 000 ms and NFR-5 fails; the test plan simultaneously says the bound is recomputed and asserts the fixed 652 000 ms. A reviewer cannot tell whether the implementation must hold the fixed threshold (and therefore clamp/override the interval) or the formula (and therefore not claim 652 000).
- **Suggested remediation target phase**: specification
- **Suggested fix**: State the bound as `stuck-window + collection-interval + kill-grace + first backoff` and give 652 000 ms as the shipped-default value, or declare that the collection interval is not tunable for this profile and pin it. Then make TC-STUCK-006 assert the formula and the shipped-default value, and remove the "a coarser granularity does not exceed the bound" sentence if the bound grows with the interval.

### R-10 — The test plan's case-inventory count is arithmetically wrong (minor)

- **Severity**: minor
- **Facet**: test_traceability
- **Location**: `chg-GH-348-test-plan.md:130`: "0 orphan cases: **68** link at least one `AC-*`, and **6** link the `NFR-*` contract (`TC-CONTRACT-001`, `-002`, `-003`, `-004`, `-005`, `-006`)".
- **Gap**: The §3.1 matrix links **69** unique cases to ACs (TC-CONTRACT-003 appears at AC-F1-5, line 88) and leaves **5** NFR-only (TC-CONTRACT-001, -002, -004, -005, -006). The traceability matrix itself is complete; the summary count is false and names a case as NFR-only that the matrix links to an AC.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Correct the sentence to 69 AC-linked / 5 NFR-only, and either remove TC-CONTRACT-003 from the NFR-only list or remove the AC-F1-5 link (keeping one source of truth).

### R-11 — "16 new test suites" but 17 are enumerated (minor)

- **Severity**: minor
- **Facet**: plan_coverage
- **Locations**: `chg-GH-348-test-plan.md:2397` ("New test hosts (**16**)"), `:2478` ("Split: **16 new test suites**"), `:2454-2476` (the file map enumerates 17 new suite files).
- **Gap**: The enumerated set is `loop-{grammar,status,spawn,backoff,stop,stuck,instance,log,read-cost}` (9) + `loop-{imports,production-composition,production-session}` (3) + `loop-{contract-invariance,mutants,privacy}` (3) + `loop-{parity-battery,pick-deliver-merge}` (2) = 17. The plan declares all 17, so no suite is missing; the count is wrong and would hide a future omission.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Change both counts to 17 and verify the plan's 17-file declaration is the reference.

### R-12 — The `progress-unreadable` degradation value is never asserted (minor)

- **Severity**: minor
- **Facet**: test_traceability
- **Locations**: `chg-GH-348-spec.md:269` (API-4) closed degradation list includes `progress-unreadable`; `chg-GH-348-test-plan.md:1084-1091` (TC-STUCK-004) asserts the `unevaluable` verdict and record counts but never `loop status`'s `progress-unreadable`; `:1115` asserts `delivery-corroborator-unreadable`; `:1445` asserts `session-pid-unknown`/`live-facts-unknown`; `:1577` asserts `log-unavailable`.
- **Gap**: Four of the five closed degradation values have an owning assertion; `progress-unreadable` has none. The closed vocabulary is therefore not fully observed.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Add a `loop status --json` assertion to TC-STUCK-004 that the `degraded` list contains `progress-unreadable` (and not `delivery-corroborator-unreadable`), or add the assertion to TC-CONTRACT-002's battery scan.

### R-13 — The required `--foreground` refusal is not tested (minor)

- **Severity**: minor
- **Facet**: test_traceability
- **Location**: `chg-GH-348-spec.md:133` (F-1) makes `--foreground` required on `start`; `chg-GH-348-test-plan.md:335` (TC-VERB-002) lists malformed forms but has no `loop start` (missing `--foreground`) or `loop start --fresh-budget` (missing `--foreground`) row.
- **Gap**: AC-F1-1's grammar table includes a green `start --foreground` row and refusals for undeclared flags, but the required-flag's absence is not a refusal case. An implementation that defaults `--foreground` would pass every case.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Add both missing-required-flag rows to TC-VERB-002 (exit 1, `fallback.invocation`, `result=refused; reason=grammar`, 0 records) and add a mutation row that defaults `--foreground`.

### R-14 — The new enduring test-spec page is missing from Appendix A/DOD-9 (minor)

- **Severity**: minor
- **Facet**: plan_doc_update_coverage, dod_defined
- **Locations**: `chg-GH-348-test-plan.md:66` requires `doc/quality/test-specs/test-spec-loop-supervision.md` (phase 7); `chg-GH-348-plan.yaml:1820` declares it (staging only); `chg-GH-348-spec.md:620-636` (Appendix A) and `:551` (DOD-9) do not name it.
- **Gap**: The plan and test plan require a new enduring quality page that the spec's doc-impact list and DoD-9 omit. DOD-9's "every page named in Appendix A is updated" would not require it.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Add the page to Appendix A with its required content (the loop counterpart of `test-spec-coordinator-supervision.md`) and to DOD-9.

### R-15 — The restart reason `stuck-artifact-evidence` semantically contradicts the loop's own two-signal predicate (minor)

- **Severity**: minor
- **Facet**: cross_artifact_consistency, spec_completeness
- **Locations**: `chg-GH-348-spec.md:143` (F-3) and `:286` (DM-5) use the delivered closed reason `stuck-artifact-evidence`; `:407` (DEC-3) says the coordinator's artifact-evidence predicate "is the right predicate for a delivery expectation and the wrong one for a long-lived CEO session" and that the loop owns a two-signal predicate.
- **Gap**: The durable restart record names an artifact-evidence reason for a verdict the design explicitly says is not artifact-evidence-based. The distinguishing facts ride the evidence string, but an operator reading `coordinator.restart` alone cannot tell a loop restart from a coordinator restart and sees a reason the loop's design rejects. TDR-0055 already records the possibility of a second reason token as a revisit trigger, so this is a known compromise, not an overlooked one — but the operator-facing contract does not state it.
- **Suggested remediation target phase**: specification
- **Suggested fix**: State the semantic compromise in F-3/DM-5 and on the new current-truth page (the reason is the delivered closed token; the evidence corpus carries the two-signal facts), or propose the second reason token as a separate decision before delivery. Do not change the delivered vocabulary inside this change.

### R-16 — TC-CONTRACT-001's baseline fixture has no declared home (minor)

- **Severity**: minor
- **Facet**: plan_code_area_coverage, cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:1919` (TC-CONTRACT-001): "a baseline fixture captured in this change: the error table, the domain-kind set, the configuration key set with its defaults, the coordinator payload schemas … and the delivered coordinator suite results"; `:2367-2379` (§6.1 "Must be authored — new files (9)") does not list a contract-baseline fixture; `chg-GH-348-plan.yaml:1699-1712` (phase 8 files) does not declare one.
- **Gap**: The case's declared fixture mechanism has no file, and the plan declares no file. If the baseline is inline in `tests/checks/loop-contract-invariance.test.ts`, the case's "fixture mechanism" is wrong; if it is a separate fixture, the plan is missing a file. The "delivered coordinator suite results" baseline also has no declared capture mechanism; running those suites from inside the case would start real child processes and violate NFR-1.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: State that the baseline is a committed literal inside `loop-contract-invariance.test.ts` (and declare the coordinator suite results as a gate-battery read, not a case), or declare a `tests/fixtures/loop/contract-baseline.ts` in both the test plan's inventory and plan phase 8.

### R-17 — The INV-DM-2/5 citation is wrong (minor)

- **Severity**: minor
- **Facet**: system_spec_consistency
- **Locations**: `chg-GH-348-spec.md:49`: "**INV-DM-2/5** make the shell's probe the `--is-delivering` PID probe plus the race-free `.ai/local/delivery/delivering` marker, and make liveness multi-signal progress"; `doc/spec/features/feature-autonomous-delivery.md:162-165`.
- **Gap**: INV-DM-2 is the single-flight/join invariant; the `--is-delivering` probe and the delivering marker are defined by INV-DM-3 (line 163). The citation should be INV-DM-3/5. The mis-citation is in the paragraph that establishes the binding stuck definition.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Change "INV-DM-2/5" to "INV-DM-3/5" and re-check the quoted line span.

### R-18 — The normal end of `start --foreground` is not a declared termination cause (minor)

- **Severity**: minor
- **Facet**: cross_artifact_consistency, spec_completeness
- **Locations**: `chg-GH-348-spec.md:133` (F-1): `start` "runs … until a stop, a signal, a budget exhaustion, or a failure"; `chg-GH-348-test-plan.md:315` (TC-VERB-001): "ends with `state=stopped` **after its cycle budget**"; `chg-GH-348-plan.yaml:824-828` and phase 2 obligation 2.4: "run the injected cycle driver, release on exit".
- **Gap**: The happy-path foreground start is driven to completion by the injected cycle driver, but driver completion is not one of the four declared causes. The test plan's "cycle budget" is a test-only term, and TC-PARITY-009:2307 says "the driver's declared cycle count is the only bound in the battery". The spec should state that a composition whose driver reports `stopped` ends the loop with a success receipt (`state=stopped`, exit 0), so the battery's clean-end path is contract, not test artifact.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Add "the composition's cycle driver reports its declared end" as a clean-end cause in F-1/API-1 (with `state=stopped`, exit 0), and tie TC-VERB-001/TC-BATTLE-006 to that clause instead of "cycle budget".

### R-19 — DM-6 omits the delivered stuck-record fields the loop must populate (minor)

- **Severity**: minor
- **Facet**: spec_completeness
- **Locations**: `chg-GH-348-spec.md:287` (DM-6) names the verdict vocabulary and the evidence facts, not the delivered record's required fields; `packages/core/src/contracts/coordinator.ts:402-418` requires `stuckId`, `iterationId`, `coordinatorId`, `verdict`, `phase`, `reason`, `evidence`, `killOutcome`, `killFailureReason`, `recordedAt`; `chg-GH-348-test-plan.md:1013` asserts `phase` and the corpus but not `iterationId`/`killFailureReason`.
- **Gap**: The loop has no `coordinator.iteration` record, yet the delivered stuck record requires an `iterationId`. The spec never says what identity the loop supplies, and no case asserts it. A reviewer cannot tell whether a synthetic iteration id is acceptable or whether a loop iteration record (which would be a new record kind) is required.
- **Suggested remediation target phase**: specification
- **Suggested fix**: State that the loop supplies a loop-scoped `iterationId` (for example `<loopId>:<cycle ordinal>` or the session record id) and a `killFailureReason` only on a failed kill, and add the field assertions to TC-STUCK-001/TC-STUCK-008. If a loop iteration record is intended, declare it as a third record kind and reopen the "exactly two" claim.

### R-20 — The at-bound "history reference" is undefined (minor)

- **Severity**: minor
- **Facet**: spec_completeness
- **Location**: `chg-GH-348-spec.md:143` (F-3): the summary names "the **history reference**"; `chg-GH-348-test-plan.md:720` (TC-BACKOFF-004): "The bounded summary names the durable history reference" — no case defines or asserts a specific value.
- **Gap**: The delivered `CoordinatorExhaustionRecord.historyRef` is not written by the loop (NG-6), so the "history reference" is some other value (the epoch, the restart fold, or the ledger location) that the spec never names. The case cannot assert a value it cannot derive.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Define the history reference (for example `epoch-<n>` plus the count of restart records, or the ledger path/sequence range) and assert it in TC-BACKOFF-004.

### R-21 — The global `--json` flag is outside the declared grammar and not carved out of the refusal rule (nit)

- **Severity**: nit
- **Facet**: cross_artifact_consistency
- **Locations**: `chg-GH-348-spec.md:139` (F-1): "a flag outside the verb's declared set … is refused"; `chg-GH-348-test-plan.md:335` (TC-VERB-002): "an unknown option"; the suite uses `loop status --json`/`loop log --json` at `:367`, `:404`, `:1654`; `packages/cli/src/index.ts:434` declares `GLOBAL_FLAGS = {--json, --verbose, --pretty}`.
- **Gap**: A reader implementing the refusal rule literally could refuse `--json`, breaking TC-VERB-003/LOG-005/LOG-007. The global flags are delivered CLI behavior and should be named as accepted on every verb.
- **Suggested remediation target phase**: specification
- **Suggested fix**: State in F-1/API-7 that the delivered global flags (`--json`, `--verbose`, `--pretty`) are accepted on every verb and are not grammar refusals, and add a positive row to TC-VERB-002.

## Nits

- **N-01** — `chg-GH-348-spec.md:318` (§8.5 row 9) says "Six `CEO_LOOP_*` env knobs"; only five names start with `CEO_LOOP_` (`CEO_RESUME_TOKEN_LIMIT` does not). The mapping table at `:704-713` is correct; fix the row's wording. Target: specification.
- **N-02** — `chg-GH-348-plan.yaml:567` assumption (e): "The **five** `loop.session` fields `pid`, `processStartTimeMs`, and `title` are nullable" names five but lists three. Target: delivery_planning.
- **N-03** — `chg-GH-348-plan.yaml:1118` (phase 4) lists "M45–M53" and `:1248` (phase 5) lists "M53"; M53's named case TC-STUCK-006 is owned by phase 5. The mutation row is double-declared. Target: delivery_planning.

## Counts

- Critical: **1** (R-01)
- Major: **8** (R-02…R-09)
- Minor: **12** (R-10…R-21)
- Nit: **3** (N-01…N-03)
- Total: **24**

## Remediation order (gate re-runs after each owner's pass)

1. **specification** (blocks everything else): R-01, R-02, R-04, R-05, R-06, R-09, R-14, R-15, R-17, R-18, R-19, R-20, R-21, N-01.
2. **test_planning** (after the spec revisions land): R-03, R-07, R-10, R-11, R-12, R-13, R-16, plus the case updates that follow R-01/R-02/R-06/R-09/R-18/R-19.
3. **delivery_planning** (after the spec/test-plan revisions): R-08, R-16's file declaration if any, N-02, N-03, and the phase-9 staging addition for R-05/R-14.

The gate must not reopen `delivery` for any of these findings. R-01 and R-03 are the two findings that change the shape of the proof (the corroborator's identity rule and the deliver leg), so they should be settled before the test-plan and plan revisions are re-reviewed.

## Re-run note

This is iteration 1; there are no prior readiness records under `readiness-review/`, so no finding is marked persistent. No human pause is required: every finding is an artifact remediation, and the TDR-0055/TDR-0056 `Proposed` status is a PR-gate acceptance item, not a DoR blocker.
