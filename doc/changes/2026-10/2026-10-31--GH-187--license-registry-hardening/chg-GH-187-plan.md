---
id: chg-GH-187-license-registry-hardening
status: Updated
created: 2026-10-31T14:45:00Z
last_updated: 2026-10-31T16:45:00Z
owners: [engineering]
service: delivery-os repository license compliance gate
labels: [change, planning]
links:
  change_spec: ./chg-GH-187-spec.md
  test_plan: ./chg-GH-187-test-plan.md
summary: >
  Deliver an explicit, tamper-evident license deny policy in the committed
  registry (schema v3 plus a required deny_list covering all five mandated
  families and the Appendix A baseline), enforce deny-before-allow and
  deny-list integrity in the existing fail-closed audit, prove the policy with
  the TC-LICREG-001..031 matrix including spawned-process exit/stream cases,
  and keep ts-license-audit as the only, unweakened CI gate with no new job,
  no new dependency, and no lockfile or manifest change.
version_impact: none
---

# IMPLEMENTATION PLAN — GH-187: License registry hardening

## Context and Goals

GH-187 hardens the license registry seeded by GH-170. The change has exactly one behavioural centre: the committed registry under `doc/legal/` declares an authoritative `deny_list` at schema version 3, and `scripts/checks/license-audit.ts` enforces that policy before the allow list for every registry entry and every branch of a compound SPDX expression. The test plan (`chg-GH-187-test-plan.md` v1.3, 31 TCs, `TC-LICREG-001..031`) is the behavioural contract; the spec (`chg-GH-187-spec.md` v1.2) is the requirement source. This plan orders the work so the registry and the audit change atomically and every task maps to an AC and one or more TCs.

The delivered end state:

- `doc/legal/dependency-licenses.yaml` declares `schema_version: 3`, preserves `scope`, `c2_determination`, all 16 entries, uses, approved verdicts, and the four-entry `allow_list` verbatim, adds a non-empty `deny_list` containing at least the 20 Appendix A identifiers, and states the policy in header comments.
- `scripts/checks/license-audit.ts` rejects an absent/old/non-numeric schema, validates deny-list presence, type, non-emptiness, single-identifier grammar, uniqueness, allow/deny disjointness, and the mandatory Appendix A floor; evaluates denial before `LicenseRef-*` detection and allow-list membership on every parsed branch; distinguishes `NOASSERTION`, `NONE`, and `SEE LICENSE` as non-asserted; and reports a denial class distinct from `not allow-listed`.
- The extended suite proves every negative class in process and at the process boundary (`status !== 0`, `FAIL license-audit: ` on stderr, no `OK` on stdout, no stack trace), while the live registry and the `@biomejs/biome` `MIT OR Apache-2.0` entry stay green.
- `.github/workflows/ci.yml`, `pnpm-lock.yaml`, root and package manifests, `TS_JOBS`, and the aggregate `check` chain are unchanged.

### Preconditions

- Branch `feat/GH-187/license-registry-hardening` from `origin/main-tools`; `origin/main-tools` is fetched because TC-LICREG-003, TC-LICREG-020, TC-LICREG-028, and TC-LICREG-029 compare against it. If the ref is missing, tests must fail naming the ref, never skip.
- Dependencies installed with `pnpm install --frozen-lockfile`. Without `node_modules`, `bun test` cannot resolve `yaml` while `bun run scripts/checks/license-audit.ts` may auto-install; an uninstalled tree is an environment fault, not a test result.

### Open questions and resolved upstream flags

No blocking open question remains. **OQ-T1 and OQ-T2 are resolved by spec v1.2** (C-2 wording preserved verbatim; deny-entry grammar `^[A-Za-z0-9.+-]+$` stated in DM-2/Appendix A). **OQ-T3 and OQ-T4 remain non-blocking** in test plan v1.3 and do not gate delivery: `NONE` fails closed and is accepted under either the non-asserted or not-allow-listed class, and the focused-suite layout is bound by A-T1. The three documentation inconsistencies previously flagged in this plan are **RESOLVED** by test plan v1.3 and spec v1.2:

- **TP-ISSUE-1 — RESOLVED (test plan v1.3):** the malformed-entry matrix is fixed at **18** cases (5 non-string + 3 empty + 3 whitespace-affixed + 1 duplicate + 3 compound + 3 operator-only). The mapping table, TC-LICREG-012, and TC-LICREG-024 agree.
- **TP-ISSUE-2 — RESOLVED (test plan v1.3):** TC-LICREG-022 is fixed as **10 spawned cases** (1 live green + 9 explicit failure cases: denied single, denied branch, denied nested branch, deny-list absent, old schema, floor removal, allow/deny overlap, non-asserted, unregistered dependency). The unknown-reference, empty, non-allow-listed, and allow/verdict-drift classes remain proven **in process** by TC-LICREG-016, TC-LICREG-017, and the existing drift test. Phase 3 binds exactly these 10 spawns.
- **TP-ISSUE-3 — RESOLVED (spec v1.2 and test plan v1.3):** the deny-entry grammar is `^[A-Za-z0-9.+-]+$` applied to a single token; whitespace padding, `AND`/`OR`/`WITH`, parentheses, and multi-token values are malformed policy.

Test plan v1.3 adds **TC-LICREG-031** (schema-v3 registry with a wrong `scope` fails closed and reports the observed scope), bringing the matrix to **31 TCs**. The total is 31/31: every TC is referenced in this plan's task mappings and Test Scenarios table.

No specification or test-plan reopening is required; the binding outcomes above are final for delivery.

## Scope

### In Scope

- Registry policy artifact (F-1, AC-F1-1..AC-F1-4, CON-1, CON-6): schema 3, required non-empty `deny_list`, preserved entries/uses/verdicts/allow list/scope/C-2 text, human-readable policy notes.
- Mandatory denied families and floor (F-1, F-3, AC-F1-2, AC-F3-3, DEC-6): SSPL, BUSL, Elastic License, Commons Clause, CC-BY-NC; 20/20 Appendix A identifiers enforced from code.
- Deny-before-allow enforcement (F-2, AC-F2-1..AC-F2-3): single identifiers, OR/AND/nested branches, explicit denial class.
- Registry-level contradiction (F-2, F-3, AC-F2-2, CON-2): allow/deny overlap is a policy failure independent of entries.
- Deny-list integrity (F-3, AC-F3-1, AC-F3-2, DM-1, DM-2): schema gate, presence, array type, non-emptiness, single-identifier grammar, uniqueness, disjointness, floor.
- Fail-closed unknowns (F-4, AC-F4-1, AC-F4-2): unregistered dependency/use, empty, `LicenseRef-*`, `NOASSERTION`, `NONE`, `SEE LICENSE`, unparseable, valid-but-non-allow-listed.
- Preserved compound evaluation (F-6, AC-F6-1, DEC-3, Appendix C): the live `MIT OR Apache-2.0` entry passes; no blanket rejection.
- Binding CI evidence (F-5, AC-F5-1, AC-F5-2, NFR-3, NFR-4): existing `ts-license-audit` job only, unchanged; topology/bindingness/supply-chain/surface invariants green; no dependency or lockfile change.
- Tests and fixtures: extend `tests/checks/license-audit.test.ts`, add the three focused suites and the temp-tree helper named by the test plan, extend `cases.json`, add `deny-baseline.json` and `deny-list-cases.json`.

### Out of Scope

- [OUT] SBOM, checksum manifests, signatures, `THIRD-PARTY-NOTICES`, or a `licenses/` bundle (NG-1, CON-7). Release-time artifacts belong to **M4-S2**; registry completeness and public materials belong to **M4-S3**. GH-187 supersedes GH-170 DEC-10's earlier M0-S18 assignment of these obligations.
- [OUT] Per-entry review dates, approver governance, re-review campaigns, and any change to existing verdicts (NG-2, NG-3).
- [OUT] Rejecting all compound SPDX expressions (NG-4, DEC-3).
- [OUT] A new CI job, workflow redesign, advisory mode, or separate policy service (NG-5, CON-4).
- [OUT] New dependencies, network calls, external license databases, or expansion of the audited graph (NG-6, NG-7).
- [OUT] Automated legal compatibility analysis; C-2 remains a human confirmation (NG-8, RSK-6).
- [OUT] Release notes, public documentation, or user-facing license disclosure.

### Constraints

- **CON-1/CON-6:** the policy lives only in the existing YAML; no companion policy file; existing data is preserved except the schema bump and `deny_list`.
- **CON-2:** deny wins over allow; an allow/deny overlap is a policy failure.
- **CON-3:** compound expressions are parsed per branch; no branch may be unknown, denied, or non-allow-listed.
- **CON-4/CON-5:** `ts-license-audit` stays the only gate; no bypass; no new dependency or lockfile change.
- **CON-7 (corrected ownership):** release-time SBOM, checksums, signatures, and notices remain **M4-S2**; registry completeness and public materials remain **M4-S3**. GH-187 supersedes GH-170 DEC-10's earlier M0-S18 assignment of these obligations.
- **CON-8:** the audit remains offline, deterministic, clock-free, and order-independent.
- **CON-9:** failure output names package, use (where applicable), license text or identifier, and reason.
- **CON-10:** the existing fail-closed scope check is preserved: `scope` must remain `direct-and-runtime-closure` for schema v3; any other scope (including absent or `null`) fails closed and reports the observed scope (AC-F1-3, DM-1, TC-LICREG-031).

**Deny/allow disjointness rule (binding):** `deny_list ∩ allow_list` must be empty. Any shared identifier is a registry policy failure naming `deny_list`, `allow_list`, and the identifier. Independently, an entry whose branch is denied fails even when that identifier is also allow-listed and approved. Both checks must hold.

**Mandatory denied baseline (Appendix A, 20 identifiers, all required):**

```text
SSPL-1.0
BUSL-1.0
BUSL-1.1
Elastic-2.0
Commons-Clause
CC-BY-NC-1.0
CC-BY-NC-2.0
CC-BY-NC-2.5
CC-BY-NC-3.0
CC-BY-NC-4.0
CC-BY-NC-SA-1.0
CC-BY-NC-SA-2.0
CC-BY-NC-SA-2.5
CC-BY-NC-SA-3.0
CC-BY-NC-SA-4.0
CC-BY-NC-ND-1.0
CC-BY-NC-ND-2.0
CC-BY-NC-ND-2.5
CC-BY-NC-ND-3.0
CC-BY-NC-ND-4.0
```

Additional identifiers may be present. Each deny entry is a single identifier matching `^[A-Za-z0-9.+-]+$`; whitespace padding, `AND`/`OR`/`WITH`, parentheses, and multi-token values are malformed policy.

**Explicit no-change assertions:**

- `pnpm-lock.yaml`, root `package.json`, `packages/*/package.json`: byte-unchanged.
- `.github/workflows/ci.yml`: byte-unchanged; `TS_JOBS` and the job-id set unchanged.
- `package.json` `scripts.check`: the pinned aggregate chain unchanged.
- `doc/legal/` still contains exactly one file (`dependency-licenses.yaml`).
- No new `scripts/checks/*.ts`; no new CI job; no `.changeset/` entry; no package version bump (`version_impact: none`).
- No SBOM, notices, checksums, or review-date artifacts.

### Risks

| ID | Risk | Mitigation |
|----|------|------------|
| RSK-1 | A future edit removes a mandated family or adds it to the allow list | Appendix A floor in code, overlap failure, TC-LICREG-002/007/008/013. |
| RSK-2 | A legitimate dependency is blocked | Preserve all entries and the allow list; live registry must validate `[]`; TC-LICREG-023. |
| RSK-3 | Per-branch handling is disputed against ADR-0003 C-2 | Record Appendix C interpretation; keep the live compound green; TC-LICREG-018/019. |
| RSK-4 | Schema bump breaks an older reader | Registry and audit ship in the same commit set; old schema fails closed; no external consumer. |
| RSK-5 | Tests prove only the happy path | Mutation matrix plus spawned exit cases; TC-LICREG-022/024. |
| RSK-6 | Recorded verdicts are legally inaccurate | Keep the proposed C-2 determination; owner confirms at PR review; gate enforces recorded policy. |
| RSK-P1 | A partial ship exposes a v3 registry to a v2-only audit, or vice versa, and blocks every PR | Phase 1 ships registry and audit in one commit; never edit the registry alone; reversion is atomic (see Rollback). |
| RSK-P2 | A future review or test edit drifts from the resolved test-plan v1.3 binding (18 malformed cases; 25 removal cases; 10 spawned cases = 1 green + 9 failures; four non-spawned classes proven in process) by over-adding spawns or weakening coverage | TC-LICREG-024's meta-check and the explicit count assertions in Phases 2 and 3 bind the resolved matrix; any deviation requires a new test-plan revision rather than a silent edit. |
| RSK-P3 | `origin/main-tools` is unavailable locally | `git fetch origin main-tools`; tests fail naming the ref instead of skipping (GAP-2). |
| RSK-P4 | Spawned temp-tree cases are slow or flaky | One spawn per failure class, ~60 KB lockfile copy, cleanup in `finally`; exhaustive matrix stays in process. |
| RSK-P5 | System spec drifts from the deny policy | Phase 6 reconciliation owned by `@doc-syncer`; no delivery commit edits `doc/spec/**`. |

### Rollback

Revert the entire change set (registry + audit + tests/fixtures) as one unit. Never revert `doc/legal/dependency-licenses.yaml` alone while the audit still expects schema 3, and never revert the audit alone while the registry is v3: both intermediate states fail the binding `ts-license-audit` gate closed and block all pull requests. There is no data migration, no external state, and no feature flag; a full revert restores the v2 registry with the previous audit behaviour. If the gate must be unblocked urgently, revert the whole commit set and re-deliver under a new change.

### Success Metrics

| Metric | Target |
|--------|--------|
| Mandated denied families in the registry | 5/5 |
| Appendix A identifiers present | 20/20 |
| Denied single/branch cases failing | 100% |
| Denied identifiers passing when allow-listed | 0 |
| Deny-list integrity mutations failing closed | 100% |
| Baseline identifiers removable without failure | 0 |
| Unregistered/`NOASSERTION`/`SEE LICENSE`/`LicenseRef-*`/empty/non-allow-listed failing | 100% |
| Live `MIT OR Apache-2.0` entry passing | 1/1 |
| Live registry validation | `[]` |
| New CI jobs / weakened gates | 0 / 0 |
| New dependencies / lockfile changes | 0 / 0 |

## Phases

### Phase 1: Registry policy and audit enforcement core

**Goal**: Land the v3 registry and the deny-policy enforcement in one atomic change so no intermediate state exposes a v3 registry to a v2-only audit.

**Dependency rationale**: Everything downstream (fixtures, suites, CI assertions) targets the exported floor set, the policy validator, and the live v3 registry; these must exist first.

**Tasks**:

- [ ] **1.1** Update `doc/legal/dependency-licenses.yaml`: set `schema_version: 3`; add a required `deny_list` containing at least the 20 Appendix A baseline identifiers above; additional valid identifiers are permitted; extend the header comments so they state all five claims in test plan §4.3 — unregistered/unknown fail closed; `NOASSERTION` and `SEE LICENSE` are never accepted; every branch of a compound expression is evaluated individually; the deny list wins over the allow list; the allow list contains only identifiers backed by approved verdicts. Preserve `scope`, `c2_determination`, all 16 entries, every use triple, every `approved` verdict, and the four-entry `allow_list` verbatim. Keep `doc/legal/` at exactly one file.
- [ ] **1.2** Extend `scripts/checks/license-audit.ts` with the policy layer: add `deny_list?: string[]` to `Registry`; export `MANDATORY_DENIED_IDENTIFIERS: ReadonlySet<string>` containing exactly the 20 baseline identifiers; export a policy validator (proposed name `validateRegistryPolicy`, exact name bound by delivery per A-T1) that evaluates in this order — (a) `schema_version === 3` as a number, with a `schema` failure naming the observed value or its absence; (b) `scope === "direct-and-runtime-closure"` for schema v3, with a `scope` failure naming the observed value or its absence and the supported value, preserving the pre-existing fail-closed scope check (CON-10, AC-F1-3, TC-LICREG-031); (c) `deny_list` must be an array, non-empty, every entry a string, every entry a single identifier matching `^[A-Za-z0-9.+-]+$` with no whitespace affix and not exactly `AND`/`OR`/`WITH`, no duplicates; (d) disjointness from `allow_list`, one failure per overlapping identifier naming both lists; (e) every `MANDATORY_DENIED_IDENTIFIERS` member present, with a failure naming `deny_list` and the missing identifier. Call this validator unconditionally at the top of `auditRegistry` and accumulate its failures before any existing early return, so policy failures appear with empty dependencies and malformed entries. Do not reduce the existing combined schema/scope condition to a schema-only check.
- [ ] **1.3** Enforce deny-before-allow per branch and close the non-asserted gap: in the entry license loop, after parse, evaluate each identifier in the order deny → `LicenseRef-` → allow-list. A denied identifier emits a denial-class failure containing the package, the raw license text, the identifier, and `denied` (never only `not allow-listed`). Before parsing, treat an exact trimmed value in `{NOASSERTION, NONE, SEE LICENSE}` as a `non-asserted` failure containing the package and raw text. Preserve the existing `empty license field`, `not a valid SPDX expression`, `unknown license reference`, `not allow-listed`, `missing registry entry`, `missing registered use`, `unverified use`, `conflicting version`, `duplicate registry entry`, `duplicate use`, allow/verdict-drift messages, and the fail-closed scope check (CON-10: schema v3 requires `scope: direct-and-runtime-closure`; a wrong scope reports the observed scope). Do not change `parseSpdxExpression`, `lockedUses`, `directExternalDependencies`, or the `validate(root, registry?)` signature.
- [ ] **1.4** Verify the atomic pair and preserve the existing surface: run the live gate, all **13** pre-existing audit tests, typecheck, and lint; confirm no change to `pnpm-lock.yaml`, `package.json`, `packages/*/package.json`, or `.github/workflows/ci.yml`; confirm the source still imports only `node:fs`, `node:path`, and `yaml` (no network, clock, randomness, environment, or child-process construct) and still enforces both the schema and scope gates.

**Acceptance Criteria**:

- Must: the registry parses as schema 3 in one committed file with a non-empty deny list containing 5/5 families and 20/20 baseline identifiers (AC-F1-1, AC-F1-2).
- Must: old/absent/string/future/null schema versions fail closed; a schema-v3 registry whose `scope` is not `direct-and-runtime-closure` fails closed and reports the observed scope; absent/non-array/empty/malformed/duplicate/overlapping/family-stripped deny lists fail closed (AC-F1-3, AC-F3-1, AC-F3-2, AC-F3-3, CON-10).
- Must: a denied identifier fails even when allow-listed and approved; a denied branch fails in OR, AND, and nested expressions (AC-F2-1, AC-F2-2, AC-F2-3).
- Must: the live `MIT OR Apache-2.0` entry and the live registry validate with zero failures (AC-F6-1, AC-F5-2 partial).
- Must: all **13** pre-existing audit tests remain present and pass; TC-LICREG-029 step 1's dynamic base-branch title check is the authority for that count (AC-F5-2).
- Should: every new failure names package/field, offending value, and reason (NFR-6).

**Files and modules**:

- `doc/legal/dependency-licenses.yaml` (updated)
- `scripts/checks/license-audit.ts` (updated)

**System docs**:

- None in this phase. `doc/spec/features/feature-monorepo-scaffold-toolchain.md` is reconciled in Phase 6/workflow phase 7.

**Tests**:

- `pnpm install --frozen-lockfile`
- `bun run scripts/checks/license-audit.ts` → prints `OK license-audit: ...`, exit 0
- `bun test tests/checks/license-audit.test.ts` → all **13** pre-existing tests pass, 0 fail; all 13 titles must remain (TC-LICREG-029 step 1 is the authority)
- `pnpm typecheck` → exit 0
- `pnpm lint` → exit 0
- `git diff --exit-code pnpm-lock.yaml package.json 'packages/*/package.json' .github/workflows/ci.yml` → exit 0

**Completion signal**: `feat(GH-187): enforce explicit deny-list license policy`

---

### Phase 2: Fixtures and in-process policy/enforcement matrix

**Goal**: Encode the full mutation matrix as fixtures and focused in-process suites, so every AC has an executable negative or control case before process-level proof is added.

**Dependency rationale**: The suites import the Phase 1 exports (`MANDATORY_DENIED_IDENTIFIERS`, the policy validator) and mutate the live v3 registry. Fixtures must exist before the suites that loop over them.

**Tasks**:

- [ ] **2.1** Extend `tests/fixtures/license/cases.json` without changing the five existing keys (`unknownRef`, `nonAllowlisted`, `compoundOrDisallowed`, `compoundAndAllowed`, `empty`): add `noassertion`, `seeLicense`, `none`, `blank`, `whitespace`, six unparseable shapes (`MIT OR`, `AND MIT`, `MIT (ISC`, `()`, `MIT WITH Classpath-exception-2.0`, `MIT/Apache-2.0`), denied single cases, seven denied-compound cases from TC-LICREG-009, two all-allowed compound controls, two unknown-reference cases, and seven non-allow-listed guard identifiers. Create `tests/fixtures/license/deny-baseline.json` with five families (counts 1, 2, 1, 1, 15) plus a flat 20-identifier list. Create `tests/fixtures/license/deny-list-cases.json` declaring, at minimum: schema 5, scope 5 (wrong scope, near-miss scope, empty scope, absent scope, null scope), presence/type 7, malformed entries 18 (5 non-string, 3 empty, 3 whitespace-affixed, 1 duplicate, 3 compound, 3 operator-only), floor 25 (20 single removals + 5 adversarial removals), overlap 3, extension 2, unknown reference 2, empty 2, non-asserted 2, unparseable 6, non-allow-listed 7, each with `id`, mutated field, expected class token, and expected offending value.
- [ ] **2.2** Add `tests/checks/license-policy.test.ts` implementing TC-LICREG-001, 002, 003, 004, 005, 007, 008, 011, 012, 013, 024, and 031: registry shape/schema/scope/C-2/allow bijection/single-file assertions; baseline and code↔fixture floor equality; base-branch preservation via `git show origin/main-tools:doc/legal/dependency-licenses.yaml` with a loud failure when the ref is absent; five schema mutations with restore control; five wrong-scope mutations (wrong value, near miss, empty, absent, null) with canonical-scope control, asserting the failure names the observed scope and the supported value; comment-only policy keyword groups; deny-over-allow with approved verdict; standalone overlap including a minimal no-entry registry; absent/non-array/empty deny list; all 18 malformed entries; 25 removal cases (20 single removals plus 5 adversarial removals) plus extension control; and the matrix meta-check with unknown-class-token control.
- [ ] **2.3** Extend `tests/checks/license-audit.test.ts` implementing TC-LICREG-006, 009, 010, 014, 015, 016, 017, 018, 019, and 023 while preserving all **13** existing test titles and the existing fixture keys. All 13 pre-existing titles must remain and pass; TC-LICREG-029 step 1's dynamic base-branch title check is the authority, and the plan's stated 13 is descriptive only. Cover 20/20 single denials with a `MIT` control, 7 denied compounds plus 2 allowed controls, per-branch denial counts, extension and prefix/substring traps, unregistered entry/use/synthetic use/version conflict, 13 non-asserted/empty/reference/unparseable values, 7 non-allow-listed guards, the isolated live compound, all-allowed compounds with a disallowed control, and live validation plus closure accounting.
- [ ] **2.4** Run the two suites and record evidence: `bun test tests/checks/license-policy.test.ts` and `bun test tests/checks/license-audit.test.ts`; both green with 0 skipped/todo/only, no case whose only assertion is a log substring, TC-LICREG-031's five scope mutations plus canonical control executed, and all **13** pre-existing titles still present and passing.

**Acceptance Criteria**:

- Must: TC-LICREG-001..019, 023, 024, 031 pass, including 25/25 removal cases (20 single + 5 adversarial), 5/5 families, 18 malformed entries, five wrong-scope mutations, and the preserved compound (AC-F1-1..AC-F1-4, AC-F2-1..AC-F2-3, AC-F3-1..AC-F3-3, AC-F4-1, AC-F4-2, AC-F6-1, CON-10).
- Must: all **13** pre-existing audit test titles remain present and pass (AC-F5-2, TC-LICREG-029 step 1 is the authority).
- Should: fixtures carry the declared counts so TC-LICREG-024 can prove the matrix did not silently shrink.

**Files and modules**:

- `tests/fixtures/license/cases.json` (updated)
- `tests/fixtures/license/deny-baseline.json` (new)
- `tests/fixtures/license/deny-list-cases.json` (new)
- `tests/checks/license-policy.test.ts` (new)
- `tests/checks/license-audit.test.ts` (updated)

**System docs**:

- None.

**Tests**:

- `git fetch origin main-tools`
- `bun test tests/checks/license-policy.test.ts` → all pass
- `bun test tests/checks/license-audit.test.ts` → all pass, including all **13** pre-existing titles

**Completion signal**: `test(GH-187): add license policy and enforcement matrix`

---

### Phase 3: Spawned process contract for exit code, streams, determinism, and performance

**Goal**: Prove the acceptance criterion at the process boundary the CI job invokes, not only through in-process failure sets.

**Dependency rationale**: The temp-tree helper spawns the Phase 1 audit and needs the finalized failure vocabulary; it must follow Phase 2 so the class markers are stable.

**Tasks**:

- [ ] **3.1** Add `tests/checks/license-fixture.ts` (helper, never `*.test.ts`) with: `createLicenseTree(registryText)` that creates a `mkdtemp` tree containing the root `package.json`, every existing `packages/{core,adapters,cli,mcp,opencode,testkit}/package.json`, `pnpm-lock.yaml`, and the mutated `doc/legal/dependency-licenses.yaml`; `spawnLicenseAudit(tree)` that runs `spawnSync("bun", ["run", join(ROOT, "scripts/checks/license-audit.ts")], { cwd: tree, encoding: "utf8" })`; and removal in a `finally`. Never write the live tree.
- [ ] **3.2** Add `tests/checks/license-audit-exit.test.ts` implementing TC-LICREG-022 exactly as enumerated: one live green spawn (`status === 0`, stdout starts with `OK license-audit:`, empty stderr) and nine failure spawns (denied single, denied branch, denied nested branch, deny list absent, old schema, floor removal, allow/deny overlap, non-asserted, unregistered dependency), each asserting `status === 1`, `FAIL license-audit: ` on stderr, the expected tokens, no `OK` on stdout, no `/^\s+at /m` and no `/\bError:\s/`, and every non-empty stderr line prefixed `FAIL license-audit: `. Assert the executed count equals the registered count and the suite leaves a clean worktree. Implement exactly these 10 spawned cases; the four remaining classes are proven in process by TC-LICREG-016, TC-LICREG-017, and the existing drift test, so do not add or drop spawns without a new test-plan revision.
- [ ] **3.3** In the same suite implement TC-LICREG-025, 026, and 027: repeat-run exact equality and order independence for `validate`/`auditRegistry`; a source scan of `scripts/checks/license-audit.ts` for `Math.random`, `Date.now`, `new Date`, `performance.now`, `fetch(`, `node:http`, `node:https`, `node:net`, `node:dns`, `child_process`, and `process.env`; thirteen diagnosability representatives with class tokens, forbidden-token guards, and a throw-vs-return guard; and one timed live spawn asserting `status === 0` and elapsed `< 30_000` ms. Record the measured duration in the PR evidence; do not tighten the bound.
- [ ] **3.4** Run `bun test tests/checks/license-audit-exit.test.ts`; confirm every spawn cleans up, no residue remains (`git status --porcelain` unchanged), and the suite adds well under one minute to the checks layer.

**Acceptance Criteria**:

- Must: every enumerated failure class exits non-zero with the stable stderr prefix and no stack trace; success alone prints on stdout (AC-F2-1, AC-F2-3, AC-F3-1, AC-F3-3, AC-F4-1, AC-F4-2, AC-F5-1, NFR-1, NFR-6).
- Must: identical inputs produce identical failure sets; no network, clock, randomness, environment, or subprocess dependence in the audit (NFR-2, CON-8).
- Must: the live audit completes below 30 seconds with no job timeout (NFR-5).
- Should: diagnostics distinguish denied, non-asserted, non-allow-listed, unregistered, malformed policy, overlap, schema, floor, and drift.

**Files and modules**:

- `tests/checks/license-fixture.ts` (new helper)
- `tests/checks/license-audit-exit.test.ts` (new)

**System docs**:

- None.

**Tests**:

- `bun test tests/checks/license-audit-exit.test.ts` → 1 green + 9 failure spawns, determinism/diagnostics/performance green
- `git status --porcelain` → empty after the run

**Completion signal**: `test(GH-187): prove license audit exit and stream contract`

---

### Phase 4: CI bindingness, topology, and dependency-surface guards

**Goal**: Make gate weakening, a new job, or dependency drift fail by name, while the workflow itself stays untouched.

**Dependency rationale**: These are contract tests over `.github/workflows/ci.yml`, `TS_JOBS`, the aggregate chain, and repository diffs. They are independent of the audit internals but must run after the delivery surface is final so the diff assertions are meaningful.

**Tasks**:

- [ ] **4.1** Add `tests/checks/license-ci-binding.test.ts` implementing TC-LICREG-020: parse `.github/workflows/ci.yml`; assert the `ts-license-audit` job exists, its audit step is exactly `bun run scripts/checks/license-audit.ts`, it declares `permissions.contents: read`, it has no `timeout-minutes`, and it contains none of `continue-on-error`, `|| true`, `set +e`, `if: always()`, or an `exit 0` wrapper; extract the job block from `git show origin/main-tools:.github/workflows/ci.yml` and assert byte equality; assert `TS_JOBS` still contains `ts-license-audit` in declared order and the workflow job-id set equals `[...TS_JOBS, ...BASH_JOBS]`; assert `scanText(workflowText)` from `scripts/checks/ci-bindingness.ts` returns `[]`; assert `package.json` `scripts.check` is the pinned chain `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm check:boundaries && bun run scripts/checks/exports-parity.ts`.
- [ ] **4.2** In the same suite implement TC-LICREG-021: assert `validate(ROOT)` from `ci-topology.ts`, `ci-bindingness.ts`, `ci-supply-chain.ts`, and `script-surface.ts` each returns `[]`, and that the same four scripts exit 0 when invoked as `bun run ...` (matching `ts-invariants`/`ts-aggregate`).
- [ ] **4.3** In the same suite implement TC-LICREG-028: assert `git diff --name-only origin/main-tools...HEAD -- pnpm-lock.yaml`, `-- package.json`, and `-- 'packages/*/package.json'` are empty; assert the delivered root `devDependencies` key set equals the base key set; fail naming the missing ref when `origin/main-tools` is absent.
- [ ] **4.4** Run `bun test tests/checks/license-ci-binding.test.ts` and the four invariant scripts; confirm `.github/workflows/ci.yml` is byte-unchanged (`git diff --exit-code origin/main-tools...HEAD -- .github/workflows/ci.yml`). If an edit is ever unavoidable, it must be additions-only, must not touch existing job definitions, and the topology/bindingness/supply-chain/surface checks must be re-run.

**Acceptance Criteria**:

- Must: `ts-license-audit` is present, unmodified, binding, and not joined by any new job (AC-F5-1, NFR-4).
- Must: topology, bindingness, supply-chain, and script-surface invariants pass both as functions and as scripts (AC-F5-1).
- Must: zero lockfile, root-manifest, or package-manifest change; zero new dependency (NFR-3, CON-5).
- Should: a future bypass or dropped audit fails by job name and by assertion.

**Files and modules**:

- `tests/checks/license-ci-binding.test.ts` (new)
- `.github/workflows/ci.yml` (unchanged)
- `package.json` (unchanged)

**System docs**:

- None.

**Tests**:

- `bun test tests/checks/license-ci-binding.test.ts` → all pass
- `bun run scripts/checks/ci-topology.ts` → `OK ci-topology: ...`, exit 0
- `bun run scripts/checks/ci-bindingness.ts` → `OK ci-bindingness: ...`, exit 0
- `bun run scripts/checks/ci-supply-chain.ts` → exit 0
- `bun run scripts/checks/script-surface.ts` → exit 0
- `git diff --exit-code origin/main-tools...HEAD -- .github/workflows/ci.yml` → exit 0

**Completion signal**: `test(GH-187): guard license CI binding and dependency surface`

---

### Phase 5: Full suite verification and manual-review evidence

**Goal**: Run the complete battery, prove the change surface is exactly the registry, audit, and tests, and assemble the evidence TC-LICREG-030 needs.

**Dependency rationale**: The aggregate can only be trusted after Phases 2–4 are green together; diff assertions must run on the final tree.

**Tasks**:

- [ ] **5.1** Run `bun test tests/checks` and confirm the whole checks layer is green, including the title-preservation control from TC-LICREG-029 step 1 (`git show origin/main-tools:tests/checks/license-audit.test.ts` titles all present in the delivered file) and no `test.skip`/`only`.
- [ ] **5.2** Run the full gate battery: `pnpm check`, `bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh`, and the unchanged-tree invariants `bun run scripts/checks/pin-equality.ts`, `ci-supply-chain.ts`, and `vulnerability-gate.ts`; all green.
- [ ] **5.3** Audit the delivery surface: `git diff --exit-code origin/main-tools...HEAD -- pnpm-lock.yaml package.json 'packages/*/package.json' .github/workflows/ci.yml` must exit 0; `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude` must list only `scripts/checks/license-audit.ts`; `git status --porcelain` must be empty.
- [ ] **5.4** Assemble TC-LICREG-030 evidence for the PR: the five policy claims in the registry comments, the unchanged C-2 determination and the owner-confirmation request, the five-family match to ADR-0003 C-2, sample failure messages for each class, confirmation that no SBOM/notice/checksum/review-date artifact exists, and the planned required-check status of `ts-license-audit`.

**Acceptance Criteria**:

- Must: the extended suite and the whole repository battery are green, and no pre-existing test was removed or weakened (AC-F5-2, NFR-3, NFR-4).
- Must: the only changed script is `scripts/checks/license-audit.ts`; no lockfile, manifest, workflow, tool, agent, command, or generated plugin changed (NFR-3, CON-4, CON-5).
- Must: the worktree is clean after the battery.
- Should: the evidence pack answers every TC-LICREG-030 item before review starts.

**Files and modules**:

- None (verification only).

**System docs**:

- None.

**Tests**:

- `bun test tests/checks`
- `pnpm check`
- `bash scripts/.tests/test-*.sh`
- `bash tools/.tests/test-*.sh`
- `bun run scripts/checks/pin-equality.ts`
- `bun run scripts/checks/ci-supply-chain.ts`
- `bun run scripts/checks/vulnerability-gate.ts`
- `git diff --exit-code origin/main-tools...HEAD -- pnpm-lock.yaml package.json 'packages/*/package.json' .github/workflows/ci.yml`
- `git diff --name-only origin/main-tools...HEAD -- scripts tools .opencode .ados-claude`
- `git status --porcelain`

**Completion signal**: Evidence recorded in the PR draft; no commit in this phase.

---

### Phase 6: Documentation and system-spec synchronization (workflow phase 7 handoff)

**Goal**: Reconcile the current system truth with the delivered deny policy without editing `doc/spec/**` during delivery.

**Dependency rationale**: Documentation describes delivered behaviour, so it follows green delivery. This phase is executed by `@doc-syncer` in workflow phase 7, not by `@coder`; it is not part of the delivery commit.

**Tasks**:

- [ ] **6.1** In `doc/spec/features/feature-monorepo-scaffold-toolchain.md`, update the license-registry section to document `schema_version: 3`, the required `deny_list`, the five mandated families with the Appendix A floor, deny-before-allow precedence, the allow/deny disjointness rule, the single-identifier grammar `^[A-Za-z0-9.+-]+$`, the preserved `scope: direct-and-runtime-closure` check (CON-10), and the per-branch compound interpretation from spec Appendix C. Cite **TDR-0007** as the decision record for that interpretation. Do not restate unrelated monorepo content.
- [ ] **6.2** Confirm the policy still lives only in `doc/legal/dependency-licenses.yaml` (exactly one file in `doc/legal/`) and that no companion policy document, SBOM, notice, or checksum artifact was added.
- [ ] **6.3** Verify the reconciled document mentions `deny_list`, deny precedence, the scope check, and `TDR-0007` (`rg -n 'deny_list|deny.*allow|deny.*over|scope|TDR-0007' doc/spec/features/feature-monorepo-scaffold-toolchain.md`) and record the doc-sync result in the delivery record. If the system spec is code-adjacent enough to require an edit during delivery, escalate to `@pm` rather than editing it in a delivery commit.
- [ ] **6.4** Record TDR-0007's status and acceptance boundary in the system-spec update and doc-sync record: cite it by ID as **Proposed**; the owner accepts or rejects it at PR review. Do not write "accepted", do not mark it decided, and do not edit `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` during this change.
- [ ] **6.5** Note in the doc-sync record that an ADR-0003 C-2 editorial cross-reference (or amendment) is a **separate owner-authorized decision change**, not part of GH-187. If the owner requests it, raise it as its own change; do not bundle an ADR-0003 edit into this delivery or its doc-sync commit.

**Acceptance Criteria**:

- Must: the current system spec states the deny-list policy, precedence, floor, grammar, scope check, and compound interpretation, and references **TDR-0007 as Proposed** without claiming acceptance (spec §16, §18.1, GAP-5, OQ-T2).
- Must: the doc-sync record notes that an ADR-0003 C-2 editorial cross-reference is a separate owner-authorized change; no TDR-0007 or ADR-0003 file is edited in this change.
- Must: no companion policy file and no out-of-scope release artifact (CON-1, CON-7).
- Should: the wording does not contradict the tested behaviour.

**Files and modules**:

- `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (updated by `@doc-syncer` in workflow phase 7)
- `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` (unchanged; remains Proposed)
- `doc/decisions/ADR-0003-oss-monorepo-structure.md` (unchanged; any editorial cross-reference is a separate change)

**System docs**:

- `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (updated)
- `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` (referenced, not edited)

**Tests**:

- `rg -n 'deny_list|deny.*allow|deny.*over|scope|TDR-0007' doc/spec/features/feature-monorepo-scaffold-toolchain.md` → matches present
- `git diff --exit-code -- doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md doc/decisions/ADR-0003-oss-monorepo-structure.md` → exit 0 (neither decision record edited)
- `ls doc/legal` → exactly `dependency-licenses.yaml`

**Completion signal**: `docs(GH-187): reconcile license policy in system spec`

---

### Phase 7: Code review, manual policy sign-off, and conditional remediation

**Goal**: Obtain an independent review against the spec, plan, and repo rules; record the human policy judgement; remediate only real findings.

**Dependency rationale**: Review follows a green battery and complete evidence; remediation must not begin before the verdict is known.

**Tasks**:

- [ ] **7.1** Run the review (`/review GH-187` or `@reviewer`) against `chg-GH-187-spec.md`, this plan, the test plan, AC-F1-1..AC-F6-1, and `.ai/rules/typescript.md`/testing strategy. Record a PASS/FAIL verdict with findings.
- [ ] **7.2** Execute TC-LICREG-030 in the PR review record: confirm the five policy claims are clear and accurate; confirm the C-2 determination is unchanged and request owner confirmation; confirm the families match ADR-0003 C-2; sample failure messages for package/value/reason and absence of credentials/environment/unrelated content; confirm no release artifact; confirm `ts-license-audit` is the required check.
- [ ] **7.3** If the verdict is FAIL, apply only the accepted, in-scope fixes via `@coder`; do not expand scope, do not edit the registry alone, and re-run the affected Phase 2–5 suites after each fix.
- [ ] **7.4** Re-review after remediation and record the final verdict. No merge proceeds without PASS (or PASS_WITH_RISKS explicitly accepted by `@pm`).

**Acceptance Criteria**:

- Must: review verdict PASS or explicitly accepted PASS_WITH_RISKS; every finding resolved or recorded (all ACs).
- Must: TC-LICREG-030 items confirmed in the PR (AC-F1-4 quality clause, AC-F5-1 merge-blocking corroboration).
- Should: remediation commits stay within the registry/audit/tests surface.

**Files and modules**:

- Conditional: `scripts/checks/license-audit.ts`, `doc/legal/dependency-licenses.yaml`, `tests/**` only if a review finding requires it.

**System docs**:

- None in this phase.

**Tests**:

- Re-run `bun test tests/checks` and any suite touched by remediation.
- Record the review verdict and TC-LICREG-030 checklist in the PR.

**Completion signal**: Review verdict recorded; no code commit unless remediation was required.

---

### Phase 8: Finalize and release

**Goal**: Close the change with correct versioning, an atomic commit set, every predicate in the spec's change-specific Definition of Done (§18.1) satisfied, and a PR targeting `main-tools`.

**Dependency rationale**: Finalization requires review PASS and a green battery; PR creation is last.

**Tasks**:

- [ ] **8.1** Apply repo versioning: `version_impact: none` means no package version bump, no `.changeset/` entry, no changelog, and no release artifact. Release-time SBOM/checksum/notice artifacts remain **M4-S2**; registry completeness and public materials remain **M4-S3**. The registry `schema_version` 2 → 3 is a data-contract bump only. Record this rationale in the PR.
- [ ] **8.2** Run the final battery once more on the exact PR head: `bun test tests/checks`, `pnpm check`, the inherited bash suites, the four invariant scripts, and `git status --porcelain` empty.
- [ ] **8.3** Verify atomic delivery against the spec §18.1 Definition of Done predicates: the registry v3 and the audit v3 are in the same commit set / same PR; no commit leaves the v3 registry with a v2-only audit or vice versa; every plan task is checked; the **31-TC** AC/TC traceability matrix is complete; AC-F1-3's wrong-scope extension is proven by TC-LICREG-031; TDR-0007 is cited as Proposed and no acceptance is claimed; no out-of-scope file changed.
- [ ] **8.4** Create the PR via `@pr-manager` targeting `main-tools`, with the GH-187 change artifacts, the evidence pack, the TC-LICREG-030 record, the owner's TDR-0007 decision, and the required `ts-license-audit` check. Assign the human reviewer and record the PR URL. Do not merge.

**Acceptance Criteria**:

- Must: no version bump, no changeset, no release artifact (version_impact none, NG-1, CON-7; release-time artifacts stay with M4-S2 and registry completeness/public materials with M4-S3).
- Must: every spec §18.1 Definition of Done predicate is satisfied, including all 15 ACs' traceable passing evidence, the live registry at schema v3 with `scope: direct-and-runtime-closure`, AC-F1-3's wrong-scope extension (TC-LICREG-031), the 18-malformed and 10-spawned matrices, the preserved compound, the unchanged surface, and the atomic 31-TC change set.
- Must: TDR-0007 remains Proposed, is referenced by the system spec, and the owner's acceptance decision is recorded at PR review; no ADR-0003 or TDR-0007 file is edited in this change.
- Must: the PR targets `main-tools` and carries the required `ts-license-audit` check.
- Should: the PR description states the no-change assertions (lockfile, manifests, CI job, gate bindingness).

**Files and modules**:

- None (release operations only).

**System docs**:

- None.

**Tests**:

- Final run of the Phase 5 command set.
- `git log --oneline origin/main-tools..HEAD` review for atomicity.
- the created PR's status check rollup (`gh pr view --json statusCheckRollup`) confirms `ts-license-audit` is required/green.

**Completion signal**: PR opened against `main-tools`; `ts-license-audit` required; change awaiting human review.

---

## Test Scenarios

| TC ID | Scenario | Phase | AC coverage |
|-------|----------|-------|-------------|
| TC-LICREG-001 | Registry declares the schema-v3 policy artifact in one file | 2 | AC-F1-1, DM-1, DM-2, DM-3, DM-5 |
| TC-LICREG-002 | Five families and the full Appendix A baseline are denied | 2 | AC-F1-2, DM-2, DM-5 |
| TC-LICREG-003 | Existing entries, uses, verdicts, and allow list are preserved | 2 | AC-F1-1, DM-3, DM-4, CON-6 |
| TC-LICREG-004 | Old, absent, or unsupported schema version fails closed | 2 | AC-F1-3, DM-1 |
| TC-LICREG-005 | Human-readable policy notes state the five claims | 2 | AC-F1-4, DM-5 |
| TC-LICREG-006 | Every mandated denied identifier fails with explicit denial | 2 | AC-F2-1, NFR-1 |
| TC-LICREG-007 | Deny wins over allow for an allow-listed, approved identifier | 2 | AC-F2-2, NFR-1 |
| TC-LICREG-008 | Allow/deny overlap is a registry policy failure on its own | 2 | AC-F2-2, AC-F3-2 |
| TC-LICREG-009 | A denied branch fails in OR, AND, and nested expressions | 2 | AC-F2-3 |
| TC-LICREG-010 | Denial is attributed per branch and names only denied branches | 2 | AC-F2-1, AC-F2-3, NFR-6 |
| TC-LICREG-011 | Missing, non-array, or empty deny list fails closed | 2 | AC-F3-1 |
| TC-LICREG-012 | Malformed, empty, duplicate, compound, padded entries fail closed | 2 | AC-F3-2 |
| TC-LICREG-013 | Removing any Appendix A identifier fails closed | 2 | AC-F1-2, AC-F3-3 |
| TC-LICREG-014 | Extra deny identifiers work without a code change; no prefix matching | 2 | AC-F2-1, AC-F1-2 |
| TC-LICREG-015 | Unregistered dependency and unregistered use fail closed | 2 | AC-F4-1, DM-4 |
| TC-LICREG-016 | Empty, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, unparseable fail closed | 2 | AC-F4-2 |
| TC-LICREG-017 | Valid but non-allow-listed identifiers fail closed | 2 | AC-F4-2 |
| TC-LICREG-018 | The live `@biomejs/biome` `MIT OR Apache-2.0` entry passes | 2 | AC-F6-1 |
| TC-LICREG-019 | Blanket compound rejection was not introduced | 2 | AC-F6-1, NG-4 |
| TC-LICREG-020 | `ts-license-audit` is present, unmodified, binding, no new job | 4 | AC-F5-1, NFR-4 |
| TC-LICREG-021 | CI topology, bindingness, supply-chain, surface invariants green | 4 | AC-F5-1, NFR-4 |
| TC-LICREG-022 | Spawned audit exits non-zero with clean diagnostics per class | 3 | AC-F2-1, AC-F2-3, AC-F3-1, AC-F3-3, AC-F4-1, AC-F4-2, AC-F5-1, NFR-1, NFR-6 |
| TC-LICREG-023 | Live registry validates with zero failures; closure preserved | 2 | AC-F5-2, AC-F6-1, DM-3, DM-4 |
| TC-LICREG-024 | The matrix is complete, registered, and non-vacuous | 2 | AC-F5-2, AC-F1-2, NFR-1 |
| TC-LICREG-025 | Audit behaviour is deterministic, order-independent, offline | 3 | NFR-2 |
| TC-LICREG-026 | Every failure is diagnosable and classes stay distinguishable | 3 | NFR-6, AC-F2-1, AC-F4-1, AC-F4-2 |
| TC-LICREG-027 | Live audit completes within the 30-second bound | 3 | NFR-5 |
| TC-LICREG-028 | No new dependency and no lockfile or manifest change | 4 | NFR-3, CON-5 |
| TC-LICREG-029 | Pre-existing matrix and repository gate battery unchanged/green | 5 | AC-F5-1, AC-F5-2, NFR-3, NFR-4 |
| TC-LICREG-030 | Manual policy and diagnostic review | 7 | AC-F1-4, AC-F5-1 |
| TC-LICREG-031 | Schema-v3 registry with a wrong scope fails closed and reports the observed scope | 2 | AC-F1-3, DM-1, CON-10 |

### Task-to-AC/TC traceability

| Task | AC | TC |
|------|----|----|
| 1.1 | AC-F1-1, AC-F1-2, AC-F1-4 | TC-LICREG-001, 002, 005 |
| 1.2 | AC-F1-3, AC-F2-2 (registry level), AC-F3-1, AC-F3-2, AC-F3-3, CON-10 | TC-LICREG-004, 007, 008, 011, 012, 013, 024, 031 |
| 1.3 | AC-F2-1, AC-F2-2, AC-F2-3, AC-F4-2, AC-F6-1 | TC-LICREG-006, 009, 010, 016, 017, 018, 019 |
| 1.4 | AC-F5-2 (partial), NFR-3, NFR-4, NFR-6 | TC-LICREG-023 (partial), 028 (partial) |
| 2.1 | AC-F1-2, AC-F3-2, AC-F5-2 | TC-LICREG-002, 009, 012, 013, 016, 024 |
| 2.2 | AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-4, AC-F2-2, AC-F3-1, AC-F3-2, AC-F3-3, CON-10 | TC-LICREG-001, 002, 003, 004, 005, 007, 008, 011, 012, 013, 024, 031 |
| 2.3 | AC-F2-1, AC-F2-3, AC-F4-1, AC-F4-2, AC-F5-2, AC-F6-1 | TC-LICREG-006, 009, 010, 014, 015, 016, 017, 018, 019, 023 |
| 2.4 | AC-F5-2, AC-F1-3 | TC-LICREG-001..019, 023, 024, 031 |
| 3.1 | AC-F5-1, NFR-6 | TC-LICREG-022, 025, 026, 027 |
| 3.2 | AC-F2-1, AC-F2-3, AC-F3-1, AC-F3-3, AC-F4-1, AC-F4-2, AC-F5-1 | TC-LICREG-022 |
| 3.3 | NFR-1, NFR-2, NFR-5, NFR-6 | TC-LICREG-025, 026, 027 |
| 3.4 | AC-F5-2, NFR-1 | TC-LICREG-022, 025, 026, 027 |
| 4.1 | AC-F5-1, NFR-4 | TC-LICREG-020 |
| 4.2 | AC-F5-1, NFR-4 | TC-LICREG-021 |
| 4.3 | NFR-3, CON-5 | TC-LICREG-028 |
| 4.4 | AC-F5-1, NFR-3, NFR-4 | TC-LICREG-020, 021, 028 |
| 5.1 | AC-F5-2, NFR-3, NFR-4 | TC-LICREG-029 |
| 5.2 | AC-F5-2, NFR-3, NFR-4 | TC-LICREG-029 |
| 5.3 | NFR-3, CON-4, CON-5 | TC-LICREG-028, 029 |
| 5.4 | AC-F1-4, AC-F5-1 | TC-LICREG-030 |
| 6.1 | Spec §16, §18.1, GAP-5, OQ-T2, TDR-0007 | (documentation check, no AC-bound TC) |
| 6.2 | CON-1, CON-7 | TC-LICREG-001 (single-file) |
| 6.3 | Spec §16, §18.1 | (documentation check) |
| 6.4 | Spec §18.1 (decision-capture predicate) | (documentation check, no AC-bound TC) |
| 6.5 | Spec §18.1 (decision-capture boundary) | (documentation check, no AC-bound TC) |
| 7.1 | All ACs | All TCs |
| 7.2 | AC-F1-4, AC-F5-1 | TC-LICREG-030 |
| 7.3 | All ACs | Affected TCs |
| 7.4 | All ACs | All TCs |
| 8.1 | version_impact none, NG-1, CON-7 | TC-LICREG-028 |
| 8.2 | AC-F5-2, NFR-3, NFR-4 | TC-LICREG-029 |
| 8.3 | All 15 ACs, CON-10, spec §18.1 | All 31 TCs (including TC-LICREG-031) |
| 8.4 | AC-F5-1, spec §18.1 (TDR-0007 decision) | TC-LICREG-020, 030 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-187-spec.md` | Spec (input) |
| Test plan | `./chg-GH-187-test-plan.md` | Test plan (input) |
| Implementation plan | `./chg-GH-187-plan.md` | Plan (this file) |
| License registry | `doc/legal/dependency-licenses.yaml` | Data (updated, schema v3) |
| License audit | `scripts/checks/license-audit.ts` | Check (updated) |
| Existing audit suite | `tests/checks/license-audit.test.ts` | Test (extended) |
| Registry-policy suite | `tests/checks/license-policy.test.ts` | Test (new) |
| Spawned exit/stream suite | `tests/checks/license-audit-exit.test.ts` | Test (new) |
| Temp-tree helper | `tests/checks/license-fixture.ts` | Test helper (new) |
| CI binding suite | `tests/checks/license-ci-binding.test.ts` | Test (new) |
| License-text cases | `tests/fixtures/license/cases.json` | Fixture (extended) |
| Appendix A baseline fixture | `tests/fixtures/license/deny-baseline.json` | Fixture (new) |
| Deny-list mutation matrix | `tests/fixtures/license/deny-list-cases.json` | Fixture (new) |
| CI workflow | `.github/workflows/ci.yml` | Unchanged |
| CI topology/bindingness/supply-chain/script-surface checks | `scripts/checks/*.ts` | Unchanged |
| Lockfile and manifests | `pnpm-lock.yaml`, `package.json`, `packages/*/package.json` | Unchanged |
| System specification | `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Doc (Phase 6, `@doc-syncer`) |
| TDR-0007 compound interpretation | `doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md` | Decision (reference; remains Proposed, not edited) |
| ADR-0003 C-2 | `doc/decisions/ADR-0003-oss-monorepo-structure.md` | Decision (reference; not edited) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @plan-writer | Initial plan: 8 phases, 31 tasks, registry/audit atomic core, in-process and spawned test matrices, CI binding guards, full battery, doc-sync handoff, review/remediation, and release finalization; full AC/TC traceability and Appendix A baseline included. |
| 1.1 | 2026-10-31 | @plan-writer | Corrected the live registry entry count from 15 to 16 (four-entry `allow_list` unchanged); recorded TP-ISSUE-1/2/3 as RESOLVED by test plan v1.1 and spec v1.1 (18 malformed cases, 10 spawned cases, in-process coverage for four classes, `^[A-Za-z0-9.+-]+$` grammar); updated RSK-P2 and task 3.2 to the resolved binding. No scope, phase, task-ID, or AC/TC mapping changes. |
| 1.2 | 2026-10-31 | @plan-writer | DoR iteration 1 remediation (`readiness-review/readiness-iter-1.md`, findings 2, 3, 7, 8, 9, 10). (A) Pre-existing audit test count corrected from 12 to 13 in Phase 1/2 tasks and evidence, with TC-LICREG-029 step 1's dynamic base-branch title check named as the authority. (B) Phase 6 now reconciles the system spec and cites TDR-0007 as Proposed, records the TDR acceptance boundary, and notes that an ADR-0003 C-2 editorial cross-reference is a separate owner-authorized change (new tasks 6.4 and 6.5). (C) Preserved the schema-v3 `scope: direct-and-runtime-closure` fail-closed check in tasks 1.2/1.3 and Phase 1 acceptance; added TC-LICREG-031 to task mappings and the Test Scenarios/matrix (31/31 TCs). (D) Corrected SBOM/checksum/notice ownership to M4-S2 for release-time artifacts and M4-S3 for registry completeness/public materials, citing GH-187's supersession of GH-170 DEC-10. (E) Updated citations to test plan v1.3 and spec v1.2, recorded OQ-T1/OQ-T2 as resolved and OQ-T3/OQ-T4 as non-blocking. (F) Reworded task 1.1's deny-list requirement to at least the 20 baseline identifiers with additional valid identifiers permitted. (G) Phase 8 now references spec §18.1's Definition of Done predicates, AC-F1-3's wrong-scope extension, and the 31-TC matrix instead of an undefined checklist. Phases remain 8; existing task IDs are unchanged, tasks 6.4-6.5 are added (31→33 tasks). |
| 1.3 | 2026-10-31 | @plan-writer | DoR iteration 2 remediation (`readiness-review/readiness-iter-2.md`, blocking finding 1 and nit 6). Aligned the removal-case matrix with test plan v1.3: task 2.1's fixture class is **floor 25 (20 single removals + 5 adversarial removals)**, task 2.2 states 25 removal cases, and Phase 2 acceptance requires **25/25 removal cases (20 single + 5 adversarial)** while the 20-identifier Appendix A baseline stays distinct. RSK-P2 now cites test plan **v1.3**. No phase, task-ID, or AC/TC mapping changes. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Pending | — | — | — | Registry and audit must land in one commit set. |
| 2 | Pending | — | — | — | — |
| 3 | Pending | — | — | — | — |
| 4 | Pending | — | — | — | — |
| 5 | Pending | — | — | — | — |
| 6 | Pending | — | — | — | Workflow phase 7 (`@doc-syncer`), not delivery. |
| 7 | Pending | — | — | — | — |
| 8 | Pending | — | — | — | — |
