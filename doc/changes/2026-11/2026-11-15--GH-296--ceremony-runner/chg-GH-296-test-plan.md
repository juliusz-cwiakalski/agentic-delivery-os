---
id: chg-GH-296-test-plan
status: Updated
created: 2026-11-15T23:40:00Z
last_updated: 2026-11-15T23:59:00Z
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, cli, ceremony, retro, tiering, measurement, state]
version_impact: minor
summary: "Traceable verification of M2-S3 ceremony runner: the declaration contract and its closed vocabularies/bounds including the declaration-held `scopeKey` derivation and the single schedule-trigger bound, the six built-in declarations proven parity-testable through one runner path, deterministic artifact-verified execution with per-step durability, compaction and resume, window and run-identity resolution for note-consuming, note-less scheduled and note-less event-triggered declarations, recorded trigger kind and resolution for explicit runs, bounded catch-up of a missed window, project-declared ceremonies through the same runner with no tooling change, the single plan-tier/pm-notes-variant mapping with escalation and findings, durable run/step records and one honest ceremony-share comparison, the four retro ceremony levels with a follow-through-first agenda and idempotent scope keys, and the two additive error identities with a two-way-synced table."
links:
  change_spec: ./chg-GH-296-spec.md
  implementation_plan: ./chg-GH-296-plan.yaml   # delivery.plan.v1, 11 phases; owns TC-001..060 (GAP-1, GAP-7)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S3: Ceremony runner (M2)

## 1. Scope and Objectives

This change turns six recurring rituals from prose-and-judgement into declared, deterministic, artifact-verified units executed by one runner. The test plan exists to protect five load-bearing properties, each tested independently so weakening one cannot hide behind another.

**First, a ceremony must be data, and the data must be total and closed.** A declaration names only declared step kinds, inputs, output slots, verification modes, trigger events, cadences, catch-up modes, tiers and assess verdicts; it cannot carry a command, a path, a model reference, or a free-form instruction. Every invalid name, duplicate id, built-in collision, unparseable schedule, over-bound collection, and missing verification is refused by *one* validator used by built-ins and projects alike (`ceremony.declaration.invalid`, exit 1, nothing registered) — this is both the contract and the security control (AC-F2-1..3, RSK-2, §21).

**Second, parity must be a property, not a claim.** All six built-ins execute through the same entry point, dispatcher, artifact reader, verifier, and record writer. One parametric suite iterates the six declarations; a per-built-in negative case makes a green parity run non-vacuous; a mutation that adds a per-ceremony branch must fail (AC-F3-1, Appendix E).

**Third, completion must be evidenced by an artifact, never by an outcome.** A step is `verified` only after its slot is read back and validated against the declared verification mode. A failed read-back stops the agenda and leaves the run `unverified` at exit 1 with its records and produced artifact durable; resume starts at the first unverified index and never re-executes a verified step; a contradicted record sequence refuses `state.store.torn` at exit 2 and guesses no repair; carried state compacts at declared boundaries within 4 096 bytes and 40 lines with an explicit omission count (AC-F4-1..5, NFR-3, NFR-4, NFR-7).

**Fourth, the arithmetic of "what happened" must stay honest, and it must be arithmetic over two resolved values.** The run identity `(ceremony, scopeKey, window)` is only meaningful when *both* halves are declaration-resolved before any read: the scope key from the declaration's closed derivation (`literal`, `repository`, or `note` — never implied, never left to the ceremony), and the window from the note, from `--window`, or from the single declared cadence of a note-less declaration. That is what makes a note-less ceremony idempotent (the second brief in one UTC day is the recorded verdict) and what refuses a note-less event-triggered run whose window does not exist rather than inventing one (AC-F2-4, AC-F4-6..8, DEC-16, DEC-18). On top of that, every run records exactly one trigger kind and one resolution, so a manual invocation is recorded as `explicit` and can never be read as a scheduled or event obligation (AC-F3-8, DEC-17); catch-up replays at most one missed window, distinguishes `nothing-missed` from a declared gap, and never fabricates a window; a re-run returns `data.reused: true` with zero appends while a new window appends an addendum and never rewrites a note body; the tier engine consumes exactly the delivered plan `tier` and the delivered pm-notes `variant`, reports disagreement and unevaluated triggers as findings instead of resolving them silently, and records escalations with their evidence; the ceremony-share comparison is produced from committed data with the committed definition, and below five post-boundary changes it states `insufficient-sample` with no trend claim anywhere (AC-F4-6..8, AC-F5-1..3, AC-F7-1..5, AC-F8-1..3, RSK-4, DEC-13, DEC-14).

**Fifth, the delivered contracts must stay byte-intact.** Five-key `delivery.result.v1` envelope, exits in `{0, 1, 2}`, `data` XOR `error`, new fields under `data` only; the two new error rows synced in both directions with the reserved two-segment allowlist and the 136 → 138 count; the retro pipeline and closeout unchanged and read-only; no metrics surface, no action registry, no event topic, no MCP tool, no model call in any ceremony path (AC-F1-3, AC-NFR2-1, AC-NFR8-1, §8.5, NG-1..NG-8).

This plan is a design and verification map, not an execution claim: no suite was run while authoring it.

### 1.1 In Scope

- `ceremony` family mount: prompt-required entry, production composition, root and family/verb help, M2 reference page, coverage-inventory row, prompt-set count 20 → 21, and the mounted-grammar discipline of exactly `list`, `run`, `resume`, `catch-up` (AC-F1-1, DEC-10, C-6, DoD-1).
- Family outcome continuity: one envelope per invocation, exit projection `{0,1,2}`, grammar refusals through `fallback.invocation`, undeclared ceremony name through `input.value.rejected`, and `--apply` accepted-and-inert where the declaration has no `sync` step (AC-F1-2..4, NFR-1, C-1, C-2).
- `ceremony list` content and cost: id, origin, tier applicability, declared trigger, declared catch-up mode, last-run summary; ≤2 verified state reads and 1 bounded declaration read; bounded deterministic human render (F-1, NFR-11, §10).
- Declaration contract `delivery.ceremony.declarations.v1`: member set, closed vocabularies, non-executable property, every bound (16 ceremonies/document, 12 phases, 32 steps, 16 inputs, 8 targets, 1 MiB, id grammar ≤64, uniqueness, 1..8 triggers with at most one `schedule` trigger per declaration), and the required `scopeKey` with its closed derivation set (`literal`, `repository`, `note`) — a `note` derivation legal only where the declaration requires a note — validated by one validator (F-2, DM-1, DM-2, AC-F2-1..4, E-19).
- Six built-in declarations (`morning-brief`, `retro-evidence-pass`, `sprint-rollover`, `night-watch`, `testing-session-assessment`, `decision-record-mirror-sync`) shipped as data, each carrying its declared `scopeKey` (four `repository`, two `note`), and proven parity-testable with one negative case each (F-3, AC-F3-1..8, DoD-3).
- Deterministic execution: declared-order agenda, per-step slot write/read-back/verify, per-step durable record through the fenced append, run status as a fold, run verdict `verified` | `dry-run` | `unverified` (F-4, DM-3..DM-6, AC-F4-1..5, AC-F8-1).
- Compaction at declared boundaries (4 096 bytes / 40 lines, explicit omitted count) and resume from the first unverified index with the torn-record refusal (AC-F4-2..4, NFR-4, NFR-7).
- Idempotency on `(ceremony, scopeKey, window)` for *every* declaration: the scope key from the declaration's derivation and the window from the note, `--window`, or the single declared cadence; `data.reused: true`, zero appends, no duplicate note body; new window → one new run plus an addendum; note-less scheduled double invocation in one UTC day → one run; note-less event-triggered run without `--window` → refused before any write (AC-F4-6..8, AC-F2-4, AC-F9-4, NFR-5, E-4, E-18, DEC-16, DEC-18).
- Recorded triggers: exactly one recorded kind (`schedule`, `event`, `catch-up`, `explicit`) plus one resolution (`note`, `declaration`, `unspecified`) per run; explicit runs record `explicit` and are never counted as the fulfilment of a scheduled or event obligation; a note naming an undeclared trigger is refused; the retro declaration declares exactly its four sub-R1 triggers and no `change-merged`, and produces no R1 output (F-2 declared-versus-recorded rule, F-9, DM-3, AC-F3-8, E-20, DEC-17).
- Catch-up: pure schedule evaluation over declaration + injected clock + recorded runs; ≤1 missed window per ceremony per invocation; `trigger.kind: "catch-up"` with bounds; `nothing-missed`; `mode: none` declared gap; event-triggered no invented window; removed declaration → declared gap with history readable (F-5, AC-F5-1..3, NFR-6, E-14, E-15).
- Project declarations: one committed `<configDirectoryName>/ceremonies.yaml`, bounded read, same contract and runner with zero tooling change, unparseable document refused as `config.file.malformed`, empty document ≡ absent, built-in collision refused with the built-in still effective (F-6, AC-F6-1..3, E-10, E-11, DEC-6, DEC-15).
- Tier engine: the single mapping from plan `tier` + pm-notes `variant` to the pinned per-variant phase sets, `tier.phases` canonical-subset restriction with `unresolved-phase` findings, the closed five-trigger escalation vocabulary with evidence, `tier-mismatch` / `unevaluated-trigger` findings, and tiered intake obligation (F-7, DM-7, AC-F7-1..5, AC-NFR9-1, DEC-2, DEC-13, Appendix D).
- Measurement: run record, step record, derived status/durations, no mutable run document, and one committed `comparisons[]` record with the committed `MET-CEREMONY-SHARE` identity, before value, after sample, `sampleMinimum: 5`, closed verdict set, native basis, and disclosure; `insufficient-sample` below the minimum (F-8, DM-8, AC-F8-1..3, NFR-10, DEC-1, DEC-8, DEC-14).
- Retro ceremonies at `session`, `incident`, `window`, `project`: declared triggers (exactly the four sub-R1 level triggers, no `change-merged`), explicit-run trigger resolution from the note, follow-through-first agenda position, fixed note schema on write and read-back, idempotent scope key, per-level outputs, addendum-not-rewrite, null-retro success, and read-only consumption of the delivered retro pipeline; `change`/R1 stays closeout's (F-9, DM-2, AC-F9-1..6, AC-F3-3, AC-F3-8, DEC-3, DEC-4, DEC-7, DEC-17).
- Error identities and binding: `ceremony.note-invalid`, `ceremony.declaration.invalid`, the `ceremony` domain kind, one reserved two-segment allowlist entry (52 → 53), documented count 136 → 138, and two-way machine/documented sync with zero reworded delivered rows (DM-9, AC-NFR8-1, NFR-8, C-7).
- Structural and NFR properties: no inference client / model identifier / network module / ambient clock-random-environment read in fold, render, verification or tier paths with a failing mutation; exactly two phase-set sources and no hardcoded default; mirror-sync target bound and no force path; determinism, bounds, read/run cost, duration budgets, and hermetic posture (AC-NFR2-1, AC-NFR9-1, AC-NFR12-1, NFR-2, NFR-7, NFR-11, NFR-13, Appendix E).
- Backward compatibility: delivered families, retro pipeline, closeout, plan/pm-notes contracts, and measurement values unchanged; no metrics surface, action registry, pack, scheduler, event topic, or MCP tool delivered (AC-NFR14-1 regression half, §8.5, DoD-13).
- Gate and hygiene evidence for the delivering change: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green, conventional commits scoped `GH-296` with ≤100-character body/footer lines, PR targeting `main-tools` and left open (AC-NFR14-1, NFR-14, C-9).

### 1.2 Out of Scope & Known Gaps

- [OUT] The `ados metrics` surface, ceremony-share presentation, alarms, thresholds, aggregation, and burn-rate reporting (NG-1, M2-S6). This change's comparison record is data, and no test asserts a reporting surface.
- [OUT] The retro action registry: the five-field contract, filing, artifact/outcome closure, aging, escalation, rollback, and board surface (NG-2, M2-S10). Tests assert a handoff section and assert that **no** action row is claimed.
- [OUT] Custom ceremony packs, pack registries, signing, and upgrade semantics (NG-3).
- [OUT] Continuous schedule driving: daemon, cron/systemd, timers, unattended cadence, sleeping, self-scheduling, or process spawning (NG-4, NFR-11). The runner evaluates a pure schedule function only.
- [OUT] Any retro-pipeline change: no new verb, no `--level` grammar change, no new collector, no new evidence kind, no level-registry status change, no truth-check or chain change (NG-5, DEC-4). Asserted as a non-regression, not re-tested as new behaviour.
- [OUT] Any closeout change, including R1 and the session-compaction checkpoint (§7.2, §8.5).
- [OUT] New event topics/kinds, an MCP tool/resource/prompt, and `board`/`status`/`brief` ceremony render surfaces (NG-6, NG-7, §7.2).
- [OUT] Memory-schema or memory-lint changes; the retro note writes through the delivered archive convention and index regeneration (NG-8 partial, §7.2).
- [OUT] Cross-repository ceremony coordination; ceremonies are per-repository in this change (§7.2).
- [OUT] Any LLM/model/agent invocation inside a step; no step kind exists for one (NG-8). Asserted structurally, not behaviourally.
- [GAP-1 — implementation-plan mapping — SATISFIED for TC-001..060, plan-side entry PENDING for 061..064] `chg-GH-296-plan.yaml` (delivery.plan.v1, 11 phases) carries a TC → PHASE map that owns `TC-CEREMONY-001..060` exactly once each without reshaping any TC's oracle, identity, exit, bound, or AC/NFR mapping, and the three non-blocking OQs are resolved in its header. The four TCs added in v1.1 (`TC-CEREMONY-061..064`) are owned per §7.1 of this plan using the plan's existing phase boundaries; recording them in the plan's map is a `delivery_planning` correction (GAP-7). Any later plan that changes a pinned contract reopens this test plan.
- [GAP-7 — plan-side TC → PHASE entry for TC-061..064 — PENDING] The plan's map states "60 ids = TC-CEREMONY-001..060". This plan's §7.1 states the ownership of all 64 TCs on the plan's existing phase boundaries (061 → Phase 1; 062, 063, 064 → Phase 3). The plan must add those four ids to its map and update its phase summaries' count/summary lines in the same `delivery_planning` correction; until it does, the plan under-declares four ids it already gates.
- [GAP-2 — delivery-bound, non-blocking: exact closed-vocabulary member strings not spec-pinned] The spec fixes the vocabulary *sets* but not every literal (e.g. the closed carry-over reason set, the assess-item reason strings, the escalation finding sub-codes beyond the three named). Tests assert obligations through declared contract constants asserted once in `tests/structure/ceremony-contract.test.ts`; exact literals are pinned with the contract suite and goldens at delivery (mirrors the GH-291 GAP-4/5/6 discipline).
- [GAP-3 — delivery-bound, non-blocking: NFR-13 budgets are runner-dependent] The `≤30 s` / `≤60 s` / `≤10 s` / `≤60 s` thresholds depend on runner capacity. CI asserts **bounded work** (one declaration read, one verified read per append, one fold, no retries/pagination/child process/network) plus a soft local budget; a generated-fixture reference measurement is recorded in §10 and never reported as a passing threshold.
- [GAP-4 — delivery-bound, non-blocking: mirror sync needs temp-git fixtures] `artifact-equals-source` and the clean/declared-base preconditions are proven over isolated temp git repositories (the `tests/fixtures/closeout/temp-git.ts` precedent), never the live tree. The commit-primitive landing path is composed, not re-tested.
- [GAP-5 — evidence-only AC: AC-NFR14-1] "`pnpm check` green before the PR opens", "PR targets `main-tools`", and "PR stays open" are process/PR-state facts, not code behaviour. They are verified by the phase-9 gate log plus PR metadata (semi-automated/manual evidence), not by a permanent suite. See §3.4.
- [GAP-6 — delivery-bound, non-blocking: OQ-2 aggregate figures] If plan authoring adopts the proposed per-ceremony count/mean/p90 inside `nativeBasis`, TC-CEREMONY-041's disclosure assertions extend; the mandatory DM-8 members are already pinned.

## 2. References

- **Change specification**: [chg-GH-296-spec.md](./chg-GH-296-spec.md) — v1.1: 9 capabilities (F-1..F-9), 9 data-model elements (DM-1..DM-9), 14 NFRs, 49 Given/When/Then acceptance criteria (§17: AC-F1-1..4, AC-F2-1..4, AC-F3-1..8, AC-F4-1..8, AC-F5-1..3, AC-F6-1..3, AC-F7-1..5, AC-F8-1..3, AC-F9-1..6, AC-NFR2-1, AC-NFR8-1, AC-NFR9-1, AC-NFR12-1, AC-NFR14-1), edge cases E-1..E-20, Appendix A ticket mapping, Appendix B constraint register C-1..C-10, Appendix C documentation deltas, Appendix D single-source tier mapping, Appendix E testability notes, DEC-1..DEC-18, RSK-1..RSK-12, OQ-1..OQ-3.
- **PM record**: [chg-GH-296-pm-notes.yaml](./chg-GH-296-pm-notes.yaml) — milestone `M2: Ceremonies, measurement, and memory`, `variant: full`, story `M2-S3`, and the two recorded scope decisions (ceremony-share measurement scoped to run records + one committed comparison with `ados metrics` out of scope; tier engine consumes the delivered plan `tier` and pm-notes `variant` with one mapping). Clarify phase confirmed the three ticket dependencies are delivered.
- **Implementation plan**: [chg-GH-296-plan.yaml](./chg-GH-296-plan.yaml) — delivery.plan.v1, 11 phases, tier `{name: full}`, and the TC → PHASE map that owns `TC-CEREMONY-001..060` exactly once each; the four v1.1 TCs (061..064) are owned per §7.1 pending the plan's map update (GAP-1, GAP-7).
- **Inherited scenario seeds (adopted by ID, not restated)**: [M2 test-scenarios.md](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) §M2-S3 — `SC-M2-S3-01` (conforming note produces each agenda step's declared output and an artifact-verified follow-through section; exit 0) is adopted as TC-CEREMONY-048; `SC-M2-S3-02` (note missing its scope key is refused naming `scopeKey`; exit 1; `error.code == "ceremony.note-invalid"`) is adopted as TC-CEREMONY-047. Both carry their verbatim assertions.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, `bun:test`, permanent-suite invariant rules, the fixture-coverage meta-check discipline, the aggregate `pnpm check` gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring.
- **Repository conventions**: [AGENTS.md](../../../../AGENTS.md) — change artifacts, test layout `tests/**/*.test.ts` under `tests/<layer>/`, fixtures never named `*.test.ts`, quality-gate battery, license-header rules (change artifacts carry none).
- **Current-truth specs this change composes** (consumed, never duplicated):
  - [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — the five-field `delivery.result.v1` envelope, `{0,1,2}` exit projection, `data` XOR `error`, `ERROR_TABLE` / `DOMAIN_KINDS`, the reserved two-segment allowlist (`RESERVED_TWO_SEGMENT_CODES`), and the two-way sync check.
  - [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — artifact boundaries, fenced appends with post-append re-read, classified damage (`state.store.torn`, `state.store.unknown`, `state.permission.denied`), verified-empty, store-managed artifacts and retention.
  - [feature-retro-pipeline.md](../../../spec/features/feature-retro-pipeline.md) — verified evidence sidecar, `retro.level` / `retro.run` / `retro.trigger` kinds, the four `retro.*` identities, `retro.truth.vacuous-run`, level registry status (R2–R5 declared, owning M2-S3), and the memory-audit trigger the runner now consumes.
  - [feature-plan-schema.md](../../../spec/features/feature-plan-schema.md) — required inert `tier` declaration, `PLAN_KNOWN_TIERS = [full, lite]`, `plan.tier.unknown` (unchanged).
  - [feature-pm-notes-lint-and-phase-transitions.md](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md) — `variant` (absent → `full`) and `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` (the eleven-phase `full` set, the pinned six-phase `lite` set), and `verify change` as the consumer of recorded variant truth.
  - [feature-brief.md](../../../spec/features/feature-brief.md) — the `delivery.brief.v1` render contract, ten surfaces, three anchor groups, closed placeholder catalog, degradation-as-data precedent.
  - [feature-closeout.md](../../../spec/features/feature-closeout.md) — the mechanical-ceremony precedent: declared plan, artifact-verified steps, idempotent re-run, dry-run default, bounded report, compaction checkpoint.
  - [feature-cli-entrypoint.md](../../../spec/features/feature-cli-entrypoint.md) — prompt-required composition, family/verb help, the help/guide coverage matrix, and the rule that a family is reachable only when prompt-required, composed, helped, and documented.
- **Planning truth**: [cli-command-registry.md](../../../planning/oss-tooling/cli-command-registry.md) (`ados ceremony` row, ceremony-script strangler), [measurement-baseline.yaml](../../../planning/oss-tooling/measurement-baseline.yaml) plus [feature-measurement-baseline.md](../../../spec/features/feature-measurement-baseline.md) (`MET-CEREMONY-SHARE`, formula, window, status, immutability, comparison protocol), [retrospectives.md](../../../planning/concepts/retrospectives.md) (levels, triggers, follow-through-first process, fixed note schema, scope-key idempotency, null retro, vanity-metric warning), [m2/contracts.md](../../../planning/oss-tooling/milestones/m2/contracts.md).
- **Closest delivered precedents to extend, not replace**: [chg-GH-240-test-plan.md](../2026-11-07--GH-240--capsule-closeout/chg-GH-240-test-plan.md) (mechanical ceremony: dry-run, idempotency, artifact-verified steps, convergence), [chg-GH-226-test-plan.md](../2026-11-05--GH-226--machine-readable-plan-schema/chg-GH-226-test-plan.md) (tier declaration echo and refusal corpus), [chg-GH-232-test-plan.md](../2026-11-06--GH-232--oss-retro-pipeline/chg-GH-232-test-plan.md) (retro registry, sidecar, level registry), [chg-GH-291-test-plan.md](../2026-11-12--GH-291--telemetry-v2/chg-GH-291-test-plan.md) (fixture contract, non-vacuity contract, mutant meta-suite, honesty matrices).
- **Existing evidence to extend (not replace)**: `tests/behaviour/closeout-*.test.ts` (dry-run, idempotency, convergence, compaction, temp-git), `tests/behaviour/plan-tier.test.ts` / `plan-validate-rejections.test.ts`, `tests/behaviour/retro-*.test.ts`, `tests/behaviour/brief-*.test.ts`, `tests/behaviour/state-*.test.ts`, `tests/structure/{error-table,envelope-contract,result-contract,content-inventory,state-contract,retro-contract}.test.ts`, `tests/checks/{error-table-sync,exit-code-literals,help-guide-coverage,doc-conformance,fixture-privacy}.test.ts`, `tests/golden/{envelope-*,closeout-*,plan-text}.test.ts`. Fixture primitives: `tests/fixtures/state/harness.ts`, `tests/fixtures/closeout/temp-git.ts`, `tests/fixtures/retro/harness.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

All 49 acceptance criteria from spec §17 (spec v1.1) are listed; every row has at least one automated case and none carries a TODO. The four criteria added in v1.1 (AC-F2-4, AC-F3-8, AC-F4-7, AC-F4-8) are covered by TC-CEREMONY-061..064 and, where noted, co-covered by a pre-existing TC whose assertions the spec change extended.

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | `ceremony --help` and root `--help` show the family and its four verbs; a reference page exists; the coverage inventory names it; exit 0 | TC-CEREMONY-001, TC-CEREMONY-060 | Covered |
| AC-F1-2 | Undeclared ceremony name refused as `input.value.rejected` at exit 1 naming the requested name; no run/step record or artifact | TC-CEREMONY-003 | Covered |
| AC-F1-3 | Any outcome under `--json` writes exactly one five-key `delivery.result.v1` envelope with the outcome under `data` or `error`, exit in `{0,1,2}` | TC-CEREMONY-004 | Covered |
| AC-F1-4 | A ceremony with no `sync` step yields the same verdict and artifacts with and without `--apply` | TC-CEREMONY-005 | Covered |
| AC-F2-1 | The six built-ins validate: 100% of steps carry a verification mode, 100% of outputs a schema identifier, no executable content or undeclared vocabulary name | TC-CEREMONY-007, TC-CEREMONY-010 | Covered |
| AC-F2-2 | Unknown step kind, step without verification, duplicate id, built-in collision, unknown tier, unparseable schedule → `ceremony.declaration.invalid` naming id and field at exit 1, nothing registered | TC-CEREMONY-008 | Covered |
| AC-F2-3 | A declaration exceeding any declared bound (phases, steps, inputs, targets, document size) is refused naming the exceeded bound | TC-CEREMONY-009 | Covered (the same case exercises the F-2 `triggers[]` 1..8 count as a declared bound; the criterion's parenthetical enumerates the others and is not restated) |
| AC-F2-4 | Every built-in and project declaration carries exactly one `scopeKey` from the closed derivation set (`literal`, `repository`, `note`), a `note` derivation only where a note is required, and at most one `schedule` trigger; a missing derivation, a `note` derivation without a note requirement, a malformed literal token, or two `schedule` triggers is refused as `ceremony.declaration.invalid` naming `scopeKey` or `triggers[]` | TC-CEREMONY-061, TC-CEREMONY-007 | Covered (the six-built-in acceptance half also runs inside the TC-007 validator sweep) |
| AC-F3-1 | The parametric parity suite executes all six built-ins through the same runner over synthetic inputs; declared agenda, output set, verification mode, and verdict hold; zero built-ins need a path the others do not use | TC-CEREMONY-011, TC-CEREMONY-012, TC-CEREMONY-019 | Covered |
| AC-F3-2 | The morning brief artifact validates against `delivery.brief.v1` with ten surfaces, three anchor groups, and the closed placeholder catalog; run exits 0 | TC-CEREMONY-013 | Covered |
| AC-F3-3 | The retro evidence pass at each of the four levels produces its declared per-level note with that level's declared trigger recorded | TC-CEREMONY-014 | Covered |
| AC-F3-4 | A testing-session assessment gives every note item exactly one verdict from the closed set, unassessed count zero; an item citing no evidence is `uncovered` | TC-CEREMONY-015 | Covered |
| AC-F3-5 | Mirror sync over two affected repositories with `--apply` makes each mirrored set equal the register set for that repository, verdict `verified`; later drift is `unverified` at exit 1 naming the target | TC-CEREMONY-016, TC-CEREMONY-052 | Covered |
| AC-F3-6 | A quiet night-watch shows every declared check exactly once with each clean area an explicit verified-empty | TC-CEREMONY-017 | Covered |
| AC-F3-7 | A sprint rollover with carry-over work makes every entry name its ref, a reason from the closed set, and its next milestone | TC-CEREMONY-018 | Covered |
| AC-F3-8 | An explicit `ceremony run` records `trigger.kind: "explicit"` with resolution `note` (note names a declared trigger), `declaration` (exactly one declared trigger), or `unspecified` (several declared, none named, set recorded); never counted as a scheduled/event obligation; a note naming an undeclared trigger is refused as `input.value.rejected`; the retro declaration declares no `change-merged` trigger and produces no R1 output | TC-CEREMONY-062, TC-CEREMONY-014 | Covered |
| AC-F4-1 | A step whose artifact fails read-back is `unverified`, no later step executes, run verdict `unverified` at exit 1, and run/step records plus produced artifact stay durable | TC-CEREMONY-020 | Covered |
| AC-F4-2 | After interruption at step *k*, `resume` starts at *k+1* and no verified step is re-executed or re-rendered | TC-CEREMONY-021 | Covered |
| AC-F4-3 | A run whose persisted step records contradict its declaration refuses `state.store.torn` at exit 2 with zero writes | TC-CEREMONY-022 | Covered |
| AC-F4-4 | At each of two phase boundaries the next phase receives a carried summary ≤4 096 bytes and ≤40 lines, and an over-bound summary carries an explicit omitted count | TC-CEREMONY-023 | Covered |
| AC-F4-5 | A `sync` step without `--apply` yields `dry-run` at exit 0 with the write set computed and precondition-checked, and nothing landed | TC-CEREMONY-024 | Covered |
| AC-F4-6 | An already-recorded `(ceremony, scopeKey, window)` returns the recorded verdict with `data.reused: true` and appends zero records and zero note bodies | TC-CEREMONY-025, TC-CEREMONY-063 | Covered |
| AC-F4-7 | The note-less scheduled `morning-brief` run twice in one UTC day without `--window`: the window is the cadence's derived day, the scope key is the declaration's `repository` derivation, the second invocation returns the recorded verdict with `data.reused: true`, and zero run records, step records, and artifacts are appended | TC-CEREMONY-063 | Covered |
| AC-F4-8 | The note-less event-triggered `decision-record-mirror-sync` run without `--window`: refused as `input.value.rejected` naming `--window` at exit 1 before any write with zero records and zero artifacts; with `--window`, the run identity is `(ceremony, repository scope key, that window)` | TC-CEREMONY-064 | Covered |
| AC-F5-1 | One missed daily window → exactly one run with `trigger.kind: "catch-up"` and the missed bounds; a second `catch-up` appends nothing and reports the window caught up | TC-CEREMONY-026 | Covered |
| AC-F5-2 | Every eligible ceremony current → `nothing-missed`, zero records, exit 0 | TC-CEREMONY-027 | Covered |
| AC-F5-3 | `catchUp.mode: "none"` with one missed window → declared gap with bounds and no run | TC-CEREMONY-028 | Covered |
| AC-F6-1 | A project-declared new ceremony appears with origin `project` and runs through the same steps, verifiers, and records as a built-in with zero tooling change | TC-CEREMONY-030 | Covered |
| AC-F6-2 | A present but unparseable declaration document refuses `config.file.malformed` at exit 1 before any run; no project ceremony silently dropped | TC-CEREMONY-031 | Covered |
| AC-F6-3 | A declaration document with no ceremony behaves identically to a repository with no document; built-ins unaffected | TC-CEREMONY-032 | Covered |
| AC-F7-1 | Plan tier `lite` + pm-notes variant `lite` → effective phase set equals the delivered pinned lite set element for element, the source is named, no additional vocabulary contributes | TC-CEREMONY-033, TC-CEREMONY-037 | Covered |
| AC-F7-2 | Plan tier disagreeing with the variant → the variant's set is effective, a `tier-mismatch` finding names both, delivery unaffected | TC-CEREMONY-034 | Covered |
| AC-F7-3 | Declared `review-rework` trigger with recorded evidence → effective set escalates to `full`, the escalation names the trigger and its evidence, the run record carries it | TC-CEREMONY-035 | Covered |
| AC-F7-4 | A declared trigger string outside the vocabulary → reported verbatim as `unevaluated`, never dropped or treated as false | TC-CEREMONY-036 | Covered |
| AC-F7-5 | Effective tier `lite` → only ceremonies whose declared `tiers` include `lite` carry an obligation; an explicit run of a non-obligated ceremony still executes | TC-CEREMONY-038 | Covered |
| AC-F8-1 | Every executed step carries a duration and a verification verdict, the run duration is derivable, and no run document exists to disagree with the ledger | TC-CEREMONY-040 | Covered |
| AC-F8-2 | The comparison record carries the committed metric identity, definition reference, before with window/sample, after with window/per-change values/sample, sample minimum, verdict, native basis, disclosure; before equals the committed baseline | TC-CEREMONY-041 | Covered |
| AC-F8-3 | Fewer than five post-boundary changes → `insufficient-sample`, observed `n` and per-change values recorded, no trend claim anywhere | TC-CEREMONY-042 | Covered |
| AC-F9-1 | **Pinned SC-M2-S3-02** — a note omitting its scope key is refused `ceremony.note-invalid` naming `scopeKey` at exit 1, no partial output, no run/step record | TC-CEREMONY-047, TC-CEREMONY-039 | Covered |
| AC-F9-2 | **Pinned SC-M2-S3-01** — a schema-conforming note makes each agenda step produce its declared output and the run end with an artifact-verified follow-through section carrying ≥1 verified action at exit 0 | TC-CEREMONY-048 | Covered |
| AC-F9-3 | A `window`/`project` retro with open actions runs follow-through verification as the first phase and each action verdict cites its verification artifact, never an owner status claim | TC-CEREMONY-043 | Covered |
| AC-F9-4 | A retro note already recorded for a scope key at an earlier window → an addendum is appended, the prior body is not rewritten, and exactly one new run is recorded | TC-CEREMONY-044 | Covered |
| AC-F9-5 | A retro window supporting no finding → the note carries an explicit empty finding set, no fabricated action, and the run is `verified` at exit 0 | TC-CEREMONY-045 | Covered |
| AC-F9-6 | The retro evidence step is a read-only fold over the delivered pipeline's verified evidence and run records; it writes no retro evidence, registry record, or chain material | TC-CEREMONY-046, TC-CEREMONY-057 | Covered |
| AC-NFR2-1 | Structural scans find zero inference clients, model identifiers, network modules, and ambient clock/random/environment reads in fold/render/verification/tier paths; a mutation adding one fails the scan | TC-CEREMONY-050 | Covered |
| AC-NFR8-1 | Both new rows exist in machine and documented tables with identical structured fields; the `ceremony` kind requires an exact code; the reserved two-segment allowlist contains `ceremony.note-invalid` | TC-CEREMONY-049 | Covered |
| AC-NFR9-1 | Exactly two phase-set sources are consumed, no tier name outside `full`/`lite` exists, and no hardcoded default phase set exists outside the delivered per-variant data | TC-CEREMONY-051 | Covered |
| AC-NFR12-1 | A mirror-sync declaration with >8 targets is refused or the undeclared target is untouched, and no force path exists on any target | TC-CEREMONY-052, TC-CEREMONY-016 | Covered |
| AC-NFR14-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens, commits follow declared conventions, and the PR targets `main-tools` | TC-CEREMONY-058, TC-CEREMONY-059 | Covered (gate/PR half is evidence-only — GAP-5) |

**Ticket-AC traceability (Appendix A, binding).**

| Ticket AC (M2-S3) | Covered by | How the plan proves it |
|---|---|---|
| AC1 — ceremony share measured before and after; trend toward 40 %; recorded from committed data | TC-CEREMONY-041, TC-CEREMONY-042 | The comparison record's members are asserted against the committed baseline log; the below-minimum case proves no trend is claimed with `n < 5` |
| AC2 — every built-in ceremony is parity-testable | TC-CEREMONY-011, TC-CEREMONY-012, TC-CEREMONY-007 | One parametric suite over six declarations plus one negative case each; the validator runs over the same six |
| AC3 — a project-declared ceremony runs through the same runner without tooling changes | TC-CEREMONY-030 | A declaration-document-only fixture produces the same record shape and verification discipline as a built-in |
| AC4 — retro ceremonies follow the retrospective concept (declared trigger, follow-through first, fixed schema, scope keys, per-level outputs) | TC-CEREMONY-014, TC-CEREMONY-062, TC-CEREMONY-039, TC-CEREMONY-043, TC-CEREMONY-044, TC-CEREMONY-045, TC-CEREMONY-047, TC-CEREMONY-048 | Level-by-level triggers and outputs, the four-trigger declaration set with explicit-run resolution, note-contract intake, first-phase position, scope-key idempotency, addendum, null retro |
| SC-M2-S3-01 (inherited seed) | TC-CEREMONY-048 | Verbatim assertion: exit 0 and `follow-through` section with ≥1 verified action |
| SC-M2-S3-02 (inherited seed) | TC-CEREMONY-047 | Verbatim assertion: exit 1 and `error.code == "ceremony.note-invalid"` naming `scopeKey` |

**Capability coverage (no capability unlinked).** F-1 → TC-001..006, TC-064; F-2 → TC-007..010, TC-061; F-3 → TC-011..019, TC-062; F-4 → TC-020..025, TC-040, TC-063, TC-064; F-5 → TC-026..029; F-6 → TC-030..032; F-7 → TC-033..038, TC-051; F-8 → TC-040..042; F-9 → TC-014..015, TC-039, TC-043..048.

**v1.1 traceability delta (spec DEC-16/DEC-17/DEC-18 and E-18/E-19/E-20).** Four criteria were added to §17 by the readiness remediation: the declaration-held scope key with its closed derivation and the single-schedule bound (AC-F2-4 → TC-061), the recorded trigger kind/resolution for explicit runs plus the retro declaration's four-trigger set and absent R1 output (AC-F3-8 → TC-062, co-covered by TC-014), the note-less scheduled idempotency case AC-F4-6 could not see (AC-F4-7 → TC-063), and the note-less event-triggered `--window` requirement (AC-F4-8 → TC-064). No pre-existing AC lost a TC and no AC text was stretched: AC-F4-6 gained the note-less half (TC-063), AC-F2-3's generic "declared bound" clause now also exercises the `triggers[]` count (TC-009, parenthetical unchanged), DM-1's bound statement was restated to the spec's single schedule-trigger bound, and TC-014's trigger assertion moved from kind-equality to the recorded-trigger rule (see §9).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification adds no HTTP endpoint (§8.1: N/A) and no event topic or kind (§8.2); the observable interface is the CLI grammar and the `delivery.result.v1` envelope plus the state/artifact surfaces below.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| CLI grammar (§8.1) | One positional (`run`: ceremony name; `resume`: run id), `--note <path>`, `--window <start>..<end>`, `--apply`, plus the three global flags; unknown/missing tokens refuse before any read/write | TC-CEREMONY-002, TC-CEREMONY-004, TC-CEREMONY-006 | Covered |
| DM-1 — ceremony declaration contract `delivery.ceremony.declarations.v1` | Member set, closed vocabularies, uniqueness, data-only property; the `triggers[]` count bound 1..8 (an F-2 bound) and the single schedule-trigger bound restated once in DM-1; the required `scopeKey` member with its closed derivation set; bounds ≤16 ceremonies/document, ≤12 phases, ≤32 steps, ≤16 inputs, ≤8 targets, 1 MiB document, id `^[a-z][a-z0-9-]*$` ≤64 characters | TC-CEREMONY-007..011, TC-CEREMONY-009, TC-CEREMONY-061 | Covered |
| DM-2 — ceremony note contract `delivery.ceremony.note.v1` | Required members, `scopeKey` anchor and its precedence against the declaration's `literal`/`repository` key, `window.start ≤ end`, `trigger` naming a declared trigger, retro fixed members, addenda append-only | TC-CEREMONY-039, TC-CEREMONY-043..045, TC-CEREMONY-047, TC-CEREMONY-048, TC-CEREMONY-061, TC-CEREMONY-062 | Covered |
| DM-3 — `ceremony.run` record `delivery.ceremony.run.v1` | One record per run identity: ceremony/run id, origin, declaration digest, trigger kind + resolution (+ declared trigger or declared set), declared and actual window, catch-up marker, scope key with its derivation, tier facts, injected start, phase count | TC-CEREMONY-003, TC-CEREMONY-026, TC-CEREMONY-035, TC-CEREMONY-040, TC-CEREMONY-062, TC-CEREMONY-063, TC-CEREMONY-064 | Covered |
| DM-4 — `ceremony.step` record `delivery.ceremony.step.v1` | One record per attempted step: index, phase index, kind, outcome, start/end/duration, slot, artifact reference, verification verdict, classified reason | TC-CEREMONY-020, TC-CEREMONY-022, TC-CEREMONY-040 | Covered |
| DM-5 — ceremony record boundary | Two kinds under `ceremony.` prefix, boundary validation, `state.store.unknown` on nonconforming write, fenced append + exactly-one re-read, four read verdicts, folds only | TC-CEREMONY-022, TC-CEREMONY-040 | Covered |
| DM-6 — ceremony artifact family | Per-repository file family in the state directory, one artifact per run named by run id, `0600`, outside the ledger and derived-document set; unreadable render fails its step | TC-CEREMONY-020, TC-CEREMONY-023, TC-CEREMONY-053 | Covered |
| DM-7 — tier verdict | `effectiveTier`, canonical-ordered `phaseSet[]`, `phaseSetSource`, `declaredTier`, `declaredVariant`, `escalationTriggers[]` (matched/unmatched/unevaluated verbatim), `escalations[]`, `findings[]` | TC-CEREMONY-033..037 | Covered |
| DM-8 — ceremony-share comparison record | `metricId`, `definitionRef`, `before`, `after`, `sampleMinimum: 5`, closed `verdict`, `nativeBasis`, `disclosure`; additive `comparisons[]` with declared schema bump; no `MET-` reallocation | TC-CEREMONY-041, TC-CEREMONY-042 | Covered |
| DM-9 — error identities and allowlist | Two additive rows under a new `ceremony` kind; two-segment allowlist 52 → 53; documented table 136 → 138; exact-code resolution; `fallback.internal` containment | TC-CEREMONY-008, TC-CEREMONY-039, TC-CEREMONY-047, TC-CEREMONY-049 | Covered |
| Events/messages (§8.2) | No topic/kind added; ceremony state is durable state; phase/commit/closeout events read only where declared | TC-CEREMONY-046, TC-CEREMONY-058 | Covered (as non-regression) |
| External integrations (§8.4) | No vendor/credential/network; mirror sync composes the delivered commit primitive and checkout preflight into declared repositories only | TC-CEREMONY-016, TC-CEREMONY-052, TC-CEREMONY-057 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Envelope/exit continuity: 0 new top-level keys; all new fields under `data`; exits in `{0,1,2}`; `data` XOR `error` on 100 % | TC-CEREMONY-004, TC-CEREMONY-002 | Covered |
| NFR-2 | Deterministic render/verification with 0 model calls: byte-identical artifacts and human text for identical inputs/clock/declaration; 0 inference imports, model ids, network modules, ambient reads in fold/render/verify/tier paths | TC-CEREMONY-050, TC-CEREMONY-053 | Covered |
| NFR-3 | Artifact-verified completion: 100 % of steps carry a verification mode; 100 % of `verified` steps passed read-back; 0 outcome-only assertions; 0 over-bound declarations accepted | TC-CEREMONY-007, TC-CEREMONY-011, TC-CEREMONY-012, TC-CEREMONY-020, TC-CEREMONY-009 | Covered |
| NFR-4 | Resume correctness: re-executed verified steps = 0; step records ≤ *n* + re-attempts of the failed step; contradicted sequences refuse `state.store.torn` with 0 writes | TC-CEREMONY-021, TC-CEREMONY-022 | Covered |
| NFR-5 | Idempotency: 0 duplicate run records per `(ceremony, scopeKey, window)`; 0 duplicate note bodies; a repeat catch-up appends 0; a note-less repeat in one derived window appends 0 records and 0 artifacts | TC-CEREMONY-025, TC-CEREMONY-063, TC-CEREMONY-064, TC-CEREMONY-044, TC-CEREMONY-026 | Covered |
| NFR-6 | Catch-up boundedness: ≤1 missed window per ceremony per invocation; 0 fabricated windows; no-miss appends 0 and exits 0 | TC-CEREMONY-026..029 | Covered |
| NFR-7 | Bounded carried state and output: summary ≤4 096 bytes/≤40 lines with explicit omitted count; run ≤16 KiB; step ≤2 KiB; brief artifact ≤65 536 bytes; declaration ≤1 MiB | TC-CEREMONY-023, TC-CEREMONY-053, TC-CEREMONY-009 | Covered |
| NFR-8 | Error-table binding: exactly 2 rows, 1 kind, 1 reserved entry added; 100 % two-way sync; 0 delivered rows changed | TC-CEREMONY-049 | Covered |
| NFR-9 | Tier neutrality: exactly 2 phase-set sources; 0 additional vocabularies; 0 tier names outside `full`/`lite`; 0 hardcoded default phase sets | TC-CEREMONY-051, TC-CEREMONY-033 | Covered |
| NFR-10 | Measurement completeness: 100 % of executed steps carry a duration; 100 % of runs carry a start and derivable duration; 100 % of comparison records carry every required member; 0 trend claims below the minimum | TC-CEREMONY-040, TC-CEREMONY-041, TC-CEREMONY-042 | Covered |
| NFR-11 | Read/run cost per verb (list/run/resume/catch-up budgets); 0 retries, 0 pagination crawls, 0 child processes, 0 network calls | TC-CEREMONY-006, TC-CEREMONY-055 | Covered |
| NFR-12 | Mirror-sync safety: ≤8 declared targets; 100 % contract-conformant after sync; 0 force paths; 0 writes to undeclared repositories; 0 writes without `--apply`; any directional difference → `unverified` naming the target | TC-CEREMONY-016, TC-CEREMONY-024, TC-CEREMONY-052 | Covered |
| NFR-13 | Duration budgets (reference environment): morning-brief ≤30 s; retro window ≤60 s over a 10 000-record sidecar; resume ≤10 s with ≤5 steps; catch-up ≤60 s over six declarations | TC-CEREMONY-055 | Covered as bounded work in CI plus a reference measurement (GAP-3) |
| NFR-14 | Quality gates and commit hygiene: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green; conventional subjects scoped `GH-296`; body/footer lines ≤100 chars; PR to `main-tools`, open | TC-CEREMONY-059, TC-CEREMONY-058 | Covered (evidence-only process half — GAP-5) |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 49 are mapped to at least one automated case; none carries a TODO.
- **ACs not mechanically assertable in the permanent suite**: **AC-NFR14-1** only, and only its process halves — "green before the PR opens", "PR targets `main-tools`", "PR stays open". A permanent test cannot assert PR state without asserting against a moving external fact or a diff against a base branch (forbidden by `testing-strategy.md` §Invariant-test authoring). It is evidenced instead by (a) the phase-9 gate log recording the exact command and exit code, (b) the commit-message range gate output, and (c) PR metadata recorded as a pm-notes `notes:` entry. Its *mechanical* half — the change introduces no gate regression — is additionally covered by TC-CEREMONY-059 running the full battery in CI.
- **Orphan TCs**: none. Every TC names at least one AC, DM, or NFR in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-13's wall-clock half is reference-only (GAP-3); its CI-verifiable bounded-work half is asserted in TC-CEREMONY-055.
- **Uncovered DMs**: none (DM-1..DM-9 all mapped).
- **Inherited scenario seeds**: both adopted by ID with their verbatim assertions; neither is restated. `SC-M2-S3-01` → TC-CEREMONY-048; `SC-M2-S3-02` → TC-CEREMONY-047.
- **Spec cross-reference resolved (no criterion added by that correction)**: Appendix B constraint C-1 cites `NFR-1, AC-F1-3`; both are declared (NFR-1 in §9, AC-F1-3 in §17). NFR-1 is evidenced by AC-F1-3 through TC-CEREMONY-004 (with the grammar half in TC-CEREMONY-002). That correction added no criterion; the criteria the v1.1 readiness remediation *did* add are listed next (see also OQ-T5, OQ-T6).
- **Spec-named behaviour bound to an existing AC/NFR** (no dedicated AC by design):

| Behavior | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| Grammar refusals through `fallback.invocation` before any read/write | F-1 rules | AC-F1-3, NFR-1 | TC-CEREMONY-002 |
| `ceremony list` content and read cost | F-1 table, NFR-11, §10 | NFR-11, AC-F1-1 | TC-CEREMONY-006 |
| `--apply` accepted-and-inert where no `sync` step exists | F-1 rules, DEC-12 | AC-F1-4 | TC-CEREMONY-005 |
| Declarations cannot carry executable content | F-2, §21, RSK-2 | AC-F2-1, AC-F2-2 | TC-CEREMONY-010 |
| Degradation is data, not failure (unavailable collector renders state+reason) | F-3 parity obligation, E-7 | AC-F3-1, NFR-3 | TC-CEREMONY-019 |
| Note intake contract: absent note, missing member, ceremony mismatch, window disagreement | F-1, F-9, DM-2, E-1, E-3 | AC-F9-1 | TC-CEREMONY-039 |
| `plan.tier.phases` canonical subset and `unresolved-phase` | F-7, DM-7, Appendix D | AC-F7-1, AC-NFR9-1 | TC-CEREMONY-037 |
| Tiered intake obligation vs explicit operator run | F-7 tiered intake | AC-F7-5 | TC-CEREMONY-038 |
| `undeclared-trigger` finding instead of an invented trigger | F-9 declared trigger model | AC-F3-3, AC-F9-2 | TC-CEREMONY-014 |
| Handoff, not filing (no action row claimed) | F-9, DEC-3, NG-2 | AC-F9-2, AC-F9-6 | TC-CEREMONY-046 |
| Human output bounded (≤32 lines / 6 144 bytes) and deterministic | §10 | NFR-7, NFR-2 | TC-CEREMONY-053 |
| Retired/excluded surfaces not delivered | §7.2, NG-1..NG-8, DoD-13 | AC-NFR14-1 | TC-CEREMONY-058 |
| Documentation deltas and `ados_distribution: redistributable` | Appendix C, DoD-12 | AC-F1-1 | TC-CEREMONY-060 |
| Declaration-held scope key and its closed derivation (incl. the `note`-derivation legality rule) | F-2 scope-key precedence, DM-1, DM-2, E-19, DEC-16 | AC-F2-4 | TC-CEREMONY-061 |
| Window resolution order (note → `--window` → single declared cadence; event-only requires `--window`) | F-1 window resolution, E-18, DEC-18 | AC-F4-7, AC-F4-8 | TC-CEREMONY-063, TC-CEREMONY-064 |
| Recorded trigger kind + resolution for explicit runs; obligation non-counting | F-2 declared-versus-recorded triggers, DM-3, E-20, DEC-17 | AC-F3-8 | TC-CEREMONY-062 |

**Traceability summary.** AC covered: **49 / 49** (48 fully automated, 1 mixed: AC-NFR14-1 mechanical half automated, process half evidence-only — GAP-5). DM covered: **9 / 9**. NFR covered: **14 / 14** (NFR-13 reference-only wall clock). Inherited seeds adopted: **2 / 2**. Test cases: **64** (`TC-CEREMONY-001..064`), each owning exactly one delivery phase per §7.1.
**Deferred items with reason** (no TCs by design, per §7.3): a ceremony run-history read verb (OQ-1, deferred until M2-S6 needs it); a native `MET-` ID for runner-measured time (requires a definition change and a new allocation); ceremony packs (NG-3); ceremony-driven scheduling admission / blocking `pre-dispatch` (OQ-3, advisory only in this change); ceremony state on the board (§7.2); per-ceremony cost attribution (telemetry v2 attribution does not yet cover non-delivery work).

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract, vocabulary and bounds | `bun test tests/structure` | `tests/structure/ceremony-contract.test.ts` (new); `tests/structure/{state-contract,plan-contract,content-inventory}.test.ts` (update) | TC-CEREMONY-007, 009, 010, 051, 061 |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/ambient-globals.ts` | `tests/structure/ceremony-imports.test.ts` (new) | TC-CEREMONY-050 (static half), 057 (static half) |
| Error identity and two-way sync | `bun test tests/checks` (the suite invokes `runSyncCheck`); `bun run scripts/checks/error-table-sync.ts` | `tests/checks/error-table-sync.test.ts` (update), `tests/structure/error-table.test.ts` (update) | TC-CEREMONY-049 |
| Pure domain — declaration, tier, schedule, note | `bun test tests/unit` (or the behaviour suite where no `tests/unit` exists) | `tests/behaviour/ceremony-declaration.test.ts`, `ceremony-tier.test.ts`, `ceremony-schedule.test.ts` (new) | TC-CEREMONY-008, 033..038, 061 |
| State layer with injected store | `bun test tests/behaviour` | `tests/behaviour/ceremony-state-boundary.test.ts`, `ceremony-resume.test.ts` (new) | TC-CEREMONY-022, 040 |
| Runner with injected runners/readers | `bun test tests/behaviour` | `tests/behaviour/ceremony-run.test.ts`, `ceremony-parity.test.ts`, `ceremony-run-triggers.test.ts` (new) | TC-CEREMONY-011..020, 023..025, 062..064 |
| Adapter — declaration document read | `bun test tests/behaviour` | `tests/behaviour/ceremony-project-declarations.test.ts` (new) | TC-CEREMONY-030..032 |
| CLI edge — grammar, envelope, exit projection | `bun test tests/behaviour tests/golden` | `tests/behaviour/ceremony-cli.test.ts` (new), `tests/golden/ceremony-envelope.test.ts` (new) | TC-CEREMONY-001..006 |
| Behaviour — end-to-end multi-step flows | `bun test tests/behaviour` | `tests/behaviour/ceremony-flow-{brief,retro,rollover,night-watch,assessment,mirror}.test.ts` (new) | TC-CEREMONY-013..018, 047, 048 |
| Structure/invariant — "single mapping / no second vocabulary / parity" | `bun test tests/structure tests/checks` | `tests/structure/ceremony-{parity-invariants,tier-single-source,catch-up-purity}.test.ts` (new) | TC-CEREMONY-011, 029 (purity), 051 |
| Mutation meta-suite | `bun test tests/checks` | `tests/checks/ceremony-mutants.test.ts` (new) | TC-CEREMONY-050, 051, 053, and the non-vacuity controls |
| Doc-conformance / help-coverage | `bun test tests/checks`; `bun run scripts/checks/help-guide-coverage.ts`, `prompt-conformance.ts`, `doc-conformance.test.ts` | `tests/checks/{help-guide-coverage,doc-conformance,prompt-conformance}.test.ts` (update) | TC-CEREMONY-001, 060 |
| Performance / bounds | `bun test tests/behaviour` | `tests/behaviour/ceremony-{performance,bounds,determinism}.test.ts` (new) | TC-CEREMONY-053..056 |
| Hermeticity | `bun test tests/checks` | `tests/checks/ceremony-hermetic.test.ts` (new; the `daemon-hermetic` / `provider-hermetic` pattern) | TC-CEREMONY-057 |
| Aggregate gate and non-regression | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | repo root (`lint → format:check → typecheck → test → check:boundaries → check:memory → prompt-conformance → help-guide-coverage → exports-parity`) | TC-CEREMONY-058, 059 |

### 4.1 Fixture and Harness Contract (binding for every ceremony TC)

1. **No live network, no child process, no live-tree write.** Every suite imports production modules and injects ports plus a per-test temp root. No suite opens a socket, spawns a process, resolves a credential, reads `$HOME`, or writes the real state directory or the live repository tree (NFR-11, §24 Appendix E). A test that needs a repository action (mirror sync) uses an isolated temp git repo built by `tests/fixtures/closeout/temp-git.ts`.
2. **Synthetic clock.** Time arrives only through the injected clock port. Every fixture uses a fixed literal `NOW_MS` and literal window bounds; `Date.now()` is never called in a test. Schedule fixtures place windows on either side of `NOW_MS` deliberately, and one fixture uses a UTC midnight boundary so a local-time assumption fails.
3. **Id factories and fence tokens.** Run ids, step ids and artifact names come from injected deterministic id factories with fixed sequences. Fence tokens come from the injected fence port with literal fixture values; two concurrent-append fixtures use distinct literal tokens so a shared-token assumption fails.
4. **Injected input readers.** Every GET-only input is a recording fake returning fixture facts. The recording asserts *which* source was read, how many times, and with which window — this is how NFR-11 read cost is proven without a live store. A collector-unavailable fixture returns a classified unavailable result rather than throwing.
5. **Byte-level artifact I/O.** The artifact slot is a real temp-directory file family read and written as bytes, so `artifact-conforms` and `artifact-equals-source` are proven on serialized bytes (measured in UTF-8), and `0600` permissions are asserted from the filesystem mode. No golden is satisfied by an in-memory object.
6. **Committed declaration fixtures.** The six built-ins are read from the production contract data (the parity suite iterates *production* declarations, not copies). Project declarations live in `tests/fixtures/ceremony/declarations/` as committed documents — one valid, one per defect (GAP-2), one unparseable, one empty, one colliding, one per `scopeKey`/trigger derivation defect (D-15..D-18), one per legal derivation, one note-less scheduled and one note-less event-only (for TC-061/063/064) — with a committed expectation table naming code and field.
7. **Committed note fixtures.** `tests/fixtures/ceremony/notes/` holds a conforming note per retro level, a missing-`scopeKey` note, a missing-member note, a wrong-ceremony note, a window-disagreeing note, and a note naming an undeclared trigger (`change-merged` on the retro declaration). All synthetic, privacy-scanned (`tests/checks/fixture-privacy.test.ts`), no real participant identities.
8. **One temp store per case, seeded through production writers.** `tests/fixtures/state/harness.ts` supplies the temp root, store, identity and fence primitives; ceremony records are seeded by composing the production append path (or a fixture builder that emits only payloads the production writer could emit), never by hand-written JSONL.
9. **Independent oracles.** Expected verdicts, durations, byte lengths, line counts, phase sets, and comparison arithmetic are computed from hand-written fixture constants — never by calling the production fold, and never by re-summing the same array the production code sums. The pinned phase sets are compared element-for-element against `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`, imported rather than re-typed.
10. **Skip never counts as a pass.** Any suite with a conditional (platform, capability, environment) must fail when its precondition is absent unless the condition is one of the two declared and documented platform exceptions (Windows ACL). A `test.skip` without a paired `test.fail`-style guard is a plan violation; the hermetic suite (TC-CEREMONY-057) asserts that no ceremony suite silently skips.
11. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy. No `git diff` against `origin/main-tools` appears in a permanent suite (testing-strategy invariant rule).

### 4.2 Non-Vacuity Contract (binding for every refusal, absence, bound and finding case)

1. **A planted positive is asserted before the negative.** Before asserting `ceremony.declaration.invalid`, a paired valid declaration validates clean; before asserting zero appends, a first run is asserted to append exactly one run and *n* step records; before asserting `insufficient-sample`, an `n ≥ 5` fixture computes a verdict; before asserting an over-bound compaction, an under-bound summary is asserted untruncated.
2. **A paired live control runs in the same test.** Every refusal beside the accepted invocation; every torn run beside a healthy run; every `mode: none` gap beside a `once` catch-up; every missing-note case beside a conforming note; every `unverified` run beside a `verified` run of the same declaration.
3. **A disabling mutant must fail the suite.** `tests/checks/ceremony-mutants.test.ts` builds temp copies of production modules (the `tests/golden/redaction.test.ts` import pattern) and disables one rule each — at minimum: skip read-back verification; treat step outcome as verification; resume from step 0; allow a duplicate run identity to append; allow a second missed window; hardcode the `lite` phase set; drop an `unevaluated` trigger; treat `declaredTier` as authoritative; write a note body instead of an addendum; fabricate a finding for a null retro; substitute the native basis for the committed proxy; zero-fill `insufficient-sample` into `flat`; record an explicit run as a `schedule` kind; derive a window for an event-only declaration; accept a declaration whose `scopeKey` is absent or whose `note` derivation requires no note. Each mutant must produce the prohibited observable with the fixture unchanged; if the real module also produced nothing, the suite fails.
4. **Permutation invariance is asserted, not assumed.** The same step set appended in shuffled order must produce byte-identical derived summaries and human output; a fixture whose expected result depends on append order fails.
5. **Bounds are measured, never assumed.** Byte bounds are measured on serialized UTF-8 bytes after asserting a positive measured length; line bounds by counting rendered lines; permission bits from `stat`.
6. **Every finding is asserted as data, not as text.** `tier-mismatch`, `unresolved-phase`, `unevaluated-trigger`, and `undeclared-trigger` are asserted as structured finding entries naming their subject.

### 4.3 Exit and Outcome Oracle (binding for every outcome class)

| Outcome class | Identity / verdict | Projection | Exit | Never | TC |
|---|---|---|---|---|---|
| Run fully verified, all declared effects landed | `data.verdict: "verified"` | success | 0 | A second status field that could disagree with the fold | 011, 020, 048 |
| `sync` step present, `--apply` absent | `data.verdict: "dry-run"` | success | 0 | A landed write; an error exit for a declared rehearsal | 024 |
| `--apply` present, declaration has no `sync` step | identical verdict/artifacts to the no-flag run | success | 0 | A distinct verdict for an inert flag | 005 |
| Clean catch-up: all current or all caught up | `data.outcome` clean (e.g. `nothing-missed`) | success | 0 | A fabricated run for a current ceremony | 026, 027 |
| `catchUp.mode: "none"` with a missed window | declared gap with bounds, no run | success | 0 | A fabricated run; a silent omission | 028 |
| Step verification failed | `data.verdict: "unverified"`, step named | data-bearing negative | 1 | An error row (DEC-5); a repaired or retried step | 020, 012 |
| Catch-up whose replayed run is `unverified` | `unverified` naming the ceremony/step/window | data-bearing negative | 1 | A success exit because other ceremonies were current | 029 |
| Missing verb / unknown verb / unexpected positional / unknown flag / missing flag value | `fallback.invocation` | user-validation | 1, before any read or write | Any read, record, or artifact | 002 |
| Undeclared ceremony name | `input.value.rejected` naming requested name + declared set | user-validation | 1 | A run/step record or artifact | 003 |
| Explicit `ceremony run` whose trigger resolves | `trigger.kind: "explicit"` with `resolution` of `note`, `declaration`, or `unspecified` (declared set named when `unspecified`) | success | 0 | A `schedule` or `event` kind on an operator invocation; an obligation marked fulfilled by it | 062 |
| Note required and absent (E-1) | `input.value.rejected` naming the missing note | user-validation | 1, before any read/write | A run record or artifact | 039 |
| Note missing `scopeKey` (SC-M2-S3-02) | `ceremony.note-invalid` naming `scopeKey` | user-validation | 1 | Any partial ceremony output; any record | 047 |
| Note missing another required member / wrong ceremony / window disagreement | `ceremony.note-invalid` (or `input.value.rejected` for the `--window` disagreement) naming the field(s) | user-validation | 1 | A written note; a silently chosen window | 039 |
| Note names a trigger the declaration does not declare | `input.value.rejected` naming the note's trigger + the declared set | user-validation | 1 | A recorded trigger the declaration never declared | 062 |
| Note-less event-only declaration invoked without `--window` (E-18) | `input.value.rejected` naming `--window` | user-validation | 1, before any write | A derived window; a partially resolved identity; a run/step record or artifact | 064 |
| Invalid declaration (vocabulary, uniqueness, collision, schedule, missing verify/schema) | `ceremony.declaration.invalid` naming ceremony id + field | user-validation | 1, nothing registered | A partial registration; a built-in overridden | 008 |
| Declaration over a bound | `ceremony.declaration.invalid` naming the exceeded bound | user-validation | 1 | Silent truncation of a declaration | 009 |
| Declaration with no `scopeKey`, a `note` derivation without a note requirement, a malformed literal token, or two `schedule` triggers (E-19) | `ceremony.declaration.invalid` naming `scopeKey` or `triggers[]` | user-validation | 1, nothing registered | An undefined or ambiguous run identity; an ambiguous derived window | 061 |
| Declaration document present but unparseable (E-11) | `config.file.malformed` | user-validation | 1, before any run | Silently dropping project ceremonies | 031 |
| Torn/contradicted run record sequence (E-6) | `state.store.torn` | platform-provider | 2, zero writes | A guessed repair; a reorder | 022 |
| Nonconforming ceremony state write | `state.store.unknown` with `not_landed` | platform-provider | 2 | A default-filling write | 040 |
| Storage permission violation | `state.permission.denied` (delivered projection) | user-validation | 1 | A new ceremony row | 022 (paired) |
| Tier disagreement / unresolved phase / unevaluated trigger | `data.tier.findings[]`, run still succeeds | success (finding, not error) | 0 | A new error identity; a blocked delivery | 034, 036, 037 |
| Escalation matched with evidence | `data.tier.escalations[]` naming trigger + evidence | success (finding) | 0 | A silent override of the variant | 035 |
| `insufficient-sample` comparison | `verdict: "insufficient-sample"` in committed data | success (data) | — | A trend claim; `flat` for small n | 042 |

**Invariants.** Exit is a pure function of the projection class; no fourth value exists. `data` XOR `error` on 100 % of outcomes. All new keys live under `data`; there is no `ok` and no `command` key. The two additive identities are reused, never forked; all `state.*`, `config.*`, `input.*`, `plan.*` and `fallback.*` identities are the delivered ones. Machine consumers branch on the code, never on the exit alone.

### 4.4 Catch-up Matrix (binding for AC-F5-1..3, NFR-6, DEC-12)

| ID | Declaration / recorded state | Expected outcome | Exit | Never |
|---|---|---|---|---|
| CU-01 | `daily`, one missed window, no run for it | exactly one run labelled `catch-up` with the missed bounds | 0 | Two runs; the execution window used as the run identity |
| CU-02 | `daily`, one missed window already recorded | `nothing-missed` (or "already caught up"), zero records | 0 | A duplicate run record |
| CU-03 | All eligible schedules current | `nothing-missed`, zero records | 0 | An empty error; a fabricated run |
| CU-04 | Five missed windows, `maxMissedWindows: 1` | exactly one replayed (the declared one), the others reported as still missed | 0 | Replaying five; silently discarding the remainder without a report |
| CU-05 | `mode: "none"`, one missed window | declared gap with bounds, no run | 0 | A run; a silent omission |
| CU-06 | Event-triggered ceremony (`change-merged`, `session-end`, …) | no missed windows evaluated; obligation recorded as a declared gap rather than invented | 0 | A synthesized window |
| CU-07 | Declaration removed between runs, history present | history readable; missing declaration reported as a declared gap | 0 | An invented run; unreadable history |
| CU-08 | Replayed run reads current inputs | both the missed window and the execution window recorded; no fabricated data for the missed window | 0 | Back-dated fabrication of input facts |
| CU-09 | Replayed run's step fails verification | `unverified` naming the ceremony/step/window | 1 | A success exit because other ceremonies were current |

### 4.5 Tier Verdict Matrix (binding for AC-F7-1..5, AC-NFR9-1, DEC-2, DEC-13, Appendix D)

| ID | Plan `tier` | pm-notes `variant` | Recorded evidence | Expected verdict | Never |
|---|---|---|---|---|---|
| T-01 | `full` | `full` (or absent) | none | eleven phases, source `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full` | A re-typed phase list; a missing source |
| T-02 | `lite` | `lite` | none | the pinned six-phase set element for element, source `.lite`, no extra vocabulary | A seventh phase; a locally declared set |
| T-03 | `lite` | `full` | none | the `full` set effective; `tier-mismatch` naming both; delivery unaffected | Picking `lite`; blocking; rewriting either declaration |
| T-04 | `full` | `lite` | none | the `lite` set effective; `tier-mismatch` naming both | Picking `full` |
| T-05 | any | any + plan `tier.phases` with canonical ids | none | the declared subset, canonical order, restricted to canonical ids | Introducing a phase outside the eleven |
| T-06 | any | any + plan `tier.phases` with a non-canonical id | none | `unresolved-phase` finding naming the id; the id not applied | Silently dropping it; applying it |
| T-07 | `lite` | `lite` | `review-rework` verdict recorded | effective set escalates to `full` for the remainder; escalation names trigger + evidence; run record carries it | An unrecorded escalation; a silent override |
| T-08 | `lite` | `lite` | declared `review-rework`, no recorded evidence | trigger `unmatched`; no escalation | Escalating on a mere declaration |
| T-09 | `lite` | `lite` | declared unknown string e.g. `owner-mood` | `unevaluated-trigger` with the string verbatim | Dropped; evaluated as false; an error row |
| T-10 | each of the five closed triggers | matching | present / absent | each is evaluable; `matched` only with present evidence | A sixth trigger silently accepted |
| T-11 | `lite` (effective) | `lite` | none | intake obligates only ceremonies whose `tiers` include `lite`; an explicit `ceremony run` of a non-obligated one still executes | Refusing an operator-initiated run |

### 4.6 Declaration Defect Corpus (binding for AC-F2-2, AC-F2-3, AC-F2-4, AC-F6-1, DM-1, DM-9)

| ID | Defect | Expected refusal | Field named | Registered |
|---|---|---|---|---|
| D-01 | Unknown step kind (`deploy`) | `ceremony.declaration.invalid` | `agenda[..].steps[..].kind` | nothing |
| D-02 | Step with no `verify` | same | `verify` | nothing |
| D-03 | Output with no schema identifier | same | `outputs[..].schema` | nothing |
| D-04 | Unknown input source | same | `inputs[..].source` | nothing |
| D-05 | Unknown output slot (`filesystem`) | same | `outputs[..].slot` | nothing |
| D-06 | Unknown verification mode | same | `verify` | nothing |
| D-07 | Unknown trigger event | same | `triggers[..].event` | nothing |
| D-08 | Tier outside `full`/`lite` | same | `tiers[..]` | nothing |
| D-09 | Unparseable schedule (e.g. `at: "25:00"`, cadence `hourly`) | same | `triggers[..].at` / `.cadence` | nothing |
| D-10 | Duplicate `id` within the document | same | `id` | nothing |
| D-11 | Project `id` collides with a built-in | same | `id`; the built-in stays effective | nothing |
| D-12 | Over bounds: 13 phases / 33 steps / 17 inputs / 9 targets / 17 ceremonies / 9 triggers / id 65 chars / >1 MiB | same, naming the bound | the bound field | nothing |
| D-13 | Executable content smuggled (a `command`, `path`, `model`, `script`, or free-form `instruction` member) | rejected by the validator / absent from the type | the offending member | nothing |
| D-14 | A fully valid declaration (control) | accepted | — | registered exactly once |
| D-15 | No `scopeKey` member at all | `ceremony.declaration.invalid` | `scopeKey` | nothing |
| D-16 | `scopeKey: { kind: "note" }` on a declaration whose `note.required` is `false` | same | `scopeKey` | nothing |
| D-17 | `scopeKey: { kind: "literal", value: "Repo Key" }` (not a kebab-case token) | same | `scopeKey` | nothing |
| D-18 | Two `schedule` triggers (`daily` + `weekly`) in one declaration | same | `triggers[]` | nothing |

D-15..D-18 are the `scopeKey`/trigger half of the corpus (E-19, AC-F2-4); D-14 is their paired accepting control, and D-12 carries the 9-trigger count case. The at-limit trigger fixture is discussed in TC-CEREMONY-009 (OQ-T7).

### 4.7 Resume and Verification Matrix (binding for AC-F4-1..4, NFR-4)

| ID | Recorded state / injected defect | Expected outcome | Exit | Never |
|---|---|---|---|---|
| R-01 | Run interrupted after step *k* (steps 1..*k* verified) | `resume` starts at *k+1*; no verified index re-appended or re-rendered | 0 | Re-executing 1..*k* |
| R-02 | Interrupted after *k*; step *k+1* fails again | re-attempt appends a second record for *k+1* only; run `unverified` | 1 | Rewriting the first *k+1* record |
| R-03 | Missing middle step record | `state.store.torn` | 2 | Guessing the missing step |
| R-04 | Step record for an undeclared index | `state.store.torn` | 2 | Ignoring it |
| R-05 | Two records for one index | `state.store.torn` | 2 | Picking one |
| R-06 | Artifact mutated between write and read-back | step `unverified`; no later step executes; records + artifact durable | 1 | Retrying the same step; a green run |
| R-07 | Two declared phase boundaries | carried summary ≤4 096 bytes and ≤40 lines at each boundary | 0 | Delivering per-step working detail |
| R-08 | Summary that would exceed the bound | truncated with an explicit omitted count | 0 | Silent truncation |

### 4.8 Gate Mapping (which suite runs under which gate)

`pnpm check` is the single entry point; no ceremony suite runs outside it. The mapping below is the contract for TC-CEREMONY-058.

| Gate component (in `pnpm check` order) | Command it runs | Ceremony suites it carries |
|---|---|---|
| `lint` | `biome lint .` | All ceremony sources and tests (style) |
| `format:check` | `biome format .` | All ceremony sources and tests (format) |
| `typecheck` | `pnpm -r typecheck` + `tsc -p tests/types` | Ceremony contract types; `tests/types/**` additions |
| `test` | `bun test` (with `pretest` → `pnpm build`) | `tests/structure/ceremony-*`, `tests/behaviour/ceremony-*`, `tests/golden/ceremony-*`, `tests/checks/ceremony-*`, and the delivered suites asserted unchanged. Includes `tests/checks/error-table-sync.test.ts` (invokes `runSyncCheck`), `exit-code-literals.test.ts`, `help-guide-coverage.test.ts`, `doc-conformance.test.ts`, `fixture-privacy.test.ts` |
| `check:boundaries` | `depcruise packages` → `scripts/checks/ambient-globals.ts` → `workspace-entrypoints.ts` → `secret-read-boundary.ts` | TC-CEREMONY-050 (import/purity half), TC-057 (package/subpath boundaries) |
| `check:memory` | `scripts/checks/memory-lint.ts` | TC-CEREMONY-057 (memory tree untouched) |
| prompt conformance | `scripts/checks/prompt-conformance.ts` | TC-CEREMONY-001 (prompt-required set), TC-057 (no retired/raw-git literals) |
| help/guide coverage | `scripts/checks/help-guide-coverage.ts` | TC-CEREMONY-001, TC-060 |
| exports parity | `scripts/checks/exports-parity.ts` | TC-CEREMONY-057 (no new package/subpath) |

The exact command to run the whole gate from the repository root:

```bash
TMPDIR=$PWD/tmp/tmpdir pnpm check
```

Narrow iterations use the layer command from §4 (`bun test tests/<layer>/...`); a narrow run never substitutes for the aggregate gate before the PR (NFR-14, C-9, GAP-5).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-CEREMONY-001 | Family mounted: root/family help, reference page, coverage inventory, prompt-set count | Happy Path | Structure/CLI | High | AC-F1-1 |
| TC-CEREMONY-002 | Grammar refusals resolve through `fallback.invocation` before any read/write | Negative | CLI | Critical | AC-F1-3, NFR-1 |
| TC-CEREMONY-003 | Undeclared ceremony name refused, nothing produced | Negative | CLI/Behaviour | Critical | AC-F1-2 |
| TC-CEREMONY-004 | Envelope and exit continuity across every outcome class | Regression | CLI/Golden | Critical | AC-F1-3, NFR-1 |
| TC-CEREMONY-005 | `--apply` is accepted-and-inert on a ceremony with no `sync` step | Edge Case | Behaviour | Important | AC-F1-4 |
| TC-CEREMONY-006 | `ceremony list` content, bounded render, and read cost | Happy Path | Behaviour | High | NFR-11, AC-F1-1 |
| TC-CEREMONY-007 | All six built-ins validate: total, closed, fully verified | Happy Path | Structure/Contract | Critical | AC-F2-1, NFR-3 |
| TC-CEREMONY-008 | Declaration defect corpus refusals (D-01..D-11) | Negative | Unit/Behaviour | Critical | AC-F2-2, DM-9 |
| TC-CEREMONY-009 | Declaration bound overruns refused naming the bound (incl. the 8/9-trigger rung) | Negative | Unit/Contract | High | AC-F2-3, NFR-7 |
| TC-CEREMONY-010 | No executable content: declarations are data only | Regression | Structure | Critical | AC-F2-1, AC-F2-2 |
| TC-CEREMONY-011 | Parametric parity suite over the six built-ins, one runner path | Happy Path | Behaviour/Structure | Critical | AC-F3-1 |
| TC-CEREMONY-012 | Per-built-in negative case: verification is not cosmetic | Negative | Behaviour | Critical | AC-F3-1, AC-F4-1 |
| TC-CEREMONY-013 | Morning brief artifact conforms to `delivery.brief.v1` | Happy Path | Behaviour/Golden | Critical | AC-F3-2 |
| TC-CEREMONY-014 | Retro evidence pass at four levels: per-level note + declared trigger + explicit-run resolution | Happy Path | Behaviour | Critical | AC-F3-3, AC-F3-8 |
| TC-CEREMONY-015 | Testing-session assessment: one verdict per item, zero unassessed | Happy Path | Behaviour | High | AC-F3-4 |
| TC-CEREMONY-016 | Mirror sync equality, then drift → `unverified` naming the target | Happy Path + Negative | Integration | Critical | AC-F3-5, AC-NFR12-1 |
| TC-CEREMONY-017 | Night-watch on a quiet window: exact checks, verified-empty | Corner Case | Behaviour | High | AC-F3-6 |
| TC-CEREMONY-018 | Sprint rollover carry-over: ref, closed-set reason, next milestone | Happy Path | Behaviour | High | AC-F3-7 |
| TC-CEREMONY-019 | Degradation is data: unavailable collector still conforms and verifies | Edge Case | Behaviour | Critical | AC-F3-1, NFR-3 |
| TC-CEREMONY-020 | Artifact verification failure stops the agenda, records stay durable | Negative | Behaviour | Critical | AC-F4-1 |
| TC-CEREMONY-021 | Resume after step *k* never re-executes a verified step | Happy Path | Behaviour | Critical | AC-F4-2, NFR-4 |
| TC-CEREMONY-022 | Contradicted run records refuse `state.store.torn`, zero writes | Negative | State/Behaviour | Critical | AC-F4-3, NFR-4 |
| TC-CEREMONY-023 | Compaction at declared boundaries with explicit truncation marker | Corner Case | Behaviour | High | AC-F4-4, NFR-7 |
| TC-CEREMONY-024 | Dry-run default for `sync`: computed, precondition-checked, nothing landed | Happy Path | Behaviour | Critical | AC-F4-5, NFR-12 |
| TC-CEREMONY-025 | Idempotent re-run returns `data.reused: true` with zero appends | Corner Case | Behaviour | Critical | AC-F4-6, NFR-5 |
| TC-CEREMONY-026 | Catch-up replays one missed window exactly once | Happy Path | Behaviour | Critical | AC-F5-1, NFR-6 |
| TC-CEREMONY-027 | Catch-up with nothing missed appends zero and exits 0 | Corner Case | Behaviour | High | AC-F5-2, NFR-6 |
| TC-CEREMONY-028 | `catchUp.mode: "none"` reports a declared gap with no run | Edge Case | Behaviour | High | AC-F5-3 |
| TC-CEREMONY-029 | Catch-up matrix: zero/one/many/event/removed-declaration | Corner Case | Behaviour | High | NFR-6, AC-F5-1 |
| TC-CEREMONY-030 | Project-declared ceremony runs through the same runner, zero tooling change | Happy Path | Integration | Critical | AC-F6-1 |
| TC-CEREMONY-031 | Unparseable declaration document refuses `config.file.malformed` pre-run | Negative | Behaviour | Critical | AC-F6-2 |
| TC-CEREMONY-032 | Empty declaration document is identical to an absent document | Edge Case | Behaviour | Medium | AC-F6-3 |
| TC-CEREMONY-033 | Tier agreement: pinned `lite` set element for element, source named | Happy Path | Unit/Contract | Critical | AC-F7-1, AC-NFR9-1 |
| TC-CEREMONY-034 | Tier disagreement: variant governs, `tier-mismatch` finding, delivery unaffected | Negative | Unit/Behaviour | Critical | AC-F7-2 |
| TC-CEREMONY-035 | Escalation matrix: five triggers, evidence-gated, recorded with evidence | Happy Path | Unit/Behaviour | Critical | AC-F7-3 |
| TC-CEREMONY-036 | Trigger outside the vocabulary reported verbatim as `unevaluated` | Negative | Unit/Behaviour | High | AC-F7-4 |
| TC-CEREMONY-037 | Plan `tier.phases` canonical subset and `unresolved-phase` findings | Edge Case | Unit/Behaviour | High | AC-F7-1, AC-NFR9-1 |
| TC-CEREMONY-038 | Tiered intake obligation; explicit non-obligated run still executes | Corner Case | Behaviour | High | AC-F7-5 |
| TC-CEREMONY-039 | Note intake contract: absent, missing member, mismatch, window disagreement | Negative | Behaviour | Critical | AC-F9-1, DM-2 |
| TC-CEREMONY-040 | Run and step records: durability, folds, complete measurement | Happy Path | State/Behaviour | Critical | AC-F8-1, NFR-10 |
| TC-CEREMONY-041 | Comparison record completeness; before equals the committed baseline | Happy Path | Behaviour/Golden | Critical | AC-F8-2 |
| TC-CEREMONY-042 | Below the sample minimum: `insufficient-sample`, no trend anywhere | Edge Case | Behaviour/Checks | Critical | AC-F8-3, NFR-10 |
| TC-CEREMONY-043 | Follow-through verification is the first phase, evidence-cited | Happy Path | Behaviour/Structure | Critical | AC-F9-3 |
| TC-CEREMONY-044 | Rerun at a new window appends an addendum, never rewrites | Corner Case | Behaviour | Critical | AC-F9-4, NFR-5 |
| TC-CEREMONY-045 | Null retro is a success with an explicit empty finding set | Edge Case | Behaviour | High | AC-F9-5 |
| TC-CEREMONY-046 | Evidence step is a read-only pipeline fold; no retro writes | Regression | Behaviour/Integration | Critical | AC-F9-6 |
| TC-CEREMONY-047 | **SC-M2-S3-02**: missing `scopeKey` refused naming `scopeKey`, zero output | Negative | Behaviour | Critical | AC-F9-1 |
| TC-CEREMONY-048 | **SC-M2-S3-01**: conforming note → declared outputs + follow-through section | Happy Path | Behaviour | Critical | AC-F9-2 |
| TC-CEREMONY-049 | Error identities, two-way sync, allowlist and count binding | Regression | Structure/Checks | Critical | AC-NFR8-1 |
| TC-CEREMONY-050 | Structural purity: no model/network/ambient in ceremony paths + failing mutation | Regression | Structure/Checks | Critical | AC-NFR2-1, NFR-2 |
| TC-CEREMONY-051 | Tier neutrality: two sources, no extra vocabulary, no default set | Regression | Structure/Checks | Critical | AC-NFR9-1 |
| TC-CEREMONY-052 | Mirror-sync safety: target bound, undeclared target untouched, no force path | Negative | Behaviour/Structure | Critical | AC-NFR12-1, AC-F3-5 |
| TC-CEREMONY-053 | Byte-identical determinism and bounded output; zero model calls | Regression | Behaviour/Golden | High | NFR-2, NFR-7 |
| TC-CEREMONY-054 | Record/artifact/declaration byte bounds measured at and above limits | Corner Case | Behaviour | High | NFR-7 |
| TC-CEREMONY-055 | Read/run cost and duration budgets; no retries/child/network | Performance | Behaviour/Checks | Medium | NFR-11, NFR-13 |
| TC-CEREMONY-056 | Hermetic posture across all ceremony suites; a skip never passes | Regression | Checks | Critical | NFR-11, NFR-2 |
| TC-CEREMONY-057 | Delivered surfaces unchanged; excluded surfaces absent | Regression | Behaviour/Structure | Critical | AC-F9-6, AC-NFR14-1 |
| TC-CEREMONY-058 | Aggregate gate regression on the delivering change | Regression | Aggregate | Critical | AC-NFR14-1 |
| TC-CEREMONY-059 | Commit and PR hygiene for the delivering change | Manual/Evidence | Process | High | AC-NFR14-1, NFR-14 |
| TC-CEREMONY-060 | Documentation deltas, distribution marker, content inventory | Regression | Checks/Content | High | AC-F1-1 |
| TC-CEREMONY-061 | `scopeKey` derivation set, `note`-legality and single-schedule bound: refusals naming `scopeKey`/`triggers[]` | Negative | Unit/Contract | Critical | AC-F2-4, AC-F2-1, DM-1, DM-2 |
| TC-CEREMONY-062 | Explicit-run trigger recording: `kind: explicit` with resolution `note`/`declaration`/`unspecified`, never an obligation | Happy Path + Negative | Behaviour | Critical | AC-F3-8, DM-3 |
| TC-CEREMONY-063 | Note-less scheduled `morning-brief` twice in one UTC day: derived day window, `repository` key, `data.reused: true`, zero appends | Corner Case | Behaviour | Critical | AC-F4-7, AC-F4-6, NFR-5 |
| TC-CEREMONY-064 | Note-less event-triggered run without `--window`: refused naming `--window`, zero records/artifacts; with `--window` the identity is complete | Negative | Behaviour | Critical | AC-F4-8, NFR-5 |

### 5.2 Scenario Details

#### TC-CEREMONY-001 - Family mounted and advertised

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-14, DEC-10, C-6, DoD-1
**Test Type(s)**: Structure, Contract, CLI
**Automation Level**: Automated
**Target Layer / Location**: `packages/cli/src/help/prompt-required-commands.ts`, `tests/fixtures/help-guide/coverage.json`, `doc/planning/oss-tooling/milestones/m2/commands/ceremony.md`; `tests/checks/help-guide-coverage.test.ts` (update), `tests/structure/entrypoint-*.test.ts` (update)
**Tags**: @offline, @ceremony, @mounting

**Preconditions**:

- The composed binary is built (`pretest` builds), and the reference page exists at the M2 command page root.

**Steps**:

1. Run `<binary> --help` and `ceremony --help` with the composed program; assert exit 0.
2. Assert the root listing names `ceremony` and that the family page documents exactly the four verbs `list`, `run`, `resume`, `catch-up`, with usage, options, at least one example, exit codes, and a see-also pointer.
3. Assert `PROMPT_REQUIRED_COMMANDS` contains `ceremony` exactly once and the prompt-set count assertion moved from twenty to twenty-one.
4. Assert `runHelpGuideCoverage()` returns `[]` and the coverage inventory names `ceremony` with the M2 reference page.
5. Assert every verb page includes `--help` and `--version` per the coverage check.

**Expected Outcome**:

- The family is reachable, advertised, documented, and inventoried; a family reachable only by accident cannot pass. A removed inventory row or a missing page is reported by name (paired negative control via the existing mutants suite).

**Postconditions**:

- No state read, no network, no git read performed by help/version.

#### TC-CEREMONY-002 - Grammar refusals before any read or write

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-1, C-1
**Test Type(s)**: CLI
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-cli.test.ts`
**Tags**: @offline, @ceremony, @grammar

**Preconditions**:

- A recording declaration-reader and recording state port are injected; every read/write call is recorded.
- A valid built-in declaration exists as a paired control.

**Steps**:

1. Invoke each malformed form: `ceremony` (missing verb), `ceremony watch` (unknown verb), `ceremony run morning-brief extra` (unexpected positional), `ceremony run morning-brief --unknown` (unknown flag), `ceremony run morning-brief --note` (missing flag value).
2. Assert `error.code == "fallback.invocation"` and exit 1 for each.
3. Assert the recorded reader and state calls are empty.
4. Run the accepted control (`ceremony run morning-brief`) and assert it performs the declared reads.

**Expected Outcome**:

- Every grammar refusal resolves through the delivered containment identity at exit 1 before any read or write; one envelope is emitted per invocation; a refusal never produces a run record, step record, or artifact.

#### TC-CEREMONY-003 - Undeclared ceremony name refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-3
**Test Type(s)**: CLI, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-cli.test.ts`
**Tags**: @offline, @ceremony, @intake

**Preconditions**:

- Built-ins registered; a recording state port; no project document.

**Steps**:

1. Run `ceremony run no-such-ceremony --json`.
2. Assert `error.code == "input.value.rejected"`, exit 1, and that the message/data names both the requested name and the declared set.
3. Assert zero run records, zero step records, zero artifacts in the temp root.

**Expected Outcome**:

- A typo is refused distinctly from an invalid declaration; the declared set is discoverable from the refusal (unlike a silent no-op).

#### TC-CEREMONY-004 - Envelope and exit continuity

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-1, C-1, C-2
**Test Type(s)**: CLI, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/ceremony-envelope.test.ts`, `tests/structure/envelope-contract.test.ts` (update)
**Tags**: @offline, @ceremony, @envelope

**Preconditions**:

- A golden set spanning one case per outcome class from §4.3 (verified, dry-run, unverified, nothing-missed, declared gap, each refusal, torn state, tier finding).

**Steps**:

1. Capture each invocation's stdout under `--json`.
2. Assert exactly one JSON document per invocation with exactly the five delivered keys and the outcome under `data` XOR `error`.
3. Assert exit ∈ `{0, 1, 2}` and that each golden's exit matches its projection class from §4.3.
4. Assert no `ok` key, no `command` key, and no new top-level key appears; every ceremony-specific field is under `data`.
5. Assert an `error.detail` member was not added.

**Expected Outcome**:

- The envelope shape and exit projection are unchanged for the new family; findings (`tier-mismatch`, `unresolved-phase`, `unevaluated-trigger`) are data, not errors; `unverified` is data-bearing at exit 1.

#### TC-CEREMONY-005 - `--apply` inert without a `sync` step

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-4, DEC-12
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @flags

**Preconditions**:

- A built-in declaration with no `sync` step (e.g. `morning-brief`) and a recording artifact writer.

**Steps**:

1. Run the ceremony with `--apply`, then without, over identical injected inputs, clock, and ids.
2. Compare verdict, `data` payload (excluding nothing — the payload must be identical), and artifact bytes.
3. Assert both exits are 0.

**Expected Outcome**:

- Identical verdict and byte-identical artifacts; `--apply` is accepted and inert so the family stays scriptable with one invocation shape. A differing verdict for an unused flag fails.

#### TC-CEREMONY-006 - `ceremony list` content and cost

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, NFR-11, AC-F1-1, §10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-list.test.ts`
**Tags**: @offline, @ceremony, @list

**Preconditions**:

- Built-ins plus one project declaration; seeded last-run records for two ceremonies; recording seams.

**Steps**:

1. Run `ceremony list --json`.
2. Assert one row per declared ceremony carrying `id`, `origin` (`built-in` | `project`), tier applicability, declared trigger, declared catch-up mode, and last-run summary (absent → explicit none, never a fabricated run).
3. Assert the recorded declaration read count is 1 and the verified state read count is ≤2.
4. Assert the human render is one line per ceremony, ≤32 lines and ≤6 144 bytes, with an explicit omission marker when truncated, and byte-identical on a repeat run with the same inputs.

**Expected Outcome**:

- The list is a bounded, deterministic projection of declarations plus recorded runs, with no run executed and no write performed.

#### TC-CEREMONY-007 - Built-ins are total, closed and fully verified

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1, NFR-3, RSK-1
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/ceremony-contract.test.ts`
**Tags**: @offline, @ceremony, @contract

**Preconditions**:

- Production built-in declaration data is importable from the core contract module.

**Steps**:

1. Import the production built-in set and the declaration validator.
2. Assert exactly six built-ins with the expected ids.
3. Validate each through the same validator used for project declarations; assert `valid`.
4. For every step of every built-in, assert a `verify` mode from the closed verification vocabulary; for every output, assert a declared slot and a schema identifier.
5. Assert every vocabulary name used anywhere in the six declarations is a member of a declared vocabulary set (imported, not re-typed).
6. Assert no member carries executable content (see TC-CEREMONY-010).

**Expected Outcome**:

- 100 % step verification coverage and 100 % output schema coverage across the built-ins; the built-ins get no privileged validator path.

#### TC-CEREMONY-008 - Declaration defect corpus refusals

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-6, AC-F2-2, DM-9
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-declaration.test.ts`; fixtures `tests/fixtures/ceremony/declarations/`
**Tags**: @offline, @ceremony, @refusal

**Preconditions**:

- The committed defect corpus with one fixture per row D-01..D-13 and one valid control D-14, plus the committed expectation table naming code and field.

**Steps**:

1. Load each fixture through the production declaration load path.
2. Assert `ceremony.declaration.invalid`, exit 1, and that the error names the ceremony id and the exact offending field from the expectation table.
3. Assert the registration set is unchanged after each refusal (zero partial registration).
4. For D-11 (built-in collision), assert the built-in declaration is still effective and listable after the refusal.
5. For D-14, assert the declaration validates and registers exactly once (non-vacuity control).

**Expected Outcome**:

- Every defect is refused with the same identity, naming id and field; nothing registers; a project can add but never redefine a built-in; the control proves the corpus is not refusing everything.

#### TC-CEREMONY-009 - Declaration bounds refused naming the bound

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, NFR-3, NFR-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-declaration-bounds.test.ts`
**Tags**: @offline, @ceremony, @bounds

**Preconditions**:

- Generated fixtures at and one over each bound: 16/17 ceremonies, 12/13 phases, 32/33 steps, 16/17 inputs, 8/9 targets, 8/9 triggers, 1 MiB/1 MiB+1 byte, id 64/65 characters.
- The 8-trigger at-limit fixture repeats one declared event name to reach eight, because the closed event set has six members and only one `schedule` trigger is legal, so seven unique triggers is the vocabulary maximum (OQ-T7). The case exercises the count guard; whether a repeated trigger name is itself a vocabulary defect is a delivery-time contract-constant decision (GAP-2) and does not weaken the over-limit rung.

**Steps**:

1. Assert each at-limit fixture validates.
2. Assert each over-limit fixture refuses `ceremony.declaration.invalid` naming the exceeded bound — including 9 triggers refused naming `triggers[]`.
3. Assert the measured byte length of the at-limit document and a positive measured length before the over-limit assertion.
4. Assert a declaration that is at-limit on every count validates once (a single combined at-limit fixture), so the ladder cannot pass by each rung being independently impossible.

**Expected Outcome**:

- Bounds are exactly enforced at their declared values, including the `triggers[]` 1..8 count, and nothing is silently truncated; at-limit acceptance proves the bound is not off by one in the safe direction.

#### TC-CEREMONY-010 - Declarations are data only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-2, RSK-2, §21
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/ceremony-contract.test.ts`, `tests/structure/ceremony-imports.test.ts`
**Tags**: @offline, @ceremony, @security

**Preconditions**:

- The declaration type and the validator are importable; fixtures smuggling `command`, `path`, `model`, `script`, and free-form `instruction` members exist.

**Steps**:

1. Assert the declaration type exposes no executable member and the validator's accepted key set equals the declared member set.
2. Feed the smuggling fixtures; assert each is refused and names the offending member (or is structurally impossible to construct).
3. Assert no ceremony module imports a process-spawn, shell, or model client module (AST/import scan).
4. Assert a mutation adding an execution member to a temp copy of the contract module is detected by the structural assertion.

**Expected Outcome**:

- "A project declares its own ceremony" cannot become "a project ships code": the vocabulary is the only capability surface, and a mutation that widens it fails.

#### TC-CEREMONY-011 - Parametric parity suite over the six built-ins

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, NFR-3, DoD-3
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-parity.test.ts`, `tests/structure/ceremony-parity-invariants.test.ts`
**Tags**: @offline, @ceremony, @parity

**Preconditions**:

- Synthetic injected inputs satisfying each built-in's declared inputs; a recording artifact writer per slot; deterministic clock and ids.
- A single fixture row per built-in (six rows), no per-ceremony suite function.

**Steps**:

1. Iterate the six production declarations in one loop; execute each through the public runner entry point.
2. For each, assert the observed executed step sequence equals the declared agenda order, phase for phase and step for step.
3. Assert the observed output set equals the declared output set, each read back from its declared slot.
4. Assert the verification mode applied equals the declared mode, and the run verdict is `verified` at exit 0.
5. Assert the recorded entry point, dispatcher, artifact reader, verifier, and record writer instances are the same single implementation for all six (a shared spy/identity probe).
6. Assert no declaration names a distinct verb or code path.

**Expected Outcome**:

- Six of six pass through one path; adding a built-in adds a declaration and a fixture row, never a suite. A mutation adding a per-ceremony branch fails the structural half.

#### TC-CEREMONY-012 - Verification is not cosmetic

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, AC-F4-1, NFR-3, Appendix E
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-parity.test.ts`
**Tags**: @offline, @ceremony, @negative

**Preconditions**:

- One artefact-mutating fault per built-in, applied *after* the step writes and *before* read-back (e.g. remove a required section, drop an item verdict, add an extra mirror member).

**Steps**:

1. Run each built-in with its mutation and a paired clean control in the same test.
2. Assert the mutated step is `unverified`, no later step executes, the run verdict is `unverified`, exit 1, and the failing step is named.
3. Assert the clean control is `verified` at exit 0.

**Expected Outcome**:

- A green parity run cannot be vacuous: every built-in has at least one declared verification that actually refuses a bad artifact.

#### TC-CEREMONY-013 - Morning brief artifact conformance

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-2, [feature-brief.md]
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-brief.test.ts`, `tests/golden/ceremony-brief.test.ts`
**Tags**: @offline, @ceremony, @brief

**Preconditions**:

- Status-collector facts fixture, brief projection fixture, spend citation fixture, open-question fixture, provider-park fixture; deterministic clock and ids.

**Steps**:

1. Run `morning-brief` through the runner with the injected inputs.
2. Read the artifact back from the `ceremony-artifact` slot as bytes and parse it against `delivery.brief.v1`.
3. Assert all ten surfaces and three anchor groups are present, and every placeholder is a member of the closed placeholder catalog.
4. Assert the artifact is ≤65 536 bytes serialized and the run exits 0 with verdict `verified`.

**Expected Outcome**:

- The brief is rendered by `render` + `record` steps only (no model call), conforms to the delivered brief contract, and reuses the delivered projection rather than duplicating brief logic.

#### TC-CEREMONY-014 - Retro evidence pass at four levels

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-9, AC-F3-3, AC-F3-8, DEC-17, E-20
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-retro-levels.test.ts`
**Tags**: @offline, @ceremony, @retro

**Preconditions**:

- Seeded verified retro evidence and `retro.run` records for each level's scope; one conforming note per level; injected clock.
- The production retro declaration's `triggers[]` under assertion, and a note whose `trigger` member names `change-merged`.

**Steps**:

1. For each of `session`, `incident`, `window`, `project`, run the retro evidence pass with that level's note.
2. Assert the produced note is the level's declared per-level output (session: evidence refs, self-error audit, near-miss captures, candidate lessons; incident: blameless system findings with the three attribution axes; window: cross-change patterns, follow-through verification, candidate promotions; project: consolidation candidates, graduation, recurrence report).
3. Assert the declaration declares exactly the four sub-R1 level triggers (`session-end`, `incident-severity`, `daily`, `milestone-end`) and no fifth trigger — in particular no `change-merged` — with exactly one `schedule` trigger in the set, and that each manual level run records `trigger.kind: "explicit"` with `resolution: "note"`, the recorded declared trigger being the note's `trigger` member and equal to that level's declared trigger (DEC-17).
4. Assert `change`/R1 is not produced by this declaration (closeout owns it).
5. Assert a level with no pre-declared trigger yields `undeclared-trigger`, not an invented trigger.
6. Assert the note naming `change-merged` is refused as `input.value.rejected` naming the note's trigger and the declared set, at exit `1`, with zero run records, zero step records, and nothing written to the memory slot.

**Expected Outcome**:

- Four of four levels carry a declared trigger and a per-level output; the declaration's trigger set is exactly the four it serves, so no firing of it can lack a level; a manual level run is recorded as `explicit`/`note` and never as a scheduled or event firing; an undeclared trigger is a recorded finding, never fabricated, and a note naming an undeclared trigger is refused before anything is written.

**Notes / Clarifications**:

- **v1.1 change** — only step 3 changed. v1.0 asserted that "the run record's trigger equals the level's declared trigger", which the recorded-trigger rule (DEC-17, AC-F3-8) made ambiguous for an operator invocation: an operator run has no firing, so its recorded kind is `explicit` and its resolution names the level's trigger through the note. The new step 6 (the `change-merged` note refusal) closes the other half of the same spec change. Steps 4 and 5 are unchanged from v1.0 — the R1-absence assertion stays step 4 verbatim.

#### TC-CEREMONY-015 - Testing-session assessment verdict completeness

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, DM-1, AC-F3-4, E-16
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-assessment.test.ts`
**Tags**: @offline, @ceremony, @assess

**Preconditions**:

- An owner note with several items: one with cited evidence that is covered, one partial, one uncovered, one not-applicable, and one citing **no** evidence.

**Steps**:

1. Run `testing-session-assessment`.
2. Parse the assessment artifact; assert every note item appears exactly once.
3. Assert each item carries exactly one verdict from `covered`, `partial`, `uncovered`, `not-applicable`, and the unassessed count is zero.
4. Assert the no-evidence item is `uncovered` with the missing citation named.
5. Assert the `artifact-covers-items` verification passes because every item carries a verdict — including the uncovered one.

**Expected Outcome**:

- "Every item got a verdict" and "no item was silently covered" are both true; a missing citation can never read as `covered`.

#### TC-CEREMONY-016 - Mirror sync equality and drift

**Scenario Type**: Happy Path + Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, NFR-12, AC-F3-5, AC-NFR12-1, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-mirror.test.ts`; `tests/fixtures/closeout/temp-git.ts`
**Tags**: @offline, @ceremony, @mirror, @temp-git

**Preconditions**:

- Two isolated temp git repositories declared as affected targets, clean and on their declared base; a decision-register projection fixture.

**Steps**:

1. Run `decision-record-mirror-sync --apply`.
2. Assert one idempotent mirror commit per target through the delivered commit primitive.
3. Assert each target's mirrored decision-record set equals the register set for that repository — no extra, no missing — via `artifact-equals-source`.
4. Assert verdict `verified` and exit 0.
5. Mutate one target afterwards (add an extra mirrored record and, separately, delete one); re-run; assert `unverified` at exit 1 naming the target and the direction of the difference.
6. Assert the other target is still reported per target.

**Expected Outcome**:

- Equality is symmetric (extra and missing both fail); drift is data-bearing at exit 1 with the target named; no live repository is touched.

#### TC-CEREMONY-017 - Night-watch verified-empty discipline

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-night-watch.test.ts`
**Tags**: @offline, @ceremony, @night-watch

**Preconditions**:

- A quiet overnight window: audit ledger, telemetry, lane/queue, and gate facts all clean; a declared check set.

**Steps**:

1. Run `night-watch`.
2. Assert every declared check appears exactly once in the report.
3. Assert each clean area is an explicit verified-empty marker (not an omitted line, not a zero claim).
4. Assert a paired noisy fixture with one anomaly renders that anomaly with its evidence reference.

**Expected Outcome**:

- "Nothing happened" is distinguishable from "the report is incomplete"; absence of findings never collapses into an empty report.

#### TC-CEREMONY-018 - Sprint rollover carry-over discipline

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-rollover.test.ts`
**Tags**: @offline, @ceremony, @rollover

**Preconditions**:

- Queue state with three carry-over items and one landed item; tracker milestone state; committed metric rows.

**Steps**:

1. Run `sprint-rollover`.
2. Assert the carry-over set contains exactly the three open items, each naming its ref, a reason from the closed reason set, and its next milestone.
3. Assert the landed item is not in the carry-over set.
4. Assert a fixture whose reason is outside the closed set fails verification (paired negative).

**Expected Outcome**:

- Every carry-over entry is attributable and dispositioned from a closed vocabulary; an unknown reason cannot verify.

#### TC-CEREMONY-019 - Degradation renders as data

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, E-7, AC-F3-1, NFR-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @degradation

**Preconditions**:

- One declared collector returns a classified unavailable result (state + reason); all other collectors return clean fixture facts.

**Steps**:

1. Run a built-in whose render depends on that collector.
2. Assert the artifact contains that surface's declared degradation (state plus reason), and does not contain a zero, an empty claim, or an omitted section.
3. Assert the artifact still conforms to its declared schema and the step still `verified`; the run exits 0.
4. Assert the paired all-clean fixture renders the same schema with no degradation marker.

**Expected Outcome**:

- A quiet or degraded world never fails a run and never becomes a false clean claim; degradation is carried as data.

#### TC-CEREMONY-020 - Artifact verification failure halts and stays durable

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-3, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @verification

**Preconditions**:

- A three-step declaration whose second step's artifact is mutated after write and before read-back.

**Steps**:

1. Run the declaration.
2. Assert step 2 is `unverified` and step 3 did not execute (zero step record for index 3).
3. Assert the run verdict is `unverified` at exit 1 and the failing step is named.
4. Assert the run record, both step records, and the produced artifact are present and readable in the temp store after the failure.
5. Assert no error-table identity was emitted (DEC-5).

**Expected Outcome**:

- Verification is load-bearing and failure is inspectable; the failure is a verdict, not a crash and not an error row.

#### TC-CEREMONY-021 - Resume from the first unverified step

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-4, Appendix E
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-resume.test.ts`
**Tags**: @offline, @ceremony, @resume

**Preconditions**:

- A crash fixture that halts the runner after step *k* of *n* (steps 1..*k* verified), composing the production append path; a recording renderer.

**Steps**:

1. Capture the pre-crash record set and the render call log.
2. Call `ceremony resume <runId>`.
3. Assert the first executed index is *k+1*.
4. Assert no index in 1..*k* gained a new step record and no verified step was re-rendered.
5. Assert the run completes `verified` at exit 0, and total step records ≤ *n* + re-attempts of the failed step.

**Expected Outcome**:

- Resume never redoes work; the record set is a monotone extension of the pre-crash set. The record-count assertion is asserted against the hand-computed bound, not against the production fold.

#### TC-CEREMONY-022 - Contradicted run records refuse `state.store.torn`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, NFR-4, C-3
**Test Type(s)**: State, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-state-boundary.test.ts`
**Tags**: @offline, @ceremony, @state

**Preconditions**:

- Three seeded stores (R-03, R-04, R-05) built by writing through the production append path then removing/duplicating records at the ledger level; a healthy paired store.

**Steps**:

1. Invoke `ceremony resume` against each contradicted store.
2. Assert `state.store.torn` at exit 2 and that the state path/position is named without payload bytes.
3. Assert the store bytes and record count are unchanged (zero writes).
4. Assert the healthy control resumes and writes.

**Expected Outcome**:

- The runner classifies and refuses; it never repairs, reorders, or guesses. Damage is never re-projected as `unverified` or as success.

#### TC-CEREMONY-023 - Compaction bounds and explicit omission

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-4, NFR-7, DEC-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @compaction

**Preconditions**:

- A three-phase declaration with very large step outputs, plus a small-output control.

**Steps**:

1. Run the declaration and capture the carried summary handed to each following phase through a recording seam.
2. Assert both boundaries hand over a summary ≤4 096 bytes and ≤40 lines (measured).
3. Assert the small-output control is untruncated (non-vacuity).
4. Assert the over-bound summary carries an explicit omitted count and never a silent cut.

**Expected Outcome**:

- Bounded carried state with an auditable omission marker; per-step working detail is released to durable records, not carried.

#### TC-CEREMONY-024 - Dry-run default for `sync`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F4-5, NFR-12, DEC-12
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-mirror.test.ts`
**Tags**: @offline, @ceremony, @dry-run

**Preconditions**:

- `decision-record-mirror-sync` with two temp targets; a recording commit/write seam; one target deliberately dirty and one absent.

**Steps**:

1. Run without `--apply`.
2. Assert verdict `dry-run` at exit 0, and that the declared write set and precondition checks were computed and recorded.
3. Assert the commit/write seam recorded zero landing calls on every target and the targets' bytes are unchanged.
4. Run with `--apply` on a clean pair and assert landing occurred (paired control).

**Expected Outcome**:

- Dry-run is the default for real side effects; `--apply` is the only landing path; a dry run is a first-class verdict, not a suppressed failure.

#### TC-CEREMONY-025 - Idempotent re-run

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-6, NFR-5, E-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @idempotency

**Preconditions**:

- A note-consuming ceremony; one recorded successful run for `(ceremony, scopeKey, window)`; a recording store.

**Steps**:

1. Capture the record set and note body bytes after the first run.
2. Invoke the identical run again.
3. Assert the recorded verdict is returned with `data.reused: true` and exit 0.
4. Assert zero run records and zero step records were appended and the note body is byte-identical.
5. Assert a run at a *new* window with the same scope key is a new identity: exactly one new run record and an addendum appended (paired with TC-CEREMONY-044).

**Expected Outcome**:

- Idempotency is keyed, not inferred; a re-run cannot duplicate records or rewrite a note.

#### TC-CEREMONY-026 - Catch-up replays one missed window exactly once

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-5, NFR-6, CU-01/CU-02
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-catch-up.test.ts`
**Tags**: @offline, @ceremony, @catch-up

**Preconditions**:

- A `daily` declaration with a fixed clock and exactly one recorded run for an earlier window, leaving one missed window.

**Steps**:

1. Run `ceremony catch-up`.
2. Assert exactly one run executes, labelled `trigger.kind: "catch-up"` with the missed window bounds.
3. Assert the run record carries both the missed window and the execution window.
4. Run `catch-up` again; assert zero appends and the window reported as already caught up / `nothing-missed`.

**Expected Outcome**:

- A missed ritual is distinguishable from a quiet one and is replayed exactly once; the second invocation is a no-op success.

#### TC-CEREMONY-027 - Nothing missed

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-6, CU-03
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-catch-up.test.ts`
**Tags**: @offline, @ceremony, @catch-up

**Preconditions**:

- Every eligible schedule recorded as current for the injected clock.

**Steps**:

1. Run `ceremony catch-up`.
2. Assert `data.outcome: "nothing-missed"`, zero run records, zero step records, and exit 0.
3. Assert the paired CU-01 fixture in the same test *does* execute a run (non-vacuity).

**Expected Outcome**:

- A no-miss catch-up is an explicit success, never an empty error and never a fabricated run.

#### TC-CEREMONY-028 - `mode: "none"` declared gap

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-3, CU-05
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-catch-up.test.ts`
**Tags**: @offline, @ceremony, @catch-up

**Preconditions**:

- An event-triggered declaration (e.g. `testing-session-assessment`) and a separate scheduled declaration with `catchUp.mode: "none"`, each with one missed window.

**Steps**:

1. Run `catch-up`.
2. Assert the `none` ceremony reports a declared gap with the window bounds and executes no run.
3. Assert the event-triggered ceremony reports no evaluated window and no invented run.
4. Assert zero run records for both.

**Expected Outcome**:

- A declined catch-up is declared, not silent; a gap and a caught-up window are distinguishable in the envelope.

#### TC-CEREMONY-029 - Catch-up matrix and schedule purity

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-6, AC-F5-1, F-5, CU-04/CU-06/CU-07/CU-08
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-catch-up.test.ts`, `tests/structure/ceremony-catch-up-purity.test.ts`
**Tags**: @offline, @ceremony, @catch-up

**Preconditions**:

- Fixtures for five missed windows, an event-only declaration, a removed declaration with history, and a replayed run reading current inputs.

**Steps**:

1. Assert CU-04: exactly one window replayed, the remainder reported as still missed.
2. Assert CU-06: no window synthesized for an event-triggered ceremony.
3. Assert CU-07: history stays readable and the missing declaration is a declared gap.
4. Assert CU-08: the replayed run reads *current* inputs and records both windows, with no back-dated fabrication.
5. Assert structurally that schedule evaluation imports no ambient clock: the only time input is the injected clock port, and a mutation reading `Date.now()` fails.

**Expected Outcome**:

- Catch-up is bounded, pure, and honest about what it does not know.

#### TC-CEREMONY-030 - Project declaration equivalence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-2, AC-F6-1, DEC-6, DEC-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-project-declarations.test.ts`; `tests/fixtures/ceremony/declarations/valid-project.yaml`
**Tags**: @offline, @ceremony, @project

**Preconditions**:

- A temp config directory containing one valid `ceremonies.yaml` declaring a new ceremony (schedule weekly 06:00 UTC; collect → fold → render → record; `ceremony-artifact`; `artifact-conforms`; `catchUp: once`; one compaction boundary). No code, no flag, no build step.

**Steps**:

1. Run `ceremony list --json`; assert the ceremony appears with origin `project` and its declared trigger/tiers/catch-up.
2. Run `ceremony run <project-ceremony>`.
3. Assert it executes the same declared step kinds through the same dispatcher, verifies with the same verifier, writes the same record shapes (run + one step per attempted step), and returns `verified` at exit 0.
4. Assert a built-in run in the same process uses the identical recorded implementation instances.
5. Assert the only difference from the built-in path is the declaration source.

**Expected Outcome**:

- AC3's acceptance case holds: a declaration document is the entire input; zero tooling change; no privileged path for built-ins or projects.

#### TC-CEREMONY-031 - Unparseable declaration document

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, E-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-project-declarations.test.ts`
**Tags**: @offline, @ceremony, @config

**Preconditions**:

- A present `ceremonies.yaml` that cannot be parsed (malformed YAML, wrong schemaVersion, wrong top-level type) and one that exceeds the size/permission rules; a recording run seam.

**Steps**:

1. Invoke each of `list`, `run <built-in>`, `resume`, `catch-up`.
2. Assert `config.file.malformed` at exit 1 for every invocation, before any run.
3. Assert zero run/step records and zero artifacts.
4. Assert an absent-document control runs the built-ins normally.

**Expected Outcome**:

- A broken project document refuses the whole family rather than silently dropping the project's ceremonies; the refusal precedes any effect.

#### TC-CEREMONY-032 - Empty document equals absent

**Scenario Type**: Edge Case
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-6, AC-F6-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-project-declarations.test.ts`
**Tags**: @offline, @ceremony, @config

**Preconditions**:

- `ceremonies.yaml` with `schemaVersion` and `ceremonies: []`.

**Steps**:

1. Run `list` and each of the six built-ins with the empty document, then with no document.
2. Assert the `list` payloads are byte-identical and each built-in's verdict/artifact is byte-identical.
3. Assert no refusal is raised for an empty list.

**Expected Outcome**:

- An empty document is not an error and not a difference; built-ins are unaffected.

#### TC-CEREMONY-033 - Tier agreement and pinned set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-NFR9-1, NFR-9, DM-7, T-01/T-02
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-tier.test.ts`
**Tags**: @offline, @ceremony, @tier

**Preconditions**:

- A plan declaring `tier: lite` and pm-notes declaring `variant: lite`; a `full`/`full` pair; a plan with `tier` absent-variant (`full`).

**Steps**:

1. Evaluate each pair through the pure tier engine.
2. Assert `effectiveTier`, `declaredTier`, `declaredVariant`, and `phaseSetSource`.
3. Assert `phaseSet[]` equals `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite` (and `.full`) element for element **in canonical order**, imported from the delivered constant.
4. Assert `findings` is empty and `escalations` is empty for an agreement.

**Expected Outcome**:

- The effective set is the delivered data, not a local copy; the source is named; a disagreement-free change carries no finding.

#### TC-CEREMONY-034 - Disagreement: variant governs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DM-7, E-12, T-03/T-04
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-tier.test.ts`
**Tags**: @offline, @ceremony, @tier

**Preconditions**:

- Plan `tier: lite` + variant `full`; and plan `tier: full` + variant `lite`.

**Steps**:

1. Evaluate each.
2. Assert the effective set is the variant's set, not the plan's.
3. Assert a `tier-mismatch` finding names both declarations.
4. Assert no error identity is emitted and no delivery state is blocked or rewritten (the plan and pm-notes documents are byte-unchanged).
5. Assert the plan's `tier.name` is echoed in `declaredTier` verbatim.

**Expected Outcome**:

- The recorded lifecycle truth governs and the anomaly is visible; the engine never silently picks or resolves.

#### TC-CEREMONY-035 - Escalation matrix

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, DM-3, DM-7, DEC-13, T-07/T-08/T-10
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-tier.test.ts`
**Tags**: @offline, @ceremony, @tier, @escalation

**Preconditions**:

- Plan declaring each of the five closed triggers (`phase-reopen`, `dor-rework`, `review-rework`, `gate-failure`, `owner-escalation`); recorded-evidence fixtures for each, plus an absent-evidence fixture per trigger.

**Steps**:

1. For each trigger: evaluate with present evidence and assert `matched`, an `escalations[]` entry naming the trigger and its evidence, and the effective set escalated to the full set for the remainder.
2. Evaluate with absent evidence and assert `unmatched` and no escalation.
3. Assert the run record of a ceremony run under escalation carries `tier` facts including `effectiveTier`, `phaseSetSize`, and the escalation.
4. Assert escalation re-introduces the obligations the lite set omits (tiered intake changes accordingly).

**Expected Outcome**:

- Escalation is evidence-gated for all five declared triggers and auditable after the fact; a declaration alone never escalates.

#### TC-CEREMONY-036 - Unevaluated trigger reported verbatim

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-4, DM-7, E-13, T-09
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-tier.test.ts`
**Tags**: @offline, @ceremony, @tier

**Preconditions**:

- A plan declaring an escalation-trigger string outside the closed five (e.g. `owner-mood`).

**Steps**:

1. Evaluate the change.
2. Assert the declared string appears verbatim as `unevaluated` in `escalationTriggers[]`, and an `unevaluated-trigger` finding names it.
3. Assert it is not dropped, not treated as false, and does not change the effective set.
4. Assert no error identity is emitted (the plan still validates; only `plan.tier.unknown` affects an unknown tier name, unchanged).

**Expected Outcome**:

- An unrecognized declaration is surfaced, never silently swallowed; the string survives verbatim.

#### TC-CEREMONY-037 - Plan `tier.phases` canonical subset

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, AC-NFR9-1, DM-7, Appendix D, T-05/T-06
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-tier.test.ts`
**Tags**: @offline, @ceremony, @tier

**Preconditions**:

- A plan declaring `tier.phases` with canonical ids (a subset), and one declaring a non-canonical id mixed with canonical ids.

**Steps**:

1. Evaluate the canonical subset; assert the effective set narrows to that subset in canonical order and `phaseSetSource` names the plan declaration.
2. Evaluate the mixed list; assert the non-canonical id appears as an `unresolved-phase` finding and is not applied, while canonical ids still narrow.
3. Assert no path can introduce a phase outside the canonical eleven.

**Expected Outcome**:

- A plan phase list narrows within the canonical vocabulary and can never create a second phase language.

#### TC-CEREMONY-038 - Tiered intake obligation

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, F-3, AC-F7-5, T-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-tier-intake.test.ts`
**Tags**: @offline, @ceremony, @tier, @intake

**Preconditions**:

- Declarations serving `full` only, `lite` only, and both; a change whose effective tier is `lite`.

**Steps**:

1. Compute intake; assert only declarations whose `tiers` include `lite` carry an obligation.
2. Assert a `full`-only ceremony is not obligated but `ceremony run <it>` still executes and verifies (operator intent is not gated).
3. Escalate the change; assert the previously omitted obligations return.
4. Assert intake performs no run and no write.

**Expected Outcome**:

- The tier verdict governs automated/catch-up intake only; an operator can always run any declared ceremony.

#### TC-CEREMONY-039 - Note intake contract

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-9, DM-2, AC-F9-1, E-1, E-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-notes.test.ts`; `tests/fixtures/ceremony/notes/`
**Tags**: @offline, @ceremony, @notes

**Preconditions**:

- Notes: absent (no `--note` where required), missing a required retro member, naming a different ceremony, `window.start > window.end`, and `--window` disagreeing with the note's window; one conforming control.

**Steps**:

1. Run each case.
2. Assert absent note → `input.value.rejected` naming the missing note, exit 1, before any read/write.
3. Assert missing member / wrong ceremony / invalid window → `ceremony.note-invalid` naming the field(s) (and both identifiers for a ceremony mismatch), exit 1.
4. Assert a `--window` disagreeing with the note's window → `input.value.rejected` naming both windows.
5. Assert the conforming control proceeds and that no case produced a record, artifact, or written note.
6. Assert the resolved run identity never holds two windows.

**Expected Outcome**:

- Note validation precedes all output; the failure names what to fix; the window precedence rule is enforced, not guessed.

#### TC-CEREMONY-040 - Run/step durability and measurement completeness

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-8, AC-F8-1, NFR-10, DM-3, DM-4, DM-5
**Test Type(s)**: State, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-state-boundary.test.ts`
**Tags**: @offline, @ceremony, @state, @measurement

**Preconditions**:

- An injected clock with distinct literal start/end times per step; a fenced store; a recording fence port.

**Steps**:

1. Run a multi-step ceremony; read the records back through the boundary.
2. Assert exactly one `ceremony.run` record for the identity with every DM-3 member present.
3. Assert one `ceremony.step` record per attempted step with every DM-4 member, including a non-null duration and the verification verdict.
4. Assert every append acquired one fence and performed a post-append re-read requiring exactly one new record.
5. Assert run status and run duration equal the hand-computed fold over step records, and that no stored document holds run status (a structural assertion that no mutable run document kind exists).
6. Assert a re-attempted step appends a second record without rewriting the first.

**Expected Outcome**:

- Measurement is complete and derived; there is no second source of truth to diverge from the ledger.

#### TC-CEREMONY-041 - Comparison record completeness

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, NFR-10, DM-8, DEC-1, DEC-8, DEC-14
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-comparison.test.ts`, `tests/golden/ceremony-comparison.test.ts`
**Tags**: @offline, @ceremony, @measurement

**Preconditions**:

- The committed measurement log with its `MET-CEREMONY-SHARE` row and `source_commit`; a fixture with `n ≥ 5` post-boundary per-change values; the runner-duration fixture.

**Steps**:

1. Produce the comparison record from the fixture inputs.
2. Assert `metricId == "MET-CEREMONY-SHARE"` and `definitionRef` resolves to the committed log row plus `source_commit`.
3. Assert `before` equals the committed baseline value, with its window, sample size, status (`PARTIAL`), and self-reported basis.
4. Assert `after` carries the window, per-change values, sample size, and basis.
5. Assert `sampleMinimum == 5`, the verdict is a member of the closed set, `nativeBasis` states non-interchangeability, and `disclosure` carries sample, window, basis difference, and the metric's limitation.
6. Assert the log's existing metric rows are byte-unchanged, the schema-version bump is declared, and no `MET-` ID was reallocated.
7. Assert `n ≥ 5` recomputes the after value from the cited per-change inputs (hand-computed oracle).

**Expected Outcome**:

- One honest, recomputable comparison record; the committed definition is reused verbatim; no prior verdict is carried forward.

#### TC-CEREMONY-042 - Below the sample minimum

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, NFR-10, DEC-14, E-17, RSK-4
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-comparison.test.ts`, `tests/checks/ceremony-comparison-honesty.test.ts`
**Tags**: @offline, @ceremony, @measurement

**Preconditions**:

- Fixtures with `n = 0, 1, 4` post-boundary changes; a paired `n = 5` control.

**Steps**:

1. Produce the comparison for each `n < 5` fixture.
2. Assert `verdict == "insufficient-sample"`, with the observed `n` and the per-change values recorded.
3. Assert the record contains no trend token and states no direction claim.
4. Scan this change's own artifacts (`doc/changes/.../chg-GH-296-*`) for a trend/improvement claim made from `< 5` changes; assert none.
5. Assert the `n = 5` control computes a real verdict (non-vacuity).

**Expected Outcome**:

- The vanity-metric failure mode is structurally refused: no trend is ever inferred from a single change, and the limitation is carried rather than summarised away.

#### TC-CEREMONY-043 - Follow-through first, evidence-cited

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-3, [retrospectives.md]
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-retro-levels.test.ts`, `tests/structure/ceremony-parity-invariants.test.ts`
**Tags**: @offline, @ceremony, @retro

**Preconditions**:

- A `window` and a `project` retro with three open actions: one whose verification artifact proves `applied`, one `partial`, one `violated-with-consequence`; an owner status claim saying all three are done.

**Steps**:

1. Run each retro.
2. Assert the executed first phase is follow-through verification (observed order, not merely declaration order).
3. Assert each action's verdict matches its artifact evidence, including the action whose status claim contradicts its artifact (the artifact wins).
4. Assert each verdict cites its verification artifact reference.
5. Assert a declaration edit that moves follow-through later fails the parity structural assertion.

**Expected Outcome**:

- "Follow-through first" is asserted positionally and behaviourally; a status claim is never evidence.

#### TC-CEREMONY-044 - Addendum, not rewrite

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-4, NFR-5, E-4, DEC-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-notes.test.ts`
**Tags**: @offline, @ceremony, @retro, @idempotency

**Preconditions**:

- A recorded retro note for scope key `SK-1` at window W1; the same scope at window W2; recording store and byte-level note reader.

**Steps**:

1. Capture the W1 note body bytes.
2. Run the ceremony for `SK-1` at W2.
3. Assert the W1 body is byte-identical afterwards.
4. Assert an addendum section was appended, the new window recorded exactly one new run record, and the prior run record is unchanged.
5. Assert a rerun for `(SK-1, W2)` returns `data.reused: true` with zero appends (cross-check with TC-CEREMONY-025).

**Expected Outcome**:

- Reruns accumulate history and never rewrite it; exactly one run per window.

#### TC-CEREMONY-045 - Null retro is a success

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-retro-levels.test.ts`
**Tags**: @offline, @ceremony, @retro

**Preconditions**:

- A window whose verified evidence supports no finding, no action, and no lesson; a paired fixture with one finding.

**Steps**:

1. Run the retro.
2. Assert the note carries an explicit empty finding set (an explicit empty marker, not an omitted section).
3. Assert no action and no lesson were fabricated.
4. Assert the run is `verified` at exit 0.
5. Assert the paired fixture reports its one finding (non-vacuity).

**Expected Outcome**:

- A quiet window is a valid retro; the runner never manufactures a finding to look productive.

#### TC-CEREMONY-046 - Evidence is the delivered pipeline, read-only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-6, DEC-3, DEC-4, NG-2
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-retro-levels.test.ts`
**Tags**: @offline, @ceremony, @retro, @read-only

**Preconditions**:

- A seeded verified evidence sidecar and `retro.run` records; recording ports for the retro registry, the sidecar, and the audit chain.

**Steps**:

1. Run the retro evidence pass at each level.
2. Assert the evidence step performed only reads of the delivered evidence/run records.
3. Assert zero writes to the retro evidence sidecar, zero `retro.*` registry appends, and zero audit-chain material written.
4. Assert the note records declared actions as a **handoff section** and asserts no action row, no aging, no closure field.
5. Assert the `retro` command family's grammar and level-registry statuses are unchanged (pipeline parity, cross-checked in TC-CEREMONY-057).

**Expected Outcome**:

- The ceremony is a consumer, not a second evidence plane; the M2-S10 action registry boundary holds.

#### TC-CEREMONY-047 - SC-M2-S3-02: missing `scopeKey` refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-2, DM-9, AC-F9-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-notes.test.ts`
**Tags**: @offline, @ceremony, @retro, @pinned-seed

**Preconditions**:

- A conforming retro note with `scopeKey` removed; a paired conforming note.

**Steps**:

1. Run `ceremony run retro-evidence-pass --note <fixture> --json`.
2. Assert exit 1 and `error.code == "ceremony.note-invalid"` naming `scopeKey` (verbatim pinned assertion from the inherited seed).
3. Assert no partial ceremony output exists: zero run records, zero step records, zero artifacts, no written note.
4. Assert the paired conforming note runs to `verified` (non-vacuity).

**Expected Outcome**:

- The idempotency anchor is mandatory and its absence is refused before any output. Scenario `SC-M2-S3-02` is adopted by ID.

#### TC-CEREMONY-048 - SC-M2-S3-01: conforming note produces declared outputs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-4, AC-F9-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-retro.test.ts`
**Tags**: @offline, @ceremony, @retro, @pinned-seed

**Preconditions**:

- A note satisfying the fixed retro schema; seeded evidence that supports at least one action with a verifying artifact; deterministic clock and ids.

**Steps**:

1. Run the retro ceremony.
2. Assert each agenda step produced its declared output in its declared slot.
3. Assert the note was read back from `memory` and validated against the fixed schema, including a `follow-through` section carrying at least one verified action (verbatim pinned assertion from the inherited seed).
4. Assert exit 0 and verdict `verified`.

**Expected Outcome**:

- Scenario `SC-M2-S3-01` is adopted by ID and passes: full output coverage plus an artifact-verified follow-through section.

#### TC-CEREMONY-049 - Error identity and two-way sync

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-9, AC-NFR8-1, NFR-8, C-7
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`
**Tags**: @offline, @ceremony, @errors

**Preconditions**:

- The machine table and the documented table after the two additive rows.

**Steps**:

1. Assert `DOMAIN_KINDS` contains `ceremony` and that the table resolves each new code by exact code (a kind-only lookup must fall through to `fallback.internal`).
2. Assert `ceremony.note-invalid` and `ceremony.declaration.invalid` exist in both tables with identical category, retryable, consequence, projection class, and exit (1).
3. Assert `RESERVED_TWO_SEGMENT_CODES` contains `ceremony.note-invalid` and its length moved 52 → 53.
4. Assert the documented identity count moved 136 → 138.
5. Assert no delivered row was renamed, reworded, re-projected, or removed; run `runSyncCheck` and assert zero failures.
6. Assert a mutation adding a documented row without a machine row (and the reverse) fails the sync check.

**Expected Outcome**:

- The table is binding in both directions, additive by exactly two rows and one kind, with the reserved allowlist extended by exactly one entry.

#### TC-CEREMONY-050 - Structural purity and zero model calls

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, AC-NFR2-1, C-4, C-5, RSK-2
**Test Type(s)**: Structure, Checks (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/ceremony-imports.test.ts`, `tests/checks/ceremony-mutants.test.ts`
**Tags**: @offline, @ceremony, @purity

**Preconditions**:

- The fold/render/verification/tier modules; a temp-copy mutation harness.

**Steps**:

1. Scan the ceremony domain modules for: inference-client imports, model identifiers, network modules (`node:net`, `node:http`, `fetch`, provider SDKs), and ambient reads (`Date.now`, `Math.random`, `process.env`, ambient `process.cwd` in domain paths).
2. Assert zero findings for each class, and assert the scanner finds a planted violation in a control fixture (the scanner is not vacuous).
3. Assert a temp-copy mutation introducing each class fails the suite.
4. Assert no ceremony module imports a runtime adapter (the domain stays injection-only).

**Expected Outcome**:

- The "zero model calls in render or verification" claim is structurally enforced with a failing control, not asserted in prose.

#### TC-CEREMONY-051 - Tier neutrality structure

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-NFR9-1, DEC-2, RSK-6
**Test Type(s)**: Structure, Checks (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/ceremony-tier-single-source.test.ts`, `tests/checks/ceremony-mutants.test.ts`
**Tags**: @offline, @ceremony, @tier

**Preconditions**:

- The tier engine module and the delivered plan/pm-notes contracts.

**Steps**:

1. Assert the tier module imports exactly the two delivered sources (`PLAN_KNOWN_TIERS`, `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`) and declares no phase-id literal array of its own.
2. Assert a repository-wide scan finds no tier name outside `full`/`lite` in ceremony code or its contracts.
3. Assert no hardcoded default phase set exists outside the delivered per-variant data (a scan for an eleven- or six-element phase array literal in ceremony modules).
4. Assert mutations that (a) add a literal phase set and (b) accept a third tier name each fail.

**Expected Outcome**:

- One mapping, two sources, no second vocabulary; drift is caught structurally before review.

#### TC-CEREMONY-052 - Mirror-sync safety bounds

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-12, AC-NFR12-1, AC-F3-5, RSK-3
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-flow-mirror.test.ts`, `tests/structure/ceremony-contract.test.ts`
**Tags**: @offline, @ceremony, @mirror, @security

**Preconditions**:

- A declaration with nine targets (over bound); a declaration naming target R but invoked against R′ (undeclared); a dirty target; a target not on its declared base; a target that is absent.

**Steps**:

1. Assert the nine-target declaration refuses `ceremony.declaration.invalid` naming the target bound.
2. Assert an undeclared target receives zero writes and the run reports it per target.
3. Assert a dirty/absent/wrong-base target yields an `unverified` step naming that precondition and that repository, with no force path attempted (recording seam shows zero force calls).
4. Assert other declared targets are still reported individually.
5. Assert a structural scan finds no `--force`-equivalent or override flag in the mirror path.

**Expected Outcome**:

- The blast radius is bounded by declaration, cleanliness, base, and equality — with no escape hatch.

#### TC-CEREMONY-053 - Determinism and bounded output

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2, NFR-7, §10
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-determinism.test.ts`, `tests/golden/ceremony-envelope.test.ts`
**Tags**: @offline, @ceremony, @determinism

**Preconditions**:

- Identical injected inputs, clock, ids, and declaration; a permutation fixture with shuffled step-record append order.

**Steps**:

1. Run twice and assert byte-identical artifacts and human text.
2. Assert the human summary is ≤32 lines and ≤6 144 bytes, with an explicit omission marker when truncated, and that the verdict line is never truncated.
3. Assert shuffled append order produces byte-identical derived summaries.
4. Assert no ambient clock/random/environment read is reached (recording seams show only injected values).

**Expected Outcome**:

- Renders are pure and bounded; a hidden timestamp or map-iteration order would fail the byte comparison.

#### TC-CEREMONY-054 - Byte bounds at and above limits

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-bounds.test.ts`
**Tags**: @offline, @ceremony, @bounds

**Preconditions**:

- Generated fixtures producing records and artifacts at, just under, and just over each bound: run 16 KiB, step 2 KiB, brief artifact 65 536 bytes, declaration 1 MiB.

**Steps**:

1. Measure a positive serialized length first (non-vacuity).
2. Assert at-limit records/artifacts are accepted.
3. Assert over-limit records are refused as classified state/schema failures, never silently truncated into a valid-looking record.
4. Assert an over-limit artifact fails its step verification.

**Expected Outcome**:

- Bounds are enforced on measured bytes; a silent truncation cannot masquerade as a valid record.

#### TC-CEREMONY-055 - Read/run cost and duration budgets

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-11, NFR-13
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-performance.test.ts`
**Tags**: @offline, @ceremony, @performance

**Preconditions**:

- Recording read ports; a generated 10 000-record retro evidence sidecar; six declarations for catch-up; a five-step remaining agenda for resume.

**Steps**:

1. Assert `list` performs 1 declaration read and ≤2 verified state reads.
2. Assert `run` performs 1 declaration read, ≤16 declared input reads, and ≤1 verified state read per fenced append.
3. Assert `resume` performs ≤2 verified state reads plus the declared remaining steps; `catch-up` performs 1 declaration read and ≤2 verified state reads per ceremony.
4. Assert zero retries, zero pagination crawls, zero child processes, zero network calls (recording ports and a process-open probe).
5. Record a reference-environment wall-clock measurement against the NFR-13 budgets in §10; assert bounded work in CI (not the wall clock).

**Expected Outcome**:

- Cost is asserted as recorded work; wall-clock thresholds stay a recorded reference measurement (GAP-3), never a flaky gate.

#### TC-CEREMONY-056 - Hermetic posture and skip discipline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-11, NFR-2, Appendix E
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/ceremony-hermetic.test.ts`
**Tags**: @offline, @ceremony, @hermetic

**Preconditions**:

- The ceremony suite set; a process/socket/env probe harness; a discovery scan over the new suite files.

**Steps**:

1. Run the ceremony suites under a probe that fails on network open, child-process spawn, real-`$HOME` read, or a write outside the test temp root.
2. Assert zero violations.
3. Assert the live tree's tracked files are byte-identical before and after the suite run (a live-tree write guard).
4. Assert no ceremony suite contains an unguarded skip; a declared platform exception must carry its documented reason, and a skipped case must not be counted as a pass.

**Expected Outcome**:

- The hermetic claim is tested; a skip cannot silently green the suite.

#### TC-CEREMONY-057 - Delivered surfaces unchanged; exclusions absent

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-6, AC-NFR14-1, §8.5, NG-1..NG-8, DoD-13
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-nonregression.test.ts`, `tests/structure/content-inventory.test.ts` (update)
**Tags**: @offline, @ceremony, @regression

**Preconditions**:

- The delivered retro pipeline, closeout, brief, plan, and pm-notes suites; the prompt inventory fixtures.

**Steps**:

1. Assert the retro family's grammar, payloads, identities, registry kind/status, and refusals are byte-identical (its delivered suites pass unchanged).
2. Assert closeout's behaviour and its R1 coverage read are unchanged.
3. Assert `plan validate` still echoes `tier` and refuses an unknown tier with `plan.tier.unknown`, unchanged.
4. Assert pm-notes `variant` handling and the per-variant phase sets are unchanged.
5. Assert no `metrics` surface, no action-registry command, no ceremony pack, no scheduler/daemon integration, no new event topic, and no MCP ceremony surface exist (inventory + prompt-conformance + a scan for excluded identifiers).
6. Assert a repository with no ceremony declaration document and no `ceremony` invocation gains no files and no records.

**Expected Outcome**:

- "No project sees a change by default": the change is additive and the excluded surfaces are absent, not merely undocumented.

#### TC-CEREMONY-058 - Aggregate gate regression

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR14-1, NFR-14, C-9
**Test Type(s)**: Aggregate
**Automation Level**: Automated
**Target Layer / Location**: repo root
**Tags**: @gate, @ceremony

**Preconditions**:

- A built workspace; `TMPDIR=$PWD/tmp/tmpdir` exists.

**Steps**:

1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check`.
2. Assert exit 0 across `lint → format:check → typecheck → test → check:boundaries → check:memory → prompt-conformance → help-guide-coverage → exports-parity`.
3. Assert the ceremony suites are discovered (a non-zero test count for their files) rather than silently excluded.
4. Assert the error-table sync and exit-code-literals checks ran inside the battery (or the `tests/checks` suite that invokes them).

**Expected Outcome**:

- The whole battery is green with the ceremony work included, not with the work skipped.

#### TC-CEREMONY-059 - Commit and PR hygiene

**Scenario Type**: Manual/Evidence
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR14-1, NFR-14, C-9
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: phase-9 gate log; commit range; PR metadata
**Tags**: @process, @ceremony

**Preconditions**:

- The change branch's commits; the PR record.

**Steps**:

1. Run `./scripts/lint-commit-range.sh --base main-tools` and record its verdict.
2. Assert every subject is conventional and scoped `GH-296`; assert every body and footer line is ≤100 characters (the commitlint configuration is the authority).
3. Record the `TMPDIR=$PWD/tmp/tmpdir pnpm check` exit code from the phase-9 log.
4. Assert the PR targets `main-tools` and remains open; record its URL as a pm-notes `notes:` entry.

**Expected Outcome**:

- Process facts are evidenced rather than asserted. **This is not assertable in a permanent suite (GAP-5)**; the permanent-suite half is TC-CEREMONY-058.

#### TC-CEREMONY-060 - Documentation deltas and distribution marker

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, DoD-12, Appendix C, C-8
**Test Type(s)**: Checks, Content
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/doc-conformance.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @ceremony

**Preconditions**:

- The Appendix C deltas applied: new feature spec, new operator guide, M2 command page and index, registry row, entrypoint delta, baseline log and its spec, both error tables, index rows, nonfunctional row, concepts note.

**Steps**:

1. Assert each Appendix C delta's file exists and its required anchor/inventory row is present.
2. Assert `doc/guides/ceremony-runner.md` declares `ados_distribution: redistributable` and the distribution guard passes.
3. Assert `doc/spec/features/feature-ceremony-runner.md` exists and carries its spec convention marker.
4. Assert the doc-conformance current-truth phrase table passes for the touched docs (no retired phrasing introduced).
5. Assert the documentation index registers the new spec and the new guide.

**Expected Outcome**:

- Documentation is part of the deliverable and mechanically checked where the repo already checks it; drift is a gate failure, not a review note.

#### TC-CEREMONY-061 - Declaration `scopeKey` derivation, `note`-legality, and the single-schedule bound

**Scenario Type**: Negative (with an accepting control)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F2-4, AC-F2-1, DM-1, DM-2, E-19, DEC-16, DEC-18
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-declaration.test.ts`, `tests/structure/ceremony-contract.test.ts`
**Tags**: @offline, @ceremony, @declaration, @identity

**Preconditions**:

- The six production built-in declarations and the valid project declaration (D-14 control).
- Defect fixtures D-15 (no `scopeKey`), D-16 (`note` derivation without a note requirement), D-17 (malformed literal token), D-18 (two `schedule` triggers).
- Project declarations exercising each legal derivation (`literal`, `repository`, `note`), the delivered repository identity resolver fixture (`host/owner/name`), and a literal-token fixture.

**Steps**:

1. For each of the six built-ins and the valid project declaration, assert exactly one `scopeKey` is present and its `kind` is a member of the closed set `literal` | `repository` | `note`; assert no declaration carries a second derivation, an implied source, or a default.
2. Assert the observed derivation per built-in: `morning-brief`, `sprint-rollover`, `night-watch`, `decision-record-mirror-sync` → `repository`; `retro-evidence-pass`, `testing-session-assessment` → `note`.
3. Assert every `note` derivation appears only where `note.required` is `true`, and that each of the two `note`-deriving built-ins declares a note requirement (paired control asserting a note-less declaration never derives from a note).
4. Assert each declaration declares at most one `schedule` trigger and that its `triggers[]` count is within 1..8.
5. Assert the `repository` derivation resolves to the delivered normalized identity fixture on two independent resolutions (same value twice), and the `literal` derivation returns the declared token verbatim.
6. Refuse D-15 → `ceremony.declaration.invalid` naming `scopeKey`, exit 1, nothing registered.
7. Refuse D-16 → same code naming `scopeKey`; refuse D-17 → same code naming `scopeKey`.
8. Refuse D-18 → same code naming `triggers[]`.
9. Assert the D-14 control validates clean and registers exactly once in the same test (non-vacuity), and that every refusal produced no run record, step record, or artifact.

**Expected Outcome**:

- The run identity's scope key is declaration data with exactly one legal source per declaration, so no built-in, and no project declaration, can present an unresolved or ambiguous identity — and the note-less majority derive a stable repository key. Refusals name `scopeKey` or `triggers[]` and register nothing, proven against a paired accepting control.

#### TC-CEREMONY-062 - Explicit-run trigger recording and resolution

**Scenario Type**: Happy Path + Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, F-9, AC-F3-8, DM-3, E-20, DEC-17
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run-triggers.test.ts`
**Tags**: @offline, @ceremony, @triggers

**Preconditions**:

- Three fixture declarations: a single-trigger declaration, a multi-trigger declaration (two distinct events, no `schedule`), and a note-consuming multi-trigger declaration.
- A note-less `schedule: daily` fixture declaration for the obligation half (it has a scheduled window that an explicit run must not satisfy), and a second missed window for the `catch-up` control.
- A note whose `trigger` names a declared trigger; a note whose `trigger` names a trigger the declaration does not declare.
- The production retro declaration's trigger set is asserted by TC-CEREMONY-014 (Phase 5); this TC asserts the recording rule that declaration relies on.

**Steps**:

1. Run an explicit `ceremony run` of the single-trigger declaration; assert the run record carries `trigger.kind == "explicit"`, `trigger.resolution == "declaration"`, and that the recorded declared-trigger reference is that single trigger.
2. Run an explicit run of the multi-trigger declaration with no note; assert `kind == "explicit"`, `resolution == "unspecified"`, and that the record names the declaration's full declared trigger set (set equality, order-insensitive).
3. Run an explicit run of the note-consuming declaration with the note that names a declared trigger; assert `kind == "explicit"`, `resolution == "note"`, and the recorded trigger equals the note's named trigger.
4. Run an explicit run of the note-less `schedule: daily` fixture; assert no `kind: "schedule"` or `kind: "event"` record is produced, and that the obligation evaluation for that window still reports it **due** — the explicit run did not satisfy it. Then invoke `catch-up`, which replays a *different* missed window with `kind: "catch-up"`: assert that window's obligation clears while the explicitly-run window stays due, proving the predicate is about the recorded kind and catch-up marker, not about the mere existence of a record.
5. Refuse the note naming an undeclared trigger as `input.value.rejected` naming the note's trigger and the declared set, exit 1, with zero run records, zero step records, and zero artifacts.
6. Assert the recorded-kind vocabulary is exactly `schedule`, `event`, `catch-up`, `explicit` and the resolution vocabulary exactly `note`, `declaration`, `unspecified`, and that every recorded pair is legal (e.g. `explicit` never paired with a catch-up marker).
7. Assert the DM-3 members `declared window`, `actual window`, and the catch-up marker are present and mutually consistent for each recorded case.

**Expected Outcome**:

- A manual invocation is recorded as what it is — `explicit` — with a resolution that never guesses, so a reader can tell an operator run from a firing; the obligation arithmetic cannot be satisfied by typing the verb, and a note cannot smuggle a trigger the declaration never declared.

**Notes / Clarifications**:

- The interaction between an explicit run that already occupies a window's identity and a later `catch-up` for that same window is **not** asserted here; it is open as OQ-T8 because the spec states the non-counting rule but not the identity-collision outcome. Until it is pinned, this TC asserts the obligation predicate and the recorded kinds only.

#### TC-CEREMONY-063 - Note-less scheduled idempotency: `morning-brief` twice in one UTC day

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F4-7, AC-F4-6, DM-1, DM-2, DM-3, NFR-5, E-4, DEC-16, DEC-18
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @idempotency, @window

**Preconditions**:

- A note-less scheduled declaration with `scopeKey: { kind: "repository" }` and exactly one `schedule: daily` trigger — the declared `morning-brief` shape; the production declaration once the built-ins land, and a fixture mirroring its declared shape in the Phase 3 gate.
- A fixed, injected clock inside one UTC day; the delivered repository identity resolver fixture; a recording store, a recording artifact writer, and a byte-level artifact directory listing primitive.
- Paired controls: the same declaration with an explicit `--window`, and a clock fixture straddling UTC midnight.

**Steps**:

1. Run the declaration with no `--window`; assert the resolved window equals the cadence's derived UTC day containing `NOW_MS` (hand-computed literal bounds, not recomputed by the production derivation), the scope key equals the `repository` derivation's identity fixture, and the run record carries the scope key with `derivation: "repository"`.
2. Capture the record set and artifact directory after the first run; assert exactly one run record, one step record per declared step, and one artifact.
3. Invoke the identical invocation again (same clock, same day, still no `--window`); assert the recorded verdict is returned with `data.reused: true` and exit 0.
4. Assert zero new run records, zero new step records, and zero new artifacts (byte-level listing and record count before/after), and that the first artifact is byte-identical.
5. Advance the injected clock to the next UTC day and invoke again with no `--window`; assert this is a new identity: exactly one new run record and one new artifact, with the earlier artifact untouched.
6. Assert the derivation is single-valued and overridable by precedence: a `--window` equal to the derived day yields the same identity and returns `data.reused: true`, while a `--window` naming a different window supplies the window (F-1 rule 2) and yields a different identity; and the UTC-midnight-straddling fixture derives the day containing `NOW_MS` rather than a local-time day.
7. Assert the paired explicit-window control and the derived-window case agree on the run-record shape (same DM-3 members), so the only difference is the window's source.

**Expected Outcome**:

- The note-less scheduled majority is idempotent on the declaration-derived key and the cadence-derived day: the second brief in one UTC day is the recorded verdict with no appended record and no second artifact. This is the case a note-only scope key made impossible to prove, and the reason AC-F4-6 alone was insufficient evidence.

#### TC-CEREMONY-064 - Note-less event-triggered run requires `--window`

**Scenario Type**: Negative (with paired accepting controls)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F4-8, DM-3, NFR-5, E-18, DEC-18
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/ceremony-run.test.ts`
**Tags**: @offline, @ceremony, @window, @refusal

**Preconditions**:

- A note-less event-only declaration with one `event: pre-dispatch` trigger and `scopeKey: { kind: "repository" }` — the declared `decision-record-mirror-sync` shape.
- Recording declaration reader, recording input readers, recording state reads, and a recording artifact writer; a valid `--window W1..W2` fixture and a second, different window.
- A paired note-consuming declaration whose window comes from its note (no `--window` supplied).

**Steps**:

1. Invoke with no `--window`; assert `input.value.rejected` naming `--window` at exit `1`, with the failure under `error` in the five-key `delivery.result.v1` envelope and no `data`.
2. Assert the refusal precedes every effect: zero declared-input reads, zero verified state reads, zero memory or artifact writes, zero run records, zero step records (the declaration read that establishes the event-only trigger set is the only read permitted before the refusal — see OQ-T9).
3. Assert the run identity is never partially resolved: no run record exists for any window of that ceremony.
4. Invoke with `--window W1..W2`; assert the run identity is `(ceremony, repository-derived scope key, W1..W2)` — the run record's declared window equals the supplied window and its scope key carries `derivation: "repository"`.
5. Re-invoke with the same window; assert `data.reused: true` and zero appends. Invoke with the second, different window; assert a new run identity (exactly one new run record).
6. Paired controls in the same test: the note-consuming declaration invoked with no `--window` proceeds on its note's window, and the event-only declaration invoked *with* `--window` proceeds — proving the refusal is specific to the note-less event-only case and not to `--window`-less invocations generally.
7. Assert the forbidden outcome: at no point is a window derived for the event-only declaration (no derived `window` value appears in any refusal payload or record).

**Expected Outcome**:

- The highest-blast-radius built-in can never resolve an identity from a window that does not exist: the refusal is empty (no records, no artifacts, no input reads), and with a window the identity is complete and idempotent. A derived window would make the mirror sync's dedupe a guess, which is exactly what the spec refuses.

## 6. Environments and Test Data

- **Environment**: local developer machine or CI runner; Bun pinned via `.bun-version`; pnpm workspace. Fully offline and hermetic — no network, no credentials, no live harness/provider stores, no child processes, and no real user state directory or live-tree write (NFR-11, §24 Appendix E).
- **Aggregate gate environment**: `TMPDIR=$PWD/tmp/tmpdir pnpm check`, with `tmp/tmpdir` created by the invoking workflow (the declared pm-notes delivery convention).
- **Synthetic clock**: one literal `NOW_MS` per suite; literal window bounds; one fixture straddling UTC midnight so a local-time assumption fails.
- **Id factories and fence tokens**: deterministic literal sequences injected through ports; distinct literal fence tokens for the concurrent-append cases.
- **Injected input readers**: recording fakes per declared input source; an unavailable-collector variant returning a classified result; the recordings are the read-cost oracle.
- **Byte-level artifact I/O**: a per-test temp directory holding the `ceremony-artifact` family, read and written as UTF-8 bytes with measured lengths and `0600` mode assertions.
- **State test data**: per-test temp store roots via `tests/fixtures/state/harness.ts`; ceremony records seeded through the production append path (or a builder emitting only production-shaped payloads); damaged stores produced at the ledger level for the torn/contradiction cases.
- **Declaration test data**: `tests/fixtures/ceremony/declarations/` — the valid project declaration, one fixture per defect corpus row D-01..D-18, an unparseable document, an empty document, a built-in-colliding document, one declaration per legal `scopeKey` derivation, one note-less scheduled declaration (single `schedule: daily`) and one note-less event-only declaration (single `event: pre-dispatch`), with a committed expectation table naming code and field.
- **Note test data**: `tests/fixtures/ceremony/notes/` — one conforming note per retro level, plus missing-`scopeKey`, missing-member, wrong-ceremony, invalid-window, window-disagreeing, and undeclared-trigger (`change-merged`) variants.
- **Trigger and window test data**: a single-trigger declaration, a multi-trigger declaration (no `schedule`), a note-consuming multi-trigger declaration, and notes naming a declared / an undeclared trigger; window fixtures with two distinct literal bounds, a UTC-midnight-straddling clock, and a fixed `NOW_MS` per suite.
- **Repository test data**: isolated temp git repositories from `tests/fixtures/closeout/temp-git.ts` for the mirror sync; clean, dirty, wrong-base, absent, extra-record, and missing-record variants.
- **Tier test data**: plan fixtures declaring `full`/`lite`/explicit `phases`/each escalation trigger; pm-notes fixtures declaring `full`/`lite`/absent; recorded-evidence fixtures per trigger.
- **Measurement test data**: the committed `doc/planning/oss-tooling/measurement-baseline.yaml` read as the before value; generated after-samples for `n = 0, 1, 4, 5, 6`.
- **Privacy**: every new fixture is synthetic and passes `tests/checks/fixture-privacy.test.ts` — no real participant names, refs, credentials, or personal data.
- **Isolation and cleanup**: one temp root per case, discarded per test; goldens and mutant copies run against temp roots or committed read-only fixtures; goldens are regenerated only deliberately with a recorded command (testing-strategy snapshot rule).

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | Test file(s) to create/update | Execution command | Mocking / seeding requirements | Status |
|----------|------------------------------|-------------------|-------------------------------|--------|
| TC-CEREMONY-001, TC-CEREMONY-060 | `tests/checks/{help-guide-coverage,doc-conformance,prompt-conformance}.test.ts` (update); `tests/structure/{content-inventory,entrypoint-bin}.test.ts` (update); `tests/fixtures/help-guide/coverage.json` (update) | `bun test tests/checks/help-guide-coverage.test.ts tests/checks/doc-conformance.test.ts` + `bun run scripts/checks/help-guide-coverage.ts` | Reference page + inventory row; doc deltas applied | To Implement (updates) |
| TC-CEREMONY-002, TC-CEREMONY-003, TC-CEREMONY-005 | `tests/behaviour/ceremony-cli.test.ts` (new) | `bun test tests/behaviour/ceremony-cli.test.ts` | Recording reader/state ports; built-in declarations | To Implement |
| TC-CEREMONY-004 | `tests/golden/ceremony-envelope.test.ts` (new); `tests/structure/envelope-contract.test.ts` (update) | `bun test tests/golden/ceremony-envelope.test.ts` | One golden per outcome class from §4.3; injected clock/ids | To Implement |
| TC-CEREMONY-006 | `tests/behaviour/ceremony-list.test.ts` (new) | `bun test tests/behaviour/ceremony-list.test.ts` | Seeded last-run records; recording seams | To Implement |
| TC-CEREMONY-007, TC-CEREMONY-009, TC-CEREMONY-010 | `tests/structure/ceremony-contract.test.ts` (new); `tests/behaviour/ceremony-declaration-bounds.test.ts` (new); `tests/structure/ceremony-imports.test.ts` (new) | `bun test tests/structure/ceremony-contract.test.ts tests/behaviour/ceremony-declaration-bounds.test.ts` | Production built-in data; generated bound fixtures; smuggling fixtures | To Implement |
| TC-CEREMONY-008 | `tests/behaviour/ceremony-declaration.test.ts` (new); `tests/fixtures/ceremony/declarations/**` (new) | `bun test tests/behaviour/ceremony-declaration.test.ts` | D-01..D-14 corpus + expectation table | To Implement |
| TC-CEREMONY-011, TC-CEREMONY-012 | `tests/behaviour/ceremony-parity.test.ts` (new); `tests/structure/ceremony-parity-invariants.test.ts` (new) | `bun test tests/behaviour/ceremony-parity.test.ts tests/structure/ceremony-parity-invariants.test.ts` | Six fixture rows; per-built-in mutation + clean control; shared-implementation probe | To Implement |
| TC-CEREMONY-013, TC-CEREMONY-017, TC-CEREMONY-018 | `tests/behaviour/ceremony-flow-{brief,night-watch,rollover}.test.ts` (new); `tests/golden/ceremony-brief.test.ts` (new) | `bun test tests/behaviour/ceremony-flow-brief.test.ts tests/behaviour/ceremony-flow-night-watch.test.ts tests/behaviour/ceremony-flow-rollover.test.ts` | Collector/brief fixtures; quiet and noisy windows; carry-over set | To Implement |
| TC-CEREMONY-014, TC-CEREMONY-043, TC-CEREMONY-045, TC-CEREMONY-046 | `tests/behaviour/ceremony-flow-retro-levels.test.ts` (new) | `bun test tests/behaviour/ceremony-flow-retro-levels.test.ts` | Seeded evidence sidecar + `retro.run`; per-level notes; action-verdict fixtures; null-window fixture; recording retro ports | To Implement |
| TC-CEREMONY-015 | `tests/behaviour/ceremony-flow-assessment.test.ts` (new) | `bun test tests/behaviour/ceremony-flow-assessment.test.ts` | Owner note with per-verdict items + one uncited item | To Implement |
| TC-CEREMONY-016, TC-CEREMONY-024, TC-CEREMONY-052 | `tests/behaviour/ceremony-flow-mirror.test.ts` (new) | `bun test tests/behaviour/ceremony-flow-mirror.test.ts` | `tests/fixtures/closeout/temp-git.ts` targets; clean/dirty/absent/wrong-base/extra/missing variants; recording write seam | To Implement (GAP-4) |
| TC-CEREMONY-019, TC-CEREMONY-020, TC-CEREMONY-023, TC-CEREMONY-025 | `tests/behaviour/ceremony-run.test.ts` (new) | `bun test tests/behaviour/ceremony-run.test.ts` | Unavailable collector; artifact mutation; large-output and small-output fixtures; recording store/renderer | To Implement |
| TC-CEREMONY-021 | `tests/behaviour/ceremony-resume.test.ts` (new) | `bun test tests/behaviour/ceremony-resume.test.ts` | Crash-after-k fixture composing the production append path | To Implement |
| TC-CEREMONY-022, TC-CEREMONY-040 | `tests/behaviour/ceremony-state-boundary.test.ts` (new) | `bun test tests/behaviour/ceremony-state-boundary.test.ts` | Healthy + three contradicted stores; damaged ledger; fence recording | To Implement |
| TC-CEREMONY-026, TC-CEREMONY-027, TC-CEREMONY-028, TC-CEREMONY-029 | `tests/behaviour/ceremony-catch-up.test.ts` (new); `tests/structure/ceremony-catch-up-purity.test.ts` (new) | `bun test tests/behaviour/ceremony-catch-up.test.ts tests/structure/ceremony-catch-up-purity.test.ts` | CU-01..CU-09 fixtures; injected clock; removed-declaration history | To Implement |
| TC-CEREMONY-030, TC-CEREMONY-031, TC-CEREMONY-032 | `tests/behaviour/ceremony-project-declarations.test.ts` (new) | `bun test tests/behaviour/ceremony-project-declarations.test.ts` | Temp config dirs: valid, unparseable, oversized, empty, absent, colliding | To Implement |
| TC-CEREMONY-033, TC-CEREMONY-034, TC-CEREMONY-035, TC-CEREMONY-036, TC-CEREMONY-037, TC-CEREMONY-038 | `tests/behaviour/ceremony-tier.test.ts`, `tests/behaviour/ceremony-tier-intake.test.ts` (new) | `bun test tests/behaviour/ceremony-tier.test.ts tests/behaviour/ceremony-tier-intake.test.ts` | Plan/pm-notes fixture matrix T-01..T-11; recorded-evidence fixtures | To Implement |
| TC-CEREMONY-039, TC-CEREMONY-044, TC-CEREMONY-047, TC-CEREMONY-048 | `tests/behaviour/ceremony-notes.test.ts` (new); `tests/behaviour/ceremony-flow-retro.test.ts` (new) | `bun test tests/behaviour/ceremony-notes.test.ts tests/behaviour/ceremony-flow-retro.test.ts` | Note fixture matrix; byte-level note reader; W1/W2 scope-key fixtures | To Implement |
| TC-CEREMONY-041, TC-CEREMONY-042 | `tests/behaviour/ceremony-comparison.test.ts` (new); `tests/golden/ceremony-comparison.test.ts` (new); `tests/checks/ceremony-comparison-honesty.test.ts` (new) | `bun test tests/behaviour/ceremony-comparison.test.ts tests/checks/ceremony-comparison-honesty.test.ts` | Committed baseline log; `n = 0,1,4,5,6` samples; artifact trend scan | To Implement |
| TC-CEREMONY-049 | `tests/structure/error-table.test.ts` (update); `tests/checks/error-table-sync.test.ts` (update) | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` + `bun run scripts/checks/error-table-sync.ts` | Both tables updated; mutation copies | To Implement (updates) |
| TC-CEREMONY-050, TC-CEREMONY-051 | `tests/structure/ceremony-{imports,tier-single-source}.test.ts` (new); `tests/checks/ceremony-mutants.test.ts` (new) | `bun test tests/structure/ceremony-imports.test.ts tests/structure/ceremony-tier-single-source.test.ts tests/checks/ceremony-mutants.test.ts` | Planted-violation controls; fifteen disabling mutants (§4.2.3) | To Implement |
| TC-CEREMONY-053, TC-CEREMONY-054 | `tests/behaviour/ceremony-determinism.test.ts`, `tests/behaviour/ceremony-bounds.test.ts` (new) | `bun test tests/behaviour/ceremony-determinism.test.ts tests/behaviour/ceremony-bounds.test.ts` | Injected clock/ids; permutation fixture; generated bound ladder | To Implement |
| TC-CEREMONY-055 | `tests/behaviour/ceremony-performance.test.ts` (new) | `bun test tests/behaviour/ceremony-performance.test.ts` | 10k-record sidecar; recording read ports; process-open probe | To Implement (GAP-3) |
| TC-CEREMONY-056 | `tests/checks/ceremony-hermetic.test.ts` (new) | `bun test tests/checks/ceremony-hermetic.test.ts` | Probe harness; live-tree hash guard; skip scan | To Implement |
| TC-CEREMONY-057 | `tests/behaviour/ceremony-nonregression.test.ts` (new) | `bun test tests/behaviour/ceremony-nonregression.test.ts` | Delivered suites unchanged; inventory fixtures | To Implement |
| TC-CEREMONY-058 | aggregate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | none | Existing – No Change (gate unchanged) |
| TC-CEREMONY-059 | phase-9 log + commit range + PR metadata | `./scripts/lint-commit-range.sh --base main-tools`; manual PR check | none | Manual Only (GAP-5) |
| TC-CEREMONY-061 | `tests/behaviour/ceremony-declaration.test.ts` (new); `tests/structure/ceremony-contract.test.ts` (new) | `bun test tests/behaviour/ceremony-declaration.test.ts tests/structure/ceremony-contract.test.ts` | D-14..D-18 fixtures, one declaration per legal derivation, the identity-resolver fixture | To Implement |
| TC-CEREMONY-062 | `tests/behaviour/ceremony-run-triggers.test.ts` (new) | `bun test tests/behaviour/ceremony-run-triggers.test.ts` | Single-trigger, multi-trigger and note-consuming multi-trigger declarations; notes naming a declared and an undeclared trigger; recording store; a genuine catch-up run as control | To Implement |
| TC-CEREMONY-063, TC-CEREMONY-064 | `tests/behaviour/ceremony-run.test.ts` (new) | `bun test tests/behaviour/ceremony-run.test.ts` | Note-less scheduled and note-less event-only declarations; fixed clock + two literal windows + a UTC-midnight fixture; byte-level artifact listing; recording declaration/input/state readers and writer | To Implement |
| Fixture set | `tests/fixtures/ceremony/**` (new); `tests/fixtures/help-guide/coverage.json` (update) | `bun test tests/checks/fixture-privacy.test.ts` | Declarations, notes, tier pairs, comparison samples, temp-git harness reuse | To Implement |

**Existing suites asserted unchanged (regression half only)**: the `retro-*` family (grammar, payloads, level registry, truth checks, chain), `closeout-*` (including R1 coverage and compaction), `brief-*`, `plan-*` (tier echo and `plan.tier.unknown`), `pm-notes-*`, `state-*`, the delivered `envelope-*`/`result-contract` suites, `tests/structure/{error-table,content-inventory,retro-contract,plan-contract}.test.ts` (updates only where additive), and the delivered `tests/checks/{error-table-sync,exit-code-literals,doc-conformance}.test.ts`.

### 7.1 Delivery-phase ownership (TC → PHASE, all 64 ids, exactly once)

The implementation plan owns the TC → PHASE map; its current map covers `TC-CEREMONY-001..060`. This subsection states the ownership of the complete 64-id set **on the plan's existing phase boundaries**, so the `delivery_planning` correction only has to copy four ids in (GAP-7) — no phase is re-cut and no TC moves.

| Plan phase (existing boundary) | TCs owned | Count |
|---|---|---|
| Phase 1 — declaration contracts, vocabularies, single validator | 007 (vocabulary/bounds half; its six-built-in validation half completes in Phase 5), 008, 009, 010, 049, **061** | 6 |
| Phase 2 — ceremony record boundary and artifact family | 040 (plus the state-read half of 022) | 1 |
| Phase 3 — runner engine (intake, agenda, verification, compaction, resume) | 020, 021, 022, 023, 025, 039, 047, **062, 063, 064** | 10 |
| Phase 4 — catch-up | 026, 027, 028, 029 | 4 |
| Phase 5 — built-ins and retro levels | 011, 012, 013, 014, 015, 016, 017, 018, 019, 024, 043, 044, 045, 046, 048, 052 (plus the 007 completion) | 16 |
| Phase 6 — project declarations | 030, 031, 032 | 3 |
| Phase 7 — tier engine | 033, 034, 035, 036, 037, 038, 051 | 7 |
| Phase 8 — measurement record | 041, 042 | 2 |
| Phase 9 — family mount | 001, 002, 003, 004, 005, 006 | 6 |
| Phase 10 — honesty battery (purity, determinism, bounds, cost, hermeticity, non-regression) | 050, 053, 054, 055, 056, 057 | 6 |
| Phase 11 — docs and release | 058, 059 (evidence-only, GAP-5), 060 | 3 |
| **Total** | `TC-CEREMONY-001..064` | **64** |

Ownership rationale for the four added ids — placement follows the plan's own rule ("the phase which first makes its complete suite set green") plus the shape of the case:

- **TC-CEREMONY-061 → Phase 1.** It is a declaration-contract case: `scopeKey` derivation legality and the single-schedule bound are validated by the same validator the phase delivers, over the fixtures the phase commits (D-15..D-18).
- **TC-CEREMONY-062, TC-CEREMONY-063, TC-CEREMONY-064 → Phase 3.** All three are intake cases: window resolution, run-identity resolution, and recorded-trigger resolution are decided in intake step 1, before any step executes. Phase 3 already owns the intake/idempotency cases (025, 039, 047), and each of the three runs on fixture declarations in that phase's gate.
- **Cross-phase assertion halves are named, not duplicated.** TC-CEREMONY-062's retro-specific assertions (the declaration's four-trigger set, the absent `change-merged` trigger, the absent R1 output) are carried by TC-CEREMONY-014 in the Phase 5 gate; TC-CEREMONY-063/064's production declarations (`morning-brief`, `decision-record-mirror-sync`) land in Phase 5 and are re-exercised there by TC-011/TC-013/TC-016's suites. Neither creates a second TC row, so the map still owns every id exactly once.

**Phase-count reconciliation for the plan correction**: Phase 1 5 → 6, Phase 3 7 → 10, total 60 → 64; every other phase count is unchanged. The plan's phase-summary lines for Phases 1 and 3 and its map header ("60 ids") are the only statements that need editing.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Residual Risks and Known Gaps

| Risk / gap | Why it remains | Mitigation in this plan |
|---|---|---|
| RSK-1 — the declaration vocabulary proves too narrow on first contact | Expressiveness is an empirical property of the six real rituals | The six built-ins are the proof and the parity suite is parametric; a missing vocabulary is a reviewed contract extension, and TC-CEREMONY-008's corpus pins the refusal path so an extension is visible |
| RSK-2 — the runner becomes an accidental scripting surface | Closed vocabularies are only as strong as the validator | TC-CEREMONY-010 asserts data-only structurally **and** behaviourally with a failing mutation; TC-CEREMONY-008 D-13 covers smuggled members |
| RSK-3 — mirror sync drifts or writes unintended places | It writes into other repositories by design | TC-CEREMONY-016/024/052: dry-run default, declared targets, clean/declared-base preconditions, equality in both directions, no force path |
| RSK-4 — a ceremony-share "improvement" claimed from too small a sample | The after window is necessarily young | TC-CEREMONY-042 asserts `insufficient-sample`, the observed `n`, and a scan for trend tokens in the change artifacts; `improved` requires the minimum |
| RSK-5 — the runner increases ceremony time | A runner can make rituals cheaper to run and therefore more frequent | Per-step durations (TC-040) make cost visible; ≤1 catch-up window (TC-026/029) bounds replay; the comparison exposes a regression instead of hiding it |
| RSK-6 — tier mapping drifts into a second vocabulary | Local copies of phase lists are easy to add | TC-CEREMONY-051 scans for literal phase sets and third tier names with failing mutations; sets are imported, never retyped |
| RSK-7 — the retro levels appear implemented in the pipeline | Two surfaces name the same levels | TC-CEREMONY-046/057 assert the pipeline's grammar and registry status are unchanged and the ceremony layer selects levels |
| RSK-8 — the measurement-log schema bump breaks a v1 consumer | Consumers may pin `schema_version: 1` | TC-CEREMONY-041 asserts the bump is additive, existing rows byte-unchanged, and no `MET-` ID reallocated |
| RSK-10 — a stale artifact reads as verified | Files persist forever | Artifacts are named by run id; a step verifies the artifact it just wrote; resume reads only verified records of the same run (TC-020/021) |
| Residual risk — a run identity resolved from an undefined scope key or a non-existent window | The identity is what makes re-runs and dedupe meaningful, and four of six built-ins take no note | TC-CEREMONY-061 asserts the declaration-held derivation and refuses an undefined/ambiguous key; TC-CEREMONY-063 asserts note-less idempotency on the derived day; TC-CEREMONY-064 refuses a note-less event-triggered run with no window before any write |
| GAP-2 — some closed-vocabulary literals are not spec-pinned | The spec fixes sets, not every string | Assertions go through declared contract constants in `tests/structure/ceremony-contract.test.ts`; goldens pin prose at delivery |
| GAP-3 — NFR-13 wall-clock budgets are runner-dependent | Thresholds depend on hardware | CI asserts bounded work; wall clock is a recorded reference measurement in §10, never a gate |
| GAP-4 — mirror sync requires temp-git fixtures | Real writes cannot be tested in the live tree | Isolated temp repositories; the commit primitive is composed, not re-implemented |
| GAP-5 — AC-NFR14-1's process half is not suite-assertable | PR state is external to the tree | Phase-9 log, commit-range gate, and PR metadata evidence (TC-CEREMONY-059) |
| Residual risk — a passing parity suite on synthetic inputs does not prove real-world fidelity | Fixtures are synthetic by mandate | The `artifact-*` verifiers are asserted against production schemas (`delivery.brief.v1`, the note schema, the mirror set), not against test-invented shapes |

### 8.2 Assumptions

- The declared local reads (collector facts, brief projection, retro evidence and registry, spend fold, audit ledger, harness telemetry, queue/lane facts, tracker state, pm-notes, decision register, measurement log, memory tree) are sufficient for the six built-ins; no new collector is added.
- Environmental state (clock, ids, fence tokens, brand, input readers, state port) is injected exactly as every other surface injects it, so a run is reproducible in process with no network, credential, or child process.
- `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` and `PLAN_KNOWN_TIERS` are the delivered sources; the tier engine imports them rather than restating them.
- The committed measurement log remains the `MET-` allocator; `MET-CEREMONY-SHARE` is reused because its definition does not change.
- The mirror sync target repositories are test-local clones; the production path composes the delivered commit primitive and checkout preflight, which this plan does not re-test.
- The retro archive in the committed memory tree is the note home, and its index is regenerated by the delivered convention rather than by this runner.
- A plan's `tier` and a change's pm-notes `variant` normally agree; disagreement is an anomaly to report (TC-CEREMONY-034), not a state to resolve.
- The five closed escalation triggers are the lifecycle evidence that exists today; a sixth is a reviewed contract extension.

### 8.3 Open Questions

| ID | Question | Blocking status | Owner |
|----|----------|-----------------|-------|
| OQ-T1 | The spec leaves OQ-1 (run-history read verb), OQ-2 (native aggregate figures in the comparison), and OQ-3 (blocking vs advisory `pre-dispatch`) non-blocking with proposed resolutions. Does plan authoring adopt the proposals? | Non-blocking for this plan; if OQ-2 is adopted, TC-CEREMONY-041's `nativeBasis` assertions extend (GAP-6). If OQ-3 is changed to blocking, a new TC is required before delivery. | @plan-writer |
| OQ-T2 | Where exactly does the delivering change's `after` sample come from (which post-boundary changes, which window), given the runner ships in this change? | Non-blocking for the plan's structure — TC-CEREMONY-041 asserts the record's declared sourcing and AC-F8-3 makes `< 5` honest; the concrete sample is a delivery-time fact. | @plan-writer → @coder |
| OQ-T3 | Exact declared contract-constant names and closed-vocabulary literals (carry-over reasons, assess reason strings, finding sub-codes) beyond the spec-pinned sets (GAP-2). | Non-blocking; pinned with the contract suite and goldens at delivery. | @coder (delivery, contract task) |
| OQ-T4 | Does `ceremony list` last-run summary include a duration, and if so from which fold? | Non-blocking; asserted through the declared contract constant either way (TC-CEREMONY-006). | @coder |
| OQ-T5 | **Resolved** — Spec Appendix B (C-1) cited an NFR-tier criterion id that §17 never declared. Was the reference stale, or was a sixth NFR acceptance criterion intended? | Resolved in the spec: C-1 now cites `NFR-1, AC-F1-3`, both declared. That correction added no criterion; the four criteria added later by the v1.1 remediation are tracked in OQ-T6. | @spec-writer / @pm (closed) |
| OQ-T6 | Spec v1.1 added four criteria (AC-F2-4, AC-F3-8, AC-F4-7, AC-F4-8) with DEC-16..DEC-18 and edge cases E-18..E-20. Does anything else in the spec's v1.1 delta change an existing oracle? | Closed in this revision: the delta's only stale pre-existing assertions were TC-014 step 3 (trigger kind for an operator run) and TC-009's bound ladder (missing trigger rung), both updated in §5.2; AC-F2-3's generic "declared bound" clause now also exercises the `triggers[]` count, with the criterion's parenthetical left exactly as §17 states it. No other AC's oracle moved. | @test-plan-writer (closed) |
| OQ-T7 | Is the `triggers[]` at-limit of 8 reachable with unique trigger names? The closed event set has six members and only one `schedule` trigger is legal, so at most seven unique triggers exist. | Non-blocking for coverage: the over-limit rung (9 triggers → `triggers[]`) is unaffected, and the at-limit rung is built by repeating a declared event name (TC-009). Whether a repeated trigger name is itself a vocabulary defect is a contract-constant decision at delivery (GAP-2); if repeats are refused, the at-limit proof moves to the unique maximum and the assertion set shrinks by one rung. | @coder (delivery, contract task) → @spec-writer if the bound should be restated |
| OQ-T8 | After an explicit `ceremony run` records an identity for a window, does a later `catch-up` for that same window replay it (`catch-up` kind) or return the explicit run as `data.reused: true`? | Non-blocking: the spec pins "an explicit run is never counted as the fulfilment of a scheduled or event obligation" but not the identity-collision outcome. TC-CEREMONY-062 asserts the obligation predicate and the recorded kinds only; the collision case is deliberately unasserted until the spec pins it. If the spec answers "replay", TC-062 gains a step; if "reused", the obligation rule needs a wording note. | @spec-writer → @pm |
| OQ-T9 | Does "refused before any read" in F-1/E-18 exclude the declaration read that establishes a declaration is event-only? | Non-blocking, wording-level: the declaration must be read to know its trigger set, so TC-CEREMONY-064 asserts the mechanically real form — zero declared-input reads, zero verified state reads, zero writes, zero records, zero artifacts — and treats the declaration read as permitted. If the spec intends a stricter reading, the wording needs to say what "read" excludes. | @spec-writer |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | @test-plan-writer | Initial test plan for GH-296 (M2-S3 ceremony runner): 60 scenarios (TC-CEREMONY-001..060) covering all 45 ACs, DM-1..DM-9, and NFR-1..NFR-14 with no unanswered ACs; inherited seeds SC-M2-S3-01/02 adopted by ID as TC-048/047; catch-up matrix CU-01..CU-09, tier verdict matrix T-01..T-11, declaration defect corpus D-01..D-14, resume/verification matrix R-01..R-08, and the exit/outcome oracle; binding fixture, non-vacuity and mutant contracts mirroring the GH-240/GH-291 precedents; gaps GAP-1..GAP-6 declared with owners and AC-NFR14-1 flagged as evidence-only |
| 1.1 | 2026-11-16 | @test-plan-writer | Readiness remediation (spec v1.1, `readiness-review/readiness-iter-1.md` findings 1 and 4). Added four scenarios for the four new criteria: TC-061 (AC-F2-4: declaration `scopeKey` derivation set, `note`-derivation legality, single-schedule bound, refusals naming `scopeKey`/`triggers[]`), TC-062 (AC-F3-8: `explicit` trigger kind with `note`/`declaration`/`unspecified` resolution, never an obligation, undeclared note trigger refused), TC-063 (AC-F4-7: note-less scheduled `morning-brief` twice in one UTC day → derived day window, `repository` key, `data.reused: true`, zero appends), TC-064 (AC-F4-8: note-less event-triggered `mirror-sync` without `--window` → `input.value.rejected` naming `--window`, zero records/artifacts). Modified two existing scenarios where the spec's change made an assertion stale: TC-009 gained the 8/9-trigger rung (the `triggers[]` 1..8 bound was untested) and TC-014's trigger assertion moved from kind-equality to `explicit`/`note` with the four-trigger declaration set and the `change-merged` refusal added (DEC-17), preserving its R1-absence assertion. Extended the declaration defect corpus with D-15..D-18 and D-12's trigger case, the exit/outcome oracle with four rows (explicit-run recording, the undeclared note trigger, E-18, E-19), the non-vacuity mutants from twelve to fifteen, and the fixture/test-data contracts. Traceability restated at 49/49 ACs, 9/9 DMs, 14/14 NFRs over 64 TCs; §7.1 added to state the TC → PHASE ownership of all 64 ids on the plan's existing boundaries (061 → Phase 1; 062..064 → Phase 3) for the separate `delivery_planning` correction; GAP-1 corrected (the plan now exists and owns 001..060) and GAP-7 added; OQ-T6..OQ-T9 added |

## 10. Test Execution Log

No suites were run while authoring this plan. This log is populated during delivery (phase 6) and quality gates (phase 9). The NFR-13 reference measurements (TC-CEREMONY-055, GAP-3) and the phase-9 gate evidence for TC-CEREMONY-058/059 are recorded here.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Awaiting delivery |
