# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-346
Date: 2026-11-18
Pause Required: no

Reopen: **`delivery_planning`** (findings 1, 2, 7, 8, 9), **`specification`** (findings 2, 3, 4, 5, 6), **`test_planning`** (findings 1, 2, 3, 5).
Both iteration-1 blockers are genuinely closed. No `delivery` finding exists; the hard gate stays closed until the minimum-change set lands and this gate re-runs.

## Iteration-1 close-out

| # | Iter-1 finding | Status | Where it is closed |
|---|---|---|---|
| 1 | BLOCKER `ac_quality` — identical re-install destroyed the slot on a stale record | **CLOSED** | Spec v1.1 F-5 (line 179), F-9 (187), Appendix B step 4 and the step-5 skip (757–764), C.2 rows (786–787), C.4 (812), AC-F5-3 (613), AC-F9-1 (620), AC-F9-2 (621), NFR-3/NFR-4 (435–436); TDR-0040 §2 step 4 + new §2.1 (333–352); TC-INST-022/033/036/037 (test plan 450, 463, 466, 467); plan phase-3 contract (977–993). State matrix re-derived below. |
| 2 | BLOCKER `cross_artifact_consistency` — D6's owning-name mechanism was impossible | **CLOSED** | Plan D6 (485–519) and phase 2 (751–760, 885–891) now declare a boolean `ownsInstallation`; TDR-0036 §3 (311) and its amendment (344–372). Verified implementable against `bin-launcher.ts`, `production.ts`, the literal scan, `validateSeam`, and the executable-allowance rules — see the adversarial check below. |
| 3 | MAJOR `plan_code_area_coverage` — `content-inventory.test.ts` undeclared | **CLOSED** | Declared in phases 1–4 (plan 710, 939, 1110, 1207) with the file-set / executable-allowance split stated (D4, 466–479). The per-file allowance rule matches `executableViolations` exactly. |
| 4 | MAJOR `entrypoint-bin.test.ts` only in phase 1 | **CLOSED** | Declared in phase 1 (703) *and* phase 2 (946), with the two halves named at both ends (697–702, 940–945). All 12 `PINNING_FILES` members are declared by phase 2; every `twenty-five` / `toHaveLength(25)` / `at(-1) === "supervise"` site lives in one of them (checked file by file). |
| 5 | MAJOR `TC-BIN-061` drove a phase-2 command in phase 1 | **CLOSED** | Test plan 411 now drives `phase list <ref> --json`; plan phase 1 (667–670) names it. Verified composed (`phase` is in `PROMPT_REQUIRED_COMMANDS`), read-only (`listTarget` → `store.read` only), and payload-true (`delivery.registry.v1`, `verifiedEmpty`, `phases`; empty store returns `verifiedEmpty: true`). |
| 6 | MAJOR `AC-F14-1`/`TC-INST-091` record-keyed guard | **CLOSED** | F-14 (197), RSK-5 (467), AC-F14-1 (629), plan phase 5 (1225–1245), TC-INST-091 (531, three record conditions + a foreign-content arm). |
| 7 | MINOR DM-8 overstated an adapter move | **CLOSED** | DM-8 (410) and §16 (557) consume the delivered read; D2 (433–446) declines the contingency. `resolveCheckoutGitDirectories` / `readCheckoutIdentity` already answer `{ gitDir, commonDir }` or an absence. |
| 8 | MINOR RSK-15 claimed a gate that does not exist | **CLOSED** | RSK-15 (476) now states the measured cost; §6.1 (573) and §6.3 gate 0 (599–606) agree the tier self-builds and the pre-warm is optional. |
| 9 | MINOR two "one build-side literal site" files | **CLOSED** | One site, `scripts/build-binary.ts` (D1, 421–429); `packages/cli/src/build-identity.ts` holds no name (415–420); TC-INST-107 scans both roots. |
| 10 | MINOR phase 2 shipped step 1 without the daemon guard | **CLOSED** | D3 (447–465) and phase 2 (777–788) say step 1 runs **in full**, daemon guard included. The missing phase-2-owned case is accepted as declared debt (see item (a) below). |
| 11 | NIT phase 5 ran no `pnpm check` | **CLOSED** | Phase 5 runs G1 (1270); the header records that G1 is RUN, not waived (541–550). |

### Blocker 1, re-derived adversarially

Every reachable cell of (destination content, slot, record), read across Appendix B, C.2, TDR-0040 §2/§2.1 and the phase-3 contract:

| Destination | Record | Disposition (all four artifacts agree) | Slot survives? |
|---|---|---|---|
| equals running | `current` | stop; write nothing | yes, untouched |
| equals running | `record-stale` naming P | stop; reconcile in place, `previous` = P | yes, untouched |
| equals running | `unreadable` / `absent` | stop; reconcile in place, `previous` absent/unknown | yes, untouched (identity unknown, declared) |
| absent (step-5 crash) | any | step 5 skipped; step 6 + 7; slot kept | yes — this was the second half of the blocker |
| differs (compiled artifact) | any | step 5 renames it into the slot; genuine upgrade | replaced by design |
| launcher / symlink / nothing | any | C.2 dispositions; no agreement | see finding 4 (step-5 wording) |

A no-op can no longer reach step 5, so no reachable no-op state destroys the slot. Finding 1 is closed on the merits, not on the claim.

### Blocker 2, checked against the delivered code

- `BinLauncherOptions` (bin-launcher.ts:26–45) is an open options object; an optional `ownsInstallation?: boolean` is additive and the launcher already forwards facts into `createProductionComposer` (80–89). `ProductionCompositionFacts` (production.ts:475) is likewise open; `tests/types/daemon-mount.type-test.ts:63` uses `Extract<…, "daemonEntry" | "supervisor">`, so a new optional key does not fail it.
- `bin/jaiship.ts` can pass the literal `true` inside the existing call object. It is not a string literal, so `literalSites`/`inventoryViolations` (entrypoint-bin.test.ts:163–182) never sees it; it is not a module-level export, so `validateSeam` and the `completion` allowance (`content-inventory.test.ts:2219–2223`) are untouched; `bin/delivery-os.ts` needs no edit and phase 2 does not declare it.
- The launcher's `expect(launcher).not.toContain("process.")` (entrypoint-bin.test.ts:466) still holds: the fact is a parameter, not a read.
- The invoked identity is `brand.binaryName` in the refusing process, which is exactly the alias's resolved name; no owner name is derivable (`branding/index.ts` has no primary-name value). The mechanism is implementable as written.

## Facet Summary
- spec_completeness: FAIL — finding 3 (rollback with an absent record is unadjudicated and, on the "proceed" reading, cannot produce a conformant record).
- ac_quality: FAIL — finding 3 (F-8 vs AC-F8-2), finding 5 (`record-stale` defined two ways).
- plan_coverage: PASS — all 34 ACs and all 84 cases are owned exactly once; findings 7 and 8 are MINOR cleanliness gaps in the plan's stated posture, not uncovered requirements or ACs.
- test_traceability: PASS — 84/84 in §3, §5.1, §5.2 and §7.3; AC↔TC bidirectional in both directions (verified programmatically); no orphan.
- cross_artifact_consistency: FAIL — findings 1, 2, 4, 5, 6, 7.
- decision_capture: PASS — TDR-0036/0038/0040 amendments are in the right place; all five remain `Proposed` for PR acceptance.
- system_spec_consistency: FAIL — finding 2 (`feature-branding-seam.md` becomes false; no phase owns it).
- plan_doc_update_coverage: FAIL — finding 2 (a `doc/spec/**` page that must change is in no phase).
- plan_code_area_coverage: FAIL — finding 1 (seven delivered suites), finding 9 (uninstaller detection).
- dod_defined: PASS — AC-F16-1 plus §16's obligations are testable and traceable.

## Verified, not findings

- **Ticket fidelity holds.** The twelve tasks and six acceptance clauses still trace (spec §17, 636–647); `install status` is delivered by TDR-0036 §1; the M4-S1 backlog line still carries the compatibility task. No requirement dropped in remediation.
- **Artifact/phase arithmetic.** 34 ACs owned 8+7+10+6+2+1; 84 cases owned 13+16+24+20+4+7; every id in the phase map exists in the test plan and vice versa. Phase 1's 13 cases all have gate lines; phase 3's 24 all map to the five declared suites; `TC-INST-037` is phase 3, `install-crash-matrix`, and carries AC-F9-1/-F9-2/-F8-2.
- **`AC-F1-1` does not name the command** (line 601 says "one composed command"); the naming lives in TC-BIN-061 and the plan. That is legitimate: the AC is satisfiable by any composed command and the case picks one that exists in phase 1.
- **The phase-2 intermediate posture is honest where it is declared.** `pnpm check` at the phase-2 boundary runs with the family at 26, the page present, the error kind present, and the install record writer absent; no case claims a record or a slot before phase 3, and `rollback` answers the true `install.slot.absent`.
- **The `install` alias refusal still cannot create a namespace.** The refusal is handler-level, before any write; `--print-install-path` on the alias is unchanged and read-only (NG-15); help is static, so the primary's own help also carries the alias-restriction sentence, which is accurate.
- **Staging authority for the five TDRs still holds.** The five files are untracked; `doc/decisions/00-index.md` already carries their rows and `Proposed` status (committed); phase 1 declares the five paths, the index and the folder; `LIFECYCLE_PLAN_KINDS.delivery_planning` matches no plan phase, so the delivery commit is the correct boundary.
- **Repo-gate surface counts re-verified.** `PROMPT_REQUIRED_COMMANDS` 25 with `supervise` last; `RESERVED_TWO_SEGMENT_CODES` exactly 65 with no `install.*`; `DOMAIN_KINDS` has no `install`; `coverage.json` 25 commands / 31 pages; `EXECUTABLE_ALLOWANCES` is per-file and rejects undeclared exports; `PINNING_FILES` is the 12 declared files.
- **The plan validates.** `plan validate` = `verdict: valid`, `readyForDevelopment: true`.
- **Plan-author flag (a), phase-2 daemon guard with no phase-2-owned case: acceptable.** The guard is structural and ships before the first rename; its evidence lands at phase 3 (TC-INST-030) and phase 4 (TC-INST-080) before any release. It is declared debt, not silent scope.
- **Plan-author flag (b), phase-2 step 4 with no reconciliation writer: acceptable.** No record writer exists before phase 3, so the reconciliation is vacuous and the posture is TRUE; the residual gap is the differing-artifact arm (finding 8), not the reconciliation.
- **Plan-author flag (c), `plan diff` advisory noise: acceptable.** `plan diff` is in no gate. In this workspace it exits 1 for *any* ref (`repository diff … could not be read`, also for GH-338), so the advisory claim could not be observed; that is environmental and harmless.
- **Observation, not a finding.** `chg-GH-346-pm-notes.yaml:7` records `clarify_scope.started: 2026-11-18T16:53:00Z`, while the authoritative registry (`phase list GH-346`) says `16:09:23.758Z`. The registry is the source of truth and all four artifact phases are complete, so the gate's precondition holds; the mirror should not be hand-edited (`AGENTS.md` phase-state rule).

## Findings

1. **[MAJOR] `plan_code_area_coverage` / `cross_artifact_consistency` — seven delivered suites pin the error-table *total*, and no phase declares them.**
   Gap: adding eleven `install` rows moves the table from 149 to 160. Seven delivered suites (all run by `pnpm check` at the phase-2 boundary) assert the old total or the old membership/kinds, and none is declared by any phase:
   - `tests/structure/cross-repository-contract.test.ts:486–516` — `delivered` (all rows minus the three retro additive rows) must equal the 149-row events baseline, and `:517–526` requires `DOMAIN_KINDS` to be exactly the baseline kinds plus `events`.
   - `tests/structure/supervision-error-family.test.ts:46–47` (`DOMAIN_KINDS.at(-2/-1)` = `supervise`/`metrics`), `:78–87` (`live` = all rows except supervise/metrics must be 146, and `entries.slice(0,146)` must equal the baseline).
   - `tests/checks/supervision-error-socialization.test.ts:60–62` (`sourceEntries` 149, `documentedRows` 149, `corpusRows` 70).
   - `tests/structure/ceremony-contract.test.ts:113,119` (the page must contain `149 machine identities`).
   - `tests/structure/dispatch-attempts-taxonomy.test.ts:2,50,52` (149).
   - `tests/structure/verify-gates-suite-map-contract.test.ts:147–150` (149/149).
   - `tests/behaviour/ceremony-nonregression.test.ts:54–56` (`ERROR_TABLE` length 149).
   The plan's header claims "§7.2 (27 delivered suites) is exhausted" (111–123) and test plan §7.2 (675–706) does not list any of them, so the exhaustion claim is false again. The result-contract page also carries three further prose facts that move and are not named: the `DOMAIN_KINDS` enumeration (`:61`), the exact-code classification chain (`:63`) and the `149 machine identities` total (`:297`), alongside the allowlist `65 → 66` sentence (`:118`).
   Evidence: plan phase-2 scope (55 files, none of the seven); plan 111–123; test plan 675–706; page lines above.
   Suggested remediation target phase: `delivery_planning` (declare the seven suites in phase 2 and name each assertion that moves; test_planning must add them to §7.2 and the 149→160 / `corpusRows` 70→81 delta).
   Suggested fix: add the seven files to phase 2's scope and to §7.2 with their named moves (`additive` set gains the eleven `install` codes; `DOMAIN_KINDS` gains `install` and the tail re-expressed; 149→160; `corpusRows` 70→81; the doc phrase moves with `error-table.test.ts` and `ceremony-contract.test.ts` together), and name the four result-contract prose edits.

2. **[MAJOR] `system_spec_consistency` / `plan_doc_update_coverage` — the declared build-side identity literal falsifies `feature-branding-seam.md`, and the plan forbids fixing it.**
   Gap: F-2 (173), DM-7 (410), AC-F15-3 (633) and plan D1 (421–429) declare exactly one new build-side identity-literal site, `scripts/build-binary.ts`, which "declares the primary working name once" and is "registered in the identity-literal inventory". That page currently states the committed working-name literals are "**exactly five sites**", that "**No identity literal lives anywhere else**", that "**no other site names a working name**", and that the guard is a `packages/**` scan (`doc/spec/features/feature-branding-seam.md:23`). After delivery there are six committed TypeScript working-name literals and a second scan root. `tests/checks/doc-conformance.test.ts:437–452` pins "exactly five sites" on that page, and AC-F16-1's page set (§16, 570–579; AC 634) does not include it. Plan D6's TRIPWIRE (505–519) tells the coder that editing this page means it "has taken the rejected route" — but that prohibition was aimed at the *owner-name* mechanism (iteration-1 finding 2), not at the build-side literal this change independently declares.
   Evidence: `feature-branding-seam.md:23`; `doc-conformance.test.ts:437–452,497`; plan 421–429, 510–516; phase 6 scope (9 files, page absent); spec 173, 410, 633, 570–579.
   Suggested remediation target phase: `specification` (add the page to the doc obligations and scope AC-F16-1's page set) + `delivery_planning` (declare the page in phase 6 and qualify the TRIPWIRE to the owner-name route only) + `test_planning` (move the `doc-conformance` required phrase to a scoped wording that keeps the test non-vacuous).
   Suggested fix: restate the page as "exactly five sites **in the product-surface inventory**, plus one declared build-side site under `scripts/` registered with its own scan root"; keep a required phrase the test can still assert; add the page to phase 6 and to AC-F16-1's list.

3. **[MAJOR] `spec_completeness` / `ac_quality` — `install rollback` with an **absent** record is unadjudicated, and the "proceed" reading cannot write a conformant record.**
   Gap: F-8 (185) says rollback refuses "when the record is present but unreadable"; AC-F8-2 (619) takes "an absent record, a damaged record, and a record that no longer matches the destination" as its given and then says rollback refuses with `install.record.unreadable` — a single sentence that can be read as covering all three. DEC-13 (544) and Appendix E (844) repeat the "present but unreadable" trigger. The state is reachable and legitimate (the record can be manually deleted; F-8/F-14 call the record-free state legitimate). On the F-8 reading the run proceeds: rollback swaps slot and destination, but the new destination is the *old slot* artifact, whose injected identity no process can read from a file; DM-2 (404) requires `current` (only four fields have an unknown allowance, none of them identity fields), and F-9 (187) requires rollback to "report both identities" and update the record. The behaviour is therefore either a refusal with an identity whose trigger wording does not cover it, or an unrepresentable record. No case covers it (TC-INST-042 at 475 tests only present-but-unreadable; TC-INST-026 at 454 states no record condition).
   Evidence: spec 185, 187, 404, 544, 619, 844; test plan 454, 475.
   Suggested remediation target phase: `specification` (adjudicate; `test_planning` adds one arm).
   Suggested fix: widen F-8/DEC-13/Appendix E to "rollback refuses when the record is absent, unreadable, or unable to name the slot's occupant", keep `install.record.unreadable` (no twelfth row, no count move), align AC-F8-2's wording, and add one TC-INST-042 arm (record absent + slot present → refusal, zero writes). If instead "proceed" is intended, DM-2 must gain an explicit unknown allowance for `current` and F-9's "both identities" must become "both, or unknown".

4. **[MINOR] `cross_artifact_consistency` — Appendix B step 5 renames *any* destination into the slot, while C.2/F-5/TDR-0038 forbid promoting a launcher or a symlink.**
   Gap: step 5 reads "Rename the destination to the slot (replacing any existing slot); skipped when the destination is absent" (758) with no disposition conditional, and TDR-0040 §2 step 5 says the same. But C.2 (789–790) says the launcher is "Discarded … never promoted" and the symlink is "Replaced", F-5 (179) says "The slot may only ever hold a compiled artifact carrying an injected identity", AC-F5-3 (613) asserts "the slot … holds only a compiled artifact", and TC-INST-020 (448) asserts the launcher is "**not** in the slot". The symlink's slot fate is stated nowhere at all (a symlink renamed into the slot is not a compiled artifact and would make rollback refuse). An implementer following the normative table literally gets the wrong slot.
   Evidence: spec 758, 789–790, 179, 613; TDR-0040 §2 step 5; TDR-0038 §5; test plan 448–449.
   Suggested remediation target phase: `specification` (with the TDR-0040 wording; `test_planning` already asserts the outcome).
   Suggested fix: qualify step 5 — "rename the destination to the slot only when it is a regular compiled artifact whose content differs; a launcher or symlink is discarded (reported) and the existing slot is left unchanged" — and state the symlink's slot disposition explicitly in C.2.

5. **[MINOR] `cross_artifact_consistency` — `recordState`'s predicate is defined only in TDR-0040, and it is not the predicate DM-4/AC-F8-2 state.**
   Gap: TDR-0040 §2.1 (348) defines `recordState` as "comparing the record's identity with the **running** identity — a comparison of two records, never a content read". DM-4 (406) and AC-F8-2 (619) define `record-stale` as "a record that no longer **matches the destination**". The two coincide when status is invoked through the installed artifact and diverge when it is invoked through a candidate artifact before installing it (a legitimate pre-upgrade question): the record still matches the destination but is reported `record-stale`. TC-INST-036/037/041 pass either way, so nothing forces the spec to pick.
   Evidence: TDR-0040 §2.1 line 348; spec 406, 619; test plan 466–467, 474.
   Suggested remediation target phase: `specification` (one sentence; optionally one case arm in `test_planning`).
   Suggested fix: state the predicate in F-8/DM-4 ("the record's identity compared with the running identity; `record-stale` means the record and the running artifact disagree") and re-word AC-F8-2's parenthesis accordingly; alternatively persist a destination digest (a DM-2 change and a status read cost).

6. **[MINOR] `cross_artifact_consistency` — "evaluating the agreement read before staging is permitted", while the case requires that it *is* done.**
   Gap: Appendix B numbers stage (2) and verify (3) before the agreement read (4), then says an agreement run "evaluates steps 1 and 4 only" and that "Evaluating that read before staging is **permitted**" (762). TC-INST-033 step 2 asserts the run "created no staging file" (463), and NFR-4's zero-byte claim is stated as 0 artifact bytes. If pre-stage evaluation is merely permitted, a conforming implementation may stage a ~107 MB temp copy and stop, which the case then fails. TDR-0040 §2 states the stronger form ("it creates no staging file"), so the spec is the weaker outlier.
   Evidence: spec 755–757, 762; TDR-0040 §2; test plan 463; NFR-4 436.
   Suggested remediation target phase: `specification`.
   Suggested fix: replace "is permitted" with "the gate is evaluated before staging, so an agreement run creates no staging file".

7. **[MINOR] `cross_artifact_consistency` — the source of "the running artifact's bytes" is undeclared for the in-process seam.**
   Gap: step 2 stages "the running artifact's bytes" and step 3 compares content (755–756); in production that path is `process.execPath`, but the declared install runtime (F-4, 177) lists only "process facts" and the plan's D1 module homes name no artifact-path fact. The primary in-process mechanism (SEAM-TP-1, test plan 241) supplies an injected *identity* only; `tests/fixtures/install/artifact.ts` is "an executable file plus the identity facts it carries" (585) with no stated route into the composer. A coder wiring the in-process arm to the real `process.execPath` would stage the Bun binary. The failure is loud (TC-INST-011 asserts the artifact's bytes), and the artifact-tier fallback exists, but the seam must be named rather than discovered.
   Evidence: spec 177, 755–756; plan D1 (400–414); test plan 241, 585.
   Suggested remediation target phase: `delivery_planning` (name the fact and the fixture route; `test_planning` records it under SEAM-TP-1).
   Suggested fix: declare a `runningArtifactPath` composition fact (`process.execPath` in production, the fixture path in tests) and state that step 2/3 read it.

8. **[MINOR] `plan_coverage` — phase 2's write posture does not say what happens when a *differing compiled artifact* is at the destination.**
   Gap: D3 (447–465) states step 1 in full, steps 2/3/6, the agreement stop, and "the slot-free dispositions"; C.2's fourth row ("content differs → becomes the slot", 788) is not slot-free and step 5 is phase 3. A phase-2 `install` over an existing compiled artifact is therefore an undeclared behaviour (replace and lose the old artifact? refuse? discard-with-report?) that no phase-2 case exercises.
   Evidence: plan 447–465, 777–788; spec 788.
   Suggested remediation target phase: `delivery_planning`.
   Suggested fix: add one sentence to D3 — e.g. "phase 2 replaces a differing compiled artifact without a slot and reports it; the slot arrives in phase 3" — so the intermediate commit has no invented policy.

9. **[MINOR] `plan_code_area_coverage` — the shell uninstaller's managed-install detection source is undeclared.**
   Gap: F-14 (197), AC-F14-2 (630) and TC-INST-092 (532) require the uninstaller to report a managed install at "the brand install path" and name the record, but `scripts/uninstall.sh` knows only `ADOS_HOME`/`~/.ados` (line 57) and contains no `jaiship` reference, while `scripts/install.sh` deliberately derives the path by asking the binary (`resolve_launcher_path`, 971–987). Phase 5's "Decision to close" (1250–1257) covers only the installer's exit choice and content probe; the uninstaller's source of the install path and record path (hardcoded declared brand paths, or a binary probe, and what happens when no binary is reachable) is left to the coder — and a new hardcoded path is exactly the kind of choice the ownership split should state.
   Evidence: spec 197, 630; plan 1225–1257; test plan 532; `scripts/uninstall.sh:57`; `scripts/install.sh:966,975`.
   Suggested remediation target phase: `delivery_planning` (declare the detection source; `test_planning` fixes TC-INST-092's fixture to it).
   Suggested fix: state that the uninstaller resolves the declared brand install path and record path by asking a reachable primary-identity binary's read-free `--print-install-path` (override scrubbed, as `install.sh` does) and, absent that, reports no managed install without an error; add it to phase 5's "Decision to close".

10. **[NIT] `cross_artifact_consistency` — the primary name is declared twice with no agreement assertion.**
    Gap: `packages/cli/bin/jaiship.ts:14` and `scripts/build-binary.ts` each declare the primary working name; DM-7/AC-F15-3 pin the *set* of literal sites, not their equality. A drift would put the artifact at `dist/<one-name>` while `--version` prints `<other-name>`; TC-BIN-060 step 4 says "from the declared primary identity" without naming which source it reads.
    Evidence: spec 410, 633; plan 421–429; test plan 410.
    Suggested remediation target phase: `test_planning`.
    Suggested fix: have TC-BIN-060 assert the artifact's file name equals the name its own `--version` prints (one extra assertion, no new file).

## Minimum change set for READY

1. `delivery_planning`: declare the seven error-table-count suites in phase 2 with each named move (finding 1); add `doc/spec/features/feature-branding-seam.md` to phase 6 and narrow D6's TRIPWIRE to the owner-name route (2); name the running-artifact path fact (7); declare the phase-2 differing-artifact posture (8); declare the uninstaller's detection source (9).
2. `specification`: adjudicate rollback with an absent record (3); qualify Appendix B step 5 for launcher/symlink (4); state the `recordState` predicate in DM-4/F-8 (5); make the pre-staging agreement read required (6); widen the branding page's obligation and AC-F16-1's page set (2).
3. `test_planning`: add the seven suites and the 149→160 / `corpusRows` delta to §7.2 (1); move the `doc-conformance` branding phrase with the page (2); add one rollback-absent-record arm to TC-INST-042 (3); record the artifact-path seam under SEAM-TP-1 and fix TC-INST-092's fixture source (7, 9); add the name-agreement assertion to TC-BIN-060 (10).

Not blocking: finding 5's optional case arm, finding 6's TDR wording (the TDR already says the stronger form), and the NIT.

No `delivery` finding exists. Hard gate: closed.
