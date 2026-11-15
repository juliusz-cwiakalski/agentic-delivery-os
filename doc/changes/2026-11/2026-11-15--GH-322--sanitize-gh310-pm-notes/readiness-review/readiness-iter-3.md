# Readiness Review Iteration 3

Verdict: **READY**
Work Item: GH-322
Date: 2026-11-15
Pause Required: **no**
Supersedes: `readiness-review/readiness-iter-2.md` (READY, one open advisory) and, transitively, `readiness-review/readiness-iter-1.md` (NOT_READY: F-1, F-2)

Artifacts verified against the text (read-only; zero git operations of my own): `chg-GH-322-spec.md` v1.2, `chg-GH-322-test-plan.md` 1.2, `chg-GH-322-plan.yaml` revision 1.1, `chg-GH-322-pm-notes.yaml`; ticket juliusz-cwiakalski/agentic-delivery-os#322 (re-read via `gh`, OPEN, `bug`/`change`, milestone M2); the commit primitive (`packages/core/src/domain/{commit-message,commit-skeleton,commit-act}.ts`, `packages/core/src/contracts/commit.ts`, `packages/cli/src/commands/commit.ts`, `packages/cli/src/edge.ts`, `commitlint.config.js`); `scripts/checks/privacy-literals.ts`; `doc/spec/**` capsule contract. No artifact was modified; the only write is this record.

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

## The Remediation Under Test (verified, not accepted on report)

**Root cause reproduced in source, not just quoted.**
- `templateSubject` renders `${skeleton.type}(${skeleton.scope}): ${summary}` (`commit-message.ts:143`); `resolveCommitSkeleton` sets `scope = ref` and `type = commitTypeForPhase(phaseId)` (`commit-skeleton.ts:33`), and `COMMIT_PHASE_TYPES.delivery = "feat"` (`contracts/commit.ts:70`). So a delivery-phase commit is structurally `feat(GH-322): <summary>` — the ticket's `fix(` type is not reachable through this path at all, and no artifact now claims it is.
- `validateCommitMessage` rejects any `TRACKER_REF` other than `skeleton.ref` (`commit-message.ts`, invented-tracker rule). The ticket's pinned subject contains `GH-310` → structurally unlandable. Confirmed independently.
- `delivery-os commit --help` shows `commit [<ref>] [--phase <phase>] [--dry-run]` only — no message override. `--phase <phase>` "Complete the lifecycle phase atomically with the commit", which is the atomic single-commit surface DoD-4 and obligation 1.8 require.
- The old failure modes are exactly as described: standalone template `update <topPath>` picks the GH-310 path (foreign ref → refused); the previous capitalised phase summary tripped `subject-case` from `config-conventional`.

**(a) DoD-4 is satisfiable and testable as written.** A non-destructive `commit GH-322 --phase delivery --dry-run` was re-run at this gate: exit `0`, `messageSource: "template"`, `subject` = `feat(GH-322): sanitize the recorded absolute gate temp root`, `stagedFiles` = the change folder's pm-notes, `safety.completed: true`. The dry-run returns before staging/commit (`commit-act.ts:306`), so it mutated nothing. Independent arithmetic: the subject is 59 characters (`COMMIT_MAX_SUBJECT_CHARS = 72`), lowercase-initial, tracker-free apart from `GH-322`, and `scope-case` accepts `GH-322` (upper-case is in the config-conventional list). The same validation path that previously refused the message now passes, so this is a measured capability, not an inference. DoD-4's own condition ("exactly ONE delivery commit … whose subject the primitive produces from the plan phase summary … landing both the sanitized GH-310 pm-notes line and the phase state atomically") is producible by `commit GH-322 --phase delivery` and readable from `git log --format=%s`. **Satisfiable.**

**(b) Spec / plan / test plan agree on the subject.**
- Plan revision 1.1 `phases[0].summary` = `sanitize the recorded absolute gate temp root` (lowercase, tracker-free) — the single subject source.
- Spec v1.2 DoD-4: "subject the primitive produces from the plan phase summary — a conventional `feat(GH-322): <summary>` subject that carries no tracker reference other than `GH-322`"; §18: "whose subject the primitive derives from the plan phase summary as `feat(GH-322): …`".
- Test plan 1.2 §3.4 DoD-4 and TC-PRIV-005 step (3)/expected outcome instantiate the same string, cite the plan revision 1.1 summary as its source, state 59 chars against the 72 cap, and name both `git log --format=%s origin/main-tools..HEAD` and `git log --format=%s -1 <delivery sha>`.
- No artifact still requires the pinned `fix(GH-322): sanitize absolute user path in GH-310 pm-notes` subject. The only surviving occurrences are the pm-notes decision that explains its rejection and the two revision-log rows — both historical, neither an obligation.
- The derived-string instantiation is mutually exact: plan summary → spec `<summary>` → test plan's literal string, and the dry run reproduces that literal byte-for-byte.

**(c) No new inconsistency introduced; nothing else drifted.** The remediation diff (commit `43fdc505`) touches exactly four locations: plan header + obligation 1.8/1.9 + phase summary/scope comment, spec DoD-4 row + §18 + history row, test-plan §3.4 DoD-4 row + TC-PRIV-005 steps/outcome + §7 row + revision-log row, plus the pm-notes. Counts and numbering re-established at this gate: spec headings 1–25 in order with §17.1 between §17 and §18; test plan 1–10 with §3.4 between §3.3 and §4; 5 ACs ↔ 5 §3.1 rows ↔ all traced; 6 TCs = 6 index rows = 6 detail headings = 6 §7 rows; §3.4 carries 5 DoD rows matching spec DoD-1…DoD-5. `plan validate GH-322` → `verdict=valid`, `tier=lite`, `readyForDevelopment=true`; plan YAML parses with one phase (id 1, kind delivery, the expected summary, the single GH-310 scope file). `lint GH-322` → `evidence.class: conforms`; `lint GH-310` → `conforms`; `bun test tests/checks/doc-conformance.test.ts` → 11 pass / 0 fail. Home-rooted absolute-path scan of the whole change folder (including this file) → no match. `phase list GH-322` shows `dor_check` properly reopened (`started` set, `completed: null`) — the gate is running under valid phase state.

**(d) The rest of the iteration-2 PASS still holds.** AC-F1-5 / NG-2 still carry the §7.1 carve-out and match TC-PRIV-006 verbatim; TC-PRIV-003 still makes `delivery-os lint GH-310` the authoritative conformance step with YAML parse demoted; the `.ai/memory/lessons/lesson-2026-001-…` attribution is still the only gate-convention citation; §17.1 still binds every DoD row to a plan obligation or a lifecycle phase and still refuses to claim evidence; plan scope is still the single GH-310 file; the phase-7 "no current-truth change required" verdict is still stated (header prose).

**State of the tree, as asked.**
- Working tree: exactly one modified path, `chg-GH-322-pm-notes.yaml`, and the whole diff is `dor_check: { started: null, completed: 2026-11-15T09:17:07.301Z } → { started: null, completed: null }` — the phase-state reopen write, nothing else.
- Product edit intentionally **not** applied: `git diff` over the GH-310 change folder is empty and line 279 still reads `TMPDIR=/home/<operator>/tmp…`. Re-running `bun run scripts/checks/privacy-literals.ts` still reproduces the red state — exit `1`, one violation, rule `private.absolute-user-path`, GH-310 pm-notes:279, fingerprint `c796b58bf3a81320`, 4076 files scanned. The declared assumption in spec §12 still holds and the delivery phase must (and does) own the edit.
- Branch: 9 commits ahead of `origin/main-tools`, all limited to this change folder (spec, plan, test plan, pm-notes, iteration-1 and iteration-2 records). No product, prompt, workflow, or system-spec file in the range.
- Baseline drift, unchanged in character: artifacts cite 4070 scanned files (clarify_scope snapshot) while the check now reports 4076 because artifacts were added since. The binding criterion (exit 0, 0 violations) is untouched; no done-condition depends on the number.

## Findings (all non-blocking; none reopens a phase)

1. **[nit] cross_artifact_consistency** — `chg-GH-322-test-plan.md` §2 References, plan citation.
   Gap: §2 still cites the plan as "single delivery phase, obligations 1.1–1.8"; plan revision 1.1 added obligation **1.9** (the anti-hand-edit/subject-rewrite caution that DoD-4 indirectly relies on), so the range is now short by one. Purely a citation range; no TC binds 1.9 and the plan's own obligation list is complete.
   Suggested remediation target phase: test_planning (one range token, pair with the next revision).
   Suggested fix: change "obligations 1.1–1.8" to "1.1–1.9".

2. **[nit] decision_capture** — `chg-GH-322-spec.md` §15 Decision Log.
   Gap: the ticket-to-artifact deviation is recorded where it must be for routing (`chg-GH-322-pm-notes.yaml` `decisions:`, plus DoD-4 and §18 prose) but not as a formal spec decision: §15 still holds only DEC-1. The recorded rationale also speaks only of the *description*; it does not acknowledge that the type changes `fix → feat`, which is forced by `COMMIT_PHASE_TYPES.delivery` and is visible to any reader of `git log`. Routing itself is correct — no `doc/decisions/**` record is warranted for a change-scoped, mechanically forced deviation.
   Suggested remediation target phase: specification.
   Suggested fix: add DEC-2 ("land the primitive-derived `feat(GH-322): …` subject; type and description are derived, deviation from the ticket's pinned subject is mechanical") and point DoD-4/§18 at it.

3. **[nit] test_traceability** — `chg-GH-322-test-plan.md` §3.4 DoD-4 / TC-PRIV-005 step (3).
   Gap: DoD-4's condition includes "landing the sanitized line and the delivery phase state atomically", but the prescribed evidence reads only the subject (`git log --format=%s`). Atomicity is inferable from "exactly one commit" plus the phase transition, yet nothing shows the two files sitting in that one commit. Not contradictory — under-evidenced.
   Suggested remediation target phase: test_planning.
   Suggested fix: add `git show --stat <delivery sha>` to step (3) and to the expected outcome (GH-310 pm-notes + this change's pm-notes in one commit).

4. **[nit] plan_coverage** — `chg-GH-322-plan.yaml` obligation 1.5 (persistent from iteration 2).
   Gap: ends at "the file still parses as YAML" while TC-PRIV-003 makes `delivery-os lint GH-310` (exit 0, `conforms`) the authoritative conformance surface. Coverage is preserved by the header's `BOUND: … TC-PRIV-001..TC-PRIV-006`, so an obligation-only reader runs a weaker check than the bound case.
   Suggested remediation target phase: delivery_planning (optional).
   Suggested fix: add `delivery-os lint GH-310` (exit 0, `conforms`) to 1.5.

5. **[nit] cross_artifact_consistency** — `chg-GH-322-spec.md` §17.1 DoD-2 evidence cell (persistent from iteration 2).
   Gap: the cell still says the document "still parses", while test-plan §3.4 DoD-2 names `delivery-os lint GH-310` conforms. Not contradictory (`conforms` entails parse), just weaker wording than the test plan prescribes.
   Suggested remediation target phase: specification (pair with finding 2).
   Suggested fix: name `delivery-os lint GH-310` in the DoD-2 evidence cell.

6. **[minor, advisory — persistent from iteration 2] cross_artifact_consistency** — `chg-GH-322-spec.md` §17.1 DoD-4 evidence cell.
   Gap: the row was rewritten for satisfiability and still carries "the capsule's recorded commit event agrees". `createCapsuleProducerPort` (`packages/cli/src/edge.ts:548`) has no production call site, `createProductionCommitRuntimeOptions` passes no capsule port, and there are **zero** `events.jsonl` files under `doc/changes/**` (all 49 change folders checked). So that corroborant will not exist for GH-322. This is the same defect class the remediation cleared for the subject — an unproducible evidence clause left inside the one row being fixed.
   Why it still does not gate, stated honestly: the capsule producer is contractually **non-gating and disclosure-only** ("the port keeps the per-command surface non-gating and disclosure-only", `edge.ts`; `doc/spec/features/feature-capsule.md`), and "agrees" has no content when no event exists — absence is not disagreement. DoD-4's actual condition is fully provable from `git log`, which is what TC-PRIV-005 step (3) and `dod_check` read. No delivery action and no done-condition depends on the capsule.
   Suggested remediation target phase: specification (one clause, whenever the spec is next touched).
   Suggested fix: delete "the capsule's recorded commit event agrees" or restate it as optional corroboration.

7. **[nit, process-evidence accuracy] decision_capture** — `chg-GH-322-pm-notes.yaml` note "BLOCKER RESOLVED (delivery attempt 1)".
   Gap: it reports reopening `delivery_planning` and `specification`, but `phase list GH-322` shows both still completed at their original stamps (09:27:08 / 09:26:50) with no reopen recorded — only `dor_check` carries the reopen shape (`completed: null`), and the reopen machinery works (`verify-change.ts:216`), so the two artifact revisions landed while those phases were marked complete. Artifact readiness is unaffected; the phase registry, not the DoR gate, owns this. Worth correcting so the capsule/registry record is truthful, and because the retro note about "an extra artifact cycle" implies a reopen trail that does not exist.
   Suggested remediation target phase: specification (pm-notes evidence wording; the phase state itself is `phase`-owned and must be corrected through the `phase` family, never by hand-editing).
   Suggested fix: reword to "revised under the re-run dor_check gate; delivery_planning/specification were not reopened", or reopen/complete them through `phase` if the audit trail is wanted.

## Decision Routing

- The commit-subject deviation is change-scoped (tooling-forced, reversible, no contract or convention change) and is correctly recorded in change docs (`pm-notes` `decisions:` + spec DoD-4/§18). No `doc/decisions/**` record is warranted; nothing here is precedent-setting — the privacy rule, its registry, the gate convention, the phase-type table, and the capsule contract are all out of scope and untouched.
- No human input required: no pause flag, no open question (spec §14, test-plan §8, pm-notes `open_questions: []`), and every remaining item is author-side wording with no delivery impact. The ticket's pinned subject cannot be satisfied by any in-scope action, so there is nothing for a human to choose between.

## Iteration Notes

- Iteration 3 of a cap of ~3 — final. Iteration-1 blockers (F-1, F-2) stay closed; iteration-2's READY is reaffirmed, now on a *measured* subject rather than a plausible one.
- The substantive change since iteration 2 is an improvement in evidence class: the subject requirement moved from "ticket-exact" (unlandable, and iteration 2 read it as compliant without ever asking whether the primitive could emit it) to a primitive-derived string that has been produced by the primitive itself. The artifacts now describe the commit that will actually exist.
- Nothing in the remediation damaged structure: no duplicate or renumbered sections, AC/TC/DoD counts reconcile, plan validates, both pm-notes documents lint `conforms`, doc-conformance is 11/11, and the change folder carries no absolute user path.
- Delivery remains executable as written: re-apply the single token substitution, `commit GH-322 --phase delivery` (one atomic `feat(GH-322): sanitize the recorded absolute gate temp root` commit), then push and open the PR against `main-tools` left open. The red state currently in the tree is the *intended* pre-delivery state, not a regression.
- DoR verdict: **READY**. Delivery may start.
