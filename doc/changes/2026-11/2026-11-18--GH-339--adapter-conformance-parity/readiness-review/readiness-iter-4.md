# Readiness Review Iteration 4

Verdict: **NOT_READY**
Work Item: GH-339 (M3-S5: Adapter conformance and parity suite, M3)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 4 (delivery gate), full re-run against every artifact re-read from disk. Prior records: `readiness-iter-1.md`, `readiness-iter-2.md`, `readiness-iter-3.md`.

**Delivery gate statement.** There is **no design blocker**. The six-dimension basis, the carrier scoping, the pagination postures, the nine clause ids, the identity-construct rule and the registration-only proof are coherent, observable and mutually consistent. The two blockers are **editorial**: (a) the new trap-name digest fixture required by TC-FLOOR-001 is declared in the test plan but appears **nowhere in the plan's phase scopes**, so phase 1 cannot stage a file it must author; (b) one surviving "four dimension observations" phrase in the test plan's fixture inventory. Neither is persistent from iterations 1–3: every location named by the iteration-3 blocking finding is fixed. One *minor* item is persistent for a third iteration (TDR-0039's runner reconciliation note) and is carried as a note, not a blocker.

## Facets

- spec_completeness: **PASS** — F-1/API-1/DM-1 carry the six oracles and the scoped `carrier-absent`; NFR-2/4/11 and §12 agree.
- ac_quality: **PASS** — every AC has a real offline oracle; omission and padding are both rejected; six of six dimensions have a control; no AC depends on an absent report field.
- plan_coverage: **PASS** — 72/72 TCs (4/34/9/11/8/6) and 34/34 ACs (3/10/8/7/6), one owner each, zero cross-phase AC→TC citations (re-verified mechanically this iteration).
- test_traceability: **PASS** — 34 AC rows ↔ 72 TCs, 0 orphans.
- cross_artifact_consistency: **FAIL** — the digest fixture exists only in the test plan (B1); one four-dimension phrase survives (B2); four stale version citations (N1).
- decision_capture: **PASS** — TDR-0037's pagination row is now correct; TDR-0039's stale note is a minor persistent item (N2).
- system_spec_consistency: **PASS** — delivered-code claims re-verified below.
- plan_doc_update_coverage: **PASS**.
- plan_code_area_coverage: **FAIL** — `tests/fixtures/pins/trap-names.sha256` is authored in phase 1 and read in phase 3 but declared in neither scope (B1).
- dod_defined: **PASS**.

## Iteration-1 findings — status (15/15 Resolved)

All fifteen remain resolved on re-read: pagination postures (GitHub covered / GitLab recorded `pagination-model` / Jira `gap-backed`), the append-only trap-suite obligation with the frozen baseline, the six-dimension parity basis with per-dimension controls, TC-REG-002's non-editing mechanism, the base-free topology pin, the binding identity-construct definition with derived columns, the enumerated nine clause ids, AC-F2-11/NFR-4 family-wired scoping, AC-F2-4's 403 boundary, TDR-0037's two-tree scan scope, TDR-0036's structured violation records, the entry-level class set, the policy-pointer disposition, the `00-index.md` conditional staging, and the `ts-exports` wording.

## Iteration-2 findings — status

| # | Finding | Status |
|---|---|---|
| 1 | Four-dimension basis could not observe three mapped classes | **Resolved** (six-dimension basis) |
| 2 | 18-cell totals contradicted the table | **Resolved** (9/7/2, counted row by row and asserted) |
| 3 | TDR-0037's pagination row said "its truncation signal" | **Resolved** — the row now defines the declared page bound plus whether a count is reported, states that no view carries a truncation flag, and names the three postures; §4's fixture rule names all three |
| 4 | NFR-4 scoping | **Resolved** |
| 5 | `registerId` vs `differenceId`; "four dimensions" in TC-PARITY-004 | **Resolved** — the case now says six dimensions, one class per dimension, cell `registerId` = entry `differenceId`, key match |
| 6 | Trap-name baseline unnamed | **Resolved** — pin + a mechanical digest oracle; but the digest file is not in the plan scope (B1) |
| 7 | Test plan §2 said the plan was "not yet authored" | **Partially resolved** — it now records the plan, but as **v1.3** and "aligned to spec v1.3" (N1) |
| 8 | G1 said "eleven mutations" | **Resolved** (22) |
| 9 | Spec §12 omitted `recorded-difference` | **Resolved** |
| 10 | TDR-0039's reconciliation note is stale | **Persistent (minor)** — N2, third iteration |
| 11 | Plan AC-ownership formatting glitch | **Resolved** |
| 12 | TC-TAX-008 tautological comparison | **Resolved** |

## Iteration-3 findings — status

| # | Finding | Status |
|---|---|---|
| Blocking 1 | Six four-dimension remnants in the test plan + plan comment | **Resolved at all six named locations** — TC-PARITY-004 (six dimensions, `differenceId`/`registerId`), TC-PARITY-008 and RSK-TP-12 (six per-dimension + three record/set + M13), §2/§7.6/§8.2 (six-observation composition; `assertionFamily` appears only as a census field and as an explicit non-source), plan phase-2 comment ("not any single dimension's only source") |
| N1 | TDR-0037 pagination row (persistent major) | **Resolved** (amended) |
| N2 | `carrier-absent` pair scoping | **Resolved** — consistent in spec F-1 (oracle row + paragraph), API-1, DM-1, test plan §2/TC-PARITY-005/§8.2/TC-PMUT-018, plan header/phase-2 contract/phase-2 scope comment; no contradiction found |
| N3 | Pin "bytes unchanged" had no oracle | **Resolved in the test plan** (sha256 sibling, §7.2 + TC-FLOOR-001) — **but the plan does not declare the digest file** (B1) |
| N4 | Identity-scheme classifier ambiguity | **Resolved** (the oracle is stated over the normalized `entityId` form; the pair is well-defined) |
| N5 | Pipeline-model unit derivation | **Resolved** (composition tuple; count diagnostic) |
| N6 | Failure-classification placement effect | **Accepted as a declared consequence** (rationale obligation remains a delivery note) |
| N7 | Two Jira write intersections have no observable dimension | **Accepted as a design limitation** (§12 states six observations; the write cells are same-as-reference by agreement of not-observable facts) |
| N8 | §7.6 TAX grouping did not mirror the plan | **Resolved** (two rows: phase 1 TAX-001/009/010; phase 3 TAX-003..008) |
| Nit | Duplicated inline headings | **Resolved** |
| Nit | §7.1 double-listed PMUT-014..022 | **Resolved** |

## Findings

### Blocking (both editorial, neither persistent)

1. **[major] plan_code_area_coverage / cross_artifact_consistency** — `chg-GH-339-test-plan.md` TC-FLOOR-001 (857) and §7.2 (952) require `tests/fixtures/pins/trap-names.sha256`; `chg-GH-339-plan.yaml` contains **no `sha256` mention anywhere** — not in phase 1's scope (which authors it), not in phase 3's scope (which must leave it byte-identical), not in the header's "PIN THAT GOVERNS AN EDITED SUITE" block, not in the phase-1 gate.
   Gap: the plan's own SCOPE DECLARATION RULE says a phase declares every path whose content it authors or edits, because that is what gives the commit primitive staging authority. As written, phase 1 authors a fixture that no phase can stage; `plan diff` reports it as a stray, the phase-1 commit omits it, and TC-FLOOR-001's digest assertion has no committed digest to read. Introduced by the iteration-3 note's remedy, not by a design change.
   Suggested remediation target phase: **delivery_planning**. Suggested fix: add `tests/fixtures/pins/trap-names.sha256` to phase 1's `scope.files` (authored with the pin, before the append) and to phase 3's `scope.files` (read-pinned, never edited); name it in the header pin block and in the phase-1 gate ("the pin and its committed digest"), and extend the escalation trigger to cover digest regeneration. Author: **@plan-writer**.

2. **[major] cross_artifact_consistency** — `chg-GH-339-test-plan.md` §7.2 adjudication fixture row (948)
   Gap: the row still says the record carries "provider, operation, chosen posture, **the four dimension observations**, evidence/adjudication reference". The owning case TC-PARITY-007 (332), DM-1/DM-2, API-1 and the six-dimension basis say six. A coder authoring `adjudication.json` from the fixture inventory would write four observations and then fail TC-PARITY-007's "six dimension observations". This is the last surviving four-dimension phrase in the three artifacts (the other hits are history rows, the four tracker class ids, the legitimate registry census field, and the spec's factual "no truncation signal" statements).
   Suggested remediation target phase: **test_planning**. Suggested fix: "**the six dimension observations**". Author: **@test-plan-writer**.

### Non-blocking

3. **[minor] cross_artifact_consistency** — stale version citations: test plan §2 plan row (62) says "**v1.3** … aligned to spec v1.3" while the plan is v1.4; plan header SOURCES (42) says "`chg-GH-339-test-plan.md` (**v1.3**: 72 TCs"; test plan §8.2 (1134) cites "(spec **v1.3** API-1, §8.2)"; plan phase-3 contract (1311) cites "(spec **v1.2** DM-4)". The content around each citation is correct; only the version labels lag. Suggested fix: cite v1.4 where the current artifact is meant, and keep older versions only in historical/resolution notes. Author: **@test-plan-writer** + **@plan-writer**.
4. **[minor, persistent] decision_capture** — `doc/decisions/TDR-0039` (325–327): the "Reconciliation note (specification obligation)" still says the spec names the runner among provider-free modules and "therefore disagrees". Spec v1.4 records the pinned runner exception exactly as the record asks; the note describes a resolved disagreement. Third iteration carrying it. Fix in the phase-1 TDR commit. Author: **@decision-advisor**.
5. **[note] delivery obligations (not defects)** — the register's rationale for a `failure-classification` difference that arises because the reference has no fixture on that operation must say so rather than claim a provider divergence (iteration-3 N6); the two Jira write cells are `same-as-reference` by agreement of not-observable facts, and the adjudication record should state that rather than imply an observed equivalence (iteration-3 N7).

## Answers to the six questions

1. **Is the iteration-3 blocking finding closed?** At all six named locations, yes. A **full sweep** found two survivors of the same class: the §7.2 fixture row "the four dimension observations" (B2), and no other four-dimension text (the remaining hits are document history, "four tracker class ids", the four `AC-F3-7` malformations, the "four decision records", and the plan's historical "four-dimension basis … is GONE" note). `assertionFamily` appears only as (a) a `ConformanceFlowStep` field in the census golden (correct — the registry is immutable data, and the census pins it), (b) an explicit non-source in §8.2, and (c) the spec's factual statement that the report does not carry it. "Absence and truncation" appears only as explicit negations/facts, never as a dimension or source.
2. **Does the carrier scoping hold everywhere without contradiction?** Yes. Spec F-1's oracle row (137), the scoping paragraph (142), API-1 (257) and DM-1 (271) all state: declaration half observed once per adapter and compared per column; participation half only on the `write-comment` pair; `not-observable` elsewhere and agreeing with another `not-observable`; a declared-gap carrier operation has no participation observation and yields no difference from its absence; all three adapters declare empty arrays and agree as a recorded negative outcome. The test plan mirrors it in §2, TC-PARITY-005 item 5, §8.2 and TC-PMUT-018; the plan mirrors it in its header, phase-2 contract, phase-2 scope comment and obligation 2.8. No contradictory statement found.
3. **Do the six oracles remain observable and non-vacuous, with full mutation coverage?** Yes. Offline sources: identity form from the normalized `entityId` (numeric / provider key / `<sha>:<id>` / bare); pipeline unit and composition from the `PipelineRun` shape (GitHub's one synthesised job plus a `check-run`/`details_url` evidence entry vs GitLab's own job list plus trace); state mechanism from the declared maps and probe outcomes; pagination bound/count presence from the read's declaration and return shape, with the bound proved on the wire by the exact-URL tenant route; carrier arrays from the declaration plus participation only on `write-comment`; failure classification from the API-2 replay. Counts, numeric bounds, identity values and row spelling are excluded as diagnostic with paired controls. Coverage: six per-dimension mutations M47–M52 (PMUT-014–019), three record/set controls M53–M55 (PMUT-020–022), the M13 falsified-evidence mutation, and the 13 structural mutations — 22 parity mutations in a 55-row register, with assertion-family and non-carrier flips asserted to produce no parity violation.
4. **Do the artifacts agree on versions, mutation counts, ownership and totals?** Counts, ownership and totals agree: 22 parity mutations / 55 register rows / 72 TCs (4/34/9/11/8/6) / 34 ACs (3/10/8/7/6) / 9 covered / 7 recorded-difference / 2 gap-backed. **Version citations do not fully agree** (N1).
5. **Non-goals and intersections?** Intact. No phase edits `packages/adapters/src/**`, the error table, `DOMAIN_KINDS`, projections/exits, the artifact, the flows/steps/skip kinds, or any workflow file; the observation record and digest are test-only. The five intersections: four unpredicted; `(gitlab, read-pipeline-run)` is spec-fixed via DM-4 and declared as such in TC-PARITY-007/008, not a predicted verdict.
6. **Any side effects of the sweep?** One, and it is the main blocker: the new digest file (B1) is outside every declared scope. Otherwise: TDR-0037 is now consistent with the spec; §7.1 no longer double-lists the dimension mutations; §7.6 mirrors the plan's TAX split; the frozen — pin — references in the plan were not extended to the digest (B1). No AC's cited TCs moved; no count changed; no citation points at a retired spec section (`§5.1–§5.4` still exist in TDR-0036 and are cited correctly).

## Re-verification of delivered-code claims

`ConformanceStepResult` field set unchanged and carries no `assertionFamily`, projection or truncation field; `readPipelineRun` on GitHub returns `{items, pageItemCount}` with one synthesised job plus a `details_url` evidence entry per item, GitLab returns a bare `PipelineRun[]` with the pipeline's own jobs and trace, Jira has no closed-operation collection read; identities are numeric for GitHub PR/issue and GitLab `iid`, keys for Jira, `<sha>:<id>` for pipeline items; capability postures are 9/0, 2+7, 3+1+5 and the 27/13/14/9/5 and 9/7/2 arithmetic follows; GitHub stamps `httpStatus` on non-2xx and on the 2xx decode path while GitLab/Jira never do; the runner has exactly five `addressing.provider === …` comparisons; `flows.ts`/`coverage.ts`/`harness.ts` are identity-free and the artifact module carries only the excluded redaction text; zero `"tracker.` literals exist in the two scanned trees; `runTrapCatalog` requires an assertion per entry and each suite pins an exact ordered name array; `tests/structure/trap-catalog.test.ts` enforces minima and required names only; CI has five workflow files with `ts-test` fetching the base then running `pnpm test` and `ts-exports` running `tests/structure` base-free; the plan parses as `delivery.plan.v1`.

## What must be true to start delivery

Two edits, both assigned and both editorial:
1. `@plan-writer`: declare `tests/fixtures/pins/trap-names.sha256` in phase 1 and phase 3 scope, the header pin block, the phase-1 gate and the escalation trigger.
2. `@test-plan-writer`: change §7.2's adjudication row to "the six dimension observations", and refresh the four stale version citations.

Re-run this gate after those two edits. If both are applied and nothing else changes, every facet passes and delivery may start. Optional-but-recommended in the phase-1 commit: reconcile TDR-0039's note. No blocking finding from iterations 1–3 persists; the only persistent item is that minor record note.
