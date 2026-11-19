# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-339 (M3-S5: Adapter conformance and parity suite, M3)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 2, full re-run against every artifact re-read from disk. Prior record: `readiness-review/readiness-iter-1.md`.

## Inputs re-read for this iteration

`chg-GH-339-spec.md` v1.2, `chg-GH-339-test-plan.md` v1.2 (63 TCs), `chg-GH-339-plan.yaml` v1.2 (parses as `delivery.plan.v1`; phases 1-6, scopes 18/11/10/11/12/7 files), `chg-GH-339-pm-notes.yaml`, `doc/decisions/TDR-0036`/`TDR-0037`/`TDR-0038`/`TDR-0039` (untracked, amended in place, all still `status: Proposed`), `doc/decisions/00-index.md` (clean; HEAD carries all four TDR rows), and the delivered code the artifacts name (`packages/testkit/src/conformance/**`, `packages/adapters/src/{github,gitlab,jira}/**`, `tests/behaviour/providers/**`, `tests/structure/**`, `.github/workflows/**`).

## Facet Summary

- spec_completeness: **FAIL** — the assertion-family dimension is defined too narrowly to observe the three classes mapped onto it (finding N1); TDR-0037's pagination row contradicts the spec (N3); NFR-4 and §12 still state superseded readings (N4, N8).
- ac_quality: **FAIL** — AC-F1-5's "the differing dimension as a class id" is ill-defined for a three-to-one mapping, and AC-F1-6's per-class evidence oracle has no declared predicate for three of six classes (N1); the "one mutation per dimension" claim is false (two participation mutations, none for dimension 2).
- plan_coverage: **PASS** — 34/34 ACs and 63/63 TCs each owned by exactly one phase (verified mechanically: 4/25/9/11/8/6 TCs; 3/10/8/7/6 ACs; zero cross-phase AC→TC citations).
- test_traceability: **PASS** — 34 AC rows ↔ 63 TCs, 0 orphans; §3.4 counts match the headings exactly (63 = 8+13+2+13+7+4+6+4+6).
- cross_artifact_consistency: **FAIL** — the 18-cell totals contradict the table in both artifacts (N2); TDR-0037, NFR-4, test-plan §2, test-plan §7.4 G1, spec §12 and TDR-0039 carry superseded statements (N2-N8).
- decision_capture: **PASS** — four records + index rows + DEC-5/DEC-6 in the spec; the two TDR text defects are routed as findings, not as missing decisions.
- system_spec_consistency: **PASS** — every delivered-code claim re-verified (below); no contradiction with `doc/spec/**` beyond the stale record text.
- plan_doc_update_coverage: **PASS** — the seven current-truth pages exist; decision index lands in phase 1; doc-distribution gate in the battery; policy pointers dispositioned.
- plan_code_area_coverage: **PASS** — the three trap suites are now declared append-only in phases 1 and 3; every new module/fixture has a home (one minor: the prefix baseline, N6).
- dod_defined: **PASS** — ACs + per-phase gates + TC-FLOOR-006 + pm-notes evidence form a testable DoD (two AC oracles are defective, which is the spec finding, not a DoD gap).

## Iteration-1 findings — status

| # | Iteration-1 finding | Status | Evidence |
|---|---|---|---|
| 1 | Pagination family unaccountable on GitLab (spec DM-4/AC-F2-7/AC-F2-10) | **Resolved** | DM-4/AC-F2-7/AC-F2-10 now give GitHub `covered`, GitLab `recorded-difference` via `pagination-model` on `(gitlab, read-pipeline-run)`, Jira `gap-backed` via `provider-unsupported`; delivered code confirms GitLab returns `readonly PipelineRun[]` with no bound/count and GitHub returns `{items, pageItemCount}` with a default limit. The square is total and non-vacuous — but its stated totals are wrong (new finding N2). |
| 2 | Appended trap entries cannot land without editing the trap suites | **Resolved** | Plan TRAP-CATALOG APPEND-ONLY RULE + phases 1 and 3 declare `tests/behaviour/providers/{github,gitlab,jira}-trap.test.ts` append-only; test plan TC-FLOOR-001/§1.2/§7.3 restated; the mechanism matches `runTrapCatalog` + each suite's exact ordered name array. Residual: the prefix baseline is unnamed (N6). |
| 3 | TC-PARITY-005's four-dimension comparison had no source | **Partially resolved — persistent in narrowed form** | Dimensions 1/3/4 are now sourced (report step statuses/skip kinds; trap-family classification; declared evidence) and dimension 2 is joined from `CONFORMANCE_FLOWS` by `stepId` with a missing-join failure, so the `undefined === undefined` path is gone. The semantic half persists: dimension 2 as defined (`assertionFamily` + `status`) cannot observe `identity-scheme`/`pipeline-model`/`state-vocabulary`, and no mutation covers it (N1). |
| 4 | TC-REG-002 required fingerprint constants | **Resolved** | Test plan TC-REG-002 now binds the non-editing mechanism and forbids any fingerprint/evidence-only export in the eight named modules; plan obligation 5.4 agrees. |
| 5 | TC-GATE-002 item (iv) was placed in the base-free structure tier | **Resolved** | Test plan TC-GATE-002 keeps (i)(ii)(iii)(v) in `tests/structure/ci-topology-pin.test.ts` with an explicit "imports no base-reading helper" rule and moves `validate()` to the delivered `tests/checks/ci-checks.test.ts` + G7; plan discovery (g) and phase 5.8 match. |
| 6 | Identity-construct definition bound only in the plan; matrix-column permit inside `parity.ts` | **Resolved** | DM-6/AC-F4-4/TDR-0039 §2 carry the binding definition and explicit non-constructs; columns are derived from the registration list and `parity.ts` gets no permit entry; TC-REG-004 asserts "zero unpermitted occurrences" with M46. |
| 7 | The closed clause set was never enumerated | **Resolved** | API-1, AC-F5-2, NFR-11, TDR-0036 §4 and TC-GATE-003 all enumerate the same nine ids and TC-GATE-003 asserts the set as an exact nine-member export. |
| 8 | AC-F2-11 bidirectional over the whole catalog | **Resolved in AC/TC; partially in NFR** | AC-F2-11 and TC-TAX-012 are scoped to the family-wired subset with a non-empty-subset assertion; **NFR-4 still says "bidirectional" unscoped** (N4). |
| 9 | AC-F2-4 vs a 403-signalled throttle | **Resolved** | AC-F2-4 restricts the fixture to a status outside {401,403} and records the 403 case as a `failure-classification` boundary; TC-TAX-005/plan 3.3 carry it. |
| 10 | TDR-0037's scan scope (`packages/*/src`) | **Resolved** | TDR-0037 C-1 and its verification now name exactly `packages/testkit/src/**` + `packages/adapters/src/**` with the single-file allowlist, plus the delivered-vocabulary fact. |
| 11 | TDR-0036 described violations as strings | **Resolved** | TDR-0036 C-4/§4/§7 now specify clause-tagged violation records with a rendered string; the spec and plan match. |
| 12 | One class per cell could not represent multi-dimension pairs | **Resolved structurally** | DM-1 cell carries only `registerId`; DM-2 entry carries a non-empty `differenceClasses` set with per-class evidence; cell/entry bijection asserted. The resolution exposed the dimension-mapping defect in N1. |
| 13 | Stale `ados policy → M3-S5` pointers could not be staged | **Resolved** | Plan discovery (h) and obligation 6.4 disposition them as deliberately unchanged with an external follow-up; no phase claims a phase-7 fix. |
| 14 | `00-index.md` declared while clean | **Resolved** | Declared as CONDITIONAL STAGING ONLY under a written, declared exception to the plan's own scope rule; DoD confirms either state. |
| 15 | "ts-exports does not fetch the base" wording | **Resolved** | Plan/test plan now say "has no explicit base fetch, so the base may be absent". |

No iteration-1 blocking finding is still blocking in its original form; one (iteration-1 #3) is **persistent in a narrowed form** as N1.

## New findings

### Blocking

1. **[critical] ac_quality / spec_completeness** — `chg-GH-339-spec.md` API-1 (line 238), DM-1 (252), AC-F1-5 (396), AC-F1-6 (397); `doc/decisions/TDR-0036` §2 (303-316) and §5 (354-364); `chg-GH-339-test-plan.md` TC-PARITY-005 (295-301), TC-PARITY-006 (311), §7.5 M12 (939), TC-PARITY-008 (329-332); `chg-GH-339-plan.yaml` phase-2 contract and mutation block (861-872, 274-278, 918-935)
   Gap: the assertion-family dimension is defined as "the same named primitive assertion families apply and pass" (F-1, TDR-0036 §5.2) and, mechanically, as "the registry step's `assertionFamily` plus the report's step status" (API-1). Under both, three of the six classes cannot be observed:
   - `identity-scheme`, `pipeline-model` and `state-vocabulary` are mapped to that dimension (DM-1, TDR-0036 §2), but an identity form, pipeline vehicle or state mechanism difference leaves the family name and the pass/fail status **equal** on both sides (each adapter's assertions are parameterised by its own tenant/addressing, so both pass).
   - AC-F1-6 therefore has no oracle for those three classes: "each class's own evidence reproduces the difference **on that class's dimension**" is unsatisfiable under the narrow reading (the evidence shows reference-equal dimension-2 behaviour), and the TDR itself instructs the delivery to record all three on `(gitlab, read-pipeline-run)` ("pipeline model, pagination model, and failure classification together", TDR-0036 line 400) — that honest entry would fail the gate.
   - AC-F1-5's "fails naming ... the differing dimension as a class id from the closed six-class vocabulary" is ill-defined for a 3→1 mapping: a dimension-2 contradiction has three candidate ids and no declared rule to choose one. The test plan improvises a rule that contradicts DM-1 (TC-PARITY-005 line 296: a non-carrier step-participation difference reports `identity-scheme`/`state-vocabulary`, which DM-1 maps to dimension 2, not dimension 1).
   - Non-vacuity: the "four `AC-F1-5` dimension mutations" are enumerated as executed-step set, skip kind, resolved class and declared page count (TC-PARITY-005 line 301, §7.5 M12) — two of the four target step participation and **none targets the assertion-family dimension**, so the gate rule for dimension 2 has no control at all, contradicting NFR-2 and §7.5's own preamble.
   Suggested remediation target phase: **specification**
   Suggested fix: decide and state one of two readings, then align the record, test plan and plan mutation registry. (a) *Enriched dimension 2*: "assertion-family outcome observes the family applying and passing **plus the family's declared primitive shape facts — identity form, pipeline vehicle, state mechanism**; each of the three shape classes names which fact differs, and its evidence reproduces that fact." AC-F1-5's observed contradiction then reports the specific class from the differing shape fact, and a fifth mutation (a differing identity form / pipeline vehicle at equal family and status) is added. (b) *Documentation-only shape classes*: keep dimension 2 narrow, remove the three classes from the dimension mapping (or mark them non-dimension documentation classes), and restate AC-F1-6's evidence obligation as "the evidence shows the recorded shape fact" while AC-F1-5's `observed-contradiction` names only `carrier-absent`, `pagination-model` and `failure-classification`. Add the missing dimension-2 control either way. Author: **@spec-writer** (primary) + **@decision-advisor** (TDR-0036 §2/§5) + **@test-plan-writer** (TC-PARITY-005/006/008, §7.5 M12) + **@plan-writer** (phase-2 contract and arm registry).

2. **[major] cross_artifact_consistency** — `chg-GH-339-test-plan.md` TC-TAX-011 table (557-564) and totals (566), TC-TAX-013 (586), revision log 1.2 (1053); `chg-GH-339-plan.yaml` (1077, 1117, 1163, 1179)
   Gap: the 18-cell square is stated as **10 `covered`, 6 `recorded-difference`, 2 `gap-backed`** in five places, but the enumerated table and the plan's own fixed rows yield **9 / 7 / 2 = 18**. Counting the table row by row: GitHub 6 covered; GitLab 1 covered + 4 recorded + 1 gap; Jira 2 covered + 3 recorded + 1 gap → covered 6+1+2 = 9, recorded 0+4+3 = 7, gap 2. The plan's own row list agrees (six status-less `failure-classification` cells + GitLab `pagination-model` = 7 recorded; six GitHub + GitLab transport + Jira transport + Jira workflow-state = 9 covered). TC-TAX-011 says the square is asserted as expected data and TC-TAX-013 asserts "(10 exist)" / "(6 exist)", so a literal implementation fails its own first run, and the plan's phase-3 title carries the wrong counts into the commit and the DoD record.
   Suggested remediation target phase: **test_planning**
   Suggested fix: change 10→9 and 6→7 in the test plan (TC-TAX-011 caption/totals, TC-TAX-013, revision log) and the plan (contract, obligation 3.2, gate, phase-3 title). Author: **@test-plan-writer** + **@plan-writer**.

### Major (non-blocking)

3. **[major] decision_capture / cross_artifact_consistency** — `doc/decisions/TDR-0037` line 311
   Gap: the family table still defines `pagination-truncation` as "a page-limited read and **its truncation signal** … proven by absence/truncation assertions". Spec v1.2 states the opposite as fact — no closed-operation view carries a truncation flag; the observation is the declared page bound plus the read's reported page count (F-2, DM-4, AC-F2-7, TC-TAX-008). TDR-0037 is cited as the authority for the family vocabulary, so a reviewer can demand a signal that does not exist — the exact defect iteration 1 raised and the spec fixed.
   Suggested remediation target phase: **specification**
   Suggested fix: amend the row to "a bounded read's declared page bound and reported page count; no closed-operation view carries a truncation flag". Author: **@decision-advisor** (lands with the phase-1 TDR commit).

4. **[major] spec_completeness / cross_artifact_consistency** — `chg-GH-339-spec.md` NFR-4 (284) vs AC-F2-11 (415)/DM-4/TC-TAX-012
   Gap: NFR-4 still requires "family wiring and catalog coverage are bidirectional" with no subset scope, which is unsatisfiable over the whole catalogs (47 delivered entries vs six families) and contradicts AC-F2-11's family-wired-subset scoping. A DoD reviewer reading NFR-4 literally would fail the change for correctly unwired entries.
   Suggested remediation target phase: **specification**
   Suggested fix: add "over the family-wired subset" to NFR-4. Author: **@spec-writer**.

### Minor

5. **[minor] cross_artifact_consistency** — `chg-GH-339-test-plan.md` TC-PARITY-004 (285) and TC-PMUT-008 (388)
   Gap: both assert "the entry's own `registerId` field", but DM-2/TDR-0036 §3 declare `differenceId` and no `registerId` on the entry (the cell carries `registerId`). TypeScript would reject the field, so this is self-correcting but currently mis-specified: the intended invariant is "cell `registerId` === entry `differenceId` and the entry's `(adapter, operation)` matches the cell's key".
   Suggested remediation target phase: **test_planning**
   Suggested fix: rename to `differenceId` and state the identity explicitly. Author: **@test-plan-writer**.

6. **[minor] plan_code_area_coverage** — `chg-GH-339-test-plan.md` TC-FLOOR-001 (781-782), `chg-GH-339-plan.yaml` (324-329, 750-753, 1543-1546)
   Gap: the prefix-preserving append-only assertion needs a **frozen delivered-name baseline**; after the append, the delivered names are not recoverable from the edited suite or catalog, and a base-ref comparison is forbidden. Neither artifact says where that baseline lives (a constant in each trap suite, or a committed pin fixture). Without it the assertion is either circular or unimplementable.
   Suggested remediation target phase: **delivery_planning**
   Suggested fix: declare the baseline — e.g. a `DELIVERED_TRAP_NAMES` constant authored in phase 1 before the append (in each trap suite, which is already declared), or `tests/fixtures/pins/trap-names.json` added to phase 1/3 scope and §7.2 — and say the phase-6 case reads it. Author: **@plan-writer** + **@test-plan-writer**.

7. **[minor] cross_artifact_consistency** — `chg-GH-339-test-plan.md` §2 References (62)
   Gap: the plan row still reads `chg-GH-339-plan.yaml` — **not yet authored**, "Prospective: authored in `delivery_planning`". The plan exists, is v1.2, and is the binding delivery plan; the row is stale in an artifact whose revision log claims v1.2 alignment.
   Suggested remediation target phase: **test_planning**
   Suggested fix: replace the row with the plan's actual role (phases/scopes/ownership this test plan's §7.6 must match). Author: **@test-plan-writer**.

8. **[minor] cross_artifact_consistency** — `chg-GH-339-test-plan.md` §7.4 G1 (899)
   Gap: G1's expected signal still says "the **eleven** mutations"; the change now has thirteen parity mutations (PMUT-001..013) and M43/M44.
   Suggested remediation target phase: **test_planning**
   Suggested fix: "the thirteen parity mutations". Author: **@test-plan-writer**.

9. **[minor] spec_completeness** — `chg-GH-339-spec.md` §12 assumption (326)
   Gap: "Each of the six trap families is expressible offline for at least one operation each shipped adapter supports, or is gap-backed …; no family is left unproven by circumstance" omits the posture the design now relies on: GitLab's `pagination-truncation` is a recorded difference, neither covered nor gap-backed. As written the assumption is false for the delivered square.
   Suggested remediation target phase: **specification**
   Suggested fix: add "or is a recorded difference whose entry explains the unobservability". Author: **@spec-writer**.

10. **[minor] decision_capture / cross_artifact_consistency** — `doc/decisions/TDR-0039` lines 325-327
    Gap: the "Reconciliation note (specification obligation)" still says "the change specification's registration-only section names the runner among the provider-free modules … the specification and this record therefore disagree about the runner". Spec v1.2 F-4/DM-6/AC-F4-4 now record the pinned runner exception exactly as the record asks, so the note describes a disagreement that no longer exists and would confuse a reviewer of the amended record.
    Suggested remediation target phase: **specification**
    Suggested fix: restate the note as reconciled (the spec carries the enumerated pinned exception) or delete it. Author: **@decision-advisor**.

11. **[nit] plan formatting** — `chg-GH-339-plan.yaml` line 369
    Gap: `# AC OWNERSHIP (...):#   Phase 1 (3): …` — the `#` is joined to the previous line, so the Phase 1 ownership line is not its own comment line. Cosmetic only (comments are parsed as comments; the content is correct and my mechanical check read it correctly after normalising).
    Author: **@plan-writer** (cosmetic).

12. **[nit] test_planning** — `chg-GH-339-test-plan.md` TC-TAX-008 (521)
    Gap: `items.length === pageItemCount` is tautological against the delivered normalizer (`pageItemCount = payload.check_runs.length` and one item per check run). It is a harmless regression pin, but the *substantive* bound check is carried by the exact-URL route (a request with a different bound would not match a tenant route) — worth stating so the case is not read as proving the bound by itself. No behavioural defect. Author: **@test-plan-writer** (optional).

## Judgment on the plan's five declared open points

1. **TC-TAX-011..013 in phase 3 (vs test-plan §7.6's taxonomy phase) — sound.** The constraint is real: six `recorded-difference` cells resolve to phase-2 register entries (`registerId` → entry class set), so a phase-1 commit would carry dangling references and TC-TAX-011 would fail by name. The vocabulary and the catalog append still land in phase 1 as §18 requires; the AC/TC ownership map is intact and no AC straddles a boundary. Only the test plan's §7.6 row is now one-sided — add the same "accounting lands after the register" note (minor, `@test-plan-writer`, optional).
2. **TC-FLOOR-001's trap half in phases 1/3 while the case is phase 6 — sound as an authoring split.** The case is a re-run/inventory obligation over distributed assertions; the trap half's assertions necessarily live in the suites the append edits. Two conditions: the phase-1 authored form must be the only home (it is), and the prefix baseline must be declared (finding 6). Not blocking.
3. **TC-GATE-003/004 owned by phase 2 and re-run in phase 6 (vs §7.6's quality-gates row) — sound.** They cannot be green before the gate exists; phase 6 re-runs them as release evidence and declares no file. §7.6 now reads as a re-run obligation, so the row is consistent in intent.
4. **`00-index.md` as conditional staging under a declared exception — acceptable.** The file is clean, all four rows are committed at `ef9afa59`, the exception is written into the scope rule with its advisory-only consequence, and the DoD confirms the state either way. This is exactly the disposition iteration 1 asked for.
5. **Stale `ados policy → M3-S5` pointers unchanged with a follow-up — acceptable.** The plan records the disposition, declares neither path, forbids editing TDR-0006 in this change (a decision act), and names the follow-up owner. No phase claims a task that cannot be staged.

## Re-verification of delivered-code claims (this iteration)

- `ConformanceReport`/`ConformanceStepResult`: exactly `provider, flowId, stepId, operation, status, skipReason, skipKind, assertionCount, failure?`; `assertionFamily` only on `ConformanceFlowStep`; no projection or truncation field — spec §2.1 (50) and §8.2 match the code.
- GitHub pagination: `readPipelineRun(commitSha, limit = STATUS_SOURCE_PIPELINE_LIMIT)` returns `{items, pageItemCount}` with `pageItemCount = payload.check_runs.length` and one `PipelineRun` per check run; GitLab `readPipelineRun(commitSha)` returns `readonly PipelineRun[]` with no bound/page count; Jira has no closed-operation collection read. DM-4's three delivered pagination postures are therefore the only truthful ones.
- Capability postures: GitHub 9/0; GitLab 2 supported + 7 `adapter-not-implemented`; Jira 3 supported + `write-comment` `adapter-not-implemented` + five `provider-unsupported`; 27/13/14/9/5 arithmetic and the 18-cell key set derive correctly.
- Status asymmetry: GitHub stamps `response.status` on non-2xx and on the 2xx decode path (`readWorkItem` → `normalizeGithubIssue(..., response.value.status)`); GitLab/Jira never pass a status; `httpStatus` is attached only when provided. AC-F2-2/3/4/5 remain reachable under spec v1.2.
- Runner exception: exactly five `addressing.provider === …` comparisons (`runner.ts:219,221,223,225,235`). `flows.ts`, `coverage.ts`, `harness.ts` are identity-free; `artifact.ts` carries only the redaction labels/URL regexes the definition excludes; `mock-tenant.ts`/`types.ts` are the enumerated addressing homes; zero `"tracker.` literals exist today in `packages/testkit/src` and `packages/adapters/src`.
- Trap replay: `runTrapCatalog` records `no assertion registered` for an entry without an assertion, and each suite asserts an empty failure list plus an exact ordered name array — so the append-only rule and its prefix property are the correct obligation; `tests/structure/trap-catalog.test.ts` enforces minima + required names only, so appends do not break it.
- CI: five workflow files; `ts-test` fetches `origin/main-tools` then runs `pnpm test`; `ts-exports` runs `bun test tests/structure` with no explicit fetch; `bunfig.toml` ignores `tmp/**`; `ci-topology.ts` is presence-only and fails closed without the base; `ci-checks.test.ts` asserts `validateTopology(ROOT)`; `conformance-workflow.test.ts` asserts `validateWorkflowRoot(process.cwd())`.
- Non-goals: no phase edits `packages/adapters/src/**`, the error table, `DOMAIN_KINDS`, projections, exits, the artifact, flows/steps/skip kinds, or any workflow file; phase 4's `types.ts`/`mock-tenant.ts` edits are the additive tenant extension §7.1 puts in scope. No policy-engine work.
- Ownership: 63 TCs (4/25/9/11/8/6) and 34 ACs (3/10/8/7/6), one phase each, zero cross-phase AC→TC citations (mechanical check, not the plan's claim).
- Decision records: all four still `Proposed`, untracked, phase-1 declared; the index is clean with the four rows at HEAD.

## Next remediation targets

`specification` (@spec-writer: findings 1, 4, 9; @decision-advisor: 1, 3, 10), `test_planning` (@test-plan-writer: 2, 5, 7, 8, and the test-plan halves of 1 and 6), `delivery_planning` (@plan-writer: 2, 6, 11, and the plan half of 1). Re-run this gate after revision. **One blocking finding is persistent in a narrowed form across iterations: the parity observation/class-mapping defect (iteration-1 finding 3 → iteration-2 finding 1).** The 18-cell totals contradiction (finding 2) is new and iteration-scoped.
