---
id: chg-GH-406-test-plan
status: Proposed
created: 2026-11-24
last_updated: 2026-11-24
owners: [Juliusz Ćwiąkalski]
service: delivery vocabulary and project-scope contracts (ubiquitous language, declared project key grammar, clone identity)
labels: [change, m4, vocabulary, docs, cli, config]
version_impact: minor
summary: "Verification strategy for M4-S39 delivery vocabulary: the eight-term vocabulary table in the overview docs with the two reversed sentences corrected, the additive declared-project-key contract (grammar plus reserved-segment refusal), the named clone-key pattern with the PROJECT_KEY_PATTERN same-value alias, the served cloneKey accessor, corrected user-facing nouns with the --flat alias byte-identical, the narrowed conformance test proven by planted synthetic violations, the new-code naming rule with a reason-bearing committed baseline, fixtures G-1..G-3 (worktree identity sharing, per-clone state roots, unchanged legacy load), ODR-0006 as Proposed, and wording-only pin-surface updates under the zero-rename invariant."
links:
  change_spec: ./chg-GH-406-spec.md
  implementation_plan: ./chg-GH-406-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S39: Delivery vocabulary — project, project repository, main checkout, worktree, lane; credentials bind to the project's declared key (M4)

## 1. Scope and Objectives

This change is a **mixed documentation + TypeScript workspace change with no rename and no migration**: it establishes the owner's eight-term delivery vocabulary in the system spec overview documents, adds the declared-project-key and clone-key contracts purely additively, serves a `cloneKey` accessor on the resolved project scope, corrects user-facing nouns in list headers, help and reference text, enforces the vocabulary with a narrowed conformance test and a new-code naming rule held by a reason-bearing committed baseline, proves identity semantics with three git-linked fixtures, records ODR-0006 as `Proposed`, and updates the pre-existing pin surfaces wording-only.

The core behaviors to protect are, in descending risk order: **byte-identity of the `--flat` alias** (payload and text 0-byte delta against the pre-change output — the delivered flat consumers must not see drift, NFR-3/RSK-2); **the zero-rename invariant** (0 renamed command names, payload fields or persisted fields; every pre-existing contract suite passes with wording-only updates, NFR-5/AC-F10-1/RSK-1); **alias fidelity of the pattern exports** (`PROJECT_KEY_PATTERN` resolves to the identical value as `CLONE_KEY_PATTERN`, NFR-2); **legacy configuration tolerance** (a group key outside the declared-key grammar keeps loading with no migration — the local `groups.v1` layer keeps its no-public-pattern contract, G-3/NFR-5/DEC-4); **conformance precision** (the narrowed test passes on the clean tree and fails on a planted violation inside its declared scope while honouring the four named exceptions — over-matching floods on identifiers that stay until GH-408, under-matching misses the surfaces that matter, NFR-4/RSK-3); and **grammar precision** (the declared-key pattern accepts exactly 2–64 lowercase alphanumerics and hyphens with no leading/trailing hyphen and refuses the reserved state segments `unbound` and `projects`, NFR-1). The motivating regressions are: a vocabulary sweep that silently changes the flat alias bytes; a "wording-only" pin update that smuggles in a field rename; a declared-key grammar that rejects a legitimate key or admits a reserved segment; and a conformance check that passes on broken text because its negative proof was never exercised.

### 1.1 In Scope

- Vocabulary documentation: the eight-term table (project, project repository, main checkout, worktree, lane, work item, clone identity, declared project key) with meanings and lifetimes in `doc/overview/ubiquitous-language.md` and `doc/overview/glossary.md`; the two reversed sentences ("a repository is one checkout and the delivery unit", "the identifier `project key` keeps its repository meaning") gone; both feature specs (`feature-projects.md`, `feature-project-groups.md`) linking the table and no longer stating that a repository is one checkout; the glossary's distinct "Repository key" (`host/owner/name`) concept retained (NG-7) (AC-F1-1).
- Declared-project-key contract: `DECLARED_PROJECT_KEY_PATTERN` (`^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$`) exported with its predicate, unit-tested across the full grammar boundary matrix and the reserved-segment refusals `unbound` and `projects` (AC-F2-1, NFR-1, DM-1).
- Clone-key pattern name: `CLONE_KEY_PATTERN` exported and unit-tested; `PROJECT_KEY_PATTERN` still resolves to the identical value (AC-F3-1, NFR-2, DM-2).
- Served accessor: the resolved project scope serves `cloneKey`; no persisted name (marker field, host-index field, `--flat` alias payload) changes (AC-F4-1, DM-3).
- User-facing nouns: `projects list` headers `PROJECT` / `PROJECT REPOSITORY`; `repos list` header `CLONE`; help and reference text using the table's nouns; `board --project` help stating it takes a clone identity; "primary checkout" wording absent within the conformance scope; `--flat` alias payload and text byte-identical (AC-F5-1, NFR-3).
- Narrowed conformance test: scope per Appendix B (CLI help summaries; text headers of `projects list` and `repos list`; guides tree; tools documentation tree; overview tree; every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` — all milestones' command pages, 42 at this change's base: m1 28, m2 12, m4 2), named exceptions honoured (`projects.*` error codes, `<host root>/projects/` container, `--project-root`, `--flat` alias), passes on the clean tree, fails non-zero on a planted violation proven via synthetic test-owned inputs (AC-F6-1, NFR-4). The three m2 pages (`repos`, `projects`, `board`) are pin surfaces inside this scope (brief §F), a subset of the sweep, never its definition. Known in-scope violation fixed in-change: `doc/planning/oss-tooling/milestones/m4/commands/install.md:84` reads "primary checkout" (banned by brief §D) — the sweep passes clean only after that wording becomes "main checkout".
- New-code naming rule: repository check that files absent at this change's base (22b15d31) contain no bare `projectKey` token; committed reason-bearing baseline; no per-file counts on existing files; the check itself mutation-tested (AC-F7-1, NFR-6).
- Fixtures: G-1 (linked worktree resolves the main checkout's clone identity), G-2 (two clones of one project repository resolve the same declared project key with different state roots), G-3 (existing configuration with an out-of-grammar group key loads unchanged, no migration) — deterministic on a single worker host (AC-F8-1/2/3, NFR-7).
- ODR-0006: exists with `status: Proposed` and `decision_date: null`, listed in the decision index; earlier decision records untouched (AC-F9-1).
- Pin surfaces, wording-only: `tests/structure/content-inventory.test.ts` (new exports added additively), `tests/structure/naming-boundary.test.ts` (TC-GRPBOUND-002, TC-GRPSREAD-003 — old wording refreshed, intent intact), `tests/behaviour/repos-list-contract.test.ts`, `tests/behaviour/projects-list-contract.test.ts`, `tests/behaviour/projects-flat-alias.test.ts` (header pins only; payload assertions unchanged), help suites that pin help summaries, and the three m2 command-reference pages (`repos`, `projects`, `board`) (AC-F10-1, NFR-5).
- Quality gate: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens.

### 1.2 Out of Scope & Known Gaps

- **No mechanical rename is tested into existence** (NG-1, DEC-2): the `repos` family, `repoKey`, `projectKey`, the `--project` dual meaning and the four named exceptions are asserted to *survive*, not to change. Their rename belongs to GH-408 and is untestable here.
- **No credential mechanism, store, profile or binding fixtures** (NG-2): the declared-key *enforcement points* are created by GH-396/GH-397/GH-399 and GH-401 (manifest write/import); this plan tests only the contract they will enforce (pattern, predicate, alias, accessor), not any consumer enforcement.
- **No per-level progress surfaces** (NG-3): lanes in worktrees, per-lane leases and main-checkout pinning (GH-404) and the planning horizon / project aggregate (GH-407) are vocabulary consumers only; the `dispatch.lane` record referenced by the lane definition is asserted unchanged, never extended.
- **No migration tests beyond G-3's refusal to migrate** (NG-4): no schema change exists; grammar enforcement in the local `groups.v1` layer is asserted *absent* (G-3), never implemented.
- **No amendment of any earlier decision record** (NG-5): ODR-0006's reading of ODR-0003 DC-4 and ODR-0004 C-2..C-5 is a documentation property checked at structure/review level, not a behaviour suite.
- **No MCP surface change is claimed by any AC** (spec §16 lists no MCP component): the existing projects MCP suites are not primary targets; if their wording pins trip on the sweep, they are updated under the TC-DPKPIN-001 wording-only discipline. No new MCP assertion is added.
- **Git behaviour is a dependency, not a surface** (spec §8.4): fixtures rely on git's linked-worktree layout; no git behaviour is asserted beyond the marker-sharing fact fixture G-1 verifies on the reference host.
- **"No earlier decision record was edited" cannot be a permanent suite** (testing-strategy rule: suites assert tree/HEAD properties, never a moving-base diff): the automated half of AC-F9-1 checks ODR-0006's existence, status and index row; the unedited-earlier-records half is a review-time diff inspection logged under TC-DPKODR-001.
- **The zero-rename and wording-only properties are likewise review-time** (same rule): TC-DPKPIN-002 inspects the delivery diff; the automated half is the pre-existing suites passing with their payload assertions untouched.
- **NFR-7 (fixture determinism) is a property of the fixture suites, not a separate scenario**: TC-DPKFIX-001/002/003 carry it (temp trees under the session-scoped temp root, no network, no wall-clock or hostname dependence); gate evidence records the repeat runs.
- **DoD/lifecycle evidence (commit hygiene, PR posture) is not a TC**: owned by the phase 9 commit-message range gate and phase 11 PR record, recorded in pm-notes.

## 2. References

- Change specification: `./chg-GH-406-spec.md` — ACs AC-F1-1…AC-F10-1 (§17); F-1…F-10 (§5); DM-1…DM-3 (§8.3); NFR-1…NFR-7 (§9); G-1…G-7 (§4); NG-1…NG-7 (§4.2); RSK-1…RSK-6 (§11); DEC-1…DEC-5 (§15); Appendix A (mapping of locked names), Appendix B (conformance scope and named exceptions), Appendix C (fixtures), Appendix D (sources).
- Implementation plan: `./chg-GH-406-plan.yaml` — exists and binds (validated `verdict=valid`, tier `full`, 8 phases; the four constraints below are adopted verbatim). This plan constrains it: the plan must (a) pin the exact new test-suite file names (Section 7 proposes homes); (b) sequence the wording-only pin updates so the tree stays green at each phase boundary (spec §18); (c) land the committed naming-rule baseline with reasons in the same phase as the check; (d) keep `--flat` byte-identity verification inside the phase that touches the header code.
- Testing strategy: `.ai/rules/testing-strategy.md` (bun:test under `tests/**/*.test.ts`; structure suites under `tests/structure/`, behaviour suites under `tests/behaviour/`; repository invariants `bun run scripts/checks/*.ts` mutation-tested under `tests/checks/**`; invariant-test authoring — assert tree/HEAD properties, never a moving-base diff; goldens updated deliberately with an explicit command; aggregate gate `pnpm check`).
- TypeScript rules: `.ai/rules/typescript.md` (bun:test authoring, injected fakes, deterministic tests, no ambient `$HOME`).
- PM notes: `./chg-GH-406-pm-notes.yaml` — authoritative source order (brief comment 7122871259 wins; rename superseded), clarify-scope cross-check at base 22b15d31, phase 7 documentation impacts, ODR-0006 reservation.
- Governing records: `doc/decisions/ODR-0003-*` (DC-4 command-naming v1 lock), `doc/decisions/ODR-0004-*` (C-2..C-5 flat record set) — hold without amendment; ODR-0006 lands with this change as `Proposed`.
- Delivered baseline contracts: current-truth `doc/spec/features/feature-projects.md` and `doc/spec/features/feature-project-groups.md` (flat surface, `projects.*` identities, `unbound` scope, the no-public-pattern contract for group keys) — the pre-change truth the alias must preserve byte-for-byte and G-3 must keep loading.
- Vocabulary targets: `doc/overview/ubiquitous-language.md` (the two reversed sentences live near lines 62–68 per pm-notes), `doc/overview/glossary.md`, reference pages `doc/planning/oss-tooling/milestones/m2/commands/repos.md`, `projects.md`, `board.md`.
- Existing suite precedent: `tests/structure/naming-boundary.test.ts` (content checks over docs as tree invariants — the pattern for the vocabulary and conformance suites; TC-GRPBOUND-*/TC-GRPSREAD-* IDs belong to GH-309 and are not reused), `tests/behaviour/projects-flat-alias.test.ts` (byte-compat pin), `tests/behaviour/repos-list-contract.test.ts` / `tests/behaviour/projects-list-contract.test.ts` (header pins), `tests/structure/content-inventory.test.ts` (export inventory), fixture helpers `tests/fixtures/projects/` (temp git repositories, host fixtures, identity markers, host-index readers).

## 3. Coverage Overview

Every one of the twelve §17 acceptance criteria is covered; no AC is left as TODO. Every NFR-1…NFR-7 has a verification method. Spec §14 records no open questions, and this plan raises none that block delivery.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Eight-term vocabulary table in both overview docs; two reversed sentences corrected; both feature specs link the table | TC-DPKVOC-001, TC-DPKVOC-002 | Covered |
| AC-F5-1 | Headers `PROJECT`/`PROJECT REPOSITORY`/`CLONE`; help/reference nouns corrected; `--flat` byte-identical | TC-DPKUI-001, TC-DPKUI-002, TC-DPKUI-003 | Covered |
| AC-F6-1 | Conformance passes on clean tree; fails on planted violation; exceptions honoured | TC-DPKCONF-001, TC-DPKCONF-002, TC-DPKCONF-003 | Covered |
| AC-F2-1 | `DECLARED_PROJECT_KEY_PATTERN` exported; grammar and reserved-segment refusals unit-tested | TC-DPKKEY-001, TC-DPKKEY-002 | Covered |
| AC-F3-1 | `CLONE_KEY_PATTERN` exported and unit-tested; `PROJECT_KEY_PATTERN` resolves to the same value | TC-DPKALI-001 | Covered |
| AC-F4-1 | Served `cloneKey` accessor returns the clone identity; persisted names unchanged | TC-DPKACC-001 | Covered |
| AC-F7-1 | No post-base file contains bare `projectKey`; baseline reasons; no per-file counts on existing files | TC-DPKNAM-001, TC-DPKNAM-002 | Covered |
| AC-F8-1 | Linked worktree resolves main checkout's clone identity (G-1) | TC-DPKFIX-001 | Covered |
| AC-F8-2 | Two clones resolve same declared key, different state roots (G-2) | TC-DPKFIX-002 | Covered |
| AC-F8-3 | Out-of-grammar configuration loads unchanged, no migration (G-3) | TC-DPKFIX-003 | Covered |
| AC-F9-1 | ODR-0006 `Proposed`/`decision_date: null`, indexed; earlier records unedited | TC-DPKODR-001 | Covered |
| AC-F10-1 | Nothing renamed; pinned suites pass wording-only | TC-DPKPIN-001, TC-DPKPIN-002 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP/API or event interfaces exist in this change (spec §8.1/§8.2: N/A — no new events; `dispatch.lane` unchanged). Data-model surfaces:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Declared project key (grammar `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$`; reserved segments refused; disjoint from the clone identity; `groupKey` locally / `project.key` in the GH-401 manifest) | TC-DPKKEY-001, TC-DPKKEY-002, TC-DPKFIX-002 | Covered |
| DM-2 | Clone key pattern (`CLONE_KEY_PATTERN`; `PROJECT_KEY_PATTERN` same-value alias) | TC-DPKALI-001 | Covered |
| DM-3 | Served `cloneKey` on the resolved project scope (read-only; persisted names unchanged) | TC-DPKACC-001, TC-DPKFIX-001 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Declared-key grammar precision (2–64, lowercase alnum + hyphens, no edge hyphen; refuses `unbound`, `projects`; every rule unit-tested) | TC-DPKKEY-001, TC-DPKKEY-002 | Covered |
| NFR-2 | Alias fidelity: `PROJECT_KEY_PATTERN` ≡ `CLONE_KEY_PATTERN` (0 difference) | TC-DPKALI-001 | Covered |
| NFR-3 | `--flat` payload and text byte-identical to pre-change output (0-byte delta) | TC-DPKUI-003 | Covered |
| NFR-4 | Conformance passes on clean tree, fails non-zero on planted violation | TC-DPKCONF-001, TC-DPKCONF-002, TC-DPKCONF-003 | Covered |
| NFR-5 | Zero-rename invariant; contract suites pass wording-only | TC-DPKPIN-001, TC-DPKPIN-002, TC-DPKFIX-003 | Covered |
| NFR-6 | Baseline discipline: every entry carries a reason; no per-file counts on existing files | TC-DPKNAM-001, TC-DPKNAM-002 | Covered |
| NFR-7 | Fixtures G-1..G-3 reproducible on a single worker host | TC-DPKFIX-001, TC-DPKFIX-002, TC-DPKFIX-003 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a mixed change: TypeScript workspace contracts and CLI wording (primary: bun:test structure + behaviour suites, plus one repository invariant check with mutation tests), documentation content (structure-suite tree invariants + manual content review), and the aggregate gate.

- **Structure suites (bun:test, `tests/structure/`)**: exported-contract units (pattern values, predicate boundary matrix, alias identity, accessor read), tree invariants over documentation content (vocabulary table, reversed sentences, feature-spec links, ODR-0006 status/index), the vocabulary conformance scanner with its synthetic negative proofs, and the wording-only pin updates (`content-inventory`, `naming-boundary`). Precedent: `naming-boundary.test.ts` checks document content as a permanent tree invariant; `queue-scheduling-contract.test.ts` pins exported closed sets.
- **Behaviour suites (bun:test, `tests/behaviour/`)**: CLI surfaces through the production harness with fixture git repositories — list headers, help nouns, `--flat` byte-identity, the served accessor on the resolved scope, fixtures G-1..G-3 using the `tests/fixtures/projects/` helpers (temp repositories, host fixtures, identity markers, host-index readers). Daemon/networked behaviour is not exercised.
- **Repository invariant check (TypeScript, `scripts/checks/`)**: the new-code naming rule (`bun run scripts/checks/<check>.ts` must exit non-zero and name the offending file/entry), mutation-tested under `tests/checks/**` per the module-to-test mapping. The check reads a committed reason-bearing baseline; "this change's base" is encoded as a committed constant (22b15d31, per pm-notes), so the suite asserts tree/HEAD properties against a pinned base — legal under the no-moving-base rule.
- **Review-time/manual layer**: zero-rename diff inspection and the wording-only diff discipline (TC-DPKPIN-001/002), the earlier-records-untouched inspection (TC-DPKODR-001), and documentation content review (headings, links, rendering) per the testing strategy's content-check layer for docs. These exist because permanent suites may not assert branch diffs; each is executed once at the delivery gate and logged in Section 10.
- **Aggregate gate (no new code)**: `TMPDIR=$PWD/tmp/tmpdir pnpm check` = lint → format:check → typecheck → test → boundaries, per the testing strategy and repo gate conventions. Narrow suites (`bun test <path>`) during iteration.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-DPKVOC-001 | Vocabulary table present in both overview docs | Regression | Structure | High | AC-F1-1 |
| TC-DPKVOC-002 | Reversed sentences corrected; feature specs link the table | Regression | Structure | High | AC-F1-1 |
| TC-DPKKEY-001 | Declared-key grammar boundary matrix | Edge Case | Structure (unit) | High | AC-F2-1, NFR-1 |
| TC-DPKKEY-002 | Reserved segments `unbound` and `projects` refused | Negative | Structure (unit) | High | AC-F2-1, NFR-1 |
| TC-DPKALI-001 | `CLONE_KEY_PATTERN` exported; `PROJECT_KEY_PATTERN` same-value alias | Regression | Structure (unit) | High | AC-F3-1, NFR-2 |
| TC-DPKACC-001 | Served `cloneKey` accessor; persisted names unchanged | Happy Path | Structure + Behaviour | High | AC-F4-1, DM-3 |
| TC-DPKUI-001 | List headers `PROJECT` / `PROJECT REPOSITORY` / `CLONE` | Regression | Behaviour (contract) | High | AC-F5-1 |
| TC-DPKUI-002 | Help and reference nouns; board help states clone identity | Regression | Structure + Behaviour | Medium | AC-F5-1 |
| TC-DPKUI-003 | `--flat` alias payload and text byte-identical | Regression | Behaviour (contract) | Critical | AC-F5-1, NFR-3 |
| TC-DPKCONF-001 | Conformance passes on the clean tree | Happy Path | Structure | High | AC-F6-1, NFR-4 |
| TC-DPKCONF-002 | Planted violation fails non-zero via synthetic inputs | Negative | Structure (unit) | Critical | AC-F6-1, NFR-4 |
| TC-DPKCONF-003 | Named exceptions individually exempt | Corner Case | Structure (unit) | High | AC-F6-1 |
| TC-DPKNAM-001 | Naming-rule check over the real tree with committed baseline | Regression | Check script + mutation | High | AC-F7-1, NFR-6 |
| TC-DPKNAM-002 | Check self-tested: reason-less baseline, unknown offender, exemption | Negative | Check mutation tests | High | AC-F7-1, NFR-6 |
| TC-DPKFIX-001 | G-1: worktree shares the main checkout's clone identity | Happy Path | Behaviour (fixture) | High | AC-F8-1, NFR-7 |
| TC-DPKFIX-002 | G-2: two clones, one declared key, distinct state roots | Happy Path | Behaviour (fixture) | High | AC-F8-2, DM-1, NFR-7 |
| TC-DPKFIX-003 | G-3: out-of-grammar configuration loads unchanged | Regression | Behaviour (fixture) | Critical | AC-F8-3, NFR-5, NFR-7 |
| TC-DPKODR-001 | ODR-0006 Proposed, indexed; earlier records untouched | Regression | Structure + review-time | Medium | AC-F9-1 |
| TC-DPKPIN-001 | Pinned suites pass wording-only (header pins updated, payload assertions unchanged) | Regression | Structure/Behaviour + review-time | Critical | AC-F10-1, NFR-5 |
| TC-DPKPIN-002 | Zero-rename diff inspection (commands, payload fields, persisted fields) | Regression | Review-time | Critical | AC-F10-1, NFR-5 |
| TC-DPKGATE-001 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR | Regression | Aggregate gate | High | NFR-1..NFR-7 (roll-up) |

### 5.2 Scenario Details

#### TC-DPKVOC-001 - Vocabulary table present in both overview docs

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, G-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/delivery-vocabulary.test.ts` (new; content checks over `doc/overview/ubiquitous-language.md` and `doc/overview/glossary.md`, following the `naming-boundary.test.ts` tree-invariant pattern)
**Tags**: @docs, @structure

**Preconditions**:

- The change is delivered; both overview documents contain the vocabulary table.

**Steps**:

1. Read `doc/overview/ubiquitous-language.md` and `doc/overview/glossary.md` from the working tree.
2. Assert each of the eight terms of the brief §A (project, project repository, main checkout, worktree, lane, work item, clone identity, declared project key) appears as a defined term with its meaning and lifetime in **both** documents (8 of 8 in each — the spec KPI).
3. Assert the lifetimes match the spec glossary: worktree and lane temporary, project/project repository/work item/declared key durable, main checkout durable per worker, clone identity per clone.
4. Assert the glossary retains the distinct "Repository key" (`host/owner/name`) concept unchanged (NG-7 regression guard).

**Expected Outcome**:

- All eight terms present and defined in both documents; the "Repository key" concept still present; any missing or drifted term fails with the term named.

**Postconditions**:

- None (read-only).

**Notes / Clarifications**:

- Definitions are asserted by term presence plus the spec's lifetime classifications, not by verbatim prose equality — the table's wording may evolve without breaking the invariant, while a dropped term cannot.

#### TC-DPKVOC-002 - Reversed sentences corrected; feature specs link the table

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/delivery-vocabulary.test.ts` (new; same suite as TC-DPKVOC-001)
**Tags**: @docs, @structure

**Preconditions**:

- The change is delivered.

**Steps**:

1. Assert the sentence "a repository is one checkout and the delivery unit" no longer appears in `doc/overview/ubiquitous-language.md` (nor any rewording that asserts the same claim — assert on the forbidden claim substrings, e.g. "one checkout", in the vocabulary context).
2. Assert the sentence "the identifier `project key` keeps its repository meaning" no longer appears.
3. Assert `doc/spec/features/feature-projects.md` and `doc/spec/features/feature-project-groups.md` each contain a link to the vocabulary table.
4. Assert neither feature spec states that a repository is one checkout.
5. Assert `feature-projects.md` no longer names the clone identity "the project key" in its checkout-identity section (pm-notes clarify-scope evidence locates this wording).

**Expected Outcome**:

- Both forbidden sentences are gone; both feature specs link the table and make no repository-is-one-checkout claim; any residue fails naming the file and sentence.

**Notes / Clarifications**:

- Forbidden-claim assertions target the claim's stable substrings so paraphrases are still caught; the conformance test (TC-DPKCONF-*) provides the broader standing sweep.

#### TC-DPKKEY-001 - Declared-key grammar boundary matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/declared-project-key.test.ts` (new; exercises the exported `DECLARED_PROJECT_KEY_PATTERN` and its predicate from the project-scope contracts module)
**Tags**: @backend, @structure

**Preconditions**:

- `DECLARED_PROJECT_KEY_PATTERN` is exported with value `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$` and its predicate refuses the reserved segments.

**Steps**:

1. Assert the exported pattern's literal value equals `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$` (exact string pin).
2. Accept: 2-character key (`ab`); 64-character key (`a` + 62 middle characters + `a`); lowercase alphanumerics; internal single and doubled hyphens (`a-b`, `a--b`).
3. Reject: empty string; 1-character key (`a`); 65-character key (the 64-char accept case plus one character); any uppercase letter; any non-alphanumeric character; leading hyphen (`-abc`); trailing hyphen (`abc-`); hyphen-only string.
4. For every reject case, assert the failure names the violated rule (length, charset, or hyphen position) rather than a bare boolean.

**Expected Outcome**:

- Exactly the 2–64 lowercase-alphanumeric/hyphen space with no edge hyphens is accepted; every boundary rule is covered by at least one assertion; nothing outside it passes.

**Notes / Clarifications**:

- The matrix mirrors NFR-1's threshold ("every rule unit-tested"); the length-64 accept and length-65 reject cases are the boundary pair the prompt names. Internal doubled hyphens are grammar-legal by the pattern — asserting them accepted pins the regex, not a new rule.

#### TC-DPKKEY-002 - Reserved segments `unbound` and `projects` refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/declared-project-key.test.ts` (new; same suite as TC-DPKKEY-001)
**Tags**: @backend, @structure

**Preconditions**:

- The predicate (not the bare regex) carries the reserved-segment refusal.

**Steps**:

1. Assert the predicate refuses `unbound` (grammar-valid, 7 lowercase characters) with the refusal reason naming the reserved segment.
2. Assert the predicate refuses `projects` (grammar-valid, 8 characters) likewise.
3. Assert reserved-segment checking is case-exact as delivered: `UNBOUND`/`PROJECTS` are already refused by the grammar's lowercase rule, and the predicate's refusal fires on the lowercase forms.
4. Assert a key merely containing a reserved segment as a substring (`projects-x`, `my-unbound`) is accepted — the refusal is exact-match on the whole key, the reserved *state segments*, not a substring ban (spec §21: refusal prevents collision with reserved state layout segments).

**Expected Outcome**:

- `unbound` and `projects` refused despite being grammar-valid; substring-containing keys accepted; refusal reasons name the segment.

**Notes / Clarifications**:

- The substring-acceptance assertion pins the refusal's exact-match semantics; if implementation later needs substring refusal, that is a consumer-change decision, not this suite's drift.

#### TC-DPKALI-001 - `CLONE_KEY_PATTERN` exported; `PROJECT_KEY_PATTERN` same-value alias

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/declared-project-key.test.ts` (new) plus the export inventory update in `tests/structure/content-inventory.test.ts` (Existing – Update)
**Tags**: @backend, @structure

**Preconditions**:

- Both names are exported from the clone-identity contracts module.

**Steps**:

1. Assert `CLONE_KEY_PATTERN` is exported and is a valid clone-key pattern (unit-tested against representative clone-identity values: accept a delivered-style clone key, reject a value violating the underlying pattern).
2. Assert `PROJECT_KEY_PATTERN` is exported.
3. Assert `String(PROJECT_KEY_PATTERN) === String(CLONE_KEY_PATTERN)` — identical value, 0 difference (NFR-2's threshold, asserted directly rather than by re-testing the grammar twice).
4. Assert both names appear in the content inventory's export list for their module (pin-surface update, additive).

**Expected Outcome**:

- Both exports present; values identical; the inventory reflects the new exports without dropping any existing one.

**Notes / Clarifications**:

- The alias is asserted by value identity, so a future value change to either name fails loudly — exactly the drift NFR-2 guards.

#### TC-DPKACC-001 - Served `cloneKey` accessor; persisted names unchanged

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-3
**Test Type(s)**: Unit + Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/declared-project-key.test.ts` (accessor unit half) and `tests/behaviour/projects-clone-key.test.ts` (new; resolved-scope behaviour half through the production harness)
**Tags**: @backend, @structure, @behaviour

**Preconditions**:

- A resolved project scope exists for a fixture clone carrying the git-directory identity marker.

**Steps**:

1. Unit half: assert the resolved project scope exposes `cloneKey` and its value equals the clone identity read from the marker.
2. Behaviour half: resolve the project scope for a fixture clone through the production resolution path; assert the served `cloneKey` matches the identity the marker and host index carry for that clone.
3. Assert the persisted surfaces are unchanged: the marker field name, the host-index field name, and the `repos.v1`/alias payload field name (`repoKey`) are exactly as delivered (asserted via the existing contract pins — see TC-DPKPIN-001 — plus a direct field-name assertion here).
4. Assert `cloneKey` is a served read: resolving twice yields the identical value and writes nothing (no new persisted field appears in the host index or marker).

**Expected Outcome**:

- The accessor serves the clone identity; no persisted name changed; repeated reads are stable and side-effect-free.

**Notes / Clarifications**:

- The accessor is a served read on the resolved scope (F-4); this plan does not assert any new CLI flag or envelope field for it — none is claimed by the spec.

#### TC-DPKUI-001 - List headers `PROJECT` / `PROJECT REPOSITORY` / `CLONE`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-list-contract.test.ts` and `tests/behaviour/repos-list-contract.test.ts` (Existing – Update, header pins wording-only)
**Tags**: @api, @cli, @behaviour

**Preconditions**:

- Fixture host with one declared project (group) and at least one member clone, per the existing suites' fixture helpers.

**Steps**:

1. Run `projects list` (text mode) and assert the text headers are exactly `PROJECT` and `PROJECT REPOSITORY`; assert no `GROUP` or `MEMBER` headers remain.
2. Assert the `PROJECT` column carries the project's declared key (`groupKey`) and the `PROJECT REPOSITORY` column carries the member declaration's selector or locator.
3. Run `repos list` (text mode) and assert the header is exactly `CLONE` (replacing `KEY`).
4. Assert both commands still exit 0 with unchanged envelope shapes (`project-groups.v1`, `repos.v1`) — headers are a text-render change only.

**Expected Outcome**:

- Headers read `PROJECT` / `PROJECT REPOSITORY` / `CLONE`; envelopes and payload bytes unchanged; exit codes unchanged.

**Notes / Clarifications**:

- Deliberately minimal: the header *string* changes, nothing else in the payload. Any diff beyond the header literals in these suites' asserted payloads is a TC-DPKPIN-002 review failure.

#### TC-DPKUI-002 - Help and reference nouns; board help states clone identity

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, F-6, AC-F5-1
**Test Type(s)**: Contract + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-help.test.ts`, `tests/behaviour/projects-help.test.ts` (Existing – Update where they pin help summaries), the board help/selection suites (Existing – Update if pins trip), and the vocabulary conformance suite (TC-DPKCONF-001) covering the reference pages
**Tags**: @cli, @docs, @behaviour, @structure

**Preconditions**:

- The change's help and reference-text updates are delivered.

**Steps**:

1. Assert `board --project` help states that the value is a clone identity (and the board is never group-scoped — intent kept, per TC-GRPSREAD-003's preserved intent).
2. Assert help summaries for the `repos` and `projects` families use the table's nouns: no help text calls a clone identity a project or a project key.
3. Assert no "primary checkout" wording remains within the conformance scope (Appendix B surfaces); "main checkout" is the term used.
4. Assert the conformance sweep covers every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` (42 pages at base: m1 28, m2 12, m4 2), with reference pages for other milestones corrected wherever violations exist in scope — e.g., the m4 install page's "primary checkout" wording becomes "main checkout" (`install.md:84`).
5. Assert the three m2 command-reference pages (`doc/planning/oss-tooling/milestones/m2/commands/repos.md`, `projects.md`, `board.md`) use the corrected nouns and additionally carry their wording-only pin updates (brief §F pin surfaces — a subset of the sweep scope, never its definition).

**Expected Outcome**:

- Help and reference text speak the vocabulary table; the `--project` help names the clone identity; no "primary checkout" within scope.

**Notes / Clarifications**:

- Steps 1–3 ride the standing conformance suite (TC-DPKCONF-001) plus the targeted help pins; steps 4–5 are asserted by the conformance scope's full commands-glob coverage — every milestone's reference pages in scope, with the three m2 pages additionally carrying their pin updates — and manually reviewed for rendering.

#### TC-DPKUI-003 - `--flat` alias payload and text byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-10, AC-F5-1, NFR-3, RSK-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-flat-alias.test.ts` (Existing – Update, wording-only discipline) with its committed golden/literals of the pre-change output
**Tags**: @api, @cli, @behaviour

**Preconditions**:

- The suite's pinned payload and rendered-text expectations capture the pre-change (`--flat`) output at base 22b15d31.

**Steps**:

1. Run `projects list --flat` (JSON) on the standard fixture host; assert the payload is byte-identical to the pinned pre-change payload (0-byte delta; exact field set and values).
2. Run `projects list --flat` (text mode); assert the rendered text is byte-identical to the pinned pre-change text (0-byte delta).
3. Assert the suite's own diff in this change touches no payload or text assertion — only, if anything, a header-string literal that belongs to the *default* `projects list` surface, never the alias output.

**Expected Outcome**:

- Payload and text byte-identical to the pre-change output; 0-byte delta in both modes (spec KPI: 0 bytes).

**Notes / Clarifications**:

- The pin is the committed golden/literals inside the suite (a tree invariant); it must never be regenerated to absorb drift — regeneration is permitted only for a deliberate, reviewed output change, which this change forbids by definition (NFR-3). A failure here is a change defect, not a golden update.

#### TC-DPKCONF-001 - Conformance passes on the clean tree

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/vocabulary-conformance.test.ts` (new; runs the scanner over the real tree's Appendix B surfaces as a tree invariant)
**Tags**: @docs, @structure

**Preconditions**:

- The narrowed conformance test exists with the Appendix B scope: CLI help summaries; text headers of `projects list` and `repos list`; the guides tree; the tools documentation tree; the overview tree; and every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` — all milestones' command pages (42 at this change's base: 28 in m1, 12 in m2, 2 in m4).

**Steps**:

1. Run the conformance scanner over the declared scope on the working tree as delivered, including the entire commands tree `doc/planning/oss-tooling/milestones/*/commands/**` — assert the sweep walks 42 command reference pages at base (28 m1 + 12 m2 + 2 m4), not only the three m2 pin surfaces.
2. Assert it exits zero (passes) — the delivered text honours the vocabulary everywhere in scope, including the in-change corrected m4 install wording (`install.md` no longer reads "primary checkout").

**Expected Outcome**:

- Clean-tree pass; any in-scope mislabel (a clone identity called a project, a missing noun correction) fails with file and line named.

**Postconditions**:

- None (read-only).

#### TC-DPKCONF-002 - Planted violation fails non-zero via synthetic inputs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NFR-4, RSK-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/vocabulary-conformance.test.ts` (new; same suite — negative-proof half)
**Tags**: @docs, @structure

**Preconditions**:

- The scanner's detection core is callable as a pure function over input text/files, independently of walking the real tree.

**Steps**:

1. Feed the scanner synthetic in-memory text containing a vocabulary violation (e.g., help-summary-shaped text calling a clone identity "the project key"; a header line reading `GROUP`).
2. Assert the scanner reports the violation non-zero and names the synthetic input and the offending match.
3. Feed the scanner a synthetic temp-tree fixture (created by the test itself under the session-scoped temporary root, mirroring an Appendix B surface) containing a planted violation; assert the tree-walking entrypoint fails non-zero on it.
4. Assert **no violation is ever written into the committed repository tree** — the negative proof lives entirely in test-owned synthetic inputs/temp trees; the working tree after the run is clean (`git status` unchanged by the test).

**Expected Outcome**:

- The scanner fails non-zero on every planted violation and names it; the committed tree stays clean; the clean-tree pass (TC-DPKCONF-001) and this failure proof together satisfy NFR-4.

**Notes / Clarifications**:

- This is the prompt's named mechanism: synthetic in-memory inputs and/or a test-created temp-tree fixture — never a committed violation, per the repo rule that the tree stays clean. The pure-function entrypoint is the design constraint that makes the negative proof testable; the plan pins it.

#### TC-DPKCONF-003 - Named exceptions individually exempt

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-4, RSK-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/vocabulary-conformance.test.ts` (new; same suite — exception half)
**Tags**: @docs, @structure

**Preconditions**:

- The scanner implements the four named exceptions (Appendix B, frozen until GH-408).

**Steps**:

1. Feed the scanner synthetic text containing each exception in an in-scope surface shape: a `projects.*` error-code literal; a `<host root>/projects/` container path; a `--project-root` flag mention; a `--flat` alias mention.
2. Assert each is accepted without a finding (four independent assertions, one per exception).
3. Assert an exception-shaped string that is *not* one of the named exceptions (e.g., a different flag spelling) still produces a finding — the exemption is exact, not a prefix or family-wide pardon beyond the named `projects.*` error-code family.

**Expected Outcome**:

- All four named exceptions exempt; near-miss strings outside the exception list still flagged; exceptions honoured on both synthetic inputs and the real tree (the clean-tree pass of TC-DPKCONF-001 already proves the real-tree half — the delivered text legitimately contains all four).

**Notes / Clarifications**:

- The exceptions are frozen until GH-408; this suite is the record of their exact shape, so a drift in any exception surface fails visibly.

#### TC-DPKNAM-001 - Naming-rule check over the real tree with committed baseline

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-6, RSK-4
**Test Type(s)**: Static check + mutation tests
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/new-code-naming.ts` (new invariant check) + its committed reason-bearing baseline file + `tests/checks/new-code-naming.test.ts` (mutation tests)
**Tags**: @backend, @checks

**Preconditions**:

- The check is registered with the repo invariant battery (runnable via `bun run scripts/checks/new-code-naming.ts`); the baseline lists every post-base file allowed to contain the bare token, each with a reason; the change's base (22b15d31) is encoded as a committed constant.

**Steps**:

1. Run the check on the delivered tree; assert exit 0.
2. Assert every baseline entry carries a non-empty reason (structural assertion over the committed baseline).
3. Assert the check's rule set as delivered: a file that did not exist at base and contains the bare token `projectKey` without a baseline entry is a violation; a pre-base (existing-at-base) file containing the token is exempt; the check reads no per-file counts for existing files.
4. Assert the check names the offending file and baseline entry in every failure output (repo invariant contract: exit non-zero and name the offender).

**Expected Outcome**:

- Clean-tree pass with all reasons present; every rule of AC-F7-1 exercised; failures name their offender.

**Notes / Clarifications**:

- The check is intentionally file-existence-at-a-pinned-base based, not diff-based, so it remains a legal permanent invariant after merge (testing-strategy authoring rules).

#### TC-DPKNAM-002 - Check self-tested: reason-less baseline, unknown offender, exemption

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-6
**Test Type(s)**: Mutation tests
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/new-code-naming.test.ts` (new; bun:test mutation tests per the module-to-test mapping)
**Tags**: @backend, @checks

**Preconditions**:

- The check's core accepts injected inputs (a file map/baseline) rather than only the real tree, so mutation cases need no repository writes.

**Steps**:

1. Mutation A — baseline entry without a reason: assert the check fails non-zero and names the entry.
2. Mutation B — a file not in the baseline containing the bare `projectKey` token: assert the check fails non-zero and names the file.
3. Mutation C — a pre-base file containing the token: assert the check passes (exemption) with no per-file counts consulted.
4. Mutation D — a post-base clean file (no token): assert the check passes.
5. Run each mutation against the injected-input core (temp files under the session-scoped temporary root or in-memory maps); assert no mutation writes into the committed tree.

**Expected Outcome**:

- The check rejects a reason-less baseline and an unknown offender, exempts existing files, and accepts clean new code — the check itself is tested, not just run.

#### TC-DPKFIX-001 - G-1: worktree shares the main checkout's clone identity

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-3, NFR-7
**Test Type(s)**: Integration (fixture-based behaviour)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/clone-identity-fixtures.test.ts` (new; builds on `tests/fixtures/projects/` temp-repository and identity-marker helpers)
**Tags**: @backend, @behaviour, @git

**Preconditions**:

- A temp project repository is created with its git-directory identity marker; a linked worktree is created from it via git's worktree layout — all inside the session-scoped temporary root, no network.

**Steps**:

1. Create the temp clone (main checkout) and mint its clone identity (marker written as delivered).
2. Create a linked worktree of that main checkout for one work item.
3. Resolve the identity from the worktree and from the main checkout through the production resolution path.
4. Assert the two resolved identities are equal — the worktree resolves the same clone identity as its main checkout.
5. Assert the resolution is stable across repeated reads within the run.

**Expected Outcome**:

- Worktree identity == main checkout identity (fixture G-1); deterministic on a single worker host (NFR-7).

**Postconditions**:

- Temp repositories removed with the session-scoped temp root; nothing written outside it.

#### TC-DPKFIX-002 - G-2: two clones, one declared key, distinct state roots

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-2, DM-1, NFR-7
**Test Type(s)**: Integration (fixture-based behaviour)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/clone-identity-fixtures.test.ts` (new; same suite)
**Tags**: @backend, @behaviour, @git

**Preconditions**:

- One temp project repository with a declared project key (a `groups.v1` group declaration naming the project); local host state root isolated per test.

**Steps**:

1. Clone the project repository twice into two distinct temp directories (two clones on one worker).
2. Resolve the declared project key from each clone (from the group declaration).
3. Assert both clones resolve the **same** declared project key (DM-1: the declared key names the project, independent of the clone).
4. Resolve each clone's identity and its per-clone state root; assert the two identities differ and the two state roots differ (each clone keeps its own state root).
5. Assert the declared key is never compared against the clone identity (disjoint namespaces — spec §21): assert the resolution paths read different fields/parent directories as delivered.

**Expected Outcome**:

- Same declared project key across clones; different clone identities and different state roots (fixture G-2); deterministic (NFR-7).

#### TC-DPKFIX-003 - G-3: out-of-grammar configuration loads unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-3, NFR-5, DEC-4, NG-4
**Test Type(s)**: Integration (fixture-based behaviour)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/clone-identity-fixtures.test.ts` (new; same suite; configuration-document helpers from `tests/fixtures/projects/`)
**Tags**: @backend, @behaviour

**Preconditions**:

- An existing-shape projects configuration document (schema `delivery.projects.groups.v1`) whose group key violates the declared-key grammar (e.g., contains an uppercase letter or a leading hyphen — outside `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$`).

**Steps**:

1. Write the legacy configuration to the fixture host's configuration location (group key out-of-grammar; members declared as delivered).
2. Load it through the production configuration path and enumerate the group.
3. Assert the load succeeds unchanged: the group and its members enumerate exactly as declared; exit 0; no classified validation error.
4. Assert no migration occurred: the configuration file bytes on disk are unchanged after the load, and no rewritten/re-keyed configuration appears anywhere in the fixture tree.
5. Assert the local layer enforces no pattern: a second document with a *grammar-valid* group key loads identically — the grammar is invisible to this layer (no-public-pattern contract preserved, DEC-4).

**Expected Outcome**:

- Out-of-grammar configuration loads unchanged with zero migration (fixture G-3); the local layer applies no grammar; regression protected per spec §19.

#### TC-DPKODR-001 - ODR-0006 Proposed, indexed; earlier records untouched

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-9, AC-F9-1, NG-5, RSK-6
**Test Type(s)**: Structure + Manual (review-time diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/delivery-vocabulary.test.ts` (new; structural half) + review-time inspection (unedited-earlier-records half)
**Tags**: @docs, @structure

**Preconditions**:

- ODR-0006 and its decision-index row are delivered.

**Steps**:

1. Automated: assert `doc/decisions/ODR-0006-*.md` exists.
2. Automated: assert its front matter carries `status: Proposed` and `decision_date: null`.
3. Automated: assert the decision index (`doc/decisions/00-index.md`) lists ODR-0006.
4. Automated: assert ODR-0006's body references the vocabulary, the mapping of locked names, the declared-key grammar, and its reading of ODR-0003 DC-4 and ODR-0004 C-2..C-5 (presence-of-section assertions, not prose equality).
5. Review-time: inspect the delivery diff and assert no file under `doc/decisions/` other than ODR-0006 and the index row changed; log the inspection in Section 10.

**Expected Outcome**:

- ODR-0006 exists exactly as `Proposed` with a null decision date and an index row; earlier records untouched (NG-5).

**Notes / Clarifications**:

- The permanent-suite half asserts tree/HEAD properties only; step 5 is the legal home for the diff-shaped claim (testing-strategy authoring rules).

#### TC-DPKPIN-001 - Pinned suites pass wording-only (header pins updated, payload assertions unchanged)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-10, AC-F10-1, NFR-5, RSK-1
**Test Type(s)**: Contract + Structure
**Automation Level**: Automated + Manual (review-time diff discipline)
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`, `tests/structure/naming-boundary.test.ts` (TC-GRPBOUND-002, TC-GRPSREAD-003), `tests/behaviour/repos-list-contract.test.ts`, `tests/behaviour/projects-list-contract.test.ts`, `tests/behaviour/projects-flat-alias.test.ts`, the help suites pinning summaries (`repos-help`, `projects-help`, board help/selection suites if their pins trip) — all Existing – Update
**Tags**: @structure, @behaviour, @cli

**Preconditions**:

- The wording-only pin updates are delivered in the same change (spec §18: tree green at each phase boundary).

**Steps**:

1. Run each pinned suite (`bun test` per file); assert all pass.
2. Automated (within the suites): assert the payload/envelope assertions still hold unchanged — `repos.v1` field set, `project-groups.v1` shape, the `--flat` alias payload and text (TC-DPKUI-003's pins), the exported-name inventory with only *additive* new entries (`DECLARED_PROJECT_KEY_PATTERN`, `CLONE_KEY_PATTERN`), and the naming-boundary intent (permanent repository vocabulary and never-group-scoped board) with refreshed wording.
3. Review-time: inspect each pinned suite's diff and assert it touches only literal pins — header strings, exported-name list entries, describe titles, wording comments — and no payload assertion, field name, or expectation value; log the inspection in Section 10.
4. Conditional sweep: if any other suite's wording pins trip on the noun corrections (MCP scope, read-only audit wording, reference-page pins), apply the same wording-only discipline and record it.

**Expected Outcome**:

- Every pre-existing contract suite passes; the only suite diffs are wording-only; "wording-only" is verifiable by the three signals together — suites pass, payload assertions byte-for-byte unchanged (step 3), and the suites' own payload/text pins (step 2) still assert the delivered shapes.

**Notes / Clarifications**:

- Existing TC-IDs in these suites (TC-GRPBOUND-002, TC-GRPSREAD-003, and all others) keep their IDs and intent; only their pinned wording refreshes. No TC-ID from another change is reused here.

#### TC-DPKPIN-002 - Zero-rename diff inspection (commands, payload fields, persisted fields)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-10, AC-F10-1, NFR-5, DEC-2, NG-1
**Test Type(s)**: Manual (review-time)
**Automation Level**: Manual
**Target Layer / Location**: Delivery-gate review of the change branch diff (`feat/GH-406/delivery-vocabulary-declared-project-key` vs base 22b15d31), executed once at the review/quality-gate boundary
**Tags**: @review

**Preconditions**:

- The change branch carries its complete delivery diff.

**Steps**:

1. Inspect the diff for command-name changes: assert no command or subcommand name changed (the `repos` family, `projects`, `board` names intact).
2. Inspect the diff for payload-field changes: assert no envelope field was renamed or removed (`repoKey`, `groupKey`, `data.*` keys as delivered).
3. Inspect the diff for persisted-field changes: assert the identity marker field, the host-index field, and any persisted configuration field kept their names; no persisted field added, renamed or re-keyed (spec §19).
4. Assert the four named exceptions survive untouched: `projects.*` error codes, the `<host root>/projects/` container, `--project-root`, `--flat`.
5. Record the inspection verdict in Section 10 and the pm-notes.

**Expected Outcome**:

- 0 renamed command names, 0 payload fields, 0 persisted fields (NFR-5's thresholds); exceptions intact.

**Notes / Clarifications**:

- Review-time by necessity (a permanent suite may not assert a branch diff — testing-strategy rules); the automated complement is TC-DPKPIN-001 step 2 (suites asserting the delivered shapes still pass) and TC-DPKFIX-003 (persisted state untouched by loading).

#### TC-DPKGATE-001 - `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-1..NFR-7 (roll-up), G-1..G-7
**Test Type(s)**: Aggregate gate
**Automation Level**: Automated
**Target Layer / Location**: Repository gate battery (`lint → format:check → typecheck → test → boundaries`) run with `TMPDIR=$PWD/tmp/tmpdir` per the repo's evidence convention
**Tags**: @gate

**Preconditions**:

- All suites and checks of this plan are implemented and individually green.

**Steps**:

1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check` on the delivery tree at the quality-gates phase.
2. Record the command, result summary, and any narrow-suite reruns in Section 10 and the pm-notes.

**Expected Outcome**:

- Gate green before the PR opens; any failure routed to remediation and re-run.

## 6. Environments and Test Data

- **Host**: single worker host, local only (NFR-7). No network access is required by any scenario; no daemon is started; fixture "reachability" surfaces are not exercised by this change.
- **Temporary root**: all fixture repositories, worktrees, clones, configuration documents and synthetic scanner inputs live under the session-scoped temporary root; the gate battery runs with `TMPDIR=$PWD/tmp/tmpdir` (repo evidence convention). Suite-authored temp trees follow the existing `tests/fixtures/projects/` isolation pattern (`APPROVED_BASE`-style tmp/tmpdir isolation); every test cleans up with its temp root and leaves `git status` untouched.
- **Test data**:
  - Fixture git repositories built by the `tests/fixtures/projects/` helpers (temp repositories, host fixtures, identity markers, host-index readers) — the delivered basis for G-1/G-2.
  - G-1: one clone + one linked worktree (git worktree layout; marker shared per git semantics).
  - G-2: one project repository cloned twice; a `groups.v1` declaration naming the shared declared key.
  - G-3: a committed-case legacy configuration document with an out-of-grammar group key (committed case definitions are the strategy's preferred fixture form), plus a grammar-valid twin for the no-enforcement contrast.
  - Conformance/naming negative proofs: synthetic in-memory texts and test-created temp trees only — never a planted violation in the committed tree.
  - Grammar matrix values are generated literals in the suite (no external fixture files needed).
- **Isolation strategy**: each scenario constructs its own fixture host state; no scenario depends on another's residue; no ambient `$HOME` reads (`.ai/rules/typescript.md`); identity resolution reads only fixture-written markers and host indexes.
- **Determinism**: no wall-clock, hostname, network or ordering dependence in assertions; repeated runs of G-1..G-3 produce identical outcomes (spot-checked by running the fixture suite twice when recording gate evidence).

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create / update | Execution command | Mocking / fixture requirements | Status |
|-------|------------------------------|-------------------|--------------------------------|--------|
| TC-DPKVOC-001 | `tests/structure/delivery-vocabulary.test.ts` (new) | `bun test tests/structure/delivery-vocabulary.test.ts` | None — reads committed docs | To Implement |
| TC-DPKVOC-002 | `tests/structure/delivery-vocabulary.test.ts` (same suite) | `bun test tests/structure/delivery-vocabulary.test.ts` | None | To Implement |
| TC-DPKKEY-001 | `tests/structure/declared-project-key.test.ts` (new) | `bun test tests/structure/declared-project-key.test.ts` | None — pure exported units | To Implement |
| TC-DPKKEY-002 | `tests/structure/declared-project-key.test.ts` (same suite) | `bun test tests/structure/declared-project-key.test.ts` | None | To Implement |
| TC-DPKALI-001 | `tests/structure/declared-project-key.test.ts`; `tests/structure/content-inventory.test.ts` (update) | `bun test tests/structure/declared-project-key.test.ts tests/structure/content-inventory.test.ts` | None | To Implement + Existing – Update |
| TC-DPKACC-001 | `tests/structure/declared-project-key.test.ts`; `tests/behaviour/projects-clone-key.test.ts` (new) | `bun test tests/structure/declared-project-key.test.ts tests/behaviour/projects-clone-key.test.ts` | Fixture clone with identity marker (`tests/fixtures/projects/` helpers) | To Implement |
| TC-DPKUI-001 | `tests/behaviour/projects-list-contract.test.ts`, `tests/behaviour/repos-list-contract.test.ts` (updates) | `bun test tests/behaviour/projects-list-contract.test.ts tests/behaviour/repos-list-contract.test.ts` | Standard list fixture host (existing helpers) | Existing – Update (header pins) |
| TC-DPKUI-002 | `tests/behaviour/repos-help.test.ts`, `tests/behaviour/projects-help.test.ts`, board help/selection suites (updates if pins trip); conformance suite covers every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` (three m2 pages also carry pin updates) | `bun test tests/behaviour/repos-help.test.ts tests/behaviour/projects-help.test.ts` | None beyond existing fixtures | Existing – Update (conditional) + To Implement (conformance half) |
| TC-DPKUI-003 | `tests/behaviour/projects-flat-alias.test.ts` (update; golden/literals untouched) | `bun test tests/behaviour/projects-flat-alias.test.ts` | Pinned pre-change payload/text literals (committed) | Existing – Update (wording-only discipline) |
| TC-DPKCONF-001 | `tests/structure/vocabulary-conformance.test.ts` (new) | `bun test tests/structure/vocabulary-conformance.test.ts` | Scanner runs over the real tree's full Appendix B scope incl. all 42 pages under `doc/planning/oss-tooling/milestones/*/commands/**` (read-only) | To Implement |
| TC-DPKCONF-002 | `tests/structure/vocabulary-conformance.test.ts` (same suite) | `bun test tests/structure/vocabulary-conformance.test.ts` | Synthetic in-memory inputs + test-created temp trees under the session temp root; pure-function scanner entrypoint | To Implement |
| TC-DPKCONF-003 | `tests/structure/vocabulary-conformance.test.ts` (same suite) | `bun test tests/structure/vocabulary-conformance.test.ts` | Synthetic exception-shaped texts | To Implement |
| TC-DPKNAM-001 | `scripts/checks/new-code-naming.ts` + committed baseline file (new); registered in the invariant battery | `bun run scripts/checks/new-code-naming.ts` | Committed reason-bearing baseline; pinned base constant (22b15d31) | To Implement |
| TC-DPKNAM-002 | `tests/checks/new-code-naming.test.ts` (new) | `bun test tests/checks/new-code-naming.test.ts` | Injected file-map/baseline inputs; temp files under session temp root only | To Implement |
| TC-DPKFIX-001 | `tests/behaviour/clone-identity-fixtures.test.ts` (new) | `bun test tests/behaviour/clone-identity-fixtures.test.ts` | Temp clone + linked worktree via fixture helpers | To Implement |
| TC-DPKFIX-002 | `tests/behaviour/clone-identity-fixtures.test.ts` (same suite) | `bun test tests/behaviour/clone-identity-fixtures.test.ts` | Temp repository cloned twice; `groups.v1` declaration fixture | To Implement |
| TC-DPKFIX-003 | `tests/behaviour/clone-identity-fixtures.test.ts` (same suite) | `bun test tests/behaviour/clone-identity-fixtures.test.ts` | Committed legacy configuration case (out-of-grammar group key) + grammar-valid twin | To Implement |
| TC-DPKODR-001 | `tests/structure/delivery-vocabulary.test.ts` (structural half); review-time diff inspection | `bun test tests/structure/delivery-vocabulary.test.ts` | None (reads `doc/decisions/**`) | To Implement + Manual (step 5) |
| TC-DPKPIN-001 | Pinned suites listed in Section 5.2 (updates) | `bun test tests/structure/content-inventory.test.ts tests/structure/naming-boundary.test.ts tests/behaviour/repos-list-contract.test.ts tests/behaviour/projects-list-contract.test.ts tests/behaviour/projects-flat-alias.test.ts` | Existing fixtures | Existing – Update (wording-only) |
| TC-DPKPIN-002 | None (review-time) | Diff inspection at the delivery gate | The change branch diff vs base 22b15d31 | Manual Only |
| TC-DPKGATE-001 | None (aggregate) | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Full working tree | Existing – No Change (battery) |

Exact suite file names are this plan's proposal; the implementation plan (phase 4) pins them, and reconciliation notes go to the owning TCs if the plan deviates.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk (testing view) | Mitigation |
|----|---------------------|------------|
| TR-1 | Pin updates smuggle behavioural change (RSK-1) | Three-signal wording-only verification (TC-DPKPIN-001: suites pass, payload assertions unchanged, delivered-shape pins intact) + review-time diff discipline (TC-DPKPIN-002) |
| TR-2 | `--flat` payload/text drift (RSK-2) | Committed pre-change golden/literals asserted byte-for-byte (TC-DPKUI-003); regeneration forbidden — a delta is a defect |
| TR-3 | Conformance over/under-matches (RSK-3) | Appendix B scope with four named exceptions asserted individually (TC-DPKCONF-003); planted-violation proof via synthetic inputs (TC-DPKCONF-002); clean-tree pass (TC-DPKCONF-001) |
| TR-4 | New code reintroduces the bare legacy token (RSK-4) | Repository check with reason-bearing baseline, mutation-tested (TC-DPKNAM-001/002); baseline diff review-visible |
| TR-5 | Grammar matrix misses a boundary (length 63/64/65, hyphen edges) | Full boundary matrix pinned to the canonical regex (TC-DPKKEY-001); pattern value asserted as an exact string, so a regex edit fails the pin before behaviour drifts |
| TR-6 | Fixture nondeterminism (worktree layout, host paths) | Session-scoped temp root, no network/clock/hostname dependence, repeat-run spot check at gate evidence time (NFR-7, Section 6) |
| TR-7 | The naming-rule check becomes illegal after merge (diff-shaped assertion) | Base encoded as a committed constant (22b15d31) — the check asserts tree-vs-pinned-base, a legal permanent invariant (TC-DPKNAM-001 note) |
| TR-8 | Review-time gates skipped under delivery pressure | TC-DPKODR-001 step 5, TC-DPKPIN-001 step 3, TC-DPKPIN-002 named as explicit Section 10 log rows; DoR/DoD checkers read them as required evidence |

### 8.2 Assumptions

- The delivery brief (owner comment 7122871259) is authoritative; the spec is its authored form; where ticket body and brief differ, the spec wins (spec §12, DEC-1).
- The change's base is 22b15d31 (pm-notes state detection); the naming-rule check pins it as a committed constant.
- `DECLARED_PROJECT_KEY_PATTERN`, `CLONE_KEY_PATTERN`, `PROJECT_KEY_PATTERN`, `cloneKey`, `declaredProjectKey`, `projectKey`, `repoKey` are contract identifiers required verbatim by the ACs (spec authoring guidelines) — suites assert these exact names.
- Git's marker-sharing across linked worktrees holds on the reference host; fixture G-1 verifies it rather than assuming it (spec §12).
- The delivered pin suites' fixture helpers cover the G-1/G-2 fixture needs (temp repositories, markers, host-index readers); otherwise the helpers extend within `tests/fixtures/projects/` without new isolation patterns.
- ODR-0006 is the next free decision id, reserved by the brief (spec §12); the structural assertions in TC-DPKODR-001 rely on it.
- The four named exceptions remain frozen until GH-408; the conformance suite's exception assertions may not be relaxed in this change.

### 8.3 Open Questions

None. Spec §14 records no open questions and the clarification resolved every raised point; this plan raises no blocking question. Non-blocking implementation notes are carried as TC notes (scanner pure-function entrypoint for TC-DPKCONF-002; injected-input core for TC-DPKNAM-002) and bind the implementation plan, which pins the exact file names in phase 4.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-24 | test-plan-writer agent | Initial test plan from chg-GH-406-spec.md (12 ACs, F-1..F-10, DM-1..3, NFR-1..7, fixtures G-1..G-3, Appendix B scope/exceptions) and .ai/rules/testing-strategy.md |

## 10. Test Execution Log

Populated during execution (phases 6–9); each row records the run date, result, and evidence pointer.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed |
