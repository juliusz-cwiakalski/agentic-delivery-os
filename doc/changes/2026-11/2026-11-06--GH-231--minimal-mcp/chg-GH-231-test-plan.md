---
id: chg-GH-231-test-plan
status: Updated
version: 1.1
created: 2026-11-06T00:00:00Z
last_updated: 2026-11-06T12:31:54Z
owners: [engineering]
service: delivery-os MCP surface
labels: [change, planning]
version_impact: minor
summary: "Prove the minimal MCP surface is a faithful, thin, read-only mirror of the three proven engines. Shared CLI/MCP fixtures assert canonical-JSON-identical data shapes and identical stable error field sets with zero exit-code or envelope-key leakage; the server advertises exactly three branding-projected tools, survives classified failures, exits only 0/1/2 with diagnostics kept off the transport channel, runs under Node, treats hostile content as inert data, writes nothing, spawns nothing, and introduces no new error-table rows, domain kinds, configuration keys, or state schema. The battery is hermetic: no live network, no credentials, no real HOME, and no spawned CLI for parity."
links:
  change_spec: ./chg-GH-231-spec.md
  implementation_plan: ./chg-GH-231-plan.yaml   # authored in delivery_planning; the legacy .md remains readable if only .md is produced
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S7: Minimal MCP

## 1. Scope and Objectives

`status`, `verify-artifact`, and `gate-report` are only useful if an agent host can trust them to say exactly what the CLI says. This plan protects four contracts at once: **mirror parity** (the same injected inputs produce the same `data` and the same stable error identity, byte-for-byte after canonicalization), **boundary isolation** (the `CommandResult` envelope and the `{0,1,2}` exit projection never cross into a tool payload, and no `cli`↔`mcp` import exists in either direction), **lifecycle honesty** (the serve process exits only `0`/`1`/`2`, diagnostics never touch the transport channel, and a classified tool failure never terminates the server), and **untrusted-by-default behavior** (tool inputs are validated once at the boundary; tracker, CI, and ledger content is inert; zero writes, fences, state mutations, or process spawns).

The risk this battery addresses is not "does the happy path work" but "does the second surface silently drift from the first." A per-surface golden would let both surfaces drift together, so the CLI is the live oracle for parity and the committed goldens are a second, independent pin. The battery is a verification map, not an execution claim: no MCP code exists at test-plan time and no suite below was run.

### 1.1 In Scope

- The tool catalog and protocol surface: initialize, tool discovery, and tool invocation over stdio; exactly three read-only tools with canonical primitive IDs `status`, `verify-artifact`, and `gate-report`; no batch, mutating, or additional tool (F-1, F-2, F-3, F-4, F-6; AC-F1-2, AC-F6-1; DM-1..DM-4).
- Mirror parity for all three tools on the shared status, verify-change, and verify-gates fixtures: success `data` shapes and failure identities, including the full contracted error field set (`code`, `category`, `retryable`, `consequence`, `remediationHint`, optional `summary`) (F-5; AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1; NFR-1, NFR-2, NFR-11).
- Boundary input validation: missing, empty, or non-string change ref maps to `input.value.rejected`; hostile or path-shaped refs follow the CLI grammar exactly; no crash and no transport fault (F-5, F-7; AC-F5-2).
- Exit-code and envelope isolation: zero exit-projection imports into `packages/mcp`, zero `exitCode`/`runId`/`timing`/envelope-wrapper keys in any payload, and a failed tool call followed by continued serving (F-5; AC-F5-3; NFR-3).
- Serve lifecycle: clean stop `0`, configuration error `1`, transport/framing fault `2`, no other exit value, diagnostics only on the diagnostics channel (F-1; AC-F1-1; NFR-6, NFR-10).
- Node portability smoke: start the declared serve entry under Node, handshake, list the three tools, call each tool, and compare payloads with the in-process Bun expectations (and with the Bun process run when the built entry executes there) (F-1, F-6; AC-F1-3; NFR-4, NFR-8).
- Branding projection and naming firewall: served names are `BrandIdentity.mcpToolPrefix` plus the canonical primitive ID; zero product or binary literals in the surface; the tool-list snapshot changes only in the prefix under a rename (F-6; AC-F6-1; NFR-5).
- Prompt-injection inertness: hostile instructions planted in tracker, CI, and ledger evidence appear only as payload data; no action, no extra read, no write, no spawn, and no elevation into tool descriptions (F-7; AC-F7-1; NFR-10).
- Read-only guarantee: zero writes, fences, state mutations, or process spawns; the state store and all documents are byte-identical before and after (F-7; AC-F7-2; NFR-7).
- Dependency compliance: any external dependency introduced by this change carries a license-registry verdict in the same change; the fail-closed audit and vulnerability gate are green (AC-F1-4; NFR-9).
- Invariant reconciliation: the exit-literal invariant learns the MCP transport lifecycle vocabulary without granting the MCP surface the CLI projection role; boundary fixtures and mutation tests stay green (AC-F1-1, AC-F5-3; NFR-3, NFR-6; DEC-6).
- CI wiring, inventory registration, and packaging posture: the Node smoke and parity suites run in the existing gate battery; `packages/mcp` remains `private: true` with no compiled binary, installer entry, or `.mcpb` artifact (AC-F1-3, AC-F1-4; NFR-4, NFR-9; DEC-2).
- Documentation posture: the new MCP feature spec page and the result-contract surface-mapping note describe the shipped contract; marker-scoped docs pass the distribution guard if changed (AC-F1-2, AC-F6-1; NFR-5).

### 1.2 Out of Scope & Known Gaps

- [OUT] Batch capability (NG-1, M3-S2). The tests assert batch is absent, not that it works.
- [OUT] Any mutating tool, write path, mutation-authorization surface, or confirmation flow (NG-2). The tests assert no write member exists on the MCP tool runtimes.
- [OUT] Daemon mode, control sockets, multi-session management, health/readiness probes, concurrency limits, and runbook formalization (NG-3; deferred in spec §7.3).
- [OUT] `CommandResult` envelope rendering, `--json` machine output, or the `{0,1,2}` exit projection on the MCP surface (NG-4). These remain CLI-only and are asserted absent.
- [OUT] OpenCode-native tools (NG-5), status digest evolution (NG-6), and any new engine, engine behavior change, or new adapter subpath (NG-8). Existing engine and CLI suites are the regression half.
- [OUT] Publication, `.mcpb` packaging, signing, checksums, release-train distribution, and installer registration of the MCP artifact (NG-7, DEC-2). Only negative posture is asserted.
- [OUT] MCP resources/prompts protocol surfaces, if a later story needs them (spec §7.3). This change ships tools only.
- [OUT] Live-network, credentialed, or provider-backed success in the Node smoke. The smoke is hermetic; provider-backed success shapes are covered by injected parity suites. This boundary is deliberate and stated in §4.6.
- [OUT] A formal latency or throughput SLO: the spec declares none for this change. The battery asserts determinism and bounded payload equality, not a performance threshold.
- [OUT] Cross-platform stdio behavior (Windows named pipes, macOS-specific path handling) and a Node version matrix. CI runs on Linux; the smoke records the Node version it used.
- [GAP-T1 — hermetic Node smoke] The real serve entry cannot be given injected provider transports without a test-only backdoor, so the smoke exercises local-only outcomes: a status digest with unavailable sections, a classified `lint.target.missing` failure for `verify-artifact`, and a classified `verify.gates.failed` failure for `gate-report` (the lifecycle gate is a definitive fail when the target is missing). All success shapes and all dominant failure identities are covered by the in-process parity suites with injected runtimes (§4.2, §4.6). No AC is left untested; the split is recorded so it is not mistaken for coverage.
- [GAP-T2 — concurrency policy is delivery-bound] OQ-2 leaves serialize-versus-concurrent to delivery planning. The battery asserts per-call payload identity and zero mutation under interleaved calls; it does not pin an interleaving order or a concurrency limit (§4.2, TC-MCP-008).
- [GAP-T3 — transport-fault trigger] The deterministic transport-fault fixture is a malformed JSON frame, which the spec classifies as a framing failure below the tool layer. OS-level broken-pipe faults are not simulated because they are platform-flaky; the lifecycle rule and the channel-separation assertions are the contract, not the specific fault mechanism (§4.4, TC-MCP-011).
- [GAP-T4 — delivery-bound names and wording] File paths, export names, the tool parameter name, the lifecycle module name, the diagnostics log wording, and MCP SDK protocol error codes are delivery-bound. The behaviors, identities, field sets, exit codes, and AC mapping in this plan are not. Where a test path needs a name, the plan names the seam by behavior and the delivery plan maps it (§4.1).
- [GAP-T5 — the feature spec page lands in phase 7] The new `doc/spec/features/feature-mcp-surface.md` is authored at system-spec update, not during delivery. TC-MCP-021 is the manual/content check for that phase.

## 2. References

- **Change specification**: [chg-GH-231-spec.md](./chg-GH-231-spec.md) — F-1..F-7, AC-F1-1..AC-F7-2 (13), DM-1..DM-4, NFR-1..NFR-11, DEC-1..DEC-7, RSK-1..RSK-7, OQ-1..OQ-2, §6 flows, §7 scope, §8 interfaces, Appendix A engine-to-tool mapping.
- **PM record**: [chg-GH-231-pm-notes.yaml](./chg-GH-231-pm-notes.yaml) — context only: the scaffold state, the M1 design baseline, and the binding ADR-0003 constraints (C-3, C-9, C-10, C-2, C-7). The spec is the source of truth.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test` under `tests/**/*.test.ts`, fixtures never named `*.test.ts`, permanent suites assert the current tree, goldens are regenerated only by an explicit command, `pnpm check` is the aggregate gate, and boundary rules require a failing fixture.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, the error contract, fake-based deterministic tests, no moving-base diff assertions, and no runtime API outside the allowed locations.
- **ADR-0003**: [ADR-0003-oss-monorepo-structure.md](../../../decisions/ADR-0003-oss-monorepo-structure.md) — UQ-7 mirror mandate, error-table-primary, C-3 naming firewall, C-9 runtime neutrality, C-10 untrusted surface, C-2 license registry, C-7 install registration.
- **TDR-0005**: [TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — delivery-result enum and CLI exit taxonomy.
- **Design baseline**: [mcp.md](../../../planning/oss-tooling/milestones/m1/commands/mcp.md) — the planned branding-derived `mcp serve` contract, the three tool names, the no-batch pin, and the lifecycle exit vocabulary.
- **Result contract current truth**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — the `CommandResult` envelope, the error table, the classification chain, the `{0,1,2}` projection, and the exit-literal invariant.
- **Status digest current truth**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — the `delivery.status.v1` digest, six sections in fixed order, the closed five-value state set, the state-derivation matrix, and the declared bounds.
- **Verify-change current truth**: [feature-verify-change-and-exit-taxonomy.md](../../../spec/features/feature-verify-change-and-exit-taxonomy.md) — the full/LITE phase ledger, the delivery-result vocabulary, and the verify-change failure identities.
- **Verify-gates current truth**: [feature-verify-gates.md](../../../spec/features/feature-verify-gates.md) — the five M0 merge gates in fixed order, the cited `pass`/`fail`/`unknown` verdicts, and the gate failure identities.
- **Branding current truth**: [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — the `mcpToolPrefix` derivation rule and the naming firewall.
- **Rename drill**: [doc/guides/rename-drill.md](../../../guides/rename-drill.md) — RD-8 requires an MCP tool-list snapshot; this plan owns the snapshot fixture and the two-brand assertion.
- **Existing mechanisms reused (never re-implemented)**:
  - `tests/fixtures/status/harness.ts` and `tests/fixtures/status/matrix/cases.ts` — `baseFacts`, `statusRuntime`, `runStatusCli`, `capSizedFacts`, and the observed/degraded/unavailable/not-delivered matrix cases.
  - `tests/behaviour/verify-support.ts`, `tests/fixtures/verify/classification/**`, and `tests/fixtures/verify/malformed/**` — `createVerifyHarness`, `materializeTarget`, `materializeAbsentTarget`, `guardStore`, `createVerifyState`, `ledgerRecords`, and the full/LITE/partial/malformed corpus.
  - `tests/fixtures/verify-gates/cases/{facts,harness}.ts` and `tests/fixtures/verify-gates/corpus/**` — `baseFacts`, `gatesRuntime`, `combinedRuntime`, `runVerify`, `withReadError`, and the gates corpus.
  - `tests/golden/helpers.ts` — `bufferSink`, `SYNTHETIC_BRAND`.
  - `packages/testkit/src/result-conformance.ts` — `assertEnvelopeContract`.
  - `scripts/checks/{exit-code-literals,forbidden-literals,ambient-globals,workspace-entrypoints,error-table-sync,license-audit,vulnerability-gate}.ts` and `tests/checks/*`.
  - `tests/boundaries/**` and `.dependency-cruiser.cjs` — package matrix, projection confinement, runtime-API confinement.
- **CI**: [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) — `ts-test`, `ts-boundaries`, `ts-invariants`, `ts-license-audit`, `ts-vuln`, `ts-forbidden-literals`, `ts-aggregate`.
- **Ticket**: GitHub issue `juliusz-cwiakalski/agentic-delivery-os#231` — M1-S7: Minimal MCP.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F2-1 | Shared status fixtures (observed, degraded, unavailable, not-delivered) produce a `status` payload byte-identical to the CLI machine-output `data`, with no envelope keys and no exit-code field; section failures remain digest data. | TC-MCP-003, TC-MCP-004, TC-MCP-008 | Covered |
| AC-F3-1 | Shared verify-change fixtures (finished, partial, missing target, malformed declaration, untrustworthy registry) produce success `data` or the identical stable code with the full field set. | TC-MCP-005, TC-MCP-006, TC-MCP-008 | Covered |
| AC-F4-1 | Shared verify-gates fixtures (all-pass, definitive fail, unavailable evidence, classified unknown) produce the `delivery.verify-gates.v1` report or the identical stable code with the full field set. | TC-MCP-007, TC-MCP-008 | Covered |
| AC-F5-1 | Every failure payload carries exactly the contracted error fields; the code is identical to the CLI's for the same failure; no field is missing, extra, or protocol-invented. | TC-MCP-002, TC-MCP-004, TC-MCP-006, TC-MCP-007 | Covered |
| AC-F5-2 | A missing or invalid change ref yields `input.value.rejected`; the server does not crash; the failure is not a transport fault. | TC-MCP-009 | Covered |
| AC-F5-3 | No payload carries an exit code or envelope-only key; zero exit-projection imports exist in the surface; a failed tool call is followed by continued serving. | TC-MCP-002, TC-MCP-010, TC-MCP-018 | Covered |
| AC-F1-1 | Clean stop exits `0`, unresolvable configuration exits `1`, transport fault exits `2`; the configuration diagnostic is diagnostics-channel only; no other exit value occurs. | TC-MCP-011, TC-MCP-018 | Covered |
| AC-F1-2 | Tool discovery advertises exactly three branding-prefixed tools; no batch, mutating, or additional tool exists anywhere in the surface. | TC-MCP-001, TC-MCP-012, TC-MCP-021 | Covered |
| AC-F1-3 | Under Node, the serve entry starts, handshakes, lists the three tools, and serves all three fixtures, with no runtime-specific import or ambient-global read. | TC-MCP-013, TC-MCP-019 | Covered |
| AC-F1-4 | Every external dependency introduced carries a same-change registry verdict; the fail-closed audit and vulnerability gate are green. | TC-MCP-014, TC-MCP-019 | Covered |
| AC-F6-1 | Every served name equals the branding prefix plus its canonical primitive ID; zero product or binary literals exist in the surface; the tool-list snapshot changes only with the branding change. | TC-MCP-001, TC-MCP-015, TC-MCP-021 | Covered |
| AC-F7-1 | Hostile content in tracker, CI, and ledger evidence appears only as inert payload data; the server takes no action, grants no authority, and the prompt-injection fixture passes. | TC-MCP-016 | Covered |
| AC-F7-2 | Any sequence of tool calls performs zero writes, fences, state mutations, or process spawns; the state store and all documents are byte-identical before and after. | TC-MCP-017 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 011, 012, 013, 014, 018, 019; F-2 → 003, 004; F-3 → 005, 006; F-4 → 007; F-5 → 002, 003, 004, 005, 006, 007, 008, 009, 010; F-6 → 001, 013, 015, 021; F-7 → 009, 016, 017.

**Decision coverage**: DEC-1 (Node-hosted stdio entry) → 011, 013; DEC-2 (no installer registration) → 019; DEC-3 (exactly three read-only tools) → 001, 012; DEC-4 (no envelope/exit across the boundary) → 002, 010; DEC-5 (branding prefix + primitive ID) → 001, 015; DEC-6 (lifecycle vocabulary reconciliation) → 011, 018; DEC-7 (`input.value.rejected` analogue) → 009.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint (API-#) and no event/message identifier (EVT-#). The protocol surface in spec §8.2 and the data-model elements DM-1..DM-4 are the interface.

| Element | TC ID(s) | Observable assertion |
|---------|----------|----------------------|
| Protocol surface: initialize, `tools/list`, `tools/call` over stdio | TC-MCP-012, TC-MCP-013 | Handshake completes; discovery returns exactly three tools; every call returns a JSON payload; the server stays alive after a classified failure |
| Tool `status` (no parameters) | TC-MCP-003, TC-MCP-004 | Success digest equals CLI `data`; only containment-class failures fail the tool |
| Tool `verify-artifact` (one change ref) | TC-MCP-005, TC-MCP-006, TC-MCP-009 | Success data equals CLI `verify change`; failure identities equal CLI; missing/invalid ref is `input.value.rejected` |
| Tool `gate-report` (one change ref) | TC-MCP-007, TC-MCP-009 | Success report equals CLI `verify gates`; failure identities equal CLI; bad ref is `input.value.rejected` |
| DM-1 status tool payload | TC-MCP-002, TC-MCP-003 | `delivery.status.v1` digest by reference; six sections; declared bounds intact |
| DM-2 verify-artifact payload | TC-MCP-002, TC-MCP-005, TC-MCP-006 | Verify-change success data / error identity set by reference; no new schema |
| DM-3 gate-report payload | TC-MCP-002, TC-MCP-007 | `delivery.verify-gates.v1` report by reference; five cited verdicts |
| DM-4 tool error payload | TC-MCP-002, TC-MCP-004, TC-MCP-006, TC-MCP-007, TC-MCP-009 | Exactly the contracted error fields; no exit-code field; no new rows or domain kinds |
| Branding projection of served names | TC-MCP-001, TC-MCP-015 | Name = `mcpToolPrefix` + canonical primitive ID; descriptions static and brand-free |
| Lifecycle exit vocabulary | TC-MCP-011, TC-MCP-018 | Exactly `0`/`1`/`2`, owned by the MCP lifecycle module, diagnostics off the transport channel |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Result parity: tool success payloads equal CLI machine `data` across the shared fixtures; 100%, 0 drift | TC-MCP-003, TC-MCP-005, TC-MCP-007, TC-MCP-008 | Covered |
| NFR-2 | Error parity: CLI-identical stable code and the full contracted field set; 100% of failure fixtures | TC-MCP-002, TC-MCP-004, TC-MCP-006, TC-MCP-007, TC-MCP-009 | Covered |
| NFR-3 | Zero exit-projection imports into MCP and zero exit-code or envelope-only fields in any payload | TC-MCP-002, TC-MCP-008, TC-MCP-010, TC-MCP-018 | Covered |
| NFR-4 | Node smoke passes every PR; no runtime-specific imports or ambient-global reads in the surface | TC-MCP-013, TC-MCP-019 | Covered |
| NFR-5 | Zero product/binary literals; served names derive from branding + primitive ID; rename snapshot reflects only the branding change | TC-MCP-001, TC-MCP-015, TC-MCP-021 | Covered |
| NFR-6 | Lifecycle exits exactly `0`/`1`/`2`, nothing else | TC-MCP-011, TC-MCP-018 | Covered |
| NFR-7 | Zero writes, fences, state mutations, or process spawns across every fixture and the smoke | TC-MCP-016, TC-MCP-017 | Covered |
| NFR-8 | Identical injected inputs and protocol exchanges yield byte-identical payloads on replay | TC-MCP-008, TC-MCP-013 | Covered |
| NFR-9 | Every added external dependency carries a same-change registry verdict; audit green; 0 high/critical vulnerability findings | TC-MCP-014, TC-MCP-019 | Covered |
| NFR-10 | No diagnostic or non-protocol byte on the transport channel; diagnostics only on the diagnostics channel | TC-MCP-011, TC-MCP-016 | Covered |
| NFR-11 | Tool payloads respect the engines' declared caps and never exceed the CLI machine data for the same inputs | TC-MCP-003, TC-MCP-005, TC-MCP-007, TC-MCP-008 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 13 ACs (AC-F1-1..AC-F7-2) appear in §3.1 with at least one TC.
- **Orphan TCs**: none. Each of the 21 TCs names at least one AC or NFR in §5.1 and §5.2.
- **Untestable ACs**: none. AC-F1-3's provider-backed success is split between the hermetic Node smoke (local-only outcomes) and injected parity suites (all success shapes); §4.6 and GAP-T1 record the split. AC-F1-1's transport fault uses a framing fault (GAP-T3). AC-F6-1's rename drill is a two-brand snapshot assertion plus the RD-8 document check.
- **Intentional duplicate coverage**: AC-F5-1 spans four TCs because the field set, the code identity, the status containment path, and the two ref-tool failure matrices fail independently. AC-F5-3 spans three because payload leakage, import leakage, and continued serving fail independently. AC-F1-3 spans two because the runtime smoke and the CI/inventory wiring fail independently.
- **Regression half**: the existing `status-*`, `verify-*`, `verify-gates-*`, `run-cli`, `envelope-*`, `error-classification`, `exit-projection`, `state-*`, `config-*`, and `tests/boundaries` suites run unchanged and prove this additive surface changed no engine or CLI behavior.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and catalog | `bun test tests/structure/mcp-contract.test.ts` | `tests/structure/mcp-contract.test.ts`; the MCP catalog module | TC-MCP-001, TC-MCP-002, TC-MCP-015 |
| Import, purity, boundary | `bun test tests/structure/mcp-imports.test.ts tests/boundaries`; `pnpm check:boundaries` (dependency-cruiser `runtime-apis-confinement` with the exact-path serve allowance, workspace-entrypoints, secret-read boundary); `bun run scripts/checks/ambient-globals.ts` (core regression only — its scan scope is `packages/core`) | `tests/structure/mcp-imports.test.ts`, `.dependency-cruiser.cjs`, `scripts/checks/secret-read-boundary.ts`, `tests/boundaries/**` | TC-MCP-010, TC-MCP-013, TC-MCP-017, TC-MCP-018 |
| Type contract | `pnpm typecheck` | `tests/types/mcp-payload.type-test.ts` | TC-MCP-002, TC-MCP-010, TC-MCP-011 |
| Status parity | `bun test tests/behaviour/mcp-status-parity.test.ts` | `tests/fixtures/mcp/parity/**` over `tests/fixtures/status/harness.ts` | TC-MCP-003, TC-MCP-004 |
| Verify-artifact parity | `bun test tests/behaviour/mcp-verify-artifact-parity.test.ts` | over `tests/behaviour/verify-support.ts` | TC-MCP-005, TC-MCP-006 |
| Gate-report parity | `bun test tests/behaviour/mcp-gate-report-parity.test.ts` | over `tests/fixtures/verify-gates/cases/**` | TC-MCP-007 |
| Read parity and determinism | `bun test tests/behaviour/mcp-read-parity.test.ts` | shared parity harness | TC-MCP-008 |
| Error payload | `bun test tests/behaviour/mcp-error-payload.test.ts` | shared parity cases | TC-MCP-002, TC-MCP-004, TC-MCP-006, TC-MCP-007 |
| Boundary input validation | `bun test tests/behaviour/mcp-input-validation.test.ts` | shared parity harness | TC-MCP-009 |
| Injection | `bun test tests/behaviour/mcp-injection.test.ts` | `tests/fixtures/mcp/injection/**` | TC-MCP-016 |
| Read-only | `bun test tests/behaviour/mcp-readonly.test.ts` | `guardStore`, temp tree snapshots | TC-MCP-017 |
| Lifecycle | `bun test tests/behaviour/mcp-lifecycle.test.ts` | spawned serve entry, hermetic workspace | TC-MCP-011 |
| Protocol and Node smoke | `bun test tests/behaviour/mcp-node-smoke.test.ts` | spawned Node/Bun entry, JSON-RPC client | TC-MCP-012, TC-MCP-013 |
| License and supply chain | `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts`; `bun test tests/checks/license-audit.test.ts` | `doc/legal/dependency-licenses.yaml` | TC-MCP-014 |
| Invariant reconciliation | `bun test tests/checks/exit-code-literals.test.ts`; `bun run scripts/checks/exit-code-literals.ts` | `scripts/checks/exit-code-literals.ts` | TC-MCP-018 |
| CI wiring and posture | `bun test tests/checks/mcp-ci-parity.test.ts`; `bun run scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain}.ts`; `bun run scripts/checks/{manifest-privacy,publish-guard}.ts` | `.github/workflows/ci.yml`, package manifests, `scripts/install.sh` | TC-MCP-019 |
| Non-vacuity | `bun test tests/checks/mcp-mutants.test.ts` | `tests/fixtures/mcp/mutants/**` | TC-MCP-020 |
| Documentation posture | content/manual review; `bash scripts/.tests/test-doc-distribution.sh` if marker-scoped docs change | `doc/spec/features/feature-mcp-surface.md`, `doc/spec/features/feature-result-contract.md` | TC-MCP-021 |
| Aggregate | `pnpm check` | repo root; unchanged gates | all TCs (regression half) |

### 4.1 Test Harness Contract (binding for every TC)

1. **Hermetic.** Every suite imports production modules and injects fakes. No suite resolves a provider host, opens a socket, reads a real credential, reads the real `$HOME`, or writes the live worktree. The Node smoke runs in a `mkdtemp` workspace with its own `HOME`, `XDG_CONFIG_HOME`, config path, and working name.
2. **One fact bundle, two surfaces.** A parity case builds one fact bundle and hands it to both the CLI runtime and the MCP tool runtime. The CLI side runs in process through the existing `runCli` composition (`runStatusCli`, `runVerify`, or the shared `runCli` with the command definition); the MCP side calls the pure toolset seam. No test spawns the CLI to obtain the parity oracle.
3. **Pure toolset seam.** The delivery exposes a callable toolset with `listTools()` and `callTool(name, args)` returning a discriminated result: success carries `data`, failure carries `error` with the contracted fields. The stdio server adapts that result to the MCP protocol. Tests assert the toolset result and, for the wire, the serialized JSON content. Export names and the parameter name are delivery-bound; the seam and the payload contract are not.
4. **Fixed facts.** Time, run id, brand, and request ids are injected and constant per case. No wall clock, `Math.random`, real network, `$HOME`, or order-dependent assertion is used for correctness.
5. **Temp roots only.** Any test needing a real filesystem uses `mkdtemp` under the system temp directory or a committed read-only fixture. Cleanup runs in `afterEach`, including child-process kill and temp-tree removal.
6. **Goldens are read-only.** Golden files are opened read-only, compared after canonicalization, and their `mtimeMs` is asserted unchanged after the suite runs. Regeneration is the explicit `bun run tests/fixtures/mcp/regenerate.ts --write` command, never a test side effect.
7. **No moving-base diff.** Every assertion reads the current tree, a committed fixture, a temp copy, or a spawned process's output. No suite asserts `origin/main-tools...HEAD`.
8. **Delivery-bound names.** The plan names behaviors and seams, not export identifiers. The delivery plan maps each seam to the chosen module and export. A test that cannot resolve a seam fails with a message naming the missing contract, not a silent skip.

### 4.2 Parity Oracle (binding for AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, NFR-1, NFR-2, NFR-8, NFR-11)

**Canonicalization.** Parity is asserted on canonical JSON: object keys sorted recursively, array order preserved, no indentation, `JSON.stringify` over the result. This makes "byte-for-byte" testable without depending on object insertion order.

**Success rule.** For every success case:

1. Run the CLI in process with the case's runtime and `--json`; parse the envelope; take `data`.
2. Run the MCP tool with the same runtime; take `data` from the toolset result.
3. Assert canonical JSON equality between the two, and equality with the committed per-case golden under `tests/fixtures/mcp/golden/`.
4. Assert the payload's top-level key set equals the CLI `data` key set. No extra key, no missing key.
5. Assert the payload's canonical byte length equals the CLI `data` canonical byte length (NFR-11: never exceeds; equality is the contract for the same inputs).
6. Assert the payload contains no `exitCode`, `runId`, or `timing` key at any depth. A `schemaVersion` key is allowed only when the engine data declares it (`delivery.status.v1`, `delivery.verify-gates.v1`) and must never equal `RESULT_SCHEMA_VERSION` (`delivery.result.v1`).

**Failure rule.** For every failure case:

1. Run the CLI in process; take the envelope `error` object.
2. Run the MCP tool; take the toolset result's `error` object.
3. Assert deep equality of the entire object, not just `code`.
4. Assert the key set is exactly `{code, category, retryable, consequence, remediationHint}` plus `summary` if and only if the CLI `error` carries `summary`. No `message`, no `details`, no `exitCode`, no `runId`, no `timing`.
5. Assert the `code` equals the case's declared expected code (where the spec names one) and the CLI's code. The declared expected code catches both surfaces drifting together; the CLI comparison catches MCP-only drift.
6. Assert the failure is a tool outcome, not a transport outcome: the toolset returned a value; the server did not exit.

**Read rule.** For every case, pass one recorder to the CLI runtime and one to the MCP runtime, then assert the ordered read-member sequence is identical. An MCP-only read is a parity failure. Reset recorders between cases.

**Replay rule.** Run the same case twice with fresh runtimes and assert canonical JSON equality across the two MCP runs and across the two CLI runs. Run two independent cases concurrently with `Promise.all` and assert each payload equals its sequential baseline; do not assert an interleaving order (GAP-T2).

**Fixture rule.** A case declares inputs, the runtime factory, the expected kind (`success` or `failure`), and the expected code where the spec names one. It never declares a hand-written expected `data` object; the CLI is the oracle. The committed golden is generated from the CLI and reviewed.

**Case floor (non-vacuity).** The parity suite asserts a minimum case count per tool before iterating: `status` at least 5 (observed, degraded, unavailable, not-delivered, cap-sized), `verify-artifact` at least 8 (finished full, LITE, partial, missing target, malformed declaration, unknown variant, incomplete phases, untrustworthy registry), and `gate-report` at least 4 (all-pass, definitive fail, unavailable evidence, classified unknown). A suite that finds fewer cases fails.

### 4.3 Payload Leakage Oracle (binding for AC-F5-1, AC-F5-3, NFR-3, DM-4)

| Check | Rule |
|-------|------|
| Envelope wrapper | The payload is never the `CommandResult` envelope. No top-level `data` or `error` wrapper key; no top-level `schemaVersion` equal to `delivery.result.v1`; no `runId`, `exitCode`, or `timing`. |
| Engine schema version | A `schemaVersion` key is permitted only where the engine's own data type declares it. For status it must be `delivery.status.v1`; for gate-report it must be `delivery.verify-gates.v1`; verify-artifact success data has no engine `schemaVersion` and must not acquire one. |
| Exit code | No key named `exitCode` at any depth. No numeric field whose value is a process exit projection. |
| Envelope timing | No key named `timing` at any depth. Engine evidence timestamps are allowed because they are data, not envelope timing. |
| Error fields | A failure payload has exactly the CLI `error` key set. `category`, `retryable`, `consequence`, and `remediationHint` are always present; `summary` is present if and only if the CLI carries one. |
| Protocol metadata | The MCP adapter may mark a failed call at the protocol level (`isError: true` under the MCP tool-result contract). That flag lives outside the JSON payload and is not an exit code. The JSON content carries only the error field set. |
| Static scan | `packages/mcp/src/**` contains no `exitCode`, `runId`, or `timing` object literal and no import of the CLI projection. A seeded control in a temp copy must fail the scan by name. |

### 4.4 Lifecycle Exit Oracle (binding for AC-F1-1, NFR-6, NFR-10, DEC-6)

| Scenario | Fixture | Expected exit | Transport channel (stdout) | Diagnostics channel (stderr) |
|----------|---------|---------------|----------------------------|------------------------------|
| Clean stop | Valid hermetic config; initialize; `tools/list`; close stdin | `0` | JSON-RPC frames only | Lifecycle lines allowed; no payload content |
| Configuration error | The branding-derived config selector points to malformed or unresolvable configuration | `1` | Empty; no JSON-RPC frame and no diagnostic text | Non-empty diagnostic naming the configuration failure |
| Transport/framing fault | Valid config; initialize; write a malformed JSON frame | `2` | Frames before the fault only; every line parses as JSON-RPC | Non-empty diagnostic naming the transport fault |
| Classified tool failure | Valid config; call `verify-artifact` with a missing target; then call `status`; close | `0` | JSON-RPC frames only; failure payload inside the tool result | Lifecycle lines allowed; the tool code (`lint.target.missing`) must not appear |
| Recoverable protocol error | Unknown method or unknown tool name; then `tools/list`; close | `0` | Protocol-level error response, then a normal result | Lifecycle lines allowed |
| No other value | Every row above plus a repeated clean stop | Codes are a subset of `{0,1,2}`; no signal termination | Per row | Per row |

Additional rules:

- The server is one local process; no health, readiness, or daemon endpoint is tested.
- The lifecycle module owns every exit site. Every numeric literal used in an exit call or an `exitCode` assignment in that module is `0`, `1`, or `2`; no other `packages/mcp/src/**` file calls `process.exit` or assigns a numeric `exitCode` (TC-MCP-018).
- Exact log wording is delivery-bound. The assertions are channel separation, non-empty diagnostics on the diagnostic path, empty stdout on a pre-handshake configuration error, and the absence of tool payload content on stderr.

### 4.5 Protocol Exchange and Discovery Oracle (binding for AC-F1-2, AC-F5-3)

1. Speak newline-delimited JSON-RPC 2.0 over stdin/stdout. Every request has a deterministic id; the client matches responses by id and fails on timeout with the unanswered method named.
2. `initialize` carries a pinned protocol version and an empty capabilities object. `tools/list` is sent only after the initialize result and the initialized notification.
3. `tools/list` returns exactly three descriptors. Each name equals `BrandIdentity.mcpToolPrefix` plus the canonical primitive ID. Descriptions are non-empty and static. The `status` input schema declares no required parameter; the two ref tools declare exactly one required string parameter and `additionalProperties: false`.
4. `tools/call` for each tool returns a JSON payload. The client parses the JSON content and applies the §4.3 leakage oracle.
5. After a classified failure, a subsequent call to another tool succeeds. After an unknown method or unknown tool, a subsequent `tools/list` succeeds. The server is still running until the host closes the channel.
6. No batch, mutating, or additional tool is listed. No `batch` capability is advertised. The test asserts the list is stable across repeated `tools/list` calls.

### 4.6 Node Portability Smoke Oracle (binding for AC-F1-3, NFR-4, NFR-8)

- **Node is mandatory.** The test resolves `node` from `PATH`, asserts a major version supported by the chosen protocol implementation and no older than the delivery's declared floor (the current CI runner provides 20 or newer), records the version in the test output, and fails with a clear message if Node is absent or too old. The CI `ts-test` job must provide Node (preinstalled runner Node plus an explicit `node --version` step, or a pinned `actions/setup-node` step).
- **Bun is the secondary host.** When the built entry is executable under Bun, run the same protocol script and compare the canonical JSON of the three payloads with the Node run. This is a cross-runtime determinism check, not a substitute for the Node requirement: if the entry cannot execute under Bun, record the reason and rely on the in-process Bun suites plus the Node smoke. The in-process suites already run under Bun; the Node smoke proves the built entry under the required host.
- **Built entry only.** The smoke runs after `pnpm build` (the `pretest` lifecycle already builds). The test resolves the declared serve entry from `packages/mcp/package.json` exports (or the declared `bin`), never a deep `/src/` or guessed `/dist/` path.
- **Hermetic workspace.** The smoke creates a temp repository with a minimal config file, a temp `HOME`/`XDG_CONFIG_HOME`, a pre-initialized read-only state root, no remote, and no credentials. The working name is synthetic. The state root is prepared with the existing state harness before the server starts, with an empty verified registry, so the gate-report lifecycle gate is a definitive fail rather than a `state.*` unknown. Fixture setup may write before the spawn; the read-only assertions cover the tool-call window. The expected outcomes are pinned: `status` succeeds with a digest whose unavailable sections are truthful data; `verify-artifact` returns the classified `lint.target.missing` failure for a missing target; `gate-report` returns the classified `verify.gates.failed` failure because the lifecycle gate is a definitive fail. Provider-backed success is covered by the injected parity suites (GAP-T1).
- **Network guard.** The Node run installs a test-only preload that throws on `fetch` and on `node:http`/`node:https`/`node:net` connection attempts. Use the preload mechanism available in the installed Node major (for example `--import` on Node 20.6+ or `--require` on earlier Node 20); the test fails closed if the guard cannot be installed. The smoke must pass with the guard installed. The guard is a test fixture, not shipped code.
- **No runtime-specific imports (mcp-scoped enforcement).** The assertion is enforced by the boundary checks, not by the smoke: the dependency-cruiser `runtime-apis-confinement` rule with its reason-bearing exact-path allowance for the serve entry (the only mcp path that may use `node:` builtins for stdio and the single startup configuration-environment read), the `tests/structure/mcp-imports.test.ts` AST floors over `packages/mcp/src/**` (zero `bun:` specifiers, zero `Bun.*` calls, zero `node:*` imports and `process` reads outside `serve.ts`, non-zero file count), and the `scripts/checks/secret-read-boundary.ts` allowlist entry `configuration-environment-source` scoped to the serve root. The serve edge is the composition root; NFR-4's ambient-global prohibition applies to the neutral tool modules, not to those two documented serve-root allowances. `scripts/checks/ambient-globals.ts` scans `packages/core` only and is a core regression check, not mcp-surface coverage.

### 4.7 Injection and Read-Only Oracle (binding for AC-F7-1, AC-F7-2, NFR-7, NFR-10)

**Injection fixtures.** Plant a unique canary token and hostile instruction text in fields the engines actually render within their declared bounds: a tracker work-item title (status), a CI trace evidence or job-name string (status and gate-report), a hostile change-ref string that the verify and gates engines echo (verify-artifact and gate-report), and a hostile workflow/job name in gate evidence (gate-report). Do not choose a field the engine bounds out or never renders: if the positive control fails, move the fixture to a rendered field rather than asserting inertness on content that never reached the payload. Call each tool with the fixture. Assert:

1. The canary appears in the payload as a string value (positive control that the content actually reached the payload).
2. The canary appears nowhere in `tools/list`, tool descriptions, or schemas before or after the call.
3. The canary appears nowhere on stderr.
4. The read recorder log equals the clean-case baseline; the hostile content triggers no additional read.
5. No write, fence, mutation, or spawn occurs; the read-only oracle below is applied.
6. A subsequent normal call to another tool returns its normal payload. The hostile content did not change tool behavior.
7. The MCP handler contains no tool-call recursion: the only `callTool` site is the dispatcher; handlers call engine functions, not other tools.

**Read-only oracle.** Wrap every state store in `guardStore` with `throwOnMutation: true`. Snapshot the temp workspace tree (relative paths, file content hashes, and mtimes) before and after the full call sequence. Assert:

1. `guardStore` recorded no `append`, `replaceDocument`, `acquireFence`, `releaseFence`, `recoverFence`, `repairTornTail`, or `salvage`; the wrapper did not throw.
2. The tree snapshot is identical; no file was created, deleted, or modified.
3. No audit record or audit document exists after the calls; the MCP surface composes no audit writer.
4. An AST scan of `packages/mcp/src/**` finds no `node:child_process` import and no `Bun.spawn`, `spawn(`, `exec(`, `execFile(`, or `fork(` call expression. A seeded control in a temp copy fails the scan by name.
5. The MCP composition root imports no spawn-capable adapter seam (`@delivery-os/adapters/git`) and calls none of `createGitBranchSeam`, `createGitCommitSeam`, `createWatchdogGitSeam`, or `createCommitlintProbe`. A seeded call in a temp copy fails by name.
6. The MCP tool runtime types expose no write, fence, commit, apply, merge, or delete member. The type test asserts this exhaustively.

### 4.8 Branding Projection and Snapshot Oracle (binding for AC-F6-1, NFR-5, DEC-5)

1. Given a `BrandIdentity`, `listTools()` names are exactly `mcpToolPrefix + "status"`, `mcpToolPrefix + "verify-artifact"`, and `mcpToolPrefix + "gate-report"`.
2. Descriptions and input schemas are byte-identical across two synthetic brands; only the names change, and only in the prefix. No description interpolates `productName`, `binaryName`, or any other brand value.
3. `tests/fixtures/mcp/tool-list.snapshot.json` is the canonical JSON of the tool list under `SYNTHETIC_BRAND`. It is committed, read-only in tests, and regenerated only by the explicit command.
4. A mutation control changes one primitive ID in a temp copy; the snapshot comparison fails naming the tool. A second control changes the brand prefix; the snapshot differs only in the prefix and descriptions are unchanged.
5. The full-scope forbidden-literal scan reports zero violations in `packages/mcp/**`; a seeded `ados` literal in a temp copy fails by name. The scan's file count is asserted non-zero.
6. `doc/guides/rename-drill.md` RD-8 remains consistent with the committed snapshot; the manual check records that the snapshot is the frozen artifact the drill compares.

### 4.9 Non-Vacuity Contract (binding for every negative, absence, and parity scenario)

1. **Plant the positive before asserting the absence.** A success payload is asserted before the failure payload; a canary is asserted present before the injection test asserts it grants no authority; a real tool is listed before the test asserts no fourth tool exists.
2. **Pair every negative with a live control in the same test or file.** A missing ref sits beside a valid ref; a malformed frame sits beside a valid handshake; a mutated payload sits beside the real payload.
3. **A deliberately broken guard must fail the suite, naming the case.** `tests/checks/mcp-mutants.test.ts` imports temp copies of the catalog, payload adapter, lifecycle module, and a tool handler through file URLs with one named guard disabled, and asserts the mutant produces the prohibited observable with a message naming the case. If the real module also produced nothing, the meta-check fails.
4. **Case and scan floors.** Every parity suite asserts its case count floor (§4.2). Every static scan asserts a positive file count before asserting zero violations.
5. **No golden is self-fulfilling.** Each golden comparison is paired with a mutation control that changes one field and asserts inequality, then restores and asserts equality.
6. **Scan scope is the delivered tree, not a hand-picked allowlist.** The MCP literal/exit/spawn scans walk every `.ts` file under `packages/mcp/src/**` and assert the walked count is greater than zero.

## 5. Test Scenarios

### 5.1 Scenario Index

`TC-MCP-*` is a new prefix with no prior use in the repository; no existing TC identifier is reused for a different scenario.

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-MCP-001 | Tool catalog: exactly three branding-projected read-only tools; no batch or mutation | Regression | Critical | High | AC-F1-2, AC-F6-1; F-1..F-4, F-6; DM-1..DM-4 |
| TC-MCP-002 | Payload and error contract: CLI data shapes, contracted error fields, no envelope leakage, no new rows/kinds | Regression | Critical | High | AC-F5-1, AC-F5-3; F-5; NFR-2, NFR-3 |
| TC-MCP-003 | `status` success parity across observed, degraded, unavailable, not-delivered, and cap-sized facts | Happy Path | Critical | High | AC-F2-1; F-2, F-5; NFR-1, NFR-11 |
| TC-MCP-004 | `status` containment failure parity; section failures remain digest data | Negative | Critical | High | AC-F2-1, AC-F5-1; F-2, F-5; NFR-2 |
| TC-MCP-005 | `verify-artifact` success parity across full, LITE, and partial ledgers | Happy Path | Critical | High | AC-F3-1; F-3, F-5; NFR-1 |
| TC-MCP-006 | `verify-artifact` failure parity matrix across all dominant identities | Negative | Critical | High | AC-F3-1, AC-F5-1; F-3, F-5; NFR-2 |
| TC-MCP-007 | `gate-report` success and failure parity across all-pass, fail, unavailable, and unknown | Happy Path | Critical | High | AC-F4-1, AC-F5-1; F-4, F-5; NFR-1, NFR-2 |
| TC-MCP-008 | Read parity, replay determinism, and interleaved-call identity; zero MCP-only reads | Regression | Critical | High | AC-F2-1, AC-F3-1, AC-F4-1; F-5; NFR-1, NFR-3, NFR-8, NFR-11 |
| TC-MCP-009 | Boundary input validation: missing/empty/non-string ref yields `input.value.rejected`; hostile refs follow CLI grammar | Negative | Critical | High | AC-F5-2; F-5, F-7; NFR-2 |
| TC-MCP-010 | Exit-code and envelope isolation; zero projection imports; server survives a classified failure | Regression | Critical | High | AC-F5-3; F-5; NFR-3 |
| TC-MCP-011 | Serve lifecycle exits `{0,1,2}`; diagnostics channel separation; no other exit value | Regression | Critical | High | AC-F1-1; F-1; NFR-6, NFR-10 |
| TC-MCP-012 | Protocol discovery and continued serving: handshake, exactly three tools, call all, failure then success | Happy Path | Critical | High | AC-F1-2, AC-F5-3; F-1; DEC-3 |
| TC-MCP-013 | Node portability smoke and cross-runtime payload identity | Regression | Critical | High | AC-F1-3; F-1, F-6; NFR-4, NFR-8 |
| TC-MCP-014 | Dependency license-registry verdict and supply-chain gates | Regression | Critical | High | AC-F1-4; F-1; NFR-9 |
| TC-MCP-015 | Branding projection, naming firewall, and rename-drill snapshot | Regression | Critical | High | AC-F6-1; F-6; NFR-5 |
| TC-MCP-016 | Prompt-injection inertness: content grants no authority | Negative | Critical | High | AC-F7-1; F-7; NFR-10 |
| TC-MCP-017 | Read-only guarantee: zero writes, fences, mutations, or spawns | Regression | Critical | High | AC-F7-2; F-7; NFR-7 |
| TC-MCP-018 | Boundary matrix and exit-literal invariant reconciliation | Regression | Critical | High | AC-F1-1, AC-F5-3; F-1, F-5; NFR-3, NFR-6 |
| TC-MCP-019 | Inventory, CI wiring, and packaging posture | Regression | Important | Medium | AC-F1-3, AC-F1-4; NFR-4, NFR-9; DEC-2 |
| TC-MCP-020 | Non-vacuity meta-check: broken guards fail by name | Regression | Critical | High | All ACs; NFR-1..NFR-11 |
| TC-MCP-021 | Documentation posture and distribution marker | Manual | Important | Medium | AC-F1-2, AC-F6-1; NFR-5 |

### 5.2 Scenario Details

#### TC-MCP-001 - Tool catalog: exactly three branding-projected read-only tools; no batch or mutation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-3, F-4, F-6, AC-F1-2, AC-F6-1, DM-1, DM-2, DM-3, DM-4, DEC-3, DEC-5
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/mcp-contract.test.ts`; the MCP catalog module
**Tags**: @backend, @contract

**Preconditions**:

- The delivery exposes a closed canonical primitive-ID list and a `listTools()` toolset method.
- `SYNTHETIC_BRAND` and the branding resolver are available.
- `tests/fixtures/mcp/tool-list.snapshot.json` is committed read-only.

**Steps**:

1. Assert the canonical primitive-ID list is exactly `["status", "verify-artifact", "gate-report"]` in that order; assert it is a closed `as const` set with no fourth entry.
2. Call `listTools()` and assert exactly three descriptors. Assert each name equals `SYNTHETIC_BRAND.mcpToolPrefix + id`. Assert each description is a non-empty static string. Assert the `status` schema declares no required parameter; assert the two ref tools declare exactly one required string parameter and `additionalProperties: false`.
3. Assert no descriptor name contains `batch`, `write`, `apply`, `mutate`, `merge`, `delete`, or `commit`, and no input schema declares a write, apply, mutate, merge, delete, or commit parameter. Descriptions may describe read-only evidence in domain language; they must not claim a mutating capability.
4. Parse every `.ts` file under `packages/mcp/src/**` and locate the tool-registration site. Accept either one loop over the closed catalog or three literal registrations; in both cases, assert the registered names are exactly the three canonical IDs and no other name is registered. A seeded fourth catalog entry or a second registration site in a temp copy must fail naming it (TC-MCP-020).
5. Assert the canonical JSON of `listTools()` equals `tests/fixtures/mcp/tool-list.snapshot.json`.
6. Assert the toolset runtime types expose only read members; the type test in `tests/types/mcp-payload.type-test.ts` fails to compile if a write, fence, commit, apply, merge, or delete member is added.

**Expected Outcome**:

- Exactly three read-only tools exist, under branding-projected names, with no batch, mutating, or additional capability anywhere in the surface; the snapshot pins the list.

**Postconditions**:

- The snapshot file is unchanged (mtime asserted).

**Notes / Clarifications**:

- The canonical primitive IDs are pinned by the spec; the served names are the projection.

#### TC-MCP-002 - Payload and error contract: CLI data shapes, contracted error fields, no envelope leakage, no new rows/kinds

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-3, DM-1, DM-2, DM-3, DM-4, NFR-2, NFR-3
**Test Type(s)**: Unit, Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/mcp-contract.test.ts`, `tests/types/mcp-payload.type-test.ts`, `tests/behaviour/mcp-error-payload.test.ts`
**Tags**: @backend, @contract

**Preconditions**:

- The MCP payload types are declared in the MCP package and reuse the core `contracts` vocabulary.
- `RESULT_SCHEMA_VERSION` and the error-table types are available from `@delivery-os/core/contracts`.

**Steps**:

1. Assert the success payload type is the engine data type by reference, not a locally re-declared shape: status to `StatusDigest`, verify-artifact to the verify-change success data, gate-report to `VerifyGatesReport`. Assert no local copy of the six status sections, the five gate ids, or the error-table rows.
2. Assert the failure payload type is exactly the CLI `CommandResultError` field set (`code`, `category`, `retryable`, `consequence`, `remediationHint`, optional `summary`). Assert no local field list and no protocol-invented field.
3. Assert `RESULT_SCHEMA_VERSION` never appears in a tool payload. Assert a `schemaVersion` key is permitted only as engine data and equals `delivery.status.v1` or `delivery.verify-gates.v1`; assert it never equals `delivery.result.v1`.
4. Deep-scan every success and failure payload for keys `exitCode`, `runId`, and `timing`; assert zero at any depth. Assert no top-level `data` or `error` wrapper key.
5. Run `bun run scripts/checks/error-table-sync.ts`, `bun test tests/structure/error-table.test.ts`, and `bun test tests/structure/delivery-result-contract.test.ts`; assert green and assert the error-table row count and domain-kind set are unchanged.
6. Run the existing configuration-contract and state-conformance suites; assert no new configuration key and no state-schema change.
7. Assert a seeded `exitCode: 2` in a copied payload adapter fails the leakage test by name (TC-MCP-020).

**Expected Outcome**:

- The payload contract is borrowed from the engines and the error table, with no envelope leakage and no new vocabulary.

#### TC-MCP-003 - `status` success parity across observed, degraded, unavailable, not-delivered, and cap-sized facts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1, NFR-1, NFR-11, DM-1
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-status-parity.test.ts`; `tests/fixtures/mcp/parity/cases.ts` over `tests/fixtures/status/harness.ts`
**Tags**: @backend, @parity

**Preconditions**:

- The shared status fixtures include observed, degraded, unavailable, not-delivered, and cap-sized cases.
- `runStatusCli` runs the CLI in process with fixed clock, run id, brand, and buffer streams.
- The MCP status tool accepts the same injected status runtime shape.

**Steps**:

1. For each case, build the fact bundle once and create a fresh CLI runtime and a fresh MCP runtime from it.
2. Run `status --json` through `runStatusCli`; parse the envelope; take `data`.
3. Call the MCP `status` tool with no arguments and the same runtime; take `data`.
4. Assert canonical JSON equality between the two and equality with the committed per-case golden under `tests/fixtures/mcp/golden/status/`.
5. Assert the digest carries `schemaVersion === "delivery.status.v1"`, six sections in the fixed order, the closed five-value section states, and the declared bounds for the case.
6. Assert the payload contains no `exitCode`, `runId`, `timing`, or envelope wrapper, and its canonical byte length equals the CLI `data` length.
7. Assert the degraded, unavailable, and not-delivered cases are `ok: true` with the truthful digest state; assert no case in this set produces a tool failure.

**Expected Outcome**:

- Every status success payload is the CLI `data` shape exactly, with section failures preserved as digest data and zero envelope leakage.

#### TC-MCP-004 - `status` containment failure parity; section failures remain digest data

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1, AC-F5-1, NFR-2
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-status-parity.test.ts`, `tests/behaviour/mcp-error-payload.test.ts`
**Tags**: @backend, @parity, @negative

**Preconditions**:

- A status runtime whose `readRepository` or another required collector throws.
- The CLI `status --json` on the same runtime yields the containment envelope error.

**Steps**:

1. Build a throwing status runtime and run `status --json` through `runStatusCli`; take `envelope.error`.
2. Call the MCP `status` tool with the same throwing runtime; assert the toolset result is a failure and take `error`.
3. Assert deep equality of the entire error object; assert the key set is exactly the CLI key set including `summary` if and only if the CLI carries it; assert `code` is the CLI containment identity (`fallback.internal` analogue) and not `input.value.rejected`.
4. Assert no `exitCode`, `runId`, or `timing` key is present.
5. Re-assert the TC-MCP-003 degraded/unavailable cases are `ok: true`, proving section-level failures are not promoted to tool errors.
6. Assert a seeded change of the code in a copied tool fails the parity assertion by name (TC-MCP-020).

**Expected Outcome**:

- Only a containment-class failure fails the `status` tool, with the CLI-identical error identity and fields; section failures stay in the digest.

#### TC-MCP-005 - `verify-artifact` success parity across full, LITE, and partial ledgers

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, AC-F3-1, NFR-1, DM-2
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-verify-artifact-parity.test.ts`; `tests/behaviour/verify-support.ts` and `tests/fixtures/verify/classification/**`
**Tags**: @backend, @parity

**Preconditions**:

- `createVerifyHarness` materializes a full and a LITE target with a verified registry; `materializeTarget` and `createVerifyState` are available.
- The MCP verify-artifact tool accepts the same injected verify runtime shape.

**Steps**:

1. For each success case (full finished, LITE complete with absent and null completion, partial with a registry overlay that completes the ledger), run `verify change` with the case ref and `--json` in process through `runVerify`; take `data`.
2. Call the MCP `verify-artifact` tool with the same runtime and ref; take `data`.
3. Assert canonical JSON equality and equality with the committed golden.
4. Assert the data carries `target === "change"`, `result === "finished"`, the same `variant`, `requiredPhases`, `completedPhases`, `missingPhases`, and `evidence.declaration`/`evidence.registry` values as the CLI.
5. Assert the payload has no `schemaVersion` unless the CLI data carries one; assert the exact top-level key set equals the CLI's.
6. Assert no envelope leakage and equal canonical byte length.

**Expected Outcome**:

- Every verify-artifact success payload equals the CLI `verify change` data shape.

#### TC-MCP-006 - `verify-artifact` failure parity matrix across all dominant identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, AC-F3-1, AC-F5-1, NFR-2, DM-2, DM-4
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-verify-artifact-parity.test.ts`, `tests/behaviour/mcp-error-payload.test.ts`
**Tags**: @backend, @parity, @negative

**Preconditions**:

- Fixtures exist for every dominant identity: missing target (`materializeAbsentTarget`), malformed declaration (`tests/fixtures/verify/malformed/**`), unknown variant, incomplete phases (`withOpenPhase`), ledger incomplete (`verify.ledger.incomplete`), and untrustworthy registry (`state.*`).
- The CLI `verify change` on each fixture is the oracle.

**Steps**:

1. For each case, run the CLI in process and take `envelope.error`.
2. Call the MCP tool with the same runtime and ref; assert a failure result and take `error`.
3. Assert deep equality of the entire error object, including `summary` presence and value.
4. Assert the `code` equals the case's declared expected code and the CLI's code. Assert the expected code families are represented: `lint.target.missing`, `lint.notes.malformed`, `lint.variant.unknown`, `lint.phases.incomplete`, `verify.ledger.incomplete`, and at least one `state.*` identity.
5. Assert each case has the full contracted field set; assert no `message`, `details`, `exitCode`, `runId`, or `timing` key.
6. Assert the cases are distinct: a suite that maps two different fixtures to the same code fails, unless the CLI itself does.
7. Assert a seeded field removal in a copied error payload fails by name (TC-MCP-020).

**Expected Outcome**:

- Every verify-artifact failure carries the CLI-identical stable code and the full contracted field set, with no missing or extra field.

#### TC-MCP-007 - `gate-report` success and failure parity across all-pass, fail, unavailable, and unknown

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, AC-F5-1, NFR-1, NFR-2, DM-3
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-gate-report-parity.test.ts`; `tests/fixtures/verify-gates/cases/**`
**Tags**: @backend, @parity

**Preconditions**:

- `gatesRuntime`/`combinedRuntime` provide all-pass, definitive fail, unavailable evidence, and classified unknown cases.
- The CLI `verify gates` with the case ref and `--json` is the oracle.

**Steps**:

1. For each case, run the CLI in process and take either `data` (all-pass) or `envelope.error` (failure).
2. Call the MCP `gate-report` tool with the same runtime and ref; take `data` or `error`.
3. For the all-pass case, assert canonical JSON equality: `schemaVersion === "delivery.verify-gates.v1"`, `changeRef`, `target === "gates"`, `overall === "pass"`, `summary`, and all five gate verdicts in fixed order with cited evidence.
4. For the failure cases, assert deep equality of the entire error object and the CLI-identical code: `verify.gates.failed`, `verify.gates.unavailable`, or the first unknown gate's classified identity. Assert `summary` presence and value.
5. Assert no fabricated `pass` verdict appears in a failure payload; assert the five gate identities are not re-declared locally.
6. Assert no envelope leakage and equal canonical byte length for the success case.

**Expected Outcome**:

- Every gate-report payload is the `delivery.verify-gates.v1` report or the CLI-identical classified failure, with all five cited verdicts on success.

#### TC-MCP-008 - Read parity, replay determinism, and interleaved-call identity; zero MCP-only reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F2-1, AC-F3-1, AC-F4-1, NFR-1, NFR-3, NFR-8, NFR-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-read-parity.test.ts`
**Tags**: @backend, @parity, @determinism

**Preconditions**:

- The parity harness records reader-member calls for both surfaces.
- Each case can be run repeatedly with fresh runtimes.

**Steps**:

1. For every parity case, run the CLI with a fresh recorder and the MCP tool with a fresh recorder; assert the ordered read-member sequences are identical. Assert the MCP log contains no member absent from the CLI log.
2. Run the MCP tool twice with fresh runtimes and the same inputs; assert canonical JSON equality. Run the CLI twice; assert canonical JSON equality. Assert the committed golden equals both.
3. Run two independent cases concurrently with `Promise.all`; assert each payload equals its sequential baseline; assert the read-only oracle still holds. Do not assert an interleaving order or a serialization policy (GAP-T2).
4. Assert the canonical byte length of each MCP payload equals the CLI `data` length; assert it never exceeds it.
5. Assert a seeded MCP-only read (an extra recorder call in a temp copy) fails by name (TC-MCP-020).

**Expected Outcome**:

- The MCP surface reads exactly what the CLI reads, replays byte-identically, and stays within the CLI payload bound.

#### TC-MCP-009 - Boundary input validation: missing/empty/non-string ref yields `input.value.rejected`; hostile refs follow CLI grammar

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-2, NFR-2, DEC-7
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-input-validation.test.ts`
**Tags**: @backend, @negative, @security

**Preconditions**:

- The toolset seam accepts an unknown `args` value and validates it once at the boundary.
- The CLI grammar for `verify change`/`verify gates` is the oracle: present, string, non-empty.

**Steps**:

1. Call `verify-artifact` with `{}`, `{ ref: "" }`, `{ ref: 42 }`, `{ ref: null }`, `{ ref: [] }`, and `{ ref: {} }`; assert each result is a failure with `input.value.rejected` and the full contracted field set; assert no throw and no transport fault.
2. Call `gate-report` with the same argument set; assert the same identity and field set.
3. Call `status` with an unexpected argument; assert it does not crash and the server can serve a subsequent valid call. Do not pin a stable code for this case because the spec does not (status has no ref analogue); record the observed identity in the execution log.
4. Assert a whitespace-only ref (`"   "`) is not rejected by the MCP surface: the CLI accepts it and resolves it to an engine failure; assert the MCP result equals the CLI result for the same ref. A stricter MCP-only regex is a parity failure.
5. Assert a path-shaped ref (`"../../etc/passwd"`) and a ref containing a newline and hostile text produce the same outcome as the CLI for the same ref; assert the read recorder shows no read outside the fixture change root and the ref is passed through as an opaque string.
6. Assert the server does not exit after any invalid input; a valid call after each invalid call succeeds.
7. Assert a seeded change from `input.value.rejected` to a protocol-only code fails by name (TC-MCP-020).

**Expected Outcome**:

- Missing, empty, and non-string refs produce `input.value.rejected`; hostile refs follow the CLI grammar exactly; no crash and no transport fault.

#### TC-MCP-010 - Exit-code and envelope isolation; zero projection imports; server survives a classified failure

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-3, DEC-4
**Test Type(s)**: Unit, Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/mcp-contract.test.ts`, `tests/structure/mcp-imports.test.ts`, `tests/behaviour/mcp-error-payload.test.ts`, `tests/behaviour/mcp-node-smoke.test.ts`
**Tags**: @backend, @contract, @boundary

**Preconditions**:

- The CLI projection module is `packages/cli/src/projection.ts`; the dependency-cruiser rule `surface-projection-cli-only` is live.
- A failure case is available for each tool.

**Steps**:

1. For every success and failure payload in the parity set, deep-scan for `exitCode`, `runId`, and `timing` at any depth; assert zero.
2. Assert no payload is the `CommandResult` envelope: no `data`/`error` wrapper, no top-level `schemaVersion === "delivery.result.v1"`.
3. Parse every `.ts` file under `packages/mcp/src/**`; assert zero imports of `@delivery-os/cli`, any relative path into `packages/cli`, or the projection module. Assert zero `exitCode` object literals in tool and payload modules; the lifecycle module may assign `process.exitCode` only with `0`, `1`, or `2` and only there. A seeded projection import in a temp copy must fail the scan and the boundary rule by name.
4. Run `bun test tests/boundaries` and `pnpm check:boundaries`; assert the `matrix-mcp-importer` and `surface-projection-cli-only` fixtures pass and the live tree is clean.
5. Spawn the serve entry; call `verify-artifact` with a missing target; call `status`; close the channel; assert exit `0` and assert the failure payload carried no exit code. The failed call did not terminate the server.
6. Assert a seeded `exitCode` addition to a copied payload fails by name (TC-MCP-020).

**Expected Outcome**:

- The envelope and exit projection remain CLI-owned; no payload carries an exit code or envelope-only key; a failed tool call leaves the server running.

#### TC-MCP-011 - Serve lifecycle exits `{0,1,2}`; diagnostics channel separation; no other exit value

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-6, NFR-10, DEC-1, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-lifecycle.test.ts`
**Tags**: @backend, @lifecycle, @security

**Preconditions**:

- The declared serve entry is built by `pnpm build` and resolvable from `packages/mcp/package.json`.
- A hermetic temp workspace, config path, `HOME`, and working name are available.
- The test has a hard per-process timeout and kills the child in `finally`.

**Steps**:

1. **Clean stop**: start with valid configuration; initialize; `tools/list`; close stdin; assert exit `0`, `signal === null`, stdout contains only JSON-RPC frames, and stderr contains no tool payload content.
2. **Configuration error**: start with the branding-derived config selector pointing to a malformed or unresolvable configuration; assert exit `1`, stdout is empty (no JSON-RPC frame, no diagnostic text), stderr is non-empty and names the configuration failure.
3. **Transport/framing fault**: start with valid configuration; initialize; write a malformed JSON frame; assert exit `2`, every stdout line before the fault parses as JSON-RPC, and stderr is non-empty and names the transport fault.
4. **Classified tool failure**: start with valid configuration; call `verify-artifact` with a missing target; assert the failure payload; call `status`; close; assert exit `0` and assert stderr does not contain `lint.target.missing`.
5. **Recoverable protocol error**: send an unknown method, then `tools/list`, then a valid call, then close; assert exit `0`.
6. Repeat the clean-stop row and assert the collected exit codes are a subset of `{0,1,2}`; assert no signal termination and no timeout. Assert the lifecycle module is the only exit site; every numeric exit literal there is `0`, `1`, or `2` (also TC-MCP-018).
7. Assert the surface imports no telemetry, metrics, or trace module and emits no telemetry record; only lifecycle lines may appear on stderr, and no tool payload content may appear there. A seeded telemetry emission in a temp copy fails by name.
8. Assert a seeded `process.exit(3)` in a copied lifecycle module fails by name (TC-MCP-020).

**Expected Outcome**:

- The serve process exits only `0`, `1`, or `2`; diagnostics never touch the transport channel; tool outcomes never affect the process exit.

**Notes / Clarifications**:

- The transport fault is a framing fault by design (GAP-T3). OS-level broken-pipe faults are not simulated.

#### TC-MCP-012 - Protocol discovery and continued serving: handshake, exactly three tools, call all, failure then success

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F5-3, DEC-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-node-smoke.test.ts`; `tests/fixtures/mcp/protocol/client.ts`
**Tags**: @backend, @protocol

**Preconditions**:

- A newline-delimited JSON-RPC client with deterministic ids and per-request timeouts.
- A hermetic serve workspace with local-only expected outcomes.

**Steps**:

1. Spawn the serve entry; send `initialize`; assert a result with server info and capabilities; send the initialized notification.
2. Send `tools/list`; assert exactly three descriptors with branding-prefixed names. Assert no batch, mutating, or additional tool. Repeat `tools/list` and assert the list is stable.
3. Call `status`; assert the payload parses as JSON and passes the §4.3 leakage oracle.
4. Call `verify-artifact` with a missing target; assert the failure payload and the full error field set. Then call `status` again; assert success. The server kept serving.
5. Call `gate-report` with a missing target; assert the failure payload with the CLI-identical `verify.gates.failed` identity and the full error field set.
6. Send an unknown method and an unknown tool name; assert the server reports them as protocol-level or tool-level errors, not process exits; then send `tools/list`; assert success.
7. Close stdin; assert exit `0`.
8. Assert the server advertised no batch capability and no fourth tool.

**Expected Outcome**:

- The protocol exchange completes, exactly three tools are discoverable, all three are callable, and the server keeps serving after classified and protocol-level failures.

#### TC-MCP-013 - Node portability smoke and cross-runtime payload identity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-3, NFR-4, NFR-8, DEC-1
**Test Type(s)**: Integration, Contract, Smoke
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-node-smoke.test.ts`; `tests/fixtures/mcp/node/network-guard.mjs`; `tests/structure/mcp-imports.test.ts`; `.dependency-cruiser.cjs`; `scripts/checks/secret-read-boundary.ts`
**Tags**: @backend, @portability

**Preconditions**:

- `node` is on `PATH` with major version at least 20.
- `pnpm build` has produced the declared serve entry.
- The hermetic workspace and network guard are available.

**Steps**:

1. Record `node --version`; assert the major version is supported by the delivery's declared floor (the current CI runner provides 20 or newer); fail with a clear message otherwise.
2. Spawn the entry under Node with the test-only network-guard preload. Complete initialize, `tools/list`, and one call per tool. Assert the three payloads parse, pass the leakage oracle, and match the pinned hermetic expectations: a status digest; `lint.target.missing` for `verify-artifact`; and `verify.gates.failed` for `gate-report` on the same missing target.
3. Close the channel; assert exit `0`.
4. Spawn the same entry under Bun with the same script when the built entry is executable there; assert the canonical JSON of the three payloads equals the Node run. If the entry cannot execute under Bun, record the reason and continue; the Node run remains the AC-F1-3 requirement, and the in-process Bun suites remain the Bun-side proof.
5. The mcp import/purity AST scan (`tests/structure/mcp-imports.test.ts`, non-zero file-count floors) asserts over `packages/mcp/src/**`: zero `bun:` specifiers and zero `Bun.*` calls; tool modules contain no `node:*` import, no `process` read, and no ambient global. The serve edge may use `node:` builtins for stdio and the single startup configuration-environment read only, through its reason-bearing depcruise exact-path allowance and secret-read allowlist entry.
6. Assert runtime-neutrality through the mcp-scoped enforcement points: `pnpm check:boundaries` green, including the dependency-cruiser `runtime-apis-confinement` rule (its reason-bearing exact-path allowance admits only the serve entry's Node stdio edge and its single startup configuration-environment read) and the `scripts/checks/secret-read-boundary.ts` allowlist entry `configuration-environment-source` scoped to the serve root; `bun test tests/structure/mcp-imports.test.ts` green with its non-zero file-count AST floors over `packages/mcp/src/**`; `bun run scripts/checks/workspace-entrypoints.ts` green. Run `bun run scripts/checks/ambient-globals.ts` as a core regression check only: its scan scope is `packages/core`, so it is not mcp-surface coverage.
7. Assert the network guard was installed and no guarded call occurred; a seeded `fetch` in a temp copy of a tool module must fail the guard or the import scan by name (TC-MCP-020).

**Expected Outcome**:

- The serve entry and all three tools run under Node, produce payloads identical to the Bun path, and contain no runtime-specific import or ambient-global read outside the serve root's two documented allowances (the Node stdio transport edge and the single startup configuration-environment read), which the depcruise rule and secret-read allowlist scope to the serve path only.

**Notes / Clarifications**:

- Provider-backed success is not part of the smoke (GAP-T1); injected parity covers it.

#### TC-MCP-014 - Dependency license-registry verdict and supply-chain gates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, NFR-9
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`, `doc/legal/dependency-licenses.yaml`, `packages/mcp/package.json`
**Tags**: @backend, @supply-chain

**Preconditions**:

- The license audit exposes `directExternalDependencies` and `auditRegistry`/`validate`.
- The vulnerability gate and CI binding tests exist.

**Steps**:

1. Compute the direct external dependencies of `packages/mcp/package.json` (the `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` fields, excluding `workspace:` specs).
2. For every external dependency, assert `doc/legal/dependency-licenses.yaml` has an entry with a `license` and a `verdict`, and that the registry's allow/deny policy accepts it.
3. Run `bun run scripts/checks/license-audit.ts`; assert green. Run `bun run scripts/checks/vulnerability-gate.ts`; assert green with zero high/critical findings.
4. If no external dependency is added, assert `packages/mcp/package.json` has zero direct external dependencies (only workspace packages) and the protocol implementation is in-package. If an external dependency is added, assert its registry row and its lockfile resolution are present in the same change.
5. Assert the protocol implementation is confined to `packages/mcp/src`: no core or adapter module imports the MCP SDK or the protocol implementation; dependency-cruiser and the workspace-entrypoint check are green.
6. Assert `packages/mcp/package.json` remains `private: true`, has no `publishConfig`, and has no `.mcpb` reference; assert no installer entry exists (also TC-MCP-019). If the delivery chooses a `bin` field for the Node entry, assert it points to the Node-hosted entry, is not a second Bun-compiled binary, and is not registered in `scripts/install.sh`.
7. Run `bun test tests/checks/license-audit.test.ts tests/checks/license-ci-binding.test.ts`; assert green.

**Expected Outcome**:

- Every dependency introduced by the change has a same-change registry verdict, the supply-chain gates are green, and the protocol implementation stays in the MCP package.

#### TC-MCP-015 - Branding projection, naming firewall, and rename-drill snapshot

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-5, DEC-5
**Test Type(s)**: Unit, Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/mcp-contract.test.ts`; `tests/fixtures/mcp/tool-list.snapshot.json`; `scripts/checks/forbidden-literals.ts`
**Tags**: @backend, @branding

**Preconditions**:

- `resolveBrandIdentity` is available; two synthetic working names produce different `mcpToolPrefix` values.
- The committed snapshot is read-only.

**Steps**:

1. Resolve brand A (`SYNTHETIC_BRAND`) and brand B (a second synthetic name). Call `listTools()` under each.
2. Assert every name is `prefix + canonical primitive ID`; assert the primitive-ID suffix is identical across brands; assert descriptions and input schemas are byte-identical across brands.
3. Assert the canonical snapshot under brand A equals `tests/fixtures/mcp/tool-list.snapshot.json`; assert the brand-B snapshot differs only in the prefix.
4. Run `bun run scripts/checks/forbidden-literals.ts`; assert zero violations in `packages/mcp/**`; assert the package-tree scan count is greater than zero. Seed `ados` in a temp copy and assert the scan fails by name.
5. Assert no description or schema interpolates `productName`, `binaryName`, `packageScope`, or any brand value other than `mcpToolPrefix`. Assert descriptions and schemas contain no planted secret canary and no value read from the environment; a seeded secret in a temp copy fails the secret-free assertion.
6. Assert `doc/guides/rename-drill.md` RD-8 names the MCP tool-list snapshot and the committed fixture is the artifact it compares.
7. Run a mutation control that changes one primitive ID in a temp copy; assert the snapshot comparison fails naming the tool. Change the brand prefix and assert only the prefix differs.

**Expected Outcome**:

- Served names are the branding projection, the surface is literal-free, and the rename drill's snapshot moves only with the branding change.

#### TC-MCP-016 - Prompt-injection inertness: content grants no authority

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-10, RSK-2
**Test Type(s)**: Integration, Contract, Security
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-injection.test.ts`; `tests/fixtures/mcp/injection/**`
**Tags**: @backend, @security, @injection

**Preconditions**:

- Injection fixtures plant a unique canary token and hostile instruction text in fields the engines actually render within their declared bounds: a tracker work-item title, a CI trace evidence or job-name string, a hostile change-ref string echoed by the verify and gates engines, and a hostile workflow/job name in gate evidence.
- A clean baseline fixture without the canary is available.
- Each chosen field is verified to reach the payload by the positive control; a field that is bounds-dropped or not rendered is not used.

**Steps**:

1. Call each tool with the injection fixture. Assert the canary appears in the payload as a string value (positive control). If any tool's chosen field does not surface the canary, fail the fixture and move it to a rendered field; do not assert inertness on content that never reached the payload.
2. Assert `tools/list`, every description, and every schema are byte-identical before and after the call and contain no canary.
3. Assert stderr contains no canary.
4. Assert the read recorder log equals the clean baseline; the hostile content triggers no extra read.
5. Apply the read-only oracle: no write, fence, mutation, or spawn; the tree snapshot is unchanged.
6. Assert no tool-call recursion: the only `callTool` site is the dispatcher; the handlers call engine functions only. Assert no handler imports `node:child_process`, `Bun.spawn`, `eval`, or dynamic import.
7. Call a different tool normally after the hostile call; assert its normal payload. The hostile content did not change server behavior.
8. Run the negative control: remove the canary from the fixture and assert the canary assertion fails, proving the test is not vacuous.

**Expected Outcome**:

- Hostile content is returned only as inert data; the server takes no action, grants no authority, and does not elevate the content into descriptions or behavior.

**Notes / Clarifications**:

- The test proves the mechanical half: no action, no state change, no elevation, no extra read/write/spawn. An agent host may still choose to follow the text; that is outside the server's authority and is covered by the C-10 design statement.

#### TC-MCP-017 - Read-only guarantee: zero writes, fences, mutations, or spawns

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-7, RSK-5
**Test Type(s)**: Integration, Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/mcp-readonly.test.ts`; `guardStore`; temp tree snapshots
**Tags**: @backend, @security, @readonly

**Preconditions**:

- `guardStore` from `tests/behaviour/verify-support.ts` wraps the state store with `throwOnMutation: true`.
- A temp workspace with a state root and fixture documents is available.

**Steps**:

1. Snapshot the temp tree: relative paths, content hashes, and mtimes.
2. Run the full three-tool sequence over the success and failure fixtures with the guarded store.
3. Assert `guardStore` recorded no mutation member (`append`, `replaceDocument`, `acquireFence`, `releaseFence`, `recoverFence`, `repairTornTail`, `salvage`) and did not throw.
4. Snapshot the tree again; assert byte-identical paths, hashes, and mtimes; assert no audit record or audit document exists.
5. AST-scan `packages/mcp/src/**` for `node:child_process` imports and for `Bun.spawn`, `spawn(`, `exec(`, `execFile(`, and `fork(` call expressions; assert zero with a non-zero file count. Ignore comments and string literals. Seed a `spawn(` call in a temp copy and assert the scan fails by name.
6. Assert the MCP composition root imports no spawn-capable adapter seam (`@delivery-os/adapters/git`) and calls none of `createGitBranchSeam`, `createGitCommitSeam`, `createWatchdogGitSeam`, or `createCommitlintProbe`. Seed a call in a temp copy and assert the scan fails by name.
7. Assert the MCP tool runtime types expose no write, fence, commit, apply, merge, or delete member; the type test fails to compile if one is added.
8. Assert the status runtime has no write member and the verify/gates runtimes are read-plus-verify surfaces only.

**Expected Outcome**:

- The surface is read-only by construction and by observation: zero writes, fences, state mutations, or spawns; the tree is unchanged.

#### TC-MCP-018 - Boundary matrix and exit-literal invariant reconciliation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-1, AC-F5-3, NFR-3, NFR-6, DEC-6, RSK-7
**Test Type(s)**: Static, Contract, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/exit-code-literals.test.ts`, `tests/structure/mcp-imports.test.ts`, `tests/boundaries/**`, `.dependency-cruiser.cjs`, `scripts/checks/exit-code-literals.ts`
**Tags**: @backend, @boundary, @invariant

**Preconditions**:

- The existing `surface-projection-cli-only` rule and its `surface-projection-mcp-import` fixture are live.
- The exit-literal scan currently forbids `process.exit(...)` and numeric `exitCode` outside `packages/cli/src/projection.ts`.

**Steps**:

1. Run `bun test tests/boundaries`; assert the `matrix-mcp-importer` and `surface-projection-cli-only` fixtures pass and every rule has a failing fixture.
2. Run `pnpm check:boundaries`; assert green. Run `bun run scripts/checks/ambient-globals.ts` and `bun run scripts/checks/workspace-entrypoints.ts`; assert green.
3. Update `scripts/checks/exit-code-literals.ts` so the MCP lifecycle module is the only additional permitted exit site: it may use `process.exit(0|1|2)` or `process.exitCode = 0|1|2`, and every numeric literal used in an exit call or an `exitCode` assignment in that module is checked against `{0,1,2}`. Unrelated numeric literals (timeouts, protocol constants) remain allowed. No other `packages/mcp/src/**` file may exit or assign a numeric `exitCode`.
4. Assert the live tree is clean and `scannedFiles > 0`; assert the report names the MCP lifecycle module as the only new allowance and the CLI projection rule is unchanged.
5. Mutation tests: `process.exit(3)` in the lifecycle module fails naming the literal; `process.exit(0)` in another MCP module fails; `exitCode: 2` in an MCP module fails; an MCP import of `packages/cli/src/projection.ts` fails the boundary rule; the projection module's digits outside `{0,1,2}` still fail.
6. Assert no new boundary rule was added without a failing fixture; if a rule was added, assert `tests/boundaries/fixture-coverage.test.ts` is green.
7. Assert `git diff --check` is clean for the changed files.

**Expected Outcome**:

- The MCP surface gets exactly the three transport lifecycle exits, no CLI projection role, and the existing boundary matrix keeps its failing-fixture coverage.

#### TC-MCP-019 - Inventory, CI wiring, and packaging posture

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-3, AC-F1-4, NFR-4, NFR-9, DEC-2
**Test Type(s)**: Static, Contract, Content
**Automation Level**: Automated (plus a recorded conditional docs check)
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json`, `tests/checks/mcp-ci-parity.test.ts`, `.github/workflows/ci.yml`
**Tags**: @backend, @ci, @packaging

**Preconditions**:

- The content-inventory suite enumerates every package source file.
- The CI topology, bindingness, and supply-chain checks are the workflow authorities.

**Steps**:

1. Add every new or changed MCP source file to `tests/structure/inventory.json`; run `bun test tests/structure/content-inventory.test.ts` and `bun test tests/structure/subpaths.test.ts`; assert green. Assert the MCP package exports exactly the declared subpaths and the serve entry resolves through them.
2. Assert `.github/workflows/ci.yml`'s `ts-test` job runs `pnpm test` (which discovers the MCP suites) and provides Node with a `node --version` step or a pinned `actions/setup-node` step. `tests/checks/mcp-ci-parity.test.ts` asserts the wiring by reading the workflow.
3. Run `bun run scripts/checks/ci-topology.ts`, `ci-bindingness.ts`, and `ci-supply-chain.ts`; assert green.
4. Assert `packages/mcp/package.json` is `private: true`, has no `publishConfig`, and has no `.mcpb`; assert `scripts/install.sh` contains no MCP install entry. If a `bin` field exists, assert it points to the Node-hosted entry, not a second compiled binary, and is not registered. Run `manifest-privacy` and `publish-guard`; assert green.
5. Conditional docs check: if the change modifies a marker-scoped doc (`doc/guides/**`, `doc/templates/**`, `doc/00-index.md`, `doc/documentation-handbook.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`), run `bash scripts/.tests/test-doc-distribution.sh` and assert green. Otherwise record N/A and list the checked paths.
6. Run `pnpm check`; assert lint, format, typecheck, tests, boundaries, and exports parity are green.

**Expected Outcome**:

- The new surface is registered in the inventory and the CI gate battery, and the packaging posture stays private, unregistered, and unpublished.

#### TC-MCP-020 - Non-vacuity meta-check: broken guards fail by name

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: All ACs, NFR-1..NFR-11
**Test Type(s)**: Mutation, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/mcp-mutants.test.ts`; `tests/fixtures/mcp/mutants/**`
**Tags**: @backend, @meta

**Preconditions**:

- Each mutant is a temp copy of one production module with one named guard disabled, imported through a file URL.
- The live modules pass the same assertions.

**Steps**:

1. Payload leakage mutant: add `exitCode: 2` to a copied payload adapter; assert the leakage test fails naming `exitCode`.
2. Parity mutant: change one field in a copied status/verify/gate payload; assert the parity test fails naming the field.
3. Catalog mutant: add a fourth tool in a copied catalog; assert the catalog and protocol tests fail naming the tool.
4. Lifecycle mutant: add `process.exit(3)` to a copied lifecycle module; assert the invariant fails naming the literal. Add `process.exit(0)` to a copied non-lifecycle module; assert it fails naming the file.
5. Branding mutant: seed `ados` in a copied MCP module; assert the literal scan fails naming the file.
6. Injection mutant: make a copied handler act on the canary (for example, call another tool or write a file); assert the injection/read-only test fails naming the action.
7. Read-only mutant: add a write member to a copied runtime type or a `store.append` call to a copied handler; assert the type test or read-only test fails.
8. Assert every mutant name appears in the failure message; assert the live modules still pass. If a mutant passes, the meta-check fails.

**Expected Outcome**:

- Every negative and parity guard is live: a deliberately broken implementation fails with the case name, and the real implementation passes.

#### TC-MCP-021 - Documentation posture and distribution marker

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, F-6, AC-F1-2, AC-F6-1, NFR-5
**Test Type(s)**: Manual, Content
**Automation Level**: Manual (content checks plus the conditional distribution guard)
**Target Layer / Location**: `doc/spec/features/feature-mcp-surface.md`, `doc/spec/features/feature-result-contract.md`, `doc/guides/rename-drill.md`
**Tags**: @docs

**Preconditions**:

- System-spec update (phase 7) creates the first MCP feature spec page.
- The documentation handbook and the distribution-marker rule are available.

**Steps**:

1. Assert `doc/spec/features/feature-mcp-surface.md` exists with frontmatter including `ados_distribution: internal`, `id`, `status`, `created`, `last_updated`, `owners`, `service`, `summary`, and links.
2. Assert the page describes exactly the three tools, their CLI analogues, the mirror-parity payload contract, the lifecycle exits `0/1/2`, the diagnostics-channel separation, the read-only posture, and the untrusted-content posture. Assert it makes no batch, mutating, daemon, `.mcpb`, publication, or installer claim.
3. Assert `doc/spec/features/feature-result-contract.md` carries a surface-mapping note: MCP tool results carry the CLI `data` shapes and error fields; envelope rendering and the `{0,1,2}` projection remain CLI-side; no exit code crosses the MCP boundary.
4. Assert `doc/guides/rename-drill.md` RD-8 remains consistent with the committed MCP tool-list snapshot and the test that owns it.
5. Run the forbidden-literal scan over the changed docs; assert zero violations and no product or binary literal in the new page.
6. If any marker-scoped doc changed, run `bash scripts/.tests/test-doc-distribution.sh`; assert green. Otherwise record N/A.
7. Run the markdown content checks from the testing strategy: headings, lists, tables, code fences, and link/path review.

**Expected Outcome**:

- The documented posture matches the shipped contract, the distribution marker is present, and no out-of-scope capability is promised.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|-------------|----------------|------------|-------|
| Local development | Bun `1.4.4` (repo pin), pnpm `10.18.3` | `pnpm install --frozen-lockfile`; `bun test tests/structure/mcp-contract.test.ts`; `bun test tests/behaviour/mcp-status-parity.test.ts` | In-process contract and parity suites |
| Local Node smoke | A Node major supported by the delivery (the current CI runner provides `20` or newer) | `bun test tests/behaviour/mcp-node-smoke.test.ts` (the test spawns `node`) | Portability and cross-runtime identity |
| CI `ts-test` | Bun `1.4.4` plus the runner's Node | `pnpm test` after `pnpm install --frozen-lockfile` | All Bun suites, including the spawned Node smoke |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency-cruiser, ambient globals, workspace entrypoints, secret-read boundary |
| CI `ts-invariants` | Bun | `bun run scripts/checks/{error-table-sync,exit-code-literals,forbidden-literals}.ts` | Error-table sync, exit literals, naming firewall |
| CI license and vulnerability | Bun | `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts` | C-2 verdicts and supply chain |
| CI aggregate | Bun | `pnpm check` | Lint, format, typecheck, tests, boundaries, exports parity |
| Documentation | bash and manual | `bash scripts/.tests/test-doc-distribution.sh` only if a marker-scoped doc changes | Distribution-marker drift |

**Test data.**

- All fixtures are synthetic: refs such as `GH-9xx`, synthetic entity ids, synthetic titles, small counts, fixed timestamps, fixed run ids, and a synthetic brand. No real repository name, provider payload, credential, or personal data appears.
- The injection canary is a fabricated string used only to prove inertness. It is not a secret and is not reused outside its fixture.
- The Node smoke uses a `mkdtemp` workspace with its own `HOME`, `XDG_CONFIG_HOME`, config path, state root, and working name. It has no remote and no credentials. The config selector is computed from the synthetic brand's `environmentPrefix`; the default brand's selector is `DELIVERY_OS_CONFIG`, and the neutral working-name override is `DELIVERY_OS_WORKING_NAME`.
- The Node smoke installs a test-only network guard that throws on `fetch` and on `node:http`/`node:https`/`node:net` connection attempts. The guard is a fixture, not shipped code.

**Isolation and cleanup.**

- Every suite that touches the filesystem uses `mkdtemp` and removes the temp root in `afterEach`; child processes are killed in `finally` and their exit is awaited.
- Goldens and the tool-list snapshot are opened read-only; their `mtimeMs` is asserted unchanged.
- The live worktree is never written. A `git status --porcelain` snapshot is captured before and after the read-only and injection suites and asserted unchanged.
- Timeouts are used only to bound process waits and request/response matching, never as a correctness mechanism; no `sleep` is used to sequence protocol steps.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Implementation status |
|-------|-------------------------------|-------------------|-----------------------|
| TC-MCP-001 | `tests/structure/mcp-contract.test.ts` | `bun test tests/structure/mcp-contract.test.ts` | To Implement |
| TC-MCP-002 | `tests/structure/mcp-contract.test.ts`, `tests/types/mcp-payload.type-test.ts`, `tests/behaviour/mcp-error-payload.test.ts`; existing `tests/structure/error-table.test.ts`, `tests/structure/delivery-result-contract.test.ts`, `tests/checks/error-table-sync.test.ts` | `bun test tests/structure/mcp-contract.test.ts tests/behaviour/mcp-error-payload.test.ts tests/structure/error-table.test.ts tests/structure/delivery-result-contract.test.ts tests/checks/error-table-sync.test.ts`; `pnpm typecheck`; `bun run scripts/checks/error-table-sync.ts` | To Implement |
| TC-MCP-003 | `tests/behaviour/mcp-status-parity.test.ts`; `tests/fixtures/mcp/parity/{cases,harness,canonical}.ts`; `tests/fixtures/mcp/golden/status/**` | `bun test tests/behaviour/mcp-status-parity.test.ts` | To Implement |
| TC-MCP-004 | `tests/behaviour/mcp-status-parity.test.ts`, `tests/behaviour/mcp-error-payload.test.ts` | `bun test tests/behaviour/mcp-status-parity.test.ts tests/behaviour/mcp-error-payload.test.ts` | To Implement |
| TC-MCP-005 | `tests/behaviour/mcp-verify-artifact-parity.test.ts`; `tests/fixtures/mcp/golden/verify-artifact/**` | `bun test tests/behaviour/mcp-verify-artifact-parity.test.ts` | To Implement |
| TC-MCP-006 | `tests/behaviour/mcp-verify-artifact-parity.test.ts`, `tests/behaviour/mcp-error-payload.test.ts` | `bun test tests/behaviour/mcp-verify-artifact-parity.test.ts tests/behaviour/mcp-error-payload.test.ts` | To Implement |
| TC-MCP-007 | `tests/behaviour/mcp-gate-report-parity.test.ts`; `tests/fixtures/mcp/golden/gate-report/**` | `bun test tests/behaviour/mcp-gate-report-parity.test.ts` | To Implement |
| TC-MCP-008 | `tests/behaviour/mcp-read-parity.test.ts` | `bun test tests/behaviour/mcp-read-parity.test.ts` | To Implement |
| TC-MCP-009 | `tests/behaviour/mcp-input-validation.test.ts` | `bun test tests/behaviour/mcp-input-validation.test.ts` | To Implement |
| TC-MCP-010 | `tests/structure/mcp-imports.test.ts`, `tests/behaviour/mcp-error-payload.test.ts`, `tests/behaviour/mcp-node-smoke.test.ts` | `bun test tests/structure/mcp-imports.test.ts tests/behaviour/mcp-error-payload.test.ts tests/behaviour/mcp-node-smoke.test.ts`; `pnpm check:boundaries` | To Implement |
| TC-MCP-011 | `tests/behaviour/mcp-lifecycle.test.ts` | `bun test tests/behaviour/mcp-lifecycle.test.ts` | To Implement |
| TC-MCP-012 | `tests/behaviour/mcp-node-smoke.test.ts`; `tests/fixtures/mcp/protocol/client.ts` | `bun test tests/behaviour/mcp-node-smoke.test.ts` | To Implement |
| TC-MCP-013 | `tests/behaviour/mcp-node-smoke.test.ts`; `tests/fixtures/mcp/node/network-guard.mjs`; `tests/structure/mcp-imports.test.ts`; `.dependency-cruiser.cjs`; `scripts/checks/secret-read-boundary.ts` | `bun test tests/behaviour/mcp-node-smoke.test.ts tests/structure/mcp-imports.test.ts`; `pnpm check:boundaries` | To Implement |
| TC-MCP-014 | `tests/checks/license-audit.test.ts` (existing), `doc/legal/dependency-licenses.yaml` (update if a dependency is added) | `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts`; `bun test tests/checks/license-audit.test.ts` | Existing – Update only if a dependency is added |
| TC-MCP-015 | `tests/structure/mcp-contract.test.ts`; `tests/fixtures/mcp/tool-list.snapshot.json` | `bun test tests/structure/mcp-contract.test.ts`; `bun run scripts/checks/forbidden-literals.ts` | To Implement |
| TC-MCP-016 | `tests/behaviour/mcp-injection.test.ts`; `tests/fixtures/mcp/injection/**` | `bun test tests/behaviour/mcp-injection.test.ts` | To Implement |
| TC-MCP-017 | `tests/behaviour/mcp-readonly.test.ts` | `bun test tests/behaviour/mcp-readonly.test.ts` | To Implement |
| TC-MCP-018 | `tests/checks/exit-code-literals.test.ts` (update), `tests/structure/mcp-imports.test.ts`, `tests/boundaries/fixture-registry.json` (only if a rule is added) | `bun test tests/checks/exit-code-literals.test.ts tests/structure/mcp-imports.test.ts tests/boundaries`; `bun run scripts/checks/exit-code-literals.ts`; `pnpm check:boundaries` | Existing – Update |
| TC-MCP-019 | `tests/structure/inventory.json` (update), `tests/structure/content-inventory.test.ts` (existing), `tests/checks/mcp-ci-parity.test.ts`, `.github/workflows/ci.yml` (conditional Node step) | `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/checks/mcp-ci-parity.test.ts`; `pnpm check` | To Implement (inventory and CI wiring) |
| TC-MCP-020 | `tests/checks/mcp-mutants.test.ts`; `tests/fixtures/mcp/mutants/**` | `bun test tests/checks/mcp-mutants.test.ts` | To Implement |
| TC-MCP-021 | `doc/spec/features/feature-mcp-surface.md` (new at phase 7), `doc/spec/features/feature-result-contract.md` (update at phase 7) | Content/manual review; `bash scripts/.tests/test-doc-distribution.sh` if marker-scoped docs change | Manual Only (phase 7) |

**Implementation mapping notes.**

- The parity harness lives in `tests/fixtures/mcp/parity/` and imports the existing status, verify, and verify-gates harnesses; it does not re-implement their fact models.
- The Node smoke and the parity suites share the same case definitions where possible, so a new fixture automatically exercises both the in-process and process paths.
- `tests/fixtures/mcp/regenerate.ts` is the only writer for the goldens and the tool-list snapshot. It is run explicitly, reviewed, and never called from a test body.
- The delivery plan maps the behavior-named seams (catalog module, toolset factory, lifecycle module, serve entry) to the chosen file and export names.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| R-T1 | The MCP SDK wraps tool results differently from the toolset seam, so a payload assertion tests the wrapper instead of the contract. | Assert the JSON content parsed from the tool result, and assert the toolset seam separately. Treat protocol metadata (`isError`, content type) as non-contract. |
| R-T2 | Spawned lifecycle tests hang or flake on slow CI. | Use deterministic frames, hard per-process timeouts, a kill in `finally`, and no sleeps for sequencing. Record the exit code and signal in the failure message. |
| R-T3 | Node is absent or too old on a developer machine or a future CI image. | Assert `node --version` with a major-version floor and fail loudly; add an explicit CI Node step or a pinned `actions/setup-node` step; record the version in the execution log. |
| R-T4 | The MCP surface reimplements the status collector and drifts from the CLI. | The read-parity recorder test asserts identical read-member sequences; the shared fixture bundle is the same object for both surfaces; the CLI is the live oracle. |
| R-T5 | Provider-backed success cannot be exercised hermetically in the Node smoke. | Split the coverage: injected parity suites cover all success shapes; the smoke covers local-only outcomes; GAP-T1 records the boundary. |
| R-T6 | The protocol dependency choice (OQ-1) changes the dependency surface and the license path. | The license test is generic over the manifest's external dependencies: if none are added, it asserts the in-package path; if one is added, it asserts the same-change registry verdict. |
| R-T7 | `schemaVersion` is both an envelope key and an engine-data key, so a naive leakage test produces a false positive or a false negative. | §4.2 and §4.3 pin the distinction: `delivery.result.v1` is forbidden; `delivery.status.v1` and `delivery.verify-gates.v1` are required engine data. |
| R-T8 | The exit-literal reconciliation weakens the CLI projection rule. | Mutation tests cover `process.exit(3)`, a non-lifecycle exit, an MCP `exitCode` numeric, and an MCP projection import; the CLI projection digits outside `{0,1,2}` still fail. |
| R-T9 | A golden and a parity assertion both drift because the golden is regenerated blindly. | The CLI is the live oracle; the golden is a second pin; every golden has a mutation control that changes one field and asserts inequality. Regeneration is an explicit, reviewed command. |

### 8.2 Assumptions

- The delivery exposes a pure toolset seam (`listTools`, `callTool`) and a declared serve entry, as required for testability; the exact export names are delivery-bound.
- The three engines and their contracts remain unchanged; the parity suites consume them as-is.
- The MCP SDK, if used, supports initialize, `tools/list`, and `tools/call` over stdio and carries JSON content in tool results.
- The CI runner provides a supported Node major (the current runner provides 20 or newer) in the `ts-test` job, or the delivery adds a pinned Node setup step in the same change.
- The existing status, verify, and verify-gates harnesses remain the canonical fixture builders; this plan does not fork their fact models.
- All fixtures are synthetic; no live provider, credential, or real `$HOME` is used.
- The lifecycle module is the only MCP exit site and uses `0`, `1`, or `2`; the invariant is updated in the same change.
- The serve edge is the composition root and may read the environment once at startup to resolve configuration, as the CLI edge does. NFR-4's ambient-global prohibition is applied to the neutral tool modules; this reading is consistent with the TypeScript rules' runtime-API locations and is recorded here so it is not mistaken for a silent exemption.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution path |
|----|----------|-----------|-------|-----------------|
| OQ-T1 | Is the protocol implementation an external MCP dependency or an in-package stdio implementation (spec OQ-1)? | No | `@plan-writer` / `@coder` | Resolve at delivery planning; the license and boundary tests branch generically over the manifest. |
| OQ-T2 | Does the server serialize tool calls or run them concurrently (spec OQ-2)? | No | `@plan-writer` / `@coder` | Resolve at delivery planning; TC-MCP-008 asserts per-call identity under interleaving, not a policy. |
| OQ-T3 | Is the serve entry exported as the package root or a declared subpath (for example `./serve`)? | No | `@coder` | Resolve in delivery; the test resolves the entry from the manifest's declared exports and never deep-imports. |
| OQ-T4 | Does the lifecycle module use `process.exit(code)` or `process.exitCode = code`? | No | `@coder` | Either is allowed, but only inside the lifecycle module and only with `0`, `1`, or `2`; the invariant covers both forms. |
| OQ-T5 | What is the tool parameter name for the change ref (`ref` or `changeRef`)? | No | `@coder` | Delivery-bound; the tests read the input schema and use the declared property name. |
| OQ-T6 | Does the protocol adapter mark failures with `isError: true`, or does the content alone carry the failure? | No | `@coder` | The JSON payload contract is binding; the protocol flag is metadata. The test asserts the payload and, if present, that `isError` is `true` for failures and not an exit code. |
| OQ-T7 | Does the MCP entry expose an in-process server seam for protocol tests, or is the protocol tested only through a spawned process? | No | `@coder` | Either is acceptable: the toolset seam covers payload behavior; the spawned process covers handshake and discovery. If an in-process seam exists, it is preferred for speed. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial test plan for GH-231 (M1-S7: Minimal MCP). 21 TCs cover all 13 ACs, all 11 NFRs, DM-1..DM-4, DEC-1..DEC-7, the shared CLI/MCP parity fixtures, the Node portability smoke, the prompt-injection fixture, the read-only oracle, the license verdict, and the exit-literal reconciliation. |
| 1.1 | 2026-11-06 | @test-plan-writer | Iteration-2 DoR remediation — TC-MCP-013 enforcement-point re-citation (gate finding, 2026-11-06). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not run | Plan authored at test planning; populate during delivery. |

**Execution evidence to record per run:** the command, the Bun version, the Node version used by the smoke, the case count per parity suite, the scan file counts, and the exit codes observed in the lifecycle matrix. A failed case must name the TC ID, the case ID, and the expected versus observed value.
