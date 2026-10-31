---
id: GH-181-doc-syncer-report
work_item: GH-181
phase: system_spec_update
status: Complete
created: 2026-10-30T00:00:00Z
last_updated: 2026-10-30T00:00:00Z
owners: [engineering]
links:
  change_spec: ./chg-GH-181-spec.md
  plan: ./chg-GH-181-plan.md
  test_plan: ./chg-GH-181-test-plan.md
---

# Documentation Sync Report — GH-181

## Status

`SUCCESS`

Change artifacts resolved from `doc/changes/2026-10/2026-10-30--GH-181--primitive-ports-credential-metadata/`: `chg-GH-181-spec.md` (v1.1, DEC-1..DEC-9), `chg-GH-181-test-plan.md` (v1.1), `chg-GH-181-plan.md`, and `readiness-review/readiness-iter-1.md`. Implementation ground truth was read from `git diff origin/main-tools..HEAD` and the delivered source, not from the change prose alone.

## Files created

| File | Reason |
|------|--------|
| `doc/spec/features/feature-adapter-ports.md` | First feature spec for the adapter-port area: nine typed primitive ports, capability/gap and carrier declarations, the credential port and environment-backed implementation, the secret-read boundary invariant, the `delivery.metadata.v1` envelope and codec, degradation semantics, and the `config.credential.missing` integration. Authored from the delivered implementation; current-truth only. |

## Files updated

| File | Reason |
|------|--------|
| `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Replaced "other runtime contracts remain scaffold placeholders" with the implemented configuration/result/adapter-port surfaces; added the `./credentials` adapters subpath; added `credentials` to the runtime-API confinement exemption; documented the four-stage `check:boundaries` chain and the new secret-read boundary gate; recorded the `tests/types` type-probe project in the root `typecheck`; extended the technical map, QA strategy, CI coexistence, and related-doc links; added GH-181 traceability. |
| `doc/spec/features/feature-config-layer.md` | Reconciled credential wording to the delivered split capability: configuration still owns no credential acquisition, while the credential port lives in the new adapter-ports feature; clarified that `config.credential.missing` is a credential-resolution row under the config domain kind, not a configuration-layer failure; updated packaged-consumer and limitations wording; added GH-181 traceability and cross-links. |
| `doc/spec/features/feature-result-contract.md` | Added GH-181 traceability and recorded the adapter-port substrate as a consumer of the `config.credential.missing` identity and redaction boundary. Verified the documented table matches the machine table (14/14 entries, including the credential row); no row prose or count changes were required. |
| `doc/overview/glossary.md` | Added `Adapter capability declaration`, `Carrier`, `Credential reference`, `Credential port`, `Graceful degradation`, `Metadata envelope`, `Primitive port`, and `Secret-read boundary`; updated `Runtime-API confinement` and `Empty-but-enforced`; added GH-181 traceability and the new feature spec to "See also". |
| `doc/planning/concepts/primitive-catalogue.md` | Moved the nine adapter-interaction rows from Planned to Typed, linked each change to GH-181 per the catalogue maintenance rule, and updated the "Planned throughout" note; all other rows remain Planned. |
| `scripts/checks/forbidden-literals.registry.json` | Registered the new user-facing feature spec in the forbidden-literal scan scope, as the registry requires for any doc absent at the corpus baseline. This is check metadata, not source or delivery code. |

## Verified without change

| Area | Finding |
|------|---------|
| `doc/00-index.md` | The index links the `spec/` area as a whole; it does not enumerate individual feature specs, so there is no per-spec entry to add. |
| Feature-spec indexes | No repository index enumerates individual feature specs; the glossary "See also" and feature cross-links are the discovery paths and were updated. |
| `AGENTS.md` | Repo-structure and command sections remain accurate: the secret-read check joined existing chains and added no new command or job; no agent/command definitions changed. |
| `doc/guides/**` | No guide references the prior "no primitive ports" or placeholder state; no stale credential or adapter-port claims found. |
| `doc/quality/**` | No shipped test spec corresponds to this capability; the feature QA strategy and the change test plan carry the evidence map. |
| `doc/decisions/**` | No decision record was created or amended in this change; placement and selection decisions remain in the change spec decision log, and ADR-0003 still governs package placement. |

## Spec-coverage gap resolution

The adapter-port capability area had no feature spec. `spec_coverage_gaps` was therefore:

- Adapter ports, credential resolution, embedded metadata, and the secret-read boundary — no `doc/spec/features/feature-*.md`.

Resolved in-change by authoring `doc/spec/features/feature-adapter-ports.md` (first spec for the area). The feature spec is current-state prose and does not restate change history; it derives structure from the existing feature specs and `doc/templates/feature-spec-template.md`.

## Documentation gaps resolved

- Missing first feature spec for the adapter-port substrate.
- Stale scaffold wording that treated all non-configuration contracts as placeholders.
- Missing `./credentials` subpath and `credentials` confinement entry in the boundary documentation.
- Missing secret-read boundary gate in the local and CI boundary chain description.
- Missing `tests/types` type-probe step in the typecheck description.
- Stale configuration-layer wording that deferred credential resolution entirely to a future story.
- Missing repository glossary terms for the adapter-port substrate.
- Stale primitive-catalogue rows still marked Planned after typing.

## Residual documentation gaps

None. Current-truth documentation covers the delivered ports, credential implementation, envelope codec and degradation behavior, secret-read invariant, error-row integration, type-probe chain, and catalogue status.

## Validation

- `bash scripts/.tests/test-doc-distribution.sh` → `no drift — 80 in-scope docs; install set matches ados_distribution markers`.
- `bun run scripts/checks/forbidden-literals.ts` → `OK: 5/5 scope classes scanned, 0 violations` (the new feature spec is registered and literal-clean).
- `bun run scripts/checks/error-table-sync.ts` → `entries=14 documented=14`; `OK`.
- `ados_distribution` markers preserved on all in-scope docs; the new feature spec lives under `doc/spec/features/` (outside the marker-required scan set, matching the existing feature specs).
- Traceability: `links.related_changes` now includes `GH-181` in `feature-monorepo-scaffold-toolchain.md`, `feature-config-layer.md`, `feature-result-contract.md`, and `doc/overview/glossary.md`; the new feature spec carries `GH-181`; the catalogue links the GH-181 change spec from each Typed row.
- Relative links in every changed document resolve.
- No license headers were added.
- No source code, `.opencode/`, `.ados-claude/`, `tools/`, or bash scripts were touched.
- No change artifact (spec, plan, test plan, pm-notes) was modified. The pre-existing working-tree modification to `chg-GH-181-pm-notes.yaml` was left untouched.

## Next Step

Ready for Finalization.

## Addendum — Remediation Delta (2026-10-30)

Scope: current-truth reconciliation of the three review-remediation code fixes landed after the original sync (`git diff f6a5d50..HEAD -- packages scripts tests`).

| Fix | Change | Documentation outcome |
|-----|--------|----------------------|
| R-1 (`da1b00a`) | `scripts/checks/secret-read-boundary.ts` fails closed on element access with a non-literal key on `process`, `Bun`, `Deno`, or `globalThis`; new negative fixtures cover computed-key, template-key, and computed-global-name forms. | **Patched.** Both form-coverage sentences asserted literal-key-only element access, so they were stale. `feature-adapter-ports.md` and `feature-monorepo-scaffold-toolchain.md` now state the computed/template-key fail-closed rule, the `globalThis` host, and the added fixture coverage. |
| R-2 (`e45207e`) | `packages/adapters/src/io/envelope-codec.ts` caps the marker payload scan at `ENVELOPE_MAX_BYTES` characters; an over-cap marker does not match and degrades as `missing`. | **No change needed.** `feature-adapter-ports.md` already documents the bound, the linear-scan rationale, and the `missing` degradation, consistent with the F-5 degradation taxonomy (`missing` = no envelope found; never a flow failure). |
| R-3 (`a12bbc5`) | Strip rebuilds from non-overlapping spans in one pass over the untouched input; a nested lookalike inside a stripped marker is payload content. | **No change needed.** The spec described only the outcome (every marker removed, no residue or extra blank line) plus lookalike-inside-payload behavior, which remains accurate; no stale-index or ordering claim existed. |

Consistency checks:

- Grep over current-truth docs (`doc/**` excluding `doc/changes/**` and `doc/inception/**`) found no remaining literal-key-only invariant claim, no unbounded-scan claim, and no stale-index strip description.
- `bash scripts/.tests/test-doc-distribution.sh` → `no drift — 80 in-scope docs; install set matches ados_distribution markers`.
- `bun run scripts/checks/forbidden-literals.ts` → `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`.
- No source code, change spec, plan, test plan, or pm-notes modified; the only change artifact touched is this addendum. No license headers added.

Residual documentation gaps: none.

## Addendum — State+Ports Union Reconciliation (2026-10-31)

Scope: current-truth reconciliation after the GH-181 branch merged `main-tools` with GH-174 (state layer) and the fix commit `fc472a6` reconciled the union seams. Ground truth was read from the tree, not from this report's earlier prose.

Union facts verified in the tree:

- `.dependency-cruiser.cjs` `runtime-apis-confinement` `pathNot` has four entries: `packages/core/src/state/driver/`, `packages/adapters/src/(repo|file|host|session|legacy|credentials)/`, `packages/cli/`, and `packages/opencode/`; the whole-state exemption is absent.
- `scripts/checks/secret-read-boundary.ts` declares four exact allowlist entries: the `credentials` directory (`credential-material`), `packages/core/src/state/driver/runtime-edge.ts` (`configuration-environment-source`, icacls owner identity), `packages/adapters/src/file/yaml-parser.ts`, and `packages/adapters/src/legacy/index.ts`.
- `packages/core/src/state/driver/runtime-edge.ts` reads `process.env.USERNAME ?? process.env.USER`, the state-tier environment read admitted by the allowlist.
- `packages/adapters/package.json` exports `./credentials`; `packages/core/package.json` exports `./state`.

### Files patched

| File | Union reconciliation |
|------|----------------------|
| `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Removed merge-duplicate front matter, overview paragraph, package-table rows, runtime-API-confinement bullet, and codebase-map rows. The single confinement statement now names both union sides: the `packages/core/src/state/driver/` edge and the adapter I/O subpaths including `credentials`. The secret-read description changed from three to four entries, naming the state driver runtime edge and its icacls owner-identity reason. Union `related_changes` now carries GH-174 and GH-181. |
| `doc/spec/features/feature-adapter-ports.md` | Secret-read allowlist table corrected from three to four entries with the state driver runtime edge (`configuration-environment-source`, icacls reason). Security boundary now names the `core` state driver edge alongside the adapter I/O subpaths. Added GH-174 traceability for the state-driver entry. |
| `doc/spec/features/feature-state-layer.md` | Runtime-edge description now includes the Windows owner-identity environment read; the Windows contract records the `USERNAME ?? USER` read as the only state-tier environment read and an allowlisted `configuration-environment-source`. Added GH-181 traceability. |
| `doc/overview/glossary.md` | Repaired malformed duplicate front matter (two `related_changes` and `summary` keys), merged duplicate `Domain kind` and `Empty-but-enforced` rows into their union wording, updated `Secret-read boundary` to four entries including the state driver, and tightened `Runtime-API confinement` to the driver edge plus the six adapter I/O subpaths. |
| `doc/spec/features/feature-result-contract.md` | Merged duplicate `related_changes` keys into `["GH-172", "GH-173", "GH-174", "GH-181"]`; no table or prose change was required. |
| `.ai/rules/typescript.md` | Section 4 runtime/I/O allowlist now reads `core/src/state/driver/`, the adapter I/O subpaths including `credentials`, `cli`, and `opencode`, plus the two configuration environment readers allowed by the secret-read boundary. |

### Verified without change

| Area | Finding |
|------|---------|
| `doc/spec/features/feature-config-layer.md` | Credential wording already points to the adapter-ports feature and the `./credentials` subpath; no state-layer contradiction. |
| `doc/spec/features/feature-branding-seam.md` | Branding-only traceability (GH-171, GH-173, GH-174) is accurate; GH-181 did not change the seam. |
| `doc/decisions/**` | Decision records are historical. ADR-0003's subpath-level statement that `core ./state` is the only core subpath importing runtime APIs remains true; the implementation-level driver-edge tightening is enforced by `.dependency-cruiser.cjs` and documented in current-truth specs. No decision-record rewrite was made. |
| Remaining `doc/**` current-truth prose (excluding `doc/changes/**` and `doc/inception/**`) | Grep found no remaining "three allowlist entries" claim, no subpath list missing `./credentials` or `./state`, and no statement that the whole state tier or the state layer is exempt from runtime-API confinement without the driver-edge nuance. |

### Validation

- `bash scripts/.tests/test-doc-distribution.sh` → `no drift — 80 in-scope docs; install set matches ados_distribution markers`.
- `bun run scripts/checks/forbidden-literals.ts` → `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`.
- `bun run scripts/checks/secret-read-boundary.ts` → `OK secret-read-boundary: 56 production files clean (4 allowlisted entries, severity error)`.
- Front matter in the patched docs parses as single-key mappings; no duplicate keys remain.
- Traceability: GH-174 and GH-181 both appear in the union `related_changes` of the scaffold spec and glossary; the adapter-ports spec carries both; the state-layer spec carries both.

### Residual documentation gaps

None for the union. No source code, tests, configs, change spec, plan, test plan, or pm-notes were modified; the only change artifact touched is this addendum. No license headers were added.

### Next Step

Ready for Finalization.
