# Code Review — GH-231 (M1-S7: Minimal MCP) — Iteration 1

- **Reviewer**: `@reviewer` (local mode)
- **Range**: `origin/main-tools..HEAD` (16 commits; delivery af4f53ea → bf1a885a, docs 7728a36f)
- **Date**: 2026-11-06
- **Status**: **FAIL** — 2 major findings requiring a remediation phase (phase 7 appended to the plan); 3 minor, 2 low, 3 advisory
- **Canonical artifact**: `../code-review/review-iter-1.yaml` (this file is the human-readable report)

## Verdict summary

The delivery is strong. Everything pinned by the ticket and spec exists and is verified: exactly three read-only branding-projected tools (`status`, `verify-artifact`, `gate-report`), mirror-parity payload contract with CLI-identical stable codes and full error field sets, zero envelope/exit-code leakage, the in-package zero-dependency stdio protocol, the `{0,1,2}` lifecycle with channel separation, the Node portability smoke, injection inertness, and the read-only guarantee. This review **re-ran the suites and invariant checks** (158 tests across the MCP battery green; exit-literals 167 files OK; secret-read 179 files / 5 allowlisted entries OK; forbidden-literals 5/5 scope classes, 0 violations) and probed the shipped `./serve` entry under Node.

**Spec compliance: FAIL** (F-1, F-2 below). **Plan compliance: PASS** — all 6 phases delivered with evidence; one scope deviation (phase 6, verified sound, see MIN-1). Two findings block; both have small, scoped fixes.

---

## Blocking / Major

### MAJ-1 [correctness] Uncontained thrown errors in `verify-artifact` / `gate-report` crash the server
- **Where**: `packages/mcp/src/commands/verify-artifact.ts:64,74`; `packages/mcp/src/commands/gate-report.ts:195-198`; `packages/mcp/src/commands/toolset.ts:65-87` (dispatch has no catch)
- **Evidence (empirical)**: a probe calling `callTool("verify-artifact", …)` with a `readPmNotes` that throws rejects with the raw error (`error: adapter exploded`) instead of returning a classified failure. In the serve process the rejection travels `runProtocol` → the exported `serve` promise → unhandled rejection → **process crash, exit 1**, colliding with the configuration-error lifecycle meaning.
- **Why it violates**: G-5 / AC-F5-3 ("a failed tool call never terminates the server") on the thrown-error path; NFR-6 (the crash exit is not produced by `lifecycle.ts`); parity discipline — the CLI contains every thrown value at `packages/cli/src/index.ts:339-351` (`failureOutcome(classifyThrown(thrown))` → `fallback.internal`), and even inside this surface `runStatusTool` contains (`status.ts:95-99` → `failureFromValue`). The exported `createToolset` seam declares `callTool: Promise<McpToolResult>`; a rejecting promise breaks the type contract for any throwing runtime.
- **Reachability caveat**: the shipped serve adapters are largely total (`readPmNotesText` catches fs errors; registry reads are tolerant), so production exposure today is low — but the containment layer is the missing `runCli` analogue, and the seam is the documented integration point future surfaces reuse.
- **Fix**: wrap the single dispatch site (or both handlers) in `try { … } catch (thrown) { return failureFromValue(thrown); }`; add throwing-runtime parity cases for the two tools (mirror of `status-containment`) asserting deep equality with the CLI `fallback.internal` error, plus a lifecycle row proving continued serving.

### MAJ-2 [spec-compliance] Serve status digest hardwires the parks section to a false `state.store.unknown`
- **Where**: `packages/mcp/src/serve.ts:109-113` (`readProviderParks` → `{ok:false, reason:"state-unreadable", failureCode:"state.store.unknown"}`)
- **Evidence**: the same file composes a real state store (`serve.ts:234`) that `verify-artifact`/`gate-report` read successfully in the same session, while the status digest claims the store is unreadable. The CLI composes real parks from that store (`packages/cli/src/edge.ts:1370-1376` → `readProviderParkViews(store, nowMs)`).
- **Why it violates**: spec F-2 ("a degraded or unavailable section is **truthful** digest content"), spec §8.4 ("the same bounded-read and classification rules as the CLI"), plan task 3.4 ("same read paths … exactly as the cli edge composes them"), and UQ-7 (drift requires a **recorded** reason — none exists). Parks is local state, not a credential-backed provider read, so the GAP-T1 hermetic-smoke justification does not cover it. The feature page (`doc/spec/features/feature-mcp-surface.md:89`) omits parks from both the wired and the unavailable lists, so the docs don't record the exclusion either.
- **Root cause**: `readProviderParkViews` is exported from `@delivery-os/core/provider`, which mcp's declared `workspaceImports` (`., ./contracts, ./state, ./branding`) exclude — the spec's §12 assumption ("no boundary-matrix change required") proved wrong for parks and was worked around by degrading the section instead of recorded drift.
- **Fix (preferred)**: add `"./provider"` to mcp's `workspaceImports` (with pin-test registration) and compose parks from the existing store exactly as the CLI does. **Alternative**: keep the local-only composition but return a truthful `not-configured` reason and record the UQ-7 drift in the feature page + execution log. Either way, complete the composition inventory in the docs (see MIN-2).

---

## Minor

### MIN-1 [plan-compliance] Phase 6 scope deviation — verified sound
`bf1a885a` touched 12 files vs 3 declared. All verified correct: seven secret-read allowlist length pins (4→5) across `board-privacy`, `live-entrypoint`, `brief/doctor/queue-ready/session-admin/status-imports` (each still enforces "not grown" + "names no surface file"); `biome.json` formatter exemption for generated `tests/fixtures/mcp/**/*.json` (mirrors the existing fixture pattern; canonical-JSON goldens must not be reformatted); `state-scope.test.ts` consumer registration (the list still fails any other state importer); `verify-imports.test.ts` depcruise runtime-allowlist pin (exact-equality pin updated with the phase-3 depcruise change). Root cause: phase 3's scope list omitted the pin files its own task 3.8 text mandated; the aggregate gate surfaced them at phase 6. **Process fix**: include every file that pins a shared invariant registry in the phase that changes the registry.

### MIN-2 [documentation] Composition inventory incomplete; stale status column
`feature-mcp-surface.md` serve-composition paragraph lists neither provider config nor parks in either list (ties into MAJ-2). Test plan §7 "Implementation status" still reads "To Implement" for all TCs while §10 records all executed PASS.

### MIN-3 [correctness] Valid-JSON non-frame (incl. JSON-RPC batch) exits the process
`protocol.ts:117-119`: a frame that parses as JSON but is not a JSON-RPC 2.0 object — including a **batch array** — is classified a transport fault → **exit 2** (verified empirically). GAP-T3 pins only malformed JSON as the fault trigger. A recoverable client mistake kills the session while an unknown method keeps serving. Suggest `-32600 Invalid Request` + continue; reserve exit 2 for unparseable bytes; pin the choice in the protocol suite.

## Low

### LOW-1 [correctness] Positional name→id coupling in the protocol dispatcher
`protocol.ts:63-67`: served name resolved to canonical id via `findIndex` over `listTools()` + `CANONICAL_TOOL_IDS[index]`. Correct today (map order), but a future descriptor reorder silently dispatches the wrong tool with every check green. Use `toolIdByName` or carry the id on the descriptor.

### LOW-2 [naming] Duplicated neutral constants at the serve root
`serve.ts:44,47` hardcode `"delivery-os"` and `"DELIVERY_OS_WORKING_NAME"` (CLI has its own copy at `edge.ts:219`). The forbidden-literal scan passes and is the authority (`delivery-os` is neutral scope, not a forbidden seed) — **not** a firewall violation. But a permanent rename now depends on multiple un-enumerated sites (RD-8/RD-10 don't cover the serve default), and the feature page doesn't state the default when the override is absent. Consider a shared branding-module constant or a drill step; document the fallback.

## Advisory (no action required this change)

1. **Provider-backed reads absent from the serve composition** (`serve.ts:105-107,180-199`) — recorded posture (GAP-T1, feature page, pinned smoke outcomes); a later story should compose credential-aware reads for full serve-level parity.
2. **Dead `#commands/*`/`#output/*` aliases** in `packages/mcp/package.json:22-25` — nothing imports through them; relative `.js` is the Node-dist-valid form. Identical pre-existing residue in `packages/cli/package.json`; housekeeping only.
3. **Protocol metadata edges**: unknown tool uses `-32602` (reserved for invalid params); an `initialize` notification still gets an `id: null` reply. Contract-neutral (OQ-T6), unpinned by tests.

---

## Spec / plan / test-plan audit

- **Spec ACs**: all 13 ACs implemented with credible, non-vacuous tests mapped TC-MCP-001…021 (fixture-parity basis; TC-MCP-021 delivered in phase-7 commit 7728a36f: feature page with `ados_distribution: internal`, result-contract surface-mapping note, rename-drill RD-8, registry registration). Exception path: AC-F5-3's continued-serving guarantee fails on thrown errors (MAJ-1).
- **Plan audit (delivery.plan.v1)**: OPEN_PHASES none; EVIDENCE_MISSING none (per-phase commits + gate evidence in §10); SCOPE_DEVIATION one (phase 6 — MIN-1, verified sound). OQ-1/OQ-2/OQ-T3/T5/T6 decisions recorded in §10. `plan diff` unavailable (no production bin) — reconciled via `git diff` against declared scopes, consistent with the coder's report.
- **Test quality**: high. Case floors asserted before iterating (status 6≥5, verify 10≥8, gates 5≥4); mutation controls on every golden; negative controls beside every absence claim (canary removal, seeded mutants, temp-copy scans with file-count floors); no clock/network/HOME/order dependence in the parity suites; goldens read-only with mtime asserted; CLI oracle runs in process. Coverage gaps: throwing-runtime cases for verify/gates (MAJ-1) and the batch-frame behavior (MIN-3) are unpinned.

## PM attention points — verdicts

| Point | Verdict | Notes |
|---|---|---|
| (a) relative `.js` imports vs `#commands/#output` aliases | **Sound** | Aliases map to `./src/*.ts`, unresolvable under Node dist; relative `.js` matches the CLI convention exactly; no invariant depended on the aliases (nothing anywhere imports through them; `subpaths.test.ts` updated correctly, with a narrowly-scoped side-effect carve-out for `mcp:./serve` plus a dedicated manifest-resolution test). |
| (b) phase-6 out-of-scope touches | **Sound, process miss** | All 9 ripple changes verified correct; every pin still enforces its invariant; root cause is phase-3's under-scoped file list (MIN-1). |
| (c) `delivery-os` default working name | **Accepted** | Firewall scan (the authority) passes — `delivery-os` is neutral workspace scope; value aligns with branding's `SCOPE_ORG`. Residual rename-drift hardcoding noted (LOW-2). |
| (d) `generatedAt` cross-runtime normalization | **Sound** | Masks exactly one key at any depth; all other fields compared exactly; a missing-vs-present `generatedAt` still fails; any other clock field would fail loudly, not silently. Matches the documented real-clock serve edge; NFR-8 fixed-clock determinism is covered by the in-process replay suites. |
| (e) forbidden-literals registry registration | **Correct** | New user-facing doc absent at `corpusBaseline` must be registered; registration adds the doc to the literal scan (strictly stronger); alphabetically ordered; scan re-run green with the doc in the registered set. |

## Remediation

Phase **"7: Code Review Remediation (Iteration 1)"** appended to `chg-GH-231-plan.yaml` covering MAJ-1, MAJ-2 (+MIN-2 doc completion), with MIN-3/LOW-1/LOW-2 as optional non-blocking tasks. Re-review after execution.

**Next step**: EXECUTE_REMEDIATION_PHASE (`@coder`), then re-review as iteration 2.
