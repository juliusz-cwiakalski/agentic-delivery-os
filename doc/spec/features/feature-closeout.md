---
ados_distribution: internal
id: SPEC-CLOSEOUT
status: Current
created: 2026-11-01
last_updated: 2026-11-01
owners: ["engineering"]
service: delivery-os
summary: "The delivered closeout transaction: a dry-run-by-default `closeout <workItemRef>` command, the deterministic seven-step plan, SHA-256 operation identities and the append-only `closeout.operation` ledger over the real JSONL state driver, a production CLI composition over the real provider clients, git seam, and state store, GitHub and Jira writes with declared GitLab gaps, review-thread resolution, the owed-flip sweep, checkout restore, squash-safe local branch cleanup, the discriminated work-item read observation and the separate reverse-dependent no-surface vocabulary, provider-asserted label/relation availability signals, bounded output measured in UTF-8 bytes, and the four `closeout` error identities."
links:
  related_changes: ["GH-183"]
  related_decisions: ["TDR-0008", "ODR-0003", "ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006"]
  contracts:
    - "packages/core/src/contracts/closeout.ts"
    - "packages/core/src/contracts/ports.ts"
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/state.ts"
---

# Feature: Closeout Transaction

> **Role of this Document:** Source of truth for the closeout feature. It describes the delivered command, plan, ledger, provider postures, safety predicates, output, and failure identities. Requirements live in the GH-183 change artifacts; this document describes current behavior.

## 1. Overview

`closeout <workItemRef>` is the Deliver-family post-merge transaction. One invocation computes a deterministic seven-step plan across the tracker, review, checkout, and local-branch surfaces, renders it in dry-run mode by default, and applies it only with `--apply`. Every operation carries a deterministic operation identity; terminal outcomes are persisted in the append-only state ledger as `closeout.operation` records, so a re-run reuses completed work and converges instead of repeating effects.

Provider writes are delivered for GitHub and Jira. GitLab remains a read slice with declared write gaps. Checkout restore and local branch deletion run through a dedicated git branch/checkout seam, and branch deletion is permitted only when a squash-safety predicate proves the branch's work landed. The transaction is bounded in operations, time, and output, and it is proven offline against committed fixtures and temporary local repositories.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** The post-merge ceremony is manual or model-driven and routinely misses steps: a ticket stays open, lifecycle labels linger, an assignee remains, a dependent never learns the blocker cleared, review threads stay unresolved, the checkout stays on a deleted branch, or an old local branch accumulates. Retrying a partial ceremony has no memory of what already landed, and deleting a branch after a squash merge cannot rely on git ancestry because a squash merge rewrites ancestry.
- **Affected Users:** Coordinators and delivery agents closing a merged change; operators who own the local checkout; reviewers who expect resolved threads; maintainers who own branch safety.
- **Business Impact:** Manual closeout misses create stale tracker state, misleading readiness inputs, unreviewed threads, and either stranded branches or unsafe deletions. One deterministic, idempotent transaction removes the routine misses and makes retries safe.

### 2.2 Goals & Success Metrics

- **Primary goal:** Deliver one deterministic, dry-run-by-default, idempotent closeout transaction whose provider and local effects converge on re-run.
- **KPIs:** zero routine manual misses after adoption; 100% of re-runs after a completed or partially completed apply perform zero duplicate effects; identical inputs yield byte-identical plans and operation identities; 100% of unsupported operations carry a valid declared-gap reason; 100% of closeout tests run offline without live credentials or network; zero branch deletions on unsafe fixtures.

### 2.3 Non-Goals

- Harness session telemetry capture at closeout (M1-S11); closeout reads no session store or harness statistics.
- Remote branch deletion, remote ref cleanup, force push, or history rewrite.
- GitLab write operations; GitLab writes and the work-item read remain declared gaps.
- The full GitHub adapter, full issue lifecycle, releases, and operations beyond closeout (M3-S3).
- Posting a closure comment or arbitrary tracker/PR comment writes; `write-comment` remains a declared gap.
- Merge execution or merge verification.
- Cross-repository closeout, global state, or multi-repo fan-out.
- MCP and OpenCode/host closeout surfaces.
- Memory capsule completion, promotion, or retrospective records (M1-S12).
- Owner-gate SLA mechanics, board escalation, brief rendering, queue/lane/dispatch, or supervision behavior.
- Changing the behavior or guarantees of the read-only commands.

## 3. User Experience & Functionality

### 3.1 Capabilities

#### Command surface

`closeout <workItemRef> [--apply] [--json]` is a top-level Deliver-family command. The work-item ref must match the canonical uppercase `<PREFIX>-<digits>` shape (`^[A-Z][A-Z0-9]*-\d+$`); validation is case-sensitive, performs no case folding, and runs before any source read. Exactly one ref is accepted.

- Without `--apply` the command is a plan: it reads state, computes the transaction, and renders it with zero provider writes, zero git mutations, zero state appends, and zero fence acquisitions.
- With `--apply` it executes the same plan and persists operation outcomes.
- A missing, malformed, or lowercase ref, or exactly one extra positional, is `input.value.rejected`. Two or more extra positionals or an unknown flag are `fallback.invocation` before the handler. All grammar failures exit non-zero and perform no source read or mutation.
- The handler returns data or a classified failure; the CLI edge owns rendering and exit projection. No command-help surface is added.

#### Deterministic seven-step plan

The plan is a pure function of observed work-item and read facts, provider capabilities, the merged delivery request, local repository facts, declared contract data, and persisted terminal outcomes. Steps appear in this binding order:

| Order | Step | Expansion |
|---:|---|---|
| 1 | `ticket-to-done` | One `transition-work-item` operation, or a gap when the transition is unsupported. |
| 2 | `lifecycle-label-sweep` | One removal operation per present lifecycle-state label plus one `delivered` add operation when absent. |
| 3 | `unassign` | One explicit clear operation with canonical `{ assignee: "none" }`. |
| 4 | `owed-flip-sweep` | One `write-work-item` operation per eligible direct dependent (cap 200). |
| 5 | `comment-resolution` | One `resolve-delivery-thread` operation per unresolved thread on the merged delivery request (cap 100). |
| 6 | `checkout-restore` | One `restore-checkout` operation, or a satisfied/refused state. |
| 7 | `branch-cleanup` | One `delete-branch` operation, or a satisfied/refused state. |

Label operations follow the declared disposition order, dependents are ordered by provider entity identity, and threads are ordered by thread identity. Each operation carries canonical arguments, a provider target, an engine identity (`git` for the two local steps, the provider instance name otherwise), and an operation identity. No wall-clock time, randomness, API return order, or hash-map iteration order participates in the plan. Plan and apply compute the same plan; apply may reuse persisted terminal outcomes and execute only pending operations.

#### Operation identity and idempotency ledger

Every operation identity is a SHA-256 digest over canonical JSON (sorted keys, no insignificant whitespace) of the declared identity inputs: workspace identifier, work-item ref, engine, adapter capability context, operation name, canonical arguments, and provider target. The capability context is the adapter's declared `supported` posture or its gap reason for that operation, so a gap that later becomes supported produces a new identity instead of being permanently blocked by an old gap record.

On apply, the engine reads the persisted closeout history through a verified state read and folds it: the first terminal outcome per operation identity is authoritative. A terminal outcome (`applied`, `satisfied`, `skipped-gap`, `skipped-noop`) is reused without re-executing. A persisted `failed` record is retained as evidence but is not terminal; a re-run re-observes provider state, records `satisfied` when the effect already landed, and otherwise retries. Every closeout write is idempotent by construction (set done, add/remove a named label, clear assignee, add/remove a named label on a dependent, resolve a named thread, restore checkout, delete a named local branch), so a retry after an unknown outcome is safe. A crash between a provider effect and the ledger append converges on the next run as `satisfied`.

The ledger uses one additive record kind, `closeout.operation`, with payload schema `delivery.closeout.operation.v1`, under the store-scoped key prefix `closeout.operations:`. Each record carries the operation identity, work-item ref, engine, capability context, operation, canonical arguments, provider target, outcome, optional reason, bounded evidence, and an injected-clock timestamp. Apply acquires one single-writer fence, appends one record per attempted operation outcome through the fenced port, and releases the fence in a `finally` block. An absent per-work-item history is verified-empty and read as an empty history; torn or malformed ledger state is a classified `state.*` failure, never zeros.

#### Ticket-to-done

The target work item is read through a discriminated observation. A provider not-found fails the command with `closeout.target.unobserved` and performs zero writes. A malformed payload fails as the adapter-local `provider.payload.invalid` and is never mapped to not-found. A provider without the work-item read yields a declared gap for the ticket-dependent steps.

An observed item already in the delivery `done` state is `satisfied` with zero write. Otherwise the step schedules one `transition-work-item` operation with canonical `{ deliveryState: "done" }`. The adapter resolves its provider-specific transition: GitHub closes the issue; Jira executes its data-driven done transition by workflow-map name. If the adapter cannot represent the transition, the step is a declared gap and the transaction continues.

#### Lifecycle label sweep

The sweep is bounded contract data, not an open-ended label rewrite:

| Label | Disposition |
|---|---|
| `change` | keep |
| `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, `blocked` | remove when present |
| `delivered` | add when absent |

Every label not named above is preserved. The observed label set must be provider-asserted: the work-item normalizers emit `signals.labels` as `observed` for a present label container (including an explicitly empty array) and `unavailable` when the provider omits the container. An absent or unavailable label signal makes the step `skipped-noop` with `label-signal-unavailable` evidence and performs no blind replacement. A present lifecycle label yields one removal operation; an absent one is satisfied. Adding `delivered` when it is present is satisfied. On Jira the adapter implements the provider's full-array replace mechanics: it computes the target set from provider-asserted labels at execution time, removes only the named labels, adds `delivered`, and preserves every other label. Both GitHub and Jira label writes refuse an unavailable label signal instead of replacing from a collapsed empty set.

#### Unassign

Unassign issues an explicit clear operation and never infers "already unassigned" from an absent assignee field, because absence means the provider did not supply the signal. The canonical argument is `{ assignee: "none" }`, so re-runs share the identity. GitHub sets the issue assignee to null; Jira clears the assignee field. When the work-item read is not `observed`, the step is `skipped-gap` with `provider-unsupported`, the same provider-level read gap `ticket-to-done` reports; a read that is not observed says nothing about write support and is never misattributed to a missing write capability. A provider without assignee-clear support declares a gap and skips with evidence. A prior terminal unassign outcome or a provider-confirmed absent assignee after a clear converges as satisfied.

#### Owed-flip sweep

An owed-flip moves an open direct dependent to the declared owner-attention label `hand-back` (the owner owes the next action) and removes a present `blocked` label. The sweep is bounded to direct dependents and runs only on explicitly provider-asserted relation evidence:

- Candidate dependents come from the closed item's `blocks` relation set and/or a bounded reverse query for open items that declare this item in their `blocked-by` relations, but only when the corresponding read observation is `observed`. An unavailable or unknown relation signal never yields candidates and is never treated as an empty set.
- For each candidate the engine reads the candidate's full `blocked-by` relation set. The candidate is flipped only when it is still open, its relation signal is provider-asserted, every blocker is observed `done` or `canceled`, and the candidate is not already carrying `hand-back`.
- A candidate with any open blocker is skipped with evidence naming the open-blocker count. The bounded evidence carries the aggregate `openBlockers` count, the per-candidate maximum `maxOpenBlockers`, the `unavailableSignals` count, and the evaluated/flipped/skipped counts. A candidate whose blocker set is unknown or unavailable is skipped with `relation-signal-unavailable` evidence and is never flipped.
- A candidate already carrying `hand-back` and not carrying `blocked` is satisfied with zero write. A candidate carrying both `hand-back` and `blocked` gets a `blocked` removal.
- Every flip is one `write-work-item` operation with canonical `{ add: ["hand-back"], remove: ["blocked"] }`; every flip is recorded in the ledger and the output.

The sweep is capped at 200 direct dependents per run, ordered by provider entity identity. A truncated run records `truncated: true` and the omitted count. Flipped candidates are excluded on later runs, so repeated runs re-evaluate the remaining bounded set and make progress as eligibility changes; a still-blocked candidate is re-evaluated and never flipped until its blockers clear.

The reverse-dependent read uses a distinct `CloseoutReverseDependentObservation` rather than the work-item observation, because an absent surface and a currently unavailable signal are different facts. `no-surface` means the adapter has no bounded reverse query surface: a missing provider endpoint (HTTP 404/410) or a provider whose work-item read is a gap. The step is then `skipped-gap` with `provider-unsupported`, never a signal-level skip. `unavailable` means the surface exists but the current read failed (authentication, transport, or server failure); the step is `skipped-noop` with `relation-signal-unavailable` evidence and performs no flip. If the reverse read is observed but an individual candidate's relation signal is unavailable, that candidate is skipped with `relation-signal-unavailable` evidence while other observed candidates are evaluated; no unavailable candidate is flipped. The bounded reverse query is a query-shaped form of `read-work-item`; it adds no closed adapter operation and no capability flag, and `CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS` names the closed observation set.

#### Review-thread resolution

The engine resolves unresolved review threads on the merged delivery request. The merged request is resolved by a bounded source-ref lookup. Threads are processed in deterministic identity order, skipping already-resolved threads. Each unresolved thread yields one `resolve-delivery-thread` operation with canonical `{ deliveryRequest: <identity>, threadId: <id> }`. The GitHub adapter uses the GraphQL `resolveReviewThread` mutation behind the existing injected transport; a thread observed resolved at execution time is `satisfied`.

When the merged delivery request is not observed (no merged request), the step is `skipped-noop` with `no-delivery-request` evidence and is not a failure. When the provider has no delivery-request or thread-resolution surface (Jira), the step is `skipped-gap` with `provider-unsupported`. Resolution is capped at 100 unresolved threads per delivery request; a truncated run records the bound and a re-run continues because resolved threads are excluded. A thread-resolution write failure returns `closeout.write.failed`; completed outcomes are persisted and a retry converges.

#### Checkout restore

The restore target is the merged delivery request's target ref; when no merged request is observed, the fallback is the pinned v1 integration base `main-tools`. The integration base is compiled contract data, not a configuration key; an installed project whose integration branch differs relies on the merged request's target ref (the normal path). The resolved base is recorded in the plan and output.

- The current checkout is classified as already at the base, on the delivery branch, detached at the delivery head, unrelated, or missing.
- Already at the base is `satisfied` with zero switch. An unrelated checkout is `satisfied` with `already-elsewhere` evidence and is never hijacked.
- On the delivery branch or detached at the delivery head, the engine restores the base only when the worktree is clean and the base ref resolves locally. A dirty worktree, missing base ref, or missing checkout is a safety refusal.
- A safety refusal attempts no destructive action, deletes no branch, and makes apply return `closeout.branch.unsafe`.

#### Squash-safe local branch cleanup

Branch cleanup is local only. It never deletes a remote branch, pushes, force-updates a ref, or rewrites history.

The engine identifies local branches matching the repository branch convention `<type>/<workItemRef>/<slug>`. No match is `satisfied` with `no-branch` evidence. More than one match selects the branch whose local head equals the merged request's `headSha`; if no unique match exists, plan mode renders a `would-refuse` branch step with `closeout.target.ambiguous` for inspection, and apply projects the `closeout.target.ambiguous` failure before any mutation and deletes nothing.

Deletion is permitted only when the full predicate holds:

1. The delivery request is observed merged.
2. Its source ref matches the local branch by the branch convention.
3. The merged head identity is observed and equals the local branch head exactly; an unknown head refuses rather than guesses.
4. The branch is not protected. Protected refs are the resolved base, the integration base, `main`, `main-tools`, `HEAD`, and any declared protected ref; the protected set always wins.
5. The branch is not the current checkout after restore and is not checked out in another worktree.
6. If checkout restore was required, it succeeded; a refused restore blocks deletion.
7. No earlier transaction operation failed. Declared gaps and no-op outcomes do not block deletion; a non-gap failure does, so the branch remains available while the operator retries.

A branch already deleted is `satisfied` with zero mutation. A branch whose head moved after the merged head is refused because it may contain new, unmerged work. The seam re-reads the local branch head immediately before `git branch -D` and refuses with `closeout.branch.unsafe` when it no longer equals the merged head, so a head that moves between planning and deletion is still safe. The seam also rejects `PROTECTED_REF_NAMES` directly as defense in depth, even when a caller bypasses the planner. A safety refusal returns `closeout.branch.unsafe` and preserves the branch. Force deletion (`git branch -D`) is used only after the predicate proves the work landed; the predicate, not git ancestry, is the proof, because a squash merge deliberately rewrites ancestry.

#### Provider capability matrix

Every closeout operation maps to one declared adapter operation. An operation absent from `supportedOperations` is unsupported; a declared gap is a first-class outcome, not a failure. No step reports success for an operation the adapter does not support, and a supported read never implies a write.

| Operation | GitHub | Jira | GitLab |
|---|---|---|---|
| `read-work-item` | supported | supported | gap (`adapter-not-implemented`) |
| `write-work-item` | supported (labels, assignee clear) | supported (full-array label replace, assignee clear) | gap (`adapter-not-implemented`) |
| `transition-work-item` | supported (issue close) | supported (data-driven done transition) | gap (`adapter-not-implemented`) |
| `read-delivery-request` | supported | gap (`provider-unsupported`) | supported |
| `write-delivery-request` | gap (`adapter-not-implemented`) | gap (`provider-unsupported`) | gap (`adapter-not-implemented`) |
| `read-pipeline-run` | supported | gap (`provider-unsupported`) | supported |
| `write-comment` | gap (`adapter-not-implemented`) | gap (`adapter-not-implemented`) | gap (`adapter-not-implemented`) |
| `resolve-delivery-thread` | supported | gap (`provider-unsupported`) | gap (`adapter-not-implemented`) |

`resolve-delivery-thread` is an additive member of the closed operation set, governed by TDR-0008. GitHub implements it; Jira declares it provider-unsupported; GitLab declares it adapter-not-implemented. GitLab's slice also has no work-item read, so its ticket, label, unassign, owed-flip, and thread steps are gaps while checkout restore and local branch cleanup still run from read evidence. The bounded reverse-dependent query is a query-shaped form of `read-work-item` and adds no closed operation.

#### Merged delivery request and merged head

The merged delivery request is resolved by a bounded source-ref lookup that returns merged requests whose source ref follows the branch convention for the work item. Deterministic selection picks the request with the highest numeric provider entity identity; non-numeric identities compare lexically. When no merged request is found, delivery-request-dependent steps skip with `no-delivery-request` evidence and the checkout base falls back to the integration base.

`DeliveryRequest` carries an additive optional `headSha`: the provider-resolved head commit of the merged request, copied verbatim. Absent means unknown, never a guessed or derived value. GitHub normalizes the pull-request head SHA and GitLab normalizes the merge-request SHA when present; a provider that cannot supply it leaves it absent and branch cleanup refuses. The lookup and the field use the existing injected transport and credential port; no new network runtime location is introduced.

#### Read observation

Closeout-relevant work-item reads return a discriminated `CloseoutReadObservation`:

- `observed` — the provider asserted the entity or signal; an empty collection means none. The observation may carry `signals` with per-signal availability for labels and relations.
- `not-found` — the provider explicitly reports that the entity does not exist (HTTP 404).
- `unavailable` — the provider has no work-item read surface (for example GitLab) or the read cannot produce a value. An omitted label or relation container is not `unavailable`: it is an `observed` read whose `signals` mark that container unavailable.
- `invalid` — the payload or parse failed, or the HTTP read failed with an authentication, transport, or server error (any non-404 non-2xx response). HTTP 401/403/500 are therefore `invalid`, never a false capability claim.

The bounded reverse-dependent read uses the separate `CloseoutReverseDependentObservation` with the closed set `CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS`: `observed`, `no-surface`, `not-found`, `unavailable`, and `invalid`. `no-surface` is an absent surface and maps to a provider-level gap; `unavailable` is an existing surface whose current read failed. The distinction keeps an absent dependency surface from being reported as a signal-level skip.

A target work-item read maps `not-found` to `closeout.target.unobserved`, `unavailable` to a declared gap for ticket-dependent steps, and `invalid` to the adapter-local `provider.payload.invalid`. An observed read's availability signals make an unavailable label signal never an empty label set and an unasserted relation array never an empty blocker set. The observation is an adapter-I/O refinement: it adds no closed operation, no core primitive-port field, and no schema-version bump.

#### Output and evidence

Machine mode returns one `CommandResult` envelope whose `data` is a bounded `delivery.closeout.v1` payload: schema id, command `closeout`, work-item ref, mode (`plan` | `applied`), resolved base ref, optional bounded delivery-request summary (system, entity, refs, optional `headSha`), ordered steps with operations and outcomes, a summary count by outcome, truncation markers, and the ledger key.

Plan mode uses `would-apply`, `satisfied`, `skipped-gap`, `skipped-noop`, and `would-refuse`. Apply mode uses `applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, and `refused`. Human mode renders a deterministic digest from the same data without extra reads.

Output is bounded at 64 KiB machine payload, 200 human lines, and 16 KiB human text, with every byte bound measured as UTF-8 bytes (multibyte characters count by encoded length, not UTF-16 code units), and deterministic truncation that drops trailing operations/evidence first and records the marker. Output never contains comment bodies, titles, raw provider payloads, credentials, environment values, command arguments, or free-form prose. Evidence names operations, provider targets, counts, refs, label names, outcomes, and classified reasons only. The single serialization redaction chokepoint covers machine and human output.

#### Failure identities and exit projection

The feature adds one domain kind, `closeout`, and four rows to the existing error table. It reuses the existing projection classes and introduces no exit literals outside the CLI projection.

| Code | Category | Retryable | Consequence | Projection | Meaning |
|---|---|---|---|---|---|
| `closeout.target.unobserved` | user | false | not_landed | user-validation | The target work item was not observed (provider not-found). |
| `closeout.target.ambiguous` | user | false | not_landed | user-validation | More than one closeout target matched. |
| `closeout.write.failed` | transient | true | unknown | platform-provider | A closeout provider write did not land. |
| `closeout.branch.unsafe` | user | false | not_landed | user-validation | Branch cleanup or checkout restore was refused for safety. |

Declared gaps are data outcomes, never error rows. State, config, input, and credential-resolution failures reuse their delivered identities. The adapter-local `provider.payload.invalid` is a distinct recognized identity for a malformed payload or an authentication/transport/server failure on a non-404 read; it is not an error-table row and is never used for an explicit provider not-found. In plan mode a checkout or branch safety refusal is rendered as `would-refuse` plan data, and a branch ambiguity renders the `would-refuse` branch step for inspection; apply returns `closeout.branch.unsafe` or projects `closeout.target.ambiguous` before any mutation. A target not-found or an invalid target payload fails the command in both modes. Exit codes remain only in the CLI projection: `user-validation` → 1, `platform-provider` → 2, success → 0. The documented table and the machine table are bidirectionally synchronized.

#### Read-only command isolation

The git branch/checkout seam is a dedicated adapter I/O subpath behind a port. It is not the existing read-only repository metadata reader, and the read-only reader gains no spawn surface. `status`, `queue ready`, and `verify change` continue to consume only the read-only repository reader, read-only provider clients, and verified state reads. They do not import or compose the git cleanup seam, the closeout engine, or provider write operations. Boundary rules and negative fixtures prove the isolation, and their zero-write/zero-spawn tests remain green.

### 3.2 User Flows

**Plan (default).** Resolve config, provider instance, read credentials, work item, merged request, base ref, and local branch; read persisted closeout history through a verified read; compute the seven-step plan and canonical arguments; evaluate the checkout and branch safety predicates; render the plan; exit 0 with zero writes, git mutations, state appends, or fence acquisitions.

**Apply.** Acquire the single-writer fence; read history and fold terminal outcomes; execute the ordered operations, reusing terminal outcomes and appending each outcome; provider steps run in order, then checkout restore, then squash-safe branch cleanup; release the fence; render the applied summary and exit 0.

**Re-run after restart.** Recover or acquire the fence; read history; reuse every terminal outcome; re-observe provider state only where no terminal outcome exists or a prior outcome failed; perform zero duplicate mutations; render converging terminal outcomes.

**Declared capability gap.** On a GitLab-hosted change, provider steps become `skipped-gap` with reasons; checkout restore and local branch cleanup still run from read evidence; the transaction succeeds with a gap summary and exit 0.

**Safety refusal.** Provider steps execute and persist; checkout restore refuses on a dirty worktree; branch cleanup is skipped and the branch retained; apply returns `closeout.branch.unsafe` with exit 1. After the operator cleans the worktree, a re-run reuses completed outcomes and finishes.

**Ambiguous branch.** Plan mode renders the branch step as `would-refuse` with `closeout.target.ambiguous` so the operator can inspect the ambiguity; apply projects `closeout.target.ambiguous` before any mutation and deletes nothing.

**Provider write failure.** Completed provider writes persist; the failed operation is recorded; remaining provider steps stop; a safe local checkout restore still runs; branch deletion is skipped because a transaction operation failed; apply returns `closeout.write.failed` with exit 2. A re-run re-observes and retries safely.

**Target not observed.** An explicit provider not-found returns `closeout.target.unobserved` with exit 1 and zero writes; a malformed payload or a non-404 authentication/transport/server failure surfaces as `provider.payload.invalid`; a provider without the work-item read yields a declared gap for ticket-dependent steps.

### 3.3 Edge Cases & Error Handling

- A second writer fails on fence acquisition with the classified `state.*` identity; no mutation is attempted.
- A torn or malformed ledger is a classified `state.*` failure, never a zeroed history.
- A state append failure stops execution and returns the classified state failure; the fence is still released.
- An unsupported operation can never be reported as applied or satisfied.
- An ambiguous local branch selection is a `would-refuse` plan step; apply returns `closeout.target.ambiguous` and deletes nothing.
- A protected ref is never deleted; the step records the protected state instead, and the git seam rejects a protected ref directly as defense in depth.
- A dirty worktree, missing base ref, foreign worktree, moved branch head (including one that moves after planning and is re-checked immediately before deletion), unknown merged head, or earlier non-gap failure refuses deletion and preserves the branch.
- Output over the machine or human bounds is truncated deterministically with a marker; payload shape never changes.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

The closeout feature follows the delivered tier split. The runtime-neutral contracts tier declares the plan, step, operation, outcome, work-item and reverse-dependent observations, ledger, and runtime types plus `as const` data. The pure domain tier computes plan step expansion, canonical operation arguments, SHA-256 identity, outcome folding, summary, output bounding, and the apply orchestration over injected runtimes. The state tier implements the `closeout.operation` ledger over the existing fenced state port. Provider adapters implement closeout-relevant reads and writes behind their existing subpaths. A dedicated `adapters ./git` subpath owns local checkout/branch I/O. The CLI command layer validates grammar, delegates to the closeout engine, and returns data or a classified failure; the edge owns composition, rendering, and exit projection. `createCloseoutComposition` performs the production read orchestration (`planFacts`) once from the injected provider client, git seam, and state store, bridges those raw ports to the closeout runtimes, and lets `createConfigProgram` register the command from the raw composition. The real ledger is consumed through `createCloseoutStateRuntime` over `readCloseoutHistory` and `appendCloseoutOutcome`. No runtime API, network, clock, or randomness enters the contracts or pure domain tier.

### 4.2 Core Components & Directory Structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/closeout.ts` | `delivery.closeout.v1` vocabulary: step ids, outcomes, gap reasons, operation names, disposition and protected-ref data, bounds, plan/step/operation/data types, work-item and reverse-dependent observations (`CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS`), canonical argument unions, identity inputs, ledger payload type, provider/git/state runtime contracts. Types and `as const` data only. |
| `packages/core/src/contracts/ports.ts` | The primitive ports; `DeliveryRequest` carries the additive optional `headSha`. |
| `packages/core/src/contracts/adapter-capabilities.ts` | The closed `ADAPTER_OPERATIONS` set including `resolve-delivery-thread`, and capability/gap types. |
| `packages/core/src/contracts/error-table.ts` | The `closeout` domain kind and the four documented rows. |
| `packages/core/src/domain/closeout.ts` | Pure planner, canonical JSON and SHA-256 operation identity, branch selection and safety predicate, outcome fold, summary, output bounding, apply orchestrator, and human renderer. |
| `packages/core/src/domain/sha256.ts` | Pure SHA-256 implementation used by the operation identity; no runtime import in the domain path. |
| `packages/core/src/state/closeout.ts` | `closeout.operation` append with post-append coverage verification, verified history read, store-scoped key, record validation, and first-terminal fold over the injected state port. |
| `packages/adapters/src/github/{client,normalize}.ts` | Issue/PR reads, merged-request lookup, head normalization, bounded reverse-dependent read with a `no-surface` observation, label/relation availability signals, label/assignee writes, issue close, GraphQL thread resolution, and discriminated work-item observation. |
| `packages/adapters/src/jira/{client,normalize,workflow-map}.ts` | Issue reads, bounded reverse-dependent search with a `no-surface` observation, label/relation availability signals, done transition, full-array label replace with preservation, assignee clear, and discriminated work-item observation. |
| `packages/adapters/src/gitlab/{client,normalize}.ts` | Merge-request and pipeline reads; merged-head normalization when present; no writes. |
| `packages/adapters/src/git/index.ts` | The dedicated branch/checkout seam: fixed-argv, no-shell, local-only child processes with a 30 s default timeout and `SIGKILL`; checkout facts, branch listing, ref resolution, cleanliness and worktree checks, checkout restore, local branch deletion with a delete-time head re-check, and direct protected-ref rejection. |
| `packages/adapters/src/io/provider-transport.ts` | The shared injectable transport seam: `GET`, `POST`, `PATCH`, `PUT`, and `DELETE`, an optional serialized body, an optional per-request timeout, and the classified payload failure. |
| `packages/cli/src/commands/closeout.ts` | Command definition: canonical ref validation, `--apply` flag, one-ref positional rule, plan/apply delegation, and human rendering hook. |
| `packages/cli/src/edge.ts` | `CloseoutComposition`, `CloseoutCompositionOptions`, `createCloseoutComposition`, `createCloseoutStateRuntime`, and `createCloseoutCommandRuntime`; `createCloseoutComposition` bridges raw GitHub/Jira/GitLab clients, the real git seam, and the `StateStorePort`, implements the `planFacts` read orchestration, and supplies the injected clock, fence token, and real ledger runtime. |
| `packages/cli/src/classify.ts` | Classification chain plus the adapter-local `provider.payload.invalid` projection used by closeout reads. |
| `scripts/checks/error-table-sync.ts` | Enforces the documented/machine table sync and recognizes `provider.payload.invalid` as an adapter-local identity with no table row. |
| `.dependency-cruiser.cjs` | Admits `packages/adapters/src/git/` as the exact runtime-API confinement entry for the git seam. |

### 4.3 Key Classes & Functions

```ts
buildCloseoutPlan(facts: CloseoutPlanFacts): CloseoutPlan
deriveCloseoutOperationId(inputs: CloseoutOperationIdentityInputs): string
selectMatchingBranch(input): CloseoutBranchSelection
evaluateBranchSafety(input): CloseoutBranchSafetyVerdict
foldCloseoutOutcomes(records): Record<string, CloseoutOperationRecord>
runCloseout(input: CloseoutRunInput): Promise<CloseoutRunResult>
renderCloseoutHuman(data: CloseoutData): string
readCloseoutHistory(store, workItemRef): StateResult<readonly CloseoutOperationRecord[]>
appendCloseoutOutcome(store, handle, record): StateResult<StateAppendOutcome>
createGitBranchSeam(options?): GitBranchSeam
createCloseoutCommandDefinition(runtime): CommandDefinition
createCloseoutComposition(options: CloseoutCompositionOptions): CloseoutComposition
createCloseoutStateRuntime(store: StateStorePort): CloseoutStateRuntime
createCloseoutCommandRuntime(composition): CloseoutCommandRuntime
```

### 4.4 Data Architecture

The plan and output are bounded contract data. The durable record is one append-only `closeout.operation` record per attempted terminal operation under the store-scoped key `closeout.operations:<workItemRef>`; the payload schema is `delivery.closeout.operation.v1`. The payload carries the full verified record history for the key, so a verified read returns the history from the ledger record itself. The first terminal outcome per operation identity is authoritative; a failed record is retained but not terminal. No schema-version bump, migration, or derived document is introduced.

| Constant | Value | Rule |
|---|---|---|
| `CLOSEOUT_SCHEMA_ID` | `delivery.closeout.v1` | Machine payload schema identifier. |
| `CLOSEOUT_OPERATION_PAYLOAD_SCHEMA` | `delivery.closeout.operation.v1` | Ledger payload schema. |
| `CLOSEOUT_OPERATION_RECORD_KIND` | `closeout.operation` | Additive state record kind. |
| `CLOSEOUT_STEP_IDS` | seven ordered ids | Binding plan order. |
| `CLOSEOUT_MAX_DEPENDENTS` | `200` | Owed-flip cap. |
| `CLOSEOUT_MAX_THREADS` | `100` | Thread-resolution cap per merged request. |
| `CLOSEOUT_OPERATION_TIMEOUT_MS` | `30_000` | Per-operation provider and git timeout. |
| `CLOSEOUT_MAX_MACHINE_BYTES` | `65_536` | Machine payload bound. |
| `CLOSEOUT_MAX_HUMAN_LINES` | `200` | Human output line bound. |
| `CLOSEOUT_MAX_HUMAN_BYTES` | `16_384` | Human output byte bound. |
| `CLOSEOUT_INTEGRATION_BASE` | `main-tools` | Pinned v1 fallback base; compiled data, not configuration. |
| `PROTECTED_REF_NAMES` | `main`, `main-tools`, `HEAD` | Base protected refs; the resolved base is added at plan time. |

### 4.5 API & Interface Contracts

- **`closeout <workItemRef> [--apply] [--json]`** — CLI surface described in §3.1.
- **`CloseoutPlan` / `CloseoutStep` / `CloseoutOperation`** — runtime-neutral plan data; each step carries an ordered outcome, reason, operations, evidence, and optional truncation; each operation carries an identity, name, engine, capability context, target, and canonical arguments.
- **`CloseoutData`** — `delivery.closeout.v1` machine payload with plan/applied mode, base ref, optional delivery summary, ordered steps, summary counts, and ledger key.
- **`CloseoutOperationRecord`** — append-only ledger payload described in §3.1 and §4.4.
- **`CloseoutProviderRuntime`** — closeout-relevant provider reads and writes: `CloseoutReadObservation` work-item read, optional merged-request lookup, optional bounded reverse-dependent read returning `CloseoutReverseDependentObservation`, label/assignee write, done transition, and thread resolution.
- **`CloseoutGitRuntime`** — checkout facts, branch list/read, foreign-worktree and cleanliness checks, ref resolution, checkout restore, and branch deletion whose optional `expectedHead` is re-checked immediately before deletion.
- **`CloseoutStateRuntime`** — fence acquisition/release, append, and verified history read over the real `StateStorePort` ledger.
- **`createCloseoutComposition(options)`** — builds the production composition from a raw provider source (`github`, `jira`, `gitlab`, or `declared`), an existing or constructible `GitBranchSeam`, and a `StateStorePort`; its `planFacts` performs the read orchestration once, then the engine plans and applies over the bridge runtimes.
- **`createCloseoutStateRuntime(store)`** — bridges the fenced store to `appendCloseoutOutcome` and `readCloseoutHistory`.
- **`createCloseoutCommandRuntime(composition)`** — composes the pure plan and apply orchestrator over injected plan facts and runtimes.

## 5. Non-Functional Requirements

### 5.1 Security & Privacy

- **Mutation is opt-in.** Dry-run is the default; `--apply` is the only mutation switch. Plan mode performs zero provider writes, git mutations, state appends, and fence acquisitions.
- **Bounded write scope.** Writes target only the observed work item, its direct dependents, declared labels, the assignee clear, the merged request's named threads, and the matching local branch. There is no wildcard label rewrite, arbitrary comment write, or remote deletion.
- **Credential discipline.** Every provider call resolves through the credential port. The secret-read boundary allowlist remains four entries; closeout adds none.
- **Branch safety.** Deletion requires the full squash-safety predicate, merged-head equality re-checked at delete time, protected-ref checks with direct seam rejection, dirty-worktree and foreign-worktree checks, and a successful checkout restore when required. Unsafe states produce zero destructive action.
- **Idempotency.** Deterministic identities and terminal-outcome reuse prevent duplicate writes; failed writes are safe to retry because every operation is idempotent by construction.
- **Capability honesty.** Unsupported operations are declared gaps with valid reasons and can never be reported as success.
- **Runtime confinement.** The git seam is one exact, reason-bearing adapter I/O entry; the read-only repository reader remains no-spawn.
- **No session-content exposure.** Closeout reads no session database or harness store.
- **Output redaction.** The single serialization chokepoint covers machine and human output; evidence is bounded and contains no comment bodies, titles, raw payloads, secrets, environment values, or command arguments.

### 5.2 Performance & Scalability

- At most 200 direct dependents, 100 unresolved threads per merged request, and the declared label set per run.
- Every provider and git operation is bounded by a 30 s timeout; no operation waits unbounded.
- The reference-fixture apply budget is p95 ≤ 120 s. The reference measurement is an optional non-CI artifact, not a merge gate.
- The plan is linear over bounded input; no retry loop, pagination crawl, daemon, or new runtime dependency exists.

### 5.3 Localization & Accessibility

No localization or accessibility surface is added. The human digest is deterministic plain text within the declared line and byte bounds; the machine envelope remains the canonical machine surface.

## 6. Quality Assurance Strategy

### 6.1 Testing Approach

| Level | Location | Scope |
|---|---|---|
| Structure | `tests/structure/closeout-contract.test.ts`, `closeout-imports.test.ts`, `conformance-coverage.test.ts`, `error-table.test.ts` | Contract vocabulary, step/operation order, additive extensions, conformance operation set, error rows, and read-only import isolation. |
| Behaviour | `tests/behaviour/closeout-{plan,idempotency,request,branch,checkout,ticket-labels,unassign,owed-flip,threads,capabilities,output,read-observation,hermetic,integration,bounds}.test.ts` | Determinism, restart and retry, merged-request selection, branch safety, checkout restore, label sweep, unassign, owed-flip, thread resolution, capability gaps, UTF-8 bounds, output, read observations, the real JSONL ledger, and in-process CLI integration through the production composition over the real git seam. |
| Provider behaviour | `tests/behaviour/providers/{github,jira,gitlab}-closeout.test.ts` and shared support | Provider write normalization, label/relation availability signals, auth/5xx → `invalid` mapping, merged head presence/absence, GraphQL thread resolution, Jira label replace and transition, and reverse-dependent `no-surface` versus `unavailable` reads. |
| Golden | `tests/golden/closeout-{envelope,human}.test.ts` | Recorded machine envelopes and human digests for plan/apply outcomes. |
| Checks | `tests/checks/closeout-mutants.test.ts`, `error-table-sync.test.ts`, `fixture-sanitization.test.ts` | Source-mutation non-vacuity controls, bidirectional table sync, and fixture hygiene. |
| Types | `tests/types/closeout-headsha.type-test.ts` | Optional `headSha` shape and absence semantics through the root `typecheck`. |
| Conformance | `tests/conformance/mock-conformance.test.ts`, `tests/conformance/broken-adapter-control.test.ts` | Production write execution in the mock tier, capability-gated skips, and runtime coverage over the eight operations. |
| Aggregate | The whole workspace | `pnpm check`. |

### 6.2 Test Data & Scenarios

Closeout fixtures live under `tests/fixtures/closeout/` and the provider fixture area: plan, label, dependent, thread, request, branch, capability, read-observation, canary, golden, and mutant data. Local git scenarios use temporary repositories created by the test harness. Provider fixtures are sanitized synthetic captures under `tests/fixtures/providers/{github,jira,gitlab}/closeout-*.json`.

The battery is offline and hermetic: no live provider credentials, network calls, host state, or real personal content. The mutant corpus copies fixtures into a temp directory and proves a named behavior fails when the corresponding rule is broken (for example, unknown-as-done, unavailable-as-empty, missing-head equality, gap-as-success, terminal-reuse bypass, non-SHA identity, or success-on-partial). A planted canary proves output and ledger evidence never leak it.

## 7. Operational & Support

### 7.1 Configuration

Closeout adds no configuration key. The v1 integration base is the compiled constant `main-tools`; the merged request's target ref takes precedence and is the normal path for installed projects. Adding a configuration key is a recorded revisit trigger. The lifecycle label disposition, protected-ref set, caps, outcomes, and operation vocabulary are compiled contract data. Provider addressing and credentials come from the existing configured instance and credential port.

### 7.2 Observability

The append-only `closeout.operation` ledger is the durable audit trail; a verified read reconstructs the transaction history. The command reports counts by outcome, the ordered gap list with reasons, truncation markers, the resolved base, and the selected delivery request. Evidence names only refs, provider entity identities, label names, operation names, counts, booleans, and classified failure codes/classes. Human mode renders a deterministic digest; failure diagnostics go to the error stream with the classified identity. No telemetry is sent to a network sink.

### 7.3 Cost & Infrastructure

Closeout adds no runtime dependency, service, daemon, or scheduled job. It reuses the existing provider transports, credential port, state store, and CLI surface. The ledger grows append-only per merge under the existing retention policy; there is no compaction or deletion surface in v1.

## 8. Dependencies & Risks

- **Depends on** the adapter port substrate ([Adapter Ports](feature-adapter-ports.md)) for primitive ports, the closed operation set, capability/gap declarations, and the credential port.
- **Depends on** the provider client seeds ([Provider Client Seeds](feature-provider-client-seeds.md)) for GitHub, Jira, and GitLab reads and the GitHub/Jira write slices.
- **Depends on** the state layer ([State Layer](feature-state-layer.md)) for the append-only ledger, verified reads, and fences.
- **Depends on** the result contract ([Result Contract](feature-result-contract.md)) for the envelope, classification chain, error table, and redaction.
- **Depends on** the adapter conformance suite ([Adapter Conformance](feature-adapter-conformance.md)) for the eight-operation registry and write execution.
- **Consumed by** coordinators and delivery agents performing post-merge closeout; the later capsule-completion and closeout-promotion story consumes the delivered transaction.
- **Risk — provider write semantics diverge:** mitigated by offline write fixtures, trap catalogs, declared gaps, and capability-gated conformance.
- **Risk — unsafe branch deletion:** mitigated by the full safety predicate, merged-head equality, protected-ref and worktree checks, dry-run default, and zero action on refusal.
- **Risk — ledger/provider divergence:** mitigated by idempotent writes, terminal-outcome reuse, failed-outcome retry, and the single-writer fence.
- **Risk — capability gaps misreported as success:** mitigated by the closed outcome vocabulary, parity tests, and explicit gap outcomes.

## 9. Glossary & References

| Term | Definition |
|---|---|
| Closeout transaction | The idempotent post-merge operation that completes a delivery's tracker, review, checkout, and local-branch state. |
| Plan mode | The default closeout mode: read state, compute the transaction, and render it with zero mutation. |
| Apply mode | Closeout with `--apply`: execute the plan and persist operation outcomes. |
| Operation identity | The deterministic SHA-256 `operationId` over the declared identity inputs, including the adapter capability context. |
| Terminal outcome | An outcome (`applied`, `satisfied`, `skipped-gap`, `skipped-noop`) reused on re-run without re-executing the operation. |
| Declared gap | An explicit adapter record that an operation is unsupported, with one of `provider-unsupported`, `adapter-not-implemented`, or `plan-restriction`. A gap is not a failure. |
| Owed-flip | Moving an open direct dependent whose blockers are all satisfied to `hand-back` and removing a present `blocked` label. |
| Lifecycle label sweep | The bounded removal of stale lifecycle-state labels and the addition of `delivered`, while preserving type and non-lifecycle labels. |
| Squash-safe | A deletion predicate that proves the branch's work landed through the merged delivery request's head identity, not through git ancestry. |
| Merged head | The provider-resolved head commit identity of the merged delivery request; absent means unknown. |
| Read observation | The explicit discriminator `observed`, `not-found`, `unavailable`, or `invalid` on a closeout-relevant work-item read; `invalid` covers a malformed payload and a non-404 authentication/transport/server failure. |
| Reverse-dependent observation | The distinct discriminator for the bounded reverse-dependent read: `observed`, `no-surface`, `not-found`, `unavailable`, or `invalid`. `no-surface` is a provider-level gap; `unavailable` is a signal-level skip. |
| Protected ref | A ref branch cleanup must never delete: `main`, `main-tools`, the resolved base, `HEAD`, and declared protected refs. |

See also: [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Adapter Conformance Suite](feature-adapter-conformance.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), the [repository glossary](../../overview/glossary.md), [TDR-0008](../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change record:** `doc/changes/2026-11/2026-11-01--GH-183--closeout-v1-branch-cleanup/`.
