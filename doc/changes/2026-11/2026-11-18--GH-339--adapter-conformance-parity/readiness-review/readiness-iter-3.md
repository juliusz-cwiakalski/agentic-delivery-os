# Readiness Review Iteration 3

Verdict: **NOT_READY**
Work Item: GH-339 (M3-S5: Adapter conformance and parity suite, M3)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 3, full re-run against every artifact re-read from disk. Prior records: `readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`.

**Escalation statement.** No blocking finding from iterations 1–2 persists. The persistent blocker those iterations carried — the parity basis whose declared dimensions could not observe the classes mapped onto them (iteration-1 finding 3 → iteration-2 finding 1) — is **resolved** by the six-dimension basis (spec v1.3 F-1/API-1/DM-1, TDR-0036 §5.1–§5.4). Iteration 3's single blocking finding is **new**, narrow and editorial: the four-dimension era survives in six places in the test plan and in one plan comment, including two acceptance-criterion-owning cases. It requires a text sweep, not a re-plan. One iteration-2 major (TDR-0037's pagination row) remains **persistent and non-blocking**; it should be fixed in phase 1 because the four decision records land there.

## Inputs re-read for this iteration

`chg-GH-339-spec.md` v1.3, `chg-GH-339-test-plan.md` v1.3 (72 TCs), `chg-GH-339-plan.yaml` v1.3 (parses as `delivery.plan.v1`; phases 1–6 with scopes 19/11/11/11/12/7 files), `chg-GH-339-pm-notes.yaml`, `doc/decisions/TDR-0036` (amended §5.1–§5.4), `TDR-0037`, `TDR-0038`, `TDR-0039` (untracked, all `status: Proposed`), `doc/decisions/00-index.md`, and the delivered code the artifacts name.

## Facet Summary

- spec_completeness: **PASS** (one scoping note, N2).
- ac_quality: **PASS** — every AC now has a real, offline oracle; the dimension set is discovered 1:1 with the class set; no AC depends on a report field that does not exist.
- plan_coverage: **PASS** — 34/34 ACs and 72/72 TCs each owned by exactly one phase (verified mechanically: 4/34/9/11/8/6 TCs, 3/10/8/7/6 ACs, zero cross-phase AC→TC citations).
- test_traceability: **PASS** — 34 AC rows ↔ 72 TCs, 0 orphans; §3.4's arithmetic (8+22+2+13+7+4+6+4+6 = 72) holds.
- cross_artifact_consistency: **FAIL** — stale four-dimension references in the test plan's AC-F1-4 and AC-F1-5/6 cases, in §2/§7.6/§8.2, and in one plan scope comment (blocking finding 1); TDR-0037's pagination row still contradicts the spec (persistent, N1); two lesser reference drifts (N8, N9).
- decision_capture: **PASS** — four records + index rows + DEC-1..DEC-6; the two record text defects are routed as findings, not as missing decisions.
- system_spec_consistency: **PASS** — every delivered-code claim re-verified (below); no contradiction with `doc/spec/**` beyond the stale record line.
- plan_doc_update_coverage: **PASS** — seven current-truth pages, decision index, distribution gate, policy-pointer disposition.
- plan_code_area_coverage: **PASS** — the trap suites, the pin, the mutation builders, the evidence folder and every new module have a declared home.
- dod_defined: **PASS** — ACs + per-phase gates + TC-FLOOR-006 + pm-notes evidence.

## Iteration-1 findings — status

| # | Finding | Status |
|---|---|---|
| 1 | Pagination family unaccountable on GitLab | **Resolved** — GitHub covered, GitLab recorded `pagination-model`, Jira `gap-backed`; 9/7/2 |
| 2 | Appended trap entries required undeclared suite edits | **Resolved** — append-only rule, suites in phases 1/3, prefix property, frozen baseline |
| 3 | Parity observation had no source for its dimensions | **Resolved** — six oracles, one per class, each with a named offline source; `observed`/`not-observable`; six dimension mutations |
| 4 | TC-REG-002 required fingerprint constants | **Resolved** |
| 5 | TC-GATE-002(iv) placed in the base-free tier | **Resolved** |
| 6 | Identity-construct definition not binding; matrix-column permit | **Resolved** |
| 7 | Closed clause set never enumerated | **Resolved** |
| 8 | AC-F2-11 bidirectional over whole catalog | **Resolved** (AC, NFR-4 and TC-TAX-012 now all say "family-wired subset") |
| 9 | AC-F2-4 vs a 403 throttle | **Resolved** |
| 10 | TDR-0037 scan scope | **Resolved** |
| 11 | TDR-0036 violation strings | **Resolved** |
| 12 | One class per cell could not represent multi-dimension pairs | **Resolved** — class set on the entry, exact-set rule, omission and padding both rejected |
| 13 | Stale policy pointers unstageable | **Resolved** (dispositioned unchanged + follow-up) |
| 14 | `00-index.md` declared while clean | **Resolved** (conditional-staging exception) |
| 15 | `ts-exports` fetch wording | **Resolved** |

## Iteration-2 findings — status

| # | Finding | Status |
|---|---|---|
| 1 | Assertion-family dimension could not observe three mapped classes | **Resolved** by the six-dimension basis |
| 2 | 18-cell totals contradicted the table | **Resolved** — 9/7/2 stated and counted row by row |
| 3 | TDR-0037's pagination row still says "its truncation signal" | **Persistent (non-blocking major)** — see N1 |
| 4 | NFR-4 scoping | **Resolved** |
| 5 | `registerId` vs `differenceId`; `four dimensions` in TC-PARITY-004 | **Partially resolved** — PMUT-008 fixed; TC-PARITY-004 still wrong on both counts (blocking finding 1) |
| 6 | Trap-name baseline unnamed | **Resolved** — `tests/fixtures/pins/trap-names.json`, captured pre-append; residual digest gap (N3) |
| 7 | Test plan §2 said the plan was "not yet authored" | **Partially resolved** — now records plan v1.3, but the same row still describes v1.2's `assertionFamily`/absence-and-truncation sources (blocking finding 1) |
| 8 | G1 said "eleven mutations" | **Resolved** — 22 |
| 9 | Spec §12 omitted `recorded-difference` | **Resolved** |
| 10 | TDR-0039's runner "reconciliation note" is stale | **Persistent (minor)** — see N9 |
| 11 | Plan AC-ownership line formatting glitch | **Resolved** |
| 12 | TC-TAX-008 tautological length comparison | **Resolved** — four non-tautological assertions, count explicitly diagnostic |

## Findings

### Blocking

1. **[major] cross_artifact_consistency** — `chg-GH-339-test-plan.md` TC-PARITY-004 (line 294), TC-PARITY-008 (343) and RSK-TP-12 (1111), §2 reference row (60), §7.6 row (1085), §8.2 bullet (1125); `chg-GH-339-plan.yaml` phase-2 scope comment (1228–1232)
   Gap: the four-dimension basis survives in the artifact the coder executes:
   - **TC-PARITY-004**, the case that owns AC-F1-4, still asserts that each class "names exactly one of **the four** parity dimensions" — there is no four-dimension mapping anywhere in spec v1.3, TDR-0036 §5.1 or DM-1/DM-2 (which say six, 1:1). The same sentence also still says "each entry's `registerId` matches the cell", while DM-2's entry field is `differenceId`; PMUT-008 was corrected but this case was not. A literal implementation would assert a four-dimension mapping that no artifact defines.
   - **TC-PARITY-008** and **RSK-TP-12** still assert "four `AC-F1-5` arm mutations". The mutation register has no four-arm group: M12 is the six per-dimension mutations (M47–M52) and M13 the falsified-evidence mutation; the plan states "the six per-dimension observation mutations, the falsified-evidence mutation and the registered six-dimension set". The invariant as written is unimplementable.
   - **§2** (line 60) says the spec's "v1.2's binding additions" are "the only source for `assertionFamily`, via the registry joined by `stepId`, and for absence-and-truncation, via declared evidence" — both are four-dimension-era concepts; assertion family is not a dimension (TDR-0036 §5.4) and pagination is bound/count presence.
   - **§7.6** (1085) lists `CONFORMANCE_FLOWS` as "read for `assertionFamily`", and **§8.2** (1125) makes the same claim plus "the declared evidence record for absence-and-truncation" — the composition assumption governing the observation record.
   - **Plan phase-2 scope comment** (1228–1232) describes `observation-record.json` as "the gate's declared absence-and-truncation evidence … the fourth observation dimension's ONLY source" — stale purpose, and the fixture is now bound/count metadata for the pagination dimension.
   Consequence: the normative authorities (spec F-1/API-1/DM-1/DM-2, TDR-0036 §5.1–§5.4, the plan's phase-2 contract) are consistent and correct; the test plan's case text and assumption list are not. A coder reading the cases would have to reconcile four vs six and invent which mutation set the invariant names. This is a text sweep, not a design change.
   Suggested remediation target phase: **test_planning** (test plan) + **delivery_planning** (the plan comment). Suggested fix: (i) TC-PARITY-004 — "one of the six dimensions, one class per dimension; the cell's `registerId` equals the entry's `differenceId` and the entry's `(adapter, operation)` matches the cell's key"; (ii) TC-PARITY-008 / RSK-TP-12 — delete "four `AC-F1-5` arm mutations"; the invariant is the six dimension mutations (M47–M52) plus the M13 evidence mutation; (iii) §2 — record spec v1.3's six oracles and drop the `assertionFamily`/absence-and-truncation wording; (iv) §7.6 — `CONFORMANCE_FLOWS` is read for the carrier step's identity, not `assertionFamily`; (v) §8.2 — replace (b)/(c) with the six named sources (replayed result, declared bound/count, declaration + report participation, API-2); (vi) plan comment — "declared page-bound/count metadata for the pagination dimension". Authors: **@test-plan-writer** + **@plan-writer**.

### Major / minor (non-blocking)

1. **[major, persistent] decision_capture / cross_artifact_consistency** — `doc/decisions/TDR-0037` line 311
   Gap: the family table still defines `pagination-truncation` as "a page-limited read and **its truncation signal** … proven by absence/truncation assertions". Spec v1.3 (F-2, DM-4, AC-F2-7, TC-TAX-008) states the opposite as delivered fact: no closed-operation view carries a truncation flag; the observation is the declared page bound plus whether a page count is reported. TDR-0037 is cited by DEC-2 as the authority for the family vocabulary and lands in phase 1, so the branch would commit a record that contradicts the AC it is cited for. Carried from iteration 2 unchanged.
   Suggested remediation target phase: **specification**
   Suggested fix: amend the row to "a bounded read's declared page bound and whether it reports a page count; no closed-operation view carries a truncation flag". Author: **@decision-advisor** (phase-1 TDR commit).

2. **[major] spec_completeness** — `chg-GH-339-spec.md` F-1 §5.1 table (137) and API-1 (255); `chg-GH-339-plan.yaml` phase-2 contract (1029–1035)
   Gap: the `carrier-absent` oracle is stated un-scoped: "the adapter's declared carrier arrays **plus the carrier step's participation**", with the participation value allowed only as "executed, or skipped `capability-absent`". The carrier step belongs to `write-comment`. For GitLab and Jira, `write-comment` is a declared gap, so that step is skipped with `skipKind: "declared-gap"` — a third state the oracle does not define. If the participation half is composed for every `(adapter, operation)` pair, GitLab/Jira will differ from GitHub on every supported cell (capability-absent vs declared-gap), producing false `carrier-absent` differences on read operations whose carrier step is not theirs. TDR-0036 §5.1 contains the needed scoping in a parenthetical ("the participation half on `write-comment`"), but the spec and the plan's contract do not, and the pair-level observation is where the coder works.
   Suggested remediation target phase: **specification**
   Suggested fix: state that for a pair whose operation is not the carrier step's operation, the `carrier-absent` observation is the declared carrier arrays only; the participation half is part of the `write-comment` pair's observation (and a declared-gap `write-comment` pair has no observation at all). Mirror it in the plan's contract. Authors: **@spec-writer** + **@plan-writer**.

3. **[minor] test_traceability / non-vacuity** — `chg-GH-339-test-plan.md` TC-FLOOR-001 (856–857); `chg-GH-339-plan.yaml` phase-1 gate
   Gap: the pin-integrity half says the case asserts "the pin file's content equals its committed bytes (no silent regeneration)" and "the pin's bytes are unchanged". A test that reads the pin has no second source for "committed bytes" without a base-ref comparison (forbidden) — the assertion is either tautological or unimplementable as written. The prefix + suffix mechanics are sound and non-vacuous; only the anti-regeneration half lacks an oracle.
   Suggested remediation target phase: **test_planning**
   Suggested fix: record a SHA-256 of the pin in the phase-1-authored case (a two-file edit to break it) or mark the anti-regeneration half review-verified in §10, and say which. Author: **@test-plan-writer** (+ plan phase-1 wording).

4. **[minor] ac_quality** — `chg-GH-339-spec.md` F-1 §5.1 `identity-scheme` row (133); `chg-GH-339-test-plan.md` TC-PARITY-005 item 1 (305) and §7.5 oracle table (1065)
   Gap: the scheme list mixes observably distinct forms with indistinguishable ones. A GitHub PR number and a GitLab MR `iid` are both numeric (and GitLab's `entityId` is the stringified `iid`), so "provider numeric id" and "project-scoped iid" are not separable from the normalized identity — the classifier's output for that pair is one value under either label. That is benign today (they agree), but the oracle should define the classifier or drop the redundant label so the observation is deterministic by construction.
   Suggested remediation target phase: **specification**. Suggested fix: define the scheme classifier over the normalized `entityId` form (numeric / provider key / composite `<sha>:<id>` / bare) and drop "project-scoped iid". Author: **@spec-writer**.

5. **[minor] ac_quality** — `chg-GH-339-spec.md` F-1 §5.1 `pipeline-model` row (134); `chg-GH-339-test-plan.md` TC-PMUT-015 (445–448)
   Gap: "what one `PipelineRun` item represents" is not itself a field; the observable is the per-item composition (GitHub: one synthesised job plus a check-run/details_url evidence entry; GitLab: the pipeline's own job list plus its trace). The unit label should be derived from that composition, not hand-assigned, or the equality predicate risks comparing two authored labels. The count exclusion (each adapter replays its own tenant) is correct and removes the fixture-vs-fixture risk.
   Suggested remediation target phase: **specification**. Suggested fix: "the observation is the composition tuple (jobs per item, evidence kinds); the unit is derived from it". Author: **@spec-writer**.

6. **[minor] ac_quality** — `chg-GH-339-spec.md` AC-F1-5/AC-F1-6, `chg-GH-339-test-plan.md` TC-PARITY-007/008
   Gap: `failure-classification` is observed per pair from the families accounted against that operation, and the family→operation assignment is delivery-decided. When the reference has no family on an operation where a non-reference adapter does, the pair is `observed` vs `not-observable` — a difference that must be recorded although its cause is fixture placement, not provider behaviour. The delivered square will likely produce such an entry (e.g. GitLab's status-less families on `read-delivery-request`). The rule is explicit and mechanical; the register's rationale must say exactly that rather than claim a provider divergence.
   Suggested remediation target phase: **specification** (one sentence on the rationale obligation) or **delivery** note. Author: **@spec-writer**.
   *(Not blocking: the mechanics are well-defined; this is an honesty note for the adjudication.)*

7. **[minor] spec_completeness** — observability scope of the six oracles vs the 5 intersections
   Gap: with the six oracles' declared "observable when" scopes, two of the five non-reference supported intersections — Jira `write-work-item` and Jira `transition-work-item` — have no observable dimension (identity is read-only plus the reference's writes; state is read-only; pipeline/pagination are `read-pipeline-run`; carriers are empty and the carrier step is a gap). Their `same-as-reference` verdict is therefore entailed by "all six agree as not-observable/empty", not by an observed equivalence. This is a design limitation, not a contradiction: writes are policed by the assertion families and coverage gates. Worth one sentence so a reviewer does not read the verdict as an observed claim.
   Suggested remediation target phase: **specification**. Author: **@spec-writer** (optional).

8. **[minor] cross_artifact_consistency** — `chg-GH-339-test-plan.md` §7.6 first row (1082)
   Gap: the row groups "TC-TAX-001, TC-TAX-003..010" under the taxonomy phase, while the plan owns TC-TAX-001/009/010 in phase 1 and TC-TAX-003..008 in phase 3 (the posture arms need phase 3's accounting). The plan declares the split-case; the test plan's coordination row does not mirror it (its note covers only TAX-011..013).
   Suggested remediation target phase: **test_planning**. Suggested fix: split the row the way the plan's TC map does. Author: **@test-plan-writer**.

9. **[minor, persistent] decision_capture** — `doc/decisions/TDR-0039` lines 325–327
   Gap: the "Reconciliation note (specification obligation)" still says "the change specification's registration-only section names the runner among the provider-free modules … the specification and this record therefore disagree about the runner". Spec v1.3 F-4/DM-6/AC-F4-4 now record the pinned runner exception exactly as the record asks; the note describes a disagreement that no longer exists. Carried from iteration 2.
   Suggested remediation target phase: **specification**. Suggested fix: restate the note as reconciled. Author: **@decision-advisor**.

10. **[nit] document quality** — `chg-GH-339-test-plan.md` lines 312, 322, 332, 343, 434
    Gap: several headings are duplicated inline at the end of the preceding paragraph (`…wrongly emitted.#### TC-PARITY-006 …`). The proper `####` heading lines exist, so parsing is unaffected; cosmetic only. Author: **@test-plan-writer** (optional).

11. **[nit] document quality** — `chg-GH-339-test-plan.md` §7.1 (846–847)
    Gap: PMUT-014..022 are listed in both the "Parity gate" row and the "Parity mutation controls" row. Harmless duplication; the mutation-controls row is the authoritative mapping. Author: **@test-plan-writer** (optional).

## Answers to the seven questions

1. **Are the six oracles genuinely observable offline, and does any compare a fixture to itself?** Yes to observability: identity form from the normalized `entityId` string (numeric vs `KEY-123` vs `<sha>:<id>`); pipeline unit/composition from the `PipelineRun` shape (GitHub synthesises one job per item plus a `details_url`/check-run evidence entry — `normalizeCheckRuns`, `github/normalize.ts:230-270`; GitLab carries the pipeline's own job list plus a trace — `normalizePipelines`, `gitlab/normalize.ts:156-198`); state mechanism from the declared workflow maps plus probe outcomes; pagination bound/count presence from the read's signature/return shape, cross-checked to the wire by the exact-URL tenant route and the one-request assertion; carrier arrays from the capability declaration plus the carrier step's report entry; failure classification from the API-2 replay. No oracle compares a fixture-derived value to itself: item counts, numeric bounds, identity values and row spelling are explicitly excluded as diagnostic only, and TC-PMUT-014/015/016/017 each carry a paired control proving the excluded fact does not trip the gate. The iteration-2 `items.length === pageItemCount` tautology is gone: TC-TAX-008 now asserts presence against the declared metadata, the bound's presence on the wire via an exact-URL mismatch (`unfixtured provider request`), the count as a consistency diagnostic only, and one request with no retry. Residual precision notes: N4 (scheme classifier) and N5 (unit derivation).
2. **Does the gate reject both directions, and can a `same-as-reference` cell hide a divergence?** Yes. Omission: a differing dimension missing from the class set → `observed-contradiction` naming that class (PMUT-021). Padding: a class whose dimension agrees → `evidence-reproduction` naming the class (PMUT-022; a second variant reusing another class's evidence fails the same way). `same-as-reference` means all six agree (DM-1, AC-F1-5); `observed` vs `not-observable` is a difference (PMUT-020 i/ii), two `not-observable` agree only when both report it, and an observation on a declared-gap pair fails (PMUT-020 iii). The only residual "hiding" is definitional: (a) a dimension that is `not-observable` on both sides is not compared (by design), and the two Jira write cells have no observable dimension (N7); (b) the failure-classification pair comparison can turn fixture placement into a recorded difference (N6), which is recorded, not hidden.
3. **Are assertion-family outcome and non-carrier step participation genuinely removed, with coverage/clause (a) carrying them?** Yes. F-1 (144) and TDR-0036 §5.4 remove both, with the reason stated (the family is registry-owned and identical across columns; the mock tier skips only for a declared gap, the live deferral, or a missing carrier). The coverage gates already fail a supported operation with no executed step and a declared carrier never exercised (`coverage.ts:245-300`), and clause (a) fails a `declared-gap` skip on a supported operation. TC-PARITY-005 asserts that flipping either produces **no** parity violation, so a reintroduction fails the case. The only participation fact that remains is the carrier step's own participation, now inside `carrier-absent` — correct, but its pair scoping needs N2.
4. **Do the 18-cell totals follow arithmetically, and does each posture hold?** Yes. GitHub 6 covered / 0 / 0; GitLab 1 covered + 4 recorded + 1 gap; Jira 2 covered + 3 recorded + 1 gap → **9 / 7 / 2 = 18**, stated in §1/§3.3/TC-TAX-011/TC-TAX-013 and in the plan's contract, obligation, gate and phase-3 title. Each posture matches delivered capability data: GitHub supports all nine with a page bound and page count; GitLab `transition-work-item` and Jira `read-pipeline-run` are the two declared gaps used for the gap-backed rows; GitLab's `read-pipeline-run` declares no bound/count (the `pagination-model` recorded difference); the six status-less classification cells are `failure-classification` recorded. Covered cells require a declared structure (pagination requires the bound + count), and a vacuous `covered` fails by name.
5. **Is the trap-name baseline sound, and is TC-FLOOR-001 non-vacuous?** The mechanism is right: `tests/fixtures/pins/trap-names.json` is captured from the delivered suites **before** any append in phase 1 (phase-1 obligation 1.6 orders it first), declared read-pinned in phase 3 and never edited, and TC-FLOOR-001 asserts each post-append array starts with the pin and the suffix equals exactly the appended catalog names — a tree invariant, not a base-ref diff. The delivered suites' own assertions (`runTrapCatalog` requires an assertion per entry; each suite pins an exact ordered name array) are satisfied by the append-only extension. Non-vacuity holds via the prefix/suffix comparison and the mutation set (append without assertion; assertion without entry; delete/rename/reorder a delivered name). The "pin bytes unchanged" half has no oracle as written (N3).
6. **Do all cross-artifact references now agree (mutation counts, phase ownership)?** Phase ownership and mutation counts do: 72/72 TCs (4/34/9/11/8/6), 34/34 ACs (3/10/8/7/6), 22 parity mutations (13 structural + 6 dimension + 3 record/set) stated consistently in the test plan §3.1/§4/§6/§7.4/§7.5 and the plan; the register's 55 rows resolve to M1–M55 with the 22 parity rows identified. **References do not all agree**: the four-dimension remnants in blocking finding 1 (TC-PARITY-004, TC-PARITY-008/RSK-TP-12, §2, §7.6, §8.2, plan comment), TDR-0037's pagination row (N1), and the §7.6 TAX grouping (N8).
7. **Are the non-goals intact, and are the five intersections still un-adjudicated?** Intact: no phase edits `packages/adapters/src/**`, the error table, `DOMAIN_KINDS`, projections/exits, the artifact, the flows/steps/skip kinds, or any workflow file; the observation record is a test-only input, never a report or artifact field; phase 4's `types.ts`/`mock-tenant.ts` edits remain the additive tenant extension §7.1 puts in scope. Four of the five intersections are explicitly unpredicted (TC-PARITY-007/008), and the one spec-fixed case — `(gitlab, read-pipeline-run)` must carry `pagination-model` — is declared as DM-4's delivered pagination posture rather than a predicted verdict; the other four are adjudicated from the observations.

## Re-verification of delivered-code claims

- `ConformanceStepResult` field set unchanged (provider, flowId, stepId, operation, status, skipReason, skipKind, assertionCount, failure?); `assertionFamily` only on the flow step; no projection, page bound or truncation field on any closed-operation view. Spec §2.1/API-1/§8.2 match the code.
- GitHub `readPipelineRun(commitSha, limit = STATUS_SOURCE_PIPELINE_LIMIT)` returns `{items, pageItemCount}` with `pageItemCount = payload.check_runs.length` and one synthesised job plus a `details_url` evidence entry per item; GitLab `readPipelineRun(commitSha)` returns `readonly PipelineRun[]` with the pipeline's own job list and trace and no bound/count; Jira has no closed-operation collection read. The delivered pagination postures (GitHub covered / GitLab recorded / Jira gap-backed) are the honest ones.
- Identity forms: GitHub PR/issue numbers and GitLab MR `iid` are numeric (`identityField(payload, "iid") ?? "id"`; `identityField(payload, "number")`); Jira uses `key`; GitHub pipeline items use `<commitSha>:<runId>`. The scheme oracle is well-defined except for the label redundancy in N4.
- Capability postures: GitHub 9/0; GitLab 2 supported + 7 `adapter-not-implemented`; Jira 3 supported + `write-comment` `adapter-not-implemented` + five `provider-unsupported`; 27/13/14/9/5 and 9/7/2 derive correctly. The carrier step for `write-comment` is a gap on GitLab/Jira (N2).
- Status asymmetry: GitHub stamps `response.status` on non-2xx and on the 2xx decode path; GitLab/Jira never do; `httpStatus` is attached only when provided. AC-F2-2/3/5 stay reachable.
- Runner exception: exactly five `addressing.provider === …` comparisons. `flows.ts`/`coverage.ts`/`harness.ts` identity-free; `artifact.ts` carries only the excluded redaction text; `mock-tenant.ts`/`types.ts` are the enumerated homes; zero `"tracker.` literals in the two trees today.
- Trap replay: `runTrapCatalog` fails an entry with no assertion and each suite pins an exact ordered name array — the append-only obligation is the correct one; `tests/structure/trap-catalog.test.ts` enforces minima + required names only.
- CI: five workflow files; `ts-test` fetches the base then runs `pnpm test`; `ts-exports` runs `tests/structure` with no explicit fetch; `ci-topology.ts` presence-only and fail-closed; the delivered checks suites unchanged.
- Plan: parses as `delivery.plan.v1`; six phases; 72/72 TC and 34/34 AC ownership verified mechanically with zero cross-phase AC→TC citations.

## Next remediation targets

`test_planning` (@test-plan-writer: blocking finding 1's test-plan half, N3, N8, nits) and `delivery_planning` (@plan-writer: blocking finding 1's plan comment, N2's plan mirror) and `specification` (@spec-writer: N2, N4, N5, N6, N7; @decision-advisor: N1 and N9 in the phase-1 TDR commit). Re-run the gate after the sweep. **No blocking finding is persistent from iterations 1–2**; the only persistent item (TDR-0037's pagination row, major non-blocking) should be fixed in phase 1, and if it is not, it will surface at DoD as a record contradicting the AC it is cited for.
