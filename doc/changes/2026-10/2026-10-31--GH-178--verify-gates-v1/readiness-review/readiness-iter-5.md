# Readiness Review Iteration 5

Verdict: READY
Work Item: GH-178
Date: 2026-10-31
Pause Required: no

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

Blocking findings: 0. Findings below are advisory (2 minor, 4 nits), each marked `Blocking: no`; none fails a facet. The verdict contract knows only `READY | NOT_READY`, so these advisories ride along with a binding `READY` and can be applied as ride-along edits or during the named phases.

## Resolution of the Iteration-4 Critical Finding

**RESOLVED — `humanText` redaction order no longer contradicts `verify change` byte-identity.**

- Spec v1.5: F-10 (line 180), AC-F10-3 (line 596), §8.5 (line 379), DEC-18 (line 515), Appendix E (line 802), §22 constraint (line 664), DoD item 11 (line 603), Appendix I normative expectation (j) (line 904), checklist (line 948) all state one design: `CommandDefinition.humanText` returns `string | undefined`; `gates` returns the six-line report; every other target returns `undefined`, so `runCli` falls through to the delivered `humanSuccess`/`humanJson` path, which redacts the data object **before** serialization. `verify change` therefore does not use `humanText` and stays byte-identical, including for a JSON-escaping-sensitive secret.
- Test plan v1.5: TC-VGATES-063 (lines 1942–1971) now plants a quote/backslash/newline secret, asserts `undefined` delegation, byte equality against a pre-change golden, six-line gates output, machine-mode equality, and no raw **or JSON-escaped** secret in either stream; step 9 negates a JSON-returning hook for `change`. TC-VGATES-069 step 4 re-asserts change bytes. Automation row (line 2303) and R-14 (line 2370) agree.
- Plan v1.4: task 5.4 (line 324) widens the one type line and adds the target-dispatching hook, explicitly forbidding a serialized JSON return for non-`gates` targets; task 5.6 (line 326) adds the planted-secret control; sequencing item 5 (line 50) records the design; `packages/cli/src/index.ts` is now in the Phase 5 file list (line ~333); RSK-16 (line 133) carries the risk and its mitigation.
- Verified against the delivered tree: `packages/cli/src/index.ts:48` declares `humanText?: (… ) => string` (the one widened type), `:260` already types the local as `string | undefined`, `:279–280` assigns the hook result, and `:299` omits the option when `undefined`; `packages/cli/src/output/serialize.ts:76–84` redacts `humanJson` data **then** serializes and string-redacts only a defined `humanText`; `packages/cli/src/commands/verify.ts:103` sets `humanSuccess: true` (so today's change output is the `humanJson` path) and `packages/core/src/domain/verify-change.ts:74,278` gives change data `target: "change"`, so `data.target === "gates"` is an exact, executable discriminator. The plan's change is a one-line hook-type widening plus the hook; no `runCli`/`serialize` rewrite is implied, and no other consumer reads the hook return. The iteration-4 critical is closed, not merely re-worded.

**Iteration-4 finding 2 (empty `counts=`/`names=` rendering): RESOLVED.** DM-6 (line 270), Appendix D grammar and examples (lines 779–800), AC-F8-2 (line 590), the observability rule (line 427), TC-VGATES-042 steps 3–7 and expected outcome (lines 1403–1410), and plan 4.7/4.10/5.6/6.5 all require both segments always present, `-` when empty, never `0`, `[]`, a bare segment, or an omission; the no-usable-detail squash line is pinned to `counts=- names=-` with a worked example.

**Iteration-4 finding 3 (successful detail read with absent counts): RESOLVED.** DM-5 (line 269), DM-11 (line 275), AC-F7-3 (line 588), AC-F8-1 (line 589), Appendix D (line 795 area), TC-VGATES-038 step 3 and TC-VGATES-040 step 4/expected outcome all require omitting `commits`/`changedFiles` as unknown (never zero, never synthesized) while keeping the two ordered `squash-signals` tokens; plan 4.5/4.10/5.6 repeat it.

**Iteration-4 finding 4 (reverse traceability): RESOLVED.** Scripted bidirectional comparison of the §3.1 forward table, every TC's `Related IDs`, the plan's 70 per-TC AC columns, and the plan's 36-row final acceptance trace reports **0 mismatches** in all four pairings (36 ACs, 70 TCs). Every AC has at least one TC; every TC except TC-053 (performance, traced to F-13/NFR-8 in §3.3) has an AC, which is legitimate.

## Independent Re-Verification (this iteration)

- **Artifact set:** spec v1.5, test plan v1.5, plan v1.4, pm-notes read; readiness iterations 1–4 compared for deduplication; ticket GH-178 loaded live (OPEN; labels `change`, `spec-ready`).
- **Counts:** 36 AC rows in the spec; 36 coverage rows, 70 scenario-index rows, 70 detailed scenarios, 70 automation rows in the test plan; 10 phases, 53 tasks, 70 scenario rows, 70 per-TC AC rows, 36 final-trace rows in the plan. No drop.
- **Ticket alignment:** the five M0 gates in fixed order, pushed-commit CI target, workflow-derived expected job set, push parity, label-only owner scan with the declared no-comments limitation (ADR-0006), squash preflight, citation layer, and the three ticket negatives (red pipeline, missing job, vacuous green) all map to F-/AC-/TC- IDs; suite-to-job awareness is deferred to M2 as the ticket requires.
- **Non-vacuity:** §4.2 rules 215/217, restored controls, seeded-write control, canaries, corpus completeness meta-check, empty-fixture failure rule, TC-VGATES-058, and plan 6.1/6.2 make vacuous passes fail closed; every fail/unknown case pairs a control through the same evaluator.
- **Scope:** NG-2/NG-5/NG-12, G-11, AC-F11-2/AC-F13-1, TC-VGATES-005/051/065, plan "Out of Scope"/constraints, and the zero-write/zero-spawn/read-budget assertions keep the change read-only, merge-free, and free of a new package/subpath/runtime-API/dependency/config/state change.
- **Exact files and commands:** all referenced existing paths resolve (`packages/cli/src/{index,edge}.ts`, `commands/{index,verify,status}.ts`, `core/src/{index.ts,contracts/{index,ports,error-table}.ts,domain/{index,verify-change}.ts}`, `adapters/src/{io/provider-transport,github/client,github/normalize,file/index}.ts`, the checks and structure/behaviour suites, `scripts/checks/{error-table-sync,privacy-literals,forbidden-literals,workspace-entrypoints}.ts`, `scripts/.tests/test-doc-distribution.sh`, `tests/boundaries`); planned-new paths are consistently named and do not collide. Delivered values match the plan's edits: error table 31 rows with one `verify` row, `BASELINE_ROWS` guard `+1`, structure test `31`/one `verify` row; CI workflow has 23 uniquely named jobs; `packages/core/package.json` exports `[".", "./contracts", "./state", "./branding", "./provider"]` (no `./domain`); `humanSuccess: true` on `verify`; Bun 1.4.4 / pnpm 10.18.3 match. `scripts/checks/error-table-sync.ts` exists, so task 1.3's verify command is real.
- **System-spec consistency:** the delivered `feature-result-contract.md` (one `verify` row), `feature-adapter-ports.md` (no gate facts), `feature-provider-client-seeds.md` (normalization section), `feature-verify-change-and-exit-taxonomy.md` ("exactly one subcommand"), and `feature-status-digest.md` are correctly named as current truth to reconcile in plan 1.3/2.5/7.2; no contradiction or silent drift beyond the planned reconciliation.
- **Decision capture:** DEC-16/17/18/20 are change-level and recorded in the spec; the widened hook is DEC-18. No system/precedent decision record is required, and no human input is pending, so no pause and no override.
- **Cap note:** this is iteration 5, beyond the ~3-iteration soft cap. The cap targets stalemates; the iteration-4 critical is closed and no blocking gap persists, so there is no stalemate and no human escalation.

## Findings

1. [minor] plan_coverage — `chg-GH-178-plan.md` task 5.7 (line 327); delivered `tests/structure/cli-edge-seam.test.ts:414–418`
   Gap: The structural test "only status declares the optional human-text renderer" asserts the set of command files containing `humanText` equals exactly `["packages/cli/src/commands/status.ts"]`. Task 5.4 adds the `humanText` hook to `packages/cli/src/commands/verify.ts`, so this invariant test goes red. Task 5.7 names the file and runs the suite, but describes the update only as "additive combined-runtime wiring", so a coder can legitimately fix the wiring assertions and leave this one failing into Phase 8's `pnpm check`.
   Blocking: no.
   Suggested remediation target phase: delivery_planning
   Suggested fix: In task 5.7, explicitly extend that assertion to `[status.ts, verify.ts]` (and, if useful, assert the `gates`-report/`undefined` dispatch there).

2. [minor] plan_coverage / test_traceability — `chg-GH-178-plan.md` task 5.7 (line 327); delivered `tests/structure/cli-edge-seam.test.ts:293` `NEW_COMMAND_FILES`; `tests/structure/verify-imports.test.ts:32,385` command-surface modules
   Gap: Both invariant suites enumerate command modules by an explicit list. The new `packages/cli/src/commands/verify-gates.ts` is not added to either, so the new handler escapes the stream-write/exit-literal/adapter-import/edge-import checks and the command-surface import scan. This will not go red — it is a silent coverage gap for the very module that must return `data`/`error` without stream or exit decisions.
   Blocking: no.
   Suggested remediation target phase: delivery_planning
   Suggested fix: In task 5.7 (or 5.1), add `commands/verify-gates.ts` to `NEW_COMMAND_FILES` in `cli-edge-seam.test.ts` and to the `command-surface` `modules` list (and `NEW_MODULES` if brand-free scanning should cover it) in `verify-imports.test.ts`.

3. [nit] plan_coverage — `chg-GH-178-plan.md` task 4.7 (line 276) vs scenario table TC-VGATES-046 (line 575) and task 5.6 (line 326)
   Gap: Task 4.7's `AC/TC` annotation includes `TC-VGATES-046` (the exit/failure-identity matrix), but the scenario table and task 5.6 place TC-046 in Phases 5–6 and Phase 4 never runs the suite. Harmless because 4.7 verifies only `pnpm typecheck`, but the annotation contradicts the phase mapping.
   Blocking: no.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Drop `046` from 4.7's TC list (or annotate "exit matrix exercised in 5.6").

4. [nit] test_traceability — `chg-GH-178-test-plan.md` TC-VGATES-063 preconditions (line 1954)
   Gap: The precondition says the golden is "captured from the delivered behavior (the pre-change `humanSuccess`/`humanJson` redact-then-serialize pipeline; `humanText` returns `undefined` for `change`, so the fallback renders the output)". A pre-change capture cannot have a `humanText` hook; the parenthetical describes the post-change path. The intent (today's bytes, then the delegating hook must reproduce them) is clear from the steps, but the wording is muddled.
   Blocking: no.
   Suggested remediation target phase: test_planning
   Suggested fix: Reword to: the golden is today's `verify change` human bytes from `humanSuccess`/`humanJson`; after the change, the hook returns `undefined` and must reproduce those bytes exactly.

5. [nit] plan_coverage — `chg-GH-178-plan.md` task 1.3 (line 171)
   Gap: The task says to update "the `DeliveryRequest` primitive field table" in `doc/spec/features/feature-adapter-ports.md`, but that doc describes `DeliveryRequest` in a primitive-inventory row (line 64), not a per-field table. The spec's Appendix H asks for the "primitive description", so a coder may look for a nonexistent table.
   Blocking: no.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Refer to the `DeliveryRequest` primitive description/row and add the four optional facts plus the absence rule there.

6. [nit] system_spec_consistency (residual risk, not the iteration-4 defect) — `chg-GH-178-spec.md` F-10 (line 180), DEC-18 (line 515), DM-6/Appendix D names rendering (lines 270, 791); `chg-GH-178-test-plan.md` TC-VGATES-042 (lines 1395–1410)
   Gap: The failure summary is a rendered string that is redacted **after** rendering, and its name lists are rendered as compact JSON arrays. A registered secret that appears inside a job name/label and is JSON-escaped there would not be a contiguous match for raw-string redaction, so its escaped form could survive, while F-10 claims no secret appears in either mode. This is a defense-in-depth residual only: citation values are refs, counts, and bounded job/label names, not credential-bearing fields, and TC-VGATES-042's canary is payload-level rather than a rendered name value. It is not the iteration-4 finding (that was the unsatisfiable `verify change` byte/redaction conflict, now closed) and no AC or TC fails because of it.
   Blocking: no.
   Suggested remediation target phase: specification
   Suggested fix: Optionally record the residual in the risks section (or add one TC-VGATES-042 fixture placing a quote/backslash secret in a bounded name value and asserting it is absent), keeping the accepted gates-string-redaction design.

## Final Verdict

**READY.** All ten DoR facets pass; the iteration-4 critical is closed in the spec, test plan, plan, and delivered code; traceability is exact in both directions; non-vacuity, read-only/no-merge/no-new-package scope, DoD, doc-update coverage, and code-area coverage all hold. The six advisories above are non-blocking; findings 1–2 are worth folding into task 5.7 to avoid a red or ungated structural suite, and the remainder are wording/annotation fixes. Delivery may start.
