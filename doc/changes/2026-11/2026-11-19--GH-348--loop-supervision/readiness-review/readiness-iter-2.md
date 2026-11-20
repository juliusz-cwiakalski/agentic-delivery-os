# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-348
Date: 2026-11-19
Pause Required: no

## Inputs and checks performed

- Ticket GH-348 (`gh issue view 348`: four ACs, seven tasks, `change` + `spec-ready`, milestone M4, no comments) and the binding blueprint rows: `doc/planning/oss-tooling/milestones/m4/flip-plan.md` F3 + verification bar, `backlog.md` §M4-S10, `ranking.md` row 4.
- `chg-GH-348-spec.md` **v1.2**, `chg-GH-348-test-plan.md` **revision 0.3**, `chg-GH-348-plan.yaml` (comment-carried phase data), `chg-GH-348-pm-notes.yaml` (R1–R4, the twelve DoR-iteration-1 PM rulings, the commit-boundary update), `readiness-review/readiness-iter-1.md` (24 findings).
- Delivered contracts re-read for R-01/R-02: `packages/core/src/contracts/dispatch.ts:585-611` (`DispatchLaneOwner = {processId, startedAt}`, `DispatchLaneRecord.state = active|terminal`), `packages/cli/src/production.ts:1689,3248` (`startedAt = compositionStartedAt`), `packages/core/src/contracts/daemon.ts:135-179` (`delivering|detached|completed|failed|preempted`, optional `processId`), `packages/core/src/app/{dispatch-ledger,daemon}.ts` (`readDispatchLanes`, `latestDispatchLaneFor`, `readDaemonLanes`).
- Delivered paths re-read for the new checks: `packages/core/src/domain/coordinator-fence.ts:80-125` (claim gate checks **`aliveDeclared` only**), `packages/core/src/contracts/coordinator.ts:394-421` (stuck/restart payloads), `packages/core/src/contracts/state.ts:47-56,169-180,300-340` (`StateRecord.sequence`, `readRecords()`), `packages/core/src/app/dispatch.ts:288-333,980-995` (injected `delay` covering fence wait, tracker ladder, terminate grace; `ports.harness.spawn`), `packages/core/src/app/queue.ts:1140-1263` (queue-lease single-flight, distinct from `loop.fence`), `tests/structure/provider-surface.test.ts:286-287` (`scripts/ceo-loop.sh` sha256 pin), `tests/structure/metrics-mounting.test.ts:40-92` (26 families, stale-pin regex `toHaveLength(2[345])`), `packages/cli/src/help/prompt-required-commands.ts:11-39` (26 entries, `install` last), `.opencode/agent/reviewer.md:242` (local review artifact path), `doc/spec/features/feature-coordinator-supervision.md:176-187`, `doc/spec/features/feature-state-layer.md:9,51,439-444`, `doc/spec/features/feature-autonomous-delivery.md:162-165,242`.
- Mechanical checks re-run at `456227a2` (clean tree): `jaiship plan validate GH-348` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `jaiship lint plan GH-348` → `valid`.

Recomputed counts (from the artifacts, not the hand-off):

| Quantity | Recomputed | Artifact claim | Agrees |
|---|---|---|---|
| ACs in spec §17 | 41 (5+4+6+5+7+5+4+5), 41 unique | "41 criteria" (§18, DOD-1) | yes |
| Test cases | 74 headers, 74 unique, 10 groups (5+6+7+7+11+7+7+8+6+10) | 74 | yes |
| AC→case links | 78 (41 + 37 extras; per-AC extras sum to 37) | 78 (41 + 37) | yes |
| AC-linked / NFR-only cases | 69 / 5 (`TC-CONTRACT-001,-002,-004,-005,-006`) | 69 / 5 | yes |
| Mutation rows | M1–M115 contiguous, 115 unique (the apparent M1–M6 repeats are `TC-STUCK-010`'s evidence-class rows) | 115 | yes |
| Mutation allocation per phase | 1+17+9+23+12+9+25+19+0 = 115, every id exactly once | same | yes |
| AC ownership per plan phase | 0+5+4+7+7+6+6+6+0 = 41, zero orphans, zero double-owned | same | yes |
| TC ownership per plan phase | 1+11+7+12+10+9+13+11+0 = 74, zero orphans, zero double-owned | same | yes |
| Plan declared paths | 127 file entries over 83 unique paths | not claimed (was 124/80) | n/a |
| Suites / fixtures | 17 new suites (9 behaviour + 3 structure + 3 checks + 2 conformance), 9 new fixtures, 9 extended, 15 reused | 17 / 9 / 9 / 15 | yes |
| AC group split per feature | F-1 5, F-2 4, F-3 6, F-4 5, F-5 7, F-6 5, F-7 4, F-8 5 | spec §17 | yes |

## Facet Summary

- spec_completeness: **PASS** — every iteration-1 spec gap is closed (corroborator tables, status-key sources, bound formula, clean-end cause, iteration identity, history reference, globals). R-15's page-content half is the only residual and is recorded as a partial.
- ac_quality: **PASS** — AC-F1-2, AC-F5-3, AC-F5-5, AC-F3-3, AC-F5-1/6 and AC-F1-1 are now objectively testable against declared sources and computed values.
- plan_coverage: **FAIL** — R-23: phase 4's owned cases assert the restart/stop flows that the plan schedules in phases 5/6, so the phase-4 boundary cannot be gate-green.
- test_traceability: **PASS** — 41/41 ACs and 74/74 TCs each have exactly one owning phase; 78 links reconcile; every case names its AC/NFR and target layer. (R-22 and R-24 are case/contract defects, recorded under the facets below.)
- cross_artifact_consistency: **FAIL** — R-22, R-23 (blocking), plus minors R-25, R-26.
- decision_capture: **PASS** — DEC-1…DEC-7 in spec §15; TDR-0056/TDR-0057 present, `Proposed`, cited, indexed, and treated by phase 1 as verification targets (tracked in `400a96ad`); the restart-reason reuse is a recorded compromise (R-15, partial on the page only).
- system_spec_consistency: **PASS** — no contradiction with `doc/spec/**` survives except the one unreconciled page limitation in R-28 (minor, non-blocking).
- plan_doc_update_coverage: **PASS** — all 15 Appendix A targets are staged (phase 9 for 16 paths incl. `feature-state-layer.md` and `test-spec-loop-supervision.md`; phase 7 for the M4 reference page); minors R-28 and nit N-04 concern required *content*, not staging.
- plan_code_area_coverage: **FAIL** — R-22: the read-only `status` verb dispatch is not declared in the phases whose owned cases read it.
- dod_defined: **PASS** — DOD-7 now names two observations that exist (`provider-surface.test.ts` sha256 pin; `code-review/review-iter-<N>.yaml`, the reviewer's documented local artifact); DOD-9 names both added pages. Nit N-04 on the scan's mechanism only.

## Disposition of iteration-1 findings

| ID | Status | Evidence that now satisfies it |
|---|---|---|
| R-01 | **Resolved** | `spec:51` (delivered `startedAt` is the composition instant, verified at `production.ts:1689,3248`); `spec:155` (inputs exclude `startedAt`/age); D3–D6 + F0–F3 (`spec:159-183`); residual pid-reuse risk (`spec:185`); DM-6 (`spec:342`); RSK-2 (`spec:406`); AC-F5-3 (`spec:557`); AC-F5-7 (`spec:561`); `test-plan:1071-1087` (live-shape seed + armed start-time probe, 0 calls), `test-plan:1253,1259` (source scan), `M106` (`test-plan:2741`), `test-plan:2832`; plan escalation trigger (`plan:673`), phase-4 contract/obligation 4.2/4.6 (`plan:1170-1250`). No lane-owner start-time comparison survives anywhere (the remaining "matching start time" hits are the **session-record** re-find of F-6: `test-plan:1387`, `plan:1063`). |
| R-02 | **Resolved** | Complete evidence-class table D1–D6 / M1–M6 and fold F0–F3 with the totality argument (`spec:157-183`), DM-6 (`spec:342`), glossary (`spec:663`); `test-plan:1263-1317` reproduces the 16 rows verbatim plus newest-wins folding and the pid-reuse/live-shape observations; `M107`/`M108` (`test-plan:2742-2743`). Table checked total over (store readability × dispatch state/presence/liveness = 6 rows × daemon state/presence/liveness = 6 rows × 4 folds); `none` only at F3; absent daemon pid → `unknown` at M3. |
| R-03 | **Resolved** | `phase complete` appears only as an explicit negation (`test-plan:130,1891,1905,2503`, `plan:22,1818,1891`). AC-F8-4's deliver primitive is `dispatch` (`spec:589`, Appendix C `spec:725`, Appendix B `spec:712`). `test-plan:1870-1908` drives `dispatch` through `runCli` on the same composed program/store, doubles the nested PM session from the same scripted port keyed by agent (`ceo`/`pm`) and title prefix (`ceo-loop-`/`ticket-<REF>`), and asserts the dispatch envelope + attempt/lane records; `M102` (`test-plan:2737`); plan 8.1/8.2/8.5 (`plan:1806-1848`) and phase-8 gate. Coherence/determinism verified against delivered code: `dispatch` takes an injected `delay` covering the fence wait, tracker ladder and terminate grace (`app/dispatch.ts:288-333`), spawns through `ports.harness.spawn` (`:980-995`), and its single-flight is the per-ref **queue lease** (`app/queue.ts:1140-1263`), not the `loop-main` fence, so nesting cannot self-exclude. Boundary stays nine/six with the nested leg under `live-opencode`. |
| R-04 | **Resolved** | `spec:604` (DOD-7) now names the `provider-surface.test.ts` `LEGACY_HOOK_FILES` sha256 pin (confirmed at `provider-surface.test.ts:286-287`) and the PR-time change-surface review recorded at `code-review/review-iter-<N>.yaml` (confirmed as the reviewer's local-mode output, `.opencode/agent/reviewer.md:242`). `test-plan:55,2886` agree. |
| R-05 | **Resolved** | Appendix A row (`spec:688`: both kinds, schemas, keys, latest-wins, writer/reader, unchanged `delivery.state.v1`, no migration); DOD-9 (`spec:606`); plan phase 9 staging (`plan:2029`, obligation 9.5 `plan:1965-1972`). Target page's record-kind table located at `feature-state-layer.md:439-444` and consumer paragraph at `:51`. |
| R-06 | **Resolved** | Normative per-key source table (`spec:308-327`): `loop_id` = constant `loop-main`, never empty; `ceo_pid`/`ceo_session` live-only; `budget_epoch` persisted; `restarts` composition-supplied. Consequence paragraph enumerates exactly the nine genuinely optional bare keys (`spec:327`); AC-F1-2 (`spec:516`), API-4 (`spec:303`), Appendix F (`spec:758`), glossary (`spec:665,670`), KPI (`spec:87`). `test-plan:369-395` (worlds A/B/C, `loop_id=loop-main` and `restarts=0/10` in the absent world, `M114`/`M115`); plan 7.x restates the same sources (`plan:1596-1610`). Arithmetic reconciles: 14 keys, 3 booleans, 8-key additive tail, 9 bare keys. |
| R-07 | **Resolved** | `test-plan:1482-1511` asserts exactly one `resume` targeting `ses-resumable-1`, no `--title`, same id returned, `0` spawns/kills, `M103`; the hedge is gone. AC-F2-2 gained the `TC-INSTANCE-006` link (`test-plan:90`); `TC-PARITY-005`'s "zero resumes" is scoped to the restart path (`test-plan:2275`). Residual wording defect raised as new R-26. |
| R-08 | **Resolved** | D2 registers both families (`test-plan:206`), `TC-INSTANCE-004` row B says so (`test-plan:1445`), plan obligation 2.6 (`plan:952-962`) and 3.4 (`plan:1097-1102`) declare it; the harness path is declared in phase 2 and extended in phase 3. |
| R-09 | **Resolved** | Formula + shipped value in F-5 (`spec:187`), NFR-5 (`spec:384`), AC-F5-5 (`spec:559`), KPI (`spec:90`), Appendix B (`spec:710`), Appendix C (`spec:721`); `test-plan:1141-1171` asserts rows A/A′ (652 000 / 682 000, delta = interval delta) plus a source-level `652`/`652000` literal ban, `M109`; plan assumption (j) (`plan:628-631`) and phase-5 obligation/gate (`plan:1361-1363,1388,1428`). No hardcoded literal in any of the three artifacts. |
| R-10 | **Resolved** | `test-plan:132` now says 69 AC-linked / 5 NFR-only with the matrix as the single source; recomputation from §3.1 rows only confirms 69/5 and `TC-CONTRACT-003` is AC-linked (AC-F1-5). |
| R-11 | **Resolved** | `test-plan:2468` "New test hosts (17)" and `:2551` "17 new test suites" reconcile with the enumerated 9+3+3+2 and with the plan's 17 new suite files. |
| R-12 | **Resolved** | `test-plan:1114` asserts `progress-unreadable` present and `delivery-corroborator-unreadable` absent, `M105`; all five closed degradation values now have an owning assertion (`session-pid-unknown` 1510/951, `progress-unreadable` 1114, `delivery-corroborator-unreadable` 1138, `live-facts-unknown` 1510, `log-unavailable` 1642). |
| R-13 | **Resolved** | `test-plan:340,351` add `loop start` and `loop start --fresh-budget` refusal rows and the global-flag acceptance table; `M104` (`test-plan:2739`). |
| R-14 | **Resolved** | Appendix A (`spec:693`), DOD-9 (`spec:606`), plan phase 9 staging (`plan:2031`) and obligation 9.5. |
| R-15 | **Partially resolved** | F-3 (`spec:143`) and DM-5 (`spec:341`) state the compromise and the corpus/tag that carries the distinguishing facts; AC-F3-6 (`spec:539`) asserts "the corpus — not the reason token — is what distinguishes the two supervisors". **Remaining gap:** the *new current-truth page's required content* omits it — Appendix A's `feature-loop-supervision.md` row (`spec:680`) and the plan's documentation handoff (`plan:540-548`) list the backoff/verdict/corroborator but not the restart-reason compromise, which was the finding's third required location. Owned by `specification`. |
| R-16 | **Resolved** | `test-plan:1988,2007` make the baseline an in-suite committed literal, name no fixture file, and move the coordinator-suite observation to the gate battery (`test-plan:2779`); §6.1 keeps the fixture count at nine (`test-plan:2551`); plan obligation 8.4 (`plan:1834-1846`) declares no baseline fixture. |
| R-17 | **Resolved** | `spec:49` now cites INV-DM-3/5 and explicitly states INV-DM-2 is the single-flight/join rule; line spans match `feature-autonomous-delivery.md:162-165`. |
| R-18 | **Resolved** | F-1 (`spec:133`) and API-1 (`spec:300`) declare five end causes including "the composition's cycle driver reporting its declared end"; `test-plan:310,319` assert it and state "there is no 'cycle budget' concept"; `M111`; `test-plan:1899-1906` uses the same clause for the battle case. |
| R-19 | **Resolved** | DM-6 (`spec:342`) requires `stuckId` = `iterationId` = `<loopId>:<cycle ordinal>`, `coordinatorId`, `phase`, `killFailureReason` only on a failed kill, and no third record kind; the delivered payload confirms the field set (`contracts/coordinator.ts:394-421`). `test-plan:1029-1034` (`loop-main:3`, `M110`) and `:1229` (mismatch/failed-signal reasons). |
| R-20 | **Resolved** | `epoch-<n>;restarts=<count>;seq=<newest restart record's ledger sequence>` in F-3 (`spec:143`), DM-5 (`spec:341`), AC-F3-3 (`spec:536`), `test-plan:733` (each component computed from the store, `M112`), plan assumption (k). The sequence is durable and readable: `StateRecord.sequence` + `readRecords()` (`contracts/state.ts:47-56,300-340`). |
| R-21 | **Resolved** | F-1 (`spec:139`) and API-7 (`spec:306`) accept `--json`/`--verbose`/`--pretty` on every verb and exclude them from refusal; API-1 (`spec:300`) repeats it; `test-plan:341,352` assert acceptance, `M113`. Delivered `GLOBAL_FLAGS` unchanged. |
| N-01 | **Resolved** | §8.5 row 9 now reads "Five `CEO_LOOP_*` knobs plus `CEO_RESUME_TOKEN_LIMIT` (six shell knobs in total)" (`spec:373`). |
| N-02 | **Resolved** | Plan assumption (e) now names "the three nullable `loop.session` fields — `pid`, `processStartTimeMs`, and `title`" (`plan:578-584`). |
| N-03 | **Resolved** | Allocation block places M53 solely in phase 5 and states phase 4 ends at M52 (`plan:653-659`); phase-4 obligation 4.7 repeats it (`plan:1256-1258`); phase 5 obligation 5.6 owns M53/M109/M112 (`plan:1396-1402`). Register and plan agree. |

Disposition counts: **Resolved 23**, **Partially resolved 1** (R-15), **Unresolved 0**, **Regressed 0**.

## New findings

### R-22 — Four owned cases read `loop status`, whose verb dispatch the plan lands four phases later (blocking)

- **Severity**: major
- **Facet**: plan_code_area_coverage, cross_artifact_consistency
- **Locations**:
  - `chg-GH-348-test-plan.md:1504,1510` (`TC-INSTANCE-006` step 4 "Run `loop status --json`" and the expected `ceo_pid`/`ceo_session`/`degraded` block) — owned by plan phase 3.
  - `chg-GH-348-test-plan.md:1108,1114` (`TC-STUCK-004` step 3 + `degraded` assertion) and `:1138` (`TC-STUCK-005` "on `loop status`") — owned by plan phase 4.
  - `chg-GH-348-test-plan.md:951` (`TC-STOP-005` row C "reports `session-pid-unknown` on the bounded degradation list") — owned by plan phase 6.
  - `chg-GH-348-plan.yaml:908` (phase 2: "the `start` verb with `--foreground`"), `:1504-1506` (phase 6 adds `stop`/`reset`), `:1631-1632` (phase 7 "Complete the grammar, the refusals, the `log` verb, and the `status` projection dispatch").
- **Gap**: the `status` verb (and its text renderer) does not exist until phase 7, but three earlier phase gates run suites whose cases invoke it (`plan:1119-1121` phase-3 gate runs `loop-instance.test.ts`; `plan:1291-1293` phase-4 gate runs `loop-stuck.test.ts`; phase-6 gate runs `loop-stop.test.ts`). As written, an unknown subcommand is a `fallback.invocation` refusal (`spec:139`), so those cases fail at their own boundary and the plan's "every phase is independently committable and gate-green" rule (`plan:196-199`) is broken. Nothing in the plan or test plan declares an earlier, read-only `status` mount; the projection module (`domain/loop-status.ts`) is phase 1's, but the verb is not wired.
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: Land the read-only `status` verb dispatch (projection + bounded renderer; no verdict, no writes) with the command skeleton in phase 2/3, leaving phase 7 to complete the grammar/refusals, `log`, and the help inventory — or state in each earlier phase's obligations that the case asserts the projection function directly, and change the cases accordingly. Do not move the cases to phase 7 (they are the partial evidence of AC-F6-5/AC-F5-4/AC-F4-4).
- **Repeat of iteration 1?** No (new; iteration 1 did not report it).

### R-23 — Phase 4's owned cases assert the restart/stop flows the plan schedules in phases 5/6 (blocking)

- **Severity**: major
- **Facet**: plan_coverage, cross_artifact_consistency
- **Locations**:
  - `chg-GH-348-test-plan.md:1028-1034` (`TC-STUCK-001`: "only **then**, exactly one `coordinator.restart` with ordinal 1 … lands, followed by exactly one new session") and `spec:555` (AC-F5-1's proof: "… and the restart").
  - `chg-GH-348-test-plan.md:1467-1479` (`TC-INSTANCE-005` preconditions compose "the restart scenario (`TC-BACKOFF-001`) … the immediate-stop scenario (`TC-STOP-005` row B)"; expected outcome asserts the snapshots across restart and stop).
  - `chg-GH-348-plan.yaml:1205` (phase 4 contract: "The restart path is phase 5's and applies only after a CONFIRMED termination"); `:1420-1425` (phase 5 owns the delay schedule/ordinal/exhaustion and AC-F5-5); `:1504` (phase 6 adds the stop verbs); `:1112-1116` (phase 4's acceptance: AC-F5-1 and AC-F6-4 are claimed here).
- **Gap**: the two cases that close AC-F5-1 and AC-F6-4 at the phase-4 boundary require behaviour that does not exist until phases 5 and 6: a `coordinator.restart` record plus a second session (the restart branch), and the immediate-stop segment (the stop fold and `immediate` mode). Phase 4 explicitly disclaims the restart path, and the phase-4 gate (`plan:1281-1284`) asserts only verdict/terminate/outcome. The plan's mitigation ("its restart/stop steps are driven by phase-4 scripted boundaries … the scripted driver supplies the events", `plan:300-306`) cannot produce a *delivered* restart record or a second session, so the case cannot be green as written. This also breaks the plan's own AC-ownership rule (`plan:229-233`: the owning phase is "the phase whose commit lands the LAST of the AC's named cases").
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: Either declare in phase 4 the minimal confirmed-termination restart step (one `coordinator.restart` + one new session, with the delay/budget/exhaustion/`--fresh-budget` accounting still deferred to phase 5), and the `drain`-only stop segment needed by `TC-INSTANCE-005`; or narrow `TC-STUCK-001` and `TC-INSTANCE-005` to the verdict/terminate/outcome and re-home the restart/stop assertions to `TC-BACKOFF-001`/`TC-STOP-005` — in which case AC-F5-1's and AC-F6-4's proof lines (`spec:555,570`) and their owning phase must move with them (a `test_planning` + `specification` pass, not a silent transfer).
- **Repeat of iteration 1?** No (new; iteration 1 did not report it).

### R-24 — `TC-INSTANCE-007`'s second row asserts a start-time-capability gap that the delivered claim gate cannot produce

- **Severity**: minor
- **Facet**: cross_artifact_consistency, test_traceability
- **Locations**: `chg-GH-348-test-plan.md:1524,1527,1533-1535` (row B: "a second row that declares no start-time identity" → "exit 2 … `coordinator.fence` records: 0; session records: 0; spawns: 0 … before any record"); `packages/core/src/domain/coordinator-fence.ts:89,119` (`decideCoordinatorClaim` returns `capability-gap` **only** for `missing: "alive"`); `packages/core/src/contracts/coordinator.ts:600-625` (`startTimeIdentity` is a process-port capability consumed by the kill request, whose `capability-gap` outcome names the missing capability); `spec:189` (F-6 names only "an undeclared **alive** capability").
- **Gap**: a port without `startTimeIdentity` still admits the claim and can spawn; the gap is reported only when a kill is requested. Row B therefore expects a refusal at a point where the delivered contract performs none, and `spec`/API-1 (which name only the `alive` capability) give the plan no basis to add a pre-claim check.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Drop row B, or move the start-time-capability gap to the terminate path (a stuck episode whose kill yields `capability-gap`), and assert it there. If a pre-claim all-capabilities gate is genuinely intended, add it to F-6/API-1 first (a `specification` change) rather than to the case alone.
- **Repeat of iteration 1?** No.

### R-25 — "Eleven seams" but thirteen seams are enumerated (and the plan repeats the count)

- **Severity**: minor
- **Facet**: cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:2485` ("**Eleven seams** …"); the §7.1 table at `:2489-2501` enumerates 13 (`S-verb`, `S-status`, `S-spawn`, `S-session-record`, `S-backoff`, `S-stop`, `S-verdict`, `S-corroborator`, `S-terminate`, `S-lease`, `S-refind`, `S-log`, `S-exec`); `chg-GH-348-plan.yaml:46` ("§7.1 the eleven seams").
- **Gap**: the same class as iteration 1's R-11 — a stale headline count that would hide a future omission. The seams themselves are all declared and exercised; only the count is wrong.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Change both counts to 13 and state that the §7.1 table is the reference set.
- **Repeat of iteration 1?** No.

### R-26 — `TC-SPAWN-002` step 5 instructs phase 2 to drive a resume path that only exists in phase 3

- **Severity**: minor
- **Facet**: cross_artifact_consistency, test_traceability
- **Locations**: `chg-GH-348-test-plan.md:507` (step 5: "Drive the **one resume path** — the pid-less re-find owned and asserted by `TC-INSTANCE-006` — and assert the resume invocation carries **no** title argument"); `:512` ("The resume invocation **driven by `TC-INSTANCE-006`** carries no `--title` (asserted on that call's recorded argv, not on a hypothetical one)"); plan phase 2 (`plan:908-918`, start-only command + spawn suite) vs phase 3 (`plan:1093-1100`, the re-find/resume case).
- **Gap**: the step and its expected outcome contradict each other: the case cannot drive a resume (the resume path lands in phase 3, and `TC-INSTANCE-006` is its only driver). This is a by-product of the R-07 remediation: the property is asserted correctly in `TC-INSTANCE-006`, but the leftover instruction would make phase 2's suite unsatisfiable if implemented literally.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: Replace step 5 with a cross-reference only ("the no-title half is asserted on `TC-INSTANCE-006`'s recorded `resume` call") and keep the argv assertion in `TC-INSTANCE-006`.
- **Repeat of iteration 1?** No (introduced by the R-07 fix).

### R-27 — Plan assumption (a) still says the two decision records are untracked

- **Severity**: minor
- **Facet**: cross_artifact_consistency, decision_capture
- **Locations**: `chg-GH-348-plan.yaml:587-592` (assumption (a): "`git status --porcelain -- doc/decisions` shows only the two **untracked** records …"); contradicted by the plan's own binding block `plan:96-125` ("they are ALREADY COMMITTED on this branch … VERIFIED AT PLAN TIME … `git status --porcelain -- doc/decisions` is EMPTY"), by `pm-notes:401-409` (commit-boundary update, tracked in `400a96ad`), and by the tree (`git ls-files` succeeds on both paths; `git status --porcelain -- doc/decisions` empty).
- **Gap**: the stale premise survives in the assumptions list while phase 1 treats the records as verification targets. A coder reading (a) could conclude the records still need staging, which the plan elsewhere forbids.
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: Rewrite assumption (a) to the current truth (index rows committed at `11608b55`; both records tracked since `400a96ad`; status clean) and point it at the COMMIT-BOUNDARY REALITY block.
- **Repeat of iteration 1?** No.

### R-28 — Appendix A omits `feature-coordinator-supervision.md`'s "No pid on a spawned handle" limitation, which DM-3 falsifies

- **Severity**: minor
- **Facet**: system_spec_consistency, plan_doc_update_coverage
- **Locations**: `chg-GH-348-spec.md:681` (the page's required reconciliation: §1 family split, key-level scoping, §10 `ceo-loop.sh` byte-unchanged) and `:604` (DOD-9); `doc/spec/features/feature-coordinator-supervision.md:182-186` ("**No pid on a spawned handle.** `HarnessSessionHandle` carries no pid …"); `spec:339` (DM-3 adds the optional `pid` and the opencode adapter fills it).
- **Gap**: after this change the page asserts a false fact, and neither Appendix A, DOD-9, nor the plan's documentation handoff (`plan:520-560`) requires it to be reconciled. DOD-9's stale-statement scan only looks for "the outer loop is only `scripts/ceo-loop.sh`", so it cannot catch this drift.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Add to the `feature-coordinator-supervision.md` row: reconcile §3's pid limitation (the handle now carries an optional pid supplied by adapters that can; absent stays absent), and note that the coordinator's own composition still supplies none.
- **Repeat of iteration 1?** No.

### N-04 — DOD-9's scan and AC-F8-5's page/constant agreement name no observation mechanism in the spec

- **Severity**: nit
- **Facet**: dod_defined, plan_doc_update_coverage
- **Locations**: `chg-GH-348-spec.md:606` (DOD-9: "a scan finds no page that still describes the outer loop only as `scripts/ceo-loop.sh`"), `:590` (AC-F8-5: "a page/constant mismatch is a documentation-phase defect"); the mechanism lives only in `chg-GH-348-test-plan.md:49,2464` (`tests/checks/doc-conformance.test.ts`, documentation phase 7), which the plan deliberately excludes from delivery scope (`plan:557-560`).
- **Gap**: the doc phase's authoritative obligation list (Appendix A + DOD-9) does not name the guard, so the scan and the page/constant agreement have no owner in the artifact the doc-syncer is held to.
- **Suggested remediation target phase**: specification
- **Suggested fix**: Name `tests/checks/doc-conformance.test.ts`'s extension (required phrases for the new page, the stale-statement scan) in DOD-9, or point DOD-9 at the test-plan row.
- **Repeat of iteration 1?** No.

## Counts

Iteration-1 findings: 24 dispositioned — Resolved **23**, Partially resolved **1** (R-15), Unresolved **0**, Regressed **0**.

New findings: Critical **0**, Major **2** (R-22, R-23), Minor **5** (R-24…R-28), Nit **1** (N-04). Total new: **8**.

Blocking set (verdict fails): R-22, R-23. Neither is a repeat of an iteration-1 finding; both are iterations-1 misses in the plan/test-plan phase-boundary contract, not regressions of the remediation (every iteration-1 remediation is present and its named control exists).

## Remediation order (gate re-runs after each owner's pass)

1. **delivery_planning** — R-23 (phase 4's confirmed-restart step, or the case re-homing with the AC move), R-22 (the read-only `status` verb in the command skeleton, or the case/projection change), R-27 (assumption (a)).
2. **test_planning** — R-24 (the capability row), R-25 (the seam count), R-26 (`TC-SPAWN-002` step 5); plus the case-side halves of R-22/R-23 if the plan revision chooses the narrowing option.
3. **specification** — R-15's page-content half, R-28 (the coordinator page's pid limitation), N-04 (the doc-guard mechanism).

The gate must not reopen `delivery` for any of these. R-22 and R-23 are plan-boundary defects, so they should be settled before a third gate run; R-15, R-24…R-28 and N-04 are documentation/case corrections that can land in the same revision.

## Re-run note

Iteration 2. Every iteration-1 finding was re-checked against the artifact location that claims to satisfy it, and the corroborator, status-source and bound-formula rules were additionally checked against the delivered code (`DispatchLaneOwner.startedAt`, the claim gate, `StateRecord.sequence`, dispatch's injected delay, the help inventory and its pinned suites). The six headline counts (41 ACs, 74 cases, 78 links, 115 mutations, 41/41 AC ownership, 74/74 TC ownership) recompute correctly and the mutation allocation is a complete partition; no iteration-1 finding is persistent. No human pause is required: the two blocking findings are artifact remediations, and the TDR-0056/TDR-0057 `Proposed` status remains a PR-gate acceptance item.
