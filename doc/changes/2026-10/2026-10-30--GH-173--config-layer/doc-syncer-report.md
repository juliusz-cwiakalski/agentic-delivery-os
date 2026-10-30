---
id: GH-173-doc-syncer-report
work_item: GH-173
phase: system_spec_update
status: Complete
created: 2026-10-30T14:53:21Z
last_updated: 2026-10-30T14:53:21Z
owners: [engineering]
links:
  change_spec: ./chg-GH-173-spec.md
  plan: ./chg-GH-173-plan.md
  test_plan: ./chg-GH-173-test-plan.md
---

# Doc-Sync Report — GH-173 (M0-S4 Config Layer)

## Status

`SUCCESS` — current-truth documentation reconciled against the delivered M0-S4 implementation.

## Scope Verified

### 1. Configuration feature spec vs actual implementation

Verified `doc/spec/features/feature-config-layer.md` against:

- `packages/core/src/contracts/config.ts` — layers, facts, origins, skips, warnings, failure identity and the `ConfigSource` port.
- `packages/core/src/config/{catalog,defaults,schema,resolver,provenance}.ts` — empty production catalog/defaults, bootstrap descriptor, trusted draft-07 partial/final schema, merge/reset, restrictions and origins.
- `packages/adapters/src/file/{config-source,yaml-parser}.ts` and `packages/adapters/src/repo/index.ts` — platform paths, bounded root discovery, DM-2 first-match evidence, selected-file committed slot, zero reads for skipped sources, YAML 1.2 parsing, bounds, positions and safe diagnostics.
- `packages/adapters/src/legacy/index.ts` — pre-freeze environment/selector mapping with current names winning and one safe notice per process.
- `packages/cli/src/edge.ts` — brand resolved once before discovery, source/legacy composition, secret registration and shipped defaults-manifest injection.
- `packages/cli/src/commands/config.ts` and `packages/cli/src/index.ts` — basic/debug/get modes, unknown-key failure, human/machine payloads, warning/diagnostic stream split and `CommandResult` wrapping.
- `packages/cli/src/output/serialize.ts` — single redaction/serialization chokepoint.
- `packages/core/src/contracts/error-table.ts` — nine `config.*` rows plus the two fallback containment rows.

Confirmed accurate: seven-layer order, platform locations, CI and enable-flag behavior, selected-file behavior, DM-2 skip order, schema wrappers and restrictions, empty production catalog/defaults, reset and warning semantics, origin grammar, command payloads, redaction, fallback containment, the M0-S12 credential deferral, documentation-only mediated adoption, and Proposed TDR-0003 wording.

### 2. Result contract and error table

Verified `doc/spec/features/feature-result-contract.md`:

- All nine config rows match `ERROR_TABLE` field-for-field: `config.file.malformed`, `config.key.unknown`, `config.environment.unmapped`, `config.value.invalid`, `config.interpolation.rejected`, `config.secret.forbidden`, `config.path.forbidden`, `config.reset.invalid`, `config.warning.strict`.
- Documented rows and machine rows are 13/13 synchronized in both directions.
- The `(kind, code)` discriminant invariant, kind-only singleton behavior, `config` code requirement and `fallback.internal` containment match `classify.ts` and `runCli`.

### 3. Branding, scaffold and glossary statements

Verified post-change statements in:

- `doc/spec/features/feature-branding-seam.md` — M0-S4 consumes `ResolverInput`/`resolveBrandIdentity` without reshaping the contract and uses `configDirectoryName` and `environmentPrefix`.
- `doc/spec/features/feature-monorepo-scaffold-toolchain.md` — configuration tier implemented separately from the declaration-only `createRuntime`; config/adapter/CLI code and runtime-closure registry wording are accurate.
- `doc/overview/glossary.md` — composition root, empty-but-enforced, domain kinds, configuration-layer, `ConfigSource`, DM-2 and origin entries are accurate.

### 4. Indexes and links

- `doc/decisions/00-index.md` already lists TDR-0003 and its link resolves.
- `doc/00-index.md` reaches the feature-spec area through the System Spec index; the new config spec is additionally linked from the glossary, branding, scaffold and result specs.
- All relative Markdown links in the changed docs resolve.

### 5. Product-free wording and distribution

- `scripts/checks/forbidden-literals.ts`: 5/5 scope classes, 0 violations.
- `scripts/.tests/test-doc-distribution.sh`: no drift across 80 in-scope docs.

## Gaps Fixed

Only `doc/spec/features/feature-config-layer.md` required reconciliation:

- Scoped vendor data to **top-level** `x-` keys, matching schema generation.
- Added the unknown `config get` key failure (`config.key.unknown`) to the inspection contract.
- Clarified that **catalog-designated** file secrets are rejected before merge; arbitrary file values are not silently classified as secrets.
- Documented optional safe failure location metadata (`layer`, `key`, `file`, `line`) and the no-source-text rule.
- Named the actual packed artifacts: `config.schema.json`, `defaults-positions.json`, `schema-sources.json`.
- Documented the legacy compatibility notice path to the error stream.
- Made the M0-S12 deferral exact (credential resolution/keyring/sidecar) and marked provider routing/state storage as later consumer stories; described direct and mediated adapters as a later adoption path.

## Verification Commands

| Check | Result |
|---|---|
| `bun run scripts/checks/error-table-sync.ts` | `entries=13 documented=13`; source, documented table and fixtures agree |
| `bun test tests/checks/error-table-sync.test.ts` | 22 pass, 0 fail |
| Targeted config suites (behaviour, golden, structure, artifact parity) | 78 pass, 0 fail, 511 expectations |
| `bun run scripts/checks/forbidden-literals.ts` | 0 violations |
| `bash scripts/.tests/test-doc-distribution.sh` | 80 docs; no drift |
| Relative Markdown link check over changed docs | All links resolve |

## Residual Documentation Gaps

None. Current-truth configuration, result/error, branding, scaffold, glossary and index links describe the delivered system.

## Spec Coverage Gaps

None. The configuration capability is covered by the reconciled `doc/spec/features/feature-config-layer.md`; its QA strategy covers the delivered behaviour and packed artifacts. No additional feature or test spec is required for this change.

## Handoff

Ready for Finalization. No source, test, plan, spec-requirement, test-plan, or PM-note files were modified. No git operations were performed.
