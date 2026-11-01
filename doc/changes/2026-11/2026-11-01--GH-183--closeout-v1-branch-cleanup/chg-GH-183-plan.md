---
id: chg-GH-183-closeout-v1-branch-cleanup
status: Updated
created: 2026-11-01T05:15:00Z
last_updated: 2026-11-01T10:20:00Z
owners: [engineering]
service: delivery-os
labels: [cli, providers, git, idempotency, state]
links:
  change_spec: ./chg-GH-183-spec.md
  test_plan: ./chg-GH-183-test-plan.md
  pm_notes: ./chg-GH-183-pm-notes.yaml
  decisions:
    - ../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md
    - ../../../decisions/ODR-0003-cli-command-naming-v1-lock.md
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

This plan implements the remediated change specification (`chg-GH-183-spec.md`, v1.3: F-1–F-15, AC-F1-1–AC-NFR10-1 (61), NFR-1–NFR-13, DM-1–DM-11, EVT-1/EVT-2, DEC-1–DEC-16, RSK-1–RSK-13, §6 flows 1–7, §8 interfaces, Appendices A–E) and the remediated test plan (`chg-GH-183-test-plan.md`, v1.2: 67 TCs, TC-CLOSE-001..TC-CLOSE-067, 61/61 AC coverage, §4 binding oracles — including the completed §4.1 harness contract and the BR-13/BR-14 ownership split — §4.9 grammar case G-09, §5.2 scenario detail, §7 automation and evidence commands; TC-018 carries the SHA-256 KAT/algorithm evidence and TC-063 the structural plus behavioral timeout evidence). Both are present in the change folder. TDR-0008 governs the two additive adapter-contract extensions and its owner acceptance rides the GH-183 PR review; ODR-0003 is a separate proposed naming lock whose owner acceptance is the GH-186 PR review and which grants no naming authority until then. This plan derives every task, path, command, and gate from those sources and adds no product requirement. The operation identity is ADR-0003's identity inputs plus the additive `capabilityContext` refinement recorded change-level in DEC-7; because no prior closeout operation ids exist, no separate ADR-0003 addendum is required for v1. Revisit note: if the identity formula is later treated as system-level (reused beyond closeout or by a second consumer), raise an ADR-0003 addendum through `@decision-advisor` rather than extending DEC-7 again. The GitHub bounded reverse-dependent surface is an implementation-confirmed assumption: an absent surface yields a provider-level `skipped-gap`, while a present-but-unavailable signal yields a signal-level `skipped-noop` with `relation-signal-unavailable`.

**What this change delivers.** One Deliver-family command, `closeout <workItemRef> [--apply] [--json]`, that computes a deterministic seven-step transaction in plan mode and applies the same transaction only with `--apply`. Every operation carries a deterministic identity and persists one terminal outcome in the existing append-only state ledger, so a re-run after a restart reuses terminal outcomes, a crash between a provider effect and the ledger append converges as `satisfied`, and a persisted `failed` outcome is re-observed and retried safely. GitHub gains issue close, label add/remove, assignee clear, merged-PR lookup plus merged head, review-thread resolution through GraphQL behind the existing injected transport, and a bounded reverse-dependent read. Jira gains a data-driven done transition, a full-array label replace that preserves unnamed labels, assignee clear, and a bounded reverse-dependent query. GitLab remains read-only, gains merged-head normalization where the provider exposes it, and declares every write (including `resolve-delivery-thread`) as a gap. Closeout-relevant reads return a discriminated observation (`observed` / `not-found` / `unavailable` / `invalid`) so a provider not-found is not confused with a malformed payload and an unasserted relation signal is never read as an empty set. A dedicated `@delivery-os/adapters/git` subpath performs checkout restore and local branch deletion behind a port, with the full squash-safety predicate. Four additive `closeout` error identities join the existing result contract and documented table. Every provider request and git child process is bounded by the declared 30 s operation timeout. The full battery is offline and fixture-driven.

**Settled inputs — this plan does NOT re-decide them.** DEC-1 (command name and read-only guarantees), DEC-2 (seven-step order and harness telemetry out of scope), DEC-3 (GitHub/Jira writes; GitLab gaps; local-only branch cleanup), DEC-4 (dry-run default; `--apply` only), DEC-5 (owed-flip definition), DEC-6 (thread resolution via GraphQL on GitHub; gaps elsewhere), DEC-7 (deterministic identity, terminal reuse, failed retry, and the additive `capabilityContext` refinement over ADR-0003's identity inputs), DEC-8 (dedicated git seam; read-only reader untouched), DEC-9 (merged target ref else `main-tools`; protected refs), DEC-10 (label disposition), DEC-11 (provider-operation vocabulary), DEC-12 (`headSha` absent means unknown; refusal on unknown), DEC-13 (deterministic merged-request selection), DEC-14 (gaps/no-ops non-fatal; failure/refusal classes), DEC-15 (`closeout` kind, four rows, existing projection classes), DEC-16 (caps 200/100, convergent re-runs). TDR-0008 fixes both additive extensions, no schema-version bump, and the conformance-registry obligation; its owner acceptance is the GH-183 PR review. ODR-0003 is a separate proposed naming lock whose owner acceptance is the GH-186 PR review and which grants no naming authority until then. OQ-2 is PM-resolved: v1 posts no closure comment; `write-comment` remains a gap on every provider.

**Code-reality facts this plan relies on (verified 2026-11-01).**

- The contracts tier is types plus `as const` data only (`packages/core/src/contracts/**`); `DeliveryRequest` currently has `identity`, `sourceRef`, `targetRef`, `reviewState`, `threads` and no head field (`ports.ts`). `ADAPTER_OPERATIONS` is the closed seven-operation set (`adapter-capabilities.ts`).
- The three provider seeds live at `packages/adapters/src/{github,jira,gitlab}/**` with `*_ADAPTER_CONTRACT` declarations; GitHub and Jira use an injected `ProviderTransport` whose `ProviderRequest.method` is `"GET"` only and which has no body field. Each client has a native-`fetch` default transport and resolves credentials only through the injected `CredentialPort`.
- The read-only repository adapter `packages/adapters/src/repo/index.ts` reads `.git` metadata through an injected `RepositoryIo` and never spawns a process. It has no branch mutation surface.
- The state store port (`packages/core/src/contracts/state.ts`) exposes `read`, `append(handle, request)`, `acquireFence`, `releaseFence`, `replaceDocument`, `checkIntegrity`, `repairTornTail`. Record kinds are consumer strings; `delivery.state.v1` is the schema and needs no bump for an additive kind.
- The error table (`packages/core/src/contracts/error-table.ts`) declares `DOMAIN_KINDS` and `ERROR_TABLE`; the documented table lives in `doc/spec/features/feature-result-contract.md`. `tests/structure/error-table.test.ts` asserts exactly 35 entries and the declared-kind prose; a closeout addition is an additive test update (39 entries).
- The conformance flow registry (`packages/testkit/src/conformance/flows.ts`) has exactly three flows and twelve steps; `tests/structure/conformance-coverage.test.ts` asserts twelve steps and exact operation-set equality. The runner (`packages/testkit/src/conformance/runner.ts`) currently fails closed on a supported non-read step without a test-only `writeHandler`, and `runtimeCoverageViolations` requires every supported operation to execute in mock mode (`packages/testkit/src/conformance/coverage.ts`). Making GitHub/Jira writes supported therefore requires production write execution in the mock tier, not only a registry step. The two conformance controls that exercise that branch are `tests/conformance/broken-adapter-control.test.ts` (its `corruptRegistration` currently returns a read-only client, so it must preserve write members or supply a `writeHandler` once GitHub writes become supported) and `tests/conformance/live/live-entrypoint.test.ts` (its mock-tier inline transport matches by URL only and must become method-aware). All three conformance controls hardcode a seven-operation `ALL_OPERATIONS`/`gapsExcept` helper (and `broken-adapter-control.test.ts` an explicit `declaredGaps` list), so appending an eighth operation requires updating them in Phase 1; otherwise any registration that does not support the new operation reaches it with no declared gap and `failClosed` throws before a report exists.
- `tests/behaviour/providers/support.ts` `FixtureRoute` currently has only `url`/`body`/`status` and `createFixtureTransport` matches by URL only; `readWorkItem`'s return shape is consumed by `tests/types/provider-views.type-test.ts`, `tests/behaviour/providers/*`, and `packages/testkit/src/conformance/types.ts`.
- `packages/cli/src/index.ts` owns the shared parser and envelope/exit projection; `packages/cli/src/commands/index.ts` exports command definitions; `packages/cli/src/edge.ts` composes runtimes and registers commands in `createConfigProgram`. The `db` command (`packages/cli/src/commands/db.ts`) is the mutating-command precedent: dry-run by default, `--apply` for mutation, handler-owned parsing, no exit literal.
- `tests/structure/inventory.json` lists every source file; `tests/structure/content-inventory.test.ts` holds per-file executable allowances; `tests/structure/port-neutrality.test.ts` scans the contracts tier; `tests/structure/cli-edge-seam.test.ts` scans the CLI for ambient environment reads and stream writes; `tests/structure/subpaths.test.ts` pins declared subpaths; `tests/structure/provider-surface.test.ts` pins each provider subpath's exported names.
- `scripts/checks/error-table-sync.ts` synchronizes `ERROR_TABLE` with the documented table; `scripts/checks/exit-code-literals.ts` enforces exit literals only in the CLI projection; `scripts/checks/secret-read-boundary.ts` holds exactly four allowlist entries; `scripts/checks/forbidden-literals.ts` and `scripts/checks/privacy-literals.ts` gate brand/cloud leakage. `.changeset/config.json` fixes the five publishables (`core`, `adapters`, `cli`, `mcp`, `opencode`) and excludes `testkit`.
- `.dependency-cruiser.cjs` has a `runtime-apis-confinement` rule with exact, reason-bearing adapter I/O entries; `tests/boundaries/fixture-registry.json` and `tests/boundaries/fixtures/cases.ts` require a positive and a negative fixture for every rule.

**Sibling deliveries used for shape, not for requirements.** GH-180 (db command) supplies the mutating-command grammar/envelope/evidence shape; GH-188 (provider seeds) supplies the trap-catalog and credential-port discipline; GH-189 (conformance suite) supplies the flow registry, mock-tenant, runtime-coverage and artifact discipline; GH-175/GH-182 supply the read-only status/queue/verify guarantees.

### Open questions and recorded gaps

- **No blocking open question.** Test-plan OQ-T1 (delivery-bound spellings), OQ-T2 (GitLab merged head), OQ-T3 (GitHub GraphQL response shape), OQ-T4 (optional type probe) are resolved by the pins and bindings below. GAP-T1 (plan absent) is closed by this file. GAP-T2 (NFR-6 p95 is not a CI gate) remains recorded and is honoured in Phase 8/12. GAP-T3 (no-leak canary is a fixture obligation) is implemented in Phase 8. GAP-T4 (delivery-bound names) is resolved by the pinned spellings. GAP-T5 (NFR-6/NFR-12 have no dedicated AC) is mapped to the qualifying ACs in the traceability table.
- **Conformance runtime-coverage obligation (blocking for delivery, now a test-plan TC).** TC-CLOSE-065 asserts the existing `runtimeCoverageViolations` invariant over the newly supported writes: `write-work-item`, `transition-work-item`, and `resolve-delivery-thread` must execute in the mock conformance tier for every provider that declares them supported. Phase 1 adds the step and keeps the new operation a gap; Phases 4/5 add the production write execution and routes in the same commit as each capability flip; Phase 8 proves the integrated matrix with `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` empty and no provider/operation violation.
- **Delivery-bound transport shape (non-blocking):** the spec says thread resolution rides the existing injected transport, while the current `ProviderRequest` is `GET`-only with no body. This plan widens the transport additively (methods, optional body, optional timeout) and keeps the live conformance tier read-only (non-GET is a failure there). No new transport or network location is introduced.
- **Provider read observations and reverse-dependent signals (resolved by spec v1.3).** Closeout-relevant reads return `observed` / `not-found` / `unavailable` / `invalid` (DM-11). An explicit provider not-found maps to `closeout.target.unobserved`; a malformed or unparsable payload remains `provider.payload.invalid` and is never remapped; no work-item read is a declared gap. For owed-flip, **no reverse-read surface** is a provider-level `skipped-gap` (`provider-unsupported`); a **surface that exists but whose current signal is unavailable or unknown** is `skipped-noop` with `relation-signal-unavailable` evidence and never flips; a candidate with an unavailable relation signal is skipped with evidence while observed candidates are evaluated. An unasserted `relations: []` is never treated as "no blockers". The GitHub bounded reverse-dependent (`issue-dependencies`) surface is an **implementation-confirmed assumption**, not verified current truth; its exact response shape is fixture-pinned, and the adapter/runtime must distinguish an absent surface (provider-level gap) from a present surface with an unavailable current read (signal-level skip).
- **Additive read-observation carrier (pinned in PIN-14/PIN-15).** The work-item observation is carried by the closeout-specific `readWorkItemObservation` member; the existing `readWorkItem` return shape is unchanged, so its consumers `tests/types/provider-views.type-test.ts` and `tests/behaviour/providers/*` need no edits. `packages/testkit/src/conformance/types.ts` is edited only additively in Phase 1.6 (the optional `writeWorkItem?`/`transitionWorkItem?`/`resolveDeliveryThread?` client members for the new conformance step); its `readWorkItem` typing and return shape stay unchanged, and it needs no edit for `readWorkItemObservation` unless the conformance client is later extended to expose it. If the existing `readWorkItem` shape is ever changed instead, all three areas are added to Phases 4/5.
- **Integration base pin (resolved by spec v1.2 and retained in v1.3).** The v1 base is the compiled contract constant `main-tools`; it is not configurable in v1. A merged delivery request's target ref takes precedence (the normal path for installed projects). The portability limit and the "add a configuration key" revisit trigger are recorded in DEC-9; no configuration key is invented.

## Pinned Delivery Spellings (PIN-1..PIN-20)

These pins resolve the delivery-bound spellings left open by test-plan GAP-T4/OQ-T1. Every value, order, identity input, bound, exit, and AC/TC mapping comes from the spec or test plan and may not be rebound. Changing a pin later reopens this plan; route a challenge through PM/`@decision-advisor`, never apply it silently.

| PIN | Pinned spelling (binding) |
|---|---|
| PIN-1 | **Contract module**: `packages/core/src/contracts/closeout.ts`; exports `CLOSEOUT_SCHEMA_ID = "delivery.closeout.v1"`, `CLOSEOUT_OPERATION_PAYLOAD_SCHEMA = "delivery.closeout.operation.v1"`, `CLOSEOUT_OPERATION_RECORD_KIND = "closeout.operation"`, `CLOSEOUT_STEP_IDS`, `CLOSEOUT_PLAN_OUTCOMES`, `CLOSEOUT_APPLY_OUTCOMES`, `CLOSEOUT_GAP_REASONS`, `CLOSEOUT_OPERATION_NAMES`, `CLOSEOUT_READ_OBSERVATIONS = ["observed", "not-found", "unavailable", "invalid"]`, `LIFECYCLE_LABEL_DISPOSITIONS`, `PROTECTED_REF_NAMES`, `CLOSEOUT_INTEGRATION_BASE = "main-tools"` (compiled v1 constant; portability limit and revisit trigger recorded in DEC-9), `OWNER_ATTENTION_LABEL = "hand-back"`, `BLOCKED_LABEL = "blocked"`, `DELIVERED_LABEL = "delivered"`, `CHANGE_LABEL = "change"`, plus the caps `CLOSEOUT_MAX_DEPENDENTS`, `CLOSEOUT_MAX_THREADS`, `CLOSEOUT_OPERATION_TIMEOUT_MS`, `CLOSEOUT_MAX_MACHINE_BYTES`, `CLOSEOUT_MAX_HUMAN_LINES`, `CLOSEOUT_MAX_HUMAN_BYTES`; types `CloseoutStepId`, `CloseoutPlan`, `CloseoutStep`, `CloseoutOperation`, `CloseoutOperationName`, `CloseoutArguments`, `CloseoutOutcome`, `CloseoutPlanOutcome`, `CloseoutApplyOutcome`, `CloseoutGapReason`, `CloseoutReadObservation`, `CloseoutOperationIdentityInputs`, `CloseoutEvidence`, `CloseoutTruncation`, `CloseoutData`, `CloseoutSummary`, `CloseoutOperationRecord`, `CloseoutProviderRuntime`, `CloseoutGitRuntime`, `CloseoutStateRuntime`. `CloseoutProviderRuntime` exposes `readWorkItemObservation` as the closeout observation carrier alongside the unchanged `readWorkItem`. The read-observation vocabulary is closeout-specific contract data; it adds no core primitive-port field and no closed adapter operation (DM-11). |
| PIN-2 | **Seven step ids, in order**: `ticket-to-done`, `lifecycle-label-sweep`, `unassign`, `owed-flip-sweep`, `comment-resolution`, `checkout-restore`, `branch-cleanup`. The human label for `branch-cleanup` is "squash-safe local branch cleanup". |
| PIN-3 | **Operation names**: `transition-work-item`, `write-work-item`, `resolve-delivery-thread`, `restore-checkout`, `delete-branch`. Provider operations are the first three; git operations are the last two. `engine` is the provider `systemName` or the literal `"git"`. The **adapter capability context** (the provider's declared supported-operation and gap posture for the operation) is a separate, explicit identity input described in PIN-12 — the additive `capabilityContext` refinement of ADR-0003's identity inputs recorded in DEC-7. It is not folded into `engine`, so a capability flip changes the identity while `engine` stays stable. |
| PIN-4 | **Canonical arguments** (uppercase tokens are metavariables resolved from the observed provider/git facts; every `write-work-item` argument is one **flat** object with optional `add` / `remove` / `assignee` — never a nested `labels` object, and the same flat shape is the operation-identity input): ticket `{ deliveryState: "done" }`; label remove `{ remove: [LABEL] }`; label add `{ add: ["delivered"] }`; unassign `{ assignee: "none" }`; owed-flip `{ add: ["hand-back"], remove: ["blocked"] }`; thread `{ deliveryRequest: { systemName, entityId }, threadId: THREAD_ID }`; checkout restore `{ baseRef: BASE_REF }`; branch cleanup `{ branch: LOCAL_BRANCH }`. No arguments use wall clock, randomness, or API order. |
| PIN-5 | **Outcome vocabulary**: plan `would-apply`, `satisfied`, `skipped-gap`, `skipped-noop`, `would-refuse`; apply `applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, `refused`. Terminal outcomes are `applied`, `satisfied`, `skipped-gap`, `skipped-noop`; `failed` is retained but retryable; `refused` is a safety refusal. |
| PIN-6 | **Gap reasons**: `provider-unsupported`, `adapter-not-implemented`, `plan-restriction`. A gap is data, never an error-table row and never `applied`/`satisfied`. |
| PIN-7 | **Label disposition**: keep `change`; remove `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, `blocked`; add `delivered` when absent; preserve every other label. Order is the declared disposition order above. |
| PIN-8 | **Base and protected refs**: resolved base = merged delivery request `targetRef`, else `CLOSEOUT_INTEGRATION_BASE = "main-tools"`. Protected refs = `main`, `main-tools`, the resolved base, `HEAD`, and any declared protected ref. The protected set always wins. |
| PIN-9 | **Caps and bounded I/O**: `CLOSEOUT_MAX_DEPENDENTS = 200`, `CLOSEOUT_MAX_THREADS = 100`, `CLOSEOUT_OPERATION_TIMEOUT_MS = 30_000`, `CLOSEOUT_MAX_MACHINE_BYTES = 65_536`, `CLOSEOUT_MAX_HUMAN_LINES = 200`, `CLOSEOUT_MAX_HUMAN_BYTES = 16_384`. The timeout is enforced, not merely declared: every provider request carries `AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS)` in the native-fetch default and every git child process passes `{ timeout: options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS }` to `execFile`/`spawn`. The production default is 30 000 ms; tests may inject a short timeout override to prove the abort without a 30 s wall-clock wait, and a structural assertion pins the production default. |
| PIN-10 | **Additive adapter extensions**: `DeliveryRequest.headSha?: string` (absent = unknown, copied verbatim); `ADAPTER_OPERATIONS` appends `"resolve-delivery-thread"` as the eighth member. No existing field or operation is removed, retyped, or renamed. |
| PIN-11 | **Error rows**: `closeout.target.unobserved` (user, false, not_landed, user-validation, 1); `closeout.target.ambiguous` (user, false, not_landed, user-validation, 1); `closeout.write.failed` (transient, true, unknown, platform-provider, 2); `closeout.branch.unsafe` (user, false, not_landed, user-validation, 1). `closeout` joins `DOMAIN_KINDS` after `db`. |
| PIN-12 | **Domain module and operation identity (SHA-256, pinned approach)**: `packages/core/src/domain/closeout.ts` exports `buildCloseoutPlan`, `canonicalCloseoutJson`, `deriveCloseoutOperationId`, `foldCloseoutOutcomes`, `summarizeCloseout`, `boundCloseoutData`, `renderCloseoutHuman`, `resolveCloseoutBaseRef`, `isProtectedRef`, `selectMatchingBranch`, `evaluateBranchSafety`, `closeoutStepDefinitions`. `packages/core/src/domain/sha256.ts` is a **pure TypeScript SHA-256 implementation** exporting `sha256Hex(input: string): string`; the chosen approach is a pure module, so no digest injection and no runtime API is needed in the pure tier. `deriveCloseoutOperationId(inputs: CloseoutOperationIdentityInputs): string` returns the 64-lowercase-hex `sha256Hex(canonicalCloseoutJson({ workspaceId, workItemRef, engine, capabilityContext, operation, arguments, target }))` — ADR-0003's identity inputs **plus** the additive `capabilityContext` refinement recorded in DEC-7 (a deliberate, additive extension of the ADR-0003 formula; no prior closeout operation ids exist, so no id is re-derived). The identity inputs are explicit: workspace id, canonical work item ref, engine (`systemName` or `"git"`), **adapter capability context** (the provider's declared supported/gap posture for the operation), operation name, canonical arguments, and provider target. No FNV-1a, no clock, no randomness, no environment, no `node:crypto`/`node:*`/`bun:*` import in production. The test must assert known-answer vectors (`""`, `"abc"`) and a committed 64-lowercase-hex digest for one fixed canonical identity tuple. The committed digest is generated from the same fixed tuple the test uses: regenerate it from the exact `canonicalCloseoutJson(tuple)` bytes with the pure `sha256Hex`, independently reproduce it with a test-only `node:crypto` `createHash("sha256")` (and/or `printf '%s' '<canonical-json>' | sha256sum`) over that same tuple, and record the tuple, command, and digest in the Execution Log; the `node:crypto` cross-check must cover the fixed tuple, not only parameterized inputs. The `capabilityContext` refinement is recorded change-level in DEC-7 and needs no separate ADR-0003 addendum for v1 because no prior closeout operation ids exist; if the identity formula is later treated as system-level, raise an ADR-0003 addendum via `@decision-advisor`. Pure: no I/O, clock, randomness, or environment. |
| PIN-13 | **State module**: `packages/core/src/state/closeout.ts`; exports `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX = "closeout.operations:"`, `closeoutOperationRecordKey`, `appendCloseoutOutcome`, `readCloseoutHistory`, `foldCloseoutHistory`. Uses only `StateStorePort`; no schema bump, no runtime API. |
| PIN-14 | **GitHub adapter methods and read observation**: extend `GithubClient` with `findMergedDeliveryRequest`, `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread`, and the closeout-specific `readWorkItemObservation`. **Carrier pin:** the discriminated work-item observation is additive and rides `readWorkItemObservation({ entityId })` (returning `CloseoutReadObservation<WorkItem>`); the existing `readWorkItem` return shape is **unchanged**, so its provider-view consumers (`tests/types/provider-views.type-test.ts`, `tests/behaviour/providers/*`) need no edits. `packages/testkit/src/conformance/types.ts` is edited only additively in Phase 1.6 to add the optional `writeWorkItem?`/`transitionWorkItem?`/`resolveDeliveryThread?` client members; its `readWorkItem` typing stays unchanged and no `readWorkItemObservation` member is required there for v1. If the existing `readWorkItem` shape is changed instead, those three areas are added to Phases 4/5. `normalizePullRequest` copies `headSha` from `head.sha` only when present. GraphQL `resolveReviewThread` is a `POST {baseUrl}/graphql` through the existing transport. Closeout-relevant reads return the discriminated `CloseoutReadObservation`: an explicit HTTP 404 on the work-item read is `not-found`; a malformed/unparsable 2xx payload is `invalid`; a missing surface is `unavailable`; credential failures keep their existing identity. A 404 is **never** mapped to `provider.payload.invalid`, and an `invalid` payload is never mapped to `not-found`. The merged-request and reverse-dependent reads likewise carry `observed` / `unavailable` (and `invalid`) so `relations: []` is authoritative only when `observed`. The GitHub bounded reverse-dependent (`issue-dependencies`) surface is an implementation-confirmed assumption: an absent surface is reported as unavailable and maps to the provider-level `skipped-gap` (`provider-unsupported`); a surface that exists but whose current read is unavailable maps to `skipped-noop` with `relation-signal-unavailable`, never the reverse. Every native-fetch request passes `AbortSignal.timeout(CLOSEOUT_OPERATION_TIMEOUT_MS)`. |
| PIN-15 | **Jira adapter methods and read observation**: extend `JiraClient` with `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`, and the same closeout-specific `readWorkItemObservation` carrier (the existing `readWorkItem` return shape is unchanged, so its provider-view consumers `tests/types/provider-views.type-test.ts` and `tests/behaviour/providers/*` stay untouched; `packages/testkit/src/conformance/types.ts` keeps its `readWorkItem` typing and receives only the Phase 1.6 additive write-member edits). Closeout-relevant reads return the same discriminated `CloseoutReadObservation`; an explicit 404 is `not-found`, a malformed payload is `invalid`, and a missing reverse surface is `unavailable` (never an empty relation set). Label replace computes the target set from the provider-asserted labels at execution time, removes only named labels, adds `delivered`, and preserves every other label; when the label signal is unavailable the sweep is `skipped-noop` with `label-signal-unavailable`. The done transition uses `JIRA_WORKFLOW_MAP`; `jira.js` remains a recorded re-evaluation trigger if the minimal client cannot satisfy the semantics. Every native-fetch request passes `AbortSignal.timeout(CLOSEOUT_OPERATION_TIMEOUT_MS)`. |
| PIN-16 | **Git subpath**: `@delivery-os/adapters/git` at `packages/adapters/src/git/index.ts`; `createGitBranchSeam`, `GitBranchSeam`, `GitBranchSeamOptions`, `GitCheckoutFacts`, `GitBranchFacts`, `GitSafetyFacts`, `GitMutationResult`, `GitChildRunner`, `GitChildRunnerResult`; methods `readCheckout`, `listBranches`, `readBranch`, `isCheckedOutElsewhere`, `isClean`, `resolveRef`, `restoreCheckout`, `deleteBranch`. `GitCheckoutFacts` distinguishes the delivery branch, detached-at-delivery-head, base, unrelated, and missing states. `GitBranchSeamOptions` carries `timeoutMs` (defaults to `CLOSEOUT_OPERATION_TIMEOUT_MS`, exists for a short test override) and an optional test-only `childRunner?: GitChildRunner` injection seam (`(file, args, options) => Promise<GitChildRunnerResult>`, production default `execFile`). Fixed argv, no shell, no network, local-only; the injection seam substitutes only the child process, never the command allowlist. Every child process is bounded: `execFile`/`spawn` receives `{ timeout: options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS, killSignal: "SIGKILL" }`; a timeout aborts the process and surfaces a classified failure that blocks deletion. The injected `GitChildRunner` lets the timeout test drive a child that never settles hermetically, with no real hanging process. |
| PIN-17 | **CLI module**: `packages/cli/src/commands/closeout.ts`; `CloseoutCommandRuntime`, `createCloseoutCommandDefinition`. Composition `CloseoutComposition` and `createCloseoutCommandRuntime` in `packages/cli/src/edge.ts`; registration in `createConfigProgram` as `commands.closeout`. Grammar: `closeout <workItemRef> [--apply] [--json]`; exactly one positional ref; `positionals: { max: 2 }` — exactly one extra positional reaches the handler and is rejected as `input.value.rejected` (test-plan G-02), while two or more extra positionals exceed the parser bound and are rejected as `fallback.invocation` before the handler (test-plan G-09); canonical ref pattern `^[A-Z][A-Z0-9]*-\d+$`, **case-sensitive with no case folding** (lowercase `gh-183` is `input.value.rejected`); an unknown flag is `fallback.invocation` before the handler; `--apply` is the only mutation switch; `--json` is stripped by the shared parser and adds no command behavior. Rejection happens before any source read or mutation. |
| PIN-18 | **Conformance**: add step `change-lifecycle.resolve-delivery-thread` with operation `resolve-delivery-thread`, assertion family `delivery-thread`; **position pinned**: append it as the last step of the `change-lifecycle` flow — immediately after `change-lifecycle.comment` and before the `comment-provenance` flow's first step (`comment-provenance.read-comments`), i.e. the 8th (last) `change-lifecycle` step and therefore the 8th of the 13 registry steps, never before or between the flow's existing delivery-request steps and never interleaved into another flow; registry becomes 13 steps / 8 operations. Widen `MockTenantRoute.method` to the closed transport method set and add an optional request body; add `threadId` to `GithubMockAddressing`. Phase 1 keeps the new operation a gap on every provider and, in the same commit, updates the hardcoded seven-operation control helpers so every registration that does not support it declares the gap: add `resolve-delivery-thread` to `ALL_OPERATIONS`/`gapsExcept` in `tests/conformance/mock-conformance.test.ts` and `tests/conformance/live/live-entrypoint.test.ts` (so `liveControl`'s `read-work-item`+`write-comment` split declares it), and add it to the explicit `declaredGaps` list of the `withoutHandler` control in `tests/conformance/broken-adapter-control.test.ts`; `packages/testkit/src/conformance/runner.ts` keeps its `failClosed` branches unchanged, so `runConformance` never throws on an undeclared unsupported operation and the broken-adapter control still exercises the intended supported-non-read-without-handler branch. `bun test tests/conformance` is green at the Phase 1 boundary. Phases 4/5 add the production write-execution branch (`registration.writeHandler` → client write member → fail closed), the provider write members, and the GitHub `POST /graphql` plus write routes in the same commit as the capability flip, so every newly supported write executes in mock and `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` stays empty (TC-065). The same commit updates the two existing conformance controls: `tests/conformance/broken-adapter-control.test.ts` `corruptRegistration` preserves the base client's write members (or supplies a `writeHandler`) so the runner reaches and reports the corrupted read instead of failing closed on the write branch; `tests/conformance/live/live-entrypoint.test.ts`'s mock-tier inline transport matches `method + URL` (or routes through the shared method-aware `createFixtureTransport`) so a POST/PATCH cannot receive a GET read fixture. |
| PIN-19 | **Fixtures/harness**: `tests/fixtures/closeout/harness.ts` (provider/git/state fakes + `runCloseoutCli`), `plan.ts`, `labels.ts`, `dependents.ts`, `threads.ts`, `request.ts`, `capabilities.ts`, `branch.ts`, `canary.ts`, `golden/**`, `mutants/**`; provider fixtures under `tests/fixtures/providers/{github,jira,gitlab}` and trap catalogs under `tests/fixtures/providers/traps/**`; temp local git repositories via `mkdtemp` + `git init`. Provider read fixtures carry an explicit observation and include not-found, malformed-payload, and unavailable-surface variants. `tests/fixtures/closeout/branch.ts` covers BR-01..BR-12 with expected outcomes; TC-066's temporary-repo harness owns BR-13/BR-14 (the clean detached-at-delivery-head restore and the dirty/missing-base refusal), matching test-plan §6.2. `tests/behaviour/providers/support.ts` `FixtureRoute.method` is **optional and defaults to `GET`** — every existing route fixture (which has no `method`) is therefore unchanged and no bulk fixture edit is required. `createFixtureTransport` matches by **method + URL** using `request.method` against `route.method ?? "GET"` (not URL only), so a PATCH/POST write cannot receive a GET read fixture; a method-mismatch negative control asserts the transport throws. Write-path tests may alternatively route through the `CloseoutProviderRuntime` fake. |
| PIN-20 | **Changeset**: `.changeset/gh-183-closeout-minor.md` with a `minor` bump for exactly `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`; `testkit` never versioned. |

## Delivery Bindings (D1..D17)

- **D1 — Additive-only contract evolution.** `headSha` is optional and `resolve-delivery-thread` is appended to the closed set. No v2 contract, no parallel adapter surface, no provider-native type crossing a port. Governed by TDR-0008; no schema-version bump or migration.
- **D2 — Same-commit error identity and documentation.** `closeout` joins `DOMAIN_KINDS`, the four rows land in `ERROR_TABLE`, and the documented table in `doc/spec/features/feature-result-contract.md` is updated in the same Phase 1 commit. `scripts/checks/error-table-sync.ts` is green in both directions from the first phase boundary; the documented table is never rewritten by later phases except to fix drift found by the sync gate.
- **D3 — Conformance write execution is a delivery obligation, phased with capability (TC-065).** Phase 1 adds the flow step, keeps `resolve-delivery-thread` (and the existing write operations) as declared gaps, and in the same commit updates the hardcoded seven-operation `ALL_OPERATIONS`/`gapsExcept` helpers in `tests/conformance/mock-conformance.test.ts` and `tests/conformance/live/live-entrypoint.test.ts` plus the `withoutHandler` explicit gap list in `tests/conformance/broken-adapter-control.test.ts`, so every registration that does not support the new operation declares it and the suite stays green. Phase 4 flips the GitHub capability and adds the production write-execution branch, the client write members, and the GitHub routes in the same commit; Phase 5 does the same for Jira. Each flip adds mock execution of the newly supported `write-work-item`/`transition-work-item`/`resolve-delivery-thread` operations so `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` stays empty. The `writeHandler` seam remains for test-only controls; a registration with a supported non-read step and no handler/client member still fails closed. The Phase 4 capability flip also updates the two conformance controls: `broken-adapter-control.test.ts` preserves write members (or supplies a `writeHandler`) so its corrupted-read report is still reached, and `live-entrypoint.test.ts` makes its inline transport method-aware. Phase 8 proves the integrated non-vacuous matrix. The live tier remains read-only (`live-read-only` skips).
- **D4 — Transport widening, not a new transport.** `ProviderHttpMethod` becomes the closed set `GET | POST | PATCH | PUT | DELETE`, `ProviderRequest` gains an optional `body?: string` and an optional `timeoutMs?: number`, and each native `fetch` default forwards the body and applies `AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS)`. Reads remain `GET`; the live conformance guard still rejects any non-`GET` request. No new credential or network location is introduced.
- **D5 — Pure domain with injected time and identity.** The planner, identity derivation, folding, bounds, branch-safety predicate, and human renderer are pure. Time comes from an injected ISO string; run/fence ids come from injected factories; the contracts/domain tiers contain no ambient clock, randomness, environment, `node:*`, or `bun:*` import.
- **D6 — Ledger through the existing fenced port.** Apply acquires the single-writer fence, reads the verified history, appends one `closeout.operation` record per terminal operation, and releases the fence in a `finally`. Plan mode acquires no fence and appends nothing. A torn or malformed ledger is the delivered classified `state.*` error, never zeros.
- **D7 — GitHub is the dogfood write host.** Issue close, labels, assignee, merged-PR lookup/head, GraphQL thread resolution, and reverse dependents are implemented behind the existing injected transport and credential port. The bounded reverse-dependent (`issue-dependencies`) surface is an implementation-confirmed assumption: absent → provider-level `skipped-gap`; present-but-unavailable → signal-level `skipped-noop` with `relation-signal-unavailable`. The work-item observation is carried additively by `readWorkItemObservation`; the existing `readWorkItem` return shape is unchanged. Capability declaration: supported `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `resolve-delivery-thread`; gaps `write-comment` and `write-delivery-request` (`adapter-not-implemented`).
- **D8 — Jira write basis is the delivered seed extended.** Done transition, full-array label replace with preservation, assignee clear, and a bounded reverse-dependent JQL read. The same closeout-specific `readWorkItemObservation` carrier applies; the existing `readWorkItem` return shape is unchanged. Capability declaration: supported `read-work-item`, `write-work-item`, `transition-work-item`; gaps `write-comment` (`adapter-not-implemented`), `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `resolve-delivery-thread` (`provider-unsupported`). If the minimal client cannot satisfy label-replace, transition, or assignee-clear semantics, record the `jira.js` re-evaluation trigger before expanding the client; do not silently widen the boundary.
- **D9 — GitLab stays read-only.** `normalizeMergeRequest` copies a provider-exposed head verbatim (`sha` when present) into optional `headSha`; absent stays absent. GitLab declares every write, including `resolve-delivery-thread`, as `adapter-not-implemented`. No GitLab write method is added.
- **D10 — Dedicated git seam with exact confinement.** The new `packages/adapters/src/git/` subpath is the only spawn surface for branch/checkout operations. `.dependency-cruiser.cjs` gains one exact, reason-bearing `runtime-apis-confinement` entry; `tests/boundaries` gains positive and negative fixtures. The read-only `repo` reader is unchanged: its existing `node:fs` allowance stays, it gains no `node:child_process`/`Bun.spawn`/`Deno.Command` surface, and an AST assertion proves it. `status`, `queue ready`, and `verify change` do not import the closeout engine, provider write path, or git seam.
- **D11 — CLI composition and read-only isolation.** The handler validates grammar, delegates to the closeout runtime, and returns data or a classified failure; the shared CLI edge owns rendering and exit projection. `createProductionDependencies` and the read-only command compositions are untouched. `closeout` is registered only when the closeout composition is supplied.
- **D12 — Bounded output and one redaction chokepoint.** Machine data is a bounded `delivery.closeout.v1` payload; human output is a deterministic digest within 200 lines/16 KiB. Evidence names operations, targets, counts, refs, labels, outcomes, and classified reasons only. The existing serializer redaction covers both modes; no comment bodies, titles, raw payloads, credentials, environment values, or command arguments enter output or ledger evidence.
- **D13 — Inventory/allowance cadence.** Every phase that adds a `packages/**/src/**` file updates `tests/structure/inventory.json` and the file's `EXECUTABLE_ALLOWANCES` entry in `tests/structure/content-inventory.test.ts` in the same commit. Every new contracts module that carries executable `as const` data is added to `tests/structure/port-neutrality.test.ts`'s scanned module list (or proven declaration-only by the same suite). Each phase boundary keeps `bun test tests/structure/content-inventory.test.ts` green.
- **D14 — Hermetic fixtures.** Provider behaviour is proven by committed sanitized fixtures through injected transports; the git seam is exercised against temporary local repositories; the live worktree, `dist/`, and the user's real state directory are never written. No live provider, credential, socket, or network call exists in the battery. The no-leak canary is asserted present before absence is asserted.
- **D15 — Protected paths and no new dependencies.** `scripts/*.sh`, `scripts/checks/secret-read-boundary.ts`, `tools/`, `.opencode/`, `.ados-claude/`, the bash CI jobs, and `.github/workflows/ci.yml` are untouched. No new runtime dependency, lockfile package, package/subpath beyond `adapters/git`, or brand-derived string is introduced. This plan does not push, open a PR, merge, or claim owner approval; PR creation is lifecycle phase 11.
- **D16 — NFR-6 timeout is wired, not declared.** `CLOSEOUT_OPERATION_TIMEOUT_MS = 30_000` is the production default enforced on both I/O classes: every provider request through a native `fetch` default sets `AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS)` (with `ProviderRequest.timeoutMs` as the contract seam), and every git child process passes `{ timeout: options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS, killSignal: "SIGKILL" }` to `execFile`/`spawn`. A timeout is a classified failure that aborts the operation and blocks branch deletion. Evidence is structural (the production default constant is referenced on each I/O class, with a removal control) and behavioral (a short injected timeout with a never-resolving transport and a never-settling injected `GitChildRunner` child aborts at the bound), mapped to TC-063.
- **D17 — Discriminated read observation end to end.** Closeout-relevant reads return `observed` / `not-found` / `unavailable` / `invalid` (DM-11). The engine maps `not-found` to `closeout.target.unobserved` with zero writes, `invalid` to the adapter-local `provider.payload.invalid` (never the not-found code), and `unavailable` to a declared gap for dependent steps. Owed-flip consumes the observation, not just the array: no reverse surface → provider-level `skipped-gap`; surface present but signal unavailable/unknown → `skipped-noop` with `relation-signal-unavailable` and no flip; a candidate with an unavailable relation signal is skipped with evidence. This is an adapter-I/O refinement: no new closed operation, no core primitive-port field, no schema bump.

## Scope

### In Scope

- F-1: the `closeout <workItemRef> [--apply] [--json]` command surface with canonical ref validation and dry-run default.
- F-2: the deterministic seven-step ordered transaction and canonical operation expansion.
- F-3: deterministic operation identities, the `closeout.operation` ledger record, terminal-outcome reuse, and failed-outcome retry.
- F-4: ticket-to-done through the declared workflow transition, including the discriminated target read (explicit provider not-found → `closeout.target.unobserved`, malformed payload → `provider.payload.invalid`, no read → gap) (DM-11, AC-F4-4).
- F-5: the bounded lifecycle label disposition table and sweep (including the Jira full-array preservation trap).
- F-6: explicit unassign that never infers "already unassigned" from absence.
- F-7: the bounded owed-flip sweep over direct dependents (cap 200, deterministic order, unknown never satisfied), with the provider-level no-surface gap versus the signal-level `skipped-noop` distinction (DM-11, AC-F7-6/7).
- F-8: review-thread resolution over the merged delivery request (cap 100; GitHub GraphQL; gaps elsewhere).
- F-9: checkout restore to the resolved base with safety refusals, including a clean detached-at-delivery-head checkout (AC-F9-5).
- F-10: squash-safe local branch cleanup with protected-ref, dirty-worktree, foreign-worktree, ambiguity, and unknown-head safety.
- F-11: honest per-provider capability declarations and declared-gap handling for GitHub, Jira, and GitLab.
- F-12: merged-delivery-request lookup by source ref and the additive `DeliveryRequest.headSha`.
- F-13: bounded machine and human output with per-operation evidence.
- F-14: the four `closeout` failure identities in the existing result contract, error table, documented table, and CLI projection.
- F-15: read-only command isolation, the dedicated git seam, and the exact runtime-confinement entry.
- The discriminated read observation (`observed` / `not-found` / `unavailable` / `invalid`) for closeout-relevant reads (DM-11; additive adapter-I/O refinement).
- The NFR-6 30 s per-operation timeout wired on provider requests and git child processes.
- The conformance flow-registry step and production write execution required by TDR-0008 and the existing `runtimeCoverageViolations` invariant (TC-065).
- The pinned v1 integration base `main-tools` as compiled contract data with the recorded portability limit and revisit trigger (no configuration key).
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
- The providers expose the operations closeout needs: GitHub issue close, labels, assignee clear, merged-PR lookup/head, and review-thread resolution, plus a bounded reverse-dependent read that is an implementation-confirmed assumption (not verified current truth); Jira done transitions, label replace, assignee clear, relations, and a bounded reverse-dependent query; GitLab merged-MR/pipeline reads. Exact GraphQL/response shapes are confirmed by committed fixtures at implementation. An absent bounded-query surface is the provider-level `skipped-gap` (`provider-unsupported`); a surface that exists but whose current read is unavailable is the signal-level `skipped-noop` with `relation-signal-unavailable`; the adapter/runtime must distinguish the two and never degrade an absent surface to a signal skip.
- The merged delivery request's head identity is observable through the provider lookup; when it is not, branch cleanup refuses rather than guesses.
- The v1 integration base is the compiled contract constant `main-tools`; it is not configurable in v1. A merged delivery request's target ref takes precedence, which is the normal path for installed projects. The portability limit and the "add a configuration key" revisit trigger are recorded in DEC-9.
- A provider may support a read while a particular signal within it is unavailable; closeout consumes the discriminated read observation, so an unasserted `relations: []` is never read as an empty blocker set (DM-11). The observation is carried by the additive `readWorkItemObservation` member; the existing `readWorkItem` return shape and its provider-view consumers (`tests/types/provider-views.type-test.ts`, `tests/behaviour/providers/*`) are unchanged, while `packages/testkit/src/conformance/types.ts` receives only the Phase 1.6 additive write-member additions and keeps its `readWorkItem` typing.
- The local branch follows the branch convention and is the only local branch for the work item unless the merged head selects one uniquely.
- The state layer's additive record kinds are sufficient; no schema-version bump or migration is needed.
- Provider credentials resolve through the credential port in apply; plan mode reads only what its evidence needs and performs no writes.
- The operator understands that closeout is dry-run by default and that `--apply` is the mutation switch.
- Declared gaps and no-op conditions are successful outcomes; safety refusals and non-gap write failures are classified failures.
- The existing conformance control that fails closed on a supported non-read step without a handler is preserved; production registrations that implement the client write member execute instead, and `tests/conformance/broken-adapter-control.test.ts` preserves the base client's write members (or supplies a `writeHandler`) so its corrupted read is still reported after the GitHub capability flip.
- The NFR-6 reference-fixture p95 is an optional non-CI measurement (GAP-T2); CI asserts bounded work, caps, and declared timeouts.
- The `jira.js` re-evaluation trigger is available if the minimal Jira client cannot satisfy label-replace, transition, or assignee-clear semantics.

### Constraints

- **Tier and purity.** Contracts and domain stay runtime-neutral: no `node:*`/`bun:*`, ambient clock/randomness/environment, provider-native types, or I/O. The planner and identity derivation are pure. Injected time/ids are the only nondeterminism boundaries. The operation identity uses the pure `sha256Hex` module (no `node:crypto` in production); the test may cross-check with `node:crypto`.
- **Bounded I/O.** Every provider request carries `AbortSignal.timeout(CLOSEOUT_OPERATION_TIMEOUT_MS)`; every git child process carries `{ timeout: CLOSEOUT_OPERATION_TIMEOUT_MS, killSignal: "SIGKILL" }`. No operation waits unbounded. A timeout is a classified failure that blocks branch deletion.
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
- **RSK-2 — Branch deletion loses unmerged work.** H/L. Mitigated by the full squash-safety predicate, merged-head equality, protected-ref checks, dirty/foreign/detached-worktree checks, dry-run default, and no remote deletion (Phase 6; BR-01..BR-14).
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
- **RSK-P5 — Reverse-dependent signal is unavailable or unknown.** M/M. Mitigated by the spec's split: no reverse-read surface → provider-level `skipped-gap` (`provider-unsupported`); surface present but the current read unavailable/unknown → `skipped-noop` with `relation-signal-unavailable` and no flip; a candidate with an unavailable relation signal is skipped with evidence. An unasserted `[]` is never "no blockers" (Phase 2/4/5/8; TC-034/036).
- **RSK-P7 — The pure SHA-256 implementation is wrong or drifts from ADR-0003.** M/L. Mitigated by known-answer vectors (`""`, `"abc"`), a committed digest for the same fixed canonical closeout identity tuple the test exercises (independently reproduced with `node:crypto`/`sha256sum` and recorded in the Execution Log), a test-only cross-check against `node:crypto` over the fixed tuple and randomized inputs, and a stability/sensitivity suite over every identity input including the capability context (Phase 2; TC-018). No FNV-1a or alternate digest remains.
- **RSK-P8 — The 30 s timeout is declared but not wired on one I/O class.** M/M. Mitigated by D16 tasks on provider defaults and the git seam, a structural assertion that each I/O class references `CLOSEOUT_OPERATION_TIMEOUT_MS` (with a removal control), and a behavioral never-resolving transport/child control (Phases 4/6/8; TC-063).
- **RSK-P6 — The plan's phase map drifts from the test plan.** M/L. Mitigated by the traceability table; any change to a TC's behaviour, assertion, or AC mapping reopens the test plan (A-T6).

### Success Metrics

| Metric | Target |
|--------|--------|
| Routine manual closeout misses per merge in dogfood | 0 after adoption |
| Re-run after a simulated restart with zero duplicate mutations | 100% of applied fixtures |
| Apply completes in one run on the declared fixture and dogfood happy path | ≥ 99% |
| Planned operation identity stability for identical inputs and SHA-256 algorithm conformance (ADR-0003) | 100% byte-identical; known-answer vectors and capability-context sensitivity pass |
| Per-operation timeout wiring on provider requests and git child processes | 100% of I/O classes reference `CLOSEOUT_OPERATION_TIMEOUT_MS`; no unbounded wait |
| Read-observation discrimination (not-found vs malformed vs unavailable) | 100% of target-read fixtures classify exactly once; 0 writes on not-found |
| Declared-gap parity for unsupported closeout operations | 100% carry a valid gap reason |
| Offline gate battery without live credentials or network | 100% of closeout tests |
| Read-only command regressions (`status`, `queue ready`, `verify change`) | 0 |
| Closeout apply duration on the reference fixture | p95 ≤ 120 s; every operation bounded by 30 s (CI asserts bounded work; reference latency non-CI per GAP-T2) |
| Post-closeout ticket, label, assignee, and thread state correctness on happy-path fixtures | 100% |
| Branch deletion on a squash-merged branch with matching merged head | 100% of eligible fixtures; 0 deletions on unsafe fixtures |
| Conformance registry/operation coverage | 13 steps / 8 operations; every supported operation executes in mock (TC-065, `runtimeCoverageViolations` empty) |
| New runtime dependencies | 0 |

## File and Module Layout

| Area | New | Updated |
|---|---|---|
| Core contracts | `packages/core/src/contracts/closeout.ts` | `contracts/index.ts`, `contracts/ports.ts`, `contracts/adapter-capabilities.ts`, `contracts/error-table.ts` |
| Core domain | `packages/core/src/domain/closeout.ts`, `packages/core/src/domain/sha256.ts` | `domain/index.ts`, `packages/core/src/index.ts` |
| Core state | `packages/core/src/state/closeout.ts` | `state/index.ts` |
| Adapters shared | — | `packages/adapters/src/io/provider-transport.ts`, `packages/adapters/package.json` |
| GitHub | `packages/adapters/src/github/closeout.ts` (internal helpers, if needed) | `github/client.ts`, `github/normalize.ts`, `github/capabilities.ts`, `github/index.ts` |
| Jira | `packages/adapters/src/jira/closeout.ts` (internal helpers, if needed) | `jira/client.ts`, `jira/normalize.ts`, `jira/capabilities.ts`, `jira/index.ts` |
| GitLab | — | `gitlab/normalize.ts`, `gitlab/capabilities.ts` |
| Git seam | `packages/adapters/src/git/index.ts` | `packages/adapters/package.json` (export + `#git/*`), `packages/cli/package.json` (`workspaceImports`) |
| CLI | `packages/cli/src/commands/closeout.ts` | `packages/cli/src/commands/index.ts`, `packages/cli/src/edge.ts` |
| Conformance/testkit | — | `packages/testkit/src/conformance/{flows,types,adapters,runner,coverage,mock-tenant}.ts` |
| Fixtures | `tests/fixtures/closeout/**`, `tests/fixtures/providers/github/closeout-*.json`, `tests/fixtures/providers/jira/closeout-*.json`, `tests/fixtures/providers/gitlab/closeout-*.json` | `tests/fixtures/providers/traps/*.traps.json`, `tests/fixtures/providers/github/**`, `tests/fixtures/providers/conformance/{github,jira}/tenant.json`, `tests/fixtures/ports/capabilities.ts` (`EXPECTED_SEED_POSTURES`) |
| Structure/checks | `tests/structure/closeout-contract.test.ts`, `tests/structure/closeout-imports.test.ts`, `tests/types/closeout-headsha.type-test.ts` | `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/structure/port-neutrality.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/conformance-coverage.test.ts`, `tests/structure/port-contract-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/fixture-registry.json`, `tests/boundaries/fixtures/cases.ts`, `.dependency-cruiser.cjs` |
| Behaviour/golden/checks | `tests/behaviour/closeout-*.test.ts` (incl. `closeout-read-observation.test.ts`), `tests/golden/closeout-*.test.ts`, `tests/checks/closeout-mutants.test.ts`, `tests/fixtures/closeout/mutants/**` | `tests/behaviour/error-classification.test.ts`, `tests/behaviour/providers/provider-capabilities.test.ts`, `tests/behaviour/providers/{github-trap,jira-trap,gitlab-trap}.test.ts`, `tests/behaviour/providers/support.ts`, `tests/behaviour/providers/*`, `tests/conformance/mock-conformance.test.ts`, `tests/conformance/broken-adapter-control.test.ts`, `tests/conformance/live/live-entrypoint.test.ts`, `tests/checks/fixture-sanitization.test.ts` |
| Docs | `doc/spec/features/feature-closeout.md` | `doc/spec/features/feature-adapter-ports.md`, `feature-provider-client-seeds.md`, `feature-state-layer.md`, `feature-result-contract.md`, `feature-adapter-conformance.md`, `doc/planning/oss-tooling/cli-command-registry.md` (verify only), `doc/00-index.md` (if indexed) |
| Release | `.changeset/gh-183-closeout-minor.md` | — |

The additive observation carrier leaves `tests/types/provider-views.type-test.ts` and `tests/behaviour/providers/*` unchanged: `readWorkItem`'s return shape is not retyped. `packages/testkit/src/conformance/types.ts` changes only additively in Phase 1.6 (optional `writeWorkItem?`/`transitionWorkItem?`/`resolveDeliveryThread?` client members) and keeps its `readWorkItem` typing. If the `readWorkItem` shape ever changes, those files join the Phase 4/5 code areas.

## Traceability and Coverage: All 67 TCs to Phases

The test plan owns the TC definitions and oracles; this table assigns each TC to the phase that delivers it and names the suite. A TC may be asserted again in later phases, but its first delivering phase is below. Where a TC is split across levels, the split is explicit. No TC is reshaped; any change to a TC's behaviour, assertion, or AC mapping reopens the test plan (A-T6).

| TC | AC | Phase(s) | Suite / artefact |
|---|---|---|---|
| TC-CLOSE-001 | AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9 | 1, 2 | `tests/structure/closeout-contract.test.ts` |
| TC-CLOSE-002 | AC-F11-1, AC-F11-2, AC-F11-3, AC-F12-3, NFR-9 | 1, 4, 5 | `tests/structure/closeout-contract.test.ts`, `tests/structure/conformance-coverage.test.ts`, conformance suites |
| TC-CLOSE-003 | AC-F14-1 | 1 (contract/table half), 7, 8 (trigger, envelope, exit half — with TC-061) | `tests/structure/error-table.test.ts`, `tests/behaviour/closeout-output.test.ts` |
| TC-CLOSE-004 | AC-F14-2, NFR-11 | 1, 8 | `tests/checks/error-table-sync.test.ts`, `scripts/checks/{error-table-sync,exit-code-literals}.ts` |
| TC-CLOSE-005 | AC-F14-1 | 1 | `tests/behaviour/error-classification.test.ts` |
| TC-CLOSE-006 | AC-F12-3, AC-F10-7, DM-8 | 1, 4, 6 | `tests/types/closeout-headsha.type-test.ts`, `tests/behaviour/closeout-request.test.ts`, `tests/behaviour/closeout-branch.test.ts` |
| TC-CLOSE-007 | AC-F15-1, NFR-5 | 6, 8 | `tests/structure/closeout-imports.test.ts`, read-only suites |
| TC-CLOSE-008 | AC-F15-1, NFR-5, NFR-12 | 6, 8 | `tests/structure/closeout-imports.test.ts`, `tests/boundaries`, `pnpm check:boundaries` |
| TC-CLOSE-009 | AC-NFR10-1, NFR-10 | 8, 12 | `tests/checks/license-*.test.ts`, `scripts/checks/{license-audit,vulnerability-gate}.ts` |
| TC-CLOSE-010 | AC-F1-1, AC-F2-2, NFR-4 | 2 (planner-level), 7 (in-process CLI-level) | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-011 | AC-F1-2, AC-F2-2, NFR-4 | 2 (planner-level), 7 (in-process CLI-level) | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-012 | AC-F1-3 | 7 | `tests/behaviour/closeout-plan.test.ts` (grammar matrix G-01..G-09, incl. one-extra handler and two-or-more-extra parser cases) |
| TC-CLOSE-013 | AC-F2-1, NFR-2 | 2, 8 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-014 | AC-F2-3, AC-F2-1, AC-F3-4, DM-9 | 2 | `tests/behaviour/closeout-plan.test.ts` |
| TC-CLOSE-015 | AC-F3-1, NFR-1 | 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-016 | AC-F3-2, NFR-1 | 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-017 | AC-F3-3 | 3 | `tests/behaviour/closeout-idempotency.test.ts` |
| TC-CLOSE-018 | AC-F3-4, DM-9 | 2 (SHA-256 algorithm/KAT, fixed canonical tuple, capability-context sensitivity, identity), 3 (ledger reuse) | `packages/core/src/domain/sha256.ts`, `tests/behaviour/closeout-idempotency.test.ts` |
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
| TC-CLOSE-031..036 | AC-F7-1..AC-F7-7 (034 = F7-4/6/7; 036 = F7-6 no-surface), NFR-6, NFR-9 | 4, 5, 8 | `tests/behaviour/closeout-owed-flip.test.ts` |
| TC-CLOSE-037..040 | AC-F8-1..AC-F8-4, NFR-6, NFR-9 | 4, 8 | `tests/behaviour/closeout-threads.test.ts` |
| TC-CLOSE-041..044 | AC-F9-1..AC-F9-4, DM-7 | 6, 8 | `tests/behaviour/closeout-checkout.test.ts` |
| TC-CLOSE-045..052 | AC-F10-1..AC-F10-8, DM-7, DM-8, NFR-13 | 6, 8 | `tests/behaviour/closeout-branch.test.ts` |
| TC-CLOSE-053..056 | AC-F11-1..AC-F11-4, NFR-9 | 1, 4, 5, 8 | `tests/behaviour/closeout-capabilities.test.ts` |
| TC-CLOSE-057..058 | AC-F12-1..AC-F12-2, DM-8 | 4 | `tests/behaviour/closeout-request.test.ts` |
| TC-CLOSE-059 | AC-F13-1, NFR-7, NFR-12 | 2, 7, 8 | `tests/behaviour/closeout-output.test.ts`, `tests/golden/closeout-envelope.test.ts` |
| TC-CLOSE-060 | AC-F13-2, NFR-7 | 2, 7, 8 | `tests/behaviour/closeout-output.test.ts`, `tests/golden/closeout-human.test.ts` |
| TC-CLOSE-061 | AC-F14-1, NFR-11 | 7, 8 | `tests/behaviour/closeout-output.test.ts` |
| TC-CLOSE-062 | AC-NFR3-1, NFR-3, NFR-12 | 8 | `tests/behaviour/closeout-hermetic.test.ts`, `tests/checks/fixture-sanitization.test.ts` |
| TC-CLOSE-063 | NFR-6 (AC-F7-5, AC-F8-1) | 4, 5, 6, 8 | owed-flip/threads suites + `tests/structure/closeout-contract.test.ts`; provider/git I/O classes (structural production-default + behavioral never-resolving/short-timeout) |
| TC-CLOSE-064 | §4.2 (all ACs) | 8 | `tests/checks/closeout-mutants.test.ts`, `tests/fixtures/closeout/mutants/**` (incl. FNV-1a/omitted-capability identity, unavailable-signal-as-empty, detached-as-unrelated) |
| TC-CLOSE-065 | AC-F11-1, AC-F11-2, AC-F11-4, NFR-9 | 1 (step/gap), 4 (GitHub writes), 5 (Jira writes), 8 (integrated proof) | `tests/conformance/mock-conformance.test.ts`, `packages/testkit/src/conformance/coverage.ts` |
| TC-CLOSE-066 | AC-F9-5, AC-F9-4, AC-F10-8 | 6, 8 | `tests/behaviour/closeout-checkout.test.ts` |
| TC-CLOSE-067 | AC-F4-4, AC-F4-3, AC-F14-1, DM-11 | 2 (planner mapping), 4, 5 (provider reads), 7 (envelope/exit), 8 | `tests/behaviour/closeout-ticket-labels.test.ts`, `tests/behaviour/closeout-read-observation.test.ts` |

**AC coverage.** All 61 ACs appear in the TC map above, and every TC maps to a delivering phase with at least one task. The ranges in the trace are inclusive and total 61: AC-F1-1..3 (3), AC-F2-1..3 (3), AC-F3-1..4 (4), AC-F4-1..4 (4), AC-F5-1..4 (4), AC-F6-1..4 (4), AC-F7-1..7 (7), AC-F8-1..4 (4), AC-F9-1..5 (5), AC-F10-1..8 (8), AC-F11-1..4 (4), AC-F12-1..3 (3), AC-F13-1..2 (2), AC-F14-1..2 (2), AC-F15-1 (1), AC-NFR3-1 (1), AC-NFR8-1 (1), AC-NFR10-1 (1). The grouped AC-to-phase trace is: AC-F1 → Phase 2/7; AC-F2 → Phase 1/2/7; AC-F3 → Phase 2/3; AC-F4 → Phase 2/4/5/7; AC-F5 → Phase 1/4/5; AC-F6 → Phase 4/5; AC-F7 → Phase 2/4/5/8; AC-F8 → Phase 4/8; AC-F9 → Phase 6/8; AC-F10 → Phase 1/6/8; AC-F11 → Phase 1/4/5/8; AC-F12 → Phase 1/4/6; AC-F13 → Phase 2/7/8; AC-F14 → Phase 1/7/8; AC-F15 → Phase 6/8; AC-NFR3 → Phase 8; AC-NFR8 → Phase 3; AC-NFR10 → Phase 8/12. NFR-6 and NFR-12 are qualified by the ACs they map to in the test plan §3.3 (GAP-T5), with TC-034/035/037/063 and TC-026/059/062 as their evidence. DM-11 is covered by TC-034/036/067.

## Phases

Execution order is strict Phase 1 → Phase 12. Each delivery phase (1–8) ends in a verifiable state and one Conventional Commit (scope `GH-183`) via `@committer`. Phases 9–12 are the review/documentation/release closeout and commit only when they change files. Narrow cycles: `pnpm build` first, then the listed `bun test` command; final verification uses `pnpm check` (which builds through `pretest`/`pretypecheck`). Every phase that adds a `packages/**/src/**` file updates inventory/allowance in the same commit (D13). Every delivery phase that adds or changes an executable export in an allowance-governed source file runs `bun test tests/structure/content-inventory.test.ts` at its boundary (Phases 1–7; Phase 8 re-runs it in the full battery), so the boundary is never red on a stale allowance.

---

### Phase 1: Contracts, additive adapter extensions, closeout error identities, and conformance registry

**Goal**: Land the stable closeout vocabulary, the two additive adapter-contract extensions, the four closeout error rows plus documented rows, and the conformance registry/runner changes for `resolve-delivery-thread` (including the three hardcoded control helpers), keeping the whole conformance suite green. No planner or adapter implementation yet.

**Tasks**:

- [ ] **1.1** Create `packages/core/src/contracts/closeout.ts` with the PIN-1 types and `as const` data only: `CLOSEOUT_SCHEMA_ID`, `CLOSEOUT_OPERATION_PAYLOAD_SCHEMA`, `CLOSEOUT_OPERATION_RECORD_KIND`, `CLOSEOUT_STEP_IDS`, `CLOSEOUT_PLAN_OUTCOMES`, `CLOSEOUT_APPLY_OUTCOMES`, `CLOSEOUT_GAP_REASONS`, `CLOSEOUT_OPERATION_NAMES`, `CLOSEOUT_READ_OBSERVATIONS`, `LIFECYCLE_LABEL_DISPOSITIONS`, `PROTECTED_REF_NAMES`, `CLOSEOUT_INTEGRATION_BASE`, `OWNER_ATTENTION_LABEL`, `BLOCKED_LABEL`, `DELIVERED_LABEL`, `CHANGE_LABEL`, the six caps, and the `Closeout*` types (plan, step, operation, arguments, outcome, gap, read observation, identity inputs, evidence, truncation, data, summary, record, provider/git/state runtimes). Export from `contracts/index.ts`. (TC-001, TC-003, TC-006, TC-014, TC-018, TC-067)
- [ ] **1.2** Add `readonly headSha?: string` to `DeliveryRequest` in `packages/core/src/contracts/ports.ts` (absent = unknown; copied verbatim) and append `"resolve-delivery-thread"` to `ADAPTER_OPERATIONS` in `packages/core/src/contracts/adapter-capabilities.ts`. No other field or operation changes. (TC-002, TC-006)
- [ ] **1.3** Update the three capability declarations additively for the new operation only: every adapter declares `resolve-delivery-thread` as a gap in this phase (GitHub and GitLab `adapter-not-implemented`, Jira `provider-unsupported`); all existing supported/gap splits are otherwise unchanged. The final GitHub/Jira supported sets and gap removals land in Phases 4/5, in the same commit as the implementing client and conformance routes. (TC-002, TC-053, TC-054, TC-055)
- [ ] **1.4** Add `closeout` to `DOMAIN_KINDS` and the four PIN-11 rows to `ERROR_TABLE` in `packages/core/src/contracts/error-table.ts`; update the declared-kind prose and the documented table in `doc/spec/features/feature-result-contract.md` in the same commit. (TC-003, TC-004)
- [ ] **1.5** Update `tests/structure/error-table.test.ts` additively (39 entries; `closeout` in the declared-kind prose; four row round-trips) and add closeout cases to `tests/behaviour/error-classification.test.ts` (kind-only containment, exact codes, existing kinds unchanged). Do not edit `scripts/checks/error-table-sync.ts` or `scripts/checks/exit-code-literals.ts`. (TC-003, TC-004, TC-005)
- [ ] **1.6** Update the conformance `resolve-delivery-thread` step and the transport/addressing shape: add `change-lifecycle.resolve-delivery-thread` (operation `resolve-delivery-thread`, assertion family `delivery-thread`) **at the pinned position** — the last step of the `change-lifecycle` flow, immediately after `change-lifecycle.comment` and before `comment-provenance.read-comments` (8th and last `change-lifecycle` step; 8th of the 13 registry steps), never before or between the flow's existing delivery-request steps; add `"delivery-thread"` to `ConformanceAssertionFamily`; add optional `resolveDeliveryThread?`, `writeWorkItem?`, `transitionWorkItem?` to `ConformanceAdapterClient`; widen `MockTenantRoute.method`/`ConformanceTransportRequest` to the closed method set with an optional body; add `threadId` to `GithubMockAddressing`; update `tests/structure/conformance-coverage.test.ts` to 13 steps / 8 operations. The step is a declared gap for every provider in this phase. Update the three hardcoded control helpers in the same commit so no registration reaches `resolve-delivery-thread` unsupported without a declared gap (the runner's `failClosed` in `packages/testkit/src/conformance/runner.ts` must stay unchanged and remain meaningful): (a) in `tests/conformance/mock-conformance.test.ts`, add `"resolve-delivery-thread"` to `ALL_OPERATIONS` (or derive the list from `ADAPTER_OPERATIONS`) so `gapsExcept` emits the gap for every test-only control, and keep the GitHub operation-matrix and Jira gap-reason assertions (the Jira reason is `provider-unsupported`); (b) in `tests/conformance/live/live-entrypoint.test.ts`, add it to `ALL_OPERATIONS`/`gapsExcept` so `liveControl` (`read-work-item` + `write-comment`) declares it, otherwise the runner throws `failClosed` before the live-read-only deferral is reported; (c) in `tests/conformance/broken-adapter-control.test.ts`, add `{ operation: "resolve-delivery-thread", reason: "adapter-not-implemented" }` to the `withoutHandler` explicit `declaredGaps` list so that control still fails for the intended supported-non-read-without-handler reason rather than an undeclared gap. Assert `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty with the new step declared (TC-065 Phase-1 half), and treat `bun test tests/conformance` as green at the Phase 1 boundary. The production write-execution branch, the GraphQL `POST /graphql` route, and the GitHub/Jira write routes land with the adapter phases. (TC-002, TC-053, TC-054, TC-055, TC-056, TC-065)
- [ ] **1.7** Update the structure registries: `tests/structure/inventory.json` adds `core/src/contracts/closeout.ts`; `tests/structure/content-inventory.test.ts` adds the new contract constants to `EXECUTABLE_ALLOWANCES`; `tests/structure/port-neutrality.test.ts` adds `closeout.ts` to the declaration-only scan. (TC-001, TC-008)
- [ ] **1.8** Update the exact contract-surface inventory: `tests/fixtures/ports/v1-contract-inventory.json` gains the `closeout.ts` module export list (and any `ADAPTER_OPERATIONS` change the fixture pins), and `tests/structure/port-contract-inventory.test.ts` passes fail-closed in both directions. Run `bun test tests/structure/port-contract-inventory.test.ts`. (TC-001, TC-002)
- [ ] **1.9** Update the exact seed-posture fixtures and assertions for the new gap: `tests/fixtures/ports/capabilities.ts` `EXPECTED_SEED_POSTURES` adds `resolve-delivery-thread` to each provider's `gapReasons` with the same reason as its declaration, and `tests/behaviour/providers/provider-capabilities.test.ts` `WRITE_METHODS` gains `"resolve-delivery-thread": "resolveDeliveryThread"`. Run `bun test tests/behaviour/providers/provider-capabilities.test.ts`. (TC-002, TC-053, TC-054, TC-055, TC-065)
- [ ] **1.10** Add the contract/type evidence: `tests/structure/closeout-contract.test.ts` (step order, label disposition, protected set, outcome/gap/read-observation vocabulary, operation names, data-only AST) and `tests/types/closeout-headsha.type-test.ts` (optional `headSha` probe; a required-field probe fails typecheck). In Phase 1, TC-002 asserts set coverage and no duplicates against the current (gap-only) split; the spec Appendix-B final supported/gap matrix is extended in Phases 4/5 when the capabilities flip. (TC-001, TC-002, TC-006, TC-067)

**Acceptance Criteria**:

- Must: the contracts module is declaration-only; the seven step ids, label disposition, protected set, outcome/gap/read-observation vocabularies, and caps are exact and exported (AC-F2-2, AC-F5-1, AC-F10-3, NFR-2, NFR-9).
- Must: `resolve-delivery-thread` is in the closed set; the conformance flow operation set equals `ADAPTER_OPERATIONS`; the new step exists; each adapter's supported plus gap operations covers the closed set exactly with no duplicates (the final supported/gap split and the production write execution land in Phases 4/5) (AC-F11-1/2/3, NFR-9).
- Must: `headSha` is optional; present round-trips and absent stays absent at the type level (AC-F12-3).
- Must: the four closeout rows are 4/4 in both the machine and documented tables; `closeout` is a declared kind; no exit literal moves outside the CLI projection (AC-F14-1/2, NFR-11).
- Must: the exact contract inventory (`v1-contract-inventory.json`) and the exact seed postures (`EXPECTED_SEED_POSTURES` + `WRITE_METHODS`) include the new module/operation; both suites are green (TC-001/002/053/054/055).
- Must: with the new step declared as a gap on every provider, `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty (TC-065 baseline).
- Must: every conformance control/registration that does not support `resolve-delivery-thread` declares it as a gap (or supports it), so `runConformance` does not throw and the live control does not fail; the `mock-conformance`, `live-entrypoint`, and `broken-adapter-control` helpers are updated, `failClosed` is unchanged, and `bun test tests/conformance` is green at the Phase 1 boundary.
- Should: Phase 1 leaves the new operation a declared gap on every provider, so the conformance suite remains green; the write-execution branch and routes land with the capability flips in Phases 4/5.

**Files and modules**:

- Code areas: `packages/core/src/contracts/closeout.ts` (new), `packages/core/src/contracts/{index,ports,adapter-capabilities,error-table}.ts` (updated), `packages/adapters/src/{github,jira,gitlab}/capabilities.ts` (updated), `packages/testkit/src/conformance/{flows,types,runner,mock-tenant}.ts` (updated), `tests/structure/{closeout-contract,error-table,conformance-coverage,content-inventory,port-neutrality,port-contract-inventory}.test.ts` (new/updated), `tests/fixtures/ports/{v1-contract-inventory.json,capabilities.ts}` (updated), `tests/behaviour/providers/provider-capabilities.test.ts` (updated), `tests/types/closeout-headsha.type-test.ts` (new), `tests/behaviour/error-classification.test.ts` (updated), `tests/conformance/mock-conformance.test.ts` (updated: `ALL_OPERATIONS`/`gapsExcept`), `tests/conformance/broken-adapter-control.test.ts` (updated: `withoutHandler` `declaredGaps`), `tests/conformance/live/live-entrypoint.test.ts` (updated: `ALL_OPERATIONS`/`gapsExcept`/`liveControl`), `tests/fixtures/providers/conformance/{github,jira}/tenant.json` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (updated in this phase for the four rows); the remaining system specs are Phase 11.

**Tests**:

- `pnpm install --frozen-lockfile && pnpm build`
- `bun test tests/structure/closeout-contract.test.ts`
- `bun test tests/structure/error-table.test.ts`
- `bun test tests/structure/conformance-coverage.test.ts`
- `bun test tests/structure/port-contract-inventory.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun test tests/behaviour/providers/provider-capabilities.test.ts`
- `bun test tests/checks/error-table-sync.test.ts`
- `bun run scripts/checks/error-table-sync.ts`
- `bun test tests/conformance` (green at the Phase 1 boundary; `mock-conformance`, `live-entrypoint`, and `broken-adapter-control` updated in the same commit)
- `bun test tests/conformance/mock-conformance.test.ts tests/conformance/broken-adapter-control.test.ts tests/conformance/live/live-entrypoint.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add closeout contracts, error identities and conformance registry step`

---

### Phase 2: Pure closeout planner and domain

**Goal**: Implement the deterministic seven-step planner, canonical operation expansion, the pure SHA-256 operation identity, outcome folding, base/protected-ref contract, branch-selection/safety predicate, bounded output, and human renderer as pure functions. No I/O, clock, randomness, or environment.

**Tasks**:

- [ ] **2.1** Create `packages/core/src/domain/sha256.ts`: a pure TypeScript SHA-256 implementation exporting `sha256Hex(input: string): string` (64 lowercase hex). No `node:crypto`, `node:*`, `bun:*`, dependency, clock, or randomness. Export from `domain/index.ts`. (TC-018)
- [ ] **2.2** Create `packages/core/src/domain/closeout.ts` with the PIN-12 exports: `closeoutStepDefinitions` (exact seven-step order and expansion rules), `buildCloseoutPlan` (pure function of observed work item and read observations, capabilities, merged request, local facts, and persisted terminal outcomes), `canonicalCloseoutJson` (sorted-key, whitespace-free canonical form), `deriveCloseoutOperationId` (**SHA-256 via `sha256Hex` over the explicit identity inputs** — workspace id, canonical ref, engine, adapter capability context, operation, canonical arguments, provider target — per ADR-0003), `foldCloseoutOutcomes` (first terminal per `operationId` authoritative; `failed` retryable), `summarizeCloseout`, `boundCloseoutData` (caps and truncation markers), `renderCloseoutHuman` (deterministic digest within 200 lines/16 KiB), `resolveCloseoutBaseRef`, `isProtectedRef`, `selectMatchingBranch`, `evaluateBranchSafety`. No FNV-1a. (TC-010..014, TC-018, TC-041..052 predicate, TC-059/060, TC-067)
- [ ] **2.3** Enforce determinism: no wall clock, no `Math.random`, no API-return order, no hash-map iteration order. Labels follow the disposition table; dependents order by provider entity identity; threads order by thread identity; operations in a step keep the declared order. Operation ids are distinct per operation and change when any identity input changes, including the capability context. (TC-013, TC-014, TC-018)
- [ ] **2.4** Implement the outcome folding and read-observation rules: plan outcomes `would-apply`/`satisfied`/`skipped-gap`/`skipped-noop`/`would-refuse`; apply outcomes `applied`/`satisfied`/`skipped-gap`/`skipped-noop`/`failed`/`refused`. Declared gaps and no-ops are non-fatal. A safety refusal is `refused` in the plan/apply step and projects `closeout.branch.unsafe` at the command boundary. The planner consumes `observed` / `not-found` / `unavailable` / `invalid` without collapsing them: `not-found` is a target failure, `invalid` stays a payload failure, and an unavailable relation signal is a skip with evidence. (TC-010, TC-011, TC-022, TC-056, TC-067)
- [ ] **2.5** Implement the branch-safety predicate and matching-branch selection from PIN-8 and the BR-01..BR-14 matrix: merged request observed, source-ref convention match, merged-head equality (absent refuses), protected refs, current/foreign/detached/restored checkout, restore-success precondition, and non-gap-failure precondition. A clean detached-at-delivery-head checkout is eligible for restore; an unrelated checkout is not hijacked. Ambiguity is `closeout.target.ambiguous`; unsafe is `closeout.branch.unsafe`; already-absent is `satisfied`. (TC-041..052, TC-066)
- [ ] **2.6** Export the domain surface from `domain/index.ts` and `packages/core/src/index.ts`; in the same commit, update `tests/structure/inventory.json` and add the explicit `EXECUTABLE_ALLOWANCES` entries for `core/src/domain/sha256.ts` (`sha256Hex`) and `core/src/domain/closeout.ts` (`buildCloseoutPlan`, `canonicalCloseoutJson`, `deriveCloseoutOperationId`, `foldCloseoutOutcomes`, `summarizeCloseout`, `boundCloseoutData`, `renderCloseoutHuman`, `resolveCloseoutBaseRef`, `isProtectedRef`, `selectMatchingBranch`, `evaluateBranchSafety`, `closeoutStepDefinitions`) so `bun test tests/structure/content-inventory.test.ts` is green at the Phase 2 boundary (PIN-20/D13). `domain/index.ts` and `packages/core/src/index.ts` re-export via `ExportDeclaration`, which the allowance scan permits without new entries. (TC-001)
- [ ] **2.7** Add `tests/fixtures/closeout/{harness,plan,labels,dependents,threads,request,capabilities,read-observation,branch,canary}.ts` and `tests/fixtures/closeout/golden/**` with fixed `CLOSEOUT_NOW_MS`, fixed run-id sequence, and `SYNTHETIC_BRAND`; add `tests/behaviour/closeout-plan.test.ts` with the **planner-level** half of TC-010/TC-011 (plan/apply equivalence over the pure plan; the in-process CLI half is Phase 7) and TC-012..014, the identity/fold half of `tests/behaviour/closeout-idempotency.test.ts` (TC-018), the planner mapping cases for TC-067 (not-found vs invalid vs unavailable over fake read observations), and the renderer/bounds unit cases used by TC-059/060. The `harness.ts` fake implements the test-plan §4.1 `CloseoutProviderRuntime` contract, including the members pinned in PIN-14/PIN-15 — `readWorkItem`, `readDeliveryRequest`, the merged-request source-ref lookup, `listBlockedByDependents`, `writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread`, and the closeout-specific `readWorkItemObservation` hook returning the discriminated `CloseoutReadObservation` — plus the scripted `fakeNotFound`/`fakeInvalidPayload`/`fakeUnavailableSurface`/`fakeUnavailableRelation`/`fakeUnknownRelation` hooks, and the `CloseoutGitRuntime` safety members (`isClean`, `resolveRef`), so TC-034/036/067 and the checkout predicate are driven as specified. (TC-010..014, TC-018, TC-059/060, TC-067)
- [ ] **2.8** Add the SHA-256 algorithm evidence: assert known-answer vectors for `sha256Hex` (`""` → `e3b0c442...`, `"abc"` → `ba7816bf...`), a committed 64-lowercase-hex expected digest generated from the **same fixed canonical closeout identity tuple** the test uses, a test-only cross-check against `node:crypto` over both the fixed tuple and randomized inputs, and capability-context sensitivity (gap → supported changes the id). Record a regeneration/verification note in the Execution Log: the exact tuple, the `canonicalCloseoutJson` bytes, the independent `node:crypto`/`sha256sum` reproduction, and the committed digest, so the expected value is not merely self-generated. A stability-only assertion is insufficient. (TC-018)

**Acceptance Criteria**:

- Must: the seven steps appear exactly in the declared order and expand deterministically (AC-F2-2, AC-F2-3).
- Must: repeated planning of identical inputs yields byte-identical steps, canonical arguments, and operation identities; permuting provider arrays does not change the plan (AC-F2-1, NFR-2).
- Must: operation identity is `sha256Hex(canonical inputs)` per ADR-0003, stable for identical identity inputs, and changes when any input changes, including the adapter capability context; known-answer vectors pass (AC-F3-4, DM-9).
- Must: the planner distinguishes `observed` / `not-found` / `unavailable` / `invalid` and never collapses them; an unavailable relation signal is a skip with evidence, never an empty blocker set (AC-F4-4, AC-F7-4/6/7, DM-11).
- Must: the label disposition, protected-ref set, and base-resolution rule are exactly PIN-7/PIN-8 (AC-F5-1, AC-F10-3, DM-6, DM-7).
- Must: the branch predicate refuses on unknown head, moved head, protected ref, foreign/dirty worktree, ambiguity, and earlier non-gap failure, accepts a clean detached-at-delivery-head checkout for restore, and deletes only on the full match (AC-F10-1..8, AC-F9-5, NFR-13).
- Should: the renderer is byte-identical across replays and within the human bounds (AC-F13-2, NFR-7).

**Files and modules**:

- Code areas: `packages/core/src/domain/sha256.ts` (new), `packages/core/src/domain/closeout.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/fixtures/closeout/**` (new), `tests/behaviour/closeout-plan.test.ts` (new), `tests/behaviour/closeout-idempotency.test.ts` (new, identity/fold half + SHA-256 KAT), `tests/fixtures/closeout/golden/**` (new).
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

**Goal**: Add the `closeout.operation` record read/write through the existing verified/fenced state port, complete the apply orchestrator's terminal reuse, crash convergence, and failed retry, and implement the engine-side target read-observation mapping and owed-flip signal handling. No schema bump or migration.

**Tasks**:

- [ ] **3.1** Create `packages/core/src/state/closeout.ts` with PIN-13: `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX = "closeout.operations:"`, `closeoutOperationRecordKey(workItemRef)`, `appendCloseoutOutcome(store, handle, record)`, `readCloseoutHistory(store, workItemRef)`, `foldCloseoutHistory(records)`. Payload schema `delivery.closeout.operation.v1`; one record per terminal operation; first terminal per `operationId` authoritative; torn/malformed is the delivered `state.*` error, never zeros. Export from `state/index.ts`. (TC-019)
- [ ] **3.2** Complete the apply orchestrator in `packages/core/src/domain/closeout.ts` (or a sibling `closeout-run.ts` if the file grows): `runCloseout(input)` takes the plan, the provider/git/state runtimes, and the injected ISO timestamp; reuses terminal outcomes; re-observes on `failed`; records `satisfied` when the effect already landed; retries otherwise; stops provider steps on a non-gap failure but still runs a safe local restore; skips branch deletion when a transaction operation failed or the safety predicate fails. Export `runCloseout` and add it to the `EXECUTABLE_ALLOWANCES` entry for `core/src/domain/closeout.ts` in the same commit; if the sibling `core/src/domain/closeout-run.ts` is used instead, add that file to `tests/structure/inventory.json` and give it its own `EXECUTABLE_ALLOWANCES` entry in the same commit. (TC-015..017, TC-040, TC-052)
- [ ] **3.3** Implement the fence boundary in the runtime contract: plan mode calls no `acquireFence`/`append`; apply mode acquires one fence, appends within the bound handle, releases in a `finally`, and surfaces a fence/append/read failure as the classified state identity. (TC-010, TC-011, TC-019)
- [ ] **3.4** Update `tests/structure/inventory.json` and add the `EXECUTABLE_ALLOWANCES` entry for `state/closeout.ts` listing **every** export from PIN-13/3.1, constant first (the `core/src/state/registry.ts` `PHASE_TRANSITION_RECORD_KEY_PREFIX` precedent): `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX`, `appendCloseoutOutcome`, `closeoutOperationRecordKey`, `foldCloseoutHistory`, `readCloseoutHistory`; the exported constant is an executable export under the scanner and must not be omitted. Confirm the Phase 3 `runCloseout` allowance from 3.2; no `port-neutrality` change (state is not the contracts tier). `bun test tests/structure/content-inventory.test.ts` is green at the Phase 3 boundary. (D13)
- [ ] **3.5** Complete `tests/behaviour/closeout-idempotency.test.ts` with the recording fenced state fake: terminal reuse after a fresh composition (TC-015), crash between effect and record (TC-016), failed-outcome retention/retry (TC-017), identity stability/sensitivity (TC-018), ledger append/read/torn/malformed/fence/no-schema-bump (TC-019). (TC-015..019)
- [ ] **3.6** Map the discriminated target read in `runCloseout`: `not-found` → `closeout.target.unobserved` (user-validation, exit 1, **zero provider/git/state writes**), `invalid` → the adapter-local `provider.payload.invalid` (never the not-found code), `unavailable` → a declared gap for ticket-dependent steps (not `closeout.target.unobserved`), `observed` proceeds. A 404 must never be routed to `provider.payload.invalid` and a malformed payload must never be routed to `closeout.target.unobserved`. (TC-067, AC-F4-4)
- [ ] **3.7** Implement the owed-flip signal handling at the engine boundary: no reverse-read surface → provider-level `skipped-gap` (`provider-unsupported`); surface exists but the current reverse read is unavailable/unknown → `skipped-noop` with `relation-signal-unavailable` and **no flip**; an individual candidate with an unavailable/unknown relation signal is skipped with evidence while observed candidates are evaluated; a provider-asserted empty `blocked-by` set means "no blockers" and may flip. Never treat an unasserted `relations: []` as an empty blocker set. (TC-034, TC-036, AC-F7-4/6/7, DM-11)
- [ ] **3.8** Add the engine-level read-observation and signal tests: `tests/behaviour/closeout-read-observation.test.ts` (not-found vs invalid vs unavailable over the fake read outcomes, zero writes on not-found) and the signal-level half of `tests/behaviour/closeout-owed-flip.test.ts` (no-surface gap vs unavailable-signal `skipped-noop`, asserted-empty eligibility). (TC-034, TC-036, TC-067)

**Acceptance Criteria**:

- Must: a re-run in a fresh composition reuses every terminal outcome with zero duplicate mutations and exits 0 (AC-F3-1, NFR-1).
- Must: a crash between a provider effect and the ledger append converges as `satisfied` with no duplicate effect (AC-F3-2).
- Must: a persisted `failed` outcome is retained as evidence and retried safely; a re-run re-observes and can converge (AC-F3-3).
- Must: exactly one record per terminal operation; verified read returns them; a torn/malformed ledger is a classified state error; no schema bump (AC-NFR8-1, NFR-8, EVT-1, DM-4).
- Must: plan mode performs zero state appends and zero fence acquisitions (NFR-4).
- Must: an explicit not-found target fails `closeout.target.unobserved` with zero writes; a malformed payload stays `provider.payload.invalid`; a missing read is a declared gap (AC-F4-4, DM-11).
- Must: owed-flip never flips on an unavailable/unknown signal; no surface is a provider-level gap, a present-but-unavailable signal is `skipped-noop` with `relation-signal-unavailable`, and an asserted empty blocker set is eligible (AC-F7-4/6/7, DM-11).

**Files and modules**:

- Code areas: `packages/core/src/state/closeout.ts` (new), `packages/core/src/state/index.ts` (updated), `packages/core/src/domain/closeout.ts` (updated; also `packages/core/src/domain/closeout-run.ts` if the sibling split is used), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/behaviour/closeout-idempotency.test.ts` (completed), `tests/behaviour/closeout-read-observation.test.ts` (new), `tests/behaviour/closeout-owed-flip.test.ts` (new, signal-level half), `tests/fixtures/state/harness.ts` (reused).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-idempotency.test.ts`
- `bun test tests/behaviour/closeout-read-observation.test.ts`
- `bun test tests/behaviour/closeout-owed-flip.test.ts`
- `bun test tests/structure/closeout-contract.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add closeout idempotency ledger and apply orchestration`

---

### Phase 4: GitHub write adapter, merged-request/head reads, thread resolution, and reverse dependents

**Goal**: Implement the GitHub closeout write and read surface behind the existing injected transport and credential port, including issue close, label add/remove, assignee clear, merged-PR lookup plus `headSha`, GraphQL thread resolution, and a bounded reverse-dependent read. Add GitLab merged-head normalization (read-only). Add fixtures and trap tests.

**Tasks**:

- [ ] **4.1** Widen the transport additively and wire the NFR-6 timeout in `packages/adapters/src/io/provider-transport.ts`: `ProviderHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"`, `ProviderRequest.body?: string`, `ProviderRequest.timeoutMs?: number` (defaults to `CLOSEOUT_OPERATION_TIMEOUT_MS`; tests may pass a short override), and a `ProviderWriteResult<T = void>` result type. Update the native `fetch` defaults in the GitHub/Jira/GitLab clients to forward `body` when present and to pass `signal: AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS)`; reads remain `GET`. (D4, D16; TC-037, TC-020, TC-023, TC-027, TC-063)
- [ ] **4.2** Extend `packages/adapters/src/github/normalize.ts`: `normalizePullRequest` copies `headSha` from `head.sha` only when present (absent stays absent); add `normalizeMergedDeliveryRequestList`, `normalizeIssueDependencies` (reverse dependents with an `observed`/`unavailable`/`invalid` observation), `normalizeThreadResolution` (GraphQL `resolveReviewThread`), and the work-item read observation helper `normalizeWorkItemObservation` (`observed` / `not-found` / `unavailable` / `invalid`). A 404 response is `not-found`; a malformed 2xx body is `invalid`; neither is collapsed into the other. These normalizers are exported for `client.ts`, so add `normalizeMergedDeliveryRequestList`, `normalizeIssueDependencies`, `normalizeThreadResolution`, and `normalizeWorkItemObservation` to the `EXECUTABLE_ALLOWANCES` entry for `adapters/src/github/normalize.ts` in the same commit; `bun test tests/structure/content-inventory.test.ts` is green at the Phase 4 boundary. (TC-006, TC-031..036, TC-037, TC-067)
- [ ] **4.3** Extend `packages/adapters/src/github/client.ts` with PIN-14: `findMergedDeliveryRequest({ workItemRef, limit })` (closed pulls, merged only, source-ref convention filter) returning an observation, `listBlockedByDependents({ entityId, limit })` (bounded issue-dependencies read; implementation-confirmed assumption, absent surface reported as unavailable) returning an observation, `writeWorkItem({ entityId, add?, remove?, assignee? })`, `transitionWorkItem({ entityId, deliveryState: "done" })`, `resolveDeliveryThread({ deliveryRequest, threadId })` (GraphQL `POST /graphql`), and the closeout-specific `readWorkItemObservation({ entityId })` member that returns the discriminated `CloseoutReadObservation<WorkItem>`. **The existing `readWorkItem` return shape is unchanged**, so its provider-view consumers `tests/types/provider-views.type-test.ts` and `tests/behaviour/providers/*` need no edits; `packages/testkit/src/conformance/types.ts` keeps its `readWorkItem` typing (its only edit is the Phase 1.6 additive write-member change); if that shape is ever changed instead, add those areas to Phases 4/5. Credentials resolve only through `CredentialPort`; no ambient environment read. Add internal helpers in `packages/adapters/src/github/closeout.ts` if needed; if that conditional file is created with exported executables, add it to `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` in the same commit. (TC-020..030, TC-037..040, TC-057/058, TC-067)
- [ ] **4.4** Flip the GitHub capability declaration to the final split in the same commit as the implementation: supported `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `resolve-delivery-thread`; gaps `write-comment` and `write-delivery-request` (`adapter-not-implemented`). Update the **exact assertion files in the same commit**: `tests/fixtures/ports/capabilities.ts` `EXPECTED_SEED_POSTURES.github` (supported set and gap reasons), `tests/behaviour/providers/provider-capabilities.test.ts` (expected methods), and `tests/structure/provider-surface.test.ts` — its hardcoded `GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations` array and its `Object.keys(client)` list must change to the new supported operations and client members. **No new provider-subpath export:** keep every new closeout helper and observation type internal to `packages/adapters/src/github/closeout.ts` or in the core contracts; do not add a name to `packages/adapters/src/github/index.ts`, so `EXPECTED_SURFACE.github` stays unchanged. (TC-053, TC-055, TC-002)
- [ ] **4.5** Add sanitized fixtures: `tests/fixtures/providers/github/closeout-issues.json`, `closeout-pulls-merged.json`, `closeout-dependencies.json`, `closeout-labels.json`, `closeout-assignee.json`, `graphql-resolve-thread.json`, plus `closeout-read-not-found.json`, `closeout-read-malformed.json`, and relation-signal `observed`/`unavailable` variants; extend the GitHub trap catalog with the new write/read entries. (TC-020..040, TC-053, TC-067)
- [ ] **4.6** Add behaviour tests: the GitHub half of `tests/behaviour/closeout-ticket-labels.test.ts` (TC-020..025, TC-067 not-found/malformed), `tests/behaviour/closeout-unassign.test.ts` (TC-027..030), the GitHub half of `tests/behaviour/closeout-owed-flip.test.ts` (TC-031..036), `tests/behaviour/closeout-threads.test.ts` (TC-037..040), `tests/behaviour/closeout-request.test.ts` (TC-057/058), `tests/behaviour/closeout-read-observation.test.ts` (provider-level observation), and `tests/behaviour/providers/github-closeout.test.ts` (trap/argument assertions). Update the **exact trap replay assertions** in `tests/behaviour/providers/github-trap.test.ts`: the `run.results.map((result) => result.trapName)` array and the `defaultAssertions` map must include every new GitHub trap entry. (TC-020..040, TC-053, TC-057/058, TC-067)
- [ ] **4.7** Add the production conformance write-execution path and GitHub routes in the same commit: the runner prefers `registration.writeHandler` (test control) then the client write member then fails closed; add `writeWorkItem`/`transitionWorkItem`/`resolveDeliveryThread` to the GitHub registration; add the GitHub mock-tenant write routes, the `POST /graphql` `resolveReviewThread` route, and `threadId` addressing; update `tests/conformance/mock-conformance.test.ts` (GitHub operation matrix now executes the supported writes) and `artifact.test.ts`. Update `tests/conformance/broken-adapter-control.test.ts` so `corruptRegistration` **preserves the base client's write members** (`writeWorkItem`/`transitionWorkItem`/`resolveDeliveryThread`) or supplies a `writeHandler`, so the runner reaches and reports the corrupted read instead of failing closed on the write branch. Update `tests/conformance/live/live-entrypoint.test.ts`'s mock-tier inline transport to match `method + URL` (or route it through the shared `createFixtureTransport`), so a POST/PATCH write cannot receive a GET read fixture. Make `tests/behaviour/providers/support.ts` `createFixtureTransport` **method-aware** (`method + url`, with `FixtureRoute.method` optional and defaulting to `GET`, so existing route fixtures need no edits); add a method-mismatch negative control that asserts the transport throws (or route write tests through the `CloseoutProviderRuntime` fake). Run `bun test tests/conformance` at this boundary. (TC-002, TC-006, TC-037, TC-053, TC-055)
- [ ] **4.8** Prove the runtime-coverage invariant for the GitHub writes (TC-065): run the mock conformance suite and assert `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty; assert `write-work-item`, `transition-work-item`, and `resolve-delivery-thread` each have an `executed` step for GitHub; add a temp-copy mutation that drops an executed write step (or declares an unexecuted operation supported) and assert a provider/operation-named violation. (TC-065, AC-F11-1/4)
- [ ] **4.9** Add the GitLab `normalizeMergeRequest` `headSha` copy and a paired present/absent fixture; verify the GitLab capability declaration still declares every write (including `resolve-delivery-thread`) and `read-work-item` as gaps. (TC-006, TC-055)

**Acceptance Criteria**:

- Must: an open item closes; labels add/remove exactly the named labels; assignee clear is explicit even when the signal is absent; each outcome is `applied` or `satisfied` as specified (AC-F4-1/2, AC-F5-1/2, AC-F6-1/2/4).
- Must: a merged PR is resolved deterministically by source ref and highest numeric entity identity; `headSha` round-trips verbatim and stays absent when absent (AC-F12-1/2/3, DM-8).
- Must: each unresolved thread resolves once through GraphQL; already-resolved is `satisfied`; a no-request is `skipped-noop`; a write failure is `closeout.write.failed` and retries safely (AC-F8-1/3/4).
- Must: the owed-flip step adds `hand-back`, removes a present `blocked`, names the open-blocker count, never flips on unknown or an unavailable signal, and respects the 200 cap; a provider-asserted empty blocker set is eligible (AC-F7-1..7).
- Must: an explicit target not-found is `closeout.target.unobserved` with zero writes, a malformed payload is `provider.payload.invalid` (never not-found), and a missing read is a declared gap (AC-F4-4, DM-11; TC-067).
- Must: GitHub declares the documented supported set and gaps; unsupported operations are `skipped-gap`, never success (AC-F11-1/4, NFR-9).
- Must: every newly supported GitHub write executes in mock conformance; `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty (TC-065, AC-F11-1/4).
- Must: every provider request is bounded by `AbortSignal.timeout(CLOSEOUT_OPERATION_TIMEOUT_MS)`; a never-resolving transport aborts (NFR-6).
- Must: no provider-native type crosses the subpath surface; no ambient environment or secret read exists (NFR-12).
- Must: the exact provider-surface, seed-posture, trap-replay, and conformance-matrix assertions are updated in the same commit (they fail closed otherwise).
- Must: every new executable export in `adapters/src/github/normalize.ts` (and any conditional `github/closeout.ts`) is declared in `tests/structure/content-inventory.test.ts`; `bun test tests/structure/content-inventory.test.ts` is green at this boundary.

**Files and modules**:

- Code areas: `packages/adapters/src/io/provider-transport.ts` (updated), `packages/adapters/src/github/{client,normalize,capabilities,index}.ts` (updated), `packages/adapters/src/github/closeout.ts` (new, optional), `packages/adapters/src/gitlab/normalize.ts` (updated), `packages/adapters/src/gitlab/capabilities.ts` (Phase 1 update verified), `tests/fixtures/providers/github/**` (new/updated), `tests/fixtures/providers/traps/github.traps.json` (updated), `tests/fixtures/ports/capabilities.ts` (updated), `tests/behaviour/closeout-{ticket-labels,unassign,owed-flip,threads,request,read-observation}.test.ts` (new/updated), `tests/behaviour/providers/{github-closeout,github-trap,provider-capabilities,support}.ts` (new/updated), `tests/structure/provider-surface.test.ts` (updated), `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` (updated for `github/normalize.ts` and any conditional `github/closeout.ts`), `tests/conformance/mock-conformance.test.ts` (updated), `tests/conformance/broken-adapter-control.test.ts` (updated), `tests/conformance/live/live-entrypoint.test.ts` (updated).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-ticket-labels.test.ts`
- `bun test tests/behaviour/closeout-unassign.test.ts`
- `bun test tests/behaviour/closeout-owed-flip.test.ts`
- `bun test tests/behaviour/closeout-threads.test.ts`
- `bun test tests/behaviour/closeout-request.test.ts`
- `bun test tests/behaviour/closeout-read-observation.test.ts`
- `bun test tests/behaviour/providers`
- `bun test tests/behaviour/providers/provider-capabilities.test.ts`
- `bun test tests/conformance`
- `bun test tests/conformance/broken-adapter-control.test.ts`
- `bun test tests/conformance/live/live-entrypoint.test.ts`
- `bun test tests/structure/provider-surface.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun test tests/structure/port-contract-inventory.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add GitHub closeout writes, merged reads and thread resolution`

---

### Phase 5: Jira write adapter — done transition, label-preserving replace, assignee clear, reverse dependents

**Goal**: Implement the Jira closeout writes and bounded reverse-dependent read behind the existing transport and credential port, with the full-array label-replace preservation trap. GraphQL is not applicable.

**Tasks**:

- [ ] **5.1** Extend `packages/adapters/src/jira/client.ts` with PIN-15: `writeWorkItem({ issueKey, add?, remove?, assignee? })` (full-array label replace computed from the provider-asserted labels at execution time; assignee clear), `transitionWorkItem({ issueKey, deliveryState: "done" })` (data-driven transition from `JIRA_WORKFLOW_MAP`), `listBlockedByDependents({ issueKey, limit })` (bounded JQL via `searchWorkItems`) returning an `observed`/`unavailable`/`invalid` observation, and the closeout-specific `readWorkItemObservation({ issueKey })` member as the additive carrier (the existing `readWorkItem` return shape is unchanged, so its provider-view consumers `tests/types/provider-views.type-test.ts` and `tests/behaviour/providers/*` need no edits; `packages/testkit/src/conformance/types.ts` keeps its `readWorkItem` typing and only carries the Phase 1.6 additive write-member edit). An explicit 404 is `not-found`, a malformed payload is `invalid`, and a missing signal is `unavailable`. No GraphQL. The Jira native-fetch default also carries `AbortSignal.timeout(CLOSEOUT_OPERATION_TIMEOUT_MS)`. (TC-020, TC-023, TC-026, TC-027..030, TC-031..036, TC-067)
- [ ] **5.2** Extend `packages/adapters/src/jira/normalize.ts` and `workflow-map.ts` with the write request/response helpers: label target-set computation, transition request construction, reverse-dependent normalization, and the `normalizeJiraWorkItemObservation` read-observation helper. Preserve every label not named for removal; never whole-array overwrite; an unavailable label signal yields `skipped-noop` with `label-signal-unavailable`. Export the new helpers and add every new executable name to the `EXECUTABLE_ALLOWANCES` entries for `adapters/src/jira/normalize.ts` and `adapters/src/jira/workflow-map.ts` in the same commit; if the conditional `packages/adapters/src/jira/closeout.ts` is created with exported executables, add it to `tests/structure/inventory.json` and a new allowance entry in the same commit. `bun test tests/structure/content-inventory.test.ts` is green at the Phase 5 boundary. (TC-026, TC-067)
- [ ] **5.3** Flip the Jira capability declaration to the final split in the same commit as the implementation: supported `read-work-item`, `write-work-item`, `transition-work-item`; gaps `write-comment` (`adapter-not-implemented`), `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `resolve-delivery-thread` (`provider-unsupported`). Update the **exact assertion files in the same commit**: `tests/fixtures/ports/capabilities.ts` `EXPECTED_SEED_POSTURES.jira`, `tests/behaviour/providers/provider-capabilities.test.ts`, and `tests/structure/provider-surface.test.ts` if it pins the Jira supported/client surface. (TC-054, TC-002)
- [ ] **5.4** Add sanitized fixtures: `tests/fixtures/providers/jira/closeout-transitions-write.json`, `closeout-labels-replace-write-{before,after}.json`, `closeout-assignee.json`, `closeout-dependents.json`, plus `closeout-read-not-found.json`, `closeout-read-malformed.json`, and relation-signal `observed`/`unavailable` variants; extend `tests/fixtures/providers/traps/jira.traps.json` with the write/label-preservation entries. (TC-020..036, TC-054, TC-067)
- [ ] **5.5** Add the Jira half of `tests/behaviour/closeout-ticket-labels.test.ts` (TC-020/023/026, TC-067), `tests/behaviour/closeout-unassign.test.ts` (TC-027..030), the Jira half of `tests/behaviour/closeout-owed-flip.test.ts` (TC-031..036), `tests/behaviour/closeout-capabilities.test.ts` (TC-054), and `tests/behaviour/providers/jira-closeout.test.ts` (trap/argument assertions). Update the **exact trap replay assertions** in `tests/behaviour/providers/jira-trap.test.ts`: the `run.results.map((result) => result.trapName)` array and the `defaultAssertions` map must include every new Jira trap entry. (TC-020..036, TC-054, TC-067)
- [ ] **5.6** If the minimal client cannot satisfy label-replace, transition, or assignee-clear semantics, record the `jira.js` re-evaluation trigger in the execution log before expanding the client; do not silently widen the boundary. Add the Jira write members to the conformance registration and the Jira write routes to the mock tenant; the runner's production write-execution branch landed in Phase 4. Update `tests/conformance/mock-conformance.test.ts` so the Jira operation matrix executes the newly supported writes and the exact gap-reason assertions still name `read-delivery-request`/`read-pipeline-run`/`write-delivery-request`/`write-comment`/`resolve-delivery-thread` as declared gaps with their reasons. (D8; TC-054, TC-065)
- [ ] **5.7** Prove the runtime-coverage invariant for the Jira writes (TC-065): `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty; `write-work-item` and `transition-work-item` each have an `executed` step for Jira; `resolve-delivery-thread` remains a declared gap encountered with `provider-unsupported`; a temp-copy mutation that marks an unexecuted Jira write supported fails with a provider/operation-named violation. (TC-065, AC-F11-2/4)

**Acceptance Criteria**:

- Must: the done transition is data-driven and lands as `applied`; an already-done item is `satisfied`; a missing mapping is `skipped-gap` (AC-F4-1/2/3).
- Must: the label replace removes only the named lifecycle labels, adds `delivered`, and preserves every other label; the trap fixture proves it (AC-F5-1/4).
- Must: unassign issues an explicit clear even when the assignee signal is absent; a re-run is `satisfied` with no duplicate clear (AC-F6-1/2/4).
- Must: the owed-flip sweep adds `hand-back`, removes a present `blocked`, never flips on an unavailable/unknown signal, and treats a provider-asserted empty blocker set as eligible (AC-F7-1..7).
- Must: an explicit Jira target not-found is `closeout.target.unobserved` with zero writes; a malformed payload is `provider.payload.invalid`, never not-found (AC-F4-4, DM-11; TC-067).
- Must: Jira declares `resolve-delivery-thread` as `provider-unsupported` and the step skips with evidence; no Jira thread write exists (AC-F8-2, AC-F11-2).
- Must: every newly supported Jira write executes in mock conformance and the runtime-coverage invariant is empty (TC-065).
- Must: every new executable export in `adapters/src/jira/normalize.ts` and `adapters/src/jira/workflow-map.ts` (and any conditional `jira/closeout.ts`) is declared in `tests/structure/content-inventory.test.ts`; `bun test tests/structure/content-inventory.test.ts` is green at this boundary.
- Should: the Jira write basis is proven before delivery; if it is insufficient, the trigger is recorded and the boundary is not silently widened.

**Files and modules**:

- Code areas: `packages/adapters/src/jira/{client,normalize,workflow-map,capabilities,index}.ts` (updated), `packages/adapters/src/jira/closeout.ts` (new, optional), `tests/fixtures/providers/jira/**` (new/updated), `tests/fixtures/providers/traps/jira.traps.json` (updated), `tests/fixtures/ports/capabilities.ts` (updated), `tests/behaviour/closeout-{ticket-labels,unassign,owed-flip,capabilities}.test.ts` (updated), `tests/behaviour/providers/{jira-closeout,jira-trap,provider-capabilities}.test.ts` (new/updated), `tests/structure/provider-surface.test.ts` (updated if Jira is pinned), `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` (updated for `jira/normalize.ts`, `jira/workflow-map.ts`, and any conditional `jira/closeout.ts`), `tests/conformance/mock-conformance.test.ts` (updated), `tests/fixtures/providers/conformance/jira/tenant.json` (updated).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-ticket-labels.test.ts`
- `bun test tests/behaviour/closeout-unassign.test.ts`
- `bun test tests/behaviour/closeout-owed-flip.test.ts`
- `bun test tests/behaviour/closeout-capabilities.test.ts`
- `bun test tests/behaviour/closeout-read-observation.test.ts`
- `bun test tests/behaviour/providers`
- `bun test tests/behaviour/providers/provider-capabilities.test.ts`
- `bun test tests/conformance`
- `bun test tests/structure/content-inventory.test.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add Jira closeout writes and label-preserving replace`

---

### Phase 6: Dedicated git branch/checkout seam, runtime confinement, and safety fixtures

**Goal**: Add the `@delivery-os/adapters/git` subpath and port for checkout restore, branch enumeration/deletion, and safety queries; admit it as one exact runtime-confinement entry; prove the read-only `repo` reader remains no-spawn. The closeout engine already exists from Phases 2/3; this phase adds only the git seam and its evidence, and no CLI yet.

**Tasks**:

- [ ] **6.1** Create `packages/adapters/src/git/index.ts` with PIN-16: `createGitBranchSeam(options)` and the `GitBranchSeam` methods `readCheckout`, `listBranches`, `readBranch`, `isCheckedOutElsewhere`, `isClean`, `resolveRef`, `restoreCheckout`, `deleteBranch`. `GitCheckoutFacts` distinguishes the delivery branch, detached-at-delivery-head, base, unrelated, and missing states. Use `execFile`/`spawn` with a fixed argv, no shell, no network, no arbitrary command; validate canonical refs/branch names; local-only. Every child process passes `{ timeout: options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS, killSignal: "SIGKILL" }` (`GitBranchSeamOptions.timeoutMs` defaults to the constant); a timeout aborts the process and blocks deletion. `GitBranchSeamOptions` also exposes the test-only `childRunner?: GitChildRunner` injection seam (production default `execFile`); the seam substitutes only the child process, never the fixed-argv allowlist, so a non-terminating child is drivable hermetically. Credentials are not involved. (TC-041..052, TC-063, TC-066)
- [ ] **6.2** Update `packages/adapters/package.json` with the `./git` export and `#git/*` import; update `packages/cli/package.json` `workspaceImports` with `./git`; update `tests/structure/subpaths.test.ts` with `./git`; update `tests/structure/inventory.json` and add the `EXECUTABLE_ALLOWANCES` entry for `src/git/index.ts` (`createGitBranchSeam`; the exported types need no allowance) in the same commit. Update the **hardcoded workspace-entrypoint registry** `scripts/checks/workspace-entrypoints.ts`: add `"./git"` to `ADAPTER_SUBPATHS` so the derived `EXPECTED_ENTRYPOINTS` entries for cli/mcp/opencode/testkit all include it. (TC-008)
- [ ] **6.3** Update `.dependency-cruiser.cjs` with one exact, reason-bearing `runtime-apis-confinement` entry for `^packages/adapters/src/git/`; add allowed and denied fixtures to `tests/boundaries/fixture-registry.json` and `tests/boundaries/fixtures/cases.ts`. Keep the read-only `repo` reader's existing `node:fs` allowance unchanged and add an explicit no-spawn AST assertion (no `node:child_process`, `Bun.spawn`, or `Deno.Command`) with a planted-spawn negative control. (TC-008, NFR-12)
- [ ] **6.4** Prove read-only isolation: `tests/structure/closeout-imports.test.ts` scans `status`, `queue ready`, and `verify change` for imports of the closeout engine, provider write path, or git seam and for spawn/write members; the existing zero-write/zero-spawn suites remain green. (TC-007)
- [ ] **6.5** Add the temp-git harness (`mkdtemp` + `git init` + commits/branches/worktrees) and the full BR-01..**BR-14** cases: clean restore, already-on-base, unrelated checkout, dirty worktree, missing base, matching head delete, moved head refuse, protected refs, foreign worktree, already-absent, ambiguity, unknown head, provider-failure interaction, **clean detached-at-delivery-head restore (BR-13)**, and **dirty/missing-base detached refusal (BR-14)**. `tests/fixtures/closeout/branch.ts` covers BR-01..BR-12 with expected outcomes; the temp-repo harness owns BR-13/BR-14, matching test-plan §6.2. (TC-041..052, TC-066)
- [ ] **6.6** Add `tests/behaviour/closeout-checkout.test.ts` (TC-041..044, TC-066) and `tests/behaviour/closeout-branch.test.ts` (TC-045..052); assert recorded arguments (base ref, branch name), not inferred side effects; assert no remote/fetch/push call; assert the detached-at-delivery-head case restores when clean and refuses when dirty or the base is missing (no deletion), with an attached-delivery-branch control and a detached-as-unrelated mutant. (TC-041..052, TC-066)
- [ ] **6.7** Wire and prove the git timeout (TC-063): assert `packages/adapters/src/git/index.ts` references `CLOSEOUT_OPERATION_TIMEOUT_MS` as the production default in the `execFile`/`spawn` options (structural, with a removal control) and add a behavioral case with a short `timeoutMs` override where the injected `GitChildRunner` never resolves and the seam aborts at the bound, surfacing a classified failure with no deletion. (TC-063, NFR-6)
- [ ] **6.8** Run the boundary and confinement evidence: `bun test tests/structure/closeout-imports.test.ts`, `bun test tests/boundaries`, `pnpm check:boundaries`, `bun run scripts/checks/workspace-entrypoints.ts`. (TC-007, TC-008)

**Acceptance Criteria**:

- Must: checkout restore targets the resolved base (merged target, else `main-tools`), already-on-base is `satisfied`, unrelated checkout is `satisfied` with `already-elsewhere`, a clean detached-at-delivery-head checkout restores, and dirty/missing-base refuses with `closeout.branch.unsafe` and no deletion (AC-F9-1..5).
- Must: a squash-merged branch with matching merged head deletes once and touches no remote; a moved head refuses; protected refs are never attempted; a foreign worktree refuses; already-absent is `satisfied`; ambiguity is `closeout.target.ambiguous`; unknown head refuses (AC-F10-1..8, NFR-13).
- Must: the git seam is the only new spawn surface; the read-only `repo` reader remains no-spawn; `status`/`queue ready`/`verify change` import neither the seam nor the write path (AC-F15-1, NFR-5).
- Must: every git child process is bounded by `CLOSEOUT_OPERATION_TIMEOUT_MS`; a non-terminating child aborts (NFR-6, TC-063).
- Must: `workspace-entrypoints.ts` (`ADAPTER_SUBPATHS`/`EXPECTED_ENTRYPOINTS`) includes `./git`; the check is green (TC-008).
- Must: no remote branch operation, force push, or history rewrite exists (NG-2).
- Should: every safety predicate has a positive and a negative fixture; the boundary meta-check fails an unregistered or unenforced case.

**Files and modules**:

- Code areas: `packages/adapters/src/git/index.ts` (new), `packages/adapters/package.json` (updated), `packages/cli/package.json` (updated), `.dependency-cruiser.cjs` (updated), `scripts/checks/workspace-entrypoints.ts` (updated), `tests/structure/{subpaths,inventory,content-inventory,closeout-imports}.test.ts` (updated/new), `tests/boundaries/{fixture-registry.json,fixtures/cases.ts}` (updated), `tests/behaviour/closeout-{checkout,branch}.test.ts` (new), `tests/fixtures/closeout/branch.ts` (new).
- System docs: none (Phase 11).

**Tests**:

- `pnpm build`
- `bun test tests/behaviour/closeout-checkout.test.ts`
- `bun test tests/behaviour/closeout-branch.test.ts`
- `bun test tests/structure/closeout-imports.test.ts`
- `bun test tests/structure/subpaths.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun test tests/boundaries`
- `pnpm check:boundaries`
- `bun run scripts/checks/workspace-entrypoints.ts`
- `pnpm typecheck`

**Completion signal**: `feat(GH-183): add git branch/checkout seam with confinement`

---

### Phase 7: CLI `closeout` command, composition, rendering, and changeset

**Goal**: Deliver the command surface and composition: grammar, plan/apply, rendering, envelope, exit projection, command registration, inventory, and the five-package changeset. The handler delegates; the CLI edge owns rendering and exit.

**Tasks**:

- [ ] **7.1** Create `packages/cli/src/commands/closeout.ts` with PIN-17: `CloseoutCommandRuntime` (`plan(input)`, `apply(input)`), `createCloseoutCommandDefinition` (flags `["--apply"]`, `positionals: { max: 2 }` — exactly one extra positional reaches the handler and is rejected as `input.value.rejected`; two or more extra positionals are rejected by the parser as `fallback.invocation` before the handler (G-09); handler validates exactly one canonical `PREFIX-NUMBER` ref **case-sensitively with no case folding** and rejects a lowercase/malformed ref with `input.value.rejected`; an unknown flag is `fallback.invocation` before the handler; `--apply` is the only mutation switch; the handler never inspects `--json`; `humanText: renderCloseoutHuman`). (TC-010..012, TC-059..061)
- [ ] **7.2** Export the definition from `packages/cli/src/commands/index.ts`; add `CloseoutComposition` and `createCloseoutCommandRuntime` in `packages/cli/src/edge.ts`, composing the provider runtimes (GitHub/Jira/GitLab), the git seam, the state store, the injected clock, and the fence-token factory; register `commands.closeout` in `createConfigProgram` only when the composition is supplied. (TC-010, TC-011)
- [ ] **7.3** Preserve read-only composition: `createProductionDependencies`, the `status`/`queue`/`verify` runtimes, and the existing command definitions are unchanged; the closeout handler is the only new entry point. (TC-007)
- [ ] **7.4** Implement the plan/apply boundary: plan performs zero provider writes, zero git mutations, zero state appends, zero fence acquisitions; apply acquires the fence, executes the plan, persists outcomes, and releases the fence; failures return the classified identity and the CLI projects the exit. (TC-010, TC-011)
- [ ] **7.5** In the same commit, update `tests/structure/inventory.json`, add the `EXECUTABLE_ALLOWANCES` entry for `cli/src/commands/closeout.ts` (`createCloseoutCommandDefinition`; the `CloseoutCommandRuntime` type needs no allowance), and append `createCloseoutCommandRuntime` to the existing `cli/src/edge.ts` allowance entry; keep `tests/structure/cli-edge-seam.test.ts` green (no ambient env read, no stream write outside the serializer) and `bun test tests/structure/content-inventory.test.ts` green at the Phase 7 boundary. (D13; TC-007)
- [ ] **7.6** Complete the **in-process CLI-level** half of TC-010/TC-011 in `tests/behaviour/closeout-plan.test.ts` (the Phase 2 half was planner-level): run `closeout GH-183 --json` through `runCli`/`createProgram`, assert one `delivery.closeout.v1` envelope, the seven ordered steps, plan outcomes, zero writes/git mutations/state appends/fences, then run `--apply` and assert the same plan/identities with apply outcomes. Add the CLI-level grammar matrix (TC-012, G-01..G-09) including the one-extra handler case (G-02) and the two-or-more-extra parser case (G-09), and the TC-003 trigger/exit half (each of the four identities emitted with its documented fields and exit 1/2), plus the TC-067 output/exit half (not-found exits 1 with zero writes; invalid payload is `provider.payload.invalid`). (TC-003, TC-010, TC-011, TC-012, TC-061, TC-067)
- [ ] **7.7** Add the golden/output tests: `tests/behaviour/closeout-output.test.ts` (TC-059..061), `tests/golden/closeout-envelope.test.ts`, `tests/golden/closeout-human.test.ts` with fixed clock/run id; assert one envelope, caps, deterministic truncation, no forbidden content, byte-identical human output. (TC-059..061)
- [ ] **7.8** Add `.changeset/gh-183-closeout-minor.md` with a `minor` bump for exactly the five fixed-group packages; run `bun run scripts/checks/changesets-group.ts` and `bun run scripts/checks/testkit-exclusion.ts`. (TC-009)

**Acceptance Criteria**:

- Must: `closeout <workItemRef>` without `--apply` returns a success envelope with the deterministic ordered plan and performs no mutation; `--apply` executes the same plan with per-operation outcomes; both are asserted **in-process through the CLI composition** (AC-F1-1/2, NFR-4).
- Must: malformed/missing/lowercase ref or exactly one extra positional fails as `input.value.rejected`; two or more extra positionals or an unknown flag fail as `fallback.invocation`; all exit 1 with zero source/runtime calls; no case folding occurs (AC-F1-3; test-plan G-02/G-05/G-09).
- Must: machine output is exactly one bounded `delivery.closeout.v1` envelope; human output is byte-identical and within 200 lines/16 KiB; neither leaks forbidden content (AC-F13-1/2, NFR-7).
- Must: each closeout failure identity carries its documented fields and exits 1 or 2 by projection class; no exit literal exists outside the CLI projection (AC-F14-1, NFR-11).
- Must: a target not-found exits 1 with zero writes and an invalid payload stays `provider.payload.invalid` at the CLI boundary (AC-F4-4; TC-067).
- Must: the changeset is a minor for the five fixed-group packages; `testkit` is excluded (NFR-10, TC-009).

**Files and modules**:

- Code areas: `packages/cli/src/commands/closeout.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/behaviour/closeout-plan.test.ts` (updated, in-process CLI half), `tests/behaviour/closeout-output.test.ts` (new), `tests/golden/closeout-*.test.ts` (new), `.changeset/gh-183-closeout-minor.md` (new).
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

- [ ] **8.1** Add `tests/behaviour/closeout-integration.test.ts` covering spec §6 flows 1–7: dry-run plan with zero mutation; apply happy path in order; re-run after restart with zero duplicates; declared-gap transaction (GitLab-style) exiting 0; safety refusal retaining the branch; provider write failure still restoring the checkout safely and retaining the branch, then converging on re-run; target not-found exiting 1 with zero writes while an invalid payload stays `provider.payload.invalid`. (TC-010, TC-011, TC-015..017, TC-040, TC-052, TC-056, TC-067)
- [ ] **8.2** Add `tests/behaviour/closeout-hermetic.test.ts` and extend `tests/checks/fixture-sanitization.test.ts`: no live network/credentials/host-env reads; the throwing-fetch guard sees zero calls; the planted canary is present in fixtures and absent from output/ledger; the ledger evidence contains no forbidden content. (TC-059, TC-060, TC-062)
- [ ] **8.3** Add `tests/checks/closeout-mutants.test.ts` and `tests/fixtures/closeout/mutants/**`: each broken guard (label disposition, unknown-blocker, unavailable-signal-as-empty, merged-head equality, protected set, worktree-blind delete, detached-as-unrelated, gap-as-success, wide projection, terminal-reuse bypass, `Date.now()` plan, FNV-1a/omitted-capability identity, read-only import/spawn, success-on-partial) fails the intended suite naming the case; an unchanged control passes. (TC-064)
- [ ] **8.4** Prove bounded work and the timeout wiring: owed-flip at 200/201/larger; threads at 100/101; **structural** assertion that `CLOSEOUT_OPERATION_TIMEOUT_MS` is the production default referenced on each provider native-fetch default and on the git `execFile`/`spawn` options (with a removal control); **behavioral** assertion that a short injected timeout with a never-resolving provider transport and a never-settling injected `GitChildRunner` aborts at the bound (no 30 s wall-clock wait); the reference-fixture p95 is recorded or "not run" (non-CI per GAP-T2); no unbounded wait. (TC-035, TC-037, TC-063)
- [ ] **8.5** Prove the read-observation and signal split end to end: `tests/behaviour/closeout-read-observation.test.ts` (not-found vs invalid vs unavailable; 404 never `provider.payload.invalid`; zero writes on not-found), the owed-flip no-surface gap vs present-but-unavailable `skipped-noop` cases, and the clean/dirty/missing-base detached-HEAD cases (TC-066). (TC-034, TC-036, TC-066, TC-067)
- [ ] **8.6** Prove read-only isolation, capability honesty, and runtime coverage in the integrated tree: `tests/structure/closeout-imports.test.ts` (TC-007/008), `tests/behaviour/closeout-capabilities.test.ts` (TC-053..056), `tests/conformance/mock-conformance.test.ts` with `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` empty and every supported write executed (TC-065), the exact `provider-capabilities`/`provider-surface`/trap assertions, the unchanged `status`/`queue ready`/`verify change` suites, and `pnpm check:boundaries`. Also assert the two conformance controls still behave after the integrated capability flips: `tests/conformance/broken-adapter-control.test.ts` reaches and reports the corrupted read with preserved write members, and `tests/conformance/live/live-entrypoint.test.ts`'s mock-tier inline transport matches `method + URL`. (TC-007, TC-008, TC-053..056, TC-065)
- [ ] **8.7** Run the full offline battery and record results with commands, HEAD, and environment: `pnpm install --frozen-lockfile` → `pnpm build` → `bun test tests/structure tests/behaviour` → `bun test tests/checks` → `bun test tests/boundaries` → `bun test tests/golden` → `bun test tests/conformance` → `bun run scripts/checks/{error-table-sync,exit-code-literals,ambient-globals,secret-read-boundary,workspace-entrypoints,license-audit,vulnerability-gate}.ts` → `pnpm check:boundaries` → `pnpm typecheck` → `pnpm check` → `bash scripts/.tests/test-doc-distribution.sh` → `git diff --check` → `git status --porcelain`. (All TCs; TC-009, TC-062, TC-064, TC-065)

**Acceptance Criteria**:

- Must: all seven spec flows are evidenced, including the provider-failure/local-restore interaction, the restart convergence, and the not-found vs malformed target discrimination (AC-F3-1/2, AC-F4-4, AC-F10-8, NFR-1).
- Must: the battery is offline and hermetic; no live provider, credential, socket, or network call exists; the canary proves the no-leak boundary (AC-NFR3-1, NFR-3, NFR-12).
- Must: every negative/gap/cap/refusal guard has a paired live control and a mutant that fails naming the case (TC-064, §4.2).
- Must: read-only commands still perform zero writes and zero spawns and import neither the git seam nor the provider write path (AC-F15-1, NFR-5).
- Must: the timeout is proven structurally and behaviorally on provider and git I/O, and bounded work is asserted in CI (caps, invariant counts, declared timeouts); the reference p95 is recorded or explicitly "not run", never claimed (NFR-6, GAP-T2; TC-063).
- Must: `runtimeCoverageViolations(report, CONFORMANCE_ADAPTERS, "mock")` is empty and every newly supported write has an executed step (TC-065, AC-F11-1/2/4).
- Must: `pnpm check` is green in a clean checkout; the license gate is green with zero new dependencies (AC-NFR10-1, NFR-10).

**Files and modules**:

- Code areas: `tests/behaviour/closeout-integration.test.ts` (new), `tests/behaviour/closeout-hermetic.test.ts` (new), `tests/behaviour/closeout-read-observation.test.ts` (updated), `tests/checks/closeout-mutants.test.ts` (new), `tests/fixtures/closeout/{canary,plan,dependents,threads,golden,mutants}` (new/updated), `tests/checks/fixture-sanitization.test.ts` (updated), `tests/structure/closeout-imports.test.ts` (updated), `tests/behaviour/closeout-capabilities.test.ts` (updated), `tests/conformance/mock-conformance.test.ts` (updated), `tests/conformance/broken-adapter-control.test.ts` (updated), `tests/conformance/live/live-entrypoint.test.ts` (updated), `tests/behaviour/providers/{provider-capabilities,github-trap,jira-trap}.test.ts` (updated), `tests/structure/{provider-surface,port-contract-inventory}.test.ts` (updated).
- System docs: none (Phase 11).

**Tests**:

- The full battery in task 8.7; per-TC evidence recorded in the plan Execution Log and the test plan §10.

**Completion signal**: `test(GH-183): add closeout integration, hermeticity and non-vacuity evidence`

---

### Phase 9: Code Review (Analysis)

**Goal**: Independently audit the delivered change against the spec, plan, and test plan without modifying implementation during analysis.

**Tasks**:

- [ ] **9.1** PM delegates independent analysis to `@reviewer`: trace all 61 ACs and 67 TCs to code and non-vacuous evidence; inspect capability honesty (GitHub/Jira/GitLab matrices), idempotency (SHA-256 identity, terminal reuse, crash convergence, failed retry), branch safety (BR-01..BR-14), read-observation discrimination (not-found vs invalid vs unavailable; relation-signal skip vs provider gap), the wired 30 s timeout, output/no-leak, read-only isolation, conformance registry/write execution and runtime coverage, the transport widening, and the git confinement entry. (All TCs)
- [ ] **9.2** Record findings and verdict through the review artifact workflow; route implementation findings to Phase 10 and decision-class findings (contract reshape, allowlist growth, basis change) to PM and `@decision-advisor` — never a silent alternative. (All TCs)

**Acceptance Criteria**:

- Must: reviewer produces a traceable PASS or actionable findings with no fabricated evidence; `@runner` reproduces questionable evidence rather than assuming passes.
- Must: any missing evidence or non-firing negative control is unfinished work; no severity downgrade to pass the gate.

**Files and modules**:

- Code areas: none (read-only analysis of Phases 1–8).
- System docs: none during analysis.

**Tests**:

- Evidence inspection for all 67 TCs; reproduction of sampled suites/mutations.

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
- [ ] **11.7** Reconcile the command registry: **update** `doc/planning/oss-tooling/cli-command-registry.md` so the `closeout` row no longer claims harness session telemetry capture and explicitly names the M1-S11 deferral. This edit is unconditional, not conditional on the delivered grammar. Keep the command name and Deliver family intact (ODR-0003 remains the proposed naming lock pending its own owner acceptance at the GH-186 PR review; it grants no naming authority until then. TDR-0008's acceptance rides the GH-183 PR review). Add `feature-closeout.md` to `doc/00-index.md` if the index enumerates feature specs. Confirm no new `ados_distribution` marker is required for `doc/spec/**` (project-specific, not distributable). (All ACs)
- [ ] **11.8** Run the documentation gates: `bash scripts/.tests/test-doc-distribution.sh`; `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/privacy-literals.ts`; scan the reconciled docs for stale step/operation counts, stale gap reasons, and stale read-only claims. If `feature-closeout.md` or another reconciled doc contains a registered brand/forbidden literal, add it to the `registered` list in `scripts/checks/forbidden-literals.registry.json` (and update the corpus baseline only if the guard requires it); otherwise record that no registry change is needed. (NFR-10, NFR-12)

**Acceptance Criteria**:

- Must: the new closeout feature spec exists and describes the delivered behavior, identities, capabilities, safety predicate, output, and errors without inventing requirements.
- Must: every affected system spec is reconciled; no stale claim contradicts the delivered surface; the conformance doc reflects 13 steps / 8 operations and write execution; the command registry row no longer claims harness telemetry and names the M1-S11 deferral.
- Must: `test-doc-distribution.sh` is green; forbidden/privacy literal checks are green; no `doc/business/**` content is created.
- Should: record the registry diff and the ODR-0003/TDR-0008 acceptance status (ODR-0003 remains Proposed pending owner acceptance at the GH-186 PR review and grants no naming authority until then; TDR-0008 remains Proposed pending owner acceptance at the GH-183 PR review).

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
- [ ] **12.3** Complete the DoD checklist: all 61 ACs have passing traceable evidence; all 67 TCs are mapped and executed; the four error rows are 4/4 synced; the exit-literal invariant is green; the operation identity is SHA-256 with known-answer evidence (no FNV-1a); the conformance registry is 13/8 with write execution and `runtimeCoverageViolations` empty; the 30 s timeout is wired and proven on provider and git I/O; read-observation discrimination (not-found vs malformed vs unavailable, relation-signal skip vs provider gap) is proven; read-only isolation is green; the BR matrix (BR-01..BR-14) has positive/negative evidence; branch deletion never occurs on an unsafe fixture; the no-leak canary is present then absent; zero new dependencies; the license gate is green; the system docs are reconciled; the changeset is present; the tree is clean. Record divergences for escalation rather than rewriting requirements. (All ACs)
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
| Contract vocabulary, additive extensions, conformance registry, error identities | TC-001..006 | 1, 4, 5, 7, 8 | AC-F2-2, AC-F5-1, AC-F10-3, AC-F11-1..3, AC-F12-3, AC-F14-1/2 |
| Read-only isolation, tier/purity, confinement, zero dependencies | TC-007..009 | 6, 8, 12 | AC-F15-1, AC-NFR10-1, NFR-5, NFR-10 |
| Dry-run/apply plan, grammar, determinism, operation expansion | TC-010..014 | 2 (planner), 7 (CLI), 8 | AC-F1-1..3, AC-F2-1..3, AC-F3-4 |
| Restart, crash, failed retry, SHA-256 identity, ledger | TC-015..019 | 2, 3 | AC-F3-1..4, AC-NFR8-1 |
| Ticket-to-done, lifecycle labels, target not-found vs malformed | TC-020..026, TC-067 | 2, 4, 5, 7, 8 | AC-F4-1..4, AC-F5-1..4, DM-11 |
| Unassign | TC-027..030 | 4, 5 | AC-F6-1..4 |
| Owed-flip sweep, relation-signal split, and cap | TC-031..036 | 2, 4, 5, 8 | AC-F7-1..7, DM-11 |
| Comment resolution and GraphQL | TC-037..040 | 4, 8 | AC-F8-1..4 |
| Checkout restore, detached HEAD, and branch cleanup | TC-041..052, TC-066 | 6, 8 | AC-F9-1..5, AC-F10-1..8 |
| Provider capability parity and gaps | TC-053..056 | 1, 4, 5, 8 | AC-F11-1..4 |
| Merged-request lookup and `headSha` | TC-006, TC-057..058 | 1, 4 | AC-F12-1..3 |
| Machine/human output, error projection | TC-059..061 | 2, 7, 8 | AC-F13-1/2, AC-F14-1 |
| Offline/hermetic proof, bounds, timeout, non-vacuity meta-check | TC-062..064 | 4, 5, 6, 8 | AC-NFR3-1, NFR-3, NFR-6, NFR-12 |
| Conformance runtime coverage over the newly supported writes | TC-065 | 1, 4, 5, 8 | AC-F11-1/2/4, NFR-9, TDR-0008 |

## Artifacts and Links

| Artifact | Location | Type / handling |
|---|---|---|
| Change specification | [chg-GH-183-spec.md](./chg-GH-183-spec.md) | Source of requirements; read-only |
| Test plan | [chg-GH-183-test-plan.md](./chg-GH-183-test-plan.md) | Source of the 67 TCs and oracles; read-only |
| PM notes | [chg-GH-183-pm-notes.yaml](./chg-GH-183-pm-notes.yaml) | Orchestration context; read-only |
| This plan | [chg-GH-183-plan.md](./chg-GH-183-plan.md) | The only file written by this authoring pass |
| TDR-0008 | [../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md](../../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) | Governs `headSha` and `resolve-delivery-thread`; owner acceptance rides the GH-183 PR |
| ODR-0003 | [../../../decisions/ODR-0003-cli-command-naming-v1-lock.md](../../../decisions/ODR-0003-cli-command-naming-v1-lock.md) | Proposed command-name lock; owner acceptance is the GH-186 PR review (no naming authority until then) |
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
| 1.1 | 2026-11-01T07:10:00Z | Implementation Plan Writer | Remediated DoR iteration 1 (NOT_READY). Finding 1: replaced FNV-1a with the ADR-0003 SHA-256 identity via a pure `domain/sha256.ts` (known-answer vectors, test-only `node:crypto` cross-check, capability-context sensitivity). Finding 2: wired the NFR-6 30 s timeout (`AbortSignal.timeout` on provider defaults, `execFile`/`spawn` timeout on the git seam) with structural + behavioral evidence (TC-063). Finding 3: added the exact-inventory/assertion files (`v1-contract-inventory.json` + test, `EXPECTED_SEED_POSTURES`/`WRITE_METHODS`, GitHub/Jira trap replay arrays + `defaultAssertions`, `workspace-entrypoints.ts`, `provider-surface.test.ts`, `mock-conformance.test.ts`) to per-phase areas and commands. Finding 4: split TC-010/011 into Phase 2 planner-level and Phase 7 in-process CLI-level. Finding 9: delivered TC-065 runtime coverage phased with each capability flip. Finding 15: method-aware `createFixtureTransport` plus a mismatch control. Finding 16: split TC-003's contract half (Phase 1) from its trigger/output half (Phase 7/8). Aligned to spec v1.2/test plan v1.1: owed-flip no-surface gap vs `skipped-noop` signal skip; discriminated read observation + TC-067 (404 never `provider.payload.invalid`); pinned `main-tools` base with revisit trigger; reconciled PIN-3/PIN-12 identity inputs; Phase 11 registry description update; mapped TC-065/066/067 and the TC-034/036 split. Counts updated to 61 ACs / 67 TCs. |
| 1.2 | 2026-11-01T09:30:00Z | Implementation Plan Writer | Remediated DoR iteration 2 plan-owned findings and aligned to spec v1.3 / test plan v1.2. Finding 3 (blocking blast radius): added `tests/conformance/broken-adapter-control.test.ts` and `tests/conformance/live/live-entrypoint.test.ts` to the Phase 4 code areas/tasks and Phase 8.6, and to the Phase 4 boundary commands; pinned that `corruptRegistration` preserves the base client's write members (or supplies a `writeHandler`) so the runner reaches the corrupted read after the GitHub write flip, and that the live-entrypoint inline transport matches `method + URL` (or routes through `createFixtureTransport`); `bun test tests/conformance` remains the Phase 4 boundary command. Finding 7: PIN-14/Phase 4.3 pin the additive closeout-specific `readWorkItemObservation` carrier (mirrored in PIN-15/Phase 5.1); the existing `readWorkItem` return shape and `tests/types/provider-views.type-test.ts`, `tests/behaviour/providers/*`, and `packages/testkit/src/conformance/types.ts` are stated unchanged, with those files added only if the shape ever changes. Finding 10: Phase 4.4 now unambiguously disallows a new provider-subpath export (types stay internal or in core contracts; `EXPECTED_SURFACE` unchanged; only the capability array and `Object.keys(client)` list update). Finding 11: PIN-19 pins `FixtureRoute.method` as optional defaulting to `GET`, so existing route fixtures need no edits; method + URL matching and the mismatch control are explicit. Spec v1.3/test-plan v1.2 alignment: ODR-0003 owner acceptance is GH-186 while TDR-0008 rides GH-183; operation identity is ADR-0003's inputs plus the additive `capabilityContext` refinement recorded in DEC-7; the GitHub bounded reverse-read surface is an implementation-confirmed assumption with absent-surface → provider-level `skipped-gap` and present-but-unavailable → signal-level `skipped-noop`/`relation-signal-unavailable`; traceability rows reference TC-018 SHA-256 KAT/algorithm evidence, TC-063 structural + behavioral timeout evidence, the completed §4.1 harness contract, BR-13/BR-14 fixture ownership, and the G-09 two-or-more-extra grammar case. No new dependency, schema, or closed operation; phases remain independently committable. |
| 1.3 | 2026-11-01T10:00:00Z | Implementation Plan Writer | Targeted PM-authorized DoR iteration 3 remediation (plan-only; spec and test plan untouched). Finding 1 (blocking, Phase 1 conformance blast radius): Phase 1.6 now updates the hardcoded seven-operation control helpers in the same commit — `ALL_OPERATIONS`/`gapsExcept` in `tests/conformance/mock-conformance.test.ts` and `tests/conformance/live/live-entrypoint.test.ts` (so `liveControl` declares `resolve-delivery-thread`), and the `withoutHandler` explicit `declaredGaps` list in `tests/conformance/broken-adapter-control.test.ts` — while `packages/testkit/src/conformance/runner.ts` keeps `failClosed` unchanged and meaningful; added all three files to Phase 1 code areas/tests and stated `bun test tests/conformance` is green at the Phase 1 boundary. Finding 2 (blocking, executable-allowance cadence): added same-commit `EXECUTABLE_ALLOWANCES` updates for `core/src/domain/closeout.ts` (`runCloseout`), `adapters/src/github/normalize.ts`, `adapters/src/jira/normalize.ts`/`workflow-map.ts`, and `cli/src/edge.ts` (`createCloseoutCommandRuntime`); added `bun test tests/structure/content-inventory.test.ts` to Phases 2/3/4/5/7 (and 6 for the git file); added inventory/allowance tasks for the conditional `domain/closeout-run.ts`, `github/closeout.ts`, and `jira/closeout.ts`; stated every phase boundary keeps content-inventory green. Nits: Phase 2.7 harness now names `readWorkItemObservation`; PIN-14/PIN-15/Phase 4.3/5.1/assumption/layout scope "need no edits" to the unchanged `readWorkItem` return shape and name the Phase 1.6 additive `ConformanceAdapterClient` edit; PIN-12/Phase 2.8 make the fixed-tuple SHA-256 digest self-consistent with a regeneration and `node:crypto` verification note; PIN-16/Phase 6.1/6.7/8.4 pin the test-only `GitChildRunner` seam; Context/PIN-12 record that the `capabilityContext` refinement is change-level DEC-7, needs no ADR-0003 addendum for v1, and carries a revisit note. No new dependency, schema, or closed operation; phases remain independently committable. |
| 1.4 | 2026-11-01T10:20:00Z | Implementation Plan Writer | Targeted PM-authorized DoR iteration 4 remediation (plan-only; spec and test plan untouched). Finding 1 (blocking, executable allowance): Phase 3.4's `EXECUTABLE_ALLOWANCES` entry for `core/src/state/closeout.ts` now lists every PIN-13/3.1 export, constant first per the `state/registry.ts` precedent — `CLOSEOUT_OPERATION_RECORD_KEY_PREFIX` (the previously omitted exported constant), `appendCloseoutOutcome`, `closeoutOperationRecordKey`, `foldCloseoutHistory`, `readCloseoutHistory` — so `bun test tests/structure/content-inventory.test.ts` is green at the Phase 3 boundary. Finding 3 (nit, determinism): PIN-18 and Phase 1.6 pin the insertion position of the `change-lifecycle.resolve-delivery-thread` step as the last step of the `change-lifecycle` flow, immediately after `change-lifecycle.comment` and before `comment-provenance.read-comments` (8th and last `change-lifecycle` step; 8th of 13 registry steps), never before or between the existing delivery-request steps; tests continue to assert presence/count only. Iteration-4 finding 2 (`readWorkItemObservation` vs test plan §4.1) is a `test_planning` item outside this plan-only write scope and is not restated here; it is non-blocking and affects no test, and PIN-14/PIN-15/Phase 2.7 already name the carrier. No new dependency, schema, or closed operation; phases remain independently committable. |

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
