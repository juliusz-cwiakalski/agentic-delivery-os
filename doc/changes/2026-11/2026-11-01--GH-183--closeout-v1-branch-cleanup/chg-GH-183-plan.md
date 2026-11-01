---
id: chg-GH-183-closeout-v1-branch-cleanup
status: Proposed
created: 2026-11-01T05:15:00Z
last_updated: 2026-11-01T05:15:00Z
owners: [engineering]
service: delivery-os
labels: [cli, providers, git, idempotency, state]
links:
  change_spec: ./chg-GH-183-spec.md
  test_plan: ./chg-GH-183-test-plan.md
  pm_notes: ./chg-GH-183-pm-notes.yaml
  decisions:
    - ../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md
    - ../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md
    - ../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >
  Deliver the M0-S14 closeout v1 transaction: one deterministic, dry-run-by-default
  `closeout <workItemRef>` command with seven ordered steps (ticket-to-done, lifecycle
  label sweep, unassign, owed-flip sweep, comment resolution, checkout restore, and
  squash-safe local branch cleanup); deterministic operation identities and an
  append-only `closeout.operation` ledger that make restart, crash-between-effect-and-
  record, and failed-outcome retries converge with zero duplicate effects; honest
  GitHub and Jira write capabilities with declared gaps; GitLab reads plus a merged-head
  normalization with writes as gaps; a dedicated git branch/checkout adapter subpath;
  four additive `closeout` error identities; bounded machine/human output; and the
  preserved zero-write/zero-spawn guarantees of `status`, `queue ready`, and
  `verify change`. The whole battery is offline: committed sanitized fixtures, injected
  transports, recording runtimes, and temporary local git repositories.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-183: M0-S14: closeout v1 with branch cleanup

## Context and Goals

This plan implements the completed change specification (`chg-GH-183-spec.md`, v1.1: F-1–F-15, AC-F1-1–AC-NFR10-1 (58), NFR-1–NFR-13, DM-1–DM-10, EVT-1/EVT-2, DEC-1–DEC-16, RSK-1–RSK-12, §6 flows 1–6, §8 interfaces, Appendices A–E) and the completed test plan (`chg-GH-183-test-plan.md`, v1.0: 64 TCs, TC-CLOSE-001..TC-CLOSE-064, 58/58 AC coverage, §4 binding oracles, §5.2 scenario detail, §7 automation and evidence commands). Both are committed. TDR-0008 governs the two additive adapter-contract extensions. This plan derives every task, path, command, and gate from those sources and adds no product requirement.

**What this change delivers.** One Deliver-family command, `closeout <workItemRef> [--apply] [--json]`, that computes a deterministic seven-step transaction in plan mode and applies the same transaction only with `--apply`. Every operation carries a deterministic identity and persists one terminal outcome in the existing append-only state ledger, so a re-run after a restart reuses terminal outcomes, a crash between a provider effect and the ledger append converges as `satisfied`, and a persisted `failed` outcome is re-observed and retried safely. GitHub gains issue close, label add/remove, assignee clear, merged-PR lookup plus merged head, review-thread resolution through GraphQL behind the existing injected transport, and a bounded reverse-dependent read. Jira gains a data-driven done transition, a full-array label replace that preserves unnamed labels, assignee clear, and a bounded reverse-dependent query. GitLab remains read-only, gains merged-head normalization where the provider exposes it, and declares every write (including `resolve-delivery-thread`) as a gap. A dedicated `@delivery-os/adapters/git` subpath performs checkout restore and local branch deletion behind a port, with the full squash-safety predicate. Four additive `closeout` error identities join the existing result contract and documented table. The full battery is offline and fixture-driven.

**Settled inputs — this plan does NOT re-decide them.** DEC-1 (command name and read-only guarantees), DEC-2 (seven-step order and harness telemetry out of scope), DEC-3 (GitHub/Jira writes; GitLab gaps; local-only branch cleanup), DEC-4 (dry-run default; `--apply` only), DEC-5 (owed-flip definition), DEC-6 (thread resolution via GraphQL on GitHub; gaps elsewhere), DEC-7 (deterministic identity, terminal reuse, failed retry, capability-context identity), DEC-8 (dedicated git seam; read-only reader untouched), DEC-9 (merged target ref else `main-tools`; protected refs), DEC-10 (label disposition), DEC-11 (provider-operation vocabulary), DEC-12 (`headSha` absent means unknown; refusal on unknown), DEC-13 (deterministic merged-request selection), DEC-14 (gaps/no-ops non-fatal; failure/refusal classes), DEC-15 (`closeout` kind, four rows, existing projection classes), DEC-16 (caps 200/100, convergent re-runs). TDR-0008 fixes both additive extensions, no schema-version bump, and the conformance-registry obligation. OQ-2 is PM-resolved: v1 posts no closure comment; `write-comment` remains a gap on every provider.

**Code-reality facts this plan relies on (verified 2026-11-01).**

- The contracts tier is types plus `as const` data only (`packages/core/src/contracts/**`); `DeliveryRequest` currently has `identity`, `sourceRef`, `targetRef`, `reviewState`, `threads` and no head field (`ports.ts`). `ADAPTER_OPERATIONS` is the closed seven-operation set (`adapter-capabilities.ts`).
- The three provider seeds live at `packages/adapters/src/{github,jira,gitlab}/**` with `*_ADAPTER_CONTRACT` declarations; GitHub and Jira use an injected `ProviderTransport` whose `ProviderRequest.method` is `"GET"` only and which has no body field. Each client has a native-`fetch` default transport and resolves credentials only through the injected `CredentialPort`.
- The read-only repository adapter `packages/adapters/src/repo/index.ts` reads `.git` metadata through an injected `RepositoryIo` and never spawns a process. It has no branch mutation surface.
- The state store port (`packages/core/src/contracts/state.ts`) exposes `read`, `append(handle, request)`, `acquireFence`, `releaseFence`, `replaceDocument`, `checkIntegrity`, `repairTornTail`. Record kinds are consumer strings; `delivery.state.v1` is the schema and needs no bump for an additive kind.
- The error table (`packages/core/src/contracts/error-table.ts`) declares `DOMAIN_KINDS` and `ERROR_TABLE`; the documented table lives in `doc/spec/features/feature-result-contract.md`. `tests/structure/error-table.test.ts` asserts exactly 35 entries and the declared-kind prose; a closeout addition is an additive test update (39 entries).
- The conformance flow registry (`packages/testkit/src/conformance/flows.ts`) has exactly three flows and twelve steps; `tests/structure/conformance-coverage.test.ts` asserts twelve steps and exact operation-set equality. The runner (`packages/testkit/src/conformance/runner.ts`) currently fails closed on a supported non-read step without a test-only `writeHandler`, and `runtimeCoverageViolations` requires every supported operation to execute in mock mode (`packages/testkit/src/conformance/coverage.ts`). Making GitHub/Jira writes supported therefore requires production write execution in the mock tier, not only a registry step.
- `packages/cli/src/index.ts` owns the shared parser and envelope/exit projection; `packages/cli/src/commands/index.ts` exports command definitions; `packages/cli/src/edge.ts` composes runtimes and registers commands in `createConfigProgram`. The `db` command (`packages/cli/src/commands/db.ts`) is the mutating-command precedent: dry-run by default, `--apply` for mutation, handler-owned parsing, no exit literal.
- `tests/structure/inventory.json` lists every source file; `tests/structure/content-inventory.test.ts` holds per-file executable allowances; `tests/structure/port-neutrality.test.ts` scans the contracts tier; `tests/structure/cli-edge-seam.test.ts` scans the CLI for ambient environment reads and stream writes; `tests/structure/subpaths.test.ts` pins declared subpaths; `tests/structure/provider-surface.test.ts` pins each provider subpath's exported names.
- `scripts/checks/error-table-sync.ts` synchronizes `ERROR_TABLE` with the documented table; `scripts/checks/exit-code-literals.ts` enforces exit literals only in the CLI projection; `scripts/checks/secret-read-boundary.ts` holds exactly four allowlist entries; `scripts/checks/forbidden-literals.ts` and `scripts/checks/privacy-literals.ts` gate brand/cloud leakage. `.changeset/config.json` fixes the five publishables (`core`, `adapters`, `cli`, `mcp`, `opencode`) and excludes `testkit`.
- `.dependency-cruiser.cjs` has a `runtime-apis-confinement` rule with exact, reason-bearing adapter I/O entries; `tests/boundaries/fixture-registry.json` and `tests/boundaries/fixtures/cases.ts` require a positive and a negative fixture for every rule.

**Sibling deliveries used for shape, not for requirements.** GH-180 (db command) supplies the mutating-command grammar/envelope/evidence shape; GH-188 (provider seeds) supplies the trap-catalog and credential-port discipline; GH-189 (conformance suite) supplies the flow registry, mock-tenant, runtime-coverage and artifact discipline; GH-175/GH-182 supply the read-only status/queue/verify guarantees.

### Open questions and recorded gaps

- **No blocking open question.** Test-plan OQ-T1 (delivery-bound spellings), OQ-T2 (GitLab merged head), OQ-T3 (GitHub GraphQL response shape), OQ-T4 (optional type probe) are resolved by the pins and bindings below. GAP-T1 (plan absent) is closed by this file. GAP-T2 (NFR-6 p95 is not a CI gate) remains recorded and is honoured in Phase 8/12. GAP-T3 (no-leak canary is a fixture obligation) is implemented in Phase 8. GAP-T4 (delivery-bound names) is resolved by the pinned spellings. GAP-T5 (NFR-6/NFR-12 have no dedicated AC) is mapped to the qualifying ACs in the traceability table.
- **Integration obligation discovered while reading the tree (non-blocking, no spec change):** TC-CLOSE-002 asserts the conformance registry operation-set equality and a new `resolve-delivery-thread` step, but it does not name the required production write execution. The existing `runtimeCoverageViolations` invariant makes that execution mandatory once GitHub/Jira declare `write-work-item` and `transition-work-item` as supported. This plan delivers it under TC-CLOSE-002/053/054 and the existing conformance suites (Phases 1, 4, 5, and 8): Phase 1 adds the step and keeps the new operation a gap; Phases 4/5 flip each provider's capability and add the production write execution/routes in the same commit; Phase 8 proves the integrated capability matrix. If PM wants a dedicated TC, the test plan must be reopened; otherwise no reopen is required.
- **Delivery-bound transport shape (non-blocking):** the spec says thread resolution rides the existing injected transport, while the current `ProviderRequest` is `GET`-only with no body. This plan widens the transport additively (methods and optional body) and keeps the live conformance tier read-only (non-GET is a failure there). No new transport or network location is introduced.
- **Provider reverse-dependent reads (non-blocking):** the spec's provider-coverage table says GitHub supports all seven steps, while F-7 permits a gap when a reverse/relation read is unavailable. This plan pins a bounded GitHub issue-dependencies read and a bounded Jira JQL read; if a provider cannot expose the signal, the step is a declared gap, never a false success. This is a delivery-bound resolution, not a spec change.

## Pinned Delivery Spellings (PIN-1..PIN-20)

These pins resolve the delivery-bound spellings left open by test-plan GAP-T4/OQ-T1. Every value, order, identity input, bound, exit, and AC/TC mapping comes from the spec or test plan and may not be rebound. Changing a pin later reopens this plan; route a challenge through PM/`@decision-advisor`, never apply it silently.

| PIN | Pinned spelling (binding) |
|---|---|
| PIN-1 | **Contract module**: `packages/core/src/contracts/closeout.ts`; exports `CLOSEOUT_SCHEMA_ID = "delivery.closeout.v1"`, `CLOSEOUT_OPERATION_PAYLOAD_SCHEMA = "delivery.closeout.operation.v1"`, `CLOSEOUT_OPERATION_RECORD_KIND = "closeout.operation"`, `CLOSEOUT_STEP_IDS`, `CLOSEOUT_PLAN_OUTCOMES`, `CLOSEOUT_APPLY_OUTCOMES`, `CLOSEOUT_GAP_REASONS`, `CLOSEOUT_OPERATION_NAMES`, `LIFECYCLE_LABEL_DISPOSITIONS`, `PROTECTED_REF_NAMES`, `CLOSEOUT_INTEGRATION_BASE = "main-tools"`, `OWNER_ATTENTION_LABEL = "hand-back"`, `BLOCKED_LABEL = "blocked"`, `DELIVERED_LABEL = "delivered"`, `CHANGE_LABEL = "change"`, plus the caps `CLOSEOUT_MAX_DEPENDENTS`, `CLOSEOUT_MAX_THREADS`, `CLOSEOUT_OPERATION_TIMEOUT_MS`, `CLOSEOUT_MAX_MACHINE_BYTES`, `CLOSEOUT_MAX_HUMAN_LINES`, `CLOSEOUT_MAX_HUMAN_BYTES`; types `CloseoutStepId`, `CloseoutPlan`, `CloseoutStep`, `CloseoutOperation`, `CloseoutOperationName`, `CloseoutArguments`, `CloseoutOutcome`, `CloseoutPlanOutcome`, `CloseoutApplyOutcome`, `CloseoutGapReason`, `CloseoutEvidence`, `CloseoutTruncation`, `CloseoutData`, `CloseoutSummary`, `CloseoutOperationRecord`, `CloseoutProviderRuntime`, `CloseoutGitRuntime`, `CloseoutStateRuntime`. |
| PIN-2 | **Seven step ids, in order**: `ticket-to-done`, `lifecycle-label-sweep`, `unassign`, `owed-flip-sweep`, `comment-resolution`, `checkout-restore`, `branch-cleanup`. The human label for `branch-cleanup` is "squash-safe local branch cleanup". |
| PIN-3 | **Operation names**: `transition-work-item`, `write-work-item`, `resolve-delivery-thread`, `restore-checkout`, `delete-branch`. Provider operations are the first three; git operations are the last two. `engine` is the provider `systemName` or the literal `"git"`. |
| PIN-4 | **Canonical arguments** (uppercase tokens are metavariables resolved from the observed provider/git facts): ticket `{ deliveryState: "done" }`; label remove `{ remove: [LABEL] }`; label add `{ add: ["delivered"] }`; unassign `{ assignee: "none" }`; owed-flip `{ add: ["hand-back"], remove: ["blocked"] }`; thread `{ deliveryRequest: { systemName, entityId }, threadId: THREAD_ID }`; checkout restore `{ baseRef: BASE_REF }`; branch cleanup `{ branch: LOCAL_BRANCH }`. No arguments use wall clock, randomness, or API order. |
| PIN-5 | **Outcome vocabulary**: plan `would-apply`, `satisfied`, `skipped-gap`, `skipped-noop`, `would-refuse`; apply `applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, `refused`. Terminal outcomes are `applied`, `satisfied`, `skipped-gap`, `skipped-noop`; `failed` is retained but retryable; `refused` is a safety refusal. |
| PIN-6 | **Gap reasons**: `provider-unsupported`, `adapter-not-implemented`, `plan-restriction`. A gap is data, never an error-table row and never `applied`/`satisfied`. |
| PIN-7 | **Label disposition**: keep `change`; remove `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, `blocked`; add `delivered` when absent; preserve every other label. Order is the declared disposition order above. |
| PIN-8 | **Base and protected refs**: resolved base = merged delivery request `targetRef`, else `CLOSEOUT_INTEGRATION_BASE = "main-tools"`. Protected refs = `main`, `main-tools`, the resolved base, `HEAD`, and any declared protected ref. The protected set always wins. |
| PIN-9 | **Caps**: `CLOSEOUT_MAX_DEPENDENTS = 200`, `CLOSEOUT_MAX_THREADS = 100`, `CLOSEOUT_OPERATION_TIMEOUT_MS = 30_000`, `CLOSEOUT_MAX_MACHINE_BYTES = 65_536`, `CLOSEOUT_MAX_HUMAN_LINES = 200`, `CLOSEOUT_MAX_HUMAN_BYTES = 16_384`. |
| PIN-10 | **Additive adapter extensions**: `DeliveryRequest.headSha?: string` (absent = unknown, copied verbatim); `ADAPTER_OPERATIONS` appends `"resolve-delivery-thread"` as the eighth member. No existing field or operation is removed, retyped, or renamed. |
| PIN-11 | **Error rows**: `closeout.target.unobserved` (user, false, not_landed, user-validation, 1); `closeout.target.ambiguous` (user, false, not_landed, user-validation, 1); `closeout.write.failed` (transient, true, unknown, platform-provider, 2); `closeout.branch.unsafe` (user, false, not_landed, user-validation, 1). `closeout` joins `DOMAIN_KINDS` after `db`. |
| PIN-12 | **Domain module**: `packages/core/src/domain/closeout.ts`; exports `buildCloseoutPlan`, `canonicalCloseoutJson`, `deriveCloseoutOperationId`, `foldCloseoutOutcomes`, `summarizeCloseout`, `boundCloseoutData`, `renderCloseoutHuman`, `resolveCloseoutBaseRef`, `isProtectedRef`, `selectMatchingBranch`, `evaluateBranchSafety`, `closeoutStepDefinitions`. Pure: no I/O, clock, randomness, or environment. |
| PIN-13 | **State module**: `packages/core/src/state/closeout.ts`; exports `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX = "closeout.operations:"`, `closeoutOperationRecordKey`, `appendCloseoutOutcome`, `readCloseoutHistory`, `foldCloseoutHistory`. Uses only `StateStorePort`; no schema bump, no runtime API. |
| PIN-14 | **GitHub adapter methods**: extend `GithubClient` with `findMergedDeliveryRequest`, `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread`. `normalizePullRequest` copies `headSha` from `head.sha` only when present. GraphQL `resolveReviewThread` is a `POST {baseUrl}/graphql` through the existing transport. |
| PIN-15 | **Jira adapter methods**: extend `JiraClient` with `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`. Label replace computes the target set from the provider-asserted labels at execution time, removes only named labels, adds `delivered`, and preserves every other label. The done transition uses `JIRA_WORKFLOW_MAP`; `jira.js` remains a recorded re-evaluation trigger if the minimal client cannot satisfy the semantics. |
| PIN-16 | **Git subpath**: `@delivery-os/adapters/git` at `packages/adapters/src/git/index.ts`; `createGitBranchSeam`, `GitBranchSeam`, `GitBranchSeamOptions`, `GitCheckoutFacts`, `GitBranchFacts`, `GitSafetyFacts`, `GitMutationResult`; methods `readCheckout`, `listBranches`, `readBranch`, `isCheckedOutElsewhere`, `isClean`, `resolveRef`, `restoreCheckout`, `deleteBranch`. Fixed argv, no shell, no network, local-only. |
| PIN-17 | **CLI module**: `packages/cli/src/commands/closeout.ts`; `CloseoutCommandRuntime`, `createCloseoutCommandDefinition`. Composition `CloseoutComposition` and `createCloseoutCommandRuntime` in `packages/cli/src/edge.ts`; registration in `createConfigProgram` as `commands.closeout`. Grammar: `closeout <workItemRef> [--apply] [--json]`; `positionals: { max: 2 }` so the handler rejects a stray positional as `input.value.rejected`; canonical ref pattern `^[A-Z][A-Z0-9]*-\d+$`; `--apply` is the only mutation switch; `--json` is stripped by the shared parser. |
| PIN-18 | **Conformance**: add step `change-lifecycle.resolve-delivery-thread` with operation `resolve-delivery-thread`, assertion family `delivery-thread`; registry becomes 13 steps / 8 operations. Widen `MockTenantRoute.method` to the closed transport method set and add an optional request body; add `threadId` to `GithubMockAddressing`. Phase 1 keeps the new operation a gap on every provider; Phases 4/5 add the production write-execution branch (`registration.writeHandler` → client write member → fail closed), the provider write members, and the GitHub `POST /graphql` plus write routes in the same commit as the capability flip. |
| PIN-19 | **Fixtures/harness**: `tests/fixtures/closeout/harness.ts` (provider/git/state fakes + `runCloseoutCli`), `plan.ts`, `labels.ts`, `dependents.ts`, `threads.ts`, `request.ts`, `capabilities.ts`, `branch.ts`, `canary.ts`, `golden/**`, `mutants/**`; provider fixtures under `tests/fixtures/providers/{github,jira,gitlab}` and trap catalogs under `tests/fixtures/providers/traps/**`; temp local git repositories via `mkdtemp` + `git init`. |
| PIN-20 | **Changeset**: `.changeset/gh-183-closeout-minor.md` with a `minor` bump for exactly `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`; `testkit` never versioned. |

## Delivery Bindings (D1..D15)

- **D1 — Additive-only contract evolution.** `headSha` is optional and `resolve-delivery-thread` is appended to the closed set. No v2 contract, no parallel adapter surface, no provider-native type crossing a port. Governed by TDR-0008; no schema-version bump or migration.
- **D2 — Same-commit error identity and documentation.** `closeout` joins `DOMAIN_KINDS`, the four rows land in `ERROR_TABLE`, and the documented table in `doc/spec/features/feature-result-contract.md` is updated in the same Phase 1 commit. `scripts/checks/error-table-sync.ts` is green in both directions from the first phase boundary; the documented table is never rewritten by later phases except to fix drift found by the sync gate.
- **D3 — Conformance write execution is a delivery obligation, phased with capability.** Phase 1 adds the flow step and keeps `resolve-delivery-thread` (and the existing write operations) as declared gaps, so the conformance suite stays green. Phase 4 flips the GitHub capability and adds the production write-execution branch, the client write members, and the GitHub routes in the same commit; Phase 5 does the same for Jira. The `writeHandler` seam remains for test-only controls; a registration with a supported non-read step and no handler/client member still fails closed. The live tier remains read-only (`live-read-only` skips).
- **D4 — Transport widening, not a new transport.** `ProviderHttpMethod` becomes the closed set `GET | POST | PATCH | PUT | DELETE` and `ProviderRequest` gains an optional `body?: string`. The GitHub/Jira/GitLab native `fetch` defaults forward the body. Reads remain `GET`; the live conformance guard still rejects any non-`GET` request. No new credential or network location is introduced.
- **D5 — Pure domain with injected time and identity.** The planner, identity derivation, folding, bounds, branch-safety predicate, and human renderer are pure. Time comes from an injected ISO string; run/fence ids come from injected factories; the contracts/domain tiers contain no ambient clock, randomness, environment, `node:*`, or `bun:*` import.
- **D6 — Ledger through the existing fenced port.** Apply acquires the single-writer fence, reads the verified history, appends one `closeout.operation` record per terminal operation, and releases the fence in a `finally`. Plan mode acquires no fence and appends nothing. A torn or malformed ledger is the delivered classified `state.*` error, never zeros.
- **D7 — GitHub is the dogfood write host.** Issue close, labels, assignee, merged-PR lookup/head, GraphQL thread resolution, and reverse dependents are implemented behind the existing injected transport and credential port. Capability declaration: supported `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `resolve-delivery-thread`; gaps `write-comment` and `write-delivery-request` (`adapter-not-implemented`).
- **D8 — Jira write basis is the delivered seed extended.** Done transition, full-array label replace with preservation, assignee clear, and a bounded reverse-dependent JQL read. Capability declaration: supported `read-work-item`, `write-work-item`, `transition-work-item`; gaps `write-comment` (`adapter-not-implemented`), `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `resolve-delivery-thread` (`provider-unsupported`). If the minimal client cannot satisfy label-replace, transition, or assignee-clear semantics, record the `jira.js` re-evaluation trigger before expanding the client; do not silently widen the boundary.
- **D9 — GitLab stays read-only.** `normalizeMergeRequest` copies a provider-exposed head verbatim (`sha` when present) into optional `headSha`; absent stays absent. GitLab declares every write, including `resolve-delivery-thread`, as `adapter-not-implemented`. No GitLab write method is added.
- **D10 — Dedicated git seam with exact confinement.** The new `packages/adapters/src/git/` subpath is the only spawn surface for branch/checkout operations. `.dependency-cruiser.cjs` gains one exact, reason-bearing `runtime-apis-confinement` entry; `tests/boundaries` gains positive and negative fixtures. The read-only `repo` reader is unchanged: its existing `node:fs` allowance stays, it gains no `node:child_process`/`Bun.spawn`/`Deno.Command` surface, and an AST assertion proves it. `status`, `queue ready`, and `verify change` do not import the closeout engine, provider write path, or git seam.
- **D11 — CLI composition and read-only isolation.** The handler validates grammar, delegates to the closeout runtime, and returns data or a classified failure; the shared CLI edge owns rendering and exit projection. `createProductionDependencies` and the read-only command compositions are untouched. `closeout` is registered only when the closeout composition is supplied.
- **D12 — Bounded output and one redaction chokepoint.** Machine data is a bounded `delivery.closeout.v1` payload; human output is a deterministic digest within 200 lines/16 KiB. Evidence names operations, targets, counts, refs, labels, outcomes, and classified reasons only. The existing serializer redaction covers both modes; no comment bodies, titles, raw payloads, credentials, environment values, or command arguments enter output or ledger evidence.
- **D13 — Inventory/allowance cadence.** Every phase that adds a `packages/**/src/**` file updates `tests/structure/inventory.json` and the file's `EXECUTABLE_ALLOWANCES` entry in `tests/structure/content-inventory.test.ts` in the same commit. Every new contracts module that carries executable `as const` data is added to `tests/structure/port-neutrality.test.ts`'s scanned module list (or proven declaration-only by the same suite). Each phase boundary keeps `bun test tests/structure/content-inventory.test.ts` green.
- **D14 — Hermetic fixtures.** Provider behaviour is proven by committed sanitized fixtures through injected transports; the git seam is exercised against temporary local repositories; the live worktree, `dist/`, and the user's real state directory are never written. No live provider, credential, socket, or network call exists in the battery. The no-leak canary is asserted present before absence is asserted.
- **D15 — Protected paths and no new dependencies.** `scripts/*.sh`, `scripts/checks/secret-read-boundary.ts`, `tools/`, `.opencode/`, `.ados-claude/`, the bash CI jobs, and `.github/workflows/ci.yml` are untouched. No new runtime dependency, lockfile package, package/subpath beyond `adapters/git`, or brand-derived string is introduced. This plan does not push, open a PR, merge, or claim owner approval; PR creation is lifecycle phase 11.

## Scope

### In Scope

- F-1: the `closeout <workItemRef> [--apply] [--json]` command surface with canonical ref validation and dry-run default.
- F-2: the deterministic seven-step ordered transaction and canonical operation expansion.
- F-3: deterministic operation identities, the `closeout.operation` ledger record, terminal-outcome reuse, and failed-outcome retry.
- F-4: ticket-to-done through the declared workflow transition.
- F-5: the bounded lifecycle label disposition table and sweep (including the Jira full-array preservation trap).
- F-6: explicit unassign that never infers "already unassigned" from absence.
- F-7: the bounded owed-flip sweep over direct dependents (cap 200, deterministic order, unknown never satisfied).
- F-8: review-thread resolution over the merged delivery request (cap 100; GitHub GraphQL; gaps elsewhere).
- F-9: checkout restore to the resolved base with safety refusals.
- F-10: squash-safe local branch cleanup with protected-ref, dirty-worktree, foreign-worktree, ambiguity, and unknown-head safety.
- F-11: honest per-provider capability declarations and declared-gap handling for GitHub, Jira, and GitLab.
- F-12: merged-delivery-request lookup by source ref and the additive `DeliveryRequest.headSha`.
- F-13: bounded machine and human output with per-operation evidence.
- F-14: the four `closeout` failure identities in the existing result contract, error table, documented table, and CLI projection.
- F-15: read-only command isolation, the dedicated git seam, and the exact runtime-confinement entry.
- The conformance flow-registry step and production write execution required by TDR-0008 and the existing conformance invariant.
- Boundary, behaviour, structure, golden, checks, conformance, and type evidence for the above, all offline.

### Out of Scope

- [OUT] Harness session telemetry capture (NG-1, M1-S11).
- [OUT] Remote branch deletion, remote ref cleanup, force push, or history rewrite (NG-2).
- [OUT] GitLab write operations; they remain declared gaps (NG-3).
- [OUT] The full GitHub adapter, full issue lifecycle, releases, and non-closeout operations (NG-4, M3-S3).
- [OUT] Merge execution or merge verification (NG-5, M1-S4).
- [OUT] Posting a closure comment or arbitrary tracker/PR comment writes (NG-6; OQ-2).
- [OUT] Cross-repository closeout, global state, or multi-repo fan-out (NG-7).
- [OUT] MCP and OpenCode closeout surfaces (NG-8).
- [OUT] Memory capsule completion, promotion, or retrospective records (NG-9).
- [OUT] Owner-gate SLA mechanics, board escalation, or brief rendering (NG-10).
- [OUT] Queue, lane, dispatch, or supervision behavior (NG-11).
- [OUT] Behavior changes to `status`, `queue ready`, or `verify change` (NG-12).
- [OUT] New runtime dependencies, new network runtime locations, or a new transport.
- [OUT] A `--reconcile` mode, closure comments, transitive owed-flip, or richer merged-request selection.

### Assumptions

- The work item ref identifies one closeout target and one delivery request per repository branch convention.
- GitHub is the dogfood write host; Jira is the second write provider; GitLab writes remain gaps.
- The providers expose the operations closeout needs: GitHub issue close, labels, assignee clear, merged-PR lookup/head, issue dependencies, and review-thread resolution; Jira done transitions, label replace, assignee clear, relations, and JQL; GitLab merged-MR/pipeline reads. Exact GraphQL/response shapes are confirmed by committed fixtures at implementation; if a signal is unavailable, the dependent step declares a gap or refuses rather than guessing.
- The merged delivery request's head identity is observable through the provider lookup; when it is not, branch cleanup refuses rather than guesses.
- The repository integration base is declarable (`main-tools` for this repository); a merged delivery request's target ref takes precedence.
- The local branch follows the branch convention and is the only local branch for the work item unless the merged head selects one uniquely.
- The state layer's additive record kinds are sufficient; no schema-version bump or migration is needed.
- Provider credentials resolve through the credential port in apply; plan mode reads only what its evidence needs and performs no writes.
- The operator understands that closeout is dry-run by default and that `--apply` is the mutation switch.
- Declared gaps and no-op conditions are successful outcomes; safety refusals and non-gap write failures are classified failures.
- The existing conformance control that fails closed on a supported non-read step without a handler is preserved; production registrations that implement the client write member execute instead.
- The NFR-6 reference-fixture p95 is an optional non-CI measurement (GAP-T2); CI asserts bounded work, caps, and declared timeouts.
- The `jira.js` re-evaluation trigger is available if the minimal Jira client cannot satisfy label-replace, transition, or assignee-clear semantics.

### Constraints

- **Tier and purity.** Contracts and domain stay runtime-neutral: no `node:*`/`bun:*`, ambient clock/randomness/environment, provider-native types, or I/O. The planner and identity derivation are pure. Injected time/ids are the only nondeterminism boundaries.
- **Additive within v1.** No delivered field, operation, record kind, or error row is removed or retyped. `headSha` is optional; `resolve-delivery-thread` is appended; `closeout.operation` is an additive record kind; `closeout` is an additive domain kind.
- **Fenced state.** Apply acquires one fence; plan acquires none. One append per terminal operation. Verified reads; torn/malformed state is a classified error, never zeros. No schema-version bump.
- **Offline proof.** Provider behaviour is fixture-driven; GraphQL is a fixture through the existing transport; the only real process is local `git` inside a temp repository. No live credential, host resolution, socket, or network in the battery.
- **Branch safety.** Deletion is local-only and requires the full predicate: merged request observed, source-ref convention match, merged head observed and equal to the local head, not protected, not the current checkout, not checked out elsewhere, restore succeeded when required, and no earlier non-gap failure. Force deletion is used only after the predicate proves the work landed.
- **Read-only isolation.** `status`, `queue ready`, and `verify change` keep zero writes and zero process spawns, and do not import the closeout engine, provider write path, or git seam. The read-only `repo` reader is not admitted to spawn.
- **Credential discipline.** Every provider call resolves through `CredentialPort`; no closeout code reads the ambient environment or stores secret material. The secret-read allowlist stays at four entries.
- **Output discipline.** Machine payload ≤ 64 KiB; human output ≤ 200 lines and ≤ 16 KiB; deterministic truncation; no forbidden content. The existing serializer is the single redaction chokepoint.
- **Build order.** `pnpm build` before a narrow `bun test` that imports package surfaces; `pnpm test`/`pnpm check` build through `pretest`/`pretypecheck`.
- **Commits.** One Conventional Commit per phase, scope `GH-183`, via `@committer`; every phase boundary leaves the narrow gates green. This plan does not push or open a PR.

### Risks

- **RSK-1 — Provider write semantics diverge.** H/M. Mitigated by write fixtures and trap tests per provider, declared gaps for unsupported operations, and the conformance capability matrix (Phases 4, 5, 8).
- **RSK-2 — Branch deletion loses unmerged work.** H/L. Mitigated by the full squash-safety predicate, merged-head equality, protected-ref checks, dirty/foreign-worktree checks, dry-run default, and no remote deletion (Phase 6; BR-01..BR-12).
- **RSK-3 — Ledger and provider state diverge after a crash.** M/M. Mitigated by idempotent writes, re-observation, terminal reuse, failed retry, and the single-writer fence (Phase 3; TC-015..019).
- **RSK-4 — Additive contract changes are rejected by governance.** M/L. Mitigated by TDR-0008, the additive-within-v1 precedent, and safe degradation to a branch-cleanup refusal when the head is unknown (Phase 1; TC-006/051).
- **RSK-5 — Scope creep into comments, full adapters, or GitLab writes.** M/M. Mitigated by non-goals, capability gaps, and OQ-2 (all phases).
- **RSK-6 — Live-network or credential creep.** M/L. Mitigated by the offline fixture policy, injected transports, the throwing-fetch guard, and the secret-read allowlist (Phase 8; TC-062).
- **RSK-7 — Read-only commands gain the spawn seam or write path.** H/L. Mitigated by the dedicated subpath, exact confinement, dependency-cruiser negative fixtures, and the unchanged read-only suites (Phase 6/8; TC-007/008).
- **RSK-8 — Owed-flip scan becomes unbounded or flips on unknown evidence.** M/M. Mitigated by direct dependents only, cap 200, deterministic order, terminal `hand-back` exclusion, and unknown-never-satisfied (Phase 2/4/5/8; TC-031..036).
- **RSK-9 — Output leaks comment bodies, titles, or secrets.** H/L. Mitigated by bounded evidence, no body reads in output, one redaction chokepoint, and planted canaries (Phase 7/8; TC-059/060/062).
- **RSK-10 — The Jira write basis is insufficient.** M/M. Mitigated by the adapter boundary, the recorded `jira.js` trigger, and write/trap fixtures before delivery (Phase 5; TC-026/054).
- **RSK-11 — Ambiguous merged request or branch selection.** M/L. Mitigated by deterministic source-ref lookup, highest-entity selection, and `closeout.target.ambiguous` with zero destructive action (Phase 4/6; TC-050/057).
- **RSK-12 — Capability gaps are misreported as success.** M/L. Mitigated by the closed vocabulary, parity tests, and the success-claiming mutant (Phase 1/8; TC-056/064).
- **RSK-P1 — Size/complexity of a cross-tier change.** H/M. Mitigated by twelve independently committed phases, narrow suites per phase, and a full battery in Phase 8/12. The highest-risk integration points are the transport widening (D4), conformance write execution (D3), and the git seam (D10); each has its own phase and fixtures.
- **RSK-P2 — Offline proof is incomplete for GraphQL/write paths.** H/M. Mitigated by committed GraphQL and write fixtures, a throwing-fetch guard, a recording transport, and TC-062's scan. A missing fixture is a test failure, not a live fallback.
- **RSK-P3 — Conformance write execution destabilizes the GH-189 suite.** M/M. Mitigated by preserving the test-only `writeHandler` fail-closed control, adding production write members additively, and updating the step/operation counts deliberately (TC-002).
- **RSK-P4 — Transport method/body widening breaks GET-only assumptions.** M/L. Mitigated by keeping reads `GET`, adding methods/body additively, and updating only the shape assertions that name them (Phase 4).
- **RSK-P5 — GitHub reverse-dependent read is unavailable.** M/M. Mitigated by a bounded issue-dependencies read with a fixture; if unavailable, the owed-flip step is a declared gap with evidence, never a false success (Phase 4).
- **RSK-P6 — The plan's phase map drifts from the test plan.** M/L. Mitigated by the traceability table; any change to a TC's behaviour, assertion, or AC mapping reopens the test plan (A-T6).

### Success Metrics

| Metric | Target |
|--------|--------|
| Routine manual closeout misses per merge in dogfood | 0 after adoption |
| Re-run after a simulated restart with zero duplicate mutations | 100% of applied fixtures |
| Apply completes in one run on the declared fixture and dogfood happy path | ≥ 99% |
| Planned operation identity stability for identical inputs | 100% byte-identical |
| Declared-gap parity for unsupported closeout operations | 100% carry a valid gap reason |
| Offline gate battery without live credentials or network | 100% of closeout tests |
| Read-only command regressions (`status`, `queue ready`, `verify change`) | 0 |
| Closeout apply duration on the reference fixture | p95 ≤ 120 s; every operation bounded by 30 s (CI asserts bounded work; reference latency non-CI per GAP-T2) |
| Post-closeout ticket, label, assignee, and thread state correctness on happy-path fixtures | 100% |
| Branch deletion on a squash-merged branch with matching merged head | 100% of eligible fixtures; 0 deletions on unsafe fixtures |
| Conformance registry/operation coverage | 13 steps / 8 operations; every supported operation executes in mock |
| New runtime dependencies | 0 |

## File and Module Layout

| Area | New | Updated |
|---|---|---|
| Core contracts | `packages/core/src/contracts/closeout.ts` | `contracts/index.ts`, `contracts/ports.ts`, `contracts/adapter-capabilities.ts`, `contracts/error-table.ts` |
| Core domain | `packages/core/src/domain/closeout.ts` | `domain/index.ts`, `packages/core/src/index.ts` |
| Core state | `packages/core/src/state/closeout.ts` | `state/index.ts` |
| Adapters shared | — | `packages/adapters/src/io/provider-transport.ts`, `packages/adapters/package.json` |
| GitHub | `packages/adapters/src/github/closeout.ts` (internal helpers, if needed) | `github/client.ts`, `github/normalize.ts`, `github/capabilities.ts`, `github/index.ts` |
| Jira | `packages/adapters/src/jira/closeout.ts` (internal helpers, if needed) | `jira/client.ts`, `jira/normalize.ts`, `jira/capabilities.ts`, `jira/index.ts` |
| GitLab | — | `gitlab/normalize.ts`, `gitlab/capabilities.ts` |
| Git seam | `packages/adapters/src/git/index.ts` | `packages/adapters/package.json` (export + `#git/*`), `packages/cli/package.json` (`workspaceImports`) |
| CLI | `packages/cli/src/commands/closeout.ts` | `packages/cli/src/commands/index.ts`, `packages/cli/src/edge.ts` |
| Conformance/testkit | — | `packages/testkit/src/conformance/{flows,types,adapters,runner,coverage,mock-tenant}.ts` |
| Fixtures | `tests/fixtures/closeout/**`, `tests/fixtures/providers/github/closeout-*.json`, `tests/fixtures/providers/jira/closeout-*.json`, `tests/fixtures/providers/gitlab/closeout-*.json` | `tests/fixtures/providers/traps/*.traps.json`, `tests/fixtures/providers/github/**`, `tests/fixtures/providers/conformance/github/tenant.json` |
| Structure/checks | `tests/structure/closeout-contract.test.ts`, `tests/structure/closeout-imports.test.ts`, `tests/types/closeout-headsha.type-test.ts` | `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/structure/port-neutrality.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/conformance-coverage.test.ts`, `tests/boundaries/fixture-registry.json`, `tests/boundaries/fixtures/cases.ts`, `.dependency-cruiser.cjs` |
| Behaviour/golden/checks | `tests/behaviour/closeout-*.test.ts`, `tests/golden/closeout-*.test.ts`, `tests/checks/closeout-mutants.test.ts`, `tests/fixtures/closeout/mutants/**` | `tests/behaviour/error-classification.test.ts`, `tests/behaviour/provider-capabilities.test.ts`, `tests/behaviour/providers/*`, `tests/conformance/**`, `tests/checks/fixture-sanitization.test.ts` |
| Docs | `doc/spec/features/feature-closeout.md` | `doc/spec/features/feature-adapter-ports.md`, `feature-provider-client-seeds.md`, `feature-state-layer.md`, `feature-result-contract.md`, `feature-adapter-conformance.md`, `doc/planning/oss-tooling/cli-command-registry.md` (verify only), `doc/00-index.md` (if indexed) |
| Release | `.changeset/gh-183-closeout-minor.md` | — |

## Traceability and Coverage: All 64 TCs to Phases

The test plan owns the TC definitions and oracles; this table assigns each TC to the phase that delivers it and names the suite. A TC may be asserted again in later phases, but its first delivering phase is below. No TC is reshaped; any change to a TC's behaviour, assertion, or AC mapping reopens the test plan (A-T6).

| TC | AC | Phase(s) | Suite / artefact |
|---|---|---|---|
| TC-CLOSE-001 | AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9 | 1, 2 | `tests/structure/closeout-contract.test.ts` |
| TC-CLOSE-002 | AC-F11-1, AC-F11-2, AC-F11-3, AC-F12-3, NFR-9 | 1, 4, 5 | `tests/structure/closeout-contract.test.ts`, `tests/structure/conformance-coverage.test.ts`, conformance suites |
| TC-CLOSE-003 | AC-F14-1 | 1 | `tests/structure/error-table.test.ts` |
| TC-CLOSE-004 | AC-F14-2, NFR-11 | 1, 8 | `tests/checks/error-table-sync.test.ts`, `scripts/checks/{error-table-sync,exit-code-literals}.ts` |
| TC-CLOSE-005 | AC-F14-1 | 1 | `tests/behaviour/error-classification.test.ts` |
| TC-CLOSE-006 | AC-F12-3, AC-F10-7, DM-8 | 1, 4, 6 | `tests/types/closeout-headsha.type-test.ts`, `tests/behaviour/closeout-request.test.ts`, `tests/behaviour/closeout-branch.test.ts` |
| TC-CLOSE-007 | AC-F15-1, NFR-5 | 6, 8 | `tests/structure/closeout-imports.test.ts`, read-only suites |
| TC-CLOSE-008 | AC-F15-1, NFR-5, NFR-12 | 6, 8 | `tests/structure/closeout-imports.test.ts`, `tests/boundaries`, `pnpm check:boundaries` |
| TC-CLOSE-009 | AC-NFR10-1, NFR-10 | 8, 12 | `tests/checks/license-*.test.ts`, `scripts/checks/{license-audit,vulnerability-gate}.ts` |
| TC-CLOSE-010 | AC-F1-1, AC-F2-2, NFR-4 | 2, 7 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-011 | AC-F1-2, AC-F2-2, NFR-4 | 2, 7 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-012 | AC-F1-3 | 7 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-013 | AC-F2-1, NFR-2 | 2, 8 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-014 | AC-F2-3, AC-F2-1, AC-F3-4, DM-9 | 2 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-015 | AC-F3-1, NFR-1 | 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-016 | AC-F3-2, NFR-1 | 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-017 | AC-F3-3 | 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-018 | AC-F3-4, DM-9 | 2, 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-019 | AC-NFR8-1, NFR-8, EVT-1 | 3 | `tests/behaviour/closeout-idempotency.test.ts`, `tests/fixtures/state/harness.ts` |
| TC-CLOSE-020 | AC-F4-1 | 4, 5 | `tests/behaviour/closeout-ticket-labels.test.ts` |
| TC-CLOSE-021 | AC-F4-2 | 4, 5 | `tests/behaviour/closeout-ticket-labels.test.ts` |
| TC-CLOSE-022 | AC-F4-3, NFR-9 | 4, 5 | `tests/behaviour/closeout-ticket-labels.test.ts` |
| TC-CLOSE-023 | AC-F5-1, DM-6 | 4, 5 | `tests/behaviour/closeout-ticket-labels.test.ts` |
| TC-CLOSE-024 | AC-F5-2 | 4, 5 | `tests/behaviour/closeout-ticket-labels.test.ts` |
| TC-CLOSE-025 | AC-F5-3 | 4, 5 | `tests/behaviour/closeout-ticket-labels.test.ts` |
| TC-CLOSE-026 | AC-F5-4, NFR-12 | 5 | `tests/behaviour/closeout-ticket-labels.test.ts`, Jira trap fixtures |
| TC-CLOSE-027 | AC-F6-1, DM-5 | 4, 5 | `tests/behaviour/closeout-unassign.test.ts` |
| TC-CLOSE-028 | AC-F6-2 | 4, 5 | `tests/behaviour/closeout-unassign.test.ts` |
| TC-CLOSE-029 | AC-F6-3, NFR-9 | 4, 5 | `tests/behaviour/closeout-unassign.test.ts` |
| TC-CLOSE-030 | AC-F6-4 | 4, 5 | `tests/behaviour/closeout-unassign.test.ts` |
| TC-CLOSE-031..036 | AC-F7-1..AC-F7-6, NFR-6, NFR-9 | 4, 5, 8 | `tests/behaviour/closeout-owed-flip.test.ts` |
| TC-CLOSE-037..040 | AC-F8-1..AC-F8-4, NFR-6, NFR-9 | 4, 8 | `tests/behaviour/closeout-threads.test.ts` |
| TC-CLOSE-041..044 | AC-F9-1..AC-F9-4, DM-7 | 6 | `tests/behaviour/closeout-checkout.test.ts` |
| TC-CLOSE-045..052 | AC-F10-1..AC-F10-8, DM-7, DM-8, NFR-13 | 6, 8 | `tests/behaviour/closeout-branch.test.ts` |
| TC-CLOSE-053..056 | AC-F11-1..AC-F11-4, NFR-9 | 1, 4, 5, 8 | `tests/behaviour/closeout-capabilities.test.ts` |
| TC-CLOSE-057..058 | AC-F12-1..AC-F12-2, DM-8 | 4 | `tests/behaviour/closeout-request.test.ts` |
| TC-CLOSE-059 | AC-F13-1, NFR-7, NFR-12 | 2, 7, 8 | `tests/behaviour/closeout-output.test.ts`, `tests/golden/closeout-envelope.test.ts` |
| TC-CLOSE-060 | AC-F13-2, NFR-7 | 2, 7, 8 | `tests/behaviour/closeout-output.test.ts`, `tests/golden/closeout-human.test.ts` |
| TC-CLOSE-061 | AC-F14-1, NFR-11 | 7, 8 | `tests/behaviour/closeout-output.test.ts` |
| TC-CLOSE-062 | AC-NFR3-1, NFR-3, NFR-12 | 8 | `tests/behaviour/closeout-hermetic.test.ts`, `tests/checks/fixture-sanitization.test.ts` |
| TC-CLOSE-063 | NFR-6 (AC-F7-5, AC-F8-1) | 8 | owed-flip/threads suites + `tests/structure/closeout-contract.test.ts` |
| TC-CLOSE-064 | §4.2 (all ACs) | 8 | `tests/checks/closeout-mutants.test.ts`, `tests/fixtures/closeout/mutants/**` |

**AC coverage.** All 58 ACs appear in the TC map above, and every TC maps to a delivering phase with at least one task. The ranges in the trace are inclusive and total 58: AC-F1-1..3 (3), AC-F2-1..3 (3), AC-F3-1..4 (4), AC-F4-1..3 (3), AC-F5-1..4 (4), AC-F6-1..4 (4), AC-F7-1..6 (6), AC-F8-1..4 (4), AC-F9-1..4 (4), AC-F10-1..8 (8), AC-F11-1..4 (4), AC-F12-1..3 (3), AC-F13-1..2 (2), AC-F14-1..2 (2), AC-F15-1 (1), AC-NFR3-1 (1), AC-NFR8-1 (1), AC-NFR10-1 (1). The grouped AC-to-phase trace is: AC-F1 → Phase 2/7; AC-F2 → Phase 1/2/7; AC-F3 → Phase 2/3; AC-F4 → Phase 4/5; AC-F5 → Phase 1/4/5; AC-F6 → Phase 4/5; AC-F7 → Phase 4/5/8; AC-F8 → Phase 4/8; AC-F9 → Phase 6; AC-F10 → Phase 1/6/8; AC-F11 → Phase 1/4/5/8; AC-F12 → Phase 1/4/6; AC-F13 → Phase 2/7/8; AC-F14 → Phase 1/7/8; AC-F15 → Phase 6/8; AC-NFR3 → Phase 8; AC-NFR8 → Phase 3; AC-NFR10 → Phase 8/12. NFR-6 and NFR-12 are qualified by the ACs they map to in the test plan §3.3 (GAP-T5), with TC-035/037/063 and TC-026/059/062 as their evidence.

## Phases

Execution order is strict Phase 1 → Phase 12. Each delivery phase (1–8) ends in a verifiable state and one Conventional Commit (scope `GH-183`) via `@committer`. Phases 9–12 are the review/documentation/release closeout and commit only when they change files. Narrow cycles: `pnpm build` first, then the listed `bun test` command; final verification uses `pnpm check` (which builds through `pretest`/`pretypecheck`). Every phase that adds a `packages/**/src/**` file updates inventory/allowance in the same commit (D13).

---

### Phase 1: Contracts, additive adapter extensions, closeout error identities, and conformance registry

**Goal**: Land the stable closeout vocabulary, the two additive adapter-contract extensions, the four closeout error rows plus documented rows, and the conformance registry/runner changes for `resolve-delivery-thread` and the newly supported writes. No planner or adapter implementation yet.

**Tasks**:

- [ ] **1.1** Create `packages/core/src/contracts/closeout.ts` with the PIN-1 types and `as const` data only: `CLOSEOUT_SCHEMA_ID`, `CLOSEOUT_OPERATION_PAYLOAD_SCHEMA`, `CLOSEOUT_OPERATION_RECORD_KIND`, `CLOSEOUT_STEP_IDS`, `CLOSEOUT_PLAN_OUTCOMES`, `CLOSEOUT_APPLY_OUTCOMES`, `CLOSEOUT_GAP_REASONS`, `CLOSEOUT_OPERATION_NAMES`, `LIFECYCLE_LABEL_DISPOSITIONS`, `PROTECTED_REF_NAMES`, `CLOSEOUT_INTEGRATION_BASE`, `OWNER_ATTENTION_LABEL`, `BLOCKED_LABEL`, `DELIVERED_LABEL`, `CHANGE_LABEL`, the six caps, and the `Closeout*` types (plan, step, operation, arguments, outcome, gap, evidence, truncation, data, summary, record, provider/git/state runtimes). Export from `contracts/index.ts`. (TC-001, TC-003, TC-006, TC-014, TC-018)
- [ ] **1.2** Add `readonly headSha?: string` to `DeliveryRequest` in `packages/core/src/contracts/ports.ts` (absent = unknown; copied verbatim) and append `"resolve-delivery-thread"` to `ADAPTER_OPERATIONS` in `packages/core/src/contracts/adapter-capabilities.ts`. No other field or operation changes. (TC-002, TC-006)
- [ ] **1.3** Update the three capability declarations additively for the new operation only: every adapter declares `resolve-delivery-thread` as a gap in this phase (GitHub and GitLab `adapter-not-implemented`, Jira `provider-unsupported`); all existing supported/gap splits are otherwise unchanged. The final GitHub/Jira supported sets and gap removals land in Phases 4/5, in the same commit as the implementing client and conformance routes. (TC-002, TC-053, TC-054, TC-055)
- [ ] **1.4** Add `closeout` to `DOMAIN_KINDS` and the four PIN-11 rows to `ERROR_TABLE` in `packages/core/src/contracts/error-table.ts`; update the declared-kind prose and the documented table in `doc/spec/features/feature-result-contract.md` in the same commit. (TC-003, TC-004)
- [ ] **1.5** Update `tests/structure/error-table.test.ts` additively (39 entries; `closeout` in the declared-kind prose; four row round-trips) and add closeout cases to `tests/behaviour/error-classification.test.ts` (kind-only containment, exact codes, existing kinds unchanged). Do not edit `scripts/checks/error-table-sync.ts` or `scripts/checks/exit-code-literals.ts`. (TC-003, TC-004, TC-005)
- [ ] **1.6** Update the conformance `resolve-delivery-thread` step and the transport/addressing shape: add `change-lifecycle.resolve-delivery-thread` (operation `resolve-delivery-thread`, assertion family `delivery-thread`); add `"delivery-thread"` to `ConformanceAssertionFamily`; add optional `resolveDeliveryThread?`, `writeWorkItem?`, `transitionWorkItem?` to `ConformanceAdapterClient`; widen `MockTenantRoute.method`/`ConformanceTransportRequest` to the closed method set with an optional body; add `threadId` to `GithubMockAddressing`; update `tests/structure/conformance-coverage.test.ts` to 13 steps / 8 operations. The step is a declared gap for every provider in this phase; GitHub's support lands in Phase 4, Jira and GitLab remain gaps. The production write-execution branch, the GraphQL `POST /graphql` route, and the GitHub/Jira write routes land with the adapter phases. (TC-002, TC-053, TC-054, TC-055, TC-056)
- [ ] **1.7** Update the structure registries: `tests/structure/inventory.json` adds `core/src/contracts/closeout.ts`; `tests/structure/content-inventory.test.ts` adds the new contract constants to `EXECUTABLE_ALLOWANCES`; `tests/structure/port-neutrality.test.ts` adds `closeout.ts` to the declaration-only scan. (TC-001, TC-008)
- [ ] **1.8** Add the contract/type evidence: `tests/structure/closeout-contract.test.ts` (step order, label disposition, protected set, outcome/gap vocabulary, operation names, data-only AST) and `tests/types/closeout-headsha.type-test.ts` (optional `headSha` probe; a required-field probe fails typecheck). In Phase 1, TC-002 asserts set coverage and no duplicates against the current (gap-only) split; the spec Appendix-B final supported/gap matrix is extended in Phases 4/5 when the capabilities flip. (TC-001, TC-002, TC-006)

**Acceptance Criteria**:

- Must: the contracts module is declaration-only; the seven step ids, label disposition, protected set, outcome/gap vocabularies, and caps are exact and exported (AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9).
- Must: `resolve-delivery-thread` is in the closed set; the conformance flow operation set equals `ADAPTER_OPERATIONS`; the new step exists; each adapter's supported plus gap operations covers the closed set exactly with no duplicates (the final supported/gap split and the production write execution land in Phases 4/5) (AC-F11-1/2/3, NFR-9).
- Must: `headSha` is optional; present round-trips and absent stays absent at the type level (AC-F12-3).
- Must: the four closeout rows are 4/4 in both the machine and documented tables; `closeout` is a declared kind; no exit literal moves outside the CLI projection (AC-F14-1/2, NFR-11).
- Should: Phase 1 leaves the new operation a declared gap on every provider, so the conformance suite remains green; the write-execution branch and routes land with the capability flips in Phases 4/5.

**Files and modules**:

- Code areas: `packages/core/src/contracts/closeout.ts` (new), `packages/core/src/contracts/{index,ports,adapter-capabilities,error-table}.ts` (updated), `packages/adapters/src/{github,jira,gitlab}/capabilities.ts` (updated), `packages/testkit/src/conformance/{flows,types,runner,mock-tenant}.ts` (updated), `tests/structure/{closeout-contract,error-table,conformance-coverage,content-inventory,port-neutrality}.test.ts` (new/updated), `tests/types/closeout-headsha.type-test.ts` (new), `tests/behaviour/error-classification.test.ts` (updated), `tests/conformance/**` (updated), `tests/fixtures/providers/conformance/github/tenant.json` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (updated in this phase for the four rows); the remaining system specs are Phase 11.

**Tests**:

- `pnpm install --frozen-lockfile && pnpm build`
- `bun test tests/structure/closeout-contract.test.ts`
- `bun test tests/structure/error-table.test.ts`
- `bun test tests/structure/conformance-coverage.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun test tests/checks/error-table-sync.test.ts`
- `bun run scripts/checks/error-table-sync.ts`
- `bun test tests/conformance`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add closeout contracts, error identities and conformance registry step`

---

### Phase 2: Pure closeout planner and domain

**Goal**: Implement the deterministic seven-step planner, canonical operation expansion, operation identity, outcome folding, base/protected-ref contract, branch-selection/safety predicate, bounded output, and human renderer as pure functions. No I/O, clock, randomness, or environment.

**Tasks**:

- [ ] **2.1** Create `packages/core/src/domain/closeout.ts` with the PIN-12 exports: `closeoutStepDefinitions` (exact seven-step order and expansion rules), `buildCloseoutPlan` (pure function of observed work item, capabilities, merged request, local facts, and persisted terminal outcomes), `canonicalCloseoutJson` (sorted-key, whitespace-free canonical form), `deriveCloseoutOperationId` (FNV-1a 64-bit over workspace/ref/engine/operation/arguments/target; capability context included), `foldCloseoutOutcomes` (first terminal per `operationId` authoritative; `failed` retryable), `summarizeCloseout`, `boundCloseoutData` (caps and truncation markers), `renderCloseoutHuman` (deterministic digest within 200 lines/16 KiB), `resolveCloseoutBaseRef`, `isProtectedRef`, `selectMatchingBranch`, `evaluateBranchSafety`. (TC-010..014, TC-018, TC-041..052 predicate, TC-059/060)
- [ ] **2.2** Enforce determinism: no wall clock, no `Math.random`, no API-return order, no hash-map iteration order. Labels follow the disposition table; dependents order by provider entity identity; threads order by thread identity; operations in a step keep the declared order. Operation ids are distinct per operation and change when any identity input changes. (TC-013, TC-014, TC-018)
- [ ] **2.3** Implement the outcome folding rules: plan outcomes `would-apply`/`satisfied`/`skipped-gap`/`skipped-noop`/`would-refuse`; apply outcomes `applied`/`satisfied`/`skipped-gap`/`skipped-noop`/`failed`/`refused`. Declared gaps and no-ops are non-fatal. A safety refusal is `refused` in the plan/apply step and projects `closeout.branch.unsafe` at the command boundary. (TC-010, TC-011, TC-022, TC-056)
- [ ] **2.4** Implement the branch-safety predicate and matching-branch selection from PIN-8 and the BR-01..BR-12 matrix: merged request observed, source-ref convention match, merged-head equality (absent refuses), protected refs, current/foreign worktree, restore-success precondition, and non-gap-failure precondition. Ambiguity is `closeout.target.ambiguous`; unsafe is `closeout.branch.unsafe`; already-absent is `satisfied`. (TC-045..052)
- [ ] **2.5** Export the domain surface from `domain/index.ts` and `packages/core/src/index.ts`; update `tests/structure/inventory.json` and the `content-inventory` allowance (PIN-20/D13). (TC-001)
- [ ] **2.6** Add `tests/fixtures/closeout/{harness,plan,labels,dependents,threads,request,capabilities,branch,canary}.ts` and `tests/fixtures/closeout/golden/**` with fixed `CLOSEOUT_NOW_MS`, fixed run-id sequence, and `SYNTHETIC_BRAND`; add `tests/behaviour/closeout-plan.test.ts` (TC-010..014), the identity/fold half of `tests/behaviour/closeout-idempotency.test.ts` (TC-018), and the renderer/bounds unit cases used by TC-059/060. (TC-010..014, TC-018, TC-059/060)

**Acceptance Criteria**:

- Must: the seven steps appear exactly in the declared order and expand deterministically (AC-F2-2, AC-F2-3).
- Must: repeated planning of identical inputs yields byte-identical steps, canonical arguments, and operation identities; permuting provider arrays does not change the plan (AC-F2-1, NFR-2).
- Must: operation identity is stable for identical identity inputs and changes when any input changes (AC-F3-4, DM-9).
- Must: the label disposition, protected-ref set, and base-resolution rule are exactly PIN-7/PIN-8 (AC-F5-1, AC-F10-3, DM-6, DM-7).
- Must: the branch predicate refuses on unknown head, moved head, protected ref, foreign/dirty worktree, ambiguity, and earlier non-gap failure, and deletes only on the full match (AC-F10-1..8, NFR-13).
- Should: the renderer is byte-identical across replays and within the human bounds (AC-F13-2, NFR-7).

**Files and modules**:

- Code areas: `packages/core/src/domain/closeout.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/fixtures/closeout/**` (new), `tests/behaviour/closeout-plan.test.ts` (new), `tests/behaviour/closeout-idempotency.test.ts` (new, identity/fold half), `tests/fixtures/closeout/golden/**` (new).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-plan.test.ts`
- `bun test tests/behaviour/closeout-idempotency.test.ts`
- `bun test tests/structure/closeout-contract.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add deterministic closeout planner and domain`

---

### Phase 3: Idempotency ledger through the fenced state port

**Goal**: Add the `closeout.operation` record read/write through the existing verified/fenced state port, and complete the apply orchestrator's terminal reuse, crash convergence, and failed retry. No schema bump or migration.

**Tasks**:

- [ ] **3.1** Create `packages/core/src/state/closeout.ts` with PIN-13: `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX = "closeout.operations:"`, `closeoutOperationRecordKey(workItemRef)`, `appendCloseoutOutcome(store, handle, record)`, `readCloseoutHistory(store, workItemRef)`, `foldCloseoutHistory(records)`. Payload schema `delivery.closeout.operation.v1`; one record per terminal operation; first terminal per `operationId` authoritative; torn/malformed is the delivered `state.*` error, never zeros. Export from `state/index.ts`. (TC-019)
- [ ] **3.2** Complete the apply orchestrator in `packages/core/src/domain/closeout.ts` (or a sibling `closeout-run.ts` if the file grows): `runCloseout(input)` takes the plan, the provider/git/state runtimes, and the injected ISO timestamp; reuses terminal outcomes; re-observes on `failed`; records `satisfied` when the effect already landed; retries otherwise; stops provider steps on a non-gap failure but still runs a safe local restore; skips branch deletion when a transaction operation failed or the safety predicate fails. (TC-015..017, TC-040, TC-052)
- [ ] **3.3** Implement the fence boundary in the runtime contract: plan mode calls no `acquireFence`/`append`; apply mode acquires one fence, appends within the bound handle, releases in a `finally`, and surfaces a fence/append/read failure as the classified state identity. (TC-010, TC-011, TC-019)
- [ ] **3.4** Update `tests/structure/inventory.json` and the `content-inventory` allowance for `state/closeout.ts`; no `port-neutrality` change (state is not the contracts tier). (D13)
- [ ] **3.5** Complete `tests/behaviour/closeout-idempotency.test.ts` with the recording fenced state fake: terminal reuse after a fresh composition (TC-015), crash between effect and record (TC-016), failed-outcome retention/retry (TC-017), identity stability/sensitivity (TC-018), ledger append/read/torn/malformed/fence/no-schema-bump (TC-019). (TC-015..019)

**Acceptance Criteria**:

- Must: a re-run in a fresh composition reuses every terminal outcome with zero duplicate mutations and exits 0 (AC-F3-1, NFR-1).
- Must: a crash between a provider effect and the ledger append converges as `satisfied` with no duplicate effect (AC-F3-2).
- Must: a persisted `failed` outcome is retained as evidence and retried safely; a re-run re-observes and can converge (AC-F3-3).
- Must: exactly one record per terminal operation; verified read returns them; a torn/malformed ledger is a classified state error; no schema bump (AC-NFR8-1, NFR-8, EVT-1, DM-4).
- Must: plan mode performs zero state appends and zero fence acquisitions (NFR-4).

**Files and modules**:

- Code areas: `packages/core/src/state/closeout.ts` (new), `packages/core/src/state/index.ts` (updated), `packages/core/src/domain/closeout.ts` (updated), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/behaviour/closeout-idempotency.test.ts` (completed), `tests/fixtures/state/harness.ts` (reused).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-idempotency.test.ts`
- `bun test tests/structure/closeout-contract.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add closeout idempotency ledger and apply orchestration`

---

### Phase 4: GitHub write adapter, merged-request/head reads, thread resolution, and reverse dependents

**Goal**: Implement the GitHub closeout write and read surface behind the existing injected transport and credential port, including issue close, label add/remove, assignee clear, merged-PR lookup plus `headSha`, GraphQL thread resolution, and a bounded reverse-dependent read. Add GitLab merged-head normalization (read-only). Add fixtures and trap tests.

**Tasks**:

- [ ] **4.1** Widen the transport additively in `packages/adapters/src/io/provider-transport.ts`: `ProviderHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"`, `ProviderRequest.body?: string`, and a `ProviderWriteResult<T = void>` result type. Update the native `fetch` defaults in the GitHub/Jira/GitLab clients to forward `body` when present; reads remain `GET`. (D4; TC-037, TC-020, TC-023, TC-027)
- [ ] **4.2** Extend `packages/adapters/src/github/normalize.ts`: `normalizePullRequest` copies `headSha` from `head.sha` only when present (absent stays absent); add `normalizeMergedDeliveryRequestList`, `normalizeIssueDependencies` (reverse dependents), and `normalizeThreadResolution` (GraphQL `resolveReviewThread`). (TC-006, TC-031..036, TC-037)
- [ ] **4.3** Extend `packages/adapters/src/github/client.ts` with PIN-14: `findMergedDeliveryRequest({ workItemRef, limit })` (closed pulls, merged only, source-ref convention filter), `listBlockedByDependents({ entityId, limit })` (bounded issue-dependencies read), `writeWorkItem({ entityId, add?, remove?, assignee? })`, `transitionWorkItem({ entityId, deliveryState: "done" })`, `resolveDeliveryThread({ deliveryRequest, threadId })` (GraphQL `POST /graphql`). Credentials resolve only through `CredentialPort`; no ambient environment read. Add internal helpers in `packages/adapters/src/github/closeout.ts` if needed. (TC-020..030, TC-037..040, TC-057/058)
- [ ] **4.4** Flip the GitHub capability declaration to the final split in the same commit as the implementation: supported `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `resolve-delivery-thread`; gaps `write-comment` and `write-delivery-request` (`adapter-not-implemented`). Update `packages/adapters/src/github/index.ts` only if a new exported type is required (keep the provider-surface set pinned) and update `tests/structure/provider-surface.test.ts` if the exported set changes deliberately. (TC-053)
- [ ] **4.5** Add sanitized fixtures: `tests/fixtures/providers/github/closeout-issues.json`, `closeout-pulls-merged.json`, `closeout-dependencies.json`, `closeout-labels.json`, `closeout-assignee.json`, `graphql-resolve-thread.json`; extend the GitHub trap catalog with the new write/read entries. (TC-020..040, TC-053)
- [ ] **4.6** Add behaviour tests: the GitHub half of `tests/behaviour/closeout-ticket-labels.test.ts` (TC-020..025), `tests/behaviour/closeout-unassign.test.ts` (TC-027..030), the GitHub half of `tests/behaviour/closeout-owed-flip.test.ts` (TC-031..036), `tests/behaviour/closeout-threads.test.ts` (TC-037..040), `tests/behaviour/closeout-request.test.ts` (TC-057/058), and `tests/behaviour/providers/github-closeout.test.ts` (trap/argument assertions). (TC-020..040, TC-053, TC-057/058)
- [ ] **4.7** Add the production conformance write-execution path and GitHub routes in the same commit: the runner prefers `registration.writeHandler` (test control) then the client write member then fails closed; add `writeWorkItem`/`transitionWorkItem`/`resolveDeliveryThread` to the GitHub registration; add the GitHub mock-tenant write routes, the `POST /graphql` `resolveReviewThread` route, and `threadId` addressing; update `tests/conformance/mock-conformance.test.ts` and `artifact.test.ts`. Update `tests/fixtures/providers/support.ts`/the recording transport only if the request body must be recorded. Add the GitLab `normalizeMergeRequest` `headSha` copy and a paired present/absent fixture. (TC-002, TC-006, TC-053, TC-055)

**Acceptance Criteria**:

- Must: an open item closes; labels add/remove exactly the named labels; assignee clear is explicit even when the signal is absent; each outcome is `applied` or `satisfied` as specified (AC-F4-1/2, AC-F5-1/2, AC-F6-1/2/4).
- Must: a merged PR is resolved deterministically by source ref and highest numeric entity identity; `headSha` round-trips verbatim and stays absent when absent (AC-F12-1/2/3, DM-8).
- Must: each unresolved thread resolves once through GraphQL; already-resolved is `satisfied`; a no-request is `skipped-noop`; a write failure is `closeout.write.failed` and retries safely (AC-F8-1/3/4).
- Must: the owed-flip step adds `hand-back`, removes a present `blocked`, names the open-blocker count, never flips on unknown, and respects the 200 cap (AC-F7-1..6).
- Must: GitHub declares the documented supported set and gaps; unsupported operations are `skipped-gap`, never success (AC-F11-1/4, NFR-9).
- Must: no provider-native type crosses the subpath surface; no ambient environment or secret read exists (NFR-12).

**Files and modules**:

- Code areas: `packages/adapters/src/io/provider-transport.ts` (updated), `packages/adapters/src/github/{client,normalize,capabilities,index}.ts` (updated), `packages/adapters/src/github/closeout.ts` (new, optional), `packages/adapters/src/gitlab/normalize.ts` (updated), `packages/adapters/src/gitlab/capabilities.ts` (Phase 1 update verified), `tests/fixtures/providers/github/**` (new/updated), `tests/fixtures/providers/traps/github.traps.json` (updated), `tests/behaviour/closeout-{ticket-labels,unassign,owed-flip,threads,request}.test.ts` (new), `tests/behaviour/providers/github-closeout.test.ts` (new), `tests/conformance/**` (updated), `tests/structure/provider-surface.test.ts` (updated if needed).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-ticket-labels.test.ts`
- `bun test tests/behaviour/closeout-unassign.test.ts`
- `bun test tests/behaviour/closeout-owed-flip.test.ts`
- `bun test tests/behaviour/closeout-threads.test.ts`
- `bun test tests/behaviour/closeout-request.test.ts`
- `bun test tests/behaviour/providers`
- `bun test tests/conformance`
- `bun test tests/structure/provider-surface.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add GitHub closeout writes, merged reads and thread resolution`

---

### Phase 5: Jira write adapter — done transition, label-preserving replace, assignee clear, reverse dependents

**Goal**: Implement the Jira closeout writes and bounded reverse-dependent read behind the existing transport and credential port, with the full-array label-replace preservation trap. GraphQL is not applicable.

**Tasks**:

- [ ] **5.1** Extend `packages/adapters/src/jira/client.ts` with PIN-15: `writeWorkItem({ issueKey, add?, remove?, assignee? })` (full-array label replace computed from the provider-asserted labels at execution time; assignee clear), `transitionWorkItem({ issueKey, deliveryState: "done" })` (data-driven transition from `JIRA_WORKFLOW_MAP`), and `listBlockedByDependents({ issueKey, limit })` (bounded JQL via `searchWorkItems`). No GraphQL. (TC-020, TC-023, TC-026, TC-027..030, TC-031..036)
- [ ] **5.2** Extend `packages/adapters/src/jira/normalize.ts` and `workflow-map.ts` with the write request/response helpers: label target-set computation, transition request construction, and reverse-dependent normalization. Preserve every label not named for removal; never whole-array overwrite. (TC-026)
- [ ] **5.3** Flip the Jira capability declaration to the final split in the same commit as the implementation: supported `read-work-item`, `write-work-item`, `transition-work-item`; gaps `write-comment` (`adapter-not-implemented`), `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `resolve-delivery-thread` (`provider-unsupported`). Update `tests/behaviour/provider-capabilities.test.ts`. (TC-054)
- [ ] **5.4** Add sanitized fixtures: `tests/fixtures/providers/jira/closeout-transitions-write.json`, `closeout-labels-replace-write-{before,after}.json`, `closeout-assignee.json`, `closeout-dependents.json`; extend `tests/fixtures/providers/traps/jira.traps.json` with the write/label-preservation entries. (TC-020..036, TC-054)
- [ ] **5.5** Add the Jira half of `tests/behaviour/closeout-ticket-labels.test.ts` (TC-020/023/026), `tests/behaviour/closeout-unassign.test.ts` (TC-027..030), the Jira half of `tests/behaviour/closeout-owed-flip.test.ts` (TC-031..036), `tests/behaviour/closeout-capabilities.test.ts` (TC-054), and `tests/behaviour/providers/jira-closeout.test.ts` (trap/argument assertions). (TC-020..036, TC-054)
- [ ] **5.6** If the minimal client cannot satisfy label-replace, transition, or assignee-clear semantics, record the `jira.js` re-evaluation trigger in the execution log before expanding the client; do not silently widen the boundary. Add the Jira write members to the conformance registration and the Jira write routes to the mock tenant; the runner's production write-execution branch landed in Phase 4. (D8; TC-054)

**Acceptance Criteria**:

- Must: the done transition is data-driven and lands as `applied`; an already-done item is `satisfied`; a missing mapping is `skipped-gap` (AC-F4-1/2/3).
- Must: the label replace removes only the named lifecycle labels, adds `delivered`, and preserves every other label; the trap fixture proves it (AC-F5-1/4).
- Must: unassign issues an explicit clear even when the assignee signal is absent; a re-run is `satisfied` with no duplicate clear (AC-F6-1/2/4).
- Must: the owed-flip sweep adds `hand-back`, removes a present `blocked`, and never flips on unknown (AC-F7-1..6).
- Must: Jira declares `resolve-delivery-thread` as `provider-unsupported` and the step skips with evidence; no Jira thread write exists (AC-F8-2, AC-F11-2).
- Should: the Jira write basis is proven before delivery; if it is insufficient, the trigger is recorded and the boundary is not silently widened.

**Files and modules**:

- Code areas: `packages/adapters/src/jira/{client,normalize,workflow-map,capabilities,index}.ts` (updated), `packages/adapters/src/jira/closeout.ts` (new, optional), `tests/fixtures/providers/jira/**` (new/updated), `tests/fixtures/providers/traps/jira.traps.json` (updated), `tests/behaviour/closeout-{ticket-labels,unassign,owed-flip,capabilities}.test.ts` (updated), `tests/behaviour/providers/jira-closeout.test.ts` (new), `tests/behaviour/provider-capabilities.test.ts` (updated), `tests/fixtures/providers/conformance/jira/tenant.json` (updated).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-ticket-labels.test.ts`
- `bun test tests/behaviour/closeout-unassign.test.ts`
- `bun test tests/behaviour/closeout-owed-flip.test.ts`
- `bun test tests/behaviour/closeout-capabilities.test.ts`
- `bun test tests/behaviour/providers`
- `bun test tests/conformance`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add Jira closeout writes and label-preserving replace`

---

### Phase 6: Dedicated git branch/checkout seam, runtime confinement, and safety fixtures

**Goal**: Add the `@delivery-os/adapters/git` subpath and port for checkout restore, branch enumeration/deletion, and safety queries; admit it as one exact runtime-confinement entry; prove the read-only `repo` reader remains no-spawn. No closeout engine or CLI yet.

**Tasks**:

- [ ] **6.1** Create `packages/adapters/src/git/index.ts` with PIN-16: `createGitBranchSeam(options)` and the `GitBranchSeam` methods `readCheckout`, `listBranches`, `readBranch`, `isCheckedOutElsewhere`, `isClean`, `resolveRef`, `restoreCheckout`, `deleteBranch`. Use `execFile`/`spawn` with a fixed argv, no shell, no network, no arbitrary command; validate canonical refs/branch names; local-only. Credentials are not involved. (TC-041..052)
- [ ] **6.2** Update `packages/adapters/package.json` with the `./git` export and `#git/*` import; update `packages/cli/package.json` `workspaceImports` with `./git`; update `tests/structure/subpaths.test.ts` with `./git`; update `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` for `src/git/index.ts`. (TC-008)
- [ ] **6.3** Update `.dependency-cruiser.cjs` with one exact, reason-bearing `runtime-apis-confinement` entry for `^packages/adapters/src/git/`; add allowed and denied fixtures to `tests/boundaries/fixture-registry.json` and `tests/boundaries/fixtures/cases.ts`. Keep the read-only `repo` reader's existing `node:fs` allowance unchanged and add an explicit no-spawn AST assertion (no `node:child_process`, `Bun.spawn`, or `Deno.Command`) with a planted-spawn negative control. (TC-008, NFR-12)
- [ ] **6.4** Prove read-only isolation: `tests/structure/closeout-imports.test.ts` scans `status`, `queue ready`, and `verify change` for imports of the closeout engine, provider write path, or git seam and for spawn/write members; the existing zero-write/zero-spawn suites remain green. (TC-007)
- [ ] **6.5** Add the temp-git harness (`mkdtemp` + `git init` + commits/branches/worktrees) and the full BR-01..BR-12 cases: clean restore, already-on-base, unrelated checkout, dirty worktree, missing base, matching head delete, moved head refuse, protected refs, foreign worktree, already-absent, ambiguity, unknown head, provider-failure interaction. (TC-041..052)
- [ ] **6.6** Add `tests/behaviour/closeout-checkout.test.ts` (TC-041..044) and `tests/behaviour/closeout-branch.test.ts` (TC-045..052); assert recorded arguments (base ref, branch name), not inferred side effects; assert no remote/fetch/push call. (TC-041..052)
- [ ] **6.7** Run the boundary and confinement evidence: `bun test tests/structure/closeout-imports.test.ts`, `bun test tests/boundaries`, `pnpm check:boundaries`, `bun run scripts/checks/workspace-entrypoints.ts`. (TC-007, TC-008)

**Acceptance Criteria**:

- Must: checkout restore targets the resolved base (merged target, else `main-tools`), already-on-base is `satisfied`, unrelated checkout is `satisfied` with `already-elsewhere`, and dirty/missing-base refuses with `closeout.branch.unsafe` and no deletion (AC-F9-1..4).
- Must: a squash-merged branch with matching merged head deletes once and touches no remote; a moved head refuses; protected refs are never attempted; a foreign worktree refuses; already-absent is `satisfied`; ambiguity is `closeout.target.ambiguous`; unknown head refuses (AC-F10-1..8, NFR-13).
- Must: the git seam is the only new spawn surface; the read-only `repo` reader remains no-spawn; `status`/`queue ready`/`verify change` import neither the seam nor the write path (AC-F15-1, NFR-5).
- Must: no remote branch operation, force push, or history rewrite exists (NG-2).
- Should: every safety predicate has a positive and a negative fixture; the boundary meta-check fails an unregistered or unenforced case.

**Files and modules**:

- Code areas: `packages/adapters/src/git/index.ts` (new), `packages/adapters/package.json` (updated), `packages/cli/package.json` (updated), `.dependency-cruiser.cjs` (updated), `tests/structure/{subpaths,inventory,content-inventory,closeout-imports}.test.ts` (updated/new), `tests/boundaries/{fixture-registry.json,fixtures/cases.ts}` (updated), `tests/behaviour/closeout-{checkout,branch}.test.ts` (new), `tests/fixtures/closeout/branch.ts` (new).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-checkout.test.ts`
- `bun test tests/behaviour/closeout-branch.test.ts`
- `bun test tests/structure/closeout-imports.test.ts`
- `bun test tests/structure/subpaths.test.ts`
- `bun test tests/boundaries`
- `pnpm check:boundaries`
- `bun run scripts/checks/workspace-entrypoints.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add git branch/checkout seam with confinement`

---

### Phase 7: CLI `closeout` command, composition, rendering, and changeset

**Goal**: Deliver the command surface and composition: grammar, plan/apply, rendering, envelope, exit projection, command registration, inventory, and the five-package changeset. The handler delegates; the CLI edge owns rendering and exit.

**Tasks**:

- [ ] **7.1** Create `packages/cli/src/commands/closeout.ts` with PIN-17: `CloseoutCommandRuntime` (`plan(input)`, `apply(input)`), `createCloseoutCommandDefinition` (flags `["--apply"]`, `positionals: { max: 2 }`, handler validates exactly one canonical `PREFIX-NUMBER` ref and rejects extras with `input.value.rejected`; `--apply` is the only mutation switch; the handler never inspects `--json`; `humanText: renderCloseoutHuman`). (TC-010..012, TC-059..061)
- [ ] **7.2** Export the definition from `packages/cli/src/commands/index.ts`; add `CloseoutComposition` and `createCloseoutCommandRuntime` in `packages/cli/src/edge.ts`, composing the provider runtimes (GitHub/Jira/GitLab), the git seam, the state store, the injected clock, and the fence-token factory; register `commands.closeout` in `createConfigProgram` only when the composition is supplied. (TC-010, TC-011)
- [ ] **7.3** Preserve read-only composition: `createProductionDependencies`, the `status`/`queue`/`verify` runtimes, and the existing command definitions are unchanged; the closeout handler is the only new entry point. (TC-007)
- [ ] **7.4** Implement the plan/apply boundary: plan performs zero provider writes, zero git mutations, zero state appends, zero fence acquisitions; apply acquires the fence, executes the plan, persists outcomes, and releases the fence; failures return the classified identity and the CLI projects the exit. (TC-010, TC-011)
- [ ] **7.5** Update `tests/structure/inventory.json` and the `content-inventory` allowance for `cli/src/commands/closeout.ts`; keep `tests/structure/cli-edge-seam.test.ts` green (no ambient env read, no stream write outside the serializer). (D13; TC-007)
- [ ] **7.6** Add the golden/output tests: `tests/behaviour/closeout-output.test.ts` (TC-059..061), `tests/golden/closeout-envelope.test.ts`, `tests/golden/closeout-human.test.ts` with fixed clock/run id; assert one envelope, caps, deterministic truncation, no forbidden content, byte-identical human output. (TC-059..061)
- [ ] **7.7** Add `.changeset/gh-183-closeout-minor.md` with a `minor` bump for exactly the five fixed-group packages; run `bun run scripts/checks/changesets-group.ts` and `bun run scripts/checks/testkit-exclusion.ts`. (TC-009)

**Acceptance Criteria**:

- Must: `closeout <workItemRef>` without `--apply` returns a success envelope with the deterministic ordered plan and performs no mutation; `--apply` executes the same plan with per-operation outcomes (AC-F1-1/2, NFR-4).
- Must: malformed/missing ref or a stray positional fails as `input.value.rejected`, an unknown flag as `fallback.invocation`, both exit 1 with zero source/runtime calls (AC-F1-3).
- Must: machine output is exactly one bounded `delivery.closeout.v1` envelope; human output is byte-identical and within 200 lines/16 KiB; neither leaks forbidden content (AC-F13-1/2, NFR-7).
- Must: each closeout failure identity carries its documented fields and exits 1 or 2 by projection class; no exit literal exists outside the CLI projection (AC-F14-1, NFR-11).
- Must: the changeset is a minor for the five fixed-group packages; `testkit` is excluded (NFR-10, TC-009).

**Files and modules**:

- Code areas: `packages/cli/src/commands/closeout.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/behaviour/closeout-output.test.ts` (new), `tests/golden/closeout-*.test.ts` (new), `.changeset/gh-183-closeout-minor.md` (new).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-plan.test.ts`
- `bun test tests/behaviour/closeout-output.test.ts`
- `bun test tests/golden/closeout-envelope.test.ts tests/golden/closeout-human.test.ts`
- `bun test tests/structure/cli-edge-seam.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun run scripts/checks/changesets-group.ts`
- `bun run scripts/checks/testkit-exclusion.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add closeout command, composition and release intent`

---

### Phase 8: Integration, provider failure/local restore, output/no-leak, isolation, non-vacuity, and full battery

**Goal**: Prove the transaction end to end across steps and failure paths, prove read-only isolation and bounded output, prove the non-vacuity of every negative/gap/cap/refusal guard, and run the full offline battery.

**Tasks**:

- [ ] **8.1** Add `tests/behaviour/closeout-integration.test.ts` covering spec §6 flows 1–6: dry-run plan with zero mutation; apply happy path in order; re-run after restart with zero duplicates; declared-gap transaction (GitLab-style) exiting 0; safety refusal retaining the branch; provider write failure still restoring the checkout safely and retaining the branch, then converging on re-run. (TC-010, TC-011, TC-015..017, TC-040, TC-052, TC-056)
- [ ] **8.2** Add `tests/behaviour/closeout-hermetic.test.ts` and extend `tests/checks/fixture-sanitization.test.ts`: no live network/credentials/host-env reads; the throwing-fetch guard sees zero calls; the planted canary is present in fixtures and absent from output/ledger; the ledger evidence contains no forbidden content. (TC-059, TC-060, TC-062)
- [ ] **8.3** Add `tests/checks/closeout-mutants.test.ts` and `tests/fixtures/closeout/mutants/**`: each broken guard (label disposition, unknown-blocker, merged-head equality, protected set, worktree-blind delete, gap-as-success, wide projection, terminal-reuse bypass, `Date.now()` plan, read-only import/spawn, success-on-partial) fails the intended suite naming the case; an unchanged control passes. (TC-064)
- [ ] **8.4** Prove bounded work: owed-flip at 200/201/larger; threads at 100/101; the 30 s operation timeout constant is referenced; the reference-fixture p95 is recorded or "not run" (non-CI per GAP-T2); no unbounded wait. (TC-035, TC-037, TC-063)
- [ ] **8.5** Prove read-only isolation and capability honesty in the integrated tree: `tests/structure/closeout-imports.test.ts` (TC-007/008), `tests/behaviour/closeout-capabilities.test.ts` (TC-053..056), the unchanged `status`/`queue ready`/`verify change` suites, and `pnpm check:boundaries`. (TC-007, TC-008, TC-053..056)
- [ ] **8.6** Run the full offline battery and record results with commands, HEAD, and environment: `pnpm install --frozen-lockfile` → `pnpm build` → `bun test tests/structure tests/behaviour` → `bun test tests/checks` → `bun test tests/boundaries` → `bun test tests/golden` → `bun test tests/conformance` → `bun run scripts/checks/{error-table-sync,exit-code-literals,ambient-globals,secret-read-boundary,workspace-entrypoints,license-audit,vulnerability-gate}.ts` → `pnpm check:boundaries` → `pnpm typecheck` → `pnpm check` → `bash scripts/.tests/test-doc-distribution.sh` → `git diff --check` → `git status --porcelain`. (All TCs; TC-009, TC-062, TC-064)

**Acceptance Criteria**:

- Must: all six spec flows are evidenced, including the provider-failure/local-restore interaction and the restart convergence (AC-F3-1/2, AC-F10-8, NFR-1).
- Must: the battery is offline and hermetic; no live provider, credential, socket, or network call exists; the canary proves the no-leak boundary (AC-NFR3-1, NFR-3, NFR-12).
- Must: every negative/gap/cap/refusal guard has a paired live control and a mutant that fails naming the case (TC-064, §4.2).
- Must: read-only commands still perform zero writes and zero spawns and import neither the git seam nor the provider write path (AC-F15-1, NFR-5).
- Must: bounded work is asserted in CI (caps, invariant counts, declared timeouts); the reference p95 is recorded or explicitly "not run", never claimed (NFR-6, GAP-T2).
- Must: `pnpm check` is green in a clean checkout; the license gate is green with zero new dependencies (AC-NFR10-1, NFR-10).

**Files and modules**:

- Code areas: `tests/behaviour/closeout-integration.test.ts` (new), `tests/behaviour/closeout-hermetic.test.ts` (new), `tests/checks/closeout-mutants.test.ts` (new), `tests/fixtures/closeout/{canary,plan,dependents,threads,golden,mutants}` (new/updated), `tests/checks/fixture-sanitization.test.ts` (updated), `tests/structure/closeout-imports.test.ts` (updated), `tests/behaviour/closeout-capabilities.test.ts` (updated).
- System docs: none (Phase 11).

**Tests**:

- The full battery in task 8.6; per-TC evidence recorded in the plan Execution Log and the test plan §10.

**Completion signal**: `test(GH-183): add closeout integration, hermeticity and non-vacuity evidence`

---

### Phase 9: Code Review (Analysis)

**Goal**: Independently audit the delivered change against the spec, plan, and test plan without modifying implementation during analysis.

**Tasks**:

- [ ] **9.1** PM delegates independent analysis to `@reviewer`: trace all 58 ACs and 64 TCs to code and non-vacuous evidence; inspect capability honesty (GitHub/Jira/GitLab matrices), idempotency (terminal reuse, crash convergence, failed retry), branch safety (BR-01..BR-12), output/no-leak, read-only isolation, conformance registry/write execution, the transport widening, and the git confinement entry. (All TCs)
- [ ] **9.2** Record findings and verdict through the review artifact workflow; route implementation findings to Phase 10 and decision-class findings (contract reshape, allowlist growth, basis change) to PM and `@decision-advisor` — never a silent alternative. (All TCs)

**Acceptance Criteria**:

- Must: reviewer produces a traceable PASS or actionable findings with no fabricated evidence; `@runner` reproduces questionable evidence rather than assuming passes.
- Must: any missing evidence or non-firing negative control is unfinished work; no severity downgrade to pass the gate.

**Files and modules**:

- Code areas: none (read-only analysis of Phases 1–8).
- System docs: none during analysis.

**Tests**:

- Evidence inspection for all 64 TCs; reproduction of sampled suites/mutations.

**Completion signal**: independent verdict recorded; PASS advances to Phase 11, findings activate Phase 10.

---

### Phase 10: Post-Code Review Fixes (conditional)

**Goal**: Close accepted review findings without scope expansion or regression loss.

**Tasks**:

- [ ] **10.1** If findings exist: reproduce each via the relevant TC/negative fixture, add the missing regression first, then apply the smallest fix; preserve behavior outside the accepted slice. Fix code, catalogs, fixtures, and registries together; a contract-shape dispute routes through `@decision-advisor`, never a silent reshape. (Affected TCs)
- [ ] **10.2** Re-run the affected suites and the Phase 8 battery; PM delegates `@runner` repetition and independent re-review until PASS. If no findings, record the phase as not required with the Phase 9 PASS as evidence. (All TCs)

**Acceptance Criteria**:

- Must: all accepted findings closed; affected ACs remain traceable; previously green controls stay green.
- Must: no waived check, no undocumented scope expansion, no unresolved blocker; `pnpm check` green.

**Files and modules**:

- Code areas: only affected Phase 1–8 files and their regressions; no blanket cleanup.
- System docs: only if a review finding is documentation-class and belongs to Phase 11.

**Tests**:

- Reproduce failing TC cases; re-run affected suites, then the Phase 8 battery.

**Completion signal**: `fix(GH-183): close review findings` or explicit not-required state backed by Phase 9 PASS.

---

### Phase 11: Documentation & Spec Synchronization (handoff to `@doc-syncer`)

**Goal**: Reconcile `doc/spec/**` and the command registry with the delivered closeout surface. This is the lifecycle `system_spec_update` handoff; it authors the always-resolve closeout feature spec and removes stale claims from the affected specs.

**Tasks**:

- [ ] **11.1** Author `doc/spec/features/feature-closeout.md` (always-resolve) covering the command surface, the seven ordered steps and expansion rules, deterministic identity and terminal reuse, the `closeout.operation` ledger, provider capability/gap matrices, merged-request lookup and `headSha`, checkout restore and the squash-safety predicate, bounded output/evidence, the four error identities, and the offline proof. Link TDR-0008 and this plan. (All ACs)
- [ ] **11.2** Reconcile `doc/spec/features/feature-adapter-ports.md`: the `DeliveryRequest.headSha` row (optional, absent = unknown), the `resolve-delivery-thread` operation and canonical arguments, the updated capability table, the additive-within-v1 evolution note, and the TDR-0008 link. (AC-F11, AC-F12, DM-5, DM-8)
- [ ] **11.3** Reconcile `doc/spec/features/feature-provider-client-seeds.md`: GitHub/Jira write slices, the GraphQL thread-resolution mutation, the bounded reverse-dependent reads, GitLab merged-head normalization, the transport method/body widening (no new transport), and the trap-catalog additions. (AC-F4, AC-F5, AC-F6, AC-F7, AC-F8, AC-F12)
- [ ] **11.4** Reconcile `doc/spec/features/feature-state-layer.md`: the `closeout.operation` record kind, payload schema `delivery.closeout.operation.v1`, key prefix `closeout.operations:`, first-terminal authority, fenced append/verified read, torn/malformed classification, and no schema bump. (AC-NFR8-1, DM-4, EVT-1)
- [ ] **11.5** Reconcile `doc/spec/features/feature-result-contract.md`: verify the `closeout` kind and four rows from Phase 1 are exact and bidirectionally synced; confirm existing projection classes and exit literals-only-in-CLI. (AC-F14-1/2, NFR-11)
- [ ] **11.6** Reconcile `doc/spec/features/feature-adapter-conformance.md`: the new flow step/operation, the 13-step/8-operation registry, production write execution in mock, the expanded mock-tenant routes, and the live read-only skip. (TC-002, NFR-9)
- [ ] **11.7** Verify the command registry and index: `doc/planning/oss-tooling/cli-command-registry.md` already lists `closeout` under the Deliver family and ODR-0003 locks the name; update only if the delivered grammar differs. Add `feature-closeout.md` to `doc/00-index.md` if the index enumerates feature specs. Confirm no new `ados_distribution` marker is required for `doc/spec/**` (project-specific, not distributable). (All ACs)
- [ ] **11.8** Run the documentation gates: `bash scripts/.tests/test-doc-distribution.sh`; `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/privacy-literals.ts`; scan the reconciled docs for stale step/operation counts, stale gap reasons, and stale read-only claims. If `feature-closeout.md` or another reconciled doc contains a registered brand/forbidden literal, add it to the `registered` list in `scripts/checks/forbidden-literals.registry.json` (and update the corpus baseline only if the guard requires it); otherwise record that no registry change is needed. (NFR-10, NFR-12)

**Acceptance Criteria**:

- Must: the new closeout feature spec exists and describes the delivered behavior, identities, capabilities, safety predicate, output, and errors without inventing requirements.
- Must: every affected system spec is reconciled; no stale claim contradicts the delivered surface; the conformance doc reflects 13 steps / 8 operations and write execution.
- Must: `test-doc-distribution.sh` is green; forbidden/privacy literal checks are green; no `doc/business/**` content is created.
- Should: the command registry needs no edit because ODR-0003 already locks the name; record the verification.

**Files and modules**:

- Code areas: none (documentation only).
- System docs: `doc/spec/features/feature-closeout.md` (new), `feature-adapter-ports.md`, `feature-provider-client-seeds.md`, `feature-state-layer.md`, `feature-result-contract.md`, `feature-adapter-conformance.md` (updated), `doc/planning/oss-tooling/cli-command-registry.md` (verify/update), `doc/00-index.md` (if indexed).

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh`
- `bun run scripts/checks/forbidden-literals.ts`
- `bun run scripts/checks/privacy-literals.ts`
- `bun test tests/checks/forbidden-literals.test.ts tests/checks/privacy-literals.test.ts`
- Manual stale-claim scan of the reconciled specs.

**Completion signal**: `docs(GH-183): reconcile closeout and affected system specs`

---

### Phase 12: Finalize and Release

**Goal**: Verify version intent, run the final ordered gate battery, complete the DoD checklist with current evidence, record the execution log, and hand the change to lifecycle phase 11 (`@pr-manager`) as an open unmerged PR to `main-tools`. This plan does not push or open a PR.

**Tasks**:

- [ ] **12.1** Verify the changeset: `.changeset/gh-183-closeout-minor.md` covers exactly the five fixed-group packages with `minor`; `bun run scripts/checks/changesets-group.ts` and `bun run scripts/checks/testkit-exclusion.ts` are green; no hand-bump, no publish, `testkit` untouched. (NFR-10, TC-009)
- [ ] **12.2** Run the final ordered battery and record commands/results/tested SHA: `pnpm install --frozen-lockfile` → `pnpm build` → `bun test tests/structure tests/behaviour` → `bun test tests/checks` → `bun test tests/boundaries` → `bun test tests/golden` → `bun test tests/conformance` → `bun run scripts/checks/{error-table-sync,exit-code-literals,ambient-globals,secret-read-boundary,workspace-entrypoints,license-audit,vulnerability-gate}.ts` → `pnpm check:boundaries` → `pnpm typecheck` → `pnpm check` → `bash scripts/.tests/test-doc-distribution.sh` → `git diff --check` → `git status --porcelain`. If a gate fails, reopen Phase 10 and re-run; never record an unrun gate as passing. (All TCs)
- [ ] **12.3** Complete the DoD checklist: all 58 ACs have passing traceable evidence; all 64 TCs are mapped and executed; the four error rows are 4/4 synced; the exit-literal invariant is green; the conformance registry is 13/8 with write execution; read-only isolation is green; the BR matrix has positive/negative evidence; branch deletion never occurs on an unsafe fixture; the no-leak canary is present then absent; zero new dependencies; the license gate is green; the system docs are reconciled; the changeset is present; the tree is clean. Record divergences for escalation rather than rewriting requirements. (All ACs)
- [ ] **12.4** Record the plan Execution Log and the test plan §10 evidence with commands, HEAD, environment, and the optional non-CI reference measurement ("not run" if absent). Record rollback/scope proof: additive-only change; revert phase commits as one coherent unit; no persisted-state migration; no new runtime location; no protected-path edits; `git diff --name-only` limited to this change's surface. (All TCs)
- [ ] **12.5** Hand off to lifecycle phase 11: state that PR creation, assignment, and CI-on-pushed-HEAD are `@pr-manager` responsibilities and remain owed until the PR is open against `main-tools`. Do not push, open, or merge in this plan. (All ACs)

**Acceptance Criteria**:

- Must: the changeset is a minor for the five fixed-group packages; no new dependency; the license gate is green.
- Must: the final battery is green at the recorded SHA; every gate has a recorded command and result; no unrun gate is claimed.
- Must: every DoD predicate has current evidence or an explicit owner/handoff; the tree is clean; the PR/CI predicate is explicitly handed to lifecycle phase 11.
- Should: the execution log names the exact commits per phase and the optional reference measurement status.

**Files and modules**:

- Code areas: `.changeset/gh-183-closeout-minor.md` (verified), `this plan` Execution Log, `chg-GH-183-test-plan.md` §10 (evidence).
- System docs: none (Phase 11).

**Tests**:

- The final battery in task 12.2; no separate execution is claimed by this plan.

**Completion signal**: `chore(GH-183): record final gates, DoD evidence and release handoff`

---

## Test Scenarios

The test plan owns the scenario detail (§5.2) and the normative case table (§4.3). This plan groups them by delivering phase; the full TC-to-phase map is in Traceability above.

| Scenario group | TC IDs | Phase(s) | AC anchor |
|---|---|---|---|
| Contract vocabulary, additive extensions, conformance registry, error identities | TC-001..006 | 1, 4, 5 | AC-F2-2, AC-F5-1, AC-F10-3, AC-F11-1..3, AC-F12-3, AC-F14-1/2 |
| Read-only isolation, tier/purity, confinement, zero dependencies | TC-007..009 | 6, 8, 12 | AC-F15-1, AC-NFR10-1, NFR-5, NFR-10 |
| Dry-run/apply plan, grammar, determinism, operation expansion | TC-010..014 | 2, 7, 8 | AC-F1-1..3, AC-F2-1..3, AC-F3-4 |
| Restart, crash, failed retry, identity, ledger | TC-015..019 | 2, 3 | AC-F3-1..4, AC-NFR8-1 |
| Ticket-to-done and lifecycle labels | TC-020..026 | 4, 5 | AC-F4-1..3, AC-F5-1..4 |
| Unassign | TC-027..030 | 4, 5 | AC-F6-1..4 |
| Owed-flip sweep and cap | TC-031..036 | 4, 5, 8 | AC-F7-1..6 |
| Comment resolution and GraphQL | TC-037..040 | 4, 8 | AC-F8-1..4 |
| Checkout restore and branch cleanup | TC-041..052 | 6, 8 | AC-F9-1..4, AC-F10-1..8 |
| Provider capability parity and gaps | TC-053..056 | 1, 4, 5, 8 | AC-F11-1..4 |
| Merged-request lookup and `headSha` | TC-006, TC-057..058 | 1, 4 | AC-F12-1..3 |
| Machine/human output, error projection | TC-059..061 | 2, 7, 8 | AC-F13-1/2, AC-F14-1 |
| Offline/hermetic proof, bounds, non-vacuity meta-check | TC-062..064 | 8 | AC-NFR3-1, NFR-3, NFR-6, NFR-12 |

## Artifacts and Links

| Artifact | Location | Type / handling |
|---|---|---|
| Change specification | [chg-GH-183-spec.md](./chg-GH-183-spec.md) | Source of requirements; read-only |
| Test plan | [chg-GH-183-test-plan.md](./chg-GH-183-test-plan.md) | Source of the 64 TCs and oracles; read-only |
| PM notes | [chg-GH-183-pm-notes.yaml](./chg-GH-183-pm-notes.yaml) | Orchestration context; read-only |
| This plan | [chg-GH-183-plan.md](./chg-GH-183-plan.md) | The only file written by this authoring pass |
| TDR-0008 | [../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md](../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) | Governs `headSha` and `resolve-delivery-thread`; owner acceptance rides the GH-183 PR |
| ADR-0003 | [../../../decisions/ADR-0003-oss-monorepo-structure.md](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Tiers, purity, runtime confinement, idempotency |
| ADR-0004 / ADR-0006 | [../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) | Absence semantics (`headSha`, labels, assignee, comments) |
| ADR-0005 | [../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) | Provider-client confinement and the exact git-seam entry |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Layers, gates, permanent-suite rules |
| TypeScript rules | [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) | Strict typing, purity, injected time/randomness/environment, error contract |
| Changeset | `.changeset/gh-183-closeout-minor.md` | Five-package minor; no publish |
| New system spec | `doc/spec/features/feature-closeout.md` | Authored by `@doc-syncer` in Phase 11 |
| Reconciled system specs | `doc/spec/features/{feature-adapter-ports,feature-provider-client-seeds,feature-state-layer,feature-result-contract,feature-adapter-conformance}.md` | Phase 11 |
| Sibling plans | GH-180, GH-188, GH-189 under `doc/changes/2026-10/**` | Shape/precedent only, not requirements |
| Ticket | GH-183 — M0-S14: closeout v1 with branch cleanup | External reference |

Protected paths untouched by every phase: `scripts/*.sh`, `scripts/checks/secret-read-boundary.ts`, `tools/`, `.opencode/`, `.ados-claude/`, the bash CI jobs, and `.github/workflows/ci.yml`. No product/binary name is hardcoded; user-facing strings use the injected `brand.binaryName`.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-01T05:15:00Z | Implementation Plan Writer | Initial twelve-phase, 69-task plan derived from spec v1.1 and test plan v1.0. Pins the delivery-bound spellings (contract/domain/state modules, seven step ids, eight operation names, canonical arguments, outcome/gap vocabulary, label/protected-ref data, caps, adapter/client/git/CLI names, conformance step, fixtures, changeset); records the conformance write-execution integration obligation and the transport widening; maps all 64 TCs and 58 ACs to phases; keeps the whole battery offline and fixture-driven. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Planned | — | — | — | Contracts, additive extensions, error identities, conformance registry |
| 2 | Planned | — | — | — | Pure planner/domain |
| 3 | Planned | — | — | — | Idempotency ledger |
| 4 | Planned | — | — | — | GitHub writes/reads/threads/reverse dependents |
| 5 | Planned | — | — | — | Jira writes/label replace/reverse dependents |
| 6 | Planned | — | — | — | Git seam and confinement |
| 7 | Planned | — | — | — | CLI command, composition, changeset |
| 8 | Planned | — | — | — | Integration, hermeticity, non-vacuity, full battery |
| 9 | Planned | — | — | — | Code review (analysis) |
| 10 | Planned | — | — | — | Post-review fixes (conditional) |
| 11 | Planned | — | — | — | Documentation and system-spec synchronization |
| 12 | Planned | — | — | — | Finalize and release handoff |
