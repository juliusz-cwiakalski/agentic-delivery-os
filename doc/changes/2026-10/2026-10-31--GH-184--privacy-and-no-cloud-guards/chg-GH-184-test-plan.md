---
id: chg-GH-184-test-plan
status: Updated
created: 2026-10-31T05:24:12Z
last_updated: 2026-10-31T05:32:45Z
owners: [engineering]
service: delivery-os repository checks and metadata codec
labels: [change, planning]
version_impact: minor
summary: "Aligned to change spec v1.1. Verify M0-S15: one privacy-literals invariant with seven committed generic rule classes, a schema-versioned hashed-literal registry (private-literal and cloud-term classes, fail-closed validation, caps, allowlist/exclusion exactness), a working-tree-only no-history scan with content-free reporting and a stdin-only CI-refusing authoring mode, a required injected pure content policy at serializeEnvelope with the content-policy-violation failure, shared-rule parity between the file scan and the emitter, binding ts-invariants wiring with a build-free local command, and exactly one new five-package minor changeset added by this change (pre-existing changesets untouched) with no manifest version or lockfile change."
links:
  change_spec: ./chg-GH-184-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S15: Privacy and no-cloud guards

## 1. Scope and Objectives

This change turns a prose privacy boundary into a mechanical gate whose own construction must not leak what it protects. The tests therefore protect three properties at once: **detection** (seven committed generic rule classes, hashed `private-literal` entries, hashed `cloud-term` entries, the working-tree boundary, and the envelope content policy all fire on synthetic positives), **silence on the clean tree** (zero violations over the real working tree and over a committed false-positive corpus, so the gate survives contact with public documentation), and **non-leakage** (no matched literal, content window, or digest input ever appears in stdout, stderr, machine-readable output, failure objects, or authoring output). The highest risks are a guard that passes vacuously because a rule class is never exercised, a registry that accepts weakening data, a failure message that becomes the leak channel in public CI logs, and a codec that gains an optional or duplicated serialization path.

The plan is built around three binding disciplines: a **mutation triple** for every rule and entry class (fires when planted, silent when removed, and a detection-disabled control that must fail the suite), a **fail-closed registry matrix** of named malformations, and a **no-echo proof** that is itself non-vacuous because an echo-enabled mutant is exercised in the same test. It is a design and verification map, not an execution claim: this writer ran no builds, tests, or commands against the delivered state.

### 1.1 In Scope

- The seven initial generic rule classes (`secret.*`, `private.*`) with positive, near-miss, suppression, and false-positive corpora (F-1, AC-F1-1, AC-F1-2, NFR-2, NFR-4).
- The schema-versioned hashed-literal registry: scope mode, enabled rule ids, declared classes, entries, reason-bearing allowlist and exclusions, caps and bounds (F-2, F-3, F-4, DM-1, DM-2, NFR-9).
- `private-literal` detection with normalization and fixed-length candidate windows, including authoring-produced entries added as data with no code change or rebuild (AC-F2-1, AC-F2-2, AC-F2-3).
- The `cloud-term` class: empty production class reported as explicitly scanned-and-vacuous, and synthetic activation proving the mechanism (AC-F3-1, AC-F3-2).
- Fail-closed registry validation across the full malformation matrix, the working-tree-only boundary (history, untracked, ignored, binary, exclusions), determinism, read-only behavior, and the no-network property (AC-F4-1..AC-F4-4, NFR-1).
- Content-free reporting (human and machine-readable), the identifier-only fingerprint, and the stdin-only, no-echo, no-write, CI-refusing authoring mode (F-5, DM-4, DM-7, AC-F5-1, AC-F5-2, NFR-3).
- The required injected pure content policy at `serializeEnvelope`: deny across the four payload string fields and all three carriers, clean serialization, validation order, failure shape, codec purity, shared-rule parity, hashed-entry matching at the emitter, and the human-content exclusion (F-6, DM-5, DM-6, AC-F6-1..AC-F6-5, NFR-6).
- Binding `ts-invariants` wiring, the build-free offline `check:privacy-literals` command, and the new suites executing under the binding test job (F-7, AC-F7-1..AC-F7-3, NFR-7).
- Exactly one new five-package minor changeset added by this change (pre-existing changesets untouched), unchanged manifest versions, unchanged lockfile, and zero new dependencies (F-8, AC-F8-1, NFR-8).

### 1.2 Out of Scope & Known Gaps

- [OUT] Git-history replay, corpus baselines, and retroactive remediation: the scan protects the working-tree tip only (NG-3; AC-F4-2 asserts this negatively).
- [OUT] Binary deep inspection, archive inspection, and encoded/compressed payload decoding: binary files are detected and counted as a reported residual only (NG-7).
- [OUT] Scanning human-readable comment content at the emitter; the file guard governs committed human content (NG-4, AC-F6-5).
- [OUT] A separate no-cloud script, job, or registry; the no-cloud rule is the `cloud-term` class (NG-5).
- [OUT] Production emitters, provider adapters, parse/degradation behaviour changes, a new result-contract error row, a policy engine, a configuration-layer production key, keyed hashing, or any new dependency (NG-1, NG-2, NG-6, NG-8).
- [OUT] Proving real coverage of the owner's private and hosted-product literals: the registry ships mechanism-only; this plan proves the mechanism with synthetic entries (OQ-1, RSK-4).
- [GAP-T1 — plan absent at authoring] No `chg-GH-184-plan.md` exists; `delivery_planning` follows this phase. This plan binds behaviour, assertions, and AC mapping; the plan must map its phases onto these TCs and must not reshape them.
- [RESOLVED-T2 — changeset-count wording (spec v1.1)] The v1.0 ambiguity ("exactly one changeset" as a total count, against five pre-existing unreleased changesets) was reported and corrected in spec v1.1: AC-F8-1, F-8, NFR-8, DEC-9, §16, and §18 now state exactly one **new** changeset added by this change, with pre-existing changesets untouched. The plan asserts that corrected semantics directly via a change diff over `.changeset/`; no reinterpretation remains.
- [RESOLVED-T3 — AC-adjacent behaviours (spec v1.1 §17)] The four behaviours reported at v1.0 (placeholder suppression, codec validation order, binary-skip reporting, performance) now have an explicit spec coverage note mapping each to an existing AC, "no separate AC by design". The plan's bindings in §3.4 now cite that note; nothing is tested without an AC anchor.
- [GAP-T4 — environment-bound evidence, spec-confirmed] AC-F7-1 ("when the binding CI jobs run") and the NFR-5 numeric bound cannot be executed inside a local test process. Spec v1.1 §17 states that AC-F7-1 and NFR-5 are CI-runner-evidenced: the pushed-HEAD job result is the evidence of record. The plan therefore asserts the structure locally (validators over the workflow, measured budgets) and records the live-PR run in §10; no test pretends to be the CI job.
- [GAP-T5 — scoped spawned-process exception] Two ACs are inherently about a real process boundary: the CLI exit code/output of the guard (AC-F5-2, AC-F7-2) and the runner's failure propagation for the test job (AC-F7-3). This plan therefore licenses a closed set of spawned processes (§4.1) and keeps every other assertion in-process. The set is enumerated, never implicit; no other test may spawn.

## 2. References

- **Change specification**: [chg-GH-184-spec.md](./chg-GH-184-spec.md) **v1.1** — F-1..F-8, DM-1..DM-7, NFR-1..NFR-9, C-1..C-7, AC-F1-1..AC-F8-1 (22 ACs), RSK-1..RSK-9, DEC-1..DEC-9, §17 coverage note, §18 Definition of Done. v1.1 corrected the changeset semantics (exactly one new changeset added by this change; pre-existing untouched) and added the §17 coverage note this plan cites.
- **Decision record**: [TDR-0005](../../../decisions/TDR-0005-privacy-and-no-cloud-guard-mechanics.md) — one check plus one registry authority, domain-separated unsalted digest, no-echo reporting, hashed `cloud-term` class, required policy at the single serialization point, working-tree boundary, no config-layer key.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — injected time/randomness/environment, runtime-API confinement, purity, error contract.
- **Existing invariant precedents**: [`scripts/checks/forbidden-literals.ts`](../../../../scripts/checks/forbidden-literals.ts) + `forbidden-literals.registry.json` (registry-as-authority, allowlist, live-tree scan); [`scripts/checks/secret-read-boundary.ts`](../../../../scripts/checks/secret-read-boundary.ts) (exact-path, reason-bearing, fail-closed allowlist); [`scripts/checks/ci-topology.ts`](../../../../scripts/checks/ci-topology.ts), `ci-bindingness.ts`, `ci-supply-chain.ts`, `script-surface.ts`.
- **Existing mutation suites**: [`tests/checks/forbidden-literals.test.ts`](../../../../tests/checks/forbidden-literals.test.ts), [`tests/checks/secret-read-boundary.test.ts`](../../../../tests/checks/secret-read-boundary.test.ts), [`tests/checks/fixture-repo.ts`](../../../../tests/checks/fixture-repo.ts), [`tests/checks/ci-checks.test.ts`](../../../../tests/checks/ci-checks.test.ts), [`tests/golden/redaction.test.ts`](../../../../tests/golden/redaction.test.ts) (mutant-module import pattern).
- **Existing envelope surfaces**: [`packages/core/src/contracts/envelope.ts`](../../../../packages/core/src/contracts/envelope.ts), [`packages/adapters/src/io/envelope-codec.ts`](../../../../packages/adapters/src/io/envelope-codec.ts), [`tests/behaviour/envelope-roundtrip.test.ts`](../../../../tests/behaviour/envelope-roundtrip.test.ts), [`tests/behaviour/envelope-degradation.test.ts`](../../../../tests/behaviour/envelope-degradation.test.ts), [`tests/behaviour/envelope-write-path.test.ts`](../../../../tests/behaviour/envelope-write-path.test.ts), [`tests/structure/envelope-contract.test.ts`](../../../../tests/structure/envelope-contract.test.ts), [`tests/structure/content-inventory.test.ts`](../../../../tests/structure/content-inventory.test.ts), [`tests/types/`](../../../../tests/types/).
- **Change precedent for shape**: [chg-GH-179-test-plan.md](../2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-test-plan.md), [chg-GH-181-test-plan.md](../2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-test-plan.md).
- **Ticket**: GH-184 — M0-S15: Privacy and no-cloud guards.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | Each of the seven generic rules fires once per planted positive, naming rule id, file, line | TC-PRIVACY-001 | Covered |
| AC-F1-2 | False-positive corpus yields 0 violations; every enabled rule has a positive and a near-miss negative | TC-PRIVACY-002, TC-PRIVACY-003 | Covered |
| AC-F2-1 | A synthetic `private-literal` entry detects the planted literal with id/file/line/fingerprint; removal passes | TC-PRIVACY-004 | Covered |
| AC-F2-2 | An authoring-produced entry detects its literal as data, with no code change or rebuild | TC-PRIVACY-005 | Covered |
| AC-F2-3 | Case and edge-whitespace variants detect by normalized form; repeat runs report the same set | TC-PRIVACY-006, TC-PRIVACY-007 | Covered |
| AC-F3-1 | Empty production `cloud-term` class with an explicit empty reason passes and is reported vacuous | TC-PRIVACY-008, TC-PRIVACY-020 | Covered |
| AC-F3-2 | A synthetic `cloud-term` entry fails on planted content; removing the entry passes | TC-PRIVACY-009 | Covered |
| AC-F4-1 | Every malformed-registry case fails closed, names the field/entry id, and reports no scan pass | TC-PRIVACY-010, TC-PRIVACY-011, TC-PRIVACY-012 | Covered |
| AC-F4-2 | History-only value passes; untracked-not-ignored fails; ignored is not scanned | TC-PRIVACY-014, TC-PRIVACY-021 | Covered |
| AC-F4-3 | Unknown/weaker scope, missing/extra rule id, or exceeded cap fails closed naming it | TC-PRIVACY-010, TC-PRIVACY-013 | Covered |
| AC-F4-4 | Two runs are byte-identical, the working tree is unchanged, and no network access occurs | TC-PRIVACY-015 | Covered |
| AC-F5-1 | Both output modes carry id/file/line/fingerprint and none of the planted literal, a content window, or the digest input | TC-PRIVACY-016, TC-PRIVACY-017 | Covered |
| AC-F5-2 | Authoring mode emits only registry fields, never echoes input, writes no file, and refuses under CI | TC-PRIVACY-018, TC-PRIVACY-019 | Covered |
| AC-F6-1 | A guarded payload returns `content-policy-violation` with one id, no carrier, no echo | TC-POLICY-001, TC-POLICY-003, TC-POLICY-004, TC-POLICY-008 | Covered |
| AC-F6-2 | A clean envelope serializes across every carrier within the bound; existing suites stay green | TC-POLICY-002, TC-POLICY-003, TC-POLICY-004 | Covered |
| AC-F6-3 | The codec has 0 `node:*`/`bun:*` imports and 0 ambient/clock/randomness/fs/network accesses; policy and hash injected | TC-POLICY-005 | Covered |
| AC-F6-4 | File scan and emitter policy report the same rule id for the same guarded value | TC-POLICY-006 | Covered |
| AC-F6-5 | Human content containing a guarded-looking value is preserved and not blocked | TC-POLICY-007 | Covered |
| AC-F7-1 | `ts-invariants` invokes the guard by name and fails on a planted value; topology/bindingness/supply-chain/script-surface/ci-checks stay green | TC-WIRE-001 | Covered |
| AC-F7-2 | `check:privacy-literals` exits 0 offline without a build and reports scope/rule/entry/vacuous counts | TC-WIRE-002, TC-PRIVACY-020 | Covered |
| AC-F7-3 | Both new suites run under `pnpm test` and a deliberately failing case fails the job | TC-WIRE-003 | Covered |
| AC-F8-1 | The change adds exactly one new changeset declaring minor for the five fixed-group packages; no pre-existing changeset is modified or deleted; no version hand-edit; lockfile unchanged | TC-RELEASE-001, TC-RELEASE-002 | Covered |

**Capability coverage** (every capability linked): F-1 → TC-PRIVACY-001..003, 006, 007, TC-POLICY-006; F-2 → TC-PRIVACY-004..007, 011; F-3 → TC-PRIVACY-008, 009, 013; F-4 → TC-PRIVACY-010..015, 021; F-5 → TC-PRIVACY-016..019; F-6 → TC-POLICY-001..008; F-7 → TC-WIRE-001..003, TC-PRIVACY-020; F-8 → TC-RELEASE-001, 002.

**Reverse traceability**: every scenario's `Related IDs` line carries at least one AC, and the Scenario Index (§5.1) repeats the mapping. No TC is an orphan (see §3.4).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no `API-#` or `EVT-#` (no REST/HTTP surface and no event, metric, or persisted schema; §§8.1–8.2). The interface surface is the seven data-model elements.

| DM | Element | TC ID(s) | Observable assertion |
|----|---------|----------|----------------------|
| DM-1 | Privacy guard registry | TC-PRIVACY-010, 011, 012, 013, 020 | The registry is the only authority for scope, enabled ids, classes, entries, allowlist, exclusions, caps; every malformation fails closed. |
| DM-2 | Hashed literal entry | TC-PRIVACY-004, 005, 009, 011, 013 | Exactly `{id, class, algorithm, hash, length, reason}`; `sha256`; lowercase hex digest; normalized length; non-empty reason. |
| DM-3 | Generic rule definition | TC-PRIVACY-001, 002, 006, TC-POLICY-005, 006 | One committed definition set; the registry's enabled ids equal it exactly; both consumers read the same definitions. |
| DM-4 | Violation record | TC-PRIVACY-016, 017 | `{ruleOrEntryId, file, line, fingerprint}`; the fingerprint derives only from the id and is ≤ 16 chars. |
| DM-5 | Envelope content policy | TC-POLICY-001, 003, 005, 008 | A pure total function from the exact compact envelope JSON to allow or a single denial id; injected hash and entries; no I/O. |
| DM-6 | Extended serialization failure | TC-POLICY-001, 003, 004 | `content-policy-violation` carries one id only; the two existing kinds and their fields are unchanged. |
| DM-7 | Authoring output | TC-PRIVACY-018, 019, 005 | Registry-entry-shaped output with id/class/algorithm/digest/length/reason placeholders; never the literal or digest input. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Determinism/read-only: byte-identical runs, 0 files written, 0 network calls, stable ordering by path→line→id | TC-PRIVACY-006, 015, 020, 021 | Covered |
| NFR-2 | Generic-rule precision: 0 violations on the committed corpus; every rule has a positive and a near-miss | TC-PRIVACY-002, 003, 020 | Covered |
| NFR-3 | Public-log safety: 0 occurrences of literal/window/digest input; fingerprint ≤ 16 chars, identifier-only | TC-PRIVACY-016, 017, 018, 019 | Covered |
| NFR-4 | Non-vacuity: 100% of rules and classes exercised; empty class carries a reason; 0 silently unexercised | TC-PRIVACY-001, 002, 008, 009, 020 | Covered |
| NFR-5 | Performance/linearity: ≤ 60 s full scan, linear per distinct length, ≤ 32 lengths, ≤ 10 ms per 2048-byte envelope, no superlinear backtracking | TC-PRIVACY-021 | Covered (measured; CI-runner-evidenced per spec §17) |
| NFR-6 | Codec purity/compatibility: 0 runtime imports or ambient reads; existing behaviour green; 100% call sites pass a policy; no default-open path | TC-POLICY-002, 005, 007 | Covered |
| NFR-7 | CI bindingness: 0 bypass constructs; invoked by name in `ts-invariants`; five preserved checks green; suites fail the job | TC-WIRE-001, 002, 003 | Covered |
| NFR-8 | Release integrity: exactly one new minor changeset × 5 packages, pre-existing changesets untouched; 0 version hand-edits; unchanged lockfile; license audit green; 0 new deps | TC-RELEASE-001, 002 | Covered |
| NFR-9 | Registry bounds: ≤ 256 entries, ≤ 128/class, ≤ 32 lengths, 4–512 chars, 64 hex digits, ≤ 256 KiB, every exceeded bound named | TC-PRIVACY-013 | Covered |

### 3.4 Gap Check (coverage matrix integrity)

- **Uncovered ACs**: none. All 22 ACs appear in §3.1 with at least one TC.
- **Orphan TCs**: none. Each of the 34 TCs names at least one AC in §5.1 and §5.2.
- **Duplicate coverage is intentional where a property is shared**: AC-F6-1 spans four policy TCs because it asserts four distinct properties (kind, single id, no carrier/echo, hashed-entry denial); AC-F3-1 spans two because the vacuity report is asserted at the registry level and over the live tree.
- **Behaviours covered through an existing AC** (spec v1.1 §17 coverage note; no separate AC by design):

| Behaviour | Spec source | Bound AC | Where |
|---|---|---|---|
| Placeholder suppression exactness | F-1 §5.1; spec §17 | AC-F1-2 (the 0-violation corpus outcome) | TC-PRIVACY-003 |
| Codec validation order (closed → size → policy → carrier) | F-6 §5.1; spec §17 | AC-F6-1 (deny path) + AC-F6-2 (bound) | TC-POLICY-003 |
| Binary skip and counted exclusion | F-4 §5.1, NG-7; spec §17 | AC-F4-2 (scan boundary) | TC-PRIVACY-014 |
| Scan performance and linearity budgets | NFR-5; spec §17 | AC-F4-2 (bounded, finite scan), CI-runner-evidenced | TC-PRIVACY-021 |
| Allowlist exactness / fixture-root-only directory entry | F-4 §5.1, RSK-7 | AC-F4-1 (allowlist entry matching nothing fails closed) | TC-PRIVACY-012 |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Invariant mutation suite | `bun test tests/checks` | `tests/checks/privacy-literals.test.ts`, `privacy-registry.test.ts`, `privacy-reporting.test.ts`, `privacy-authoring.test.ts`, `privacy-scope.test.ts`, `privacy-performance.test.ts` | TC-PRIVACY-001..021 |
| Real CLI invocation | `bun run scripts/checks/privacy-literals.ts` (spawned) | `tests/checks/privacy-reporting.test.ts`, `privacy-authoring.test.ts`, `privacy-ci-wiring.test.ts` | Exit codes, stdout/stderr, stdin/env behavior for TC-PRIVACY-016..019, TC-WIRE-002 |
| Emitter policy behaviour | `bun test tests/behaviour` | `tests/behaviour/envelope-content-policy.test.ts` | TC-POLICY-001..004, 006..008 |
| Contract / structure / purity | `bun test tests/structure` | new `tests/structure/privacy-imports.test.ts`; updates to `envelope-contract.test.ts`, `content-inventory.test.ts`, `tests/structure/inventory.json` | TC-POLICY-002, 005; TC-PRIVACY-001 (DM-3 definition set) |
| Type probe | `pnpm typecheck` (`tests/types/tsconfig.json`) | `tests/types/envelope-policy.type-test.ts` | TC-POLICY-002 (required policy, no default-open) |
| Binding CI wiring | `bun test tests/checks/privacy-ci-wiring.test.ts`; `bun run scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain,script-surface}.ts`; `bun test tests/checks/ci-checks.test.ts` | existing validators over the live and mutated workflow | TC-WIRE-001, 003 |
| Release metadata | `bun test tests/checks/privacy-release.test.ts`; `bun run scripts/checks/changesets-group.ts`, `license-audit.ts` | changeset + manifest + lockfile assertions | TC-RELEASE-001, 002 |
| Aggregate / non-regression | `pnpm check`; `bun test` | repo root; unchanged gates | All TCs (regression half) |

### 4.1 In-process vs spawned-process contract (binding)

1. **Default in-process.** Every scan, validation, normalization, window, reporting, and policy assertion imports the production modules and calls them directly. The only child processes allowed in this plan are: (a) the guard command itself, for tests whose AC is about a real exit code, stdout, stderr, stdin, environment, or working directory; (b) `git` inside a temp fixture repository (init/add/commit/show/status) for the scope and release cases; (c) `git` for the build-free probe, materialized as a temp clone or archive extract of HEAD so the live repository (including its `.git` metadata) is never written; (d) the test runner (`bun test`) for the failure-propagation proof in TC-WIRE-003; and (e) the package manager (`pnpm install --frozen-lockfile`) for the release assertion in TC-RELEASE-002. No other spawn is licensed; a spawned process must never write the live repository tree.
2. **Temp roots only.** Fixture trees are created under `mkdtemp` in the OS temp directory. Mutation tests edit copies; the live tree is read-only to every test except the guard's own read-only scan.
3. **Deterministic content.** Fixture bytes are committed or generated deterministically; no test depends on the wall clock, the developer's home directory, ambient locale, or file-system enumeration order.
4. **Recorded arguments over inference.** Where the AC concerns what a collaborator receives (the policy input, the injected hash, the scanned file set), the test records the argument instead of inferring it from the output.

### 4.2 Mutation / non-vacuity contract (binding for every rule and entry class)

Every guard rule class and every entry class must satisfy the triple before its TC may pass:

1. **Fires when planted.** The synthetic value is asserted non-empty, asserted present in the fixture file (or payload), and the scan/policy reports the expected id, file, and line.
2. **Silent when removed.** The same tree with the value (or the registry entry) removed passes, and the only delta between the two runs is the value/entry under test.
3. **Detection-disabled control fails the suite.** A temp mutant copy of the production module with the named detection step disabled is imported through a file URL (the `tests/golden/redaction.test.ts` pattern) and asserted to report zero/nothing on the same planted input, while the fixture still verifiably contains the value. If the real module also reported nothing, the test would fail; if the fixture were empty, the test would fail. This is the non-vacuity proof.

The same triple applies to output-safety assertions: an **echo-enabled mutant** reporter must produce output containing the planted value, proving the absence assertion is capable of failing.

### 4.3 No-echo proof contract (binding for AC-F5-1, AC-F5-2, AC-F6-1, NFR-3)

For every planted value, the test asserts absence of the planted literal, **every candidate window** of each registered length taken from the scanned file body, and the digest input (normalized literal plus the versioned domain prefix) across:

- stdout, stderr, and every string key and value of the parsed machine-readable document (walked recursively, not merely substring-searched over the whole stream);
- the human-readable failure text, including line-1 violations;
- the serialization failure object (keys and values), not just the carrier;
- authoring-mode output.

Absence alone is not accepted: the test first asserts the planted value is non-empty and present in the input, then asserts an echo-enabled mutant is detected by the same assertion. A hex-string inventory assertion additionally rejects any content-derived digest in the output: every hex string of length ≥ 16 must be the documented fingerprint or an unrelated identifier.

### 4.4 Fail-closed registry malformation matrix

Each cell is a named subcase (`RV-nn`) materialized from the live registry in a temp tree. Every subcase asserts: non-zero exit, exactly one failure message naming the offending field/class/entry id/bound, **no scan-pass claim in the output**, and zero violations reported (no partial scan). A valid control runs in the same suite.

| ID | Malformation | Expected named failure | TC |
|----|--------------|------------------------|----|
| RV-01 | Schema-version key missing | schema version | TC-PRIVACY-010 |
| RV-02 | Unknown schema-version value | schema version | TC-PRIVACY-010 |
| RV-03 | Unknown scope mode | scope mode | TC-PRIVACY-010 |
| RV-04 | Weaker scope mode (explicit/narrowed mode that scans fewer files) | scope mode | TC-PRIVACY-010 |
| RV-05 | Enabled rule id missing (6 of 7) | rule id | TC-PRIVACY-010 |
| RV-06 | Extra/unknown enabled rule id | rule id | TC-PRIVACY-010 |
| RV-07 | Unknown class name | class | TC-PRIVACY-010 |
| RV-08 | A declared class id with no class declaration block | class | TC-PRIVACY-010 |
| RV-09 | Empty class without an explicit empty reason | class/empty reason | TC-PRIVACY-010 |
| RV-10 | Enabled rule ids duplicated | rule id | TC-PRIVACY-010 |
| RV-11 | Entry not an object / missing required key | entry id | TC-PRIVACY-011 |
| RV-12 | Duplicate entry id | entry id | TC-PRIVACY-011 |
| RV-13 | Duplicate digest (same length) | digest | TC-PRIVACY-011 |
| RV-14 | Duplicate digest with inconsistent length | digest/length | TC-PRIVACY-011 |
| RV-15 | Unknown algorithm | algorithm | TC-PRIVACY-011 |
| RV-16 | Digest shape mismatch (not 64 lowercase hex) | digest | TC-PRIVACY-011 |
| RV-17 | Length shape mismatch (non-integer, missing) | length | TC-PRIVACY-011 |
| RV-18 | Length outside 4–512 | length | TC-PRIVACY-011, 013 |
| RV-19 | Reasonless entry (missing or empty) | entry id/reason | TC-PRIVACY-011 |
| RV-20 | Empty or whitespace-only entry id | entry id | TC-PRIVACY-011 |
| RV-21 | Allowlist entry matching no scanned path | allowlist id | TC-PRIVACY-012 |
| RV-22 | Duplicate allowlist entry | allowlist id | TC-PRIVACY-012 |
| RV-23 | Reasonless allowlist entry | allowlist id/reason | TC-PRIVACY-012 |
| RV-24 | Duplicate exclusion entry | exclusion id | TC-PRIVACY-012 |
| RV-25 | Reasonless exclusion entry | exclusion id/reason | TC-PRIVACY-012 |
| RV-26 | Wildcard/prefix/absolute/trailing-separator allowlist path | allowlist id | TC-PRIVACY-012 |
| RV-27 | > 256 entries total | entry cap | TC-PRIVACY-013 |
| RV-28 | > 128 entries in one class | class cap | TC-PRIVACY-013 |
| RV-29 | > 32 distinct normalized lengths | length cap | TC-PRIVACY-013 |
| RV-30 | Registry file > 256 KiB | file size cap | TC-PRIVACY-013 |

### 4.5 Prohibited test dependencies (explicit)

- **No git history for detection.** The guard's own detection is never asserted against `git log`, `git show`, a commit SHA, or a baseline. History appears only as a *fixture* in a temp repository (to prove the scan ignores it); the change-base diff is used exclusively for release metadata (AC-F8-1), never for detection.
- **No network.** No test resolves a host or opens a socket; the no-network property is proven by the import graph plus a throwing `fetch`/spawn stub, not by observation of packets.
- **No wall-clock for correctness.** Time appears only in the NFR-5 budget measurements, with generous ceilings and ratio-based linearity; no verdict depends on date, timezone, or elapsed time.
- **No real environment.** No test reads the developer's home directory, user name, hostname, real credentials, or the real state directory.
- **No real guarded content.** No fixture, document, or assertion contains a real private literal, a real credential-shaped sample, a real hosted-product term, a salt, or a key. Every fixture value is fabricated and carries a synthetic canary; the one hosted-product-shaped fixture value is fabricated and exists only to prove `cloud-term` activation.
- **No CI observation inside a test.** A test asserts the workflow's structure and the command's exit behavior; the actual job result is recorded in §10.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|-------|-------|------|--------|----------|----|
| TC-PRIVACY-001 | Seven generic rule classes fire on planted positives | Negative | Critical | High | AC-F1-1 |
| TC-PRIVACY-002 | Near-miss negatives and the false-positive corpus | Negative | Critical | High | AC-F1-2 |
| TC-PRIVACY-003 | Placeholder suppression is narrow and non-vacuous | Corner Case | Important | High | AC-F1-2 |
| TC-PRIVACY-004 | Hashed `private-literal` entry detects and clears | Happy Path | Critical | High | AC-F2-1 |
| TC-PRIVACY-005 | Authoring-produced entry is data-only (no code change, no rebuild) | Integration | Critical | High | AC-F2-2 |
| TC-PRIVACY-006 | Normalization and case/whitespace variants | Edge Case | Critical | High | AC-F2-3 |
| TC-PRIVACY-007 | Window boundaries and the distinct-length matrix | Edge Case | Important | High | AC-F2-3 |
| TC-PRIVACY-008 | Production `cloud-term` class is empty and reported vacuous | Happy Path | Critical | High | AC-F3-1 |
| TC-PRIVACY-009 | Synthetic `cloud-term` activation and entry removal | Negative | Critical | High | AC-F3-2 |
| TC-PRIVACY-010 | Registry validation: schema, scope, enabled rules, classes | Negative | Critical | High | AC-F4-1, AC-F4-3 |
| TC-PRIVACY-011 | Registry validation: entries, duplicates, digests, reasons | Negative | Critical | High | AC-F4-1 |
| TC-PRIVACY-012 | Registry validation: allowlist/exclusions and allowlist exactness | Negative | Critical | High | AC-F4-1 |
| TC-PRIVACY-013 | Registry caps and bounds (NFR-9) | Negative | Critical | High | AC-F4-3 |
| TC-PRIVACY-014 | Scan boundary: history, untracked, ignored, binary, exclusions | Edge Case | Critical | High | AC-F4-2 |
| TC-PRIVACY-015 | Determinism, read-only, and no-network | Regression | Critical | High | AC-F4-4 |
| TC-PRIVACY-016 | No-echo reporting in both output modes | Regression | Critical | High | AC-F5-1 |
| TC-PRIVACY-017 | Fingerprint: identifier-only, short, stable | Regression | Critical | High | AC-F5-1 |
| TC-PRIVACY-018 | Authoring mode: stdin-only record, no echo, no writes | Happy Path | Critical | High | AC-F5-2 |
| TC-PRIVACY-019 | Authoring mode: CI refusal, no argv/env channel | Negative | Critical | High | AC-F5-2 |
| TC-PRIVACY-020 | Live-tree green and non-vacuous scope reporting | Happy Path | Critical | High | AC-F3-1, AC-F7-2 |
| TC-PRIVACY-021 | Scan and emitter performance/linearity budgets | Performance | Important | Medium | AC-F4-2 |
| TC-POLICY-001 | Guarded payload denied in every payload field and carrier | Negative | Critical | High | AC-F6-1 |
| TC-POLICY-002 | Clean envelopes serialize; the policy is required | Happy Path | Critical | High | AC-F6-2 |
| TC-POLICY-003 | Validation order and totality at the codec | Corner Case | Critical | High | AC-F6-1, AC-F6-2 |
| TC-POLICY-004 | Failure shape and DM-6 compatibility | Regression | Critical | High | AC-F6-1, AC-F6-2 |
| TC-POLICY-005 | Codec purity, single serialization point, inventory/boundary gates | Regression | Critical | High | AC-F6-3 |
| TC-POLICY-006 | Shared-rule parity between scan and emitter | Regression | Critical | High | AC-F6-4 |
| TC-POLICY-007 | Human content is preserved and not scanned | Happy Path | Critical | High | AC-F6-5 |
| TC-POLICY-008 | Hashed-entry matching at the emitter with injected hash/entries | Negative | Critical | High | AC-F6-1 |
| TC-WIRE-001 | Binding `ts-invariants` invocation and preserved CI checks | Regression | Critical | High | AC-F7-1 |
| TC-WIRE-002 | Local command: offline, build-free, count-reporting | Happy Path | Critical | High | AC-F7-2 |
| TC-WIRE-003 | New suites run under the binding test job and fail it | Regression | Critical | High | AC-F7-3 |
| TC-RELEASE-001 | Exactly one new minor changeset for the five fixed-group packages | Regression | Critical | High | AC-F8-1 |
| TC-RELEASE-002 | No version hand-edits, unchanged lockfile, no new dependency | Regression | Critical | High | AC-F8-1 |

`TC-PRIVACY-*`, `TC-POLICY-*`, `TC-WIRE-*`, and `TC-RELEASE-*` are new prefixes with no prior use in the repository, so no existing TC identifier is reused for a different scenario.

### 5.2 Scenario Details

#### TC-PRIVACY-001 - Seven generic rule classes fire on planted positives

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-3, DM-4, NFR-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/fixtures/privacy-literals/rules.ts`
**Tags**: @backend

**Preconditions**:

- One fabricated positive per enabled rule id (7), each shaped to match exactly one class and carrying a distinctive synthetic canary. No value is a real credential, real path, or real product term.
- A temp repository (materialized via the `tests/checks/fixture-repo.ts` pattern) containing one non-allowlisted file per value and a copy of the delivered registry.
- The delivered rule-definition set, read through the shared module.

**Steps**:

1. Assert the enabled rule-id set is exactly the 7 committed ids and that each fixture value is non-empty and present in its file (so no rule is exercised by an empty string).
2. Scan each single-value tree; assert exactly one violation carrying that rule id, the exact file, the correct 1-based line, and a fingerprint; assert a non-zero exit.
3. Plant all seven in one tree; assert 7 violations, one per rule, sorted by path, then line, then id, with no duplicate reporting.
4. Assert no violation is attributed to a second rule for the same value (each fixture matches exactly one class).
5. Detection-disabled control: import a temp mutant scan with the matching step disabled; assert it reports zero on the same tree while step 1's presence assertion still holds.

**Expected Outcome**:

- 7/7 rules fire on their own positives with id, file, line, and fingerprint; the multi-plant reporting is unique and deterministic; a disabled detector fails the suite.

#### TC-PRIVACY-002 - Near-miss negatives and the false-positive corpus

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-2, NFR-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/fixtures/privacy-literals/corpus/**`
**Tags**: @backend @golden

**Preconditions**:

- One near-miss negative per rule (a value that resembles the class but fails its minimum length, character class, structure, or context requirement).
- A committed false-positive corpus of fabricated prose, documentation samples, code samples, and change-artifact-shaped text containing near-shapes and documentation placeholders.

**Steps**:

1. Assert every enabled rule has at least one positive, at least one near-miss, and a written expectation for the near-miss (0 rules silently unexercised).
2. Scan the corpus tree; assert zero violations and exit 0.
3. Scan each near-miss; assert zero violations for that rule; assert the near-miss is non-empty and shares the rule's discriminating prefix with its positive (a genuine near-miss, not an unrelated string).
4. Mutation control: in a temp copy, extend one near-miss past its threshold; assert the rule fires, proving the negative was not passing because the fixture was empty.
5. Over-broad control: a temp mutant with the threshold removed accepts the near-miss; assert the test catches it.

**Expected Outcome**:

- The corpus is silent; every near-miss is a real near-miss; the positives and negatives are paired so neither can pass by accident; the over-broad mutant is caught.

#### TC-PRIVACY-003 - Placeholder suppression is narrow and non-vacuous

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/fixtures/privacy-literals/corpus/suppression/**`
**Tags**: @backend

**Preconditions**:

- One committed fixture per suppression class: documentation placeholder, redaction marker, and obviously fabricated sample.
- A fixture in which the suppression token and an adjacent real-shaped synthetic positive share a line and a file.
- A temp mutant with the suppression step disabled.

**Steps**:

1. Assert every declared suppression class has at least one fixture (0 classes silently unused) and that the suppression data is committed, not inferred from file paths.
2. Scan the suppressed fixtures; assert zero violations.
3. Scan the mixed file; assert the adjacent positive fires at its line and the placeholder does not, proving suppression is scoped to placeholder spans.
4. Mutant with suppression disabled: the placeholder fixture now fires; assert the test catches it.
5. Assert suppression never applies to a value outside a declared class (a fabricated-looking value that is not in the suppression list is not silently accepted).

**Expected Outcome**:

- Suppression is class-declared, narrow, and observable; it cannot grow silently into a general silence switch; the disabled mutant is caught.

**Notes**: Spec v1.1 §17 maps F-1 placeholder suppression to AC-F1-2 (no separate AC by design); this TC is that AC's evidence.

#### TC-PRIVACY-004 - Hashed `private-literal` entry detects and clears

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/fixtures/privacy-literals/activation.ts`
**Tags**: @backend

**Preconditions**:

- A fabricated private literal (non-credential-shaped, mixed case to exercise normalization, length ≥ 4).
- Its registry entry computed at test time with the production normalize + hash helpers; no digest for a real value is committed.
- A temp tree with the literal planted in a non-allowlisted file, and the same tree with the literal removed.

**Steps**:

1. Assert the entry shape is exactly `{id, class: "private-literal", algorithm: "sha256", hash, length, reason}`; assert the digest is 64 lowercase hex, the length equals the normalized literal length, and the reason is non-empty.
2. Scan the planted tree; assert exactly one violation with the entry id, file, line, and fingerprint, and a non-zero exit.
3. Assert the reported fingerprint is not the digest and does not contain the literal or the digest input.
4. Remove the literal; scan; assert exit 0 and zero violations.
5. Registry-removal control: remove the entry, keep the literal; assert exit 0 (the entry is the only detector for this value), then re-add with a new id and assert the new id is reported.
6. Detection-disabled control: a temp mutant skipping the hashed-entry pass reports zero on the planted tree.

**Expected Outcome**:

- The entry detects its literal with the entry id, file, line, and fingerprint; removal clears; the disabled mutant is caught; only a digest is committed.

#### TC-PRIVACY-005 - Authoring-produced entry is data-only (no code change, no rebuild)

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-2, DM-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/fixtures/privacy-literals/activation.ts`
**Tags**: @backend

**Preconditions**:

- A fresh fabricated literal; the authoring mode invoked on stdin; a temp copy of the registry path.
- Digest snapshots of the check and the shared rule module before and after the run.

**Steps**:

1. Produce an entry through the authoring mode; assert the output parses as a registry-entry-shaped record with id placeholder, class, algorithm, digest, normalized length, and reason placeholder, and no free-form content field.
2. Insert the record verbatim as data into the temp registry; plant the literal; run the unchanged guard; assert detection with the entry id.
3. Assert the check and shared-module digests are identical before and after (no code change), and that the registry is read at runtime (no registry import in the check's static import graph).
4. Prove "no rebuild": assert the check's transitive relative import graph contains no `dist/` path and no package-name import; corroborate by running the guard from a temp clone or archive extract of HEAD (which carries no `dist/`, and which never writes the live `.git`) and observing the same detection.
5. Assert a re-authored entry for the same literal yields the same digest (deterministic), and that changing only the reason/id leaves detection unchanged.

**Expected Outcome**:

- A helper-produced entry works as data with no code change and no build; the digest is deterministic; the registry is not compiled into the check.

#### TC-PRIVACY-006 - Normalization and case/whitespace variants

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`
**Tags**: @backend

**Preconditions**:

- One synthetic literal and its entry. Matching variants: exact, uppercase, mixed case, leading/trailing spaces, tab, single newline on each side. Non-matching variants: internal space inserted, split across two lines, one character changed, truncated to length − 1.

**Steps**:

1. Scan each matching variant; assert detection with the entry id and the same fingerprint for every variant.
2. Scan each non-matching variant; assert zero violations; assert the fixture is non-empty and differs from the matching form only by the named mutation.
3. Assert two consecutive runs over each fixture produce the identical violation set, order, and output bytes.
4. Call the production normalize helper from both the entry-building path and the window path and assert identical output for the same input (one normalization, not two).
5. Case-folding control: a temp mutant that skips lowercasing fails the uppercase variant; assert the test catches it.

**Expected Outcome**:

- Every variant whose normalized form matches is detected identically; non-matching mutations stay silent; normalization is single-sourced; the mutant is caught.

#### TC-PRIVACY-007 - Window boundaries and the distinct-length matrix

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, NFR-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`
**Tags**: @backend

**Preconditions**:

- Entries at normalized lengths 4, 5, 7, 16, 64, and 512; two entries sharing a prefix; one entry whose value is a substring of another's.
- Placements: file start, file end with no trailing newline, immediately after a newline, adjacent to punctuation, adjacent to a longer alphanumeric run, and a file shorter than every registered length.

**Steps**:

1. Assert each placement is detected at the correct line with exactly one violation per planted occurrence.
2. Assert the substring case reports the entry whose registered length matches at that position, and the longer value is detected through its own registered length.
3. Assert a file shorter than every registered length scans without error and reports zero.
4. Assert the scan enumerates exactly the distinct registered lengths (assert a counted/derived set equals the registry's distinct lengths) and accepts at most 32.
5. Negative control: a length-4 entry does not match a 3-character occurrence, and a value crossing a window with a changed interior character does not match.

**Expected Outcome**:

- Window detection is correct at boundaries and for overlapping lengths; the length set is exactly derived and bounded; short files and near-misses are safe.

#### TC-PRIVACY-008 - Production `cloud-term` class is empty and reported vacuous

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/checks/privacy-reporting.test.ts`
**Tags**: @backend

**Preconditions**:

- The delivered registry and the live working tree.

**Steps**:

1. Assert the `cloud-term` class has zero entries and carries a non-empty class-level empty reason; assert every empty class carries a reason (0 empty classes without one).
2. Run the guard over the live tree; assert exit 0 and that both human and machine-readable summaries report `cloud-term` as scanned-and-vacuous by class id.
3. Assert the summary is not silent: the vacuous-class field exists, is populated, and an empty/absent field would fail the assertion; assert entry counts per class are reported (zero included, never omitted).
4. Malformed control: a temp registry with an empty `cloud-term` class and an empty reason fails validation (RV-09); assert 008's vacuity assertion cannot be satisfied by the malformed registry.

**Expected Outcome**:

- The production class is visibly mechanism-only, not silently missing; the report distinguishes intentional emptiness from a malformed declaration.

#### TC-PRIVACY-009 - Synthetic `cloud-term` activation and entry removal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`, `tests/fixtures/privacy-literals/activation.ts`
**Tags**: @backend

**Preconditions**:

- A fabricated hosted-product-shaped term (a synthetic multi-word token, not a real product name), generated inside the allowlisted fixture root.
- A registry with a synthetic `cloud-term` entry computed at test time, and the same registry without it.
- A temp tree with the term planted in a scanned file; identical content in both runs.

**Steps**:

1. Scan with the entry; assert exactly one violation naming the entry id, file, line, and fingerprint; non-zero exit.
2. Scan the byte-identical content with the entry removed; assert exit 0 and zero violations.
3. Assert the class summary reports `cloud-term` as non-vacuous with one entry in the first run and vacuous in the second.
4. Assert no raw hosted-product term is committed: run a direct text search over the working tree (not through the guard's allowlist) for the fixture term and assert it appears only inside the allowlisted synthetic fixture root and nowhere in the registry, production source, docs, or tests outside that root.
5. Detection-disabled control: a temp mutant skipping the hashed-entry pass reports zero on the planted tree.

**Expected Outcome**:

- The mechanism activates and deactivates with data only; the production class remains term-free; the activation is observable in the summary; the disabled control is caught.

#### TC-PRIVACY-010 - Registry validation: schema, scope, enabled rules, classes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-3, DM-1
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-registry.test.ts`, `tests/fixtures/privacy-literals/registry.ts`
**Tags**: @backend

**Preconditions**:

- A valid registry copied into a temp tree; the named mutations RV-01..RV-10; a valid control.

**Steps**:

1. For each of RV-01..RV-10, materialize the mutation, run validation and the scan, and assert: non-zero exit, exactly one failure naming the schema version, scope mode, rule id, class, or empty reason, and no scan-pass line in the output.
2. Assert a registry carrying both a malformation and a planted violation reports only the registry failure and zero violations (validation precedes scanning; no partial pass).
3. Assert the valid control passes in the same suite.
4. Assert the supported scope mode is the working-tree mode and that a weaker mode is not silently accepted (RV-03/RV-04 fail closed by name).
5. Detection-disabled control: a temp mutant with validation short-circuited accepts RV-01; assert the suite catches it.

**Expected Outcome**:

- Every schema/scope/rule/class malformation fails closed by name; no partial scan is reported; the valid control is green; the short-circuit mutant is caught.

#### TC-PRIVACY-011 - Registry validation: entries, duplicates, digests, reasons

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-2
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-registry.test.ts`, `tests/fixtures/privacy-literals/registry.ts`
**Tags**: @backend

**Preconditions**:

- Named mutations RV-11..RV-20; one valid entry of each class; a valid control.

**Steps**:

1. For each of RV-11..RV-20, materialize the mutation and assert non-zero exit plus exactly one failure naming the entry id, digest, algorithm, length, or reason.
2. Assert each malformed entry is rejected before any scan (no violations reported, no pass line).
3. Assert the duplicate-digest-with-inconsistent-length case (RV-14) is distinguished from a same-length duplicate (RV-13) by the named failure.
4. Assert a valid entry survives every mutation applied to a *different* entry (the failure names the mutated one, not its neighbours).
5. Detection-disabled control: a temp mutant that accepts any entry shape passes RV-11; assert the suite catches it.

**Expected Outcome**:

- The entry-shape and duplicate matrix fails closed with precise names; neighbouring valid entries are not blamed; the permissive mutant is caught.

#### TC-PRIVACY-012 - Registry validation: allowlist/exclusions and allowlist exactness

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-1
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-registry.test.ts`, `tests/checks/privacy-literals.test.ts`
**Tags**: @backend

**Preconditions**:

- Named mutations RV-21..RV-26; the delivered allowlist; a temp tree with a synthetic positive inside the allowlisted fixture root and an identical value outside it.

**Steps**:

1. For each of RV-21..RV-26, assert non-zero exit and exactly one failure naming the allowlist/exclusion id or the rejected path form (wildcard, prefix, absolute, trailing separator).
2. Assert the delivered allowlist entries are exactly the enumerated set (rule-definition module, check, registry, guard test files, synthetic fixture root), each with a reason and a class, and that the fixture root is the only directory-style entry.
3. Assert an allowlist entry that matches no scanned path fails (RV-21) and that removing a required entry makes the guard's own planted-value tests fail loudly rather than silently.
4. Assert the identical synthetic value is not reported inside the fixture root and is reported outside it, and that the allowlisted span is counted in the summary rather than disappearing.
5. Detection-disabled control: a temp mutant that treats the allowlist as a prefix match accepts an entry it should reject; assert the suite catches it.

**Expected Outcome**:

- The allowlist is exact-path, reason-bearing, and narrow; the fixture root is the only directory entry; unmatched entries fail; suppression is visible and cannot hide a value elsewhere.

#### TC-PRIVACY-013 - Registry caps and bounds (NFR-9)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, NFR-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-registry.test.ts`
**Tags**: @backend

**Preconditions**:

- Generated registries at the boundary and one past it: 256/257 total entries, 128/129 in one class, 32/33 distinct lengths, length 3/4 and 512/513, digest of 63/64/65 characters and uppercase hex, registry file at 256 KiB and one byte over.
- A valid control at every accepted boundary.

**Steps**:

1. Assert every exceeded bound fails closed naming the bound and its limit (RV-18, RV-27..RV-30).
2. Assert every exact boundary value is accepted (256 entries, 128/class, 32 lengths, length 4 and 512, 64 lowercase hex, 256 KiB).
3. Assert the delivered registry is within every bound and reports its counts.
4. Assert the failure names the bound rather than a generic parse error, and that no violations are reported in the over-bound runs.
5. Detection-disabled control: a temp mutant without the cap checks accepts 257 entries; assert the suite catches it.

**Expected Outcome**:

- Every NFR-9 bound is enforced at the exact boundary and named on failure; the delivered registry is inside all bounds; the uncapped mutant is caught.

#### TC-PRIVACY-014 - Scan boundary: history, untracked, ignored, binary, exclusions

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-scope.test.ts`, `tests/checks/fixture-repo.ts`
**Tags**: @backend

**Preconditions**:

- A temp git repository with: (a) a commit containing a guarded value later removed so the working tree is clean; (b) an untracked-not-ignored file containing the value; (c) an ignored file containing the value; (d) a tracked file containing the value; (e) a binary file whose bytes contain the value; (f) a file under an enumerated exclusion containing the value.

**Steps**:

1. (a) Scan; assert zero violations and exit 0 (no history replay; assert the value exists in a commit via `git show`, proving the fixture is live).
2. (b) Scan; assert a violation naming the untracked file.
3. (c) Scan; assert zero violations and assert the ignored path is absent from the scanned-file list (not silently counted as scanned).
4. (d) Scan; assert a violation naming the tracked file.
5. (e) Scan; assert zero violations and that the reported binary-skip count is > 0, naming or counting the skipped path (never silent).
6. (f) Scan; assert the enumerated exclusion with a reason is not scanned; a reasonless exclusion fails validation (RV-25).
7. Assert the file list is sorted by path and is independent of creation order (materialize the same tree in two orders and compare).

**Expected Outcome**:

- Only the working-tree, non-ignored, non-excluded text files are scanned; history and ignored files are provably outside; binary skips are reported; ordering is stable.

**Notes**: Spec v1.1 §17 maps F-4 binary-skip reporting to AC-F4-2 (no separate AC by design); step 5 carries that evidence.

#### TC-PRIVACY-015 - Determinism, read-only, and no-network

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-reporting.test.ts`
**Tags**: @backend

**Preconditions**:

- A temp tree with three planted violations (one generic, one `private-literal`, one `cloud-term`); a registry copy; a snapshot of every file's content digest and mode; git status.
- A pure import-graph reader for the check's transitive relative imports.

**Steps**:

1. Run the guard twice in human mode and twice in machine mode; assert byte-identical stdout/stderr and identical exit codes.
2. Assert the snapshot (content digests, file set, modes) and `git status --porcelain` are unchanged by the runs.
3. Assert no file was created or deleted in the tree and no file outside the process was touched.
4. Assert the import graph contains no network-capable module (`node:http`, `node:https`, `node:net`, `node:tls`, `node:dns`, `node:dgram`, an HTTP client dependency, or a bare `fetch` reference); run the scan with a throwing `fetch` and a throwing spawn stub installed and assert it still succeeds.
5. Assert the only spawned child process in the suite is `git` in the temp repository (spawn recorder).
6. Mutation control: a temp mutant that writes a cache file is caught by the snapshot assertion.

**Expected Outcome**:

- Two runs are byte-identical and write nothing; no network-capable path exists; the writing mutant is caught.

#### TC-PRIVACY-016 - No-echo reporting in both output modes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3, DM-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-reporting.test.ts`
**Tags**: @backend

**Preconditions**:

- A planted generic positive, a planted `private-literal`, and a planted synthetic `cloud-term`, each verifiably non-empty and present in its file; the scanned file bodies; the candidate-window generator for each registered length; an echo-enabled mutant reporter.

**Steps**:

1. For each violation kind, run human and machine modes; assert each output carries the rule/entry id, file, line, and fingerprint.
2. Recursively walk every string key and value of the machine-readable document and assert none contains the planted literal, any candidate window from the file body, the digest input (normalized literal + domain prefix), or the full file body.
3. Assert the human-readable text and stderr contain none of the same.
4. Assert every hex string of length ≥ 16 in the output is the documented fingerprint or an unrelated identifier (no content-derived digest).
5. Non-vacuity: assert the planted value is non-empty, present in the input, and that the echo-enabled mutant produces output containing it (so the absence assertion demonstrably detects an echo).
6. Assert a line-1 violation does not print the file body or a line excerpt.

**Expected Outcome**:

- Both modes report only identifiers, file, line, and fingerprint; no content channel exists; the echo mutant is caught.

#### TC-PRIVACY-017 - Fingerprint: identifier-only, short, stable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3, DM-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-reporting.test.ts`
**Tags**: @backend

**Preconditions**:

- The seven rule ids and several synthetic entry ids; violations produced from different files, lines, and contents.

**Steps**:

1. Assert the fingerprint length is ≤ 16 and its character set is the documented one.
2. Assert the same id yields the same fingerprint across different files, lines, contents, registries, and runs.
3. Assert distinct ids yield distinct fingerprints across the whole id set.
4. Assert changing the id changes the fingerprint and changing only the content does not (identifier-derived, domain-separated).
5. Assert two files with different content but the same rule id produce the same fingerprint (no content dependence).

**Expected Outcome**:

- The fingerprint is short, stable, id-derived, and collision-free over the id set; content cannot influence it.

#### TC-PRIVACY-018 - Authoring mode: stdin-only record, no echo, no writes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-7, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-authoring.test.ts`
**Tags**: @backend

**Preconditions**:

- A fabricated literal supplied on stdin by a spawned invocation in an environment without a CI marker; a tree snapshot; the production normalize + hash helpers for recomputation.

**Steps**:

1. Invoke the authoring mode with the literal on piped stdin; assert exit 0 and output parsing as a registry-entry-shaped record with exactly the fields id placeholder, class, algorithm, digest, normalized length, and reason placeholder (no content field).
2. Assert the literal, the digest input, and any content window never appear in stdout or stderr.
3. Recompute the digest and normalized length with the production helpers; assert equality with the emitted values.
4. Assert the tree snapshot is unchanged and `git status --porcelain` is clean (no repository file written).
5. Assert piped stdin is accepted and the hidden-terminal preference is implemented (delivery-bound); assert an empty input and an over-512-character input fail with a named failure and no digest emitted.
6. Non-vacuity: an echo-enabled mutant of the authoring path prints the literal; assert the assertion catches it.

**Expected Outcome**:

- The helper emits only paste-ready registry fields; the literal and digest input never appear; nothing is written; invalid input fails without a digest; the echo mutant is caught.

#### TC-PRIVACY-019 - Authoring mode: CI refusal, no argv/env channel

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-authoring.test.ts`
**Tags**: @backend

**Preconditions**:

- Spawned invocations with a controlled environment; a fabricated literal; the guard's documented CI-detection variable (`CI`, with the platform CI variable as a secondary signal).

**Steps**:

1. With the primary CI marker present, invoke the authoring mode with stdin; assert non-zero exit, a refusal message naming CI, and no digest, literal, or digest input in stdout or stderr.
2. Without any CI marker (explicitly removed from the child environment), assert the same invocation exits 0 and emits the record — the positive control proving the refusal is conditional.
3. With only the secondary CI marker present, assert refusal (fail-closed detection).
4. Pass the literal as a command-line argument with empty stdin; assert it is never used, the mode fails with a named input failure, and the argument value appears in no output stream.
5. Set an environment variable containing the literal with empty stdin; assert it is never used and the value appears in no output stream.

**Expected Outcome**:

- The authoring mode refuses under CI (any supported detection) and works without it; argv and environment are not literal channels; no channel echoes the value.

#### TC-PRIVACY-020 - Live-tree green and non-vacuous scope reporting

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, F-7, AC-F3-1, AC-F7-2, NFR-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-literals.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- The delivered repository working tree at the change HEAD and the delivered registry.
- A temp copy mechanism for the mutation half (never modifying the live tree).

**Steps**:

1. Run the guard against `process.cwd()`; assert exit 0 and zero violations (the practical false-positive gate).
2. Assert non-vacuous scope: scanned file count > 0, enabled rule count = 7, entry counts per class equal the registry, distinct length count reported, and every vacuous class named with its reason.
3. Assert the changed areas are covered: the check, the registry, the shared rule module, the guard tests, the fixture root (allowlisted), the docs, and this change folder are each either scanned or explicitly allowlisted/excluded with a reason.
4. Assert the allowlisted surfaces equal TC-PRIVACY-012's exact set (no growth).
5. Assert `git status --porcelain` is unchanged by the run.
6. Mutation control: copy the tree to a temp root, plant a synthetic positive outside every allowlisted path, scan the copy, and assert it fires (the live-tree green result is therefore not vacuous).

**Expected Outcome**:

- The real tree is clean and the scope is demonstrably non-empty; the changed surfaces are accounted for; the planted copy fires.

#### TC-PRIVACY-021 - Scan and emitter performance/linearity budgets

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-2, NFR-5
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated (measured; authoritative on CI)
**Target Layer / Location**: `tests/checks/privacy-performance.test.ts`, `tests/fixtures/privacy-literals/performance.ts`
**Tags**: @backend @perf

**Preconditions**:

- A deterministically generated synthetic corpus (well under 50 MiB) exercising every registered length; a pathological near-miss corpus of long lines and adjacent shapes; the 2048-byte envelope fixture.

**Steps**:

1. Measure a full scan of the generated corpus; assert the recorded elapsed time is ≤ 60 s (generous local ceiling; the authoritative measurement is the CI reference runner, recorded in §10).
2. Measure at N and 2N corpus sizes for each registered length; assert the ratio is within a recorded slack (≈ 2.5×) so superlinear behavior fails while noise passes.
3. Assert the distinct-length count is ≤ 32 and, through the pure helper's counter, that per-window work is bounded by the literal-length cap.
4. Assert the pathological input completes within the same budget and that no rule pattern contains a nested unbounded quantifier (pattern-shape lint over the committed definitions).
5. Measure the policy over repeated 2048-byte clean envelopes; assert the median is ≤ 10 ms and that the recorded median is stored, not silently dropped.
6. Assert no assertion uses wall-clock for a correctness verdict: the time thresholds are isolated in this TC and every other TC's verdict is timing-independent.

**Expected Outcome**:

- The scan is linear and within budget on the fixture corpus; the emitter budget is measured; the pattern set is structurally backtracking-bounded; the recorded numbers are available for the CI run.

**Notes**: Spec v1.1 §17 maps the NFR-5 numeric bound to AC-F4-2's bounded/finite scan and states NFR-5 is CI-runner-evidenced. This TC records the local measurement; the pushed-HEAD run in §10 is the evidence of record for the numeric threshold.

#### TC-POLICY-001 - Guarded payload denied in every payload field and carrier

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-5, DM-6, NFR-3
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`, `tests/fixtures/privacy-literals/envelopes.ts`
**Tags**: @backend

**Preconditions**:

- A clean v1 envelope fixture; a synthetic generic-rule positive placed one at a time in `producingAgent`, `operatorAuthority`, `workItemRef`, and `runId`.
- The production policy builder over the shared rules, an injected pure hash, and injected empty hashed entries; all three carriers.

**Steps**:

1. For each field × carrier, assert `ok: false`, `failure === "content-policy-violation"`, exactly one `ruleOrEntryId` equal to the matching rule, and no `carrier` property on the result.
2. Assert the failure object contains no payload value, no content window, and no digest input (recursive string walk).
3. Assert exactly one id is returned even when the planted value matches more than one rule class, and that the id is one of the matching ids and stable across runs.
4. Assert denial is decided on the escaped compact JSON, not the raw payload: a value whose JSON escaping differs from its raw form (quotes, backslashes, unicode escapes) is still denied; assert the policy received exactly `JSON.stringify(envelope)`.
5. Clean control: the same envelope without the planted value returns `ok: true` for all three carriers.

**Expected Outcome**:

- Every payload string field is scanned in every carrier; the deny result is one failure kind, one id, no carrier, no content; a clean control passes.

#### TC-POLICY-002 - Clean envelopes serialize; the policy is required

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`, `tests/types/envelope-policy.type-test.ts`, `tests/structure/envelope-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- The golden envelope fixtures; a clean policy; the `tests/types` probe project compiled by `pnpm typecheck`.

**Steps**:

1. Serialize every golden envelope through all three carriers with the policy; assert `ok: true`, `byteLength` ≤ 2048, the carrier shape unchanged, and parse round-trip equality.
2. Assert the existing round-trip, degradation, and write-path suites are green after being updated only to supply a policy (no assertion changed; diff review recorded).
3. Type probe: a call omitting the policy is a compile error; a call whose policy returns a non-contract shape is a compile error; the probe is included in `tests/types/tsconfig.json`.
4. Structural: assert the serialization input type declares a required (non-optional) policy member; assert the implementation has no default parameter, no overload, and no fallback branch that constructs a carrier without a policy (AST scan).
5. Single-point audit: assert exactly one envelope serialization function exists and every in-repo call site passes a policy (AST/call-site scan plus a seeded call-site violation that fails the scan).

**Expected Outcome**:

- Clean envelopes still serialize everywhere within the bound; omitting the policy cannot compile; no default-open path or second serialization point exists.

#### TC-POLICY-003 - Validation order and totality at the codec

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-2, DM-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording policy (records invocation count and argument); envelopes: (a) open payload + guarded value; (b) closed payload + guarded value + over-size; (c) closed payload + guarded value within size; (d) closed clean payload + over-size; (e) clean within size.

**Steps**:

1. (a) → `payload-not-closed`; assert the policy was not invoked.
2. (b) → `size-bound-exceeded`; assert the policy was not invoked (size before policy).
3. (c) → `content-policy-violation`; assert the policy was invoked exactly once with the compact JSON of the validated envelope.
4. (d) → `size-bound-exceeded`; (e) → `ok: true` with the policy invoked once and the carrier constructed once.
5. Assert every path returns a result and never throws (wrap each call so a throw fails the test).
6. Assert no carrier of any kind is constructed when the policy denies (including the custom-field carrier, which has no text channel).
7. Assert the recorded policy input for (c) equals the exact representation embedded on the success path for the same envelope (escaping equivalence).

**Expected Outcome**:

- The order is closed payload → size → policy → carrier; the policy is not consulted before its turn; no path throws; denial leaves no carrier.

**Notes**: Spec v1.1 §17 maps F-6 codec validation order to AC-F6-1/AC-F6-2 (no separate AC by design); this TC is that AC's ordering evidence.

#### TC-POLICY-004 - Failure shape and DM-6 compatibility

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-2, DM-6
**Test Type(s)**: Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`, `tests/structure/envelope-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- The pre-change failure assertions (recorded in the existing suites) for `payload-not-closed` and `size-bound-exceeded`.

**Steps**:

1. Assert the closed failure-kind union is exactly the three literals and `content-policy-violation` is the only added member.
2. Assert `payload-not-closed` and `size-bound-exceeded` results keep their field sets and byte-length semantics (0 for the closed-payload failure, the measured value for the size failure) exactly as before.
3. Assert the content-policy failure's keys are exactly the documented ones and it carries the single id and no other content-bearing field.
4. Assert no result variant carries the payload, the file text, the policy input, or a content digest.
5. Assert the existing round-trip and degradation suites pass with their original assertions (diff shows only the policy-supplying edit).

**Expected Outcome**:

- The new failure kind is additive and minimal; the two existing kinds are compatible; no failure variant carries content.

#### TC-POLICY-005 - Codec purity, single serialization point, inventory/boundary gates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-6
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/privacy-imports.test.ts`, `tests/structure/envelope-contract.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend

**Preconditions**:

- The codec; the shared rule module; the policy builder; the committed source inventory; the boundary and ambient checks.

**Steps**:

1. AST/static: assert the codec has 0 `node:*`/`bun:*` imports and 0 references to `process`, `Bun`, `Deno`, `Date`, `performance`, `Math.random`, `crypto`, filesystem, or network; assert it imports only `import type` contract members and, if used, the pure shared module.
2. Assert the policy and hash arrive as injected typed function inputs and the codec contains no default hash implementation.
3. Assert the shared rule module is pure: 0 runtime imports, 0 ambient/clock/randomness, exports only data and pure functions; assert both the file check and the policy builder import it, and assert each rule id is defined exactly once in the repository.
4. Run `bun test tests/boundaries`, `bun run scripts/checks/ambient-globals.ts`, and `bun run scripts/checks/secret-read-boundary.ts`; assert green. Seed a `node:fs` import in a temp codec copy and assert the purity scan fails naming it.
5. Assert `tests/structure/content-inventory.test.ts` passes with every new package source file registered and its executable exports allowed; assert the inventory equals the actual file set (a missing entry fails).
6. Single-point audit: assert no module other than the codec constructs an envelope marker or serializes an envelope; seed a second serialization path in a temp copy and assert the audit fails.

**Expected Outcome**:

- The codec stays pure and dependency-free; policy and hash are injected; one shared definition set; inventory and boundary gates green; seeded violations are caught.

#### TC-POLICY-006 - Shared-rule parity between scan and emitter

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-1, AC-F6-4, DM-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`, `tests/checks/privacy-literals.test.ts`
**Tags**: @backend

**Preconditions**:

- One synthetic guarded value per rule class that can appear in a payload string (a line-context rule uses an embeddable variant inside the string, such as a path-shaped or assignment-shaped value); every rule is either paired or explicitly excluded with a reason.
- The file scan and the production policy builder.

**Steps**:

1. For each paired rule class, run the file scan on a temp file containing the value and the policy on an envelope carrying the same value in a payload field; assert both report the same rule id.
2. Assert there is no remapping table: the id returned by the policy is present verbatim in the shared rule-definition set.
3. Assert a value matching no rule is clean at both surfaces.
4. Mutation control: in a temp copy of the shared module, rename one rule id; assert both surfaces report the renamed id (one source of truth, not two tables); restore and assert the original.
5. Static: assert neither surface contains a rule-id literal absent from the shared module.

**Expected Outcome**:

- Both surfaces agree on the rule id for the same value; the definitions are single-sourced; renaming propagates; no duplicated table exists.

#### TC-POLICY-007 - Human content is preserved and not scanned

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-5, NFR-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`, `tests/behaviour/envelope-write-path.test.ts`
**Tags**: @backend

**Preconditions**:

- A clean envelope; human content containing a synthetic guarded-looking value; a recording policy.

**Steps**:

1. Serialize through all three carriers; assert `ok: true`.
2. Assert the parsed human content equals the input byte-for-byte, and the comment/compact carriers contain it exactly once (not stripped, escaped, or modified).
3. Assert the recorded policy input equals the compact envelope JSON only and does not contain the human content string.
4. Control: a mutant codec that passes human content into the policy denies; assert the recorded-argument assertion catches that mutant (the production path never sends it).
5. Assert the file guard still governs committed human content (cross-check with TC-PRIVACY-020 that the docs and change artifacts are in the scanned set).

**Expected Outcome**:

- Human content is untouched and outside the emitter scan; the scan covers exactly the envelope payload; the mutant that widens the surface is caught.

#### TC-POLICY-008 - Hashed-entry matching at the emitter with injected hash/entries

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-5, DM-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-content-policy.test.ts`
**Tags**: @backend

**Preconditions**:

- A synthetic `private-literal` entry and a synthetic `cloud-term` entry; an envelope carrying each term in each payload field; a pure injected hash; a recording hash wrapper and a recording entry source.

**Steps**:

1. With each entry registered, serialize; assert `content-policy-violation` with the entry id (not a rule id), no carrier, and no echo across all four payload fields.
2. Assert both classes are exercised (2/2) and that each class's id is reported.
3. Assert the injected hash is used: a hash stub returning a fixed value yields no match and a clean envelope, proving the match is computed, not bypassed.
4. Assert entries are injected data, not a filesystem read: with empty entries the same payload serializes; ambient stubs that throw are not touched (no I/O).
5. Assert rule-id and entry-id namespaces cannot collide silently: either a colliding id is rejected when building the policy or the reported id is unambiguously one namespace (assert one of the two).

**Expected Outcome**:

- Hashed entries deny at the emitter with the entry id; hash and entries are injected pure inputs; no I/O; both classes exercised; namespace collisions cannot pass silently.

#### TC-WIRE-001 - Binding `ts-invariants` invocation and preserved CI checks

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-7
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-ci-wiring.test.ts`, `.github/workflows/ci.yml`, `scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain,script-surface}.ts`
**Tags**: @backend

**Preconditions**:

- The workflow; the validators; temp copies of the workflow and of a planted tree.

**Steps**:

1. Assert the `ts-invariants` step list contains a command that invokes the guard by name; assert the job has no `continue-on-error`, no bypass construct, and no history dependency in the guard command itself (the job may fetch the base for other checks).
2. Assert no new job was added (`TS_JOBS` and `BASH_JOBS` unchanged; the bash job set byte-unchanged) and the workflow remains additions-only against `origin/main-tools`.
3. Assert the aggregate `check` script is unchanged and does not chain the privacy check; assert `script-surface` is green and the exact aggregate assertions in `tests/checks/ci-checks.test.ts` are unmodified.
4. Mutation controls on temp workflow copies: removing the invocation fails the topology wiring check naming the script; adding `continue-on-error` fails the bindingness check naming the job; adding a bypass construct fails; adding a new job fails the topology job-set assertion.
5. Failure propagation: run the guard command in a temp copy of the tree with a planted value; assert non-zero exit and the named violation; run the same command on the clean tree and assert exit 0 (the step can fail).
6. Run `bun run scripts/checks/ci-topology.ts`, `ci-bindingness.ts`, `ci-supply-chain.ts`, `script-surface.ts`, and `bun test tests/checks/ci-checks.test.ts`; assert all green with no weakened assertion.

**Evidence commands**:

```
bun run scripts/checks/ci-topology.ts
bun run scripts/checks/ci-bindingness.ts
bun run scripts/checks/ci-supply-chain.ts
bun run scripts/checks/script-surface.ts
bun test tests/checks/ci-checks.test.ts
bun test tests/checks/privacy-ci-wiring.test.ts
```

**Expected Outcome**:

- The guard is invoked by name in the binding job and can fail it; no bypass or new job exists; topology, bindingness, supply-chain, script-surface, and the CI mutation suite stay green without weakening.

**Notes**: Spec v1.1 §17 states AC-F7-1 is CI-runner-evidenced: the local steps prove the invocation can fail, and the pushed-HEAD job result recorded in §10 is the evidence of record.

#### TC-WIRE-002 - Local command: offline, build-free, count-reporting

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-ci-wiring.test.ts`, `package.json`
**Tags**: @backend

**Preconditions**:

- The delivered root manifest with `check:privacy-literals`; a clean tree; a temp clone or archive extract of HEAD for the build-free probe.

**Steps**:

1. Assert the root manifest declares `check:privacy-literals` invoking the check, and that the aggregate `check` does not reference it.
2. Run `pnpm check:privacy-literals` on the clean tree; assert exit 0 and reported counts: scanned files > 0, enabled rules = 7, entries per class, distinct lengths, and vacuous classes.
3. Build-free: assert the check's transitive relative import graph contains no `dist/` path, no workspace package-name import, and no external dependency; corroborate by running the guard from the temp clone/archive (no `dist/`) and asserting the same clean result.
4. Offline: assert the import graph has no network-capable module; run with a throwing `fetch` stub and assert the same result.
5. Assert the command is read-only (tree snapshot unchanged) and deterministic (two runs byte-identical).
6. Negative control: a planted value in a temp copy makes the same command exit non-zero and name the violation, so the exit-0 claim is not vacuous.

**Expected Outcome**:

- The local command exits 0 offline with no build and reports the required counts; a planted value makes it fail; it remains outside the aggregate.

#### TC-WIRE-003 - New suites run under the binding test job and fail it

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, NFR-7
**Test Type(s)**: Static, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-ci-wiring.test.ts`, `bunfig.toml`, `package.json`
**Tags**: @backend

**Preconditions**:

- The workflow, the root manifest, `bunfig.toml`, and the new suite paths.

**Steps**:

1. Assert the `ts-test` job runs `pnpm test`; `package.json#scripts.test` is `bun test` with no filter, positional pattern, `--bail`, `--passWithNoTests`, or `|| true`.
2. Assert `bunfig.toml` test discovery covers `tests/**` and its ignore patterns do not exclude `tests/checks` or `tests/behaviour`; assert the new suite paths are inside the discovered roots.
3. Run each new suite explicitly; assert exit 0 and parse a pass count > 0 for each (discovery and non-emptiness).
4. Failure propagation: run `bun test` on a temp-dir test file with a deliberately failing case; assert exit 1 and that the output names that file and assertion (the runner path `ts-test` uses).
5. Mutation control: materialize a temp copy of one new suite with an injected failing case and run it by absolute path with the repository as the working directory; assert exit 1.
6. Assert the job and script contain no bypass construct and the job has no `continue-on-error`.
7. Record the live PR run of `ts-test` in §10 as the environment-bound evidence; a red `ts-test` blocks delivery.

**Evidence commands**:

```
bun test tests/checks/privacy-literals.test.ts
bun test tests/checks/privacy-registry.test.ts
bun test tests/checks/privacy-scope.test.ts
bun test tests/checks/privacy-reporting.test.ts
bun test tests/checks/privacy-authoring.test.ts
bun test tests/checks/privacy-performance.test.ts
bun test tests/behaviour/envelope-content-policy.test.ts
bun test tests/structure
```

**Expected Outcome**:

- Both suites are discovered and executed by the binding job's command; a failing case fails the runner; no bypass exists; the live run is recorded, not assumed.

#### TC-RELEASE-001 - Exactly one new minor changeset for the five fixed-group packages

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-release.test.ts`, `.changeset/*.md`, `scripts/checks/changesets-group.ts`
**Tags**: @backend

**Preconditions**:

- The changeset added by this change (named in the delivery plan; delivery-bound) and the five pre-existing unreleased changesets; the fixed-group configuration; a fetched `origin/main-tools` (the change base for the diff assertions).

**Steps**:

1. Assert the change diff over `.changeset/` (`git diff --name-status origin/main-tools...HEAD -- .changeset/`) shows exactly one added entry and zero modified and zero deleted entries; assert the added path is the changeset named by the delivery plan (delivery-bound).
2. Assert every pre-existing changeset path is present and byte-identical to its base version: for each path, run `git diff --exit-code origin/main-tools...HEAD` scoped to that path and compare the working bytes with the base blob read through `git show` on the base ref. Assert the pre-existing file count is unchanged, so "one added" is not achieved by deleting another change's release metadata.
3. Assert the added changeset's frontmatter lists exactly the five fixed-group package names, each at `minor`, and no other package (testkit absent, no `patch`/`major` on any of the five).
4. Assert the body is non-empty and describes the contract/codec tightening.
5. Assert `bun run scripts/checks/changesets-group.ts` is green (one fixed group of five, testkit excluded).
6. Mutation controls in temp copies: a testkit line, a missing package, a `patch` bump, a second added changeset, one pre-existing changeset modified, and one pre-existing changeset deleted each fail the assertions; assert the suite catches each.

**Evidence commands**:

```
git diff --name-status origin/main-tools...HEAD -- .changeset/
git diff --diff-filter=MD --exit-code origin/main-tools...HEAD -- .changeset/
bun test tests/checks/privacy-release.test.ts
bun run scripts/checks/changesets-group.ts
```

**Expected Outcome**:

- Exactly one new changeset is added by this change and it declares a minor bump for all five fixed-group packages and nothing else; every pre-existing changeset is present and unmodified; the fixed-group check is green; each malformation and each pre-existing-changeset mutation is caught.

#### TC-RELEASE-002 - No version hand-edits, unchanged lockfile, no new dependency

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-release.test.ts`, `packages/*/package.json`, `pnpm-lock.yaml`, `scripts/checks/license-audit.ts`
**Tags**: @backend

**Preconditions**:

- The five fixed-group manifests and the testkit manifest; the lockfile; a fetched `origin/main-tools` (the release-metadata base).

**Steps**:

1. Assert all five fixed-group manifests (and testkit) declare the recorded pre-change version `0.0.0`; assert `git diff -U0 origin/main-tools...HEAD -- 'packages/*/package.json' 'package.json'` contains no changed `"version"` line (no version field was hand-edited).
2. Assert `git diff --exit-code origin/main-tools...HEAD -- pnpm-lock.yaml` (the lockfile is unchanged).
3. Assert `pnpm install --frozen-lockfile` succeeds (the unchanged lockfile satisfies every manifest).
4. Assert the dependency key sets (`dependencies`, `devDependencies`, `peerDependencies`) of the root and every package are unchanged against the base (read the base manifest through `git show` on the base ref and compare it with the working file): no added or removed key and no changed range. The new root `scripts` entry is the only permitted manifest edit.
5. Assert `bun run scripts/checks/license-audit.ts` is green and the existing license/vulnerability gates are green.
6. Assert the new root script adds no dependency and no package subpath (`exports-parity` and `subpaths` stay green).

**Evidence commands**:

```
git diff --exit-code origin/main-tools...HEAD -- pnpm-lock.yaml
git diff -U0 origin/main-tools...HEAD -- 'packages/*/package.json' 'package.json'
pnpm install --frozen-lockfile
bun run scripts/checks/license-audit.ts
bun test tests/checks/privacy-release.test.ts
```

**Expected Outcome**:

- No manifest version moved, the lockfile is unchanged, no dependency was added, and the license audit is green. These release-metadata assertions read the change base and are the only ones that do; the guard's own detection never reads history.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version` (1.4.4); pnpm pinned by `packageManager` (10.18.3); git; no network | All scan and policy suites are hermetic; the guard command needs no build |
| CI (`ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; `fetch-depth: 0`; `origin/main-tools` fetched for topology and release assertions | Authoritative for the NFR-5 reference-runner numbers and the live job result |
| Temp git fixture repositories | `mkdtemp` root; `git init`/`add`/`commit`/`show`/`status` | History, untracked, ignored, binary, exclusion, and mutation cases; deleted at test end |
| Temp clone/archive of HEAD | `git clone --no-hardlinks` into a temp directory (or `git archive` into one) with no ignored `dist/` and no `node_modules`; the live `.git` is never written | Corroborates the build-free claim for TC-PRIVACY-005 and TC-WIRE-002 |
| In-process test process | Bun runtime; no ambient reads where purity is asserted | Scan/validation/policy logic is imported and called directly |

### 6.2 Test Data and Fixtures Inventory (all synthetic)

All fixtures live under the allowlisted root `tests/fixtures/privacy-literals/`, or are generated at test time in a temp directory. No fixture contains a real private literal, a real credential-shaped sample, a real hosted-product term, a salt, a key, or a real user path; the `cloud-term` activation fixture uses a fabricated term only.

| Fixture / artefact | Shape | Lifecycle |
|--------------------|-------|-----------|
| `tests/fixtures/privacy-literals/rules.ts` | Seven fabricated positives (one per rule id), seven near-misses, and the suppression classes, each with a synthetic canary | Read-only |
| `tests/fixtures/privacy-literals/corpus/**` | Fabricated prose, documentation samples, code samples, and change-artifact-shaped text, including placeholders and near-shapes | Read-only; the false-positive gate |
| `tests/fixtures/privacy-literals/registry.ts` | A registry builder plus the named mutations RV-01..RV-30; the valid base is the delivered registry copied into a temp tree | Builder read-only; mutations applied to temp copies only |
| `tests/fixtures/privacy-literals/activation.ts` | Synthetic `private-literal` and `cloud-term` entries computed at test time from fabricated literals; the synthetic terms themselves | Read-only; digests are computed, never hand-copied from a real value |
| `tests/fixtures/privacy-literals/echo-mutants/**` | Echo-enabled reporter and authoring mutants (imported through a file URL) | Temp-copied; never executed against the live tree except as isolated modules |
| `tests/fixtures/privacy-literals/envelopes.ts` | Clean envelope, guarded envelopes per payload field, and the human-content fixture | Read-only |
| `tests/fixtures/privacy-literals/performance.ts` | Deterministic corpus generator (size parameter, every registered length) and the pathological near-miss generator | Generated in temp; never committed as large blobs |
| Temp repositories | `tests/checks/fixture-repo.ts` extended for history/untracked/ignored/binary/exclusion cases | `mkdtemp`; removed per test |
| Snapshot artefacts | Tree content digest and mode maps for read-only assertions | In-memory only |

### 6.3 Isolation Strategy

- Every fixture tree and mutation operates on a fresh temp root; no test writes the live repository tree, `dist/`, or the user's real state directory. A clean-tree check (`git status --porcelain` unchanged) is part of TC-PRIVACY-015 and TC-PRIVACY-020.
- Mutation tests edit copies only; the unchanged control always runs in the same suite so a disabled check is observable.
- The live-tree scan reads committed and working-tree files read-only; the planted-value variant copies the tree first.
- Spawned invocations use a controlled environment (CI markers added or removed explicitly), piped stdin, and a temp working directory where the case requires it.
- No test depends on file enumeration order; sorts are asserted.

### 6.4 Entry and Exit Criteria for the Phase

**Entry (before execution)**

- The spec is accepted into the change and TDR-0005 is on record (Proposed is acceptable, per the delivery precedent).
- `.ai/rules/testing-strategy.md` has been read (this plan was authored against it).
- The delivered `scripts/checks/privacy-literals.ts`, its registry, the shared rule module, the policy injection, the test suites, the CI invocation, the local script, and the new changeset exist.
- `origin/main-tools` is fetched; the release assertions (TC-RELEASE-001, TC-RELEASE-002) compare the change against that base, and CI fetches it. The base ref is a hard prerequisite for those two TCs, not a waiver: if it is missing the run fails, and no release assertion is recorded as passing.
- No real private literal, hosted-product term, credential, or owner data is present in the developer environment used to run the authoring-mode tests.

**Exit (before the change is proposed)**

- All 22 ACs have passing, traceable evidence recorded in §10 with commands, HEAD, and the live CI result.
- The live working tree is green (TC-PRIVACY-020) and every planted-value case fires (TC-PRIVACY-001, 009; TC-POLICY-001, 008).
- The registry malformation matrix is 30/30 fail-closed (RV-01..RV-30) and the caps are enforced at the boundaries.
- No output channel contains a planted literal, a content window, or a digest input, and the echo mutants prove the assertion is live.
- The codec purity and the required-policy probes are green; the existing envelope suites are green with only policy-supplying edits.
- `ts-invariants` invokes the guard by name; `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, and `tests/checks/ci-checks.test.ts` are green and unweakened.
- The local command exits 0 offline with no build and reports the required counts.
- Exactly one new changeset declares minor for the five fixed-group packages; every pre-existing changeset is present and unmodified; no manifest version moved; the lockfile is unchanged; the license audit is green.
- `git diff --check` is clean and no gate listed in §7 was skipped.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. File names are proposed under the repository testing strategy; delivery planning may bind different filenames but must preserve each TC's behaviour, assertions, and AC mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-PRIVACY-001 | `tests/checks/privacy-literals.test.ts` + `tests/fixtures/privacy-literals/rules.ts` | `bun test tests/checks/privacy-literals.test.ts` | per-rule positive; multi-plant; detection-disabled mutant | To Implement |
| TC-PRIVACY-002 | same + `tests/fixtures/privacy-literals/corpus/**` | same | near-miss pairs; corpus; threshold-removal mutant | To Implement |
| TC-PRIVACY-003 | same + `corpus/suppression/**` | same | suppression classes; adjacent positive; suppression-disabled mutant | To Implement |
| TC-PRIVACY-004 | `tests/checks/privacy-literals.test.ts` + `activation.ts` | same | planted/removed; entry-removal; detection-disabled mutant | To Implement |
| TC-PRIVACY-005 | same + `activation.ts` | same | authoring-produced entry; digest snapshot; clone/archive probe | To Implement |
| TC-PRIVACY-006 | `tests/checks/privacy-literals.test.ts` | same | matching/non-matching variants; normalization parity; case-fold mutant | To Implement |
| TC-PRIVACY-007 | same | same | boundary placements; overlapping lengths; short file | To Implement |
| TC-PRIVACY-008 | `tests/checks/privacy-literals.test.ts`, `privacy-reporting.test.ts` | `bun test tests/checks/privacy-literals.test.ts tests/checks/privacy-reporting.test.ts` | live vacuous report; malformed-reason control | To Implement |
| TC-PRIVACY-009 | `tests/checks/privacy-literals.test.ts` | `bun test tests/checks/privacy-literals.test.ts` | synthetic cloud-term; entry removal; live term scan | To Implement |
| TC-PRIVACY-010 | `tests/checks/privacy-registry.test.ts` + `registry.ts` | `bun test tests/checks/privacy-registry.test.ts` | RV-01..RV-10; validation-short-circuit mutant | To Implement |
| TC-PRIVACY-011 | same | same | RV-11..RV-20; permissive-shape mutant | To Implement |
| TC-PRIVACY-012 | `tests/checks/privacy-registry.test.ts`, `privacy-literals.test.ts` | corresponding `bun test` | RV-21..RV-26; allowlist exactness; prefix-match mutant | To Implement |
| TC-PRIVACY-013 | `tests/checks/privacy-registry.test.ts` | same | RV-18, RV-27..RV-30; boundary/one-past; uncapped mutant | To Implement |
| TC-PRIVACY-014 | `tests/checks/privacy-scope.test.ts` + `fixture-repo.ts` | `bun test tests/checks/privacy-scope.test.ts` | history/untracked/ignored/tracked/binary/exclusion cases | To Implement |
| TC-PRIVACY-015 | `tests/checks/privacy-reporting.test.ts` | `bun test tests/checks/privacy-reporting.test.ts` | replay; snapshot; import graph; fetch/spawn stubs; writing mutant | To Implement |
| TC-PRIVACY-016 | `tests/checks/privacy-reporting.test.ts` | same | three violation kinds; both modes; echo mutant | To Implement |
| TC-PRIVACY-017 | `tests/checks/privacy-reporting.test.ts` | same | id/content independence; collision check | To Implement |
| TC-PRIVACY-018 | `tests/checks/privacy-authoring.test.ts` | `bun test tests/checks/privacy-authoring.test.ts` | stdin pipe; no-write snapshot; echo mutant | To Implement |
| TC-PRIVACY-019 | `tests/checks/privacy-authoring.test.ts` | same | CI markers added/removed; argv/env channels | To Implement |
| TC-PRIVACY-020 | `tests/checks/privacy-literals.test.ts` | `bun test tests/checks/privacy-literals.test.ts` | live tree; temp-copy planted control | To Implement |
| TC-PRIVACY-021 | `tests/checks/privacy-performance.test.ts` + `performance.ts` | `bun test tests/checks/privacy-performance.test.ts` | size ratio; pathological input; pattern-shape lint; envelope median | To Implement |
| TC-POLICY-001 | `tests/behaviour/envelope-content-policy.test.ts` + `envelopes.ts` | `bun test tests/behaviour/envelope-content-policy.test.ts` | field × carrier matrix; escaping case; clean control | To Implement |
| TC-POLICY-002 | same + `tests/types/envelope-policy.type-test.ts` + `tests/structure/envelope-contract.test.ts` | corresponding `bun test`; `pnpm typecheck` | type probe; AST required-member scan; seeded call-site violation | To Implement |
| TC-POLICY-003 | `tests/behaviour/envelope-content-policy.test.ts` | same | recording policy; order matrix; no-throw sweep | To Implement |
| TC-POLICY-004 | same + `tests/structure/envelope-contract.test.ts` | corresponding `bun test` | three-kind union; legacy failure fields; diff review | To Implement |
| TC-POLICY-005 | `tests/structure/privacy-imports.test.ts`, `envelope-contract.test.ts`, `content-inventory.test.ts`, `inventory.json` | `bun test tests/structure`; `bun run scripts/checks/ambient-globals.ts`; `secret-read-boundary.ts` | seeded `node:fs` import; second serialization path; inventory gap | To Implement |
| TC-POLICY-006 | `tests/behaviour/envelope-content-policy.test.ts`, `tests/checks/privacy-literals.test.ts` | corresponding `bun test` | paired values; id-rename mutation; static id scan | To Implement |
| TC-POLICY-007 | `tests/behaviour/envelope-content-policy.test.ts`, `envelope-write-path.test.ts` | corresponding `bun test` | human-content equality; recorded policy input; widening mutant | To Implement |
| TC-POLICY-008 | `tests/behaviour/envelope-content-policy.test.ts` | same | both classes; fixed-hash stub; empty entries; namespace collision | To Implement |
| TC-WIRE-001 | `tests/checks/privacy-ci-wiring.test.ts` | `bun test tests/checks/privacy-ci-wiring.test.ts`; `bun run scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain,script-surface}.ts`; `bun test tests/checks/ci-checks.test.ts` | workflow mutations; planted-tree command run | To Implement |
| TC-WIRE-002 | `tests/checks/privacy-ci-wiring.test.ts` | same + `pnpm check:privacy-literals` | clone/archive probe; throwing fetch; planted-copy negative | To Implement |
| TC-WIRE-003 | `tests/checks/privacy-ci-wiring.test.ts` | same + `bun test` on each new suite | temp failing test; suite-with-failing-case copy | To Implement |
| TC-RELEASE-001 | `tests/checks/privacy-release.test.ts` + `.changeset/*.md` | `bun test tests/checks/privacy-release.test.ts`; `bun run scripts/checks/changesets-group.ts`; `git diff --name-status origin/main-tools...HEAD -- .changeset/` | added/modified/deleted change diff; testkit/missing/patch/second-added/pre-existing-modified/pre-existing-deleted mutants | To Implement |
| TC-RELEASE-002 | `tests/checks/privacy-release.test.ts` | same + `pnpm install --frozen-lockfile`; `bun run scripts/checks/license-audit.ts` | version-line and dependency key-set base comparison; lockfile base diff | To Implement |

**Execution order.**

1. Structure, purity, and vocabulary: TC-POLICY-005, TC-PRIVACY-001 (definition set half).
2. Generic rules, corpus, and suppression: TC-PRIVACY-001..003.
3. Hashed entries, normalization, windows, cloud activation: TC-PRIVACY-004..009.
4. Registry validation matrix and caps: TC-PRIVACY-010..013.
5. Scope, determinism, reporting, fingerprint, authoring: TC-PRIVACY-014..019.
6. Live-tree green and performance: TC-PRIVACY-020, 021.
7. Emitter policy: TC-POLICY-001..004, 006..008.
8. CI wiring and local command: TC-WIRE-001..003.
9. Release metadata: TC-RELEASE-001, 002.
10. Aggregate regression: `bun test`, `pnpm check`.

**Evidence commands** (run and record in §10; never record unrun results as passing):

```
pnpm install --frozen-lockfile
pnpm build
bun test tests/checks/privacy-literals.test.ts
bun test tests/checks/privacy-registry.test.ts
bun test tests/checks/privacy-scope.test.ts
bun test tests/checks/privacy-reporting.test.ts
bun test tests/checks/privacy-authoring.test.ts
bun test tests/checks/privacy-performance.test.ts
bun test tests/checks/privacy-ci-wiring.test.ts
bun test tests/checks/privacy-release.test.ts
bun test tests/behaviour/envelope-content-policy.test.ts
bun test tests/behaviour/envelope-roundtrip.test.ts
bun test tests/behaviour/envelope-degradation.test.ts
bun test tests/behaviour/envelope-write-path.test.ts
bun test tests/structure
bun test tests/boundaries
bun test tests/checks/ci-checks.test.ts
bun test tests/checks/fixture-sanitization.test.ts
bun test
bun run scripts/checks/privacy-literals.ts
pnpm check:privacy-literals
bun run scripts/checks/ci-topology.ts
bun run scripts/checks/ci-bindingness.ts
bun run scripts/checks/ci-supply-chain.ts
bun run scripts/checks/script-surface.ts
bun run scripts/checks/changesets-group.ts
bun run scripts/checks/license-audit.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/manifest-privacy.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/secret-read-boundary.ts
bun run scripts/checks/workspace-entrypoints.ts
bun run scripts/checks/boundary-ci-parity.ts
bash scripts/.tests/test-doc-distribution.sh
pnpm check
git diff --check
git status --porcelain
```

Notes on the battery:

- The privacy command needs no build; `pnpm build` is in the list only because the aggregate/CI-facing checks and the packed/exports gates read `dist/`.
- `bash scripts/.tests/test-doc-distribution.sh` is required only if the change touches a distributable doc (the system-spec-update phase may add `doc/spec/features/feature-privacy-guard.md`, which is not `doc/guides/`/`doc/templates/` and therefore does not require an `ados_distribution` marker; run the guard anyway if any guide or template changes).
- `git status --porcelain` is captured before and after the test battery; the guard and its tests must not modify the tree.

**Open-PR Definition of Done evidence checklist.** All 22 ACs have a passing traceable TC; the seven generic rules, both hashed classes, and the envelope policy are proven by the mutation triple; the 30-cell registry matrix fails closed; no output channel echoes content and the echo mutants are caught; the live tree is green with a non-vacuous scope report; the codec is pure, the policy is required with no default-open path, and shared-rule parity is proven; the binding CI invocation is present with all preserved checks green; the local command is build-free and offline; exactly one new five-package minor changeset is added, every pre-existing changeset is present and unmodified, and no version or lockfile change exists; no existing gate is weakened; an open unmerged PR targets `main-tools` with all required jobs green. This plan claims no merge and no owner acceptance.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A rule or entry fixture is inert, so a negative passes without proving detection | H | M | Every fixture asserts its planted value is non-empty and present; every class has a detection-disabled mutant control; removed-value controls run in the same suite (§4.2) |
| RSK-T2 | A no-echo assertion is vacuous (the value was never in the input) | H | M | Absence is always paired with a presence assertion and an echo-enabled mutant that must be detected (§4.3) |
| RSK-T3 | The allowlist hides a real value elsewhere | H | L | Exact-path entries with reasons; the fixture root is the only directory entry; an entry matching nothing fails; planted value inside vs outside the root is asserted (TC-PRIVACY-012) |
| RSK-T4 | Registry weakening (scope, rule ids, caps) silently disables coverage | H | L | 30-cell malformation matrix, exact-match rule ids, caps at boundaries, validation precedes scanning, short-circuit mutant |
| RSK-T5 | The live-tree green test passes because the scope is empty | H | M | Non-zero scanned-file assertion, rule/entry counts, and a planted copy that must fire (TC-PRIVACY-020) |
| RSK-T6 | The policy is bypassed by a second serialization path or an optional fallback | H | L | Type probe, AST required-member scan, single-point audit, seeded call-site and second-path violations (TC-POLICY-002, 005) |
| RSK-T7 | Hash/normalization semantics drift between the entry builder and the window scan | M | M | Single normalization helper asserted from both paths; case-fold mutant; window boundary matrix (TC-PRIVACY-006, 007) |
| RSK-T8 | CI wiring is asserted vacuously because the command never runs | H | M | The guard command is executed on a planted tree and must fail, and on the clean tree and must pass (TC-WIRE-001) |
| RSK-T9 | The "one changeset" assertion is read as a total count and forces deleting other release metadata | M | L | Spec v1.1 corrected AC-F8-1 to "exactly one new changeset added by this change, pre-existing untouched"; the plan asserts the change diff both ways (one added, none modified/deleted) and mutates a pre-existing changeset (TC-RELEASE-001) |
| RSK-T10 | Performance thresholds are flaky on a developer machine | M | M | Generous ceilings, N and 2N ratio checks with slack, recorded medians; the authoritative number is the CI run (TC-PRIVACY-021) |
| RSK-T11 | Temp-tree tests accidentally write the live tree | H | L | All fixtures under `mkdtemp`; snapshots and `git status` before/after; a writing mutant is caught (TC-PRIVACY-015) |
| RSK-T12 | Existing gate assertions are weakened to make the change pass | H | L | `ci-checks.test.ts` and its exact assertions are unmodified and asserted; `ci-topology`, `bindingness`, `supply-chain`, `script-surface` run in the battery; diff review in TC-POLICY-004 |

### 8.2 Assumptions

- **A-T1 — Behaviour-bound TCs.** Proposed filenames, helper names, and feature-local symbols may change in delivery planning; the behaviour, assertions, ids, and AC mapping must not. Spec-fixed values (`content-policy-violation`, the seven rule ids, the two class names, the 4–512 length range, the 64-hex digest, the caps, `sha256`, working-tree scope) may not be rebound.
- **A-T2 — Shared rule module placement is delivery-bound.** The spec requires one pure shared definition set consumed by the check and the policy, with the codec importing only contract types. The plan does not pin the directory; it pins purity, single definition, dual consumption, and no codec runtime import (TC-POLICY-005, 006).
- **A-T3 — Delivery-bound spellings.** The authoring-mode flag, the machine-readable flag, the exact failure-message prefix, the CI-detection variable set (primary plus secondary), the summary field names, and the shared-module path are delivery-bound. The plan pins the semantics: stdin-only authoring, no echo, no writes, CI refusal, the reported count fields, and the named failure per malformation.
- **A-T4 — Check invocation spelling.** The guard is invoked by name in `ts-invariants` and by the `check:privacy-literals` root script; the exact command line may include a flag set, but `bun run scripts/checks/privacy-literals.ts` is the expected default and the one asserted unless delivery documents a different invocation.
- **A-T5 — Changeset identity.** The changeset file name is delivery-bound; the plan asserts exactly one change-added changeset, that every pre-existing changeset is unmodified, and the added changeset's shape, per corrected AC-F8-1 (spec v1.1).
- **A-T6 — Base ref availability.** The release assertions need `origin/main-tools` as the change base; CI fetches it and the local battery fetches it first. Absence is a prerequisite failure for TC-RELEASE-001/002, never a waiver.
- **A-T7 — Synthetic fixture root allowlist.** The guard's allowlist includes `tests/fixtures/privacy-literals/` as the only directory entry and the guard's own test files as exact-file entries. If delivery adds more test files, the allowlist grows by reviewed exact paths, and TC-PRIVACY-012's exact-set assertion is updated in the same change, never relaxed to a prefix.
- **A-T8 — No real digests.** Every hashed entry used in tests is computed at test time from a fabricated literal; committing a digest of a real value would defeat the change's purpose.
- **A-T9 — `cloud-term` and `private-literal` production emptiness.** The delivered registry ships with no `private-literal` entries and an empty, explicitly reasoned `cloud-term` class; tests assert whatever is delivered and require the reason for any empty class (owner population is OQ-1, not a delivery blocker).
- **A-T10 — NFR-5 measurement.** The local suite records timings; spec v1.1 §17 states the numeric bound is evidenced on the CI reference runner and recorded in §10. The test fails on order-of-magnitude regressions, not on jitter.
- **A-T11 — Plan-relative.** The delivery plan (absent at authoring) maps its phases onto these TCs; any later plan or implementation change that alters a TC's behaviour, assertion, or AC mapping must reopen this test plan.
- **A-T12 — `version_impact`.** `minor` is taken from the spec; the changeset shape follows it.

### 8.3 Open Questions and Recorded Gaps

| ID | Question / gap | Context | Status | Owner |
|----|----------------|---------|--------|-------|
| OQ-T1 / RESOLVED-T2 | Does AC-F8-1 mean "one changeset added by this change" or "one changeset file in `.changeset/`"? | Five pre-existing unreleased changesets are committed; the literal reading was unsatisfiable without deleting them | **Resolved — spec v1.1 reworded AC-F8-1** (and F-8, NFR-8, DEC-9, §16, §18): exactly one new changeset added by this change, no pre-existing changeset modified or deleted. The plan asserts that wording directly (TC-RELEASE-001) | @pm (closed) |
| OQ-T2 / RESOLVED-T3 | Should placeholder suppression, codec validation order, binary skip reporting, and performance get their own ACs? | They were spec-named behaviours without an AC | **Resolved — spec v1.1 §17 coverage note** maps each to an existing AC (AC-F1-2, AC-F6-1/AC-F6-2, AC-F4-2, AC-F4-2 + CI-runner evidence); §3.4 cites the note | @pm (closed) |
| OQ-T3 | Where does the shared rule module live, and how does the check import it? | DEC-2 requires one pure shared module; the plan leaves placement to delivery | Open — delivery-bound, non-blocking (A-T2) | @plan-writer / @coder |
| OQ-T4 | What are the authoring-mode and machine-readable flag spellings, and the CI-detection variable set? | The semantics are pinned by the spec; the spellings are not | Open — delivery-bound (A-T3) | @coder |
| OQ-T5 | Does the guard report allowlisted and excluded spans as counts, and with what field names? | F-4 requires counted, reported exclusions; the field names are not pinned | Reported counts are required; names are delivery-bound (A-T3) | @coder |
| OQ-T6 | How is the "no build" property proven where the check imports a workspace package by name? | The plan prefers a relative/builtin-only import graph; a package-name import would require `node_modules` in the clone/archive probe | Preferred: relative imports; fallback: import-graph assertion only (A-T2, OQ-T3) | @coder / @reviewer |
| OQ-T7 | Which performance numbers are recorded as the CI baseline? | Spec v1.1 §17 confirms NFR-5 is CI-runner-evidenced | Recorded in §10 after the first green run; not a delivery blocker (A-T10) | @runner |
| OQ-T8 | Is the secondary CI signal required for refusal? | The spec says "when a CI environment is detected"; the variable set is implementation-owned | Pinned as primary plus secondary, both refusing (TC-PRIVACY-019) | @test-plan-writer |

**Spec gaps reported at plan v1.0 and their disposition in spec v1.1** (this plan edited no spec file):

| Reported gap | Disposition |
|---|---|
| AC-F8-1 "exactly one changeset" ambiguity against the five pre-existing unreleased changesets | **Resolved in spec v1.1.** AC-F8-1 now asserts exactly one new changeset added by this change, no pre-existing changeset modified or deleted, no manifest version hand-edited, and the lockfile unchanged; F-8, NFR-8, DEC-9, §16, and §18 are aligned. The plan asserts the corrected semantics through the `.changeset/` change diff (TC-RELEASE-001, TC-RELEASE-002). |
| F-1 placeholder suppression had no AC | **Resolved by spec v1.1 §17 coverage note** → AC-F1-2; evidence in TC-PRIVACY-003. |
| F-6 codec validation order had no AC | **Resolved by spec v1.1 §17 coverage note** → AC-F6-1/AC-F6-2; evidence in TC-POLICY-003. |
| F-4 binary-skip reporting had no AC | **Resolved by spec v1.1 §17 coverage note** → AC-F4-2; evidence in TC-PRIVACY-014 step 5. |
| NFR-5 performance/linearity had no AC | **Resolved by spec v1.1 §17 coverage note** → AC-F4-2's bounded/finite scan clause plus CI-runner evidence; local measurement in TC-PRIVACY-021, authoritative number in §10. |
| AC-F7-1 and NFR-5 depend on the CI runner | **Confirmed by spec v1.1 §17** ("CI-runner-evidenced: the pushed-HEAD job result is the evidence of record"). The plan asserts the structure locally and records the live job in §10. |
| AC-F4-4 "no network access occurs" is not directly observable | **Remains a testability note, not a spec gap.** Proven by the import graph plus throwing stubs; no packet-level claim is made. |

No spec, plan, pm-notes, or code file was modified by this author.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T05:24:12Z | Change Test Plan Writer | Initial plan: 34 TCs (TC-PRIVACY-001..021, TC-POLICY-001..008, TC-WIRE-001..003, TC-RELEASE-001..002). All 22 ACs mapped with no orphan TCs; seven generic rules with positives, near-misses, suppression, and a committed false-positive corpus; hashed `private-literal` and synthetic `cloud-term` activation with entry-removal and detection-disabled controls; a 30-cell fail-closed registry matrix (RV-01..RV-30) with caps at their exact boundaries; working-tree-only scope including history/untracked/ignored/binary/exclusion cases; content-free reporting with a non-vacuous no-echo proof and an identifier-only fingerprint; stdin-only, no-echo, no-write, CI-refusing authoring mode; a required injected pure content policy with all four payload fields × three carriers, validation order, failure shape, purity, shared-rule parity, and the human-content exclusion; binding `ts-invariants` wiring with the build-free local command and the suite-under-test-job proof; one five-package minor changeset with unchanged versions and lockfile. Spec gaps recorded (changeset-count wording, AC-less behaviours, environment-bound evidence); no spec or code edited. |
| 1.1 | 2026-10-31T05:32:45Z | Change Test Plan Writer | Aligned to change spec v1.1 (no TC added, removed, or renumbered; still 34 TCs, 22/22 ACs). AC-F8-1 and NFR-8 wording updated in §3.1/§3.3; TC-RELEASE-001 now asserts the change diff over `.changeset/` directly (exactly one added, zero modified, zero deleted, every pre-existing changeset byte-identical, plus modified/deleted pre-existing mutants); TC-RELEASE-002 asserts the lockfile base diff, version-line absence, and dependency key-set equality without any BLOCKED fallback (the base ref is a hard prerequisite, §6.4/§8.2 A-T6); §3.4 and TC-PRIVACY-003/014/021, TC-POLICY-003, and TC-WIRE-001 now cite the spec v1.1 §17 coverage note; resolved-gap rows replace the v1.0 open questions; §4.5 no longer mentions a fallback. Plan status set to Updated. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds, tests, or commands and implemented no code. The executor records per-TC evidence, exact commands, HEAD, and the pushed-HEAD CI result here; unrun evidence must never be recorded as passing. |
