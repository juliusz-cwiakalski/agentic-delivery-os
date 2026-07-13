# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-110
Date: 2026-07-03
Pause Required: no

## Facet Summary
- spec_completeness: PASS (AC#5 modeled as review flag per DEC-3; one traceability nit)
- ac_quality: PASS (10 runtime ACs are Given/When/Then + testable; AC#5 non-runtime)
- plan_coverage: PASS (phase→AC map complete; all affected components §16 covered)
- test_traceability: FAIL (AC-F2-1/F2-2 "the job runs / fails the PR" verified by manual inspection only)
- cross_artifact_consistency: PASS (DEC-7 AND-semantics consistent across spec/test-plan/plan)
- decision_capture: PASS w/ note (DEC-7 change-scoped; consider TDR — Minor)
- system_spec_consistency: PASS (DM-2 scan set, ci.yml unchanged, marker rule all verified vs source)
- plan_doc_update_coverage: PASS (phase-7 feature-spec handoff explicit)
- plan_code_area_coverage: PASS (file-per-phase mapping; executable-bit catch verified at test-all.sh:88)
- dod_defined: PASS (ACs §17 + rollout §18 serve as testable DoD)

## Findings

1. [Major] test_traceability — test-plan §3.1 (TC-CI-001/002) & §1.2 / spec §17 AC-F2-1, AC-F2-2
   Gap: AC-F2-1 ("when a PR touches a path under the paths: filter, then the job `docs (mermaid validate)` runs") and AC-F2-2 ("when the job runs, then it fails the PR") are *behavioral* claims about the GitHub Actions workflow, but the only verification is manual YAML inspection (`rg` content checks) — explicitly stated in test-plan §1.2 ("Runtime behavior of the CI workflow ... not by triggering a live workflow run"). No schema/action validation runs anywhere: a malformed workflow (bad trigger syntax, wrong `paths:` glob, a step-shell typo, a mis-cased job key, a `permissions:` placement error) would pass inspection yet silently never trigger or never fail the PR. This is exactly the "AC marked covered but the test is inspection-only where a behavior test is needed" silent-pass pattern. The validator's own behavior is well-tested (TC-MMD-001), but the *gate's actual firing* — the entire purpose of AC#2/ticket AC#2 — is unverified behaviorally.
   Suggested remediation target phase: test_planning
   Suggested fix: Add an automated structural validation to TC-CI-001: at minimum `actionlint .github/workflows/docs-mermaid-validate.yml` (and the unchanged `ci.yml` as a regression anchor), plus a parsed-YAML assertion that the `on.pull_request.paths` set, the job id/name, `permissions.contents == 'read'`, absence of `pull_request_target`, and presence of an `mmdc`-install step and a validator-run step with no `continue-on-error`. Optionally a single `act --list`/dry-run to prove the job would be selected for a doc-path change. This moves AC-F2-1/F2-2 from pure manual inspection toward executable verification.

2. [Minor] spec_completeness / system_spec_consistency — spec §8.3 DM-2, §5.1 F-1; plan §2.3
   Gap: The scan-root set DM-2 is the union `{doc, decisions, changes, inception, .ai}` over `.md`, with `.ai/` named wholesale. `.ai/local/` is git-ignored ephemeral scratch yet **contains mermaid blocks** (verified: `.ai/local/inception/inception-process-diagrams.md`, `.ai/local/archive/gh-69/*.md`, etc.). The validator would scan these local-only working files. In CI this is harmless (`.ai/local/` is not checked out), but locally — exactly where the plan promises `test-all.sh` stays green — a developer with `mmdc` installed running TC-BASE-001 could fail on a broken scratch diagram, and the keyword guard semantics are ambiguous over non-shipped content. The intent ("shipped doc surfaces") is not reflected in the scan-root definition.
   Suggested remediation target phase: specification
   Suggested fix: Explicitly exclude `.ai/local/` (and any git-ignored paths) from DM-2, or state that the validator honors `.gitignore`/a denylist. Mirror the exclusion in the CI `paths:` filter rationale.

3. [Minor] spec_completeness — spec §17 E (AC#5) & §18.5
   Gap: The ticket has 5 ACs; spec header claims "Maps 1:1 to the ticket's 5 ACs", but section E provides **no formal acceptance criterion** for AC#5 (it is a prose note pointing to §18 + DEC-3). The DEC-3 modeling (review/release flag, not runtime gate) is the correct call, but traceability still wants an inspectable criterion so DoD/phase-11 can verify it concretely.
   Suggested remediation target phase: specification
   Suggested fix: Add AC-F5-1: "Given the PR is opened by @pr-manager, when the human reviewer reads the PR description, then a CEO-gate review flag is present (change touches scripts/ + .github/)." Trace it to §18.5 / DEC-3. Non-runtime, inspection-only — but explicit.

4. [Minor] test_traceability — test-plan §3.3 NFR-2; TC-CI-001 step 5
   Gap: NFR-2 (CI runtime < 120s wall-clock) is marked "Covered (CI-only)" but TC-CI-001 step 5 only asserts a Chromium-cache step is *present*; no case asserts the runtime threshold or fails on regression. The NFR has no failing assertion anywhere.
   Suggested remediation target phase: test_planning
   Suggested fix: Either demote NFR-2 to an observational KPI (not a covered NFR) or add a CI-step that records wall-clock and document the review cadence; at minimum stop marking it "Covered" — label it "Observed (CI)".

5. [Minor] cross_artifact_consistency / system_spec_consistency — spec §5.1 F-1, §8.3 DM-3, DEC-7; plan F-2; test-plan TC-MMD-008
   Gap: DEC-7/DM-3 call `.ai/rules/diagrams.md` the "single source of truth" for the C4 denylist, while the script hardcodes a *default* denylist that must "mirror" the rule's wording (plan F-2). Two copies with no automated guard against drift: editing the rule's keyword set without the script default (or vice-versa) silently diverges, and TC-MMD-008 only tests override semantics, not default==rule.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a test asserting the script's compiled default denylist equals the C4 keywords extracted from `.ai/rules/diagrams.md` (or have the script read the denylist from the rule file at runtime), so "single source of truth" is enforced, not asserted.

6. [Minor] cross_artifact_consistency — test-plan TC-CI-001 step 1 vs spec §5.1 F-2 / plan §4.1
   Gap: TC-CI-001 step 1 hedges "triggers `on: pull_request` (and push as configured)", but spec F-2 and plan §4.1 specify `on: pull_request` only. Inconsistency on trigger surface. Substantively, a `pull_request`-only gate does not run on direct pushes to `main`/`feat/**` (the existing `ci.yml` *does* run on push) — a coverage asymmetry worth a conscious decision.
   Suggested remediation target phase: specification
   Suggested fix: Pick one trigger model and state it consistently in spec F-2, plan §4.1, and TC-CI-001. If `push` is intended, add `on: push` to F-2; if PR-only, fix the test-plan hedge and record the direct-push gap as an accepted limitation.

7. [Minor] decision_capture — spec §15 DEC-7; pm-notes
   Gap: DEC-7 establishes a repo-wide authoring-guardrail precedent ("the validator, not the agent, enforces GitHub-render-safety at PR time; denylist owned by an `.ai/rules/` file"). PM declined a decision record ("change-scoped ... not system-wide precedent"). That is defensible, but the pattern is reusable across future validators and arguably precedent-setting.
   Suggested remediation target phase: specification
   Suggested fix: Confirm the no-TDR call explicitly, or propose a short TDR under `doc/decisions/**` (via @decision-advisor) capturing "validators enforce render-safety; rule file owns the denylist." Non-blocking.

8. [Nit] spec_completeness — spec §2.1 / Appendix A (mermaid audit counts)
   Gap: Appendix A states `doc/changes/` = 5 files; the live repo now shows 8 (the 5 originals plus this change's own 3 artifacts, which are scanned because `changes/` is a scan root). The "0 C4 in mermaid blocks" baseline claim is *not* affected (verified repo-wide: 0 mermaid fenced blocks contain any C4 keyword), so the green baseline remains feasible — but the count is stale.
   Suggested remediation target phase: specification
   Suggested fix: Refresh the audit counts or annotate them "at intake; grows as change artifacts land — baseline unaffected (0 C4 in blocks)."

## Per-AC Coverage Verdict
- AC-F1-1 → covered (TC-MMD-001/009, behavior, mocked)
- AC-F1-2 → covered (TC-MMD-002, TC-BASE-001)
- AC-F1-3 → covered (TC-MMD-003/004/011)
- AC-F1-4 → covered (TC-MMD-005/006/007/008/012; full DEC-7 2×2 incl. Q2 mmdc-OK+C4→FAIL)
- AC-F2-1 → **gap (Major)** — inspection-only; no behavioral/schema verification the job fires
- AC-F2-2 → **gap (Major)** — same; "fails the PR" never exercised; `ci.yml`-unchanged part covered (TC-CI-002 diff)
- AC-F3-1 → covered (TC-RULE-001)
- AC-F3-2 → covered (TC-RULE-002)
- AC-F3-3 → covered (TC-RULE-003 + distribution guard)
- AC-F4-1 → covered (TC-AGENT-001/002 + CI verify-claude-build)
- AC#5 (DEC-3) → covered as review/release flag; no formal AC (Minor, finding 3)

## Decision-Consistency Check
- DEC-1 (dedicated workflow, ci.yml unchanged) → consistent across spec/test-plan/plan; verified ci.yml is the 70-line 3-job file with no `paths:` filter.
- DEC-2 (.ados-claude regen) → consistent; plan Phase 5 stages source+generated together.
- DEC-3 (AC#5 review flag) → consistent; correctly not a runtime AC.
- DEC-4 (agent set = spec-writer/doc-syncer/bootstrapper) → consistent; exclusion of decision-advisor/editor/meeting-organizer grounded in audit.
- DEC-5 (diagrams.md no marker) → consistent; **verified** DM-2 scan set scans only `.ai/rules/README.md`, not individual rule files.
- DEC-6 (markdownlint non-goal) → consistent; respected (no scope creep).
- DEC-7 (AND-semantics: render + C4 keyword guard) → consistent across spec F-1/DM-1/NFR-5/AC-F1-4, test-plan TC-MMD-005..008/012, plan Phase 2/3. Quadrant-2 regression guard present.
- No inter-decision contradictions found.

## Verified Claims (spot-checks against source)
- `test-all.sh:88` uses `-perm -u+x` → plan's executable-bit catch (Phase 3.1, Flagged F-4) is real and necessary.
- `ci.yml` is the 70-line, 3-job, no-`paths:`-filter file described → DEC-1 baseline accurate.
- `.ai/rules/README.md` carries `ados_distribution: redistributable`; individual rule files (`bash.md`, `installer.md`, `testing-strategy.md`) carry none → DEC-5 accurate.
- Repo-wide mermaid-block scan: **0** blocks contain any C4 keyword → green-baseline keyword portion is feasible today.
- `.ai/rules/bash.md` §10.1–10.6 and §11 exist as referenced → NFR-6 anchors are real.

## Reopen Recommendation
- test_planning — for finding 1 (Major: add actionlint/structural YAML validation for AC-F2-1/F2-2), and findings 4 & 5.
- specification — for findings 2, 3, 6, 7, 8.

Blocker count: 0. Major count: 1 (finding 1) → NOT_READY. Once AC-F2-1/F2-2 gain an executable structural/behavioral verification, the remaining items are Minor/Nit and can be addressed in the same revision pass; a re-run of this gate is expected to reach READY.
