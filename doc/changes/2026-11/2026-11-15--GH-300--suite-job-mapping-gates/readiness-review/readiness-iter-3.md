# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-300
Date: 2026-11-15
Pause Required: no

Reviewer stance: adversarial, independent, re-run from scratch. Revision headers, changelog rows and
"closed by revision N" notes were not accepted as closure. Every iteration-2 finding was re-verified
in the artifact that owns it; the delivered code was read directly where an artifact makes a claim
about delivered behaviour; every mechanical count was re-derived from the artifacts, not copied.

Artifacts reviewed: `chg-GH-300-spec.md` v1.3, `chg-GH-300-test-plan.md` v1.4,
`chg-GH-300-plan.yaml` rev 1.3, `chg-GH-300-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`,
`readiness-review/readiness-iter-2.md`, current truth under `doc/spec/**`, `doc/quality/**`,
`doc/guides/**`, `doc/planning/**`, `doc/overview/**`, and the delivered code seams
(`packages/core/src/contracts/{result,error-table}.ts`, `packages/core/src/domain/verify-gates.ts`,
`packages/core/src/config/catalog.ts`, `packages/adapters/src/file/{config-source,yaml-parser,ci-workflow}.ts`,
`packages/cli/src/{index,commands/verify,commands/verify-gates}.ts`, `packages/mcp/src/commands/gate-report.ts`).

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Mechanical counts (re-derived, not trusted)

- §17 ACs: **30** (`AC-F1-1..5`, `AC-F2-1..3`, `AC-F3-1..6`, `AC-F4-1..4`, `AC-F5-1..6`,
  `AC-NFR1-1`, `AC-NFR2-1`, `AC-NFR3-1`, `AC-NFR5-1`, `AC-NFR7-1`, `AC-NFR8-1`); 30 named by the
  test plan, 30 named by the plan, 0 orphans.
- TCs: **38** (SMAP 8 · SCITE 6 · SNARR 6 · SRES 5 · SPAR 6 · SCTR 3 · SDET 2 · SHERM 1 · SWRITE 1);
  38 named by the plan; ownership parsed from the plan's `TC -> PHASE MAP` — P2 1, P4 24, P5 4, P6 9,
  **each TC owned exactly once, no duplicate owner**.
- DM rows: **9/9** covered (`DM-1..DM-9`; DM-8 → TC-SMAP-004; DM-9 → TC-SMAP-006/007/008, TC-SPAR-006).
- Appendix D: **26 rows**, contiguous `D-1..D-26`; each row covered by exactly one Phase 7 obligation
  (7.1 D-1, 7.2 D-2, 7.3 D-3, 7.4 D-4, 7.5 D-5, 7.6 D-6, 7.7 D-7, 7.8 D-8, 7.9 D-9, 7.10 D-10,
  7.11 D-11, 7.12 D-12, 7.13 D-13, 7.14 D-14, 7.15 D-15, 7.16 D-16, 7.17 D-17/18/19,
  7.18 D-20/21, 7.19 D-22/23, 7.20 D-24/25, 7.21 D-26); no row uncovered, none covered twice.
- Phase 7 `scope.files` contains every document named by D-1..D-26, including the three added by
  v1.3 (`feature-capsule.md`, `feature-verify-change-and-exit-taxonomy.md`,
  `doc/overview/architecture-overview.md`); D-7's row is additionally scoped to Phase 2.
- Suite/fixture homes: 86 `scope.files` + 3 `scope.folders` parsed from the plan. Every path named by
  test-plan §6.2–§6.4 and §7 resolves to a declared file, a declared folder, or a pre-existing
  read-only control (`tests/fixtures/verify-gates/corpus/cases.json`,
  `cross-repository/goldens/gates-members-green.json`, `verify-support.ts`, the two guard modules,
  `cases/facts.ts`, `cross-repository/{facts,constants}.ts`, the existing `workflows/` directory).
  **No writable home is outside a phase scope.** The two v1.3 additions
  (`tests/behaviour/verify-gates-config-document-adapter.test.ts`, per-case
  `suite-map/config/adapter/<case>/…` roots) are inside Phase 5.

## Delivered facts re-verified against code

- `delivery.result.v1` `error` is exactly `{code, category, retryable, consequence, remediationHint, summary?}`
  (`packages/core/src/contracts/result.ts`) — no `kind`; `verify` kind carries six identities.
- `renderVerifyGatesFailureSummary` renders `result=<fail|unknown>; gates=<p>/<t> passed, …`, so an
  all-pass narrow battery renders `result=unknown` and the zero-gate member path renders
  `gates=0/0 passed, 0 failed, 0 unknown` (matches DEC-15 and TC-SNARR-001/006).
- `verify` declares `flags: []`, `positionals.max: 2`; `--config` is unreachable, and the only
  selection input is `${environmentPrefix}CONFIG` (`packages/cli/src/…`, `packages/mcp/src/serve.ts:327`).
  The delivered acquisition refuses a selected path that is missing or unreadable
  (`config-source.ts`: `unreadable("project-committed", selected)`).
- `verify gates` composes no configuration read (`VerifyGatesCommandRuntime` has `readGateSet`,
  `appendVerification`, optional `capsule` — no config seam); `resolveMergeGateSetFromConfig` has no
  production call site; `packages/core/src/config/catalog.ts` has no `verify` branch.
- `crossRepositoryEvaluation` performs `readRepository`, lifecycle, `readWorkflow`, work item and the
  per-member bundle in-function, so the plan's hoist obligation (workflow only) and its member-read
  posture describe the code truthfully.
- `.delivery-os/` is listed in this worktree's repository `info/exclude`, so the P-3/5.2 force-add
  hazard is real. `configDirectoryName` is brand-derived (`dotDir`), giving `.delivery-os`.
- `ci.yml` job `ts-aggregate` displays `TS aggregate check`; `pnpm check` runs eight steps matching
  the eight declared suite ids; the corpus is exactly 48 cases; the delivered goldens are 6 human
  lines with `expected=23`.
- Parser strictness is real (`uniqueKeys: true`, depth cap 64), so the v1.3 parser-versus-tolerance
  boundary is factually grounded.

## Closure Table (iteration-2 findings)

| # | Owner | Iter-2 gap (short) | Status | Evidence / residual |
|---|---|---|---|---|
| 1 | spec + plan | Appendix D not exhaustive; Phase 7 under-scoped | **CLOSED** | D-17..D-26 quote every append/capsule sentence with line anchors — verified line by line against `feature-verify-gates.md` 34–37, 172–173, 216–217, 317–319, 374, 407–412, `feature-capsule.md` 129/205, `feature-verify-change-and-exit-taxonomy.md` 43/49, `architecture-overview.md` 179, `feature-merge-verify-deploy.md` 77, `test-spec-merge-verify-deploy.md` 31. Phase 7 scope + 7.17–7.21 cover them. Residual of the same *class* for a different invariant → finding 2. |
| 2 | spec | `error.kind` asserted on envelope/tool result | **CLOSED** | No `error.kind` assertion survives in any AC, DM, TC step or plan obligation; §8.3 item 10 records the explicit no-change; Appendix A row 25 pins the observable surface; `result.ts` confirms the six-member error object; the domain kind is routed to AC-NFR7-1/TC-SCTR-003 only. |
| 3 | plan + test plan | No witness of the fail-closed mapping through the real adapter | **CLOSED** | TC-SMAP-008 (test plan §5.1, §5.2, §6.2, §7) owned by Phase 5 (plan `TC -> PHASE MAP`, 5.11, P-8, escalation trigger), suite home and per-case roots in Phase 5 scope, fail-open discriminator stated in 5.11(f) and TC step 6. Phase 4 explicitly disclaims the adapter boundary (4.3). |
| 4 | spec + plan | Read-budget wording self-contradictory; plan 6.4 unqualified | **CLOSED** | NFR-4, AC-F5-4, §4.1, §8.5, DoD-5, Appendix A row 15 now state "enumerable gates source counts identical … plus exactly one configuration-document read, performed either way"; plan 6.4 splits (a) and (b) and states the narrowed member-declaring asymmetry; TC-SPAR-004 step 7 + notes mirror it. (Unqualified §5.1 index title only — nit 6.) |
| 5 | spec | Tolerance claimed total; parser strictness ignored | **CLOSED** | DM-9, DEC-18, NFR-10, F-1, Flow 6(e), AC-F1-4, AC-NFR8-1, §8.3 item 9, Appendix A rows 22/27, C-15 all scope tolerance to schema/semantic defects outside the node and make a parser-level failure anywhere the unparseable refusal; TCs step 3/6 and TC-SMAP-008(c)/(e) pair both classes. |
| 6 | spec | `job` character class unpinned | **CLOSED** | F-1, DM-1, DEC-2, NFR-2, AC-F1-2, Appendix A rows 4/26 pin a single-line printable class (no control chars, no line break, no leading/trailing whitespace, exact match, ≤120); TC-SMAP-003 step 3 exercises each class; plan 2.4 binds it. |
| 7 | spec + plan (spec closed) | C-10 exception unrecorded | **PARTIAL → finding 4** | Spec side fully closed (§7.2 bullet, C-10, §16, Appendix A row 28, plan P-2/2.8). Test plan still labels the documented row a "phase 7 reconciliation" (TC-SCTR-003 precondition) while its own §8.4 and the plan put it in Phase 2. |
| 8 | test plan | Stale cross-artifact handoff paragraph | **NOT CLOSED → finding 1** | Rewritten to claim satisfaction but now asserts three false things about plan rev 1.3: it is "revision 1.2 / 37 TCs", TC-SMAP-008 is owned "in the plan's next revision", and "its 5.7 still says `error.kind`". |
| 9 | plan | Handler order / hoist / selected-file channel imprecise | **CLOSED** | 4.2 gives the exact order, states `readGateSet` is a zero-I/O seam (not a source read), states THE HOIST (workflow only, repository read stays after the refusal), and states MEMBER-READ POSTURE; 4.2 SELECTED-FILE RESIDUAL and 5.3 name `${environmentPrefix}CONFIG` (the only reachable channel for `flags: []`) and injected `FileSystemFacts`. Residual on the selected-but-missing outcome → finding 3. |
| 10 | spec | "Catalog and resolver agree by construction" | **CLOSED** | The claim is gone; DM-9/DEC-18/F-1/D-8 state the resolver is the only validator and the catalog outcome is never consumed here. |
| 11a | spec | DEC-19 recorded as a general posture | **CLOSED** | DEC-19 carries an explicit scope paragraph, §7.2 gains the out-of-scope bullet, Appendix A row 23 and C-16 repeat the scoping, and plan 5.5 repeats it. |
| 11b | pm-notes | No reopen provenance; superseded totals | **PARTIAL → finding 5** | A REOPEN PROVENANCE entry now exists (reasons + times + "no `delivery` reopen"). It contradicts the machine-recorded phase block and no entry records the re-issued spec v1.3 / test plan v1.4 / plan 1.3. |
| 12 | test plan | TC-SCITE-005 no-append step structurally vacuous | **CLOSED** | Step 3 now asserts the observable tool outcome (failure result shape, no report content block) and delegates the write posture to TC-SNARR-002/006 and TC-SWRITE-001; §7's mocking row and the DM-7/NFR-5 citations drop the unreachable state module and capsule recorder. |

## Findings

### 1. [major] cross_artifact_consistency — `chg-GH-300-test-plan.md` §2 (line 61), §8.3 (line 1696), §9 (line 1719)

Gap: the test plan describes the plan as revision **1.2**, adopting **spec v1.2** and **test plan
v1.3** with **37 TCs**, and states that "TC-SMAP-008 … is owned by **phase 5** in the plan's next
revision" and that "its 5.7 still says `error.kind`". Plan rev **1.3** exists, is reconciled with
spec v1.3 and test plan v1.4, owns 38/38 TCs with TC-SMAP-008 in Phase 5 (5.11, P-8, Phase 5
`scope.files`), and 5.7 explicitly states "No `kind` member appears in the tool result". The
paragraph is titled "(satisfied — no residual test-plan gap)" but then describes a residual that no
longer exists and one factual claim about the plan that is false. This is iteration-2 finding 8 in a
new form: the mirror-image staleness moved from "the plan predates the spec" to "the plan is one
revision behind and still carries the `error.kind` wording". A phase-7 or review reader following
§2/§8.3 would look for a pending plan revision and would audit 5.7 against a wording it no longer
contains.
Owning artifact: test plan (test_planning).
Suggested fix: restate §2 and §8.3 against plan rev 1.3 (38/38 TCs, spec v1.3, TC-SMAP-008 owned by
Phase 5 with its suite in scope, no-`kind` wording already carried in 5.7), and correct the §9 v1.4
log row's "(Minor 8)" sentence to match; keep the handoff statement "satisfied" with no forward
reference.

### 2. [minor] system_spec_consistency + plan_doc_update_coverage — `chg-GH-300-spec.md` Appendix D / §24 (line 657); `doc/spec/features/feature-verify-gates.md` lines 34–36 and 311–315

Gap: the register is exhaustive for the two **append** invariants (verified by grepping both search
keys across `doc/**`), but the change also *extends* a third invariant — the read budget — and the
current-truth sentences that enumerate the local reads are not registered:

- `feature-verify-gates.md` §Overview (34–36): "It performs bounded local reads (ledger, repository
  HEAD/branch, CI workflow) and at most one bounded page or item per provider source: …". After the
  change the gates surface performs one more bounded local read, so this enumeration is no longer
  complete (D-2 amends only the append sentence in the same paragraph).
- `feature-verify-gates.md` cross-repository read budget (311–315): "… the delivered single ledger
  read, repository HEAD/branch read, CI-workflow read, and work-item read." D-19 amends only the
  append-posture sentence in that paragraph.

D-5 amends §Bounds and read budget, so the same document will state the added read in one section
and omit it in two others. Because Phase 7 is bound to "exactly D-1..D-26 … nothing else moves",
the omission is structural, not cosmetic — and the spec's §24 closing claim ("No other current-truth
sentence changes") is what makes the omission binding.
Owning artifact: specification (the target files are already in Phase 7 `scope.files`, so no plan
scope change is needed — the D-binding pulls the rows in automatically).
Suggested fix: add the two D rows quoting those sentences verbatim with their line anchors and
reconcile them ("plus the one bounded read of the project-committed configuration document, with the
per-source budget otherwise unchanged"), and widen §24's exhaustiveness sentence to name the read
budget as a third searched invariant.

### 3. [minor] spec_completeness + cross_artifact_consistency — `chg-GH-300-spec.md` AC-F1-4 (line 431), DM-9 (line 269), Appendix A row 22 vs `chg-GH-300-plan.yaml` 4.2 SELECTED-FILE RESIDUAL and 5.3; no TC

Gap: DM-9 states a **total** classification whose absent arm is "no repository root or no such file
→ undeclared, delivered parity", and AC-F1-4 repeats "an absent document (no repository root, or no
such file)". The plan pins the opposite for one state: when the `${environmentPrefix}CONFIG`
selector names a **missing or unreadable** path, "delivered selection semantics apply and the run is
the unusable-selector `config.value.invalid` refusal — never the absent/undeclared parity path"
(4.2, 5.3). The delivered code agrees with the plan
(`config-source.ts`: `unreadable("project-committed", selected)`), and RSK-11 declares the residual
rather than closing it. So the spec's total classification covers a state with the wrong expected
outcome, and an implementer following AC-F1-4 literally would change delivered behaviour from a
refusal into parity while citing the AC. No AC states the selected-path outcome and no TC exercises
it: TC-SMAP-006 step 1 uses "(a) no repository root and (b) a repository root with no such file",
and TC-SMAP-008 step 1 uses the same two sub-cases — both with no selector in play. Relatedly,
5.3/5.11 do not name the input that supplies `<root>` for the per-case adapter roots
(`explicitProjectRoot`/`gitRoot` in `FileAcquisitionInput`), although TC-SMAP-008 asserts that "the
only substitution is `FileSystemFacts`".
Owning artifact: specification for the classification carve-out; test planning for the witness.
Suggested fix: state in DM-9/AC-F1-4/Appendix A row 22 that "absent" means no selection in play and
no committed document, and that a selected path that is missing or unreadable takes the delivered
unusable-selector `config.value.invalid` refusal (never parity); add the third sub-case to
TC-SMAP-006/TC-SMAP-008 step 1, and name the root input in plan 5.3 as the per-case fixture-root
injection point.

### 4. [minor] cross_artifact_consistency — `chg-GH-300-test-plan.md` TC-SCTR-003 Preconditions (line 1375) vs `chg-GH-300-plan.yaml` P-2/2.8/Phase 2 gate and test-plan §8.4 (line 1707)

Gap: TC-SCTR-003's precondition calls the documented error-table row and the live count assertion
a "phase 7 reconciliation, before phase 9 gates", while plan P-2 and obligation 2.8 land the row, the
135→136 count, the live assertions and the true-positive corpus entry in **Phase 2**, and Phase 2's
own gate runs `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` and
`bun run scripts/checks/error-table-sync.ts` — so the sync must be green at that boundary. The test
plan's own §8.4 says the opposite of its TC ("except the error-table documented row which the sync
gate binds"). This is iteration-2 finding 7's residual: the spec's C-10 exception landed, the test
plan's framing did not.
Owning artifact: test plan (test_planning).
Suggested fix: restate the precondition as "landed in phase 2 with the `ERROR_TABLE` row (C-10 /
Appendix A row 28, D-7), before any boundary that runs the sync gate", and align §6.6's sentence.

### 5. [minor] decision_capture (process) — `chg-GH-300-pm-notes.yaml` note "REOPEN PROVENANCE" (lines 226–234) vs the `phases:` block (lines 7–17)

Gap: the provenance entry now exists with reasons and times, but it contradicts the machine-recorded
phase block: it reports `test_planning` completed at `13:53:27Z` (block: `12:53:33.330Z`) and
`delivery_planning` "pending" (block: completed `13:01:59.428Z`). No entry records that spec v1.3,
test plan v1.4 and plan rev 1.3 were re-issued, nor their current totals (30 ACs / 38 TCs / D-1..D-26 /
67 homes), so the only superseding record is the plan's own revision note. This is the
residual of iteration-2 finding 11b.
Owning artifact: PM notes (PM lane; this gate writes no artifact edit).
Suggested fix: append one note correcting the two timestamps/status and recording the re-issued
artifact versions with their totals; do not rewrite the earlier historical note.

### 6. [nit, non-blocking] test_traceability — `chg-GH-300-test-plan.md` TC-SMAP-008 step 6 (line 505); §3.4 (line 153); §5.1 TC-SPAR-004 title

Gap: step 6 ("swap in an implementation that maps any read failure or parse failure to
`{ok: true, declared: false}` and assert that every step 2 and step 3 case fails this suite") is a
mutation/meta-check, not an executable assertion inside the suite; §3.4 nevertheless reports 0
verification-only TCs. The discriminating power is already delivered by steps 2–4 (a fail-open
mapping renders parity instead of the asserted refusal), so step 6 should be restated as a property
of those steps rather than a step. Separately, TC-SPAR-004's §5.1/index title ("Read counts are
identical with and without a map") is unqualified while its body correctly splits the seven-source
claim from the one added configuration read.
Owning artifact: test plan.
Suggested fix: fold step 6 into the steps 2–4 notes as the non-vacuity statement; qualify the
TC-SPAR-004 title.

## Non-blocking observations

- AC-F3-6's "no member read is performed" (spec line 451) and TC-SNARR-006 step 5 ("the throwing
  recorder was never called") should be read as "no per-member read bundle": the plan-declaration
  read (`members.readMembers`) necessarily runs before the decision (plan 4.2). Pin the recorder to
  `readMemberReads` in the TC so a tester cannot wire it to the plan read.
- NFR-10's "1 bounded configuration-document read per gates invocation" is not literally observable
  in the absent state, where only an existence probe occurs (`FileSystemFacts.exists`, no
  `readText`); TC-MAP-008(g)/TC-SPAR-004 step 3 assert "exactly one read … in every state". Say
  "one bounded resolution attempt (an existence probe plus at most one content read)" if the
  threshold is meant literally.

Environment note (not a finding): `delivery-os plan validate GH-300` still cannot run in this
worktree — the installed binary loads the parent checkout's stale `packages/core/dist`
(`evaluateCrossRepositoryGates` not exported). The plan's `plan validate` claim was therefore not
independently reproduced; all mechanical counts above were re-derived from the artifacts.

## Next step

Iteration 3 of a capped run. Findings 1–5 are artifact edits, all cheap and local:

- `test_planning`: findings 1, 4 (test-plan text only; no TC step changes, no count changes), plus
  the nit cleanup in finding 6 and the third document sub-case from finding 3.
- `specification`: findings 2 and 3 (two D rows + one classification carve-out in DM-9/AC-F1-4/
  Appendix A row 22); no id renumbering, no AC count change.
- PM lane: finding 5 (pm-notes append), which this gate does not write.

Because the only major gap (finding 1) is a stale cross-artifact reference that has now survived two
iterations in mirror-image forms, the cheapest safe path is a PM-lane surgical edit of the four test
plan sentences plus the spec rows, followed by one confirmation re-run of this gate rather than a
full fourth authoring cycle. If a fourth full cycle is not desired, escalate to the human with this
record: everything except the four text defects is ready, and the DoR facets of specification,
plan coverage, traceability, decision capture, code-area coverage and DoD are otherwise PASS.

Delivery must not start from this verdict.
