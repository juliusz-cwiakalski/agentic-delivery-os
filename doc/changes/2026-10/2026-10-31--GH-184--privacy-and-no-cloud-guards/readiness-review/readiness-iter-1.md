# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-184
Date: 2026-10-31
Pause Required: no

Reviewer: @readiness-reviewer (local DoR mode). Inputs read in full: spec v1.1, test plan v1.1, plan v1.0, pm-notes, ticket GH-184, TDR-0005 (Proposed), and the live repository gates named below. No prior readiness records exist under this change folder; this is iteration 1.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking finding count: 1 (Finding 1). Finding 2 is major but non-blocking (procedure-complete); Findings 3–4 are advisories. No human-input decision surfaced; no pause flag.

## Findings

1. [major] plan_coverage + cross_artifact_consistency — chg-GH-184-plan.md#PD-2 / task 1.2 / task 2.4 / task 4.7 vs chg-GH-184-test-plan.md#TC-PRIVACY-012 step 2
   Gap: Allowlist staging contradiction inside the plan, verified against the guard's own fail-closed semantics. PD-2 enumerates the "delivered allowlist (exact set)" including entries for `tests/checks/privacy-ci-wiring.test.ts` (Phase 5), `tests/behaviour/envelope-content-policy.test.ts` (Phase 6), `tests/checks/privacy-release.test.ts` (Phase 7), and the directory `tests/fixtures/privacy-literals` (created in Phase 4, task 4.1). Task 1.2 commits the registry "plus the PD-2 allowlist/exclusion entries", but PD-3 step 8 and RV-21 (echoed in AC-F4-1) fail closed when an allowlist entry matches no scanned path — so a literal reading of task 1.2 makes the Phase 2 live-tree green gate (task 2.4) unachievable: ~10 entries would match files that do not exist yet. Conversely, TC-PRIVACY-012 step 2 ("delivered allowlist entries are exactly the enumerated set") is first-green in Phase 4, when Phase 5–7 files still do not exist; the exact-set assertion cannot pass until end-state. Tasks 4.7 and 6.5 already stage some entries "in the same commit" as their files, contradicting task 1.2's bulk delivery without an explicit precedence rule. As written, the plan forces either a self-inflicted red gate or an unrecorded deviation (which the plan's own discipline forbids: PD-pin changes require recorded revisions).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add one staging rule to PD-2 and amend task 1.2: an allowlist/exclusion entry lands in the same commit as its target file; the registry at Phases 1–2 carries only existing-file entries (rule-definition module, check, registry) plus the `pnpm-lock.yaml` exclusion; guard-test, structure-test, behaviour-test, and fixture-root entries land with tasks 4.1/4.7, 5.2, 6.5, and 7.2. State that TC-PRIVACY-012's exact-set assertion tracks the current file set and reaches PD-2's full enumeration at end-state (extend per phase, never relax — consistent with test-plan A-T7). No spec or test-plan reopen is required; the test plan's end-state assertion is correct as written.

2. [major] plan_coverage — chg-GH-184-plan.md#PD-7 / RSK-E9 (baseline false-positive load under-enumerated) — NON-BLOCKING
   Gap: Live-tree sampling shows the Phase 2 green baseline is heavier than PD-7's "known baseline candidates" (.ados-claude mirror, pnpm-lock.yaml, abstract "committed absolute home/profile paths"). Verified guaranteed-shape trips: `tests/fixtures/providers/sanitization/cases.ts` carries a committed `ghp_…` synthetic token (a certain `secret.provider-token-prefix` match, outside the guard's fixture root); `scripts/.tests/test-hook-zai-example.sh:44` carries `F_SECRET='zai-fake-secret-…'` (41-char opaque value under a secret-named key); `doc/tools/text-to-image.md` carries `sk-your-openai-key`-style samples; `doc/changes/…/chg-GH-26-test-plan.md:1383` carries `_GOOGLE_ACCESS_TOKEN="cached-token-abc"`. Materially, ~7 historical change artifacts contain REAL owner absolute paths (three private project directories under the owner home root) — true positives of `private.absolute-user-path` that NG-3 leaves in the working tree, resolvable only by reviewed exact-path suppressions. The PD-7 procedure (tighten or reason-bearing exact-path suppress, never weaken, enumerate in the commit message + PR description) is complete and credible, so this does not block; but the expected suppression batch (likely 10+ reviewed entries covering genuinely private-looking historical content) should be an expected, visible deliverable of Phase 2, not a surprise.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Enumerate the known guaranteed trips above in PD-7 as expected baseline work (not merely "candidates"), and record a pm-notes note that a one-time reviewed suppression batch over `doc/changes/**` historical artifacts is an accepted part of delivery (owner sees the inventory at PR per Phase 11.4).

3. [minor] system_spec_consistency — chg-GH-184-spec.md#F-1 / NG-3 vs live tree — advisory
   Gap: F-1 puts "public documentation, change artifacts, and code samples" in scan scope while NG-3 excludes retroactive remediation; the working tree demonstrably contains true target-class content in historical change artifacts (see Finding 2). The reconciliation (spec flow 6: reviewed exact-path suppression) exists, but the consequence — the guard's first act on the live tree includes allowlisting real private-path-bearing historical files — deserves explicit owner visibility.
   Suggested remediation target phase: specification (optional one-line note in §7.3 or flow 6; not required — current text already permits the resolution)
   Suggested fix: None required. If touched, add one sentence to flow 6 acknowledging historical-artifact suppressions as an expected baseline outcome.

4. [minor] test_traceability — AC-F7-1 / NFR-5 CI-runner evidence — advisory
   Gap: The evidence of record for AC-F7-1 and the NFR-5 numeric bound is the pushed-HEAD CI job, declared consistently in spec §17, test plan GAP-T4/§10, and plan Phase 11.2. The linkage is sound; the only risk is execution ordering — the live job result must be recorded in test-plan §10 and the evidence artifact before PR creation.
   Suggested remediation target phase: test_planning (no reopen; execution-discipline note only)
   Suggested fix: None at authoring time. The executor must not record §10 as complete without the pushed-HEAD job result (already mandated by §6.4 exit criteria and plan 11.2/11.4).

## Disposition of the plan's three recorded findings (DoR confirmation requested by the plan)

1. TC-POLICY-005 step 1 import wording — **CONFIRMED as proposed.** Verified: `packages/adapters/src/io/envelope-codec.ts` value-imports `ENVELOPE_KINDS`, `ENVELOPE_MAX_BYTES`, `ENVELOPE_SCHEMA_ID` and imports types via `type` modifiers; NFR-6 (the operative purity NFR) contains no import-type-only clause. The plan's pinned reading (contract types via `import type`; contract `as const` data by value; plus the pure shared module; 0 `node:*`/`bun:*`; 0 ambient) preserves the assertion's operative content and matches delivered precedent. No test-plan reopen needed.
2. Test-plan §7 execution order vs Phase 6 codec landing — accepted; TC-halves follow the GH-174/GH-179 precedent and the plan's traceability table is consistent.
3. Allowlist enumeration unpinned — accepted in substance (PD-2 enumerates the exact set), but its phase staging is the subject of Finding 1.

## Verification evidence (repo-grounded; not artifact self-claims)

- **PD-1 feasibility**: Bun resolves `.js` → `.ts` specifiers (runtime experiment passed); `scripts/checks/**` is outside every tsc project (`tsconfig.json` solution references only the six packages; `pnpm typecheck` = `pnpm -r typecheck` + `tests/types/*.type-test.ts`), so the check's relative import needs only Bun resolution; in-package `.js` specifiers are precedent in tsc-checked `packages/core/src/**` (e.g. `./config/index.js`); `ts-invariants` has no build step (verified in `.github/workflows/ci.yml`) so package-name imports would fail there — the relative-source design is required, and `boundary-ci-parity` exists precisely for that hazard class.
- **Boundary gates**: `depcruise packages` scope confirmed (all rules anchored `^packages/`; the scripts→adapters edge is invisible); `runtime-apis-confinement` excludes `packages/adapters/src/io/` from the node-builtins allowlist (zero-import shared module + injected-hash policy builder comply); `ambient-globals` scopes to core tiers only; `secret-read-boundary` and `exit-code-literals` scope to `packages/*/src/**` (the check's `node:crypto`, `git ls-files`, and `process.env.CI` reads are out of scope); `ci-bindingness` forbidden-construct scan satisfied by a plain additive run line; `ci-supply-chain` untouched (no new action/step).
- **CI wiring blast radius**: `ci-topology` requires every `scripts/checks/*.ts` name to appear in ci.yml-or-package.json text — correctly satisfied by landing `check:privacy-literals` in Phase 2 (task 2.7) before any CI wiring; `script-surface` permits additional named scripts (`check:forbidden-literals` precedent) and the plan keeps the aggregate byte-unchanged; `tests/checks/ci-checks.test.ts` pins the exact `TS_JOBS` list and exact aggregate string — both preserved (no new job, no aggregate edit).
- **Codec call sites**: `serializeEnvelope` (codec) is called only from `tests/structure/envelope-contract.test.ts`, `tests/behaviour/envelope-roundtrip.test.ts`, and `tests/fixtures/ports/capabilities.ts`; `packages/cli/src/output/serialize.ts` defines an unrelated same-named CLI function and the golden mutants wrap that CLI module, not the codec — the plan's three-call-site list is complete. `envelope-contract.test.ts`'s placement check (no `envelope-codec` reference outside `io/`, no `./io` export) is compatible with PD-1/PD-8; `agentFacingViolations` inspects only two named type aliases, so the two new contract types are safe.
- **Inventory**: `tests/structure/inventory.json` + `EXECUTABLE_ALLOWANCES` cover packages only; the plan registers both new package files (tasks 1.3, 6.2) — correct. Type-only contract exports need no executable allowance (plan 6.1 consistent).
- **AC satisfiability**: AC-F8-1 (v1.1) — exactly the five named pre-existing changesets exist in `.changeset/`; the change-diff semantics is assertable. AC-F3-1 — satisfiable and non-vacuous: the passing scan must report the empty class as scanned-and-vacuous with a populated field (TC-PRIVACY-008 step 3) plus the RV-09 malformed control, and activation is proven synthetically (AC-F3-2); mechanism-only shipping is a captured, documented residual (TDR-0005 §4, RSK-4, OQ-1, pm-notes). AC-F7-1 — the CI-evidence boundary is declared in all three artifacts, not silently deferred.
- **Artifact hygiene**: change-folder scans found no cloud/hosted-product names, no owner/private paths, no secret-shaped literals, no salts/keys in any GH-184 artifact.

## Gate result

NOT_READY. Reopen **delivery_planning** only (specification and test_planning pass; no AC, TC, or spec text needs changing). Blocking scope for iteration 2: Finding 1's allowlist staging rule (a targeted PD-2/task-1.2 amendment). Finding 2 should be folded into the same revision while the plan is open (expected-baseline enumeration + pm-notes visibility note). Re-run this gate after revision; no human escalation required.
