# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-346
Date: 2026-11-18
Pause Required: no

Reopen: **`specification`** (findings 1, 3, 4, 7), **`delivery_planning`** (findings 1, 4, 6, 8), **`test_planning`** (findings 1, 2, 5, 6, 7, 8).

This is the **third** iteration — the escalation threshold named in the gate's re-run policy. It is not a stalemate: the two iteration-1 blockers are closed, seven of iteration 2's ten findings are fully closed, two are closed in substance with residual precision gaps, and one is narrowed to a spec-only fix. The gaps below are new (or a residual of one), not a repeat of a blocker the authors refused to fix. But two of them are of the same class iteration 2 rated MAJOR, so the hard gate stays closed.

No `delivery` finding exists. Delivery is blocked until the minimum change set lands and this gate re-runs.

## Iteration-2 close-out

| # | Iter-2 finding | Status | Where it is closed | What remains |
|---|---|---|---|---|
| 1 | MAJOR — seven delivered error-table suites undeclared | **CLOSED (with residuals → finding 6)** | Test plan §7.2 now lists the seven with a named move each plus the two mirrors (680–705, 718); plan header 133–147 and 701–707 declare the nine as one edit-set; phase 2 declares all nine (1172–1188) and `tests/fixtures/install/artifact.ts` (1217). Walked file by file below. | Several sub-moves inside the declared files are still unnamed; three `doc/spec/**` pages that pin the same numbers are undeclared (new finding 1). |
| 2 | MAJOR — branding-seam page falsified, no phase owned it | **CLOSED (residual → finding 8)** | Spec §16's obligation row (579), the explanation at 584, AC-F16-1's page set (653); plan phase 6 declares the page and the `doc-conformance` phrase in one edit-set (1749–1756, 1760–1763); test plan TC-INST-111 step 5 / TC-INST-112 step 4 (555–556) and §7.2 (713). `IDENTITY_ROWS` really does pin `"exactly five sites"` (doc-conformance.test.ts:444–450), so the phrase move is load-bearing. | The page's KPI bullet (line 41), NFR-9 row (line 230) and summary (line 9) still assert "0 committed working-name literals outside the declared five-site inventory"; no phrase assertion pins them (finding 8). |
| 3 | MAJOR — rollback with an absent record unadjudicated | **CLOSED** | F-8 (185), F-9 (187), DEC-13 (546), §8.1 (377), Appendix C.4 (832), Appendix E (863), AC-F8-2 (638), TDR-0048 §4 (366–370) and the DoR-iteration-2 amendment (444–452), test plan TC-INST-042 arms (d)/(e) (477) and TC-INST-026's partition (456). The record × slot table is re-derived below. | One of the four refusal causes still has no case step (finding 2); the precedence wording is ambiguous in the spec (finding 3). |
| 4 | MINOR — Appendix B step 5 promoted *any* destination into the slot | **PARTIAL** | Spec Appendix B step 5 (777) and C.2 (807–809) now promote only "a regular compiled artifact whose content differs", discard a launcher, and state the symlink is not promoted; F-5 consumes C.2. | **TDR-0048 §2 step 5 (line 322) is unchanged** ("Rename the destination to `<binary>.previous` (replacing any existing slot)") and §2.1's row (343) still does not state the symlink's slot fate. Iteration 2 explicitly asked for "the TDR-0048 wording". The binding design now contradicts the spec it is supposed to supply. |
| 5 | MINOR — `recordState` predicate defined two ways | **CLOSED** | F-8 (185), DM-4 (406), TDR-0048 §2.1 (349), TC-INST-036/037/041/044 (468–469, 476, 484). | — |
| 6 | MINOR — pre-staging agreement read only "permitted" | **CLOSED** | Appendix B (781), D3 (539–543), TC-INST-033 step 2 and TC-INST-037 step 4 (465, 469). | — |
| 7 | MINOR — source of "the running artifact's bytes" undeclared | **CLOSED** | D7 (662–684), SEAM-TP-1 (241), §6.2 fixture row (587), phase 2 declares the fact and the fixture (1149–1156, 1217). | — |
| 8 | MINOR — phase-2 differing-artifact posture undeclared | **CLOSED** | D3's declared policy (557–582), phase-2 contract (972–975), header (e) (744–746). | — |
| 9 | MINOR — uninstaller detection source undeclared | **CLOSED** | Phase 5's "Decision to close" (1573–1608), TC-INST-092's two arms (534) and §7.2's `test-uninstall.sh` row (712), §6.2's stub-binary fixture (595). | — |
| 10 | NIT — primary name declared twice, no agreement assertion | **CLOSED** | TC-BIN-060 step 6 (412) asserts the file name equals the name `--version` prints and that the two declarations resolve to the same name. | — |

## Adversarial re-derivation 1 — the 149 → 160 edit-set, suite by suite

Each named move was read against the delivered file at the cited location. `D` = declared in phase 2; `✓` = the named move is the assertion that exists.

| Suite | Named move (test plan §7.2) | What actually exists | Result |
|---|---|---|---|
| `tests/structure/cross-repository-contract.test.ts` | `additive` gains the eleven `install` codes so `delivered` still equals the pre-change set; `DOMAIN_KINDS` = baseline + `events` + `install`, length `+1 → +2` | 486–516: `additive` is a three-code `retro` set, `delivered = entries − additive`, compared to `baseline.rows + events`; 517–526: exact `DOMAIN_KINDS` set and `toHaveLength(preChangeKinds.size + 1)` | ✓ D |
| `tests/structure/supervision-error-family.test.ts` | tail `at(-2)/.at(-1)` → `at(-3)/.at(-2)`; `live` 146 → 157; `entries.slice(0,146)` re-asserted, indices 146–148 = supervise/metrics, 149–159 = the eleven rows | 46–47 (`at(-2)` supervise, `at(-1)` metrics), 78–87 (`baseline.rows` 146, `live` 146, `slice(0,146)`); 146+2+1 = 149 today; 160−2−1 = 157 after | ✓ D (the `.at(-2)` = metrics shift for `PROMPT_REQUIRED_COMMANDS` in `supervision-mounting` is *not* named — finding 6) |
| `tests/checks/supervision-error-socialization.test.ts` | `sourceEntries` 149 → 160, `documentedRows` 149 → 160, `corpusRows` 70 → 81 | 60–62 exactly those three assertions; `corpusRows` is counted by `runSyncCheck` over `tests/fixtures/result/code-corpora` (sync script 571–621) | ✓ D (folder declared) |
| `tests/structure/ceremony-contract.test.ts` | `149 machine identities` → `160 machine identities` | 119 exactly that phrase; 113 is the title | ✓ D |
| `tests/structure/dispatch-attempts-taxonomy.test.ts` | total 149 → 160 (assertion + docblock) | 2 (docblock), 50 (title), 52 (`toHaveLength(149)`) | ✓ D |
| `tests/structure/verify-gates-suite-map-contract.test.ts` | `sourceEntries`/`documentedRows` 149/149 → 160/160 | 149–150 exactly that pair | ✓ D |
| `tests/behaviour/ceremony-nonregression.test.ts` | `ERROR_TABLE` length 149 → 160 | 56 exactly that | ✓ D |
| `tests/structure/error-table.test.ts` (mirror) | `DOMAIN_KINDS` gains `install`; eleven row tests; allowlist 65 → 66; "every `toHaveLength(149)` becomes 160"; the `"149 identities"` doc assertion becomes 160 | 846, 922, 1156, 1793, 2325, 2495, 2584, 2697 (`toHaveLength(149)`); 1430, 2345, 2475, 2502, 2598, 2722, 2769 (allowlist 65); 1905 (`149 identities`); **2361, 2507, 2631, 2712 (`149 machine identities`); 2508, 2632, 2713 (`the same 149 identities`); 2509, 2633, 2714 (`allowlist of 65 declared identities`); 2650–2651 and 2805–2806 (`entries/documented: 149, delivered: 148, allowlist: 65` tuple stubs)** | ✓ D; the bolded moves are unnamed (finding 6). They fail loudly. |
| `tests/checks/error-table-sync.test.ts` (mirror) | `sourceEntries`/`documentedRows` 149 → 160 and the page-total assertion | 1796–1797, 1808; **plus `BASELINE_ROWS.length + 115` at 1081–1082, 1162, 1185, which must become `+ 126`** | ✓ D; the arithmetic is unnamed (finding 6). It fails loudly (`table length 160 != baseline + 115`). |

Declared in phase 2: **yes** — all nine suite paths are in phase 2's file list (1172–1188), the `code-corpora` folder is declared (1230), `tests/fixtures/install/artifact.ts` is declared (1217), phase 2 = 64 files, and phase 6 = 10 files including `feature-branding-seam.md` (1743–1758). The plan parses and both counts match the plan's own text.

**Other sites pinning 149 / 65 / 25 / total membership that no test-plan row names:**

- `tests/checks/steer-mutants.test.ts:194` asserts the text does **not** contain `BASELINE_ROWS.length + 106` — a stale-arithmetic control that still passes at `+ 126`; no edit needed, correctly undeclared.
- `tests/behaviour/entrypoint-help.test.ts:93`, `daemon-mount-help.test.ts:77`, `cli-edge-seam.test.ts:268`, `daemon-state-scope.test.ts:374`, `projects-help.test.ts:136`, `event-mount-guards.test.ts:108` iterate `PROMPT_REQUIRED_COMMANDS`; adding `install` makes them additional **controls**, not edits. Correctly undeclared.
- `tests/checks/license-policy.test.ts:564` (`floorCases` 25), `dispatch-attempts-count-rule`, `dispatch-divergence-count`, `projects-performance`, `repos-handover-gate` — unrelated 25s.
- `doc/spec/features/feature-ceremony-runner.md:341,364,392`; `feature-metrics.md:260,348,390`; `feature-supervise.md:241,285` — **the three undeclared pages in finding 1.** No gate reads their numbers: the error-table leftover scan (`error-table.test.ts:2444–2470`) lists `feature-ceremony-runner.md` but scans only legacy tokens (`136…146, 62, 63/64`), not the outgoing `149`/`65`; `feature-metrics.md` and `feature-supervise.md` are in no scan at all; `doc-conformance`'s page sets (`FULL_PHRASE_PAGES`, `GENERIC_PHRASE_PAGES`, `IDENTITY_PAGES`) exclude all three.

## Adversarial re-derivation 2 — `install rollback` across record × slot

| Slot | Record | Answer | Zero writes | Sources |
|---|---|---|---|---|
| absent | any | `install.slot.absent` | yes | TDR-0048 §4 order; TC-INST-026 step 1; plan 1295; AC-F9-3 |
| present, invalid (launcher / no injected identity / unreadable) | any | `install.slot.invalid` | yes | TDR-0048 §4; TC-INST-026 step 2; TC-INST-021 step 3; plan 1296–1297 |
| present, valid | absent | `install.record.unreadable` (cause: absent) | yes | F-8, DEC-13, E, AC-F8-2; TC-INST-042 (d); TDR §4 |
| present, valid | unreadable / damaged | same (cause: unreadable) | yes | AC-F8-2; TC-INST-042 step 3 |
| present, valid | readable `record-stale` (its `current` ≠ running) | same (cause: `record-stale`) | yes | F-8, DEC-13, E, AC-F8-2, TDR §4 — **no case step (finding 2)** |
| present, valid | readable `current`, names `previous` | proceed: swap, both identities, record update | n/a (writes by design) | F-9; AC-F9-3; TC-INST-024/025 |
| present, valid | readable `current`, names no `previous` | same (cause: slot-silent) | yes | AC-F8-2; TC-INST-042 (e) |
| present, valid | readable `current`, `previous` names an artifact whose bytes are not the slot | proceed (declared limit: the slot is taken at its word; no slot digest) | n/a | TDR-0048 §4 line 370; DM-2 |

The four **causes** agree across F-8, DEC-13, Appendix E, AC-F8-2, C.4 and §8.1. Two disagreements survive:

1. **Precedence.** §8.1 (377) says rollback "Reads the install record first", and F-8 states the refusal as an unconditional "unless the record can name…". TDR-0048 §4 (366), Appendix E's trigger ("A slot is present but…") and TC-INST-026 order the slot refusals **before** the record precondition. For (slot absent, record absent) the spec's text can be read as `install.record.unreadable` while the TDR and the case require `install.slot.absent`. (Finding 3.)
2. **The shared phrase "cannot name" is wrong for the `record-stale` cause.** In the post-crash state the record's `current` *does* name the slot's occupant; the rule is that the name must be in `previous`. TDR §4 states this correctly; F-8/DEC-13/Appendix E/AC-F8-2/§8.1 all use "cannot name". (Same wording fix as finding 3.)

Zero writes hold in every refusal cell: no rename (both renames are after the gate), no record write, no profile write, no staging file, no record creation (explicit in TC-INST-042 (d)/(e)). One unwritten assertion: with `--stop-daemon`, where the record precondition sits relative to the stop is not stated, while TDR-0048 §4 and the plan (1291–1294) both claim a refused rollback performs "no daemon action". (Finding 7.)

## The four residual risks the plan author flagged

| Flag | Acceptable to start delivery? | Reasoning |
|---|---|---|
| (a) `runningArtifactPath` has no named structural assertion that the domain contains no `process.` read | **Yes, accepted** | D7 (662–684) and SEAM-TP-1 declare the fact, its two production sources and the fixture route. A violation is loud at the behaviour level: steps 2/3 would stage the ~107 MB Bun binary and TC-INST-011, TC-INST-020 and the crash matrix fail content comparison by name. A structural purity arm is a good later hardening, not a delivery precondition. |
| (b) Phase 2's "replaced, not preserved" line has no phase-2 case | **Yes, accepted** | The posture is declared (557–582), true at that commit, invents no identity (Appendix E closed at eleven), and is superseded by TC-INST-020's first state in phase 3 before any release. Same disposition as the phase-2 daemon guard accepted in iteration 2. |
| (c) Phase 6 asserts the result-contract prose facts over a page phase 2 edits | **Yes, accepted, with a cheap improvement** | The page's numeric moves are already gated at the phase-2 boundary by `error-table.test.ts` and `error-table-sync.test.ts` (and G6); only the two prose clauses wait for TC-INST-111. The branch is unreleased in the window. Running TC-INST-111's page assertions in phase 2 as well as phase 6 would close the window for one gate line. |
| (d) §16's eleven-row contract-surfaces table is mapped implicitly rather than row by row | **Yes, accepted** | I mapped all eleven: prompt-required set, family-count/tail, help entries, production registration, page-root mapping, coverage inventory, new page, error table, literal inventory, installer/uninstaller suites, doc conformance → phases 2, 2, 2, 2, 2, 2, 2, 2, 1+2+6, 5, 6. Every row has an owner; nothing is unowned. |

## Facet Summary
- spec_completeness: **PASS** — all twelve ticket tasks and all six acceptance clauses still trace (§17, 655–666); no requirement was dropped in remediation.
- ac_quality: **PASS** — 34 ACs are precise and independently testable; AC-F8-2 names all four refusal arms.
- plan_coverage: **PASS** — 34/34 ACs and 84/84 cases have exactly one owning phase (header 246–312); the missing case *step* is a traceability defect, not uncovered scope.
- test_traceability: **FAIL** — findings 2, 5, 6.
- cross_artifact_consistency: **FAIL** — findings 1, 3, 4, 7.
- decision_capture: **PASS** — TDR-0048's iteration-2 amendment is recorded in the right place with the ruling and its consequences (444–452); all five TDRs remain `Proposed` for PR acceptance. The unamended step-5 sentence is reported under finding 4.
- system_spec_consistency: **FAIL** — findings 1, 8.
- plan_doc_update_coverage: **FAIL** — finding 1 (three `doc/spec/**` pages in no phase).
- plan_code_area_coverage: **PASS** — every code, test, fixture, script and page that must change is declared by the phase that owns it; the nine count suites, the `code-corpora` folder and `tests/fixtures/install/artifact.ts` are all in phase 2.
- dod_defined: **PASS** — AC-F16-1 plus §16's obligations and the gate battery are testable and traceable.

## Verified, not findings

- **Ticket fidelity holds.** `gh issue view 346` still carries the same twelve tasks and six AC clauses; §17's traceability is unchanged.
- **Both iteration-1 blockers stay closed.** The Appendix B step-4 content-agreement stop with in-place reconciliation, the step-5 skip, and the `ownsInstallation` boolean mechanism are intact and still implementable against `bin-launcher.ts`, `production.ts`, the literal scan and `validateSeam`.
- **The rollback ruling is coherent in DEC-13/TDR-0048 §3/§4.** TDR-0048 §3 (361) even supplies the route back (install the slot artifact) and explains why the refusal is temporary; that strengthens the closed finding.
- **The 84-case arithmetic holds.** §7.3 is exactly the 84 plan-scoped ids; the only two other ids in the document (`TC-BIN-050/057`, line 91) are references to GH-320's delivered numbering. AC↔TC is bidirectional; all 34 AC ids appear in the test plan.
- **Phase arithmetic holds.** Phase 2 = 64 declared files, phase 6 = 10; 13+16+24+20+4+7 = 84 cases; 8+7+10+6+2+1 = 34 ACs.
- **The plan parses.** `yaml.safe_load` succeeds; phases 1–6 with the declared scopes; no `tasks` key.
- **The `install rollback --dry-run` exit convention is implementable and consistent** between F-11, §8.1 and C.4 (exit `0`, refusal reported in place of the plan). Only its *unmet* branch has no case (finding 5).
- **Repo-gate surface counts re-verified:** `PINNING_FILES` is the 12 declared files; the stale regex is `toHaveLength(2[34])` today, so the plan's "gains 25, requires a 26 pin" is the right edit; `RESERVED_TWO_SEGMENT_CODES` is 65 today; `PROMPT_REQUIRED_COMMANDS` is 25 with `supervise` last; the events baseline fixture has 143 rows and the events comparison adds 3.
- **Observation, not a finding (persistent from iteration 2).** `chg-GH-346-pm-notes.yaml` records `clarify_scope.started: 16:53:00Z` against the registry's `16:09:23Z`. The registry is authoritative and all four artifact phases are complete; the mirror must not be hand-edited.

## Findings

1. **[MAJOR] `system_spec_consistency` / `plan_doc_update_coverage` — three current-truth `doc/spec/features/**` pages carry the exact counts this change moves, and no phase declares them.**
   Gap: adding eleven rows moves the total 149 → 160 and the allowlist 65 → 66, and the family mount moves 25 → 26. Three delivered pages state those values in the present tense, and two of them state the maintenance rule:
   - `doc/spec/features/feature-ceremony-runner.md:341` ("two-way sync at **149 identities** and a **65-entry** reserved two-segment allowlist"), `:364` ("Delivered at **149 identities** and a **65-entry** allowlist"), `:392` ("Two-way error sync, **149 identities, 65-entry allowlist**").
   - `doc/spec/features/feature-metrics.md:260` ("the table holds **149 entries, 148 delivered rows, and 65 allowlisted two-segment codes**, with the sync-suite arithmetic at `BASELINE_ROWS.length + 115`"), `:348` ("**149 entries / 148 delivered / 65 allowlist / +115**"), `:390` ("The error-table counts (**149 / 148 / 65 / +115**) and the mounted family count (**25**) are pinned … a future identity or family addition moves them the same way").
   - `doc/spec/features/feature-supervise.md:241` ("exact two error rows and the **65-member allowlist**"), `:285` ("the two `supervise` rows, and the **65-member two-segment allowlist**").
   No phase declares any of the three: phase 2 owns the result-contract page, phase 6 owns the entrypoint, doc-distribution, state-layer, result-contract-independent and branding pages (1743–1763), and the plan header claims "the DOCUMENTATION OBLIGATION SET (§16's nine rows and AC-F16-1's page set) is exhausted" (148–153). The spec makes the omission structural: F-16 (201) and §8.5 (427) say **"exactly two"** delivered statements become untrue, while the plan itself counts **three** (238–240) and the branding page (iteration 2) is a fourth. `doc/spec/features/feature-metrics.md:390` literally instructs that a future addition moves these counts; this change does not.
   No gate catches it: `error-table.test.ts`'s leftover scan over `APPENDIX_D_FILES` (2444–2470) looks only for *legacy* tokens (136…146, 62, 63/64), not the outgoing 149/65, and `doc-conformance`'s page sets exclude all three pages. A green `pnpm check` at every phase boundary therefore coexists with three false specification pages — the same silent-drift class as iteration-2 finding 2.
   Evidence: the three pages above; spec 201, 427, 570–584, 653; plan 148–153, 1743–1763; test plan 555–556, 680–718; `tests/structure/error-table.test.ts:2444–2470`; `tests/checks/doc-conformance.test.ts:217–300,417–500`.
   Suggested remediation target phase: `specification` + `delivery_planning` (+ `test_planning`).
   Suggested fix: add the three pages to §16's documentation-obligation table and to AC-F16-1's page set (state the class rule: every page stating the table total, the allowlist size, the `BASELINE_ROWS` arithmetic, or the mounted family count moves with the domain); correct F-16/§8.5's "exactly two" to the full falsified set; declare the three pages in the phase that moves their numbers — phase 2 is the natural owner because the values move there and the "one edit-set" rule applies, and phase 6 is acceptable only if the plan declares the falsehood window as it did for the branding page; extend `APPENDIX_D_FILES` and the legacy token list with this change's outgoing `149`/`65` so the class is mechanically caught next time.

2. **[MAJOR] `test_traceability` / `ac_quality` — AC-F8-2's `record-stale` rollback refusal arm has no case step, while the case's own Expected and the AC claim four causes.**
   Gap: AC-F8-2 (638) requires `install rollback`, with a slot present, to refuse "in every arm — the absent record, the damaged record, the `record-stale` record, and a readable `current` record that names no `previous`". Test plan TC-INST-042 (477) enumerates steps for **three**: step 3 (present-but-unreadable), arm (d) (absent), arm (e) (`current` naming no `previous`) — while its Expected column claims "all four unnamable-record causes — absent, unreadable, `record-stale`, and slot-silent". No other case reaches the stale refusal: TC-INST-036 and TC-INST-037 *reconcile* the stale record and then roll back successfully; TC-INST-026 never reaches the record gate; TC-INST-041 asserts the status reading only. The scope summary (line 26) repeats the false claim. The post-crash state is the hardest and most reachable of the four, and it is the one the TDR-0048 §4 routing decision exists for (369).
   Evidence: spec 638; test plan 26, 127, 456, 468–469, 477; plan 1300–1311 ("arms (d) and (e) carry the two new causes" while the list has four); TDR-0048 §4 (366–370).
   Suggested remediation target phase: `test_planning` (+ `delivery_planning` case note in phase 3).
   Suggested fix: add **arm (f)** to TC-INST-042 — a readable `record-stale` record whose `current` names predecessor P while the destination holds the running artifact's bytes and the slot holds P's bytes → `install.record.unreadable`, exit `1`, the same zero-write equality (destination and slot digests and `mtimeNs`, no record write, no record created, profile unchanged, no rename) — and have the plan's phase-3 ordered set say "the four causes are carried by TC-INST-042 steps 3, (d), (e) and (f)".

3. **[MINOR] `cross_artifact_consistency` — the rollback refusal order and the trigger wording disagree between §8.1/F-8 and TDR-0048 §4 / Appendix E / TC-INST-026.**
   Gap: §8.1 (377) says `install rollback` "**Reads the install record first**", and F-8 (185) states the refusal as an unconditional "refuses … unless the install record can name…". TDR-0048 §4 (366) orders the refusals slot-absent → slot-invalid → record; Appendix E's trigger is "**A slot is present** but the record cannot name…"; TC-INST-026 step 3 asserts exactly that order. For the reachable (slot absent, record absent) state the two readings give different identities. Separately, the shared phrase "cannot name the identity" is false for the `record-stale` cause — the record's `current` does name the artifact; the rule is that the name must sit in `previous` (TDR-0048 §4, 369, says this correctly).
   Evidence: spec 185, 377; Appendix E 863; TDR-0048 §4 (366–370); test plan 456, 477.
   Suggested remediation target phase: `specification`.
   Suggested fix: state the order once in F-8/§8.1 — "rollback evaluates the slot refusals first (`install.slot.absent`, then `install.slot.invalid`), then the record precondition" — and word the trigger as "the record does not name, in `previous`, the artifact the swap would install", keeping the four causes and the eleven rows unchanged.

4. **[MINOR, persistent — iteration-2 finding 4] `cross_artifact_consistency` / `decision_capture` — TDR-0048 §2 step 5 still renames *any* destination into the slot, and §2.1 leaves the symlink's slot fate unstated.**
   Gap: spec Appendix B step 5 (777) and C.2 (807–809) now promote only a differing regular compiled artifact, discard a launcher, and never promote a symlink; TDR-0048 §2 step 5 (322) still reads "Rename the destination to `<install dir>/<binary>.previous` (replacing any existing slot); skipped when the destination is absent", and §2.1's third row (343) names the launcher's discard but not the symlink's slot disposition. The spec's §12 assumption says the five TDRs are the binding design "as amended at DoR iteration 2 (TDR-0048 §2 and §4)" and that the specification "carries their normative details and does not re-litigate them" — yet a coder following the TDR's step-5 sentence gets the wrong slot for a launcher (and an unstated one for a symlink). Iteration 2 asked for "the TDR-0048 wording"; the spec half landed, the record half did not.
   Evidence: spec 777, 807–809, 873, 483; TDR-0048 322, 343.
   Suggested remediation target phase: `specification` (TDR-0048 amendment + one sentence reconciling §12).
   Suggested fix: extend TDR-0048's iteration-2 amendment with the step-5 qualification (only a differing regular compiled artifact is promoted; a launcher is discarded; a symlink is replaced and not promoted, existing slot unchanged) and name the amendment on the spec's §12/Appendix F lines, or state explicitly that the spec's Appendix B supersedes that TDR sentence.

5. **[MINOR] `test_traceability` — the unmet-precondition `install rollback --dry-run` plan is declared content with no case step.**
   Gap: Appendix C.4 (832) now requires the rollback dry-run to print "the refusal identity, its cause, and the remedy, in place of a plan" when the record precondition is unmet; F-11 and §8.1 (378) say the same, and AC-F11-1 requires each printed plan to contain the declared content. TC-INST-061 (505) asserts only the *met* plan (current and slot identities, the two renames, the record update). Nothing exercises the unmet branch, and it is the only dry-run branch whose content changed in v1.2.
   Evidence: spec 378, 832; test plan 505; plan 1312–1314.
   Suggested remediation target phase: `test_planning`.
   Suggested fix: add one step to TC-INST-061 — with the record precondition unmet (reuse the TC-INST-042 (d) fixture) → exit `0`, the refusal identity, its cause and the remedy printed in place of the plan, and a filesystem snapshot unchanged.

6. **[MINOR] `test_traceability` / `plan_coverage` — several "named assertions that move" are unnamed, and the "149-row events baseline" description is factually wrong.**
   Gap: the nine suites are declared (finding 1 closed), but the named-move table omits moves a coder must make inside them: (i) `tests/checks/error-table-sync.test.ts:1081–1082,1162,1185` — `BASELINE_ROWS.length + 115` must become `+ 126`; (ii) `tests/structure/error-table.test.ts:2650–2651,2805–2806` — the tuple stubs `entries: 149, documented: 149, delivered: 148, allowlist: 65`; `:2508,2632,2713` — `"the same 149 identities"`; `:2509,2633,2714` — `"exact two-segment allowlist of 65 declared identities"`; `:2361,2507,2631,2712` — `"149 machine identities"` beyond the one "`149 identities`" the row names; (iii) `tests/structure/supervision-mounting.test.ts:50` — `PROMPT_REQUIRED_COMMANDS.at(-2)).toBe("metrics")` moves to `at(-3)` (the row names only `at(-1)`/supervise); (iv) `tests/structure/error-table.test.ts:2493` and `error-table-sync.test.ts:1793` test **titles** still say 149. All are loud failures inside declared files, so this is precision, not silent drift. Separately, "the 149-row events baseline" (spec 606; test plan 699; plan 1040) is wrong: the events baseline fixture holds **143** rows and is compared as 143 + 3 `events` = 146; 149 is the current table total. A coder reading the number as an expectation would break the test.
   Evidence: the line references above; `tests/fixtures/events/error-table-baseline.json` (143 rows); spec 606; test plan 696–705; plan 1039–1068.
   Suggested remediation target phase: `test_planning` (+ `delivery_planning`).
   Suggested fix: extend §7.2's rows with the omitted moves (or state "grep every `149`, `65`, `148`, `+ 115` and the `at(-2)` metrics tail in each declared file; every hit moves or is a title"), and correct the baseline description to "the 146-row pre-change comparison (143-row events baseline + 3 `events` rows)".

7. **[MINOR] `cross_artifact_consistency` — a refused rollback's daemon position is unstated and unasserted, while the TDR and the plan claim "no daemon action".**
   Gap: TDR-0048 §4 (366) says a refused rollback writes nothing: "no rename, no record write, **no daemon action**", and the plan repeats "no daemon action" in the refusal set's zero-write claim (1291–1294). But the daemon guard's `--stop-daemon` stopping is what the guard does before a swap, and the record precondition's position relative to that stop is never stated. A run with `--stop-daemon` in the post-crash stale state could stop the daemon and then refuse. No case asserts the daemon log on a refusing run, so the claim is neither testable nor specified.
   Evidence: TDR-0048 §4 (366, 371–373); spec 187, 638; plan 1289–1294; test plan 468–469, 477, 525–526.
   Suggested remediation target phase: `specification` (+ `test_planning`).
   Suggested fix: state that the ordered refusal set (including the record precondition) is evaluated **before** the daemon stop, so a refused rollback performs no daemon action; add one assertion to TC-INST-042's zero-write equality on a `--stop-daemon` arm — the ordered daemon log is empty.

8. **[MINOR] `system_spec_consistency` — the branding page's three additional identity-literal claims are falsified by the phase-1 build-side site and no phrase assertion pins them.**
   Gap: beyond `"exactly five sites"` (line 23, which the phase-6 obligation and the `doc-conformance` phrase pair do cover), the same page asserts the claim unqualified at `:41` ("0 committed working-name literals outside the declared five-site inventory", a KPI), `:230` (NFR-9, same wording), and `:9` (summary: "the bounded and declared five-site identity-literal inventory"). After `scripts/build-binary.ts` lands there is one committed literal outside that inventory. The §16 obligation says the page is "restated so the identity-literal claim stays true", which is broad enough in intent, but TC-INST-111 step 5 pins only the scoped sentence, the two scan scopes and the "anywhere else" clause, so a coder can satisfy every assertion and leave three false sentences. Iteration-2 finding 2 is closed for the page as a **file**; this is the same finding at sentence granularity.
   Evidence: `doc/spec/features/feature-branding-seam.md:9,41,230`; spec 579, 584; test plan 555–556, 713.
   Suggested remediation target phase: `test_planning` (+ `delivery_planning`).
   Suggested fix: add the KPI/NFR wording to the phase-6 page obligation and to the `doc-conformance` required/stale pair (required: "zero committed working-name literals outside the product-surface inventory"; stale: the unqualified "outside the declared five-site inventory"); the summary line is restated to "product-surface inventory plus one declared build-side site".

## Minimum change set for READY

1. **`specification`**
   - Add `feature-ceremony-runner.md`, `feature-metrics.md` and `feature-supervise.md` to §16's documentation-obligation table and AC-F16-1's page set (or state the count-bearing-page class rule), and correct F-16/§8.5's "exactly two" to the full falsified set (finding 1).
   - State the rollback refusal order (slot absent → slot invalid → record precondition) and word the record trigger as "does not name the artifact in `previous`" in F-8/§8.1 (finding 3).
   - Extend TDR-0048's iteration-2 amendment with the step-5 qualification (launcher discarded, symlink replaced and not promoted, existing slot unchanged) and reconcile §12/Appendix F (finding 4).
   - State that the ordered refusal set is evaluated before the daemon stop (finding 7).
2. **`delivery_planning`**
   - Declare the three count-bearing pages in the phase that moves their numbers (phase 2 preferred; phase 6 acceptable only with a declared falsehood window), and name their rows in the plan's documentation map (finding 1).
   - Note TC-INST-042 arms (d), (e) and the new (f) in phase 3's ordered set (finding 2); add the daemon-log assertion to the phase-3 case note (finding 7); name the omitted assertion moves and correct the baseline description (finding 6); add the branding page's KPI/NFR wording to phase 6 (finding 8).
3. **`test_planning`**
   - Add TC-INST-042 arm (f) — `record-stale` + valid slot → refusal with zero writes (finding 2).
   - Add TC-INST-061's unmet-precondition dry-run step (finding 5).
   - Extend §7.2 with the omitted moves and the corrected 146-row baseline (finding 6); add the three pages to TC-INST-111/112's page set and phrase table, and extend the error-table leftover scan with 149/65 (finding 1); add the branding KPI/NFR phrases (finding 8).

## Iteration note

This is iteration 3 of a cap of ~3. The two iteration-1 blockers and seven of ten iteration-2 findings are fully closed; findings 1 and 2 are closed in substance with residual precision gaps, and finding 4 is **persistent but narrowed** (spec half done, TDR half not). Findings 1, 2, 5, 6, 7 and 8 are new consequences of the same remediation (the error-table count surface, the rollback arm set, the branding sentence set). None is a refusal-to-fix stalemate, and none requires an override — the override route is unavailable for a behavioural change of this kind in any case.

Recommended path: one short authoring pass (a spec paragraph set, three page declarations with their counts, two test-plan arms, one phrase-table extension), then re-run this gate. If the owner prefers to accept documentation-count drift and the stale refusal arm as declared debt, that is an explicit owner decision that must be recorded in `chg-GH-346-pm-notes.yaml` with a rationale and a date; the gate itself cannot silently pass them.

No `delivery` finding exists. Hard gate: **closed**.
