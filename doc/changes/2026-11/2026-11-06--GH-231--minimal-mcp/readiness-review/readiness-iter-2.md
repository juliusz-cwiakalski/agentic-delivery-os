# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-231
Date: 2026-11-06
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

## Iteration-1 Remediation Verification (verified against sources, not claims)

1. Finding #1 (major — plan_coverage/plan_code_area_coverage): **RESOLVED.**
   - Phase-3 `scope.files` now lists `scripts/checks/secret-read-boundary.ts` and `tests/checks/secret-read-boundary.test.ts`; task 3.8 added.
   - Mechanics verified against `scripts/checks/secret-read-boundary.ts`: `AllowlistClass` already includes `configuration-environment-source`; a `kind: file` entry causes `scan()` to skip the path entirely, which suppresses **every** violation form for `packages/mcp/src/serve.ts` — the `process.env.*` read, the `node:process` runtime-import flag (import regex `/^(node:)?process$|^bun$|^node:bun$/`), and ambient aliasing. The planned single entry is therefore sufficient for both serve-root allowances (stdio edge + startup env read); the phase-3 gate can now pass.
   - `validateAllowlist` constraints all satisfiable by the planned entry: exact `.ts` path, non-empty reason, valid class, and the `exactly one credential-material entry` rule is unaffected (the new entry is a second `configuration-environment-source`).
   - Length pins verified against `tests/checks/secret-read-boundary.test.ts`: exactly **three** `toHaveLength(4)` assertions exist (lines 52, 61, 257 — TC-SECRET-001, the testkit test, TC-DOCTOR-023). Task 3.8's "all three length pins to 5" is accurate; "count-bearing labels adapted" covers the two test names reading "exactly four entries"; "the registry doc comment's reader count updates" covers the check's header comment ("one credential implementation and three readers").
   - Negative-control plan (planted env read in a temp-root `packages/mcp/src/commands/status.ts`) matches the existing planted-fixture style (mutation B, TC-DOCTOR-023 control).
2. Finding #2 (minor — cross_artifact_consistency): **RESOLVED.** NFR-4 now scopes the prohibition to the neutral tool modules with the serve-composition-root carve-out naming both enforcement mechanisms (depcruise exact-path allowance; secret-read-boundary `configuration-environment-source`, serve root only). AC-F1-3 is now satisfiable given DEC-1 (runtime-neutrality enforced by boundary checks for everything except the serve edge). G-6, §1 summary, and document-history row 1.1 aligned. Spec, test plan (§4.6, §8.2, TC-MCP-013), and plan (3.4/3.5/3.8) now state the same two allowances with identical mechanism naming.
3. Finding #3 (nit — test_traceability): **RESOLVED.** TC-MCP-013 steps 5–6 and §4.6 now cite the effective enforcement points (depcruise `runtime-apis-confinement` exact-path serve allowance, `tests/structure/mcp-imports.test.ts` AST floors, secret-read allowlist). Verified factual: `scripts/checks/ambient-globals.ts` `AMBIENT_SCOPE` covers `packages/core` only, and the test plan now says so explicitly (§4 layer table, TC-MCP-013 step 6). TC-MCP-018's retained ambient-globals run is worded as a battery green-gate assertion, not mcp-surface coverage — accepted (PM-reviewed). Test plan version 1.1 + revision-log row present.

## Full Gate Re-Run (remediation must not have introduced new contradictions)

- Ticket coverage re-verified against `gh issue view 231`: goal (thin mirror of status/verify-artifact/gate-report, no batch) → G-2/F-2..F-4/DEC-3; ticket AC (same core results and stable error codes; no process-exit propagation, envelope CLI-side per ADR-0003) → AC-F2-1..AC-F5-3, G-3/G-4/G-5, DEC-4, NFR-1..NFR-3; pinned decisions honored (DEC-2, DEC-5, AC-F1-3, AC-F6-1, AC-F7-1). Design baseline `doc/planning/oss-tooling/milestones/m1/commands/mcp.md` re-spot-checked (thin mirror, no batch, tool-call parity, exit vocabulary). No scope drops or silent additions; the remediation added no scope beyond the allowance mechanics iter-1 itself prescribed.
- Traceability both directions intact: 13 ACs → TCs (§3.1) → plan tasks; 21 TCs → tasks (§7); 11 NFRs → TCs + tasks; no orphans. Task 3.8 adds no orphan TC (it executes TC-MCP-018's boundary battery + the NFR-4/AC-F1-1 links already present).
- Plan executability re-verified against the tree: depcruise `runtime-apis-confinement` `pathNot` excludes `^packages/cli/` and `^packages/opencode/` but **not** mcp — the serve exact-path allowance is real work in the established reason-bearing pattern (ADR-0005 C-2 style), with the failing negative fixture tasked (3.5) and fixture-coverage meta-check green. `pnpm check:boundaries` runs depcruise + ambient-globals + workspace-entrypoints + secret-read-boundary, so the phase-3 gate exercises the remediated check directly. `packages/mcp/package.json` `workspaceImports` already covers everything the surface consumes (task 3.7's no-widening claim holds); `exports` currently `.` only, matching task 3.4's `./serve` addition as real work; `tests/structure/mcp-imports.test.ts` correctly absent today (phase-3 creation).
- Task 3.5 ↔ 3.8 mutual consistency verified: the exit-literal reconciliation permits exits **only** in `lifecycle.ts` (matching `exit-code-literals.ts` current state: `process.exit` forbidden everywhere, `exitCode` numeric literals permitted only in `packages/cli/src/projection.ts`; scan scope already includes `packages/mcp/src`); the secret-read and depcruise allowances permit runtime/env access **only** in `serve.ts`. The two reconciliations are disjoint by module and jointly pin the implementation shape: `serve.ts` holds the node: imports and the env read; `lifecycle.ts` holds the exit calls via the ambient `process` global (an import of `node:process` there would fail both boundary checks — correctly forcing the ambient form, which `secret-read-boundary`'s property-read exemption and depcruise's import-graph scope both pass, and which TC-MCP-010 step 3 explicitly contemplates: "the lifecycle module may assign `process.exitCode` only with `0`, `1`, or `2` and only there"). The CLI projection rule and its digits are unchanged by both tasks; the deliberate asymmetry (projection: every numeric literal checked; lifecycle: only exit-relevant literals checked, TC-MCP-018 step 3) is recorded in both artifacts identically.
- NFR-4 "exactly one startup configuration-environment read" is consistently worded across spec NFR-4, task 3.4 ("resolve brand identity once at startup from the injected environment record"), task 3.8's reason text, test plan §8.2, and the smoke's config-selector fixtures (§6: `DELIVERY_OS_CONFIG` / `DELIVERY_OS_WORKING_NAME`) — the smoke exercises the carve-out rather than contradicting it.
- Gap deferrals (GAP-T1..T5) unchanged and still sound; OQ-1/OQ-2 resolved in-plan within pinned constraints; OQ-T3/T5/T6 declared delivery-bound with execution-log recording tasked (6.6). No new human input required; `delivery_mode: autonomous`, no blockers.

## Findings

1. [minor] plan_coverage — chg-GH-231-plan.yaml#phase-3 (testGate)
   Gap: The phase-3 testGate executes `tests/checks/exit-code-literals.test.ts` but not `tests/checks/secret-read-boundary.test.ts`, although task 3.8 edits that file and it is in phase-3 scope. The binding production check does run in-gate (`pnpm check:boundaries` includes `secret-read-boundary.ts`, which shape-validates the new entry and scans the live tree), but the length-pin and negative-control assertions are first executed by `pnpm test` at phase 6 — a stale `toHaveLength(4)` would pass phase 3's gate and surface only in the phase-6 aggregate, weakening the per-phase-green discipline the plan itself declares.
   Suggested remediation target phase: delivery_planning
   Suggested fix: One-line addition to the phase-3 testGate bun-test line: include `tests/checks/secret-read-boundary.test.ts` alongside `tests/checks/exit-code-literals.test.ts`. Non-blocking: the work is fully tasked, the file is in scope, and phase 6's `pnpm check` catches any miss with a named failure.

2. [nit] cross_artifact_consistency — chg-GH-231-test-plan.md#section-4.6 / TC-MCP-013 step 5, chg-GH-231-plan.yaml#task-3.6
   Gap: The mcp-scoped scan is worded "zero `node:*` imports and `process` reads outside `serve.ts`". `lifecycle.ts` necessarily references the ambient `process` global for its exit calls (`process.exit`/`process.exitCode` — it cannot import `node:process` under the serve-only allowances). All artifacts are consistent under the reads-vs-writes reading (TC-MCP-010 step 3 makes the lifecycle exit allowance explicit; an exit call is not a read), but a coder implementing `mcp-imports.test.ts` as "zero `process` member accesses outside serve.ts" would produce a false-positive contradiction with tasks 3.3/3.5.
   Suggested remediation target phase: delivery_planning
   Suggested fix: In task 3.6 (and optionally §4.6), one clause: the mcp-imports scan targets process **reads** (`env`/`argv`/stdio access) outside `serve.ts`; exit calls in `lifecycle.ts` are governed by the exit-literal invariant and its reconciled allowance (TC-MCP-010 step 3). Non-blocking.

## Deduplication

All three iteration-1 findings verified resolved in the artifacts and against the source tree; no persistent findings. Both findings above are new observations from the iteration-2 re-run and are non-blocking.

## Gate Result

READY. All ten facets pass; the blocking iteration-1 gap (phase-3 gate could not pass without the secret-read allowance) is verifiably closed, and the remediation introduced no cross-artifact contradiction. Findings 1–2 are advisory refinements that may be applied at delivery_planning before phase 3 starts; neither blocks delivery. Delivery may proceed to phase 6 (delivery) under the standard hard gate.
