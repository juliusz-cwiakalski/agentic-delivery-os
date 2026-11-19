# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-346
Date: 2026-11-18
Pause Required: no

Reopen: **`specification`** (findings 1, 2, 3), **`test_planning`** (findings 1, 2), **`delivery_planning`** (findings 1, 2).

This is the convergence pass after the iteration-3 minimum change set. The four substantive repairs landed and all eight iteration-3 findings are closed on the merits, not on the claim: the three count-bearing pages move in phase 2 with a class rule and a mechanical gate, the rollback refusal set is exercised in all four causes with an empty daemon log, the rollback order and trigger wording agree with TDR-0048 §4 / Appendix E / TC-INST-026 in every cell a declared case reaches, and TDR-0048 §2 step 5 / §2.1 now match Appendix B step 5 / C.2. What remains is the same class the gate has been closing, one layer deeper: the remediation named *pages* but not every *sentence*, and in one case named the wrong sentence. Two of those would ship or introduce a false current-truth statement, so the hard gate stays closed. Both fixes are one authoring pass over the same three artifacts; no design, contract, or plan-phase boundary changes.

No `delivery` finding exists.

## Iteration-3 close-out

| # | Iter-3 finding | Status | Anchor | What remains |
|---|---|---|---|---|
| 1 | MAJOR — three count-bearing `doc/spec/**` pages undeclared | **CLOSED** | Spec 201 (nine-page falsified set), 427 (§8.5 retired claims), 449 (NFR-17), 576–586 (§16 rows, incl. the three pages), 590 (class rule), 659 (AC-F16-1 page set); test plan 78, 142, 557–558, 700, 716; plan 158–195 (twelve documentation paths), 1207–1233 (phase-2 page moves), 1363–1365 (the three pages in phase 2's file list). `APPENDIX_D_FILES` (`tests/structure/error-table.test.ts:2444–2453`) gains `feature-metrics.md` and `feature-supervise.md`, and the token set gains the outgoing forms (TC-INST-106 step 6). | New finding 2: the supervision page's "25th family" is an ordinal, and the declared edit would make it wrong. Nit: the token-form list does not cover `feature-metrics.md:390`'s slash-separated form. |
| 2 | MAJOR — AC-F8-2's `record-stale` arm had no case step | **CLOSED** | Test plan 479 (TC-INST-042 step 6 arm (f), step 7 daemon arm), 127 (AC-F8-2 row); plan 1513–1545, 1607–1611; spec 185, 644, 869. Arm (f) is the post-crash shape (`current` names P, slot holds P) with the full zero-write equality and no record write/creation. | — |
| 3 | MINOR — rollback order and trigger wording disagreed | **CLOSED** | Spec 185 (F-8), 377 (§8.1), 547 (DEC-13), 869 (Appendix E); test plan 458 (TC-INST-026 step 3), 479; TDR-0048 §4 (365–370). Order is slot absent → slot invalid → record precondition, stated once and repeated consistently. | New finding 3: the predicate and the categorical `record-stale` cause diverge in the candidate-run cell (reachable, untested). |
| 4 | MINOR persistent — TDR-0048 §2 step 5 promoted any destination | **CLOSED** | TDR-0048 §2 step 5 (322), §2.1 last row + slot-fate bullet (343–345), riding correction (455); spec Appendix B step 5 (783), C.2 (810–818), §12 (481–487), Appendix F (879); TDR-0046 §5 launcher row ("never promoted"). | Nit: the record files it as a "riding correction" of the iteration-2 amendment while §12/Appendix F call it an iteration-3 amendment; content matches, label differs. |
| 5 | MINOR — rollback dry-run's unmet precondition had no case step | **CLOSED** | Test plan 507 (TC-INST-061 step 6); plan 1547; spec 379, 832. Exit `0`, refusal identity + cause + remedy in place of a plan, snapshot unchanged. | — |
| 6 | MINOR — omitted moves and a false "149-row events baseline" | **CLOSED** | Test plan 78, 680–718 (the nine suites, the omitted sub-moves, the 146-row baseline rule); plan 1120–1200; baseline corrected at test plan 704 and plan 1124–1130. | Nit: `tests/structure/error-table.test.ts:1689–1698` (ten `DOMAIN_KINDS` tail offsets) all shift when `install` appends and are unnamed — loud inside a declared file. |
| 7 | MINOR — refused rollback's daemon position unstated | **CLOSED** | Spec 187 (F-9), 377 (§8.1); test plan 26, 479 step 7; plan 1507–1510, 1607–1611. The ordered refusal set is before the stop; a refusing `--stop-daemon` run leaves the ordered log empty. | — |
| 8 | MINOR — branding page's KPI/NFR/summary claims unpinned | **CLOSED** | Spec 583, 588, 659; test plan 557 step 5, 558 steps 3–4, 716; plan 1930–1950, 2019–2025. | New finding 1: the same identity-literal claim on the CLI entrypoint page is still unpinned and becomes false. Nit: `feature-branding-seam.md:238`'s unqualified "declared five-site literal inventory". |

## Adversarial re-derivation 1 — count pages, phase 2, and every remaining current-count statement

**Phase placement verified.** Phase 2's `files:` list declares all three pages (`chg-GH-346-plan.yaml:1363–1365`) beside the nine count suites (1363–1410) and `tests/fixtures/install/artifact.ts` (1419); phase 2's comment block names each move sentence by sentence (1207–1233). §16's obligation table is twelve rows and the plan's split is 5 (phase 2) + 7 (phase 6) = 12.

**Every `149` in the tree is inside a declared suite.** `grep -rn '\b149\b' tests scripts packages` returns only `tests/structure/error-table.test.ts` (23), `tests/checks/error-table-sync.test.ts` (5), `tests/structure/dispatch-attempts-taxonomy.test.ts` (3), `tests/structure/verify-gates-suite-map-contract.test.ts` (2), `tests/structure/ceremony-contract.test.ts` (2), `tests/checks/supervision-error-socialization.test.ts` (2), `tests/behaviour/ceremony-nonregression.test.ts` (1) — the seven plus the two mirrors. The two extra 149s in the test-plan id scan are references to GH-320's delivered `TC-BIN-050/057` numbering (line 91), not this change's cases.

**Every other current-count or ordinal statement in `doc/**` is either historical or still true.** `doc/planning/oss-tooling/status.md:580` narrates a past "147 -> 149"; `doc/planning/oss-tooling/cli-command-registry.md:185`, `doc/planning/oss-tooling/milestones/m2/backlog.md:48`, `doc/spec/features/feature-supervise.md:9/241/287`, `doc/spec/features/feature-cli-entrypoint.md:132–133`, `doc/00-index.md:58` all say "the 25th family" of `supervise`, which remains true after `install` appends as the 26th. `doc/decisions/TDR-0044` records 25 as the pre-change fact and states the required move. One pre-existing drift is not this change's: `feature-metrics.md:264` says "The family-count pins read 24", already false since GH-295 and untouched by any declared obligation (see accepted debt).

**The only genuine family-count move is the metrics page.** `feature-metrics.md:390` states "the mounted family count (25)" and must become 26; the ceremony page states no family count; the supervision page states an ordinal, not the count (finding 2).

## Adversarial re-derivation 2 — TC-INST-042, four causes, zero writes, daemon log

| Cause | Carrier (test plan 479) | Zero-write equality | Daemon |
|---|---|---|---|
| present-but-unreadable record | step 3 | destination + slot digests/`mtimeNs`, record, profile, no staged file, no rename | none |
| absent record, valid slot | step 4 / arm (d) | same + **no record created** | none |
| readable `current`, no `previous` | step 5 / arm (e) | same, record byte-unchanged | none |
| readable `record-stale` (post-crash) | step 6 / arm (f) | same, **no record write and no record created**, record byte-identical | none |
| `record-stale` + `--stop-daemon` | step 7 | same | **ordered daemon log empty** |

TC-INST-026 (458) keeps the two slot arms and explicitly never reaches the record gate, so the two cases partition the ordered set. The plan's phase-3 ordered set names step 3/(d)/(e)/(f) and the empty-log assertion (1513–1545, 1607–1611), and the daemon fixture is declared by phase 2 (1418) and extended by phase 3 (1672). The arm set is complete.

## Adversarial re-derivation 3 — rollback order and trigger, cell by cell

| Slot | Record | Spec / Appendix E / DEC-13 | TDR-0048 §4 | TC-INST-026 / 042 | Agree? |
|---|---|---|---|---|---|
| absent | any | `install.slot.absent` | same, first | TC-INST-026 step 3 | yes |
| invalid | any | `install.slot.invalid` | same, second | TC-INST-026 step 3 | yes |
| valid | absent / unreadable / stale / `current`-no-`previous` | `install.record.unreadable`, before any daemon action | same, third, four causes | steps 3, (d), (e), (f), (f)+`--stop-daemon` | yes |
| valid | `current` naming `previous` | proceed | proceed | TC-INST-024/025 | yes |
| valid | `current`, record says `previous` = X, slot holds Y ≠ X | the predicate ("names the artifact the swap would install") **refuses**; the cause list **proceeds** (it is `current` and names a `previous`) | the declared limit **proceeds**: it takes `previous` at its word, because no process can read the slot's identity | no case | **no — the predicate contradicts the declared limit; finding 3** |
| valid | candidate artifact running, record `current` for the installed artifact | cause list refuses (`record-stale`); predicate is satisfied (`previous` names the slot occupant) | same cause list, justification ("one generation behind the destination") does not hold here | no case | **no — finding 3** |

Every other cell agrees across all five artifacts, including the pre-stop ordering. The two disagreeing cells are reached by no declared case, and the implementation is pinned by arm (f) (a stale record whose `previous` is present but names a destroyed artifact fails a "previous present" test and passes a `recordState` test), so the plan can implement one consistent rule — the prose is the outlier.

## Adversarial re-derivation 4 — TDR-0048 step 5 / §2.1 vs the spec and TDR-0046

| Situation | TDR-0048 §2 step 5 | TDR-0048 §2.1 | Spec Appendix B step 5 | Spec C.2 | TDR-0046 §5 | Agree? |
|---|---|---|---|---|---|---|
| differing regular compiled artifact | promoted, replacing any slot | same (last row) | same | same | "becomes the rollback slot" | yes |
| delivered launcher | discarded with report; slot unchanged | same, target named | same | same | "discarded … never promoted" | yes (TDR-0046 is silent on the slot, not contradictory) |
| symlink | replaced, never written through, not promoted; slot and target untouched | same | same | same | "replaced … not written through; names the link and its target" | yes (slot fate stated by TDR-0048) |
| absent destination | skipped | created | skipped | created | — | yes |

The iteration-3 finding is closed on the merits. TDR-0046 §5 does not state the symlink's slot fate, but its launcher row already forbids promotion and the slot rule is TDR-0048's; no contradiction survives.

## Findings

1. **[MINOR — blocking] `system_spec_consistency` / `cross_artifact_consistency` — the CLI entrypoint page's identity-literal claim becomes false, is named by no obligation, and is pinned by no phrase.**
   Gap: `doc/spec/features/feature-cli-entrypoint.md:36` states "The committed working-name literals are **exactly the declared five-site inventory**: the three CLI selector sites, the unchanged MCP default, and the resolver's scope-org derivation input", and `:127` lists "the declared five-site identity-literal inventory" as a structural assertion. Phase 1 creates `scripts/build-binary.ts`, which "declares the primary working name once" (plan 574–578, D1/DM-7/AC-F15-3), so after delivery there are **six** committed working-name literals. Both sentences become false. §16's entrypoint obligation (576) names only the identity tokens, the re-entry path, the 26 families, the family flags and the alias restriction; §8.5/F-16's entrypoint entry (427, 201) names only "twenty-five families" and the launcher-only posture; `doc-conformance.test.ts`'s entrypoint row (IDENTITY_ROWS) pins none of it. The spec even claims (588) that only the branding page and the three count pages are the pages "whose falsehood no delivered gate would catch" — which this contradicts. A coder can satisfy every declared assertion and leave two false current-truth sentences — the same silent-drift class as iteration-2 finding 2 and iteration-3 finding 8, one page over.
   Evidence: `feature-cli-entrypoint.md:36,127`; spec 201, 427, 576, 583, 588, 659; plan 574–578, 963, 2019–2025; `tests/checks/doc-conformance.test.ts:417–436,494–534`; test plan 557 (`TC-INST-111` step 1), 558, 716.
   Suggested remediation target phase: `specification` + `test_planning` + `delivery_planning`.
   Suggested fix: add the entrypoint page's two identity-literal sentences to §16's obligation row and AC-F16-1 with the scoped restatement ("five sites **in the product-surface inventory**, plus the one declared build-side site under `scripts/`"); pin a required scoped phrase and the unqualified "exactly the declared five-site inventory" as a stale phrase in `TC-INST-111`/`TC-INST-112` and the doc-conformance entrypoint row; phase 6 restates both sentences in the same edit-set as the phrase.

2. **[MINOR — blocking] `cross_artifact_consistency` / `system_spec_consistency` — the supervision page's "25th family" is `supervise`'s ordinal, not the family count, and the declared edit would make it wrong.**
   Gap: §16 (582) says the supervision page's "mount references move from the 25th family to the 26th"; NFR-17 (449) forbids `25` as a current value; AC-F16-1 (659) requires the three pages to state "the mounted family count 26"; `TC-INST-111` step 7 (557) requires "no `25th` family at its two sites"; `TC-INST-112` step 2 (558) pins "`25` as a current family count"; the plan's phase 2 (1229–1231) commands "the 26th family". But the delivered statements are the **ordinal of `supervise` itself**: `feature-supervise.md:9` ("the mount as the 25th prompt-required family"), `:241` ("presence of the 25th family and every family-count pin"), `:287` ("the prompt-required composition and the 25th family mount"). `install` is appended as the 26th; `supervise` remains the 25th. The delivered suite's own title still says "supervise is the twenty-fifth prompt-required family" (`tests/structure/supervision-mounting.test.ts:13`) and the plan keeps it (only the count and tail pins move). The declared edit would therefore put a false/misleading sentence on a current-truth page and pin it in the phrase table. The only page that states the **count** 25 is `feature-metrics.md:390` ("the mounted family count (25)"), which correctly moves to 26.
   Evidence: `feature-supervise.md:9,241,287`; `supervision-mounting.test.ts:13,41–48`; spec 201, 449, 582, 590, 659; test plan 557, 558; plan 1229–1231, 1363–1365.
   Suggested remediation target phase: `specification` + `test_planning` + `delivery_planning`.
   Suggested fix: scope the family-count move to the metrics page. In the supervision page's obligation, move only the 65 → 66 allowlist references (241, 285) and keep the ordinal at 9/241/287 true — preferably restate `:287` as "the prompt-required composition and the 25th family (with `install` as the 26th)". Correct AC-F16-1's "mounted family count 26" clause to name the metrics page, NFR-17's family-count clause to the count only, `TC-INST-111` step 7 / `TC-INST-112` step 2 to an allowlist-only phrase pair for the supervision page, and phase 2's page bullet accordingly.

3. **[MINOR — non-blocking if accepted] `cross_artifact_consistency` — rollback's record precondition is worded as a name-verification test that disagrees with the declared limit in two reachable cells.**
   Gap: F-8 (185), §8.1 (377), DEC-13 (547), Appendix E (869) and TDR-0048 §4 all word the precondition as "the record does not name, in `previous`, the artifact the swap would install", then list four causes including `record-stale`. `recordState` is defined as the record against the **running** identity (F-8 185, DM-4 408). Two reachable states expose the gap. (i) Record `current`, `previous` = X, slot holds Y (a hand-replaced slot): the predicate refuses (X is not the artifact the swap would install), while the cause list and TDR-0048 §4's declared limit proceed ("the refusal is about a **missing** name, never a **wrong** one"). (ii) `install rollback` run from a candidate artifact C while the installed state is destination A, slot B, record `current` = A and `previous` = B: the record is `record-stale` (C ≠ A), so the cause list refuses, yet its `previous` **does** name B, the artifact the swap would install, so the predicate does not. No AC or case reaches this cell (`TC-INST-044` step 7 covers candidate `status` only; `TC-INST-042` arm (f) is the post-crash shape). The implementation is nevertheless pinned by arm (f) — the stale record there has a `previous` that is present but names a destroyed artifact, so only a `recordState`-based refusal passes — hence the plan and the test agree on one behaviour and the prose is the outlier. The second declared limit (a hand-replaced slot, "never a wrong name") is consistent only on the "supplies a name" reading.
   Evidence: spec 185, 377, 408, 547, 869; TDR-0048 §4 (365–372); test plan 479, 486 (`TC-INST-044` step 7); plan 1513–1545.
   Suggested remediation target phase: `specification` (+ one clause in the test plan if the candidate arm is to be declared).
   Suggested fix: state the precondition operationally — "refuse unless the record is `current` **and** its `previous` supplies a name; `record-stale` is a categorical refusal because the record's claim is one generation behind the destination" — in F-8, §8.1 and Appendix E, keeping the four causes, eleven rows and zero-write claim unchanged. If the owner prefers, record the candidate-run refusal as accepted debt in `chg-GH-346-pm-notes.yaml`; no case changes either way. Whichever route is taken, make arm (f)'s precondition assert that the stale record carries a `previous` naming the destroyed artifact, so the arm discriminates a `recordState` rule from a "`previous` present" rule.

## Accepted residual risks and debt (non-blocking)

| Residual | Why it does not block | Suggested home |
|---|---|---|
| Leftover-scan form list misses `feature-metrics.md:390`'s `149 / 148 / 65 / +115` slash form (and bare `+115`) | The page obligation (plan 1220–1226) and `TC-INST-111` step 7 name the sentence; the scan is a backstop. Add `+115`/`+ 115` and the slash form. | `test_planning` / plan phase 2 (nit) |
| `feature-branding-seam.md:238` "the declared five-site literal inventory" is unqualified and unpinned | §16 says "every sentence"; the test pins 23, 41, 230 and the summary. Add one stale/required pair if the table is meant to be exhaustive. | `test_planning` (nit) |
| `tests/structure/error-table.test.ts:1689–1698` ten `DOMAIN_KINDS` tail offsets all shift when `install` appends; unnamed | Loud inside a declared file; no silent drift. | plan phase 2 (nit) |
| "A title may keep 149" vs the new `149 entries` scan form flagging the title at `error-table.test.ts:2493` | One must give; the coder sees it. | `test_planning` (nit) |
| `feature-metrics.md:264` "The family-count pins read 24" is already false (GH-295 left it) | Pre-existing drift, not falsified by this change; sweep under the class rule or leave. | owner decision |
| TDR-0046 §7 / implementation step 1 still says "add the two-directory read … update the surface/parity baselines" while DM-8 consumes the delivered read and claims no move; the record was restated in place without an amendment header | The spec's DM-8 contingent path and phase 2's decline cover delivery; the record is stale, not contradictory. | `specification` (nit) |
| TDR-0048 files the step-5 qualification as a "riding correction" under the iteration-2 amendment; §12/Appendix F call it an iteration-3 amendment | Content matches; label only. | `specification` (nit) |
| Plan phase 6 says "the five current-truth pages this phase edits"; it edits four (result-contract is phase 2) | Wording; the page set is otherwise exact. | `delivery_planning` (nit) |
| `TC-INST-042` precondition reads "The three states of `TC-INST-041` (absent, damaged, `record-stale`, …)" — a stray fourth item in a "three" list | Cosmetic. | `test_planning` (nit) |
| `chg-GH-346-pm-notes.yaml` records `clarify_scope.started 16:53:00Z` against `completed 16:09:23.758Z` | Persistent since iteration 2; the registry is authoritative and all four artifact phases are complete; the mirror must not be hand-edited. | observation |

## Facet Summary

- spec_completeness: **PASS** — all twelve ticket tasks and six acceptance clauses trace (§17); the doc-set incompleteness is reported under `system_spec_consistency`, not as a dropped requirement.
- ac_quality: **PASS** — 34 ACs are independently testable; AC-F8-2 names all four refusal arms; AC-F16-1 is enforceable by the declared page/case pair for every value it names (its "mounted family count 26" clause is mis-scoped — finding 2 — but the criterion is not ambiguous once the page set is fixed).
- plan_coverage: **PASS** — 34/34 ACs and 84/84 cases have exactly one owning phase (plan 295–347); the TC map is 13+16+24+20+4+7 = 84 and the AC map 8+7+10+6+2+1 = 34.
- test_traceability: **PASS** — §3.1 / §3.1.1 / §3.2 / §3.3 and §5.1 are bidirectional; the only two extra ids are GH-320 references.
- cross_artifact_consistency: **FAIL** — findings 2, 3.
- decision_capture: **PASS** — TDR-0048's step-5 qualification is recorded in the record and mirrored in §12/Appendix F; all five TDRs remain `Proposed` for PR acceptance.
- system_spec_consistency: **FAIL** — findings 1, 2.
- plan_doc_update_coverage: **PASS** — the twelve documentation paths are declared across phases 2 and 6, matching §16's twelve rows; finding 1 is a missing sentence, not a missing page.
- plan_code_area_coverage: **PASS** — every code, suite, fixture, script and page that must change is declared by its owning phase; the nine count suites, the three count pages, `tests/fixtures/install/artifact.ts` and `daemon.ts` are all in phase 2, and the shell suites in phase 5.
- dod_defined: **PASS** — AC-F16-1 plus §16's obligations, NFR-14/NFR-17 and the G0–G7 battery are testable and traceable.

## Verified, not findings

- **Plan artifacts are valid.** `delivery-os plan validate GH-346` → `verdict=valid`, `readyForDevelopment=true`; `delivery-os lint plan GH-346` → `verdict: valid`, no errors.
- **The four iteration-3 repairs are real, not textual.** Walked above: phase-2 placement (three pages + nine suites + two fixtures), TC-INST-042's four causes plus the empty-log arm, the order/trigger table, and the TDR-0048/Appendix B/C.2/TDR-0046 comparison.
- **Every `25` pin in the tree is declared.** The files carrying `toHaveLength(25)` / `toBe(25)` are exactly §7.2's rows (`supervision-mounting`, `metrics-mounting`, `steer-mounting`, `board-mounting`, `events-production-composition`, `dispatch-attempts-composition`, `daemon-production-composition`, `repos-help`, `board-help`, `events-mount-help`, `entrypoint-two-bins`, `ceremony-cli`, `entrypoint-composition`, `entrypoint-bin`); the unrelated 25s (`license-policy`, `dispatch-attempts-count-rule`, `dispatch-divergence-count`, `repos-handover-gate`, `projects-performance`) are correctly undeclared.
- **The count arithmetic is right.** `BASELINE_ROWS.length + 115` occurs four times at three sites (`error-table-sync.test.ts:1081,1082,1162,1185`), 34 + 126 = 160; both tuple stubs read `149/149/148/65` today and move to `160/160/159/66` (delivered = entries minus the one `spend` row); the eight `toHaveLength(149)`, four `149 machine identities`, three "the same 149 identities", three "allowlist of 65" and seven allowlist `toHaveLength(65)` sites are all in the declared mirror.
- **The pre-change baseline is correctly described.** `tests/fixtures/events/error-table-baseline.json` holds 143 rows; the cross-repository comparison is 143 + 3 `events` = 146, not 149. The plan and test plan now say so.
- **Phase arithmetic holds.** Phase 2 = 67 declared files, phase 6 = 10; 13+16+24+20+4+7 = 84 cases; 8+7+10+6+2+1 = 34 ACs; the §3.4 integrity table matches.
- **The branding page's four sentence positions are covered.** `doc-conformance.test.ts:443–445` pins "exactly five sites"; `TC-INST-111` step 5 / `TC-INST-112` step 4 pin the scoped inventory, the two scan scopes, the KPI/NFR wording and the summary; the plan's phase 6 edit-set is one commit.
- **The reservation around iteration 1's blockers still holds.** The Appendix B step-4 content-agreement stop, the step-5 skip, the `ownsInstallation` mechanism, the alias refusal's invoked identity/owning-role/remedy content and the `runningArtifactPath` seam are unchanged and implementable.
- **Observation (persistent).** `chg-GH-346-pm-notes.yaml` records the clarify-scope start after its completion; the registry is authoritative and all four artifact phases are complete, so the gate's precondition holds and the mirror must not be hand-edited.

## Minimum change set for READY

1. **`specification`**
   - Add the CLI entrypoint page's two identity-literal sentences to §16's obligation row and AC-F16-1, with the scoped restatement "five sites in the product-surface inventory, plus the one declared build-side site under `scripts/`" (finding 1).
   - Correct the supervision-page obligation: the 65 → 66 allowlist references move; the "25th family" ordinal stays (supervise is the 25th, `install` is the 26th); scope AC-F16-1's "mounted family count 26" to the metrics page and align NFR-17 (finding 2).
   - Either state the rollback precondition operationally (`current` plus a present `previous`; `record-stale` categorical) in F-8/§8.1/Appendix E, or record the candidate-run refusal as accepted debt in `chg-GH-346-pm-notes.yaml` (finding 3).
2. **`test_planning`**
   - `TC-INST-111`/`TC-INST-112`: pin the entrypoint page's scoped identity-literal phrase (required) and the unqualified "exactly the declared five-site inventory" / "the declared five-site literal inventory" (stale); change the supervision page's phrase pair to allowlist-only (no "26th family" requirement) (findings 1, 2).
   - Optional nits: add the `+115`/slash form to the leftover-scan token set; add `feature-branding-seam.md:238` to the branding row.
3. **`delivery_planning`**
   - Phase 2: the same supervision correction (1229–1231 and its file-list comment); phase 6: add the entrypoint page's two identity-literal sentences to the page obligation and the doc-conformance phrase edit-set (findings 1, 2).

No `delivery` finding exists. Hard gate: **closed** until the above lands and this gate re-runs.

## Iteration note

This is iteration 4 of a nominal cap of ~3, called explicitly as a convergence pass. It is not a stalemate and not a refusal to fix: the four requested repairs are present and correct, and the residuals are two sentence-level scoping errors plus one prose inconsistency. Both blocking findings are one authoring pass over the same three artifacts and change no contract, phase boundary, case count (84), AC count (34) or row count (eleven). Finding 3 may be accepted as documented debt; findings 1 and 2 should not, because each would ship a false statement in `doc/spec/**` — the class this gate exists to stop. The override route remains unavailable for a behavioural change of this kind.
