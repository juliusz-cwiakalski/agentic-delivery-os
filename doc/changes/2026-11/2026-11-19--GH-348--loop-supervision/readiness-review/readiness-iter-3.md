# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-348
Date: 2026-11-19
Pause Required: yes

## Inputs and checks performed

- Ticket GH-348 (`gh issue view 348`: four ACs, seven tasks, `change` + `spec-ready`, milestone M4, no comments) and the binding blueprint rows: `doc/planning/oss-tooling/milestones/m4/flip-plan.md:49,117` (F3 + its verification bar "loop start/stop/status/log/reset parity; durable stop across restarts; single instance; stuck session restarted"), `backlog.md:55-63` (§M4-S10), `ranking.md:12` (row 4, "F3: retires the shell loop after dispatch is trustworthy").
- `chg-GH-348-spec.md` **v1.3**, `chg-GH-348-test-plan.md` **revision 0.4**, `chg-GH-348-plan.yaml` (comment-carried phase data; nine delivery phases), `chg-GH-348-pm-notes.yaml` (R1–R4, the twelve iteration-1 rulings, the nine iteration-2 rulings, the commit-boundary update), `readiness-review/readiness-iter-1.md` (24 findings), `readiness-review/readiness-iter-2.md` (8 new findings).
- Delivered code re-read for the two corrections that decide the phase boundaries: `packages/cli/src/entrypoint.ts:217-231` (`selectPromptRequiredProgram` **drops** every command not in `PROMPT_REQUIRED_COMMANDS`) and `:447` (it is applied to every composed program), `packages/cli/src/help/prompt-required-commands.ts:11-39` (26 entries, `install` last), `packages/cli/src/production.ts:848` (the composer's map), `tests/structure/coordinator-production-session.test.ts:12-16` (the delivered D1 pattern: `createProductionComposer` → `runEntrypoint`).
- Mechanical gates re-run at `64e498aa` (clean tree, `TMPDIR=$PWD/tmp/tmpdir`): `jaiship plan validate GH-348` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `jaiship lint plan GH-348` → `verdict: valid`.

Recomputed counts (from the artifacts, not the hand-off):

| Quantity | Recomputed | Artifact claim | Agrees |
|---|---|---|---|
| ACs in spec §17 | 41 (5+4+6+5+7+5+4+5), 41 unique | "41 criteria" (§18, DOD-1) | yes |
| Test cases | 74 headers, 74 unique, 10 groups (5+6+7+7+11+7+7+8+6+10) | 74 | yes |
| AC→case links | 80 (41 + 39 extras, 25 criteria multi-observation); matrix == every case's `Related IDs` set | 80 | yes |
| AC-linked / NFR-only cases | 69 / 5 by the matrix (single source) | 69 / 5 | yes |
| §5.1 index AC column vs matrix | 68 AC-linked / 6 NFR-only (**drifts** on `TC-INSTANCE-006`, `TC-CONTRACT-003`) | 69 / 5 | **no** (R-32) |
| Mutation rows | 120 distinct ids, M1–M120 contiguous (126 table labels because the D1–D6/M1–M6 evidence table reuses `M1`–`M6`) | 120 | yes |
| Mutation allocation per phase | 1+17+10+25+13+10+25+19+0 = 120, complete partition, zero duplicates | same | yes (M89 misallocated, N-05) |
| AC ownership per plan phase (header) | 0+5+4+5+8+7+6+6+0 = 41, zero orphans, zero double-owned | same | yes |
| AC ownership per phase **Acceptance block** | 0+5+4+5+**7**+7+6+6+0 = **40** (phase 5 omits AC-F5-1) | 41 | **no** (R-31) |
| TC ownership per plan phase | 1+11+7+12+10+9+13+11+0 = 74, zero orphans, zero double-owned | same | yes |
| Plan declared paths | 123 file entries over 79 unique paths (per phase 14/22/8/12/11/7/20/12/17) | not claimed | n/a |
| Suites / fixtures | 17 new suites (9 behaviour + 3 structure + 3 checks + 2 conformance), 9 new fixtures, 9 extended, 15 reused | 17 / 9 / 9 / 15 | yes |
| Seams (§7.1) | 13 rows, 13 enumerated (both artifacts) | 13 | yes (R-25 closed) |
| AC group split per feature | F-1 5, F-2 4, F-3 6, F-4 5, F-5 7, F-6 5, F-7 4, F-8 5 | spec §17 | yes |

Applying the iteration-2 retro's method (for every case, the highest ordinal among the phases implementing the behaviour it asserts must be ≤ its owning phase's ordinal) to all 74 cases found **three** violations — two of them new: `TC-PARITY-005`, `TC-SPAWN-002` and the two D1 halves of `TC-SPAWN-001`/`-005`. Every other case is self-sufficient at its boundary.

## Facet Summary

- spec_completeness: **PASS** — v1.3 closes R-28 (Appendix A row and DOD-9 now require the coordinator page's §3 pid limitation to be reconciled, plus a re-read of its other declared limitations), R-15's page half (the new page's required content names the restart-reason compromise) and N-04 (DOD-9 names the phase-7 documentation guard; AC-F8-5 names the mechanism).
- ac_quality: **PASS** — all 41 remain objectively testable, and the AC-F5-1 / AC-F6-4 texts are consistent with their new owners. One stale proof sentence is a nit (R-33), not a defect in the criterion.
- plan_coverage: **FAIL** — R-29 and R-30: two owned cases and one driver assignment need behaviour/composition a later phase introduces, so the plan's own "every phase is independently committable and gate-green" rule (`plan:230-247`) is broken twice more.
- test_traceability: **PASS** — 41/41 ACs and 74/74 TCs each have exactly one owning phase; 80 links reconcile; every case names its AC/NFR and target layer. The `TC-INSTANCE-006`/`TC-CONTRACT-003` index-column drift is a summary defect (R-32), not a link defect.
- cross_artifact_consistency: **FAIL** — R-29, R-30, R-26 (residual) are blocking; R-31, R-32, R-33 are documentation-level drifts.
- decision_capture: **PASS** — DEC-1…DEC-7 in spec §15; TDR-0055/TDR-0056 tracked (400a96ad), `Proposed`, cited in both artifacts, treated as verification targets by phase 1, and re-checked by the phase-1 and phase-9 done criteria. No new decision is required by this pass.
- system_spec_consistency: **PASS** — the doc obligations now cover the only contradiction DM-3 creates in `doc/spec/**`; nothing in the change contradicts a delivered contract. The two AC ownership moves are recorded in `doc/spec` only through AC text, which stays true.
- plan_doc_update_coverage: **PASS** — all Appendix A doc targets are staged in phase 9 (16 files: 13 pages + the three M4 planning pages), the M4 reference page is authored in phase 7, and the restart-reason and coordinator-pid content obligations are in both the spec and the plan's handoff.
- plan_code_area_coverage: **PASS** — 123 declared entries over 79 paths cover every authored/edited file per phase, including the incremental `loop.ts`/`production.ts` mounts; the R-22 gap is closed by phase 2's declared `status` mount.
- dod_defined: **PASS** — DOD-1…DOD-9 each name an observation that exists; DOD-7's two halves, DOD-8's pin controls and DOD-9's guard are all real.

## Disposition of iteration-2 findings

| ID | Status | Evidence |
|---|---|---|
| R-22 (status verb four phases late) | **Resolved** | `plan:190-228` (INCREMENTAL VERB SURFACE), `plan:978-985` (phase 2 mounts `start --foreground`, the read-only `status`, the log sink and `delivery.loop.log.v1`), `plan:1050-1063` (obligation 2.5), `plan:1138-1147` (phase-2 gate asserts `loop status` composes with 0 appends and 0 handler reads). Every named case now reads a verb mounted by phase 2: `test-plan:1523-1534` (`TC-INSTANCE-006`, p3), `:1108,1114` + `:1138` (`TC-STUCK-004`/`-005`, p4), `:964` (`TC-STOP-005` row C, p6). Phases 3–6 add only refusal mappings, degradation values, `--fresh-budget`, `stop`/`reset`; phase 7 owns the final grammar/block/bounded read and the 26→27 repin (`plan:1826-1836`, `:1896-1921`). |
| R-23 (phase 4 asserting phases 5/6 flows) | **Resolved** | `test-plan:1031` (`TC-STUCK-001` = verdict/terminate/outcome/admission only), `:1049` (explicit out-of-scope), `:646,660` (`TC-BACKOFF-001` row A = the `coordinator.restart` record + second session + ≤1-session), `:949,963` (`TC-STOP-005` row B = the immediate-stop ≤1-session row), `:1486,1503` (`TC-INSTANCE-005` composes no restart and no stop), `:132` + `:2800` (segment table + self-sufficiency rule). The two ownership moves are consistent in the plan header (`plan:317-378`), phase 3 (`plan:1288-1290`), phase 4 (`plan:1481-1486`), phase 5 (`plan:1552,1563-1569`), phase 6 (`plan:1730-1734,1778-1781`) and the AC arithmetic (41). Control rows exist: `M116`/`M117`/`M120`. Residual: the phase-5 **Acceptance** summary line (R-31). |
| R-24 (start-time capability gap at the claim) | **Resolved** | `test-plan:1536-1562` (`TC-INSTANCE-007` row B admits: one `coordinator.fence`, one spawn, no gap), `:1244-1252` (`TC-STUCK-008` row E asserts the kill-path `capability-gap`, 0 signals, terminal consequences), `plan:1215-1220` (phase 3 states the claim checks `alive` only), `plan:1389-1392` (phase 4 owns the kill-path gap); controls `M118`/`M119`. |
| R-25 (eleven vs thirteen seams) | **Resolved** | `test-plan:2511` ("Thirteen seams … thirteen rows, thirteen seams", table at `:2513-2527` enumerates 13); `plan:55-60` and `:2044` say THIRTEEN. No remaining "eleven seams" claim. |
| R-26 (`TC-SPAWN-002` step 5 drives a phase-3 resume) | **Partially resolved — repeat** | The *driving* instruction is gone (`test-plan:516`: "This step drives nothing … `TC-INSTANCE-006` is the sole driver"), but the step and the expected outcome still **assert** the phase-3 recording: `test-plan:516` "Read the `resume` invocation `TC-INSTANCE-006` recorded, and assert only its argv carries no `--title`" and `:521` "asserted on that call's recorded argv, not on a hypothetical one". `TC-SPAWN-002` is owned by **phase 2** (`plan:384`, `:1132-1134`) and its suite is in the phase-2 gate (`plan:1148`), while the only resume path is phase 3 (`plan:1242-1244`, `:1255-1258`). The plan's phase-2 gate expectation repeats it ("none on a resume", `plan:1139`). |
| R-27 (assumption (a) says untracked) | **Resolved** | `plan:704-711` now states both records are TRACKED (400a96ad), the index rows landed at `11608b55`, `git status --porcelain -- doc/decisions` is empty, and points at COMMIT-BOUNDARY REALITY; phase 1's done criterion is the mechanical `git ls-files --error-unmatch` (`plan:931-933`). |
| R-28 (coordinator page's pid limitation unowned) | **Resolved** | `spec:681` (Appendix A row: reconcile §3's "No pid on a spawned handle", re-read every other limitation), `spec:606` (DOD-9 names the page), `plan:652-660` (documentation handoff), `plan:2263` (phase-9 staging). |
| N-04 (doc guard mechanism unnamed in the spec) | **Resolved** | `spec:606` (DOD-9 names the phase-7 documentation-phase guard and its zero-hit grep) and `spec:590` (AC-F8-5 names the phase-7 guard comparison and that its failure is reported against the documentation phase). `test-plan:49,2464` remain consistent with it. |
| R-15 page half (restart-reason compromise absent from the new page) | **Resolved** | `spec:680` (Appendix A row now carries the compromise in full), `spec:606` (DOD-9 lists it among the page's required statements), `plan:639-651` (handoff). |

Disposition counts: **Resolved 7**, **Partially resolved 1** (R-26), **Unresolved 0**, **Regressed 0**.

## New findings

### R-29 — `TC-PARITY-005` (owned by phase 2) asserts the phase-4/5 stuck-restart path (blocking)

- **Severity**: major
- **Facet**: plan_coverage, cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:2277-2306` (`TC-PARITY-005`: "Precondition: a stuck restart reached below the budget bound"; step 1 "Run the restart"; "exactly one fresh spawn … the new session id differs"); `chg-GH-348-plan.yaml:384` (TC map, phase 2) and `:1132-1134` (phase-2 acceptance claims AC-F2-2 via `SPAWN-002/005/006 + PARITY-005`); `chg-GH-348-plan.yaml:1148` (phase-2 gate runs `loop-spawn.test.ts`); `chg-GH-348-plan.yaml:1084-1091` (phase 2 lands the spawn, the session record and the log sink — no verdict, no restart).
- **Gap**: the case's precondition and step 1 require a stuck verdict (phase 4) and the restart fold (phase 5), and even its observable core — "a second session starts fresh instead of resuming" — needs the session-resolution branch that is phase 3's (`plan:1242-1244`). At the phase-2 boundary there is no path that starts a second session at all, so `tests/behaviour/loop-spawn.test.ts` cannot be green as written. This is the iteration-2 R-22/R-23 class in a case neither pass named, and it also means AC-F2-2's ownership rests on a case its owning phase cannot land — breaking the plan's own rule that the owner is "the phase whose commit lands the LAST of the AC's named cases" (`plan:318-321`).
- **Suggested remediation target phase**: delivery_planning (+ test_planning for the case text)
- **Suggested fix**: either (a) split the case as §3.1 already does for the other three — keep the phase-2 segment (a fresh acquisition renders one `--agent ceo`/`--model`/`--title` and reads no `resume-context-limit`) and re-observe the post-restart freshness in a labelled phase-5 row (e.g. a `TC-BACKOFF-001` row C), moving **AC-F2-2** to phase 5 and recomputing 41/41 and 74/74; or (b) narrow `TC-PARITY-005` to the process-restart/ended-session replacement path and re-home it to **phase 3**, keeping AC-F2-2 in phase 2 only if its other cases carry the AC's full text. Do not leave the case in phase 2 with a phase-5 precondition.
- **Repeat of iteration 2?** Not of a specific finding id; it is a **new instance of the class** iteration 2 caught and iteration 3 was asked to prove absent. That recurrence is the escalation signal.

### R-30 — Phase 2's D1 cases cannot reach `loop`, which the plan itself says the production entrypoint does not compose (blocking)

- **Severity**: major
- **Facet**: plan_coverage, cross_artifact_consistency
- **Locations**: `chg-GH-348-plan.yaml:978-985` ("The family is NOT prompt-required and the production entrypoint does not compose it") and `:1062-1063` ("The family stays OUT of `PROMPT_REQUIRED_COMMANDS` until phase 7's repin"); `:1826-1836` (phase 7 is the first point at which the family is composed); `chg-GH-348-test-plan.md:214` (driver D1 = `createProductionComposer(...)` → **`runEntrypoint`**), `:484` (`TC-SPAWN-001` step 1: "Run `loop start --foreground` on D2 **and on D1**"), `:579` (`TC-SPAWN-005`'s D1 half); `chg-GH-348-plan.yaml:1084-1091` and `:1148-1150` (phase 2 authors and gates `loop-production-session.test.ts`).
- **Gap**: the delivered entrypoint filters every composed program to the prompt-required set and **drops extras** (`packages/cli/src/entrypoint.ts:217-231`, applied at `:447`; the composer's map is built from the same list, `production.ts:848`), so until phase 7's repin a `loop` invocation through `runEntrypoint` reaches no command definition. The plan states this explicitly and nevertheless assigns D1 cases to phase 2, whose gate runs them. Either the two D1 halves move to phase 7 (and their AC observations with them) or D1 must be redefined for these cases as "the production composer, dispatched without the entrypoint's prompt-required restriction" — the artifacts currently say both things.
- **Suggested remediation target phase**: delivery_planning (+ test_planning for the driver definition)
- **Suggested fix**: state in phase 2 and in §4's D1 paragraph that the pre-repin D1 half composes `createProductionComposer` and dispatches the program directly (no `selectPromptRequiredProgram`), with the `runEntrypoint` half deferred to phase 7 as a labelled re-observation; or drop D1 from `TC-SPAWN-001`/`-005` until phase 7 and say so in their expected outcomes. Add the check to the phase-gate self-sufficiency rule: "a case that runs through `runEntrypoint` may only assert a family that is prompt-required at that boundary".
- **Repeat of iteration 2?** No — but it is the first *mechanical* (code-verified) consequence of the R-22 ruling, and it is the same self-sufficiency class.

### R-31 — Phase 5's Acceptance block omits AC-F5-1 and reports 7 ACs where the header reports 8 (minor)

- **Severity**: minor
- **Facet**: cross_artifact_consistency, plan_coverage
- **Locations**: `chg-GH-348-plan.yaml:1649-1650` ("Acceptance: AC-F3-1..AC-F3-6 … AC-F5-5 (STUCK-006). **7 ACs**, 10 TCs") versus `plan:342-346` (header: Phase 5 (8), including "AC-F5-1 (STUCK-001/011 in phase 4 + BACKOFF-001 row A here — its LAST observation)") and `plan:1552` (the phase-5 contract names AC-F5-1) and `plan:1608-1612` (obligation 5.4 owns row A).
- **Gap**: the R-23 re-ownership landed in the header, the contract, the obligations and the TC arithmetic but not in phase 5's Acceptance summary, so the per-phase Acceptance blocks now sum to **40** and no phase claims AC-F5-1. A coder closing phase 5 from its own block would not record the AC it is the last to observe.
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: add AC-F5-1 (BACKOFF-001 row A) to phase 5's Acceptance list and change "7 ACs" to "8 ACs"; confirm the nine Acceptance sums re-add to 41.
- **Repeat of iteration 2?** No (introduced by the R-23 re-ownership pass).

### R-32 — §5.1's index AC column lags the matrix, so its own case inventory computes 68/6 instead of 69/5 (minor)

- **Severity**: minor
- **Facet**: test_traceability, cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:267` (`TC-INSTANCE-006` lists `AC-F6-5`; the matrix and the case's `Related IDs` also carry `AC-F2-2` — `:90`, `:1510`), `:286` (`TC-CONTRACT-003` lists only `NFR-11`; the matrix carries `AC-F1-5` — `:88`; §3.1 `:141` says it "is AC-linked (AC-F1-5) and is not counted as NFR-only"), against `:128,141` and the revision log's `:2918` "69 AC-linked / 5 NFR-only".
- **Gap**: a reader recomputing the inventory from §5.1 — the table the index is for — gets 68 AC-linked / 6 NFR-only, contradicting the sentence that names five NFR-only cases. Same class as R-25 (a summary count that can hide a future omission); the matrix is authoritative but the index must not disagree with it.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: add `AC-F2-2` to `TC-INSTANCE-006`'s index row and `AC-F1-5` to `TC-CONTRACT-003`'s, so the index recomputes to 69/5; note in §3.1 that the index column mirrors the matrix verbatim.
- **Repeat of iteration 2?** No (residual of R-10, which corrected the sentence but not the index rows).

### R-33 — AC-F6-4's spec proof sentence names two of the three flows that now carry it (nit)

- **Severity**: nit
- **Facet**: cross_artifact_consistency, ac_quality
- **Locations**: `chg-GH-348-spec.md:570` ("Scenario invariant asserted after every step of the takeover and restart flows") versus `chg-GH-348-test-plan.md:114,138` (the AC's cases are `TC-INSTANCE-005` (takeover + unconfirmed termination, phase 4), `TC-STOP-005` row B (**immediate stop**, phase 6) and `TC-BACKOFF-001` row A (restart, phase 5)) and `plan:1778-1781` (phase 6 owns it).
- **Gap**: the AC's own evidence sentence omits the flow that now supplies its last observation, so a reviewer reading only §17 would not know where AC-F6-4 closes. The criterion itself ("at no observation point … no spawn while a live recorded session is present") stays true and testable.
- **Suggested remediation target phase**: specification
- **Suggested fix**: state "...after every step of the takeover, restart and immediate-stop flows, split across the phases that implement them", and note that the last observation is the immediate-stop segment.
- **Repeat of iteration 2?** No.

### N-05 — `M89` is allocated to a phase that does not own its only named case (nit)

- **Severity**: nit
- **Facet**: plan_coverage
- **Locations**: `chg-GH-348-plan.yaml:773` (phase 8 owns `M89`) and `:2132-2133` (phase 8's obligation lists it); `chg-GH-348-test-plan.md:2740` (`M89` must fail `TC-CONTRACT-003`); `plan:401-404` (TC map: `TC-CONTRACT-003` is phase 7) and `plan:758-762` (the allocation rule: "A row is allocated to the phase that OWNS the case it names").
- **Gap**: the row is executable at phase 8 (the phase-7 suite is in the tree) but the partition no longer matches the rule the same block states, and phase 7 — the phase that lands the read-economy case — does not carry its own mutation control. Count-neutral (`120` still a complete partition), so no row is dropped or doubled.
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: move `M89` to phase 7's list (making 26/18) and to obligation 7.7, or amend the rule to say a read-economy row is exercised with the battery; either is one line.
- **Repeat of iteration 2?** No.

### N-06 — `TC-BACKOFF-003` row A's "fold `loop stop --mode drain`" reads as the phase-6 verb (nit)

- **Severity**: nit
- **Facet**: cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:709` (step 1) and `:703` (fixture: "a cycle driver whose `beforeCycle` hook folds a stop during the recorded wait") versus `plan:1543-1546` ("No gate here needs the `stop`/`reset` verbs (phase 6)") and `plan:1698-1702` (phase 6 adds them).
- **Gap**: the intended mechanism is a seeded `loop.stop` fold through the phase-1 reader, which phase 5 can do; the wording names the verb, which phase 5 cannot. This is the same ambiguity class that produced R-22 and R-26 and costs one edit to remove.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: reword to "fold a `requested`/`drain` `loop.stop` record at the wait boundary (seeded, not invoked: the verb lands in phase 6)".
- **Repeat of iteration 2?** No.

## Recorded, not a blocker

`TC-STUCK-008` row E (`test-plan:1249`, precondition at `:1235`) asserts the kill-path `capability-gap` outcome, zero signals and the terminal consequences but **not** a command exit, and says so: "the spec names no exit for a kill-time capability gap" (`spec:189` names exits for `already-running` and the claim-time gap only; API-1 names `coordinator.session.kill-failed` for the unconfirmed path). The disclosure is honest and the assertion set is coherent, so this is **not** a readiness gap. It is a documentation-phase clarification if the exit is meant to be fixed: name the kill-time gap's exit (the delivered `capability-gap` projection) in F-6/API-1 during `system_spec_update`. Owner phase: `specification`, non-blocking.

## Counts

Iteration-2 findings: 9 dispositioned (8 findings + R-15's page half) — Resolved **7**, Partially resolved **1** (R-26, **repeat**), Unresolved **0**, Regressed **0**.

New findings: Critical **0**, Major **2** (R-29, R-30), Minor **2** (R-31, R-32), Nit **3** (R-33, N-05, N-06). Total new: **7**.

Blocking set (verdict fails): **R-26 residual**, **R-29**, **R-30**. Every blocking finding is a phase-gate self-sufficiency defect: a case or driver asserts behaviour a later phase implements. R-26 is a repeat of an iteration-2 finding and R-29/R-30 are new instances of the class iteration 2 named and iteration 3 was asked to close — the class, not just the instances, is what keeps failing, which is the escalation trigger.

## Remediation order (gate re-runs after each owner's pass)

1. **test_planning** — R-29's case split/narrowing (with its ownership consequence stated), R-30's D1 definition, R-26's residual (delete the assertion from `TC-SPAWN-002`, keep it in `TC-INSTANCE-006`), R-32 (index rows), N-06 (backoff wording).
2. **delivery_planning** — R-29's AC/TC recomputation if AC-F2-2 moves (41/41, 74/74, mutation allocation), R-30's phase/D1 boundary statements and the gate-rule addition, R-31 (phase-5 Acceptance), N-05 (M89).
3. **specification** — R-33 (AC-F6-4's proof sentence); optionally the kill-time capability-gap exit as a documentation-phase clarification.

The gate must not reopen `delivery` for any of these.

## Re-run note — escalation (iteration cap reached)

Iteration 3 of 3. Every iteration-2 finding was re-checked at the location that claims to satisfy it, the two ownership moves were verified in the header, the four phase contracts, obligations 5.4/6.4, §3.1, §7.5 and the arithmetic, and the six headline counts (41 ACs, 74 cases, 80 links, 120 mutations, 41/41 AC ownership, 74/74 TC ownership) recompute correctly with a complete mutation partition and no dropped or doubled row. The mechanical gates are green (`plan validate` valid/full/readyForDevelopment=true, `lint plan` valid).

The blocking defect is unchanged in **kind** from iteration 2 and is now demonstrated against delivered code: the phase-gate self-sufficiency rule the plan adopted needs to be applied per assertion, not per case group, and the inventory-driven entrypoint adds a mechanical constraint the rule does not yet state. Three iterations have each found a fresh instance of it. Per the workflow's cap, this verdict **pauses for the human**: authorize a fourth authoring pass under the stricter rule (every case names, per assertion, the phase implementing it, plus the prompt-required entrypoint constraint), or accept a recorded deviation with the phase boundaries re-declared. No artifact was edited and no commit was made by this review.
