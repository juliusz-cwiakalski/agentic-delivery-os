# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-171
Date: 2026-10-29
Pause Required: no

Reviewer: @readiness-reviewer (adversarial DoR gate, local mode)
Inputs: issue #171 body + owner comment 2026-10-29 (fetched live via `gh`), chg-GH-171-spec.md (465e76d), chg-GH-171-test-plan.md (1de6e06), chg-GH-171-plan.md (666fc18), chg-GH-171-pm-notes.yaml, ADR-0003 (C-3/DEC-8), AGENTS.md, `.ai/rules/testing-strategy.md`, current tree @ 32784af + branch commits. No prior readiness records (iteration 1).

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [critical] cross_artifact_consistency — chg-GH-171-test-plan.md §4.1 (scope class 5 row, "Delivered-state rule"), §8.2 A-T2, TC-BRANDING-008 steps 4–5, TC-BRANDING-009 step 6; chg-GH-171-plan.md D4, tasks 3.1, 3.2, 5.3, 6.1
   Gap: The docs-scope semantics are anchored to the **moving PR base** (`--base origin/main-tools`, "docs added versus base") with a bijection rule ("every `newUserFacingDocs` entry corresponds to a doc actually added versus base; an orphan entry, or an entry naming a pre-existing corpus doc, fails" — TC-BRANDING-008 step 5; plan task 3.2 "fail naming any registered orphan"). Two guaranteed failures follow from the repository's actual CI contract (verified: `.github/workflows/ci.yml` `on.push.branches: [main, main-tools, feat/**, fix/**]` — the new `ts-forbidden-literals` job inherits these triggers):
   (a) **Post-merge self-break.** After GH-171 merges, any run on `main-tools` (or `main`, or any successor branch based on it) computes an empty added-vs-base set while `registered` still contains `doc/guides/rename-drill.md` — which is now "a pre-existing corpus doc" relative to the new base. By the artifacts' own wording, the meta-check fails. Main-tools goes red immediately after merge and every subsequent delivery (GH-172+) fails the scan locally and in CI until an undocumented manual registry hack.
   (b) **Silent scope decay.** Even if the orphan rule were dropped, class-5 scope = "added versus base ∧ registered" means a new doc leaves scan scope the moment its PR merges. A seed literal added to `rename-drill.md` in any later PR escapes the scan — permanently degrading AC-F4-2's five-class coverage to four and contradicting ticket AC-2 ("fails CI on any name literal outside the allowlist") for new user-facing docs.
   The intent (DEC-8 scope-of-claim: new docs in scope permanently; pre-existing corpus out) requires **stable, baseline-anchored membership**, not PR-relative membership.
   Suggested remediation target phase: test_planning + delivery_planning
   Suggested fix: Anchor "new" to a fixed corpus baseline recorded in the registry itself (e.g., `corpusBaseline: 32784af` — the last pre-scan commit). Class-5 scope = docs under the user-facing roots (`doc/**` minus `doc/changes/**`, `doc/decisions/**`) that are absent at `corpusBaseline`, whether added in this PR or any earlier one; `registered` membership is permanent once added; the meta-check asserts (docs added-vs-baseline ⊆ registered) ∧ (registered ⊆ docs present in the tree and absent at baseline). Update test-plan §4.1/A-T2/TC-BRANDING-008 steps 4–5/TC-BRANDING-009 and plan D4/tasks 3.1–3.2 accordingly, and add a mutation proving a *previously merged* registered doc containing a seed literal still fails (the scope-decay negative). Spec Appendix B may optionally gain the one-clause anchor definition, but the spec's delegated-mechanics wording (§14) does not require reopening specification.

2. [minor] cross_artifact_consistency — chg-GH-171-test-plan.md TC-BRANDING-020 step 2 vs chg-GH-171-plan.md D6
   Gap: TC-BRANDING-020 step 2 asserts the drill doc "declares its distribution class in frontmatter (`ados_distribution: redistributable` for `doc/guides/**`)"; plan D6 binds `ados_distribution: internal` at `doc/guides/rename-drill.md`. Executed literally as written, TC-BRANDING-020 fails against the plan's bound value. The plan flags the deviation and the assertion *target* (a valid marker + `test-doc-distribution.sh` green) is unchanged, but the test plan text must not contradict the bound value. Verified mechanically: `internal` is a valid enum per the guard (`VALID_ENUM_RE`), `install.sh` derives the guide install set from the marker (only `redistributable` installs — no `install.sh` registration is needed for the drill doc), and the D6 precedents (`tools-convention.md`, `adding-tool-support.md`, `ados-tools-system-dependencies.md`) are indeed `internal`.
   Suggested remediation target phase: test_planning
   Suggested fix: Reword TC-BRANDING-020 step 2 to "declares a valid `ados_distribution` marker (bound by the delivery plan: `internal` for the rename drill) and `bash scripts/.tests/test-doc-distribution.sh` passes".

## Advisory notes (non-blocking, do not affect the verdict)

- A1 (accepted residual, recommend owner ack at PR): D1's reserved case — a fully lowercase embedding (`myados`-class) escapes the delimiter scan in **all** scope classes; the GH-170 substring scan caught these in `.gitignore` only. The delta is honestly recorded (D2, RSK-2/RSK-T1) and is offset by five-class coverage; it is nonetheless a small C-8-adjacent relaxation vs the old `.gitignore` behavior.
- A2: DEC-8's "build-time define supplies the compile-time default" is designated (spec F-1/DEC-1) but not implemented in M0-S2 (no build target exists). Correct for now; the freeze change must wire it or the fail-closed resolver remains the only entry channel.
- A3: D6 `internal` for the drill doc is defensible (maintainer-facing operational procedure; mechanics verified). One-word, guard-neutral flip if the owner prefers redistribution — confirm at PR review alongside TC-BRANDING-026.
- A4: The exactly-once warning semantics rely on the factory/default split (per-instance vs per-process). The default instance carries the production "per process" guarantee; TC-BRANDING-014 step 4's child probe is the authoritative test. During delivery, bind §4.3's "injects a synthetic environment record" wording so the child probe exercises the **default process-scoped instance** via spawn-time environment control, not only factory injection.
- A5: `DELIVERY_OS_WORKING_NAME` verified: no product token, no `ADOS_` legacy-prefix collision, no existing-variable collision in the repo; it is the only new environment variable and is edge-owned (absent from branding and the adapter).

## Verification notes (claims checked against the tree, all confirmed except Finding 1)

- Current state: branding stub (4-field local `BrandIdentity`), contracts = `Result` only, legacy placeholder, `#contracts` alias present — spec §2.1/pm-notes accurate.
- Existing rules verified with registered fixtures: `subpath-adapters-core-branding`, `tier-branding-only-contracts`, `ambient-env-branding`, `ambient-globals-neutral-tiers` (fixture registry + temp-workspace harness); `runtime-apis-confinement` allows `packages/adapters/src/legacy/` — D8/D9 hold.
- CI contracts verified: 7 `BASH_JOBS`, 15 `TS_JOBS`, additions-only ci.yml diff rule, wiring rule satisfied by a root `package.json` script (Phase 3 per-commit green holds), `ci-bindingness` auto-covers every `ts-*` job, aggregate `check` = exactly five steps, `script-surface` permits extra named scripts.
- Scan-green-at-base claim verified: zero delimiter-matched `ados`/`ADOS_`/`~/.ados` tokens in `packages/**`, root manifests, root workspace files, `.gitignore`; zero `ADOS_*` in `.github/workflows/**`.
- ignore-rules.ts section structure matches D2 exactly (token loop is section 2; substring, case-insensitive, non-comment lines only — the recorded coverage delta is accurate); the four coverage classes, glob, rename simulation, and git probes are separable and survive.
- Content inventory: `src/branding/index.ts` and `src/legacy/index.ts` already inventoried; current policy is the global types-only allowlist — plan tasks 2.7/4.6 (per-file executable allowlist) are the correct deliberate extension.
- Doc-distribution mechanics: marker valid-enum includes `internal`; guides' install set is marker-derived (no hand-list, no `ADOS_DELIVERY_*` registration needed); `doc/documentation-profile.md` absent (engineering-repo default, no bearing here).
- Ticket fidelity: all issue-body tasks + the owner's binding comment are covered; no over-delivery found (12-value set, scan, legacy adapter, telemetry name, drill doc, override seam = the body; AC-F6-1/AC-F7-1 verify body tasks; type-level-only `delivery.metric.v1` reservation is informational). No candidate/public names in any artifact; legacy tokens appear only in DEC-8 framing.
- Traceability: 13/13 spec ACs, 4/4 ticket ACs, 26/26 TCs slotted to phases; per-phase test commands present; per-commit green verified for all seven phase boundaries (modulo Finding 1, which fires only after merge).
