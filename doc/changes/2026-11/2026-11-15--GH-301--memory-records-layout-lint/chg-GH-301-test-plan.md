---
id: chg-GH-301-test-plan
status: Updated
version: 1.5
created: 2026-11-15
last_updated: 2026-11-15
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, memory, quality-gates, repository-invariants, schema]
version_impact: minor
summary: "Verification strategy for M2-S8 memory records, layout, and lint: one canonical tree, one typed record schema reconciled across README/writer/capsule/lint with ADR-0011 as the authority and the 280/120 bounds imported rather than restated, eight lint areas with failing-fixture mutation tests, both-direction index coverage over two declared universes, enforced budgets, deterministic and bounded output at a fixed injected date, conflict-free parallel record creation across record files and own entry points with union-resolved index rows, and the sanctioned replacement of the GH-302 negative guard in its three declared parts — presence, a narrowed file-name sanction scan whose permitted-match set equals the sanctioned module set (mutant-proven), and the preserved boundary absences — with the scanner adapter owning every read and the edge owning the single ambient date read."
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
- Concurrency: parallel-branch record creation with zero merge conflicts across record files and each creator's own entry-point namespace, plus the shared index row resolved by the documented union rule for both the agent case and two promotion writes.
- The sanctioned replacement of the GH-302 negative guard in its three declared parts — (a) the positive presence assertion that the invariant exists and is cited by both gate surfaces; (b) one narrowed file-name sanction scan over `scripts/`, `tools/`, and `packages/` whose permitted-match set equals the sanctioned memory module set (the check edge, the pure evaluator, and the schema contract module), proven non-vacuous and proven to fail on a planted unsanctioned module; and (c) the preserved boundary absences (no memory subcommand, five doctor checks, unchanged error-table rows and domain kinds) — plus inventory equality.
- Gate wiring: aggregate `pnpm check` membership, CI `ts-invariants` step, parity assertions, read-only/deterministic behaviour.
- Documentation conformance across both phases: at the delivery boundary the forbidden-literal registry is unchanged, `ados_distribution` markers hold under marker-required roots, and the distribution guard reports zero drift; after the lifecycle-phase-7 handoff the landed `doc/spec/features/feature-memory-lint.md` is present, marked, registered, and linked from `doc/00-index.md`, verified by a post-landing guard run.

### 1.2 Out of Scope & Known Gaps

- **No memory subcommand, compiler, loader enforcement, sixth doctor area, or installed-script distribution** (NG-1…NG-7, DEC-3, DEC-13). These are asserted *absent* by TC-MEMGUARD-001/002, not tested into existence.
- **No model-assisted derivable-content judgement**: the heuristics stay the two closed deterministic rules; no similarity or model path is tested.
- **The promotion reader's malformed-record tolerance is unchanged** in this change (spec §8.5). The plan verifies that the migrated population conforms; it does not assert new reader behaviour.
- **No generator for the memory index or archive index** (increment step 3). The append-maintained shape is tested; generation is not.
- **Fleet-layer routing and `external/` quarantine** are absent by decision and are not exercised.
- **Timing bounds are environment-sensitive.** TC-MEMNFR-002 records the measured cost and asserts the declared ceiling on the CI runner; local figures are evidence, not a second contract.
- **The index row is not conflict-free by construction.** Two branches appending different rows at end-of-file of the one two-column table conflict, so the plan never asserts a zero-conflict merge of the index. TC-MEMCONC-001 bounds its zero-conflict claim to record files and each creator's own entry-point namespace and resolves the single index-file conflict by the documented union rule; TC-MEMCONC-002 applies the same union state for two promotion writes (F-13, AC-F13-1/AC-F13-2).
- **Same-role parallel worktrees remain merge-conflict capable** and resolve by the documented union rule. That path is a documented manual+scripted procedure (TC-MEMCONC-001 notes), not automated; the change does not claim it away (F-13).
- **`doc/spec/features/feature-memory-lint.md` is a lifecycle-phase-7 `@doc-syncer` artifact, not a delivery artifact.** No delivery phase creates a user-facing `doc/**` doc — that absence is the delivery boundary — and the spec has since landed in phase 7 carrying its `ados_distribution` marker, its forbidden-literal registry row, and its `doc/00-index.md` link. TC-MEMNFR-004 therefore states both phases: the delivery-boundary doc state (registry unchanged, markers intact, zero drift) and the post-landing state (presence, marker, registration, index row) verified by a post-landing guard run.
- **Known gap by testing-strategy rule:** permanent suites must not assert a branch diff, so "this change adds no forbidden surface" is an inventory/boundary invariant (TC-MEMGUARD-002) plus review-time changed-file inspection, not a diff assertion against a moving base.

## 2. References

- Change specification: `./chg-GH-301-spec.md` (v1.3) — 30 acceptance criteria (AC-F1-1…AC-NFR10-1), functional capabilities F-1…F-14, data-model contracts DM-1…DM-6, NFR-1…NFR-11, decision log DEC-1…DEC-13, §17.1 Definition of Done (19 rows), Appendix A closed finding-identity register with its schema/provenance presence partition, Appendix B scenario seeds SC-M2-S8-01/02, Appendix C constraint register C-1…C-11. The declarations this plan depends on: the v1.2 presence partition (`source` is schema-owned — absent `source` → `memory.schema.keys-missing`, out-of-channel `source` → `memory.schema.value-unknown`; `evidence` and `created_by` are provenance-owned); DoD-15's three-part guard replacement (presence, the narrowed file-name sanction scan with its mutant and non-vacuity check, and the preserved absences), now with F-14/C-9 pinning the delivered skip set (`node_modules`, `dist`, `.tests`) so a built `dist/` artifact cannot join the match set; and v1.3's DM-6 projection-rule row plus DEC-5's wording, which state that a `lesson` or `tacit` candidate carrying `scope: fleet` is refused at candidate-schema time through the existing capsule-invalid identity, with the candidate scope vocabulary unwidened, no new identity, and the delivered class-level `fleet` rejection unchanged. v1.3 also puts the concept `## Record model` rewrite (with the memory-practices bootstrapping checklist left untouched) into §7.1, §16 and DoD-17, which is why `doc/planning/concepts/memory-architecture.md` appears as a documentation home in §7.
- Implementation plan: `./chg-GH-301-plan.yaml` (revision 1.5, 8 phases) — owns layout/schema (phase 1), the evaluator core (phase 2), coverage/budgets/derivables/secrets/output (phase 3), the check edge and gate wiring (phase 4), write-path alignment and the concurrency proofs (phase 5), kernel/curator and doc conformance (phase 6), finalization (phase 7), and the review-iteration-1 remediation (phase 8, F-1..F-10). Its declarations this plan depends on: the write-path `source` tightening, the `scope: fleet` refusal, and the kind/home-area mapping land in `packages/core/src/domain/capsule-candidates.ts` (phase 5), the scanner adapter and the guard replacement land in phase 4, the curator skill is reconciled in **phase 6**, and every file this plan names as a test home is inside its owning phase's scope.
- Decision record: `doc/decisions/ADR-0011-canonical-memory-record-schema.md` (Proposed) — the system-level schema authority this change consumes: required spine, closed optional set, concept-key dispositions, the `kind` → home-area mapping (`tacit_fragment` → `tacit/`, removing the `tacits/` defect), conditional requirements, and the single-sourced 280/120 bounds. Tests import the schema's declarations from the machine contract module; they never restate a bound or a vocabulary.
- Testing strategy: `.ai/rules/testing-strategy.md` — module→test mapping (`scripts/checks/<check>.ts` → `bun run` plus `tests/checks/**` mutation tests; `packages/**` → `bun test tests/structure tests/behaviour` plus boundaries/typecheck; `doc/**` → static/content checks), bun:test authoring rules, invariant-test authoring (tree invariants, not branch diffs), and the gate battery.
- TypeScript rules: `.ai/rules/typescript.md` — strict TS, tier/purity, contracts-vs-domain-vs-adapter separation, error contract, bun:test conventions.
- Test runner configuration: `bunfig.toml` (root discovery over `tests/**`, `tmp/**` and `dist/**` ignored, fixtures never named `*.test.ts`).
- PM notes: `./chg-GH-301-pm-notes.yaml` — binding decisions DEC-1…DEC-4, the two in-change risks (negative guard replacement, record-schema drift), known doc impacts, delivery conventions (gate `TMPDIR=$PWD/tmp/tmpdir pnpm check`, PR targets `main-tools`), and the environment note (`delivery-os` bin; build before lifecycle commands).
- Ticket truth: `doc/planning/oss-tooling/backlog.md` §"M2-S8 Memory records, layout, and lint" — the four ticket AC artifacts (lint fails on a record missing id/date/evidence; an index line without a backing record and vice versa; budget violations; zero merge conflicts under concurrent creation).
- Predecessor artifacts: `doc/changes/2026-11/2026-11-14--GH-302--memory-conventions-bootstrap-templates/chg-GH-302-spec.md` and `chg-GH-302-test-plan.md` — the tree scaffold, index contract, entry-point template, manual doctor checklist, and the negative guard replaced here; the negative guard lives at `tests/structure/memory-bootstrap-templates.test.ts:258-287`.
- Current committed tree: `.ai/memory/README.md` (172 lines), `.ai/memory/agents/{pm,coder,ceo,fixer}/README.md`, `.ai/memory/lessons/lesson-2026-{001,002,003}-*.md`, `.ai/memory/tacit/`.
- Contracts and code under test: `packages/core/src/contracts/memory-record.ts` (the schema authority delivered in phase 1: required/optional keys, closed vocabularies, id and file-name grammars, `STATEMENT_MAX_CHARS` = 280, `HINT_MAX_CHARS` = 120, budget constants, finding register), `packages/core/src/contracts/capsule.ts` (candidate model, `CAPSULE_CANDIDATE_TRUST` T0–T5, five evidence prefixes), `packages/core/src/domain/capsule-candidates.ts` (`recordContent`, `validateCandidate`, the `kind` mapping and home-area derivation), `packages/adapters/src/file/memory-promotion.ts` (reader, writer, index-row append), `packages/adapters/src/io/privacy-rules.ts` (seven recognizer classes: six secret + one private-literal; three suppression classes), `scripts/checks/*.ts` (invariant convention), `package.json` scripts, `.github/workflows/ci.yml` (`ts-invariants` job).
- Test precedents: `tests/checks/retro-key-containment.test.ts` (live scan + planted-failure mutations), `tests/checks/forbidden-literals.test.ts` (per-class failing mutations, read-only scan), `tests/checks/error-table-sync.test.ts` (temp-copy mutations), `tests/structure/content-inventory.test.ts` (source inventory equality), `tests/checks/ci-wiring.test.ts` (aggregate/CI citation pins), `tests/fixtures/capsule/promotion.ts` (temp memory tree + real promotion writer), `tests/behaviour/closeout-capsule-*.test.ts`.
- Milestone scenario seeds (inherited, content not restated): SC-M2-S8-01 (missing id/evidence fails per field, non-zero exit) and SC-M2-S8-02 (two agents appending records to different files merge with zero conflicts, both records listed). Mapped in the scenario details below; the seed's `index.data.records` surface is reconciled to the lint's coverage result because this story ships no index command.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Canonical tree: index, four record areas, retro archive + archive index, per-agent and guild entry points; empty areas proved by placeholders; no fleet quarantine area | TC-MEMLAY-001, TC-MEMLAY-003, TC-MEMLAY-004 | Covered |
| AC-F1-2 | Placeholder is not a record/index target/finding; no directory rows; topic files and retro notes represented by entry point/archive index | TC-MEMLAY-002 | Covered |
| AC-F2-1 | Required spine, closed optional set, and closed vocabularies identical across human format, machine contract, and capsule overlap; reconciliation table names each capsule element's disposition | TC-MEMSCHEMA-001 | Covered |
| AC-F2-2 | Each isolated schema violation yields exactly one matching `memory.schema.*` error naming file, field, and value name; no double-reporting under another area, including the schema-owned `source` presence and channel rows | TC-MEMSCHEMA-002, TC-MEMSCHEMA-004, TC-MEMPROV-001 (the two `source` rows) | Covered |
| AC-F2-3 | Whole migrated tree renders every required key, zero schema findings, zero required-field drift | TC-MEMSCHEMA-003 | Covered |
| AC-F3-1 | Promotion home write renders full required spine (trust, basis — `basis` required on promotion-written records, optional on hand-authored ones) and a non-empty read-when hint of at most the published bound (120) derived from applicability with statement fallback; zero findings for record and row | TC-MEMWRITE-001, TC-MEMWRITE-002, TC-MEMWRITE-004 | Covered |
| AC-F3-2 | Curator rules agree with schema, id rule, status transitions, budgets, and row shape; consolidation pass yields a clean tree | TC-MEMWRITE-003 | Covered |
| AC-F4-1 | One line per error finding in declared order under own namespace; summary with record/area/error/advisory counts; non-zero on error, zero on advisories only; byte-identical repeated runs | TC-MEMGATE-001, TC-MEMGATE-002 | Covered |
| AC-F4-2 | Aggregate gate and CI invariants job invoke the same invariant, parity-tested; command inventory, error rows, domain kinds, doctor checks unchanged | TC-MEMGATE-004 | Covered |
| AC-F6-1 | Absent `created` is exactly one `memory.schema.keys-missing` with no dating finding; present-but-malformed and future `created` are each one `memory.dating.*` error; date never inferred from a file name, a commit, or anything else | TC-MEMDATE-001 | Covered |
| AC-F6-2 | Revalidation required for authoritative behaviour-changing lesson; malformed is error; expired is non-gating advisory; entry-point capture-line dates match the declared shape | TC-MEMDATE-002 | Covered |
| AC-F7-1 | Evidence presence and shape and writer presence are classified in `memory.provenance.*`; under the v1.2 presence partition `source` is schema-owned (absent → `memory.schema.keys-missing`, out-of-channel → `memory.schema.value-unknown`), so no key is classified twice; findings never echo a full evidence value | TC-MEMPROV-001 | Covered |
| AC-F7-2 | Three migrated records carry a trust level consistent with their recorded channel and a shaped evidence link, statements and statuses unchanged | TC-MEMPROV-002 | Covered |
| AC-F8-1 | Dangling supersedes/superseded_by/contradicts/link and asymmetric supersession each one `memory.reference.*` error; resolvable references produce none | TC-MEMREF-001, TC-MEMREF-002 | Covered |
| AC-F9-1 | Record without row → `memory.index.record-uncovered`; row without covered path → `memory.index.row-unbacked`; independent, one of each yields exactly two findings | TC-MEMINDEX-001 | Covered |
| AC-F9-2 | Empty/over-long hint, duplicate row, and rows targeting topic file/retro note/area directory each a `memory.index.*` error; the archive index covers every note exactly, evaluated over its own universe (U-2) with the universe named in the detail | TC-MEMINDEX-002, TC-MEMINDEX-003 | Covered |
| AC-F10-1 | Over-cap index lines/bytes, agent/guild entry lines, archive index lines are errors naming file, measured value, cap; kernel 200–220 warn, >220 error; exactly at cap passes | TC-MEMBUDGET-001 | Covered |
| AC-F10-2 | Delivered tree measures within every cap: index ≤200 lines and ≤25 KB, entry points ≤150, archive index ≤200, kernel inside advisory band | TC-MEMBUDGET-002 | Covered |
| AC-F11-1 | File-listing and command-echo fenced blocks each one `memory.derivable.*` advisory, exit stays zero, advisory count reported; neither pattern → no finding | TC-MEMHEUR-001, TC-MEMHEUR-002 | Covered |
| AC-F12-1 | One `memory.secret.<class>` error per recognizer class naming path, line, and class, never the value; rule-id set equals the privacy vocabulary's classes exactly | TC-MEMSECRET-001 | Covered |
| AC-F12-2 | Documented placeholder or suppression marker inside a matched span produces no finding; markerless value of the same shape produces the finding | TC-MEMSECRET-002 | Covered |
| AC-F13-1 | Two agents on parallel branches create records in their own namespace; zero merge conflicts across the record files and each creator's own entry-point namespace; the index-row pair is outside that claim and resolves by union (AC-F13-2); both records covered by exactly one row each after resolution | TC-MEMCONC-001 | Covered |
| AC-F13-2 | Two promotion writes land two record files plus two index rows; no file conflict, both rows survive union resolution, no duplicate/orphan row, re-run adds nothing | TC-MEMCONC-002 | Covered |
| AC-F14-1 | Replacement guard asserts the invariant exists and is cited by both gate surfaces, retains the narrowed file-name sanction scan over `scripts/`, `tools/`, `packages/` whose permitted-match set equals the sanctioned module set (check edge, pure evaluator, schema contract module) and fails on a planted unsanctioned module, and still asserts no memory subcommand, five doctor checks, unchanged error-table rows; old absence-only assertion gone | TC-MEMGUARD-001 | Covered |
| AC-NFR1-1 | Byte-identical output including order and truncation for a fixed tree and a fixed injected date; exactly one date read at the edge and no ambient clock in the pure evaluation; zero writes, no network; at a later injected date only date-derived findings differ | TC-MEMGATE-002, TC-MEMGATE-003, TC-MEMNFR-001 | Covered |
| AC-NFR2-1 | Declared size bound completes inside the wall-clock bound, one read per file, no shell-out | TC-MEMNFR-002 | Covered |
| AC-NFR5-1 | At most 100 error findings and 100 advisories printed in deterministic order, followed by one truncation line with true totals | TC-MEMNFR-003 | Covered |
| AC-NFR7-1 | New user-facing docs registered where required; every new doc under a marker root carries `ados_distribution`; distribution guard zero drift | TC-MEMNFR-004 | Covered |
| AC-NFR8-1 | Clean checkout, repository-local TMPDIR, aggregate gate green including memory invariant, boundary, prompt/help conformance, distribution guard | TC-MEMNFR-005 | Covered |
| AC-NFR10-1 | Command inventory, error table, domain kinds, state record kinds, event topics, doctor check set identical to pre-change values | TC-MEMGUARD-002, TC-MEMGATE-004 | Covered |

**Coverage result: 30 of 30 ACs covered; zero TODO; zero orphan TCs.** Every scenario below maps to at least one AC from this table.

**Revision 1.5 strengthening (review-iteration-1 remediation, plan phase 8).** No verdict language changes and no AC moves owner. The following cells gain assertions under their existing TCs: AC-F3-1 gains the supersession writer → invariant round trip (TC-MEMWRITE-001), the derived-not-truncated hint (TC-MEMWRITE-002), and the candidate statement bound with zero writes over the bound and a clean promotion at the bound (TC-MEMWRITE-004); AC-F4-1 gains the printed global area order across severities (TC-MEMGATE-002); AC-F10-1 gains the newline-terminated at-cap case (TC-MEMBUDGET-001); AC-F12-1/AC-F12-2 gain key-half versus value-segment suppression agreement with the whole-tree guard (TC-MEMSECRET-002); AC-F8-1 gains the out-of-tree link scope control (TC-MEMREF-001); AC-F2-2 gains the empty/whitespace/non-string statement rows (TC-MEMSCHEMA-002).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP or event surface is added or changed (spec §8.1/§8.2). The data-model surfaces are primary:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Canonical typed-record schema: required spine, closed optional set, closed vocabularies, id and file-name grammar, validity start, conditional requirements (`basis`, `revalidate_after`, `guild`, `superseded_by`, preference `source`), the published 280/120 bounds, precedence rule, and the `scope: fleet` value refused on a promotable record | TC-MEMSCHEMA-001, TC-MEMSCHEMA-002, TC-MEMSCHEMA-003, TC-MEMSCHEMA-004, TC-MEMWRITE-004 | Covered |
| DM-2 | Canonical tree layout and per-area budgets; placeholder semantics; absent fleet quarantine | TC-MEMLAY-001, TC-MEMLAY-002, TC-MEMLAY-003, TC-MEMLAY-004 | Covered |
| DM-3 | Index row and coverage contract: row shape, hint bound, the two coverage universes (U-1 memory index, U-2 archive index), explicitly-not-covered set, both-direction findings | TC-MEMINDEX-001, TC-MEMINDEX-002, TC-MEMINDEX-003, TC-MEMLAY-002 | Covered |
| DM-4 | Finding model: identity shape/register, area order, fields, severity, emission, exit, ceiling | TC-MEMSCHEMA-004, TC-MEMGATE-001, TC-MEMGATE-002, TC-MEMNFR-003 | Covered |
| DM-5 | Budget declaration single source (index lines/bytes, agent/guild/archive caps, kernel warn/error band) | TC-MEMBUDGET-001, TC-MEMBUDGET-002 | Covered |
| DM-6 | Capsule reconciliation: candidate key set (source tightened), trust/evidence vocabularies, read projection stability, additive promotion content, unchanged events/naming/close | TC-MEMSCHEMA-001, TC-MEMWRITE-004 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Determinism and read-only evaluation measured at a fixed injected date: byte-identical ordered output; exactly one date read at the edge, zero writes, randomness, network | TC-MEMGATE-002, TC-MEMGATE-003, TC-MEMNFR-001 | Covered |
| NFR-2 | Scan cost ≤1 s wall for ≤2,000 files or ≤8 MB, one read per file, linear | TC-MEMNFR-002 | Covered |
| NFR-3 | Gate overhead ≤1 s added to the aggregate local gate, measured and recorded | TC-MEMNFR-002 (measurement recorded in TC-MEMNFR-005 evidence) | Covered |
| NFR-4 | Tier and purity: pure domain evaluation, contracts data-only, file reading at adapter/edge, boundaries green | TC-MEMGATE-003, TC-MEMNFR-005 (boundary job) | Covered |
| NFR-5 | Bounded output: ≤100 errors and ≤100 advisories, one truncation line with true totals, deterministic under truncation | TC-MEMNFR-003 | Covered |
| NFR-6 | Local/CI parity on one invocation with a parity test | TC-MEMGATE-004 | Covered |
| NFR-7 | Documentation conformance across both phases: at the delivery boundary the registry is unchanged, markers hold under marker roots, and drift is zero; the landed phase-7 feature spec is present, marked, registered, and indexed, verified by a post-landing guard run | TC-MEMNFR-004 | Covered |
| NFR-8 | Authoring-time gate green on a clean checkout with a repository-local TMPDIR | TC-MEMNFR-005 | Covered |
| NFR-9 | Secret hygiene of findings: path, line, class only — never a matched value | TC-MEMSECRET-001, TC-MEMPROV-001 | Covered |
| NFR-10 | No new surface: command, flag, error row, domain kind, state record, event, or doctor check | TC-MEMGUARD-002, TC-MEMGATE-004 | Covered |
| NFR-11 | Verdict stability under growth: no assertion that record count equals a fixed number; empty and growing areas both pass | TC-MEMLAY-004, TC-MEMSCHEMA-003 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a mixed TypeScript + docs change and runs every applicable layer. The pure evaluation is exercised in-process; the executable check and its mutations run through the check tier; tree and contract assertions live in the structure tier; promotion-writer and concurrency exercises live in the behaviour/integration tier.

- **Unit (pure domain evaluation).** `packages/core/src/domain/memory-lint.ts` and `packages/core/src/contracts/memory-record.ts` — pure functions over an injected file list and text map, with the privacy vocabulary and a fixed date injected. Tests import the module directly from `tests/checks/**` and feed fixture trees in memory; no filesystem writes inside the evaluation. Runner: `bun test`.
- **Check (repository invariant).** `scripts/checks/memory-lint.ts` — the bun-run edge: it calls the scanner, calls the pure evaluation with the scanned text map, the injected privacy vocabulary, the published constants, and its one date read, then prints findings and the summary and projects the exit. The edge owns **the single ambient date read and printing**; every file read and the YAML frontmatter parse belong to the scanner adapter, and contracts/domain perform no I/O. Mutation tests build a temporary tree, invoke the exported pure scan, and assert the exact finding identities. Execution of the live check: `bun run scripts/checks/memory-lint.ts`.
- **Behaviour.** `tests/behaviour/memory-promotion-schema.test.ts` uses `tests/fixtures/capsule/promotion.ts` (`makeTempMemory`, `makePromotionRuntime`, `candidateYaml`) to run the real promotion writer over a temporary memory root, then evaluate the written tree with the lint.
- **Integration (git).** `tests/behaviour/memory-concurrency-merge.test.ts` builds a temporary git repository, creates two branches that each add a distinct record file plus a line in that creator's own entry point, merges both, asserts zero conflicts across the record files and the entry-point namespaces, resolves the single index-file conflict by the documented union rule, and asserts a clean post-merge lint with both records covered.
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

`pnpm check` is `lint → format:check → typecheck → test → check:boundaries → check:memory → prompt-conformance → help-guide-coverage → exports-parity`. `check:memory` resolves to `bun run scripts/checks/memory-lint.ts`, and the CI `ts-invariants` step cites that same path directly; the parity assertion in TC-MEMGATE-004 compares the **resolved** invocation on both surfaces, not the raw strings. `bunfig.toml` discovery covers `tests/**`; fixtures stay un-named as `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type / Level | Automation | Priority | AC Coverage |
|-------|-------|--------------|------------|----------|-------------|
| TC-MEMLAY-001 | Canonical layout present in the committed tree | Structure | Automated | High | AC-F1-1 |
| TC-MEMLAY-002 | Placeholder, topic-file, retro-note, and directory-row semantics | Structure + Check | Automated | High | AC-F1-2 |
| TC-MEMLAY-003 | Invented area and fleet quarantine absence (negative mutant) | Structure (negative) | Automated | High | AC-F1-1 |
| TC-MEMLAY-004 | Empty-tree and populated-tree verdict stability | Check | Automated | Medium | AC-F1-1, NFR-11 |
| TC-MEMSCHEMA-001 | Human/machine/capsule schema parity and reconciliation table | Structure (contract) | Automated | Critical | AC-F2-1, DM-6 |
| TC-MEMSCHEMA-002 | One-defect-per-case schema mutation table | Check | Automated | Critical | AC-F2-2 (seed SC-M2-S8-01) |
| TC-MEMSCHEMA-003 | Whole-tree conformance and zero drift surface | Check + Structure | Automated | Critical | AC-F2-3, NFR-11 |
| TC-MEMSCHEMA-004 | Closed finding-register conformance | Check | Automated | High | AC-F2-2, DM-4 |
| TC-MEMWRITE-001 | Promotion write renders full schema and hint; zero findings | Behaviour | Automated | Critical | AC-F3-1 |
| TC-MEMWRITE-002 | Read-when hint derivation and bound | Behaviour | Automated | High | AC-F3-1, DM-3 |
| TC-MEMWRITE-003 | Curator rules agree; consolidation pass clean | Structure + Manual | Semi-automated | High | AC-F3-2 |
| TC-MEMWRITE-004 | Capsule reconciliation: `source` channels and `scope: fleet` refusals | Behaviour + Structure | Automated | High | AC-F3-1, DM-1, DM-6 |
| TC-MEMGATE-001 | Exit verdict, finding lines, summary counts | Check | Automated | Critical | AC-F4-1 (seed SC-M2-S8-01) |
| TC-MEMGATE-002 | Determinism and declared ordering | Check | Automated | Critical | AC-F4-1, AC-NFR1-1 |
| TC-MEMGATE-003 | Read-only, clock-free, offline evaluation | Check + Structure | Automated | Critical | AC-NFR1-1, NFR-4 |
| TC-MEMGATE-004 | Aggregate gate and CI invariants wiring parity | Structure | Automated | Critical | AC-F4-2, AC-NFR10-1, NFR-6 |
| TC-MEMDATE-001 | Creation-date classification: absent, malformed, future | Check | Automated | Critical | AC-F6-1 (seed SC-M2-S8-01) |
| TC-MEMDATE-002 | Revalidation windows and capture-line dates | Check | Automated | High | AC-F6-2 |
| TC-MEMPROV-001 | Evidence presence/shape and writer in provenance; `source` presence/channel in schema per the partition | Check | Automated | Critical | AC-F7-1, AC-F2-2 (seed SC-M2-S8-01), NFR-9 |
| TC-MEMPROV-002 | Migrated-records backfill fidelity | Structure + Manual | Semi-automated | High | AC-F7-2 |
| TC-MEMREF-001 | Dangling supersedes/superseded_by/contradicts/link | Check | Automated | High | AC-F8-1 |
| TC-MEMREF-002 | Resolvable references and asymmetry control | Check | Automated | High | AC-F8-1 |
| TC-MEMINDEX-001 | Both-direction coverage independence | Check | Automated | Critical | AC-F9-1 |
| TC-MEMINDEX-002 | Row shape, duplicate rows, wrong-target rows | Check | Automated | High | AC-F9-2 |
| TC-MEMINDEX-003 | Archive index covers notes exactly, over its own universe | Check | Automated | High | AC-F9-2 |
| TC-MEMBUDGET-001 | Cap boundaries and kernel bands | Check | Automated | Critical | AC-F10-1 |
| TC-MEMBUDGET-002 | Delivered tree within every cap (measured) | Check + Structure | Automated | Critical | AC-F10-2 |
| TC-MEMHEUR-001 | Derivable advisory classes (positive) | Check | Automated | High | AC-F11-1 |
| TC-MEMHEUR-002 | Derivable negative control and non-gating exit | Check | Automated | High | AC-F11-1 |
| TC-MEMSECRET-001 | One finding per recognizer class; no value echo; rule-id set | Check | Automated | Critical | AC-F12-1, NFR-9 |
| TC-MEMSECRET-002 | Suppression classes and markerless control | Check | Automated | Critical | AC-F12-2 |
| TC-MEMCONC-001 | Parallel-branch record creation: zero conflicts on records and own entry points, union-resolved index pair, coverage after merge | Integration | Automated | Critical | AC-F13-1 (seed SC-M2-S8-02) |
| TC-MEMCONC-002 | Two promotion writes and union-resolved index rows | Behaviour | Automated | Critical | AC-F13-2 (seed SC-M2-S8-02) |
| TC-MEMGUARD-001 | Negative guard replaced: presence + narrowed sanction scan + preserved absences | Structure | Automated | Critical | AC-F14-1 |
| TC-MEMGUARD-002 | Inventory equality (no new surface) | Structure | Automated | Critical | AC-NFR10-1 |
| TC-MEMNFR-001 | Byte-identical output and state-free run | Check | Automated | Critical | AC-NFR1-1 |
| TC-MEMNFR-002 | Scan cost and gate overhead | Check (performance) | Automated | Medium | AC-NFR2-1, NFR-3 |
| TC-MEMNFR-003 | Output ceiling and truncation line | Check | Automated | High | AC-NFR5-1 |
| TC-MEMNFR-004 | Doc conformance across both phases: delivery-boundary registry/markers/drift plus the landed spec's presence, marker, registration, and index row | Structure + shell guard | Automated | High | AC-NFR7-1 |
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
**Test Type(s)**: Structure + Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-layout.test.ts` (step 1, placeholder and target structure, plan phase 1) + `tests/checks/memory-lint-index.test.ts` (steps 2-4, pure coverage evaluation, plan phase 3)
**Tags**: @bun, @structure, @memory

**Given / When / Then**: Given the completed tree, when placeholder and directory rules are applied, then `.gitkeep` is neither a record, an index target, nor a finding; no record area has a directory row; and topic files and retro notes are represented by their entry point or archive index rather than by their own rows.

**Preconditions**:

- TC-MEMLAY-001 passes (the tree and its placeholder files exist).
- The lint's covered-path classifier is importable **for steps 2-4 only**; step 1 needs the record file-name grammar from the machine contract and the index's path column, not the evaluator.

**Steps**:

1. **Structural half (plan phase 1, `tests/structure/memory-layout.test.ts`):** parse the index's two-column table and assert `.gitkeep` matches no record file-name grammar and appears in no row's path column, and that no row's path column resolves to a directory in the committed tree (for example `lessons/`), so a placeholder is not a record or an index target and a directory cannot be one either. Assert the parse saw at least one row, so the directory check is non-vacuous.
2. **Coverage half (plan phase 3, `tests/checks/memory-lint-index.test.ts`):** feed a fixture tree containing `.gitkeep`, a topic file beside an entry point, a retro note under `retro/<year>/`, and a directory row attempt for `lessons/` to the pure coverage evaluation; assert `.gitkeep` produces no finding and is not required to be indexed.
3. Assert the topic file and the retro note produce no `record-uncovered` finding.
4. Assert the directory row produces exactly one `memory.index.row-unbacked` naming `lessons/` and the universe `memory-index`: a directory is not a covered path, and a row whose path is not a covered path is the register's `row-unbacked` identity (DM-3's both-directions clause). `memory.index.row-malformed` is reserved for hint-shape defects (empty → `hint-missing`, over-long → `row-malformed`); the closed register has no separate wrong-target identity, so the assertion pins `row-unbacked` and fails if a second index finding is emitted for the same row.

**Expected Outcome**:

- Placeholder and representation rules hold; no false positives on legitimate non-covered files; directory rows are rejected.

**Notes / Clarifications**:

- **Fixture / mutant**: the structural half reads the live tree and has no evaluator dependency; the coverage half is an in-memory fixture tree (Section 6) with the four shapes and is homed in the index checks suite, which is where the coverage evaluation that answers the question is delivered (plan phase 3). Step 1 keeps the phase-1 structure file able to satisfy its side of the scenario without asserting behaviour its phase does not own.

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

- Plan phase 1 has landed `packages/core/src/contracts/memory-record.ts` and the README rewrite.
- The README's record-format block is parseable as a fenced YAML example with key comments.
- `packages/core/src/contracts/capsule.ts` is imported read-only for the vocabulary it exposes. `validateCandidate` is **not** exercised here: the accept/refuse behaviour of the four `source` channels lands in plan phase 5 and is owned by TC-MEMWRITE-004.

**Steps**:

1. Import the machine contract's required keys, optional keys, and closed vocabulary constants.
2. Parse the README's record-format example and extract the keys it presents as required and optional.
3. Assert set equality for required and optional key sets, and assert every vocabulary constant appears verbatim in the README's documented value lists.
4. Assert the capsule overlap structurally, over only the vocabulary the capsule actually exposes: `trust` equals `CAPSULE_CANDIDATE_TRUST`; the evidence-link prefixes match the capsule's five prefixes; `status` is the schema subset declared for the capsule. The capsule contract carries no `source` vocabulary (`readonly source: string`), so no source-constant equality is asserted and none is invented. The capsule contract is **read for parity only**; the four-channel accept/refuse behaviour is not asserted here at all — it lands with `validateCandidate` in `packages/core/src/domain/capsule-candidates.ts` (plan phase 5) and is owned by TC-MEMWRITE-004 steps 1-2.
5. Parse the reconciliation table and assert it names each DM-6 capsule element (candidate required set, trust vocabulary, evidence shapes, read projection, promotion write content, promotion read scope, the projection rule for a non-projectable scope, events/naming/close) with a change/no-change disposition.
6. Assert the README's published format is labelled the human rendering of the machine contract (precedence rule present).

**Expected Outcome**:

- Zero drift between the human format and the machine contract; the capsule overlap is asserted exactly where the capsule exposes the vocabulary (trust, evidence prefixes, status subset); the absence of a capsule `source` vocabulary is asserted as an absence, with the channel behaviour left to TC-MEMWRITE-004; the reconciliation table is complete, including the non-projectable-scope projection rule DM-6 states.

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
- The statement bound is imported as `STATEMENT_MAX_CHARS` from `packages/core/src/contracts/memory-record.ts` (ADR-0011 D6); the number never appears as a code literal in the suite (the parenthesised readings in this plan are documentation, not fixture inputs).

**Steps**:

1. For each row of the mutation table below, build a tree containing one mutated record (and a valid index row) and run the evaluation.
2. Assert exactly one finding in the `schema` area with the expected rule id.
3. Assert no finding from `dating`, `provenance`, `reference`, `index`, `budget`, `derivable`, or `secret` for the same defect (no double-reporting).
4. Assert the detail contains the record path and the offending key's name; assert it does not contain an echoed secret or a full evidence value.
5. Run the boundary/conditional controls below and assert the stated silence or classification.

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
| 9 | statement of `STATEMENT_MAX_CHARS + 1` characters (281 today) | `memory.schema.statement-too-long` |
| 10 | preference record whose source is not `human_correction` | `memory.schema.preference-source` |
| 11 | guild tag disagreeing with the guild directory | `memory.schema.guild-mismatch` |
| 12 | guild tag present outside a guild folder | `memory.schema.guild-mismatch` |
| 13 | superseded record without `superseded_by` | `memory.schema.superseded-by-missing` |
| 14 | empty statement (absent-as-empty, `statement: ""`) | `memory.schema.keys-missing` |
| 15 | whitespace-only statement | `memory.schema.keys-missing` |
| 16 | non-string statement (`statement: 42`) | `memory.schema.keys-missing` |

**Boundary and conditional controls (asserted silence or classification, no new rule id):**

| Control | Expected outcome |
|---|---|
| statement of `STATEMENT_MAX_CHARS - 1` characters (279 today) | no finding |
| statement of exactly `STATEMENT_MAX_CHARS` characters (280 today) | no finding (bound is inclusive) |
| hand-authored record omitting `basis` | no finding — `basis` is optional on a hand-authored record and omitted when absent (ADR-0011 D5); the promotion path's guarantee that `basis` is always rendered is asserted in TC-MEMWRITE-001, so the conditional needs no lint-side discriminator |
| record with `basis: "gut-feel"` (outside the five capture-bar bases) | one `memory.schema.value-unknown` naming `basis` |

**Expected Outcome**:

- Sixteen isolated defect cases, sixteen matching findings, zero cross-area noise; the statement bound is enforced at the imported constant with a correct inclusive boundary; an absent-as-empty or non-string statement is exactly one `memory.schema.keys-missing` naming the key, never also a `statement-too-long` or another area's finding; the `basis` conditional resolves to "optional on a record, always rendered by promotion" rather than to an invented finding.

**Notes / Clarifications**:

- This is the ticket's "lint fails on a record missing id" artifact in its isolated form; the combined missing-id/date/evidence case is TC-MEMGATE-001 + TC-MEMDATE-001 + TC-MEMPROV-001 and seed SC-M2-S8-01.
- **Fixture / mutant**: `tests/fixtures/memory/mutants.ts` exports one record text per row, each built from the imported schema constants (`STATEMENT_MAX_CHARS` for the statement rows, the closed vocabularies for the value rows); the baseline record is the single source reused by every area suite.

#### TC-MEMSCHEMA-003 - Whole-tree conformance and zero drift surface

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-1, NFR-11
**Test Type(s)**: Check + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-record-schema.test.ts` (whole-tree block — plan phase 4 scope), with the live check run as the paired evidence of step 1
**Tags**: @bun, @check, @structure, @memory

**Given / When / Then**: Given the whole migrated tree, when the invariant runs at the delivered HEAD, then every record renders every required key, zero schema findings are reported, and no required field exists in the schema and is absent from a rendered record.

**Preconditions**:

- Layout and migration have landed (tree-green rule: the gate is enabled only after this passes).
- The delivered tree contains the three migrated records and any new records added by this change.
- Both halves live in `tests/structure/memory-record-schema.test.ts`, which plan phase 4 declares in scope; `tests/checks/memory-lint-schema.test.ts` (phase 2) is **not** the home of this block.

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

**Given / When / Then**: Given a capsule candidate that passes the capture bar and evidence rules, when the promotion home write is applied, then the written record carries every required schema key including `trust` and `basis`, the appended index row's second column is a non-empty read-when hint of at most the published `HINT_MAX_CHARS` (120), and the invariant reports zero findings for that record and that row.

**Preconditions**:

- The promotion writer is extended to render the schema and the hint (plan phase 5).
- `makeTempMemory` seeds an index with a table header; `candidateYaml` produces a valid candidate.
- `STATEMENT_MAX_CHARS` and `HINT_MAX_CHARS` are imported from `packages/core/src/contracts/memory-record.ts`; no bound is restated in the suite.

**Steps**:

1. Run `runPromotionCloseout` with one valid lesson candidate over a temp memory root.
2. Parse the written record's frontmatter and assert the required spine is complete, including `trust` in T0–T5 and a `basis` from the five capture-bar bases.
3. **`basis` conditional, its own assertion:** assert every promotion-written record in the fixture corpus renders `basis` and that its value is a member of the imported five-base vocabulary — the writer guarantee that discharges ADR-0011 D5's "required on a promotion-written record" without a lint-side discriminator (the hand-authored omission case is the control in TC-MEMSCHEMA-002).
4. Parse the appended index row; assert path in backticks, non-empty second column, `length <= HINT_MAX_CHARS`, and that it answers "when do I read this" (derived from `applies_when`).
5. Run the pure memory evaluation over the temp root's text map; assert zero findings for the record and the row.
6. **Supersession round trip (review F-1, plan phase 8):** promote a lesson carrying `supersedes: [<target>]` over a schema-valid `status: candidate` target that already has its own index row, then scan the resulting temp tree and run `evaluateMemory`; assert ZERO findings, the target carries `status: superseded` and `superseded_by` naming the new record, and neither `memory.schema.superseded-by-missing` nor `memory.reference.supersede-asymmetry` is emitted. The same round trip is asserted in `tests/behaviour/closeout-capsule-supersession.test.ts` (the legacy TC-CAP-020 suite), which also pins the exact replacement link.

**Expected Outcome**:

- A promoted record passes the new gate on the first attempt; no field is rendered by the writer that the schema does not accept, and none required is omitted.

**Notes / Clarifications**:

- This is the DoD-4 evidence and the "promoted record plus its row yields zero findings" clause of AC-F3-1.
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

**Given / When / Then**: Given a candidate with an applicability statement, when the row is rendered, then the hint is the applicability statement — proving the column reads as a read-when hint rather than an echo of the record's statement; given none, then the hint falls back to the statement; in both cases the hint is non-empty, whitespace-collapsed, and at most the published `HINT_MAX_CHARS` (120).

**Preconditions**:

- The hint derivation is a pure function in the promotion writer or its domain helper.
- `HINT_MAX_CHARS` is imported from `packages/core/src/contracts/memory-record.ts`; the literal 120 never appears in the suite.

**Steps**:

1. Render with `applies_when` present; assert the second column equals the applicability statement (whitespace-normalized) when within the bound, and that it differs from the record's own statement — the discrimination DEC-7 requires.
2. Render with `applies_when` absent; assert the second column falls back to the statement.
3. **Over-bound derivation, never a truncation (review F-2, plan phase 8):** render with an `applies_when` and a statement that both exceed the bound; assert the column is non-empty, at most `HINT_MAX_CHARS`, and is a deterministic phrase derived from the candidate's class and scope — not the applicability prefix, not the statement prefix, and not any slice of either. Also render a candidate with no `applies_when` and a statement over the hint bound; assert the same derived phrase. Two runs over one candidate render the same row.
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

- `.opencode/skills/consolidate-memory/SKILL.md` is reconciled in plan **phase 6** ("Kernel and curator alignment with the memory lint, and doc conformance"); phase 6's scope declares the skill file and `tests/structure/memory-record-schema.test.ts`, and its commit subject is `docs(GH-301): align the kernel and curator rules with the memory lint`.
- AC-F3-2 is owned by phase 6 in the plan's AC-ownership table.

**Steps**:

1. Automated: read the skill and assert it names the required key set, the monotonic id rule and non-reuse-after-prune, the five statuses with writer-emitted subset, the budget caps, and the read-when row shape; assert no contradicting instruction (for example a different required field list) is present.
2. Automated: assert the skill's permissible operations still include duplicate merge, demote/drop, supersession, prune-with-reason, split-into-topic-files, and index rebuild.
3. Manual: perform a consolidation pass in a temporary copy of the tree (merge a duplicate pair, mark a supersession, split an over-cap entry point), then run the invariant; record the clean verdict in Section 10.
4. Manual: record the skill-content comparison verdict in the **phase 6** plan notes.

**Expected Outcome**:

- Rules and gate agree; a curator pass cannot author a record its own gate rejects.

**Notes / Clarifications**:

- The consolidation pass is deliberately manual: it is a human/skill workflow, not code under test. Automation covers the written-rule parity only; this split is stated rather than overclaimed.
- **Fixture / mutant**: live skill file; temporary tree copy for the manual pass.

#### TC-MEMWRITE-004 - Capsule reconciliation and `source` tightening

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-1, DM-6, DEC-8, NG-6, RSK-7
**Test Type(s)**: Behaviour + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-promotion-schema.test.ts` (capsule block) and `tests/structure/memory-record-schema.test.ts`
**Tags**: @bun, @behaviour, @structure, @memory

**Given / When / Then**: Given a candidate whose `source` is free text outside the four declared channels, when candidate schema validation runs, then closeout refuses it through the existing `closeout.capsule-invalid` identity; given a `lesson` or `tacit` candidate carrying `scope: fleet`, then it is refused at candidate-schema time through that same identity, the writer renders nothing, and no promoted record is created; given a valid candidate, then the memory-record read projection is unchanged (`{id, class, statement, status, path}`) and no candidate field, event, or naming rule changed.

**Preconditions**:

- The candidate contract tightening is additive on an already-required key (DEC-8); the `scope: fleet` refusal is a projection rule added in `validateCandidate` (plan phase 5), not a widening of the capsule contract.
- `runPromotionCloseout` returns the envelope error code.

**Steps**:

1. Run a candidate with `source: "anecdotally"`; assert exit 1 and error code `closeout.capsule-invalid`.
2. Run a candidate with each of the four valid channels; assert acceptance and a promotion decision.
3. **`scope: fleet` refusal, `lesson` class:** run a `lesson` candidate carrying `scope: fleet`; assert the candidate is refused at candidate-schema time (`validateCandidate`) through the existing `closeout.capsule-invalid` identity, assert the writer produced **no record file and no index row** in the temp memory root, and assert no record carrying `scope: "fleet"` exists anywhere in the written tree — the value DM-1 calls "deliberately the value with no implemented home".
4. **`scope: fleet` refusal, `tacit` class:** repeat step 3 with a `tacit` candidate; same refusal, same zero writes.
5. **Do not widen the capsule contract:** assert `CAPSULE_CANDIDATE_SCOPES` still declares `fleet` (the candidate vocabulary keeps the value; the refusal lives in the projection, not in a narrowed contract), and assert no candidate field, event topic, candidate file-naming rule, or terminal-close behaviour changed.
6. **Class-level `fleet` is a different, delivered rejection:** assert an existing `class: fleet` candidate still yields its delivered `owner-approval-required` rejection (NG-6), so the scope-level refusal is proven not to have replaced or duplicated the class-level routing rejection.
7. Assert the read projection keys and the candidate required-key set are unchanged apart from `source`'s closed validation.
8. Assert the candidate file naming (`<id>.yaml`), event topics, and terminal-close behaviour are untouched by a focused structure assertion over the capsule contract and closeout fixtures.
9. **Statement bound (review F-3, plan phase 8):** run a candidate whose statement is `STATEMENT_MAX_CHARS + 1`; assert exit 1, the existing `closeout.capsule-invalid` identity, and zero writes (no record file, no index row). A statement exactly at `STATEMENT_MAX_CHARS` promotes and the resulting tree lints clean. Both bounds are imported from the contract, never restated.

**Expected Outcome**:

- The tightening refuses an illegitimate source and refuses a `fleet`-scoped promotable record without widening the capsule contract; both refusals reuse the capsule-invalid identity, render nothing, and no other capsule element changed.

**Notes / Clarifications**:

- **Fixture / mutant**: `candidateYaml({ source: ... })` and `candidateYaml({ scope: "fleet" })` for the lesson and tacit classes; the existing `tests/behaviour/closeout-capsule-schema.test.ts` table is extended only if the plan places it there, otherwise this test owns it.

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

**Given / When / Then**: Given an unchanged tree and one fixed injected date, when two consecutive runs execute, then the finding output is byte-identical; and the findings are ordered by area order, then repository-relative path, then line, then rule id.

**Preconditions**:

- The evaluation is deterministic and file enumeration is sorted.
- The injected date is a fixed constant for the whole test module (`2026-11-15`); no step relies on the wall clock.

**Steps**:

1. Run the check twice over the same temp tree **with the same injected date** and findings in several areas (including a future-date finding, which is the only date-derived class here); assert byte equality of stdout and identical exit codes.
2. Construct a tree with two findings in one file, one line-scoped and one record-scoped, and findings across areas; assert the output order matches `(area index, path, line, rule id)`.
3. Assert the pure evaluation does not consult `Date.now()`: inject a clock that throws if called; assert the run succeeds, so the date cannot arrive from an ambient read inside the evaluation.
4. Assert repeated runs over the live tree also produce identical output.
5. **Printed order across severities (review F-9, plan phase 8):** on a mixed tree carrying a derivable advisory (area 7) and a secret error (area 8), assert the printed WARN derivable line appears before the printed FAIL secret line — one globally area-ordered stream, with the two severity ceilings applied as separate print budgets — and that two runs are byte-identical.

**Expected Outcome**:

- Byte-identical repeated output; declared ordering holds; no clock dependency in the pure evaluation.

**Notes / Clarifications**:

- **Fixture / mutant**: multi-area `errorTree()`; a `throwingClock` injection helper.
- **The single edge date read is proven elsewhere, deliberately:** the counting date-reader injection needs the check edge `scripts/checks/memory-lint.ts`, which lands in plan phase 4, while this scenario is owned by plan phase 3. The proof lives in TC-MEMNFR-001 step 3 (phase 4), which injects a counting date reader and asserts exactly one read per run with that value reaching the pure evaluation; step 3 here keeps the domain-side half (a throwing clock inside the evaluation) and step 1/4 keep the fixed-date determinism. The assertion is not lost, only homed in the phase that can execute it.

#### TC-MEMGATE-003 - Read-only, clock-free, offline evaluation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-4, F-4
**Test Type(s)**: Check + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-output.test.ts` (read-only block) + boundary suite
**Tags**: @bun, @check, @boundaries, @memory

**Given / When / Then**: Given the live repository, when the invariant runs, then the working tree is byte-identical before and after; the pure evaluation receives an injected file list, text map, and date value (no filesystem access, no network, no ambient clock); the scanner adapter owns every file read and the YAML frontmatter parse; the check edge owns the single ambient date read and printing; and contracts/domain perform no I/O.

**Preconditions**:

- `packages/adapters/src/file/memory-scan.ts` is the only fs-reading module (the plan makes it "the only reader/parser", 4.1); the pure evaluation is in the domain tier; the only ambient date read sits in the check edge and is injected once (NFR-1, NFR-4).

**Steps**:

1. Record `git status --porcelain` before and after `bun run scripts/checks/memory-lint.ts`; assert equality (mirrors `forbidden-literals.test.ts`).
2. Static assertion (domain and contracts): `packages/core/src/domain/memory-lint.ts` imports no `node:fs`, `node:child_process`, `node:net`, `fetch`, or YAML parser; `packages/core/src/contracts/**` exports data/types only; neither module reads a clock (no `Date.now`, no `new Date()` without an argument) and neither imports `packages/adapters/**` (the `matrix-core-importer` rule).
3. Static assertion (the declared three-way boundary, stated as the plan states it): **the scanner adapter (`packages/adapters/src/file/memory-scan.ts`) owns every file read and the YAML frontmatter parse; the check edge owns the single ambient date read and printing; contracts/domain perform no I/O.** Concretely: `readFileSync`/`readdirSync`/frontmatter parse appear in the scanner and in no other module of this check; `scripts/checks/memory-lint.ts` imports the scanner factory, contains exactly one ambient date read call site whose value is passed into the evaluation, and performs no fs read or YAML parse of its own; no module outside the scanner reads a memory-tree file.
4. Run `pnpm check:boundaries` (or `bun test tests/boundaries`) and assert green, including the new modules in the inventory.

**Expected Outcome**:

- The invariant mutates nothing, calls no network, and reads no clock outside its single injected date read; the read/parse boundary sits in the adapter, the date/print boundary at the edge, and purity and boundary rules hold.

**Notes / Clarifications**:

- **Fixture / mutant**: live tree; a mutant domain module importing `node:fs` is added to a temp dependency-cruiser probe only if the boundary fixture coverage requires it (the fixture-coverage meta-check fails an unfixtured rule).

#### TC-MEMGATE-004 - Aggregate gate and CI invariants wiring parity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, F-14, AC-F4-2, AC-NFR10-1, NFR-6, DM-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-lint-wiring.test.ts`, using the aggregate-string pin technique of `tests/checks/ci-wiring.test.ts` and the inventory pattern of `tests/structure/content-inventory.test.ts`
**Tags**: @bun, @structure, @ci, @memory

**Given / When / Then**: Given the delivered gate surfaces, when the aggregate local gate and the CI invariants job are inspected, then both resolve to the same `scripts/checks/memory-lint.ts` invocation, a parity test asserts both citations, and the command inventory, error-table rows, domain kinds, and doctor check set are unchanged.

**Preconditions**:

- Package scripts and `.github/workflows/ci.yml` are edited in the enforcement phase.
- The `check:memory` indirection is resolved before comparison: the aggregate cites the script, the CI job cites the path, so only the resolved invocation can be equal.

**Steps**:

1. Read `package.json`; assert `scripts.check` contains `pnpm check:memory`, and assert `scripts["check:memory"]` equals `bun run scripts/checks/memory-lint.ts`.
2. Read `.github/workflows/ci.yml`; assert the `ts-invariants` job's static-check step cites `bun run scripts/checks/memory-lint.ts` — the same path `check:memory` resolves to.
3. **Resolved-invocation parity, not string equality:** resolve `check:memory` through the manifest to its command (its path operand, `scripts/checks/memory-lint.ts`) and assert that resolved invocation equals the invocation the CI `ts-invariants` step runs. The raw strings are not compared, because the aggregate legitimately cites `pnpm check:memory` while CI cites the path (plan 4.3).
4. Assert `tests/structure/inventory.json` lists the new `packages/**` modules and the check's exported entry, so the inventory equality test stays green.
5. Assert the aggregate-string pins are updated in the three suites the plan declares for phase 4 (`tests/checks/ci-checks.test.ts`, `tests/checks/privacy-ci-wiring.test.ts`, `tests/checks/license-ci-binding.test.ts`), and that mutating either surface in a temp copy makes the parity assertion fail naming the surface. `tests/checks/ci-wiring.test.ts` is **not** edited: it passes unchanged, and this suite does not require its modification.
6. Assert no new doctor check, CLI command, error-table row, or domain kind appears (delegated to TC-MEMGUARD-002 for the full inventory).

**Expected Outcome**:

- One resolved invocation, two surfaces, parity proven; the aggregate cites the script, CI cites the path, and both resolve to the same check; mutation of either surface fails loudly.

**Notes / Clarifications**:

- **Fixture / mutant**: temp-copy mutation of `package.json`/`ci.yml` (the `boundary-ci-parity.test.ts` technique) proves the parity test is non-vacuous.

#### TC-MEMDATE-001 - Creation-date classification: absent, malformed, future

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, F-5, AC-F6-1, DM-1, DM-4 (seed SC-M2-S8-01)
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-dating.test.ts`
**Tags**: @bun, @check, @memory, @dating

**Given / When / Then**: Given a record with no `created` key, then it is exactly one `memory.schema.keys-missing` error naming the file and the key and **no** `memory.dating.*` finding, because an absent key is the schema area's classification (AC-F6-1, spec v1.1); given a record whose `created` is present but not `YYYY-MM-DD`, and a record whose `created` lies after the run's single injected date, then each is exactly one `memory.dating.*` error naming the file and the value's name — the dating area owns only the present value; the date is never inferred from a file name, a commit, or anything else.

**Preconditions**:

- One fixed "today" is injected into the evaluation (`2026-11-15`) so the future case is deterministic and no ambient clock is read.
- The dating suite imports the record baseline from the shared fixture; every case differs from the baseline in exactly one field.

**Steps**:

1. Mutant table — one unambiguous row per classification, matching AC-F6-1 as amended in spec v1.1:

   | # | Mutant | Expected finding(s) | Expected silence |
   |---|--------|---------------------|------------------|
   | 1 | `created` key absent | exactly one `memory.schema.keys-missing` naming the file and `created` | zero `memory.dating.*` findings for that record |
   | 2 | `created: "15/11/2026"` (present, wrong shape) | exactly one `memory.dating.created-malformed` naming the file and `created` | zero `memory.schema.keys-missing` — the key is present |
   | 3 | `created` = injected date + 1 day (`2026-11-16` at the pinned `2026-11-15`) | exactly one `memory.dating.created-future` naming the file and `created` | zero `created-malformed` (the shape is valid) |
   | 4 | `created: "2026-11-15"` (valid, equal to the injected date) | no finding | no dating and no schema finding for `created` |

2. Assert each row yields exactly one finding in its stated area and that no row produces findings in both `schema` and `dating` — the single-area rule is asserted, not left to whichever branch runs first.
3. Assert an empty `created: ""` is `memory.dating.created-malformed` (present but not a date), not `keys-missing` — the boundary between "absent" and "present but empty".
4. Assert a file named `lesson-2026-001-…md` with no `created` key does not infer `2026` from the file name: the finding remains `memory.schema.keys-missing` and no date is synthesized.
5. Run the same four rows twice with the same injected date and assert byte-identical output (determinism follows from the fixed input, TC-MEMNFR-001).

**Expected Outcome**:

- Absent → schema area, once; malformed and future → dating area, once each; valid and at-boundary dates silent; no inference path and no double classification.

**Notes / Clarifications**:

- **Superseded expectation, recorded deliberately:** v1.0 of this plan asserted `memory.dating.created-malformed` for the absent case and then hedged about `schema.keys-missing`. Spec v1.1 AC-F6-1 fixes the classification to `memory.schema.keys-missing`, and the ticket intent ("lint fails on a record missing a date") holds because the schema error still fails the check. The id is kept; the content is rewritten.
- The absent-`created` row is also the ticket's "missing date" artifact, asserted here and at the verdict level in TC-MEMGATE-001.
- **Fixture / mutant**: `mutants.ts` dating rows; the future row derives its value from the injected date (injected + 1 day) rather than a hardcoded year, so the case cannot age.

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

#### TC-MEMPROV-001 - Evidence and writer in provenance; `source` presence/channel in schema

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-7, AC-F2-2, AC-F7-1, DM-1, DM-4, NFR-9 (seed SC-M2-S8-01)
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-provenance.test.ts`
**Tags**: @bun, @check, @memory, @provenance

**Given / When / Then**: Given a record with a missing or empty evidence link, or a non-empty evidence value outside the five declared shapes, then each is exactly one `memory.provenance.*` error naming the file and never echoing a full evidence value; given a record missing its writer, then it is one `memory.provenance.created-by-missing` error; given a record with an absent `source`, then it is exactly one `memory.schema.keys-missing` naming `source`; given a `source` outside the four declared channels, then it is exactly one `memory.schema.value-unknown` naming `source`; and no record yields findings from both areas for one key.

**Preconditions**:

- The five evidence prefixes are imported from the capsule contract (single source).
- The presence partition is the spec v1.2 declaration: `source` is schema-owned (presence and channel vocabulary alike), `evidence` and `created_by` are provenance-owned, and the partition is exhaustive and disjoint, so one defect in one key yields exactly one finding.

**Steps**:

1. Mutant table — one unambiguous row per case, with the owning area fixed by the partition:

   | # | Mutant | Expected finding(s) | Expected silence |
   |---|--------|---------------------|------------------|
   | 1 | `evidence` key absent | exactly one `memory.provenance.evidence-missing` naming the file and `evidence` | zero `memory.schema.keys-missing` for `evidence`; no `schema` finding for that key |
   | 2 | `evidence: ""` | exactly one `memory.provenance.evidence-missing` | zero `evidence-shape-unknown` for that record |
   | 3 | `evidence: "we all agreed"` | exactly one `memory.provenance.evidence-shape-unknown` | zero `evidence-missing` for that record |
   | 4 | `created_by` absent | exactly one `memory.provenance.created-by-missing` naming the file and `created_by` | zero `memory.schema.keys-missing` for `created_by` |
   | 5 | `source` key absent | exactly one `memory.schema.keys-missing` naming the file and `source` | zero `memory.provenance.*` findings for that record |
   | 6 | `source: "slack"` (out of channel) | exactly one `memory.schema.value-unknown` naming the file and `source` | zero `memory.provenance.*` findings for that record |

2. For each row, assert the total finding count for that record is exactly one, in the stated area — the single-area rule is asserted, not left to whichever branch runs first.
3. Assert the finding text never contains the full evidence value or any recognizer-matched substring; only the field name is echoed.
4. Assert each of the five valid evidence shapes produces no finding; assert each of the four source channels produces no finding.

**Expected Outcome**:

- Provenance is enforced for `evidence` and `created_by` only; `source` presence and channel are classified by the schema area; no key is double-reported; findings are redaction-safe; valid shapes and channels pass.

**Notes / Clarifications**:

- Ticket artifact 1's "missing evidence → fail" is this table plus TC-MEMGATE-001.
- **Superseded expectation, recorded deliberately:** v1.0–v1.1 of this plan classified an out-of-channel `source` under `memory.provenance.*` and hedged ("as classified in the register"), which the closed register cannot satisfy. Spec v1.2 F-7/AC-F7-1/AC-F2-2 and Appendix A's presence partition own the classification: `source` is schema-owned both for presence and for channel vocabulary, while `evidence` and `created_by` are provenance-owned. The id is kept; the content is rewritten, and one row per case is asserted with no conditional branch.
- **Fixture / mutant**: `mutants.ts` provenance rows plus the two `source` rows; the valid-shape matrix is generated from the imported prefix constants.

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
4. **Link scope (review F-5, plan phase 8):** a record body citing `[agents](../../../AGENTS.md)` and `[spec](/doc/spec/features/feature-memory-lint.md)` produces no finding (both resolutions leave `.ai/memory/`), while an in-tree relative link to a missing sibling still produces exactly one `memory.reference.link-dangling`.

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

**Given / When / Then**: Given a memory-index row with an empty or over-long read-when hint, a duplicated row for one covered path, and a row whose path is not a covered path of the memory index (a topic file, a retro note, or an area directory), then each is exactly one `memory.index.*` error of the register's matching rule id; the target-row cases are `row-unbacked` because the path resolves to no covered path in the memory-index universe (U-1), while hint-shape defects are `hint-missing`/`row-malformed` (DM-3).

**Preconditions**:

- TC-MEMINDEX-001 passes.
- The row parser tolerates the delivered two-column table format.
- `HINT_MAX_CHARS` is imported from `packages/core/src/contracts/memory-record.ts`; the literal 120 never appears in the suite.

**Steps**:

1. Row with empty second column → `memory.index.hint-missing`.
2. Row with a hint of `HINT_MAX_CHARS + 1` characters (121 today) → `memory.index.row-malformed`, naming the measured value and the cap.
3. Two rows for one record → `memory.index.row-duplicate` for the second occurrence.
4. Row pointing at a topic file, a retro note, or `lessons/` → `memory.index.row-unbacked`, each naming the row's path and the universe `memory-index`. A retro note is a covered path of the **archive** index only (U-2), so a memory-index row for one is unbacked in U-1 rather than covered; the closed register has no separate wrong-target identity and this suite does not invent one.
5. Boundary: a hint of exactly `HINT_MAX_CHARS` characters (120 today) and a single row for a covered path produce no finding; a hint of `HINT_MAX_CHARS - 1` is silent as well.

**Expected Outcome**:

- Row-shape and target rules enforced with the imported bound and a boundary at 120; the hint-shape and target classifications stay separate and universe-scoped.

**Notes / Clarifications**:

- **Fixture / mutant**: row-builder helpers; the boundary matrix is generated from `HINT_MAX_CHARS` (imported minus one / at / plus one) so a bound change moves the fixtures with it.

#### TC-MEMINDEX-003 - Archive index covers notes exactly, over its own universe

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-9, F-1, AC-F9-2, DM-3, DEC-10, C-10
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-index.test.ts` (archive block)
**Tags**: @bun, @check, @memory, @retro

**Given / When / Then**: Given the archive index and the notes it represents, when the invariant runs, then every dated retro note has exactly one archive-index row and every archive-index row is backed by a note, reported under the same closed rule ids (`memory.index.record-uncovered`, `memory.index.row-unbacked`) with the universe `archive-index` in the detail; the memory index carries one row for `retro/INDEX.md` and no rows for individual notes, and the two universes are evaluated independently so neither evaluation blurs into the other.

**Preconditions**:

- The retro archive area and `retro/INDEX.md` exist (plan phase 1).
- Notes live under a year folder (`retro/<year>/…`).
- The evaluation exposes the universe (U-1 memory index, U-2 archive index) in every coverage finding's detail.

**Steps**:

1. Build a tree with two notes and two archive rows plus a memory-index row for `retro/INDEX.md`; assert zero findings.
2. Remove one archive row; assert exactly one `memory.index.record-uncovered` naming the note, with the universe **`archive-index`** in the detail — and assert no `memory.index.record-uncovered` is raised for that note under the memory-index universe (a note is not a U-1 covered path).
3. Add an archive row for a note that does not exist; assert exactly one `memory.index.row-unbacked` naming the row's path, with the universe **`archive-index`** in the detail.
4. Assert the memory index carries exactly one row for `retro/INDEX.md` and **no** row for either note; assert the notes therefore produce no U-1 finding of any kind.
5. Assert universe independence in the other direction: remove a record's memory-index row while the archive universe is clean; assert exactly one U-1 `record-uncovered` naming the record and zero `archive-index` findings.
6. Add a memory-index row pointing at a retro note; assert exactly one `row-unbacked` with the universe `memory-index` (the note is covered by U-2 only; TC-MEMINDEX-002 owns the row-shape half).
7. Assert the set of index rule ids emitted across the whole suite equals the register's five `memory.index.*` ids — no universe-scoped identity is invented (DM-4, C-10).

**Expected Outcome**:

- Archive coverage is exact in both directions and reported over its own universe with the same closed identity set; the two evaluations never blur, and the memory index keeps one row for the archive index rather than one per note.

**Notes / Clarifications**:

- **Superseded expectation, recorded deliberately:** v1.0 left the archive findings' rule ids unnamed and asserted a single coverage universe. Spec v1.1 DM-3/AC-F9-2 declare two universes evaluated independently with the universe in the detail; this rewrite names the identities and asserts the separation. The id is kept; the content is rewritten.
- **Fixture / mutant**: `archiveTree()` with the shapes above; the U-1/U-2 separation cases reuse `indexTree({ records, rows })`.

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
5. **Newline-terminated real file shape (review F-6, plan phase 8):** the `lineFiller(n)` fixtures are newline-terminated. Assert that a newline-terminated surface exactly at its cap measures the cap and is silent, while a raw `split("\n").length` would have reported cap+1 (non-vacuity), and cap+1 lines still fires naming the true measured value.

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

- The privacy vocabulary is imported, not duplicated: `PRIVACY_RULES` for the recognizer classes and `PRIVACY_SUPPRESSION_CLASSES` for the suppression markers.
- Every positive-case token is **assembled at runtime** by `tests/fixtures/memory/secrets.ts` from non-matching fragments (§6), so the committed source carries no contiguous secret-shaped value and the repository guard has nothing to match; no suppression marker is used in a positive case, because the memory lint would suppress it (DEC-4).
- No `scripts/checks/privacy-literals.registry.json` entry is needed for this route.

**Steps**:

1. Derive the expected class list from the privacy rules module (six secret classes plus the private-literal class = seven).
2. For each class, call the fixture builder to obtain the token, plant it in a record's text, and run the pure evaluation; assert exactly one `memory.secret.<class>` error naming path, line, and class.
3. Assert no finding's detail contains the assembled value (substring check against the token returned by the builder).
4. Assert the memory check module contains no local regex/pattern table for secrets: the set of emitted secret ids is derived from the vocabulary export.
5. Plant the same assembled class value in an entry point, an archive note, and a convention file; assert one finding each (the scan covers the whole tree, not only records).
6. **Guard-silence proof (non-vacuity of the technique):** read the fixture module's own source text and run the shared matcher (`matchGenericRules` from `packages/adapters/src/io/privacy-rules.ts`, the same matcher the repository guard uses) over it; assert zero matches. Then assert the *assembled* token does match, with exactly the expected rule id — so the silence comes from the fragment boundary and not from a broken recognizer.
7. **Suppression-boundary proof:** assert the assembled tokens contain none of the imported suppression markers (a data check over `PRIVACY_SUPPRESSION_CLASSES`), so a future marker-bearing fixture fails this assertion instead of silently becoming a negative case.
8. **Repository-level corroboration:** the full `scripts/checks/privacy-literals.ts` run in TC-MEMNFR-005 step 4 must stay at zero violations with **no** registry entry for `tests/fixtures/memory/**` (§6); a violation there means the assembly technique regressed, not that the registry needs widening.

**Expected Outcome**:

- Full-tree secret coverage, one vocabulary, one rule id per class, redaction-safe details.

**Notes / Clarifications**:

- Ticket security intent; DEC-4. The private-literal class is included because Appendix A names it.
- **Fixture / mutant**: `tests/fixtures/memory/secrets.ts` exports one runtime builder per class (see §6); the suppression-marker case is TC-MEMSECRET-002 and is a separate fixture shape, never the positive corpus.

#### TC-MEMSECRET-002 - Suppression classes and markerless control

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-12, AC-F12-2, DEC-4
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/memory-lint-secret.test.ts` (suppression block)
**Tags**: @bun, @check, @memory, @privacy

**Given / When / Then**: Given a committed documentation placeholder or a declared suppression marker inside a matched span, then no finding is produced; and given a markerless value of the same shape, then the finding is produced — the markerless value being a runtime-assembled token of that shape, so the case is observable rather than suppressed by the fixture's own text.

**Preconditions**:

- The three suppression classes are imported from the privacy vocabulary.
- The suppressed half is a **contiguous literal carrying a marker** (both guards suppress it, which is the point); the markerless half is a runtime-assembled token of the same shape (§6).

**Steps**:

1. For each suppression class (`documentation-placeholder`, `redaction-marker`, `fabricated-sample`), plant a marker-carrying contiguous span in a record's text; assert zero findings from the memory area, and assert the same span is suppressed by the shared vocabulary helper so the two guards agree by construction (DEC-4).
2. Remove the marker while keeping the same shape — using the runtime-assembled token builder for that class, so the fixture source still cannot match the repository guard — and assert exactly one finding of the matching secret class.
3. Assert the suppression decision is data-driven over the value segment a rule protects (via the injected `suppressionValueFor` seam and `suppressionClassFor`), not path-based and not whole-match-based: the same markerless value planted in a record, an entry point, and a convention file fires in all three.
4. Assert at least one case where the marker sits outside the matched span (a marker elsewhere in the same line) still produces the finding — suppression is span-scoped, not line- or file-scoped.
5. **Value-segment scoping (review F-4, plan phase 8):** a marker in the key half (`fake_token: <runtime-assembled value>`) does not suppress: the whole-tree guard reports an unsuppressed `secret.credential-assignment` and the memory lint emits exactly one `memory.secret.credential-assignment`. A marker inside the protected value segment (`token: fake_<value>`) still suppresses in both. The lint injects the guard's own `suppressionValueFor`, so the two cannot drift.

**Expected Outcome**:

- Documented examples do not fail the gate; the same shape without a marker does, and the two guards cannot disagree about which is which.

**Notes / Clarifications**:

- **Fixture / mutant**: paired suppressed/markerless fixtures per class.

#### TC-MEMCONC-001 - Parallel-branch record creation: zero conflicts on records and own entry points, union-resolved index pair, coverage after merge

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-13, F-1, F-9, AC-F13-1 (seed SC-M2-S8-02)
**Test Type(s)**: Integration (git)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/memory-concurrency-merge.test.ts` — temp git repository
**Tags**: @bun, @integration, @git, @memory

**Given / When / Then**: Given two distinct agents on parallel branches, each creating a record file in its own namespace, appending its own dated capture line to **its own** entry point, and appending its own row to the shared index table, when both branches merge, then the merge reports zero conflicts across the record files and across each creator's own entry-point namespace — no conflicted path exists outside `.ai/memory/README.md` — and the index-row pair, which conflicts by construction, resolves by the documented union rule so both rows are present exactly once; after that resolution the invariant reports each new record with zero findings and both records covered by exactly one row each.

**Preconditions**:

- `git` is available (already required by the lifecycle and by existing tests such as `boundary-ci-parity.test.ts`).
- A baseline temp repo is initialised from a minimal fixture tree with a committed index that already indexes both agents' entry points.
- The union resolution is a **scripted step inside this test** (keep both appended rows, order them deterministically, drop the conflict markers), mirroring TC-MEMCONC-002's applied-union state. This is the documented rule the tree publishes, not an ad-hoc test convenience.

**Steps** (concrete technique — fully automated):

1. Create a temp directory, `git init`, configure a local identity, and commit a base memory tree: `.ai/memory/README.md` with the two-column index table carrying one row each for `agents/agent-a/README.md` and `agents/agent-b/README.md`, those two entry points, and `lessons/.gitkeep` (an empty-but-proved record area with no index row).
2. Create branch `feat/agent-a`; agent A adds `lessons/lesson-2026-101-a.md`, appends one dated capture line (`- 2026-11-10: …`) to `agents/agent-a/README.md`, and appends its own index row to `.ai/memory/README.md`; commit.
3. From the base commit, create branch `feat/agent-b`; agent B adds `lessons/lesson-2026-102-b.md`, appends one dated capture line to `agents/agent-b/README.md`, and appends its own index row to `.ai/memory/README.md`; commit.
4. Check out the base, merge `feat/agent-a`; assert it exits 0 with no conflicted path.
5. Merge `feat/agent-b`; assert the **complete conflicted path set is exactly `[".ai/memory/README.md"]`** — that single assertion is AC-F13-1's scoped zero-conflict claim: no record file and no entry point of either creator is conflicted, because no branch edited a path the other owns. Assert the merge itself reports these paths rather than silently auto-merging a corrupted table.
6. Apply the scripted union resolution to `.ai/memory/README.md`: keep both appended rows (deterministic order by row path), remove the conflict markers, leave every pre-existing row untouched. Assert `git diff --name-only --diff-filter=U` is empty and `git status --porcelain` has no `UU`/`AA` entry afterwards.
7. Assert each branch's commit touched only its own record file, its own entry point, and the shared index — never the other creator's record file or entry point (`git show --name-only <commit>` per branch).
8. Run the pure evaluation over the merged, resolved tree; assert zero error findings, both new records covered by exactly one row each, exactly **two** new index rows (one per record), and no new row for either already-indexed entry point.
9. **Non-vacuity control:** replay the merge taking only one side's index (a "take ours" resolution) and assert the lint then reports exactly one `memory.index.record-uncovered` for the dropped branch's record — proving the union step, not luck, produces the covered state.
10. Assert the two appended capture lines produce no `memory.dating.entry-line-date` finding (the entry-point date shape holds across the merge).

**Expected Outcome**:

- Zero merge conflicts across record files and each creator's own entry-point namespace; the single shared-index conflict is the declared, expected surface and resolves by union to two present rows; post-merge coverage proves both records are represented (AC-F13-1, with the row half of AC-F13-2).

**Notes / Clarifications**:

- **Why the claim is scoped this way:** two branches appending different rows at end-of-file of the one two-column table conflict by construction — verified empirically in readiness iteration 1 — so a test that appended rows and asserted a zero-conflict merge would be unachievable. AC-F13-1 (spec v1.1) scopes the zero-conflict claim to record files and own entry-point namespaces and routes the row pair to AC-F13-2's union resolution; this scenario asserts exactly that boundary and nothing wider. The v1.0 justification ("record creation is conflict-free because each creator writes only new files") contradicted the steps and is deleted. The id is kept; the content is rewritten.
- **Automated vs manual, stated honestly:** the two-distinct-agent case above is automated, including the scripted union resolution. The **same-role parallel worktree** case is *not* automated: two worktrees of the same role may both edit one agent folder's entry point, and that union resolution is a human/scripted procedure. It is covered by a manual+scripted procedure recorded in Section 10 (create two worktrees, append one capture line each to the same entry point, merge, resolve by union, run the invariant), not by a permanent suite.
- The seed's `index.data.records` surface is reconciled to the lint's coverage result because this story ships no index command (Appendix B, DEC-10).
- **Fixture / mutant**: temp repo seeded with the baseline tree; helpers `commitRecord(branch, path, row)` and `unionResolveIndex(file)`. The test never reads the worktree's `.git` and never asserts a diff against a moving base (testing-strategy invariant rule).

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

- The merge aspect (two branches) is TC-MEMCONC-001, whose step 6 performs the same union resolution on a real conflicted file; here the union state is applied directly because the row is append-only text. This split is deliberate and stated.
- **Fixture / mutant**: two `candidateYaml` documents with distinct ids; a third run for idempotency.

#### TC-MEMGUARD-001 - Negative guard replaced: presence + narrowed sanction scan + preserved absences

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-14, AC-F14-1, DEC-12, NFR-10, NG-1, NG-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` (replacing the block at lines 258-287) and/or `tests/structure/memory-lint-wiring.test.ts`
**Tags**: @bun, @structure, @memory, @guard

**Given / When / Then**: Given the delivered structure suite, when the memory-tooling guard runs, then it carries all three declared parts: (a) it asserts the memory invariant exists (`scripts/checks/memory-lint.ts` plus its exported pure entry) and is cited by both gate surfaces; (b) it runs one narrowed file-name sanction scan over `scripts/`, `tools/`, and `packages/` whose permitted-match set equals the sanctioned memory module set — the check edge, the pure evaluator, and the schema contract module — so a stray `memory-doctor` or a second memory health surface fails, and the scan is proven non-vacuous and proven to fail on a planted unsanctioned module; and (c) it still asserts the preserved boundary absences: no memory subcommand on the CLI, the doctor check set unchanged at five with no memory member, and the error-table row set unchanged; the former absence-only assertion no longer exists in its old form.

**Preconditions**:

- The old guard's intent (no memory tooling) is replaced, not silently deleted.
- The doctor CLI command path and its five-check contract are known.
- The sanctioned module set is defined once in the suite as a constant of exactly three paths: `scripts/checks/memory-lint.ts` (the invariant's check), `packages/core/src/domain/memory-lint.ts` (the pure evaluator), and `packages/core/src/contracts/memory-record.ts` (the schema contract module — named in the set **although its file name does not match the scan pattern**).
- The scan pattern is the narrowed file-name pattern the delivered guard carries (the shape `memory[-_](doctor|lint)|memoryDoctor|memoryLint`, applied to paths under the three trees), not a blanket memory-word match.

**Steps**:

1. **Part (a) — presence:** assert `scripts/checks/memory-lint.ts` exists, exports a pure evaluation entry, and has a thin `import.meta.main` edge.
2. **Part (a) — citation:** assert both `package.json` `check` (through the resolved `check:memory` script) and `.github/workflows/ci.yml` `ts-invariants` cite the check path (shared with TC-MEMGATE-004).
3. **Part (b) — the narrowed sanction scan, as set equality:** walk `scripts/`, `tools/`, and `packages/` with the narrowed pattern **reusing the delivered walk's skip set (`node_modules`, `dist`, `.tests`)**, collect every matching file, add the schema contract module by its declared path, and assert the resulting permitted-match set **equals** the three-path sanctioned module set — no more (an unsanctioned memory-named module fails) and no fewer (a scan that stops reporting a sanctioned module fails). Assert the collected set contains no `dist/` path, so a built `packages/*/dist/**/memory-lint.js` artifact cannot join the match set and break the equality after `pnpm build`.
4. **Part (b) — non-vacuity:** assert the permitted-match set is non-empty, that the raw narrowed pattern matched at least the check edge and the pure evaluator **before** the declared schema-contract path was added, and that the declared path is the only non-pattern member — so a pattern typo that silently matches nothing cannot pass through the declared exception.
5. **Part (b) — planted-mutant proof (two cases, temp copy):** copy the three scanned trees to a temporary root; in case 1 add a second memory-named module (`packages/core/src/domain/memory-doctor.ts`); in case 2 add a stray `scripts/checks/memory-lint-extra.ts`. Run the same scan helper against each copy and assert it reports the planted offender and that the set-equality assertion fails; assert the unmutated copy passes. The mutant lives in the temp copy, never in the committed trees.
6. **Part (b) — sanctioned script value:** assert the manifest assertion is the sanctioned-value form: `check:memory` is the only script whose value names the check path, and no other script value names a memory-lint component (the phase-2 blanket absence cannot survive the aggregate citation).
7. **Part (c) — preserved absence 1:** scan the CLI command registry for any `memory` subcommand; assert none.
8. **Part (c) — preserved absence 2:** assert the doctor check set is exactly five (`repo`, `tracker`, `provider`, `state`, `ci`) and contains no memory member.
9. **Part (c) — preserved absence 3:** assert the error-table row set and domain-kind membership are unchanged (delegated in detail to TC-MEMGUARD-002).
10. Assert the old test no longer asserts "no memory-lint component exists anywhere" — replaced by the presence assertion and the sanctioned-set scan; a comment or test name records the sanctioned replacement.

**Expected Outcome**:

- The guard protects the boundary rather than the absence: the invariant exists and is cited; the narrowed scan's permitted-match set equals the sanctioned module set and is non-vacuous; a planted stray module turns the suite red; the absences it protected still hold.

**Notes / Clarifications**:

- Old guard location: `tests/structure/memory-bootstrap-templates.test.ts:258-287`; its comment names GH-301 as the owner of this replacement (pm-notes RISK). The delivered block keeps the narrowed pattern's shape so the sanction scan is a narrowing, not a rewrite of intent.
- **Fixture / mutant**: live files for the presence assertion, the sanctioned-set scan, and the three absences; temp-copy mutations for the two planted-module cases (a second memory-named module and a stray `memory-doctor`/`memory-lint-extra`) and a temp-copy doctor-module mutation that adds a sixth memory check, making the absence assertions fail and proving them non-vacuous.
- This scenario is the test-plan counterpart of spec DoD-15: presence, the narrowed sanction scan with its permitted-match equality and mutant, and the preserved absences. A delivery that implements presence plus absences and drops the scan fails step 3, exactly as AC-F14-1 requires.

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
6. Assert the new library modules are registered in `tests/structure/inventory.json` — `src/contracts/memory-record.ts` and `src/domain/memory-lint.ts` in the core list, `src/file/memory-scan.ts` in the adapters list — and that the inventory walk keeps its delivered skip set (`node_modules`, `dist`, `.tests`), so a built `packages/*/dist/**` copy is never counted as a second module. The inventory covers `packages/**` only: no CLI command, flag, or help entry is added to it, so its equality assertion is green for the additive module rows and unchanged for the command surface.

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

**Given / When / Then**: Given a fixed tree and one fixed injected date, when the finding output of two executions is compared, then it is byte-identical including order and truncation; the edge performed exactly one date read and injected it, the pure evaluation read no clock of its own, the run performed zero writes and opened no network connection; and given the same unchanged tree at a later injected date, then only findings derived from the injected date differ.

**Preconditions**:

- TC-MEMGATE-002/003 pass.
- The edge accepts the date reader as an injected port, so the read is countable; the pure evaluation accepts the resolved date value.

**Steps**:

1. Run the check twice over a temp tree that includes a truncation case **at the same injected date**; assert byte equality of the full stdout including the truncation line and the summary counts.
2. Diff the temp tree's file hashes before and after; assert no change.
3. **Exactly one injected date read:** pass a counting date reader to the edge and assert it is called exactly once per run, and that the value it returned is the value the pure evaluation used (a clock stub inside the evaluation throws if read, so a second read cannot hide).
4. **Later injected date:** re-run the same tree with an injected date one day later; assert the diff between the two outputs contains only findings derived from the date — `memory.dating.created-future` may appear or disappear, `memory.dating.revalidate-expired` may appear — and that every non-date finding keeps its path, line, rule id, and relative order.
5. Assert no network module import and no shell-out (`child_process`) in the evaluation or edge.

**Expected Outcome**:

- Byte-identical, state-free, offline, and deterministic at a fixed injected date; the injected date is the only input that can change output between two runs over an unchanged tree, and it enters through exactly one read at the edge.

**Notes / Clarifications**:

- **Superseded expectation, recorded deliberately:** v1.0 asserted "read no clock" unconditionally, which spec v1.1 NFR-1/AC-NFR1-1 correct the date-bearing boundary for: the edge performs exactly one date read and injects it, and determinism is claimed at a fixed injected date. The id is kept; the content is rewritten.

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
**Target Layer / Location**: `tests/structure/memory-lint-docs.test.ts` (delivery-boundary doc cases plus the post-landing presence/marker/registration/index case) + `bash scripts/.tests/test-doc-distribution.sh` + `bun run scripts/checks/forbidden-literals.ts`
**Tags**: @bun, @structure, @bash-guard, @docs

**Given / When / Then**: Two phases, one scenario. **Delivery boundary:** given the change's delivery-time documentation state, when the conformance guards ran at that boundary, then no delivery phase had added a user-facing `doc/**` doc: the forbidden-literal registry delivery produced carried no row introduced by it, every doc delivery touched under a marker-required root still carried a valid `ados_distribution` marker, and the distribution guard reported zero drift. **Post-landing:** given the state after the lifecycle-phase-7 `@doc-syncer` handoff landed `doc/spec/features/feature-memory-lint.md`, when the same guard suite re-runs, then the spec exists, carries exactly one `ados_distribution` value in the valid set, is listed in the registry's `registered` set, is linked from `doc/00-index.md`, and no registry `allowlist` entry matches `/memory/i`.

**Preconditions**:

- The delivery-touched docs are known: `doc/templates/memory-doctor-checklist-template.md` (rewritten automation-boundary sentence, marker retained) and its row in `doc/templates/README.md`; plus `doc/decisions/ADR-0011-canonical-memory-record-schema.md` (a decision record, which requires neither a marker nor a registry row).
- The forbidden-literal registry's scope classes and allowlist are understood, and delivery introduced no registry row (plan 6.4).
- The phase-7 handoff has landed: `doc/spec/features/feature-memory-lint.md` exists with `ados_distribution: internal`, holds a `registered` row in `scripts/checks/forbidden-literals.registry.json`, and is linked from `doc/00-index.md`. The delivery-boundary run that preceded it required no such file.

**Steps**:

1. Record the delivery boundary as the absence fact it was: the only new `doc/**` file delivery adds is `doc/decisions/ADR-0011-canonical-memory-record-schema.md`, and no delivery phase creates a user-facing doc. This is boundary history; the landed state asserted in steps 4-6 is the current truth.
2. Assert the doctor checklist and its `doc/templates/README.md` row state the automation boundary on current terms, that the checklist keeps exactly one `ados_distribution: redistributable` marker block, and that it names no area outside the closed set.
3. For each delivery-touched doc under a marker-required root, assert exactly one `ados_distribution` value in (`redistributable`, `internal`, `project-generated`); assert the decision record and the memory index are not treated as marker-required docs.
4. Post-landing presence: assert `doc/spec/features/feature-memory-lint.md` exists and its frontmatter carries exactly one `ados_distribution` in the valid set.
5. Post-landing registration: assert the `registered` set of `scripts/checks/forbidden-literals.registry.json` contains `doc/spec/features/feature-memory-lint.md`, and that no `allowlist` entry path matches `/memory/i`.
6. Post-landing index row: assert `doc/00-index.md` links `spec/features/feature-memory-lint.md`.
7. Run `bash scripts/.tests/test-doc-distribution.sh` and `bun run scripts/checks/forbidden-literals.ts`; assert zero drift and zero violations against the registry in its landed shape.
8. Assert no `.md` file gained a second frontmatter block or a license header for the marker.
9. Record in Section 10 that the delivery-boundary guard run and the post-landing guard run were both green, with the phase-7 handoff as the only difference between the two states.

**Expected Outcome**:

- Conformance guards green at the delivery boundary and again after the phase-7 handoff: delivery added no user-facing doc and left the registry and marker set unchanged, and the landed feature spec is present, marked, registered in the forbidden-literal registry, and linked from `doc/00-index.md`.

**Notes / Clarifications**:

- **Two-phase truth, stated so the boundary is honest:** `doc/spec/features/feature-memory-lint.md` was absent at the delivery boundary because no delivery phase creates a user-facing doc; the lifecycle-phase-7 `@doc-syncer` run then landed it (commit 4ca099e9), and `tests/structure/memory-lint-docs.test.ts` was updated to assert the post-landing state (commit dee10787). The suite therefore asserts presence, marker, registration, and index row — not absence — and the delivery-time absence survives as boundary history in step 1 rather than as a re-run assertion.
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
- **Committed fixtures:** `tests/fixtures/memory/tree.ts` (tree builders), `tests/fixtures/memory/mutants.ts` (one-defect records), `tests/fixtures/memory/bodies.ts` (derivable bodies), `tests/fixtures/memory/secrets.ts` (per-class token **builders**, assembled at call time — see the discipline below), and `tests/fixtures/memory/agents/` (entry-point fixtures). Fixtures are never named `*.test.ts` (bunfig discovery).
- **Secret-fixture discipline (why the positive cases are actually observable).** The memory lint reuses the delivered suppression classes (DEC-4), so any fixture that carries a suppression marker is suppressed by the memory area exactly as it is by the repository guard — a marker-carrying fixture can only ever prove the *negative* case. A markerless contiguous literal, in turn, is caught by `scripts/checks/privacy-literals.ts`, whose scan set is every tracked and untracked-not-ignored file (`git ls-files --cached --others --exclude-standard`): the only allowlisted directory is `tests/fixtures/privacy-literals`, and `tests/checks/fixture-privacy.test.ts` covers a different, fixed directory list. Neither route yields a positive case, so this plan assembles the tokens at runtime instead:
  1. `tests/fixtures/memory/secrets.ts` exports one builder per recognizer class that concatenates the value from fragments at call time — for example `["gh", "p", "_"].join("") + "a".repeat(20)` for the provider-token prefix, `"-----BEGIN " + "PRIVATE KEY" + "-----"` for the private-key block, or `"/ho" + "me/" + "quillbert"` for the absolute-user-path class.
  2. **Why the repository privacy guard stays silent:** it scans committed file *text*, and every recognizer's value character class (`[A-Za-z0-9_-]{16,}`, `[A-Za-z0-9._~+/=-]{16,}`, `[^\s:/@\"'<>}]+`, …) excludes the quote and newline characters a fragment boundary leaves behind, so no contiguous match exists in the source. The guard never evaluates the assembled value.
  3. **Why the memory lint still fires:** the tests pass the assembled string to the pure evaluation inside the injected text map, where it is contiguous, so the recognizer matches and the class is reported with path, line, and class.
  4. **Why no suppression class applies:** the assembled value segments contain no marker (`fake-`, `test_`, `sample-`, `example-`, `placeholder`, `apikey`, `redacted`, `your-`, …), so no suppression class silences the span. A fixture whose value needs a marker-shaped word would be redesigned as a negative case, never suppressed into silence.
  5. **AC-F12-2's counter-case uses the complementary technique:** its suppressed half is a *contiguous literal carrying a marker* (for example a `ghp_your…` placeholder), which both guards suppress by the same rule; its markerless control is a runtime-assembled token of the same shape. That is precisely the contrast AC-F12-2 requires.
  6. **Registry allowlist contingency, stated so it is not discovered at delivery:** if a future fixture must carry a contiguous markerless literal, the change must add `tests/fixtures/memory/secrets.ts` as a `file` allowlist entry scoped to the matched rule ids with a reason in `scripts/checks/privacy-literals.registry.json`, and that registry file must be declared in the owning plan phase's `scope.files`. No plan phase declares the registry today (phase 3 declares `tests/fixtures/memory/secrets.ts`), so this plan takes the runtime-assembly route, which needs neither a registry change nor extra phase scope.
- **Isolation:** each test module owns its temp roots and cleans up in `finally`/`afterEach`, following `tests/checks/error-table-sync.test.ts` and `tests/fixtures/capsule/promotion.ts`. The git merge test creates its own repo and never touches the worktree's `.git`.

**Boundary and test-data discipline (explicit obligations):**

| Boundary | Lower | At | Upper | Expected behaviour |
|---|---|---|---|---|
| Index lines / agent entry / guild entry / archive index | cap−1 | cap | cap+1 | cap−1 and cap silent; cap+1 one error |
| Index bytes | just under 25 KB | 25 KB | over 25 KB | under/at silent; over one error |
| Kernel memory section | ≤200 | 200 | 201–220 / 221 | ≤200 silent; 201–220 one advisory; 221 one error |
| Index hint length | `HINT_MAX_CHARS`−1 (119) | `HINT_MAX_CHARS` (120) | `HINT_MAX_CHARS`+1 (121) | 119/120 silent; 121 row-malformed |
| Statement length | `STATEMENT_MAX_CHARS`−1 (279) | `STATEMENT_MAX_CHARS` (280) | `STATEMENT_MAX_CHARS`+1 (281) | 279/280 silent; 281 schema error |
| Print ceiling | 100 errors / 100 advisories | exactly 100 | 101 | exactly 100 no truncation line; 101 truncation with true totals |
| Tree population | empty-but-proved (`.gitkeep`) | one record per area | growing | both empty and populated green; no fixed-count assertion |
| Evidence shapes | 4 invalid/empty forms | 5 valid prefixes | — | invalid forms error; all 5 valid forms silent |
| Trust vocabulary | — | T0, T5 edges | — | both endpoint values accepted; T6 rejected |
| Status | — | candidate, archived | — | all five accepted; a sixth value rejected |

**Published-bound discipline.** `STATEMENT_MAX_CHARS` (280) and `HINT_MAX_CHARS` (120) are imported from `packages/core/src/contracts/memory-record.ts` by every suite that touches them (TC-MEMSCHEMA-002, TC-MEMINDEX-002, TC-MEMWRITE-001, TC-MEMWRITE-002); no test file restates either number. The parenthesised values above are the current readings, shown for the reader, not literals in code — a deliberate bound change moves the fixtures with it (ADR-0011 D6, DM-5). The workspace budget caps (index lines/bytes, entry-point lines, archive-index lines, kernel band) are likewise imported, never restated (DM-5, TC-MEMBUDGET-001).

## 7. Automation Plan and Implementation Mapping

Test files are the intended homes and match `chg-GH-301-plan.yaml`'s phase scopes; each row names the phase that lands it where the ownership is not obvious. `Status` is relative to this change: the delivered suites are **Implemented**, and the predecessor guards are **Existing–Update**. Shared fixtures are **Implemented** once and reused.

| TC ID(s) | Test file | Execution command | Status |
|---|---|---|---|
| TC-MEMLAY-001, TC-MEMLAY-003 | `tests/structure/memory-layout.test.ts` | `bun test tests/structure/memory-layout.test.ts` | Implemented |
| TC-MEMLAY-002 | `tests/structure/memory-layout.test.ts` (step 1, placeholder/target structure, plan phase 1) + `tests/checks/memory-lint-index.test.ts` (steps 2-4, coverage evaluation, plan phase 3) | `bun test tests/structure/memory-layout.test.ts tests/checks/memory-lint-index.test.ts` | Implemented |
| TC-MEMLAY-004 | `tests/checks/memory-lint-output.test.ts` | `bun test tests/checks/memory-lint-output.test.ts` | Implemented |
| TC-MEMSCHEMA-001 | `tests/structure/memory-record-schema.test.ts` | `bun test tests/structure/memory-record-schema.test.ts` | Implemented |
| TC-MEMSCHEMA-002, TC-MEMSCHEMA-004 | `tests/checks/memory-lint-schema.test.ts` | `bun test tests/checks/memory-lint-schema.test.ts` | Implemented |
| TC-MEMSCHEMA-003 | `tests/structure/memory-record-schema.test.ts` (whole-tree block, plan phase 4 scope) | `bun test tests/structure/memory-record-schema.test.ts` | Implemented |
| TC-MEMWRITE-001, TC-MEMWRITE-002, TC-MEMWRITE-004 | `tests/behaviour/memory-promotion-schema.test.ts` | `bun test tests/behaviour/memory-promotion-schema.test.ts` | Implemented |
| TC-MEMWRITE-003 | `tests/structure/memory-record-schema.test.ts` (automated half) | `bun test tests/structure/memory-record-schema.test.ts` | Implemented (manual half recorded in §10) |
| TC-MEMGATE-001, TC-MEMGATE-002, TC-MEMGATE-003, TC-MEMNFR-001, TC-MEMNFR-003 | `tests/checks/memory-lint-output.test.ts` | `bun test tests/checks/memory-lint-output.test.ts` | Implemented |
| TC-MEMGATE-004 | `tests/structure/memory-lint-wiring.test.ts` | `bun test tests/structure/memory-lint-wiring.test.ts` | Implemented |
| Aggregate-string pins (supporting TC-MEMGATE-004) | `tests/checks/ci-checks.test.ts`, `tests/checks/privacy-ci-wiring.test.ts`, `tests/checks/license-ci-binding.test.ts` | `bun test tests/checks/ci-checks.test.ts tests/checks/privacy-ci-wiring.test.ts tests/checks/license-ci-binding.test.ts` | Existing–Update (declared in plan phase 4) |
| TC-MEMDATE-001, TC-MEMDATE-002 | `tests/checks/memory-lint-dating.test.ts` | `bun test tests/checks/memory-lint-dating.test.ts` | Implemented |
| TC-MEMPROV-001 | `tests/checks/memory-lint-provenance.test.ts` | `bun test tests/checks/memory-lint-provenance.test.ts` | Implemented |
| TC-MEMPROV-002 | `tests/structure/memory-record-schema.test.ts` (migration block) | `bun test tests/structure/memory-record-schema.test.ts` | Implemented (manual diff review recorded in §10) |
| TC-MEMREF-001, TC-MEMREF-002 | `tests/checks/memory-lint-reference.test.ts` | `bun test tests/checks/memory-lint-reference.test.ts` | Implemented |
| TC-MEMINDEX-001, TC-MEMINDEX-002, TC-MEMINDEX-003 | `tests/checks/memory-lint-index.test.ts` | `bun test tests/checks/memory-lint-index.test.ts` | Implemented |
| TC-MEMBUDGET-001, TC-MEMBUDGET-002 | `tests/checks/memory-lint-budget.test.ts` | `bun test tests/checks/memory-lint-budget.test.ts` | Implemented |
| TC-MEMHEUR-001, TC-MEMHEUR-002 | `tests/checks/memory-lint-derivable.test.ts` | `bun test tests/checks/memory-lint-derivable.test.ts` | Implemented |
| TC-MEMSECRET-001, TC-MEMSECRET-002 | `tests/checks/memory-lint-secret.test.ts` | `bun test tests/checks/memory-lint-secret.test.ts` | Implemented |
| TC-MEMCONC-001, TC-MEMCONC-002 | `tests/behaviour/memory-concurrency-merge.test.ts` | `bun test tests/behaviour/memory-concurrency-merge.test.ts` | Implemented |
| TC-MEMGUARD-001 | `tests/structure/memory-bootstrap-templates.test.ts` (replace block) and/or `tests/structure/memory-lint-wiring.test.ts` | `bun test tests/structure/memory-bootstrap-templates.test.ts tests/structure/memory-lint-wiring.test.ts` | Existing–Update |
| TC-MEMGUARD-002 | `tests/structure/memory-lint-wiring.test.ts` (plus existing error-table/event-inventory suites) | `bun test tests/structure/memory-lint-wiring.test.ts tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts` | Implemented + Existing–No Change |
| TC-MEMNFR-002 | `tests/checks/memory-lint-performance.test.ts` | `bun test tests/checks/memory-lint-performance.test.ts` | Implemented |
| TC-MEMNFR-004 | `tests/structure/memory-lint-docs.test.ts` + shell guards | `bun test tests/structure/memory-lint-docs.test.ts && bash scripts/.tests/test-doc-distribution.sh` | Implemented + Existing–No Change |
| TC-MEMNFR-005 | Repository root (no new file) | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Manual evidence recording |

**Shared implementation homes** (created by the delivery phases; not test files):

- `packages/core/src/contracts/memory-record.ts` — the schema authority: required/optional keys, closed vocabularies, id and file-name grammar, `STATEMENT_MAX_CHARS`, `HINT_MAX_CHARS`, budget constants, finding register. Data and types only (plan phase 1).
- `packages/core/src/domain/memory-lint.ts` — the pure evaluation (no I/O, no clock, no fs) (plan phases 2–3).
- `packages/adapters/src/file/memory-scan.ts` — the tree scanner: repository-relative enumeration, text reads, YAML-frontmatter parse (plan phase 4).
- `scripts/checks/memory-lint.ts` — the bun-run edge: scan → evaluate → print → exit; it calls the scanner adapter for every read and the frontmatter parse, owns the single ambient date read and the printing, and registers the check namespace (plan phase 4).
- `packages/core/src/domain/capsule-candidates.ts` — the promotion writer: `recordContent` renders the full spine (trust, basis), the `kind` mapping and the declared home area (`tacit_fragment` → `tacit/`), the read-when hint; `validateCandidate` tightens `source` to the four channels (plan phase 5).
- `packages/adapters/src/file/memory-promotion.ts` — the writer/reader home-area mapping mirrored on the read path; index-row append unchanged (plan phase 5).
- `package.json`, `.github/workflows/ci.yml`, `tests/structure/inventory.json` — wiring and inventory (plan phase 4).
- `.ai/memory/**`, `.ai/memory/README.md`, `AGENTS.md`, `.opencode/skills/consolidate-memory/SKILL.md`, `doc/templates/memory-doctor-checklist-template.md`, `doc/templates/README.md` — documentation reconciliation (phases 1, 4, 6); `doc/spec/features/feature-memory-lint.md` is created by the lifecycle-phase-7 `@doc-syncer` handoff (landed post-delivery, asserted by TC-MEMNFR-004's post-landing case), not by a delivery phase.
- `doc/planning/concepts/memory-architecture.md` — the `## Record model` frontmatter example and its immediate prose rewritten to the canonical schema (plan phase 6, declared in its scope): one validity start, a scalar `source` channel with the reference half carried by one shaped evidence link, no frontmatter `rationale`, a `T0`-`T5` trust token, a scalar applicability predicate, and no record `fleet`, so a record copied from the concept validates (F-2, DM-1, DEC-5, spec §7.1/§16/DoD-17). It is an existing scanned doc: no forbidden-literal registration change and no distribution marker (that root is outside the marker-required set). The adjacent `doc/planning/concepts/memory-practices.md` `## Bootstrapping a project (adoption checklist)` section is **not** touched by any phase and stays byte-identical, as DoD-17 requires; no test home is added for it because no phase edits it (verified by diff review at the phase boundary).

**Not a changed home (stated to prevent scope drift):** `packages/core/src/contracts/capsule.ts` is **read for parity only** (TC-MEMSCHEMA-001 imports `CAPSULE_CANDIDATE_TRUST` and the five evidence prefixes). The candidate `source` tightening is implemented in `packages/core/src/domain/capsule-candidates.ts` per the plan's phase 5 scope, and `tests/checks/ci-wiring.test.ts` passes unchanged — no TC requires editing it.

**Mocking requirements:** none beyond injection. The evaluation takes a file list, a text map, the privacy vocabulary, and a fixed date; the scanner takes a file-system port so TC-MEMNFR-002 can count reads. No network, no test doubles for external services.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | Mutation helpers drift from the real writer, so the gate passes a tree the writer cannot produce | One schema module is imported by both the evaluator and the writer; TC-MEMWRITE-001 runs the real writer end-to-end; parity mutation in TC-MEMSCHEMA-001 fails loudly on drift |
| TR-2 | Secret fixtures trip the live privacy guard — or are silently suppressed by it, making the positive cases vacuous | Tokens are assembled at runtime from non-matching fragments (§6) so the committed source is unmatchable while the injected text map matches; TC-MEMSECRET-001 step 6 proves the guard reports no violation for the fixture file and step 7 proves the assembled value carries no suppression marker, so a suppressed case fails the suite instead of passing quietly |
| TR-3 | The negative guard is deleted instead of replaced, losing the boundary assertions | TC-MEMGUARD-001 asserts both the presence and all three preserved absences; the old block's replacement is explicit in the diff review |
| TR-4 | Timing assertions flake on a shared CI runner | Assert the declared ceiling once on the runner; record measurements as evidence; do not encode a tight local number as a second contract |
| TR-5 | Budget boundary off-by-one (a file exactly at cap failing) | Explicit cap−1/cap/cap+1 matrix per surface, including bytes measured with `Buffer.byteLength` |
| TR-6 | The git merge test becomes a branch-diff assertion against a moving base | The test builds its own temp repo with a fixed base commit; it never reads `origin/main-tools...HEAD` (testing-strategy invariant rule) |
| TR-7 | The archive-index coverage test assumes generation that does not exist | The archive index is append-maintained in the change; the test asserts coverage of the delivered shape, not a generator |
| TR-8 | A promoted record fails the gate because capsule `source` was not tightened first | Write-path phase tightens `source` in the candidate contract (DEC-8) before the writer renders it; TC-MEMWRITE-004 proves the refusal path |

### 8.2 Assumptions

- The implementation plan (`chg-GH-301-plan.yaml`, 8 phases at revision 1.5) has confirmed the file names in Section 7 and declares the phase that owns each area; this test plan constrains but does not author the plan.
- `bun test` discovery over `tests/**` covers every new suite; fixtures stay outside `*.test.ts` naming (`bunfig.toml`).
- The privacy vocabulary is consumed as an injected structural type declared in `packages/core/src/contracts/memory-record.ts` (recognizer classes plus suppression markers), with `packages/adapters/src/io/privacy-rules.ts` supplying the data at the edge: `matrix-core-importer` forbids `packages/core/**` importing `packages/adapters/**`, so the suites assert the injected classes equal the adapter's recognizer classes at the edge rather than importing an adapter type into the domain (DEC-4, no second table).
- A fixed "today" can be injected into the evaluation and the edge performs exactly one ambient date read; the pure domain never reads a clock (NFR-1, AC-NFR1-1).
- The three delivered records' current statements/statuses can be pinned as constants for TC-MEMPROV-002; any future change that alters them is a supersession, not a test edit.
- `pnpm build` precedes lifecycle commands in this repository (pm-notes environment note); test runs do not require the CLI bin.
- The doctor's five-check set is a stable, discoverable constant by the time TC-MEMGUARD-001 runs.
- `tmp/tmpdir` exists before the gate runs; `mkdir -p` is part of the evidence procedure.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Proposed resolution |
|----|----------|-----------|-------|---------------------|
| OQ-TP-1 | Is the dedicated script named `check:memory` or `check:memory-lint`? | Resolved — no longer blocking | plan-writer (plan 4.3) | Plan 4.3 pins `"check:memory": "bun run scripts/checks/memory-lint.ts"` and inserts `pnpm check:memory` into the aggregate chain, so TC-MEMGATE-004 asserts that name, its resolved path, and the CI step's matching path; the parity is asserted on the resolved invocation, not on raw string equality |
| OQ-TP-2 | When `created` is absent, which area classifies it? | Resolved — no longer blocking | spec-writer (spec v1.1) | Closed by AC-F6-1: an absent `created` is exactly one `memory.schema.keys-missing` with no dating finding, because the closed dating register has no absent-date identity; dating owns present-but-malformed and future values. TC-MEMDATE-001 asserts the single classification without a conditional branch |
| OQ-TP-3 | Does the promotion writer's index-row dedup use exact-row equality or path equality? | No | plan-writer | The existing writer checks exact-row inclusion; TC-MEMCONC-002 asserts idempotency under the delivered rule and `row-duplicate` under an injected duplicate |
| OQ-TP-4 | Should the same-role parallel-worktree union resolution gain automation? | No | PM / future story | Not in this change: it is a human/scripted workflow, explicitly manual here. A future story may automate the merge exercise |
| OQ-TP-5 | Is the kernel memory section delimited by a stable heading anchor for budget measurement? | No | plan-writer | Measure between the memory section heading and the next top-level heading; pin the anchor in the plan phase; a missing anchor is a test failure, not a silent zero |

No open question blocks safe delivery; each has a proposed resolution and a single test owner.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Initial test plan from `chg-GH-301-spec.md`: 40 TCs across 14 families, full coverage of 30 ACs, the eight lint areas with failing-fixture mutation tests, both-direction index coverage, budget boundary matrix, output determinism/exit/order/truncation, conflict-free concurrency (automated git two-branch + honest manual same-role note), schema reconciliation, guard replacement, gate wiring, and documentation conformance |
| 1.1 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Readiness iteration-1 revision (findings 3, 5, 7, 15, 19) aligned to `chg-GH-301-spec.md` v1.1 and ADR-0011. 3 — TC-MEMCONC-001 rewritten: zero-conflict claim scoped to record files and each creator's own entry-point namespace, with the one conflicted path pinned to the shared index and a scripted union resolution (mirroring TC-MEMCONC-002) plus a take-ours non-vacuity control; the contradictory "each creator writes only new files" justification deleted. 5 — TC-MEMDATE-001 rewritten as one unambiguous row per classification: absent `created` → `memory.schema.keys-missing` only, malformed/future → dating ids; conditional text removed. 7 — §6 secret-fixture discipline rewritten around runtime-assembled tokens from non-matching fragments, with the guard-silence and no-marker proofs added to TC-MEMSECRET-001, span-scoped suppression and a markerless control in TC-MEMSECRET-002, TR-2 realigned, and the registry-allowlist contingency named with its phase-scope requirement. 15 — §7 drops `packages/core/src/contracts/capsule.ts` as a changed home (the tightening is `packages/core/src/domain/capsule-candidates.ts`), drops the `tests/checks/ci-wiring.test.ts` update row, and names the three aggregate-string pin suites the plan actually scopes; TC-MEMGATE-004 step 5 aligned. 19 — TC-MEMWRITE-003 names plan phase 6, and TC-MEMLAY-002/TC-MEMINDEX-002 pin the register identity (`row-unbacked` for a row resolving to no covered path; `row-malformed` reserved for hint shape). Spec-v1.1 propagation: 280/120 imported as `STATEMENT_MAX_CHARS`/`HINT_MAX_CHARS` in every bound-bearing suite, the `basis` conditional asserted (promotion always renders it; a hand-authored omission is silent), TC-MEMINDEX-003 asserts the two coverage universes with the universe in each detail, and TC-MEMGATE-002/TC-MEMGATE-003/TC-MEMNFR-001 fix the injected date, assert exactly one edge date read, and assert that a later injected date changes only date-derived findings. 40 TCs unchanged (no ids added, removed, or renamed); 30/30 ACs still covered; zero orphan TCs |
| 1.2 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Readiness iteration-2 revision (findings 4, 5, 6, 8, 9, 10 and the consequential parts of findings 1 and 2) aligned to `chg-GH-301-spec.md` v1.2. 4 — TC-MEMGUARD-001 rewritten into the three declared parts of AC-F14-1/DoD-15: presence and citation, the narrowed file-name sanction scan over `scripts/`/`tools/`/`packages/` asserted as **set equality** with the three-path sanctioned module set (check edge, pure evaluator, schema contract module declared by path because its name does not match the pattern), a non-vacuity assertion, two temp-copy planted-module mutants (a second memory-named module and a stray `memory-lint-extra`), the sanctioned script-value assertion, and the three preserved absences; §1.1 framing changed from "presence plus absences" to the three-part replacement. 5 — TC-MEMGATE-003 step 3 and §4/§7 restated as the plan's boundary: the scanner adapter (`packages/adapters/src/file/memory-scan.ts`) owns every file read and the YAML frontmatter parse, the check edge owns the single ambient date read and printing, contracts/domain perform no I/O; the false "edge owns every read" claim removed. 6 — TC-MEMGATE-004 step 3 asserts the **resolved** invocation (`scripts.check` contains `pnpm check:memory`; `scripts["check:memory"]` equals `bun run scripts/checks/memory-lint.ts`; the CI `ts-invariants` step cites that path) instead of raw string equality; OQ-TP-1 closed against plan 4.3. 8 — TC-MEMSCHEMA-001 step 4 asserts the capsule `source` overlap behaviourally (`validateCandidate` accepts exactly four channels and refuses a fifth through the existing capsule-invalid identity) and states the capsule contract is read for parity only, since it exposes `readonly source: string`. 9 — TC-MEMSCHEMA-003 moved to `tests/structure/memory-record-schema.test.ts` (plan phase 4 scope) in §7 and in the scenario's location/preconditions, removing the phase-2 file contradiction. 10 — TC-MEMNFR-004 asserts delivery-time state only (registry unchanged, no new user-facing doc, markers intact) and names `doc/spec/features/feature-memory-lint.md` as the lifecycle-phase-7 handoff verified by a post-landing guard run. 1 (consequential) — TC-MEMPROV-001 aligned to the v1.2 presence partition with one unambiguous row per case (absent `source` → `memory.schema.keys-missing`; out-of-channel `source` → `memory.schema.value-unknown`; `evidence`/`created_by` provenance-owned) and no hedging text. 2 (consequential) — TC-MEMWRITE-004 adds the `scope: fleet` refusal for `lesson` and `tacit` candidates at candidate-schema time through the existing capsule-invalid identity, with zero writes, the contract left unwidened, and the delivered class-level `fleet` rejection distinguished. 40 TC ids retained (no replacements; content rewrites only), 30/30 AC traceability, zero orphans; the coverage matrix gained the `source` partition on AC-F2-2/AC-F7-1 and the three-part guard on AC-F14-1 |
| 1.4 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Phase-7 landing reconciliation of TC-MEMNFR-004 only. The scenario previously asserted the delivery-time state alone and named `doc/spec/features/feature-memory-lint.md` as an unasserted lifecycle-phase-7 handoff; that spec has since landed in phase 7 (commit 4ca099e9) with `ados_distribution: internal`, a `registered` row in `scripts/checks/forbidden-literals.registry.json`, and a link from `doc/00-index.md`, and `tests/structure/memory-lint-docs.test.ts` was updated (commit dee10787) to assert the post-landing state. TC-MEMNFR-004 now states the two-phase truth: the delivery boundary is the absence (no delivery phase adds a user-facing `doc/**` doc; ADR-0011 is the only new doc; registry unchanged; markers intact; zero drift), and the landed post-phase-7 state is presence + marker + registration + index row, verified by a re-run guard suite. Steps were re-cut around that boundary (delivery-boundary record, delivery-touched markers, post-landing presence/registration/index, guards, single-marker-block check, dual-run Section 10 record) and the notes name both commits. Also reconciled the statements that carried the old absence form: §1.1 scope bullet, §1.2 known-gap bullet, §3.3 NFR-7 description, §5.1 index row, and the §7 shared-homes note. No TC added, renamed, or removed (40 retained), 30/30 AC traceability unchanged (AC-NFR7-1 still maps solely to TC-MEMNFR-004), zero orphans, no other TC, AC mapping, or count touched |
| 1.3 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Readiness iteration-3 revision (blocking findings 1 and 2, plus the non-blocking observations 3, 6 and 7 that are test-plan-local) aligned to `chg-GH-301-spec.md` v1.3. 1 — TC-MEMSCHEMA-001 step 4 is now structural/parity-only: it asserts `trust` = `CAPSULE_CANDIDATE_TRUST`, the five evidence prefixes, the status subset, and the **absence** of a capsule `source` vocabulary, with no `validateCandidate` exercise and no four-channel accept/refuse claim (that behaviour lands with `packages/core/src/domain/capsule-candidates.ts` in plan phase 5, while this scenario is owned by phase 1; the claim also exceeded AC-F2-1, which requires parity only where human and machine vocabularies overlap). TC-MEMWRITE-004 steps 1-2 already own the accept/refuse proof and are unchanged; step 5's reconciliation list gained the DM-6 projection-rule row the spec now names. The precondition and Expected Outcome state the read-only/reference-only relationship. 2 — TC-MEMGATE-002 dropped the counting-date-reader injection (it needs the phase-4 check edge while the scenario is owned by phase 3) and renumbers the live-tree determinism step; the proof is not lost: a clarification points at TC-MEMNFR-001 step 3, which owns the exactly-one-edge-read assertion in phase 4, and the domain-side throwing-clock half is retained in step 3. 3 — TC-MEMLAY-002 is split by phase home without changing its id: step 1 is the evaluator-free structural half in the phase-1 `tests/structure/memory-layout.test.ts`, steps 2-4 are the pure coverage evaluation in the phase-3 `tests/checks/memory-lint-index.test.ts`, and §7's row maps both. 6 — §7's shared homes gain `doc/planning/concepts/memory-architecture.md` (the `## Record model` rewrite, plan phase 6) with the untouched memory-practices bootstrapping checklist named, matching spec v1.3 §7.1/§16/DoD-17; TC-MEMGUARD-002 step 6 now describes the inventory as the `packages/**` module list with named rows and the delivered skip set, instead of claiming it registers check modules. 7 — TC-MEMGUARD-001 step 3 pins the delivered skip set (`node_modules`, `dist`, `.tests`) and asserts the scan set contains no `dist/` path, so a built artifact cannot break the sanctioned-set equality. Header cites spec v1.3; 40 TC ids retained (none added, renamed, or removed), 30/30 AC traceability, zero orphans; no closed finding reopened |
| 1.5 | 2026-11-15 | test-plan-writer (DeepSeek V4.1 Flash 1017) | Review-iteration-1 remediation alignment (plan revision 1.5 phase 8, F-1..F-10) at constant TC/AC counts: 40 TCs, 30 ACs, no id added, renamed, or removed, no verdict language changed. TC-MEMWRITE-001 gains the supersession writer → invariant round trip (status + `superseded_by` + zero findings, asserted in both `memory-promotion-schema.test.ts` and the legacy `closeout-capsule-supersession.test.ts`); TC-MEMWRITE-002 step 3 now states the derived class/scope read-when phrase (never a statement truncation) and adds the over-bound-statement case; TC-MEMWRITE-004 gains the `STATEMENT_MAX_CHARS + 1` refusal with zero writes and the at-bound clean promotion; TC-MEMBUDGET-001 gains the newline-terminated at-cap non-vacuity case; TC-MEMREF-001 gains the out-of-tree citation control; TC-MEMSECRET-002 gains key-half versus value-segment suppression agreement with the whole-tree guard; TC-MEMSCHEMA-002 gains the empty, whitespace-only, and non-string statement rows (sixteen cases); TC-MEMGATE-002 gains the mixed-tree printed order across severities. §3.1 records the strengthened cells without editing a verdict; §10 is replaced with the delivery-time execution record; §2/§8.2 cite the 8-phase plan revision 1.5 |

## 10. Test Execution Log

Executed at the phase-8 boundary (2026-11-15). One row per scenario; automated rows cite the suite and its phase-8 result, and the manual or semi-automated rows record exactly what was and was not re-executed so an unrecorded scenario is never implied. Targeted memory-scope run: 18 files, 194 pass / 0 fail. Mutation battery: `bun test tests/checks/capsule-mutants.test.ts` = 2 pass / 0 fail (44 named mutants, MUT-CAP-41 included). Full gate: `TMPDIR=<sibling-dir-outside-worktree> pnpm check` = 8668 pass / 4 skip / 0 fail, exit 0 (phase-7 baseline was 8653 pass, so phase 8 adds 15 passing assertions).

| TC ID | Run Date | Result | Evidence / Notes |
|-------|----------|--------|------------------|
| TC-MEMLAY-001 | 2026-11-15 | PASS | `bun test tests/structure/memory-layout.test.ts`: 3 pass / 0 fail. |
| TC-MEMLAY-002 | 2026-11-15 | PASS | `memory-layout.test.ts` (step 1) + `memory-lint-index.test.ts`: 18 pass / 0 fail. |
| TC-MEMLAY-003 | 2026-11-15 | PASS | Same structure suite; temp-copy invented-area mutant still fails as declared. |
| TC-MEMLAY-004 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-output.test.ts`: 19 pass / 0 fail. |
| TC-MEMSCHEMA-001 | 2026-11-15 | PASS | `bun test tests/structure/memory-record-schema.test.ts`: 9 pass / 0 fail. |
| TC-MEMSCHEMA-002 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-schema.test.ts`: 22 pass / 0 fail; the sixteen-row table now includes empty, whitespace-only, and non-string statement rows, each exactly one `memory.schema.keys-missing`. |
| TC-MEMSCHEMA-003 | 2026-11-15 | PASS | Live tree: `bun run scripts/checks/memory-lint.ts` = records=3 areas=8 errors=0 advisories=0, exit 0; whole-tree block green in `memory-record-schema.test.ts`. |
| TC-MEMSCHEMA-004 | 2026-11-15 | PASS | Register/severity block green in `memory-lint-schema.test.ts`; no register id added by phase 8. |
| TC-MEMWRITE-001 | 2026-11-15 | PASS | `bun test tests/behaviour/memory-promotion-schema.test.ts`: 15 pass / 0 fail, including the F-1 supersession writer → invariant round trip (target `status: superseded` + `superseded_by`, zero findings); the same round trip is green in `closeout-capsule-supersession.test.ts` (5 pass). |
| TC-MEMWRITE-002 | 2026-11-15 | PASS | Promotion suite: `applies_when` whole, statement fallback whole, and the derived class/scope phrase when either source exceeds the bound (not a prefix/slice of statement or applicability). |
| TC-MEMWRITE-003 | 2026-11-15 | PARTIAL | Automated rule-parity half PASS in `memory-record-schema.test.ts`. The manual consolidation pass was not re-executed in phase 8; the phase-6 curator reconciliation is recorded in `chg-GH-301-pm-notes.yaml` (plan id 6) and the lifecycle review owns the manual verdict. |
| TC-MEMWRITE-004 | 2026-11-15 | PASS | Promotion suite: source channels, `scope: fleet` refusals, and the F-3 statement bound — `STATEMENT_MAX_CHARS + 1` refused through `closeout.capsule-invalid` with zero writes, exactly `STATEMENT_MAX_CHARS` promotes and lints clean. |
| TC-MEMGATE-001 | 2026-11-15 | PASS | `memory-lint-output.test.ts`: 19 pass / 0 fail; error exit, advisory-only zero exit, summary counts. |
| TC-MEMGATE-002 | 2026-11-15 | PASS | Output suite: byte-identical repeated runs and the F-9 mixed-tree printed order (WARN derivable area 7 before FAIL secret area 8) with the two severity ceilings as separate budgets. |
| TC-MEMGATE-003 | 2026-11-15 | PASS | Output suite: read-only `git status` before/after, scanner/edge boundary assertions, and no ambient clock in the pure evaluation. |
| TC-MEMGATE-004 | 2026-11-15 | PASS | `bun test tests/structure/memory-lint-wiring.test.ts`: 7 pass / 0 fail; full `pnpm check` shows `check:memory` chained after `check:boundaries` and the CI `ts-invariants` job citing the same resolved path. |
| TC-MEMDATE-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-dating.test.ts`: 18 pass / 0 fail. |
| TC-MEMDATE-002 | 2026-11-15 | PASS | Dating suite: expired advisory, date-time capture token fires, and `- GH-301:`/`- T0-T5:` bullets are silent (F-7). |
| TC-MEMPROV-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-provenance.test.ts`: 8 pass / 0 fail. |
| TC-MEMPROV-002 | 2026-11-15 | PASS | Migration block green in `memory-record-schema.test.ts`; phase 8 changes no migrated record, so the phase-1 backfill verdict stands. |
| TC-MEMREF-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-reference.test.ts`: 8 pass / 0 fail, including the F-5 out-of-tree citation control and the in-tree missing link that still fires. |
| TC-MEMREF-002 | 2026-11-15 | PASS | Reference suite: symmetric pair and resolvable link silent; deleting the target makes the tree noisy. |
| TC-MEMINDEX-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-index.test.ts`: 18 pass / 0 fail. |
| TC-MEMINDEX-002 | 2026-11-15 | PASS | Index suite: row shape, duplicate rows, and wrong-target rows green. |
| TC-MEMINDEX-003 | 2026-11-15 | PASS | Index suite: archive universe U-2 coverage green with the universe named in each detail. |
| TC-MEMBUDGET-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-budget.test.ts`: 8 pass / 0 fail; F-6 newline-terminated at-cap case silent while a raw split reports cap+1, and cap+1 fires naming the true value. |
| TC-MEMBUDGET-002 | 2026-11-15 | PASS | Measured (trailing-newline aware): README 176 lines / 8831 bytes; agent entries 12-39 lines; guild entries none; archive index 8 lines; kernel memory section 16 lines. |
| TC-MEMHEUR-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-derivable.test.ts`: 7 pass / 0 fail. |
| TC-MEMHEUR-002 | 2026-11-15 | PASS | Derivable suite: negative control and non-gating exit green. |
| TC-MEMSECRET-001 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-secret.test.ts`: 19 pass / 0 fail; rule-id set equals the vocabulary classes. |
| TC-MEMSECRET-002 | 2026-11-15 | PASS | Secret suite: F-4 key-half marker does not suppress (guard and lint both report `credential-assignment`), value-segment marker suppresses, marker elsewhere on the line does not. |
| TC-MEMCONC-001 | 2026-11-15 | PASS | `bun test tests/behaviour/memory-concurrency-merge.test.ts`: 2 pass / 0 fail (automated two-branch merge); same-role worktree union resolution remains the documented manual+scripted procedure (F-13), not claimed automated. |
| TC-MEMCONC-002 | 2026-11-15 | PASS | Concurrency suite: two promotion writes, union-resolved rows, idempotent re-run. |
| TC-MEMGUARD-001 | 2026-11-15 | PASS | `bun test tests/structure/memory-bootstrap-templates.test.ts`: 18 pass / 0 fail; phase 8 does not edit the guard, and the MUT-CAP-41 anchor (`'$1"superseded"'`) survives and still kills the supersession suite in the mutation battery. |
| TC-MEMGUARD-002 | 2026-11-15 | PASS | `memory-lint-wiring.test.ts` 7 pass / 0 fail plus the error-table/inventory suites in the full gate. |
| TC-MEMNFR-001 | 2026-11-15 | PASS | Output suite: byte-identical repeated output, exactly one injected date read, and a later injected date changes only date-derived findings. |
| TC-MEMNFR-002 | 2026-11-15 | PASS | `bun test tests/checks/memory-lint-performance.test.ts`: 2 pass / 0 fail; full-check scan line: files=2001 elapsed=21.7 ms. |
| TC-MEMNFR-003 | 2026-11-15 | PASS | Output suite: 100/100 ceilings, 101 truncates, one truncation line with true totals, deterministic prefix. |
| TC-MEMNFR-004 | 2026-11-15 | PASS | `bun test tests/structure/memory-lint-docs.test.ts`: 6 pass / 0 fail; `bash scripts/.tests/test-doc-distribution.sh` exit 0 (93 in-scope docs, no drift); `forbidden-literals.ts` exit 0. |
| TC-MEMNFR-005 | 2026-11-15 | PASS | `TMPDIR=<sibling-dir-outside-worktree> pnpm check` exit 0: 8668 pass / 4 skip / 0 fail; memory-lint records=3 errors=0 advisories=0; boundaries, prompt/help conformance and exports parity green. |

**F-11 measured delta and TMPDIR constraint (D-5).** The full gate moved from 8653 pass at phase 7 to 8668 pass at phase 8 (+15 assertions, all new), with the same 4 skips and 0 failures. The literal `TMPDIR=$PWD/tmp/tmpdir` precondition of AC-NFR8-1 cannot be demonstrated in this nested-git workspace: `$PWD` lives inside the `jaiship` work tree, which is itself the top-level checkout, and fifteen pre-existing project/group suites require a directory outside every work tree. The battery therefore ran with `TMPDIR=<sibling-dir-outside-worktree>` — a sibling directory on the same filesystem and outside every git work tree — and that deviation is recorded here and in the phase-8 pm-notes evidence rather than inferred.
