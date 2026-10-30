---
id: chg-GH-172-test-plan
status: Updated
created: 2026-10-30T02:20:00Z
last_updated: 2026-10-30T03:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["oss-tooling", "contracts", "cli", "m0", "adr-0003"]
version_impact: minor
summary: "Verify the M0-S3 result contract: every outcome of the standalone CLI — success, classified failure, unknown failure, broken invocation — emits a CommandResult envelope with exactly schemaVersion/runId/exitCode/timing and exactly one of data or error, timing on every path; failures resolve through the classification chain to exactly one documented error-table entry carrying category, retryable, consequence (unknown first-class) and an action-first hint; exit codes are a {0,1,2} projection of the table in the CLI only, with zero call-site literals; runCli is deterministic, in-process, and spawn-free; machine output is always valid JSON with no diagnostics; a single redaction chokepoint removes planted secret material from success and failure payloads on both streams; and a binding two-directional docs/code sync check keeps emitted codes and documented entries identical."
links:
  change_spec: ./chg-GH-172-spec.md
  implementation_plan: ./chg-GH-172-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S3: Result contract and error table

## 1. Scope and Objectives

This change ships the trust substrate every later command stands on, so the tests must prove four properties and nothing beyond them: **envelope integrity** (one shape, exactly the six contracted field names, data/error mutual exclusivity, `timing` on success and failure equally, `schemaVersion` brand-neutral and fixed, `runId` opaque and present), **failure identity** (every emitted code is a stable hierarchical app code that resolves to exactly one declared table entry with category, retryable, consequence, remediation hint and projection class; unclassifiable failures and broken invocations are contained by the two fallback entries — `fallback.internal` and `fallback.invocation` — both with consequence `unknown`), **surface guarantees** (`runCli` is deterministic and in-process, `--json` output is always one valid envelope even for a broken command, no stack traces or raw diagnostics reach the machine channel, and no secret material survives on either stream because exactly one redaction chokepoint sits between the envelope and the streams), and **enforcement durability** (exit codes exist only as a {0,1,2} projection of the table, no exit-code literal exists at a call site, and a binding two-directional sync check fails CI when emitted codes and documented table entries diverge).

The risks guarded here are the ones that make every downstream story expensive later: a contract shape that is wrong in a way M0-S4/S5/S10/S11/S12 inherit, exit-code folklore re-emerging at call sites, a crash path escaping containment and breaking the always-valid machine guarantee, a redaction bypass, documentation drift that turns "error codes resolve to documented table entries" into an aspiration, and any weakening of the M0-S1/M0-S2 gates that already bind this repository.

### 1.1 In Scope

- `CommandResult` envelope field contract: exact field set, `data`/`error` mutual exclusivity, explicit empty data payload for void success (F-1, AC-F1-1, DM-1, NFR-3).
- `timing` presence and measurement on success, classified failure, unknown failure, and broken invocation (F-1, AC-F1-2, NFR-4).
- Golden suites under `--json`: success envelope, classified failure, broken invocation, planted-secret success and failure (F-6, F-7, AC-F1-3, AC-F6-1, AC-F7-1, NFR-2).
- Error-table row shape, code identity and format, single-declaration discipline, and the two fallback entries (`fallback.invocation`, `fallback.internal`) (F-2, F-3, AC-F2-2, AC-F3-2, DM-3, DM-4).
- Classification chain domain kind → app error code → projection class, including totality over declared domain kinds and containment of unclassifiable and non-`Error` failures (F-2, F-3, AC-F3-1, AC-F3-2).
- Exit-code projection {0, 1, 2}: derivation per class, totality, confinement to the standalone CLI, and zero exit-code literals at call sites (F-4, AC-F4-1, NFR-7).
- `runCli(argv, streams, injected facts)`: in-process execution, returned exit code, zero spawned processes, determinism, and channel split between machine output and human diagnostics (F-5, AC-F5-1, AC-F5-2, AC-F6-2, NFR-8).
- Failure containment: broken invocation goldens, hostile command bodies (throws, rejected promises, malformed results), and absence of stack traces/raw diagnostics on the machine channel (F-6, AC-F6-1, AC-F6-2).
- Redaction chokepoint: planted-secret goldens on success and failure payloads, no-partial-leak sweeps, chokepoint exclusivity, secret-free hints/summaries (F-7, AC-F7-1, AC-F7-2, NFR-5). The contract is contiguous registered-value replacement (plan D1): a secret split across adjacent strings is in-guarantee only when its fragments are themselves registered, so the split corpus case registers its fragments (§4.5, TC-REDACT-003).
- Binding docs/code sync check: green path plus failure in every drift direction, identity-hygiene corpora, and CI bindingness (F-8, AC-F8-1, NFR-6).
- Conformance of the delivered surface to the standing M0-S1/M0-S2 constraints: contracts runtime-neutrality, tier matrix, new forbidden rules with failing negative fixtures, forbidden-literal scan, fixture hygiene, and no gate regression (F-9, AC-F9-1, NFR-1, NFR-9, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any real command implementation and command registration; `config` (M0-S4) is the first consumer (NG-1, NG-2). The synthetic commands in fixtures exist only to drive the surface.
- [OUT] Layered configuration, state drivers/persistence, phase/lint, db admin, adapter primitive ports (NG-2).
- [OUT] MCP and opencode result conventions and their exit-code projections; only the assertion that they do **not** project exit codes in this change (NG-4, F-4).
- [OUT] Human-facing terminal UX: color, progress, interactivity, and the shape of non-`--json` stdout. Tests assert the returned exit code and the internal envelope for non-`--json` runs, not human text (NG-5).
- [OUT] Telemetry emission; the reserved schema names stay untouched and are asserted unchanged only where they touch the envelope's `schemaVersion` lineage (NG-3).
- [OUT] Any product name decision or reveal; fixtures use synthetic brand values only (NG-6, NFR-9).
- [OUT] Cloud surfaces, completion of the surrounding `doc/spec/features/feature-result-contract.md` feature doc beyond the documented error table (the table section is authored as part of this change; phase 7 reconciles and completes the rest of the feature doc), bash stack changes, `.opencode/`, `.ados-claude/`, and performance/load testing (NG-7, NG-8).
- [OUT] Promulgating the companion survey into the distributable doc set (NG-8); it is referenced, not tested.
- [RESOLVED — GAP-1 / OQ-T1] **Documented-table artifact timing.** AC-F8-1 requires documented entries to exist in a real artifact at merge time. Resolved by spec v1.1: the documented error table ships in-change at `doc/spec/features/feature-result-contract.md`, authored during delivery as part of this change. The sync check binds both drift directions against that in-change artifact from merge time (§4.4, TC-SYNC-003); phase 7 reconciles and completes the surrounding feature doc but does not rewrite the table section, which stays sync-checked.
- [GAP-2] **`tests/**` is outside the forbidden-literal scan scope.** The M0-S2 scan covers five scope classes that exclude `tests/**` (established by GH-171 A-T4). This plan adds an explicit fixture-hygiene test (TC-BOUNDARY-004) so new goldens/fixtures cannot smuggle a product token.
- [GAP-3] **"Secrets never appear" needs a defined secret set.** The redaction guarantee is only testable against a declared secret set; the spec names "environment-sourced tokens" as the example. This plan binds the edge-registered secret-value set as the redaction input contract (A-T4) and records the consequence as a limitation.
- [RESOLVED — GAP-4 / OQ-T2] **Fallback entries' fields.** Resolved by spec v1.1 / DEC-13: containment uses two entries with fixed values — `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`, user-validation → exit 1) and `fallback.internal` (category `platform`, `retryable: false`, consequence `unknown`, platform-provider → exit 2). Tests assert these fixed values (TC-TABLE-002, TC-CLASSIFY-002, TC-CONTAIN-001..003).

## 2. References

- **Change specification**: [chg-GH-172-spec.md](./chg-GH-172-spec.md) — spec v1.1; F-1..F-9, DM-1..DM-4, NFR-1..NFR-10, DEC-1..DEC-13 (DEC-13 fixes the two fallback entries), AC-F1-1..AC-F9-1, §17 ticket-AC mapping, Appendix A (envelope field contract), Appendix B (table entry contract), Appendix C (exit-code projection).
- **Implementation plan**: [chg-GH-172-plan.md](./chg-GH-172-plan.md) — authored in delivery planning (phase 4) after this plan. TC IDs are behaviour-bound and do not depend on task numbering; plan phases must map onto these TCs, not the reverse.
- **Documented-table artifact (in-change)**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — authored during delivery as part of this change; carries the documented error table that is the S2 surface of the sync check (§4.4). Phase 7 reconciles and completes the surrounding feature doc; the table section already exists by merge.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — canonical for layers, runners, module-to-test mapping, `scripts/checks/*.ts` mutation tests, and the aggregate `pnpm check`.
- **Companion survey**: [survey-agent-facing-error-design.md](./survey-agent-facing-error-design.md) — validates the error convention (action-first hints, four-value category, consequence as the novel element, additive evolution); verdicts attach to structural elements, not vendor payloads. The survey is a point-in-time companion authored before DEC-13 and predates the two-entry containment decision: its singular phrasing ("the fallback table entry", verdict 7) is superseded by DEC-13's `fallback.invocation` / `fallback.internal` pair, and the survey is referenced, not edited, by this change.
- **Authoritative decision**: [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — runtime-neutral contracts, package tiers, C-4/C-5/C-6/C-8 constraints.
- **Planning truth**: [doc/planning/oss-tooling/cli-command-registry.md](../../../planning/oss-tooling/cli-command-registry.md) — envelope field set, `--json` always-valid machine output, exit-code projection 0/1/2 with the table as source of truth.
- **Ticket**: issue #172 — M0-S3: Result contract and error table (goal, tasks, four ACs; identical to backlog M0-S3).
- **Current-truth baselines**: [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md) (tier matrix, ambient guard, negative-fixture discipline, CI fast loop), [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) (`BrandIdentity`, forbidden-literal scan).
- **Sibling format/rigor reference**: [chg-GH-171-test-plan.md](../2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-test-plan.md) and [chg-GH-170-test-plan.md](../2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-test-plan.md) — invariant-plus-mutation pattern, fixture registries, vacuity probes.
- **Existing mechanisms to reuse**: `scripts/checks/ambient-globals.ts`, `scripts/checks/forbidden-literals.ts` + registry, `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `scripts/checks/workspace-entrypoints.ts`, `scripts/checks/testkit-exclusion.ts`, `tests/boundaries/**` (harness, `fixtures/cases.ts`, `fixture-registry.json`, `fixture-coverage.test.ts`), `tests/structure/content-inventory.test.ts` + `inventory.json`, `tests/checks/fixture-repo.ts`.
- **Repo conventions**: [AGENTS.md](../../../../AGENTS.md) — branch model, no license headers in `doc/changes/`, test layout (`tests/{layer}/*.test.ts`, fixtures never `*.test.ts`).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Envelope contains exactly `schemaVersion`, `runId`, `exitCode`, `timing` and exactly one of `data`/`error`; void success carries explicit empty data | TC-RESULT-001, TC-RESULT-002, TC-RESULT-005, TC-RESULT-006 | Covered |
| AC-F1-2 | `timing` present on every failure envelope and reflects measured duration | TC-RESULT-003, TC-RESULT-004 | Covered |
| AC-F1-3 | Successful `--json` run matches the golden success envelope (valid JSON, all fields, exit 0) | TC-RESULT-002, TC-RESULT-006 | Covered |
| AC-F2-1 | `Result<T, E>` unchanged; `CommandResult` declared separately; contracts carry no I/O, ambient env, clock, or randomness | TC-TABLE-004, TC-BOUNDARY-001, TC-RESULT-005 | Covered |
| AC-F2-2 | Every table entry carries the full row shape and exactly one projection class | TC-TABLE-001, TC-EXIT-001 | Covered |
| AC-F3-1 | Classification chain yields a stable hierarchical code resolving to exactly one documented entry | TC-CLASSIFY-001, TC-TABLE-003, TC-SYNC-001 | Covered |
| AC-F3-2 | Unclassifiable error applies `fallback.internal` (consequence `unknown`, category `platform`, `retryable: false`, hint to diagnostics); table entries state consequence explicitly | TC-CLASSIFY-002, TC-TABLE-002, TC-TABLE-001, TC-CONTAIN-003 | Covered — first clause via `fallback.internal` (DEC-13); second clause remains structurally subsumed because TC-TABLE-001 step 4 asserts every entry states `consequence` explicitly (no wording change required) |
| AC-F4-1 | Exit codes all in {0,1,2}, derived from table entries; no exit-code constant at call sites | TC-EXIT-001, TC-EXIT-002, TC-EXIT-003 | Covered |
| AC-F5-1 | `runCli` writes deterministic output to injected streams and returns the exit code, no spawned process | TC-RUNCLI-001, TC-RUNCLI-003 | Covered |
| AC-F5-2 | `runCli` contract tests run in-process (zero spawned processes); identical argv + streams + clock facts ⇒ identical output | TC-RUNCLI-001, TC-RUNCLI-002 | Covered |
| AC-F6-1 | Broken invocation under `--json` still emits a valid envelope resolving to the documented `fallback.invocation` entry (category `user`, `retryable: false`, consequence `unknown`, exit 1) with a caller-directed hint | TC-CONTAIN-001, TC-CONTAIN-002, TC-CONTAIN-003 | Covered |
| AC-F6-2 | Failure machine channel contains no stack traces or raw diagnostics; diagnostics only on the human error stream | TC-CONTAIN-002, TC-CONTAIN-003, TC-RUNCLI-003, TC-CLASSIFY-002 | Covered |
| AC-F7-1 | Planted secret material removed/transformed on both success and failure paths; zero occurrences in any stream | TC-REDACT-001, TC-REDACT-002, TC-REDACT-003 | Covered |
| AC-F7-2 | No stream write outside the redaction chokepoint's serialization path; hints/summaries secret-free by construction | TC-REDACT-004, TC-BOUNDARY-002, TC-REVIEW-001 | Covered — structural assertions automated; a manual review step covers dynamic access the scan cannot see |
| AC-F8-1 | Binding sync check: emitted codes resolve to exactly one documented entry, documented entries exist in the in-change doc table, drift either way fails CI | TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-004, TC-SYNC-005, TC-SYNC-006 | Covered — documented table bound at `doc/spec/features/feature-result-contract.md`, authored in-change; both drift directions tested against it from merge time (GAP-1/OQ-T1 resolved); recognition level-scoped A/B/C per §4.4 |
| AC-F9-1 | Zero product tokens; brand strings from `BrandIdentity` parameters; contracts I/O-free; tier matrix green; every new forbidden rule has its failing negative fixture | TC-BOUNDARY-001, TC-BOUNDARY-002, TC-BOUNDARY-003, TC-BOUNDARY-004, TC-BOUNDARY-005, TC-RUNCLI-004 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-RESULT-001, TC-RESULT-002, TC-RESULT-003, TC-RESULT-004, TC-RESULT-005, TC-RESULT-006; F-2 → TC-TABLE-001, TC-TABLE-002, TC-TABLE-003, TC-TABLE-004, TC-CLASSIFY-001; F-3 → TC-TABLE-001, TC-TABLE-002, TC-TABLE-003, TC-CLASSIFY-001, TC-CLASSIFY-002; F-4 → TC-EXIT-001, TC-EXIT-002, TC-EXIT-003; F-5 → TC-RUNCLI-001, TC-RUNCLI-002, TC-RUNCLI-003, TC-RUNCLI-004; F-6 → TC-CONTAIN-001, TC-CONTAIN-002, TC-CONTAIN-003, TC-RESULT-004; F-7 → TC-REDACT-001, TC-REDACT-002, TC-REDACT-003, TC-REDACT-004; F-8 → TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-004, TC-SYNC-005, TC-SYNC-006; F-9 → TC-BOUNDARY-001, TC-BOUNDARY-002, TC-BOUNDARY-003, TC-BOUNDARY-004, TC-BOUNDARY-005, TC-RUNCLI-004, TC-REVIEW-001.

**Ticket AC coverage** (spec §17 mapping, all four ticket ACs):

| Ticket AC | Verified by | Notes |
|-----------|-------------|-------|
| T-AC1 — unit and golden tests | TC-RESULT-001, TC-RESULT-002, TC-RESULT-003, TC-RESULT-004, TC-RESULT-006, TC-TABLE-001, TC-TABLE-002, TC-TABLE-003, TC-CLASSIFY-001, TC-CLASSIFY-002, TC-EXIT-001, TC-EXIT-002, TC-EXIT-003, TC-RUNCLI-001, TC-RUNCLI-002, TC-REDACT-001, TC-REDACT-002 | Failure/redaction goldens and classification/projection unit suites are the literal deliverable of the ticket's first AC |
| T-AC2 — a broken command under `--json` still emits a valid envelope | TC-CONTAIN-001, TC-CONTAIN-002, TC-CONTAIN-003 | Three distinct broken-invocation fixtures (unknown command, unknown flag, missing value) plus hostile handler bodies; each must yield exactly one valid envelope |
| T-AC3 — secrets never appear in output | TC-REDACT-001, TC-REDACT-002, TC-REDACT-003, TC-REDACT-004 | Success payload, failure payload, no-partial-leak sweep, and chokepoint exclusivity; vacuity control proves detection |
| T-AC4 — error codes resolve to documented table entries | TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-004, TC-SYNC-005, TC-SYNC-006, TC-CLASSIFY-001, TC-TABLE-003 | Bidirectional check with binding CI wiring; each drift direction has its own failing mutation |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP surface and no events/messages exist in this change (spec §8.1, §8.2). The envelope is a process-surface contract.

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| DM-1 | `CommandResult` envelope: `schemaVersion` (`delivery.result.v1`), `runId`, `exitCode`, `timing`, exactly one of `data`/`error`; generic `Result<T, E>` remains the internal result | TC-RESULT-001, TC-RESULT-002, TC-RESULT-005, TC-TABLE-004, TC-BOUNDARY-001 | Covered |
| DM-2 | Envelope error object: `code`, `category`, `retryable`, `consequence`, `remediationHint`, optional non-identifying `summary` | TC-TABLE-001, TC-TABLE-002, TC-CLASSIFY-002, TC-CONTAIN-002 | Covered |
| DM-3 | Error-table entry: code, domain kind, category, retryable, consequence, hint, projection class, summary; declared once as a machine-readable source; includes the two fallback entries (`fallback.invocation`, `fallback.internal`) | TC-TABLE-001, TC-TABLE-002, TC-TABLE-004, TC-CLASSIFY-001, TC-SYNC-001 | Covered |
| DM-4 | App error code format `domain.reason.detail`; resolves to exactly one entry; documented table derived from the source | TC-TABLE-003, TC-SYNC-002, TC-SYNC-005 | Covered |
| EVT-1/EVT-2 | Reserved brand-neutral telemetry schema names; untouched, no emission path | TC-BOUNDARY-003, TC-BOUNDARY-005 | Covered (non-regression only) |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Contracts runtime neutrality: 0 I/O, ambient env/clock/randomness reads, runtime-API imports | TC-BOUNDARY-001, TC-TABLE-004, TC-RESULT-005 | Covered |
| NFR-2 | 100% of `--json` outcomes parse as a valid envelope matching DM-1 | TC-RESULT-002, TC-RESULT-003, TC-RESULT-006, TC-CONTAIN-001, TC-CONTAIN-003, TC-RUNCLI-003 | Covered |
| NFR-3 | 0 field-contract violations (missing fields; both/neither of data/error) | TC-RESULT-001, TC-RESULT-006, TC-RUNCLI-003 | Covered |
| NFR-4 | 100% of failure envelopes carry `timing` | TC-RESULT-003, TC-RESULT-004 | Covered |
| NFR-5 | 0 occurrences of planted secret material in any stream; `data` and `error` both covered | TC-REDACT-001, TC-REDACT-002, TC-REDACT-003, TC-REDACT-004 | Covered |
| NFR-6 | 100% of emitted codes resolve to exactly one documented entry; documented entries exist in the in-change `feature-result-contract.md` table; binding in CI, drift fails both ways | TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-004, TC-SYNC-005, TC-SYNC-006 | Covered |
| NFR-7 | 0 codes outside {0,1,2}; 0 entries without exactly one projection class; 0 call-site exit literals | TC-EXIT-001, TC-EXIT-002, TC-EXIT-003, TC-TABLE-001 | Covered |
| NFR-8 | 0 spawned-process contract tests; deterministic output for identical argv + streams + clock facts | TC-RUNCLI-001, TC-RUNCLI-002 | Covered |
| NFR-9 | 0 forbidden product-token literals in new code; 0 ambient brand derivations | TC-BOUNDARY-003, TC-BOUNDARY-004, TC-RUNCLI-004 | Covered |
| NFR-10 | 0 tier/boundary violations; 0 regressions in existing gates, bash jobs, or the aggregate check | TC-BOUNDARY-002, TC-BOUNDARY-005, TC-SYNC-006, TC-REVIEW-001 | Covered |

## 4. Test Types and Layers

Three runners, deliberately separated. **`bun test`** owns behaviour, structure, golden, and mutation-driver assertions. **`bun run scripts/checks/*.ts`** owns repository invariants whose assertion is "this gate must exit non-zero and name the offender". **Existing bash suites and CI topology checks** are run, never extended, by this change.

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract/envelope unit assertions | `bun test tests/structure` | `tests/structure/result-contract.test.ts` (†) | TC-RESULT-001, TC-RESULT-005, TC-RESULT-006 |
| Error-table unit/structure assertions | `bun test tests/structure` | `tests/structure/error-table.test.ts` (†) | TC-TABLE-001, TC-TABLE-002, TC-TABLE-003, TC-TABLE-004 |
| Classification and projection unit tests | `bun test tests/behaviour` | `tests/behaviour/error-classification.test.ts` (†), `tests/behaviour/exit-projection.test.ts` (†) | TC-CLASSIFY-001, TC-CLASSIFY-002, TC-EXIT-001, TC-EXIT-003 |
| `runCli` surface behaviour | `bun test tests/behaviour` | `tests/behaviour/run-cli.test.ts` (†) | TC-RUNCLI-001, TC-RUNCLI-002, TC-RUNCLI-003, TC-RUNCLI-004 |
| Golden suites | `bun test tests/golden` | `tests/golden/envelope-success.test.ts` (†), `envelope-failure.test.ts` (†), `broken-command.test.ts` (†), `redaction.test.ts` (†), `timing.test.ts` (†) + `tests/fixtures/result/**` (†) | TC-RESULT-002, TC-RESULT-003, TC-RESULT-004, TC-CONTAIN-001, TC-CONTAIN-002, TC-CONTAIN-003, TC-REDACT-001, TC-REDACT-002, TC-REDACT-003 |
| Testkit conformance helper | `bun test tests/structure` | `packages/testkit/src/result-conformance.ts` (†) + `tests/structure/result-contract.test.ts` | TC-RESULT-006 |
| Repository invariants | `bun run scripts/checks/{check}.ts` | `scripts/checks/error-table-sync.ts` (†), `scripts/checks/exit-code-literals.ts` (†) | TC-SYNC-001, TC-EXIT-002 |
| Invariant mutation tests | `bun test tests/checks` | `tests/checks/error-table-sync.test.ts` (†), `tests/checks/exit-code-literals.test.ts` (†) | TC-SYNC-002..006, TC-EXIT-002 |
| Boundary negative fixtures | `bun test tests/boundaries` | `tests/boundaries/fixtures/cases.ts` (update), `fixture-registry.json` (update), `tests/structure/cli-edge-seam.test.ts` (†), existing ambient guard | TC-BOUNDARY-001, TC-BOUNDARY-002, TC-EXIT-003, TC-REDACT-004 |
| Forbidden-literal and content-inventory invariants | `bun run scripts/checks/forbidden-literals.ts`; `bun test tests/structure` | existing check + registry; `tests/structure/content-inventory.test.ts` + `inventory.json` (update) | TC-BOUNDARY-003, TC-BOUNDARY-004, TC-BOUNDARY-005 |
| Aggregate and non-regression | `pnpm check`; `bash scripts/.tests/test-*.sh`; `bash tools/.tests/test-*.sh` | repo root; unchanged bash suites | TC-BOUNDARY-005, TC-SYNC-006 |
| Manual contract review | PR review record | — | TC-REVIEW-001 |

A new `tests/golden/` layer is introduced because the ticket's first AC names golden tests explicitly; the testing strategy's `tests/{layer}/*.test.ts` convention permits it and `bun test` at the root discovers it (`bunfig.toml` root discovery, fixtures never named `*.test.ts`).

### 4.1 Golden-Test Contract

Goldens are only useful if they are stable and honest. The binding contract:

1. **Injected determinism.** Every golden is captured by invoking `runCli(argv, streams, deps)` with a fixed injected clock (an ordered tick sequence), a fixed injected `runId`, a synthetic `BrandIdentity`, and a synthetic command program. Because every dynamic value is injected, goldens are asserted **byte-exactly**; no normalization or masking step is permitted (a normalization step would hide exactly the drift goldens exist to catch).
2. **Fixture layout.** One directory per case under `tests/fixtures/result/envelopes/{case}/` (†): `argv.json`, `injected.json` (clock ticks, runId, brand identity, command program id), `stdout.json` (the golden machine output), optional `stderr.txt` (expected human diagnostics; absent means "stderr empty"), and `meta.json` (`outcome`: `success` | `classified-failure` | `unknown-failure` | `broken-invocation`; `secrets`: whether planted secret material is present and where). Cases are discovered from disk; a case with no golden fails rather than being skipped.
3. **Machine-channel assertion.** `stdout` must parse as exactly one JSON document: no leading/trailing non-whitespace bytes, no second document, no enveloped diagnostics. The trailing newline policy is asserted exactly (one trailing `\n`), so a later writer cannot silently change the channel.
4. **Dynamic-field assertion.** In addition to the byte-exact goldens, one suite asserts *shape* of `runId` and `timing` when the **production** defaults at the edge are used (non-empty opaque string; numeric duration in the declared unit) — because production defaults are not covered by injected goldens.
5. **Golden update discipline.** A golden changes only with a deliberate contract change recorded in the plan revision log or the PR description. No `--update`/auto-accept path may exist in CI or in the aggregate chain; TC-BOUNDARY-005 asserts its absence.
6. **Fixture hygiene.** Goldens contain no product token, no host path, no username, no timestamp, no real credential. Planted secrets are obviously fake and carry the marker prefix `planted-fake-` (TC-BOUNDARY-004).

### 4.2 Envelope Conformance Validator (testkit)

`@delivery-os/testkit` gains a dev-only envelope conformance helper (†`assertEnvelopeContract`) plus a golden loader. The helper takes **parsed JSON** and returns violations; it must import only `@delivery-os/core` / `@delivery-os/core/contracts` types and **never** `@delivery-os/cli` (the existing `testkit-no-surface-import` boundary rule forbids it — tests pass data in, they do not hand the helper a CLI object).

The helper exports its rule list (`RULES`) with stable rule ids, and every rule must be exercised by at least one negative case in TC-RESULT-006. This is what keeps the validator from silently degrading into "parses as JSON, therefore valid": rule coverage is asserted as a bijection between declared rules and negative cases.

### 4.3 Determinism and No-Spawn Proof

"Zero spawned processes" and "identical input ⇒ identical output" are proven three ways, because each alone is weak:

1. **Runtime guard (primary).** Contract and golden suites install a guard that throws if `Bun.spawn`, `Bun.spawnSync`, `node:child_process` (`exec*`/`spawn*`/`fork`), `process.exit`, or a write to `process.stdout`/`process.stderr` occurs during a `runCli` invocation. The guard is *self-tested*: a meta-test performs one forbidden call and asserts the guard throws (an unproven guard is an unproven guarantee).
2. **Static assertion (corroboration).** AST assertion that the delivered surface modules (`cli/src/index.ts`, the serialization module, the classification module, the projection module) and every new test file contain no child-process import, no `Bun.spawn*`, and no `process.exit`.
3. **Identity/measurement injection (determinism).** Determinism is asserted with injected clock facts and injected `runId`. The same argv/stdout/stderr buffers/clock/id produce byte-identical stdout, stderr, and exit code across repeated runs and across shuffled execution order. An anti-vacuity control asserts that a *different* argv produces different bytes (so "identical output" is not satisfied by constant output), and a clock/randomness stub that throws proves no ambient time or randomness is read.

### 4.4 Error-Table Sync Contract (binding for AC-F8-1, NFR-6)

The invariant check `scripts/checks/error-table-sync.ts` (†name, †path; delivery may bind different names) reads the machine-readable table from the `core ./contracts` surface and validates three surfaces against it:

| Surface | Content scanned | Assertion |
|---------|------------------|-----------|
| S1 — code | `packages/cli/src/**`, `packages/core/src/contracts/**` (excluding the table module itself) | every recognized code-like literal resolves to exactly one entry |
| S2 — documentation | the documented table at `doc/spec/features/feature-result-contract.md`, authored in-change (GAP-1/OQ-T1 resolved) | every entry appears exactly once; every documented row resolves to exactly one source entry; malformed rows fail, never skip |
| S3 — fixtures | `tests/fixtures/result/**` (excluding `code-corpora/**`, which is the Level C input below) and other error fixtures intended as code references | every recognized code-like literal resolves to exactly one entry |

The S2 artifact ships in this change: authored during delivery as part of this change, derived from the machine-readable source. Phase 7 reconciles and completes the surrounding feature doc but does not rewrite the documented table section, which remains the sync-checked surface from merge time onward (GAP-1/OQ-T1 resolved; TC-SYNC-003 fails closed if the table section is missing or unparseable).

**Recognizer levels.** Recognition is deliberately level-scoped, because one rule cannot simultaneously be a low-noise tree scan and a strict identity validator:

- **Level A — scan-level recognition (S1 source, S3 delivered tree).** A literal is *recognized* when it matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$` (three or more lowercase segments) **and** its first segment is a declared domain kind, plus the two fixed containment identifiers `fallback.invocation` and `fallback.internal` (two segments; the reserved `fallback` namespace, DEC-13), which are always recognized. A dotted code-like literal whose first segment is neither a declared domain kind nor the reserved `fallback` namespace is **ignored** at this level — not recognized, not an error, not counted. That namespace qualifier is what keeps reserved schema names (`delivery.result.v1`, `delivery.event.v1`, `delivery.metric.v1`), versions, dotted filenames, hostnames, and foreign-namespace identifiers out of the scan. A *recognized* literal that is not declared fails, naming code, surface, and line; any `fallback.*` literal other than the two DEC-13 identifiers is recognized by the reserved namespace and is therefore unresolvable → fails.
- **Level B — strict source validation.** The entries of the machine-readable table are validated directly (not by scanning): every entry's code is well-formed (three or more segments, or one of the two DEC-13 identifiers), its namespace segment is declared (a declared domain kind, or `fallback` for exactly those two identifiers), the whole code is unique, and no required row field is missing. Failures name the entry and its position. This is where malformed, foreign-namespace, and duplicate *entries* fail, regardless of whether any call site references them.
- **Level C — direct corpus input.** The true/false-positive corpus at `tests/fixtures/result/code-corpora/` is fed to the check **explicitly** (a corpus path argument or exported entry point used by the mutation suite), not discovered by the S1/S3 tree walk; `tests/fixtures/result/code-corpora/**` is accordingly excluded from S3. The delivered-state invocation passes the corpus path by name (its default input), so the Level C verdicts are part of the green run, while the S1/S3 walk never reads that directory. Justification: the corpora are deliberately adversarial rows that a green delivered state must not treat as references — the true-positive corpus intentionally contains codes with no table entry — so walking them as delivered files would make the green path unreachable, while feeding them explicitly keeps both precision directions testable without weakening S3 coverage of real fixtures. Each corpus row declares its expectation (`recognized`, `resolves`); the check must produce exactly that verdict for every row and fail, naming corpus file and row, on any mismatch.

**Test sources are outside the scan.** `tests/**/*.test.ts` source files sit outside S1 and S3: their code literals are runtime-resolved by the suites themselves (a test may deliberately assert an unresolvable or malformed code to prove a failure), so scanning them would manufacture false drift. AC-F8-1's "referenced in code" is satisfied by S1 plus Level B (the source table) plus Level C (the corpora) — not by scanning test sources.

**Required assertions**: code uniqueness; format validity; namespace validity; bijection between table entries and documented rows; totality over declared domain kinds; deterministic resolution; per-level counts reported (S1/S3 recognized references, source entries, documented rows, corpus rows) so an ignored-literal change or an empty feed cannot pass silently. **Failure discipline**: exit non-zero, name the offending code, the surface (or corpus file and row), and the line; fail closed when the documented table is missing, empty, or unparseable (a vacuous green is a failure). **CI**: invoked by name from an existing `ts-*` job (`ts-invariants` step list) — no new job, no change to `TS_JOBS`; the wiring rule in `ci-topology.ts` and the bypass scan in `ci-bindingness.ts` both stay green.

### 4.5 Redaction Proof Contract

The "secrets never appear" guarantee is testable only against a declared secret set, so the plan binds it:

1. **Input**: the runtime-aware edge registers the secret values it knows (secret values are environment-sourced per man-page v0; secrets are never written to config). The serialization chokepoint receives that registered set and transforms every registered occurrence (item 2) before a byte reaches a stream.
2. **Replacement is per registered value, contiguous (plan D1).** Each registered value is replaced with the fixed placeholder `[redacted]` wherever it occurs — as a whole string value, as an object key, and as a substring embedded in a larger string (URL/DSN), at any nesting depth. The chokepoint never stitches adjacent fields together, so a secret *split* across two adjacent strings is in the guarantee only when each fragment is itself a registered value; TC-REDACT-003's split case registers its fragments and expects `[redacted]` at each fragment position, so that case proves multi-fragment objects, not substring matching across field boundaries. A marker-prefix or value-pattern heuristic is deliberately not adopted at v1 (item 6, GAP-3).
3. **Assertion**: for every planted value, the marker prefix `planted-fake-` occurs **zero times** in the raw and unescaped-decoded bytes of both streams, for every outcome class; for the split case, zero occurrences of each registered fragment are asserted as well, and the byte-exact golden carries `[redacted]` at each planted position (which is the vacuity control for fragments too short to contain the marker). Zero occurrences of the marker is deliberately stricter than "the exact string is gone" and catches embedded, escaped, and nested forms.
4. **Vacuity control**: a temp-copy serializer with the chokepoint disabled must leak the marker and make the assertion fail. Without this control the suite can pass because the fixture never carried the secret.
5. **Over-redaction guard**: a payload containing realistic-but-non-secret values must round-trip byte-identically, proving redaction is targeted, not a blanket scrub that destroys the payload.
6. **Documented limitation**: values not registered at the edge are out of the guarantee (GAP-3), and that includes fragments of a secret that were never registered as values. This is recorded rather than papered over; a value-pattern or prefix heuristic is not required at v1.

### 4.6 Exit-Code Literal Contract (binding for AC-F4-1, NFR-7)

The invariant check `scripts/checks/exit-code-literals.ts` (†name, †path) scans the command-surface tiers (`packages/cli/src/**` and the other surface packages) for exit-code constants outside the single projection module:

- forbidden: numeric assignment to an `exitCode` property outside the projection module; `process.exit(n)` anywhere in the delivered surface; a numeric literal other than 0/1/2 in any projection table; a hardcoded exit code in a command module;
- permitted: the digits inside the single projection module (the projection map), and numeric values inside `tests/**` (out of scan scope, and tests legitimately assert numbers);
- failure: exit non-zero naming file, line, and literal; read-only over the tree.
- Mutation proof required: each forbidden form must have a mutation case in `tests/checks/exit-code-literals.test.ts`; the control (projection module) must stay clean.

### 4.7 Pass/Fail Thresholds and CI vs Local

| Suite | Command | Pass threshold | CI | Local |
|-------|---------|----------------|----|-------|
| Envelope/table/classification/projection unit + structure | `bun test tests/structure tests/behaviour` | 100% pass; 0 skipped/todo/only in new suites; validator rule↔negative-case bijection complete | `ts-test` (`pnpm test`), `ts-exports` (`bun test tests/structure`), `ts-aggregate` | Required before hand-off |
| Golden suites | `bun test tests/golden` | 100% of discovered cases byte-match; 0 unparseable stdout; 0 secret-marker occurrences; 0 case without a golden | `ts-test`, `ts-aggregate` | Required before hand-off |
| Sync invariant | `bun run scripts/checks/error-table-sync.ts` | exit 0 on delivered state; reported counts non-zero; 100% of drift mutations exit non-zero naming the offender; ≥1 case per drift direction | `ts-invariants`, `ts-aggregate` | Run before push |
| Exit-literal invariant | `bun run scripts/checks/exit-code-literals.ts` | exit 0 on delivered state; 100% of forbidden-form mutations fail; control clean | `ts-invariants`, `ts-aggregate` | Run before push |
| Boundary suite | `bun test tests/boundaries` | 0 violations; every new rule has ≥1 failing fixture and ≥1 clean control; fixture-coverage meta-check green | `ts-boundaries`, `ts-aggregate` | Run when touching rules |
| Ambient/forbidden-literal invariants | `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/forbidden-literals.ts` | exit 0 on delivered state; 5/5 scan classes intact; 0 tokens | `check:boundaries`, `ts-forbidden-literals`, `ts-aggregate` | Run before push |
| Regression | `pnpm check`; `bash scripts/.tests/test-*.sh`; `bash tools/.tests/test-*.sh` | all green; `ci.yml` additions-only; `TS_JOBS` unchanged; no new dependency | `ts-aggregate`, bash jobs, topology/bindingness/supply-chain | Final local verification |

CI cost is additive only inside existing jobs (no new job topology). Soft target: the added golden, sync, and invariant suites complete in well under a minute on `ubuntu-latest`; this is an operational note, not a gate. All suites are hermetic — no network, no git history dependency, no writes to the live tree.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Tier | Suite location | Priority | AC coverage |
|-------|-------|------|----------------|----------|-------------|
| TC-RESULT-001 | Envelope field contract and data/error exclusivity | unit | `tests/structure/result-contract.test.ts` (†) | High | AC-F1-1, DM-1, NFR-3 |
| TC-RESULT-002 | Success envelope golden under `--json` | golden | `tests/golden/envelope-success.test.ts` (†) | High | AC-F1-3, AC-F1-1, NFR-2 |
| TC-RESULT-003 | Classified-failure envelope golden with timing | golden | `tests/golden/envelope-failure.test.ts` (†) | High | AC-F1-2, AC-F6-2, AC-F3-1 |
| TC-RESULT-004 | Timing present and measured on all four paths | golden | `tests/golden/timing.test.ts` (†) | High | AC-F1-2, NFR-4 |
| TC-RESULT-005 | `schemaVersion` fixed and brand-neutral; `runId` opaque and edge-generated | unit | `tests/structure/result-contract.test.ts` (†) | High | AC-F1-1, DM-1, NFR-1 |
| TC-RESULT-006 | Envelope conformance validator is rule-complete and not vacuous | unit | `tests/structure/result-contract.test.ts` (†) + testkit (†) | High | NFR-2, NFR-3 |
| TC-TABLE-001 | Every table entry carries the full row shape | unit | `tests/structure/error-table.test.ts` (†) | High | AC-F2-2, DM-3, NFR-7 |
| TC-TABLE-002 | Fallback entries: consequence `unknown`, fixed DEC-13 fields, `unknown` reserved | unit | `tests/structure/error-table.test.ts` (†) | High | AC-F3-2, DM-3 |
| TC-TABLE-003 | App error code identity: format, uniqueness, single resolution | unit | `tests/structure/error-table.test.ts` (†) | High | AC-F3-1, DM-4 |
| TC-TABLE-004 | Table declared once as runtime-neutral data; `Result` unchanged | unit | `tests/structure/error-table.test.ts` (†) | High | AC-F2-1, DM-1, DM-3, NFR-1 |
| TC-CLASSIFY-001 | Classification chain is total and deterministic | unit | `tests/behaviour/error-classification.test.ts` (†) | High | AC-F3-1, DM-4 |
| TC-CLASSIFY-002 | Unclassifiable and non-`Error` failures contain to `fallback.internal`; broken invocations to `fallback.invocation` | unit | `tests/behaviour/error-classification.test.ts` (†) | High | AC-F3-2, AC-F6-2 |
| TC-EXIT-001 | Projection is exhaustive, total, and confined to {0,1,2} | unit | `tests/behaviour/exit-projection.test.ts` (†) | High | AC-F4-1, NFR-7 |
| TC-EXIT-002 | No exit-code literal at any call site | invariant-check | `scripts/checks/exit-code-literals.ts` (†) + `tests/checks/exit-code-literals.test.ts` (†) | High | AC-F4-1, NFR-7 |
| TC-EXIT-003 | Exit-code projection exists only in the standalone CLI | boundary-fixture | `tests/behaviour/exit-projection.test.ts` (†) + boundary suite | High | AC-F4-1, F-4 |
| TC-RUNCLI-001 | `runCli` runs in-process, returns the exit code, spawns nothing | unit | `tests/behaviour/run-cli.test.ts` (†) | High | AC-F5-1, AC-F5-2, NFR-8 |
| TC-RUNCLI-002 | Determinism: identical argv + streams + clock facts ⇒ identical output | unit | `tests/behaviour/run-cli.test.ts` (†) | High | AC-F5-2, NFR-8 |
| TC-RUNCLI-003 | Channel split: machine envelope on stdout, diagnostics on stderr | golden | `tests/golden/broken-command.test.ts` (†) | High | AC-F6-2, AC-F5-1, NFR-2 |
| TC-RUNCLI-004 | Brand-dependent strings arrive as `BrandIdentity` parameters at the edge | negative-fixture | `tests/structure/cli-edge-seam.test.ts` (†) + boundary suite | High | AC-F9-1, NFR-9 |
| TC-CONTAIN-001 | Broken-invocation goldens: valid envelope, no crash, `fallback.invocation` fields, exit 1 | golden | `tests/golden/broken-command.test.ts` (†) | High | AC-F6-1, NFR-2 |
| TC-CONTAIN-002 | No stack traces or raw diagnostics on the machine channel | golden | `tests/golden/envelope-failure.test.ts` (†) | High | AC-F6-2 |
| TC-CONTAIN-003 | Hostile command bodies cannot escape containment | negative-fixture | `tests/golden/broken-command.test.ts` (†) | High | AC-F6-1, AC-F6-2 |
| TC-REDACT-001 | Planted secret in a success payload never reaches a stream | golden | `tests/golden/redaction.test.ts` (†) | High | AC-F7-1, NFR-5 |
| TC-REDACT-002 | Planted secret in a failure error object never reaches a stream | golden | `tests/golden/redaction.test.ts` (†) | High | AC-F7-1, NFR-5 |
| TC-REDACT-003 | No-partial-leak sweep across forms, nesting, and encodings | golden | `tests/golden/redaction.test.ts` (†) | High | AC-F7-1, NFR-5 |
| TC-REDACT-004 | Single serialization chokepoint; no other stream write path | boundary-fixture | `tests/structure/cli-edge-seam.test.ts` (†) + boundary suite | High | AC-F7-2, NFR-5 |
| TC-SYNC-001 | Delivered state is bidirectionally consistent and non-vacuous | invariant-check | `scripts/checks/error-table-sync.ts` (†) | High | AC-F8-1, NFR-6 |
| TC-SYNC-002 | Drift A: referenced/emitted code without an entry fails | negative-fixture | `tests/checks/error-table-sync.test.ts` (†) | High | AC-F8-1 |
| TC-SYNC-003 | Drift B: documented entry missing from the source fails | negative-fixture | `tests/checks/error-table-sync.test.ts` (†) | High | AC-F8-1 |
| TC-SYNC-004 | Drift C: source entry missing from the documented table fails | negative-fixture | `tests/checks/error-table-sync.test.ts` (†) | High | AC-F8-1 |
| TC-SYNC-005 | Identity hygiene: duplicates, malformed codes, false-positive corpus | negative-fixture | `tests/checks/error-table-sync.test.ts` (†) | Medium | AC-F8-1, DM-4 |
| TC-SYNC-006 | Sync check binds in the existing CI fast loop | invariant-check | `scripts/checks/error-table-sync.ts` (†) + `tests/checks/ci-checks.test.ts` | High | AC-F8-1, NFR-6, NFR-10 |
| TC-BOUNDARY-001 | Contracts tier stays runtime-neutral for the new files | boundary-fixture | `tests/structure/error-table.test.ts` (†) + ambient suite | High | AC-F2-1, NFR-1 |
| TC-BOUNDARY-002 | Tier matrix green; every new forbidden rule has a failing fixture | boundary-fixture | `tests/boundaries/**` (update) | High | AC-F9-1, AC-F7-2, NFR-10 |
| TC-BOUNDARY-003 | Forbidden-literal scan green; brand values only from parameters | invariant-check | `scripts/checks/forbidden-literals.ts` (existing) | High | AC-F9-1, NFR-9 |
| TC-BOUNDARY-004 | Fixture hygiene: brand-neutral fixtures, fakes only, no product tokens | unit | `tests/structure/result-fixtures.test.ts` (†) | High | NFR-9, NFR-5 |
| TC-BOUNDARY-005 | No regression, no gate weakening, no bypass, inventory updated deliberately | invariant-check | `pnpm check` + `tests/checks/ci-checks.test.ts` + `tests/structure/content-inventory.test.ts` | High | AC-F9-1, NFR-10 |
| TC-REVIEW-001 | Manual contract review: hint quality, evolution discipline, gate integrity | manual | PR review record | Medium | AC-F7-2, AC-F9-1 |

### 5.2 Scenario Details

#### TC-RESULT-001 - Envelope field contract and data/error exclusivity

**Scenario Type**: Happy Path / Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-3
**Test Type(s)**: Unit / Contract
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/result-contract.test.ts` (†) + `packages/testkit/src/result-conformance.ts` (†)
**Tags**: @contracts, @envelope, @result-contract

**Preconditions**:

- The four delivered outcome goldens exist (success, classified failure, unknown failure, broken invocation).
- The testkit conformance helper accepts parsed JSON.

**Steps**:

1. Assert the success envelope's top-level key set is exactly `{schemaVersion, runId, exitCode, timing, data}` — the `error` key is absent, not `undefined`-valued.
2. Assert the failure envelope's key set is exactly `{schemaVersion, runId, exitCode, timing, error}` — the `data` key is absent.
3. Assert rejection: envelope with both `data` and `error`; envelope with neither; envelope missing each of `schemaVersion`, `runId`, `exitCode`, `timing` in turn. Each rejection names the offending field.
4. Assert void success: a synthetic command returning no payload yields an envelope where `data` is present and equals the plan-bound empty payload `{}` (A-T2), and `error` is absent.
5. Assert the v1 top-level key set is recorded in the conformance fixture: an unexpected sixth top-level key fails until the fixture is deliberately updated (additive evolution is a reviewed act, DEC-9).

**Expected Outcome**:

- Exactly one of `data`/`error` is present on every envelope; all four mandatory fields are always present.
- A void success is an explicit empty payload, never an ambiguous both-absent shape.
- A shape change cannot land silently: it fails a recorded key-set assertion.

#### TC-RESULT-002 - Success envelope golden under `--json`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-3, AC-F1-1, DM-1, NFR-2
**Test Type(s)**: Golden
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/envelope-success.test.ts` (†) + `tests/fixtures/result/envelopes/success-data/**` (†), `success-void/**` (†)
**Tags**: @golden, @envelope, @json

**Preconditions**:

- Injected clock ticks, injected `runId`, synthetic `BrandIdentity`, and synthetic commands (one data-bearing, one void) are recorded in each case's `injected.json`.
- The no-spawn/no-exit guard (§4.3) is installed.

**Steps**:

1. Run `runCli(["--json", "synthetic.ok"], streams, deps)` with injected streams.
2. Assert the returned exit code is `0` and the envelope's `exitCode` is `0`.
3. Assert stdout parses as exactly one JSON document and is byte-equal to `stdout.json`, including the single trailing newline.
4. Assert `schemaVersion` is `delivery.result.v1`, `runId` equals the injected value, and `timing` equals the injected measured delta.
5. Assert the `data` payload equals the fixture payload; assert `error` key absent.
6. Assert stderr is empty for this case (absent `stderr.txt` means empty, §4.1).
7. Assert the golden contains no product token, absolute path, timestamp, username, or real credential.

**Expected Outcome**:

- The success path emits one valid envelope with all prescribed fields and exit code 0, matching the golden byte-for-byte.
- Neither channel carries anything but the contracted output.

#### TC-RESULT-003 - Classified-failure envelope golden with timing

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-3, F-6, AC-F1-2, AC-F6-2, AC-F3-1, DM-2, NFR-4
**Test Type(s)**: Golden / Contract
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/envelope-failure.test.ts` (†) + `tests/fixtures/result/envelopes/classified-user/**`, `classified-platform/**` (†)
**Tags**: @golden, @failure, @timing

**Preconditions**:

- Two synthetic commands raise errors whose declared domain kinds map to one `user-validation` entry and one `platform-provider` entry.

**Steps**:

1. Run each case under `--json` with injected clock/id.
2. Assert stdout is one JSON document, byte-equal to the case golden.
3. Assert the `error` object equals the resolved entry's projection: `code`, `category`, `retryable`, `consequence`, `remediationHint`, and `summary` only if the entry declares one. No extra error keys, no raw thrown message.
4. Assert `exitCode` is `1` for `user-validation` and `2` for `platform-provider`, and equals the returned exit code.
5. Assert `timing` is present and equals the injected measured delta (same as success path).
6. Assert `data` is absent in both cases.

**Expected Outcome**:

- Failed runs are as trustworthy as successful ones: one valid envelope, table-derived error identity, projected exit code, timing present.
- The error object is a pure table projection — no call-site embellishment.

#### TC-RESULT-004 - Timing present and measured on all four paths

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-4
**Test Type(s)**: Golden / Unit
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/timing.test.ts` (†) + `tests/fixtures/result/envelopes/*/injected.json`
**Tags**: @golden, @timing, @envelope

**Preconditions**:

- The injected clock reports a start tick and an end tick per case; four cases use distinct deltas (success 13 ms, classified failure 7 ms, unknown failure 0 ms, broken invocation 2 ms — units bound by delivery).

**Steps**:

1. Run all four outcome classes with their injected deltas.
2. Assert `timing` is present in all four envelopes and equals the corresponding delta.
3. Re-run each case with a different injected delta and assert the envelope's timing changes accordingly (proves measurement, not a constant).
4. Assert the `0` delta case emits a present zero, never an omitted or `null` timing.
5. Assert the declared unit and shape are identical across success and failure paths.

**Expected Outcome**:

- `timing` reflects the measured run duration on every path, including the failure paths.
- No path can omit timing; no path can hardcode it.

#### TC-RESULT-005 - `schemaVersion` fixed and brand-neutral; `runId` opaque and edge-generated

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-1, DEC-8
**Test Type(s)**: Unit / Structure
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/result-contract.test.ts` (†); `packages/core/src/contracts/**`, `packages/cli/src/index.ts` (†)
**Tags**: @contracts, @envelope, @branding-firewall

**Preconditions**:

- DEC-8 fixes `schemaVersion` at `delivery.result.v1` and places `runId` generation at the runtime-aware edge.

**Steps**:

1. Assert `schemaVersion` is exactly `delivery.result.v1` in all four outcome goldens.
2. Assert the value is brand-neutral (contains no product token, follows the reserved schema-name lineage `delivery.` + area + `.v` + version) and is declared exactly once, then consumed by the CLI rather than duplicated as a literal.
3. Assert `runId` is present, non-empty, opaque (no whitespace/control characters), and equals the injected value.
4. Run twice with distinct injected ids and assert the `runId` values differ while every other field is identical.
5. Assert the contracts modules contain no id/clock facility: no `randomUUID`, `Date.now`, `Math.random`, `crypto`, or timer usage (AST), and the ambient guard does not need an exception for these files.
6. Assert generation lives at the edge: the surface module (or its injected-deps type) is the only place a default id is produced.

**Expected Outcome**:

- `schemaVersion` is a fixed, brand-neutral, single-declared value.
- `runId` is always present, opaque, and produced at the edge — never inside runtime-neutral contracts.

#### TC-RESULT-006 - Envelope conformance validator is rule-complete and not vacuous

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-1, NFR-2, NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/result-contract.test.ts` (†) + `packages/testkit/src/result-conformance.ts` (†)
**Tags**: @testkit, @envelope, @mutation-proof

**Preconditions**:

- The helper exports its rule list (`RULES`) and each negative case declares the rule it targets.

**Steps**:

1. Assert the helper accepts all four delivered goldens with zero violations.
2. For each negative case (missing `schemaVersion`; missing `runId`; missing `exitCode`; missing `timing`; both `data` and `error`; neither; `exitCode: 3`; error missing `consequence`; `consequence: "maybe"`; `category: "other"`) assert the helper reports a violation naming the offending field and the matched rule id.
3. Assert a bijection between declared rule ids and negative cases tagged with them: a rule with no negative case fails the suite, and a negative case naming an undeclared rule fails too.
4. Assert the helper refuses to treat an empty object or a non-object as a valid envelope.
5. Assert the helper imports no `@delivery-os/cli` surface (boundary rule green) and takes plain parsed JSON.

**Expected Outcome**:

- The validator's rules are load-bearing: removing a rule or losing a case is itself a test failure.
- The golden suites cannot degrade into "it parsed as JSON, therefore it is a valid envelope".

#### TC-TABLE-001 - Every table entry carries the full row shape

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-2, AC-F3-2, DM-3, NFR-7
**Test Type(s)**: Unit / Contract
**Automation Level**: Automated (structural) with a manual phrasing note (see TC-REVIEW-001)
**Tier**: unit
**Target Layer / Location**: `tests/structure/error-table.test.ts` (†); table read through the `core ./contracts` surface
**Tags**: @contracts, @error-table

**Preconditions**:

- The table is exported from the `core ./contracts` surface as data.

**Steps**:

1. Assert the table is non-empty and every entry declares: `code`, `domainKind`, `category`, `retryable`, `consequence`, `remediationHint`, `projectionClass`, and optional `summary` with the declared types.
2. Assert `category ∈ {user, platform, transient, permanent}` and `consequence ∈ {landed, not_landed, unknown}` for every entry; `retryable` is a boolean; `projectionClass ∈ {success, user-validation, platform-provider}` and exactly one per entry.
3. Assert every `remediationHint` is a non-empty string and every `summary`, when present, is a non-empty string; assert no entry carries a hint or summary containing a secret-shaped fixture value.
4. Assert every entry states `consequence` explicitly — no optional/absent value — which is what makes "mutation-bearing entries state consequence explicitly" (AC-F3-2, second clause) structurally true for all entries, including both fallback entries (DEC-13).
5. Assert entry count is reported so a silently emptied table fails a non-vacuity assertion.

**Expected Outcome**:

- No entry can exist with a missing or mistyped column (NFR-7's "entries without exactly one projection class" is 0).
- Hint phrasing quality is not asserted mechanically; it is a review item (TC-REVIEW-001).

#### TC-TABLE-002 - Fallback entries: consequence `unknown`, fixed DEC-13 fields, `unknown` reserved

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-2, AC-F6-1, DM-3, DEC-5, DEC-7, DEC-13
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/error-table.test.ts` (†) + `tests/fixtures/result/unknown-consequence-allowlist.json` (†)
**Tags**: @contracts, @error-table, @containment

**Preconditions**:

- The table exposes the two named fallback codes `fallback.invocation` and `fallback.internal` (DEC-13, A-T1, A-T11).
- An allowlist fixture records every non-fallback entry permitted to use `consequence: unknown`.

**Steps**:

1. Assert exactly one entry has each fallback code (`fallback.invocation`, `fallback.internal`), and that no third containment entry exists.
2. Assert both fallback entries carry `consequence: unknown`, `retryable: false`, and the DEC-13 projection classes: `fallback.invocation` is category `user`, projection class `user-validation` (→ exit 1) with a non-empty caller-directed hint; `fallback.internal` is category `platform`, projection class `platform-provider` (→ exit 2) with a non-empty hint directing the caller to diagnostics.
3. Assert each fallback entry's `category` and `retryable` equal the spec-fixed DEC-13 values and are enum-valid (the values are no longer delivery decisions).
4. Assert every other entry using `consequence: unknown` appears in the allowlist fixture; both fallback entries are the baseline and are excluded from it. Adding a new `unknown` entry outside the allowlist fails the suite by name (RSK-7: `unknown` must not become a lazy default).
5. Assert each fallback code resolves to its own entry through the normal resolution path (no special-case bypass).

**Expected Outcome**:

- Exactly two containment entries exist — one per containment population — with `unknown` consequence, DEC-13 fields, and caller-directed/ diagnostics-directed hints, and both are reachable through ordinary resolution.
- `unknown` cannot spread silently: each additional use is a reviewed allowlist entry.

#### TC-TABLE-003 - App error code identity: format, uniqueness, single resolution

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-4, NFR-6
**Test Type(s)**: Unit / Contract
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/error-table.test.ts` (†)
**Tags**: @contracts, @error-code, @identity

**Preconditions**:

- The table is imported through the `core ./contracts` surface.

**Steps**:

1. Assert every code matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$` (three or more lowercase dotted segments) — the `domain.reason.detail` shape of DM-4, with the spec example `provider.quota.exceeded` as the declared exemplar (also a true-positive row of the Level C corpus, §4.4) — except the two spec-fixed containment identifiers `fallback.invocation` and `fallback.internal` (DEC-13), which are the declared two-segment exception (A-T11).
2. Assert codes are unique across the table.
3. Assert the resolution index is total (every code resolves) and functional (each code resolves to exactly one entry; no two codes resolve to the same entry).
4. Assert negative identity forms are rejected: numeric-only (`404`), two-segment non-fallback (`provider.quota`), uppercase, leading digit, URI (`https://…`), and HTTP-status-shaped (`HTTP_404`), and any `fallback.*` literal other than the two DEC-13 identifiers.
5. Assert resolution distinguishes "not found" from "fallback containment" — an unknown code is reported as unresolvable, so a caller must apply the documented containment explicitly rather than have silent containment hide a typo.

**Expected Outcome**:

- Identity is stable, symbolic, hierarchical, unique, and singly resolvable.
- A code that cannot be resolved is surfaced as such; containment is a deliberate step, not a blanket lookup default.

#### TC-TABLE-004 - Table declared once as runtime-neutral data; `Result` unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-8, AC-F2-1, DM-1, DM-3, NFR-1
**Test Type(s)**: Unit / Structure
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/error-table.test.ts` (†); `packages/core/src/contracts/**`
**Tags**: @contracts, @single-source, @runtime-neutral

**Preconditions**:

- The contracts subpath resolves through `packages/core/src/contracts/index.ts`.

**Steps**:

1. Assert the table is declared exactly once: one module owns the entries; every other consumer imports it. Assert no second declaration in `packages/cli/**` and no entry-shaped literal set in `tests/fixtures/**` (fixtures may reference codes, not declare entries).
2. Assert the contracts modules' statements are declarations only — type aliases, interfaces, and `as const` data — with no function bodies for classification, projection, serialization, or redaction.
3. Assert the contracts modules import nothing from `node:*`/`bun:*` and have no runtime-API dependency (`runtime-apis-confinement` green for those files).
4. Assert `Result<T, E>` is still declared with its existing shape (recorded structural expectation fixture) and `CommandResult` is a separate declaration referencing it in its doc comment/relationship, not a replacement.
5. Assert the generic `Result` is not imported by the projection or serialization modules as the command-surface type (the envelope is the surface type).

**Expected Outcome**:

- One machine-readable source of truth, data-only, in the runtime-neutral tier.
- `Result<T, E>` remains the internal computation result; `CommandResult` is the command-surface envelope (DEC-1).

#### TC-CLASSIFY-001 - Classification chain is total and deterministic

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F3-1, DM-4, NFR-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts` (†)
**Tags**: @classification, @error-code

**Preconditions**:

- Declared domain kinds are exported as a const set (A-T1) so the test can enumerate them.

**Steps**:

1. Enumerate every declared domain kind.
2. Resolve each kind → assert it yields exactly one entry and one code; assert the code resolves back to that same entry (round-trip) and is never either containment entry (`fallback.invocation`, `fallback.internal`, DEC-13).
3. Assert the resolved error object takes `category`, `retryable`, `consequence`, and `remediationHint` from the entry with no per-call-site override (a mutation that passes an override is rejected by the type or by the resolver assertion).
4. Assert the code is symbolic and hierarchical, and is not numeric, not a URI, and not HTTP-status-coupled.
5. Assert determinism: repeat resolution 10 times per kind and assert identical results.
6. Mutation: a temp copy declaring a domain kind with no mapping fails a structure assertion naming the kind (classification is total over declared kinds).

**Expected Outcome**:

- Every declared domain failure class resolves deterministically to exactly one documented entry, never to a containment entry.
- Adding a domain kind without a classification is a test failure, not a silent default.

#### TC-CLASSIFY-002 - Unclassifiable and non-`Error` failures contain to `fallback.internal`; broken invocations to `fallback.invocation`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-2, AC-F6-2, DM-2, DEC-7, DEC-13
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts` (†)
**Tags**: @classification, @containment, @no-diagnostics

**Preconditions**:

- The synthetic command program can raise arbitrary thrown values.

**Steps**:

1. Raise an error carrying an undeclared domain kind; resolve and assert `fallback.internal` is applied.
2. Raise a thrown string, a thrown `undefined`, and a thrown plain object without a kind; each resolves to `fallback.internal`.
3. Assert the resulting error object has `consequence: unknown`, category `platform`, `retryable: false`, the `platform-provider` projection class (→ exit 2), and a hint directing the caller to diagnostics.
4. Assert the two containment routes are distinct: a broken invocation (no command resolved) yields `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`, → exit 1), never `fallback.internal`; cross-checked by TC-CONTAIN-001. This suite asserts classify-level route distinctness only: the dispatch-level proof (no command resolved → a `fallback.invocation` envelope) is TC-CONTAIN-001 in plan Phase 3.
5. Raise a thrown value whose message contains a stack-like string, an absolute path, and a planted secret marker; assert the envelope carries none of them (only table-derived fields plus an optional non-identifying summary).
6. Assert determinism: identical thrown input yields an identical error object.

**Expected Outcome**:

- No thrown shape can escape classification, no raw thrown content can reach the envelope, and unclassifiable failures never masquerade as caller-fault broken invocations.
- Containment is deterministic and honest: `fallback.internal`, consequence `unknown`, platform-provider, exit 2.

#### TC-EXIT-001 - Projection is exhaustive, total, and confined to {0,1,2}

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-3, NFR-7, Appendix C
**Test Type(s)**: Unit / Contract
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/behaviour/exit-projection.test.ts` (†)
**Tags**: @projection, @exit-code

**Preconditions**:

- The projection accepts a projection class and returns a number.

**Steps**:

1. Assert `success` → `0`, `user-validation` → `1`, `platform-provider` → `2`.
2. For every table entry, assert the projected code is in `{0,1,2}` and equals the mapping of that entry's class.
3. Assert totality over the class enum: every declared class maps, and no input produces a value outside `{0,1,2}` (including unknown/undefined input, which must be rejected rather than defaulted).
4. Assert the success path returns `0` without needing a table entry.
5. Assert purity and determinism: repeated calls return the same value, and the function performs no I/O or environment read (stubbed clock/env that throw).

**Expected Outcome**:

- Exit codes are a total, deterministic projection of table data — nowhere else.
- No numeric diversity beyond `{0,1,2}` is possible.

#### TC-EXIT-002 - No exit-code literal at any call site

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-7
**Test Type(s)**: Invariant / Mutation
**Automation Level**: Automated
**Tier**: invariant-check
**Target Layer / Location**: `scripts/checks/exit-code-literals.ts` (†) + `tests/checks/exit-code-literals.test.ts` (†)
**Tags**: @invariants, @projection, @mutation-proof

**Preconditions**:

- §4.6 is the binding scan contract; the projection module is the only permitted home for the digits.

**Steps**:

1. Run the check on the delivered tree; assert exit 0, a reported scan scope, and a reported file count.
2. Mutation (a): add `exitCode: 2` to a command module in a temp copy → assert non-zero exit naming file, line, and literal.
3. Mutation (b): add `process.exit(1)` to a command module → assert failure.
4. Mutation (c): add a numeric literal `3` to a projection table row → assert failure (out of range).
5. Mutation (d): add `exitCode: derived` inside the projection module → assert clean (the permitted home keeps its digits).
6. Assert the scan's scope boundary explicitly: numbers inside `tests/**` are not scanned, and the report states that scope (so no one assumes test fixtures are policed by this check).
7. Assert the check is read-only (`git status --porcelain` unchanged) and that it is invoked by name from an existing `ts-*` job.

**Expected Outcome**:

- Every forbidden form is proven to fail by mutation, with a message that identifies file, line, and literal.
- The allowed home is explicit, so the check cannot be satisfied by loosening it globally.

#### TC-EXIT-003 - Exit-code projection exists only in the standalone CLI

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-7, NG-4
**Test Type(s)**: Unit / Structure
**Automation Level**: Automated
**Tier**: boundary-fixture
**Target Layer / Location**: `tests/behaviour/exit-projection.test.ts` (†) + `tests/boundaries/**` (update)
**Tags**: @projection, @tiers, @boundary

**Preconditions**:

- The projection module lives under `packages/cli/src/**` (A-T1).

**Steps**:

1. Assert by structure scan that exit-code derivation exists only under `packages/cli/**`; `core` (including `./contracts`) declares projection *classes*, never numbers.
2. Assert `packages/mcp/**`, `packages/opencode/**`, and `packages/adapters/**` neither import the projection module nor contain exit-code derivation; a new boundary rule for it ships with a failing negative fixture and a clean control (or, if expressed as a structure scan, with an equivalent temp-copy mutation).
3. Assert the envelope's `exitCode` is produced by the CLI projection from the resolved class, not read as a numeric field on a table entry.
4. Mutation: a temp copy adding a numeric exit map in `core/src/contracts` fails the structure assertion by name.

**Expected Outcome**:

- The `{0,1,2}` projection exists in exactly one place: the standalone CLI.
- Other surfaces cannot inherit numeric exit semantics by accident.

#### TC-RUNCLI-001 - `runCli` runs in-process, returns the exit code, spawns nothing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-2, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/behaviour/run-cli.test.ts` (†)
**Tags**: @cli, @in-process, @no-spawn

**Preconditions**:

- The guard (§4.3) is available and self-tested.

**Steps**:

1. Install the guard for the test duration.
2. Invoke `runCli(argv, streams, deps)` with injected streams; assert the call returns a numeric exit code and writes nothing to the real process streams.
3. Assert the guard recorded zero violations across all `runCli` invocations in the suite.
4. Run the guard self-test: perform `Bun.spawn` under the guard and assert it throws (the guard is proven, not assumed).
5. Assert statically that the delivered surface modules and every new test file contain no child-process import, no `Bun.spawn*`, and no `process.exit`.
6. Assert a failing command returns non-zero without terminating the test process — the following assertion in the same test still executes.

**Expected Outcome**:

- The command surface is exercised entirely in-process; the returned exit code is the contract.
- "Zero spawned processes" is proven by a working guard plus a static assertion, not by convention.

#### TC-RUNCLI-002 - Determinism: identical argv + streams + clock facts ⇒ identical output

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/behaviour/run-cli.test.ts` (†)
**Tags**: @cli, @determinism

**Preconditions**:

- `runCli` accepts injected clock facts and an injected `runId` source (A-T3).

**Steps**:

1. Run the same argv 5 times sequentially with identical injected streams, clock ticks, and `runId`; assert stdout bytes, stderr bytes, and the returned exit code are identical each time.
2. Run the same case 5 more times interleaved with other cases (fresh buffers, shuffled order); assert identical output.
3. Anti-vacuity control: run a different argv and assert the output differs; assert a different injected `runId` changes only the `runId` field.
4. Install `Date.now`/`performance.now`/`Math.random`/`crypto.randomUUID` stubs that throw; assert `runCli` still completes and produces the same bytes as in step 1 (no ambient time or randomness read).
5. Assert timing derives from the injected clock (a changed injected delta changes only `timing`).

**Expected Outcome**:

- Identical inputs produce byte-identical output, on repeated and interleaved runs.
- Determinism is not an artifact of constant output or of ambient clock reads.

#### TC-RUNCLI-003 - Channel split: machine envelope on stdout, diagnostics on stderr

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F6-2, AC-F5-1, NFR-2, DEC-6
**Test Type(s)**: Golden
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/broken-command.test.ts` (†); every envelope golden case
**Tags**: @golden, @channels, @json

**Preconditions**:

- All five golden suites are discovered; each case declares whether stderr is expected empty.

**Steps**:

1. For every outcome class, assert stdout parses as exactly one JSON document and contains only the envelope (no prefix/suffix, no second document, single trailing newline).
2. Assert no envelope bytes appear on stderr and no diagnostic text appears on stdout (assert stdout contains no `error:`, no stack frame markers, and no human-prose lines).
3. Assert stderr is either empty or human-only free text; assert no case requires stderr to interpret stdout.
4. Assert that removing stderr entirely leaves stdout valid and the exit code unchanged (a machine consumer needs stdout + exit code only).
5. For non-`--json` runs assert only the returned exit code and the internal envelope; assert **nothing** about human stdout shape (NG-5 scope boundary).

**Expected Outcome**:

- One channel carries machine data and it is always valid; the other carries human diagnostics and is never load-bearing.
- A future writer cannot quietly move diagnostics into the machine channel.

#### TC-RUNCLI-004 - Brand-dependent strings arrive as `BrandIdentity` parameters at the edge

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-9, AC-F9-1, NFR-9, DEC-6
**Test Type(s)**: Unit / Structure
**Automation Level**: Automated
**Tier**: negative-fixture
**Target Layer / Location**: `tests/structure/cli-edge-seam.test.ts` (†) + `tests/boundaries/fixtures/cases.ts` (update)
**Tags**: @branding-firewall, @cli, @boundary

**Preconditions**:

- Synthetic `BrandIdentity` values (`example-product`, `.renamed-product`) are provided in `injected.json` fixtures.

**Steps**:

1. Assert the surface receives `BrandIdentity` as a parameter: run `runCli` with a synthetic brand identity and assert any brand-dependent text (usage/help/unknown-command text) reflects the injected value.
2. Assert the CLI commands/output tiers perform no ambient environment read for brand values: AST scan for `process.env`/`Bun.env` in those modules outside the single designated edge module; a violation names file and line.
3. Assert the designated edge module is the only place environment facts are read, and that it receives its reader as an injected dependency (test replaces the reader and observes the effect).
4. Mutation: a temp copy adding a `process.env.SOMETHING` read in a command module fails by name; a control copy reading it only in the designated edge module stays clean.
5. Assert no product-token literal exists anywhere in the new CLI code; every brand string in goldens is synthetic.

**Expected Outcome**:

- Brand values are parameters at the edge; ambient derivation is impossible in the delivered surface.
- The brand firewall from M0-S2 extends to the new CLI surface with its own failing fixture.

#### TC-CONTAIN-001 - Broken-invocation goldens: valid envelope, no crash, `fallback.invocation` fields, exit 1

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F3-2, DM-2, NFR-2, DEC-13
**Test Type(s)**: Golden
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/broken-command.test.ts` (†) + `tests/fixtures/result/envelopes/broken-unknown-command/**`, `broken-unknown-flag/**`, `broken-missing-value/**` (†)
**Tags**: @golden, @containment, @broken-command

**Preconditions**:

- The fixture argv set includes an unknown command, an unknown flag, a missing required value, and conflicting flags.

**Steps**:

1. Run each case under `--json` with injected clock/id.
2. Assert each emits exactly one valid envelope byte-equal to its golden; assert `error` resolves to `fallback.invocation` with category `user`, `retryable: false`, consequence `unknown`, projection class `user-validation`, and a caller-directed hint.
3. Assert the projected and returned exit code is `1` and `timing` is present.
4. Assert no crash, no non-JSON output, no stack trace, no raw parser error object in the envelope.
5. Assert human diagnostics, where present, are on stderr only and are non-empty human text (not a duplicate envelope).
6. Assert the surface returns rather than terminating (the test process continues and asserts).

**Expected Outcome**:

- A broken command is a classified outcome, not a crash: valid envelope, documented `fallback.invocation` entry (category `user`, `retryable: false`, consequence `unknown`), exit 1, timing present.
- This is the ticket's second AC, proven per broken-invocation shape.

#### TC-CONTAIN-002 - No stack traces or raw diagnostics on the machine channel

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DEC-7, DEC-13, DM-2
**Test Type(s)**: Golden / Contract
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/envelope-failure.test.ts` (†)
**Tags**: @golden, @no-diagnostics, @security

**Preconditions**:

- Failure cases cover classified, unknown, and broken outcomes, each raising a value carrying a stack, a path, and a planted marker in its message.
- Each failure case declares its expected entry: the classified entry, `fallback.internal` for unknown failures, `fallback.invocation` for broken invocations (DEC-13).

**Steps**:

1. For every failure case, assert stdout contains no stack-frame markers (`at `, `.ts:`, `.js:`), no absolute paths, no `Error:`/`TypeError:` prefix, and no raw thrown message text.
2. Assert the envelope's `error` contains only contracted keys and table-derived values (plus an optional non-identifying summary); for broken-invocation cases it is `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`), and for unknown failures it is `fallback.internal` (category `platform`, `retryable: false`, consequence `unknown`).
3. Assert any diagnostic text appears only on stderr.
4. Vacuity control: a temp-copy serializer that appends the raw stack to the envelope makes the assertion fail (proving detection).
5. Assert the planted marker in the thrown message never appears on either stream (cross-link to TC-REDACT-002).

**Expected Outcome**:

- Machine consumers never receive an information-disclosure path through error payloads.
- The containment assertion is proven able to detect a leak, not just able to pass.

#### TC-CONTAIN-003 - Hostile command bodies cannot escape containment

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-2, RSK-5, DEC-13
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Tier**: negative-fixture
**Target Layer / Location**: `tests/golden/broken-command.test.ts` (†) + `tests/fixtures/result/programs/**` (†)
**Tags**: @containment, @hostile-inputs

**Preconditions**:

- Synthetic command programs can be injected: synchronous throw, thrown non-`Error`, rejected promise, throw after partial payload assembly, and a handler returning a malformed result.
- The broken-invocation argv corpus from TC-CONTAIN-001 is replayed alongside the hostile programs, so both containment entries are exercised.

**Steps**:

1. Run each hostile program and each broken-invocation case under `--json`.
2. Assert each produces exactly one valid envelope (never two documents, never partial JSON), resolving to the containment entry matching its responsibility: broken invocations → `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`, exit 1); handler-level throws, rejections, and malformed results → `fallback.internal` (category `platform`, `retryable: false`, consequence `unknown`, exit 2).
3. Assert a partial write cannot corrupt the channel: stdout must not begin with a fragment — the serializer writes the envelope in a single pass after the run completes; mutation: a temp-copy serializer that streams partial output fails the assertion.
4. Assert the process survives and the returned code is non-zero.
5. Assert repeated invocations produce identical envelopes (determinism holds on the containment path).

**Expected Outcome**:

- Containment wraps every command execution path, including pathological handlers (RSK-5).
- The always-valid guarantee is a property of the top-level surface, not of cooperative commands.

#### TC-REDACT-001 - Planted secret in a success payload never reaches a stream

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-5, §20 privacy review
**Test Type(s)**: Golden
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/redaction.test.ts` (†) + `tests/fixtures/result/envelopes/secret-success/**` (†)
**Tags**: @golden, @redaction, @security

**Preconditions**:

- Planted values are obviously fake and carry the marker prefix `planted-fake-` (A-T4).
- The edge registers the planted secret set.

**Steps**:

1. Inject a success command whose `data` payload carries the planted value at top level, inside a nested object, inside an array element, and as an object key.
2. Run under `--json`; assert the marker prefix `planted-fake-` occurs zero times in the raw stdout and stderr bytes.
3. Assert the payload shape survives with the secret transformed/removed per the bound policy, and the envelope remains valid and byte-equal to its golden.
4. Assert non-secret sibling values are unchanged (the transformation is targeted).
5. Vacuity control: a temp-copy serializer with redaction disabled leaks the marker and the assertion fails.

**Expected Outcome**:

- No success payload can carry registered secret material to either stream, in any nesting position.
- The detection is proven able to fail.

#### TC-REDACT-002 - Planted secret in a failure error object never reaches a stream

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-5
**Test Type(s)**: Golden
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/redaction.test.ts` (†) + `tests/fixtures/result/envelopes/secret-failure/**` (†)
**Tags**: @golden, @redaction, @security

**Preconditions**:

- A synthetic failure carries the planted value in the optional `summary` and in a free-form detail field assembled at the surface.

**Steps**:

1. Run the failure case under `--json` with the planted value registered.
2. Assert zero `planted-fake-` occurrences in stdout and stderr; assert the envelope remains valid and byte-equal to its golden.
3. Assert the table-derived fields (`code`, `category`, `retryable`, `consequence`) are unchanged by redaction, and `remediationHint` remains a non-empty action-first string.
4. Assert the human channel (stderr diagnostics) is redacted identically.
5. Vacuity control as in TC-REDACT-001.

**Expected Outcome**:

- The error object is as protected as the data payload; the chokepoint covers both payload kinds.
- Redaction does not destroy the actionable fields an agent needs.

#### TC-REDACT-003 - No-partial-leak sweep across forms, nesting, and encodings

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-5
**Test Type(s)**: Golden / Unit
**Automation Level**: Automated
**Tier**: golden
**Target Layer / Location**: `tests/golden/redaction.test.ts` (†) + `tests/fixtures/result/redaction/cases.json` (†)
**Tags**: @golden, @redaction, @encodings

**Preconditions**:

- The case corpus plants the value as: whole token, embedded in a URL/DSN, as a JSON key, split across adjacent nested strings, repeated in multiple fields, and in a value requiring JSON/unicode escaping.
- The split case registers **each fragment as its own secret value** in the case's fixture data (the case entry in `redaction/cases.json`; `injected.json` where the case is an envelope fixture) and expects the golden to carry `[redacted]` at each fragment position. Rationale: plan D1 binds contiguous per-registered-value replacement, so the chokepoint never assembles a secret from adjacent fields; the case therefore proves multi-fragment objects, not substring matching across field boundaries (§4.5). Marker-prefix matching is deliberately not the chosen mechanism.

**Steps**:

1. Run each corpus case through success and failure paths; for the split case, assert each registered fragment is replaced independently.
2. Assert zero `planted-fake-` occurrences in raw output and in the unescaped/decoded form of stdout/stderr (so escaping cannot hide a leak); for the split case, assert zero occurrences of each registered fragment as well, and byte-exact equality with a golden carrying `[redacted]` at every planted position (the vacuity control for fragments too short to contain the marker).
3. Assert redaction is applied to both streams; assert the human channel is not an escape hatch.
4. Over-redaction guard: a control payload with realistic non-secret values (URLs, dotted identifiers, version strings) round-trips byte-identically.
5. Assert repeated runs produce identical redacted output (determinism of the chokepoint).

**Expected Outcome**:

- No planting form, encoding, or channel defeats the chokepoint **for the declared secret set** (registered values and registered fragments).
- Redaction is targeted: ordinary values survive unchanged.

#### TC-REDACT-004 - Single serialization chokepoint; no other stream write path

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-5, RSK-3
**Test Type(s)**: Structure / Boundary
**Automation Level**: Automated
**Tier**: boundary-fixture
**Target Layer / Location**: `tests/structure/cli-edge-seam.test.ts` (†) + `tests/boundaries/**` (update)
**Tags**: @redaction, @single-write-path, @boundary

**Preconditions**:

- The serialization module (†`packages/cli/src/output/serialize.ts`) owns every stream write and calls the redaction function.

**Steps**:

1. Assert the import-edge rule: only the surface entry may import the serialization module; command modules may not. A new rule (if the delivery expresses it as a dependency-cruiser rule) ships with a failing fixture (command imports serializer) and a clean control (surface entry imports it).
2. Assert by AST scan that no delivered CLI runtime module outside the serialization module contains `stream.write`, `console.log`, `console.error`, `process.stdout`, or `process.stderr`.
3. Assert the module's single write call site occurs after the redaction call (source-order assertion); mutation: swap the order in a temp copy → the suite fails.
4. Assert hints and summaries are static table data with no interpolation of runtime payload values (AST assertion on the source modules) — supports "secret-free by construction".
5. Mutation: a temp copy adding `console.log(payload)` to a command module fails naming file and line.

**Expected Outcome**:

- There is exactly one place where bytes reach a stream, and it is downstream of redaction.
- Bypass is impossible by construction and detected by rule plus scan.

#### TC-SYNC-001 - Delivered state is bidirectionally consistent and non-vacuous

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6, DM-3, DM-4
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Tier**: invariant-check
**Target Layer / Location**: `scripts/checks/error-table-sync.ts` (†)
**Tags**: @invariants, @sync, @documentation

**Preconditions**:

- §4.4 is the binding contract, including its three recognizer levels: Level A (scan-level recognition over S1/S3), Level B (strict source-entry validation), Level C (the corpora fed explicitly, never discovered by the S1/S3 walk). The documented table at `doc/spec/features/feature-result-contract.md` ships in this change (GAP-1/OQ-T1 resolved).

**Steps**:

1. Run the check on the delivered tree; assert exit 0.
2. Assert the summary reports non-zero counts for source entries, documented rows, recognized S1/S3 code references, and Level C corpus rows (the delivered-state invocation feeds the corpus by name; a zero-count summary — including an empty corpus feed — is a vacuous pass and fails).
3. Assert the bijection: every entry appears exactly once in the documented table, and every documented row resolves to exactly one entry; both fallback codes (`fallback.invocation`, `fallback.internal`) appear exactly once on each side.
4. Assert every recognized code reference in S1/S3 resolves; every Level C true-positive row produces its declared verdict; every declared domain kind maps to an entry; and ignored foreign-namespace literals do not enter the recognized-reference count.
5. Assert the check is read-only: `git status --porcelain` is unchanged after the run.
6. Assert a failure message format exists (code, surface, line) by inspecting the reported shape on a deliberately mutated copy in the mutation suite (cross-link TC-SYNC-002).

**Expected Outcome**:

- The delivered docs, code, and fixtures agree with the single source, and the agreement is non-trivial.
- "Error codes resolve to documented table entries" is mechanically true, not aspirational.

#### TC-SYNC-002 - Drift A: referenced/emitted code without an entry fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6
**Test Type(s)**: Mutation / Negative
**Automation Level**: Automated
**Tier**: negative-fixture
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (†)
**Tags**: @sync, @mutation-proof

**Preconditions**:

- A temp-copy harness materializes the check's inputs into `mkdtemp`; the live tree is never written.

**Steps**:

1. In a temp copy, add an unregistered hierarchical code with a *declared* first segment (so Level A recognizes it) to a CLI module source string; run the check; assert non-zero exit naming code, surface, and line.
2. In a temp copy, add an unregistered code (same declared-namespace shape) to an error fixture; assert non-zero exit naming the fixture path.
3. Assert the two reports are distinguishable by surface label (so triage knows where to fix).
4. Assert the check does not silently fall back to either containment entry when a code is unresolvable.
5. Assert the live tree remains untouched by these runs.

**Expected Outcome**:

- Emitting or referencing a code with no documented entry fails CI, with a message that locates the fix.
- This is drift direction one, proven by mutation.

#### TC-SYNC-003 - Drift B: documented entry missing from the source fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6
**Test Type(s)**: Mutation / Negative
**Automation Level**: Automated
**Tier**: negative-fixture
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (†)
**Tags**: @sync, @mutation-proof

**Preconditions**:

- The documented table at `doc/spec/features/feature-result-contract.md` is parseable per Appendix B and ships in this change (GAP-1/OQ-T1 resolved).

**Steps**:

1. In a temp copy, add a well-formed documented row for a code absent from the source; assert non-zero exit naming the code as documented-but-not-in-source.
2. In a temp copy, remove a required column from one documented row; assert non-zero exit (parse strictness) rather than a silent skip.
3. Assert a missing documented-table file fails closed with a named error and no vacuous green.
4. Assert the check reads the in-change artifact at `doc/spec/features/feature-result-contract.md`; phase-7 reconciliation of the surrounding feature doc does not remove the table section from the S2 surface (a temp copy without the table section fails closed).
5. In a temp copy, add a documented row for a phantom containment code (`fallback.legacy`); assert non-zero exit naming it — the reserved `fallback` namespace admits exactly the two DEC-13 identifiers (Level A recognizes the literal, Level B rejects the entry).

**Expected Outcome**:

- Documentation cannot invent entries the source does not declare.
- Missing or malformed documentation fails closed — the check never degrades to "nothing to check"; the in-change artifact is the bound S2 target and stays bound after phase-7 reconciliation.

#### TC-SYNC-004 - Drift C: source entry missing from the documented table fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6
**Test Type(s)**: Mutation / Negative
**Automation Level**: Automated
**Tier**: negative-fixture
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (†)
**Tags**: @sync, @mutation-proof

**Preconditions**:

- The check compares entry sets in both directions.

**Steps**:

1. In a temp copy, delete one documented row while leaving the source entry present; assert non-zero exit naming the entry as undocumented.
2. In a temp copy, add a new source entry with no documented row; assert the same failure mode.
3. Assert a duplicated documented row for one entry also fails (exactly-once, not at-least-once).
4. Repeat the deletion for each fallback entry's documented row (`fallback.invocation`, `fallback.internal`) in turn; assert both are reported as undocumented — no containment exemption.

**Expected Outcome**:

- Adding a table entry without documenting it is a CI failure in the same change.
- The documented table cannot fall behind the source silently.

#### TC-SYNC-005 - Identity hygiene: duplicates, malformed codes, false-positive corpus

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F8-1, DM-4
**Test Type(s)**: Unit / Mutation
**Automation Level**: Automated
**Tier**: negative-fixture
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (†) + `tests/fixtures/result/code-corpora/{true,false}-positives.json` (†)
**Tags**: @sync, @identity, @corpora

**Preconditions**:

- §4.4 defines the recognizer's three levels: Level A scan-level recognition (declared domain-kind first segment, plus the reserved two-segment `fallback` namespace for `fallback.invocation`/`fallback.internal`, DEC-13; foreign-namespace dotted literals ignored and uncounted), Level B strict validation of source entries, and Level C direct corpus input (`tests/fixtures/result/code-corpora/**` fed explicitly and excluded from the S3 walk).
- Each corpus row declares its expectation (`recognized`, `resolves`).

**Steps**:

1. (Level B) Assert duplicate codes in the source fail naming both positions.
2. (Level B) Assert invalid source entries fail: two segments other than the two DEC-13 containment identifiers, uppercase, leading digit, URI, `HTTP_404`, and a foreign-namespace first segment.
3. (Level C false-positive corpus) Assert the corpus is clean: `delivery.result.v1`, `delivery.event.v1`, `delivery.metric.v1`, semantic versions, dotted file names, hostnames, ordinary prose, **and foreign-namespace dotted identifiers** produce zero violations, and none of them enters the recognized-reference count.
4. (Level C true-positive corpus) Assert every recognized-code row produces its declared verdict: declared codes (`provider.quota.exceeded`, `input.value.rejected`) resolve to exactly one entry; a **recognized-but-undeclared** code (declared first segment, unknown full code) fails with a named error naming code, corpus file, and row; both fallback codes (`fallback.invocation`, `fallback.internal`) are recognized and appear exactly once in the source and in the documented table.
5. (Level A negative control) In temp copies, plant a foreign-namespace dotted literal (e.g. `com.example.telemetry.sink`) in an S1 module and in an S3 fixture: the check stays green and the recognized-reference count is unchanged — the literal is ignored, not flagged. In the same temp copies, plant an undeclared code with a declared first segment (e.g. `input.legacy.marker`) at those two locations: the check fails naming code, surface, and line. Any `fallback.*` literal other than the two DEC-13 identifiers also fails (recognized by the reserved namespace, therefore unresolvable).
6. (Level separation) In a temp copy, add an undeclared true-positive row to the corpus only; assert the tree walk alone stays green (the corpora are not part of S3) and the failure appears only when the corpus is fed at Level C.

**Expected Outcome**:

- The scan is precise at Level A (declared namespaces only; reserved schema names, versions, and foreign-namespace identifiers ignored by rule, not by accident), strict at Level B (malformed, foreign-namespace, and duplicate entries fail loudly at the source, where they are cheap to fix), and controlled at Level C (the adversarial corpora prove both directions explicitly without polluting the delivered-tree scan).
- Coarse or silent classification of a dotted literal is impossible: every literal is either a resolvable code, an explicitly ignored identifier, or a named failure.

#### TC-SYNC-006 - Sync check binds in the existing CI fast loop

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6, NFR-10
**Test Type(s)**: Invariant / Structure
**Automation Level**: Automated
**Tier**: invariant-check
**Target Layer / Location**: `scripts/checks/error-table-sync.ts` (†), `.github/workflows/ci.yml`, `tests/checks/ci-checks.test.ts` (update)
**Tags**: @sync, @ci-bindingness

**Preconditions**:

- New checks join an existing `ts-*` job; no new job topology (constraint on this change).

**Steps**:

1. Assert the check is invoked by name from the existing `ts-invariants` step list; assert `TS_JOBS` is unchanged and no new job id appears.
2. Assert the `ci-topology` wiring rule passes (every `scripts/checks/*.ts` invoked by the aggregate or a named job) and that `ci.yml` is additions-only relative to `origin/main-tools`.
3. Assert `ci-bindingness` reports no bypass construct in any `ts-` job (no `|| true`, `continue-on-error`, `exit 0` wrap, `set +e`).
4. Assert the aggregate `pnpm check` chain is unchanged (five named steps in order, no alternate aggregate); assert the new check is *not* inserted into it.
5. Assert a drift mutation in the temp harness yields a non-zero process exit (the failure the CI job would surface).

**Expected Outcome**:

- Drift fails the same PR that introduces it, in an existing job, with no topology change.
- The gate is binding, not advisory.

#### TC-BOUNDARY-001 - Contracts tier stays runtime-neutral for the new files

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F2-1, AC-F9-1, NFR-1
**Test Type(s)**: Boundary / Structure
**Automation Level**: Automated
**Tier**: boundary-fixture
**Target Layer / Location**: `tests/structure/error-table.test.ts` (†) + `tests/boundaries/**` + `scripts/checks/ambient-globals.ts`
**Tags**: @boundaries, @runtime-neutral, @contracts

**Preconditions**:

- The ambient guard's scoped directories include `packages/core/src/contracts` recursively.

**Steps**:

1. Run `bun run scripts/checks/ambient-globals.ts`; assert exit 0 and that every new contracts file is enumerated inside the scoped set (a new file must not escape coverage by being new).
2. Assert the dependency-cruiser `runtime-apis-confinement` rule is green for the new contracts files (no `node:*`/`bun:*` imports).
3. Mutation: in temp copies add `Date.now()`, `Math.random()`, `process.env.X`, and a `readFileSync` import to a contracts module; assert each fails naming file, line, and violation kind.
4. Assert contracts modules contain no functions (data/types only) and no side-effect statements.
5. Assert `Result<T, E>` and `CommandResult` are each declared exactly once and no runtime helper is exported alongside them.

**Expected Outcome**:

- The envelope and error table cannot become environment-probing or exfiltration surfaces.
- New files are inside coverage, and each forbidden construct is proven to fail.

#### TC-BOUNDARY-002 - Tier matrix green; every new forbidden rule has a failing fixture

**Scenario Type**: Happy Path / Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, AC-F7-2, NFR-10
**Test Type(s)**: Boundary / Mutation
**Automation Level**: Automated
**Tier**: boundary-fixture
**Target Layer / Location**: `tests/boundaries/boundaries.test.ts` (existing), `fixtures/cases.ts` (update), `fixture-registry.json` (update), `fixture-coverage.test.ts` (existing)
**Tags**: @boundaries, @fixture-coverage

**Preconditions**:

- Candidate new rules from this change: serialization single-entry import edge, CLI stream-write confinement, CLI ambient-brand confinement, projection confinement. Delivery may bind different rule names but every new forbidden rule must ship with a fixture (strategy fallback rule).

**Steps**:

1. Run `bun test tests/boundaries`; assert green including the fixture-coverage meta-check.
2. For each new rule: assert ≥1 failing negative fixture whose clean control cruises clean first (existing harness behaviour) and whose injected probe produces a violation of *that* rule by name.
3. Assert each case is registered in `fixture-registry.json` at `severity: error`.
4. Mutation: delete one new fixture case and assert the coverage meta-check fails naming the rule as unenforced.
5. Assert the rule list is a superset of the baseline and no existing rule's severity was downgraded (no gate weakening).

**Expected Outcome**:

- No new forbidden rule is decorative: each fires in a fixture and the meta-check prevents silent removal.
- The tier matrix and ambient matrices stay green with the new modules.

#### TC-BOUNDARY-003 - Forbidden-literal scan green; brand values only from parameters

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-9
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Tier**: invariant-check
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts` (existing) + registry
**Tags**: @branding-firewall, @scan

**Preconditions**:

- The M0-S2 scan is binding and its registry is unchanged for scope classes.

**Steps**:

1. Run the scan; assert exit 0, five scope classes enumerated, zero violations.
2. Assert the delivered state includes the new `packages/**` files in the package-tree scope (they are new, so they are in claim).
3. Assert no product token appears in the new CLI surface or contracts (covered by the scan, corroborated by TC-RUNCLI-004's source assertion).
4. Assert brand-dependent values in new code come from `BrandIdentity` parameters (structure assertion), not from literals or ambient reads.
5. Assert the registry was not modified to widen an allowlist or narrow a scope in this change.

**Expected Outcome**:

- The branding firewall from M0-S2 remains intact and covers the new surface.
- No name is introduced, proposed, or revealed by this change.

#### TC-BOUNDARY-004 - Fixture hygiene: brand-neutral fixtures, fakes only, no product tokens

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-9, NFR-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Tier**: unit
**Target Layer / Location**: `tests/structure/result-fixtures.test.ts` (†)
**Tags**: @fixtures, @branding-firewall, @secrets

**Preconditions**:

- `tests/**` is outside the scan's scope classes (GAP-2), so this test is the coverage for fixture hygiene.

**Steps**:

1. Walk every new fixture under `tests/fixtures/result/**` and every new test file; assert none of the seed literals (`ados`, `ADOS_`, `~/.ados`) appears.
2. Assert brand-dependent values in fixtures are synthetic (`example-product`, `.renamed-product`) and that no fixture carries a real-looking credential: planted values match `^planted-fake-[a-z0-9-]+$`.
3. Assert goldens contain no absolute path, username, hostname, wall-clock timestamp, or machine-specific id (only injected deterministic values).
4. Mutation: inject `ados` into a temp-copy golden; assert the test fails naming file and token.
5. Assert fixtures are valid JSON/YAML where applicable and never named `*.test.ts` (discovery hygiene).

**Expected Outcome**:

- Fixture data cannot leak a product name or a real-looking secret into the repository.
- The gap created by the scan's test exclusion is explicitly closed.

#### TC-BOUNDARY-005 - No regression, no gate weakening, no bypass, inventory updated deliberately

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-10, C-8
**Test Type(s)**: Invariant / Structure
**Automation Level**: Automated
**Tier**: invariant-check
**Target Layer / Location**: `pnpm check`; `tests/checks/ci-checks.test.ts` (update); `tests/structure/content-inventory.test.ts` + `inventory.json` (update); `.github/workflows/ci.yml`
**Tags**: @regression, @gates

**Preconditions**:

- Baseline: `origin/main-tools` at the change's merge base is reachable (topology diff).

**Steps**:

1. Run `pnpm check`; assert green (lint, format, typecheck, test, boundaries) and record duration as evidence.
2. Run `bash scripts/.tests/test-*.sh` and `bash tools/.tests/test-*.sh`; assert green.
3. Assert `git diff --name-only origin/main-tools...HEAD` shows no modification to existing bash scripts, tools, agent/command definitions, or `.ados-claude/**`.
4. Assert `ci-topology`, `ci-bindingness`, `ci-supply-chain` are green; `ci.yml` is additions-only; `TS_JOBS` and bash job ids unchanged.
5. Assert no new dependency: `pnpm-lock.yaml` has no added package; `license-audit` and `vulnerability-gate` green.
6. Assert `tests/structure/inventory.json` lists every new source file and that each new executable export is named in the per-file allowance — never a global switch; mutation: an undeclared executable export fails naming the file.
7. Assert no new test file contains `.skip`, `.todo`, `.only`, `--filter`, or `--passWithNoTests`, and that the new suites report zero skipped tests.
8. Assert no existing test file was deleted and no existing assertion weakened; any intentional update is recorded in the plan revision log.

**Expected Outcome**:

- The change is additive: existing gates, jobs, and suites are exactly as strong as before.
- New executable content is declared per file, so the inventory does not decay into a global allowance.

#### TC-REVIEW-001 - Manual contract review: hint quality, evolution discipline, gate integrity

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, F-7, F-9, AC-F7-2, AC-F9-1, DEC-4, DEC-9, DEC-13
**Test Type(s)**: Manual
**Automation Level**: Manual
**Tier**: manual
**Target Layer / Location**: PR review record
**Tags**: @review, @contract-quality

**Preconditions**:

- Automated suites are green; the reviewer has the spec's Appendix B and DEC-4/DEC-9 in hand.

**Steps**:

1. Review every `remediationHint` for action-first phrasing and non-identifying content, and every `summary` for carrying no identity (DEC-4).
2. Confirm both fallback entries carry the DEC-13 values (`fallback.invocation`: category `user`, `retryable: false`, class user-validation; `fallback.internal`: category `platform`, `retryable: false`, class platform-provider), and that no other entry uses `consequence: unknown` without justification (RSK-7).
3. Confirm envelope/table evolution discipline: no `schemaVersion` change; goldens updated only for this change's deliberate contract authorship; no automatic golden-update path exists in scripts or CI.
4. Review the delivered surface for any stream write the automated scan cannot see (dynamic property access, aliased writers) — AC-F7-2's human half.
5. Confirm no item of this plan required weakening, skipping, or relaxing an existing gate (C-8); confirm no product name appears in any artifact of the change.

**Expected Outcome**:

- The judgement-based properties the suite cannot mechanize are reviewed and recorded.
- Gate integrity for the change is attested by a human reviewer, not assumed.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; network for install only | All new suites are hermetic: no network, no git-history dependency, no writes to the live tree |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; Bun/pnpm from pinned sources; existing `ts-*` jobs | Authoritative for TC-SYNC-006, TC-BOUNDARY-002, TC-BOUNDARY-003, TC-BOUNDARY-005 and every golden/invariant suite |
| Temp fixture trees | `mkdtemp` under the OS temp dir | Mutation suites (sync, exit-literal, boundary, fixture hygiene) never write the live tree |
| In-process test process | Bun runtime; injected streams only; no child processes | `runCli` contract and golden suites (guard-enforced) |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Envelope goldens | `tests/fixtures/result/envelopes/{case}/{argv.json,injected.json,stdout.json,stderr.txt?,meta.json}` (†) — synthetic | Read-only; changed only with a deliberate contract change |
| Injected clock ticks | Ordered tick sequences per case (e.g. `[1000, 1013]`) | Read-only |
| Injected `runId` | Fixed opaque synthetic value per case (e.g. `run-fixture-0001`) | Read-only |
| Synthetic `BrandIdentity` | `example-product`, `.renamed-product` — never a product token | Read-only |
| Synthetic command programs | `tests/fixtures/result/programs/**` (†): ok-data, ok-void, classified-user, classified-platform, unknown-kind, throwing variants, malformed-result | Read-only |
| Planted secrets | Marker prefix `planted-fake-` (e.g. `planted-fake-secret-0001`); synthetic env key name; the split case additionally registers each fragment as its own secret value (A-T13) | Read-only; obviously fake |
| Code corpora | `tests/fixtures/result/code-corpora/{true,false}-positives.json` (†) — Level C direct recognizer input, fed explicitly and excluded from the S3 walk | Read-only; reviewed when the recognition rule changes |
| `unknown`-consequence allowlist | `tests/fixtures/result/unknown-consequence-allowlist.json` (†) | Reviewed; each addition justified |
| Error-table source | `packages/core/src/contracts/**` (code) | The single source of truth |
| Documented table artifact | `doc/spec/features/feature-result-contract.md` — authored in-change (GAP-1/OQ-T1 resolved) | Read-only at test time; drift fails |
| Mutated temp copies | Generated per run in `mkdtemp` | Deleted at test end; never in-tree |

### 6.3 Isolation Strategy

- Every mutation-style test copies its inputs into `mkdtemp`; `git status --porcelain` must be clean after the full suite (asserted in TC-BOUNDARY-005).
- Golden suites never read the wall clock or a real id generator: all dynamic values are injected, so goldens are byte-stable and reproducible across machines and CI.
- The no-spawn/no-exit guard is installed per test and self-tested; the guard is scoped to the test process only.
- Ambient-clock and randomness stubs are installed to *throw* in determinism and purity tests, proving no ambient read occurs (the GH-171 pattern).
- Boundary and ambient fixtures use the existing `mkdtemp` harness with the production configuration copied verbatim; no live-tree probe.
- No test writes to `dist/`, and no test requires a build: tests import source via relative paths (`../../packages/*/src/...`), matching existing suites.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except TC-REVIEW-001 (manual). Paths marked † are assumed locations: delivery planning may bind different filenames, but each TC's behaviour and assertion target must not change (A-T1).

| TC ID | Test file / artefact | Execution command | Mocking / mutations | Status |
|-------|----------------------|-------------------|---------------------|--------|
| TC-RESULT-001 | `tests/structure/result-contract.test.ts` (†) + testkit helper (†) | `bun test tests/structure/result-contract.test.ts` | field-removal/both/neither envelopes | To Implement |
| TC-RESULT-002 | `tests/golden/envelope-success.test.ts` (†) + success fixtures (†) | `bun test tests/golden/envelope-success.test.ts` | injected clock/id/brand; guard | To Implement |
| TC-RESULT-003 | `tests/golden/envelope-failure.test.ts` (†) + classified fixtures (†) | `bun test tests/golden/envelope-failure.test.ts` | injected clock/id; two projection classes | To Implement |
| TC-RESULT-004 | `tests/golden/timing.test.ts` (†) | `bun test tests/golden/timing.test.ts` | distinct injected deltas; zero delta | To Implement |
| TC-RESULT-005 | `tests/structure/result-contract.test.ts` (†) | same | distinct injected ids; AST scan of contracts | To Implement |
| TC-RESULT-006 | `tests/structure/result-contract.test.ts` (†) + `packages/testkit/src/result-conformance.ts` (†) | same | per-rule negative cases; rule bijection | To Implement |
| TC-TABLE-001 | `tests/structure/error-table.test.ts` (†) | `bun test tests/structure/error-table.test.ts` | none (delivered state); count non-vacuity | To Implement |
| TC-TABLE-002 | `tests/structure/error-table.test.ts` (†) + allowlist fixture (†) | same | new `unknown` entry outside allowlist | To Implement |
| TC-TABLE-003 | `tests/structure/error-table.test.ts` (†) | same | invalid identity corpus | To Implement |
| TC-TABLE-004 | `tests/structure/error-table.test.ts` (†) | same | temp-copy second declaration; function-in-contracts | To Implement |
| TC-CLASSIFY-001 | `tests/behaviour/error-classification.test.ts` (†) | `bun test tests/behaviour/error-classification.test.ts` | unmapped domain kind; override attempt | To Implement |
| TC-CLASSIFY-002 | `tests/behaviour/error-classification.test.ts` (†) | same | non-`Error` throws; hostile message | To Implement |
| TC-EXIT-001 | `tests/behaviour/exit-projection.test.ts` (†) | `bun test tests/behaviour/exit-projection.test.ts` | out-of-range class; clock/env stubs that throw | To Implement |
| TC-EXIT-002 | `scripts/checks/exit-code-literals.ts` (†) + `tests/checks/exit-code-literals.test.ts` (†) | `bun run scripts/checks/exit-code-literals.ts`; `bun test tests/checks/exit-code-literals.test.ts` | literal injection in 4 forms + control | To Implement |
| TC-EXIT-003 | `tests/behaviour/exit-projection.test.ts` (†) + `tests/boundaries/**` (update) | `bun test tests/behaviour tests/boundaries` | temp-copy numeric map in contracts; surface import probe | To Implement |
| TC-RUNCLI-001 | `tests/behaviour/run-cli.test.ts` (†) | `bun test tests/behaviour/run-cli.test.ts` | spawn/exit guard + guard self-test; AST scan | To Implement |
| TC-RUNCLI-002 | `tests/behaviour/run-cli.test.ts` (†) | same | repeated/shuffled runs; different-argv control; throwing clock stubs | To Implement |
| TC-RUNCLI-003 | `tests/golden/broken-command.test.ts` (†) + all golden cases | `bun test tests/golden` | drop-stderr case; stdout purity assertions | To Implement |
| TC-RUNCLI-004 | `tests/structure/cli-edge-seam.test.ts` (†) + `tests/boundaries/fixtures/cases.ts` (update) | `bun test tests/structure/cli-edge-seam.test.ts tests/boundaries` | ambient env read injection; injected edge reader | To Implement |
| TC-CONTAIN-001 | `tests/golden/broken-command.test.ts` (†) + broken fixtures (†) | `bun test tests/golden/broken-command.test.ts` | unknown command/flag/missing value/conflicts | To Implement |
| TC-CONTAIN-002 | `tests/golden/envelope-failure.test.ts` (†) | `bun test tests/golden/envelope-failure.test.ts` | temp-copy serializer appending stack | To Implement |
| TC-CONTAIN-003 | `tests/golden/broken-command.test.ts` (†) + hostile programs (†) | same | hostile handlers; partial-write serializer copy | To Implement |
| TC-REDACT-001 | `tests/golden/redaction.test.ts` (†) + secret-success fixtures (†) | `bun test tests/golden/redaction.test.ts` | redaction-disabled serializer copy | To Implement |
| TC-REDACT-002 | `tests/golden/redaction.test.ts` (†) + secret-failure fixtures (†) | same | redaction-disabled serializer copy | To Implement |
| TC-REDACT-003 | `tests/golden/redaction.test.ts` (†) + `redaction/cases.json` (†) | same | encoded/nested forms; split case with registered fragments; over-redaction control | To Implement |
| TC-REDACT-004 | `tests/structure/cli-edge-seam.test.ts` (†) + `tests/boundaries/**` (update) | `bun test tests/structure/cli-edge-seam.test.ts tests/boundaries` | command-imports-serializer fixture; console.log injection; order swap | To Implement |
| TC-SYNC-001 | `scripts/checks/error-table-sync.ts` (†) | `bun run scripts/checks/error-table-sync.ts` | none (delivered state); count and Level C corpus non-vacuity | To Implement |
| TC-SYNC-002 | `tests/checks/error-table-sync.test.ts` (†) | `bun test tests/checks/error-table-sync.test.ts` | unregistered code in code/fixture (temp copy) | To Implement |
| TC-SYNC-003 | `tests/checks/error-table-sync.test.ts` (†) | same | doc-only row; malformed row; missing doc file | To Implement |
| TC-SYNC-004 | `tests/checks/error-table-sync.test.ts` (†) | same | removed row; undocumented new entry; duplicate row | To Implement |
| TC-SYNC-005 | `tests/checks/error-table-sync.test.ts` (†) + code corpora (†) | same | duplicates; malformed entries; corpora at Level C; foreign-namespace negative control | To Implement |
| TC-SYNC-006 | `tests/checks/ci-checks.test.ts` (update) + `.github/workflows/ci.yml` | `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun test tests/checks/ci-checks.test.ts` | job-list mutation; bypass injection | Existing – Update |
| TC-BOUNDARY-001 | ambient suite + `tests/structure/error-table.test.ts` (†) | `bun run scripts/checks/ambient-globals.ts`; `bun test tests/boundaries` | temp-copy ambient probes | Existing – Update |
| TC-BOUNDARY-002 | `tests/boundaries/**` (update) | `bun test tests/boundaries` | new-rule fixtures; fixture deletion | Existing – Update |
| TC-BOUNDARY-003 | `scripts/checks/forbidden-literals.ts` + registry | `bun run scripts/checks/forbidden-literals.ts` | none | Existing – No Change |
| TC-BOUNDARY-004 | `tests/structure/result-fixtures.test.ts` (†) | `bun test tests/structure/result-fixtures.test.ts` | seed literal injection into a golden copy | To Implement |
| TC-BOUNDARY-005 | repo root; inventory; ci-checks | `pnpm check`; bash suites; `bun test tests/checks tests/structure` | inventory/allowance mutation; skip/bypass scan | Existing – Update |
| TC-REVIEW-001 | PR review record | manual | none | Manual Only |

**Wiring**: the two new invariant checks join the existing `ts-invariants` step list; `TS_JOBS` and bash job ids are unchanged (no new job topology). The aggregate `check` chain stays the five named steps — the new checks are *not* inserted into it (matching the GH-171 precedent and `script-surface.ts`). The `ci-topology.ts` wiring rule requires each `scripts/checks/*.ts` to be named in `ci.yml` or `package.json`; naming it in the `ts-invariants` step satisfies it. `tests/golden/**` is discovered by root `bun test` (`bunfig.toml` root discovery) and therefore covered by both `ts-test` and `ts-aggregate`.

**Execution order**: (1) structure/contract and table suites (TC-RESULT-001/005/006, TC-TABLE-001..004, TC-BOUNDARY-001); (2) classification and projection units (TC-CLASSIFY-001/002, TC-EXIT-001/003); (3) surface behaviour and determinism (TC-RUNCLI-001..004); (4) goldens (TC-RESULT-002/003/004, TC-CONTAIN-001..003, TC-REDACT-001..003, TC-RUNCLI-003); (5) invariants on delivered state (TC-EXIT-002, TC-SYNC-001, TC-SYNC-006, TC-BOUNDARY-003); (6) mutation suites (TC-SYNC-002..005, TC-EXIT-002 mutations, TC-BOUNDARY-002/004, TC-REDACT-004); (7) aggregate and regression (TC-BOUNDARY-005); (8) manual review (TC-REVIEW-001).

**Evidence commands** (run and record in the change/PR):

```
bun test tests/structure/result-contract.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/structure/result-fixtures.test.ts
bun test tests/structure/cli-edge-seam.test.ts
bun test tests/behaviour/error-classification.test.ts
bun test tests/behaviour/exit-projection.test.ts
bun test tests/behaviour/run-cli.test.ts
bun test tests/golden
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/exit-code-literals.test.ts
bun test tests/checks/ci-checks.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/ci-topology.ts
bun run scripts/checks/ci-bindingness.ts
bun run scripts/checks/workspace-entrypoints.ts
bun run scripts/checks/license-audit.ts
bun run scripts/checks/vulnerability-gate.ts
pnpm check
bash scripts/.tests/test-*.sh
bash tools/.tests/test-*.sh
git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude
git status --porcelain
```

The `git diff` for `scripts` intentionally includes the two new `scripts/checks/*.ts` files; the no-change assertion applies to existing bash/tool/agent files, not to the new checks.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | Goldens are flaky because `runId`/`timing` are dynamic, so the suite is normalized into uselessness | H | M | All dynamic values injected (§4.1); byte-exact assertion with no masking step; a separate suite asserts production-default *shape* only |
| RSK-T2 | The golden suites pass because a fixture never carried a secret / never contained a stack | H | M | Vacuity controls in TC-REDACT-001/002 and TC-CONTAIN-002: a disabled-chokepoint copy must leak, or the assertion is not proven |
| RSK-T3 | "Zero spawned processes" is asserted by convention, not proof | H | M | Guard with a self-test (TC-RUNCLI-001), static AST assertion, and real process-survival assertion |
| RSK-T4 | The sync check becomes vacuous (empty table, absent doc, missing artifact silently skipped) | H | M | Non-zero count assertions; fail-closed on missing/unparseable doc (TC-SYNC-003); count non-vacuity in TC-SYNC-001 |
| RSK-T5 | The sync check's recognition rule either misses real codes or floods on ordinary dotted strings | H | M | Recognition is level-scoped (§4.4): Level A namespace rule (declared domain kind or reserved `fallback`; foreign namespaces ignored and uncounted), Level B strict source-entry validation, Level C explicit corpus feed with `delivery.*.v1` reserved names, foreign-namespace rows, dotted filenames, and both fallback codes (TC-SYNC-005) |
| RSK-T6 | Phase-7 reconciliation rewrites or drops the in-change documented table, making AC-F8-1's doc direction untestable or vacuous | H | L | The documented table is authored in-change at `doc/spec/features/feature-result-contract.md` (GAP-1/OQ-T1 resolved) and stays sync-checked; TC-SYNC-003 fails closed if the table section is missing or unparseable after phase-7 reconciliation |
| RSK-T7 | The redaction guarantee is assumed from an unregistered secret set | H | M | A-T4 binds the edge-registered secret set; the limitation is documented rather than hidden |
| RSK-T8 | The exit-code literal check is satisfied by loosening scope or an allowlist | M | M | Explicit scope boundary asserted (TC-EXIT-002 step 6); no allowlist; mutation per forbidden form |
| RSK-T9 | The no-spawn guard interferes with legitimate test infrastructure (e.g. boundary harness spawning depcruise) | M | M | Guard is scoped to `runCli` invocations only, installed/removed per test; boundary suites remain outside it |
| RSK-T10 | A new stream-write path or exit literal appears later in a form the scans miss | M | M | New boundary rules with failing fixtures; manual review step (TC-REVIEW-001 step 4); review checklist update for future changes |
| RSK-T11 | Test-content growth substantially slows the CI fast loop | L | M | Suites are hermetic and in-process; soft wall-clock target recorded; no new job topology; narrow suites for iteration |
| RSK-T12 | The content-inventory update becomes a blanket allowance that permits arbitrary executables | M | L | Per-file allowance with explicitly named exports (TC-BOUNDARY-005 step 6); mutation proves an undeclared export fails |
| RSK-T13 | Golden fixtures smuggle a product token because `tests/**` is outside the scan | M | M | Dedicated fixture-hygiene test (TC-BOUNDARY-004) with a seed-literal mutation |

### 8.2 Assumptions

- **A-T1** — Behaviour is bound by the TCs, not by exact symbol or file names. Daggers mark assumed paths/names (surface modules, invariant check names, fixture layout); delivery planning may bind different ones without changing assertions. Exception: the envelope field names, table column names, code format, projection values, and `schemaVersion` value are spec-fixed and may not be rebound.
- **A-T2** — A void success carries `data: {}` (an explicit empty payload) and no `error` key. If delivery binds a different explicit empty form (`null`), only TC-RESULT-001 step 4 and the corresponding fixture row change; "explicitly present" is non-negotiable.
- **A-T3** — `runCli` accepts injected clock facts and an injected `runId` source in addition to `(argv, streams)`, as F-5 permits ("injected clock facts where timing is involved"). Determinism is asserted only with injection; production defaults are asserted for shape, not value.
- **A-T4** — The redaction input is the set of secret values registered by the runtime-aware edge (secrets are environment-only per man-page v0). The guarantee covers registered values; unregistered secret-shaped strings are out of the guarantee (documented limitation, GAP-3).
- **A-T5** — The documented table ships in this change at `doc/spec/features/feature-result-contract.md` (the sync check's S2 surface), authored during delivery as part of this change. Phase 7 reconciles and completes the surrounding feature doc; the table section already exists by merge and remains sync-checked (GAP-1/OQ-T1 resolved).
- **A-T6** — The new invariant checks are `scripts/checks/*.ts` (mutation-tested under `tests/checks/**`) invoked from the existing `ts-invariants` job; they are not inserted into the aggregate `check` chain, which stays at five named steps (matches `script-surface.ts` and the GH-171 precedent).
- **A-T7** — A new `tests/golden/` layer is acceptable under `tests/{layer}/*.test.ts`; root `bun test` discovery picks it up, and no check hardcodes the layer set.
- **A-T8** — Synthetic commands are injected as test programs/pure handlers; no command registration ships in this change (NG-1). The surface's command dispatch is exercised through injection, not through a registry.
- **A-T9** — `packages/testkit` may host the envelope conformance helper and golden loader because it is dev-only and may import `@delivery-os/core`/`./contracts` (never `@delivery-os/cli`). New testkit source files require an inventory and per-file allowance update.
- **A-T10** — `tests/**` is outside the M0-S2 scan's scope classes (GH-171 A-T4); fixture hygiene is therefore covered by TC-BOUNDARY-004, not by the scan.
- **A-T11** — The two containment entries are identified by the spec-fixed codes `fallback.invocation` and `fallback.internal` (DEC-13). They are the declared two-segment exception to the `domain.reason.detail` pattern and the only members of the reserved `fallback` namespace; every other code matches the three-segment pattern, and every other `fallback.*` literal is unresolvable. Recognition of these identifiers happens at Level A; their admission as entries is validated at Level B.
- **A-T12** — The sync recognizer is level-scoped (§4.4): Level A scan-level namespace recognition over S1/S3, Level B strict validation of source entries, Level C direct corpus input. `tests/fixtures/result/code-corpora/**` is excluded from the S3 walk and fed only explicitly; `tests/**/*.test.ts` sources are outside S1/S3 because their literals are runtime-resolved by the suites (AC-F8-1's "referenced in code" is satisfied by S1 + Level B + Level C).
- **A-T13** — Redaction is contiguous registered-value replacement (plan D1): `[redacted]` replaces each registered value wherever it occurs, but the chokepoint never assembles a value from adjacent fields. Fragments of a secret are in-guarantee only when registered as values, so TC-REDACT-003's split case registers its fragments; marker-prefix or value-pattern matching is deliberately not adopted at v1 (§4.5 item 6, GAP-3).

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Which documentation artifact carries the documented error table inside this change, and where does it live? | AC-F8-1's second direction ("documented entry missing from source") is untestable without a doc target. Spec v1.1 fixes the target: the documented table ships in-change at `doc/spec/features/feature-result-contract.md`, authored during delivery; phase 7 reconciles and completes the surrounding feature doc without rewriting the table section. | **Resolved (spec v1.1)** — in-change doc target bound in §4.4; the sync check binds both directions from merge time (TC-SYNC-001..006). | @pm / @spec-writer |
| OQ-T2 | Does the fallback entry need a `retryable: false` value, and which `category` should it carry? | Spec v1.1 / DEC-13 fixes two containment entries and their fields: `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`, user-validation → exit 1) and `fallback.internal` (category `platform`, `retryable: false`, consequence `unknown`, platform-provider → exit 2). | **Resolved (spec v1.1, DEC-13)** — tests assert these fixed values (TC-TABLE-002, TC-CLASSIFY-002, TC-CONTAIN-001..003). | @pm / @spec-writer |
| OQ-T3 | Redaction policy for registered secrets: remove the field, or replace the value with a fixed placeholder? | Both satisfy "removed or transformed"; the choice changes the goldens. Tests assert zero marker occurrences plus payload-shape preservation, so either is acceptable if bound. | **Resolved (plan D1)** — fixed `[redacted]` placeholder, applied per registered value (string values, keys, embedded substrings), never stitched across fields; the split corpus case registers its fragments (A-T13) | Delivery planning |
| OQ-T4 | Should the CLI's ambient-brand confinement be a dependency-cruiser rule, an AST structure test, or an extension of the ambient guard? | Any of the three can enforce it, but the choice determines whether a new negative fixture is required in `tests/boundaries` or an inline temp-copy mutation in `tests/structure`. | Open — non-blocking; whichever is chosen must ship with a failing-fixture proof (AC-F9-1) | Delivery planning |
| OQ-T5 | Is a non-`--json` success expected to write anything to stdout, and must it be asserted? | NG-5 puts human UX out of scope; this plan asserts only the returned exit code and the internal envelope for non-`--json` runs. | Resolved for this plan: human stdout shape is unasserted; revisit when M0-S4 ships human output | @pm |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30 | @test-plan-writer | Initial plan: 38 TCs across envelope contract (RESULT), error table (TABLE), classification chain (CLASSIFY), exit projection (EXIT), `runCli` surface and determinism (RUNCLI), failure containment (CONTAIN), redaction chokepoint (REDACT), docs/code sync (SYNC), boundary/branding/regression (BOUNDARY), and a manual contract review (REVIEW). All 16 spec ACs covered (AC-F8-1 conditional on OQ-T1), all 4 ticket ACs mapped, DM-1..DM-4 and NFR-1..NFR-10 traced; golden/invariant contracts fixed (§4.1–§4.7); GAP-1..GAP-4 recorded rather than reinterpreted |
| 1.1 | 2026-10-30 | @test-plan-writer | Touch-up after spec v1.1 (commit 3b1f5f5): GAP-1/OQ-T1 resolved — the documented table ships in-change at `doc/spec/features/feature-result-contract.md`, the sync check binds both drift directions against it from merge time, and phase 7 reconciles the surrounding feature doc without rewriting the sync-checked table section. GAP-4/OQ-T2 resolved via DEC-13 — two fallback entries, `fallback.invocation` (category `user`, `retryable: false`, consequence `unknown`, user-validation → exit 1) and `fallback.internal` (category `platform`, `retryable: false`, consequence `unknown`, platform-provider → exit 2), with the reserved two-segment `fallback` namespace recognized by the sync check (A-T11). All fallback references synced; TC IDs, count (38), tiers, thresholds, and suite structure unchanged |
| 1.2 | 2026-10-30 | @test-plan-writer | Remediation of DoR iteration 1 findings (NOT_READY). **F1 (major)**: §4.4 now defines the sync recognizer in three levels — Level A scan-level recognition (S1/S3; declared domain-kind first segment or the reserved `fallback` namespace; foreign-namespace dotted literals ignored and uncounted), Level B strict validation of source entries, Level C direct corpus input — with `tests/fixtures/result/code-corpora/**` explicitly excluded from the S3 walk so TC-SYNC-001's green path is reachable; TC-SYNC-005 steps re-targeted per level (recognized-but-undeclared code fails; foreign-namespace literal ignored as the negative control; corpus rows driven at Level C with their own failure naming; Level-separation step added); TC-SYNC-001/002/003 and RSK-T5 aligned; `tests/**/*.test.ts` declared outside S1/S3 (nit 6) and AC-F8-1's "referenced in code" grounded in S1 + Level B + Level C. **F2 (minor)**: TC-REDACT-003's split case now registers its fragments (contiguous per-registered-value replacement, plan D1 retained in kind) with per-fragment zero-occurrence and byte-exact golden assertions; §1.1, §4.5 (new item 2, renumbered), §6.2, OQ-T3, A-T13 updated; plan mirror required. **F3 (minor)**: TC-CLASSIFY-002 step 4 clarified — classify-level route distinctness only; the dispatch-level proof is TC-CONTAIN-001 in plan Phase 3. **Nit 5**: references note the companion survey predates DEC-13 and its singular fallback phrasing is superseded. No TC IDs, count (38), tiers, thresholds, or suite structure changed |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed; the result contract surface does not exist yet |
