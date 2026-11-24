# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-406
Date: 2026-11-24
Pause Required: no

## Basis

- Authoritative source: ticket body + owner comment 7122871259 ("Delivery brief 2026-11-24"), which supersedes owner comment 7117829140 where they differ and replaces the body's AC list (spec §12/DEC-1, pm-notes note 2 — hierarchy applied correctly by all three artifacts; the superseded rename proposal is nowhere treated as live).
- Artifacts read: `chg-GH-406-spec.md`, `chg-GH-406-test-plan.md`, `chg-GH-406-plan.yaml`, `chg-GH-406-pm-notes.yaml`. No prior readiness records exist (first iteration).
- Base for all "at base" claims: `22b15d31` — verified: current branch HEAD `a4de57c2` is exactly four artifact commits (`76eb84dc`, `fe6cbe9a`, `ad75b079`, `a4de57c2`) on top of `22b15d31`.
- Code/tree claims spot-verified at base: `PROJECT_KEY_PATTERN` at `packages/core/src/contracts/projects.ts:52` with value `/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$/u` (plan's constant block is accurate); `GROUP_HEADER` at `projects-text.ts:19`, flat-alias `HEADER` at `:17`, `repos-text.ts` `HEADER` at `:16` (all as the plan states); the two reversed sentences at `doc/overview/ubiquitous-language.md` lines 62–68; feature-projects §"Checkout identity and the project key" at :89; feature-project-groups no-public-pattern at :108–109; "primary checkout" in `doc/guides/migrating-to-per-repository-state.md` and `local-install.md`; ODR-0001..0005 exist (0006 next free, reserved per brief §H); `00-index.md` carries `ados_distribution` and lists `Proposed` records (ODR-0004, ODR-0005 — precedent for the ODR-0006 row); ODR-0005 has no distribution marker (precedent for the plan's no-header call); `00-register.md` is a binding projection for decided topics — "not touched" is correct; chain pins `PINNED_CHECK` (`tests/checks/license-ci-binding.test.ts:21`) and `AGGREGATE` (`tests/checks/privacy-ci-wiring.test.ts:29`) exact-string pin `manifest.scripts.check`, so phase 1's chain-refresh declaration is real; committed flat-alias golden at `tests/golden/fixtures/projects-flat-alias.json`; content-inventory pins `core/src/contracts/projects.ts` (:3022) and `core/src/app/state-scope.ts` (:3110) exports; naming-boundary TC-GRPBOUND-001/002 + TC-GRPSREAD-003 present with the migration-guide pin; `tests/fixtures/projects/` helpers cover the G-1..G-3 fixture needs; `.changeset/config.json` fixed group is exactly the five packages the phase-8 changeset declares.
- AC decomposition checked against the brief's 7-item AC list: nothing dropped, weakened, or invented (brief AC 4 → AC-F2-1/F3-1/F4-1; brief AC 5 → AC-F8-1/2/3; brief §C.4 naming rule → AC-F7-1; 12 ACs total, all Given/When/Then, all traceable in test plan §3.1/§3.2/§3.3; every TC has a §5.2 detail and a §7/plan home; review-time items have declared fence homes).

## Facet Summary

- spec_completeness: FAIL
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

1. [major] cross_artifact_consistency (also charges spec_completeness) — spec Appendix B (§24) and §16; test plan §1.1, §2, TC-DPKCONF-001 precondition, TC-DPKUI-002 step 4; plan phase 3 scope and phase 6 summary/folders
   Gap: The brief's §E conformance scope is "the command reference pages under `doc/planning/oss-tooling/milestones/*/commands/**`" — verified at base to be 42 pages across m1 (28), m2 (12) and m4 (2). All three artifacts narrowed this to the three m2 pages (repos, projects, board), conflating the brief's §F pins list (which names exactly those three as known-broken pins) with the §E scope definition. The narrowing is silent: spec §14 claims no open questions and no deviation from the brief is recorded anywhere (spec §15, pm-notes). Materiality is concrete, not theoretical: `doc/planning/oss-tooling/milestones/m4/commands/install.md:84` reads "A primary checkout is recorded `verified`" — "primary checkout" wording is explicitly banned by brief §D — and that page is inside the brief's scope and outside every artifact's scope and sweep list. As planned, either the delivered tree leaves that violation standing against the owner's §D rule, or a scanner implemented to the brief's glob fails its clean-tree pass at the phase 6 boundary because phases 3/6 never sweep the m1/m4 command pages. (The "project key" prose at `m1/commands/commit.md:43` and `m1/commands/phase.md:33` is sense-dependent — it names a project *configuration* key, not the clone identity — and is additionally an argument for an explicit violation-rule definition, but the m4 page alone is certain.)
   Suggested remediation target phase: specification
   Suggested fix: Restore the brief's §E glob in spec Appendix B and §16 ("the command reference pages under `doc/planning/oss-tooling/milestones/*/commands/**`", 42 pages), then propagate the two dependent edits: test plan (TC-DPKCONF-001 scope precondition; TC-DPKUI-002 step 4 → the full commands tree; §1.1 scope bullet) and plan (phase 3's reference-page set or phase 6's `folders:` — add the milestones commands tree to the phase 6 sweep, whose fence already demands the scanner land "together with the sweep its clean pass demands"). No owner input needed: the brief already decided the scope; conformance to it is not a new decision.

2. [major] plan_code_area_coverage — plan phase 1 summary (escalation trigger 4 consistent); test plan TC-DPKNAM-001 steps 3–4 and precondition
   Gap: The naming check's governed surface is undeclared. The plan's phase 1 summary drops the brief §C.4 qualifier — it says "a file that did not exist at the committed base constant 22b15d31 may not contain the bare token `projectKey`", where the brief says "a **source file** that did not exist at this change's base". Two failure modes follow from the ambiguity, and neither the plan nor the test plan pins which is intended: (a) the closest precedent, `scripts/checks/forbidden-literals.ts`, scans "repository content" full-scope — under a repo-wide scan the check is red on day one, because the committed change artifacts themselves (spec authoring guidelines, test plan §8.2, plan header) are post-base files containing the literal token `projectKey`; (b) an arbitrarily narrow scan (e.g. `packages/core` only) passes TC-DPKNAM-002's mutation tests — they exercise the injected-input core, not the scan surface — and silently under-governs new code in `packages/cli`, `tests/**` and `scripts/**`, which is exactly the review-invisible weakening this gate exists to prevent. Baseline location/registration, base-constant mechanism, reason-bearing entries and mutation tests are otherwise unambiguous and implementable as specified.
   Suggested remediation target phase: delivery_planning
   Suggested fix: One sentence in phase 1 (and mirrored in TC-DPKNAM-001) declaring the check's scan surface explicitly: which roots and file extensions count as "source" (e.g. mirror the `forbidden-literals` check's declared scan set over `packages/**`, `adapters` subpaths, `tests/**`, `scripts/**` TypeScript sources), so committed prose documents and change artifacts are deterministically out of scope and no narrower-than-declared scan can go green silently.

3. [minor] test_traceability (hygiene) — test plan §2 "References", implementation plan row
   Gap: Stale self-reference: "Implementation plan: `./chg-GH-406-plan.yaml` — **pending** (phase 4 of the lifecycle). This plan constrains it: …". The plan now exists and is validated, and its header comment adopts all four constraints (a)–(d) with suite names pinned verbatim ("satisfied by adoption — no deviation, no reconciliation notes owed"). The pending framing misdescribes the delivered state a DoD-phase reader will check against.
   Suggested remediation target phase: test_planning
   Suggested fix: Replace the pending row with a reference to the delivered plan's constraint-adoption comment (plan header, suite-name pin block), keeping the four constraints as the traceability anchor.

4. [nit] plan_coverage — plan phase 2 summary
   Gap: "extend tests/structure/content-inventory.test.ts additively (new export entries for projects.ts and state-scope.ts …)" pre-declares an inventory addition for `state-scope.ts`, but the served `cloneKey` accessor is a property of the resolved scope object, not a module export — `state-scope.ts`'s export set need not change, and a pre-declared entry could contradict the inventory suite itself (which pins the actual export sets).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Reword to "additive inventory entries wherever an export set grows (expected: `projects.ts`; `state-scope.ts` only if its export set changes), verified by the suite".

## Facet notes (evidence for the PASS calls)

- ac_quality: 12 ACs, Given/When/Then, non-overlapping, each linked to F-/DM-/NFR-IDs; measurable thresholds carried in §4.1 KPIs and NFR-1..NFR-7.
- plan_coverage: all 12 ACs have phase homes (F1→p4, F5→p3, F6→p6, F2/F3/F4→p2+p7, F7→p1, F8→p7, F9→p5, F10→p2/p3 + review-time fences); each phase independently green at its boundary (walked all eight; pin updates land in the wording's phase; conditional-sweep rule catches undeclared pin trips; scanner lands after the overview/CLI corrections it scans — prompt's ordering concern is satisfied by the phase 6 ordering note).
- test_traceability: §3.1 covers all 12 ACs, §3.2 all DMs, §3.3 all NFRs; every TC has a §5.2 detail, a §7 automation mapping and a plan home; review-time properties (zero-rename diff, earlier-records diff) are correctly fenced outside phases per the no-moving-base rule.
- decision_capture: source-hierarchy decision in DEC-1 + pm-notes; no-rename/DEC-2, clone-identity naming/DEC-3, no-migration/DEC-4, ODR-0006 posture/DEC-5; the system-level vocabulary decision lands in ODR-0006 (Proposed, next free id verified reserved) per brief §H — right place; 00-register correctly untouched.
- system_spec_consistency: every "today" claim the artifacts make about the system spec verified in the tree (reversed sentences, feature-projects wording, groups no-pattern contract, header constants, pattern value, golden, chain pins).
- plan_doc_update_coverage: overview docs + glossary (p4), feature specs AC-edits (p4) + residual declaration for doc-syncer (p8), reference pages (p3), guides/tools sweep (p6), decision index (p5); pm-notes phase-7 impacts list matches.
- dod_defined: §17's 12 testable ACs + §4.1 KPIs + NFR thresholds give the dod_check phase a complete, testable target; plan phases carry per-phase Verify commands and declared scopes for completion evidence.

## Gate result

NOT_READY — delivery blocked. Reopen `specification` (finding 1) and `delivery_planning` (findings 2 and 4), plus `test_planning` for the finding-3 hygiene edit (may ride the specification reopen). No pause flag: both major findings are conformance-to-brief corrections, not new owner decisions. Re-run this gate after the artifact revisions; stalemate cap ~3 iterations applies.
