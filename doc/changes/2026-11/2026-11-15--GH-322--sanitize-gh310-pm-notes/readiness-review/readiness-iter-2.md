# Readiness Review Iteration 2

Verdict: **READY**
Work Item: GH-322
Date: 2026-11-15
Pause Required: **no**
Supersedes: `readiness-review/readiness-iter-1.md` (NOT_READY, F-1 + F-2)

Artifacts verified against the text (read-only, zero git operations): `chg-GH-322-spec.md` v1.1, `chg-GH-322-test-plan.md` v1.1, `chg-GH-322-plan.yaml` revision 1.0, `chg-GH-322-pm-notes.yaml`; source ticket juliusz-cwiakalski/agentic-delivery-os#322 (re-read via `gh`, OPEN, `bug`/`change`, milestone M2); affected artifact `doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/chg-GH-310-pm-notes.yaml`; `scripts/checks/privacy-literals.ts`; `doc/spec/features/{feature-capsule,feature-pm-notes-lint-and-phase-transitions,feature-plan-schema}.md`; `packages/cli/src/{production,edge}.ts`, `packages/cli/src/commands/{commit,phase}.ts`; `packages/core/src/domain/capsule.ts`; `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`; `AGENTS.md`; `doc/guides/definition-of-{ready,done}.md`. No artifact was modified.

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

## Iteration-1 Findings: Closure Verified Against the Text

### F-1 [was major] ac_quality + cross_artifact_consistency — **CLOSED**

- `chg-GH-322-spec.md` §4.2 NG-2 now reads "Editing any change artifact, phase state, or pm-notes record **other than the GH-310 pm-notes line named in §7.1**" — the earlier blanket prohibition of every other pm-notes record is gone.
- §17 AC-F1-5 now reads "…and touches no ticket artifact **other than the GH-310 pm-notes line named in §7.1 and this change's own folder**", which is exactly the iteration-1 suggested qualification and is satisfiable by the intended edit.
- The test plan matches rather than contradicts it: §3.1 AC-F1-5 row and TC-PRIV-006's expected outcome restate the same carve-out, and TC-PRIV-006's note quotes the AC clause verbatim (string-compared, identical). Plan phase 1 `scope.files` lists only the GH-310 pm-notes, and the plan header's scope-discipline paragraph names every excluded tree. Ticket → spec → test plan → plan now agree on what "in scope" means; no residual "touches no other ticket's artifacts" text remains outside the iteration-1 record and the pm-notes history entry that quotes it.

### F-2 [was major] dod_defined — **CLOSED**

- `chg-GH-322-spec.md` §17.1 "Definition of Done (change-specific)" exists and carries DoD-1…DoD-5, each with a done condition, the §17/NFR IDs it binds, a named verification method, and the plan obligation or lifecycle phase that proves it (1.7 / 1.1,1.2,1.5 / 1.7 / 1.8 / phase 11).
- The rows are testable and traceable, not aspirational: DoD-1 binds all five ACs and all five NFRs to a recorded execution log; DoD-2 binds AC-F1-3/NFR-2 to a masked single-substitution diff with `1`/`1` numstat; DoD-3 binds AC-F1-2/NFR-5 to a home-rooted scan of this change folder; DoD-4 binds §18/NFR-4 to one commit bearing the ticket's exact subject; DoD-5 binds AC-F1-5/NFR-4 to PR base/open state plus the changed-file set.
- Every plan obligation the table cites exists in `chg-GH-322-plan.yaml` (1.1, 1.2, 1.5, 1.7, 1.8 all present and materially matching). The closing rule ("a condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row") makes the DoD binding, and the spec states it claims no passing evidence yet — correct pre-delivery posture.

### Waved findings N-1…N-4 — resolved or explicitly optional

- **N-1 CLOSED**: test-plan front matter `links.implementation_plan: ./chg-GH-322-plan.yaml` (file exists), and §2 cites the plan with obligations 1.1–1.8.
- **N-2 CLOSED**: TC-PRIV-003 step (5) is now `delivery-os lint GH-310` with exit 0 and `evidence.class: conforms` in the expected outcome; YAML parsing is demoted to step (6), "optional secondary sanity". §4, §7 and §7's closing paragraph carry the same authority statement.
- **N-3 CLOSED**: spec §2.1, §23, authoring guidelines and test plan §2/§6/§8 all cite `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` (verified: the lesson states the `TMPDIR=$PWD/tmp/tmpdir` convention; `AGENTS.md` contains no `TMPDIR` text) and label the ticket's `AGENTS.md` wording as shorthand. No unsupported citation remains in current text.
- **N-4 (optional) NOT APPLIED**: the plan is unchanged at revision 1.0, so the phase-7 "no current-truth change required" verdict is still header prose. Iteration 1 marked this optional; it remains non-blocking and nothing is unowned.

## Mechanical Verification (re-established at this gate)

- **Red state still reproduces, unchanged and sole-blocking.** `bun run scripts/checks/privacy-literals.ts` → exit 1, one violation, rule `private.absolute-user-path` at the GH-310 pm-notes line 279, fingerprint `c796b58bf3a81320` (identical to the spec's reproduction), 4075 files scanned, 0 other violations. The declared assumption in spec §12 still holds.
- **The edit target is still a single unique token on one line.** The absolute temp root occurs exactly once in the affected file (line 279); the other gate temp-root mentions are lines 77, 409, 514, 531, all `$GATE_TMPDIR`, exactly as the spec states. A home-rooted absolute-path scan of the GH-310 folder returns that one line and nothing else.
- **Artifacts validate and lint.** `plan validate GH-322` → `verdict=valid`, `tier=lite`, `readyForDevelopment=true`. `lint GH-322` → `evidence.class: conforms` (variant `full`, target `pm-notes`). `lint GH-310` → `evidence.class: conforms` (the authoritative conformance surface TC-PRIV-003 now prescribes). `bun test tests/checks/doc-conformance.test.ts` → 11 pass / 0 fail.
- **No absolute user path in this change folder** (DoD-3 self-check on the artifacts, including this record): home-rooted scan returns no match. Note the runtime's `lint` output prints the absolute path of the file it read — that is tool output, not artifact content.
- **Counts and numbering are sound after remediation.** Spec headings 1–25 in order with the new §17.1 correctly placed between §17 and §18 (no renumbering, no duplicate). Test plan headings 1–10 with the new §3.4 between §3.3 and §4. TC inventory: 6 index rows = 6 detail headings = 6 §7 rows = 6 unique IDs, no orphan. §3.4 carries exactly 5 DoD rows matching spec DoD-1…DoD-5. §3.1 lists 5 AC rows; the spec has 5 ACs, all traced (AC-F1-1→TC-PRIV-001, -2→002, -3→003, -4→004, -5→005/006); NFR-1…NFR-5 and DM-1 all mapped.
- **Branch state.** 6 commits ahead of `origin/main-tools` (artifact commits added by the remediation passes), working tree clean; `git diff --name-only origin/main-tools...HEAD` lists only this change folder's 5 files (spec, test plan, plan, pm-notes, iteration-1 record) — no product, prompt, workflow, or spec file. Informational only; no artifact claims a commit count.
- **Baseline file count drift.** The spec/plan/pm-notes cite 4070 scanned files; the check now reports 4075 because artifacts have been added since the `clarify_scope` snapshot. The binding criterion (exit 0, 0 violations) is unaffected; the number is a recorded snapshot, not a done-condition.

## Advisory Observations (non-blocking, no reopening required)

1. **[minor] cross_artifact_consistency** — `chg-GH-322-spec.md` §17.1 DoD-4 vs `chg-GH-322-test-plan.md` §3.4 DoD-4 row.
   Gap: the spec names two evidence sources for DoD-4 ("Commit log for the branch **plus the capsule's recorded commit event**"), while the test plan evidences it with the commit log alone. More importantly, no `events.jsonl` exists anywhere under `doc/changes/` (including GH-310, delivered after the capsule feature landed), and `createCapsuleProducerPort` in `packages/cli/src/edge.ts` has no production call site — `createProductionCommitRuntimeOptions` does not pass a capsule port, so the shipped CLI appends no `commit.landed` event. The second evidence source is therefore not producible today.
   Why it does not gate: capsule appends are contractually non-gating (`doc/spec/features/feature-capsule.md` §producers), and DoD-4's actual condition — one delivery commit with the ticket's exact subject — is fully provable from `git log --format=%s origin/main-tools..HEAD`, which is what the test plan and `dod_check` will use. No done-condition is left unprovable.
   Suggested remediation target phase: specification (one cell), if the spec is touched again — drop "plus the capsule's recorded commit event" or mark it explicitly supplementary, and mirror the wording in test-plan §3.4.
   Suggested fix: state DoD-4 evidence as the branch commit log; treat any capsule disclosure as optional corroboration.

2. **[nit] cross_artifact_consistency** — `chg-GH-322-spec.md` §17.1 DoD-2 evidence cell says the document "still parses", while TC-PRIV-003 (v1.1) and test-plan §3.4 now make `delivery-os lint GH-310` the authoritative step.
   Gap: not contradictory (`conforms` implies valid YAML, and running the lint also proves parsing), but the spec's evidence sentence no longer names the strongest check the test plan prescribes.
   Suggested remediation target phase: test_planning (pair with observation 1 on the next revision).
   Suggested fix: name `delivery-os lint GH-310` in the DoD-2 evidence cell.

3. **[nit] plan_coverage** — `chg-GH-322-plan.yaml` obligation 1.5 still ends at "the file still parses as YAML", while the plan header binds TC-PRIV-001…TC-PRIV-006 and TC-PRIV-003 v1.1 adds the lint step.
   Gap: a reader executing only the obligation list would run a weaker check than the bound test case. Coverage is preserved by the header's "BOUND: … TC-PRIV-001..TC-PRIV-006" declaration, so this is cosmetic.
   Suggested remediation target phase: delivery_planning (optional).
   Suggested fix: add `delivery-os lint GH-310` (exit 0, `conforms`) to obligation 1.5.

## Decision Routing

- DEC-1 remains change-scoped and correctly recorded in both `chg-GH-322-spec.md` §15 and `chg-GH-322-pm-notes.yaml` `decisions:`; no new decision surfaced by this iteration. Nothing here is precedent-setting and no `doc/decisions/**` record is warranted: the privacy rule, its registry, the gate convention, and the capsule contract are all out of scope and untouched.
- No human input is required: there is no pause flag, and the advisory items are author-side wording with no delivery impact.

## Iteration Notes

- Iteration 2 of a cap of ~3. Both iteration-1 blockers are closed by inspecting the text, not the summary; the three remaining minor/nit items are new or explicitly optional, and none of them can block delivery.
- Remediation introduced no structural damage: no duplicate or renumbered sections, TC/AC/DoD counts still reconcile, the plan still validates (`readyForDevelopment=true`), both pm-notes documents still lint `conforms`, the change folder carries no absolute user path, and the branch diff still contains only this change folder.
- The technical path remains executable as written: one token, one line, one pre-existing file, with 17 of 18 invariant checks already green and the single violation provably cleared by the substitution the plan prescribes.
