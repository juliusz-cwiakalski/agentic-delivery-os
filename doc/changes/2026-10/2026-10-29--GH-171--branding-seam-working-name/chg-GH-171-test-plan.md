---
id: chg-GH-171-test-plan
status: Updated
created: 2026-10-29T00:00:00Z
last_updated: 2026-10-29T23:55:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["oss-tooling", "branding", "m0", "adr-0003"]
version_impact: minor
summary: "Verify the single branding seam: one pure resolver derives all twelve DEC-8 values deterministically from config-driven data and injected environment facts; the BrandIdentity contract lives once in core ./contracts; the forbidden-literal scan covers all five DEC-8 scope classes with the docs class anchored to a fixed corpus baseline and permanent registry membership, fails by file and token, honors exactly the DEC-8 allowlist, and binds in CI; the legacy adapter maps legacy sources with exactly one warning per process and never imports branding; telemetry schema names stay brand-neutral; the rename drill is documented, name-free, and complete; and every existing gate remains green."
links:
  change_spec: ./chg-GH-171-spec.md
  implementation_plan: ./chg-GH-171-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S2: Branding seam and working name

## 1. Scope and Objectives

This change ships a seam, not a product name. The tests prove five properties and nothing beyond them: **single-source derivation** (one pure resolver produces the full twelve-value DEC-8 set from a working name plus injected environment facts, deterministically and fail-closed), **contract placement** (`BrandIdentity` is defined once in `core ./contracts` and branding imports it for the type only, with the tier and ambient matrices green), **enforcement** (a forbidden-literal scan covers all five DEC-8 scope classes, honors exactly the DEC-8 allowlist, fails by file and token, is mutation-proven, and binds in CI), **legacy compatibility** (the `adapters ./legacy` adapter maps legacy sources to current names received as parameters, warns exactly once per process, never imports branding, introduces no new pre-freeze variables, and passes the scan under its allowlist entry), and **artifact integrity** (brand-neutral telemetry schema names, a name-free rename-drill document with its execution obligation, and zero regression in the existing bash, boundary, and aggregate gates).

The integrity risks guarded here are silent boundary decay, a resolver that acquires ambient inputs or defaults, a scan that is advisory or scope-narrowed, an allowlist that grows unreviewed, a legacy adapter that becomes a second seam, substring matching that trips on ordinary words, a candidate or public name leaking into an artifact, and the delivered seam weakening any GH-170 gate while adding new executable content.

### 1.1 In Scope

- Resolver completeness, determinism, derivation-rule conformance, and fail-closed input handling for all twelve DEC-8 values (F-1, AC-F1-1, NFR-2, DM-1, DM-2).
- Seam integrity: no committed working-name literal, no name-derived value computed outside the resolver, resolver purity (no ambient reads, clock, randomness, or runtime APIs) (F-1, AC-F1-2, NFR-1, NFR-2).
- `BrandIdentity` single definition in `core ./contracts`; branding imports `./contracts` only; tier matrix green (F-2, AC-F2-1, NFR-7, DM-1).
- Environment override via injected environment facts: override precedence, no rebuild, neutral override variable, zero ambient reads in branding (F-3, AC-F3-1, NFR-1, DM-2).
- Forbidden-literal scan: five scope classes, a docs scope anchored to a fixed `corpusBaseline` with permanent registry membership, DEC-8 allowlist, seed set, matching semantics, failure path, mutation evidence, CI bindingness, and subsumption of the `.gitignore`-local token scan without weakening the hygiene check (F-4, AC-F4-1, AC-F4-2, AC-F4-3, NFR-3, NFR-4, NFR-8, DM-3, C-8).
- Legacy adapter: mapping to parameter-supplied current names, exactly one warning per process, zero when absent, secret-safe warning text, no branding import, no new legacy-prefixed variables, literal confinement and scan allowlist behavior (F-5, AC-F5-1, AC-F5-2, AC-F5-3, NFR-5, NFR-6, NFR-7).
- Brand-neutral telemetry schema reservation (`delivery.event.v1`, with `delivery.metric.v1` as the informational sibling), producer-name-as-metadata, and absence of an emission path (F-6, AC-F6-1, EVT-1, EVT-2).
- Rename-drill document completeness, self-containment, name-freedom, and execution obligation (F-7, AC-F7-1, NFR-9).
- Boundary conformance and negative-fixture discipline for any new forbidden rule; fixture-coverage meta-check; no unenforced rule (F-8, AC-F8-1, NFR-7).
- Content-inventory discipline update: the GH-170 empty-but-enforced policy is changed deliberately for exactly the new executable modules, not disabled (NFR-8, F-8).
- Regression safety: `bun test`, boundary suite, aggregate `pnpm check`, existing bash suites and jobs, CI topology, bindingness, supply-chain checks, and no new dependencies (NFR-8).

### 1.2 Out of Scope & Known Gaps

- [OUT] Executing the rename drill, freezing a name, flipping package privacy, applying a branded scope, publishing, or building a release binary (spec §7.2, §7.3, NG-6).
- [OUT] The layered configuration layer and its wiring (M0-S4), state drivers (M0-S5), telemetry emission, metric implementation, MCP tool implementation, and CLI command implementation (NG-1, NG-4, NG-5).
- [OUT] Migration or renaming of the pre-existing installed corpus. Per DEC-8 scope-of-claim, the scan claims `packages/**` and user-facing docs **absent at the fixed `corpusBaseline`** only; docs that already existed at that baseline are not scanned and are not claimed (NG-2, A-T2).
- [OUT] Any public product name, candidate name, or naming decision. The tests use synthetic names only; detecting a candidate name is not automatable and remains an owner review gate (NG-3, NFR-9).
- [OUT] Changes to `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/`, or the bash CI jobs. Only non-regression is asserted (NG-8, C-5/C-6/C-8).
- [OUT] Cloud surfaces, network services, persisted data, and performance/load testing. No such surface exists in this change.
- [OUT] A production runtime-aware edge. The resolver-input contract is exercised by an injected-facts test harness; the first real edge arrives with M0-S4. This is deferred wiring, not a coverage gap (spec §7.3, A-T3).
- [OUT] `tests/**` as a scan scope class. Tests legitimately contain seed tokens as scan fixtures; they are excluded from the DEC-8 scan, and synthetic-name discipline there is enforced by review plus the fixture registries (A-T4, NFR-9).

## 2. References

- **Change specification**: [chg-GH-171-spec.md](./chg-GH-171-spec.md) — F-1..F-8, EVT-1/EVT-2, DM-1..DM-3, NFR-1..NFR-9, DEC-1..DEC-7, AC-F1-1..AC-F7-1, §17 ticket-AC mapping, Appendix A (derived-value set) and Appendix B (scan contract).
- **Implementation plan**: [chg-GH-171-plan.md](./chg-GH-171-plan.md) — planned at delivery planning; phase/task IDs are bound there. TC IDs here are behaviour-bound and do not depend on task numbering.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — canonical for layers, runners, module-to-test mapping, mutation tests for `scripts/checks/*.ts`, and aggregate `pnpm check`.
- **Authoritative decision**: [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — C-3 naming firewall, DEC-4 config path, DEC-8 placement, derived-value set, scan scope/allowlist/growth rule, legacy adapter rules, telemetry neutrality, rename drill, and scope-of-claim.
- **Current-truth baseline**: [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md) — six-package workspace, tier matrix, ambient guard, negative-fixture discipline, aggregate check, CI job list.
- **Sibling format/rigor reference**: [chg-GH-170-test-plan.md](../2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-test-plan.md) — structure-over-content test design, scan rule-to-fixture matrix, mutation-test pattern.
- **Owner constraint**: issue #171 comment of 2026-10-29, transcribed in spec §1 — branding seam only, no hardcoded product token, no candidate or public name in any artifact, synthetic names in fixtures.
- **Repo conventions**: [AGENTS.md](../../../../AGENTS.md) — branch model, no license headers in `doc/changes/`, bash test layout, TypeScript test layout.
- **Existing mechanisms to reuse**: `scripts/checks/ambient-globals.ts`, `scripts/checks/ignore-rules.ts`, `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/**`, `tests/checks/**`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Resolver returns all twelve DEC-8 values for a synthetic working name and empty facts; same input yields identical output | TC-BRANDING-001, TC-BRANDING-002, TC-BRANDING-003, TC-BRANDING-004 | Covered |
| AC-F1-2 | No name-derived value is computed outside the resolver; no working-name literal is committed anywhere, including branding | TC-BRANDING-021, TC-BRANDING-008, TC-BRANDING-022 | Covered |
| AC-F2-1 | `BrandIdentity` defined once in `core ./contracts` with the full twelve-value set; branding imports `./contracts` only; tier matrix green | TC-BRANDING-005, TC-BRANDING-006, TC-BRANDING-023 | Covered |
| AC-F3-1 | Injected override reflects the synthetic name without rebuild; branding has zero ambient environment reads | TC-BRANDING-007, TC-BRANDING-006 | Covered |
| AC-F8-1 | Tier and ambient rules hold; any new forbidden rule ships with a registered failing negative fixture | TC-BRANDING-006, TC-BRANDING-016, TC-BRANDING-022, TC-BRANDING-023 | Covered |
| AC-F4-1 | Injecting a seed literal into each of the five scope classes fails the scan, naming file and token, with mutation-test evidence, including a literal injected into an already-merged registered doc | TC-BRANDING-009, TC-BRANDING-027 | Covered |
| AC-F4-2 | Delivered state: five of five classes covered, docs scope anchored to a fixed corpus baseline with permanent membership, exactly the DEC-8 allowlist honored, run green | TC-BRANDING-008, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-013, TC-BRANDING-027 | Covered |
| AC-F4-3 | Scan executes as a binding CI job; ci-topology and ci-bindingness green; existing jobs unchanged | TC-BRANDING-012, TC-BRANDING-024 | Covered |
| AC-F5-1 | Legacy adapter passes the scan under its allowlist entry and contains no token beyond the legacy set used for mapping | TC-BRANDING-011, TC-BRANDING-018 | Covered |
| AC-F5-2 | Legacy sources map to parameter-supplied current names; exactly one warning per process; zero when no legacy source | TC-BRANDING-014, TC-BRANDING-015 | Covered |
| AC-F5-3 | Legacy adapter never imports branding; no new pre-freeze-prefixed variable anywhere | TC-BRANDING-016, TC-BRANDING-017 | Covered |
| AC-F6-1 | `delivery.event.v1` reserved brand-neutral; producer name is branding metadata, not schema; no emission path | TC-BRANDING-019 | Covered |
| AC-F7-1 | Rename drill is self-contained and name-free, passes the scan, covers the full battery, asserts config-glob and root-workspace name-freedom, and states the execution obligation | TC-BRANDING-020, TC-BRANDING-008 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-BRANDING-001, TC-BRANDING-002, TC-BRANDING-003, TC-BRANDING-004, TC-BRANDING-021; F-2 → TC-BRANDING-005, TC-BRANDING-006; F-3 → TC-BRANDING-006, TC-BRANDING-007; F-4 → TC-BRANDING-008, TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-012, TC-BRANDING-013, TC-BRANDING-027; F-5 → TC-BRANDING-014, TC-BRANDING-015, TC-BRANDING-016, TC-BRANDING-017, TC-BRANDING-018; F-6 → TC-BRANDING-019; F-7 → TC-BRANDING-020; F-8 → TC-BRANDING-006, TC-BRANDING-016, TC-BRANDING-022, TC-BRANDING-023.

**Ticket AC coverage** (spec §17 mapping):

| Ticket AC | Verified by | Notes |
|-----------|-------------|-------|
| AC-1 every name-derived value traces to the branding seam | TC-BRANDING-001, TC-BRANDING-002, TC-BRANDING-003, TC-BRANDING-004, TC-BRANDING-005, TC-BRANDING-006, TC-BRANDING-007, TC-BRANDING-016, TC-BRANDING-021, TC-BRANDING-022, TC-BRANDING-023 | Derivation, contract placement, override, confinement, outside-derivation prohibition, and inventory discipline |
| AC-2 forbidden-literal test fails CI outside the allowlist | TC-BRANDING-008, TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-012, TC-BRANDING-013, TC-BRANDING-027 | Five-class failure path, exact allowlist, matching semantics, CI bindingness, hygiene subsumption, and permanent docs-scope membership after merge |
| AC-3 legacy adapter itself passes the scan | TC-BRANDING-011, TC-BRANDING-018 | Delivered-state green under the allowlist entry plus reviewed literal inventory |
| AC-4 legacy environment and config still read with a warning | TC-BRANDING-014, TC-BRANDING-015, TC-BRANDING-016, TC-BRANDING-017 | Mapping, exactly-once warning, secret safety, no branding import, no new legacy variables |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP surface exists in this change (spec §8.1).

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| DM-1 | `BrandIdentity` twelve-value runtime-neutral type in `core ./contracts` | TC-BRANDING-001, TC-BRANDING-004, TC-BRANDING-005 | Covered |
| DM-2 | Resolver input contract: config-driven working name plus injected environment facts, including the neutral override | TC-BRANDING-003, TC-BRANDING-007 | Covered |
| DM-3 | Forbidden-literal registry: five scope classes, exact DEC-8 allowlist, seed set, a docs scope anchored to a fixed `corpusBaseline` with permanent membership, growth rule | TC-BRANDING-008, TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-027 | Covered |
| EVT-1 | `delivery.event.v1` reserved brand-neutral schema name; producer name is branding metadata; no emission | TC-BRANDING-019 | Covered |
| EVT-2 | `delivery.metric.v1` reserved by the same DEC-8 rule; informational in this change | TC-BRANDING-019 | Covered (informational) |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Resolver purity: zero ambient environment reads, ambient clock/randomness, or runtime-API imports in branding | TC-BRANDING-006, TC-BRANDING-007 | Covered |
| NFR-2 | Twelve of twelve values from the resolver; same input → same output; zero values computed outside the resolver in new code | TC-BRANDING-001, TC-BRANDING-002, TC-BRANDING-003, TC-BRANDING-004, TC-BRANDING-021 | Covered |
| NFR-3 | Five of five scope classes scanned every PR, including registered docs that are no longer "new" relative to any recent ref; violation names file and token | TC-BRANDING-008, TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-018, TC-BRANDING-027 | Covered |
| NFR-4 | At least one mutation proving the failure path; binding CI job; ci-topology and ci-bindingness green | TC-BRANDING-009, TC-BRANDING-012 | Covered |
| NFR-5 | Exactly one warning per process when any legacy source is read; zero when none; no secret material in warning output | TC-BRANDING-014, TC-BRANDING-015 | Covered |
| NFR-6 | Zero new pre-freeze-prefixed variables introduced | TC-BRANDING-017 | Covered |
| NFR-7 | Zero new boundary violations; every new forbidden rule has at least one failing negative fixture registered | TC-BRANDING-005, TC-BRANDING-006, TC-BRANDING-016, TC-BRANDING-022, TC-BRANDING-023 | Covered |
| NFR-8 | No regression in bash jobs, the `ts-*` fast loop, or the aggregate check; aggregate green; bash files byte-untouched | TC-BRANDING-012, TC-BRANDING-013, TC-BRANDING-022, TC-BRANDING-024, TC-BRANDING-025 | Covered |
| NFR-9 | Zero name reveals or candidate names in any artifact; generic rationale only | TC-BRANDING-019, TC-BRANDING-020, TC-BRANDING-026 | Covered — automated scan of code/new docs plus a manual owner-constraint gate; candidate-name detection is not automatable |

## 4. Test Types and Layers

Three runners, deliberately separated. **`bun test`** owns behaviour and structure assertions (resolver, contract, seam, legacy adapter, telemetry artifact, doc content, mutation drivers). **`bun run scripts/checks/*.ts`** owns repository invariants whose assertion is "this gate must exit non-zero" (forbidden literals, ignore rules, CI topology/bindingness, ambient globals, workspace entrypoints). **Existing bash suites** are run only, never extended, by this change.

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Resolver behaviour tests | `bun test tests/behaviour` | `tests/behaviour/branding-resolver.test.ts` | TC-BRANDING-001, TC-BRANDING-002, TC-BRANDING-003, TC-BRANDING-004, TC-BRANDING-007 |
| Legacy adapter behaviour tests | `bun test tests/behaviour` | `tests/behaviour/legacy-adapter.test.ts` + `tests/fixtures/legacy/warn-probe.ts` | TC-BRANDING-014, TC-BRANDING-015 |
| Structure / contract assertions | `bun test tests/structure` | `tests/structure/branding-contract.test.ts`, `branding-seam.test.ts`, `legacy-confinement.test.ts`, `rename-drill-doc.test.ts` | TC-BRANDING-005, TC-BRANDING-016, TC-BRANDING-017, TC-BRANDING-018, TC-BRANDING-019, TC-BRANDING-020, TC-BRANDING-021 |
| Content-inventory discipline | `bun test tests/structure` | `tests/structure/content-inventory.test.ts` + `inventory.json` (updated) | TC-BRANDING-022 |
| Boundary negative fixtures | `bun test tests/boundaries` | `tests/boundaries/**` + `fixtures/cases.ts` + `fixture-registry.json` | TC-BRANDING-006, TC-BRANDING-023 |
| Scan invariant | `bun run scripts/checks/forbidden-literals.ts` | `scripts/checks/forbidden-literals.ts` + `forbidden-literals.registry.json` | TC-BRANDING-008 |
| Scan mutation tests | `bun test tests/checks` | `tests/checks/forbidden-literals.test.ts` | TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-013, TC-BRANDING-027 |
| Hygiene regression | `bun run scripts/checks/ignore-rules.ts` + `bun test tests/checks` | `tests/checks/ignore-rules.test.ts` | TC-BRANDING-013 |
| CI invariant checks | `bun run scripts/checks/ci-topology.ts`, `ci-bindingness.ts`; `bun test tests/checks` | `tests/checks/ci-checks.test.ts` (updated) | TC-BRANDING-012, TC-BRANDING-024 |
| Aggregate | `pnpm check` | repo root | TC-BRANDING-024 |
| Bash non-regression | `bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh`; CI `bash-tests`, `shellcheck` | unchanged | TC-BRANDING-024 |
| Manual | PR review and owner gate | — | TC-BRANDING-026 (candidate-name review), TC-BRANDING-020 (drill clarity) |

### 4.1 Forbidden-Literal Scan Contract

The registry at `scripts/checks/forbidden-literals.registry.json` is the single source for scope, allowlist, seed set, the fixed docs baseline, and registered docs membership (DM-3). The scan reads it; the mutation tests read the same file so they cannot drift from the implementation.

| Aspect | Binding contract for this change | Source |
|--------|----------------------------------|--------|
| Scope class 1 — package tree | Every tracked file under `packages/**` (source, manifests, package-local tests and fixtures) | Spec Appendix B |
| Scope class 2 — root manifests | `package.json`, `pnpm-lock.yaml` | Spec Appendix B; ADR-0003 root workspace list |
| Scope class 3 — root workspace files | `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.base.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`, `.changeset/config.json`, `bunfig.toml` | ADR-0003 root workspace list |
| Scope class 4 — ignore rules | `.gitignore` (whole file, line-oriented) | Spec Appendix B |
| Scope class 5 — user-facing docs added since the corpus baseline | Docs under the user-facing roots (`doc/**` minus `doc/changes/**` and `doc/decisions/**`) that are **absent at the fixed `corpusBaseline`** commit, whether added in this PR or any earlier merged PR, and that are listed in the reviewed `registered` registry. Membership is conferred permanently at registration and is never re-derived from a moveable comparison ref. Pre-existing corpus docs present at the baseline remain out of claim (A-T2). | Spec Appendix B and scope-of-claim |
| Corpus baseline | The registry records `corpusBaseline: "32784af"` — the last pre-scan commit on `main-tools` (GH-170 merge), written as a full commit SHA, never a branch or ref name. It is fixed: ordinary changes never advance it. The docs-scope meta-check asserts (docs absent at baseline ⊆ `registered`) ∧ (`registered` ⊆ docs present in the tree ∧ absent at baseline), so a registered doc stays in scope forever, a registry entry naming a pre-existing corpus doc or a missing doc fails, and a baseline advanced past a registered doc fails naming that doc. An absent, non-SHA, or unreachable baseline fails closed with a named error. | DM-3, A-T2, TC-BRANDING-008, TC-BRANDING-009, TC-BRANDING-027 |
| Seed literal set | Exactly `ados`, `ADOS_`, `~/.ados`; grows by one literal per frozen name in the freeze change | Spec Appendix B, DEC-8 growth rule |
| Allowlist | Exactly five entries: `packages/core/src/branding/**`; `packages/adapters/src/legacy/**`; `doc/decisions/**`; `doc/changes/**`; required license/source header lines | Spec Appendix B |
| Matching semantics | Case-insensitive token match. A seed token matches when it is delimited from lowercase ASCII letters on both sides: start/end of file, whitespace, punctuation, digit, slash, dot, underscore, hyphen, `~`, `@`, or an uppercase letter. Thus `ados`, `Ados`, `ADOS_`, `~/.ados`, `ados-cli`, `.ados`, `adosRuntime`, and `2ados` match; `avocados`, `mikados`, `paradosis`, and `agentic-delivery-os` do not. The contract is exercised by committed true-positive and false-positive corpora (TC-BRANDING-010). | RSK-2, spec §14 (matching semantics delegated to delivery planning) |
| Failure behavior | Non-zero exit naming the offending file and token for every violation; all violations in one run, not first-only | Spec Appendix B |
| CI binding | One additive `ts-forbidden-literals` job in the existing `ts-*` fast loop; no `continue-on-error`, no OR-true shell fallback, no `set +e`, or advisory construct; `ci-topology` and `ci-bindingness` stay green; the GH-170 aggregate chain remains exactly five steps; the job makes the `corpusBaseline` commit reachable in the checkout | Spec §8.4, AC-F4-3, NFR-4 |
| Subsumption | The `.gitignore`-local token scan in `scripts/checks/ignore-rules.ts` is subsumed by the full-scope scan. The hygiene check keeps its four coverage classes and rename-survival assertions; no existing check is removed or weakened (C-8). | Spec F-4, C-8 |

**Root scope is the ADR-named list, not every root file.** Scope classes 2 and 3 are the ADR-0003 root workspace set: the root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.base.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`, plus the workspace-adjacent `.changeset/config.json` and `bunfig.toml`. Pre-existing corpus files in the repository root and dot-directories (`.claude-plugin/**`, `.opencode/**`, `.ados-claude/**`, `assets/**`, `AGENTS.md`, `README.md`, `CLAUDE.md`) are outside the five classes and are not scanned; they migrate with the corpus. A scan that walks every root file would fail on the pre-existing corpus and is a scope defect, not a stricter check.

**Delivered-state rule:** the live tree is green on the merge commit of this change **and on every successor commit on the delivery branch**. The only seed literals in scope are inside the two allowlisted package subpaths; every doc registered for class 5 is name-free. The registered drill doc does not leave scope when this PR merges: its membership derives from absence at the fixed `corpusBaseline`, not from newness relative to `HEAD` or `origin/main-tools`.

### 4.2 Scope Class to Failure-Fixture to TC Matrix

Every scope class has its own registered true-positive mutation, so a class that stops being scanned is visible to TC-BRANDING-009 rather than masked by the other classes.

| Scope class | True-positive mutation (temp tree) | Allowlist / false-positive control | Expected failure signal | TC |
|-------------|------------------------------------|-----------------------------------|-------------------------|-----|
| `packages/**` | Add a source or manifest line containing `ados` outside the allowlist | Same literal under `packages/core/src/branding/` is clean; same literal under `packages/adapters/src/legacy/` is clean | Non-zero; output names the file and `ados` | 009, 011 |
| Root manifests | Add `ados` to a temp `package.json` field | Clean root manifest passes | Non-zero; names the manifest and token | 009, 011 |
| Root workspace files | Add `ADOS_` to a temp `tsconfig.base.json` or `pnpm-workspace.yaml` | Clean file passes | Non-zero; names the file and `ADOS_` | 009, 011 |
| `.gitignore` | Append a line containing `~/.ados` or `ados` | No seed literal in the live `.gitignore` | Non-zero; names `.gitignore` and the token | 009, 011 |
| User-facing docs (baseline-anchored) | Add a doc under `doc/**` that is absent at the temp `corpusBaseline` commit, register it, and put `ados` in it | A doc present at the baseline is not scanned; an allowlisted `doc/changes/**` doc is not scanned | Non-zero; names the doc and token, or names the unregistered doc | 009, 010, 011, 027 |

**Mutation-test count.** At least five failing mutations (one per scope class), the docs-scope meta-check mutations (unregistered doc absent at baseline), and the baseline-anchoring mutations: an injected literal in a registered doc at a post-merge successor commit still fails; deleting a registry entry fails the meta-check; removing, ref-typing, or advancing `corpusBaseline` past a registered doc fails the registry-shape/meta-check assertion (TC-BRANDING-027). Controls: five allowlist entries clean; true-positive corpus (all seed forms and delimiter variants) matches; false-positive corpus does not match; a doc present at the baseline is out of scope; a missing or unreachable baseline commit fails closed with a named error rather than silently skipping the docs class (A-T2).

### 4.3 Legacy Adapter Warning Harness

The exactly-once rule is process-scoped, so the decisive test runs in a child process. `tests/fixtures/legacy/warn-probe.ts` is a fixture script (not `*.test.ts`) that imports the adapter, injects a synthetic environment record and a warning sink, performs one or two reads, and prints a JSON result with a numeric `warnings` count and a `messages` array. Two probes cover the matrix: a legacy-source probe (expect exactly one warning across two reads and across two different legacy sources) and an absent-source probe (expect zero). A third case seeds `ADOS_TOKEN=synthetic-secret-value` and asserts the warning text does not contain the value. The probe never reads the real process environment; facts are injected, so results are deterministic.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC Coverage |
|-------|-------|------|--------|----------|-------------|
| TC-BRANDING-001 | Resolver returns all twelve DEC-8 values | Happy Path | Critical | High | AC-F1-1, NFR-2, DM-1 |
| TC-BRANDING-002 | Resolver determinism: same input, same output | Happy Path | Critical | High | AC-F1-1, NFR-2 |
| TC-BRANDING-003 | Resolver fails closed on absent or invalid input | Negative | Critical | High | AC-F1-1, DM-2, NFR-2 |
| TC-BRANDING-004 | Derivation rules conform for every derived value | Happy Path | Critical | High | AC-F1-1, NFR-2, DM-1 |
| TC-BRANDING-005 | `BrandIdentity` is defined once in `core ./contracts` with twelve fields | Happy Path | Critical | High | AC-F2-1, NFR-7, DM-1 |
| TC-BRANDING-006 | Branding imports `./contracts` only and reads no ambient environment | Happy Path | Critical | High | AC-F2-1, AC-F3-1, AC-F8-1, NFR-1, NFR-7 |
| TC-BRANDING-007 | Injected environment override swaps the name without rebuild | Happy Path | Critical | High | AC-F3-1, NFR-1, DM-2 |
| TC-BRANDING-008 | Forbidden-literal scan green at delivered state with five of five classes | Happy Path | Critical | High | AC-F4-2, NFR-3, DM-3 |
| TC-BRANDING-009 | Scan fails on a seed literal in each scope class | Negative | Critical | High | AC-F4-1, NFR-3, NFR-4, DM-3 |
| TC-BRANDING-010 | Scan matching distinguishes seed tokens from ordinary words | Negative | Important | High | AC-F4-2, NFR-3, RSK-2 |
| TC-BRANDING-011 | Scan honors exactly the DEC-8 allowlist and nothing more | Negative | Critical | High | AC-F4-2, AC-F5-1, NFR-3 |
| TC-BRANDING-012 | Scan is a binding additive CI job; topology and bindingness stay green | Happy Path | Critical | High | AC-F4-3, NFR-4, NFR-8 |
| TC-BRANDING-013 | `.gitignore` token scan subsumed without weakening the hygiene check | Regression | Critical | High | AC-F4-2, NFR-8, C-8 |
| TC-BRANDING-014 | Legacy adapter maps sources and warns exactly once per process | Happy Path | Critical | High | AC-F5-2, NFR-5 |
| TC-BRANDING-015 | Legacy warning never echoes secret material | Negative | Critical | High | AC-F5-2, NFR-5 |
| TC-BRANDING-016 | Legacy adapter receives current names and never imports branding | Negative | Critical | High | AC-F5-3, AC-F8-1, NFR-7 |
| TC-BRANDING-017 | No new pre-freeze-prefixed variable is introduced | Negative | Critical | High | AC-F5-3, NFR-6 |
| TC-BRANDING-018 | Legacy adapter literal inventory is confined to the legacy set | Negative | Critical | High | AC-F5-1, NFR-3 |
| TC-BRANDING-019 | Telemetry schema name is brand-neutral, producer is metadata, no emission path | Contract | Critical | High | AC-F6-1, EVT-1, EVT-2, NFR-9 |
| TC-BRANDING-020 | Rename drill is complete, self-contained, name-free, and states its obligation | Happy Path | Critical | High | AC-F7-1, NFR-9 |
| TC-BRANDING-021 | No name-derived value is computed outside the resolver and no working-name literal is committed | Negative | Critical | High | AC-F1-2, NFR-2 |
| TC-BRANDING-022 | Content inventory is updated deliberately, not disabled | Regression | Critical | High | AC-F8-1, NFR-7, NFR-8 |
| TC-BRANDING-023 | Boundary suite and fixture-coverage meta-check green; no unenforced new rule | Regression | Critical | High | AC-F8-1, AC-F2-1, NFR-7 |
| TC-BRANDING-024 | Aggregate check and existing bash/CI gates unchanged and green | Regression | Critical | High | AC-F4-3, NFR-8 |
| TC-BRANDING-025 | No new dependencies; frozen lockfile and license audit stay green | Regression | Important | High | NFR-8 |
| TC-BRANDING-026 | Artifact name-freedom: synthetic names only, no candidate names | Manual | Critical | High | NFR-9, G-6 |
| TC-BRANDING-027 | Docs scope is anchored to a fixed corpus baseline and registered membership is permanent | Regression | Critical | High | AC-F4-1, AC-F4-2, NFR-3, DM-3 |

### 5.2 Scenario Details

#### TC-BRANDING-001 - Resolver returns all twelve DEC-8 values

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-2, DM-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/branding-resolver.test.ts`; `packages/core/src/branding/index.ts`
**Tags**: @branding, @resolver, @completeness

**Preconditions**:

- The resolver is implemented in the branding subpath and exports a pure function whose input is the resolver-input contract.
- Synthetic working name `.renamed-product` (from the exercised-name fixture) is available.

**Steps**:

1. Call the resolver with `.renamed-product` and empty injected environment facts.
2. Assert the result contains exactly the twelve DEC-8 fields from Appendix A, with no missing and no extra field: product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, and install path.
3. Assert every value is a non-empty string and that the product name equals the supplied working name.
4. Assert the result is a plain immutable value (frozen or readonly) and does not carry the input object by reference in a way that lets a consumer mutate it.
5. Repeat with a second synthetic name (`.alt-brand`) and assert the same twelve-field shape.

**Expected Outcome**:

- Twelve of twelve values are present for every synthetic input; no field is `undefined`, empty, or a placeholder.
- The product name is the supplied working name, not a committed literal.

#### TC-BRANDING-002 - Resolver determinism: same input, same output

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/branding-resolver.test.ts`
**Tags**: @branding, @resolver, @determinism

**Preconditions**:

- TC-BRANDING-001 passes.

**Steps**:

1. Invoke the resolver twice with a freshly constructed but equal input object; assert the two results are deeply equal.
2. Invoke it across several synthetic names (`.renamed-product`, `.alt-brand`, `.synthetic`, `example-product`) and assert each name produces a distinct, internally consistent value set.
3. Invoke it with the same input before and after an unrelated operation that advances the process clock and mutates a local object; assert the output is unchanged.
4. Assert the resolver does not read ambient state: run the call with `Date.now` and `Math.random` stubbed to throw in the test process and assert no throw occurs.

**Expected Outcome**:

- Same input always yields the same output; no clock, randomness, or ambient state influences derivation.
- Different synthetic names produce distinct derivations, proving the output is not a fixed constant.

#### TC-BRANDING-003 - Resolver fails closed on absent or invalid input

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-2, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/branding-resolver.test.ts`
**Tags**: @branding, @resolver, @fail-closed

**Preconditions**:

- The resolver input type accepts a working name and an injected environment-facts record.

**Steps**:

1. Call the resolver with an absent working name (undefined), an empty string, a whitespace-only string, and a non-string runtime value (via a type-erasing cast).
2. Call it with a working name containing an unsupported character or shape, per the delivery-bound derivation rules (for example a path separator or a control character).
3. Call it with malformed environment facts: a non-record value, an inherited property, and an override that is present but empty or whitespace-only.
4. Assert every case returns the declared resolver-input error shape, not a default name, not a silently derived value, and not a thrown raw `TypeError`.
5. Assert the error is deterministic (same input → same error) and does not echo secret-looking environment values.
6. Assert no default parameter value exists on the resolver signature (source inspection in `tests/structure/branding-seam.test.ts` corroborates).

**Expected Outcome**:

- Absent or invalid working names fail closed with a deterministic resolver-input error; no silent default name is ever produced.
- A valid working name plus empty facts still succeeds (the error is about invalid input, not about requiring an environment).

#### TC-BRANDING-004 - Derivation rules conform for every derived value

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-2, DM-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/branding-resolver.test.ts` + `tests/fixtures/branding/derivation-cases.json`
**Tags**: @branding, @resolver, @derivation

**Preconditions**:

- The delivery documents the deterministic derivation rule for each of the twelve values alongside the resolver.
- `tests/fixtures/branding/derivation-cases.json` holds expected outputs for synthetic names, derived independently from the documentation rather than copied from a single implementation run.

**Steps**:

1. For each synthetic name in the fixture, call the resolver and compare all twelve values against the expected table.
2. Specifically assert the documented rules for binary name, package scope (neutral until the freeze), environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, and install path.
3. Assert the MCP tool prefix derivation is documented and deterministic. The primitive-ID half of the tool-name projection is deferred to the contracts work in M0-S3 and is not asserted here (out of scope).
4. Assert the committed config path projection is a root dot-directory named by branding with `config.yaml` inside it, with the product directory supplied by branding.
5. Assert derivation outputs contain no seed literal from the forbidden set.

**Expected Outcome**:

- Every derived value matches its documented rule for every synthetic name.
- The test fails if a rule is undocumented (missing fixture row) or if the implementation drifts from the documented table.
- No output contains `ados`, `ADOS_`, or `~/.ados`.

#### TC-BRANDING-005 - `BrandIdentity` is defined once in `core ./contracts` with twelve fields

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-7, DM-1
**Test Type(s)**: Unit / Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/branding-contract.test.ts`; `packages/core/src/contracts/index.ts`, `packages/core/src/branding/index.ts`
**Tags**: @contracts, @branding, @single-definition

**Preconditions**:

- The type has been moved from the branding stub to `core ./contracts`.

**Steps**:

1. Parse `packages/core/src/contracts/**` and assert exactly one `type` or `interface` declaration named `BrandIdentity`.
2. Assert it declares exactly the twelve readonly string properties from DM-1, no missing and no extra field.
3. Search all `packages/**/*.ts` for another `BrandIdentity` declaration and assert exactly one declaration exists repository-wide in `packages/**`.
4. Assert `packages/core/src/branding/index.ts` imports `BrandIdentity` from `./contracts` (or the declared `@delivery-os/core/contracts` specifier) using a type-only import, and declares no local `BrandIdentity` type alias or duplicate object type.
5. Mutation (temp copy): remove one field, add an extra field, and duplicate the type in branding; assert each mutation fails the check by name.
6. Run `bun test tests/boundaries` and assert `tier-branding-only-contracts` is green.

**Expected Outcome**:

- Exactly one twelve-field `BrandIdentity` declaration, in `core ./contracts`; branding consumes it as a type.
- Any duplicate, missing field, extra field, or local redefinition fails with the file and field named.

#### TC-BRANDING-006 - Branding imports `./contracts` only and reads no ambient environment

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-8, AC-F2-1, AC-F3-1, AC-F8-1, NFR-1, NFR-7
**Test Type(s)**: Negative fixture / Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/**` (existing `tier-branding-only-contracts`, `ambient-env-branding`), `tests/structure/branding-seam.test.ts`
**Tags**: @boundary, @ambient, @branding

**Preconditions**:

- The existing boundary configuration and ambient guard are unchanged for this rule family.
- The branding subpath is `packages/core/src/branding/**`.

**Steps**:

1. Run `bun run scripts/checks/ambient-globals.ts` and assert zero violations in the live tree.
2. Assert the live branding source contains zero `process.env`, `Bun.env`, `process`, `Bun`, `Deno`, clock, randomness, filesystem, or network global reads; the existing `ambient-env-branding` and `ambient-globals-neutral-tiers` negative fixtures must fire for injected `process.env`/`Bun.env` and the neutral-tier global sweep.
3. Assert the existing `tier-branding-only-contracts` negative fixture fires for a branding import into a forbidden tier (the committed `tier-branding-app` alias and relative cases) and that a control fixture importing `#contracts` stays clean; the same allowed-set rule covers a branding-to-state edge if delivery exercises it.
4. Assert the branding source has no workspace import other than the contracts type import (AST import scan); no `node:*`, `bun:*`, or other workspace package import.
5. Assert that if delivery introduces any **new** forbidden rule for this change, the rule name is present in `.dependency-cruiser.cjs` with `severity: 'error'` and has at least one registered failing fixture (delegated to TC-BRANDING-023 for the meta-check).
6. Mutation (temp copy): inject `process.env.X` and `Bun.env.X` into branding and a `#app` import; assert each fails with the expected rule name.

**Expected Outcome**:

- Branding is runtime-neutral, ambient-free, and imports the contracts type only.
- Every injected violation fires the existing rule; no new rule is required for the legacy adapter's no-branding-import requirement (the existing `subpath-adapters-core-branding` rule covers it, verified in TC-BRANDING-016).
- If a new rule is added, it is unenforced until a fixture exists; the meta-check fails it.

#### TC-BRANDING-007 - Injected environment override swaps the name without rebuild

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-1, DM-2
**Test Type(s)**: Unit / Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/branding-resolver.test.ts` + `tests/fixtures/branding/edge.ts`
**Tags**: @branding, @override, @injected-facts

**Preconditions**:

- `tests/fixtures/branding/edge.ts` is a fixture runtime-aware edge (not a test file) that receives an injected environment-facts record and calls the resolver. It never reads `process.env`/`Bun.env` itself.

**Steps**:

1. With the configured supplied name `example-product` and no override fact, call the edge and assert the resolved product name is `example-product`.
2. With the same configured name and an injected `DELIVERY_OS_WORKING_NAME=.renamed-product` fact, call the edge and assert all twelve values reflect `.renamed-product` and none retains the configured name.
3. Change only the injected fact (no source edit, no build, no install) and repeat; assert the output changes and `git status --porcelain` remains clean.
4. Assert the override variable name is the neutral `DELIVERY_OS_WORKING_NAME` and contains no seed token; assert branding source does not mention the variable at all (the edge owns it).
5. Scan the branding source for ambient environment reads and assert zero (same assertion as TC-BRANDING-006, focused on the override path).
6. Assert an empty or whitespace-only override falls back to the configured supplied name or fails closed per the documented precedence, deterministically; it never produces an empty product name.

**Expected Outcome**:

- The override swaps the full value set without a rebuild or repository change.
- The branding subpath performs no ambient read; the neutral variable is read only at the injected-facts edge.
- Precedence and empty-override behavior are deterministic and documented.

#### TC-BRANDING-008 - Forbidden-literal scan green at delivered state with five of five classes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-3, DM-3
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts`; `scripts/checks/forbidden-literals.registry.json`
**Tags**: @scan, @gate, @delivered-state

**Preconditions**:

- The scan and registry are implemented; the rename-drill doc is added and registered in `registered`.
- The `corpusBaseline` commit (`32784af`) is reachable in the local clone.

**Steps**:

1. Run the scan on the live tree with the `corpusBaseline` commit present: `bun run scripts/checks/forbidden-literals.ts`.
2. Assert exit code 0 and that the output reports all five scope classes as covered, naming the registered docs actually scanned (not a count derived from a diff versus a recent ref).
3. Read the registry and assert it declares exactly five scope classes with non-empty roots; exactly the three seed tokens; exactly the five allowlist entries from Appendix B; and a `corpusBaseline` that is a full commit SHA equal to `32784af` (never a branch, tag, or `HEAD`-relative expression). The root-workspace class must name the ADR-required files (`pnpm-workspace.yaml`, `tsconfig.base.json`, the solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`) and the root-manifest class must name `package.json` and `pnpm-lock.yaml`; a narrower list fails the assertion.
4. Assert the docs-scope meta-check reports every doc under the user-facing roots that is absent at `corpusBaseline` as either registered or excluded by the explicit `doc/changes/**`/`doc/decisions/**` allowlist. The registry must name at least the rename-drill document.
5. Assert the registry shape is baseline-anchored and stable: `registered` is an explicit list; there is no derived "added versus base/HEAD" membership mode; every entry names a doc present in the tree and absent at `corpusBaseline`; the drill doc is accepted even though it is no longer "new" relative to the latest commit.
6. Assert the scan does not report a violation for the allowlisted branding subpath, legacy adapter subpath, decision records, historical change artifacts, or license/source header lines.
7. Assert the scan reads repository content and local git history only: no network call, no environment-derived path, and no write to the tree (`git status --porcelain` clean after the run).

**Expected Outcome**:

- The delivered tree is green with five of five classes covered, a fixed baseline, and exactly the DEC-8 allowlist honored.
- The registry is complete, baseline-anchored, and contains no extra allowlist entry and no base-relative membership rule.
- A clean working tree after the run proves the scan is read-only.

#### TC-BRANDING-009 - Scan fails on a seed literal in each scope class

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-3, NFR-4, DM-3
**Test Type(s)**: Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts`; temp trees only
**Tags**: @scan, @mutation, @negative

**Preconditions**:

- TC-BRANDING-008 passes on the live tree.
- The test materialises a temp tree from the committed scope inputs (or a minimal tree with the registry), never writing to the live workspace.

**Steps**:

1. **Package class:** add a file under `packages/core/src/domain/` containing `ados`; run the scan; assert non-zero and that the output names the file and the token.
2. **Root manifest class:** add `"ados"` to a temp `package.json` field; assert non-zero naming the manifest and token.
3. **Root workspace class:** add `ADOS_` to a temp `tsconfig.base.json`; assert non-zero naming the file and token.
4. **Ignore class:** append a line containing `~/.ados` to a temp `.gitignore`; assert non-zero naming `.gitignore` and the token.
5. **User-facing docs class:** create a temp git repository with a `corpusBaseline` commit, add a doc under `doc/guides/` that is absent at that baseline, register it, and put `ados` in it; assert non-zero naming the doc and token.
6. **Docs-scope meta-check:** add a doc absent at the temp baseline but omit it from `registered`; assert the meta-check fails naming the unregistered doc, even if the doc is otherwise clean.
7. Repeat each case with the other seed forms (`ADOS_`, `~/.ados`) at least once, asserting all three tokens are detected.
8. Assert every failing run reports all violations in the same run, not only the first.
9. Run the docs-scope meta-check in a shallow clone or with the `corpusBaseline` commit unavailable and assert it fails closed with a named missing-baseline error rather than silently skipping the docs class.

**Expected Outcome**:

- Five failing scope-class mutations plus the docs-scope mutation, each exiting non-zero with the file and token (or the unregistered doc) named.
- A missing or unreachable baseline commit fails closed with a named error; the docs class is never silently skipped.
- No mutation passes; the failure path is proven for every class.

#### TC-BRANDING-010 - Scan matching distinguishes seed tokens from ordinary words

**Scenario Type**: Negative / Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-3, RSK-2
**Test Type(s)**: Unit / Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts` + `tests/fixtures/forbidden-literals/{true,false}-positives.json`
**Tags**: @scan, @matching, @false-positive

**Preconditions**:

- The matching contract in §4.1 is implemented and exported for direct testing.

**Steps**:

1. True-positive corpus: assert every entry matches — `ados`, `ADOS`, `Ados`, `ADOS_`, `~/.ados`, `ados-cli`, `ados_cli`, `x/ados/y`, `.ados`, `adosRuntime`, `my-ados`, `2ados`, `@ados/pkg`.
2. False-positive corpus: assert every entry does not match — `avocados`, `mikados`, `paradosis`, `agentic-delivery-os`, `shadow`, `colorados` (lowercase prefix, documented reserved case).
3. Case-insensitivity: assert `ADOS_HOME` and `ados_home` both match, and that the reported token is the literal from the seed set.
4. Register a deliberately wrong fixture (a false positive added to the true-positive corpus in a temp copy) and assert the corpus test fails, proving the corpus is not vacuous.
5. Document the reserved-case limitation (a lowercase identifier embedding such as `myados` is not matched unless it is delimited) as a residual risk in §8.1.

**Expected Outcome**:

- All seed forms and delimiter variants are detected; ordinary words containing the letters do not trip the scan.
- The matching contract is exercised by a committed corpus and cannot silently drift.

#### TC-BRANDING-011 - Scan honors exactly the DEC-8 allowlist and nothing more

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-2, AC-F5-1, NFR-3
**Test Type(s)**: Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts`
**Tags**: @scan, @allowlist, @negative

**Preconditions**:

- The registry declares the five allowlist entries from Appendix B.

**Steps**:

1. Place a seed literal in each allowlisted location in a temp tree and assert the scan is clean: `packages/core/src/branding/**`, `packages/adapters/src/legacy/**`, `doc/decisions/**`, `doc/changes/**`, and a required license/source header line.
2. Place a seed literal in a non-allowlisted file in the same temp tree and assert the scan fails, proving an allowlisted file does not mask a violation elsewhere.
3. Add a sixth allowlist entry to a temp registry; assert the registry-shape test fails ("allowlist must be exactly the DEC-8 set").
4. Remove one allowlist entry from a temp registry; assert the corresponding control now fails, proving the control is load-bearing.
5. Add an orphan seed token or a sixth scope class in a temp registry; assert the registry-shape test fails.

**Expected Outcome**:

- Five allowlist controls are clean; a violation outside them still fails.
- The allowlist is exactly the DEC-8 set; any growth or shrinkage fails review-visible tests.
- The legacy adapter's allowlist entry is proven load-bearing (AC-F5-1).

#### TC-BRANDING-012 - Scan is a binding additive CI job; topology and bindingness stay green

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, NFR-4, NFR-8
**Test Type(s)**: CI job check
**Automation Level**: Automated
**Target Layer / Location**: `.github/workflows/ci.yml`; `scripts/checks/ci-topology.ts`; `scripts/checks/ci-bindingness.ts`; `tests/checks/ci-checks.test.ts`
**Tags**: @ci, @binding, @topology

**Preconditions**:

- The `ts-forbidden-literals` job is added and runs the scan with the `corpusBaseline` commit reachable (`fetch-depth: 0` or an explicit fetch of the baseline commit).
- `TS_JOBS` in `scripts/checks/ci-topology.ts` is updated with the new job id.

**Steps**:

1. Assert `ci.yml` declares `ts-forbidden-literals` on `pull_request` targeting `main-tools` and on pushes to the delivery branch.
2. Assert the job invokes `bun run scripts/checks/forbidden-literals.ts` (the docs-scope meta-check resolves `corpusBaseline` from the registry) and makes the baseline commit reachable; assert no `continue-on-error`, `|| true`, `set +e`, or `if: always()` on the gate step.
3. Run `bun run scripts/checks/ci-topology.ts` and assert exit 0: all bash jobs present, all `ts-*` jobs including the new one present, triggers correct, additions only.
4. Run `bun run scripts/checks/ci-bindingness.ts` and assert exit 0.
5. Mutation (temp copy): add `continue-on-error: true` to `ts-forbidden-literals`; assert `ci-bindingness` fails naming the job and line. Remove the job from `ci.yml`; assert `ci-topology` fails naming it. Remove the baseline-availability step; assert the new job assertion fails naming the missing baseline fetch.
6. Assert the GH-170 aggregate `check` chain remains exactly five steps; the scan joins as a named CI job, not by mutating the aggregate chain (TC-BRANDING-024 corroborates).

**Expected Outcome**:

- The scan is a binding additive job; topology and bindingness are green on the live tree and fail on the mutations.
- No existing job is removed, weakened, or made advisory.
- The aggregate chain is unchanged.

#### TC-BRANDING-013 - `.gitignore` token scan subsumed without weakening the hygiene check

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-8, C-8
**Test Type(s)**: Regression / Mutation
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ignore-rules.ts`; `tests/checks/ignore-rules.test.ts`
**Tags**: @hygiene, @subsumption, @regression

**Preconditions**:

- The full-scope scan exists and covers `.gitignore`.

**Steps**:

1. Run `bun run scripts/checks/ignore-rules.ts` on the live tree and assert exit 0: four coverage classes, brand-free config glob, rename survival, real `git check-ignore` probes.
2. Assert the hygiene check still fails when a required coverage pattern is removed in a temp tree (node_modules, dist, local state, project-local config) — the existing behavior is not deleted along with the token list.
3. Assert a seed literal appended to `.gitignore` is caught by the full-scope scan (TC-BRANDING-009 class 4), regardless of whether `ignore-rules.ts` still performs its own token scan.
4. Assert the change diff does not remove or weaken any existing assertion in `ignore-rules.ts`; if the local token loop is removed, the same failure is proven by the full scan and the four coverage classes plus rename-survival tests remain.
5. Run the relevant existing bash test suites and the CI `ts-invariants`/`bash-tests` jobs; assert no regression.

**Expected Outcome**:

- The hygiene gate keeps its coverage-class, brand-free-glob, and rename-survival guarantees; the token scan is subsumed, not dropped without replacement.
- A `.gitignore` seed literal still fails CI through the full-scope scan.
- No existing gate is weakened (C-8).

#### TC-BRANDING-014 - Legacy adapter maps sources and warns exactly once per process

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/legacy-adapter.test.ts` + `tests/fixtures/legacy/warn-probe.ts`; `packages/adapters/src/legacy/index.ts`
**Tags**: @legacy, @warning, @process-scoped

**Preconditions**:

- The adapter exposes a testable mapping entry point that accepts an injected environment-facts record and a warning sink; a thin I/O wrapper may supply the real process environment in production.
- The warning sink is injectable for unit-level assertions and `console.warn` is the production sink.

**Steps**:

1. In-process, using a fresh adapter instance from the factory (its own warning state): call it with a legacy-prefixed variable and the legacy config directory present, current names `{ environmentPrefix: "SYNTH_", configDirectoryName: ".synthetic" }`, and a warning sink; assert the mapping uses the supplied current names, not literals.
2. Call that instance twice; assert the sink received exactly one warning.
3. Call it with two different legacy sources present (an environment variable and the config directory); assert still exactly one warning for the instance.
4. Child-process probe for the default process-scoped instance: spawn `tests/fixtures/legacy/warn-probe.ts` with a controlled child environment containing a synthetic legacy-prefixed variable and a temporary home directory containing the legacy config directory; read both sources twice; assert the JSON reports exactly one warning. Run the absent-source probe with a clean child environment; assert zero warnings.
5. Assert no warning when neither legacy source is present, including when an unrelated environment variable is present.
6. Assert the mapping result is deterministic and does not depend on warning state.

**Expected Outcome**:

- Legacy sources map to the current names supplied as parameters.
- Exactly one warning per process when any legacy source is read; zero when none is read; two sources do not produce two warnings.
- No ambient environment read is required to test the adapter.

#### TC-BRANDING-015 - Legacy warning never echoes secret material

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-5
**Test Type(s)**: Negative / Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/legacy-adapter.test.ts`
**Tags**: @legacy, @secrets, @warning

**Preconditions**:

- The warning sink captures the full warning text.

**Steps**:

1. Seed a synthetic secret value in a legacy-prefixed variable (`ADOS_TOKEN=synthetic-secret-value`) alongside a legacy config directory.
2. Call a fresh adapter instance from the factory and capture the warning text.
3. Assert the warning does not contain `synthetic-secret-value`, the full environment record, or any value from the injected environment facts; it may name only the legacy source (variable name or directory) and the mapped current name.
4. Repeat with a secret-looking value in a second variable and with a config path containing a user-like segment; assert neither value is echoed.
5. Assert the warning is emitted to the warning sink only, not to an unrelated stream, and that no stack trace or raw object dump is produced.

**Expected Outcome**:

- The warning is actionable (names the legacy source) but never leaks secret or environment values.
- NFR-5's "warning output must not include secret material" is proven by a negative assertion on the rendered text.

#### TC-BRANDING-016 - Legacy adapter receives current names and never imports branding

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-8, AC-F5-3, AC-F8-1, NFR-7
**Test Type(s)**: Negative fixture / Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/legacy-confinement.test.ts`; existing `tests/boundaries/**` (`subpath-adapters-core-branding`)
**Tags**: @legacy, @boundary, @no-branding-import

**Preconditions**:

- The legacy adapter is implemented in `packages/adapters/src/legacy/**`.

**Steps**:

1. AST-scan the legacy adapter source and assert zero imports of `@delivery-os/core/branding`, `./core/branding`, or any relative path resolving into branding.
2. Assert the adapter's public behavior receives current names as parameters: call it with two different current-name sets and assert the mapped output changes accordingly, with no code edit.
3. Run `bun test tests/boundaries` and assert the existing `subpath-adapters-core-branding` negative fixture fires for an adapters import of branding; this rule covers the legacy subpath.
4. Mutation (temp copy): add a branding import to the legacy adapter and assert the boundary suite (and the structural import scan) fails.
5. If delivery introduces a new rule to enforce this edge, assert it is registered with a failing fixture; otherwise assert the existing rule is the sole enforcer and is green.

**Expected Outcome**:

- The legacy adapter never imports branding; current names arrive as parameters.
- The existing cross-package rule is proven to cover the adapter; a new rule, if any, is fixture-backed.

#### TC-BRANDING-017 - No new pre-freeze-prefixed variable is introduced

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-6
**Test Type(s)**: Structural scan
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/legacy-confinement.test.ts`
**Tags**: @legacy, @hygiene, @no-new-variables

**Preconditions**:

- The legacy token set is `ados`, `ADOS_`, `~/.ados`; the legacy adapter is the only permitted package location.

**Steps**:

1. Scan `packages/**`, root manifests, root workspace files, `.github/workflows/**`, `.gitignore`, and registered new docs for any `ADOS_`-prefixed literal outside `packages/adapters/src/legacy/**`; assert zero.
2. Scan for environment reads of legacy-prefixed names (`process.env.ADOS_*`, `Bun.env.ADOS_*`) outside the legacy adapter; assert zero.
3. Assert the diff versus base introduces no new environment-variable name matching the legacy prefix anywhere outside the permitted legacy/scan-seed locations: `packages/adapters/src/legacy/**`, `tests/**` fixtures, `doc/changes/**`, and `doc/decisions/**`.
4. Assert the override variable `DELIVERY_OS_WORKING_NAME` is not legacy-prefixed and appears only at the injected-facts edge/tests, not in branding source.
5. Mutation (temp copy): add `process.env.ADOS_NEW` to a surface package; assert the structural scan (and the full-scope scan where applicable) fails naming the file and variable.

**Expected Outcome**:

- Zero new pre-freeze-prefixed variables; legacy names are confined to the legacy adapter's mapping purpose.
- The neutral override is the only new environment variable and is not legacy-prefixed.

#### TC-BRANDING-018 - Legacy adapter literal inventory is confined to the legacy set

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3
**Test Type(s)**: Structural scan
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/legacy-confinement.test.ts` + `tests/fixtures/legacy/literal-inventory.json`
**Tags**: @legacy, @literal-inventory, @scan-allowlist

**Preconditions**:

- The reviewed literal inventory lists every string literal deliberately used by the legacy adapter: the legacy tokens, legacy variable-name prefixes, path fragments, and diagnostic/message strings that are name-free.

**Steps**:

1. Parse the legacy adapter source and enumerate every string literal (including template literal quasis).
2. Assert every literal is either in the reviewed inventory or is a structural value explicitly marked as allowed (for example an empty string or a separator).
3. Assert the adapter's literals contain no seed token beyond the legacy set and no candidate/public-name-like string; any literal not in the inventory fails with the literal and line named.
4. Mutation (temp copy): add a synthetic non-legacy literal (`candidate-brand`) to the adapter; assert the inventory test fails even though the full-scope scan allowlists the subpath.
5. Assert the delivered scan is green under the adapter's allowlist entry (TC-BRANDING-008) and that the inventory and the scan are consistent.

**Expected Outcome**:

- The adapter contains no token beyond the reviewed legacy set used for mapping.
- A new literal requires an explicit inventory update in the same reviewed change; the allowlist cannot hide it.
- AC-F5-1 is proven by both the scan-green run and the inventory assertion.

#### TC-BRANDING-019 - Telemetry schema name is brand-neutral, producer is metadata, no emission path

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, EVT-1, EVT-2, NFR-9
**Test Type(s)**: Unit / Structure
**Automation Level**: Automated plus manual documentation review
**Target Layer / Location**: `tests/structure/branding-contract.test.ts`; `packages/core/src/contracts/index.ts`
**Tags**: @telemetry, @schema, @brand-neutral

**Preconditions**:

- The contracts subpath stays runtime-neutral and types-only, or the delivery records an explicit reviewed exception for a runtime constant.
- The resolver exposes `telemetryNamespace` as producer metadata in `BrandIdentity`.

**Steps**:

1. Assert the declared contract artifact reserves the exact schema name `delivery.event.v1` (type-level literal or an explicit reviewed runtime constant) and that the informational sibling `delivery.metric.v1` is reserved by the same rule.
2. Assert the schema name contains no seed token, no working-name value, no producer/telemetry namespace, and no interpolation or template placeholder.
3. Assert `BrandIdentity` carries `telemetryNamespace` separately, and no schema type or name embeds it; the producer name is metadata, not part of the schema name.
4. Assert the contracts comment documents the producer-as-metadata rule (manual review confirms the wording; the automated assertion checks the presence of the producer-metadata statement).
5. Assert no emission path exists: no telemetry SDK dependency in any manifest, no `emit`/`track`/`capture` call, no event dispatch, and no new network or file sink in the change.
6. Mutation (temp copy): change the schema name to include a synthetic brand value; assert the neutrality test fails. Add a fake emitter import; assert the no-emission assertion fails.
7. Manual: review the contract artifact and the first branding feature spec inputs to confirm the producer rule is stated for downstream emitters.

**Expected Outcome**:

- `delivery.event.v1` is reserved and brand-neutral; `delivery.metric.v1` is reserved informationally.
- The producer name is branding metadata, not schema; no emission path exists.
- A brand-coupled schema name or an emitter fails the tests.

#### TC-BRANDING-020 - Rename drill is complete, self-contained, name-free, and states its obligation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-9
**Test Type(s)**: Content check plus manual review
**Automation Level**: Automated plus manual
**Target Layer / Location**: `tests/structure/rename-drill-doc.test.ts`; the new user-facing drill document (delivery-bound path, proposed `doc/guides/rename-drill.md`)
**Tags**: @rename-drill, @doc, @content

**Preconditions**:

- The drill document is added and registered in the scan's baseline-anchored docs scope.
- The document uses stable checklist anchors (for example `RD-1` through `RD-11`) so the content test is not wording-brittle.

**Steps**:

1. Assert the document exists at the delivery-bound path and is registered in the scan's baseline-anchored docs scope.
2. Assert the document declares a valid `ados_distribution` marker — the delivery plan binds `internal` for `doc/guides/rename-drill.md`; the assertion target is a valid enum value, so an owner-approved one-word flip to `redistributable` at PR review still passes — and that `bash scripts/.tests/test-doc-distribution.sh` passes.
3. Assert it is self-contained: it defines its procedure without linking into `doc/changes/**`, `.ai/local/**`, or any private artifact; it names gates and commands directly.
4. Assert it is name-free: no seed literal and no product/candidate name; it references "the CLI", "the runtime", and "the product directory" generically.
5. Assert the full battery is present: temporary-copy replacement of branding values and the legacy mapping; typecheck; unit and integration tests; boundary tests; the forbidden-literal test; binary build; package publish dry-run; MCP tool-list snapshot; OpenCode tool-list snapshot.
6. Assert the rename-survival assertions are present: the root `.gitignore` still matches the renamed project-local config path, and every root workspace file is name-free or derived from branding.
7. Assert the execution obligation is stated explicitly: the drill must pass before release and whenever branding changes.
8. Mutation (temp copy): remove one battery row and remove the obligation sentence; assert the content test fails naming the missing row/obligation.
9. Manual: review clarity, command accuracy, and self-containment; record the review in the change.

**Expected Outcome**:

- The drill covers the complete DEC-8 battery, the config-glob and root-workspace assertions, and the execution obligation.
- The document is self-contained and name-free, and it passes the scan as a baseline-anchored registered user-facing doc.
- Missing a battery row or the obligation fails the automated check.

#### TC-BRANDING-021 - No name-derived value is computed outside the resolver and no working-name literal is committed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-2, DEC-1
**Test Type(s)**: Structure / Mutation
**Automation Level**: Automated plus manual review
**Target Layer / Location**: `tests/structure/branding-seam.test.ts`
**Tags**: @branding, @seam-integrity, @no-hardcode

**Preconditions**:

- The resolver and `BrandIdentity` contract are implemented.
- No production consumers exist yet; the assertion is enforceable over the current tree and will need extension when M0-S4 adds them.

**Steps**:

1. Assert the branding resolver has no default value for its working-name parameter and no module-level string constant exported or returned as `productName`; inspect its signature and AST.
2. Assert no `BrandIdentity` object literal (an object literal carrying the twelve field names) is constructed anywhere in `packages/**` outside `packages/core/src/branding/**` (tests excluded by path).
3. Assert no identifier or property named after a DEC-8 field (using the delivery-bound property names: product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, install path) is assigned a string literal outside branding/contracts; consumers must receive values as parameters.
4. Assert the branding source contains no literal equal to any of the synthetic names in the fixture registry, and no string literal that could serve as a default product name.
5. Mutation (temp copy): add `export const PRODUCT_NAME = "example-product"` to `packages/cli/src/index.ts`; add a twelve-field object literal in `packages/core/src/domain/index.ts`; assert each mutation fails.
6. Run the full-scope scan (TC-BRANDING-008) to assert no seed literal is committed anywhere outside the allowlist, including branding.
7. Manual: owner review confirms no candidate or public name appears as a working-name literal (candidate-name detection is not automatable; see TC-BRANDING-026).

**Expected Outcome**:

- The resolver is the only construction site for name-derived values; no committed working-name literal or default exists.
- The seam check fails on an out-of-place hardcode or a duplicate derivation site.
- The automated seed scan plus the owner review covers AC-F1-2's two halves.

#### TC-BRANDING-022 - Content inventory is updated deliberately, not disabled

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-7, NFR-8
**Test Type(s)**: Structure / Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`; `tests/structure/inventory.json`
**Tags**: @inventory, @empty-but-enforced, @regression

**Preconditions**:

- The GH-170 content inventory and its AST policy exist and are green before the change.

**Steps**:

1. Assert the actual TypeScript source file set equals the committed inventory for all six packages; update the inventory only for files actually added.
2. Assert the executable-content policy now allows exactly the new modules and exports: the branding resolver in `packages/core/src/branding/**` and the legacy adapter in `packages/adapters/src/legacy/**` (plus any explicitly declared type-only contract artifact). Every other inventoried file remains types-only or `createRuntime`-only.
3. Assert the policy is per-file, not a global "allow all executable content" switch; a new executable export in a non-declared file fails.
4. Mutation (temp copy): add an executable function to `packages/core/src/domain/index.ts`; add a second executable export to branding; assert each fails with the file and statement named.
5. Assert the GH-170 "no engine/driver/command registration" checks still run and remain green: no SQLite driver, provider SDK, `.mcpb` entry, CLI command registration, or MCP command registration.
6. Assert the inventory test was not deleted or skipped; the `ts-test` job and `pnpm test` still collect it.

**Expected Outcome**:

- The GH-170 empty-but-enforced gate is deliberately extended for the two new executable modules, not removed.
- Undeclared executable content still fails; no scope creep hides in the inventory update.
- No engine/driver/command marker appears.

#### TC-BRANDING-023 - Boundary suite and fixture-coverage meta-check green; no unenforced new rule

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, AC-F2-1, NFR-7
**Test Type(s)**: Negative fixture / Meta-check
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/**`; `tests/boundaries/fixture-coverage.test.ts`; `.dependency-cruiser.cjs`; `scripts/checks/ambient-globals.ts`
**Tags**: @boundary, @meta-check, @fixture-coverage

**Preconditions**:

- The existing boundary suite and fixture registry are green on the base branch.

**Steps**:

1. Run `bun test tests/boundaries` and assert every existing negative fixture and ambient case still fires; every clean control stays clean.
2. Run the fixture-coverage meta-check and assert every configured forbidden rule has at least one registered failing case at `severity: 'error'`, every registry key exists, and mandatory rules remain registered.
3. Diff the rule set against the base; for every **new** forbidden rule introduced by this change, assert a registered failing fixture exists in the same change. If no new rule is introduced, assert the existing `tier-branding-only-contracts` and `subpath-adapters-core-branding` rules are the enforcers and remain green.
4. Mutation (temp copy): add a new forbidden rule without a fixture; assert the meta-check fails naming the rule. Delete a fixture for the legacy no-branding-import rule family; assert the meta-check fails.
5. Assert the ambient guard scope and rules are unchanged for the neutral set; branding remains inside `ambient-env-branding`.

**Expected Outcome**:

- Every existing fixture still fires; every control stays clean.
- Any new rule is fixture-backed; a rule without a fixture fails the check.
- The branding and legacy edges are enforced by the existing rules or by a new, registered rule.

#### TC-BRANDING-024 - Aggregate check and existing bash/CI gates unchanged and green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, NFR-8
**Test Type(s)**: Regression / E2E
**Automation Level**: Automated
**Target Layer / Location**: repo root; `.github/workflows/ci.yml`; existing bash suites
**Tags**: @regression, @aggregate, @bash

**Preconditions**:

- Dependencies installed from the frozen lockfile; build artefacts available if the suite requires them.

**Steps**:

1. Run `pnpm check` from the repository root; assert lint, format check, typecheck, `bun test`, and boundaries all execute and pass, with no bypass flags.
2. Assert the aggregate chain still has exactly five steps and no alternate aggregate name was added (`scripts/checks/script-surface.ts` green); the scan is not inserted by rewriting the GH-170 chain.
3. Run `bun test tests/structure tests/behaviour` and `bun test tests/boundaries` explicitly; assert the new suites are collected and green.
4. Run the existing bash suites (`bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh`) or the `bash-tests` CI job; assert they pass unchanged.
5. Assert `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude` contains no existing bash/tool/agent file change (new `scripts/checks/*.ts` files are permitted and excluded from this assertion).
6. Assert `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `shellcheck`, `doc-distribution-guard`, `inception-doc-consistency`, and the other existing jobs pass on the change PR; record the observed run. In particular, run `bash scripts/.tests/test-doc-distribution.sh` or observe the `doc-distribution-guard` job for the new drill doc.
7. Assert `git status --porcelain` is clean after the suite (no test mutates the live tree).

**Expected Outcome**:

- The aggregate check is green with its original five steps.
- Existing bash suites and jobs are byte-untouched and green.
- The new suites run in the existing `ts-test`/boundary jobs.
- No live-tree mutation remains after the run.

#### TC-BRANDING-025 - No new dependencies; frozen lockfile and license audit stay green

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, spec §12, §21
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `pnpm-lock.yaml`; `scripts/checks/license-audit.ts`; `scripts/checks/vulnerability-gate.ts`
**Tags**: @dependencies, @license, @security

**Preconditions**:

- The change is expected to add no runtime or dev dependency.

**Steps**:

1. Assert `pnpm install --frozen-lockfile` succeeds and the lockfile is unchanged versus base.
2. Assert no package manifest gains a dependency, devDependency, peerDependency, or optionalDependency (diff assertion); if delivery introduces one, the license-registry gate must be updated in the same change and the fail-closed audit must pass.
3. Run `bun run scripts/checks/license-audit.ts` and `bun run scripts/checks/vulnerability-gate.ts`; assert both green with no unknown or non-allowlisted license.
4. Assert no telemetry SDK, network client, or new runtime import was added to support the seam.

**Expected Outcome**:

- Zero new dependencies; the frozen lockfile and license audit remain green.
- If a dependency is introduced against the spec assumption, it is registered and audited, not silently accepted.

#### TC-BRANDING-026 - Artifact name-freedom: synthetic names only, no candidate names

**Scenario Type**: Manual
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, G-6, RSK-4
**Test Type(s)**: Manual
**Automation Level**: Manual with automated supporting scans
**Target Layer / Location**: change spec, test plan, implementation plan, code comments, commit messages, PR description, new docs
**Tags**: @manual, @owner-constraint, @name-freedom

**Preconditions**:

- TC-BRANDING-008 (code and new-doc scan) and TC-BRANDING-010 (matching corpus) pass.

**Steps**:

1. Review every artifact of the change for a public product name, a candidate name, a branded package scope, or a branded URL that is not part of the legacy/scan-seed framing.
2. Assert test fixtures use only synthetic names from the committed registry (`.renamed-product`, `.alt-brand`, `.synthetic`, `example-product`) and that the registry contains no candidate name.
3. Assert the legacy tokens appear only as legacy/scan-seed values in their DEC-8 framing: the legacy adapter mapping, the scan seed set, and negative scan fixtures.
4. Assert the new drill document and the new user-facing doc text use generic terms ("the CLI", "the runtime", "the product directory") and reveal no name.
5. Record the review verdict in the change; a candidate-name concern is a blocker, not a note.
6. Confirm the owner PR review is the human gate for this criterion.

**Expected Outcome**:

- No public or candidate name appears in any artifact; synthetic names are used only for verification.
- The automated scan proves code/new-doc token-freedom; the owner review covers what a scan cannot know.
- A leak is a blocking defect.

#### TC-BRANDING-027 - Docs scope is anchored to a fixed corpus baseline and registered membership is permanent

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-2, NFR-3, DM-3
**Test Type(s)**: Mutation / Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts`; temp git repositories only
**Tags**: @scan, @scope-lifetime, @baseline-anchor, @mutation

**Preconditions**:

- The scan reads `corpusBaseline` and `registered` from the registry (§4.1).
- The test builds a temp git repository modelling the full document lifetime; it never writes to the live workspace.

**Steps**:

1. Build a temp repository: commit `B` contains a pre-existing doc under the user-facing roots but no drill doc and is recorded as `corpusBaseline`; commit `D` adds the drill doc and registers it; commit `M` represents the merge onto the integration branch; commit `S` is a successor change that touches nothing under `doc/`.
2. At `M` and again at `S`, run the scan and assert exit 0, and that the output lists the registered drill doc as inside the class-5 scope (scanned, not skipped). Assert membership is not recomputed from "docs added versus the current base/HEAD".
3. Assert the registry shape confers permanent membership: an explicit `corpusBaseline` commit SHA plus an explicit `registered` list, with no code path that derives class-5 membership from a moveable comparison ref.
4. **Post-merge literal injection:** at `S`, inject `ados` into the registered drill doc without adding any new doc or touching any other file; assert the scan exits non-zero naming the doc and the token. The doc must not have left scope merely because the change that introduced it has merged.
5. **Scope-decay mutation A (entry removal):** at `S`, delete the drill doc's `registered` entry; assert the docs-scope meta-check fails naming the doc as unregistered (present in the tree, absent at the baseline, not registered).
6. **Scope-decay mutation B (un-anchoring):** at `S`, (i) remove `corpusBaseline` from a temp registry, and (ii) replace it with a moveable ref (the temp repo's `main` branch, then `HEAD`); assert each fails the registry-shape assertion naming the baseline field and that neither run silently skips class 5.
7. **Scope-decay mutation C (baseline advance):** at `S`, advance `corpusBaseline` to a commit at or after `D`; assert the docs-scope meta-check fails naming the registered drill doc as "present at baseline" — the baseline cannot silently swallow a registered doc.
8. **Fail-closed:** clone the temp repository shallowly so the `corpusBaseline` commit is unreachable and run the scan; assert non-zero exit with a named missing-baseline error and no class-5 skip.
9. Assert the live workspace is untouched by these runs (`git status --porcelain` clean).

**Expected Outcome**:

- A registered doc is scanned permanently, not only while it is "new" relative to a recent ref; a seed literal added to it in any later change fails CI.
- Removing a registry entry, un-anchoring the baseline, or advancing the baseline past a registered doc fails the check by name; the scope cannot decay silently.
- An unreachable baseline commit fails closed with a named error.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; git with the `corpusBaseline` commit (`32784af`) reachable in the clone; network for install only | The scan's docs-scope meta-check resolves the fixed baseline commit from the registry; the static scan and all `bun test` suites run offline after install |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; Bun/pnpm from pinned sources; `fetch-depth: 0` or an explicit fetch making the `corpusBaseline` commit reachable | Authoritative for TC-BRANDING-012, TC-BRANDING-024, TC-BRANDING-025, TC-BRANDING-027 and all PR gates |
| Temp fixture trees | `mkdtemp` under the OS temp dir; no network; no writes to the live tree | TC-BRANDING-009, TC-BRANDING-010, TC-BRANDING-011, TC-BRANDING-013, TC-BRANDING-018, TC-BRANDING-021, TC-BRANDING-022, TC-BRANDING-023, TC-BRANDING-027 |
| Child-process probes | Bun runtime; no network; injected environment records only | TC-BRANDING-014, TC-BRANDING-015 |

### 6.2 Test Data

| Data | Source | Lifecycle |
|------|--------|-----------|
| Synthetic working names | `tests/fixtures/branding/names.json` — `.renamed-product`, `.alt-brand`, `.synthetic`, `example-product`; never a candidate name | Read-only |
| Derivation expectation table | `tests/fixtures/branding/derivation-cases.json`, derived from the documented rules | Read-only; reviewed when rules change |
| Legacy seed tokens | `ados`, `ADOS_`, `~/.ados` used only in the legacy adapter mapping and scan-seed/-negative fixtures | Read-only; never a live product token |
| Legacy literal inventory | `tests/fixtures/legacy/literal-inventory.json` | Reviewed; new literals require an update |
| Scan true/false-positive corpora | `tests/fixtures/forbidden-literals/{true,false}-positives.json` | Read-only |
| Scan registry | `scripts/checks/forbidden-literals.registry.json` — scope classes, seed set, allowlist, fixed `corpusBaseline` (`32784af`), `registered` docs list | Read-only; allowlist/scope/baseline/registry edits require review |
| Temp git repositories | Generated per run in `mkdtemp` with synthetic commits `B`/`D`/`M`/`S` modelling the docs lifecycle | Deleted at test end; never in-tree (TC-BRANDING-027) |
| Warning probe fixtures | `tests/fixtures/legacy/warn-probe.ts`; synthetic secret `synthetic-secret-value` | Read-only; generated JSON is discarded |
| Mutated temp trees | Generated per run in `mkdtemp` | Deleted at test end; never in-tree |
| CI workflow temp copies | `.github/workflows/ci.yml` copied before mutation | Read-only source; temp copy mutated |

### 6.3 Isolation Strategy

- Every mutation-style test copies the minimal inputs into a temp directory; nothing under version control is written during a test run (`git status --porcelain` must be clean after the full suite — asserted in TC-BRANDING-024).
- The scan is read-only over repository content; the docs-scope meta-check resolves the fixed `corpusBaseline` commit in local git history but writes nothing. The docs-lifecycle tests (TC-BRANDING-027) run against a temp git repository so no ref or history in the live clone is created, moved, or shallow-cloned.
- The legacy warning probes run in child processes so the process-scoped once-only state is real, not simulated by a module-scoped test hook.
- The resolver tests use injected facts and synthetic names only; they never read the real process environment.
- Boundary and ambient fixtures use the existing `mkdtemp` harness and production configuration copied verbatim; no live-tree probe.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except the manual owner-constraint review in TC-BRANDING-026 and the clarity/accuracy review recorded in TC-BRANDING-020. Paths marked with a dagger are assumed locations; delivery planning may bind different filenames, but the TC behaviour and assertion target must not change (A-T1).

| TC ID | Test file / artefact | Execution command | Mocking / mutations | Status |
|-------|----------------------|-------------------|---------------------|--------|
| TC-BRANDING-001 | `tests/behaviour/branding-resolver.test.ts` | `bun test tests/behaviour/branding-resolver.test.ts` | none | To Implement |
| TC-BRANDING-002 | `tests/behaviour/branding-resolver.test.ts` | same | clock/randomness stubs that throw if used | To Implement |
| TC-BRANDING-003 | `tests/behaviour/branding-resolver.test.ts` | same | invalid inputs; type-erasing cast | To Implement |
| TC-BRANDING-004 | `tests/behaviour/branding-resolver.test.ts` + `tests/fixtures/branding/derivation-cases.json` | same | none | To Implement |
| TC-BRANDING-005 | `tests/structure/branding-contract.test.ts` | `bun test tests/structure/branding-contract.test.ts` | temp-copy field removal/duplication | To Implement |
| TC-BRANDING-006 | existing `tests/boundaries/**` + `tests/structure/branding-seam.test.ts` | `bun test tests/boundaries`; `bun run scripts/checks/ambient-globals.ts` | temp-copy ambient/tier probes (existing fixtures) | Existing – Update |
| TC-BRANDING-007 | `tests/behaviour/branding-resolver.test.ts` + `tests/fixtures/branding/edge.ts` | `bun test tests/behaviour/branding-resolver.test.ts` | injected facts; no build | To Implement |
| TC-BRANDING-008 | `scripts/checks/forbidden-literals.ts` + registry | `bun run scripts/checks/forbidden-literals.ts` | none | To Implement |
| TC-BRANDING-009 | `tests/checks/forbidden-literals.test.ts` | `bun test tests/checks/forbidden-literals.test.ts` | five scope-class mutations + docs-scope mutation + missing-baseline case | To Implement |
| TC-BRANDING-010 | `tests/checks/forbidden-literals.test.ts` + corpora | same | true/false-positive corpus; vacuity probe | To Implement |
| TC-BRANDING-011 | `tests/checks/forbidden-literals.test.ts` | same | allowlist add/remove; masking probe | To Implement |
| TC-BRANDING-012 | `tests/checks/ci-checks.test.ts`; `ci.yml`; `ci-topology.ts` | `bun run scripts/checks/ci-topology.ts`; `bun run scripts/checks/ci-bindingness.ts`; `bun test tests/checks/ci-checks.test.ts` | job removal; `continue-on-error` injection; baseline-fetch removal | To Implement |
| TC-BRANDING-013 | `tests/checks/ignore-rules.test.ts`; `scripts/checks/ignore-rules.ts` | `bun run scripts/checks/ignore-rules.ts`; `bun test tests/checks/ignore-rules.test.ts` | temp `.gitignore` mutations | To Implement |
| TC-BRANDING-014 | `tests/behaviour/legacy-adapter.test.ts` + `tests/fixtures/legacy/warn-probe.ts` | `bun test tests/behaviour/legacy-adapter.test.ts` | child-process probes; injected facts | To Implement |
| TC-BRANDING-015 | `tests/behaviour/legacy-adapter.test.ts` | same | synthetic secret fixture | To Implement |
| TC-BRANDING-016 | `tests/structure/legacy-confinement.test.ts` + existing boundary suite | `bun test tests/structure/legacy-confinement.test.ts`; `bun test tests/boundaries` | temp-copy branding import | To Implement |
| TC-BRANDING-017 | `tests/structure/legacy-confinement.test.ts` | `bun test tests/structure/legacy-confinement.test.ts` | temp-copy `ADOS_NEW` read | To Implement |
| TC-BRANDING-018 | `tests/structure/legacy-confinement.test.ts` + literal inventory | same | temp-copy non-legacy literal | To Implement |
| TC-BRANDING-019 | `tests/structure/branding-contract.test.ts` | `bun test tests/structure/branding-contract.test.ts` | brand-coupled schema; fake emitter | To Implement |
| TC-BRANDING-020 | `tests/structure/rename-drill-doc.test.ts` + drill doc | `bun test tests/structure/rename-drill-doc.test.ts` | remove row/obligation in temp copy | To Implement |
| TC-BRANDING-021 | `tests/structure/branding-seam.test.ts` | `bun test tests/structure/branding-seam.test.ts` | out-of-place constant/object literal | To Implement |
| TC-BRANDING-022 | `tests/structure/content-inventory.test.ts` + `inventory.json` | `bun test tests/structure/content-inventory.test.ts` | undeclared executable content | Existing – Update |
| TC-BRANDING-023 | `tests/boundaries/**` + `fixture-coverage.test.ts` | `bun test tests/boundaries` | new rule without fixture; fixture deletion | Existing – Update |
| TC-BRANDING-024 | repo root; existing bash suites | `pnpm check`; `bun test tests/structure tests/behaviour`; `bun test tests/boundaries`; `bash scripts/.tests/test-*.sh`; `bash tools/.tests/test-*.sh` | none | Existing – No Change |
| TC-BRANDING-025 | `pnpm-lock.yaml`; existing checks | `pnpm install --frozen-lockfile`; `bun run scripts/checks/license-audit.ts`; `bun run scripts/checks/vulnerability-gate.ts` | none | Existing – No Change |
| TC-BRANDING-026 | PR review record | manual | none | Manual Only |
| TC-BRANDING-027 | `tests/checks/forbidden-literals.test.ts` (temp git repo) | `bun test tests/checks/forbidden-literals.test.ts` | post-merge literal injection; entry removal; baseline un-anchoring/advance; shallow clone | To Implement |

**Wiring**: `scripts/checks/forbidden-literals.ts` becomes a named `ts-forbidden-literals` CI job and a local `check:forbidden-literals` script. The GH-170 aggregate `check` chain stays exactly five steps; `ci-topology.ts` `TS_JOBS` gains the new job id, and `tests/checks/ci-checks.test.ts` asserts it. Every `scripts/checks/*.ts` file must be invoked by the aggregate or a named job (the existing wiring check enforces this).

**Execution order**: (1) structure and contract checks (005, 019, 021, 022); (2) resolver behaviour (001–004, 007); (3) legacy behaviour and confinement (014–018); (4) scan delivered state (008); (5) scan mutations, matching, and docs-scope lifetime (009–011, 013, 027); (6) boundary/meta-check (006, 023); (7) CI topology/bindingness (012); (8) aggregate and bash regression (024, 025); (9) manual review (020 clarity, 026 name-freedom).

**Evidence commands** (run and record in the change/PR):

```
bun test tests/behaviour/branding-resolver.test.ts
bun test tests/structure/branding-contract.test.ts
bun test tests/structure/branding-seam.test.ts
bun test tests/structure/legacy-confinement.test.ts
bun test tests/structure/rename-drill-doc.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/behaviour/legacy-adapter.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/checks/ignore-rules.test.ts
bun test tests/checks/ci-checks.test.ts
bun test tests/boundaries
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/ignore-rules.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/workspace-entrypoints.ts
bun run scripts/checks/ci-topology.ts
bun run scripts/checks/ci-bindingness.ts
bun run scripts/checks/license-audit.ts
bun run scripts/checks/vulnerability-gate.ts
pnpm check
bash scripts/.tests/test-*.sh
bash tools/.tests/test-*.sh
git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude
git status --porcelain
```

The `git diff` for `scripts` intentionally includes new `scripts/checks/*.ts` files; the no-change assertion applies to existing bash/tool/agent files, not to the new check. The scan's evidence run requires the registry-recorded `corpusBaseline` commit (`32784af`) to be reachable in the clone; a checkout without it must fail closed rather than skip the docs class.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | Substring matching trips on ordinary words (`avocados`, `mikados`) or misses an embedded token (`adosRuntime`) | M | M | The matching contract in §4.1; committed true/false-positive corpora (TC-BRANDING-010); failures name file and token for triage; the reserved lowercase-embedding limitation is recorded |
| RSK-T2 | The docs scope is defined too broadly (false positives on the pre-existing corpus) or too narrowly (a doc escapes) | H | M | Scope-of-claim interpretation A-T2: docs absent at the fixed `corpusBaseline`, a reviewed `registered` list, and a docs-scope meta-check against that baseline (TC-BRANDING-008/009/027); pre-existing corpus is explicitly out of claim |
| RSK-T3 | The docs-scope meta-check passes silently when the `corpusBaseline` commit is unavailable or the checkout is shallow | H | L | Fail closed on a missing or unreachable baseline with a named error; CI fetches full history or the baseline commit; TC-BRANDING-009 step 9 and TC-BRANDING-027 step 8 cover it |
| RSK-T4 | Updating the GH-170 content inventory weakens the empty-but-enforced gate | H | M | Per-file executable allowlist, not a global switch; mutations in TC-BRANDING-022; the "no engine/driver/command" assertions remain |
| RSK-T5 | The exactly-once warning test is polluted by module cache or test ordering | M | M | Child-process probes for the default process-scoped instance; fresh factory instances for unit-level counts; injected sinks, no test-only reset hook |
| RSK-T6 | Derivation expectations become a copy of the implementation and cannot catch drift | M | M | Independent `derivation-cases.json` derived from the documented rules; a missing rule row fails TC-BRANDING-004; review the table when rules change |
| RSK-T7 | No production runtime-aware edge exists at M0-S2, so the override is tested only through a fixture edge | M | L | A-T3 records the deferral; the resolver-input contract is exercised with injected facts; M0-S4 binds the first real edge without reshaping it |
| RSK-T8 | The new CI job is added but accidentally advisory or breaks topology | H | L | TC-BRANDING-012 mutations (`continue-on-error`, job removal); existing ci-topology/ci-bindingness checks; `TS_JOBS` update |
| RSK-T9 | A candidate or public name leaks through a fixture, comment, commit, or PR text | H | L | Synthetic-name registry (TC-BRANDING-026); automated scan of code/new docs (TC-BRANDING-008); owner PR review is the human gate; test plan/spec use legacy tokens only in quoted scan framing |
| RSK-T10 | The rename-drill content test is wording-brittle or passes a hollow document | M | M | Stable checklist anchors and required command/gate names; mutation removes a row; manual clarity review |
| RSK-T11 | The legacy literal-inventory test becomes a rubber stamp if updated casually | M | L | Inventory updates require review; a non-legacy literal fails; the allowlist cannot hide it (TC-BRANDING-018) |
| RSK-T12 | The docs scope regresses to PR-relative membership, so a registered doc silently leaves scan coverage after merge and a later literal escapes (scope decay) | H | L | Membership is anchored to the fixed `corpusBaseline` in the registry and is permanent once registered; the registry shape forbids a base-relative derivation; TC-BRANDING-027 proves post-merge scanning, entry-removal, un-anchoring, and baseline-advance mutations all fail |

### 8.2 Assumptions

- **A-T1** — Behaviour is bound by the TCs, not by exact symbol names. Paths and function names marked as assumed (resolver, warning API, drill-doc path) may be bound by the delivery plan without changing the assertions.
- **A-T2** — Scope class 5 is interpreted per DEC-8 scope-of-claim as **docs absent at a fixed corpus baseline**, not docs added versus a moveable PR base. The registry records `corpusBaseline: "32784af"` (the last pre-scan commit on `main-tools`) and an explicit `registered` list; membership is permanent once registered. The meta-check asserts (docs absent at baseline ⊆ `registered`) ∧ (`registered` ⊆ docs present in the tree ∧ absent at baseline). Pre-existing docs present at the baseline remain out of claim until the separate corpus migration.
- **A-T3** — No production runtime-aware edge exists in M0-S2; the override is exercised by an injected-facts test harness. M0-S4 consumes the resolver-input contract without reshaping it. This is deferred wiring, not a test gap.
- **A-T4** — `tests/**` is not a DEC-8 scan class. All new tests live under `tests/**` (not `packages/*/test/**`), so scan fixtures and legacy tokens never enter the scanned package tree. Test fixtures legitimately contain seed tokens and synthetic names; synthetic-name discipline in tests is enforced by the fixture registry and review, not by the scan.
- **A-T5** — The scan's docs-scope meta-check runs in CI and locally with the fixed `corpusBaseline` commit reachable (full history or an explicit fetch of that commit). The static scan (classes 1–4 plus registered docs) is hermetic and runs locally once the baseline commit is present.
- **A-T6** — The resolver's derivation rules are documented by delivery planning; TC-BRANDING-004 reads an independent expectation table derived from those rules. If a rule is undocumented, TC-BRANDING-004 fails rather than guessing.
- **A-T7** — The legacy adapter exposes a testable mapping entry point that accepts injected environment facts and a warning sink, plus a factory for an isolated instance; a thin I/O wrapper and the default instance supply the real process environment in production. The default instance's once-only guard is module/process-scoped, and the child-process probe is the authoritative process-level test; unit-level counts use a fresh factory instance, so no test-only reset hook is required in production code.
- **A-T8** — The new forbidden-literal check is a `scripts/checks/*.ts` invariant, mutation-tested under `tests/checks/**`, and wired as a named CI job; it is not inserted into the GH-170 aggregate chain, which stays at five steps.
- **A-T9** — The existing `subpath-adapters-core-branding` dependency-cruiser rule already forbids adapters from importing branding, including from the legacy subpath. No new rule is required for AC-F5-3; if delivery adds one, it ships with a failing fixture.
- **A-T10** — The rename drill is documented only; it is not executed in this change (DEC-6, NG-6). Its first mandatory execution is the earlier of the next branding change or the pre-release check.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Should the scan's matching contract use the lowercase-delimiter rule in §4.1, or a stricter/looser rule? | RSK-2 and spec §14 delegate matching semantics to delivery planning. The proposed rule catches `adosRuntime` while ignoring `avocados`/`mikados`; it deliberately does not catch a fully lowercase embedded identifier such as `myados`. | Resolved for this plan: §4.1 is the binding test contract; a change requires updating the corpora and the registry review | Delivery planning |
| OQ-T2 | Is the docs scope "new docs only" or "new docs plus modifications to the pre-existing corpus"? | DEC-8 scope-of-claim excludes the pre-existing corpus; the pre-existing corpus already contains seed tokens. A-T2 binds docs absent at the fixed `corpusBaseline`, with permanent registry membership; modifications to a doc that existed at the baseline remain out of claim until the corpus migration. | Resolved for this plan: baseline-anchored, permanent membership; residual risk recorded (RSK-T12) | @pm / owner |
| OQ-T3 | Where does the drill document live? | The spec requires a self-contained new user-facing doc; the exact path is a delivery-plan decision. | Open — non-blocking; proposed `doc/guides/rename-drill.md`, must be registered in the baseline-anchored `registered` list | Delivery planning |
| OQ-T4 | Does the resolver expose a runtime constant for the schema name or a type-level reservation? | The contracts subpath is types-only at scaffold; a runtime constant is a reviewed content-inventory exception. | Open — non-blocking; either form is accepted if it is brand-neutral and TC-BRANDING-019 passes | Delivery planning |
| OQ-T5 | May `corpusBaseline` ever advance? | The baseline is fixed at `32784af` for this change. Only the later corpus-migration change may deliberately move it, and only after the registered docs from the interim period are migrated into the pre-existing corpus and their registry entries removed in the same reviewed change. Ordinary changes never touch it; TC-BRANDING-027 step 7 makes an accidental advance fail closed. | Resolved for this plan: fixed, never advanced by ordinary changes | @pm / owner |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-29 | @test-plan-writer | Initial plan: 26 TCs covering resolver completeness/determinism/fail-closed/derivation, contract placement, branding purity, injected override, full-scope forbidden-literal scan with mutation and CI bindingness, legacy adapter mapping/warning/secret safety/confinement/literal inventory, telemetry neutrality, rename-drill content, seam integrity, content-inventory discipline, boundary meta-check, aggregate/bash regression, dependency/license regression, and the manual name-freedom gate; all 13 ACs, 4 ticket ACs, 9 NFRs, 3 DMs, and 2 EVTs traced |
| 1.1 | 2026-10-29 | @test-plan-writer | DoR iter-1 remediation: (1) docs scope re-anchored from moveable PR-base membership to the fixed `corpusBaseline` (`32784af`) recorded in the registry with permanent `registered` membership; rewrote §4.1 class 5 + delivered-state rule, §4.2 docs row and mutation count, TC-BRANDING-008/009, TC-BRANDING-012 baseline reachability, A-T2/A-T5, RSK-T2/T3, OQ-T2/T5, and added TC-BRANDING-027 (post-merge permanence, entry-removal, un-anchoring, baseline-advance, fail-closed mutations); (2) fixed TC-BRANDING-020 step 2 to assert the plan-bound `ados_distribution: internal` (valid enum; one-word owner flip note); TC count 26 → 27; 13/13 ACs and 9/9 NFRs still traced |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed; seam not implemented |
