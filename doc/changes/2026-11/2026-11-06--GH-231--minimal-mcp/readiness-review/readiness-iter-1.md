# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-231
Date: 2026-11-06
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Findings

1. [major] plan_coverage (also plan_code_area_coverage) — chg-GH-231-plan.yaml#phase-3 (scope.files, tasks 3.4-3.6) and phase-6 testGate
   Gap: The serve edge's contractual startup environment read cannot pass the declared gates as written. Plan task 3.4 pins a Node-hosted serve composition root that "reads the environment once at startup" (brand resolution + branding-derived config selector); AC-F1-1's configuration-error scenario and the Node smoke (test plan §4.6, §6: `DELIVERY_OS_CONFIG` / `DELIVERY_OS_WORKING_NAME` fixtures) depend on it. Verified against the tree: `scripts/checks/secret-read-boundary.ts` scans every `packages/*/src/**` file, flags any `process.env` property access, any `node:process`/`bun` import, and ambient `process` aliasing, and its `SECRET_READ_ALLOWLIST` (4 entries: credentials, state driver runtime-edge, yaml-parser, legacy) contains no MCP entry — and `tests/checks/secret-read-boundary.test.ts:52,61` pins `SECRET_READ_ALLOWLIST` to length 4. There is no dodge: `process.stdin/stdout` property access passes, but every route to the env record (`process.env.*`, `node:process` import, destructuring, `globalThis["process"]`) is flagged. Therefore phase 3's `pnpm check:boundaries` gate (which runs secret-read-boundary at the root) and phase 6's `pnpm check` cannot pass once `serve.ts` lands. Neither `scripts/checks/secret-read-boundary.ts` nor `tests/checks/secret-read-boundary.test.ts` appears in any phase scope, and no task mentions the allowance. Phase 3 reconciles the two analogous invariants (dependency-cruiser runtime-apis-confinement in task 3.5, exit-code-literals in task 3.5) but omits the third boundary check that task 3.6 itself names in its own gate command.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `scripts/checks/secret-read-boundary.ts` and `tests/checks/secret-read-boundary.test.ts` to phase-3 scope and add one task (extend 3.5 or insert 3.8): extend `SECRET_READ_ALLOWLIST` with a reason-bearing, exact-path `configuration-environment-source` entry for the serve composition root (established pattern; mirrors the runtime-apis pathNot entry), and update the length pin and any per-entry ordering assertions in `tests/checks/secret-read-boundary.test.ts`. No scope growth: this is the same allowance mechanics already applied to depcruise and exit-literals.

2. [minor] cross_artifact_consistency — chg-GH-231-spec.md#section-9 (NFR-4) and #section-17 (AC-F1-3) vs chg-GH-231-plan.yaml (tasks 3.4/3.5) and chg-GH-231-test-plan.md (§4.6, §8.2)
   Gap: NFR-4 and AC-F1-3 state the prohibition absolutely ("no runtime-specific imports or ambient-global reads in the surface" / "the surface contains no runtime-specific import or ambient-global read"), but the plan and test plan implement — and explicitly record — a carve-out: the serve edge is the composition root and "may use node: builtins for stdio and may read the environment once at startup to resolve configuration, exactly as the CLI edge does; NFR-4's ambient-global prohibition applies to the neutral tool modules" (test plan §4.6). Read literally, AC-F1-3 is unsatisfiable given DEC-1 (a Node stdio server cannot exist without node: stdio access at its edge), leaving a DoD dispute window at dod_check where one artifact's literal wording contradicts the other two artifacts' pinned reading.
   Suggested remediation target phase: specification
   Suggested fix: One-line wording change in NFR-4 and AC-F1-3: scope the prohibition to the neutral tool/protocol modules with an explicit serve-composition-root carve-out (node: stdio builtins and the single startup environment read), mirroring the CLI-edge pattern the boundary matrix already encodes. No behavioral change; aligns the spec with the recorded reading in the test plan and plan.

3. [nit] test_traceability — chg-GH-231-test-plan.md#section-4.6 (also TC-MCP-013 step 6)
   Gap: The Node-smoke oracle cites `bun run scripts/checks/ambient-globals.ts; assert green` as part of the mcp no-ambient guarantee, but `ambient-globals.ts` scan scope (`AMBIENT_SCOPE`) covers only `packages/core` (public entry + neutral tier directories); it never scans `packages/mcp`. The assertion is vacuous for this surface. The substantive coverage exists elsewhere in the same TC (dependency-cruiser runtime-apis-confinement plus the `mcp-imports` AST scan with non-zero file-count floors), so this is cosmetic, but a vacuous cited gate violates the plan's own §4.9 scan-scope discipline.
   Suggested remediation target phase: test_planning
   Suggested fix: Rephrase TC-MCP-013 step 6 (and §4.6) to cite ambient-globals as a core regression check only and name the `mcp-imports` AST scan / depcruise rule as the mcp-scoped ambient assertion.

## Verified strengths (no action required)

- Ticket coverage is complete with no scope drops or silent additions: goal (thin mirror of exactly status/verify-artifact/gate-report) → G-1..G-10, F-1..F-7, AC set; ticket AC (same core results and stable error codes; exit codes/envelope never propagate per ADR-0003) → AC-F2-1..AC-F5-3, DEC-4, NFR-1..NFR-3; pinned decisions (mirrors-only, no batch, envelope CLI-side, branding-projected names, Node portability, untrusted-input fixture, no installer registration) → DEC-2/3/5, AC-F6-1, AC-F1-3, AC-F7-1, verified against design baseline `doc/planning/oss-tooling/milestones/m1/commands/mcp.md` (tools, exit vocabulary 0/1/2, error-table fields, no batch) and ADR-0003 (UQ-7 line 117/294, C-2/C-3/C-7/C-9/C-10, "Node or a Bun binary are both acceptable", "the MCP SDK is confined to mcp").
- Traceability is bidirectional and verified: all 13 ACs → ≥1 TC (test plan §3.1) and ≥1 plan task; all 21 TCs → plan tasks; all 11 NFRs → TCs and tasks; no orphan tasks or TCs; DEC-1..DEC-7 and OQ-1/OQ-2 all resolved in-plan (in-package protocol, serialize) within pinned constraints, no human gate needed (delivery_mode autonomous).
- Plan mechanics verified against the tree: `runtime-apis-confinement` currently covers `packages/mcp` (phase-3 pathNot allowance is real work, correctly planned); `exit-code-literals.ts` scan scope already includes `packages/mcp/src`; `input.value.rejected` and `fallback.internal` already exist in the shared `ERROR_TABLE` (DEC-7 adds no row, G-10 honored); the classification chain is genuinely CLI-owned (`packages/cli/src/classify.ts`), validating plan 1.2's mirror-not-import approach; all cited harness exports (`runStatusCli`, `statusRuntime`, `capSizedFacts`, `guardStore`, `materializeAbsentTarget`, `withOpenPhase`, `gatesRuntime`, `runVerify`, `SYNTHETIC_BRAND`), check scripts, spec pages (no `feature-mcp-surface.md` exists — first-spec claim holds), `mcpToolPrefix`, inventory/subpaths mechanics, `plan diff` command, CI `ts-test` Node gap, and changeset convention all check out; CLI status runtime shape in task 1.4 matches `packages/cli/src/commands/status.ts` exactly.
- The GAP-T1..T5 deferrals are sound, each with an owner and a recorded split (notably TC-MCP-021 → phase-7 doc-syncer is a standard lifecycle phase; AC-F1-2/AC-F6-1 remain delivery-testable via TC-MCP-001/012/015, so no AC depends solely on phase-7 work).

## Blocking summary

One blocking finding (#1): phase 3's declared test gate cannot pass as written because the plan omits the `secret-read-boundary` allowance (and its length-pinned test) from its blast radius. Finding #2 is a one-line spec wording alignment that should ride the same reopen. After those two remediations, re-run this gate; everything else is READY-grade.
