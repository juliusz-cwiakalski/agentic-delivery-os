# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-180 (M0-S11 — db session-admin port)
Date: 2026-10-31
Pause Required: no

Artifacts reviewed: `chg-GH-180-spec.md` v1.5 (18 ACs), `chg-GH-180-test-plan.md` v1.4
(38 TCs), `chg-GH-180-plan.md` v1.3 (42 tasks, 5 phases, 38/38 TCs), `chg-GH-180-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`, the ticket
context and recorded PM fallback, current `doc/spec/**` / `doc/decisions/**`, and the actual
repository gate/test sources. No product code, test, spec, test-plan, plan, or pm-notes file
was modified; only this record was written.

Mechanical counts re-verified: 18 `AC-D*`, 38 `TC-DB-*`, 38/38 TCs mapped in the plan,
5 phase headings, 42 `- [ ] **N.M**` tasks, 38/38 TCs in the binding §5.1 table, 18/18 ACs
referenced by the plan and test plan, 0 orphan TCs, 0 retired `db.reboot.live-session`
spellings, and all four `db.*` identities present.

## Facet Summary

| # | Facet | Result |
|---|---|---|
| 1 | spec_completeness | PASS |
| 2 | ac_quality | PASS |
| 3 | plan_coverage | PASS |
| 4 | test_traceability | PASS (non-blocking advisory A1) |
| 5 | cross_artifact_consistency | PASS (non-blocking advisories A1, A2, A6) |
| 6 | decision_capture | PASS |
| 7 | system_spec_consistency | PASS (non-blocking advisories A3, A4) |
| 8 | plan_doc_update_coverage | PASS (non-blocking advisories A3, A4) |
| 9 | plan_code_area_coverage | PASS |
| 10 | dod_defined | PASS |

## Residual Iteration-2 Closure Verification

All residuals committed in `3423168` are verified against the current artifacts and the
actual repository sources:

- **B6 closed.** Repeated same-flag occurrences are last-wins everywhere: plan PIN-5 item 5
  (`chg-GH-180-plan.md:161`), task 4.3 (`:462`), task 4.1 acceptance (`:471`), Execution Notes
  grammar discipline (`:540`), RSK-P1 (`:595`), and the change-level DoD grammar invariant
  (`:633`). No rejection claim remains (repository-wide scan of "repeated"/"conflict" found
  only last-wins wording). The test plan asserts exit-0 last-wins in G-12 (`:322`), A-T3
  (`:329`), and TC-DB-023 step 5 (`:1123`). The unchanged parser was inspected:
  `flags[token] = value` overwrites (`packages/cli/src/index.ts:186-190`), and `conflicts`
  is pair-only (`:194-198`), so the last-wins reading is factually correct.
- **M8 closed.** Plan task 1.7 (`chg-GH-180-plan.md:347`) names the three existing controls at
  `tests/checks/error-table-sync.test.ts` `:400` (`TC-STATE-019`), `:485` (`TC-SYNC-008`), and
  `:959` (`TC-VERIFY-019`), each currently searching the exact six-kind literal, and instructs
  replacing it with the seven-kind array. The source at those lines was verified; no other
  hardcoded six-kind array exists outside `error-table.ts:13` and the additive
  `error-table.test.ts:605` prose assertion. `scripts/checks/error-table-sync.ts` is unchanged
  and the code format is not widened.
- **M9 closed.** Plan task 5.8 (`chg-GH-180-plan.md:505`) lists
  `doc/spec/features/feature-autonomous-delivery.md` with the `session_message` → `message`/`part`
  correction for `:12`, `:53`, `:113`, `:156` and the reference facts (`session_message` 0;
  `message` ~213k; `part` ~961k); `scripts/pm-liveness.sh` (`:11`, `:181`, `:193`) is recorded
  as out of scope (NG-D7) and an owner follow-up. RSK-D14 records the drift
  (`chg-GH-180-spec.md:525`). The cited doc/script lines were verified in-tree.
- **M10 closed.** `archived = session.time_archived IS NOT NULL` is pinned in §3.3
  (`chg-GH-180-spec.md:138`), §3.6 (`:190`), and §4.6 (`:358`); `createdAt = time_created`,
  `updatedAt = time_updated`, `parentId = parent_id` are pinned in §3.3/§4.6. TC-DB-008 asserts
  the mapping (`chg-GH-180-test-plan.md:239`, steps `:661-664`).
- **M11 closed.** The plan File Layout marks `tests/behaviour/error-classification.test.ts`
  Updated (`chg-GH-180-plan.md:268`), task 1.6/1.7/1.8 place TC-DB-005 there (`:343-350`), the
  traceability table maps TC-DB-005 to it (`:289`), and the Phase 1 code-area list repeats it
  (`:366`). The test plan's TC-DB-005 suite (`:236`, `:1658`) and A-T7 (`:1802`) agree.
- **m9 closed.** Test plan frontmatter `last_updated` is `2026-10-31T22:55:00Z` (`:5`), matching
  revision-log row 1.4 (`:1831`); the 1.3 row was corrected to its PM-recorded `22:35:00Z`.
- **m10 closed.** Plan PIN-10 and task 4.7 (`chg-GH-180-plan.md:214`, `:466`) pin the exact
  sorted full-path pair `["packages/cli/src/commands/db.ts", "packages/cli/src/commands/status.ts"]`.
  Verified against `tests/structure/cli-edge-seam.test.ts`: `CLI_DIR = "packages/cli/src"` (`:16`),
  `listTypeScriptFiles` returns sorted full relative paths (`:20-31`), and the current assertion
  is the single status path (`:415-418`), so extending it to the db-then-status pair is correct.
- **m11 closed.** Byte-exact `dataBytes` is pinned with `LENGTH(CAST(... AS BLOB))`/`OCTET_LENGTH`
  in §3.3 (`chg-GH-180-spec.md:134`, `:140`), §4.6 (`:358`), and AC-D2's DoD predicate (`:586`);
  the test plan asserts exact values with a multi-byte case (11 bytes vs 6 characters) in
  TC-DB-008 (`:239`, `:650`, `:662-677`), S-07 (`:358`), and S-08 (`:359`); the plan mirrors it
  in tasks 2.3/2.4 (`:388-389`).

## Re-check of Iteration-1/2 Findings Reported Closed

B1, B2, B3, B4, B5, M1–M7, m2–m8, and n1–n2 remain closed on re-read. B1's additive
`error-table.test.ts` edit is consistent with the actual 31-entry/31-count assertion and the
`:605` prose string; B2's per-phase content-inventory allowances match the hardcoded
`EXECUTABLE_ALLOWANCES` model and the 23-constant PIN-10 list; B3's port-contract fixture update
matches `collectInventory` (modules, exports, and re-exports); B4/B5's failure and SQL-predicate
contracts remain aligned; M1–M7's list-count, liveness/reboot deviations, real-store smoke,
ADR handoff, baseline sequencing, and CI battery are still present. Iteration-1 m1 has a
residual wording gap (A1 below) but the functional behavior and the spec's bound are present.

## Findings

No blocking findings. All ten facets pass; no finding requires reopening `specification`,
`test_planning`, or `delivery_planning`.

## Non-Blocking Advisories (do not change the verdict)

1. **[minor] cross_artifact_consistency — `chg-GH-180-plan.md` task 5.3 (`:500`); `chg-GH-180-test-plan.md` TC-DB-037 step 3 (`:1527`) and GAP-T2 (`:51`); `chg-GH-180-spec.md` §4.6 Query bounds (`:363`).**
   Gap: The spec allows "at most one post-delete existence read per failed delete" in addition to
   one selection query and one pre-delete re-read per candidate; the plan/test-plan bounded-work
   wording says "at most one re-read and one delete per candidate, total queries ≤ `1 + limit`".
   That bound is correct for the success-path apply asserted in TC-DB-037 step 3, but is not the
   general failure-path bound (`1 + 2*limit` worst case). No test asserts a failure-path query
   count, so delivery can proceed; the functional post-delete read is implemented by task 3.2
   and exercised by TC-DB-022.
   Suggested remediation target phase: `test_planning` (and task 5.3 wording in
   `delivery_planning` if re-run).
   Suggested fix: Scope the `1 + limit` assertion explicitly to the success-path apply, or add a
   failure-path assertion allowing `1 + limit + failed` queries with `failed ≤ limit`.

2. **[minor] cross_artifact_consistency — `chg-GH-180-spec.md` NFR-D4 (`:428`); `chg-GH-180-test-plan.md` GAP-T2 (`:51`) and TC-DB-037 reference procedure (`:1533`); `chg-GH-180-pm-notes.yaml:45,48`.**
   Gap: v1.5 aligned NFR-D4 to the verified reference facts (~213k messages), but the test plan
   still cites ~209k messages in GAP-T2 and the TC-DB-037 reference procedure. Both figures are
   approximate and non-CI (the perf fixtures are synthetic), so no assertion changes.
   Suggested remediation target phase: `test_planning`.
   Suggested fix: Align the test-plan reference figures to ~213k messages (or state "≈209–213k,
   approximate reference only") so the reference environment is described once.

3. **[nit] system_spec_consistency / plan_doc_update_coverage — `doc/guides/delivery-modes.md:413`; `chg-GH-180-plan.md:505`; `chg-GH-180-spec.md:525`.**
   Gap: The delivery-modes guide also calls `session_message` the "current" table. The plan's
   phase-7 list and RSK-D14 name only `feature-autonomous-delivery.md` and `scripts/pm-liveness.sh`.
   The guide currently describes the out-of-scope script's actual query, so it is not wrong today;
   if phase 7 rewrites the system spec, the guide should be flagged in the same follow-up.
   Suggested remediation target phase: `delivery_planning` (phase-7 handoff note).
   Suggested fix: Add `doc/guides/delivery-modes.md` to the phase-7 follow-up list (or record why
   it intentionally tracks the unmodified script).

4. **[nit] system_spec_consistency / plan_doc_update_coverage — `doc/spec/features/feature-result-contract.md:52`; `doc/overview/glossary.md:48`; `chg-GH-180-plan.md` task 1.5 (`:342`).**
   Gap: Task 1.5 says "add `db` to the declared domain-kind prose". The target file has a second
   sentence (`:52`) listing which kinds require a code, and the glossary (`:48`) lists the declared
   kinds; both need `db`. The sync gate only parses the table and `error-table.test.ts` only
   asserts the `:50` prose string, so a coder could update one sentence and leave the others stale.
   The glossary is already in the phase-7 list, so this is documentation precision only.
   Suggested remediation target phase: `delivery_planning` (task 1.5 wording).
   Suggested fix: Name both `feature-result-contract.md` prose sentences and the glossary
   domain-kind row explicitly (add `db` to the "requires a code" sentence; `db` contains via
   `fallback.internal`).

5. **[nit] cross_artifact_consistency — `chg-GH-180-plan.md` Context "Baseline" (`:49`).**
   Gap: The plan says "The delivery start HEAD is `f5c4d36`", but that commit predates the
   authoritative spec v1.5 / test plan v1.4 / plan v1.3; the branch HEAD containing this plan is
   `3423168`. The coder executes the current branch, so this is informational, but the stated HEAD
   is stale.
   Suggested remediation target phase: `delivery_planning`.
   Suggested fix: Update to the artifact commit (`3423168`) or say "HEAD at delivery start".

6. **[process nit, not an artifact defect] GH-180 labels.** As in iteration-1 n3, `blocked` /
   `human-input-needed` remain on the issue while delivery proceeds under the recorded resume.
   PM should annotate or remove them when the PR is opened. This is a PM/PR action, not a
   readiness gap.

## Gate Result

- Verdict: **READY** — delivery may start.
- Pause: **no** — no human decision is required to start delivery. The C-11 privacy sign-off and
  the fallback deviations (checkpoint-only reboot; activity-based liveness) remain explicit owner
  merge-gate items at PR review, as recorded, and are not delivery blockers.
- No facet fails; the six advisories above are non-blocking. They should be picked up by the coder
  during the named phases or by phase 7; none requires reopening an artifact-authoring phase.
- No implementation, dispatch, PR, merge, or artifact edit was performed by this review. Only this
  record was written.

Artifact: `doc/changes/2026-10/2026-10-31--GH-180--db-session-admin-port/readiness-review/readiness-iter-3.md`
Verdict: **READY**
