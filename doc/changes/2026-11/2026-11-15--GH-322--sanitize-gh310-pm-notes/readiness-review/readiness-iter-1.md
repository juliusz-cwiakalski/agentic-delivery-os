# Readiness Review Iteration 1

Verdict: **NOT_READY**
Work Item: GH-322
Date: 2026-11-15
Pause Required: **no** — both blocking findings are author-side text fixes (no human decision needed)

Artifacts verified (read-only, against the text): `chg-GH-322-spec.md` v1.0, `chg-GH-322-test-plan.md` v1.0, `chg-GH-322-plan.yaml` revision 1.0, `chg-GH-322-pm-notes.yaml`; source ticket juliusz-cwiakalski/agentic-delivery-os#322 (read via `gh`); affected artifact `doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/chg-GH-310-pm-notes.yaml`; `AGENTS.md`; `doc/guides/{definition-of-ready,definition-of-done,change-lifecycle}.md`; `doc/spec/features/{feature-pm-notes-lint-and-phase-transitions,feature-plan-schema,feature-capsule}.md`; `packages/core/src/contracts/{plan,commit}.ts`; `packages/core/src/domain/commit-staging.ts`; `packages/adapters/src/io/privacy-rules.ts`; `scripts/checks/privacy-literals.ts`; `.github/workflows/ci.yml`; `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`, `lesson-2026-003-pm-notes-born-gate-conformant.md`. No source, spec, test-plan, plan, or pm-notes file was modified; zero git operations.

## Facet Summary

| Facet | Result |
|---|---|
| spec_completeness | PASS (every ticket requirement — sanitize the one evidence literal, verify with the invariant, one-phase plan, exact commit subject, PR to `main-tools` left open — is covered) |
| ac_quality | **FAIL** (AC-F1-5 is unsatisfiable as written; see F-1) |
| plan_coverage | PASS (phase 1 obligations 1.1–1.8 own all five ACs; `plan validate GH-322` → `verdict=valid`, `readyForDevelopment=true`) |
| test_traceability | PASS (5/5 ACs traced: AC-F1-1→TC-PRIV-001, AC-F1-2→002, AC-F1-3→003, AC-F1-4→004, AC-F1-5→005/006; NFR-1..NFR-5 and DM-1 all mapped; 6 TCs = 6 index rows = 6 detail headings = 6 §7 rows; no orphan TC) |
| cross_artifact_consistency | **FAIL** (AC-F1-5 and NG-2 contradict the in-scope edit and the test plan's own expected outcome; see F-1) |
| decision_capture | PASS (DEC-1 is change-scoped and recorded in both spec §15 and pm-notes `decisions:`; no precedent-setting or system decision is introduced — the privacy rule, registry, and gate convention are explicitly untouched) |
| system_spec_consistency | PASS (no contradiction with `doc/spec/**`: pm-notes content is not declared immutable, `lint` is the conformance surface and the document still conforms, capsule events are unaffected, the delivery-side staging rule — declared plan scope ∪ the change folder, tracked files always staged — makes the GH-310 edit stageable, and `^tmp/` is a forbidden commit path so the repository-relative temp root cannot leak into a commit) |
| plan_doc_update_coverage | PASS (phase 7 is declared as "no current-truth change required" with the reason — no documented behaviour, contract, or convention is altered) |
| plan_code_area_coverage | PASS (exactly one concrete file in phase scope; every excluded tree is named in the plan header, so blast radius is explicit and one-line) |
| dod_defined | **FAIL** (the spec contains no change-specific Definition of Done; see F-2) |

## Mechanical Verification (current facts, established at this gate)

- **Red state reproduced exactly once, and it is the only blocker in the failing CI job.** Ran all 18 static checks the `TS repository invariants` job runs (`.github/workflows/ci.yml` lines 230–248): 17 exit 0; `privacy-literals` alone exits 1 with exactly one violation, rule `private.absolute-user-path` at the GH-310 pm-notes line 279, fingerprint `c796b58bf3a81320`, 4074 files scanned. This validates the spec's §12 assumption ("the single reported violation is the only blocker") rather than leaving it as faith.
- **The declared substitution is provably sufficient and non-regressive.** Simulated the exact one-token substitution in memory against the real file: the token occurs exactly once, the file content changes, and unsuppressed generic-rule matches go from one (`private.absolute-user-path` at line 279) to zero. The rule's negative lookahead also clears the repository-relative form, so the substitute cannot re-fire.
- **Scope-discipline facts hold.** Only three `TMPDIR=` assignments exist in the affected file (lines 77, 279, 514); only line 279 is absolute, and the four `$GATE_TMPDIR` mentions the spec cites (77, 409, 514, 531) are present as described. A home-rooted absolute-path scan of the GH-310 folder returns that single line, and the same scan of the GH-322 change folder returns no match — no artifact of this change re-breaks the gate.
- **The artifacts themselves validate.** `lint GH-322` → conforms (variant `full`); `lint GH-310` → conforms; `plan validate GH-322` → valid.
- **Branch state.** The branch is 4 commits ahead of `origin/main-tools` at `c1f0d6fa` (not 3, as stated in the delegation), and the branch diff adds only this change folder's four artifacts. Informational only; no artifact claims a commit count.

## Blocking Findings

### F-1 [major] ac_quality + cross_artifact_consistency — AC-F1-5 and NG-2 forbid the very edit the change must make

- Artifact/location: `chg-GH-322-spec.md` §17 AC-F1-5 ("…and touches **no other ticket's artifacts**"); same file §4.2 NG-2 ("Editing any other change artifact, phase state, or **pm-notes record**"). Contradicted by §7.1 In Scope, by `chg-GH-322-test-plan.md` §5.2 TC-PRIV-006 expected outcome (which explicitly lists `chg-GH-310-pm-notes.yaml` as an allowed changed path), and by plan phase 1 `scope.files`.
- Gap: the change's sole product edit is line 279 of **GH-310's** pm-notes — another ticket's change artifact and another change's pm-notes record. Read literally, AC-F1-5 is unsatisfiable and NG-2 forbids the in-scope edit, so `dod_check` would have to fail the change or silently reinterpret its own acceptance criterion. The test plan meanwhile asserts the opposite of the criterion it claims to cover (AC-F1-5 ↔ TC-PRIV-006). This is the highest-value DoR facet failing: ticket → spec → test-plan → plan do not align on what "in scope" means.
- Suggested remediation target phase: **specification**
- Suggested fix: qualify both statements with the one carve-out that already exists in §7.1 — e.g. AC-F1-5 "…touches no ticket artifact other than the GH-310 pm-notes line named in §7.1 and this change's own folder", and NG-2 "Editing any change artifact, phase state, or pm-notes record other than the GH-310 pm-notes line named in §7.1". No AC intent, test, or plan change follows; TC-PRIV-006 already encodes the corrected reading.

### F-2 [major] dod_defined — the spec defines no change-specific Definition of Done

- Artifact/location: `chg-GH-322-spec.md` — absent (no DoD section or statement anywhere; a search for "done"/"complete" in the spec returns nothing). The AC set is §17; no `§17.1 Definition of Done (change-specific)` exists.
- Gap: `dod_defined` is a hard DoR facet — "delivery cannot start without a clear, testable DoD written into the spec" — and `doc/guides/definition-of-done.md` states every change must define its own DoD, concrete, testable, and traceable to its ACs. Phase 10 (`dod_check`) consumes that change-specific DoD; with none present it can only re-read the ACs, and the facet fails by construction. Repository precedent is uniform, including the smallest docs-only changes (GH-85 carries a one-sentence DoD; GH-302 and GH-313 carry §17.1 with DoD-1..DoD-n), and prior gates recorded `dod_defined: FAIL` for exactly this omission.
- Suggested remediation target phase: **specification**
- Suggested fix: add a short §17.1 with a handful of DoD-1..DoD-n conditions binding what "done" means for this fix: AC-F1-1..AC-F1-5 all satisfied with recorded command output and exit codes; exactly one substituted token on one line with verdicts/counts/hashes/timestamps byte-identical; the GH-322 change folder and the plan contain no absolute user path; one delivery commit with the ticket's exact subject; PR open against `main-tools`. Nothing else needs to change.

## Non-Blocking Observations

- **N-1 [minor] cross_artifact_consistency** — `chg-GH-322-test-plan.md` front matter `links.implementation_plan: N/A — none authored; docs-only one-literal change` is false: `chg-GH-322-plan.yaml` exists and is authoritative, and test-plan §2 does not cite it. Remediation target **test_planning**: point `links.implementation_plan` at `./chg-GH-322-plan.yaml` and add the plan to §2 references. Harmless to execution, but it is a stale claim in the traceability chain.
- **N-2 [minor] test_traceability** — TC-PRIV-003 step (5) settles for "confirm the surrounding YAML still parses". The authoritative conformance surface for a pm-notes document is the read-only lint (`delivery-os lint GH-310`, currently conforming), which also protects against a schema-level regression that plain YAML parsing would miss. Remediation target **test_planning** (and optionally plan obligation 1.5): replace/augment the parse step with the lint command and require exit 0 / `evidence.class: conforms`.
- **N-3 [minor] spec_completeness** — the "accepted gate convention" is attributed to `AGENTS.md` (spec §2.1 and §23, test plan §2/§6, plan header). `AGENTS.md` contains no `TMPDIR` text; the convention is recorded in `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` (and `.ai/rules/bash.md` uses a different temp dir for script tests). The ticket itself uses the same attribution, so this is inherited wording, not an invented claim. Remediation target **specification**: cite the lesson as the source and note the ticket's wording, or drop the `AGENTS.md` citation.
- **N-4 [nit] plan_doc_update_coverage** — the phase-7 "no current-truth change required" verdict and the phase-11 PR posture are declared in plan header prose with an explicit "NOT plan scope" marker, whereas the plan-writer rule asks the final phase to declare release/spec-reconciliation obligations as scope. For a one-phase `lite` plan whose change folder is auto-staged by the commit primitive, prose is a defensible reading and nothing is left unowned; if a future edit touches the plan, echoing the phase-7 verdict in the phase `summary` would make it visible to `plan validate`. Remediation target **delivery_planning** (optional).
- **No other gaps found.** The commit subject in plan obligation 1.8 matches the ticket byte-for-byte; the PR posture (target `main-tools`, left open for merge authority) matches AC-F1-5's first two clauses and the ticket; `defaultLeases: [repo:main-tools]` matches the convention in every recent plan; the "best-effort `pnpm check`" scope matches the ticket's "if feasible"; AC-F1-4's subordinate status to AC-F1-1 is explicit and correct, since `pnpm check` does not itself run `check:privacy-literals`.

## What Makes This READY

Two text edits, both in `specification`, then re-run the gate:

1. F-1: qualify AC-F1-5 and NG-2 with the §7.1 carve-out for the GH-310 pm-notes line.
2. F-2: add §17.1 change-specific Definition of Done binding the five ACs, the invariant verdict, the one-line containment, the commit, and the PR posture.

N-1/N-2 (test_planning) may ride the same revision pass; N-3/N-4 are optional. The technical plan itself is executable as written — no plan or test-design change is required by this verdict.

Alternative route, not taken by default: the spec-level DoD omission could in principle be answered by the recorded triviality override in `chg-GH-322-pm-notes.yaml` (triviality rationale, human approver, date). No such record exists today, so the hard gate applies in full; an override requires explicit human approval and must never be assumed.

## Iteration Notes

- This is iteration 1. No prior readiness record exists in this change folder, so nothing is deduplicated and no finding is marked persistent.
- Verdict is NOT_READY on two major findings. Nothing found makes delivery unsafe: the plan physically covers the required edit and its verification, the substitution is provably sufficient and non-regressive, and scope discipline is airtight (one file, one token, one line, with escalation triggers that name every drift class).
