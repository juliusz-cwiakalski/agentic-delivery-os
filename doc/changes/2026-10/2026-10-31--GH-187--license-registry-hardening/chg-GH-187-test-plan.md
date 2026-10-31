---
id: chg-GH-187-test-plan
status: Proposed
created: 2026-10-31T14:30:00Z
last_updated: 2026-10-31T14:30:00Z
owners: [engineering]
service: delivery-os repository license compliance gate
labels: [change, planning]
version_impact: none
summary: "Prove that the committed license registry states an explicit, tamper-evident deny policy in schema v3; that the existing fail-closed audit enforces deny before allow for every registry entry and every branch of a compound SPDX expression; that a missing, empty, non-array, malformed, duplicated, allow-overlapping, or family-stripped deny list and every unregistered, unknown, non-asserted, empty, or non-allow-listed license fail with a non-zero exit; that the live MIT OR Apache-2.0 dependency and the live registry still pass with zero failures; and that the binding ts-license-audit CI job stays the only, unweakened gate with no new job and no dependency or lockfile change."
links:
  change_spec: ./chg-GH-187-spec.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S18: License registry hardening

## 1. Scope and Objectives

This change turns an emergent policy into a declared one, so the tests must prove five properties and nothing beyond them: **policy explicitness** (one committed YAML artifact declares schema v3, the preserved C-2 determination, the allow list, and a required non-empty deny list covering all five mandated families and the full Appendix A baseline, with human-readable notes stating the semantics), **deny precedence** (a denied identifier fails before the allow list is consulted, at entry level *and* at registry level through an allow/deny overlap failure, so a future registry edit that allow-lists a restricted license cannot turn the gate green), **deny-list integrity** (absent, non-array, empty, non-string, empty-string, duplicate, compound, parenthesized, `WITH`-bearing, allow-overlapping, and family-stripped deny lists all fail closed), **fail-closed completeness** (unregistered dependency and use, empty license, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, unparseable expressions, and valid-but-non-allow-listed identifiers all produce a non-zero result, never an implicit pass and never prefix/substring matching), and **unchanged gate surface** (the existing `ts-license-audit` job remains the only license gate, unmodified in status and definition, with no new job, no bypass construct, and no dependency or lockfile change).

The risk this plan exists to retire is RSK-5 from the spec: a suite that asserts only the live-registry happy path and therefore proves nothing about the policy. Every AC below is bound to a **mutation** case whose expected result is a failure, and every failure class additionally has at least one spawned-process case asserting a non-zero exit code and a clean diagnostic — never log text alone.

### 1.1 In Scope

- Registry policy artifact: schema version 3, scope, C-2 determination, preserved entries/uses/verdicts/allow list, required non-empty `deny_list`, single-artifact rule, and human-readable policy notes (F-1, AC-F1-1, AC-F1-4, DM-1, DM-2, DM-3, DM-5, CON-1, CON-6, NG-2, NG-3).
- Mandatory denied families and the Appendix A floor: 5/5 families, 20/20 baseline identifiers, floor enforcement, and family-removal fail-closed (F-1, F-3, AC-F1-2, AC-F3-3, DEC-6).
- Schema-policy enforcement: old, absent, unsupported, and non-numeric `schema_version` fail closed (F-1, AC-F1-3, DM-1, DEC-5).
- Deny-before-allow enforcement for single identifiers across all five families (F-2, AC-F2-1).
- Deny-over-allow: an allow-listed *and* approved denied identifier never passes; allow/deny overlap is itself a registry policy failure (F-2, F-3, AC-F2-2, CON-2, DEC-2).
- Denied branches inside OR, AND, and nested compound expressions, plus per-branch attribution of the denial (F-2, F-6, AC-F2-3, AC-F2-1).
- Deny-list integrity matrix: presence, type, non-emptiness, entry validity, uniqueness, disjointness, and the mandatory floor (F-3, AC-F3-1, AC-F3-2, AC-F3-3, DM-2).
- Fail-closed unknowns: unregistered dependency and unregistered use; empty, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, unparseable; valid but non-allow-listed (F-4, AC-F4-1, AC-F4-2).
- Preserved per-branch compound evaluation, including the live `@biomejs/biome` `MIT OR Apache-2.0` entry, plus a blanket-rejection control (F-6, AC-F6-1, NG-4, DEC-3).
- Binding CI evidence: `ts-license-audit` present, unmodified, unweakened; no new job; `ci-topology` / `ci-bindingness` / `ci-supply-chain` / `script-surface` invariants green (F-5, AC-F5-1, NFR-4, NG-5, CON-4).
- Exit-code, stream, and diagnostic contract of the check itself, proven by spawning the real script against mutated temporary trees (F-5, spec §10, NFR-1, NFR-6).
- Determinism/offline (NFR-2, CON-8), performance bound (NFR-5), no new dependency or lockfile change (NFR-3, CON-5), and non-regression of the pre-existing licence matrix and the repository gate battery (AC-F5-2, NFR-3, NFR-4).

### 1.2 Out of Scope & Known Gaps

- [OUT] SBOM, checksum manifests, signatures, `THIRD-PARTY-NOTICES`, and a `licenses/` bundle — M4-S3 (NG-1, CON-7). Not tested, and not asserted absent.
- [OUT] Per-entry review dates, approver identity governance, re-review campaigns, and any re-review or change of existing verdicts (NG-2, NG-3). TC-LICREG-003 asserts *preservation*, not governance.
- [OUT] Rejecting all compound SPDX expressions (NG-4). TC-LICREG-019 asserts the opposite, deliberately.
- [OUT] A new CI job, a workflow redesign, an advisory mode, or a separate license-policy service (NG-5, CON-4).
- [OUT] New dependencies, network calls, external license databases, and any expansion of the audited dependency graph (NG-6, NG-7).
- [OUT] Automated legal compatibility analysis; the recorded verdicts and the C-2 determination remain a human confirmation (NG-8, RSK-6).
- [OUT] Release notes, public documentation, and user-facing license disclosure.
- [GAP-1] **AC-F1-4 is only partly automatable.** "Human-readable policy notes" is a judgement of readability and accuracy. TC-LICREG-005 automates *presence* of the five required claims through keyword groups (§4.3); wording quality is a manual review item (TC-LICREG-030). No requirement is dropped — the manual step is the residual.
- [GAP-2] **Three TCs depend on `origin/main-tools`** (TC-LICREG-003, TC-LICREG-020, TC-LICREG-028) because they compare the delivered tree against the base branch. `tests/checks/ci-checks.test.ts` and `scripts/checks/ci-topology.ts` already depend on the same ref, so this adds no new environment contract; the precondition is stated in §6.1 and a missing ref fails loudly instead of skipping.
- [GAP-3] **NFR-2's "no clock-dependent check" is proven statically, not dynamically.** A top-level script exposes no clock to stub, so TC-LICREG-025 combines repeat-run equality and input-order independence (runtime) with a source scan for clock, randomness, network, and child-process constructs (static).
- [GAP-4] **NFR-5's 30-second threshold is an upper bound only.** TC-LICREG-027 asserts the bound and records the measured value in §10 as evidence; it is not tuned as a regression budget.
- [GAP-5] **Spec §16's system-specification reconciliation has no AC** and lands in phase 7 (doc-sync). It is verified by the doc-sync phase's content check (`deny_list` and deny-precedence wording present in `doc/spec/features/feature-monorepo-scaffold-toolchain.md`), not by an AC-bound TC in this plan.
- [GAP-6] **AC-F1-1's "approved C-2 determination" is a human state.** The test asserts that the registry records a non-empty C-2 determination and that it is preserved from the base branch (CON-6). Whether the recorded text must literally say "approved" after the owner confirms it at PR review is OQ-T1; the test does not fabricate approval.
- [GAP-7] **AC-F5-1's "still binding" is a platform property.** TC-LICREG-020/021 prove the workflow definition is present, unmodified, and free of bypass constructs; the merge-blocking fact is corroborated by the required status of `ts-license-audit` on the delivery PR (recorded in §10).

## 2. References

- **Change specification**: [chg-GH-187-spec.md](./chg-GH-187-spec.md) — F-1..F-6, DM-1..DM-5, NFR-1..NFR-6, CON-1..CON-9, DEC-1..DEC-7, AC-F1-1..AC-F6-1, §10 telemetry, §12 assumptions, Appendix A (mandatory denied baseline, 20 identifiers), Appendix B (ticket-AC trace), Appendix C (compound-expression interpretation).
- **Implementation plan**: authored in delivery planning (phase 4) after this plan. TC IDs are behaviour-bound and must not depend on task numbering; plan phases map onto these TCs, not the reverse.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — canonical layers, module-to-test mapping (`scripts/checks/<check>.ts` → `bun run scripts/checks/<check>.ts` plus `tests/checks/**` mutation tests), `bun:test` convention, `pnpm check` aggregate, and the CI-file mapping (`ci-topology.ts`, `ci-bindingness.ts`, `ci-supply-chain.ts`).
- **TypeScript/test authoring rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — §9 `bun:test` authoring (injected fakes, determinism, fixtures never `*.test.ts`, no snapshot laundering) and §10 gates.
- **Authoritative decision**: [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — C-2 (Apache-2.0 repository, enforced dependency license policy denying SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC; fail-closed on unknown, `NOASSERTION`, `SEE LICENSE`, compound expressions) under the interpretation recorded in spec Appendix C.
- **Current system truth to reconcile in phase 7**: [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md) — the "License registry" section currently documents the verdict registry, allow list, and SPDX parsing without a deny list, and NFR-10 records the dependency-risk metric.
- **Code under test**: [scripts/checks/license-audit.ts](../../../../scripts/checks/license-audit.ts) — `directExternalDependencies`, `lockedUses`, `parseSpdxExpression`, `auditRegistry`, `loadRegistry`, `validate`, and the `import.meta.main` entry point that prints `FAIL license-audit: …` to stderr and exits 1, or prints `OK license-audit: …` to stdout.
- **Existing tests and fixtures**: [tests/checks/license-audit.test.ts](../../../../tests/checks/license-audit.test.ts) (twelve cases: live registry green, SPDX AND/OR parsing, unknown reference, non-allow-listed, OR with disallowed branch, AND all allowed, removed entry, empty license, unbacked allow-list entry, unparseable allow-list entry, closure/use accounting, missing/duplicate/conflicting uses, duplicate package rows) and [tests/fixtures/license/cases.json](../../../../tests/fixtures/license/cases.json).
- **Registry artifact**: [dependency-licenses.yaml](../../../legal/dependency-licenses.yaml) — the only file in `doc/legal/`; schema v2, `scope: direct-and-runtime-closure`, proposed C-2 determination, 15 entries, four-entry allow list, no deny list.
- **CI definitions and invariants**: [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) (`ts-license-audit` runs `bun run scripts/checks/license-audit.ts`), `scripts/checks/ci-topology.ts` (`TS_JOBS`, additions-only workflow diff, wiring rule), `scripts/checks/ci-bindingness.ts` (bypass scan over `ts-` jobs), `scripts/checks/ci-supply-chain.ts`, `scripts/checks/script-surface.ts`, and their mutation suite [tests/checks/ci-checks.test.ts](../../../../tests/checks/ci-checks.test.ts).
- **Sibling format/rigor reference**: [chg-GH-170-test-plan.md](../2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-test-plan.md) — TC-SCAFFOLD-035/036 established the registry-plus-mutation pattern this plan hardens.
- **Repo conventions**: [AGENTS.md](../../../../AGENTS.md) — branch model (`main-tools` is the integration base), `doc/changes/` gets no license headers, `tests/<layer>/*.test.ts` layout, fixtures never named `*.test.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Registry declares schema 3, scope, C-2 determination, allow list, and a required non-empty deny list in one committed YAML artifact | TC-LICREG-001, TC-LICREG-003 | Covered |
| AC-F1-2 | All five mandated families and every Appendix A identifier are present in the deny list | TC-LICREG-002, TC-LICREG-013, TC-LICREG-024 | Covered |
| AC-F1-3 | Old or absent schema version fails closed with a schema-policy failure | TC-LICREG-004 | Covered |
| AC-F1-4 | Human-readable notes state fail-closed unknowns, `NOASSERTION`/`SEE LICENSE` rejection, per-branch compound evaluation, and deny-over-allow | TC-LICREG-005, TC-LICREG-030 | Covered — presence automated (§4.3), wording quality manual (GAP-1) |
| AC-F2-1 | A denied identifier fails with an explicit denial naming the package and the denied identifier | TC-LICREG-006, TC-LICREG-010, TC-LICREG-022, TC-LICREG-026 | Covered |
| AC-F2-2 | A denied identifier also on the allow list never passes; the overlap is reported and the entry still fails | TC-LICREG-007, TC-LICREG-008 | Covered |
| AC-F2-3 | A denied branch in OR, AND, and nested compound expressions fails while an allowed branch is present | TC-LICREG-009, TC-LICREG-010, TC-LICREG-022 | Covered |
| AC-F3-1 | A deny list that is absent, not an array, or empty fails closed | TC-LICREG-011, TC-LICREG-022 | Covered |
| AC-F3-2 | A deny list with a non-string, empty, duplicate, compound, or otherwise malformed identifier fails closed | TC-LICREG-008, TC-LICREG-012 | Covered |
| AC-F3-3 | Removing any Appendix A identifier fails closed even when the rest of the policy is valid | TC-LICREG-013, TC-LICREG-022 | Covered |
| AC-F4-1 | An unregistered dependency use fails naming the package and the use | TC-LICREG-015, TC-LICREG-022, TC-LICREG-026 | Covered |
| AC-F4-2 | Empty, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, unparseable, and valid-but-non-allow-listed licenses fail closed naming the package and license text | TC-LICREG-016, TC-LICREG-017, TC-LICREG-022, TC-LICREG-026 | Covered |
| AC-F5-1 | `ts-license-audit` is still present and binding, no bypass is introduced, and topology plus bindingness invariants pass | TC-LICREG-020, TC-LICREG-021, TC-LICREG-022, TC-LICREG-029 | Covered — workflow assertions automated; merge-blocking corroborated by the required check on the PR (GAP-7) |
| AC-F5-2 | The extended suite covers every required class and the live registry validates with zero failures | TC-LICREG-023, TC-LICREG-024, TC-LICREG-029 | Covered |
| AC-F6-1 | The live `@biomejs/biome` `MIT OR Apache-2.0` entry passes, proving per-branch evaluation was preserved | TC-LICREG-018, TC-LICREG-019, TC-LICREG-023 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-LICREG-001, TC-LICREG-002, TC-LICREG-003, TC-LICREG-005, TC-LICREG-014; F-2 → TC-LICREG-006, TC-LICREG-007, TC-LICREG-008, TC-LICREG-009, TC-LICREG-010, TC-LICREG-014; F-3 → TC-LICREG-002, TC-LICREG-008, TC-LICREG-011, TC-LICREG-012, TC-LICREG-013; F-4 → TC-LICREG-015, TC-LICREG-016, TC-LICREG-017; F-5 → TC-LICREG-020, TC-LICREG-021, TC-LICREG-022, TC-LICREG-024, TC-LICREG-029; F-6 → TC-LICREG-009, TC-LICREG-018, TC-LICREG-019, TC-LICREG-023.

**Ticket AC coverage** (spec Appendix B, all six ticket criteria):

| Ticket criterion | Verified by | Notes |
|------------------|-------------|-------|
| A dependency with an unregistered license fails CI | TC-LICREG-015, TC-LICREG-016, TC-LICREG-017, TC-LICREG-022 | In-memory failure set plus a spawned non-zero exit for the unregistered-use and `NOASSERTION` representatives |
| A dependency with a denied license fails CI | TC-LICREG-006, TC-LICREG-007, TC-LICREG-009, TC-LICREG-013, TC-LICREG-022 | All five families, deny-over-allow, denied compound branches, floor removal |
| Deny list enforced for SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC | TC-LICREG-002, TC-LICREG-006, TC-LICREG-013 | 5/5 families and 20/20 baseline identifiers are asserted, never sampled silently |
| CI gate reads the registry and fails closed on unknown licenses | TC-LICREG-001, TC-LICREG-011, TC-LICREG-016, TC-LICREG-020, TC-LICREG-022 | The gate reads the committed artifact from `cwd`; the contract is exercised against mutated temporary trees |
| Registry remains machine-parseable and human-readable | TC-LICREG-001, TC-LICREG-005, TC-LICREG-030 | YAML parse plus policy-note keyword groups plus manual readability review |
| No gate weakening and no new CI job | TC-LICREG-020, TC-LICREG-021, TC-LICREG-029 | Job block byte-equal to base, no bypass token, job-id set unchanged, aggregate chain unchanged |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP/REST surface and no events or messages exist in this change (spec §8.1, §8.2). The interface is a committed YAML artifact plus a process exit contract.

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| DM-1 | Registry `schema_version` advances 2 → 3; any other value is rejected rather than accepted with an implicit empty policy | TC-LICREG-001, TC-LICREG-004 | Covered |
| DM-2 | `deny_list`: required, non-empty array of single denied identifiers; duplicates, malformed entries, and allow-list overlap invalid | TC-LICREG-001, TC-LICREG-002, TC-LICREG-011, TC-LICREG-012, TC-LICREG-013 | Covered |
| DM-3 | `allow_list`: required, contents still exactly backed by approved verdicts; no deny identifier appears in it | TC-LICREG-001, TC-LICREG-003, TC-LICREG-023 | Covered |
| DM-4 | Existing entry/use/verdict model unchanged; every audited use still maps to an approved entry | TC-LICREG-003, TC-LICREG-015, TC-LICREG-023 | Covered |
| DM-5 | Policy semantics (deny precedence, per-branch evaluation, unknown/non-asserted failure, allow/verdict consistency) encoded in comments and enforced by the audit; floor may not be removed | TC-LICREG-001, TC-LICREG-002, TC-LICREG-005, TC-LICREG-008, TC-LICREG-013 | Covered |
| Process exit + streams (spec §10) | Non-zero on any failure, zero only when registry and closure fully pass; `FAIL license-audit:` on stderr, `OK license-audit:` on stdout only on success | TC-LICREG-022, TC-LICREG-026 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | 100% of enumerated denied, unregistered, unknown, non-asserted, malformed, overlapping, and family-stripped cases produce a non-zero result; 0 false passes | TC-LICREG-006 through TC-LICREG-019, TC-LICREG-022, TC-LICREG-024 | Covered — completeness is itself asserted (TC-LICREG-024), so a missing case cannot pass silently |
| NFR-2 | Determinism and offline operation: identical inputs produce identical failure sets; 0 network, 0 clock-dependent checks, 0 random ordering | TC-LICREG-025 | Covered — repeat-run and order-independence at runtime; clock/random/network absence proven statically (GAP-3) |
| NFR-3 | 0 new dependencies, 0 lockfile changes, 0 new CI jobs | TC-LICREG-028, TC-LICREG-020, TC-LICREG-003 | Covered |
| NFR-4 | `ts-license-audit` stays binding; 0 `continue-on-error`, 0 shell-truthy suffixes, 0 `set +e`, or equivalent; topology and bindingness invariants pass | TC-LICREG-020, TC-LICREG-021, TC-LICREG-029 | Covered |
| NFR-5 | Live audit completes within 30 s with no additional job timeout | TC-LICREG-027 | Covered — upper bound asserted, measured value recorded (GAP-4) |
| NFR-6 | 100% of failures name package, use (where applicable), license text or identifier, and reason; expected validation failures produce no uncaught stack trace | TC-LICREG-022, TC-LICREG-026, TC-LICREG-010 | Covered — uses the failure-class vocabulary fixed in §4.2 |

## 4. Test Types and Layers

Two runners, deliberately separated, plus one manual review. **`bun test`** owns every behavioural and mutation assertion that runs in-process (a cloned registry evaluated against the real dependency closure) *and* the spawned-process cases that need a real exit code. **`bun run scripts/checks/*.ts`** owns repository invariants whose assertion is "this gate exits zero on the delivered tree". Existing bash suites are run, never extended, by this change.

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Audit unit + mutation (in-memory clone) | `bun test tests/checks` | `tests/checks/license-audit.test.ts` (extend; existing cases preserved) | TC-LICREG-006, TC-LICREG-009, TC-LICREG-010, TC-LICREG-014, TC-LICREG-015, TC-LICREG-016, TC-LICREG-017, TC-LICREG-018, TC-LICREG-019, TC-LICREG-023 |
| Registry-policy suite | `bun test tests/checks` | `tests/checks/license-policy.test.ts` (new) | TC-LICREG-001, TC-LICREG-002, TC-LICREG-003, TC-LICREG-004, TC-LICREG-005, TC-LICREG-007, TC-LICREG-008, TC-LICREG-011, TC-LICREG-012, TC-LICREG-013, TC-LICREG-024 |
| Spawned exit/stream suite | `bun test tests/checks` | `tests/checks/license-audit-exit.test.ts` (new) + `tests/checks/license-fixture.ts` (new helper) | TC-LICREG-022, TC-LICREG-025, TC-LICREG-026, TC-LICREG-027 |
| CI binding + non-weakening suite | `bun test tests/checks` | `tests/checks/license-ci-binding.test.ts` (new) | TC-LICREG-020, TC-LICREG-021, TC-LICREG-028, TC-LICREG-029 |
| Repository invariant checks | `bun run scripts/checks/{check}.ts` | `scripts/checks/license-audit.ts` (updated), `ci-topology.ts`, `ci-bindingness.ts`, `ci-supply-chain.ts`, `script-surface.ts` (unchanged) | TC-LICREG-020 step 6, TC-LICREG-021, TC-LICREG-023 |
| Fixture data | read-only | `tests/fixtures/license/{cases.json,deny-baseline.json,deny-list-cases.json}` | Matrix inputs for TC-LICREG-002 through TC-LICREG-024 |
| Aggregate regression | `pnpm check` | repo root | TC-LICREG-029 |
| Manual policy review | PR review record | — | TC-LICREG-030 |

All new suites live under `tests/checks/**`, which root `bun test` discovers (`bunfig.toml` root discovery) and which `ts-test` / `ts-aggregate` already run. No new `scripts/checks/*.ts` file is added, so the `ci-topology.ts` wiring rule and `TS_JOBS` stay untouched and no CI job is added (NG-5).

### 4.1 Registry policy contract (binding for F-1, F-2, F-3, DM-1, DM-2)

The audit's policy layer must satisfy the following, in this order, with these observable consequences:

1. **Schema gate.** `schema_version` must be the number `3`. Anything else — `2`, absent, `"3"`, `4`, `null` — produces a schema-policy failure. Accepting a registry without the deny contract is a failure, not a warning (DM-1, DEC-5, spec §8.5).
2. **`deny_list` integrity.** Required; must be an array; must be non-empty; every entry must be a single identifier; entries must be unique; the list must be disjoint from `allow_list`; and it must contain every Appendix A identifier.
3. **Single-identifier grammar.** A deny entry is a single token matching the registry's existing identifier syntax (`^[A-Za-z0-9.+-]+$`, the base pattern `parseSpdxExpression` already applies). Operators (`AND`, `OR`, `WITH`), parentheses, whitespace (including leading or trailing padding), and any multi-token value are malformed policy. `Commons-Clause` and `BUSL-1.0` are therefore valid entries; `(SSPL-1.0)` and `MIT OR SSPL-1.0` are not. The grammar is not stated verbatim in the spec (OQ-T2); this plan binds it to the audit's existing identifier pattern rather than inventing a new one.
4. **Deny before allow, per identifier, per branch.** For every entry license, parse to identifier branches; for each branch check denial first, then `LicenseRef-`, then allow-list membership. A denied branch fails regardless of allow-list membership and regardless of the verdict.
5. **Registry-level contradiction.** An allow/deny overlap is a policy failure independent of any entry. When an entry also uses the overlapping identifier, both the entry-level denial and the registry-level overlap appear.
6. **Mandatory floor.** The Appendix A baseline is enforced from code, not from the registry file alone. The exported floor set and the baseline fixture must be identical (code↔fixture sync), the registry must contain the baseline, and removing any baseline identifier from a registry whose allow list and verdicts remain otherwise valid still fails.
7. **Existing semantics preserved.** Entry/use/verdict shape, unregistered-use detection, duplicate and wrong-version detection, the allow-list-backed-by-approved-verdict bijection, and the empty-license failure keep their current behaviour and message vocabulary.

### 4.2 Failure-class vocabulary (binding for NFR-6 and spec §10)

Every failure today already names the package and the offending value, and the existing vocabulary covers most of §10's classes. The hardening adds the denied class and extends the malformed-policy class with schema policy, deny-list integrity, allow/deny overlap, and the mandatory floor, plus explicit non-asserted detection. Tests assert *semantic* markers, not full sentences: each class has required tokens that must all appear in at least one failure for the trigger, plus a "must not be only" guard that keeps classes distinguishable.

| Class | Trigger examples | Required tokens (all must appear) | Must not be reported *only* as |
|-------|------------------|-----------------------------------|-------------------------------|
| Denied license | entry or branch `SSPL-1.0`, `BUSL-1.1`, `Elastic-2.0`, `Commons-Clause`, `CC-BY-NC-*` | package, license text, the denied identifier, `denied` | `not allow-listed` |
| Unknown license reference | `LicenseRef-Proprietary`, `LicenseRef-scancode-unknown` | package, license text, identifier, `unknown license reference` | `not allow-listed` |
| Non-asserted / unparseable | `NOASSERTION`, `SEE LICENSE`, `""`, `"MIT OR"`, `WITH` | package, raw license text, and either `not a valid SPDX expression` (unparseable) or `non-asserted` (non-asserted marker) | `not allow-listed` |
| Empty license | `""`, `"   "` | package, `empty license` | — (existing wording) |
| Non-allow-listed branch | `GPL-3.0-only`, `MPL-2.0`, a compound's allowed twin | package, license text, identifier, `not allow-listed` | `denied` |
| Unregistered dependency or use | removed entry, removed use, synthetic use | package, owner, field, version, and `missing registry entry` / `missing registered use` / `unverified use` | — (existing wording) |
| Malformed registry policy | deny list absent, empty, non-array, malformed, duplicate | `deny_list`, the offending value or its index, and the reason (`absent`, `not an array`, `empty`, `duplicate`, `not a single identifier`) | — |
| Allow/deny overlap | `MIT` in `allow_list` and `deny_list` | `deny_list`, `allow_list`, the identifier | — |
| Schema policy | `schema_version` not 3 | `schema`, the observed value or its absence | — |
| Mandatory floor | one baseline identifier removed | `deny_list`, the missing identifier | — |
| Allow-list/verdict drift | allow entry not backed by an approved verdict; approved identifier missing from the allow list | `allow_list`, identifier, `not backed by an approved verdict` / `missing` | — |

Implementation note (evidence, not a new requirement): today `NOASSERTION` parses as an ordinary identifier and would surface as `not allow-listed`, while `SEE LICENSE` surfaces as `not a valid SPDX expression`. To satisfy §10's distinct-class requirement, delivery must add explicit non-asserted detection for `NOASSERTION`, `NONE`, and `SEE LICENSE`. Denial, deny-list integrity, overlap, schema, and floor classes do not exist in the current audit at all and are new by definition.

### 4.3 Policy-note assertion contract (binding for AC-F1-4)

TC-LICREG-005 reads the YAML file as text, isolates the leading comment block (lines beginning with `#` before the first data line) plus any trailing comments, and requires one span per group. Assertions are group-based so wording may evolve, while the *claim* cannot disappear:

| Group | Required presence (case-insensitive) |
|-------|--------------------------------------|
| Fail-closed unknowns | `fail` + `closed`, and `unregistered` or `unknown` |
| Non-asserted rejection | `NOASSERTION`, and `SEE LICENSE` |
| Per-branch compound evaluation | (`compound` or `branch`), and (`each` or `every` or `individually` or `per`) |
| Deny precedence | `deny`, and (`wins` or `overrides` or `takes precedence` or `before`), and `allow` |
| Allow list backed by verdicts | `approved`, and `allow` |

The assertion reads comments only, so an entry's license text cannot satisfy a policy claim. Readability and accuracy are TC-LICREG-030.

### 4.4 Mutation harness contract (binding for "non-zero, not log text")

Two harness kinds, each with a fixed job:

1. **In-memory clone (fast, exhaustive).** `const registry = clone()` deep-copies the live registry from `loadRegistry(ROOT)`; the mutation is applied to the clone; `auditRegistry(registry, lockedUses(ROOT, directExternalDependencies(ROOT)))` or `validate(ROOT, registry)` returns the failure set. **The live tree is never written.** Every enumerated matrix case uses this harness, so the whole matrix runs in one process.
2. **Spawned temporary tree (slow, exit-code proof).** `tests/checks/license-fixture.ts` builds a tree under `mkdtemp` containing exactly `package.json`, `packages/{core,adapters,cli,mcp,opencode,testkit}/package.json` (those that exist), `pnpm-lock.yaml`, and the mutated `doc/legal/dependency-licenses.yaml`. It then runs `spawnSync("bun", ["run", join(ROOT, "scripts/checks/license-audit.ts")], { cwd: tree })` — the same absolute-script/foreign-cwd pattern already used by `tests/checks/ci-checks.test.ts`, which works because the script resolves `yaml` from its own directory while reading registry and lockfile from `cwd`. The tree is removed in a `finally`.

**Assertion discipline (non-negotiable).**

- A negative case passes only when the failure set is non-empty **and** the expected class marker, package, and offending value are present. "The output contains the word `FAIL`" is never sufficient.
- Every spawned failure case asserts `status !== 0` (expected `1`), `stderr` matching `FAIL license-audit: `, `stdout` **not** containing `OK license-audit`, and `stderr` free of stack traces (`/^\s+at /m` and `/\bError:\s/` absent).
- The live spawned case asserts `status === 0`, `stdout` starting with `OK license-audit:`, and empty `stderr`.
- Every class in §4.2 gets at least one spawned case (TC-LICREG-022); the 20-identifier floor and every malformed-entry variant stay in-memory.
- Cross-run comparisons of failure sets use sorted sets; repeat-run comparisons on identical input assert exact array equality.

### 4.5 Anti-vacuity and non-weakening controls

Each control exists so that a green run cannot mean "the assertion never fired":

1. **Live green control** (TC-LICREG-023): `validate(ROOT)` is `[]` and the spawned audit exits 0.
2. **Mutation-applies control** (TC-LICREG-006 step 6, TC-LICREG-009 control rows): an allowed license on the same mutable entry yields zero failures, proving the mutation reaches the assertion.
3. **Extension control** (TC-LICREG-013 step 6): baseline intact *plus* an extra identifier is accepted, proving the floor is a minimum and not an exact-match whitelist.
4. **Compound control** (TC-LICREG-019): all-allowed compounds pass, proving the parser was not switched to blanket rejection.
5. **Matrix-completeness control** (TC-LICREG-024): declared case ids, class tokens, family coverage, and baseline coverage are asserted, and an unknown class token fails the meta-check.
6. **No-test-removal control** (TC-LICREG-029 step 1): the pre-change test titles, read from `git show origin/main-tools:tests/checks/license-audit.test.ts`, must still be present in the delivered file.
7. **Isolation control** (TC-LICREG-029 step 7): `git status --porcelain` is empty after the suite; no test writes the live tree.

### 4.6 Pass/fail thresholds and CI vs local

| Suite | Command | Pass threshold | CI | Local |
|-------|---------|----------------|----|-------|
| Audit unit + mutation | `bun test tests/checks/license-audit.test.ts` | 100% pass; 0 skipped/todo/only; every enumerated case exercised; no case whose only assertion is a log substring | `ts-test`, `ts-aggregate` | Required before hand-off |
| Registry policy | `bun test tests/checks/license-policy.test.ts` | 100% pass; 20/20 floor-removal cases; 5/5 families; all presence/type/emptiness/malformed variants | `ts-test`, `ts-aggregate` | Required |
| Spawned exit/stream | `bun test tests/checks/license-audit-exit.test.ts` | 1 live green case plus at least one spawned case per failure class; every case asserts exit code, streams, and stack-trace absence | `ts-test`, `ts-aggregate` | Required |
| CI binding + non-weakening | `bun test tests/checks/license-ci-binding.test.ts` | Job present, block byte-equal to base, no bypass token, job-id set unchanged, no lockfile/manifest diff | `ts-test`, `ts-aggregate` | Required |
| Invariants | `bun run scripts/checks/license-audit.ts`; `ci-topology.ts`; `ci-bindingness.ts`; `ci-supply-chain.ts`; `script-surface.ts` | All exit 0 on the delivered tree | `ts-license-audit`, `ts-invariants`, `ts-aggregate` | Run before push |
| Regression | `pnpm check`; `bash scripts/.tests/test-*.sh`; `bash tools/.tests/test-*.sh` | Green; workflow additions-only; no new dependency | `ts-aggregate`, bash jobs | Final local verification |
| Manual | PR review record | Every TC-LICREG-030 item confirmed | PR review | Required |

Runtime budget: the matrix is in-process and touches only the committed lockfile plus six manifests; each spawned case copies roughly 60 KB of lockfile and a few JSON files. Target well under one minute added to `ts-test`. Every suite is hermetic: no network, no clock, no writes to the live tree, no `dist/` dependency.

### 4.7 Test-case ID namespace

This plan uses `TC-LICREG-###`. `TC-LICENSE-001` is already bound in the concurrent GH-188 change to a different regression scenario ("license registry stays complete under the chosen bases"), and the scenario-ID rules forbid reusing an ID for a different scenario. `LICREG` (license registry) keeps GH-187's thirty cases disjoint from GH-188 and from GH-170's `TC-SCAFFOLD-035/036`, which remain the provenance of the audit's original behaviour.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Level | Priority | AC coverage |
|-------|-------|---------------|-------|----------|-------------|
| TC-LICREG-001 | Registry declares the schema-v3 policy artifact in one file | Happy Path | unit | High | AC-F1-1, DM-1, DM-2, DM-3, DM-5 |
| TC-LICREG-002 | Five families and the full Appendix A baseline are denied | Happy Path | unit | High | AC-F1-2, DM-2, DM-5 |
| TC-LICREG-003 | Existing entries, uses, verdicts, and allow list are preserved | Regression | unit | High | AC-F1-1, DM-3, DM-4, CON-6 |
| TC-LICREG-004 | Old, absent, or unsupported schema version fails closed | Negative | unit | High | AC-F1-3, DM-1 |
| TC-LICREG-005 | Human-readable policy notes state the five policy claims | Happy Path | unit | Medium | AC-F1-4, DM-5 |
| TC-LICREG-006 | Every mandated denied identifier fails with an explicit denial | Negative | unit | Critical | AC-F2-1, NFR-1 |
| TC-LICREG-007 | Deny wins over allow for an allow-listed and approved denied identifier | Negative | unit | Critical | AC-F2-2, NFR-1 |
| TC-LICREG-008 | Allow/deny overlap is a registry policy failure on its own | Negative | unit | High | AC-F2-2, AC-F3-2 |
| TC-LICREG-009 | A denied branch fails in OR, AND, and nested expressions | Negative | unit | Critical | AC-F2-3 |
| TC-LICREG-010 | Denial is attributed per branch and names only denied branches | Corner Case | unit | High | AC-F2-1, AC-F2-3, NFR-6 |
| TC-LICREG-011 | Missing, non-array, or empty deny list fails closed | Negative | unit | Critical | AC-F3-1 |
| TC-LICREG-012 | Malformed, empty, duplicate, compound, and padded deny entries fail closed | Negative | unit | Critical | AC-F3-2 |
| TC-LICREG-013 | Removing any Appendix A identifier fails closed | Negative | unit | Critical | AC-F1-2, AC-F3-3 |
| TC-LICREG-014 | Extra deny identifiers work without a code change; no prefix or substring matching | Corner Case | unit | High | AC-F2-1, AC-F1-2 |
| TC-LICREG-015 | Unregistered dependency and unregistered use fail closed | Negative | unit | Critical | AC-F4-1, DM-4 |
| TC-LICREG-016 | Empty, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, and unparseable licenses fail closed | Negative | unit | Critical | AC-F4-2 |
| TC-LICREG-017 | Valid but non-allow-listed identifiers fail closed | Negative | unit | High | AC-F4-2 |
| TC-LICREG-018 | The live `@biomejs/biome` `MIT OR Apache-2.0` entry passes | Happy Path | unit | Critical | AC-F6-1 |
| TC-LICREG-019 | Blanket compound rejection was not introduced | Corner Case | unit | High | AC-F6-1, NG-4 |
| TC-LICREG-020 | `ts-license-audit` is present, unmodified, binding, and not joined by a new job | Regression | check test | Critical | AC-F5-1, NFR-4 |
| TC-LICREG-021 | CI topology, bindingness, supply-chain, and surface invariants are green | Regression | check test | High | AC-F5-1, NFR-4 |
| TC-LICREG-022 | Spawned audit exits non-zero with clean diagnostics for every failure class | Negative | check test | Critical | AC-F2-1, AC-F2-3, AC-F3-1, AC-F3-3, AC-F4-1, AC-F4-2, AC-F5-1, NFR-1, NFR-6 |
| TC-LICREG-023 | The live registry validates with zero failures and closure accounting is preserved | Happy Path | unit | Critical | AC-F5-2, AC-F6-1, DM-3, DM-4 |
| TC-LICREG-024 | The matrix is complete, registered, and non-vacuous | Corner Case | unit | High | AC-F5-2, AC-F1-2, NFR-1 |
| TC-LICREG-025 | Audit behaviour is deterministic, order-independent, and offline | Regression | check test | Medium | NFR-2 |
| TC-LICREG-026 | Every failure is diagnosable and classes stay distinguishable | Corner Case | check test | High | NFR-6, AC-F2-1, AC-F4-1, AC-F4-2 |
| TC-LICREG-027 | Live audit completes within the 30-second bound | Performance | check test | Medium | NFR-5 |
| TC-LICREG-028 | No new dependency and no lockfile or manifest change | Regression | check test | High | NFR-3, CON-5 |
| TC-LICREG-029 | Pre-existing matrix and repository gate battery are unchanged and green | Regression | check test | Critical | AC-F5-1, AC-F5-2, NFR-3, NFR-4 |
| TC-LICREG-030 | Manual policy and diagnostic review | Happy Path | manual | Medium | AC-F1-4, AC-F5-1 |

### 5.2 Scenario Details

#### TC-LICREG-001 - Registry declares the schema-v3 policy artifact in one file

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-2, DM-3, DM-5, CON-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @registry, @policy

**Preconditions**:

- `doc/legal/dependency-licenses.yaml` carries the hardened policy.
- The registry parses through `loadRegistry(ROOT)` with the repository's `yaml` parser.

**Steps**:

1. Load the registry; assert it parses and that its top-level keys include `schema_version`, `scope`, `c2_determination`, `entries`, `allow_list`, and `deny_list` — all in the one file under `doc/legal/`.
2. Assert `schema_version === 3` as a number (strict equality, so `"3"` also fails here; TC-LICREG-004 owns the failure message).
3. Assert `scope === "direct-and-runtime-closure"`.
4. Assert `c2_determination` is a non-empty trimmed string.
5. Assert `allow_list` is a non-empty array whose every entry is a single identifier (parses to exactly one identifier, no operator, no parenthesis, no whitespace affix), and that the allow set equals the set of identifiers derived from `approved` verdicts (the DM-3 bijection).
6. Assert `deny_list` is an array with at least 20 entries, every entry a single identifier, no duplicates, and no identifier shared with `allow_list`.
7. Assert `readdirSync("doc/legal")` contains exactly one entry (`dependency-licenses.yaml`), so no companion policy file was introduced (CON-1). A later change that deliberately adds a legal document updates this assertion.
8. Assert `entries` is a non-empty array and every element still carries `package`, `version`, `license`, `uses`, and `verdict`.

**Expected Outcome**:

- The single committed artifact states the whole policy: schema version, scope, determination, entries, allow list, deny list.
- Zero parse errors, zero missing policy field, zero companion policy file.
- The allow list is exactly backed by approved verdicts, so the policy contains no internally contradictory declaration.

#### TC-LICREG-002 - Five families and the full Appendix A baseline are denied

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-2, DM-2, DM-5, DEC-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts` + `tests/fixtures/license/deny-baseline.json`
**Tags**: @license, @deny-list, @baseline

**Preconditions**:

- `tests/fixtures/license/deny-baseline.json` records the Appendix A baseline as five families with their identifiers plus a flat identifier list.
- The fixture is itself asserted to contain 5 families and 20 identifiers, so a truncated fixture cannot weaken the check.

**Steps**:

1. Assert the fixture declares exactly SSPL, BUSL, Elastic License, Commons Clause, and CC-BY-NC with identifier counts 1, 2, 1, 1, 15 — total 20.
2. Assert every fixture identifier appears in the registry `deny_list` (baseline ⊆ registry).
3. Assert every baseline identifier appears exactly once in `deny_list` (no duplicate that could mask a later removal).
4. Assert at least one identifier per family is present, naming the family in the assertion message so a missing family is reported by name.
5. Assert the audit's exported mandatory-floor set equals the fixture's flat identifier list in both directions (code↔fixture sync: neither side may drift alone).
6. Assert each `deny_list` entry is a single identifier (reusing the TC-LICREG-012 grammar helper) and that no entry contains `AND`, `OR`, `WITH`, or parentheses.

**Expected Outcome**:

- 5/5 mandated families and 20/20 baseline identifiers are declared and denied.
- The code floor and the test fixture cannot diverge silently.
- No deny entry is an expression, so the policy remains a set of exact identifiers.

#### TC-LICREG-003 - Existing entries, uses, verdicts, and allow list are preserved

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-3, DM-4, CON-6, NG-2, NG-3, NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @registry, @regression

**Preconditions**:

- `origin/main-tools` is fetched (same precondition as `scripts/checks/ci-topology.ts` and `tests/checks/ci-checks.test.ts`).

**Steps**:

1. Read the base registry with `git show origin/main-tools:doc/legal/dependency-licenses.yaml` and parse it.
2. Assert the base declares `schema_version: 2` and the delivered registry declares `3` — the schema bump is the only structural change.
3. Assert the delivered `entries` are equal, as a package-keyed set, to the base `entries`: same package set, and for each package the same `version`, `license`, `uses` (owner/field/version triples), and `verdict`.
4. Assert `allow_list` is set-equal to the base `allow_list` (four identifiers, order-insensitive).
5. Assert `scope` and `c2_determination` are preserved verbatim from the base (semantics unchanged; OQ-T1 covers whether the wording must later record owner approval).
6. Assert the top-level data-key difference between base and delivered is exactly `{deny_list}` — no entry, use, verdict, or allow-list value was edited to accommodate the new policy.
7. If `origin/main-tools` is unavailable, fail with a message naming the missing ref rather than skipping (GAP-2).

**Expected Outcome**:

- The change is additive at the data level: one new required field plus the schema bump.
- No existing verdict, use, version, or allow-list entry was silently re-reviewed or dropped (NG-2, NG-3, CON-6).
- A future accidental registry rewrite that touches verdicts fails this test.

#### TC-LICREG-004 - Old, absent, or unsupported schema version fails closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, DM-1, DEC-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @schema, @fail-closed

**Preconditions**:

- A valid in-memory clone of the delivered registry, including a complete deny list.

**Steps**:

1. Apply each schema mutation to a fresh clone, changing nothing else: `schema_version: 2` (the old contract), the key deleted, `schema_version: "3"` (string), `schema_version: 4` (future), `schema_version: null`, and the key removed while `deny_list` is present.
2. For each, compute `auditRegistry(registry, dependencies())` and assert the failure set is non-empty.
3. Assert at least one failure contains `schema` and names the observed value or its absence.
4. Assert the schema failure is not merely dependency-driven: it must appear while entries, uses, verdicts, and the allow list are untouched.
5. Control: restore `schema_version: 3` on the same clone and assert zero failures, proving the mutation is the cause.

**Expected Outcome**:

- A registry that predates the deny-list contract is rejected, never accepted with an implicit empty policy (spec §8.5).
- A future schema bump is also fail-closed until the audit is updated deliberately.
- The control proves the assertion is caused by the schema field alone.

#### TC-LICREG-005 - Human-readable policy notes state the five policy claims

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-4, DM-5
**Test Type(s)**: Unit (content check)
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @policy, @content

**Preconditions**:

- The registry header comments state the policy (F-1.1).
- The five keyword groups are defined in §4.3.

**Steps**:

1. Read `doc/legal/dependency-licenses.yaml` as raw text and isolate the comment block before the first data line (plus any trailing comments).
2. Assert group 1: `fail`+`closed` and (`unregistered` or `unknown`) appear in the comment block.
3. Assert group 2: `NOASSERTION` and `SEE LICENSE` both appear.
4. Assert group 3: (`compound` or `branch`) and (`each` or `every` or `individually` or `per`) appear.
5. Assert group 4: `deny` and (`wins` or `overrides` or `takes precedence` or `before`) and `allow` appear.
6. Assert group 5: `approved` and `allow` appear (allow list backed by approved verdicts).
7. Assert each group is satisfied by comment lines only: a claim that appears only in entry data does not satisfy the group.
8. Record that wording accuracy and readability are TC-LICREG-030.

**Expected Outcome**:

- A maintainer reading only the committed file learns the whole policy: fail-closed unknowns, non-asserted rejection, per-branch compounds, deny precedence, and allow-list backing.
- Removing a policy claim fails the suite rather than silently degrading the artifact's human-readable contract (GAP-1 records the residual judgement).

#### TC-LICREG-006 - Every mandated denied identifier fails with an explicit denial

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, NFR-1
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @deny-list, @fail-closed, @negative

**Preconditions**:

- A clone of the live registry with the full deny list present.
- The mutable probe entry (`typescript`) is present in the real dependency closure and its live license `Apache-2.0` is allow-listed, so the probe starts green.

**Steps**:

1. Assert the probe entry exists and its unmodified license produces zero failures.
2. For each of the 20 Appendix A identifiers, set the probe entry's license to that single identifier and compute `auditRegistry`.
3. For each case assert: the failure set is non-empty; at least one message contains the package name, the license text, the denied identifier, and the `denied` class marker (§4.2); and no message reports the identifier as accepted.
4. Assert per-family coverage: SSPL, BUSL, Elastic, Commons Clause, and CC-BY-NC each contribute at least one failing case, and report the family in the assertion message.
5. Assert the count of failing cases is exactly 20 (no case silently skipped).
6. Assert the same probe with an allow-listed identifier (`MIT`) yields zero failures (mutation-applies control).

**Expected Outcome**:

- 20/20 denied identifiers fail explicitly, naming the package and the identifier (the spec's 100% metric).
- A denied identifier is never described as merely "not allow-listed" — the denial class is distinct (§4.2).
- The probe control proves the harness reaches the assertion.

#### TC-LICREG-007 - Deny wins over allow for an allow-listed and approved denied identifier

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-3, AC-F2-2, NFR-1, CON-2, DEC-2
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @deny-precedence, @fail-closed

**Preconditions**:

- The deny list contains `SSPL-1.0` (baseline), and the probe entry is approved.

**Steps**:

1. Clone the registry; append `SSPL-1.0` to `allow_list`; set the probe entry license to `SSPL-1.0`; keep `verdict: approved`.
2. Run `validate(ROOT, registry)` so entry checks, the overlap check, and the allow/verdict bijection all run.
3. Assert the failure set is non-empty.
4. Assert a denial-class failure exists naming the package and `SSPL-1.0`.
5. Assert an overlap-class failure exists naming `deny_list`, `allow_list`, and `SSPL-1.0`.
6. Assert the entry-level check fails on its own: run `auditRegistry` with only the entry mutation and assert the denial is still reported.
7. Assert no failure reads as acceptance (no message contains `OK` or a zero-failure indication).
8. Repeat steps 1–5 for one identifier from each remaining family (`BUSL-1.1`, `Elastic-2.0`, `Commons-Clause`, `CC-BY-NC-4.0`) to prove precedence is family-independent.

**Expected Outcome**:

- A denied identifier never becomes acceptable through an allow-list edit, even when an approved verdict also backs it.
- The contradictory declarations are themselves reported, so a reviewer sees the policy edit that attempted the pass.
- Zero false passes for the five family representatives.

#### TC-LICREG-008 - Allow/deny overlap is a registry policy failure on its own

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-2, AC-F3-2, CON-2
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @deny-list, @policy-integrity

**Preconditions**:

- The deny-list policy validator is reachable independently of entries (a minimal registry object with `allow_list` and `deny_list` is enough; the exact exported name is bound by delivery).

**Steps**:

1. Feed the policy validator a minimal registry with `allow_list: ["MIT"]` and `deny_list: ["MIT"]` and no entries; assert the failure names both lists and `MIT`.
2. Feed it a registry where the overlap is an identifier no entry uses (`allow_list: ["MIT","Zlib"]`, deny list = baseline plus `Zlib`); assert the overlap is reported with zero entry involvement, proving overlap detection does not depend on a dependent entry.
3. Feed it a registry with disjoint lists; assert zero overlap failures (control).
4. Assert multiple overlaps yield one failure per overlapping identifier (set semantics, no duplicate message for the same identifier).
5. Feed the live clone with `MIT` appended to the deny list through `validate(ROOT, registry)`; assert an overlap failure is present alongside the resulting entry-level denials.

**Expected Outcome**:

- Contradictory policy declarations fail even when nothing consumes the identifier, so the two lists cannot silently disagree.
- Overlap reporting names the identifier and both lists (NFR-6).
- A disjoint policy produces no overlap noise (control).

#### TC-LICREG-009 - A denied branch fails in OR, AND, and nested expressions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-6, AC-F2-3, DEC-3
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts` + `tests/fixtures/license/cases.json`
**Tags**: @license, @compound, @fail-closed

**Preconditions**:

- `tests/fixtures/license/cases.json` gains the compound cases below (the fixture is the case definition and the suite loops over it).

**Steps**:

1. For each denied-compound case, set the probe entry license to the expression and assert the failure set is non-empty, names the package, names the denied identifier, and names the license text: `MIT OR SSPL-1.0`, `MIT AND Elastic-2.0`, `Commons-Clause OR MIT`, `MIT OR BUSL-1.0`, `(MIT OR Apache-2.0) AND (ISC OR BUSL-1.1)`, `MIT OR (Apache-2.0 AND CC-BY-NC-4.0)`, `((MIT OR ISC) AND SSPL-1.0)`.
2. For each case assert the denied identifier is the only denial reported (the allowed twin is not reported as denied).
3. Assert each expression parses to the expected identifier set (parser sanity: the case reaches branch evaluation instead of failing to parse).
4. Control rows that must produce zero failures: `(MIT AND ISC) OR Apache-2.0` and `((MIT))`.
5. Assert the denied-compound case count is 7 and the control count is 2 (no silent fixture truncation).

**Expected Outcome**:

- Every denied branch — OR, AND, nested, and doubly nested — fails, and an allowed branch never rescues it.
- Parser sanity proves the failures come from branch evaluation, not from a parse error, which would make the test vacuous.
- All-allowed compounds still pass, so the change did not become blanket rejection (see TC-LICREG-019).

#### TC-LICREG-010 - Denial is attributed per branch and names only denied branches

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-3, NFR-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @compound, @diagnostics

**Preconditions**:

- Same harness as TC-LICREG-009.

**Steps**:

1. Set the probe license to `MIT AND BUSL-1.0`; collect denial-class messages only; assert exactly one, naming `BUSL-1.0` and not `MIT`.
2. Set the probe license to `SSPL-1.0 AND BUSL-1.1`; assert exactly two denial-class messages, one per denied identifier, each naming its own identifier.
3. Set the probe license to `MIT OR Apache-2.0`; assert zero denial-class messages and zero failures.
4. Set the probe license to `SSPL-1.0` (single); assert exactly one denial-class message.
5. Assert the denial count equals the number of denied branches in every step (1 → 1, 2 → 2, 0 → 0).

**Expected Outcome**:

- Denial reporting is per branch, so a reviewer sees which identifier is restricted rather than only that the package failed.
- Allowed branches are never mislabelled as denied, which would make the message misleading.
- Counting makes the per-branch claim falsifiable rather than illustrative.

#### TC-LICREG-011 - Missing, non-array, or empty deny list fails closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DM-2
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @deny-list, @policy-integrity, @fail-closed

**Preconditions**:

- A clone whose `allow_list`, `entries`, `scope`, and `c2_determination` are untouched, so the deny list is the only mutated field.

**Steps**:

1. For each mutation — `deny_list` key deleted, `undefined`, `null`, `"SSPL-1.0"` (string), `{ SSPL: ["SSPL-1.0"] }` (object), `[]` (empty array), and `deny_list` deleted while `allow_list` is extended to cover `SSPL-1.0` — compute `validate(ROOT, registry)`.
2. Assert the failure set is non-empty for every mutation.
3. Assert at least one message contains `deny_list` and one of the reasons `absent`, `not an array`, or `empty`.
4. Assert each message names the registry field it concerns, so a maintainer can locate the defect.
5. Control: the intact clone produces no deny-list-class failure.

**Expected Outcome**:

- Absent, wrongly typed, and empty policy all fail closed (AC-F3-1, 100% of the enumerated cases).
- Deleting the field cannot be masked by widening the allow list in the same edit.
- Each failure identifies the field and the reason (NFR-6).

#### TC-LICREG-012 - Malformed, empty, duplicate, compound, and padded deny entries fail closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-2
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts` + `tests/fixtures/license/deny-list-cases.json`
**Tags**: @license, @deny-list, @policy-integrity, @fail-closed

**Preconditions**:

- The baseline deny list is intact in every case; exactly one malformed entry is added or substituted, so each failure is attributable.

**Steps**:

1. Apply each malformed-entry case and assert a non-empty failure set containing `deny_list` and the offending value or its index:
   - non-string: `123`, `true`, `null`, `{}`, `["SSPL-1.0"]` (nested array);
   - empty: `""`, `" "`, `"   "`;
   - whitespace-affixed: `" SSPL-1.0"`, `"SSPL-1.0 "`, `"SSPL 1.0"`;
   - duplicate: baseline plus a second `"SSPL-1.0"`;
   - compound: `"MIT OR SSPL-1.0"`, `"(SSPL-1.0)"`, `"GPL-2.0-only WITH Classpath-exception-2.0"`;
   - operator-only: `"AND"`, `"OR"`, `"WITH"`.
2. Assert the failure reason distinguishes each shape where §4.2 requires it (`not a single identifier` for expression-shaped values, `duplicate` for the repeated identifier, `empty` for blank values).
3. Assert a duplicate is reported rather than silently de-duplicated into a pass.
4. Assert the count of executed malformed cases equals the count declared in the fixture (no silent skip).
5. Control: the intact baseline plus one additional valid identifier produces no integrity failure.

**Expected Outcome**:

- Every malformed shape fails closed, including shapes a naive parser accepts (`"(SSPL-1.0)"` parses as one identifier but is not a valid deny entry).
- Whitespace padding is treated as malformed rather than normalized, so entries stay exact and comparable.
- Duplicates are reported, so a duplicated entry cannot mask a later removal of the original.

#### TC-LICREG-013 - Removing any Appendix A identifier fails closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F1-2, AC-F3-3, DM-2, DEC-6
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts`
**Tags**: @license, @deny-list, @floor, @fail-closed

**Preconditions**:

- The delivered registry and the baseline fixture (TC-LICREG-002).

**Steps**:

1. Assert the audit's exported floor set and the fixture identifier list are equal as sets (code↔fixture sync; drift in either direction fails).
2. For each of the 20 baseline identifiers, clone the registry, remove exactly that identifier from `deny_list`, and compute `validate(ROOT, registry)` with `allow_list`, entries, and verdicts untouched.
3. Assert the failure set is non-empty and that at least one message contains `deny_list` and the removed identifier — the failure names what is missing rather than only that something is wrong.
4. Assert the removal failure is independent of dependency data: also run `auditRegistry` with an empty dependency list and assert the floor failure is still reported.
5. Repeat step 2 for one identifier per family in the adversarial DEC-6 combination: remove the identifier, add it to `allow_list`, and set the probe entry's license to it with `verdict: approved`. Assert the case still fails (floor failure plus overlap plus denial, in any combination) and never passes.
6. Control: baseline intact plus an additional identifier (`AGPL-3.0-only`) produces no floor failure, proving the floor is a minimum and not an exact-match whitelist.
7. Assert the count of removal cases is 20.

**Expected Outcome**:

- 20/20 removals fail closed, each naming the missing identifier.
- Stripping a mandated family cannot turn the gate green even with a simultaneous allow-list edit (RSK-1).
- Adding identifiers remains possible without a code change (DEC-6, F-3).

#### TC-LICREG-014 - Extra deny identifiers work without a code change; no prefix or substring matching

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-2, AC-F2-1, AC-F1-2, spec §12 assumptions
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @deny-list, @matching

**Preconditions**:

- A clone of the delivered registry with the baseline intact.

**Steps**:

1. Append `AGPL-3.0-only` to `deny_list` (no code edit) and set the probe license to `AGPL-3.0-only`; assert a denial-class failure naming the identifier (extension works).
2. Set the probe license to `SSPL-1.0.1` (a variant not in the baseline) with the baseline intact; assert the failure is `not allow-listed` and that **no** denial-class message claims `SSPL-1.0` matched by prefix.
3. Set the probe license to `BSD-3-Clause-Clear` (a prefix extension of an allow-listed identifier); assert `not allow-listed`, zero denial messages, and that the allowed prefix did not grant a pass.
4. Set the probe license to `MIT-0`; assert `not allow-listed` and zero failures attributable to `MIT` prefix matching.
5. Assert every case above fails (non-empty failure set) — a variant that is neither denied nor allow-listed still fails closed.

**Expected Outcome**:

- The deny list can be extended through registry data alone (F-1, F-3, DEC-6).
- Deny and allow matching are exact identifier matches: no prefix or substring matching either denies a variant or admits one.
- Unlisted family variants still fail closed through the allow list, exactly as spec §12 assumes.

#### TC-LICREG-015 - Unregistered dependency and unregistered use fail closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-4
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @unregistered, @fail-closed

**Preconditions**:

- The real dependency closure via `lockedUses(ROOT, directExternalDependencies(ROOT))`.

**Steps**:

1. Remove the `fast-uri` entry from the clone and compute `auditRegistry` against the real closure; assert a `missing registry entry` failure naming `fast-uri` and the owning use (`ajv@8.20.0`, `dependencies`).
2. Keep the `yaml` entry but delete its `@changesets/parse@1.0.0` use; assert a `missing registered use` failure naming `yaml`, the owner, field, and version.
3. Append a synthetic dependency (`{ owner: "packages/core/package.json", field: "dependencies", name: "not-a-real-package", version: "9.9.9" }`) and assert a `missing registry entry` failure naming the synthetic package and that use.
4. Bump an entry's `version` and assert a `conflicting version` failure naming the package and both versions.
5. Assert each failure identifies the package and the use, so a contributor knows which manifest row to register (NFR-6).

**Expected Outcome**:

- A dependency absent from the registry fails the gate (the ticket's first criterion).
- An entry that covers some but not all of a package's real uses fails, so partial registration cannot pass.
- Existing version-conflict and use-accounting behaviour is preserved (DM-4).

#### TC-LICREG-016 - Empty, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, and unparseable licenses fail closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, spec §10
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts` + `tests/fixtures/license/cases.json`
**Tags**: @license, @fail-closed, @non-asserted

**Preconditions**:

- Existing fixture keys (`unknownRef`, `nonAllowlisted`, `compoundOrDisallowed`, `compoundAndAllowed`, `empty`) remain unchanged; new keys are added for the non-asserted and unparseable cases.

**Steps**:

1. For each case, set the probe license and assert a non-empty failure set naming the package and the raw license text: `""`, `"   "`, `LicenseRef-Proprietary`, `LicenseRef-scancode-unknown`, `NOASSERTION`, `SEE LICENSE`, `"MIT OR"`, `"AND MIT"`, `"MIT (ISC"`, `"()"`, `"MIT WITH Classpath-exception-2.0"`, `"MIT/Apache-2.0"`.
2. Assert class attribution per §4.2: `LicenseRef-*` → `unknown license reference`; blank → `empty license`; `NOASSERTION` and `SEE LICENSE` → `non-asserted`; syntactically broken expressions → `not a valid SPDX expression`.
3. For `NONE` (a non-asserted SPDX value not named literally in the spec), assert the case **fails** and accept either the non-asserted or the not-allow-listed class — closing the gap without inventing a requirement.
4. Assert no case produces zero failures and no case is reported as accepted.
5. Assert `empty` still produces the pre-existing `empty license field` message (vocabulary preserved).
6. Control: `MIT` produces zero failures.

**Expected Outcome**:

- 13/13 non-asserted, reference-only, empty, and unparseable values fail closed.
- `NOASSERTION` and `SEE LICENSE` are never treated as an implicit pass and are not silently folded into the generic non-allow-listed class (§10 distinct-class requirement; see the implementation note in §4.2).
- Blank license values keep their existing failure text.

#### TC-LICREG-017 - Valid but non-allow-listed identifiers fail closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2
**Test Type(s)**: Unit / Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @allow-list, @fail-closed

**Preconditions**:

- Live allow list: `Apache-2.0`, `BSD-3-Clause`, `ISC`, `MIT`.

**Steps**:

1. For each guard license — `GPL-3.0-only`, `MPL-2.0`, `AGPL-3.0-only`, `Unlicense`, `0BSD`, `BSD-2-Clause`, `MIT-0` — set the probe license, assert a `not allow-listed` failure naming the identifier and the package, and assert **no** denial-class message appears (these are not denied, merely not allowed).
2. For each compound — `Apache-2.0 OR GPL-3.0-only`, `MIT AND MPL-2.0` — assert the non-allow-listed branch is named and the allowed branch is not reported as disallowed.
3. Assert the delivered allow list itself is unchanged (four identifiers) and that adding a non-approved identifier to the allow list still fails the verdict bijection (regression of the pre-existing drift case).
4. Assert every case fails (non-empty failure set).

**Expected Outcome**:

- Valid, well-formed, but non-allow-listed licenses fail closed (AC-F4-2, 100%).
- Denial and non-allow-listing stay distinguishable classes (NFR-6): a GPL dependency is not mislabelled as a mandated-family denial.
- The allow list cannot be widened without an approved verdict, so the policy remains backed by recorded review.

#### TC-LICREG-018 - The live `@biomejs/biome` `MIT OR Apache-2.0` entry passes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DEC-3, spec Appendix C
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @compound, @live-registry

**Preconditions**:

- The live registry entry for `@biomejs/biome` with `license: "MIT OR Apache-2.0"`.

**Steps**:

1. Assert the entry exists, is `approved`, and its license string is exactly `MIT OR Apache-2.0`.
2. Assert `parseSpdxExpression` on that string returns `ok: true` with the identifier set `{MIT, Apache-2.0}`.
3. Assert both identifiers are in `allow_list` and in no `deny_list` entry.
4. Build a minimal registry containing only that entry and run `auditRegistry` against only that entry's real uses; assert zero failures — isolating the compound from unrelated entries.
5. Assert the full live validation `validate(ROOT)` is `[]` (the whole tree, including this entry).

**Expected Outcome**:

- The legitimate live compound dependency passes, proving per-branch evaluation was preserved rather than replaced by blanket rejection (the AC-F6-1 proof).
- The isolation step proves the pass comes from this entry's branches being allowed, not from an unrelated green path.

#### TC-LICREG-019 - Blanket compound rejection was not introduced

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NG-4, DEC-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @compound, @control

**Preconditions**:

- All four allow-listed identifiers are known: `MIT`, `Apache-2.0`, `ISC`, `BSD-3-Clause`.

**Steps**:

1. Assert each all-allowed compound parses `ok: true` with the expected identifier set and produces zero audit failures: `MIT AND Apache-2.0`, `(MIT AND ISC) OR Apache-2.0`, `(MIT OR Apache-2.0) AND (ISC OR BSD-3-Clause)`, `(((MIT)))`, `MIT OR Apache-2.0`.
2. Assert the identifiers extracted from `(MIT OR Apache-2.0) AND (ISC OR BSD-3-Clause)` are exactly the four allowed identifiers (the parser is not swallowing branches).
3. Assert a compound with one disallowed identifier still fails (`MIT OR GPL-3.0-only`), proving the passes in step 1 are not produced by ignoring branches.
4. Assert no failure message in the all-allowed cases contains `compound`, `unparseable`, or `reject` — a blanket-rejection regression would surface there.

**Expected Outcome**:

- Compounds are evaluated per branch: all-allowed passes, any disallowed branch fails.
- Neither failure mode (blanket rejection, blanket acceptance) can hide behind the other's green path.
- The recorded interpretation of ADR-0003 C-2 (spec Appendix C) is what the suite enforces.

#### TC-LICREG-020 - `ts-license-audit` is present, unmodified, binding, and not joined by a new job

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-4, NG-5, CON-4, DEC-4
**Test Type(s)**: Contract (workflow definition)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-ci-binding.test.ts`
**Tags**: @ci, @bindingness, @license

**Preconditions**:

- `origin/main-tools` is fetched (GAP-2).

**Steps**:

1. Parse `.github/workflows/ci.yml` and assert the `ts-license-audit` job exists.
2. Assert its step list contains a `run` whose value is exactly `bun run scripts/checks/license-audit.ts`, and that the job block contains no `continue-on-error`, `|| true`, `set +e`, `if: always()`, or `exit 0` wrapper (the §4.4 bypass list).
3. Assert the job declares `permissions.contents: read`.
4. Extract the job block from `git show origin/main-tools:.github/workflows/ci.yml` and assert the delivered block is byte-identical — the gate definition is unchanged by this change.
5. Assert `TS_JOBS` (from `scripts/checks/ci-topology.ts`) still contains `ts-license-audit` in its declared order, and that `Object.keys(workflow.jobs).sort()` equals `[...TS_JOBS, ...BASH_JOBS].sort()` — no job added, none removed.
6. Run `scanText(workflowText)` from `ci-bindingness.ts` and assert `[]`.
7. Assert `package.json` `scripts.check` is exactly the pinned aggregate chain (no license audit inserted into the aggregate as a workaround, no gate reordering).
8. Assert the job block declares no `timeout-minutes`.

**Expected Outcome**:

- The existing gate remains the only license gate, unmodified and unweakened (AC-F5-1, NFR-4).
- Zero new CI jobs; the topology and bindingness invariants cannot be satisfied by a parallel gate.
- A future edit that adds `continue-on-error` or drops the audit fails by job name.

#### TC-LICREG-021 - CI topology, bindingness, supply-chain, and surface invariants are green

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-4
**Test Type(s)**: Integration (repository invariants)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-ci-binding.test.ts` + `scripts/checks/*.ts`
**Tags**: @ci, @invariants

**Preconditions**:

- Full checkout with `origin/main-tools` available.

**Steps**:

1. Assert `validate(ROOT)` from `scripts/checks/ci-topology.ts` returns `[]` (bash jobs intact, all 16 TS jobs present, triggers cover the delivery branch, additions-only workflow diff, every `scripts/checks/*.ts` wired).
2. Assert `validate(ROOT)` from `scripts/checks/ci-bindingness.ts` returns `[]`.
3. Assert `validate(ROOT)` from `scripts/checks/ci-supply-chain.ts` returns `[]` (ci.yml is unchanged, so this is pure regression).
4. Assert `validate(ROOT)` from `scripts/checks/script-surface.ts` returns `[]` (aggregate chain surface unchanged).
5. Assert the same invariants are green when invoked as scripts (`bun run scripts/checks/ci-topology.ts`, `ci-bindingness.ts`, `ci-supply-chain.ts`), matching what `ts-invariants` / `ts-aggregate` execute.

**Expected Outcome**:

- Every CI invariant is green on the delivered tree, so the hardening did not disturb the gate topology (AC-F5-1).
- Function-level and script-level assertions agree, so the test cannot pass while the CI job fails.

#### TC-LICREG-022 - Spawned audit exits non-zero with clean diagnostics for every failure class

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-3, F-4, F-5, AC-F2-1, AC-F2-3, AC-F3-1, AC-F3-3, AC-F4-1, AC-F4-2, AC-F5-1, NFR-1, NFR-6
**Test Type(s)**: Integration (spawned process)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit-exit.test.ts` + `tests/checks/license-fixture.ts`
**Tags**: @license, @exit-code, @streams, @diagnostics

**Preconditions**:

- The temp-tree helper (§4.4) copies the root `package.json`, `pnpm-lock.yaml`, the six `packages/*/package.json` manifests, and `doc/legal/dependency-licenses.yaml`.
- Cases are registered in a table inside the suite so a count assertion can prove none was skipped.

**Steps**:

1. **Live green:** spawn with the unmodified registry; assert `status === 0`, `stdout` starts with `OK license-audit:`, and `stderr` is empty.
2. **Denied single:** probe license `SSPL-1.0`; assert `status === 1`, `stderr` contains `FAIL license-audit: `, the package name, `SSPL-1.0`, and the `denied` marker; `stdout` contains no `OK license-audit`.
3. **Denied branch:** probe license `MIT OR BUSL-1.1`; assert `status === 1` and `stderr` names `BUSL-1.1`.
4. **Denied in nested compound:** probe license `(MIT OR Apache-2.0) AND (ISC OR Elastic-2.0)`; assert `status === 1` and `stderr` names `Elastic-2.0`.
5. **Deny list absent:** write schema 3 with `deny_list` removed; assert `status === 1` and `stderr` contains `deny_list`.
6. **Old schema:** write `schema_version: 2` with no deny list; assert `status === 1` and `stderr` contains `schema`.
7. **Floor removal:** remove `SSPL-1.0` from an otherwise valid deny list; assert `status === 1` and `stderr` contains `deny_list` and `SSPL-1.0`.
8. **Allow/deny overlap:** append `SSPL-1.0` to `allow_list`; assert `status === 1` and `stderr` contains `deny_list`, `allow_list`, and `SSPL-1.0`.
9. **Non-asserted license:** probe license `NOASSERTION`; assert `status === 1` and `stderr` contains the non-asserted marker. **Unregistered dependency:** remove the `fast-uri` entry; assert `status === 1` and `stderr` contains `missing registry entry` and `fast-uri`.
10. For every failure case also assert: `stderr` has no stack trace (`/^\s+at /m` and `/\bError:\s/` absent), every non-empty `stderr` line starts with `FAIL license-audit: `, and `stdout` is empty or contains no `OK`.
11. Assert the executed case count equals the registered count (1 green + 9 failure classes), so a skipped spawn cannot pass.
12. Assert the suite leaves no residue: every temp tree is removed and `git status --porcelain` is unchanged after the run.

**Expected Outcome**:

- Every failure class produces a real non-zero exit, not only a log line — the acceptance criterion is proven at the process boundary the CI job actually invokes.
- Diagnostics land on stderr with the stable prefix; success alone prints on stdout.
- Expected validation failures never surface as an uncaught stack trace (NFR-6).

#### TC-LICREG-023 - The live registry validates with zero failures and closure accounting is preserved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-5, F-6, AC-F5-2, AC-F6-1, DM-3, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit.test.ts`
**Tags**: @license, @live-registry, @regression

**Preconditions**:

- Delivered registry, manifest set, and lockfile.

**Steps**:

1. Assert `validate(ROOT)` returns `[]` (zero failures, zero warnings-as-failures).
2. Assert every registry entry has `verdict === "approved"`.
3. Assert the allow-list identifiers equal the set of identifiers derived from approved verdicts (bijection both ways).
4. Assert no entry license contains a denied identifier (policy consistency of the live data).
5. Assert the closure accounting is unchanged from the pre-existing assertions: `uses.filter(use => use.name === "yaml").length > 1`; `{ owner: "ajv@8.20.0", field: "dependencies", name: "fast-uri", version: "3.1.9" }` is present; `{ owner: "@commitlint/config-validator@21.2.3", field: "dependencies", name: "ajv", version: "8.20.0" }` is present; and `yaml@2.9.1` is not an owner.
6. Assert the isolated live compound passes (delegated to TC-LICREG-018 step 4).

**Expected Outcome**:

- The live registry and the live dependency closure validate with zero failures (AC-F5-2), so the policy does not block a legitimate dependency (RSK-2).
- Use accounting and the allow/verdict bijection are provably unchanged (DM-3, DM-4).

#### TC-LICREG-024 - The matrix is complete, registered, and non-vacuous

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, F-5, AC-F5-2, AC-F1-2, NFR-1
**Test Type(s)**: Unit (meta-check)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-policy.test.ts` + `tests/fixtures/license/deny-list-cases.json`
**Tags**: @license, @matrix, @meta

**Preconditions**:

- `tests/fixtures/license/deny-list-cases.json` declares each registry mutation case with an id, the mutated field, the expected failure class token, and the expected offending value.

**Steps**:

1. Assert every declared case uses a class token from the §4.2 vocabulary; an unknown token fails the meta-check.
2. Assert minimum case counts per class: schema 5 (old, absent, string, future, null), presence/type 7 (absent, `undefined`, `null`, string, object, empty array, absent-with-widened-allow-list), malformed entries 18 (5 non-string, 3 empty, 3 whitespace-affixed, 1 duplicate, 3 compound, 3 operator-only), floor 20, overlap 3, extension 2, unknown reference 2, empty 2, non-asserted 2, unparseable 6, non-allow-listed 7.
3. Assert the union of classes covered by the fixtures includes all five mandated families (via the 20 baseline identifiers used by TC-LICREG-006) — no family is exercised only in prose.
4. Assert the suite executes exactly the declared cases: for each case, one assertion outcome, and the executed count equals the declared count (no silent skip, no `test.skip`).
5. Assert the anti-vacuity control: a case declaration with an unknown class token produces a meta-check failure.
6. Assert the pre-existing fixture keys (`unknownRef`, `nonAllowlisted`, `compoundOrDisallowed`, `compoundAndAllowed`, `empty`) still exist and are still used by their original tests.

**Expected Outcome**:

- The suite's coverage claim is machine-checkable: a missing class, family, or case fails the meta-check instead of quietly shrinking the matrix.
- The pre-existing fixture contract survives the extension.

#### TC-LICREG-025 - Audit behaviour is deterministic, order-independent, and offline

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, CON-8
**Test Type(s)**: Integration / static assertion
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit-exit.test.ts`
**Tags**: @license, @determinism, @offline

**Preconditions**:

- Delivered registry and lockfile; no network dependency in the audit.

**Steps**:

1. Assert `validate(ROOT)` returns the same array on two consecutive calls (deep equality, including order).
2. Assert `auditRegistry(cloneWithOneMutation, deps)` returns the same array on two consecutive calls.
3. Reverse `registry.entries` on a mutated clone and assert the sorted failure set is identical to the non-reversed run (order independence).
4. Reverse `deny_list` on a valid clone and assert the live run is still `[]` (deny-list order is not semantic).
5. Static scan of `scripts/checks/license-audit.ts`: assert the source contains no `Math.random`, `Date.now`, `new Date`, `performance.now`, `fetch(`, `node:http`, `node:https`, `node:net`, `node:dns`, or `child_process` (offline, clock-free, no subprocess).
6. Assert the source contains no `process.env` read, so policy decisions never depend on ambient environment.

**Expected Outcome**:

- Identical registry, lockfile, and dependency inputs produce identical failure sets (NFR-2).
- Zero network, clock, randomness, and subprocess dependence is proven at the source level, closing the one part of NFR-2 that runtime assertions cannot reach (GAP-3).

#### TC-LICREG-026 - Every failure is diagnosable and classes stay distinguishable

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-3, F-4, NFR-6, AC-F2-1, AC-F4-1, AC-F4-2, spec §10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit-exit.test.ts`
**Tags**: @license, @diagnostics, @nfr

**Preconditions**:

- One representative trigger per class in §4.2 (denied single, denied branch, unknown reference, non-asserted, empty, unparseable, non-allow-listed, unregistered use, malformed policy, overlap, schema, floor, drift).

**Steps**:

1. For each representative, compute the failure set and assert every message is non-empty, names the package (or registry field for policy classes), contains the offending license text or identifier, and carries a reason clause.
2. Assert the expected class token is present for each representative.
3. Assert the forbidden tokens from §4.2 are absent: a denial case is not reported *only* as `not allow-listed`; a non-allow-listed case carries no `denied` marker; a non-asserted case is not folded into `not allow-listed`.
4. Assert `validate` and `auditRegistry` never throw for any policy mutation: wrap each representative in a try/catch and fail the test on a thrown error (in-process proof of the "no uncaught stack trace" clause).
5. Assert every stderr line of a spawned failure begins with `FAIL license-audit: ` (TC-LICREG-022 step 10 cross-check) and that no diagnostic is written to stdout.
6. Assert no failure message embeds a credential, environment value, or unrelated file content: scan every message for `process.env`, `token`, `secret`, and absolute host paths.

**Expected Outcome**:

- 100% of failures are actionable: package, use or field, offending value, reason (NFR-6).
- Classes remain distinguishable, so a reviewer can tell a mandated-family denial from a merely non-allow-listed license.
- Expected validation failures are returned, never thrown, so CI logs show diagnostics rather than a stack trace.

#### TC-LICREG-027 - Live audit completes within the 30-second bound

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-5
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-audit-exit.test.ts`
**Tags**: @license, @perf

**Preconditions**:

- Installed dependencies (`pnpm install --frozen-lockfile`), so `yaml` resolves without auto-install noise.

**Steps**:

1. Spawn the live audit with a monotonic timer around the process; assert `status === 0`.
2. Assert the measured wall time is below `30_000` ms (the spec threshold).
3. Record the measured value in §10 as evidence; do not assert a tighter budget (GAP-4).
4. Assert the `ts-license-audit` job declares no `timeout-minutes` (delegated to TC-LICREG-020 step 8), so the spec's "no additional job timeout" holds.

**Expected Outcome**:

- The live audit completes within the spec's threshold on the current direct-and-runtime closure.
- The measurement is recorded rather than tuned, so a loaded runner does not produce a false failure below the threshold.

#### TC-LICREG-028 - No new dependency and no lockfile or manifest change

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, CON-5, NG-6
**Test Type(s)**: Contract (repository diff)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-ci-binding.test.ts`
**Tags**: @license, @dependencies, @regression

**Preconditions**:

- `origin/main-tools` is fetched (GAP-2).

**Steps**:

1. Assert `git diff --name-only origin/main-tools...HEAD -- pnpm-lock.yaml` is empty.
2. Assert `git diff --name-only origin/main-tools...HEAD -- package.json` is empty.
3. Assert `git diff --name-only origin/main-tools...HEAD -- 'packages/*/package.json'` is empty.
4. Assert the delivered root `devDependencies` key set equals the base key set read from `git show origin/main-tools:package.json`.
5. If `origin/main-tools` is unavailable, fail naming the missing ref rather than skipping.

**Expected Outcome**:

- Zero new runtime or development dependencies and zero lockfile change (NFR-3, CON-5).
- The deny policy is enforced from code plus committed data, not from a new library.

#### TC-LICREG-029 - Pre-existing matrix and repository gate battery are unchanged and green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, AC-F5-2, NFR-3, NFR-4
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/license-ci-binding.test.ts` + repo root
**Tags**: @license, @regression, @gates

**Preconditions**:

- Installed dependencies; `origin/main-tools` available.

**Steps**:

1. Read the pre-change test titles from `git show origin/main-tools:tests/checks/license-audit.test.ts` and assert each title still appears in the delivered test file (no test removed to make the suite green; the §4.5 control).
2. Run the extended suite: `bun test tests/checks/license-audit.test.ts` — green.
3. Run the whole checks layer: `bun test tests/checks` — green.
4. Run the aggregate: `pnpm check` — green (lint, format check, typecheck, tests, boundaries, exports parity).
5. Run the inherited bash layers unchanged: `bash scripts/.tests/test-*.sh` and `bash tools/.tests/test-*.sh` — green.
6. Assert unchanged-tree invariants: `bun run scripts/checks/pin-equality.ts`, `ci-supply-chain.ts`, `vulnerability-gate.ts` — each `[]` or exit 0.
7. Assert no drift outside the change's surface: `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude` lists only `scripts/checks/license-audit.ts` — no bash script, tool, agent, command, or generated plugin changed.
8. Assert `git status --porcelain` is empty after the full battery (no temp leakage, no generated artifact).

**Expected Outcome**:

- The existing test matrix still passes and no case was deleted or weakened (AC-F5-2).
- The repository gate battery is green with an unchanged number of jobs, no bypass, and no dependency drift (NFR-3, NFR-4).
- The change surface is exactly the registry, the audit, and the tests.

#### TC-LICREG-030 - Manual policy and diagnostic review

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, F-5, AC-F1-4, AC-F5-1, RSK-6, NG-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: PR review record
**Tags**: @license, @review, @manual

**Preconditions**:

- The change is complete and all automated TCs are green.

**Steps**:

1. Read the registry header comments as a maintainer and confirm the five claims in §4.3 are stated clearly and accurately, without contradicting the enforced behaviour.
2. Confirm the C-2 determination is unchanged and that the owner still confirms it at PR review (spec §12, RSK-6); record the confirmation in the PR.
3. Confirm the deny list families match ADR-0003 C-2 exactly (SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC) and that no extra family was added or removed without a recorded decision.
4. Read the new failure messages from a failing run and confirm each names the package, the offending value, and an actionable reason, and that none prints credentials, environment dumps, or unrelated file contents (spec §20).
5. Confirm the change introduces no SBOM, notice, checksum, or review-date artifact (NG-1, NG-2, CON-7).
6. Confirm `ts-license-audit` appears as a required check on the delivery PR and that no gate changed status (GAP-7).

**Expected Outcome**:

- A human confirms the parts no test can judge: policy wording, legal-position preservation, diagnostic quality, and scope discipline.
- The review record is the evidence for AC-F1-4's quality clause and for AC-F5-1's merge-blocking property.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun 1.4.4 (`.bun-version`), pnpm 10.18.3 (`packageManager`), **dependencies installed** | Install with `pnpm install --frozen-lockfile` before running any suite. Observation from plan authoring: with no `node_modules` present, `bun test tests/checks/license-audit.test.ts` fails with `Cannot find package 'yaml'` while `bun run scripts/checks/license-audit.ts` still passes through Bun auto-install — a missing install must not be mistaken for a real failure |
| Local dev with base branch | `origin/main-tools` fetched | Required by TC-LICREG-003, TC-LICREG-020, TC-LICREG-028, TC-LICREG-029 and by `ci-topology.ts` (GAP-2) |
| CI (GitHub Actions, `ubuntu-latest`) | `pnpm install --frozen-lockfile`, pinned Bun/pnpm, existing `ts-*` jobs | Authoritative for AC-F5-1, AC-F5-2 and every invariant suite; `ts-license-audit` runs the same command as TC-LICREG-022 step 1 |
| Temp fixture trees | `mkdtemp` under the OS temp dir | Spawned cases (TC-LICREG-022, TC-LICREG-027) and mutation copies never write the live tree |
| In-process test process | Bun runtime; the live registry and lockfile read-only | The exhaustive matrix (30 cases) runs here |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Live registry | `doc/legal/dependency-licenses.yaml` (schema v3) | Read-only at test time; the only mutated copies are in memory or in `mkdtemp` |
| License-text cases | `tests/fixtures/license/cases.json` — existing keys plus `noassertion`, `seeLicense`, `none`, `blank`, `whitespace`, `unparseable*`, `deniedSingle*`, `compoundAndDenied`, `compoundNestedDenied`, `compoundNestedAllowed` | Read-only; extended deliberately when the matrix grows |
| Appendix A baseline | `tests/fixtures/license/deny-baseline.json` — five families, 20 identifiers, flat list | Read-only; must stay equal to the audit's exported floor |
| Deny-list mutation matrix | `tests/fixtures/license/deny-list-cases.json` — id, mutated field, expected class token, expected offending value | Read-only; drives TC-LICREG-012/013/024 |
| Policy-note keyword groups | Inline in the suite (§4.3) | Reviewed when the registry wording changes |
| Temp tree copies | Root `package.json`, `packages/*/package.json`, `pnpm-lock.yaml`, mutated registry | Created and deleted per spawned case |
| Live closure | `lockedUses(ROOT, directExternalDependencies(ROOT))` — 15 entries, shared `yaml`/`ajv` uses | Read-only; asserted unchanged in TC-LICREG-023 |

### 6.3 Isolation Strategy

- Every mutation is applied to a deep clone (`JSON.parse(JSON.stringify(loadRegistry(ROOT)))`, the existing pattern) or to a `mkdtemp` tree; the live tree is never written.
- Spawned cases pass an absolute script path with a foreign `cwd`, so the script reads the temp registry while resolving `yaml` from the repository — the pattern already proven by `tests/checks/ci-checks.test.ts`.
- Every `mkdtemp` is removed in a `finally`; the suite then asserts the live worktree is clean (§4.5 control 7).
- No suite requires a build: tests import `../../scripts/checks/license-audit` by relative path, matching the existing checker suite. `pnpm check` builds because of its own `pretest`, which is not needed for narrow runs.
- Fixtures are `.json` files under `tests/fixtures/license/`, never `*.test.ts`, so `bun test` discovery cannot treat data as a suite.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except TC-LICREG-030. Paths marked † are assumed locations: delivery planning may bind different filenames, but each TC's behaviour and assertion target must not change (A-T1).

| TC ID | Test file / artefact | Execution command | Mutations | Status |
|-------|----------------------|-------------------|-----------|--------|
| TC-LICREG-001 | `tests/checks/license-policy.test.ts` (†) | `bun test tests/checks/license-policy.test.ts` | none (delivered state); directory listing | To Implement |
| TC-LICREG-002 | `tests/checks/license-policy.test.ts` (†) + `deny-baseline.json` (†) | same | truncated fixture control | To Implement |
| TC-LICREG-003 | `tests/checks/license-policy.test.ts` (†) | same | none; reads `git show origin/main-tools:…` | To Implement |
| TC-LICREG-004 | `tests/checks/license-policy.test.ts` (†) | same | 5 schema mutations + restore control | To Implement |
| TC-LICREG-005 | `tests/checks/license-policy.test.ts` (†) | same | comment-block keyword groups; data-only control | To Implement |
| TC-LICREG-006 | `tests/checks/license-audit.test.ts` (extend) | `bun test tests/checks/license-audit.test.ts` | 20 single-identifier denials + allow control | To Implement |
| TC-LICREG-007 | `tests/checks/license-policy.test.ts` (†) | `bun test tests/checks/license-policy.test.ts` | allow-list + approved-verdict + entry license | To Implement |
| TC-LICREG-008 | `tests/checks/license-policy.test.ts` (†) | same | minimal-list overlap; no-entry overlap | To Implement |
| TC-LICREG-009 | `tests/checks/license-audit.test.ts` (extend) + `cases.json` (extend) | `bun test tests/checks/license-audit.test.ts` | 7 denied compounds + 2 allowed controls | To Implement |
| TC-LICREG-010 | `tests/checks/license-audit.test.ts` (extend) | same | per-branch denial counts | To Implement |
| TC-LICREG-011 | `tests/checks/license-policy.test.ts` (†) | `bun test tests/checks/license-policy.test.ts` | 6 presence/type/emptiness mutations | To Implement |
| TC-LICREG-012 | `tests/checks/license-policy.test.ts` (†) + `deny-list-cases.json` (†) | same | 15 malformed-entry cases + valid-extension control | To Implement |
| TC-LICREG-013 | `tests/checks/license-policy.test.ts` (†) | same | 20 single removals + 5 adversarial removals + extension control | To Implement |
| TC-LICREG-014 | `tests/checks/license-audit.test.ts` (extend) | `bun test tests/checks/license-audit.test.ts` | extension + 3 prefix/substring traps | To Implement |
| TC-LICREG-015 | `tests/checks/license-audit.test.ts` (extend) | same | removed entry, removed use, synthetic use, version bump | Existing – Update |
| TC-LICREG-016 | `tests/checks/license-audit.test.ts` (extend) + `cases.json` (extend) | same | 13 non-asserted/empty/unparseable cases + `NONE` | Existing – Update |
| TC-LICREG-017 | `tests/checks/license-audit.test.ts` (extend) | same | 7 guard licenses + 2 compounds + drift case | Existing – Update |
| TC-LICREG-018 | `tests/checks/license-audit.test.ts` (extend) | same | none; isolation registry | To Implement |
| TC-LICREG-019 | `tests/checks/license-audit.test.ts` (extend) | same | 5 all-allowed compounds + 1 disallowed control | To Implement |
| TC-LICREG-020 | `tests/checks/license-ci-binding.test.ts` (†) | `bun test tests/checks/license-ci-binding.test.ts` | none; base-branch block comparison | To Implement |
| TC-LICREG-021 | `tests/checks/license-ci-binding.test.ts` (†) | same + `bun run scripts/checks/ci-topology.ts`; `ci-bindingness.ts`; `ci-supply-chain.ts` | none | To Implement |
| TC-LICREG-022 | `tests/checks/license-audit-exit.test.ts` (†) + `license-fixture.ts` (†) | `bun test tests/checks/license-audit-exit.test.ts` | 1 green + 9 spawned failure classes | To Implement |
| TC-LICREG-023 | `tests/checks/license-audit.test.ts` (extend) | `bun test tests/checks/license-audit.test.ts` | none | Existing – Update |
| TC-LICREG-024 | `tests/checks/license-policy.test.ts` (†) + `deny-list-cases.json` (†) | `bun test tests/checks/license-policy.test.ts` | unknown class token control | To Implement |
| TC-LICREG-025 | `tests/checks/license-audit-exit.test.ts` (†) | `bun test tests/checks/license-audit-exit.test.ts` | reverse-entries / reverse-deny-list; source scan | To Implement |
| TC-LICREG-026 | `tests/checks/license-audit-exit.test.ts` (†) | same | 7 class representatives; throw-vs-return guard | To Implement |
| TC-LICREG-027 | `tests/checks/license-audit-exit.test.ts` (†) | same | none; wall-clock measurement | To Implement |
| TC-LICREG-028 | `tests/checks/license-ci-binding.test.ts` (†) | `bun test tests/checks/license-ci-binding.test.ts` | none; three scoped diffs | To Implement |
| TC-LICREG-029 | `tests/checks/license-ci-binding.test.ts` (†) + repo root | `bun test tests/checks/license-audit.test.ts`; `bun test tests/checks`; `pnpm check`; `bash scripts/.tests/test-*.sh`; `bash tools/.tests/test-*.sh` | test-title preservation; clean-tree assertion | Existing – Update |
| TC-LICREG-030 | PR review record | manual | none | Manual Only |

**Wiring**: all new suites live under `tests/checks/**` and are discovered by root `bun test`, so `ts-test` and `ts-aggregate` run them with no workflow change. No new `scripts/checks/*.ts` is added, so `ci-topology.ts`'s "every check script is wired" rule and `TS_JOBS` stay untouched; `ci-bindingness.ts` stays green because no `ts-` job text changes. `tests/fixtures/license/*.json` are data, never `*.test.ts`, so discovery does not treat them as suites.

**Execution order** (fast feedback first):

1. Delivered-state assertions: TC-LICREG-001, TC-LICREG-002, TC-LICREG-003, TC-LICREG-005, TC-LICREG-018, TC-LICREG-023.
2. Schema and policy integrity: TC-LICREG-004, TC-LICREG-008, TC-LICREG-011, TC-LICREG-012, TC-LICREG-013, TC-LICREG-024.
3. Enforcement matrix: TC-LICREG-006, TC-LICREG-007, TC-LICREG-009, TC-LICREG-010, TC-LICREG-014, TC-LICREG-015, TC-LICREG-016, TC-LICREG-017, TC-LICREG-019.
4. Process contract: TC-LICREG-022, TC-LICREG-025, TC-LICREG-026, TC-LICREG-027.
5. CI binding and non-weakening: TC-LICREG-020, TC-LICREG-021, TC-LICREG-028.
6. Regression battery: TC-LICREG-029.
7. Manual review: TC-LICREG-030.

**Evidence commands** (run in this order and record the results in §10):

```
pnpm install --frozen-lockfile
bun test tests/checks/license-audit.test.ts
bun test tests/checks/license-policy.test.ts
bun test tests/checks/license-audit-exit.test.ts
bun test tests/checks/license-ci-binding.test.ts
bun test tests/checks
bun run scripts/checks/license-audit.ts
bun run scripts/checks/ci-topology.ts
bun run scripts/checks/ci-bindingness.ts
bun run scripts/checks/ci-supply-chain.ts
bun run scripts/checks/script-surface.ts
pnpm check
bash scripts/.tests/test-*.sh
bash tools/.tests/test-*.sh
git diff --exit-code origin/main-tools...HEAD -- pnpm-lock.yaml package.json 'packages/*/package.json'
git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude
git status --porcelain
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | The suite asserts only the live-registry happy path, so the policy is unproven (spec RSK-5) | H | M | Every AC is bound to a mutation case; TC-LICREG-024 machine-checks the matrix's completeness and rejects an unknown class token |
| RSK-T2 | Negative cases assert log text only, so a check that logs and exits 0 would still pass | H | M | §4.4 assertion discipline plus TC-LICREG-022: every failure class has a spawned case asserting `status === 1`, stderr prefix, and stdout purity |
| RSK-T3 | The floor is satisfied by the registry fixture rather than by code, so deleting a family passes | H | L | TC-LICREG-002 step 5 and TC-LICREG-013 step 1 assert code↔fixture equality; removals are rejected regardless of registry content |
| RSK-T4 | Prefix or substring matching sneaks in and both denies variants and admits near-matches | H | L | TC-LICREG-014 traps `SSPL-1.0.1`, `BSD-3-Clause-Clear`, `MIT-0`, and a `SSPL` label |
| RSK-T5 | `origin/main-tools` is unavailable locally, so preservation and CI-diff assertions are misread as failures | M | M | §6.1 states the precondition; the tests fail with a message naming the missing ref and never skip (GAP-2) |
| RSK-T6 | Spawned temp-tree cases are slow or flaky under parallel `bun test` | M | L | Only one spawn per failure class (10–11 total), each copying ~60 KB; the exhaustive 20/20 floor and malformed matrix stay in-process |
| RSK-T7 | The keyword-group assertions for AC-F1-4 become brittle word-matching theatre | M | M | Groups are semantic, not sentence-exact; a claim cannot be satisfied by entry data; wording quality is explicitly deferred to manual review (GAP-1) |
| RSK-T8 | A missing `node_modules` makes narrow runs fail for the wrong reason (`Cannot find package 'yaml'`) | M | M | §6.1 records the install prerequisite and the observed auto-install asymmetry between `bun run` and `bun test` |
| RSK-T9 | The `NONE` and `NONE`-adjacent cases over-specify a class the spec does not name | L | L | TC-LICREG-016 step 3 requires only failure, accepting either the non-asserted or the not-allow-listed class |
| RSK-T10 | Concurrent GH-188 work uses the same `TC-LICENSE-` slug, producing an ID collision | L | M | §4.7 binds this change to `TC-LICREG-`; GH-188's `TC-LICENSE-001` is left untouched |
| RSK-T11 | A later change adds a file under `doc/legal/` and breaks TC-LICREG-001 step 7 | L | L | The assertion is deliberate and documented as updateable by a later legal-document change |

### 8.2 Assumptions

- **A-T1** — Behaviour is bound by TCs, not by exact symbol or file names. Daggers mark assumed paths and names (`license-policy.test.ts`, `license-audit-exit.test.ts`, `license-ci-binding.test.ts`, `license-fixture.ts`, the exported floor set, and the deny-list policy validator). Delivery planning may bind different names without changing an assertion. Spec-fixed and non-negotiable: `schema_version: 3`, the field name `deny_list`, the Appendix A identifiers, the `FAIL license-audit: ` / `OK license-audit: ` stream contract, and the `ts-license-audit` job id and command.
- **A-T2** — The deny-entry identifier grammar is the audit's existing `^[A-Za-z0-9.+-]+$` applied to a single token. Parentheses, operators, `WITH`, and whitespace (including padding) are malformed (OQ-T2).
- **A-T3** — The live deny list contains at least the 20 Appendix A identifiers; additional identifiers are permitted and are not asserted absent.
- **A-T4** — The mutable probe entry for license mutations is `typescript` (present in the real closure, live license `Apache-2.0`, allow-listed). If delivery needs a different probe, the assertions are unchanged; only the package name in the messages changes.
- **A-T5** — `validate(ROOT, registry)` accepts an injected registry for in-memory mutation, and `auditRegistry(registry, dependencies)` remains independently callable — both already true today.
- **A-T6** — The spawned harness works with an absolute script path and a foreign `cwd` because the script resolves `yaml` from its own directory while reading registry and lockfile from `cwd`; this is already exercised by `tests/checks/ci-checks.test.ts`.
- **A-T7** — Dependency installation precedes every run (§6.1). `bun run` may auto-install a missing package while `bun test` does not, so an uninstalled tree is an environment fault, not a test result.
- **A-T8** — `deny_list` ordering is not semantic; only set membership and integrity matter (TC-LICREG-025 step 4).
- **A-T9** — Assertions that compare against `origin/main-tools` assume the branch model in `AGENTS.md` (feature branches from `main-tools`).

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Must the registry's `c2_determination` literally record "approved" after the owner confirms at PR review, or is the preserved "proposed at delivery; confirmed by the owner at PR review" wording sufficient? | AC-F1-1 says "the approved C-2 determination" while CON-6 and §19 require the existing determination preserved and §12 defers confirmation to PR review. TC-LICREG-003 asserts preservation; TC-LICREG-030 records the human confirmation. | **Non-blocking** — resolved in-plan by asserting presence plus preservation and recording approval in the PR. If PM wants the literal state in the file, AC-F1-1 needs a one-line wording clarification. | @pm / @spec-writer |
| OQ-T2 | Is the deny-entry identifier grammar the existing `^[A-Za-z0-9.+-]+$` token pattern, and should that be stated in the spec or system spec? | DM-2 says "single denied license identifiers" and §12 says policy labels "are accepted by the registry's identifier syntax", but the grammar is never written down. | **Non-blocking** — bound as A-T2; recommend recording it in the system-spec reconciliation (phase 7). | @pm / @spec-writer / @doc-syncer |
| OQ-T3 | Should `NONE` be treated as a non-asserted value (specifically), or is fail-closed through the allow list sufficient? | The spec names `NOASSERTION` and `SEE LICENSE` explicitly; `NONE` is a recognised SPDX non-license value and is implicitly covered by F-4's "never treats a missing or non-asserted license as an implicit pass". | **Non-blocking** — TC-LICREG-016 step 3 requires failure and accepts either class, so the case closes the gap without inventing a requirement. | Delivery planning |
| OQ-T4 | Should the new suites live in the existing `tests/checks/license-audit.test.ts` or in focused sibling files? | The matrix is large enough that one file would exceed a reviewable size, but splitting risks hiding cases from a single-place review. | **Non-blocking** — this plan proposes four focused files plus a helper (†), with TC-LICREG-024 keeping completeness machine-checked regardless of layout. | Delivery planning |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @test-plan-writer | Initial plan: 30 TCs across registry policy (LICREG-001..005), deny enforcement (006..010, 014), deny-list integrity (011..013), fail-closed unknowns (015..017), preserved compound (018..019), CI binding and process contract (020..022), live green (023), matrix completeness (024), and non-functional plus regression (025..029), with one manual review (030). All 15 spec ACs mapped and covered, all six ticket ACs traced, DM-1..DM-5 and NFR-1..NFR-6 traced; failure-class vocabulary fixed (§4.2); mutation harness and exit-code proof fixed (§4.4); seven anti-vacuity controls recorded (§4.5); GAP-1..GAP-7 and OQ-T1..OQ-T4 recorded rather than reinterpreted |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed: the deny-list policy, the schema bump, and the extended matrix do not exist yet. Plan-authoring observations only: on the pre-change tree with no `node_modules`, `bun run scripts/checks/license-audit.ts` prints `OK license-audit: …` and exits 0, while `bun test tests/checks/license-audit.test.ts` fails with `Cannot find package 'yaml'` (install prerequisite, §6.1). Run `pnpm install --frozen-lockfile` before recording any evidence. |

