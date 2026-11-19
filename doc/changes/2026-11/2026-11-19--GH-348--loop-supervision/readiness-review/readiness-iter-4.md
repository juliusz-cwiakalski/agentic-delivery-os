# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-348
Date: 2026-11-19
Pause Required: yes

## Inputs and checks performed

- Ticket GH-348 (`gh issue view 348`): state OPEN, milestone M4, four acceptance
  criteria and seven tasks (unchanged); labels now `change` + `blocked` (no
  `spec-ready`). The blueprint dependency M4-S9 (GH-347, dispatch core parity) is
  the delivered dispatch family this plan builds on. The label delta is a tracker
  observation only — it changes nothing in the artifact critique — but the PM
  should reconcile it when the ticket resumes.
- Binding blueprint rows re-read: `doc/planning/oss-tooling/milestones/m4/flip-plan.md`
  F3 and its verification bar; `backlog.md:55-66` (§M4-S10, "Depends on: M4-S9");
  `ranking.md` row 4.
- `chg-GH-348-spec.md` **v1.4**, `chg-GH-348-test-plan.md` **revision 0.5**,
  `chg-GH-348-plan.yaml` (comment-carried phase data; nine delivery phases),
  `chg-GH-348-pm-notes.yaml` (R1–R4, the twelve iteration-1 rulings, the nine
  iteration-2 rulings, the iteration-3 escalation, the human **Option A**
  authorization and the four-pass remediation record), and
  `readiness-review/readiness-iter-1.md` … `-3.md`.
- Delivered code re-read for the mechanical constraints the eight findings depend
  on: `packages/cli/src/entrypoint.ts:217-231` (`selectPromptRequiredProgram`
  drops every command not in `PROMPT_REQUIRED_COMMANDS`, throws only for a
  declared name the program lacks) and `:447` (applied to every composed
  program); `packages/cli/src/help/prompt-required-commands.ts:11-39` (26
  entries, `install` last); `doc/decisions/TDR-0055-*`/`TDR-0056-*` (`status:
  Proposed`, both tracked, `git status --porcelain -- doc/decisions` empty).
- Mechanical gates at `28e0f95b` (clean tree): `plan validate GH-348` →
  `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `lint plan GH-348` →
  `valid`; strict `yaml.safe_load` parses the plan (9 phases, per-phase `files`
  lengths 14/21/8/12/11/7/21/12/17).
- **Scope of this run**: exactly the eight findings the human authorized
  (R-26, R-29, R-30, R-31, R-32, R-33, N-05, N-06) at their exact locations,
  then the class check iteration 3 escalated, applied as a sweep over all 74
  cases and all nine phase gates. Already-decided items (R1–R4, the ten declared
  divergences, the reused exhaustion identity, the nine/six proof boundary and
  the command-runtime proof level, the non-reconciliation of shell and prompt
  surfaces, the TDRs' `Proposed` status, the kill-path capability-gap exit as a
  documentation-phase clarification) were treated as settled and not reopened.

Recomputed counts (from the artifacts, not the hand-off):

| Quantity | Recomputed | Artifact claim | Agrees |
|---|---|---|---|
| ACs in spec §17 | 41 (5+4+6+5+7+5+4+5), 41 unique | "41 criteria" (§18, DOD-1) | yes |
| Test cases | 74 headers, 74 unique, 10 groups (5+6+7+7+11+7+7+8+6+10) | 74 | yes |
| AC→case links | 80 (41 + 39 extras; 25 criteria multi-observation) | 80 | yes |
| AC-linked / NFR-only cases | 69 / 5 | 69 / 5 | yes |
| §5.1 index AC column vs matrix | **identical on all 74 rows**; recomputes 69 / 5 | 69 / 5 | yes (R-32 closed) |
| Every case's `Related IDs` vs its index row | identical for all 74 | — | yes |
| Mutation rows | 120 distinct ids, M1–M120 contiguous, no gap, no duplicate | 120 | yes |
| Mutation allocation per phase | 1+16+11+25+13+10+26+18+0 = 120, complete partition, zero duplicates | same | yes (N-05 closed) |
| AC ownership per plan phase (header) | 0+4+5+5+8+7+6+6+0 = 41, zero orphans, zero double-owned | same | yes |
| AC ownership per phase **Acceptance block** | the same 41 | 41 | yes (R-31 closed) |
| TC ownership per plan phase | 1+10+8+12+10+9+13+11+0 = 74, zero orphans, zero double-owned | same | yes |
| Plan declared paths | 123 file entries over 79 unique paths (per phase 14/21/8/12/11/7/21/12/17) | not claimed | n/a |
| Suites / fixtures | 17 new suites (9 behaviour + 3 structure + 3 checks + 2 conformance), 9 new fixtures, 9 extended, 15 reused | same | yes |
| Seams (§7.1) | 13 rows, 13 enumerated in both artifacts | 13 | yes |
| AC group split per feature | F-1 5, F-2 4, F-3 6, F-4 5, F-5 7, F-6 5, F-7 4, F-8 5 | spec §17 | yes |
| Spec ACs → ticket ACs / seven tasks | every ticket AC and every task maps to a named F-/AC- group (Appendix B) | complete | yes |

## Facet Summary

- spec_completeness: **PASS** — the ticket's four ACs and seven tasks still map
  completely (Appendix B); v1.4 changed only AC-F6-4's proof sentence.
- ac_quality: **PASS** — all 41 remain objectively testable; AC-F6-4's evidence
  sentence now names all three flows and their phase split (R-33 closed).
- plan_coverage: **FAIL** — three phase-2 cases assert behaviour their boundary
  does not implement (R-34, R-35, R-36). The plan's own rule "NO PHASE ASSERTS a
  verb or projection a LATER phase implements" (`plan:238-242`) and the
  phase-gate self-sufficiency rule (`plan:243-256`) are broken at phase 2.
- test_traceability: **PASS** — 41/41 ACs and 74/74 TCs each have exactly one
  owning phase; 80 links reconcile; the index mirrors the matrix exactly. The
  three failing cases are traceable; they are boundary defects, not link defects.
- cross_artifact_consistency: **FAIL** — R-34/R-35/R-36 (test-plan case text vs
  the plan's phase map and the delivered entrypoint), plus minors R-37, R-38,
  R-39 and nit N-07. R-26, R-29, R-31, R-32, R-33, N-05, N-06 are closed.
- decision_capture: **PASS** — DEC-1…DEC-7 in spec §15; TDR-0055/TDR-0056
  tracked, `Proposed`, cited in both artifacts, treated by phase 1 as
  verification targets, re-checked by the phase-9 done criterion. No new
  decision is required by revision 0.5.
- system_spec_consistency: **PASS** — no contradiction with `doc/spec/**`;
  Appendix A still covers the one page DM-3 falsifies and the pid reconciliation;
  the AC-F2-2 ownership move is a plan fact and does not falsify any AC text.
- plan_doc_update_coverage: **PASS** — the 16 current-truth targets are staged in
  phase 9, the M4 reference page is authored in phase 7, and the spec-owned
  content obligations (restart-reason compromise, coordinator pid, doc guard) are
  unchanged and still present.
- plan_code_area_coverage: **PASS** — 123 declared entries over 79 paths cover
  every authored/edited file per phase; R-30's scope move is visible (phase 2 no
  longer declares `loop-production-session.test.ts`, phase 7 does). The phase-2
  cases that need a D1/verdict path have no declared phase-2 home — that is the
  defect recorded as R-34/R-35/R-36, not a missing declaration.
- dod_defined: **PASS** — DOD-1…DOD-9 each name an observation that exists; DOD-9
  names the phase-7 guard and the two required page contents.

## Disposition of the eight authorized findings

| ID | Status | Evidence at the claimed location |
|---|---|---|
| R-26 (`TC-SPAWN-002` asserted the phase-3 resume record) | **Resolved** | `test-plan:501` (title drops the resume claim), `:523` (step 5 is "**Pointer only, no assertion**"; "This case neither drives a resume nor reads the phase-3 session record"), `:528` ("**No resume assertion here**"). The phase-2 gate expectation (`plan:1206-1211`) repeats no resume/`--title` assertion. `M18` now names `TC-INSTANCE-006` (`test-plan:2633`, `:2802`). |
| R-29 (`TC-PARITY-005` required a stuck verdict + restart in phase 2) | **Resolved** | `test-plan:2286-2318` — narrowed to the ended-session replacement: recorded `ended` prior session, D2, "**No stuck verdict, no restart precondition, and no fold are involved**"; owner **phase 3**; zero `resume` for the previous id. Plan: TC map phase 3 (`plan:425-429`), AC ownership phase 3 (`plan:361-365`), phase-3 contract and obligation 3.4 (`plan:1289-1299`, `:1318-1321`), phase-3 Acceptance (`plan:1359-1362`), header sums **41** ACs / **74** TCs (`plan:346-452`); phase 2 lists 4 ACs and names the move (`plan:1193-1199`). Both sums recompute exactly. |
| R-30 (phase-2 cases ran `runEntrypoint`) | **Not closed — repeat** | The two named halves *are* fixed: `test-plan:484-499` (D2 only + labelled phase-7 re-observation) and `:595-611`; no phase-2 obligation or gate names `loop-production-session.test.ts` (`plan:1146-1152`, `:1217`), and phase 7 declares and gates it (`plan:2016-2023`, `:2083`, `:2107`). **But the closure criterion as authorized — "no phase-2 case or gate runs `runEntrypoint`" — is false**: `TC-SPAWN-004` step 3 (`test-plan:576`) and `TC-PARITY-008` step 1 (`test-plan:2385`) still drive **D1**, and both are owned and gated by phase 2. See R-34/R-35. The ENTRYPOINT RULE itself is stated correctly in all three artifacts (`test-plan:2816`, `:2823`; `plan:250-256`). |
| R-31 (phase-5 Acceptance omitted AC-F5-1) | **Resolved** | `plan:1725-1729` lists AC-F5-1 "(STUCK-001/011 in phase 4 + BACKOFF-001 row A here — its LAST observation)" and states "**8 ACs, 10 TCs**"; the nine Acceptance blocks now sum to **41** (0+4+5+5+8+7+6+6+0), recomputed per phase. |
| R-32 (§5.1 index drifted from the matrix) | **Resolved** | `test-plan:273` carries `AC-F6-5`, `AC-F2-2`; `:292` carries `AC-F1-5`, `NFR-11`. A field-by-field comparison of all 74 index rows against the matrix and against each case's `Related IDs` finds **zero** differences; the index recomputes **69 / 5**. `test-plan:136` states the index mirrors the matrix verbatim. |
| R-33 (AC-F6-4 proof sentence named two of three flows) | **Resolved** | `spec:570` now reads "after every step of the **takeover, restart and immediate-stop** flows, split across the phases that implement them: … phase 4 … phase 5 … the last observation is the immediate-stop segment in phase 6". `spec:799` records the v1.4 change and the unchanged AC count. |
| N-05 (`M89` allocated to a phase that does not own its case) | **Resolved** | `plan:817-818` phase 7 owns `M89`; `:2024-2026` ("its named case TC-CONTRACT-003 is this phase's, N-05"); phase 7 obligation 7.8 lists it; phase 8 `:2231-2233` states it is phase 7's. `M18` is phase 3's (`plan:813`) and phase 2's note says so (`plan:1153-1157`). The partition still sums to **120** exactly once (verified id-by-id, M1–M120). |
| N-06 (`TC-BACKOFF-003` row A read as the phase-6 verb) | **Resolved** | `test-plan:702` (fixture folds a `requested` `loop.stop` **record**), `:709` ("fold a `requested`/`drain` `loop.stop` record at the wait boundary — **seeded, not invoked: the `loop stop` verb lands in phase 6**"). No case owned before phase 6 invokes `loop stop` (swept across all 74). |

Disposition counts: **Resolved 7**, **Not closed 1** (R-30, on its universal
closure criterion), **Unresolved 0**, **Regressed 0**.

## Class check (the question iteration 3 escalated)

**Method.** For each of the 74 cases: the owning phase from the plan's TC map;
every assertion in its §5.2 body; the highest ordinal among the phases that
implement any behaviour those assertions require; the driver it names; and for
D1, whether the command family is prompt-required at that boundary. Then each of
the nine phase gates was read for any suite, fixture, verb, projection or record
implemented later. Then every count was recomputed from the artifacts.

**Result — stated as a property, not as a list of exceptions.**

The self-sufficiency property holds for 71 of 74 cases. The three failures are
one property, not three accidents: **at the phase-2 boundary a case may assert
only what the D2 edge can drive over the spawn/status/log-sink surface, because
(a) the production entrypoint composes exactly `PROMPT_REQUIRED_COMMANDS` and
drops `loop` until the phase-7 repin, and (b) the cycle's verdict, terminate and
restart steps do not exist before phases 4 and 5.** Any phase-2 case whose
assertion path leaves that surface — by naming D1, or by naming a stuck/restart
episode — is unsatisfiable at its own gate. Three cases still do, and all three
are in the phase-2 inventory:

- `TC-SPAWN-004` (AC-F2-4, `loop-production-composition.test.ts`) — step 3
  "Run the **D1** fresh spawn", fixture mechanism "the **D1** argv observation".
- `TC-PARITY-008` (AC-F2-1, `loop-spawn.test.ts`) — step 1 "Spawn through
  **D1** with the planted home".
- `TC-LOG-004` (AC-F7-2, `loop-log.test.ts`) — precondition "a stuck episode
  that produces a verdict, a termination, an outcome, and **a restart**".

Every other case satisfies the property. Phases 3–6 are self-sufficient: their
verbs are the phase-2 mounts (`start`, `status`) plus each phase's own additions,
every flow they compose is implemented at or before their boundary, and the
restart/stop segments are split exactly as §3.1 declares. Phase 7 is the first
boundary at which D1 can reach the family, and the only D1 suite
(`loop-production-session.test.ts`) is authored, declared and gated there.
Phase 8 and phase 9 add nothing they do not own.

**Gate-level check (no gate names a later implementation).** All nine gates name
only delivered suites or suites authored at or before the boundary; the one
cross-phase suite is `loop-production-session.test.ts`, correctly gate-owned by
phase 7, and phase 2 explicitly excludes it (`plan:1217`). One **coverage**
defect survives, not a self-sufficiency defect: `TC-STUCK-006` is phase 5's case,
but the test plan places it in `loop-stuck.test.ts` while phase 5 authors and
gates `loop-backoff.test.ts` and does not declare `loop-stuck.test.ts` (R-37).

**Why the class keeps surviving.** Iterations 2 and 3 each repaired the
*instances they named*. The rule they introduced was then written into the test
plan and the plan header, but it has never been applied as a sweep over the
phase-2 case inventory, so each pass has left cases that predate the rule
untouched. The rule is now stated in three places and is correct; three cases
contradict it. This is the same class, at a location no pass has yet rewritten.

## New findings

### R-34 — `TC-SPAWN-004` (owned and gated by phase 2) runs a D1 spawn that cannot reach `loop` before phase 7 (blocking)

- **Severity**: major
- **Facet**: plan_coverage, cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:568` (fixture mechanism: "source
  import-identity assertions plus the **D1** argv observation"), `:576` (step 3:
  "Run the **D1** fresh spawn and assert the resolved seat model reaches the
  argv"), `:581` (expected: "observed from the same composed path the `dispatch`
  surface uses"); `:2574` and `:2823` (the suite is `loop-production-composition.test.ts`,
  which §7.5 calls a "**D2 suite**"); `chg-GH-348-plan.yaml:1141-1146`
  (phase 2 authors it), `:1194` (phase 2 claims AC-F2-4), `:1213` (phase-2 gate
  runs it); `packages/cli/src/entrypoint.ts:217-231,447`.
- **Gap**: D1 is defined once, as `createProductionComposer` → `runEntrypoint`
  (`test-plan:220`). The delivered entrypoint drops every non-prompt-required
  command, and `loop` joins the inventory only in phase 7, so at the phase-2
  boundary a D1 invocation reaches no `loop` definition — the case's step 3
  cannot pass in the phase-2 gate. The artifacts also contradict each other: the
  plan and §7.5 treat the suite as D2-only, the case's own steps require D1, and
  §4's D2 enumeration lists `TC-SPAWN-001/-002/-005` but not `-004`. This is the
  R-30 class at a case the authorized pass did not sweep.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: replace "D1" in the fixture mechanism and step 3 with the
  D2 edge (the same spawn `TC-SPAWN-001` asserts), and add a labelled phase-7
  re-observation line if the D1 argv half is wanted, exactly as `TC-SPAWN-001`
  does. No plan edit is needed: phase 2 already calls AC-F2-1/`PARITY-008` "both
  D2 at this boundary" (`plan:1193`).

### R-35 — `TC-PARITY-008` (owned and gated by phase 2) spawns through D1 (blocking)

- **Severity**: major
- **Facet**: plan_coverage, cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:2385` (step 1: "Spawn through **D1**
  with the planted home"); `:2375` and `:2572` (`loop-spawn.test.ts`, phase 2);
  `chg-GH-348-plan.yaml:1142` ("… SPAWN-006, **PARITY-008 — all on D2**"),
  `:1193` ("AC-F2-1 (SPAWN-001 + PARITY-008 — **both D2** at this boundary)"),
  `:423` (TC map, phase 2), `:2212-2214` (phase 8 owns the static-scan half as a
  re-observation); `packages/cli/src/entrypoint.ts:217-231`.
- **Gap**: same mechanism as R-34, and here the contradiction is explicit: the
  plan says the case runs on D2 at phase 2, the case's step 1 says D1. A coder
  implementing the case from its steps writes a `runEntrypoint` spawn and the
  phase-2 gate is red; a coder following the plan's "all on D2" leaves step 1
  unmet. Either reading makes the artifact wrong, and the ENTRYPOINT RULE
  (`test-plan:2816`, `plan:250-256`) is violated by the case text.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: change step 1 to "Spawn through **D2** with the planted
  home" (it is the only driver available at phase 2), and keep the existing
  phase-8 static-scan re-observation line for the second half. One line.

### R-36 — `TC-LOG-004` (owned and gated by phase 2) requires a stuck verdict, a termination and a restart (blocking)

- **Severity**: major
- **Facet**: plan_coverage, cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:1664` ("a stuck scenario driven twice"),
  `:1667` (precondition: "A stuck episode that produces a verdict, a termination,
  an outcome, and a restart"), `:1671` and `:1675` ("Run each row and record the
  **verdict** …"; "Verdict, exit, and the record set are byte-identical to the
  control"); `:2722` (`M72` expected failure "verdict expected stuck, received
  unevaluable"); `:2572` and `chg-GH-348-plan.yaml:1144-1146` (the suite is
  `loop-log.test.ts`, authored by phase 2), `:1212` (phase-2 gate runs it),
  `:1210-1211` (phase-2 gate expectation repeats "a failed append changes no
  **verdict**").
- **Gap**: the verdict step is phase 4's, the restart step is phase 5's, and
  phase 2 wires neither (`plan:1071-1076`, `:1102-1106`; phase 4 contract, phase 5
  obligation 5.1). At the phase-2 boundary there is no stuck episode to drive, no verdict to
  compare, and no `coordinator.restart` record; the case cannot be written as its
  own preconditions describe, so `loop-log.test.ts` cannot be green at phase 2.
  The log-failure property itself *is* phase 2's ("a failed append/rotation is
  swallowed after one bounded attempt and disclosed only as `log-unavailable`",
  `plan:1071-1076`), so the defect is the case's scenario, not its subject. `M72`
  compounds it: its expected failure is a phase-4 verdict outcome, yet it is
  allocated to phase 2.
- **Suggested remediation target phase**: test_planning (+ delivery_planning for
  `M72`'s allocation if the split option is chosen)
- **Suggested fix**: split the case as §3.1 already does for the other
  cross-phase cases — the phase-2 segment asserts "a failed append/rotation
  changes no exit, no record and no `log-unavailable` disclosure beyond the
  bounded attempt" on a spawned session; the verdict/record identity across a
  stuck-restart episode becomes a labelled phase-5 observation (e.g. a
  `TC-BACKOFF-004` row), with the segment table extended. If the split keeps two
  rows, move `M72` to the later boundary (phase 5) so the allocation rule "a row
  naming cases in two phases goes to the later boundary" still holds and phase 5
  becomes 14 / phase 2 15 (total unchanged at 120). AC-F7-2 stays phase 2 either
  way, so the 41/41 and 74/74 sums do not move.

### R-39 — `TC-INSTANCE-006`'s "never `stuck`" assertion is vacuous at its phase-3 boundary (minor, non-blocking)

- **Severity**: minor
- **Facet**: cross_artifact_consistency, ac_quality
- **Locations**: `chg-GH-348-test-plan.md:1539` ("Verdict: never `stuck` …; the
  window is never counted as progress either"), `:1525` (fixture mechanism
  arms "a zero-progress source; a readable corroborator folding to `none`; the
  window elapsed"); owner phase 3 (`plan:425-429`), gate phase 3 (`plan:1377`).
- **Gap**: the verdict step is phase 4's and the corroborator read is phase 4's,
  so at phase 3 those assertions pass because no verdict exists, not because the
  rule holds. The case's load-bearing assertions (exactly one `resume`, no
  `--title`, same id returned, 0 spawns, 0 kills, `session-pid-unknown`) are
  phase 3's and are unaffected, which is why this does **not** break the gate —
  it is vacuity, not unsatisfiability. It is recorded because a phase-3 reviewer
  should not read a green "never stuck" as evidence.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: state that the verdict clause is asserted at its phase-4
  re-observation (`TC-STUCK-001`/`TC-STUCK-003`) and that this case asserts only
  "no kill and no second acquisition of the pid-less session".

### R-37 — `TC-STUCK-006` is phase 5's case but its declared suite is never run by the phase-5 gate (minor)

- **Severity**: minor
- **Facet**: cross_artifact_consistency, plan_code_area_coverage
- **Locations**: `chg-GH-348-test-plan.md:1175` (`Target Layer / Location`:
  `tests/behaviour/loop-stuck.test.ts` + `tests/structure/loop-imports.test.ts`)
  and `:2579` (§7.3 maps `TC-STUCK-001…-011` to `loop-stuck.test.ts`), against
  `chg-GH-348-plan.yaml:1684-1698` (obligation 5.4 authors `TC-STUCK-006` in
  `tests/behaviour/loop-backoff.test.ts`), `:1725-1729` and `:1741` (phase-5
  Acceptance and gate run `loop-backoff.test.ts`), and `plan:1750-1762` (phase
  5's declared files, which do not include `loop-stuck.test.ts`).
- **Gap**: one of the two artifacts is wrong. If the coder follows the test
  plan's location, phase 5 adds a case to a suite its gate never runs (and edits
  a path phase 5 does not declare); if the coder follows the plan, §5.2/§7.3 are
  stale. The case's assertion is phase-5 behaviour, so this is a coverage defect,
  not a self-sufficiency one; the plan's own cross-phase declaration rule ("a
  file edited by more than one phase is declared by EVERY phase that touches it")
  makes the fix mechanical either way.
- **Suggested remediation target phase**: delivery_planning
- **Suggested fix**: either declare `tests/behaviour/loop-stuck.test.ts` in phase
  5's scope and add it to the phase-5 gate (preferred — it keeps the stuck-bound
  case in the stuck suite), or re-point §5.2/§7.3 to `loop-backoff.test.ts`.

### R-38 — `TC-CONTRACT-005`'s expected mutant message names a module the plan does not declare (minor)

- **Severity**: minor
- **Facet**: cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:2154` ("`loop-log-line.ts: forbidden
  module node:fs`") against `chg-GH-348-plan.yaml:920-921`, `:961` and `:1001` (phase 1
  declares `packages/core/src/domain/loop-log.ts`; "a rename at delivery is a plan
  revision", `plan:760-766`).
- **Gap**: a case that asserts an exact failure message naming
  `loop-log-line.ts` either fails on the declared module or forces an undeclared
  rename. One word in an illustrative-but-asserted string.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: change the example to `loop-log.ts: forbidden module
  node:fs`.

### N-07 — the test plan's source table still cites the spec at v1.1 (nit)

- **Severity**: nit
- **Facet**: cross_artifact_consistency
- **Locations**: `chg-GH-348-test-plan.md:62` ("`./chg-GH-348-spec.md` (v1.1)")
  against `spec:791-799` (v1.4) and the plan's own `v1.4` citation
  (`plan:9-11`).
- **Gap**: a stale version citation in the reference table. No requirement moves.
- **Suggested remediation target phase**: test_planning
- **Suggested fix**: cite v1.4 (or cite "current") in the reference row only.

## Counts

Authorized findings: 8 dispositioned — Resolved **7**, Not closed **1** (R-30,
repeat of the class on its universal criterion), Unresolved **0**, Regressed **0**.

New findings: Critical **0**, Major **3** (R-34, R-35, R-36), Minor **3** (R-37,
R-38, R-39), Nit **1** (N-07). Total new: **7**.

Blocking set (verdict fails): **R-34**, **R-35**, **R-36** — all phase-2
gate-unsatisfiability, all in the self-sufficiency class, all one-line case edits
plus one allocation move. Every other new item is non-blocking and would not by
itself hold the gate.

## Remediation order (if the human authorizes a fifth pass)

1. **test_planning** — R-34 (D1 → D2 in `TC-SPAWN-004`), R-35 (D1 → D2 in
   `TC-PARITY-008`), R-36 (split `TC-LOG-004`, phase-2 segment + labelled phase-5
   re-observation), R-39 (scope the vacuous clause), R-38 (`loop-log-line.ts`),
   N-07 (v1.1 → v1.4).
2. **delivery_planning** — R-37 (`loop-stuck.test.ts` declared and gated in phase
   5, or the case re-pointed); R-36's `M72` allocation if the split keeps two
   rows (phase 5 14 / phase 2 15, still 120); re-confirm the six headline counts
   (41 ACs, 74 cases, 80 links, 120 mutations, 41/41, 74/74) — none of these seven
   findings moves an AC or a TC, so the sums should stay unchanged.

The gate must not reopen `delivery` for any of these.

## Re-run note — the class survived; stop and report

Iteration 4 of 4 (the single re-run the human authorized on 2026-11-19). All
eight authorized findings were re-checked at the location that claims to satisfy
them: seven are closed and verified (R-26, R-29, R-31, R-32, R-33, N-05, N-06),
and R-30's two named cases are fixed but its closure criterion — "no phase-2 case
or gate runs `runEntrypoint`" — is false.

The full per-case sweep the human asked for then found three further phase-2
cases that assert behaviour their boundary cannot reach: two drive D1, one drives
a stuck/restart episode. They are the same class iteration 3 escalated, at
locations no pass has rewritten, and they make the phase-2 gate unsatisfiable in
isolation. Per the human's instruction this verdict **stops rather than loops**:
the artifacts are otherwise sound (all six headline counts recompute, the mutation
partition is complete, the index and matrix agree, the entrypoint rule is stated
correctly, and no other phase has a self-sufficiency defect), so the decision is
now between (i) a fifth, genuinely mechanical pass over exactly R-34/R-35/R-36
(plus R-37…N-07) and (ii) extending the recorded Option B deviation to cover six
phase-2 cases instead of two, with the PR body naming them.

**Pause Required: yes** — the pause is the pre-authorized stop-and-report. The
human act needed is to choose (i) or (ii); no artifact was edited and no commit
was made by this review.
