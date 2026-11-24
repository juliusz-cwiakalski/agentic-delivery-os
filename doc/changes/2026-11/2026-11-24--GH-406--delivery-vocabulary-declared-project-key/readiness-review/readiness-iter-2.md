# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-406
Date: 2026-11-24
Pause Required: no

## Basis

- Re-review after remediation iteration 1 (iter-1 verdict NOT_READY, 2 major / 1 minor / 1 nit). Artifacts re-read in full: `chg-GH-406-spec.md` (14e11aed), `chg-GH-406-test-plan.md` (f95a2ab4), `chg-GH-406-plan.yaml` (283f5366), `chg-GH-406-pm-notes.yaml` (verdict/retro/remediation trail in notes 7–9), prior verdict `readiness-iter-1.md`.
- Branch state verified: exactly three remediation commits (`14e11aed` spec + pm-notes + iter-1 verdict; `f95a2ab4` test plan; `283f5366` plan) on top of iter-1 HEAD `a4de57c2`, itself exactly four artifact commits on base `22b15d31`. Working tree clean (known stray untracked `.zed/`, never staged).
- Fresh `plan validate GH-406` re-run at this gate: `verdict=valid`, `artifact=yaml:chg-GH-406-plan.yaml`, `tier=full`, `readyForDevelopment=true` — independently reproduced, not taken from the dispatch.
- Ticket re-loaded fresh (GitHub tracker): body + owner comment 7122871259 (Delivery brief). Brief §E scope is the full glob `doc/planning/oss-tooling/milestones/*/commands/**`; §F names exactly the three m2 pages as pin surfaces; §C.4 says "a **source file** that did not exist at this change's base"; §D bans "primary checkout". The superseded comment 7117829140 and the body's AC list are treated as superseded in all three artifacts (DEC-1, pm-notes note 2); milestone "M4: Jaiship-native delivery" matches.
- Base claims re-verified in the tree at `22b15d31`: command reference pages total 42 (m1 28, m2 12, m4 2 — counted with `git ls-tree`); `m4/commands/install.md:84` reads "A primary checkout is recorded `verified`" (the brief-banned wording, present at base); the m1 sense-dependent "project key" prose exists at `m1/commands/commit.md:43` and `m1/commands/phase.md:33`.
- Diffs inspected hunk-by-hunk (`git diff a4de57c2 <commit>` per artifact): all edits surgical and confined to the remediation map; TC-DPKPIN-001 and TC-DPKUI-003 sections are byte-identical to iter-1 as claimed.

## Remediation verification (all six map items landed)

1. **[major, finding 1] Conformance scope restored** — spec F-6 now reads "every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` — all milestones' command reference pages, not a selected subset"; §16 component row carries the glob with the 42-page base count, the known in-scope violation (m4 install page "primary checkout" → "main checkout"), and the three m2 pages as additional pin surfaces; Appendix B splits into two explicit bullets: conformance scope (brief §E, glob + 42 = 28+12+2) and pin surfaces (brief §F), "a subset of the sweep scope, never its definition".
2. **[minor, finding 3] Stale self-reference fixed** — test plan §2 now states the plan "exists and binds (validated `verdict=valid`, tier `full`, 8 phases; the four constraints below are adopted verbatim)"; the four binding constraints (a)–(d) retained word-for-word; plan header adoption confirmed (suite names pinned verbatim, "no deviation, no reconciliation notes owed").
3. **[major, finding 1 propagation] Test plan aligned** — §1.1 conformance bullet carries the full glob + 42-count + pins-distinct sentence + the known violation `install.md:84`; TC-DPKCONF-001 precondition states the full Appendix B scope, step 1 asserts the sweep walks all 42 pages "not only the three m2 pin surfaces", step 2 ties the clean pass to the in-change m4 fix; TC-DPKUI-002 steps split into 4 (full-glob sweep + out-of-milestone corrections, e.g. `install.md:84`) and 5 (m2 pages additionally carry pin updates); §7 rows for TC-DPKUI-002 and TC-DPKCONF-001 updated to match.
4. **[major, finding 2] Naming-check governed surface declared** — plan phase 1 states the "SOURCE FILE" rule verbatim against brief §C.4, declares the surface (TypeScript under `packages/**`, `tests/**`, `scripts/checks/**`; extensions `.ts`/`.tsx` where present), lists what is NOT swept (`doc/**` including this change's own artifacts, JSON/YAML, `.ados-claude/**`, `node_modules`, `tmp/**`) with the Day-1-red rationale, pins "baseline entries are source-file paths only", and mirrors the surface in the phase's fences ("no repo-wide or docs sweep").
5. **[nit, finding 4] Content-inventory entry made conditional** — phase 2 now adds inventory entries "ONLY for exports that actually change": `projects.ts` gains the two patterns; `state-scope.ts` gains an entry only if the served accessor is exported from its public surface, none otherwise — consistent with the inventory suite pinning actual export sets.
6. **[proactive] Conformance fence reconciled** — plan-wide fence states the identical glob + 42-count + pins-distinct definition; phase 6 scope extended (`files` += `m4/commands/install.md`; `folders` += m1/m2/m4 `commands` trees), with the m4 correction landing in the scanner's commit and the ordering note updated so the clean-tree pass is truthful.

## No new inconsistencies introduced

- Surface definition is **identical in all four places** it appears (spec Appendix B, test plan §1.1 + TC-DPKCONF-001 precondition, plan conformance fence, plan phase 6): CLI help summaries; text headers of `projects list` and `repos list`; guides tree; tools documentation tree; overview tree; every command reference page under the full commands glob (42 at base: m1 28, m2 12, m4 2). No residue of the narrowed "(repos, projects, board)" phrasing remains in any live artifact (grep-verified; the only matches are the historical iter-1 record and pm-notes' description of the finding).
- §F pins remain distinct from §E scope everywhere the two appear (spec Appendix B, test plan §1.1 both bullets, TC-DPKUI-002 step 5, plan fence, phase 6).
- AC coverage untouched and complete: §3.1 covers all 12 ACs (AC-F1-1…AC-F10-1), §3.2 all DMs, §3.3 all NFRs; every updated TC keeps its §5.2 detail, §7 row, and plan phase home.
- The remediation introduced no decision requiring routing (conformance-to-brief corrections, per iter-1's own assessment); the retro lesson is correctly captured as a pm-notes `retro:` entry, not a decision record.

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

## Findings

None blocking.

## Residual observations (non-blocking, no reopen required)

1. [nit] plan_coverage — plan phase 6 summary "known in-scope mislabels" list
   Gap: The m1 command pages' sense-dependent "project key" prose (`commit.md:43`, `phase.md:33`, verified at base) is not enumerated in the known-mislabels list, though the pages are inside the declared sweep (`folders` includes `m1/commands`). If the scanner's rules flag that prose, the correction rides phase 6 within the declared scope ("the sweep extends to the rest of the declared trees as the scanner demands") and escalation trigger 3 governs any un-stateable correction — the plan already handles the case; the list is illustrative, not exhaustive.
   Suggested remediation target phase: specification (informational only — no action required for this gate)
   Suggested fix: None required; optionally enumerate the m1 prose spots when the scanner's rule set is final, so the sweep expectation is fully explicit.
2. [nit] ac_quality — spec §17 AC-F7-1 wording
   Gap: AC-F7-1 says "no file absent at this change's base" while F-7 says "source file"; read with its linked F-7/NFR-6 and the plan's declared scan surface, the meaning is unambiguous and the plan's explicit surface declaration forecloses both iter-1 failure modes.
   Suggested remediation target phase: specification (informational only)
   Suggested fix: None required for delivery; if the spec is touched for another reason, align the AC shorthand to "no source file".

## Facet notes (evidence for the PASS calls, re-attacked)

- spec_completeness: every brief item (§A–§I, replacement AC list) has a spec home; the iter-1 completeness gap (silently narrowed §E) is closed in F-6/§16/Appendix B with the glob restored and the §E/§F distinction made explicit.
- ac_quality: 12 ACs, Given/When/Then, non-overlapping, each linked to F-/DM-/NFR-IDs; §17 untouched by the remediation and re-checked against the brief's 7-item replacement list.
- plan_coverage: all 12 ACs have phase homes (F1→p4, F5→p3, F6→p6, F2/F3/F4→p2+p7, F7→p1, F8→p7, F9→p5, F10→p2/p3 + review-time fences); phase 6's expanded folders keep every in-sweep surface inside a declared phase; the scanner ordering (after phases 3/4 corrections, with the m4 fix in its own commit) keeps every boundary green.
- test_traceability: §3.1/§3.2/§3.3 complete; the four updated TC anchors (TC-DPKCONF-001, TC-DPKUI-002, §1.1, §2) each retain their §5.2 detail and §7 automation row; pin-surface TCs byte-identical to iter-1 (diff-verified).
- cross_artifact_consistency: ticket §E/§F/§C.4/§D → spec F-6/F-7/Appendix B → test plan §1.1/§2/TC-DPKCONF-001/TC-DPKUI-002 → plan fence/phases 1 and 6 all state the same scope, the same source-file rule, and the same pins/scope distinction; fresh `plan validate` green.
- decision_capture: DEC-1..DEC-5 unchanged and correct; ODR-0006 posture (Proposed, next free id, no earlier-record edits) unchanged; no new decision surfaced by the remediation.
- system_spec_consistency: all base facts re-verified in the tree at `22b15d31` (42-page count, `install.md:84` violation, m1 prose, plus iter-1's code/doc facts, which are untouched — no non-artifact file changed since iter-1).
- plan_doc_update_coverage: every touched doc area has a declared phase home (overview/glossary p4, feature-spec AC edits p4 + doc-syncer declaration p8, m2 reference pages p3, guides/tools/overview/m1/m2/m4 command trees p6, decision index p5); pm-notes phase-7 impacts consistent.
- plan_code_area_coverage: phase 1 now declares the governed surface with roots, extensions, NOT-swept list, and Day-1-red rationale; phase 6's `files`/`folders` cover the full sweep; the naming-rule fence anticipates later baseline extensions for field-name-pinning test files (reason-bearing, same-commit).
- dod_defined: §17's 12 testable ACs + §4.1 KPIs + NFR-1..NFR-7 thresholds unchanged; per-phase Verify commands give dod_check its evidence path.

## Deduplication

All four iter-1 findings are remediated; none persists as persistent. No finding is repeated from iter-1. The two residual observations above are new, non-blocking, and informational.

## Gate result

READY — delivery unblocked. Proceed to `delivery` (@coder executes plan phases 1–8, one commit per phase through the commit primitive, `phase complete` at the boundary). No pause flag; no artifact phase reopened; stalemate counter reset. The verdict artifact is persisted here; the PM commits it.
