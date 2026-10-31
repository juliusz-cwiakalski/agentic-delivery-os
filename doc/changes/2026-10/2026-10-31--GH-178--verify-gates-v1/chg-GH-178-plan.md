---
id: chg-GH-178-verify-gates-v1
status: Updated
created: 2026-10-31T18:12:54Z
last_updated: 2026-10-31T23:59:30Z
owners: [engineering]
service: delivery-os CLI verification and merge gates
labels: [change, planning]
links:
  change_spec: ./chg-GH-178-spec.md
summary: >
  A read-only `verify gates CHANGE_REF` surface that evaluates the five M0
  merge gates in a fixed order — lifecycle finalization, CI green on the
  pushed commit, push parity, owner-gate scan, and squash preflight — and
  returns one cited verdict per gate. A gate passes only on complete,
  readable, non-vacuous evidence; a red pipeline, a missing expected job, a
  pipeline with zero runs or only skipped runs, a stale local head, an
  owner-attention label, a wrong-base/draft/conflicting PR, or an
  unreadable provider read never becomes a pass. Two additive `verify`
  error identities project definitive gate failures to exit 1 and
  unavailable platform evidence to exit 2, while every failure keeps the
  per-gate evidence in a bounded deterministic summary.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-178: M0-S9 verify gates v1

## Context and Goals

This plan implements the completed change specification v1.5 (36 acceptance criteria) and the completed 70-case test plan v1.5 for `verify gates CHANGE_REF`. It delivers one read-only command that composes the delivered `verify change` classifier through the additive structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation`, reads the five gate facts through already-admitted ports and edges, and returns exactly five cited verdicts in the fixed order `lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`, `squash-preflight`. The spec and test plan are the source of truth; this plan only sequences the work and binds each task to exact files, ACs, TCs, and verification commands.

The plan preserves the delivered architecture:

- Contract vocabulary, gate/report/citation types, the shared `OpenPrResolution` outcome, constants, and bounds live in `packages/core/src/contracts` as data and types with no behavior. Only the new `VERIFY_GATES_*` constants are declared; `STATUS_OWNER_ATTENTION_LABELS`, `STATUS_CI_RESULTS`, and `STATUS_SOURCE_PIPELINE_LIMIT` are imported or re-exported by reference, never redeclared or duplicated.
- The pure evaluator and renderers live in `packages/core/src/domain`, import only contracts and the existing `verify-change` domain module, and perform no I/O, clock, randomness, or ambient reads. The structured ledger evaluator is the only ledger-rule implementation; `classifyVerifyChange` wraps it.
- The new pure domain symbols (`EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, and the renderers) are re-exported through `packages/core/src/domain/index.ts` and, additively and explicitly, from the package root `packages/core/src/index.ts`, so `@delivery-os/cli` imports them from `@delivery-os/core`. The package declares no new subpath, entrypoint, or workspace edge.
- GitHub, repository, and file reads stay in `packages/adapters/src/github`, `packages/adapters/src/repo`, and `packages/adapters/src/file`; the CLI edge composes them in `packages/cli/src/edge.ts`. The additive adapter-local `provider.not-found` read-failure kind lives in `packages/adapters/src/io/provider-transport.ts` and is mapped in `packages/adapters/src/github/client.ts`; it is not an error-table row and adds no adapter operation, subpath export, or provider-native type.
- The CLI command definition remains in `packages/cli/src/commands/verify.ts`; a new sibling `packages/cli/src/commands/verify-gates.ts` holds the gates handler and gates runtime type. `VerifyCommandRuntime` gains an optional `gates` member holding the gates runtime; `createVerifyCommandDefinition(runtime)` dispatches on the first positional (`change` or `gates`) after grammar validation. `ConfigProgramOptions.verify` remains the single option, typed to that combined runtime, and `packages/cli/src/edge.ts` composes the existing change reads plus the gates reads into it. `verify change` behavior, output, errors, and ledger-only read set are preserved.
- The `CommandDefinition.humanText` contract in `packages/cli/src/index.ts` is widened additively to return `string | undefined`; the single `verify` definition gains one `humanText` hook that dispatches on the success payload's `target`: `gates` → the six-line report; every other target → `undefined`, so `runCli` omits the hook and falls through to the delivered `humanSuccess`/`humanJson` path, preserving `verify change` bytes through its redact-then-serialize pipeline (including JSON-escaping-sensitive secrets).
- No new package, subpath, declared entrypoint, workspace edge, runtime-API location, configuration key, domain kind, state-schema change, or dependency is introduced.

The plan also lands the two additive error rows with their documented two-way table rows in the same phase, as the error-table sync check requires, and keeps the broad current-truth reconciliation for Phase 7. Targeted table updates that would otherwise leave a binding document stale (result contract, `DeliveryRequest` primitive, provider normalization) land beside the code that changes them.

**Execution sequencing guard (no broken intermediate state):**

1. Phase 1 adds data, optional fields, rows, and the contract module only; nothing imports them yet. Machine rows, documented rows, and the `tests/checks/error-table-sync.test.ts` `BASELINE_ROWS` length guard plus `verify`-row count land in one commit, so the two-way sync check never sees half an identity and the binding sync test never goes red between phases.
2. Phase 2 adds the provider normalization and the additive `provider.not-found` 404 kind after the type exists. Existing status/normalization consumers ignore the additive fields and the new internal failure kind.
3. Phase 3 adds the workflow read and its fixtures without creating a behaviour suite; the CI behaviour suite has no subject until the evaluator and the CI gate exist.
4. Phase 4 introduces the structured ledger evaluator first, then the gates evaluator and CI/parity/squash/owner rules, then the domain barrel and package-root re-exports, then the pure behaviour suites (including `verify-gates-ci.test.ts`, created only after `evaluateVerifyGates` and the CI gate exist). Phase 4 creates no CLI-output suite: the pure renderer/overall assertions stay in the pure suites, and `tests/behaviour/verify-gates-output.test.ts` is created in Phase 5.6 after the CLI surface exists.
5. Phase 5 wires the combined runtime and command last; `verify change` stays on its existing handler path, and the gates runtime stays optional until the composition is complete. One `verify` definition dispatches on the first positional after grammar validation; `ConfigProgramOptions.verify` remains the single option. Human output is dispatched by `data.target` through a `string | undefined` hook: `gates` returns the report, every other target returns `undefined` and lets the delivered redact-then-serialize path run, so `verify change` output is untouched. The output/envelope/exit-matrix suite `tests/behaviour/verify-gates-output.test.ts` is created in task 5.6, after the 5.1–5.5 CLI tasks, so no test file precedes its CLI subject.
6. Phase 6 adds evidence suites against the wired behavior; its `tests/checks/error-table-sync.test.ts` work is limited to mutation/negative controls because the baseline and two-way expectations already landed in Phase 1.3. Phase 7 updates narrative docs only after the code is stable, except for the binding table rows already landed in Phase 1.
7. Every phase ends with its focused command or `pnpm typecheck`; `pnpm check` is the Phase 8/10 aggregate. No phase leaves a failing focused suite behind.

**Open questions (non-blocking, inherited from the test plan):**

- **OQ-T5 — live-smoke flag:** the test plan uses `VERIFY_GATES_LIVE=1`; the spec leaves the opt-in flag delivery-bound. This plan implements `VERIFY_GATES_LIVE=1` and keeps the live suite outside `pnpm check`. No decision record is needed unless a shared flag convention is introduced.

**Resolved questions (DoR iterations 2–4):**

- **DoR iteration 4 — `humanText` redaction order:** `humanText` returns `undefined` for every non-`gates` target and the `CommandDefinition.humanText` type widens to `string | undefined`; `verify change` therefore stays on `humanSuccess`/`humanJson` redact-then-serialize and is byte-identical even for a JSON-escaping-sensitive secret. See revision 1.4 and task 5.4.
- **DoR iteration 3 sequencing:** the `tests/checks/error-table-sync.test.ts` baseline and `tests/structure/error-table.test.ts` counts update with the rows in Phase 1.3, and `tests/behaviour/verify-gates-output.test.ts` is created in Phase 5.6 after the CLI surface; see revision 1.3. No question remains.
- The former **OQ-T4 — list-read `sourceHeadSha`** is resolved and removed. The open-PR list may populate `sourceHeadSha`, but the detail read is the authoritative gate source. A matched detail read that returns HTTP 404 (`provider.not-found`) is definitive absence for every detail-consuming gate (`ci-green`, `push-parity`, `squash-preflight`): `fail` `head-unresolved`, source outcome `absent`, never a generic `unknown`. Only a non-404 detail failure (transport, non-404 non-2xx, credential, or binding) is `unknown` (`read-failed`, `credential-unavailable`, or `address-unresolved`). A check-run HTTP 404 is source outcome `absent` with gate `unknown` `read-failed`, never `failed` and never `ci-no-runs`.

## Scope

### In Scope

- `verify gates CHANGE_REF` grammar, handler, runtime composition, and human success rendering (F-1, F-10, AC-F1-1/2, AC-F10-2/3).
- The `delivery.verify-gates.v1` contract: five gate ids and fixed order, verdicts, closed reasons, sources/outcomes, citations, counts, name kinds, overall derivation, constants including `VERIFY_GATES_OPEN_PR_LIMIT`, bounds, and the `OpenPrResolution` outcome (F-1, F-8, F-9, F-13; DM-1..DM-6, DM-9, DM-11..DM-13).
- Lifecycle finalization by the pure structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation`, with `classifyVerifyChange` retained as a behavior-preserving wrapper and registry overlay (F-2, AC-F2-1/2/3/4, DM-15).
- CI green on the pushed head SHA with the workflow-derived expected job set and every red/pending/canceled/no-run/all-skipped/missing/invalid/truncated outcome, including a matched PR-detail HTTP 404 as `fail` `head-unresolved` (source `absent`) for every detail-consuming gate and a check-run HTTP 404 as `unknown` `read-failed` with source `absent` (F-3, F-4, AC-F3-1..6, AC-F4-1, AC-F11-1, DM-14).
- One deterministic open-PR resolution rule shared verbatim by push parity and squash preflight, including at-limit ambiguity with and without a match, lone non-matching PR, zero open PRs, multiple matches, detached HEAD, and read-specific PR 404 absence (F-5, F-7, AC-F1-2, AC-F5-2/3/4, AC-F7-2, DM-13, DM-14).
- Push parity and squash preflight over the additive `DeliveryRequest` gate facts, including the fixed mergeability precedence and `branch-mismatch` on both gates (F-5, F-7, F-12, AC-F5-1, AC-F7-1/2/3, AC-F12-1).
- Owner-gate scan reusing `STATUS_OWNER_ATTENTION_LABELS`, including malformed/non-numeric identity and work-item HTTP 404 as `ticket-unresolved`/`absent` (F-6, AC-F6-1/2, DM-14).
- Citation completeness, the bounded `failureClass` vocabulary (`provider.payload.invalid`/`provider.not-found` only; error-table codes in `failureCode`), failure-summary grammar with always-present `counts=`/`names=` segments (`-` when empty), human six-line report, the widened `string | undefined` `humanText` contract that delegates `verify change` to redact-then-serialize, overall/exit matrix, and failure identity precedence (F-8, F-9, F-10, AC-F8-1/2, AC-F9-1/2/3, AC-F10-1/2/3).
- The single `verify` definition with the combined runtime (`VerifyCommandRuntime.gates?`), first-positional dispatch after grammar validation, one `ConfigProgramOptions.verify` option, and edge composition of both runtimes (AC-F1-1, AC-F10-3, F-1).
- The additive package-root re-export of the new pure domain symbols from `@delivery-os/core`, with barrel, inventory, and allowance updates and no new subpath (AC-F13-1, NFR-6).
- Read-only credential-reference composition, no writes/spawns, bounded reads, and deterministic replay (F-11, F-13, AC-F11-1/2, AC-F13-1).
- Two additive `verify` error rows, documented two-way table rows, and the unchanged `verify.ledger.incomplete` row (DM-8, AC-F9-3).
- Fixture corpus, golden outputs, completeness/non-vacuity meta-check, no-live-call guard, and opt-in structural live smoke, with trap payloads and behavioural fixtures in their distinct required locations (F-14, AC-F14-1).
- Workspace inventory binding (`tests/fixtures/ports/v1-contract-inventory.json`, `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json`, subpaths/entrypoints checks) and forbidden-literal-registry registration of the new feature doc.
- New current-truth feature spec, targeted table updates in code phases, Appendix H reconciliation in Phase 7, and one minor changeset.

### Out of Scope

- Suite-to-job mapping, matrix expansion, reusable-workflow mapping, job-level `if` awareness, or suite roll-up (NG-1, M2-S7).
- Merge execution, squash execution, auto-merge, post-merge verification, or any write to GitHub/CI/tracker/state (NG-2, NG-5).
- GitLab/Jira gate reads, a second provider binding, fork PRs, or cross-repository heads (NG-4, OQ-1).
- Unanswered-comment detection or comment-set reads; the owner gate is label-based with a declared limitation (NG-7, ADR-0006, OQ-5).
- Review approval, approval counts, unresolved review threads, branch protection, or worktree cleanliness as gate conditions (NG-8, NG-9, OQ-4, OQ-7).
- A PR-number/arbitrary-ref argument, `--gate`, `--watch`, cached/stale evidence, multiple workflows, or a configurable workflow path (NG-6, NG-10, OQ-2).
- Embedded-metadata provenance consumption (NG-11, DEC-14, OQ-6).
- Envelope-shape changes, new domain kinds, new configuration keys, state-schema changes, new packages/subpaths/runtime-API locations, or new dependencies (NG-12).
- Bash-stack, agent-prompt, MCP/OpenCode, fleet/board, or telemetry changes (NG-13).

### Constraints

- Follow strict TypeScript, purity, ports/adapters, error-contract, and `bun:test` rules from `.ai/rules/typescript.md` and `.ai/rules/testing-strategy.md`.
- One bounded read per source; no retries, no pagination, no child processes, no writes/fences/mutations/merges.
- Contracts are data-only; the domain imports only contracts and the existing `verify-change` domain module. Only the new `VERIFY_GATES_*` constants are declared; reused status constants are referenced.
- Gate order, source order, count order, and name order come from contract arrays, never map iteration.
- The lifecycle gate consumes `VerifyLedgerEvaluation` on completion and incompletion; it never parses the human-readable classifier summary and never duplicates ledger rules. `classifyVerifyChange` wraps the same evaluator and preserves its existing success/failure shape.
- The expected-job set is read from `.github/workflows/ci.yml` at the edge within `VERIFY_GATES_WORKFLOW_MAX_BYTES` (262144); invalid/empty/duplicate/over-cap/over-long sets fail the CI gate and never fall back to observed run names.
- The open-PR page is one bounded read at `VERIFY_GATES_OPEN_PR_LIMIT` (100); a page at the limit is `ambiguous-open-pr` with or without a match, and both parity and squash consume the same resolution helper.
- The pure domain symbols are exported from `packages/core/src/domain/index.ts` and re-exported from the `packages/core/src/index.ts` explicit named export list; the CLI imports them from `@delivery-os/core`, never from a new subpath. Every new or exported module is bound in `tests/fixtures/ports/v1-contract-inventory.json`, `EXECUTABLE_ALLOWANCES`, and `tests/structure/inventory.json` where applicable.
- The single `verify` definition accepts the combined runtime: `VerifyCommandRuntime` gains an optional `gates` member (or an equivalent combined type), `createVerifyCommandDefinition` dispatches `change`/`gates` on the first positional after grammar validation, `ConfigProgramOptions.verify` remains the single option, and `packages/cli/src/edge.ts` composes both runtimes. No second `verify` definition exists.
- `CommandDefinition.humanText` returns `string | undefined`; only a defined string takes precedence over `humanSuccess`/`humanJson`. `verify change` must return `undefined` so its data-object redaction happens before serialization; the gates six-line report may use string redaction because it carries no raw payloads, titles, or free-form provider text.
- Every failure-summary gate line always renders both `counts=` and `names=` segments in that order; an empty set renders the literal `-` (`counts=- names=-`), never a zero alias, a bare segment, or an omitted segment.
- HTTP 404 surfaces as the adapter-local `provider.not-found`; every other non-2xx stays `provider.payload.invalid`. Work-item, PR-list, and matched-PR-detail absence are definitive `fail` reasons (`ticket-unresolved`, `no-open-pr`, `head-unresolved` for CI/parity/squash, source outcome `absent`); check-run absence is source `absent` with `unknown` `read-failed`, never `failed` or `ci-no-runs`. Non-404 detail failures stay `unknown`.
- Citation `failureClass` is a closed read-result union of `provider.payload.invalid` and `provider.not-found`; a read carrying an error-table code puts it in `failureCode` and omits `failureClass`.
- The live smoke is opt-in (`VERIFY_GATES_LIVE=1`), structural only, and excluded from `pnpm check` and default CI.
- The change is additive; `verify change`, existing error rows, existing adapter operations/exports, and the CI topology stay unchanged.

### Risks

- **RSK-1 — green-page false pass:** a red/missing/vacuous page passes. Mitigated by explicit red/pending/canceled/no-run/all-skipped/missing/invalid/truncated rules, expected-set read, no observed-name fallback, and negative fixtures (TC-VGATES-019..027).
- **RSK-2 — empty/unreadable expected set:** missing jobs become invisible. Mitigated by `ci-expected-jobs-invalid` and structure/behaviour tests (TC-VGATES-025, TC-VGATES-026).
- **RSK-3 — missing/invalid SHA or an unresolved branch target:** push parity passes without a full SHA or on an at-limit/non-matching PR page. Mitigated by `head-unresolved`, detached/no/ambiguous/mismatch failures, the shared resolution helper, at-limit closure, and SHA-format tests (TC-VGATES-028..031, 060).
- **RSK-4 — unknown mergeability/absent surface treated as ready:** mitigated by `squash-mergeability-unknown`, `squash-surface-unknown`, zero-surface failures, the fixed precedence including `mergeable === true` + blocked/draft/behind/unstable → `not-mergeable`, and `squash-signals` assertions on every path (TC-VGATES-035..039, 064).
- **RSK-5 — comment-based owner asks invisible:** declared label-only limitation; comments remain out of scope (ADR-0006) and are recorded in docs and risk (TC-VGATES-034).
- **RSK-6 — workflow drift/local-vs-pushed divergence:** expected set read per invocation; push parity independently catches divergence; invalid sets fail closed (TC-VGATES-026, TC-VGATES-028).
- **RSK-7 — matrix/`if` false missing jobs:** v1 reports missing rather than passing; limitation declared and M2-S7 deferred (Appendix F; TC-VGATES-026).
- **RSK-8 — fork/cross-repository head:** fails closed (`head-unresolved`/`ci-no-runs`/read failure); fork support is out of scope (OQ-1).
- **RSK-9 — provider/network flakiness:** one bounded read, deterministic `unknown`, no retries, side-effect-free re-run (TC-VGATES-049).
- **RSK-10 — row/field/document drift:** error-table two-way sync, type tests, provider trap tests, inventory/`EXECUTABLE_ALLOWANCES` binding, forbidden-literal registry, and Phase 7 reconciliation (TC-VGATES-003, 004, 047, 054..056, 065, 066).
- **RSK-11 — success/failure render divergence:** one pure evaluator feeds both paths; golden and replay tests pin equality (TC-VGATES-042..045, 052).
- **RSK-12 — documentation drift:** new feature spec lands in-change; Appendix H is reconciled in Phase 7; distribution, literal, and registry checks run (Phase 7, Phase 10).
- **RSK-13 — scope creep into merge/mapping/approval/comments:** explicit non-goals, no write path, and review checks (Phase 8).
- **RSK-14 — a definitive HTTP 404 flattened into a generic `unknown`:** DM-14 adds the adapter-local `provider.not-found`; the read-specific mapping pins work-item/list absence to definitive `fail`, a matched detail 404 to `fail` `head-unresolved` for `ci-green`/`push-parity`/`squash-preflight` (source `absent`), and check-run absence to source `absent` with `unknown` `read-failed`. Mitigated by TC-VGATES-061, TC-VGATES-067, and TC-VGATES-068.
- **RSK-17 — CLI cannot import the new evaluator/renderers, or the combined runtime seam is ambiguous:** the package root re-exports the pure domain symbols and `createVerifyCommandDefinition` takes one combined runtime with an optional `gates` member behind the single `ConfigProgramOptions.verify` option. Mitigated by TC-VGATES-069 and the package-root export check.
- **RSK-18 — CI count denominators drift or a run is double-bucketed:** `expected`/`missing` are over the declared expected set, `runs` is the observed page size, each run contributes to exactly one state bucket, and an unrecognized state is a failed observation that cannot pass. Mitigated by TC-VGATES-070.
- **RSK-15 — the lifecycle gate parses the summary or duplicates ledger rules:** DM-15 exposes `VerifyLedgerEvaluation` on completion and incompletion; `classifyVerifyChange` wraps it; the gate consumes only the structured evaluation. Mitigated by TC-VGATES-062.
- **RSK-16 — the `humanText` hook silently replaces `verify change` output or routes it through string redaction:** the hook is typed `string | undefined` and dispatches on `data.target`; every non-`gates` target returns `undefined`, so `runCli` falls through to the delivered redact-then-serialize path. Mitigated by a pre-change golden, a JSON-escaping-sensitive planted secret, and TC-VGATES-063.
- **Rollback:** the change is a single additive PR. Reverting the merge commit removes the new subcommand, contract exports, additive fields, structured evaluator, `provider.not-found`, and two error rows without migrating data or state. No follow-up cleanup is required.

### Success Metrics

| Metric | Target |
|--------|--------|
| Gates returned per successful evaluation, fixed order | 5/5 |
| Gate verdicts with a non-empty bounded citation | 5/5 |
| All-pass outcomes on any fail/unknown, zero-run, all-skipped, missing-job, invalid-set, missing-PR, non-matching-branch, at-limit page, detached-HEAD, SHA-mismatch, unknown-mergeability, 404-absence, or zero-surface fixture | 0 |
| Red pipeline / missing job / vacuous green fixtures correctly failing | 100% |
| Exit 0 on any overall fail or unknown | 0 |
| Exit matrix: all-pass 0; definitive fail 1; platform unavailable 2; credential unavailable 1 | 100% |
| Outbound GETs per invocation | ≤4; 0 retries; 0 pagination |
| Writes, fences, mutations, merges, auto-merges, child processes | 0 |
| Replay equality of report, summary, human text, and exit | 100% |
| Lifecycle counts/evidence derived from `VerifyLedgerEvaluation`, not a summary | 100% |
| Open-PR page at `VERIFY_GATES_OPEN_PR_LIMIT` with or without a match → `ambiguous-open-pr` | 100% |
| Work-item/list absence `fail`; matched detail 404 `head-unresolved`/`absent` for CI, parity, and squash; check-run 404 source `absent` and `unknown` | 100% |
| CI counts: `expected`/`missing` over the expected set, `runs` observed, one state bucket per run, unrecognized state cannot pass | 100% |
| `failureClass` values drawn only from `provider.payload.invalid`/`provider.not-found`; error-table codes in `failureCode` | 100% |
| New pure domain symbols importable from `@delivery-os/core`; one `verify` definition; `ConfigProgramOptions.verify` the single combined-runtime option | 100% |
| `verify change` human output byte-identical after the widened `string \| undefined` `humanText` hook (including a JSON-escaping-sensitive secret) | 100% |
| New error rows / new domain kinds / new config keys / state-schema changes | 2 / 0 / 0 / 0 |
| Workspace inventory/`EXECUTABLE_ALLOWANCES` registration for every new module/export; new feature doc in the forbidden-literal registry | 100% |
| Serialized success data / failure summary / human success text | ≤65536 B / ≤6 lines and ≤4096 B / ≤6 lines and ≤4096 B |
| Default-CI live calls / opt-in live structural smoke | 0 / 100% pass |

## Phases

### Phase 1: Contract vocabulary, additive gate facts, and error identities

**Goal**: Land the shared data contract and additive rows with no runtime behavior change, so later phases compile against one vocabulary.

**Tasks**:

- [ ] **1.1** Add `packages/core/src/contracts/verify-gates.ts` with `VERIFY_GATES_GATE_ORDER`, verdicts, the closed reason set, source names/outcomes, count names, name kinds (`missing-phases`, `missing-jobs`, `failed-jobs`, `pending-jobs`, `owner-labels`, `squash-signals`), citation/identity/count/name-list/report types, the shared `OpenPrResolution` outcome type, and the closed `failureClass` union `"provider.payload.invalid" | "provider.not-found"` (error-table codes use `failureCode`, never `failureClass`). Declare all new `VERIFY_GATES_*` constants and bounds (including `VERIFY_GATES_OPEN_PR_LIMIT`) and per-gate source/count/reason declarations as `as const` data. Import or re-export `STATUS_OWNER_ATTENTION_LABELS`, `STATUS_CI_RESULTS`, and `STATUS_SOURCE_PIPELINE_LIMIT` by reference; never redeclare them. Re-export from `packages/core/src/contracts/index.ts`. **AC/TC**: AC-F1-3, AC-F8-1, AC-F9-1, AC-F13-1, DM-2..DM-6, DM-9..DM-13; TC-VGATES-001. **Verify**: `pnpm typecheck`.
- [ ] **1.2** Add optional `sourceHeadSha`, `mergeableState` (`mergeable | conflicting | not-mergeable | unknown`), `commitCount`, and `changedFileCount` to `DeliveryRequest` in `packages/core/src/contracts/ports.ts` with absence/unknown comments; no new operation, export, or subpath. **AC/TC**: AC-F12-1, DM-7; TC-VGATES-003. **Verify**: `pnpm typecheck`.
- [ ] **1.3** Add `verify.gates.failed` (user, non-retryable, `not_landed`, `user-validation`) and `verify.gates.unavailable` (platform, non-retryable, `not_landed`, `platform-provider`) to `ERROR_TABLE` in `packages/core/src/contracts/error-table.ts`; leave `verify.ledger.incomplete` byte-identical. In the same change, add the two documented rows to `doc/spec/features/feature-result-contract.md` (the `verify` kind now has three rows) and update the `DeliveryRequest` primitive field table in `doc/spec/features/feature-adapter-ports.md` with the four optional facts and absence semantics. The machine rows, documented rows, and the binding sync-test baseline land together so the sync check never sees a half-added identity. In the same commit, update `tests/checks/error-table-sync.test.ts`: the `BASELINE_ROWS` length guard becomes `live.length !== BASELINE_ROWS.length + 3` (the frozen pre-verify baseline plus `verify.ledger.incomplete` and the two new rows), the `the unchanged copy remains green (control)` assertion `counts.sourceEntries` becomes `BASELINE_ROWS.length + 3`, the `TC-VERIFY-019` verify-row assertion becomes `toHaveLength(3)`, and the `kinds` map expects `verify: 3`; leave the `BASELINE_ROWS` tuples unchanged. Also in the same commit, update `tests/structure/error-table.test.ts`'s `TC-VERIFY-019` counts: the `verify`-kind filter becomes `toHaveLength(3)` and the whole-table count becomes `toHaveLength(33)`. This keeps both binding suites green from the moment the rows land rather than red through Phases 2–5. **AC/TC**: AC-F9-2, AC-F9-3, AC-F12-1, DM-7, DM-8; TC-VGATES-004, TC-VGATES-047. **Verify**: `bun run scripts/checks/error-table-sync.ts`, `bun test tests/checks/error-table-sync.test.ts`, `bun test tests/structure/error-table.test.ts`, and `bun test tests/structure/port-contract-inventory.test.ts`.
- [ ] **1.4** Add/extend `tests/structure/verify-gates-contract.test.ts`, `tests/structure/delivery-request-gate-facts.test.ts`, and `tests/structure/error-table.test.ts` for the new vocabulary, optional fields, exact row assertions for both new rows, and the unchanged ledger row; the `tests/structure/error-table.test.ts` `verify`/`entries` count updates land in task 1.3 with the rows. **AC/TC**: AC-F1-3, AC-F9-3, AC-F12-1, AC-F13-1, NFR-7; TC-VGATES-001, 003, 004. **Verify**: `bun test tests/structure/verify-gates-contract.test.ts tests/structure/delivery-request-gate-facts.test.ts tests/structure/error-table.test.ts`.
- [ ] **1.5** Bind the new contract surface to the workspace inventories: add the new contract module and its exact export surface to `tests/fixtures/ports/v1-contract-inventory.json`; add every new exported function/const to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` (the domain and package-root exports land in Phase 4.8/4.9 and the CLI barrel export in Phase 5.7); keep `tests/structure/inventory.json` current for new source modules; confirm no package/subpath/entrypoint/workspace-edge drift via `content-inventory.test.ts`, `port-contract-inventory.test.ts`, `subpaths.test.ts`, and `workspace-entrypoints.ts`. **AC/TC**: AC-F13-1, NFR-6; TC-VGATES-005, TC-VGATES-065. **Verify**: `bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts` and `bun run scripts/checks/workspace-entrypoints.ts`.

**Acceptance Criteria**:

- Must: AC-F1-3, AC-F9-3, AC-F12-1, AC-F13-1 — the contract is data-only, the four fields are optional, both rows and both documented rows exist, and the existing ledger row is unchanged.
- Must: `failureClass` is the closed read-result union `provider.payload.invalid`/`provider.not-found`; error-table codes live only in `failureCode`.
- Must: only the new `VERIFY_GATES_*` constants are declared; reused status constants are imported/re-exported by reference.
- Should: all gate/reason/source/count/name vocabularies are declared once and imported, never duplicated.

**Files and modules**:

- Code areas: `packages/core/src/contracts/verify-gates.ts` (new), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/contracts/ports.ts` (updated), `packages/core/src/contracts/error-table.ts` (updated), `tests/checks/error-table-sync.test.ts` (updated — `BASELINE_ROWS` length guard and `verify`-row expectation), `tests/structure/verify-gates-contract.test.ts` (new), `tests/structure/delivery-request-gate-facts.test.ts` (new), `tests/structure/error-table.test.ts` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated `EXECUTABLE_ALLOWANCES`), `tests/structure/inventory.json` (updated). The `packages/core/src/domain/index.ts` and `packages/core/src/index.ts` re-exports land in Phase 4.8/4.9.
- System docs: `doc/spec/features/feature-result-contract.md` (targeted table update), `doc/spec/features/feature-adapter-ports.md` (targeted field-table update). Full narrative reconciliation is Phase 7.

**Tests**:

- `bun test tests/structure/verify-gates-contract.test.ts tests/structure/delivery-request-gate-facts.test.ts tests/structure/error-table.test.ts`
- `bun run scripts/checks/error-table-sync.ts`
- `bun test tests/checks/error-table-sync.test.ts`
- `bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts`
- `bun run scripts/checks/workspace-entrypoints.ts`

**Completion signal**: `feat(GH-178): add verify-gates contracts and additive gate facts`

---

### Phase 2: GitHub delivery-request gate facts, 404 absence, and trap coverage

**Goal**: Add the adapter-local HTTP 404 absence kind, populate the four additive fields from GitHub detail reads with the fixed mergeability precedence, and extend the trap catalog with matching assertions in the required fixture locations.

**Tasks**:

- [ ] **2.1** Extend `packages/adapters/src/io/provider-transport.ts` with the additive adapter-local `provider.not-found` failure kind (a `ProviderNotFoundFailure` code plus a `providerNotFoundFailure` constructor, added to `ProviderReadFailure`); map HTTP 404 in `packages/adapters/src/github/client.ts` to `provider.not-found`, keeping every other non-2xx response as `provider.payload.invalid`. Add no error-table row, adapter operation, subpath export, or provider-native type. Add provider-side 404/non-404 assertions in `tests/behaviour/providers/github-inputs.test.ts` and `tests/behaviour/providers/github-collection.test.ts`. The read-specific gate mapping is implemented in Phase 4.3 (CI), Phase 4.4 (PR list/detail), and Phase 4.6 (work item) and asserted by TC-VGATES-061/067/068 in Phase 4.10/5.6. **AC/TC**: AC-F5-4, AC-F6-2, AC-F11-1, DM-14; TC-VGATES-061. **Verify**: `pnpm typecheck` and `bun test tests/behaviour/providers/github-inputs.test.ts tests/behaviour/providers/github-collection.test.ts`.
- [ ] **2.2** Extend `packages/adapters/src/github/normalize.ts` so `normalizePullRequest` populates `sourceHeadSha` from `head.sha` when present, maps `mergeable`/`mergeable_state` to `mergeableState` in the fixed precedence from F-12/Appendix A (`mergeable === false` with clean or dirty state, or `mergeable_state === "dirty"` → `conflicting`; `mergeable_state` in `blocked`/`behind`/`unstable`/`draft` → `not-mergeable` even when `mergeable === true`; null/absent/`computing`/unrecognized with `mergeable !== true` → `unknown`; `mergeable === true` with clean/absent state → `mergeable`; any remaining combination → `unknown`), and copies finite non-negative `commits`/`changed_files`; non-finite/negative counts stay absent. Extend `normalizeGithubPullList` to populate `sourceHeadSha` when available and never mergeability/counts. Keep the closed operation set and exports unchanged. **AC/TC**: AC-F12-1, DM-7, Appendix G; TC-VGATES-054, TC-VGATES-056, TC-VGATES-064. **Verify**: `pnpm typecheck`.
- [ ] **2.3** Complete the required trap set in `tests/fixtures/providers/traps/github.traps.json` with payloads under `tests/fixtures/providers/github/**`, plus matching assertions in `tests/structure/trap-catalog.test.ts` and `tests/behaviour/providers/github-trap.test.ts`: keep the existing `GITHUB-PR-LIST-REVIEW-DEFAULT` entry and add `GITHUB-PR-MERGEABLE-NULL`, `GITHUB-PR-MERGEABLE-DIRTY`, `GITHUB-PR-MERGEABLE-BLOCKED`, `GITHUB-PR-HEAD-SHA-ABSENT`, `GITHUB-PR-COMMIT-SURFACE-ABSENT`, `GITHUB-PR-ZERO-COMMITS`, `GITHUB-CHECKRUN-EMPTY`, `GITHUB-CHECKRUN-ALL-SKIPPED`, `GITHUB-CHECKRUN-PAGE-LIMIT`, `GITHUB-ISSUE-COMMENTS-ABSENT`, `GITHUB-PR-LIST-404`, `GITHUB-PR-DETAIL-404`, `GITHUB-CHECKRUN-404`, and `GITHUB-ISSUE-404`. Preserve the four-field entry shape and bidirectional coverage; every id has a catalog entry, a committed payload, and a replay assertion. Trap payloads and catalog entries stay under `tests/fixtures/providers/traps/` and `tests/fixtures/providers/github/**`; they are never placed under `tests/fixtures/verify-gates/`. **AC/TC**: AC-F12-1, AC-F14-1, DM-14; TC-VGATES-055, TC-VGATES-056, TC-VGATES-061. **Verify**: `bun test tests/structure/trap-catalog.test.ts tests/behaviour/providers/github-trap.test.ts`.
- [ ] **2.4** Add `tests/behaviour/providers/github-gate-facts.test.ts` plus committed payloads under `tests/fixtures/verify-gates/providers/github/pr/**`, `pr-detail/**`, `pr-list/**`, `check-runs/**`, `issue/**`, and `absence-404/**`, plus the squash mergeability matrix under `tests/fixtures/verify-gates/squash/mergeability-precedence/**`, for all four fields present, absent fields, null/computing mergeability, dirty/blocked/behind/unstable/draft states (including `mergeable === true` + blocked), zero counts, list-only head SHA, and read-specific 404 absence. Assert canaries never leak and that these behavioural fixtures are distinct from the trap payloads. **AC/TC**: AC-F12-1, AC-F7-3, AC-F14-1; TC-VGATES-054, TC-VGATES-061, TC-VGATES-064. **Verify**: `bun test tests/behaviour/providers/github-gate-facts.test.ts`.
- [ ] **2.5** Update the targeted normalization/trap section of `doc/spec/features/feature-provider-client-seeds.md` with the four fields, the fixed GitHub mapping/precedence, absence rule, the additive `provider.not-found` (HTTP 404) kind with no error-table row, unchanged operation set/exports, the new trap ids, and the distinct trap/behavioural fixture placement. Full reconciliation remains Phase 7. **AC/TC**: AC-F12-1, AC-F11-1, Appendix H; TC-VGATES-054, TC-VGATES-055, TC-VGATES-056, TC-VGATES-061. **Verify**: `bun test tests/structure/trap-catalog.test.ts` and `bun run scripts/checks/forbidden-literals.ts`.
- [ ] **2.6** Register the `normalize.ts` and `provider-transport.ts` changes only (no new module or operation) in the workspace inventories: add any new exported constructor to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`, keep `tests/structure/inventory.json` current, and confirm no export/operation/subpath drift with `bun test tests/structure/provider-surface.test.ts tests/structure/subpaths.test.ts tests/structure/content-inventory.test.ts`. **AC/TC**: AC-F13-1, NFR-6; TC-VGATES-005, TC-VGATES-065. **Verify**: `bun test tests/structure/provider-surface.test.ts tests/structure/subpaths.test.ts tests/structure/content-inventory.test.ts`.

**Acceptance Criteria**:

- Must: AC-F12-1 — detail populates all four fields when present; absent/null stays unknown; `mergeable === true` with blocked/behind/unstable/draft is `not-mergeable`; no provider-native type/operation/export crosses the subpath; traps gain matching entries in the required catalog/payload locations.
- Must: `provider.not-found` is adapter-local for HTTP 404 only; every other non-2xx remains `provider.payload.invalid`; no error-table row or new operation/subpath.
- Should: list read may populate only `sourceHeadSha`; no other field is fabricated from the list.

**Files and modules**:

- Code areas: `packages/adapters/src/io/provider-transport.ts` (updated), `packages/adapters/src/github/client.ts` (updated), `packages/adapters/src/github/normalize.ts` (updated), `tests/behaviour/providers/github-inputs.test.ts` (updated), `tests/behaviour/providers/github-collection.test.ts` (updated), `tests/behaviour/providers/github-gate-facts.test.ts` (new), `tests/structure/trap-catalog.test.ts` (updated), `tests/behaviour/providers/github-trap.test.ts` (updated), `tests/fixtures/providers/traps/github.traps.json` (updated), `tests/fixtures/providers/github/**` (new payloads), `tests/fixtures/verify-gates/providers/github/**` (new behavioural payloads), `tests/structure/content-inventory.test.ts` (updated `EXECUTABLE_ALLOWANCES`), `tests/structure/inventory.json` (updated only if a module changes).
- System docs: `doc/spec/features/feature-provider-client-seeds.md` (targeted update).

**Tests**:

- `bun test tests/behaviour/providers/github-inputs.test.ts tests/behaviour/providers/github-collection.test.ts`
- `bun test tests/behaviour/providers/github-gate-facts.test.ts tests/behaviour/providers/github-trap.test.ts tests/structure/trap-catalog.test.ts`
- `bun test tests/structure/provider-surface.test.ts tests/structure/subpaths.test.ts tests/structure/content-inventory.test.ts`
- `bun run scripts/checks/forbidden-literals.ts`

**Completion signal**: `feat(GH-178): add GitHub 404 absence, gate-fact normalization, and trap coverage`

---

### Phase 3: Expected CI job-set read

**Goal**: Read the declared repository CI workflow at the edge and extract the ordered expected job names with bounded, fail-closed validation.

**Tasks**:

- [ ] **3.1** Add `packages/adapters/src/file/ci-workflow.ts` implementing one bounded YAML read at `VERIFY_GATES_CI_WORKFLOW_PATH` (≤`VERIFY_GATES_WORKFLOW_MAX_BYTES` = 262144), extracting the top-level `jobs` map in declaration order, using each job's non-empty display `name` and falling back to the job id. Return the expected-set shape and a declared outcome (`read`, `failed`, `absent`) with no raw workflow content. Reuse the existing `yaml` substrate and bounded-parser discipline; do not add a dependency. **AC/TC**: AC-F4-1, DM-10, Appendix F; TC-VGATES-025, TC-VGATES-026. **Verify**: `pnpm typecheck`.
- [ ] **3.2** Export the read through `packages/adapters/src/file/index.ts`; register the new module in `tests/structure/inventory.json`; add any new exported function to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`; confirm no new subpath/entrypoint via `content-inventory.test.ts`, `subpaths.test.ts`, and `workspace-entrypoints.ts`. **AC/TC**: AC-F13-1, NFR-6; TC-VGATES-005, TC-VGATES-065. **Verify**: `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts` and `bun run scripts/checks/workspace-entrypoints.ts`.
- [ ] **3.3** Add workflow fixtures under `tests/fixtures/verify-gates/workflows/` (valid 23-job, absent, unreadable, malformed, empty jobs, duplicate names, over-cap 201, over-long 121 chars, 256 KiB boundary). Create no behaviour suite in this phase: `tests/behaviour/verify-gates-ci.test.ts` is created in Phase 4.10, after `evaluateVerifyGates` and the CI gate exist, so no suite exists before its subject. **AC/TC**: AC-F4-1; TC-VGATES-025, TC-VGATES-026. **Verify**: `git diff --check` (fixtures are exercised by Phase 4.10).

**Acceptance Criteria**:

- Must: AC-F4-1 — names are in declaration order, exact, non-empty, unique, ≤200, each ≤120 chars; any invalid/empty/unreadable set fails `ci-expected-jobs-invalid`; no fallback to observed run names.
- Should: the read is one bounded call and returns no raw workflow body.

**Files and modules**:

- Code areas: `packages/adapters/src/file/ci-workflow.ts` (new), `packages/adapters/src/file/index.ts` (updated), `tests/fixtures/verify-gates/workflows/**` (new), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated `EXECUTABLE_ALLOWANCES` if a function is exported).
- System docs: none in this phase; monorepo registration lands in Phase 7.

**Tests**:

- `git diff --check`
- `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts`
- `bun run scripts/checks/workspace-entrypoints.ts`

**Completion signal**: `feat(GH-178): read expected CI jobs from the repository workflow`

---

### Phase 4: Structured ledger evaluation, pure five-gate evaluator, citations, and renderers

**Goal**: Expose one pure structured ledger evaluation, then implement the pure evaluator that consumes it and applies the five gate rules — including the shared open-PR resolution helper and read-specific 404 mapping — plus the deterministic failure-summary and human-success renderers.

**Tasks**:

- [ ] **4.1** Introduce the pure `EvaluateVerifyChange` → `VerifyLedgerEvaluation` contract and implementation in `packages/core/src/domain/verify-change.ts` (or a sibling pure module re-exported through it). It returns the effective variant, outcome, required/completed/missing phase ids, declaration counts, and registry evidence (present/verifiedEmpty/recordCount/transitionCount/overlaidPhases) plus `kind`/`code` when present, on every outcome. Fix the DM-15 field semantics exactly: `finished`/`partial`/`state-unverified` carry the effective `full`/`lite` variant, ordered phase arrays, declaration-derived `requiredCount`/`completedCount`, and registry evidence (`state-unverified` keeps the evaluated arrays/counts plus the failed/torn evidence and `state.*` identity); a terminal document failure (`failed`: malformed notes or a missing target) carries `variant: "unknown"`, empty required/completed/missing arrays, zero declaration counts, and `registry.present: false` with zero counts, with `kind`/`code` naming the document failure and source outcome `failed` (malformed) or `absent` (missing target). `failed` maps deterministically to lifecycle `fail` and `state-unverified` to lifecycle `unknown`; no other combination is valid. Make `classifyVerifyChange` a thin wrapper over it that keeps its exact existing success/failure shape and preserves `verify change` output. Add wrapper/structured-field assertions in `tests/behaviour/verify-change-classification.test.ts` and `tests/behaviour/verify-change-state.test.ts`. **AC/TC**: AC-F2-1, AC-F2-2, AC-F2-4, DM-11, DM-15, NFR-3; TC-VGATES-013, TC-VGATES-015, TC-VGATES-062. **Verify**: `pnpm typecheck` and `bun test tests/behaviour/verify-change-classification.test.ts tests/behaviour/verify-change-state.test.ts`.
- [ ] **4.2** Add `packages/core/src/domain/verify-gates.ts` with `evaluateVerifyGates(facts)` and the injected fact types. Consume the structured `VerifyLedgerEvaluation`/`EvaluateVerifyChange` for lifecycle (or a structured evaluation passed from the edge); never parse the classifier summary and never call the `classifyVerifyChange` wrapper; implement lifecycle precedence (document/missing-target → incomplete → platform unknown → pass) and citation counts/names from the evaluation on every outcome, including terminal document failures (empty arrays, zero declaration counts, document failure identity) and `state-unverified` (declaration-derived arrays/counts with failed registry evidence). **AC/TC**: AC-F2-1/2/3/4, AC-F8-1, AC-F9-1, F-13, DM-2..DM-6, DM-11, DM-15; TC-VGATES-013..017, TC-VGATES-045, TC-VGATES-062. **Verify**: `pnpm typecheck`.
- [ ] **4.3** Implement the CI gate over the expected set, the resolved delivery-request detail, and check-run facts: head unresolved, invalid expected set, read failure, truncation, zero runs, failed, canceled, pending, all-skipped, missing jobs, and pass, in Appendix A precedence. A matched PR whose detail read returns HTTP 404 (`provider.not-found`) makes CI `fail` `head-unresolved` with detail source outcome `absent` (the pushed head can no longer be resolved), never `unknown`; a non-404 detail failure (transport, non-404 non-2xx, credential, binding) is `unknown` (`read-failed`/`credential-unavailable`/`address-unresolved`). A check-run HTTP 404 makes CI `unknown` `read-failed` with check-run source outcome `absent` and `failureClass: provider.not-found`, never `failed` and never `ci-no-runs`; other check-run failures are `unknown` with source `failed`. Fix the count denominators per DM-11: `expected` is the declared expected name count, `runs` is the observed normalized page size, `succeeded`/`failed`/`pending`/`skipped`/`canceled` are observed per-run state buckets (exactly one bucket per run, duplicate names collapsed to the worst effective state and counted once), `missing` is expected names not observed; an unrecognized run state contributes only to `runs`, is treated as a failed observation, and makes the gate `fail` `ci-failed`, never a pass. Extra non-expected runs never change `expected`/`missing`. **AC/TC**: AC-F3-1..6, AC-F4-1, AC-F11-1, DM-10, DM-11, DM-14; TC-VGATES-018..027, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068, TC-VGATES-070. **Verify**: `pnpm typecheck`.
- [ ] **4.4** Add the pure shared open-PR resolution helper (`resolveOpenPr` in `packages/core/src/domain/verify-gates.ts` or a sibling pure module) implementing DM-13 and `VERIFY_GATES_OPEN_PR_LIMIT` exactly: detached HEAD → `branch-unresolved` without a PR read; raw page at the limit → `ambiguous-open-pr` with or without a match; exactly one `sourceRef === branch` match → resolved; more than one match → `ambiguous-open-pr`; zero matches with zero open requests → `no-open-pr`; zero matches with at least one open request → `branch-mismatch`. Both push parity and squash preflight consume this same helper; squash accepts `branch-mismatch`. Map PR list/detail HTTP 404 (`provider.not-found`, source outcome `absent`) to `no-open-pr` for an absent list, and to `head-unresolved`/`absent` for a matched detail read for every detail-consuming gate (`ci-green`, `push-parity`, `squash-preflight`); a non-404 list/detail failure is `unknown`. **AC/TC**: AC-F1-2, AC-F3-5, AC-F5-2/3/4, AC-F7-2/3, DM-9, DM-13, DM-14; TC-VGATES-011, TC-VGATES-030, TC-VGATES-060, TC-VGATES-061, TC-VGATES-067. **Verify**: `pnpm typecheck`.
- [ ] **4.5** Implement push parity and squash preflight on the shared resolution helper: attached branch, unique resolved PR, full 40/64-hex case-insensitive SHA comparison; squash precedence over review state `open`/`approved`/`changes-requested` (not draft/closed/merged), target `main-tools`, the fixed mergeability precedence, and surface. Emit `squash-signals` as exactly two distinct ordered tokens (`draft=<true|false>` then `mergeable=<mergeable|conflicting|not-mergeable|unknown>`) on pass and on every condition failure where a delivery-request detail was read; the list is empty only when no detail was read (no detail attempted, an open-PR resolution failure, or a failed/404 detail read), with the prerequisite named and no token fabricated or defaulted. A successful detail read that omits `commitCount`/`changedFileCount` omits the `commits`/`changedFiles` counts as unknown (never zero, never synthesized) while still carrying the two `squash-signals` tokens. A matched-detail 404 makes squash `fail` `head-unresolved`/`absent` with an empty signals list. The squash allowed reasons include the shared resolution failures `branch-unresolved`, `no-open-pr`, `branch-mismatch`, `ambiguous-open-pr`, and `head-unresolved`. **AC/TC**: AC-F5-1/2, AC-F7-1/2/3, AC-F8-1, DM-5, DM-7, DM-11; TC-VGATES-028..031, TC-VGATES-035..039, TC-VGATES-060, TC-VGATES-061, TC-VGATES-064, TC-VGATES-067. **Verify**: `pnpm typecheck`.
- [ ] **4.6** Implement the owner gate by reusing `STATUS_OWNER_ATTENTION_LABELS` case-insensitively: absent/present in contract order, `ticket-unresolved` for malformed/non-numeric identities (`unresolved`) and work-item HTTP 404 (`provider.not-found`, source outcome `absent`), `unknown` for transport/non-404 non-2xx/credential/binding failures. Do not add a comment condition. **AC/TC**: AC-F6-1/2, DM-4, DM-5, DM-11, DM-14; TC-VGATES-032..034, TC-VGATES-061. **Verify**: `pnpm typecheck`.
- [ ] **4.7** Implement overall derivation (`pass` iff all five pass; `fail` if any fail; otherwise `unknown`), failure-identity precedence, and both renderers: a bounded five-gate failure summary with one header line plus exactly one line per gate (≤6 lines, ≤4096 bytes) and a six-line human success report (≤4096 bytes). Every failure-summary gate line renders both segments in the fixed order `counts=... names=...`: when a gate's count subset is empty the segment is the literal `counts=-`, and when all its name lists are empty the segment is the literal `names=-`; an empty set is never a zero alias, a bare `counts=`/`names=`, or an omitted segment. Citations carry `failureClass` only from the closed `provider.payload.invalid`/`provider.not-found` union; a read carrying an error-table code uses `failureCode` and omits `failureClass`. Reuse contract ordering; no timestamps, raw payloads, titles, comments, or secrets. **AC/TC**: AC-F1-3, AC-F8-1/2, AC-F9-1/2, AC-F10-2, DM-5, DM-6; TC-VGATES-040..043, 045, 046. **Verify**: `pnpm typecheck`.
- [ ] **4.8** Export the structured ledger evaluator (`EvaluateVerifyChange`, `VerifyLedgerEvaluation`), the gates evaluator (`evaluateVerifyGates`), the shared resolution helper, and the renderers from `packages/core/src/domain/index.ts`; add `tests/structure/verify-gates-imports.test.ts` asserting contracts-only plus `verify-change` domain imports, no I/O/clock/randomness/ambient access, the structured evaluator is the single ledger-rule implementation, and contract-array ordering. **AC/TC**: AC-F13-1, NFR-6; TC-VGATES-002, TC-VGATES-062. **Verify**: `bun test tests/structure/verify-gates-imports.test.ts`.
- [ ] **4.9** Re-export the new pure domain symbols (`EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, the resolution helper, and the renderers) additively from the explicit named export list in the `packages/core/src/index.ts` package root so `@delivery-os/cli` imports them from `@delivery-os/core`; add no subpath, entrypoint, workspace edge, or dependency. Add `tests/structure/verify-gates-exports.test.ts` asserting each symbol is importable and callable/constructible from `@delivery-os/core`, that `packages/core/package.json` subpaths are unchanged, and that no file imports the new symbols from a new subpath. Update `tests/fixtures/ports/v1-contract-inventory.json` only if the contract surface changed, add the new domain/package-root exports to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`, and keep `tests/structure/inventory.json` current. **AC/TC**: AC-F13-1, NFR-6, DM-12; TC-VGATES-005, TC-VGATES-065, TC-VGATES-069. **Verify**: `bun test tests/structure/verify-gates-exports.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts` and `bun run scripts/checks/workspace-entrypoints.ts`.
- [ ] **4.10** Add/extend the pure suites `tests/behaviour/verify-gates-lifecycle.test.ts`, `verify-gates-ci.test.ts` (created here, after the evaluator and CI gate; it also owns the workflow extraction/validation cases from Phase 3.3, the matched-detail 404 and check-run 404 cases, and the denominator/one-bucket/unrecognized-state matrix), `verify-gates-parity-squash.test.ts`, `verify-gates-owner-composition.test.ts` (pure part), and `verify-gates-performance.test.ts` with restored controls and canaries; the CLI-output/envelope suite `tests/behaviour/verify-gates-output.test.ts` is created in Phase 5.6 after the CLI tasks, so Phase 4.10 keeps only the pure renderer/overall-derivation assertions for TC-VGATES-042 summary grammar, 043, and 045 across the pure suites; cover every reason and precedence path, including at-limit-with/without-match fixtures under `tests/fixtures/verify-gates/parity/at-limit/**`, branch-mismatch, read-specific 404 (PR list, matched detail for CI/parity/squash, work item, check runs), structured lifecycle evidence and DM-15 failure-path fields, mergeability precedence, the empty-vs-two-token `squash-signals` rule (including a successful detail read with omitted `commitCount`/`changedFileCount` that omits those counts as unknown while keeping both tokens), and the `counts=-`/`names=-` empty-segment grammar (never a zero alias, a bare segment, or an omission). **AC/TC**: AC-F2-1..4, F3-1..6, F5-1..4, F6-1/2, F7-1..3, F8-1/2, F9-1/2, F10-2, F12-1; TC-VGATES-013..034, 035..043, 045, 053, 060..062, 064, 067, 068, 070. **Verify**: `bun test tests/behaviour/verify-gates-lifecycle.test.ts tests/behaviour/verify-gates-ci.test.ts tests/behaviour/verify-gates-parity-squash.test.ts tests/behaviour/verify-gates-owner-composition.test.ts tests/behaviour/verify-gates-performance.test.ts`.

**Acceptance Criteria**:

- Must: the three ticket negatives (red, missing job, vacuous green), all five gates, all reasons, `squash-signals` ordering (two tokens whenever a detail was read, empty only when none was), failure identity precedence, and overall derivation behave exactly as the spec.
- Must: the lifecycle citation's variant, required/completed/missing counts, ordered `missing-phases`, and unique registry evidence come from `VerifyLedgerEvaluation` on completion and failure; terminal document failures carry the DM-15 empty/zero fields and classified outcomes carry arrays/counts/registry evidence; the gate never parses a summary and never calls the wrapper; `classifyVerifyChange` wraps the evaluator and keeps its existing shape.
- Must: a matched PR-detail 404 makes `ci-green`, `push-parity`, and `squash-preflight` fail `head-unresolved`/`absent`; a check-run 404 is source `absent` with `unknown` `read-failed`; non-404 detail/check-run failures stay `unknown`.
- Must: CI counts use the declared denominators, one state bucket per observed run, and an unrecognized run state cannot pass.
- Must: the shared open-PR resolution helper is the only resolution path for both parity and squash; at-limit with or without a match is `ambiguous-open-pr`; `branch-mismatch` is accepted by squash.
- Must: `failureClass` is only `provider.payload.invalid`/`provider.not-found`; error-table codes appear in `failureCode`.
- Must: every failure-summary gate line always carries both `counts=` and `names=` segments in that order, rendering `-` when empty and never a zero alias, a bare segment, or an omitted segment.
- Must: a successful detail read with absent `commitCount`/`changedFileCount` omits the `commits`/`changedFiles` counts (unknown, never zero) while still carrying the two ordered `squash-signals` tokens.
- Must: the domain imports only contracts and the existing verify classifier; no I/O or ambient reads; the new symbols are importable from `@delivery-os/core` through the additive package-root export.
- Should: the evaluator is linear over capped inputs and stays within 50 ms on capped facts.

**Files and modules**:

- Code areas: `packages/core/src/domain/verify-change.ts` (updated — structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation` and wrapper), `packages/core/src/domain/verify-gates.ts` (new — evaluator, shared resolution helper, renderers), `packages/core/src/domain/index.ts` (updated — barrel), `packages/core/src/index.ts` (updated — explicit package-root named exports), new/extended pure behaviour suites under `tests/behaviour/` (the CLI-output suite `tests/behaviour/verify-gates-output.test.ts` is created in Phase 5.6), `tests/structure/verify-gates-imports.test.ts` (new), `tests/structure/verify-gates-exports.test.ts` (new), `tests/structure/content-inventory.test.ts` (updated `EXECUTABLE_ALLOWANCES`), `tests/structure/inventory.json` (updated if a module changes), `tests/fixtures/ports/v1-contract-inventory.json` (updated only if the contract surface changed), fixtures under `tests/fixtures/verify-gates/**`.
- System docs: none; the feature spec lands in Phase 7.

**Tests**:

- `bun test tests/behaviour/verify-change-classification.test.ts tests/behaviour/verify-change-state.test.ts`
- `bun test tests/behaviour/verify-gates-lifecycle.test.ts`
- `bun test tests/behaviour/verify-gates-ci.test.ts`
- `bun test tests/behaviour/verify-gates-parity-squash.test.ts`
- `bun test tests/behaviour/verify-gates-owner-composition.test.ts`
- `bun test tests/behaviour/verify-gates-performance.test.ts`
- `bun test tests/structure/verify-gates-imports.test.ts tests/structure/verify-gates-exports.test.ts`
- `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts`
- `bun run scripts/checks/workspace-entrypoints.ts`

**Completion signal**: `feat(GH-178): evaluate five merge gates from structured ledger evidence`

---

### Phase 5: CLI surface, edge composition, and output

**Goal**: Wire `verify gates` into the command definition and runtime edge while preserving `verify change`, enforce grammar before reads, and render machine/human output through the existing envelope path with the additively widened `string | undefined` `humanText` hook (`gates` renders the report; every other target delegates to redact-then-serialize).

**Tasks**:

- [ ] **5.1** Extend `packages/cli/src/commands/verify.ts` and add `packages/cli/src/commands/verify-gates.ts` so the `verify` command accepts exactly `change` and `gates`, each with one non-empty ref, no command-specific flags, and the global `--json` unchanged; `positionals.max` stays 2; missing/empty ref or unknown/plain `verify` subcommand returns `input.value.rejected`; a third positional/unknown flag is a parser failure (`fallback.invocation`) before any read. Define the combined seam exactly: `VerifyCommandRuntime` in `verify.ts` gains an optional `gates` member typed to the gates runtime exported by `verify-gates.ts` (the equivalent combined type); `createVerifyCommandDefinition(runtime: VerifyCommandRuntime)` keeps its single-argument signature and dispatches on `positionals[0]` after grammar validation (`change` → the existing ledger handler, `gates` → the gates handler); a `gates` positional without the optional `gates` runtime is rejected as `input.value.rejected` before any read. Preserve the existing `verify change` handler path and export the gates runtime type. **AC/TC**: AC-F1-1, F-1, DM-12; TC-VGATES-008, TC-VGATES-009, TC-VGATES-069. **Verify**: `pnpm typecheck` and `bun test tests/behaviour/verify-change-rejections.test.ts`.
- [ ] **5.2** Implement the gates handler result contract: pass → success data (full `delivery.verify-gates.v1` report); any fail → error-only `verify.gates.failed` exit 1; otherwise unknown → first resolvable unknown identity or `verify.gates.unavailable` exit 2; no stream/exit selection in the handler. **AC/TC**: AC-F9-1/2, AC-F10-1, DM-1, DM-6, DM-8; TC-VGATES-045, TC-VGATES-046. **Verify**: `pnpm typecheck` and `bun test tests/behaviour/verify-envelope.test.ts` (the exit/envelope assertions are added with the output suite in 5.6, after the CLI surface exists).
- [ ] **5.3** Compose both runtimes in `packages/cli/src/edge.ts`: keep `createVerifyCommandRuntime` for the change reads, add `createVerifyGatesCommandRuntime` for the gates reads, and pass one combined `VerifyCommandRuntime` (`change` reads plus the optional `gates` member) through the delivered `createConfigProgram` / `ConfigProgramOptions.verify` option. `ConfigProgramOptions.verify` stays the single option (no `verifyGates` option) and is typed to the combined runtime; `createVerifyCommandDefinition` receives that one object; add no second `verify` definition. Read repository branch/HEAD/detached/origin, pm-notes and verified registry, bounded workflow expected set, one open-PR page at `VERIFY_GATES_OPEN_PR_LIMIT` (pass the raw page and branch to the shared resolution helper), matched detail, one check-runs page at `VERIFY_GATES_CI_RUN_LIMIT`, and one work-item read. Enforce the credential-reference guard and unresolved-binding behavior before provider reads (an anonymous/non-credential-reference instance withholds GitHub reads and makes every provider-backed gate `unknown` with `credential-unavailable` and `config.credential.missing`, while lifecycle still runs; a missing credential makes the overall unknown reuse `config.credential.missing` at exit 1; an unresolved binding makes provider gates `unknown` with `address-unresolved`). Pass `provider.not-found` absence through to the read-specific gate facts instead of flattening it: a matched detail 404 reaches CI/parity/squash as `head-unresolved`/`absent`, a list 404 as `no-open-pr`, a work-item 404 as `ticket-unresolved`/`absent`, and a check-run 404 as absent source with `unknown` `read-failed`; no retries/pagination/writes/spawns. **AC/TC**: AC-F1-1/2, AC-F3-3/5/6, AC-F4-1, AC-F5-2/3/4, AC-F6-2, AC-F7-3, AC-F11-1/2, F-1; TC-VGATES-011, 012, 031, 034, 039, 048..051, 060, 061, 067, 068, 069. **Verify**: `pnpm typecheck` and `bun test tests/behaviour/verify-gates-owner-composition.test.ts tests/behaviour/verify-gates-surface.test.ts`.
- [ ] **5.4** Widen `CommandDefinition.humanText` in `packages/cli/src/index.ts` additively from `(data: unknown, brand: BrandIdentity) => string` to `(data: unknown, brand: BrandIdentity) => string | undefined` (a defined string wins over `humanSuccess`/`humanJson`; `undefined` falls through to the existing output path). Add the single `verify` definition's `humanText` hook in `packages/cli/src/commands/verify.ts` dispatching on the success `data.target`: `target: "gates"` returns the six-line gates report; every other target returns `undefined`, so `runCli` omits the hook and `verify change` stays on the delivered `humanSuccess`/`humanJson` redact-then-serialize pipeline. Do not return a serialized JSON string for non-`gates` targets: string redaction cannot redact a secret whose raw form is not a contiguous substring of its JSON-escaped form, and the bytes would differ. Add the pre-change golden `tests/fixtures/verify-gates/golden/verify-change-human.txt` captured from that redact-then-serialize path; the byte-equality and planted-secret redaction assertions are added with the output suite in 5.6 and the golden suite in 6.3; do not change the envelope shape or output path. **AC/TC**: AC-F10-2, AC-F10-3, DM-6, DM-12, NFR-3, NFR-4; TC-VGATES-043, TC-VGATES-063. **Verify**: `pnpm typecheck` and `bun test tests/behaviour/verify-change-classification.test.ts`.
- [ ] **5.5** Add the CLI-harness suites `tests/behaviour/verify-gates-surface.test.ts` and `tests/behaviour/verify-gates-target.test.ts` for grammar-before-read, plain/wrong subcommand rejection, the combined `change`+`gates` dispatch, attached/detached HEAD, unique/no/ambiguous/branch-mismatch PR, at-limit with and without a match, no PR-number argument, and exactly five records without short-circuit, using injected `runCli` dependencies and throwing reads. **AC/TC**: AC-F1-1/2/3, AC-F5-3, AC-F10-3, DM-2, DM-9, DM-13; TC-VGATES-008..012, TC-VGATES-060, TC-VGATES-069. **Verify**: `bun test tests/behaviour/verify-gates-surface.test.ts tests/behaviour/verify-gates-target.test.ts`.
- [ ] **5.6** Extend `tests/behaviour/verify-gates-owner-composition.test.ts` for credential-reference refused/missing, network/non-404 non-2xx/payload failures, read-specific 404 absence (work item, PR list/detail, check runs), unresolved binding, read budget, no-spawn guard, and per-gate `unknown`; assert a matched PR-detail 404 and a check-run 404 reach the `ci-green`/`push-parity`/`squash-preflight` facts with the exact source outcomes from Phase 4.3/4.4. Create `tests/behaviour/verify-gates-output.test.ts` here, after the 5.1–5.5 CLI tasks, and use it for the pure renderer/overall assertions carried over from Phase 4.7 (TC-VGATES-042 summary grammar, including every line's mandatory `counts=`/`names=` segments and the `counts=- names=-` empty rendering plus the no-usable-detail squash line; 043; 045), the machine success envelope, byte bound, failure exclusivity, the widened `string | undefined` `humanText` dispatch, and the exit/failure-identity matrix (TC-VGATES-044, 046). Add the TC-VGATES-063 planted-secret control with a JSON-escaping-sensitive secret (raw form containing a double quote, a backslash, and a newline, so it is not a contiguous substring of its JSON-escaped form): inject it in the registered `secrets` list, in the `verify change` data, and in a gates citation/identity value; assert `humanText` returns `undefined` for `target: "change"` so `verify change` runs redact-then-serialize and stays byte-identical to the pre-change golden under the same secret-bearing data, assert the gates six-line report and the machine envelope redact every occurrence through string redaction of the rendered report, and assert no unredacted raw or JSON-escaped secret appears in stdout, stderr, the human report, or the envelope. **AC/TC**: AC-F3-5/6, AC-F5-4, AC-F6-2, AC-F8-2, AC-F9-1/2, AC-F10-1/2/3, AC-F11-1/2, NFR-2, NFR-3, NFR-4, NFR-5, NFR-9; TC-VGATES-042..046, 048..052, 061, 063, 067, 068. **Verify**: `bun test tests/behaviour/verify-gates-owner-composition.test.ts tests/behaviour/verify-gates-output.test.ts`.
- [ ] **5.7** Update `tests/structure/cli-edge-seam.test.ts` and `tests/structure/create-runtime.test.ts` for the additive combined-runtime wiring (`ConfigProgramOptions.verify` stays the single option; one `verify` definition with the optional `gates` member); barrel-export the gates runtime type from `packages/cli/src/commands/index.ts` beside `createVerifyCommandDefinition`; add every new CLI/domain export to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`, register new source modules in `tests/structure/inventory.json`, keep `tests/fixtures/ports/v1-contract-inventory.json` current for contract exports, and confirm no new runtime-API location or subpath via the existing checks. **AC/TC**: AC-F1-1, AC-F13-1, NFR-6; TC-VGATES-005, TC-VGATES-007, TC-VGATES-065, TC-VGATES-069. **Verify**: `bun test tests/structure/cli-edge-seam.test.ts tests/structure/create-runtime.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts` and `bun run scripts/checks/workspace-entrypoints.ts`.

**Acceptance Criteria**:

- Must: AC-F1-1/2, AC-F3-5/6, AC-F5-3/4, AC-F9-2, AC-F10-1/2/3, AC-F11-1/2 — grammar is pre-read, one `verify` definition accepts the combined runtime, five gates always exist, pass/fail/unknown exits are correct, human success is six lines, and read-only composition holds.
- Must: `CommandDefinition.humanText` returns `string | undefined`; `verify`'s hook returns the six-line report only for `target: "gates"` and `undefined` for every other target, so `verify change` keeps the delivered `humanSuccess`/`humanJson` redact-then-serialize path and its bytes are identical to the pre-change golden, including for a JSON-escaping-sensitive secret.
- Must: a matched PR-detail 404 fails CI/parity/squash `head-unresolved`/`absent`; a check-run 404 is `unknown` `read-failed` with source `absent`; non-404 detail failures stay `unknown`.
- Must: `ConfigProgramOptions.verify` remains the single option typed to the combined runtime; no second `verify` definition exists.
- Must: `verify change` output/errors/read set remain unchanged.
- Should: the runtime reads at most four outbound GETs with zero retries/pagination.

**Files and modules**:

- Code areas: `packages/cli/src/index.ts` (updated — `CommandDefinition.humanText` widened additively to `string | undefined`, with the `undefined` delegation falling through to `humanSuccess`/`humanJson`), `packages/cli/src/commands/verify.ts` (updated — `VerifyCommandRuntime.gates?`, first-positional dispatch, `humanText` returning the gates report or `undefined`), `packages/cli/src/commands/verify-gates.ts` (new — gates handler and gates runtime type), `packages/cli/src/commands/index.ts` (updated — re-export the gates runtime type beside `createVerifyCommandDefinition`), `packages/cli/src/edge.ts` (updated — one combined `ConfigProgramOptions.verify`, `createVerifyGatesCommandRuntime`, existing `createVerifyCommandRuntime` retained), `tests/fixtures/verify-gates/golden/verify-change-human.txt` (new — pre-change redact-then-serialize golden), `tests/structure/inventory.json` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated if contract exports changed), `tests/structure/content-inventory.test.ts` (updated `EXECUTABLE_ALLOWANCES`), `tests/behaviour/verify-gates-surface.test.ts` (new), `tests/behaviour/verify-gates-target.test.ts` (new), `tests/behaviour/verify-gates-output.test.ts` (new — created in 5.6 after the CLI tasks; output/redaction assertions), `tests/golden/redaction.test.ts` (regression — existing secret-redaction chokepoint suite re-run for the widened hook contract), and `tests/behaviour/verify-gates-owner-composition.test.ts` (extended).
- System docs: none; `feature-verify-change-and-exit-taxonomy.md` subcommand narrative is Phase 7.

**Tests**:

- `bun test tests/behaviour/verify-gates-surface.test.ts tests/behaviour/verify-gates-target.test.ts`
- `bun test tests/behaviour/verify-gates-owner-composition.test.ts tests/behaviour/verify-gates-output.test.ts`
- `bun test tests/behaviour/verify-change-rejections.test.ts tests/behaviour/verify-change-classification.test.ts`
- `bun test tests/golden/redaction.test.ts`
- `bun test tests/structure/cli-edge-seam.test.ts tests/structure/create-runtime.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts`
- `bun run scripts/checks/workspace-entrypoints.ts`

**Completion signal**: `feat(GH-178): add verify gates command surface and edge composition`

---

### Phase 6: Evidence corpus, golden outputs, checks, and live smoke

**Goal**: Prove completeness and non-vacuity with the committed corpus, pin the output goldens, wire the no-live-call guard, and add the opt-in structural live smoke.

**Tasks**:

- [ ] **6.1** Add `tests/fixtures/verify-gates/corpus/cases.json` and case directories for every gate × verdict × reason, plus the three ticket negatives (`red-pipeline`, `missing-job`, `vacuous-green`), `push-mismatch`, `owner-present`, `bad-squash`, at-limit with a match, at-limit without a match, `branch-mismatch`, the read-specific 404 absence cases (PR list, matched PR detail for CI/parity/squash, work item, check runs), and the CI denominator/unrecognized-state cases; include per-case `squash-signals` expectations and stable unique case ids. **AC/TC**: AC-F3-5/6, AC-F14-1, NFR-10; TC-VGATES-057, TC-VGATES-060, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068, TC-VGATES-070. **Verify**: `git diff --check` (fixtures are exercised by 6.2).
- [ ] **6.2** Add `tests/behaviour/verify-gates-corpus.test.ts` with the completeness meta-check (missing/stale/duplicate/wrong verdict fails by case name), non-vacuity controls (empty manifest, fabricated/missing `squash-signals`, fail/unknown case would produce success/data/exit 0), and restored controls through the same evaluator; assert the corpus contains the matched-detail 404 case for all three detail-consuming gates, the check-run 404 case as source `absent`/`unknown` `read-failed`, and the unrecognized-run-state case. **AC/TC**: AC-F14-1, NFR-1, NFR-10; TC-VGATES-057, TC-VGATES-058, TC-VGATES-067, TC-VGATES-068, TC-VGATES-070. **Verify**: `bun test tests/behaviour/verify-gates-corpus.test.ts`.
- [ ] **6.3** Add `tests/fixtures/verify-gates/golden/success-data.json`, `failure-summary.txt` (including a no-usable-detail squash line rendered `counts=- names=-`), `human-success.txt`, and `verify-change-human.txt` (captured from the pre-change `humanSuccess`/`humanJson` redact-then-serialize path); add `tests/golden/verify-gates.test.ts` using fixed brand `example-product`, fixed two-tick clock, fixed `runId`, `assertEnvelopeContract`, replay equality, the success-data byte bound, the six-line gates report, and byte-identical `verify change` human output — including under a planted JSON-escaping-sensitive secret whose raw form differs from its JSON-escaped form, proving `humanText` returned `undefined` and the data-object redaction ran before serialization. **AC/TC**: AC-F8-2, AC-F10-1/2/3, AC-F11-2, NFR-3, NFR-5; TC-VGATES-042, 043, 044, 052, 063. **Verify**: `bun test tests/golden/verify-gates.test.ts`.
- [ ] **6.4** Add `tests/fixtures/verify-gates/cases/network-guard.ts` exporting `createNoNetworkGuard()` (the shared no-live guard installed as a preload for the default suite) and `tests/checks/verify-gates-no-live-calls.test.ts` (network spy using that guard; zero live calls in default suite), plus the opt-in `tests/behaviour/verify-gates-live.test.ts` gated by `VERIFY_GATES_LIVE=1`, asserting only structural invariants (five gates in order, citations present, bounds, no secrets, exit semantics) and pinning no volatile counts. **AC/TC**: AC-F14-1, NFR-10; TC-VGATES-059. **Verify**: `bun test tests/checks/verify-gates-no-live-calls.test.ts`; optionally `VERIFY_GATES_LIVE=1 bun test tests/behaviour/verify-gates-live.test.ts`.
- [ ] **6.5** Extend `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts`, `tests/structure/trap-catalog.test.ts`, `tests/structure/verify-gates-contract.test.ts`, `tests/structure/verify-gates-exports.test.ts`, `tests/structure/content-inventory.test.ts`, and `tests/structure/port-contract-inventory.test.ts` with mutation/negative controls for unchanged rows, projection literals, all required trap coverage, the real workflow invariant (23 unique jobs, bounds, declaration order), the package-root export surface, and the new module/export registrations. The `tests/checks/error-table-sync.test.ts` `BASELINE_ROWS` length guard and `verify`-row count already land in Phase 1.3; this task adds only the additional mutation/negative controls, so the suite is never left red. The renderer negative controls include a zero alias for an empty count, a bare `counts=`/`names=`, and an omitted `counts=`/`names=` segment (each must fail the grammar assertion), plus a no-usable-detail squash line that must render exactly `counts=- names=-`. **AC/TC**: AC-F9-3, AC-F12-1, AC-F13-1, AC-F14-1, NFR-7; TC-VGATES-004, 046, 047, 055, 057, 065, 069. **Verify**: `bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts tests/structure/trap-catalog.test.ts tests/structure/verify-gates-contract.test.ts tests/structure/verify-gates-exports.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts`.
- [ ] **6.6** Run the focused evidence battery and fix only regressions in the new suites; confirm boundary/fixture coverage and no live calls. **AC/TC**: all evidence TCs; NFR-2, NFR-3, NFR-5, NFR-10; TC-VGATES-051, 052, 058, 059, 060, 061, 062, 063, 064, 065, 067, 068, 069, 070. **Verify**: `bun test tests/behaviour/verify-gates-corpus.test.ts tests/golden/verify-gates.test.ts tests/checks/verify-gates-no-live-calls.test.ts` and `bun test tests/boundaries`.

**Acceptance Criteria**:

- Must: AC-F14-1 — every gate/verdict/reason has a fixture; the completeness meta-check fails closed; the three ticket negatives, at-limit with/without match, branch-mismatch, and 404 absence (including the matched-detail 404 for CI/parity/squash and the check-run 404) are first-class; default CI makes zero live calls under `tests/fixtures/verify-gates/cases/network-guard.ts`.
- Must: AC-F8-2 and AC-F10-1/2/3 — goldens pin the failure summary, human report, machine data, and `verify change` bytes; replay is byte-identical.
- Should: the opt-in live smoke passes structurally without volatile count assertions.

**Files and modules**:

- Code areas: `tests/fixtures/verify-gates/corpus/**`, `tests/fixtures/verify-gates/golden/**` (including `verify-change-human.txt`), `tests/fixtures/verify-gates/cases/network-guard.ts` (new), `tests/behaviour/verify-gates-corpus.test.ts`, `tests/golden/verify-gates.test.ts`, `tests/checks/verify-gates-no-live-calls.test.ts`, `tests/behaviour/verify-gates-live.test.ts`, extended checks/structure suites including `tests/structure/verify-gates-exports.test.ts`.
- System docs: none.

**Tests**:

- `bun test tests/behaviour/verify-gates-corpus.test.ts`
- `bun test tests/golden/verify-gates.test.ts`
- `bun test tests/checks/verify-gates-no-live-calls.test.ts`
- `bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts tests/structure/trap-catalog.test.ts tests/structure/verify-gates-exports.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts`
- `bun test tests/boundaries`

**Completion signal**: `test(GH-178): add verify gates corpus, goldens, and live guards`

---

### Phase 7: Current-truth documentation reconciliation

**Goal**: Make the new capability durable and reconcile every document Appendix H names without changing runtime behavior.

**Tasks**:

- [ ] **7.1** Author `doc/spec/features/feature-verify-gates.md` with `ados_distribution: internal`, covering the five gates, fixed order, verdicts, citations, expected job set, push parity, the shared open-PR resolution rule including at-limit and `branch-mismatch`, owner-gate limitation, squash preflight and mergeability precedence, read-specific 404 absence, overall/exit matrix, bounds, read budget, and the two error rows; link the spec, decisions, and related feature docs. Register the doc (and any other new user-facing doc) in the `registered` list of `scripts/checks/forbidden-literals.registry.json`. **AC/TC**: G-12, Appendix G, Appendix H, AC-F13-1, AC-F14-1; TC-VGATES-001, 057, 066. **Verify**: `bash scripts/.tests/test-doc-distribution.sh` and `bun run scripts/checks/forbidden-literals.ts`.
- [ ] **7.2** Reconcile `doc/spec/features/feature-verify-change-and-exit-taxonomy.md` (add `gates`, consumer link, keep `verify change` ledger-only/network-free, record `classifyVerifyChange` as a wrapper and reference `EvaluateVerifyChange`/`VerifyLedgerEvaluation`, update the "exactly one subcommand" sentence), `feature-status-digest.md` (shared owner labels and CI semantics including `unknown`), `feature-provider-client-seeds.md` (four fields, fixed precedence, `provider.not-found`, traps, separate fixture locations, unchanged operations), `feature-adapter-ports.md` (field absence rule), `feature-result-contract.md` (three `verify` rows), `feature-pm-notes-lint-and-phase-transitions.md` (read-only lifecycle consumer of the structured evaluation), `feature-monorepo-scaffold-toolchain.md` (new modules/tests, no new location/job), and `feature-delivery-lifecycle.md` (merge-gate stage and `dod_check`/`verify change`/`verify gates` relationship). **AC/TC**: Appendix H, AC-F2-4, AC-F5-3/4, AC-F9-3, AC-F10-3, AC-F12-1, AC-F13-1. **Verify**: `bash scripts/.tests/test-doc-distribution.sh` and `bun test tests/structure/content-inventory.test.ts`.
- [ ] **7.3** Update `doc/guides/change-lifecycle.md` and `doc/guides/definition-of-done.md` to point the merge-gate checklist at `verify gates CHANGE_REF` while keeping human review/approval and actual merging external; add the glossary entries (including `branch-mismatch`, `provider.not-found`, structured ledger evaluation, open-PR resolution) and `doc/00-index.md` link for verify gates. **AC/TC**: G-12, Appendix H, AC-F10-2/3. **Verify**: `bash scripts/.tests/test-doc-distribution.sh`.
- [ ] **7.4** Reconcile planning docs: mark the `verify gates` row delivered in `doc/planning/oss-tooling/cli-command-registry.md`, point `user-journeys.md` step 6 at the command, align `embedded-metadata.md` with DEC-14/OQ-6, and keep the `retrospectives.md` vacuous-green definition. Planning docs are not current truth; annotate rather than duplicate. **AC/TC**: Appendix H. **Verify**: `bun run scripts/checks/forbidden-literals.ts`.
- [ ] **7.5** Run the documentation and literal gates, confirm `ados_distribution` markers, confirm the new feature doc is registered and covered in `scripts/checks/forbidden-literals.registry.json`, and record any explicitly deferred Appendix H item with an owner and Phase 10 follow-up. **AC/TC**: G-12, Appendix H, NFR-9; TC-VGATES-006, TC-VGATES-066. **Verify**: `bash scripts/.tests/test-doc-distribution.sh`, `bun run scripts/checks/forbidden-literals.ts`, `bun test tests/checks/forbidden-literals.test.ts`, `bun run scripts/checks/privacy-literals.ts`.

**Acceptance Criteria**:

- Must: every Appendix H item is reconciled or explicitly deferred with an owner; the new feature spec is present with `ados_distribution: internal` and is registered in `scripts/checks/forbidden-literals.registry.json`.
- Must: the result-contract table and all three `verify` rows remain synchronized; the structured ledger evaluation and read-specific 404 semantics are documented.
- Should: guides describe `verify gates` as the M0 merge battery while leaving review/approval/merging external.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-verify-gates.md` (new), `feature-verify-change-and-exit-taxonomy.md`, `feature-status-digest.md`, `feature-provider-client-seeds.md`, `feature-adapter-ports.md`, `feature-result-contract.md`, `feature-pm-notes-lint-and-phase-transitions.md`, `feature-monorepo-scaffold-toolchain.md`, `feature-delivery-lifecycle.md`, `doc/guides/change-lifecycle.md`, `doc/guides/definition-of-done.md`, `doc/overview/glossary.md`, `doc/00-index.md`, the named planning docs, and `scripts/checks/forbidden-literals.registry.json` (all updated).

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh`
- `bun run scripts/checks/forbidden-literals.ts`
- `bun test tests/checks/forbidden-literals.test.ts`
- `bun run scripts/checks/privacy-literals.ts`
- `bun test tests/structure/content-inventory.test.ts`

**Completion signal**: `docs(GH-178): reconcile verify gates current-truth documentation`

---

### Phase 8: Code review (analysis)

**Goal**: Audit the delivered change against the spec, test plan, and repository rules before final release; make no functional changes in this phase.

**Tasks**:

- [ ] **8.1** Run `@reviewer` over the branch diff against `main-tools`, checking the five gate rules, structured lifecycle evidence, the shared open-PR resolution, read-specific 404 mapping, citations, exit matrix, error rows, additive fields, edge composition, read-only/read-budget guarantees, and scope boundaries. **AC/TC**: all 36 ACs; TC-VGATES-001..070. **Verify**: `pnpm check` and `git diff --check`.
- [ ] **8.2** Inspect `git diff --stat`, `git status --porcelain`, and the changed-file list to confirm only the planned code, tests, docs, inventory/registry updates, and one changeset are present; confirm no new package/subpath/export/runtime-API location, no write path, no spawn, and no product literal. **AC/TC**: AC-F13-1, NFR-2, NFR-6, NFR-9; TC-VGATES-005, 006, 007, 051, 065, 066. **Verify**: `git diff --stat`, `bun run scripts/checks/workspace-entrypoints.ts`, `bun run scripts/checks/ambient-globals.ts`, `bun run scripts/checks/secret-read-boundary.ts`.
- [ ] **8.3** Record the verdict and every finding with file/line evidence in the Execution Log; do not edit pm-notes. A finding that changes code becomes a Phase 9 item and a regression test. **AC/TC**: all 36 ACs. **Verify**: review report is complete and reproducible.

**Acceptance Criteria**:

- Must: the reviewer finds no unexplained AC gap, no scope drift, and no broken intermediate state.
- Should: findings are classified as blocking/non-blocking with an owner.

**Files and modules**:

- Code areas: none (read-only review).
- System docs: none.

**Tests**:

- `pnpm check`
- `git diff --check`
- `git status --porcelain`

**Completion signal**: `Review verdict recorded; no source commit unless Phase 9 is entered.`

---

### Phase 9: Post-code-review fixes (conditional)

**Goal**: Remediate accepted review findings with targeted code and regression tests, then re-run the affected suites.

**Tasks**:

- [ ] **9.1** For each accepted finding, change the smallest owning module (`contracts/verify-gates.ts`, `domain/verify-change.ts`, `domain/verify-gates.ts`, `adapters/io/provider-transport.ts`, `adapters/github/client.ts`, `adapters/github/normalize.ts`, `adapters/file/ci-workflow.ts`, `cli/commands/verify*.ts`, `cli/edge.ts`) and add or update the corresponding fixture/test. **AC/TC**: the finding's AC/TC. **Verify**: the affected focused command from Phases 1–6.
- [ ] **9.2** Re-run the focused suites and `pnpm check`; confirm no new error row, field, gate, reason, source, count, name kind, adapter operation, or export was introduced to fix a finding. **AC/TC**: AC-F13-1, NFR-6, NFR-7; TC-VGATES-001, 005, 047, 062, 065, 066. **Verify**: `pnpm check`.
- [ ] **9.3** If no accepted finding exists, mark this phase skipped in the Execution Log and proceed to Phase 10. **AC/TC**: all 36 ACs. **Verify**: review verdict shows no blocking finding.

**Acceptance Criteria**:

- Must: every accepted finding has a fix and a regression test; `pnpm check` stays green.
- Should: no unrelated refactor rides the fix commit.

**Files and modules**:

- Code areas: the smallest owning module plus its test/fixture (conditional).
- System docs: only if a finding exposes a stale current-truth statement; otherwise none.

**Tests**:

- Affected focused suite(s)
- `pnpm check`

**Completion signal**: `fix(GH-178): address code review findings`

---

### Phase 10: Finalize and release

**Goal**: Add the minor changeset, reconcile the last spec/document state, run the full acceptance trace, and leave the branch ready for PR creation.

**Tasks**:

- [ ] **10.1** Add `.changeset/verify-gates-v1-minor.md` with `minor` bumps for the fixed workspace group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) and a concise summary of the read-only gate battery, structured ledger evaluation, additive fields, `provider.not-found`, and two error rows. This is the repository's version-bump convention; do not edit package versions directly. **AC/TC**: rollout/version impact; DM-8, DM-12. **Verify**: `cat .changeset/verify-gates-v1-minor.md` and `pnpm changeset status --since=main-tools` (if available).
- [ ] **10.2** Reconcile the change records and confirm the spec, test plan, and plan remain consistent: no AC was dropped, no TC was skipped, and every Appendix H item is closed or explicitly deferred with an owner. Do not rewrite the spec to match the implementation; record any accepted divergence as a follow-up. **AC/TC**: all 36 ACs; TC-VGATES-001..070. **Verify**: `git diff --check` and manual AC/TC trace review.
- [ ] **10.3** Run the final focused evidence battery and the aggregate gate; record each command and result summary in the Execution Log. **AC/TC**: all TCs; NFR-2, NFR-3, NFR-4, NFR-6, NFR-10. **Verify**: the focused commands in Phases 1–6, then `pnpm typecheck`, `pnpm test`, `pnpm check`, `git diff --check`, `git status --porcelain`.
- [ ] **10.4** Confirm the documentation distribution and literal gates including forbidden-literal registry coverage, the two-way error-table sync, the workspace inventory/`EXECUTABLE_ALLOWANCES` registration, and the absence of live calls in default CI. **AC/TC**: AC-F9-3, AC-F13-1, AC-F14-1, NFR-7, NFR-9, NFR-10; TC-VGATES-004, 006, 047, 059, 065, 066. **Verify**: `bash scripts/.tests/test-doc-distribution.sh`, `bun run scripts/checks/error-table-sync.ts`, `bun run scripts/checks/forbidden-literals.ts`, `bun test tests/checks/verify-gates-no-live-calls.test.ts`.
- [ ] **10.5** Commit the final release phase with the changeset and any notes-only updates; leave PR creation to `@pr-manager`. **AC/TC**: rollout. **Verify**: `git status --porcelain` shows only intended files; commit contains exactly the changeset and final corrections.

**Acceptance Criteria**:

- Must: the minor changeset exists; `pnpm check` is green; the two error rows are documented and synchronized; the feature spec is present with `ados_distribution: internal` and registered in the forbidden-literal registry; no unintended file, package, subpath, dependency, or runtime location changed.
- Must: the final acceptance trace maps every AC to a passing test or a documented, owner-assigned deferral.
- Should: the opt-in live smoke has been run once with a credential and its bounded, secret-free evidence recorded in the PR (not in default CI).

**Files and modules**:

- Code areas: `.changeset/verify-gates-v1-minor.md` (new); any final notes-only corrections.
- System docs: final verification of `doc/spec/features/feature-verify-gates.md`, the forbidden-literal registry entry, and all Appendix H targets.

**Tests**:

- `pnpm typecheck`
- `pnpm test`
- `pnpm check`
- `git diff --check`
- `git status --porcelain`
- `bash scripts/.tests/test-doc-distribution.sh`
- `bun run scripts/checks/error-table-sync.ts`
- `bun run scripts/checks/forbidden-literals.ts`

**Completion signal**: `chore(GH-178): add verify gates minor changeset and final verification`

---

## Test Scenarios

All 36 acceptance criteria and all 70 test cases from `chg-GH-178-test-plan.md` are covered. The phase column names the owning implementation phase; the AC column is the forward trace from the test plan.

| TC ID | Scenario | Phase | AC |
|-------|----------|-------|----|
| TC-VGATES-001 | Gate vocabulary, reasons, sources, constants, bounds are one data contract | 1, 4, 6 | AC-F1-3, AC-F13-1, DM-2..DM-12 |
| TC-VGATES-002 | Contracts data-only; domain pure and imports only contracts + verify classifier | 4 | AC-F13-1, NFR-6 |
| TC-VGATES-003 | `DeliveryRequest` additive gate facts optional and absent-safe | 1, 2 | AC-F12-1, NFR-6 |
| TC-VGATES-004 | Two additive verify rows and unchanged ledger row are exact/classified | 1, 6 | AC-F9-3, NFR-7 |
| TC-VGATES-005 | No new package, subpath, runtime-API location, or dependency; inventories bound | 1, 2, 3, 5 | AC-F13-1, NFR-6 |
| TC-VGATES-006 | Ambient, forbidden-literal, privacy, brand, secret-read invariants | 7, 10 | AC-F13-1, NFR-9 |
| TC-VGATES-007 | Boundary rules and fixture-coverage meta-check stay green | 5, 6 | AC-F13-1, NFR-6 |
| TC-VGATES-008 | Grammar rejected before any read | 5 | AC-F1-1 |
| TC-VGATES-009 | Accepted grammar: one ref, no PR argument, global `--json` | 5 | AC-F1-1, AC-F1-2 |
| TC-VGATES-010 | Five records in fixed order, no short-circuit, five summary lines on failure | 4, 5, 6 | AC-F1-3, DM-2, DM-6, NFR-1 |
| TC-VGATES-011 | Attached branch resolves the unique matching open PR; zero/multiple/non-matching fail | 4, 5 | AC-F1-2, AC-F5-2, DM-13 |
| TC-VGATES-012 | Detached HEAD fails branch-dependent gates without PR read | 4, 5 | AC-F1-2, AC-F5-2 |
| TC-VGATES-013 | Lifecycle gate consumes the structured evaluator (no classifier dependency); complete full ledger passes | 4 | AC-F2-1, AC-F2-4, DM-15 |
| TC-VGATES-014 | Complete LITE ledger passes with only the LITE set | 4 | AC-F2-1 |
| TC-VGATES-015 | Incomplete/malformed/missing-target ledgers fail with reused codes | 4 | AC-F2-2, AC-F2-4, NFR-1 |
| TC-VGATES-016 | Platform registry failure: lifecycle/overall unknown, platform exit | 4, 5 | AC-F2-3, AC-F9-2 |
| TC-VGATES-017 | User-category state failure: lifecycle/overall unknown, user exit | 4, 5 | AC-F2-3, AC-F9-2 |
| TC-VGATES-018 | Green CI page with every expected job succeeded passes | 4 | AC-F3-1, AC-F9-1 |
| TC-VGATES-019 | Red pipeline fails `ci-failed` with failed jobs and declared-denominator counts | 4 | AC-F3-1, DM-11 |
| TC-VGATES-020 | Missing expected job fails `ci-missing-jobs` | 3, 4 | AC-F3-2, AC-F4-1 |
| TC-VGATES-021 | Zero-run pipeline fails `ci-no-runs` | 4 | AC-F3-3 |
| TC-VGATES-022 | All-skipped pipeline fails `ci-all-skipped` even with extra success | 4 | AC-F3-3 |
| TC-VGATES-023 | Pending and canceled runs fail with their own reasons | 4 | AC-F3-4 |
| TC-VGATES-024 | Page at 100-run limit is `unknown` (`ci-truncated`) | 4 | AC-F3-4 |
| TC-VGATES-025 | Every invalid expected set fails `ci-expected-jobs-invalid` | 3, 4 | AC-F4-1 |
| TC-VGATES-026 | Expected-set extraction, exact matching, extra runs, duplicate names | 3, 4 | AC-F4-1, AC-F3-2 |
| TC-VGATES-027 | Unresolved head SHA fails `head-unresolved` without check-run read | 4 | AC-F3-1, AC-F8-1 |
| TC-VGATES-028 | Push-parity mismatch fails and cites both SHAs | 4 | AC-F5-1 |
| TC-VGATES-029 | Equal head SHAs pass `parity-matched` with branch/SHAs/PR | 4 | AC-F5-1 |
| TC-VGATES-030 | Detached/missing-head/zero-PR/ambiguous-PR/branch-mismatch parity failures | 4 | AC-F5-2, DM-13 |
| TC-VGATES-031 | Parity provider failure or unresolved binding is `unknown` | 4, 5 | AC-F5-2, AC-F11-1 |
| TC-VGATES-032 | No owner label passes `owner-gate-absent` | 4 | AC-F6-1 |
| TC-VGATES-033 | Owner-attention label fails `owner-gate-present` in contract order | 4 | AC-F6-1 |
| TC-VGATES-034 | Owner gate never passes on unresolved/unread item; label-only declared | 4, 5 | AC-F6-2, DM-4, DM-14 |
| TC-VGATES-035 | Ready PR passes squash with the two ordered `squash-signals` tokens | 4 | AC-F7-1, DM-5, DM-11 |
| TC-VGATES-036 | Wrong base/draft/merged/closed squash failures preserve signals | 4 | AC-F7-2, DM-11 |
| TC-VGATES-037 | Conflicting/not-mergeable squash failures preserve signals | 4 | AC-F7-2, DM-11 |
| TC-VGATES-038 | Unknown/absent mergeability and zero/absent/omitted surface fail, render unknown; a successful detail read with absent counts omits them while keeping both signals | 4 | AC-F7-3, DM-7, DM-11 |
| TC-VGATES-039 | Non-404 provider failure across gates is `unknown` (404s owned by 061/067/068); unread detail yields empty signals | 4, 5 | AC-F3-6, AC-F5-2, AC-F6-2, AC-F7-3, AC-F11-1, DM-5, DM-11, DM-14 |
| TC-VGATES-040 | Every verdict carries a complete citation; `failureClass` limited to declared read-result codes; squash signals two-token/empty rule; omitted surface counts stay unknown while two tokens remain | 4 | AC-F8-1, DM-5, DM-11 |
| TC-VGATES-041 | Citation bounds, ordering, redaction, determinism; `failureCode` vs `failureClass` split | 4 | AC-F8-1, NFR-5, NFR-9 |
| TC-VGATES-042 | Failure summary grammar, five lines, always-present `counts=`/`names=` segments (`-` when empty), signals, bounds, replay; no failure data | 4, 5, 6 | AC-F1-3, AC-F8-2, DM-5, DM-6, NFR-3, NFR-4, NFR-5 |
| TC-VGATES-043 | Human success report is exactly six deterministic lines | 4, 5, 6 | AC-F10-2, NFR-9 |
| TC-VGATES-044 | Machine success is one valid envelope with full report and byte bound | 5, 6 | AC-F10-1, NFR-4, NFR-5 |
| TC-VGATES-045 | Overall derivation is pass only when all five pass | 4, 5, 6 | AC-F9-1 |
| TC-VGATES-046 | Exit/failure-identity matrix is total and envelope-exclusive | 5, 6 | AC-F9-2, NFR-4 |
| TC-VGATES-047 | Error-table documented and machine rows stay in two-way sync | 1, 6 | AC-F9-3, NFR-7 |
| TC-VGATES-048 | Credential-reference guard: refused/missing credentials never pass | 5 | AC-F11-1 |
| TC-VGATES-049 | Non-404 network/transport/payload failures are `unknown`, no retries | 5 | AC-F11-1 |
| TC-VGATES-050 | Unresolved repository binding makes provider gates `unknown` | 5 | AC-F11-1 |
| TC-VGATES-051 | Command is read-only and honors the read budget | 5, 6 | AC-F11-2, NFR-2 |
| TC-VGATES-052 | Replay over identical injected facts is byte-identical | 5, 6 | AC-F11-2, NFR-3 |
| TC-VGATES-053 | Pure evaluation stays within the performance bound | 4 | NFR-8 |
| TC-VGATES-054 | GitHub PR detail normalizes the four facts, absence, and mergeability precedence | 2 | AC-F12-1, AC-F7-3, DM-7 |
| TC-VGATES-055 | Trap catalog gains all required entries, four-field shape, bidirectional coverage | 2, 6 | AC-F12-1, AC-F14-1, DM-14 |
| TC-VGATES-056 | GitHub trap payloads replay to declared gate facts in the trap fixture location | 2 | AC-F12-1, DM-14 |
| TC-VGATES-057 | Corpus completeness covers every gate, verdict, reason, ticket case | 6 | AC-F14-1, NFR-10 |
| TC-VGATES-058 | Negative controls and non-vacuity fail on empty/wrong/missing/fabricated cases | 6 | AC-F14-1, NFR-1 |
| TC-VGATES-059 | Default CI zero live calls under `tests/fixtures/verify-gates/cases/network-guard.ts`; opt-in live smoke structural only | 6, 10 | AC-F14-1, NFR-10 |
| TC-VGATES-060 | Open-PR page at `VERIFY_GATES_OPEN_PR_LIMIT` is `ambiguous-open-pr` with or without a match, for both parity and squash | 4, 5, 6 | AC-F1-2, AC-F5-3, AC-F7-2, AC-F14-1, DM-9, DM-13, NFR-1 |
| TC-VGATES-061 | HTTP 404 absence is read-specific: PR-list/work-item absence is a definitive `fail`, matched detail is `head-unresolved`/`absent` for CI/parity/squash, check-run 404 is source `absent`/`unknown` `read-failed`, other failures are `unknown` | 2, 4, 5, 6 | AC-F3-5, AC-F3-6, AC-F5-2, AC-F5-4, AC-F6-2, AC-F7-2, AC-F11-1, AC-F14-1, DM-14, NFR-1 |
| TC-VGATES-062 | Lifecycle citation consumes structured `VerifyLedgerEvaluation` on every outcome, honors DM-15 failure-path fields, and never parses a summary | 4 | AC-F2-1, AC-F2-2, AC-F2-4, DM-11, DM-15, NFR-3 |
| TC-VGATES-063 | Widened `string \| undefined` `humanText` dispatch renders six gate lines for gates and returns `undefined` for `verify change`, preserving its redact-then-serialize bytes including a JSON-escaping-sensitive secret; machine mode unchanged | 5, 6 | AC-F10-2, AC-F10-3, DM-12, NFR-3, NFR-4, NFR-9 |
| TC-VGATES-064 | Mergeability precedence is deterministic, including `mergeable === true` with blocked/behind/unstable/draft | 2, 4, 6 | AC-F7-2, AC-F7-3, AC-F12-1, DM-7, DM-11, NFR-1 |
| TC-VGATES-065 | Workspace inventories register the new contract module and every new export | 1, 2, 3, 5, 6 | AC-F13-1, NFR-6 |
| TC-VGATES-066 | The new verify-gates feature doc is registered in the forbidden-literal corpus | 7, 10 | AC-F13-1, NFR-9 |
| TC-VGATES-067 | A matched PR-detail 404 makes CI, parity, and squash all fail `head-unresolved`/`absent`; non-404 detail failures stay `unknown` | 4, 5, 6 | AC-F3-5, AC-F5-4, AC-F7-2, AC-F11-1, AC-F14-1, DM-14, NFR-1 |
| TC-VGATES-068 | A check-run 404 is source `absent` and `unknown` `read-failed`, never `failed` and never `ci-no-runs` | 4, 5, 6 | AC-F3-6, AC-F11-1, AC-F14-1, DM-14, NFR-1 |
| TC-VGATES-069 | New domain symbols import from the `@delivery-os/core` package root; one verify definition accepts the combined `change`+`gates` runtime; `verify change` bytes stay identical | 4, 5, 6 | AC-F1-1, AC-F10-3, AC-F13-1, DM-12, NFR-6 |
| TC-VGATES-070 | CI counts use declared denominators, no double-bucketing, and an unrecognized run state cannot pass | 4, 6 | AC-F3-1, AC-F3-3, DM-11, NFR-1 |

### Final acceptance trace

Each acceptance criterion closes only when its TCs pass in the named phase's focused command and again in the Phase 10 aggregate run. A row with no passing TC or an explicitly owner-assigned deferral blocks release.

| AC | Closing phases | Closing TCs | Aggregate evidence |
|----|----------------|-------------|--------------------|
| AC-F1-1 | 5 | TC-VGATES-008, 009, 069 | `pnpm check` |
| AC-F1-2 | 4, 5 | TC-VGATES-009, 011, 012, 060 | `pnpm check` |
| AC-F1-3 | 1, 4, 5, 6 | TC-VGATES-001, 010, 042 | `pnpm check` |
| AC-F2-1 | 4 | TC-VGATES-013, 014, 062 | `pnpm check` |
| AC-F2-2 | 4 | TC-VGATES-015, 062 | `pnpm check` |
| AC-F2-3 | 4, 5 | TC-VGATES-016, 017 | `pnpm check` |
| AC-F2-4 | 4 | TC-VGATES-013, 015, 062 | `pnpm check` |
| AC-F3-1 | 4 | TC-VGATES-018, 019, 027, 070 | `pnpm check` |
| AC-F3-2 | 3, 4 | TC-VGATES-020, 026 | `pnpm check` |
| AC-F3-3 | 4, 5 | TC-VGATES-021, 022, 070 | `pnpm check` |
| AC-F3-4 | 4 | TC-VGATES-023, 024 | `pnpm check` |
| AC-F3-5 | 4, 5, 6 | TC-VGATES-061, 067 | `pnpm check` |
| AC-F3-6 | 4, 5, 6 | TC-VGATES-039, 061, 068 | `pnpm check` |
| AC-F4-1 | 3, 4 | TC-VGATES-020, 025, 026 | `pnpm check` |
| AC-F5-1 | 4 | TC-VGATES-028, 029 | `pnpm check` |
| AC-F5-2 | 4, 5 | TC-VGATES-011, 012, 030, 031, 039, 061 | `pnpm check` |
| AC-F5-3 | 4, 5, 6 | TC-VGATES-060 | `pnpm check` |
| AC-F5-4 | 2, 4, 5 | TC-VGATES-061, 067 | `pnpm check` |
| AC-F6-1 | 4 | TC-VGATES-032, 033 | `pnpm check` |
| AC-F6-2 | 4, 5 | TC-VGATES-034, 039, 061 | `pnpm check` |
| AC-F7-1 | 4 | TC-VGATES-035 | `pnpm check` |
| AC-F7-2 | 4, 5 | TC-VGATES-036, 037, 060, 061, 064, 067 | `pnpm check` |
| AC-F7-3 | 2, 4, 5 | TC-VGATES-038, 039, 054, 064 | `pnpm check` |
| AC-F8-1 | 4 | TC-VGATES-027, 040, 041 | `pnpm check` |
| AC-F8-2 | 4, 5, 6 | TC-VGATES-042 | `pnpm check` |
| AC-F9-1 | 4, 5, 6 | TC-VGATES-018, 045 | `pnpm check` |
| AC-F9-2 | 5, 6 | TC-VGATES-016, 017, 046 | `pnpm check` |
| AC-F9-3 | 1, 6 | TC-VGATES-004, 047 | `pnpm check` |
| AC-F10-1 | 5, 6 | TC-VGATES-044 | `pnpm check` |
| AC-F10-2 | 4, 5, 6 | TC-VGATES-043, 063 | `pnpm check` |
| AC-F10-3 | 5, 6 | TC-VGATES-063, 069 | `pnpm check` |
| AC-F11-1 | 2, 4, 5 | TC-VGATES-031, 039, 048, 049, 050, 061, 067, 068 | `pnpm check` |
| AC-F11-2 | 5, 6 | TC-VGATES-051, 052 | `pnpm check` |
| AC-F12-1 | 1, 2, 6 | TC-VGATES-003, 054, 055, 056, 064 | `pnpm check` |
| AC-F13-1 | 1, 4, 5, 7 | TC-VGATES-001, 002, 005, 006, 007, 065, 066, 069 | `pnpm check` |
| AC-F14-1 | 6, 10 | TC-VGATES-055, 057, 058, 059, 060, 061, 067, 068 | `pnpm check` |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-178-spec.md` | Spec |
| Test plan | `./chg-GH-178-test-plan.md` | Test plan |
| This implementation plan | `./chg-GH-178-plan.md` | Plan |
| Verify-gates contract vocabulary and `OpenPrResolution` | `packages/core/src/contracts/verify-gates.ts` | Code (new) |
| Additive `DeliveryRequest` fields | `packages/core/src/contracts/ports.ts` | Code (updated) |
| Two additive error rows | `packages/core/src/contracts/error-table.ts` | Code (updated) |
| Structured ledger evaluation and wrapper | `packages/core/src/domain/verify-change.ts` | Code (updated) |
| Pure evaluator, shared resolution helper, renderers | `packages/core/src/domain/verify-gates.ts` | Code (new) |
| Domain barrel exports | `packages/core/src/domain/index.ts` | Code (updated) |
| Package-root additive named exports | `packages/core/src/index.ts` | Code (updated) |
| Adapter-local `provider.not-found` 404 kind | `packages/adapters/src/io/provider-transport.ts` | Code (updated) |
| GitHub 404 mapping | `packages/adapters/src/github/client.ts` | Code (updated) |
| GitHub gate-fact normalization | `packages/adapters/src/github/normalize.ts` | Code (updated) |
| Bounded CI workflow read | `packages/adapters/src/file/ci-workflow.ts` | Code (new) |
| Verify command definition, combined runtime, and `humanText` | `packages/cli/src/commands/verify.ts` | Code (updated) |
| CLI command-definition contract (`humanText` widened to `string \| undefined`) | `packages/cli/src/index.ts` | Code (updated) |
| Gates handler | `packages/cli/src/commands/verify-gates.ts` | Code (new) |
| CLI command barrel (`gates` runtime type) | `packages/cli/src/commands/index.ts` | Code (updated) |
| Edge composition (`createConfigProgram`/`ConfigProgramOptions.verify`) | `packages/cli/src/edge.ts` | Code (updated) |
| Contract inventory | `tests/fixtures/ports/v1-contract-inventory.json` | Test fixture (updated) |
| Executable allowances | `tests/structure/content-inventory.test.ts` | Test (updated) |
| Forbidden-literal registry | `scripts/checks/forbidden-literals.registry.json` | Check config (updated) |
| New current-truth feature spec | `doc/spec/features/feature-verify-gates.md` | System doc (new) |
| Reconciled feature/guide/glossary/index docs | Appendix H paths | System docs (updated) |
| Verify-gates fixtures and corpus | `tests/fixtures/verify-gates/**` | Test fixtures (new) |
| No-live network guard | `tests/fixtures/verify-gates/cases/network-guard.ts` | Test fixture (new) |
| Package-root export check | `tests/structure/verify-gates-exports.test.ts` | Test (new) |
| Trap catalog and payloads | `tests/fixtures/providers/traps/github.traps.json`, `tests/fixtures/providers/github/**` | Test fixtures (updated/new) |
| Structure/behaviour/golden/check/boundary suites | `tests/structure/**`, `tests/behaviour/**`, `tests/golden/**`, `tests/checks/**`, `tests/boundaries/**` | Tests (new/updated) |
| Minor changeset | `.changeset/verify-gates-v1-minor.md` | Release artifact (new) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | plan-writer | Initial plan derived from spec v1.1 and the 59-TC test plan. Ten phases; all 30 ACs and 59 TCs mapped; targeted table updates land with the code, full Appendix H reconciliation in Phase 7, minor changeset and final acceptance trace in Phase 10. Records non-blocking OQ-T4 (detail-authoritative head SHA) and OQ-T5 (`VERIFY_GATES_LIVE=1`). |
| 1.1 | 2026-10-31 | plan-writer | Amended against the DoR-fixed spec v1.2 and test plan v1.2 (66 TCs, 34 ACs). (1) Added the pure `EvaluateVerifyChange`/`VerifyLedgerEvaluation` task with `classifyVerifyChange` as a wrapper, and made the lifecycle gate consume the structured evaluation only (TC-VGATES-062). (2) Added the additive adapter-local `provider.not-found` kind in `provider-transport.ts`, HTTP 404 mapping in `github/client.ts`, and the read-specific gate mapping/tests (TC-VGATES-061), keeping `provider.payload.invalid` for other non-2xx. (3) Added the shared open-PR resolution helper with `VERIFY_GATES_OPEN_PR_LIMIT`, at-limit closure with/without a match, `branch-mismatch`, and squash acceptance (TC-VGATES-060, updated 011/030). (4) Defined the single `verify` definition's `humanText` dispatch (`gates` six-line report; otherwise exact `JSON.stringify(data, null, 2) + "\n"`) and byte-identical `verify change` tests (TC-VGATES-063). (5) Fixed the mergeability precedence in Phase 2 and its tests, including `mergeable === true` + blocked/draft/behind/unstable → `not-mergeable` (TC-VGATES-054/064). (6) Added all required trap ids and separated trap payloads (`tests/fixtures/providers/**`) from behavioural fixtures (`tests/fixtures/verify-gates/providers/**`). (7) Replaced the vague inventory task with `tests/fixtures/ports/v1-contract-inventory.json`, `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`, and the subpaths/entrypoints checks (TC-VGATES-065). (8) Added `scripts/checks/forbidden-literals.registry.json` registration for the new feature doc (TC-VGATES-066). (9) Replaced `createCommandProgram` with `createConfigProgram`/`ConfigProgramOptions.verify` wiring. (10) Moved the CI behaviour suite creation to Phase 4.9, after the evaluator and CI gate (Phase 3 adds fixtures only). Updated coverage to 34/34 ACs and 66/66 TCs and refreshed the final acceptance trace. |
| 1.2 | 2026-10-31 | plan-writer | Amended against spec v1.3 (36 ACs) and test plan v1.3 (70 TCs) for the DoR iteration-2 remediation. (1) Added the explicit additive package-root re-export task (4.9) for `EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, the resolution helper, and the renderers in `packages/core/src/index.ts`, plus the domain barrel and `tests/structure/verify-gates-exports.test.ts`; the CLI imports from `@delivery-os/core` (TC-VGATES-069). (2) Pinned the CI matched-detail 404 rule: `ci-green`, `push-parity`, and `squash-preflight` all fail `head-unresolved` with source `absent`; non-404 detail failures stay `unknown` (TC-VGATES-067). (3) Pinned the check-run 404 as source `absent` with gate `unknown` `read-failed`, never `failed`/`ci-no-runs` (TC-VGATES-068). (4) Defined the combined runtime seam exactly: optional `gates` member on `VerifyCommandRuntime`, first-positional dispatch in `createVerifyCommandDefinition`, one `ConfigProgramOptions.verify` option, and edge composition (TC-VGATES-069). (5) Pinned DM-15 per-outcome failure fields in tasks 4.1/4.2 and TC-VGATES-062. (6) Pinned CI denominators and one-bucket-per-run with an unrecognized state failing (TC-VGATES-070). (7) Pinned `squash-signals` empty only when no detail was read, otherwise two ordered tokens. (8) Restricted `failureClass` to `provider.payload.invalid`/`provider.not-found` and moved error-table codes to `failureCode`. (9) Named `tests/fixtures/verify-gates/cases/network-guard.ts` (`createNoNetworkGuard()`) in the no-live task (TC-VGATES-059). (10) Removed the stale OQ-T4 and recorded the resolved non-404-vs-404 rule. (11) Completed every phase file list with the package root, domain barrel, contracts barrel, CLI commands barrel, `packages/cli/src/edge.ts`, and `ConfigProgramOptions`. (12) Recomputed coverage to 36/36 ACs and 70/70 TCs, updated the scenario and final acceptance traces, `last_updated`, and the phase/task counts (10 phases, 53 tasks). |
| 1.3 | 2026-10-31 | plan-writer | Amended against spec v1.4 and test plan v1.4 for the DoR iteration-3 plan findings. (1) Moved the `tests/checks/error-table-sync.test.ts` `BASELINE_ROWS` length guards (both `+1` occurrences become `+3`), the `TC-VERIFY-019` three-row count, and the `kinds` map `verify: 3` update into task 1.3 alongside the two machine/documented rows; added the file to Phase 1 Files and Tests (`bun test tests/checks/error-table-sync.test.ts`); the same task 1.3 commit updates the `tests/structure/error-table.test.ts` `verify` count (`1`→`3`) and `entries` count (`31`→`33`), with task 1.4 adding the exact new-row assertions; Phase 6.5 now adds only mutation/negative controls, so both binding suites are green from Phase 1 onward. (2) Moved creation of `tests/behaviour/verify-gates-output.test.ts` from task 4.10 to task 5.6 after the 5.1–5.5 CLI tasks; task 4.10 now keeps only the pure renderer/overall assertions (TC-VGATES-042 summary grammar, 043, 045) and no longer lists TC-VGATES-044/046 or runs the output suite; tasks 5.2/5.4 no longer reference the not-yet-created suite; the scenario table keeps TC-VGATES-044/046 at Phase 5 (plus Phase 6 golden evidence) with no Phase 4 assignment. (3) Added the TC-VGATES-063 planted-secret/redaction control (secret in `secrets`, `verify change` data, and a gates citation/identity; six-line report and machine envelope redact it; `verify change` bytes unchanged) to task 5.6's output suite. (4) Aligned the reverse per-TC AC mappings for TC-VGATES-013/015/039/054 with test plan v1.4 (AC-F2-4; AC-F2-4/NFR-1; check-run AC-F3-6 with DM-11/DM-14 and no AC-F3-5; AC-F7-3/DM-7) and added TC-VGATES-013/015 to the AC-F2-4 closing row and TC-VGATES-054 to AC-F7-3. (5) Refreshed `last_updated`; coverage remains 36/36 ACs and 70/70 TCs; phase/task shape remains 10 phases, 53 tasks. |
| 1.4 | 2026-10-31 | plan-writer | Amended against spec v1.5 and test plan v1.5 for the DoR iteration-4 findings. (1) Corrected the `humanText` contract: task 5.4 now widens `CommandDefinition.humanText` in `packages/cli/src/index.ts` to `string \| undefined`, has `verify`'s hook return the six-line report only for `target: "gates"` and `undefined` otherwise, and keeps `verify change` on the delivered `humanSuccess`/`humanJson` redact-then-serialize path, byte-identical including a JSON-escaping-sensitive secret; `packages/cli/src/index.ts`, `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/redaction.test.ts`, and `tests/golden/verify-gates.test.ts` are named in the Phase 5/6 file lists and tests; task 5.6's TC-VGATES-063 control now plants a quote/backslash/newline secret, asserts `undefined` delegation, and checks no raw or JSON-escaped occurrence; the context, sequencing guard, constraints, RSK-16, success metric, Phase 5 goal/AC, and Artifacts table align. (2) Pinned the failure-summary grammar: task 4.7 and TC-VGATES-042 require both `counts=` and `names=` segments on every gate line, with `-` for an empty set and never a zero alias, a bare segment, or an omission; task 5.6, task 6.3, task 6.5, and Phase 4/5 AC carry the no-usable-detail `counts=- names=-` case. (3) Pinned omitted surface counts: task 4.5 and TC-VGATES-038/040 state that a successful detail read with absent `commitCount`/`changedFileCount` omits those counts as unknown (never zero) while `squash-signals` remains. (4) Reconciled the reverse trace with test plan v1.5: TC-VGATES-061 gains AC-F5-2; TC-VGATES-067 gains AC-F11-1/AC-F14-1; TC-VGATES-068 gains AC-F14-1; TC-VGATES-063 gains NFR-9; TC-VGATES-038 lists DM-7; the AC-F5-2 row now closes on TC-011/012, AC-F8-1 on TC-027, and AC-F9-1 on TC-018. Coverage remains 36/36 ACs and 70/70 TCs; the phase/task shape remains 10 phases and 53 tasks. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Not started | — | — | — | Contract vocabulary, `OpenPrResolution`, additive fields, two error rows with the `tests/checks/error-table-sync.test.ts` `BASELINE_ROWS` guard/`verify`-row update in the same commit, inventory/`EXECUTABLE_ALLOWANCES`, targeted table updates. |
| 2 | Not started | — | — | — | GitHub 404 absence, gate-fact normalization, all required traps, separated fixture locations. |
| 3 | Not started | — | — | — | Expected CI job-set read and fixtures only; the CI behaviour suite lands in Phase 4.10. |
| 4 | Not started | — | — | — | Structured ledger evaluator with DM-15 failure fields, pure evaluator, shared open-PR resolution, read-specific 404 mapping (detail 404 for CI/parity/squash; check-run absent), CI denominators, renderers, domain barrel + package-root exports, pure suites only (the CLI-output suite is created in 5.6). |
| 5 | Not started | — | — | — | CLI surface, combined `VerifyCommandRuntime.gates?` dispatch through the single `ConfigProgramOptions.verify` option, edge composition of both runtimes, widened `string \| undefined` `humanText` (`gates` report; `undefined` delegates `verify change` to redact-then-serialize), and `verify-gates-output.test.ts` (created in 5.6 after the CLI tasks) with the TC-063 JSON-escaping-sensitive planted-secret control. |
| 6 | Not started | — | — | — | Corpus (detail/check-run 404, denominators), goldens (including `verify change` bytes under a JSON-escaping-sensitive secret and a `counts=- names=-` failure-summary line), `network-guard.ts` no-live guard, error-table-sync mutation/negative controls only (baseline landed in 1.3), live smoke. |
| 7 | Not started | — | — | — | Current-truth documentation reconciliation and forbidden-literal registry. |
| 8 | Not started | — | — | — | Code review analysis against 36 ACs / 70 TCs. |
| 9 | Not started | — | — | — | Conditional post-review fixes. |
| 10 | Not started | — | — | — | Changeset, final acceptance trace, release. |
