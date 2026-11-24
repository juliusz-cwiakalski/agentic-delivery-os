# Readiness Review Iteration 4

Verdict: READY
Work Item: GH-406
Date: 2026-11-24
Pause Required: no

## Basis

- Focused closure gate re-running the two iter-3 majors after remediation. Artifacts re-read in full at HEAD `724f7105`: `chg-GH-406-spec.md` v1.2 (4f9d2551), `chg-GH-406-test-plan.md` v1.2 (6492e739), `chg-GH-406-plan.yaml` rev 4 (724f7105), `chg-GH-406-pm-notes.yaml`, prior verdicts `readiness-iter-1.md`/`-2.md`/`-3.md` (iter-3 committed with 4f9d2551). Branch: the three remediation commits sit on the trail iter-3 verified (…40653fb3); working tree clean except the known stray `.zed/` (never staged). pm-notes phases: specification 20:03:10, test_planning 20:05:06, delivery_planning 20:08:48 — planning stage re-landed; `dor_check` open (this gate).
- Fresh `plan validate GH-406` re-run at this gate via the delivery CLI (`bun packages/cli/bin/delivery-os.ts plan validate GH-406`): `verdict=valid`, `artifact=yaml:chg-GH-406-plan.yaml`, `tier=full`, `readyForDevelopment=true` — independently reproduced.
- Source ticket re-loaded fresh (GitHub tracker per `.ai/agent/pm-instructions.md`): issue 406 OPEN, live title = "M4-S39: Delivery vocabulary: product, repository, main checkout, worktree, lane, clone identity; credentials bind to the product key (M4)". Amendment comment 7138707234 re-read; its §G text verified verbatim: "The branch and change-folder slugs keep their names. They are identifiers, and renaming a branch mid-lifecycle is not worth it." — §G indeed covers ONLY branch + change-folder slugs, never the title.

## Remediation verification

### Finding 1 (title provenance) — VERIFIED LANDED

- Spec front matter `change.title` (spec line 7) = the live tracker title **verbatim** (byte-checked against the GitHub issue). Test plan H1 (line 17) carries the same title; plan header comment (plan line 12) carries the same title.
- DEC-6 (spec line 285) corrected to mirror-fidelity: "the change title is the tracker's renamed title (owner renamed it 2026-11-24T17:06:57Z alongside amendment comment 7138707234); amendment §G covers only branch and change-folder slugs, which stay unchanged" — verified faithful against the amendment's actual §G text quoted above.
- Test plan title note (line 19) restated with the corrected provenance (§G slugs-only, not the title; suite/file names unchanged identifiers per §G and Section 7); plan header lines 36–40 explicitly carve the title OUT of the §G identifiers list and record the rename event; the three justifications are now mutually consistent (mirror-the-tracker + timestamp + §G boundary).
- Zero false provenance phrases remain in any of the three artifacts (sweep for "ticket's own records" / "change's own records" / "change title unchanged" / "ticket's own legacy wording": the only hits are plan line 36 — the slugs/folder/branch/suite-file/changeset-file identifiers clause iter-3 explicitly blessed as correctly covered, with the title carved out in the next sentence — and plan line 627, the rev-4 revision note quoting the REMOVED clause). No old-title residue and no stale cross-reference to the old title anywhere in the three artifacts.
- Revision records: spec Document History gains the v1.2 row (line 400) AND the v1.1 row's own false "and change title unchanged" phrase was corrected to "slugs, folder and branch unchanged"; test plan §9 gains the v1.2 row (line 859, "title adoption only … vocabulary content byte-intact"); plan rev-4 note (lines 602–630) records both fixes.
- Delta purity verified: `git diff 4f9d2551^ 4f9d2551` on the spec touches ONLY the title field, the DEC-6 title clause, and the two revision rows — the "no v1.1 vocabulary content altered" claim in the v1.2 row is true.

### Finding 2 (ODR-0006 scope) — VERIFIED LANDED

- Plan phase 5 summary (line 414) now declares: "the re-word covers the WHOLE RECORD: the body AND its front matter — the `summary`, `business_impact` and `customer_impact` fields re-worded off the pre-amendment nouns (the delivered front matter prints 'PROJECT and PROJECT REPOSITORY') and the `governance.driver` field citing the FULL supersession order ticket body < delivery brief (comment 7122871259) < VOCABULARY AMENDMENT (comment 7138707234)" — plus the decision-index row: "keeps its delivered mechanism unchanged while the row's TITLE TEXT is re-worded to carry the product vocabulary".
- Every factual claim in the clause verified against the delivered tree: `doc/decisions/ODR-0006-…md` front matter `summary:` ("…declared project key…"), `business_impact:` ("the project, repository, and lane levels"), `customer_impact:` ("prints PROJECT and PROJECT REPOSITORY") and `governance.driver:` (cites only body + brief 7122871259; amendment absent) all verifiably pre-amendment; `doc/decisions/00-index.md` row (line 30) title text "Delivery Vocabulary — Project, Project Repository, …, Declared Project Key" verifiably pre-amendment. The clause names surfaces that genuinely exist and need the re-word.
- Fences intact: still `status: Proposed` / `decision_date: null`, never Accepted; only ODR-0006 + its index row change under `doc/decisions/`; no earlier record and not `00-register.md` touched; delivered commit stays in pm-notes, the re-word lands as a NEW commit with fresh gate evidence.
- Binding-direction logic recorded (plan lines 414 tail + rev-4 note): TC-DPKODR-001 asserts body + status/date only and the conformance scanner excludes `doc/decisions/**`, so the whole-record clause is the binding direction of the re-word. Iter-3's optional test_planning ride (front-matter noun assertion) was explicitly optional and was not taken; the plan compensates with the binding clause plus TC-DPKODR-001 step 6's review-time whole-record diff inspection — the finding's mandated fix ("one clause in phase 5's summary") is satisfied.

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

Non-blocking nits only; no facet fails.

1. [nit] plan_coverage — plan rev-4 revision note (line 615: "exactly those front-matter fields") and the phase-5 enumeration
   Gap: The delivered ODR-0006 `service:` field also carries pre-amendment wording ("the delivery vocabulary and the project-scope contracts (ubiquitous language, declared project key, clone identity)") but is not named in the enumeration; the rev-4 note's "exactly those" phrasing over-narrows the delivered-record delta. No orphaned surface exists — the operative scope sentence "the WHOLE RECORD: the body AND its front matter" (line 414) unambiguously subsumes `service:` — so this cannot strand retired vocabulary; the risk is only an executor stopping at the enumerated fields.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Optional one-word tightening — name `service:` alongside the enumerated fields (or soften "exactly those" to "those and the rest of the front matter") in the plan text, or simply execute the whole-record clause literally; TC-DPKODR-001 step 6's review-time whole-record diff inspection backstops either way.
2. [nit] cross_artifact_consistency — plan "spec v1.1" content citations (lines 7, 44, 121, 554) after the spec moved to v1.2
   Gap: The plan still tags four content citations with "spec v1.1" while the current spec is v1.2. Content-accurate (the v1.2 revision row declares "no v1.1 vocabulary content altered", and lines 121/554 are rev-3 historical provenance), so no reader is misled about substance — purely citation-version staleness.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Optional refresh of the two forward-looking citations (lines 7, 44) to "spec v1.2"; leave the historical provenance tags (lines 121, 554) as the commit-pinned history they are.

## Non-blocking residual (PM bookkeeping, outside the artifact phases)

- pm-notes `title:` (lines 2–3) still carries the pre-amendment title. Iter-3 dispositioned this as PM bookkeeping that "rides the phase completes" — pm-notes has no owning phase in the reopenable artifact set, so it cannot gate delivery. The truthful records exist (the 17:06Z amendment note in the same file records the amendment faithfully, §G as slugs-only; the ticket and all three artifacts carry the renamed title). The PM should refresh `title:` when recording the next phase completes (at the latest at dod_check/pr_creation bookkeeping), so the folder's one remaining pre-amendment title string does not outlive delivery.

## Facet notes (evidence for the PASS calls)

- spec_completeness / ac_quality / test_traceability: the spec v1.1→v1.2 diff is title-provenance-only (verified by diff), and the test plan v1.2 row declares vocabulary content byte-intact — the 12-AC decomposition, DM/NFR coverage and TC traceability iter-3 passed are untouched; spot-checked amendment completeness still holds (headers PRODUCT/REPOSITORY/CLONE with `PROJECT REPOSITORY` asserted absent — spec F-5 line 119, test plan §1.1 line 33, plan phase 6 line 433; retirement clause, "the tool" prose rule and neutral examples `acme`/`example.com` — spec F-1 line 115, test plan §1.1 line 29, plan phases 5/6).
- plan_coverage: all 12 ACs keep their iter-3 phase homes (rev 4 touched only the header comment, phase 5's summary, and the revision note — no phase or AC mapping changed); the single iter-3 gap (F-9's within-record front matter + index-row text) is now declared; fresh `plan validate` green (verdict=valid, tier=full, readyForDevelopment=true).
- cross_artifact_consistency: ticket ↔ spec ↔ test-plan ↔ plan title alignment is now exact (live tracker title byte-checked against all three artifacts); the §G boundary claims are verified against the amendment's actual text rather than asserted; the NFR-2/fixture/AC-decomposition consistency iter-3 verified is unchanged; rename annotations remain the only carriers of the old identifiers (`DECLARED_PROJECT_KEY_PATTERN` 0/0/4, `declaredProjectKeyVerdict` 0/0/5 across spec/test-plan/plan — unchanged from iter-3's sweep).
- decision_capture: DEC-6 corrected and truthful; ODR-0006 posture (Proposed, decision_date null, next-free id reserved, no-earlier-records fence, owner accepts at the PR) unchanged across all three artifacts; pm-notes amendment note remains faithful.
- system_spec_consistency: phase 5's tree claims re-verified against the delivered record and index row (all accurate); the escalation triggers, constants block and AMENDMENT STATUS blocks are unchanged from the iter-3-verified rev 3 content.
- plan_doc_update_coverage / plan_code_area_coverage: phase homes and file scopes unchanged (phase 5's `scope.files` = ODR-0006 + `00-index.md` + `tests/structure/delivery-vocabulary.test.ts`); iter-3's tree verification of every named path carries over since rev 4 altered no scope.
- dod_defined: §17's 12 ACs + §4.1 KPIs + NFR thresholds + §18 re-run posture unchanged.

## Deduplication

- Iter-3 finding 1: REMEDIATED (verified above) — not persistent.
- Iter-3 finding 2: REMEDIATED (verified above) — not persistent.
- No iter-1 finding persists (conformance scope, naming-check surface, stale self-reference, state-scope inventory — all unchanged and still resolved; rev 4 touched none of those surfaces).
- Iter-2's two residual nits remain non-blocking informational (m1 sense-dependent prose inside the declared sweep; AC-F7-1 shorthand read with F-7/NFR-6).
- The two iter-4 nits are new, both introduced by the remediation prose itself (an over-narrow delta sentence; citation-version staleness); neither repeats an earlier finding. The pm-notes `title:` residual is the iter-3 finding's last location, dispositioned by iter-3 itself as bookkeeping riding the phase completes — carried here only so it is not forgotten at dod/pr time.

## Gate result

READY — delivery re-execution may proceed. Both iter-3 majors are verifiably remediated with evidence-linked fixes in the owning artifacts; the standing iter-2/iter-3 passes carry over (rev 4's delta is confined to title provenance and the phase-5 scope clause, each verified pure); fresh `plan validate` is green. The amendment-directed execution remains as pm-notes records it: PR #411 must not merge as it stands, review + full quality gates re-run, PR title/body updated to the renamed title before pr_creation. No pause flag. The verdict artifact is persisted here; the PM commits it.
