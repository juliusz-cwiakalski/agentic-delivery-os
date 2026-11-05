---
id: chg-GH-221-test-plan
status: Proposed
created: 2026-11-05T00:00:00Z
last_updated: 2026-11-05T00:00:00Z
owners: [engineering]
service: delivery-os CLI watchdog command family and core contracts
labels: [change, m1]
version_impact: minor
summary: "Verify the M1-S1 watchdog check family contract-first: preflight refuses dirty and non-base checkouts with named evidence and mutates nothing, teardown restores on every exit path and reports each action while preserving (never clobbering) uncommitted agent-memory publications, liveness classifies absent signal sources as watchdog.signals-absent with no verdict and exit 2, the watchdog error kind binds exactly three documented rows and a total {0,1,2} exit mapping, exactly one exclusive envelope is emitted per invocation, grammar and unknown-lane failures reuse existing identities, the surface is brand-neutral and never dispatches, spawns, kills, or supervises, and identical checkout/lane facts replay to identical verdict, evidence, and exit. Thirty-five scenarios across structure, behaviour, golden, and checks suites, traced to all fourteen acceptance criteria."
links:
  change_spec: ./chg-GH-221-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Watchdog and lane contracts (M1-S1)

## 1. Scope and Objectives

The change delivers a check family, not a runner: `watchdog preflight`, `watchdog teardown`, and `watchdog liveness`, each projecting through the existing v1 envelope and the fixed `{0, 1, 2}` exit taxonomy. The tests must prove four things at once: **admission truth** (a dirty or non-base checkout is refused with named evidence and no mutation), **restoration truth** (teardown runs on every exit path, reports each action with evidence, and never silently loses stranded work or clobbers an uncommitted agent-memory publication), **signal honesty** (absent signal sources produce the classified `watchdog.signals-absent` answer with exit `2` and no verdict, and a CPU-only reading can never classify as `stalled`), and **machine-surface totality** (exactly one exclusive envelope per invocation, exits only in `{0, 1, 2}`, a `watchdog` error kind with exactly three documented and synchronized rows, and existing invocation identities reused for grammar failures). The whole battery is offline: real temporary local git repositories and worktrees for checkout state, injected clock/brand/streams, committed sanitized goldens, and zero network, credentials, or host state. This document is a verification map, not an execution claim: no command was run against the delivered state at authoring time.

### 1.1 In Scope

- The `watchdog` command family (`preflight`, `teardown`, `liveness`) with `--json` envelope output and text verdict lines (F-1..F-6, §7.1, §8.1).
- Preflight refusal of dirty (AC-F1-1) and non-base (AC-F1-2) checkouts, each with evidence, and admission of a clean on-base checkout (AC-F1-3), including fail-closed behaviour for unevaluable and torn lane facts.
- Teardown restoration on success (AC-F2-1), failure and interruption (AC-F2-2), unconditional execution on a clean exit, and the full ticket refusal-or-restoration fixture family (AC-F2-3).
- Memory-publication verification inside teardown (AC-F3-1, DEC-1): committed publications reported as committed; uncommitted publications preserved byte-identically and reported; explicit destructive negative tests proving no delete or clobber.
- The liveness contract (AC-F4-1, AC-F4-2, DEC-2, DEC-3): verdict vocabulary, signals shape, evidence field, `watchdog.signals-absent` with no verdict and exit `2`, and the CPU-only-can-never-stall rule.
- The `watchdog` error kind and exactly three rows; total exit mapping over every reachable M1-S1 outcome (AC-F5-1, DM-5, NFR-7).
- Exactly one valid, exclusive envelope per invocation and text-mode evidence parity (AC-F5-2); grammar and unknown-lane failures reusing existing identities and never `fallback.internal` (AC-F5-3).
- Checks-not-runner proof (AC-F6-1, DEC-4) and brand neutrality (AC-F6-2, NFR-6).
- Determinism and replay stability of verdict, evidence, and exit (NFR-4).

### 1.2 Out of Scope & Known Gaps

- [OUT] Real progress-signal ingestion, heartbeat/traffic/token collection, and sourced `stalled`/`progressing` production outcomes (NG-1, M1-S15 / SC-M1-14). The plan tests the contract data, the declared vocabulary, and the signals-absent classification only.
- [OUT] Daemon consumption (M1-S18), supervise integration (M2-S2), the `lanes` surface, scheduling, dispatch, restart budgeting, session kill, and any run behaviour (NG-2, NG-3).
- [OUT] State-layer contract changes, envelope-shape changes, and exit codes outside `{0, 1, 2}` (NG-4, NG-5).
- [OUT] Bash-era stack removal or parity (NG-6).
- [OUT] Live provider, network, credential, or host-state behaviour; the watchdog is local-only.
- [GAP-T1 — the sourced liveness control is deferred by design] AC-F4-1's DoD names "a sourced control (from M1-S15 onward) never produces this code". No sourced control can exist in M1-S1. TC-WATCHDOG-040 covers the reachable half (no sources → `watchdog.signals-absent`, exit `2`, no verdict); the sourced half is verified as declared contract data in TC-WATCHDOG-041/043 and is a delivery obligation of M1-S15, not a gap in this plan.
- [GAP-T2 — `stalled` exit 1 has no machine identity in this story] The v1 envelope derives exit from the envelope side: success → `0`, error row's projection class → `1`/`2`. `refused` exits `1` through its refusal code, and `signals-absent` exits `2` through the `platform-provider` row. A sourced `stalled` outcome would need exit `1` but the spec declares no error identity for it (Appendix B identity "—"). It is unreachable in M1-S1; TC-WATCHDOG-005 asserts the declared matrix only, and §8.3 records the decision M1-S15 must take.
- [GAP-T3 — module and suite paths are delivery-bound] The paths named below (`packages/core/src/contracts/watchdog.ts`, `packages/core/src/domain/watchdog.ts`, `packages/cli/src/commands/watchdog.ts`, the adapter seam, and the test files) are the expected homes under the existing tier rules. Delivery planning may rename them; the tier rules, test suite layer, TC IDs, assertions, and AC mapping may not change.
- [GAP-T4 — implementation plan not yet authored] `chg-GH-221-plan.md` does not exist at test-planning time (`links.implementation_plan: null`). Delivery planning must map phases and tasks onto these TCs; it must not reshape pinned behaviour, identities, exits, or traceability.
- [GAP-T5 — evidence carrier on failure envelopes] The v1 envelope is exclusive, so a failure cannot also carry `data.evidence`. Refusal, teardown-failure, grammar, and signals-absent evidence therefore rides the failure summary (AC-F5-2's "evidence-bearing summary"), while success evidence rides `data.evidence`. Tests assert a non-empty evidence string on the non-empty side of the envelope; the exact field path on failures is delivery-bound within that constraint.
- [OUT] `stalled` / `progressing` as reachable runtime outcomes. TC-WATCHDOG-041/043 exercise them only as declared-contract and serialization cases.

## 2. References

- **Change specification**: [chg-GH-221-spec.md](./chg-GH-221-spec.md) — F-1..F-6, DM-1..DM-5, NFR-1..NFR-7, RSK-1..RSK-4, DEC-1..DEC-5, AC-F1-1..AC-F6-2 (14), §6 flows 1–4, §8.1 interface matrix, §8.3 data model, Appendix B verdict/exit matrix, §21 security highlights.
- **PM record**: [chg-GH-221-pm-notes.yaml](./chg-GH-221-pm-notes.yaml) — scope pin for the M1-S15 boundary, DEC-1 memory-publish framing, dependency verification (GH-174 delivered), and the integration surfaces (`DOMAIN_KINDS`, command factory pattern, envelope contracts, branding seam).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`; `tests/{structure,behaviour,checks,boundaries,golden,types}`; real temporary git fixtures; `pnpm check` as the aggregate gate; permanent suites assert the current tree, never a moving base.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — contracts are data/types only; domain is runtime-neutral; I/O only in adapters and the CLI edge; injected time/brand/streams; no `any`/`!`/unjustified `as`; deterministic fake-based tests.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — the v1 envelope, exclusive `data`/`error`, four mandatory fields, closed domain-kind union, documented error table, projection classes, and the two-way sync obligation.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — consumed for lane records only; torn-store classification (`state.store.torn`) is reused for unevaluable lane facts.
- **Branding seam**: [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — injected brand identity; no product or binary literals.
- **Error table source**: `packages/core/src/contracts/error-table.ts` — `DOMAIN_KINDS`, `ERROR_TABLE`, `classifyDomainKind`, `classifyThrown`, `resolveAppErrorCode`.
- **Binding check**: `scripts/checks/error-table-sync.ts` and `tests/checks/error-table-sync.test.ts` — documented rows, source scan (S1), fixture scan (S3), and true/false-positive corpora.
- **Existing suites mirrored**: `tests/structure/status-imports.test.ts` (tier and brand scans), `tests/checks/forbidden-literals.test.ts` (seed-literal scan), `tests/behaviour/closeout-checkout.test.ts` and `tests/fixtures/closeout/temp-git.ts` (real git fixtures), `tests/behaviour/session-admin-*.test.ts` (grammar and envelope assertions), `tests/golden/*` (normalized goldens), `tests/structure/error-table.test.ts` (row shape and exact-row binding).

## 3. Coverage Overview

All fourteen acceptance criteria are mapped to at least one scenario; there are no TODO/uncovered ACs. The only deferred coverage is the M1-S15 sourced liveness control, explicitly out of scope by NG-1 and GAP-T1.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Dirty checkout refused with evidence; no admission, restoration, or mutation | TC-WATCHDOG-010, TC-WATCHDOG-013, TC-WATCHDOG-015 | Covered |
| AC-F1-2 | Non-base checkout refused; evidence names expected base and actual checkout | TC-WATCHDOG-011 | Covered |
| AC-F1-3 | Clean on-base checkout admitted; `verdict: "ok"`, exit `0`, exclusive success envelope | TC-WATCHDOG-012 | Covered |
| AC-F2-1 | Teardown restores on success and reports each action with evidence | TC-WATCHDOG-020, TC-WATCHDOG-023, TC-WATCHDOG-028 | Covered |
| AC-F2-2 | Teardown restores on failure and interruption; stranded work restored or preserved-and-reported | TC-WATCHDOG-021, TC-WATCHDOG-022, TC-WATCHDOG-027, TC-WATCHDOG-028 | Covered |
| AC-F2-3 | Full stranded/foreign fixture matrix ends refused or restored with evidence; zero silent outcomes | TC-WATCHDOG-030 (with 010/011/020–022/024–027) | Covered |
| AC-F3-1 | Committed publication reported committed; uncommitted publication preserved byte-identically and reported | TC-WATCHDOG-024, TC-WATCHDOG-025, TC-WATCHDOG-026 | Covered |
| AC-F4-1 | No signal sources → exit `2`, `watchdog.signals-absent`, no verdict, evidence says unknown | TC-WATCHDOG-040 | Covered |
| AC-F4-2 | Verdict vocabulary and signals shape bound; CPU-only can never classify `stalled` | TC-WATCHDOG-001, TC-WATCHDOG-041, TC-WATCHDOG-042, TC-WATCHDOG-043 | Covered |
| AC-F5-1 | `watchdog` kind with exactly three rows; total exit mapping; no exit outside `{0,1,2}` | TC-WATCHDOG-003, TC-WATCHDOG-004, TC-WATCHDOG-005, TC-WATCHDOG-054 | Covered |
| AC-F5-2 | Exactly one valid envelope per invocation; exclusive payload; failure carries code, category, remediation hint, evidence-bearing summary; text parity | TC-WATCHDOG-029, TC-WATCHDOG-050, TC-WATCHDOG-051 | Covered |
| AC-F5-3 | Grammar and unknown-lane failures reuse existing identities; never `fallback.internal` | TC-WATCHDOG-052, TC-WATCHDOG-053 | Covered |
| AC-F6-1 | No dispatch, spawn, kill, restart, or supervision; check-oriented verbs only | TC-WATCHDOG-007, TC-WATCHDOG-013, TC-WATCHDOG-060 | Covered |
| AC-F6-2 | Brand-neutral surface; binary name through the branding seam; zero literals | TC-WATCHDOG-006 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Element | TC ID(s) | Status |
|---|---|---|---|
| DM-1 | Verdict vocabulary `ok`, `refused`, `stalled`, `progressing`, one home | TC-WATCHDOG-001, TC-WATCHDOG-041 | Covered as contract data; `stalled`/`progressing` are not runtime-reachable in M1-S1 (GAP-T1/T2) |
| DM-2 | Signals shape `heartbeatAgeMs`, `tokenDelta`, `traffic` | TC-WATCHDOG-001, TC-WATCHDOG-043 | Covered |
| DM-3 | Evidence field: finding, expected vs. actual, actions taken | TC-WATCHDOG-028, TC-WATCHDOG-050 | Covered (failure evidence rides the summary per GAP-T5) |
| DM-4 | Restoration report: per-action evidence plus memory-publication status | TC-WATCHDOG-024, TC-WATCHDOG-025, TC-WATCHDOG-028 | Covered |
| DM-5 | `watchdog` error-table kind with the three documented rows | TC-WATCHDOG-003, TC-WATCHDOG-004 | Covered |
| API surface (§8.1) | `preflight`, `teardown`, `liveness` invocations, verdicts, exits, errors | TC-WATCHDOG-005, TC-WATCHDOG-050, TC-WATCHDOG-054 | Covered |
| EVT (none) | No event/message surface added (§8.2) | — | N/A by spec |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | False-liveness guarantee: no exit `0` for refused/stalled/unavailable; no guessed verdicts with absent sources | TC-WATCHDOG-010, TC-WATCHDOG-011, TC-WATCHDOG-014, TC-WATCHDOG-015, TC-WATCHDOG-030, TC-WATCHDOG-040, TC-WATCHDOG-042, TC-WATCHDOG-054 | Covered |
| NFR-2 | Envelope validity, exclusive payloads, exits only in `{0,1,2}` | TC-WATCHDOG-005, TC-WATCHDOG-012, TC-WATCHDOG-050, TC-WATCHDOG-054 | Covered |
| NFR-3 | Evidence totality: no refusal, restoration, or verdict without evidence | TC-WATCHDOG-010, TC-WATCHDOG-011, TC-WATCHDOG-020, TC-WATCHDOG-021, TC-WATCHDOG-022, TC-WATCHDOG-028, TC-WATCHDOG-050 | Covered |
| NFR-4 | Determinism: identical facts → identical verdict, evidence, exit | TC-WATCHDOG-070 | Covered |
| NFR-5 | Memory preservation: zero runs discarding or clobbering uncommitted publications | TC-WATCHDOG-024, TC-WATCHDOG-025, TC-WATCHDOG-026 | Covered |
| NFR-6 | Tier/brand conformance: no product literals; contracts pure; domain imports contracts only | TC-WATCHDOG-002, TC-WATCHDOG-006 | Covered |
| NFR-7 | Error-table binding: 3/3 rows round-trip; zero existing rows modified | TC-WATCHDOG-003, TC-WATCHDOG-004 | Covered |

## 4. Test Types and Layers

All TypeScript tests use `bun:test` with `describe`/`test`; fixtures are never named `*.test.ts`. Module and suite paths are the expected homes (GAP-T3).

- **Static/diff checks (always)**: `git diff --check`; changed-file naming/path review; markdown table/fence sanity for the change artifacts.
- **Structure/invariant (`tests/structure/**`)**: AST scans for data-only contracts, pure domain, single vocabulary home, command-import discipline, brand-seed literals, and check-oriented grammar. Mutation probes run against in-memory strings or temp copies, never the live tree. This layer carries TC-WATCHDOG-001, 002, 003, 006, 007, 041.
- **Behaviour (`tests/behaviour/**`)**: in-process `runCli(argv, streams, deps)` with injected clock, brand, run-id, and streams. Checkout-state fixtures use **real** temporary git repositories and real `git worktree add` worktrees; nothing about checkout state is mocked. This layer carries TC-WATCHDOG-005, 010–015, 020–030, 040, 042, 043, 050–054, 060, 070.
- **Golden (`tests/golden/**`)**: committed, normalized canonical envelopes and text reports for admission, refusal, teardown, and signals-absent; normalization replaces the temp repository root with a fixed token and removes no semantic evidence. This layer carries the golden halves of TC-WATCHDOG-028, TC-WATCHDOG-050, and TC-WATCHDOG-051.
- **Checks (`tests/checks/**` + `scripts/checks/**`)**: error-table two-way sync, true/false-positive corpora, and forbidden-literal scan. This layer carries TC-WATCHDOG-004 and supports TC-WATCHDOG-006. Envelope validity assertions reuse `assertEnvelopeContract` from `@delivery-os/testkit` (the existing testkit convention) rather than re-implementing the contract.
- **Boundaries (`tests/boundaries/**`)**: the production dependency-cruiser rules, the ambient-globals AST guard, workspace entrypoints, and the fixture-coverage meta-check. The new contracts/domain/command modules must pass with no rule change; if a rule changes, a matching negative fixture is mandatory in the same change (testing-strategy fallback rule).
- **Type-level (`tests/types/**`)**: not required; the closed union and shape are asserted as runtime contract data in the structure layer.
- **Conformance**: N/A — no adapter conformance surface is added; the state layer is consumed unchanged.
- **Manual**: PR review confirmation of DEC-1 (memory verification inside teardown) and the GAP-T2 `stalled` machine-representation decision for M1-S15. Manual review is not a substitute for any TC.
- **Performance**: N/A — the change declares no latency/throughput threshold; NFR-4 determinism is asserted as replay equality, not timing.

## 5. Test Scenarios

TC IDs use the new `WATCHDOG` feature prefix. Sequence blocks are intentional: `0xx` contracts/table/surface, `01x` preflight, `02x` teardown and memory, `03x` reserved for teardown extensions, `04x` liveness, `05x` envelope/grammar/exit, `06x` checks-not-runner, `07x` determinism.

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-WATCHDOG-001 | Watchdog contract data has one data-only home | Happy Path | Structure | High | AC-F4-2; DM-1, DM-2 |
| TC-WATCHDOG-002 | Contracts, domain, and command respect tier boundaries | Happy Path | Structure | High | AC-F4-2; NFR-6 |
| TC-WATCHDOG-003 | `watchdog` kind has exactly three rows and round-trips | Happy Path | Structure | High | AC-F5-1; DM-5, NFR-7 |
| TC-WATCHDOG-004 | Documented rows and corpora stay in two-way sync | Happy Path | Checks | High | AC-F5-1; NFR-7 |
| TC-WATCHDOG-005 | Exit mapping is total over the verdict/exit matrix | Edge Case | Behaviour | High | AC-F5-1; NFR-2 |
| TC-WATCHDOG-006 | The new surface is brand-neutral | Negative | Structure | High | AC-F6-2; NFR-6 |
| TC-WATCHDOG-007 | Grammar exposes checks, never runner verbs | Negative | Structure | High | AC-F6-1 |
| TC-WATCHDOG-010 | Dirty checkout is refused with evidence and no mutation | Negative | Behaviour | High | AC-F1-1; NFR-1, NFR-3 |
| TC-WATCHDOG-011 | Non-base checkout is refused with expected-vs-actual evidence | Negative | Behaviour | High | AC-F1-2; NFR-1, NFR-3 |
| TC-WATCHDOG-012 | Clean on-base checkout is admitted | Happy Path | Behaviour | High | AC-F1-3; NFR-2 |
| TC-WATCHDOG-013 | Preflight is read-only on every outcome | Negative | Behaviour | High | AC-F1-1, AC-F6-1; NFR-1 |
| TC-WATCHDOG-014 | Unevaluable checkout fails closed | Edge Case | Behaviour | High | AC-F1-1; NFR-1 |
| TC-WATCHDOG-015 | Torn or impossible lane facts are classified, never clean | Corner Case | Behaviour | High | AC-F1-1; NFR-1 |
| TC-WATCHDOG-020 | Teardown restores on a successful exit and reports actions | Happy Path | Behaviour | High | AC-F2-1; NFR-3 |
| TC-WATCHDOG-021 | Teardown restores after a failure exit | Edge Case | Behaviour | High | AC-F2-2; NFR-1, NFR-3 |
| TC-WATCHDOG-022 | Teardown restores after an interrupted lane (stranded commit) | Edge Case | Behaviour | High | AC-F2-2; NFR-1, NFR-3 |
| TC-WATCHDOG-023 | Teardown is unconditional on a clean exit | Happy Path | Behaviour | Medium | AC-F2-1 |
| TC-WATCHDOG-024 | Committed memory publication is reported committed | Happy Path | Behaviour | High | AC-F3-1; NFR-5 |
| TC-WATCHDOG-025 | Uncommitted memory publication is preserved byte-identically and reported | Edge Case | Behaviour | Critical | AC-F3-1; NFR-5 |
| TC-WATCHDOG-026 | Teardown never deletes or clobbers uncommitted memory (destructive negatives) | Negative | Behaviour | Critical | AC-F3-1; NFR-5 |
| TC-WATCHDOG-027 | Unattributable content is preserved and reported | Edge Case | Behaviour | High | AC-F2-2; NFR-3 |
| TC-WATCHDOG-028 | Restoration report carries evidence for every action | Happy Path | Behaviour | High | AC-F2-1, AC-F2-2; DM-3, DM-4, NFR-3 |
| TC-WATCHDOG-029 | Teardown failure is classified, never silent | Negative | Behaviour | High | AC-F5-2; NFR-2 |
| TC-WATCHDOG-030 | Stranded/foreign matrix is exhaustively refused or restored | Corner Case | Behaviour | Critical | AC-F2-3; NFR-1, NFR-3 |
| TC-WATCHDOG-040 | Absent signal sources classify as unknown, exit `2`, no verdict | Negative | Behaviour | Critical | AC-F4-1; NFR-1 |
| TC-WATCHDOG-041 | Verdict vocabulary is exact and contract-only for unreachable values | Happy Path | Structure | High | AC-F4-2; DM-1 |
| TC-WATCHDOG-042 | A CPU-only reading can never classify `stalled` | Negative | Behaviour | Critical | AC-F4-2; NFR-1 |
| TC-WATCHDOG-043 | Verdict-bearing data carries verdict, signals, and evidence | Happy Path | Behaviour | Medium | AC-F4-2; DM-2 |
| TC-WATCHDOG-050 | Every invocation emits exactly one valid exclusive envelope | Corner Case | Behaviour | Critical | AC-F5-2; NFR-2 |
| TC-WATCHDOG-051 | Text verdict lines carry the same evidence as `--json` | Happy Path | Behaviour | Medium | AC-F5-2 |
| TC-WATCHDOG-052 | Parser and grammar failures reuse existing identities | Negative | Behaviour | High | AC-F5-3 |
| TC-WATCHDOG-053 | Unknown or unresolvable lane reuses the handler identity | Negative | Behaviour | High | AC-F5-3 |
| TC-WATCHDOG-054 | Exits stay within `{0,1,2}` and exit `2` is reserved | Edge Case | Behaviour | High | AC-F5-1; NFR-2 |
| TC-WATCHDOG-060 | The surface never dispatches, spawns, kills, or supervises | Negative | Behaviour | Critical | AC-F6-1 |
| TC-WATCHDOG-070 | Identical facts replay to identical verdict, evidence, and exit | Happy Path | Behaviour | High | NFR-4 |

### 5.2 Scenario Details

#### TC-WATCHDOG-001 - Watchdog contract data has one data-only home

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, DM-1, DM-2, DM-3, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/watchdog-contract.test.ts`; contract module `packages/core/src/contracts/watchdog.ts` (expected)
**Tags**: @contract, @backend

**Preconditions**:
- The contract module and its export from `packages/core/src/contracts/index.ts` exist.

**Steps**:
1. Import the exported verdict vocabulary and signals-shape declarations.
2. Assert the vocabulary is exactly the ordered set `ok`, `refused`, `stalled`, `progressing` with no duplicate or extra member.
3. Assert the signals shape declares exactly `heartbeatAgeMs`, `tokenDelta`, and `traffic`, and declares no CPU field.
4. Run the AST data-only detector used by the structure layer over the module: only type/interface/import/export/`as const` variable declarations, no runtime imports.
5. Scan every other file under `packages/` for a redeclaration of the vocabulary or signals key set.

**Expected Outcome**:
- Vocabulary and shape assertions pass; the module is data-only and runtime-neutral.
- No second home exists anywhere under `packages/`.
- A mutation probe that injects `import "node:fs"` or an executable statement into a temp copy of the module is rejected naming the file and kind.

**Notes / Clarifications**:
- One-home enforcement mirrors `tests/structure/status-imports.test.ts`.
- `WatchdogVerdict` may be a union and the vocabulary an `as const` array; both must derive from one declaration.

#### TC-WATCHDOG-002 - Contracts, domain, and command respect tier boundaries

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-5, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/watchdog-imports.test.ts`; `packages/core/src/contracts/watchdog.ts`, `packages/core/src/domain/watchdog.ts`, `packages/cli/src/commands/watchdog.ts`, adapter seam (expected)
**Tags**: @contract, @backend, @boundary

**Preconditions**:
- Contracts, domain, command, and adapter-seam modules exist.

**Steps**:
1. Assert the contracts module is data-only and imports no `node:`/`bun:` specifier.
2. Assert the domain module imports only `#contracts`, `#domain/*`, or local relative modules, and calls no `Date.now`, `Math.random`, `performance.now`, `process.env`, `Bun.env`, `fetch`, or filesystem API.
3. Assert the command module imports only `@delivery-os/core`, `@delivery-os/core/contracts`, and local types; no sibling adapter package and no deep `src/` path.
4. Assert `scripts/checks/ambient-globals.ts` scopes the new contracts and domain files and reports zero violations.
5. Run `bun test tests/boundaries` with the production `.dependency-cruiser.cjs`; every rule stays green.
6. Run failing mutants in temp copies: a `node:fs` import in contracts, `Date.now()` in domain, and an adapter import in the command must each fail by file and kind.

**Expected Outcome**:
- No runtime API or ambient global exists outside adapters/CLI edge.
- No boundary rule is loosened; if a matrix edge were added, a failing negative fixture would be required in the same change (fixture-coverage meta-check).
- All three mutants fail with the offending file named.

#### TC-WATCHDOG-003 - `watchdog` kind has exactly three rows and round-trips

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-5, NFR-7, DEC-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (existing suite, extended); `packages/core/src/contracts/error-table.ts`
**Tags**: @contract, @backend, @error-table

**Preconditions**:
- `DOMAIN_KINDS` contains `watchdog`; three rows are appended to `ERROR_TABLE`.

**Steps**:
1. Assert `watchdog` is in `DOMAIN_KINDS` and `entries.filter(domainKind === "watchdog")` has exactly the codes `watchdog.checkout-dirty`, `watchdog.checkout-non-base`, `watchdog.signals-absent`, in that order.
2. Assert every row declares every required column with valid enum values and a non-empty remediation hint.
3. Assert the two refusal rows project as `user-validation` (exit `1`) and the signals-absent row projects as `platform-provider` (exit `2`), matching Appendix B.
4. Assert `classifyDomainKind("watchdog", code)` returns the exact row, `resolveAppErrorCode(code)` round-trips, and `classifyThrown({ kind: "watchdog", code })` matches; a kind-only `"watchdog"` is ambiguous and contains to `fallback.internal`; a wrong code (`state.store.torn` under `watchdog`) contains.
5. Assert the table length is now `44` (41 pre-existing + 3) and update the existing hardcoded length assertions; assert the existing provider/input/config/state/lint/verify/db/closeout rows are byte-identical to their current declarations.

**Expected Outcome**:
- Exactly three watchdog rows, exactly the documented identities, correct projection classes.
- Runtime lookup and thrown classification are total and contain invalid shapes.
- Existing rows are untouched; no existing row loses or gains a column.

**Notes / Clarifications**:
- Updating `expect(entries).toHaveLength(41)` occurrences to `44` is an expected existing-suite update, not a weakening. Do not replace exact counts with `toBeGreaterThan`.
- If any new row uses consequence `unknown`, add it to `tests/fixtures/result/unknown-consequence-allowlist.json` with a recorded reason; preferred consequence is `not_landed`.

#### TC-WATCHDOG-004 - Documented rows and corpora stay in two-way sync

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-5, NFR-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing suite, extended); `tests/fixtures/result/code-corpora/true-positives.json`; `doc/spec/features/feature-result-contract.md`
**Tags**: @contract, @backend, @error-table

**Preconditions**:
- The three watchdog rows exist and are documented in the result-contract table in the same delivery phase.

**Steps**:
1. Run `bun run scripts/checks/error-table-sync.ts` over the live tree; assert zero failures and that the three codes are recognized in S1 (contracts/CLI) and documented.
2. For each code, assert the documented row appears exactly once and matches every column (code, domain kind, category, retryable, consequence, remediation hint, projection class, summary).
3. Add one true-positive corpus row per watchdog code (recognized and resolves) and assert the corpora still pass; add no false-positive row that would mask a real code.
4. In a temp copy, delete one documented watchdog row and run the check: it fails naming the undocumented source entry.
5. In a temp copy, insert a documented watchdog row with a mismatched hint: the check fails naming the field.
6. Assert the 41 pre-existing rows keep their documented rows and no existing row is modified (existing exact-row suites stay green).

**Expected Outcome**:
- 3/3 watchdog rows are documented, recognized, and resolvable; 0 existing rows modified.
- The sync check is non-vacuous: both a missing row and a drifted row fail with the offending code named.
- The live tree is never written; all mutations happen in `mkdtemp` copies.

**Notes / Clarifications**:
- The documented table is `doc/spec/features/feature-result-contract.md` (the binding check's fixed path). The new `feature-watchdog-lane-contracts.md` is a phase-7 deliverable and does not replace the binding path.
- This same-phase obligation matters: if delivery adds rows without the documented rows, `pnpm test` and the sync check fail before doc-sync.

#### TC-WATCHDOG-005 - Exit mapping is total over the verdict/exit matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-1, NFR-2, DEC-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-exit.test.ts`; Appendix B matrix fixtures
**Tags**: @backend, @cli

**Preconditions**:
- Every reachable M1-S1 outcome fixture exists: clean admission, dirty refusal, off-base refusal, teardown restore, teardown classified failure, signals-absent, grammar failure.

**Steps**:
1. Run each reachable fixture and record the envelope side, verdict (if any), exit code, and error identity.
2. Assert the matrix: `ok` → `0` (preflight/teardown), refusal rows → `1`, `watchdog.signals-absent` → `2`, classified teardown failure → `1` or `2` per its row, grammar failure → `1`.
3. Assert no outcome has an exit outside `{0, 1, 2}` and no outcome is both `success` and `error`.
4. Assert the committed matrix fixture records the declared mapping for `progressing` (→ `0`) and `stalled` (→ `1`) and marks both values unreachable in M1-S1; assert no production fixture yields either value.
5. Assert the `stalled` exit-1 row is documented as an M1-S15 decision dependency (GAP-T2) and is not produced in any M1-S1 fixture.

**Expected Outcome**:
- Every reachable outcome has exactly one verdict or one classified identity and one exit in `{0,1,2}`.
- No exit-`0` outcome exists for a refused or unavailable probe.
- The unreachable `stalled`/`progressing` rows are asserted only as declared contract data.

**Notes / Clarifications**:
- The v1 envelope derives exit from the envelope side, not from a free-standing verdict. A refusal is therefore a failure envelope carrying the refusal code; a test must not expect `data.verdict: "refused"`.
- If delivery chooses a different machine representation for `refused`, it must still satisfy AC-F1-1's failure envelope, the exact code, exit `1`, and evidence.

#### TC-WATCHDOG-006 - The new surface is brand-neutral

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/watchdog-imports.test.ts`; `packages/core/src/contracts/watchdog.ts`, `packages/core/src/domain/watchdog.ts`, `packages/cli/src/commands/watchdog.ts`, adapter seam (expected)
**Tags**: @contract, @backend, @branding

**Preconditions**:
- The branding seam injects a synthetic brand in tests (`SYNTHETIC_BRAND` from `tests/golden/helpers.ts`).

**Steps**:
1. Run the seed-literal matcher from `scripts/checks/forbidden-literals.ts` over every new module; assert zero matches for the registered seed literals.
2. Render the command's text output and diagnostics with the synthetic brand; assert the injected `binaryName` appears wherever a binary name is rendered and no seed literal appears.
3. Run `pnpm check:forbidden-literals` over the live tree; assert zero violations and zero failures.
4. Non-vacuity: inject a product literal into a temp copy of the command module and assert the scanner fails naming the file and token.

**Expected Outcome**:
- Zero hardcoded product or binary literals in the new surface.
- Output resolves the injected brand value.
- The scan is proven non-vacuous by a failing mutant.

#### TC-WATCHDOG-007 - Grammar exposes checks, never runner verbs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DEC-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/watchdog-imports.test.ts`; command definition (expected)
**Tags**: @cli, @backend

**Preconditions**:
- The command definition declares its subcommands and usage text.

**Steps**:
1. Assert the exported subcommand set is exactly `preflight`, `teardown`, `liveness`.
2. Assert the declared flags are limited to read/selection flags (`--json` is global and stripped by `runCli`; no run/mutate flags are introduced).
3. Assert the usage/help surface contains no runner verbs (`run`, `start`, `stop`, `kill`, `spawn`, `dispatch`, `restart`, `supervise`) as subcommands.
4. Non-vacuity: a mutant adding a `run` subcommand fails the assertion naming `run`.

**Expected Outcome**:
- The grammar cannot express a run action.
- Later consumers see a check-only surface.

#### TC-WATCHDOG-010 - Dirty checkout is refused with evidence and no mutation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-3, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-preflight.test.ts`; fixture `FIX-DIRTY` in `tests/fixtures/watchdog/temp-git.ts`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A real temporary repository with `main`, the lane's declared base branch, and a lane branch.
- The working tree has an uncommitted modification and an untracked file.

**Steps**:
1. Run `watchdog preflight lane-1 --json` with the dirty fixture.
2. Parse the single envelope and record code, exit, and evidence.
3. Run the same invocation in text mode.
4. Re-read `git status --porcelain`, `HEAD`, and the branch.

**Expected Outcome**:
- Exit is `1`; the envelope is a failure with `error.code: "watchdog.checkout-dirty"`, correct category/retryable/consequence/remediation hint, and a non-empty summary naming the dirty state.
- `data` is absent (exclusive payload); the text diagnostic repeats the evidence.
- The working tree, HEAD, and branch are byte-for-byte unchanged; the dirt is still present, proving preflight refuses rather than cleans.
- A clean control does not produce `watchdog.checkout-dirty`.

**Notes / Clarifications**:
- "Refused" is the conceptual verdict; the machine representation is the refusal code on a failure envelope (GAP-T5, TC-WATCHDOG-005).

#### TC-WATCHDOG-011 - Non-base checkout is refused with expected-vs-actual evidence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, DM-3, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-preflight.test.ts`; fixtures `FIX-OFFBASE` and `FIX-FOREIGN-WORKTREE`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A lane declares base `main`.
- Fixture A checks out an unrelated branch with a foreign commit.
- Fixture B creates a real `git worktree` checked out away from the declared base.

**Steps**:
1. Run `watchdog preflight lane-1 --json` for each fixture.
2. Parse the envelope and inspect the evidence string.
3. Run an on-base control with the same lane declaration.

**Expected Outcome**:
- Exit is `1`; `error.code: "watchdog.checkout-non-base"`; evidence names both the expected base and the actual checkout/branch/commit.
- The foreign worktree/branch is not mutated or deleted.
- The on-base control is admitted (`ok`, exit `0`), proving the refusal is not unconditional.

#### TC-WATCHDOG-012 - Clean on-base checkout is admitted

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, F-1, F-5, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-preflight.test.ts`; fixture `FIX-CLEAN`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A real temporary repository with a clean working tree checked out on the lane's declared base.

**Steps**:
1. Run `watchdog preflight lane-1 --json`.
2. Assert the envelope side and mandatory fields.
3. Assert `data.verdict` and `data.evidence`.

**Expected Outcome**:
- Exit is `0`; exactly one success envelope with `schemaVersion`, `runId`, `exitCode`, `timing`, and `data`.
- `error` is absent; `data.verdict === "ok"`; `data.evidence` is a non-empty string naming the admitted checkout/base.
- No mutation or process side effect occurs.

#### TC-WATCHDOG-013 - Preflight is read-only on every outcome

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F6-1, F-1, F-6, NFR-1, DEC-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-preflight.test.ts`; recording runtime in `tests/fixtures/watchdog/harness.ts`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A recording runtime exposes only read operations and logs every method call.

**Steps**:
1. Snapshot repository facts for each preflight fixture (clean, dirty, off-base, torn).
2. Run preflight for each fixture.
3. Assert the call log contains only read operations (no restore, checkout switch, clean, reset, stash, commit, or delete).
4. Re-read repository facts and compare.

**Expected Outcome**:
- Every preflight outcome is read-only: no mutation method is called and no repository fact changes.
- The dirty fixture remains dirty after refusal; the foreign worktree remains present.
- A mutant handler that invokes `restoreCheckout` during preflight fails the call-log assertion.

#### TC-WATCHDOG-014 - Unevaluable checkout fails closed

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-preflight.test.ts`; fixtures `FIX-BASE-MISSING` and an injected read failure
**Tags**: @backend, @git, @cli, @security

**Preconditions**:
- A lane whose base ref cannot be resolved, and a variant whose checkout facts cannot be read (injected adapter error).

**Steps**:
1. Run preflight on each fixture.
2. Assert exit, envelope side, identity, and evidence.
3. Assert no `data.verdict === "ok"` appears anywhere.

**Expected Outcome**:
- Exit is non-zero (`1` or `2`) with a valid failure envelope; `error.code` resolves in `ERROR_TABLE` and is not a new watchdog identity (the three are refusal/availability only).
- Evidence names the unevaluable fact (missing base ref or read failure).
- The lane is never admitted; fail-closed is asserted, not inferred.
- A mutant returning `ok` on the unevaluable fixture fails.

#### TC-WATCHDOG-015 - Torn or impossible lane facts are classified, never clean

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F5-2, F-1, F-5, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-preflight.test.ts`; fixtures for a torn lane record and contradictory checkout facts
**Tags**: @backend, @git, @state, @cli

**Preconditions**:
- A torn state record for the lane (state-layer read classifies `state.store.torn`).
- A contradictory checkout fixture: detached HEAD plus a lane branch at a foreign commit, or a base/actual pair that cannot both be true.

**Steps**:
1. Run preflight for each fixture.
2. Assert the outcome is a classified failure or refusal, never `ok`.
3. Assert the evidence names the condition and the classification is one of the existing identities.

**Expected Outcome**:
- Torn and impossible facts are classified, non-zero, and evidence-bearing.
- No fixture is silently treated as a clean checkout.
- The test does not pin a new watchdog identity: the existing `state.store.torn` or `input.value.rejected` identity may be used; the assertion is "classified, not clean", plus "no new watchdog code".

#### TC-WATCHDOG-020 - Teardown restores on a successful exit and reports actions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-4, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; fixture `FIX-SUCCESS-RESIDUE`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A lane that exited successfully, with lane residue: a temporary file and a lane branch containing the delivered commit.
- The checkout is on the lane branch.

**Steps**:
1. Snapshot the repository and the delivered commit hash.
2. Run `watchdog teardown lane-1 --json`.
3. Assert the post-teardown checkout, residue state, report actions, and evidence.
4. Assert the delivered commit remains reachable through its attributed ref (no history loss).

**Expected Outcome**:
- The checkout is restored to the lane's declared base; lane residue is removed or, if preserved, named in the report.
- Exit is `0`; exactly one success envelope; `data.verdict === "ok"`; the restoration report names each action and its observation with non-empty evidence.
- No committed work becomes unreachable; no silent deletion occurs.

#### TC-WATCHDOG-021 - Teardown restores after a failure exit

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; fixture `FIX-FAIL-EXIT`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A lane that exited by failure: uncommitted work in the tree plus a stray commit on the lane branch, with the lane branch checked out.

**Steps**:
1. Snapshot content hashes and refs.
2. Run teardown.
3. Assert safe state, content preservation/restoration, and the report.

**Expected Outcome**:
- The checkout ends at the declared base; the stray work is either restored (attributed) or preserved-and-reported; no unreported residue remains.
- Exit is `0` for a successful restoration; the report names each action and evidence.
- Every pre-existing content item is either still present or explicitly reported as restored/removed by an attributed action; no silent loss.

#### TC-WATCHDOG-022 - Teardown restores after an interrupted lane (stranded commit)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; fixture `FIX-INTERRUPTED`
**Tags**: @backend, @git, @cli

**Preconditions**:
- The post-interruption repository state: detached HEAD, a stranded commit not reachable from any branch, an uncommitted change, and an uncommitted `.ai/memory` publication.
- Interruption is represented by repository facts; no signal is delivered to the test process.

**Steps**:
1. Record the stranded commit hash and the content hashes.
2. Run teardown.
3. Assert the safe state and the report.
4. Assert the stranded commit and uncommitted content remain reachable/present and are named.

**Expected Outcome**:
- The repository ends at the declared base; stranded work is restored to an attributed ref or preserved and reported with evidence.
- No stranded commit becomes unreachable without a report entry; no content is silently discarded.
- A mutant teardown that drops the stranded commit without reporting fails.

**Notes / Clarifications**:
- "On every exit path" is a caller-invoked contract, not a signal handler inside the command. This fixture is the correct way to prove the interruption path without process-signal flakiness.

#### TC-WATCHDOG-023 - Teardown is unconditional on a clean exit

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F2-1, F-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; fixture `FIX-CLEAN`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A lane that exited cleanly with no residue and a checkout already at the base.

**Steps**:
1. Run teardown.
2. Assert a restoration report is still produced.
3. Run teardown a second time and compare normalized reports.

**Expected Outcome**:
- Teardown runs and reports "nothing to restore" actions with evidence; it is not skipped.
- Exit is `0`; the second run is stable (idempotent report semantics), with no mutation.

#### TC-WATCHDOG-024 - Committed memory publication is reported committed

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DM-4, NFR-5, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-memory.test.ts`; fixture `FIX-MEM-COMMITTED`
**Tags**: @backend, @git, @memory, @cli

**Preconditions**:
- A `.ai/memory/agents/watchdog-fixture/README.md` publication is committed on the lane branch.

**Steps**:
1. Record the file content hash and the commit.
2. Run teardown.
3. Inspect the restoration report's memory-publication entries.

**Expected Outcome**:
- The publication is reported with status `committed` and evidence naming the file and commit.
- The content remains byte-identical; exit `0`.
- No second status or duplicate entry appears for the same publication.

#### TC-WATCHDOG-025 - Uncommitted memory publication is preserved byte-identically and reported

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, F-3, DM-4, NFR-5, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-memory.test.ts`; fixture `FIX-MEM-UNCOMMITTED`
**Tags**: @backend, @git, @memory, @cli

**Preconditions**:
- A modified tracked `.ai/memory` file and an untracked new `.ai/memory` file, each containing a unique canary byte string.

**Steps**:
1. Record path, existence, bytes, and SHA-256 for each file.
2. Run teardown.
3. Re-read each file and compare bytes and hashes.
4. Inspect the restoration report for the publications.
5. Re-read `git status --porcelain` for the memory paths.

**Expected Outcome**:
- Both files still exist at the same paths with byte-identical contents (hash equality).
- The report lists each publication with status `preserved` and evidence naming the path and reason.
- The changes are still present in the working tree/index as before; teardown did not stage, commit, revert, or clean them.
- Exit is `0`; no data loss.

#### TC-WATCHDOG-026 - Teardown never deletes or clobbers uncommitted memory (destructive negatives)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, F-3, NFR-5, RSK-2, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-memory.test.ts`; fixture `FIX-MEM-UNCOMMITTED` variants; recording git child runner in `tests/fixtures/watchdog/harness.ts`
**Tags**: @backend, @git, @memory, @security

**Preconditions**:
- Four variants: modified tracked memory file, untracked memory file, staged memory change, and a memory file whose path resembles lane residue.
- A recording git child runner logs every argv.

**Steps**:
1. Snapshot bytes, index state, and existence for each variant.
2. Run teardown.
3. Assert bytes, index state, and existence are unchanged.
4. Assert the git call log contains no destructive operation scoped to `.ai/memory`: no `checkout -- .ai/memory`, no `clean` covering `.ai/memory`, no `reset --hard` while memory is dirty, no `stash drop`, no file delete.
5. Non-vacuity: run a mutant teardown that performs `git checkout -- .ai/memory` (or `git clean -fd .ai/memory`) in a temp fixture and assert the preservation assertion fails.

**Expected Outcome**:
- Zero variant loses or alters memory content; zero destructive git operations target `.ai/memory`.
- The mutant is caught, proving the negative assertion is not vacuous.
- The report still names each preserved publication.

#### TC-WATCHDOG-027 - Unattributable content is preserved and reported

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-2, F-2, NFR-3, RSK-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; fixture `FIX-UNATTRIBUTED`
**Tags**: @backend, @git, @cli

**Preconditions**:
- An untracked file unrelated to the lane (for example `notes.local`) exists before teardown.

**Steps**:
1. Record the file existence and bytes.
2. Run teardown.
3. Assert the file remains and the report names it as unattributed/preserved.

**Expected Outcome**:
- Unattributable content is preserved, never silently removed.
- The report carries an entry with evidence explaining the preservation.
- A mutant that deletes unattributed content fails.

#### TC-WATCHDOG-028 - Restoration report carries evidence for every action

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, AC-F2-2, F-2, F-3, DM-3, DM-4, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; golden report in `tests/golden/watchdog-output.test.ts`
**Tags**: @backend, @cli, @contract

**Preconditions**:
- Teardown fixtures covering a restored checkout, a preserved commit, and a preserved memory publication.

**Steps**:
1. Run teardown for each fixture.
2. Validate the report shape: an ordered list of actions, each with an action kind, an observation, and a non-empty evidence string; memory publications carry a status.
3. Assert stable ordering across runs.
4. Assert no action is present without evidence and no evidence entry lacks an associated action.

**Expected Outcome**:
- The report is total: every action has evidence and every preserved/restored item is named.
- Ordering is deterministic.
- A mutant report entry with empty evidence fails the totality assertion.

#### TC-WATCHDOG-029 - Teardown failure is classified, never silent

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-2, F-5, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts`; fixture with an injected git child failure or an unresolvable base
**Tags**: @backend, @git, @cli

**Preconditions**:
- A restoration step is forced to fail (injected child-runner failure or base ref removed mid-fixture).

**Steps**:
1. Run teardown.
2. Parse the single envelope.
3. Assert the exit and error object.

**Expected Outcome**:
- Exit is `1` or `2` per the classifying row; exactly one failure envelope with code, category, retryable, consequence, remediation hint, and a summary naming the failed action.
- `data` is absent; no `ok` verdict and no `data.verdict` appears.
- The failure is not `fallback.internal` for a documented class; a mutant that swallows the failure and exits `0` fails.

#### TC-WATCHDOG-030 - Stranded/foreign matrix is exhaustively refused or restored

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, F-1, F-2, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-teardown.test.ts` and `watchdog-preflight.test.ts`; matrix in `tests/fixtures/watchdog/cases.ts`
**Tags**: @backend, @git, @cli

**Preconditions**:
- A table-driven matrix over the two ticket families:
  - **Foreign**: foreign branch commit, foreign `git worktree` checkout, unrelated branch with a commit.
  - **Stranded**: stranded commit after interruption, stray commit after failure, uncommitted tree after success, uncommitted memory publication.
- Clean controls exist for each family.

**Steps**:
1. For each matrix row, run the relevant probe (preflight for foreign admission; teardown for stranded exit).
2. Record the outcome: refused (code + evidence) or restored/preserved (report + evidence).
3. Assert every row is one of those two and none is silent.
4. Assert the clean controls are admitted/`ok`, proving the matrix is not vacuous.

**Expected Outcome**:
- 100% of rows end refused (`1`, named code, evidence) or restored/preserved (report with evidence).
- Zero silent outcomes; zero unreported residue.
- The matrix is exhaustive over the two families named by the ticket AC.

#### TC-WATCHDOG-040 - Absent signal sources classify as unknown, exit `2`, no verdict

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, F-4, NFR-1, DEC-2, RSK-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-liveness.test.ts`; fixture `FIX-NO-SIGNALS`
**Tags**: @backend, @cli, @contract

**Preconditions**:
- A lane whose heartbeat, traffic, and token-delta sources are all unavailable.

**Steps**:
1. Run `watchdog liveness lane-1 --json`.
2. Parse the single envelope and inspect every field.
3. Search the entire payload for any verdict value.
4. Run the same fixture again and compare normalized output.

**Expected Outcome**:
- Exit is `2`; exactly one failure envelope with `error.code: "watchdog.signals-absent"` and correct error fields.
- No `verdict` key or verdict value (`ok`, `refused`, `stalled`, `progressing`) appears anywhere in the payload; `data` is absent.
- The evidence-bearing summary states that the answer is unknown because no signal sources are available.
- The replay is identical; no guessed verdict is ever produced.

**Notes / Clarifications**:
- This is the M1-S15 boundary assertion (NG-1): absent sources are unknown, never guessed. The sourced control is deferred (GAP-T1).

#### TC-WATCHDOG-041 - Verdict vocabulary is exact and contract-only for unreachable values

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, DM-1, DEC-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/watchdog-contract.test.ts`
**Tags**: @contract, @backend

**Preconditions**:
- The verdict union and vocabulary are declared in the contract module.

**Steps**:
1. Assert the exact set/order `ok`, `refused`, `stalled`, `progressing`; no duplicate, no extra.
2. Assert one home: no other file under `packages/` redeclares the list or all four values.
3. Assert every element is a string literal in the `as const` declaration, so the union and the runtime list cannot drift.
4. Assert no M1-S1 runtime path produces `stalled` or `progressing`: the liveness no-sources fixture (TC-WATCHDOG-040) emits no verdict, and no other command emits those values.
5. Document in the test name/comment that `stalled`/`progressing` are declared contract values reserved for M1-S15.

**Expected Outcome**:
- The vocabulary is exact and single-homed.
- `stalled` and `progressing` exist as contract data only; a mutation adding a fifth value or a second declaration fails.
- No test asserts them as reachable outcomes.

#### TC-WATCHDOG-042 - A CPU-only reading can never classify `stalled`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-2, F-4, NFR-1, DEC-3, RSK-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-liveness.test.ts`; pure classifier in `packages/core/src/domain/watchdog.ts` (expected); fixture `FIX-PREFILL`
**Tags**: @backend, @contract

**Preconditions**:
- The pure liveness classifier accepts the declared signals shape, not a CPU reading.
- A prefill fixture: a (re)started session consuming input with no output, represented by absent/empty declared progress signals and a CPU-busy extra fact.

**Steps**:
1. Call the classifier with `heartbeatAgeMs`, `tokenDelta`, `traffic` all absent/undefined, plus a CPU-only extra fact.
2. Assert the result is the classified absent outcome (mapped to `watchdog.signals-absent` at the command boundary), never a verdict.
3. Repeat across variants: CPU busy, CPU idle, CPU high, CPU low, and an explicit object with a `cpu` field.
4. Assert no CPU-only variant returns a verdict and no code path returns `stalled` without declared progress-signal corroboration.
5. Non-vacuity: a mutant that maps CPU-busy alone to `stalled` fails.

**Expected Outcome**:
- CPU-only facts always classify as unknown; `stalled` is unreachable without progress-signal corroboration.
- A prefilling or resuming session can never read as stalled.
- The classifier is pure and deterministic (no clock/IO).

#### TC-WATCHDOG-043 - Verdict-bearing data carries verdict, signals, and evidence

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-2, F-4, DM-2, DM-3, DEC-2
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-liveness.test.ts`; pure data/projection builder
**Tags**: @backend, @contract

**Preconditions**:
- A sourced-fact fixture built from the declared signals shape (not real ingestion): `heartbeatAgeMs`, `tokenDelta`, `traffic` present.

**Steps**:
1. Project the fixture through the data builder used by the command under `--json`.
2. Assert the data keys `verdict`, `signals`, and `evidence` are present.
3. Assert `verdict` is one of the declared vocabulary values and `signals` has exactly the declared keys with valid value types.
4. Assert `evidence` is a non-empty string.
5. Assert preflight admission and teardown success data also carry `verdict` and `evidence` (signals may be empty when not applicable).

**Expected Outcome**:
- Verdict-bearing outcomes carry `verdict`, `signals`, and `evidence` in `data`.
- The shape is contract-stable for M1-S15 to populate.
- No production code claims a sourced verdict in M1-S1; this is a serialization/contract case.

#### TC-WATCHDOG-050 - Every invocation emits exactly one valid exclusive envelope

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-2, F-5, NFR-2, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-envelope.test.ts`; golden half in `tests/golden/watchdog-output.test.ts`
**Tags**: @backend, @cli, @contract

**Preconditions**:
- The full fixture matrix: clean admission, dirty refusal, off-base refusal, teardown success, teardown failure, signals-absent, grammar failure, unknown lane.

**Steps**:
1. For each fixture, run `--json` through `runCli` with injected streams.
2. Assert stdout parses as exactly one JSON document (no trailing content) and contains exactly one `schemaVersion` occurrence.
3. Assert the four mandatory fields (`schemaVersion`, `runId`, `exitCode`, `timing`) are present.
4. Assert exactly one of `data`/`error` is present; success carries `data` and no `error`; failure carries `error` and no `data`.
5. Assert failure errors carry code, category, retryable, consequence, remediation hint, and a non-empty summary; success data is non-undefined.
6. Assert stderr carries no envelope under `--json`.
7. Assert the envelope `exitCode` equals the numeric return value.

**Expected Outcome**:
- Exactly one valid envelope per invocation across the whole matrix.
- Zero double payloads, zero empty payloads, zero missing mandatory fields.
- The golden files for canonical envelopes match after normalization.

**Notes / Clarifications**:
- Reuse `assertEnvelopeContract` from `@delivery-os/testkit` for the shared envelope-contract half; add watchdog-specific assertions for exclusivity and evidence on top. Do not fork a second envelope validator.

#### TC-WATCHDOG-051 - Text verdict lines carry the same evidence as `--json`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F5-2, F-5, DM-3
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-envelope.test.ts`; `tests/golden/watchdog-output.test.ts`
**Tags**: @backend, @cli, @golden

**Preconditions**:
- Text-mode fixtures for admission, refusal, teardown, and signals-absent.

**Steps**:
1. Run each fixture without `--json`.
2. Assert stdout is a verdict/restoration line (no envelope JSON, no `schemaVersion`).
3. Assert the text contains the same evidence tokens as the corresponding `--json` run (base, actual, dirty state, action, unknown reason).
4. Assert diagnostics go to stderr and use the injected brand name.

**Expected Outcome**:
- Text mode carries the same evidence as the machine envelope.
- No envelope leaks into text mode; no evidence is lost in the human rendering.
- Goldens are normalized and committed.

#### TC-WATCHDOG-052 - Parser and grammar failures reuse existing identities

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-3, F-5, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-envelope.test.ts`
**Tags**: @backend, @cli

**Preconditions**:
- The `watchdog` command is registered; the shared parser is unchanged.

**Steps**:
1. Run the grammar matrix: `watchdog` with no subcommand, `watchdog bogus`, `watchdog preflight` with no lane, `watchdog preflight lane extra`, `watchdog preflight --bogus lane`, and an unknown top-level command.
2. Record the identity and exit for each.
3. Assert the known-command grammar failures resolve to the existing handler identity (`input.value.rejected`) and the parser-level failures to `fallback.invocation`.
4. Assert no documented class resolves to `fallback.internal`.
5. Assert no lane I/O occurs after a grammar rejection (recording runtime call log is empty or read-free).

**Expected Outcome**:
- Every grammar failure is classified through an existing identity and exits non-zero.
- Zero `fallback.internal` occurrences for documented classes.
- Rejections occur before any lane read.

#### TC-WATCHDOG-053 - Unknown or unresolvable lane reuses the handler identity

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-3, F-5, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-envelope.test.ts`
**Tags**: @backend, @cli

**Preconditions**:
- A lane identifier that does not resolve to any lane record, and a malformed lane identifier.

**Steps**:
1. Run each probe (preflight/teardown/liveness) with the unresolvable lane.
2. Assert exit, envelope side, identity, and summary.
3. Assert the summary names the lane and the next action.
4. Assert the outcome is never `fallback.internal` and never an `ok` verdict.

**Expected Outcome**:
- Unresolvable/malformed lanes classify through the documented handler identity (`input.value.rejected`) with exit `1`.
- The failure is evidence-bearing, names the lane, and performs no mutation.

#### TC-WATCHDOG-054 - Exits stay within `{0,1,2}` and exit `2` is reserved

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-exit.test.ts`
**Tags**: @backend, @cli

**Preconditions**:
- The full fixture matrix from TC-WATCHDOG-050.

**Steps**:
1. Collect every returned exit code and envelope `exitCode`.
2. Assert the set is a subset of `{0, 1, 2}` and the returned code equals the envelope code.
3. Assert exit `0` occurs only for `ok`/`progressing`-class successes.
4. Assert exit `1` occurs only for refusals, grammar/validation failures, and `stalled`-class outcomes (the latter declared-only).
5. Assert exit `2` occurs only for classified probe-unavailable (`watchdog.signals-absent`) or a classified platform teardown failure.

**Expected Outcome**:
- No exit outside `{0,1,2}`, ever.
- Exit `2` is reserved for classified unavailability; a refusal never exits `2` and an unavailable probe never exits `0`.

#### TC-WATCHDOG-060 - The surface never dispatches, spawns, kills, or supervises

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, DEC-4, NG-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-checks-not-runner.test.ts`; recording runtime in `tests/fixtures/watchdog/harness.ts`
**Tags**: @backend, @cli, @security

**Preconditions**:
- The watchdog runtime exposes only lane/checkout reads and the restoration operations it needs.
- A recording double counts `dispatch`, `spawnSession`, `kill`, `restart`, and `supervise` calls (expected zero because the ports do not exist).

**Steps**:
1. Run every fixture across preflight, teardown, and liveness.
2. Assert the runtime call log contains no dispatch, spawn, session-kill, restart-budget, or supervision call.
3. Statically scan the command module and adapter seam for imports of session/host/opencode adapters or run-oriented ports; assert none.
4. Assert the grammar has no run-oriented verbs (cross-ref TC-WATCHDOG-007).
5. Non-vacuity: a mutant command that imports a session adapter or calls a spawn port fails the scanner.

**Expected Outcome**:
- Zero dispatch/spawn/kill/restart/supervision side effects across all fixtures.
- The surface only evaluates and restores; local `git` subprocesses for inspection/restoration are expected and are not "spawning a lane/session".
- The runner distinction is proven by both behaviour and structure.

**Notes / Clarifications**:
- Do not assert "zero child processes at all": local `git` execution is the mechanism for checkout-state inspection. The prohibition is lane/session dispatch, spawn, kill, restart, and supervision.

#### TC-WATCHDOG-070 - Identical facts replay to identical verdict, evidence, and exit

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/watchdog-determinism.test.ts`; goldens under `tests/fixtures/watchdog/golden/`
**Tags**: @backend, @cli, @golden

**Preconditions**:
- Deterministic injected clock, run-id generator, and brand.
- Two structurally identical repositories created under different temp roots, and one repository run twice.

**Steps**:
1. Run each probe twice against the same fixture; normalize `runId`, `timing`, and the absolute repository root.
2. Run against a second structurally identical repository; normalize identically.
3. Compare verdict, evidence, report action order, and exit.
4. Assert the raw (pre-normalization) evidence contains the semantic refs/branch names, proving normalization did not erase meaning.

**Expected Outcome**:
- Identical checkout/lane facts produce identical verdict, evidence, and exit.
- Restoration report ordering is stable.
- Zero replay drift; the normalizer only replaces the temp root and volatile run fields, never semantic evidence.

## 6. Environments and Test Data

- **Environments**: local development and CI. Bun `1.4.4` per `.bun-version`; `git` available on PATH; no network, no credentials, no real `$HOME` reads, no live provider.
- **Repository isolation**: every checkout-state fixture is created with `mkdtemp(join(tmpdir(), "gh221-watchdog-"))`, initialized with an explicit default branch (`git init -b main`) and a fixed author identity. `git worktree add` creates real lane/foreign worktrees. Fixtures are removed in `afterEach`/`afterAll`. The live workspace is never written; structure scans that must read it assert `git status --porcelain` is unchanged before and after (the pattern in `tests/checks/forbidden-literals.test.ts`).
- **Ticket AC family fixture strategy**: foreign-commit scenarios are real branch and `git worktree` checkouts refused at admission by `preflight`; stranded-commit scenarios are real branch, detached-HEAD, and dirty-working-tree states restored or preserved-and-reported by `teardown`. Checkout state is never mocked: the adapter seam runs against the real temporary repository, and only clocks, brand, streams, run-ids, and failure injection are doubled.
- **Lane identity fixtures**: a small committed table in `tests/fixtures/watchdog/cases.ts` names each fixture (`FIX-CLEAN`, `FIX-DIRTY`, `FIX-OFFBASE`, `FIX-FOREIGN-WORKTREE`, `FIX-SUCCESS-RESIDUE`, `FIX-FAIL-EXIT`, `FIX-INTERRUPTED`, `FIX-MEM-COMMITTED`, `FIX-MEM-UNCOMMITTED`, `FIX-UNATTRIBUTED`, `FIX-NO-SIGNALS`, `FIX-PREFILL`, `FIX-BASE-MISSING`, `FIX-TORN`) and its expected family/outcome. The matrix is code-reviewed data, not prose.
- **Memory data**: files under `.ai/memory/agents/watchdog-fixture/` with fixed canary bytes; preservation is asserted by SHA-256 before/after, path equality, existence, and working-tree/index status. Byte-identical means identical bytes at the same path; file-mode preservation is not asserted unless the delivery plan adds it explicitly.
- **Golden data**: canonical envelopes and text reports are committed under `tests/fixtures/watchdog/golden/`. Normalization replaces the temp repository root with a fixed token and removes `runId`/`timing`; it never removes branch names, refs, codes, or evidence text. Goldens are regenerated by an explicit command, never blanket-rewritten.
- **Injected determinism**: `CliDependencies` supplies a fixed clock, a monotonic run-id generator, a synthetic brand, and buffer sinks. No test uses `Date.now`, `Math.random`, `$HOME`, sleeps, network, or order-dependent state.
- **Test data hygiene**: no product-name literals in fixture content that falls inside the forbidden-literal scan scope; use the synthetic brand and neutral fixture names. No secrets or host paths in evidence; temp roots are normalized out of goldens.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Execution command | Mocking / fixtures | Status |
|-------|-----------|-------------------|--------------------|--------|
| TC-WATCHDOG-001 | `tests/structure/watchdog-contract.test.ts` | `bun test tests/structure/watchdog-contract.test.ts` | AST scans; temp-copy mutants | To Implement |
| TC-WATCHDOG-002 | `tests/structure/watchdog-imports.test.ts` | `bun test tests/structure/watchdog-imports.test.ts`; `bun test tests/boundaries` | AST scans; temp-copy mutants; production depcruise rules | To Implement |
| TC-WATCHDOG-003 | `tests/structure/error-table.test.ts` | `bun test tests/structure/error-table.test.ts` | In-memory table; no mocks | Existing – Update |
| TC-WATCHDOG-004 | `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora/*.json` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Temp-copy mutation roots per existing suite | Existing – Update |
| TC-WATCHDOG-005 | `tests/behaviour/watchdog-exit.test.ts` | `bun test tests/behaviour/watchdog-exit.test.ts` | Matrix fixtures; real git; injected streams | To Implement |
| TC-WATCHDOG-006 | `tests/structure/watchdog-imports.test.ts` | `bun test tests/structure/watchdog-imports.test.ts`; `pnpm check:forbidden-literals` | Seed-literal matcher; synthetic brand; temp-copy mutant | To Implement |
| TC-WATCHDOG-007 | `tests/structure/watchdog-imports.test.ts` | `bun test tests/structure/watchdog-imports.test.ts` | Command definition introspection | To Implement |
| TC-WATCHDOG-010 | `tests/behaviour/watchdog-preflight.test.ts` | `bun test tests/behaviour/watchdog-preflight.test.ts` | Real temp repo; `FIX-DIRTY`; injected streams | To Implement |
| TC-WATCHDOG-011 | `tests/behaviour/watchdog-preflight.test.ts` | `bun test tests/behaviour/watchdog-preflight.test.ts` | Real temp repo + real `git worktree`; `FIX-OFFBASE`, `FIX-FOREIGN-WORKTREE` | To Implement |
| TC-WATCHDOG-012 | `tests/behaviour/watchdog-preflight.test.ts` | `bun test tests/behaviour/watchdog-preflight.test.ts` | Real temp repo; `FIX-CLEAN` | To Implement |
| TC-WATCHDOG-013 | `tests/behaviour/watchdog-preflight.test.ts` | `bun test tests/behaviour/watchdog-preflight.test.ts` | Recording runtime; real git facts | To Implement |
| TC-WATCHDOG-014 | `tests/behaviour/watchdog-preflight.test.ts` | `bun test tests/behaviour/watchdog-preflight.test.ts` | `FIX-BASE-MISSING`; injected read failure | To Implement |
| TC-WATCHDOG-015 | `tests/behaviour/watchdog-preflight.test.ts` | `bun test tests/behaviour/watchdog-preflight.test.ts` | Torn state record; contradictory checkout fixture | To Implement |
| TC-WATCHDOG-020 | `tests/behaviour/watchdog-teardown.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts` | `FIX-SUCCESS-RESIDUE`; real git | To Implement |
| TC-WATCHDOG-021 | `tests/behaviour/watchdog-teardown.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts` | `FIX-FAIL-EXIT`; real git | To Implement |
| TC-WATCHDOG-022 | `tests/behaviour/watchdog-teardown.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts` | `FIX-INTERRUPTED`; real git | To Implement |
| TC-WATCHDOG-023 | `tests/behaviour/watchdog-teardown.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts` | `FIX-CLEAN`; real git | To Implement |
| TC-WATCHDOG-024 | `tests/behaviour/watchdog-memory.test.ts` | `bun test tests/behaviour/watchdog-memory.test.ts` | `FIX-MEM-COMMITTED`; real git | To Implement |
| TC-WATCHDOG-025 | `tests/behaviour/watchdog-memory.test.ts` | `bun test tests/behaviour/watchdog-memory.test.ts` | `FIX-MEM-UNCOMMITTED`; SHA-256 comparison | To Implement |
| TC-WATCHDOG-026 | `tests/behaviour/watchdog-memory.test.ts` | `bun test tests/behaviour/watchdog-memory.test.ts` | Four memory variants; recording git child runner; temp-copy destructive mutant | To Implement |
| TC-WATCHDOG-027 | `tests/behaviour/watchdog-teardown.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts` | `FIX-UNATTRIBUTED` | To Implement |
| TC-WATCHDOG-028 | `tests/behaviour/watchdog-teardown.test.ts`; `tests/golden/watchdog-output.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts tests/golden/watchdog-output.test.ts` | Report fixtures; normalized goldens | To Implement |
| TC-WATCHDOG-029 | `tests/behaviour/watchdog-teardown.test.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts` | Injected child failure / missing base | To Implement |
| TC-WATCHDOG-030 | `tests/behaviour/watchdog-teardown.test.ts`; `tests/behaviour/watchdog-preflight.test.ts`; `tests/fixtures/watchdog/cases.ts` | `bun test tests/behaviour/watchdog-teardown.test.ts tests/behaviour/watchdog-preflight.test.ts` | Full matrix; real git/worktrees; clean controls | To Implement |
| TC-WATCHDOG-040 | `tests/behaviour/watchdog-liveness.test.ts` | `bun test tests/behaviour/watchdog-liveness.test.ts` | `FIX-NO-SIGNALS`; injected streams | To Implement |
| TC-WATCHDOG-041 | `tests/structure/watchdog-contract.test.ts` | `bun test tests/structure/watchdog-contract.test.ts` | Contract data; AST scan | To Implement |
| TC-WATCHDOG-042 | `tests/behaviour/watchdog-liveness.test.ts` | `bun test tests/behaviour/watchdog-liveness.test.ts` | Pure classifier; `FIX-PREFILL`; CPU-only variants | To Implement |
| TC-WATCHDOG-043 | `tests/behaviour/watchdog-liveness.test.ts` | `bun test tests/behaviour/watchdog-liveness.test.ts` | Sourced-fact contract fixture; data builder | To Implement |
| TC-WATCHDOG-050 | `tests/behaviour/watchdog-envelope.test.ts`; `tests/golden/watchdog-output.test.ts` | `bun test tests/behaviour/watchdog-envelope.test.ts tests/golden/watchdog-output.test.ts` | Full matrix; buffer sinks; normalized goldens | To Implement |
| TC-WATCHDOG-051 | `tests/behaviour/watchdog-envelope.test.ts`; `tests/golden/watchdog-output.test.ts` | `bun test tests/behaviour/watchdog-envelope.test.ts tests/golden/watchdog-output.test.ts` | Text fixtures; synthetic brand; goldens | To Implement |
| TC-WATCHDOG-052 | `tests/behaviour/watchdog-envelope.test.ts` | `bun test tests/behaviour/watchdog-envelope.test.ts` | Grammar matrix; recording runtime | To Implement |
| TC-WATCHDOG-053 | `tests/behaviour/watchdog-envelope.test.ts` | `bun test tests/behaviour/watchdog-envelope.test.ts` | Unresolvable lane fixtures | To Implement |
| TC-WATCHDOG-054 | `tests/behaviour/watchdog-exit.test.ts` | `bun test tests/behaviour/watchdog-exit.test.ts` | Full matrix | To Implement |
| TC-WATCHDOG-060 | `tests/behaviour/watchdog-checks-not-runner.test.ts` | `bun test tests/behaviour/watchdog-checks-not-runner.test.ts` | Recording runtime; AST scan; temp-copy mutant | To Implement |
| TC-WATCHDOG-070 | `tests/behaviour/watchdog-determinism.test.ts` | `bun test tests/behaviour/watchdog-determinism.test.ts` | Two identical temp repos; injected clock/run-id/brand; goldens | To Implement |

**Fixture helper obligations**:

- `tests/fixtures/watchdog/temp-git.ts` — real repositories with an explicit base branch, a lane branch, configurable dirty/off-base/stranded states, `git worktree add` support, `.ai/memory` writes, and a `remove()` that deletes the temp root.
- `tests/fixtures/watchdog/harness.ts` — `runWatchdogCli` over `runCli`, buffer sinks, synthetic brand/clock/run-id, a recording lane runtime, and a recording git child runner.
- `tests/fixtures/watchdog/cases.ts` — the committed fixture/outcome matrix used by TC-WATCHDOG-005, 030, 050, 054, and 070.
- `tests/fixtures/watchdog/golden/` — normalized canonical envelopes and text reports.

**Expected gate battery for this change**:

1. Narrow iteration: `bun test tests/structure/watchdog-contract.test.ts tests/structure/watchdog-imports.test.ts tests/structure/error-table.test.ts` and `bun test tests/behaviour/watchdog-*.test.ts`.
2. Binding and brand: `bun run scripts/checks/error-table-sync.ts` and `pnpm check:forbidden-literals`.
3. Boundaries: `bun test tests/boundaries` (expected no rule change; a rule change without a negative fixture fails the meta-check).
4. Aggregate: `pnpm check` (lint → format:check → typecheck → test → check:boundaries → exports parity) plus `git diff --check`.
5. What the aggregate proves for this change: the new modules typecheck under strict flags, satisfy every layering/ambient rule with no rule loosening, pass the full existing suite (including updated error-table counts), and export correctly. It does not prove signal ingestion, daemon consumption, or any out-of-scope behaviour.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | The signals-absent evidence carrier is ambiguous because the v1 envelope is exclusive (error vs. data evidence). | M | Tests assert a non-empty evidence string on the non-empty envelope side, no verdict anywhere, exit `2`, and the exact code. The exact failure field path is delivery-bound within that constraint (GAP-T5). |
| TR-2 | `stalled` exit `1` has no declared error identity; a future implementation could force a misleading identity. | M | TC-WATCHDOG-005/041 assert it as declared contract data only; §8.3 records the M1-S15 decision obligation. |
| TR-3 | Real git/worktree fixtures are slower and can be flaky across environments (default branch names, worktree paths, file modes). | M | Explicit `git init -b main`, fixed author identity, temp roots only, bounded commands, no reliance on host config, cleanup in `afterEach`. |
| TR-4 | "Restore on every exit" is not observable as an in-process signal handler; a naive test could send signals and become flaky. | M | Interruption is represented by post-interruption repository facts; tests never deliver signals to the test process. |
| TR-5 | Destructive-adjacent teardown tests could clobber the live workspace. | H | Every fixture is under `mkdtemp`; a guard rejects any fixture root equal to `process.cwd()`; the live tree is never a teardown target. |
| TR-6 | Existing hardcoded error-table counts (`41`) fail when three rows are added. | L | Update the exact counts to `44` in the same phase; never loosen to a `toBeGreaterThan` bound. |
| TR-7 | Golden normalization can mask real evidence differences. | M | Normalize only the temp root and volatile `runId`/`timing`; assert raw evidence still contains branch/ref names; review golden diffs deliberately. |
| TR-8 | "No spawn" could be misread as "no child process", conflicting with the git adapter. | M | TC-WATCHDOG-060 scopes the prohibition to lane/session dispatch, spawn, kill, restart, and supervision; local git execution is expected. |
| TR-9 | Brand scan fixtures could themselves contain seed literals and create noise. | L | Fixtures live outside the scanned `packages/` scope and use neutral names; the mutant probe is in-memory/temp-copy only. |
| TR-10 | Memory byte-identity assertions may over-constrain mode/ownership. | L | Assert bytes, path, existence, and working-tree/index state; do not assert mode unless the plan adds it. |
| TR-11 | Unreachable `stalled`/`progressing` values could be accidentally asserted as reachable, creating a false success claim. | H | TC-WATCHDOG-041/043 name them as contract/serialization cases; TC-WATCHDOG-040 asserts no verdict at all; reviews check that no fixture claims a sourced outcome. |

### 8.2 Assumptions

- The lane identifier and declared base ref are resolvable from existing lane context (spec §12); fixtures inject both.
- Teardown is invoked explicitly by the caller on every exit path; there is no daemon or signal handler inside this story.
- The v1 envelope, closed error table, `{0,1,2}` projection, and branding seam remain unchanged (NG-4, NG-5).
- The three watchdog identities are exactly the spec's names; no fourth identity is added.
- Documented error-table rows land in `doc/spec/features/feature-result-contract.md` in the same delivery phase as the table rows (NFR-7), even though the watchdog feature spec is a phase-7 deliverable.
- Local `git` execution through the adapter seam is the expected mechanism for checkout-state inspection and restoration; it is not a lane/session spawn.
- The new contract/domain/command modules slot into the existing package tiers without a dependency-matrix change; if a matrix change proves necessary, a negative fixture is required in the same change.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-T1 | For a failure envelope, is the evidence exactly `error.summary`, or does the plan want a dedicated evidence field? The v1 envelope forbids carrying both `data` and `error`, so evidence cannot ride `data` on failures. | No — tests assert a non-empty evidence string on the non-empty side plus the exact code/exit. | @plan-writer / @coder |
| OQ-T2 | How will M1-S15 represent a sourced `stalled` outcome at exit `1`? The v1 projection derives exit from the envelope side, and no error identity is declared for stall. Options: add a decision/identity, or a verdict-driven exit mechanism. | No for M1-S1 (unreachable); yes for M1-S15. | @decision-advisor / M1-S15 owner |
| OQ-T3 | Which existing identity classifies a torn/impossible lane fact (`state.store.torn` vs `input.value.rejected`)? No new watchdog identity may be added. | No — tests assert "classified, non-zero, never `ok`", not a specific code. | @plan-writer / @coder |
| OQ-T4 | Where does teardown preserve a stranded commit (attributed branch, tag, stash, or patch file)? | No — tests assert no-loss, reachability, and a report entry, not a fixed location. | @plan-writer / @coder |
| OQ-T5 | Does the delivery plan intend a dedicated `watchdog` adapter subpath, or an extension of the existing git seam? Either is acceptable; the tier rules and no-spawn assertions apply. | No. | @plan-writer |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | test-plan-writer | Initial test plan derived from `chg-GH-221-spec.md` v1.0, the GH-221 ticket scope, and the repository testing strategy. 35 scenarios; all 14 ACs covered; M1-S15 boundary and GAP-T2 recorded. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not run | Populated during delivery and quality gates. |
