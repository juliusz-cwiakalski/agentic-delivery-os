---
id: chg-GH-173-test-plan
status: Updated
created: 2026-10-30T06:33:54Z
last_updated: 2026-10-30T07:11:22Z
owners: [engineering]
service: delivery-os configuration
labels: [change, planning]
version_impact: minor
summary: "Verify seven-layer configuration resolution, source-accurate inspection, fail-closed validation and GH-172-compatible classified/redacted results."
links:
  change_spec: ./chg-GH-173-spec.md
  implementation_plan: ./chg-GH-173-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S4: Config layer (DEC-4)

## 1. Scope and Objectives

Prove every one of the 25 spec acceptance criteria against the **production resolver and adapters**, using typed fixture catalogs where production's ordinary catalog/defaults are intentionally empty. Failures must never return partially merged data, invent source lines, expose secret canaries or bypass the existing output chokepoint. This is a design and implementation map, not an execution claim.

### 1.1 In Scope

Seven levels, platform/git/CI/selector discovery, partial and final schema checks, YAML positions and default manifest, typed environment overrides, source restrictions, branding and legacy acquisition, nine classified failures, human/machine output, packed portability, dependency and boundary gates. Exercise the **same exported core resolver** and file adapter in fixture and production-baseline cases; synthetic `x-test` and other typed test fields are never published production settings.

### 1.2 Out of Scope & Known Gaps

No credential resolver (owned by M0-S12), keyring, sidecar, transport, remote execution, consumer-specific provider/state fields, persisted events, REST APIs, extends, policy overlays or bash delivery-stack changes. Proposed TDR-0003 and dependency licenses require **human owner acceptance before merge/adoption**, not before branch implementation or opening an unmerged PR. No spec AC is unmapped; upstream parser hardening and actual host portability remain to be demonstrated by delivery tests, not assumed.

## 2. References

- [Change specification](./chg-GH-173-spec.md), especially §§5, 8.3 (DM-2 first-match matrix), 9, 17 (25 ACs) and 18 (open-PR Definition of Done).
- [Implementation plan](./chg-GH-173-plan.md), especially phases 3–4 for discovery/CLI and phase 8 for handoff evidence.
- [Accepted ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) DEC-4; [Proposed TDR-0003](../../../decisions/TDR-0003-config-parser-schema-and-acquisition.md), refinements 1–8 (not owner-accepted).
- [Testing strategy](../../../../.ai/rules/testing-strategy.md); [branding seam](../../../spec/features/feature-branding-seam.md); [GH-172 result contract](../../../spec/features/feature-result-contract.md); `.github/workflows/ci.yml`.
- The implementation plan was absent at initial test-plan authoring; it now exists and is linked above.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Capability | AC | TC | Status |
|---|---|---|---|
| F-1 | AC-F1-1 | TC-CONFIG-001 | Planned |
| F-1, F-3 | AC-F1-2 | TC-CONFIG-002 | Planned |
| F-2 | AC-F2-1 | TC-CONFIG-003 | Planned |
| F-2 | AC-F2-2 | TC-CONFIG-004 | Planned |
| F-2 | AC-F2-3 | TC-CONFIG-005 | Planned |
| F-2, F-4 | AC-F2-4 | TC-CONFIG-006 | Planned |
| F-3, F-6 | AC-F3-1 | TC-CONFIG-007 | Planned |
| F-3 | AC-F3-2 | TC-CONFIG-008 | Planned |
| F-1, F-3 | AC-F3-3 | TC-CONFIG-009 | Planned |
| F-3, F-5 | AC-F3-4 | TC-CONFIG-010 | Planned |
| F-3 | AC-F3-5 | TC-CONFIG-011 | Planned |
| F-4 | AC-F4-1 | TC-CONFIG-012 | Planned |
| F-4 | AC-F4-2 | TC-CONFIG-013 | Planned |
| F-4, F-7 | AC-F4-3 | TC-CONFIG-014 | Planned |
| F-5 | AC-F5-1 | TC-CONFIG-015 | Planned |
| F-5, F-6 | AC-F5-2 | TC-CONFIG-016 | Planned |
| F-5 | AC-F5-3 | TC-CONFIG-017 | Planned |
| F-5, F-6 | AC-F6-1 | TC-CONFIG-018 | Planned |
| F-6 | AC-F6-2 | TC-CONFIG-019 | Planned |
| F-6 | AC-F6-3 | TC-CONFIG-020 | Planned |
| F-3, F-6 | AC-F6-4 | TC-CONFIG-021 | Planned |
| F-4, F-6 | AC-F6-5 | TC-CONFIG-022 | Planned |
| F-7 | AC-F7-1 | TC-CONFIG-023 | Planned |
| F-7 | AC-F7-2 | TC-CONFIG-024 | Planned |
| F-7 | AC-F7-3 | TC-CONFIG-025 | Planned |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No API-* endpoints or EVT-* messages exist in the spec. Diagnostics are not events.

| Interface | TC IDs | Observable assertion |
|---|---|---|
| DM-1 resolved tree/origins | TC-CONFIG-001, 002, 008, 009, 011, 017, 018 | Valid effective JSON tree; directives/bootstrap absent; winning origins |
| DM-2 loaded/skipped and per-node positions | TC-CONFIG-003, 004, 005, 006, 010, 015, 017 | First-match reason matrix and non-read evidence for overlaps; ordered evidence and real lines |
| DM-3 ConfigSource plain facts/port | TC-CONFIG-004, 007, 010, 023, 024, 025 | No raw parser/document crosses core contracts |
| DM-4 generated schema/catalog | TC-CONFIG-008, 009, 011, 012, 013, 025 | Same trusted draft-07 schema and typed fixture semantics |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | TC IDs | Gate |
|---|---|---|
| NFR-1 | TC-CONFIG-001, 023, 025 | Repeat injected resolution; ambient/boundary checks |
| NFR-2 | TC-CONFIG-002, 007, 008, 011, 013 | Each present partial and final validated; no partial result |
| NFR-3 | TC-CONFIG-010, 015, 017 | True node/fixture/default lines; drift mutation |
| NFR-4 | TC-CONFIG-013, 019, 021, 022 | Registered and **unregistered** canaries in both streams |
| NFR-5 | TC-CONFIG-007, 019, 020 | 9/9 table identities, sync mutation, {0,1,2} |
| NFR-6 | TC-CONFIG-023, 024, 025 | Dependency/literal/boundary gates plus whole CI |
| NFR-7 | TC-CONFIG-003, 004, 005, 006, 015, 018 | Debug evidence and origin completeness |
| NFR-8 | TC-CONFIG-007, 010, 021, 022 | Both host switches reject before parse; safe diagnostics |
| NFR-9 | TC-CONFIG-011, 017, 025 | Packed Node/Bun imports and artifact parity |

## 4. Test Types and Layers

- **Unit/behaviour**: `bun:test` in `tests/behaviour/config-*.test.ts`, use typed fixture catalogs and imported **public production** `resolveConfig`; no duplicate test resolver, simulated CLI renderer or ambient core reads. Add determinism, schema, merge, restrictions, classifier and warning assertions.
- **Integration/contract**: `tests/behaviour/config-sources.test.ts` and `tests/behaviour/config-cli.test.ts` use actual adapters `./file`, `./repo`, `./legacy` and in-process `runCli` with injected streams, temporary repository trees and controlled environment facts; exercise production YAML parser, not just hand-built facts. For DM-2 overlaps, assert exact skipped-layer records and instrument acquisition to prove skipped sources are not read, including present poisoned files. Extend `tests/structure/`, `tests/golden/`, `tests/checks/` for contract, outputs and mutation checks. Fixtures in `tests/fixtures/config/**` (not `*.test.ts`). No external APIs.
- **Static/non-functional**: `tests/boundaries/**` failing fixtures for any new rule; `bun run scripts/checks/error-table-sync.ts` and `tests/checks/error-table-sync.test.ts` for bidirectional drift; corresponding manifest/default-position check + line-insertion mutation; existing license, forbidden-literal, ambient, workspace-entrypoint, pin/export/publish checks. Node/Bun packed-import tests and repository docs review.
- **Gate handoff (not run by this writer)**: after `pnpm install --frozen-lockfile`, build before dist-dependent tests/exports; narrow `bun test tests/behaviour/config-*.test.ts` only if shell expansion matches the created tests; `bun test tests/structure tests/behaviour tests/golden tests/checks tests/boundaries`; `pnpm check`; `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts`; `bun run scripts/checks/forbidden-literals.ts`; `git diff --check`. For new docs review rendered Markdown, links and AC mapping. PR **base `main-tools`**; orchestrator checks **all** `ts-*` jobs and `bash-tests` (plus other required CI jobs) green on the **pushed HEAD**, not an earlier SHA. CI's bash job runs its own excluded-suite matrix; this plan does not change bash scripts.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC |
|---|---|---|---|---|---|
| TC-CONFIG-001 | Seven winners | Happy Path | Critical | High | AC-F1-1 |
| TC-CONFIG-002 | Reset and invalid targets | Edge Case | Critical | High | AC-F1-2 |
| TC-CONFIG-003 | Platform locations | Edge Case | Important | High | AC-F2-1 |
| TC-CONFIG-004 | Git-root bounds | Negative | Critical | High | AC-F2-2 |
| TC-CONFIG-005 | CI disables ambient layers | Regression | Critical | High | AC-F2-3 |
| TC-CONFIG-006 | Selected-file slot | Edge Case | Critical | High | AC-F2-4 |
| TC-CONFIG-007 | Malformed source | Negative | Critical | High | AC-F3-1 |
| TC-CONFIG-008 | Reserved and extension input | Negative | Critical | High | AC-F3-2 |
| TC-CONFIG-009 | Empty production, typed fixtures | Corner Case | Critical | High | AC-F3-3 |
| TC-CONFIG-010 | YAML shapes and lines | Edge Case | Critical | High | AC-F3-4 |
| TC-CONFIG-011 | Partial, final and packed schema | Corner Case | Critical | High | AC-F3-5 |
| TC-CONFIG-012 | Typed env and interpolation | Negative | Critical | High | AC-F4-1 |
| TC-CONFIG-013 | Forbidden sources | Negative | Critical | High | AC-F4-2 |
| TC-CONFIG-014 | Frozen branding bootstrap | Edge Case | Critical | High | AC-F4-3 |
| TC-CONFIG-015 | Debug/get winning origin | Happy Path | Critical | High | AC-F5-1 |
| TC-CONFIG-016 | Safe warnings and strict | Negative | Important | High | AC-F5-2 |
| TC-CONFIG-017 | Origin replacement and manifest drift | Regression | Critical | High | AC-F5-3 |
| TC-CONFIG-018 | Human inspection | Regression | Important | High | AC-F6-1 |
| TC-CONFIG-019 | Machine envelope and redaction | Regression | Critical | High | AC-F6-2 |
| TC-CONFIG-020 | Exact code plus kind | Regression | Critical | High | AC-F6-3 |
| TC-CONFIG-021 | Parser debug-switch guard | Negative | Critical | High | AC-F6-4 |
| TC-CONFIG-022 | Unregistered secret error canaries | Negative | Critical | High | AC-F6-5 |
| TC-CONFIG-023 | Pure resolver and brand variants | Regression | Critical | High | AC-F7-1 |
| TC-CONFIG-024 | Legacy once and current wins | Regression | Important | High | AC-F7-2 |
| TC-CONFIG-025 | Packed API and boundary gates | Regression | Critical | High | AC-F7-3 |

### 5.2 Scenario Details

#### TC-CONFIG-001 - Seven winners

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-resolver.test.ts`, `tests/fixtures/config/**`
**Tags**: @backend

**Preconditions**:
- Typed `x-test` catalog: nested map, scalar, whole-list, default, explicit env and flag mappings. Seven distinct values tagged by layer; actual file facts from adapter for four file levels.

**Steps**:
1. Supply seven layers in prescribed priority; repeat with the same facts. In separate runs stop after each layer to prove each intermediate winner, including default and system.
2. Override one nested scalar without overriding its sibling; override a list with a shorter list at the next priority; inspect every effective origin.

**Expected Outcome**:
- Priority is defaults < system < user-global < committed < local < environment < CLI; nested sibling survives, list replaces entirely (not union/append), scalar is last-wins, all winning origins match the supplying layer; repeats produce identical values and origins.

#### TC-CONFIG-002 - Reset and invalid targets

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-2, DM-1, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-resolver.test.ts`
**Tags**: @backend

**Preconditions**:
- Lower nested value with descendant positions; higher layer contains `reset: [x-test.nested]` and a new nested value.

**Steps**:
1. Resolve and compare effective values and origins with the lower layer; inspect `reset` as a key.
2. Run malformed reset directives and nonexistent/invalid dotted targets, including a later overriding layer; test strict off/on.

**Expected Outcome**:
- Inherited descendants and origins disappear before same-layer replacement; `reset` is not a value. Invalid reset yields exact `config.reset.invalid`, no partial snapshot, even if later shadowed.

#### TC-CONFIG-003 - Platform locations

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-sources.test.ts`
**Tags**: @backend

**Preconditions**:
- Temp Linux/macOS/Windows location facts, brand-derived config directory, CI disabled, separate fixture files at each candidate.

**Steps**:
1. Probe Linux `XDG_CONFIG_DIRS` with two present candidates (first wins), no XDG variables (`/etc/xdg` and `$HOME/.config` defaults), and `XDG_CONFIG_HOME` override.
2. Probe macOS `/Library/Application Support` and home Library, Windows `%PROGRAMDATA%` and `%APPDATA%`; remove optional sources one by one.

**Expected Outcome**:
- Only the platform table's first eligible Linux system path and proper user path are loaded; other platforms ignore XDG; absent layers report `missing` and remain ordered, paths use brand identity rather than literal product names.

#### TC-CONFIG-004 - Git-root bounds

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-2, DM-3, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-sources.test.ts`
**Tags**: @backend

**Preconditions**:
- Temporary git root with files at root, nested cwd/intermediate decoys, hostile parent directory above root; a second cwd outside git and independent optional system/user facts. Record file-read attempts and use distinct valid and poisoned decoys.

**Steps**:
1. Resolve from nested cwd and explicit `--project-root`; move or remove root files while retaining intermediate/above-root files. Assert both project layers report `missing` when eligible root files are absent, never reading decoys.
2. Resolve outside git without selection/root under CI off, then with deliberate explicit root under CI off and on; compare read attempts and reasons with TC-CONFIG-005/006.

**Expected Outcome**:
- Only root-level committed/local files are read; never intermediate or above the git/explicit root. Outside git without selection/root and CI off, both project layers skip `no-git-root` even if a parent decoy exists; enabled system/user still resolve or report `missing`. Under CI outside git, committed stays `no-git-root` while local is `ci-disabled` unless explicitly enabled (then `no-git-root`). An explicit root makes root files eligible or `missing` if absent, never widens discovery above that root and never overrides CI disabling. All skipped/decoy sources have zero read attempts.

#### TC-CONFIG-005 - CI disables ambient layers

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-sources.test.ts`
**Tags**: @backend

**Preconditions**:
- All file layers present with distinct valid values; injected `CI=true`, alternate outside-git cwd, explicit root and selected-file variants. Instrument acquisition and place poisoned present content in sources expected to be skipped; separately remove optional files for `missing` controls.

**Steps**:
1. Resolve baseline, then separately enable `--enable-system-config`, `--enable-user-config`, `--enable-project-local-config` and all three; include inside-git, outside-git, explicit project root and selected file runs.
2. For every row in the DM-2 oracle below, assert the **exact** reason per skipped layer and the absence of reads of skipped sources, even when present/poisoned. When a source becomes eligible, use valid content to show a read or remove it to show `missing`; keep system and user flags independent.

**Expected Outcome**:
- System and user each skip `ci-disabled` unless **their own** flag re-enables them. Project-local checks selection first (`selected-config`), then CI/local enable (`ci-disabled`), then root (`no-git-root`), then optional absence (`missing`). Committed checks root only when unselected; a selected file occupies that slot. Defaults/env/CLI have no optional-file skip reason. Root/selection does not re-enable system/user; no skipped source is read or contributes a value. The following oracle is checked with source-read counts, not merely value precedence.

**DM-2 exact overlap oracle** (S/U/L = `--enable-system-config` / `--enable-user-config` / `--enable-project-local-config`; `load` means eligible present file is read, `missing` means eligible absent optional file is not read; `selected` means the selected file is read in the committed slot, or fails `config.value.invalid` if missing/unreadable). Unless noted, optional files are present; for each `ci-disabled`, `no-git-root` or `selected-config` cell, place a present poisoned decoy where possible and assert **zero read attempts** for that layer. Repeat eligible `load` cells with the optional file removed to assert `missing` without reading that file. Read-attempt assertions distinguish a skip from a parsed-but-ignored source.

| CI | Git root / explicit root | Selection | Flags | System | User-global | Project-committed | Project-local |
|---|---|---|---|---|---|---|---|
| off | git / none | none | none | load | load | load | load |
| off | git / none | none | none; optional files absent | missing | missing | missing | missing |
| off | none / none | none | none | load | load | no-git-root | no-git-root |
| off | none / explicit | none | none | load | load | load | load |
| on | git / none | none | none | ci-disabled | ci-disabled | load | ci-disabled |
| on | none / none | none | none | ci-disabled | ci-disabled | no-git-root | ci-disabled |
| on | none / none | none | L | ci-disabled | ci-disabled | no-git-root | no-git-root |
| on | none / explicit | none | none | ci-disabled | ci-disabled | load | ci-disabled |
| on | none / explicit | none | L; local absent | ci-disabled | ci-disabled | load | missing |
| on | git / none | none | S only | load | ci-disabled | load | ci-disabled |
| on | git / none | none | U only | ci-disabled | load | load | ci-disabled |
| on | git / none | none | L only | ci-disabled | ci-disabled | load | load |
| on | git / none | none | S, U, L | load | load | load | load |
| on | git / none | none | S, U, L; system/user absent | missing | missing | load | load |
| off | none / none | selected | none | load | load | selected | selected-config |
| on | none / none | selected | none | ci-disabled | ci-disabled | selected | selected-config |
| on | none / explicit | selected | L only | ci-disabled | ci-disabled | selected | selected-config |
| on | git / none | selected | S only | load | ci-disabled | selected | selected-config |
| on | git / none | selected | U only | ci-disabled | load | selected | selected-config |
| on | git / none | selected | S, U, L | load | load | selected | selected-config |

In the selected rows, the selected file itself must be valid/present for `selected`; a missing or unreadable selected file is an error, **never** a `missing` skip. TC-CONFIG-006 covers CLI-vs-env selector choice and restriction/error controls. For CI outside git without root, local is `ci-disabled` unless L is set, when it is `no-git-root`; selected local remains `selected-config` even with L set. System/user remain independent of selection, root and each other's enable flags.

#### TC-CONFIG-006 - Selected-file slot

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-4, DM-2, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-sources.test.ts`, `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- Committed and local files, alternate selected file, brand-derived `${environmentPrefix}CONFIG` and recognized legacy selector, temp outside-git cwd, `CI=true` and explicit-root variants. Instrument reads of present/poisoned root local and of system/user files.

**Steps**:
1. Resolve with each selector alone, both selectors and `--config` together; repeat inside/outside git, with/without explicit root, CI on/off and local enable on/off, and with higher env/CLI field overrides. Assert `selected-config` for project-local in **every** selected case, zero local reads, and `ci-disabled` for system/user under CI unless each individually enabled, as in TC-CONFIG-005's overlap oracle.
2. Select missing and unreadable paths; inject invalid schema/forbidden secret into selected file; inspect skipped, read-count and origin facts. Test CI selection with system only, user only, both or neither re-enabled; selection must not alter their outcomes.

**Expected Outcome**:
- `--config` wins selector collisions; selected file occupies committed (not eighth) slot even outside git, local skips `selected-config` **before** CI/root/absence checks even when local is enabled, with zero local reads. Its actual path/line wins until higher layer overrides. Missing/unreadable selection yields `config.value.invalid` with no invented line, not `missing`; schema/secret restrictions still apply. Under CI, system/user are `ci-disabled` independently unless their respective flags enable them; neither root nor selection implicitly enables either or changes their `missing` outcomes when eligible but absent.

#### TC-CONFIG-007 - Malformed source

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F3-1, DM-3, NFR-2, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-sources.test.ts`, `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- Malformed YAML at known line after a valid value; layer identity and injected capture streams.

**Steps**:
1. Resolve as file adapter and run `config debug --json` plus human command; include a lower already-valid layer and later overriding value.
2. Assert exact classification, diagnostic fields and absence of any partial `data` or parsed prefix.

**Expected Outcome**:
- `config.file.malformed`, `kind=config`, safe layer and real available line, no raw snippet/stack; valid failure envelope and exit 1 for machine, human error stream for non-JSON, no uncaught crash or partial tree.

#### TC-CONFIG-008 - Reserved and extension input

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-1, DM-4, NFR-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-schema.test.ts`, `tests/behaviour/config-sources.test.ts`
**Tags**: @backend

**Preconditions**:
- Production schema plus typed extension schema; files carrying `$schema`, `reset`, `x-vendor`, invalid ordinary keys/types/null in separate cases.

**Steps**:
1. Validate accepted metadata and vendor extension; attempt unknown file and CLI ordinary keys, invalid reserved shapes, wrong type and disallowed null in each present layer including shadowed values.
2. Confirm both partial and final validators are invoked; inspect final keys and source origins.

**Expected Outcome**:
- `$schema` and `reset` validated but excluded; allowed `x-` file data persists; unknown ordinary file/CLI key `config.key.unknown`, invalid type/null/metadata `config.value.invalid`, invalid reset `config.reset.invalid`; no coercion or partial result.

#### TC-CONFIG-009 - Empty production, typed fixtures

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F3-3, DM-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-schema.test.ts`, `tests/structure/config-contract.test.ts`
**Tags**: @backend

**Preconditions**:
- Empty ordinary production catalog/defaults; separate typed fixture catalog with `x-test` nested/list/required/nullable/defaulted/deprecated/secret/path fields.

**Steps**:
1. Resolve production empty input with supplied bootstrap name; inspect production exported schema/defaults and basic result.
2. Invoke **that same public production resolver** with fixture catalog; supply required field in another layer, omit it for final-failure case, test typed default and explicit null permission.

**Expected Outcome**:
- Production tree is `{}` with no fabricated default or bootstrap origin; fixture defaults apply only to test catalog, nullable vs non-nullable and final required behave as declared, secret/path fields are not production ordinary keys; missing-required final failure has no invented node line.

#### TC-CONFIG-010 - YAML shapes and lines

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, AC-F3-4, DM-2, NFR-3, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-parser.test.ts`, `tests/fixtures/config/yaml/**`
**Tags**: @backend

**Preconditions**:
- Line-numbered real YAML fixtures: block multiline, flow map/list, nested sequence, empty collection and supported anchor/alias with reference on a different line.

**Steps**:
1. Parse each by the production file adapter, then resolve; compare exact value-node 1-based positions (including each array element and referenced alias position) to manually recorded fixture line expectations.
2. Reject duplicate/non-string keys, multiple documents, custom/executable tags, YAML 1.1 merge keys, non-JSON/cyclic values and excessive alias expansion; inspect safe position if available.

**Expected Outcome**:
- Only YAML 1.2 single unique-string-key mapping and JSON-compatible values pass; supported constructs preserve true value positions, unsupported constructs fail closed with safe layer/available position, no parser text or stack.

#### TC-CONFIG-011 - Partial, final and packed schema

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, DM-4, NFR-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-schema.test.ts`, `tests/structure/config-contract.test.ts`
**Tags**: @backend

**Preconditions**:
- Trusted nested fixture schema with required child, boolean/number/string, defaults and `$schema` metadata, built core package and shipped JSON schema.

**Steps**:
1. Supply required nested child only in later layer: each partial passes and final passes; omit child at final; submit string for boolean, extra ordinary property and external `$schema` URI.
2. Compare core `.` schema value byte/semantic parity with packed generated JSON artifact; verify no remote fetch, validator logger, input coercion, unknown-key removal or inserted default.

**Expected Outcome**:
- Recursive partial required relaxation only, strict final required enforcement, trusted draft-07 schema governs both; external metadata never selects a validator; invalid values fail, packed artifact equals exported schema.

#### TC-CONFIG-012 - Typed env and interpolation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-sources.test.ts`, `tests/behaviour/config-schema.test.ts`
**Tags**: @backend

**Preconditions**:
- Brand prefix and explicitly mapped typed nested `x-test` env field, untyped vendor data in file.

**Steps**:
1. Supply typed `${environmentPrefix}X_TEST__NESTED__COUNT` and malformed conversion; add unknown prefixed name and unregistered vendor-prefixed name.
2. In separate files supply `{env:...}` and literal `${VAR:-default}` even when shadowed by env/CLI.

**Expected Outcome**:
- Declared `__` nesting converts to catalog type; invalid conversion `config.value.invalid`, unmapped prefixed names `config.environment.unmapped`, both interpolations `config.interpolation.rejected` before merge; no implicit `x-` env/flag access.

#### TC-CONFIG-013 - Forbidden sources

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-4, NFR-2, NFR-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-restrictions.test.ts`
**Tags**: @backend

**Preconditions**:
- Typed fixture secret (env-only, no default) with unregistered canary; typed machine path (system/user only); each of seven source slots including both repository files.

**Steps**:
1. Place secret separately in defaults, system, user, committed, gitignored local and CLI, with/without strict and later valid env shadow/reset; supply it through mapped environment as positive control.
2. Place machine path in each disallowed layer, plus system/user positive controls; inspect result and both streams.

**Expected Outcome**:
- Every non-env secret fails `config.secret.forbidden` even if shadowed/reset; allowed env value wins without exposing raw canary. Machine path only allowed in system/user-global, otherwise `config.path.forbidden`; no partial result or canary bytes.

#### TC-CONFIG-014 - Frozen branding bootstrap

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, AC-F4-3
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-bootstrap.test.ts`
**Tags**: @backend

**Preconditions**:
- Two valid distinct working names, neutral override `DELIVERY_OS_WORKING_NAME`, a name whose prefix overlaps the neutral name, brand selector and legacy mapped selector; spy on branding resolver and file discovery.

**Steps**:
1. Supply working name and neutral override; assert one branding resolution precedes discovery and fixes directory/prefix. Insert file key attempting to rename bootstrap; add recognized selector/override and unrelated prefixed key.
2. Supply missing, empty, whitespace/invalid name or invalid override; compare existing branding error contract.

**Expected Outcome**:
- Exactly one frozen identity, no rediscovery or ordinary bootstrap key; only recognized neutral override, selector and legacy mappings excluded even under overlap; unrelated prefixed key fails `config.environment.unmapped`; invalid bootstrap returns established echo-free branding failure, no default identity.

#### TC-CONFIG-015 - Debug/get winning origin

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-2, NFR-3, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- Line-stable file and typed default fixtures, declared env/flag overrides, one missing and one CI-disabled file; production CLI command with injected streams.

**Steps**:
1. Run `config debug`, `config --debug` and `config get x-test.nested.count --show-origin` for each winning layer; compare debug and get origin strings.
2. Request unknown key; inspect loaded-files and skipped-layer evidence.

**Expected Outcome**:
- Exact file origin grammar uses the actual positive 1-based line (default label `core/src/config/defaults.ts` with real manifest/fixture line); env/flag origins have no file/line; unknown get fails, never empty success; debug names every loaded file and the exact first-match skipped reason from TC-CONFIG-005, with no loaded record for skipped sources.

#### TC-CONFIG-016 - Safe warnings and strict

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-resolver.test.ts`, `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- Fixture deprecated field and separately shadowed field with non-sensitive values; a canary shadowed value for warning hygiene.

**Steps**:
1. Resolve both under default mode and `--strict`; capture warning sink and machine/human outputs.

**Expected Outcome**:
- Safe warnings for deprecated and shadowed inputs; strict produces `config.warning.strict` with exit 1 and no partial output. Warning text never includes offending value, raw summary or canary.

#### TC-CONFIG-017 - Origin replacement and manifest drift

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-2, NFR-3, NFR-9
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-provenance.test.ts`, `tests/checks/config-default-positions.test.ts`
**Tags**: @backend

**Preconditions**:
- Distinct-line nested/flow/multiline/list/empty/alias fixtures; typed default fixture with actual declaration lines; shipped defaults position manifest.

**Steps**:
1. Recursively merge map, replace list, reset branch, alias a value and inspect each effective leaf, array index, empty collection and effective container position; compare fixture line numbers by reading source fixture, not fabricated positions.
2. Check packed manifest against defaults source; in an isolated **copy**, insert a line before a tracked source anchor and require the source/manifest parity check to fail, then compare unchanged control. For the typed default fixture, insert a line above its declaration in a copy and require its recorded position to change; verify production empty defaults create no origin.

**Expected Outcome**:
- Preserved unaffected origins, list elements entirely replaced, reset descendants gone, alias uses referenced value's line, only effective containers retain their own positions; line-insertion mutation fails by identifying drift; no stale or invented default lines.

#### TC-CONFIG-018 - Human inspection

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-6, AC-F6-1, DM-1, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-cli.test.ts`, `tests/golden/config-output.test.ts`
**Tags**: @backend

**Preconditions**:
- Real config command program and injected output/error sinks, empty production baseline and typed fixture for nonempty values.

**Steps**:
1. Run basic, `debug`, `--debug`, `get`, `get --show-origin`; parse each success stdout as one JSON value/document; run unknown key and malformed file as human failures.

**Expected Outcome**:
- Basic stdout plain tree (`{}` in empty production), debug object has exactly `config`, `origins`, `loadedFiles`, `skippedLayers`, get gives value or `{key,value,origin}`; origins cover displayed effective leaves/collections. No machine envelope without `--json`; human diagnostics use stderr via redaction path.

#### TC-CONFIG-019 - Machine envelope and redaction

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-4, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/config-output.test.ts`, `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- `assertEnvelopeContract` from testkit; injected run ID/ticks, registered env canary with quote/backslash/newline variants, unregistered prohibited file canary.

**Steps**:
1. Run basic/debug/get/origin success and malformed/restriction/strict failures under `--json`; capture every stdout/stderr write and compare same redacted data to human forms.
2. Parse exactly one stdout JSON document; assert envelope key set, timing, run ID, one of `data`/`error`, projected exit and canary absence in raw and JSON-escaped bytes.

**Expected Outcome**:
- One GH-172 envelope per invocation, success `data` equals selected human payload, failures only `error`; exit in {0,1,2} (config failures 1), no second bare document or exposed canary on either stream; no alternate stream-write bypass.

#### TC-CONFIG-020 - Exact code plus kind

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/error-classification.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`
**Tags**: @backend

**Preconditions**:
- Machine `ERROR_TABLE` and documented result-contract table; existing provider/input singleton fixtures.

**Steps**:
1. For each **exact** code `config.file.malformed`, `config.key.unknown`, `config.environment.unmapped`, `config.value.invalid`, `config.interpolation.rejected`, `config.secret.forbidden`, `config.path.forbidden`, `config.reset.invalid`, `config.warning.strict`, drive its trigger via TC-002/006–008/012/013/016 and classify both returned and thrown `kind=config` failures.
2. Assert each distinct row's category=user, retryable=false, consequence=not_landed, projection=user-validation/exit 1, exact spec summary/remediation; test provider/input kind-only regression, config kind-only ambiguity, absent/unknown/mismatched codes from thrown and returned failures.
3. Mutate machine-only then documentation-only row in isolated copies and run bidirectional sync; check source references and no first-config-row fallback.

**Expected Outcome**:
- 9/9 exact `(kind,code)` identities, one complete machine and documented row each; kind-only singleton works; malformed config discriminator safely yields `fallback.internal`/exit 2, never arbitrary config entry or uncaught throw; either drift direction fails.

#### TC-CONFIG-021 - Parser debug-switch guard

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, AC-F6-4, NFR-4, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-parser.test.ts`, `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- Actual Node-selected YAML parser entry behind production adapter; source-text canary **not registered** as a secret; isolated subprocess/host-switch harness for actual environment, with controlled stdout/stderr capture.

**Steps**:
1. In separate isolated processes set actual `LOG_TOKENS` then `LOG_STREAM` to nonempty, attempt file read; assert parser invocation spy/counter remains zero and both human/`--json` outputs are safe.
2. Run empty/unset switches as positive parser-read control; avoid mutating parent host environment or monkeypatching global console in production.

**Expected Outcome**:
- Both switches reject **before parse** as `config.value.invalid`/exit 1, without parser tokens, canary, snippet, stack or input summary in any stream; ordinary read succeeds with both switches unset.

#### TC-CONFIG-022 - Unregistered secret error canaries

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, AC-F6-5, NFR-4, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-cli.test.ts`, `tests/golden/config-output.test.ts`
**Tags**: @backend

**Preconditions**:
- Different unique unregistered file-secret canary per case, including newline, quote and escaped/backslash variants; no registration in edge secrets; typed secret fixture for restriction case.

**Steps**:
1. Plant canary in malformed YAML, invalid schema/type, forbidden file secret and deprecated/shadowed strict-warning files; execute human basic/debug/get failure and `--json` counterparts through production command path.
2. Search captured stdout/stderr for literal and serialized/escaped canary forms; inspect error summary/remediation/origins and absent success data.

**Expected Outcome**:
- Zero leaks and no partial data across all cases/modes; errors use constructed safe text, never untrusted parser/validator summary, offending value or stack; registered-env-only redaction is insufficient to satisfy this case.

#### TC-CONFIG-023 - Pure resolver and brand variants

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-3, NFR-1, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-resolver.test.ts`, `tests/boundaries/**`
**Tags**: @backend

**Preconditions**:
- Same injected plain source facts and two different valid branded identities; controlled repeated clock/process env/filesystem contexts.

**Steps**:
1. Resolve identical facts repeatedly with ambient context changed; compare values and origins, then re-run discovery with second identity.
2. Run ambient-globals/boundary negative fixtures; verify no core adapter/branding import and directory/prefix derive only from `BrandIdentity`.

**Expected Outcome**:
- Resolver output is deterministic under ambient changes; source acquisition adapts to supplied brand, no product literal or ambient core read; prohibited import fixture fails.

#### TC-CONFIG-024 - Legacy once and current wins

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DM-3, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/legacy-adapter.test.ts`, `tests/behaviour/config-cli.test.ts`
**Tags**: @backend

**Preconditions**:
- Existing pre-freeze names and current mapped names for same selector/key; controlled process-scoped injected warning sink and capture streams.

**Steps**:
1. Acquire legacy and current collisions with old-only/current-only controls; invoke twice in one process; run separate no-legacy control process; capture warning path in human and machine modes.
2. Inspect adapter/CLI imports and calls for credential, transport, sidecar or remote execution.

**Expected Outcome**:
- Current names win, legacy-only values map via compatible port, exactly one safe warning per process when used and zero otherwise, routed through existing redacted output chokepoint rather than console default; no credential or mediated adapter action.

#### TC-CONFIG-025 - Packed API and boundary gates

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, DM-3, DM-4, NFR-6, NFR-9
**Test Type(s)**: Contract, Integration, Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/config-contract.test.ts`, `tests/boundaries/**`, `tests/checks/**`
**Tags**: @backend

**Preconditions**:
- Built packed core/adapters with `dist` and existing published subpaths; proposed runtime dependency registry/lock closure, CI baseline and owner-review record.

**Steps**:
1. Import packed core `.` resolver/schema and core `./contracts` ConfigSource type in both Node and Bun; import adapters `./file`, `./repo`, `./legacy`; inspect packed schema and defaults manifest parity. Reject attempted `./config` or new adapters subpath.
2. Run boundary/ambient/entrypoint negative fixtures and mechanical license audit including accurate direct/runtime/transitive/multi-use closure, vulnerability gate, exports/publint/attw, forbidden-literals and docs review; inspect absence of runtime YAML/Node helpers in core.
3. At orchestrator PR handoff verify pushed HEAD has all `ts-*` and bash CI jobs green and PR targets `main-tools`; record Proposed TDR and truthful proposed license accounting for owner merge/adoption decision, without claiming owner approval.

**Expected Outcome**:
- Portable packed imports and artifacts through existing entries only, source facts plain JSON-compatible and core runtime-neutral; mechanical checks pass before PR handoff. Human license/R2 acceptance remains pending owner review before merge/adoption; no credential port or sidecar implementation.

## 6. Environments and Test Data

- Bun pinned by root/CI, Node for packed-import parity; `pnpm install --frozen-lockfile` and `pnpm build` before tests that resolve dist. Test-platform facts for Linux/macOS/Windows are injected or temp-rooted; no dependency on actual `/etc`, `%APPDATA%`, workstation HOME or developer secrets. CI-mode fixtures explicitly control `CI=true`, each independent re-enable flag, selected-file priority and explicit-root eligibility; instrument reads of skipped layers as well as debug evidence.
- Place committed YAML fixtures with deliberately recorded line numbers under `tests/fixtures/config/yaml/**`, typed catalog cases under `tests/fixtures/config/**` or test modules. Production public resolver/schema is the system under test, even with fixture catalogs. Synthetic `x-test` keys and deliberately distinct brand names are test inputs, not shipped defaults or new production config keys.
- Use per-test disposable git-root trees with nested cwd, above-root decoys, selected file and gitignored local file; isolate process-wide legacy warning and YAML `LOG_TOKENS`/`LOG_STREAM` switch checks in subprocesses. Clean up temporary roots, snapshots and subprocesses; mutation tests edit **copies** only. Do not expose real secrets: use unregistered distinctive canaries, assert both raw and JSON-escaped variants absent in captured streams; include a registered env-secret positive control.
- Default source manifest test checks actual positions/source drift against `packages/core/src/config/defaults.ts` (shipped origin label `core/src/config/defaults.ts`) and line-insertion mutation in isolated copy, not a hardcoded guessed source line. Because the production defaults are empty, the source-drift control must fail on an insertion even with zero current value entries; a separate typed fixture tests actual default-leaf lines. CLI uses injected streams/run IDs/ticks where possible; actual host-switch checks use isolated processes to exercise upstream guard.

## 7. Automation Plan and Implementation Mapping

All rows are **To Implement** except stated updates; path names are proposed test locations under the strategy, not claims that tests already exist. Run `pnpm build` before targeted Bun suites when package-name imports resolve via dist; `bun test <file>` executes the corresponding mapped test after implementation.

| TC | Test location / command (after build) | Control / status |
|---|---|---|
| TC-CONFIG-001 | `tests/behaviour/config-resolver.test.ts` / `bun test tests/behaviour/config-resolver.test.ts` | injected seven layers; To Implement |
| TC-CONFIG-002 | `tests/behaviour/config-resolver.test.ts` / same | invalid reset and shadowed control; To Implement |
| TC-CONFIG-003 | `tests/behaviour/config-sources.test.ts` / `bun test tests/behaviour/config-sources.test.ts` | platform path facts; To Implement |
| TC-CONFIG-004 | `tests/behaviour/config-sources.test.ts` / same | root bounds/decoys; outside-git and explicit-root first-match reasons, read counts; To Implement |
| TC-CONFIG-005 | `tests/behaviour/config-sources.test.ts` / same | exact DM-2 overlap oracle above, independent flags, eligible/missing and zero-read negative controls; To Implement |
| TC-CONFIG-006 | `tests/behaviour/config-sources.test.ts`, `config-cli.test.ts` / `bun test tests/behaviour/config-sources.test.ts tests/behaviour/config-cli.test.ts` | selector priority and selected-config first, CI/root/flags overlap and selected error/non-read controls; To Implement |
| TC-CONFIG-007 | `tests/behaviour/config-sources.test.ts`, `config-cli.test.ts` / same | real malformed file; To Implement |
| TC-CONFIG-008 | `tests/behaviour/config-schema.test.ts` / `bun test tests/behaviour/config-schema.test.ts` | partial/final fixtures; To Implement |
| TC-CONFIG-009 | `tests/behaviour/config-schema.test.ts`, `tests/structure/config-contract.test.ts` / `bun test tests/behaviour/config-schema.test.ts tests/structure/config-contract.test.ts` | production vs test catalog; To Implement |
| TC-CONFIG-010 | `tests/behaviour/config-parser.test.ts` / `bun test tests/behaviour/config-parser.test.ts` | real YAML fixtures; To Implement |
| TC-CONFIG-011 | `tests/behaviour/config-schema.test.ts`, `tests/structure/config-contract.test.ts` / corresponding `bun test` | packed schema parity; To Implement |
| TC-CONFIG-012 | `tests/behaviour/config-sources.test.ts` / `bun test tests/behaviour/config-sources.test.ts` | typed env fixtures; To Implement |
| TC-CONFIG-013 | `tests/behaviour/config-restrictions.test.ts` / `bun test tests/behaviour/config-restrictions.test.ts` | seven-source matrix; To Implement |
| TC-CONFIG-014 | `tests/behaviour/config-bootstrap.test.ts` / `bun test tests/behaviour/config-bootstrap.test.ts` | branding spy; To Implement |
| TC-CONFIG-015 | `tests/behaviour/config-cli.test.ts` / `bun test tests/behaviour/config-cli.test.ts` | real command/injected sinks; To Implement |
| TC-CONFIG-016 | `tests/behaviour/config-cli.test.ts`, `config-resolver.test.ts` / corresponding `bun test` | safe warnings; To Implement |
| TC-CONFIG-017 | `tests/behaviour/config-provenance.test.ts`, `tests/checks/config-default-positions.test.ts` / `bun test tests/behaviour/config-provenance.test.ts tests/checks/config-default-positions.test.ts` | source-copy mutation; To Implement |
| TC-CONFIG-018 | `tests/golden/config-output.test.ts`, `tests/behaviour/config-cli.test.ts` / corresponding `bun test` | human goldens; To Implement |
| TC-CONFIG-019 | `tests/golden/config-output.test.ts` / `bun test tests/golden/config-output.test.ts` | envelope validator + canaries; To Implement |
| TC-CONFIG-020 | `tests/behaviour/error-classification.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` / `bun test tests/behaviour/error-classification.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` and `bun run scripts/checks/error-table-sync.ts` | 9 triggers + drift; Existing – Update |
| TC-CONFIG-021 | `tests/behaviour/config-parser.test.ts` / `bun test tests/behaviour/config-parser.test.ts` | two isolated host switches; To Implement |
| TC-CONFIG-022 | `tests/behaviour/config-cli.test.ts`, `tests/golden/config-output.test.ts` / corresponding `bun test` | unregistered canaries; To Implement |
| TC-CONFIG-023 | `tests/behaviour/config-resolver.test.ts`, `tests/boundaries/**` / `bun test tests/behaviour/config-resolver.test.ts tests/boundaries` and `pnpm check:boundaries` | ambient negative fixtures; To Implement |
| TC-CONFIG-024 | `tests/behaviour/legacy-adapter.test.ts`, `tests/behaviour/config-cli.test.ts` / `bun test tests/behaviour/legacy-adapter.test.ts tests/behaviour/config-cli.test.ts` | process warning; Existing – Update |
| TC-CONFIG-025 | `tests/structure/config-contract.test.ts`, `tests/boundaries/**`, `tests/checks/**` / `bun test tests/structure/config-contract.test.ts tests/boundaries tests/checks`; `pnpm check` plus CI gates in §4 | packed Node/Bun, dependency closure, manual PR/owner gate; Semi-automated / To Implement |

Gate evidence to record later (not run now): exact commands, SHA, statuses and fail logs in §10; local `git diff --check`, focused tests, full `pnpm check`, `pnpm build` then `bun run scripts/checks/exports-discipline.ts`, `pnpm exec publint` and `pnpm exec attw --pack . --profile esm-only` on five publishables (as in CI), pins, publish guard, license audit, vulnerability gate, forbidden-literals, bidirectional error-table sync; confirm CI `ts-fresh-clone`, `ts-invariants`, `ts-typecheck`, `ts-lint`, `ts-format`, `ts-test`, `ts-boundaries`, `ts-build`, `ts-exports`, `ts-pins`, `ts-publish-guard`, `ts-license-audit`, `ts-vuln`, `ts-aggregate`, `ts-commitlint`, `ts-forbidden-literals` and `bash-tests` green on pushed HEAD. Also retain remaining required bash/doc CI checks; no gate waived by proposed license entries. A shell/tool file changed unexpectedly needs its corresponding `.tests/test-*.sh` (strategy), not an assumed N/A. The spec §18 open-PR DoD requires passing traceable evidence for all 25 ACs and all nine NFR thresholds, executable negative and positive controls (including DM-2 non-reads), current docs/review, packed Node/Bun/schema/default artifacts, minor release intent and green required pushed-HEAD jobs. Do not record unrun evidence as passing; human TDR/license acceptance gates merge/adoption only.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- Actual YAML parser logging may preempt safe errors: TC-CONFIG-021 asserts host switches block **before** parser invocation, not only that terminal output happens to look redacted. Unregistered malformed-file canaries in TC-CONFIG-022 catch early parse failures.
- Fixture-only resolver mock would create false confidence: TC-CONFIG-001/009/017 exercise production exports; temp files pass through production adapter. Default-manifest mutation and Node/Bun packed imports prevent source-position or packaging illusions.
- GH-172 currently forwards handler-provided summaries and human output only handles diagnostics; TC-CONFIG-018/019/020/022 require real command integration and safe constructed config failures through the **single** output chokepoint, not merely direct `redact()` assertions.
- License registry originally models development-only rows; TC-CONFIG-025 requires truthful proposed direct/runtime/transitive/multi-use closure and mechanical failure controls, without treating proposed entries as owner approval.

### 8.2 Assumptions

- The accepted ADR and current GH-172 projection resolve ticket shorthand as documented in the spec: CI disables project-local only when no file is selected and its own flag is unset; when selected it reports `selected-config` first. Distinct malformed identity is a code, not a new numeric exit. Empty ordinary production catalog/defaults are intentional; bootstrap requires caller-supplied working name.
- The implementation plan was absent at initial authoring but is now linked; its phases 1–5 and 8 retain these proposed test targets and final handoff gates. If delivery changes paths, preserve TC identity and AC coverage when reconciling.
- TDR-0003 remains Proposed. Sidecar mediated adoption is documentation-only: later M0-S12 owns the credential port; unchanged primitive ports permit direct and mediated adapters later. No credential sourcing in this slice.

### 8.3 Open Questions

| Item | Owner / timing | Blocking? |
|---|---|---|
| OQ-1 from spec: acceptance of Proposed TDR-0003 and exact runtime/closure licensing (including BSD-3-Clause). | Human owner at PR review, before merge/adoption; consult `@decision-advisor` if selection rejected. | **Not** a branch delivery or unmerged-PR blocker; acceptance needed before merge/adoption. |
| Conditional upstream runtime code-generation limitation: if evidenced by actual host/Node/Bun packing tests, revisit proposed TDR rather than choosing an unreviewed alternative. | PM/decision advisor upon failed TC-CONFIG-025. | Conditional implementation/design escalation; no assumed gap or waiver. |

No other spec requirement lacks a mapped test; no ungrounded requirements or invented production config keys are accepted.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-30T06:33:54Z | Change Test Plan Writer | Initial 25/25 AC traceability; production resolver fixtures, security and provenance controls; no execution claimed. |
| 1.1 | 2026-10-30T07:11:22Z | Change Test Plan Writer | DoR iteration 1: aligned TC-CONFIG-004–006 and debug evidence with spec DM-2 first-match overlap/non-read oracle; linked existing implementation plan and spec open-PR DoD; retained all 25 TC/AC IDs and execution history. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests; executor records per-TC and pushed-HEAD CI evidence here. |
