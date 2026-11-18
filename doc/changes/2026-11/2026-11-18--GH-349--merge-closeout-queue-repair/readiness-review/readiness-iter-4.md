# Readiness Review Iteration 4

Verdict: **NOT_READY**
Work Item: GH-349 (M4-S11: Merge, closeout, and queue repair on the primitives, M4)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 4, run at `f65beb4e` against spec **v1.6**, test plan **v1.8** (87 TCs, 116 controls), the plan (7 phases; phase 5 = **64** files), the amended ADR-0012 / TDR-0044 / ODR-0005, pm-notes and the delivered tree. Re-run at this gate: `delivery-os plan validate GH-349` → `valid / full / readyForDevelopment=true`; `delivery-os lint plan GH-349` → `valid`, exit 0.

**One factual defect blocks, and it is one row of Appendix H.** The mechanical sweep exists, reproduces over the same file population, and its pin set is complete: all **18** pins exist, all 18 are in phase 5 `scope.files`, all 18 are asserted by TC-SYNC-009, the posture content is stated in five places, and no pin is over-declared. What the sweep still gets wrong is the classification of **one file it names**: `packages/testkit/src/conformance/parity.ts` is recorded as "derived (no edit)" while its two literal authored columns must gain the tenth operation, and the plan's own SCOPE DECLARATION RULE names Appendix H's pin/derived rows as *the authority* for whether a file is editable. Two stale labels and two classification omissions accompany it.

**This is not a stalemate.** No pin is unowned, no gate is red by construction, and phase 5 has staging authority for every file it must touch. The blocking finding is a two-cell correction to Appendix H; the escalation condition iteration 3 named (a pin *unowned* by the sweep) is not met.

## Iteration-3 disposition

| # | Sev | Facet | Disposition | Evidence |
|---|---|---|---|---|
| B1 | blocking | plan_code_area_coverage · plan_buildability_ordering · cross_artifact_consistency | **Closed in substance; one residual classification error split out as P1** | All five required edits hold — see the sub-table below. The five new pins are real, delivered, staged and asserted, and the pin count now reads **eighteen** in DM-6 (spec:318), DM-7 (spec:319), Appendix D (spec:701), Appendix E item 2 (spec:720), Appendix H (spec:757, 761), AC-F4-1 (spec:501), NFR-6/NFR-7 (test-plan:176 + §3.1 carriers), TC-SYNC-009 (test-plan:1083), §7.2 (test-plan:1201), §7.6 row 5 (test-plan:1437), and the plan (phase-5 title, scope comment, obligation 5.x, escalation trigger). Residual: `packages/testkit/src/conformance/parity.ts` is still labelled **derived** and must be edited (P1). |
| N9 | major | cross_artifact_consistency · test_traceability | **Resolved** | Appendix E declares the set **five** with the fifth pairing and its rationale (spec:732); the plan's CROSS-PHASE CARRIER CASES block now reads "The set is FIVE, not four" and lists `AC-F4-1 → TC-SYNC-010` as item 5 with the non-exclusivity proof (plan:858-895); phase 7 owns TC-SYNC-010 (plan:2281) and phase 5 owns TC-SYNC-009 (plan:1772). Every AC keeps a case inside its owning phase. |
| N10 | minor | documentation_impact_identification · carrier taxonomy | **Resolved** | The `feature-adapter-conformance.md` Appendix A row is reworded "Registry-bound prose … not a delivered-check-bound carrier" (spec:628) and the carrier-class paragraph states exactly **three** delivered-check-bound pages with their binding checks (spec:639). TC-SYNC-010's owner note keeps the reference-behavior page in phase 5 (test-plan:1093). |
| N11 | nit | cross_artifact_consistency | **Resolved** | `tests/conformance/mock-conformance.test.ts` moved from the derived cell to the pin cell (spec:761), is in phase 5 scope (plan:2087), and is asserted as TC-SYNC-009 item (16) with mutation `M116` (test-plan:1083, 1425). |

Totals: **3 resolved, 1 closed-in-substance with one residual (→ P1), 0 regressed.**

### B1's five required edits, verified one by one

| B1 item | Required | Verified |
|---|---|---|
| 1 | Four files into phase 5 scope (64 files); record the mock-suite edit | `tests/types/merge-delivery-request.type-test.ts`, `tests/behaviour/closeout-capabilities.test.ts`, `tests/behaviour/providers/provider-capabilities.test.ts`, `tests/fixtures/ports/capabilities.ts` all in phase 5; scope count measured **64**; `tests/conformance/mock-conformance.test.ts` present (plan:2087); new pin test `tests/structure/adapter-operation-consumers.test.ts` present. |
| 2 | Derived→pin for three files, two new paths, count 13→18, same count everywhere | Done in Appendix H's pin cell and in the nine artifact locations listed above. `N9`'s companion count in test-plan §3.1 still says "thirteen" (P2). |
| 3 | Read-only claim three → **four** provider-path items | Stated in the SCOPE RULE (plan:217-232, paragraph at 227-231), the phase-5 "READ-ONLY, NARROWED" block (plan:1915-1923), the matching escalation trigger (plan:1059), test plan §7.1 (test-plan:1238) and §7.6(x) (test-plan:1466). One stale label remains on TC-FLOOR-003 (P3). |
| 4 | State the posture content in DM-6 | GitHub supported += `close-milestone` with an **empty** gap list, GitLab `adapter-not-implemented`, Jira `provider-unsupported` (spec:318); `EXPECTED_SEED_POSTURES` 10 / 8 / 7 and `WRITE_METHODS`' tenth arm (spec:318, test-plan:1083 item 12/6); `operationLabel`'s tenth case (spec:318, test-plan:1083 item 2); the same three values restated in the escalation trigger (plan:1057) and the phase-5 scope comment (plan:2054-2062). Delivered truth confirms the reasons: GitLab gaps all `adapter-not-implemented` (`packages/adapters/src/gitlab/capabilities.ts:16`), Jira `provider-unsupported` (`.../jira/capabilities.ts:18`), GitHub gap list empty (`.../github/capabilities.ts:27`). |
| 5 | Re-derive the sweep mechanically, classify every hit, check the classification in | Done, and I re-ran it independently — see below. Population claim reproduces exactly (**2 135** files). |

## Independent scan (run at this gate, not read from the artifacts)

Scope and tokens as Appendix H states them: `packages/*/src/**/*.ts` + `tests/**/*.ts` (build output excluded), grepping `ADAPTER_OPERATIONS`, `Record<AdapterOperation`, `never = operation`, `operationLabel`, `supportedOperations`, `declaredGaps`, `ALL_OPERATIONS`, `gapsExcept`, `EXPECTED_SEED_POSTURES`, `WRITE_METHODS`, the nine operation literals, and the size spellings `nine` / `toHaveLength(9)` / `toBe(9)`. Every hit was classified pin / derived / unrelated and compared with Appendix H.

Result: **the pin set is right; one classification is wrong; three hits are unclassified.** No hit my scan found is an *unowned* pin — every file that must be edited is in a phase's scope.

### Diff against Appendix H (mismatches only)

| # | Hit found | Appendix H says | Delivered truth | Edit needed? |
|---|---|---|---|---|
| 1 | `packages/testkit/src/conformance/parity.ts:174-185` (GitLab authored column, nine literal rows) and `:188-199` (Jira, nine literal rows) | **derived — "rows and rules derived from the constant", no edit** | Only the GitHub column is derived (`:170`, `EVERY_OPERATION.map`). GitLab and Jira are literal arrays. The gate's cell-set rule (`parity.ts:488-537`) reports "matrix is missing the `close-milestone` cell for gitlab/jira", and `tests/conformance/parity-gate.test.ts:145-152` asserts `total === 27` **and** `column.cells.map(operation).sort() === [...ADAPTER_OPERATIONS].sort()` for every column. → **pin** | **yes** (P1) |
| 2 | `tests/structure/provider-surface.test.ts:226-241` (`expect(Object.keys(client).sort()).toEqual([… 14 members])`) | pin cell cites only `:192-202` (GitHub's supported array) | Same declared file, second exact array. The supported `close-milestone` operation requires a client method (`provider-capabilities.test.ts:196-213` demands one), so this list must gain it. | yes, inside a declared file (P4) |
| 3 | `tests/structure/content-inventory.test.ts:938` (`"core/src/contracts/adapter-capabilities.ts": ["ADAPTER_OPERATIONS", …]`) | not classified in the `ADAPTER_OPERATIONS` row (the sibling rows classify the same construct as derived) | derived — it asserts exported **names**, which do not change | no (P5) |
| 4 | `tests/conformance/github-transport-parity.test.ts:196-214` (route-member list incl. `merge-delivery-request`) | not classified | unrelated/derived — it asserts the *fixture route table's own* members, not the client's member set; a new client member does not move it | no (P5) |
| 5 | `tests/conformance/artifact.test.ts:442-452` (nine-literal `toContain` loop) | only `:124` recorded (ambiguous) | unrelated — presence (`toContain`), not set equality; ten operations leave it green, and `:124`'s `flows` really is 3 × 3 | no (P5) |

**Inverse error (over-declaration).** Checked each of the 18 pins against its assertion: every one carries a nine-member count, an exact nine-member array, a nine-key record, a nine-entry list, a nine-row literal map, or an exhaustive `never` arm that fails to compile at ten. No pin is declared that would force an unnecessary edit, and the one non-pin in the region — `artifact.flows` — is correctly declared to stay nine, with a control that fails if a delivery "fixes" it.

**Stated hit count.** The 2 135-file claim reproduces exactly. The **329-hit** claim does not reproduce under four readings of the stated method: tokens only = **275** lines; tokens + size spellings = **423**; tokens + literals = 947; tokens + literals + size spellings = 1 095; non-comment lines of the token+size reading = 391 (P6). This does not affect the pin set, but the appendix's authority rests on being reproducible, so the number should be stated with its counting rule or dropped.

## Facets

| Facet | Result |
|---|---|
| ticket_alignment | **PASS** — four ticket clauses and every named task traced (Appendix B). |
| spec_completeness | **PASS** — no ticket requirement unaddressed; posture content now declared, not just counted. |
| ac_quality | **PASS** — 46 ACs, each with a producing branch, carrier and control; no unreachable branch. |
| plan_coverage | **PASS** — 46/46 ACs, 87/87 TCs owned exactly once (per-phase: 0 · 2 · 23 · 7 · 9 · 20 · 12 · 14); phase 5 = 64 files. |
| test_traceability | **PASS** — every AC mapped in §3.1; the five cross-phase citations declared with rationale; no orphan case. |
| cross_artifact_consistency | **FAIL** — P1 (the classification authority contradicts DM-7 / §24.5(6) / §7.6 / phase-5 contract), P2 (a stored pin count), P3 (a read-only label). |
| decision_capture | **PASS** — three `Proposed` records, cited not duplicated, declared in phase 1 (plan:1255) with their index rows already committed; no phase edits a record; OQ-1 is a phase-5 gate. |
| system_spec_consistency | **PASS** — no artifact contradicts a current-truth page; the three prose-only pages and the registry-bound page are correctly assigned. |
| plan_doc_update_coverage | **PASS** — three delivered-check-bound, one case-bound set, one AC-bound page, one test-plan-bound page, the rest phase 7; `ados_distribution` obligation stated. |
| plan_code_area_coverage | **PASS** — all 18 pins, the state-layer arm, the two goldens and the conformance ripple are in phase 5; every file an edit is needed in is declared (P4's file included). |
| dod_defined | **PASS** — 46 testable ACs, §4.1 measurable metrics, G12 binding, DoD evidence per plan phase. |
| plan_buildability_ordering | **PASS** — each commit's pins move with their counterpart (identity + seven sites phase 1; type + validator + goldens + eight suites phase 2; attribution + two goldens phase 3; fold + row + registry read phase 4; the whole Appendix E ripple + two closeout goldens + state arm phase 5; conditional repair phase 6; defect suites + residual pins + docs phase 7). `plan validate` / `lint plan` green at this HEAD. |
| specification_quality | **FAIL** — P1 and P6: two stated facts about the sweep do not match the tree. |
| carrier_observability | **PASS** — every widened/added value has a named delivered carrier and a write-then-read round trip. |
| scope_honesty | **PASS** — no new verb, kind, key, job or second mechanism; the two widenings stay declared and bounded. |
| testability | **PASS** — 87 cases, 116 controls (M001–M116 contiguous, measured), declared control shapes, no moving base. |

## Findings (new or persistent only)

### P1 [major — drives this verdict] specification_quality · cross_artifact_consistency — Appendix H misclassifies `packages/testkit/src/conformance/parity.ts` as "derived (no edit)"; two literal authored columns must gain the tenth operation

**Artifacts:** `chg-GH-349-spec.md` Appendix H `ADAPTER_OPERATIONS` row derived cell (spec:761, third column); the SCOPE RULE's authority sentence in `chg-GH-349-plan.yaml` (plan:232 — "Appendix H's pin/derived rows are the authority for which is which"); contradicted by DM-7 (spec:319), Appendix E item 6 (spec:724), §7.6's conformance/parity row (test-plan:1440) and phase 5's contract (plan:1905).

**Gap.** Appendix H classifies `packages/testkit/src/conformance/{parity,coverage,participation}.ts` as "rows and rules derived from the constant". For `parity.ts` that is true of exactly one of its three columns: GitHub is `EVERY_OPERATION.map((operation) => ({ operation, cell: same() }))` (`parity.ts:170`), but the GitLab column (`:174-185`) and the Jira column (`:188-199`) are **nine literal rows each**, carrying their per-operation cell and gap reason. `buildParityMatrix` (`:317-325`) turns those into the matrix columns, and the gate's cell-set rule (`:488-537`) emits `matrix is missing the <operation> cell for <column>` for any operation absent from a column. The suite then asserts `total === 27` and, for **every** column, `column.cells.map(operation).sort()` equals `[...ADAPTER_OPERATIONS].sort()` (`tests/conformance/parity-gate.test.ts:145-152`). At ten operations both literal columns must gain a `close-milestone` gap row — hence `packages/testkit/src/conformance/parity.ts` is a **pin**, and the appendix's own definition of derived ("reads the declaration and therefore moves with it without an edit") does not cover it.

The contradiction is what makes this reportable rather than cosmetic: the plan tells a coder that Appendix H decides pin-vs-derived, the appendix says no edit, and three other artifacts plus the red gate say edit. A coder who follows the designated authority either stops (the escalation trigger treats a pin left at nine or a consumer "discovered during delivery" as a revision event) or edits while believing the inventory was wrong. The edit itself is unambiguous — DM-7 supplies the content ("27 cells → 30, GitHub `same-as-reference`, the other two `gap` with their declared reasons") and §7.6 names the file as an editable target — so nothing is unbuildable; the artifact simply asserts something false about its own sweep, which is the class this gate has now caught three times.

**Suggested remediation target phases:** specification (classification row), then re-run.

**Minimum fix (two cells, no count ripple):** in Appendix H's derived cell, replace the `parity.ts` entry with the delivered fact — "`packages/testkit/src/conformance/parity.ts`: the GitHub column is `EVERY_OPERATION.map` (**derived**); the GitLab (`:174-185`) and Jira (`:188-199`) authored columns are literal and **gain the tenth `close-milestone` gap row** under Appendix E item 6 (27→30 cells), and are pinned there, not in this row's eighteen" — and, in the pin cell, add the cross-reference `(→ Appendix E item 6)`. This keeps the eighteen-pin count true (it counts operation-set assertion sites; the parity rows are the Appendix E ripple) and removes the false "no edit". If the PM prefers to count it as a nineteenth pin instead, the change is larger (eleven artifact locations) and does not change what delivery must edit.

### P2 [minor] cross_artifact_consistency — `chg-GH-349-test-plan.md` §3.1's AC-F4-1 row still says "thirteen enforcing pins" while the same row says eighteen

**Artifacts:** `chg-GH-349-test-plan.md:114` (assertion column: "**the tenth operation's thirteen enforcing pins** all move 9→10") against the same row's carrier column ("the **eighteen** `ADAPTER_OPERATIONS` pins") and spec AC-F4-1 (spec:501, "**eighteen** membership pins").

**Gap.** A stored count contradicting itself inside one table row, in the document the DoD reader uses as the reverse map. Every other location reads eighteen; the v1.8 history entry claims §3.1 was aligned.

**Suggested remediation target phase:** test_planning.
**Minimum fix:** change "thirteen" to "eighteen" in that cell (and, optionally, the confusing history phrasing at test-plan:188 — "thirteen when v1.6 landed; eighteen after spec v1.6's sweep" describes a state that never existed, since v1.6 *is* the sweep).

### P3 [minor] cross_artifact_consistency — TC-FLOOR-003 still labels `tests/behaviour/providers/**` "(delivered, read-only)"

**Artifacts:** `chg-GH-349-test-plan.md:1119` (`**Target** \`tests/behaviour/providers/**\` (delivered, read-only)`) against §7.1's "except the **four** provider-path items" (test-plan:1238), §7.6(x) (test-plan:1466), the plan's SCOPE RULE (plan:227-231) and its escalation trigger (plan:1059).

**Gap.** B1 item 3 amended the SCOPE RULE, the phase-5 block and the trigger, but a fourth location kept the old wording. The case's *body* is correct (it compares declarations and requires the delivered provider suites green); only the target label denies the permitted edits.

**Suggested remediation target phase:** test_planning.
**Minimum fix:** "`tests/behaviour/providers/**` (delivered; the four provider-path items of §7.6(x) move, every other suite is read-only)".

### P4 [nit] plan_code_area_coverage — a second exact array in a declared file is unnamed: `tests/structure/provider-surface.test.ts:226-241`

`Object.keys(createGitHubClient(...)).sort()` is asserted against a fourteen-member literal list. The GitHub client gains the milestone read/close members (plan phase 5 declares `packages/adapters/src/github/client.ts`; §7.6 names "read + close"), and `provider-capabilities.test.ts:196-213` requires a client method for the supported operation, so the list moves. The file is in phase 5 and the operation-set pin in it is declared, so staging authority exists and G2 surfaces the diff immediately — this is a content note, not a scope defect. Target: specification (one clause on the provider-surface pin, e.g. "and its exact `Object.keys(client)` list gains the new method").

### P5 [nit] specification_quality — three scan hits are classified nowhere

`tests/structure/content-inventory.test.ts:938`, `tests/conformance/github-transport-parity.test.ts:196-214` and `tests/conformance/artifact.test.ts:442-452` are hit by the recorded tokens or carry the operation literals, and none appears in Appendix H's pin, derived, unrelated or ambiguous cells. None needs an edit (evidence in the diff table). Appendix H's method promises "each is classified below"; the residue rule depends on it. Target: specification (three phrases in the derived/unrelated cell).

### P6 [minor] specification_quality — the stated hit count does not reproduce

Appendix H claims 329 hits over 2 135 files. The file count reproduces exactly; 329 does not: 275 lines for the token list alone, 423 with the size spellings added, 1 095 with the nine literal spellings added, 391 excluding comment lines. Target: specification — state the counting rule and either the reproducible number or no number. Does not affect the pin set, which I verified independently.

## Prior-iteration regression check

Iteration-1/2 fixes hold: the retired `refusal-rebase` golden pair with "2 moved / 2 retired / 11 unchanged" (test-plan §7.5, §10); the seven identity pin sites and their six delivered 149-bearing files, all in **phase 1** scope (measured); the `merge.sync-required` pair `dirty` | `behind-unconfirmed` with `behind` explicitly superseded in the plan preamble and the escalation trigger; `landing.shaOnBase` widening with its state-layer validator (Appendix H row 7); the `milestone-state` seventh family with trap families held at six; `CLOSEOUT_OPERATION_NAMES` 6→7 with **both** arms (contract array + `state/closeout.ts`), each with a round trip and a named mutation (M105/M106); the OQ-1 phase-5 gate and the D8 closure; three `Proposed` decision records staged but unedited. Nothing regressed.

Counts re-measured at this gate: 46 ACs, 87 TCs, 116 mutation rows (M001–M116), 7 phases, phase-5 files 64, phase-5 owns 20 TCs and 9 ACs, ownership sums 46/46 and 87/87.

## Next step

Reopen **specification** for P1 (Appendix H's `parity.ts` classification and the Appendix E cross-reference), P5 and P6; reopen **test_planning** for P2 and P3. Then re-run this gate once. Nothing reopens `delivery`, and no plan phase needs re-planning: the plan stages every file the change must edit, declares the parity row's content, and validates clean.

If the next run finds the sweep's pin inventory still reproducing the tree with no unowned pin and no misclassified pin, the gate should pass on substance rather than word-counting — the remaining risk has moved from the inventory to the coder's judgment about method names, which is delivery's to resolve and `@reviewer`'s to audit.
