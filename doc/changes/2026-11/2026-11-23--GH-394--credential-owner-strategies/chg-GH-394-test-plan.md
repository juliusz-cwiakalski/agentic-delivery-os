---
id: chg-GH-394-test-plan
status: Proposed
created: 2026-11-23
last_updated: 2026-11-23
owners: ["Juliusz Ćwiąkalski"]
service: credential port and one-shot CLI credential provisioning (strategy vocabulary, store-ownership resolution)
labels: [change, m4, credentials, security, cli, config]
version_impact: minor
summary: "Verification design for GH-394 credential owner strategies: hermetic, seam-injected proofs of the four-style vocabulary, closed allowlist, live redaction registry, classified failures with pinned remedies, memo/cap execution semantics, compatibility, and structure invariants — 20 of 20 ACs covered, real-store proof named manual/post-merge only."
links:
  change_spec: ./chg-GH-394-spec.md
  implementation_plan: ./chg-GH-394-plan.yaml  # pending — authored in phase 4 (delivery_planning); slot-length bounds and other named constants land there
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S28: Credential strategies — resolve from the credential's owner (gh CLI, harness store), never a copied env (M4)

## 1. Scope and Objectives

This plan verifies that a one-shot CLI command resolves a declared credential from its owner's store through the unchanged credential port: a closed four-style vocabulary (`literal`, `environment-prefixed`, `command`, `harness-store`), a closed execution allowlist with grammar-closed slots, a live redaction registry with register-on-materialize, a closed ten-member reason set with fixed `(reason, style)`-keyed remedies, a per-process memo and per-execution cap, and byte-identical behaviour for everything that already ships. The security-critical properties under proof are: the suite never touches a real owner CLI, store, or keyring (every proof runs over injected seams — child runner, environment record, harness identity, allowlist table); redaction sees material the instant it materializes, before any emit path; and no declared argv can widen beyond the shipped allowlist without a loud CI tripwire failure. The regressions motivating this plan are the construction-time redaction snapshot (which would render later-obtained material unredacted) and the generic "declared command" shape (an exfiltration primitive), both closed by this change and locked by the tests below.

### 1.1 In Scope

- The C-1 composition proof: real production composition + declared reference + injected child seam; the declared argv (not a hard-coded literal) reaches the seam; material registers for redaction; shipped default resolves exactly as today (AC-F1-1).
- Compatibility: existing `literal` / `environment-prefixed` declarations, every shipped provider-config fixture, and all shipped defaults validate and resolve byte-identically (AC-F1-2).
- Allowlist load-time enforcement, slot grammars, the `--` terminator, symlink-to-regular-executable resolution, and the CI tripwire over table / committed argv / effective argv (AC-F2-1, AC-F2-2, AC-F7-1).
- All `harness-store` semantics: target-selector export, exactly-one-active-or-refuse, no-stored-entry, key-only, shape drift, harness identity, OAuth exclusion (AC-F3-1 .. AC-F3-5).
- Failure classification: one case per reason across all ten members, `timeout` distinct from the reserved `resolution-pending`, no shipped caller observes the reserved token (AC-F4-1); remedy fixture pinning (byte-exact for the three owner-pinned texts), per-allowlist-entry selection, and field survival on every propagation site and rendered surface (AC-F4-2); never-empty material, cap-bounded blocking, unchanged park vocabulary and exit taxonomy (AC-F4-3).
- Live redaction registry proofs: register-after-compose canary on every diagnostic surface, malformed-output-never-rendered, stderr canary never rendered, the three edge-composed registration sites (AC-F5-1, AC-F5-2).
- Execution semantics: per-process memo and declared spawn-count profile (AC-F6-1), cap / closed stdin / bounded stdout / reduced recorded child environment (AC-F6-2), the lane-environment model-only checked proof (AC-F6-3).
- Structure invariants: no new error identity, park field, announcement code, result token, or exit; secret-read boundary intact (AC-F8-1, NFR-6, NFR-7); suite-level hermeticity guard (AC-F8-2, NFR-4).
- Gate battery: `pnpm check` (aggregate), the doc-distribution guard (this change touches `doc/decisions/00-index.md` and adds a decisions register row), and the new allowlist tripwire joining the `scripts/checks/` invariant battery.
- One named MANUAL/POST-MERGE real-store demonstration (never a CI gate).

### 1.2 Out of Scope & Known Gaps

- Any resident-daemon credential behaviour (NG-2): the shipped daemon resolves nothing; its verification posture is "resolves nothing", asserted, not extended. The resident composition is #395's scope.
- `harness-oauth` (never a style — OAuth-1), `store` style, `jaiship auth`, profiles, binding, configuration layers (NG-3); doctor requirement derivation (NG-4); allowlist entries beyond the two shipped pairs (NG-5).
- A real-store demonstration as a CI gate (OUT): TC-COMP-004 is manual/post-merge only.
- Latency measurement against real owner CLIs (NFR-3 threshold values 103–229 ms / 4.4–6.0 s): observed numbers are recorded by the manual demonstration, not measured in CI; CI pins the declared shapes and constants instead.
- Concrete numeric constants left to the implementation plan by the spec (slot length bounds per OQ-4; stdout-capture bound and session-bus variable set — see §8.3): boundary tests are expressed against the named constants so the values land without test redesign.

## 2. References

- Change specification: `./chg-GH-394-spec.md` (ACs AC-F1-1 .. AC-F8-2; Appendix A measured surfaces; Appendix B reason set and remedy texts; Appendix C owner-restated AC mapping; OQ-1..OQ-4).
- Implementation plan: `./chg-GH-394-plan.yaml` (pending, phase 4 — owner of the named constants: slot length bounds, stdout-capture bound, session-bus variable set, export supported-version window).
- Repository testing strategy: `.ai/rules/testing-strategy.md` (layers, module-to-test mapping, invariant-test authoring rules, quality gates).
- Governing decision record: ADR-0014 (credential strategies — store ownership behind an unchanged port), landing with this change as `Proposed`; index row in `doc/decisions/00-index.md` and register binding.
- Precedent records: ADR-0007 (credential port and parks), ADR-0008 (harness adapter contract), TDR-0012 (name-only diagnostics), TDR-0019 (dispatch admission preflight), TDR-0023 (daemon environment), TDR-0005 (CLI exit taxonomy), TDR-0025/0029/0030 (event taxonomy).
- TypeScript and workspace rules: `.ai/rules/typescript.md`; boundaries: `.dependency-cruiser.cjs`; aggregate gate: `pnpm check`.
- Existing invariant checks this plan extends or consumes: `scripts/checks/secret-read-boundary.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts`, `scripts/checks/ambient-globals.ts`, `scripts/checks/privacy-literals.ts`, `scripts/checks/memory-lint.ts`, `scripts/checks/prompt-conformance.ts`.

## 3. Coverage Overview

All 20 acceptance criteria are covered by at least one test case; none is TODO. Every test case traces to at least one AC.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-F1-1 | Declared `command` + `harness-store` resolve in the real composition through an injected seam; declared argv reaches the seam; material registered; shipped default unchanged; real-store demo manual/post-merge | TC-COMP-001, TC-COMP-002, TC-COMP-003, TC-COMP-004 (supporting: TC-REDACT-001) | Covered |
| AC-F1-2 | Existing `literal` / `environment-prefixed` configs and fixtures validate and resolve byte-identically; defaults unchanged; no migration | TC-COMPAT-001 (supporting: TC-COMP-003) | Covered |
| AC-F2-1 | Allowlist load-time enforcement: in-table accept with permitted parameters; out-of-table programs, interpreters, network clients, unpermitted parameters, slot-grammar violations refused; `--` terminator always present | TC-ALLOW-001, TC-ALLOW-002, TC-ALLOW-003, TC-ALLOW-004, TC-ALLOW-005 | Covered |
| AC-F2-2 | Symlink resolved and accepted when target is a regular executable; `program-unavailable` otherwise | TC-ALLOW-006 | Covered |
| AC-F3-1 | Zero or multiple `active` entries refuse `ambiguous-account`; never first/newest | TC-HARNESS-002 | Covered |
| AC-F3-2 | No stored entry refuses `empty-output`; no other source consulted | TC-HARNESS-003 | Covered |
| AC-F3-3 | Non-supported harness or declared-harness mismatch refuses `source-not-supported`; nothing borrowed | TC-HARNESS-006 | Covered |
| AC-F3-4 | OAuth entry refused `oauth-excluded`; no consume/refresh/write-back anywhere | TC-HARNESS-004 | Covered |
| AC-F3-5 | Shape drift classified `shape-drift` naming harness and field; `key` extracts; `oauth` refused | TC-HARNESS-005, TC-HARNESS-007 | Covered |
| AC-F4-1 | One case per reason — all ten; `timeout` distinct from reserved `resolution-pending`; no shipped caller observes the reserved token | TC-REASON-001, TC-REASON-002, TC-REASON-003 | Covered |
| AC-F4-2 | Fields survive every propagation site and render on every surface; suppression exemption only for credential refusals; remedy table `(reason, style)` keyed, selected per allowlist entry, three texts byte-exact pinned | TC-REMEDY-001, TC-REMEDY-002, TC-REMEDY-003 | Covered |
| AC-F4-3 | Never empty material; never blocks past the cap; delivered park condition kept with no park-record field; exit taxonomy `{0,1,2}`; no daemon unit involved | TC-REASON-001, TC-REASON-003, TC-EXEC-001, TC-STRUCT-001 | Covered |
| AC-F5-1 | Canary materialized AFTER composition is redacted on every diagnostic surface (human output, JSON envelope, `status`, `doctor`, park/log line, ledger record, capsule event); register-before-compose is not an acceptable proof | TC-REDACT-001 | Covered |
| AC-F5-2 | Malformed child output: registered before parsing and before any throw, throws classified, never rendered raw; fake child's stderr canary never rendered; three edge-composed sites covered (OQ-3) | TC-REDACT-002, TC-REDACT-003, TC-REDACT-004 | Covered |
| AC-F6-1 | Exactly one execution per reference per process; second resolve = memory read; profile: `merge` = 1, `status` = 0–2 and 0 under shipped defaults | TC-MEMO-001, TC-MEMO-002 | Covered |
| AC-F6-2 | Cap ends a hanging child as `timeout`; closed stdin; bounded stdout; stderr size/exit only; recorded child env exactly the reduced set, no secret-bearing variable | TC-EXEC-001, TC-EXEC-002 (supporting: TC-REDACT-003) | Covered |
| AC-F6-3 | Inventory-style checked proof: no credential entry in lane descriptors built from shipped settings; record key set exactly the model-name set; declared entry keeps spawn-time behaviour | TC-LANE-001 | Covered |
| AC-F7-1 | Tripwire fails on allowlist-table / committed-argv / effective-argv change without the allowlist module in the change; passes when none change; passes with no committed host coordinates | TC-TRIP-001 | Covered |
| AC-F8-1 | Structure inventory: no new error-table row, park field, park cause, announcement code, result token, or exit; failure variant grew only by the three optional projection fields | TC-STRUCT-001 | Covered |
| AC-F8-2 | Hermetic suite: no test invokes a real owner CLI, store, or keyring; every strategy exercised over injected seams; suite passes with no credential present | TC-HERM-001 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP surface exists in this change (spec §8.1: N/A); event vocabulary adds nothing new (spec §8.2 — verified, not extended). Data-model elements:

| Interface ID | Element | TC ID(s) |
|--------------|---------|----------|
| DM-1 | Credential source declaration (four closed styles, explicit keys, unknown style/field refuses by name) | TC-ALLOW-001, TC-ALLOW-003, TC-ALLOW-004, TC-COMPAT-001, TC-LANE-001 |
| DM-2 | Failure variant fields (`source`, `reason`, `remedy` as projection data) | TC-REMEDY-003, TC-STRUCT-001 |
| DM-3 | Closed reason union (ten members; `resolution-pending` reserved) | TC-REASON-001, TC-REASON-002, TC-REASON-003, TC-HARNESS-002, TC-HARNESS-003, TC-HARNESS-004, TC-HARNESS-005, TC-HARNESS-006, TC-ALLOW-006 |
| DM-4 | Allowlist table (two shipped entries, slot grammars, remedy selection, inert binding-supplied exception) | TC-ALLOW-001, TC-ALLOW-002, TC-ALLOW-003, TC-ALLOW-004, TC-ALLOW-005, TC-ALLOW-006, TC-TRIP-001 |
| DM-5 | Tracker credential declaration (default exactly `literal` / `GITHUB_TOKEN`; registration follows declared value) | TC-COMP-001, TC-COMP-003, TC-COMPAT-001 |
| DM-6 | Doctor presence variant (source identity for all four styles; variable name only for environment styles) | TC-REMEDY-003 |
| DM-7 | Live redaction registry (register/values consulted at render time; entrypoint-static for environment styles; three edge-composed sites join) | TC-REDACT-001, TC-REDACT-002, TC-REDACT-003, TC-REDACT-004 |
| EVT (§8.2) | Park vocabulary unchanged; reason in refusal/log line only | TC-STRUCT-001, TC-REMEDY-003 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Note |
|--------|-------------|----------|------|
| NFR-1 | Per-execution cap; capped run is `timeout`; 0 healthy executions capped at default | TC-EXEC-001 | Cap behaviour proven with a declared short per-execution timeout within the 30 s bound plus constant-pinning assertions; no 15 s wall-clock waits in the suite |
| NFR-2 | Per-process memo exactly 1 per reference; profile `merge` = 1, `status` = 0–2, `status` = 0 shipped | TC-MEMO-001, TC-MEMO-002 | |
| NFR-3 | Shipped-default declaration occupies the background-service path; standalone is opt-in | TC-ALLOW-001 (declared argv shape omits the standalone flag), TC-COMP-004 (manual timing observation) | CI pins declared shapes and constants; observed latencies recorded only by the manual demonstration |
| NFR-4 | Hermeticity: 0 real invocations; suite green with no credential | TC-HERM-001 | Guard is behaviour-based (intercepts real-CLI spawns), not environment-absence-based — CI runners may ship `gh` |
| NFR-5 | No credential material, substring, or value-derived digest on any rendered or persisted surface | TC-REDACT-001, TC-REDACT-002, TC-REDACT-003, TC-REDACT-004 | Sweep asserts absence of the canary AND of a value-derived digest |
| NFR-6 | Vocabulary/structure invariants; exit taxonomy `{0,1,2}` | TC-STRUCT-001 | Extends existing `error-table-sync` and `exit-code-literals` checks |
| NFR-7 | Secret-read boundary: exactly one credential-material directory; 0 new ambient reads | TC-STRUCT-002 | Extends `secret-read-boundary` check + ambient-globals guard + boundary fixtures |
| NFR-8 | Closed stdin; bounded stdout; stderr size/exit only; recorded env exactly the reduced set | TC-EXEC-002, TC-REDACT-003 | |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`; runner is `bun test` (`pnpm test`), suite guard convention `TMPDIR=$PWD/tmp/tmpdir` for any evidence that writes.

- **Unit / behaviour tests** — `tests/behaviour/*.test.ts`, `bun:test`. Strategy behaviour over injected seams (child runner, environment record, harness identity, allowlist table). Existing credential suites to extend live here (`credential-port.test.ts`, `provider-credentials.test.ts`, `harness-spawn-credential.test.ts`, `status-credential-prerequisite.test.ts`).
- **Composition / integration tests** — same runner and layer; the "real production composition + injected seam" proofs (C-1 shape) build the production composition with seams substituted and run one-shot commands against temporary workspaces.
- **Structure invariants** — `tests/structure/*.test.ts` and `scripts/checks/*.ts` with their mutation suites in `tests/checks/*.test.ts`. The new allowlist tripwire lands under `scripts/checks/` (exact filename fixed in the implementation plan per the owner's file list) and joins the invariant battery (`pnpm check`).
- **Boundary tests** — `tests/boundaries/` against the production `.dependency-cruiser.cjs` and the ambient-globals AST guard; secret-read boundary extension adds negative fixtures (the fixture-coverage meta-check enforces every rule keeps a failing fixture).
- **Conformance** — the testkit credential double (`packages/testkit/src/conformance/**`) gains the four-style union representation; covered by `tests/structure/conformance-coverage.test.ts` and `bun test tests/conformance`.
- **Goldens / fixtures** — `tests/fixtures/**` and `tests/golden/**` for byte-identical resolution and pinned remedy/shape data. Fixture doubles always carry obviously-fake sentinel values (never real-shaped credentials) so the `privacy-literals` invariant stays green.
- **Static / content checks** — `git diff --check`; decision-record registration content check (ADR-0014 index row + register row present, status `Proposed`, decision date unset); `bash scripts/.tests/test-doc-distribution.sh` (this change touches `doc/decisions/00-index.md`, a standalone doc in the marker-required set, and adds a decisions register row).
- **Manual (post-merge)** — the named real-store demonstration (TC-COMP-004) on an authenticated host; evidence recorded in pm-notes; never a CI gate.
- **Aggregate gate** — `pnpm check` (lint → format:check → typecheck → test → check:boundaries; includes the secret-read boundary, privacy-literals, memory-lint, and prompt-conformance invariants). Evidence convention: `TMPDIR=$PWD/tmp/tmpdir`; commands `bun test` / `pnpm test` / `pnpm check`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-COMP-001 | Tracker `command` declaration resolves through the real production composition | Integration | Composition | Critical | AC-F1-1 |
| TC-COMP-002 | Provider `harness-store` declaration resolves through the real production composition | Integration | Composition | Critical | AC-F1-1, AC-F3-2 |
| TC-COMP-003 | Shipped default tracker reference resolves exactly as today | Regression | Composition | Critical | AC-F1-1, AC-F1-2 |
| TC-COMP-004 | Real-store end-to-end demonstration (manual, post-merge) | Happy Path | E2E | Important | AC-F1-1, NFR-3 |
| TC-REDACT-001 | Register-after-compose canary redacted on every diagnostic surface | Negative | Composition | Critical | AC-F5-1, NFR-5, AC-F1-1 |
| TC-REDACT-002 | Malformed child output: registered before parse and before throw; never rendered raw | Negative | Unit | Critical | AC-F5-2, NFR-5 |
| TC-REDACT-003 | Child stderr canary never rendered; stderr captured for size/exit only | Negative | Unit | Critical | AC-F5-2, AC-F6-2, NFR-5, NFR-8 |
| TC-REDACT-004 | Three edge-composed registration sites join the live registry (OQ-3) | Regression | Integration | Critical | AC-F5-2, F-5 |
| TC-REASON-001 | One case per reason: all ten members classify correctly | Happy Path | Unit | Critical | AC-F4-1, AC-F4-3, DM-3 |
| TC-REASON-002 | `timeout` distinct from the reserved `resolution-pending` | Corner Case | Unit | Critical | AC-F4-1, DM-3 |
| TC-REASON-003 | No shipped caller observes `resolution-pending` | Negative | Integration | Critical | AC-F4-1, AC-F4-3 |
| TC-REMEDY-001 | Owner-pinned remedy texts fixture-pinned byte-exact | Regression | Unit | Critical | AC-F4-2 |
| TC-REMEDY-002 | Host-aware vs neutral remedy selection per allowlist entry; never interpolated | Edge Case | Unit | Critical | AC-F4-2 |
| TC-REMEDY-003 | Failure fields survive every propagation site and render on every surface | Integration | Composition | Critical | AC-F4-2, AC-F4-3, DM-2, DM-6 |
| TC-ALLOW-001 | In-table declarations accepted with exactly their permitted parameters | Happy Path | Unit | Critical | AC-F2-1, NFR-3, DM-4 |
| TC-ALLOW-002 | Out-of-table programs, interpreters, and network clients refused | Negative | Unit | Critical | AC-F2-1, DM-4 |
| TC-ALLOW-003 | Unpermitted parameters and unknown declaration fields refused by name | Negative | Unit | High | AC-F2-1, DM-1, DM-4 |
| TC-ALLOW-004 | Slot grammars: charset, no leading dash, bounded length via named constants | Edge Case | Unit | Critical | AC-F2-1, DM-4 |
| TC-ALLOW-005 | Constructed argv always carries the `--` terminator before the positional | Happy Path | Unit | Critical | AC-F2-1, DM-4 |
| TC-ALLOW-006 | Symlink accepted on regular executable target; `program-unavailable` otherwise | Edge Case | Unit | Critical | AC-F2-2, DM-3, DM-4 |
| TC-HARNESS-001 | Target-selector export: declared integration only; raw export never retained | Happy Path | Unit | Critical | F-3, AC-F3-1, AC-F3-5 |
| TC-HARNESS-002 | Exactly one `active` entry or refuse `ambiguous-account` | Edge Case | Unit | Critical | AC-F3-1 |
| TC-HARNESS-003 | No stored entry: `empty-output`, zero consultation of any other source | Negative | Unit | Critical | AC-F3-2 |
| TC-HARNESS-004 | OAuth entry refused `oauth-excluded`; no consume/refresh/write-back anywhere | Negative | Unit | Critical | AC-F3-4, NG-1 |
| TC-HARNESS-005 | Shape drift classified `shape-drift` naming harness and field | Edge Case | Unit | Critical | AC-F3-5 |
| TC-HARNESS-006 | Harness identity match or refuse `source-not-supported`; nothing borrowed | Negative | Unit | Critical | AC-F3-3 |
| TC-HARNESS-007 | Export shape and supported version window pinned via fixture doubles | Regression | Contract | High | AC-F3-5, RSK-2 |
| TC-MEMO-001 | Per-process memo: exactly one execution per reference; further resolves are memory reads | Happy Path | Unit | Critical | AC-F6-1, NFR-2 |
| TC-MEMO-002 | Declared spawn-count profile: `merge` = 1, `status` = 0–2, `status` = 0 shipped | Happy Path | Integration | High | AC-F6-1, NFR-2 |
| TC-EXEC-001 | Cap ends a hanging child as classified `timeout`; healthy runs never capped | Edge Case | Unit | Critical | AC-F6-2, AC-F4-3, NFR-1 |
| TC-EXEC-002 | Child execution posture: closed stdin, bounded stdout, reduced recorded environment | Edge Case | Unit | Critical | AC-F6-2, NFR-8 |
| TC-COMPAT-001 | Existing configurations and fixtures validate and resolve byte-identically | Regression | Unit | Critical | AC-F1-2, DM-1, DM-5 |
| TC-STRUCT-001 | Vocabulary and structure invariants: no new failure identity | Regression | Structure | Critical | AC-F8-1, AC-F4-3, NFR-6 |
| TC-STRUCT-002 | Secret-read boundary intact; no new ambient environment read | Regression | Boundary | Critical | NFR-7 |
| TC-LANE-001 | Lane environment stays model-only: inventory-style checked proof | Regression | Structure | High | AC-F6-3 |
| TC-TRIP-001 | Allowlist tripwire: fails on drift without the module, passes clean, passes without host coordinates | Negative | CI check | Critical | AC-F7-1, DM-4 |
| TC-HERM-001 | Suite-level hermeticity guard: no real owner CLI, no credential | Regression | Suite guard | Critical | AC-F8-2, NFR-4 |

### 5.2 Scenario Details

#### TC-COMP-001 - Tracker `command` declaration resolves through the real production composition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-6, AC-F1-1, DM-5, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-composition-proof.test.ts`; production composition builder in `packages/cli` (one-shot command composition), credential adapter `packages/adapters/src/credentials/`
**Tags**: @backend, @security

**Preconditions**:

- Injected child-runner seam is the only spawn path; the real `gh` binary is never invoked (enforced by the TC-HERM-001 guard).
- Temporary workspace with a configuration declaring the tracker credential reference as `command` (tracker CLI token read, host-slot form).

**Steps**:

1. Build the real production composition (not a test double of the composition) with the child runner substituted by a recording seam; the recording seam captures every argv it is asked to execute.
2. Run a one-shot command (`dispatch`) whose tracker consumer needs the token.
3. Assert the seam received the declared argv — the host-scoped token-read form derived from the declaration — compared against the declared reference, never against a hard-coded literal.
4. Assert the resolved material reached the tracker consumer exactly once and was registered into the live redaction registry at materialization (a recording registry observes registration before any render consult).
5. Scan the temporary workspace and process-written paths: no product-written credential file and no operator-copied credential exists anywhere on the path.

**Expected Outcome**:

- The declared argv (not the legacy `GITHUB_TOKEN` literal) reaches the seam; material flows to the consumer; registration precedes any emit consult; no credential file is written.

**Notes / Clarifications**:

- This is the C-1 proof of AC-F1-1 in its CI-provable shape: the composition is real, the credential is not.

#### TC-COMP-002 - Provider `harness-store` declaration resolves through the real production composition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, F-6, AC-F1-1, AC-F3-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-composition-proof.test.ts`; provider/quota composition paths in `packages/cli` and `packages/adapters`
**Tags**: @backend, @security

**Preconditions**:

- Injected export seam returns a pinned-shape fixture array for the declared integration only.

**Steps**:

1. Build the real production composition with the injected export seam; declare a provider credential as `harness-store` (active harness identity, one integration id).
2. Run a one-shot command whose provider path consumes the credential (availability decision / quota read).
3. Assert the export seam was invoked exactly once with the declared integration id as the target-selector positional (behind the `--` terminator), so only that integration's entries were requested.
4. Assert the resolved key reached the provider consumer and was registered into the live registry at materialization.

**Expected Outcome**:

- The declared integration id selects the export; the key resolves into the consumer; registration precedes any render; no second source was consulted.

#### TC-COMP-003 - Shipped default tracker reference resolves exactly as today

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-8, AC-F1-1, AC-F1-2, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-composition-proof.test.ts`
**Tags**: @backend, @regression

**Preconditions**:

- No operator configuration; shipped defaults only.

**Steps**:

1. Build the real production composition with the injected child seam and an environment record carrying the token variable.
2. Run a one-shot command with the shipped default tracker reference (`literal` / `GITHUB_TOKEN`).
3. Assert the material resolves from the environment record byte-identically to the delivered behaviour; the entrypoint-static registration path is used; the recording seam observes zero child spawns.

**Expected Outcome**:

- Default install behaviour is unchanged: environment-sourced material, static registration, zero executions.

#### TC-COMP-004 - Real-store end-to-end demonstration (manual, post-merge)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, F-2, F-3, AC-F1-1, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Authenticated operator host; evidence recorded in `chg-GH-394-pm-notes.yaml`
**Tags**: @manual, @security, @e2e

**Preconditions**:

- Post-merge; host authenticated with the tracker CLI; harness signed in; OS keyring available.

**Steps**:

1. Declare the tracker reference as `command` (host form) and a provider credential as `harness-store` in a real configuration.
2. Run a one-shot command end to end; confirm resolution succeeds with no product-written credential file.
3. Record observed timings (tracker token read; harness export on the default background-service path) against the measured windows in spec Appendix A and NFR-3.
4. Where the host allows, record the typed classified outcomes of the OQ-1 and OQ-2 delivery-time confirmations (service-less/sessionless and locked-keyring shapes) without storing any material.

**Expected Outcome**:

- One recorded demonstration proving the end-to-end promise on real owner stores; timings and typed confirmations recorded; explicitly never a CI gate.

#### TC-REDACT-001 - Register-after-compose canary redacted on every diagnostic surface

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-5, AC-F5-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-redaction-live-registry.test.ts`; render/emit paths for human output, JSON envelope, `status`, `doctor`, park/log line, ledger record, capsule event
**Tags**: @backend, @security, @regression

**Preconditions**:

- Child double whose canary emission is armed only AFTER the composition has completed construction (an activation flag the test flips post-composition); temporary workspace so ledger records and capsule events are inspectable.

**Steps**:

1. Build the real composition with injected seams; complete composition construction.
2. Arm the child double to emit a fresh sentinel canary as its material; run a credential-consuming command that fails downstream (so diagnostics render).
3. Sweep every diagnostic surface for the canary and for a value-derived digest of it: human output, JSON envelope, `status` output, `doctor` output, the park/log line, the ledger record, and the capsule event file.
4. Run the sensitivity control: a sibling case using the pre-change snapshot semantics (registration before composition) and assert the sweep DOES catch the canary there — proving the sweep has teeth.

**Expected Outcome**:

- Zero canary observations and zero digest observations across all seven surfaces in the proof case; the control case proves the sweep detects an unregistered canary.

**Notes / Clarifications**:

- Oracle shape mandated by the owner: the canary is materialized after composition; a test that registers before composing is explicitly NOT an acceptable proof of AC-F5-1 — it appears only as the sensitivity control.

#### TC-REDACT-002 - Malformed child output: registered before parse and before throw; never rendered raw

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-5, AC-F5-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-redaction-live-registry.test.ts`; resolver in `packages/adapters/src/credentials/`
**Tags**: @backend, @security

**Preconditions**:

- Child doubles emitting each malformed shape: unparseable JSON (export form), interior newline (token form), oversize/truncated output; a recording registry seam that orders registration against parse/throw.

**Steps**:

1. For each malformed shape, resolve through the resolver; the recording registry captures whether registration happened before parsing began and before the throw.
2. Assert the resolver threw the classified failure (`shape-drift` / `empty-output` per case), never returned partial material.
3. Sweep every rendered surface of the surrounding command for the raw child output bytes.

**Expected Outcome**:

- Registration strictly precedes parsing and the throw in every case; the throw is classified; the raw output appears on no rendered surface.

#### TC-REDACT-003 - Child stderr canary never rendered; stderr captured for size/exit only

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, NFR-5, NFR-8, AC-F5-2, AC-F6-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-redaction-live-registry.test.ts`; child runner seam contract
**Tags**: @backend, @security

**Preconditions**:

- Fake child double that writes a sentinel canary to stderr and exits non-zero.

**Steps**:

1. Resolve a `command` reference against the double.
2. Assert the recorded failure is classified (`non-zero-exit`) and that the captured stderr record carries size and exit status only (no bytes exposed on the failure variant).
3. Sweep every rendered/persisted surface of the command run for the stderr canary.

**Expected Outcome**:

- The stderr canary appears on zero surfaces; the failure carries `non-zero-exit` with source and remedy; stderr content is never treated as material.

#### TC-REDACT-004 - Three edge-composed registration sites join the live registry (OQ-3)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, OQ-3, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-redaction-live-registry.test.ts`; `registerEdgeSecrets` in `packages/cli/src/edge.ts` and its two call sites (per the owner's file list)
**Tags**: @backend, @security, @regression

**Preconditions**:

- Each of the three sites (the `registerEdgeSecrets` helper and its two call sites) exercised through its edge-composed command path in a temporary workspace.

**Steps**:

1. For each site in turn, drive its command path with an injected secret value registered through `registerEdgeSecrets`.
2. Assert the value is visible to the live registry consulted at render time and is redacted on that path's rendered output.
3. Apply the malformed-child-output-never-rendered treatment of TC-REDACT-002 at each command-composed site, per the OQ-3 confirmation.

**Expected Outcome**:

- All three sites register into the same live registry; redaction holds at each; the OQ-3 delivery-time confirmation is answered by these passing cases.

#### TC-REASON-001 - One case per reason: all ten members classify correctly

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-3, DM-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-reasons.test.ts`; resolver classification in `packages/adapters/src/credentials/`
**Tags**: @backend

**Preconditions**:

- Injected seams; one parameterized case per reason.

**Steps**:

1. Exercise one trigger per reason and assert the classified token:
   - `program-unavailable` — allowlisted declaration whose program path chain does not resolve to a regular executable (TC-ALLOW-006 cross-cover).
   - `timeout` — hanging child under a declared short per-execution timeout (TC-EXEC-001 cross-cover).
   - `non-zero-exit` — child exits non-zero with no usable stdout.
   - `empty-output` — child exits 0 with empty/whitespace-only stdout after stripping (token form); harness-store no-stored-entry is cross-covered in TC-HARNESS-003.
   - `shape-drift` — export output departing from the pinned shape.
   - `ambiguous-account` — zero and multiple `active` entries (TC-HARNESS-002 cross-cover).
   - `oauth-excluded` — `value.type: "oauth"` entry (TC-HARNESS-004 cross-cover).
   - `source-not-supported` — unsupported harness and identity mismatch (TC-HARNESS-006 cross-cover).
   - `variable-absent` — `literal` declaration with the variable unset (environment-style classification preserved).
   - `resolution-pending` — asserted as a declared union member reachable only through the reserved path (see TC-REASON-002/003; never produced by the one-shot resolver).
2. For every observable case, assert the thrown failure carries the single delivered code, `source` identity, the reason token, and a non-empty bounded remedy, and that the resolver NEVER returns empty material — every failure is a classified throw.

**Expected Outcome**:

- All ten reasons have a case; nine are observable outcomes; classification is exact per trigger; no failure path yields empty material.

#### TC-REASON-002 - `timeout` distinct from the reserved `resolution-pending`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-reasons.test.ts`
**Tags**: @backend

**Preconditions**:

- Hanging child double; classification surface under test.

**Steps**:

1. Trigger the cap on a hanging child and assert the reason is exactly `timeout`.
2. Assert the reserved token `resolution-pending` is never produced by the one-shot resolver for any input class exercised in TC-REASON-001's matrix plus adversarial combinations (capped + malformed, non-zero + stderr noise, ambiguous + oauth present).
3. Assert the two tokens are distinct union members and only `timeout` is reachable from the cap path.

**Expected Outcome**:

- `timeout` is the classified outcome of a capped run; `resolution-pending` is unreachable from one-shot resolution.

#### TC-REASON-003 - No shipped caller observes `resolution-pending`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F4-1, AC-F4-3, NG-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-reasons.test.ts`; shipped compositions in `packages/cli` (daemon composition inventory)
**Tags**: @backend, @regression

**Preconditions**:

- Shipped composition builders only; no resident composition exists in this change.

**Steps**:

1. Assert the shipped daemon composition has no credential consumer: it passes no lane and no executor, reads no tracker, resolves nothing (composition inventory assertions).
2. Assert every one-shot composition resolves before returning: the memo makes first materialization synchronous on the request path (spawn counts observed before command return — TC-MEMO-001/002 provide the behavioural evidence).
3. Sweep all rendered surfaces and persisted records produced across the behaviour suites for the token `resolution-pending`: it must appear nowhere in shipped output.

**Expected Outcome**:

- Zero shipped callers can observe the reserved reason; it exists only as a declared union member for #395.

#### TC-REMEDY-001 - Owner-pinned remedy texts fixture-pinned byte-exact

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, Appendix B
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-remedies.test.ts`; fixture-pinned remedy data in `tests/fixtures/`
**Tags**: @backend, @regression

**Preconditions**:

- Fixture files carry the three owner-pinned texts verbatim from spec Appendix B.

**Steps**:

1. Assert the `command` / `program-unavailable` remedy equals, byte-exact: "declare the program path as installed".
2. Assert the `command` / `non-zero-exit` host-aware remedy equals, byte-exact, the Appendix B host-aware text (including the parenthetical with the host-scoped login form and the `<host>` slot placeholder), and names no concrete host.
3. Assert the `command` / `non-zero-exit` neutral remedy equals, byte-exact, the Appendix B neutral text.

**Expected Outcome**:

- All three texts match the fixtures byte-exact; any future edit to these strings fails this suite and forces a deliberate, reviewed fixture update (per §22 shipped-data rule).

#### TC-REMEDY-002 - Host-aware vs neutral remedy selection per allowlist entry; never interpolated

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DEC-7, AC-F4-2, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-remedies.test.ts`; allowlist table and remedy table in `packages/adapters/src/credentials/`
**Tags**: @backend

**Preconditions**:

- Shipped allowlist table: tracker CLI entry (has a host slot) and harness CLI entry (no host slot).

**Steps**:

1. For every allowlist entry, assert BOTH applicable selections are pinned: the entry's `(reason, style)` remedy mapping resolves the host-aware `command`/`non-zero-exit` text for the tracker entry and the neutral text for the harness entry.
2. Assert every table cell is a fixed shipped string — resolve a failure with a hostile configuration value (program path containing remedy-like text, odd host strings) and assert the rendered remedy never contains any configuration-derived text or child output.
3. Assert the remaining table cells satisfy the content contract: bounded text naming the one operator act that helps — the `harness-store`/`timeout` remedy names the standalone flag; the `literal`/`variable-absent` remedy names the variable declaration path.

**Expected Outcome**:

- Selection is per-allowlist-entry and correct in both directions; remedies are never interpolated from configuration text or child output.

#### TC-REMEDY-003 - Failure fields survive every propagation site and render on every surface

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-3, DM-2, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-remedies.test.ts`; the 37 enumerated consumer sites and rendering surfaces (human output, JSON envelope, `status`, `doctor`, park/log line, MCP serve state placeholders)
**Tags**: @backend, @security

**Preconditions**:

- Injected seams forcing a classified failure at each source style; temporary workspaces for surface capture.

**Steps**:

1. Force one classified failure per style (`command`, `harness-store`, `literal`, `environment-prefixed`) and propagate it through the composition.
2. Assert `source`, `reason`, and `remedy` survive on every surface: human output, JSON envelope, `status`, `doctor` display (source identity shown for all four styles; the variable name only for the two environment styles), the park/log line, and the MCP serve state placeholders (which carry the reason so the renderer never guesses) — including the sites that today reconstruct the failure.
3. Assert the config-summary suppression exemption applies to credential refusals only: a credential-shaped refusal renders its fields while every other config-shaped summary stays suppressed.
4. Assert the doctor presence variant (DM-6) carries the three optional fields when a failure is present and the delivered display otherwise.

**Expected Outcome**:

- No propagation site drops a field; no rendered surface omits source/reason/remedy for credential refusals; suppression behaviour is otherwise unchanged.

#### TC-ALLOW-001 - In-table declarations accepted with exactly their permitted parameters

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-7, AC-F2-1, NFR-3, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`; configuration load validation in `packages/adapters/src/credentials/` and the config catalog
**Tags**: @backend

**Preconditions**:

- Shipped allowlist table; valid declarations for both entries.

**Steps**:

1. Accept the tracker token-read declaration with the optional host parameter and with the host omitted; accept the harness export declaration with and without the optional standalone flag, with the declared integration id positional.
2. Assert the shipped default declaration shape for the harness export omits the standalone flag (background-service path, NFR-3) and that opting in is a per-declaration, deterministic argv change.
3. Assert each accepted declaration's permitted-parameter set is exact — nothing beyond the pinned prefix and permitted slots is tolerated.

**Expected Outcome**:

- Every in-table shape validates at configuration load with exactly its permitted parameters; the shipped default argv shape is pinned.

#### TC-ALLOW-002 - Out-of-table programs, interpreters, and network clients refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-7, RSK-1, AC-F2-1, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`
**Tags**: @backend, @security

**Preconditions**:

- Declarations naming absolute paths of programs outside the table.

**Steps**:

1. Attempt declarations naming out-of-table programs (arbitrary absolute paths) and assert refusal naming the program.
2. Attempt interpreter paths (shell, scripting-language runtimes) and general network clients; assert each is refused by name — absent from the table by construction, so no configuration can express them.
3. Assert every refusal is a load-time validation failure with a named reason (never a runtime surprise).

**Expected Outcome**:

- Zero out-of-table programs, interpreters, or network clients are accepted.

#### TC-ALLOW-003 - Unpermitted parameters and unknown declaration fields refused by name

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-7, AC-F2-1, DM-1, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`
**Tags**: @backend, @security

**Steps**:

1. Attempt a `command` declaration with a subcommand prefix mismatch, an extra flag, and a flag in a slot position; assert each refusal names the offending parameter.
2. Attempt an unknown style name and an unknown field on each known style; assert refusal naming the field (F-1: nothing is discovered, nothing undeclared is tolerated).
3. Assert the inert binding-supplied slot exception (C-10) accepts no binding input in this change: no committed host coordinate can flow into a slot (NG-8 posture pinned).

**Expected Outcome**:

- Every unpermitted parameter and unknown field is refused at load, by name.

#### TC-ALLOW-004 - Slot grammars: charset, no leading dash, bounded length via named constants

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-7, OQ-4, AC-F2-1, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`
**Tags**: @backend, @security

**Preconditions**:

- Slot bounds exist as named constants fixed by the implementation plan (spec OQ-4 delegated the values; this suite expresses boundaries against the constants).

**Steps**:

1. Host slot: accept in-charset values (`[A-Za-z0-9.-]+`); refuse a leading `-`, each out-of-charset character class, and a value one over the bound; accept the bound-length value.
2. IntegrationID slot: accept in-grammar values (`[a-z0-9][a-z0-9_-]*`); refuse a leading `-` (flag smuggling into a program documenting a global server flag), an uppercase character, an out-of-charset character, and a value one over the bound; accept the bound-length value.
3. Assert refusals happen at configuration load, naming the slot.

**Expected Outcome**:

- Grammar properties hold exactly as specified; length boundaries track the plan's named constants in both directions.

#### TC-ALLOW-005 - Constructed argv always carries the `--` terminator before the positional

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`
**Tags**: @backend, @security

**Steps**:

1. Construct argv for every accepted declaration shape (tracker with/without host; harness export with/without standalone flag).
2. Assert the argv array always places the `--` terminator immediately before the positional argument, in every shape, and that no shape can omit it.

**Expected Outcome**:

- The terminator is structural, not optional: every constructed argv carries it.

#### TC-ALLOW-006 - Symlink accepted on regular executable target; `program-unavailable` otherwise

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DEC-6, AC-F2-2, DM-3, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts` (temporary-directory program fixtures)
**Tags**: @backend, @security

**Preconditions**:

- Temporary directory with controlled file shapes (regular executable, regular non-executable, directory, unresolvable symlink chain); the real product binary is not involved.

**Steps**:

1. Accept a declaration whose program path is a symlink chain resolving to a regular executable file (the version-manager install shape) and record the resolved target used.
2. Refuse `program-unavailable` — with the pinned remedy "declare the program path as installed" — when the chain is unresolvable, when the resolved target is not a regular file (directory, fifo), and when it is regular but not executable.
3. Assert validation resolves every symlink on the path (deep chains), not just the final link.

**Expected Outcome**:

- Exactly the DEC-6 rule: symlink accepted iff the fully-resolved target is a regular executable; otherwise `program-unavailable`.

#### TC-HARNESS-001 - Target-selector export: declared integration only; raw export never retained

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DEC-8, AC-F3-1, AC-F3-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`; harness-store strategy in `packages/adapters/src/credentials/`
**Tags**: @backend, @security

**Preconditions**:

- Export seam double returning pinned-shape entries for the requested integration only.

**Steps**:

1. Assert exactly one export execution per resolution and that its positional argument is the declared integration id behind the `--` terminator (target selector is the primary control, DEC-8).
2. Assert in-process single-entry selection remains as defense in depth: a multi-entry response for the declared integration is filtered, never widened.
3. Assert the raw export is never logged, stored, re-emitted, or retained: sweep every surface and in-process state reachable after resolution; only the extracted key survives.

**Expected Outcome**:

- Only the declared integration is requested; the raw payload leaves no trace.

#### TC-HARNESS-002 - Exactly one `active` entry or refuse `ambiguous-account`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DEC-9, AC-F3-1, DM-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`
**Tags**: @backend

**Steps**:

1. Zero `active` entries (all inactive) → refuse `ambiguous-account`.
2. Two `active` entries (the observed multi-account integration shape) → refuse `ambiguous-account`.
3. Assert the refusal never picks "the first" or "the newest": no ordering heuristic exists; `source` and remedy render with the refusal (AC-F3-1 wording).

**Expected Outcome**:

- Exactly one `active` entry is the only accept condition; ambiguity refuses by name.

#### TC-HARNESS-003 - No stored entry: `empty-output`, zero consultation of any other source

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-8, DEC-9, AC-F3-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`
**Tags**: @backend

**Preconditions**:

- Export seam returning an empty array for the declared integration; an environment record planted with a sentinel variable of the same name a fall-through would consult.

**Steps**:

1. Resolve the reference; assert refusal `empty-output` (the material is not in the store at all).
2. Assert no other source was consulted: the environment sentinel is untouched, no second resolve occurred, no strategy fallback executed (no chain, no discovery, no fallback — G-3).

**Expected Outcome**:

- `empty-output` with zero fall-through.

#### TC-HARNESS-004 - OAuth entry refused `oauth-excluded`; no consume/refresh/write-back anywhere

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DEC-3, NG-1, AC-F3-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`
**Tags**: @backend, @security

**Preconditions**:

- Export seam returning one `active` entry with `value.type: "oauth"` (carrying methodID/access/refresh per the pinned shape); a write-path-failing double that FAILS the test if any write path of the store is reached.

**Steps**:

1. Resolve; assert refusal `oauth-excluded` with source and remedy.
2. Assert the write-path double was never hit (read-only posture against the store).
3. Assert by structural inventory that no code path in the change consumes, refreshes, or writes back an access or refresh grant: no such field is read by any parser, no refresh routine exists in the strategy surface.

**Expected Outcome**:

- OAuth custody is refused outright; the product never touches an owner's storage (OAuth-1).

#### TC-HARNESS-005 - Shape drift classified `shape-drift` naming harness and field

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, DM-3, RSK-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`
**Tags**: @backend

**Steps**:

1. One case per departure: non-array root (object), entry missing a required field (`id`, `integrationID`, `label`, `active`, `value`), entry with an unexpected `value.type` (neither `key` nor `oauth`), and unparseable output; assert each refuses `shape-drift` with the harness identity and the offending field named.
2. Control cases: `value.type: "key"` with `value.key` extracts the key; `value.type: "oauth"` refuses per TC-HARNESS-004.
3. Assert drift never yields material and never falls through to another source.

**Expected Outcome**:

- Every shape departure is classified by name; only the pinned shape yields material.

#### TC-HARNESS-006 - Harness identity match or refuse `source-not-supported`; nothing borrowed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, ADR-0008, AC-F3-3, DM-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`; harness identity as a construction input
**Tags**: @backend

**Steps**:

1. Declared harness equals the active harness identity → resolution proceeds normally (control).
2. A non-supported harness name declared (e.g. a competitor harness) → refuse `source-not-supported`; assert no store was read and no other source consulted.
3. Declared harness field disagrees with the active identity → refuse by reason without reading the declared harness's store and without borrowing any other store's layout or surface (identity is a construction fact; the active identity wins).

**Expected Outcome**:

- Identity match is required; every mismatch or unsupported declaration refuses `source-not-supported` cold.

#### TC-HARNESS-007 - Export shape and supported version window pinned via fixture doubles

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, RSK-2, §22, AC-F3-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-harness-store.test.ts`; pinned-shape fixtures in `tests/fixtures/`
**Tags**: @backend, @contract

**Preconditions**:

- Fixture doubles carry the observed export shape: a JSON root array of entries with `id`, `integrationID`, `label`, `active`, `value`, where `value.type` is `key` (with `value.key`) or `oauth`.

**Steps**:

1. Pin the observed shape as committed fixture doubles consumed by the parser suite — never live calls.
2. Pin the supported version window as a declared suite constant; concrete version values are fixed during delivery from the measured hosts (spec §8.4 pins the requirement, the plan/delivery records the numbers).
3. Assert the parser accepts exactly the pinned shape and the TC-HARNESS-005 drift cases remain the refusal path for departures — another product's release that drifts the shape is a red test and a classified refusal until re-pinned.

**Expected Outcome**:

- Shape and version window are pinned data in the suite; drift is loud and classified.

#### TC-MEMO-001 - Per-process memo: exactly one execution per reference; further resolves are memory reads

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, NFR-2, AC-F6-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`; counting child-runner seam
**Tags**: @backend

**Steps**:

1. Resolve one reference twice within one process; assert exactly one child execution occurred and the second resolve was served from the memo (zero additional spawns).
2. Resolve a second distinct reference; assert it produced its own single execution.
3. Continue exercising the process; assert zero further spawns for the remainder of its lifetime.

**Expected Outcome**:

- Exactly one execution per reference per process; the count is independent of how many operations consume the reference.

#### TC-MEMO-002 - Declared spawn-count profile: `merge` = 1, `status` = 0–2, `status` = 0 shipped

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6, NFR-2, AC-F6-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts` (extends `status-credential-prerequisite.test.ts` posture); one-shot compositions in `packages/cli`
**Tags**: @backend

**Steps**:

1. With non-default declarations active, run `merge` and assert exactly one execution (one reference).
2. Run `status` and assert 0–2 executions by composition (tracker plus the one provider credential shipped defaults declare), never more.
3. Run `status` under shipped defaults and assert zero executions (environment-backed references spawn nothing).
4. Assert the memo makes the count independent of the number of operations the command performs.

**Expected Outcome**:

- The declared spawn-count profile holds exactly.

#### TC-EXEC-001 - Cap ends a hanging child as classified `timeout`; healthy runs never capped

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, NFR-1, AC-F6-2, AC-F4-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`
**Tags**: @backend, @perf

**Preconditions**:

- Hanging child double; declared per-execution timeout values (DM-1 permits a per-declaration timeout within the bound, enabling fast tests without touching shipped defaults).

**Steps**:

1. Run a hanging child under a declared short per-execution timeout within the 30 s hard bound; assert the cap ended it, the caller was never blocked past the cap, and the classification is `timeout` (distinct from `resolution-pending` — TC-REASON-002).
2. Assert the shipped constants: default cap 15 s, hard bound 30 s, as declared pinned constants (no 15 s wall-clock waits in the suite).
3. Healthy-run control: a double delayed well inside the cap (including a delay representative of the measured standalone budget) completes and is never capped — asserting the NFR-1 threshold property that zero healthy executions end at the default cap.
4. Assert a capped run never yields partial material and never falls back.

**Expected Outcome**:

- Every execution is bounded; capped runs classify `timeout`; healthy runs complete.

#### TC-EXEC-002 - Child execution posture: closed stdin, bounded stdout, reduced recorded environment

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, NFR-8, AC-F6-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-strategies-command.test.ts`; recording child-runner seam
**Tags**: @backend, @security

**Preconditions**:

- Parent environment planted with sentinel secret-bearing variables; recording seam captures stdin state, stdout handling, stderr handling, and the exact recorded child environment; the reduced-set variable names are declared constants from the implementation plan (see §8.3).

**Steps**:

1. Closed stdin: assert the child's stdin is closed immediately (a prompt-style double fails fast on the closed stream rather than blocking).
2. Bounded stdout: a double emitting beyond the declared capture bound yields a refused shape — never partial material, never an unbounded buffer.
3. Reduced environment: assert the recorded child environment equals exactly the declared reduced set — path, home directory, session-bus facts where a keyring-backed store requires them, and declared non-secret variables — and that no sentinel secret-bearing variable from the parent appears in it.
4. Direct execution: assert no shell is spawned, no metacharacter interpretation occurs, and no runtime interpolation touches the argv.

**Expected Outcome**:

- The recorded child environment is exactly the reduced set; nothing secret-bearing is forwarded; stdin closed; stdout bounded.

#### TC-COMPAT-001 - Existing configurations and fixtures validate and resolve byte-identically

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F1-2, DM-1, DM-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-compatibility.test.ts` with goldens in `tests/golden/` and shipped provider-config fixtures in `tests/fixtures/`
**Tags**: @backend, @regression

**Preconditions**:

- Committed golden records of delivered validation and resolution outcomes captured before the change lands (regenerated deliberately, never blanket-rewritten).

**Steps**:

1. Validate and resolve every existing `literal` and `environment-prefixed` declaration in the shipped fixtures; compare against the goldens byte-identically.
2. Assert the shipped configuration defaults are unchanged, including the tracker reference defaulting exactly to `literal` / `GITHUB_TOKEN` (catalog default equality assertion).
3. Assert no migration exists: no migration code path, no upgrade step, no operator edit required — the catalogue accepts old files verbatim and no style was renamed.

**Expected Outcome**:

- Byte-identical validation and resolution for everything that already ships; the change is adoptable and abandonable without an operator edit.

#### TC-STRUCT-001 - Vocabulary and structure invariants: no new failure identity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-8, NG-6, AC-F8-1, AC-F4-3, NFR-6
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/credential-vocabulary-invariants.test.ts`; extends `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts` with their mutation suites in `tests/checks/`
**Tags**: @backend, @regression, @ci

**Steps**:

1. Assert the delivered error-table row count and row set are unchanged; the failure variant's three new fields are projection data on the variant, not columns on the row, and the row binding to `config.credential.missing` still holds (drift test).
2. Snapshot-assert the park-record shape: no field added, no new park cause, the delivered `credential-missing` condition and `provider.credential.missing` announcement unchanged; the classified reason appears only in the rendered refusal and the log line, never as a park-record field.
3. Snapshot-assert the delivery-result token set and the announcement-code set are unchanged; the CLI exit taxonomy stays exactly `{0, 1, 2}`.
4. Assert no daemon unit is involved in any credential failure path of the one-shot commands (AC-F4-3 wording).

**Expected Outcome**:

- Zero additions to any delivered failure-identity vocabulary; the failure variant grew only by the three optional fields.

#### TC-STRUCT-002 - Secret-read boundary intact; no new ambient environment read

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, NFR-7
**Test Type(s)**: Boundary
**Automation Level**: Automated
**Target Layer / Location**: existing secret-read boundary check `scripts/checks/secret-read-boundary.ts` (extended to the new strategy files) with `tests/checks/` mutation tests; ambient-globals guard and `tests/boundaries/` negative fixtures
**Tags**: @backend, @security, @regression

**Steps**:

1. Assert strategy implementations live only inside the single credential-material directory (`packages/adapters/src/credentials/`): the boundary check enumerates the new strategy modules and finds nothing credential-material-shaped outside it.
2. Assert zero new ambient environment reads outside the existing allowlist entry: the ambient-globals AST guard covers the new modules; any direct environment access in strategy code fails the boundary.
3. Assert the negative fixtures exist for every new/extended rule (the fixture-coverage meta-check fails any rule without a failing fixture — added in the same change).

**Expected Outcome**:

- Exactly one credential-material directory; zero new ambient reads; the delivered deny-by-default mechanics hold mechanically.

#### TC-LANE-001 - Lane environment stays model-only: inventory-style checked proof

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F6-3, DM-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/credential-lane-model-only-proof.test.ts`; extends `harness-spawn-credential.test.ts`; lane descriptor and profile environment record builders
**Tags**: @backend, @regression

**Preconditions**:

- The spawn descriptor supports a declared credential entry (delivered capacity) — the proof shows none is present under shipped settings.

**Steps**:

1. Build every lane descriptor and the profile environment record from shipped settings through the real builders (inventory over the built artifacts, not an assertion of intent).
2. Assert zero descriptor carries a credential entry, and the profile environment record's key set equals exactly the model-name set (set equality against the declared model-name constants — not a count that can drift).
3. Control case: build with an operator-declared credential entry and assert the delivered spawn-time behaviour is unchanged (the descriptor carries the entry and the existing spawn contract applies).

**Expected Outcome**:

- "The lane environment is model-only" is a checked proof for shipped settings, with the declared-entry capacity demonstrably intact.

#### TC-TRIP-001 - Allowlist tripwire: fails on drift without the module, passes clean, passes without host coordinates

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DEC-13, AC-F7-1, DM-4, RSK-1
**Test Type(s)**: CI check
**Automation Level**: Automated
**Target Layer / Location**: new invariant check under `scripts/checks/` (exact filename per the owner's file list, fixed in the implementation plan; joins the `pnpm check` battery) with mutation suite `tests/checks/allowlist-tripwire.test.ts`
**Tags**: @ci, @security, @regression

**Preconditions**:

- Mutation tests drive the check with fixture change-sets (changed-file lists and tree states as inputs), keeping the permanent suite tree-invariant-shaped per the testing strategy; the CI gate itself may read the PR diff at PR time.

**Steps**:

1. Change the allowlist table without the allowlist module in the change-set → assert the check exits non-zero and names the drift.
2. Change a committed command argv → non-zero exit naming the drift.
3. Change the effective argv derived from committed configuration → non-zero exit naming the drift.
4. Change none of the three → assert exit 0.
5. With NO committed `integrations.<kind>.host` coordinates (this change's state — none exist): enumerate declared host coordinates from configuration itself and assert exit 0 on their absence; then add one coordinate and assert the check enumerates it (the mechanism is live, not vacuous).
6. With the allowlist module included in the change-set and the table widened → the check passes (widening is a reviewed code change, loud by construction).

**Expected Outcome**:

- Every widening path fails CI loudly; every legitimate path passes; absence of host coordinates never fails the gate.

#### TC-HERM-001 - Suite-level hermeticity guard: no real owner CLI, no credential

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, NFR-4, AC-F8-2
**Test Type(s)**: Suite guard
**Automation Level**: Automated
**Target Layer / Location**: `tests/preload.ts` (test-run guard) plus `tests/behaviour/credential-hermeticity-guard.test.ts`
**Tags**: @ci, @security, @regression

**Preconditions**:

- The guard is behaviour-based, not environment-absence-based: CI runners may ship a real `gh`; the guard must still hold.

**Steps**:

1. Install a test-run guard (preload) that intercepts any attempt by test code to spawn the owner CLI binary names, to reach a real store path, or to touch a keyring service, failing the suite and naming the offending test.
2. Assert every credential strategy in the suite is constructed over the four injected seams (child runner, environment record, harness identity, allowlist table) — the guard plus suite conventions make the real path unreachable.
3. Assert the suite passes with no credential present in the environment (the CI posture): no test reads a token variable, keyring, or store.
4. Mutation control: a deliberately misbehaving probe (a test-shaped fixture that attempts a real spawn) is caught by the guard — proving the guard has teeth.

**Expected Outcome**:

- Zero real invocations of a real owner CLI, store, or keyring across the suite; CI requires no credential.

## 6. Environments and Test Data

- **CI environment**: no credential, now or ever (spec assumption). The hermetic guard is behaviour-based, so it holds even on runners where a real `gh` exists. No network access; no real keyring or secret service; `TMPDIR=$PWD/tmp/tmpdir` for any evidence writes.
- **Temporary workspaces**: capsule-event, ledger-record, and status/doctor surface cases run against per-test temporary workspaces so persisted artifacts are inspectable and disposable.
- **Fixture doubles (never live calls)**:
  - Child-runner doubles: scripted stdout/stderr/exit/delay, including hanging, malformed (unparseable, interior newline, oversize), canary-emitting (activation-armed post-composition), and prompt-style doubles that fail on closed stdin.
  - Export-shape fixture doubles: the pinned JSON array shape (`id`, `integrationID`, `label`, `active`, `value`; `value.type` ∈ key | oauth) plus the drift corpus of TC-HARNESS-005. All values are obviously-fake sentinels (never real-shaped credentials) so the `privacy-literals` invariant stays green.
  - Harness identity doubles and allowlist-table doubles (the shipped table plus temporary-directory program fixtures for symlink cases).
  - Recording registry seam to prove register-before-parse-and-throw ordering.
- **Named constants owned by the implementation plan** (tests reference the constants, never hard-code the values): slot length bounds (OQ-4), stdout-capture bound, session-bus variable set for the reduced child environment, export supported-version window values, cap defaults (15 s / 30 s — pinned by the spec itself).
- **Isolation**: every suite hermetic by construction; no test may spawn, read a store, or require a credential (TC-HERM-001 enforces); goldens are regenerated deliberately with an explicit command, never blanket-rewritten (testing-strategy rule).

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create / update | Execution command | Mocking requirements | Status |
|-------|------------------------------|-------------------|----------------------|--------|
| TC-COMP-001 | `tests/behaviour/credential-composition-proof.test.ts` (new) | `bun test tests/behaviour/credential-composition-proof.test.ts` | Injected child-runner seam; recording registry; temp workspace | To Implement |
| TC-COMP-002 | `tests/behaviour/credential-composition-proof.test.ts` | `bun test tests/behaviour/credential-composition-proof.test.ts` | Injected export seam (pinned-shape fixture) | To Implement |
| TC-COMP-003 | `tests/behaviour/credential-composition-proof.test.ts` | `bun test tests/behaviour/credential-composition-proof.test.ts` | Environment record double; zero-spawn assertion | To Implement |
| TC-COMP-004 | Manual demonstration script/steps recorded in pm-notes | Manual, post-merge, authenticated host | Real owner stores; no mocks; no material recorded | Manual Only |
| TC-REDACT-001 | `tests/behaviour/credential-redaction-live-registry.test.ts` (new) | `bun test tests/behaviour/credential-redaction-live-registry.test.ts` | Post-composition-armed canary double; seven-surface sweep; sensitivity control | To Implement |
| TC-REDACT-002 | `tests/behaviour/credential-redaction-live-registry.test.ts` | `bun test tests/behaviour/credential-redaction-live-registry.test.ts` | Recording registry seam ordering registration vs parse/throw | To Implement |
| TC-REDACT-003 | `tests/behaviour/credential-redaction-live-registry.test.ts` | `bun test tests/behaviour/credential-redaction-live-registry.test.ts` | stderr-canary double; surface sweep | To Implement |
| TC-REDACT-004 | `tests/behaviour/credential-redaction-live-registry.test.ts` | `bun test tests/behaviour/credential-redaction-live-registry.test.ts` | Per-site drivers for `registerEdgeSecrets` helper + its two call sites | To Implement |
| TC-REASON-001 | `tests/behaviour/credential-strategies-reasons.test.ts` (new) | `bun test tests/behaviour/credential-strategies-reasons.test.ts` | One trigger double per reason; parameterized | To Implement |
| TC-REASON-002 | `tests/behaviour/credential-strategies-reasons.test.ts` | `bun test tests/behaviour/credential-strategies-reasons.test.ts` | Hanging child; adversarial classification matrix | To Implement |
| TC-REASON-003 | `tests/behaviour/credential-strategies-reasons.test.ts` | `bun test tests/behaviour/credential-strategies-reasons.test.ts` | Daemon composition inventory; token sweep | To Implement |
| TC-REMEDY-001 | `tests/behaviour/credential-strategies-remedies.test.ts` (new) + `tests/fixtures/` remedy fixtures | `bun test tests/behaviour/credential-strategies-remedies.test.ts` | Byte-exact fixture data (Appendix B) | To Implement |
| TC-REMEDY-002 | `tests/behaviour/credential-strategies-remedies.test.ts` | `bun test tests/behaviour/credential-strategies-remedies.test.ts` | Per-entry remedy-selection assertions; hostile-config probe | To Implement |
| TC-REMEDY-003 | `tests/behaviour/credential-strategies-remedies.test.ts` | `bun test tests/behaviour/credential-strategies-remedies.test.ts` | Per-site propagation drivers; surface capture | To Implement |
| TC-ALLOW-001 | `tests/behaviour/credential-strategies-command.test.ts` (new) | `bun test tests/behaviour/credential-strategies-command.test.ts` | Allowlist-table double; declaration corpus | To Implement |
| TC-ALLOW-002 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Out-of-table/interpreter/network-client declaration corpus | To Implement |
| TC-ALLOW-003 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Unpermitted-parameter and unknown-field corpus | To Implement |
| TC-ALLOW-004 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Grammar boundary corpus expressed against plan constants | To Implement |
| TC-ALLOW-005 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Argv construction assertions over all accepted shapes | To Implement |
| TC-ALLOW-006 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Temp-dir program fixtures (symlink chains, file shapes) | To Implement |
| TC-HARNESS-001 | `tests/behaviour/credential-strategies-harness-store.test.ts` (new) | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | Export seam double; retention sweep | To Implement |
| TC-HARNESS-002 | `tests/behaviour/credential-strategies-harness-store.test.ts` | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | Zero/multi-active entry doubles | To Implement |
| TC-HARNESS-003 | `tests/behaviour/credential-strategies-harness-store.test.ts` | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | Empty-store double; environment sentinel | To Implement |
| TC-HARNESS-004 | `tests/behaviour/credential-strategies-harness-store.test.ts` | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | OAuth-entry double; write-path-failing double; structural inventory | To Implement |
| TC-HARNESS-005 | `tests/behaviour/credential-strategies-harness-store.test.ts` | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | Drift corpus (four departures + two controls) | To Implement |
| TC-HARNESS-006 | `tests/behaviour/credential-strategies-harness-store.test.ts` | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | Harness identity doubles (match/mismatch/unsupported) | To Implement |
| TC-HARNESS-007 | `tests/behaviour/credential-strategies-harness-store.test.ts` + `tests/fixtures/` shape fixtures | `bun test tests/behaviour/credential-strategies-harness-store.test.ts` | Pinned-shape fixtures; version-window constant | To Implement |
| TC-MEMO-001 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Counting child-runner seam | To Implement |
| TC-MEMO-002 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Per-command composition drivers; counting seam | To Implement |
| TC-EXEC-001 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Hanging child; declared short timeout; constant pinning | To Implement |
| TC-EXEC-002 | `tests/behaviour/credential-strategies-command.test.ts` | `bun test tests/behaviour/credential-strategies-command.test.ts` | Recording seam (stdin/stdout/stderr/env capture); sentinel parent env | To Implement |
| TC-COMPAT-001 | `tests/behaviour/credential-compatibility.test.ts` (new) + `tests/golden/` records | `bun test tests/behaviour/credential-compatibility.test.ts` | Goldens of delivered outcomes; shipped provider-config fixtures | To Implement |
| TC-STRUCT-001 | `tests/structure/credential-vocabulary-invariants.test.ts` (new); update `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts` | `bun test tests/structure/credential-vocabulary-invariants.test.ts` && `bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts` | Park-record shape snapshot; result-token/announcement-code snapshots | Existing – Update |
| TC-STRUCT-002 | Extend `scripts/checks/secret-read-boundary.ts` coverage + `tests/boundaries/` fixtures + `tests/checks/` mutation tests | `bun run scripts/checks/secret-read-boundary.ts` && `bun test tests/boundaries` | Negative fixtures per new rule (fixture-coverage meta-check) | Existing – Update |
| TC-LANE-001 | `tests/behaviour/credential-lane-model-only-proof.test.ts` (new); update `tests/behaviour/harness-spawn-credential.test.ts` | `bun test tests/behaviour/credential-lane-model-only-proof.test.ts` | Real builders; model-name set constants; declared-entry control | To Implement (control: Existing – Update) |
| TC-TRIP-001 | New invariant check under `scripts/checks/` (filename per owner's file list) + `tests/checks/allowlist-tripwire.test.ts` (new) | The tripwire runs inside `pnpm check` via `bun run scripts/checks/...` once its filename lands; its mutation suite: `bun test tests/checks/allowlist-tripwire.test.ts` | Fixture change-sets; host-coordinate enumeration cases | To Implement |
| TC-HERM-001 | `tests/preload.ts` (update: hermetic spawn guard) + `tests/behaviour/credential-hermeticity-guard.test.ts` (new) | `bun test tests/behaviour/credential-hermeticity-guard.test.ts` (guard active on every `bun test` run via preload) | Spawn interception; misbehaving-probe mutation control | Existing – Update (preload) / To Implement (suite) |

**Existing suites to update for additive coverage** (companion to the TCs above): `tests/behaviour/credential-port.test.ts` (failure variant gains the three optional fields; reserved union member declared), `tests/behaviour/provider-credentials.test.ts` (compat golden refresh), `tests/behaviour/status-credential-prerequisite.test.ts` (status spawn profile), the testkit credential conformance double (`packages/testkit/src/conformance/**` — four-style union representation) covered by `bun test tests/structure/conformance-coverage.test.ts` and `bun test tests/conformance`.

**Gate battery** (recorded in the execution log with the evidence convention `TMPDIR=$PWD/tmp/tmpdir`):

1. `bun test` / `pnpm test` — full behaviour/structure/boundary/conformance suites including everything above.
2. `pnpm check` — aggregate gate (lint → format:check → typecheck → test → check:boundaries; includes the secret-read boundary, privacy-literals, memory-lint, and prompt-conformance invariants; the new allowlist tripwire joins this battery).
3. `bun run scripts/checks/allowlist-tripwire` — the new tripwire, per the owner's file list (exact filename fixed in the implementation plan).
4. `bash scripts/.tests/test-doc-distribution.sh` — required because this change touches `doc/decisions/00-index.md` (a standalone doc in the marker-required set) and adds a decisions register row.
5. Decision-record content check (manual/static): ADR-0014 present with index row and register binding, status `Proposed`, decision date unset; no agent marks it Accepted.
6. `git diff --check` — whitespace/conflict-marker guard.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | A test bypasses the injected seams and reaches a real binary that happens to exist on a CI runner (e.g. `gh` is preinstalled on GitHub runners) | TC-HERM-001 guard is behaviour-based (intercepts spawn attempts by name), not environment-absence-based; mutation control proves the guard fires |
| TR-2 | The register-after-compose canary test silently regresses into a register-before-compose shape (the exact proof the AC forbids) | The child double's canary emission is armed only after composition construction; the sensitivity control (TC-REDACT-001 step 4) proves the sweep catches an unregistered canary, so a regressed proof fails loudly |
| TR-3 | Cap tests make the suite slow or flaky if they wait on the real 15 s default | Cap behaviour is tested with a declared per-declaration timeout within the 30 s bound (DM-1 permits it); shipped constants are pinned by assertion, never by wall-clock waits |
| TR-4 | Byte-exact remedy pinning is defeated by near-miss edits (whitespace, punctuation) | Fixtures carry the Appendix B texts verbatim; the suite asserts byte-exact equality so any edit fails deliberately (TC-REMEDY-001) |
| TR-5 | Tripwire mutation tests drift into base-branch-diff assertions, violating the permanent-suite rule | Mutation tests drive the check with fixture change-sets as inputs (tree-invariant shape); only the CI gate itself reads the PR diff at PR time |
| TR-6 | Manual demonstration cannot run (no authenticated host available post-merge) | Named follow-up with the owner; the CI-provable coverage of AC-F1-1 stands on TC-COMP-001..003 alone; the demo is the end-to-end promise proof, not a gate |

### 8.2 Assumptions

- TA-1: The four injected seams (child runner, environment record, harness identity, allowlist table) exist as construction inputs per F-8/F-3, so strategies are constructible with substitutes in every suite.
- TA-2: The per-declaration per-execution timeout (DM-1) can be set short in tests, within the 30 s bound, without touching shipped defaults.
- TA-3: Capsule events, ledger records, and status/doctor surfaces are observable by running the one-shot compositions against temporary workspaces.
- TA-4: Fixture sentinel values shaped obviously-fake keep the `privacy-literals` invariant green; real-shaped literals in fixtures would fail the aggregate gate.
- TA-5: `pnpm check` includes the named invariants (secret-read boundary, privacy-literals, memory-lint, prompt-conformance) so the gate battery needs no separate invocation for them.
- TA-6: Goldens for TC-COMPAT-001 are captured from the delivered behaviour before the change lands and regenerated only deliberately.

### 8.3 Open Questions

| ID | Question | Status / Owner |
|----|----------|----------------|
| OQ-T1 (mirrors spec OQ-4) | Concrete slot length bounds for `<host>` and `<integrationID>` — the plan must fix them as named constants; TC-ALLOW-004 expresses boundaries against the constants | Non-blocking; fixed in phase 4 (implementation plan); any reasonable bound satisfies the grammar |
| OQ-T2 | The concrete stdout-capture bound is not stated in the spec (only "bounded stdout capture") and is not covered by OQ-4. Recommend the plan fixes it as a named constant alongside the OQ-4 bounds; TC-EXEC-002 expresses the boundary against the constant | Non-blocking; surfaced explicitly — same class as OQ-4 (declared, reviewed constant per §22), no specification reopen judged necessary |
| OQ-T3 | The exact session-bus variable names ("session-bus facts where a keyring-backed store requires them") for the reduced child environment — TC-EXEC-002 asserts recorded env equals the declared reduced set and needs the exact set | Non-blocking; fixed as a named constant in the plan |
| OQ-T4 | Concrete supported-version-window values for the harness CLI export — the spec pins the requirement to pin, not the numbers | Non-blocking; fixed during delivery from the measured hosts (TC-HARNESS-007 constant; TC-COMP-004 records observations) |
| OQ-T5 (mirrors spec OQ-3) | Confirm the three edge-composed registration sites receive the live-registry treatment with the malformed-output coverage at each — answered by TC-REDACT-004 at delivery | Non-blocking; delivery-time confirmation |
| OQ-T6 | AC-F4-2's surface parenthetical lists five surfaces (human output, JSON envelope, `status`, `doctor`, park/log line) while F-4 additionally names the MCP serve state placeholders; TC-REMEDY-003 covers the MCP placeholders under F-4. Confirm this reading — no AC is uncovered either way | Non-blocking clarification for the DoR gate |
| OQ-T7 | Spec Appendix B pins three remedy texts byte-exact; all other `(reason, style)` cells are contract-only ("bounded text naming the one operator act"). TC-REMEDY-002 asserts the content contract for those cells. If the owner wants every cell byte-pinned, that is a spec revision, not a test change | Non-blocking; owner preference |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-23 | @test-plan-writer | Initial test plan from completed spec chg-GH-394-spec.md: 37 test cases covering all 20 ACs, hermeticity and register-after-compose oracles per owner constraints, allowlist tripwire battery, manual real-store demonstration named post-merge |

## 10. Test Execution Log

Populated during execution (phases 6–9). Gate evidence convention: `TMPDIR=$PWD/tmp/tmpdir`; runners `bun test` / `pnpm test` / `pnpm check`.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions recorded yet |
