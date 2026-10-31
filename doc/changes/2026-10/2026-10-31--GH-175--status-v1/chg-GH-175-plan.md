---
id: chg-GH-175-status-v1
status: Proposed
created: 2026-10-31T15:45:00Z
last_updated: 2026-10-31T15:45:00Z
owners: [engineering]
service: delivery-os CLI status digest
labels: [change, planning]
links:
  change_spec: ./chg-GH-175-spec.md
  test_plan: ./chg-GH-175-test-plan.md
  decision_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md
    - ../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md
  related:
    - ../../../spec/features/feature-provider-client-seeds.md
    - ../../../spec/features/feature-state-layer.md
    - ../../../spec/features/feature-provider-engine.md
    - ../../../spec/features/feature-config-layer.md
    - ../../../spec/features/feature-result-contract.md
    - ../../../spec/features/feature-monorepo-scaffold-toolchain.md
    - ../../../planning/oss-tooling/cli-command-registry.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >-
  Deliver M0-S6 per spec v1.1: one read-only `status` command returning exactly
  six fixed sections (`tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`,
  `providers`, `parked-work`), each with one closed five-value state, bounded
  evidence, uniform counts, ranked capped items, and an explicit truncation
  marker. The tracker collector answers owner hand-backs, blocked dependencies,
  stalls, and hygiene from normalized `WorkItem` data; changes/PRs combine the
  local active change with open pull requests and keep review signals unknown;
  CI observes the current checkout HEAD and never treats `none` as green; the
  queue section is always `not-delivered`; providers read the declared chain and
  verified park fold without running the engine; parked work reads the
  git-ignored PM context with truthful absent/malformed/empty semantics;
  repository addressing derives from `origin`; two bounded GitHub collection
  reads land under the unchanged operation set with trap coverage; `--json`
  carries the full `delivery.status.v1` digest and human mode renders a short
  deterministic digest from the same data. No new error row, config key, state
  schema, package/subpath/runtime-API location, or secret-read allowlist entry.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-175: M0-S6 status v1

## Context and Goals

- **Work item**: GH-175 — M0-S6: status v1.
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-175-spec.md](./chg-GH-175-spec.md) — **v1.1** (2026-10-31, test-plan fold-in): F-1..F-16, AC-F1-1..AC-F16-1 (24), NFR-1..NFR-10, DM-1..DM-15, RSK-1..RSK-12, DEC-1..DEC-17, OQ-1..OQ-7, Appendix A (state matrix), Appendix C (declared constants), Appendix D (tracker predicates/ranks), Appendix E (human grammar), Appendix F (GitHub reads/traps), Appendix G (live smoke), Appendix H (documentation impacts).
  - [chg-GH-175-test-plan.md](./chg-GH-175-test-plan.md) — **v1.1** (2026-10-31, 33 TCs): TC-STATUS-001..033; §4.1 in-process harness contract and §4.2 non-vacuity contract are binding; §5.2 scenario steps and control lists; §7 execution order and evidence commands; §8 risks/assumptions (A-T1..A-T10, OQ-T1..OQ-T8, GAP-1..GAP-9).
  - [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (tiers/runtime-API confinement), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) (`updatedAt` absence = unknown), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (comments absence = unknown).
  - Baseline code read: `packages/core/src/contracts/{index,ports,provider,error-table,result,state,config}.ts`, `packages/core/src/domain/{index,verify-change,pm-notes-lint}.ts`, `packages/core/src/provider/{parks,validate,index}.ts`, `packages/core/src/state/{index,registry}.ts`, `packages/adapters/src/{github,repo,file,credentials,io}`, `packages/cli/src/{index,edge,projection,commands}`, `packages/testkit/src/result-conformance.ts`, `tests/{structure,behaviour,checks,boundaries,golden,fixtures}`, `scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,exit-code-literals,workspace-entrypoints,secret-read-boundary}.ts`, `.changeset/config.json`.
- **Status**: Proposed (awaiting the Definition of Ready gate, lifecycle phase 5).
- **Baseline**: `feat/GH-175/status-v1` at `d8e7892` (spec + test-plan commits); dependencies delivered on `main-tools` at `7155074` (GH-174 state layer, GH-188 provider client seeds, GH-181 primitive ports/credential port, GH-173 config layer, GH-172 result contract, GH-179 pm-notes/registry, GH-177 verify change, GH-182 provider v1, GH-184 privacy guards). The PR targets `main-tools`.
- **No behavioural spec/test-plan inconsistency found.** Four delivery-bound spellings/accounting interpretations are pinned in this plan and do not change any TC, AC, NFR, state, reason, bound, or assertion: (1) the PM context source key is `change_folder`, projected into the digest as `changeFolder`; (2) the GitHub list reads carry the raw page size inline in the client return shape so the exported `GithubClient` surface names stay exactly the five names TC-STATUS-022 asserts; (3) provider-config validation failures map to `provider-chain-unresolved`, while config-resolution failures map to `config-invalid`; (4) NFR-9/TC-STATUS-033 counts one **park-fold invocation** as the logical state read — the existing `readProviderParkViews` fold performs its documented internal verified-read sequence, and status calls it exactly once. A strict raw `store.read` call count of one would require a new state-layer API, which the spec excludes (state tier consumed, not changed); the plan therefore keeps the state layer unchanged and measures the logical fold read. No correction to the spec or test plan is proposed; both remain authoritative, and the test plan's intent (one park fold, no repeated state reads) is preserved.

**Goals** (spec §4): one read-only `status` call that (1) returns exactly six sections in fixed order, (2) never turns a failed, absent, unattempted, unresolved, credential-denied, config-invalid, or state-unreadable read into an observed/clear/green/available/zero claim, (3) answers the four tracker families from normalized `WorkItem` data with ADR-0004/0006 absence discipline, (4) treats the queue as a declared capability gap, (5) reads providers from declared configuration plus the verified park fold without executing the provider engine, (6) reads parked delivery work from the git-ignored PM context, (7) derives repository addressing from `origin`, (8) keeps GitHub reads bounded and credential-port exclusive, and (9) emits a bounded machine digest plus a deterministic human digest from the same data.

**Delivery model**: `@coder` executes Phases 1–6 in order, each ending in exactly one Conventional Commit and a green phase gate. Phase 7 is the documentation/spec reconciliation handoff to `@doc-syncer` (lifecycle phase 7); `@coder` must not perform it or mark it complete. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7**. Phase 1 lands the full contract vocabulary and the pure aggregator/renderer so every later phase consumes one vocabulary home; the adapter and command phases then add I/O and composition without redefining any pinned value.

**Open questions**:

- **OQ-T8 (CI timing tolerance, non-blocking)**: the 50 ms pure-aggregation bound is a spec bound and is not relaxed here. The plan fixes the measurement method (warm-up, median of five, pure `aggregateStatus` only) and requires recording the runtime version, machine class, and measured median in the test output. If CI variance makes the bound flaky, escalate to PM/`@decision-advisor`; never silently relax the bound or delete the test.
- OQ-1..OQ-7 from spec §14 remain non-blocking and are not delivery decisions for this change.

## Pinned Delivery Spellings (binding for delivery)

The test plan leaves export names, runtime type names, section `title` strings, human line labels, and header wording delivery-bound (GAP-8/A-T4). The vocabulary, order, states, reasons, sources, outcomes, caps, ranks, and schema version come from the spec and may not be rebound. This section pins the spellings; changing one later reopens this plan (route through PM/`@decision-advisor`, never apply silently).

### Contract module — `packages/core/src/contracts/status.ts` (new, data and types only)

Exported constants (exact names and values):

| Constant | Value |
|---|---|
| `STATUS_SECTION_ORDER` | `["tracker", "changes-and-prs", "ci", "lanes-or-queue", "providers", "parked-work"]` |
| `STATUS_SECTION_STATES` | `["observed", "degraded", "unknown", "unavailable", "not-delivered"]` |
| `STATUS_EVIDENCE_SOURCES` | `["tracker", "changes", "ci", "queue-engine", "provider-config", "provider-parks", "local-context", "repository-binding"]` |
| `STATUS_EVIDENCE_OUTCOMES` | `["read", "observed-empty", "failed", "not-configured", "not-delivered"]` |
| `STATUS_EVIDENCE_REASONS` | the twenty reasons in spec §8.3 order: `observed`, `observed-empty`, `read-failed`, `source-unavailable`, `signal-unavailable`, `addressing-unresolved`, `remote-unsupported`, `credential-unavailable`, `config-invalid`, `state-unreadable`, `commit-unresolved`, `provider-chain-not-declared`, `provider-chain-unresolved`, `local-context-missing`, `local-context-malformed`, `local-state-untracked`, `engine-not-delivered`, `source-truncated`, `item-signal-absent`, `partial-evidence` |
| `STATUS_TRACKER_FAMILIES` | `["ownerHandBacks", "blockedDependencies", "stalls", "hygiene"]` |
| `STATUS_TRACKER_FAMILY_STATES` | `["observed", "unavailable"]` |
| `STATUS_DEPENDENCY_STATES` | `["open", "unknown"]` |
| `STATUS_STALL_STATES` | `["stalled", "unknown"]` |
| `STATUS_HYGIENE_FINDINGS` | `["missing-title", "missing-labels"]` |
| `STATUS_CI_RESULTS` | `["failed", "pending", "succeeded", "canceled", "none", "unknown"]` |
| `STATUS_PROVIDER_CHAIN_STATES` | `["declared", "parked", "absent", "unknown"]` |
| `STATUS_PROVIDER_AVAILABILITY` | `["parked", "unverified"]` |
| `STATUS_PARKED_ITEM_STATES` | `["observed", "unknown"]` |
| `STATUS_SECTION_TITLES` | tracker: `Tracker`; changes-and-prs: `Changes and pull requests`; ci: `CI`; lanes-or-queue: `Lanes or queue`; providers: `Providers`; parked-work: `Parked work` |
| `STATUS_MAX_ITEMS_PER_SECTION` | `8` |
| `STATUS_MAX_TRACKER_FAMILY_ITEMS` | `4` |
| `STATUS_MAX_EVIDENCE_SOURCES` | `6` |
| `STATUS_MAX_REASONS` | `6` |
| `STATUS_MAX_PROVIDER_ENTRIES` | `8` |
| `STATUS_MAX_PROVIDER_PARKS` | `8` |
| `STATUS_MAX_PIPELINE_RUNS` | `8` |
| `STATUS_MAX_OPEN_PULL_REQUESTS` | `8` |
| `STATUS_MAX_PARKED_CHANGES` | `8` |
| `STATUS_SOURCE_ITEM_LIMIT` | `100` |
| `STATUS_SOURCE_PIPELINE_LIMIT` | `20` |
| `STATUS_MAX_TITLE_CHARS` | `120` |
| `STATUS_MAX_DETAIL_CHARS` | `160` |
| `STATUS_MAX_HUMAN_LINES` | `24` |
| `STATUS_MAX_HUMAN_BYTES` | `4096` |
| `STATUS_MAX_MACHINE_BYTES` | `65536` |
| `STATUS_STALL_THRESHOLD_DAYS` | `14` |
| `STATUS_OWNER_ATTENTION_LABELS` | `["hand-back", "human-input-needed"]` |
| `STATUS_SCHEMA_VERSION` | `delivery.status.v1` |

Exported types (exact names): `StatusSectionId`, `StatusSectionState`, `StatusEvidenceSource`, `StatusEvidenceOutcome`, `StatusEvidenceReason`, `StatusSignalAvailability`, `StatusTrackerAvailability`, `StatusDeliveryAvailability`, `StatusCounts`, `StatusEvidence`, `StatusRepositoryBinding`, `StatusHeadFacts`, `StatusRepositoryFacts`, `StatusRepositoryTarget`, `StatusReadFailure`, `StatusWorkItemRead`, `StatusDeliveryRequestRead`, `StatusPipelineRunRead`, `StatusProviderConfigRead`, `StatusParkRead`, `StatusProviderFacts`, `StatusLocalContextRead`, `StatusActiveChange`, `StatusParkedWorkEntry`, `StatusFacts`, `StatusSummary`, `StatusDigest`, `StatusSection`.

- **Section shape**: `StatusDigest` carries `schemaVersion`, `generatedAt`, `repository`, `summary`, and exactly six `sections`. `StatusSection` carries `id`, `title`, one `state`, `evidence`, `counts`, `truncated`, and its section-specific fields (`families`; `activeChange` + `pullRequests`; `commit` + `result` + `runs`; `capability` + `expectedStory`; `chain` + `entries` + `parks`; `source` + `items`). Tracker has no common `items` list.
- **Summary**: `summary.sections` is `6`; `summary.actionable` is the sum of the rendered `items` arrays of every section whose state is `observed` or `degraded`, counting tracker family items individually (each family list as rendered) plus rendered pull requests, CI runs, provider entries, provider parks, and parked-work items; `unknown`, `unavailable`, and `not-delivered` sections contribute zero. `actionable` is never a total or an estimate.
- **Counts**: `{ observed, unknown, total, omitted }`, each a non-negative integer, `observed + unknown <= total`; tracker counts aggregate the four families (an item may count in two families); tracker `counts.omitted` is the family sum; tracker `truncated` is true when any family dropped items or the raw page hit the source limit.
- **Evidence**: `{ sources: [{ source, outcome, failureCode?, failureClass? }], reasons: [unique reason] }`; at most six sources and six unique reasons; reasons ordered by first occurrence in fixed source/family order; no raw payload, credential, or arbitrary message. `failureCode` is an existing `config.*`/`state.*` code only; `failureClass` is an adapter-local class such as `provider.payload.invalid`.
- **Repository binding**: observed `{ state: "observed", host: "github.com", owner, name, remoteName: "origin" }` or unavailable `{ state: "unavailable", reason: "addressing-unresolved" | "remote-unsupported" }`; no userinfo, credential, or raw remote URL anywhere.
- **State-read accounting**: status composes exactly one `readProviderParkViews(store, nowMs)` call per run (the logical park-fold read). The existing fold's internal verified-read sequence is not multiplied by status and is not reimplemented; the state layer stays unchanged. TC-STATUS-033 asserts one `readProviderParks`/park-fold invocation plus a live guarded-store read, not a raw `store.read` count that the existing fold's design cannot satisfy without a new state API.
- **Reader result types** (shared by the command runtime and the pure aggregator): `StatusReadFailure` is `{ ok: false, reason: "read-failed" | "credential-unavailable" | "not-configured" | "commit-unresolved", failureCode?, failureClass? }`; the two list reads are `{ ok: true, items, pageItemCount, availability } | StatusReadFailure` (required `availability`); the CI read is `{ ok: true, items, pageItemCount } | StatusReadFailure`; `StatusProviderConfigRead` is `{ ok: true, config } | { ok: false, reason: "config-invalid" | "provider-chain-unresolved", failureCode?, failureClass? }`; `StatusParkRead` is `{ ok: true, parks } | { ok: false, reason: "state-unreadable", failureCode?, failureClass? }`; `StatusLocalContextRead` is `{ ok: true, context: { path, tracked: false, activeChange?, parkedChanges } } | { ok: false, reason: "missing" | "malformed", path }`.
- **Supporting shapes**: `StatusSignalAvailability` is `"available" | "unavailable"`; `StatusTrackerAvailability` is `{ ownerHandBacks, blockedDependencies, stalls, hygiene }` (each `StatusSignalAvailability`); `StatusDeliveryAvailability` is `{ state, refs, reviewState, reviewThreads }` (each `StatusSignalAvailability`); `StatusRepositoryTarget` is `{ owner, name }`; `StatusHeadFacts` is `{ branch?, sha?, detached }`; `StatusRepositoryFacts` is `{ binding, head }`; `StatusSummary` is exactly `{ sections, observed, degraded, unknown, unavailable, notDelivered, actionable }`; `StatusDigest.generatedAt` is an ISO-8601 UTC string ending in `Z`; `StatusActiveChange` is `{ workItemRef, branch?, changeFolder? }`; `StatusParkedWorkEntry` is `{ workItemRef?, branch?, changeFolder?, reason?, parkedAt? }` (age and item state are derived by the aggregator, never read from the file).
- **Facts**: `StatusFacts` is `{ nowIso, nowMs, repository, tracker, changes, ci, providers, localContext }`; `repository` is `{ binding, head }`; `providers` is `{ config, parks }`; `ci` is the pipeline-run read for the checkout SHA (the branch/SHA live in `repository.head`).

### Pure domain module — `packages/core/src/domain/status.ts` (new)

Exported functions only:

- `aggregateStatus(facts: StatusFacts): StatusDigest` — pure; no I/O, clock, randomness, or environment. It performs all six collectors, Appendix A state derivation, evidence/reason construction, ranking, capping, truncation, counts, and `summary.actionable`.
- `renderStatusHuman(digest: StatusDigest, brand: BrandIdentity): string` — pure; derives the human digest only from the digest and the injected brand; no extra reads; no clock, environment, or randomness.

Internal (not exported) helpers own the rank keys and cap application. The plan pins their behaviour through the tables below; no additional exported executable names are added to the domain module.

### Explicit rank keys

| List | Cap | Primary key | Tie-breakers (in order) |
|---|---|---|---|
| tracker `ownerHandBacks` | `STATUS_MAX_TRACKER_FAMILY_ITEMS` (4) | declared attention-label group order (`hand-back` before `human-input-needed`) | oldest parseable `updatedAt` first; absent/invalid last; then `workItemRef` ascending |
| tracker `blockedDependencies` | 4 | `dependencyState` `unknown` before `open` | `workItemRef` ascending |
| tracker `stalls` | 4 | oldest stalled first (`ageDays` descending) | unknown-activity items last, then `workItemRef` ascending |
| tracker `hygiene` | 4 | finding count descending | `workItemRef` ascending |
| `pullRequests` | `STATUS_MAX_OPEN_PULL_REQUESTS` (8) | non-draft before draft | PR number ascending when the normalized identity is numeric, otherwise lexical `entityId` ascending; then `sourceRef`; then `targetRef` |
| `runs` | `STATUS_MAX_PIPELINE_RUNS` (8) | severity `failed`, `pending`/`running`, `canceled`, `succeeded`, `skipped` (most severe first) | run identity descending (numeric-aware when both are numeric, otherwise lexical ascending); then pipeline name ascending |
| `entries` | `STATUS_MAX_PROVIDER_ENTRIES` (8) | `parked` before `unverified` | `enabled` true before false; then entry name ascending; then provider class ascending |
| `parks` | `STATUS_MAX_PROVIDER_PARKS` (8) | soonest `expiresAt` ascending; parks without an expiry last | `chain` before `provider`; then park name ascending |
| parked `items` | `STATUS_MAX_PARKED_CHANGES` (8) | oldest parseable `parkedAt` ascending; absent/invalid last | `workItemRef` ascending (numeric-aware when both match `PREFIX-number`); entries without `workItemRef` last by `changeFolder`, then `branch`, then `reason` |

All lexicographic comparisons are ascending Unicode code-point comparisons on normalized strings. Ordering is applied before capping; the retained items are the first N of the fully ranked list. A list whose cap drops items records `counts.omitted`; a source page whose raw `pageItemCount` is at or above its declared read limit records `source-truncated` and sets `truncated` even when no rendered item was dropped.

### Human digest (Appendix E, pinned rendering)

Exactly one line per section in fixed order, optional header, at most 24 lines and 4096 bytes. Metavariables below are braces, not template placeholders.

Fenced example of the exact line grammar and separators:

```text
{binary} status {owner}/{name} @ {branch|detached} {sha7}
tracker    {state}  hand-backs {n} | blocked {family-state} | stalls {n} ({k} unknown) | hygiene {n}{truncation}
changes    {state}  active {ref|none|unknown} | PRs {n|?} (review state {unavailable|observed|unknown}){truncation}
ci         {state}  {failed|pending|succeeded|canceled|none-reported|unknown} ({failed}/{total} jobs){truncation}
lanes      not-delivered  no queue or lane engine in this release
providers  {state}  chain {name|none|unknown} | active parks {n|?} | {entries|?} entries{truncation}
parked     {state}  {n|?} parked changes (git-ignored local state){truncation}
```

- Header is emitted only when the repository binding is observed and the checkout SHA is resolved; it uses `brand.binaryName`, the binding `owner/name`, the attached branch or `detached`, and the first seven SHA characters. Otherwise the header is omitted (the header is optional in the spec).
- `PRs {n|?}` prints `?` when the PR read is not observed; `entries` prints `?` when the provider config is untrusted. `chain` prints `none` for an absent default chain and `unknown` when config is untrusted.
- `truncation` is `+{omitted}` when `counts.omitted > 0`; when `truncated` is true only because the raw source page hit its limit, it is `+more`. There is no truncation suffix on an untruncated section. TC-STATUS-006 asserts a truncation suffix on every truncated line (the `+N` form on dropped-item fixtures and `+more` on source-at-limit-only fixtures).
- The human digest never prints item titles, `generatedAt`, raw payloads, credentials, or LLM prose. Redaction is the existing serialization chokepoint.

### CLI and adapter spellings

- `packages/cli/src/commands/status.ts`: `StatusCommandRuntime`, `createStatusCommandDefinition`.
  - `StatusCommandRuntime` is `{ readRepository(): StatusRepositoryFacts; readWorkItems(target: StatusRepositoryTarget, limit: number): Promise<StatusWorkItemRead>; readDeliveryRequests(target: StatusRepositoryTarget, limit: number): Promise<StatusDeliveryRequestRead>; readPipelineRuns(sha: string): Promise<StatusPipelineRunRead>; readProviderConfig(): StatusProviderConfigRead; readProviderParks(nowMs: number): StatusParkRead; readLocalContext(): StatusLocalContextRead; nowIso(): string; nowMs(): number }`.
  - `createStatusCommandDefinition(runtime)` sets `flags: []`, `positionals: { max: 0 }`, `humanText: (data, brand) => renderStatusHuman(data as StatusDigest, brand)`, and an async handler that reads the sources, builds `StatusFacts`, and returns `{ data: aggregateStatus(facts) }`. It never writes a stream, never chooses an exit code, and never returns an error envelope for a section failure.
- `packages/cli/src/index.ts`: add one optional field to `CommandDefinition`: `humanText?: (data: unknown, brand: BrandIdentity) => string`. `runCli` calls it only on a success outcome in non-`--json` mode; a throw is contained as the existing `fallback.internal` outcome. Existing definitions are unchanged and no definition other than `status` sets it.
- `packages/cli/src/output/serialize.ts`: add `humanText?: string` to `WriteOutputOptions`; when present in non-`--json` mode it is written through the existing single `writeText` call site after redaction. `humanText` takes precedence over the existing `humanJson`; no new stream-write call site is introduced.
- `packages/cli/src/edge.ts`: `StatusComposition` and `createStatusCommandRuntime`; `ConfigProgramOptions.status?: StatusComposition`. `StatusComposition` is `{ store, credentials, transport, repository: { cwd, io }, localContext: { path, fs }, clock: { nowMs, nowIso }, github: { instance: ExternalSystemInstance } }`. `createConfigProgram` composes status beside `config`/`lint`/`phase`/`provider`/`verify`, supplying `resolveProviderConfig` from its existing internal `resolve` plus `parseAndValidateProviderConfiguration` (pure validation only; no provider engine).
- `packages/adapters/src/github/client.ts`: `GithubClient` gains `listWorkItems(limit)` and `listDeliveryRequests(limit)`; each returns `Promise<ProviderReadResult<{ items, pageItemCount }>>` with an inline structural type. No new exported type name is added, so the exported surface remains exactly `createGitHubClient`, `GithubClient`, `GithubClientOptions`, `GithubRepositoryRef`, `GITHUB_ADAPTER_CONTRACT`.
- `packages/adapters/src/github/normalize.ts`: add `normalizeGithubIssueList(payload, context)` and `normalizeGithubPullList(payload, context)` returning `ProviderReadResult<{ items, pageItemCount }>`; the issue list skips objects carrying a `pull_request` property before normalization; the pull list normalizes every entry or fails the whole read.
- `packages/adapters/src/repo/index.ts`: add `RepositoryHeadFacts`, `RepositoryFacts`, `GitHubRemoteBinding`, `readRepositoryFacts({ cwd, io })`, and `parseGitHubRemote(remoteUrl)`.
- `packages/adapters/src/file/pm-context.ts`: add `readLocalPmContext({ path, fs })` returning `StatusLocalContextRead`; export it from `file/index.ts`.
- **PM context projection**: source `active_change.change_folder` is projected as digest `changeFolder`; `parked_changes[].change_folder` likewise. No other casing is introduced.

### Exact error-identity reuse

- **No new error-table row or domain kind.** The status command can fail only through the existing `fallback.invocation` (parser) or `fallback.internal` (containment); every section failure is digest data.
- **Evidence `failureCode`** is limited to existing `config.*` and `state.*` codes: `config.credential.missing`, `config.file.malformed`, `config.value.invalid`, `state.store.torn`, `state.schema.mismatch`, `state.keys.missing`, `state.permission.denied`, `state.level.unsupported`. No `status.*` identity exists in code or docs.
- **Evidence `failureClass`** is an adapter-local class, not an error identity: the GitHub read failures use the existing `provider.payload.invalid` class; the provider-config validation failure uses `provider.chain.invalid` as a class. Credential failures carry `failureCode: "config.credential.missing"` and the `credential-unavailable` reason.
- **Reason mapping**: no binding → `addressing-unresolved`/`remote-unsupported`; credential failure → `credential-unavailable`; transport/payload failure → `read-failed`; unresolved SHA → `commit-unresolved`; config resolution failure → `config-invalid`; declared chain not resolving → `provider-chain-unresolved`; no default chain → `provider-chain-not-declared`; park fold failure → `state-unreadable`; PM context absent → `local-context-missing`; PM context malformed → `local-context-malformed`; queue → `engine-not-delivered`; raw page at limit → `source-truncated`; item-level absent signal → `item-signal-absent`; partial section evidence → `partial-evidence`.

## Delivery Bindings (D1..D12)

Binding for delivery; behaviour, pinned identities, tokens, summaries, and AC mappings come from the spec/test plan and may not change (A-T1).

- **D1 — Module layout**: new `packages/core/src/contracts/status.ts`, `packages/core/src/domain/status.ts`, `packages/adapters/src/file/pm-context.ts`, `packages/cli/src/commands/status.ts`; extended `contracts/index.ts`, `domain/index.ts`, `core/src/index.ts`, `adapters/src/github/{client,normalize}.ts` (`github/index.ts` unchanged), `adapters/src/repo/index.ts`, `adapters/src/file/index.ts`, `cli/src/commands/index.ts`, `cli/src/edge.ts`, `cli/src/index.ts`, `cli/src/output/serialize.ts`. No new package, subpath, package export, or runtime-API location.
- **D2 — Single vocabulary home**: every section id, state, reason, source, outcome, family, cap, limit, threshold, rank rule, and schema version is declared once in `contracts/status.ts`; the domain and command consume it. Tests may hold independent oracles. No production module redeclares a vocabulary list.
- **D3 — Domain purity**: `domain/status.ts` imports only `#contracts` and relative domain types; no `node:*`/`bun:*`, adapter, state, config, provider-implementation, parser, file, clock, randomness, or environment access. All variable facts (including `nowMs` and `nowIso`) arrive through `StatusFacts`.
- **D4 — Command purity and composition**: the status handler owns no stream writes and no exit codes; parser grammar (`positionals.max: 0`, no flags) rejects extra input with `fallback.invocation` before any read; adapter/state/config access is injected through `StatusCommandRuntime`; the edge is the only composition point. Status is composed beside `config`/`lint`/`phase`/`provider`/`verify`.
- **D5 — GitHub collection discipline**: each list read sends exactly one bounded page (`state=open`, declared `per_page`, declared sort), performs no pagination, retry, or second request, and returns normalized views plus the raw `pageItemCount`. The issue list filters out `pull_request` objects before normalization; the pool of PR objects never becomes `WorkItem`s. The closed `ADAPTER_OPERATIONS` set and `GITHUB_ADAPTER_CONTRACT.supportedOperations` are unchanged. Credentials resolve only through `CredentialPort`. The existing `readPipelineRun(sha)` is reused unchanged: check runs are not object-filtered, so the returned run count is the raw page count for the `STATUS_SOURCE_PIPELINE_LIMIT` at-limit signal; no signature change or optional parameter is added. The edge wraps the list reads with the declared GitHub availability (`blockedDependencies: "unavailable"`, `reviewState: "unavailable"`, `reviewThreads: "unavailable"`, all other signals available), so the adapter does not invent availability data.
- **D6 — Repository and PM-context reads**: repository binding and HEAD facts come from bounded `.git` metadata reads through `RepositoryIo` with no child process; `origin` is the only remote read; GitHub HTTPS/SSH forms are parsed; userinfo is discarded; linked worktrees resolve `gitdir:` plus `commondir` for `config`, `refs`, and `packed-refs`. The PM context is parsed with the existing bounded YAML core parser and projected to the declared fields only; `notes` and unrelated fields never enter the digest; the file is never written.
- **D7 — Human renderer hook**: one optional pure `humanText` hook on the command-definition contract; only `status` declares it; rendering uses only the digest and the injected brand; redaction remains the single output chokepoint; existing `humanSuccess` behavior is unchanged for every other command.
- **D8 — Error-identity reuse**: no error-table, domain-kind, envelope, exit-taxonomy, or sync-table change; only `fallback.invocation` and `fallback.internal` can fail the command; section evidence uses existing `config.*`/`state.*` codes or adapter-local classes. `scripts/checks/error-table-sync.ts` stays green with byte-identical tables.
- **D9 — Fixture hygiene and non-vacuity**: committed fixtures are read-only; derived/mutated fixtures self-materialize under fresh `mkdtemp` roots and are removed in teardown; every negative/matrix/cap fixture carries a distinctive `planted-status-*` canary and a restored-or-valid control; every recorder/stub is proven live by a seeded deliberate call; the live tree stays clean after every suite. The credential-bearing remote fixture URL is constructed in memory (concatenated), never committed as a literal, so the privacy-literal guard stays green without a new allowlist entry.
- **D10 — Inline committer protocol for `@coder`**: exactly one Conventional Commit per phase with the completion signal below; explicit `git add` of exactly the phase's Files-and-modules entries; verify the staged set with `git status --porcelain` before committing; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; `pnpm check` green before every commit with the log captured under `.ai/local/` (never staged); no push, no amend; a red gate blocks the commit. PM owns `@doc-syncer` for Phase 7.
- **D11 — Changeset and evidence**: one minor changeset for the lockstep fixed five-package group (`.changeset/status-v1-minor.md`, `.changeset/config.json` `fixed` group) and `chg-GH-175-evidence.md` in this folder (GH-172/174/177/179 pattern). Nothing publishes in this change; the owner may amend the impact at PR review.
- **D12 — No new CI/checks/config/state/secret surface**: the new suites are discovered by root `bun test`; the boundary/ambient/literal/entrypoint/error-table/secret-read gates extend to the new modules automatically; no new CI job, configuration key, state-schema change, package/subpath, runtime-API location, or secret-read allowlist entry is introduced. The opt-in live smoke stays outside `pnpm check` and default CI.

## Scope

### In Scope

- The `status` command surface, grammar, runtime readers, composition beside the existing commands, and the optional human renderer hook (F-1, AC-F1-1, AC-F1-3, DEC-1, DEC-16; Phases 4).
- The complete `delivery.status.v1` vocabulary as data and types, the six-section digest, five-state model, evidence model, counts, truncation, bounds, repository binding, and human grammar (F-2, F-10, F-11, DM-1..DM-4, DM-11..DM-15; Phases 1, 4).
- The pure aggregator and renderer: all six collectors, Appendix A state derivation, ranking, capping, truncation, `summary.actionable`, and the deterministic human digest (F-2..F-11, DM-1..DM-13; Phase 1).
- The tracker collector's four families over normalized `WorkItem` data, including labels-only owner hand-backs, blocked-dependency availability and target semantics, injected-clock stalls, and title/label hygiene (F-3, DM-5, DM-14, AC-F3-1..AC-F3-4; Phase 5 tests).
- The changes/PRs collector from the local active change plus open pull requests, with review signals unknown when unavailable and partial failure degraded (F-4, DM-6, AC-F4-1; Phases 3, 5).
- The CI collector over the current checkout HEAD, with `failed`/`pending`/`succeeded`/`canceled`/`none` classification, all-skipped never succeeded, and unresolved/failed reads unknown (F-5, DM-7, AC-F5-1; Phases 1, 5).
- The lanes-or-queue declared gap (F-6, DM-8, AC-F6-1; Phases 1, 5).
- The providers collector from the resolved provider configuration plus verified park views; `parked`/`unverified` only, chain park, no chain unavailable, park failure degraded, no engine/quota call (F-7, DM-9, AC-F7-1, AC-F7-2; Phases 1, 4, 5).
- The parked-work collector from the git-ignored PM context with observed/observed-empty/absent/malformed semantics and optional age from `parkedAt` (F-8, DM-10, AC-F8-1; Phases 3, 5).
- The repository binding from `origin` (HTTPS/SSH, credential stripping, absent/unparseable/non-GitHub unavailable) and checkout HEAD facts (F-12, DM-11, AC-F12-1; Phases 3, 5).
- The bounded GitHub collection reads `listWorkItems`/`listDeliveryRequests`, extended trap catalog, unchanged capability declaration, and credential-port-only auth (F-13, DM-14, AC-F13-1; Phase 2).
- The exhaustive AC-F9-1 negative-control matrix, read-only/determinism proofs, bounds, output-contract proofs, tier/brand/secret-read/error-table gates (F-9, F-14, F-15, AC-F1-2, AC-F9-1, AC-F14-1, AC-F15-1; Phases 4, 5).
- The committed fixture corpus, golden snapshot, performance measurement, and opt-in live smoke (F-16, AC-F16-1, NFR-6, NFR-9; Phase 6).
- The minor changeset, delivery evidence, and final local battery (Phase 6).
- Documentation/spec reconciliation (Phase 7, `@doc-syncer`): the new current-truth status feature doc, the provider-client-seed/state/provider-engine/config/result/monorepo specs, the command registry, glossary, index, and required scans.

### Out of Scope

- NG-1: any queue, lane, dispatch, supervision, board, brief, merge, deploy, or closeout engine/command; `queue ready` (M0-S7) is not implemented or duplicated.
- NG-2: provider-engine execution, chain resolution, quota evaluation/fetch, announcements, park writes/clears, provider telemetry, spawn/model selection.
- NG-3: any mutation — no state append/fence/park clear/projection rebuild, no pm-notes or PM-context write, no tracker/PR/CI write.
- NG-4/NG-5: new typed configuration keys or branches for tracker/VCS/CI/addressing; Jira instance binding in the status composition (the collector is provider-agnostic and tested against Jira-shaped fixtures only).
- NG-6: full GitHub adapter, GraphQL review decisions/threads, structured issue-dependency reads, push parity, open-PR-head CI, merge-gate evaluation.
- NG-7/NG-8: LLM summarization/semantic ranking/recommendations/prose, cross-repository/fleet status, MCP/OpenCode surfaces, agent-prompt adoption, and `verify change` duplication.
- NG-9: new error-table rows/identities, envelope changes, state-schema changes, new packages/subpaths/runtime-API locations, or new secret-read allowlist entries.
- NG-10: reading pm-notes phase ledgers or duplicating `verify change`.
- A packed Node/Bun consumer probe (no manifest/subpath change; NFR-7 is proven by the tier/ambient/dependency-cruiser gates).
- Publishing, merge, or owner acceptance; any new CI job or check; any cloud-product content.

### Constraints

- D1..D12 are binding (module layout, single vocabulary home, domain purity, command purity, GitHub read discipline, repository/PM-context reads, human renderer hook, error-identity reuse, fixture hygiene, inline committer protocol, changeset/evidence, no new surface).
- **Commit strategy**: exactly one Conventional Commit per phase with the completion signals below; explicit `git add` of the phase's files; never stage `.ai/local/**` or `tmp/**`; no push during delivery; no amend; `pnpm check` green before every commit (D10).
- Strict TypeScript, injected time/randomness/environment, runtime-API confinement, and `bun:test` authoring per [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md); suite layout and the gate battery per [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md); the in-process harness contract (test-plan §4.1) and non-vacuity contract (§4.2) bind every status suite.
- The forbidden-literal scanner matches `ados`, `ADOS_`, and `~/.ados` in `packages/**` and registered `doc/**`; production code must not hardcode the live-smoke env name. `ADOS_STATUS_LIVE` is a test-only literal under `tests/**` (never in `packages/**`); any production edge that ever exposes it must derive the name from `brand.environmentPrefix`.
- `GITHUB_TOKEN` resolves only through `CredentialPort`; no package reads ambient environment outside the four-entry secret-read allowlist. The status modules add no allowlist entry.
- The GitHub REST list payloads lack structured issue links and review decisions; the list reads and the digest must not overclaim: blocked dependencies are `unavailable` on the minimal GitHub slice, and review state/threads are `unknown` with `signal-unavailable`.
- The repository adapter currently has no remote/HEAD read; the plan requires the bounded `.git` metadata implementation (including linked worktrees via `gitdir:`/`commondir`) without spawning.
- Phase gate = the phase's focused suites green plus `pnpm check` exit 0; the five invariant checks (`error-table-sync`, `forbidden-literals`, `ambient-globals`, `exit-code-literals`, `workspace-entrypoints`) as applicable; doc-distribution where relevant.
- **Rollback and failure handling**: the change is fully additive — a single-PR revert removes the new contracts/domain/command/adapters/tests/fixtures/changeset/evidence together, with no data cleanup (status wrote nothing). Never roll back one side of a documented-table or inventory change without the other. A failing phase stops at its last green task boundary and reports; any discovered spec/test-plan inconsistency escalates to PM — the plan never reshapes a TC (A-T3, A-T4).

### Risks

| ID | Risk | Impact | Probability | Mitigation (plan anchor) |
|---|---|---|---|---|
| RSK-1/RSK-5/RSK-T1 | A failed/absent/unresolved read becomes an observed-zero/clear/green claim | H | M | Appendix A derivation in `aggregateStatus`; exhaustive AC-F9-1 matrix; restored controls; canaries; TC-004/023 (Phases 1, 5) |
| RSK-2 | An active park is reported as available | H | L | `parked`/`unverified` only; engine never called; park views from the verified fold; TC-017/018/023 (Phases 1, 5) |
| RSK-3 | The queue section is mistaken for an empty queue | H | M | Always `not-delivered`/`engine-not-delivered`, zero items, note; no queue read; TC-016/023 (Phases 1, 5) |
| RSK-4 | Absent `updatedAt`/`assignee`/`comments` is fabricated | H | M | Labels-only hand-backs; `updatedAt` absent/invalid = unknown; hygiene never reads comments; TC-009/011/012 (Phase 5) |
| RSK-6 | GitHub list overclaims/duplicates/truncates silently | M | M | PR filter, one page, raw `pageItemCount`, `source-truncated`, four trap entries; TC-021/022 (Phase 2) |
| RSK-7 | `origin` addressing fails in worktrees/non-GitHub/non-git dirs | M | M | Bounded `.git` read with `gitdir:`/`commondir`; no spawn; explicit unavailable reasons; TC-020 (Phase 3) |
| RSK-8 | Absent PM context becomes "no parked work" | L | M | `unavailable`/`local-context-missing` + git-ignored marker; only an explicit empty array is observed-empty; TC-019/023 (Phases 3, 5) |
| RSK-9 | The digest grows unbounded | M | M | Exact caps, title/detail caps, byte bounds, truncation evidence; TC-005/006/007 (Phase 4) |
| RSK-10 | Credential or raw payload leaks into evidence/human text | H | L | Credential port only; codes/classes/counts only; redaction chokepoint; secret canaries; TC-005/006/027 (Phases 4, 5) |
| RSK-11 | Status docs drift from delivered behaviour/GH-188 seed surface | M | M | New current-truth feature doc + phase-7 reconciliation; trap catalog extended in-change; TC-008/022/028/029 (Phases 2, 5, 7) |
| RSK-12 | Scope creep into queue/provider engine/GraphQL/full adapter | M | M | Non-goals explicit; queue declared gap; no engine call; exactly two collection reads; TC-018/022/026 (Phases 2, 5) |
| RSK-T2/RSK-T3 | A "not observed" assertion is vacuous or item-unknown and section-unknown collapse | H | M | One oracle per cell asserts state, reasons, counts, ordered items, truncation; paired item-unknown/section-unknown fixtures; TC-004 (Phase 1) |
| RSK-T4 | Cap/truncation is sampled rather than over-cap tested | M | M | Under-cap, at-cap, over-cap, source-at-limit fixtures together; `omitted` and `truncated` both asserted; TC-007 (Phase 4) |
| RSK-T5 | Read-only/engine-free proof is vacuous | H | L | Guarded store, recording transport, counting stub, seeded deliberate calls; TC-018/024 (Phase 5) |
| RSK-T6 | Park fixtures do not exercise the real verified fold | H | M | Park views built from verified bytes with `tests/fixtures/state/harness.ts`; detection-disabled control; TC-017 (Phase 5) |
| RSK-T7 | The live smoke becomes flaky or pins volatile counts | M | M | Structural assertions only, opt-in, outside `pnpm check`; TC-032 (Phase 6) |
| RSK-T8/RSK-P5 | The 50 ms measurement is flaky on slow CI | M | M | Pure aggregator only, warm-up + median of five, record runtime/machine class; bound not relaxed; escalate if needed (OQ-T8; Phase 6) |
| RSK-P1 | A phase overruns its delegation window | M | M | Stop at the last green task boundary and report; never enlarge or split the phase commit (D10) |
| RSK-P2/RSK-P8 | Existing suites or contract inventories regress | M | M | `pnpm check` every phase; update `tests/fixtures/ports/v1-contract-inventory.json` and `tests/structure/inventory.json` in the same phase as the module (D1/Phase 1) |
| RSK-P6 | A credential-bearing remote URL fixture trips the privacy guard | M | L | Construct the userinfo URL in memory (concatenated), never as a committed literal; TC-020 (Phase 3) |
| RSK-P9 | The human hook regresses other commands or adds a second write path | M | L | Optional field only; `status` is the only declarer; reuse the single `writeText` chokepoint; existing golden suites; TC-006/026 (Phase 4) |
| RSK-P10 | Status resolves provider config differently from `provider` | M | M | Reuse the internal `resolve` from `createConfigProgram`; pure `parseAndValidateProviderConfiguration`; no engine; TC-017/018 (Phases 4, 5) |
| RSK-P11 | TC-033 is read as a raw `store.read` count of one, which the existing verified park fold cannot satisfy without a new state API | M | M | Pin the logical park-fold accounting (one `readProviderParkViews` invocation) and keep the state layer unchanged; if a reviewer insists on a raw count, escalate to PM/`@decision-advisor` rather than weakening NFR-9 or adding an unplanned state API (Phase 6) |

### Success Metrics

- NFR-1: 6/6 sections, 5/5 valid states, 100% evidence presence, 0 missing/extra sections.
- NFR-2: serialized `data` ≤ 65 536 bytes; human ≤ 24 lines and ≤ 4096 bytes; 100% caps enforced; 100% dropped/at-limit cases marked.
- NFR-3: 0 observed-zero/clear/green/available outcomes across the exhaustive negative-control matrix.
- NFR-4: 0 writes, fences, state mutations, network writes, child processes; 0 digest/human drift on identical injected inputs.
- NFR-5: 100% one valid envelope under `--json`; 100% six-section human output plus optional header; 0 extra reads during rendering.
- NFR-6: committed corpus produces the expected sections/states/evidence/order/caps with 0 live network calls; opt-in live structural checks pass without pinning volatile counts.
- NFR-7: 0 new runtime-API locations, 0 new secret-read allowlist entries, 0 product literals; boundary/ambient/literal/entrypoint gates green.
- NFR-8: 0 new rows/domain kinds, 0 documented-table drift, 0 existing-row changes; sync and classification suites green.
- NFR-9: ≤50 ms pure aggregation over cap-sized facts; ≤3 network reads, exactly one logical park-fold read, ≤1 config resolve; 0 retries/loops.
- NFR-10: 0 secrets/raw payloads in digest/evidence/human text; 0 ambient reads outside the allowlist; 0 canary escapes.
- Aggregate: all 33 TCs green with recorded evidence; `pnpm check` exit 0; clean tree after every suite.

## Phases

### Phase 1: Status contracts, pure aggregator/renderer, and the contract baseline

**Goal**: Land the `delivery.status.v1` vocabulary as data/types and the complete pure aggregator/renderer, with the constants bound to Appendix C and the pure matrix proven from the first commit boundary (D1, D2, D3).

**Tasks**:

- [ ] **1.1** Author `packages/core/src/contracts/status.ts` (D1, D2) with exactly the constants and exported types pinned in "Pinned Delivery Spellings" (section order/states/reasons/sources/outcomes, tracker families, CI results, provider chain states/availability, hygiene findings, section titles, all Appendix C caps/limits/thresholds, owner-attention labels, schema version, digest/section/evidence/counts/binding/head/read/facts types). Data and types only: no functions, no runtime imports, no executable statements beyond `as const` data and declarations. Re-export everything from `contracts/index.ts`.
- [ ] **1.2** Author `packages/core/src/domain/status.ts` (D1, D3): `aggregateStatus(facts)` performing all six collectors, Appendix A state derivation, evidence/reason construction (dedupe, fixed order, six-reason/six-source caps), ranking per the pinned tables, per-list/per-family capping, counts, truncation (`dropped` and raw-page-at-limit), `summary.actionable`, and exactly six sections in `STATUS_SECTION_ORDER`; `renderStatusHuman(digest, brand)` implementing the pinned human grammar and bounds from the same digest. All clock/time facts come from `StatusFacts`; no I/O, environment, randomness, or `Date.now`/`performance.now`. Export only the two functions from `domain/index.ts` and `core/src/index.ts`.
- [ ] **1.3** Register the new modules and allowances (D1, RSK-P2): add `contracts/status.ts` and `domain/status.ts` to `tests/structure/inventory.json` with named executable allowances (`STATUS_*` constants; `aggregateStatus`, `renderStatusHuman`); add the exact `status.ts` export surface to `tests/fixtures/ports/v1-contract-inventory.json`; assert `core/src/index.ts` re-exports the two functions. No package manifest or subpath change.
- [ ] **1.4** Author `tests/structure/status-contract.test.ts` (TC-STATUS-008, test-plan §5.2): bind every constant to Appendix C (values, order, labels, schema version), the closed reason/source/outcome sets to spec §8.3, the module to data-only (same AST detector as `verify-imports`), the inventory registration, and in-memory/temp-copy mutation controls (reorder sections, rename a state, drop a reason, change a cap, change the schema version) that fail by name; the unmutated control is green. Read the spec file read-only with a digest assertion.
- [ ] **1.5** Author `tests/behaviour/status-section-states.test.ts` and `tests/fixtures/status/matrix/**` plus `tests/fixtures/status/harness.ts` fact builders (TC-STATUS-003, TC-STATUS-004): the six-section totality/shape assertions (ids/order/title/state/evidence/counts/items/truncation/section-specific fields) and the Appendix A matrix cell by cell, including item-level-unknown twins and a section-unknown fixture for each pair; negative controls remove a section, rename a state, drop `truncated`, and inject a native key; every case asserts state, reasons, counts, ordered item ids, and truncation. No command required; call `aggregateStatus` directly.
- [ ] **1.6** Author the core halves of `tests/structure/status-imports.test.ts` (TC-STATUS-026 contracts/domain halves; TC-STATUS-027 structure half): contracts data-only, domain purity (imports only `#contracts`/relative; no `node:*`/`bun:*`, I/O, clock, randomness, env), single-vocabulary-home scan (no redeclared section/state/reason/source/outcome/cap list outside `contracts/status.ts`), brand-literal absence, and `tests/structure/content-inventory.test.ts` / `subpaths.test.ts` green. Each detector has a failing fixture and a clean control (temp copies only). Phase gate: `bun test tests/structure/status-contract.test.ts tests/structure/status-imports.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/behaviour/status-section-states.test.ts`; `bun run scripts/checks/{ambient-globals,workspace-entrypoints,forbidden-literals,exit-code-literals}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F2-1 and AC-F2-2 structural halves measurable at this boundary (six ids/order, five states, evidence/counts/items/truncation on every section, Appendix A cells exact); TC-STATUS-003/004/008 green; NFR-1 thresholds met; contracts/domain data-only and pure; no new runtime-API location; mutation controls fail by name.
- Should: the constants comparer normalizes backticks/emphasis and reports the diverging constant by name; record in the execution log any item-unknown/section-unknown pair that needed a new fixture.

**Files and modules**:

- Code areas: `packages/core/src/contracts/status.ts` (new), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/domain/status.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/structure/status-contract.test.ts` (new), `tests/structure/status-imports.test.ts` (new — core halves), `tests/behaviour/status-section-states.test.ts` (new), `tests/fixtures/status/matrix/**` (new), `tests/fixtures/status/harness.ts` (new — fact builders), `tests/structure/inventory.json` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated).
- System docs: none (Phase 7 owns reconciliation).

**Tests**:

- TCs implemented: TC-STATUS-003, TC-STATUS-004, TC-STATUS-008; TC-STATUS-026 (contracts/domain halves); TC-STATUS-027 (structure half).
- `bun test tests/structure/status-contract.test.ts tests/structure/status-imports.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/behaviour/status-section-states.test.ts` → green including every mutation control.
- `bun run scripts/checks/{ambient-globals,workspace-entrypoints,forbidden-literals,exit-code-literals}.ts` → exit 0; `pnpm check` → exit 0.

**Completion signal**: `feat(GH-175): add status digest contracts with pure aggregator and renderer`

---

### Phase 2: Bounded GitHub collection reads and trap coverage

**Goal**: Extend the GitHub read slice with the two query-shaped collection reads, raw-page counts, PR exclusion, and the four new trap entries — with the closed operation set and capability declaration unchanged (F-13, DEC-6).

**Tasks**:

- [ ] **2.1** Extend `packages/adapters/src/github/client.ts` (D5): add `listWorkItems(limit)` and `listDeliveryRequests(limit)` to `GithubClient`, each issuing exactly one `GET` to the issues or pulls endpoint with `state=open`, the declared `per_page` limit, and the declared updated-descending sort, and returning `ProviderReadResult<{ items, pageItemCount }>` (inline structural type; no new exported name). Add `normalizeGithubIssueList` and `normalizeGithubPullList` to `normalize.ts`: the issue list skips every object carrying a `pull_request` property before normalization and fails on a malformed non-PR entry; the pull list normalizes every entry or fails the whole read. No pagination, retry, or second request.
- [ ] **2.2** Add the GitHub list fixtures and the four trap entries (D5, D9): `tests/fixtures/providers/github/issues-list-mixed.json` (issues + PR objects), `issues-list-limit.json` (100 raw entries), `issues-list-relations-absent.json`, `pulls-list-review-default.json`; append `GITHUB-LIST-EXCLUDES-PRS`, `GITHUB-LIST-PAGE-LIMIT`, `GITHUB-ISSUE-RELATIONS-ABSENT`, `GITHUB-PR-LIST-REVIEW-DEFAULT` to `tests/fixtures/providers/traps/github.traps.json` with exactly the four fields and resolvable `path#/pointer` references. Fixtures are synthetic, sanitized, and read-only; no credential material.
- [ ] **2.3** Author `tests/behaviour/providers/github-collection.test.ts` (TC-STATUS-021): one bounded request per read (`state=open`, declared limit, declared sort); mixed issue page excludes every PR object; raw `pageItemCount` drives the at-limit signal even when PR objects filter out; absent issue links normalize to `relations: []` (the tracker then declares blocked dependencies unavailable, not empty); PR list normalizes refs/draft/state; absent review decision/threads are not trusted as `open`/zero; no native payload key crosses the subpath or digest; missing/rejected credential is a classified read failure; negative controls (unfixtured URL, non-GET, PR filter removed).
- [ ] **2.4** Extend `tests/structure/trap-catalog.test.ts`, `tests/structure/provider-surface.test.ts`, and `tests/structure/port-contract-inventory.test.ts` (TC-STATUS-022): GitHub trap minimum/expected list becomes seven entries; every entry has exactly four fields and a resolvable reference; `trapCoverageFailures` is empty and each new entry has a matching assertion (and vice versa); `GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations` remains exactly `["read-work-item","read-delivery-request","read-pipeline-run"]`; `ADAPTER_OPERATIONS` gains no `list-*`; the GitHub index still exports exactly the five names (no parallel view type); deletion/mutation controls fail by name. Register `normalizeGithubIssueList`/`normalizeGithubPullList` in `inventory.json` allowances.
- [ ] **2.5** Phase gate: `bun test tests/behaviour/providers/github-collection.test.ts tests/behaviour/providers/github-trap.test.ts tests/behaviour/providers/github-inputs.test.ts tests/structure/trap-catalog.test.ts tests/structure/provider-surface.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/content-inventory.test.ts`; `bun run scripts/checks/{forbidden-literals,ambient-globals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F13-1 complete — PR objects excluded, one bounded page per read, raw page count exposed for truncation, no native payload crosses the subpath, closed operation set/capability unchanged, four trap entries with assertions, credentials only through `CredentialPort`; NFR-7/NFR-8 partial; TC-STATUS-021/022 green.
- Should: the list normalizers share the existing single-item normalizers rather than duplicating field mapping; record any extraction in the execution log.

**Files and modules**:

- Code areas: `packages/adapters/src/github/client.ts` (updated), `packages/adapters/src/github/normalize.ts` (updated), `packages/adapters/src/github/index.ts` (unchanged — the five-name surface does not grow), `tests/behaviour/providers/github-collection.test.ts` (new), `tests/fixtures/providers/github/*.json` (new), `tests/fixtures/providers/traps/github.traps.json` (updated), `tests/structure/{trap-catalog,provider-surface,port-contract-inventory,content-inventory}.test.ts` (updated), `tests/structure/inventory.json` (updated).
- System docs: none (Phase 7 reconciles `feature-provider-client-seeds.md`).

**Tests**:

- TCs implemented: TC-STATUS-021, TC-STATUS-022.
- Focused `bun test` suites and the three checks above green; `pnpm check` exit 0.

**Completion signal**: `feat(GH-175): add bounded GitHub collection reads with trap coverage`

---

### Phase 3: Origin repository binding and bounded local PM-context read

**Goal**: Derive repository addressing and HEAD facts from bounded `.git` metadata, and read the git-ignored PM context with the declared projection — no spawn, no writes, no credential leak (F-12, F-8).

**Tasks**:

- [ ] **3.1** Extend `packages/adapters/src/repo/index.ts` (D6): add `RepositoryHeadFacts`, `RepositoryFacts`, `GitHubRemoteBinding`, `parseGitHubRemote(remoteUrl)`, and `readRepositoryFacts({ cwd, io })`. `readRepositoryFacts` resolves the git root with the existing walker, handles a normal `.git` directory and a linked-worktree `.git` file (`gitdir:`), resolves `commondir` when present for `config`, `refs`, and `packed-refs`, reads only `config`/`HEAD`/the target ref/packed-refs, and returns `{ root?, originUrl?, head: { branch?, sha?, detached } }`. `parseGitHubRemote` accepts HTTPS (`https://github.com/owner/name`, optional `.git`), SSH (`git@github.com:owner/name.git`), and `ssh://git@github.com/owner/name.git`; it strips userinfo and returns `{ ok: true, host: "github.com", owner, name }`, `{ ok: false, reason: "addressing-unresolved" }` for an unparseable/absent URL, or `{ ok: false, reason: "remote-unsupported" }` for a non-GitHub host. No child process, no shell, no network.
- [ ] **3.2** Author `packages/adapters/src/file/pm-context.ts` (D6): `readLocalPmContext({ path, fs }): StatusLocalContextRead`. Missing file → `{ ok: false, reason: "missing", path }`; malformed YAML or a wrong-shape `active_change`/non-array `parked_changes` → `{ ok: false, reason: "malformed", path }`; otherwise project only `active_change.{workItemRef,branch,change_folder}` and `parked_changes[].{workItemRef,branch,change_folder,reason,parkedAt}` into the contracts shapes, mapping `change_folder` to `changeFolder` and never reading `notes` or unrelated fields. Reuse the bounded YAML 1.2 core parse (`parseConfigYaml`) so the 1 MiB/2048-node/64-depth/100-alias limits and silent parser failure apply; never expose raw parser text. Export from `file/index.ts` and register the allowance.
- [ ] **3.3** Register `readRepositoryFacts`, `parseGitHubRemote`, `readLocalPmContext` in `tests/structure/inventory.json` and update `tests/structure/content-inventory.test.ts`; no package manifest/subpath change. Confirm `tests/structure/subpaths.test.ts` and `tests/structure/workspace-entrypoints` remain green.
- [ ] **3.4** Author `tests/behaviour/status-repository.test.ts` (TC-STATUS-020) and the parked-work suite in `tests/behaviour/status-providers-parked.test.ts` (TC-STATUS-019 complete; the lanes/providers cases of the same file land in Phase 5) using `mkdtemp` temp git-shaped directories and PM-context YAML fixtures: HTTPS/SSH/userinfo/no-origin/unparseable/non-GitHub forms; linked-worktree `.git` file; HEAD branch/SHA/detached; no `child_process` import or spawn sentinel; downstream tracker/CI `unavailable`, changes/PRs `degraded`/`unavailable` per matrix; absent/empty/observed/malformed/wrong-shape PM context; item without `workItemRef`; optional age only from a parseable `parkedAt`; `notes` canary never enters the digest; the credential-bearing URL is built in memory (never a committed literal). Assert the parks/readers are not written.
- [ ] **3.5** Phase gate: `bun test tests/behaviour/status-repository.test.ts tests/behaviour/status-providers-parked.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/checks/secret-read-boundary.test.ts tests/checks/privacy-literals.test.ts`; `bun run scripts/checks/{forbidden-literals,ambient-globals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F12-1 complete (binding forms, credential stripping, unavailable reasons, no new key/remote); AC-F8-1 complete (parked-work observed/empty/absent/malformed, optional age, no notes); TC-STATUS-019/020 green; no spawn; no live-tree write; secret-read allowlist still four entries; privacy guard green without a new allowlist entry.
- Should: `readRepositoryFacts` exposes no raw remote URL in the returned facts beyond the origin string needed for parsing; the digest never receives that string.

**Files and modules**:

- Code areas: `packages/adapters/src/repo/index.ts` (updated), `packages/adapters/src/file/pm-context.ts` (new), `packages/adapters/src/file/index.ts` (updated), `tests/behaviour/status-repository.test.ts` (new), `tests/behaviour/status-providers-parked.test.ts` (new — parked-work cases), `tests/fixtures/status/repository/**` (new), `tests/fixtures/status/pm-context/**` (new), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-STATUS-019, TC-STATUS-020.
- Focused suites and checks above green; `pnpm check` exit 0.

**Completion signal**: `feat(GH-175): add origin repository binding and local PM-context read`

---

### Phase 4: The `status` command, runtime composition, and human renderer hook

**Goal**: Compose the read-only `status` command end to end — grammar, injected readers, pure aggregation, edge wiring beside the existing commands, and the one optional human-text renderer — completing the command-surface and output/bounds TCs (F-1, F-11, F-10).

**Tasks**:

- [ ] **4.1** Author `packages/cli/src/commands/status.ts` (D1, D4): `StatusCommandRuntime` and `createStatusCommandDefinition(runtime)` exactly as pinned. `flags: []`, `positionals: { max: 0 }`; the handler is async and performs: read repository facts → if the binding is observed and a SHA resolved, call `readWorkItems(target, STATUS_SOURCE_ITEM_LIMIT)`, `readDeliveryRequests(target, STATUS_SOURCE_ITEM_LIMIT)`, `readPipelineRuns(sha)` sequentially; if the binding is unavailable, do not call any source reader and pass `not-configured` reads; if the SHA is unresolved, do not call `readPipelineRuns` and pass a `commit-unresolved` read; call `readProviderConfig()` and `readProviderParks(nowMs())` once each; call `readLocalContext()` once; build `StatusFacts` with `nowIso()`/`nowMs()`; return `{ data: aggregateStatus(facts) }`. The handler contains no stream write, exit literal, adapter/state import, or error envelope.
- [ ] **4.2** Add the human-renderer hook (D7): extend `CommandDefinition` in `packages/cli/src/index.ts` with `humanText?: (data: unknown, brand: BrandIdentity) => string`; invoke it only on a success outcome in non-`--json` mode inside the existing containment boundary; a throw becomes `fallback.internal`. Extend `WriteOutputOptions` in `packages/cli/src/output/serialize.ts` with `humanText?: string` and write it through the existing single `writeText` call site after redaction, with precedence over `humanJson`. No other command definition sets `humanText`; no new `.write` call site.
- [ ] **4.3** Register and compose (D4): export the definition/runtime types from `commands/index.ts`; add `StatusComposition` and `createStatusCommandRuntime(options)` to `edge.ts` (wiring `readRepositoryFacts`, `parseGitHubRemote`, the GitHub client with the injected instance/credentials/transport, `readProviderParkViews(store, nowMs)`, `readLocalPmContext`, and the internal `resolveProviderConfig` built from the existing `resolve` + `parseAndValidateProviderConfiguration`); add `status?: StatusComposition` to `ConfigProgramOptions` and compose `commands.status` beside `config`/`lint`/`phase`/`provider`/`verify`. Do not call `createProviderEngine`.
- [ ] **4.4** Author `tests/behaviour/status-command.test.ts` (TC-STATUS-001, TC-STATUS-002): `status` and `status --json` return one envelope/digest and the same data; extra positional/unknown flag → `fallback.invocation`, exit `1`, zero source reads; the definition has no flags and `positionals.max` 0; handler write-free; a non-observed fixture (tracker unknown, changes degraded, CI unavailable, providers unavailable, parked unavailable, lanes not-delivered) still returns exit `0` with six sections and truthful summary counts; throwing-handler containment exits `2` with `fallback.internal`; fully-observed control.
- [ ] **4.5** Author `tests/behaviour/status-output.test.ts` (TC-STATUS-005, TC-STATUS-006, TC-STATUS-007): exact envelope/data key sets and `delivery.status.v1` structure; serialized `data` ≤ 65 536 bytes with an over-limit control; human mode's optional header + exactly six section lines in order, ≤24 lines/4096 bytes, no titles/secrets/timestamps/prose, brand-derived header, zero extra reads and same digest as `--json`; under-cap/at-cap/over-cap/source-at-limit fixtures (99/100/101 raw issues, 20-run page, 8/9 per list), `counts.omitted`, `truncated`, `source-truncated`, tracker per-family 4 and aggregate omitted, and the pinned rank keys with reversed-order twins.
- [ ] **4.6** Extend `tests/structure/cli-edge-seam.test.ts` (status composed beside the existing commands, additive optional human hook, no other declarer), the command-half of `tests/structure/status-imports.test.ts` (command imports only core/contracts, no direct adapter/state), `tests/structure/content-inventory.test.ts` and `inventory.json` (new command/edge allowances), and run the phase gate: `bun test tests/behaviour/status-command.test.ts tests/behaviour/status-output.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/status-imports.test.ts tests/golden`; `bun run scripts/checks/{exit-code-literals,ambient-globals,forbidden-literals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F1-1, AC-F1-3, AC-F10-1, AC-F11-1, AC-F11-2 measurable and green; TC-STATUS-001/002/005/006/007 green; the handler is write-free/exit-free; all six sections survive a non-observed run with exit `0`; the human hook is additive and used only by status; no extra render reads.
- Should: the output suite reuses the Phase 1 fact builders/harness; record any new fixture shape in the execution log.

**Files and modules**:

- Code areas: `packages/cli/src/commands/status.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `packages/cli/src/index.ts` (updated — `humanText`), `packages/cli/src/output/serialize.ts` (updated — `humanText` option), `tests/behaviour/status-command.test.ts` (new), `tests/behaviour/status-output.test.ts` (new), `tests/fixtures/status/bounds/**` (new), `tests/fixtures/status/harness.ts` (updated — `runStatusCli`), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/structure/status-imports.test.ts` (updated — command half), `tests/structure/content-inventory.test.ts` (updated), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-STATUS-001, TC-STATUS-002, TC-STATUS-005, TC-STATUS-006, TC-STATUS-007; TC-STATUS-026 (command half).
- Focused suites and four checks above green; `pnpm check` exit 0.

**Completion signal**: `feat(GH-175): add status command with runtime composition and human digest hook`

---

### Phase 5: Collector truthfulness, negative controls, read-only/determinism, and the gate battery

**Goal**: Prove the six collectors, the Appendix A matrix, the exhaustive AC-F9-1 controls, the read-only/deterministic contract, and the tier/brand/error-table/boundary gates with non-vacuous fixtures and seeded controls — with all collector TCs green.

**Tasks**:

- [ ] **5.1** Author `tests/behaviour/status-tracker.test.ts` and `tests/fixtures/status/tracker/**` (TC-STATUS-009, TC-STATUS-010, TC-STATUS-011, TC-STATUS-012): labels-only owner hand-backs (absent `assignee` not unassigned; case-insensitive; closed/non-attention excluded; label-removal control); GitHub blocked dependencies `unavailable`/`signal-unavailable` vs observed-empty control; Jira-shaped done/canceled/open/unobserved targets; stalls at 15/14/13 days, absent/invalid `updatedAt`, comments-only control, injected-clock advance, ordering/caps; hygiene `missing-title`/`missing-labels` only, no comment/custom-field check, conforming zero, ordering/caps; canaries and restored controls per §4.2.
- [ ] **5.2** Author `tests/behaviour/status-changes-ci.test.ts` and `tests/fixtures/status/{changes,ci}/**` (TC-STATUS-013, TC-STATUS-014, TC-STATUS-015): active change observed/observed-empty/unknown; open PR list with refs/draft/state; review state/threads unknown when unavailable; partial failure degraded; CI `failed`/`pending`/`succeeded`/`canceled`/`none` with precedence controls, all-skipped never succeeded, no-run `none` never green, unresolved SHA/missing HEAD/failed read/credential/no-binding unknown/unavailable with reason/class and restored controls; one attempt, no retry/loop.
- [ ] **5.3** Complete `tests/behaviour/status-providers-parked.test.ts` (TC-STATUS-016, TC-STATUS-017, TC-STATUS-018; TC-STATUS-019 already complete): lanes always `not-delivered`, `queue-lane-engine`/`M2-S1`, zero items/counts, zero queue reads, never observed-empty/queue-ready; providers declared/parked/chain-parked/no-chain/unresolved/park-failure with `parked`/`unverified` only, expiry T−1/T/T+1, caps/ordering; zero engine `resolve`/`quota`, zero quota HTTP, zero announcement/park write, zero state mutation; counting stubs and guarded store proven live by deliberate calls; park views built from the real state harness.
- [ ] **5.4** Author `tests/behaviour/status-negative-controls.test.ts` and `tests/fixtures/status/negative-controls/cases.ts` (TC-STATUS-023): the ten AC-F9-1 controls (failed issues/PR/check-runs reads, missing credential, unresolved SHA, unresolved binding, torn park store, missing provider chain, missing PM context, active park), each with the exact non-observed state/reason and a restored control; scan digest and human text for clear/green/available/succeeded/nothing-to-do claims; queue remains `not-delivered`; torn store never "no parks"; every reason from the closed set and every class adapter-local; a meta-assertion fails if a named control is missing.
- [ ] **5.5** Author `tests/behaviour/status-readonly-determinism.test.ts` (TC-STATUS-024, TC-STATUS-025): guarded store (read recorded; append/fence/replace throws), recording transport (GET only, three declared endpoints, no quota/announcement), PM-context bytes/mtime unchanged, no child process/sentinel and no `node:child_process` import, seeded write/POST/spawn controls trip; byte-identical `--json`/human replays, reversed twin invariance, changed-fact control, AST purity scan for `Date.now`/`Math.random`/`process.env`/`Bun.env`/`performance.now`, and human text derived from the same digest.
- [ ] **5.6** Complete the tier/brand/error gates: `tests/structure/status-imports.test.ts` over the final module set (contracts data-only, domain pure, command core-only, adapter subpath confinement, single vocabulary home, brand absence, every detector has a failing fixture and clean control); `tests/checks/secret-read-boundary.test.ts` (allowlist length 4, no status file, no ambient env, seeded violation) and `tests/checks/forbidden-literals.test.ts` (no product literal; `ADOS_STATUS_LIVE` only under `tests/**`; seeded violation); `tests/boundaries` plus `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; TC-STATUS-029 via `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, and `bun run scripts/checks/error-table-sync.ts` (no new row/kind, evidence codes are existing, classes are not identities, both drift directions still fail, read-only); register final inventory allowances and confirm `subpaths.test.ts`/`content-inventory.test.ts`.
- [ ] **5.7** Phase gate: every focused status suite plus `bun test tests/structure tests/checks tests/boundaries`; the five invariant checks; `pnpm check` exit 0; `git diff --check`; `git status --porcelain` clean after the suites.

**Acceptance Criteria**:

- Must: AC-F1-2, AC-F3-1..AC-F3-4, AC-F4-1, AC-F5-1, AC-F6-1, AC-F7-1, AC-F7-2, AC-F9-1, AC-F14-1, AC-F15-1 complete with non-vacuous controls and restored controls; TC-STATUS-009..018 and TC-STATUS-023..029 green (TC-STATUS-019 complete in Phase 3); no existing gate weakened; zero writes/fences/network writes/spawns.
- Should: collector suites share `tests/fixtures/status/harness.ts` builders; record any fixture extraction in the execution log.

**Files and modules**:

- Code areas: `tests/behaviour/status-tracker.test.ts` (new), `tests/behaviour/status-changes-ci.test.ts` (new), `tests/behaviour/status-providers-parked.test.ts` (completed), `tests/behaviour/status-negative-controls.test.ts` (new), `tests/behaviour/status-readonly-determinism.test.ts` (new), `tests/fixtures/status/{tracker,changes,ci,providers,parked,negative-controls}/**` (new), `tests/fixtures/status/harness.ts` (updated), `tests/checks/{secret-read-boundary,forbidden-literals}.test.ts` (updated), `tests/checks/error-table-sync.test.ts` (updated — status evidence code/class assertions), `tests/structure/{status-imports,error-table,content-inventory,subpaths}.test.ts` (updated), `tests/boundaries/**` (additive fixtures only if a scope gap is discovered — none expected), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-STATUS-009..018, TC-STATUS-023..029 (TC-STATUS-019 complete in Phase 3). All collector, negative-control, read-only/determinism, tier/brand, boundary, and error-table TCs are green at this boundary.
- Focused suites and the five invariant checks above green; `pnpm check` exit 0.

**Completion signal**: `test(GH-175): prove collector truthfulness, negative controls, and read-only determinism`

---

### Phase 6: Corpus, golden, performance, live smoke, changeset, evidence, and final local battery

**Goal**: Pin the committed corpus and golden snapshot, measure the NFR-9 bounds, record the release intent and delivery evidence, and run the full local battery to a clean tree — the `@coder`-executed completion of implementation (no push, no PR).

**Tasks**:

- [ ] **6.1** Author `tests/behaviour/status-corpus.test.ts` and `tests/fixtures/status/corpus/*/case.json` (TC-STATUS-030): a committed corpus covering every section, every state (except lanes' non-`not-delivered` states), every transition edge, and every AC-F9-1 control; a throwing `fetch` guard proves zero live calls; expected states/reasons/counts/ordered ids/`truncated`; run twice for bytes; corruption/removal controls fail; corpus completeness meta-check; read-only and clean tree.
- [ ] **6.2** Author `tests/golden/status-digest.test.ts` and `tests/fixtures/status/golden/{digest.json,human.txt}` (TC-STATUS-031) at fixed run id `run-status-fixture`, clock `2026-10-31T14:30:00Z`, and synthetic brand: byte-identical `--json` and human outputs, ≤65 536/24/4096 bounds, six sections/six lines, no `error`, mutation controls on one input fact; golden files read-only at test time.
- [ ] **6.3** Author `tests/behaviour/status-performance.test.ts` (TC-STATUS-033): cap-sized facts; exactly three network reads (issues page, PR page, check-runs), one attempt each with no duplicate URL/retry/page; exactly one logical park-fold read (one `readProviderParkViews` invocation; the existing fold's internal verified-read sequence is not multiplied) and ≤1 config resolve; zero engine/quota calls; unavailable binding short-circuits to zero network reads with six sections; warm up once, take the median of five `aggregateStatus` runs with `performance.now()` and assert ≤50 ms; record the runtime version, machine class, and measured median; a deliberately expensive control proves the timing assertion is live. Do not relax the spec bound (OQ-T8 stays delivery-bound).
- [ ] **6.4** Author `tests/behaviour/status-live.test.ts` (TC-STATUS-032): skipped unless `ADOS_STATUS_LIVE === "1"` (a `tests/**`-only literal) and a resolvable `GITHUB_TOKEN`; compose the production-shaped edge over `nodeRepositoryIo`, `nodePmNotesFileSystemFacts`, a temp state root, `createProcessCredentialPort`, and the GitHub client with native `fetch`; assert only structural invariants (six sections in order, non-empty evidence, counts/truncated, machine ≤64 KiB, human ≤24/4096, queue `not-delivered`, no provider `available`, no observed-with-zero after a failed read, no secret/raw payload, no volatile count pinned); assert the suite is outside `pnpm check`/default CI; a missing-credential control yields unknown sections without false all-clear. No product literal in `packages/**`.
- [ ] **6.5** Author `.changeset/status-v1-minor.md` (D11): `minor` for the lockstep fixed group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`); summary naming the status command, the `delivery.status.v1` contract, the two collection reads, and the human digest; no hand-bumped versions; nothing publishes in this change. Author `chg-GH-175-evidence.md` (D11): per-phase commits and green criteria, gate consolidation with commands + HEAD, the 33-TC coverage map, rollback instructions, OQ-T8 measurement environment, and owner-facing notes (PIN spellings and the three delivery-bound resolutions). Unrun evidence is never recorded as passing.
- [ ] **6.6** Final local battery (record only executed evidence): `pnpm install --frozen-lockfile`; every focused status/golden suite; `bun test` (all layers); `pnpm check`; `bun run scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,exit-code-literals,workspace-entrypoints}.ts`; `bash scripts/.tests/test-doc-distribution.sh`; `git diff --check`; `git status --porcelain` clean. No push; Phase 7 and PR handoff remain.

**Acceptance Criteria**:

- Must: AC-F16-1 complete; NFR-2, NFR-5, NFR-6, NFR-9 measured; TC-STATUS-030/031/032/033 green (TC-032 opt-in/skipped by default); the changeset recorded per conventions; the evidence artifact honest and complete; the full battery green on the working HEAD; clean tree; every phase commit's staged set matched its explicit list.
- Should: the evidence artifact links each TC to its exact execution command and phase; the performance record names the environment.

**Files and modules**:

- Code areas: `tests/behaviour/status-corpus.test.ts` (new), `tests/golden/status-digest.test.ts` (new), `tests/behaviour/status-performance.test.ts` (new), `tests/behaviour/status-live.test.ts` (new), `tests/fixtures/status/{corpus,golden,bounds/cap-sized}/**` (new), `.changeset/status-v1-minor.md` (new), `chg-GH-175-evidence.md` (new).
- System docs: none (Phase 7 owns reconciliation).

**Tests**:

- TCs implemented: TC-STATUS-030, TC-STATUS-031, TC-STATUS-032, TC-STATUS-033.
- The task 6.6 battery exactly as consolidated in the evidence artifact.

**Completion signal**: `docs(GH-175): record status changeset and delivery evidence with final battery`

---

### Phase 7: Documentation and spec synchronization (lifecycle phase 7 — `@doc-syncer`; handoff, NOT `@coder`)

**Goal**: Reconcile the current-truth docs with the delivered status surface and register the new feature doc in the required scans. This phase is a handoff to `@doc-syncer`; `@coder` stops after Phase 6.

**Tasks**:

- [ ] **7.1** Author `doc/spec/features/feature-status-digest.md` with `ados_distribution: internal`: the six-section contract, five states, evidence/counts/truncation, Appendix A derivation, tracker families, changes/PRs, CI results, the queue gap, providers config/park reading, parked work, repository binding, bounds/ranks, machine envelope, human digest, error-identity reuse, and the fixture/live-smoke evidence model. Use brand-neutral wording (the injected binary name as a named metavariable) or the injected brand wording; never a product literal.
- [ ] **7.2** Reconcile `doc/spec/features/feature-provider-client-seeds.md` (collection reads, raw-page truncation, absent relation/review signals, seven GitHub trap entries, unchanged operation set), `feature-state-layer.md` (read-only park-fold consumer), `feature-provider-engine.md` (status consumes config/parks, never the engine/quota), `feature-config-layer.md` (provider branch consumer, no new keys), `feature-result-contract.md` (no new rows; section failures are data), and `feature-monorepo-scaffold-toolchain.md` (new status modules/tests; no new package/subpath/runtime-API location).
- [ ] **7.3** Reconcile `doc/planning/oss-tooling/cli-command-registry.md` (status six sections and queue gap; `queue ready` remains M0-S7), `doc/overview/glossary.md` (status digest, section state, evidence record, observed/degraded/unknown/unavailable/not-delivered, item-level unknown, source availability, owner hand-back, blocked dependency, stall, ticket hygiene, active change, parked work, provider park, provider entry availability, repository binding, source truncation, live smoke), and `doc/00-index.md` (new feature-spec link).
- [ ] **7.4** Register `doc/spec/features/feature-status-digest.md` in `scripts/checks/forbidden-literals.registry.json` in the same change; confirm no product literal is introduced in the doc; confirm `ados_distribution` is present where required.
- [ ] **7.5** Cross-reference sweep: every link touched by 7.1–7.3 resolves; no other `doc/spec/**` page claims status behaviour that no longer holds; `bun run scripts/checks/{forbidden-literals,error-table-sync}.ts`, `bash scripts/.tests/test-doc-distribution.sh`, and `pnpm check` green after the edits.

**Acceptance Criteria**:

- Must: every Appendix H touchpoint reconciled or explicitly recorded unchanged; the new feature doc registered in the required scan; the result-contract documented table remains byte-untouched; the sync, literal, doc-distribution, and aggregate checks green.
- Should: glossary entries stay one-sentence definitions in the existing table style.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-status-digest.md` (new), `doc/spec/features/{feature-provider-client-seeds,feature-state-layer,feature-provider-engine,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md` (updated), `doc/planning/oss-tooling/cli-command-registry.md` (updated), `doc/overview/glossary.md` (updated), `doc/00-index.md` (updated), `scripts/checks/forbidden-literals.registry.json` (updated).

**Tests**:

- `bun run scripts/checks/forbidden-literals.ts` → exit 0; `bun run scripts/checks/error-table-sync.ts` → exit 0; `bash scripts/.tests/test-doc-distribution.sh` → green; `pnpm check` → exit 0.

**Completion signal**: `docs(GH-175): reconcile status digest system spec, guides, and scans` (`@doc-syncer`; PM-scheduled)

---

## Test Scenarios

All 33 TCs map to concrete tasks; no TC is reshaped, no TC is orphaned, and no AC/NFR is left without a TC. Test-plan §4.1 (in-process harness) and §4.2 (non-vacuity) are binding; the per-phase Tests blocks name the focused commands.

| TC ID | Scenario (abbreviated) | AC / NFR | Phase(s) · task(s) | Target layer / file |
|---|---|---|---|---|
| TC-STATUS-001 | Command surface: grammar, parser rejection, `--json` only | AC-F1-1 | **4 complete** (4.1, 4.4) | `tests/behaviour/status-command.test.ts`, `tests/fixtures/status/harness.ts` |
| TC-STATUS-002 | Non-observed sections still return one success envelope, exit 0 | AC-F1-3 | **4 complete** (4.4) | same |
| TC-STATUS-003 | Six-section totality, fixed order, evidence/counts/items/truncation | AC-F2-1, NFR-1 | **1 complete** (1.2, 1.5) | `tests/behaviour/status-section-states.test.ts`, `tests/fixtures/status/matrix/**` |
| TC-STATUS-004 | Appendix A derivation matrix across all sections/states | AC-F2-2, NFR-1, NFR-3 | **1 complete** (1.2, 1.5) | same |
| TC-STATUS-005 | Machine envelope/digest structure within 64 KiB | AC-F11-1, NFR-2, NFR-5 | **4 complete** (4.5) | `tests/behaviour/status-output.test.ts`, `tests/fixtures/status/bounds/**` |
| TC-STATUS-006 | Human digest grammar/bounds, no titles/secrets, zero extra reads | AC-F11-2, NFR-2, NFR-5, NFR-10 | **4 complete** (4.2, 4.5) | same |
| TC-STATUS-007 | Caps, omitted counts, truncation markers, deterministic ordering | AC-F10-1, NFR-2, NFR-4 | **4 complete** (4.5) | same |
| TC-STATUS-008 | Declared constants and closed vocabularies bound to Appendix C | AC-F2-1, DM-12, DM-15, NFR-1 | **1 complete** (1.4) | `tests/structure/status-contract.test.ts`, `tests/structure/inventory.json` |
| TC-STATUS-009 | Owner hand-backs: labels only, absent assignee not unassigned | AC-F3-1 | **5 complete** (5.1) | `tests/behaviour/status-tracker.test.ts` |
| TC-STATUS-010 | Blocked dependencies: GitHub unavailable; Jira target semantics | AC-F3-2 | **5 complete** (5.1) | same |
| TC-STATUS-011 | Stalls: older/fresh/absent/invalid `updatedAt`, injected clock | AC-F3-3 | **5 complete** (5.1) | same |
| TC-STATUS-012 | Hygiene: title/label findings only | AC-F3-4 | **5 complete** (5.1) | same |
| TC-STATUS-013 | Changes/PRs: active change, PR list, unknown review signals, degraded | AC-F4-1 | **5 complete** (5.2) | `tests/behaviour/status-changes-ci.test.ts` |
| TC-STATUS-014 | CI classification: failed/pending/succeeded/canceled/none | AC-F5-1 | **5 complete** (5.2) | same |
| TC-STATUS-015 | CI unresolved SHA/failed read unknown, never green | AC-F5-1 | **5 complete** (5.2) | same |
| TC-STATUS-016 | Lanes always not-delivered, never observed-empty | AC-F6-1 | **5 complete** (5.3) | `tests/behaviour/status-providers-parked.test.ts` |
| TC-STATUS-017 | Providers: parked vs unverified, chain park, no chain, park failure | AC-F7-1 | **5 complete** (5.3) | same + `tests/fixtures/state/harness.ts` |
| TC-STATUS-018 | Providers perform zero engine/quota/write calls | AC-F7-2, NFR-4 | **5 complete** (5.3) | same + `status-readonly-determinism.test.ts` |
| TC-STATUS-019 | Parked work: observed/empty/absent/malformed, optional age, no notes | AC-F8-1 | **3 complete** (3.2, 3.4) | `tests/behaviour/status-providers-parked.test.ts`, `tests/fixtures/status/pm-context/**` |
| TC-STATUS-020 | Repository binding: HTTPS/SSH, credential stripping, unavailable forms | AC-F12-1 | **3 complete** (3.1, 3.4) | `tests/behaviour/status-repository.test.ts` |
| TC-STATUS-021 | GitHub collection reads: PR exclusion, bounded page, absent signals | AC-F13-1, DM-14 | **2 complete** (2.1, 2.3) | `tests/behaviour/providers/github-collection.test.ts` |
| TC-STATUS-022 | Capability unchanged and trap catalog four-field bidirectional coverage | AC-F13-1, NFR-7, NFR-8 | **2 complete** (2.2, 2.4) | `tests/structure/{trap-catalog,provider-surface,port-contract-inventory}.test.ts` |
| TC-STATUS-023 | Exhaustive negative-control matrix: no false all-clear | AC-F9-1, NFR-3 | **5 complete** (5.4) | `tests/behaviour/status-negative-controls.test.ts` |
| TC-STATUS-024 | Read-only: zero writes/fences/mutations/network writes/spawns | AC-F1-2, AC-F7-2, NFR-4 | **5 complete** (5.5) | `tests/behaviour/status-readonly-determinism.test.ts` |
| TC-STATUS-025 | Determinism and byte-identical replay | AC-F1-2, NFR-4 | **5 complete** (5.5) | same + `tests/golden/helpers.ts` |
| TC-STATUS-026 | Tier, purity, runtime-API location, no new package/subpath | AC-F14-1, NFR-7 | 1 (core halves, 1.6) → 4 (command half, 4.6) → **5 complete** (5.6) | `tests/structure/status-imports.test.ts`, `subpaths.test.ts`, `content-inventory.test.ts`, `cli-edge-seam.test.ts` |
| TC-STATUS-027 | Secret allowlist four, no product literals, live literal test-only | AC-F14-1, NFR-7, NFR-10 | 1 (structure half) → **5 complete** (5.6) | `tests/checks/secret-read-boundary.test.ts`, `forbidden-literals.test.ts`, `status-imports.test.ts` |
| TC-STATUS-028 | Boundary, ambient, entrypoint, inventory gates | AC-F14-1, NFR-7 | **5 complete** (5.6) | `tests/boundaries/**`, `scripts/checks/*.ts`, `subpaths`/`content-inventory` |
| TC-STATUS-029 | Error-table stability and evidence code/class discipline | AC-F15-1, NFR-8 | **5 complete** (5.6) | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` |
| TC-STATUS-030 | Committed corpus drives all six sections with zero live calls | AC-F16-1, NFR-6 | **6 complete** (6.1) | `tests/behaviour/status-corpus.test.ts` |
| TC-STATUS-031 | Golden full-digest snapshot and bounds | AC-F16-1, NFR-2, NFR-5 | **6 complete** (6.2) | `tests/golden/status-digest.test.ts` |
| TC-STATUS-032 | Opt-in live smoke: structural only, no volatile counts | AC-F16-1, NFR-6 | **6 complete** (6.4) | `tests/behaviour/status-live.test.ts` (skipped without switch) |
| TC-STATUS-033 | Performance and read-cost bounds (NFR-9) | NFR-9, AC-F16-1 | **6 complete** (6.3) | `tests/behaviour/status-performance.test.ts` |

**AC coverage** (test plan §3.1 is authoritative; every AC lands green by Phase 6): AC-F1-1 → TC-001 (Ph 4) · AC-F1-2 → TC-024/025 (Ph 5) · AC-F1-3 → TC-002 (Ph 4) · AC-F2-1 → TC-003/008 (Ph 1) · AC-F2-2 → TC-004 (Ph 1) · AC-F3-1 → TC-009 (Ph 5) · AC-F3-2 → TC-010 (Ph 5) · AC-F3-3 → TC-011 (Ph 5) · AC-F3-4 → TC-012 (Ph 5) · AC-F4-1 → TC-013 (Ph 5) · AC-F5-1 → TC-014/015 (Ph 5) · AC-F6-1 → TC-016 (Ph 5) · AC-F7-1 → TC-017 (Ph 5) · AC-F7-2 → TC-018 (Ph 5) · AC-F8-1 → TC-019 (Ph 3) · AC-F9-1 → TC-023 (Ph 5) · AC-F10-1 → TC-007 (Ph 4) · AC-F11-1 → TC-005 (Ph 4) · AC-F11-2 → TC-006 (Ph 4) · AC-F12-1 → TC-020 (Ph 3) · AC-F13-1 → TC-021/022 (Ph 2) · AC-F14-1 → TC-026/027/028 (Ph 5) · AC-F15-1 → TC-029 (Ph 5) · AC-F16-1 → TC-030/031/032 (Ph 6). Twenty-four of twenty-four ACs covered; zero deferred.

**NFR coverage**: NFR-1 → TC-003/004/008 (Ph 1) · NFR-2 → TC-005/006/007 (Ph 4) · NFR-3 → TC-004/023 plus every collector control (Ph 1/5) · NFR-4 → TC-024/025 (Ph 5) · NFR-5 → TC-005/006 (Ph 4) · NFR-6 → TC-030/031/032 (Ph 6) · NFR-7 → TC-026/027/028 (Ph 5) · NFR-8 → TC-029 (Ph 5) · NFR-9 → TC-033 (Ph 6) · NFR-10 → TC-005/006/027 (Ph 4/5). Ten of ten NFRs covered; zero deferred.

**Execution order** maps to phases as: test-plan step 1 (contracts/constants/baselines) → Phase 1 with completion of the probe/boundary halves in Phase 5; step 2 (command surface/totality) → Phases 1 and 4; step 3 (state derivation/evidence) → Phases 1 and 5; step 4 (tracker) → Phase 5; step 5 (changes/CI/lanes) → Phase 5; step 6 (providers/parked/repository) → Phases 3 and 5; step 7 (GitHub collection) → Phase 2; step 8 (output/bounds/determinism) → Phases 4 and 5; step 9 (corpus/golden/performance) → Phase 6; step 10 (live/aggregate) → Phase 6.

## Artifacts and Links

| Artifact | Location | Type / role |
|---|---|---|
| Change specification (v1.1) | [chg-GH-175-spec.md](./chg-GH-175-spec.md) | Source of requirements: F-1..F-16, AC-F1-1..AC-F16-1, NFR-1..NFR-10, DM-1..DM-15, DEC-1..DEC-17, Appendix A/C/D/E/F/G/H |
| Test plan (v1.1, 33 TCs) | [chg-GH-175-test-plan.md](./chg-GH-175-test-plan.md) | Source of TC IDs, §4.1 harness contract, §4.2 non-vacuity contract, execution order, evidence commands |
| This plan | `./chg-GH-175-plan.md` | The only file written by this authoring pass |
| PM notes | `./chg-GH-175-pm-notes.yaml` | Delivery tracker state; not a status fixture |
| Decision records | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) | Tier/runtime confinement; `updatedAt` absence; comment absence |
| Contract vocabulary | `packages/core/src/contracts/status.ts` | New; all constants and public types (Phase 1) |
| Pure aggregator/renderer | `packages/core/src/domain/status.ts` | New; `aggregateStatus`, `renderStatusHuman` (Phase 1) |
| GitHub collection reads | `packages/adapters/src/github/{client,normalize}.ts` | Extended; two bounded list reads + raw page count (Phase 2) |
| Repository binding / PM context | `packages/adapters/src/repo/index.ts`, `packages/adapters/src/file/pm-context.ts` | Extended/new; origin/HEAD and local PM-context projection (Phase 3) |
| Command / composition / human hook | `packages/cli/src/commands/status.ts`, `commands/index.ts`, `edge.ts`, `index.ts`, `output/serialize.ts` | New/extended; `status` runtime, edge composition, optional `humanText` (Phase 4) |
| Status suites and fixtures | `tests/behaviour/status-*.test.ts`, `tests/behaviour/providers/github-collection.test.ts`, `tests/structure/status-*.test.ts`, `tests/golden/status-digest.test.ts`, `tests/fixtures/status/**`, `tests/fixtures/providers/{github,traps}/**` | All 33 TCs at their pinned locations (Phases 1–6) |
| Contract inventories | `tests/structure/inventory.json`, `tests/fixtures/ports/v1-contract-inventory.json` | Exact module/export surfaces (Phase 1) |
| Release intent | `.changeset/status-v1-minor.md` | New in Phase 6; lockstep fixed group; no publishing in this change |
| Delivery evidence | `./chg-GH-175-evidence.md` | New in Phase 6 (GH-172/174/177/179 pattern) |
| Current-truth feature doc | `doc/spec/features/feature-status-digest.md` | New in Phase 7 (`@doc-syncer`) + forbidden-literals registration |
| Reconciled docs | `doc/spec/features/{feature-provider-client-seeds,feature-state-layer,feature-provider-engine,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md`, `doc/planning/oss-tooling/cli-command-registry.md`, `doc/overview/glossary.md`, `doc/00-index.md` | Updated in Phase 7 |
| Referenced specs & rules | [feature-provider-client-seeds.md](../../../spec/features/feature-provider-client-seeds.md), [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [feature-provider-engine.md](../../../spec/features/feature-provider-engine.md), [feature-config-layer.md](../../../spec/features/feature-config-layer.md), [feature-result-contract.md](../../../spec/features/feature-result-contract.md), [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md), [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Consumed contracts and rules; referenced, not rewritten |

No new standalone delivery-infrastructure check or CI job is planned (D12). If execution genuinely needs one, escalate to PM — no such addition is pre-authorized here.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------------|--------|---------|
| 1.0 | 2026-10-31T15:45:00Z | Implementation Plan Writer | Initial seven-phase plan. Read the completed spec v1.1, test plan v1.1 (33 TCs, §4.1/§4.2 contracts), ADR-0003/0004/0006, the structural template, the GH-177 plan precedent, and the baseline code (contracts/domain/state/provider/config, adapters github/repo/file/credentials/io, CLI command/edge/output, test harnesses, inventories, checks, changeset config). Pinned the contract export names/constants, section ids/titles, five-state/reason/source/outcome vocabularies, caps/limits, rank keys, schema version, human grammar, runtime/edge signatures, and exact error-identity reuse; delivery bindings D1..D12; 7 phases / 40 tasks (35 `@coder`, 5 `@doc-syncer` handoff); 33/33 TCs, 24/24 ACs, 10/10 NFRs traceable with zero orphaned TCs; commit strategy, fixture hygiene, rollback/failure handling, risks, and the execution-log skeleton. Four delivery-bound resolutions recorded (PM-context `change_folder` → `changeFolder`; inline raw-page count with the five-name GitHub surface intact; config-validation failure → `provider-chain-unresolved`; NFR-9/TC-033 logical park-fold accounting preserving the unchanged state layer); no behavioural spec/test-plan correction proposed, with the NFR-9/TC-033 accounting tension recorded rather than silently weakened. |

## Execution Log

Execution notes for `@coder` (binding, from D9/D10):

- **No subagent dispatch**: `@coder` executes Phases 1–6 with inline committer discipline; Phase 7 is a `@doc-syncer` handoff — never mark it complete by finishing implementation alone.
- **One Conventional Commit per phase** with the phase's completion signal; explicit `git add` of exactly the phase's Files-and-modules entries; verify the staged set before committing; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; no push during delivery; no amend.
- **Inline gates**: `pnpm check` before every commit with the log captured under `.ai/local/` (never staged); a red gate blocks the commit — fix it or stop at the last green task boundary and report.
- **Fixture hygiene**: committed fixtures read-only; derived/mutated fixtures under fresh `mkdtemp` siblings in the OS temp directory, removed in teardown; corpus files read in place with digest guards; the live tree clean after every suite.
- **Evidence honesty**: record only executed evidence with command + HEAD; unrun results are never recorded as passing (test plan §7).
- **Fail-closed escalations**: a moved spec constant, inventory drift, a spec/test-plan inconsistency, or a 50 ms measurement failure is a STOP-and-report to PM — never a test weakening or a silent reinterpretation (A-T3, A-T4, OQ-T8).

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-31T15:45:00Z | 2026-10-31T15:45:00Z | none | This pass read the completed spec (v1.1), test plan (v1.1, 33 TCs), ADR-0003/0004/0006, the template, the GH-177 plan precedent, and the baseline code; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. Executors record per-phase evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
| 1 | Not started | — | — | — | Contracts + pure aggregator/renderer + TC-003/004/008 + core halves of TC-026/027. |
| 2 | Not started | — | — | — | GitHub collection reads + traps + TC-021/022. |
| 3 | Not started | — | — | — | Repository binding + PM context + TC-019/020. |
| 4 | Not started | — | — | — | Status command + edge composition + human hook + TC-001/002/005/006/007 + command half of TC-026. |
| 5 | Not started | — | — | — | Collector/negative/read-only/determinism suites + TC-009..018/023..029 complete. |
| 6 | Not started | — | — | — | Corpus/golden/performance/live + changeset + evidence + final battery + TC-030..033. |
| 7 | Handoff | — | — | — | `@doc-syncer` reconciliation; not `@coder`-executed. |
