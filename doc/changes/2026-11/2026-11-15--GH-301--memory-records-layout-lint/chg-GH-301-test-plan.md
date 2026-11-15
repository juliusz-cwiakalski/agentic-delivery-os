---
id: chg-GH-301-test-plan
status: Proposed
created: 2026-11-15
last_updated: 2026-11-15
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, memory, quality-gates, repository-invariants, schema]
version_impact: minor
summary: "Verification strategy for M2-S8 memory records, layout, and lint: one canonical tree, one typed record schema reconciled across README/writer/capsule/lint, eight lint areas with failing-fixture mutation tests, both-direction index coverage, enforced budgets, deterministic and bounded output, conflict-free parallel record creation, and the sanctioned replacement of the GH-302 negative guard."
links:
  change_spec: ./chg-GH-301-spec.md
  implementation_plan: ./chg-GH-301-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S8: Memory records, layout, and lint (M2)

## 1. Scope and Objectives

This change turns the committed memory tree into one canonical, budgeted, reference-checked store and adds a single repository invariant — a memory lint — to the quality gates. The core behaviour to protect is **one schema, one enforcement point, provable coverage**: every durable record renders the same required spine that the human README, the promotion writer, the capsule contract, and the lint agree on; every covered path has exactly one index row and every row resolves to a covered path; every declared budget is measured; and a malformed, undated, unprovenanced, dangling, oversized, or credential-bearing record fails the gate instead of landing green.

The integrity risks this plan targets are schema drift (a fifth record rendering), gate noise from judgement-shaped heuristics, landed-red migration, boundary erosion into the deferred M3 command family or a sixth doctor area, index conflict between concurrent promotion writes, and a secret-scan vocabulary that drifts from the consented privacy rules. The motivating regressions are real: the tree exists but nothing validates it, the promotion reader silently skips malformed records, and three promoted records carry neither the schema's trust level nor a shaped evidence link.

Verification is layered: a pure domain evaluation with injected file maps (unit), one bun-run repository check with mutation suites (check), promotion-writer behaviour over a temporary memory tree (behaviour), tree/contract/gate-parity assertions (structure), one git-based parallel-branch merge exercise (integration), and explicitly-labelled manual evidence where automation is not honest.

### 1.1 In Scope

- The eight named lint areas and the closed finding-identity register (`memory.<area>.<condition>`): schema, dating, provenance, reference, index, budget, derivable, secret.
- Both-direction index coverage, row shape, duplicate rows, wrong-target rows, and archive-index coverage.
- Budget enforcement at every published cap (index lines/bytes, agent entry point, guild entry point, archive index, kernel section warn/error band).
- Determinism, declared ordering, exit projection, output ceiling and truncation line.
- Canonical tree layout over the committed tree, placeholder semantics, and the absence of the fleet quarantine area.
- One-schema parity between the machine contract, the memory README, the capsule contract, the promotion writer, and the lint, including the capsule reconciliation dispositions.
- Promotion-writer alignment (full required spine + read-when hint) and curator-rule alignment.
- Concurrency: parallel-branch record creation with zero merge conflicts, plus union-resolved index rows for two promotion writes.
- The sanctioned replacement of the GH-302 negative guard (positive presence plus preserved boundary absences) and inventory equality.
- Gate wiring: aggregate `pnpm check` membership, CI `ts-invariants` step, parity assertions, read-only/deterministic behaviour.
- Documentation conformance: forbidden-literal registration and `ados_distribution` markers under marker-required roots.

### 1.2 Out of Scope & Known Gaps

- **No memory subcommand, compiler, loader enforcement, sixth doctor area, or installed-script distribution** (NG-1…NG-7, DEC-3, DEC-13). These are asserted *absent* by TC-MEMGUARD-001/002, not tested into existence.
- **No model-assisted derivable-content judgement**: the heuristics stay the two closed deterministic rules; no similarity or model path is tested.
- **The promotion reader's malformed-record tolerance is unchanged** in this change (spec §8.5). The plan verifies that the migrated population conforms; it does not assert new reader behaviour.
- **No generator for the memory index or archive index** (increment step 3). The append-maintained shape is tested; generation is not.
- **Fleet-layer routing and `external/` quarantine** are absent by decision and are not exercised.
- **Timing bounds are environment-sensitive.** TC-MEMNFR-002 records the measured cost and asserts the declared ceiling on the CI runner; local figures are evidence, not a second contract.
- **Same-role parallel worktrees remain merge-conflict capable** and resolve by the documented union rule. That path is a documented manual+scripted procedure (TC-MEMCONC-001 notes), not automated; the change does not claim it away (F-13).
- **Known gap by testing-strategy rule:** permanent suites must not assert a branch diff, so "this change adds no forbidden surface" is an inventory/boundary invariant (TC-MEMGUARD-002) plus review-time changed-file inspection, not a diff assertion against a moving base.

## 2. References

- Change specification: `./chg-GH-301-spec.md` — 30 acceptance criteria (AC-F1-1…AC-NFR10-1), functional capabilities F-1…F-14, data-model contracts DM-1…DM-6, NFR-1…NFR-11, decision log DEC-1…DEC-13, §17.1 Definition of Done (19 rows), Appendix A closed finding-identity register, Appendix B scenario seeds SC-M2-S8-01/02, Appendix C constraint register C-1…C-8.
- Implementation plan: `./chg-GH-301-plan.yaml` — **pending** (phase 4). This test plan constrains it: the plan must declare phases that own layout, schema, write-path, each lint area, output/truncation, concurrency, guard replacement, gate wiring, and documentation conformance, and it must confirm the concrete file names used below.
- Testing strategy: `.ai/rules/testing-strategy.md` — module→test mapping (`scripts/checks/<check>.ts` → `bun run` plus `tests/checks/**` mutation tests; `packages/**` → `bun test tests/structure tests/behaviour` plus boundaries/typecheck; `doc/**` → static/content checks), bun:test authoring rules, invariant-test authoring (tree invariants, not branch diffs), and the gate battery.
- TypeScript rules: `.ai/rules/typescript.md` — strict TS, tier/purity, contracts-vs-domain-vs-adapter separation, error contract, bun:test conventions.
- Test runner configuration: `bunfig.toml` (root discovery over `tests/**`, `tmp/**` and `dist/**` ignored, fixtures never named `*.test.ts`).
- PM notes: `./chg-GH-301-pm-notes.yaml` — binding decisions DEC-1…DEC-4, the two in-change risks (negative guard replacement, record-schema drift), known doc impacts, delivery conventions (gate `TMPDIR=$PWD/tmp/tmpdir pnpm check`, PR targets `main-tools`), and the environment note (`delivery-os` bin; build before lifecycle commands).
- Ticket truth: `doc/planning/oss-tooling/backlog.md` §"M2-S8 Memory records, layout, and lint" — the four ticket AC artifacts (lint fails on a record missing id/date/evidence; an index line without a backing record and vice versa; budget violations; zero merge conflicts under concurrent creation).
- Predecessor artifacts: `doc/changes/2026-11/2026-11-14--GH-302--memory-conventions-bootstrap-templates/chg-GH-302-spec.md` and `chg-GH-302-test-plan.md` — the tree scaffold, index contract, entry-point template, manual doctor checklist, and the negative guard replaced here; the negative guard lives at `tests/structure/memory-bootstrap-templates.test.ts:258-287`.
- Current committed tree: `.ai/memory/README.md` (172 lines), `.ai/memory/agents/{pm,coder,ceo,fixer}/README.md`, `.ai/memory/lessons/lesson-2026-{001,002,003}-*.md`, `.ai/memory/tacit/`.
- Contracts and code under test: `packages/core/src/contracts/capsule.ts` (candidate model, `CAPSULE_CANDIDATE_TRUST` T0–T5, five evidence prefixes), `packages/adapters/src/file/memory-promotion.ts` (reader, writer, index-row append), `packages/adapters/src/io/privacy-rules.ts` (seven recognizer classes: six secret + one private-literal; three suppression classes), `scripts/checks/*.ts` (invariant convention), `package.json` scripts, `.github/workflows/ci.yml` (`ts-invariants` job).
- Test precedents: `tests/checks/retro-key-containment.test.ts` (live scan + planted-failure mutations), `tests/checks/forbidden-literals.test.ts` (per-class failing mutations, read-only scan), `tests/checks/error-table-sync.test.ts` (temp-copy mutations), `tests/structure/content-inventory.test.ts` (source inventory equality), `tests/checks/ci-wiring.test.ts` (aggregate/CI citation pins), `tests/fixtures/capsule/promotion.ts` (temp memory tree + real promotion writer), `tests/behaviour/closeout-capsule-*.test.ts`.
- Milestone scenario seeds (inherited, content not restated): SC-M2-S8-01 (missing id/evidence fails per field, non-zero exit) and SC-M2-S8-02 (two agents appending records to different files merge with zero conflicts, both records listed). Mapped in the scenario details below; the seed's `index.data.records` surface is reconciled to the lint's coverage result because this story ships no index command.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Canonical tree: index, four record areas, retro archive + archive index, per-agent and guild entry points; empty areas proved by placeholders; no fleet quarantine area | TC-MEMLAY-001, TC-MEMLAY-003, TC-MEMLAY-004 | Covered |
| AC-F1-2 | Placeholder is not a record/index target/finding; no directory rows; topic files and retro notes represented by entry point/archive index | TC-MEMLAY-002 | Covered |
| AC-F2-1 | Required spine, closed optional set, and closed vocabularies identical across human format, machine contract, and capsule overlap; reconciliation table names each capsule element's disposition | TC-MEMSCHEMA-001 | Covered |
| AC-F2-2 | Each isolated schema violation yields exactly one matching `memory.schema.*` error naming file, field, and value name; no double-reporting under another area | TC-MEMSCHEMA-002, TC-MEMSCHEMA-004 | Covered |
| AC-F2-3 | Whole migrated tree renders every required key, zero schema findings, zero required-field drift | TC-MEMSCHEMA-003 | Covered |
| AC-F3-1 | Promotion home write renders full required spine (trust, basis) and a non-empty ≤120-char read-when hint derived from applicability with statement fallback; zero findings for record and row | TC-MEMWRITE-001, TC-MEMWRITE-002, TC-MEMWRITE-004 | Covered |
| AC-F3-2 | Curator rules agree with schema, id rule, status transitions, budgets, and row shape; consolidation pass yields a clean tree | TC-MEMWRITE-003 | Covered |
| AC-F4-1 | One line per error finding in declared order under own namespace; summary with record/area/error/advisory counts; non-zero on error, zero on advisories only; byte-identical repeated runs | TC-MEMGATE-001, TC-MEMGATE-002 | Covered |
| AC-F4-2 | Aggregate gate and CI invariants job invoke the same invariant, parity-tested; command inventory, error rows, domain kinds, doctor checks unchanged | TC-MEMGATE-004 | Covered |
| AC-F6-1 | Missing/malformed/future creation date each one `memory.dating.*` error; date never inferred from file name, commit, or clock | TC-MEMDATE-001 | Covered |
| AC-F6-2 | Revalidation required for authoritative behaviour-changing lesson; malformed is error; expired is non-gating advisory; entry-point capture-line dates match the declared shape | TC-MEMDATE-002 | Covered |
| AC-F7-1 | Evidence presence and shape, writer presence, source channel each classified; findings never echo a full evidence value | TC-MEMPROV-001 | Covered |
| AC-F7-2 | Three migrated records carry a trust level consistent with their recorded channel and a shaped evidence link, statements and statuses unchanged | TC-MEMPROV-002 | Covered |
| AC-F8-1 | Dangling supersedes/superseded_by/contradicts/link and asymmetric supersession each one `memory.reference.*` error; resolvable references produce none | TC-MEMREF-001, TC-MEMREF-002 | Covered |
| AC-F9-1 | Record without row → `memory.index.record-uncovered`; row without covered path → `memory.index.row-unbacked`; independent, one of each yields exactly two findings | TC-MEMINDEX-001 | Covered |
| AC-F9-2 | Empty/over-long hint, duplicate row, and rows targeting topic file/retro note/area directory each a `memory.index.*` error; archive index covers every note exactly | TC-MEMINDEX-002, TC-MEMINDEX-003 | Covered |
| AC-F10-1 | Over-cap index lines/bytes, agent/guild entry lines, archive index lines are errors naming file, measured value, cap; kernel 200–220 warn, >220 error; exactly at cap passes | TC-MEMBUDGET-001 | Covered |
| AC-F10-2 | Delivered tree measures within every cap: index ≤200 lines and ≤25 KB, entry points ≤150, archive index ≤200, kernel inside advisory band | TC-MEMBUDGET-002 | Covered |
| AC-F11-1 | File-listing and command-echo fenced blocks each one `memory.derivable.*` advisory, exit stays zero, advisory count reported; neither pattern → no finding | TC-MEMHEUR-001, TC-MEMHEUR-002 | Covered |
| AC-F12-1 | One `memory.secret.<class>` error per recognizer class naming path, line, and class, never the value; rule-id set equals the privacy vocabulary's classes exactly | TC-MEMSECRET-001 | Covered |
| AC-F12-2 | Documented placeholder or suppression marker inside a matched span produces no finding; markerless value of the same shape produces the finding | TC-MEMSECRET-002 | Covered |
| AC-F13-1 | Two agents on parallel branches create records in their own namespace; merge has zero conflicts, neither touches the other's files, both records covered after merge | TC-MEMCONC-001 | Covered |
| AC-F13-2 | Two promotion writes land two record files plus two index rows; no file conflict, both rows survive union resolution, no duplicate/orphan row, re-run adds nothing | TC-MEMCONC-002 | Covered |
| AC-F14-1 | Replacement guard asserts the invariant exists and is cited by both gate surfaces, and still asserts no memory subcommand, five doctor checks, unchanged error-table rows; old absence-only assertion gone | TC-MEMGUARD-001 | Covered |
| AC-NFR1-1 | Byte-identical output including order and truncation; zero writes, no network, no clock | TC-MEMGATE-002, TC-MEMGATE-003, TC-MEMNFR-001 | Covered |
| AC-NFR2-1 | Declared size bound completes inside the wall-clock bound, one read per file, no shell-out | TC-MEMNFR-002 | Covered |
| AC-NFR5-1 | At most 100 error findings and 100 advisories printed in deterministic order, followed by one truncation line with true totals | TC-MEMNFR-003 | Covered |
| AC-NFR7-1 | New user-facing docs registered where required; every new doc under a marker root carries `ados_distribution`; distribution guard zero drift | TC-MEMNFR-004 | Covered |
| AC-NFR8-1 | Clean checkout, repository-local TMPDIR, aggregate gate green including memory invariant, boundary, prompt/help conformance, distribution guard | TC-MEMNFR-005 | Covered |
| AC-NFR10-1 | Command inventory, error table, domain kinds, state record kinds, event topics, doctor check set identical to pre-change values | TC-MEMGUARD-002, TC-MEMGATE-004 | Covered |

**Coverage result: 30 of 30 ACs covered; zero TODO; zero orphan TCs.** Every scenario below maps to at least one AC from this table.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP or event surface is added or changed (spec §8.1/§8.2). The data-model surfaces are primary:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Canonical typed-record schema: required spine, closed optional set, closed vocabularies, id and file-name grammar, validity start, precedence rule | TC-MEMSCHEMA-001, TC-MEMSCHEMA-002, TC-MEMSCHEMA-003, TC-MEMSCHEMA-004 | Covered |
| DM-2 | Canonical tree layout and per-area budgets; placeholder semantics; absent fleet quarantine | TC-MEMLAY-001, TC-MEMLAY-002, TC-MEMLAY-003, TC-MEMLAY-004 | Covered |
| DM-3 | Index row and coverage contract: row shape, hint bound, coverage universe, explicitly-not-covered set, both-direction findings | TC-MEMINDEX-001, TC-MEMINDEX-002, TC-MEMINDEX-003, TC-MEMLAY-002 | Covered |
| DM-4 | Finding model: identity shape/register, area order, fields, severity, emission, exit, ceiling | TC-MEMSCHEMA-004, TC-MEMGATE-001, TC-MEMGATE-002, TC-MEMNFR-003 | Covered |
| DM-5 | Budget declaration single source (index lines/bytes, agent/guild/archive caps, kernel warn/error band) | TC-MEMBUDGET-001, TC-MEMBUDGET-002 | Covered |
| DM-6 | Capsule reconciliation: candidate key set (source tightened), trust/evidence vocabularies, read projection stability, additive promotion content, unchanged events/naming/close | TC-MEMSCHEMA-001, TC-MEMWRITE-004 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Determinism and read-only evaluation: byte-identical ordered output; zero writes, clock, randomness, network | TC-MEMGATE-002, TC-MEMGATE-003, TC-MEMNFR-001 | Covered |
| NFR-2 | Scan cost ≤1 s wall for ≤2,000 files or ≤8 MB, one read per file, linear | TC-MEMNFR-002 | Covered |
| NFR-3 | Gate overhead ≤1 s added to the aggregate local gate, measured and recorded | TC-MEMNFR-002 (measurement recorded in TC-MEMNFR-005 evidence) | Covered |
| NFR-4 | Tier and purity: pure domain evaluation, contracts data-only, file reading at adapter/edge, boundaries green | TC-MEMGATE-003, TC-MEMNFR-005 (boundary job) | Covered |
| NFR-5 | Bounded output: ≤100 errors and ≤100 advisories, one truncation line with true totals, deterministic under truncation | TC-MEMNFR-003 | Covered |
| NFR-6 | Local/CI parity on one invocation with a parity test | TC-MEMGATE-004 | Covered |
| NFR-7 | Documentation conformance: forbidden-literal registration and distribution markers, zero drift | TC-MEMNFR-004 | Covered |
| NFR-8 | Authoring-time gate green on a clean checkout with a repository-local TMPDIR | TC-MEMNFR-005 | Covered |
| NFR-9 | Secret hygiene of findings: path, line, class only — never a matched value | TC-MEMSECRET-001, TC-MEMPROV-001 | Covered |
| NFR-10 | No new surface: command, flag, error row, domain kind, state record, event, or doctor check | TC-MEMGUARD-002, TC-MEMGATE-004 | Covered |
| NFR-11 | Verdict stability under growth: no assertion that record count equals a fixed number; empty and growing areas both pass | TC-MEMLAY-004, TC-MEMSCHEMA-003 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a mixed TypeScript + docs change and runs every applicable layer. The pure evaluation is exercised in-process; the executable check and its mutations run through the check tier; tree and contract assertions live in the structure tier; promotion-writer and concurrency exercises live in the behaviour/integration tier.

- **Unit (pure domain evaluation).** `packages/core/src/domain/memory-lint.ts` and `packages/core/src/contracts/memory-record.ts` — pure functions over an injected file list and text map, with the privacy vocabulary and a fixed date injected. Tests import the module directly from `tests/checks/**` and feed fixture trees in memory; no filesystem writes inside the evaluation. Runner: `bun test`.
- **Check (repository invariant).** `scripts/checks/memory-lint.ts` — the bun-run edge that enumerates `.ai/memory/**`, parses YAML frontmatter, calls the pure evaluation, prints findings and the summary, and projects the exit. Mutation tests build a temporary tree, invoke the exported pure scan, and assert the exact finding identities. Execution of the live check: `bun run scripts/checks/memory-lint.ts`.
- **Behaviour.** `tests/behaviour/memory-promotion-schema.test.ts` uses `tests/fixtures/capsule/promotion.ts` (`makeTempMemory`, `makePromotionRuntime`, `candidateYaml`) to run the real promotion writer over a temporary memory root, then evaluate the written tree with the lint.
- **Integration (git).** `tests/behaviour/memory-concurrency-merge.test.ts` builds a temporary git repository, creates two branches that each add a distinct record file plus its own index row and own entry-point line, merges both, asserts zero conflicts and a clean post-merge lint.
- **Structure.** `tests/structure/**` asserts the committed tree shape, the three-way schema parity, the curator-rule parity, the gate/CI citation parity, and inventory equality.
- **Manual / semi-automated evidence.** Same-role parallel-worktree union resolution, the consolidation-pass spot review, and doc-diff review are manual and labelled as such. Timing evidence is recorded from an automated run but is environment-sensitive.
- **Static/diff (always).** `git diff --check`; changed-file review for naming/path conventions and for the boundary rule (no memory subcommand, no doctor area, no error identity).

**Gate battery and exact commands** (each row is evidence recorded in Section 10 and the plan-phase notes):

```bash
# 1. Aggregate local gate on a clean checkout with a repository-local TMPDIR
mkdir -p tmp/tmpdir
TMPDIR=$PWD/tmp/tmpdir pnpm check

# 2. The memory invariant on the delivered tree (must exit 0 with a summary)
bun run scripts/checks/memory-lint.ts

# 3. Targeted lint-area mutation suites while iterating
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-schema.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-dating.test.ts tests/checks/memory-lint-provenance.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-reference.test.ts tests/checks/memory-lint-index.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-budget.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-derivable.test.ts tests/checks/memory-lint-secret.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-output.test.ts tests/checks/memory-lint-wiring.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/memory-lint-performance.test.ts

# 4. Tree, schema, and gate structure assertions
TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/memory-layout.test.ts tests/structure/memory-record-schema.test.ts tests/structure/memory-lint-wiring.test.ts tests/structure/memory-lint-docs.test.ts

# 5. Behaviour and concurrency
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/memory-promotion-schema.test.ts tests/behaviour/memory-concurrency-merge.test.ts

# 6. Supplementary guards
bash scripts/.tests/test-doc-distribution.sh
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/privacy-literals.ts
git diff --check

# 7. Phase-9 supplementary commit-range gate (existing)
./scripts/lint-commit-range.sh --base <base>
```

`pnpm check` is `lint → format:check → typecheck → test → check:boundaries → prompt-conformance → help-guide-coverage → exports-parity`. The new `check:memory` invocation joins `check` and the CI `ts-invariants` step; the parity assertion in TC-MEMGATE-004 pins both citations. `bunfig.toml` discovery covers `tests/**`; fixtures stay un-named as `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type / Level | Automation | Priority | AC Coverage |
|-------|-------|--------------|------------|----------|-------------|
| TC-MEMLAY-001 | Canonical layout present in the committed tree | Structure | Automated | High | AC-F1-1 |
| TC-MEMLAY-002 | Placeholder, topic-file, retro-note, and directory-row semantics | Structure | Automated | High | AC-F1-2 |
| TC-MEMLAY-003 | Invented area and fleet quarantine absence (negative mutant) | Structure (negative) | Automated | High | AC-F1-1 |
| TC-MEMLAY-004 | Empty-tree and populated-tree verdict stability | Check | Automated | Medium | AC-F1-1, NFR-11 |
| TC-MEMSCHEMA-001 | Human/machine/capsule schema parity and reconciliation table | Structure (contract) | Automated | Critical | AC-F2-1, DM-6 |
| TC-MEMSCHEMA-002 | One-defect-per-case schema mutation table | Check | Automated | Critical | AC-F2-2 (seed SC-M2-S8-01) |
| TC-MEMSCHEMA-003 | Whole-tree conformance and zero drift surface | Check + Structure | Automated | Critical | AC-F2-3, NFR-11 |
| TC-MEMSCHEMA-004 | Closed finding-register conformance | Check | Automated | High | AC-F2-2, DM-4 |
| TC-MEMWRITE-001 | Promotion write renders full schema and hint; zero findings | Behaviour | Automated | Critical | AC-F3-1 |
| TC-MEMWRITE-002 | Read-when hint derivation and bound | Behaviour | Automated | High | AC-F3-1, DM-3 |
| TC-MEMWRITE-003 | Curator rules agree; consolidation pass clean | Structure + Manual | Semi-automated | High | AC-F3-2 |
| TC-MEMWRITE-004 | Capsule reconciliation and `source` tightening | Behaviour + Structure | Automated | High | AC-F3-1, DM-6 |
| TC-MEMGATE-001 | Exit verdict, finding lines, summary counts | Check | Automated | Critical | AC-F4-1 (seed SC-M2-S8-01) |
| TC-MEMGATE-002 | Determinism and declared ordering | Check | Automated | Critical | AC-F4-1, AC-NFR1-1 |
| TC-MEMGATE-003 | Read-only, clock-free, offline evaluation | Check + Structure | Automated | Critical | AC-NFR1-1, NFR-4 |
| TC-MEMGATE-004 | Aggregate gate and CI invariants wiring parity | Structure | Automated | Critical | AC-F4-2, AC-NFR10-1, NFR-6 |
| TC-MEMDATE-001 | Creation date presence, shape, future | Check | Automated | Critical | AC-F6-1 (seed SC-M2-S8-01) |
| TC-MEMDATE-002 | Revalidation windows and capture-line dates | Check | Automated | High | AC-F6-2 |
| TC-MEMPROV-001 | Evidence presence/shape, writer, source channel | Check | Automated | Critical | AC-F7-1 (seed SC-M2-S8-01), NFR-9 |
| TC-MEMPROV-002 | Migrated-records backfill fidelity | Structure + Manual | Semi-automated | High | AC-F7-2 |
| TC-MEMREF-001 | Dangling supersedes/superseded_by/contradicts/link | Check | Automated | High | AC-F8-1 |
| TC-MEMREF-002 | Resolvable references and asymmetry control | Check | Automated | High | AC-F8-1 |
| TC-MEMINDEX-001 | Both-direction coverage independence | Check | Automated | Critical | AC-F9-1 |
| TC-MEMINDEX-002 | Row shape, duplicate rows, wrong-target rows | Check | Automated | High | AC-F9-2 |
| TC-MEMINDEX-003 | Archive index covers notes exactly | Check | Automated | High | AC-F9-2 |
| TC-MEMBUDGET-001 | Cap boundaries and kernel bands | Check | Automated | Critical | AC-F10-1 |
| TC-MEMBUDGET-002 | Delivered tree within every cap (measured) | Check + Structure | Automated | Critical | AC-F10-2 |
| TC-MEMHEUR-001 | Derivable advisory classes (positive) | Check | Automated | High | AC-F11-1 |
| TC-MEMHEUR-002 | Derivable negative control and non-gating exit | Check | Automated | High | AC-F11-1 |
| TC-MEMSECRET-001 | One finding per recognizer class; no value echo; rule-id set | Check | Automated | Critical | AC-F12-1, NFR-9 |
| TC-MEMSECRET-002 | Suppression classes and markerless control | Check | Automated | Critical | AC-F12-2 |
| TC-MEMCONC-001 | Parallel-branch record creation, zero conflicts, coverage after merge | Integration | Automated | Critical | AC-F13-1 (seed SC-M2-S8-02) |
| TC-MEMCONC-002 | Two promotion writes and union-resolved index rows | Behaviour | Automated | Critical | AC-F13-2 (seed SC-M2-S8-02) |
| TC-MEMGUARD-001 | Negative guard replaced by presence + preserved absences | Structure | Automated | Critical | AC-F14-1 |
| TC-MEMGUARD-002 | Inventory equality (no new surface) | Structure | Automated | Critical | AC-NFR10-1 |
| TC-MEMNFR-001 | Byte-identical output and state-free run | Check | Automated | Critical | AC-NFR1-1 |
| TC-MEMNFR-002 | Scan cost and gate overhead | Check (performance) | Automated | Medium | AC-NFR2-1, NFR-3 |
| TC-MEMNFR-003 | Output ceiling and truncation line | Check | Automated | High | AC-NFR5-1 |
| TC-MEMNFR-004 | Documentation conformance and distribution drift | Structure + shell guard | Automated | High | AC-NFR7-1 |
| TC-MEMNFR-005 | Full gate battery green at delivered HEAD | Manual execution of automated commands | Semi-automated | Critical | AC-NFR8-1 |

### 5.2 Scenario Details

#### TC-MEMLAY-001 - Canonical layout present in the committed tree

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-2, NG-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-layout.test.ts` reading `.ai/memory/**`
**Tags**: @bun, @structure, @memory

**Given / When / Then**: Given the delivered repository, when the committed memory tree is enumerated, then it contains the root index, `lessons/`, `tacit/`, `preferences/`, `guilds/<guild>/`, `retro/` with `retro/INDEX.md`, one entry point for each agent folder, and one entry point for each guild folder — and no area outside that set.

**Preconditions**:

- The layout phase has landed the new areas and their placeholder files.
- `.ai/memory/README.md` exists at the tree root.

**Steps**:

1. Enumerate the committed tree under `.ai/memory/` (directories and files, excluding `node_modules`/`dist` which do not exist there).
2. Assert the presence of the index root, the four durable record areas, the retro archive with its archive index, and no `external/` directory.
3. Assert every agent folder under `.ai/memory/agents/` contains a `README.md`, and every guild folder under `.ai/memory/guilds/` contains a `README.md`.
4. Assert every empty area carries `.gitkeep` (a proven-empty area, not an absent one).

**Expected Outcome**:

- The area set equals DM-2 exactly; every canonical element is present; nothing invented is present.

**Notes / Clarifications**:

- The assertion is structural, not a count of records: the tree may grow without editing this test (NFR-11).
- **Fixture / mutant**: reads the live tree; negative variant is TC-MEMLAY-003.

#### TC-MEMLAY-002 - Placeholder, topic-file, retro-note, and directory-row semantics

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-1, F-9, AC-F1-2, DM-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-layout.test.ts` + `tests/checks/memory-lint-index.test.ts` (shared semantics)
**Tags**: @bun, @structure, @memory

**Given / When / Then**: Given the completed tree, when placeholder and directory rules are applied, then `.gitkeep` is neither a record, an index target, nor a finding; no record area has a directory row; and topic files and retro notes are represented by their entry point or archive index rather than by their own rows.

**Preconditions**:

- TC-MEMLAY-001 passes.
- The lint's covered-path classifier is importable.

**Steps**:

1. Feed a fixture tree containing `.gitkeep`, a topic file beside an entry point, a retro note under `retro/<year>/`, and a directory row attempt for `lessons/` to the pure coverage evaluation.
2. Assert `.gitkeep` produces no finding and is not required to be indexed.
3. Assert the topic file and the retro note produce no `record-uncovered` finding.
4. Assert the directory row produces a `memory.index.row-malformed` (or the register's wrong-target identity) — a directory is not a covered path.

**Expected Outcome**:

- Placeholder and representation rules hold; no false positives on legitimate non-covered files; directory rows are rejected.

**Notes / Clarifications**:

- **Fixture / mutant**: in-memory fixture tree (Section 6) with the four shapes; no temporary filesystem needed for the pure evaluation.

#### TC-MEMLAY-003 - Invented area and fleet quarantine absence (negative mutant)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NG-5, DEC-2
**Test Type(s)**: Structure (negative)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-layout.test.ts`
**Tags**: @bun, @structure, @memory

**Given / When / Then**: Given a temporary copy of the tree, when an invented area (`external/` or an undeclared top-level area) is added, then the layout assertion fails naming the extra area; when the unmodified tree is checked, then it passes.

**Preconditions**:

- The canonical area set is pinned as a constant in the test module (one deliberate edit updates it).

**Steps**:

1. Copy the committed tree to a temporary directory and add `.ai/memory/external/README.md`.
2. Run the layout assertion against the temporary root; assert a failure naming `external`.
3. Run the same assertion against the live root; assert success.
4. Assert no committed path under `.ai/memory/` contains an `external` directory.

**Expected Outcome**:

- The negative control proves the assertion is non-vacuous; the fleet quarantine area is absent.

**Notes / Clarifications**:

- **Fixture / mutant**: temp-copy mutation, following `tests/checks/forbidden-literals.test.ts` and `tests/checks/error-table-sync.test.ts` patterns.

#### TC-MEMLAY-004 - Empty-tree and populated-tree verdict stability

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-1, NFR-11
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts` (verdict stability block)
**Tags**: @bun, @check, @memory

**Given / When / Then**: Given an empty-but-proved tree (all record areas contain only `.gitkeep`) and a populated tree (at least one record per area), when the invariant runs on each, then both exit zero with no error findings; the summary reports record and area counts without asserting a fixed population.

**Preconditions**:

- The pure evaluation accepts an injected file map; the fixture builder can produce both shapes.

**Steps**:

1. Build the empty-but-proved in-memory tree; run the evaluation; assert zero error findings for every area.
2. Build the populated tree with one valid record per area plus the required index rows; assert zero error findings.
3. Assert the summary's record/area counts differ between the two runs and that neither run asserts a fixed record count.

**Expected Outcome**:

- Findings assert meaning, not population size; growth and emptiness are both green when well-formed.

**Notes / Clarifications**:

- **Fixture / mutant**: `tests/fixtures/memory/tree.ts` builders `emptyTree()` and `populatedTree()`; the populated builder is reused by TC-MEMSCHEMA-003.

#### TC-MEMSCHEMA-001 - Human/machine/capsule schema parity and reconciliation table

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, DM-6, NFR-10
**Test Type(s)**: Structure (contract)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-record-schema.test.ts` reading the machine contract, `.ai/memory/README.md`, and `packages/core/src/contracts/capsule.ts`
**Tags**: @bun, @structure, @contract, @memory

**Given / When / Then**: Given the published schema, when a record is read against it, then the required spine and the closed optional set are identical in the human README format and the machine contract; every closed vocabulary matches (including where it overlaps the capsule contract); and the README's reconciliation table names, per capsule element, whether it changes.

**Preconditions**:

- The schema phase has landed `packages/core/src/contracts/memory-record.ts` and the README rewrite.
- The README's record-format block is parseable as a fenced YAML example with key comments.

**Steps**:

1. Import the machine contract's required keys, optional keys, and closed vocabulary constants.
2. Parse the README's record-format example and extract the keys it presents as required and optional.
3. Assert set equality for required and optional key sets, and assert every vocabulary constant appears verbatim in the README's documented value lists.
4. Assert the capsule overlap: `trust` equals `CAPSULE_CANDIDATE_TRUST`; the evidence-link prefixes match the capsule's five prefixes; `source` equals the schema's four-value channel set; `status` is the schema subset declared for the capsule.
5. Parse the reconciliation table and assert it names each DM-6 capsule element (candidate required set, trust vocabulary, evidence shapes, read projection, promotion write content, promotion read scope, events/naming/close) with a change/no-change disposition.
6. Assert the README's published format is labelled the human rendering of the machine contract (precedence rule present).

**Expected Outcome**:

- Zero drift between the human format and the machine contract; the capsule overlap is exact; the reconciliation table is complete.

**Notes / Clarifications**:

- **Fixture / mutant**: reads live files. A mutant case rewrites the machine contract's required-key list in a temp copy and asserts the parity test fails naming the missing key (non-vacuity).

#### TC-MEMSCHEMA-002 - One-defect-per-case schema mutation table

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-5, AC-F2-2, DM-1, DM-4 (seed SC-M2-S8-01)
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-schema.test.ts` (table-driven over the provided tree)
**Tags**: @bun, @check, @memory, @schema

**Given / When / Then**: Given a record violating the schema in exactly one way, when the invariant runs, then exactly one `memory.schema.*` error finding of the matching rule id names the file, the field, and the offending value's name, and no other area reports that defect.

**Preconditions**:

- The pure evaluation is importable and the tree builder can seed one record plus a valid index row.
- The valid baseline record renders every required key.

**Steps**:

1. For each row of the mutation table below, build a tree containing one mutated record (and a valid index row) and run the evaluation.
2. Assert exactly one finding in the `schema` area with the expected rule id.
3. Assert no finding from `dating`, `provenance`, `reference`, `index`, `budget`, `derivable`, or `secret` for the same defect (no double-reporting).
4. Assert the detail contains the record path and the offending key's name; assert it does not contain an echoed secret or a full evidence value.

**Mutation table (one defect per case, per AC-F2-2 and Appendix A):**

| # | Mutant | Expected rule id |
|---|--------|------------------|
| 1 | frontmatter block absent | `memory.schema.frontmatter-missing` |
| 2 | frontmatter present but unparseable YAML | `memory.schema.frontmatter-malformed` |
| 3 | one required key removed (id) | `memory.schema.keys-missing` |
| 4 | an undeclared key added (`fifth_variation`) | `memory.schema.key-unknown` |
| 5 | id outside the grammar (`Lesson_2026_1`) | `memory.schema.id-malformed` |
| 6 | second record reusing an existing id | `memory.schema.id-duplicate` |
| 7 | file name not beginning with its id | `memory.schema.file-name-mismatch` |
| 8 | non-empty value outside a closed vocabulary (`kind: memory`) | `memory.schema.value-unknown` |
| 9 | statement above the declared bound | `memory.schema.statement-too-long` |
| 10 | preference record whose source is not `human_correction` | `memory.schema.preference-source` |
| 11 | guild tag disagreeing with the guild directory | `memory.schema.guild-mismatch` |
| 12 | guild tag present outside a guild folder | `memory.schema.guild-mismatch` |
| 13 | superseded record without `superseded_by` | `memory.schema.superseded-by-missing` |

**Expected Outcome**:

- Thirteen isolated cases, thirteen matching findings, zero cross-area noise.

**Notes / Clarifications**:

- This is the ticket's "lint fails on a record missing id" artifact in its isolated form; the combined missing-id/date/evidence case is TC-MEMGATE-001 + TC-MEMDATE-001 + TC-MEMPROV-001 and seed SC-M2-S8-01.
- **Fixture / mutant**: `tests/fixtures/memory/mutants.ts` exports one record text per row; the baseline record is the single source reused by every area suite.

#### TC-MEMSCHEMA-003 - Whole-tree conformance and zero drift surface

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-1, NFR-11
**Test Type(s)**: Check + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-schema.test.ts` (live-tree block) and `tests/structure/memory-record-schema.test.ts`
**Tags**: @bun, @check, @structure, @memory

**Given / When / Then**: Given the whole migrated tree, when the invariant runs at the delivered HEAD, then every record renders every required key, zero schema findings are reported, and no required field exists in the schema and is absent from a rendered record.

**Preconditions**:

- Layout and migration have landed (tree-green rule: the gate is enabled only after this passes).
- The delivered tree contains the three migrated records and any new records added by this change.

**Steps**:

1. Run `bun run scripts/checks/memory-lint.ts` and assert exit 0, zero `memory.schema.*` findings, and a summary naming the record count.
2. Independently, enumerate every `.md` file under the four record areas, parse frontmatter, and assert the required key set is present in each.
3. Compute the drift set: required keys in the contract minus keys rendered anywhere in the tree; assert it is empty.
4. Assert every record's `kind` matches its area and every record's `guild` matches its folder when under `guilds/`.

**Expected Outcome**:

- Zero schema findings on the delivered tree; the drift surface is empty.

**Notes / Clarifications**:

- The test must not assert a fixed record count (NFR-11); it asserts per-record conformance and a `toBeGreaterThan(0)` non-vacuity floor.
- **Fixture / mutant**: live tree; the populated fixture from TC-MEMLAY-004 is the mutation-free control.

#### TC-MEMSCHEMA-004 - Closed finding-register conformance

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F2-2, DM-4, Appendix A
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-schema.test.ts` (register block)
**Tags**: @bun, @check, @memory

**Given / When / Then**: Given Appendix A's closed register, when the check emits any finding, then its rule id exists in the register, belongs to the declared area order, and carries the declared severity; no id outside the register is emitted.

**Preconditions**:

- The register is exported as `as const` from the schema contract.

**Steps**:

1. Import the register and assert it contains exactly the Appendix A ids, grouped by area order `schema, dating, provenance, reference, index, budget, derivable, secret`.
2. Run the whole negative-mutant suite and collect every emitted rule id; assert each is a member of the register.
3. Assert severity projection: every area is `error` except `derivable.*` and `memory.dating.revalidate-expired` and the kernel band finding above 200 at or below 220, which are `warn`.
4. Attempt an artificial emission of an unregistered id through the pure evaluation's classifier and assert it is impossible (type-level or runtime guard).

**Expected Outcome**:

- The register is the only source of identities; no ad-hoc id can escape.

**Notes / Clarifications**:

- **Fixture / mutant**: mutant case injects a fabricated raw finding id at the pure-evaluation boundary and asserts rejection/absence.

#### TC-MEMWRITE-001 - Promotion write renders full schema and hint; zero findings

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DM-1, DM-3, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-promotion-schema.test.ts` using `tests/fixtures/capsule/promotion.ts`
**Tags**: @bun, @behaviour, @memory

**Given / When / Then**: Given a capsule candidate that passes the capture bar and evidence rules, when the promotion home write is applied, then the written record carries every required schema key including `trust` and `basis`, the appended index row's second column is a non-empty read-when hint of at most 120 characters, and the invariant reports zero findings for that record and that row.

**Preconditions**:

- The promotion writer is extended to render the schema and the hint (write-path phase).
- `makeTempMemory` seeds an index with a table header; `candidateYaml` produces a valid candidate.

**Steps**:

1. Run `runPromotionCloseout` with one valid lesson candidate over a temp memory root.
2. Parse the written record's frontmatter and assert the required spine is complete, including `trust` in T0–T5 and a `basis` from the five capture-bar bases.
3. Parse the appended index row; assert path in backticks, non-empty second column, `length <= 120`, and that it answers "when do I read this" (derived from `applies_when`).
4. Run the pure memory evaluation over the temp root's text map; assert zero findings for the record and the row.

**Expected Outcome**:

- A promoted record passes the new gate on the first attempt; no field is rendered by the writer that the schema does not accept, and none required is omitted.

**Notes / Clarifications**:

- This is the DoD-4 evidence and the "promoted record plus its row yields zero findings" clause of ACC-F3-1.
- **Fixture / mutant**: real writer via `makePromotionRuntime`; a mutant candidate with `trust` removed from the rendered write (test hook) must fail TC-MEMSCHEMA-002's missing-key case at the record level.

#### TC-MEMWRITE-002 - Read-when hint derivation and bound

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, DEC-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-promotion-schema.test.ts` (hint block)
**Tags**: @bun, @behaviour, @memory

**Given / When / Then**: Given a candidate with an applicability statement, when the row is rendered, then the hint is the applicability statement; given none, then the hint falls back to the truncated statement; in both cases the hint is non-empty and at most 120 characters.

**Preconditions**:

- The hint derivation is a pure function in the promotion writer or its domain helper.

**Steps**:

1. Render with `applies_when` present; assert the second column equals the applicability statement (normalized) when within the bound.
2. Render with `applies_when` absent; assert the second column falls back to the statement.
3. Render with a long statement; assert truncation to 120 characters and no empty column.
4. Feed each rendered row to the index-shape evaluation; assert no `hint-missing` or `row-malformed`.

**Expected Outcome**:

- One row shape everywhere; the second column always reads as a read-when hint.

**Notes / Clarifications**:

- **Fixture / mutant**: `candidateYaml` overrides for `applies_when` present, absent, and over-long.

#### TC-MEMWRITE-003 - Curator rules agree; consolidation pass clean

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-1, DM-2, DM-3
**Test Type(s)**: Structure + Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/memory-record-schema.test.ts` (curator block) + manual consolidation spot review
**Tags**: @bun, @structure, @memory, @manual

**Given / When / Then**: Given the curator skill's written rules, when compared with the schema, the id-allocation rule, the status transitions, the budgets, and the row shape, then they agree with zero contradictions; and a consolidation pass that follows them produces a tree the invariant reports clean.

**Preconditions**:

- `.opencode/skills/consolidate-memory/SKILL.md` is reconciled in the write-path phase.

**Steps**:

1. Automated: read the skill and assert it names the required key set, the monotonic id rule and non-reuse-after-prune, the five statuses with writer-emitted subset, the budget caps, and the read-when row shape; assert no contradicting instruction (for example a different required field list) is present.
2. Automated: assert the skill's permissible operations still include duplicate merge, demote/drop, supersession, prune-with-reason, split-into-topic-files, and index rebuild.
3. Manual: perform a consolidation pass in a temporary copy of the tree (merge a duplicate pair, mark a supersession, split an over-cap entry point), then run the invariant; record the clean verdict in Section 10.
4. Manual: record the skill-content comparison verdict in the plan phase notes.

**Expected Outcome**:

- Rules and gate agree; a curator pass cannot author a record its own gate rejects.

**Notes / Clarifications**:

- The consolidation pass is deliberately manual: it is a human/skill workflow, not code under test. Automation covers the written-rule parity only; this split is stated rather than overclaimed.
- **Fixture / mutant**: live skill file; temporary tree copy for the manual pass.

#### TC-MEMWRITE-004 - Capsule reconciliation and `source` tightening

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-6, DEC-8, RSK-7
**Test Type(s)**: Behaviour + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-promotion-schema.test.ts` (capsule block) and `tests/structure/memory-record-schema.test.ts`
**Tags**: @bun, @behaviour, @structure, @memory

**Given / When / Then**: Given a candidate whose `source` is free text outside the four declared channels, when candidate schema validation runs, then closeout refuses it through the existing `closeout.capsule-invalid` identity; given a valid candidate, then the memory-record read projection is unchanged (`{id, class, statement, status, path}`) and no candidate field, event, or naming rule changed.

**Preconditions**:

- The candidate contract tightening is additive on an already-required key (DEC-8).
- `runPromotionCloseout` returns the envelope error code.

**Steps**:

1. Run a candidate with `source: "anecdotally"`; assert exit 1 and error code `closeout.capsule-invalid`.
2. Run a candidate with each of the four valid channels; assert acceptance and a promotion decision.
3. Assert the read projection keys and the candidate required-key set are unchanged apart from `source`'s closed validation.
4. Assert the candidate file naming (`<id>.yaml`), event topics, and terminal-close behaviour are untouched by a focused structure assertion over the capsule contract and closeout fixtures.

**Expected Outcome**:

- The tightening refuses an illegitimate source without widening the capsule contract; no other capsule element changed.

**Notes / Clarifications**:

- **Fixture / mutant**: `candidateYaml({ source: ... })`; the existing `tests/behaviour/closeout-capsule-schema.test.ts` table is extended only if the plan places it there, otherwise this test owns it.

#### TC-MEMGATE-001 - Exit verdict, finding lines, summary counts

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-4, NFR-5 (seed SC-M2-S8-01)
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts`
**Tags**: @bun, @check, @memory, @exit

**Given / When / Then**: Given a tree with at least one error finding, when the invariant runs, then it prints one line per error in the declared order under its own namespace, prints the summary with record/area/error/advisory counts, and exits non-zero; given advisories only, then advisory lines and the summary print with the same order and the exit is zero.

**Preconditions**:

- The check edge exposes a runnable function returning `{ findings, summary, exitCode }` and a CLI entry for the live run.

**Steps**:

1. Build a temp tree with one missing-id record (seed SC-M2-S8-01 combined case: missing id, date, and evidence across three records), run the check, capture stdout and exit code.
2. Assert exit code is 1, one `FAIL memory.*` line per error finding, and the summary line carries non-zero record/area/error counts and the exact advisory count.
3. Build an advisory-only tree (one derivable block, one expired revalidation); assert exit 0, `WARN memory.*` lines, and an advisory count > 0.
4. Run the check over the delivered tree; assert exit 0 and a summary.

**Expected Outcome**:

- One exit contract: non-zero iff at least one error; advisory-only is zero; summary always present.

**Notes / Clarifications**:

- Ticket artifact 1 (missing id/date/evidence → fail) is proven here at the verdict level and in the isolated area suites.
- **Fixture / mutant**: `tests/fixtures/memory/tree.ts` `errorTree()` / `advisoryTree()`; stdout captured with `spawnSync` as in `tests/checks/ci-checks.test.ts`.

#### TC-MEMGATE-002 - Determinism and declared ordering

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, AC-NFR1-1, DM-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts` (determinism/order block)
**Tags**: @bun, @check, @memory, @determinism

**Given / When / Then**: Given an unchanged tree, when two consecutive runs execute, then the finding output is byte-identical; and the findings are ordered by area order, then repository-relative path, then line, then rule id.

**Preconditions**:

- The evaluation is deterministic and file enumeration is sorted.

**Steps**:

1. Run the check twice over the same temp tree with findings in several areas; assert byte equality of stdout and identical exit codes.
2. Construct a tree with two findings in one file, one line-scoped and one record-scoped, and findings across areas; assert the output order matches `(area index, path, line, rule id)`.
3. Assert the pure evaluation does not consult `Date.now()`: inject a clock that throws if called; assert the run succeeds.
4. Assert repeated runs over the live tree also produce identical output.

**Expected Outcome**:

- Byte-identical repeated output; declared ordering holds; no clock dependency.

**Notes / Clarifications**:

- **Fixture / mutant**: multi-area `errorTree()`; a `throwingClock` injection helper.

#### TC-MEMGATE-003 - Read-only, clock-free, offline evaluation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-4, F-4
**Test Type(s)**: Check + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts` (read-only block) + boundary suite
**Tags**: @bun, @check, @boundaries, @memory

**Given / When / Then**: Given the live repository, when the invariant runs, then the working tree is byte-identical before and after; the pure evaluation receives an injected file map (no filesystem access, no network, no clock); and the domain/contract modules declare no runtime I/O import.

**Preconditions**:

- The scanner adapter is the only fs-reading module; the pure evaluation is in the domain tier.

**Steps**:

1. Record `git status --porcelain` before and after `bun run scripts/checks/memory-lint.ts`; assert equality (mirrors `forbidden-literals.test.ts`).
2. Static assertion: the domain module's imports contain no `node:fs`, `node:child_process`, `node:net`, or `fetch`; the contract module exports data/types only.
3. Static assertion: the edge module owns the only `readFileSync`/`readdirSync` usage and the only YAML parse.
4. Run `pnpm check:boundaries` (or `bun test tests/boundaries`) and assert green, including the new modules in the inventory.

**Expected Outcome**:

- The invariant mutates nothing, calls no network, reads no clock; purity and boundary rules hold.

**Notes / Clarifications**:

- **Fixture / mutant**: live tree; a mutant domain module importing `node:fs` is added to a temp dependency-cruiser probe only if the boundary fixture coverage requires it (the fixture-coverage meta-check fails an unfixtured rule).

#### TC-MEMGATE-004 - Aggregate gate and CI invariants wiring parity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, F-14, AC-F4-2, AC-NFR10-1, NFR-6, DM-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-lint-wiring.test.ts` extending `tests/checks/ci-wiring.test.ts` and `tests/structure/content-inventory.test.ts` patterns
**Tags**: @bun, @structure, @ci, @memory

**Given / When / Then**: Given the delivered gate surfaces, when the aggregate local gate and the CI invariants job are inspected, then both execute the same `scripts/checks/memory-lint.ts` invocation, a parity test asserts both citations, and the command inventory, error-table rows, domain kinds, and doctor check set are unchanged.

**Preconditions**:

- Package scripts and `.github/workflows/ci.yml` are edited in the enforcement phase.

**Steps**:

1. Read `package.json`; assert `scripts.check` contains the memory check invocation and a dedicated `check:memory` script points at `scripts/checks/memory-lint.ts`.
2. Read `.github/workflows/ci.yml`; assert the `ts-invariants` job's static-check step runs the same path.
3. Assert both citations use the identical command string (parity helper shared with the check).
4. Assert `tests/structure/inventory.json` lists the new `packages/**` modules and the check's exported entry, so the inventory equality test stays green.
5. Assert `tests/checks/ci-wiring.test.ts`-style pins are extended (aggregate string and dedicated script) and that mutating either surface in a temp copy makes the parity assertion fail naming the surface.
6. Assert no new doctor check, CLI command, error-table row, or domain kind appears (delegated to TC-MEMGUARD-002 for the full inventory).

**Expected Outcome**:

- One invocation, two surfaces, parity proven; the aggregate command string is pinned; mutation of either surface fails loudly.

**Notes / Clarifications**:

- **Fixture / mutant**: temp-copy mutation of `package.json`/`ci.yml` (the `boundary-ci-parity.test.ts` technique) proves the parity test is non-vacuous.

#### TC-MEMDATE-001 - Creation date presence, shape, future

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DM-1, DM-4 (seed SC-M2-S8-01)
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-dating.test.ts`
**Tags**: @bun, @check, @memory, @dating

**Given / When / Then**: Given a record with no creation date, a malformed creation date, or a future creation date, when the invariant runs, then each is one `memory.dating.*` error naming the file and the value's name; the date is never inferred from a file name, a commit, or the current clock.

**Preconditions**:

- A fixed "today" is injected into the evaluation (for example `2026-11-15`) so the future test is deterministic.

**Steps**:

1. Mutant table: `created` absent → `memory.dating.created-malformed`; `created: "15/11/2026"` → `created-malformed`; `created: "2027-01-01"` (after injected today) → `created-future`.
2. Assert exactly one finding per case, naming the path and `created`; assert no `schema.keys-missing` finding for the absent-date case if `created` is required at the schema layer — the expectation is defined once in the plan phase (see Section 8.3 OQ-TP-2) and whatever classification is chosen must be single-area.
3. Assert a record with a valid created date produces no dating finding.
4. Assert a file named `lesson-2026-001` with no `created` key does not infer `2026` from the file name and still reports the dating finding.

**Expected Outcome**:

- Dating is enforced from the record only; no inference path exists.

**Notes / Clarifications**:

- **Fixture / mutant**: `mutants.ts` dating rows. The absent-`created` case is also the ticket's "missing date" artifact, asserted here and at the verdict level in TC-MEMGATE-001.

#### TC-MEMDATE-002 - Revalidation windows and capture-line dates

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DM-1, DM-5, DEC-6
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-dating.test.ts` (revalidation block)
**Tags**: @bun, @check, @memory, @dating

**Given / When / Then**: Given an authoritative behaviour-changing lesson with no revalidation date, and a record with a malformed revalidation date, and a record whose revalidation date has passed, then the first two are `memory.dating.*` errors and the expired window is a `memory.dating.revalidate-expired` advisory that does not change the exit; given a per-agent entry-point capture line, then its date must match the declared date shape or it is a dating error.

**Preconditions**:

- The evaluation can be configured with the fixed today date.
- An entry-point fixture contains a capture line.

**Steps**:

1. Mutant: authoritative lesson missing `revalidate_after` → `memory.dating.revalidate-missing` error.
2. Mutant: `revalidate_after: "next week"` → `revalidate-malformed` error.
3. Mutant: `revalidate_after` before injected today on a non-authoritative record → `revalidate-expired` warn, exit 0.
4. Mutant: entry-point capture line `- 2026/11/10: note` → `memory.dating.entry-line-date` error; a valid `- 2026-11-10: note` produces no finding.
5. Assert authoritative non-behaviour-changing lesson without revalidation is not an error (boundary of the requirement).

**Expected Outcome**:

- Errors and the one advisory are separated exactly; the exit is unchanged by expiry.

**Notes / Clarifications**:

- **Fixture / mutant**: entry-point fixture under `tests/fixtures/memory/agents/`; revalidation rows in `mutants.ts`.

#### TC-MEMPROV-001 - Evidence presence/shape, writer, source channel

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DM-1, DM-4, NFR-9 (seed SC-M2-S8-01)
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-provenance.test.ts`
**Tags**: @bun, @check, @memory, @provenance

**Given / When / Then**: Given a record with no evidence link, an empty evidence link, or a non-empty evidence value outside the five declared shapes, then each is exactly one `memory.provenance.*` error naming the file and never echoing a full evidence value; given a record missing its writer or a source outside the four channels, then each is one error of the matching rule id.

**Preconditions**:

- The five evidence prefixes are imported from the capsule contract (single source).

**Steps**:

1. Mutant table:
   - `evidence` absent → `memory.provenance.evidence-missing`.
   - `evidence: ""` → `evidence-missing` (empty is not a shape).
   - `evidence: "we all agreed"` → `evidence-shape-unknown`.
   - `created_by` absent → `created-by-missing`.
   - `source: "slack"` → the matching provenance rule for an unknown channel (as classified in the register).
2. For each, assert exactly one finding in the `provenance` area, naming the path and the field.
3. Assert the finding text never contains the full evidence value or any recognizer-matched substring; only the field name is echoed.
4. Assert each of the five valid evidence shapes produces no finding; assert each of the four source channels produces no finding.

**Expected Outcome**:

- Provenance is enforced; findings are redaction-safe; valid shapes and channels pass.

**Notes / Clarifications**:

- Ticket artifact 1's "missing evidence → fail" is this table plus TC-MEMGATE-001.
- **Fixture / mutant**: `mutants.ts` provenance rows; the valid-shape matrix is generated from the imported prefix constants.

#### TC-MEMPROV-002 - Migrated-records backfill fidelity

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DEC-12, DM-1
**Test Type(s)**: Structure + Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/memory-record-schema.test.ts` (migration block) + review of the migration diff
**Tags**: @bun, @structure, @memory, @manual

**Given / When / Then**: Given the migrated tree, when the three pre-existing records are inspected, then each carries a trust level consistent with its recorded evidence channel, a shaped evidence link expressing the same evidence as before, and an unchanged statement and status.

**Preconditions**:

- The migration phase has backfilled the three records.
- The pre-change statement/status values are captured in the plan phase notes (or the spec's context) for comparison.

**Steps**:

1. Automated: for each of the three records, assert `trust` is a T0–T5 value consistent with its source channel under the published trust table, and `evidence` starts with one of the five declared prefixes.
2. Automated: assert `id`, `statement`, and `status` are byte-identical to the recorded pre-migration values pinned in the test as constants.
3. Automated: assert the record body text is unchanged apart from the backfilled frontmatter keys.
4. Manual: review the migration diff at review time and record "schema backfill, not a semantic rewrite" in Section 10.

**Expected Outcome**:

- Backfill adds fields only; meaning, statement, and status are preserved; the trust assignment is traceable to the evidence channel.

**Notes / Clarifications**:

- **Fixture / mutant**: live records; pinned constants are updated deliberately only if a future change renames a record (supersede-never-rewrite).

#### TC-MEMREF-001 - Dangling supersedes/superseded_by/contradicts/link

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-1, DM-3
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-reference.test.ts`
**Tags**: @bun, @check, @memory, @reference

**Given / When / Then**: Given a record whose supersession, replacement, or contradiction link names no existing record, a supersession that is not symmetric across the pair, or an in-tree relative link that resolves to no file, then each is one `memory.reference.*` error naming the file and the offending reference.

**Preconditions**:

- The evaluation resolves ids against the scanned record set and relative links against the injected file set.

**Steps**:

1. Mutant table:
   - `supersedes: ["lesson-2026-999"]` with no such record → `memory.reference.supersedes-dangling`.
   - `superseded_by: "lesson-2026-999"` → `superseded-by-dangling`.
   - Record A supersedes B while B lacks `superseded_by: A` → `supersede-asymmetry`.
   - `contradicts: ["tacit-2026-999"]` → `contradicts-dangling`.
   - Body relative link `[note](../nowhere.md)` → `link-dangling`.
2. Assert each case yields exactly one finding in the `reference` area and the detail includes the offending reference string.
3. Assert no `schema.*` finding is produced for the same mutant (no double-reporting).

**Expected Outcome**:

- Every reference class is classified with the offending id/path in the detail.

**Notes / Clarifications**:

- **Fixture / mutant**: `mutants.ts` reference rows; the pair tree builder seeds both records for the asymmetry case.

#### TC-MEMREF-002 - Resolvable references and asymmetry control

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-8, AC-F8-1
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-reference.test.ts` (control block)
**Tags**: @bun, @check, @memory, @reference

**Given / When / Then**: Given a symmetric supersession pair, a resolvable contradiction, and a relative link that resolves, when the invariant runs, then zero `memory.reference.*` findings are produced.

**Preconditions**:

- TC-MEMREF-001's mutants are pinned.

**Steps**:

1. Build record A (`supersedes: [B]`) and B (`superseded_by: A`) plus a resolvable link and contradiction; run the evaluation.
2. Assert zero findings in the `reference` area.
3. Remove B from the tree; re-run; assert both `supersedes-dangling` and `superseded-by-dangling` (or asymmetry) appear — the negative control proving the positive case is not vacuous.

**Expected Outcome**:

- Resolvable references are silent; removing the target makes the same tree noisy.

**Notes / Clarifications**:

- **Fixture / mutant**: symmetric pair builder; deletion mutant.

#### TC-MEMINDEX-001 - Both-direction coverage independence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-9, AC-F9-1, DM-3, DM-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-index.test.ts`
**Tags**: @bun, @check, @memory, @index

**Given / When / Then**: Given a record file with no index row, then one `memory.index.record-uncovered` error names the record path; given an index row whose path is not a covered path, then one `memory.index.row-unbacked` error names the row's path; the two directions are independent, so a tree with one of each yields exactly two findings.

**Preconditions**:

- The covered-path universe is computed from the injected file set (four record areas, agent entry points, guild entry points, archive index).

**Steps**:

1. Build a tree with one record and no row; assert exactly one `record-uncovered` naming the record.
2. Build a tree with one row pointing at a nonexistent record; assert exactly one `row-unbacked` naming the path.
3. Build a tree with both defects; assert exactly two findings, one of each rule id, with distinct paths.
4. Build a fully covered tree; assert zero index findings.

**Expected Outcome**:

- Both directions proven independently; the combined case is exactly two findings (ticket artifact 2).

**Notes / Clarifications**:

- Ticket artifact 2 is this test; the archive-index form is TC-MEMINDEX-003.
- **Fixture / mutant**: `indexTree({ records, rows })` builder in `tests/fixtures/memory/tree.ts`.

#### TC-MEMINDEX-002 - Row shape, duplicate rows, wrong-target rows

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DM-3
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-index.test.ts` (row shape block)
**Tags**: @bun, @check, @memory, @index

**Given / When / Then**: Given an index row with an empty or over-long read-when hint, a duplicated row for one covered path, and a row resolving to a topic file, a retro note, or an area directory, then each is one `memory.index.*` error of the matching rule id.

**Preconditions**:

- TC-MEMINDEX-001 passes.
- The row parser tolerates the delivered two-column table format.

**Steps**:

1. Row with empty second column → `memory.index.hint-missing`.
2. Row with a 121-character hint → `memory.index.row-malformed`.
3. Two rows for one record → `memory.index.row-duplicate` for the second.
4. Row pointing at a topic file, a retro note, or `lessons/` → `memory.index.row-malformed` (wrong target).
5. Boundary: hint of exactly 120 characters and a single row produce no finding.

**Expected Outcome**:

- Row-shape and target rules enforced, with a boundary at 120 characters.

**Notes / Clarifications**:

- **Fixture / mutant**: row-builder helpers; boundary at 119/120/121 mirrors the budget convention.

#### TC-MEMINDEX-003 - Archive index covers notes exactly

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-9, F-1, AC-F9-2, DEC-10
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-index.test.ts` (archive block)
**Tags**: @bun, @check, @memory, @retro

**Given / When / Then**: Given the archive index and the notes it represents, when the invariant runs, then every note has exactly one archive-index row and every archive-index row is backed by a note; the memory index carries one row for the archive index and no rows for individual notes.

**Preconditions**:

- The retro archive area and `retro/INDEX.md` exist.
- Notes live under a year folder (`retro/<year>/…`).

**Steps**:

1. Build a tree with two notes and two archive rows; assert zero findings.
2. Remove one archive row; assert one uncovered-note finding naming the note.
3. Add an archive row for a missing note; assert one unbacked-row finding naming the row.
4. Assert the memory index has exactly one row for `retro/INDEX.md` and none for the notes.

**Expected Outcome**:

- Archive coverage is exact in both directions; notes stay represented by the archive index.

**Notes / Clarifications**:

- **Fixture / mutant**: `archiveTree()` with the three shapes.

#### TC-MEMBUDGET-001 - Cap boundaries and kernel bands

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-10, AC-F10-1, DM-5, DEC-9
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-budget.test.ts`
**Tags**: @bun, @check, @memory, @budget

**Given / When / Then**: Given an index over 200 lines or over 25 KB, a per-agent or guild entry point over 150 lines, an archive index over 200 lines, and a kernel memory section over 200 but not over 220 lines, then each over-cap surface is one `memory.budget.*` error naming the file, the measured value, and the cap, except the kernel band, which is an advisory at or below 220; given a kernel section over 220 lines, then it is an error; given a surface exactly at its cap, then no finding is produced.

**Preconditions**:

- Budget constants are imported from the single declaration module (DM-5).
- The kernel section is located inside the AGENTS.md memory section, not the whole file.

**Steps**:

1. Boundary matrix for each surface, asserting cap−1 → no finding, cap → no finding, cap+1 → exactly one error naming measured value and cap:
   - index lines 199/200/201;
   - index bytes just under/at/over 25 KB (measured in bytes, not characters);
   - agent entry point 149/150/151;
   - guild entry point 149/150/151;
   - archive index 199/200/201.
2. Kernel section 199/200 → no finding; 201 → exactly one `memory.budget.kernel-lines` advisory (not an error); 220 → advisory; 221 → error.
3. Assert the detail text contains the measured value and the cap for each over-cap case.
4. Assert a surface exactly at the byte cap (25 KB) is silent.

**Expected Outcome**:

- Every cap enforced at its exact published threshold, with the kernel warn/error band; boundary-correct (no off-by-one).

**Notes / Clarifications**:

- Ticket artifact 3 (budget violations → fail) is this test; the kernel advisory half is proven not to change the exit in TC-MEMGATE-001.
- **Fixture / mutant**: generated filler content (`lineFiller(n)`, `byteFiller(n)`) in `tests/fixtures/memory/tree.ts`; bytes measured with `Buffer.byteLength`.

#### TC-MEMBUDGET-002 - Delivered tree within every cap (measured)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-10, F-1, F-2, AC-F10-2, DM-5
**Test Type(s)**: Check + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-budget.test.ts` (live-tree block) and `tests/structure/memory-layout.test.ts`
**Tags**: @bun, @check, @structure, @memory, @budget

**Given / When / Then**: Given the delivered tree after the layout and schema work, when every capped surface is measured, then all are within their caps: the index ≤200 lines and ≤25 KB, every agent and guild entry point ≤150 lines, the archive index ≤200 lines, and the kernel section inside its advisory band.

**Preconditions**:

- TC-MEMBUDGET-001 passes.
- The README rewrite and migration have landed.

**Steps**:

1. Measure `.ai/memory/README.md` lines and bytes; assert ≤200 and ≤25 KB.
2. Measure each `.ai/memory/agents/*/README.md` and each `.ai/memory/guilds/*/README.md`; assert ≤150 lines.
3. Measure `.ai/memory/retro/INDEX.md`; assert ≤200 lines.
4. Measure the `AGENTS.md` memory section; assert ≤220 lines (inside the band) and record the exact figure.
5. Record all measured values in Section 10 and the plan-phase notes.

**Expected Outcome**:

- The delivered tree is within every cap; the measured numbers are recorded as evidence.

**Notes / Clarifications**:

- Automated assertion plus recorded measurement; the numbers are evidence, not a second contract.
- **Fixture / mutant**: live files.

#### TC-MEMHEUR-001 - Derivable advisory classes (positive)

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DEC-6, DM-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-derivable.test.ts`
**Tags**: @bun, @check, @memory, @advisory

**Given / When / Then**: Given a record whose body contains a fenced block that is a repository file listing, and a record whose body contains a fenced block restating a declared workspace command, then each produces exactly one `memory.derivable.*` advisory naming the file and the class, the exit stays zero, and the summary reports the advisory count.

**Preconditions**:

- The two heuristics are closed; no model or similarity path exists.

**Steps**:

1. Record body with a fenced block listing `packages/core/src/...` paths → `memory.derivable.file-listing` (one finding).
2. Record body with a fenced block containing a declared workspace command (for example `pnpm check`) → `memory.derivable.command-echo` (one finding).
3. Assert both are severity `warn`, the exit is 0, and the summary advisory count is 2.
4. Assert a fenced code block that is neither a listing nor a declared command produces no finding.

**Expected Outcome**:

- Exactly one advisory per class; no gating; precise enough not to fire on ordinary code fences.

**Notes / Clarifications**:

- **Fixture / mutant**: three body fixtures in `tests/fixtures/memory/bodies.ts`.

#### TC-MEMHEUR-002 - Derivable negative control and non-gating exit

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DEC-6
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-derivable.test.ts` (control block)
**Tags**: @bun, @check, @memory, @advisory

**Given / When / Then**: Given a record body containing neither pattern, then no derivable finding is produced; and a tree whose only findings are derivable advisories still exits zero.

**Preconditions**:

- TC-MEMHEUR-001 passes.

**Steps**:

1. Clean record body → zero `derivable.*` findings.
2. Tree with only a derivable advisory → exit 0, no `FAIL` lines, advisory count reported.
3. Mix one derivable advisory with one schema error → exit non-zero, and the advisory is still printed (not suppressed by the error).

**Expected Outcome**:

- Advisories are visible but never gate; error and advisory streams are both preserved.

**Notes / Clarifications**:

- **Fixture / mutant**: clean/body fixture combination; the mixed tree reuses `errorTree()` and adds the advisory body.

#### TC-MEMSECRET-001 - One finding per recognizer class; no value echo; rule-id set

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-12, AC-F12-1, DM-4, DEC-4, NFR-9
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-secret.test.ts` importing `packages/adapters/src/io/privacy-rules.ts`
**Tags**: @bun, @check, @memory, @privacy

**Given / When / Then**: Given a record, entry point, archive note, or convention file containing a value matching one recognizer class of the delivered privacy vocabulary, then one `memory.secret.<recognizer-class>` error names the file, the line, and the class, and never the matched value; the set of possible secret rule ids equals the vocabulary's recognizer classes exactly, with no pattern defined inside the memory check.

**Preconditions**:

- The privacy vocabulary is imported, not duplicated.
- Synthetic fabricated values are used, and the fixture files satisfy `tests/checks/fixture-privacy.test.ts` (no live credential shape escapes into committed fixtures without a suppression marker).

**Steps**:

1. Derive the expected class list from the privacy rules module (six secret classes plus the private-literal class = seven).
2. For each class, plant a fabricated matching value in a record and run the evaluation; assert exactly one `memory.secret.<class>` error naming path, line, and class.
3. Assert no finding's detail contains the planted value (substring check against the fabricated token).
4. Assert the memory check module contains no local regex/pattern table for secrets: the set of emitted secret ids is derived from the vocabulary export.
5. Plant the same class in an entry point, an archive note, and a convention file; assert one finding each (the scan covers the whole tree, not only records).

**Expected Outcome**:

- Full-tree secret coverage, one vocabulary, one rule id per class, redaction-safe details.

**Notes / Clarifications**:

- Ticket security intent; DEC-4. The private-literal class is included because Appendix A names it.
- **Fixture / mutant**: `tests/fixtures/memory/secrets.ts` generated with a safe synthetic token per class; the suppression-marker case is TC-MEMSECRET-002.

#### TC-MEMSECRET-002 - Suppression classes and markerless control

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-12, AC-F12-2, DEC-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-secret.test.ts` (suppression block)
**Tags**: @bun, @check, @memory, @privacy

**Given / When / Then**: Given a committed documentation placeholder or a declared suppression marker inside a matched span, then no finding is produced; and given a markerless value of the same shape, then the finding is produced.

**Preconditions**:

- The three suppression classes are imported from the privacy vocabulary.

**Steps**:

1. For each suppression class (`documentation-placeholder`, `redaction-marker`, `fabricated-sample`), plant a suppressed span in a record; assert zero findings.
2. Remove the marker while keeping the same shape; assert one finding of the matching secret class.
3. Assert the suppression decision is data-driven (marker inside the span), not path-based.

**Expected Outcome**:

- Documented examples do not fail the gate; the same shape without a marker does.

**Notes / Clarifications**:

- **Fixture / mutant**: paired suppressed/markerless fixtures per class.

#### TC-MEMCONC-001 - Parallel-branch record creation, zero conflicts, coverage after merge

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-13, F-1, F-9, AC-F13-1 (seed SC-M2-S8-02)
**Test Type(s)**: Integration (git)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-concurrency-merge.test.ts` — temp git repository
**Tags**: @bun, @integration, @git, @memory

**Given / When / Then**: Given two distinct agents on parallel branches each creating a record in its own namespace, when both branches merge, then the merge reports zero conflicts, neither branch modified a file owned by the other writer, no new index row was needed for an already-indexed entry point, and after the merge the invariant reports each new record with zero findings and both represented.

**Preconditions**:

- `git` is available (already required by the lifecycle and by existing tests such as `boundary-ci-parity.test.ts`).
- A baseline temp repo is initialised from a minimal fixture tree with a committed index.

**Steps** (concrete technique — fully automated):

1. Create a temp directory, `git init`, configure a local identity, and commit a base memory tree: `.ai/memory/README.md` with the index table, `lessons/.gitkeep`, `agents/pm/README.md`.
2. Create branch `feat/agent-a`; agent A adds `lessons/lesson-2026-101-a.md` and appends its own index row; commit.
3. From the base commit, create branch `feat/agent-b`; agent B adds `lessons/lesson-2026-102-b.md` and appends its own index row; commit.
4. Check out the base, merge `feat/agent-a`, then merge `feat/agent-b`; assert both merges exit 0.
5. Assert `git diff --name-only --diff-filter=U` is empty, `git status --porcelain` has no `UU`/`AA` entries, and neither branch's commit touched the other's record file.
6. Run the pure evaluation over the merged tree; assert zero error findings for both new records and both rows, and assert the count of new index rows is 2 (one per record), not 1 or 3.
7. Assert no new index row was added for the already-indexed `agents/pm/README.md`.

**Expected Outcome**:

- Record creation is conflict-free because each creator writes only new files; post-merge coverage proves both records are represented (AC-F13-1).

**Notes / Clarifications**:

- **Automated vs manual, stated honestly:** the two-distinct-agent case above is automated. The **same-role parallel worktree** case is *not* automated: two worktrees of the same role may both edit one agent folder's entry point, and the documented union resolution is a human/scripted procedure. That path is covered by a manual+scripted procedure recorded in Section 10 (create two worktrees, append one capture line each to the same entry point, merge, resolve by union, run the invariant), not by a permanent suite.
- The seed's `index.data.records` surface is reconciled to the lint's coverage result because this story ships no index command (Appendix B, DEC-10).
- **Fixture / mutant**: temp repo seeded with the baseline tree; helper `commitRecord(branch, path, row)`.

#### TC-MEMCONC-002 - Two promotion writes and union-resolved index rows

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-13, F-3, F-9, AC-F13-2, RSK-5 (seed SC-M2-S8-02)
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-concurrency-merge.test.ts` (promotion block) using `tests/fixtures/capsule/promotion.ts`
**Tags**: @bun, @behaviour, @memory, @index

**Given / When / Then**: Given two promotion writes landing one new record file each plus one index row each, when both land, then the two record files never conflict, both index rows are present after the documented union resolution, no row is duplicated or orphaned, and a re-run of the promotion path adds no file and no row.

**Preconditions**:

- TC-MEMCONC-001 passes.
- The promotion writer appends rows only when the exact row is absent (existing dedup behaviour).

**Steps**:

1. Use `makeTempMemory` with a base index; run two promotions with distinct candidate ids and distinct statements over the same temp root (simulating the post-union state by applying both writes).
2. Assert two distinct record files exist and neither write modifies the other's file.
3. Assert both index rows are present exactly once; run the index coverage evaluation and assert no `row-duplicate` and no `record-uncovered`.
4. Re-run the same two promotions; assert no additional file and no additional row (idempotent), and the tree still evaluates clean.
5. Assert a duplicate-row injection produces `row-duplicate` (non-vacuity).

**Expected Outcome**:

- Record files never conflict; union resolution yields complete, non-duplicated coverage; re-runs are idempotent.

**Notes / Clarifications**:

- The merge aspect (two branches) is TC-MEMCONC-001; here the union state is applied directly because the row is append-only text. This split is deliberate and stated.
- **Fixture / mutant**: two `candidateYaml` documents with distinct ids; a third run for idempotency.

#### TC-MEMGUARD-001 - Negative guard replaced by presence + preserved absences

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-14, AC-F14-1, DEC-12, NFR-10, NG-1, NG-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` (replacing the block at lines 258-287) and/or `tests/structure/memory-lint-wiring.test.ts`
**Tags**: @bun, @structure, @memory, @guard

**Given / When / Then**: Given the delivered structure suite, when the memory-tooling guard runs, then it asserts the memory invariant exists (`scripts/checks/memory-lint.ts` plus its exported pure entry) and is cited by both gate surfaces, and it still asserts the preserved absences: no memory subcommand on the CLI, the doctor check set unchanged at five with no memory member, and the error-table row set unchanged; the former absence-only assertion no longer exists in its old form.

**Preconditions**:

- The old guard's intent (no memory tooling) is replaced, not silently deleted.
- The doctor CLI command path and its five-check contract are known.

**Steps**:

1. Assert `scripts/checks/memory-lint.ts` exists, exports a pure evaluation entry, and has a thin `import.meta.main` edge.
2. Assert both `package.json` `check` and `.github/workflows/ci.yml` `ts-invariants` cite it (shared with TC-MEMGATE-004).
3. Preserved absence 1: scan the CLI command registry for any `memory` subcommand; assert none.
4. Preserved absence 2: assert the doctor check set is exactly five (`repo`, `tracker`, `provider`, `state`, `ci`) and contains no memory member.
5. Preserved absence 3: assert the error-table row set and domain-kind membership are unchanged (delegated in detail to TC-MEMGUARD-002).
6. Assert the old test no longer asserts "no memory-lint component exists anywhere" — replaced by the presence assertion; a comment or test name records the sanctioned replacement.

**Expected Outcome**:

- The guard now protects the boundary rather than the absence; the invariant exists and is cited; the absences it protected still hold.

**Notes / Clarifications**:

- Old guard location: `tests/structure/memory-bootstrap-templates.test.ts:258-287`; its comment names GH-301 as the owner of this replacement (pm-notes RISK).
- **Fixture / mutant**: live files; a temp-copy mutation that adds a memory doctor check to a copied doctor module makes assertion 4 fail, proving non-vacuity.

#### TC-MEMGUARD-002 - Inventory equality (no new surface)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR10-1, F-4, F-14, NG-1, NG-4, NG-6
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-lint-wiring.test.ts` extending `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, and the event-taxonomy/inventory suites
**Tags**: @bun, @structure, @inventory, @memory

**Given / When / Then**: Given the delivered change, when the command inventory, the error table, the domain-kind membership, the state record kinds, the event topics, and the doctor check set are inspected, then every one is identical to its pre-change value and no new identity, command, flag, or check exists.

**Preconditions**:

- Baseline inventories are available as committed constants or existing tests.

**Steps**:

1. Assert the CLI command inventory (help surface) is unchanged; no `memory` command, flag, or alias exists.
2. Assert `ERROR_TABLE` row count and ids are unchanged; no `memory.*` error-table identity exists (the lint's `memory.<area>.<condition>` findings are check findings, not error-table rows).
3. Assert `DOMAIN_KINDS` membership is unchanged.
4. Assert state record kinds and event topics are unchanged (existing additivity suites stay green).
5. Assert the doctor's five-check set is unchanged and no memory member exists.
6. Assert the new check modules are registered in `tests/structure/inventory.json` and the inventory equality test is green — the only additions are non-CLI library/check modules.

**Expected Outcome**:

- Zero new public surface; the invariant is a check, not a command or error identity.

**Notes / Clarifications**:

- **Fixture / mutant**: existing inventory/error-table suites are reused; a mutant adding one entry to a temp copy of the error table fails assertion 2.
- This test plus TC-MEMGATE-004 covers AC-NFR10-1 from both the surface and wiring directions.

#### TC-MEMNFR-001 - Byte-identical output and state-free run

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-1, NFR-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts` (state-free block)
**Tags**: @bun, @check, @memory, @determinism

**Given / When / Then**: Given a fixed tree and two executions, when the finding output is compared, then it is byte-identical including order and truncation, and the run performed zero writes, opened no network connection, and read no clock.

**Preconditions**:

- TC-MEMGATE-002/003 pass.

**Steps**:

1. Run the check twice over a temp tree that includes a truncation case; assert byte equality of the full stdout including the truncation line.
2. Diff the temp tree's file hashes before and after; assert no change.
3. Assert the evaluation accepts an injected clock and date and never calls an ambient clock (static import check for `Date` usage in the domain module).
4. Assert no network module import and no shell-out (`child_process`) in the evaluation or edge.

**Expected Outcome**:

- Byte-identical, state-free, offline, clock-independent.

**Notes / Clarifications**:

- **Fixture / mutant**: `truncatingTree()` reused from TC-MEMNFR-003.

#### TC-MEMNFR-002 - Scan cost and gate overhead

**Scenario Type**: Performance
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: AC-NFR2-1, NFR-2, NFR-3
**Test Type(s)**: Check (performance)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-performance.test.ts`
**Tags**: @bun, @perf, @memory

**Given / When / Then**: Given a synthetic tree at the declared size bound, when the invariant runs on the CI runner, then it completes within the declared wall-clock bound with one read per file and no shell-out.

**Preconditions**:

- A synthetic tree generator can produce ≤2,000 files or ≤8 MB of memory content.
- The measurement harness records wall time around the check invocation.

**Steps**:

1. Generate a synthetic tree of 2,000 small record/entry-point files (or ≤8 MB total), then run the evaluation and measure wall time.
2. Assert the measured time is within the declared 1 s bound on the CI runner; record the figure.
3. Assert one read per file via an injected counting file-system port (count equals file count; no file read twice).
4. Measure `pnpm check` before and after adding the memory invocation; record the delta as NFR-3 evidence in Section 10.
5. Assert no `child_process` or `fetch` is used in the timed path.

**Expected Outcome**:

- Linear scan within the declared bound; overhead measured and recorded rather than assumed.

**Notes / Clarifications**:

- Honest note: timing varies by machine. The assertion is against the declared ceiling; local numbers are informative, the CI runner number is the contract. If the runner is noisy, the plan phase records the measurement and the assertion uses the documented ceiling once, not a tight local figure.
- **Fixture / mutant**: generated tree in a temp directory; `countingFs` adapter.

#### TC-MEMNFR-003 - Output ceiling and truncation line

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: AC-NFR5-1, NFR-5, DM-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts` (ceiling block)
**Tags**: @bun, @check, @memory, @output

**Given / When / Then**: Given a tree with more defects than the print ceiling, when the invariant runs, then at most 100 error findings and 100 advisories are printed in the declared deterministic order, followed by one truncation line carrying the true totals.

**Preconditions**:

- The truncation ceiling constants are imported from the finding model.

**Steps**:

1. Build a tree with 150 schema errors and 150 derivable advisories across multiple paths.
2. Assert exactly 100 error lines and 100 advisory lines are printed, in the declared order (area, path, line, rule id).
3. Assert exactly one truncation line follows, carrying the true totals (150 and 150) and the word for truncation.
4. Assert the printed subset is the deterministic prefix: run twice and compare byte-for-byte.
5. Boundary: exactly 100 errors → no truncation line; 101 → one line.

**Expected Outcome**:

- Bounded output with true totals and stable ordering under truncation.

**Notes / Clarifications**:

- **Fixture / mutant**: `truncatingTree({ errors: 150, advisories: 150 })`.

#### TC-MEMNFR-004 - Documentation conformance and distribution drift

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7, C-6
**Test Type(s)**: Structure + shell guard
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-lint-docs.test.ts` + `bash scripts/.tests/test-doc-distribution.sh` + `bun run scripts/checks/forbidden-literals.ts`
**Tags**: @bun, @structure, @bash-guard, @docs

**Given / When / Then**: Given the change's documentation output, when the conformance guards run, then every new user-facing doc is registered where the registry requires it, every new doc under a distribution-marker root carries `ados_distribution`, and the distribution guard reports zero drift.

**Preconditions**:

- The new feature spec under `doc/spec/features/**` and any new doc under a marker root are known.
- The forbidden-literal registry's scope classes and allowlist are understood.

**Steps**:

1. Enumerate docs added by the change (feature spec, updated memory index is not a doc-root carrier, updated templates remain under `doc/templates/**`).
2. For each new doc under a marker-required root, assert an `ados_distribution` value in (`redistributable`, `internal`, `project-generated`).
3. Run `bash scripts/.tests/test-doc-distribution.sh`; assert zero drift.
4. Run `bun run scripts/checks/forbidden-literals.ts`; assert the registry shape and zero violations, with any newly registered user-facing doc present where required.
5. Assert no `.md` file gained a second frontmatter block or a license header for the marker.

**Expected Outcome**:

- Conformance guards green; no marker or registration drift; no duplicated frontmatter.

**Notes / Clarifications**:

- **Fixture / mutant**: shell guard and registry check are run against the live tree; a temp-copy mutant with a removed marker is caught by the guard (existing negative modes in `test-doc-distribution-modes.sh`).

#### TC-MEMNFR-005 - Full gate battery green at delivered HEAD

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR8-1, NFR-3, NFR-4, NFR-6, NFR-8, DoD-19
**Test Type(s)**: Manual execution of automated commands
**Automation Level**: Semi-automated
**Target Layer / Location**: Repository root on a clean checkout; commands in Section 4; evidence in Section 10 and plan-phase notes
**Tags**: @manual, @gate, @memory

**Given / When / Then**: Given the delivered HEAD on a clean checkout, when the aggregate gate runs with a repository-local temporary directory, then it is green including the memory invariant, the boundary check, the prompt/help conformance checks, and the doc-distribution guard.

**Preconditions**:

- `pnpm install --frozen-lockfile` complete; `tmp/tmpdir` exists.
- All implementation phases landed and the tree-green rule held before the gate was enabled.

**Steps**:

1. `mkdir -p tmp/tmpdir` and run `TMPDIR=$PWD/tmp/tmpdir pnpm check`; record exit code and the tail of the output.
2. Run `bun run scripts/checks/memory-lint.ts`; record exit 0 and summary.
3. Run the targeted suites from Section 4; record exit codes.
4. Run `bash scripts/.tests/test-doc-distribution.sh`, `bun run scripts/checks/forbidden-literals.ts`, `bun run scripts/checks/privacy-literals.ts`; record zero drift/violations.
5. Run `git diff --check`; record clean.
6. Record the measured memory-lint gate overhead (from TC-MEMNFR-002) as NFR-3 evidence.
7. Append each command + result to Section 10 and the plan phase notes.

**Expected Outcome**:

- One green battery at the delivered HEAD; the evidence is recorded, not asserted from memory.

**Notes / Clarifications**:

- This is the only scenario whose *evidence recording* is manual; the underlying commands are automated. It is marked Semi-automated deliberately and is not counted as automated coverage.
- The phase-9 commit-range gate (`./scripts/lint-commit-range.sh --base <base>`) and CI jobs are corroborating evidence owned by later phases, not re-tested here.
- **Fixture / mutant**: live checkout.

## 6. Environments and Test Data

- **Environment:** local dev and the CI runner (`ubuntu-latest`, Bun and pnpm from committed pins). No service, network, database, or staging dependency: the invariant is offline and read-only by contract.
- **Temporary roots:** every mutation runs in `mkdtemp` directories under the repository-local TMPDIR when the gate runs (`TMPDIR=$PWD/tmp/tmpdir`) and the OS temp dir otherwise. No mutation writes the live `.ai/memory/**`; the read-only assertions in TC-MEMGATE-003 and TC-MEMNFR-001 prove it.
- **Committed fixtures:** `tests/fixtures/memory/tree.ts` (tree builders), `tests/fixtures/memory/mutants.ts` (one-defect records), `tests/fixtures/memory/bodies.ts` (derivable bodies), `tests/fixtures/memory/secrets.ts` (fabricated per-class values; must satisfy `tests/checks/fixture-privacy.test.ts`), and `tests/fixtures/memory/agents/` (entry-point fixtures). Fixtures are never named `*.test.ts` (bunfig discovery).
- **Secret-fixture discipline:** committed secret-shaped fixtures use clearly fabricated values with the consented suppression markers, so the repository privacy guard does not fail on the test corpus. The lint's own suppression test (TC-MEMSECRET-002) proves the markerless control still fires.
- **Isolation:** each test module owns its temp roots and cleans up in `finally`/`afterEach`, following `tests/checks/error-table-sync.test.ts` and `tests/fixtures/capsule/promotion.ts`. The git merge test creates its own repo and never touches the worktree's `.git`.

**Boundary and test-data discipline (explicit obligations):**

| Boundary | Lower | At | Upper | Expected behaviour |
|---|---|---|---|---|
| Index lines / agent entry / guild entry / archive index | cap−1 | cap | cap+1 | cap−1 and cap silent; cap+1 one error |
| Index bytes | just under 25 KB | 25 KB | over 25 KB | under/at silent; over one error |
| Kernel memory section | ≤200 | 200 | 201–220 / 221 | ≤200 silent; 201–220 one advisory; 221 one error |
| Index hint length | 119 | 120 | 121 | 119/120 silent; 121 row-malformed |
| Statement length | bound−1 | bound | bound+1 | bound−1/bound silent; bound+1 schema error |
| Print ceiling | 100 errors / 100 advisories | exactly 100 | 101 | exactly 100 no truncation line; 101 truncation with true totals |
| Tree population | empty-but-proved (`.gitkeep`) | one record per area | growing | both empty and populated green; no fixed-count assertion |
| Evidence shapes | 4 invalid/empty forms | 5 valid prefixes | — | invalid forms error; all 5 valid forms silent |
| Trust vocabulary | — | T0, T5 edges | — | both endpoint values accepted; T6 rejected |
| Status | — | candidate, archived | — | all five accepted; a sixth value rejected |

## 7. Automation Plan and Implementation Mapping

Test files are the intended homes; the implementation plan confirms final names in phase 4. `Status` is relative to this change: all are **To Implement** unless marked otherwise. Shared fixtures are **To Implement** once and reused.

| TC ID(s) | Test file | Execution command | Status |
|---|---|---|---|
| TC-MEMLAY-001, TC-MEMLAY-002, TC-MEMLAY-003 | `tests/structure/memory-layout.test.ts` | `bun test tests/structure/memory-layout.test.ts` | To Implement |
| TC-MEMLAY-004 | `tests/checks/memory-lint-output.test.ts` | `bun test tests/checks/memory-lint-output.test.ts` | To Implement |
| TC-MEMSCHEMA-001 | `tests/structure/memory-record-schema.test.ts` | `bun test tests/structure/memory-record-schema.test.ts` | To Implement |
| TC-MEMSCHEMA-002, TC-MEMSCHEMA-003, TC-MEMSCHEMA-004 | `tests/checks/memory-lint-schema.test.ts` | `bun test tests/checks/memory-lint-schema.test.ts` | To Implement |
| TC-MEMWRITE-001, TC-MEMWRITE-002, TC-MEMWRITE-004 | `tests/behaviour/memory-promotion-schema.test.ts` | `bun test tests/behaviour/memory-promotion-schema.test.ts` | To Implement |
| TC-MEMWRITE-003 | `tests/structure/memory-record-schema.test.ts` (automated half) | `bun test tests/structure/memory-record-schema.test.ts` | To Implement (manual half recorded in §10) |
| TC-MEMGATE-001, TC-MEMGATE-002, TC-MEMGATE-003, TC-MEMNFR-001, TC-MEMNFR-003 | `tests/checks/memory-lint-output.test.ts` | `bun test tests/checks/memory-lint-output.test.ts` | To Implement |
| TC-MEMGATE-004 | `tests/structure/memory-lint-wiring.test.ts` (plus existing `tests/checks/ci-wiring.test.ts` pins) | `bun test tests/structure/memory-lint-wiring.test.ts tests/checks/ci-wiring.test.ts` | To Implement + Existing–Update |
| TC-MEMDATE-001, TC-MEMDATE-002 | `tests/checks/memory-lint-dating.test.ts` | `bun test tests/checks/memory-lint-dating.test.ts` | To Implement |
| TC-MEMPROV-001 | `tests/checks/memory-lint-provenance.test.ts` | `bun test tests/checks/memory-lint-provenance.test.ts` | To Implement |
| TC-MEMPROV-002 | `tests/structure/memory-record-schema.test.ts` (migration block) | `bun test tests/structure/memory-record-schema.test.ts` | To Implement (manual diff review recorded in §10) |
| TC-MEMREF-001, TC-MEMREF-002 | `tests/checks/memory-lint-reference.test.ts` | `bun test tests/checks/memory-lint-reference.test.ts` | To Implement |
| TC-MEMINDEX-001, TC-MEMINDEX-002, TC-MEMINDEX-003 | `tests/checks/memory-lint-index.test.ts` | `bun test tests/checks/memory-lint-index.test.ts` | To Implement |
| TC-MEMBUDGET-001, TC-MEMBUDGET-002 | `tests/checks/memory-lint-budget.test.ts` | `bun test tests/checks/memory-lint-budget.test.ts` | To Implement |
| TC-MEMHEUR-001, TC-MEMHEUR-002 | `tests/checks/memory-lint-derivable.test.ts` | `bun test tests/checks/memory-lint-derivable.test.ts` | To Implement |
| TC-MEMSECRET-001, TC-MEMSECRET-002 | `tests/checks/memory-lint-secret.test.ts` | `bun test tests/checks/memory-lint-secret.test.ts` | To Implement |
| TC-MEMCONC-001, TC-MEMCONC-002 | `tests/behaviour/memory-concurrency-merge.test.ts` | `bun test tests/behaviour/memory-concurrency-merge.test.ts` | To Implement |
| TC-MEMGUARD-001 | `tests/structure/memory-bootstrap-templates.test.ts` (replace block) and/or `tests/structure/memory-lint-wiring.test.ts` | `bun test tests/structure/memory-bootstrap-templates.test.ts tests/structure/memory-lint-wiring.test.ts` | Existing–Update |
| TC-MEMGUARD-002 | `tests/structure/memory-lint-wiring.test.ts` (plus existing error-table/event-inventory suites) | `bun test tests/structure/memory-lint-wiring.test.ts tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts` | To Implement + Existing–No Change |
| TC-MEMNFR-002 | `tests/checks/memory-lint-performance.test.ts` | `bun test tests/checks/memory-lint-performance.test.ts` | To Implement |
| TC-MEMNFR-004 | `tests/structure/memory-lint-docs.test.ts` + shell guards | `bun test tests/structure/memory-lint-docs.test.ts && bash scripts/.tests/test-doc-distribution.sh` | To Implement + Existing–No Change |
| TC-MEMNFR-005 | Repository root (no new file) | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Manual evidence recording |

**Shared implementation homes** (created by the delivery phases; not test files):

- `packages/core/src/contracts/memory-record.ts` — the schema authority: required/optional keys, closed vocabularies, id and file-name grammar, budget constants, finding register. Data and types only.
- `packages/core/src/domain/memory-lint.ts` — the pure evaluation (no I/O, no clock, no fs).
- `packages/adapters/src/file/memory-scan.ts` — the tree scanner: repository-relative enumeration, text reads, YAML-frontmatter parse.
- `scripts/checks/memory-lint.ts` — the bun-run edge: enumerate → parse → evaluate → print → exit; registers the check namespace.
- `packages/adapters/src/file/memory-promotion.ts` — extended writer (required spine + read-when hint).
- `packages/core/src/contracts/capsule.ts` — additive `source` validation only.
- `package.json`, `.github/workflows/ci.yml`, `tests/structure/inventory.json` — wiring and inventory.
- `.ai/memory/**`, `.ai/memory/README.md`, `AGENTS.md`, `.opencode/skills/consolidate-memory/SKILL.md`, `doc/templates/memory-doctor-checklist-template.md`, `doc/spec/features/feature-memory-lint.md` — documentation reconciliation.

**Mocking requirements:** none beyond injection. The evaluation takes a file list, a text map, the privacy vocabulary, and a fixed date; the scanner takes a file-system port so TC-MEMNFR-002 can count reads. No network, no test doubles for external services.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | Mutation helpers drift from the real writer, so the gate passes a tree the writer cannot produce | One schema module is imported by both the evaluator and the writer; TC-MEMWRITE-001 runs the real writer end-to-end; parity mutation in TC-MEMSCHEMA-001 fails loudly on drift |
| TR-2 | Secret fixtures trip the live privacy or forbidden-literal guard | Fabricated values with consented suppression markers; `tests/checks/fixture-privacy.test.ts` gates the fixture corpus; TC-MEMSECRET-002 keeps the markerless control live |
| TR-3 | The negative guard is deleted instead of replaced, losing the boundary assertions | TC-MEMGUARD-001 asserts both the presence and all three preserved absences; the old block's replacement is explicit in the diff review |
| TR-4 | Timing assertions flake on a shared CI runner | Assert the declared ceiling once on the runner; record measurements as evidence; do not encode a tight local number as a second contract |
| TR-5 | Budget boundary off-by-one (a file exactly at cap failing) | Explicit cap−1/cap/cap+1 matrix per surface, including bytes measured with `Buffer.byteLength` |
| TR-6 | The git merge test becomes a branch-diff assertion against a moving base | The test builds its own temp repo with a fixed base commit; it never reads `origin/main-tools...HEAD` (testing-strategy invariant rule) |
| TR-7 | The archive-index coverage test assumes generation that does not exist | The archive index is append-maintained in the change; the test asserts coverage of the delivered shape, not a generator |
| TR-8 | A promoted record fails the gate because capsule `source` was not tightened first | Write-path phase tightens `source` in the candidate contract (DEC-8) before the writer renders it; TC-MEMWRITE-004 proves the refusal path |

### 8.2 Assumptions

- The implementation plan (phase 4) will confirm the file names in Section 7 and declare phases that own each area; this test plan constrains but does not author the plan.
- `bun test` discovery over `tests/**` covers every new suite; fixtures stay outside `*.test.ts` naming (`bunfig.toml`).
- The privacy vocabulary export exposes recognizer classes and suppression classes in a stable, importable shape; if it does not, the plan phase adds a read-only accessor rather than a second table (DEC-4).
- A fixed "today" can be injected into the evaluation; the production edge passes the real date. The clock is read only at the edge, never in the pure domain.
- The three delivered records' current statements/statuses can be pinned as constants for TC-MEMPROV-002; any future change that alters them is a supersession, not a test edit.
- `pnpm build` precedes lifecycle commands in this repository (pm-notes environment note); test runs do not require the CLI bin.
- The doctor's five-check set is a stable, discoverable constant by the time TC-MEMGUARD-001 runs.
- `tmp/tmpdir` exists before the gate runs; `mkdir -p` is part of the evidence procedure.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Proposed resolution |
|----|----------|-----------|-------|---------------------|
| OQ-TP-1 | Is the dedicated script named `check:memory` or `check:memory-lint`? | No | plan-writer | Either name is acceptable if `scripts.check` and CI cite the same path; TC-MEMGATE-004 asserts the path, not the script name |
| OQ-TP-2 | When `created` is absent, is the finding `memory.schema.keys-missing` or `memory.dating.created-malformed`? | No | plan-writer + spec owner | Pick exactly one classification in the plan and assert it once; AC-F6-1 permits only one dating finding and AC-F2-2 forbids double-reporting. The test asserts the chosen single identity, not both |
| OQ-TP-3 | Does the promotion writer's index-row dedup use exact-row equality or path equality? | No | plan-writer | The existing writer checks exact-row inclusion; TC-MEMCONC-002 asserts idempotency under the delivered rule and `row-duplicate` under an injected duplicate |
| OQ-TP-4 | Should the same-role parallel-worktree union resolution gain automation? | No | PM / future story | Not in this change: it is a human/scripted workflow, explicitly manual here. A future story may automate the merge exercise |
| OQ-TP-5 | Is the kernel memory section delimited by a stable heading anchor for budget measurement? | No | plan-writer | Measure between the memory section heading and the next top-level heading; pin the anchor in the plan phase; a missing anchor is a test failure, not a silent zero |

No open question blocks safe delivery; each has a proposed resolution and a single test owner.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Initial test plan from `chg-GH-301-spec.md`: 40 TCs across 14 families, full coverage of 30 ACs, the eight lint areas with failing-fixture mutation tests, both-direction index coverage, budget boundary matrix, output determinism/exit/order/truncation, conflict-free concurrency (automated git two-branch + honest manual same-role note), schema reconciliation, guard replacement, gate wiring, and documentation conformance |

## 10. Test Execution Log

Populated during delivery. One row per scenario (or per grouped command where the scenario owns several assertions). Manual evidence (same-role union resolution, consolidation pass, migration diff review, gate battery) must be recorded explicitly; an unrecorded scenario is not executed.

| TC ID | Run Date | Result | Evidence / Notes |
|-------|----------|--------|------------------|
| TC-MEMLAY-001 | — | Not run | — |
| TC-MEMLAY-002 | — | Not run | — |
| TC-MEMLAY-003 | — | Not run | — |
| TC-MEMLAY-004 | — | Not run | — |
| TC-MEMSCHEMA-001 | — | Not run | — |
| TC-MEMSCHEMA-002 | — | Not run | — |
| TC-MEMSCHEMA-003 | — | Not run | whole-tree run recorded before and after gate enablement (DoD-16) |
| TC-MEMSCHEMA-004 | — | Not run | — |
| TC-MEMWRITE-001 | — | Not run | — |
| TC-MEMWRITE-002 | — | Not run | — |
| TC-MEMWRITE-003 | — | Not run | automated half + manual consolidation pass verdict |
| TC-MEMWRITE-004 | — | Not run | — |
| TC-MEMGATE-001 | — | Not run | — |
| TC-MEMGATE-002 | — | Not run | — |
| TC-MEMGATE-003 | — | Not run | `git status` before/after evidence |
| TC-MEMGATE-004 | — | Not run | both surface citations recorded |
| TC-MEMDATE-001 | — | Not run | — |
| TC-MEMDATE-002 | — | Not run | — |
| TC-MEMPROV-001 | — | Not run | — |
| TC-MEMPROV-002 | — | Not run | migration diff review verdict |
| TC-MEMREF-001 | — | Not run | — |
| TC-MEMREF-002 | — | Not run | — |
| TC-MEMINDEX-001 | — | Not run | — |
| TC-MEMINDEX-002 | — | Not run | — |
| TC-MEMINDEX-003 | — | Not run | — |
| TC-MEMBUDGET-001 | — | Not run | — |
| TC-MEMBUDGET-002 | — | Not run | measured line/byte counts recorded here |
| TC-MEMHEUR-001 | — | Not run | — |
| TC-MEMHEUR-002 | — | Not run | — |
| TC-MEMSECRET-001 | — | Not run | rule-id set derivation recorded |
| TC-MEMSECRET-002 | — | Not run | — |
| TC-MEMCONC-001 | — | Not run | automated two-branch merge; same-role manual+scripted procedure recorded separately |
| TC-MEMCONC-002 | — | Not run | — |
| TC-MEMGUARD-001 | — | Not run | diff review of the replaced block |
| TC-MEMGUARD-002 | — | Not run | — |
| TC-MEMNFR-001 | — | Not run | — |
| TC-MEMNFR-002 | — | Not run | measured scan time and gate delta recorded here |
| TC-MEMNFR-003 | — | Not run | — |
| TC-MEMNFR-004 | — | Not run | distribution guard and forbidden-literal scan output |
| TC-MEMNFR-005 | — | Not run | full `TMPDIR=$PWD/tmp/tmpdir pnpm check` transcript tail + exit code |
