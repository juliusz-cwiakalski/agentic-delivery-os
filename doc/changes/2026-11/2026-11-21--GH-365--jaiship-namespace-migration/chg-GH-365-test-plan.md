---
id: chg-GH-365-test-plan
version: 0.3
status: Updated
created: 2026-11-21
last_updated: 2026-11-21T18:47:29Z
owners: ["engineering"]
service: "delivery-os configuration, state, and install surfaces (namespace identity)"
labels: ["namespace", "migration", "identity", "m4-s2", "install", "conformance", "shims"]
version_impact: minor
summary: "Offline, deterministic battery for the Jaiship namespace migration: the committed project layer and its brand-free ignore rules, the one authoritative root with a bounded notice-bearing prior read, the `install migrate` verb with dry-run, verified backup, per-entry precedence, the delivered command-audit pair at the destination, symlink dispositions, the `unscoped` project scope, idempotence and recovery, the declared one-release shim registry, the two-arm namespace conformance gate with its two negative controls and its declared prior-root prefix set, and the identity alignment of the override channel, the MCP default and the bounded pre-freeze mapping with its one declared exception — 36 cases across 6 groups mapped to all 31 acceptance criteria, with a 55-row mutation register and the permanent eight-proven / eight-not-proven proof boundary."
links:
  change_spec: ./chg-GH-365-spec.md
  implementation_plan: ./chg-GH-365-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S2: one product identity — the committed project layer, the migration command, the declared one-release shims, and the namespace conformance scan (M4)

## 1. Scope and Objectives

This plan protects the contract that makes `jaiship` the single authoritative identity on every surface the story names, and it protects every delivered surface the change composes. The properties that must not break are: the committed project configuration layer exists **only** at the current path and is byte-identical to the document it replaces, while a fresh clone with no local exclude and the normal runtime write set stays clean through the repository's own rules; the current-identity root is authoritative whenever it exists, the prior root is a read-only, notice-bearing, bounded fallback that is silent on a migrated host, and no read or notice ever names the prior path as the loaded one; the migration verb refuses every undeclared input and every admission failure **before** it writes a byte, plans before it acts, copies and digest-verifies before it moves, never deletes or overwrites a differing byte, never follows or moves a symlink entry, is idempotent, and can be re-run from the backup after an interrupted run without duplicating a moved entry; the prior namespace is enumerated in machine-readable form and both scan arms fail on a newly introduced identifier, a tracked path under a prior root, or a reintroduced symlink while allowing exactly the declared sites; and the override channel, the MCP default and the pre-freeze mapping resolve the current identity without regressing the machines the shim exists for.

The integrity risks that shape the cases are the ones the spec names: a migration that destroys, splits or silently merges operator state (`RSK-1`); a prior root that stays authoritative because a read is silent (`RSK-2`); a declared-site allowlist that becomes a rubber stamp (`RSK-3`); the neutral-scope exclusion abused to smuggle a product identifier past the scan (`RSK-4`); a fresh clone still dirtied by an undeclared runtime-written path (`RSK-5`); a stale host index sending a read to the prior root (`RSK-6`); a retirement that leaves stale references in docs, fixtures or corpora (`RSK-7`); an MCP consumer relying on the prior identity (`RSK-8`); the bounded `ADOS_` mapping dropping a mapping an operator used (`RSK-9`); a migration racing an open store (`RSK-10`); a new prior identifier in prose passing because the executable token is not scanned in docs (`RSK-11`); and a migrated host re-dirtied by the shell fallback's hardcoded prior root (`RSK-12`). Every one is a named case below with a planted defect that must make it fail by name (§7.4).

**Every case in this plan is offline and deterministic, with no real machine in the loop.** There is no real operator home, no network call, no package-manager or build invocation, no live provider, no live tracker, and no real daemon: a case that exercises the daemon guard uses the delivered recording daemon double and asserts the port's call counts. The migration cases run over scratch roots and injected filesystem facts with a write recorder plus read and directory-creation recorders, and every refusal case asserts a **zero-write** and **zero-directory-creation** consequence, not merely an exit code. Determinism devices are a fixed clock instant, a fixed id sequence, and the injected `delay` recorder; two consecutive runs of a case produce identical payloads, plans and verdicts (spec `NFR-1`). No fixture writes, reads, or probes the real home: the only home any case sees is a scratch directory under the repository's approved temp root.

### 1.1 In Scope

- `AC-F1-1`…`AC-F6-5` (31 acceptance criteria) — every one mapped in §3.1 with zero orphans and zero unmapped.
- `NFR-1`…`NFR-9`, and the interface/data-model contracts `API-1`…`API-7` and `DM-1`…`DM-9`.
- The committed-layer move and its ignore rules (`DM-1`, `DM-2`): the byte-identical tracked move, the tracked-set emptiness under the prior root, the two brand-free root-anchored globs, the nested-path non-match, and the fresh-clone drill with no local exclude.
- The authoritative root and the bounded prior read (`DM-1`, `API-4`): both-present precedence, the zero-notice migrated host in human and `--json`, the prior-only single notice naming both paths, the write-free prior read, the project-local overlay under `CI=true`, and the operator-local group document with its empty-listing absence and its declaration-only mirror target set (spec `DEC-12`, TDR-0074).
- The migration surface (`API-1`, `API-2`, `API-3`, `DM-5`, `DM-6`, `DM-7`, `DM-8`): every refusal arm, the dry-run's zero-write, zero-directory and zero-record discipline with the `NFR-2` line bound and its single truncation line, the full move with digest equality, the backup and its two-id document split, the complete `DM-6` disposition matrix including the derived entry's `already-migrated`/`absent` disposition and `DM-6`'s stated verdict-composition rule, the symlink dispositions (source `blocked`, destination `conflict`, never followed or moved), the `unscoped` project scope, the delivered command-audit pair at the destination, the managed-`PATH` residual, idempotence, injected partial failure and recovery, byte preservation with no re-versioning, and post-move state locations.
- The declared shims (`DM-3`): registry shape, window order, site presence, no wildcard, both-directions reconciliation, one notice per process per source kind, zero prior writes, and the alias's refusal plus its `--help` deprecation sentence.
- The conformance gate (`DM-4`, `API-7`): one planted occurrence per prior-namespace-carrying class, the two non-carrying controls, the neutral-scope cases with their positive controls (including the `SCOPE_ORG` neutral site), the ADR-0003 DEC-8 allowlist-independence control, the tree arm over the real tree with its prior-root prefix set read from the declaration and reported, the two negative controls, and the CI binding with deterministic double runs.
- Identity alignment (`DM-9`, `API-5`, `API-6`): per-surface clean-home path creation including MCP, override precedence and containment, the eight owner-named pre-freeze variables plus the inert `ADOS_FOO` fixture and the one declared `ADOS_WORKING_NAME` exception, the enumerated documentation battery with projection currency, and the five declared product-surface literal sites.
- The proof boundary as a permanent fixture constant (`NAMESPACE_PROOF_BOUNDARY`: eight proven ids, eight not-proven ids, declared order, spec Appendix G) and the statement of every not-proven surface (spec Appendix C).

### 1.2 Out of Scope & Known Gaps

Not tested, by design, and acceptable for the reasons given (design provenance: spec §25.3 Appendix C; `NG-9`):

| Not proven | Why this is acceptable |
|------------|------------------------|
| A real operator home with a real pre-existing prior namespace | The battery runs over scratch roots and injected facts; it proves the contract, the ordering, and the write set, not the state of one machine (`RSK-1` residual). |
| A fresh clone on a second physical machine | The drill is a scratch clone at the change head plus rule-world probes; it proves the ignore rules and a clean status over the **declared** write set, not that an unknown tool writes elsewhere (`RSK-5` residual). |
| A real CI runner's home and workspace | Both arms run in the repository; runner-local state is outside the boundary. |
| Other checkouts and other operators' repositories | The migration handles the invoking checkout only; a fleet is not exercised. |
| Third-party tooling that still invokes `delivery-os` | The alias keeps working and its refusal is asserted; whether an external consumer notices the deprecation is not observable here (`RSK-8`). |
| The real shim-removal release | The window is a declaration and a registry value; its execution is a later change. |
| The prose residual | The executable token is deliberately not enforced over registered docs (`RSK-11`); a new prior identifier in prose is not proven to fail — the path and environment seeds are what is enforced. The residual itself is asserted as a negative control (`TC-SCAN-001` row H) so over-enforcement cannot silently break the corpus. |
| The shell fallback after a migration | Its prior-root defaults are unchanged (`DEC-13`); nothing re-points them, so the fallback's post-migration namespace behaviour is **declared, not tested**. The operator remediation is published in the migration guide and asserted as documentation (`TC-IDENTITY-004`). |

Also out of scope (spec §7.2, `NG-1`…`NG-10`): renaming the workspace package scope `@delivery-os`, the repository name `agentic-delivery-os`, the docs/URL derivation or the monorepo layout; publication, versioning-channel or package-visibility changes; retiring the alias, the prior read, `DELIVERY_OS_WORKING_NAME` or the pre-freeze adapter; editing or re-pointing any shell entry point including `scripts/lib/dispatch-authority.sh` and `scripts/hooks/*`; rewriting agent prompt workflows beyond the one routing-authority sentence and its regenerated projection; any state schema bump, record rewrite, ledger re-version or backfill; a general `DELIVERY_OS_*` → `JAISHIP_*` environment mapping; and a tracked template for the project-groups document.

**No permanent suite asserts a diff against a moving base branch.** Per `.ai/rules/testing-strategy.md` ("Permanent suites … must never assert a diff against a moving base branch (`origin/main-tools...HEAD`)"), every case here asserts a property of the current tree, of HEAD, or of an injected fact set. Three consequences this plan states explicitly:

- **`DOD-4`'s byte identity** is a comparison against a **committed pre-move digest recorded in the fixture**, not against `git show <base>:…`.
- **"The shell and prompts are untouched" (`DEC-11`) is not a diff assertion.** The shell files are byte-pinned by the delivered `tests/structure/provider-surface.test.ts`-family invariant and stay green; the prompt half is a phase-9 branch-range review recorded in §10, and the only permitted prompt edit is asserted positively by `TC-IDENTITY-004`.
- **`DOD-3` (the branch-range commit-message gate)** is a phase-9 gate, listed in §7.5, never a case.

**Phasing.** This plan proposes a delivery-phase split `P1`…`P10` (§4.2) that follows spec §19's landing order with one folding: spec §19's items (5) "the migration domain and its battery" and (6) "the `install migrate` verb" are one boundary (`P5`), because **every** `AC-F3-*` criterion is phrased over the command. Splitting the domain from the verb would force all ten `F-3` cases into cross-phase segments with no gain in isolation, and the recognised-and-refused flag form would then coexist with the working verb across a boundary. The folding is a plan input, not a requirement change; §4.2 records every case's owning phase and §7.5 states the self-sufficiency rule.

## 2. References

| Reference | Use |
|-----------|-----|
| `./chg-GH-365-spec.md` (v1.4) | Source of the 31 ACs, `F-1`…`F-6`, `API-1`…`API-7`, `DM-1`…`DM-9`, `NFR-1`…`NFR-9`, `RSK-1`…`RSK-12`, `DEC-1`…`DEC-13`, `DOD-1`…`DOD-10`, §8.5 (twelve deliberate changes), Appendix A (phase-7 documentation impacts), Appendix C (proof boundary), Appendix D (implementation-decided details), Appendix F (normative registry shapes, the two migration schema ids and the allowlist independence), Appendix G (proof-boundary constant) |
| `./chg-GH-365-pm-notes.yaml` | The clarify-scope decisions (D1 neutral scope, D2 declared shims, D3 project layer, the TDR-0074 ruling, the DEC-13 deferral), the **staging constraint** for TDR-0074 and its `doc/decisions/00-index.md` row, the owner scope update of 2026-11-21 (D1/D2 defects), the TDR-0047 no-re-versioning constraint, and the `TMPDIR`/`PATH` operational prerequisite |
| `doc/decisions/TDR-0074-project-groups-document-operator-local-overlay.md` | `DEC-12`: the group document is an operator-local, git-ignored overlay at its unchanged path and schema; the mirror's target set is declaration-only from the invoking checkout's own document; no tracked template |
| `doc/changes/2026-11/2026-11-19--GH-348--loop-supervision/chg-GH-348-test-plan.md` | Structural precedent: stable-id groups, AC traceability matrix, phase-gate segment discipline, mutation register, fixture inventory, gate battery, proof-boundary constant |
| `.ai/rules/testing-strategy.md` | Layers, module→test mapping, invariant-authoring rules (no moving-base diff), `pnpm check` as the aggregate |
| `.ai/rules/typescript.md` §9–§10 | `bun:test` authoring rules, determinism, fixtures never named `*.test.ts`, gate commands |
| `scripts/checks/forbidden-literals.ts`, `scripts/checks/forbidden-literals.registry.json` | The delivered content arm extended with the `priorNamespace` seed class, `scopeSelection`, `neutralSites`, `declaredCorpora`, the shim-registry pointer, and the two new scope classes |
| `scripts/checks/namespace-tree.ts` (new), `scripts/checks/namespace-shims.registry.json` (new) | The tree arm and the shim authority this change authors |
| `scripts/checks/ignore-rules.ts` | The four coverage classes, the brand-free glob, the rename simulation and the rule-world `git check-ignore` probes this change extends |
| `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `.github/workflows/ci.yml` | The `ts-forbidden-literals` binding, the new tree-arm `ts-*` job, the baseline-fetch obligation, and the non-advisory posture |
| `scripts/checks/help-guide-coverage.ts`, `packages/cli/src/help/prompt-required-commands.ts` | The pinned prompt-required inventory (**28**, unchanged) and the per-command reference-page mapping (`install` → the M4 page) |
| `tests/checks/install-lifecycle-docs.test.ts` | `GUIDE_REQUIREMENTS`, which names `install.migration.unavailable` today and must **lose** it as the migration facts enter |
| `tests/checks/install-lifecycle-path.test.ts` | The delegation-refusal case that is replaced by the verb cases and the recognised `--migrate` refusal |
| `tests/structure/inventory.json` | The module inventory every new module must be registered in |
| `tests/checks/error-table-sync.test.ts`, `tests/structure/cross-repository-contract.test.ts`, `tests/fixtures/result/code-corpora/*.json` | The bidirectional error-table/doc sync, the additive-row set, and the result-code corpora that must **lose** the retired identity |
| `tests/fixtures/entrypoint/prior-identity/harness.ts`, `tests/fixtures/daemon/mount-harness.ts` | The scratch checkout/home harness with counting filesystem facts and notice sink, and the recording daemon-mount harness reused by the daemon-guard and post-move cases |
| `packages/core/src/contracts/install.ts`, `packages/core/src/contracts/error-table.ts`, `packages/core/src/config/catalog.ts` | The closed identity, inventory and catalog-key surfaces asserted as data, never as literals guessed in a test |

`./chg-GH-365-plan.yaml` is authored in `delivery_planning` (phase 4) after this plan. This plan is its input and fixes what it must carry: the `P1`…`P10` boundary and case ownership of §4.2, the staged `doc/decisions/TDR-0074-…md` **and** its `doc/decisions/00-index.md` row in an early phase scope (pm-notes staging constraint), the migration-domain module split, and the `tests/structure/inventory.json` registrations of §7.3.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

31 acceptance criteria, 31 mapped, 0 unmapped, 0 orphans. Every case in the "Owning case(s)" column exists in §5.1/§5.2; every case in §5.1 appears here or in §3.3.

| AC | Capability | Linked contracts | Owning case(s) | Phase | Status |
|----|-----------|------------------|----------------|-------|--------|
| `AC-F1-1` | F-1 | DM-1, NFR-3 | `TC-LAYER-001` | P1 | Planned |
| `AC-F1-2` | F-1 | F-5, DM-2, DM-3, NFR-6 | `TC-SCAN-003`, `TC-SCAN-004`, `TC-SCAN-005` | P4 | Planned |
| `AC-F1-3` | F-1 | DM-2, NFR-5 | `TC-LAYER-002`, `TC-LAYER-003` | P1 | Planned |
| `AC-F1-4` | F-1 | F-2, DM-1, API-4 | `TC-LAYER-004` | P1 | Planned |
| `AC-F2-1` | F-2 | API-4 | `TC-ROOT-001` | P7 | Planned |
| `AC-F2-2` | F-2 | API-4, NFR-7 | `TC-ROOT-002` | P7 | Planned |
| `AC-F2-3` | F-2 | API-4 | `TC-ROOT-003` | P7 | Planned |
| `AC-F2-4` | F-2 | DM-1, NFR-9, DEC-12, TDR-0074 | `TC-ROOT-004` | P7 | Planned |
| `AC-F3-1` | F-3 | API-1, API-2, DM-6, DM-8 | `TC-MIGRATE-001`, `TC-MIGRATE-002`, `TC-MIGRATE-011` | P5, P6 | Planned |
| `AC-F3-2` | F-3 | API-2, NFR-1, NFR-2 | `TC-MIGRATE-003` | P5 | Planned |
| `AC-F3-3` | F-3 | API-2, DM-5, DM-6, DM-7, NFR-3 | `TC-MIGRATE-004` | P5 | Planned |
| `AC-F3-4` | F-3 | DM-7, NFR-4 | `TC-MIGRATE-005` | P5 | Planned |
| `AC-F3-5` | F-3 | DM-6, NFR-3 | `TC-MIGRATE-006`, `TC-MIGRATE-007` | P5 | Planned |
| `AC-F3-6` | F-3 | NFR-4, DM-5 | `TC-MIGRATE-008` | P5 | Planned |
| `AC-F3-7` | F-3 | DM-7, NFR-3, NFR-8 | `TC-MIGRATE-009` | P5 | Planned |
| `AC-F3-8` | F-3 | DM-7, RSK-6 | `TC-MIGRATE-010` | P5 | Planned |
| `AC-F4-1` | F-4 | DM-3, NFR-6 | `TC-SHIM-001` | P2 | Planned |
| `AC-F4-2` | F-4 | F-5, DM-3, DM-4, NFR-6 | `TC-SHIM-002` | P3 | Planned |
| `AC-F4-3` | F-4 | API-4, NFR-7 | `TC-SHIM-003` | P8 | Planned |
| `AC-F4-4` | F-4 | API-1, DM-3, NFR-9 | `TC-SHIM-004` | P5 | Planned |
| `AC-F5-1` | F-5 | DM-4, NFR-5 | `TC-SCAN-001` | P3 | Planned |
| `AC-F5-2` | F-5 | DM-4, RSK-4 | `TC-SCAN-002` | P3 | Planned |
| `AC-F5-3` | F-5 | F-1, DM-2 | `TC-SCAN-003` | P4 | Planned |
| `AC-F5-4` | F-5 | F-1 | `TC-SCAN-004` | P4 | Planned |
| `AC-F5-5` | F-5 | F-1 | `TC-SCAN-005` | P4 | Planned |
| `AC-F5-6` | F-5 | API-7, NFR-1, NFR-5 | `TC-SCAN-006` | P4 | Planned |
| `AC-F6-1` | F-6 | DM-9, NFR-8 | `TC-IDENTITY-001` | P8 | Planned |
| `AC-F6-2` | F-6 | API-6, NFR-7 | `TC-IDENTITY-002` | P8 | Planned |
| `AC-F6-3` | F-6 | API-5, API-6, DEC-9, RSK-9 | `TC-IDENTITY-003` | P8 | Planned |
| `AC-F6-4` | F-6 | DM-9, NFR-9 | `TC-IDENTITY-004` | P9 | Planned |
| `AC-F6-5` | F-6 | DM-9, NFR-8 | `TC-IDENTITY-005` | P8 | Planned |

**Arithmetic.** 4 + 4 + 8 + 4 + 6 + 5 = 31 acceptance criteria, reconciled against spec §17 (`F-1` 4, `F-2` 4, `F-3` 8, `F-4` 4, `F-5` 6, `F-6` 5). 31 of 31 appear above with at least one named case; 0 are unmapped and 0 defer an assertion.

The matrix carries **37** AC→case links (31 + 6 extras), because four criteria need more than one observation: `AC-F1-2` (+2: `TC-SCAN-004`, `TC-SCAN-005` — the two synthetic-tree controls its proof column names), `AC-F1-3` (+1: `TC-LAYER-003` — the drill beside the rule-world probes), `AC-F3-1` (+2: `TC-MIGRATE-002`, `TC-MIGRATE-011` — the daemon arm and the retired flag form), `AC-F3-5` (+1: `TC-MIGRATE-007` — the derived entry). 6 extras sum to 37 links exactly.

**Case inventory.** **36** cases across 6 groups. 0 orphan cases: **34** link at least one `AC-*`, and **2** link only the contract they pin — `TC-IDENTITY-006` (`NFR-1`, `DOD-5`: the boundary constant) and `TC-MIGRATE-012` (`NFR-9`, `API-1`: the family surface and the unchanged prompt-required inventory). The matrix above is the single source of truth for both numbers.

| Group | Prefix | Cases | Capability | One-line purpose |
|-------|--------|-------|-----------|------------------|
| Committed layer | `TC-LAYER-*` | 4 | F-1 | The tracked move and its byte identity, the brand-free ignore rules, the fresh-clone drill, and the loaded-path guarantee |
| Authoritative root | `TC-ROOT-*` | 4 | F-2 | Both-present precedence, the zero-notice migrated host, the prior-only bounded read, and the two local overlays |
| Migration | `TC-MIGRATE-*` | 12 | F-3 | The verb's refusals, the daemon ordering, the dry-run plan, the move, precedence, derived entries, recovery, byte preservation, post-move locations, and the retirements |
| Shims | `TC-SHIM-*` | 4 | F-4 | Registry shape and window, both-directions reconciliation, per-shim notice discipline, and the alias declaration |
| Conformance | `TC-SCAN-*` | 6 | F-5 | The content arm per class, the neutral-scope cases, the tree arm, the two negative controls, and the CI binding |
| Identity | `TC-IDENTITY-*` | 6 | F-6 | Per-surface clean-home paths, override precedence, the bounded legacy mapping, the documentation battery, the literal-site inventory, and the proof boundary |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Contract | Case(s) | Note |
|----------|---------|------|
| `API-1` `install migrate [--dry-run] [--backup-dir <abs>] [--stop-daemon]` | `TC-MIGRATE-001`, `TC-MIGRATE-002`, `TC-MIGRATE-003`, `TC-MIGRATE-004`, `TC-SHIM-004`, `TC-MIGRATE-012` | Admission order asserted arm by arm: alias `install.identity.not-owning` → grammar/undeclared flag `fallback.invocation` → relative or in-source `--backup-dir` `input.value.rejected` → `install.dev-build` → `install.target.worktree` → `install.daemon.running` unless `--stop-daemon`; `--json`, `--verbose`, `--pretty` accepted and never refusals; the stop precedes the first move and the daemon is not restarted; an applying run appends exactly the delivered command-audit pair (`audit.reservation`, `audit.invocation`) at the destination host state root, a dry run appends no record of any kind, and no arm writes a migration record or an install-record field |
| `API-2` plan and verdict | `TC-MIGRATE-001`, `TC-MIGRATE-003`, `TC-MIGRATE-004`, `TC-MIGRATE-006`, `TC-MIGRATE-007`, `TC-MIGRATE-008` | `install.migration.plan.v1` field set with the closed `scope` values `scoped`/`unscoped`; the closed six dispositions and five verdicts composed by `DM-6`'s maximum-severity rule; the derived entry is `already-migrated` (destination copy exists) or `absent` (none), never in the source-move set and never a conflict; a source symlink is `blocked` and a destination symlink `conflict`; exit `0` only for `migrated`/`already-migrated`; a data-bearing negative verdict carries no error code |
| `API-3` `install --migrate` retired | `TC-MIGRATE-011` | Exit 1, `fallback.invocation`, summary naming the retired form and the remedy `install migrate`; no install and no migration; without `--migrate`, the delivered advisory detection line and nothing moved |
| `API-4` prior-identity notices | `TC-ROOT-001`, `TC-ROOT-002`, `TC-ROOT-003`, `TC-SHIM-003` | The four delivered reasons keep their names and semantics; the loaded-file fact names the current path when the current file was read and the prior path as not used; the one new `override-read` reason; ≤ 1 line per reason per composed program, stderr in every mode including `--json`, never in a payload, never an exit-code change, never emitted when no prior input exists |
| `API-5` environment mapping contract | `TC-IDENTITY-003` | A legacy-prefixed name maps only when its mapped current name is a declared catalog key; every other legacy name is untouched — not an error, not a value, not a notice; **the one declared exception is `ADOS_WORKING_NAME` → `<environmentPrefix>WORKING_NAME`**, read as the override channel, adding no configuration key; current-prefix strictness unchanged |
| `API-6` working-name override | `TC-IDENTITY-002` | `<environmentPrefix>WORKING_NAME` wins; the prior literal is read only when the current one is absent or empty with exactly one `override-read`; precedence current → prior → the bin's or composition's declared default; an invalid override is contained (`fallback.internal`, exit 2) with no fallback to the other channel |
| `API-7` conformance gate | `TC-SCAN-001`…`TC-SCAN-006` | Both arms read-only, offline, deterministic, each exiting `0` with a per-class summary and `1` naming file+line+token or tracked path or symlink target; both in `pnpm check`; the content arm keeps `ts-forbidden-literals` and the tree arm is a declared `ts-*` job with the baseline-fetch obligation; neither writes the tree |
| `DM-1` committed project layer | `TC-LAYER-001`, `TC-LAYER-004`, `TC-ROOT-004` | Path-only change with byte-identical content; the prior path disappears from the tracked set; the layer contract and the document's own `verify.suite-map`/`provider` branches untouched |
| `DM-2` ignore rules | `TC-LAYER-002`, `TC-LAYER-003`, `TC-SCAN-003` | `.*/config.local.yaml` (delivered) and `.*/projects.yaml` (added), both brand-free and root-anchored; a nested `packages/x/projects.yaml` is not matched; the tracked `config.yaml` is not matched; the new coverage class and the two probes plus the positive control |
| `DM-3` shim registry | `TC-SHIM-001`, `TC-SHIM-002`, `TC-SHIM-003`, `TC-SHIM-004` | `namespace.shims.v1`; every field; unique ids; resolvable window with the delivery-os lineage ordered and the pre-freeze lineage at `removalRelease: null`; no wildcard; site presence both directions; the longest-literal seed-to-shim resolution; the glossary declared site and the `ADOS_WORKING_NAME` mapping exception |
| `DM-4` seed class and scope classes | `TC-SCAN-001`, `TC-SCAN-002`, `TC-SHIM-002` | Five seeds, the two new classes, the explicit `scopeSelection` (prompt/script carry the `priorNamespace` class **only**), the two structural exclusions, the `SCOPE_ORG` neutral site, the preserved ADR-0003 DEC-8 class and its allowlist, and the **allowlist independence** (the frozen ADR-0003 DEC-8 path allowlist does not filter the `priorNamespace` class; the shim registry is that class's only site authority) |
| `DM-5` backup and manifest | `TC-MIGRATE-004`, `TC-MIGRATE-008` | `<stamp>/manifest.json` plus one subtree per root label; the manifest field set with its own id `install.migration.manifest.v1` (distinct from the payload's `install.migration.plan.v1`); digests verified before any move; no credential, environment value, or record payload |
| `DM-6` root and entry policy | `TC-MIGRATE-001`, `TC-MIGRATE-004`, `TC-MIGRATE-006`, `TC-MIGRATE-007` | The three brand-derived roots; the closed root scope `scoped`/`unscoped` (unscoped carries no source, destination, entries or verdict); entries as the unit with container descent; the six-row ordered decision table; the derived set (today `host-index.json`) as `already-migrated`/`absent`; the stated maximum-severity composition rule; the symlink dispositions and the never-followed rule; retirement only for a root that existed at plan time; the managed-`PATH` residual; never a merge, an overwrite, a deletion of a difference, or a rewrite |
| `DM-7` state-move invariants | `TC-MIGRATE-004`, `TC-MIGRATE-005`, `TC-MIGRATE-009`, `TC-MIGRATE-010` | Byte preservation per file; no re-versioning; the unchanged accepted state format; the identical `install status` verdict; the delivered command-audit pair written at the destination root before the first move, never in a source root, never a migration record; a dry run writes no record; the host index re-derivation with a warning that never redirects a read |
| `DM-8` error identities | `TC-MIGRATE-011` | Exactly one retirement and zero additions: 11 → 10 in the install domain with the error-table row, the documentation row, and the result-code fixture entry removed; every migration failure maps onto a delivered identity; negative verdicts are data |
| `DM-9` declared literal sites | `TC-IDENTITY-005`, `TC-IDENTITY-001`, `TC-IDENTITY-004` | The five product-surface sites in order (alias default, primary default, primary prior identity, MCP default now the current identity, resolver scope-org input); the build-side site unchanged; the override name is not a committed literal |
| `EVT-*` | — | No event, message, telemetry record, metric, alert, or rendered-surface row is added (spec §8.2, §10); nothing to test |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Case(s) | Observation |
|-----|---------|-------------|
| `NFR-1` offline determinism | `TC-LAYER-003`, `TC-ROOT-002`, `TC-ROOT-003`, `TC-MIGRATE-003`, `TC-MIGRATE-004`, `TC-SCAN-006`, `TC-IDENTITY-006` | 0 network calls, 0 package-manager or build invocations, 0 real-home reads or writes (asserted from the injected facts' call recorders); two consecutive runs byte-identical after temp-root canonicalisation; the double-run comparison of the dry-run plan and of both gate arms |
| `NFR-2` bounded output | `TC-MIGRATE-003`, `TC-MIGRATE-004`, `TC-MIGRATE-006` | Human plan ≤ 60 lines and human run ≤ 60 lines, ANSI-free, one line per entry, every line ≤ 512 bytes; machine payload ≤ 65 536 bytes; a plan above the line bound truncates with one counted `… N more` line |
| `NFR-3` byte preservation | `TC-MIGRATE-004`, `TC-MIGRATE-006`, `TC-MIGRATE-009` | 100% of moved files digest-equal at the destination; 0 rewritten bytes; 0 deleted entries other than those moved; 0 schema-version or format-identifier changes; the second run reports a byte-identical state |
| `NFR-4` idempotence and recovery | `TC-MIGRATE-005`, `TC-MIGRATE-008` | Second clean run: 0 moves, 0 backup directories, exit 0, `already-migrated`; injected failure after *k* of *n*: the *n−k* unmoved entries intact, the backup complete for all *n*, the re-run completes the remainder with no duplicate |
| `NFR-5` conformance coverage | `TC-SCAN-001`…`TC-SCAN-006` | 7 scope classes scanned, 6 carrying the prior-namespace class; ≥ 1 mutation per carrying class failing by name; 2 negative controls failing by name; **0 undeclared occurrences** at the change head (occurrences inside a declared site, a declared corpus, or a neutral site are the declared ones); ≤ 60 s and 0 writes |
| `NFR-6` declared-site integrity | `TC-SHIM-001`, `TC-SHIM-002` | 100% of declared sites present; 100% of matches inside a declared site, a declared corpus, or a neutral site; 0 outside; every budgeted site at or below its budget; 0 wildcard sites |
| `NFR-7` notice discipline | `TC-ROOT-002`, `TC-ROOT-003`, `TC-SHIM-003`, `TC-IDENTITY-002` | ≤ 1 notice per reason per composed program; 0 notices in any payload; 0 exit-code changes from a notice; 0 notices on a migrated host; every notice line ≤ 200 bytes and free of environment values, credentials and file contents |
| `NFR-8` contract invariance | `TC-MIGRATE-009`, `TC-MIGRATE-011`, `TC-IDENTITY-005` | 1 error identity retired and 0 added; 1 subcommand added and 1 flag form retired; 0 configuration keys added, removed or renamed; 0 delivered record/payload schemas or state-format identifiers changed; the five declared literal sites unchanged in count; the prompt-required inventory unchanged at 28 |
| `NFR-9` documentation discipline | `TC-IDENTITY-004`, `TC-MIGRATE-012`, `TC-ROOT-004` | Every new or changed distributable page declares `ados_distribution`; the doc-distribution guard is green; every new page is registered in the forbidden-literal registry in the same change; `pnpm check:help` green with the install family page carrying `--help` and `--version` |

**Exit-literal rule.** Every exit literal stated in §5.2 is asserted through the delivered `ERROR_TABLE` × projection map rather than as a bare digit. `install.identity.not-owning`, `install.dev-build`, `install.target.worktree`, `install.daemon.running`, `fallback.invocation`, `input.value.rejected` project as `user-validation` → exit 1; `fallback.internal` projects per its containment → exit 2; `state.*` projects as `platform-provider` → exit 2. The migration's `migrated`/`already-migrated` verdicts exit 0 and `partial`/`conflict`/`blocked` exit 1 as data with no code (`DM-8`). No case may state an exit literal the delivered matrix does not project; `TC-MIGRATE-011` pins the install domain's row set, so a case that contradicts the table fails the invariance check rather than silently editing an expectation.

## 4. Test Types and Layers

All cases are automated, offline, and deterministic. Per `.ai/rules/testing-strategy.md`:

| Layer | Runner | Location | Used for |
|-------|--------|----------|----------|
| Behaviour (integration) | `bun test` (`bun:test`) | `tests/behaviour/namespace-*.test.ts`, `tests/behaviour/install-migrate.test.ts`, and the extended delivered `prior-identity-*`, `install-*`, `identity-override`, `legacy-adapter`, `config-cli` suites | The composed read paths, the migration command and its domain, the per-shim notices, the clean-home path sets, the override channel, the bounded legacy mapping |
| Structure | `bun test` | `tests/structure/namespace-*.test.ts` and the extended `branding-contract.test.ts`, `entrypoint-bin.test.ts`, `state-scope.test.ts`, `cross-repository-contract.test.ts` | The tracked set and byte identity, the registry shape, the literal-site inventory, the unchanged accepted state format |
| Repository invariant | `bun test tests/checks/**` + `bun run scripts/checks/*.ts` | `tests/checks/namespace-*.test.ts`, the extended `tests/checks/{forbidden-literals,install-lifecycle-path,install-lifecycle-docs,error-table-sync}.test.ts`, and `scripts/checks/{forbidden-literals,namespace-tree,ignore-rules,ci-topology,ci-bindingness,help-guide-coverage}.ts` | The content arm per class and per mutation, the tree arm and its negative controls, the both-directions reconciliation, the CI binding, the doc battery, the retired identity |
| Conformance | `bun test` | `tests/conformance/namespace/` | The permanent proof-boundary constant and its row registry |
| Static/diff | `git diff --check` | — | Whitespace/conflict-marker guard before every commit |

No live layer participates: no network, no live provider, no live tracker, no real daemon, and no real home. Unit-level assertions are folded into the behaviour or checks case that owns the same property (the decision table inside `TC-MIGRATE-006`, the matcher inside `TC-SCAN-002`), so no case exists only to restate a constant.

### 4.1 Drivers

- **D1 — composed production program.** `createProductionComposer({...injected facts})(brand)` → `runEntrypoint([...])`, the pattern proven by `tests/fixtures/entrypoint/prior-identity/harness.ts`. Injected facts: `environment`, `homeDirectory`, `cwd`, `workingName`, `clock`, `newRunId`, `processId`, and the notice sink. Used for the notice, loaded-path, override and clean-home cases.
- **D2 — in-process edge.** A `createTestEdge`-composed edge registering the `install` family → `runCli([...])`, the pattern proven by the delivered install suites. Used for the migration verb's grammar, refusals, dry-run and apply cases.
- **D3 — pure domain.** The exported migration decision table, plan builder, manifest writer/reader, digest comparer, registry validators, seed matcher, and disposition/verdict composers, called directly, for the table cases.
- **D4 — repository gate.** `bun run scripts/checks/<check>.ts` and the matching `tests/checks/**` mutation suite, over the real tree or a temp-copy tree. Used for both scan arms, the ignore rules, the CI topology/bindingness, the help coverage and the documentation battery.
- **D5 — scratch clone and scratch home.** A real `git clone` of the change head into `tmp/tmpdir` with **no** `.git/info/exclude`, plus a scratch HOME and a scratch checkout built by the prior-identity harness. Used by the fresh-clone drill and the clean-home cases. This is the only driver that creates a git repository; it never touches the workspace's own index and never fetches.

### 4.2 Phase map (plan input)

Each case is owned by exactly one delivery phase and is green **in isolation** at that boundary. The mapping follows spec §19 with the folding stated in §1.2.

| Phase | Landing (spec §19) | Cases owned |
|-------|--------------------|-------------|
| `P1` | The committed layer and the ignore rules | `TC-LAYER-001`, `TC-LAYER-002`, `TC-LAYER-003`, `TC-LAYER-004` |
| `P2` | The shim registry and its validation | `TC-SHIM-001` |
| `P3` | The prior-namespace seed class, the two scope classes, the content arm | `TC-SCAN-001`, `TC-SCAN-002`, `TC-SHIM-002` |
| `P4` | The tree arm and its CI binding | `TC-SCAN-003`, `TC-SCAN-004`, `TC-SCAN-005`, `TC-SCAN-006` |
| `P5` | The migration domain and the `install migrate` verb (spec items 5 + 6 combined) | `TC-MIGRATE-001`…`TC-MIGRATE-010`, `TC-SHIM-004` |
| `P6` | The two retirements and the family/help surface | `TC-MIGRATE-011`, `TC-MIGRATE-012` |
| `P7` | The authoritative root, the loaded path and the notice guarantees | `TC-ROOT-001`…`TC-ROOT-004`, `TC-IDENTITY-006` |
| `P8` | The override channel, the MCP default and the bounded legacy mapping | `TC-IDENTITY-001`, `TC-IDENTITY-002`, `TC-IDENTITY-003`, `TC-IDENTITY-005`, `TC-SHIM-003` |
| `P9` | The documents, guides and prompts | `TC-IDENTITY-004` |
| `P10` | The new quality page and the phase-7 reconciliation | No delivery case (§7.7 documentation check) |

**Precondition audit (spec §19's two ordering constraints).** The committed layer must move before the fresh-clone drill runs — `TC-LAYER-003` is `P1`, same phase as the move, and the drill clones the phase head, so it is green at that boundary. The shim registry must exist before the content arm consumes it — `TC-SHIM-001` is `P2` and `TC-SCAN-001`/`TC-SHIM-002` are `P3`, so the battery cannot pass by an empty allowlist. `TC-SCAN-003` asserts the committed layer present, which `P1` has already landed by `P4`. `TC-SHIM-003` is `P8` because its third row needs the `override-read` reason, and all three rows are green there. `TC-IDENTITY-006` is `P7`, the last phase that adds a battery row, and the row registry must be complete at that boundary (§7.7).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / NFR | Phase | New or Extended |
|-------|-------|------|-------|----------|----------|-------|-----------------|
| `TC-LAYER-001` | The tracked set is exactly `.jaiship/config.yaml`, byte-identical to the pre-move blob, and empty under the prior root | Structure | Structure | Critical | `AC-F1-1` | P1 | New |
| `TC-LAYER-002` | Both ignore patterns are brand-free and root-anchored, cover the runtime write set, never match the tracked layer, and survive a future rename | Invariant | Checks | Critical | `AC-F1-3` | P1 | Extended (`ignore-rules.ts` + new mutation suite) |
| `TC-LAYER-003` | A scratch clone with no local exclude and the seeded write set reports an empty `git status --porcelain` | Integration | Checks | Critical | `AC-F1-3` | P1 | New |
| `TC-LAYER-004` | The composed read loads the current path, resolves the moved suite map the verify gate reads, and opens no prior path | Integration | Behaviour | Critical | `AC-F1-4` | P1 | New |
| `TC-SHIM-001` | The shim registry is shape-complete, id-unique, window-ordered, site-present, budget-bounded and wildcard-free | Structure | Checks | Critical | `AC-F4-1` | P2 | New |
| `TC-SCAN-001` | The content arm fails by name for one planted occurrence per prior-namespace-carrying class and keeps the two non-carrying controls, the `SCOPE_ORG` neutral site and the ADR-0003 DEC-8 allowlist-independence control green | Invariant | Checks | Critical | `AC-F5-1` | P3 | Extended (`forbidden-literals.ts` + registry + mutation suite) |
| `TC-SCAN-002` | The neutral-scope exclusions are structural: the scope sigil, the repository name and the scope-org neutral site pass, a product-identifier use of the prior executable fails, and an unscoped package name fails | Invariant | Checks | Critical | `AC-F5-2` | P3 | Extended (`forbidden-literals.test.ts` + corpora) |
| `TC-SHIM-002` | Both directions reconcile: every match lies in a declared site, corpus or neutral site, and every declared site is present and at or below its budget | Invariant | Checks | Critical | `AC-F4-2` | P3 | New |
| `TC-SCAN-003` | The tree arm passes on the real tree: zero tracked prior paths, zero symlinks into one, the committed layer present, the runtime files ignored in a rule-world, and the prior-root prefix set read from the declaration and reported | Invariant | Checks | Critical | `AC-F5-3`, `AC-F1-2` | P4 | New |
| `TC-SCAN-004` | Negative control A: a tracked `.jaiship -> .delivery-os` symlink fails by name | Negative | Checks | Critical | `AC-F5-4`, `AC-F1-2` | P4 | New |
| `TC-SCAN-005` | Negative control B: a tracked file under `.delivery-os/` fails by name | Negative | Checks | Critical | `AC-F5-5`, `AC-F1-2` | P4 | New |
| `TC-SCAN-006` | Both arms are CI-bound, non-advisory, in the aggregate, and deterministic within the declared bound | Invariant | Checks | Critical | `AC-F5-6` | P4 | Extended (`ci-topology.ts`, `ci.yml`, `package.json`) |
| `TC-MIGRATE-001` | Every declared flag performs its effect and every admission refusal is its delivered identity with zero writes, including the symlink dispositions and the `unscoped` project scope | Negative | Behaviour | Critical | `AC-F3-1` | P5 | New |
| `TC-MIGRATE-002` | A live daemon is refused without `--stop-daemon`; with it the daemon stops before the first move and is not restarted; a dry run with the flag still reads no daemon | Integration | Behaviour | Critical | `AC-F3-1` | P5 | New |
| `TC-MIGRATE-003` | Dry-run prints the complete plan within the `NFR-2` bound with its single truncation line, writes nothing, creates no directory, appends no record of any kind, reads no daemon, and two runs are identical | Integration | Behaviour | Critical | `AC-F3-2` | P5 | New |
| `TC-MIGRATE-004` | A clean migration moves every entry with digests intact, writes a complete manifest under its own schema id and the delivered command-audit pair at the destination, reports the managed-`PATH` residual, retires the emptied roots, and reports `migrated` | Happy Path | Behaviour | Critical | `AC-F3-3` | P5 | New |
| `TC-MIGRATE-005` | A second run moves nothing, creates no backup, reports `already-migrated`, leaves both roots byte-identical, and never retires or reports a root that never existed | Edge Case | Behaviour | Critical | `AC-F3-4` | P5 | New |
| `TC-MIGRATE-006` | The `DM-6` disposition matrix holds row by row, the verdict follows DM-6's composition rule, and no differing byte is ever deleted or overwritten | Edge Case | Behaviour | Critical | `AC-F3-5` | P5 | New |
| `TC-MIGRATE-007` | The derived host index takes `already-migrated` (or `absent`): reported with its reason, never rewritten, never in the source-move set, never a conflict | Corner Case | Behaviour | Critical | `AC-F3-5` | P5 | New |
| `TC-MIGRATE-008` | A failure after *k* of *n* moves leaves the remainder intact and the backup complete, and the re-run completes without duplicating | Negative | Behaviour | Critical | `AC-F3-6` | P5 | New |
| `TC-MIGRATE-009` | The state move preserves every byte, re-versions nothing, and leaves `install status`'s compatibility verdict identical | Integration | Behaviour | Critical | `AC-F3-7` | P5 | New |
| `TC-MIGRATE-010` | After the move every reported state location is under the new host root and an index disagreement warns without redirecting a read | Integration | Behaviour | Critical | `AC-F3-8` | P5 | New |
| `TC-SHIM-004` | The alias refuses the migrate verb, carries the deprecation sentence in `--help`, and keeps its payloads and `--version` byte-unchanged | Negative | Behaviour | Critical | `AC-F4-4` | P5 | Extended (`install-family-surface`, `entrypoint-bin`, `install-ownership-split`) |
| `TC-MIGRATE-011` | The retired error identity is removed from the code table and every pinned corpus, not relaxed | Invariant | Checks | Critical | `AC-F3-1`, `NFR-8` | P6 | Extended (error table, cross-repository contract, corpora, docs battery) |
| `TC-MIGRATE-012` | The verb joins the existing family: the prompt-required inventory stays 28, the M4 page carries it, and the help/coverage gate stays green | Invariant | Checks | Critical | `NFR-9`, `API-1` | P6 | Extended (`install-family-surface`, `help-guide/coverage.json`) |
| `TC-ROOT-001` | Both files present: the current one loads, the prior one is reported not used, and any notice names the current path | Edge Case | Behaviour | Critical | `AC-F2-1` | P7 | Extended (`prior-identity-config-fallback`) |
| `TC-ROOT-002` | A migrated checkout and host emit zero prior-identity lines in human and `--json` mode, with payload and exit unchanged | Regression | Behaviour | Critical | `AC-F2-2` | P7 | Extended (`prior-identity-notice`, `prior-identity-hermetic`) |
| `TC-ROOT-003` | Prior only: exactly one `config-read` names both paths, the values carry the prior origin, and nothing is written there | Edge Case | Behaviour | Critical | `AC-F2-3` | P7 | New |
| `TC-ROOT-004` | The local overlay is `ci-disabled` under `CI=true`; the group document reads from the current path with absence as the empty listing; nothing is tracked and no template exists | Edge Case | Behaviour | Critical | `AC-F2-4` | P7 | Extended (`config-cli`, `projects` group battery) |
| `TC-IDENTITY-006` | The proof boundary is a permanent constant: eight proven, eight not-proven, in declared order, with every battery row on a proven id | Structure | Conformance | Critical | `NFR-1`, `DOD-5` | P7 | New |
| `TC-IDENTITY-001` | A clean home creates only current-identity paths on every surface, including the MCP composition with no configured name | Happy Path | Behaviour | Critical | `AC-F6-1` | P8 | New |
| `TC-IDENTITY-002` | The identity-derived override wins; the prior literal works with exactly one `override-read`; an invalid override is contained and never falls back | Edge Case | Behaviour | Critical | `AC-F6-2` | P8 | Extended (`identity-override`) |
| `TC-IDENTITY-003` | The eight owner-named pre-freeze variables are inert, `ADOS_FOO=bar` neither errors nor becomes a value, and `ADOS_WORKING_NAME` is the one declared override mapping | Regression | Behaviour | Critical | `AC-F6-3` | P8 | Extended (`legacy-adapter`, `config-cli`) |
| `TC-IDENTITY-005` | Exactly the five declared product-surface literal sites exist, the build-side site is unchanged, and the override name is not a committed literal | Structure | Checks | Critical | `AC-F6-5` | P8 | Extended (`branding-contract`) |
| `TC-SHIM-003` | Each read-only shim reads only at its declared site, emits one bounded notice per process per source kind, writes nothing to a prior root, and never enters a payload | Integration | Behaviour | Critical | `AC-F4-3` | P8 | Extended (`prior-identity-*`) |
| `TC-IDENTITY-004` | The enumerated pages and the prompt surface name the current identity, the reference pages agree with `--help`, and the generated projection matches its source | Integration | Checks | Critical | `AC-F6-4` | P9 | Extended (`doc-conformance`, projection build, page batteries) |

**Index/matrix parity.** The AC/NFR column of §5.1 mirrors the §3.1 matrix verbatim; if the two ever disagree, the matrix is authoritative and the index row is a defect. Recomputed from the matrix: **34 AC-linked / 2 NFR-only**, 36 cases, 6 groups.

### 5.2 Scenario Details

#### TC-LAYER-001 - The tracked set is exactly `.jaiship/config.yaml`, byte-identical to the pre-move blob, and empty under the prior root

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/namespace-layer.test.ts`
**Tags**: @backend, @namespace, @structure, @offline
**Seam**: `S-layer` — the tracked set read from git metadata plus the committed pre-move digest
**Fixture mechanism**: the committed pre-move digest is a **literal inside the suite** (a fixture constant), never a `git show <base>:…` read (§1.2); `git ls-files` is invoked over the repository root only.

**Preconditions**:
- The change head has landed the `P1` move.
- The pre-move blob digest of `.delivery-os/config.yaml` is recorded in the suite as a committed literal, captured once at `P1` and reviewed with the move.

**Steps**:
1. Read `git ls-files .jaiship/config.yaml`; assert the result is exactly that one path.
2. Compute the working-tree and index blob digest of `.jaiship/config.yaml`; assert it equals the recorded pre-move digest.
3. Read `git ls-files .delivery-os`; assert the set is empty.
4. Read `git ls-files` over the whole tree and assert no path is under a declared prior-namespace root prefix (`.delivery-os/`, `.delivery-os-state/`).
5. Assert the document's own top-level branches (`verify.suite-map`, `provider`) parse and that the parsed value equals the recorded pre-move parsed value (a structural equality, so a key reorder alone cannot pass as a byte change and a value change cannot pass as a reorder).

**Expected Outcome**:
- Exactly one tracked path under `.jaiship/`; digest equality with the recorded pre-move blob; zero tracked paths under a prior root.
- A content edit, a reformat, or a key rename fails by name with the expected/actual digest pair.

**Notes / Clarifications**:
- Mutation controls `M1` (content edit) and `M2` (leave the prior file tracked).
- Do not add a second tracked file under `.jaiship/` in this change; the assertion "exactly one" is what makes a stray committed `config.local.yaml` fail.

#### TC-LAYER-002 - Both ignore patterns are brand-free and root-anchored, cover the runtime write set, never match the tracked layer, and survive a future rename

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F1-3, DM-2, NFR-5, NFR-6
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ignore-rules.ts` (extended) + `tests/checks/ignore-rules-namespace.test.ts` (new mutation suite)
**Tags**: @backend, @namespace, @checks, @offline
**Seam**: `S-layer` — the ignore-rule hygiene check's coverage classes, rename simulation and rule-world probes
**Fixture mechanism**: the delivered rule-world builder (`mkdtemp` + the repository's real `.gitignore` + `git init` + `git check-ignore --no-index`), reused unchanged, so the probe is environment-independent.

**Preconditions**:
- `P1` has landed.
- The delivered four coverage classes, the brand-free `.*/config.local.yaml` glob, and the rename simulation are present.

**Steps**:
1. Assert a fifth coverage class exists for **runtime-written project files**, covering `.*/projects.yaml`.
2. Assert the new pattern is a glob containing `*` and is not a literal path (a literal `/.jaiship/projects.yaml` fails by name).
3. Run the rename simulation over the pattern: `.renamed-product/projects.yaml`, `.alt-brand/projects.yaml`, `.synthetic/projects.yaml` all match.
4. Assert the pattern does **not** match `packages/x/projects.yaml` (root-anchored by the embedded separator).
5. In the rule-world, assert `git check-ignore` reports `.jaiship/config.local.yaml` ignored, `.jaiship/projects.yaml` ignored, `packages/x/projects.yaml` **not** ignored, and `.jaiship/config.yaml` **not** ignored (the positive control).
6. Assert the delivered `.*/config.local.yaml` class, its rename simulation and its four probes are unchanged in behaviour.

**Expected Outcome**:
- Five coverage classes; two brand-free root-anchored globs; a future rename matches both; the tracked layer is never matched.
- A literal pattern, a glob that also matches the tracked file, or a dropped coverage class each fails by name.

**Notes / Clarifications**:
- Mutation controls `M3` (literal path) and `M4` (pattern matches the tracked layer). The nested-path non-match is a distinct assertion because a missing anchor would silently ignore every package's `projects.yaml`.
- This case owns the rule-world half of `AC-F1-3`; the scratch clone is `TC-LAYER-003`, because the two instruments prove different things (the rules versus the actual status).

#### TC-LAYER-003 - A scratch clone with no local exclude and the seeded write set reports an empty `git status --porcelain`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-3, DM-2, NFR-1, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-fresh-clone.test.ts`
**Tags**: @backend, @namespace, @checks, @offline, @clone
**Seam**: `S-clone` — a real clone of the change head with no `.git/info/exclude`
**Fixture mechanism**: driver `D5`: `git clone --no-local <repo> <tmp/tmpdir/clone>` (a local object copy without network), then assert `!exists(<clone>/.git/info/exclude)` explicitly so the drill cannot pass on a workstation exclude file.

**Preconditions**:
- `P1` has landed and the workspace tree is clean.
- `tmp/tmpdir` exists and `TMPDIR` points at it.

**Steps**:
1. Clone the repository into `tmp/tmpdir/namespace-clone-<n>`; assert there is no `.git/info/exclude` (or that the file holds no section naming `.delivery-os/` or `.jaiship/`).
2. Seed the declared runtime write set: `<clone>/.jaiship/config.local.yaml` and `<clone>/.jaiship/projects.yaml`, each with a marker body.
3. Run `git status --porcelain` in the clone; assert zero lines.
4. Assert `<clone>/.jaiship/config.yaml` exists and `git check-ignore --no-index .jaiship/config.yaml` reports **not** ignored.
5. Assert `git ls-files .delivery-os` in the clone is empty and no prior-root path exists in the clone.
6. Remove the clone in `finally`.

**Expected Outcome**:
- Zero porcelain lines with the write set seeded and no local exclude.
- A drill that depends on `.git/info/exclude`, on a symlink, or on an ignore rule that also covers the tracked file fails by name.

**Notes / Clarifications**:
- Mutation control `M5` (depend on `.git/info/exclude`). The case never writes to the workspace's index and never fetches.

#### TC-LAYER-004 - The composed read loads the current path, resolves the moved suite map the verify gate reads, and opens no prior path

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-2, AC-F1-4, DM-1, API-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/namespace-loaded-path.test.ts`
**Tags**: @backend, @namespace, @config, @offline
**Seam**: `S-configload` — `createProductionComposer` → `runEntrypoint` with counting filesystem facts and the notice sink
**Fixture mechanism**: the delivered `tests/fixtures/entrypoint/prior-identity/harness.ts` (`scratchCheckout`, `scratchHome`, the counting `FileSystemFacts` wrapper, the notice sink), extended with a per-opened-path recorder.

**Preconditions**:
- `P1` has landed; the scratch checkout materialises the moved document at `.jaiship/config.yaml`.
- The scratch home contains no prior namespace and no current host root (so no host-root selection occurs).

**Steps**:
1. Materialise a scratch checkout whose `.jaiship/config.yaml` holds a suite map with a distinctive marker, plus at least one `.delivery-os/` directory present on disk but holding a different suite map.
2. Run a composed invocation that resolves configuration and reports its origin (the delivered origin-reporting surface).
3. Assert the reported loaded origin path is `<checkout>/.jaiship/config.yaml`.
4. Assert the resolved suite entry equals the marker from the current file, so the value the verify gate would read is the moved document's.
5. Assert the opened-path recorder contains **zero** paths under `<checkout>/.delivery-os/`.
6. Assert zero `prior-identity-fallback` lines were emitted (the current file exists, so nothing was read).

**Expected Outcome**:
- Loaded file = the current path; resolved suite map = the moved document's; zero prior-root opens; zero notices.
- A read that falls back while the current file exists fails by name with both paths in the message.

**Notes / Clarifications**:
- This is the first half of the "one authoritative root" proof and it lands with the move, so a `P1` gate already shows that a fresh checkout resolves through the current identity rather than the fallback.

#### TC-SHIM-001 - The shim registry is shape-complete, id-unique, window-ordered, site-present, budget-bounded and wildcard-free

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-3, NFR-6
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/namespace-shims-registry.test.ts`
**Tags**: @backend, @namespace, @shims, @structure, @offline
**Seam**: `S-shimreg` — the registry validator over `scripts/checks/namespace-shims.registry.json`
**Fixture mechanism**: `tests/fixtures/namespace/shim-registry.ts` — the loader plus the six mutant builders (duplicate id, unknown kind/direction, empty sites, absent site, wildcard site, non-increasing window).

**Preconditions**:
- `P2` has landed; the registry declares the seven entries of spec Appendix F (`executable-alias`, `prior-config-directory`, `prior-state-root`, `prior-working-name-override`, `prior-environment-prefix`, `pre-freeze-environment-prefix`, `pre-freeze-config-directory`).
- The change's changeset exists, so the two delivery-os window values are derivable.

**Steps**:
1. Validate `schemaId` is `namespace.shims.v1` and that `window` defaults exist and are resolvable.
2. For every shim, assert all required fields are present and of the declared type: `id`, `kind`, `literal`, `direction`, `lineage`, `noticeId`, `notice`, `window`, `owner`, `sites[]`.
3. Assert ids are unique and that exactly one shim declares each of the seven literals in Appendix F.
4. Assert every `sites[]` entry is non-empty, is a file path or a path prefix ending in `/` (no `*`, no `**`, no glob), and **exists in the tree**.
5. Assert `removalRelease` is strictly greater than `declaredIn` under semver comparison for every `delivery-os`-lineage shim, and that every `pre-freeze`-lineage shim declares `removalRelease: null` plus a non-empty owner note.
6. Assert `notice` is one bounded sentence and each optional `maxOccurrences` is a positive integer.
7. Run each of the six mutant builders against the validator and assert each fails by name.

**Expected Outcome**:
- A clean registry validates; each mutant fails with its own message.
- The pre-freeze lineage cannot acquire a removal release that would be read onto the delivery-os schedule, and vice versa.

**Notes / Clarifications**:
- Mutation controls `M32` (drop an existing declared site), `M33` (wildcard site), `M34` (non-increasing window).
- This case is the `P2` gate; the content arm consumes the registry only at `P3`, so `TC-SCAN-001` cannot pass by an empty allowlist (`TC-SHIM-002` asserts both directions).

#### TC-SCAN-001 - The content arm fails by name for one planted occurrence per prior-namespace-carrying class and keeps the two non-carrying controls, the `SCOPE_ORG` neutral site and the ADR-0003 DEC-8 allowlist-independence control green

**Scenario Type**: Negative (mutation battery) with a green real-tree row
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-3, DM-4, NFR-5
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-conformance.test.ts` (extended `tests/checks/forbidden-literals.test.ts` for the registry shape)
**Tags**: @backend, @namespace, @checks, @offline, @mutation
**Seam**: `S-content` — `scan()` over a temp-copy repository, driven by the registry
**Fixture mechanism**: `tests/checks/fixture-repo.ts` (`createTempRepo`, `writeFiles`, `writeRegistry`, `liveRegistry`, `SCOPE_FILES`) reused unchanged, plus `tests/fixtures/namespace/seeds.ts` for the per-class sowers.

**Preconditions**:
- `P3` has landed: the two new scope classes (`promptSurface` root `.opencode`; `scriptSurface` roots `scripts`, `tools`), the five `priorNamespace` seeds, `scopeSelection`, `neutralSites` (including the `SCOPE_ORG` site), `declaredCorpora` and the `shimRegistry` pointer exist, and the delivered ADR-0003 DEC-8 class and its path allowlist are unchanged.
- `P2`'s registry validates, so an allowed site has an authority.

**Steps**:
1. Run `scan()` over the real tree; assert exit green, `7/7` scope classes reported, 0 violations, and no failure lines.
2. Assert the class-to-seed selection is explicit: exactly six classes carry the `priorNamespace` class (`packageTree`, `rootManifests`, `ignoreRules`, `promptSurface`, `scriptSurface`, `userFacingDocs`) and `rootWorkspaceFiles` does not.
3. Rows A–F — for each of the six carrying classes, sow one occurrence in a temp copy and assert exit 1 with the file, the line and the token in the message: (A) `.delivery-os/x` in `packages/`; (B) `DELIVERY_OS_FOO` in `package.json`; (C) `.delivery-os/` in `.gitignore`; (D) `.delivery-os/config.yaml` in an `.opencode/agent` file; (E) `~/.delivery-os` in a `scripts/` file; (F) `.delivery-os/config.yaml` in a registered doc.
4. Row G (control, class `rootWorkspaceFiles`): sow `.delivery-os/x` into `tsconfig.base.json` and assert the arm stays **green** for the prior-namespace seed, then sow `ADOS_` there and assert it **fails** for its ADR-0003 DEC-8 seed — proving the new class is additive and the old class still guards the class it always guarded.
5. Row H (control, executable seed in docs): sow a prose occurrence of the prior executable token into a registered doc and assert the arm stays **green**, pinning the declared `RSK-11` residual so an implementer cannot over-enforce and break the corpus.
6. Assert `scopeSelection` maps `promptSurface` and `scriptSurface` to the `priorNamespace` class **only**, by sowing `ADOS_FOO` in `scripts/` and `tools/` and asserting no ADR-0003 DEC-8 violation is reported.
7. Assert the delivered ADR-0003 DEC-8 five-class/three-seed/five-allowlist exact-shape validation still rejects a five-class registry (i.e. a registry missing the two new classes fails by name).
8. Row I — assert the `SCOPE_ORG` neutral site: `packages/core/src/branding/index.ts` is declared with `seed: "prior-executable"` and `maxOccurrences: 1`, the real tree is green because of that declaration, and a second occurrence in the same file fails by budget naming the file — so the occurrence is **declared neutral**, not excluded.
9. Row J — assert the ADR-0003 DEC-8 allowlist independence: sow a `.delivery-os` path in a file the frozen ADR-0003 DEC-8 path allowlist exempts (today `packages/adapters/src/legacy/index.ts`) and assert the arm still exits 1 naming it; assert the `seedLiterals` class keeps its own allowlist behaviour unchanged in the same run.
10. Row K — assert the two reworded pages are green without being declared: `doc/guides/opencode-model-configuration.md` presents `.jaiship/config.yaml` as the configuration path and `doc/overview/glossary.md`'s override and reference-declaration rows name the current channel and path, so neither page is a `neutralSite` and neither needs a shim site for those lines; the glossary's prior-namespace rows remain the declared site `DM-3` names.

**Expected Outcome**:
- Real tree green with 7 classes, the `SCOPE_ORG` neutral site and the reworded pages; six planted occurrences fail by name; both controls stay green for the seed they do not carry; a prior-namespace occurrence inside an ADR-0003 DEC-8 allowlisted path still fails; the ADR-0003 DEC-8 class keeps its exact shape with two classes added.
- A dropped class, a moved seed class, an over-broad application to `rootWorkspaceFiles`/docs, or an occurrence exempted by the frozen ADR-0003 DEC-8 path allowlist fails by name.

**Notes / Clarifications**:
- Mutation controls `M36` (plant `.delivery-os` under `packages/`, also the allowlist-independence mutant when planted in an allowlisted path) and `M37` (drop `promptSurface`). `M39` carries the neutral-domain control in both directions: widening the exclusion to every occurrence, or dropping the `SCOPE_ORG` neutral site (which makes the real tree fail naming `packages/core/src/branding/index.ts`). No new register row is added for the neutral site or the allowlist independence — they share `M39`'s and `M36`'s invariants.
- **Two distinct "non-carrying" facts are asserted separately and must not be conflated:** `rootWorkspaceFiles` does not carry the `priorNamespace` class at all (row G), while `userFacingDocs` carries the path and environment seeds but **not** the executable seed (row H). Spec `DM-4` and §5.1 F-5 are the source; §8.2 records this as a reading, not an invention.
- The three clean-tree facts the spec now declares explicitly are asserted here: the scope-org constant is a **neutral site** (not an exclusion), the two reworded pages are **reworded** (not declared), and the frozen ADR-0003 DEC-8 path allowlist **does not filter** the new class (the shim registry is its only site authority).
- Every mutation runs in a temp copy; the live tree is never written.

#### TC-SCAN-002 - The neutral-scope exclusions are structural: the scope sigil, the repository name and the scope-org neutral site pass, a product-identifier use of the prior executable fails, and an unscoped package name fails

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-2, DM-4, RSK-4
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-conformance.test.ts` (neutral-scope section) + `tests/fixtures/forbidden-literals/{true,false}-positives.json` (extended)
**Tags**: @backend, @namespace, @checks, @offline
**Seam**: `S-content` — the prior-namespace matcher with `excludePrecededBy: ["@"]` and `excludeWithin: ["agentic-delivery-os"]`
**Fixture mechanism**: the matcher is called directly (driver `D3`) plus a temp-copy repository run for the class-level consequences; `matchSeedLiteral`'s delivered longest-first, case-insensitive, lower-ASCII-delimited semantics are reused, never re-implemented.

**Preconditions**:
- `P3` has landed.
- The two exclusion rules are declared in the registry's seed entry (`prior-executable`), not hardcoded in the matcher.

**Steps**:
1. Row A: the line `import { x } from "@delivery-os/core";` yields **no** match.
2. Row B: the line `see the agentic-delivery-os repository` yields **no** match.
3. Row C: the line `run delivery-os migrate` yields a match on the executable token.
4. Row D: `@delivery-os` alone (the scope sigil with no path) yields no match, and `delivery-osx` yields no match (delimited on both sides).
5. Row E: a root manifest's `"name"` equal to the prior token is a declared `neutralSite` and does not fail the arm.
6. Row F: a new **unscoped** package name equal to the prior token in a package manifest fails by name.
7. Row G: `DELIVERY_OS_WORKING_NAME` resolves to the **longest** literal (`prior-working-name-override`), not to the bare prefix — asserted at matcher level here and reconciled at site level in `TC-SHIM-002`.
8. Add rows A–D and the negative clones to the matching corpora (`true-positives.json`, `false-positives.json`) so the semantics are pinned as data.
9. Row H: `SCOPE_ORG = "delivery-os"` in `packages/core/src/branding/index.ts` is a declared `neutralSite` for the `prior-executable` seed with `maxOccurrences: 1`; the arm stays green over the real tree, and a second `delivery-os` token in the same file fails by budget (the neutral site is a bounded declaration, not a blanket exclusion). Assert the same constant is **not** admitted by either structural exclusion (`@` or `agentic-delivery-os`), so the neutral site is the only reason it passes.
10. Assert the frozen ADR-0003 DEC-8 path allowlist is not consulted for this class: the matcher's neutral-domain inputs are `neutralSites[]`, `declaredCorpora[]` and the shim registry only.

**Expected Outcome**:
- Both neutral shapes and the scope-org neutral site pass; a product-identifier use fails; an unscoped package name fails; a second scope-org occurrence fails by budget.
- Widening the exclusion to "any occurrence of the token" fails row C; removing it fails rows A/B with a false positive named; dropping the neutral site fails row I on the real tree.

**Notes / Clarifications**:
- Mutation controls `M38` (remove the `@` exclusion) and `M39` (widen the exclusion to every occurrence, or drop the `SCOPE_ORG` neutral site — the two directions of the neutral-domain rule).
- The exclusion is **structural**, not discretionary: only the `@`-prefixed sigil and the repository name are admitted, which is what `RSK-4` requires the mutation to prove; a legitimate scope-org occurrence is admitted only through the **declared** neutral site, never through an exclusion.

#### TC-SHIM-002 - Both directions reconcile: every match lies in a declared site, corpus or neutral site, and every declared site is present and at or below its budget

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, F-5, AC-F4-2, DM-3, DM-4, NFR-6
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-conformance.test.ts` (reconciliation section)
**Tags**: @backend, @namespace, @shims, @checks, @offline
**Seam**: `S-content` + `S-shimreg` — the site reconciliation the content arm performs against the registry
**Fixture mechanism**: `tests/fixtures/namespace/seeds.ts` (sowers) plus the registry loader; a temp copy of the tree carries every mutation.

**Preconditions**:
- `P3` has landed; `TC-SHIM-001` is green, so the registry is shape-valid and every declared site exists.

**Steps**:
1. Run the content arm over the real tree; assert 0 violations and that every declared site is reported present and matched at or below its `maxOccurrences`.
2. Assert every **matched** occurrence in the six carrying classes resolves to a shim whose literal is the **longest** match at that position, and lies inside one of that shim's declared sites (or a declared corpus / neutral site).
3. Row A (undeclared occurrence): sow a new `DELIVERY_OS_CUSTOM` read outside every declared site and assert the arm exits 1 naming the file, line and token.
4. Row B (vanished site): delete a declared site's file in a temp copy and assert the arm exits 1 naming the missing declared site.
5. Row C (budget): add one occurrence above a budgeted site's `maxOccurrences` and assert exit 1 naming the site and the budget.
6. Row D (longest-literal precedence): assert the owner-hold example script's `DELIVERY_OS_OWNER_HOLD*` occurrences resolve to `prior-environment-prefix` and stay green, while a `DELIVERY_OS_WORKING_NAME` occurrence at the working-name shim's declared sites resolves to `prior-working-name-override` and also stays green.
7. Row E (declared corpus): assert an occurrence inside `doc/changes/`, `doc/decisions/`, an M1 snapshot command page, and the dated inception analysis record stays green, and that removing a prefix from `declaredCorpora` makes it fail.

**Expected Outcome**:
- Both directions green on the real tree; each of the five mutations fails by name.
- The both-directions check cannot pass vacuously: an empty registry fails `TC-SHIM-001` first, and a registry with no sites fails row B.

**Notes / Clarifications**:
- Mutation control `M31` (shortest-literal resolution: a bare `DELIVERY_OS_` occurrence resolving to `prior-working-name-override`).
- Row D is the load-bearing one for `AC-F4-2`'s satisfiability on a clean tree: without the `prior-environment-prefix` shim the owner-hold example would have no site authority and the reconciliation could not pass (spec Appendix F).

#### TC-SCAN-003 - The tree arm passes on the real tree: zero tracked prior paths, zero symlinks into one, the committed layer present, the runtime files ignored in a rule-world, and the prior-root prefix set read from the declaration and reported

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F5-3, AC-F1-2, DM-2
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/namespace-tree.ts` (new) + `tests/checks/namespace-tree.test.ts`
**Tags**: @backend, @namespace, @checks, @offline
**Seam**: `S-tree` — the tracked-set read, the symlink-mode read, the committed-layer presence, and the ignore probes
**Fixture mechanism**: `tests/fixtures/namespace/tree.ts` — a synthetic-tree builder that writes a real git index (including mode `120000` for a symlink) plus the rule-world ignore probe runner.

**Preconditions**:
- `P1` and `P4` have landed (`P1` moved the layer; `P4` authors the arm).
- `git ls-files -s` is available (it is the delivered read the scan already uses).

**Steps**:
1. Run `bun run scripts/checks/namespace-tree.ts` over the real tree; assert exit 0 with a per-check summary.
2. Assert zero tracked paths whose prefix is a declared prior-namespace root (`.delivery-os/`, `.delivery-os-state/`).
3. Assert zero tracked entries with mode `120000` whose resolved target lands under a prior root, and specifically that no tracked `.jaiship` entry links to `.delivery-os`.
4. Assert the tracked set **contains** `.jaiship/config.yaml` (so the check cannot pass by an empty tracked set).
5. In a rule-world seeded with the repository's own `.gitignore`, assert `.jaiship/config.local.yaml` and `.jaiship/projects.yaml` are ignored and `.jaiship/config.yaml` is not; then in a temp copy of the tree, add a tracked `.jaiship/projects.yaml` and assert the arm exits 1 naming that path.
6. Assert the check performs **0 writes** to the tree and completes within the declared bound.
7. Assert the arm **reports the prior-root prefixes it used**, and that the reported set equals the declared set read from the shim registry and the forbidden-literal registry (`prior-config-directory` `.delivery-os` with its home form, `prior-state-directory` `.delivery-os-state`) — never a hardcoded list. Assert the summary names each prefix once.
8. Mutation `M55` — hardcode the prefix set in the arm (drop `.delivery-os-state`, or add a literal that no declaration carries). Assert `TC-SCAN-003` fails by name on the reported-set equality while the real tree stays green (no tracked path matches either way) and `TC-SCAN-004`/`TC-SCAN-005` (and the runtime-file check of `AC-F5-3`) still pass — the failure is attributable to `AC-F1-2` alone.

**Expected Outcome**:
- Zero prior tracked paths, zero symlinks into one, the committed layer present, the runtime files ignored by the repository's own rules, and the prior-root prefix set read from the declaration and reported.
- A tracked runtime file fails by name even though it is ignored by pattern (the explicit-tracking case the ignore rules cannot see); a hardcoded prefix set fails the reported-set equality while the tree stays green.

**Notes / Clarifications**:
- This case is `AC-F1-2`'s real-tree half and `AC-F5-3`'s whole. The two synthetic controls are `TC-SCAN-004` and `TC-SCAN-005`.
- `M55` is the **only** register row whose expected failure is `AC-F1-2` alone; it is the mutation the spec names for the criterion's distinguishing property (the declared prefix set), not a restatement of the tracked-path checks.
- The check reads git metadata only; it never mutates the index and never fetches.

#### TC-SCAN-004 - Negative control A: a tracked `.jaiship -> .delivery-os` symlink fails by name

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F5-4, AC-F1-2
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-tree.test.ts` (control A)
**Tags**: @backend, @namespace, @checks, @offline, @negative-control
**Seam**: `S-tree` — the symlink-mode and target-resolution arm
**Fixture mechanism**: `tests/fixtures/namespace/tree.ts`: a synthetic tree with `git update-index --add --cacheinfo 120000,<blob>,.jaiship` whose blob content is `.delivery-os`, committed once, so the mode and target are real rather than simulated.

**Preconditions**:
- `P4` has landed.

**Steps**:
1. Build the synthetic tree with the exact owner-reported shape: a tracked `.jaiship` symlink whose target is `.delivery-os`.
2. Run the tree arm against that root.
3. Assert exit 1 and that the message names **both** the path (`.jaiship`) and the target (`.delivery-os`).
4. Assert the message is the symlink family, not the forbidden-literal family (the two arms must not be mislabelled).

**Expected Outcome**:
- Exit 1 naming the path and the target.
- A tree arm that resolves symlinks without reporting, or that reports only the path, fails this control.

**Notes / Clarifications**:
- Mutation control `M40` (become the tree under test). This is the owner's binding "reintroduced symlink fails the scan" clause (ticket comment 2026-11-19).
- The control's fixture never touches the real tree; it is a separate root under `tmp/tmpdir`.

#### TC-SCAN-005 - Negative control B: a tracked file under `.delivery-os/` fails by name

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F5-5, AC-F1-2
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-tree.test.ts` (control B)
**Tags**: @backend, @namespace, @checks, @offline, @negative-control
**Seam**: `S-tree` — the tracked-prefix arm
**Fixture mechanism**: `tests/fixtures/namespace/tree.ts`: a synthetic tree with one committed `.delivery-os/config.yaml`.

**Preconditions**:
- `P4` has landed.

**Steps**:
1. Build the synthetic tree with a tracked `.delivery-os/config.yaml` (the pre-change shape).
2. Run the tree arm against that root.
3. Assert exit 1 and that the message names the tracked path.
4. Assert a second tracked path under a deeper prior prefix (`.delivery-os-state/x`) also fails, so the prefix set is read from the declaration rather than hardcoded to one string.

**Expected Outcome**:
- Exit 1 naming the tracked path, for both declared prior prefixes.
- A prefix list narrowed to `.delivery-os/` alone fails the second assertion by name.

**Notes / Clarifications**:
- Mutation control `M41` (become the tree under test). This is the owner's binding "a new file under the prior root fails the scan" clause.

#### TC-SCAN-006 - Both arms are CI-bound, non-advisory, in the aggregate, and deterministic within the declared bound

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-6, API-7, NFR-1, NFR-5
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-gate-binding.test.ts` + `scripts/checks/ci-topology.ts` (extended) + `.github/workflows/ci.yml` + `package.json`
**Tags**: @backend, @namespace, @checks, @ci, @offline
**Seam**: `S-content` + `S-tree` + the delivered topology/bindingness checks
**Fixture mechanism**: the delivered `ci-topology.ts` and `ci-bindingness.ts` invariants, plus a YAML-text mutant fixture built in memory (a mutated workflow string fed to the validator).

**Preconditions**:
- `P3` and `P4` have landed; both arms run green on the real tree.

**Steps**:
1. Assert `bun run scripts/checks/forbidden-literals.ts` exits 0 with a `7/7` class summary and that `bun run scripts/checks/namespace-tree.ts` exits 0 with its per-check summary.
2. Assert `ts-forbidden-literals` is unchanged as the content arm's job and that the tree arm is declared as a new `ts-*` job carrying `permissions: contents: read`, no `continue-on-error`, and a step whose `run` body contains the registry's `corpusBaseline` commit.
3. Feed the topology validator a workflow string with `continue-on-error: true` on the tree-arm job and assert it fails naming the job as advisory; feed one with the baseline-fetch step removed and assert it fails naming the missing fetch.
4. Assert both arms are reached from `pnpm check` (the aggregate script's chain) and that no check is skipped, disabled, or made vacuous.
5. Run each arm twice over the same tree and assert identical output after canonicalisation, and assert the completed wall time is within the declared bound.
6. Assert 0 writes: the tree's `git status --porcelain` is unchanged before and after both runs.

**Expected Outcome**:
- Both arms in the aggregate and bound in CI as blocking jobs; each mutant fails by name; two runs identical; 0 writes.
- An advisory job, a bypass construct, or a missing baseline fetch fails by name — the posture the spec's security review requires.

**Notes / Clarifications**:
- Mutation controls `M42` (`continue-on-error: true`) and `M43` (missing baseline fetch).

#### TC-MIGRATE-001 - Every declared flag performs its effect and every admission refusal is its delivered identity with zero writes, including the symlink dispositions and the `unscoped` project scope

**Scenario Type**: Negative (refusal battery) with green rows
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, API-1, API-2, DM-6, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§1: grammar and admission)
**Tags**: @backend, @install, @migration, @offline
**Seam**: `S-guard` + the `install` command definition through `runCli` (driver `D2`)
**Fixture mechanism**: `tests/fixtures/install/{home,checkouts,daemon,artifact}.ts` (`createInstallScratch`, `createFixtureCheckouts`, `createRecordingDaemon`, `createFixtureArtifact`) plus `tests/fixtures/migration/filesystem.ts` for the write recorder.

**Preconditions**:
- `P5` has landed.
- One scratch home and one scratch checkout per row; the dev-build row uses a runtime with no injected identity; the worktree row uses the harness's linked worktree; the alias row uses the `delivery-os` bin.

**Steps**:
1. Green rows: `install migrate --dry-run`, `install migrate --dry-run --json`, `install migrate --dry-run --verbose`, and `install migrate --dry-run --pretty` all exit with a plan and never a refusal (the global flags are accepted, not refusals).
2. Undeclared flag: `install migrate --force` → `fallback.invocation`, exit 1, 0 writes, 0 directories.
3. `--backup-dir relative/path` → `input.value.rejected`, exit 1, 0 writes.
4. `--backup-dir <inside the source root>` (one row per root class) → `input.value.rejected`, exit 1, 0 writes.
5. Alias: `delivery-os install migrate` → `install.identity.not-owning`, exit 1, 0 writes.
6. Dev build: a run with no injected identity → `install.dev-build`, exit 1, 0 writes.
7. Linked worktree target → `install.target.worktree`, exit 1, 0 writes.
8. For every refusal row, assert the write recorder saw **0 writes** and the directory-creation recorder saw **0 creations**, and that no state record was appended.
9. Assert each exit is the delivered projection of its identity (through `ERROR_TABLE`), never a literal digit.
10. Source symlink: a symlink entry in a source root (for example `bin/<launcher>`) takes the disposition `blocked`; assert it is retained, its target is never followed, its bytes are unchanged, the payload names the absolute path and the remedy, and the run exits 1.
11. Destination symlink: a destination root or entry that resolves through a symlink into a prior root — the exact untracked `.jaiship -> .delivery-os` shape at the project root — takes the disposition `conflict`; assert the link is retained, nothing is written through it (the recorder shows no write under the link target), the absolute path and remedy are reported, and the run exits 1.
12. Unscoped project class: invoke from outside a work tree; assert the project class reports `scope: unscoped` with no source, no destination, no entries and no verdict, the two host classes still plan and apply, and the run verdict composes from the host dispositions alone (`migrated` with exit 0 on a clean host world). Assert `unscoped` never appears as a disposition.

**Expected Outcome**:
- Every declaration performs its effect; every refusal is its delivered identity with a zero-write, zero-directory, zero-append consequence; a source symlink is `blocked` and a destination symlink `conflict`, both retained with path and remedy at exit 1; an invocation outside a work tree reports `unscoped` and still migrates the two host classes.
- An accepted undeclared flag, a resolved relative backup path, a refusal that wrote anything, a followed or moved symlink, or an `unscoped` root carrying entries or a verdict fails by name.

**Notes / Clarifications**:
- Mutation controls `M10` (accept an undeclared flag), `M11` (resolve a relative `--backup-dir`), `M12` (accept an in-source `--backup-dir`), `M13` (let the alias migrate), `M14` (skip dev-build/worktree admission), and `M19`'s symlink branch (follow or move a symlink entry instead of retaining it).
- The symlink rows are data-bearing, not error-bearing: neither link produces a new identity (`DM-8`), and neither side is followed (`DM-6`'s symlink rule, evaluated before the byte rules).
- The `unscoped` row asserts a **scope** value, never a disposition: the closed dispositions stay six, the closed verdicts stay five, and the two host classes still migrate.
- The `--backup-dir` rows apply in `--dry-run` too: admission precedes planning (§8.2 assumption on AC-F3-2's "exit 0" scope).

#### TC-MIGRATE-002 - A live daemon is refused without `--stop-daemon`; with it the daemon stops before the first move and is not restarted; a dry run with the flag still reads no daemon

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, API-1, RSK-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§1: daemon guard and ordering)
**Tags**: @backend, @install, @migration, @daemon, @offline
**Seam**: `S-guard` — the delivered daemon guard and stop path, composed over the recording daemon port
**Fixture mechanism**: `tests/fixtures/install/daemon.ts` (`createRecordingDaemon`) plus `tests/fixtures/migration/guards.ts` for the ordering recorder that stamps `stop` and `move 1` with the same monotonic counter.

**Preconditions**:
- `P5` has landed.
- The scratch home holds the three root classes with at least two planned moves; the daemon double is live.

**Steps**:
1. `install migrate` with the daemon live and no `--stop-daemon` → `install.daemon.running`, exit 1, 0 writes, 0 moves, 0 backup directories.
2. `install migrate --dry-run` with the daemon live → a plan, `daemon: unchecked`, `install.daemon.running` never, 0 daemon-port calls, 0 writes.
3. `install migrate --stop-daemon` with the daemon live → the plan proceeds; assert the ordering record is `stop` then `move 1` (the stop strictly precedes the first move).
4. Assert the daemon is **not** restarted: the port's start/spawn count is 0 after the run.
5. Assert the machine payload's `daemon` field is `stopped` for step 3 and `unchecked` for step 2, never `running`.
6. Assert the refusal rows recorded 0 daemon stops (a refused run never touches the daemon).
7. `install migrate --dry-run --stop-daemon` with the daemon live → assert the plan is produced, `daemon: unchecked`, the port recorded **0** calls (no probe, no stop), and 0 writes and 0 directory creations; the accepted flag combination does not make dry-run evaluate or stop the daemon.

**Expected Outcome**:
- Refused without the flag with a zero-write consequence; with the flag the stop precedes the first move and no restart follows; dry-run never reaches the port, whether or not `--stop-daemon` is present.
- A move before the stop, a restart, or a dry-run that evaluates or stops the daemon (including the `--dry-run --stop-daemon` combination) fails by name.

**Notes / Clarifications**:
- Mutation controls `M15` (move before stop) and `M16` (evaluate the guard during dry-run; the `--dry-run --stop-daemon` row is the same invariant's second shape).
- The ordering observation is a recorder fact, not a timing assertion, so it cannot flake.

#### TC-MIGRATE-003 - Dry-run prints the complete plan within the `NFR-2` bound with its single truncation line, writes nothing, creates no directory, appends no record of any kind, reads no daemon, and two runs are identical

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, API-2, NFR-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§2: plan)
**Tags**: @backend, @install, @migration, @plan, @offline
**Seam**: `S-plan` — the plan builder plus the human and `--json` renderers
**Fixture mechanism**: `tests/fixtures/migration/{roots,filesystem,plan}.ts`: a seeded three-root world with known file and byte counts, a write/creation recorder, and the canonicaliser for the double-run comparison.

**Preconditions**:
- `P5` has landed.
- The seeded world contains: a host configuration root with `config.yaml`, `install.json` and a `bin/` subdirectory; a host state root with `host-index.json` and a `projects/<key>/` subtree; a project configuration root with one file. The scratch home holds a prior namespace, so the plan has entries.
- The clock is pinned to a fixed instant.

**Steps**:
1. Run `install migrate --dry-run`; capture stdout, stderr and exit.
2. Assert one header line per root class, one line per planned entry with `<disposition> <path> · <files> file(s) · <bytes> byte(s)`, one backup line with an absolute path, and the trailing `daemon: unchecked`.
3. Assert ≤ 60 human lines (the `NFR-2` plan bound), 0 ANSI escapes, every line ≤ 512 bytes, and one line per planned entry within the bound.
4. Run the same state with `--json`; assert `install.migration.plan.v1`, ≤ 65 536 bytes, the field set of `API-2`, the closed `scope` values, and dispositions from the closed six.
5. Assert the write recorder saw 0 writes, the creation recorder saw **0 directory creations including no backup directory**, the store saw **0 records appended of any kind** (neither a migration record nor the delivered command-audit pair), and the daemon port saw 0 calls.
6. Assert exit 0 on both runs.
7. Run the human dry-run a second time from a fresh but identical scratch world at the same pinned instant; assert the canonicalised output is byte-identical (the run stamp is derived from the injected clock, §8.2 assumption).
8. Seed a world with more entries than the line bound and assert the output is ≤ 60 lines with **exactly one** counted `… N more` truncation line, that the count equals the number of planned entries omitted, and that no entry line is cut mid-line or duplicated.

**Expected Outcome**:
- A complete, bounded, ANSI-free plan with the would-be backup path and `daemon: unchecked`; 0 writes, 0 creations, 0 records, 0 daemon reads; the over-bound world truncates to one counted `… N more` line inside the 60-line bound; two runs identical.
- A dry-run that creates the backup directory, appends the audit pair (or any record), consults the daemon, exceeds the line bound without its single truncation line, or varies between runs fails by name.

**Notes / Clarifications**:
- Mutation controls `M17` (create the backup directory during dry-run, or append the delivered command-audit pair) and `M18` (take the run stamp from ambient time).
- NFR-1's determinism is attained because the composition injects `clock`; a plan built from `Date.now()` fails step 7, which is the intended testability consequence.
- Step 8 is `AC-F3-2`'s `NFR-2` consequence: the criterion's one-line-per-entry claim holds **within** the bound and degrades only through the single counted truncation line. The payload id is `install.migration.plan.v1`; the manifest's `install.migration.manifest.v1` is asserted in `TC-MIGRATE-004`.

#### TC-MIGRATE-004 - A clean migration moves every entry with digests intact, writes a complete manifest under its own schema id and the delivered command-audit pair at the destination, reports the managed-`PATH` residual, retires the emptied roots, and reports `migrated`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, API-2, DM-5, DM-6, DM-7, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§3: apply)
**Tags**: @backend, @install, @migration, @backup, @offline
**Seam**: `S-apply` + `S-manifest` — the apply step and the backup/manifest writer over injected filesystem facts
**Fixture mechanism**: `tests/fixtures/migration/{roots,manifest,filesystem}.ts`; `digestsOf(tree)` before and after; the manifest reader.

**Preconditions**:
- `P5` has landed.
- Three root classes present, no destination conflicts; every source entry has a recorded pre-move digest.
- The scratch machine's shell profile carries a delivered managed `PATH` block whose recorded install directory is under the prior root (`~/.delivery-os/bin`), and the profile file's bytes are snapshotted.
- The backup root is the default (inside the current configuration root) unless a row overrides it.

**Steps**:
1. Snapshot every source file's digest and each state store's record set.
2. Run `install migrate`; capture the payload and exit.
3. Assert every planned entry is `moved`, every moved file's digest equals its pre-move digest, and the source entries are gone.
4. Assert `<backup>/<stamp>/manifest.json` exists, is `install.migration.manifest.v1`, and its `entries[]` covers **every** moved file with `relativePath`, `size` and `sha256`; assert the per-root subtrees hold byte copies. Assert the machine payload is `install.migration.plan.v1`, that the two documents carry **distinct** ids, and that each validates against its own declared shape (a validator keyed on the manifest id does not accept the payload, and vice versa).
5. Assert every file the manifest lists exists in the backup with the manifest's digest.
6. Assert every emptied source root that existed at plan time is reported in `retiredRoots[]` and no longer exists; assert a non-emptied root keeps its residual paths in `residuals[]`.
7. Assert `verdict: migrated`, `exit 0`, and the exact store-write set: **exactly two** audit records (`audit.reservation` then `audit.invocation`) at the **destination** host state root, **zero** migration records, **zero** delivery records, **zero** writes to any prior root including the audit store, and 0 install-record fields written. Assert the audit pair's ordering record places both writes after the plan is composed and before the first move.
8. Assert the managed-`PATH` residual: `residuals[]` carries one line naming the recorded block under the prior root with the remedy "re-run the installed artifact's `install`", the profile file's bytes are unchanged, and the write recorder shows **0** writes to the profile; assert a block naming the current install directory produces no residual.
9. Assert the human run is ≤ 60 lines and ANSI-free.
10. Repeat the run with `--backup-dir <absolute temp path>` and assert the same verdict with the backup at the override path.

**Expected Outcome**:
- All entries moved with digest equality; a complete manifest under its own schema id with byte copies; the audit pair (and nothing else) at the destination root; the managed-`PATH` residual reported with its remedy and the profile untouched; retired roots reported; `migrated` at exit 0.
- A manifest missing an entry, a digest mismatch, a shared schema id across the two documents, a migration record or a delivery record written, an audit write in a source root, a profile edit, or a silently deleted unmoved entry fails by name.

**Notes / Clarifications**:
- Mutation controls `M23` (skip the manifest, or label it with the plan payload's schema id), `M24` (move before verifying the copy, or write the command-audit pair into a source root), and `M19`'s no-delete branch where a residual entry is involved.
- The command-audit pair is the **delivered** record every command writes; it is not a migration record, it is never in the plan's `entries[]`, and `TC-MIGRATE-010` asserts the same destination-side location after the move. A prior-root write of any kind — audit included — is the `F-2`/`API-4` zero-prior-write violation this step exists to catch.
- The managed-`PATH` residual is detection only: the migration never reads a profile for writing and never edits one (`DM-6`, `§22`); the remedy belongs to the `install` family that owns the block.
- The manifest's `entries[]` completeness is what makes `NFR-4`'s "backup complete for all *n*" assertable in `TC-MIGRATE-008`.

#### TC-MIGRATE-005 - A second run moves nothing, creates no backup, reports `already-migrated`, leaves both roots byte-identical, and never retires or reports a root that never existed

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§4: idempotence)
**Tags**: @backend, @install, @migration, @idempotence, @offline
**Seam**: `S-plan` + `S-apply` — the decision table on a clean result
**Fixture mechanism**: the same world as `TC-MIGRATE-004`, re-used immediately after it, so the second run is asserted against the first run's real post-state.

**Preconditions**:
- `TC-MIGRATE-004`'s world has completed a `migrated` run in this case's setup (the case builds the post-state by running the migration, it does not hand-fabricate it).

**Steps**:
1. Snapshot every destination file's digest and count the backup directories under the backup root.
2. Run `install migrate` again.
3. Assert every **non-derived** source entry is `absent` and every destination entry `already-migrated`; assert the retained derived entry (the source `host-index.json`) again reports `already-migrated` with its derived reason and is still never moved.
4. Assert 0 files moved, 0 backup directories created (the count is unchanged), and no new `manifest.json`.
5. Assert `verdict: already-migrated`, `exit 0`.
6. Assert every destination file's digest is unchanged, so both roots are byte-identical to the post-first-run state.
7. Assert the payload uses the same closed vocabulary (no `noop`, `skipped`, or free-text token), and that the run's only store write is the delivered command-audit pair at the destination root — no migration record, no install-record field, no prior-root write.
8. Run a world in which one root class **never existed** (no prior project configuration root at plan time): assert the run reports `already-migrated`, that the never-existent root is **neither removed nor reported** in `retiredRoots[]` or `residuals[]`, and that retirement applies only to a root that existed at plan time.

**Expected Outcome**:
- 0 moves, 0 backups, `already-migrated`, exit 0, byte-identical roots; the audit pair is the only write; a never-existent root is neither retired nor reported.
- A second run that creates a backup, reports `migrated`, rewrites a file, appends a migration record, or "retires" a root that never existed fails by name.

**Notes / Clarifications**:
- Mutation control `M26` (second run creates a backup and reports `migrated`, or appends a migration-specific record). The never-existent-root row is asserted directly: no mutation distinguishes a root that was never there from one that was emptied, because the defect is a report line, not a destructive write.

#### TC-MIGRATE-006 - The `DM-6` disposition matrix holds row by row, the verdict follows DM-6's composition rule, and no differing byte is ever deleted or overwritten

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-5, DM-6, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§5: precedence and conflicts)
**Tags**: @backend, @install, @migration, @precedence, @offline
**Seam**: `S-plan` — the ordered per-entry decision table, called directly (driver `D3`) and through the command
**Fixture mechanism**: `tests/fixtures/migration/roots.ts` builds one world per row; `tests/fixtures/install/destinations.ts` (`placeDestination`) supplies the agreeing/differing/symlink destination states.

**Preconditions**:
- `P5` has landed.
- One seeded world per row, each with a single entry under one root class, plus one mixed world.

**Steps**:
1. Row 1 — source absent, destination absent → `absent`, exit 0, nothing created.
2. Row 2 — source absent, destination present → `already-migrated`, exit 0.
3. Row 3 — source present, destination absent → `moved`, source gone, destination digest equal.
4. Row 4 — both present, byte-identical → `duplicate-identical`; assert **both** sides retained and no byte changed.
5. Row 5 — both present, differing, entry not in the derived set → `conflict`; assert both sides retained with their original digests and the run exits 1.
6. Row 6 (mixed world) — source-only + duplicate + conflict together → assert the three dispositions, the conflict retention, `verdict: partial` (the maximum is `conflict` **and** at least one planned move completed), exit 1, and a byte-level before/after comparison of **both** trees proving no differing byte was deleted or overwritten. Add a conflicts-only world and assert `verdict: conflict` (nothing moved), exit 1.
7. Assert a duplicates-only world yields no conflict, exit 0, and verdict `migrated`: under `DM-6`'s stated composition rule the maximum is `duplicate-identical`, a retained success (§8.2 `A5` records the rule, it does not invent it).
8. Assert every disposition is drawn from the closed six and every verdict from the closed five.

**Expected Outcome**:
- Each row's disposition and consequence; the mixed run is `partial` at exit 1 with nothing lost, a conflicts-only run is `conflict` at exit 1, and a duplicates-only run is `migrated` at exit 0.
- Treating a difference as a duplicate, deleting a conflict, reporting `conflict` when a planned move completed, or exiting 0 on a conflict fails by name.

**Notes / Clarifications**:
- Mutation controls `M19` (delete a differing destination, or follow/move a symlink entry), `M20` (report a conflict as `duplicate-identical` and drop the source), `M25` (delete a `duplicate-identical` entry).
- `DEC-4` is the reason a whole-root "both present ⇒ skip" rule is not acceptable: on a real machine the destination usually exists, so row-level decisions are what make the primary case migratable.
- The verdict composition asserted here is `DM-6`'s single stated rule — `migrated` < `duplicate-identical` < `conflict` < `blocked`, with `absent`/`already-migrated` neutral — not a test-local severity order.

#### TC-MIGRATE-007 - The derived host index takes `already-migrated` (or `absent`): reported with its reason, never rewritten, never in the source-move set, never a conflict

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-5, DM-6, DM-7, RSK-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§6: derived entries)
**Tags**: @backend, @install, @migration, @derived, @offline
**Seam**: `S-plan` — the declared derived-entry set read as data
**Fixture mechanism**: `tests/fixtures/migration/roots.ts` with a deliberately stale `host-index.json` on both sides, plus `tests/fixtures/install/state-roots.ts`.

**Preconditions**:
- `P5` has landed.
- The source and destination host state roots each hold a `host-index.json` whose `stateLocation` values differ.
- A second world has a source `host-index.json` and **no** destination copy.

**Steps**:
1. Run `install migrate` over the world.
2. Assert the derived entry's disposition is `already-migrated`, with the reported derived reason (the destination copy wins); assert it is **never** in the source-move set and **never** `conflict`. In the second world (no destination copy) assert the disposition is `absent`, still never moved.
3. Assert the run's verdict is not `conflict` on account of the derived entry: under `DM-6`'s composition rule `already-migrated` and `absent` are neutral, so the run reports `already-migrated` and exits 0 when nothing else fails.
4. Assert the destination `host-index.json` bytes are **unchanged** (no rewrite during the move).
5. Assert the source `host-index.json` is **retained**: the derived entry is never moved and never deleted, so the source root keeps it as a reported residual rather than being retired on its account.
6. Add a second, non-derived differing entry to the same world and assert it still produces a `conflict`, proving the derived rule is a named set and not a blanket "indexes are ignored".

**Expected Outcome**:
- The derived entry is `already-migrated` (or `absent` when no destination copy exists), reported with its reason, never moved, never a conflict, and never rewritten; the run verdict treats it as neutral; a non-derived difference still conflicts.
- Rewriting the index during the move, treating it as a conflict, moving it, or emitting a `destination-wins` disposition token outside the closed six fails by name.

**Notes / Clarifications**:
- Mutation controls `M21` (derived entry reported as a conflict) and `M22` (index rewritten).
- `destination-wins` was never a disposition: the closed six are `moved`, `already-migrated`, `duplicate-identical`, `conflict`, `blocked`, `absent`, and "the destination copy wins" is the **reason** reported on an `already-migrated` entry. The case asserts the disposition token, so the implementation cannot invent a seventh.
- The declared derived set is data (`host-index.json` today); adding an entry is a reviewed change, which is why the case asserts the *set*.

#### TC-MIGRATE-008 - A failure after *k* of *n* moves leaves the remainder intact and the backup complete, and the re-run completes without duplicating

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-6, NFR-4, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§7: recovery)
**Tags**: @backend, @install, @migration, @recovery, @offline
**Seam**: `S-apply` — the apply loop over a filesystem double that fails at a fixed ordinal
**Fixture mechanism**: `tests/fixtures/install/faults.ts` (`faultAt`) extended by `tests/fixtures/migration/filesystem.ts` (`failAtOrdinal(n)`); the manifest reader from `manifest.ts`.

**Preconditions**:
- `P5` has landed.
- A world with *n* ≥ 4 planned entries and a fixed failure ordinal *k* (1 ≤ *k* < *n*).

**Steps**:
1. Run `install migrate` with the failure injected at ordinal *k*.
2. Assert the *k* entries before the failure are at their destination with digests intact, and the *n−k* unmoved entries are intact in the **source**.
3. Assert the backup is complete for **all *n*** planned entries (the manifest lists *n*; every listed file is present with its digest), because the backup precedes every move.
4. Assert the payload names the moved set and the unmoved set and reports the backup path.
5. Assert the exit and the reported verdict per the PM ruling on `OQ-TP-1`: exit 1 with verdict `blocked` or `partial`, no new error identity; `state.write.failed` is reserved for a failure outside the apply loop (backup or manifest write).
6. Clear the injection and run again; assert the remainder completes, no already-moved entry is duplicated at the destination (one file per relative path, digest equal), and the final verdict is `already-migrated`.
7. Assert the second run creates at most one new backup and that the recovery does not re-copy an already-migrated entry.

**Expected Outcome**:
- The unmoved remainder intact, the backup complete for all *n*, the payload naming both sets, and a re-run that completes without duplication.
- Re-copying a moved entry, truncating the backup at *k*, or losing an unmoved source entry fails by name.

**Notes / Clarifications**:
- Mutation control `M27` (re-copy an already-moved entry on the recovery run).
- Step 5 is now settled by the PM ruling on `OQ-TP-1` (2026-11-21): a failure of a **planned move** inside the apply loop is governed by `AC-F3-6` (exit 1, a data-bearing `blocked` or `partial` verdict, the moved and unmoved sets named, no new error identity), while `state.write.failed` (platform-provider, exit 2) is reserved for a failure **outside** the apply loop — writing the backup copy or the manifest. The ruling adds no identity and changes no projection row; §8.3 records the disposition and §8.4 its status.

#### TC-MIGRATE-009 - The state move preserves every byte, re-versions nothing, and leaves `install status`'s compatibility verdict identical

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-7, DM-7, NFR-3, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§8: byte preservation) + a structure assertion on the accepted-format constant
**Tags**: @backend, @install, @migration, @state, @offline
**Seam**: `S-apply` — the rename/copy-merge step over real bytes on disk
**Fixture mechanism**: `tests/fixtures/install/state-roots.ts` (`writeHeader`, `plantForeignRecord`), `tests/fixtures/migration/manifest.ts` (`digestsOf`), and the delivered `install status` read.

**Preconditions**:
- `P5` has landed.
- A seeded host state root with at least two `header.<workspace>.json` files, several record files, a container `projects/<key>/` subtree, and one deliberately foreign record.

**Steps**:
1. Read `install status` before the move; record its compatibility verdict.
2. Snapshot every file's digest under the state root and read each header's recorded format identifier.
3. Run `install migrate`.
4. Assert every file's post-move digest equals its pre-move digest, and every header's recorded format identifier is unchanged.
5. Assert no record payload was re-serialised: assert byte identity, not just semantic equality, per file.
6. Read `install status` after the move; assert the compatibility verdict is identical to step 1's.
7. Assert the artifact's accepted state format is unchanged — as a structure assertion over the exported constant compared to a committed literal baseline in the suite, not a diff against a branch.
8. Assert the foreign record's bytes are preserved and no schema-version file was added.

**Expected Outcome**:
- Byte for byte identical, same identifiers, same `install status` verdict, unchanged accepted format.
- Any rewrite, re-serialisation, or version bump fails by name with the digest pair.

**Notes / Clarifications**:
- Mutation controls `M28` (re-serialise headers) and `M29` (the move changes the `install status` verdict).
- `TDR-0047` is the binding constraint: the move may not re-version a stored record, and the battery proves it from digests rather than from a schema check alone.

#### TC-MIGRATE-010 - After the move every reported state location is under the new host root and an index disagreement warns without redirecting a read

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-8, DM-7, RSK-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-migrate.test.ts` (§9: post-move locations)
**Tags**: @backend, @install, @migration, @state, @offline
**Seam**: `S-apply` composed with the delivered host-index maintenance and store-opening read
**Fixture mechanism**: `tests/fixtures/daemon/mount-harness.ts` (a real scratch host root and a recording process/clock port) with a deliberately stale `host-index.json` copied through the migration, plus the opened-path recorder.

**Preconditions**:
- `P5` has landed; the world has been migrated by this case's setup.
- A stale `host-index.json` at the new root records `stateLocation` values pointing at the **prior** root.

**Steps**:
1. Open the store and run `repos list` and `projects list`.
2. Assert every reported state location is under the new host root.
3. Assert the opened-path recorder shows **zero** opens under the prior root.
4. Assert the index disagreement is reported as the delivered warning and that the warning does not redirect the read (the read still resolves under the new root).
5. Assert the host index is re-derived from the key rather than trusted, by mutating one `stateLocation` and re-running: the reported location follows the key, not the stale value.
6. Assert the run's store-write set at the destination root: exactly the delivered command-audit pair (`audit.reservation`, `audit.invocation`), no migration record, zero writes to any prior root including the audit store, and no schema or state-format identifier change.

**Expected Outcome**:
- All locations under the new root; zero prior opens; the warning present and non-redirecting; the audit pair at the destination root and nothing else.
- A read that trusts the stale index and opens the prior root fails by name with the path; so does a migration record, a delivery record, or an audit write in a source root.

**Notes / Clarifications**:
- Mutation control `M30` (let the stale index redirect a read), plus `M26`'s record branch for a migration record and `M24`'s audit branch for an audit write in a source root.
- This is `RSK-6`'s proof: "the index is a derived cache that re-derives every state location from its key and reports a disagreement as a warning that never redirects a read."
- The audit assertion is the same fact `TC-MIGRATE-004` step 7 asserts at plan/apply time, re-read after the move: the pair is the delivered command record, located at the destination, never a migration record and never in a source root.

#### TC-SHIM-004 - The alias refuses the migrate verb, carries the deprecation sentence in `--help`, and keeps its payloads and `--version` byte-unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-4, API-1, DM-3, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-family-surface.test.ts` (extended) + `tests/structure/install-ownership-split.test.ts` + the rendered-help assertion in `tests/structure/entrypoint-bin.test.ts`
**Tags**: @backend, @install, @alias, @offline
**Seam**: `S-help` + the `delivery-os` bin composition
**Fixture mechanism**: the delivered alias battery plus the renderer that produces `--help` for the alias at the current change head; the golden payload and `--version` strings are committed literals in the suite.

**Preconditions**:
- `P5` has landed (the verb exists, so a refusal has something to refuse).
- The change's window values are settled (the registry declares them), so the deprecation sentence can name a removal release.

**Steps**:
1. Drive `delivery-os install migrate` and every other lifecycle entry point the alias composes; assert `install.identity.not-owning` at exit 1 and 0 writes for each.
2. Render `delivery-os --help`; assert it contains the declared deprecation sentence naming the removal release read from the registry (not a hardcoded string in the test).
3. Assert the sentence is one bounded line and does not claim the alias is a current identity.
4. Assert `delivery-os --version` is byte-unchanged against the committed literal.
5. Assert a representative machine payload from an alias invocation is byte-unchanged against its committed golden.
6. Assert the alias still performs its non-lifecycle composition (so the refusal is scoped, not a blanket disable).

**Expected Outcome**:
- Every lifecycle entry point refused with `install.identity.not-owning` and 0 writes; the deprecation sentence present and registry-derived; `--version` and payloads byte-unchanged.
- A missing sentence, a sentence naming a different release than the registry, or a changed `--version` fails by name.

**Notes / Clarifications**:
- The doc-facing half of `AC-F4-4` is the rendered `--help`; the *page* agreement is `TC-IDENTITY-004`, because the install reference page is reconciled in `P9`. Splitting them keeps this case green at `P5`.

#### TC-MIGRATE-011 - The retired error identity is removed from the code table and every pinned corpus, not relaxed

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, API-3, DM-8, NFR-8, RSK-7
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/install-migration-retirement.test.ts` + extended `tests/checks/{install-lifecycle-docs,error-table-sync}.test.ts` + `tests/structure/cross-repository-contract.test.ts`
**Tags**: @backend, @install, @migration, @retirement, @checks, @offline
**Seam**: `S-shimreg`-adjacent contract surface: the install domain codes, the error table, the result-code corpora, and the guide's requirement set
**Fixture mechanism**: the delivered `ERROR_TABLE`, `INSTALL_DOMAIN_CODES`, `tests/fixtures/result/code-corpora/*.json`, and `GUIDE_REQUIREMENTS`; every mutation runs in a temp copy (`error-table-sync`'s pattern).

**Preconditions**:
- `P6` has landed.
- The `P5` verb exists, so the retired flag form has a remedy to name.

**Steps**:
1. Assert `INSTALL_DOMAIN_CODES` has exactly **10** entries and does not contain `install.migration.unavailable`; assert every other install identity is present unchanged.
2. Assert `ERROR_TABLE` has no `install.migration.unavailable` row and that the install kind's row count is 10, with no row added or reworded.
3. Assert `git grep -l "install.migration.unavailable"` over the tracked tree returns only declared corpora (`doc/changes/`, `doc/decisions/`), i.e. **zero** hits in code, `doc/spec/`, `doc/guides/`, `doc/planning/` and `tests/fixtures/`.
4. Assert `tests/fixtures/result/code-corpora/true-positives.json` no longer lists the code (removed, not relaxed: the entry is gone, not marked optional) and that `error-table-sync` is green with the corpus and the table in step.
5. Assert `tests/structure/cross-repository-contract.test.ts`'s additive-row set no longer names the code and that its baseline comparison is green.
6. Assert `tests/checks/install-lifecycle-docs.test.ts`'s `GUIDE_REQUIREMENTS` no longer contains the identity **and** that the guide states the migration facts (the verb, `--dry-run`, the backup, the verdicts, the daemon rule, the idempotence, the manual reversal, and the shell-fallback operator remediation); assert the requirement table is not emptied and the retired-claim list still fails a planted retired statement.
7. Assert `install --migrate` now exits 1 with `fallback.invocation`, a summary naming the retired flag form and the remedy `install migrate`, and no install and no migration.
8. Assert the identity is not reused anywhere: a planted second reference to the code inside a temp copy of a spec page fails `error-table-sync` by name.

**Expected Outcome**:
- One identity retired, zero added; the domain at 10; the corpora and the requirement table updated in step; the flag form recognised and refused with its remedy.
- Leaving the row, deleting a required fact without replacing the set, or reusing the identity fails by name.

**Notes / Clarifications**:
- Mutation controls `M52` (leave the code in the domain list) and `M53` (remove the identity from the guide but leave it in the required-fact set).
- "Removed, not relaxed" is the operative rule: the pinned corpora lose the entry; no assertion is weakened to accommodate it.

#### TC-MIGRATE-012 - The verb joins the existing family: the prompt-required inventory stays 28, the M4 page carries it, and the help/coverage gate stays green

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: API-1, NFR-9, DM-9
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/install-family-surface.test.ts` (extended) + `tests/checks/reference-page-parity.test.ts` (extended) + `scripts/checks/help-guide-coverage.ts` (**verify only — not edited**)
**Tags**: @backend, @install, @help, @checks, @offline
**Seam**: `S-help` — the command inventory, the family surface, and the reference-page mapping
**Fixture mechanism**: `packages/cli/src/help/prompt-required-commands.ts`, `tests/fixtures/help-guide/coverage.json`, and the rendered install help.

**Preconditions**:
- `P6` has landed.
- `P5`'s verb is registered.

**Steps**:
1. Assert `PROMPT_REQUIRED_COMMANDS` has exactly **28** entries with `install` still at its current index and `provider` still last; assert `migrate` is **not** a top-level command.
2. Assert the `install` family's declared verb set contains `migrate` and its declared flag set contains `--dry-run`, `--backup-dir`, `--stop-daemon`, and no longer contains `--migrate`.
3. Assert the install reference page (`doc/planning/oss-tooling/milestones/m4/commands/install.md`) contains `--help` and `--version` and carries the verb, the flag table, the verdict table, the backup and reversal workflow, and the retirement note.
4. Assert `help-guide-coverage.ts`'s `pageFor("install")` still resolves to the M4 page (the M1 snapshot root must never serve it) and that the check exits 0.
5. Assert `tests/fixtures/help-guide/coverage.json` still lists `install` and the M4 page, and that the reference-page-parity suite's duplicated mapping agrees.
6. Assert the rendered `install --help` lists `migrate` under the family and does not list `--migrate` as a supported install flag.

**Expected Outcome**:
- Inventory unchanged at 28; one new verb inside an existing family; the M4 page and the mapping unchanged in shape; `pnpm check:help` green.
- Adding a 29th top-level command, removing the page obligation, or listing the retired flag fails by name.

**Notes / Clarifications**:
- Mutation control `M54` (append `install migrate` as a new top-level prompt-required command).
- This case is NFR-only on purpose: no `AC-*` states the inventory constraint, but the constraint is binding (it is what keeps the entrypoint's composed program and the M4 ownership split intact).

#### TC-ROOT-001 - Both files present: the current one loads, the prior one is reported not used, and any notice names the current path

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, API-4, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (extended)
**Tags**: @backend, @namespace, @config, @offline
**Seam**: `S-configload` — the delivered per-layer prior ordering plus the notice sink
**Fixture mechanism**: `tests/fixtures/entrypoint/prior-identity/harness.ts` (scratch checkout, counting filesystem facts, buffer sink) and `tests/fixtures/namespace/golden/notices.ts` for the golden line.

**Preconditions**:
- `P7` has landed.
- A scratch checkout with **both** `<checkout>/.jaiship/config.yaml` and `<checkout>/.delivery-os/config.yaml`, holding distinguishable markers.

**Steps**:
1. Run a composed invocation that resolves the project-committed layer.
2. Assert the loaded file is the current path.
3. Assert the prior file is reported as **not used** in the layer report.
4. Assert the emitted notice (when one is emitted for this layer) names the current path as the target and the prior path as not read, comparing against the golden line.
5. Assert the opened-path recorder shows 0 opens of the prior file's bytes.
6. Assert the resolved value is the current file's marker, not the prior one's.

**Expected Outcome**:
- Current wins, prior reported not used, the notice (if any) names the current path, zero prior opens.
- A read of the prior file while the current exists, or a notice naming the prior path as loaded, fails by name.

**Notes / Clarifications**:
- Mutation control `M6` (read the prior file even when the current exists).
- `DEC-2` is the rule: removing the fallback outright would break the machines the shim exists for, so the case asserts *ordering and reporting*, not removal.

#### TC-ROOT-002 - A migrated checkout and host emit zero prior-identity lines in human and `--json` mode, with payload and exit unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, API-4, NFR-7, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` + `tests/checks/prior-identity-hermetic.test.ts` (both extended)
**Tags**: @backend, @namespace, @config, @offline
**Seam**: `S-configload` — the notice emission path in both output modes
**Fixture mechanism**: the prior-identity harness with a scratch checkout **and** scratch home that hold only current-identity paths; `bufferSink` for stderr capture.

**Preconditions**:
- `P7` has landed.
- The scratch checkout holds `.jaiship/config.yaml` and no `.delivery-os/`; the scratch home holds `~/.jaiship-state` and no `~/.delivery-os-state`; **no** prior override environment variable is set (a prior override is a prior input, and `API-4` permits its `override-read`).

**Steps**:
1. For each of three representative configuration-resolving commands, run in human mode and in `--json` mode (six runs).
2. Assert zero lines matching `prior-identity-fallback` on stderr in every run.
3. Assert the machine payload is byte-identical to the same command's payload on a checkout that never had a prior namespace (a control world), so "no notice" is not achieved by changing the payload.
4. Assert the exit code is the command's own (unchanged by anything notice-related).
5. Assert the opened-path recorder contains zero prior-namespace paths.
6. Assert no `state-read`/`state-skipped` line either, so the host-root selection is silent.

**Expected Outcome**:
- Zero notices across two modes × three commands; identical payload; unchanged exits; zero prior opens.
- An unconditional `config-skipped` emission — the realistic regression — fails by name.

**Notes / Clarifications**:
- Mutation control `M7` (emit `config-skipped` on a migrated host).
- The precondition explicitly excludes a prior override variable: `API-4` says a notice is emitted when a prior input exists, and an env var is a prior input.

#### TC-ROOT-003 - Prior only: exactly one `config-read` names both paths, the values carry the prior origin, and nothing is written there

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, API-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (extended)
**Tags**: @backend, @namespace, @config, @offline
**Seam**: `S-configload` — the prior read path over counting filesystem facts with a write recorder
**Fixture mechanism**: the prior-identity harness plus `tests/fixtures/migration/filesystem.ts`'s write recorder.

**Preconditions**:
- `P7` has landed.
- A scratch checkout with `<checkout>/.delivery-os/config.yaml` and **no** `.jaiship/config.yaml`; a scratch home with `~/.delivery-os-state` and no `~/.jaiship-state`.

**Steps**:
1. Run a composed configuration-resolving invocation.
2. Assert **exactly one** `config-read` line on stderr (count, not presence).
3. Assert the line names both the current target path and the prior loaded path.
4. Assert every value resolved from that layer reports the prior file's path as its origin.
5. Assert the write recorder saw **0 writes** under the prior checkout path and under the prior home path.
6. Assert the exit code is unchanged from the control run in a fully current world.
7. Assert a second invocation in the same process composition does not emit a second `config-read` (one per reason per composed program).

**Expected Outcome**:
- One notice naming both paths; origin = prior; zero prior writes; unchanged exit; ≤ 1 per composed program.
- A silent read, a second notice, or any prior write fails by name.

**Notes / Clarifications**:
- Mutation control `M8` (write the prior root on read). The "one per composed program" assertion is what separates a bounded diagnostic from a per-call log line.

#### TC-ROOT-004 - The local overlay is `ci-disabled` under `CI=true`; the group document reads from the current path with absence as the empty listing; nothing is tracked and no template exists

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-4, DM-1, NFR-9, DEC-12, TDR-0074
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-cli.test.ts` (extended) + the delivered `tests/behaviour/projects-groups-list.test.ts` (assertions reused, **not edited**) + a tracked-set assertion in the suite. `tests/behaviour/projects-config.test.ts` and `tests/behaviour/ceremony-mirror-composition.test.ts` are **not edited**: the composition/read path is unchanged (`DEC-12`).
**Tags**: @backend, @namespace, @config, @projects, @offline
**Seam**: `S-configload` — the project-local layer ordering, its `ci-disabled` rule, and the group-document read
**Fixture mechanism**: the prior-identity harness plus a scratch checkout holding both overlays; the group battery's delivered empty-listing assertion; the tracker read for the tracked-set rows.

**Preconditions**:
- `P7` has landed.
- A scratch checkout with `.jaiship/config.local.yaml` (distinctive marker) and `.jaiship/projects.yaml` (a `delivery.projects.groups.v1` document with one group whose member has **no** declared local checkout root).

**Steps**:
1. Normal mode: assert the overlay is read as the project-local layer and its marker reaches the resolved values; assert the tracked committed layer is still the project-committed layer (the overlay does not replace it).
2. `CI=true`: assert the overlay is reported `ci-disabled` and the opened-path recorder shows **0 reads** of it.
3. Assert the group document resolves from `<checkout>/.jaiship/projects.yaml` and its group is listed.
4. Remove the document; assert the group read is the delivered **empty listing** (no error, no fallback to another checkout, no placeholder).
5. Assert a zero-group document and a member without a declared local root are both the declared degradation (empty target set / `absent`), and that no other checkout's document is read (the recorder shows only this checkout's path).
6. Assert `git ls-files` shows **neither** overlay tracked, and that no tracked path matches `<configDirectoryName>/projects.yaml.*` (no `.example`, no template).
7. Assert through the delivered group-document read (no composition change) that the ceremony mirror's declared target set is the invoking checkout's own document and is empty in step 4; assert `tests/behaviour/projects-config.test.ts` and `tests/behaviour/ceremony-mirror-composition.test.ts` are **not edited** (`DEC-12`), so the assertion is verification of delivered behaviour, not a new composition contract.

**Expected Outcome**:
- Overlay read normally and `ci-disabled` with zero reads under `CI=true`; the group document read from the current path with absence as the empty listing; neither overlay tracked; no template; a declaration-only mirror target set.
- Reading the overlay under `CI=true`, tracking either overlay, landing a template, or reading another checkout's document fails by name.

**Notes / Clarifications**:
- Mutation control `M9` (read `config.local.yaml` under `CI=true`).
- `DEC-12`/TDR-0074 is the authority: the document is an operator-local overlay, its absence is the ordinary empty listing, and the mirror never federates. The adapter comment change in `decision-register.ts` is comment-only, so no read or composition assertion changes; the mirror row therefore reuses the delivered `projects-groups-list` battery and edits neither composition suite (B3).

#### TC-IDENTITY-006 - The proof boundary is a permanent constant: eight proven, eight not-proven, in declared order, with every battery row on a proven id

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-1, DOD-5, spec Appendix C, spec Appendix G
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/namespace/namespace-proof-boundary.test.ts` + `tests/fixtures/namespace/evidence.ts`
**Tags**: @backend, @namespace, @conformance, @offline
**Seam**: `S-layer`…`S-docs` — the battery's own claim registry
**Fixture mechanism**: **the permanent `NAMESPACE_PROOF_BOUNDARY` constant** in `tests/fixtures/namespace/evidence.ts` — the only source of the boundary — plus the battery row registry.

**Preconditions**:
- `P7` has landed; every battery row of `P1`…`P7` is registered with one `proven` id.

**Steps**:
1. Assert `NAMESPACE_PROOF_BOUNDARY.proven` is exactly `committed-layer`, `clean-clone`, `authoritative-root`, `prior-notice`, `migration-plan`, `migration-move`, `shim-reconciliation`, `conformance-negative-controls` — **eight ids, in that order**.
2. Assert `NAMESPACE_PROOF_BOUNDARY.notProven` is exactly `real-operator-home`, `second-machine-clone`, `ci-runner-home`, `other-checkouts`, `third-party-alias-consumers`, `shim-removal-release`, `prose-residual`, `shell-fallback-post-migration` — **eight ids, in that order**.
3. Assert the two sets are disjoint and that no id appears twice.
4. Assert every registered battery row declares exactly one `proven` id, that every `proven` id has at least one row (non-vacuity for all eight), and that no row names a `notProven` surface.
5. Run five planted controls: drop one proven id; add a ninth proven id; reorder two proven ids; register a row against a not-proven id; register a row with no id. Assert each fails by name.
6. Assert no case outside this one and no fixture reads `doc/changes/**` (the boundary's publication is not a delivery assertion).

**Expected Outcome**:
- Eight proven, eight not-proven, declared order, every row on a proven id, every proven id populated.
- Any drift fails by name with expected-versus-received ids.

**Notes / Clarifications**:
- **The page/constant comparison is not this case.** The same two lists are published on `doc/quality/test-specs/test-spec-namespace-conformance.md`; a page/constant mismatch is a **documentation-phase** (`P10`) defect verified by the phase-7 reconciliation (§7.7). No permanent delivery case reads the page, and a mismatch is never a `TC-IDENTITY-006` failure.
- This case is NFR-only: it pins the honesty of the battery's claims (`NFR-1`) and the "proven on a scratch machine, not the operator's" obligation (`DOD-5`).

#### TC-IDENTITY-001 - A clean home creates only current-identity paths on every surface, including the MCP composition with no configured name

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DM-9, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/namespace-identity-surfaces.test.ts`
**Tags**: @backend, @namespace, @identity, @mcp, @offline
**Seam**: `S-configload` + the MCP composition's declared default working name
**Fixture mechanism**: the prior-identity harness (a scratch home with nothing in it, a scratch checkout with the current layer) extended with a created-path recorder; the delivered MCP mount harness for the MCP surface.

**Preconditions**:
- `P8` has landed.
- The scratch home is empty (no `~/.jaiship`, no `~/.jaiship-state`, no prior namespace), and the scratch checkout holds `.jaiship/config.yaml`.

**Steps**:
1. For each composed surface (the primary CLI, the alias's non-lifecycle composition, the entrypoint, and the MCP composition with **no** configured working name), run one representative command.
2. Record every created path.
3. Assert every created path is under `~/.jaiship/` or `~/.jaiship-state/`; assert zero created paths under `~/.delivery-os`, `~/.delivery-os-state`, or any repo-local prior root.
4. Assert the resolved identity reported by each surface is the current one (`.jaiship`, `.jaiship-state`, `JAISHIP_`, `~/.jaiship/bin/jaiship`).
5. Assert the MCP composition's resolved directories are current-identity directories when nothing is configured.
6. Assert no prior-namespace directory was created anywhere, and that a second run in the same home creates no new path beyond the first run's set.

**Expected Outcome**:
- Only current-identity paths on every surface including MCP; zero prior paths; the current identity resolved.
- An MCP default left at the prior identity — the `RSK-8` regression — fails by name with the created path.

**Notes / Clarifications**:
- Mutation control `M48` (leave the MCP default at `delivery-os`).
- The case is scoped to **host** path creation (the criterion's `~/.jaiship/` / `~/.jaiship-state/` wording); repo-local writes are covered by `TC-ROOT-004`.

#### TC-IDENTITY-002 - The identity-derived override wins; the prior literal works with exactly one `override-read`; an invalid override is contained and never falls back

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, API-6, NFR-7, DM-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/identity-override.test.ts` (extended)
**Tags**: @backend, @namespace, @identity, @override, @offline
**Seam**: `S-override` — the derived override name at the edge, the entrypoint and the MCP composition
**Fixture mechanism**: `tests/fixtures/branding/edge.ts` (extended: the override name is derived from `environmentPrefix` + the `WORKING_NAME` suffix, and the prior literal is a declared constant) plus the harness's injected `environment`.

**Preconditions**:
- `P8` has landed.
- The derived name exists (`JAISHIP_WORKING_NAME` today); the prior literal is still read.

**Steps**:
1. Row A: both `<PREFIX>WORKING_NAME` and `DELIVERY_OS_WORKING_NAME` non-empty and different → assert the current one's identity wins.
2. Row B: only the prior literal set → assert it is used, the resolved identity is the prior-derived one, and **exactly one** `override-read` line is emitted on stderr.
3. Row C: the prior literal set in `--json` mode → assert exactly one `override-read` line, that the line is **not** in the payload, and that the exit code is unchanged.
4. Row D: only the current override set → assert **zero** notices.
5. Row E: neither set → assert the invoking bin's or composition's declared default is used and zero notices are emitted.
6. Row F: a present but invalid current override → assert the delivered containment (`fallback.internal`, exit 2) for a configuration-bearing invocation and the delivered field-and-code error for a self-description read, and assert **no** fallback to the prior channel occurred (the recorder shows the prior literal was never read).
7. Row G: a present but invalid prior override while the current one is absent → assert the same containment and no silent fallback.
8. Assert the override name is not a committed literal in any of the five product-surface sites (`TC-IDENTITY-005` owns the inventory; this case asserts the derivation is the only source).

**Expected Outcome**:
- Current wins; prior works with one bounded notice; invalid is contained with no cross-channel fallback; zero notices when no prior input exists.
- Prior winning, a second notice, a payload-borne notice, or a silent fallback fails by name.

**Notes / Clarifications**:
- Mutation controls `M44` (prior wins) and `M45` (silent fallback from an invalid override).
- `DEC-8` is the reason the channel must have a successor: after the shim's removal, `<PREFIX>WORKING_NAME` is the only channel, so the derivation cannot be a literal.

#### TC-IDENTITY-003 - The eight owner-named pre-freeze variables are inert, `ADOS_FOO=bar` neither errors nor becomes a value, and `ADOS_WORKING_NAME` is the one declared override mapping

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-3, API-5, API-6, RSK-9, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/legacy-adapter.test.ts` + `tests/behaviour/config-cli.test.ts` (both extended)
**Tags**: @backend, @namespace, @config, @legacy, @offline
**Seam**: `S-legacy` — the catalog-key-bounded mapping rule reading the declared catalog key set
**Fixture mechanism**: `tests/fixtures/namespace/pre-freeze-env.ts` — the eight owner-named variables (`ADOS_CONFIG_ROOT`, `ADOS_DS_BALANCE_CACHE_FILE`, `ADOS_HOOK_ENV_ALLOWLIST`, `ADOS_OPENAI_QUOTA_CACHE_FILE`, `ADOS_PROFILES_DIR`, `ADOS_PROVIDER_STATE_FILE`, `ADOS_STATE_DIR`, `ADOS_ZAI_QUOTA_CACHE_FILE`) plus `ADOS_FOO=bar` and the declared-exception variable `ADOS_WORKING_NAME`; `tests/fixtures/config/catalog.ts` supplies the declared key set.

**Preconditions**:
- `P8` has landed.
- The mapping rule reads the declared catalog key set rather than an inline allowlist copy.

**Steps**:
1. Build a process environment carrying exactly the eight owner-named variables (plus the minimal base environment).
2. Run each configuration-resolving command the owner reproduced — `provider resolve`, `provider profile resolve`, and `dispatch`'s pre-flight — and assert **no** command answers `config.environment.unmapped`.
3. Assert each command's exit and resolved tree are identical to a control run with the eight variables absent.
4. Assert a legacy name whose mapped current name **is** a declared catalog key still maps (keep-every-working-mapping row), so the rule is a bound and not a disable.
5. Add `ADOS_FOO=bar`; assert the run neither errors nor exposes `bar` as a configuration value (scan the resolved tree and the payload for the marker).
6. Assert no notice is emitted for an untouched legacy name (an untouched name is not an error, not a value, not a notice).
7. Assert current-prefix strictness is unchanged: `JAISHIP_NOT_A_KEY` still yields `config.environment.unmapped`.
8. Row `ADOS_WORKING_NAME`: with no current-prefixed override set, assert the resolved working name is the legacy value through the mapped current override channel `<environmentPrefix>WORKING_NAME`; assert **no** `config.environment.unmapped` error, that no configuration key is added or exposed, and that the value is not treated as an untouched legacy name. Assert this is the **one declared exception** to the catalog-key bound: a control legacy name with the same shape but no successor channel stays untouched, and the exception is read from the declared mapping rule rather than special-cased in the adapter.

**Expected Outcome**:
- The eight variables inert; exits and trees identical to the control; a known-key mapping still works; `ADOS_FOO` neither errors nor leaks; `ADOS_WORKING_NAME` reaches the current override channel as the one declared exception with no catalog-key error; current-prefix strictness unchanged.
- An unbounded mapping, a dropped exception, a leaked value, or a weakened current-prefix check fails by name.

**Notes / Clarifications**:
- Mutation controls `M46` (map every `ADOS_*` name, or drop the declared `ADOS_WORKING_NAME` exception — the two directions of the bounded rule) and `M47` (publish `ADOS_FOO` as a value).
- `RSK-9` is answered by step 4 and step 8 together: the rule keeps every mapping whose target is a declared catalog key **and** preserves the operator's pre-freeze override through its declared successor channel; `ADOS_STATE_DIR` never had a working path through the shim because the state-scope rule reads the current prefix only.
- The exception adds no configuration key and no second channel (`API-5`, `API-6`, `DEC-9`); the `override-read` notice belongs to the **prior** literal `DELIVERY_OS_WORKING_NAME` (`TC-IDENTITY-002`, `TC-SHIM-003`), not to this mapping, so this row asserts no notice is required for it.

#### TC-IDENTITY-005 - Exactly the five declared product-surface literal sites exist, the build-side site is unchanged, and the override name is not a committed literal

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-5, DM-9, NFR-8
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/branding-contract.test.ts` (extended)
**Tags**: @backend, @namespace, @identity, @structure, @offline
**Seam**: `S-shimreg`-adjacent: the declared literal-site inventory guard
**Fixture mechanism**: the delivered inventory guard in both directions, with the five sites as a committed declaration inside the suite.

**Preconditions**:
- `P8` has landed (the MCP default and the override derivation changed).

**Steps**:
1. Assert the inventory finds exactly **five** product-surface sites, in the declared order: the alias bin's default (`delivery-os`), the primary bin's default (`jaiship`), the primary bin's prior identity (`delivery-os`), the MCP composition default (**now the current identity**), and the resolver's scope-org derivation input.
2. Assert every found literal is declared and every declared site is found (both directions).
3. Assert the build-side site under `scripts/` is unchanged.
4. Assert no **sixth** site exists: plant a sixth literal in a temp copy and assert the guard fails naming it.
5. Assert the override name is **not** a committed literal at any site (the prior literal appears only at the declared shim sites and in the shim registry).
6. Assert the MCP default's value equals the primary default's value, so the count is unchanged while one value changed.

**Expected Outcome**:
- Five sites, declared order, both directions green, no sixth site, no committed override literal, build-side site unchanged.
- A sixth site, an undeclared literal, or a re-introduced override literal fails by name.

**Notes / Clarifications**:
- Mutation controls `M49` (re-introduce the override name as a literal) and `M50` (add a sixth site).
- Site **count** invariance with two re-stated values and one re-derived value is the `DM-9` claim; the guard must therefore assert values, not only the count.

#### TC-SHIM-003 - Each read-only shim reads only at its declared site, emits one bounded notice per process per source kind, writes nothing to a prior root, and never enters a payload

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-3, API-4, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts`, `tests/behaviour/prior-identity-state-fallback.test.ts`, `tests/behaviour/identity-override.test.ts` (all extended; one row per shim)
**Tags**: @backend, @namespace, @shims, @offline
**Seam**: `S-configload` + `S-override` over the write-recording filesystem facts
**Fixture mechanism**: the prior-identity harness plus `tests/fixtures/migration/filesystem.ts` (write recorder) and `tests/fixtures/namespace/golden/notices.ts` (the five golden notice lines).

**Preconditions**:
- `P8` has landed, so all three shims (prior config, prior state root, prior working-name override) exist with their notices.

**Steps**:
1. Row A — prior configuration shim: a checkout with only the prior file → assert one `config-read`, its golden text, and 0 writes under the prior path.
2. Row B — prior state root shim: a home with only `~/.delivery-os-state` → assert one `state-read` (or the delivered `state-skipped` when both exist), its golden text, and 0 writes under the prior root.
3. Row C — prior override shim: only `DELIVERY_OS_WORKING_NAME` set → assert one `override-read`, its golden text, and 0 writes anywhere.
4. For every row, assert the notice is emitted on **stderr** in both human and `--json` modes, is absent from the payload, and changes no exit code.
5. For every row, assert the notice line is ≤ 200 bytes and contains no environment value, no credential, and no file content (assert against a marker planted in the prior file's body, which must not appear in the notice).
6. For every row, assert a second invocation inside the same composed program does not emit a second line for the same reason.
7. Assert every notice text equals the registry's declared `notice` for that shim id — the registry is the authority, so a drift between code and registry fails here.

**Expected Outcome**:
- One bounded notice per shim, per process, per source kind; zero prior writes; no payload entry; no exit change; the text equal to the registry's declaration.
- A silent read, a duplicate line, a payload-borne notice, or a text drift fails by name.

**Notes / Clarifications**:
- Mutation control `M35` (emit `config-read` twice in one process).
- Row C is why this case is owned by `P8`: the `override-read` reason is the one new notice reason, so the case cannot be green before the override channel lands.

#### TC-IDENTITY-004 - The enumerated pages and the prompt surface name the current identity, the reference pages agree with `--help`, and the generated projection matches its source

**Scenario Type**: Integration
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-4, DM-9, NFR-9, DEC-11, DEC-12, DEC-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/namespace-doc-battery.test.ts` + `tests/checks/doc-conformance.test.ts` (phase-7 phrase table) + the projection-currency build check
**Tags**: @backend, @namespace, @docs, @checks, @offline
**Seam**: `S-docs` — the page-fact batteries, the rendered-help comparison, and the projection generator
**Fixture mechanism**: a requirement table per enumerated page inside the suite (the `GUIDE_REQUIREMENTS` pattern), the rendered `--help` output, and the committed projection file `.ados-claude/agents/toolsmith.md`.

**Preconditions**:
- `P9` has landed; the `P10` page may not yet exist (the quality page is `P10`, so this case does not read it).
- The prompt edit is exactly the one routing-authority sentence plus its regenerated projection.

**Steps**:
1. For each enumerated page of spec Appendix A that lands in `P6`/`P9` (`local-install.md`, the install-lifecycle/branding-seam/cli-entrypoint/config-layer/projects/project-groups/ceremony-runner/state-layer/mcp-surface/autonomous-delivery/result-contract feature pages, the glossary, the M4 command page and model/schedule/backlog pages, the four guides), assert its declared required facts are present and its declared stale statements absent.
2. Assert `.opencode/agent/toolsmith.md`'s routing-authority sentence names `.jaiship/config.yaml`.
3. Assert the generated `.ados-claude/agents/toolsmith.md` is byte-identical to the output of the generator run over the source (regenerate into a temp path and compare; never hand-edit).
4. Assert every other prior-namespace mention on those pages is a declared compatibility mention or a declared corpus entry (the same authority the scan uses), and that no page presents a prior path as the current one.
5. For the family reference pages, assert each page agrees with the rendered `--help` on the declared verb and flag set (page ↔ program equality), including the install page's new verb and retired flag form.
6. Assert the shell-fallback operator remediation sentences (`DEC-13`) and the group-document disposition sentences (`DEC-12`) are present on the guide and the ceremony page respectively.
7. Assert every new or changed distributable page declares `ados_distribution` and that the new page is registered in the forbidden-literal registry in the same change.
8. Assert the two reworded current-truth rows explicitly (the `DOD-9` set): `doc/guides/opencode-model-configuration.md`'s configuration path is `.jaiship/config.yaml`; `doc/overview/glossary.md`'s override row names `<environmentPrefix>WORKING_NAME` as the channel with `DELIVERY_OS_WORKING_NAME` as the declared lower-precedence prior input and its reference-declaration row names `.jaiship/config.yaml`. Assert no enumerated page presents `projects.yaml` as project-committed or committed (outside a declared mention or declared corpus).

**Expected Outcome**:
- Every enumerated page carries its facts and no stale statement; the prompt sentence names the current path; the projection is current; pages agree with `--help`; the distribution markers are declared.
- A page naming the prior path as current, a hand-edited projection, or a page/program disagreement fails by name.

**Notes / Clarifications**:
- Mutation control `M51` (keep a page naming the prior configuration path as current).
- Two publication checks are deliberately **not** here and are not delivery cases: the `NAMESPACE_PROOF_BOUNDARY` page/constant comparison, and the phase-7 stale-statement grep over the reconciled set (`DOD-9`). Both belong to `P10` (§7.7).

## 6. Environments and Test Data

**Environment.** Local developer workstation and CI, `bun test`, no network. Every run works inside the repository's approved temp root: `tmp/tmpdir` under `$PWD`, created with `mkdir -p tmp/tmpdir` and disposed in `finally`. `TMPDIR=$PWD/tmp/tmpdir` is exported for every command so `mkdtemp` never escapes the repository. The real home is never read or written: the only home any case sees is a scratch directory under that temp root, and the write recorder asserts it.

**Determinism devices.** A fixed clock instant per case; a fixed id sequence (`newRunId`); the injected `delay` recorder as the only time source; a pinned `runId` and run stamp so a dry-run plan is comparable across two runs; the counting/recording filesystem facts (`writes`, `creations`, `opened`, `reads`); a fixed environment map; the deterministic failure ordinal for the recovery case; temp-root canonicalisation (`canonicalize(value, root)`) for every double-run comparison.

**Isolation.** One scratch home and one scratch checkout per case (or per case group where a case intentionally spans a re-run); every refusal case asserts its own zero-write and zero-directory consequence; `dispose()` and `rmSync` in `finally`. No fixture writes outside `tmp/tmpdir`; the change folder's `tmp/` is git-ignored. The tree arm and the content arm never write the tree they scan: the mutation batteries run over a temp copy (`createTempRepo`) and the real-tree rows assert `git status --porcelain` is unchanged.

### 6.1 Fixture inventory

**Exists — reuse, do not duplicate (21; seven extended in place).**

| Fixture | What it gives |
|---------|----------------|
| `tests/fixtures/install/home.ts` | `createInstallScratch` (one temp home + checkout), `fixtureIdentity`, `createInstallRuntime`, `snapshotTree`, `readRecordText` — the migration's scratch world and tree snapshots |
| `tests/fixtures/install/checkouts.ts` | `createFixtureCheckouts`, `readFixtureCheckout`, `isFixtureWorktree` — the primary and linked-worktree targets the admission refusals need |
| `tests/fixtures/install/daemon.ts` | `createRecordingDaemon` — the daemon guard's live/absent double and its call log |
| `tests/fixtures/install/faults.ts` | `faultAt(step)`, `noFault()` — the delivered fault port the recovery case extends with an ordinal |
| `tests/fixtures/install/state-roots.ts` | `writeHeader`, `plantForeignRecord` — the seeded ledger headers and the foreign record the byte-preservation case keeps intact |
| `tests/fixtures/install/destinations.ts` | `placeDestination` with `absent`/`agreeing`/`differing`/`launcher`/`symlink` — the `DM-6` destination states |
| `tests/fixtures/install/artifact.ts` | `createFixtureArtifact`, `writeFixtureLauncher` — the installed artifact and the install record the migration must not touch |
| `tests/fixtures/entrypoint/prior-identity/harness.ts` | **Extended:** `scratchCheckout`, `scratchHome`, the counting `FileSystemFacts` wrapper, the notice sink, `runEntrypoint` + `createProductionComposer` — the loaded-path, notice and clean-home cases; the extension adds a per-opened-path recorder and a write recorder |
| `tests/fixtures/entrypoint/prior-identity/pre-change-touch.json` | The pre-change touched path set used to prove a read set is unchanged |
| `tests/fixtures/daemon/mount-harness.ts` | **Extended:** the recording clock/process/supervisor ports, the delivered lock and state store, a real scratch host root — the post-move location and host-index cases |
| `tests/fixtures/state/harness.ts` | `makeIdentity`, `openStore`, `reopenStore`, `makeTempRoot`, `removeTempRoot`, `createTestEdge` — store opening after the move |
| `tests/fixtures/branding/names.ts` + `derivation-cases.json` | The working-name to derived-value table (`.jaiship`, `.jaiship-state`, `JAISHIP_`, `~/.jaiship/bin/jaiship`) |
| `tests/fixtures/branding/edge.ts` | **Extended:** `WORKING_NAME_OVERRIDE` becomes a derived name (`<environmentPrefix>WORKING_NAME`) with the prior literal declared separately; `resolveAtEdge` supplies the override-precedence rows |
| `tests/fixtures/legacy/literal-inventory.json` + `warn-probe.ts` | The pre-freeze literal inventory (`ADOS_`, `.ados`) and the one-warning probe |
| `tests/checks/fixture-repo.ts` | **Extended:** `createTempRepo`, `writeFiles`, `writeRegistry`, `liveRegistry`, `git`, `SCOPE_FILES` — the temp-copy mutation mechanism for both scan arms; the extension adds the mode-`120000` symlink helper |
| `tests/fixtures/forbidden-literals/{true,false}-positives.json` | **Extended:** the matcher corpora gain the `@`-sigil, repository-name, unscoped-name and longest-literal rows of `TC-SCAN-002` |
| `tests/fixtures/config/{facts,catalog}.ts` | **Extended:** the layer facts plus the declared catalog key set the bounded legacy mapping reads |
| `tests/fixtures/result/code-corpora/{true,false}-positives.json` | **Extended:** the retired identity's entry is **removed** from the true-positives corpus |
| `tests/fixtures/help-guide/coverage.json` | The prompt-required command set (28) and the reference-page list |
| `tests/fixtures/prompt-inventory/lifecycle.json` | The prompt-conformance inventory the toolsmith sentence must stay inside |
| `tests/golden/helpers.ts` | `bufferSink`, `SYNTHETIC_BRAND` — the stream capture and the brand used by the composed suites |

**Must be authored — new files (11), in the same fixture families.**

| New file | Contents |
|----------|----------|
| `tests/fixtures/migration/roots.ts` | The seeded three-root world builder: host configuration (`config.yaml`, `install.json`, `bin/`), host state (`host-index.json`, `projects/<key>/`, `unbound/`), invoking project configuration (`<checkout>/.jaiship/`), each entry with a known file count and byte count; container directories (`projects/`, `documents.*/`, `quarantine.*/`); and one destination-state composer per `DM-6` row. Never writes outside the passed root. |
| `tests/fixtures/migration/filesystem.ts` | The recording facts: `writes`, `creations` (directory creations), `opened` (every path read), `reads`, plus `failAtOrdinal(n)` — the injected failure at a fixed move ordinal, and `noFailure()`. |
| `tests/fixtures/migration/manifest.ts` | The manifest reader/validator (`install.migration.manifest.v1`, distinct from the payload's `install.migration.plan.v1`), `digestsOf(tree)`, and the per-entry digest comparator the byte-preservation case uses. |
| `tests/fixtures/migration/plan.ts` | The canonicaliser for the double-run comparison (temp-root normalisation plus stable JSON) and the golden human/`--json` plan blocks. |
| `tests/fixtures/migration/guards.ts` | The ordering recorder that stamps `stop`, `audit` (the two-record pair) and `move <n>` on one monotonic counter, the refusing daemon port, the dev-build and worktree admission fixtures, and the `--backup-dir` validation table. |
| `tests/fixtures/namespace/shim-registry.ts` | The registry loader plus the six mutant builders (duplicate id, unknown kind/direction, empty sites, absent site, wildcard site, non-increasing window) and the window-order comparator. |
| `tests/fixtures/namespace/seeds.ts` | The prior-namespace seed corpus and `sow(repo, class, line)` — the per-class mutation sower over a temp-copy repository, used by both arms. |
| `tests/fixtures/namespace/tree.ts` | The synthetic tracked-set builder (real git index incl. mode `120000` symlinks and a committed blob target) and the rule-world ignore probe runner. |
| `tests/fixtures/namespace/evidence.ts` | **The permanent `NAMESPACE_PROOF_BOUNDARY`** (eight proven ids, eight not-proven ids, declared order) and the battery row registry with `boundaryViolations()`. The only source of the boundary. |
| `tests/fixtures/namespace/pre-freeze-env.ts` | The eight owner-named pre-freeze variables, the inert `ADOS_FOO=bar` fixture, the declared-exception `ADOS_WORKING_NAME` variable, and the inertness probe (no error, no value, no notice for untouchable names). |
| `tests/fixtures/namespace/golden/notices.ts` | The five golden notice lines (`config-read`, `config-skipped`, `state-read`, `state-skipped`, `override-read`) and the golden migration plan/verdict blocks. Committed, reviewed, regenerated by an explicit command, never by blanket rewrite. |

**No fixture writes, reads, or probes the real home.** Every home a case sees is passed in as a scratch directory under `tmp/tmpdir`; the recording filesystem facts are the only filesystem the migration uses, and the recorder's call counts are asserted so a native fallback would be visible.

**Deliberately unchanged (asserted, not edited).** `scripts/lib/dispatch-authority.sh`, `scripts/hooks/pre-opencode-iteration-owner-hold.sh` and their two batteries (byte-unchanged, declared sites with occurrence budgets per `DEC-13`); `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/install.sh`, `scripts/uninstall.sh` (`NG-4`); every agent prompt except the one routing-authority sentence; `packages/core/src/branding/index.ts`, `packages/adapters/src/file/config-source.ts`, `packages/core/src/app/state-scope.ts` (derivation, per-layer ordering and host-root selection keep their delivered semantics); `tests/structure/rename-drill-doc.test.ts` (its config-glob survival property must stay green with the additive pattern); the coordinator, dispatch, daemon, queue, loop, provider, merge and closeout modules.

**New test hosts (13):** `tests/structure/namespace-layer.test.ts`; `tests/structure/namespace-shims-registry.test.ts`; `tests/checks/namespace-conformance.test.ts`; `tests/checks/namespace-tree.test.ts`; `tests/checks/namespace-gate-binding.test.ts`; `tests/checks/namespace-fresh-clone.test.ts`; `tests/checks/namespace-doc-battery.test.ts`; `tests/checks/install-migration-retirement.test.ts`; `tests/checks/ignore-rules-namespace.test.ts`; `tests/behaviour/install-migrate.test.ts`; `tests/behaviour/namespace-loaded-path.test.ts`; `tests/behaviour/namespace-identity-surfaces.test.ts`; `tests/conformance/namespace/namespace-proof-boundary.test.ts`. One delivered suite is extended rather than authored: `tests/structure/branding-contract.test.ts`.

### 6.2 Seams and mechanisms the fixtures must provide

- **A write-recording and read-recording filesystem.** `FileSystemFacts` with `writes`, `creations` and a per-path `opened`/`reads` record is the only way to assert "0 writes on every refusal", "no backup directory created during dry-run", and "no prior root opened", without trusting a return value.
- **The pinned clock and id sequence.** A fixed instant plus `newRunId` makes the dry-run plan reproducible and makes `NFR-1` and `AC-F3-2`'s double run attainable. A plan built from ambient time is a defect the case catches.
- **An ordinal failure injector.** `failAtOrdinal(n)` extends the delivered `faultAt(step)` so the recovery case can stop after *k* of *n* at a fixed point, which is what makes "the *n−k* unmoved entries intact, the backup complete for all *n*" assertable deterministically.
- **A real git index for the tree arm.** The synthetic tree must be a real repository with a committed symlink (mode `120000`) and a real tracked file, because git's mode read is what the arm inspects; faking a tracked set would prove the fake.
- **The declared pre-move digest.** A committed literal in `TC-LAYER-001`'s suite is the only acceptable form: a `git show <base>:…` comparison would assert a diff against a moving base branch, which `.ai/rules/testing-strategy.md` forbids.
- **A rule-world ignore probe.** The delivered `mkdtemp` + `git init` + `git check-ignore --no-index` pattern is reused because live-tree probes are environment-dependent (pnpm's `node_modules` symlinks make `git check-ignore` fail).
- **The registry as the notice authority.** `TC-SHIM-003` compares emitted text to the registry's declared `notice`; a test-local copy of the sentence would let code and declaration drift.

## 7. Automation Plan and Implementation Mapping

### 7.1 Battery architecture and seam exercise

**Thirteen seams, each exercised through the function production uses.** The table is the reference set and the count's single source: thirteen rows, thirteen seams. The command definitions, the CLI runtime, the migration domain, the resolvers, the store, and the gates are always the production ones.

| Seam | Production identity | Exercised by | What is real |
|------|--------------------|--------------|--------------|
| `S-layer` | the tracked-set read, the ignore-rule hygiene check, the project-layer path derivation | `TC-LAYER-001`, `TC-LAYER-002`, `TC-SCAN-003` | git metadata reads, the brace of globs, the tree arm's checks |
| `S-clone` | a real `git clone` of the change head | `TC-LAYER-003` | the clone, the status read, the ignore probes |
| `S-configload` | `createProductionComposer` → `runEntrypoint` with the delivered layer ordering | `TC-LAYER-004`, `TC-ROOT-001`…`-004`, `TC-IDENTITY-001` | the seven-layer resolver, the prior ordering, the notice emission, the origin report |
| `S-plan` | the migration plan builder and the human/`--json` renderers | `TC-MIGRATE-003`, `-005`, `-006`, `-007` | the ordered decision table, the disposition/verdict composition, the renderers |
| `S-apply` | the apply step (rename, or copy-then-verify-then-remove for a merge) | `TC-MIGRATE-004`, `-005`, `-008`, `-009`, `-010` | the copy/verify/rename sequence, the byte preservation, the retirement |
| `S-manifest` | the backup writer and the manifest writer/reader | `TC-MIGRATE-004`, `-008` | the layout, the digest verification, the manifest field set |
| `S-guard` | the delivered admission gates and the daemon guard/stop path | `TC-MIGRATE-001`, `-002` | the refusal producers, the ordering, the not-restarted guarantee |
| `S-shimreg` | the shim registry validator | `TC-SHIM-001`, `TC-SHIM-002` | the shape, window and site validation; the site authority |
| `S-content` | `scan()` with the registry-plus-shim reconciliation | `TC-SCAN-001`, `TC-SCAN-002`, `TC-SHIM-002`, `TC-SCAN-006` | the matcher, the class selection, the corpora, the site reconciliation |
| `S-tree` | `namespace-tree.ts` | `TC-SCAN-003`, `-004`, `-005`, `TC-SCAN-006` | the tracked-set read, the symlink resolution, the ignore probes |
| `S-override` | the override resolution at the edge, the entrypoint and the MCP composition | `TC-IDENTITY-002`, `TC-SHIM-003` row C | the derivation, the precedence, the containment, the notice |
| `S-legacy` | the legacy adapter's catalog-key-bounded mapping | `TC-IDENTITY-003` | the rule, the catalog key set, the one-warning discipline |
| `S-help` / `S-docs` | the help inventory, the reference-page coverage, the page batteries, the projection generator | `TC-MIGRATE-012`, `TC-SHIM-004`, `TC-IDENTITY-004`, `TC-IDENTITY-005` | the inventory, the mapping, the renderer, the generator |

### 7.2 Migration proof design

Four complementary observations, one property — "a move that cannot lose a byte".

**(a) The plan is the contract.** `TC-MIGRATE-003` asserts the plan's completeness and its zero-write/zero-creation/zero-daemon consequence, so `AC-F3-2`'s "the plan is not a verdict" and `NFR-1`'s determinism are the same instrument.

**(b) The manifest is the audit trail.** `TC-MIGRATE-004` asserts the manifest (`install.migration.manifest.v1`) covers every moved file with a matching digest and a byte copy, and that the payload carries its own id (`install.migration.plan.v1`); `TC-MIGRATE-008` asserts it covers **all *n*** planned entries even when only *k* moved. The manifest is therefore the evidence for "nothing lost", not the report's word.

**(c) The decision table is total.** `TC-MIGRATE-006` walks the six ordered rows plus the mixed world and asserts the `DM-6` verdict composition, and `TC-MIGRATE-007` adds the derived set as a named exception whose disposition is `already-migrated` or `absent`, never a seventh token. The before/after tree digest comparison is what proves "no differing byte deleted or overwritten" — a disposition assertion alone would not. `TC-MIGRATE-001` adds the two symlink rows (source `blocked`, destination `conflict`, never followed or moved) and the `unscoped` scope row.

**(d) The move is byte-preserving and re-versions nothing.** `TC-MIGRATE-009` asserts per-file digest identity, unchanged header format identifiers, an unchanged `install status` verdict, and an unchanged accepted-format constant; `TC-MIGRATE-010` asserts the derived index self-heals through re-derivation and never redirects a read.

**Testability consequence (recorded as an assumption, §8.2 `A4`).** The run stamp and the `runId` must be composition-injected values, not ambient reads, or `NFR-1` and `AC-F3-2`'s double run are unattainable. This is the delivered composition pattern (`clock`, `newRunId`), not a new requirement.

### 7.3 File mapping (new vs extended)

| TC group | Target file(s) | Status |
|----------|----------------|--------|
| `TC-LAYER-001` | `tests/structure/namespace-layer.test.ts` | To implement (new) |
| `TC-LAYER-002` | `scripts/checks/ignore-rules.ts` + `tests/checks/ignore-rules-namespace.test.ts` | Existing – update (fifth coverage class, two probes, positive control) + new mutation suite |
| `TC-LAYER-003` | `tests/checks/namespace-fresh-clone.test.ts` | To implement (new) |
| `TC-LAYER-004` | `tests/behaviour/namespace-loaded-path.test.ts` | To implement (new) |
| `TC-SHIM-001` | `tests/structure/namespace-shims-registry.test.ts` + `tests/fixtures/namespace/shim-registry.ts` | To implement (new) |
| `TC-SCAN-001`, `TC-SCAN-002`, `TC-SHIM-002` | `scripts/checks/forbidden-literals.ts` + `scripts/checks/forbidden-literals.registry.json` + `tests/checks/namespace-conformance.test.ts` + the extended `tests/checks/forbidden-literals.test.ts` and matching corpora | Existing – update (seed class, two scope classes, exclusions, neutral sites, allowlist independence, reconciliation) + new mutation suite |
| `TC-SCAN-003`, `-004`, `-005` | `scripts/checks/namespace-tree.ts` (new) + `tests/checks/namespace-tree.test.ts` + `tests/fixtures/namespace/tree.ts` | To implement (new, all three) |
| `TC-SCAN-006` | `scripts/checks/ci-topology.ts`, `.github/workflows/ci.yml`, `package.json`, `tests/checks/namespace-gate-binding.test.ts` | Existing – update (new `ts-*` job, baseline fetch, aggregate chain) + new binding suite |
| `TC-MIGRATE-001`…`-010` | `tests/behaviour/install-migrate.test.ts` + `tests/fixtures/migration/{roots,filesystem,manifest,plan,guards}.ts` | To implement (new) |
| `TC-SHIM-004` | `tests/behaviour/install-family-surface.test.ts`, `tests/structure/install-ownership-split.test.ts`, `tests/structure/entrypoint-bin.test.ts` | Existing – update |
| `TC-MIGRATE-011` | `tests/checks/install-migration-retirement.test.ts` (new) + `tests/checks/install-lifecycle-docs.test.ts`, `tests/checks/install-lifecycle-path.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/cross-repository-contract.test.ts`, `tests/fixtures/result/code-corpora/true-positives.json` | Existing – update (retire, do not relax) + new retirement suite |
| `TC-MIGRATE-012` | `tests/behaviour/install-family-surface.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/fixtures/help-guide/coverage.json` | Existing – update (`scripts/checks/help-guide-coverage.ts` is verify only, not edited) |
| `TC-ROOT-001`, `-003` | `tests/behaviour/prior-identity-config-fallback.test.ts` | Existing – update |
| `TC-ROOT-002` | `tests/behaviour/prior-identity-notice.test.ts`, `tests/checks/prior-identity-hermetic.test.ts` | Existing – update |
| `TC-ROOT-004` | `tests/behaviour/config-cli.test.ts` (update) + the delivered `tests/behaviour/projects-groups-list.test.ts` (verify only; `projects-config.test.ts` and `ceremony-mirror-composition.test.ts` are not edited, `DEC-12`) | Existing – update + delivered assertions reused |
| `TC-IDENTITY-006` | `tests/conformance/namespace/namespace-proof-boundary.test.ts` + `tests/fixtures/namespace/evidence.ts` | To implement (new) |
| `TC-IDENTITY-001` | `tests/behaviour/namespace-identity-surfaces.test.ts` | To implement (new) |
| `TC-IDENTITY-002` | `tests/behaviour/identity-override.test.ts` + `tests/fixtures/branding/edge.ts` | Existing – update |
| `TC-IDENTITY-003` | `tests/behaviour/legacy-adapter.test.ts`, `tests/behaviour/config-cli.test.ts` + `tests/fixtures/namespace/pre-freeze-env.ts` | Existing – update + one new fixture |
| `TC-IDENTITY-005` | `tests/structure/branding-contract.test.ts` | Existing – update |
| `TC-SHIM-003` | `tests/behaviour/prior-identity-config-fallback.test.ts`, `tests/behaviour/prior-identity-state-fallback.test.ts`, `tests/behaviour/identity-override.test.ts` + `tests/fixtures/namespace/golden/notices.ts` | Existing – update + one new fixture |
| `TC-IDENTITY-004` | `tests/checks/namespace-doc-battery.test.ts` (new) + `tests/checks/doc-conformance.test.ts` (phase 7) | To implement (new) + documentation-phase update |

**Split:** **13 new suites** (2 structure + 7 checks + 3 behaviour + 1 conformance), **11 new fixture modules** under `tests/fixtures/{migration,namespace}/**`, **11 extended files** (the delivered check modules, contract suites and corpora of the rows above, including `tests/structure/branding-contract.test.ts`; the two project/ceremony composition suites are **not** edited — `DEC-12`), and **0 edits** to the shell surface, to `scripts/lib/dispatch-authority.sh`, to `scripts/hooks/*`, or to any agent prompt except `.opencode/agent/toolsmith.md` and its generated projection.

**`tests/structure/inventory.json` registration is a `P1`…`P9` obligation per phase.** Every new module named in this table — the migration domain modules (per the implementation plan's split), the two new check modules, and the new fixture modules — is registered in the same phase that introduces it; an unregistered module fails the delivered content-inventory check by name. The registration is **not** a separate case: it is a gate read in every phase's gate battery (§7.5).

### 7.4 Mutation register

Each row is a source mutation applied to the implementation; the named case must fail, with the expected failure-message family. `M` rows are the non-vacuity proof for the load-bearing invariants. A row may name more than one mutant where the mutants share one invariant (the total note lists them). The register is executed by the reviewer/fixer, not committed as a permanent suite (a permanent mutation harness belongs to review tooling; the permanent suite is the case list itself).

**Committed layer and ignore rules (5). Mandatory rows: the digest control and the two ignore controls.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M1 | Move the document with a content edit (reformat, reorder, or a value change) | `TC-LAYER-001` | `blob digest expected <pre-move sha256>, received <post-move sha256>` |
| M2 | Track `.delivery-os/config.yaml` beside the new file | `TC-LAYER-001` | `tracked path under a prior-namespace root: .delivery-os/config.yaml` |
| M3 | Write the new pattern as a literal path (`/.jaiship/projects.yaml`) instead of the brand-free glob | `TC-LAYER-002` | `runtime-written project pattern must be a brand-free glob, received /.jaiship/projects.yaml` |
| M4 | Make the new pattern match the tracked layer (drop the leading `.*/`) | `TC-LAYER-002` | `tracked layer reported ignored: .jaiship/config.yaml` |
| M5 | Depend on `.git/info/exclude` instead of a repository rule | `TC-LAYER-003` | `git status --porcelain expected 0 lines, received ?? .jaiship/` |

**Authoritative root and notices (4). Mandatory row: the migrated-host zero-notice control.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M6 | Read the prior file even when the current one exists | `TC-ROOT-001` | `loaded file expected <checkout>/.jaiship/config.yaml, received <checkout>/.delivery-os/config.yaml` |
| M7 | Emit `config-skipped` unconditionally, so a migrated host is noisy | `TC-ROOT-002` | `prior-identity lines expected 0, received config-skipped` |
| M8 | Write the prior root on read (copy-on-read) | `TC-ROOT-003` | `prior-root writes expected 0, received 1` |
| M9 | Read `config.local.yaml` under `CI=true` | `TC-ROOT-004` | `overlay expected ci-disabled with 0 reads, received read` |

**Migration surface and admission (7).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M10 | Accept an undeclared flag on the verb | `TC-MIGRATE-001` | `expected fallback.invocation at exit 1, received 0` |
| M11 | Resolve a relative `--backup-dir` against the cwd | `TC-MIGRATE-001` | `relative --backup-dir expected input.value.rejected, received migrated` |
| M12 | Accept a `--backup-dir` inside a source root | `TC-MIGRATE-001` | `in-source --backup-dir expected input.value.rejected, received migrated` |
| M13 | Let the alias run the verb | `TC-MIGRATE-001` | `expected install.identity.not-owning at exit 1, received migrated` |
| M14 | Skip the dev-build or linked-worktree admission for the verb | `TC-MIGRATE-001` | `expected install.dev-build, received migrated` / `expected install.target.worktree, received migrated` |
| M15 | Move before stopping the daemon | `TC-MIGRATE-002` | `stop expected before move 1, received after move 1` |
| M16 | Evaluate the daemon guard during `--dry-run` | `TC-MIGRATE-002` | `dry-run expected install.daemon.running never, received install.daemon.running` |

**Plan and dry-run (2).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M17 | Create the backup directory during `--dry-run`, or append the delivered command-audit pair during a dry run | `TC-MIGRATE-003` | `directories created expected 0, received 1` / `records appended expected 0, received 2` |
| M18 | Take the run stamp from ambient time rather than the injected clock | `TC-MIGRATE-003` | `two-run plan comparison differs at line <n> (run stamp)` |

**Apply, precedence and backup (7). Mandatory rows: the conflict no-delete control and the derived-entry control.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M19 | Delete a differing destination entry to "complete" the move, or follow/move a symlink entry | `TC-MIGRATE-006`, `TC-MIGRATE-001` | `conflict entry expected retained on both sides, received absent at <path>` / `symlink entry expected blocked/conflict and retained, received followed` |
| M20 | Report a differing duplicate as `duplicate-identical` and drop the source | `TC-MIGRATE-006` | `disposition expected conflict, received duplicate-identical` |
| M21 | Treat `host-index.json` as a conflict, or give it a disposition outside the closed six | `TC-MIGRATE-007` | `derived entry expected already-migrated (or absent), received conflict` |
| M22 | Rewrite `host-index.json` state locations during the move | `TC-MIGRATE-007` | `host-index bytes expected unchanged, received rewritten` |
| M23 | Skip the manifest write for a migrated run, or label the manifest with the plan payload's schema id | `TC-MIGRATE-004` | `manifest expected at <backup>/manifest.json, received absent` / `manifest schemaId expected install.migration.manifest.v1, received install.migration.plan.v1` |
| M24 | Move an entry before verifying the backup copy's digests, or write the delivered command-audit pair into a source root | `TC-MIGRATE-004` | `verify-before-move order expected, received move before verify` / `audit pair expected at <destination state root>, received <source root>` |
| M25 | Delete a `duplicate-identical` entry | `TC-MIGRATE-006` | `duplicate entry expected retained, received absent at <path>` |

**Idempotence, recovery and byte preservation (4). Mandatory row: the partial-failure no-duplicate control.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M26 | On the second run, create a backup, report `migrated`, or append a migration-specific record | `TC-MIGRATE-005` | `verdict expected already-migrated, received migrated` / `backup directories expected 0, received 1` / `migration record expected 0, received 1` |
| M27 | Re-copy an already-moved entry on the recovery run | `TC-MIGRATE-008` | `duplicate destination entry at <path>` |
| M28 | Re-serialise ledger headers during the move | `TC-MIGRATE-009` | `header digest expected <sha256>, received <sha256>` |
| M29 | Let the move change `install status`'s compatibility verdict | `TC-MIGRATE-009` | `install status verdict expected compatible, received <verdict>` |

**Post-move location (1).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M30 | Let the stale host index redirect a read to the prior root | `TC-MIGRATE-010` | `prior-root opens expected 0, received <path>` |

**Shims (5). Mandatory row: the seed-to-shim longest-literal control.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M31 | Resolve a bare `DELIVERY_OS_` occurrence to the shorter shim | `TC-SHIM-002` | `DELIVERY_OS_<name> expected prior-environment-prefix, received prior-working-name-override` |
| M32 | Drop a declared site that still exists in the tree | `TC-SHIM-001` | `declared site missing from the registry: <file>` |
| M33 | Add a wildcard site (`scripts/**`) | `TC-SHIM-001` | `wildcard site refused: scripts/**` |
| M34 | Leave `removalRelease` equal to (or below) `declaredIn` | `TC-SHIM-001` | `window expected removalRelease > declaredIn, received <v>/<v>` |
| M35 | Emit the `config-read` notice twice in one composed program | `TC-SHIM-003` | `config-read notices expected 1, received 2` |

**Conformance scan (6). Mandatory rows: the neutral-scope negative control and the two tree-arm negative controls.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M36 | Add a new `.delivery-os/x` path under `packages/**` | `TC-SCAN-001` | `.delivery-os at packages/<file>:<line>` |
| M37 | Drop the `promptSurface` class | `TC-SCAN-001` | `scope classes expected 7, received 6` |
| M38 | Remove the `@`-preceded exclusion | `TC-SCAN-002` | `false positive: @delivery-os/core reported as delivery-os` |
| M39 | Widen the neutral exclusion to any occurrence of the token, or drop the `SCOPE_ORG` neutral site (the two directions of the neutral-domain rule) | `TC-SCAN-002`, `TC-SCAN-001` | `product-identifier use of delivery-os expected a violation, received none` / `neutral site expected: packages/core/src/branding/index.ts (prior-executable ≤ 1)` |
| M40 | Track the `.jaiship -> .delivery-os` symlink | `TC-SCAN-004` | `tracked symlink .jaiship -> .delivery-os` |
| M41 | Track a file under `.delivery-os/` | `TC-SCAN-005` | `tracked path under a prior-namespace root: .delivery-os/<file>` |

**CI binding (2).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M42 | Mark the tree-arm job `continue-on-error: true` | `TC-SCAN-006` | `ci.yml: ts-namespace-conformance must not be advisory` |
| M43 | Drop the baseline-fetch step from the tree-arm job | `TC-SCAN-006` | `ci.yml: ts-namespace-conformance must fetch the recorded corpusBaseline commit (missing baseline fetch)` |

**Identity (8).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M44 | Give `DELIVERY_OS_WORKING_NAME` precedence over the derived override | `TC-IDENTITY-002` | `resolved identity expected <current override>, received <prior override>` |
| M45 | Fall back silently from an invalid override to the prior channel | `TC-IDENTITY-002` | `invalid override expected fallback.internal at exit 2, received resolved` |
| M46 | Map every `ADOS_*` name (unbounded), or drop the declared `ADOS_WORKING_NAME` exception | `TC-IDENTITY-003` | `config.environment.unmapped raised with the eight variables present` / `ADOS_WORKING_NAME expected the current override channel, received untouched` |
| M47 | Publish `ADOS_FOO` as a configuration value | `TC-IDENTITY-003` | `ADOS_FOO leaked as a configuration value: bar` |
| M48 | Leave the MCP default at `delivery-os` | `TC-IDENTITY-001` | `MCP created path expected ~/.jaiship/…, received ~/.delivery-os/…` |
| M49 | Re-introduce the override name as a committed literal | `TC-IDENTITY-005` | `committed override literal found at <file>:<line>` |
| M50 | Add a sixth product-surface literal site | `TC-IDENTITY-005` | `product-surface literal sites expected 5, received 6` |
| M51 | Keep a reconciled page naming the prior configuration path as current | `TC-IDENTITY-004` | `<page>: stale phrase present: .delivery-os/config.yaml` |

**Retirement and inventory (3). Mandatory row: the not-relaxed control.**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M52 | Leave `install.migration.unavailable` in `INSTALL_DOMAIN_CODES` | `TC-MIGRATE-011` | `install domain identities expected 10, received 11` |
| M53 | Remove the identity from the guide text but leave it in `GUIDE_REQUIREMENTS`, or delete the facts without replacing them | `TC-MIGRATE-011` | `doc/guides/local-install.md: missing required fact: install.migration.unavailable` / `missing required fact: <migration fact>` |
| M54 | Append `migrate` as a new top-level prompt-required command | `TC-MIGRATE-012` | `prompt-required count expected 28, received 29` |

**Tree-arm declaration (1).** Numbered last to preserve every existing id (the register never renumbers or reuses a row); the row is owned by `P4`, where the arm lands.

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M55 | Hardcode the prior-root prefix set in the tree arm (drop `.delivery-os-state`, or add a literal that no declaration carries) | `TC-SCAN-003` (and `AC-F1-2` alone) | `prior-root prefixes used expected <declared set>, received <hardcoded set>` |

Total: **55 mutations**, M1–M55 contiguous. Allocation by owning phase (`P1`…`P9`): **5+3+5+5+21+3+4+8+1 = 55** — `P4` gains `M55` and `P10` owns none. Every load-bearing invariant named in §1 has at least one row that names the case which must fail; the mandatory families are: the **migrated-host zero-notice** control (`M7`), the **conflict no-delete** control (`M19`, which also carries the never-follow/no-move symlink branch), the **partial-failure no-duplicate** control (`M27`), the **seed-to-shim longest-literal** control (`M31`), the **neutral-scope negative** control (`M39`, which also carries the dropped-neutral-site direction), and the **two tree-arm negative** controls (`M40`, `M41`) — seven mandatory controls, plus the **not-relaxed retirement** control (`M53`) and the **declared-prefix** control (`M55`), the only row whose expected failure is `AC-F1-2` alone. A row may name more than one mutant where the mutants share one invariant (dry-run writes, no-delete/no-follow, audit location, the derived disposition, the two neutral-domain directions); the data-bearing rows without a mutation — the `unscoped` scope, the never-existent-root report, the `ADOS_WORKING_NAME` exception — are asserted directly, and each names its case in §5.2.

### 7.5 Gate battery

Every command runs from the repository root with both environment prerequisites, because the lifecycle primitives (and the `commit` primitive in particular) probe the bare `commitlint` name and must not write outside the approved temp root:

```bash
mkdir -p tmp/tmpdir
export TMPDIR=$PWD/tmp/tmpdir
export PATH=$PWD/node_modules/.bin:$PATH
```

**Phase-gate self-sufficiency rule.** Every case asserts **only** behaviour that the phase owning it — or an earlier phase — implements. Each phase gate is executed **in isolation** and must be green on its own. A reviewer checks the rule by asking, for every case, which phase implements the behaviour it asserts, and requiring that ordinal to be ≤ the owning phase. §4.2 records the answer for every case; the two preconditions the spec names (layer before drill, registry before content arm) are satisfied within §4.2's assignment, and no case carries a labelled cross-phase segment.

**Gates per group (run during delivery, after the phase that owns the group):**

| Phase | Group | Command |
|-------|-------|---------|
| `P1` | Committed layer | `bun test tests/structure/namespace-layer.test.ts tests/checks/namespace-fresh-clone.test.ts tests/behaviour/namespace-loaded-path.test.ts tests/checks/ignore-rules-namespace.test.ts` then `bun run scripts/checks/ignore-rules.ts` then `bun test tests/structure/content-inventory.test.ts` |
| `P2` | Shims | `bun test tests/structure/namespace-shims-registry.test.ts` |
| `P3` | Content arm | `bun run scripts/checks/forbidden-literals.ts` then `bun test tests/checks/namespace-conformance.test.ts tests/checks/forbidden-literals.test.ts` |
| `P4` | Tree arm and binding | `bun run scripts/checks/namespace-tree.ts` then `bun run scripts/checks/ci-topology.ts` then `bun run scripts/checks/ci-bindingness.ts` then `bun test tests/checks/namespace-tree.test.ts tests/checks/namespace-gate-binding.test.ts` |
| `P5` | Migration | `bun test tests/behaviour/install-migrate.test.ts tests/behaviour/install-family-surface.test.ts tests/structure/install-ownership-split.test.ts tests/structure/entrypoint-bin.test.ts` |
| `P6` | Retirements and family | `bun test tests/checks/install-migration-retirement.test.ts tests/checks/install-lifecycle-docs.test.ts tests/checks/install-lifecycle-path.test.ts tests/checks/error-table-sync.test.ts tests/structure/cross-repository-contract.test.ts tests/checks/reference-page-parity.test.ts` then `bun run scripts/checks/help-guide-coverage.ts` |
| `P7` | Authoritative root | `bun test tests/behaviour/prior-identity-config-fallback.test.ts tests/behaviour/prior-identity-notice.test.ts tests/checks/prior-identity-hermetic.test.ts tests/behaviour/config-cli.test.ts tests/conformance/namespace` |
| `P8` | Identity | `bun test tests/behaviour/identity-override.test.ts tests/behaviour/legacy-adapter.test.ts tests/behaviour/namespace-identity-surfaces.test.ts tests/structure/branding-contract.test.ts tests/behaviour/prior-identity-state-fallback.test.ts` |
| `P9` | Documents | `bun test tests/checks/namespace-doc-battery.test.ts tests/checks/doc-conformance.test.ts tests/structure/rename-drill-doc.test.ts` then `bash scripts/.tests/test-doc-distribution.sh` when a redistributable page changes |
| every phase | Inventory and hygiene | `bun test tests/structure/content-inventory.test.ts` and `git diff --check` |

**Aggregate gates owned by the lifecycle quality phase (phase 9), not by this plan's per-phase battery:**

```bash
# The aggregate: lint → format:check → typecheck → test → check:boundaries → prompt/help/exports
TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH pnpm check

# The branch-range commit-message gate (needs the branch's own commit range, so it only exists at PR time)
./scripts/lint-commit-range.sh --base origin/main-tools
```

Rationale for the split: `pnpm check` also builds, typechecks and runs every unrelated suite, so it is the phase-9 aggregate rather than a per-phase loop; the range gate asserts the change branch's own commit messages against `origin/main-tools`, which is a delivery-lifecycle property. Both are recorded in pm-notes; a `FAIL` is remediated in the mode the gate names and an unresolved `ERROR` is never recorded as a pass.

The determinism gate needs no separate command: `TC-MIGRATE-003` and `TC-SCAN-006` each run their instrument twice inside the suite and compare canonical output.

The documentation-phase gates (`bun test tests/checks/doc-conformance.test.ts`, the `DOD-9` stale-statement grep over the reconciled page set, the proof-boundary page/constant comparison, and `bash scripts/.tests/test-doc-distribution.sh`) belong to the system-spec-update phase (`DOD-9`, `P10`), not to this plan's delivery battery.

### 7.6 Non-functional verification

**Offline determinism and no real home (`NFR-1`, `TC-IDENTITY-006`, `TC-LAYER-003`, `TC-MIGRATE-003`, `TC-SCAN-006`, `DOD-5`).** Assertions: `liveNetworkCalls === 0`; `packageManagerInvocations === 0`; `realHomeReads === 0` and `realHomeWrites === 0` (from the injected facts' recorders, with a canary path that must never be opened); two consecutive runs byte-identical after temp-root canonicalisation; the dry-run plan and both gate arms each compared across two runs. No wall-clock assertion is used anywhere; the only time source is the pinned clock plus the injected `delay` recorder.

**Bounded output (`NFR-2`, `TC-MIGRATE-003`, `TC-MIGRATE-004`, `TC-MIGRATE-006`).** Assertions: plan ≤ 60 human lines, run ≤ 60 human lines, 0 ANSI escapes, every line ≤ 512 bytes, machine payload ≤ 65 536 bytes, and the truncation behaviour is one counted `… N more` line rather than unbounded growth.

**Byte preservation (`NFR-3`, `TC-MIGRATE-004`, `-006`, `-009`).** Assertions: every moved file's digest equals its pre-move digest; 0 rewritten bytes; 0 deleted entries other than those moved; 0 schema-version or format-identifier changes; the second run reports a byte-identical state; both trees' byte-level before/after comparison in the mixed precedence world.

**Idempotence and recovery (`NFR-4`, `TC-MIGRATE-005`, `-008`).** Assertions: second clean run — 0 moves, 0 backup directories, `already-migrated`, exit 0; injected failure at *k* of *n* — the *n−k* unmoved entries intact, the manifest complete for all *n*, the payload naming both sets, and a re-run finishing `already-migrated` with no duplicate destination entry.

**Conformance coverage (`NFR-5`, `TC-SCAN-001`…`-006`).** Assertions: 7 scope classes with 6 carrying the prior-namespace class; ≥ 1 mutation per carrying class failing by name; the two non-carrying controls; the two negative controls; **0 undeclared occurrences** at the change head (occurrences inside a declared site, a declared corpus or a neutral site are the declared and expected ones); ≤ 60 s; 0 writes.

**Declared-site integrity (`NFR-6`, `TC-SHIM-001`, `-002`).** Assertions: 100% of declared sites present; every match inside a declared site, a declared corpus or a neutral site; 0 outside; every budgeted site at or below budget; 0 wildcards.

**Notice discipline (`NFR-7`, `TC-ROOT-002`, `-003`, `TC-SHIM-003`, `TC-IDENTITY-002`).** Assertions: ≤ 1 notice per reason per composed program; 0 in any payload; 0 exit-code changes; 0 on a migrated host; every line ≤ 200 bytes and free of environment values, credentials and file contents (a planted canary in the prior file's body must not appear).

**Contract invariance (`NFR-8`, `TC-MIGRATE-009`, `-011`, `TC-IDENTITY-005`).** Assertions: 1 error identity retired and 0 added; 1 subcommand added and 1 flag form retired; 0 configuration keys added, removed or renamed; 0 record/payload-schema or state-format identifiers changed; the five literal sites unchanged in count with two re-stated values and one re-derived; `PROMPT_REQUIRED_COMMANDS` unchanged at 28.

**Documentation discipline (`NFR-9`, `TC-IDENTITY-004`, `TC-MIGRATE-012`, `TC-ROOT-004`).** Assertions: every new or changed distributable page declares `ados_distribution`; the doc-distribution guard green; every new page registered in the forbidden-literal registry in the same change; `pnpm check:help` green with the install family page carrying `--help` and `--version`.

### 7.7 Proof boundary and its publication

Three complementary facts, one property — the battery's claims are bounded honestly.

**(a) The permanent constant.** `NAMESPACE_PROOF_BOUNDARY` in `tests/fixtures/namespace/evidence.ts` is the only source of the boundary: eight proven ids and eight not-proven ids in the declared order of spec Appendix G. `TC-IDENTITY-006` asserts the counts, the order, the disjointness, that every battery row declares exactly one proven id, that every proven id has at least one row, and that no row names a not-proven surface — with five planted controls.

**(b) The battery rows.** The row registry is authored incrementally, one row per case group as the group lands, and must be complete by `P7`. A row carries its case id and its `proven` id; the registry never carries expected output (the case does).

**(c) Publication is not a delivery case.** The same two lists are published on `doc/quality/test-specs/test-spec-namespace-conformance.md`. The page/constant comparison is a **documentation-phase (`P10`) check** performed once by the lifecycle phase-7 reconciliation (`@doc-syncer`) and recorded in pm-notes: no permanent delivery case reads the page, no aggregate suite enforces the equality (`tests/checks/doc-conformance.test.ts` does not read the namespace boundary), and a mismatch is a `DOD-9` defect, never a `TC-IDENTITY-006` failure. Neither this plan nor the change specification is a permanent source, and no permanent suite reads `doc/changes/**`.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation in this plan |
|------|--------|--------------------------|
| The migration destroys, splits or silently merges operator state (`RSK-1`) | H | `TC-MIGRATE-006` walks the six ordered rows with a byte-level before/after comparison of both trees; `TC-MIGRATE-004`/`-008` assert the manifest covers every planned entry; registers `M19`, `M20`, `M25`, `M27`. |
| A prior root stays authoritative because a read is silent (`RSK-2`) | H | `TC-ROOT-001`/`-002`/`-003` assert the loaded path, the zero-notice migrated host in two modes, and the single bounded prior-only notice; `TC-SHIM-003` asserts the notice text equals the registry's declaration; registers `M6`, `M7`. |
| The declared-site allowlist becomes a rubber stamp (`RSK-3`) | H | `TC-SHIM-001` refuses a wildcard, an absent site and a bad window; `TC-SHIM-002` reconciles both directions with a budget row; `TC-SCAN-001` plants one occurrence per class; registers `M31`–`M37`. |
| The neutral-scope exclusion smuggles a product identifier past the scan (`RSK-4`) | H | `TC-SCAN-002` keeps both neutral shapes green and requires a product-identifier use and an unscoped package name to fail; registers `M38`, `M39`. |
| A fresh clone is still dirtied by an undeclared runtime-written path (`RSK-5`) | M | `TC-LAYER-002` adds the coverage class and the root-anchored glob; `TC-LAYER-003` drills a real clone with no local exclude and the seeded write set; `TC-SCAN-003` adds the explicit-tracking case; registers `M3`–`M5`. |
| A stale `host-index.json` sends a read to the prior root (`RSK-6`) | H | `TC-MIGRATE-010` asserts every location is under the new root, zero prior opens, and the warning never redirects; `TC-MIGRATE-007` asserts the index is never rewritten; registers `M22`, `M30`. |
| A retirement leaves stale references in docs, fixtures or corpora (`RSK-7`) | M | `TC-MIGRATE-011` asserts the domain at 10, the row absent, zero non-corpus references, the corpora entry removed, and the guide's requirement set replaced rather than deleted; registers `M52`, `M53`. |
| The MCP default change breaks a consumer (`RSK-8`) | M | `TC-IDENTITY-001` asserts per-surface clean-home paths with the MCP composition unconfigured; `TC-SHIM-004` keeps the alias's payloads and `--version` byte-unchanged; register `M48`. |
| The bounded `ADOS_` mapping drops a used mapping (`RSK-9`) | M | `TC-IDENTITY-003` keeps a known-key mapping green beside the eight inert variables and the inert `ADOS_FOO`, and asserts the one declared `ADOS_WORKING_NAME` exception reaches the current override channel; registers `M46`, `M47`. |
| A migration races an open store (`RSK-10`) | H | `TC-MIGRATE-002` asserts the refusal without the flag, the zero-write dry-run (including `--dry-run --stop-daemon`), and the stop-before-first-move ordering from a recorder; registers `M15`, `M16`. |
| The migration's own command-audit write lands in a prior root, re-creating the source it is moving (`S2` residual) | H | `TC-MIGRATE-004` step 7 and `TC-MIGRATE-010` step 6 assert exactly the delivered pair (`audit.reservation`, `audit.invocation`) at the **destination** root, after planning and before the first move, with zero prior-root writes including the audit store and zero migration records; `TC-MIGRATE-003` step 5 asserts a dry run writes none; registers `M17` (dry-run record branch), `M24` (audit-in-source branch), `M26` (migration-record branch). |
| A symlink entry redirects a move, a read, or a retirement (`DM-6` symlink rule) | H | `TC-MIGRATE-001` steps 10–11 assert a source symlink is `blocked` and a destination symlink `conflict`, both retained, never followed, never moved, with a zero-write recorder under the link target; `TC-SCAN-004` covers the tracked shape at the gate; register `M19` (follow/move branch). |
| A managed `PATH` block under a prior root survives the migration silently (`S6`) | M | `TC-MIGRATE-004` step 8 asserts the read-only residual line with the `install` remedy and 0 profile writes; `TC-IDENTITY-004` asserts the guide sentence; the block is never edited (`DM-6`, §22). |
| A new prior identifier in prose passes because the executable token is not scanned in docs (`RSK-11`) | M | The residual is **asserted as a deliberate negative control** (`TC-SCAN-001` row H), so the boundary is visible and over-enforcement cannot break the corpus; the path and environment seeds are what `TC-SCAN-001` proves. |
| A migrated host is re-dirtied by the shell fallback's hardcoded prior root (`RSK-12`) | M | Declared, not tested: both literals stay as declared sites with budgets (`TC-SHIM-002` row D keeps them green), the operator remediation is asserted as documentation (`TC-IDENTITY-004`), and the not-proven list carries `shell-fallback-post-migration` (`TC-IDENTITY-006`). |
| The battery proves fixtures rather than the shipped composition | H | Every case names the production seam it exercises (§7.1); the migration battery drives the real command and the real domain; `TC-SHIM-003` compares the notice text to the registry rather than to a test-local copy; `TC-IDENTITY-006` machine-checks the boundary. |
| A case asserts behaviour a later phase implements, so its phase gate cannot be green in isolation | H | §4.2 assigns every case to one phase, §7.5 states the self-sufficiency rule and the precondition audit, and the plan folds spec items (5)+(6) so all ten `F-3` cases land together. |
| A dry-run becomes non-deterministic because the run stamp is ambient | M | `TC-MIGRATE-003` step 7 compares two runs and `M18` names the defect; §8.2 `A4` records the injected-clock consequence so the implementation plan carries it. |
| A pinned corpus is weakly relaxed instead of updated | H | `TC-MIGRATE-011` asserts the entry is **removed** and that the requirement set is replaced; `M53` fails a deletion-without-replacement. |
| A case states an exit literal the delivered matrix does not project | M | §3.3's exit-literal rule; `TC-MIGRATE-011` pins the install domain's row set, so a contradicting case fails the invariance check instead of silently editing an expectation. |

### 8.2 Assumptions

1. **The production seams the battery needs exist or are created in this change:** the migration domain modules (plan builder, decision table, apply step, manifest writer/reader, digest verification), the `install migrate` verb handler, the `namespace-tree.ts` arm, the extended `forbidden-literals.ts`, the extended `ignore-rules.ts`, and the shim registry. This is the testability consequence of the criteria, not a new requirement; if the implementation plan drops any of them, the corresponding coverage becomes unachievable and must be reopened rather than downgraded to a test-local reimplementation.
2. **The composition accepts additive, non-operator injection facts for offline determinism:** `environment`, `homeDirectory`, `cwd`, `workingName`, `clock`, `newRunId`, `processId`, the filesystem facts, and the daemon port. This mirrors the delivered install and entrypoint composition patterns and adds no configuration key (`NFR-8`).
3. **The staged TDR-0074 files are in an early delivery phase scope.** Per the pm-notes staging constraint, the plan must declare both `doc/decisions/TDR-0074-project-groups-document-operator-local-overlay.md` and `doc/decisions/00-index.md`, and re-add the index row there; no suite reads `doc/decisions/**` for the disposition, so `TC-ROOT-004` is unaffected by the staging.
4. **The migration run stamp and `runId` are composition-injected, not ambient.** `NFR-1` and `AC-F3-2`'s "two runs of the same state produce identical output" are attainable only if the plan takes its stamp from the injected clock (the delivered `clock`/`newRunId` pattern). `Appendix D` leaves the stamp *format* implementation-decided; this plan assumes only that its *source* is injected. A plan built from `Date.now()` fails `TC-MIGRATE-003` step 7 and `M18`, which is the intended testability consequence.
5. **The run and per-root verdict is `DM-6`'s single stated composition rule, not an assumption.** Each entry carries one disposition; the verdict is the maximum severity under `migrated` < `duplicate-identical` < `conflict` < `blocked`, with `absent` (nothing to do) and `already-migrated` (nothing to move) neutral and `duplicate-identical` a retained success; a neutral maximum reports `already-migrated`, a `migrated`/`duplicate-identical` maximum reports `migrated`, and a `conflict`/`blocked` maximum reports `conflict`/`blocked` when no planned move completed and `partial` when at least one did. The criterion names this rule and the plan asserts it in `TC-MIGRATE-006` (mixed world `partial`, conflicts-only `conflict`, duplicates-only `migrated`) and `TC-MIGRATE-007` (derived dispositions neutral).
6. **`AC-F3-2`'s "exit 0 always" is scoped to a well-formed invocation.** Admission precedes planning (`API-1`), so a `--dry-run` carrying a relative or in-source `--backup-dir` is refused at exit 1 and writes nothing — asserted by `TC-MIGRATE-001` steps 3–4.
7. **"A source root" in the `--backup-dir` refusal means the source side of a root class** (today the prior-namespace path), never the destination. The default backup root lives inside the **destination** configuration root (`~/.jaiship/migration-backups/…`), so it is never a source root and can never re-enter the plan — which is what makes the spec's "outside every source root" sentence consistent with "inside the current configuration root".
8. **Two distinct "non-carrying" facts in the content arm, asserted separately.** `rootWorkspaceFiles` does not carry the `priorNamespace` class at all; `userFacingDocs` carries the path and environment seeds but not the executable seed (spec `DM-4` and §5.1 F-5). `TC-SCAN-001` rows G and H assert them apart so neither can be conflated with the other.
9. **`AC-F2-2`'s zero-notice precondition excludes a prior environment input.** `API-4` says a notice is emitted when a prior input exists; `DELIVERY_OS_WORKING_NAME` is such an input, so `TC-ROOT-002`'s precondition explicitly leaves it unset and the override row is asserted by `TC-IDENTITY-002`/`TC-SHIM-003`.
10. **The prompt-required inventory is 28 today and stays 28.** `install` is one family mounted already and `provider` is last (`GH-350`); the migration adds a verb inside the family, so no repin and no reference-page mapping change is legitimate. `TC-MIGRATE-012` asserts the count and `M54` proves the control.
11. **The retired error identity's entry is removed from the pinned corpora, not marked optional.** This includes `INSTALL_DOMAIN_CODES`, the `ERROR_TABLE` row, `doc/spec/features/feature-result-contract.md`, `doc/spec/features/feature-install-lifecycle.md`, `doc/guides/local-install.md`, the M4 command/install-model pages, and `tests/fixtures/result/code-corpora/true-positives.json`. `TC-MIGRATE-011` asserts each site; `M53` proves a relaxed (deleted-but-still-required, or relabelled) variant fails.
12. **The migration never touches the install record or a delivered store's accepted format.** `TC-MIGRATE-009` asserts both; `TC-MIGRATE-004` asserts zero install-record fields, zero migration records, and that the only store write is the delivered command-audit pair at the destination root (`DM-7`), which is not a migration record and never appears in the plan's `entries[]`.
13. **`tests/structure/inventory.json` registration is a per-phase gate obligation, not a case.** Every new module is registered in the phase that introduces it; the delivered content-inventory check fails an unregistered module by name.

### 8.3 Open Questions

**None open.** The one question this plan recorded — a genuine tension between two criteria of the specification, not a gap this plan could resolve by choosing a reading silently — was ruled by the PM on 2026-11-21. The disposition is stated here and its status is recorded in §8.4.

| ID | Question | Ruling (in force) | Owning spec sections | Affected case | Status |
|----|----------|-------------------|----------------------|---------------|--------|
| `OQ-TP-1` | **What is the exit and identity of a failure during the apply loop, after *k* of *n* planned moves?** `AC-F3-6` requires "the exit is 1 with verdict `blocked` or `partial`", while `DM-8` maps "a copy, rename, or verify failure at the destination" onto the delivered `state.write.failed`, which projects to `platform-provider` at exit 2. The same event therefore had two declared outcomes. | **The PM ruled that `AC-F3-6` governs a planned move while `DM-8` governs the backup and the manifest.** A failure of a **planned move** (the copy-verify-rename/copy-merge step inside the apply loop) is the recovery contract of `AC-F3-6`: exit 1 with the data-bearing verdict `blocked` or `partial`, the moved and unmoved sets named, and the backup complete for all *n*. `state.write.failed` governs a failure **outside** the apply loop — writing the backup copy or the manifest, where no partial move state machine exists — and keeps its delivered projection at exit 2. Reason: `DM-8`'s opening clause is "every migration failure maps onto a delivered identity", and a mid-loop failure already has a data-bearing vocabulary in `API-2`; routing it to an error code would contradict `API-2`'s "a data-bearing negative verdict carries no error code" and would make the recovery contract unreachable. The ruling adds no identity and changes no projection row. | `AC-F3-6`, `API-2`, `DM-5`, `DM-8`, `DM-6`, `NFR-4` | `TC-MIGRATE-008` step 5 | **Resolved — PM ruling (2026-11-21).** A failure of a planned move inside the apply loop is `AC-F3-6`: exit 1, a data-bearing `blocked` or `partial` verdict, both sets named, no error identity (`API-2`). `state.write.failed` (platform-provider, exit 2) is reserved for a failure outside the apply loop — the backup copy or the manifest write. No case, AC link, mutation row, fixture, or phase assignment changes. |

### 8.4 Resolved questions

**Three dispositions, recorded so a reviewer checks a case against a rule rather than against a question.** `OQ-TP-1` was ruled by the PM on 2026-11-21; `OQ-1` and `OQ-2` were resolved before this plan and neither reopens here.

| ID | Status | Ruling in force | Asserted by |
|----|--------|-----------------|-------------|
| `OQ-TP-1` | **Resolved — PM ruling (2026-11-21)** | A failure of a **planned move** inside the apply loop is governed by `AC-F3-6`: exit 1 with the data-bearing verdict `blocked` or `partial`, the moved and unmoved sets named, and no error identity (`API-2`). `state.write.failed` (platform-provider, exit 2) is reserved for a failure **outside** the apply loop — the backup copy or the manifest write — where no partial move state machine exists; the ruling adds no identity and changes no projection row. | `TC-MIGRATE-008` step 5 (and §8.3) |
| `OQ-1` | Resolved — `DEC-12` / TDR-0074 | **`DEC-12` / TDR-0074.** It is an operator-local, git-ignored overlay at its unchanged path and schema; a fresh clone's target set is the declared empty listing; the ceremony mirror composes from the invoking checkout's own document only; no tracked template lands in this change. | `TC-ROOT-004` steps 3–7, `TC-SCAN-003` step 5 (a tracked runtime file fails by name), `TC-IDENTITY-004` step 6 (the reconciled sentences) |
| `OQ-2` | Resolved — `DEC-13` | **`DEC-13`.** No shell prior-root literal is re-pointed in this change; both stay as declared sites with occurrence budgets, the batteries keep asserting the current literals, the fix shape (current-else-prior selection, not a string swap) belongs to M4-S8/GH-352, and the operator remediation is the fallback's own override pointed at the current host root. | `TC-SHIM-002` row D (both literals stay green under declared budgets), `TC-IDENTITY-004` step 6 (the remediation sentences), `TC-IDENTITY-006` (`shell-fallback-post-migration` is not-proven) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-21 | @test-plan-writer | Initial test plan for GH-365 against spec v1.1: **36 cases in 6 groups** (`TC-LAYER` 4, `TC-ROOT` 4, `TC-MIGRATE` 12, `TC-SHIM` 4, `TC-SCAN` 6, `TC-IDENTITY` 6), **31/31 AC traceability** (37 links, 6 extras, 0 unmapped, 0 orphan, 34 AC-linked / 2 NFR-only), the committed-layer move and its two brand-free ignore globs with the fresh-clone drill, the authoritative root with the bounded notice-bearing prior read and the operator-local group document, the `install migrate` verb with every refusal arm, the daemon ordering, the zero-write dry-run, the full move with digest equality and a complete manifest, the six-row `DM-6` matrix plus the derived destination-wins entry, idempotence, injected partial failure and recovery, byte preservation with no re-versioning, post-move locations, the retired flag form and retired error identity removed from the pinned corpora, the shim registry with both-directions reconciliation, the two-arm conformance gate with its per-class mutations, the neutral-scope cases and the two tree-arm negative controls, the CI binding, the per-surface clean-home paths including MCP, the override precedence and containment, the bounded pre-freeze mapping with the eight owner-named variables and the inert `ADOS_FOO`, the enumerated documentation battery with projection currency, the five literal sites, and the permanent eight-proven / eight-not-proven `NAMESPACE_PROOF_BOUNDARY`; the **54-row mutation register** M1–M54 with the seven mandatory controls; the fixture inventory (**21 reused / 7 extended / 11 authored**); the `P1`…`P10` phase map with the self-sufficiency rule and the precondition audit; the gate battery with the `TMPDIR`/`PATH` conventions; and **one open question** (`OQ-TP-1`) with a recommended PM ruling. Spec §19 items (5) and (6) are folded into `P5` so every `F-3` criterion is phrased over a command that exists at its growing phase. |
| 0.3 | 2026-11-21 | @test-plan-writer | DoR iteration 1 remediation (B1–B5 and the spec v1.4 consequences; **36 cases in 6 groups unchanged, 0 added, 0 removed, 0 renumbered**). **B1:** `TC-MIGRATE-007` asserts the derived entry's closed disposition `already-migrated` (or `absent` when no destination copy exists) with its reported reason — never in the source-move set, never a conflict — and §8.2 `A5` now cites `DM-6`'s stated composition rule instead of an invented severity order. **B2:** `TC-MIGRATE-004` step 7 and `TC-MIGRATE-010` step 6 assert exactly the two delivered audit records (`audit.reservation`, `audit.invocation`) at the **destination** root, with zero migration records, zero delivery records and zero prior-root writes including the audit store. **B3:** `TC-ROOT-004` drops the two `(extended)` claims for `projects-config.test.ts`/`ceremony-mirror-composition.test.ts` and targets `config-cli.test.ts` plus the delivered `projects-groups-list.test.ts` (composition unchanged, `DEC-12`). **B4:** `TC-MIGRATE-002` adds the `--dry-run --stop-daemon` live-daemon row (0 port calls, `daemon: unchecked`). **B5:** `TC-MIGRATE-012` marks `help-guide-coverage.ts` verify-only. **Spec v1.4 consequences, all folded into existing cases:** `TC-SCAN-003` asserts the tree arm's prior-root prefix set is read from the declaration and reported, with **`M55`** (the only failure attributable to `AC-F1-2` alone); `TC-SCAN-001`/`-002` add the `SCOPE_ORG` neutral site, the ADR-0003 DEC-8 allowlist-independence control and the two reworded pages; `TC-MIGRATE-001` adds source-symlink `blocked`, destination-symlink `conflict` and the `unscoped` project scope; `TC-MIGRATE-003` adds the `NFR-2` ≤ 60-line bound with exactly one counted `… N more` line and asserts a dry run appends no record of any kind; `TC-MIGRATE-004` asserts the managed-`PATH` residual, the manifest id `install.migration.manifest.v1` and the payload id `install.migration.plan.v1`; `TC-MIGRATE-005` asserts a never-existent source root is neither retired nor reported; `TC-IDENTITY-003` adds the `ADOS_WORKING_NAME` declared exception; `TC-IDENTITY-004` names the two reworded rows. The register is **55 mutations, M1–M55**, allocation `5+3+5+5+21+3+4+8+1 = 55` (`P4` gains `M55`; `P10` owns none), with the reused rows extended rather than renumbered (`M17`, `M19`, `M21`, `M23`, `M24`, `M26`, `M39`, `M46`). AC mapping unchanged: 31/31, 37 links, 34 AC-linked / 2 NFR-only; fixture inventory unchanged: **21 reused / 7 extended / 11 authored**; the `P1`…`P10` phase map and every case's owning phase unchanged. §2 references spec v1.4 and §7.6's `NFR-5` threshold is **0 undeclared** occurrences. |

## 10. Test Execution Log

Populated during delivery. One row per case group; the battery is run whole before each phase boundary. Review-phase observations that are not permanent cases are recorded here with their evidence.

| TC ID(s) | Run Date | Result | Notes |
|----------|----------|--------|-------|
| — | — | Not run | Awaiting delivery |
| `OQ-TP-1` | — | Resolved — PM ruling (2026-11-21) | Ruled per §8.3/§8.4: a failure of a planned move inside the apply loop is `AC-F3-6` (exit 1, data-bearing `blocked`/`partial`, no error identity); `state.write.failed` is reserved for the backup copy or the manifest write. `TC-MIGRATE-008` step 5 asserts it; no case, AC link, mutation row, fixture, or phase assignment changes. |
| `TC-IDENTITY-006` publication | — | Not run | The `NAMESPACE_PROOF_BOUNDARY` page/constant comparison is a `P10` documentation-phase check (`DOD-9`), recorded in pm-notes; no delivery case reads the page. |
| `DOD-3` | — | Not run | Phase-9 `./scripts/lint-commit-range.sh --base origin/main-tools` verdict, recorded in pm-notes; not a case. |
| `DOD-4` fresh-clone drill | — | Not run | Owned by `TC-LAYER-003` (behaviour) and `TC-LAYER-001` (structure); the drill needs no local exclude and no real home. |
| `DOD-6` shell and prompt untouched | — | Not run | The shell half is the delivered byte pin over the shell surface (run in the every-phase hygiene gate); the prompt half is a phase-9 change-surface review of the diff, never a permanent case (`.ai/rules/testing-strategy.md`). |
| `tests/structure/inventory.json` registration | — | Not run | Per-phase gate read (§7.5), not a case. |
