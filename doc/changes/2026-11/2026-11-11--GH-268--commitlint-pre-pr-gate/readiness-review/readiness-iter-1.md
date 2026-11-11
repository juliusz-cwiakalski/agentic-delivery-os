# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-268
Date: 2026-11-11
Pause Required: no

Iteration 1 of the DoR gate. No prior readiness records existed for this change folder; nothing is marked persistent.

Inputs reviewed: ticket `juliusz-cwiakalski/agentic-delivery-os#268` (read via `gh issue view`), `chg-GH-268-spec.md` v1.1 (19 ACs), `chg-GH-268-test-plan.md` v0.2 (40 TCs), `chg-GH-268-plan.yaml` (5 phases), `chg-GH-268-pm-notes.yaml`, plus repository truth: `AGENTS.md`, `.opencode/agent/{committer,pm}.md`, `scripts/install.sh`, `scripts/uninstall.sh`, `scripts/test-all.sh`, `scripts/deliver-ticket.sh`, `scripts/.tests/test-deliver-ticket.sh`, `scripts/checks/{commitlint-authority,prompt-conformance,help-guide-coverage}.ts`, `tests/fixtures/prompt-inventory/lifecycle.json`, `.husky/commit-msg`, `.github/workflows/ci.yml`, `commitlint.config.js`, and the touched `doc/spec/features/*` + `doc/guides/change-lifecycle.md`.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

Structural results that do pass: all 19 ACs appear exactly once in `acCoverage` (12/1/1/1/4 across phases 1–5); all 40 TCs have a declared home or an explicit handoff; every ticket acceptance line is traced in Appendix A; all nine DM-1 rows, DM-2, DM-3, and NFR-1…NFR-10 are traced to at least one TC; the three PM decisions are recorded as DEC-2/DEC-3/DEC-5 with the ticket's "Optional" hook item explicitly honoured; NG-1…NG-7 and §7.2 pins are consistent with AC-NFR8-1 and the confinement TCs.

## Findings

Blocking findings are 1–4.

1. [major] cross_artifact_consistency — `chg-GH-268-plan.yaml`#Phase 2 verification, step 6
   Gap: The check `grep -nE '\bgit[[:space:]]+(rebase|reset|commit[[:space:]]+--amend|push[[:space:]]+--force|filter-branch|reflog[[:space:]]+delete)' .opencode/agent/committer.md .opencode/agent/pm.md` is expected to return no line, but it matches today's untouched repository at `.opencode/agent/committer.md:31` (`Never run \`git add\`, \`git commit\`, \`git reset\`, or any other raw git write command.`). The plan's stated outcome ("no raw rewrite recipe is taught") is therefore false before any edit, the phase cannot reach the green-boundary promise in the ordering preamble, and a delivery agent following it literally could delete a load-bearing non-negotiable that `prompt-conformance`'s negation-exempt rule depends on. The test plan's version of the same check (`TC-PROMPT-003` step 3) is correct ("no line outside a negation sentence"); the plan lost that qualifier.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Adopt the test plan's semantics — either add the negation exemption (`grep … | grep -viE '\bnever\b|\bnot\b|\bmust not\b'`), or assert positively that the only match is the existing prohibition line; never treat a match on line 31 as a violation.

2. [major] cross_artifact_consistency — `chg-GH-268-plan.yaml`#Phase 5 verification, step 3, and `chg-GH-268-test-plan.md`#TC-DOC-001, step 3
   Gap: Both artifacts assert the `/check` and `/check-fix` command rows as `| /check | Run quality gates (no fixes) |` / `| /check-fix | Run quality gates and fix failures |`. The actual rows are `` | `/check` | Run quality gates (no fixes) | `` and `` | `/check-fix` | Run quality gates and fix failures | `` (verified: both greps exit 1 against the unmodified `AGENTS.md:111-112`). AC-F6-2's only automated evidence is therefore unsatisfiable, and a delivery agent could "fix" it by stripping the backticks from `AGENTS.md` — churn in a row the change is supposed to leave untouched.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Quote the literal rows including backticks (or match on `^\| \`/check\` \|`), and align `TC-DOC-001` step 3 to the same literal so the plan and test plan agree with repository truth.

3. [major] system_spec_consistency — `chg-GH-268-plan.yaml`#DELIVERY PINS "Binary resolution is PATH-only" vs `chg-GH-268-spec.md`#§12 Assumptions and `chg-GH-268-test-plan.md`#TC-DOGFOOD-001 step 1
   Gap: The plan pins `command -v commitlint` (PATH-only), and the spec assumes "lanes run the repository's dependency install … so a configured repository normally has the commitlint binary available". That assumption is false for this repository: the workspace binary lives at `node_modules/.bin/commitlint` and is not placed on PATH by `pnpm install` — which is why `.husky/commit-msg` invokes `./node_modules/.bin/commitlint` explicitly and CI invokes `pnpm exec commitlint`. Consequently the invocation the change publishes everywhere (spec F-1 "invoked from the repository root as `./scripts/lint-commit-range.sh [--base <ref>]`", the PM `quality_gates` step, `AGENTS.md`) resolves to DM-1.g on this very repository, and `TC-DOGFOOD-001` steps 1–2 (`./scripts/lint-commit-range.sh --base <delivery base>` → expect PASS) cannot pass. The plan already knows this — its Phase 1 step 7 and Phase 5 step 1 prepend `PATH="$PWD/node_modules/.bin:$PATH"` — so the dogfood evidence command and the documented invocation contract contradict each other, and under the never-waive rule (AC-F6-1) the change would stall at phase 5 with a permanent ERROR. Secondary parity risk: the same PATH-only probe resolved a *sibling checkout's* binary in this environment, so a foreign tool version can silently decide parity (RSK-1, NFR-1).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Pin a probe order that prefers the repository's own declared CLI (`./node_modules/.bin/commitlint` when the workspace manifest declares `@commitlint/cli`) and falls back to PATH, keep the PATH-scrubbed absence case working (`TC-COMMITLINT-008` fixtures contain no `node_modules`, so the pin does not weaken it), and state the published invocation as the one that actually works; alternatively correct spec §12's assumption and make the PATH/pnpm-exec prefix part of the documented invocation in the spec, plan, prompts, and `AGENTS.md` alike.

4. [major] plan_doc_update_coverage — `chg-GH-268-spec.md`#Appendix C (rows 1–3) and `chg-GH-268-plan.yaml`#Phase 5 scope vs `chg-GH-268-test-plan.md`#TC-DOC-003
   Gap: Phase 4 adds `scripts/lint-commit-range.sh` to `ADOS_DELIVERY_SCRIPTS`, but no artifact registers the documentation that enumerates the delivered set. `doc/spec/features/feature-autonomous-delivery.md` states it three ways — the F-1 sentence listing the delivered scripts (line 26), the delivered-file table (lines 176–190), and an explicit blockquote "Install inventory … registers `opencode-session.sh`, `deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`, and `pm-liveness.sh` in `ADOS_DELIVERY_SCRIPTS`" (lines ~193–197). All three become factually incomplete at phase 4. Appendix C row 2 assigns that page only "the resume-sync instruction shape and its assertion", and `TC-DOC-003` asserts only the instruction shape, the marker, and `related_changes` — so the drift (RSK-6) is unregistered and untraced.
   Suggested remediation target phase: specification
   Suggested fix: Add an Appendix C row for the autonomous-delivery page's delivered-file table and install-inventory statement (owner: system_spec_update), and mirror it in the plan's phase-5/phase-7 handoff list and in `TC-DOC-003` (one assertion that the gate appears in the delivered-file table and the install-inventory sentence).

5. [minor] test_traceability — `chg-GH-268-test-plan.md`#TC-PROMPT-003, step 2
   Gap: The step asserts that `.opencode/agent/committer.md` "contains no `git add` and no `git commit`". Both literals are present today at line 31 inside a prohibition, and the inventory check that actually pins them (`tests/fixtures/prompt-inventory/lifecycle.json` → `forbidden`, evaluated through `prompt-conformance.ts`'s negation-exempt `firstVisibleOccurrence`) is satisfied *because* they are negated. A literal reading would fail on an untouched file and invite deletion of the rule instead of the recipe.
   Suggested remediation target phase: test_planning
   Suggested fix: Restate the step as "no non-negated occurrence (the scan's negation exemption)", and make the mechanical evidence `pnpm check:prompt` exit 0 rather than a raw `grep -c` on the literal.

6. [minor] plan_code_area_coverage — `chg-GH-268-plan.yaml`#Phase 1 scope/verification
   Gap: `scripts/test-all.sh` discovers suites with `find … -name 'test-*.sh' -perm -u+x`, and every existing suite is tracked `100755`. Phase 1 creates `scripts/.tests/test-lint-commit-range.sh` but never requires the executable bit, and its verification runs `bash scripts/.tests/…` (which passes regardless). Phase 4's `bash scripts/test-all.sh` would then report "all tests passed" while silently omitting the change's primary suite — the same silent-skip failure mode the change exists to eliminate.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add "committed mode 100755 (test-all.sh discovery requires `-perm -u+x`)" to Phase 1's scope/verification, and assert it (`test -x scripts/.tests/test-lint-commit-range.sh`).

7. [minor] cross_artifact_consistency — `chg-GH-268-test-plan.md`#front matter and `chg-GH-268-plan.yaml`#SOURCES
   Gap: The test plan still declares `implementation_plan: null   # awaited: ./chg-GH-268-plan.yaml` even though the plan exists and references the test plan as its source, and the plan cites the test plan as "v0.2" while the test plan carries no `version` field. Cross-linking is one-directional.
   Suggested remediation target phase: test_planning
   Suggested fix: Set `implementation_plan: ./chg-GH-268-plan.yaml` (and add `version: 0.2` if the plan is to keep citing it) when the test plan is next touched.

8. [nit] test_traceability — `chg-GH-268-test-plan.md`#§3.1, AC-F3-3 row
   Gap: AC-F3-3 (missing binary → error; no configuration → skip) is mapped to `TC-COMMITLINT-007`, `-008`, and `-009`, but `-009` covers invalid configuration / execution failure (AC-F3-5), not this criterion. The extra mapping over-claims coverage and blurs the DM-1.g vs DM-1.h boundary.
   Suggested remediation target phase: test_planning
   Suggested fix: Drop `TC-COMMITLINT-009` from the AC-F3-3 row (it is already correctly mapped to AC-F3-5).

9. [minor] system_spec_consistency — `chg-GH-268-spec.md`#AC-F4-1 + `chg-GH-268-test-plan.md`#TC-PROMPT-001 step 5 vs `.opencode/agent/committer.md`#non_negotiables
   Gap: The criterion and its TC require the committer prompt to state both remediation modes, but the committer's own non-negotiables are "never … rewrite history", "never compose a commit message by hand", and the primitive owns the message. The artifacts never say which sentence reconciles the two (who performs the reword, and that the committer only reports the contract). An implementer must invent that reconciliation, and `@reviewer` can legitimately read the result as a self-contradicting prompt.
   Suggested remediation target phase: specification
   Suggested fix: Add one sentence to F-4/AC-F4-1 assigning ownership — the committer states the contract as the constraint it reports and never rewrites; the PM owns choosing and executing the remediation mode — and carry that wording into `TC-PROMPT-001` step 5.

10. [nit] decision_capture — `chg-GH-268-spec.md`#§14 OQ-1 and DEC-1/DEC-4
    Gap: OQ-1 says "Decision needed: consult `@decision-advisor`", and DEC-1/DEC-4 establish a standing principle ("a local gate may never be stricter or looser than the authority") that future gate work will cite. It is captured only in the change's decision log, not routed as a decision record.
    Suggested remediation target phase: specification
    Suggested fix: Have `@pm` route the parity principle to `@decision-advisor` as a technical decision record (system-level, precedent-setting); OQ-1 itself may stay open and non-blocking as recorded.

## Gate Result

NOT_READY. Delivery is blocked. Findings 1–4 are correctness defects in the artifacts' claims about the repository itself — two unsatisfiable verification greps, one invocation contract that cannot reach PASS on this repository (which would stall phase 5 under the never-waive rule), and one unregistered documentation-drift obligation created by the distribution phase.

Routing: reopen `delivery_planning` for findings 1, 2, 3, and 6; `specification` for findings 4, 9, and 10; `test_planning` for findings 5, 7, and 8 (finding 2's `TC-DOC-001` literal is the test-plan mirror of the plan defect and must land with it). No human input is required, so no pause is set; `doc/guides/definition-of-ready.md` and the prompt DoR remain the authority, and this review authored nothing but this record.
