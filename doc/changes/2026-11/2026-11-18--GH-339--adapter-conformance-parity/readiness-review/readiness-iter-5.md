# Readiness Review Iteration 5

Verdict: **READY_WITH_NOTES**
Work Item: GH-339 (M3-S5: Adapter conformance and parity suite, M3)
Date: 2026-11-18
Pause Required: no
Reviewer stance: adversarial Definition-of-Ready gate (`@readiness-reviewer`), iteration 5 (delivery gate), full re-run against the working-tree artifacts the coder will read. Prior records: `readiness-iter-1.md` … `readiness-iter-4.md`.

**Delivery may start.** No blocking finding remains, and no blocking finding from iterations 1–4 recurs or is partially open. The two iteration-4 blockers are closed in the working tree: the digest fixture is declared end to end in the plan, and §7.2 now says six observations. The notes below are **binding obligations** for the coder; they do not reopen any authoring phase. The single process note (the plan's comment-only residual diff) must land in a commit — phase 6's declared change-folder scope covers it.

## Facets

- spec_completeness: **PASS**
- ac_quality: **PASS**
- plan_coverage: **PASS** — 72/72 TCs (4/34/9/11/8/6) and 34/34 ACs (3/10/8/7/6), one owner each, zero cross-phase AC→TC citations (re-verified mechanically this iteration).
- test_traceability: **PASS** — 34 AC rows ↔ 72 TCs, 0 orphans.
- cross_artifact_consistency: **PASS** — digest scope, six-observation record, citations, counts, ownership and totals agree.
- decision_capture: **PASS** — TDR-0037's pagination row and TDR-0039's runner note both reconciled.
- system_spec_consistency: **PASS**
- plan_doc_update_coverage: **PASS**
- plan_code_area_coverage: **PASS** — phases now 20/11/12/11/12/7 files; the digest path is declared in phases 1 and 3 and appears in the header, the phase-1 gate, the phase-6 gate and the escalation trigger (8 references).
- dod_defined: **PASS**

## Iteration-1 findings — 15/15 Resolved

All remain resolved on re-read: pagination postures (GitHub covered / GitLab recorded `pagination-model` / Jira `gap-backed`); append-only trap-suite obligation with frozen pin; six-dimension parity basis with per-dimension controls; TC-REG-002's non-editing mechanism; base-free topology pin; binding identity-construct definition with derived columns; enumerated nine clause ids; AC-F2-11/NFR-4 family-wired scoping; AC-F2-4's 403 boundary; TDR-0037's two-tree scan scope; TDR-0036's structured violation records; entry-level class set; policy-pointer disposition; `00-index.md` conditional staging; `ts-exports` wording.

## Iteration-2 findings — 12/12 Resolved

1 six-dimension basis — Resolved. 2 totals 9/7/2 — Resolved. 3 TDR-0037 pagination row — Resolved (declared page bound + reported-count presence; three postures; §4 fixture rule names them). 4 NFR-4 — Resolved. 5 `registerId`/`differenceId` and "four dimensions" — Resolved (TC-PARITY-004: six dimensions, cell `registerId` = entry `differenceId`, key match). 6 trap-name baseline — Resolved (pin + digest, both now in plan scope). 7 §2 plan state — Resolved (plan v1.4). 8 "eleven mutations" — Resolved (22). 9 §12 posture — Resolved. 10 TDR-0039 note — Resolved (restated as the disclosed allowlist exception; "no reconciliation is outstanding"). 11 ownership formatting — Resolved. 12 TC-TAX-008 tautology — Resolved.

## Iteration-3 findings — Resolved

- **Blocking 1** (six four-dimension remnants) — Resolved at all six named locations; the last survivor found in iteration 4 (§7.2) is also fixed.
- N1 TDR-0037 — Resolved. N2 carrier scoping — Resolved (consistent in F-1 row + paragraph, API-1, DM-1, test plan §2/TC-PARITY-005/§8.2/TC-PMUT-018, plan header/phase-2 contract/scope comment/obligation 2.8). N3 pin-bytes oracle — Resolved (digest, now in scope). N4 identity-scheme classifier — Resolved. N5 pipeline-model unit — Resolved. N6 failure-classification placement — **accepted; carried as a binding delivery note** (below). N7 vacuous Jira write cells — **accepted; carried as a binding delivery note**. N8 §7.6 TAX grouping — Resolved. Both nits — Resolved.

## Iteration-4 findings — Resolved

- **Blocking 1** (digest fixture outside every scope) — **Resolved**. `tests/fixtures/pins/trap-names.sha256` is in the header pin block (131–160), phase 1's `scope.files` (970, authored with the pin and computed once, obligation 1.6), phase 3's `scope.files` (1504, read-pinned, byte-identical), the phase-1 gate (digest equals the recomputed SHA-256 of the baseline **before** any append), the phase-6 gate (recomputed over the baseline; a pin edit and a digest edit are both required to forge it), and the escalation trigger (781: the frozen pin pair regenerated, or the recomputed digest ≠ the committed one). The test plan §7.2/TC-FLOOR-001 and §7.6 mirror the pair. End to end, in scope, mechanical.
- **Blocking 2** (§7.2 "the four dimension observations") — **Resolved**: "the six dimension observations (one per dimension per pair, each `{state:"observed", value}` or `{state:"not-observable", why}`)".
- N1 stale version labels — **Resolved**: test plan §2 cites plan v1.4/spec v1.4; §8.2 cites spec v1.4; plan SOURCES cites test plan v1.4; phase-3 contract cites spec v1.4. Remaining `v1.0–v1.3` tokens are historical (resolution notes, revision-log rows, "v1.2 phase-2 contract repeated it" provenance), which is correct.
- N2 TDR-0039 note — **Resolved**.
- The two delivery notes from iteration 3 remain **binding obligations** (below).

## Findings

No blocking findings.

### Binding notes for delivery (carry these; they do not reopen phases)

1. **Failure-classification rationale honesty.** Where a pair's `failure-classification` observation is `observed` on the adapter and `not-observable` on the reference (because the reference has no family on that operation), the register entry's rationale must say exactly that — the classification is unobservable on the reference, not a provider divergence. (Iteration-3 N6.)
2. **The two Jira write cells.** `(jira, write-work-item)` and `(jira, transition-work-item)` have no observable dimension beyond the workflow-state family; their `same-as-reference` verdict follows from the six observations agreeing as `not-observable`/empty-declaration. The adjudication record should state that honestly rather than imply an observed equivalence. (Iteration-3 N7.)
3. **Digest discipline.** Author the pin from the delivered suites before any append, compute the digest once over the pin's exact bytes, commit both in phase 1, and never regenerate either. The digest is recomputed and compared in the phase-1 gate, phase 3 and TC-FLOOR-001; a pin edit without a digest edit (or vice versa) fails by name.
4. **Commit the plan's residual comment.** The working-tree plan (certified here) carries a comment-only pin-governance addition that did not land in the delivery-planning commit. It must be committed via phase 6's declared change-folder scope so the branch carries the plan the coder read. No further plan change is implied.
5. **Test plan revision hygiene (optional).** The test plan's content changed after its 1.4 row; add a 1.5 row (or record the edit in §10/pm-notes) when the file is next touched. Editorial only.

## Answers to the six questions

1. **Both blockers closed; no recurrence.** Digest scope is declared in the header, phases 1 and 3, the phase-1 and phase-6 gates and the escalation trigger; §7.2 says six. Every prior blocking finding is resolved; none is partially open. The only previously re-raised item (TDR-0039's note) is now reconciled.
2. **Digest mechanism end to end.** Authored in phase 1 (order binding: pin first, digest computed once, then the append), read-pinned in phase 3, asserted by TC-FLOOR-001 (recompute vs committed; a two-file forgery is required and review sees it), gated at phase 1 and phase 6, and named in the escalation trigger with a `fails by name` predicate. Non-circular and mechanical.
3. **Old-model text.** No surviving four-dimension statement, no `assertionFamily`-as-source and no absence-and-truncation-as-source. Remaining hits are: the spec's factual "carries no `assertionFamily` / no truncation signal" context; "four tracker class ids"; the census golden pinning the registry's immutable `assertionFamily` field; "the four `AC-F3-7` malformations"; and document history/revision rows. All legitimate.
4. **Citations, counts, ownership, totals.** Current artifacts cite spec v1.4 and the plan/test plan v1.4 reciprocally; older `v1.x` tokens are history. 72/72 TCs (4/34/9/11/8/6), 34/34 ACs (3/10/8/7/6), 22 parity mutations in a 55-row register, 9 covered / 7 recorded-difference / 2 gap-backed = 18; AC→TC phase alignment re-verified with zero cross-phase citations; plan phases 20/11/12/11/12/7 and `tier=full`.
5. **Non-goals and intersections.** Intact: no phase scope includes `packages/adapters/src/**`, the error table, `DOMAIN_KINDS`, projections/exits, the artifact, the flows/steps/skip kinds or any workflow file (those paths appear only in refusal/escalation text); the observation record and digest are test-only. Four intersections unpredicted; `(gitlab, read-pipeline-run)` spec-fixed via DM-4 and declared in TC-PARITY-007/008.
6. **New inconsistencies.** None blocking. Two hygiene notes only: the test plan's revision log stops at 1.4 (note 5) and the plan's residual comment is uncommitted (note 4). Nothing else changed shape: the digest additions are additive scope, the citations now point at existing sections, and no AC's cited TCs moved.

## Verification evidence (delivered code, this iteration)

`ConformanceStepResult` unchanged (no `assertionFamily`, projection or truncation field); GitHub `readPipelineRun` returns `{items, pageItemCount}` with one synthesised job and a `details_url` evidence entry per item, GitLab returns a bare `PipelineRun[]` with its own jobs and trace, Jira has no closed-operation collection read; identities numeric for GitHub PR/issue and GitLab `iid`, keys for Jira, `<sha>:<id>` for pipeline items; capability postures 9/0, 2+7, 3+1+5 and the 27/13/14/9/5 and 9/7/2 arithmetic; GitHub stamps `httpStatus` on non-2xx and the 2xx decode path while GitLab/Jira never do; five runner comparisons; `flows.ts`/`coverage.ts`/`harness.ts` identity-free; zero `"tracker.` literals in the two trees; `runTrapCatalog` requires an assertion per entry and each suite pins an exact ordered array; `tests/structure/trap-catalog.test.ts` enforces minima/required names only; five workflow files with `ts-test` fetching the base then `pnpm test` and `ts-exports` running `tests/structure` base-free. `doc/decisions/00-index.md` clean with the four TDR rows; all four TDRs `status: Proposed`, phase-1 declared.

**Delivery is cleared to start.** Carry notes 1–5; notes 1–3 are substantive, note 4 is a commit obligation, note 5 is optional hygiene.
