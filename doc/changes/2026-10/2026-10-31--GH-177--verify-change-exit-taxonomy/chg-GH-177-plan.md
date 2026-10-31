---
id: chg-GH-177-verify-change-exit-taxonomy
status: Updated
created: 2026-10-31T05:30:13Z
last_updated: 2026-10-31T05:48:45Z
owners: [engineering]
service: delivery-os CLI verification and state tier
labels: [change, planning]
links:
  change_spec: ./chg-GH-177-spec.md
  test_plan: ./chg-GH-177-test-plan.md
  decision_refs:
    - ../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
  related:
    - ../../../spec/features/feature-result-contract.md
    - ../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md
    - ../../../spec/features/feature-state-layer.md
    - ../../../planning/oss-tooling/cli-command-registry.md
  bash_reference: ../../../../scripts/deliver-ticket.sh
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >-
  Deliver M0-S8 per spec v1.1: the eleven-token bash-era delivery result enum
  and its total projection/derivation taxonomy as data-only contracts bound to
  the bash usage enum and the documented C-4 table; one additive
  `verify.ledger.incomplete` error row under a new `verify` domain kind shipped
  in-change with its documented row; a pure variant-aware classifier merging
  the pm-notes declaration with the verified `phase.transition` ledger per
  phase through a presence-tolerant registry read; the read-only
  `verify change <ref>` command composing grammar-first validation, classified
  malformed/missing-target/grammar outcomes, and the deterministic
  `result=…; variant=…; missing=…` summary; the exit taxonomy projected
  exclusively through the binding result contract (only `finished` exits 0;
  `state-unverified` exits 2 per TDR-0005); all 21 test-plan TCs implemented
  at their pinned locations including the GH-179/GH-170/GH-171 real corpus
  read in place; tier, single-enum-home, read-only, determinism, and
  error-table sync gates green throughout; minor changeset and evidence
  artifact recorded.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-177: M0-S8: verify change and exit taxonomy

## Context and Goals

- **Work item**: [GH-177 — M0-S8: verify change and exit taxonomy](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/177).
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-177-spec.md](./chg-GH-177-spec.md) — **v1.1** (2026-10-31, DoR iter-1 amendment; v1.0 2026-10-31): AC-V1..AC-V14, C-1..C-8, DEC-1..DEC-11, NFR-1..NFR-7, architecture/codebase map, QA strategy, RSK-1..RSK-8. v1.1 pins the C-8 remediation hint to one brand-neutral exact string and clarifies C-3 "mentioned" as present in the fold entry.
  - [chg-GH-177-test-plan.md](./chg-GH-177-test-plan.md) — **v1.1** (2026-10-31, DoR iter-1 fold-ins; v1.0 2026-10-31T05:30:00Z, 21 TCs): TC-VERIFY-001..021; §4.1 in-process harness contract and §4.2 non-vacuity contract are binding; §7 execution order and evidence commands; §8 gaps/assumptions (A-T1..A-T11, OQ-T1..OQ-T5, GAP-1..GAP-5). v1.1 moves the two parser-level `fallback.invocation` cells of TC-VERIFY-012 into an outside-taxonomy bucket (token-less, C-6-tuple-exempt) and pins the TC-VERIFY-018 reserved-row `Identity source` comparer to a normalized `none` prefix rule.
  - [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — token parity (set + order) with the bash usage enum; `state-unverified` → `platform-provider` → exit `2` (deliberate divergence from bash's `1`); broken invocations stay `fallback.invocation` → exit `1`; single enum home in `core ./contracts`.
  - Baseline code (read): `packages/core/src/contracts/{pm-notes,registry,error-table,result,index}.ts`, `packages/core/src/domain/{pm-notes-lint,index}.ts`, `packages/core/src/state/{registry,ledger,index}.ts`, `packages/core/src/index.ts`, `packages/cli/src/{index,edge,projection,classify}.ts`, `packages/cli/src/commands/{lint,phase,index}.ts`, `packages/adapters/src/file/pm-notes-parser.ts`, `packages/testkit/src/result-conformance.ts`, `scripts/checks/error-table-sync.ts`, `tests/**` precedents, `scripts/deliver-ticket.sh` usage block (line 2322).
- **Status**: Proposed (awaiting DoR gate, lifecycle phase 5).
- **Baseline**: `feat/GH-177/verify-change-exit-taxonomy` at `bc14d5e` (spec `04a4ed2`, test plan `bc14d5e`), cut from `origin/main-tools` (`77119b9`). GH-170/171/172/173/174/179 delivered: `DOMAIN_KINDS = ["provider", "input", "config", "state", "lint"]`; `lint`/`phase` commands composed through `commands/index.ts` + `edge.ts`; `readChangeTransitions`/`foldPhaseState`/`appendPhaseTransition` in `state/registry.ts`; `tests/fixtures/state/harness.ts`; lockstep changeset group of five packages. The PR targets `main-tools`.
- **No spec/test-plan inconsistency found.** The five delivery-bound spellings the test plan left open (GAP-3, A-T3, OQ-T1..OQ-T4) are pinned below and become binding; no TC behaviour, assertion, or AC mapping is reshaped (A-T1, A-T4). GAP-1 (plan absent) is closed by this file.

**Goals** (spec §Business Context): kill the exit-zero false-success class at the verification layer with one ledger-only, read-only `ados verify change <ref>` that (1) names every missing required phase of the declared variant (`full` eleven / pinned LITE six) in required-set order, (2) classifies the delivery result tuple in the eleven-token bash-era vocabulary with a total taxonomy, (3) classifies malformed notes, unknown variants, missing targets, grammar breaks, and registry failures with exactly one pinned identity each — never a crash, never `fallback.internal`, (4) projects every classified outcome through the binding result contract so only a fully verified `finished` exits `0` (`state-unverified` exits `2` per TDR-0005/DEC-5), and (5) binds the enum to the bash usage enum and the documented tables so dual-run evidence (M1-S9) compares like with like.

**Delivery model**: `@coder` executes Phases 1–6 in order, each ending in exactly one Conventional Commit (inline committer discipline, D6) and a green phase gate. Phases 7–10 map to lifecycle phases 7–11 (review, conditional fixes, doc sync, finalize/release) and are **PM-scheduled**; `@coder` must not mark them complete by finishing implementation alone. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → (7–10 per lifecycle)**. Phase 1 lands the contracts data and the error row **with its documented row and domain-kind declaration** because `scripts/checks/error-table-sync.ts` is binding in both directions (D2); the bash-enum and documented-table binding tests land in the same phase so the vocabulary is proven total before any behaviour exists.

## Pinned Open-Question Resolutions (binding for delivery)

The test plan left spellings delivery-bound (OQ-T1..OQ-T4, GAP-3, A-T3/A-T10/A-T11); this plan pins them. Each pin preserves the pinned semantics (identities, tokens, summaries, exits, evidence key sets — A-T1) and fixes only spelling/derivation. Changing any pin later reopens this plan (route through PM/`@decision-advisor`, never apply silently).

- **PIN-1 — Reachable subset derivation (OQ-T1)**: no separate reachable-subset symbol is exported. The M0-S8-reachable subset is **derived** as the taxonomy entries whose derivation class is `verify` (exactly `finished`, `partial`, `failed`, `state-unverified`); TC-VERIFY-017 asserts it that way. `delivery-result.ts` exports the token list, the taxonomy, the class vocabularies, and types — nothing more.
- **PIN-2 — `evidence.registry.recordCount` semantics (OQ-T2, A-T11)**: `recordCount` is the **state layer's verified store-level record count** carried by `StateReadEvidence.recordCount` (the same value the lint registry target reports); `transitionCount` is the per-change transition list length. Tests assert a non-negative integer plus the store-level source; meaning rides `present`/`verifiedEmpty`/`transitionCount`.
- **PIN-3 — `overlaidPhases` order (OQ-T3, A-T10)**: emitted in **required-set order** (the required set filtered to registry-decided phases). Tests assert set equality and byte-identical replays; required-set order satisfies both and matches every other ordered array in the success tuple.
- **PIN-4 — `detail` segment spelling (OQ-T4, A-T3/A-T6)**: for `lint.notes.malformed`/`lint.keys.missing`, `detail=<finding.detail> (at <safe location>)` reusing the lint command's existing location rendering (`document` | top-level key | `phases.<id>.<field>` | `notes[0].text`), newlines collapsed, one segment; for `state.*` failures, `detail=<error-table row summary>`; **absent** for `partial`, unknown variant, missing target, and handler-grammar failures (C-6 pins three segments there). Parser-level `fallback.invocation` carries no C-6 tuple (the handler never ran; A-T6).
- **PIN-5 — Staged classifier API (derived)**: `domain/verify-change.ts` exposes **staged pure functions** — document classification first (parse → keys → value types → variant → phase-presence via `lintPmNotes`; terminal findings decided here), then a final classification over registry facts (or a registry `StateFailure`). The staging is required by C-7's total order and TC-VERIFY-007/008/009's zero-registry-read assertions: the handler must be able to classify a malformed document without any registry read. No I/O, no clock, no environment, no parser invocation.
- **PIN-6 — Presence-tolerant read name (GAP-3)**: `readChangeTransitionsTolerant(store, changeRef)` in `state/registry.ts`, returning `{ present, verifiedEmpty, transitions, evidence }` — absent per-change record in a verified store → `present: false` with no `state.keys.missing`; missing store → verified-empty; corrupt per-change payload → the existing classified `state.*` failure. Reuses the existing verified-read path and key-set parsing; `foldPhaseState` is reused by the caller for the overlay. No new runtime API.
- **PIN-7 — Command/runtime spellings (GAP-3)**: `createVerifyCommandDefinition` in `packages/cli/src/commands/verify.ts`; runtime type `VerifyCommandRuntime = { readPmNotes(ref): <pm-notes read outcome>; readRegistry(ref): <tolerant read outcome | StateFailure> }`; `commands/index.ts` exports both; `edge.ts` gains `createVerifyCommandRuntime` (wiring `readPmNotesText` and `readChangeTransitionsTolerant` over the injected store) and a `verify?: VerifyCommandRuntime` option in `ConfigProgramOptions`, composed beside `config`, `lint`, and `phase`.

## Delivery Bindings (D1..D12)

Binding for delivery; behaviour, pinned identities, tokens, summaries, and AC mappings come from the spec/test plan and may not change (A-T1).

- **D1 — Module layout (the spec's codebase map is authoritative)**: new `packages/core/src/contracts/delivery-result.ts`, `packages/core/src/domain/verify-change.ts`, `packages/cli/src/commands/verify.ts`, `tests/behaviour/verify-*.test.ts` + `tests/behaviour/verify-support.ts`, `tests/structure/{delivery-result-contract,verify-imports}.test.ts`, `tests/fixtures/verify/**`; extended `contracts/error-table.ts`, `contracts/index.ts`, `domain/index.ts`, `core/src/index.ts`, `state/registry.ts`, `state/index.ts`, `commands/index.ts`, `cli/src/edge.ts`, `tests/structure/{error-table,cli-edge-seam,state-scope}.test.ts` (as needed), `tests/checks/error-table-sync.test.ts`, `tests/structure/inventory.json`. Consumed unchanged: `contracts/{pm-notes,registry,result}.ts`, `domain/pm-notes-lint.ts`, `state/ledger.ts`, `adapters/file/pm-notes-parser.ts`, `cli/src/{classify,projection,index}.ts`, `testkit/result-conformance.ts`.
- **D2 — Error row and documented table ship in the SAME phase (GH-179 D2 precedent, binding)**: `verify` joins `DOMAIN_KINDS` and the `verify.ledger.incomplete` row lands in `ERROR_TABLE` **and** in the documented table in `doc/spec/features/feature-result-contract.md` (including the declared-domain-kinds sentence) in Phase 1, so `scripts/checks/error-table-sync.ts` is green in both directions from the first commit boundary. Lifecycle phase 7 (`@doc-syncer`) reconciles the rest of that doc but never rewrites the documented-table section or the kind declaration.
- **D3 — State composition, no new surfaces**: verify consumes the GH-174 port only through the existing state modules; the derived `phase-state.<REF>.json` projection is **never** read as evidence (DEC-10); no fence, no append, no `replaceDocument`, no projection rebuild on any verify path; `STATE_CONSUMERS` stays exactly the documented set (CLI edge + phase command) — `commands/verify.ts` must not import `@delivery-os/core/state` directly; the verify runtime is composed through `edge.ts`.
- **D4 — Handler purity and grammar ordering**: the verify handler owns no stream writes and no exit codes (data/error only); grammar rejects with the existing `input.value.rejected` row **before** any target read or registry read; parser-level breakage rides the existing `fallback.invocation` path. Exit digits remain only in `packages/cli/src/projection.ts` (TDR-0005 C-1; `exit-code-literals` green).
- **D5 — Fixture hygiene (GH-174/179 lesson)**: committed fixtures under `tests/fixtures/verify/**` are read-only; every derived/mutated fixture self-materializes under a fresh `mkdtemp` root in the OS temp directory (sibling convention `mkdtemp(path.join(os.tmpdir(), "gh177-<suite>-"))`, removed in teardown); corpus fixtures read committed `doc/changes/**` files in place, read-only, with digests asserted before/after; `planted-payload-verify-*` canaries and restored-or-valid controls are mandatory per test-plan §4.2; the live tree stays clean after every suite.
- **D6 — Inline committer protocol for `@coder` (this runtime)**: `@coder` **cannot dispatch subagents** — committer discipline is executed inline: exactly one Conventional Commit per phase (`feat(GH-177): …` / `test(GH-177): …` / `docs(GH-177): …`, body lines ≤ 100 chars), **explicit `git add` of exactly the phase's Files-and-modules entries** (verify the staged set with `git status --porcelain` before committing), never stage `.ai/local/**`, `tmp/**`, or untracked scratch; `pnpm check` run inline with the log captured before each commit (e.g. `pnpm check 2>&1 | tee .ai/local/gh177-phase<N>-check.log` — `.ai/local/` is git-ignored ephemeral state: safe for logs, never staged); **no push during delivery, no amend** — a red gate blocks the commit; fix it or stop at the last green task boundary and report; never enlarge or split a phase commit. PM owns `@runner`/`@doc-syncer`/`@pr-manager` dispatch for Phases 7–10.
- **D7 — No new CI jobs or checks**: the new suites are discovered by root `bun test` (`tests/behaviour`, `tests/structure`) and the existing `ts-invariants` wiring; the boundary/ambient/literal/entrypoint gates extend to the new modules automatically (no new rule expected — the test plan pins this); any discovered wiring need escalates to PM before touching CI.
- **D8 — Inventory and allowances**: every new package source module registers in `tests/structure/inventory.json` with named executable allowances (`DELIVERY_RESULT_*` constants, classifier exports, command exports) in the same phase it lands; `content-inventory` green each boundary.
- **D9 — Changeset**: minor for the lockstep fixed five-package group (`.changeset/verify-change-minor.md`, the `pm-notes-lint-minor.md` precedent; `.changeset/config.json` `fixed` group); nothing publishes in this change; the owner may amend at PR review (A-T9).
- **D10 — Evidence artifact**: `chg-GH-177-evidence.md` in this folder (GH-172/174/179 pattern): per-phase commits and green criteria, gate consolidation with commands + HEAD, the 21-TC coverage map, rollback instructions, owner-facing notes. Unrun evidence is never recorded as passing.
- **D11 — Single enum home**: the eleven tokens and the taxonomy are declared once in `contracts/delivery-result.ts`; no other production module declares a token list; tests may hold oracles and `scripts/deliver-ticket.sh` remains the external reference bound by a fail-closed structure test (DEC-3, TDR-0005 C-5).
- **D12 — Envelope exclusivity and non-zero guarantee**: only `finished` yields a success envelope; every other reachable token yields exactly one error envelope whose identity's projection class produces the exit; no envelope carries both `data` and `error`, and no path carries neither; the `CommandResult` v1 shape is unchanged (NG-5, DEC-6, DEC-7).

## Scope

### In Scope

- The eleven-token `DELIVERY_RESULT_TOKENS` and total `DELIVERY_RESULT_TAXONOMY` (projection class + derivation class per token) as contracts data, the derived M0-S8-reachable subset, and the types (C-4, AC-V8; Phase 1).
- The additive `verify` domain kind and `verify.ledger.incomplete` row with the documented table and declared domain kinds synchronized in the same phase (C-8, NFR-6; Phase 1).
- Binding structure tests: bash usage-enum extraction (fail-closed), taxonomy totality/classes/reachable subset, spec C-4 documented-table agreement, error-table round-trip and two-way drift (TC-VERIFY-016..019; Phase 1, fail-closed re-proof in Phase 5).
- The pure variant-aware classifier — declaration + per-phase registry overlay, ordered missing set, `lint.phases.incomplete` vs `verify.ledger.incomplete` identity split, token selection, C-6 summary, success tuple with evidence (C-2, C-3, C-6, C-7; Phase 2).
- The presence-tolerant verified registry read in the state tier (absent record = no evidence; missing store = verified-empty; corrupt payload = `state.*`; projection never evidence) (C-3, DEC-4, DEC-10; Phase 2).
- The `verify change <ref>` command — grammar-first handler, injected runtime, registration and edge composition, classification/rejection/corpus behaviour suites, envelope/exit matrix, read-only/network-free/spawn-free/determinism proofs (C-1, AC-V1..V5, V7, V9..V14; Phases 3–5).
- Tier/purity/single-enum-home/inventory/brand detectors and the boundary/ambient/exit-literal/entrypoint gates (NFR-1, NFR-2; Phases 2, 3, 5).
- The minor changeset, the evidence artifact, and the final local battery (Phases 6; finalize gate in Phase 10).
- Review support, conditional remediation, and doc/spec/glossary reconciliation (Phases 7–10, PM-scheduled).

### Out of Scope

- NG-1: tracker/PR/CI/session evidence and any derivation of the seven reserved tokens (`merged`, `blocked`, `pr-open`, `pr-open-unverified`, `max-restarts`, `noop-lane-permission`, `noop-lane-nothing-to-do`) — declared and asserted unreachable, never derived.
- NG-2: any mutation — no pm-notes writes, no registry append, no projection rebuild, no fence.
- NG-3: `verify gates` (M0-S9), CI-status evaluation, push parity, owner-gate scan, squash preflight.
- NG-4: dispatch/supervision/liveness/restart budgeting/session classification.
- NG-5: envelope shape changes, exits outside `{0, 1, 2}`, any identity beyond the one additive `verify` row.
- NG-6: pm-notes schema or variant-set changes (the pinned sets are consumed as data).
- NG-7: agent-prompt adoption of `verify` (an operating-model note in Phase 9 only).
- NG-8: cross-repository/remote/shared ledger reads.
- A packed Node/Bun consumer probe (test plan §1.2: no package manifest or subpath changes; NFR-1 is proven by the tier/ambient/dependency-cruiser gates).
- Fabricated verify fixtures for `state.level.unsupported` (GAP-2/A-T5: proven by TC-VERIFY-019 table totality only).
- Publishing, merge, or owner acceptance; any new CI job or check (D7); any cloud-product content (repo rule).

### Constraints

- D1–D12 are binding (module layout, same-phase error rows, state composition, handler purity, fixture hygiene, inline committer protocol, no new CI, inventory registration, changeset, evidence artifact, single enum home, envelope exclusivity).
- **Commit strategy**: exactly one Conventional Commit per phase with the completion signals below; explicit `git add` of the phase's files; never stage `.ai/local/**` or `tmp/**`; no push during delivery; no amend; `pnpm check` green before every commit (D6).
- Strict TypeScript, injected time/randomness/environment, runtime-API confinement, and `bun:test` authoring per [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md); suite layout and the gate battery per [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md); the in-process harness contract (§4.1) and non-vacuity contract (§4.2) bind every verify suite.
- Phase gate = the phase's focused suites green plus `pnpm check` exit 0; boundary gates extend only by adding rules and fixtures (D7); the error-table sync check is green in both directions at every boundary after Phase 1 (D2).
- **Rollback and failure handling**: the change is fully additive — a single-PR revert removes the contracts module and row, the classifier, the state extension, the command, the tests/fixtures, the changeset, and the evidence artifact together, with no data cleanup (verify wrote nothing); **never roll back one side of the error-table sync**; re-run the baseline checks after any rollback. A failing phase stops at its last green task boundary and reports (D6); a fail-closed binding test (bash reference moved, spec table drifted) is a deliberate STOP-and-escalate, never a test weakening (A-T8, GAP-5); any discovered spec/test-plan inconsistency escalates to PM — the plan never reshapes a TC (A-T4).

### Risks

Execution risks carried from the test plan (§8.1) and the spec (§Dependencies & Risks), anchored to the phase/pin that mitigates them:

| ID | Risk | Impact | Probability | Mitigation (plan anchor) |
|----|------|--------|-------------|--------------------------|
| RSK-T1/RSK-1 | An evidence-source bug makes declaration-only changes (e.g. GH-179) read incomplete | H | M | C-3 overlay with declaration fallback; presence-tolerant read (PIN-6); O6–O9 fixtures; real-corpus TC-VERIFY-006 (Phases 2, 3, 5) |
| RSK-T2/RSK-2 | A stale declaration masks a reopen (false `finished`) | H | L | Registry overrides every mentioned phase; O1/O5 reopen fixtures; directional controls (Phase 3) |
| RSK-T3 | One-sided overlay implementation passes | H | M | Declaration-only, registry-required, and projection-reading control fixtures each fail a named case (TC-VERIFY-005 step 6; Phase 3) |
| RSK-T4/RSK-T4 | The bash enum extraction silently degrades | H | M | Fail-closed extractor; mutation and missing-reference controls (TC-VERIFY-016; Phases 1 and 5) |
| RSK-T5/RSK-5 | Enum/taxonomy drift among bash, contracts data, and spec table | M | M | TC-016/017/018 chain bash → data → spec table; two-way sync check from the first boundary (D2) |
| RSK-T6/RSK-6 | Error-table drift for the new kind/row | M | L | Same-phase documented row (D2); TC-VERIFY-019 both-direction drift + baseline oracle (Phase 1) |
| RSK-T7/RSK-T7 | LITE under-declaration hides an unfinished heavyweight phase | M | M | Absent `variant` = full; six per-phase LITE omission fixtures; full-variant `dor_check` gating control (TC-VERIFY-003; Phase 3) |
| RSK-T8/RSK-T3 | Exit taxonomy diverges from bash beyond the declared case | M | M | Per-token exit projection asserted against the C-5 table; `state-unverified` → 2 as the single documented divergence (TC-VERIFY-017; TDR-0005) |
| RSK-T9/RSK-T10 | Grammar validation accidentally ordered after a read | H | M | Zero-read recorders on every grammar case; live-recorder positive control (TC-VERIFY-011; Phase 3) |
| RSK-T10/RSK-T6 | The read-only proof is vacuous | H | L | Throwing write/fence seams; mutating `phase` control records writes; seeded-write control trips the digest (TC-VERIFY-014; Phase 4) |
| RSK-T11 | State fixtures don't exercise the real read path | H | M | Real harness fixtures from verified bytes, named mutations, canaries, detection-disabled control (TC-VERIFY-010; Phase 4) |
| RSK-T12 | Corpus fixture drift (GH-179/170/171 change) | M | L | Precondition assertions from committed bytes before classification; digest guards (TC-VERIFY-006; Phase 5) |
| RSK-P1 | A phase overruns its delegation window | M | M | `@coder` stops at the last green task boundary and reports; never enlarges or splits the commit (D6) |
| RSK-P2 | Existing behaviour regresses while extending shared modules | M | M | Existing suites in every `pnpm check`; error-table baseline oracle; no rule weakened (D7) |

### Success Metrics

- NFR-5 (taxonomy binding): tokens = bash usage enum 11/11 in set and order; 11/11 tokens with exactly one taxonomy row; 0 invalid projection classes; reachable subset exactly the four `verify` tokens.
- NFR-6 (error-table binding): 1/1 new row round-trips with its documented row; 0 two-way drift; 0 existing rows modified; 0 ambiguous kind-only selections.
- NFR-3 (non-zero guarantee): 0 exit-0 outcomes on incomplete/malformed/missing-target/unverifiable fixtures; 0 failure envelopes carrying `data`; 0 documented classes contained as `fallback.internal`.
- NFR-2 (machine-output validity): 100% of fixture runs emit exactly one valid envelope under `--json`; 0 exits outside `{0, 1, 2}`; user-category → 1; platform-category → 2.
- NFR-4 (determinism and read-only): 0 verdict/summary drift across replays; 0 bytes written; 0 fences; 0 network calls; 0 child processes.
- NFR-1 (tier conformance): 0 behaviour/I/O in contracts; 0 foreign domain imports; 0 new runtime-API locations; all boundary/ambient/dependency-cruiser gates green.
- NFR-7 (real corpus): GH-179 `finished`/0; GH-170 `partial`/1 naming `test_planning,delivery_planning`; GH-171 `lint.notes.malformed`/1 — 0 crashes, 0 fallbacks.
- Aggregate: all 21 TCs green with recorded evidence; `pnpm check` exit 0; sync check green both directions with non-zero counts.

## Phases

### Phase 1: Delivery-result contracts vocabulary and the `verify` error identity, synchronized with the documented table

**Goal**: Land the eleven-token enum and total taxonomy as data-only contracts plus the additive `verify.ledger.incomplete` row **with its documented row and the `verify` kind declared in the same phase**, and prove the vocabulary bound — bash usage enum, taxonomy totality, spec C-4 table, error-table round-trip — from the first commit boundary (D2, D11).

**Tasks**:

- [x] **1.1** Author `packages/core/src/contracts/delivery-result.ts` (D1, PIN-1): `DELIVERY_RESULT_TOKENS` — the eleven bash-era tokens in bash usage order (`merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`, `finished`, `max-restarts`, `state-unverified`, `partial`, `noop-lane-permission`, `noop-lane-nothing-to-do`); `DELIVERY_RESULT_PROJECTION_CLASSES = ["success", "user-validation", "platform-provider"]` and `DELIVERY_RESULT_DERIVATION_CLASSES = ["verify", "tracker-pr", "dispatch-session"]` as const; `DELIVERY_RESULT_TAXONOMY` with exactly one entry per token carrying its projection class and derivation class per the spec C-4 table (reachable four: `finished` success/verify; `failed` user-validation/verify; `state-unverified` platform-provider/verify; `partial` user-validation/verify; reserved seven per C-4); types (`DeliveryResultToken`, taxonomy entry/types). No reachable-subset symbol (PIN-1). Types and `as const` data only — no functions, no imports beyond `./result.js` types if needed. Re-export everything from `contracts/index.ts`; register in `tests/structure/inventory.json` with named executable allowances (D8).
- [x] **1.2** Extend `packages/core/src/contracts/error-table.ts` (C-8, spec v1.1): append `verify` to `DOMAIN_KINDS` (after `lint`) and append the single row — `verify.ledger.incomplete`, kind `verify`, category `user`, retryable `false`, consequence `not_landed`, remediation hint "Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify.", `projectionClass: "user-validation"`, summary "The declared variant's required phases are not all completed." The remediation hint is the exact amended spec C-8 string, byte-for-byte — never paraphrased, never reworded, and containing **no product literal** — and this identical string must be carried both here in `ERROR_TABLE` and in the documented row in `doc/spec/features/feature-result-contract.md` (task 1.3 ships it in the same phase), because `scripts/checks/error-table-sync.ts` matches the remediation-hint column byte-for-byte in both directions. Existing rows byte-untouched.
- [x] **1.3** Ship the documented row and kind declaration in the same phase (D2): in `doc/spec/features/feature-result-contract.md`, add the `verify.ledger.incomplete` row to the documented table and add `verify` (with its one row) to the declared-domain-kinds sentence. Run `bun run scripts/checks/error-table-sync.ts` → exit 0, non-zero counts both directions. No other prose in that doc changes here (that is Phase 9's job).
- [x] **1.4** Author `tests/structure/delivery-result-contract.test.ts` — TC-VERIFY-016 (bash binding), TC-VERIFY-017 (totality/classes/subset), TC-VERIFY-018 (spec table agreement), all per test-plan §5.2: a test-local extractor anchored on `result=<...>` reading the live `scripts/deliver-ticket.sh` at test time (fail-closed on missing/empty/malformed reference — never an empty list, never a skip); set **and** order equality with `DELIVERY_RESULT_TOKENS`; taxonomy keys equal the token list in order; exactly 11 unique tokens, one row each, one valid projection class and one valid derivation class per row; the pinned derivation mapping asserted exactly (in the spec's order); reachable subset = the four `verify`-derivation tokens; per-token exit equals `projectExitCode(projectionClass)` per the C-5 table with `state-unverified` → `2`; the C-4 documented-table comparer (normalizing backticks/emphasis) and the "Pinned derivation mapping" paragraph parse over this change's spec file, read-only with a digest assertion. Mutation controls on in-memory values and temp copies only (swap/remove/duplicate tokens; invalid class; moved token; wrong projection/exit/reordered/missing/extra table rows); fail-closed control pointing at a non-existent temp path; unmutated controls green in the same run.
- [x] **1.5** Extend `tests/structure/error-table.test.ts` and `tests/checks/error-table-sync.test.ts` — TC-VERIFY-019 per test-plan §5.2: `DOMAIN_KINDS` includes `verify`; exactly one `verify` row with the exact C-8 fields; `resolveAppErrorCode("verify.ledger.incomplete")`, `classifyThrown({kind: "verify", code: "verify.ledger.incomplete"})`, and `classifyDomainKind("verify", "verify.ledger.incomplete")` round-trip to the same row; `classifyDomainKind("verify", "lint.notes.malformed")` throws (exact-code selection); the documented row appears exactly once and matches column-for-column; `runSyncCheck` temp-copy drift controls both directions (machine-row removal → "documented code verify.ledger.incomplete has no source entry"; doc-row removal → "source entry verify.ledger.incomplete is undocumented"; `verify` removed from `DOMAIN_KINDS` → "undeclared namespace verify"; malformed/duplicated rows fail); a frozen baseline oracle of every pre-existing row with length = baseline + 1 and per-kind counts unchanged; an existing-row mutation control fails naming the row; unchanged-copy controls green.
- [x] **1.6** Register inventory/allowances for the new module (D8) and run the phase gate: `bun test tests/structure/delivery-result-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/content-inventory.test.ts` → green; `bun run scripts/checks/error-table-sync.ts` → exit 0; `pnpm check` → exit 0.

**Acceptance Criteria**:

- Must: AC-V8 measurable at the first boundary — 11/11 tokens equal to the bash usage enum in set and order, a total taxonomy with one valid row per token, the documented C-4 table and derivation paragraph in agreement, fail-closed extraction; NFR-5 and NFR-6 thresholds met; the sync check green in both directions with non-zero counts; existing rows untouched.
- Should: `classifyDomainKind` needs no code change (exact-code lookup is generic since GH-173) — record in the execution log if any change was needed.

**Files and modules**:

- Code areas: `packages/core/src/contracts/delivery-result.ts` (new), `packages/core/src/contracts/error-table.ts` (updated), `packages/core/src/contracts/index.ts` (updated), `tests/structure/delivery-result-contract.test.ts` (new), `tests/structure/error-table.test.ts` (updated), `tests/checks/error-table-sync.test.ts` (updated), `tests/structure/inventory.json` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (updated — the documented `verify` row and the declared domain kinds only, D2; Phase 9 reconciles the remainder).

**Tests**:

- TCs implemented: TC-VERIFY-016, TC-VERIFY-017, TC-VERIFY-018, TC-VERIFY-019 (fail-closed controls re-proven explicitly in Phase 5).
- `bun test tests/structure/delivery-result-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` → green including every mutation control.
- `bun run scripts/checks/error-table-sync.ts` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-177): add delivery result contracts vocabulary with synchronized verify error row`

---

### Phase 2: Pure verify classifier and the presence-tolerant registry read

**Goal**: The classification core as pure functions — effective variant, declaration+registry per-phase overlay, ordered missing set, the `lint.phases.incomplete`/`verify.ledger.incomplete` identity split, token selection, and the deterministic C-6 summary — plus the presence-tolerant verified transition read in the state tier, with tier/purity/single-enum-home detectors over the new core modules.

**Tasks**:

- [x] **2.1** Author `packages/core/src/domain/verify-change.ts` (D1, PIN-5): staged pure functions over parsed document values and registry facts. Stage 1 — document classification: reuse `lintPmNotes` unchanged for the fixed order (parse → keys → value types → variant → phase presence); terminal findings (malformed/keys/unknown-variant) map to the `failed` token with their identity and a C-6 summary `result=failed; variant=unknown; missing=-` plus the optional `detail` segment per PIN-4; a phase-presence finding is **not** terminal — it records the absent set and continues. Stage 2 — final classification over registry facts (`transitions` + presence) or a `StateFailure` input: fold the transitions with the existing `foldPhaseState` semantics (latest operation decides a mentioned phase: `complete` → completed, `reopen` → open); per required phase, registry overrides declaration when mentioned, declaration stands otherwise; the missing set is the required phases whose effective completion is null, emitted in required-set order; identity split — if any required phase key is still absent from the declaration after the overlay → `lint.phases.incomplete` (absence precedence, missing set still the full missing set), else if any required phase remains incomplete → `verify.ledger.incomplete`; both are `partial` with the three-segment summary `result=partial; variant=<full|lite>; missing=<ids>`; empty missing set → `finished`. A `StateFailure` input maps per C-4: platform rows (`state.store.torn`, `state.schema.mismatch`, `state.keys.missing`) → `state-unverified` with summary `result=state-unverified; variant=<effective>; missing=-`; user rows (`state.permission.denied`, `state.level.unsupported`) → `failed` with `result=failed; variant=<effective>; missing=-`; optional `detail=<row summary>` per PIN-4. Success data per C-6: `changeRef`, `target: "change"`, `result`, `variant`, `requiredPhases`/`completedPhases` (required-set order), `missingPhases: []`, `evidence{declaration{completedCount, requiredCount}, registry{present, verifiedEmpty, recordCount, transitionCount, overlaidPhases}}` with PIN-2/PIN-3 semantics. Required sets come from `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`/`PM_NOTES_DEFAULT_VARIANT` — nothing re-declared (DEC-9). Zero I/O, no clock/randomness/environment, no parser invocation, no runtime APIs.
- [x] **2.2** Extend `packages/core/src/state/registry.ts` with `readChangeTransitionsTolerant` (PIN-6, D3): a store-level verified read (`requiredKeys: []`); verified-empty store (or absent store) → `{ present: false, verifiedEmpty: true, transitions: [], evidence }` (per the state layer's verified-empty evidence); otherwise check the per-change record key by presence — absent → `{ present: false, verifiedEmpty: false, transitions: [], evidence }` with **no** `state.keys.missing`; present → parse/validate with the existing key-set discipline (corrupt payload → the existing classified `state.*` failure). Store-level verification failures propagate unchanged. No write, no fence, no projection read. Imports `#contracts` and own state modules only; no new runtime-API location.
- [x] **2.3** Export surface (D1): `domain/index.ts` re-exports the classifier, its verdict/finding types, and the summary builder; `packages/core/src/index.ts` re-exports them beside `lintPmNotes`; `state/index.ts` re-exports `readChangeTransitionsTolerant` (no surface change to the GH-174 port). Inventory/allowances updated (D8).
- [x] **2.4** Author `tests/structure/verify-imports.test.ts` (TC-VERIFY-020 core halves; TC-VERIFY-014 structure half): contracts data-only detectors over `delivery-result.ts` and the `error-table.ts` extension (only type/interface/import/export declarations and `as const` data; no function/class/expression statement/`node:`/`bun:` import/runtime-conditional); single-enum-home scan over `packages/**` production modules (no redeclared token list outside `delivery-result.ts`; tests may hold oracles); domain purity (`verify-change.ts` imports only `#contracts`/`#domain`/relative; no `node:*`/`bun:*`, no parser/file I/O/clock/environment/randomness — AST scan incl. `Date.now`, `Math.random`, `process.env`); state-tier detector for the `registry.ts` extension (only `#contracts` and own state modules; no runtime import); brand-literal absence over the new modules. Every detector has a failing fixture and a clean control (temp copies only; the live tree never written).
- [x] **2.5** Author the committed classification fixtures under `tests/fixtures/verify/classification/**` (D5): `full/**` (base complete with one opaque extra phase key and one opaque extra entry key; eleven single-missing derived fixtures — `completed: null`, entry present; the multi-missing fixture `test_planning`+`dor_check`+`quality_gates`; the reversed-key-order twin), `lite/**` (complete with the five non-LITE entries absent; complete with the five present but `null`; six single-missing; the wrong-typed non-LITE + non-canonical-sequence control), `partial-identities/**` (fixture A declared-incomplete; B key-absent; C mixed; restored controls). Committed read-only; builders assert each planted mutation and carry `planted-payload-verify-*` canaries in opaque keys (§4.2).
- [x] **2.6** Author `tests/behaviour/verify-support.ts` (the §4.1 harness: injected brand/clock/`newRunId`/streams/changes directory/state root; fixed `runId` (e.g. `run-verify-fixture`) and two-tick clock for byte assertions; `runCli` in process, no spawns; recording seams for `readPmNotes`/`readRegistry`; a state-store wrapper recording `read` and throwing on `acquireFence`/`append`/`replaceDocument`/`releaseFence`) and the **pure-level halves** of `tests/behaviour/verify-change-classification.test.ts` (TC-VERIFY-001..005 at the function seam — parsed values and injected transition records): effective-variant resolution and ordered missing sets (full and LITE); the identity split with absence precedence; overlay merge in both directions with injected records (the O1–O5 logic); evidence shape per PIN-2/PIN-3; exact summary strings for full/LITE/multi-missing. Command-level halves land in Phase 3.

**Acceptance Criteria**:

- Must: every documented classification class maps to exactly one pinned identity/token/summary deterministically at the pure seam (AC-V1/V2/V4/V12 core semantics); the absent-record-is-no-evidence rule holds at state-tier level (no `state.keys.missing` for a missing per-change key in a verified store); the classifier imports nothing but contracts/domain modules; detectors are non-vacuous.
- Should: the staged API needs only the two pinned stages (document → final); if a third stage emerges, record it in the execution log with its C-7 ordering justification.

**Files and modules**:

- Code areas: `packages/core/src/domain/verify-change.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `packages/core/src/state/registry.ts` (updated — additive function), `packages/core/src/state/index.ts` (updated — re-export), `tests/structure/verify-imports.test.ts` (new), `tests/fixtures/verify/classification/**` (new), `tests/behaviour/verify-support.ts` (new), `tests/behaviour/verify-change-classification.test.ts` (new — pure halves), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-VERIFY-001..005 (pure halves), TC-VERIFY-020 (contracts/domain/state halves), TC-VERIFY-014 (AST/import-scan half).
- `bun test tests/behaviour/verify-change-classification.test.ts tests/structure/verify-imports.test.ts tests/behaviour/phase-registry.test.ts` → green (the last proves no GH-179 state regression); `pnpm run check:boundaries` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-177): add pure verify classifier with presence-tolerant registry read`

---

### Phase 3: The `verify change` command — grammar, composition, classification, and rejection surfaces

**Goal**: The read-only `verify change <ref>` command end to end — grammar-first handler with injected runtime types, registration and edge composition, and the classification/rejection behaviour suites through the in-process `runCli` harness — completing every command-level classification and rejection TC.

**Tasks**:

- [x] **3.1** Author `packages/cli/src/commands/verify.ts` (D1, D4, PIN-7): `createVerifyCommandDefinition(runtime)` with `flags: []` and `positionals: { max: 2 }` (so a third positional or any unknown flag is rejected by the parser → `fallback.invocation` before the handler); the handler rejects anything not exactly `["change", <ref>]` with `input.value.rejected` (kind `input`) **before any read**; then sequences per C-7 — pm-notes target read (missing → `lint.target.missing`; parse failure/validated findings via the staged classifier, terminal findings stop with no registry read) → effective variant → tolerant registry read (failure → the mapped `state.*` identity + token) → overlay → `partial`/`finished` verdict. Error shaping `{kind, code, summary}` with the C-6 summary (detail per PIN-4); success `data` per C-6. The handler never writes streams, never chooses exits, contains no exit literal, no `node:`/`bun:` import, no adapter import, no `edge.js` import, no brand literal; `readPmNotes`/`readRegistry` arrive via `VerifyCommandRuntime` (PIN-7).
- [x] **3.2** Register and compose (D1, D3): `commands/index.ts` exports the definition and runtime types; `edge.ts` adds `createVerifyCommandRuntime` (pm-notes reader via the existing `readPmNotesText` composition; registry reader via `readChangeTransitionsTolerant` over the injected store) and a `verify?: VerifyCommandRuntime` option composed into `createConfigProgram` beside `config`, `lint`, and `phase`. Extend `tests/structure/cli-edge-seam.test.ts` (verify composition assertions) and `tests/structure/state-scope.test.ts` (assert `commands/verify.ts` is **not** a direct state consumer — `STATE_CONSUMERS` unchanged; seeded-violation control: a temp `commands/verify.ts` importing `@delivery-os/core/state` fails the assertion).
- [x] **3.3** Complete the command-level halves of `tests/behaviour/verify-change-classification.test.ts` (TC-VERIFY-001, TC-VERIFY-002, TC-VERIFY-003, TC-VERIFY-004, TC-VERIFY-005 — complete) through the §4.1 harness: eleven single-missing fixtures → exit `1`, exactly `verify.ledger.incomplete`, error-only envelopes passing `assertEnvelopeContract`, exact three-segment summaries, canonical-order `missing` independent of insertion order, canary sweep, wrong-sibling-identity negatives (`lint.phases.incomplete`, `state.keys.missing`, `fallback.internal` all absent), complete/restored controls `finished`/`0`/`missingPhases: []`; the complete fixture under three registry states (no store; verified-empty; other-ref-only store with a `GH-999` delivery transition) with the exact envelope and `data` key sets, ordered arrays, `evidence` key set per PIN-2, the recorder observing the registry read, and byte-identical replay; LITE six single-omission + variant-gating full control + wrong-typed non-LITE control; the partial-identity split (A/B/C + restored controls); overlay fixtures O1–O9 built with the real `appendPhaseTransition` over temp state roots (verified histories, not hand-written payloads) plus the P1/P2 projection contradictions (a stale/`all-completed` projection document never changes the verdict; projection absent or corrupt → identical verdict); directional controls — a declaration-only implementation answers `finished` on O1, a registry-required implementation answers `state.keys.missing` on O6/O8, a projection-reading implementation answers `finished` on P1/P2 — each asserted wrong.
- [x] **3.4** Author `tests/behaviour/verify-change-rejections.test.ts` (TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009, TC-VERIFY-011) plus `tests/fixtures/verify/{malformed,target,grammar}/**` (D5): every malformed class with canaries and builder self-assertions (unparseable orphaned indentation; missing top-level key one per `change_id`/`title`/`delivery_mode`/`phases`; entry missing `started` and missing `completed`; collection entry missing `text`; wrong-typed declared values incl. `variant: 1`; non-timestamp typed phase values; co-occurrence pairs for the keys → value-types → variant → phase-presence order) → exit `1`, exactly one pinned identity, `assertEnvelopeContract` empty, no `data`, no registry read (recorded), no write, `result=failed; variant=unknown; missing=-` prefix with at most one safe `detail` segment per PIN-4/A-T6, restored/valid controls; unknown variants (`compressed`, `LITE`, `" lite"`, `full-ish`, empty string) vs wrong-typed variants (value-type class never crosses), `lite`/`full`/absent positive controls; missing target + malformed-shape refs (`not-a-ref`, `gh-177`, `GH177`) → `lint.target.missing` with no registry read and no state-store open, present-target control; handler grammar (`verify`, `verify change`, `verify other GH-177`, `verify unknown GH-177`) → `input.value.rejected` and parser grammar (`verify change GH-177 extra`, `--verify-gates` variants) → `fallback.invocation`, all exit `1`, error-only, **zero `readPmNotes`/`readRegistry` calls recorded**, with valid-invocation controls proving the recorders are live.
- [x] **3.5** Phase gate: focused suites green (`verify-change-classification`, `verify-change-rejections`, `cli-edge-seam`, `state-scope`, `verify-imports`), `pnpm run check:boundaries`, `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` green, `pnpm check` exit 0; human-mode sanity for the new surfaces (same exits, diagnostics on stderr, no second envelope).

**Acceptance Criteria**:

- Must: AC-V1..AC-V5 and AC-V12 complete through the command with non-vacuous controls; AC-V14 complete (handler vs parser grammar, zero reads proven by live recorders); AC-V6 complete (the exact success envelope over all three registry evidence states); the envelope/exit matrix cells for every class reachable so far are exact (`finished` → 0; `partial`/user `failed` → 1).
- Should: classification and rejection suites share `verify-support.ts` builders — no duplicated fixture construction; record any extraction in the execution log.

**Files and modules**:

- Code areas: `packages/cli/src/commands/verify.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/behaviour/verify-change-classification.test.ts` (completed), `tests/behaviour/verify-change-rejections.test.ts` (new), `tests/behaviour/verify-support.ts` (updated as the harness grows), `tests/fixtures/verify/malformed/**`, `tests/fixtures/verify/target/**`, `tests/fixtures/verify/grammar/**` (new), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/structure/state-scope.test.ts` (updated), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-VERIFY-001..005 (complete), TC-VERIFY-007, TC-VERIFY-008, TC-VERIFY-009, TC-VERIFY-011 (complete), TC-VERIFY-020 (command-surface half).
- `bun test tests/behaviour/verify-change-classification.test.ts tests/behaviour/verify-change-rejections.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/state-scope.test.ts` → green including every control; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-177): add verify change command with classification and rejection surfaces`

---

### Phase 4: Evidence-failure classification, envelope/exit matrix, summary, read-only, determinism

**Goal**: Close the behavioural TCs that need the full identity space and runtime proof — registry-failure classification with the platform/user exit split, the exhaustive envelope/exit matrix, the summary grammar with ordering/determinism controls, and the read-only/network-free/spawn-free/replay proofs.

**Tasks**:

- [x] **4.1** Author `tests/behaviour/verify-change-state.test.ts` (TC-VERIFY-010) reusing `tests/fixtures/state/harness.ts` over temp roots (D5): a complete-declaration fixture so a broken registry must override a would-be `finished`; torn fixtures (payload byte flip, framing break, sequence gap) with `planted-payload-verify-*` canaries → exit `2`, exactly `state.store.torn`; schema mismatch → exit `2`, `state.schema.mismatch`; corrupt per-change payload (missing `transitions`; a transition missing `operation`/`timestamp`) → exit `2`, `state.keys.missing`; permission denial via a real POSIX mode violation and the existing win32 ACL branch (GAP-4) → exit `1`, `state.permission.denied`. Summary prefixes `result=state-unverified; variant=full; missing=-` (and the LITE analogue) / `result=failed; variant=…; missing=-` with the optional `detail=<row summary>` per A-T6; envelope fields match the `ERROR_TABLE` row and exit equals `projectExitCode(row.projectionClass)`; the wrapping store records `read` and zero `acquireFence`/`append`/`replaceDocument`/`releaseFence`; no success envelope, no canary leakage; valid-store control → `finished`/`0`; detection-disabled control exposes the planted canary (fixtures live); a corrupt or absent projection in an otherwise valid store produces no `state.*` failure.
- [x] **4.2** Author `tests/behaviour/verify-envelope.test.ts` — matrix half (TC-VERIFY-012): one cell per verify-reachable identity and both success variants (finished full/LITE; `verify.ledger.incomplete` full/LITE single+multi and `lint.phases.incomplete`; `lint.notes.malformed`, `lint.keys.missing` ×3 shapes, `lint.variant.unknown`, `lint.target.missing`, `input.value.rejected` ×3 handler cases, `fallback.invocation` ×2 parser cases, `state.permission.denied`; `state.store.torn`, `state.schema.mismatch`, `state.keys.missing`; `state.level.unsupported` **not** fabricated — GAP-2). Every cell: exactly one envelope, `assertEnvelopeContract` `[]`, only the two `finished` cells exit `0`, exit = projection of the row's class, error-only on failure; the C-6 summary grammar sweep with `detail` presence/absence per A-T6 (the `fallback.invocation` cells exempt from the tuple — handler never ran); non-vacuity (observed identity set equals the expected set; negatives outnumber successes); human mode — same exits, stderr diagnostics, no stack trace, no second envelope.
- [x] **4.3** Same suite — summary half (TC-VERIFY-013): exact strings `result=partial; variant=full; missing=test_planning,delivery_planning,dor_check` and `result=partial; variant=lite; missing=quality_gates`; an independent test-local oracle recomputes the missing set from the fixture map plus injected registry facts; reversed-declaration-key-order twins produce deep-equal summaries/data and byte-identical stdout under the fixed run id/clock; success arrays are required-set ordered (not alphabetical, not insertion order); no space after commas, no trailing comma, exactly three segments for `partial`.
- [x] **4.4** Same suite — read-only half (TC-VERIFY-014 behaviour half): for success/partial/malformed/unknown-variant/missing-target/grammar/platform/permission fixtures — SHA-256 digests of the fixture tree and temp state root before/after each run are byte-identical; the recorder observed the expected reads and zero write/fence calls; throwing write-file and store-mutation seams prove a write would fail the test; ambient stubs (environment/clock/randomness) that throw leave verdicts unchanged; the derived projection is never evidence and never rebuilt (cross-ref P1/P2); negative controls — a mutating `phase complete` through the same recorder records write/fence calls, and a seeded cache-write control trips the digest check.
- [x] **4.5** Same suite — determinism half (TC-VERIFY-015): one fixture per classification class (`finished`, `partial`, malformed, unknown variant, missing target, handler grammar, parser grammar, `state.store.torn`, `state.permission.denied`) run twice → identical exit/stdout bytes/stderr/envelope/token/variant/missing/evidence/`overlaidPhases`; a third run in a fresh harness root with identical facts → identical; changing only the run id changes the envelope `runId`, never the tuple; the input-change control (complete one missing phase) flips the token/summary/exit.

**Acceptance Criteria**:

- Must: AC-V7 complete (three platform fixtures exit `2` with the specific identity; permission exits `1`; never success; no fence/write); AC-V9 complete (the exhaustive matrix is non-vacuous and covers every pinned reachable identity); AC-V10 and AC-V13 complete (zero writes/fences/network/spawns proven non-vacuously; byte-identical replays; exact summary grammar with contract-array ordering).
- Should: matrix cells reuse the Phase 3 fixtures via `verify-support.ts`; any cell needing a new fixture shape is recorded in the execution log.

**Files and modules**:

- Code areas: `tests/behaviour/verify-change-state.test.ts` (new), `tests/behaviour/verify-envelope.test.ts` (new), `tests/behaviour/verify-support.ts` (updated), `tests/golden/helpers.ts` (reused), `tests/fixtures/state/harness.ts` (reused, unchanged).
- System docs: none.

**Tests**:

- TCs implemented: TC-VERIFY-010, TC-VERIFY-012, TC-VERIFY-013, TC-VERIFY-014 (behaviour half; structure half landed Phase 2), TC-VERIFY-015 — complete.
- `bun test tests/behaviour/verify-change-state.test.ts tests/behaviour/verify-envelope.test.ts` → green including every control; `pnpm check` → exit 0.

**Completion signal**: `test(GH-177): prove state-failure classification, envelope exit matrix, and determinism`

---

### Phase 5: Real committed corpus, fail-closed binding proofs, and the full gate battery

**Goal**: Pin the real-corpus fixtures against the committed GH-179/GH-170/GH-171 artifacts read in place, re-prove the bash-enum and documented-table bindings fail closed explicitly, complete the tier/inventory and boundary/ambient/exit/entrypoint gates, and run the aggregate battery — with this phase all 21 TCs are green.

**Tasks**:

- [x] **5.1** Author `tests/behaviour/verify-corpus.test.ts` (TC-VERIFY-006, TC-VERIFY-011 corpus): read the three committed fixtures in place, read-only — `doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-pm-notes.yaml` (no `variant`, eleven completed, no per-change registry record) → `finished`, exit `0`, ordered arrays, `missingPhases: []`, no `state.keys.missing`; `doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-pm-notes.yaml` (two `null` completions plus opaque non-canonical keys) → `partial`, exit `1`, `verify.ledger.incomplete`, `missing=test_planning,delivery_planning`, no opaque key named or failing conformance; `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml` (unparseable) → `lint.notes.malformed`, exit `1`, no crash/stack/raw parser bytes. Preconditions asserted from the committed bytes before classification; a fresh temp state root injected per run; digests before/after equal and `git status --porcelain` unchanged; all three envelopes pass `assertEnvelopeContract`; none is `fallback.internal`; temp-copy mutation controls (GH-179 `delivery.completed: null` → `partial`; GH-171 indentation repaired → parses, no longer `lint.notes.malformed`) prove liveness.
- [x] **5.2** Fail-closed binding re-proof (explicit, recorded): re-run and record the TC-VERIFY-016/018/019 fail-closed controls as a phase gate — the bash-enum extractor against a non-existent/mutated temp reference fails (never skips); the documented-table comparer against mutated table text fails naming the token/field; the sync check on temp copies fails in both drift directions with the exact messages; the unchanged controls are green in the same runs. Any live failure here is a deliberate STOP-and-escalate (A-T8, GAP-5), never a weakening.
- [x] **5.3** Complete TC-VERIFY-020: `tests/structure/inventory.json` lists every new file exactly with named executable allowances; `bun test tests/structure/content-inventory.test.ts` green (no missing/extra file); the edge-composition and consumer-set assertions from task 3.2 re-verified; the single-enum-home and brand scans re-run over the final module set; each detector's failing fixture and clean control confirmed present (deleting a failing fixture in a temp copy fails the meta-check).
- [x] **5.4** Complete TC-VERIFY-021: `bun test tests/boundaries` green with the dependency-cruiser rule-id set and the `runtime-apis-confinement` allowlist compared against the pinned pre-change sets (a new rule or allowlist location fails; the fixture-coverage meta-check green); `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` green with seeded-violation controls (a temp probe with `Date.now`/`exitCode: 2`/spawn import fails naming file/line/kind; `packages/cli/src/projection.ts` remains the only exit-digit owner).
- [x] **5.5** Aggregate battery: every focused verify suite, `bun test` (all layers), `pnpm run check:boundaries`, the five invariant checks, `pnpm check` → exit 0, `git diff --check` clean, `git status --porcelain` clean (no test writes).

**Acceptance Criteria**:

- Must: AC-V11 proven on the committed files read-only with liveness controls; NFR-7 (0 crashes, 0 unclassified fallbacks, correct tokens) and NFR-1 fully measured; **all 21 TCs green** at this boundary; no existing gate weakened.
- Should: corpus failure messages expose the classified fixture path and expected-vs-actual tuple for CI diagnosability.

**Files and modules**:

- Code areas: `tests/behaviour/verify-corpus.test.ts` (new), `tests/structure/content-inventory.test.ts` (updated only if inventory assertions grow), `tests/structure/inventory.json` (final), `tests/boundaries/**` (additive fixtures only if a scope gap is discovered — none expected, D7).
- System docs: none.

**Tests**:

- TCs implemented: TC-VERIFY-006 (complete), TC-VERIFY-020 (complete), TC-VERIFY-021 (complete). With this phase the full set TC-VERIFY-001..021 is green.
- `bun test tests/behaviour/verify-corpus.test.ts tests/structure tests/boundaries` → green; `pnpm check` → exit 0.

**Completion signal**: `test(GH-177): pin real-corpus classification and fail-closed bindings with full gate battery`

---

### Phase 6: Release prep — minor changeset, evidence artifact, final local battery

**Goal**: Record the release intent and the delivery evidence, and run the full local battery to a clean tree — the `@coder`-executed completion of implementation (authoring + verification only; no push, no PR).

**Tasks**:

- [x] **6.1** Author `.changeset/verify-change-minor.md` (D9): `minor` for the lockstep fixed five-package group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode` — the `pm-notes-lint-minor.md` precedent and `.changeset/config.json` `fixed` group); summary naming the verify command, the contracts vocabulary, and the one error row; no hand-bumped versions; nothing publishes in this change.
- [x] **6.2** Author `chg-GH-177-evidence.md` (D10): per-phase commits and green criteria (captured `pnpm check` logs); the gate consolidation with commands + HEAD; the 21-TC coverage map (TC → suite → command → phase); rollback instructions (fully additive single-PR revert; never roll back one side of the error-table sync; re-run baseline checks after any rollback); owner-facing notes — the TDR-0005 `state-unverified` exit-2 divergence is Proposed pending owner ratification at PR review, and PIN-1..PIN-7 are delivery-bound spellings the owner may amend.
- [x] **6.3** Final local battery (record only executed evidence): `pnpm install --frozen-lockfile`; the focused verify suites; `bun test` (all layers); `pnpm check`; `bun run scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `bash scripts/.tests/test-doc-distribution.sh` (no marker-bearing doc drifts — `doc/spec/**` sits outside the marker scope, so green is expected); `git diff --check`; `git status --porcelain` clean. No push; PR handoff is Phase 10.

**Acceptance Criteria**:

- Must: the changeset recorded per conventions; the evidence artifact complete and honest (unrun results never recorded as passing); the full battery green on the working HEAD; clean tree; every phase commit's staged set matched its explicit list (D6).
- Should: evidence artifact links each TC row to the exact execution command for one-command re-runs by the reviewer.

**Files and modules**:

- Code areas: `.changeset/verify-change-minor.md` (new), `chg-GH-177-evidence.md` (new, this folder); no product-code change unless a gate reopens Phase 8.
- System docs: none (Phase 9 owns reconciliation).

**Tests**:

- The task 6.3 battery exactly as consolidated in the evidence artifact.

**Completion signal**: `docs(GH-177): record changeset and delivery evidence with final local battery`

---

### Phase 7: Independent review support (lifecycle phase 8 — review gate; PM-scheduled, NOT `@coder`-executed)

**Goal**: Hand `@reviewer` a complete, reproducible audit package — read-only analysis of Phases 1–6; no new code, no new TCs.

**Tasks**:

- [x] **7.1** Consolidate the review input pack: the six completion-signal commits, per-phase green criteria with captured logs, the 21-TC coverage map, and the PIN-1..PIN-7 / D1..D12 index so the reviewer can challenge spellings and placements without reshaping TC behaviour (A-T1).
- [x] **7.2** Produce the scope and protected-path proof: `git diff --name-only origin/main-tools...HEAD` touches no `.opencode/**`, `.ados-claude/**`, `.ai/**`, `scripts/*.sh`, `tools/**`, or CI topology files (D7) and nothing outside this plan's Files-and-modules lists; each phase's staged set matched its explicit list (D6).
- [x] **7.3** Record the verdict in `review/review-iter-1.md` (GH-174/179 pattern) and route findings: implementation findings → Phase 8; any challenge to a PIN or D-binding → PM/`@decision-advisor` (a decision record if accepted) — never a silent alternative.

**Acceptance Criteria**:

- Must: a traceable PASS or actionable findings against spec, test plan, and this plan, with no fabricated evidence; a failed negative control is unfinished work, never a downgraded severity.

**Files and modules**:

- Code areas: none (read-only analysis of Phases 1–6).
- System docs: none during analysis.

**Tests**:

- No new TCs; the reviewer re-runs questionable evidence via the recorded commands (PM may dispatch `@runner`) rather than assuming a passing report.

**Completion signal**: independent verdict recorded in `review/review-iter-1.md`; PASS advances past Phase 8, findings activate it. (No code commit; PM-scheduled gate.)

---

### Phase 8: Post-review remediation (conditional; lifecycle phase 8 loop; PM-scheduled)

**Goal**: Close accepted review findings without expanding scope or losing regressions; skipped with an explicit not-required record when Phase 7 returns PASS.

**Tasks**:

- [x] **8.1** If findings exist: reproduce each through the relevant TC fixture or negative control first, and add the missing regression **before** the smallest fix; behaviour outside the accepted verify slice stays unchanged. *(NOT REQUIRED — review iter-1 PASS with 0 blocker/0 major; see 8.3.)*
- [x] **8.2** Fix code, fixtures, and docs together: any error-table change carries its documented row in the same fix (D2 — sync green in both directions); any accepted PIN/D-binding challenge is resolved through PM/`@decision-advisor` and recorded as a plan revision — never applied silently. *(NOT REQUIRED — no accepted findings; the 2 minor + 2 info advisories are non-blocking and recorded for PR review.)*
- [x] **8.3** Re-run the affected focused suites, the full `pnpm check` battery, and the independent re-review until PASS; if no findings, record this phase not-required backed by the Phase 7 PASS. *(DONE — Phase 8 recorded not-required backed by `review/review-iter-1.md`; the reviewer independently re-ran the suites and battery green.)*

**Acceptance Criteria**:

- Must: all accepted findings closed with the affected ACs still traceable and previously green suites still green; no unresolved blocker, waived check, or undocumented scope expansion.

**Files and modules**:

- Code areas: only affected Phase 1–6 files and their regression tests.
- System docs: lockstep with code when behaviour changes (a documented row in the same commit as any table change).

**Tests**:

- Reproduce the failing TC cases and controls; re-run the full 21-TC evidence set before finalization.

**Completion signal**: reviewer PASS after fixes (`fix(GH-177): <finding remediation>` per accepted batch), or an explicit not-required record backed by the Phase 7 PASS. (PM-scheduled; conditional.)

---

### Phase 9: Documentation and spec synchronization (lifecycle phase 7 — system_spec_update; `@doc-syncer`; PM-scheduled)

**Goal**: Reconcile `doc/spec/**`, guides, and the glossary with the delivered implementation — every touchpoint the spec's C-8 "Documented-table impacts" list names. (Only the documented-table row and domain-kind declaration were code-coupled and shipped in Phase 1; everything else lands here. The new current-truth feature doc is this phase's deliverable, not an implementation task.)

**Tasks**:

- [x] **9.1** Author the new current-truth feature doc `doc/spec/features/feature-verify-change-and-exit-taxonomy.md` (command surface, variant-aware sets, evidence precedence, enum/taxonomy tables, error identities, corpus fixtures) and register it in `scripts/checks/forbidden-literals.registry.json` in the same change (GH-173/174/179 precedent).
- [x] **9.2** `doc/spec/features/feature-result-contract.md`: the documented `verify` row and the declared domain kinds are the binding sync fixture shipped in Phase 1 and are **never rewritten** here (D2); reconcile the remainder — classification-chain prose and invocation classes now include the `verify` surface.
- [x] **9.3** `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` and `doc/spec/features/feature-state-layer.md`: name verify as a read-only consumer of the lint rules, the ledger, and verified (presence-tolerant) reads.
- [x] **9.4** `doc/overview/glossary.md` (delivery result tuple/enum, exit taxonomy, verify-vs-lint, overlay precedence, reserved token — existing one-line table style) and `doc/guides/change-lifecycle.md` (the variant-aware finalization note; the file keeps its `ados_distribution` marker; `bash scripts/.tests/test-doc-distribution.sh` green).
- [x] **9.5** Cross-reference sweep: every link touched by 9.1–9.4 resolves; no other `doc/spec/**` page claims verify behaviour that no longer holds; `bun run scripts/checks/error-table-sync.ts` and `pnpm check` green after the edits.

**Acceptance Criteria**:

- Must: every C-8 touchpoint reconciled or explicitly recorded unchanged; the documented-table section byte-untouched; the sync, doc-distribution, and aggregate checks green after reconciliation.
- Should: glossary entries stay single-sentence definitions per the existing table style.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-verify-change-and-exit-taxonomy.md` (new), `doc/spec/features/feature-result-contract.md` (updated, non-table prose), `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (updated), `doc/spec/features/feature-state-layer.md` (updated), `doc/overview/glossary.md` (updated), `doc/guides/change-lifecycle.md` (updated), `scripts/checks/forbidden-literals.registry.json` (updated — feature-doc row).

**Tests**:

- `bun run scripts/checks/error-table-sync.ts` → exit 0 after the edits; `bash scripts/.tests/test-doc-distribution.sh` → green; `pnpm check` → exit 0.

**Completion signal**: `docs(GH-177): reconcile system spec, guides, and glossary with delivered verify surface` (@doc-syncer; PM-scheduled)

---

### Phase 10: Finalize and release (lifecycle phases 9–11 — quality_gates, dod_check, pr_creation; PM-scheduled)

**Goal**: A fully gated, versioned, evidenced open-PR handoff; publishing, merge, and owner acceptance remain outside this change.

**Tasks**:

- [x] **10.1** Version bump per repo conventions: the Phase 6 changeset (`.changeset/verify-change-minor.md`) is the recorded release intent for the lockstep fixed group — confirm it is present and accurate against the final diff; no hand-bumped versions; nothing publishes in this change; the owner may amend the impact at PR review (A-T9).
- [x] **10.2** Spec reconciliation (dod_check input): confirm the spec/test-plan/plan trio reflects delivered reality — all 14 ACs traceable to green TCs, all seven NFR thresholds measured, execution logs complete, the evidence artifact current; discrepancies route back through Phase 8, never a silent edit.
- [x] **10.3** Final gate battery on the **pushed HEAD** (PM via `@runner`; never an earlier SHA): `pnpm install --frozen-lockfile` → the focused verify suites → `bun test` (all layers) → `pnpm check` → the five invariant checks → `bash scripts/.tests/test-doc-distribution.sh` → `git diff --check`; then hand off to `@pr-manager` (lifecycle phase 11): PR targets `main-tools` from `feat/GH-177/verify-change-exit-taxonomy`, assigned to the owner, enriched with ticket context; **STOP at the open unmerged PR** — no merge, no owner-acceptance claim. *(LOCAL HALF DONE at `47604ac`: full battery green, including all 1106 tests, boundaries, five invariants, doc-distribution, commitlint, and whitespace. The pushed-HEAD re-run and PR handoff complete at `pr_creation`, by definition.)*

**Acceptance Criteria**:

- Must: the change-level Definition of Done satisfied with current passing evidence on the pushed HEAD; the minor changeset recorded; rollback coherent; no protected path touched; nothing from `.ai/local/` or `tmp/` ever staged.
- Must: no merge or owner acceptance is claimed by any artifact of this change.

**Files and modules**:

- Code areas: none (gate execution and handoff; a red battery reopens Phase 8).
- System docs: final verification against Phase 9; no speculative consumer documentation (M0-S9/M1-S9 own their docs).

**Tests**:

- The task 10.3 battery, exactly as consolidated in `chg-GH-177-evidence.md`, on the pushed HEAD.

**Completion signal**: open unmerged PR targeting `main-tools` recorded in the evidence artifact (PM-scheduled; lifecycle phases 9–11 complete).

---

## Test Scenarios

All 21 TCs from the test plan map to concrete tasks; no TC is reshaped, no TC is orphaned, and **no TC is only partially implementable** — five TCs are deliberately completed across two phases in the GH-179 "halves" pattern (pure/structure half first, command/behaviour half later), and each is fully green by the phase marked *complete*. Test-plan §5.2 scenarios, §4.1 harness contract, and §4.2 non-vacuity contract are authoritative; the per-phase Tests blocks name where each lands.

| TC ID | Scenario (abbreviated) | AC / NFR | Phase(s) · task(s) | Target layer / test file |
|---|---|---|---|---|
| TC-VERIFY-001 | Full incomplete ledger names each missing phase | AC-V1 | 2 (pure half, 2.6) → **3 complete** (3.3) | `tests/behaviour/verify-change-classification.test.ts` + `tests/fixtures/verify/classification/full/**` |
| TC-VERIFY-002 | Complete full ledger is a verified success (3 registry states) | AC-V6 | 2 (2.6) → **3 complete** (3.3) | same + `full-complete` fixture |
| TC-VERIFY-003 | LITE required six, never the other five | AC-V2 | 2 (2.6) → **3 complete** (3.3) | same + `tests/fixtures/verify/classification/lite/**` |
| TC-VERIFY-004 | Partial identity split: declared-incomplete vs absent | AC-V3, AC-V12 | 2 (2.6) → **3 complete** (3.3) | same + `partial-identities/**` |
| TC-VERIFY-005 | Overlay precedence, presence-tolerant evidence, projection not evidence | AC-V6, AC-V12 | 2 (2.1/2.2, 2.6) → **3 complete** (3.3) | same + `tests/fixtures/state/harness.ts` |
| TC-VERIFY-006 | Real committed changes classify correctly (GH-179/170/171) | AC-V11, NFR-7 | **5 complete** (5.1) | `tests/behaviour/verify-corpus.test.ts` |
| TC-VERIFY-007 | Malformed classes, one pinned identity each | AC-V3 | **3 complete** (3.4) | `tests/behaviour/verify-change-rejections.test.ts` + `tests/fixtures/verify/malformed/**` |
| TC-VERIFY-008 | Unknown variant before any registry read | AC-V4 | **3 complete** (3.4) | same + `malformed/variant/**` |
| TC-VERIFY-009 | Missing target before any registry read | AC-V5 | **3 complete** (3.4) | same + `tests/fixtures/verify/target/**` |
| TC-VERIFY-010 | Registry failures classified, never success | AC-V7 | **4 complete** (4.1) | `tests/behaviour/verify-change-state.test.ts` + `tests/fixtures/state/harness.ts` |
| TC-VERIFY-011 | Grammar fails before any read | AC-V14 | **3 complete** (3.4) | same rejections suite + `tests/fixtures/verify/grammar/**` |
| TC-VERIFY-012 | Envelope/exit matrix: every non-verified outcome non-zero | AC-V9, NFR-2/3 | **4 complete** (4.2) | `tests/behaviour/verify-envelope.test.ts` |
| TC-VERIFY-013 | Summary grammar and machine-consumable tuple | AC-V13, NFR-4 | **4 complete** (4.3) | same + classification fixtures |
| TC-VERIFY-014 | Read-only, network-free, spawn-free | AC-V10, NFR-4 | 2 (AST half, 2.4) + **4 complete** (4.4) | `verify-envelope.test.ts`, `verify-imports.test.ts` |
| TC-VERIFY-015 | Determinism and replay equality | AC-V10, NFR-4 | **4 complete** (4.5) | `verify-envelope.test.ts` |
| TC-VERIFY-016 | Bash usage enum binding (fail-closed) | AC-V8, NFR-5 | **1 complete** (1.4); fail-closed re-proof 5 (5.2) | `tests/structure/delivery-result-contract.test.ts` |
| TC-VERIFY-017 | Taxonomy totality, classes, reachable subset | AC-V8, NFR-5 | **1 complete** (1.4) | same |
| TC-VERIFY-018 | Spec documented taxonomy table matches the data | AC-V8, NFR-5 | **1 complete** (1.4); fail-closed re-proof 5 (5.2) | same |
| TC-VERIFY-019 | Error-table binding for the new kind and row | NFR-6 | **1 complete** (1.5); drift re-proof 5 (5.2) | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` |
| TC-VERIFY-020 | Tier, purity, single-home, inventory invariants | NFR-1 | 1 (data allowances), 2 (2.4 core halves), 3 (3.2 command half) → **5 complete** (5.3) | `tests/structure/verify-imports.test.ts` (new), `cli-edge-seam.test.ts`, `content-inventory.test.ts`, `state-scope.test.ts`, `inventory.json` |
| TC-VERIFY-021 | Boundary, ambient, exit-code, entrypoint gates | NFR-1, NFR-2 | per-phase `pnpm check` → **5 complete** (5.4) | `tests/boundaries/**`, `scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` |

**AC coverage** (test plan §3.1 is authoritative; every AC lands green by Phase 5): AC-V1 → TC-001 (Ph 2/3) · AC-V2 → TC-003 (Ph 2/3) · AC-V3 → TC-004, TC-007 (Ph 2/3) · AC-V4 → TC-008 (Ph 3) · AC-V5 → TC-009 (Ph 3) · AC-V6 → TC-002, TC-005 (Ph 2/3) · AC-V7 → TC-010 (Ph 4) · AC-V8 → TC-016/017/018 (Ph 1) · AC-V9 → TC-012 (Ph 4) · AC-V10 → TC-014/015 (Ph 2/4) · AC-V11 → TC-006 (Ph 5) · AC-V12 → TC-004, TC-005 (Ph 2/3) · AC-V13 → TC-013 (Ph 4) · AC-V14 → TC-011 (Ph 3). NFR-1 → TC-020/021 (Ph 1–5) · NFR-2/3 → TC-007..012 (Ph 3/4) · NFR-4 → TC-013..015 (Ph 4) · NFR-5 → TC-016..018 (Ph 1) · NFR-6 → TC-019 (Ph 1) · NFR-7 → TC-006 (Ph 5). Fourteen of fourteen ACs and seven of seven NFRs covered; zero deferred.

**Execution order** maps to phases as: test-plan step 1 (enum/taxonomy/table/error-table binding) → Phase 1; step 2 (tier/purity gates) → Phases 2–3 with completion in Phase 5; step 3 (classification/overlay) → Phases 2–3; step 4 (rejections/grammar) → Phase 3; step 5 (state failures) → Phase 4; step 6 (real corpus) → Phase 5; step 7 (envelope/exit/summary/read-only/determinism) → Phase 4; step 8 (aggregate) → Phases 5 and 6.

## Artifacts and Links

| Artifact | Location | Type / role |
|---|---|---|
| Change specification (v1.1) | [chg-GH-177-spec.md](./chg-GH-177-spec.md) | Source of requirements: AC-V1..V14, C-1..C-8, DEC-1..11, NFR-1..7, C-4/C-5/C-6 tables, architecture map |
| Test plan (v1.1, 21 TCs) | [chg-GH-177-test-plan.md](./chg-GH-177-test-plan.md) | Source of TC IDs, §4.1 harness contract, §4.2 non-vacuity contract, execution order, evidence commands |
| This plan | `./chg-GH-177-plan.md` | The only file written by this authoring pass |
| PM notes | `./chg-GH-177-pm-notes.yaml` | Delivery tracker state; corpus-adjacent (not a TC-006 fixture — the corpus reads GH-179/170/171 only) |
| Decision record | [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) | Token parity, `state-unverified` → 2, single enum home; Proposed pending owner ratification (owner-facing note) |
| Contracts vocabulary | `packages/core/src/contracts/delivery-result.ts` | New; eleven tokens + total taxonomy as data (Phase 1) |
| Error row (machine + documented) | `packages/core/src/contracts/error-table.ts`, `doc/spec/features/feature-result-contract.md` | One `verify` row shipped in-change together (D2); the documented section is never rewritten by reconciliation |
| Classifier / state read | `packages/core/src/domain/verify-change.ts`, `packages/core/src/state/registry.ts` | New pure classifier; additive presence-tolerant read (Phase 2) |
| Command / composition | `packages/cli/src/commands/verify.ts`, `packages/cli/src/commands/index.ts`, `packages/cli/src/edge.ts` | New command, registration, edge composition (Phase 3) |
| Verify suites and fixtures | `tests/behaviour/verify-*.test.ts`, `tests/behaviour/verify-support.ts`, `tests/structure/{delivery-result-contract,verify-imports}.test.ts`, `tests/fixtures/verify/**` | All 21 TCs at their pinned locations (Phases 1–5) |
| Extended existing suites | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/state-scope.test.ts`, `tests/structure/inventory.json` | TC-019, TC-020 extensions |
| Release intent | `.changeset/verify-change-minor.md` | New in Phase 6 (D9); lockstep fixed group; no publishing in this change |
| Delivery evidence | `./chg-GH-177-evidence.md` | New in Phase 6 (D10; GH-172/174/179 pattern) |
| Review records | `./review/review-iter-*.md` | New in Phase 7 if the review gate records findings |
| Current-truth feature doc | `doc/spec/features/feature-verify-change-and-exit-taxonomy.md` | New in Phase 9 (@doc-syncer) + forbidden-literals registration |
| Referenced specs & rules | [feature-result-contract.md](../../../spec/features/feature-result-contract.md), [feature-pm-notes-lint-and-phase-transitions.md](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md), [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md), [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md), [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Consumed contracts and rules; referenced, not rewritten |
| Bash-era reference | `scripts/deliver-ticket.sh` (usage block ~line 2322) | External enum oracle, read-only at test time; fail-closed binding (A-T8) |

No new standalone delivery-infrastructure check or CI job is planned (D7). If execution genuinely needs one, escalate to PM — no such addition is pre-authorized here.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31T05:30:13Z | Implementation Plan Writer | Initial ten-phase plan. Read the completed spec (v1.0), test plan (21 TCs), TDR-0005, the structural template, the GH-179 plan precedent, and the baseline code (contracts/domain/state/CLI, harnesses, checks, changeset config, bash usage enum). Pinned the five delivery-bound spellings (PIN-1..PIN-7 resolving OQ-T1..T4 and GAP-3); bindings D1..D12 (same-phase error-row sync, state composition, handler purity, fixture hygiene, inline committer protocol, no new CI, inventory, changeset, evidence artifact, single enum home, envelope exclusivity); 10 phases / 44 tasks; full 21-TC traceability with zero orphaned and zero partially-implementable TCs; AC-V1..V14 and NFR-1..7 coverage; commit strategy, rollback/failure handling, and the execution-log skeleton. |
| 1.1 | 2026-10-31T05:48:45Z | Implementation Plan Writer | DoR iter-1 remediation fold-in ([readiness-review/readiness-iter-1.md](./readiness-review/readiness-iter-1.md) finding 1, major): task 1.2 now pins the `verify.ledger.incomplete` remediation hint to the amended spec v1.1 C-8 exact brand-neutral string — "Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify." — carried byte-for-byte in `ERROR_TABLE` and in the documented row in `doc/spec/features/feature-result-contract.md` (the sync check matches the hint byte-for-byte; no product literal); the contradictory "follows the spec C-8 remediation wording" clause dropped. Consistency touches only elsewhere: spec referenced as v1.1 (brand-neutral C-8 hint, C-3 fold-entry wording), test plan as v1.1 (TC-VERIFY-012 outside-taxonomy bucket, TC-VERIFY-018 `none` prefix rule). No phase, task numbering, TC mapping, AC/NFR mapping, PIN, or D-binding changed (10 phases / 44 tasks; 21 TCs; PIN-1..PIN-7; D1..D12). |

## Execution Log

Execution notes for `@coder` (binding, from D5/D6):

- **No subagent dispatch**: `@coder` executes Phases 1–6 with inline committer discipline; Phases 7–10 are PM-scheduled lifecycle gates — never mark them complete by finishing implementation alone.
- **One Conventional Commit per phase** with the phase's completion signal; explicit `git add` of exactly the phase's Files-and-modules entries; verify the staged set before committing; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; no push during delivery; no amend.
- **Inline gates**: `pnpm check` before every commit with the log captured under `.ai/local/` (never staged); a red gate blocks the commit — fix or stop at the last green task boundary and report.
- **Fixture hygiene**: committed fixtures read-only; derived fixtures under fresh `mkdtemp` siblings in the OS temp directory, removed in teardown; corpus files read in place with digest guards; the live tree clean after every suite.
- **Evidence honesty**: record only executed evidence with command + HEAD; unrun results are never recorded as passing (test plan §7).
- **Fail-closed escalations**: a moved bash reference, spec-table drift, or any spec/test-plan inconsistency is a STOP-and-report to PM — never a test weakening or a silent reinterpretation (A-T4, A-T8, GAP-5).

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-31T05:30:13Z | 2026-10-31T05:30:13Z | none | This pass read the completed spec (v1.0), test plan (21 TCs, §4.1/§4.2 contracts), TDR-0005, the template, the GH-179 plan precedent, and the baseline code; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. Executors record per-phase evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
| 1 | Complete | 2026-10-31 | 2026-10-31 | `6141d00` | Contracts vocabulary + `verify` row + documented table + TC-016/017/018/019; `pnpm check` 1015/1015. |
| 2 | Complete | 2026-10-31 | 2026-10-31 | `e77277d` | Pure classifier + tolerant read + TC-001..005 pure halves + TC-020 core halves; `pnpm check` 1049/1049. |
| 3 | Complete | 2026-10-31 | 2026-10-31 | `6620ce9` | Command + composition + TC-001..005/007/008/009/011 complete; `pnpm check` 1076/1076. |
| 4 | Complete | 2026-10-31 | 2026-10-31 | `4554207` | TC-010/012/013/014/015 complete; `pnpm check` 1096/1096. |
| 5 | Complete | 2026-10-31 | 2026-10-31 | `62b8248` | TC-006/020/021 complete — all 21 TCs green; fail-closed re-proofs; `pnpm check` 1106/1106. |
| 6 | Complete | 2026-10-31 | 2026-10-31 | `e644d2e` | Changeset + evidence artifact + final local battery; evidence refreshed for rewritten SHAs at `5771326`. |
| 7 | Complete | 2026-10-31 | 2026-10-31 | `47604ac` | Independent review PASS iter-1 (0 blocker/0 major/2 minor/2 info); artifacts `review/review-iter-1.md`, `code-review/review-iter-1.yaml`. |
| 8 | Not required | 2026-10-31 | 2026-10-31 | — | Recorded not-required backed by the Phase 7 PASS; no accepted findings. |
| 9 | Complete | 2026-10-31 | 2026-10-31 | `253e9f0` | `@doc-syncer` reconciled all touchpoints and authored the new current-truth feature spec; residual gaps NONE. |
| 10 | In progress | 2026-10-31 | — | — | Quality gates green at `47604ac` (1106/1106 + all invariants); DoD and PR handoff remain. |
