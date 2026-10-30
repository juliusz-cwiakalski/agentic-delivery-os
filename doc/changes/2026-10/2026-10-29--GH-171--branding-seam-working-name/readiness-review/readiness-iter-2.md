# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-171
Date: 2026-10-29
Pause Required: no

Reviewer: @readiness-reviewer (adversarial DoR gate, local mode; iteration 2 of max 3)
Inputs: issue #171 body + owner comment (fetched live via `gh`), chg-GH-171-spec.md (v1.0, unchanged @ 465e76d), chg-GH-171-test-plan.md (v1.1 @ 15ccd9a), chg-GH-171-plan.md (v1.1 @ 15ccd9a), chg-GH-171-pm-notes.yaml, readiness-review/readiness-iter-1.md, ADR-0003 (C-3/DEC-8), `.ai/rules/testing-strategy.md`, AGENTS.md, current tree @ 15ccd9a.

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

None blocking. Both iteration-1 findings are verified closed; no regressions found.

## Iteration-1 remediation verification

### Finding 1 (critical, docs-scope self-break/scope-decay) — CLOSED

Remediation verified in test plan v1.1 (§1.1, §4.1 class 5 + corpusBaseline + delivered-state rule, §4.2 docs row + mutation count, TC-BRANDING-008 steps 3–5, TC-BRANDING-009 steps 5/6/9, TC-BRANDING-012 precondition + step 5, §6.1/§6.2, §7 wiring/order/evidence, A-T2/A-T5, RSK-T2/T3/T12, OQ-T2/T5, new TC-BRANDING-027) and plan v1.1 (D4 revised, tasks 3.1/3.2/3.3/3.8, 5.3, 6.1/6.3, phase-3/6 ACs and test commands, traceability tables).

Mechanical checks (all confirmed):

- `corpusBaseline` full SHA `32784affbb8a1b82a57b6c4578a331b8bd99b4c4` = `git rev-parse 32784af`; ancestor of `origin/main-tools`. Full-SHA canonical in registry and code; registry-shape assertion rejects branch/tag/`HEAD` forms (D4, TC-027 step 6).
- Membership formula is lifecycle-stable: (docs absent at baseline ⊆ `registered`) ∧ (`registered` ⊆ present in tree ∧ absent at baseline); permanent registration; fail-closed on absent/non-SHA/unreachable baseline (task 3.2: `git cat-file -e <baseline>^{commit}`; shallow clone fails BY DESIGN).
- No operative `--base` residue: task 3.2 explicitly prohibits any `--base` flag / moveable-ref input; the three remaining textual occurrences are the prohibition itself, D4's supersession note, and the revision log (legitimate historical record in change docs). `TC-BRANDING-024` step 5 / evidence-command `git diff origin/main-tools...HEAD` usages are diff-based bash non-regression assertions, not scan-scope semantics — correct to keep.
- CI baseline reachability: task 6.1 binds `fetch-depth: 0` AND an explicit `git fetch --no-tags origin <full-sha>` step (belt-and-braces, and the removable mutation target); task 6.3 mutation-tests removal of the baseline fetch and a shallow `fetch-depth: 1` checkout; triggers verified in `.github/workflows/ci.yml` (`on.push.branches: [main, main-tools, feat/**, fix/**]`) — the job runs on `main-tools` post-merge, which is exactly the scenario the v1.0 design broke on; the v1.1 design is green there.
- Tree-state claim: `git diff --name-only 32784af...HEAD -- doc/ ':(exclude)doc/changes/**'` = 0 files → `registered` initially empty (task 3.1) is correct and the meta-check is satisfiable at the delivered state.

Adversarial scenarios against the NEW semantics (focus item 1):

| # | Scenario | Outcome under v1.1 |
|---|----------|--------------------|
| S1 | Merge of GH-171 onto `main-tools` | Green. Registered = {drill doc}; absent-at-baseline set = same; both conjuncts hold. Proven by TC-027 commits M/S (steps 1–2). The v1.0 failure mode (empty added-vs-base + still-registered doc) is structurally impossible: membership no longer derives from any ref comparison. |
| S2 | Successor PR injects `ados` into the merged drill doc | Fails non-zero naming doc + token (TC-027 step 4 — post-merge injection at successor commit S). Scope decay eliminated; AC-F4-2/ticket AC-2 five-class coverage holds permanently. |
| S3 | Someone renames the drill doc file in a later PR | Fail-closed in both directions: the new path is absent-at-baseline and unregistered (first conjunct fails naming it); the old registered entry is missing from the tree (second conjunct fails naming it). The rename PR must update the registry in the same reviewed change. Correct force-closed behavior; note advisory A7 on dedicated mutation evidence for the orphan-entry direction. |
| S4 | Corpus-migration change advances the baseline | OQ-T5 + D4: advance allowed ONLY in that change, which must migrate interim registered docs into the pre-existing corpus and remove their entries in the same change. An advance past a still-registered doc fails naming it as present-at-baseline (TC-027 step 7); a proper migration (entries removed + baseline advanced together) satisfies the formula. No silent swallow path. |
| S5 | A registered doc is deleted from the tree | Fail-closed: `registered ⊆ present in tree` fails naming the orphaned entry; the deleting PR must remove the registry entry. (Mutation-evidence nit → A7.) |
| S6 | Shallow clone / baseline unreachable | Fails closed with a named missing-baseline error; never silently skips class 5 (TC-009 step 9, TC-027 step 8, RSK-T3, A-T5). CI guarantees reachability (S1 above). |
| S7 | Baseline replaced with `main` / `HEAD` / non-SHA | Registry-shape assertion fails naming the baseline field (TC-027 step 6 mutations). |
| S8 | Another change adds a user-facing doc (e.g. `doc/spec/**` via a future `@doc-syncer`) without registering | Fail-closed by design: the first conjunct fails naming the unregistered doc; the adding change must register in the same change. Operationally honest (a miss = red gate, not a silent escape) — see advisory A6 to make the cross-change obligation explicit in the phase-7 feature-spec inputs. |
| S9 | Modification of a doc that existed at the baseline (corpus) | Out of claim, unregistered, no failure — matches OQ-T2/DEC-8 scope-of-claim. |

### Finding 2 (minor, TC-BRANDING-020 ↔ D6 marker contradiction) — CLOSED

TC-BRANDING-020 step 2 (v1.1) now asserts "a valid `ados_distribution` marker — the delivery plan binds `internal` … the assertion target is a valid enum value, so an owner-approved one-word flip to `redistributable` at PR review still passes — and `bash scripts/.tests/test-doc-distribution.sh` passes". Plan D6 (v1.1) records the resolution and unchanged binding (`internal`). Assertion target and bound value no longer contradict; the flip option is documented in both artifacts and remains guard-neutral (verified in iter-1: `internal` is a valid enum; install set is marker-derived).

## Regression check (focus items 3–5)

- **Traceability intact**: 13/13 spec ACs traced (test plan §3.1; plan AC completeness line, all phased); 4/4 ticket ACs mapped (test plan §3.1, plan ticket-AC mapping); 27/27 TCs slotted (plan traceability table: union of per-phase TC sets = TC-BRANDING-001..027; 022 split P2/P4 and 027 split P3/P6 are deliberate halves, both named in both phases' tasks); 9/9 NFRs, 3/3 DMs, 2/2 EVTs traced. NFR-3 wording updated consistently ("including registered docs that are no longer 'new' relative to any recent ref").
- **Phase structure/commit boundaries intact**: 7 phases, one Conventional Commit each with completion signals, per-phase test commands, per-commit `pnpm check` green; revision log v1.1 confirms only D4 + slotted tasks changed. Remediation commit 15ccd9a touched exactly the two artifacts + pm-notes; spec untouched since 465e76d.
- **Spec ↔ v1.1 compatibility (Appendix B "new user-facing docs")**: compatible refinement, not a contradiction. Spec Appendix B / scope-of-claim fix the contract at "new user-facing docs; the pre-existing corpus migrates separately" and delegate mechanics to delivery planning (spec §14); v1.1 operationally defines "new" as "absent at the fixed `corpusBaseline`" — the direct formalization of DEC-8's new-vs-pre-existing split at the moment the scan lands. Membership permanence strengthens (never weakens) the spec's claim scope: a doc in claim cannot leave it. No spec reopen required (consistent with the iter-1 remediation guidance, explicitly adopted by A-T2/D4 and recorded in OQ-T2/OQ-T5).
- **Registry key rename `newUserFacingDocs` → `userFacingDocs`**: acceptable and consequence-correct — class 5 is no longer "new docs" as a computed set but an explicit registered list under a fixed baseline, so the old name would now be misleading. Grep-verified: no artifact references the old key (the sole occurrence repository-wide is the iter-1 readiness record, which is immutable review history). Test plan refers to class 5 conceptually ("user-facing docs (baseline-anchored)"), plan task 3.1 binds the key consistently.
- **Ticket fidelity (spot re-probe)**: v1.1 adds enforcement mechanics and evidence (TC-027, baseline anchoring) inside the already-claimed F-4/AC-2 contract — no scope growth, no over-delivery; owner constraint intact (only synthetic names, legacy tokens in DEC-8 framing, and a commit SHA in the new text; no candidate/public name anywhere).
- **AC testability (spot)**: unchanged AC set; AC-F4-1/AC-F4-2 references now include TC-027 — sharper, still testable.
- **Enforcement honesty (spot)**: fail-closed in every new path (missing/unreachable baseline, unregistered doc, orphaned entry, advanced baseline); mutation-proven both locally (TC-027) and in CI wiring (task 6.3); no bypass constructs; aggregate chain untouched (A-T8).
- **Doc-artifact mechanics (spot)**: D6/TC-020 aligned (above); drill doc registration path (task 5.3) binds both formula directions; header-via-script rule preserved (task 5.2).
- **Downstream safety (spot)**: DM-2 resolver-input contract unchanged (D7 untouched); M0-S4 consumption unaffected; corpus-migration path recorded as the only baseline-advancing change (OQ-T5).

## Advisories (non-blocking, do not affect the verdict)

- **A1 (persistent, carried from iter-1)**: `myados`-class fully-lowercase embedding escapes the delimiter scan in all scope classes (D1/D2 accepted residual; RSK-2/RSK-T1). Owner ack at PR recommended.
- **A2 (carried)**: DEC-8 build-time define as compile-time default channel remains designated-not-implemented (no build target exists yet); the freeze change must wire it.
- **A3 (carried)**: D6 `internal` for the drill doc — one-word, guard-neutral flip to `redistributable` if the owner prefers; confirm at PR review alongside TC-BRANDING-026.
- **A4 (carried, narrowed)**: TC-BRANDING-014 step 4 now explicitly probes the **default process-scoped instance** in a child with controlled spawn-time environment — the iter-1 ask is met. Residual nit only: §4.3's probe description ("injects a synthetic environment record and a warning sink") reads factory-flavored; delivery should make the default-instance probe's `console.warn` capture explicit in the fixture without changing the assertion.
- **A5 (carried)**: `DELIVERY_OS_WORKING_NAME` neutrality/collision checks verified in iter-1; unchanged.
- **A6 (new)**: Cross-change registration obligation — after merge, ANY change adding a user-facing doc under `doc/**` outside `doc/changes/**`/`doc/decisions/**` (including `doc/spec/**` feature specs authored by `@doc-syncer` every change) must register it in `forbidden-literals.registry.json` in the same change or the meta-check reds main-tools. This is fail-closed by design (a miss is loud, never silent), but the obligation should be stated explicitly for future authors: recommend one added clause in task 7.3's feature-spec reconciliation inputs so it lands in `doc/spec/**` at phase 7. Optional, no artifact reopen required.
- **A7 (new, nit)**: TC-BRANDING-027 has no dedicated mutation for the orphan-entry direction ("registered entry whose doc is missing from the tree" — file deletion/rename); it is asserted by the task-3.2 formula and TC-BRANDING-008 step 5, and the rename scenario decomposes into two covered directions, but a delivery-time additive mutation (delete a registered doc file at successor commit S; assert named failure) would complete the matrix. Evidence-strengthening only; does not change any assertion.

## Verification notes (claims checked against the tree @ 15ccd9a)

- `32784affbb8a1b82a57b6c4578a331b8bd99b4c4` resolves to `32784af` and is an ancestor of `origin/main-tools`; D4/task 3.1/task 6.1 SHA references are correct and internally identical.
- Zero user-facing docs added since the baseline on this branch → `registered` initially empty is correct; the drill doc is the only registration (Phase 5, task 5.3).
- `.github/workflows/ci.yml`: `on.push.branches: [main, main-tools, feat/**, fix/**]`, `pull_request: [main, main-tools]`, 15 top-level `ts-*` jobs (task 6.2's "sixteen" = 15 + the new job); additions-only and wiring rules verified in iter-1 and unchanged.
- Referenced mechanisms exist: `scripts/checks/{ci-topology,ci-bindingness}.ts`, `scripts/.tests/test-doc-distribution.sh`, `.ai/rules/testing-strategy.md`.
- Remediation diff scope: 15ccd9a touches only `chg-GH-171-test-plan.md`, `chg-GH-171-plan.md`, `chg-GH-171-pm-notes.yaml`; spec v1.0 untouched — matching both revision logs and the iter-1 remediation instruction.
- Test plan v1.1 §7 automation table and execution order include TC-BRANDING-027; evidence-command block carries the baseline-reachability note; §6 environments updated consistently (local dev + CI rows).
- No candidate/public name or product token introduced by the remediation text (SHA, `corpusBaseline`, `registered`, synthetic names only).

## Gate result

READY — delivery (phase 6 of the lifecycle) may start. All ten DoR facets pass; both iteration-1 findings are correctly and completely remediated with no regressions; advisories A1–A7 are non-blocking (A1/A3 owner-ack at PR; A4/A6/A7 delivery-time strengthening inside the bound contracts; A2 tracked to the freeze change).
