# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-181
Date: 2026-10-30
Pause Required: no

Reviewer mode: adversarial DoR gate over spec v1.1 (iteration 2), test plan v1.1 (iteration 2), plan v1.0, PM notes, ticket GH-181, and the live tree. No prior readiness records exist (iteration 1).

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

## Ticket Traceability (verified)

| Ticket AC | Spec ACs | TCs | Plan phases | Status |
|---|---|---|---|---|
| AC-1 typed ports + capability flags | AC-F1-1/F1-2/F2-1/F2-2 | TC-PORT-001..004 | 1, 2 | Covered |
| AC-2 CI boundary check on secret reads outside credential port | AC-F3-1/F3-3/F4-1/F4-2/F4-3 | TC-PORT-005..008, TC-SECRET-001..004 | 3, 4 | Covered |
| AC-3 envelope round-trip + graceful degradation on strip | AC-F5-1..F5-6 | TC-META-001..006 | 1, 2 | Covered |

Sidecar-adoption documentation constraint (ticket task text): F-3/DEC-6, AC-F3-3, plan task 3.5 + Phase 1 contract docs. Non-goals match the ticket (no sidecar code, no provider adapters). No scope invented beyond the ticket: the F-6 error row is a derived necessity of "classified failure" under the result contract (DEC-3), and the v1 set decision (DEC-1) is correctly bounded.

## Verified Against the Live Tree (evidence for PASS verdicts)

1. **v1 set selection (AC-F1-1 fail-closed)**: `doc/planning/concepts/primitive-catalogue.md` §"Adapters and provider interaction" contains exactly nine M0 rows (ExternalSystemInstance, AdapterContract, WorkItem, WorkflowMap, WorkItemRelation, DeliveryRequest, PipelineRun, RetryPolicy, IdempotencyKey); Compensation is M1, harness rows M1/M3. Spec DEC-1 selection is exact in both directions.
2. **Secret-read allowlist completeness (clean tree will pass)**: `rg` over `packages/*/src` finds ambient env reads in exactly two files — `packages/adapters/src/legacy/index.ts:145` and `packages/adapters/src/file/yaml-parser.ts:51` — both named in plan task 4.2's three-entry allowlist; no `Bun.env`/`Deno.env` sites exist. No unstated reader would fail the clean tree.
3. **CI wiring claims (AC-F4-2)**: `ts-invariants` job exists in `.github/workflows/ci.yml`; `scripts/checks/ci-topology.ts` enforces additions-only diff on ci.yml (lines 146–164), pins `TS_JOBS` (unchanged by plan), and runs the generic wiring scan requiring every `scripts/checks/*.ts` name in ci.yml+package.json (lines 166–176) — the plan adds the command to both. `scripts/checks/script-surface.ts` pins five named checks in aggregate order; appending to `check:boundaries` and editing root `typecheck` does not violate it (existence+order only).
4. **Registration surfaces for `./credentials` (plan task 3.2)**: `ADAPTER_SUBPATHS` exists in exactly the three named places (`scripts/checks/workspace-entrypoints.ts`, `tests/structure/subpaths.test.ts`, `tests/boundaries/harness.ts`); `workspaceImports` adapters lists exist in cli/mcp/opencode/testkit manifests; subpath convention `src/<name>/index.ts` matches plan task 3.1. `tests/boundaries/fixture-registry.json` has a `runtime-apis-confinement` rule section for the task 3.3 fixture; the depcruiser allowlist regex `(repo|file|host|session|legacy)` is the stated extension point.
5. **Codec placement mechanics (DEC-9)**: `packages/adapters/src/io/` exists and `#io/*` internal alias exists; `io` is NOT a declared subpath (11 exports, no `io`), so no exports-map change is needed and `src/io` stays outside the runtime-API confinement allowlist (codec must remain runtime-free — plan task 2.1 states this). Root-test relative-import precedent verified: `tests/behaviour/legacy-adapter.test.ts:10` imports `../../packages/adapters/src/legacy/index`; `check:boundaries` depcruiser scope is `packages`, so root tests are outside it.
6. **Error-table claims (DEC-3/F-6, AC-F6-1)**: `packages/core/src/contracts/error-table.ts` already has 9 `config.*` rows; `feature-result-contract.md` confirms kind-only singletons (provider/input), config exact-code discipline, fallback containment — the additive-row claim "no existing classification changes" is sound. `config.credential.missing` fits the `domain.reason.detail` pattern. `BrandIdentity.environmentPrefix` exists in core branding.
7. **Type-probe remediation (OQ-D)**: root `tsconfig.json` references only the six packages — tests are indeed outside `pnpm typecheck`; the plan's dedicated `tests/types` project chained into the root typecheck script is the correct binding vehicle. `port-carrier-types.type-test.ts` does not match Bun's `*.test.ts` discovery (bunfig confirms fixture-naming discipline).
8. **Referenced infrastructure exists**: `tests/checks/{ci-checks,boundary-ci-parity,error-table-sync}.test.ts`, `content-inventory.test.ts` `EXECUTABLE_ALLOWANCES`, `tests/structure/inventory.json`, `scripts/checks/{changesets-group,testkit-exclusion,exports-discipline,exports-parity,forbidden-literals}.ts`, `.changeset/`, and the GH-173 precedent folder all exist. Invariant/neutrality guards (`ambient-globals.ts` exported `scan`, neutral set covers `core/src/contracts/**`) match the plan's mirroring claims.
9. **DoD consistency**: plan §"Definition of Done checklist" mirrors spec §18 predicates item-for-item (17 ACs, invariant firing proof, matrices, sync, existing gates + `pnpm check`, TDR path, docs, open PR to main-tools on pushed HEAD). Counts consistent throughout: 17 ACs (spec §17), 19 TCs (test plan §3.1, all ACs covered, no orphan TC), 35 tasks (plan).
10. **Repo invariants**: no protected-path edits (`scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/` untouched; one added ci.yml line only); no hand-added license headers (packages/scripts/tests are not header paths); `doc/spec/**` edit needs no `ados_distribution` marker; branding neutrality preserved via the seam.

## Findings

1. [minor] cross_artifact_consistency — chg-GH-181-spec.md §5.1 F-5 + §15 DEC-9 (echoed in chg-GH-181-test-plan.md §4, §6, and TC-META-005 step 5)
   Gap: The clause "the dev-only test harness (testkit) may import the adapters codec … via the testkit dev edge" is mechanically false for an adapter-internal module: `src/io` is not a declared adapters subpath (verified: exports map has no `io` entry), so the testkit package cannot import it by package name, and a relative import would violate `no-relative-cross-package-import`. The plan (Context → "DEC-9 mechanics") correctly re-routes codec tests to root `tests/**` with relative imports and states "No testkit package change is required" — a recorded reconciliation the spec/test-plan wording contradicts.
   Suggested remediation target phase: specification
   Suggested fix: Align spec F-5/DEC-9 and test-plan §4/§6 + TC-META-005 step 5 wording to the root dev-edge relative-import mechanism (root `tests/**` import the adapter-internal codec; the testkit package is not the import vehicle), or record the plan's reconciliation as authoritative in pm-notes. Delivery must not place codec tests under `packages/testkit/` (self-correcting via ts-boundaries if it does).

2. [nit] test_traceability — chg-GH-181-test-plan.md §5.2 TC-ERR-001 step 2 (and chg-GH-181-plan.md task 1.6)
   Gap: Asserts the new row matches spec §8.3 with "exact summary and remediation hint", but the spec fixes only the summary string verbatim; the remediation hint is specified semantically ("directing the operator to supply the credential through its declared environment source"), so an exact-match assertion has no fixed reference text.
   Suggested remediation target phase: test_planning
   Suggested fix: Record the exact remediation-hint string in the machine + documented tables at delivery and treat that as the reference (mirroring the OQ-A constant-recording pattern), or scope the exactness assertion to the summary plus the enumerated fields (kind/category/retryable/consequence/projection).

3. [nit] plan_coverage — chg-GH-181-plan.md Phase 4 task 4.5 (parenthetical)
   Gap: "boundary-ci-parity check/tests cover the boundary chain containing the new command" overstates `scripts/checks/boundary-ci-parity.ts`, which verifies only build-before-cruise in the `ts-boundaries` job (verified). The actual binding surfaces for local-chain presence are ci-topology's generic wiring scan plus the extended `tests/checks/ci-checks.test.ts` (both correctly listed elsewhere in the same task).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Reword the parenthetical to attribute local-chain command-presence to the extended `ci-checks.test.ts` assertions and ci-topology's wiring scan.

4. [nit] plan_coverage — chg-GH-181-plan.md task 4.2 + chg-GH-181-test-plan.md TC-SECRET-003 preconditions
   Gap: The allowlist claims "exact paths only; wildcards/prefixes rejected" while mixing two file entries with one directory entry (`packages/adapters/src/credentials/`); directory-scope semantics are undefined, leaving mutation E (wildcard/prefix rejection) ambiguous against the directory entry itself.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Define registry entry kinds (file | directory) with exact-directory-scope semantics so "exact path" is unambiguous for the credential entry.

## Decision Routing

- Placement (DEC-2) and error-kind (DEC-3): change-level decisions already recorded in spec §15 + pm-notes — correctly captured.
- OQ-1 (placement dispute): change-level contingency with TDR path via `@decision-advisor` (plan task 3.5) — no human input needed now; not a pause condition.
- OQ-2 (catalogue bookkeeping): routed to doc-sync phase / M0-S17 — correctly captured.
- Plan-owned resolutions (OQ-A constants `delivery.metadata.v1` / 2048 bytes, OQ-D type-test project, OQ-E ts-invariants step, OQ-F empty-value policy) are recorded in plan Context and fall within the spec's stated ranges — no decision-record action required at the gate.

## Gate Result

All ten facets pass; no critical or major findings; no pause flag. The four findings are advisory wording/precision items with suggested remediation in artifact-creation phases (never delivery); none blocks the start of delivery. Delivery may proceed; the PM may fold findings 1–4 into a lightweight wording alignment pass or carry them as recorded reconciliations (the plan already reconciles finding 1 mechanically).

Iterations used: 1 of ~3.
