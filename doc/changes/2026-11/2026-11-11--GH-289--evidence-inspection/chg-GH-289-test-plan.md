---
id: chg-GH-289-test-plan
status: Updated
created: 2026-11-11
last_updated: 2026-11-11T22:10:00Z
owners: [engineering]
service: delivery-os dispatch engine
labels: [feature, dispatch, evidence, attempts, read-side, m2-s12]
version_impact: minor
summary: "Prove that `dispatch attempts` is a bounded, deterministic, repository-scoped reader of the delivered attempt ledger that adds no error identity and treats a verified empty history as success, that an unreadable store is never reported as empty, that `dispatch dual-run resolve` declares the unconditional `local-evidence` mode, its subject repository, and the exact unresolved counts it leaves, and that the summary and the resolve result report one and the same divergence count."
links:
  change_spec: ./chg-GH-289-spec.md
  implementation_plan: ./chg-GH-289-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S12: Attempt-history inspection and divergence resolution from local evidence

## 1. Scope and Objectives

This plan protects one property with several faces: **a consumer surface may declare only what the durable evidence can supply, and where it cannot know it discloses rather than refusing or inventing** (TDR-0023). The read side must return exactly the sixteen fields the attempt record carries, must never present a foreign repository's attempt as the operator's own, must never invent a failure identity for a cell the closed registry already owns, and must never report an unreadable store as an empty history. The resolve extension must state that it ran from local evidence, name the repository whose truth condition it moved, and report the exact unresolved count that the handover gate turns on — the same number the summary reports.

Two failure modes motivate the discipline. First, **a store is not a repository**: after the per-repository state split and the wholesale migration, one project state root can hold another repository's attempt and divergence history, so a read that opens the right root and returns everything would leak foreign evidence silently (RSK-1). Second, **the delivered count is exact but not repository-scoped**: `foldEvidenceWindow` folds every divergence in the store and takes `unresolved` and `resolved` from that complete fold, so the delivered summary's counts are already exact — store-wide, with `unresolvedIds` returning every open identifier — while `summarizeDispatchDivergences` caps identifiers at 20 and derives its counts from the capped length without a single caller on any delivered surface (`packages/core/src/domain/dispatch-gate.ts`, `packages/core/src/app/dispatch-ledger.ts`, read 2026-11-11). This change makes one repository-scoped computation the only rule, so a test that only asserts "the two surfaces agree" would pass on a shared wrong rule; this plan therefore pins the exact numbers (`25`, not `30`, not `20`) and the declared narrowing (`20` identifiers plus `idsTruncated: true` for 25 open) **and** pins the single derivation structurally (TC-ATTEMPT-022, TC-ATTEMPT-038).

The headline isolation and read-only evidence is produced the way the delivered suites produce it: through the **real production composition** (`createProductionComposer` → `runCli` in `packages/cli/src/production.ts`) over **real temporary checkouts** and one temporary host root, with a home that is always a distinct directory. Contract-level assertions (envelope keys, projection, ordering, bounds, digest) run through an in-process composition that injects only the store, the state root, the repository resolver, and the ref source — never a repository identity string that production would have derived.

### 1.1 In Scope

- The `dispatch attempts [--ref <ref>] [--limit <n>]` grammar: canonical ref shape, the two flag bounds, the canonical decimal limit form (`[1-9][0-9]*`), unknown flags and unexpected positionals, and the active-reference default through the delivered `.ai/local/pm-context.yaml` seam.
- The `attempts.v1` envelope: the eight always-present scope/filter keys plus `truncation` only when a bound binds, the sixteen-field record projection with `divergenceRef` singular-or-explicit-`null`, the `endedAt` one-to-one mapping, the corroboration triple, the comparison object, the bounded evidence references, the count-only `excluded.foreignRepository`, and the single optional `truncation` object.
- Total ordering (`startedAt` desc, `recordedAt` desc, `attemptId` asc), `matched` and `hasMore`, and the three independent bounds (ledger 5,000; page 100; machine `data` 65,536 bytes) with their declared omissions.
- Repository-scoped isolation: two projects on one host root with the same ref, one project root holding two repositories' records, the count-only disclosure within the retained ledger read window (independent of `--ref`, and zero for a record that sits only in the omitted tail), the persist-disabled identity resolution, and the refusal outside any checkout.
- Read-only posture with respect to delivery evidence: zero appends, zero fence acquisitions, store bytes/modes/mtimes unchanged, and the exact permitted side effects enumerated.
- The four failure cells with no new identity: malformed request, unresolvable context or identity, unreadable store, and the empty-history success rule.
- The resolve extension: unconditional `mode: "local-evidence"`, the divergence's own repository, the four-field divergence block plus `idsTruncated` (its `unresolvedIds` the at-most-20 list with the omission declared), the 240-character clamp, the blank-note refusal, replay idempotency, and the one-line human digest.
- The shared divergence-count rule across the resolve result and `dispatch dual-run summary`: one repository-scoped computation whose exact counts are unchanged on an unmigrated root and lower on a migrated one (foreign open divergences stop counting), whose `unresolvedIds` — and the human `unresolved_divergences=` line — narrows to the documented at-most-20 list with `idsTruncated`, and which the resolve result reports as a block it did not carry before.
- The bounded deterministic attempts digest: summary line, seven-cell rows, corroboration derivation, human truncation line, coverage/floor pointer, and the absence of the run form's keys.
- Help reachability, the fifth help entry, the `dispatch` parity pin moving from four to five, the coverage-inventory registration, and the gate battery.
- Test isolation itself: every new suite runs under a per-test host root inside the repository-local `tmp/tmpdir`, and no assertion may reach the real state directory.

### 1.2 Out of Scope & Known Gaps

- **No new state-contract, ledger, or record test.** The attempt record, its reader, its fold, and the store layout are unchanged (spec NG-1, NG-2). Their existing suites must stay green **unmodified**; this plan adds no new assertion about them beyond the two behaviours this change touches (the attempt reader's bound and the divergence fold's count rule).
- **No cursor/offset/`--before` paging, no all-refs repository page, no streaming form** (spec NG-5, §7.3). `--limit` above 100 is refused, not clamped, so there is no "wide page" cell.
- **No repository guard on divergence writes** (spec NG-7, OQ-1). A cross-repository resolve is asserted to be **disclosed, not prevented**; the deferred guard has no test because it does not exist.
- **No performance harness.** The `p95 ≤ 5 s` bound at the 5,000-record ledger is measured in-process over 10 samples with the recorded value in §10, mirroring the GH-273/GH-288 precedent; there is no benchmark framework, no subprocess, and no CI-perf job.
- **`AC-F4-1`'s side-effect enumeration is review-verified.** The suite asserts zero appends, zero fences, and byte/mode/mtime stability, that the dispatch repository binding marker is neither created nor repaired, and that a pre-existing project checkout identity marker is unchanged; *which* filesystem effects are permitted (host-index maintenance at most one write; the create-once project checkout identity marker) is a diff inspection, because no permanent test can assert an exhaustive list of absent effects against a moving base.
- **`AC-F8-3` and `AC-F8-4` are review-verified.** The M2 `attempts(1)` page and the planning corpus are prose; the spec assigns them review evidence (§17), and this plan mirrors that class rather than inventing a text-matching suite that would pin prose.
- **`AC-F9-1`'s additive-only half is review-verified.** The shapes, the four delivered forms' unknown-flag refusals, the attempts-payload discriminator, and the summary block's declared narrowing are suite-asserted (TC-ATTEMPT-034 cells 1–5 and 7); "only these additions and no renames against the merge base" is a diff inspection (cell 6), because no permanent assertion may compare against a moving base (`.ai/rules/testing-strategy.md` §"Invariant-test authoring").
- **`AC-F4-4`'s string-absence half over the M2 page and the planning corpus is review-verified** exactly as spec §17 splits it; the code/help/result-contract/feature-spec half is a suite scan (see §8.3 X-7).
- **No cross-platform assertion.** The suites run on Linux and macOS with `git` available; Windows path and mtime semantics are not asserted, and mtime is never the sole evidence of "no write" (§8.1 TR-2).
- **Module names for the projection/page helper and the attempts runtime are not fixed by the spec.** It names the tiers and the composition sites only. This plan therefore pins **test** paths and the exported surface, and leaves implementation filenames to the delivery plan (§8.3 X-8).

## 2. References

- Change specification: [chg-GH-289-spec.md](./chg-GH-289-spec.md) (v1.4) — F-1…F-9 (§5.1), DM-1…DM-6 (§8.3), §8.5 backward compatibility, NFR-1…NFR-11 (§9), §10 failure diagnosis, §11 risks, §15 DEC-1…DEC-16, §17 AC-F1-1…AC-F9-2 (**36** criteria, including `AC-F1-6` for the request-grammar refusals), Appendix B (scenario reconciliation), Appendix C (M2 page corrections), Appendix D (normative read-side field set), §25 document history. Spec v1.1 closed findings X-1…X-9 of the previous revision of this plan (§8.3). Spec v1.3 states the delivered summary's history correctly — its `unresolved` and `resolved` were already exact, so §8.5, RSK-6, DEC-15, F-7, DM-3, NFR-9, F-9, and AC-F7-1 declare a lower count on a migrated root, a new block on the resolve result, and an `unresolvedIds` narrowing to the documented 20 with `idsTruncated` — and gives `AC-F9-2` the split evidence class this plan already asserted. Spec v1.4 folds the delivered forms' unknown-flag refusal into `AC-F9-1` as a suite-class clause (the handler guard that is the only remaining refusal once the definition sets `acceptsAnyFlag`) and states the divergence-block split — `reported`, `resolved`, and `unresolved` keep exact-count meanings while `unresolvedIds` keeps its name, type, and order and narrows to at most 20.
- Decision record: [TDR-0023](../../../decisions/TDR-0023-dispatch-attempt-read-side-and-local-evidence-resolve.md) (Proposed, amended for spec v1.3) — D-1…D-7, C-1…C-8, the verification column of each constraint, and the residual risks this plan must pin (the repository-scope count movement, the two-fold-site convergence, the declared identifier narrowing, the disclosure-only cross-repository posture).
- Implementation plan: [chg-GH-289-plan.yaml](./chg-GH-289-plan.yaml) — the phase-4 artefact this plan's §7 phase grouping feeds; authored after this file, so the link names the declared target path.
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, invariant-test authoring, gate battery (`pnpm check`).
- TypeScript workspace rules: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict TypeScript, purity, ports/adapters, `bun:test` authoring.
- Current-truth specs to respect and reconcile: [feature-dispatch-engine.md](../../../spec/features/feature-dispatch-engine.md) (grammar, attempt/divergence/handover records, resolve paragraph, bounds table), [feature-result-contract.md](../../../spec/features/feature-result-contract.md) (124 rows, four `dispatch` rows), [feature-cli-entrypoint.md](../../../spec/features/feature-cli-entrypoint.md), [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [feature-projects.md](../../../spec/features/feature-projects.md).
- M2 pack the page corrections are measured against: [contracts.md § `attempts.v1`](../../../planning/oss-tooling/milestones/m2/contracts.md), [commands/attempts.md](../../../planning/oss-tooling/milestones/m2/commands/attempts.md), [test-scenarios.md §M2-S12](../../../planning/oss-tooling/milestones/m2/test-scenarios.md).
- Delivered seams the suites ride: `packages/core/src/contracts/dispatch.ts` (`DispatchAttemptRecord`, `DISPATCH_MAX_EVIDENCE_REFS`, `DISPATCH_MAX_NOTE_CHARS`, `DISPATCH_MAX_DIVERGENCE_IDS`), `packages/core/src/app/dispatch-ledger.ts` (`readDispatchAttempts`, `appendDispatchAttempt`, `summarizeDispatchDivergences`, `resolveDispatchDivergence`), `packages/core/src/domain/dispatch-gate.ts` (`foldEvidenceWindow`), `packages/core/src/app/dispatch-gate.ts` (`resolveDispatchDivergenceEvidence`, `readDispatchGate`), `packages/cli/src/edge.ts` (`createDispatchGateRuntime`, `createDispatchCommandRuntime`), `packages/cli/src/production.ts` (`createProductionComposer`, `resolveProductionRepository(persist: false)`, `resolveProjectScope`), `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/help.ts`, `packages/cli/src/output/dispatch-text.ts`, `packages/cli/src/commands/spend.ts` (the delivered active-context refusal pattern).
- Delivered suites this plan extends or keeps green: `tests/behaviour/dispatch-*.test.ts` (truth, liveness, watch, evidence, gate, handover, resume, identity, admission-*, delivered-evidence-divergence, resolve-diagnostics, bounds, envelope, error-envelope, exit-projection, determinism, token-closure, help-version), `tests/structure/dispatch-*.test.ts` (error identity, help inventory, composition, resolve composition, imports, envelope detail), `tests/conformance/dispatch/**`, `tests/checks/error-table-sync.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/checks/exit-code-literals.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-literals.test.ts`, `tests/fixtures/help-guide/coverage.json`, `tests/behaviour/entrypoint-composition.test.ts`.
- Delivered fixtures reused: `tests/fixtures/dispatch/harness.ts` (isolated dispatch state, fixed clock, scripted harness), `tests/fixtures/dispatch/ledger.ts` (`makeAttempt`, `makeAttemptFor`, `makeDivergence`, `REPOSITORY`, `REPOSITORY_BETA`), `tests/fixtures/dispatch/admission.ts` (`createAdmissionHarness`: real production composition with counted credential/transport/spawn), `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario`, `createCommandScenario.invoke`), `tests/fixtures/projects/production.ts` (`createHostFixture` host root, home and checkout composition, `snapshot`, `fileList`), `tests/fixtures/projects/temp-repos.ts` (real `git` checkouts), `tests/fixtures/projects/state-scope.ts` (`APPROVED_BASE`, `nonCheckoutDirectory`, `realStateFingerprint`, `guardStateFixtureRoot`), `tests/fixtures/state/harness.ts` (`makeTempRoot`, `openStore`).
- Comparable delivered plans: [chg-GH-288-test-plan.md](../2026-11-11--GH-288--multi-repo-workstations/chg-GH-288-test-plan.md) (structure, evidence classes, fixture discipline, gate mapping), [chg-GH-279-test-plan.md](../2026-11-11--GH-279--dispatch-evidence-recording/chg-GH-279-test-plan.md) (resolve diagnostics evidence).
- Ticket: GH-289 (M2-S12). Scenario seeds: SC-M2-S12-01 → TC-ATTEMPT-018/022 (reconciled per spec Appendix B: the count is `data.divergences.unresolved`, not a top-level `unresolved`); SC-M2-S12-02 → TC-ATTEMPT-001/006 (reconciled per Appendix B: `divergenceRef` present-or-explicitly-`null`, never a list).

## 3. Coverage Overview

Every acceptance criterion names an evidence class in spec §17. This plan mirrors those classes exactly: it never upgrades a `review-verified` criterion to `suite`, and it never claims a revert for an assertion that passes identically before the change. Evidence classes used below: **Suite** (a committed assertion that runs in `pnpm check`), **Suite + revert/mutation** (a suite assertion whose detection power is proven by a named in-place revert or wrong-implementation mutation, §7.4), **Review-verified** (a diff/content inspection recorded in the change review and §10), **Manual Only** (no artefact can be asserted; the review verdict is the evidence).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | `--ref --limit 3 --json` returns the three newest matching attempts with `data.ref`, `refSource: "flag"`, `limit: 3`; with an active change in the local context, no `--ref` resolves that reference with `refSource: "active-change"`. | TC-ATTEMPT-001 | Suite | Covered |
| AC-F1-2 | No context, an unparsable context, and a context with no active change each exit `1` with `input.value.rejected` under `kind: "input"`, print a bounded summary naming the context file and `--ref`, read no store, append nothing, and never fall back to an empty success. | TC-ATTEMPT-002 | Suite | Covered |
| AC-F1-3 | `--limit` accepts canonical decimal only (`[1-9][0-9]*`): 1 and 100 succeed; 0, 101, `-1`, `abc`, `07`, `+7`, ` 7`, and a missing value each exit `1` with `input.value.rejected` and nothing is clamped or normalised; the default is 20 and the page carries at most 20 rows; a malformed request performs no store read. | TC-ATTEMPT-003 | Suite | Covered |
| AC-F1-4 | Three attempts with identical `startedAt` order by `recordedAt` desc then `attemptId` asc, identically across two runs and across two ledger insertion orders. | TC-ATTEMPT-004 | Suite | Covered |
| AC-F1-5 | Three matching attempts: `--limit 3` → `matched: 3`, `hasMore: false`; `--limit 2` → `hasMore: true`, two rows; `hasMore` is true exactly when more matching attempts exist beyond the returned array. | TC-ATTEMPT-005 | Suite | Covered |
| AC-F1-6 | A non-canonical `--ref` (`241`), an unknown flag, and an unexpected positional each exit `1` with `input.value.rejected` under `kind: "input"`, perform no store read, append nothing, and emit no `attempts.*` identity. | TC-ATTEMPT-039 | Suite | Covered — the AC that owns the grammar refusals |
| AC-F2-1 | Every row carries exactly the declared projection fields; the divergence-carrying row carries the stored identifier, the other explicit `null`; no undeclared key. | TC-ATTEMPT-006 | Suite | Covered |
| AC-F2-2 | `endedAt` equals the stored finish timestamp, `startedAt`/`recordedAt` equal theirs, all printed unmodified in text; corroboration carries the stored tri-state triple. | TC-ATTEMPT-007 | Suite | Covered |
| AC-F2-3 | A `not-applicable` comparison projects `token: null` and `outcome: "not-applicable"`; a comparing attempt projects the stored class, token, and outcome, consistent with the stored divergence reference. | TC-ATTEMPT-008 | Suite | Covered |
| AC-F2-4 | 100 maximal records serialize to at most 65,536 UTF-8 bytes of `data`; when the page is shortened the envelope declares `truncation` scope `"page"`, `bound: 65536`, and a non-zero `omittedRecords` equal to the otherwise-eligible rows the byte budget dropped, with `hasMore: true`; a small page carries no `truncation`. | TC-ATTEMPT-009 | Suite | Covered |
| AC-F2-5 | A ledger above 5,000 records considers at most 5,000, declares scope `"ledger"` with `bound: 5000` and the omitted count, keeps `matched ≤ 5000`, and returns the newest rows. | TC-ATTEMPT-010 | Suite | Covered |
| AC-F3-1 | Two projects on one host root, same reference: each envelope carries only its own repository's attempts, `data.repository` names it, `excluded.foreignRepository` is 0 in both, and zero foreign identifiers or references appear. | TC-ATTEMPT-011 | Suite + mutation (P3) | Covered |
| AC-F3-2 | One project root holding two repositories' records: only the reader's attempts return; `excluded.foreignRepository` equals the foreign-repository records within the retained ledger read window (newest 5,000) and is independent of `--ref`; a foreign record only in the omitted tail is not counted, so the count is 0 for that window; no foreign identifier, reference, divergence reference, harness, or timestamp appears anywhere in the envelope, warnings, or digest. | TC-ATTEMPT-012 (retained-window branch), TC-ATTEMPT-010 (omitted-tail branch) | Suite + mutation (P3) | Covered — both branches labelled |
| AC-F3-3 | Outside a git work tree the read exits `1` with `input.value.rejected`, names the checkout, reports no attempts, never presents the host-scoped `unbound` store as a repository's history, and creates no dispatch repository binding marker. | TC-ATTEMPT-013 | Suite | Covered |
| AC-F4-1 | Delivery-evidence bytes, modes, and mtimes are unchanged, no attempt/divergence/handover/authority record is appended, the fence is acquired zero times, and the only effects are the host-index maintenance write (zero when unchanged) and the create-once project checkout identity marker — while the dispatch repository binding marker is neither created, repaired, nor re-persisted. | TC-ATTEMPT-014 | Suite + Review-verified (side-effect enumeration) | Covered — both halves labelled in TC-ATTEMPT-014 |
| AC-F4-2 | A repository with no attempt records exits `0` with `attempts: []`, `matched: 0`, `hasMore: false`, no error object, no `attempts.*` identity; text prints the summary line, no rows, the pointer. | TC-ATTEMPT-015 | Suite | Covered |
| AC-F4-3 | Torn, unreadable, and permission-denied stores each exit `2` with the corresponding `state.*` identity under `kind: "state"` carrying that row's category, retryability, consequence, remediation, and summary; none is reported as an empty history. | TC-ATTEMPT-016 | Suite | Covered |
| AC-F4-4 | `ERROR_TABLE` holds exactly 124 identities with exactly 4 `dispatch` rows; no `attempts.*` string exists in the table, the documented table, the specs, the help text, or any output; no token, projection, or code is added. | TC-ATTEMPT-017 | Suite (counts and code/help/spec scans) + Review-verified (M2 page and corpus) | Covered — the two halves are labelled in TC-ATTEMPT-017 |
| AC-F5-1 | Resolving an open divergence reports `mode: "local-evidence"`, the divergence's repository, `resolved: true`, `state: "resolved"`, counts decreased by exactly one with the identifier gone from `unresolvedIds`, and the five delivered keys unchanged in meaning. | TC-ATTEMPT-018 | Suite | Covered |
| AC-F5-2 | With no truth-read credential and an unreachable tracker, a resolve performs zero credential resolutions, zero network requests, zero harness spawns, and zero model calls, exits `0`, appends one resolution, and still declares the mode. | TC-ATTEMPT-019 | Suite | Covered |
| AC-F5-3 | A replay appends nothing, reports `resolved: false`, the stored note and principal, `state: "resolved"`, unchanged counts, and leaves the original open record byte-identical. | TC-ATTEMPT-020 | Suite | Covered |
| AC-F5-4 | A blank and a whitespace-only note each exit `1` with `input.value.rejected` and append nothing; a 400-character note succeeds with the stored and reported note at most 240 characters and no write failure. | TC-ATTEMPT-021 | Suite | Covered |
| AC-F5-5 | With 25 folded open divergences for one repository, both the resolve result and the summary report `unresolved: 25`, both blocks carry the four delivered fields with their names, types, and order plus the one declared additive key `idsTruncated`, `reported`, `resolved`, and `unresolved` keep their meanings as exact counts while `unresolvedIds` keeps its name, type, and order and narrows to the declared at-most-20 list with `idsTruncated: true`, and neither derives the count from the identifier list length. | TC-ATTEMPT-022 | Suite + mutation (P2) | Covered — the migrated-root movement (down), the unmigrated-root non-movement, the identifier narrowing, and the cross-surface identity of the block are asserted |
| AC-F6-1 | The digest's first line is the declared summary line, each row is the seven declared cells newest first, the last line is the pointer naming `dispatch dual-run summary --repo <repository>`, and no `result=`/`pr_url=`/`exit_code=`/`last_message=` key appears. | TC-ATTEMPT-023 | Suite | Covered |
| AC-F6-2 | The three triples render `corroborated`, `uncorroborated`, and `vacuous`; no fourth value is producible. | TC-ATTEMPT-024 | Suite | Covered |
| AC-F6-3 | A page larger than the human budget renders at most 40 lines and 8,192 bytes, drops rows from the oldest end, prints `truncation=human:bound:<kept>,omitted:<dropped>` before the pointer, prints at most 37 rows beside it, and leaves `has_more` unchanged by the cut. | TC-ATTEMPT-025 | Suite | Covered |
| AC-F6-4 | Two text runs are byte-identical and two machine payloads structurally identical, with no dependence on clock, locale, width, filesystem iteration order, or map order. | TC-ATTEMPT-026 | Suite | Covered |
| AC-F6-5 | A successful resolve prints exactly one line in the declared form; a replay prints the same line with `appended=false` and the unchanged count. | TC-ATTEMPT-027 | Suite | Covered |
| AC-F7-1 | The attempts envelope carries none of `coverage`, `floor`, `verdict`, `eligibility`, `unmetConditions`; the summary keeps its delivered coverage, floor, and verdict fields and its text projection apart from the three declared changes on its divergence block — its counts become the exact repository-scoped counts of AC-F5-5 (unchanged on an unmigrated root, lower on a migrated root), its `unresolvedIds` narrows to the at-most-20 list with the additive `idsTruncated` key when identifiers are dropped, and the human `unresolved_divergences=` line prints that same list — while `reported`, `resolved`, and `unresolved` keep their delivered names, types, and meanings as exact counts and no other field, key order, or text changes. | TC-ATTEMPT-028 | Suite | Covered — the preserved gate fields and the three declared changes are each asserted |
| AC-F7-2 | The text pointer, the help synopsis, and the reference page all name `dispatch dual-run summary --repo <repository>`, and no second surface computes the gate. | TC-ATTEMPT-029 | Suite (pointer, help) + Review-verified (reference page) | Covered — both halves labelled |
| AC-F8-1 | `dispatch attempts --help` exits `0` and renders usage, both options, a global option block, an example, and the exit-code block with no state/network/git/configuration read; the root listing still names exactly seventeen families with no `attempts` row. | TC-ATTEMPT-030 | Suite | Covered |
| AC-F8-2 | `pnpm check:help` and the reference-page parity gate are green, the dispatch help-entry pin is five, the M2 attempts page is registered, and the see-also target resolves. | TC-ATTEMPT-031 | Suite | Covered |
| AC-F8-3 | The M2 attempts page documents `--help`/`--version`, states the resolved exit table (no `attempts.*` rows, empty history at exit `0`), prints `command: "dispatch"`, uses `divergenceRef`, shows the declared digest and pointer, and states the bounds; the M1 page is byte-unchanged. | TC-ATTEMPT-032 | Review-verified | Covered |
| AC-F8-4 | The backlog marker, status entry, entrypoint-delta note, command-registry note, `attempts.v1` refinement, and the dispatch feature spec's grammar/read-side/resolve/error/bounds text all state the delivered behaviour. | TC-ATTEMPT-033 | Review-verified | Covered |
| AC-F9-1 | The run envelope, summary envelope, handover result, and the five delivered resolve keys keep name, type, and order, and every delivered meaning is unchanged except on the summary's divergence block, where `reported`, `resolved`, and `unresolved` keep exact-count meanings and `unresolvedIds` keeps its name, type, and order and narrows to at most 20 with `idsTruncated`; with `acceptsAnyFlag` enabled on the dispatch definition, each of the four delivered forms — `dispatch <ref>`, `dispatch dual-run summary --repo <repo>`, `dispatch dual-run resolve <id> --note <text>`, `dispatch handover <repo> [--revert]` — still refuses an undeclared flag at exit `1` with `fallback.invocation` under `kind: "fallback"` and performs no store read; the attempts payload is discriminated by its `attempts` array so no existing text selector mistakes it; the only additive changes are the declared ones. | TC-ATTEMPT-034 | Suite (shapes, the four delivered-form refusals, and the discriminator) + Review-verified (additive-only half) | Covered — both halves labelled; the four delivered-form refusals are suite-asserted by cell 7 and the shapes by cells 1–5 (mutation P1) |
| AC-F9-2 | No configuration key, external dependency, workspace package, delivery-result token, projection class, exit literal, error row, or product/binary literal is added, and `pnpm check` is green with a temporary state override. | TC-ATTEMPT-035 | Suite (scans and gates) + Review-verified (lockfile and manifest diff) | Covered — both halves labelled |

All **36** acceptance criteria (`AC-F1-1`…`AC-F9-2`) are mapped; none is unmapped, marked TODO, or AC-less. Every test case names the AC it proves or the NFR/structure identifier that justifies it (TC-ATTEMPT-036 → NFR-11, TC-ATTEMPT-037 → NFR-2, TC-ATTEMPT-038 → AC-F5-5 with NFR-8), and `AC-F1-6` is owned by **TC-ATTEMPT-039** (the request-grammar refusals), so no test case is AC-less and no criterion is owned only implicitly.

Functional capabilities are covered transitively: F-1 → 001, 002, 003, 004, 005, **039**; F-2 → 005, 006, 007, 008, 009, 010; F-3 → 011, 012, 013, 014; F-4 → 002, 003, 013, **014**, 015, 016, 017, **039**; F-5 → 018, 019, 020, 021, 022, 027; F-6 → 023, 024, 025, 026, 027; F-7 → 022, 028, 029, **038**; F-8 → 029, 030, 031, 032, 033; F-9 → 034, 035.

### 3.2 Interface Coverage (DM-#, command surface, registries)

The spec declares no `API-` or `EVT-` identifiers (§8.1, §8.2 — the surface is the CLI, the state ledger it reads, and the help inventory; no event, message, topic, or wire type changes).

| Interface element | Observable contract | TC ID(s) |
|-------------------|---------------------|----------|
| `dispatch attempts [--ref] [--limit]` (text) | Newest-first digest, summary line, seven-cell rows, optional human truncation line, pointer; exit `0` produced (including a verified empty history), `1` refused, `2` state failure. | TC-ATTEMPT-001, 003, 023, 025, 026, 028, 030, 039 |
| `dispatch attempts --json` (`DM-1` data) | `{ ok, command: "dispatch", data, error?, warnings? }` with `data` keys exactly `repository`, `ref`, `refSource`, `limit`, `matched`, `hasMore`, `attempts`, `excluded`, plus `truncation` only when a bound binds; `excluded.foreignRepository` is a count of records within the retained ledger read window and independent of `ref`; no new top-level key. | TC-ATTEMPT-001, 005, 006, 009, 010, 012, 028, 034 |
| `DM-2` attempt projection | Sixteen declared fields per row, declared types, `divergenceRef` string-or-explicit-`null`, `endedAt` one-to-one with the stored `finishedAt`, corroboration triple, comparison `{class, token, outcome}`, `resumeMode` or `null`, ≤ 16 `evidenceRefs`; no `handoverState`, no `prefillCostAcknowledged`, no undeclared key. | TC-ATTEMPT-006, 007, 008, 023 |
| `DM-3` resolve result | The five delivered keys unchanged, plus `mode: "local-evidence"`, `repository` (the divergence's), and `divergences { reported, resolved, unresolved, unresolvedIds, idsTruncated }` in that order, where `reported`, `resolved`, and `unresolved` keep their names, types, and exact-count meanings and `unresolvedIds` keeps its name, type, and order and is the at-most-20 list with `idsTruncated`. | TC-ATTEMPT-018, 020, 021, 022, 027, 034 |
| `DM-4` read bounds | Ledger 5,000; page 20 default / 1 minimum / 100 maximum; machine `data` 65,536 bytes; human 40 lines and 8,192 bytes; ≤ 37 rows beside a truncation line; ≤ 16 evidence references per record; ≤ 20 identifiers per block; note 240 characters. | TC-ATTEMPT-003, 009, 010, 021, 022, 025 |
| `DM-5` truncation declaration | One object `{ scope: "ledger" \| "page", bound, omittedRecords }`, present only when a bound binds, ledger scope taking precedence; `bound` is `5000` for `ledger` and `65536` for `page`, and `omittedRecords` counts what that bound left out; the digest declares `truncation=human:bound:<kept>,omitted:<dropped>`. | TC-ATTEMPT-009, 010, 025 |
| `DM-6` read-side error mapping | Malformed request (including a non-canonical ref, an unknown flag, an unexpected positional, and a non-canonical limit), unresolvable active reference, and unresolvable repository identity → `input.value.rejected` (`kind: "input"`, exit `1`); an unreadable store keeps its own `state.*` identity (`kind: "state"`, exit `2`); an empty verified history → success at exit `0`. | TC-ATTEMPT-002, 003, 013, 015, 016, 017, 039 |
| `dispatch dual-run resolve <id> --note <text>` | Unchanged grammar and exit projection, with the additive fields of `DM-3` and one additive human line; zero credential resolutions, zero network calls, zero spawns. | TC-ATTEMPT-018, 019, 020, 021, 027, 034 |
| `dispatch dual-run summary --repo <repo>` | Contract unchanged apart from the divergence block, which becomes the same repository-scoped computation as the resolve result (counts exact under the delivered names, types, and meanings, unchanged on an unmigrated root and lower on a migrated one) and whose `unresolvedIds` keeps its name, type, and order and narrows to the declared at-most-20 list with the additive `idsTruncated` key and the matching human `unresolved_divergences=` line; coverage, floor, verdict, and every unmet condition stay here. | TC-ATTEMPT-022, 028, 034 |
| `dispatch --help`, `dispatch attempts --help`, `--version` | Served from the static help inventory with no state, network, git, configuration, or model read; five `dispatch` entries; root listing at seventeen families. | TC-ATTEMPT-029, 030, 031 |
| Error table and result-contract documentation | Exactly 124 identities, exactly 4 `dispatch` rows, documented both ways, zero `attempts.*` strings. | TC-ATTEMPT-017, 035 |
| Coverage inventory and parity pin | The M2 `attempts` page registered in `referencePages`; `commands` unchanged; the dispatch help-entry pin at five. | TC-ATTEMPT-031 |
| Project state root and repository identity | The read opens exactly the checkout's project state root; identity resolves with persistence disabled; the dispatch repository binding marker (`<git-common-dir>/dispatch-identity.json`) is neither created nor repaired, while the project checkout identity marker (GH-288) may be minted once by any store-opening invocation; a non-checkout invocation refuses. | TC-ATTEMPT-011, 012, 013, 014 |
| `active_change` context seam | `.ai/local/pm-context.yaml` `active_change.workItemRef` is the default reference; absent/unparsable/no-active-change refuses with the file and the `--ref` remedy named. | TC-ATTEMPT-001, 002 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Notes |
|--------|-------------------------|----------|-------|
| NFR-1 | Two of two repeated runs byte-identical in text and structurally identical in machine data; zero dependence on clock, locale, terminal width, filesystem iteration order, or map order; total order. | TC-ATTEMPT-004, 023, 025, 026 | Determinism is asserted twice: once over repeated runs, once across two ledgers seeded in opposite insertion orders. |
| NFR-2 | Exactly one verified store read per invocation and zero additional reads; ledger ≤ 5,000 with declared omission; page ≤ 100; `data` ≤ 65,536 bytes; digest ≤ 40 lines and 8,192 bytes; ≤ 37 rows beside a truncation line; every bound that binds is declared; p95 ≤ 5 s at the 5,000-record bound. | TC-ATTEMPT-005, 009, 010, 025, 037 | The read-count assertion uses a counting store wrapper, not a private seam. |
| NFR-3 | Zero attempt/divergence/handover/authority appends; zero fence acquisitions; store bytes, modes, mtimes unchanged; only host-index maintenance (at most one write when content changed) and the create-once project checkout identity marker; the dispatch repository binding marker 0 created, 0 repaired, 0 re-persisted. | TC-ATTEMPT-014 | "Which effects are permitted" is the review-verified half; the two markers are asserted through their own delivered helpers. |
| NFR-4 | Zero returned attempts whose `repository` differs from `data.repository` across the two-project and migrated-root scenarios; zero foreign identifiers anywhere; `excluded.foreignRepository` is a count only, of foreign records within the retained ledger read window, independent of `--ref`. | TC-ATTEMPT-011, 012, 010 | The count's independence from `--ref` is its own labelled cell; the omitted-tail branch (count 0) is TC-ATTEMPT-010's cell. |
| NFR-5 | Zero new error identities (124 / 4); zero `attempts.*` strings in code, docs, help, or output; every failure exits inside `{0,1,2}`; a store fault is never empty and an empty history is never a fault. | TC-ATTEMPT-015, 016, 017, 035, 039 | Both directions of the empty/unreadable pair are asserted in one file so neither can regress into the other. |
| NFR-6 | Zero credential resolutions, network requests, harness spawns, model calls on either surface; zero secrets, prompts, transcripts, diffs, credentials, or provider payloads in envelope, text, help, or logs; no local absolute path in the attempts text. | TC-ATTEMPT-019, 023, 028 | The attempts read's purity is asserted with the same counted ports the resolve path uses, so both surfaces share one evidence shape. |
| NFR-7 | 100% of resolutions clamp the note to 240 characters before the record is built; zero write failures from note length; zero duplicate records on replay; the original open record byte-identical; a blank note appends nothing. | TC-ATTEMPT-020, 021 | The clamp cell asserts the stored length is exactly 240 for a 400-character input. |
| NFR-8 | `unresolved` equals the exact folded open count for the reported repository on both the resolve result and the summary; `unresolvedIds` ≤ 20 with an omission declared; `idsTruncated` true exactly when identifiers were omitted. | TC-ATTEMPT-022, 038 | The structural cell proves the derivation is single; the behavioural cell proves the count is exact under the repository scope, unchanged where no foreign records exist, and that the identifier list narrows to 20 with the omission declared. |
| NFR-9 | 100% of delivered keys keep name, type, order, and meaning — with the summary divergence block's `unresolvedIds` as the only declared exception, keeping its name, type, and order while narrowing to at most 20 with `idsTruncated` and leaving `reported`, `resolved`, and `unresolved` exact counts — and zero new configuration keys, dependencies, packages, tokens, projection classes, exit literals, or product/binary literals. | TC-ATTEMPT-034, 035 | The shapes, the four delivered-form refusals, and the declared narrowing are suite-asserted; the additive-only half is review-verified against the merge base. |
| NFR-10 | `pnpm check` green, including help coverage, reference-page parity with `dispatch` pinned at five, error-table sync, and the aggregate suite. | TC-ATTEMPT-031, 035 | Reported per gate in §10, never as one aggregate verdict. |
| NFR-11 | Zero writes to the real user state directory; every new suite points the state-scope override at a per-test temporary root and asserts no leak. | TC-ATTEMPT-036 | Pre-write guard plus a post-suite fingerprint of the real state directory. |

## 4. Test Types and Layers

All new tests are `bun:test` suites under `tests/**`, discovered by `pnpm test`. Fixtures are never named `*.test.ts`.

- **Unit / pure** — the projection (`sixteen fields`, `divergenceRef` null-vs-string, `endedAt` mapping, corroboration derivation, comparison projection), the page/ordering/`hasMore` helper, and the shared divergence-count computation are asserted directly against the helper over already-built records. A UI-level green must not be able to hide a pure-function regression, so these cells exist in their own `describe` blocks inside every owning `tests/behaviour/dispatch-attempts-*.test.ts` file (cells inside TC-ATTEMPT-006/007/008/024/038).
- **Behaviour / command composition (`tests/behaviour/dispatch-attempts-*.test.ts`)** — the real `createDispatchCommandDefinition` over the real `createDispatchGateRuntime` with an injected store, state root, repository resolver (persistence disabled), and ref source; `runCli` produces the envelope and the text. TC-ATTEMPT-001…010, 015, 016, 023, 024, 025, 026, 028, 034, 037, 039.
- **Behaviour / real production composition (`tests/behaviour/dispatch-attempts-scope.test.ts`, `tests/behaviour/dispatch-resolve-result.test.ts`, `tests/behaviour/dispatch-divergence-count.test.ts`)** — `createProductionComposer` over real temporary checkouts (one shared temporary host root, two project roots), or `createAdmissionHarness` for the resolve and count surfaces. Only declared seams are injected: home directory, environment record, `cwd`, origin remote, harness spawn runner, GitHub transport, git child runner, credential port. TC-ATTEMPT-011, 012, 013, 014, 018, 019, 020, 021, 022, 027.
- **Structural (`tests/structure/dispatch-attempts-*.test.ts`)** — TypeScript source/AST and registry inspection over `packages/**/src` plus declared allowlists; no composition, no fixture build, no `git` spawn. TC-ATTEMPT-017 (taxonomy closure), TC-ATTEMPT-029 (help/pointer naming), TC-ATTEMPT-038 (one count computation).
- **Structural extension (existing files)** — `tests/structure/dispatch-help-inventory.test.ts` (fifth entry, option lines) and `tests/structure/dispatch-resolve-composition.test.ts` (resolve purity over the production composition) are extended rather than duplicated, because they already own their subject.
- **Checks (`tests/checks/**`)** — the gate suites this change must keep green (`error-table-sync.test.ts`, `help-guide-coverage.test.ts`, `reference-page-parity.test.ts`, `exit-code-literals.test.ts`, `forbidden-literals.test.ts`, `privacy-literals.test.ts`, `privacy-release.test.ts`, `config-default-positions.test.ts`) and one new meta-check for test isolation (TC-ATTEMPT-036).
- **Golden** — one new golden digest (`tests/fixtures/dispatch/golden/attempts.txt`) pins the canonical text shape; it is regenerated only by an explicit reviewed command (`.ai/rules/testing-strategy.md` §"Invariant-test authoring").
- **Manual / review (evidence class: review-verified)** — TC-ATTEMPT-032, 033, the side-effect enumeration half of TC-ATTEMPT-014, the string-absence half of TC-ATTEMPT-017 over the M2 page and corpus, the reference-page half of TC-ATTEMPT-029, the additive-only and declared-narrowing half of TC-ATTEMPT-034, and the lockfile and manifest diff half of TC-ATTEMPT-035.
- **Performance** — one cell inside TC-ATTEMPT-037. No new framework; `p95` over 10 in-process samples with the measured value recorded in §10.
- **Regression (must stay green unmodified)** — `tests/conformance/dispatch/**` (the controlled fixture's cross-scope counting is unchanged), `tests/behaviour/dispatch-{truth-derivation,evidence-record,gate-evidence,gate-window,handover,resume,identity,delivered-evidence-divergence,resolve-diagnostics,envelope,error-envelope,exit-projection,determinism,token-closure,privacy,bounds}.test.ts`, `tests/structure/dispatch-{error-identity,composition,imports,envelope-detail,resolve-composition}.test.ts`. The two declared surface changes (the summary's repository-scoped counts and narrowed `unresolvedIds` with `idsTruncated`; the resolve's three additive keys) are the only cells these files may need adjusted, and each adjustment is listed in §7.3.

Runtime expectations: the two-checkout and migrated-root suites spawn `git` a bounded number of times (one `git init` per fixture checkout) and should stay under ~6 s per file on a warm cache; the structural and checks files are file-read-only and stay under ~1 s; the 5,000-record latency cell dominates the new runtime at ~5–15 s and is the one file allowed to exceed the others; the digest and contract suites are sub-second.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | Evidence Class | AC Coverage |
|-------|-------|------|-------|----------|----------------|-------------|
| TC-ATTEMPT-001 | Ref resolution: explicit flag and the active change default | Happy Path | Behaviour | High | Suite | AC-F1-1 |
| TC-ATTEMPT-002 | Unresolvable active change: three cells, one refusal, no store read | Negative | Behaviour | High | Suite | AC-F1-2 |
| TC-ATTEMPT-003 | Limit grammar: canonical decimal, the refusals, and the default page bound | Edge Case | Behaviour | High | Suite | AC-F1-3 |
| TC-ATTEMPT-004 | Total order across identical start instants and insertion orders | Corner Case | Behaviour | High | Suite | AC-F1-4 |
| TC-ATTEMPT-005 | `matched` and `hasMore` state the page's relation to the match set | Happy Path | Behaviour | High | Suite | AC-F1-5 |
| TC-ATTEMPT-006 | Sixteen-field projection, singular divergence reference, no undeclared key | Contract | Behaviour | High | Suite | AC-F2-1 |
| TC-ATTEMPT-007 | `endedAt` mapping, stored instants, and the corroboration triple | Contract | Behaviour | High | Suite | AC-F2-2 |
| TC-ATTEMPT-008 | Comparison projection and the `not-applicable` null token | Contract | Behaviour | High | Suite | AC-F2-3 |
| TC-ATTEMPT-009 | Machine byte bound: page-scope `bound: 65536` with a declared omission | Edge Case | Behaviour | High | Suite | AC-F2-4 |
| TC-ATTEMPT-010 | Ledger bound: newest 5,000, declared omission, ledger scope wins | Edge Case | Behaviour | High | Suite | AC-F2-5 |
| TC-ATTEMPT-011 | Two repositories on one host root, the same reference | Happy Path | Behaviour | High | Suite + mutation (P3) | AC-F3-1 |
| TC-ATTEMPT-012 | A migrated project root holding two repositories: count-only disclosure | Corner Case | Behaviour | High | Suite + mutation (P3) | AC-F3-2 |
| TC-ATTEMPT-013 | Outside any checkout: refuse rather than read the `unbound` store | Negative | Behaviour | High | Suite | AC-F3-3 |
| TC-ATTEMPT-014 | Read-only by evidence: zero appends, zero fences, stable bytes, permitted effects | Regression | Behaviour | High | Suite + Review-verified | AC-F4-1 |
| TC-ATTEMPT-015 | A verified empty history is success, not refusal | Happy Path | Behaviour | High | Suite | AC-F4-2 |
| TC-ATTEMPT-016 | Torn, unreadable, and permission-denied stores keep their `state.*` identity | Negative | Behaviour | High | Suite | AC-F4-3 |
| TC-ATTEMPT-017 | Taxonomy closure: 124 identities, four `dispatch` rows, zero `attempts.*` strings | Contract | Structural | High | Suite + Review-verified | AC-F4-4 |
| TC-ATTEMPT-018 | Resolve extension: local-evidence mode, subject repository, counts moved | Happy Path | Behaviour | High | Suite | AC-F5-1 |
| TC-ATTEMPT-019 | Resolve purity: zero credentials, network, spawns, model calls | Regression | Behaviour + Structural | High | Suite | AC-F5-2 |
| TC-ATTEMPT-020 | Replay is an idempotent noop with unchanged counts | Regression | Behaviour | High | Suite | AC-F5-3 |
| TC-ATTEMPT-021 | Blank note refused, long note clamped before the record is built | Edge Case | Behaviour | High | Suite | AC-F5-4 |
| TC-ATTEMPT-022 | Twenty-five open divergences: one exact repository-scoped count and the declared identifier narrowing | Corner Case | Behaviour | High | Suite + mutation (P2) | AC-F5-5 |
| TC-ATTEMPT-023 | Digest shape: summary line, seven cells, pointer, no run-form keys | Contract | Behaviour | High | Suite | AC-F6-1 |
| TC-ATTEMPT-024 | Corroboration derivation is a closed three-value derivation | Contract | Behaviour + Unit | High | Suite | AC-F6-2 |
| TC-ATTEMPT-025 | Human budget: 40 lines, 8,192 bytes, oldest dropped, declared cut | Edge Case | Behaviour | High | Suite | AC-F6-3 |
| TC-ATTEMPT-026 | Byte-identical text and structurally identical machine data | Regression | Behaviour | High | Suite | AC-F6-4 |
| TC-ATTEMPT-027 | One deterministic resolve line, including on replay | Contract | Behaviour | High | Suite | AC-F6-5 |
| TC-ATTEMPT-028 | No gate keys on the read side; the summary keeps the gate | Contract | Behaviour | High | Suite | AC-F7-1 |
| TC-ATTEMPT-029 | The pointer is the only route from evidence to gate | Contract | Structural + Behaviour | High | Suite + Review-verified | AC-F7-2 |
| TC-ATTEMPT-030 | `dispatch attempts --help` reachable and pure; root listing unchanged | Happy Path | Behaviour | High | Suite | AC-F8-1 |
| TC-ATTEMPT-031 | Help gates green with the dispatch pin at five | Contract | Checks | High | Suite | AC-F8-2 |
| TC-ATTEMPT-032 | The M2 attempts page is the delivered reference page | Documentation | Manual | High | Review-verified | AC-F8-3 |
| TC-ATTEMPT-033 | Feature spec and planning corpus state the delivered behaviour | Documentation | Manual | High | Review-verified | AC-F8-4 |
| TC-ATTEMPT-034 | Delivered shapes stable and the attempts payload unambiguously discriminated | Regression | Behaviour | High | Suite (shapes, four delivered-form refusals, discriminator) + mutation (P1) + Review-verified (additive-only) | AC-F9-1 |
| TC-ATTEMPT-035 | No new configuration key, dependency, package, token, projection, exit literal, or literal | Regression | Checks | High | Suite (scans and gates) + Review-verified (lockfile and manifest diff) | AC-F9-2 |
| TC-ATTEMPT-036 | Test isolation: no write reaches the real state directory | Regression | Checks | High | Suite | NFR-11 |
| TC-ATTEMPT-037 | One verified store read; latency at the ledger bound | Performance | Behaviour | Medium | Suite | NFR-2 |
| TC-ATTEMPT-038 | One divergence-count computation, no derivation from a list length | Regression | Structural | High | Suite + mutation (P2) | AC-F5-5, NFR-8, F-7 |
| TC-ATTEMPT-039 | Request grammar: non-canonical ref, unknown flag, unexpected positional | Negative | Behaviour | High | Suite | AC-F1-6 |

### 5.2 Scenario Details

#### TC-ATTEMPT-001 - Ref resolution: explicit flag and the active change default

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, DM-1, G-1, SC-M2-S12-02
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-ref.test.ts` over `tests/fixtures/dispatch/attempts-harness.ts`
**Tags**: @backend, @cli, @dispatch, @attempts

**Preconditions**:

- An isolated dispatch state root from `createDispatchState` with five attempt records for `GH-241` seeded through `appendDispatchAttempt` and `makeAttempt` with distinct `startedAt` instants (`2026-11-08T09:00:00.000Z` … `09:04:00.000Z`); three older records for `GH-240` in the same store, so `--ref` scoping is observable.
- The attempts harness composes the real `createDispatchCommandDefinition` over `createDispatchGateRuntime` with the store, the state root, a repository resolver fixed at `REPOSITORY` for this cell, and the delivered active-context seam pointing at a temp checkout's `.ai/local/pm-context.yaml`.
- The temp checkout is a real directory (not a repository) carrying only `.ai/local/pm-context.yaml`; the harness's ref source reads it through the same `readLocalPmContext` call the spend read side uses.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --limit 3 --json`; capture exit, envelope, and `data`.
2. Assert `data.ref`, `data.refSource`, `data.limit`, `data.command`, and the returned attempt identifiers.
3. Write `.ai/local/pm-context.yaml` with `active_change: { workItemRef: GH-241, branch: feat/GH-289/evidence-inspection, change_folder: doc/changes/2026-11/... }`.
4. Run `dispatch attempts --json` with no `--ref`; capture the same facts.
5. Assert that the two runs' `attempts[]` arrays are equal for the same effective page (the flag run is limited to 3; re-run step 1 with `--limit 20` to compare).

**Expected Outcome**:

- Step 1: exit `0`; `ok: true`; `command === "dispatch"`; `data.ref === "GH-241"`; `data.refSource === "flag"`; `data.limit === 3`; `data.attempts.length === 3`; the three identifiers are the records with the three latest `startedAt` instants.
- `data.attempts` contains no `GH-240` record (the ref filter is applied, not merely the repository filter).
- Step 4: `data.ref === "GH-241"`; `data.refSource === "active-change"`; `data.limit === 20` (the default); the page is the newest 20 of the two matching sets, which for five `GH-241` records is all five, newest first.
- The `--limit 20` re-run of step 1 and the step 4 run return deep-equal `attempts[]` arrays: the ref source changes the declaration, not the rows.
- No envelope carries an `error` member.

**Notes / Clarifications**:

- The active-context path is `${cwd}/.ai/local/pm-context.yaml`, the delivered seam (`readLocalPmContext` → `context.activeChange?.workItemRef`), not a second context format (spec §12 assumption, NG-8).
- `refSource` is asserted as an exact string, because it is the field that tells a consumer which rule produced `ref`; a boolean would not distinguish the two cells.
- SC-M2-S12-02's `divergenceRefs` is not asserted here; the reconciliation lives in TC-ATTEMPT-006 (spec Appendix B).

#### TC-ATTEMPT-002 - Unresolvable active change: three cells, one refusal, no store read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-2, DM-6, NFR-5, DEC-3, RSK-3
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-ref.test.ts`
**Tags**: @backend, @cli, @dispatch, @refusal

**Preconditions**:

- Three temp checkouts, each with a **populated** store at its project state root (at least one attempt record for `GH-241`), so "fell back to an empty success" would be observable as a wrong `attempts: []` rather than as a missing record.
- Cell A: no `.ai/local/` directory at all. Cell B: `.ai/local/pm-context.yaml` containing `{ "active_change": ` (unparsable YAML/JSON). Cell C: a parsable context with no `active_change` member (only `notes: []`).
- A counting store wrapper that **throws** from `readRecords()` and records the call count; every invocation in this test must perform zero reads.

**Steps**:

1. For each cell: run `dispatch attempts --json` with no `--ref`; capture exit, stdout, stderr, envelope, and the store read count.
2. Assert the exit, the error identity, `error.kind`, and the bounded summary.
3. Assert the store was never read and the store snapshot (file list, bytes, modes) is unchanged.
4. Repeat once with `--ref GH-241` in each cell and assert the read succeeds: the refusal is about the missing context, not about the repository.

**Expected Outcome**:

- Each of the three cells: exit `1`; `ok: false`; `error.code === "input.value.rejected"`; `error.kind === "input"`; no `data` member; the envelope is not an empty success (there is no `data.attempts` anywhere, and `ok` is false).
- The summary names **both** the context file (`.ai/local/pm-context.yaml`, path or file name) and the `--ref` remedy; it does not name a secret or echo file content.
- `error.category`, `retryable`, `consequence`, and `remediationHint` equal the delivered `ERROR_TABLE` row for `input.value.rejected` (read from the table, never hardcoded prose).
- Store read count `=== 0` in all three cells; the store's file list and bytes are identical before and after.
- Step 4: exit `0`, five rows, `refSource: "flag"` — a valid explicit ref needs no context.

**Notes / Clarifications**:

- **The assertion is "no store read and no append", not "zero filesystem effects".** Composing the production program resolves the state scope before the handler runs, so an invocation can mint the create-once **project checkout identity marker** or maintain the host index even when it refuses. Asserting a literal "opens no store" would contradict the spec's own inherited-effects rule (§8.5, NFR-3); see §8.3 X-2. The **dispatch repository binding marker** is still forbidden here: none of the three cells may create or repair it.
- The delivered spend refusal is `"no active change context; pass --ref <ref>"`, which names the remedy but not the file. AC-F1-2 requires the file as well, so the assertion is phrase-tolerant on the wording but strict on the two names (file and `--ref`).
- The three cells are one `describe` block so a regression in one direction cannot be masked by the other two.

#### TC-ATTEMPT-003 - Limit grammar: canonical decimal, the refusals, and the default page bound

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, DM-4, DEC-10, RSK-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-ref.test.ts`
**Tags**: @backend, @cli, @dispatch, @bounds

**Preconditions**:

- A store holding 25 attempt records for `GH-241`, all matching `REPOSITORY`, with distinct `startedAt` instants (so a default page of 20 is observable).
- A store seam that fails the test if `readRecords()` is called during any refusal cell.

**Steps**:

1. Run `--limit 1` and `--limit 100 --json`; assert exit `0`, `data.limit` echoing the value, and `data.attempts.length <= data.limit`.
2. Run each of `--limit 0`, `--limit 101`, `--limit -1`, `--limit abc`, `--limit 07`, `--limit +7`, `--limit " 7"`, `--limit 001`, and `--limit` with no following value; capture exit, envelope, and store read count.
3. Run with `--limit` omitted; assert the default page.
4. Assert that no refusal cell produced a clamped or normalised page.

**Expected Outcome**:

- Step 1: `--limit 1` → one row, `limit: 1`; `--limit 100` → 25 rows (all matches), `limit: 100`, `matched: 25`, `hasMore: false`.
- Step 2: every cell exits `1`, `error.code === "input.value.rejected"`, `error.kind === "input"`, **zero store reads**, and the message names the offending token (the supplied value, or `--limit` for the missing-value cell), the accepted range `1..100`, and the canonical decimal form (digits only, no sign, no leading zero, no surrounding whitespace — `[1-9][0-9]*`).
- Step 2's `--limit 101` cell returns **no** `data` member and **no** 100-row page: nothing is clamped (DEC-10). The `07`, `+7`, ` 7`, and `001` cells return no page at all: nothing is normalised into acceptance.
- Step 3: `data.limit === 20`; `data.attempts.length === 20`; `data.matched === 25`; `data.hasMore === true`.
- No cell exits `0` while refusing, and no cell exits `2`.

**Notes / Clarifications**:

- This is the cell a clamping implementation fails: the refusal cells assert the *absence* of a page, so a "sanitise to 100" implementation cannot pass.
- The canonical-form cells (`07`, `+7`, ` 7`, `001`) are the v1.1 ruling: AC-F1-3 and DEC-10 pin the accepted form to `[1-9][0-9]*`, so a leading zero, an explicit sign, or surrounding whitespace is refused rather than read as the same integer (§8.3 X-6, closed).
- `--limit` is deliberately **not** a `requiresValue` flag: the missing-value cell is refused by the command module's `attempts` grammar before any runtime call, because the shared parser would answer `fallback.invocation` (which satisfies neither the required code nor the message).

#### TC-ATTEMPT-004 - Total order across identical start instants and insertion orders

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-4, NFR-1
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-ref.test.ts`
**Tags**: @backend, @dispatch, @determinism

**Preconditions**:

- Store S1: three attempt records with identical `startedAt`, `recordedAt` pairs `t2 > t1` and identifiers `attempt-c`, `attempt-a`, `attempt-b`, appended in the order c, a, b.
- Store S2: the same three records appended in the reverse order (b, a, c), so insertion order differs and field order must govern.
- A fourth record with an earlier `startedAt` that must sort last.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json` twice against S1; capture the identifier sequence both times.
2. Run once against S2; capture the identifier sequence.
3. Assert the three sequences.

**Expected Outcome**:

- S1 run 1 === S1 run 2: byte-identical `attempts[]` identifier sequence.
- The two identical-`startedAt` groups order by `recordedAt` descending, then `attemptId` ascending: for the tie the order is `attempt-c`, `attempt-a` (c has the later `recordedAt`, a precedes b by identifier).
- S2 returns the same sequence as S1: the order does not depend on ledger insertion order.
- The earlier-`startedAt` record is last, after both tie groups.

**Notes / Clarifications**:

- The two-store cell is what proves "no dependence on filesystem iteration order or map order" (NFR-1); a single store with one append order could pass by accident.
- The identifiers are chosen so that lexicographic and numeric orderings differ from any hash ordering, making a map-iteration regression visible.

#### TC-ATTEMPT-005 - `matched` and `hasMore` state the page's relation to the match set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-5, NFR-2, DM-1, RSK-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-contract.test.ts`
**Tags**: @backend, @dispatch, @bounds

**Preconditions**:

- A store with exactly three matching attempts for `GH-241` and two non-matching attempts for `GH-240`.
- A second store with 25 matching attempts.

**Steps**:

1. Run `--limit 3 --json` on the three-match store; assert `matched`, `hasMore`, `attempts.length`.
2. Run `--limit 2 --json` on the same store; assert the same three fields.
3. Run `--limit 20 --json` on the 25-match store.
4. Run with no matching records.

**Expected Outcome**:

- Step 1: `matched: 3`, `hasMore: false`, `attempts.length: 3` (the non-matching two are not counted in `matched`).
- Step 2: `matched: 3`, `hasMore: true`, `attempts.length: 2`.
- Step 3: `matched: 25`, `attempts.length: 20`, `hasMore: true`.
- Step 4: `matched: 0`, `hasMore: false`, `attempts: []`.
- In every cell `hasMore === matched > attempts.length`, asserted by recomputing the predicate from the payload rather than asserting the literal alone.

**Notes / Clarifications**:

- The recomputed predicate is the contract's own definition; asserting it makes a "hasMore = attempts.length === limit" implementation fail at step 1 (where `3 === 3` but `hasMore` must be false) and at step 4.
- A page shortened by the byte bound is asserted in TC-ATTEMPT-009, where `hasMore` must also be true.

#### TC-ATTEMPT-006 - Sixteen-field projection, singular divergence reference, no undeclared key

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, Appendix D, G-1, SC-M2-S12-02
**Evidence Class**: Suite
**Test Type(s)**: Unit + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-contract.test.ts` (pure-helper cells against the projection helper; command cells through the harness)
**Tags**: @backend, @dispatch, @contract

**Preconditions**:

- One attempt carrying `divergenceRef: "DIV-7"` and a matching divergence record in the store.
- One attempt with no `divergenceRef` member at all.
- One attempt with `resumeMode` present and one without; one with 16 `evidenceRefs`, one with `[]`.
- The exact expected key set is a constant in the test: `["attemptId","comparison","corroboration","divergenceRef","endedAt","evidenceClass","falseSuccess","harness","outcome","recordedAt","ref","repository","resumeMode","startedAt","token","evidenceRefs"]`.

**Steps**:

1. Project the records through the pure helper; assert each row's sorted key set, and each value's `typeof`/shape.
2. Run `dispatch attempts --ref GH-241 --json` and assert the same over the emitted rows.
3. Assert the divergence-carrying row's `divergenceRef` equals the stored identifier; assert the other has the key present with value `null`.
4. Deep-scan the serialized payload for undeclared or forbidden keys.

**Expected Outcome**:

- Every row's `Object.keys(row).sort()` equals the constant above — no more, no fewer (an exact-set assertion, not `toContain`).
- `divergenceRef` is `"DIV-7"` on one row and `null` on the other; `Object.hasOwn(row, "divergenceRef")` is `true` on both, and `Array.isArray(row.divergenceRef)` is `false` everywhere.
- The serialized payload contains **no** `"divergenceRefs"` key, no `"schema"`, no `"handoverState"`, and no `"prefillCostAcknowledged"` (the last is a run-envelope fact, DEC-6).
- `resumeMode` is the recorded string or `null`; `evidenceRefs` is an array with at most 16 entries; `falseSuccess` is a boolean; `token` is one of the eleven delivered tokens; `evidenceClass` is one of the four declared values.
- No row carries a prompt, transcript, diff, credential, or provider payload (asserted as an exact key set, which is the strongest available form).

**Notes / Clarifications**:

- SC-M2-S12-02's `divergenceRefs[]` is reconciled by asserting the singular field present-or-explicitly-`null` (spec Appendix B, DEC-4); the superseded list form is asserted **absent**, so a partially migrated implementation fails.
- `Object.hasOwn` rather than a property read is used because `row.divergenceRef === undefined` passes for both `null` and a missing key, and the contract requires the explicit `null`.

#### TC-ATTEMPT-007 - `endedAt` mapping, stored instants, and the corroboration triple

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-2, DEC-6
**Evidence Class**: Suite
**Test Type(s)**: Unit + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-contract.test.ts`
**Tags**: @backend, @dispatch, @contract

**Preconditions**:

- One attempt with `startedAt = "2026-11-07T08:00:00.000Z"`, `finishedAt = "2026-11-07T09:30:15.250Z"`, `recordedAt = "2026-11-07T09:30:16.000Z"` — deliberately distinct, with sub-second precision in the finish instant.
- A corroboration triple of `pmNotes: satisfied`, `tracker: unsatisfied`, `ci: not-applicable`.

**Steps**:

1. Project the record; compare `endedAt`, `startedAt`, `recordedAt` with the stored values.
2. Render the text digest; extract the row and compare the first cell with the stored `startedAt`.
3. Assert the corroboration object's three keys and values.
4. Assert no reformatting: no `Z`→`+00:00` rewrite, no truncation to seconds, no locale date.

**Expected Outcome**:

- `row.endedAt === record.finishedAt` (string equality), `row.startedAt === record.startedAt`, `row.recordedAt === record.recordedAt`.
- The digest's first cell is exactly `record.startedAt` as stored; the digest contains no `2026-11-07T08:00:00` reformatted form.
- `row.corroboration` deep-equals `{ pmNotes: "satisfied", tracker: "unsatisfied", ci: "not-applicable" }`; the keys are exactly those three.
- `row` carries no `finishedAt` name (the stored name is not leaked beside the projected one).

**Notes / Clarifications**:

- The sub-second finish instant is the cell that catches a "seconds precision" formatter; the distinct three instants catch an accidental reuse of one timestamp for another.
- The corroboration cell's *rendering* is TC-ATTEMPT-024's subject; this TC asserts the machine values.

#### TC-ATTEMPT-008 - Comparison projection and the `not-applicable` null token

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2
**Evidence Class**: Suite
**Test Type(s)**: Unit + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-contract.test.ts`
**Tags**: @backend, @dispatch, @contract

**Preconditions**:

- One attempt whose `token` belongs to the session family, so `comparisonForToken` builds `{ class: "not-applicable", token: null, outcome: "not-applicable" }`.
- One attempt whose token belongs to the tracker family with a recorded mismatch, so the comparison carries a class, a non-null token, and an outcome.
- A divergence record whose `attemptId` matches the comparing attempt and whose `engineToken`/`comparisonToken` agree with the comparison.

**Steps**:

1. Project both records; assert each `comparison` object's exact keys and values.
2. Assert the invariant `comparison.token === null` exactly when `comparison.class === "not-applicable"`.
3. Run the read and assert the divergence-carrying row's `divergenceRef` is consistent with the divergence record in the store.
4. Assert `comparison.outcome` is one of the three declared values.

**Expected Outcome**:

- Session-family row: `{ class: "not-applicable", token: null, outcome: "not-applicable" }` — the keys are exactly `class`, `token`, `outcome`.
- Comparing row: the stored class, the stored non-null token, and the stored outcome (`match` or `mismatch`).
- The biconditional holds for every row in the page; no row has `token: null` with a comparing class and no row has a non-null token with `not-applicable`.
- The row's `divergenceRef` equals the divergence record's `divergenceId` for that attempt, and the attempt's `token`/`comparison.outcome` pair agrees with the divergence's `engineToken`/`comparisonToken` semantic (mismatch ⇒ the two differ).

**Notes / Clarifications**:

- The biconditional is asserted because the delivered comparison builder already guarantees it; the projection must preserve it rather than "helpfully" substituting a token.
- Nothing here re-tests the comparison model (NG-2); the assertion is about the projection's fidelity.

#### TC-ATTEMPT-009 - Machine byte bound: page-scope `bound: 65536` with a declared omission

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-4, DM-5, NFR-2, RSK-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-bounds.test.ts` over `tests/fixtures/dispatch/attempt-records.ts`
**Tags**: @backend, @dispatch, @bounds

**Preconditions**:

- A maximal-record builder in `tests/fixtures/dispatch/attempt-records.ts`: 16 evidence references of **64 characters** each, a 40-character `attemptId`, the longest delivered token, both optional members present (`divergenceRef`, `resumeMode`), and a distinct `startedAt`. At roughly 1.1–1.2 KB per row, 100 rows exceed 65,536 bytes with margin, so the page bound provably binds rather than being hoped for.
- A store with 100 such records for `GH-241`, all matching `REPOSITORY`.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --limit 100 --json`; capture the envelope.
2. Measure `Buffer.byteLength(JSON.stringify(envelope.data), "utf8")`.
3. Assert the page/truncation relationship.
4. Run against a 3-record store and assert `truncation` is absent.

**Expected Outcome**:

- Step 2: `<= 65_536`.
- `data.attempts.length > 0` (the bound never starves the page) and `data.attempts.length <= 100`.
- If `data.attempts.length < data.matched`, then: `data.truncation.scope === "page"`, `data.truncation.bound === 65_536` (the serialized `data` byte budget — DM-5, AC-F2-4), `data.truncation.omittedRecords > 0`, `data.hasMore === true`, and `omittedRecords` equals the number of otherwise-eligible rows the byte budget dropped — in this fixture `matched - attempts.length`, because no other bound is in play.
- With the maximal builder, the shortening cell is reachable: the test asserts `data.attempts.length < 100` in the maximal cell (the arithmetic above makes that deterministic), so the declaration path is exercised, not merely tolerated.
- Step 4: `truncation` is absent (`Object.hasOwn(data, "truncation") === false`) and the 3 rows round-trip unchanged.

**Notes / Clarifications**:

- The 64-character reference length is a deliberate fixture constant, not an incidental value: with short references 100 rows would fit and the page-bound branch would never execute, producing a vacuous green (TR-5).
- `truncation` is a single object; the ledger scope takes precedence, which is asserted in TC-ATTEMPT-010.
- The byte bound is measured over `data`, as the criterion states, not over the whole stdout.
- **`bound` is pinned per scope by spec v1.1** (F-2, DM-5, AC-F2-4): `5000` for `ledger` (TC-ATTEMPT-010) and `65536` for `page`, the serialized `data` byte budget. The page-scope cell asserts the literal `65_536`, so a row-bound reading fails (§8.3 X-9, closed).

#### TC-ATTEMPT-010 - Ledger bound: newest 5,000, declared omission, ledger scope wins

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, F-4, AC-F2-5, AC-F3-2 (omitted-tail branch), DM-1, DM-5, NFR-2, NFR-4, RSK-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-bounds.test.ts`
**Tags**: @backend, @dispatch, @bounds

**Preconditions**:

- A store whose `readRecords()` returns 5,001 attempt ledger records in append order, with ascending `startedAt`, all matching `REPOSITORY` and `GH-241`; identifiers `attempt-0001` … `attempt-5001`. The records are shared frozen objects (built once) so the cell stays fast.
- One variant appends a 5,002nd record whose `repository` is `REPOSITORY_BETA`, positioned **first** (the oldest, therefore omitted by the ledger bound).

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json`; capture `data`.
2. Assert the truncation object, the match count, and the retained identities.
3. Run with `--limit 1` against the same store; assert the ledger scope still wins over the page scope.
4. Run the foreign-in-omitted-tail variant and assert `excluded.foreignRepository === 0`.

**Expected Outcome**:

- Step 2: `data.truncation.scope === "ledger"`, `data.truncation.bound === 5000`, `data.truncation.omittedRecords === 1`; `data.matched === 5000` (never above the bound); `data.hasMore === true`.
- The returned page contains the newest rows: `attempt-0001` is **absent**, `attempt-5001` is present (default `limit` is 20, so the newest 20 are `attempt-4982`…`attempt-5001`).
- Step 3: `data.truncation.scope === "ledger"` (precedence, DEC-11), `omittedRecords === 1`, `data.attempts.length === 1`; no second truncation object and no `page` scope in the payload.
- Step 4: `excluded.foreignRepository === 0`, because the foreign record sits only in the ledger's omitted tail and the read never retained it — the count describes the newest 5,000 records that were read, never what is on disk (spec F-3, DM-1, AC-F3-2 second branch; §8.3 X-3, closed).

**Notes / Clarifications**:

- The fake-store cell is the honest way to reach 5,001 records: the bound under test lives in `readDispatchAttempts` over `store.readRecords()`, and the real jsonl store is already exercised by every other cell. The record validator still runs (a malformed payload would return `state.store.torn`).
- The omitted-tail cell is deliberate and now owns the second branch of AC-F3-2: a "count every foreign record in the file" implementation would return 1 and fail step 4.
- The ledger bound and the page bound are independent; only one truncation object is ever emitted (DM-5).

#### TC-ATTEMPT-011 - Two repositories on one host root, the same reference

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-1, NFR-4, G-3, RSK-1
**Evidence Class**: Suite + mutation (P3: dropping the record filter reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-scope.test.ts` over `tests/fixtures/dispatch/attempts-production.ts` (real `createProductionComposer`)
**Tags**: @backend, @cli, @dispatch, @isolation

**Preconditions**:

- One temporary host root `H` (from `createHostFixture`), one temporary home **distinct** from `H`, and two real checkouts created by `tests/fixtures/projects/temp-repos.ts` (`git init -b main`, one commit each, distinct origins `https://github.com/owner/repo.git` and `https://github.com/owner/other.git`).
- Both checkouts are composed with the same `host` object, so both derive project roots under `H/projects/`; the state-scope override is set to `H` as an absolute path.
- Three attempt records for `GH-241` appended under **each** project root through `appendDispatchAttempt` on that checkout's store, with `repository` equal to that checkout's resolved identity.

**Steps**:

1. Confirm the two project roots differ and each contains its own attempt ledger.
2. Run `dispatch attempts --ref GH-241 --json` in checkout A; capture the envelope.
3. Run the same in checkout B.
4. Scan both envelopes, their warnings, and both text digests for the other checkout's identifiers.
5. Snapshot checkout B's project root before and after A's run.

**Expected Outcome**:

- Step 1: two distinct project roots, each with the delivered ledger artifact set; neither root holds the other's ledger.
- Step 2: `data.repository === "github.com/owner/repo"`; three rows, all with `repository` equal to that identity; `excluded.foreignRepository === 0`.
- Step 3: `data.repository === "github.com/owner/other"`; its own three rows; `excluded.foreignRepository === 0`.
- Step 4: zero occurrences of the other repository's identity, attempt identifiers, or refs in any envelope, warning, or digest.
- Step 5: checkout B's project-root file list, bytes, and modes are identical (A's read touches only A's root).

**Notes / Clarifications**:

- This cell proves the **physical** half of the double enforcement. TC-ATTEMPT-012 proves the logical half; neither alone is sufficient (TDR-0023 C-6).
- The harness injects only the home, environment, `cwd`, origin remote, and the recording seams; it exposes no way to inject a state root or a repository identity, so the assertion reads what the production derivation actually resolved (TR-1).
- The distinct origins are what make `data.repository` meaningful; identical origins would resolve to one identity and the isolation claim would be untestable.

#### TC-ATTEMPT-012 - A migrated project root holding two repositories: count-only disclosure

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-4, G-3, DEC-8, RSK-1
**Evidence Class**: Suite + mutation (P3)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-scope.test.ts`
**Tags**: @backend, @cli, @dispatch, @isolation, @privacy

**Preconditions**:

- Checkout A's project root (the post-migration shape: one root, two repositories' history — built by appending records with a foreign `repository`, which is exactly what the wholesale migration produces without re-attribution; the file move itself is GH-288's subject and adds nothing here).
- Seeded: three records for `github.com/owner/repo` / `GH-241`; two for `github.com/owner/other` / `GH-241`; one for `github.com/owner/other` / `GH-999` with a distinct harness, a distinct divergence reference, and a distinct `recordedAt`.
- A pre-run snapshot of the project root.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json` from A; capture the envelope and text.
2. Assert the returned rows, `excluded.foreignRepository`, and the total ledger population.
3. Run `dispatch attempts --ref GH-999 --json` from A; assert the excluded count again.
4. Scan the envelope, its warnings, and the digest for every foreign identifier, ref, divergence reference, harness value, and timestamp.
5. Re-take the project-root snapshot.

**Expected Outcome**:

- Step 2: three rows, all with `repository === "github.com/owner/repo"`; `excluded.foreignRepository === 3` — the foreign-repository records **within the retained ledger read window** (newest 5,000), which here is the whole store; `matched === 3`.
- Step 3: `excluded.foreignRepository === 3` again — the count is independent of `--ref` (it describes the root, not the query); `matched === 0` and `attempts: []` in this cell (no A record for `GH-999`), which doubles as an empty-history success inside a non-empty store.
- Step 4: zero occurrences of `github.com/owner/other`, the two foreign attempt identifiers, `GH-999`, the foreign divergence reference, the foreign harness value, and the foreign `recordedAt` string, in the envelope, any `warnings` member, and the text digest.
- Step 5: the project-root snapshot is unchanged (the read appended nothing).
- The excluded count is disclosed as a number only: no array, no object, no identifier list stands beside it.

**Notes / Clarifications**:

- This TC owns the **retained-window branch** of AC-F3-2; the **omitted-tail branch** (a foreign record that exists only beyond the newest 5,000 yields `0`) is TC-ATTEMPT-010's step 4, where the 5,001-record store already exists. Splitting the branches keeps each fixture honest: a real-store count here, a fake-store window there.
- The third foreign record (`GH-999`) is the cell that distinguishes "count foreign records that match the ref" from "count foreign records in the ledger read": the second record set returns 3, not 2.
- A migrated-root fixture built by seeding is deliberately preferred over replaying GH-288's migration move: the migration's byte fidelity is GH-288's criterion (AC-F8-1 there), and asserting it again here would create a second owner of the same behaviour.
- Mutation P3 (drop the `repository` filter) reds step 2 with six rows and `excluded 0`.

#### TC-ATTEMPT-013 - Outside any checkout: refuse rather than read the `unbound` store

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-3, DM-6, NFR-3, RSK-1
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-scope.test.ts`
**Tags**: @backend, @cli, @dispatch, @refusal, @scope

**Preconditions**:

- A working directory outside **every** git work tree, produced by `nonCheckoutDirectory()`; the fixture asserts `findGitRoot(dir, nodeRepositoryIo()) === undefined` before composing and fails loudly otherwise.
- The host-scoped `unbound` store is **populated** with an attempt record for `GH-241` (written through a store opened at `<host root>/unbound`), so "presented the unbound store as a repository's history" would be observable as rows.
- A temporary host root and a home distinct from it.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json` from the outside directory.
2. Capture exit, error identity and kind, the summary, and any `data`.
3. Assert the unbound-record absence and that no `dispatch-identity.json` exists anywhere under the outside directory, the host root, or the home.
4. Run `status --json` from the same directory and assert exit `0` (the GH-288 declared scope is unchanged).

**Expected Outcome**:

- Step 2: exit `1`; `error.code === "input.value.rejected"`; `error.kind === "input"`; the summary names the checkout — that no git work tree was found at the invoking path — and does not name a repository.
- No `data.attempts`; no row carrying `github.com/**`; the unbound store's record (identifier, ref, timestamps) appears nowhere in the envelope, warnings, or stderr.
- Step 3: the **dispatch repository binding marker** (`<git-common-dir>/dispatch-identity.json`) was not created or repaired — identity resolution ran with persistence disabled and refused, so no binding exists after the refusal. This is the marker rule of spec F-3/§8.5; it is distinct from the project checkout identity marker, which a store-opening invocation may mint (§3.2, §8.3 X-5).
- Step 4: exit `0`, confirming that the refusal belongs to the read side's repository rule and not to the delivered state-scope policy, which still declares `unbound` for every other command.

**Notes / Clarifications**:

- The populated unbound store is the whole point: an empty one would let a wrong implementation pass by returning nothing.
- This is the only cell that distinguishes "no repository identity" from "unresolvable identity"; both are `input.value.rejected`, but only here is the remedy the checkout itself.
- The marker assertion is a **filelist** check, not a read of the resolver's internals: it proves the read did not persist a binding on its way to refusing.

#### TC-ATTEMPT-014 - Read-only by evidence: zero appends, zero fences, stable bytes, permitted effects

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F4-1, NFR-3, RSK-9, C-7
**Evidence Class**: Suite + Review-verified (the side-effect enumeration)
**Test Type(s)**: Integration
**Automation Level**: Automated (suite half) + Manual (review half)
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-scope.test.ts`
**Tags**: @backend, @dispatch, @read-only, @security

**Preconditions**:

- A checkout with an existing project root holding: three attempts, one open divergence, one handover record, one authority document, and the audit/retro artifacts the composition writes.
- A store wrapper that counts `append`, `acquireFence`, and `releaseFence` invocations and delegates to the real store.
- A snapshot helper recording, for every file under the project root and the host root: name, sha256, mode bits, and `mtimeMs`.
- A **binding-marker-less** checkout as a second cell, and a checkout whose **dispatch repository binding marker** contains a torn value as a third; the **project checkout identity marker** is a separate artefact with its own cell.

**Steps**:

1. Snapshot both roots; record the record counts per kind via `readDispatchAttempts`, `readDispatchDivergences`, `readDispatchHandover`, and the authority read.
2. Run `dispatch attempts --ref GH-241 --json`, then the text form.
3. Re-snapshot; compare bytes, modes, and mtimes; assert the counters.
4. Assert the delivery-evidence record counts are unchanged.
5. Repeat in the binding-marker-less checkout: assert `readDispatchIdentityMarkerText(commonDir)` is still `undefined` afterwards (the read neither created nor repaired the **dispatch repository binding marker**).
6. Repeat in the torn-binding checkout: assert the marker text is byte-identical afterwards.
7. Read the **project checkout identity marker** through `readProjectIdentityMarker` before and after the run and assert it is unchanged when present.

**Expected Outcome**:

- `append === 0`, `acquireFence === 0`, `releaseFence === 0` across both invocations.
- Every delivery-evidence artifact (ledger, header, documents, retro sidecar, audit chain, quarantine) is byte-, mode-, and mtime-identical.
- Attempt, divergence, handover, and authority record counts are unchanged.
- Host index: `0` writes on a run where the maintained content is unchanged (second invocation after registration); at most `1` write on a first invocation — asserted per cell, not as an aggregate.
- The **project checkout identity marker** (GH-288's create-once scope marker) may exist before the run and is byte/inode/mtime-identical afterwards; the test does not forbid its first-use creation, because scope resolution performs it for every store-opening invocation (spec §8.5, NFR-3).
- Step 5: the **dispatch repository binding marker** (`<git-common-dir>/dispatch-identity.json`) is still absent — persistence is disabled. Step 6: the torn binding is not repaired. Neither is re-persisted from any argument.
- Text output contains no absolute path (host root, project root, or home), so no path is disclosed by the digest (NFR-6).

**Notes / Clarifications**:

- **Two markers, two rules.** The project checkout identity marker (GH-288) is a permitted inherited effect; the dispatch repository binding marker (`dispatch-identity.json` in the git common directory) is forbidden to the read — 0 created, 0 repaired, 0 re-persisted. Conflating them is the most likely way this criterion gets a false green; spec v1.1 names them distinctly in F-3, AC-F4-1, §8.5, NFR-3, and the §23 glossary, so the naming in this plan is normative, not the plan's coinage (§8.3 X-5, closed).
- The review half enumerates which filesystem effects are permitted and why, in the change review; no permanent test can assert an exhaustive list of *absent* effects.
- mtime is never the sole evidence of "no write" (filesystem granularity; TR-2): the sha256 comparison is primary, mtime is corroborating.

#### TC-ATTEMPT-015 - A verified empty history is success, not refusal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-6, NFR-5, DEC-2, G-4, C-2
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-refusals.test.ts`
**Tags**: @backend, @dispatch, @empty-history

**Preconditions**:

- Cell A: a project root whose attempt ledger has never been created (a fresh checkout after one store-opening command).
- Cell B: a project root with attempts for `GH-240` only, read with `--ref GH-241`.
- Cell C: a project root with attempts for another repository only.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json` in each cell.
2. Assert exit, `ok`, `data`, and the absence of an error object or any `attempts.*` code.
3. Run the text form in cell A; capture stdout.
4. Assert the text lines exactly.

**Expected Outcome**:

- Each cell: exit `0`; `ok: true`; `data.attempts` deep-equals `[]`; `data.matched === 0`; `data.hasMore === false`; `Object.hasOwn(data, "truncation") === false`; no `error` member; `data.repository` still names the resolved repository and `data.ref` still names `GH-241`.
- The serialized payload contains no substring `"attempts."` (no invented identity leaks into the empty case).
- Step 3: exactly three lines — the summary line `attempts=0; repository=<identity>; ref=GH-241; has_more=false`, no row lines, and the pointer line.

**Notes / Clarifications**:

- Cell A is the "first inspection of a freshly dispatched ticket" the ruling exists for (DEC-2); cell B and C prove the rule holds for a filter mismatch too, not only for a missing ledger.
- The absence of `truncation` in an empty read is asserted because a "bound reached: 0" object would misdescribe the read.

#### TC-ATTEMPT-016 - Torn, unreadable, and permission-denied stores keep their `state.*` identity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, DM-6, NFR-5, C-1, C-2
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-refusals.test.ts`
**Tags**: @backend, @dispatch, @state-fault

**Preconditions**:

- Cell A (torn): a project root whose ledger holds an attempt record whose payload fails the delivered validator (for example a `token` outside the eleven-token vocabulary), written through the raw store so the reader classifies it `state.store.torn`.
- Cell B (unreadable): the delivered ledger file replaced by a **directory** of the same name — a structural provocation that behaves identically for any user, including uid 0.
- Cell C (permission-denied): the ledger file `chmod 0o200` (write-only), guarded by `process.getuid?.() !== 0`, and skipped with a recorded note when running as root.
- A populated repository in every cell, so `attempts: []` would be a wrong success.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json` in each cell.
2. Capture exit, `error.code`, `error.kind`, and the five error fields.
3. Look the returned code up in the delivered `ERROR_TABLE` and compare the four fields.
4. Assert nothing is reported as an empty history.
5. Assert the classification control: `classifyDomainKind("dispatch", <returned state code>)` yields `fallback.internal`.

**Expected Outcome**:

- Each cell: exit `2`; `error.kind === "state"`; `error.code` starts with `state.`; no `data` member and no `data.attempts`; the failure is not reported at exit `0`.
- The four fields `category`, `retryable`, `consequence`, `remediationHint` equal the `ERROR_TABLE` row for the returned code, and the summary names the store (file name or path) without echoing record content.
- Cell A returns `state.store.torn` specifically; cells B and C return the store's own read codes, whatever the delivered edge classifies, and the assertion is driven by the table rather than by a hardcoded list (so a future edge code does not invalidate the test).
- Step 5: `fallback.internal` — proving that a `state.*` code paired with a domain kind loses its identity, which is why the read must pass `kind: "state"` (TDR-0023 C-1).
- No cell emits an `attempts.*` string.

**Notes / Clarifications**:

- The structural provocation in cell B is primary; the `chmod` cell is secondary and uid-guarded (TR-3).
- "A store fault is never an empty history" and its converse (TC-ATTEMPT-015) live in the same file, which is the delivery of TDR-0023 C-2's "one place per direction".
- The delivered resolver already maps an absent identifier to `input.value.rejected`; this TC asserts the read side inherits the same discipline rather than inventing a code family.

#### TC-ATTEMPT-017 - Taxonomy closure: 124 identities, four `dispatch` rows, zero `attempts.*` strings

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, DM-6, NFR-5, DEC-1, C-1
**Evidence Class**: Suite (counts and scans) + Review-verified (M2 page and corpus)
**Test Type(s)**: Structural + Manual
**Automation Level**: Automated (suite half) + Manual (review half)
**Target Layer / Location**: `tests/structure/dispatch-attempts-taxonomy.test.ts`; review in the change review and §10
**Tags**: @backend, @dispatch, @taxonomy, @docs

**Preconditions**:

- The delivered `ERROR_TABLE`, `DOMAIN_KINDS`, the documented result-contract table, `packages/cli/src/help.ts` rendered output, and the reconciled feature spec.
- A declared scan target list: `packages/**/src`, `doc/spec/features/feature-result-contract.md`, `doc/spec/features/feature-dispatch-engine.md`, the rendered `dispatch --help` and `dispatch attempts --help`, `tests/fixtures/help-guide/coverage.json`.

**Steps**:

1. Assert `ERROR_TABLE.length === 124` and that the `dispatch` rows number exactly 4 with the delivered codes in the delivered order.
2. Assert the documented result-contract table still declares 124 rows and the bidirectional sync gate is green.
3. Scan each target for the substring `attempts.`.
4. Scan every captured stdout/stderr produced by the new suites' fixture corpus for `attempts.`.
5. Scan for a `ref-unknown`/`limit-invalid`/`ledger-unavailable` identifier anywhere.
6. Record the review of `doc/planning/oss-tooling/milestones/m2/commands/attempts.md`, `contracts.md`, and the planning corpus.

**Expected Outcome**:

- Step 1–2: `124`, `4`, the delivered codes, and a green sync gate; no row added, retired, or reworded.
- Step 3–5: zero matches in every suite target. A match is reported with file, line, and the offending string.
- Step 6 (review): the M2 page and the corpus carry no `attempts.*` row, the empty-history rule replaces the `ref-unknown` row, and the invalid-limit and unreadable-store rows name the delivered `input` and `state` identities (spec Appendix C).

**Notes / Clarifications**:

- **Phase boundary.** The code, table, help, and rendered-output targets are green from the phase that lands the command. The two `doc/spec/**` targets are added to the same test's constant list in the reconciliation phase, so no intermediate phase leaves the gate red while the doc is still pre-reconciliation. The phase table in §7 records this.
- The M2 page and the corpus are **review-verified** exactly as AC-F4-4 states; a prose-matching suite would pin wording rather than behaviour.
- This TC is also the negative assertion required by AC-F4-4: zero new rows, zero `attempts.*` strings, zero new tokens or projection classes.

#### TC-ATTEMPT-018 - Resolve extension: local-evidence mode, subject repository, counts moved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-3, G-5, DEC-5, DEC-9, SC-M2-S12-01
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-result.test.ts` over `tests/fixtures/dispatch/admission.ts`
**Tags**: @backend, @cli, @dispatch, @resolve

**Preconditions**:

- A production-composed checkout (`createAdmissionHarness`) whose project root holds three folded divergences for `github.com/owner/repo`: `DIV-7` open, `DIV-8` resolved, `DIV-9` resolved — plus `DIV-7`'s open record appended **after** an earlier `DIV-7` history record, so the fold is exercised.
- A baseline read of the divergence block through `dispatch dual-run summary --repo github.com/owner/repo --json`.

**Steps**:

1. Run `dispatch dual-run resolve DIV-7 --note "tracker was stale" --json`; capture the envelope.
2. Assert the delivered five keys and their meanings.
3. Assert the additive keys and the divergence block.
4. Compare with the summary baseline; assert the exact delta.
5. Read the store and assert the original open record's bytes.
6. **Cross-repository cell:** with `DIV-BETA` (repository `github.com/owner/other`) seeded in the same project root, resolve it from this checkout and assert the result's repository and counts.

**Expected Outcome**:

- Step 1: exit `0`; `ok: true`.
- Step 2: `divergenceId === "DIV-7"`, `state === "resolved"`, `resolved === true`, `note === "tracker was stale"`, `principal` equals the composition's principal; these five keep their delivered names, types, and meanings and appear **first** in key order.
- Step 3: `mode === "local-evidence"`; `repository === "github.com/owner/repo"`; `divergences` keys are exactly `reported`, `resolved`, `unresolved`, `unresolvedIds`, `idsTruncated`; `reported === 3`; `resolved === 3`; `unresolved === 0`; `unresolvedIds` does not contain `DIV-7`; `idsTruncated === false`. (The block describes the state **after** the resolution, which is the state the caller is being handed.)
- Step 4: the summary baseline reported `unresolved: 1` before the resolve and `2` resolved; after the resolve both read `unresolved: 0`, `resolved: 3` — a decrease of exactly one, with `DIV-7` removed from the identifier list on both surfaces.
- Step 5: the original open `DIV-7` record is byte-identical and the resolved record is a new append (append-only fold, no rewrite).
- Step 6: `data.repository === "github.com/owner/other"`, the counts describe that repository (not the invoking checkout's), and the resolution is **not refused** — the action is disclosed, not prevented (TDR-0023 D-7, spec OQ-1).

**Notes / Clarifications**:

- SC-M2-S12-01's `data.unresolved` is reconciled to `data.divergences.unresolved` because the counts belong to one declared block (spec Appendix B); no top-level `unresolved` is asserted, and its absence is asserted in TC-ATTEMPT-034.
- The cross-repository cell is a **declared known limitation** (TDR-0023 D-7). Asserting it makes the disclosure contract real; it does not imply the guard exists.
- The baseline is read from the summary rather than from a store inspection, because the criterion's claim is about what the two commands report.

#### TC-ATTEMPT-019 - Resolve purity: zero credentials, network, spawns, model calls

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-6, C-4, DEC-5
**Evidence Class**: Suite
**Test Type(s)**: Integration + Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-resolve-composition.test.ts` (existing file, extended) over `createAdmissionHarness`
**Tags**: @backend, @dispatch, @security, @resolve

**Preconditions**:

- `createAdmissionHarness({ credential: "missing" })`, whose counted credential port refuses, whose transport records every URL, and whose harness runner counts spawns.
- A provider transport that fails every request (`status: 503`) — the "unreachable tracker" condition, present and inert.
- A seeded open divergence `DIV-1`.

**Steps**:

1. Run `dispatch dual-run resolve DIV-1 --note "local evidence only" --json`.
2. Assert exit, `data.mode`, and that exactly one resolution was appended.
3. Assert `credentialResolutions === 0`, `requests.length === 0`, `spawns === 0`, `resumes === 0`.
4. Assert the mode is declared **because** the composition has no truth read: inspect the success payload for any conditional note or "unreachable" reason field.
5. Assert the same with `credential: "resolved"` — an available credential is also never touched.

**Expected Outcome**:

- Exit `0`; `data.mode === "local-evidence"`; the divergence ledger gained exactly one record.
- All four counters zero, in both credential modes.
- The payload carries no field that varies with tracker reachability: the key set and every value are identical between the two credential modes apart from the note/principal/timestamps.
- The suite's own spies are the evidence: the transport's 503 responses are never requested, so nothing can depend on them.

**Notes / Clarifications**:

- This extends the delivered `TC-RESOLVE-001` suite, which already owns "resolve is local-only"; adding a second owner for the same subject would be a maintenance liability.
- The `credential: "resolved"` cell is important: it proves the mode is unconditional rather than an artefact of a missing credential.

#### TC-ATTEMPT-020 - Replay is an idempotent noop with unchanged counts

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-7, G-5
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-result.test.ts`
**Tags**: @backend, @dispatch, @resolve, @idempotency

**Preconditions**:

- Two folded divergences: `DIV-7` open, `DIV-8` resolved. The first resolve of `DIV-7` has completed (TC-ATTEMPT-018's state).

**Steps**:

1. Capture the divergence record count and the byte digest of every record.
2. Run the identical resolve again (`DIV-7`, same note).
3. Assert the payload, the record count, the bytes, and the counts.
4. Run a third time with a **different** note; assert the stored note and principal are still those of the first resolution.

**Expected Outcome**:

- Step 3: exit `0`; `resolved === false`; `state === "resolved"`; the **stored** note (the first one) and principal are echoed; `divergences` is deep-equal to the pre-replay block; `attempts`/`divergences` record counts unchanged; every pre-existing record byte-identical.
- Text: `appended=false` and the unchanged `unresolved` count.
- Step 4: the differing note changes nothing — a replay reports the stored resolution, never the supplied note.

**Notes / Clarifications**:

- A third cell with a different note is added because "identical replay" alone cannot distinguish "idempotent" from "note is ignored on every replay"; the criterion's `resolved: false` plus an unchanged stored note is the observable that does.
- The byte digest is taken per record, not per file, so an in-place rewrite that preserves total size is still visible.

#### TC-ATTEMPT-021 - Blank note refused, long note clamped before the record is built

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-4, NFR-7, DEC-12, RSK-7
**Evidence Class**: Suite
**Test Type(s)**: Integration + Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-result.test.ts`
**Tags**: @backend, @dispatch, @resolve, @validation

**Preconditions**:

- An open divergence `DIV-7` and a record-count baseline.
- Note inputs: `""`, `"   "`, `"\t\n"`, a 240-character note, and a 400-character note built as `"x".repeat(400)`.
- `DISPATCH_MAX_NOTE_CHARS` read from the contracts module, never spelled as `240` in the assertion.

**Steps**:

1. For each blank variant: run the resolve; assert exit, error, and record count.
2. Run with the 240-character note; assert pass-through.
3. Run with the 400-character note; assert success, the stored note, and the reported note.
4. Read the appended record from the store and assert its `note` length.

**Expected Outcome**:

- Step 1: each blank variant exits `1` with `input.value.rejected`, `kind: "input"`, and the divergence record count is unchanged; the summary names the empty note as the reason.
- Step 2: exit `0`; stored and reported note length `=== DISPATCH_MAX_NOTE_CHARS`; content unchanged.
- Step 3: exit `0`; stored note length `=== DISPATCH_MAX_NOTE_CHARS`; reported note equals the stored note; no write failure, no exit `2`, no truncation warning.
- Step 4: the record's `note` is exactly the first `DISPATCH_MAX_NOTE_CHARS` characters of the supplied note.

**Notes / Clarifications**:

- The clamp is asserted **before** the record is built: the assertion reads the persisted record, not the command's echo, so a "clamp on display" implementation fails.
- The 240-character boundary cell is included because a `>`/`>=` slip would otherwise go unnoticed.
- The refusal is limited to blank notes; every non-blank note behaves as delivered (RSK-7), which the 240-character cell demonstrates.

#### TC-ATTEMPT-022 - Twenty-five open divergences: one exact repository-scoped count and the declared identifier narrowing

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-5, NFR-8, DEC-15, C-5, RSK-6
**Evidence Class**: Suite + mutation (P2: a list-length implementation reports 20 instead of 25 and reds it)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-divergence-count.test.ts` over `createAdmissionHarness`
**Tags**: @backend, @cli, @dispatch, @counts, @gate

**Preconditions**:

- One **migrated** project root holding, for `github.com/owner/repo`: 25 divergences whose latest folded state is `open` (`DIV-1`…`DIV-25`), and 3 whose latest folded state is `resolved`; two of the open identifiers also carry an earlier `resolved` record so the fold matters.
- The same root holds, for `github.com/owner/other`: 5 divergences whose latest state is `open`.
- A second **unmigrated** baseline fixture holding the same 25 open and 3 resolved records for `github.com/owner/repo` and **no** foreign records.
- A record of the delivered summary's block on each fixture (read at the same ledger state before the change), so the movement is asserted as a direction, not asserted from memory.

**Steps**:

1. Run `dispatch dual-run summary --repo github.com/owner/repo --json` on the migrated fixture; capture the divergence block (`S0`) and the text projection.
2. Assert `S0` against the exact expected numbers, the identifier bound, and the human `unresolved_divergences=` line.
3. Run the same summary on the unmigrated baseline fixture; capture its block (`S0u`) and assert its counts equal the recorded pre-change summary's counts for that root (`28`/`3`/`25`), so no movement is claimed where none occurs.
4. Run `dispatch dual-run resolve DIV-1 --note "cleared" --json`; capture its block (`R1`).
5. Re-run the summary and capture its block (`S1`); assert `R1` deep-equals `S1` — both describe the post-resolution ledger, so this is the same-state agreement assertion.
6. Assert the three declared movements together: the count is unchanged on the unmigrated fixture, lower on the migrated one because the foreign repository's 5 open divergences stop counting, and the resolve result carries a block it did not report before; `unresolved` stays the exact count while `unresolvedIds` narrows to at most 20 with `idsTruncated: true`.
7. Assert the post-resolution movement against `S0`.
8. Run the below-cap control: a fixture with 3 open and 2 resolved; assert `unresolved: 3`, `idsTruncated: false`, and both surfaces equal.
9. Assert each block's key list and key order: exactly `reported`, `resolved`, `unresolved`, `unresolvedIds`, `idsTruncated`, on both surfaces.

**Expected Outcome**:

- Step 2 (`S0`, migrated root): `reported === 28`, `resolved === 3`, `unresolved === 25`; `unresolvedIds.length === 20`; `idsTruncated === true`; `unresolvedIds` are exactly the first 20 open identifiers in fold order and contain no `resolved` identifier; the text projection prints `unresolved_divergences=` with exactly those 20 identifiers and nothing else.
- Step 3 (`S0u`, unmigrated root): `reported === 28`, `resolved === 3`, `unresolved === 25` — identical to the delivered summary's counts for that root, because the repository scope excludes nothing there; `unresolvedIds.length === 20` with `idsTruncated === true` remains the only declared difference. The count does **not** move where no foreign records exist.
- Step 5: `R1` deep-equals `S1` — same keys, same order, same values (asserted with `toEqual` on the whole block), which is only meaningful because both are read at the same ledger state.
- Step 6: the migrated-root block is explicitly `28`/`3`/`25` — not `33`/`3`/`30`, which is what the delivered store-wide fold reports for a root holding two repositories' records — so the count moves **down** by the 5 foreign open divergences and `reported` down by the same 5; the resolve result reports the block although it reported none before; and on both blocks `unresolved` is the exact `25` while `unresolvedIds` is the at-most-20 list with `idsTruncated: true`. Not `28`/`8`/`20`: that is the P2 list-length implementation (`unresolved = unresolvedIds.length`, `resolved = folded − 20`), which under-reports the count and must red this cell.
- Step 7: `R1.unresolved === 24`, `R1.reported === 28`, `R1.resolved === 4`, `DIV-1` absent from `unresolvedIds`; `S0.unresolved - R1.unresolved === 1`.
- Step 8: `unresolved === 3`, `idsTruncated === false`, `unresolvedIds.length === 3`, both surfaces equal.
- Step 9: `Object.keys(block)` is exactly `["reported","resolved","unresolved","unresolvedIds","idsTruncated"]` on the summary and on the resolve result; `reported`, `resolved`, and `unresolved` keep their names, types, order, and meanings as exact counts, `unresolvedIds` keeps its name, type, and order and narrows to at most 20 with `idsTruncated`, and `idsTruncated` is the one declared additive key on both (spec §8.5, AC-F5-5; §8.3 X-4, closed).

**Notes / Clarifications**:

- **This is the TDR-0023 residual-risk pin.** The delivered summary's `unresolved` and `resolved` are already exact but store-wide, so the declared movements are: a lower count on a migrated root (foreign open divergences stop counting), a block that did not exist on the resolve result, and an `unresolvedIds` list — and its human `unresolved_divergences=` line — that narrows to the documented 20 with the omission declared. An unmigrated root moves nothing but the list. All three are asserted in labelled cells, so none can be discovered in production, and the plan claims no upward movement it cannot produce.
- A test that only asserted "the two surfaces agree" would pass on a shared wrong rule (TR-9); the exact numbers plus TC-ATTEMPT-038's structural scan are the two halves of the guarantee.
- The gate is unaffected because the eligibility predicate tests for zero; the test asserts the verdict does **not** change at 25 (`blocked` before and after) while the count is reported and the identifier list is bounded.

#### TC-ATTEMPT-023 - Digest shape: summary line, seven cells, pointer, no run-form keys

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-2, G-6
**Evidence Class**: Suite
**Test Type(s)**: Integration + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-digest.test.ts`, golden `tests/fixtures/dispatch/golden/attempts.txt`
**Tags**: @backend, @cli, @dispatch, @text

**Preconditions**:

- Three attempt records with distinct `startedAt`, one carrying a divergence reference and one carrying none; corroboration manipulated so one row is `corroborated` and one `uncorroborated`.
- A fixed clock instant from `DISPATCH_NOW`, so the golden is stable.

**Steps**:

1. Run `dispatch attempts --ref GH-241`; capture stdout as an array of lines.
2. Assert line count, line 1's shape, each row's cell count and cells, and the last line.
3. Compare the whole output with the golden file.
4. Scan the whole output for the four forbidden run-form keys and for an absolute path.

**Expected Outcome**:

- Line 1 matches `^attempts=3; repository=github\.com/owner/repo; ref=GH-241; has_more=false$`.
- Lines 2–4 each split on spaces into exactly **seven** cells, in the order `<startedAt> <ref> <token> <corroboration> <divergenceRef|none> <harness> <evidenceClass>`; the divergence cell is the identifier or the literal `none`; rows are newest first.
- Last line (no truncation) is exactly `next: dispatch dual-run summary --repo github.com/owner/repo (coverage and floor)`.
- The output contains none of `result=`, `pr_url=`, `exit_code=`, `last_message=`, and no absolute path (host root, project root, or home).
- The output equals `attempts.txt` byte for byte.

**Notes / Clarifications**:

- The golden pins the shape; per-field equivalence is asserted in the same test so a regenerated golden cannot silently bless a wrong cell.
- `none` is asserted as the divergence placeholder because a blank cell would make the seven-cell split ambiguous.
- The pointer's `(coverage and floor)` suffix is the declared form in F-6; AC-F6-1's requirement (naming the summary command) is a subset of it.

#### TC-ATTEMPT-024 - Corroboration derivation is a closed three-value derivation

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-2
**Evidence Class**: Suite
**Test Type(s)**: Unit + Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-digest.test.ts` (pure derivation cells) and the same file's command cells
**Tags**: @backend, @dispatch, @text

**Preconditions**:

- The derivation rule as the spec states it: `uncorroborated` if any source is `unsatisfied`; otherwise `corroborated` if at least one is `satisfied`; otherwise `vacuous` (all three `not-applicable`).
- A table of the 27 triples over `{satisfied, unsatisfied, not-applicable}` generated in the test.

**Steps**:

1. For each triple, project a record and render its digest row; extract cell 4.
2. Assert the cell against the rule computed independently in the test.
3. Assert the rendered value is a member of the closed set.
4. Assert the three named cells from the criterion explicitly: `satisfied/satisfied/satisfied` → `corroborated`; `satisfied/unsatisfied/not-applicable` → `uncorroborated`; `not-applicable/not-applicable/not-applicable` → `vacuous`.

**Expected Outcome**:

- All 27 cells match the independently computed rule; the value set is exactly `{corroborated, uncorroborated, vacuous}` — no fourth value is producible.
- `not-applicable/satisfied/not-applicable` → `corroborated` (one satisfied with two inapplicable is corroboration, not vacuity).
- `unsatisfied/satisfied/satisfied` → `uncorroborated` (an unsatisfied source outranks satisfied ones).
- No cell renders `vacuous` when any source is `satisfied`.

**Notes / Clarifications**:

- Exhaustive enumeration is cheap (27 rows, pure function) and is the only way to prove "no fourth value"; three named cells alone would leave the boundary unproven.
- The independent recomputation in the test must not import the production derivation, or the assertion would be tautological.

#### TC-ATTEMPT-025 - Human budget: 40 lines, 8,192 bytes, oldest dropped, declared cut

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-2, RSK-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-digest.test.ts`
**Tags**: @backend, @dispatch, @bounds, @text

**Preconditions**:

- A page of 40 matching records with distinct `startedAt` instants and realistic cells, requested with `--limit 100`, so the human cut must drop rows.
- A second cell requesting `--limit 30` (below the human budget) so no cut occurs.
- A third cell where the machine page is already byte-shortened (TC-ATTEMPT-009's maximal builder), so the human cut applies to the returned page.

**Steps**:

1. Run the text form for the 40-row page; capture lines and byte length.
2. Assert the line budget, the row count, and the position and form of the truncation line.
3. Assert which rows survived and which were dropped.
4. Assert `has_more` in the summary line equals the JSON `hasMore` for the same invocation.
5. Assert the 30-row cell prints no truncation line and all 30 rows.
6. Assert the byte-shortened cell's digest describes the returned page, not the match set.

**Expected Outcome**:

- `lines.length <= 40`; `Buffer.byteLength(output, "utf8") <= 8_192`.
- The truncation line is exactly `truncation=human:bound:<kept>,omitted:<dropped>` with `kept + dropped === returnedRows` (not `matched`), and it is immediately before the pointer line.
- `kept <= 37`; the surviving rows are the **newest** `kept` rows and the dropped ones are the oldest (asserted by identifier).
- `has_more` in the summary line is unchanged by the row cut — it equals the JSON `hasMore`, which describes the match set, not the printed rows.
- Step 5: no truncation line; 30 rows; line count `<= 40`.
- Step 6: `kept` counts rows the machine page returned; no row is invented to fill the budget.

**Notes / Clarifications**:

- The `kept + dropped === returned` assertion is the one that catches a cut computed from `matched` instead of from the page, which would over-report the omission.
- The 8,192-byte assertion is separate from the line assertion because a line budget alone cannot bound wide rows.

#### TC-ATTEMPT-026 - Byte-identical text and structurally identical machine data

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, NFR-1, AC-F6-4
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-digest.test.ts`
**Tags**: @backend, @dispatch, @determinism

**Preconditions**:

- Two stores seeded with the same records in opposite insertion orders (as in TC-ATTEMPT-004) and the same repository identity.
- Two injected environment records differing only in `TZ`, `LANG`/`LC_ALL` (`tr_TR.UTF-8`), and `COLUMNS` (`40` and `200`).

**Steps**:

1. Run the text form twice against the same store; compare stdout byte for byte.
2. Run `--json` twice; compare parsed payloads with `toEqual` and compare the raw `data` key order.
3. Run the text and JSON forms against the second store (opposite insertion order); compare with the first store's output.
4. Repeat step 1 under each environment variant.

**Expected Outcome**:

- Text outputs are byte-identical across the two runs and across the two stores.
- Machine payloads are deep-equal and their key order is identical (asserted by comparing `JSON.stringify(data)` strings, not only parsed objects).
- The environment variants change nothing: no locale-formatted number or date, no width-dependent wrapping, no time-zone conversion.
- The output contains no locale-specific decimal separator or month name.

**Notes / Clarifications**:

- Comparing the serialized string as well as the parsed object is what catches a key-order drift, which `toEqual` alone would allow.
- `COLUMNS` is varied because a table renderer that reads terminal width would otherwise pass on one width.

#### TC-ATTEMPT-027 - One deterministic resolve line, including on replay

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-6, AC-F6-5
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resolve-result.test.ts`
**Tags**: @backend, @dispatch, @resolve, @text

**Preconditions**:

- Two folded divergences: `DIV-7` open, `DIV-8` resolved, in `github.com/owner/repo`.

**Steps**:

1. Run the resolve in text mode; capture stdout.
2. Assert the single line and its exact form.
3. Run the identical resolve again in text mode; capture stdout.
4. Assert the replay line.

**Expected Outcome**:

- Step 1: stdout is exactly one line, `\n`-terminated, matching `^divergence=DIV-7; state=resolved; appended=true; unresolved=0; mode=local-evidence; repository=github\.com/owner/repo$`.
- Step 3: the same shape with `appended=false` and the identical `unresolved` count.
- No banner, no second line, no path, no colour escape.
- The keys appear in the declared order (asserted by splitting on `; ` and comparing the key sequence).

**Notes / Clarifications**:

- This is the additive human line §8.5 declares; a consumer that requires empty human output on resolve must accept exactly one line, so the "exactly one" assertion is part of the contract, not a style preference.
- The replay cell is what proves `unresolved` describes the ledger, not the call.

#### TC-ATTEMPT-028 - No gate keys on the read side; the summary keeps the gate

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-1, G-6, NG-3
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-contract.test.ts` (attempts envelope) and the same file's summary cells
**Tags**: @backend, @cli, @dispatch, @gate

**Preconditions**:

- A store where the gate would be eligible (20 counted dispatches over 7 dates, no incidents, no unresolved divergences), so a duplicated gate would have something to report.
- A composition whose gate summarizer is wrapped in a counter.

**Steps**:

1. Run `dispatch attempts --ref GH-241 --json`; capture `data`.
2. Assert the exact `data` key set and deep-scan for the five forbidden keys.
3. Assert the gate summarizer counter is `0` for the attempts invocation.
4. Run `dispatch dual-run summary --repo <repository> --json`; assert its delivered fields are present and its text projection unchanged apart from the three declared changes on its divergence block: the counts become the exact repository-scoped counts (unchanged on an unmigrated root, lower on a migrated one), `unresolvedIds` narrows to the at-most-20 list with the declared additive `idsTruncated` key, and the human `unresolved_divergences=` line prints only the returned identifiers.

**Expected Outcome**:

- Step 1–2: `Object.keys(data).sort()` equals exactly `["attempts","excluded","hasMore","limit","matched","ref","refSource","repository"]` plus `"truncation"` only when a bound binds; a recursive key scan finds no `coverage`, `floor`, `verdict`, `eligibility`, or `unmetConditions` at any depth.
- Step 3: `0` gate evaluations.
- Step 4: the summary still carries `coveragePresent`, `coverageMissing`, `floor`, `verdict`, `unmetConditions`, `divergences`, `corroboration`, and the gate fields; its text output still contains `floor_only=true`; its divergence block is exactly `reported`, `resolved`, `unresolved`, `unresolvedIds`, `idsTruncated` in that order, with `reported`, `resolved`, and `unresolved` keeping their names, types, order, and exact-count meanings and `unresolvedIds` keeping its name, type, and order while narrowing to at most 20 with `idsTruncated: true`; when more than 20 identifiers are open, `unresolvedIds.length` is 20, `unresolved` stays the exact count, and the `unresolved_divergences=` line prints exactly the returned 20 identifiers; below the bound, `idsTruncated` is `false`, every identifier is returned, and the line matches. The counts may differ from a pre-change run only by moving **down** on a migrated root, which TC-ATTEMPT-022 pins.
- No `coverage` or `floor` value appears on the attempts side at any depth, and the attempts surface never evaluates the gate.

**Notes / Clarifications**:

- The recursive scan matters: a nested `verdict` inside an attempt row would pass a top-level key check while duplicating the gate.
- The gate counter proves the read never evaluates the gate, which a key-set assertion alone cannot.
- **Ownership splits by cell**: cells 1–3 are green at the command phase (delivery plan phase 2); cell 4 — the summary's block key order including `idsTruncated`, its narrowed `unresolvedIds`, and the matching human line — completes only with the count rule (delivery plan phase 3), so the command phase's green set is satisfiable without the count rule.

#### TC-ATTEMPT-029 - The pointer is the only route from evidence to gate

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, F-8, AC-F7-2, DEC-3
**Evidence Class**: Suite (pointer and help) + Review-verified (reference page)
**Test Type(s)**: Structural + Integration + Manual
**Automation Level**: Automated (suite half) + Manual (review half)
**Target Layer / Location**: `tests/structure/dispatch-attempts-composition.test.ts`; review in the change review and §10
**Tags**: @backend, @cli, @dispatch, @docs

**Preconditions**:

- The rendered digest, the static help inventory (`renderRootHelp`, `helpEntryFor(["dispatch"])`, `helpEntryFor(["dispatch","attempts"])`), and the M2 reference page.

**Steps**:

1. Assert the digest's pointer line names `dispatch dual-run summary --repo <repository>` with the resolved identity substituted.
2. Assert the family help synopsis contains the attempts usage line **and** the summary command.
3. Assert the `dispatch attempts` entry's help text names the summary command as the coverage/floor surface.
4. Review the M2 page for the same sentence and for the absence of any coverage/floor table of its own.

**Expected Outcome**:

- Steps 1–3: each of the three surfaces contains `dispatch dual-run summary --repo` and the resolved repository identity; the attempts envelope itself contains no coverage or floor value (TC-ATTEMPT-028).
- Step 4 (review): the page names the summary as the gate surface and computes no gate of its own.

**Notes / Clarifications**:

- The review half is exactly what AC-F7-2 declares; the suite half is the pointer and help text.
- Asserting all three surfaces in one test keeps the "one route" claim indivisible: a pointer that exists in the digest but not in help still leaves an operator without a route.

#### TC-ATTEMPT-030 - `dispatch attempts --help` reachable and pure; root listing unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6, G-7
**Evidence Class**: Suite
**Test Type(s)**: Integration + Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-help-version.test.ts` (extend, using the poisoned-composer pattern) and `tests/structure/dispatch-help-inventory.test.ts` (extend)
**Tags**: @backend, @cli, @dispatch, @help

**Preconditions**:

- The existing `invoke` helper in `tests/behaviour/dispatch-help-version.test.ts`, whose `composeProgram` throws if it is ever called.
- The resolved brand identity for `renderRootHelp`.

**Steps**:

1. Run `dispatch attempts --help` and `--version` through the poisoned composer.
2. Assert exit `0`, empty stderr, `composed === 0`, and the rendered content.
3. Assert the help-inventory count and the new entry's path, options, and example.
4. Assert the root listing's family set.

**Expected Outcome**:

- Step 2: exit `0`; `stderr === ""`; `composed === 0`; stdout contains the usage line `dispatch attempts [--ref <ref>] [--limit <n>]`, both `--ref` and `--limit` in the options block, `--json` in the global option block, an example, and the exit-code block naming `1` (refused) and `2` (state failure).
- Step 3: `allHelpEntries().filter(e => e.path[0] === "dispatch").length === 5`; the new entry's path is exactly `["dispatch","attempts"]`; its `seeAlso` contains the M2 attempts page path.
- Step 4: the root listing names exactly the seventeen delivered families; no line begins with `attempts`; `PROMPT_REQUIRED_COMMANDS` still has its delivered membership with no `attempts` member.

**Notes / Clarifications**:

- The poisoned composer is the delivered proof that self-description reads no state, network, git, or configuration; reusing it means this criterion cannot drift from the established discipline.
- The root-listing assertion is a *family* assertion: `attempts` is a subfamily, so a new root row would be a contract break (NG-6).

#### TC-ATTEMPT-031 - Help gates green with the dispatch pin at five

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, NFR-10, DEC-14
**Evidence Class**: Suite
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/reference-page-parity.test.ts` (extend: pin five, inventory registration), `tests/checks/help-guide-coverage.test.ts` (no change), `tests/fixtures/help-guide/coverage.json` (one row)
**Tags**: @backend, @cli, @gate, @docs

**Preconditions**:

- The fifth help entry (TC-ATTEMPT-030) and the M2 page registry rows.

**Steps**:

1. Run `pnpm check:help` and assert success with the delivered output.
2. Run the parity suite; assert the pin is five and the see-also target resolves.
3. Assert the coverage inventory's `commands` list is unchanged and `referencePages` gained exactly one row.
4. Assert the parity suite's per-command page root still resolves `dispatch` to the M1 page.

**Expected Outcome**:

- Step 1: exit `0`; the script reports every prompt-required command covered.
- Step 2: `allHelpEntries().filter(e => e.path[0] === "dispatch")` has length `5`; every see-also target exists; the M2 attempts page is in `referencePages`.
- Step 3: `coverage.commands` deep-equals the delivered set (no `attempts` row); `coverage.referencePages` contains `doc/planning/oss-tooling/milestones/m2/commands/attempts.md` and no command left the list.
- Step 4: `pageFor("dispatch") === "doc/planning/oss-tooling/milestones/m1/commands/dispatch.md"` (DEC-13), so registering the M2 page does not silently re-point the family page.

**Notes / Clarifications**:

- The pin move from four to five is a **declared contract update** (DEC-14); the test title states "five" so the diff is legible.
- The help entry, the inventory row, and the pin land in one phase: each alone leaves a gate red (§7.2 rule).

#### TC-ATTEMPT-032 - The M2 attempts page is the delivered reference page

**Scenario Type**: Documentation
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-3, DEC-1, DEC-2, DEC-4, DEC-7, DEC-13
**Evidence Class**: Review-verified
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/planning/oss-tooling/milestones/m2/commands/attempts.md` (reviewed; no test file)
**Tags**: @docs, @review

**Preconditions**:

- The delivered page after the reconciliation phase, and the merge base for the M1 page comparison.

**Steps**:

1. Inspect the page for each required element (Appendix C's six corrections).
2. Diff the M1 `dispatch(1)` page against the merge base.
3. Record the inspection in §10 and in the change review.

**Expected Outcome**:

- The page documents `--help` and `--version`; states the resolved exit table with **no** `attempts.*` rows and an empty history at exit `0`; prints `command: "dispatch"` in its envelope example; uses `attempts[].divergenceRef` (identifier or `null`) and no `divergenceRefs[]`; shows the declared digest, the human truncation line, and the coverage/floor pointer; replaces the example's `success` value with a token from the eleven-token vocabulary; states the bounds; retains the pack's planned-until-milestone-exit status header.
- The M1 page diff is empty (DEC-13).

**Notes / Clarifications**:

- This criterion is review-verified by the spec's own assignment; the review check is named here so the DoD gate has a concrete artefact to read.
- The M1-byte-unchanged half lives here rather than in TC-ATTEMPT-031 because it is a diff against a moving base, and no permanent suite may assert that.

#### TC-ATTEMPT-033 - Feature spec and planning corpus state the delivered behaviour

**Scenario Type**: Documentation
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-4, G-7
**Evidence Class**: Review-verified
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-dispatch-engine.md`, `feature-result-contract.md`, `feature-cli-entrypoint.md`, `feature-state-layer.md`, `feature-projects.md`, `doc/planning/oss-tooling/{backlog.md,status.md,milestones/m2/entrypoint-delta.md,cli-command-registry.md,milestones/m2/contracts.md}`, `doc/quality/test-specs/test-spec-dispatch-engine.md` (reviewed; no test file)
**Tags**: @docs, @review

**Preconditions**:

- The reconciliation diff (phase 7 of the lifecycle) and the delivered behaviour.

**Steps**:

1. Inventory each surface against spec §16.1's expected change.
2. Confirm the feature spec's grammar, read-side section, resolve paragraph, error paragraph, and bounds table.
3. Confirm the corpus entries: backlog marker, status snapshot, entrypoint-delta note, registry note, `attempts.v1` refinement.
4. Confirm the test-spec coverage rows and `links.related_changes`.
5. Record the inspection in §10.

**Expected Outcome**:

- The dispatch feature spec states the attempts grammar, the `attempts.v1` envelope and projection, the ordering and bounds, the ref-resolution and empty-history rules, the resolve's unconditional local-evidence mode plus repository and counts, and the error paragraph's explicit statement that the read side adds no row.
- The result-contract page carries one clarifying sentence and no row change.
- The CLI-entrypoint page lists `dispatch attempts` only if it enumerates subforms; the prompt-required set and root listing are unchanged.
- The state-layer and projects pages mention the store-opening read only where they already enumerate such commands.
- The M2 `attempts.v1` contract statement states the singular reference, the unconditional mode, the repository-scoped counts, and the read bounds; the backlog, status, entrypoint-delta, and registry entries record the delivery.

**Notes / Clarifications**:

- Review is the only gate for corpus freshness (RSK-10); the diff is the receipt.
- Nothing here is asserted by a suite, by design; a text-matching test would pin prose that the next milestone legitimately rewrites.

#### TC-ATTEMPT-034 - Delivered shapes stable and the attempts payload unambiguously discriminated

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-9, C-7
**Evidence Class**: Suite (shapes, the four delivered-form refusals, and the discriminator) + mutation (P1: renaming a delivered resolve key reds it) + Review-verified (additive-only half)
**Test Type(s)**: Integration + Structural + Manual
**Automation Level**: Automated (suite half) + Manual (review half)
**Target Layer / Location**: `tests/behaviour/dispatch-additive-stability.test.ts` — the suite §7.1 assigns to this case, which runs the four delivered-form refusal cells (cell 7) through `createCommandScenario`
**Tags**: @backend, @cli, @dispatch, @contract

**Preconditions**:

- A dispatch scenario (`createCommandScenario`) able to produce the run envelope, the summary envelope, and the handover result; an admission harness able to produce the resolve result.
- The delivered key sets recorded as constants in the test.
- The dispatch definition under test declares `acceptsAnyFlag: true` — the declaration this change adds — so the shared parser's unknown-flag branch is bypassed and only the handler's own guard can produce a refusal.
- A store seam over the command scenario (`createCommandScenario({ store })`) whose `read` and `readRecords` throw, so an invocation that reaches the store fails the cell instead of returning an empty store.

**Steps**:

1. Run `dispatch GH-301 --json`, `dispatch dual-run summary --repo <repo> --json`, and `dispatch handover <repo> --json`; assert their exact `data` key sets and key order.
2. Run the resolve and assert the five delivered keys keep their names, types, meanings, and appear first in order, followed by `mode`, `repository`, `divergences`.
3. Assert both divergence blocks (summary and resolve) carry exactly `reported`, `resolved`, `unresolved`, `unresolvedIds`, `idsTruncated` in that order, that `reported`, `resolved`, and `unresolved` keep their delivered names, types, order and exact-count meanings, that `unresolvedIds` keeps its name, type and order and narrows to at most 20 with `idsTruncated: true`, that a block with more than 20 open identifiers returns exactly 20 while `unresolved` stays the exact count, and that the summary's human `unresolved_divergences=` line prints exactly the returned identifiers.
4. Run the attempts read and assert: no `result`, `verdict`, or `operation` key; `attempts` is an array; exit `0` with `ok: true`.
5. Call each text selector directly with each payload shape and assert which renderer is chosen.
6. Review the branch diff for renames, removals, or retyping of delivered keys, for a second count rule, and for any change beyond the declared additions and the declared `unresolvedIds` narrowing.
7. **The unknown-flag cell of the delivered forms (cell 7).** In `tests/behaviour/dispatch-additive-stability.test.ts` — the suite §7.1 assigns to this case — run each delivered form through the command scenario with the definition's `acceptsAnyFlag: true` in force: `dispatch GH-301 --bogus`, `dispatch dual-run summary --repo <repo> --bogus`, `dispatch dual-run resolve DIV-1 --note n --bogus`, and `dispatch handover <repo> --bogus`. Assert each exits `1` with `error.code === "fallback.invocation"` under `kind: "fallback"`, and assert the throwing store seam was never entered, so "no store read" is proven by a seam that fails if read rather than by an empty result.

**Expected Outcome**:

- Steps 1–2: the four delivered surfaces' key sets are exactly as delivered (no key removed, renamed, retyped, or reordered); the resolve payload is a superset of the five keys with the additions after them.
- Step 3: the summary block and the resolve block both carry the same five keys in the same order; `idsTruncated` is the only addition to either block; `reported`, `resolved`, and `unresolved` keep name, type, order, and meaning as exact counts, and `unresolvedIds` keeps its name, type and order and narrows — to at most 20 with `idsTruncated: true` when identifiers are dropped — while the human line prints that same list (§8.5, AC-F5-5, AC-F7-1, NFR-9).
- Step 4: the attempts payload carries `attempts` (array), `matched`, `hasMore`, `excluded`, `ref`, `refSource`, `repository`, `limit`; it carries no `result`, `verdict`, or `operation`, so the exit projection is a plain success at exit `0`.
- Step 5: the attempts payload selects the attempts renderer and is **not** mistaken for the run form, the summary, or the handover result; each of the other three payloads selects its own renderer and never the attempts renderer.
- Step 6 (review): the diff against the merge base contains no change to a delivered key's name, type, meaning, or order, and only the declared additive keys (including `idsTruncated` on both divergence blocks), the declared repository-scoping of the summary's counts, and the declared `unresolvedIds` narrowing to its documented 20-identifier bound.
- Step 7 (suite, cell 7): each of the four delivered forms exits `1` with `error.code === "fallback.invocation"` under `kind: "fallback"` and prints that row's summary; zero store reads, proven by the throwing store seam (it was never entered); no append, no fence, no attempts identity. The refusal is produced by the handler guard, not by the shared parser: the definition accepts any flag, so `parseInvocation` never answers `unknown flag` for these forms. Deleting the guard makes the invocation reach the handler, which returns a different exit or code, so the cell is red — that is the guard's detection power and the negative control for the parser opt-out.

**Notes / Clarifications**:

- Mutation P1 (rename `principal` to `actor` in the resolve payload) must red step 2; that proves the shape assertion has detection power over delivered behaviour, which predates the change.
- Step 5 is the discriminator half: an implementation that keys the attempts renderer on "no `result` key" would also capture a handover payload, so the selector is called with all four shapes.
- The additive-only half is review-verified because no permanent test may compare against a moving base (`.ai/rules/testing-strategy.md`). Step 3 is the suite half that makes the `idsTruncated` addition safe: it is declared on both blocks, so a consumer pinning the four delivered fields still sees them unchanged.
- **Ownership splits by cell**: cells 1, 4, 5, and **7** are green at the command phase (delivery plan phase 2) — cell 7 is the unknown-flag suite cell of the delivered-form stability case, the cell spec §5.1 F-9 and AC-F9-1 cite; cells 2–3 — the resolve payload's added keys (`mode`, `repository`, `divergences`) and both blocks' `idsTruncated` with the narrowed identifier list — complete with the count rule (delivery plan phase 3); and cell 6 is the additive-only diff review, which stays **review-verified** at the review gate and is never counted as a boundary-green cell.
- **The delivered forms' refusal is proven by cell 7, not by the diff-review cell.** Cell 7 is the only cell in this case that invokes the delivered forms with an undeclared flag while `acceptsAnyFlag: true` is in force, so a coder who lands the declaration without the handler guard reds a named suite cell at the command boundary rather than relying on a diff. TC-ATTEMPT-039 stays the attempts grammar's own owner (AC-F1-6); this cell is the delivered family's.

#### TC-ATTEMPT-035 - No new configuration key, dependency, package, token, projection, exit literal, or literal

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, NFR-9, NFR-10
**Evidence Class**: Suite (scans and gates) + Review-verified (lockfile and manifest diff)
**Test Type(s)**: Checks + Manual
**Automation Level**: Automated (scans) + Manual (review half)
**Target Layer / Location**: existing suites, unchanged: `tests/checks/exit-code-literals.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/behaviour/dispatch-token-closure.test.ts`, `tests/checks/config-default-positions.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/checks/privacy-literals.test.ts`, `tests/checks/privacy-release.test.ts`
**Tags**: @backend, @gate, @release

**Preconditions**:

- The delivered registries: `ERROR_TABLE`, `DELIVERY_RESULT_TOKENS`, `DELIVERY_RESULT_PROJECTION_CLASSES`, the exit-literal scanner, the config catalog key set, the forbidden/privacy literal registries.

**Steps**:

1. Run each scan suite and assert green with no allowlist addition attributable to this change.
2. Assert `DELIVERY_RESULT_TOKENS` still has its delivered length and members; assert `DELIVERY_RESULT_PROJECTION_CLASSES` is unchanged; assert `ERROR_TABLE` is 124 with four `dispatch` rows.
3. Assert the config catalog's key set is unchanged (no new key).
4. Run the aggregate gate with a temporary state override.
5. Review the branch diff for `package.json`, `pnpm-lock.yaml`, `packages/*/package.json`, `pnpm-workspace.yaml`.

**Expected Outcome**:

- Steps 1–3: every scan green; token, projection-class, error-row, and config-key sets identical to the delivered sets; no new package or subpath.
- Step 4: `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits `0`.
- Step 5 (review): no dependency, no workspace package, no new lockfile entry, no new product or binary literal.

**Notes / Clarifications**:

- This TC adds no new file: the delivered scans already own each invariant, and a second owner would be a maintenance liability. Its contribution is the assertion that this change added nothing they would have to allow.
- The lockfile and manifest diff half is review-verified; a permanent test asserting "the manifest and lockfile did not change" would fail on any later legitimate dependency bump.

#### TC-ATTEMPT-036 - Test isolation: no write reaches the real state directory

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-11, AC-F4-1 (read-only spirit), G-2
**Evidence Class**: Suite
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-attempts-test-isolation.test.ts`
**Tags**: @backend, @gate, @isolation

**Preconditions**:

- `APPROVED_BASE` (`tmp/tmpdir`), `guardStateFixtureRoot`, `realStateFingerprint`, and `realStateDirectory` from `tests/fixtures/projects/state-scope.ts`.
- The list of files this change adds under `tests/figures`/`tests/behaviour`/`tests/structure`/`tests/checks`.

**Steps**:

1. Fingerprint the real state directory before the attempts/resolve/count suites run and after they finish.
2. Assert equality (or "absent" both times).
3. Source-scan every new suite file for `mkdtempSync`/`tmpdir()`/`homedir()` usage and assert each is reached through an approved fixture helper.
4. Assert each new suite disposes its roots in a `finally` block (structural: the file contains a `finally` whose body removes the fixture root).
5. Assert the fixture guard throws when handed the live workspace root or the real state directory.

**Expected Outcome**:

- Steps 1–2: the fingerprint is identical, so no suite wrote to the real state directory.
- Step 3: zero direct `tmpdir()`/`homedir()` calls in the new suites; every temporary root comes from `APPROVED_BASE`-rooted helpers.
- Step 4: every suite file has a teardown path; a suite that leaks is named in the failure.
- Step 5: the guard throws for both forbidden roots (negative controls prove the guard is live).

**Notes / Clarifications**:

- The meta-check exists because the isolation contract is a property of the tests, and a single `mkdtempSync(tmpdir())` in a new file would quietly write into the repository's own work tree when the aggregate gate sets `TMPDIR`.
- This mirrors the delivered GH-288 `TC-PROJ-038` discipline rather than inventing a new one.

#### TC-ATTEMPT-037 - One verified store read; latency at the ledger bound

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, AC-F2-5, AC-F1-5
**Evidence Class**: Suite
**Test Type(s)**: Integration + Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-bounds.test.ts`
**Tags**: @backend, @dispatch, @perf

**Preconditions**:

- A counting store wrapper that increments on `readRecords()` and on every other port call.
- A store at the 5,000-record bound (the TC-ATTEMPT-010 fixture), shared frozen records to keep construction out of the measurement.
- The fixed clock and repository identity, so no derivation cost varies.

**Steps**:

1. Warm up with two invocations; discard their timings.
2. Run 10 timed invocations of `dispatch attempts --ref GH-241 --json`; record each duration.
3. Assert the p95 against the declared threshold.
4. Assert the read count per invocation.
5. Record the measured p95 in §10.

**Expected Outcome**:

- `readRecords()` call count is exactly `1` per invocation; no second read of any kind (the counter covers every store port call, and the assertion is `readRecords === 1` plus "no unexpected port method").
- p95 `<= 5_000` ms over the 10 samples.
- The returned page is identical across samples (determinism at the bound, cross-checking TC-ATTEMPT-026).

**Notes / Clarifications**:

- The measurement is in-process and includes projection, ordering, and serialization — the work the bound describes; it excludes process start-up, which no threshold in the spec covers.
- A threshold breach is investigated and reported, never retried silently; the recorded number is the evidence.

#### TC-ATTEMPT-038 - One divergence-count computation, no derivation from a list length

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-5, NFR-8, F-5, F-7, DEC-15, C-5, TDR-0023 D-5
**Evidence Class**: Suite + mutation (P2)
**Test Type(s)**: Structural
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-attempts-count-rule.test.ts`
**Tags**: @backend, @dispatch, @structure, @counts

**Preconditions**:

- The delivered sources of both fold sites: `packages/core/src/domain/dispatch-gate.ts` (`foldEvidenceWindow`) and `packages/core/src/app/dispatch-ledger.ts` (`summarizeDispatchDivergences` — the capped-list helper that has no caller on any delivered surface and is retired by this change), plus the resolve enrichment in `packages/core/src/app/dispatch-gate.ts` and the summary composition.
- A TypeScript AST parse of `packages/**/src` with no allowlist, plus an import-graph scan over `packages/**` and `tests/**`.

**Steps**:

1. Locate every assignment to a `unresolved` property and every assignment to a `resolved` property in the dispatch sources; assert each derives from the single shared computation.
2. Assert no `unresolved` value is initialised from a `.length` of an identifier list, and no `resolved` value is initialised from `folded.length - <list>.length`.
3. Assert the summary's divergence block and the resolve enrichment both reference the same exported symbol (import graph), and that neither contains a local fold.
4. Assert exactly one latest-per-identifier fold over divergence records exists on these paths.
5. Assert the shared computation takes the repository (or a pre-filtered record set keyed by repository) as an input, so it cannot silently count the store.
6. Assert the retired `summarizeDispatchDivergences` has no surviving caller and no second derivation exists: the symbol is gone from `packages/core/src/app/dispatch-ledger.ts` and from both barrels (`packages/core/src/app/index.ts`, `packages/core/src/index.ts`), and no module under `packages/**` or `tests/**` references it — the delivered tree's only references were those two re-exports and one allowance row, and none survives.

**Expected Outcome**:

- Steps 1–4: one exported computation returns `{ reported, resolved, unresolved, unresolvedIds, idsTruncated }`; two consumers reference it; zero list-length derivations remain; one fold on these paths.
- Step 5: the computation's signature admits a repository scope, and the two call sites pass one.
- Step 6: zero references to `summarizeDispatchDivergences` remain anywhere in `packages/**` or `tests/**`, and the source scan finds no second place that derives `unresolved` or `resolved`.
- A failing assertion names the file, line, and the offending expression.

**Notes / Clarifications**:

- **This is the second half of the TDR-0023 residual-risk pin.** TC-ATTEMPT-022 proves the numbers are right; this test proves there is only one rule producing them, so a third fold cannot re-introduce a second definition (D-5). Step 6 is the reason the capped-list helper is deleted rather than left in place: an uncalled second derivation is still a second definition waiting for a caller.
- Mutation P2 (reintroduce `unresolved: unresolvedIds.length` with `resolved: folded.length - unresolvedIds.length`) reds both TC-ATTEMPT-022 (which reports `20` instead of `25`) and this test; the mutation is the negative control for the scan, per the delivered scan discipline (assert with file, line, and literal). Nothing delivered is reverted, because the delivered block does not carry that derivation.
- No implementation filename is pinned beyond the delivered files that already carry these two derivations; the module for the shared helper is the delivery plan's decision (§8.3 X-8).

#### TC-ATTEMPT-039 - Request grammar: non-canonical ref, unknown flag, unexpected positional

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-6, DM-6, NFR-5, DEC-1
**Evidence Class**: Suite
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-attempts-ref.test.ts`
**Tags**: @backend, @cli, @dispatch, @refusal

**Preconditions**:

- A store seam that fails the test if `readRecords()` is called.
- The canonical work-item pattern `^[A-Z]+-\d+$` (asserted as the behaviour, not imported as the test oracle).
- The attempts harness's store counters and byte snapshot (`readCount === 0`, `append === 0`, unchanged store bytes), so "nothing appended" is a byte comparison and not an absence of an error message.

**Steps**:

1. Run each of: `--ref 241`, `--ref gh-241`, `--ref GH-`, `--ref GH241`, `--ref GH-241-extra`, `--ref ""`.
2. Run `dispatch attempts --ref GH-241 --unknown-flag`.
3. Run `dispatch attempts --ref GH-241 EXTRA`.
4. Assert exit, error, store reads, the store bytes, and the naming in the summary.
5. Scan the captured stdout, stderr, and envelope for any `attempts.*` identity.

**Expected Outcome**:

- Every cell exits `1` with `error.code === "input.value.rejected"` under `kind: "input"`; **zero store reads**; the store snapshot is byte-identical, so nothing was appended.
- The summary for a ref cell names the supplied value and the expected uppercase canonical shape; the flag cell names the unknown flag; the positional cell names the unexpected positional.
- No cell exits `0`, `2`, or with a partially successful page.
- Step 5: zero `attempts.*` strings — the grammar refusal reuses the delivered `input.value.rejected` identity and invents no `attempts.ref-unknown`-style code (AC-F1-6, DEC-1, NFR-5).

**Notes / Clarifications**:

- **AC-F1-6 owns this behaviour** (spec v1.1). F-1, F-4, §8.1's exit table, and DM-6 all state it, and §17 now carries the criterion, so this TC is the AC's single owner rather than an AC-less addition; the previous revision's finding X-1 is closed (§8.3).
- The limit-grammar refusals are TC-ATTEMPT-003's subject, not this one: AC-F1-3 and AC-F1-6 are separate criteria, and keeping the fixtures separate means a page-bound regression cannot hide a grammar regression.
- The `attempts.*` absence scan duplicates nothing from TC-ATTEMPT-017: that test scans the registry, help, and docs, while this one scans the refusal output of the new grammar cells.

## 6. Environments and Test Data

**Runtime.** Local Linux/macOS or CI, Bun per `.bun-version`, `bun test` / `pnpm test`. No network, no provider credentials, no model process, no resident daemon. `git` is required by the two-checkout and migrated-root fixtures (real repositories) and a missing `git` fails those suites loudly rather than skipping.

**Temp layout and the `TMPDIR` trap.**

- The approved base is `tests/fixtures/projects/state-scope.ts`'s `APPROVED_BASE` (`<repo>/tmp/tmpdir`, git-ignored). Every new fixture root is created under it, so no suite can invent a different root.
- The aggregate gate runs with `TMPDIR=$PWD/tmp/tmpdir`; a fixture that calls `mkdtempSync(tmpdir())` would therefore create a directory **inside this repository's work tree**. Every new suite reaches `mkdtempSync` only through an approved helper, and the non-checkout cell uses the delivered GH-273 fallback (`nonCheckoutDirectory`), which pre-asserts `findGitRoot(...) === undefined` and throws instead of producing a false pass.
- Host root and home are always distinct directories (neither an ancestor of the other), enforced by `createHostFixture`; an override-blind store would otherwise resolve into the host root and pass vacuously.

**Fixture inventory (files to create).**

- `tests/fixtures/dispatch/attempts-harness.ts` — the in-process command harness: an isolated state root from `createDispatchState`, a store wrapper exposing read/append/fence counters, a fixed repository resolver, a ref source over a temp `.ai/local/pm-context.yaml` (with `absent` / `unparsable` / `no-active-change` / `present` variants), `invoke(argv)` returning `{exit, stdout, stderr, envelope, data, readCount}`, and `dispose()`.
- `tests/fixtures/dispatch/attempts-production.ts` — the real-production wrapper: composes `createProductionComposer` (via `tests/fixtures/projects/production.ts`'s host root, home and checkout facts) per checkout, supports a **shared** host root across two checkouts, seeds attempt and divergence records on the checkout's project store through the delivered append helpers, writes and removes `.ai/local/pm-context.yaml` in the checkout, reads the project-root attempt set, and exposes the byte/mode/mtime snapshot helper and the marker readers (`readDispatchIdentityMarkerText`, `readProjectIdentityMarker`).
- `tests/fixtures/dispatch/attempt-records.ts` — record builders the delivered `makeAttempt`/`makeDivergence` cannot express conveniently: `maximalAttempt()` (16 × 64-character evidence references, 40-character attempt id), `ledgerOf(n)` (ascending `startedAt`, shared frozen objects), `openDivergences(n, repository)` and `resolvedDivergences(n, repository)`, `withHistory(id)` (an open record after an earlier resolved record, to exercise the fold), and `longNote(400)`.
- `tests/fixtures/dispatch/golden/attempts.txt` and `attempts-empty.txt` — the canonical three-row and empty digests, regenerated only by an explicit reviewed command.
- Fixture files are never named `*.test.ts`.

**Reused fixtures.** `tests/fixtures/dispatch/harness.ts` (`createDispatchState`, `DISPATCH_NOW`, `COMPLETED_EVIDENCE`), `tests/fixtures/dispatch/ledger.ts` (`makeAttempt` accepts a full `Partial<DispatchAttemptRecord>`, so `startedAt`, `finishedAt`, `divergenceRef`, `resumeMode`, and `harness` are already overridable — no change to this file), `tests/fixtures/dispatch/admission.ts` (`createAdmissionHarness`: real production composer, counted credential/transport/spawn, project-root store, per-run record counts), `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario`), `tests/fixtures/projects/production.ts` (`createHostFixture` reuse, `snapshot`, `fileList`, `namesOf`, `modeOf`), `tests/fixtures/projects/temp-repos.ts` (`createRepository`, `seedOrigin`), `tests/fixtures/projects/state-scope.ts` (`APPROVED_BASE`, `createHostFixture`, `nonCheckoutDirectory`, `realStateFingerprint`, `guardStateFixtureRoot`, `stateOverrideVariable`), `tests/fixtures/state/harness.ts` (`makeTempRoot`, `openStore`).

**The nine scenario fixtures the criteria require.**

| Required fixture | Construction | Used by |
|---|---|---|
| Two-repository isolation (one host root, two project roots) | One `createHostFixture()` host, two real checkouts with distinct origins, each composed against the same host | TC-ATTEMPT-011, 014 |
| Migrated root holding two repositories' records in one project state root | One checkout's project store; attempt records appended with a foreign `repository` (and one foreign record for a second ref) | TC-ATTEMPT-012 |
| Torn / unreadable / permission-denied store read | A payload failing the delivered validator; the ledger file replaced by a directory; `chmod 0o200` (uid-guarded) | TC-ATTEMPT-016 |
| Unresolvable active-change context (absent / unparsable / no active change) | Three temp checkouts with the four `.ai/local/pm-context.yaml` states | TC-ATTEMPT-001, 002 |
| Non-checkout working directory | `nonCheckoutDirectory()`, pre-asserted `findGitRoot === undefined`, with a populated `<host root>/unbound` store | TC-ATTEMPT-013 |
| 5,000+ record ledger | Counting store returning 5,001 (and 5,002-with-foreign-tail) attempt ledger records in append order | TC-ATTEMPT-010, 037 |
| 100 maximal records for the 65,536-byte page bound | `maximalAttempt()` × 100 (16 × 64-character references) | TC-ATTEMPT-009 |
| 400-character note | `"x".repeat(400)` plus a 240-character boundary case | TC-ATTEMPT-021 |
| 25 folded open divergences | A migrated root: 25 open + 3 resolved for `REPOSITORY`, 5 open for `REPOSITORY_BETA`, two open ids with prior resolved history; plus an unmigrated baseline with the same 25 open + 3 resolved and no foreign records | TC-ATTEMPT-022, 038 |
| Replay resolve | The same resolve invoked twice on one open divergence, plus a third differing-note invocation | TC-ATTEMPT-020, 027 |

**State data discipline.**

- Attempt, divergence, and handover records are seeded **only** through `appendDispatchAttempt`, `appendDispatchDivergence`, and `appendDispatchHandover` on a store opened at the real project root — never by formatting ledger lines by hand, because a hand-built line could satisfy the fixture and fail the product's validator (and the reader returns `state.store.torn` for exactly that).
- The one exception is the 5,001-record ledger, which is delivered through a fake `StateStorePort` whose records are still validated by the delivered reader on the way in; the fake is the seam, not a bypass of validation.
- Divergence folds are seeded with real history (an earlier `resolved` record followed by an `open` record) wherever the fold's latest-per-identifier rule matters.
- `chmod`-based permission cells are gated on `process.getuid?.() !== 0`; a filesystem-structural provocation (a directory where the file is expected) is the primary mechanism and behaves identically as root.
- Every suite disposes its roots in a `finally`; no suite leaves a host root, checkout, or golden rewrite behind.

**Golden data.** The two digest goldens pin shape, not content: no assertion depends on a timestamp other than the fixture's fixed `DISPATCH_NOW` family, and a regeneration is a deliberate, reviewed edit.

## 7. Automation Plan and Implementation Mapping

### 7.1 Test case → file mapping

| TC ID | Test file | Implementation status | Evidence class | Execution command |
|-------|-----------|-----------------------|----------------|-------------------|
| TC-ATTEMPT-001 | `tests/behaviour/dispatch-attempts-ref.test.ts` | To Implement | Suite | `bun test tests/behaviour/dispatch-attempts-ref.test.ts` |
| TC-ATTEMPT-002 | same | To Implement | Suite | same |
| TC-ATTEMPT-003 | same | To Implement | Suite | same |
| TC-ATTEMPT-004 | same | To Implement | Suite | same |
| TC-ATTEMPT-039 | same | To Implement | Suite | same |
| TC-ATTEMPT-005 | `tests/behaviour/dispatch-attempts-contract.test.ts` | To Implement | Suite | `bun test tests/behaviour/dispatch-attempts-contract.test.ts` |
| TC-ATTEMPT-006 | same | To Implement | Suite | same |
| TC-ATTEMPT-007 | same | To Implement | Suite | same |
| TC-ATTEMPT-008 | same | To Implement | Suite | same |
| TC-ATTEMPT-028 | same | To Implement | Suite | same |
| TC-ATTEMPT-009 | `tests/behaviour/dispatch-attempts-bounds.test.ts` | To Implement | Suite | `bun test tests/behaviour/dispatch-attempts-bounds.test.ts` |
| TC-ATTEMPT-010 | same | To Implement | Suite | same |
| TC-ATTEMPT-037 | same | To Implement | Suite | same |
| TC-ATTEMPT-011 | `tests/behaviour/dispatch-attempts-scope.test.ts` | To Implement | Suite + mutation (P3) | `bun test tests/behaviour/dispatch-attempts-scope.test.ts` |
| TC-ATTEMPT-012 | same | To Implement | Suite + mutation (P3) | same |
| TC-ATTEMPT-013 | same | To Implement | Suite | same |
| TC-ATTEMPT-014 | same | To Implement | Suite + Review-verified | same |
| TC-ATTEMPT-015 | `tests/behaviour/dispatch-attempts-refusals.test.ts` | To Implement | Suite | `bun test tests/behaviour/dispatch-attempts-refusals.test.ts` |
| TC-ATTEMPT-016 | same | To Implement | Suite | same |
| TC-ATTEMPT-017 | `tests/structure/dispatch-attempts-taxonomy.test.ts` | To Implement | Suite + Review-verified | `bun test tests/structure/dispatch-attempts-taxonomy.test.ts` |
| TC-ATTEMPT-018 | `tests/behaviour/dispatch-resolve-result.test.ts` | To Implement | Suite | `bun test tests/behaviour/dispatch-resolve-result.test.ts` |
| TC-ATTEMPT-020 | same | To Implement | Suite | same |
| TC-ATTEMPT-021 | same | To Implement | Suite | same |
| TC-ATTEMPT-027 | same | To Implement | Suite | same |
| TC-ATTEMPT-019 | `tests/structure/dispatch-resolve-composition.test.ts` | Existing – Update | Suite | `bun test tests/structure/dispatch-resolve-composition.test.ts` |
| TC-ATTEMPT-022 | `tests/behaviour/dispatch-divergence-count.test.ts` | To Implement | Suite + mutation (P2) | `bun test tests/behaviour/dispatch-divergence-count.test.ts` |
| TC-ATTEMPT-023 | `tests/behaviour/dispatch-attempts-digest.test.ts` | To Implement | Suite + Golden | `bun test tests/behaviour/dispatch-attempts-digest.test.ts` |
| TC-ATTEMPT-024 | same | To Implement | Suite | same |
| TC-ATTEMPT-025 | same | To Implement | Suite | same |
| TC-ATTEMPT-026 | same | To Implement | Suite | same |
| TC-ATTEMPT-029 | `tests/structure/dispatch-attempts-composition.test.ts` | To Implement | Suite + Review-verified | `bun test tests/structure/dispatch-attempts-composition.test.ts` |
| TC-ATTEMPT-030 | `tests/behaviour/dispatch-help-version.test.ts` (extend) + `tests/structure/dispatch-help-inventory.test.ts` (extend) | Existing – Update | Suite | `bun test tests/behaviour/dispatch-help-version.test.ts tests/structure/dispatch-help-inventory.test.ts` |
| TC-ATTEMPT-031 | `tests/checks/reference-page-parity.test.ts` (extend) + `tests/fixtures/help-guide/coverage.json` (one row); `tests/checks/help-guide-coverage.test.ts` unchanged | Existing – Update | Suite | `pnpm check:help && bun test tests/checks/reference-page-parity.test.ts tests/checks/help-guide-coverage.test.ts` |
| TC-ATTEMPT-032 | none (manual) | Manual Only | Review-verified | — (review verdict + §10) |
| TC-ATTEMPT-033 | none (manual) | Manual Only | Review-verified | — (review verdict + §10) |
| TC-ATTEMPT-034 | `tests/behaviour/dispatch-additive-stability.test.ts` | To Implement | Suite (shapes, the four delivered-form refusals, and the discriminator) + mutation (P1) + Review-verified (additive-only half) | `bun test tests/behaviour/dispatch-additive-stability.test.ts` |
| TC-ATTEMPT-035 | existing scans, unchanged | Existing – No Change | Suite (scans and gates) + Review-verified (lockfile and manifest diff) | `bun test tests/checks/exit-code-literals.test.ts tests/checks/error-table-sync.test.ts tests/checks/config-default-positions.test.ts tests/checks/forbidden-literals.test.ts tests/checks/privacy-literals.test.ts tests/checks/privacy-release.test.ts tests/behaviour/dispatch-token-closure.test.ts`; then `git diff --name-only "$(git merge-base origin/main-tools HEAD)"...HEAD -- package.json pnpm-lock.yaml 'packages/*/package.json' pnpm-workspace.yaml` (expect empty) |
| TC-ATTEMPT-036 | `tests/checks/dispatch-attempts-test-isolation.test.ts` | To Implement | Suite | `bun test tests/checks/dispatch-attempts-test-isolation.test.ts` |
| TC-ATTEMPT-038 | `tests/structure/dispatch-attempts-count-rule.test.ts` | To Implement | Suite + mutation (P2) | `bun test tests/structure/dispatch-attempts-count-rule.test.ts` |

### 7.2 Supporting changes (not test cases)

- `tests/fixtures/dispatch/attempts-harness.ts`, `attempts-production.ts`, `attempt-records.ts`, `golden/attempts.txt`, `golden/attempts-empty.txt` — new fixtures (§6).
- `tests/fixtures/help-guide/coverage.json` — one `referencePages` row for the M2 attempts page; `commands` unchanged.
- `tests/checks/reference-page-parity.test.ts` — the dispatch pin moves four → five and the test title states five (DEC-14). The per-command page root is **not** changed for `dispatch`, so the M1 page remains the family page (DEC-13).
- `tests/structure/dispatch-help-inventory.test.ts` — the five-entry list and the new entry's option/example assertions.
- `tests/behaviour/dispatch-help-version.test.ts` — `dispatch attempts --help` added to the poisoned-composer set.
- `tests/structure/dispatch-resolve-composition.test.ts` — the resolve-purity cell extended with the unconditional-mode assertions.
- `tests/behaviour/dispatch-attempts-*`, `dispatch-resolve-result`, `dispatch-divergence-count`, `dispatch-additive-stability`, `tests/structure/dispatch-attempts-*`, `tests/checks/dispatch-attempts-test-isolation.test.ts` — new suites (§4, §7.1).
- **No change** to `tests/checks/error-table-sync.test.ts`, `tests/structure/dispatch-error-identity.test.ts`, `tests/conformance/dispatch/**`, and the state/ledger/audit/retro suites: they stay green unmodified (NG-1, NG-2, DM-6).

### 7.3 Phase grouping (spec §18 order)

| Phase (spec §18) | TCs | Notes |
|---|---|---|
| 1 — contracts, projection, page helper | TC-ATTEMPT-006, 007, 008, 024 (unit cells against the pure helper), 028 (key-set cell of the helper's output type) | The command-level cells of 006/007/008 complete in phase 3; only the pure cells are phase-1 obligations, and the phase boundary says which. |
| 2 — read runtime: isolation, refusals, bounds | TC-ATTEMPT-011, 012, 013, 014, 015, 016, 037 | The scope cells use the real production composition, so the runtime must be composed in `production.ts` before they pass. |
| 3 — command branch, flags, renderers | TC-ATTEMPT-001, 002, 003, 004, 005, 009, 010, 023, 025, 026, 034, 039 | The attempts payload discriminator (034 step 4) is the phase's exit condition. |
| 4 — resolve enrichment and the shared count rule | TC-ATTEMPT-018, 019, 020, 021, 022, 027, 038 | 022 and 038 must land together: the behavioural and structural halves of one ruling. |
| 5 — help, inventory, parity pin as one unit | TC-ATTEMPT-029, 030, 031 | Cannot be split: `help-guide-coverage.ts` and the parity suite both assert set equality, so a partial landing leaves a gate red. |
| 6 — specification and corpus reconciliation | TC-ATTEMPT-017 (the two `doc/spec/**` scan targets are added here), TC-ATTEMPT-032, TC-ATTEMPT-033 | The doc targets are added to TC-017's constant list in this phase so no earlier phase is red. |
| 7 — gates and release | TC-ATTEMPT-035, 036 | The aggregate `pnpm check` run and the diff review are the phase's evidence. |
| Review gate (before DoD) | Mutation/revert bundle P1–P4 (§7.4) | Recorded in §10 and in the change review. |

**Cell-level ownership follows the test cases.** TC-ATTEMPT-028 cells 1–3 and TC-ATTEMPT-034 cells 1, 4, 5, and 7 belong with the attempts branch and digest group — cell 7 is the delivered forms' unknown-flag suite cell, the cell spec §5.1 F-9 and AC-F9-1 cite; TC-ATTEMPT-028 cell 4 (the summary's block key order including `idsTruncated`, its narrowed `unresolvedIds`, and the matching human line) and TC-ATTEMPT-034 cells 2–3 (the resolve payload's added keys and both blocks' `idsTruncated`) belong with the resolve and shared-count group, because they cannot be green before the count rule exists; and TC-ATTEMPT-034 cell 6 is the additive-only diff review, which is review-verified at the review gate rather than a boundary-green cell. The delivery plan states the same split in its own five-phase numbering.

### 7.4 Revert and mutation bundle

| Id | Procedure | Expected red | Proves |
|---|---|---|---|
| P1 | Rename a delivered resolve key (`principal` → `actor`) in the resolve payload; run the stability suite; restore. | TC-ATTEMPT-034 | The shape assertion guards delivered behaviour that predates this change. |
| P2 | Reintroduce a list-length derivation (`unresolved: unresolvedIds.length`, `resolved: folded.length - unresolvedIds.length`) in the shared divergence block; run the count suites; restore. | TC-ATTEMPT-022, TC-ATTEMPT-038 | The exact-count rule and its single implementation: the mutation under-reports the 25-open case as `20` and reds the behavioural cell, while the structural scan names the offending expression. |
| P3 | Drop the logical `repository` filter in the attempts read (return every matching record from the store); run the scope suite; restore. | TC-ATTEMPT-011, TC-ATTEMPT-012 | The twice-enforced scope: the physical root alone is not enough. |
| P4 | Clamp a `--limit` above the maximum to 100 instead of refusing, **and** accept `07`/`001`/`+7` as the same integer; run the ref suite; restore. | TC-ATTEMPT-003 | The "nothing is clamped or normalised" clause (DEC-10, AC-F1-3) and `hasMore`'s honesty. |

Each procedure is a temporary local edit, run, reverted, and re-run green; the outcome is recorded in §10. No procedure is committed.

### 7.5 Gates and commands

The quality bar is `TMPDIR=$PWD/tmp/tmpdir pnpm check` (the delivered convention; `tmp/` is git-ignored).

| Gate | Command | Owning TCs | Notes |
|---|---|---|---|
| Build (prerequisite) | `pnpm build` | every subprocess cell | `pnpm test`/`pnpm check` run it via `pretest`/`pretypecheck`; a direct `bun test` does not. |
| Aggregate | `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check` | all | lint → format:check → typecheck → test → check:boundaries → prompt-conformance → help-coverage → exports-parity. |
| Package typecheck | `pnpm --filter @delivery-os/core typecheck && pnpm --filter @delivery-os/cli typecheck` | 006, 007, 008, 018, 022, 034, 038 | The two packages whose sources change; run before the aggregate while iterating. |
| Core suites | `bun test tests/behaviour/dispatch-attempts-contract.test.ts tests/behaviour/dispatch-divergence-count.test.ts tests/behaviour/dispatch-attempts-bounds.test.ts tests/structure/dispatch-attempts-count-rule.test.ts` | 005–010, 022, 038 | The projection, count rule, and bounds. |
| CLI / composition suites | `bun test tests/behaviour/dispatch-attempts-ref.test.ts tests/behaviour/dispatch-attempts-scope.test.ts tests/behaviour/dispatch-attempts-refusals.test.ts tests/behaviour/dispatch-attempts-digest.test.ts tests/behaviour/dispatch-resolve-result.test.ts tests/behaviour/dispatch-additive-stability.test.ts` | 001–004, 011–016, 018, 020, 021, 023–028, 034, 039 | Grammar, isolation, digest, resolve. |
| Help coverage | `pnpm check:help` | 030, 031 | Bidirectional set equality with `PROMPT_REQUIRED_COMMANDS`. |
| Reference-page parity | `bun test tests/checks/reference-page-parity.test.ts` | 031 | The dispatch pin at five; the M2 page registered; every see-also target exists. |
| Error-table sync | `bun test tests/checks/error-table-sync.test.ts` | 017, 035 | Bidirectional 124/124 with the documented table. |
| Taxonomy closure | `bun test tests/structure/dispatch-attempts-taxonomy.test.ts tests/structure/dispatch-error-identity.test.ts` | 017 | 124 identities, four `dispatch` rows, zero `attempts.*`. |
| Literal and exit scans | `bun run scripts/checks/forbidden-literals.ts && bun run scripts/checks/privacy-literals.ts && bun test tests/checks/exit-code-literals.test.ts tests/checks/forbidden-literals.test.ts tests/checks/privacy-literals.test.ts` | 035 | No new product/binary literal and no new exit form. |
| Release shape | `bun test tests/checks/privacy-release.test.ts`; branch-diff review | 035 | One changeset, fixed-group packages at `minor`; lockfile half review-verified. |
| Boundaries | `pnpm check:boundaries` | 038 | The shared count helper must not introduce a forbidden tier edge; no new subpath. |
| Test isolation | `bun test tests/checks/dispatch-attempts-test-isolation.test.ts` | 036 | Guard, fingerprint, and source scan. |
| Regression surface | `bun test tests/conformance/dispatch tests/behaviour/dispatch-truth-derivation.test.ts tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-gate-evidence.test.ts tests/behaviour/dispatch-gate-window.test.ts tests/behaviour/dispatch-handover.test.ts tests/behaviour/dispatch-resume.test.ts tests/behaviour/dispatch-identity.test.ts tests/behaviour/dispatch-delivered-evidence-divergence.test.ts tests/behaviour/dispatch-resolve-diagnostics.test.ts tests/behaviour/dispatch-envelope.test.ts tests/behaviour/dispatch-error-envelope.test.ts tests/behaviour/dispatch-exit-projection.test.ts tests/behaviour/dispatch-determinism.test.ts tests/behaviour/dispatch-token-closure.test.ts tests/behaviour/dispatch-privacy.test.ts tests/structure/dispatch-composition.test.ts tests/structure/dispatch-imports.test.ts tests/structure/dispatch-envelope-detail.test.ts` | 014, 016, 019, 022, 028, 034, 035 | The delivered surfaces the change must not disturb; the only permitted adjustments are `dispatch-bounds.test.ts`'s count expectations if they encode the retired derivation (see below). |
| Whitespace | `git diff --check` | all | |

**The single permitted existing-test adjustment.** `tests/behaviour/dispatch-bounds.test.ts` asserts the summary's machine and human bounds and must keep passing; if it encodes the delivered `unresolved`-from-list derivation, its expectation moves to the exact count in the same phase as TC-ATTEMPT-022. No other existing dispatch assertion may need to change, and any that does is a review finding rather than a routine edit.

**Focused verification while iterating** (after one `pnpm build`):

```
bun test tests/behaviour/dispatch-attempts-ref.test.ts tests/behaviour/dispatch-attempts-contract.test.ts
bun test tests/behaviour/dispatch-attempts-bounds.test.ts
bun test tests/behaviour/dispatch-attempts-scope.test.ts tests/behaviour/dispatch-attempts-refusals.test.ts
bun test tests/behaviour/dispatch-attempts-digest.test.ts tests/behaviour/dispatch-resolve-result.test.ts
bun test tests/behaviour/dispatch-divergence-count.test.ts tests/structure/dispatch-attempts-count-rule.test.ts
bun test tests/structure/dispatch-attempts-taxonomy.test.ts tests/structure/dispatch-attempts-composition.test.ts
bun test tests/behaviour/dispatch-help-version.test.ts tests/structure/dispatch-help-inventory.test.ts
bun test tests/checks/reference-page-parity.test.ts tests/checks/dispatch-attempts-test-isolation.test.ts
bun test tests/behaviour/dispatch-additive-stability.test.ts
pnpm check:help
```

**Mocking requirements.** Only declared seams are injected: the state store (as the composition's store port), the state root, the repository resolver (persistence disabled in production), the ref source over `.ai/local/pm-context.yaml`, the home directory, the environment record, `cwd`, the origin remote, the harness spawn runner/starter, the GitHub transport, the git child runner, the credential port, and the clock. No `bun:test` `mock.module`, no monkey-patching of adapters, no module-load-time stubbing. The counting wrappers wrap the **declared** port objects and accept no root, key, or path — so a counter cannot become a second way to supply state.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| TR-1 | False green: a suite injects a repository identity or a state root and never exercises the real derivation. | The production fixture exposes no way to inject either; the attempts harness's injected resolver is used only for cells that do not claim isolation. TC-ATTEMPT-011/012/013 go through `createProductionComposer`; §7's mocking list is the allowlist. |
| TR-2 | mtime comparison is flaky or vacuous (coarse granularity, or the same mtime after a same-size rewrite). | sha256 per file is the primary evidence; mode is compared per file; mtime is corroborating only. The append/fence counters are the direct observable of "no write". |
| TR-3 | Permission-based "unreadable" cells pass as uid 0. | The structural provocation (a directory where the ledger file is expected) is primary and user-independent; the `chmod` variant is guarded by `process.getuid?.() !== 0` and reported as skipped, not passed. |
| TR-4 | `TMPDIR` inside the repository makes `tmpdir()` a git work tree, so the non-checkout cell silently resolves a checkout. | `nonCheckoutDirectory()` pre-asserts `findGitRoot === undefined` and throws with an explanation; TC-ATTEMPT-036 scans the new suites for direct `tmpdir()` use. |
| TR-5 | The 65,536-byte cell is vacuous because 100 realistic rows fit comfortably. | `maximalAttempt()` uses 16 × 64-character references (~1.1–1.2 KB/row), so 100 rows exceed the bound with margin; the test asserts `attempts.length < 100` in that cell, making the shortening path mandatory. |
| TR-6 | Golden rot: a regenerated `attempts.txt` silently blesses a wrong cell. | The same test asserts each cell and the line grammar independently of the golden; regeneration is an explicit reviewed command. |
| TR-7 | A review-verified criterion is quietly counted as suite-covered. | §3.1 labels each class; §10 records each review item with its quoted evidence; the DoD gate reads §3.1, not the prose. |
| TR-8 | The 5,000-record measurement measures the fixture rather than the product. | Records are shared frozen objects built once outside the timed loop; the counting wrapper asserts exactly one `readRecords` per invocation; the measured p95 is recorded. |
| TR-9 | The count-agreement test passes because both surfaces call the same wrong helper. | TC-ATTEMPT-022 asserts the exact repository-scoped numbers (unchanged on an unmigrated root, lower on a migrated one), the 20-identifier narrowing, and the resolve-side block; TC-ATTEMPT-038 asserts the single derivation structurally and that the uncalled capped-list helper is retired; P2 is the negative control. |
| TR-10 | `hasMore` implemented as `attempts.length === limit` passes the simple cells. | TC-ATTEMPT-005 recomputes the predicate and includes the `3 of 3` and `0 matches` cells; TC-ATTEMPT-009/010 add the byte-shortened and ledger-truncated cells. |
| TR-11 | The foreign-exclusion count is asserted only with same-ref foreign records. | TC-ATTEMPT-012 adds a foreign record for `GH-999` and asserts the count is unchanged when `--ref` narrows; TC-ATTEMPT-010 adds a foreign record in the omitted ledger tail. |
| TR-12 | An existing text selector mistakes the attempts payload for another form. | TC-ATTEMPT-034 calls each selector with each of the four payload shapes, including a handover payload that also carries no `result` key. |
| TR-13 | The doc string-absence scan reds mid-delivery because the M2 page is reconciled in a later phase. | TC-ATTEMPT-017's target list grows with the reconciliation phase; the M2 page and corpus are review-verified, never scanned. |
| TR-14 | A concurrency or ordering regression hides behind one append order. | TC-ATTEMPT-004/026 seed two stores in opposite insertion orders and compare. |
| TR-15 | The active-context cell passes with a context that is syntactically valid but semantically different (for example `active_change: { work_item_ref: ... }`). | TC-ATTEMPT-001 writes the delivered member name (`workItemRef`) through the delivered parser; TC-ATTEMPT-002's "no active change" cell uses a parsable file with no `active_change` member, so a wrong member name would fall into that refusal and be visible. |

### 8.2 Assumptions

- `readDispatchAttempts` returns `{ ok, records, truncation? }` with retention by append order (newest 5,000) and validates each payload, returning `state.store.torn` for an invalid one (verified in `packages/core/src/app/dispatch-ledger.ts`, read 2026-11-11).
- `makeAttempt` accepts a full `Partial<DispatchAttemptRecord>`, so the fixture needs no signature change for `startedAt`, `finishedAt`, `divergenceRef`, `resumeMode`, or `harness`.
- The delivered resolve composition carries no credential port, no transport, and no truth read, so `mode: "local-evidence"` is a statement of composition fact (TDR-0023 C-4); the purity test asserts non-invocation rather than a policy.
- `createProductionComposer` derives the project state root from `resolveProjectScope` at compose time and exposes `resolveProductionRepository(..., { persist: false })` for the gate surfaces; the attempts read composes on the same two facts.
- The local PM context is `${cwd}/.ai/local/pm-context.yaml`, parsed by `readLocalPmContext` into `context.activeChange?.workItemRef`; the delivered spend command's refusal pattern is reusable, with the file name added.
- `ERROR_TABLE` holds 124 identities with four `dispatch` rows, documented 124/124 by `tests/checks/error-table-sync.test.ts`.
- `foldEvidenceWindow`'s divergence block is the delivered store-wide, uncapped fold: `unresolved` and `resolved` are already exact counts over the whole store, and `unresolvedIds` returns every open identifier. The capped-list derivation exists only in `summarizeDispatchDivergences`, which caps identifiers at 20 and derives its counts from the capped list and has **no caller** on any delivered surface (grep over `packages/**` and `tests/**` finds only its two barrel re-exports and one allowance row). This change makes the shared computation repository-scoped, narrows `unresolvedIds` — and the human `unresolved_divergences=` line — to the documented 20 with `idsTruncated`, adds the block to the resolve result, and retires the uncalled helper.
- The attempts and resolve surfaces share the envelope's `command: "dispatch"` value (DEC-7), so no new envelope token is introduced.
- Tests may create real temporary repositories and spawn `git`; `git` is already required by `tests/fixtures/watchdog` and `tests/fixtures/pilot`.
- The M2 `attempts(1)` page is edited at story delivery under the pack's own "refined at story delivery" rule, so its pre-delivery text is not a test oracle.

### 8.3 Findings: spec/plan inconsistencies and their resolution

The previous revision of this plan recorded nine findings (X-1…X-9). **All nine are closed at spec v1.1**: six by explicit ruling (X-1, X-3, X-4, X-5, X-6, X-9) and three by plan-side resolutions that v1.1 leaves intact — X-2's reading is now supported by §8.5/NFR-3, and X-7 and X-8 are ownership choices the spec does not need to arbitrate. The finding text below is preserved as recorded at v1.0 — it is the history of what was found — and each row carries the ruling that closed it. No finding is open, and nothing in this change is tested under a declared assumption that the spec contradicts.

| ID | Finding (as recorded at spec v1.0) | Evidence at v1.0 | Resolution | Status |
|----|-----------------------------------|------------------|------------|--------|
| X-1 | **A requirement has no acceptance criterion.** F-1 and F-4 require a non-canonical `--ref`, an unknown flag, and an unexpected positional to refuse with `input.value.rejected` at exit `1` and no state read; §8.1's exit table repeats it. No AC in §17 asserts any of the three. | Spec §5.1 F-1, §5.1 F-4, §8.1 row 1 vs §17 (no criterion mentions ref shape, unknown flags, or positionals). | **Closed by spec v1.1.** §17 adds `AC-F1-6`: the three invocations each exit `1` with `input.value.rejected` under `kind: "input"`, perform no store read (proven by a store seam that fails if read), append nothing, and emit no `attempts.*` identity. **TC-ATTEMPT-039** now owns `AC-F1-6`; the "no owning AC" label is gone from §3.1, §5.1, and §7. The request-grammar family therefore has one criterion and one owner, and the limit grammar stays with `AC-F1-3`/TC-ATTEMPT-003. | Closed — spec v1.1 (`AC-F1-6`) |
| X-2 | **"Opens no store" collides with the inherited store-opening effects.** AC-F1-2 requires that an unresolvable context "opens no store", while NFR-3 and §8.5 permit the host-index maintenance write and the create-once identity marker for every store-opening invocation. | Spec AC-F1-2 vs §9 NFR-3, §8.5 "Read-only posture". | **Closed by reading, now supported by spec v1.1.** §8.5 states that a read "does open a store" and inherits host-index maintenance plus the create-once **project checkout identity marker**, and names the **dispatch repository binding marker** as separately forbidden; NFR-3 enumerates the same pair. TC-ATTEMPT-002 continues to assert **no store read** (a failing/counting store seam) and **no append**, and explicitly does not assert zero filesystem effects; "opens no store" in AC-F1-2 is read as "performs no store read", and the inherited-effects enumeration remains AC-F4-1/TC-ATTEMPT-014's subject. | Closed — spec v1.1 §8.5/NFR-3 wording, plan reading retained |
| X-3 | **`excluded.foreignRepository`'s population is qualified but AC-F3-2 states it unqualified.** DM-1 and F-3 say the count is of records "in the ledger read"; AC-F3-2 says it "equals the number excluded", which a reader may take as every foreign record in the file. | Spec DM-1, F-3 vs AC-F3-2. | **Closed by spec v1.1.** F-3, DM-1, and AC-F3-2 now say the count is of foreign-repository records **within the retained ledger read window** (the newest 5,000) and is **independent of `--ref`**, and AC-F3-2 adds the second branch: a foreign record only in the omitted tail yields `0` for that window. Both branches are owned: TC-ATTEMPT-012 asserts the retained-window count (3 of 6, unchanged under a second `--ref`), and TC-ATTEMPT-010 step 4 asserts the omitted-tail `0` on the 5,001-record store. | Closed — spec v1.1 (F-3, DM-1, AC-F3-2) |
| X-4 | **`idsTruncated` is a shape addition on the summary block while §8.5 says the summary's shape is unchanged.** AC-F5-5 requires both surfaces to carry `idsTruncated`; DM-3 names it on the resolve block; §8.5 says the summary's "shape is unchanged". | Spec AC-F5-5, DM-3 vs §8.5 "Backward Compatibility". | **Closed by spec v1.1.** §8.5 now says both divergence blocks — the summary's and the resolve result's — gain the one declared additive key `idsTruncated`, and that the four delivered block fields keep their names, types, and order; spec v1.4 states the declared split explicitly, so `reported`, `resolved`, and `unresolved` keep exact-count meanings and `unresolvedIds` keeps its name, type, and order while narrowing to at most 20. TC-ATTEMPT-022 step 9 asserts the exact five-key list and order on both surfaces; TC-ATTEMPT-028 asserts the summary keeps its delivered gate fields; TC-ATTEMPT-034 asserts the addition is declared and nothing delivered is renamed, retyped, or reordered. | Closed — spec v1.1/v1.4 (§8.5, AC-F5-5) |
| X-5 | **Two different markers are both called "the identity marker".** AC-F4-1 permits "the create-once identity marker"; F-3 forbids the read to "create or repair the first-use identity marker". These are different artefacts: GH-288's project identity marker (scope) and the dispatch repository binding marker. | Spec AC-F4-1, F-3, §8.5 vs GH-288 DM-1 and `packages/adapters/src/file/dispatch-identity.ts`. | **Closed by spec v1.1.** The two artefacts are named distinctly across F-3, AC-F4-1, §2.1, §4.1, §8.4, §8.5, NFR-3, §21, and the §23 glossary: the **project checkout identity marker** (GH-288; minted once by any store-opening invocation; permitted) and the **dispatch repository binding marker** (`<git-common-dir>/dispatch-identity.json`; never created, repaired, or re-persisted by a read; forbidden). TC-ATTEMPT-014 steps 5–7 assert each through its own delivered helper; TC-ATTEMPT-013 step 3 asserts the binding marker is absent after an outside-checkout refusal. | Closed — spec v1.1 (F-3, AC-F4-1, §8.5, NFR-3, §23) |
| X-6 | **`AC-F1-3` does not pin leading-zero or whitespace limit forms.** F-1 says "a positive integer"; `001` and ` 1` are arguable. | Spec F-1, AC-F1-3. | **Closed by spec v1.1.** F-1, AC-F1-3, and DEC-10 pin `--limit` to canonical decimal `[1-9][0-9]*` — no sign, no leading zero, no surrounding whitespace — and AC-F1-3 enumerates `07`, `+7`, and ` 7` among the refusals, each exiting `1` with `input.value.rejected` and nothing clamped or normalised. TC-ATTEMPT-003 asserts those three plus `001`, alongside the delivered `0`, `101`, `-1`, `abc`, and missing-value cells. | Closed — spec v1.1 (F-1, AC-F1-3, DEC-10) |
| X-7 | **`AC-F4-4`'s evidence split leaves a suite-assertable half unasserted.** §17 assigns "Suite for the counts, review-verified for the absence of the strings"; the absence in code, help, and the feature spec is a tree invariant a suite can assert. | Spec AC-F4-4. | **Closed — plan-side strengthening, no spec change needed.** Spec v1.1 keeps the same evidence sentence, so this remains a deliberate over-assertion: TC-ATTEMPT-017 asserts the code/help/spec/rendered-output half in a suite and keeps only the M2 page and corpus review-verified. The split is recorded here so a reviewer sees it is a choice, not an omission. | Closed — plan resolution retained |
| X-8 | **No requirement names the module that owns the shared count computation.** TDR-0023 D-5 requires one computation; neither the spec's component table nor the contract names where it lives. | Spec §16, TDR-0023 D-5. | **Closed — ownership assigned, deliberately not pinned to a filename here.** The module is the delivery plan's decision; TC-ATTEMPT-038 asserts the **export surface and the two consumers** (summary composition and resolve enrichment), not a path. If the delivery plan names a module, the structural test's target list narrows to it without changing the assertion. | Closed — plan resolution; filename owned by the delivery plan |
| X-9 | **`truncation.bound` for `scope: "page"` is undefined.** DM-5 declares `bound` but does not say whether a page-scope bound reports the requested row bound (`limit`) or the byte budget (65,536). AC-F2-4 asserts the scope, the omission, and `hasMore`, not the value. | Spec DM-5 vs AC-F2-4, F-2. | **Closed by spec v1.1.** DM-5 defines `bound` per scope — `5000` for `"ledger"` (the retained-record bound) and `65536` for `"page"` (the serialized `data` byte budget) — and `omittedRecords` as what that bound left out. AC-F2-4 pins `bound: 65536` for the page scope. TC-ATTEMPT-009 asserts the literal `65_536` and the dropped-row count; TC-ATTEMPT-010 asserts `5000` and the ledger precedence. | Closed — spec v1.1 (F-2, DM-5, AC-F2-4) |

**Reopening condition.** A finding reopens if a later spec revision removes `AC-F1-6`, re-qualifies `excluded.foreignRepository` away from the retained window, drops `idsTruncated` from one of the two divergence blocks, collapses the two marker names, widens the `--limit` grammar, or leaves `truncation.bound` undefined per scope. Each would red the owning TC listed above, which is the point of pinning them here.

### 8.4 Test-maintenance notes

- The projection's exact sixteen-field assertion will red the moment the attempt record gains a field. That is intended friction: a new record field is a projection decision (TDR-0023 C-3), and the failing test names the field so the decision is explicit.
- The single-computation scan (TC-ATTEMPT-038) will red when a future surface folds divergences again — that is the ruling working, and the fix is to consume the computation, not to extend an allowlist.
- The digest goldens pin shape, so a new row cell or a changed pointer wording is a deliberate two-file edit (renderer + golden) with a review.
- The 5,001-record and maximal-record builders are reusable by any future read-side bound test; they are built to be shared frozen data, so adding a cell costs an assertion, not a fixture.
- The scope suite's second checkout is the expensive fixture (~2 `git init` spawns). New isolation cells should extend it rather than create a third checkout.
- Anything that adds a key to the attempts envelope reds TC-ATTEMPT-028 and TC-ATTEMPT-034, which is deliberate: the envelope is a closed set declared once (DM-1, Appendix D).

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-11 | @test-plan-writer | Initial test plan for GH-289 from spec v1.0 and TDR-0023 (Proposed): **39 test cases** covering all **35** acceptance criteria (`AC-F1-1`…`AC-F9-2`), the eleven NFRs with thresholds, and the delivered gate battery. New fixtures under `tests/fixtures/dispatch/**` (in-process attempts harness, real-production attempts wrapper, record builders, two digest goldens); four revert/mutation procedures (P1–P4) including the two halves of the TDR-0023 count risk; and four declared findings (X-1 an AC-less requirement for malformed-request grammar, X-2 "opens no store" vs inherited effects, X-4 the `idsTruncated` shape addition on the summary, X-5 the two-marker collision), plus five precision findings (X-3, X-6, X-7, X-8, X-9). |
| 1.1 | 2026-11-11 | @test-plan-writer | Aligned to **spec v1.1** (revision driven by the `dor_check` findings). Acceptance coverage **35 → 36**: `AC-F1-6` (request-grammar refusals) added to §3.1 and owned by **TC-ATTEMPT-039**, whose AC-less label is removed; the TC count stays **39** and every `TC-ATTEMPT-001…039` identifier is unchanged. Aligned the five closed imprecisions: `excluded.foreignRepository` now asserted within the retained ledger window with both AC-F3-2 branches split between TC-012 (window, `--ref`-independent) and TC-010 (omitted tail → 0); `idsTruncated` asserted as the one declared additive key on **both** divergence blocks with the four delivered fields' order preserved (TC-022 step 8, TC-028, TC-034); the two identity markers named and asserted separately (TC-013, TC-014); `truncation.bound` pinned to `5000`/`65536` per scope (TC-009, TC-010); `--limit` canonical-decimal refusals `07`, `+7`, ` 7`, `001` added (TC-003, mutation P4 extended). §8.3 now records each finding with its v1.1 ruling and marks X-1…X-9 closed without deleting the v1.0 finding text. Every fixture, negative assertion, gate command, and review-verified gap is preserved. |
| 1.2 | 2026-11-11 | @test-plan-writer | Aligned to **spec v1.3** and readiness iteration 1. Acceptance coverage stays **36/36** and the TC count stays **39**; every `TC-ATTEMPT-001…039` identifier, fixture, negative assertion, and gate command is unchanged. **B2:** TC-ATTEMPT-028 and TC-ATTEMPT-034 now declare their cell ownership — TC-028 cells 1–3 and TC-034 cells 1, 4, 5, 6 are green at the command phase (delivery plan phase 2); TC-028 cell 4 (the summary block's key order including `idsTruncated`, its narrowed `unresolvedIds`, and the matching human line) and TC-034 cells 2–3 (the resolve payload's added keys and both blocks' `idsTruncated`) complete with the count rule (phase 3). **A2:** TC-ATTEMPT-003's missing-value note now states that `--limit` is deliberately not a `requiresValue` flag and that the command module's `attempts` grammar refuses the cell before any runtime call, because the shared parser would answer `fallback.invocation`. **B3:** corrected every statement that described the delivered summary's count as a bounded-list artefact — §1's premise, §1.1, §3.1/§3.2/§3.3, TC-ATTEMPT-022 (restated as: unchanged on an unmigrated root, lower on a migrated root, a new block on the resolve result, and an `unresolvedIds` narrowing to 20 with `idsTruncated` while `unresolved` stays exact), TC-ATTEMPT-028 step 4, TC-ATTEMPT-034 step 3 and its review step, TC-ATTEMPT-038 (the retired `summarizeDispatchDivergences` has no surviving caller and no second derivation remains; P2 is now a list-length mutation that reports 20 instead of 25), §7.4 P2, §8.1 TR-9, and §8.2. `AC-F9-2`'s evidence class reads "Suite (scans and gates), review-verified (lockfile and manifest diff)" in §3.1, §5.1, §7.1, and TC-ATTEMPT-035; §10 gains the B2/B3 reconciliation notes. |
| 1.3 | 2026-11-11 | @test-plan-writer | Aligned to **spec v1.4** and readiness iteration 2. Acceptance coverage stays **36/36** (every `AC-F1-1…AC-F9-2` still owned) and the TC count stays **39**; every `TC-ATTEMPT-001…039` identifier is unchanged. **W1:** TC-ATTEMPT-034 gains **cell 7**, the unknown-flag suite cell of the delivered-form stability case, in `tests/behaviour/dispatch-additive-stability.test.ts` (the suite §7.1 assigns to this case) — this supersedes the 1.2 row's cell map: cell 6 stays the review-verified additive-only diff inspection and the command-phase suite cells are 1, 4, 5, and 7. With `acceptsAnyFlag: true` in force on the definition, `dispatch <ref>`, `dispatch dual-run summary --repo <repo>`, `dispatch dual-run resolve <id> --note <text>`, and `dispatch handover <repo> [--revert]` each exit `1` with `fallback.invocation` under `kind: "fallback"` and perform no store read, proven by a store seam whose `read`/`readRecords` throw. Cell 7 is green at the command phase; the additive-only diff review stays **cell 6** and review-verified, and no statement claims the refusal is pinned by a review cell or by cell 6. `AC-F9-1`'s §3.1 row, §3.2's `DM-3` and summary rows, §3.3's NFR-9 row, §5.1's evidence class, §7.1, §7.3's cell split, §1.2's evidence split, and §10's W1 note now state the refusal half as suite evidence. **W2:** rewrote the two fixture-inventory phrases (§2's listing and §6's `attempts-production.ts` entry) that had joined host, home and checkout with slashes, so this file carries no literal home-directory path and `bun run scripts/checks/privacy-literals.ts` no longer reports it. **N1:** TC-ATTEMPT-022 step 9, TC-ATTEMPT-028 step 4, TC-ATTEMPT-034, and the §3.1/§3.2/§3.3 rows now say `reported`, `resolved`, and `unresolved` keep names, types, order, and exact-count meanings, while `unresolvedIds` keeps its name, type, and order and narrows to at most 20 with `idsTruncated`; §8.3's X-4 row is amended to the v1.4 split. |

## 10. Test Execution Log

Not yet executed: this plan is the phase-3 artefact and no test in it has run. Rows are appended at each phase boundary during delivery; the gate rows below are the record, and a `Pending` row is not evidence.

**Gate rows**

| Gate | Command | Date | Result | Notes |
|------|---------|------|--------|-------|
| Build | `pnpm build` | — | Pending | Prerequisite for the subprocess help and composition cells. |
| Package typecheck | `pnpm --filter @delivery-os/core typecheck && pnpm --filter @delivery-os/cli typecheck` | — | Pending | |
| Aggregate | `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check` | — | Pending | lint → format:check → typecheck → test → check:boundaries → prompt-conformance → help-coverage → exports-parity. |
| Help coverage | `pnpm check:help` | — | Pending | |
| Reference-page parity | `bun test tests/checks/reference-page-parity.test.ts` | — | Pending | Dispatch pin at five. |
| Error-table sync | `bun test tests/checks/error-table-sync.test.ts` | — | Pending | 124 entries, 124 documented rows. |
| Taxonomy closure | `bun test tests/structure/dispatch-attempts-taxonomy.test.ts` | — | Pending | |
| Test isolation | `bun test tests/checks/dispatch-attempts-test-isolation.test.ts` | — | Pending | |
| Whitespace | `git diff --check` | — | Pending | |

**Revert / mutation rows**

| Id | Date | Result | Notes |
|----|------|--------|-------|
| P1 | — | Pending | |
| P2 | — | Pending | |
| P3 | — | Pending | |
| P4 | — | Pending | |

**Review rows (review-verified criteria)**

| TC | Criterion | Date | Result | Evidence quoted |
|----|-----------|------|--------|-----------------|
| TC-ATTEMPT-014 | AC-F4-1 side-effect enumeration | — | Pending | |
| TC-ATTEMPT-017 | AC-F4-4 M2 page and corpus string absence | — | Pending | |
| TC-ATTEMPT-029 | AC-F7-2 reference-page half | — | Pending | |
| TC-ATTEMPT-032 | AC-F8-3 | — | Pending | |
| TC-ATTEMPT-033 | AC-F8-4 | — | Pending | |
| TC-ATTEMPT-034 | AC-F9-1 additive-only half | — | Pending | |
| TC-ATTEMPT-035 | AC-F9-2 lockfile and manifest diff half | — | Pending | |

**Reconciliation notes to `@doc-syncer`**

- X-1, X-3, X-4, X-9: **satisfied by spec v1.1** (`AC-F1-6` added; the foreign count qualified to the retained window in F-3/DM-1/AC-F3-2; `idsTruncated` declared on both divergence blocks in §8.5; `truncation.bound` defined per scope in DM-5). No further spec change is owed; the reconciliation pass should carry the same wording into `feature-dispatch-engine.md` and `contracts.md`.
- X-2: AC-F1-2 still says "opens no store". Spec v1.1 §8.5/NFR-3 enumerate the inherited store-opening effects, and this plan reads the phrase as "performs no store read"; the reconciliation pass should either adopt that wording in AC-F1-2's mirror in the feature spec or leave it, but should not describe the refusal as effect-free.
- X-8: the shared count computation's module name is the delivery plan's decision; if the plan names one, this plan's structural target list narrows to it (TC-ATTEMPT-038), and the doc reconciliation should name the same module.
- B3 (spec v1.3): the delivered summary's `unresolved` and `resolved` were already exact and store-wide, and the capped-list derivation lived only in the uncalled `summarizeDispatchDivergences`. The reconciliation pass must describe this change as repository-scoping the shared computation, adding the block to the resolve result, and narrowing `unresolvedIds` (and the human `unresolved_divergences=` line) to the documented 20 with `idsTruncated`; it must not describe the delivered number as a bounded-list artefact or claim the count moves up past 20 open divergences.
- B2 (ownership): TC-ATTEMPT-028 cell 4 and TC-ATTEMPT-034 cells 2–3 land with the count rule in delivery plan phase 3, not with the command phase; the §10 rows for those cells are appended at the phase-3 boundary.
- W1 (spec v1.4): the delivered forms' unknown-flag refusal under `acceptsAnyFlag: true` is TC-ATTEMPT-034 **cell 7**, a suite cell in `tests/behaviour/dispatch-additive-stability.test.ts` that is green at the command phase and recorded with the command-phase TC rows; the additive-only diff review is **cell 6**, stays review-verified, and keeps its row in the review table above at the review gate.

**Measured values (informational only)**

| Measurement | Date | Value | Budget |
|---|---|---|---|
| `dispatch attempts` p95 at the 5,000-record bound | — | Pending | ≤ 5,000 ms |
| New suites' wall clock (informational) | — | Pending | — |
