# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-174
Date: 2026-10-30
Reviewed At UTC: 2026-10-30 (iteration 1; first persisted review)
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [major] cross_artifact_consistency — `chg-GH-174-test-plan.md`#TC-STATE-007 step 2 (and §3.1 row AC-F3-1, §8.3 OQ-T6) vs `chg-GH-174-spec.md`#17 AC-F3-1 (v1.1) and `chg-GH-174-plan.md` task 3.2
   Gap: Spec v1.1 pins the failed-rebuild code — "a storage I/O failure during rebuild … fails classified as `state.write.failed`" — and plan task 3.2 restates the pin. TC-STATE-007 step 2 still reads "expected `state.write.failed` for storage I/O; **the TDR may bind another documented state code**", and the §3.1 abbreviated criterion omits the pin. A @coder satisfying the TC oracle as written could bind a different documented code and produce AC-F3-1 evidence that fails at DoD; the TC's residual latitude contradicts the amended AC and invites a rework loop. (The TDR conflict path already exists and is correct: plan OQ-1 routes a conflicting constraint through PM/`@decision-advisor` — it must not be able to silently rebind a pinned code via a test oracle.)
   Suggested remediation target phase: test_planning
   Suggested fix: Update TC-STATE-007 step 2 to assert `state.write.failed` (transient, retryable, `not_landed`) for the injected rebuild I/O failure; delete the "TDR may bind another documented state code" clause; mirror the pinned code in the §3.1 AC-F3-1 abbreviated row and close OQ-T6 as resolved-by-spec-v1.1.

2. [minor] cross_artifact_consistency — `chg-GH-174-test-plan.md`#frontmatter, §1.2 GAP-5, §8.3 OQ table vs `chg-GH-174-spec.md`#14 (v1.1) and `chg-GH-174-pm-notes.yaml` (reopen-resolution record)
   Gap: The test plan (v1.0, authored before the spec amendment) still marks OQ-T1/OQ-T2/OQ-T6 as "Open — needs DoR/spec clarification", still declares `implementation_plan: null` and GAP-5 "plan absent", and has no post-amendment revision-log entry — while spec v1.1 §14 declares the three findings resolved canonically and the implementation plan now exists (v1.0, 2026-10-30T18:12:08Z). Substance agrees on every point (NFR-9 single packed-probe exception, driver-neutral parity scope, pinned rebuild code); the stale status labels could cause a later reader to re-litigate resolved questions.
   Suggested remediation target phase: test_planning
   Suggested fix: One refresh entry: mark OQ-T1/T6 resolved by spec v1.1 §14 and OQ-T2 resolved-and-DoR-confirmed (see Evidence below); set the `implementation_plan` link; annotate GAP-5 as resolved; add a revision-log row recording the refresh. No TC behaviour, assertion, or AC mapping may change (A-T1).

3. [minor] test_traceability — `chg-GH-174-test-plan.md`#3.3 NFR-2 row (and §5.2 TC-STATE-007 Related IDs)
   Gap: NFR-2 claims "5/5 classes" detected, but its TC list (TC-STATE-008/009/010/024) exercises only the four ledger classes; the fifth class (index/ledger divergence) is asserted by TC-STATE-007, which neither appears in the NFR-2 row nor lists NFR-2 in its Related IDs. Coverage exists; the 5/5 metric's evidence trail has a hole.
   Suggested remediation target phase: test_planning
   Suggested fix: Add TC-STATE-007 to the NFR-2 coverage row and add NFR-2 to TC-STATE-007's Related IDs (same direction as the existing F-4 → TC-STATE-007 capability link in §3.1).

4. [minor] plan_coverage — `chg-GH-174-plan.md`#task-2.7 and binding D7 vs `chg-GH-174-test-plan.md`#4.1 item 5
   Gap: Task 2.7 lands the conformance harness with "anti-vacuity guards (zero-case and single-kind collapse fail)" in Phase 2, while only the `jsonl` binding exists (sqlite activates in Phase 3, per task 2.7/D7). Test-plan §4.1 item 5 says a suite that "collapses to one kind must fail" — implemented literally in Phase 2, the guard makes the Phase 2 gate self-red. The map-relative reading (executed kinds must equal the driver map's contents) is the obvious implementation and D7's "2/2 asserted from Phase 3 onward" implies it, but the plan should say so.
   Suggested remediation target phase: delivery_planning
   Suggested fix: One clause in task 2.7 (or D7): the single-kind-collapse guard is relative to the active driver map (`{jsonl}` in Phase 2, `{jsonl, sqlite}` from Phase 3); the zero-case guard is active from Phase 2.

5. [nit] plan_doc_update_coverage — `chg-GH-174-plan.md`#Phase-7 "System docs to update"
   Gap: D8 tightens the `runtime-apis-confinement` allowance from the whole `core/src/state/` tree to the driver edge, but `.ai/rules/typescript.md` (line 73: "Runtime and I/O access only in: `core/src/state`, …") is not listed among the phase-7/@doc-syncer reconciliation inputs. The rule doc remains true-but-coarser after the tightening; registering it prevents silent precision drift.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `.ai/rules/typescript.md` (runtime-API allowlist line) to the Phase 7 / lifecycle-phase-7 reconciliation inputs alongside the scaffold/branding/result-contract/glossary entries.

## Evidence and Passing Coverage

- First persisted review: the change folder contained only the four change artifacts; no prior readiness record exists. Findings: **1 major, 3 minor, 1 nit; none persistent**. No pause flag: all findings are artifact-phase clarifications; no human-only decision and no new system decision is required by them.
- Ticket fidelity: read issue #174 via `gh` (OPEN, owner-authored, no comments/labels). Every ticket task is covered — local-first behind an implementation-neutral port (F-1, AC-F1-1..4); append-only JSONL plus SQLite indexes (F-2/F-3, DEC-2); schema-versioned (DM-4, AC-F2-2); atomic replace (AC-F6-1); single-writer (AC-F7-1..3); key-set assertions (AC-F5-1, Appendix B); POSIX 0700/0600 + Windows ACL equivalent (AC-F8-1/2); retention forever as a tested prohibition — no prune/delete/expiry surface, asserted by TC-STATE-005 step 4 and plan task 2.4 (DEC-5/NG-3); planned levels local/project/global abstraction-only with classified rejection (AC-F1-3, DEC-4, Appendix C); workspace and fence identifiers as local fields (DM-1, Appendix C, AC-F1-4). Both ticket ACs map to spec ACs (§17), test-plan TCs (§3.1 ticket table), and plan phases (Test Scenarios rollup) — all three mappings agree. No silently dropped scope.
- **DEC-2 confirmed** (PM flagged it for DoR scrutiny): the ledger-truth/index-derived interpretation faithfully delivers "append-only JSONL plus SQLite indexes" — the JSONL ledger is durable truth for both kinds; the SQLite index is a disposable derived projection of the indexed kind; engine swappability is exactly the `StateDriverKind` selection at the single public edge factory, reconciling the ticket with the scaffold's pre-declared union type (`packages/core/src/state/index.ts` verified). Not a scope drop.
- **OQ-T2 parity reading confirmed** (the plan defers this confirmation to this gate): parity over driver-neutral observable fields with the sqlite-only index-rebuild report excluded from parity and asserted separately (AC-F3-1/TC-STATE-007) is the only coherent reading of AC-F1-2 together with DM-5 — the jsonl kind cannot fabricate rebuild evidence. Spec v1.1 AC-F1-2, test-plan §4.1/GAP-3/A-T2, and plan D7 now state the same rule. Confirmed canonical.
- Current-truth conformance verified against source: `DOMAIN_KINDS = ["provider","input","config"]` and the two fallback rows (error-table.ts) — adding `state` is additive and the kind-only multi-row ambiguity claim matches the classification chain (feature-result-contract.md); the seven rows' categories (`user`/`platform`/`transient`) are within the declared enum (`transient` precedent: `provider.quota.exceeded`), projections map to the existing `{0,1,2}` classes (user rows → 1, platform/transient → 2), and plan task 1.4's machine-row field list exactly matches `ErrorTableEntry` (the spec §8.3 "Trigger" column is doc prose, correctly not a machine field). Branding seam: `stateDirectoryName` = config dir + `-state`, consumed not imported (feature-branding-seam.md lines 59/70/187) — DEC-3 conforms. Scaffold: state tier imports `./contracts` only, adapters barred from `core ./state`, surfaces may (depcruiser `tier-state-allowed-set`, `subpath-adapters-core-state` verified present); D8's tightening of `runtime-apis-confinement` from the whole state tree to the driver edge matches the scaffold spec's own "driver code" wording and ships with a fixture — a tightening, not a weakening. Command registry: `ados state` is M1-S2 and M0-S5 is a foundation story — the no-CLI claim conforms. Changeset fixed group verified as exactly five publishable packages (`.changeset/config.json`); `forbidden-literals.registry.json` path and `userFacingDocs` scope verified; `tests/structure/inventory.json`, `tests/structure/config-imports.test.ts`, `tests/checks/packed-config.test.ts`, and `tests/boundaries/fixture-registry.json` all exist as cited patterns; TDR-0004 correctly does not exist yet (authored Phase 1).
- Plan executability: TDR-0004 ordering precedes all driver tasks (Phase 1 → dependency order stated); crash injection is deterministic via the test-only fault seam with named injection points and partiality self-test (§4.3, plan 2.2/5.4); permission tests set umask in-test with exact-bit assertions and an escalation path for incapable filesystems (RSK-7, task 6.4); the SQLite runtime matrix is asserted-not-assumed with undeclared-skip failure (D2, tasks 3.5/7.3, TC-STATE-021); protected-path invariants are checked twice (tasks 7.6 and Phase 10 Must); every phase's gate ends at green `pnpm check`; all 22 ACs appear in phase "Must" lines and all 25 TCs map to phases. The single executability ambiguity found is Finding 4.
- DoD: spec §18 declares an explicit, testable open-PR Definition of Done (all 22 ACs with traceable evidence, nine NFR thresholds, non-vacuous negative controls enumerated by class, 2/2 parity, gates green, docs synchronized, independent review, changeset, open unmerged PR targeting `main-tools`) and honestly separates open-PR handoff from owner acceptance — dod_defined passes (the GH-173 iteration-1 defect class is fixed here).
- NFR-9/AC-F9-3 agreement verified: spec v1.1, test-plan GAP-2/§8.3 OQ-T1 substance, and the plan's test-hygiene constraint all state the identical rule — behaviour suites in-process, exactly one documented spawn exception (the AC-F9-3 packed probe, a packaging assertion), grounded in the injected-dependencies/no-ambient discipline of `.ai/rules/typescript.md` and the `packed-config.test.ts` precedent.
- Read-only gate: no builds or tests were run by this reviewer; source was read only to verify code-area coverage and current-truth claims. No critiqued artifact, PM note, or source file was modified; no git operations were performed. Only this readiness record was written.

## Decision Routing and Next Steps

- All findings are **change**-scoped artifact corrections; no `system`/precedent-setting decision and no `needs_human_input` pause is required. The TDR-0004 routing (Proposed during delivery, `@decision-advisor` on contract conflict, owner acceptance at PR) is correctly captured in spec OQ-1 and plan OQ-1.
- Reopen **test_planning** for Findings 1–3 (the sole blocking artifact). Findings 4–5 are non-blocking delivery_planning refinements that may ride the same reopen cycle; neither blocks re-running the gate.
- Re-run DoR after the test-plan refresh; expected iteration 2 verdict is READY if Findings 1–3 are closed as suggested. Delivery remains blocked until then; no override applies (this change adds behavior and touches contracts — override is unavailable).
