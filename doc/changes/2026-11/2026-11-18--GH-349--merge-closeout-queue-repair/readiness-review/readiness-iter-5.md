# Readiness Review Iteration 5

Verdict: **READY**
Work Item: GH-349 (M4-S11: Merge, closeout, and queue repair on the primitives, M4)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 5, run at `c5dc2b15` (post-sync `f65beb4e`) against spec **v1.7**, test plan **v1.9** (87 TCs, 116 controls), the plan (7 phases; phase 5 = **64** files), the amended ADR-0012 / TDR-0040 / ODR-0005, pm-notes, the source ticket (`gh issue view 349`), and the delivered tree. At this gate: `delivery-os plan validate GH-349` → `valid / full / readyForDevelopment=true`; `delivery-os lint plan GH-349` → `valid`, zero errors.

**All six iteration-4 residuals are closed, and the independent scan still finds no unowned pin.** The four required corrections landed exactly as specified: the parity module is now split into one derived column plus two authored literal columns with a reciprocal Appendix E item 6 cross-reference; the eighteen-pin count is unchanged and reproduces; no live "thirteen pins" count remains; `TC-FLOOR-003`'s read-only set is narrowed and names the four exceptions; both `provider-surface` arrays are named; the three scan hits are classified; and the stated sweep readings now reproduce numerically (measured at this gate: 275 / 423 / 947 / 1 095 / 391, population 2 135 — all five exact).

What remains is not blocking: one plan-stated post-change length that a precedent-following implementation will exceed by one key (N1), the withdrawn `329` figure surviving in two plan rationale lines (N2), three editorial residues (N3–N5), and one tree-state note about the three untracked decision records (N6). None is a gate red by construction, an unowned pin, an AC without a carrier, or a contradiction that forces a fabricated value.

## Iteration-4 disposition

| # | Sev (iter 4) | Facet | Disposition | Evidence at this gate |
|---|---|---|---|---|
| P1 | major (blocking) | specification_quality · cross_artifact_consistency | **Resolved** | Appendix H's derived cell now reads "`packages/testkit/src/conformance/parity.ts` — **one derived column and two authored columns**: the GitHub column is `EVERY_OPERATION.map` (**derived**); the GitLab and Jira columns are literal nine-row arrays that **gain the tenth `close-milestone` gap row** — pinned by the parity matrix's 27→30 move (**→ Appendix E item 6**) … **not** counted in this row's eighteen" (spec:761); the pin cell closes with "the one operation-driven edit outside this count is `packages/testkit/src/conformance/parity.ts`'s two literal columns (**→ Appendix E item 6**)". Verified against the tree: GitHub column `EVERY_OPERATION.map` (`packages/testkit/src/conformance/parity.ts:170`), GitLab nine literal rows (`:174-185`), Jira nine literal rows (`:188-199`), cell-set rule (`:488-537`), suite asserts `total === 27` plus per-column `[...ADAPTER_OPERATIONS].sort()` and `size === 9` (`tests/conformance/parity-gate.test.ts:145-152`). DM-7 (spec:319) and Appendix E item 6 (spec:724) state the same split; the plan declares `parity.ts` in phase 5 as a `consumer` of `adapter-capabilities.ts` (plan:2084, 2168). No artifact now says "no edit". |
| P2 | minor | cross_artifact_consistency | **Resolved** | §3.1's AC-F4-1 summary cell reads "**the tenth operation's eighteen membership pins** all move 9→10" (test-plan:114), matching its own carrier cell and spec AC-F4-1 (spec:501). Sweep: zero live occurrences of "thirteen pins", "thirteen enforcing" or "thirteen `ADAPTER_OPERATIONS`"; every remaining "thirteen" is the step inventory, the closeout-golden line count, the merge-golden file count, or a §9 history row. |
| P3 | minor | cross_artifact_consistency | **Resolved** | `TC-FLOOR-003`'s target now states the narrowed set — "all of `tests/behaviour/providers/**` **except** the four items the operation-set delta moves (`github-cli-transport`, `github-landing`, `github-collection`, `provider-capabilities` — each owned by `TC-SYNC-009`)" — with carrier, Then, Pass and control aligned (test-plan:1119-1123). Measured: the directory holds **19** `*.test.ts` files; the four named exceptions are among them, leaving **15** — the count the case states. §7.1 (test-plan:1238) and §7.6(x) (test-plan:1466) agree. |
| P4 | nit | plan_code_area_coverage | **Resolved as a coverage defect; its stated length is contested by N1** | Both arrays are named with line anchors and post-change lengths: obligation 5.3b splits `:192-202` (`supportedOperations`, nine → ten) and `:226-241` (`Object.keys(client).sort()`, "a fourteen-member array … so it becomes fifteen"), with the note that the two are different assertions and moving only the first leaves the second red under G2 (plan:1974-1991); the phase-5 scope comment repeats "both 9→10 / 14→15" (plan:2103); the phase verification signal names "BOTH arrays in `provider-surface` moving (supported operations AND the client method set)" (plan:2024). Verified: the file carries exactly those two exact-list assertions, 9 supported members and 14 client members today. |
| P5 | nit | specification_quality | **Resolved** | All three hits are classified in Appendix H: `tests/structure/content-inventory.test.ts:938` → derived (the contract module's exported **names**, unchanged; spec:761 derived cell); `tests/conformance/github-transport-parity.test.ts:196-214` → unrelated (the fixture route table's own members; spec:761 unrelated cell); `tests/conformance/artifact.test.ts:442-452` → unrelated (`toContain` presence over nine literals; spec:761); the `artifact.test.ts:124` ambiguity entry stays recorded. Re-verified in the tree: the inventory row lists export names, the transport-parity list is the fixture's route members, and the artifact loop is `toContain`. |
| P6 | minor | specification_quality | **Resolved in the spec; residue recorded as N2** | Appendix H now states the pin set is the claim, names the five measured readings, the reproducible population (exactly **2 135** files) and the exact filter, and offers no single figure (spec:757). Independently re-measured at this gate over `packages/*/src/**/*.ts` + `tests/**/*.ts` (build output excluded): population **2 135**; tokens alone **275**; tokens+size **423**; tokens+nine literals **947**; both **1 095**; non-comment token+size **391** — all five reproduce exactly. The withdrawn figure is labelled as withdrawn in the spec history (spec:801). |

Totals: **6 resolved** (P4 with the N1 reservation), **0 persisting**, **0 regressed**, **6 new non-blocking notes** (N1–N6).

## Independent scan (run at this gate)

Scope and filter as Appendix H states them. Population: `packages/*/src/**/*.ts` + `tests/**/*.ts`, build output excluded — measured **2 135** files, exact. Filter: `ADAPTER_OPERATIONS`, `Record<AdapterOperation`, `never = operation`, `operationLabel`, `supportedOperations`, `declaredGaps`, `ALL_OPERATIONS`, `gapsExcept`, `EXPECTED_SEED_POSTURES`, `WRITE_METHODS`, the nine operation literals, and `nine` / `toHaveLength(9)` / `toBe(9)`.

Results:

- **Pin set: unchanged and correct at eighteen.** Every one of the eighteen named paths exists, carries the assertion Appendix H attributes to it, and is in phase 5's `scope.files` (machine-checked: 18/18 in phase 5, plus `packages/testkit/src/conformance/parity.ts` and the new `tests/structure/adapter-operation-consumers.test.ts`; 64 files in the phase). No pin is over-declared: each asserts a nine-member count, an exact nine-member array, a nine-key record/map, or an exhaustive `never` arm that fails at ten.
- **The one operation-driven edit outside the count** (`parity.ts`'s two literal columns) is now declared, cross-referenced, and staged. The iteration-4 blocking mismatch is gone.
- **Reverse direction (unowned pins): none.** No file that would need an edit at ten operations sits outside phase 5 scope.

### Diff against Appendix H — mismatch class only (no edit required)

27 files are hit by the recorded filter and carry no name or category in Appendix H (machine diff: 26 by basename, plus `tests/fixtures/closeout/capabilities.ts`, masked by a basename collision with `tests/fixtures/ports/capabilities.ts`). Each was checked and **none needs an edit**:

| Group | Files | Why no edit |
|---|---|---|
| The declaration and its re-export | `packages/core/src/contracts/adapter-capabilities.ts`, `packages/core/src/contracts/index.ts` | The constant itself and its re-export; the declaration is what changes, it is not a consumer of itself. |
| Harness closed set (different vocabulary) | `packages/adapters/src/harness/{claude,opencode}.ts`, `packages/core/src/contracts/harness.ts`, `packages/core/src/domain/harness-capability.ts`, `tests/behaviour/{harness-config,harness-opencode-session}.test.ts`, `tests/checks/harness-mutants.test.ts`, `tests/structure/{harness-contract,coordinator-production-session}.test.ts`, `tests/types/harness.type-test.ts` | `HarnessCapability` has its own `declaredGaps`/`supportedOperations`; Appendix H's "unrelated — a different closed set whose text coincides" covers the class. |
| Operation names as data | six `tests/behaviour/closeout-*.test.ts`, `tests/behaviour/envelope-write-path.test.ts`, `tests/behaviour/providers/{github-closeout-thread-authorship,github-closeout-thread-privacy,jira-trap}.test.ts`, `tests/conformance/live/run-live.ts`, `tests/conformance/support/fixtures.ts`, `tests/fixtures/closeout/mutants/cases.ts` | Literals inside fixtures/cases, or dynamic reads of the declaration (`support/fixtures.ts:134-135` reads `capabilities.supportedOperations`/`declaredGaps`), or a presence check (`jira-trap.test.ts:190`). None asserts the set's size or an exact membership array. |
| Hand-authored capability stubs | `tests/fixtures/closeout/capabilities.ts`, `tests/fixtures/pilot/stubs.ts` | Both declare partial postures and omit operations that already have no entry today (the pilot stub already omits three). The closeout gap resolver defaults an absent entry to `adapter-not-implemented` (`packages/core/src/domain/closeout.ts:406-412, 424-431`), so an omitted `close-milestone` reads as a gap, not as a torn declaration; neither fixture is compared against a real declaration. |
| Clause set, category already named | `tests/checks/parity-gate-wiring.test.ts:135` (`clauses.size === 9`) | `PARITY_CLAUSE_IDS`, not an operation count — the unrelated cell's "parity clause ids" entry. |

No file in this list is a pin omitted from the inventory, and the Appendix H residue rule ("a pin that appears in the tree and not here is a defect in the sweep") is therefore satisfied on substance: nothing here asserts the operation set. The enumeration gap itself is recorded as N5.

## Facets

| Facet | Result |
|---|---|
| spec_completeness | **PASS** — every ticket clause (a)–(d), the queue-integrity clause, the three named defects and the deliverable conventions traced in Appendix B; posture content stated, not counted. |
| ac_quality | **PASS** — 46 ACs, each with a producing branch, a delivered carrier and a control; no unreachable branch (measured 46 AC ids). |
| plan_coverage | **PASS** — 87/87 TCs and 46/46 ACs appear in the plan; phase 5 owns the milestone set, the 18 pins and the parity edit; every AC keeps a case inside its owning phase. |
| test_traceability | **PASS** — 46/46 §3.1 rows present (measured); the declared cross-phase citation set is five, with AC-F4-1 → TC-SYNC-010 as item 5 and a non-exclusivity proof; no orphan case. |
| cross_artifact_consistency | **PASS** (N1, N2 recorded) — no contradiction that changes what delivery must do; the one count question is resolved by G2 against the real client. |
| decision_capture | **PASS** — ADR-0012, TDR-0040, ODR-0005 all `status: Proposed`, each declared in phase 1 with its index row and never edited by a later phase; OQ-1 remains a phase-5 gate (see N6 on the tree state of the three files). |
| system_spec_consistency | **PASS** — no artifact contradicts a current-truth page; the three delivered-check-bound pages, the case-bound and AC-bound pages, and the registry-bound conformance page are correctly separated. |
| plan_doc_update_coverage | **PASS** — phase 1: two identity pages + three decision records + the index; phase 5: `feature-adapter-reference-behavior`, `feature-closeout`, `milestone-management`; phase 7: 24 doc pages; the `ados_distribution` obligation is stated. |
| plan_code_area_coverage | **PASS** — 18/18 pins, `parity.ts`, the state-layer arms, the two goldens, the conformance ripple and both `provider-surface` arrays are staged in phase 5; every file an edit is needed in is declared (N1 is a length, not a scope). |
| dod_defined | **PASS** — 46 testable ACs, the §4.1 metrics with numeric targets, G1/G2 gates, and per-phase evidence obligations. |
| plan_buildability_ordering | **PASS** — each commit's pins move with their counterparts (identity 7 sites phase 1; type + validator + two goldens + eight suites phase 2; attribution + goldens phase 3; fold + row + registry read phase 4; the Appendix E ripple + 18 pins + parity columns + the state arm + two closeout goldens + the two-phase `ceremony-nonregression` files phase 5; conditional repair phase 6; defect suites + residual pins + docs phase 7). `plan validate` and `lint plan` green at this HEAD. |
| specification_quality | **PASS** — the sweep's method, filter, population and pin set are stated and reproduce; the classification now matches the tree. |
| carrier_observability | **PASS** — every widened or added value has a named delivered carrier and a write-then-read round trip where a validator gates it (`state/merge.ts`, `state/closeout.ts`). |
| scope_honesty | **PASS** — no new verb, record kind, state key, job or second mechanism; the terminal commit keeps the PR open. |
| testability | **PASS** — 87 cases; 116 controls, M1–M116 contiguous with no duplicate (measured); declared control shapes; no moving base. |

Owner-judgment items re-checked: **OQ-1** is a precondition on the milestone phase, with its blast radius stated in OQ-1, RSK-2 and Appendix G-6 and no delivery-time switch; **GH-349's own withheld milestone** is AC-F4-7 plus RSK-1 and Appendix G-4 (`skipped-noop` + one residue, never a closed record); **the single-page bound** is F-4, API-4, AC-F4-4, NFR-4, OQ-3, RSK-11 and Appendix G-8, with truncation withholding closure.

## Notes (non-blocking; recorded, not blocking)

### N1 [minor] plan_code_area_coverage · cross_artifact_consistency — the `Object.keys(client)` array's post-change length is stated as 15; the delivered precedent makes it 16

**Artifacts:** `chg-GH-349-plan.yaml:1982-1990` ("a fourteen-member array that gains the new client method (the conformance/write dispatch member for `close-milestone`), so it **becomes fifteen**"), `:2103` ("both 9→10 / 14→15"), against `chg-GH-349-test-plan.md:1437` ("`packages/adapters/src/github/{client,cli-transport}.ts` (**read + close**; the transport key map's tenth key)").

**Gap.** The array gains the close method (`close-milestone` → one client member), and the bounded milestone read is the other new GitHub surface. The delivered precedent puts adapter-local closeout reads on the client: `GithubClient` carries `readWorkItemObservation`, `findMergedDeliveryRequest` and `listBlockedByDependents` (`packages/adapters/src/github/client.ts:118-165`), and `production.ts` composes closeout reads only from `client` (`:1406` creates it; `:1565` reads `client.readWorkItemObservation`). A milestone read implemented on that precedent is a second member, so the exact array becomes **16**. The plan says 15 twice.

**Why this is not blocking.** No gate is red by construction: the expected list in `tests/structure/provider-surface.test.ts` is authored from the actual `Object.keys(client)` inside the same phase-5 commit, and G2 names the real set. The file is in phase-5 scope, so staging authority exists; and no value can be fabricated — a 15-entry list against a 16-member client simply fails and is corrected. This is a stated-length prediction, not a constraint on the implementation.

**Suggested remediation target phase:** delivery_planning.
**Minimum fix (one clause):** in obligation 5.3b(ii) and the phase-5 scope comment, state "gains the milestone-read method **and** the `close-milestone` method (14 → 16); the operation-set membership delta is the single `close-milestone` key" — or, if the read is deliberately composed in `production.ts` against the injected transport rather than on the client, say that beside the count so the 15 is derivable.

### N2 [nit] cross_artifact_consistency — the withdrawn `329`-hit figure survives in the plan and the test plan's binding-source row

`chg-GH-349-plan.yaml:21` ("Appendix H — … transcribed from a mechanical scan (2 135 files, **329 hits**), which is the SCOPE CONTRACT") and `:504` ("the TRANSCRIPTION OF A MECHANICAL SCAN over 2 135 files (**329 hits**)"). Spec v1.7 withdraws the figure as unreproducible and offers the five measured readings instead (spec:757, history spec:801/806); the test plan's binding-source row still describes Appendix H as "a transcribed 329-hit scan" (test-plan:70). The pin set is identical either way, so this is a rationale residue, not a delivery instruction. **Target:** delivery_planning + test_planning. **Fix:** replace the parenthetical with "2 135 files, pin set transcribed" (or the five readings) in the plan preamble and §… plan:504, and drop "329" from the test-plan's spec-summary row.

### N3 [nit] cross_artifact_consistency — `chg-GH-349-test-plan.md:163` reads "the **thirteenth-operation** enforcing pins of Appendix H all move 9→10 … eighteen pins in all"

A garbled remnant of "thirteen-operation": the row's own conclusion is eighteen and the enumeration is the tenth operation's. Editorial, in a reverse-map table (DM-7 row). **Target:** test_planning. **Fix:** "the tenth operation's **eighteen** enforcing pins".

### N4 [nit] version citations — `chg-GH-349-test-plan.md:70` names spec **v1.6** as the binding source and `chg-GH-349-plan.yaml:74` names test plan **v1.8**; the current artifacts are spec v1.7 and test plan v1.9

No requirement differs between v1.6 and v1.7 (v1.7 changed Appendix H's classification and history only) and v1.9 changed two passages without touching a TC, control or assertion. **Target:** test_planning + delivery_planning. **Fix:** bump the two citations in the same pass as N2.

### N5 [nit] specification_quality — the sweep's residue rule promises that every hit is classified; 27 filter hits carry no name or category

Appendix H says "every hit of that filter is classified below" and "a hit a reader finds that is neither in the pin column nor classified here is a defect in the sweep rather than a delivery decision" (spec:757, 769). The 27 files in the scan-diff table above are hit (mostly by operation literals used as data, by the harness closed set, or by hand-authored capability stubs) and appear in none of the four cells. Every one was verified not to assert the operation set, so the pin inventory is right; only the promise is overbroad. **Target:** specification. **Fix:** one clause in the unrelated cell naming the three residual classes — "operation names used as fixture data or presence checks", "hand-authored capability stubs that omit operations (an absent entry reads as a declared gap)", "the harness capability closed set" — which is what the delivered tree actually contains.

### N6 [nit] tree-state note — the three amended decision records are untracked at HEAD while their index rows are committed

`git status` at this HEAD shows `doc/decisions/{ADR-0012,TDR-0040,ODR-0005}-*.md` as untracked, while `doc/decisions/00-index.md` (tracked, identical to HEAD) already links to all three at `:24`, `:27`, `:72` with `status: Proposed`. Phase 1 declares both the records and the index in its scope, so delivery closes the gap in its first commit; the note exists so the coder does not read the committed index rows as evidence that the records are already delivered, and passes the three files through the `commit` primitive with the rest of phase 1.

## Prior-iteration regression check

Iterations 1–4 fixes still hold: the retired `refusal-rebase` pair with "2 moved / 2 retired / 11 unchanged"; the seven identity pin sites (all in phase 1, three of them also legitimately in phase 5); `merge.sync-required`'s `dirty` \| `behind-unconfirmed` pair with `behind` superseded; `landing.shaOnBase`'s widening with its state-layer validator and round trip; `milestone-state` as the seventh assertion family with the trap families held at six / 18 cells; `CLOSEOUT_OPERATION_NAMES` 6→7 with both arms; the OQ-1 phase-5 gate and the D8 closure; three `Proposed` decision records staged but unedited; and the five cross-phase citations with no AC covered only from outside its owning phase. Nothing regressed.

Counts re-measured at this gate: 46 ACs, 46 §3.1 rows, 87 TCs, 116 controls (M1–M116, contiguous, no duplicates), 7 phases, phase-5 files **64**, 18 pins all in phase 5, 19 provider `*.test.ts` files of which 4 move, population 2 135 files, plan `valid / full / readyForDevelopment=true`.

## Next step

Proceed to **delivery** at phase 1. Nothing reopens. N1–N6 are recorded for the delivering phase's own record: N1 should be settled by the commit that authors the client-surface expectation (the number the client actually has wins, and the plan's "fifteen" is the stale half of the pair), N6 rides phase 1 with the decision records, and N2–N5 are editorial cleanups that need no gate re-run. On this evidence the readiness risk has moved from the inventory to the coder's implementation choices and `@reviewer`'s audit, which is where delivery belongs.
