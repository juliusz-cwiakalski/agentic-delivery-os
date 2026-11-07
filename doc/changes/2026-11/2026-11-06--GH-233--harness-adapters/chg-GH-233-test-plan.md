---
id: chg-GH-233-test-plan
status: Updated
version: 1.2
created: 2026-11-06T00:00:00Z
last_updated: 2026-11-07T00:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, harness, adapters, telemetry, dispatch-portability]
version_impact: minor
summary: "Prove the harness seam: one neutral port surface with two delivery adapters that classify identical delivery scenarios identically, declare their gaps instead of implying parity, build the spawn environment from a deny-by-default allowlist so undeclared parent variables (credentials included) are testably absent, resolve credentials through the credential port at use time, source harness-agnostic liveness without guessing, extract session statistics read-only (read-only mode plus query-only pragma; bounded indexed queries; file reads only), and capture them at closeout as additive, schema-versioned, idempotent, non-gating telemetry records that the event log alone can serve. The battery is hermetic: injected harness I/O, synthetic session stores, no live harness, no network, no real credentials, and no harness-store re-query."
links:
  change_spec: ./chg-GH-233-spec.md
  implementation_plan: ./chg-GH-233-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S11: Harness adapters and dispatch portability

## 1. Scope and Objectives

This plan protects five contracts at once. **Classification identity** is structural, not behavioral luck: adapters normalize harness facts into one neutral evidence shape and exactly one shared classifier emits the delivery-result token, so the same delivery scenario cannot classify differently on opencode and Claude Code (DEC-10). **Spawn-environment containment** is fail-closed: the child environment is built from the declared allowlist alone, so an undeclared parent variable — a credential among them — is testably absent, and credentials resolve through the credential port at spawn time rather than by inheritance (DEC-2, NFR-5, NFR-9). **Liveness honesty** means a signal kind a harness cannot source is a declared absent value, never a guessed zero (DEC-9). **Telemetry durability and read-only extraction** mean harness stores are read strictly read-only and bounded, and the delivery's statistics land in the state-layer event log at closeout as additive, schema-versioned records that survive the store being pruned, with capture idempotent and non-gating (DEC-5, DEC-6). **Neutrality** means no harness name, store path, or host-execution assumption exists outside adapters and declared configuration (NFR-8, DEC-8).

The residual risk this plan cannot remove is RSK-4: the proof runs over injected harness I/O in the deterministic mock tier, so it proves the boundary and the shared classifier, not a live harness's behavior. §8.1 states that boundary explicitly; §4.2 and §4.9 make divergence and vacuity structural failures instead of test-coverage claims.

### 1.1 In Scope

- The harness primitive contract vocabulary: harness kinds, operations, lifecycle capabilities, liveness signal kinds, gap records, the `HarnessInstance` identity (kind, observed version, capabilities), and the `HarnessSession` lifecycle shape (F-1, F-2; DM-4; AC-F1-1).
- Capability declaration and gap visibility for both shipped adapters, including Claude Code's resume/steer gap and every liveness kind it cannot source (F-1, F-4; DM-4; AC-F1-1, AC-F4-1; DEC-4; RSK-1).
- Configuration-driven harness selection and store locations, with typed resolution, origins, defaults, and classified validation; selecting a different harness changes execution with no code change (F-6; DM-3; AC-F5-1, AC-F5-3; DEC-8).
- The opencode delivery adapter: spawn with machine-readable output and a tree root mapped to the work item, resume/steer without a new root, premature-end classification through the shared classifier, and liveness sourcing (F-3; AC-F3-1).
- The Claude Code delivery adapter: headless spawn, collect, classification, resume as a declared gap, and declared-absent liveness kinds (F-4; AC-F4-1; DEC-4).
- The execution-environment descriptor and host implementation: build-from-declaration spawn environments, use-time credential resolution, fail-closed unresolvable references, and the containerized-executor seam (F-5; DM-2; AC-F5-2, AC-F5-3; DEC-2, DEC-8; NFR-5, NFR-9).
- Read-only telemetry extraction from the opencode session store (read-only mode, query-only pragma, bounded indexed queries, session-tree aggregation, explicit truncation) and from Claude Code local session files (file reads only, bounded, metadata only) (F-7; AC-F7-1; DEC-5; NFR-2, NFR-3).
- The harness-neutral statistics shape: tokens by class, call counts, bounded per-tool counts, per agent and model, and session-tree attribution to the work item (F-7; EVT-1; DM-1; AC-F8-1).
- Drift discipline: optional fields degrade with warnings, missing cost is visibly null, pinned versions warn on drift, and only an unattributable extraction hard-fails (F-7; AC-F8-2; NFR-6; RSK-2).
- Closeout capture: additive schema-versioned telemetry records, fenced and verified appends, idempotent re-runs, non-gating classified failure disclosure, and log-only readback (F-8; EVT-1; DM-1; AC-F8-1, AC-F8-3; DEC-3, DEC-6; NFR-7).
- Structural neutrality and the secret-read boundary extended to the spawn path; output bounds; determinism; contract/error-table/inventory reconciliation; packaging, CI wiring, and documentation posture (NFR-1, NFR-4, NFR-8, NFR-9; AC-F5-3; §18, §20, §21).

Ticket acceptance criteria traceability: ticket AC 1 → AC-F2-1 (TC-HARN-004, 005, 010, 011); AC 2 → AC-F2-2 (TC-HARN-006, 007); AC 3 → AC-F5-1 (TC-HARN-003, 016); AC 4 → AC-F5-2 (TC-HARN-012, 013, 014, 029); AC 5 → AC-F8-1 (TC-HARN-021, 023).

### 1.2 Out of Scope & Known Gaps

- [OUT] The dispatch engine, dispatch loop, or any dispatch command — NG-1, M1-S9. The "same delivery through either adapter" proof happens at the adapter/port boundary (DEC-1); no test drives a dispatch engine.
- [OUT] The harness plugin surface (`HarnessPluginSurface`) — NG-2, M3-S1. No per-harness package generation or sync verification is exercised.
- [OUT] pi.dev or any third harness — NG-3. Only the two registered harnesses are tested, and the registry test asserts exactly two.
- [OUT] Progress-based liveness economics, heartbeat/token-delta ingestion, resume-without-repaying-prefill, restart budgets, and watchdog stall/progress sourcing — NG-4, M1-S15. The watchdog stays zero-source, and this plan asserts the boundary rather than wiring it.
- [OUT] A containerized executor implementation — NG-5. Only the seam is tested (descriptor polymorphism, config-supplied paths, absence of host literals).
- [OUT] `SpendRecord`, spend aggregation, and the retro pipeline — NG-6, NG-7. The events are tested; consumers are not built.
- [OUT] Model profiles and provider watching — NG-8.
- [OUT] The credential sidecar or any second credential-port implementation — NG-9. The existing port is consumed unchanged.
- [OUT] Telemetry for sessions not spawned through the port, historical backfill, and capture points beyond closeout — NG-10. No backfill test exists; a pre-change delivery with no telemetry is asserted to read as absent, not as zero.
- [OUT] New CLI command surfaces — §7.2. No untested command is invented; capture rides the existing closeout point.
- [GAP-T1 — live-harness evidence] RSK-4 is accepted: the identical-classification proof runs over injected harness I/O in the mock tier. A read-only, scheduled, non-gating live tier would follow the delivered conformance-suite tier model, but no live harness runs in CI. §4.2 and TC-HARN-029 make mock-only proof structural (one classifier, mutation controls), not a coverage claim. No AC depends on a live harness.
- [GAP-T2 — bash-era parity is fixture-pinned, not script-executed] AC-F3-1 says "given the bash-era session behaviors being ported". The bash stack (`scripts/opencode-session.sh`, `scripts/pm-liveness.sh`, `scripts/deliver-ticket.sh`) stays authoritative and untouched; it needs a live opencode CLI, a real `$HOME`, and a mutable session database, so it cannot be a hermetic oracle. The behaviours are pinned as fixtures derived from the script semantics (spawn/resume/list mapping, session-tree traffic, worktree/process signals, keys-env-sourced credentials) and asserted through the adapter. True script-to-adapter parity is a review obligation, not a CI assertion.
- [GAP-T3 — "0 locks" is a proxy] NFR-3's "0 locks taken" is not directly observable in-process. The battery asserts the observable proxies: a read-only connection, the query-only pragma, no write/lock statement issued, an unchanged store file with no `-wal`/`-shm` sidecar created, and a fresh writer connection acquiring `BEGIN IMMEDIATE` immediately after extraction (proving no lingering lock). Recorded so it is not mistaken for a direct lock observation.
- [GAP-T4 — container "without redesign" is a design judgment] AC-F5-3's future containerized executor cannot be proven by a test. The testable proxies are: host is the only production descriptor kind, the adapter depends on the descriptor interface rather than the host module, store and work paths are config-supplied, and no host/path literal exists outside declared config and adapters. The "no redesign" claim is reviewed at design time.
- [GAP-T5 — Claude Code headless inventory is a delivery-time discovery] Which liveness kinds and optional telemetry fields headless mode affords (spec §14 OQ 1) is discovered in delivery. Tests assert the *mechanism* (declared sources, declared absent kinds, warning-degraded optional fields), never a guessed inventory. If a needed lifecycle step cannot be expressed without an engine branch, ADR-0008's revisit trigger fires rather than a test being weakened.
- [GAP-T6 — concrete allowlist key set is delivery-bound] Which variable names the default allowlist declares (model routing, work paths) is configuration data (spec §14 OQ 2). Tests assert the deny-by-default rule over a representative declared set, never a frozen key list.
- [GAP-T7 — delivery-bound names] File paths, export names, record-kind names, payload-schema strings, configuration keys, error identities, the neutral evidence field names, and the telemetry schema id are delivery-bound. The behaviours, invariants, closed vocabularies, and AC mapping are not. §4.1 requires a test that cannot resolve a seam to fail naming the missing contract.

## 2. References

- **Change specification**: [chg-GH-233-spec.md](./chg-GH-233-spec.md) — F-1..F-8, 12 ACs (AC-F1-1, AC-F2-1, AC-F2-2, AC-F3-1, AC-F4-1, AC-F5-1..3, AC-F7-1, AC-F8-1..3), EVT-1, DM-1..DM-4, NFR-1..NFR-9, DEC-1..DEC-10, RSK-1..RSK-8, §6 flows 1–5, §7 scope, §8 interfaces, §20 privacy, §21 security.
- **PM record**: [chg-GH-233-pm-notes.yaml](./chg-GH-233-pm-notes.yaml) — context only: DEC-1's boundary interpretation, delivered dependencies, and the two delivery-time discoveries. The spec is the source of truth.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`, fixtures never named `*.test.ts`, permanent suites assert the current tree, goldens are regenerated only by an explicit command, boundary rules require a failing fixture, `pnpm check` is the aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, the error contract, injected fakes over `mock.module`, no moving-base diff assertions.
- **Bash rules**: [.ai/rules/bash.md](../../../../.ai/rules/bash.md) — relevant only because the bash-era stack is asserted unchanged; no bash script is modified by this change.
- **ADR-0008**: [ADR-0008-harness-adapter-contract.md](../../../decisions/ADR-0008-harness-adapter-contract.md) — DC-1..DC-5 (instance and capability flags, lifecycle in-contract, plugin surface later, token accounting through the contract, config-based dispatch) and C-1..C-5 (no harness logic in engines, gaps declared, etc.).
- **TDR-0005**: [TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — delivery-result vocabulary; the shared classifier applies the taxonomy's outcome-to-token projection, and taxonomy-owner ratification of the cross-class reuse is pending (see §4.2 and §9 v1.2).
- **Delivered current truth reused, never re-implemented**:
  - Adapter capability/gap model: `packages/core/src/contracts/adapter-capabilities.ts` (closed operation set, explicit `CapabilityGap`, absence means unsupported).
  - Credential port: `packages/core/src/contracts/credentials.ts` and `packages/adapters/src/credentials/index.ts` (use-time resolution, injected environment, `config.credential.missing`).
  - Session I/O pattern and synthetic-store fixtures: `packages/adapters/src/session/index.ts`, `tests/fixtures/session-admin/{harness,store}.ts` (injected query seam, one statement per call, id-shape validation, no ambient environment).
  - Sanitized child-process seam: `packages/adapters/src/session/commit-one-shot.ts` (injected `HarnessOneShotRunner` receiving `{cwd, env, timeout}`; the model for observing the spawn env).
  - Additive record-kind discipline and non-gating telemetry: `packages/core/src/state/commit-telemetry.ts`, `packages/core/src/contracts/commit.ts`, `packages/core/src/state/closeout.ts`, `packages/core/src/contracts/closeout.ts`.
  - State durability harness: `tests/fixtures/state/harness.ts` (temp stores, driver parity).
  - Closeout harness: `tests/fixtures/closeout/harness.ts` (fully injected providers, git, state, fixed run ids/clock).
  - Conformance registry pattern: `packages/testkit/src/conformance/{adapters,runner,coverage}.ts`, `tests/conformance/**`, `tests/structure/conformance-coverage.test.ts`.
  - Watchdog contract: `packages/core/src/contracts/watchdog.ts` (`signals-absent`, declared signal shape).
  - Configuration mechanics: `packages/core/src/config/{catalog,defaults,resolver,schema,provenance}.ts`, `PRODUCTION_CATALOG`, `config.value.invalid`.
  - Invariants: `scripts/checks/{secret-read-boundary,ambient-globals,workspace-entrypoints,forbidden-literals,error-table-sync}.ts`, `.dependency-cruiser.cjs`, `tests/boundaries/**`, `tests/structure/{content-inventory,port-contract-inventory,subpaths}.test.ts`.
- **CI**: [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) — `ts-test`, `ts-boundaries`, `ts-invariants`, `ts-license-audit`, `ts-vuln`, `ts-forbidden-literals`, `ts-aggregate`.
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#233` — M1-S11: Harness adapters and dispatch portability, five verbatim acceptance criteria.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | Inspecting either adapter's declaration shows every supported operation, lifecycle capability, liveness method, and extraction capability; every unsupported item is an explicit gap record; an unlisted capability cannot be mistaken for support, and degradation is visible before spawn. | TC-HARN-001, TC-HARN-002, TC-HARN-011 | Covered |
| AC-F2-1 | The same scripted delivery scenario through each registered adapter over injected harness I/O normalizes into the neutral evidence shape and yields the identical result-classification token, including premature end, with per-adapter classification structurally absent. | TC-HARN-004, TC-HARN-005, TC-HARN-010, TC-HARN-011, TC-HARN-030 | Covered |
| AC-F2-2 | Each adapter's declared liveness sources map into the harness-agnostic shape (session traffic, worktree activity, process); a kind the harness cannot source is a declared absent value, never a guessed reading. | TC-HARN-006, TC-HARN-007, TC-HARN-010, TC-HARN-011 | Covered |
| AC-F3-1 | The opencode adapter spawns with the prompt and descriptor applied, resumes with steering without a new tree root, and classifies a session that ends early as premature end through the shared classifier. | TC-HARN-008, TC-HARN-009, TC-HARN-010, TC-HARN-033 (session listing, capability-level per spec §17) | Covered |
| AC-F4-1 | Claude Code spawns headlessly, collects and classifies completion or premature end through the shared classifier, and surfaces resume injection as an explicit gap to any consumer that asks — never a silent skip. | TC-HARN-002, TC-HARN-011 | Covered |
| AC-F5-1 | Configuration selecting harness A then harness B drives the same delivery through the selected adapter with no code change; no runtime name, store path, or host assumption exists outside adapters and declared configuration. | TC-HARN-003, TC-HARN-016, TC-HARN-028 | Covered |
| AC-F5-2 | With a parent environment holding an undeclared variable (a credential among them), the spawn environment contains exactly the declared variables; declared credential references resolve through the credential port at use time; an unresolvable reference is a classified spawn failure naming the reference, never an ambient fallback. | TC-HARN-012, TC-HARN-013, TC-HARN-014, TC-HARN-029 | Covered |
| AC-F5-3 | Structurally, host is the only execution-environment implementation, nothing outside it hardcodes host execution, and store locations resolve from configuration. | TC-HARN-015, TC-HARN-018, TC-HARN-028 | Covered |
| AC-F7-1 | Extraction over an opencode session store or Claude Code local session files is read-only (read-only mode plus query-only pragma; file reads), bounded and indexed with no full message-table scans, and causes no store mutation or lock. | TC-HARN-019, TC-HARN-020 | Covered |
| AC-F8-1 | After a successful closeout capture, the event log holds tokens by class, call counts, tool usage per tool per agent, per agent and model, attributed to the work item via session-tree mapping, with no harness store queried to obtain them. | TC-HARN-021, TC-HARN-023 | Covered |
| AC-F8-2 | On schema drift, an absent optional field, or missing cost data, values degrade to null or absent with explicit warnings, capture completes, and no figure is fabricated. | TC-HARN-022 | Covered |
| AC-F8-3 | A closeout re-run appends no duplicate telemetry records; an outright extraction failure is classified and durably disclosed while the closeout transaction's other effects proceed unaffected. | TC-HARN-024, TC-HARN-025 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 002, 003; F-2 → 004, 005, 006, 007, 008, 009, 011; F-3 → 008, 009, 010, 019, 033; F-4 → 002, 011, 020; F-5 → 012, 013, 014, 015; F-6 → 003, 016, 017, 018; F-7 → 019, 020, 021, 022; F-8 → 023, 024, 025, 026.

**Capability-level coverage (no AC added or renumbered)**: F-3's session-listing capability → TC-HARN-033, traced at capability level per spec §17's TC mapping note, beside AC-F3-1's spawn/resume/premature-end/liveness cases (TC-HARN-008..010).

**Decision coverage**: DEC-1 → 004, 032; DEC-2 → 012, 013; DEC-3 → 023; DEC-4 → 002, 011; DEC-5 → 019, 020; DEC-6 → 024, 025; DEC-7 → 021, 026; DEC-8 → 003, 015, 016, 018, 028; DEC-9 → 006, 007; DEC-10 → 004, 005.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint (API-#): the surfaces are local ports and adapters over harness CLIs and local stores. EVT-1 and DM-1..DM-4 are the interface.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| EVT-1 harness session telemetry record | TC-HARN-021, TC-HARN-023, TC-HARN-024, TC-HARN-025, TC-HARN-026 | One additive, schema-versioned record per captured session; tokens by class, calls, tool counts, agent/model identity, tree root/parent chain/work-item ref, harness kind/version, warnings; null-when-absent cost; append-only, fenced, verified; idempotent per session |
| DM-1 telemetry record payload | TC-HARN-021, TC-HARN-023, TC-HARN-027 | Payload schema string versioned and additive; store-scoped key per work item; no state schema bump or migration; existing record kinds unchanged |
| DM-2 execution-environment descriptor | TC-HARN-012, TC-HARN-013, TC-HARN-015 | Host kind only; deny-by-default allowlist of declared names and credential references; build-from-declaration child env; use-time credential resolution; fail-closed missing declaration |
| DM-3 harness configuration branch | TC-HARN-016, TC-HARN-017, TC-HARN-018 | Selected harness, per-harness store locations, declared allowlist resolve with origins; absent branch yields shipped defaults (opencode, host); invalid values classify |
| DM-4 harness capability declaration | TC-HARN-001, TC-HARN-002, TC-HARN-003 | Closed vocabularies (kinds, operations, lifecycle capabilities, liveness kinds); supported and gap sets exhaustive and disjoint; unlisted is a gap; observed version injected, not hardcoded |
| Port lifecycle shape (spawn, deliver, resume, collect, classify, liveness) | TC-HARN-003, TC-HARN-004, TC-HARN-008, TC-HARN-009, TC-HARN-011 | One shape for both adapters; classify bound to the shared classifier; resume unsupported on Claude Code surfaced as a gap before invocation |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Identical injected facts produce byte-identical outputs, including warnings and evidence; zero run-to-run drift. | TC-HARN-004, TC-HARN-021, TC-HARN-030 | Covered |
| NFR-2 | Bounded, indexed queries only; bounded session count with explicit truncation; no full message-table scans; zero retries/pagination. | TC-HARN-019, TC-HARN-020, TC-HARN-026 | Covered |
| NFR-3 | Zero store mutations and zero locks: read-only connection, query-only pragma, file reads only. | TC-HARN-019, TC-HARN-020 | Covered (proxy per GAP-T3) |
| NFR-4 | Machine data at most 65 536 UTF-8 bytes; human summaries at most 4 096 bytes / 24 lines; per-tool, per-agent, and session lists capped with explicit `+N` marks. | TC-HARN-026 | Covered |
| NFR-5 | 100% of undeclared parent variables absent; 0 ambient fallbacks; 100% of unresolvable declared references classified. | TC-HARN-012, TC-HARN-013, TC-HARN-029 | Covered |
| NFR-6 | 100% of degraded fields carry warnings; 0 fabricated figures; 0 capture hard-failures from optional-field drift. | TC-HARN-007, TC-HARN-022 | Covered |
| NFR-7 | Every telemetry append fenced and verified post-append; idempotent capture; failed append classified, never silent. | TC-HARN-023, TC-HARN-024, TC-HARN-025 | Covered |
| NFR-8 | Zero engine-level runtime branches; one classifier; no harness logic outside adapters and declared configuration. | TC-HARN-005, TC-HARN-015, TC-HARN-028 | Covered |
| NFR-9 | Zero ambient secret reads on the spawn path; zero credential values in configuration, records, or output. | TC-HARN-013, TC-HARN-014 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 12 ACs (AC-F1-1..AC-F8-3) appear in §3.1 with at least one TC.
- **Orphan TCs**: none. Every TC names at least one AC or NFR in §5.1 and §5.2.
- **Partially testable, with the boundary recorded**: AC-F5-3's "without redesign" is a design judgment proxied by seam tests and absence scans (GAP-T4); NFR-3's lock count is a proxy (GAP-T3); AC-F3-1's bash-era parity is fixture-pinned rather than script-executed (GAP-T2); AC-F2-2's "live session" is an injected live-shaped fixture (no live harness in CI).
- **Intentional duplicate coverage**: AC-F5-2 spans four TCs because exactness, credential resolution, the secret boundary, and mutant non-vacuity fail independently. AC-F2-1 spans five because adapter A, adapter B, structural single-classifier proof, the opencode premature-end path, the Claude premature-end path, and determinism fail independently. AC-F8-1 spans two because the extraction shape and the durable closeout record fail independently. AC-F1-1 spans three because the vocabulary, the adapter-specific gaps, and consumer-facing gap surfacing fail independently.
- **Regression half**: existing `state-*`, `closeout-*`, `commit-telemetry`, `config-*`, `session-admin-*`, `watchdog-*`, `provider-*`, `credential-*`, `conformance-*`, `port-*`, and `tests/boundaries` suites run unchanged and prove the additive change altered no existing behavior. `scripts/.tests/test-opencode-session.sh` and `scripts/.tests/test-pm-liveness.sh` run unchanged and prove the bash-era executor is untouched.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure/harness-contract.test.ts` | `packages/core/src/contracts/harness*.ts`, the harness contract test | TC-HARN-001, TC-HARN-002, TC-HARN-003, TC-HARN-027 |
| Type contract | `pnpm typecheck` | `tests/types/harness.type-test.ts` | TC-HARN-001, TC-HARN-005, TC-HARN-012, TC-HARN-015 |
| Classification conformance | `bun test tests/conformance/harness-classification.test.ts`; `bun test tests/structure/conformance-coverage.test.ts` | `packages/testkit/src/conformance/harness.ts`; `tests/fixtures/harness/scenarios/classification.ts` | TC-HARN-004, TC-HARN-005 |
| Liveness conformance | `bun test tests/conformance/harness-liveness.test.ts` | shared harness scenario fixtures | TC-HARN-006, TC-HARN-007 |
| opencode adapter | `bun test tests/behaviour/harness-opencode-session.test.ts` | `tests/fixtures/harness/harness-io.ts` | TC-HARN-008, TC-HARN-009, TC-HARN-010, TC-HARN-033 |
| Claude Code adapter | `bun test tests/behaviour/harness-claude-session.test.ts` | shared harness I/O fixtures | TC-HARN-011 |
| Spawn environment | `bun test tests/behaviour/harness-spawn-env.test.ts tests/behaviour/harness-spawn-credential.test.ts` | `tests/fixtures/harness/spawn-env.ts` | TC-HARN-012, TC-HARN-013, TC-HARN-014 |
| Configuration | `bun test tests/behaviour/harness-config.test.ts` | `tests/fixtures/harness/config/**` | TC-HARN-016, TC-HARN-017, TC-HARN-018 |
| Extraction (opencode) | `bun test tests/behaviour/harness-telemetry-opencode.test.ts` | `tests/fixtures/harness/opencode-store/**` | TC-HARN-019, TC-HARN-021 |
| Extraction (Claude Code) | `bun test tests/behaviour/harness-telemetry-claude.test.ts` | `tests/fixtures/harness/claude-code/**` | TC-HARN-020, TC-HARN-021 |
| Drift | `bun test tests/behaviour/harness-telemetry-drift.test.ts` | drift/incomplete store and file fixtures | TC-HARN-022 |
| Closeout capture | `bun test tests/behaviour/harness-closeout-capture.test.ts tests/behaviour/harness-closeout-idempotency.test.ts tests/behaviour/harness-closeout-nongating.test.ts` | `tests/fixtures/closeout/harness.ts` extended with a telemetry runtime; `tests/fixtures/state/harness.ts` | TC-HARN-023, TC-HARN-024, TC-HARN-025 |
| Output bounds and determinism | `bun test tests/behaviour/harness-output-bounds.test.ts tests/checks/harness-determinism.test.ts` | cap-sized fixtures and goldens | TC-HARN-026, TC-HARN-030 |
| Neutrality, secret boundary, boundaries | `bun test tests/structure/harness-neutrality.test.ts tests/structure/harness-imports.test.ts tests/boundaries`; `pnpm check:boundaries`; `bun run scripts/checks/{secret-read-boundary,forbidden-literals,workspace-entrypoints}.ts` | `packages/core/src/**`, `packages/adapters/src/harness/**`, `.dependency-cruiser.cjs` | TC-HARN-005, TC-HARN-014, TC-HARN-015, TC-HARN-028 |
| Mutation / non-vacuity | `bun test tests/checks/harness-mutants.test.ts` | `tests/fixtures/harness/mutants/**` | TC-HARN-029 |
| Wiring and aggregate | `bun test tests/structure/{content-inventory,subpaths}.test.ts tests/checks/harness-ci-parity.test.ts`; `pnpm check`; `git diff --check` | manifests, `tests/structure/inventory.json`, CI workflow | TC-HARN-031 |
| Documentation | content/manual review; `bash scripts/.tests/test-doc-distribution.sh` only if a marker-scoped doc changes | `doc/spec/features/feature-harness-adapters.md` and neighbors | TC-HARN-032 (manual, phase 7) |

### 4.1 Test Harness Contract (binding for every TC)

1. **Hermetic.** Every suite imports production modules and injects fakes. No suite resolves a harness binary, reads the real `process.env`, reads a real `$HOME`, opens a network socket, or writes the live worktree. A suite that cannot resolve an injection seam fails with a message naming the missing contract; it never spawns the real tool.
2. **One injected child-process seam.** Spawn and headless invocations go through one injected runner with the `HarnessOneShotRunner` shape (`file`, `args`, `{cwd, env, timeout}`), extended only if the delivery needs more (for example a stdin payload). The runner records its arguments and returns a synthetic result. The production implementation is the only place `node:child_process` appears.
3. **One injected store seam.** Opencode telemetry extraction goes through an injected store access object (`openReadOnly`, `query`, `close`) recording every statement. Claude Code extraction goes through an injected file reader recording every path and byte range. No suite opens a real opencode CLI or a real user store.
4. **Injected parent environment.** The spawn environment is built from an injected parent-environment record. No test reads `process.env`; the canary secrets in fixtures are fabricated strings.
5. **Fixed facts.** Time, run id, clock, harness version probe, credential material, and configuration are injected and constant per case. No wall clock, `Math.random`, locale, or order-dependent assertion decides correctness.
6. **Temp roots only.** Any test needing a real filesystem uses `mkdtemp` under the system temp directory or a committed read-only fixture; cleanup runs in `afterEach`. Synthetic SQLite stores are built in a temp directory, never committed as binary blobs.
7. **Goldens are read-only.** Golden files are opened read-only, compared after canonicalization, and their `mtimeMs` is asserted unchanged. Regeneration is an explicit, reviewed command; no test writes a golden as a side effect.
8. **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a recorded invocation. No suite asserts `origin/main-tools...HEAD`.
9. **Delivery-bound names.** The plan names behaviors and seams. The delivery plan maps each seam (contracts module, domain classifier, adapter subpath, config branch, record kind, capture point) to the chosen file and export. Test resolution failures name the missing seam.

### 4.2 Identical-Classification Oracle (binding for AC-F2-1, DEC-10, NFR-8, NFR-1)

**Conformance registration.** A harness conformance registry lists exactly the two shipped harnesses and, per registration, the adapter's capability declaration, a spawn/collect builder over injected I/O, and the scenario ids it supports. The coverage meta-check fails a registered harness with no classification case, and fails a harness kind in the closed vocabulary that is not registered (the registry and the vocabulary cannot drift).

**One evidence shape.** Each scenario declares (a) the raw harness I/O for the opencode adapter, (b) the raw harness I/O for the Claude Code adapter, (c) the expected neutral evidence semantics (completion, premature end, harness failure, refusal, timeout), and (d) the expected outcome and delivery-result token from the declared projection below. The two raw shapes are deliberately different: the test asserts they are not equal, so a passing token cannot come from identity of raw input.

**Declared projection (binding expected tokens).** The classifier projects onto the delivery-result taxonomy's shared tokens. The dispatch-session derivation class has no completion tokens of its own, so completion and failure results reuse the taxonomy's shared tokens while refusal and timeout use its dispatch-session tokens; the projection is declared once in the contracts tier (`HARNESS_CLASSIFICATION_TOKENS`):

| Evidence condition | Outcome | Expected token | Derivation class |
|--------------------|---------|----------------|------------------|
| Completion marker present, no tool failure | `completed` | `finished` | `verify` |
| Completion marker present, tool failure reported | `completed` | `partial` | `verify` |
| No completion marker and no failure/refusal/timeout | `premature-end` | `partial` | `verify` |
| Non-zero exit or a reported failure | `failed` | `failed` | `verify` |
| Spawn refused before a session existed | `refused` | `noop-lane-permission` | `dispatch-session` |
| Bounded invocation timed out | `timed-out` | `max-restarts` | `dispatch-session` |

The `outcome` field is REQUIRED to disambiguate results projecting `partial`: `premature-end` and completed-with-tool-failure share the token `partial` and differ only by outcome, so a token-only assertion is incomplete. `noop-lane-permission` on the harness path means spawn-refused; no lane-permission event occurred. Identical-classification (DEC-10, TC-HARN-004/TC-HARN-005) still holds because the mapping is one shared pure function over neutral evidence — adapters normalize, the classifier maps.

**Case floor (non-vacuity).** The suite asserts a minimum of six scenarios before iterating: completed success, completed with a tool-level failure, premature end (ended before work completed), harness-reported failure (non-zero exit), spawn refusal (harness refused to start), and timeout. Each adapter must supply every scenario. A suite that finds fewer fails.

**Rule per scenario.**

1. Build adapter A's session over its injected I/O; run spawn (where the scenario includes it), collect, normalize, then classify through the shared classifier. Take the token.
2. Build adapter B's session over its own injected I/O for the same scenario; do the same. Take the token.
3. Assert both tokens equal the case's declared expected token and each other, and both outcomes equal the case's declared outcome. Premature end must be asserted in both adapters, not one.
4. Assert the classifier received only neutral evidence: the evidence object's key set is the neutral shape (no harness-specific keys), and its values carry no result token.
5. Assert the adapters expose no classification entry point of their own: the session's `classify` is the same bound reference on both instances, and the adapter module exports no token or verdict.
6. Replay: run both adapters twice with fresh fakes and the same injected facts; assert the tokens and canonical evidence are identical (NFR-1).

**Premature-end rule.** A session that ends before completion must not collapse into success or failure. The case declares the projection's premature-end row (`outcome: "premature-end"`, token `partial`); the test asserts the exact outcome and token, the three-way outcome distinction (completed, premature end, failed) with one positive control per outcome, and that premature end is distinguished from completed-with-tool-failure by `outcome` alone (both project `partial`).

**Structural rule.** The classifier exists once, in the runtime-neutral tier, over neutral evidence. An adapter that classifies, a second classifier, or an engine that branches on harness kind fails TC-HARN-005 and TC-HARN-028, and the mutant in TC-HARN-029 proves the conformance suite notices a divergent adapter-local token.

### 4.3 Spawn-Environment Oracle (binding for AC-F5-2, NFR-5, NFR-9, DEC-2)

**Observation seam.** The test constructs the session port with an injected runner that records the exact `env` object it receives. The descriptor, the parent-environment record, the harness version probe, and the credential port are injected. The test never spawns a real harness and never reads the real environment.

**Fixture.** The synthetic parent environment contains: two declared model-routing variables, one declared work path, one declared path variable, a declared credential source key used by the credential port, and at least three undeclared variables — one credential-shaped (`SYNTHETIC_UNDECLARED_TOKEN`), one `HOME`, and one `PATH` variant. The descriptor declares only the intended set. A unique canary value is planted in every undeclared variable.

**Rules.**

1. **Exactness.** Assert the sorted key list of the observed child environment equals the sorted declared-name list. Equality of key sets, not merely absence of known leaks: one extra inherited key fails even if no assertion names it.
2. **Absence.** For every undeclared parent variable, assert `Object.hasOwn(observed, key) === false`. Absence means absent — not empty string, not `"undefined"`, not `"null"`. Assert the canary value appears nowhere in the observed environment or in serialized evidence.
3. **No ambient fallback.** Assert the declared credential's source key is absent from the child environment (the value arrives under the declared variable name only), and that the credential port's `resolve` was called exactly once for each declared reference, during spawn.
4. **Use time, not construction time.** Construct the session, then change the fake credential port's material, then spawn. Assert the observed value is the second material. Construct-time capture fails this assertion. (An earlier `resolve` call recorded before spawn also fails.)
5. **Fail-closed on an unresolvable reference.** Configure the credential port to return `config.credential.missing`. Assert spawn refuses with a classified failure whose message names the declared reference; assert the runner recorded zero invocations and no partial environment was handed anywhere; assert the parent-environment value that could have masked the failure was never used.
6. **Fail-closed on a missing declared variable.** Remove one declared non-credential variable from the parent environment. Assert the classified failure names the variable, the runner recorded zero invocations, and the environment is not partially built.
7. **Determinism.** Run the same construction twice with fresh fakes; assert the observed environment objects are deeply equal and the canonical serialization is byte-identical.
8. **Mutation control.** The mutant in TC-HARN-029 builds the env as a spread of the parent plus the declared values; the suite must fail and name the first leaked key. A passing mutant fails the meta-check.

**What this oracle does not prove.** It proves the constructed environment handed to the spawn seam. TC-HARN-014 and TC-HARN-028 assert the seam is the only spawn site and that no other module reads ambient environment, closing the "the test observed a different path than production used" gap.

### 4.4 Liveness Oracle (binding for AC-F2-2, DEC-9, NFR-6)

- The closed signal-kind vocabulary is exactly session traffic, worktree activity, and process. Each adapter declares the subset it sources. The declaration is data; the test reads it, it does not hardcode a per-harness expectation (GAP-T5).
- **Shape.** A liveness read returns the neutral shape: one entry per kind in the closed vocabulary, each entry either a sourced observation (a value with the declared unit plus the injected observation timestamp) or an explicit absent entry (kind plus a reason from a closed reason set). The key set and key order must be identical for both adapters for the same declared subset; no harness-specific key may appear.
- **Sourced rule.** For a declared kind, inject a known fact (traffic timestamp, worktree mtime, process liveness) and assert the mapped value and timestamp equal it. Assert the mapping is a projection, not a re-read: the store/file reader is not called by the liveness read.
- **Absent rule.** For a kind the adapter does not declare, assert the absent entry is present (not omitted), carries the kind, and carries no numeric zero, no `false`, and no invented timestamp. Assert the absence reason is from the closed set.
- **All-absent rule.** A read where every kind is absent returns all three absent entries; the consumer-side mapping into the watchdog signal shape yields absent keys (not zeros), so the watchdog's declared-shape check refuses. The watchdog module is not imported by the harness tier and the harness tier is not wired into the watchdog (DEC-9/NG-4 boundary).
- **Guess mutant.** TC-HARN-029 defaults an absent kind to `0`; the liveness suite must fail naming the kind.

### 4.5 Read-Only Extraction Oracle (binding for AC-F7-1, NFR-2, NFR-3, DEC-5)

**Opencode store fixture.** `tests/fixtures/harness/opencode-store/build.ts` builds a synthetic store in a temp directory using the workspace's SQLite loader pattern (`bun:sqlite`, falling back to `node:sqlite`). Rows are deterministic: a root session mapped to the work item, two child agent sessions, messages and parts with token classes, tool parts, and model ids. No message body content is required and none is stored beyond a planted privacy canary. The builder is called from the test, not committed as a binary.

**Rules.**

1. **Read-only connection.** The production access seam must open the store read-only (read-only flag on the connection) and set a query-only pragma before the first read. Assert the recorded statement log contains the query-only pragma before the first `SELECT`, and that the connection was opened with the read-only option.
2. **Query-only is effective.** Issue an `INSERT` (and a `DELETE`) through the same seam. Assert both reject; assert the seam's error is data (classified), not a crash.
3. **No writes and no sidecars.** Hash every file in the store directory and record mtimes before and after extraction; assert identical. Assert no `-wal`, `-shm`, journal, or lock file was created and no checkpoint was issued. Missing-store and unreadable-store cases produce a degraded or failed capture outcome, never a crash.
4. **No lingering lock.** After extraction and after closing the seam, open a fresh writer connection with `busy_timeout = 0`, `BEGIN IMMEDIATE`, insert one row, commit, and close. Assert it succeeds without retry. A lingering read lock fails this step (GAP-T3).
5. **Bounded queries.** Assert the number of statements equals the expected constant for the fixture (no retries, no pagination, no loop until changed). Every statement carries a `LIMIT` (or an aggregate over a bounded subquery with a limit on the session set). Every statement filters by an indexed column (session id / parent id / time).
6. **No full message-table scan.** Run `EXPLAIN QUERY PLAN` for each emitted statement against the fixture. Assert no plan row is a `SCAN` of the message or part table, and that the session-tree filter uses an index (`SEARCH ... USING INDEX` or an equivalent index-backed plan). If SQLite's plan text varies by version, assert the weaker property: no `SCAN <message table>` or `SCAN <part table>` row.
7. **Session cap.** With cap + 3 sessions in the tree, assert at most the cap is read, the output carries `truncated: true` and an omitted count (or the declared `+N` mark), and the number of emitted queries does not grow with the excess sessions.
8. **No harness re-query at read time.** After capture, the extractor is never called by a read path; the read path returns log data only (also asserted in TC-HARN-023).

**Claude Code rules.** Files are opened read-only (`readFile`/`openSync(path, "r")`), never written; file size and mtime are unchanged; the store directory gains no new file. The reader is bounded by a declared per-file byte cap and line cap, with explicit truncation marks. Malformed lines degrade with a warning; a missing file is a failed/degraded capture outcome. The output contains no message content: a canary planted in a transcript body must appear nowhere in the extraction result.
The extraction output's top-level and nested key sets are asserted against the pinned neutral shape, so a free-form text field cannot be added unnoticed.

### 4.6 Telemetry Shape and Degradation Oracle (binding for AC-F8-1, AC-F8-2, EVT-1, DM-1, NFR-6)

**Shape.** One record per session. Each record carries: the telemetry payload schema id (versioned, delivery-bound spelling), the work-item ref, the session id, the harness kind and observed version, the model, the agent, the tree root and parent chain, token classes `input`, `output`, `reasoning`, `cacheRead`, `cacheWrite` (numeric, or null when the source is absent and warned), call counts, tool usage as bounded counts per tool, cost (a number or an explicit null with a warning), the captured-at timestamp (injected), and warnings. A fixture with two agents and two models asserts both identities are present per session and are not collapsed into one.

**Degradation rules (one case each).**

| Case | Fixture | Required outcome |
|------|---------|------------------|
| Pinned schema, all optional fields present | full store/file | Captured, zero warnings, all token classes numeric |
| Pinned schema, optional field absent | store/file built without the optional column/field | Captured, the field null-or-absent, one warning naming the field, no hard failure |
| Observed version drifts from the pinned version | version probe returns a different version | Captured, warning naming expected and observed versions |
| Missing cost data | source with no cost field | Captured, cost is `null` (or absent) with a warning; assert the value is not `0` and is not an estimate |
| Non-numeric optional value | malformed optional row | Captured, value degraded with a warning; never coerced to a number |
| Unattributable session (root does not map to a work item) | orphan session tree | Capture outcome `failed` for that session, classified and disclosed; no record with a fabricated ref |
| Malformed required identity (no session id) | broken row | Classified failure, no record; never a placeholder id |

Optional-field drift must never hard-fail the capture, and the fixture that omits an optional column proves the query does not depend on it (the extraction still runs).

### 4.7 Closeout Capture Oracle (binding for AC-F8-1, AC-F8-3, NFR-7, DEC-3, DEC-6)

- **Composition.** The closeout runtime gains an injected telemetry capture capability. The test uses the existing closeout harness (`tests/fixtures/closeout/harness.ts`) plus a telemetry runtime fake, and a real temp state store from `tests/fixtures/state/harness.ts` where durability is asserted. No test reads a harness store directly; extraction goes through the adapter capability.
- **Durability.** After closeout, read the state store through its public read API only. Assert the telemetry records exist under the store-scoped key for the work item, with one payload per captured session and the schema id/version pinned. Assert the append was fenced (fence handle acquired and released in the recorded order) and verified post-append (a read-back occurred before success was reported). Assert the state schema version is unchanged and no migration artifact exists.
- **Log-only readback.** Delete or deny the synthetic harness store after capture (unlink the temp store; make the extractor throw on any call). Re-read the state store; assert every statistic is still present and the extractor recorded zero calls. This is the mechanical form of "no harness store re-query".
- **Idempotency key.** A record is unique by work item, run, and session. A re-run of closeout for the same delivery must produce zero new telemetry records, and a changed delivery with one new session must produce exactly one new record and no duplicates of the existing ones.
- **Non-gating.** Capture failure (throw, missing store, append failure) must not change the closeout plan's step outcomes, the closeout summary, or the command's success/failure verdict. The capture outcome is classified and durably disclosed with captured/degraded/failed counts and warning reasons, following the closeout operation-record discipline (no second event kind).
- **No zeros.** A failed capture writes no telemetry record. It must not write a record with zero tokens, zero calls, or a null session id.

### 4.8 Neutrality and Secret-Boundary Oracle (binding for NFR-8, NFR-9, AC-F5-3, AC-F5-1)

**Scanned scope.** `packages/core/src/{contracts,domain,app,state,config}` for harness-name and path literals; `packages/adapters/src/harness/**` for surface imports and result tokens; the composition edges for ambient environment reads. Each scan asserts a non-zero file count before asserting zero violations (non-vacuity).

**Rules.**

1. The closed harness-kind vocabulary is the only place harness names appear in core; the config catalog default value is the only other allowed occurrence (declared configuration). Every other harness-name literal in core fails the scan, naming file and line.
2. No module outside the adapter I/O subpath imports `@delivery-os/adapters/*`; the harness adapter subpath imports only `@delivery-os/core/contracts` plus its allowed node builtins; surfaces are not imported downward.
3. `node:child_process` appears only in the declared spawn adapter path; the dependency-cruiser runtime-API allowance is one exact path with a reason, and the boundary fixture that proves the rule exists (fixture-coverage meta-check).
4. No `process.env`, `Bun.env`, `Deno.env`, or computed ambient element access exists in the spawn path or adapters except the existing credential directory and the existing enumerated configuration-environment readers. The `secret-read-boundary` allowlist's `credential-material` class gains no entry.
5. The classifier and the session port contain no comparison against a harness kind and no result-token string.
6. Product and binary literals stay out of committed code and docs; the forbidden-literal scan is green with a non-zero scope count.

### 4.9 Non-Vacuity Contract (binding for every negative, absence, and parity scenario)

1. **Plant the positive before asserting the absence.** A declared variable is observed present before the test asserts an undeclared one is absent; a supported liveness kind is sourced before an unsupported one is declared absent; a captured record is read before the store is denied; a successful classification is asserted before the premature-end case.
2. **Pair every negative with a live control in the same file.** An unresolvable credential sits beside a resolvable one; a drift store sits beside the pinned store; a duplicate-append mutant sits beside the real capture.
3. **Case and scan floors.** Every conformance and extraction suite asserts a case floor; every static scan asserts a positive file count. A suite that finds fewer cases fails.
4. **Every mutant fails by name.** `tests/checks/harness-mutants.test.ts` imports temp copies of the env builder, the adapter normalizer/classifier binding, the liveness mapper, the extractor, the capture point, and a core domain module, each with one named guard disabled. Each mutant must fail the corresponding suite with the mutant name in the message. A mutant that passes fails the meta-check.
5. **No golden is self-fulfilling.** Each golden comparison is paired with a mutation that changes one field and asserts inequality, then restores and asserts equality.

## 5. Test Scenarios

### 5.1 Scenario Index

`TC-HARN` is a new prefix with no prior use in the repository; no existing TC identifier is reused for a different scenario. The plan holds 33 scenarios, TC-HARN-001..TC-HARN-033, each present in the index, the details, and the automation plan.

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-HARN-001 | Harness contract vocabulary: closed kinds, operations, lifecycle capabilities, liveness kinds, gap records | Regression | Critical | High | AC-F1-1; F-1, F-2; DM-4; NFR-8 |
| TC-HARN-002 | Capability gaps visible before spawn: Claude resume/steer gap and unsourced liveness kinds | Negative | Critical | High | AC-F1-1, AC-F4-1; F-1, F-4; DM-4; DEC-4; RSK-1 |
| TC-HARN-003 | Harness instance resolution: kind from config, version from injected probe, unknown kind classified | Happy Path | Critical | High | AC-F5-1, AC-F1-1; F-1, F-6; DEC-8 |
| TC-HARN-004 | Identical result classification on both adapters over injected harness I/O, including premature end | Regression | Critical | High | AC-F2-1; F-2, F-3, F-4; DEC-10, DEC-1; NFR-8, NFR-1 |
| TC-HARN-005 | One shared classifier, structurally: adapters normalize only; no adapter-local classification | Regression | Critical | High | AC-F2-1; F-2; NFR-8; DEC-10 |
| TC-HARN-006 | Harness-agnostic liveness mapping: same neutral shape from both adapters | Happy Path | Critical | High | AC-F2-2; F-2; DEC-9 |
| TC-HARN-007 | Declared-absent liveness kinds read unknown, never guessed; watchdog stays zero-source | Negative | Critical | High | AC-F2-2; F-2; DEC-9; NFR-6; NG-4 |
| TC-HARN-008 | opencode spawn: prompt delivered, descriptor applied, tree root mapped to the work item | Happy Path | Critical | High | AC-F3-1; F-3, F-2, F-5 |
| TC-HARN-009 | opencode resume/steer: attaches the existing session, no new tree root, failure classified | Happy Path | Critical | High | AC-F3-1; F-3 |
| TC-HARN-010 | opencode premature end and liveness: shared classification and ported signal handling | Regression | Critical | High | AC-F3-1, AC-F2-1, AC-F2-2; F-3, F-2 |
| TC-HARN-011 | Claude Code headless spawn, collect, classify, and resume-as-a-gap | Happy Path | Critical | High | AC-F4-1, AC-F1-1, AC-F2-1, AC-F2-2; F-4; DEC-4 |
| TC-HARN-012 | Deny-by-default spawn environment: exactly the declared set, undeclared parent variables absent | Regression | Critical | High | AC-F5-2; F-5; DM-2; DEC-2; NFR-5 |
| TC-HARN-013 | Use-time credential resolution; unresolvable reference fails closed, naming the reference | Negative | Critical | High | AC-F5-2; F-5; DM-2; DEC-2; NFR-5, NFR-9 |
| TC-HARN-014 | Spawn-path secret boundary: no ambient environment reads; no credential material in any output | Regression | Critical | High | AC-F5-2; F-5; NFR-9; §21 |
| TC-HARN-015 | Execution-environment seam: host is the only implementation, nothing else hardcodes host execution | Regression | Important | High | AC-F5-3; F-5; DM-2; DEC-8; NFR-8 |
| TC-HARN-016 | Harness configuration: defaults, config-driven selection, A-then-B switch with no code change | Happy Path | Critical | High | AC-F5-1; F-6; DM-3; DEC-8 |
| TC-HARN-017 | Configuration validation: invalid values classify with origin, never default silently | Negative | Critical | High | AC-F5-1; F-6; DM-3 |
| TC-HARN-018 | Store locations resolve from configuration, including a bind-mount-style location | Happy Path | Important | High | AC-F5-3; F-6, F-7; DM-3; DEC-8 |
| TC-HARN-019 | opencode extraction is read-only, query-only, bounded, indexed, and lock-free | Regression | Critical | High | AC-F7-1; F-7; DEC-5; NFR-2, NFR-3 |
| TC-HARN-020 | Claude Code extraction: read-only file parsing, bounded, metadata only, no content leakage | Regression | Critical | High | AC-F7-1; F-7; DEC-5; NFR-2, NFR-3; §20 |
| TC-HARN-021 | Harness-neutral statistics shape: token classes, calls, tools, per agent/model, tree attribution | Happy Path | Critical | High | AC-F8-1; F-7; EVT-1; DM-1; NFR-1 |
| TC-HARN-022 | Drift discipline: optional fields warn, missing cost is null, capture never hard-fails on drift | Negative | Critical | High | AC-F8-2; F-7, F-8; NFR-6; RSK-2; DEC-6 |
| TC-HARN-023 | Closeout capture: additive schema-versioned records, fenced and verified, readable from the log alone | Happy Path | Critical | High | AC-F8-1; F-8; EVT-1; DM-1; DEC-3; NFR-7 |
| TC-HARN-024 | Closeout capture idempotency: re-runs append nothing; partial-then-success converges | Regression | Critical | High | AC-F8-3; F-8; NFR-7; DEC-6 |
| TC-HARN-025 | Closeout capture is non-gating: failure is classified, disclosed, and changes no other effect | Negative | Critical | High | AC-F8-3; F-8; DEC-6; NFR-7 |
| TC-HARN-026 | Output bounds: machine 65 536 bytes, human 4 096 bytes / 24 lines, capped lists with +N | Regression | Important | High | NFR-4; F-7, F-8; DEC-7 |
| TC-HARN-027 | State additivity and contract reconciliation: no schema bump, no modified kind, inventories updated | Regression | Important | Medium | AC-F8-1; DM-1; EVT-1; §8.5, §19 |
| TC-HARN-028 | Neutrality invariant: no harness branches, imports, or literals outside adapters and declared config | Regression | Critical | High | AC-F5-3, AC-F5-1; NFR-8; DEC-8; RSK-6 |
| TC-HARN-029 | Non-vacuity meta-check: every named guard mutant fails by name | Regression | Critical | High | All ACs; NFR-1..NFR-9 |
| TC-HARN-030 | Determinism and golden stability: byte-identical output over replay and map-order changes | Regression | Important | High | AC-F2-1; NFR-1 |
| TC-HARN-031 | Package wiring, CI gates, inventory, and bash-era non-regression | Regression | Important | Medium | AC-F5-1; NFR-8; §18 |
| TC-HARN-032 | Documentation posture: harness-adapters feature spec and neighbor reconciliation | Manual | Important | Medium | AC-F1-1, AC-F5-1, AC-F8-1; DEC-1; §18 |
| TC-HARN-033 | opencode session listing: capability declared, bash-era list behaviour fixture-pinned, discovery over injected I/O without a new root | Happy Path | Critical | High | AC-F3-1 (capability-level: session listing); F-3; DM-4 |

### 5.2 Scenario Details

#### TC-HARN-001 - Harness contract vocabulary: closed kinds, operations, lifecycle capabilities, liveness kinds, gap records

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, DM-4, NFR-8
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-contract.test.ts`, `tests/types/harness.type-test.ts`; the harness contract module in `packages/core/src/contracts`
**Tags**: @backend, @contract

**Preconditions**:

- The harness contract module exports the closed vocabularies and the instance/session types.
- The existing adapter capability model (`AdapterCapabilityDeclaration`, `CapabilityGap`) is available as the reference shape.

**Steps**:

1. Assert the harness-kind list is a closed `as const` set containing opencode and Claude Code and no other value; assert it has no duplicates and no wildcard.
2. Assert the operation vocabulary, the lifecycle-capability vocabulary, and the liveness signal-kind vocabulary are each closed, duplicate-free, and contain no `any`/`unknown`/wildcard member. Liveness kinds must be exactly session traffic, worktree activity, and process.
3. Assert the capability declaration type carries a supported set, an explicit gap list with a reason from a closed reason set, and the declared liveness sources; assert supported and gap sets are disjoint by construction and by runtime validation.
4. Run the exhaustive-declaration check over both shipped adapters: supported operations plus declared operation gaps equals the closed operation set and is disjoint; the same for lifecycle capabilities and for liveness kinds. Any capability in neither set fails naming the harness and capability.
5. Assert the `HarnessInstance` shape carries kind, observed version, and the declaration; assert no field can carry a derived parity claim.
6. Assert the contract module is data-only: no call expressions, no runtime-API imports, no `process`, no filesystem, no clock. Assert the file is in the contract tier and imports only `./` contract modules.
7. Type test: a capability literal outside the closed set fails `pnpm typecheck`; a widened `string` is not assignable to the capability type; an absent gap cannot be read as support.

**Expected Outcome**:

- Closed vocabularies exist; a declaration can express support or a gap but cannot imply parity; the instance identity is data.

**Notes / Clarifications**:

- The exact export names are delivery-bound; the closed sets and the disjointness/exhaustiveness invariant are not.

#### TC-HARN-002 - Capability gaps visible before spawn: Claude resume/steer gap and unsourced liveness kinds

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, F-4, AC-F1-1, AC-F4-1, DM-4, DEC-4, RSK-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-contract.test.ts`; both adapter capability builders
**Tags**: @backend, @contract, @negative

**Preconditions**:

- Both adapters can be constructed over injected version probes without spawning.
- A consumer-facing capability assertion helper exists (delivery-bound name).

**Steps**:

1. Build the opencode declaration; assert resume/steer and telemetry extraction are supported, and the declared liveness sources are a subset of the closed kinds.
2. Build the Claude Code declaration; assert resume/steer is absent from supported and present in the gap list with a closed reason; assert every liveness kind not declared is represented as an absent/unsupported declaration, not omitted.
3. Ask the consumer helper for resume on the Claude instance; assert it returns a machine-readable gap naming the harness kind and the capability, and does not throw an unclassified error.
4. Ask the same helper for a supported capability; assert success with no gap.
5. Assert the gap is visible before spawn: the runner recorded zero invocations, and the capability inspection path did not call the store or the CLI.
6. Assert no adapter declares an operation outside the closed vocabulary, and every gap reason is from the closed reason set.
7. Assert the gap carries no fallback instruction that would be executed by the adapter (the resume-prompt-reentry fallback is a later consumer decision, not adapter behavior).

**Expected Outcome**:

- Claude Code's resume inability and unsourced liveness kinds are visible, machine-readable, and pre-spawn; no consumer can mistake them for support.

#### TC-HARN-003 - Harness instance resolution: kind from config, version from injected probe, unknown kind classified

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F5-1, AC-F1-1, DM-3, DM-4, DEC-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-contract.test.ts`, `tests/behaviour/harness-config.test.ts`
**Tags**: @backend, @contract

**Preconditions**:

- A harness registry/resolver exists that maps a configured kind to an adapter factory.
- The version probe is an injected dependency.

**Steps**:

1. Register/resolve the opencode instance from an injected configuration; assert kind, version, and capability declaration.
2. Change the injected version probe to a second value and resolve again; assert the observed version changes. Assert no version string literal is returned when the probe supplies one.
3. Resolve the Claude Code instance; assert the Claude adapter factory was called and the opencode factory was not.
4. Resolve an unknown kind; assert `config.value.invalid` naming the configuration path and the offending value; assert neither adapter factory was called.
5. Make the version probe fail; assert the instance is still addressable with an explicitly unknown version plus a warning, never a fabricated version.
6. Assert the registry contains exactly the two shipped registrations and that the closed vocabulary has no unregistered kind.

**Expected Outcome**:

- A configured kind yields the right instance with an observed, injected version; an unknown kind is a classified configuration failure, never a silent default.

#### TC-HARN-004 - Identical result classification on both adapters over injected harness I/O, including premature end

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, F-4, AC-F2-1, DEC-10, DEC-1, NFR-8, NFR-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/harness-classification.test.ts`; `packages/testkit/src/conformance/harness.ts`; `tests/fixtures/harness/scenarios/classification.ts`
**Tags**: @backend, @conformance, @parity

**Preconditions**:

- The conformance registry lists both harnesses with a scenario builder and a capability declaration.
- Scenario fixtures supply raw harness I/O for both adapters, the expected neutral outcome, and the expected outcome-to-token pair per the §4.2 projection.

**Steps**:

1. Assert the case floor of six scenarios (completed success, tool-level failure, premature end, harness failure, spawn refusal, timeout) and that both adapters supply each.
2. For each scenario, run adapter A over its raw I/O: spawn where applicable, collect, normalize, classify. Take the token.
3. Run adapter B over its own raw I/O for the same scenario; take the token.
4. Assert both tokens equal the case's declared expected token and each other, and both outcomes equal the declared outcome; assert the raw I/O shapes differ, so identity of input cannot explain identity of output.
5. Assert the evidence handed to the classifier is the neutral shape (its key set contains no harness-specific key and no token).
6. Assert the premature-end case classifies as outcome `premature-end` with expected token `partial`, distinct from `finished` (completed) and `failed` (failure); assert the completed-with-tool-failure case shares `partial` and is disambiguated only by a different `outcome`; assert one positive control per outcome and per projected token.
7. Replay both adapters with fresh fakes; assert tokens and canonical evidence are identical.
8. Assert the conformance coverage meta-check fails a registered harness with no classification case (test the meta-check with a synthetic registry copy).

**Expected Outcome**:

- Both adapters produce the same outcome and token for every scenario, including premature end; results projecting `partial` are compared by outcome as well as token; and the proof is structurally immune to per-adapter classification.

#### TC-HARN-005 - One shared classifier, structurally: adapters normalize only; no adapter-local classification

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-8, DEC-10
**Test Type(s)**: Static, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-imports.test.ts`, `tests/types/harness.type-test.ts`
**Tags**: @backend, @static, @contract

**Preconditions**:

- The classifier lives in the runtime-neutral core tier over the neutral evidence type.
- Adapters expose normalization and lifecycle operations only.

**Steps**:

1. Scan the adapter sources: assert zero imports of the classifier module, zero delivery-result token literals, and zero comparisons against a harness kind. Assert a non-zero file count.
2. Scan `packages/core/src/**` exports: assert exactly one classifier definition; assert it imports only contracts and pure domain modules.
3. Assert both adapter instances' `classify` member is the same bound function reference supplied by the composition root.
4. Assert the neutral evidence type is the only input the classifier accepts; a raw harness fact shape is not assignable (type test).
5. Assert the session port's public surface exposes no verdict/token field and no harness-specific escape branch.
6. Assert a second classifier module anywhere outside core fails the scan.

**Expected Outcome**:

- Classification is one shared implementation over neutral evidence; adapters cannot classify, and engines cannot branch on harness.

#### TC-HARN-006 - Harness-agnostic liveness mapping: same neutral shape from both adapters

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DEC-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/harness-liveness.test.ts`; `tests/fixtures/harness/scenarios/liveness.ts`
**Tags**: @backend, @conformance

**Preconditions**:

- Each adapter declaration states its sourced liveness kinds.
- Injected facts exist for each declared kind (traffic timestamp, worktree mtime, process liveness).

**Steps**:

1. For each adapter, produce a liveness read with every declared kind sourced; assert the neutral shape: one entry per closed kind, identical key set and order across adapters for the same declared subset.
2. Assert each sourced value equals the injected fact and carries the injected observation timestamp.
3. Assert no harness-specific key appears and the mapping performed no store/file read beyond the injected fact source (recorder shows no extra reads).
4. For a kind the adapter does not declare, assert an explicit absent entry with the kind and a closed reason, present rather than omitted.
5. Assert a read with the same clock on both adapters produces identical timestamps; replay the read and assert byte-identical canonical output.

**Expected Outcome**:

- Liveness is one neutral shape across harnesses; sourced kinds are projections and unsourced kinds are explicit absences.

#### TC-HARN-007 - Declared-absent liveness kinds read unknown, never guessed; watchdog stays zero-source

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DEC-9, NFR-6, NG-4
**Test Type(s)**: Unit, Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/harness-liveness.test.ts`, existing `tests/behaviour/watchdog-*`
**Tags**: @backend, @negative, @regression

**Preconditions**:

- A fixture in which every liveness kind is unavailable or undeclared.
- The watchdog contract's `signals-absent` classification is delivered and unchanged.

**Steps**:

1. Produce an all-absent liveness read; assert all three kinds appear as absent entries.
2. Assert no absent entry carries `0`, `false`, an empty string, or an invented timestamp; assert every absent entry carries a closed reason.
3. Map the absent entries into the watchdog signal shape; assert the keys are absent, not zero. Assert the watchdog's declared-shape check refuses the read rather than classifying `ok` or `stalled`.
4. Assert the watchdog tier imports no harness module and the harness tier imports no watchdog module (AST scan); assert the watchdog remains zero-source in its composition.
5. Run the existing watchdog suites unchanged and assert green.

**Expected Outcome**:

- Absent signals stay unknown; the watchdog can never mistake an unsourced kind for progress or stall.

#### TC-HARN-008 - opencode spawn: prompt delivered, descriptor applied, tree root mapped to the work item

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-2, F-5, AC-F3-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-session.test.ts`; `tests/fixtures/harness/harness-io.ts`
**Tags**: @backend, @harness

**Preconditions**:

- The opencode adapter is constructed over an injected runner and a configured descriptor.
- The machine-readable spawn output fixture returns a session id and metadata.

**Steps**:

1. Spawn with a work-item ref, a prompt, and the descriptor. Assert the runner was invoked exactly once with the configured command, the machine-readable output flag, the declared work directory, the descriptor-built environment, and a bounded timeout.
2. Assert the prompt reached the harness as data (stdin or the declared input file), byte-identical to the injected prompt.
3. Assert the returned handle carries the harness kind, the session id parsed from the machine-readable output, and the work-item mapping; assert the tree root equals the session id.
4. Assert the handle carries no result token and no harness-specific raw payload beyond declared evidence.
5. Return malformed output; assert a classified spawn failure naming the parse failure, with no fabricated session id.
6. Return a non-zero exit; assert a classified failure that carries the observed status in evidence and does not throw.
7. Assert no second spawn was attempted (no undeclared retry) and no real binary was resolved.

**Expected Outcome**:

- Spawn delivers the prompt, applies the descriptor, and maps the tree root to the work item; failure modes are classified data.

#### TC-HARN-009 - opencode resume/steer: attaches the existing session, no new tree root, failure classified

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-session.test.ts`
**Tags**: @backend, @harness

**Preconditions**:

- An existing session handle with a tree root exists.
- The adapter's resume command and steering payload shape are fixtures.

**Steps**:

1. Resume with a steering message. Assert exactly one invocation carrying the resume command, the existing session id, and the steering payload; assert the returned handle keeps the root.
2. Assert no new root mapping was written (mapping writer spy called zero times) and no new session id was fabricated.
3. Assert the steering payload is delivered verbatim as data: a message beginning with `--` or containing shell metacharacters is not interpreted as flags or commands.
4. Resume an unknown/absent session id; assert a classified failure and zero new session creation.
5. Resume where the adapter declares no resume capability (test double declaring the gap); assert the gap is returned before any invocation and the runner recorded zero calls.

**Expected Outcome**:

- Resume attaches to the existing tree without creating a root, and every failure path is classified visible data.

#### TC-HARN-010 - opencode premature end and liveness: shared classification and ported signal handling

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-2, AC-F3-1, AC-F2-1, AC-F2-2
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-session.test.ts`
**Tags**: @backend, @harness, @regression

**Preconditions**:

- Completion, premature-end, and failure I/O fixtures exist.
- The session-traffic and process liveness facts are injected.

**Steps**:

1. Completed run with a completion marker; assert outcome `completed` and token `finished` (positive control).
2. Run that ends before the completion marker; assert collect returns the facts, normalize yields premature-end evidence, and classify yields outcome `premature-end` with token `partial`.
3. Run with a non-zero exit; assert outcome `failed` and token `failed`, distinct from premature end.
4. Assert the premature-end outcome and token equal the Claude Code result for the equivalent scenario (cross-reference TC-HARN-004); assert the tool-failure case shares `partial` and differs by outcome.
5. Request liveness mid-session; assert session traffic and process map into the neutral shape from the injected facts; assert an undeclared worktree-activity kind is an explicit absence.
6. Assert the fixture header records the bash-era behaviour mapping it pins (spawn/resume/list; keys-env credentials replaced by the descriptor) and that no bash script is executed.

**Expected Outcome**:

- The ported opencode behaviour preserves the three-way outcome distinction and the signal semantics, with the shared `partial` projection disambiguated by outcome, and with parity pinned by fixture, not by executing the bash stack (GAP-T2).

#### TC-HARN-011 - Claude Code headless spawn, collect, classify, and resume-as-a-gap

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F1-1, AC-F2-1, AC-F2-2, DEC-4
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-claude-session.test.ts`
**Tags**: @backend, @harness

**Preconditions**:

- Claude Code headless I/O fixtures exist for completion, premature end, and drift.
- The adapter declaration is injected.

**Steps**:

1. Headless spawn; assert the invocation args carry the non-interactive/headless flag set, the prompt is delivered as data, and the descriptor-built environment is applied (defer exactness to TC-HARN-012).
2. Completed run; assert collect and classify produce outcome `completed` and token `finished`.
3. Premature-end run; assert outcome `premature-end` and token `partial`, equal to the opencode result for the same scenario.
4. Resume request; assert the adapter returns the declared gap naming resume and the harness, the runner recorded zero invocations, and no prompt re-entry fallback was executed.
5. Assert only declared liveness kinds are sourced; every unavailable kind is an absent entry; assert the invocation log contains no undeclared shell-out.
6. Assert an optional headless field missing degrades with a warning and still classifies; a missing required completion marker classifies premature end rather than throwing.

**Expected Outcome**:

- Headless delivery works through the shared classifier, and resume degradation is visible rather than silent.

#### TC-HARN-012 - Deny-by-default spawn environment: exactly the declared set, undeclared parent variables absent

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-2, DEC-2, NFR-5
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-env.test.ts`; `tests/fixtures/harness/spawn-env.ts`
**Tags**: @backend, @security, @critical

**Preconditions**:

- The injected runner records the exact environment it receives.
- The synthetic parent environment and descriptor are the §4.3 fixture; all values are fabricated.

**Steps**:

1. Build the session and spawn. Capture the observed child environment.
2. Assert the sorted observed key list equals the sorted declared-name list (set equality, not a named-leak check).
3. For every undeclared parent variable, assert `Object.hasOwn` is false; assert its canary value appears nowhere in the observed environment or in serialized evidence.
4. Assert no undeclared key is present as an empty string, `"undefined"`, or `"null"`.
5. Assert the declared work path and model-routing variables carry the declared values.
6. Run the same construction twice; assert deep equality and byte-identical canonical serialization.
7. Confirm the mutation control exists in TC-HARN-029: a parent-spread builder fails this test naming the leaked key.

**Expected Outcome**:

- The child environment is exactly the declared set; inheritance is impossible, and leakage fails structurally.

#### TC-HARN-013 - Use-time credential resolution; unresolvable reference fails closed, naming the reference

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-2, DEC-2, NFR-5, NFR-9
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-spawn-credential.test.ts`
**Tags**: @backend, @security, @critical

**Preconditions**:

- A fake credential port records `resolve` calls and returns either material or `config.credential.missing`.
- The parent environment holds the credential source key and a decoy value under an undeclared name.

**Steps**:

1. Declare one credential reference in the descriptor. Construct the session, then change the fake port's material, then spawn. Assert the observed value is the second material and `resolve` was called once at spawn, not at construction.
2. Assert the credential source key is absent from the child environment; the resolved value appears only under the declared variable name.
3. Configure `resolve` to fail. Assert spawn refuses with a classified failure whose message names the declared reference; assert zero runner invocations and no partial environment.
4. Assert the decoy parent value was never used (no ambient fallback) and the failure identity is from the shipped error table.
5. Serialize the failure result and evidence; assert the synthetic secret canary appears nowhere.
6. Assert the declarative configuration output (harness branch resolution) contains the reference name only, never the canary.
7. Remove a declared non-credential variable; assert the classified failure names that variable and the runner recorded zero invocations (RSK-3).

**Expected Outcome**:

- Credentials resolve at spawn time through the port, only into the child environment; every unresolvable or missing declaration fails closed, names the item, and leaks nothing.

#### TC-HARN-014 - Spawn-path secret boundary: no ambient environment reads; no credential material in any output

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-9, §21
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-imports.test.ts`; `scripts/checks/secret-read-boundary.ts`; `tests/checks/secret-read-boundary.test.ts`
**Tags**: @backend, @security, @static

**Preconditions**:

- The secret-read boundary check and its allowlist are the authority.
- The spawn-path module set is known to the delivery plan.

**Steps**:

1. Run `bun run scripts/checks/secret-read-boundary.ts`; assert green and assert the `credential-material` allowlist class still has exactly the credentials directory (no spawn-path entry).
2. Scan the spawn-path and harness adapter sources for `process.env`, `Bun.env`, `Deno.env`, `globalThis.process`, and computed environment element access; assert zero, with a non-zero file count.
3. Assert the parent environment record is created only at the composition edge and passed as an argument into the descriptor builder (AST/type assertion).
4. Run a successful and a failed spawn; deep-scan the result, evidence, warnings, telemetry payload, and rendered output for the secret canary; assert zero occurrences.
5. Assert the redaction chokepoint is on the only path that serializes spawn evidence (import assertion / call-site scan).
6. Assert a seeded ambient read in a copied spawn module fails the check by name (TC-HARN-029).

**Expected Outcome**:

- The spawn path performs no ambient secret read, gains no allowlist entry, and never emits credential material.

#### TC-HARN-015 - Execution-environment seam: host is the only implementation, nothing else hardcodes host execution

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-2, DEC-8, NFR-8
**Test Type(s)**: Static, Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-contract.test.ts`
**Tags**: @backend, @static, @contract

**Preconditions**:

- The descriptor is an interface with a host implementation.
- The adapter receives the descriptor as an injected dependency.

**Steps**:

1. Assert the production execution-kind vocabulary contains exactly host; a second production kind is absent. Assert the host implementation is the only module that maps the kind to execution behavior.
2. Assert the adapter imports the descriptor interface, not the host module; assert the composition root injects the host implementation.
3. Provide a test-only descriptor double implementing the same interface to the adapter's spawn; assert the adapter accepts it unchanged (the containerized seam). Assert the double exists only under `tests/` and never in production sources.
4. Scan for host-execution literals: the string `host`, `process.platform`, `process.cwd`, and absolute/tilde store paths. Assert they appear only in the descriptor implementation, the config defaults, and adapters; zero in core domain/app.
5. Assert no `node:child_process` outside the declared spawn adapter path.

**Expected Outcome**:

- Host execution is one implementation behind a data descriptor; the adapter has no host knowledge and the container seam remains open.

#### TC-HARN-016 - Harness configuration: defaults, config-driven selection, A-then-B switch with no code change

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F5-1, DM-3, DEC-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`; `tests/fixtures/harness/config/**`
**Tags**: @backend, @config

**Preconditions**:

- The production catalog gains a harness branch; the resolver and provenance mechanics are delivered.
- Configuration fixtures exist: empty/default, opencode-selected, claude-selected, custom store path.

**Steps**:

1. Resolve an empty configuration; assert the default kind is opencode, execution kind host, the default store locations, and the default allowlist, each with a `defaults` origin.
2. Resolve the claude-selected fixture; assert the resolved kind and origins, and assert the composition built the Claude adapter and not the opencode adapter.
3. Resolve the opencode-selected fixture; assert the opencode adapter is built. Assert the same code path handled both, with no code change.
4. Assert `catalogPaths(PRODUCTION_CATALOG)` contains the harness branch paths and that the branch is discoverable through the inspection surface with origins.
5. Assert the selected harness is not supplied by a command-line flag or a runtime literal.
6. Assert the defaults are byte-identical to the shipped default fixture (declaring nothing keeps today's behavior).

**Expected Outcome**:

- Harness choice and store locations are configuration data; switching the selection switches the adapter with no code change.

#### TC-HARN-017 - Configuration validation: invalid values classify with origin, never default silently

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F5-1, DM-3
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`
**Tags**: @backend, @config, @negative

**Preconditions**:

- Configuration fixtures exist for each invalid case.
- The error table is the identity authority.

**Steps**:

1. Unknown harness kind (for example, a third runtime name) → `config.value.invalid` naming the path and the offending value; assert no default substitution and no adapter constructed.
2. Wrong type for a store location (number, array), empty string, and an invalid path shape → `config.value.invalid` per field, naming the path and origin.
3. An allowlist entry that carries a literal value instead of a name/reference → rejected with the existing secret-forbidden/forbidden-value identity; assert it is never accepted as configuration.
4. An unknown key inside the harness branch → `config.key.unknown`; assert strict unknown-key discipline.
5. Assert every failure names the configuration path and origin, and the identity is a member of `ERROR_TABLE`.
6. Assert a failed resolution never returns a partial harness config (no opencode fallback) and constructs no adapter.

**Expected Outcome**:

- Invalid harness configuration is visible and classified with provenance; no invalid value silently becomes a default.

#### TC-HARN-018 - Store locations resolve from configuration, including a bind-mount-style location

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-7, AC-F5-3, DM-3, DEC-8
**Test Type(s)**: Unit, Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-config.test.ts`, `tests/behaviour/harness-telemetry-opencode.test.ts`
**Tags**: @backend, @config, @container-seam

**Preconditions**:

- Store access seams accept an injected path.
- A temp directory outside the repository stands in for a bind-mounted shared store.

**Steps**:

1. Configure store path A; assert the opencode store seam received A and no default fallback occurred.
2. Configure a bind-mount-style temp path B containing the synthetic store; assert extraction succeeds against B and the repository-relative assumption is absent.
3. Configure the Claude Code session directory; assert the file reader received the configured directory.
4. Assert no store path literal appears outside config defaults and adapters (AST scan); assert no `homedir()`/`HOME` read in the spawn or extraction path (injected data only).
5. Remove the harness branch; assert the default store location is used and the origin is `defaults`.

**Expected Outcome**:

- Store locations are configuration data; a shared or bind-mounted store slots in without code changes.

#### TC-HARN-019 - opencode extraction is read-only, query-only, bounded, indexed, and lock-free

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DEC-5, NFR-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-telemetry-opencode.test.ts`; `tests/fixtures/harness/opencode-store/build.ts`
**Tags**: @backend, @readonly, @telemetry

**Preconditions**:

- The synthetic store builder creates a deterministic temp SQLite store with the session tree.
- The access seam records every statement and open option.

**Steps**:

1. Extract; assert the connection was opened read-only and the query-only pragma was issued before the first `SELECT`.
2. Issue `INSERT` and `DELETE` through the seam; assert both reject and the error is classified data.
3. Hash and mtime every file in the store directory before and after; assert identical; assert no `-wal`, `-shm`, journal, or lock file was created and no checkpoint was issued.
4. Open a fresh writer connection with `busy_timeout = 0`, run `BEGIN IMMEDIATE`, insert, and commit; assert success without retry (no lingering lock).
5. Assert the statement count equals the expected constant; every statement has a `LIMIT` and filters on an indexed column.
6. Run `EXPLAIN QUERY PLAN`; assert no full scan of the message or part table and that the tree filter is index-backed.
7. With cap + 3 sessions, assert the read is capped, `truncated`/omitted are marked, and statement count does not grow.
8. Missing store and unreadable store: assert a classified degraded/failed capture outcome, never a crash.

**Expected Outcome**:

- Extraction cannot mutate or lock the store, cannot scan unbounded, and degrades visibly when the store is unavailable.

#### TC-HARN-020 - Claude Code extraction: read-only file parsing, bounded, metadata only, no content leakage

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DEC-5, NFR-2, NFR-3, §20
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-telemetry-claude.test.ts`; `tests/fixtures/harness/claude-code/**`
**Tags**: @backend, @readonly, @privacy, @telemetry

**Preconditions**:

- Synthetic session files (transcripts plus usage records) with a privacy canary in message content.
- The injected file reader records every path and byte range.

**Steps**:

1. Extract; assert every file was opened read-only and the reader recorded no write, rename, or delete.
2. Assert file sizes and mtimes are unchanged and no new file appeared in the store directory.
3. Assert the output key set matches the pinned neutral shape; assert no field carries free-form content and the privacy canary appears nowhere.
4. Assert the reader is bounded by the declared per-file byte cap and line cap; with an oversized fixture, assert truncation marks and an explicit omitted count.
5. Malformed line: assert a warning naming the line/file and capture continues.
6. Missing file: assert a classified failed/degraded capture outcome, no crash.
7. Assert no shell-out occurs (the invocation log has no command for extraction; only the file reader was used).

**Expected Outcome**:

- File extraction is read-only, bounded, metadata-only, and never leaks conversation content.

#### TC-HARN-021 - Harness-neutral statistics shape: token classes, calls, tools, per agent/model, tree attribution

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F8-1, EVT-1, DM-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-telemetry-shape.test.ts` (or the two extractor suites); shared shape fixture
**Tags**: @backend, @telemetry, @contract

**Preconditions**:

- Semantically equivalent opencode store and Claude Code file fixtures: one root, two child agents, two models, tool usage on each.
- The neutral shape is declared once in the contract tier.

**Steps**:

1. Run both extractors; assert the output shape (key set, types, nesting) is identical; only values differ.
2. Assert every record carries exactly the five token classes (input, output, reasoning, cache read, cache write), call counts, and bounded per-tool counts.
3. Assert per-session agent and model identity; assert the two agents and two models are represented and not collapsed.
4. Assert one record per session, unique session ids, and no aggregate record that repeats counters.
5. Assert each record carries the tree root, parent chain, and work-item ref; assert children are attributed to the root's work item.
6. Assert the harness kind and observed version are present and match the declaration.
7. Assert the payload contains no prompt, message body, transcript, diff, or tool output (canary scan).
8. Assert the schema id is a telemetry schema id (not a state or command schema) and is distinct per the delivery's pinned value; replay both extractors and assert byte-identical canonical output.

**Expected Outcome**:

- One harness-neutral statistics shape feeds every consumer; per-agent, per-model, and tree attribution are explicit and content-free.

#### TC-HARN-022 - Drift discipline: optional fields warn, missing cost is null, capture never hard-fails on drift

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-8, AC-F8-2, NFR-6, RSK-2, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-telemetry-drift.test.ts`; drift fixtures for both stores
**Tags**: @backend, @telemetry, @negative, @drift

**Preconditions**:

- Pinned-schema fixture and drift variants for both adapters.
- A version probe that can report a drifted version.

**Steps**:

1. Pinned fixture with all optional fields: assert zero warnings and all token classes numeric (positive control).
2. Store built without the optional column/field: assert capture completes, the field is null/absent, and exactly one warning names it; assert the extraction did not depend on the optional column.
3. Non-numeric optional value: assert a warning and a degraded value, never a coerced number.
4. Missing cost data: assert cost is `null` (or absent) with a warning; assert the value is not `0` and is not an estimate.
5. Drifted observed version: assert a warning naming expected and observed versions; capture completes.
6. Orphan session with no work-item mapping: assert a failed capture outcome for that session, classified and disclosed; no record with a fabricated ref.
7. Malformed required identity (no session id): assert a classified failure, no record, no placeholder id.
8. Assert the warning vocabulary is closed and each warning names the affected field; assert zero fabricated figures across all cases.

**Expected Outcome**:

- Optional drift degrades with warnings and never fails the capture; missing cost is visibly null; only unattributable or structurally invalid data fails, visibly.

#### TC-HARN-023 - Closeout capture: additive schema-versioned records, fenced and verified, readable from the log alone

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, EVT-1, DM-1, DEC-3, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-closeout-capture.test.ts`; `tests/fixtures/closeout/harness.ts` + `tests/fixtures/state/harness.ts`
**Tags**: @backend, @closeout, @telemetry

**Preconditions**:

- Closeout runtime extended with an injected telemetry capture capability.
- A telemetry fixture returns three sessions for the delivery.
- A real temp state store is available.

**Steps**:

1. Run closeout to completion with a successful capture.
2. Read the state store through its public read API; assert telemetry records exist under the store-scoped key for the work item, one payload per session, with the pinned telemetry schema id.
3. Assert each payload carries tokens by class, calls, tool counts, agent, model, harness kind/version, run id, work-item ref, tree root, and parent chain.
4. Assert the append was fenced (acquire/release ordering) and verified post-append (read-back before success).
5. Assert the state schema version is unchanged and no migration artifact or derived projection document was created.
6. Deny the harness store (unlink the temp store; make the extractor throw) and re-read the log; assert all statistics are still present and the extractor recorded zero calls.
7. Assert per-class sums equal the fixture's per-session values with no transformation drift.
8. Assert consumers can join by work item and run id (both fields present).

**Expected Outcome**:

- Closeout makes session statistics durable, attributed, schema-versioned, and readable without any harness store.

#### TC-HARN-024 - Closeout capture idempotency: re-runs append nothing; partial-then-success converges

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, NFR-7, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-closeout-idempotency.test.ts`
**Tags**: @backend, @closeout, @idempotency

**Preconditions**:

- A first closeout run has completed with a successful capture.
- The closeout operation identity and the telemetry uniqueness key are delivery-bound.

**Steps**:

1. Record the telemetry record count and payloads after run 1.
2. Run closeout again for the same delivery; assert zero new telemetry records and byte-identical payloads; assert unique session ids.
3. Run a third time; assert the same.
4. Convergence: run 1 has a failed capture (zero records, failed disclosure); run 2 succeeds (N records); run 3 succeeds (still N). Assert monotonic convergence without duplicates.
5. Add one new session to the delivery and re-run; assert exactly one new record and no duplicates of the existing ones.
6. Assert existing closeout idempotency tests remain green (operation records use their deterministic identity, not a new duplicate).

**Expected Outcome**:

- Capture converges: retries fix undercounts, never duplicate, and never rewrite prior records.

#### TC-HARN-025 - Closeout capture is non-gating: failure is classified, disclosed, and changes no other effect

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, DEC-6, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-closeout-nongating.test.ts`
**Tags**: @backend, @closeout, @negative

**Preconditions**:

- A baseline closeout run with a successful capture, with recorded step outcomes and summary.
- Failure injectors: extractor throws, store missing, state append fails.

**Steps**:

1. Make extraction throw; assert every closeout step outcome and the summary equal the baseline, the command verdict is unchanged, and zero telemetry records exist.
2. Assert the capture outcome is classified and durably disclosed with a failed count and a reason; read it back from the log after the run.
3. Degraded capture (drift fixture): assert the closeout outcome equals the baseline, the disclosure carries a degraded count and warning reasons, and records were still appended.
4. Fenced append failure: assert a classified failure disclosure, no readable partial record, and other closeout effects proceed.
5. Assert no zero-valued record, no fabricated cost, and no null session id is ever written on a failure path.
6. Assert the disclosure does not add a second event kind (it rides the closeout operation-record discipline).

**Expected Outcome**:

- Telemetry failure is visible and harmless to the delivery; missing statistics are never invented.

#### TC-HARN-026 - Output bounds: machine 65 536 bytes, human 4 096 bytes / 24 lines, capped lists with +N

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, F-8, NFR-4, DEC-7
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-output-bounds.test.ts`; cap-sized fixtures
**Tags**: @backend, @bounds, @telemetry

**Preconditions**:

- Cap-sized fixtures: session cap + 3, tool names well above the per-agent cap, agents and models above their cap.
- The declared byte and line limits are available from the contract.

**Steps**:

1. Session cap: assert at most the cap of session records and an explicit omitted count or `+N` mark; assert no unbounded dump.
2. Tool cap: assert per-agent tool counts are capped with a `+N` marker and an omitted count, deterministic by stable key order.
3. Agent and model list caps: assert the same.
4. Machine payload: assert the serialized UTF-8 byte length is at most 65 536; record the measured value; assert equality on replay.
5. Human disclosure: assert at most 4 096 bytes and 24 lines; assert the counts line fits.
6. Assert a payload that would exceed a bound is truncated with a mark (positive control) and that truncation order is deterministic.
7. Assert a mutation that removes a truncation mark fails this suite (TC-HARN-029).

**Expected Outcome**:

- Every telemetry surface is bounded and every truncation is visible; no unbounded dump path exists.

#### TC-HARN-027 - State additivity and contract reconciliation: no schema bump, no modified kind, inventories updated

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F8-1, DM-1, EVT-1, §8.5, §19
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-contract.test.ts`, existing `tests/structure/{content-inventory,port-contract-inventory,error-table}.test.ts`, `tests/behaviour/state-*`
**Tags**: @backend, @contract, @state

**Preconditions**:

- The state schema version and record-kind registry are exposed as contract data.
- The content and port inventories pin the current contract surface.

**Steps**:

1. Assert the state schema version is unchanged; assert every pre-existing record kind is present and unmodified; assert the new telemetry kind(s) are additive and versioned.
2. Assert the telemetry payload schema id is versioned and distinct from the state, machine, and command schema ids.
3. Run the existing state and closeout suites unchanged; assert green.
4. Run `bun run scripts/checks/error-table-sync.ts`; if harness error rows were added, assert the doc, table, and inventory agree and the addition is deliberate (no silent row). If none were added, assert the row count is unchanged.
5. Update the contract/content inventory fixtures for the new exports; run the inventory suites; assert the closed M0 adapter-operation set is unchanged (harness ports are in their own group).
6. Assert no migration or backfill artifact exists and a pre-change delivery reads telemetry as absent, not zero.

**Expected Outcome**:

- The telemetry record kind is additive inside the existing schema; every pinned inventory and error-table row is reconciled in the same change.

#### TC-HARN-028 - Neutrality invariant: no harness branches, imports, or literals outside adapters and declared config

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-6, AC-F5-3, AC-F5-1, NFR-8, DEC-8, RSK-6
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-neutrality.test.ts`; `.dependency-cruiser.cjs`; `tests/boundaries/**`; `scripts/checks/{forbidden-literals,ambient-globals}.ts`
**Tags**: @backend, @static, @boundary

**Preconditions**:

- The boundary matrix and the literal scans are the authority.
- The allowed occurrences are exactly the closed vocabulary in contracts and the config defaults.

**Steps**:

1. Scan `packages/core/src/{domain,app,state,config}`; assert zero harness-name literals outside the contracts vocabulary and config defaults, with a non-zero file count.
2. Scan for imports of `@delivery-os/adapters/*` in core; assert zero. Scan the harness adapter subpath for imports of `cli`, `mcp`, `opencode`; assert zero.
3. Run `pnpm check:boundaries` and `bun test tests/boundaries`; assert green; if a new runtime-API allowance was added, assert its boundary fixture exists and the fixture-coverage meta-check passes.
4. Assert `node:child_process` appears only in the declared spawn adapter path; assert core/domain/config/state have zero.
5. Assert the classifier and session port contain no harness-kind comparison and no result-token literal.
6. Run the forbidden-literal scan; assert zero product/binary literals with a non-zero scope count.
7. Seed `opencode` in a copied core domain module; assert the scan fails naming the file (TC-HARN-029).

**Expected Outcome**:

- Harness knowledge is confined to adapters and declared configuration; a leak fails structurally.

#### TC-HARN-029 - Non-vacuity meta-check: every named guard mutant fails by name

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: All ACs, NFR-1..NFR-9
**Test Type(s)**: Mutation, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/harness-mutants.test.ts`; `tests/fixtures/harness/mutants/**`
**Tags**: @backend, @meta, @mutation

**Preconditions**:

- Each mutant is a temp copy of one production module with one named guard disabled, imported via a file URL.
- The live modules pass every corresponding assertion.

**Steps**:

1. **Spawn-env spread mutant**: child env = parent spread plus declared values. Assert TC-HARN-012 fails and names the leaked key.
2. **Credential fallback mutant**: on port failure, read the parent value for the source key. Assert TC-HARN-013 fails, names the reference, and detects the runner invocation.
3. **Ambient read mutant**: add `process.env` to a copied spawn module. Assert TC-HARN-014 fails naming file and line.
4. **Adapter classify mutant**: add an adapter-local token divergent from the shared classifier. Assert TC-HARN-004 and TC-HARN-005 fail naming the adapter and the scenario.
5. **Liveness zero mutant**: default an absent kind to `0`. Assert TC-HARN-007 fails naming the kind.
6. **Extractor write mutant**: issue an `INSERT` or drop the query-only pragma. Assert TC-HARN-019 fails naming the statement.
7. **Full-scan mutant**: remove the `LIMIT`/indexed filter from one query. Assert TC-HARN-019 fails naming the query.
8. **Cost-zero mutant**: render missing cost as `0`. Assert TC-HARN-022 fails naming cost.
9. **Drift hard-fail mutant**: throw on an absent optional field. Assert TC-HARN-022 fails naming the field.
10. **Duplicate-capture mutant**: skip the idempotency check on a re-run. Assert TC-HARN-024 fails naming the duplicated session.
11. **Gating mutant**: abort closeout when capture fails. Assert TC-HARN-025 fails naming the changed step/outcome.
12. **Silent-default mutant**: fall back to opencode for an invalid kind. Assert TC-HARN-017 fails naming the path.
13. **Truncation mutant**: remove a `+N` mark. Assert TC-HARN-026 fails naming the omitted count.
14. **Harness literal mutant**: seed `opencode` in a copied core domain module. Assert TC-HARN-028 fails naming the file.
15. Assert every mutant name appears in the failure message and that the live modules still pass; a passing mutant fails the meta-check.

**Expected Outcome**:

- Every negative, absence, parity, and read-only guard is live and non-vacuous.

#### TC-HARN-030 - Determinism and golden stability: byte-identical output over replay and map-order changes

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/harness-determinism.test.ts`; `tests/fixtures/harness/golden/**`
**Tags**: @backend, @determinism

**Preconditions**:

- Golden-producing paths exist for classification evidence, liveness shape, and telemetry payloads.
- Goldens are committed read-only and regenerated only by an explicit script.

**Steps**:

1. Produce every golden output twice with fresh fakes and the same injected facts; assert canonical JSON byte equality.
2. Change only the insertion order of map members in the input facts; assert the canonical output is identical (stable ordering rule).
3. Change the injected clock by a fixed delta consistently; assert timestamps shift deterministically while structure is identical.
4. Assert golden `mtimeMs` is unchanged after the suite; assert the explicit regeneration command is the only writer.
5. Mutate one field in a copied golden; assert the comparison fails naming the field, then restore and assert equality.

**Expected Outcome**:

- The harness seam is deterministic under identical injected facts, and goldens are stable pins, not self-fulfilling snapshots.

#### TC-HARN-031 - Package wiring, CI gates, inventory, and bash-era non-regression

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F5-1, NFR-8, §18
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/{content-inventory,subpaths}.test.ts`, `tests/checks/harness-ci-parity.test.ts`, manifests, `.github/workflows/ci.yml`
**Tags**: @backend, @ci, @packaging

**Preconditions**:

- The new adapter subpath and contract exports are the delivered surface.
- The bash suite runner and CI topology checks are the authorities.

**Steps**:

1. Assert the adapters package exports the new harness subpath (and any declared per-harness subpath); run `bun test tests/structure/subpaths.test.ts`; assert green; assert no `bin`, no `publishConfig`, and no installer registration.
2. Update `workspaceImports` and the entrypoint pins; run `bun run scripts/checks/workspace-entrypoints.ts` and `bun test tests/boundaries`; assert green.
3. Update `tests/structure/inventory.json` and contract inventories; run the inventory suites; assert no orphan file.
4. Assert the CI `ts-test` job runs `pnpm test` (which discovers the new suites) and the invariant jobs cover the new scans; run `ci-topology`, `ci-bindingness`, and `ci-supply-chain`; assert green.
5. If a dependency was added, assert the license verdict exists and the vulnerability gate is green.
6. Run `pnpm check`; assert lint, format, typecheck, tests, boundaries, and exports parity green; run `git diff --check`.
7. Assert no bash script changed; run `bash scripts/.tests/test-opencode-session.sh` and `bash scripts/.tests/test-pm-liveness.sh`; assert green.

**Expected Outcome**:

- The new surface is registered, gated, and packaged privately; the bash-era executor is untouched and still verified.

#### TC-HARN-032 - Documentation posture: harness-adapters feature spec and neighbor reconciliation

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-1, AC-F5-1, AC-F8-1, DEC-1, §18
**Test Type(s)**: Manual, Content
**Automation Level**: Manual (content checks plus the conditional distribution guard)
**Target Layer / Location**: `doc/spec/features/feature-harness-adapters.md` (new at phase 7) and the neighbor specs: adapter ports, state layer, config layer, closeout, watchdog, nonfunctional bounds, architecture overview, glossary, primitive catalogue
**Tags**: @docs

**Preconditions**:

- System-spec update (phase 7) authors the new feature page.
- The documentation handbook and distribution-marker rule are available.

**Steps**:

1. Assert the new page has frontmatter (`ados_distribution: internal`, id, status, created, last_updated, owners, service, summary, links) and describes the port surface, the two adapters, the deny-by-default spawn environment, the liveness surface, the read-only extraction, and the closeout capture discipline.
2. Assert the page makes no out-of-scope claim: no dispatch engine, no plugin generation, no container executor implementation, no spend projection, no new CLI command (DEC-1, NG-1, NG-2, NG-5, NG-6).
3. Assert the neighbor specs are reconciled: adapter-ports points at the harness ports and ADR-0008; state layer documents the additive telemetry kind and consumers; config layer documents the harness branch; closeout's non-goal is flipped and capture is documented; watchdog notes that signal sourcing arrives via adapters while economics stay M1-S15.
4. Assert the nonfunctional bounds document records the extraction read budgets, bounded reads, and payload bounds.
5. Assert architecture overview, glossary, and the primitive catalogue's harness rows point at the delivered port and adapters.
6. Run the markdown content checks (headings, lists, tables, fences, link/path review) and the forbidden-literal scan over the changed docs; assert zero violations.
7. If any marker-scoped doc changed (`doc/guides/**`, `doc/templates/**`, the standalone docs), run `bash scripts/.tests/test-doc-distribution.sh`; otherwise record N/A and list checked paths.

**Expected Outcome**:

- The documented contract matches the shipped behaviour, neighbors are consistent, and no deferred capability is promised.

**Notes / Clarifications**:

- Content-only; no runtime assertion is claimed by this TC.

#### TC-HARN-033 - opencode session listing: capability declared, bash-era list behaviour fixture-pinned, discovery over injected I/O without a new root

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1 (capability-level: session listing — spec §17 TC mapping note; no AC renumbered), DM-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-session.test.ts`; `tests/fixtures/harness/harness-io.ts` (listing fixtures and the shared bash-era behaviour header)
**Tags**: @backend, @harness

**Preconditions**:

- The opencode adapter is constructed over the same injected runner and session/read seams used by TC-HARN-008..010.
- The fixture header records the bash-era session-listing behaviour it pins (list by work item, discovery of existing session ids without creating a root); no bash script is executed (GAP-T2).

**Steps**:

1. Inspect the opencode capability declaration; assert session listing is declared as a supported operation/lifecycle capability from the closed vocabulary (TC-HARN-001), not inferred from another declared entry.
2. List with a work-item ref. Assert exactly one runner invocation carrying the declared list command, the machine-readable output flag, the declared work directory, the descriptor-built environment, and a bounded timeout; assert no spawn or resume invocation occurred.
3. Assert the parsed handles carry the session id, the tree root, the work-item mapping, and the harness kind, with no result token and no harness-specific raw payload beyond declared evidence.
4. Assert listing is read-only discovery: the mapping writer spy recorded zero calls, no new tree root or session id was created, and the read seam recorded no store write.
5. Assert the listed set equals the fixture's synthetic session set (order-independent, keyed by session id), including a session previously spawned and one previously resumed in the same injected view.
6. Return an empty result; assert an empty list with no error and no fabricated session id.
7. Return malformed output; assert a classified listing failure naming the parse failure, no fabricated id, and zero retries. Return a non-zero exit; assert a classified failure carrying the observed status in evidence and no throw.
8. With a test double whose declaration omits session listing, assert the declared gap is returned before any invocation (runner recorded zero calls), never a silent skip — the same pre-spawn gap path as TC-HARN-002.
9. Assert the listing path respects the declared session cap with an explicit truncation mark (bounds enforcement detailed in TC-HARN-026), contains no harness-kind branch and no result token, and performs no ambient environment read or network call.

**Expected Outcome**:

- Session listing is a declared, capability-gated, read-only discovery operation over the injected opencode seam: it reports the fixture's sessions mapped to the work item without creating roots, and every failure mode is classified data.

**Notes / Clarifications**:

- Capability-level case per spec §17's TC mapping note: it verifies F-3's session-listing capability; AC-F3-1's spawn/resume/premature-end/liveness assertions remain with TC-HARN-008..010 and no AC is renumbered.
- Hermetic: injected harness I/O and synthetic listing fixtures only; no live harness, no real store, no network.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|-------------|----------------|------------|-------|
| Local development | Bun `1.4.4` (repo pin), pnpm `10.18.3` | `pnpm install --frozen-lockfile`; `bun test tests/behaviour/harness-*`; `bun test tests/conformance/harness-*` | All in-process contract, conformance, adapter, telemetry, and closeout suites |
| Local boundaries and invariants | Bun | `pnpm check:boundaries`; `bun run scripts/checks/{secret-read-boundary,forbidden-literals,ambient-globals,workspace-entrypoints,error-table-sync}.ts` | Neutrality, secret boundary, imports, literals, inventories |
| CI `ts-test` | Bun `1.4.4` | `pnpm test` after `pnpm install --frozen-lockfile` | Every `*.test.ts`, including the synthetic SQLite store tests |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency-cruiser rules, runtime-API allowance, fixture coverage |
| CI `ts-invariants` | Bun | `bun run scripts/checks/*.ts` | Error-table sync, literal scans, entrypoints |
| CI aggregate | Bun | `pnpm check`; `git diff --check` | Lint, format, typecheck, tests, boundaries, exports parity |
| Bash regression | bash | `bash scripts/.tests/test-opencode-session.sh`; `bash scripts/.tests/test-pm-liveness.sh` | The untouched bash-era executor |
| Documentation | bash and manual | `bash scripts/.tests/test-doc-distribution.sh` only if a marker-scoped doc changes | Distribution-marker drift (phase 7) |

**Test data.**

- All harness I/O is synthetic: fabricated session ids, synthetic work-item refs, fixed timestamps, fixed run ids, synthetic harness versions, and a synthetic brand. No real harness invocation, provider payload, repository name, or personal data appears.
- Synthetic secrets are fabricated canaries. They are not credentials, are never reused outside their fixture, and exist to prove absence from outputs and from the spawn environment.
- The parent environment fixture contains fabricated variables only. No test reads the real `process.env`.
- The opencode store fixture is built in a temp directory by `tests/fixtures/harness/opencode-store/build.ts` using the workspace's SQLite loader pattern; rows are deterministic and contain a privacy canary in place of any message body. No binary store is committed.
- Claude Code session fixtures are committed synthetic JSONL/usage records with a privacy canary in message content; the canary must never appear in extraction output.
- Configuration fixtures are YAML files under `tests/fixtures/harness/config/**`, covering defaults, both selections, and every invalid case.

**Isolation and cleanup.**

- Every filesystem-touching suite uses `mkdtemp` and removes the temp root in `afterEach`, including on failure.
- Synthetic SQLite connections are closed in `finally`; a fresh writer probe uses its own connection and closes it.
- Goldens and pinned shape fixtures are opened read-only; `mtimeMs` is asserted unchanged.
- The live worktree is never written; a `git status --porcelain` snapshot is captured before and after the read-only and closeout suites and asserted unchanged.
- Timeouts bound process waits only; no sleep sequences protocol or filesystem steps.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Implementation status |
|-------|-------------------------------|-------------------|-----------------------|
| TC-HARN-001 | `tests/structure/harness-contract.test.ts`, `tests/types/harness.type-test.ts`; `packages/core/src/contracts/harness*.ts` | `bun test tests/structure/harness-contract.test.ts`; `pnpm typecheck` | To Implement |
| TC-HARN-002 | `tests/structure/harness-contract.test.ts`; adapter capability builders | `bun test tests/structure/harness-contract.test.ts` | To Implement |
| TC-HARN-003 | `tests/structure/harness-contract.test.ts`, `tests/behaviour/harness-config.test.ts`; harness registry module | `bun test tests/structure/harness-contract.test.ts tests/behaviour/harness-config.test.ts` | To Implement |
| TC-HARN-004 | `tests/conformance/harness-classification.test.ts`; `packages/testkit/src/conformance/harness.ts`; `tests/fixtures/harness/scenarios/classification.ts` | `bun test tests/conformance/harness-classification.test.ts tests/structure/conformance-coverage.test.ts` | To Implement |
| TC-HARN-005 | `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-imports.test.ts`, `tests/types/harness.type-test.ts` | `bun test tests/structure/harness-neutrality.test.ts tests/structure/harness-imports.test.ts`; `pnpm typecheck` | To Implement |
| TC-HARN-006 | `tests/conformance/harness-liveness.test.ts`; `tests/fixtures/harness/scenarios/liveness.ts` | `bun test tests/conformance/harness-liveness.test.ts` | To Implement |
| TC-HARN-007 | `tests/conformance/harness-liveness.test.ts`; existing `tests/behaviour/watchdog-*` | `bun test tests/conformance/harness-liveness.test.ts tests/behaviour/` (watchdog subset) | To Implement (new cases) |
| TC-HARN-008 | `tests/behaviour/harness-opencode-session.test.ts`; `tests/fixtures/harness/harness-io.ts` | `bun test tests/behaviour/harness-opencode-session.test.ts` | To Implement |
| TC-HARN-009 | `tests/behaviour/harness-opencode-session.test.ts` | `bun test tests/behaviour/harness-opencode-session.test.ts` | To Implement |
| TC-HARN-010 | `tests/behaviour/harness-opencode-session.test.ts`; bash-era semantics fixture header | `bun test tests/behaviour/harness-opencode-session.test.ts` | To Implement |
| TC-HARN-011 | `tests/behaviour/harness-claude-session.test.ts` | `bun test tests/behaviour/harness-claude-session.test.ts` | To Implement |
| TC-HARN-012 | `tests/behaviour/harness-spawn-env.test.ts`; `tests/fixtures/harness/spawn-env.ts` | `bun test tests/behaviour/harness-spawn-env.test.ts` | To Implement |
| TC-HARN-013 | `tests/behaviour/harness-spawn-credential.test.ts` | `bun test tests/behaviour/harness-spawn-credential.test.ts` | To Implement |
| TC-HARN-014 | `tests/structure/harness-imports.test.ts`; `scripts/checks/secret-read-boundary.ts` (no new entry expected); `tests/checks/secret-read-boundary.test.ts` | `bun run scripts/checks/secret-read-boundary.ts`; `bun test tests/structure/harness-imports.test.ts tests/checks/secret-read-boundary.test.ts` | To Implement (new scan cases) |
| TC-HARN-015 | `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-contract.test.ts` | `bun test tests/structure/harness-neutrality.test.ts tests/structure/harness-contract.test.ts` | To Implement |
| TC-HARN-016 | `tests/behaviour/harness-config.test.ts`; `tests/fixtures/harness/config/**`; `packages/core/src/config/{catalog,defaults}.ts` | `bun test tests/behaviour/harness-config.test.ts`; `bun test tests/behaviour/config-*` | To Implement |
| TC-HARN-017 | `tests/behaviour/harness-config.test.ts` | `bun test tests/behaviour/harness-config.test.ts` | To Implement |
| TC-HARN-018 | `tests/behaviour/harness-config.test.ts`, `tests/behaviour/harness-telemetry-opencode.test.ts` | `bun test tests/behaviour/harness-config.test.ts tests/behaviour/harness-telemetry-opencode.test.ts` | To Implement |
| TC-HARN-019 | `tests/behaviour/harness-telemetry-opencode.test.ts`; `tests/fixtures/harness/opencode-store/build.ts` | `bun test tests/behaviour/harness-telemetry-opencode.test.ts` | To Implement |
| TC-HARN-020 | `tests/behaviour/harness-telemetry-claude.test.ts`; `tests/fixtures/harness/claude-code/**` | `bun test tests/behaviour/harness-telemetry-claude.test.ts` | To Implement |
| TC-HARN-021 | `tests/behaviour/harness-telemetry-shape.test.ts`; shared shape fixture | `bun test tests/behaviour/harness-telemetry-shape.test.ts tests/behaviour/harness-telemetry-opencode.test.ts tests/behaviour/harness-telemetry-claude.test.ts` | To Implement |
| TC-HARN-022 | `tests/behaviour/harness-telemetry-drift.test.ts`; drift fixtures | `bun test tests/behaviour/harness-telemetry-drift.test.ts` | To Implement |
| TC-HARN-023 | `tests/behaviour/harness-closeout-capture.test.ts`; `tests/fixtures/closeout/harness.ts` (extend); `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/harness-closeout-capture.test.ts` | To Implement |
| TC-HARN-024 | `tests/behaviour/harness-closeout-idempotency.test.ts` | `bun test tests/behaviour/harness-closeout-idempotency.test.ts` | To Implement |
| TC-HARN-025 | `tests/behaviour/harness-closeout-nongating.test.ts` | `bun test tests/behaviour/harness-closeout-nongating.test.ts` | To Implement |
| TC-HARN-026 | `tests/behaviour/harness-output-bounds.test.ts`; cap-sized fixtures | `bun test tests/behaviour/harness-output-bounds.test.ts` | To Implement |
| TC-HARN-027 | `tests/structure/harness-contract.test.ts`; `tests/structure/{content-inventory,port-contract-inventory,error-table}.test.ts` (update fixtures); `tests/behaviour/state-*` (unchanged) | `bun test tests/structure/harness-contract.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/error-table.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Existing – Update (inventories) |
| TC-HARN-028 | `tests/structure/harness-neutrality.test.ts`, `tests/structure/harness-imports.test.ts`; `.dependency-cruiser.cjs`; `tests/boundaries/**`; `scripts/checks/{forbidden-literals,ambient-globals}.ts` | `bun test tests/structure/harness-neutrality.test.ts tests/structure/harness-imports.test.ts tests/boundaries`; `pnpm check:boundaries` | To Implement |
| TC-HARN-029 | `tests/checks/harness-mutants.test.ts`; `tests/fixtures/harness/mutants/**` | `bun test tests/checks/harness-mutants.test.ts` | To Implement |
| TC-HARN-030 | `tests/checks/harness-determinism.test.ts`; `tests/fixtures/harness/golden/**`; explicit regenerate script | `bun test tests/checks/harness-determinism.test.ts`; `bun run tests/fixtures/harness/golden/regenerate.ts --write` (reviewed, explicit) | To Implement |
| TC-HARN-031 | `tests/structure/inventory.json` (update), `tests/checks/harness-ci-parity.test.ts`, `packages/adapters/package.json`, `scripts/checks/workspace-entrypoints.ts`, `.github/workflows/ci.yml` (only if wiring is missing) | `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/checks/harness-ci-parity.test.ts`; `pnpm check`; `bash scripts/.tests/test-opencode-session.sh`; `bash scripts/.tests/test-pm-liveness.sh` | To Implement (wiring) |
| TC-HARN-032 | `doc/spec/features/feature-harness-adapters.md` (new at phase 7) and neighbor specs | Content/manual review; `bash scripts/.tests/test-doc-distribution.sh` if marker-scoped docs change | Manual Only (phase 7) |
| TC-HARN-033 | `tests/behaviour/harness-opencode-session.test.ts`; `tests/fixtures/harness/harness-io.ts` (listing fixtures) | `bun test tests/behaviour/harness-opencode-session.test.ts` | To Implement |

**Implementation mapping notes.**

- The harness conformance registry lives beside the provider conformance registry in `packages/testkit/src/conformance/` and reuses its capability-gating and coverage-gate pattern. It does not re-implement the delivery-result taxonomy; it imports the token type from core contracts.
- The spawn runner and the opencode store access seam follow the existing injected seams (`HarnessOneShotRunner`, `OpencodeSessionIo`): production passes `execFile`/the real store, tests pass recorders.
- The synthetic store builder is the only fixture that writes a SQLite file, and it writes only under a temp root.
- The closeout capture tests extend the existing closeout harness with a telemetry runtime; they do not fork the closeout fact model.
- The delivery plan maps the behaviour-named seams (contracts module, classifier, adapter subpath, config branch, record kind, capture point, descriptor implementation) to the chosen file and export names.
- The "Implementation status" column reflects the pre-delivery plan; §10 supersedes it with executed or deferred status.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| R-T1 | The proof validates mocks, not real harnesses (RSK-4). | Make divergence structural: one classifier, adapters normalize only, mutation control with an adapter-local classify, and an evidence-shape assertion. Live evidence stays out of CI by design (GAP-T1). |
| R-T2 | The spawn-env test observes a different path than production uses, so a real spawn could still inherit. | Assert the injected runner is the only spawn site (`node:child_process` scan), the parent env is injected at the composition edge, and the secret boundary covers the spawn path; add the ambient-read mutant. |
| R-T3 | SQLite read-only behavior varies by runtime or filesystem, causing flakes. | Build the store in a temp root, use the workspace's `bun:sqlite`/`node:sqlite` loader, close in `finally`, use `busy_timeout = 0` for the lock probe, and assert file hashes rather than timing. Bun always provides `bun:sqlite`; a runtime without either fails loudly. |
| R-T4 | "No lock" is asserted by proxy (GAP-T3), so a subtle shared lock could pass. | The writer probe immediately after extraction is the strongest hermetic signal; the read-only and query-only assertions cover the intent. Record the limitation in §1.2 so it is not mistaken for a direct measurement. |
| R-T5 | Claude Code headless JSONL shapes are a delivery-time discovery; fixtures could encode a wrong shape and pass. | Tests assert the declared mechanism and the drift behavior, not a guessed inventory. Fixtures are derived from the delivered reader contract; any shape change surfaces as a drift warning test failure (GAP-T5). |
| R-T6 | Closeout capture tests fork the closeout harness and drift from the real transaction. | Extend `tests/fixtures/closeout/harness.ts`; reuse the state harness for durability; assert existing closeout suites unchanged. |
| R-T7 | New contract exports, config keys, record kinds, or error rows break inventory and error-table tests, blocking delivery late. | TC-HARN-027 and TC-HARN-031 make the reconciliation explicit and same-change; the delivery plan sequences contract vocabulary first. |
| R-T8 | The default allowlist key set is unknown, so tests could over-pin a fixture and block a legitimate config change. | Assert the rule over a representative declared set (GAP-T6); never freeze the default key list in this plan. |
| R-T9 | Optional-field drift is asserted as "always captured", but a truly unreadable store is a failure; tests could conflate them. | §4.6 separates optional drift (captured + warning) from unattributable/invalid identity and unreadable store (classified failure). Each has its own case. |
| R-T10 | Idempotency is asserted on one key shape; a real re-run could use a different run id and duplicate. | The test fixes run id vs changed delivery explicitly: same delivery (same run and sessions) → zero new; new session → exactly one new. The uniqueness key is asserted by uniqueness of (work item, run, session). |

### 8.2 Assumptions

- The delivery exposes an injected child-process runner shaped like the existing `HarnessOneShotRunner`, so the spawn environment is observable without spawning; exact names are delivery-bound.
- The delivery exposes an injected store access seam for the opencode store and an injected file reader for Claude Code, following the existing `OpencodeSessionIo` pattern.
- The credential port is consumed unchanged and returns material or `config.credential.missing`; no test needs a real secret.
- The harness version probe is injected data; unknown versions degrade with a warning rather than a hard failure.
- The neutral evidence shape, the telemetry payload schema id, the record kind name, and the config key names are delivery-bound; their semantics and closed vocabularies are pinned.
- The closeout runtime can accept an injected telemetry capture capability without changing the delivered closeout fact model.
- Bun (and therefore `bun:sqlite`) is available in `bun test`; the production extractor uses the workspace SQLite loader pattern so Node hosts remain supported.
- The bash-era scripts remain untouched and are verified by their existing suites.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution path |
|----|----------|-----------|-------|-----------------|
| OQ-T1 | Do harness failures declare new `harness.*` error-table rows, or reuse `config.credential.missing` and `config.value.invalid`? | No | `@plan-writer` / `@coder` | Resolve at delivery planning. Either way the identity must be in `ERROR_TABLE`; if rows are added, TC-HARN-027 and TC-HARN-031 require doc/table/inventory sync in the same change. |
| OQ-T2 | Which liveness kinds and optional telemetry fields Claude Code headless mode affords? | No | `@coder` | Delivery-time discovery; the declaration encodes the answer and absent kinds must be declared; TC-HARN-002/006/007 assert the mechanism. |
| OQ-T3 | Which variable names the default allowlist declares (model routing, work paths)? | No | `@coder` | Declared configuration with origin evidence; TC-HARN-012 asserts the rule over a representative set (GAP-T6). |
| OQ-T4 | Exact telemetry record-kind name, store-key spelling, and payload-schema string? | No | `@coder` | Delivery-bound; TC-HARN-023/027 read them from the contract and pin them in fixtures. |
| OQ-T5 | Exact neutral evidence field names and the classifier's signature? | No | `@plan-writer` / `@coder` | Delivery-bound; TC-HARN-004/005 assert the shape and the single implementation, not the spelling. |
| OQ-T6 | Is the harness adapter one `./harness` subpath or per-harness subpaths? | No | `@plan-writer` | Delivery-bound; TC-HARN-031 resolves the subpath from the manifest and asserts the declared exports. |
| OQ-T7 | What are the numeric caps for sessions, tools per agent, agents, and models? | No | `@coder` | Delivery-bound constants with explicit truncation; TC-HARN-026 asserts enforcement and marks, and the 65 536/4 096/24 limits from NFR-4. |
| OQ-T8 | Is the capture outcome a new closeout operation name or an additive payload on the existing operation record? | No | `@coder` | Delivery-bound within the "no second event kind" rule; TC-HARN-025 asserts durable disclosure, not the record's name. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial test plan for GH-233 (M1-S11: Harness adapters and dispatch portability). 32 TCs cover all 12 ACs, all nine NFRs, EVT-1, DM-1..DM-4, DEC-1..DEC-10, the deny-by-default spawn-environment oracle, identical-classification conformance, harness-agnostic liveness with declared absences, read-only bounded extraction for both stores, drift discipline, closeout durability/idempotency/non-gating, neutrality and secret-boundary scans, bounds, determinism, wiring, and the documentation posture. |
| 1.1 | 2026-11-06 | @test-plan-writer | DoR iteration 1 remediation (finding 2, minor: test_traceability). Added TC-HARN-033 covering F-3's session-listing capability at capability level — declaration, bash-era list-behaviour fixture header, and the listing operation exercised over injected opencode I/O (read-only discovery, no new root, failures classified) — traced per spec §17's capability-level TC mapping note; updated §3.1 AC-F3-1 row and capability coverage, the §4 opencode adapter row, §5.1/§5.2, and §7. TC-HARN-001..032 ids, homes, and wording unchanged; now 33 TCs. |
| 1.2 | 2026-11-07 | @test-plan-writer | Reopened test_planning — review iteration 1 finding F-2 (medium, spec-compliance) remediation, executing the plan header's own rule that a real deviation reopens the test plan rather than shipping a stale oracle. §4.2 now pins the delivered outcome-to-token projection: `completed`→`finished`, completed-with-tool-failure→`partial`, `premature-end`→`partial`, `failed`→`failed`, `refused`→`noop-lane-permission`, `timed-out`→`max-restarts`. Tokens are the delivery-result taxonomy's shared tokens reused by the dispatch-session-path classifier (that class declares no completion tokens of its own); the `outcome` field is REQUIRED to disambiguate results projecting `partial` (premature-end vs completed-with-tool-failure), and `noop-lane-permission` from the harness path means spawn-refused. Identical-classification (DEC-10/TC-HARN-004/TC-HARN-005) still holds because the mapping is one shared pure function — adapters normalize, the classifier maps. Expected-token notes updated in TC-HARN-004, TC-HARN-010, and TC-HARN-011 only. The projection is routed to @decision-advisor for TDR-0005 ratification (pending); this plan reflects delivered truth in the interim. No TC id, home, or non-token content changed; still 33 TCs. |

## 10. Test Execution Log

Execution window: 2026-11-06, branch `feat/GH-233/harness-adapters`. Runtime:
Bun 1.4.4 (repo pin), pnpm 10.18.3, Node v24.11.1 (MCP smoke only). Evidence was
collected with `PATH=$HOME/.bun/bin:$PATH TMPDIR=$PWD/tmp/tmpdir`.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-HARN-001 | 2026-11-06 | PASS | Closed vocabularies, data-only contract scan, declaration invariants. |
| TC-HARN-002 | 2026-11-06 | PASS | Both adapter declarations exhaustive; Claude resume/steer and unsourced liveness gaps pre-spawn. |
| TC-HARN-003 | 2026-11-06 | PASS | Config-driven kind resolution, injected version, unknown kind classified, probe failure warns. |
| TC-HARN-004 | 2026-11-06 | PASS | Six scenarios; identical tokens on both adapters; premature end distinct from completed/failed. |
| TC-HARN-005 | 2026-11-06 | PASS | Exactly one classifier; adapter sources carry no classifier/token/kind comparison; shared bound reference. |
| TC-HARN-006 | 2026-11-06 | PASS | Identical neutral liveness key set/order; sourced values/timestamps equal injected facts. |
| TC-HARN-007 | 2026-11-06 | PASS | All-absent read keeps three explicit absences; watchdog mapping {} and `signals-absent`; tiers do not import each other. |
| TC-HARN-008 | 2026-11-06 | PASS | One spawn with command/args/work dir/descriptor env/timeout; prompt byte-identical; failures classified. |
| TC-HARN-009 | 2026-11-06 | PASS | Resume keeps root, steering payload verbatim as stdin, unknown session and declared gap classified with zero calls. |
| TC-HARN-010 | 2026-11-06 | PASS | Completed/premature/failed three-way distinction; liveness traffic+process sourced, worktree absent. |
| TC-HARN-011 | 2026-11-06 | PASS | Headless spawn/prompt-as-data; shared classification; resume gap with zero invocations; optional drift warns. |
| TC-HARN-012 | 2026-11-06 | PASS | Key-set equality, undeclared keys absent, canaries absent, deterministic; session-port path observed. |
| TC-HARN-013 | 2026-11-06 | PASS | Use-time resolution (second material), source key absent, unresolvable reference names reference, zero invocations. |
| TC-HARN-014 | 2026-11-06 | PASS | No ambient environment reads in the harness/spawn path; harness subpath has no child-process site; secret boundary green. |
| TC-HARN-015 | 2026-11-06 | PASS | Host is the only execution kind; core names no host execution; descriptor injected; one new spawn site. |
| TC-HARN-016 | 2026-11-06 | PASS | Defaults byte-identical, A-then-B selection through one path, catalog paths/origins exposed. |
| TC-HARN-017 | 2026-11-06 | PASS | Unknown kind/wrong type/empty/invalid path/allowlist literal/unknown key classified with path+origin. |
| TC-HARN-018 | 2026-11-06 | PASS | Configured store A and bind-mount-style B extraction; default origin on branch removal. |
| TC-HARN-019 | 2026-11-06 | PASS | Read-only open + query-only pragma first; INSERT/DELETE rejected; hashes/mtimes unchanged; writer probe immediate; no message/part scan; cap+3 omitted 3. |
| TC-HARN-020 | 2026-11-06 | PASS | Read-only file reads; sizes/mtimes unchanged; bounded lines with omitted count; malformed line warns; missing file classified; canary absent. |
| TC-HARN-021 | 2026-11-06 | PASS | Identical shape from both extractors; five token classes; two agents/two models; tree attribution; replay byte-identical. |
| TC-HARN-022 | 2026-11-06 | PASS | Optional column/cost drift warn and never hard-fail; missing/non-numeric cost null (never 0); version drift names both; orphan/invalid identity fail visibly. |
| TC-HARN-023 | 2026-11-06 | PASS | Three records under the store-scoped key; fenced append before release; verified read-back; schema version unchanged; join keys present. |
| TC-HARN-024 | 2026-11-06 | PASS | Re-runs append nothing; byte-identical payloads; failed→success convergence; one new session appends exactly one. |
| TC-HARN-025 | 2026-11-06 | PASS | Thrown/failed/append-failed captures change no step, summary, or verdict; failed count disclosed; no zero-valued record. |
| TC-HARN-026 | 2026-11-06 | PASS | Session 64/omitted 3, tool cap 24/omitted, agent/model caps; machine bytes ≤ 65 536; human ≤ 4 096 bytes / 24 lines; deterministic truncation. |
| TC-HARN-027 | 2026-11-06 | PASS | Schema version unchanged; telemetry kind additive and distinct; pre-existing kinds unchanged; doc/table/inventory sync green. |
| TC-HARN-028 | 2026-11-06 | PASS | Core harness literals confined to the closed vocabulary/config; no adapter imports in core; seeded literal fails by name; forbidden-literal scan green. |
| TC-HARN-029 | 2026-11-06 | PASS | Fourteen named mutant families each fail their oracle while live modules pass. |
| TC-HARN-030 | 2026-11-06 | PASS | Goldens match canonical output; replay byte-identical; insertion-order and one-field mutation controls hold; mtime unchanged. |
| TC-HARN-031 | 2026-11-06 | PASS | `./harness` subpath, entrypoint edges, inventory complete; CI jobs discover suites/scans; bash suites 21/21 and 18/18. |
| TC-HARN-032 | 2026-11-06 | PASS | Documentation handoff: new feature spec plus neighbor reconciliation; no out-of-scope claim; no marker-scoped doc touched. |
| TC-HARN-033 | 2026-11-06 | PASS | Session listing declared; one read-only invocation; handles/roots mapped; empty/malformed/non-zero/gap classified; cap+mark. |

**Delivery-phase evidence.** Runs: `pnpm typecheck`; the per-phase named suites;
`pnpm check:boundaries`; `pnpm check` (aggregate). Conformance case count 6
against the six-scenario floor, both adapters. Opencode extraction on the full
fixture: 3 sessions, 1 root + 2 children, 2 agents, 2 models, 5 token classes;
statement log records the query-only pragma before the first SELECT; EXPLAIN
QUERY PLAN shows no `SCAN message`/`SCAN part`; store hashes and mtimes are
unchanged; no sidecar files; the immediate writer probe succeeds. Spawn-env
key-set diff is empty against the declared set. Machine payload measured at or
under 65 536 bytes and human disclosure at or under 4 096 bytes / 24 lines in
the bounds suite. Fourteen mutant families pass their meta-check. The aggregate
`pnpm check` was run at the delivered HEAD: lint/format/typecheck/boundaries/
exports parity pass; the only failing suites are pre-existing moving-base CI
checks unrelated to this change (the frozen `origin/main-tools` CI topology
drift and the release-changeset PR-time oracle), recorded here rather than
claimed as passing.
