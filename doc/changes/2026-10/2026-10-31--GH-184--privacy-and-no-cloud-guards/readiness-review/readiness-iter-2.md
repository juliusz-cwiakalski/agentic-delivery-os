# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-184
Date: 2026-10-31
Pause Required: no

Reviewer: @readiness-reviewer (local DoR mode). Inputs re-read in full: spec v1.1 (unchanged since iteration 1 — verified by git history), test plan v1.1 (unchanged), plan **v2.0** (commit f85f4c7), pm-notes (updated with the DoR record and advisory dispositions), ticket GH-184, TDR-0005, and the live repository. This record is written content-free: real owner paths verified below are described, not quoted, so this file adds no new baseline trip.

## Changes since iteration 1

- Plan revised v1.0 → v2.0 for the iteration-1 blocking finding (allowlist staging contradiction) and the major advisory (baseline load under-enumeration). Spec and test plan intentionally unchanged; pm-notes records the DoR outcome, the accepted-batch expectation, and a retro.
- Iteration-1 Finding 1 (blocking, plan_coverage + cross_artifact_consistency): **CLOSED — verified.** PD-2 now carries a binding staging rule ("each allowlist/exclusion entry lands in the same commit as the file it covers") with a per-phase staging table; tasks 1.2/2.1/2.4/4.1/4.4/4.7/5.2/6.5/7.2 rewritten to match; PD-3 step 8 validates the new per-entry `rules` scope (unknown rule id fails closed, named); task 4.4 adds the second-rule-still-fires regression (file-wide-suppression mutant caught) and the phase-tracked exact-set assertion, extended in 5.2/6.5/7.2 to the end-state enumeration; RSK-E10 and an execution-notes staging invariant added; the Phase-2 DoD row now requires every entry's file present in the commit.
- Iteration-1 Finding 2 (major advisory, plan_coverage): **CLOSED — verified.** PD-7 now enumerates the expected baseline batch file-by-file with a mechanism preference order (placeholder suppression for marker-carrying fabricated values; rule-scoped exact-path entries for archival true positives including the iteration-1 DoR artifact itself; remediate-not-suppress for files this change touches), as named task 2.4 with scan-authoritative verification, and owner visibility via the Phase-2 commit message, evidence artifact (7.3), PR description (11.4), and a PM-ledger note (present in pm-notes).
- Iteration-1 Findings 3–4 (minor advisories): remain advisory, no artifact change required; disposition unchanged.
- Plan finding dispositions: the TC-POLICY-005 import-wording pin is recorded as DoR-CONFIRMED and binding; the execution-order and allowlist-enumeration findings are reconciled with the staging rule. All three are now internally consistent.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking finding count: 0. One new minor finding (1), two persistent non-blocking advisories carried from iteration 1 (2, 3). No pause flag; no human-input decision surfaced.

## Findings

1. [minor] cross_artifact_consistency — chg-GH-184-plan.md#PD-7 baseline batch table (and its echo in the v2 revision log / execution log) — NON-BLOCKING
   Gap: Three table rows claim `private.absolute-user-path` trips that do not exist in the current tree. Verified by broad pattern search (absolute home/profile path shapes, `~` forms, owner names): `chg-GH-26-plan.md` and `chg-GH-26-pm-notes.yaml` contain no path-shaped content (only public URLs and project-name references), and `chg-GH-32-pm-notes.yaml` likewise references the historical path *removal* without quoting paths. The rows that do fire are real and correctly mechanized: the GH-26 **test-plan** credential sample, the GH-32 red-team reports v3/v4 and the GH-124 plan (real owner paths), the iteration-1 DoR artifact, the markerless provider-token sanitization fixture, and the marker-value files. The table over-attributes "DoR-verified" status to the phantom rows (iteration 1 verified the others). Execution is unaffected: the PD-2 staging rule lands an entry "only if its file exists **and** trips", task 2.4's scan is authoritative, and the commit-message inventory enumerates actual registry entries — so no red gate and no wrong suppression can result. Also noted, same table: the marker-username suppression class (mechanism for `config-sources.test.ts`) equally covers sibling files carrying the same marker segments (`config-cli.test.ts`, `config-cli-probe.ts`, `golden/config-output.test.ts`, `error-classification.test.ts`) which are not enumerated; class-level suppression plus the scan-authoritative rule covers them.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Optional accuracy edit while any plan revision is next open (not worth a reopen on its own): correct the table to the verified trip set — keep the GH-26 test-plan row (credential mechanism), drop or re-scope the GH-26 plan/pm-notes and GH-32 pm-notes entries, and note that the authoritative Phase-2 scan produces the definitive inventory.

2. [minor] system_spec_consistency — chg-GH-184-spec.md#§6 flow 6 vs PD-7 archival entries — PERSISTENT advisory (iteration-1 Finding 3), no artifact change required
   Gap: Spec flow 6 frames suppressions as responses to *false positives* ("if the pattern is genuinely safe"); the baseline batch also suppresses archival *true positives* (real historical owner paths) under the NG-3 no-remediation boundary plus the green-tree requirement. The plan (PD-7 mechanism 2, visibility paragraph) and pm-notes now own this explicitly; the spec's silence remains acceptable because the owner reviews every entry at PR with the full inventory.
   Suggested remediation target phase: specification (optional one-sentence note in flow 6; explicitly not required)
   Suggested fix: None required for delivery.

3. [minor] test_traceability — AC-F7-1 / NFR-5 pushed-HEAD evidence — PERSISTENT advisory (iteration-1 Finding 4), no artifact change required
   Gap: The evidence of record is the pushed-HEAD CI job; it must be recorded in test-plan §10 and the evidence artifact before PR creation. Already mandated by plan 11.2/11.4 and test-plan §6.4; execution discipline only.
   Suggested remediation target phase: test_planning (no reopen; execution-discipline note only)
   Suggested fix: None at authoring time.

## Closure verification for the blocking finding (repository-grounded)

- **Phase 1 registry vs Phase 1 file set**: task 1.2 commits only entries for the rule module (task 1.1), the registry itself, and `tests/structure/privacy-imports.test.ts` (created task 1.4, same commit), plus the `pnpm-lock.yaml` exclusion — every entry's target exists in that commit; RV-21/PD-3 step 8 stay green. Explicit negative list (no check/tests/fixture-root entries) removes the literal-reading hazard.
- **Phase 2 baseline batch vs rule-scope validity**: entries land only where a file exists and trips; scopes are committed rule ids (`private.absolute-user-path`, `secret.credential-assignment`, `secret.provider-token-prefix`); PD-3 step 8 rejects unknown ids, and task 4.4's regression proves a rule-scoped entry never silences a different rule in the same file.
- **Phase 7 end-state vs test-plan exact-set assertion**: TC-PRIVACY-012 step 2's wording ("guard test files … each with a reason and a class") is generic; the plan's `rules` field binds the "class" concept the test plan already requires, and the phase-tracked assertion (extend-only, per A-T7) reaches the full enumeration at Phase 7 — no phase asserts a file that does not yet exist, and nothing is relaxed. No test-plan reopen required.
- **No new contradiction from the fix**: staging table cross-checked against every phase's file-creation tasks; rollback section updated coherently (the batch reverts with the registry as one unit); DoD per-phase row 2 updated; execution-notes invariant added.

## Baseline batch mechanism re-verification (live tree)

- Marker-value rows credible: the hook-example fixture value carries a `fake-` fabrication marker and the tool-guide key samples carry `your-` markers — both fit PD-7 mechanism 1's committed marker classes; the config test's profile paths carry a synthetic marker user segment (same class as its unlisted siblings, covered class-wide).
- Archival rows credible where they exist: the GH-26 test-plan credential sample is markerless-realistic (exact-path entry correct); the red-team v3/v4 and GH-124 plan files carry real owner home-directory paths (exact-path entries scoped to `private.absolute-user-path` correct); the iteration-1 DoR artifact quotes those paths (self-referential entry correct). The GH-26 plan/pm-notes and GH-32 pm-notes rows are phantom — see Finding 1.
- No Phase-2 allowlist entry can match no scanned path: every candidate entry names an existing file, and the staging rule gates entry addition on an actual trip.
- Plan v2 and this record contain no raw owner paths (verified); the spec/test-plan were already clean at iteration 1.

## Confirmations carried from iteration 1 (unchanged repository state re-verified)

Ticket coverage, AC satisfiability (AC-F3-1 vacuity handling, AC-F7-1 CI-evidence boundary, AC-F8-1 corrected changeset semantics against the five verified pre-existing changesets), PD-1 feasibility (Bun `.js`→`.ts` resolution; `scripts/checks/**` outside tsc; depcruise `packages` scope; `runtime-apis-confinement` excluding `io/`; ambient/secret-read/exit-code-literal scopes; build-free `ts-invariants`), ci-topology wiring satisfied by the Phase-2 script placement, script-surface/ci-checks exact pins preserved (no new job, aggregate byte-unchanged), codec call-site completeness, inventory registration, and artifact literal hygiene — all re-confirmed; the repository has changed only by documentation commits since iteration 1. The 34-TC traceability table is intact (TC-PRIVACY-012 updated with the phase-tracking note and 5/6/7 set extensions), with no orphan TCs and every AC still covered.

## Gate result

READY. The iteration-1 blocking finding is genuinely closed and the fix introduced no new contradiction. Finding 1 is minor, non-blocking, and self-correcting at the authoritative Phase-2 scan; Findings 2–3 are persistent non-blocking advisories requiring no artifact change. Delivery (phase 6) may start under the hard gate; per policy the verdict file is committed by @pm for traceability.
