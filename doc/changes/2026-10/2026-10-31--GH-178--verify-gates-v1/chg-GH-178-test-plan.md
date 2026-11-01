---
id: chg-GH-178-test-plan
status: Updated
created: 2026-10-31T19:10:00Z
last_updated: 2026-10-31T23:59:00Z
owners: [engineering]
service: delivery-os CLI verification and merge gates
labels: [change, planning]
version_impact: minor
summary: "Verify M0-S9: a read-only verify gates CHANGE_REF that evaluates the five M0 merge gates in fixed order and returns one cited verdict per gate. The plan proves non-vacuous pass guarantees (red pipeline, missing expected job, vacuous zero-run/all-skipped green, stale local head, owner-attention label, bad squash preflight), lifecycle finalization composed from the structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation` with `classifyVerifyChange` retained only as a byte-preserving wrapper, CI on the pushed commit with a workflow-derived expected set and declared count denominators, the shared open-PR resolution rule including at-limit ambiguity and branch-mismatch, push parity, a label-only owner gate with read-specific 404 absence, squash preflight over main-tools/open/non-draft/mergeability precedence/change surface, the humanText dispatch that preserves verify change bytes, bounded deterministic citations, the pass/fail/unknown overall with the exit matrix, two additive verify error rows with two-way table sync, additive DeliveryRequest gate facts and trap coverage with separated trap/behavioural fixture locations, workspace inventory and forbidden-literal-registry binding, the additive `@delivery-os/core` package-root re-export and combined `change`/`gates` verify runtime, read-specific PR-detail and check-run 404 absence, DM-15 failure-path field semantics, CI count denominators with no double-bucketing, bounded `failureClass` values, and fixture-driven evidence with zero live calls in default CI plus an opt-in structural live smoke."
links:
  change_spec: ./chg-GH-178-spec.md
  implementation_plan: ./chg-GH-178-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S9: verify gates v1

## 1. Scope and Objectives

This change introduces the one read-only command that turns the manual M0 merge checklist into a cited verdict battery: `verify gates CHANGE_REF` evaluates `lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`, and `squash-preflight` in fixed order and returns `pass`, `fail`, or `unknown` per gate plus a bounded citation. The tests must prove three properties at once. First, **evidence completeness**: every gate verdict names its ordered sources and outcomes, identity/refs/SHAs, counts or bounded names, and a closed reason. Second, **non-vacuity**: a red pipeline, a missing expected job, a pipeline with zero runs or only skipped runs, a stale local head, an owner-attention label, a bad squash preflight, an invalid expected set, a truncated page, or any failed/unknown read can never become a pass. Third, **contract fidelity**: gate ids and order, the verdict/reason/source vocabularies, the report/summary/human grammars, the two additive error rows, and the additive `DeliveryRequest` fields are pinned as data and cannot drift.

The plan is built around four adversarial mechanisms the specification names. A **fixture-driven corpus** with a completeness meta-check that fails by case name when a gate, verdict, or reason loses its fixture. **Negative controls** that pair every fail/unknown case with a restored-or-valid control and that fail the suite itself when the fixture manifest is empty or a case asserts the wrong verdict. A **fake GitHub transport** with committed payloads and a trap-catalog replay, so the default suite makes zero live calls. A **read-only/read-budget recorder** that fails on any write, fence, spawn, retry, pagination, or fifth outbound GET, and that is proven live by a seeded-write control.

### 1.1 In Scope

- The `verify gates CHANGE_REF` surface: subcommand set, one non-empty ref, global `--json`, parser versus handler grammar, and zero reads before grammar validation (AC-F1-1, F-1).
- The single `verify` command definition and combined runtime: `createVerifyCommandDefinition` accepts a runtime exposing both `change` and `gates`, dispatches on the first positional after grammar validation, and imports the new pure domain symbols from the additive `@delivery-os/core` package root (not a new subpath); `verify change` output stays byte-identical (AC-F1-1, AC-F10-3, AC-F13-1, F-1, F-10, F-13).
- Target resolution through the one deterministic open-PR rule shared verbatim by push parity and squash: detached HEAD (`branch-unresolved`), zero open PRs (`no-open-pr`), a lone non-matching open PR (`branch-mismatch`), more than one match (`ambiguous-open-pr`), and a raw page at `VERIFY_GATES_OPEN_PR_LIMIT` with or without a match (`ambiguous-open-pr`) (AC-F1-2, AC-F5-2, AC-F5-3, AC-F7-2, F-1, F-5, F-7, DM-13).
- Exactly five gate records in fixed order, all evaluated with no short-circuit, each with verdict, reason, and citation (AC-F1-3, F-1, DM-2, DM-5).
- Lifecycle finalization composed from the structured `EvaluateVerifyChange` → `VerifyLedgerEvaluation` contract: the gate consumes the structured evaluation and never parses a summary; `classifyVerifyChange` is retained only as a behavior-preserving wrapper. Covers full and LITE complete, incomplete, malformed, missing target, registry overlay, platform/user registry failure, with required/completed/missing counts, ordered missing phases, and registry evidence on the failure path (AC-F2-1..4, F-2, DM-11, DM-15).
- CI green on the pushed commit: expected-job-set extraction and validation, exact count denominators (`expected`/`missing` over the expected set, `runs` observed, one state bucket per observed run), no double-bucketing, unrecognized states cannot pass, red/pending/canceled/zero-run/all-skipped/missing-job/invalid-set/truncated outcomes, duplicate observed names, extra runs, head unresolved, CI PR-detail 404 as `fail` `head-unresolved` with source `absent`, and check-run 404 as source outcome `absent`, `unknown` `read-failed`, never `failed`/`ci-no-runs` (AC-F3-1..6, AC-F4-1, F-3, F-4, DM-10, DM-11, DM-14).
- Push parity over the local HEAD and the delivery request head SHA for the same branch, including all resolution, failure, 404-absence, and unknown classes (AC-F5-1..4, F-5, DM-13, DM-14).
- Owner-gate scan over the reused owner-attention label contract, label-only limitation, malformed/non-numeric identity, work-item 404 as `ticket-unresolved`/`absent`, and other provider failure as `unknown` (AC-F6-1..2, F-6, DM-14).
- Squash preflight over `main-tools`, open/non-draft state, the fixed mergeability precedence (including `mergeable === true` with blocked/dirty/draft state), and non-vacuous commit/change surface, including unknown/absent and 404 evidence; the `squash-signals` list carries exactly two ordered tokens whenever the detail was read successfully, a successful detail read that omits `commitCount`/`changedFileCount` still carries those tokens while omitting the counts as unknown (never zero), and the list is empty with `commits`/`changedFiles` omitted as unknown (never zero) when no usable detail was read (resolution failure `not-attempted`, detail 404 `absent`, or failed detail read `failed`), with the source and reason naming the prerequisite (AC-F7-1..3, AC-F12-1, F-7, F-12, DM-7, DM-11).
- Citation completeness, ordering, bounds, secret-free content, determinism, `failureClass` restricted to the declared read-result codes (`provider.payload.invalid`, `provider.not-found`) with no free-form provider text, the failure-summary grammar, and the human-success grammar (AC-F8-1..2, AC-F10-1..2, F-8, F-10, DM-5, DM-6).
- The shared `humanText` dispatch that returns the six-line gates report for `target: "gates"` and `undefined` for `verify change`, so the delivered `humanSuccess`/`humanJson` redact-then-serialize path preserves `verify change` human output byte-for-byte (including JSON-escaping-sensitive secrets) while machine mode stays unchanged (AC-F10-3, F-10, DM-1, DM-12).
- Overall derivation, failure-identity precedence, the `{0,1,2}` exit matrix, and the two additive error rows with two-way documented-table sync (AC-F9-1..3, F-9, DM-8).
- Read-only composition, credential-reference guard, network/non-404 non-2xx/payload failure semantics, read-specific 404 absence, read budget, and replay determinism (AC-F11-1..2, AC-F5-4, AC-F6-2, F-11, DM-14, NFR-2, NFR-3).
- Additive `DeliveryRequest` gate facts, their GitHub normalization and deterministic mergeability precedence, and trap coverage (AC-F12-1, F-12, DM-7).
- Contract data-only placement, domain purity, boundary/ambient/secret/forbidden-literal invariants, workspace-inventory binding, forbidden-literal-registry registration of the new feature doc, and no new package/subpath/runtime-API/dependency (AC-F13-1, F-13, NFR-6, NFR-9).
- The committed fixture corpus, its completeness meta-check, negative controls, default-CI zero live calls, and an opt-in structural live smoke (AC-F14-1, F-14, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Merge execution, squash execution, auto-merge, post-merge verification, and every write (NG-2, NG-5).
- [OUT] Suite-to-job mapping, matrix expansion, reusable-workflow mapping, job-level `if` awareness, and suite-level roll-up (NG-1, M2-S7). v1 detects job presence by exact displayed name.
- [OUT] GitLab/Jira gate reads, a second provider binding, fork PR support, and cross-repository heads (NG-4, OQ-1).
- [OUT] Unanswered-comment detection and comment-set reads; the owner gate is label-based with a declared limitation (NG-7, ADR-0006, OQ-5).
- [OUT] Review approval, approval count, unresolved review threads, branch protection, and worktree cleanliness as gate conditions (NG-8, NG-9, OQ-4, OQ-7).
- [OUT] A PR-number or arbitrary-ref argument, a `--gate` filter, `--watch`, cached/stale evidence, multiple workflows, or a configurable workflow path (NG-6, NG-10, OQ-2).
- [OUT] Embedded-metadata provenance consumption (NG-11, DEC-14, OQ-6).
- [OUT] New envelope fields, new domain kinds, new configuration keys, state-schema changes, new packages/subpaths, and new runtime-API locations (NG-12).
- [OUT] Bash-stack, agent-prompt, MCP/OpenCode, fleet/board, and telemetry changes (NG-13).
- [RESOLVED — implementation plan present] `chg-GH-178-plan.md` is committed and is the binding delivery plan. The plan must map onto this TC set, identities, reasons, report shape, and AC mapping; it may not reshape them. The plan also carries the tasks for the structured `VerifyLedgerEvaluation`, the shared `humanText` dispatch, the read-specific 404 mapping, the inventory/`EXECUTABLE_ALLOWANCES` updates, and the forbidden-literal-registry registration; this test plan expects and verifies those tasks.
- [RESOLVED — open-PR resolution] The resolution rule is one rule shared by push parity and squash (DM-13): detached → `branch-unresolved`; raw page at `VERIFY_GATES_OPEN_PR_LIMIT` → `ambiguous-open-pr` with or without a match; exactly one `sourceRef === branch` match → resolved; more than one match → `ambiguous-open-pr`; zero matches with zero open requests → `no-open-pr`; zero matches with at least one open request → `branch-mismatch`. The old `no-open-pr`-for-a-lone-non-matching-PR expectation is removed.
- [RESOLVED — read-specific 404] A definitive HTTP 404 surfaces as the adapter-local `provider.not-found` and is mapped per read (DM-14): work-item 404 → `ticket-unresolved`/`absent`; PR list 404 → `no-open-pr`; a matched PR detail 404 → `head-unresolved` with source outcome `absent` for every detail-consuming gate (`ci-green`, `push-parity`, `squash-preflight`), never `no-open-pr` for squash and never a generic `unknown`; check-run 404 → source outcome `absent`, gate `unknown` `read-failed`, never `failed` and never `ci-no-runs`. A 404 is never flattened into a generic `unknown`.
- [RESOLVED — inventory and registry binding] `tests/fixtures/ports/v1-contract-inventory.json` must list the new contract module, `tests/structure/content-inventory.test.ts` requires every new exported function/const in `EXECUTABLE_ALLOWANCES`, and `doc/spec/features/feature-verify-gates.md` must be registered in `scripts/checks/forbidden-literals.registry.json` (TC-VGATES-065, TC-VGATES-066).
- [RESOLVED — package root and combined runtime] The new pure domain symbols (`EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, renderers) are re-exported additively from `packages/core/src/index.ts` so `@delivery-os/cli` imports them from `@delivery-os/core` (no new subpath). One `verify` definition exposes both subcommands; `createVerifyCommandDefinition` accepts a combined runtime with both `change` and `gates`, and `ConfigProgramOptions.verify` stays the single option (TC-VGATES-069).
- [RESOLVED — DM-15 failure-path fields] Terminal document failures (`failed`: malformed notes or a missing target) carry `variant: unknown`, empty required/completed/missing arrays, zero declaration counts, registry evidence `present: false` with zero counts, and the document failure identity; classified outcomes (`finished`, `partial`, `state-unverified`) carry the ordered arrays, declaration-derived counts, and registry evidence; `failed` → lifecycle `fail` and `state-unverified` → lifecycle `unknown` (TC-VGATES-062).
- [RESOLVED — CI denominators] `expected` and `missing` are over the declared expected set, `runs` is the observed normalized page size, and `succeeded`/`failed`/`pending`/`skipped`/`canceled` are observed per-run state buckets; a run is counted in at most one bucket, and an unrecognized state contributes only to `runs` and is treated as a failed observation so the gate cannot pass (TC-VGATES-018, TC-VGATES-019, TC-VGATES-022, TC-VGATES-070).
- [RESOLVED — failureClass] `failureClass`, when present, is drawn only from the declared read-result codes `provider.payload.invalid` and `provider.not-found`, never free-form provider text; a read carrying an error-table code uses `failureCode` and omits `failureClass` (TC-VGATES-040, TC-VGATES-041).
- [RESOLVED — no-live guard fixture] The default-suite network guard is the committed fixture `tests/fixtures/verify-gates/cases/network-guard.ts` exporting `createNoNetworkGuard()` with `install()`/`restore()`, following `tests/fixtures/result/no-spawn-guard.ts`; `tests/checks/verify-gates-no-live-calls.test.ts` installs it in process, so no undocumented `--preload` is required (TC-VGATES-059).
- [GAP-2 — delivery-bound names] Runtime module names, internal helper names, fixture file names, and the exact source-file split between the behaviour suites are delivery-bound. Gate ids, order, verdicts, reasons, sources, outcomes, count names, name kinds, constants, bounds, report/summary/human grammars, and the exit matrix are pinned here and may not be rebound.
- [RESOLVED — squash citation] The squash-preflight citation always carries a `squash-signals` name list with exactly two distinct, ordered values — `draft=<true|false>` then `mergeable=<mergeable|conflicting|not-mergeable|unknown>` — whenever the delivery-request detail was read successfully, on `squash-ready` and on every squash condition failure; the reason still names the failed condition. A successful detail read that omits `commitCount`/`changedFileCount` still carries those two tokens while omitting the `commits`/`changedFiles` counts as unknown (never zero). When no usable detail was read — a resolution failure (`not-attempted`), a detail 404 (source outcome `absent`), or a failed detail read (source outcome `failed`) — the list is empty and the `commits`/`changedFiles` counts are omitted as unknown (never zero), while the citation still carries at least one source and at least one closed reason, satisfying AC-F8-1. The source outcome and reason name the prerequisite; nothing is fabricated or defaulted, and an omitted count is never rendered as zero.
- [RESOLVED — CI count names] AC-F3-1's count names are `failed`, `succeeded`, and `runs`, where `runs` is the total; there is no separate `total` count.
- [RESOLVED — five internal gate records] Exactly five internal gate records always exist, even when another gate fails. On failure the envelope carries no `data`, and the same five records are preserved as the five per-gate lines of the bounded failure summary (DM-6). A failure envelope never gains `data`.
- [RESOLVED — owner-gate ticket resolution] A malformed/non-numeric tracker identity (for example `GH-abc`) and a valid numeric identity whose work-item read receives HTTP 404 (`provider.not-found`) both fail `ticket-unresolved` with source outcome `unresolved` or `absent`, never `read-failed`. Transport failures, non-404 non-2xx responses, credential failures, and unresolved repository bindings are `unknown`.

## 2. References

- **Change specification (v1.5)**: [chg-GH-178-spec.md](./chg-GH-178-spec.md) — AC-F1-1..AC-F14-1 (including AC-F3-5 and AC-F3-6), F-1..F-14, DM-1..DM-15, NFR-1..NFR-10, Appendix A (gate matrix, mergeability precedence), Appendix B (report shape), Appendix C (constants), Appendix D (failure grammar), Appendix E (human grammar), Appendix F (expected-job rules), Appendix G (GitHub reads, required trap ids, fixture placement), Appendix H (documentation impacts), Appendix I (traceability and test-plan-facing fixture expectations).
- **Implementation plan**: [chg-GH-178-plan.md](./chg-GH-178-plan.md) — phased tasks for contracts/domain/adapters/CLI, `VerifyLedgerEvaluation`, read-specific 404 absence, `humanText`, inventory/`EXECUTABLE_ALLOWANCES` updates, and forbidden-literal-registry registration. The plan is binding for delivery sequencing; where its prose lags the spec v1.5 rule, this test plan and the spec are the oracle for behavior.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries}`, `tests/golden`, fixtures under `tests/fixtures/**`, `pnpm check` as the aggregate gate, permanent-suite rules.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, no ambient reads, no spawn.
- **Verify change and exit taxonomy**: [feature-verify-change-and-exit-taxonomy.md](../../../spec/features/feature-verify-change-and-exit-taxonomy.md) — the structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation` the lifecycle gate composes; `classifyVerifyChange` is its behavior-preserving wrapper; variant sets; ledger identities.
- **Status digest**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — `STATUS_OWNER_ATTENTION_LABELS`, `STATUS_CI_RESULTS` (`none` and all-skipped are not green), and the credential-reference composition precedent.
- **Provider client seeds**: [feature-provider-client-seeds.md](../../../spec/features/feature-provider-client-seeds.md) — GitHub read slice, normalized views, bounded collections, `provider.not-found`, trap-catalog discipline.
- **Adapter ports**: [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md) — `DeliveryRequest`, `WorkItem`, `PipelineRun`, `ExternalSystemInstance`, `CredentialPort`, absence semantics.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, exact-code classification, `{0,1,2}` projection, redaction chokepoint, two-way documented-table sync.
- **PM-notes lint and phase transitions**: [feature-pm-notes-lint-and-phase-transitions.md](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md) — declaration, variant required sets, registry transitions, fold semantics.
- **Monorepo scaffold**: [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md) — tiers, subpaths, runtime-API confinement, boundary rules, CI topology.
- **Decisions**: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (tiers/runtime-API), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (comments omitted; labels are the signal), [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) (exit taxonomy; additive rows, not tokens).
- **Existing mechanisms**: `tests/behaviour/verify-support.ts` (verify harness and recording seams); `tests/behaviour/verify-envelope.test.ts` (envelope/exit matrix pattern); `tests/behaviour/run-cli.test.ts` and `tests/fixtures/result/no-spawn-guard.ts` (no-spawn guard); `tests/golden/helpers.ts` (`runCli`, fixed brand/clock/id, buffer streams); `tests/fixtures/state/harness.ts`; `tests/behaviour/providers/**` and `tests/fixtures/providers/**` (fake provider transport and trap catalogs); `tests/structure/{verify-imports,trap-catalog,error-table,content-inventory,port-contract-inventory,subpaths}.test.ts`; `tests/fixtures/ports/v1-contract-inventory.json`; `tests/checks/{error-table-sync,exit-code-literals,forbidden-literals}.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,privacy-literals,secret-read-boundary,workspace-entrypoints}.ts`; `scripts/checks/forbidden-literals.registry.json`; `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`).
- **Ticket**: GH-178 — M0-S9: verify gates v1.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | Grammar is validated before any read; missing/empty ref and wrong subcommand are handler grammar (`input.value.rejected`), while a third positional or unknown flag is parser shape (`fallback.invocation`), exit 1; one `verify` definition accepts the combined `change`+`gates` runtime | TC-VGATES-008, TC-VGATES-009, TC-VGATES-069 | Covered |
| AC-F1-2 | Attached branch selects the unique matching open PR through DM-13; detached HEAD, zero PRs, a lone non-matching PR, multiple matches, and an at-limit page fail the branch-dependent gates; no PR-number argument | TC-VGATES-009, TC-VGATES-011, TC-VGATES-012, TC-VGATES-060 | Covered |
| AC-F1-3 | Exactly five internal gate records always exist in fixed order; every gate evaluated without short-circuit; on failure they are preserved as the five bounded summary lines because no failure envelope carries `data`; no gate or citation omitted | TC-VGATES-001, TC-VGATES-010, TC-VGATES-042 | Covered |
| AC-F2-1 | Full or LITE complete ledger passes `lifecycle-complete` with effective variant, required/completed counts, empty missing set, registry evidence from the structured `VerifyLedgerEvaluation`; the gate is driven by the evaluator, not the classifier wrapper | TC-VGATES-013, TC-VGATES-014, TC-VGATES-062 | Covered |
| AC-F2-2 | Incomplete, malformed, or missing-target ledger fails `lifecycle-incomplete` with reused `verify.ledger.incomplete`/`lint.*` and ordered missing phases | TC-VGATES-015, TC-VGATES-062 | Covered |
| AC-F2-3 | Platform/user registry-store failure yields lifecycle `unknown` (`lifecycle-unverifiable`) with the underlying `state.*`; overall unknown reuses the code/exit | TC-VGATES-016, TC-VGATES-017 | Covered |
| AC-F2-4 | On incomplete, malformed, or registry-failed ledgers the citation's variant, required/completed/missing counts, ordered `missing-phases`, and unique registry record/transition/overlay counts come from `VerifyLedgerEvaluation`, never from parsing the classifier summary; a terminal document failure carries empty phase arrays, zero declaration counts, and the document failure identity; `state-unverified` keeps declaration-derived arrays/counts with failed registry evidence; `failed` maps to `fail` and `state-unverified` maps to `unknown`; `classifyVerifyChange` wraps the same evaluator with its existing shape | TC-VGATES-013, TC-VGATES-015, TC-VGATES-062 | Covered |
| AC-F3-1 | A failed run on the pushed head fails `ci-failed`, cites failed job names and the `failed`, `succeeded`, and `runs` counts, with `expected`/`missing` over the expected set, `runs` the observed page size, and one state bucket per observed run; overall fails; no green claim | TC-VGATES-018, TC-VGATES-019, TC-VGATES-027, TC-VGATES-070 | Covered |
| AC-F3-2 | A green page missing expected jobs fails `ci-missing-jobs` with missing names in expected-set order, bounded with omitted count | TC-VGATES-020, TC-VGATES-026 | Covered |
| AC-F3-3 | Zero runs fails `ci-no-runs`; no expected job succeeded and all expected jobs skipped fails `ci-all-skipped` even with an extra success; denominators and unrecognized states cannot fabricate a pass | TC-VGATES-021, TC-VGATES-022, TC-VGATES-070 | Covered |
| AC-F3-4 | Running/queued or canceled runs fail; a page at the 100-run limit is `unknown` (`ci-truncated`); none passes | TC-VGATES-023, TC-VGATES-024 | Covered |
| AC-F3-5 | A resolved PR whose detail read returns HTTP 404 makes `ci-green` `fail` `head-unresolved` with detail source `absent`, never a generic `unknown`; a non-404 detail failure is `unknown` (`read-failed`, `credential-unavailable`, or `address-unresolved`) | TC-VGATES-061, TC-VGATES-067 | Covered |
| AC-F3-6 | A check-run HTTP 404 has source outcome `absent` and makes `ci-green` `unknown` `read-failed`, never `failed` and never `ci-no-runs`; other check-run failures are `unknown`; no check-run failure passes | TC-VGATES-039, TC-VGATES-061, TC-VGATES-068 | Covered |
| AC-F4-1 | Expected display names are extracted in declaration order and compared exactly; missing/unreadable/malformed/empty/duplicate/over-cap/over-long set fails `ci-expected-jobs-invalid` with no observed-name fallback | TC-VGATES-020, TC-VGATES-025, TC-VGATES-026 | Covered |
| AC-F5-1 | Equal local/remote head SHAs pass `parity-matched` citing both SHAs and the PR; unequal SHAs fail `parity-mismatched` | TC-VGATES-028, TC-VGATES-029 | Covered |
| AC-F5-2 | Detached HEAD, unresolved head, zero/multiple PRs, or a lone non-matching PR fail with the named reasons (`branch-unresolved`, `head-unresolved`, `no-open-pr`, `ambiguous-open-pr`, `branch-mismatch`); a non-404 provider/binding failure is `unknown`; none passes | TC-VGATES-011, TC-VGATES-012, TC-VGATES-030, TC-VGATES-031, TC-VGATES-039, TC-VGATES-061 | Covered |
| AC-F5-3 | An open-PR page at `VERIFY_GATES_OPEN_PR_LIMIT` fails `ambiguous-open-pr` whether or not it contains exactly one matching PR; both at-limit-with-match and at-limit-without-match fixtures fail the same way | TC-VGATES-060 | Covered |
| AC-F5-4 | A PR list 404 → `no-open-pr`; a matched PR detail 404 → `head-unresolved` with source `absent` for parity (and every detail-consuming gate); neither is a generic `unknown`; any other non-2xx/transport/credential/binding failure is `unknown` | TC-VGATES-061, TC-VGATES-067 | Covered |
| AC-F6-1 | No owner label passes `owner-gate-absent`; a `hand-back`/`human-input-needed` label (case-insensitive) fails `owner-gate-present` and cites labels in contract order | TC-VGATES-032, TC-VGATES-033 | Covered |
| AC-F6-2 | Malformed/non-numeric identity (`GH-abc`) fails `ticket-unresolved`/`unresolved`; a work-item HTTP 404 (`provider.not-found`) fails `ticket-unresolved`/`absent`, never `read-failed`; transport, non-404 non-2xx, credential, or binding failure is `unknown`; never passes on an unread item; label-only signal declared | TC-VGATES-034, TC-VGATES-039, TC-VGATES-061 | Covered |
| AC-F7-1 | Open, non-draft PR on `main-tools`, mergeable, positive commits/files passes `squash-ready` and cites the PR/base identity, the `squash-signals` list (`draft=false`, `mergeable=mergeable` in that order), and the `commits`/`changedFiles` counts | TC-VGATES-035 | Covered |
| AC-F7-2 | Wrong base, draft, merged/closed, conflicting, or not-mergeable fails with the matching reason; resolution failures (`branch-mismatch`, `no-open-pr`, `ambiguous-open-pr`, `branch-unresolved`) and a matched PR detail 404 map to their declared reasons (`head-unresolved`, source `absent`); every failure path with a successful detail read still carries the same two-token `squash-signals` list as the pass path, while a resolution failure (`not-attempted`), detail 404 (`absent`), or failed detail read (`failed`) carries an empty list and omitted `commits`/`changedFiles` counts (unknown, not zero); review approval is not required | TC-VGATES-036, TC-VGATES-037, TC-VGATES-060, TC-VGATES-061, TC-VGATES-064, TC-VGATES-067 | Covered |
| AC-F7-3 | Unknown/absent mergeability, zero commits, zero changed files, or absent counts fail; the citation carries `squash-signals` (`mergeable=unknown` when absent); unknown is never mergeable and absent is never non-empty; the list is empty only when no usable detail was read (resolution failure `not-attempted`, detail 404 `absent`, or failed detail read `failed`), with omitted (unknown, not zero) surface counts; a successful detail read that omits `commits`/`changedFiles` omits those counts as unknown (never zero) while still carrying the two `squash-signals` tokens | TC-VGATES-038, TC-VGATES-039, TC-VGATES-054, TC-VGATES-064 | Covered |
| AC-F8-1 | Every verdict has 1..3 sources with outcomes, a `changeRef` plus resolved identities, 1..4 closed reasons, and its declared counts/name lists, which may be empty when the dependent source outcome is `failed`, `absent`, or `not-attempted` (the reason names the cause); a successful detail read always yields exactly two ordered `squash-signals` tokens, while a detail 404 (`absent`) or failed detail read (`failed`) yields an empty list with omitted `commits`/`changedFiles` counts (unknown, not zero); a successful detail read that omits `commits`/`changedFiles` omits those counts as unknown (never zero) while still carrying the two tokens; a citation with no source or no reason is a contract failure; `failureClass` is only `provider.payload.invalid` or `provider.not-found`, never free-form | TC-VGATES-027, TC-VGATES-040, TC-VGATES-041 | Covered |
| AC-F8-2 | Failure summary is one header plus exactly one line per gate in order, at most 6 lines/4096 bytes, no raw payload/title/secret, byte-identical on replay; both the `counts=` and `names=` segments are always present in that order, and each empty segment renders as the literal `-`, never a zero alias, a bare `counts=`, or an omitted segment | TC-VGATES-042 | Covered |
| AC-F9-1 | Overall is `pass` only when all five pass, `fail` if any fails, `unknown` otherwise; success envelope only for `pass`; unknown never passes | TC-VGATES-018, TC-VGATES-045 | Covered |
| AC-F9-2 | All-pass exits 0; any fail exits 1 with `verify.gates.failed`; unknown reuses the first resolvable unknown identity or `verify.gates.unavailable` exit 2; no failure carries `data`; exits only in `{0,1,2}` | TC-VGATES-016, TC-VGATES-017, TC-VGATES-046 | Covered |
| AC-F9-3 | Both new rows have exactly one documented row with equal fields; `verify.ledger.incomplete` is unchanged; `verify` stays exact-code classified; zero two-way drift | TC-VGATES-004, TC-VGATES-047 | Covered |
| AC-F10-1 | `--json` all-pass emits exactly one valid envelope whose `data` is `delivery.verify-gates.v1` with the full shape; serialized data at most 65 536 bytes; no `error` | TC-VGATES-044 | Covered |
| AC-F10-2 | Human success is exactly six deterministic lines with verdict/sources/evidence, at most 6 lines/4096 bytes, no timestamps/prose/raw/secret; failure prints no success text and carries the bounded summary | TC-VGATES-043, TC-VGATES-063 | Covered |
| AC-F10-3 | The single `verify` definition's `humanText` prints the six-line gates report only for `target: "gates"`; for every other target (`verify change`) it returns `undefined`, so `runCli` falls through to the delivered `humanSuccess`/`humanJson` path, which redacts the data object before serialization and keeps the bytes identical to today's `verify change` output, including for a JSON-escaping-sensitive secret whose raw form differs from its escaped form; `verify change` does not use `humanText`; `humanSuccess` may remain and only a defined `humanText` result takes precedence; the same one definition accepts both runtimes | TC-VGATES-063, TC-VGATES-069 | Covered |
| AC-F11-1 | Unresolved binding makes provider gates `unknown` (`address-unresolved`); non-credential-reference GitHub makes them `unknown` (`credential-unavailable`, `config.credential.missing`) while lifecycle still runs; missing credential overall unknown exits 1; network/non-404 non-2xx/payload unknown exits 2 when unclassified; a check-run 404 is `unknown` `read-failed` with source `absent`; a matched PR-detail 404 makes every detail-consuming gate fail `head-unresolved` with source `absent` | TC-VGATES-031, TC-VGATES-039, TC-VGATES-048, TC-VGATES-049, TC-VGATES-050, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068 | Covered |
| AC-F11-2 | Zero writes/fences/mutations/merges/auto-merges/network writes/child processes; at most four outbound GETs with zero retries/pagination; replay produces identical report/summary/human/exit | TC-VGATES-051, TC-VGATES-052 | Covered |
| AC-F12-1 | GitHub detail normalization populates the four optional fields with fixed mergeability precedence: false/dirty → `conflicting`; blocked/behind/unstable/draft → `not-mergeable` even when `mergeable === true`; null/absent/computing/unrecognized → `unknown`; true + clean/absent → `mergeable`; absent counts stay absent; no new type/operation/export; trap catalog gains matching entries | TC-VGATES-003, TC-VGATES-054, TC-VGATES-055, TC-VGATES-056, TC-VGATES-064 | Covered |
| AC-F13-1 | Contracts are data-only; domain imports contracts and the verify-change module only; no new runtime-API location/package/subpath/dependency; the new pure domain symbols are importable from the `@delivery-os/core` package root; secret allowlist stays four; no product literal; ordering from contract arrays; workspace inventories and the forbidden-literal registry include the new modules/doc | TC-VGATES-001, TC-VGATES-002, TC-VGATES-005, TC-VGATES-006, TC-VGATES-007, TC-VGATES-065, TC-VGATES-066, TC-VGATES-069 | Covered |
| AC-F14-1 | Corpus covers every gate, verdict, and reason, the three ticket negatives, push mismatch, owner present, bad squash, at-limit with/without a match, branch mismatch, and read-specific 404 absence including a PR-detail 404 for CI/parity/squash and a check-run 404; completeness meta-check fails on missing/stale/wrong verdict; default CI has zero live calls; opt-in live smoke is structural only; trap payloads stay under `tests/fixtures/providers/` and behavioural fixtures under `tests/fixtures/verify-gates/providers/...` | TC-VGATES-055, TC-VGATES-057, TC-VGATES-058, TC-VGATES-059, TC-VGATES-060, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-VGATES-008, 009, 010, 011, 012, 060, 069; F-2 → 013, 014, 015, 016, 017, 062; F-3 → 018, 019, 020, 021, 022, 023, 024, 027, 067, 068, 070; F-4 → 020, 025, 026; F-5 → 028, 029, 030, 031, 060, 061, 067; F-6 → 032, 033, 034, 061; F-7 → 035, 036, 037, 038, 039, 060, 061, 064, 067; F-8 → 040, 041, 042, 068; F-9 → 045, 046, 047; F-10 → 043, 044, 063, 069; F-11 → 031, 039, 048, 049, 050, 051, 061, 067, 068; F-12 → 003, 054, 055, 056, 064; F-13 → 001, 002, 005, 006, 007, 065, 066, 069; F-14 → 055, 057, 058, 059, 060, 061, 067, 068.

**TC → AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; the table above carries the forward direction. All thirty-six ACs are covered and no assertion is deferred. AC-F7-1/AC-F7-2/AC-F7-3 assert the `squash-signals` citation list directly (TC-VGATES-035..039, 054, 064, 067), AC-F7-2/AC-F8-1 assert the empty-list-plus-omitted-counts rule on the detail-404 (`absent`) and failed-detail (`failed`) paths and the omitted-counts-plus-two-tokens rule on a successful detail read with absent surface counts while still requiring at least one source and one reason (TC-VGATES-038/039/040/061/067), AC-F3-1/AC-F3-3 assert `failed`/`succeeded`/`runs` and the exact expected-set denominators (TC-VGATES-018/019/022/070), AC-F1-3/AC-F8-2 assert the five preserved summary lines with no failure `data` (TC-VGATES-010, TC-VGATES-042), AC-F3-5/AC-F5-4/AC-F7-2 assert the single matched-detail 404 rule for CI, parity, and squash (TC-VGATES-067), AC-F3-6/AC-F11-1 assert the check-run 404 as source `absent` and `unknown` `read-failed` (TC-VGATES-068), AC-F6-2/AC-F5-4 assert read-specific 404 absence (TC-VGATES-034, TC-VGATES-061), AC-F5-3 asserts at-limit closure with and without a match (TC-VGATES-060), AC-F2-4 asserts structured ledger evidence, no classifier-summary parsing, and DM-15 failure-path field semantics from `VerifyLedgerEvaluation` (TC-VGATES-013, TC-VGATES-015, TC-VGATES-062), AC-F10-3 asserts the `humanText` dispatch and `verify change` byte preservation (TC-VGATES-063, TC-VGATES-069), AC-F1-1/AC-F13-1 assert the package-root export and combined runtime (TC-VGATES-069), and AC-F8-1 asserts bounded `failureClass` (TC-VGATES-040/041). There is no uncovered AC.

### 3.2 Interface Coverage (DM-#)

The specification declares no HTTP endpoints and no events (sections 8.1 and 8.2). The interface surface is the data model and the gate vocabulary.

| Interface | Description | TC ID(s) | Status |
|-----------|-------------|----------|--------|
| DM-1 | `VerifyGatesReport`: schema version, change ref, target, overall, summary, exactly five gates | TC-VGATES-044, TC-VGATES-045 | Covered |
| DM-2 | Gate ids and fixed order; exactly five internal gate records always exist; order normative for evaluation, report, summary, human | TC-VGATES-001, TC-VGATES-010 | Covered |
| DM-3 | Verdicts `pass`/`fail`/`unknown`; pass requires complete readable non-vacuous evidence; unknown never passes | TC-VGATES-001, TC-VGATES-045 | Covered |
| DM-4 | Closed reason set and per-gate allowed subsets; no free-form reason | TC-VGATES-001, TC-VGATES-040 | Covered |
| DM-5 | Citation shape: 1..3 sources, identity, 0..8 counts, 0..3 name lists, 1..4 reasons; `failureClass` is only `provider.payload.invalid` or `provider.not-found` and a read with an error-table code uses `failureCode` instead; `squash-signals` values are `draft=<true\|false>` then `mergeable=<mergeable\|conflicting\|not-mergeable\|unknown>` in fixed order, present with exactly two tokens whenever a detail was read successfully (even when a successful detail read omits `commits`/`changedFiles`, which then stay omitted as unknown, never zero) and empty (with `commits`/`changedFiles` omitted as unknown, never zero) when no usable detail was read (`failed`, `absent`, or `not-attempted`) | TC-VGATES-040, TC-VGATES-041, TC-VGATES-042 | Covered |
| DM-6 | Overall derivation; exactly five internal gate records preserved as the five bounded summary lines on failure; every line always carries both the `counts=` and `names=` segments, each rendering the literal `-` when empty (never a zero alias, a bare `counts=`, or an omitted segment); a failure envelope never carries `data` | TC-VGATES-010, TC-VGATES-042, TC-VGATES-045 | Covered |
| DM-7 | Additive optional `DeliveryRequest` fields and absence semantics; fixed mergeability precedence including `mergeable === true` with blocked/dirty/draft state | TC-VGATES-003, TC-VGATES-054, TC-VGATES-064 | Covered |
| DM-8 | Two additive error identities under the existing `verify` kind; existing row unchanged | TC-VGATES-004, TC-VGATES-046, TC-VGATES-047 | Covered |
| DM-9 | Declared constants and bounds, including `VERIFY_GATES_OPEN_PR_LIMIT` (at-limit → `ambiguous-open-pr`) | TC-VGATES-001, TC-VGATES-060 | Covered |
| DM-10 | Expected-job-set shape and validation rules; no observed-name fallback | TC-VGATES-025, TC-VGATES-026 | Covered |
| DM-11 | Per-gate counts and name kinds; lifecycle counts come from `VerifyLedgerEvaluation`; CI counts use declared denominators (`expected`/`missing` over the expected set, `runs` observed, one state bucket per observed run, no double-bucketing); squash `squash-signals` is exactly two ordered tokens (`draft` then `mergeable`) on pass and every condition failure with a successful detail read, and empty with omitted `commits`/`changedFiles` counts (unknown, never zero) when no usable detail was read (`failed`, `absent`, or `not-attempted`); a successful detail read that omits `commits`/`changedFiles` omits those counts as unknown (never zero) while still carrying the two tokens; caps and ordering | TC-VGATES-035, TC-VGATES-036, TC-VGATES-037, TC-VGATES-038, TC-VGATES-040, TC-VGATES-041, TC-VGATES-062, TC-VGATES-064, TC-VGATES-070 | Covered |
| DM-12 | Schema version `delivery.verify-gates.v1`; envelope stays `delivery.result.v1`; `humanText` returns the gates report for `gates` and `undefined` for `verify change`, so redact-then-serialize preserves its bytes | TC-VGATES-001, TC-VGATES-044, TC-VGATES-063 | Covered |
| DM-13 | `OpenPrResolution`: one deterministic open-PR resolution rule shared by push parity and squash — detached `branch-unresolved`; at-limit `ambiguous-open-pr`; one match resolved; multiple matches `ambiguous-open-pr`; zero matches with zero PRs `no-open-pr`; zero matches with ≥1 PR `branch-mismatch` | TC-VGATES-011, TC-VGATES-030, TC-VGATES-060, TC-VGATES-061 | Covered |
| DM-14 | Provider read-result absence: additive adapter-local `provider.not-found` for HTTP 404; read-specific mapping for work item, PR list/detail, and check runs (matched detail 404 → `head-unresolved`/`absent` for CI, parity, and squash; check-run 404 → source `absent`, gate `unknown` `read-failed`); other non-2xx stays `provider.payload.invalid`; no error-table row | TC-VGATES-034, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068, TC-VGATES-055, TC-VGATES-056 | Covered |
| DM-15 | Structured lifecycle evaluation `EvaluateVerifyChange` → `VerifyLedgerEvaluation` with variant, outcome, required/completed/missing phases, declaration counts, and registry evidence; classified outcomes carry ordered arrays/counts/registry evidence, terminal failures carry empty arrays/zero counts/registry `present: false` plus the document failure identity, `failed` → `fail`, `state-unverified` → `unknown`; `classifyVerifyChange` wraps it; the lifecycle gate never parses a summary | TC-VGATES-013, TC-VGATES-015, TC-VGATES-062 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Non-vacuous pass guarantee: zero all-pass outcomes on any fail/unknown, zero-run, all-skipped, missing-job, invalid-set, missing-PR, non-matching-branch, at-limit page, detached-HEAD, SHA-mismatch, unknown-mergeability, 404-absence (including CI PR-detail 404 and check-run 404), unrecognized run state, or zero-surface fixture | TC-VGATES-010, TC-VGATES-019..038 (negative cases), TC-VGATES-058, TC-VGATES-060, TC-VGATES-061, TC-VGATES-062, TC-VGATES-064, TC-VGATES-067, TC-VGATES-068, TC-VGATES-070 | Covered |
| NFR-2 | Read-only and read budget: zero writes/fences/mutations/merges/auto-merges/network writes/child processes; at most four GETs; zero retries; zero pagination; at most one read per local source | TC-VGATES-051 | Covered |
| NFR-3 | Determinism: byte-identical report, summary, human text, and exit across replays; contract-array ordering only; structured ledger evidence and mergeability precedence deterministic | TC-VGATES-041, TC-VGATES-042, TC-VGATES-043, TC-VGATES-052, TC-VGATES-062, TC-VGATES-063, TC-VGATES-064 | Covered |
| NFR-4 | Output contract: exactly one valid envelope per `--json` run; no failure with `data`; no success with `error`; exits only `{0,1,2}`; one line per gate on failure; machine mode unchanged by `humanText` | TC-VGATES-042, TC-VGATES-044, TC-VGATES-046, TC-VGATES-063 | Covered |
| NFR-5 | Bounds: 100 open PRs in one page (at-limit is ambiguous), 100 check runs, 200 expected jobs, 120-char names, 256 KiB workflow, 8 citation names, 6 summary lines/4096 bytes, 65 536-byte success data, no raw payloads | TC-VGATES-024, TC-VGATES-025, TC-VGATES-041, TC-VGATES-042, TC-VGATES-044, TC-VGATES-060 | Covered |
| NFR-6 | Tier and boundary conformance: data-only contracts; no foreign domain imports; no new runtime-API location/package/subpath/dependency; the new domain symbols import from the `@delivery-os/core` package root; boundary, ambient, dependency-cruiser, and literal gates green; workspace inventories register every new module/export | TC-VGATES-002, TC-VGATES-005, TC-VGATES-007, TC-VGATES-065, TC-VGATES-069 | Covered |
| NFR-7 | Error-table binding: both new rows round-trip; zero two-way drift; existing rows unchanged; exact-code classification resolves every reachable code | TC-VGATES-004, TC-VGATES-047 | Covered |
| NFR-8 | Performance: pure evaluation at most 50 ms over capped inputs; bounded by the read budget; no unbounded loop | TC-VGATES-053 | Covered |
| NFR-9 | Privacy and brand neutrality: zero product/binary literals; zero secrets/credentials/raw payloads/titles/comment bodies/commit messages/file contents in report, summary, or human text; brand-injected header; new feature doc registered in the forbidden-literal corpus | TC-VGATES-006, TC-VGATES-041, TC-VGATES-043, TC-VGATES-066 | Covered |
| NFR-10 | Evidence model: 100% of gates and reasons covered by committed fixtures; read-specific 404 cases including CI PR-detail 404 and check-run 404; trap payloads under `tests/fixtures/providers/` and behavioural fixtures under `tests/fixtures/verify-gates/providers/...`; zero live calls in default CI under the named `tests/fixtures/verify-gates/cases/network-guard.ts`; opt-in live smoke structural only and no volatile counts | TC-VGATES-055, TC-VGATES-057, TC-VGATES-058, TC-VGATES-059, TC-VGATES-060, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068 | Covered |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Structure — contract/vocabulary | `bun test tests/structure/verify-gates-contract.test.ts` | `tests/structure/verify-gates-contract.test.ts` | TC-VGATES-001 |
| Structure — purity/imports | `bun test tests/structure/verify-gates-imports.test.ts` | `tests/structure/verify-gates-imports.test.ts` | TC-VGATES-002, TC-VGATES-062 |
| Structure — package-root export and combined runtime | `bun test tests/structure/verify-gates-exports.test.ts` | `tests/structure/verify-gates-exports.test.ts` | TC-VGATES-069 |
| Structure — delivery-request facts | `bun test tests/structure/delivery-request-gate-facts.test.ts` | `tests/structure/delivery-request-gate-facts.test.ts` | TC-VGATES-003 |
| Structure — error table | `bun test tests/structure/error-table.test.ts` | existing suite, extended | TC-VGATES-004 |
| Structure — inventory/subpaths | `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/structure/port-contract-inventory.test.ts`; `tests/fixtures/ports/v1-contract-inventory.json`; `EXECUTABLE_ALLOWANCES` | existing suites plus fixtures | TC-VGATES-005, TC-VGATES-065 |
| Structure — ambient/literals/secret | `bun run scripts/checks/ambient-globals.ts` (and `forbidden-literals`, `privacy-literals`, `secret-read-boundary`); `scripts/checks/forbidden-literals.registry.json` | existing checks | TC-VGATES-006, TC-VGATES-066 |
| Boundaries — rules + fixture coverage | `bun test tests/boundaries` | `tests/boundaries/**` | TC-VGATES-007 |
| Behaviour — surface and target | `bun test tests/behaviour/verify-gates-surface.test.ts tests/behaviour/verify-gates-target.test.ts` | new behaviour suites | TC-VGATES-008..012, TC-VGATES-060, TC-VGATES-069 |
| Behaviour — lifecycle | `bun test tests/behaviour/verify-gates-lifecycle.test.ts` | new behaviour suite | TC-VGATES-013..017, TC-VGATES-062 |
| Behaviour — CI | `bun test tests/behaviour/verify-gates-ci.test.ts` | new behaviour suite | TC-VGATES-018..027, TC-VGATES-067, TC-VGATES-068, TC-VGATES-070 |
| Behaviour — parity and squash | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | new behaviour suite | TC-VGATES-028..031, 035..039, 060, 061, 064, 067 |
| Behaviour — owner and composition | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | new behaviour suite | TC-VGATES-032..034, 048..052, 061 |
| Behaviour — output | `bun test tests/behaviour/verify-gates-output.test.ts` | new behaviour suite | TC-VGATES-040..046, 063 |
| Behaviour — corpus | `bun test tests/behaviour/verify-gates-corpus.test.ts` | new behaviour suite plus `tests/fixtures/verify-gates/corpus/**` | TC-VGATES-057, TC-VGATES-058, TC-VGATES-060, TC-VGATES-061, TC-VGATES-067, TC-VGATES-068 |
| Behaviour — provider read side | `bun test tests/behaviour/providers/github-gate-facts.test.ts tests/behaviour/providers/github-trap.test.ts` | extended provider suites | TC-VGATES-054..056, TC-VGATES-064 |
| Behaviour — performance | `bun test tests/behaviour/verify-gates-performance.test.ts` | new behaviour suite | TC-VGATES-053 |
| Golden | `bun test tests/golden/verify-gates.test.ts` | new golden suite plus `tests/fixtures/verify-gates/golden/**` | TC-VGATES-044, TC-VGATES-045, TC-VGATES-052, TC-VGATES-063 |
| Checks — error-table sync | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | existing check plus extended mutation suite | TC-VGATES-004, TC-VGATES-047 |
| Checks — exit literals | `bun run scripts/checks/exit-code-literals.ts`; `bun test tests/checks/exit-code-literals.test.ts` | existing | TC-VGATES-046 |
| Checks — forbidden literals | `bun run scripts/checks/forbidden-literals.ts`; `bun test tests/checks/forbidden-literals.test.ts` | existing check plus registry fixture | TC-VGATES-066 |
| Checks — default-CI no-live-calls | `bun test tests/checks/verify-gates-no-live-calls.test.ts` | new check suite | TC-VGATES-059 |
| Live smoke (opt-in) | `VERIFY_GATES_LIVE=1 bun test tests/behaviour/verify-gates-live.test.ts` | new suite, excluded from `pnpm check` | TC-VGATES-059 |
| Aggregate | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 Injected-Fact and Fake-Transport Architecture (binding)

1. **Pure evaluator first.** `tests/behaviour/verify-gates-*.test.ts` import the pure `evaluateVerifyGates(facts)` domain export and pass a complete `VerifyGatesFacts` object: gate facts only, no I/O. The evaluator is the single oracle for verdict, reason, citation, counts, names, and overall. The CLI edge is tested separately.
2. **In-process command harness.** Surface, output, and exit tests build the `verify` command definition with injected dependencies (`brand`, `clock`, `newRunId`, `secrets`, `program`, streams) and call `runCli(argv, streams, deps)` in process, following `tests/behaviour/verify-support.ts` and `tests/golden/helpers.ts`. No test spawns a child process.
3. **Fake GitHub transport.** Provider-backed tests inject a fake transport at the delivered GitHub client's transport seam and return committed JSON payloads from `tests/fixtures/verify-gates/providers/github/**` (behavioural fixtures) and `tests/fixtures/providers/github/**` (trap payloads referenced by the catalog under `tests/fixtures/providers/traps/`). The two locations are distinct: a trap `fixtureReference` never points into `tests/fixtures/verify-gates/`, and a behavioural fixture is not a substitute for a catalog trap. The fake records method, path, query, and call count; it rejects any write method and any request beyond the declared bounds. No test reaches the network.
4. **Fake local adapters.** The repository adapter is injected with recorded branch/HEAD/detached/origin facts; the file adapter is pointed at a temporary workspace containing fixture pm-notes, registry, and workflow files; the credential port is injected with a present, absent, or failing credential. Every read is recorded; every write/fence method throws.
5. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed brand (`example-product`), a fixed two-tick clock, and a fixed `runId`, following `tests/golden/helpers.ts`. `assertEnvelopeContract` runs on every machine-output fixture.
6. **Committed fixtures are read-only.** Synthetic facts are materialized under a fresh `mkdtemp` root; committed fixtures are never rewritten. Structure/check mutation tests run on deep copies or temp trees; the live tree is never written.
7. **One package-root export and one combined runtime.** The CLI tests import `EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, and the renderers from `@delivery-os/core` (the package root), never a new `@delivery-os/core/domain` subpath. The one `verify` definition is built with a runtime object exposing both `change` and `gates`; the harness asserts both subcommands dispatch through this single definition and that `verify change` output remains byte-identical.
8. **Named no-live guard.** The default verify-gates suites are exercised under `createNoNetworkGuard()` from `tests/fixtures/verify-gates/cases/network-guard.ts`, installed in process by `tests/checks/verify-gates-no-live-calls.test.ts`; the guard follows the `tests/fixtures/result/no-spawn-guard.ts` install/restore pattern and has a self-test that proves a forbidden call is rejected.

### 4.2 Non-Vacuity Contract (binding for every negative, read-only, and corpus scenario)

- Every negative case pairs with a restored-or-valid control through the same invocation path (for example, the failed run restored to success yields `ci-green`; the removed expected job restored yields `ci-green`; the owner label removed yields `owner-gate-absent`; the 100-entry open-PR page shrunk to 99 with one match resolves; the 404 read restored to a readable item yields the normal gate evidence).
- Every fixture carries a distinctive canary (`planted-payload-verify-gates-*`, a fake token, a fake title/comment/commit string); the builder asserts the intended mutation/omission is present, and the run asserts the canary never appears in stdout, stderr, the machine report, the failure summary, or the human text.
- Every read-only assertion pairs with a seeded-write control that the recorder detects; a recorder that never observes a read is itself a failure.
- The corpus meta-check fails closed on an empty manifest, a missing case, a stale case, a duplicate case, or a case whose expected verdict differs from the executed verdict; it names the offending case.
- The non-vacuity meta-test fails when a fixture loader returns an empty set or when a case marked `fail`/`unknown` would produce a success envelope, `data`, exit 0, or a passing gate. An assertion that would pass on an empty or missing fixture set is treated as a defect.
- Structure/check mutations run on in-memory values or temp copies; the unmutated control is green in the same test.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-VGATES-001 | Gate vocabulary, reasons, sources, constants, and bounds are one data contract | Regression | Critical | High | AC-F1-3, AC-F13-1, DM-2..DM-15 |
| TC-VGATES-002 | Contracts are data-only; the domain is pure and imports only contracts plus the verify-change module | Regression | Critical | High | AC-F13-1, NFR-6 |
| TC-VGATES-003 | DeliveryRequest additive gate facts are optional and absent-safe | Regression | Critical | High | AC-F12-1, NFR-6 |
| TC-VGATES-004 | The two additive verify error rows and the unchanged ledger row are exact and classified | Regression | Critical | High | AC-F9-3, NFR-7 |
| TC-VGATES-005 | No new package, subpath, runtime-API location, or dependency | Regression | Critical | High | AC-F13-1, NFR-6 |
| TC-VGATES-006 | Ambient, forbidden-literal, privacy, brand, and secret-read invariants hold | Regression | Critical | High | AC-F13-1, NFR-9 |
| TC-VGATES-007 | Boundary rules and the fixture-coverage meta-check stay green | Regression | Critical | High | AC-F13-1, NFR-6 |
| TC-VGATES-008 | Grammar is rejected before any read | Negative | Critical | High | AC-F1-1 |
| TC-VGATES-009 | Accepted grammar: one ref, no PR-number or command flags, global `--json` | Happy Path | Critical | High | AC-F1-1, AC-F1-2 |
| TC-VGATES-010 | Exactly five internal gate records evaluate in fixed order with no short-circuit; failure preserves them as five summary lines with no `data` | Regression | Critical | High | AC-F1-3, DM-2, DM-6, NFR-1 |
| TC-VGATES-011 | Attached branch resolves the unique matching open PR; zero open PRs, multiple matches, and a lone non-matching PR fail with their declared reasons | Happy Path | Critical | High | AC-F1-2, AC-F5-2, DM-13 |
| TC-VGATES-012 | Detached HEAD fails branch-dependent gates without a PR read; lifecycle and owner still run | Negative | Critical | High | AC-F1-2, AC-F5-2 |
| TC-VGATES-013 | A complete full ledger passes lifecycle finalization | Happy Path | Critical | High | AC-F2-1, AC-F2-4 |
| TC-VGATES-014 | A complete LITE ledger passes with only the LITE required set | Happy Path | Critical | High | AC-F2-1 |
| TC-VGATES-015 | Incomplete, malformed, and missing-target ledgers fail with reused codes and ordered phases | Negative | Critical | High | AC-F2-2, AC-F2-4, NFR-1 |
| TC-VGATES-016 | Platform registry failure is lifecycle unknown and overall unknown with the platform exit | Negative | Critical | High | AC-F2-3, AC-F9-2 |
| TC-VGATES-017 | User-category state failure is lifecycle unknown and overall unknown with the user exit | Negative | Critical | High | AC-F2-3, AC-F9-2 |
| TC-VGATES-018 | A green CI page with every expected job present and succeeded passes | Happy Path | Critical | High | AC-F3-1, AC-F9-1 |
| TC-VGATES-019 | Ticket negative: a red pipeline fails `ci-failed` and cites failed jobs with `failed`/`succeeded`/`runs` counts | Negative | Critical | High | AC-F3-1, DM-11 |
| TC-VGATES-020 | Ticket negative: a missing expected job fails `ci-missing-jobs` | Negative | Critical | High | AC-F3-2, AC-F4-1 |
| TC-VGATES-021 | Ticket negative: a zero-run pipeline fails `ci-no-runs` | Negative | Critical | High | AC-F3-3 |
| TC-VGATES-022 | Ticket negative: an all-skipped pipeline fails `ci-all-skipped` even with an extra success | Negative | Critical | High | AC-F3-3 |
| TC-VGATES-023 | Pending and canceled runs fail with their own reasons | Negative | Critical | High | AC-F3-4 |
| TC-VGATES-024 | A check-run page at the 100-run limit is `unknown` (`ci-truncated`) | Corner Case | Critical | High | AC-F3-4 |
| TC-VGATES-025 | Every invalid expected set fails `ci-expected-jobs-invalid` with no observed-name fallback | Negative | Critical | High | AC-F4-1 |
| TC-VGATES-026 | Expected-set extraction, exact matching, extra runs, and duplicate observed names follow Appendix F | Corner Case | Critical | High | AC-F4-1, AC-F3-2 |
| TC-VGATES-027 | An unresolved head SHA fails `head-unresolved` without a check-run read | Negative | Critical | High | AC-F3-1, AC-F8-1 |
| TC-VGATES-028 | Ticket negative: a push-parity mismatch fails and cites both SHAs | Negative | Critical | High | AC-F5-1 |
| TC-VGATES-029 | Equal head SHAs pass `parity-matched` with branch, both SHAs, and PR | Happy Path | Critical | High | AC-F5-1 |
| TC-VGATES-030 | Detached, missing-head, zero-PR, ambiguous-PR, and lone non-matching-PR parity failures; at-limit is covered by TC-VGATES-060 | Negative | Critical | High | AC-F5-2, DM-13 |
| TC-VGATES-031 | Non-404 parity provider read failure or unresolved binding is `unknown` | Negative | Critical | High | AC-F5-2, AC-F11-1 |
| TC-VGATES-032 | No owner-attention label passes `owner-gate-absent` | Happy Path | Critical | High | AC-F6-1 |
| TC-VGATES-033 | Ticket negative: an owner-attention label fails `owner-gate-present` in contract order | Negative | Critical | High | AC-F6-1 |
| TC-VGATES-034 | Owner gate never passes on a malformed, HTTP-404-absent, or unread work item; `ticket-unresolved` versus `unknown`; label-only signal declared | Negative | Critical | High | AC-F6-2, DM-4, DM-14 |
| TC-VGATES-035 | A ready PR passes squash preflight and cites `squash-signals` (`draft=false`, `mergeable=mergeable`) | Happy Path | Critical | High | AC-F7-1, DM-5, DM-11 |
| TC-VGATES-036 | Ticket negative: bad squash preflight (wrong base, draft, merged, or closed) fails with the matching reason and preserves `squash-signals` | Negative | Critical | High | AC-F7-2, DM-11 |
| TC-VGATES-037 | Ticket negative: bad squash preflight (conflicting or not-mergeable) fails with the matching reason and `squash-signals` value | Negative | Critical | High | AC-F7-2, DM-11 |
| TC-VGATES-038 | Ticket negative: bad squash preflight (unknown/absent mergeability and zero/absent surface) fails and renders `mergeable=unknown` | Negative | Critical | High | AC-F7-3, DM-11 |
| TC-VGATES-039 | Non-404 provider read failure across gates is `unknown`, never a pass; an unread PR detail yields an empty `squash-signals` list with omitted counts; 404 cases are owned by TC-VGATES-067/068 | Negative | Critical | High | AC-F3-6, AC-F5-2, AC-F6-2, AC-F7-3, AC-F11-1, DM-5 |
| TC-VGATES-040 | Every gate verdict carries a complete citation; squash citations carry two ordered `squash-signals` tokens after a successful detail read and an empty list with omitted counts when no usable detail was read | Regression | Critical | High | AC-F8-1, DM-5, DM-11 |
| TC-VGATES-041 | Citation bounds, ordering, redaction, and determinism hold | Regression | Critical | High | AC-F8-1, NFR-5, NFR-9 |
| TC-VGATES-042 | The failure summary grammar, five preserved gate lines, squash-signal names, bounds, and replay equality hold; no failure `data` | Regression | Critical | High | AC-F1-3, AC-F8-2, DM-6, NFR-3, NFR-4 |
| TC-VGATES-043 | The human success report is exactly six deterministic lines | Regression | Critical | High | AC-F10-2, NFR-9 |
| TC-VGATES-044 | Machine success is one valid envelope with the full report and the byte bound | Regression | Critical | High | AC-F10-1, NFR-4, NFR-5 |
| TC-VGATES-045 | Overall derivation is pass only when all five pass | Regression | Critical | High | AC-F9-1 |
| TC-VGATES-046 | The exit and failure-identity matrix is total and envelope-exclusive | Regression | Critical | High | AC-F9-2, NFR-4 |
| TC-VGATES-047 | Error-table documented rows and machine rows stay in two-way sync | Regression | Critical | High | AC-F9-3, NFR-7 |
| TC-VGATES-048 | Credential-reference composition guard: refused or missing credentials never pass | Negative | Critical | High | AC-F11-1 |
| TC-VGATES-049 | Non-404 network, transport, and payload failures are `unknown` with no retries; HTTP 404 is handled by TC-VGATES-061 | Negative | Critical | High | AC-F11-1 |
| TC-VGATES-050 | An unresolved repository binding makes every provider-backed gate `unknown` | Negative | Critical | High | AC-F11-1 |
| TC-VGATES-051 | The command is read-only and honors the read budget | Regression | Critical | High | AC-F11-2, NFR-2 |
| TC-VGATES-052 | Replay over identical injected facts is byte-identical | Regression | Critical | High | AC-F11-2, NFR-3 |
| TC-VGATES-053 | Pure evaluation stays within the performance bound | Regression | Important | Medium | NFR-8 |
| TC-VGATES-054 | GitHub PR detail normalizes the four gate facts, their absence, and the mergeability precedence | Happy Path | Critical | High | AC-F7-3, AC-F12-1 |
| TC-VGATES-055 | Trap catalog gains all required entries, four-field shape, and bidirectional coverage | Regression | Critical | High | AC-F12-1, AC-F14-1, DM-14 |
| TC-VGATES-056 | GitHub trap payloads replay to the declared gate facts under the catalog fixture location | Regression | Critical | High | AC-F12-1, DM-14 |
| TC-VGATES-057 | Corpus completeness meta-check covers every gate, verdict, reason, and ticket case | Regression | Critical | High | AC-F14-1, NFR-10 |
| TC-VGATES-058 | Negative controls and non-vacuity: empty, wrong, missing, or fabricated `squash-signals` fixtures fail the suite | Regression | Critical | High | AC-F14-1, NFR-1 |
| TC-VGATES-059 | Default CI makes zero live calls; the opt-in live smoke is structural only | Regression | Critical | High | AC-F14-1, NFR-10 |
| TC-VGATES-060 | An open-PR page at `VERIFY_GATES_OPEN_PR_LIMIT` is `ambiguous-open-pr` with or without a match, for both parity and squash | Corner Case | Critical | High | AC-F1-2, AC-F5-3, AC-F7-2, AC-F14-1, DM-9, DM-13, NFR-1 |
| TC-VGATES-061 | HTTP 404 absence is read-specific: PR-list/work-item absence is a definitive `fail`, a matched PR-detail 404 is `head-unresolved`/`absent` for every detail-consuming gate, a check-run 404 is `unknown` `read-failed`/`absent`, and other failures are `unknown` | Negative | Critical | High | AC-F3-5, AC-F3-6, AC-F5-2, AC-F5-4, AC-F6-2, AC-F7-2, AC-F11-1, AC-F14-1, DM-14, NFR-1 |
| TC-VGATES-062 | The lifecycle citation consumes structured `VerifyLedgerEvaluation` on every outcome, honors DM-15 failure-path fields, and never parses a summary | Regression | Critical | High | AC-F2-1, AC-F2-2, AC-F2-4, DM-11, DM-15, NFR-3 |
| TC-VGATES-063 | Shared `humanText` dispatch renders six gate lines for gates and preserves `verify change` bytes via `humanText: undefined`; machine mode unchanged; a planted JSON-escaping-sensitive secret is redacted in both streams | Regression | Critical | High | AC-F10-2, AC-F10-3, DM-12, NFR-3, NFR-4, NFR-9 |
| TC-VGATES-064 | Mergeability precedence is deterministic, including `mergeable === true` with blocked/behind/unstable/draft state | Regression | Critical | High | AC-F7-2, AC-F7-3, AC-F12-1, DM-7, DM-11, NFR-1 |
| TC-VGATES-065 | Workspace inventories register the new contract module and every new export | Regression | Critical | High | AC-F13-1, NFR-6 |
| TC-VGATES-066 | The new verify-gates feature doc is registered in the forbidden-literal corpus | Regression | Critical | High | AC-F13-1, NFR-9 |
| TC-VGATES-067 | A matched PR-detail 404 makes CI, parity, and squash all fail `head-unresolved` with source `absent`; other detail failures stay `unknown` | Negative | Critical | High | AC-F3-5, AC-F5-4, AC-F7-2, AC-F11-1, AC-F14-1, DM-14, NFR-1 |
| TC-VGATES-068 | A check-run 404 is source `absent` and `unknown` `read-failed`, never `failed` and never `ci-no-runs` | Negative | Critical | High | AC-F3-6, AC-F11-1, AC-F14-1, DM-14, NFR-1 |
| TC-VGATES-069 | New domain symbols import from the `@delivery-os/core` package root and one verify definition accepts the combined `change`+`gates` runtime; `verify change` bytes stay identical | Regression | Critical | High | AC-F1-1, AC-F10-3, AC-F13-1, DM-12, NFR-6 |
| TC-VGATES-070 | CI counts use the declared denominators, no double-bucketing, and an unrecognized run state cannot pass | Regression | Critical | High | AC-F3-1, AC-F3-3, DM-11, NFR-1 |

All seventy TCs are automated in the default suite. Every TC is non-vacuous: controls and seeded violations are named in §4.2 and in each scenario. TC-VGATES-059 additionally includes one opt-in, credential-gated live execution; it is not part of `pnpm check`.

### 5.2 Scenario Details

#### TC-VGATES-001 - Gate vocabulary, reasons, sources, constants, and bounds are one data contract

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-13, DM-2, DM-3, DM-4, DM-5, DM-9, DM-11, DM-12, DM-13, DM-14, DM-15, AC-F1-3, AC-F13-1, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-contract.test.ts`
**Tags**: @backend @contract

**Preconditions**:
- The new `core ./contracts` verify-gates module is present and exports the gate order, verdicts, reasons, sources, outcomes, count names, name kinds, schema version, and constants as `as const` data.
- The spec Appendices A, B, C, and D and the Section 8.3 gate mapping are the oracle.

**Steps**:
1. Assert `VERIFY_GATES_GATE_ORDER` equals exactly `["lifecycle-finalization", "ci-green", "push-parity", "owner-gate", "squash-preflight"]` in that order; assert no duplicate and length 5.
2. Assert `VERIFY_GATES_VERDICTS` equals exactly `["pass", "fail", "unknown"]`; assert `VERIFY_GATES_SCHEMA_VERSION === "delivery.verify-gates.v1"`.
3. Assert the reason set equals the 35 closed reasons in DM-4 exactly (no extra, none missing, no duplicates) and that each gate's allowed-reason subset equals the Section 8.3 mapping. Assert `read-failed`, `credential-unavailable`, `address-unresolved`, `no-open-pr`, `ambiguous-open-pr`, `branch-unresolved`, and `head-unresolved` appear only in the gates the table declares.
4. Assert the eight source names, six source outcomes, per-gate count names, and per-gate name kinds equal the declared mapping; assert each gate's source list length is 1..3 and each count/name declaration is in contract order.
5. Assert the declared constants and bounds equal Appendix C: integration base `main-tools`, workflow path `.github/workflows/ci.yml`, open-PR page limit 100, check-run page limit 100, max expected jobs 200, max expected job name 120, workflow bytes 262144, max citation names 8, max name chars 120, max ref chars 120, max summary lines 6, max summary bytes 4096, max machine bytes 65536; assert only the new `VERIFY_GATES_*` constants are declared here and the status constants are referenced, not duplicated.
6. Assert `STATUS_OWNER_ATTENTION_LABELS` is imported or re-exported from the status contract and is not duplicated; assert `STATUS_CI_RESULTS` includes `none` and `unknown`, and that `none` is not treated as green. Assert the `OpenPrResolution` outcome set and the `VerifyLedgerEvaluation` outcome/variant fields are declared as contract data.
7. Negative control: deep-copy the gate order, reverse it, and assert a helper that validates order reports a violation; assert the unmutated value validates. This proves the assertions are live.

**Expected Outcome**:
- One data contract owns every gate id, order, verdict, reason, source, outcome, count, name kind, constant, and bound; the values equal the spec appendices and the Section 8.3 mapping; no free-form reason or duplicate vocabulary exists.

#### TC-VGATES-002 - Contracts are data-only; the domain is pure and imports only contracts plus the verify-change module

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-imports.test.ts`
**Tags**: @backend @structure

**Preconditions**:
- The new contracts module and the pure verify-gates domain module exist; the existing `tests/structure/verify-imports.test.ts` AST detector pattern is available.
- The existing verify-change domain module is the only permitted domain dependency.

**Steps**:
1. Parse the contracts verify-gates module and assert it contains no call expressions, no I/O imports (`node:fs`, `node:net`, `node:http`, `Bun`, provider SDKs), and no runtime conditionals beyond type/data declarations.
2. Parse the domain verify-gates module and assert its imports are limited to `core ./contracts` and the existing verify-change domain module; assert no import from adapters, CLI, state, file, process, or provider modules.
3. Assert the domain contains no `process`, `Bun`, `Date`, `Math.random`, `crypto`, `fetch`, `setTimeout`, `node:fs`, or `node:child_process` reference; every fact is a parameter.
4. Assert ordering is read from contract arrays: a source-order and gate-order assertion proves no `Object.keys`, `Map` iteration, or `sort` decides output order in the domain.
5. Negative control: run the same detectors against an in-memory snippet containing `process.env` and `Date.now()` and assert both are reported; run against the real module and assert an empty violation list.

**Expected Outcome**:
- The contracts carry data only; the domain is pure and imports only contracts plus the verify-change module (the structured evaluator and its types); no ambient, clock, randomness, network, file, or spawn access exists; ordering comes from contract arrays.

#### TC-VGATES-003 - DeliveryRequest additive gate facts are optional and absent-safe

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-7, AC-F12-1, NFR-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/delivery-request-gate-facts.test.ts`
**Tags**: @backend @contract

**Preconditions**:
- The `DeliveryRequest` primitive is extended with optional `sourceHeadSha`, `mergeableState` (`mergeable` | `conflicting` | `not-mergeable` | `unknown`), `commitCount`, and `changedFileCount`.
- The existing adapter-port subpath exports and the closed operation set are unchanged.

**Steps**:
1. Type-level assertions: a `DeliveryRequest` with all four fields, with none, and with each subset is valid; `mergeableState` rejects any string outside the closed union.
2. Assert the fields are optional (not required) so other provider seeds still compile without them, following `tests/structure/port-carrier-types.test.ts`.
3. Assert absence is not defaulted: a helper that reads the fields returns `undefined` for absent values and does not coerce to `mergeable` or to a non-zero count.
4. Assert no new exported provider-native type, no new adapter operation, and no new subpath export name crossed the adapter boundary; compare against the inventory.
5. Negative control: an in-memory type assertion with a required `sourceHeadSha` and a fabricated default count is rejected by the test's compile-time or helper check.

**Expected Outcome**:
- The four gate facts are additive optional primitive fields; absence means unknown, never mergeable and never non-empty; the operation set, exports, and subpaths are unchanged.

#### TC-VGATES-004 - The two additive verify error rows and the unchanged ledger row are exact and classified

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-8, AC-F9-3, NFR-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (extended)
**Tags**: @backend @contract

**Preconditions**:
- `ERROR_TABLE` has the two new rows under the existing `verify` kind and the unchanged `verify.ledger.incomplete` row.
- The documented table in `doc/spec/features/feature-result-contract.md` is the two-way oracle.

**Steps**:
1. Assert the `verify` kind has exactly three rows: `verify.ledger.incomplete`, `verify.gates.failed`, `verify.gates.unavailable`.
2. Assert `verify.gates.failed` has domain kind `verify`, category `user`, retryable `false`, consequence `not_landed`, projection class `user-validation`, exit `1`, and the declared summary/remediation text.
3. Assert `verify.gates.unavailable` has domain kind `verify`, category `platform`, retryable `false`, consequence `not_landed`, projection class `platform-provider`, exit `2`, and the declared summary/remediation text.
4. Assert `verify.ledger.incomplete` is byte-identical to the pre-change row (golden row fixture).
5. Assert exact-code classification resolves both new codes and the existing code; assert no kind-only `verify` selection is ambiguous; assert every reachable `verify` code maps to exactly one row.
6. Negative control: in a deep copy, remove one new row and assert the classifier reports the code unresolved; in a second copy, change a field and assert the documented-sync check fails.

**Expected Outcome**:
- The `verify` kind has exactly three exact-code rows; the two new rows match the spec table and their projection classes/exits; the existing row is unchanged; classification is total and unambiguous.

#### TC-VGATES-005 - No new package, subpath, runtime-API location, or dependency

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/port-contract-inventory.test.ts`, `scripts/checks/workspace-entrypoints.ts`
**Tags**: @backend @structure

**Preconditions**:
- Baseline package manifests, subpath exports, runtime-API allowlist, and the workspace inventory are recorded.
- The new verifier adds modules under existing `core ./contracts`, `core ./domain`, `adapters ./github`, `adapters ./file`, and `cli` locations only.

**Steps**:
1. Assert there are still exactly six workspace packages and no new package manifest.
2. Assert the subpath export names and declared entrypoints are unchanged; assert the new modules live under existing subpaths.
3. Assert the runtime-API allowlist and location count are unchanged and `workspaceImports`/declared cross-package edges are unchanged.
4. Assert `package.json` dependency sets are unchanged (no new dependency); assert the changeset is a minor changeset for the affected existing packages.
5. Run `bun run scripts/checks/workspace-entrypoints.ts` and assert exit 0.
6. Negative control: in a temp copy, add a fake subpath or package-name import and assert the entrypoint check exits non-zero and names it.

**Expected Outcome**:
- No new package, subpath, declared entrypoint, runtime-API location, workspace edge, or dependency is introduced; inventory and entrypoint checks are green; the mutation is detected.

#### TC-VGATES-006 - Ambient, forbidden-literal, privacy, brand, and secret-read invariants hold

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-9
**Test Type(s)**: Contract, Security
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ambient-globals.ts`, `scripts/checks/forbidden-literals.ts`, `scripts/checks/privacy-literals.ts`, `scripts/checks/secret-read-boundary.ts`; `tests/checks/*` mutation suites
**Tags**: @backend @structure @security

**Preconditions**:
- The new verify-gates modules, docs, fixtures, and tests are in the tree.
- The secret-read allowlist has exactly four entries; the product/binary literal policy is active.

**Steps**:
1. Run the ambient-globals check and assert zero ambient reads in contracts/domain; assert the runtime edge reads only delivered ports.
2. Run the forbidden-literals and privacy-literals checks and assert no product/binary literal (for example a hardcoded `ados`) and no cloud or vendor name is committed in the new files; the human header uses the injected brand.
3. Run the secret-read boundary check and assert the allowlist is still exactly four entries; assert no new credential-material path or environment prefix exists.
4. Assert the new GitHub host literal is limited to the declared `github.com` host and the declared credential key; assert no other provider-native literal crosses the contract or domain.
5. Negative control: in a temp copy, plant a forbidden literal, an ambient read, and a fifth secret read; assert each check exits non-zero and names the offending field. The unmutated checks are green.

**Expected Outcome**:
- Ambient, forbidden-literal, privacy, brand, and secret-read gates are green; the allowlist stays at four; a planted violation is detected by each checker.

#### TC-VGATES-007 - Boundary rules and the fixture-coverage meta-check stay green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/**`, `.dependency-cruiser.cjs`, `tests/boundaries/fixture-registry.json`
**Tags**: @backend @boundary

**Preconditions**:
- The new contracts/domain/adapters/CLI modules are placed in their existing tiers.
- No new boundary rule is added; if one is added, a matching failing fixture must land in the same change.

**Steps**:
1. Run `bun test tests/boundaries` and assert `depcruise packages` reports zero violations for the new modules.
2. Assert the fixture-coverage meta-check reports every rule covered by at least one failing fixture; assert no rule is unenforced.
3. Assert the new domain module has no edge to adapters/CLI/state and that `adapters ./file` and `adapters ./github` edges are already admitted.
4. Assert the fixture registry has no duplicate or stale fixture entry and that the new test fixtures are not named `*.test.ts` (so they are not discovered as suites).
5. Negative control: in a temp copy, add an unapproved domain-to-adapter import and assert the boundary suite fails; remove a fixture and assert the coverage meta-check fails.

**Expected Outcome**:
- All boundary and fixture-coverage gates are green; the new modules respect tiers; an unapproved edge or an uncovered rule is detected.

#### TC-VGATES-008 - Grammar is rejected before any read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-8, AC-F1-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-surface.test.ts`, `tests/fixtures/verify-gates/composition/grammar/**`
**Tags**: @backend @cli

**Preconditions**:
- A recording runtime whose every read (pm-notes, registry, repository facts, workflow, GitHub transport, credential port) throws if called.
- Invocation fixtures: `verify gates` (no ref), `verify gates ""`, `verify gates GH-178 extra`, `verify gates --gate ci-green GH-178`, `verify wat GH-178`, and plain `verify`.

**Steps**:
1. Run each invocation in process with and without `--json`; assert the exit is `1` and exactly one error-only envelope is emitted.
2. Assert the handler grammar cases (missing/empty ref, wrong subcommand such as `wat`, and plain `verify` with no subcommand) carry `input.value.rejected`; assert only the parser-shape cases (a third positional and an unknown flag such as `--gate`) carry `fallback.invocation`. Do not classify plain `verify` as `fallback.invocation`; it has no subcommand and is rejected by the handler grammar.
3. Assert no `data`, no success text, no `fallback.internal`, and no raw parser stack.
4. Assert the read recorder observed zero reads for every rejection; assert no temp directory, state file, or output file was created.
5. Positive control: run the well-formed `verify gates GH-178` with the same recorder and assert it observes the expected reads, proving the zero-read assertion is live.
6. Regression control: run `verify change GH-178` and assert its grammar and behaviour are unchanged.

**Expected Outcome**:
- Every malformed invocation is rejected before any source read with the declared identity — handler grammar (`input.value.rejected`) for a missing/empty ref, a wrong subcommand, or plain `verify`, and parser shape (`fallback.invocation`) only for a third positional or an unknown flag — with exit 1, an error-only envelope, and no side effect; the well-formed invocation still reads.

#### TC-VGATES-009 - Accepted grammar: one ref, no PR-number or command flags, global `--json`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-1, AC-F1-1, AC-F1-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-surface.test.ts`
**Tags**: @backend @cli

**Preconditions**:
- The `verify` command definition exposes exactly the subcommands `change` and `gates`; `gates` takes one positional and no command-specific flags.
- An all-pass fixture with a valid change ref and a matching open PR.

**Steps**:
1. Run `verify gates GH-178` in human mode; assert it is accepted and returns one report with exit 0.
2. Run `verify gates GH-178 --json`; assert one valid envelope and the `delivery.verify-gates.v1` data.
3. Assert no command-specific flag is accepted: `--gate`, `--watch`, `--pr`, `--repo`, and `--cached` are rejected by the parser.
4. Assert no PR-number argument path exists: `verify gates 178` is treated as a change ref (and fails ref resolution) rather than selecting PR 178; `verify gates GH-178 178` is a third-positional parser failure.
5. Assert `verify change GH-178` still accepts its current grammar and produces its current output; only the subcommand set grew.
6. Assert the report's `target` is `gates` and the change ref is echoed.

**Expected Outcome**:
- The accepted surface is exactly `verify gates` plus one non-empty ref and the global `--json`; no PR-number or command-specific flags exist; `verify change` is unchanged.

#### TC-VGATES-010 - Exactly five gates evaluate in fixed order with no short-circuit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-2, DM-6, AC-F1-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-surface.test.ts`, `tests/fixtures/verify-gates/corpus/**`
**Tags**: @backend

**Preconditions**:
- Five fixtures, each with exactly one gate failing or unknown and the other four passing.
- A recording runtime that observes each gate's source reads.

**Steps**:
1. For each fixture, assert the report contains exactly five gate records in `VERIFY_GATES_GATE_ORDER`; assert no gate id is missing, duplicated, or reordered.
2. Assert each record has `id`, `verdict`, `reason`, and a non-empty citation; assert the summary counts sum to 5.
3. Assert the recorder observed the reads for every gate even when the first gate failed; assert a failing lifecycle gate does not prevent the CI, parity, owner, or squash reads.
4. Assert exactly five internal gate records always exist, including on a failure report: the evaluator's five records are the source of the five summary lines. Assert the failure summary has exactly one line per gate in order (five gate lines) and that the failure envelope carries no `data` (the five records survive only as those lines).
5. Negative control: a short-circuiting stub that stops after the first failure yields fewer than five lines or records and fails the assertion; the real evaluator yields all five.
6. Assert a success report also contains exactly five records and that a failure report never gains `data`.

**Expected Outcome**:
- Every evaluation reports exactly five internal gate records in fixed order with citations, with no short-circuit on failure or unknown; on failure those records are preserved as the five bounded summary lines and never as `data`.

#### TC-VGATES-011 - Attached branch resolves the unique matching open PR; zero, multiple, and non-matching PRs fail with their declared reasons

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-7, DM-2, DM-13, AC-F1-2, AC-F5-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-target.test.ts`
**Tags**: @backend

**Preconditions**:
- Repository facts: attached branch `feat/GH-178/verify-gates-v1`, full HEAD SHA, `origin` bound to GitHub.
- Open-PR list fixtures: (a) one PR with `sourceRef` equal to the branch; (b) zero open PRs; (c) two PRs with the same `sourceRef`; (d) one open PR with a different `sourceRef`.
- The at-limit page cases (exactly `VERIFY_GATES_OPEN_PR_LIMIT` raw entries, with and without a match) are covered by TC-VGATES-060 so this scenario exercises only the below-limit resolution paths.

**Steps**:
1. Run the unique-match case; assert the matched PR number is used by CI, parity, and squash; assert the lifecycle and owner gates still run.
2. Run the zero-PR case; assert parity and squash both fail `no-open-pr` (source `observed-empty`), CI fails `head-unresolved`, and the overall result is `fail`; assert no PR detail or check-run read.
3. Run the multiple-match case; assert parity and squash both fail `ambiguous-open-pr`; assert no arbitrary first-match selection; assert the failure is definitive (`fail`, not `unknown`).
4. Run the lone non-matching case; assert parity and squash both fail `branch-mismatch` (not `no-open-pr`), the resolution evidence records `openCount=1` and `matchCount=0`, and no fallback to a branch-name-only match occurs.
5. Assert the open-PR page read is one bounded page at the declared limit and no pagination is attempted.
6. Negative control: the unique match passes; the same fixture with a second matching PR fails `ambiguous-open-pr`; adding a matching PR to the lone non-matching fixture resolves it.

**Expected Outcome**:
- An attached branch selects exactly one matching open PR; zero open PRs fails `no-open-pr`, a lone non-matching open PR fails `branch-mismatch`, and multiple matches fail `ambiguous-open-pr`, for both parity and squash; no PR-number argument or arbitrary selection exists.

#### TC-VGATES-012 - Detached HEAD fails branch-dependent gates without a PR read; lifecycle and owner still run

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-2, AC-F5-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-target.test.ts`, `tests/behaviour/verify-gates-lifecycle.test.ts`
**Tags**: @backend

**Preconditions**:
- Repository facts: detached HEAD with a full SHA and no branch.
- A readable work item and a complete ledger, so the lifecycle and owner gates could pass.
- A recording GitHub transport.

**Steps**:
1. Run the detached fixture; assert `push-parity` fails `branch-unresolved` and `squash-preflight` fails `branch-unresolved`.
2. Assert the squash citation's `squash-signals` name list is empty (not fabricated or defaulted), its delivery-request-detail source outcome is `not-attempted`, and its reason/source names the `branch-unresolved` prerequisite (detail not read).
3. Assert `ci-green` fails `head-unresolved` (no PR head SHA can be resolved) and never passes; assert no check-run read is issued.
4. Assert the open-PR list or detail is not read for target resolution; assert zero outbound GETs for the branch-dependent gates.
5. Assert `lifecycle-finalization` is still evaluated and may pass; assert `owner-gate` is still evaluated from the work item.
6. Assert the overall result is `fail` (not `unknown`, not `pass`) and exit 1; assert all five citations are present.
7. Negative control: the attached-branch fixture with the same facts passes parity and squash, proving the detached failure is not a global short-circuit.

**Expected Outcome**:
- A detached HEAD is a definitive gate failure for branch-dependent gates, never a vacuous pass; no PR read is attempted; the squash citation carries an empty `squash-signals` list with the prerequisite reason; the local lifecycle gate and owner gate still run.

#### TC-VGATES-013 - A complete full ledger passes lifecycle finalization

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-5, DM-11, DM-15, AC-F2-1, AC-F2-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/fixtures/verify-gates/lifecycle/full/**`
**Tags**: @backend

**Preconditions**:
- A full ledger: `variant` absent or `full`, all eleven canonical required phases present and completed; a verified registry with transition history for at least one phase.
- All other gates injected as passing so the lifecycle verdict is isolated.

**Steps**:
1. Run the fixture; assert `lifecycle-finalization` is `pass` with reason `lifecycle-complete`.
2. Assert the citation identity carries `changeRef`; assert the sources are `pm-notes:read` and `delivery-registry:read` in order.
3. Assert counts `required=11`, `completed=11`, `missing=0`, `registryRecords` and `registryTransitions` are non-negative integers, and `overlaid` matches the registry-decided phases.
4. Assert the `missing-phases` name list is empty or absent and the reasons array contains `lifecycle-complete`.
5. Assert the gate consumes the structured `EvaluateVerifyChange` → `VerifyLedgerEvaluation` contract: a spy on `EvaluateVerifyChange` (or the injected structured evaluation) observes the call and its returned fields drive the citation. Assert the gate does not call `classifyVerifyChange` and does not parse the classifier summary; `classifyVerifyChange` is exercised only as a byte-preserving wrapper in TC-VGATES-062, not as a dependency of the gate.
6. Negative control: changing one required phase to incomplete yields `lifecycle-incomplete` (see TC-VGATES-015), proving the pass is not hardcoded.

**Expected Outcome**:
- A complete full ledger passes `lifecycle-complete` with correct counts, registry evidence, and an empty missing set; the structured evaluator is actually invoked and the classifier wrapper is not a gate dependency.

#### TC-VGATES-014 - A complete LITE ledger passes with only the LITE required set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-5, DM-11, AC-F2-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/fixtures/verify-gates/lifecycle/lite/**`
**Tags**: @backend

**Preconditions**:
- A LITE ledger with `variant: lite`, the six LITE required phases complete, and the five non-LITE phases absent or null.
- A control where a non-LITE phase is incomplete but the LITE required set is complete.

**Steps**:
1. Run the LITE fixture; assert `lifecycle-finalization` passes with reason `lifecycle-complete`, `variant: lite`, `required=6`, `completed=6`, `missing=0`.
2. Assert only the six LITE phase ids are considered; assert the five non-LITE ids never appear in the missing list or the required count.
3. Assert the non-LITE-incomplete control still passes (non-required phases are not enforced).
4. Assert a full-variant control missing `dor_check` fails, proving the relaxation is variant-gated.
5. Assert the citation's effective variant is `lite`; assert the required phases are in canonical LITE relative order.
6. Negative control: opening one LITE phase yields `lifecycle-incomplete` naming that phase.

**Expected Outcome**:
- LITE finalization requires exactly the six LITE phases and ignores the rest; the full variant still enforces its eleven; the effective variant is cited.

#### TC-VGATES-015 - Incomplete, malformed, and missing-target ledgers fail with reused codes and ordered phases

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-4, DM-5, DM-15, AC-F2-2, AC-F2-4, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/fixtures/verify-gates/lifecycle/incomplete/**`
**Tags**: @backend

**Preconditions**:
- Full single-missing, full multi-missing, LITE single-missing, malformed pm-notes, missing target, and registry-overlay fixtures (declaration-only stale versus registry reopen).
- Restored controls for each.

**Steps**:
1. Run each incomplete fixture; assert `lifecycle-finalization` is `fail` with reason `lifecycle-incomplete` and the reused `verify.ledger.incomplete` code; assert the missing phases are in required-set order, not insertion order.
2. Run malformed notes and missing-target fixtures; assert `lifecycle-incomplete` with the reused `lint.notes.malformed` or `lint.target.missing` code; assert the citation's required/completed/missing phase arrays are empty, declaration counts are zero, and the document failure identity is named, with source outcome `failed` for malformed notes and `absent` for a missing target; assert no crash and no `fallback.internal`.
3. Run the overlay fixtures: registry latest `complete` over a null declaration passes; registry latest `reopen` over a complete declaration fails naming the phase; assert the registry wins in both directions.
4. Assert an absent per-change registry record is not `state.keys.missing`; the declaration fallback decides.
5. Assert the overall result is `fail` with `verify.gates.failed`, exit 1; assert no success envelope and no `data`.
6. Controls: restoring the missing phase yields `lifecycle-complete`; a declaration-only and a registry-required implementation each produce a different answer and fail the fixture.

**Expected Outcome**:
- Every incomplete, malformed, or missing-target ledger fails `lifecycle-incomplete` with the reused code and ordered missing phases; the registry overlay wins in both directions; restored controls pass.

#### TC-VGATES-016 - Platform registry failure is lifecycle unknown and overall unknown with the platform exit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, DM-4, AC-F2-3, AC-F9-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/fixtures/verify-gates/lifecycle/state-platform/**`
**Tags**: @backend

**Preconditions**:
- A complete declaration (so a broken registry must override a would-be pass).
- A torn store and a schema-mismatched registry, built with the real state harness over a temp root.

**Steps**:
1. Run the torn-store fixture; assert `lifecycle-finalization` is `unknown` with reason `lifecycle-unverifiable` and the underlying `state.store.torn` code; assert the source is `delivery-registry:failed` with the code.
2. Run the schema-mismatch fixture; assert `lifecycle-unverifiable` with the underlying `state.*` code.
3. Inject all other gates as passing; assert the overall result is `unknown`, the failure identity is the first unknown gate's resolvable code (`state.store.torn`), and the exit is 2.
4. Assert no gate passes, no success envelope is emitted, and `data` is absent.
5. Assert the lifecycle citation still carries the declaration-derived required/completed/missing arrays and counts, the effective variant, and registry evidence with a failed/torn outcome; assert the evaluation outcome is `state-unverified` and it maps deterministically to lifecycle `unknown`.
6. Negative control: a verified-empty registry with a complete declaration passes; a user-category failure takes TC-VGATES-017's exit.

**Expected Outcome**:
- Platform registry or store failure makes lifecycle `unknown` with the underlying `state.*`; the overall unknown reuses that identity and exits 2; nothing passes.

#### TC-VGATES-017 - User-category state failure is lifecycle unknown and overall unknown with the user exit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, DM-4, AC-F2-3, AC-F9-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/fixtures/verify-gates/lifecycle/state-user/**`
**Tags**: @backend

**Preconditions**:
- A complete declaration and a user-category state failure fixture (for example a permission-denied registry read).
- All other gates injected as passing.

**Steps**:
1. Run the fixture; assert `lifecycle-finalization` is `unknown` with reason `lifecycle-unverifiable` and the underlying user-category `state.*` code.
2. Assert the overall result is `unknown`, the failure identity reuses the user-category code, and the exit is 1 (not 2).
3. Assert the failure-identity precedence uses the first unknown gate in fixed order (lifecycle is first) and does not fall back to `verify.gates.unavailable`.
4. Assert no `data`, no success text, and no gate pass.
5. Assert the citation names the failed source and the code; assert the missing/required counts are still present where known.
6. Negative control: the same declaration with a readable registry passes; a platform failure takes exit 2 (TC-VGATES-016), proving the split.

**Expected Outcome**:
- A user-category state failure makes lifecycle `unknown`; the overall unknown reuses the user identity and exits 1; it is never confused with the platform exit.

#### TC-VGATES-018 - A green CI page with every expected job present and succeeded passes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, DM-10, DM-11, AC-F3-1, AC-F9-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/green/**`
**Tags**: @backend

**Preconditions**:
- A resolved head SHA; a valid workflow with 23 unique job display names; a check-run page with the 23 runs all `succeeded` (page size below 100).
- All other gates injected as passing.

**Steps**:
1. Run the fixture; assert `ci-green` is `pass` with reason `ci-green`.
2. Assert counts `expected=23`, `runs=23`, `succeeded=23`, `failed=0`, `pending=0`, `skipped=0`, `canceled=0`, `missing=0`; assert `expected` and `missing` are over the expected set, `runs` is the observed normalized page size, and the state counts are observed per-run buckets that sum to `runs` with no run counted twice; assert name lists are empty.
3. Assert sources are `repository-ci-workflow:read`, `github-delivery-request-detail:read`, `github-check-runs:read` in order.
4. Assert the check-run read used the resolved head SHA and one page at the declared limit with no pagination.
5. Negative control: remove one expected run (TC-VGATES-020), add a failed extra run (TC-VGATES-019 or TC-VGATES-026), or use an empty expected set (TC-VGATES-025); each must fail, proving the pass is not vacuous.
6. Assert an extra green non-expected run does not fail the gate, increments `runs` and `succeeded` exactly once, and does not change `expected`/`missing`; the exact denominator and unrecognized-state matrix is owned by TC-VGATES-070.

**Expected Outcome**:
- A complete, non-truncated, all-succeeded page with every expected job present passes `ci-green`; extra green runs are tolerated; the counts and sources are exact.

#### TC-VGATES-019 - Ticket negative: a red pipeline fails `ci-failed` and cites failed jobs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-5, DM-11, AC-F3-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/red/**`
**Tags**: @backend

**Preconditions**:
- 23 expected jobs; one run `failed` (`TS tests`), 22 `succeeded`.
- A canary in the check-run payload that must not leak.

**Steps**:
1. Run the fixture; assert `ci-green` is `fail` with reason `ci-failed`.
2. Assert the citation's `failed-jobs` list is `["TS tests"]`; assert counts `failed=1`, `succeeded=22`, `runs=23` (the observed page size), `expected=23`, `pending=0`, `skipped=0`, `canceled=0`, `missing=0`; assert the failed run is counted once in `failed` and not also in `succeeded`/`missing` (no double-bucketing), and assert there is no separate `total` count name (AC-F3-1's "total" is `runs`).
3. Assert the overall result is `fail` with `verify.gates.failed`, exit 1; assert no success envelope and no `data`.
4. Assert the other four gates are still evaluated and cited; assert CI makes no green claim.
5. Assert the canary never appears in the report, summary, or human text.
6. Negative control: restoring `TS tests` to `succeeded` yields `ci-green`, proving the red result is live.

**Expected Outcome**:
- A red pipeline is a definitive `ci-failed` with the failed job name and counts, overall `fail`, exit 1; the ticket's first negative case is covered end to end.

#### TC-VGATES-020 - Ticket negative: a missing expected job fails `ci-missing-jobs`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, DM-10, AC-F3-2, AC-F4-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/missing/**`
**Tags**: @backend

**Preconditions**:
- A valid 23-name expected set and a green-looking page with 22 runs; `TS tests` absent.
- A multi-missing fixture with 9 absent jobs to exercise the 8-name cap and the omitted count.
- A canary in the expected-set fixture.

**Steps**:
1. Run the single-missing fixture; assert `ci-green` is `fail` with reason `ci-missing-jobs`.
2. Assert the `missing-jobs` list is `["TS tests"]` and counts `expected=23`, `runs=22`, `missing=1`; assert the list is in expected-set order.
3. Run the multi-missing fixture; assert the list has at most 8 values in expected-set order and `omitted` equals the remainder (for example 8 values plus omitted 1); assert the omitted count is not silently dropped.
4. Assert the overall result is `fail`, exit 1; assert no pass despite the green page.
5. Assert the canary is absent from every output.
6. Negative control: adding the missing run or runs yields `ci-green`, proving the failure is caused by the missing job, not the fixture shape.

**Expected Outcome**:
- A green page missing one or more expected jobs is `ci-missing-jobs` with ordered bounded names and the omitted count; it never passes; the ticket's second negative case is covered end to end.

#### TC-VGATES-021 - Ticket negative: a zero-run pipeline fails `ci-no-runs`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-4, AC-F3-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/no-runs/**`
**Tags**: @backend

**Preconditions**:
- A successful check-runs read returning zero runs; a valid non-empty expected set.
- A control where the same fixture returns the expected runs.

**Steps**:
1. Run the fixture; assert `ci-green` is `fail` with reason `ci-no-runs`.
2. Assert counts `runs=0`, `expected>0`, `succeeded=0`; assert the gate is not `pass` and not `succeeded`.
3. Assert the overall result is `fail`, exit 1; assert no success envelope.
4. Assert the zero-run read is a successful read (`github-check-runs:read` or `observed-empty`), not a `read-failed`; the reason is the vacuous rule.
5. Assert no name list is fabricated from the expected set.
6. Negative control: the control with runs yields `ci-green` or the expected missing/failed result, proving the zero-run path is live.

**Expected Outcome**:
- A successful zero-run read fails `ci-no-runs`; a pipeline with zero jobs never ran and is never green; the ticket's vacuous-green case is covered.

#### TC-VGATES-022 - Ticket negative: an all-skipped pipeline fails `ci-all-skipped` even with an extra success

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-4, AC-F3-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/all-skipped/**`
**Tags**: @backend

**Preconditions**:
- Every expected job reports `skipped`; no expected job reports `succeeded`.
- An extra non-expected run reports `succeeded` (the trap case); a second fixture has no extra run.
- A control where one expected job reports `succeeded` and the rest are skipped, which is not vacuous.

**Steps**:
1. Run the all-skipped fixture; assert `ci-green` is `fail` with reason `ci-all-skipped`.
2. Assert counts over the declared denominators: `expected=23`, `runs=24` with the extra run present (`runs=23` without it), `skipped=23`, `succeeded=1` for the extra non-expected success, `missing=0`, with each observed run in exactly one state bucket; assert no expected job is `succeeded` (the `succeeded` count is the extra non-expected run), and assert the gate is not `pass`.
3. Run the extra-success fixture; assert the extra non-expected success does not change the verdict; the reason stays `ci-all-skipped`.
4. Assert the overall result is `fail`, exit 1; assert no green claim.
5. Run the one-expected-success control; assert it is not `ci-all-skipped` (it may pass if every other condition holds), proving the vacuous rule is precise.
6. Negative control: marking one expected job `succeeded` and the rest skipped removes `ci-all-skipped`; marking every expected job skipped restores it.

**Expected Outcome**:
- All-skipped expected jobs fail `ci-all-skipped` even when an extra non-expected run succeeded; one expected success is not vacuous; the ticket's vacuous-green case is covered.

#### TC-VGATES-023 - Pending and canceled runs fail with their own reasons

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-4, AC-F3-4, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/pending-canceled/**`
**Tags**: @backend

**Preconditions**:
- A green base page (23 expected jobs succeeded) with one mutation per fixture: one `running`, one `queued`, one `canceled`.
- A mixed fixture with one failed, one canceled, and one pending run.

**Steps**:
1. Run the running and queued fixtures; assert `ci-green` is `fail` with reason `ci-pending`; assert the pending job names are cited.
2. Run the canceled fixture; assert `ci-green` is `fail` with reason `ci-canceled`; assert the canceled job names are cited.
3. Run the mixed fixture; assert the primary reason follows the declared precedence `failed` before `canceled` before `pending`, and the citation still carries secondary facts.
4. Assert no pending or canceled outcome is `pass`; assert the overall result is `fail` where any gate fails.
5. Assert the counts distinguish `pending`, `canceled`, and `failed`.
6. Negative control: resolving the pending or canceled run to `succeeded` yields `ci-green`, proving the failure is live.

**Expected Outcome**:
- Running/queued runs fail `ci-pending` and canceled runs fail `ci-canceled`; the mixed precedence is deterministic; none passes.

#### TC-VGATES-024 - A check-run page at the 100-run limit is `unknown` (`ci-truncated`)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-4, AC-F3-4, NFR-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/truncated/**`
**Tags**: @backend

**Preconditions**:
- A check-run page with exactly 100 runs (`VERIFY_GATES_CI_RUN_LIMIT`), including a plausible green subset and possibly a hidden failure or missing job.
- A boundary control with 99 runs, all expected and succeeded.

**Steps**:
1. Run the at-limit fixture; assert `ci-green` is `unknown` with reason `ci-truncated`.
2. Assert the gate is not `pass`, not `fail`, and not `succeeded`; assert the citation names the raw page size or the declared limit.
3. Assert the overall result is `unknown` when no other gate fails; assert the failure identity is the first unknown identity or `verify.gates.unavailable`, and the exit is 2.
4. Assert no pagination request is issued; assert the page is exactly one bounded read.
5. Run the 99-run control; assert it is not `ci-truncated` and, when every expected job is present and succeeded, it passes.
6. Negative control: a page of 100 that also contains one failed run still reports `ci-truncated`, because Appendix A places truncation before any failed run in the CI precedence; assert the precedence is deterministic and matches Appendix A.

**Expected Outcome**:
- A page at the read limit is `unknown` (`ci-truncated`), never a pass; a page below the limit can pass; no pagination is attempted.

#### TC-VGATES-025 - Every invalid expected set fails `ci-expected-jobs-invalid` with no observed-name fallback

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-10, AC-F4-1, NFR-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/workflows/**`
**Tags**: @backend

**Preconditions**:
- One fixture per invalid class: workflow absent; workflow unreadable (permission or size over 262144 bytes); malformed YAML; empty `jobs` map; duplicate display names; more than 200 jobs; one job display name over 120 characters.
- Each fixture is paired with a check-run page that would be green if the observed names were used as the expected set.
- A valid workflow control.

**Steps**:
1. Run each invalid fixture; assert `ci-green` is `fail` with reason `ci-expected-jobs-invalid`.
2. Assert the gate never falls back to the observed run names: feed a green page and assert the verdict remains `ci-expected-jobs-invalid`, not `ci-green`.
3. Assert the source `repository-ci-workflow` outcome is `failed` or `absent` as appropriate; assert no fabricated expected count.
4. Assert the overall result is `fail`, exit 1; assert the other gates still evaluate.
5. Assert the invalid set is not silently truncated to a valid subset (over-cap and over-long fail, not clamp-and-pass).
6. Negative control: the valid workflow with the same green page yields `ci-green`, proving the failure is the invalid set.

**Expected Outcome**:
- A missing, unreadable, malformed, empty, duplicate, over-cap, or over-long expected set fails `ci-expected-jobs-invalid`; observed names are never substituted; a valid set passes.

#### TC-VGATES-026 - Expected-set extraction, exact matching, extra runs, and duplicate observed names follow Appendix F

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, DM-10, AC-F4-1, AC-F3-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/workflows/**`, `tests/fixtures/verify-gates/ci/compare/**`
**Tags**: @backend

**Preconditions**:
- A workflow with jobs that have a display `name` and jobs without one (fallback to job id), declared in a known order.
- Check-run pages covering exact match, case mismatch, extra green run, extra failed run, extra canceled run, and duplicate observed names with mixed states.
- A job-level `if: false` and a matrix-style name to prove they are not evaluated in v1.

**Steps**:
1. Assert the expected names are the display names where present, otherwise the job ids, in declaration order; assert no sorting.
2. Assert matching is exact and case-sensitive: `TS tests` versus `ts tests` is a missing expected job.
3. Assert an extra green non-expected run does not fail the gate; an extra failed, canceled, or pending run does fail (with the matching reason).
4. Assert duplicate observed names use the worst effective state by the order `failed > canceled > pending > skipped > succeeded`; a failed duplicate cannot hide behind a passed duplicate.
5. Assert a job with `if: false` is still expected and, if it reports no run, is reported missing (safe false fail); assert a matrix-expanded name is not expanded.
6. Negative control: a page that exactly matches the expected names by display name or id passes; a one-character case change fails.

**Expected Outcome**:
- Extraction and comparison follow Appendix F exactly: declaration order, display-name fallback, exact case-sensitive match, extra-run rules, duplicate worst-state, and the declared v1 limits.

#### TC-VGATES-027 - An unresolved head SHA fails `head-unresolved` without a check-run read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, DM-4, AC-F3-1, AC-F8-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/head-unresolved/**`
**Tags**: @backend

**Preconditions**:
- A matched PR whose detail has no `sourceHeadSha`, an empty SHA, or a SHA that is not 40- or 64-hex.
- A control with a valid full SHA and a green page.

**Steps**:
1. Run each missing/invalid head fixture; assert `ci-green` is `fail` with reason `head-unresolved`.
2. Assert no check-run read is issued; assert the source `github-check-runs` is `not-attempted` or absent with the prerequisite reason, never `read`.
3. Assert the citation carries the available identity (change ref, branch, PR) and the reason; assert no fabricated SHA.
4. Assert the overall result is `fail` when this is the only failing gate; assert the other gates still evaluate.
5. Assert a 40-hex and a 64-hex SHA are both accepted; assert a short or non-hex SHA is rejected.
6. Negative control: the valid-SHA fixture reads check runs and can pass, proving the failure is the unresolved head.

**Expected Outcome**:
- An unresolved or invalid head SHA fails `head-unresolved` without a dependent read; valid 40/64-hex SHAs proceed to the check-run read.

#### TC-VGATES-028 - Ticket negative: a push-parity mismatch fails and cites both SHAs

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-5, DM-11, AC-F5-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/parity/mismatch/**`
**Tags**: @backend

**Preconditions**:
- Repository facts: attached branch, full local HEAD SHA `aaaa...`.
- A matched PR with source ref equal to the branch and a different full remote head SHA `bbbb...`.
- A CI fixture that is green on the pushed commit, to show the two facts coexist.

**Steps**:
1. Run the fixture; assert `push-parity` is `fail` with reason `parity-mismatched`.
2. Assert the citation identity carries the branch, both full SHAs, and the PR number; assert counts `compared=1`, `matched=0`.
3. Assert `ci-green` may still be `pass` on the pushed commit; assert the report shows both facts and the overall result is `fail`.
4. Assert the exit is 1 with `verify.gates.failed`; assert no success envelope.
5. Assert a case-only hex difference (uppercase versus lowercase) of the same SHA passes, per the case-insensitive comparison.
6. Negative control: setting the local SHA equal to the remote SHA yields `parity-matched`.

**Expected Outcome**:
- A local/remote SHA mismatch is a definitive `parity-mismatched` with both SHAs, branch, and PR cited; CI may still be green; overall `fail`, exit 1; the ticket's push-mismatch case is covered.

#### TC-VGATES-029 - Equal head SHAs pass `parity-matched` with branch, both SHAs, and PR

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-5, DM-11, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/parity/match/**`
**Tags**: @backend

**Preconditions**:
- Attached branch, readable local HEAD SHA, a unique matching open PR whose `sourceRef` equals the branch and whose `sourceHeadSha` equals the local SHA.
- All other gates injected as passing.

**Steps**:
1. Run the fixture; assert `push-parity` is `pass` with reason `parity-matched`.
2. Assert the citation identity carries the branch, both full SHAs, and the PR number; assert counts `compared=1`, `matched=1`; assert no name list.
3. Assert the sources are `repository-head:read`, `github-delivery-request-list:read`, `github-delivery-request-detail:read` in order.
4. Assert the overall result is `pass` only if the other four pass; assert exit 0.
5. Assert a 64-hex SHA pair also passes and compares correctly.
6. Negative control: changing one SHA character yields `parity-mismatched`, proving the pass is live.

**Expected Outcome**:
- Equal local and remote head SHAs pass `parity-matched` with the branch, both SHAs, and the PR cited; 40- and 64-hex SHAs are supported.

#### TC-VGATES-030 - Detached, missing-head, zero-PR, ambiguous-PR, and lone non-matching-PR parity failures

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-4, DM-13, AC-F5-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/parity/failures/**`
**Tags**: @backend

**Preconditions**:
- One below-limit fixture per class: detached HEAD; missing local SHA; missing or invalid remote SHA; zero open PRs; two open PRs for the branch; a lone open PR whose `sourceRef` differs from the branch.
- Restored controls for each.
- The at-limit page cases are covered by TC-VGATES-060; this scenario exercises only below-limit resolution and head failures.

**Steps**:
1. Run each fixture; assert `push-parity` is `fail` with the expected reason: `branch-unresolved`, `head-unresolved`, `no-open-pr`, `ambiguous-open-pr`, or `branch-mismatch`.
2. Assert no class is `pass` or `unknown` unless the spec declares a non-404 provider failure; assert the overall result is `fail` when this is the only failing gate.
3. Assert zero open PRs reports `github-delivery-request-list:observed-empty`; assert the multiple-match case does not select a first match.
4. Assert a lone non-matching PR is `branch-mismatch` for both push parity and squash preflight, not `no-open-pr` or a match by branch name only; assert `openCount=1`, `matchCount=0`.
5. For the no-detail classes (`branch-unresolved`, `no-open-pr`, `ambiguous-open-pr`, `branch-mismatch`), assert the squash citation's `squash-signals` list is empty, the delivery-request-detail source outcome is `not-attempted`, and the reason names the prerequisite; never fabricate `draft` or `mergeable`.
6. Assert each citation carries the strongest available identity and a closed reason; assert no fabricated SHA.
7. Negative control: the unique matching fixture passes, proving each failure is caused by its class; adding a matching PR to the lone non-matching fixture resolves it.

**Expected Outcome**:
- Every declared below-limit parity failure class is definitive with its own reason, including a lone non-matching PR as `branch-mismatch`; none passes; no arbitrary PR selection or branch-name-only match exists; an unread detail yields an empty `squash-signals` list with the prerequisite reason.

#### TC-VGATES-031 - Non-404 parity provider read failure or unresolved binding is `unknown`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-11, DM-14, AC-F5-2, AC-F11-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/behaviour/verify-gates-owner-composition.test.ts`
**Tags**: @backend

**Preconditions**:
- Non-404 open-PR list failure, non-404 PR detail failure, unresolved repository binding, and missing credential fixtures.
- A recovered-transport control.
- PR list/detail HTTP 404 is excluded here (it is a definitive `fail` per TC-VGATES-061).

**Steps**:
1. Run the non-404 list-failure and detail-failure fixtures; assert `push-parity` is `unknown` with reason `read-failed`; assert the source is `failed` with `failureClass: provider.payload.invalid` (never an error-table code as a class).
2. Run the unresolved-binding fixture; assert `unknown` with `address-unresolved`; run the missing-credential fixture; assert `unknown` with `credential-unavailable` and `failureCode: config.credential.missing`.
3. Assert no gate passes on the failed read; assert dependent reads are `not-attempted` when a prerequisite is unresolved.
4. Assert the overall result is `unknown` when no gate fails; assert the failure identity is the first resolvable unknown code or `verify.gates.unavailable`, exit 2.
5. Assert one read attempt per source with no retry and no pagination.
6. Negative control: the recovered-transport fixture evaluates and may pass, proving the unknown outcome is live.

**Expected Outcome**:
- A non-404 parity read failure or unresolved binding is `unknown` with the declared reason and source outcome; it never passes; no retry or pagination occurs; PR 404 absence is handled by TC-VGATES-061.

#### TC-VGATES-032 - No owner-attention label passes `owner-gate-absent`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-5, DM-11, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/verify-gates/owner/absent/**`
**Tags**: @backend

**Preconditions**:
- A readable work item with ordinary labels such as `change`, `planning`, and `good first issue`; none match `hand-back` or `human-input-needed`.
- All other gates injected as passing.

**Steps**:
1. Run the fixture; assert `owner-gate` is `pass` with reason `owner-gate-absent`.
2. Assert the citation source is `github-work-item:read`; assert counts `labels=3`, `ownerLabels=0`; assert the `owner-labels` list is empty.
3. Assert the identity carries the change ref and the work item; assert the citation declares the label-only signal (no comment source).
4. Assert the overall result can be `pass`; assert exit 0.
5. Assert case variants of non-owner labels do not accidentally match.
6. Negative control: adding `hand-back` yields `owner-gate-present`, proving the pass is live.

**Expected Outcome**:
- A readable work item with no owner-attention label passes `owner-gate-absent` with label counts and no comment source.

#### TC-VGATES-033 - Ticket negative: an owner-attention label fails `owner-gate-present` in contract order

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-5, DM-11, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/verify-gates/owner/present/**`
**Tags**: @backend

**Preconditions**:
- Work-item fixtures with `hand-back`, `human-input-needed`, both, uppercase and mixed-case variants, and both plus extra labels in shuffled order.
- A canary in the work-item payload that must not leak.

**Steps**:
1. Run each fixture; assert `owner-gate` is `fail` with reason `owner-gate-present`.
2. Assert the `owner-labels` list is in contract order (`hand-back` before `human-input-needed`) regardless of input order; assert case-insensitive matching.
3. Assert counts `ownerLabels` equals the number of matched owner labels; assert the unmatched labels are counted in `labels` but not named as owner labels.
4. Assert the overall result is `fail` with `verify.gates.failed`, exit 1; assert no success envelope.
5. Assert the canary never appears in the report, summary, or human text.
6. Negative control: removing the owner labels yields `owner-gate-absent`, proving the failure is live.

**Expected Outcome**:
- Any `hand-back` or `human-input-needed` label (case-insensitive) fails `owner-gate-present` with the matched labels in contract order; the overall result fails, exit 1; the ticket's owner-present case is covered.

#### TC-VGATES-034 - Owner gate never passes on an unread or unresolvable work item; label-only signal declared

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-4, DM-5, DM-14, AC-F6-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/verify-gates/owner/unresolved/**`
**Tags**: @backend

**Preconditions**:
- Fixtures: a malformed/non-numeric identity (`GH-abc`); a valid numeric identity whose work-item read receives HTTP 404 (`provider.not-found`, for example `GH-999999`); a transport failure; a non-404 non-2xx response (for example 500 or 403); a missing credential; and an unresolved repository binding.
- A valid `GH-178` work-item control.

**Steps**:
1. Run the `GH-abc` fixture; assert `owner-gate` is `fail` with reason `ticket-unresolved` and source outcome `unresolved`, never `read-failed`.
2. Run the HTTP-404 numeric identity fixture; assert `owner-gate` is `fail` with reason `ticket-unresolved` and source outcome `absent`, never `read-failed`; assert the read result is the adapter-local `provider.not-found` and no error-table code is used.
3. Run the transport-failure, non-404 non-2xx, missing-credential, and unresolved-binding fixtures; assert `owner-gate` is `unknown` with `read-failed` (transport and non-404 non-2xx), `credential-unavailable`, or `address-unresolved` respectively; assert a work-item 404 is never in this `unknown` set.
4. Assert no fixture passes; assert an unread work item never yields `owner-gate-absent`; assert the malformed and 404-absent identities are `fail`, not `unknown`.
5. Assert the citation sources contain only `github-work-item` (no comment source) and the reasons are owner-gate reasons; assert the label-only declaration is present in the contract/structure test and the spec link.
6. Assert the overall result is `fail` for both `ticket-unresolved` fixtures and `unknown` for the read failures, with the declared exit.
7. Negative control: the valid `GH-178` fixture with no owner labels passes, proving the failures are class-specific.
8. Cross-reference TC-VGATES-061 for the full read-specific 404 matrix across PR and check-run reads; this scenario owns the work-item mapping.

**Expected Outcome**:
- A malformed/non-numeric identity fails `ticket-unresolved`/`unresolved`; a work-item HTTP 404 (`provider.not-found`) fails `ticket-unresolved`/`absent`; transport, non-404 non-2xx, credential, and binding failures are `unknown`; the gate never passes on an unread item; the label-only signal is explicit.

#### TC-VGATES-035 - A ready PR passes squash preflight with all surface facts

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-5, DM-11, AC-F7-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/squash/ready/**`
**Tags**: @backend

**Preconditions**:
- A matched PR: review state `open` (and separate `approved` and `changes-requested` controls), not draft, base `main-tools`, `mergeableState: "mergeable"`, `commitCount: 3`, `changedFileCount: 7`.
- All other gates injected as passing.

**Steps**:
1. Run the fixture; assert `squash-preflight` is `pass` with reason `squash-ready`.
2. Assert the citation identity carries the PR number and `baseRef: main-tools`; assert counts `commits=3`, `changedFiles=7`; assert the sources are list and detail in order.
3. Assert the citation's `names` contains exactly one `squash-signals` list whose values are `["draft=false", "mergeable=mergeable"]` in that order (two distinct, ordered tokens); assert no other squash name kind appears.
4. Assert the `approved` and `changes-requested` review-state controls also pass, because v1 does not require approval; assert no approval count is read.
5. Assert the human line carries `pr`, `base`, `draft=no`, `mergeable=mergeable`, `commits`, and `files`.
6. Assert the overall result can be `pass`; assert exit 0.
7. Negative control: setting draft, wrong base, conflicting, or zero commits yields the matching fail, and each failure still carries the ordered `squash-signals` list (TC-VGATES-036..038), proving the pass is live.

**Expected Outcome**:
- An open, non-draft PR on `main-tools` with mergeable state and positive commits/files passes `squash-ready`; the machine citation carries the `squash-signals` list (`draft=false`, `mergeable=mergeable`) plus the surface facts; approval is not required.

#### TC-VGATES-036 - Ticket negative: bad squash preflight (wrong base, draft, merged, or closed) fails with the matching reason

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-4, DM-11, AC-F7-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/squash/base-draft-open/**`
**Tags**: @backend

**Preconditions**:
- Fixtures: base `main`; `isDraft: true`; review state `merged`; review state `closed`; a combined closed-plus-wrong-base fixture.
- Restored controls.

**Steps**:
1. Run the wrong-base fixture; assert `squash-preflight` is `fail` with `squash-target-mismatch`.
2. Run the draft fixture; assert `fail` with `squash-draft`.
3. Run the merged and closed fixtures; assert `fail` with `squash-not-open`.
4. Run the combined fixture; assert the primary reason follows the declared precedence not open, then draft, then wrong base; assert the verdict is deterministic and the reason still names the failed condition.
5. For every failure path, assert the citation's `squash-signals` list has exactly two ordered tokens: `draft=<true|false>` then `mergeable=<mergeable|conflicting|not-mergeable|unknown>`, derived from the same request detail. Assert `draft=true` for the draft fixture and `draft=false` for the others, and assert the list is not empty because the detail was read.
6. Assert the overall result is `fail`, exit 1; assert the other gates still evaluate; assert no success envelope and no `data`.
7. Negative control: correcting the base, draft flag, or state yields `squash-ready` with `draft=false` and the corrected mergeable value.

**Expected Outcome**:
- Wrong base, draft, merged, and closed PRs fail with their declared reasons and precedence; every failure citation preserves the ordered `squash-signals` list; the ticket's bad-squash case is covered; corrected controls pass.

#### TC-VGATES-037 - Ticket negative: bad squash preflight (conflicting or not-mergeable) fails with the matching reason

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-4, DM-11, AC-F7-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/squash/mergeability/**`
**Tags**: @backend

**Preconditions**:
- Fixtures: `mergeableState: "conflicting"`; `mergeableState: "not-mergeable"`; a combined draft-plus-conflicting fixture; a draft-plus-not-mergeable fixture.
- A mergeable control.

**Steps**:
1. Run the conflicting fixture; assert `squash-preflight` is `fail` with `squash-conflicting`.
2. Run the not-mergeable fixture; assert `fail` with `squash-not-mergeable`.
3. Run the combined fixtures; assert the declared precedence (not open, draft, wrong base, conflicting, not-mergeable) selects the earlier reason deterministically, and the reason still names the failed condition.
4. Assert no conflicting or not-mergeable fixture passes; assert the overall result is `fail`, exit 1; assert no success envelope and no `data`.
5. Assert the citation's `squash-signals` list is exactly `["draft=false", "mergeable=conflicting"]` for the conflicting fixture and `["draft=false", "mergeable=not-mergeable"]` for the not-mergeable fixture, in that order; assert the combined fixtures carry the signals from the same request detail and never a fabricated or defaulted value.
6. Assert the citation carries the available identity and counts.
7. Negative control: the mergeable control passes `squash-ready` with `["draft=false", "mergeable=mergeable"]`, proving the failures are live.

**Expected Outcome**:
- Conflicting and not-mergeable PRs fail with their declared reasons and precedence; every failure citation preserves the ordered `squash-signals` list with the matching mergeable value; none passes; the mergeable control passes.

#### TC-VGATES-038 - Ticket negative: bad squash preflight (unknown/absent mergeability and zero/absent surface) fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-12, DM-7, DM-11, AC-F7-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/squash/surface/**`
**Tags**: @backend

**Preconditions**:
- Fixtures: `mergeableState: "unknown"`; mergeability null; mergeability absent; `commitCount: 0`; `changedFileCount: 0`; both counts absent; a negative count; a non-finite count; a zero-commit-plus-zero-file fixture; an unknown-mergeability-plus-zero-commit fixture; and a successful detail read with readable mergeability/state but both `commitCount` and `changedFileCount` omitted.
- A fully positive control.

**Steps**:
1. Run the unknown, null, and absent mergeability fixtures; assert `squash-preflight` is `fail` with `squash-mergeability-unknown` and the citation's `squash-signals` list is exactly `draft=<fixture draft>` then `mergeable=unknown` (absent mergeability is rendered `mergeable=unknown`, never `mergeable`; the default open fixture is `draft=false`).
2. Run the zero-commit and zero-file fixtures; assert `fail` with `squash-no-commits` and `squash-no-changes` respectively; assert the detail was read so the `squash-signals` list is present with `draft=<fixture draft>` and the fixture's mergeable value.
3. Run the absent, negative, and non-finite count fixtures, including the successful detail read that omits both `commitCount` and `changedFileCount`; assert `fail` with `squash-surface-unknown` (absence is unknown, never a fabricated count and never non-empty); assert the `commits`/`changedFiles` counts are omitted as unknown (never zero — neither present with value `0` nor synthesized); assert the `squash-signals` list is still present (the detail was read) and is never empty merely because a surface count is absent.
4. Run the combined fixtures; assert the declared precedence (unknown mergeability before absent surface before zero commits before zero changed files) selects one deterministic reason, and the reason still names the failed condition.
5. Assert no fixture passes; assert unknown mergeability is never `mergeable` and absent counts are never treated as positive or rendered as zero; assert the ordered `squash-signals` list is carried on every condition-failure path where the detail was read.
6. Negative control: the fully positive control passes `squash-ready` with `["draft=false", "mergeable=mergeable"]`.

**Expected Outcome**:
- Unknown/absent mergeability and zero/absent commit or change surfaces fail with their declared reasons and precedence; the citation carries ordered `squash-signals` with `mergeable=unknown` for absent mergeability; unknown is never mergeable; absent is never non-empty and omitted counts are never rendered as zero; a successful detail read that omits `commits`/`changedFiles` keeps the two `squash-signals` tokens while omitting those counts; the positive control passes.

#### TC-VGATES-039 - Non-404 provider read failure across gates is `unknown`, never a pass

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, F-6, F-7, F-11, DM-5, DM-11, DM-14, AC-F3-6, AC-F5-2, AC-F6-2, AC-F7-3, AC-F11-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts`
**Tags**: @backend

**Preconditions**:
- Transport throw, timeout, 401, 403, 429, 500, malformed JSON, and truncated-body fixtures, applied to each provider-backed gate (CI detail or check runs, parity list or detail, owner work item, squash list or detail).
- A check-run HTTP 404 fixture and its expected `unknown` `read-failed` outcome (the only 404 that remains `unknown`).
- Recovered-transport controls.
- HTTP 404 on the PR list/detail or work item is deliberately excluded here and asserted by TC-VGATES-061, where it is a definitive `fail` with the applicable resolution reason.

**Steps**:
1. For each gate and non-404 failure class, assert the affected gate is `unknown` with reason `read-failed`; assert the source outcome is `failed` with `failureClass: provider.payload.invalid` (not an error-table code as a class).
2. Assert the other gates are still evaluated; assert no gate passes on a failed read; assert an unattempted dependent read is `not-attempted`.
3. When the delivery-request list or detail read fails (so no usable detail was read), assert the squash citation's `squash-signals` list is empty (never fabricated or defaulted), the `commits`/`changedFiles` counts are omitted as unknown (never zero), and the reason/source names the failed read as the prerequisite. For a resolution failure where the detail was never attempted, assert the detail source outcome is `not-attempted`; for a detail read that itself failed with a non-404 error, assert the source outcome is `failed`. In every one of these cases, assert the citation still carries at least one source and at least one closed reason, which satisfies AC-F8-1; do not assert a non-empty count or name list on these paths. When the detail was read successfully but a check-run read fails, assert the squash signals are unaffected and remain exactly two ordered tokens (`draft=...` then `mergeable=...`).
4. Run the check-run HTTP 404 fixture; assert `ci-green` is `unknown` `read-failed` with source `github-check-runs:absent` and `failureClass: provider.not-found`; assert the verdict is not `fail`, the reason is not `ci-no-runs`, and it is never a pass (TC-VGATES-068 owns the focused check-run 404 case).
5. Assert the unclassified overall unknown uses `verify.gates.unavailable` with exit 2; assert a classified failureCode is reused when present.
6. Assert exactly one read attempt per source (no retry), no pagination, and no write method.
7. Assert no raw response body, title, or canary appears in the report, summary, or human text.
8. Negative control: the recovered-transport fixture evaluates and may pass, proving the unknown outcome is live.

**Expected Outcome**:
- Every non-404 provider read failure makes the affected gate `unknown` with a source failure and no raw payload; a check-run 404 is `unknown` `read-failed` with source outcome `absent`, never `failed`/`ci-no-runs`; PR and work-item 404 map per TC-VGATES-061, and the matched-detail 404 for CI/parity/squash is owned by TC-VGATES-067; dependent reads are `not-attempted`; a failed list or detail read yields an empty `squash-signals` list with `commits`/`changedFiles` omitted (unknown, never zero) and the prerequisite reason, while a successful detail read yields exactly two ordered tokens; the citation still has at least one source and one reason (AC-F8-1); nothing passes.

#### TC-VGATES-040 - Every gate verdict carries a complete citation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-4, DM-5, DM-11, AC-F8-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/fixtures/verify-gates/output/citations/**`
**Tags**: @backend @contract

**Preconditions**:
- One fixture per gate and verdict (pass, fail, unknown where reachable), including a gate with no usable evidence (detached HEAD, failed read) and a squash fixture whose delivery-request detail was read successfully but omits `commitCount`/`changedFileCount`.
- The Section 8.3 gate-to-source/count/name/reason mapping is the oracle.

**Steps**:
1. For each fixture, assert the gate citation has 1..3 sources, each with a name and one of the six outcomes; assert at least one source is present even when the gate did not pass. When a source carries `failureClass`, assert it is exactly `provider.payload.invalid` or `provider.not-found` (never a status code, HTTP phrase, provider message, or other free-form text); when a source carries an error-table `failureCode`, assert `failureClass` is omitted.
2. Assert `identity.changeRef` is always present; assert every resolved identity (branch, work item, PR, head or local SHA, base ref) appears; assert no fabricated identity.
3. Assert every count name is declared for that gate and every value is a non-negative integer; assert every name list has a declared kind, distinct ordered values, and a non-negative `omitted`. For a gate whose dependent source outcome is `failed`, `absent`, or `not-attempted` (including a detail 404 (`absent`), a failed detail read (`failed`), or an unattempted detail (`not-attempted`)), assert the dependent counts and name lists may be empty (or, for the declared lifecycle terminal-failure case, zero per DM-15), that omitted counts are never rendered as zero, and that the citation still carries at least one source and at least one closed reason, satisfying AC-F8-1; do not require a non-empty count or name list on those paths.
4. For every squash citation whose delivery-request detail was read successfully, assert it contains exactly one `squash-signals` list with exactly two distinct, ordered values — `draft=<true|false>` then `mergeable=<mergeable|conflicting|not-mergeable|unknown>`. When the detail was read successfully but `commitCount`/`changedFileCount` were omitted, assert the two ordered tokens are still present while the `commits`/`changedFiles` counts are omitted as unknown (never zero — neither present with value `0` nor synthesized). When the detail read returned HTTP 404 (source outcome `absent`) or the detail read failed (source outcome `failed`), assert the list is empty, the `commits`/`changedFiles` counts are omitted as unknown (never zero), and the source and reason name the cause, while the citation still has at least one source and at least one reason (AC-F8-1); assert no synthetic tokens are injected.
5. Assert the reasons array has 1..4 closed reasons and includes the gate's primary reason; assert the reason is allowed for that gate.
6. Assert a failed, absent, unresolved, or not-attempted source is explicit; assert a gate with no usable evidence is not an empty citation.
7. Negative control: an in-memory citation with empty sources, a missing `changeRef`, an undeclared count name, a single/fabricated squash signal, or a free-form `failureClass` (for example `"HTTP 500"`) is rejected by the validator; a complete citation with a declared `failureClass` passes.

**Expected Outcome**:
- Every gate verdict carries a complete, schema-valid citation with sources, identity, declared counts/names (which may be empty on a `failed`/`absent`/`not-attempted` dependent source, with the reason naming the cause), and closed reasons; `failureClass` is only a declared read-result code; a successful detail read yields exactly two ordered `squash-signals` tokens — including when that successful read omits `commits`/`changedFiles`, which then stay omitted as unknown (never zero) — while a detail 404 (`absent`), a failed detail read (`failed`), or an unattempted detail yields an empty list with `commits`/`changedFiles` omitted (unknown, never zero) and the prerequisite reason, still satisfying the at-least-one-source/at-least-one-reason rule (AC-F8-1); a no-evidence gate declares its failed/absent/unresolved/not-attempted source.

#### TC-VGATES-041 - Citation bounds, ordering, redaction, and determinism hold

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-5, DM-11, AC-F8-1, NFR-5, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/fixtures/verify-gates/output/bounds/**`
**Tags**: @backend @contract @security

**Preconditions**:
- Fixtures with 12 missing jobs, 20 failed jobs, 12 missing phases, and many owner labels; names longer than 120 characters; sources in different input orders.
- A planted canary in a raw provider payload, title, comment body, commit message, file content, and a fake token.

**Steps**:
1. Assert each name list is capped at `VERIFY_GATES_MAX_CITATION_NAMES` (8) and reports the correct `omitted` count; assert each value is clamped to `VERIFY_GATES_MAX_NAME_CHARS` (120).
2. Assert ordering: missing jobs and missing phases follow expected-set order; failed and pending jobs are lexicographic; owner labels follow contract order; `squash-signals` is exactly `draft` then `mergeable`, each value inside its closed domain; sources, counts, and reasons follow contract order. Assert every present `failureClass` is drawn only from `provider.payload.invalid` and `provider.not-found`, and that an error-table failure uses `failureCode` with no `failureClass`.
3. Assert no raw provider payload, response body, title, comment body, commit message, file content, credential, or canary appears in any citation; assert a fake token is absent from all output.
4. Assert replaying the same facts (including object key permutations and map iteration order changes) produces byte-identical citations.
5. Assert the identity ref is clamped to `VERIFY_GATES_MAX_REF_CHARS` (120) where the summary/human grammar applies.
6. Negative control: a citation with 9 names and no `omitted`, with an out-of-order list, or with a free-form `failureClass` fails; the correctly bounded citation with a declared `failureClass` passes.

**Expected Outcome**:
- Citations are bounded, ordered by contract arrays, secret-free, and byte-identical on replay; omitted counts and clamping are explicit.

#### TC-VGATES-042 - The failure summary grammar, bounds, and replay equality hold

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-10, DM-5, DM-6, AC-F1-3, AC-F8-2, NFR-3, NFR-4, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/fixtures/verify-gates/output/summary/**`
**Tags**: @backend @contract

**Preconditions**:
- A mixed fail-plus-unknown fixture and an overall-unknown fixture; a fixture with names and omitted counts; a fixture where a squash line has no usable detail (resolution failure, detail 404, or failed detail read) and therefore no counts and no name list.
- Fixed brand, clock, and `runId`; a canary in the underlying payload.

**Steps**:
1. Assert `error.summary` is exactly one header line followed by five gate lines in `VERIFY_GATES_GATE_ORDER`; assert the five lines preserve the five internal gate records and that the failure envelope has no `data`; assert six lines total and at most 4096 bytes.
2. Assert the header matches `result=fail; gates=P/5 passed, F failed, U unknown`; for an overall unknown, assert `result=unknown`.
3. Assert each gate line matches `gate-id verdict reason=REASON source=NAME:OUTCOME[+...] ref=REF counts=<k=v[,k=v...]|-> names=<names-spec>`, where `<names-spec>` is `-` or `KIND=JSON_ARRAY[+N][ KIND=JSON_ARRAY[+N]...]`; assert both the `counts=` and `names=` segments are always present, in that order, on every line; assert the source list is ordered and every token carries an outcome.
4. Assert `ref` is the strongest resolved identity or `-`, clamped; assert counts are in declared order and names are compact JSON arrays with `+N` omitted when non-zero. When a gate's count subset or name-list set is empty, assert the segment is the literal `-` (for example `counts=- names=-`), never a zero alias such as `counts=commits=0`, never a bare `counts=`/`names=`, and never an omitted segment.
5. On a squash line whose detail was read, assert the counts segment carries `commits=<n>,changedFiles=<n>` and the `names=squash-signals=[...]` segment contains exactly two ordered values (`draft=<true|false>`, `mergeable=<...>`); when that successful detail read omits `commits`/`changedFiles`, assert the counts segment is `counts=-` (unknown, never zero) while the `names=squash-signals=[...]` segment is still present. On a squash line with no usable detail (resolution failure, detail 404, or failed detail read), assert the line renders exactly `counts=- names=-` — both empty segments are present and use the single `-` marker, never a zero alias, a bare segment, or an omitted segment — and the reason names the prerequisite.
6. Assert no raw payload, title, comment body, commit message, secret, or canary appears; assert the block is byte-identical on replay.
7. Negative control: a summary with 7 lines, a missing gate line, an unordered source list, a fabricated squash signal, a raw payload, a zero alias for an empty count, a bare `counts=`/`names=`, or an omitted `counts=`/`names=` segment fails the grammar assertion; the valid summary passes.

**Expected Outcome**:
- The failure summary is a deterministic, bounded, six-line block preserving the five internal gate records, each gate's verdict, reason, sources/outcomes, identity/ref, and both the `counts` and `names` segments in fixed order; every empty segment renders the literal `-` and is never a zero alias, a bare `counts=`/`names=`, or an omitted segment; a squash line with no usable detail renders exactly `counts=- names=-`, while a successful detail read with omitted surface counts renders `counts=-` and still carries the ordered `squash-signals` name list; no failure `data`, no raw or secret content; replay-identical.

#### TC-VGATES-043 - The human success report is exactly six deterministic lines

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-6, AC-F10-2, NFR-3, NFR-5, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/fixtures/verify-gates/output/human/**`
**Tags**: @backend @cli

**Preconditions**:
- An all-pass fixture with known variant, SHA, branch, PR, base, commits, files, and owner labels.
- Fixed brand `example-product` and fixed clock/runId; a failure fixture for the negative control.

**Steps**:
1. Assert stdout is exactly six lines: a header `example-product verify gates GH-178  pass  5/5` plus five gate lines in fixed order.
2. Assert each line carries the gate verdict, sources, and key evidence: variant/required/completed/missing; sha7/expected/runs/failed/missing; branch/local/remote; work-item/owner-labels; pr/base/draft/mergeable/commits/files.
3. Assert the binary name is the injected brand, not a product literal; assert no timestamps, LLM prose, raw payloads, titles, comment bodies, or secrets appear.
4. Assert the block is at most 6 lines and 4096 bytes; assert replay is byte-identical.
5. Run the failure fixture in human mode; assert no success text is printed and the diagnostic carries the bounded failure summary.
6. Negative control: a seventh line or a timestamp fails the assertion; the correct six-line report passes.

**Expected Outcome**:
- Human success is exactly six deterministic lines with the declared evidence and brand; failure prints no success text; bounds and redaction hold.

#### TC-VGATES-044 - Machine success is one valid envelope with the full report and the byte bound

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-1, DM-5, DM-12, AC-F10-1, NFR-4, NFR-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts`, `tests/fixtures/verify-gates/golden/**`
**Tags**: @backend @golden

**Preconditions**:
- An all-pass fixture; fixed brand, clock, and `runId`; `assertEnvelopeContract` available.

**Steps**:
1. Run `--json`; assert stdout contains exactly one parseable envelope and nothing else; assert `assertEnvelopeContract` is empty.
2. Assert the envelope has no `error` key and `data` is present; assert `data.schemaVersion` is `delivery.verify-gates.v1`, `changeRef` is the ref, `target` is `gates`, `overall` is `pass`.
3. Assert `data.summary` is `{ gates: 5, passed: 5, failed: 0, unknown: 0 }`; assert `data.gates` has exactly five records in order, each with `id`, `verdict`, `reason`, `citation`; assert the `squash-preflight` citation carries `squash-signals` exactly `["draft=false", "mergeable=mergeable"]`.
4. Assert the serialized `data` is at most 65 536 bytes; assert the envelope's schema version remains `delivery.result.v1`.
5. Assert the golden comparison for the success report matches the committed golden; assert the golden can be regenerated only by the documented command.
6. Negative control: a failure `--json` run has no `data` (TC-VGATES-046); a success with an `error` key fails `assertEnvelopeContract`.

**Expected Outcome**:
- A `--json` all-pass run emits exactly one valid envelope with the full `delivery.verify-gates.v1` report, five ordered gates, and the byte bound; success carries no error.

#### TC-VGATES-045 - Overall derivation is pass only when all five pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-3, DM-6, AC-F9-1, NFR-1
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts`
**Tags**: @backend @contract

**Preconditions**:
- Injected verdict matrices: 5 pass; 1 fail plus 4 pass; 1 unknown plus 4 pass; 1 fail plus 1 unknown plus 3 pass; 2 unknown plus 3 pass; 5 unknown.

**Steps**:
1. For each matrix, assert the overall result is `pass` only for 5 pass, `fail` for any fail, and `unknown` when no fail and at least one unknown.
2. Assert a success envelope is emitted only for `pass`; assert `fail` and `unknown` emit an error-only envelope.
3. Assert the summary counts `gates=5` and `passed + failed + unknown = 5`; assert the counts match the verdicts.
4. Assert unknown never becomes pass, even when 4 gates pass and 1 is unknown.
5. Assert a fail plus unknown still derives `fail` (fail wins over unknown).
6. Negative control: a derivation that treats unknown as pass or fail as unknown is rejected by the matrix.

**Expected Outcome**:
- Overall derivation is total and exactly as DM-6: pass only when all five pass, fail if any fails, unknown otherwise; unknown never passes.

#### TC-VGATES-046 - The exit and failure-identity matrix is total and envelope-exclusive

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-8, AC-F9-2, NFR-4
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/checks/exit-code-literals.test.ts`
**Tags**: @backend @cli

**Preconditions**:
- Fixtures: all pass; one fail; one fail plus one unknown; unknown with first unknown `config.credential.missing`; unknown with first unknown `state.store.torn`; unknown with no resolvable code; handler grammar; parser grammar.

**Steps**:
1. Assert all pass exits 0 with a success envelope.
2. Assert any fail exits 1 with `verify.gates.failed`, even when an unknown gate coexists; assert no `data`.
3. Assert unknown with `config.credential.missing` exits 1 and reuses that identity; assert unknown with `state.store.torn` exits 2 and reuses that identity; assert unknown with no resolvable code uses `verify.gates.unavailable` and exits 2.
4. Assert every failure envelope has no `data`, and every success has no `error`; assert the observed exits are only `{0, 1, 2}`.
5. Assert handler grammar exits 1 with `input.value.rejected`; parser grammar exits 1 with `fallback.invocation`.
6. Assert no exit digit appears in the verify-gates domain/contracts; the projection module is the only source of the exit. Run the exit-code-literals check.

**Expected Outcome**:
- The exit matrix is total and deterministic; failure identity precedence follows DM-8 and Section 8.3; envelopes are exclusive; exits are only 0, 1, 2.

#### TC-VGATES-047 - Error-table documented rows and machine rows stay in two-way sync

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DM-8, AC-F9-3, NFR-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts`
**Tags**: @backend @check

**Preconditions**:
- The documented table in `doc/spec/features/feature-result-contract.md` includes the two new rows; the machine table includes them.
- A temp-copy harness for mutations, following `tests/checks/error-table-sync.test.ts`.

**Steps**:
1. Run `bun run scripts/checks/error-table-sync.ts`; assert exit 0 and zero drift reports.
2. Assert both new rows appear exactly once in the documented table with fields equal to the machine row; assert the existing `verify.ledger.incomplete` row is unchanged.
3. In a temp copy, remove a documented row; assert the check exits non-zero and names the code. In a second copy, add an undocumented machine row; assert it fails. In a third copy, change one field; assert it fails.
4. Assert the `verify` kind remains exact-code classified; assert no kind-only selection is introduced.
5. Assert the live tree is unchanged after the mutations; assert the temp copies were cleaned up.
6. Negative control: the unmutated tree is green in the same test.

**Expected Outcome**:
- Machine and documented error tables are in exact two-way sync; both new rows round-trip; existing rows are unchanged; a drift in either direction is detected by name.

#### TC-VGATES-048 - Credential-reference composition guard: refused or missing credentials never pass

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DM-8, AC-F11-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/verify-gates/composition/credentials/**`
**Tags**: @backend @security

**Preconditions**:
- External-system instances: a credential-reference GitHub instance with a present credential; an anonymous instance; an instance with another auth mechanism; a credential-reference instance whose credential port rejects or throws.
- A recording GitHub transport and a complete ledger.

**Steps**:
1. Run the admitted instance; assert the GitHub reads are attempted and the provider gates can evaluate.
2. Run the anonymous and other-mechanism instances; assert zero GitHub requests, every provider-backed gate is `unknown` with `credential-unavailable` and `failureCode: config.credential.missing`, and the lifecycle gate is still evaluated.
3. Run the missing/rejected credential fixture; assert the same provider-gate outcome and the overall unknown reuses `config.credential.missing` with exit 1.
4. Assert no gate passes; assert no anonymous fallback and no credential value appears in any output.
5. Assert the credential is resolved only through the port; assert the command reads no ambient environment.
6. Negative control: the admitted instance with a present credential reads and may pass, proving the refusal is class-specific.

**Expected Outcome**:
- Only a credential-reference instance with a resolved credential is admitted; refused or missing credentials make provider gates `unknown` with `config.credential.missing`, while lifecycle still runs; nothing passes.

#### TC-VGATES-049 - Non-404 network, transport, and payload failures are `unknown` with no retries

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DM-14, AC-F11-1, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/verify-gates/composition/network/**`
**Tags**: @backend

**Preconditions**:
- Fake transport failures: connection error, timeout, 401, 403, 429, 500, malformed JSON, and a truncated body.
- A canary in the raw response; a recovered-transport control.
- HTTP 404 is excluded from this generic matrix and asserted per read by TC-VGATES-061 (PR/work-item 404 definitive `fail`; check-run 404 `unknown`).

**Steps**:
1. For each non-404 failure, assert the affected gate is `unknown` with `read-failed`; assert the source outcome is `failed` with `failureClass: provider.payload.invalid`.
2. Assert each source is read exactly once; assert no retry and no pagination; assert no write method is attempted.
3. Assert the overall result is `unknown` when no gate fails; assert an unclassified unknown uses `verify.gates.unavailable` with exit 2.
4. Assert no raw body, status text, header, or canary appears in the report, summary, or human text.
5. Assert a 429/5xx does not become a pass or a silent retry; the gate stays unknown.
6. Negative control: the recovered-transport fixture evaluates and may pass, proving the unknown outcome is live.

**Expected Outcome**:
- Non-404 network, transport, and payload failures are `unknown` with a source failure; there is exactly one attempt per source; no raw content leaks; nothing passes; the read-specific 404 behaviour is asserted separately by TC-VGATES-061.

#### TC-VGATES-050 - An unresolved repository binding makes every provider-backed gate `unknown`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/verify-gates/composition/binding/**`
**Tags**: @backend

**Preconditions**:
- Repository facts with no `origin`, a non-GitHub host, a malformed remote, or a remote with userinfo; a valid `origin` control.
- A complete ledger and a recording credential/transport.

**Steps**:
1. Run each unresolved-binding fixture; assert `ci-green`, `push-parity`, `owner-gate`, and `squash-preflight` are `unknown` with `address-unresolved`; assert the lifecycle gate is still evaluated.
2. Assert zero GitHub requests are issued; assert the credential is not resolved (or is resolved but no request is made).
3. Assert no gate passes; assert the overall result is `unknown` when no gate fails.
4. Assert the failure identity is the first unknown gate's resolvable code or `verify.gates.unavailable`; assert the expected exit.
5. Assert userinfo and credentials in the remote URL are discarded and not echoed; assert a non-GitHub host is unavailable, not attempted.
6. Negative control: the valid `origin` control reads and may pass, proving the unknown outcome is live.

**Expected Outcome**:
- An unresolved repository binding makes every provider-backed gate `unknown` with `address-unresolved` before any client call; the lifecycle gate still runs; nothing passes.

#### TC-VGATES-051 - The command is read-only and honors the read budget

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-13, AC-F11-2, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/fixtures/result/no-spawn-guard.ts`
**Tags**: @backend @security

**Preconditions**:
- Recording repository, file, credential, and GitHub adapters; a no-spawn guard; a temp workspace.
- An all-pass fixture and a mutating state/phase control used to prove the recorder detects writes.

**Steps**:
1. Run the all-pass fixture; assert zero writes, fences, state mutations, merge attempts, auto-merge attempts, network writes, and child processes.
2. Assert at most four outbound GETs: open-PR list, PR detail, check-runs page, work item; assert no retry and no page parameter beyond the first.
3. Assert at most one read each for pm-notes, registry, workflow, and repository facts; assert the workflow read is bounded to 256 KiB.
4. Assert no file is created or modified under the temp workspace or the real tree; assert `git status --porcelain` is unchanged after the run.
5. Assert the no-spawn guard records zero violations; assert the verify-gates surface files import no `node:child_process`.
6. Negative control: run the mutating state/phase control through the same recorder and assert the recorder reports the write, proving the detector is live.

**Expected Outcome**:
- The command is read-only and bounded: zero writes/fences/spawns/network writes, at most four GETs, one read per local source, no retries or pagination; the recorder is proven live.

#### TC-VGATES-052 - Replay over identical injected facts is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-13, AC-F11-2, NFR-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts`
**Tags**: @backend @golden

**Preconditions**:
- Fixed brand, clock, and `runId`; an all-pass fixture, a fail fixture, and an unknown fixture.
- The same facts represented with different object key insertion orders.

**Steps**:
1. Run each fixture twice; assert byte-identical machine report, failure summary, human text, and exit code.
2. Permute the key insertion order of the injected fact objects and the order of observed runs where the contract sorts them; assert the output is unchanged.
3. Assert no timestamp, wall-clock value, random id, or ambient value enters the report, summary, or human text; only the injected `runId`/`timing` envelope fields vary by injection.
4. Assert the gate order, source order, count order, name order, and reason order come from contract arrays.
5. Negative control: change one fact (for example one failed run) and assert the output differs, proving the replay comparison is live.
6. Assert the golden files are stable and regenerated only by the documented command.

**Expected Outcome**:
- Identical injected facts produce byte-identical report, summary, human text, and exit; ordering is contract-driven; no ambient nondeterminism exists.

#### TC-VGATES-053 - Pure evaluation stays within the performance bound

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-13, NFR-8
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-performance.test.ts`
**Tags**: @backend @perf

**Preconditions**:
- Capped inputs: 100 check runs, 200 expected jobs, 12 citation names (clamped to 8), 12 missing phases, and a full ledger.
- A warm-up run and a fixed iteration count (for example 100 evaluations).

**Steps**:
1. Warm up the evaluator; run 100 evaluations over the capped facts; measure total and per-evaluation time.
2. Assert the mean and p95 per evaluation are at most 50 ms (with a documented CI margin); assert no evaluation exceeds a generous ceiling.
3. Assert the evaluator is linear over the capped input and contains no unbounded loop or recursion over provider graphs.
4. Assert the read budget bounds the total invocation; no network or spawn occurs in the measurement.
5. Assert the test is stable across repeated runs and does not depend on wall-clock flakiness; use a robust statistic, not a single sample.
6. Negative control: a deliberately quadratic stub over the same input exceeds the bound, proving the measurement is live; the real evaluator stays under it.

**Expected Outcome**:
- Pure evaluation is at most 50 ms per capped input, linear and bounded; the measurement is robust and non-flaky.

#### TC-VGATES-054 - GitHub PR detail normalizes the four gate facts, their absence, and the mergeability precedence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-7, AC-F12-1, AC-F7-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-gate-facts.test.ts`, `tests/fixtures/verify-gates/providers/github/pr/**`
**Tags**: @backend @provider

**Preconditions**:
- Fake GitHub transport with committed PR payloads: `head.sha` present/absent; `mergeable` true/false/null/absent; `mergeable_state` clean/dirty/blocked/behind/unstable/draft/computing/unrecognized; `commits` and `changed_files` present/absent/zero/negative/non-finite.
- The existing `DeliveryRequest` normalizer and the additive fields.

**Steps**:
1. Assert a present `head.sha` maps to `sourceHeadSha` as a full SHA; an absent head leaves the field absent.
2. Assert the fixed mergeability precedence in this order: (1) `mergeable === false` with a clean or dirty state, or `mergeable_state === "dirty"`, maps to `conflicting`; (2) `mergeable_state` in `blocked`, `behind`, `unstable`, or `draft` maps to `not-mergeable` even when `mergeable === true`; (3) `mergeable_state` null, absent, `computing`, or unrecognized with `mergeable !== true` maps to `unknown`; (4) `mergeable === true` with clean or absent state maps to `mergeable`; (5) any remaining combination maps to `unknown`.
3. Assert a present `commits` and `changed_files` map to `commitCount` and `changedFileCount`; absent values stay absent; zero stays zero; negative or non-finite is treated as absent.
4. Assert no provider-native type, new operation, or new export crosses the subpath; assert the list read may populate `sourceHeadSha` but is not required to populate the other fields.
5. Assert the normalized view carries no raw provider payload, title, or body.
6. Negative control: a payload with a fabricated default (for example absent mergeability coerced to `mergeable`, or `mergeable === true` coerced to `mergeable` despite a blocked state) fails the mapping assertion; the correct mapping passes. TC-VGATES-064 exercises the full precedence matrix through the squash gate.

**Expected Outcome**:
- The GitHub detail read populates the four optional gate facts with the declared mapping and fixed precedence; `mergeable === true` with blocked/behind/unstable/draft is `not-mergeable`, false/dirty is `conflicting`, and null/absent/computing/unrecognized is `unknown`; absence stays absent; no provider-native type or new operation crosses the boundary.

#### TC-VGATES-055 - Trap catalog gains all required entries, four-field shape, and bidirectional coverage

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, F-14, DM-14, AC-F12-1, AC-F14-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/trap-catalog.test.ts`, `tests/fixtures/providers/traps/github.traps.json`
**Tags**: @backend @provider @corpus

**Preconditions**:
- The GitHub trap catalog has the existing entries and the new gate-fact/absence entries; the four-field entry shape is binding.
- Every new entry has a fixture reference under `tests/fixtures/providers/github/**` and a matching assertion test; no reference points into `tests/fixtures/verify-gates/`.

**Steps**:
1. Assert the catalog gains entries for the PR gate-fact traps `GITHUB-PR-LIST-REVIEW-DEFAULT`, `GITHUB-PR-MERGEABLE-NULL`, `GITHUB-PR-MERGEABLE-DIRTY`, `GITHUB-PR-MERGEABLE-BLOCKED`, `GITHUB-PR-HEAD-SHA-ABSENT`, `GITHUB-PR-COMMIT-SURFACE-ABSENT`, and `GITHUB-PR-ZERO-COMMITS`; the check-run traps `GITHUB-CHECKRUN-EMPTY`, `GITHUB-CHECKRUN-ALL-SKIPPED`, and `GITHUB-CHECKRUN-PAGE-LIMIT`; the issue trap `GITHUB-ISSUE-COMMENTS-ABSENT`; and the absence traps `GITHUB-PR-LIST-404`, `GITHUB-PR-DETAIL-404`, `GITHUB-CHECKRUN-404`, and `GITHUB-ISSUE-404`.
2. Assert every entry has exactly the four fields (`expectedNormalizedOutcome`, `fixtureReference`, `providerBehavior`, `trapName`), a resolvable `path#/json-pointer` fixture under `tests/fixtures/providers/github/**`, and a unique name.
3. Assert bidirectional coverage: every new entry has a matching assertion test, and every new gate-fact/absence assertion has a matching entry; assert the minima are updated and no existing entry is removed.
4. Assert each entry's `expectedNormalizedOutcome` matches TC-VGATES-054/056/061/067/068's mapping, including `mergeable === true` + blocked → `not-mergeable`, the matched-detail 404 → `head-unresolved`/`absent` for every detail-consuming gate, and the check-run 404 → source `absent`/`unknown` `read-failed`.
5. Assert the catalog file lives at `tests/fixtures/providers/traps/github.traps.json` and no trap `fixtureReference` points into `tests/fixtures/verify-gates/`; assert behavioural fixtures stay under `tests/fixtures/verify-gates/providers/...`.
6. Negative control: remove one entry or one assertion in a temp copy and assert the meta-check fails naming it; point a `fixtureReference` into `tests/fixtures/verify-gates/` and assert the catalog validation fails; the unmutated catalog is green.

**Expected Outcome**:
- The trap catalog declares every required PR, check-run, issue-comment, and 404-absence trap with four fields and a fixture under `tests/fixtures/providers/github/**`; every entry has a matching assertion; trap and behavioural fixture locations are never conflated; removing either side fails the coverage check.

#### TC-VGATES-056 - GitHub trap payloads replay to the declared gate facts under the catalog fixture location

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-14, AC-F12-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-trap.test.ts`, `tests/fixtures/providers/github/**`
**Tags**: @backend @provider

**Preconditions**:
- The trap fixtures under `tests/fixtures/providers/github/**` for list review default, null/dirty/blocked mergeability, `mergeable === true` + blocked, absent head SHA, absent commit surface, zero commits, empty check runs, all-skipped check runs, page limit, issue-comment absence, and the PR/check-run/issue 404 absence traps.
- The existing trap replay harness; behavioural fixtures under `tests/fixtures/verify-gates/providers/...` are separate and not used as trap payloads.

**Steps**:
1. Replay each PR trap payload through the normalizer; assert the declared normalized outcome (`unknown`, `conflicting`, `not-mergeable`, absent field, or zero count); assert `mergeable === true` + blocked/draft yields `not-mergeable`, not `mergeable`.
2. Replay the check-run traps; assert the normalized `PipelineRun` set, the raw page size, and the empty/all-skipped/page-limit classification.
3. Replay the issue trap; assert the work item exposes labels and no comment set; assert the owner gate uses labels only.
4. Replay the 404 absence traps; assert `provider.not-found` is produced and mapped per read (`ticket-unresolved`/`absent`, PR list `no-open-pr`, matched PR detail `head-unresolved`/`absent` for every detail-consuming gate, check-run source `absent` with `unknown` `read-failed`).
5. Assert no raw payload, title, body, or secret appears in the normalized view.
6. Assert the same input replays identically; assert a mutated valid payload produces a different outcome (proves the replay is live).
7. Negative control: a payload with a valid mergeable state replays to `mergeable`, not the trap outcome; a 500 payload remains `provider.payload.invalid`, not `provider.not-found`.
8. Assert every trap `fixtureReference` resolves under `tests/fixtures/providers/github/**` and none resolves into `tests/fixtures/verify-gates/`.

**Expected Outcome**:
- Every required trap payload replays to the declared normalized gate fact, including the contradictory `mergeable === true` + blocked case and each read-specific 404 absence; the mapping is live and secret-free; trap payloads stay under `tests/fixtures/providers/` and the catalog assertions agree.

#### TC-VGATES-057 - Corpus completeness meta-check covers every gate, verdict, reason, and ticket case

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-10
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-corpus.test.ts`, `tests/fixtures/verify-gates/corpus/**`
**Tags**: @backend @corpus

**Preconditions**:
- A committed corpus manifest (for example `cases.json`) with one case per fixture, each declaring `id`, `gate`, `expectedVerdict`, `expectedReason`, `expectedExit`, and `fixture`.
- The contract vocabularies from TC-VGATES-001 are the coverage oracle, including DM-13 resolution outcomes and DM-14 read-specific 404 outcomes.

**Steps**:
1. Assert the manifest is non-empty and has no duplicate case ids; assert every case fixture exists and is readable.
2. Assert every gate id has at least one pass, one fail, and one unknown case where the gate can reach that verdict; assert every closed reason has at least one case.
3. Assert the three ticket negatives are present as first-class cases: red pipeline (TC-VGATES-019), missing expected job (TC-VGATES-020), vacuous green zero-run (TC-VGATES-021), and all-skipped (TC-VGATES-022); assert push mismatch (TC-VGATES-028), owner present (TC-VGATES-033), and bad squash (TC-VGATES-036/037/038) are present.
4. Assert the resolution/absence cases are present: at-limit with a match (TC-VGATES-060), at-limit without a match (TC-VGATES-060), a lone non-matching PR → `branch-mismatch` (TC-VGATES-011/030), zero open PRs → `no-open-pr`, multiple matches → `ambiguous-open-pr`, detached → `branch-unresolved`, a matched PR-detail 404 → `head-unresolved`/`absent` for `ci-green`, `push-parity`, and `squash-preflight` (TC-VGATES-067), a check-run 404 → source `absent`, `unknown` `read-failed`, never `ci-no-runs` (TC-VGATES-068), and the PR-list and work-item 404 cases (TC-VGATES-061).
5. Execute every case; assert the observed gate, verdict, reason, and exit equal the manifest; assert a stale case referring to a removed gate/reason fails by case name. For every squash case whose detail was read, assert the citation carries the manifest-declared ordered `squash-signals` list; for a no-detail case, assert an empty list with the prerequisite reason.
6. Assert a case marked fail/unknown never yields a pass, a success envelope, `data`, or exit 0; assert a case marked pass never yields an error envelope.
7. Negative control: in a temp copy, remove a case and assert the meta-check names it; change a case's expected verdict and assert execution fails; use an empty manifest and assert it fails (non-vacuity).

**Expected Outcome**:
- The corpus covers every gate, verdict, reason, ticket case, resolution outcome, at-limit case, CI PR-detail 404, check-run 404, and read-specific absence case; a missing, stale, duplicate, or wrong-verdict case fails by name; an empty corpus fails.

#### TC-VGATES-058 - Negative controls and non-vacuity: empty or wrong fixtures fail the suite

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-corpus.test.ts`, `tests/fixtures/verify-gates/corpus/**`
**Tags**: @backend @corpus

**Preconditions**:
- The corpus and its negative controls; a canary in every fixture; restored controls for every fail/unknown class.
- A meta-test that loads the corpus and asserts properties over it.

**Steps**:
1. Assert every fail/unknown case yields `overall !== pass`, no success envelope, no `data`, and an exit other than 0.
2. Assert no gate passes on a failed, absent, unresolved, or not-attempted read; assert an empty expected set never yields `ci-green`; assert a CI expected-set/observed count cannot be double-bucketed and an unrecognized run state never yields `ci-green`; assert unknown mergeability never yields `squash-ready`; assert a `mergeable === true` + blocked state never yields `squash-ready`; assert an at-limit open-PR page never yields `parity-matched` or `squash-ready`; assert a PR-list or work-item 404 is never reported as a generic `unknown`; assert a matched PR-detail 404 never yields a pass and never becomes `no-open-pr` for squash; assert a check-run 404 never yields `failed` or `ci-no-runs`; assert an owner label never yields `owner-gate-absent`; assert a squash case whose detail was read never passes or fails without the two ordered `squash-signals` tokens, and that a fabricated or defaulted token is rejected.
3. Assert every negative is paired with a restored-or-valid control that produces the specified positive outcome.
4. Assert every fixture carries a canary and the builder asserts the intended mutation/omission; assert no canary appears in any output.
5. Assert the meta-test itself fails on an empty fixture set, on a case whose expected verdict is wrong, and on a missing control; prove this by injecting each condition in a temp copy.
6. Assert the live corpus passes all of the above.

**Expected Outcome**:
- The suite fails on an empty or missing fixture set and on any wrong-verdict case; every negative has a positive control; no gate passes on unknown/failed/absent/at-limit evidence; the non-vacuity guard is itself tested.

#### TC-VGATES-059 - Default CI makes zero live calls; the opt-in live smoke is structural only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, AC-F14-1, NFR-10
**Test Type(s)**: Contract, Integration, Manual (opt-in live)
**Automation Level**: Automated (default) and Semi-automated (opt-in live)
**Target Layer / Location**: `tests/checks/verify-gates-no-live-calls.test.ts`, `tests/behaviour/verify-gates-live.test.ts`
**Tags**: @backend @check @live

**Preconditions**:
- The default suite uses the fake GitHub transport; no default test imports a live HTTP client.
- The named network guard fixture `tests/fixtures/verify-gates/cases/network-guard.ts` exists and exports `createNoNetworkGuard()` with `install()`/`restore()`, following `tests/fixtures/result/no-spawn-guard.ts`; `tests/checks/verify-gates-no-live-calls.test.ts` imports and installs it, so no undocumented `--preload` flag is required.
- The live smoke is gated on `VERIFY_GATES_LIVE=1` (documented) and requires a real credential-reference instance; it is excluded from `pnpm check`.

**Steps**:
1. Scan the default verify-gates test files and the production verify-gates edge for live network calls (`fetch`, `node:https`, `Bun.connect`, a real GitHub host) and assert only the fake transport is used.
2. Install `createNoNetworkGuard()` from `tests/fixtures/verify-gates/cases/network-guard.ts` in `tests/checks/verify-gates-no-live-calls.test.ts`; run the default verify-gates suites under it and assert zero live calls and a green suite. The guard is also exercised by a self-test that attempts a call and is rejected, proving it is live.
3. Run the live smoke with `VERIFY_GATES_LIVE=1` against this repository; assert only structural invariants: exactly five gates in fixed order, non-empty citations, declared bounds, no secret or canary in output, and the exit in `{0,1,2}`.
4. Assert the live smoke never pins volatile counts (PR number, SHAs, job counts, labels); assert it tolerates a red or unknown result and still validates structure.
5. Assert the live smoke is skipped cleanly when the flag or credential is absent; assert it is not part of `pnpm check` or the default CI job set.
6. Negative control: a live smoke that pins a count or leaks a secret fails the structural assertion; a default test that calls the network fails the no-live-calls check.

**Expected Outcome**:
- Default CI makes zero live calls; the opt-in live smoke asserts only structural invariants against the real repository, never volatile counts; CI topology is unchanged (no new job).

#### TC-VGATES-060 - An open-PR page at the declared limit is `ambiguous-open-pr` with or without a match

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-7, DM-9, DM-13, AC-F1-2, AC-F5-3, AC-F7-2, AC-F14-1, NFR-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-target.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/parity/at-limit/**`
**Tags**: @backend @corpus

**Preconditions**:
- A raw open-PR page of exactly `VERIFY_GATES_OPEN_PR_LIMIT` (100) entries: fixture (a) contains exactly one entry whose `sourceRef` equals the checkout branch; fixture (b) contains 100 entries none of which match the branch.
- A below-limit control page of 99 entries containing exactly one match.
- Repository facts: attached branch and a readable local HEAD; a complete ledger and a work item so non-branch gates can run.
- Both push parity and squash preflight consume the same resolution fixture and the same rule (DM-13).

**Steps**:
1. Run the at-limit-with-match fixture; assert `push-parity` and `squash-preflight` both fail `ambiguous-open-pr` (definitive `fail`, not `unknown`, not `pass`); assert no arbitrary match is selected and no PR detail or check-run read follows.
2. Run the at-limit-without-match fixture; assert both gates fail `ambiguous-open-pr`, not `no-open-pr`; assert the resolution evidence records `openCount=100` and `matchCount=0` (or `1` for the with-match fixture) without treating the page as complete.
3. Assert both squash citations carry an empty `squash-signals` list, the delivery-request-detail source outcome is `not-attempted`, and the reason names the at-limit prerequisite; assert no `draft`/`mergeable` token is fabricated or defaulted.
4. Assert the overall result is `fail` with `verify.gates.failed`, exit 1; assert the lifecycle and owner gates still evaluate.
5. Run the 99-entry control with one match; assert the resolution is `resolved` and the gates evaluate (they may pass), proving the at-limit branch is specifically about the declared limit.
6. Assert exactly one bounded list read at `VERIFY_GATES_OPEN_PR_LIMIT`, no pagination, and no retry.
7. Negative control: removing one entry from each at-limit fixture (size 99) changes the resolution; restoring 100 entries restores `ambiguous-open-pr`, proving the limit check is live.

**Expected Outcome**:
- A raw open-PR page at `VERIFY_GATES_OPEN_PR_LIMIT` is `ambiguous-open-pr` for both parity and squash whether or not it contains a matching PR; it is never treated as a unique match or as `no-open-pr`; below-limit pages resolve normally.

#### TC-VGATES-061 - HTTP 404 absence is read-specific; matched detail is `head-unresolved`, check runs are `unknown` `read-failed`, other failures are `unknown`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, F-6, F-7, F-11, DM-14, AC-F3-5, AC-F3-6, AC-F5-2, AC-F5-4, AC-F6-2, AC-F7-2, AC-F11-1, AC-F14-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/providers/**`
**Tags**: @backend @provider

**Preconditions**:
- The fake GitHub transport returns HTTP 404 (`provider.not-found`) for each read in turn: open-PR list, matched PR detail, check runs for the resolved head SHA, and work item.
- Non-404 failure fixtures for the same reads: transport throw, 401, 403, 500, malformed payload; a credential failure; an unresolved repository binding.
- Readable controls for each read.
- The adapter-local `provider.not-found` kind is a `failureClass`, not an error-table code, and adds no operation or subpath export.

**Steps**:
1. Run the PR list 404 fixture; assert `push-parity` and `squash-preflight` fail `no-open-pr` (definitive), never a generic `unknown`; assert no detail read is attempted, the detail source outcome is `not-attempted`, the squash `squash-signals` list is empty, and the `commits`/`changedFiles` counts are omitted (unknown, never zero), while the citation still has at least one source and one reason (AC-F8-1).
2. Run the matched PR detail 404 fixture; assert the detail source outcome is `absent` and `ci-green`, `push-parity`, and `squash-preflight` all fail `head-unresolved` (never `no-open-pr` for squash, never a generic `unknown`); assert the squash `squash-signals` list is empty, the `commits`/`changedFiles` counts are omitted (unknown, never zero), the reason names the absent detail, and the citation still has at least one source and one reason (AC-F8-1). TC-VGATES-067 owns the focused cross-gate detail-404 assertions.
3. Run the work-item 404 fixture; assert `owner-gate` fails `ticket-unresolved` with source outcome `absent`, never `read-failed`; assert the read result is the adapter-local `provider.not-found`, carried as `failureClass: provider.not-found`, and no error-table code is used.
4. Run the check-run 404 fixture; assert `ci-green` is `unknown` `read-failed` (the commit may not be pushed yet), with source `github-check-runs:absent` and `failureClass: provider.not-found`; assert it is never a `fail`, never `failed`, and never `ci-no-runs`, and never a pass. TC-VGATES-068 owns the focused check-run assertions.
5. Run the non-404 transport/non-2xx/credential/binding fixtures; assert the affected gate is `unknown` with `read-failed` (`provider.payload.invalid`), `credential-unavailable`, or `address-unresolved` respectively; assert no 404 is flattened into this generic set.
6. Assert each source is read exactly once with no retry/pagination; assert no raw status text, response body, title, or canary leaks; assert every present `failureClass` is only `provider.payload.invalid` or `provider.not-found`.
7. Negative control: the readable control for each read yields its normal pass/fail evidence, proving the 404 and non-404 failures are live; the readable matched-detail control carries exactly two ordered `squash-signals` tokens (`draft=...` then `mergeable=...`) and the `commits`/`changedFiles` counts.

**Expected Outcome**:
- A definitive HTTP 404 is mapped per read: PR list → `no-open-pr`; matched PR detail → `head-unresolved` with source `absent` for `ci-green`, `push-parity`, and `squash-preflight`; work item → `ticket-unresolved`/`absent`; check runs → source `absent` and `unknown` `read-failed`, never `failed`/`ci-no-runs`; every other non-404 failure is `unknown`; no 404 is flattened into a generic provider failure. On the PR-list 404 (no detail read) and the matched detail 404 (`absent`) the squash citation has an empty `squash-signals` list with `commits`/`changedFiles` omitted (unknown, never zero), yet still carries at least one source and one reason, satisfying AC-F8-1.

#### TC-VGATES-062 - The lifecycle citation consumes structured `VerifyLedgerEvaluation` on the failure path

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-5, DM-11, DM-15, AC-F2-1, AC-F2-2, AC-F2-4, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/structure/verify-gates-imports.test.ts`
**Tags**: @backend

**Preconditions**:
- Incomplete full, incomplete LITE, malformed notes, missing-target, and registry-failed fixtures, each with a computed `VerifyLedgerEvaluation` expected value that pins the exact DM-15 field semantics for its outcome.
- A spy or wrapper on `EvaluateVerifyChange` that records the returned structured evaluation, and a separate wrapper control for `classifyVerifyChange` that confirms it delegates while preserving its existing shape; the gate itself must not call the wrapper.
- A decoy/canary string in the classifier's human-readable summary that differs from the structured fields.

**Steps**:
1. Run each incomplete and registry-failed fixture; assert the lifecycle citation's counts (`required`, `completed`, `missing`, `registryRecords`, `registryTransitions`, `overlaid`) equal the `VerifyLedgerEvaluation` fields for the same fixture, including on the failure path where the old classifier failure shape had no structured fields.
2. Assert every classified outcome (`finished`, `partial`, `state-unverified`) carries the ordered required/completed/missing phase arrays, declaration-derived `requiredCount`/`completedCount`, and registry evidence (`present: true` with record/transition/overlay counts); assert `state-unverified` keeps the evaluated phase arrays and counts while carrying the failed/torn registry evidence and the `state.*` identity.
3. Run the terminal document-failure fixtures (malformed pm-notes and missing target) and assert `variant: unknown`, `requiredPhases`/`completedPhases`/`missingPhases` are empty, `declaration.requiredCount = declaration.completedCount = 0`, `registry.present: false` with zero counts, and `kind`/`code` name the document failure; assert the source outcome is `failed` for malformed notes and `absent` for a missing target. Assert `failed` maps deterministically to lifecycle `fail` and `state-unverified` maps deterministically to lifecycle `unknown`, with no other field combination accepted.
4. Assert the ordered `missing-phases` name list equals `evaluation.missingPhases` in required-set order; assert registry counts are the unique record/transition/overlay counts and are never derived from the summary.
5. Assert the gate does not parse the human summary: change the decoy summary text (or instrument the summary parser) and assert the citation values are unchanged; mutate an evaluation field and assert the citation follows it. Assert the gate has no `classifyVerifyChange` dependency; the wrapper relationship is exercised only as the separate wrapper control below.
6. Assert `classifyVerifyChange` wraps the same evaluator and keeps its existing success/failure shape (a byte-preserving wrapper, not the gate's dependency); run a `verify change` control and assert its output is unchanged.
7. Negative control: a fixture that returns an incomplete evaluation but an empty/missing summary still yields the structured counts and missing phases; a fixture that returns empty arrays/zero counts for a classified outcome or non-empty arrays for a terminal failure fails the assertion; a summary-only implementation that loses the counts fails the assertion.

**Expected Outcome**:
- The lifecycle citation's variant, required/completed/missing counts, ordered `missing-phases`, and unique registry evidence come from `VerifyLedgerEvaluation` on both completion and failure; classified outcomes carry ordered arrays/counts/registry evidence, terminal document failures carry empty arrays/zero counts/registry `present: false` plus the document failure identity, and `failed`/`state-unverified` map deterministically to `fail`/`unknown`; the gate never parses a prose summary and does not depend on `classifyVerifyChange`, which remains a behavior-preserving wrapper.

#### TC-VGATES-063 - Shared `humanText` dispatch preserves `verify change` bytes and renders the gates report

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-1, DM-12, AC-F10-2, AC-F10-3, NFR-3, NFR-4, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts`, `tests/fixtures/verify-gates/golden/verify-change-human.txt`
**Tags**: @backend @cli @golden

**Preconditions**:
- A pre-change `verify change GH-178` human-output golden captured from the delivered behavior (the pre-change `humanSuccess`/`humanJson` redact-then-serialize pipeline; `humanText` returns `undefined` for `change`, so the fallback renders the output).
- An all-pass `verify gates GH-178` fixture; fixed brand, clock, and `runId`; `runCli` in process.
- The single `verify` command definition with one `humanText` hook returning `string | undefined`: the six-line gates report for `target: "gates"` and `undefined` for every other target; `humanSuccess` may remain but only a defined `humanText` result takes precedence.
- A planted secret whose raw form differs from its JSON-escaped form (a fake token containing a double quote, a backslash, and a newline, for example the two-line value `tok"en\\path` followed by a newline and `break`), injected through the `secrets` dependency and placed in the `verify change` data and in a gates citation/identity value; the pre-change golden is captured from the same secret-bearing `verify change` data.

**Steps**:
1. Run `verify change GH-178` in human mode with injected dependencies; assert stdout is byte-identical to the pre-change golden and contains no six-line gates report.
2. Run `verify gates GH-178` in human mode; assert stdout is exactly six lines (header plus five gate lines) per Appendix E.
3. Assert the `verify` definition declares a single `humanText` hook with the widened `string | undefined` contract; when `data.target === "gates"` it returns the six-line gates report; for every other target (including `change`) it returns `undefined`.
4. Assert `verify change` does not use `humanText`: the `undefined` result falls through to the delivered `humanSuccess`/`humanJson` path, which redacts the data object before serialization (redact-then-serialize); only `verify gates` renders through `humanText`, where string redaction applies to the rendered report.
5. Run `verify change --json` and `verify gates --json`; assert machine mode is unchanged: exactly one envelope, no success text, and the existing envelope/data shape.
6. Run a failing `verify gates` invocation in human mode; assert no success text is printed and the diagnostic carries the bounded failure summary.
7. Assert there is no second `verify` command definition or subcommand-specific human renderer.
8. Inject the planted secret in the injected `secrets` list and place it in both the `verify change` data fixture used to capture the pre-change golden and a gates citation/identity value. Re-run `verify change GH-178` in human mode with the secret-bearing data and assert stdout is still byte-identical to the pre-change golden, including for the JSON-escaping-sensitive secret whose raw form is not a contiguous substring of its JSON-escaped form; assert neither its stdout nor stderr contains the raw secret or its JSON-escaped form. Run `verify gates` in human and `--json` modes; assert the six-line report and the machine envelope both redact every occurrence of the secret, that no unredacted secret (raw or JSON-escaped) appears in stdout, stderr, the human report, or the machine envelope, and that the envelope still satisfies `assertEnvelopeContract`. Assert redaction applies to the data object before serialization on the `verify change` path and to the rendered string on the gates path, and that both paths redact the secret.
9. Negative control: a hook that returns gates text for `target: "change"` fails the byte-equality assertion; a hook that returns a JSON string for `target: "change"` instead of `undefined` fails the byte-equality/redaction-order assertion for the JSON-escaping-sensitive secret; a hook that returns JSON for `target: "gates"` fails the six-line assertion; the correct dispatch (`undefined` for change, six-line report for gates) passes.

**Expected Outcome**:
- `verify gates` human success prints the six-line gates report. `verify change` human output is byte-identical to today under the same data and under the planted-secret fixture, including for a JSON-escaping-sensitive secret (quote/backslash/newline), because `humanText` returns `undefined` for `change` and the delivered redact-then-serialize pipeline stays in charge; `verify change` does not use `humanText`. Machine mode and failure output are unchanged. The planted secret is redacted on both paths — data-object redaction before serialization for `verify change`, string redaction of the rendered gates report — with no unredacted (raw or JSON-escaped) secret in stdout, stderr, the human report, or the machine envelope; one shared hook with `humanText` precedence only when it returns a string is the only dispatch.

#### TC-VGATES-064 - Mergeability precedence is deterministic, including `mergeable === true` with blocked/behind/unstable/draft

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-12, DM-7, DM-11, AC-F7-2, AC-F7-3, AC-F12-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/providers/github-gate-facts.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/squash/mergeability-precedence/**`
**Tags**: @backend @provider

**Preconditions**:
- Provider payloads covering the full cross-product: `mergeable` true/false/null/absent × `mergeable_state` clean/dirty/blocked/behind/unstable/draft/computing/null/absent/unrecognized, including the contradictory `mergeable === true` + blocked/behind/unstable/draft cases.
- Squash gate fixtures built from each normalized outcome; a positive control with true + clean and true + absent state.
- No other gate failures, so the squash verdict is isolated.

**Steps**:
1. Assert normalization precedence: (1) `mergeable === false` with a clean or dirty state, or `mergeable_state === "dirty"`, → `conflicting`; (2) `mergeable_state` in blocked/behind/unstable/draft → `not-mergeable` even when `mergeable === true`; (3) null/absent/computing/unrecognized with `mergeable !== true` → `unknown`; (4) `mergeable === true` with clean/absent state → `mergeable`; (5) any remaining combination → `unknown`.
2. Assert `mergeable === true` + blocked/behind/unstable fails `squash-not-mergeable` with `squash-signals` `mergeable=not-mergeable`; assert `mergeable === true` + draft fails `squash-draft` by precedence while its `squash-signals` still renders `draft=true` then `mergeable=not-mergeable`; assert neither passes and neither renders `mergeable=mergeable`.
3. Assert false/dirty (including false + clean) fails `squash-conflicting` with `mergeable=conflicting`.
4. Assert null/absent/computing/unrecognized fails `squash-mergeability-unknown` with `mergeable=unknown`.
5. Assert true + clean/absent passes `squash-ready` with `mergeable=mergeable` when the other surface facts are positive.
6. Assert the mapping is not field-order-dependent and replays identically; assert no combination defaults to `mergeable`.
7. Negative control: a mapping that treats `mergeable === true` as mergeable regardless of state fails the blocked case; a mapping that treats null/absent as mergeable fails the unknown case; the correct precedence passes.

**Expected Outcome**:
- The mergeability precedence is fixed and deterministic: false/dirty → `conflicting`; blocked/behind/unstable/draft → `not-mergeable` even with `mergeable === true`; null/absent/computing/unrecognized → `unknown`; true + clean/absent → `mergeable`; no unknown or contradictory state is ever treated as mergeable.

#### TC-VGATES-065 - Workspace inventories register the new contract module and every new export

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`, `tests/structure/port-contract-inventory.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/inventory.json`, `tests/fixtures/ports/v1-contract-inventory.json`
**Tags**: @backend @structure

**Preconditions**:
- The new `packages/core/src/contracts/verify-gates.ts` contract module and the new domain/adapters/CLI modules exist.
- `tests/fixtures/ports/v1-contract-inventory.json` lists every contract module; `tests/structure/content-inventory.test.ts` requires every exported function/const in package source files to appear in `EXECUTABLE_ALLOWANCES`, including `commands/index.ts` if the new definition is barrel-exported.
- No new package, subpath, declared entrypoint, runtime-API location, or dependency is added.

**Steps**:
1. Assert `tests/fixtures/ports/v1-contract-inventory.json` gains the new `verify-gates.ts` module with its exact export surface; assert `compareInventory` reports no unlisted contract module, no unlisted export, and no stale entry.
2. Assert `EXECUTABLE_ALLOWANCES` includes every new exported function/const from the new contracts/domain/adapters/CLI modules (for example the `VERIFY_GATES_*` constants, `evaluateVerifyGates`, renderer helpers, the `gates` handler, and any `commands/index.ts` barrel export).
3. Assert `tests/structure/inventory.json` lists the new source modules added in phases 1, 3, and 5.
4. Assert subpath export names, declared entrypoints, workspace edges, and dependency sets are unchanged; run `bun run scripts/checks/workspace-entrypoints.ts` and assert exit 0.
5. Negative control: in a temp copy, remove the contract module from `v1-contract-inventory.json` and assert `port-contract-inventory.test.ts` fails naming it; remove one new export from `EXECUTABLE_ALLOWANCES` and assert `content-inventory.test.ts` fails naming it; the unmutated tree is green.
6. Assert the changeset is a minor changeset for the affected existing packages; assert no new package or dependency appears.

**Expected Outcome**:
- `tests/fixtures/ports/v1-contract-inventory.json` includes the new contract module, `EXECUTABLE_ALLOWANCES` covers every new exported function/const, inventory manifests list the new modules, and no subpath/entrypoint/dependency drift exists; removing either entry fails the bound inventory check by name.

#### TC-VGATES-066 - The new verify-gates feature doc is registered in the forbidden-literal corpus

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-9, Appendix H
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts`, `scripts/checks/forbidden-literals.registry.json`, `tests/checks/forbidden-literals.test.ts`
**Tags**: @backend @structure @security

**Preconditions**:
- The new `doc/spec/features/feature-verify-gates.md` exists with `ados_distribution: internal`.
- `scripts/checks/forbidden-literals.registry.json` has a `registered` list and a `corpusBaseline`; the check fails when a registered user-facing doc is absent at baseline but unregistered.
- The doc-distribution check is available (`bash scripts/.tests/test-doc-distribution.sh`).

**Steps**:
1. Assert `doc/spec/features/feature-verify-gates.md` is listed in the `registered` list of `scripts/checks/forbidden-literals.registry.json`.
2. Run `bun run scripts/checks/forbidden-literals.ts`; assert exit 0 and no "unregistered user-facing doc absent at corpusBaseline" diagnostic.
3. Assert the doc declares `ados_distribution: internal` and contains no product/binary literal; assert the registry baseline remains internally consistent.
4. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit 0.
5. Negative control: in a temp copy, remove the doc from the registry and assert the check fails naming it; add a forbidden product literal to the doc and assert the check fails; the unmutated tree is green.
6. Assert no new doc-distribution allowlist entry is hand-maintained outside the marker/registry mechanism.

**Expected Outcome**:
- The new verify-gates feature doc is registered in the forbidden-literal corpus, the forbidden-literal and doc-distribution checks are green, and an unregistered/missing or literal-bearing doc is detected by name.

#### TC-VGATES-067 - A matched PR-detail 404 fails CI, parity, and squash with `head-unresolved` and source `absent`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, F-7, F-11, DM-14, AC-F3-5, AC-F5-4, AC-F7-2, AC-F11-1, AC-F14-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/fixtures/verify-gates/providers/github/absence-404/**`
**Tags**: @backend @provider

**Preconditions**:
- Fake GitHub transport: the open-PR list returns exactly one delivery request whose `sourceRef` equals the checkout branch; the detail read for that number returns HTTP 404 (`provider.not-found`).
- Non-404 detail-failure fixtures for the same read: transport throw, 401, 403, 500, malformed payload, credential failure, and unresolved repository binding.
- A readable detail control and a complete ledger/work item so the non-detail gates can evaluate.

**Steps**:
1. Run the detail-404 fixture; assert `ci-green`, `push-parity`, and `squash-preflight` all fail with reason `head-unresolved` and citation source `github-delivery-request-detail:absent`; assert none is a generic `unknown`, and squash is never `no-open-pr`.
2. Assert no check-run read is issued and no head SHA is fabricated; assert the CI citation names the absent detail source and the available identity (change ref, branch, PR).
3. Assert the squash citation's `squash-signals` list is empty (the detail was attempted and 404'd, so no value is fabricated or defaulted), that `commits`/`changedFiles` are omitted as unknown and are not rendered as zero, and that the citation still has at least one source and at least one reason, satisfying AC-F8-1; assert the reason names the absent detail prerequisite and the list is not populated with a synthetic token.
4. Assert the overall result is `fail` with `verify.gates.failed`, exit 1; assert the lifecycle and owner gates still evaluate; assert no success envelope and no `data`.
5. Run each non-404 detail failure; assert the three detail-consuming gates are `unknown` with `read-failed` (`failureClass: provider.payload.invalid`), `credential-unavailable` (`failureCode: config.credential.missing`), or `address-unresolved`, never `head-unresolved`, never a pass; assert the detail source outcome is `failed`, the squash `squash-signals` list is empty with `commits`/`changedFiles` omitted (unknown, never zero), and the citation still has at least one source and one reason (AC-F8-1); assert `failureClass` is only a declared read-result code.
6. Assert each source is read exactly once with no retry or pagination.
7. Negative control: the readable detail fixture yields the normal gate evidence (it may pass), including a `squash-signals` list with exactly two ordered tokens (`draft=...` then `mergeable=...`) and the `commits`/`changedFiles` counts, proving the 404 and non-404 outcomes are live; restoring the detail after the 404 removes `head-unresolved`.

**Expected Outcome**:
- A matched PR whose detail read returns HTTP 404 is definitive absence: `ci-green`, `push-parity`, and `squash-preflight` all fail `head-unresolved` with source `absent`, never a generic `unknown` and never squash `no-open-pr`; a non-404 detail failure remains `unknown` with source outcome `failed`; on both paths the squash signals are empty with `commits`/`changedFiles` omitted (unknown, never zero), the prerequisite is named, and the citation still has at least one source and one reason (AC-F8-1); a successful detail read yields exactly two ordered tokens.

#### TC-VGATES-068 - A check-run 404 is source `absent` and `unknown` `read-failed`, never `failed` or `ci-no-runs`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-8, F-11, DM-14, AC-F3-6, AC-F11-1, AC-F14-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/providers/github/absence-404/**`
**Tags**: @backend @provider

**Preconditions**:
- A resolved head SHA and a valid expected job set; the check-runs read for that SHA returns HTTP 404 (`provider.not-found`).
- Distinguishing controls: a readable zero-run page (`ci-no-runs`) and a readable page with a failed run (`ci-failed`), so the 404 cannot be confused with either.
- Non-404 check-run failure fixtures (transport throw, 500, malformed payload, credential failure, unresolved binding).

**Steps**:
1. Run the check-run 404 fixture; assert `ci-green` is `unknown` with reason `read-failed` and source `github-check-runs:absent` carrying `failureClass: provider.not-found`; assert the verdict is not `fail`, the reason is not `ci-no-runs`, and the gate never passes.
2. Assert no success envelope is emitted; when no other gate fails, assert the overall result is `unknown` and uses the first resolvable unknown identity or `verify.gates.unavailable`, with the declared exit.
3. Assert the check-run read is attempted exactly once with no retry and no pagination; assert no zero-run or failed-run state is synthesized from the 404.
4. Run each non-404 check-run failure; assert `ci-green` is `unknown` with `read-failed` (`failureClass: provider.payload.invalid`), `credential-unavailable`, or `address-unresolved`; assert no check-run failure passes.
5. Assert the zero-run control remains `ci-no-runs` and the red control remains `ci-failed`, proving the 404 path is distinct and non-vacuous.
6. Negative control: the readable check-run control evaluates normally; a 500 response stays `provider.payload.invalid`, never `provider.not-found`.

**Expected Outcome**:
- A check-run HTTP 404 is a definitive absence for that read: source outcome `absent`, gate `unknown` `read-failed`, never `failed`, never `ci-no-runs`, and never a pass; other check-run failures remain `unknown`; the zero-run and red controls keep their own reasons.

#### TC-VGATES-069 - New domain symbols import from the `@delivery-os/core` package root and one verify definition accepts the combined runtime

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-10, F-13, DM-12, AC-F1-1, AC-F10-3, AC-F13-1, NFR-6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-exports.test.ts`, `tests/behaviour/verify-gates-surface.test.ts`, `tests/golden/verify-gates.test.ts`, `tests/fixtures/verify-gates/golden/verify-change-human.txt`
**Tags**: @backend @structure @cli

**Preconditions**:
- `packages/core/src/index.ts` re-exports `EvaluateVerifyChange`, `VerifyLedgerEvaluation`, `evaluateVerifyGates`, and the renderers additively; `packages/core/package.json` declares no new subpath.
- `createVerifyCommandDefinition` accepts a combined runtime with both `change` and `gates`; `ConfigProgramOptions.verify` stays the only option and is typed to it.
- A pre-change `verify change GH-178` human-output golden and an all-pass gates fixture with fixed brand/clock/runId.

**Steps**:
1. Import `EvaluateVerifyChange`, `VerifyLedgerEvaluation` (type), `evaluateVerifyGates`, and the renderers from `@delivery-os/core` (the package root); assert every symbol is defined and callable/constructible as declared.
2. Assert `packages/core/package.json` subpath exports are unchanged and no test or production file imports the new symbols from a new `@delivery-os/core/domain` or other subpath; assert the additive named export list in `packages/core/src/index.ts` is the only new surface.
3. Call `createVerifyCommandDefinition` with the combined runtime; assert it returns one definition exposing both `change` and `gates`, dispatches on the first positional after grammar validation, and that `ConfigProgramOptions.verify` is typed to the combined runtime; assert no second `verify` definition exists.
4. Run `verify change GH-178` in human mode and assert stdout is byte-identical to the pre-change golden; run `verify gates GH-178` and assert the six-line gates report; assert only the `humanText` dispatch differs.
5. Assert `verify change --json` and `verify gates --json` each emit exactly one valid envelope with the existing envelope shape.
6. Negative control: in a temp copy, remove one package-root re-export and assert the import check fails naming it; supply a runtime missing `gates` and assert the gates subcommand does not dispatch (or the typecheck fails); restore and assert green.

**Expected Outcome**:
- The new pure domain symbols are importable from the `@delivery-os/core` package root with no new subpath; `createVerifyCommandDefinition` accepts the combined `change`+`gates` runtime and dispatches both subcommands; `verify change` human output remains byte-identical.

#### TC-VGATES-070 - CI counts use the declared denominators, no double-bucketing, and an unrecognized state cannot pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-11, AC-F3-1, AC-F3-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-ci.test.ts`, `tests/fixtures/verify-gates/ci/counts/**`, `tests/fixtures/verify-gates/ci/unrecognized-state/**`
**Tags**: @backend @corpus

**Preconditions**:
- A valid 23-name expected set and observed pages: all succeeded; an extra non-expected success; one failed; one pending; one canceled; one skipped; duplicate observed names; one unrecognized state; and a mixed page.
- Each fixture pins the exact `expected`, `runs`, `succeeded`, `failed`, `pending`, `skipped`, `canceled`, and `missing` values.

**Steps**:
1. Assert `expected` equals the declared expected name count and `missing` equals the expected names not observed; assert an extra non-expected run changes `runs`/its state bucket but never `expected` or `missing`.
2. Assert `runs` equals the observed normalized page size and each observed run contributes to exactly one state bucket; assert the five state counts plus the unrecognized count sum to `runs`, with no run double-counted across `succeeded`/`failed`/`pending`/`skipped`/`canceled`.
3. Assert duplicate observed names collapse to the worst effective state and are counted once; assert a failed duplicate is not hidden by a succeeded duplicate.
4. Assert an unrecognized run state contributes only to `runs` (not to any state bucket), is treated as a failed observation, and makes the gate `fail` `ci-failed`, never `pass`.
5. Assert a green page passes only when the counts align with its expected set, and that the overall result follows the gate verdict.
6. Negative control: an implementation that uses the observed page as the expected set, counts a run in two buckets, or lets an unrecognized state pass fails the fixture; the correct evaluator passes.

**Expected Outcome**:
- CI counts use the declared denominators and one state bucket per observed run; `expected`/`missing` are over the expected set, `runs` is observed, extra runs do not dilute the expected set, and an unrecognized state cannot fabricate a pass.

## 6. Environments and Test Data

### 6.1 Environments

- **Local development and CI**: Bun `1.4.4` (pinned in `.bun-version` and `package.json`), pnpm `10.18.3`, Node-compatible Linux/macOS. The default suite runs entirely in process with injected facts and a fake GitHub transport; no network, credential, or real state directory is required.
- **Default CI**: the existing `ci.yml` jobs only. The new suites run under the existing TypeScript `test` job; structure/checks under the existing typecheck/test/check jobs; boundaries under the existing boundary job. No new job is added and `scripts/checks/ci-topology.ts` job id sets are unchanged.
- **Opt-in live smoke**: developer workstation or PR environment with a credential-reference GitHub instance and `VERIFY_GATES_LIVE=1`; never part of `pnpm check` or default CI. Its evidence artifact must be bounded and secret-free before attachment.

### 6.2 Fixture Layout

```text
tests/fixtures/verify-gates/
  cases/                       # shared fact builders and case helpers (never *.test.ts)
    network-guard.ts           # createNoNetworkGuard() install/restore no-live guard fixture
  lifecycle/
    full/                      # complete full, registry-overlaid full
    lite/                      # complete LITE, non-LITE-incomplete control
    incomplete/                # single/multi missing, malformed, missing target, overlay
    state-platform/            # torn store, schema mismatch
    state-user/                # user-category state failure
  ci/
    green/                     # all 23 expected green
    red/                       # one red, failed job names
    pending-canceled/          # running, queued, canceled, mixed
    no-runs/                   # zero runs
    all-skipped/               # all skipped, extra success
    missing/                   # one missing, nine missing (cap/omitted)
    truncated/                 # 100-run page, 99-run control
    compare/                   # extra runs, duplicate observed names, case mismatch
    counts/                    # declared denominators, extra runs, no double-bucketing
    unrecognized-state/        # unrecognized run state cannot pass
    head-unresolved/           # absent/invalid SHA
  workflows/                   # valid, absent, unreadable, malformed, empty, duplicate, over-cap, over-long, 256 KiB
  parity/
    match/ mismatch/ failures/ at-limit/ # match, mismatch, detached, missing head, zero/lone-nonmatching/multiple PR, at-limit with/without match
  owner/
    absent/ present/ unresolved/
  squash/
    ready/ base-draft-open/ mergeability/ mergeability-precedence/ surface/
  composition/
    grammar/ credentials/ network/ binding/ budget/
  output/
    citations/ summary/ human/ bounds/
  corpus/
    cases.json                 # one case per gate/verdict/reason + ticket/at-limit/branch-mismatch/404 cases
    red-pipeline/ missing-job/ vacuous-green/ push-mismatch/ owner-present/ bad-squash/
  golden/
    success-data.json          # serialized data golden
    failure-summary.txt        # failure summary golden
    human-success.txt          # human report golden
    verify-change-human.txt    # pre-change verify change human-output golden (byte preservation)
  providers/github/
    pr-list/ pr-detail/ check-runs/ issue/ absence-404/  # absence-404 covers PR-detail, PR-list, check-run, work-item 404s
tests/fixtures/providers/
  traps/github.traps.json       # trap catalog (four-field entries)
  github/                       # trap payloads referenced by the catalog; never under tests/fixtures/verify-gates/
```

Every fixture is JSON, YAML, or a `.txt` golden; none is named `*.test.ts`. Case ids in the corpus manifest are stable and unique. A fixture may be shared by a behaviour suite and the corpus, but the corpus case is the completeness oracle. Trap payloads and catalogue entries live under `tests/fixtures/providers/` (catalog under `tests/fixtures/providers/traps/`, payloads under `tests/fixtures/providers/github/**`); behavioural fixtures live under `tests/fixtures/verify-gates/providers/...`. A trap `fixtureReference` never points into `tests/fixtures/verify-gates/`, and a behavioural fixture is not a substitute for a catalog trap.

### 6.3 Test Data Generation, Isolation, and Hygiene

- **Synthetic fixtures** are built by `tests/fixtures/verify-gates/cases/**` helpers that deep-clone a base, apply one mutation, and assert the mutation is present (following `tests/behaviour/verify-support.ts`).
- **Temporary workspaces** use `mkdtempSync` under `tmp/` for pm-notes, registry, workflow, and output; they are removed after each test. The live change tree and state directory are never written.
- **Fixed injection**: brand `example-product`, a two-tick clock, and a fixed `runId` make byte comparisons stable. The real brand/clock/run id are injected only in the opt-in live smoke.
- **Canaries**: every negative fixture carries a unique `planted-payload-verify-gates-*` string, a fake token, and a fake title/comment/commit string; the run asserts they never appear in output.
- **No secrets**: fixtures contain only synthetic labels, SHAs, job names, and counts. No real credential or repository payload is committed.
- **Fake transport**: the fake GitHub transport records method/path/query and rejects writes and out-of-budget requests; it is the only network seam in the default suite.
- **404 and trap fixtures**: `provider.not-found` fixtures live under `tests/fixtures/verify-gates/providers/**` for behaviour and under `tests/fixtures/providers/github/**` for catalog traps; the two locations are never mixed. Each 404 fixture also has a readable control so the absence mapping is non-vacuous. A matched PR-detail 404 is shared by the CI, parity, and squash suites, and a check-run 404 is distinguished from a readable zero-run page and a readable red page.
- **No-live guard**: `tests/fixtures/verify-gates/cases/network-guard.ts` is the named guard fixture; its self-test proves a forbidden call throws, and the default suite runs under it with zero live calls.
- **Declared `failureClass`**: fixtures that model provider failures carry only `provider.payload.invalid` or `provider.not-found`; a free-form class is a test defect, and an error-table failure uses `failureCode` with no `failureClass`.

## 7. Automation Plan and Implementation Mapping

Status values: **To Implement** (new change), **Existing – Update** (extend an existing suite), **Existing – No Change** (reused as-is). All verify-gates suites are new except where noted.

| TC ID | Test file(s) | Execution command | Injected seams / fakes | Status |
|-------|--------------|-------------------|------------------------|--------|
| TC-VGATES-001 | `tests/structure/verify-gates-contract.test.ts` | `bun test tests/structure/verify-gates-contract.test.ts` | None (contract data) | To Implement |
| TC-VGATES-002 | `tests/structure/verify-gates-imports.test.ts` | `bun test tests/structure/verify-gates-imports.test.ts` | AST scans; in-memory snippets | To Implement |
| TC-VGATES-003 | `tests/structure/delivery-request-gate-facts.test.ts` | `bun test tests/structure/delivery-request-gate-facts.test.ts` | Type-level objects | To Implement |
| TC-VGATES-004 | `tests/structure/error-table.test.ts` | `bun test tests/structure/error-table.test.ts` | Deep-copied error table | Existing – Update |
| TC-VGATES-005 | `tests/structure/content-inventory.test.ts`, `subpaths.test.ts`, `port-contract-inventory.test.ts`; `scripts/checks/workspace-entrypoints.ts` | `bun test tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/structure/port-contract-inventory.test.ts`; `bun run scripts/checks/workspace-entrypoints.ts` | Temp-copy manifests | Existing – Update |
| TC-VGATES-006 | `scripts/checks/{ambient-globals,forbidden-literals,privacy-literals,secret-read-boundary}.ts`; `tests/checks/*` | `bun run scripts/checks/ambient-globals.ts` (and siblings) | Temp-copy violations | Existing – Update |
| TC-VGATES-007 | `tests/boundaries/**` | `bun test tests/boundaries` | depcruise + fixture registry | Existing – No Change (extend fixtures only if a rule is added) |
| TC-VGATES-008 | `tests/behaviour/verify-gates-surface.test.ts` | `bun test tests/behaviour/verify-gates-surface.test.ts` | Recording runtime; `runCli`; throwing reads | To Implement |
| TC-VGATES-009 | `tests/behaviour/verify-gates-surface.test.ts` | `bun test tests/behaviour/verify-gates-surface.test.ts` | `runCli`; all-pass facts | To Implement |
| TC-VGATES-010 | `tests/behaviour/verify-gates-surface.test.ts` | `bun test tests/behaviour/verify-gates-surface.test.ts` | Pure evaluator; recording reads | To Implement |
| TC-VGATES-011 | `tests/behaviour/verify-gates-target.test.ts` | `bun test tests/behaviour/verify-gates-target.test.ts` | Fake repo facts; fake PR list; below-limit resolution fixtures | To Implement |
| TC-VGATES-012 | `tests/behaviour/verify-gates-target.test.ts`, `verify-gates-lifecycle.test.ts` | `bun test tests/behaviour/verify-gates-target.test.ts tests/behaviour/verify-gates-lifecycle.test.ts` | Fake repo facts; recording transport | To Implement |
| TC-VGATES-013 | `tests/behaviour/verify-gates-lifecycle.test.ts` | `bun test tests/behaviour/verify-gates-lifecycle.test.ts` | Real pm-notes/registry readers over temp workspace; `EvaluateVerifyChange` structured-evaluation spy; no classifier dependency | To Implement |
| TC-VGATES-014 | `tests/behaviour/verify-gates-lifecycle.test.ts` | `bun test tests/behaviour/verify-gates-lifecycle.test.ts` | Same | To Implement |
| TC-VGATES-015 | `tests/behaviour/verify-gates-lifecycle.test.ts` | `bun test tests/behaviour/verify-gates-lifecycle.test.ts` | Same; overlay builders | To Implement |
| TC-VGATES-016 | `tests/behaviour/verify-gates-lifecycle.test.ts` | `bun test tests/behaviour/verify-gates-lifecycle.test.ts` | State harness; torn/schema fixtures | To Implement |
| TC-VGATES-017 | `tests/behaviour/verify-gates-lifecycle.test.ts` | `bun test tests/behaviour/verify-gates-lifecycle.test.ts` | State harness; user-category fixture | To Implement |
| TC-VGATES-018 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; workflow + check-run facts | To Implement |
| TC-VGATES-019 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; red fixture | To Implement |
| TC-VGATES-020 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; missing fixtures | To Implement |
| TC-VGATES-021 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; zero-run fixture | To Implement |
| TC-VGATES-022 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; all-skipped fixtures | To Implement |
| TC-VGATES-023 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; pending/canceled fixtures | To Implement |
| TC-VGATES-024 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; 100-run and 99-run facts | To Implement |
| TC-VGATES-025 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | File adapter over workflow fixtures; pure evaluator | To Implement |
| TC-VGATES-026 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | File adapter; pure evaluator | To Implement |
| TC-VGATES-027 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; head-SHA facts | To Implement |
| TC-VGATES-028 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; repo + PR facts | To Implement |
| TC-VGATES-029 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; repo + PR facts | To Implement |
| TC-VGATES-030 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; below-limit failure fixtures | To Implement |
| TC-VGATES-031 | `tests/behaviour/verify-gates-parity-squash.test.ts`, `verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts tests/behaviour/verify-gates-owner-composition.test.ts` | Failing fake transport; binding/credential facts | To Implement |
| TC-VGATES-032 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Pure evaluator; work-item facts | To Implement |
| TC-VGATES-033 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Pure evaluator; label fixtures | To Implement |
| TC-VGATES-034 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Failing fake transport; work-item 404 and non-404 refs | To Implement |
| TC-VGATES-035 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; ready PR facts; `squash-signals` pass assertion | To Implement |
| TC-VGATES-036 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; base/draft/open fixtures; `squash-signals` preserved on every fail | To Implement |
| TC-VGATES-037 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; mergeability fixtures; conflicting/not-mergeable signal values | To Implement |
| TC-VGATES-038 | `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts` | Pure evaluator; surface fixtures; absent mergeability renders `mergeable=unknown` | To Implement |
| TC-VGATES-039 | `tests/behaviour/verify-gates-owner-composition.test.ts`, `verify-gates-parity-squash.test.ts`, `verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts tests/behaviour/verify-gates-parity-squash.test.ts tests/behaviour/verify-gates-ci.test.ts` | Failing fake transport per gate (non-404); empty `squash-signals` plus omitted `commits`/`changedFiles` on failed/unread detail; check-run 404 source `absent` control | To Implement |
| TC-VGATES-040 | `tests/behaviour/verify-gates-output.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts` | Pure evaluator; citation validator; `squash-signals` two-token/empty rule; omitted counts never zero | To Implement |
| TC-VGATES-041 | `tests/behaviour/verify-gates-output.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts` | Bounded fixtures; canaries | To Implement |
| TC-VGATES-042 | `tests/behaviour/verify-gates-output.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts` | `runCli`; fixed brand/clock/runId; five preserved summary lines; `squash-signals` names | To Implement |
| TC-VGATES-043 | `tests/behaviour/verify-gates-output.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts` | `runCli`; buffer streams | To Implement |
| TC-VGATES-044 | `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts tests/golden/verify-gates.test.ts` | `runCli`; `assertEnvelopeContract`; goldens | To Implement |
| TC-VGATES-045 | `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts tests/golden/verify-gates.test.ts` | Pure evaluator verdict matrices | To Implement |
| TC-VGATES-046 | `tests/behaviour/verify-gates-output.test.ts`, `tests/checks/exit-code-literals.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts tests/checks/exit-code-literals.test.ts`; `bun run scripts/checks/exit-code-literals.ts` | `runCli`; projection | Existing – Update |
| TC-VGATES-047 | `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | Temp-copy mutations | Existing – Update |
| TC-VGATES-048 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Credential port; external-system instances; recording transport | To Implement |
| TC-VGATES-049 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Failing fake transport (non-404); canaries | To Implement |
| TC-VGATES-050 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Fake repo facts; recording transport | To Implement |
| TC-VGATES-051 | `tests/behaviour/verify-gates-owner-composition.test.ts` | `bun test tests/behaviour/verify-gates-owner-composition.test.ts` | Recording adapters; no-spawn guard; temp workspace | To Implement |
| TC-VGATES-052 | `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts tests/golden/verify-gates.test.ts` | Fixed brand/clock/runId; key permutations | To Implement |
| TC-VGATES-053 | `tests/behaviour/verify-gates-performance.test.ts` | `bun test tests/behaviour/verify-gates-performance.test.ts` | Pure evaluator; capped facts | To Implement |
| TC-VGATES-054 | `tests/behaviour/providers/github-gate-facts.test.ts` | `bun test tests/behaviour/providers/github-gate-facts.test.ts` | Fake GitHub transport; committed PR payloads; mergeability precedence matrix | To Implement |
| TC-VGATES-055 | `tests/structure/trap-catalog.test.ts`, `tests/fixtures/providers/traps/github.traps.json` | `bun test tests/structure/trap-catalog.test.ts` | Temp-copy catalog mutations; fixture-location assertions | Existing – Update |
| TC-VGATES-056 | `tests/behaviour/providers/github-trap.test.ts` | `bun test tests/behaviour/providers/github-trap.test.ts` | Fake transport; all trap payloads under `tests/fixtures/providers/github/**` | Existing – Update |
| TC-VGATES-057 | `tests/behaviour/verify-gates-corpus.test.ts` | `bun test tests/behaviour/verify-gates-corpus.test.ts` | Corpus manifest; pure evaluator; per-case `squash-signals`, at-limit, branch-mismatch, and 404 expectations | To Implement |
| TC-VGATES-058 | `tests/behaviour/verify-gates-corpus.test.ts` | `bun test tests/behaviour/verify-gates-corpus.test.ts` | Corpus manifest; canaries; controls; missing/fabricated `squash-signals` negative | To Implement |
| TC-VGATES-059 | `tests/checks/verify-gates-no-live-calls.test.ts`, `tests/behaviour/verify-gates-live.test.ts`, `tests/fixtures/verify-gates/cases/network-guard.ts` | `bun test tests/checks/verify-gates-no-live-calls.test.ts`; opt-in `VERIFY_GATES_LIVE=1 bun test tests/behaviour/verify-gates-live.test.ts` | `createNoNetworkGuard()` install/restore fixture; real credential only in opt-in | To Implement |
| TC-VGATES-060 | `tests/behaviour/verify-gates-target.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-target.test.ts tests/behaviour/verify-gates-parity-squash.test.ts` | Fake PR list pages of 100 with/without a match; 99-entry control | To Implement |
| TC-VGATES-061 | `tests/behaviour/verify-gates-parity-squash.test.ts`, `tests/behaviour/verify-gates-owner-composition.test.ts`, `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-parity-squash.test.ts tests/behaviour/verify-gates-owner-composition.test.ts tests/behaviour/verify-gates-ci.test.ts` | Fake transport 404/non-404 per read; `provider.not-found`; matched-detail `absent`; empty signals plus omitted counts on no-usable-detail; check-run `absent`; controls | To Implement |
| TC-VGATES-062 | `tests/behaviour/verify-gates-lifecycle.test.ts`, `tests/structure/verify-gates-imports.test.ts` | `bun test tests/behaviour/verify-gates-lifecycle.test.ts tests/structure/verify-gates-imports.test.ts` | Real pm-notes/registry over temp workspace; `VerifyLedgerEvaluation` structured spy; DM-15 per-outcome fields; summary decoy; wrapper control | To Implement |
| TC-VGATES-063 | `tests/behaviour/verify-gates-output.test.ts`, `tests/golden/verify-gates.test.ts` | `bun test tests/behaviour/verify-gates-output.test.ts tests/golden/verify-gates.test.ts` | `runCli`; `humanText` returns `undefined` for `change`; redact-then-serialize golden; planted JSON-escaping-sensitive secret redacted on both paths | To Implement |
| TC-VGATES-064 | `tests/behaviour/providers/github-gate-facts.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/providers/github-gate-facts.test.ts tests/behaviour/verify-gates-parity-squash.test.ts` | Mergeability cross-product payloads; squash fixtures | To Implement |
| TC-VGATES-065 | `tests/structure/content-inventory.test.ts`, `tests/structure/port-contract-inventory.test.ts`, `tests/structure/subpaths.test.ts`; `tests/fixtures/ports/v1-contract-inventory.json`; `tests/structure/inventory.json`; `scripts/checks/workspace-entrypoints.ts` | `bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts`; `bun run scripts/checks/workspace-entrypoints.ts` | Temp-copy inventory/allowance mutations | Existing – Update |
| TC-VGATES-066 | `scripts/checks/forbidden-literals.ts`, `scripts/checks/forbidden-literals.registry.json`, `tests/checks/forbidden-literals.test.ts` | `bun run scripts/checks/forbidden-literals.ts`; `bun test tests/checks/forbidden-literals.test.ts`; `bash scripts/.tests/test-doc-distribution.sh` | Temp-copy registry/doc mutations | Existing – Update |
| TC-VGATES-067 | `tests/behaviour/verify-gates-ci.test.ts`, `tests/behaviour/verify-gates-parity-squash.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts tests/behaviour/verify-gates-parity-squash.test.ts` | Fake transport matched-detail 404 and non-404 detail failures; empty signals plus omitted counts; readable two-token detail control | To Implement |
| TC-VGATES-068 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Fake transport check-run 404; zero-run and red controls; non-404 check-run failures | To Implement |
| TC-VGATES-069 | `tests/structure/verify-gates-exports.test.ts`, `tests/behaviour/verify-gates-surface.test.ts`, `tests/golden/verify-gates.test.ts` | `bun test tests/structure/verify-gates-exports.test.ts tests/behaviour/verify-gates-surface.test.ts tests/golden/verify-gates.test.ts` | Package-root import check; combined `change`+`gates` runtime; pre-change `verify change` golden | To Implement |
| TC-VGATES-070 | `tests/behaviour/verify-gates-ci.test.ts` | `bun test tests/behaviour/verify-gates-ci.test.ts` | Pure evaluator; denominator/count fixtures; unrecognized-state fixture | To Implement |

**Focused verification commands** (run while iterating):

```bash
bun test tests/structure/verify-gates-contract.test.ts tests/structure/verify-gates-imports.test.ts tests/structure/verify-gates-exports.test.ts tests/structure/delivery-request-gate-facts.test.ts
bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts
bun test tests/behaviour/verify-gates-surface.test.ts tests/behaviour/verify-gates-target.test.ts
bun test tests/behaviour/verify-gates-lifecycle.test.ts
bun test tests/behaviour/verify-gates-ci.test.ts
bun test tests/behaviour/verify-gates-parity-squash.test.ts
bun test tests/behaviour/verify-gates-owner-composition.test.ts
bun test tests/behaviour/verify-gates-output.test.ts tests/golden/verify-gates.test.ts
bun test tests/behaviour/verify-gates-corpus.test.ts
bun test tests/behaviour/providers/github-gate-facts.test.ts tests/behaviour/providers/github-trap.test.ts
bun test tests/behaviour/verify-gates-performance.test.ts
bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts tests/checks/forbidden-literals.test.ts tests/checks/verify-gates-no-live-calls.test.ts
bun run scripts/checks/error-table-sync.ts
bun test tests/boundaries
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/privacy-literals.ts
bun run scripts/checks/secret-read-boundary.ts
bash scripts/.tests/test-doc-distribution.sh
bun run scripts/checks/workspace-entrypoints.ts
```

**Aggregate verification**:

```bash
pnpm typecheck
pnpm test
pnpm check
git diff --check
git status --porcelain
```

Record each focused command and its result summary in §10, then record the aggregate `pnpm check` result as the binding final evidence. A focused suite that passes but the aggregate fails is not done.

**Expected CI binding**: the new suites run under the existing TypeScript `test`/`typecheck`/boundary jobs in `.github/workflows/ci.yml`; no new job is added, and `scripts/checks/ci-topology.ts` and the job id sets are unchanged. The opt-in live smoke is not wired into CI.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation in this plan |
|----|------|-------------------------|
| R-1 | A squash citation fabricates, defaults, drops, or misorders the `squash-signals` tokens, emits an empty list when the detail was read successfully, or renders omitted surface counts as zero on a `failed`/`absent`/`not-attempted` detail. | TC-VGATES-035..042 assert the exact two ordered tokens on pass and every condition failure with a successful detail read, and the empty-list-plus-omitted-counts rule for a resolution failure (`not-attempted`), detail 404 (`absent`), and failed detail read (`failed`), while still requiring at least one source and one reason; TC-VGATES-057/058 add a per-case corpus expectation and a fabricated/missing-signal negative control. |
| R-2 | Time-of-check/time-of-use: the PR head SHA from the detail read could move before the check-runs read. | v1 is one bounded read per source and fails closed; tests use one coherent frozen fact bundle; the live smoke pins no volatile counts. |
| R-3 | The expected job set is read from the checkout, not the pushed head; a stale local workflow could misdescribe the pushed CI. | Push parity independently catches local/pushed divergence; the expected set is read per invocation; fixtures cover the stale/divergent case as a safe fail. |
| R-4 | Matrix-expanded names or `if: false` jobs produce false missing-job failures. | v1 reports missing rather than passing (safe false fail); tests pin the declared limitation and the M2-S7 deferral. |
| R-5 | Fixture drift from the real 23-job workflow. | A structure invariant test parses the real workflow and asserts unique names, count bounds, and name-length bounds; the corpus covers the 23-job shape. |
| R-6 | Live smoke flakiness or secret leakage. | Opt-in only, structural assertions only, no volatile counts, canary/secret assertions, excluded from `pnpm check`. |
| R-7 | SHA handling: short/invalid SHAs and case differences. | Tests assert 40/64-hex acceptance, rejection of short/non-hex, and case-insensitive equality. |
| R-8 | Error-table mutation tests accidentally write the live tree. | All mutations run on temp copies; the live tree is hashed before/after. |
| R-9 | Adding a boundary rule without a fixture makes the rule unenforced. | The fixture-coverage meta-check fails such a rule; if a new rule is needed, the fixture lands in the same change. |
| R-10 | A fixture corpus that passes vacuously on an empty manifest. | The non-vacuity meta-test fails on an empty/missing set and on a wrong-verdict case (TC-VGATES-058). |
| R-11 | An at-limit open-PR page is treated as a unique match or as `no-open-pr`, letting parity/squash pass or misreport. | TC-VGATES-060 asserts `ambiguous-open-pr` for both at-limit-with-match and at-limit-without-match through both gates; TC-011/030 pin the below-limit `no-open-pr`/`branch-mismatch`/`ambiguous-open-pr` split. |
| R-12 | A 404 is flattened into a generic `unknown`, hiding a missing work item/PR, or a matched PR-detail 404 is misreported per gate (for example squash `no-open-pr`), or a check-run 404 is misreported as `failed`/`ci-no-runs`. | TC-VGATES-061/067/068 pin the read-specific mapping; TC-034 owns the work-item case; TC-039/049 explicitly exclude PR/work-item 404 from the generic unknown matrix and pin the check-run 404 as source `absent`, `unknown` `read-failed`. |
| R-13 | The lifecycle gate parses the human summary, calls `classifyVerifyChange`, or duplicates ledger rules to obtain failure-path counts. | TC-VGATES-013 spies on the structured `EvaluateVerifyChange` and asserts no classifier dependency; TC-VGATES-062 asserts every count and ordered missing phase equals `VerifyLedgerEvaluation`, pins the DM-15 per-outcome fields, uses a summary decoy, and exercises `classifyVerifyChange` only as a wrapper. |
| R-14 | The `humanText` hook replaces `verify change` output or routes it through string redaction, changing its bytes or leaking a JSON-escaped secret. | TC-VGATES-063 asserts `humanText` returns `undefined` for `change`, byte equality against a pre-change golden under a JSON-escaping-sensitive secret, and the six-line gates report; a planted-secret control proves the secret is redacted on both paths — data-object redaction before serialization for `verify change`, string redaction of the rendered report for gates — with no unredacted secret in stdout, stderr, the human report, or the machine envelope; machine mode and failure text are unchanged. |
| R-15 | Mergeability is defaulted to `mergeable` for `mergeable === true` despite a blocked/dirty/draft state, or unknown is treated as mergeable. | TC-VGATES-064 asserts the fixed precedence matrix and both contradictory controls; TC-054 asserts the same precedence at normalization. |
| R-16 | The new contract module/exports or the new feature doc are missing from the binding inventories/registry, failing the structure or literal gates. | TC-VGATES-065 asserts `tests/fixtures/ports/v1-contract-inventory.json` and `EXECUTABLE_ALLOWANCES`; TC-VGATES-066 asserts `doc/spec/features/feature-verify-gates.md` is registered in `scripts/checks/forbidden-literals.registry.json`. |
| R-17 | The CLI cannot import the new evaluator/renderers because the package root does not re-export them, or the combined `change`/`gates` runtime seam is ambiguous. | TC-VGATES-069 asserts the package-root imports, unchanged subpaths, one verify definition, the combined runtime, and byte-identical `verify change` output. |
| R-18 | The lifecycle gate calls the wrapper or parses the summary, reintroducing duplicated ledger rules. | TC-VGATES-013 asserts the structured evaluator call and no classifier dependency; TC-VGATES-062 asserts the wrapper is only a byte-preserving wrapper. |
| R-19 | CI count denominators drift, a run is double-bucketed, or an unrecognized run state slips through as a pass. | TC-VGATES-070 pins the exact denominators, one bucket per observed run, and the unrecognized-state fail; TC-018/019/022 carry the same denominators in the positive/red/all-skipped fixtures. |
| R-20 | The new detail-404 rule is applied to only one gate, so CI/parity/squash disagree. | TC-VGATES-067 asserts all three detail-consuming gates fail `head-unresolved` with source `absent`; TC-061/057 keep the cross-read and corpus cases. |
| R-21 | `failureClass` drifts into free-form provider text, or an error-table failure also carries a class. | TC-VGATES-040/041 validate the closed read-result codes and the `failureCode`/`failureClass` exclusivity; TC-039/049/061/067/068 assert the actual class values. |

### 8.2 Assumptions

- The implementation plan `chg-GH-178-plan.md` is present and binding. It must map onto this TC set, identities, reasons, report shape, and AC mapping, and it carries the tasks for `VerifyLedgerEvaluation`, the `humanText` dispatch, read-specific 404 mapping, inventory/`EXECUTABLE_ALLOWANCES` updates, and forbidden-literal-registry registration.
- The fake GitHub transport mirrors the delivered client's transport seam; provider payloads are committed JSON fixtures, not live responses.
- The repository CI workflow is at `.github/workflows/ci.yml`, its job display names are unique, and the current topology has 23 jobs.
- A credential-reference GitHub instance is injected in tests; the live smoke uses the real port. The command reads no ambient environment.
- `main-tools` is the integration base; a different base requires a deliberate contract/edge change.
- The delivered pm-notes parser, registry reader, state layer, status owner labels, and result contract remain behaviourally unchanged; the additive `EvaluateVerifyChange`/`VerifyLedgerEvaluation` exposes the same rules and `classifyVerifyChange` wraps it without changing `verify change`.
- The CLI imports the new pure domain symbols from the `@delivery-os/core` package root; no new subpath or entrypoint is required, and one `verify` definition accepts the combined `change`+`gates` runtime.
- The default suite's no-live guard is `createNoNetworkGuard()` from `tests/fixtures/verify-gates/cases/network-guard.ts`, installed in process; no real network or credential is needed.
- DM-15 field semantics are binding: classified outcomes carry ordered arrays/counts/registry evidence, terminal failures carry empty arrays/zero counts/`registry.present: false` plus the document failure identity, `failed` → `fail`, and `state-unverified` → `unknown`.
- The handler accepts one non-empty change ref; `ticket-unresolved` is exercised with a malformed/non-numeric ref (`GH-abc`) and with a valid numeric identity whose read returns HTTP 404 (`GH-999999`); transport/non-404 non-2xx/credential/binding failures exercise `unknown`; check-run 404 is `unknown` `read-failed`.
- The 40- and 64-hex SHA forms are both valid; comparison is case-insensitive hex.
- `VERIFY_GATES_OPEN_PR_LIMIT` is 100; a raw page at the limit is always `ambiguous-open-pr` regardless of matches.
- Trap payloads live under `tests/fixtures/providers/github/**` with the catalog under `tests/fixtures/providers/traps/`; behavioural fixtures live under `tests/fixtures/verify-gates/providers/...`; the two are never mixed.

### 8.3 Open Questions

Spec v1.5 closes the iteration-3 and iteration-4 readiness findings: `humanText` returns the six-line report for `gates` and `undefined` for `verify change`, so the redact-then-serialize path keeps `verify change` bytes even for a JSON-escaping-sensitive secret; every failure-summary gate line always carries both `counts=` and `names=` segments, rendering `-` when empty; and a successful delivery-request detail read that omits `commits`/`changedFiles` omits those counts as unknown (never zero) while still carrying the two `squash-signals` tokens. The rest of the paragraph records the iteration-3 closure: the single matched-detail 404 rule (`head-unresolved`/`absent` for CI, parity, and squash) with non-404 detail failures `unknown` (AC-F3-5), the check-run 404 as source `absent`/`unknown` `read-failed` and never `failed`/`ci-no-runs` (AC-F3-6), the additive `@delivery-os/core` package-root re-export and combined `change`+`gates` verify runtime, DM-15 per-outcome field semantics, CI count denominators, the detail-read-specific `squash-signals` rule (two ordered tokens after a successful detail read; empty list with omitted `commits`/`changedFiles` and a named source/reason on `failed`/`absent`/`not-attempted`, still satisfying AC-F8-1), and the bounded `failureClass` vocabulary. No blocking question remains.

| ID | Question | Impact | Status / owner |
|----|----------|--------|----------------|
| OQ-T4 | When the list read supplies `sourceHeadSha` but the detail read does not, is the list value sufficient for the CI gate? | Non-blocking; this plan uses the detail value when present and fails `head-unresolved` when the detail is absent. A detail read that returns HTTP 404 is definitive absence and follows AC-F3-5 (`head-unresolved`/`absent`); only a successful detail read without a head SHA is the conservative case here. | Confirm with spec owner. |
| OQ-T5 | What is the exact opt-in flag for the live smoke? | Resolved in this plan: `VERIFY_GATES_LIVE=1`; the default-suite guard is the named `tests/fixtures/verify-gates/cases/network-guard.ts` fixture. | Delivery-bound; confirm at first test run. |
| OQ-T7 | Should the `verify change` pre-change golden be captured from the delivered HEAD or reconstructed from the current serializer? | Non-blocking; the plan requires captured-from-HEAD evidence and treats any byte difference as a regression. | Delivery-bound; confirm at first test run. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | Test Plan Writer | Initial plan. 59 TCs covering all 30 ACs; five gate groups plus surface/target, citation/output, exit/error-table, read-only/composition, provider/trap, corpus/non-vacuity, and opt-in live smoke. Records GAP-3/OQ-T1 (squash citation field) and the non-blocking count/record questions. |
| 1.1 | 2026-10-31 | Test Plan Writer | Amended to consume spec v1.1. Removed GAP-3/4/5/6 and OQ-T1/T2/T3/T6. Squash tests (TC-VGATES-035..042, 057, 058) now assert the machine `squash-signals` list exactly `draft=<true\|false>` then `mergeable=<mergeable\|conflicting\|not-mergeable\|unknown>` on pass and every condition failure, with an empty list only when the PR detail was not read and the prerequisite named. AC-F3-1 asserts `failed`/`succeeded`/`runs` (`runs` = total). AC-F1-3/DM-6 assert exactly five internal gate records preserved as the five summary lines and no failure `data`. AC-F6-2 asserts `GH-abc` and provider-absent numeric identity are `ticket-unresolved` (`unresolved`/`absent`) while transport/credential/binding failures are `unknown`. TC count stays 59; all 30 ACs remain covered and the three ticket negatives remain first-class. Focused/aggregate commands and the zero-live-call guarantee are unchanged. |
| 1.2 | 2026-10-31 | Test Plan Writer | Amended to consume the DoR-fixed spec v1.2 and the committed `chg-GH-178-plan.md`. (1) Replaced the stale `no-open-pr`-for-a-lone-non-matching-PR expectation with `branch-mismatch`; added TC-VGATES-060 for the at-limit page with and without a match (`ambiguous-open-pr`, both parity and squash) and pinned zero open PRs → `no-open-pr`, multiple matches → `ambiguous-open-pr`, detached → `branch-unresolved`. (2) Added TC-VGATES-061 for read-specific HTTP 404 absence (`provider.not-found`): work-item → `ticket-unresolved`/`absent`, PR list → `no-open-pr`, matched PR detail → parity `head-unresolved`/squash `no-open-pr`, check-run → `unknown` `read-failed`, other failures `unknown`; removed the contradictory 404 rows from TC-039/TC-049. (3) Added TC-VGATES-062 for structured `VerifyLedgerEvaluation` on the failure path with a summary decoy and the `classifyVerifyChange` wrapper. (4) Added TC-VGATES-063 for the shared `humanText` dispatch, six-line gates report, byte-identical `verify change` golden, and unchanged machine mode. (5) Added TC-VGATES-064 for the fixed mergeability precedence, including `mergeable === true` + blocked/behind/unstable/draft → `not-mergeable`, false/dirty → `conflicting`, null/absent/computing/unrecognized → `unknown`, true + clean/absent → `mergeable`. (6) Extended TC-055/TC-056 to all required PR/check-run/issue/404 trap ids and separated `tests/fixtures/providers/**` trap payloads from `tests/fixtures/verify-gates/providers/...` behavioural fixtures. (7) Added TC-VGATES-065 for `tests/fixtures/ports/v1-contract-inventory.json` and `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`. (8) Added TC-VGATES-066 for `doc/spec/features/feature-verify-gates.md` in `scripts/checks/forbidden-literals.registry.json`. (9) Set `implementation_plan` to `chg-GH-178-plan.md`, resolved GAP-1, refreshed `last_updated`, and kept the zero-live-call guarantee. TC count 59 → 66; all 34 ACs (including AC-F2-4, AC-F5-3, AC-F5-4, AC-F10-3) are covered; the three ticket negatives remain first-class. |
| 1.3 | 2026-10-31 | Test Plan Writer | Amended to consume the DoR-iteration-2-fixed spec v1.3. (1) Fixed TC-VGATES-013: the lifecycle gate now asserts the structured `EvaluateVerifyChange`/`VerifyLedgerEvaluation` call with no `classifyVerifyChange` dependency and no summary parsing; the wrapper assertion stays in TC-VGATES-062. (2) Fixed TC-VGATES-008: plain `verify` and a wrong subcommand are handler grammar (`input.value.rejected`); only a third positional or an unknown flag is parser shape (`fallback.invocation`). (3) Added TC-VGATES-067 for AC-F3-5: a matched PR-detail 404 makes `ci-green`, `push-parity`, and `squash-preflight` all fail `head-unresolved` with source `absent`; non-404 detail failures stay `unknown`. (4) Added TC-VGATES-068 for AC-F3-6: a check-run 404 is source `absent` and `unknown` `read-failed`, never `failed`/`ci-no-runs`; corrected TC-039/TC-061 accordingly. (5) Added TC-VGATES-069 for the additive `@delivery-os/core` package-root re-export, the combined `change`+`gates` runtime, and byte-identical `verify change`. (6) Extended TC-VGATES-062 with DM-15 per-outcome field semantics (empty arrays/zero counts on terminal failures, arrays/counts/registry evidence when classified, `failed` → `fail`, `state-unverified` → `unknown`). (7) Added TC-VGATES-070 for CI count denominators, no double-bucketing, and the unrecognized-state fail; updated TC-018/TC-019/TC-022. (8) Pinned empty `squash-signals` only when no detail was read (source `not-attempted`/`failed`, prerequisite named) and exactly two ordered tokens otherwise. (9) Bound `failureClass` to `provider.payload.invalid`/`provider.not-found` in TC-040/TC-041 and the read-failure TCs. (10) Named `tests/fixtures/verify-gates/cases/network-guard.ts` as the actual no-live guard fixture in TC-059 and the fixture layout. (11) Recomputed coverage to all 36 ACs (including AC-F3-5/AC-F3-6); updated the index, details, automation plan, risks, open questions, and traceability; ticket negatives remain first-class and default CI still makes zero live calls. TC count 66 → 70. |
| 1.4 | 2026-10-31 | Test Plan Writer | Amended to consume spec v1.4 and close the DoR iteration-3 findings that touch this plan. (1) Squash citation on a detail 404 (`absent`) or failed detail read (`failed`): TC-VGATES-039/040/061/067 now assert an empty `squash-signals` list with `commits`/`changedFiles` omitted as unknown (never zero) and still at least one source and one reason, satisfying AC-F8-1; a successful detail read always asserts exactly two ordered tokens. Removed the non-empty-count/name requirement on those failure paths and aligned the index, DM-5/DM-11 descriptions, AC-F7-2/AC-F7-3/AC-F8-1 rows, and R-1. (2) TC-VGATES-063 gains a planted-secret control: the secret is injected in the secret list and in the `verify change` data and a gates citation/identity value; both the six-line human report and the machine envelope must redact it, no unredacted secret may appear in either stream, and `verify change` remains byte-identical to the pre-change golden under the same secret-bearing data. (3) Corrected per-TC AC mappings to the ACs each scenario exercises: TC-VGATES-013 now lists AC-F2-4, TC-VGATES-015 lists AC-F2-4/NFR-1, TC-VGATES-039 lists the check-run AC-F3-6 and not the PR/work-item 404 AC, and TC-VGATES-054 lists AC-F7-3; the forward coverage rows were reconciled. Coverage stays 36/36 ACs and 70/70 TCs, and the default-suite zero-live-call guarantee is unchanged. |
| 1.5 | 2026-10-31 | Test Plan Writer | Amended to consume spec v1.5 and close the DoR iteration-4 findings that touch this plan. (1) TC-VGATES-063 now asserts the widened `humanText` contract: the hook returns the six-line report for `target: "gates"` and `undefined` for `verify change`, so `verify change` stays on `humanSuccess`/`humanJson` redact-then-serialize and is byte-identical to today — including for a JSON-escaping-sensitive secret containing a quote/backslash/newline; the planted secret is asserted redacted on both paths (data-object redaction before serialization for change, string redaction of the rendered report for gates) with no unredacted raw or JSON-escaped secret in stdout/stderr/report/envelope; the old "`humanText` returns the JSON string for `change`" expectation was removed. (2) TC-VGATES-042 now asserts both `counts=` and `names=` segments are always present and empty segments render the literal `-` (`counts=- names=-`), never a zero alias, a bare `counts=`/`names=`, or an omitted segment; a no-usable-detail squash line asserts exactly `counts=- names=-`. (3) TC-VGATES-038/040 now assert that a successful detail read omitting `commitCount`/`changedFileCount` yields omitted counts (unknown, never zero) while `squash-signals` may still be present; the AC-F7-3/AC-F8-1, DM-5, DM-11, and in-scope statements were aligned. (4) Reverse traceability reconciled: AC-F5-2 forward now names TC-011/012/030/031/039/061; AC-F8-1 adds TC-027; AC-F9-1 adds TC-018; AC-F11-1's TC-067 entry now appears in that TC's `Related IDs`; AC-F14-1 is carried by TC-060/061/067/068 in both directions, matching the plan's final acceptance trace and corpus tasks. (5) Refreshed `last_updated`, the spec reference, the open-questions preamble, and R-14. Coverage remains 36/36 ACs and 70/70 TCs, and default CI still makes zero live calls. |

## 10. Test Execution Log

Populated during delivery. No runs recorded yet.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not run | Plan v1.5; execution begins in the delivery phase. |

