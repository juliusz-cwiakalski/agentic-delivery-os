---
change:
  ref: GH-183
  type: feat
  status: Proposed
  slug: closeout-v1-branch-cleanup
  title: "M0-S14: closeout v1 with branch cleanup"
  owners: ["engineering"]
  service: delivery-os
  labels: ["cli", "providers", "git", "idempotency", "state"]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - "core contracts tier"
      - "core domain/application tier"
      - "core state tier"
      - "adapters GitHub subpath"
      - "adapters Jira subpath"
      - "adapters GitLab subpath (reads only)"
      - "dedicated git branch/checkout I/O subpath"
      - "CLI command layer"
    external:
      - "GitHub REST API"
      - "GitHub GraphQL API (review-thread resolution)"
      - "Jira REST API"
      - "GitLab REST API (reads only)"
      - "local git executable"
links:
  decisions: ["TDR-0008", "ODR-0003", "ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the post-merge closeout ceremony into one deterministic, dry-run-by-default, idempotent transaction that converges on re-run — closing the ticket, sweeping lifecycle labels, unassigning, flipping owed dependents, resolving review threads, restoring the checkout, and deleting the squash-merged local branch only when it is provably safe.

## 1. SUMMARY

This change delivers `ados closeout <workItemRef>` as the Deliver-family closeout transaction. A single invocation computes one deterministic plan across seven ordered steps — ticket-to-done, lifecycle label sweep, unassign, owed-flip sweep, comment resolution, checkout restore, and squash-safe local branch cleanup — and applies it only with `--apply`. Every operation carries a deterministic identity; terminal outcomes are persisted in the append-only state ledger, so a re-run after a restart reuses completed outcomes and converges instead of repeating effects. Provider writes are delivered for GitHub and Jira, with the owed-flip step conditional on provider-asserted reverse-dependent and relation evidence; GitLab writes, remote branch deletion, and harness session telemetry remain explicit non-goals or declared capability gaps.

## 2. CONTEXT

### 2.1 Current State Snapshot

The M0 substrate is delivered and is the base this change extends:

- **Command surface and result contract.** Commands return one `CommandResult` envelope; failures come from one machine-readable error table with declared domain kinds and a `{0, 1, 2}` exit projection owned by the CLI. The command registry already lists `closeout` in the Deliver family; the registry row fixes the command name, and ODR-0003 is the proposed naming lock pending owner acceptance at the GH-183 PR review.
- **State layer.** An append-only, schema-versioned JSONL ledger is the durable truth, with verified reads, key-set assertions, single-writer fences, atomic derived-document replacement, and classified torn-state detection. Provider parks and phase transitions already persist as additive record kinds inside `delivery.state.v1`; parse failures are errors, never zeros.
- **Adapter substrate.** Nine typed primitive ports live in the runtime-neutral contracts tier. `WorkItem` carries labels, optional assignee, typed relations, optional comments, and optional `updatedAt`, with one absence rule: absent means unknown. `DeliveryRequest` carries identity, source and target refs, review state, and review threads. Every adapter declares supported operations from a closed set and explicit gap records; parity is never implied. Closeout-relevant reads additionally carry an explicit read observation so a required relation array that was not provider-asserted is not read as an observed empty set (DM-11).
- **Provider client seeds.** GitHub ships a minimal read slice (work items, delivery requests, pipelines) and declares every write as a gap. Jira ships a read slice with labels-replace, custom-field, transitions-as-data, and comment-omission trap knowledge; its write operations are declared gaps deferred to this story. GitLab ships delivery-request and pipeline reads, declares the work-item read and every write as gaps, and implies no parity.
- **Git repository read surface.** The repository adapter resolves the git root, origin binding, and checkout HEAD from `.git` metadata without spawning a process. It is the read-only source status and queue consume; it has no branch-mutation surface.
- **Adjacent commands.** `status`, `queue ready`, and `verify change` are read-only and carry explicit zero-write/zero-spawn guarantees. `db` is the delivered mutating-command precedent: dry-run by default, mutation only with `--apply`, and classified error rows.

### 2.2 Pain Points / Gaps

- **Manual ceremony per merge.** The post-merge closeout is performed by hand or by an LLM ceremony. Routine steps are missed: a ticket stays open, lifecycle labels linger, the assignee remains, a dependent never learns the blocker cleared, review threads stay unresolved, the checkout stays on a deleted branch, or an old branch accumulates.
- **No idempotent transaction.** Retrying a partially completed closeout re-executes steps with no memory of what already landed. A crash or restart leaves ambiguous state, and the operator cannot tell "already done" from "not attempted."
- **No provider write path for closeout.** GitHub writes are declared gaps; Jira writes are deferred to this story. There is no honest capability declaration for closeout writes, so consumers cannot distinguish "unsupported" from "failed."
- **No squash-safe branch cleanup.** After a squash merge the feature branch is not an ancestor of the base, so a naive "merged" check cannot prove deletion is safe. There is no bounded, evidence-backed predicate that distinguishes a landed squash merge from a branch with new, unmerged work.
- **Absence semantics are easy to violate.** An absent assignee, absent labels, or absent activity signal can be silently treated as "empty" and drive a write or a success claim. Closeout must schedule explicit writes and report unknown evidence instead of inferring state.
- **Read-only guarantees are fragile.** Adding branch mutation near the existing `.git` metadata reader could accidentally turn the reader into a process spawner that status, queue, and verify depend on.

## 3. PROBLEM STATEMENT

Because closeout is a manual, non-idempotent ceremony spread across tracker, VCS, review-thread, and local-git surfaces, the coordinator cannot make a post-merge closeout once and trust that a retry converges; routine steps are missed, partial runs are ambiguous, and branch cleanup is either skipped or performed without a proof that the branch's work already landed — resulting in stale tickets, lingering lifecycle labels, unresolved review threads, stranded checkouts, and avoidable manual rework on every merge.

## 4. GOALS

- **G-1**: Deliver one `closeout <workItemRef>` command whose transaction plan is deterministic, ordered, visible in dry-run, and identical between plan and apply.
- **G-2**: Make every closeout operation idempotent through a deterministic operation identity and an append-only outcome ledger, so a re-run after a restart converges without duplicate effects.
- **G-3**: Close the ticket, sweep lifecycle labels, unassign, flip owed dependents, and resolve review threads through honest provider write capabilities for GitHub and Jira, with every unsupported operation declared as a gap.
- **G-4**: Restore the checkout and delete only a local branch whose work is provably landed by a squash merge, with protected-branch, dirty-worktree, and foreign-worktree safety.
- **G-5**: Preserve the read-only guarantees of `status`, `queue ready`, and `verify change`, and keep the whole gate battery offline and fixture-driven.
- **G-6**: Integrate new failure identities and outcomes into the existing result contract, error table, state ledger, and CLI projection without inventing a parallel surface.
- **G-7**: Leave harness session telemetry, remote branch deletion, GitLab writes, full GitHub adapter work, and merge execution to their assigned stories.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Routine manual closeout misses per merge in dogfood | 0 after adoption |
| Re-run after a simulated restart that performs zero duplicate mutations | 100% of applied closeouts |
| Apply completes in one run on the declared fixture and dogfood happy path | ≥ 99% |
| Planned operation identity stability for identical inputs | 100% byte-identical |
| Declared-gap parity for unsupported closeout operations | 100% carry a valid gap reason |
| Offline gate battery without live provider credentials or network | 100% of closeout tests |
| Read-only command regressions (`status`, `queue ready`, `verify change`) | 0 |
| Closeout apply duration on the reference fixture | p95 ≤ 120 s; every operation bounded by a 30 s timeout |
| Post-closeout ticket, label, assignee, and thread state correctness on happy-path fixtures | 100% |
| Branch deletion on a squash-merged branch with matching merged head | 100% of eligible fixtures; 0 deletions on unsafe fixtures |

### 4.2 Non-Goals

- **NG-1**: Harness session telemetry capture at closeout (M1-S11).
- **NG-2**: Remote branch deletion, remote ref cleanup, force push, or history rewrite.
- **NG-3**: GitLab write operations; GitLab writes remain declared gaps.
- **NG-4**: The full GitHub adapter, full issue lifecycle, releases, and operations beyond closeout (M3-S3).
- **NG-5**: Merge execution or merge verification (`ados merge`, `verify deploy`, M1-S4).
- **NG-6**: Posting a closure comment or arbitrary tracker/PR comment writes.
- **NG-7**: Cross-repository closeout, global state, or multi-repo fan-out.
- **NG-8**: MCP and OpenCode/Harness surfaces for closeout (M1-S7; Harness/OpenCode surface M3-S1; full MCP M3-S2).
- **NG-9**: Memory capsule completion, promotion, or retrospective records (M1-S12).
- **NG-10**: Owner-gate SLA mechanics, board escalation, or brief rendering (M1-S5, M1-S6).
- **NG-11**: Queue, lane, dispatch, or supervision behavior (M2-S1, M2-S2).
- **NG-12**: Changing the behavior or guarantees of existing read-only commands.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `closeout <workItemRef>` command surface with dry-run default and `--apply` | One delivered entry point removes the manual ceremony while keeping mutation opt-in |
| F-2 | Deterministic ordered transaction plan with canonical operation expansion | Plan and apply must agree, and re-runs must see the same order and arguments |
| F-3 | Idempotency ledger with deterministic operation ids and terminal-outcome reuse | A restart must converge without duplicate provider or git effects |
| F-4 | Ticket-to-done step through a declared workflow transition | The primary closeout outcome: the ticket reflects delivered work |
| F-5 | Lifecycle label sweep with a bounded disposition table | Stale lifecycle labels mislead `status` and `queue ready`; the sweep must be explicit |
| F-6 | Explicit unassign step that never infers "already unassigned" from absence | Assignee absence means unknown, not empty; the write must be explicit |
| F-7 | Bounded owed-flip sweep over direct dependents | The merge clears blockers; dependents must learn they owe the next action |
| F-8 | Comment resolution over unresolved threads on the merged delivery request | Unresolved review threads are a routine closeout miss |
| F-9 | Checkout restore to the resolved base ref with safety refusals | A stranded checkout on a deleted branch breaks the next delivery |
| F-10 | Squash-safe local branch cleanup with protected-ref and worktree safety | Branch deletion must be provable, local, and never lose unmerged work |
| F-11 | Honest per-provider capability declarations and declared-gap handling | Unsupported writes must be visible gaps, never implied parity or silent success |
| F-12 | Merged-delivery-request lookup by source ref and merged-head resolution | Comment resolution and squash-safe cleanup need the merged request's target and head |
| F-13 | Bounded machine and human output with per-operation evidence | Coordinators and agents need a deterministic, non-leaking summary |
| F-14 | `closeout` failure identities in the existing result contract and error table | Failures need one classified identity, projection class, and documented row |
| F-15 | Read-only command isolation from the new git and provider write paths | `status`, `queue ready`, and `verify change` must keep their zero-write/zero-spawn guarantees |

### 5.1 Capability Details

#### F-1 — Command surface

`closeout` is a top-level Deliver-family command: `closeout <workItemRef> [--apply] [--json]`. The ref must match the canonical uppercase `<PREFIX>-<digits>` shape; validation is case-sensitive and performs no case folding, and it happens before any source read. Exactly one ref is accepted. Without `--apply` the command is a plan: it reads state, computes the transaction, and renders it without any provider write, git mutation, state append, or fence acquisition. With `--apply` it executes the same plan and persists outcomes.

Grammar failures perform no source read or mutation. A missing ref, a malformed or lowercase ref, an extra positional, or a flag value where none is allowed is `input.value.rejected`; an unknown flag is `fallback.invocation`. The handler returns data or a classified failure; the CLI edge owns rendering and exit projection. No rendered command-help surface is added.

#### F-2 — Deterministic transaction plan

The plan is a pure function of the observed work item and read observations, provider capabilities, merged delivery request, local repository state, declared contract data, and persisted terminal outcomes. It has seven ordered steps, and each step expands into zero or more canonical operations:

1. **ticket-to-done** — one operation.
2. **lifecycle label sweep** — at most one removal operation per declared lifecycle-state label present, plus one `delivered` add operation when absent.
3. **unassign** — one explicit clear operation.
4. **owed-flip sweep** — one operation per eligible direct dependent.
5. **comment resolution** — one operation per unresolved thread on the merged delivery request.
6. **checkout restore** — one operation.
7. **squash-safe local branch cleanup** — one operation.

Operation expansion is deterministic: labels follow the declared disposition order; dependents are ordered by provider entity identity; threads are ordered by thread identity. Each operation carries canonical arguments, a provider target, and an engine identity. The plan does not use wall-clock time, randomness, API return order, or hash-map iteration order. Dry-run and apply compute the same plan for the same observed inputs; the only difference is that apply may reuse persisted terminal outcomes and execute pending operations.

#### F-3 — Idempotency ledger

Every operation has a deterministic `operationId` derived per ADR-0003 from the workspace identity, canonical work item ref, engine, the adapter capability context, operation name, canonical arguments, and provider target. The identity is stable across processes, hosts, and restarts.

On apply, the engine reads the persisted closeout history for the work item through a verified state read. A terminal outcome (`applied`, `satisfied`, `skipped-gap`, `skipped-noop`) is reused without re-executing the operation. A `failed` outcome is retained as evidence but is not terminal: a re-run re-observes provider state, records `satisfied` when the effect already landed, and otherwise retries the operation. All closeout writes are idempotent by construction (set done, remove/add a named label, clear assignee, add/remove a named label on a dependent, resolve a named thread, restore checkout, delete a named local branch), so a retry after an unknown outcome is safe.

The ledger is append-only within the existing state schema; it uses one additive record kind, `closeout.operation`, with payload schema `delivery.closeout.operation.v1`. The first terminal outcome per `operationId` is authoritative. The engine identity includes the adapter capability context — the adapter's declared supported-operation and gap posture for that provider and operation — so a capability-declaration change that makes a previously gapped operation supported produces a new operation identity and the old gap record does not block execution. A failure between a provider effect and the ledger append is recoverable because the next run re-observes provider state and converges as `satisfied`.

#### F-4 — Ticket-to-done

When `read-work-item` is supported, the engine observes the work item through a discriminated read (DM-11). A provider not-found — the provider explicitly reports that the work item does not exist — is `closeout.target.unobserved`: the command fails with exit 1 and performs zero writes. A payload or parse failure is the adapter-local `provider.payload.invalid` and is never mapped to `closeout.target.unobserved`. A provider that does not support the work-item read yields a declared gap for the ticket-dependent steps, not `closeout.target.unobserved`.

When the item is observed and the declared delivery state is already `done` (or the provider's closed terminal state), the step is `satisfied` with zero write. Otherwise it executes one `transition-work-item` operation with canonical argument `{ deliveryState: "done" }`. The adapter resolves the provider-specific transition from its declared workflow map: GitHub closes the issue; Jira executes the data-driven transition. If the provider cannot represent a done transition, or the adapter has no mapping, the step is a declared gap with a valid reason and the transaction continues.

#### F-5 — Lifecycle label sweep

The sweep is bounded contract data, not an open-ended label rewrite. The disposition table is:

| Label | Disposition |
|-------|-------------|
| `change` | **keep** (type label; the current PM mapping retains it in the done state) |
| `planning` | remove |
| `spec-ready` | remove |
| `readiness-passed` | remove |
| `in-progress` | remove |
| `review` | remove |
| `blocked` | remove |
| `delivered` | add when absent |

Every label not named above is preserved. The observed label set must be provider-asserted; when it is absent (unknown), the sweep is `skipped-noop` with `label-signal-unavailable` evidence and performs no blind replacement. A present lifecycle label yields a remove operation; an absent one is `satisfied` with zero write. Adding `delivered` when present is `satisfied`. On Jira, the adapter implements the provider's full-array label-replace trap: it computes the target set from the provider-asserted labels at execution time, removes only the named labels, adds `delivered`, and preserves every other label.

#### F-6 — Unassign

The unassign step issues an explicit clear operation. It never infers "already unassigned" from an absent `assignee` field: absence means the provider did not supply the signal, not that the assignee is empty. In plan mode the step reports an explicit clear intent. In apply mode the adapter performs the provider-specific clear (GitHub assignee set to none; Jira assignee cleared) and reports `applied` when the write lands or the provider confirms the assignee is already absent. A provider without an assignee-clear capability declares a gap and skips with evidence. The operation identity uses `{ assignee: "none" }` as its canonical argument, so re-runs share the same identity.

#### F-7 — Owed-flip sweep

An owed-flip is the transition of an open dependent work item to the declared owner-attention state `hand-back` (the owner owes the next action), with a present `blocked` label removed. The sweep is bounded to direct dependents of the closed work item and runs only on explicitly provider-asserted relation evidence:

- Candidate dependents come from the closed item's `blocks` relation set and/or a bounded reverse query for open items that declare this item in their `blocked-by` relations, but only when the corresponding read observation is `observed`. An unasserted or unavailable relation signal never yields candidates and is never treated as an empty set.
- For each candidate, the engine reads the candidate's full `blocked-by` relation set. The candidate is flipped only when it is still open, its relation signal is provider-asserted, every blocker is observed `done` or `canceled` after this closeout, and the candidate is not already carrying `hand-back`.
- A candidate with any open blocker is skipped with evidence naming the open count. A candidate whose blocker set is unknown or whose relation signal is unavailable is not flipped: unknown is never satisfied and is never collapsed into an empty blocker set.
- A candidate already carrying `hand-back` and not carrying `blocked` is `satisfied` with zero write. A candidate carrying `hand-back` but also `blocked` gets a removal operation.
- Every flip is one `write-work-item` operation with canonical args `{ add: ["hand-back"], remove: ["blocked"] }`; every flip is recorded in the ledger and the output.

The sweep is capped at a declared maximum of 200 direct dependents per run, ordered by provider entity identity. A truncated sweep records `truncated: true` and the omitted count. Flipped candidates are excluded on later runs, so repeated runs re-evaluate the remaining bounded set and make progress as dependents become eligible; a still-blocked candidate is re-evaluated but never flipped until its blockers clear.

If the provider has no reverse-dependent read surface — for example, `read-work-item` is a declared gap or the adapter exposes no bounded reverse query — the step is a provider-level gap (`provider-unsupported`) and the transaction continues. If the surface exists but the current reverse-dependent read is unavailable, the step is `skipped-noop` with `relation-signal-unavailable` evidence and performs no flip. If the reverse-dependent read is observed but an individual candidate's relation signal is unavailable or unknown, that candidate is skipped with `relation-signal-unavailable` evidence while the remaining observed candidates are evaluated; no unavailable candidate is flipped. These are signal-level skips, not provider-level gaps. The reverse query is a query-shaped form of the existing `read-work-item` operation and adds no closed adapter operation or capability flag: it is part of the closeout provider runtime, and a provider whose runtime does not implement the bounded query is the provider-level gap case.

#### F-8 — Comment resolution

The engine resolves unresolved review threads on the merged delivery request for the work item. The merged request is resolved by source ref (F-12). Threads are processed in deterministic identity order, skipping already-resolved threads. Each unresolved thread yields one `resolve-delivery-thread` operation with canonical args `{ deliveryRequest: <identity>, threadId: <id> }`. The GitHub adapter uses the provider's thread-resolution surface (the GraphQL `resolveReviewThread` mutation behind the existing injected transport); a thread observed resolved at execution time is `satisfied`.

When the merged delivery request is not observed, the step is `skipped-noop` with `no-delivery-request` evidence; it is not a failure. When the provider has no delivery-request or thread-resolution surface (Jira), the step is `skipped-gap` with `provider-unsupported`. Resolution is capped at 100 unresolved threads per delivery request; a truncated run records the bound and a re-run continues because resolved threads are excluded. A thread-resolution write failure is a `closeout.write.failed` outcome; completed outcomes are persisted and a retry converges.

#### F-9 — Checkout restore

The restore target is the merged delivery request's target ref; when no merged request is observed, the fallback is the pinned v1 integration base `main-tools`. `main-tools` is compiled contract data in v1, not a configuration key: it is the ADOS repository default, so an installed project whose integration branch differs must rely on the merged request's target ref (the normal path) or accept the recorded portability limit. The pinned constant and its revisit trigger are recorded in DEC-9. The resolved base is recorded in the plan and output.

- If the current checkout is already on the base, the step is `satisfied`.
- If the current checkout is on the delivery branch (or detached at the delivery head), the engine restores the base only when the worktree is clean and the base ref resolves locally. A dirty worktree or missing base ref is a safety refusal.
- If the current checkout is on an unrelated branch, the step is `satisfied` with `already-elsewhere` evidence and performs no switch; closeout never hijacks an unrelated checkout.
- A safety refusal does not attempt a destructive action and does not delete the branch; apply returns `closeout.branch.unsafe`.

#### F-10 — Squash-safe local branch cleanup

Branch cleanup is local only. It never deletes a remote branch, never pushes, never force-updates a ref, and never rewrites history.

The engine identifies local branches matching the work item ref by the repository branch convention `<type>/<workItemRef>/<slug>`. When none exists, the step is `satisfied` with `no-branch` evidence. When more than one matches, the engine selects the branch whose local head equals the merged delivery request's merged head; if no unique match exists, apply returns `closeout.target.ambiguous` and deletes nothing.

Deletion is permitted only when all safety predicates hold:

1. The delivery request is observed merged.
2. Its source ref matches the local branch by the branch convention.
3. The merged head identity is observed and equals the local branch head exactly; when the merged head is unknown, deletion is refused rather than guessed.
4. The branch is not protected. Protected refs are the resolved base, the repository's integration base, `main`, `main-tools`, `HEAD`, and any ref in the declared protected set. The protected set always wins.
5. The branch is not the current checkout after restore and is not checked out in another worktree.
6. If checkout restore was required, it succeeded; a refused restore blocks deletion. When the current checkout is unrelated and no restore was required, the unrelated checkout is left untouched and does not block deletion of a different local branch.
7. No earlier transaction operation failed. Declared gaps and no-op outcomes do not block deletion; a non-gap failure does, so the branch remains available while the operator retries.

A branch that was already deleted is `satisfied` with zero mutation. A branch whose head moved after the merged head is refused: it may contain new, unmerged work. A safety refusal returns `closeout.branch.unsafe` and preserves the branch. Force deletion is used only after the squash-safety predicate proves the work landed; the predicate, not the git ancestry check, is the proof, because a squash merge deliberately rewrites ancestry.

#### F-11 — Capability declarations and gaps

Every closeout operation maps to one declared adapter operation. The v1 declarations are:

| Provider | Supported closeout-relevant operations | Declared gaps (reason) |
|----------|----------------------------------------|------------------------|
| GitHub | `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `resolve-delivery-thread` | `write-comment` (`adapter-not-implemented`), `write-delivery-request` (`adapter-not-implemented`) |
| Jira | `read-work-item`, `write-work-item`, `transition-work-item` | `write-comment` (`adapter-not-implemented`), `read-delivery-request` (`provider-unsupported`), `write-delivery-request` (`provider-unsupported`), `read-pipeline-run` (`provider-unsupported`), `resolve-delivery-thread` (`provider-unsupported`) |
| GitLab | `read-delivery-request`, `read-pipeline-run` | `read-work-item`, `write-work-item`, `transition-work-item`, `write-comment`, `write-delivery-request`, `resolve-delivery-thread` (`adapter-not-implemented`) |

An operation not listed in `supportedOperations` is unsupported. A declared gap is a first-class outcome, not a failure: the transaction records `skipped-gap` with the operation, reason, and bounded evidence and continues. No closeout step may report success for an operation the adapter does not support. A supported read operation never implies a write capability. A provider may support a read while a particular signal within it is unavailable; closeout consumes the read observation (DM-11), not only the normalized arrays, so `relations: []` means "no relations" only when the relation signal is provider-asserted and otherwise means unknown. The bounded reverse-dependent query is a query-shaped form of `read-work-item`; it adds no closed adapter operation. `resolve-delivery-thread` is an additive extension of the closed adapter-operation set; existing adapters that do not implement it declare a gap. The Jira write implementation basis is the delivered seed extended for writes, with the recorded `jira.js` re-evaluation trigger if the minimal client cannot satisfy label-replace, transition, or assignee-clear semantics.

#### F-12 — Merged delivery request lookup and merged head

The engine resolves the merged delivery request for the work item by a bounded source-ref lookup. The lookup is the query-shaped form of the existing `read-delivery-request` operation: it returns merged requests whose source ref follows the repository branch convention for the work item. Deterministic selection selects the merged request with the highest numeric provider entity identity; non-numeric identities compare lexically. Ties are impossible for a single source ref on supported providers. When no merged request is found, delivery-request-dependent steps skip with `no-delivery-request` evidence and the checkout base falls back to the integration base.

`DeliveryRequest` gains an additive optional merged-head identity (`headSha`): the provider-resolved head commit of the merged request, copied verbatim, with the existing absence rule — absent means unknown, never a guessed or derived value. The lookup and head field use the existing provider transport and credential port; no new network runtime location is introduced. When the lookup or head field is unsupported, the dependent steps declare a gap or refuse branch deletion with evidence.

#### F-13 — Output and evidence

Machine mode returns exactly one `CommandResult` envelope whose `data` is a bounded `delivery.closeout.v1` payload: command, canonical work item ref, mode (`plan` | `applied`), resolved base ref, optional delivery-request summary, ordered steps with their operations and outcomes, a summary count by outcome, declared gaps with reasons, truncation markers, and the ledger key. Plan mode uses `would-apply`, `satisfied`, `skipped-gap`, `skipped-noop`, and `would-refuse` outcomes; apply mode uses `applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, and `refused`. Human mode renders a deterministic digest from the same data and performs no extra reads.

Output is bounded: at most 64 KiB of machine payload, at most 200 human lines and 16 KiB of human text, with deterministic truncation. Output never contains comment bodies, titles, raw provider payloads, credentials, environment values, command arguments, or free-form prose. Evidence names operations, provider targets, counts, refs, label names, outcomes, and classified reasons only. The serialization redaction chokepoint covers both machine and human output.

#### F-14 — Failure identities and exit projection

The change adds one domain kind, `closeout`, additively to the existing declared kinds. It does not overload the `provider` kind, which is reserved for the AI-model provider engine, and it introduces no new projection class. The four rows are:

| Code | Domain kind | Category | Retryable | Consequence | Remediation hint | Projection class | Summary |
|------|-------------|----------|-----------|-------------|------------------|------------------|---------|
| `closeout.target.unobserved` | closeout | user | false | not_landed | Verify the work item ref; a provider not-found means the item does not exist. A payload/parse failure is `provider.payload.invalid`, and access or credential failures keep their own identities. | user-validation | The closeout target work item was not observed (provider not-found). |
| `closeout.target.ambiguous` | closeout | user | false | not_landed | Disambiguate the delivery request or local branch for the work item, then retry. | user-validation | More than one closeout target matched. |
| `closeout.write.failed` | closeout | transient | true | unknown | Inspect the failed operation evidence and retry; completed operations are persisted and idempotent. | platform-provider | A closeout provider write did not land. |
| `closeout.branch.unsafe` | closeout | user | false | not_landed | Resolve the named checkout, worktree, protected-ref, or merged-head condition, then retry. | user-validation | Branch cleanup or checkout restore was refused for safety. |

Declared gaps are data outcomes, never error-table rows. State, config, input, and credential failures reuse their delivered identities. An adapter-local `provider.payload.invalid` read failure is also not a `closeout` row: it is the distinct identity for a malformed or unparsable provider payload, and it is never used for an explicit provider not-found. Exit codes remain only in the CLI projection: `user-validation` → 1, `platform-provider` → 2, success → 0. The documented error table and the machine table are updated in the same change and remain bidirectionally synced.

#### F-15 — Read-only command isolation

The new git branch/checkout seam is a dedicated adapter I/O subpath behind a port. It is not the existing read-only repository metadata reader, and the read-only reader does not gain a spawn surface. `status`, `queue ready`, and `verify change` continue to consume only the read-only repository reader, the read-only provider clients, and verified state reads. They do not import or compose the git cleanup seam, the closeout engine, or the provider write operations. Boundary rules and negative fixtures prove the isolation; their existing zero-write/zero-spawn tests remain green.

## 6. USER & SYSTEM FLOWS

**Flow 1 — Dry-run plan (default).**
```
Coordinator → closeout GH-183
  → resolve config, provider instance, credentials (read), work item, merged delivery request, base ref, local branch
  → read persisted closeout operation history (verified read, no fence)
  → compute the seven-step deterministic plan and per-operation canonical arguments
  → evaluate safety predicates for checkout restore and branch cleanup
  → render plan with would-apply / satisfied / skipped-gap / skipped-noop / would-refuse
  → exit 0; zero provider writes, zero git mutations, zero state appends
```

**Flow 2 — Apply happy path.**
```
Coordinator → closeout GH-183 --apply
  → acquire the single-writer state fence
  → read persisted history; reuse terminal outcomes
  → execute ordered operations; append each outcome to the ledger
  → ticket done → label sweep → unassign → owed flips → thread resolutions
  → checkout restore → squash-safe branch cleanup
  → release fence
  → render applied summary; exit 0
```

**Flow 3 — Re-run after restart.**
```
Coordinator → closeout GH-183 --apply (same inputs, new process)
  → recover or acquire fence
  → read persisted history; every terminal outcome is reused
  → re-observe provider state only where no terminal outcome exists or a prior outcome failed
  → zero duplicate mutations; already-satisfied state converges
  → render identical terminal summary; exit 0
```

**Flow 4 — Declared capability gap.**
```
Coordinator → closeout GH-183 --apply on a GitLab-hosted change
  → provider declarations show write operations unsupported
  → ticket/label/unassign/owed-flip/thread steps become skipped-gap with reasons
  → checkout restore and local branch cleanup still run from read evidence
  → transaction succeeds with a gap summary; exit 0
```

**Flow 5 — Safety refusal.**
```
Coordinator → closeout GH-183 --apply on a dirty worktree at the delivery branch
  → provider steps execute and persist outcomes
  → checkout restore refuses: dirty worktree
  → branch cleanup is skipped; branch is retained
  → apply returns closeout.branch.unsafe; exit 1
  → after the operator cleans the worktree, a re-run reuses completed outcomes and finishes
```

**Flow 6 — Provider write failure.**
```
Coordinator → closeout GH-183 --apply
  → ticket done applies; label sweep applies
  → one thread resolution fails
  → remaining provider steps stop; local checkout restore still runs
  → branch deletion is skipped because a transaction operation failed
  → applied outcomes are persisted; the failed operation is recorded
  → apply returns closeout.write.failed; exit 2
  → a re-run re-observes the failed operation, retries it safely, and can then delete the branch
```

**Flow 7 — Target not observed.**
```
Coordinator → closeout GH-183 (plan or apply)
  → target work-item read returns an explicit provider not-found
  → no write is attempted; the command returns closeout.target.unobserved with exit 1
  → a payload/parse failure instead surfaces as provider.payload.invalid
  → a provider without the work-item read yields a declared gap for ticket-dependent steps
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `closeout <workItemRef>` command with plan/apply modes and canonical ref validation.
- The seven-step ordered transaction and its deterministic operation expansion.
- Deterministic operation identities, the `closeout.operation` ledger record kind, terminal-outcome reuse, and failed-outcome retry.
- Ticket-to-done through a declared workflow transition.
- The bounded lifecycle label disposition table and sweep.
- Explicit unassign.
- The bounded owed-flip sweep over direct dependents.
- Review-thread resolution over the merged delivery request.
- Checkout restore with safety refusals.
- Squash-safe local branch cleanup with protected-ref and worktree safety.
- GitHub and Jira write capabilities required by closeout; GitLab delivery-request and pipeline reads only, with the work-item read and write operations declared as gaps.
- The merged-delivery-request lookup and the additive optional merged-head field.
- The discriminated read observation that distinguishes a target not-found, an unavailable relation signal, and a payload/parse failure without changing the closed operation set.
- The dedicated git branch/checkout I/O seam and its exact runtime-confinement entry.
- New `closeout` error identities, documented table rows, and CLI projection reuse.
- Bounded machine and human output, telemetry evidence, and offline fixtures.
- Boundary, behavior, invariant, and state-ledger tests for the above.

### 7.2 Out of Scope

- [OUT] Harness session telemetry capture and harness-specific session statistics (M1-S11).
- [OUT] Remote branch deletion, remote ref cleanup, `git push --delete`, force push, or history rewrite.
- [OUT] GitLab write operations; they remain declared capability gaps.
- [OUT] The full GitHub adapter, full issue lifecycle, releases, and operations beyond closeout (M3-S3).
- [OUT] Merge execution, merge verification, and deploy verification (`ados merge`, M1-S4).
- [OUT] Posting a closure comment or arbitrary tracker/PR comment writes.
- [OUT] Cross-repository closeout, global state, or multi-repo fan-out.
- [OUT] MCP and OpenCode closeout surfaces.
- [OUT] Memory capsule completion, promotion, or retrospective records (M1-S12).
- [OUT] Owner-gate SLA mechanics, board escalation, and brief rendering.
- [OUT] Queue, lane, dispatch, or supervision behavior.
- [OUT] Changes to `status`, `queue ready`, or `verify change` behavior.
- [OUT] New runtime dependencies or new network runtime locations.

### 7.3 Deferred / Maybe-Later

- **Closure comment with a closeout summary**, if the owner resolves OQ-2 in favor of including it.
- **Jira `write-comment`** as a separate capability, if a later story needs tracker comments.
- **GitLab write operations** and full GitLab closeout parity.
- **Remote branch deletion and remote ref hygiene** as a separate, reviewed story.
- **Transitive owed-flip** beyond direct dependents.
- **Richer merged-request selection** using a merge timestamp or merge-commit identity instead of entity identity.
- **A `--reconcile` mode** that re-observes terminal outcomes and repairs external drift.
- **Harness telemetry capture at closeout** (M1-S11).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound REST or HTTP endpoint is added. The command surface is:

```
closeout <workItemRef> [--apply] [--json]
```

| Element | Contract |
|---------|----------|
| `<workItemRef>` | Exactly one canonical uppercase `<PREFIX>-<digits>` ref matching `^[A-Z][A-Z0-9]*-\d+$`; validated before any source read; case-sensitive with no case folding; malformed values, including a lowercase prefix, are `input.value.rejected`. |
| `--apply` | Boolean mutation switch; without it the command is a read-only plan. A value-bearing or repeated form follows the existing parser behavior. |
| `--json` | Existing global machine-output switch; adds no command behavior. |
| Extra positional | `input.value.rejected` by the handler; exit 1; no source read or mutation. |
| Unknown flag | `fallback.invocation` before the handler; exit 1; no source read. |
| Missing ref / malformed ref | `input.value.rejected`; exit 1; no source read. |

The command is in the Deliver family; the command registry row fixes its name, and ODR-0003 is the proposed naming lock pending owner acceptance at the GH-183 PR review. The handler validates grammar, delegates to the closeout engine, and returns data or a classified failure; the CLI edge renders and projects the exit.

### 8.2 Events / Messages

No message bus or public event is added. The durable internal event is the state-ledger record:

| ID | Event / record | Contract |
|----|----------------|----------|
| EVT-1 | `closeout.operation` | Additive state-ledger record kind inside `delivery.state.v1`, payload schema `delivery.closeout.operation.v1`. One record per operation outcome, keyed per work item, append-only. Carries `operationId`, work item ref, engine, adapter capability context, operation, canonical arguments, provider target, outcome, optional gap/failure reason, bounded evidence, and an injected-clock timestamp. The first terminal outcome per `operationId` is authoritative. |
| EVT-2 | Closeout summary (rendered) | Not a ledger event; the per-run summary is a pure projection of verified operation records and the current execution. No separate summary record is required. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `CloseoutPlan` and `CloseoutStep` | Runtime-neutral contract data: the ordered step set, step identities, operation expansion rules, and plan metadata. No I/O. |
| DM-2 | `CloseoutOperation` | Contract data: operation name, engine, provider target, canonical arguments, and deterministic identity inputs. |
| DM-3 | `CloseoutOutcome` | Closed vocabulary: plan `would-apply` / `satisfied` / `skipped-gap` / `skipped-noop` / `would-refuse`; apply `applied` / `satisfied` / `skipped-gap` / `skipped-noop` / `failed` / `refused`. Gap reasons are `provider-unsupported`, `adapter-not-implemented`, or `plan-restriction`. |
| DM-4 | `closeout.operation` ledger record | Additive schema `delivery.closeout.operation.v1`; no state schema-version bump; no migration; verified reads; single-writer fence for apply. |
| DM-5 | `CloseoutProviderOperations` | Contract data for the closeout-relevant provider operations. The canonical `write-work-item` arguments are one flat object: optional `add` (label names to add), optional `remove` (label names to remove), and optional `assignee` (the literal `"none"` for a clear). There is no nested `labels` object. `transition-work-item` arguments are `{ deliveryState }`; `resolve-delivery-thread` arguments are `{ deliveryRequest, threadId }`. The same flat shape is the operation-identity input. |
| DM-6 | Lifecycle label disposition | Bounded contract data mapping each lifecycle label to keep/remove/add; `change` is kept, six lifecycle-state labels are removed, `delivered` is added. |
| DM-7 | Base and protected-ref contract | Resolved-base rule (merged target ref, else the pinned v1 integration base `main-tools`) and the protected-ref set (`main`, `main-tools`, the resolved base, `HEAD`, declared protected refs). The integration base is compiled contract data, not a configuration key in v1. |
| DM-8 | `DeliveryRequest.headSha` | Additive optional merged-head identity on the existing primitive port; absent means unknown. |
| DM-9 | Operation identity | Deterministic digest per ADR-0003 of workspace, work item ref, engine, the adapter capability context, operation, canonical arguments, and provider target; no clock or randomness. |
| DM-10 | `closeout` domain kind and rows | Additive domain kind with the four documented rows in F-14; existing projection classes reused. |
| DM-11 | Read observation discrimination | Closeout-relevant reads return an explicit observation: `observed` (provider asserted the entity or signal; an empty set means none), `not-found` (provider explicitly reports the entity does not exist), `unavailable` (provider has no surface or omitted the signal), or `invalid` (payload/parse failure). `WorkItem.relations` remains the normalized array; it is authoritative only when its relation-signal observation is `observed`. A target work-item read maps `not-found` to `closeout.target.unobserved`, `unavailable` to a provider-level gap for ticket-dependent steps, and `invalid` to `provider.payload.invalid`. An unasserted relation array is never treated as an empty blocker set. The discrimination is an additive adapter-I/O refinement: no new closed operation, no core primitive-port field, and no schema-version bump. |

### 8.4 External Integrations

**Provider ports.** Closeout composes the existing typed primitive ports; provider-native types never cross the port surface. The closeout-relevant write operations are:

- `write-work-item` — one flat canonical argument object (`add` / `remove` / `assignee`) that adds or removes named labels and clears the assignee. The adapter preserves labels not named for removal. Jira uses its full-array replace mechanics; GitHub uses named add/remove.
- `transition-work-item` — transition to the declared done state through the provider workflow map.
- `resolve-delivery-thread` — resolve one review thread on the merged delivery request (additive operation).

**Read observation.** Closeout-relevant reads return the discriminated observation in DM-11. An explicit provider not-found on the work-item read (the provider's not-found response for the entity) is `not-found` and maps to `closeout.target.unobserved`; a transport error, authentication failure, or malformed/unparsable payload is `invalid` and remains the adapter-local `provider.payload.invalid`, never `closeout.target.unobserved`; a provider that does not expose the read is `unavailable` and yields a declared gap for the dependent steps. An unavailable relation signal is never collapsed into an empty set. The reverse-dependent query is a query-shaped form of `read-work-item`. This is an adapter-I/O refinement: it adds no closed adapter operation, no core primitive-port field, and no schema-version bump.

**Git branch/checkout port.** A dedicated adapter I/O subpath exposes bounded, read-only plan queries and mutation operations for checkout restore and local branch deletion. It validates canonical refs, never accepts arbitrary commands, never contacts a network, and never touches remote refs. It is separate from the read-only repository metadata reader.

**Provider coverage v1.** The owed-flip step is conditional on an explicitly provider-asserted reverse-dependent read and on each candidate's provider-asserted `blocked-by` relation set (F-7, DM-11). A provider-level gap applies only when the provider has no reverse-read surface; an unavailable or unknown signal in an otherwise supported provider is a signal-level skip with evidence and never a flip.

| Provider | Reads used | Writes used | Sendable operations for closeout |
|----------|-----------|-------------|----------------------------------|
| GitHub | work item (single-item and bounded reverse-dependent), merged delivery request, review threads | issue close, labels, assignee, thread resolution | all seven steps are in scope (the five provider steps plus the two local checkout/branch steps). The owed-flip step is conditional: it runs only when the reverse-dependent read and each candidate's relation read are provider-asserted; an unavailable or unknown signal skips the step with `relation-signal-unavailable` evidence and never flips. GitHub has a reverse-read surface, so an unavailable signal is a signal-level skip, not a provider-level gap. |
| Jira | work item, relations, workflow map, bounded reverse-dependent query | done transition, labels replace, assignee clear | ticket-to-done, label sweep, unassign, and a conditional owed-flip (provider-asserted reverse/relation reads only), plus the local checkout and branch steps; comment resolution is a `provider-unsupported` gap. |
| GitLab | merged delivery request, pipelines; work-item read is a declared gap | none | local checkout/branch steps only; all provider writes and the work-item read are declared gaps. With no work-item read there is no reverse-read surface, so owed-flip is a provider-level gap (`provider-unsupported`). |

**Credentials.** Every provider call resolves through the credential port; no closeout code reads environment secrets directly. The secret-read boundary allowlist does not grow. Provider transports are injected at the composition edge and remain inside the existing per-provider adapter subpaths.

**Runtime confinement.** The new git seam is added to the runtime-API confinement allowance as one exact, reason-bearing adapter I/O entry. The existing read-only repository reader is unchanged and is not admitted to spawn. No new global network edge is added.

### 8.5 Backward Compatibility

- The command is new; no existing command is renamed or removed.
- Existing read-only commands keep their behavior, output contracts, and zero-write/zero-spawn guarantees.
- Adapter capability declarations change from gap to supported only for the operations delivered here; unsupported operations remain declared gaps. Existing read behavior is unchanged.
- `DeliveryRequest.headSha` is an additive optional field; existing consumers ignore it, and absent means unknown.
- The read observation (DM-11) is an additive refinement of closeout-relevant adapter reads; existing consumers ignore it, and closeout treats a read result without an explicit observation as unavailable, never as observed.
- The `resolve-delivery-thread` operation is an additive member of the closed operation set; adapters that do not implement it declare a gap.
- The `closeout.operation` record kind is additive inside the existing state schema; existing stores remain readable, and no migration is required.
- The `closeout` error domain kind and rows are additive; existing rows and projection classes are unchanged.
- The command surface uses the working CLI name and introduces no brand-derived strings.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Idempotent convergence: a re-run after any completed or partially completed apply performs zero duplicate effects and reaches the same terminal outcomes | 100% of applied fixtures, including simulated restart and crash-between-effect-and-record |
| NFR-2 | Determinism: identical inputs and observed state yield byte-identical plans, canonical arguments, and operation identities | 100% of repeated dry-runs; no wall-clock or randomness in identity or ordering |
| NFR-3 | Offline proof: the complete closeout test battery runs with no live provider credentials and no network; provider behavior is proven against committed sanitized fixtures | 100% of closeout tests; 0 live-network tests |
| NFR-4 | Dry-run safety: plan mode performs zero provider writes, zero git mutations, zero state appends, and zero fence acquisitions; apply is the only mutation path | 100% of plan-mode tests |
| NFR-5 | Read-only isolation: `status`, `queue ready`, and `verify change` perform zero writes and zero process spawns and do not import the git cleanup seam or provider write path | 100% of existing and new boundary/behavior tests |
| NFR-6 | Bounded transaction: at most 200 direct dependents, 100 unresolved threads per delivery request, and the declared label set; every operation has a 30 s timeout; the reference-fixture apply budget is p95 ≤ 120 s; no operation waits unbounded | 100% of bounded-fixture tests |
| NFR-7 | Bounded output: machine payload ≤ 64 KiB; human output ≤ 200 lines and ≤ 16 KiB; deterministic truncation markers; no comment bodies, titles, raw payloads, credentials, or environment values | 100% of output fixtures and canary tests |
| NFR-8 | State integrity: one append per terminal operation through the fenced state port; verified reads; torn or malformed state is a classified error, never zeros; no schema-version bump | 100% of state-ledger tests; existing state invariants green |
| NFR-9 | Capability honesty: every unsupported closeout operation in a plan carries a declared gap with a valid reason; no unsupported operation reports success or is silently omitted; an unavailable signal is a skip with evidence, never a success or an empty set | 100% of the capability matrix, parity fixtures, and read-observation cases |
| NFR-10 | Dependency discipline: zero new runtime dependencies; the license registry is unchanged and the fail-closed license gate is green | 0 new dependencies; gate green |
| NFR-11 | Error-contract sync: every new failure identity has a documented row and a machine-readable entry in the same change; exit literals exist only in the CLI projection | 100% bidirectional sync; exit-literal invariant green |
| NFR-12 | Security and privacy: write scope is limited to the target work item, its direct dependents, named labels, assignee clear, named threads, and the matching local branch; no remote deletion; no secret or comment-body leakage | 100% of security and privacy canary tests |
| NFR-13 | Reproducible branch safety: no branch deletion without the full squash-safety predicate; protected refs are never deleted; an unsafe state yields zero destructive action | 100% of branch-safety fixtures |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Operation records.** Every apply operation appends one `closeout.operation` record with its outcome, bounded evidence, provider target, and reason. The records are the durable audit trail; a verified read reconstructs the transaction history.
- **Summary counts.** The command reports counts by outcome (`applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, `refused`), the ordered gap list with reasons, truncation markers, the resolved base, and the selected delivery request.
- **Evidence.** Evidence names only safe facts: refs, provider entity identities, label names, operation names, counts, booleans, and classified failure codes/classes. It never includes comment bodies, titles, raw provider payloads, secrets, environment values, or command arguments.
- **No harness telemetry.** Closeout does not read harness session stores or capture session statistics; harness telemetry joins closeout in M1-S11.
- **Diagnostics.** Human mode renders a deterministic digest from the same data; failure diagnostics go to the error stream and carry the classified identity. No telemetry is sent to a network sink in this change.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Provider write semantics diverge (Jira label replace and transitions, GitHub thread resolution, assignee clear) | H | M | Extend the trap catalogs with write fixtures; prove each operation offline; declare unsupported operations as gaps; conformance coverage follows the adapter change | M |
| RSK-2 | Destructive branch deletion loses unmerged work | H | L | Require the full squash-safety predicate, merged-head equality, protected-ref checks, dirty and foreign-worktree checks, dry-run default, and no remote deletion; unsafe cases refuse with zero action | L |
| RSK-3 | Ledger and provider state diverge after a crash between effect and record | M | M | All writes are idempotent by construction; re-runs re-observe provider state; terminal outcomes are reused; failed outcomes are retryable; single-writer fence | L |
| RSK-4 | Additive contract changes (`headSha`, `resolve-delivery-thread`) are rejected by adapter-contract governance | M | L | Record them as explicit decisions; follow the additive-within-v1 precedent; degrade safely to a branch-cleanup refusal when the merged head is unknown; author the governing decision record before delivery if required | L |
| RSK-5 | Scope creep into closure comments, comment writes, full GitHub adapters, or GitLab writes | M | M | Non-goals, PM scope decisions, capability gaps, and OQ-2 pin the boundary | L |
| RSK-6 | Live-network tests or credentials creep into the gate battery | M | L | Offline fixture policy, no live tests, no credential reads outside the port, CI review of fixtures | L |
| RSK-7 | Read-only commands accidentally gain the spawn seam or write path | H | L | Dedicated adapter I/O subpath, exact confinement entry, dependency-cruiser negative fixtures, and existing zero-write/zero-spawn tests | L |
| RSK-8 | Owed-flip scan becomes unbounded, flips on unknown evidence, or treats an unasserted relation array as empty | M | M | Direct dependents only, declared cap, deterministic order, provider-asserted read observations, terminal `hand-back` exclusion, unknown never satisfied, signal-level skip or provider-level gap on unavailable signals | L |
| RSK-9 | Output leaks comment bodies, titles, or secrets | H | L | Bounded evidence model, no body reads in output, single redaction chokepoint, planted-secret canaries | L |
| RSK-10 | The Jira write basis is insufficient for label replace, transitions, or assignee clear | M | M | Keep the adapter boundary; use the recorded `jira.js` re-evaluation trigger; prove the chosen basis with write fixtures and trap tests before delivery | M |
| RSK-11 | Ambiguous merged delivery request or local branch selection causes a wrong target | M | L | Deterministic source-ref lookup and highest-entity selection; ambiguity fails `closeout.target.ambiguous` with no destructive action | L |
| RSK-12 | Capability gaps are misreported as success | M | L | Closed outcome vocabulary, parity tests, output distinguishes `skipped-gap` from `applied`/`satisfied`, and no gap can produce a success claim | L |
| RSK-13 | The pinned `main-tools` integration base is wrong for an installed project with a different integration branch | M | M | The merged delivery request's target ref is the normal path and takes precedence; the constant is recorded as an ADOS-repository default with a portability limit; a configuration key is a recorded revisit trigger; branch cleanup refuses rather than guesses when no target ref is observed and the local base is missing | M |

## 12. ASSUMPTIONS

- The work item ref identifies one closeout target and one delivery request per repository branch convention.
- GitHub is the dogfood write host; Jira is the second write provider; GitLab writes remain gaps.
- The providers expose the operations closeout needs: GitHub issue close, labels, assignee clear, merged PR lookup and head identity, a bounded reverse-dependent read, and review-thread resolution; Jira done transitions, label replace, assignee clear, relations, and a bounded reverse-dependent query; GitLab merged-delivery-request and pipeline reads. A provider may support a read while a particular signal within it is unavailable; closeout distinguishes the two (DM-11).
- The merged delivery request's head identity is observable through the provider lookup; when it is not, branch cleanup refuses rather than guesses.
- The v1 integration base is the pinned contract constant `main-tools`; it is not configurable in v1. A merged delivery request's target ref takes precedence, which is the normal path for installed projects; adding a configuration key is a recorded revisit trigger.
- The local branch follows the branch convention and is the only local branch for the work item unless the merged head selects one uniquely.
- The state layer's additive record kinds are sufficient; no schema-version bump or migration is needed.
- Provider credentials resolve through the credential port in apply; plan mode reads only what its evidence needs and performs no writes.
- The operator understands that closeout is dry-run by default and that `--apply` is the mutation switch.
- Declared gaps and no-op conditions are successful outcomes; safety refusals and non-gap write failures are classified failures.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S19 / GH-188 (client seeds with trap catalogs) | Delivered. Supplies the primitive ports, capability declarations, credential port, provider seeds, and fixtures this change extends. |
| Depends on | M0-S5 state layer | Append-only ledger, verified reads, fences, and additive record kinds. |
| Depends on | M0-S3 result contract and error table | Envelope, domain kinds, projection classes, and bidirectional documentation sync. |
| Depends on | M0-S12 primitive ports and credential port | Adapter operations, capability/gap vocabulary, and credential-only access. |
| Depends on | M0-S1/M0-S2/M0-S4 scaffold, branding, config | Package boundaries, working name seam, and configuration resolution. |
| Blocks | M1-S12 change capsule completion and closeout promotion | This story delivers the closeout transaction the later story promotes. |
| Internal | Core contracts, domain/application, state, adapters GitHub/Jira/GitLab, git seam, CLI | Delivered in this change. |
| External | GitHub REST and GraphQL | Existing injected transport; thread resolution uses GraphQL. |
| External | Jira REST | Existing read client extended for writes. |
| External | GitLab REST (reads) | No write operations. |
| External | Local git executable | Reached only through the dedicated branch/checkout seam. |
| Governance | Additive adapter-contract changes | TDR-0008 records the `headSha` field and `resolve-delivery-thread` operation as additive-within-v1 and is `Proposed`; owner acceptance rides the GH-183 PR review. The read observation (DM-11) is an adapter-I/O refinement; it adds no closed operation, core port field, or schema change, so it needs no separate decision record. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Do the additive adapter-contract changes (optional `DeliveryRequest.headSha` and the `resolve-delivery-thread` operation) require a separate decision record before implementation, and who accepts it? | Adapter-contract evolution is decision-record governed; ADR-0004 and ADR-0006 are the additive-v1 precedent. | **Resolved 2026-11-01 — TDR-0008** (`doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md`): both extensions are additive-within-v1; a record is required and TDR-0008 is it; no schema-version bump or migration; GitHub implements thread resolution, Jira/GitLab declare gaps; owner acceptance rides the GH-183 PR review. |
| OQ-2 | Does closeout v1 post a closure comment, and should Jira `write-comment` move from gap to supported? | The PM mapping records "closure comment with summary" in the done state; GH-188 OQ-2 mentions comment writes arriving with M0-S14; the ticket's closeout task list does not include posting a comment. | **Resolved 2026-11-01 (PM-decided)** — v1 posts no closure comment; `write-comment` remains a declared gap on every provider; no decision record is required (confirmed by TDR-0008's scope note). |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Deliver `closeout <workItemRef>` as a top-level Deliver-family command; the command registry row fixes the name, and ODR-0003 is the proposed naming lock pending owner acceptance at the GH-183 PR review. `status`, `queue ready`, and `verify change` keep their zero-write/zero-spawn guarantees. | PM scope decision 1; one meaning per command name; read-only commands are a protected guarantee. | 2026-11-01 |
| DEC-2 | The transaction covers, in order, ticket-to-done, lifecycle label sweep, unassign, owed-flip sweep, comment resolution, checkout restore, and squash-safe local branch cleanup, with an idempotency ledger; harness session telemetry is out of scope (M1-S11). | PM scope decision 2; matches backlog M0-S14 and the journey step-9 ceremony. | 2026-11-01 |
| DEC-3 | Provider write coverage v1 is GitHub and Jira; GitLab writes remain declared gaps; remote branch deletion is out of scope and branch cleanup is local and squash-safe. | PM scope decision 3; GitHub is the dogfood host; GH-188 defers Jira closeout writes here; capability honesty forbids implied GitLab parity. | 2026-11-01 |
| DEC-4 | Closeout is dry-run by default and mutates only with `--apply`; plan and apply compute the same deterministic plan and converge under re-run. | PM scope decision 4; matches the delivered `db` mutating-command precedent and makes adoption safe. | 2026-11-01 |
| DEC-5 | An owed-flip moves an open direct dependent whose `blocked-by` relations become fully satisfied to `hand-back` and removes a present `blocked` label; the sweep is bounded, deterministic, and records every flip. | PM scope decision 5; the backlog leaves owed-flip undefined; unknown blockers never satisfy. | 2026-11-01 |
| DEC-6 | Comment resolution resolves unresolved review threads on the merged delivery request through the provider thread-resolution surface (GitHub GraphQL `resolveReviewThread`); providers without a delivery-request/thread surface declare a gap and skip with evidence. | PM scope decision 6; matches `.ai/agent/pr-instructions.md` and the capability-gap rule. | 2026-11-01 |
| DEC-7 | Every operation has a deterministic idempotency identity; terminal outcomes persist in the append-only state ledger and are reused; already-satisfied provider state converges as satisfied, never failure; failed outcomes are retained as evidence and retried safely; the engine identity includes the adapter capability context, so a gap that later becomes supported is a new operation identity rather than a permanently blocked outcome. | PM scope decision 7; ADR-0003 idempotency; a crash between effect and record must not produce a duplicate effect or a permanent failure, and capability upgrades must remain executable. | 2026-11-01 |
| DEC-8 | The git branch-cleanup seam is a dedicated port in the adapters I/O tier; the read-only `.git` metadata reader is not extended into a spawner and status/queue do not consume the seam. | PM scope decision 8; protects the read-only command guarantees and the runtime-confinement discipline. | 2026-11-01 |
| DEC-9 | Resolve the base for checkout restore and branch safety as the merged delivery request's target ref, falling back to the pinned v1 integration base `main-tools`. The constant is compiled contract data, not a configuration key in v1; it is an ADOS-repository default, so installed projects rely on the merged target ref and adding a configuration key is the revisit trigger. Protected refs include `main`, `main-tools`, the resolved base, `HEAD`, and declared protected refs. | Pins PM OQ on base resolution; a merged target is the most truthful destination; the v1 constant's portability limit is recorded rather than hidden as a config assumption. | 2026-11-01 |
| DEC-10 | The lifecycle label disposition is: keep `change`; remove `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, and `blocked`; add `delivered` when absent; preserve every other label. | Pins PM OQ on the sweep set; the current PM mapping retains `change` in the done state, so it is a type label rather than a lifecycle-state label. | 2026-11-01 |
| DEC-11 | The closeout provider-operation vocabulary uses `write-work-item`, `transition-work-item`, and the additive `resolve-delivery-thread`; adapters that do not implement an operation declare a gap with a valid reason. | Capability honesty requires a closed operation set and explicit gaps; thread resolution is not a work-item write or a delivery-request write. | 2026-11-01 |
| DEC-12 | `DeliveryRequest` gains an additive optional merged-head identity; absent means unknown, and branch cleanup refuses rather than guessing when it is unknown. | Squash-safe deletion requires comparing the local branch head to the merged request head; absence must remain truthful. | 2026-11-01 |
| DEC-13 | The merged delivery request is resolved by a bounded source-ref lookup, selecting the highest numeric provider entity identity deterministically; no merged request is a skip, not a failure. | Comment resolution and base resolution need a deterministic target; API return order must not decide. | 2026-11-01 |
| DEC-14 | Declared gaps and no-op conditions are non-fatal; provider write failures are `closeout.write.failed`; safety refusals are `closeout.branch.unsafe`; local checkout restore still runs after a provider failure, and branch deletion is skipped when any transaction operation failed (declared gaps and no-ops do not block it) or when the safety predicate fails. | Keeps the transaction honest and safe while preserving the operator's checkout and retry path. | 2026-11-01 |
| DEC-15 | Add one `closeout` domain kind with four rows and reuse the existing projection classes; do not overload the `provider` kind and do not add exit literals outside the CLI projection. | The result contract is the single failure identity source; the provider kind is reserved for the AI-model provider engine. | 2026-11-01 |
| DEC-16 | Owed-flip is capped at 200 direct dependents and thread resolution at 100 unresolved threads per delivery request; already-flipped items and resolved threads are excluded on later runs, so re-runs re-evaluate the remaining bounded set and make progress as eligibility changes. The owed-flip step is conditional on explicitly provider-asserted reverse-dependent and relation reads: an unavailable or unknown relation signal never flips and is recorded as `relation-signal-unavailable`; the step is a provider-level gap (`provider-unsupported`) only when the provider has no reverse-read surface. | Bounded, deterministic, and convergent without an unbounded scan; the required `relations` array cannot distinguish unknown from empty, so the provider-asserted read observation is the authority. | 2026-11-01 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts tier | New closeout plan/operation/outcome vocabulary, label and protected-ref contract data, additive optional `DeliveryRequest.headSha`, additive `resolve-delivery-thread` operation, `closeout` error kind and rows |
| Core domain/application tier | Pure deterministic closeout planner, operation identity derivation, outcome folding, and step orchestration; no I/O |
| Core state tier | Additive `closeout.operation` record kind read/write through the existing fenced port and verified read surface |
| Adapters GitHub subpath | Issue close, label and assignee writes, merged-delivery-request lookup and head normalization, bounded reverse-dependent read, review-thread resolution, discriminated read observations, capability declaration update |
| Adapters Jira subpath | Done transition, label replace with preservation, assignee clear, bounded reverse-dependent query, discriminated read observations, capability declaration update, write trap fixtures |
| Adapters GitLab subpath | Read-only merged-request lookup and head normalization; write gaps remain |
| Adapter read results | Discriminated observation (`observed` / `not-found` / `unavailable` / `invalid`) on closeout-relevant reads; additive adapter-I/O refinement, no new closed operation, no core primitive-port field, no schema bump |
| Dedicated git branch/checkout adapter subpath | Checkout restore, branch enumeration and deletion, safety queries; new exact runtime-confinement entry |
| CLI command layer | `closeout` grammar, composition, plan/apply rendering, envelope and exit projection; command registration |
| Result contract and error table | Additive `closeout` domain kind and four documented rows; bidirectional sync |
| Command registry and planning docs | Closeout row remains; the phase-7 doc sync reconciles the row description so it no longer claims harness session telemetry capture (deferred to M1-S11) and names the deferral explicitly; capability and error documentation reconciled in phase 7 |
| Testkit, fixtures, and boundary checks | Sanitized provider write fixtures, local-git scenarios, capability-parity tests, state-ledger tests, read-only isolation fixtures; the conformance flow registry gains a `resolve-delivery-thread` step and its operation set is updated in the same change (TDR-0008) |
| System feature specs | `feature-closeout` authored and the affected provider/result specs reconciled by `@doc-syncer` in phase 7 |

## 17. ACCEPTANCE CRITERIA

### Command and plan

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a valid work item ref, **when** `closeout <ref>` runs without `--apply`, **then** it returns a success envelope with a deterministic ordered plan and performs zero provider writes, zero git mutations, zero state appends, and zero fence acquisitions. | F-1, NFR-4 |
| AC-F1-2 | **Given** a valid work item ref, **when** `closeout <ref> --apply` runs, **then** it executes the same ordered plan in apply mode and returns a per-operation outcome summary. | F-1, F-2 |
| AC-F1-3 | **Given** a malformed, missing, or lowercase ref, an extra positional, or an unknown flag, **when** closeout is invoked, **then** a ref/positional failure is `input.value.rejected` and an unknown flag is `fallback.invocation`, with exit 1 and no source read or mutation. | F-1, F-14 |
| AC-F2-1 | **Given** identical observed state and arguments, **when** the plan is computed twice, **then** the ordered steps, canonical arguments, and operation identities are byte-identical. | F-2, NFR-2 |
| AC-F2-2 | **Given** a plan, **when** its steps are inspected, **then** they appear exactly in the order ticket-to-done, lifecycle label sweep, unassign, owed-flip sweep, comment resolution, checkout restore, and squash-safe local branch cleanup. | F-2, DEC-2 |
| AC-F2-3 | **Given** a step that expands to multiple operations, **when** the plan is computed, **then** operations are ordered deterministically and each has a distinct operation identity. | F-2, F-3 |

### Idempotency

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a completed apply, **when** the same closeout is re-run in a fresh process after a simulated restart, **then** every terminal outcome is reused, zero duplicate provider or git mutations occur, and the command exits 0. | F-3, NFR-1 |
| AC-F3-2 | **Given** a crash after a provider effect but before the ledger append, **when** closeout is re-run, **then** the already-satisfied provider state converges as `satisfied` and no duplicate effect is performed. | F-3, NFR-1 |
| AC-F3-3 | **Given** a persisted `failed` outcome, **when** closeout is re-run, **then** the operation is re-observed and retried safely, and the failed record remains as evidence. | F-3, F-14 |
| AC-F3-4 | **Given** the same workspace, ref, engine, adapter capability context, operation, canonical arguments, and provider target, **when** the operation identity is derived, **then** it is identical; changing any identity input, including the capability context, changes the identity. | F-3, DM-9 |

### Ticket-to-done

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** an open work item with a supported done transition, **when** apply runs, **then** the item is transitioned to done and the outcome is `applied`. | F-4 |
| AC-F4-2 | **Given** an already-done work item, **when** plan or apply runs, **then** the outcome is `satisfied` with zero write. | F-4 |
| AC-F4-3 | **Given** no provider done transition or no adapter mapping, **when** the step is planned, **then** it is `skipped-gap` with a valid reason and the transaction is not failed. | F-4, F-11 |
| AC-F4-4 | **Given** a target work-item read in plan or apply mode, **when** the provider explicitly reports not-found, **then** the command fails `closeout.target.unobserved` with exit 1 and performs no write; **when** the payload is malformed or unparsable, **then** the failure is `provider.payload.invalid` and is never mapped to `closeout.target.unobserved`; **when** the provider has no work-item read, **then** the ticket-dependent steps are a declared gap. | F-4, F-14, DM-11 |

### Lifecycle label sweep

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** provider-asserted labels containing lifecycle-state labels, **when** apply runs, **then** `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, and `blocked` are removed, `change` and all non-lifecycle labels are retained, and `delivered` is added when absent. | F-5, DM-6 |
| AC-F5-2 | **Given** an already-swept label set, **when** apply is re-run, **then** the sweep outcomes are `satisfied` with zero write. | F-5 |
| AC-F5-3 | **Given** an absent (unknown) label signal, **when** the sweep is planned, **then** it is `skipped-noop` with `label-signal-unavailable` evidence and performs no blind replacement or removal. | F-5, DM-6 |
| AC-F5-4 | **Given** Jira's full-array label-replace semantics, **when** the sweep runs, **then** labels not named for removal are preserved and the trap fixture proves the behavior. | F-5, F-11 |

### Unassign

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** an assigned work item, **when** apply runs, **then** an explicit clear write is performed and the outcome is `applied`. | F-6 |
| AC-F6-2 | **Given** an absent assignee signal, **when** apply runs, **then** an explicit clear is still scheduled and issued; the plan never reports "already unassigned" from absence. | F-6, DM-5 |
| AC-F6-3 | **Given** a provider without an assignee-clear capability, **when** the step is planned, **then** it is `skipped-gap` with a valid reason. | F-6, F-11 |
| AC-F6-4 | **Given** a prior terminal unassign outcome or a provider-asserted absent assignee after a clear, **when** closeout is re-run, **then** the unassign step is `satisfied` and no duplicate clear is issued. | F-6, F-3 |

### Owed-flip

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** an open direct dependent whose `blocked-by` set becomes fully done or canceled by this closeout, **when** apply runs, **then** `hand-back` is added, a present `blocked` label is removed, and the flip is recorded. | F-7 |
| AC-F7-2 | **Given** a dependent with another open blocker, **when** the sweep runs, **then** no flip occurs and the evidence names the open-blocker count. | F-7 |
| AC-F7-3 | **Given** a dependent already carrying `hand-back` and not carrying `blocked`, **when** the sweep runs, **then** it is `satisfied` with zero write. | F-7 |
| AC-F7-4 | **Given** a dependent with an unknown blocker or an unavailable relation signal, **when** the sweep runs, **then** no flip occurs and the evidence names the unavailable signal; unknown is never treated as satisfied or as an empty blocker set. | F-7, DM-11 |
| AC-F7-5 | **Given** more than 200 direct dependents, **when** the sweep runs, **then** it processes the deterministic first batch, records `truncated` and the omitted count, and a re-run re-evaluates the remaining bounded set, excluding already-flipped candidates and making progress as eligibility changes. | F-7, NFR-6, DEC-16 |
| AC-F7-6 | **Given** the owed-flip step, **when** the provider declares no reverse-dependent read surface, **then** it is `skipped-gap` with `provider-unsupported`; **when** the provider has the surface but the current reverse-dependent read is unavailable, **then** it is `skipped-noop` with `relation-signal-unavailable` evidence and performs no flip. | F-7, F-11, DM-11 |
| AC-F7-7 | **Given** a candidate whose `blocked-by` relation read is provider-asserted and empty, and another candidate whose relation signal is unavailable or unasserted, **when** the sweep runs, **then** the first is evaluated as having no blockers and may flip, while the second is skipped with `relation-signal-unavailable` evidence and is never flipped; an unasserted empty array is never treated as "no blockers". | F-7, DM-11, NFR-9 |

### Comment resolution

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** a merged delivery request with unresolved threads and a supporting provider, **when** apply runs, **then** each unresolved thread is resolved once, already-resolved threads are `satisfied`, and the outcomes are recorded. | F-8 |
| AC-F8-2 | **Given** a provider without a delivery-request or thread-resolution surface, **when** the step is planned, **then** it is `skipped-gap` with `provider-unsupported` and the transaction exits 0. | F-8, F-11 |
| AC-F8-3 | **Given** no merged delivery request, **when** the step is planned, **then** it is `skipped-noop` with `no-delivery-request` evidence and is not a failure. | F-8 |
| AC-F8-4 | **Given** a thread-resolution write failure, **when** apply runs, **then** the command returns `closeout.write.failed` with exit 2, completed outcomes are persisted, and a re-run retries the failed operation safely. | F-8, F-14 |

### Checkout restore and branch cleanup

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F9-1 | **Given** the current checkout is the delivery branch and the worktree is clean, **when** apply runs, **then** the checkout is restored to the resolved base (merged target ref, else the integration base) and the outcome is `applied`. | F-9 |
| AC-F9-2 | **Given** the current checkout is already on the base, **when** apply runs, **then** the step is `satisfied` with zero switch. | F-9 |
| AC-F9-3 | **Given** the current checkout is an unrelated branch, **when** apply runs, **then** the step is `satisfied` with `already-elsewhere` evidence and the unrelated checkout is not hijacked. | F-9 |
| AC-F9-4 | **Given** a dirty worktree on the delivery branch or a missing local base ref, **when** apply runs, **then** checkout restore refuses, no branch is deleted, and the command returns `closeout.branch.unsafe` with exit 1. | F-9, F-10, F-14 |
| AC-F9-5 | **Given** the current checkout is detached at the delivery head, **when** the worktree is clean and the base ref resolves locally, **then** apply restores the checkout to the resolved base with outcome `applied`; **when** the worktree is dirty or the base ref does not resolve, **then** restore refuses with `closeout.branch.unsafe` and no branch is deleted. | F-9, F-10, F-14 |
| AC-F10-1 | **Given** a squash-merged delivery request whose merged head equals the local branch head, **when** apply runs, **then** the local branch is deleted once and no remote ref is touched. | F-10 |
| AC-F10-2 | **Given** a local branch whose head moved after the merged head, **when** apply runs, **then** deletion is refused, the branch is retained, and the command returns `closeout.branch.unsafe` with exit 1. | F-10, F-14 |
| AC-F10-3 | **Given** a protected ref (`main`, `main-tools`, the resolved base, `HEAD`, or a declared protected ref), **when** branch cleanup is planned, **then** deletion is never attempted and the protected state is recorded as evidence. | F-10, DM-7 |
| AC-F10-4 | **Given** the delivery branch is checked out in another worktree, **when** branch cleanup is planned, **then** deletion is refused with evidence and no destructive action occurs. | F-10 |
| AC-F10-5 | **Given** the local branch is already absent, **when** branch cleanup is planned, **then** the step is `satisfied` with zero mutation. | F-10 |
| AC-F10-6 | **Given** multiple local branches match the work item and no unique merged-head match exists, **when** apply runs, **then** the command returns `closeout.target.ambiguous` with exit 1 and deletes nothing. | F-10, F-14 |
| AC-F10-7 | **Given** the merged head identity is unknown, **when** branch cleanup is planned, **then** deletion is refused with `closeout.branch.unsafe` and the branch is retained. | F-10, DM-8 |
| AC-F10-8 | **Given** a non-gap provider write failure earlier in the transaction, **when** apply finishes, **then** checkout restore still runs when safe, branch deletion is skipped, the branch is retained, and the command returns `closeout.write.failed`. | F-9, F-10, F-14 |

### Capability honesty and provider contracts

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F11-1 | **Given** the GitHub v1 capability declaration, **when** inspected, **then** it supports the documented closeout writes and declares `write-comment` and `write-delivery-request` as gaps with valid reasons. | F-11, DM-5 |
| AC-F11-2 | **Given** the Jira v1 capability declaration, **when** inspected, **then** it supports `write-work-item` and `transition-work-item` and declares `write-comment`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, and `resolve-delivery-thread` as gaps with valid reasons. | F-11, DM-5 |
| AC-F11-3 | **Given** the GitLab v1 capability declaration, **when** inspected, **then** every write operation, including `resolve-delivery-thread`, and `read-work-item` are declared gaps, while `read-delivery-request` and `read-pipeline-run` remain supported. | F-11 |
| AC-F11-4 | **Given** a closeout plan containing an unsupported operation, **when** the plan is rendered or applied, **then** the operation is `skipped-gap` with a valid reason, is never reported as applied or satisfied, and does not fail the transaction. | F-11, NFR-9 |
| AC-F12-1 | **Given** a work item ref and more than one merged delivery request match, **when** the target is resolved, **then** the highest numeric provider entity identity is selected deterministically and the selection is recorded. | F-12, DEC-13 |
| AC-F12-2 | **Given** no merged delivery request lookup support, **when** delivery-request-dependent steps are planned, **then** they skip with evidence and the base falls back to the integration base. | F-12 |
| AC-F12-3 | **Given** a provider fixture with a merged head identity and one without it, **when** `DeliveryRequest` is normalized, **then** the identity round-trips when present and remains absent (unknown) when absent. | F-12, DM-8 |

### Output, errors, and read-only isolation

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F13-1 | **Given** a closeout run, **when** machine output is produced, **then** it is exactly one bounded `delivery.closeout.v1` `CommandResult` envelope with no comment bodies, titles, raw payloads, credentials, or environment values. | F-13, NFR-7 |
| AC-F13-2 | **Given** identical observed state and arguments, **when** human output is rendered twice, **then** it is byte-identical and within the declared line and byte bounds. | F-13, NFR-7 |
| AC-F14-1 | **Given** each new closeout failure identity, **when** it is emitted, **then** it carries the documented code, category, retryability, consequence, projection class, and exit code from the table. | F-14 |
| AC-F14-2 | **Given** the documented error table and the machine-readable table, **when** the sync check runs, **then** every new row and entry agree bidirectionally and no exit literal exists outside the CLI projection. | F-14, NFR-11 |
| AC-F15-1 | **Given** the delivered read-only commands, **when** their behavior and boundary tests run, **then** they perform zero writes and zero process spawns, and they do not import the git cleanup seam or the provider write path. | F-15, NFR-5 |
| AC-NFR3-1 | **Given** the closeout test battery, **when** it runs in CI, **then** it uses only committed sanitized fixtures, local temporary repositories, and injected transports; no live provider credentials or network calls are required. | NFR-3 |
| AC-NFR8-1 | **Given** a closeout apply, **when** the ledger is inspected, **then** one record exists per terminal operation, a verified read returns them, and a torn or malformed ledger produces a classified state error rather than zeros. | NFR-8, DM-4 |
| AC-NFR10-1 | **Given** the dependency set, **when** the license and dependency checks run, **then** no runtime dependency was added and the fail-closed license gate is green. | NFR-10 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery shape.** One change delivered on a feature branch to `main-tools`; no existing command changes behavior. The command is additive and dry-run by default, so adoption is opt-in and reversible.
- **Dogfood.** After merge, run the command in plan mode on a completed change, compare the plan against the manual ceremony, then run `--apply` on the next eligible merge. The bash ceremony remains authoritative until the command has a clean dogfood record.
- **Dual-run.** The plan output is the adoption artifact; it names every operation and gap before any mutation. This gives the coordinator a deterministic checklist while the manual path is still available.
- **Communication.** The command registry already lists closeout; the change updates the capability declarations and the error documentation. The phase-7 system-spec update authors the closeout feature spec, reconciles the affected provider and result specs, and fixes the registry description so it no longer claims harness session telemetry capture and explicitly names the M1-S11 deferral.
- **Rollback.** Revert the change or stop using the command; the state ledger records are append-only and harmless, and no schema migration is involved. A contract-extension problem degrades safely to a branch-cleanup refusal when the merged head is unknown.
- **No feature flag.** The command is a separate entry point; there is no runtime flag to disable an existing behavior. The only mutation switch is `--apply`.
- **Merge gate.** The change must pass the offline gate battery, the error-table sync, the exit-literal invariant, the boundary fixtures, the state-ledger tests, and the adapter write fixtures before merge.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration and no seeding are required. The `closeout.operation` record kind is additive inside the existing `delivery.state.v1` schema; existing stores remain readable and no schema-version bump occurs. Closeout reads existing work items, delivery requests, labels, relations, and local git state. Test fixtures are authored as sanitized data and are not production seeds.

## 20. PRIVACY / COMPLIANCE REVIEW

- **Data minimization.** Closeout reads only the work item, its labels, assignee, relations, the merged delivery request's identity/refs/threads/head, and local git branch/checkout facts. The read observation carries only the `observed` / `not-found` / `unavailable` / `invalid` state, never payload content. It does not read comment bodies, titles into output, session stores, prompts, transcripts, or file contents.
- **No secret exposure.** Credentials resolve through the credential port; no secret is read or recorded by closeout. The state ledger stores refs, labels, operation identities, outcomes, and bounded evidence only.
- **No cloud content.** The change adds no cloud names, hosted-only designs, or private identifiers. Provider calls are the delivered adapter transports.
- **Retention.** The state ledger retains operation records forever under the existing state retention policy; records are bounded and contain no personal content. No new retention or deletion surface is introduced.
- **Documentation.** The change spec is a change artifact and needs no `ados_distribution` marker. The phase-7 feature spec is authored by `@doc-syncer` under the repository documentation rules.
- **Privacy guards.** New fixtures are sanitized and scanned by the delivered privacy guard; planted-secret canaries cover closeout output and ledger evidence.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Mutation is opt-in.** Dry-run is the default; `--apply` is the only mutation switch, matching the delivered `db` precedent. Plan mode performs zero writes, zero git mutations, zero state appends, and zero fence acquisitions.
- **Bounded write scope.** Writes target only the observed work item, its direct dependents, the declared labels, the assignee clear, the merged delivery request's threads, and the matching local branch. There is no wildcard label rewrite, no arbitrary comment write, and no remote deletion.
- **Credential discipline.** Every provider write resolves credentials through the credential port; the secret-read boundary allowlist does not grow. Provider transports remain in the existing per-provider adapter subpaths.
- **Branch safety.** Deletion requires the full squash-safety predicate, merged-head equality, protected-ref checks, dirty-worktree and foreign-worktree checks, and a successful checkout restore. Unsafe states produce zero destructive action. Force deletion is used only after the predicate proves the work landed.
- **Idempotency.** Deterministic operation identities and terminal-outcome reuse prevent duplicate writes; failed writes are safe to retry because every closeout operation is idempotent by construction.
- **Capability honesty.** Unsupported operations are declared gaps with valid reasons and can never be reported as success. This prevents a provider from being treated as having parity it does not have.
- **Runtime confinement.** The new git seam is an exact, reason-bearing adapter I/O entry; the read-only repository reader remains no-spawn. Boundary fixtures fail closed on a violation.
- **No session-content exposure.** Closeout does not read the session database or harness stores; the ADR-0003 C-11 metadata-only session clause is not triggered.
- **Output redaction.** The single serialization chokepoint covers machine and human output; evidence is bounded and contains no comment bodies, titles, raw payloads, secrets, environment values, or command arguments.

## 22. MAINTENANCE & OPERATIONS IMPACT

Maintainers gain five bounded surfaces:

1. **Label disposition table** — adding, removing, or renaming lifecycle labels updates the contract data, the fixtures, and the error-free sweep tests.
2. **Protected-ref and base contract** — the v1 integration base is the compiled constant `main-tools` with a recorded portability limit; adding a configuration key is a revisit trigger. Protected refs are declared data; a new protected-ref convention updates the contract data and the branch-safety fixtures.
3. **Provider operation vocabulary and declarations** — a gap becomes supported only when its implementing story lands, with trap coverage and write fixtures in the same change. The read observation (DM-11) is the authority for whether a relation signal is asserted. The Jira write basis can be re-evaluated behind the adapter boundary.
4. **Idempotency records** — operation records grow append-only per merge; retention stays forever under the state policy. There is no compaction or deletion surface in this change.
5. **Fixtures and conformance** — provider write fixtures age; the scheduled conformance suite remains the drift detector. New provider quirks join the trap catalogs rather than ad-hoc tests.

Operationally, the manual closeout ceremony can be replaced once the dogfood record is clean. The command is additive, so no existing runbook step breaks; the dry-run plan is the safe rehearsal. No new service, daemon, or scheduled job is introduced.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Closeout transaction | The idempotent post-merge operation that completes a delivery's tracker, review, checkout, and local-branch state. |
| Plan mode | The default closeout mode: read state, compute the transaction, and render it with zero mutation. |
| Apply mode | Closeout with `--apply`: execute the plan and persist operation outcomes. |
| Operation identity | The deterministic `operationId` derived per ADR-0003 from workspace, work item ref, engine, adapter capability context, operation, canonical arguments, and provider target. |
| Terminal outcome | An outcome (`applied`, `satisfied`, `skipped-gap`, `skipped-noop`) that is reused on re-run without re-executing the operation. |
| Declared gap | An explicit adapter record that an operation is unsupported, with one of `provider-unsupported`, `adapter-not-implemented`, or `plan-restriction`. A gap is not a failure. |
| Owed-flip | Moving an open direct dependent whose blockers are all satisfied to `hand-back` and removing a present `blocked` label. |
| Owner-attention label | The declared labels that mark work as owing the owner an action; v1 uses `hand-back` for owed-flip and recognizes `human-input-needed` as an existing owner state. |
| Lifecycle label sweep | The bounded removal of stale lifecycle-state labels and the addition of `delivered`, while preserving type and non-lifecycle labels. |
| Squash-safe | A deletion predicate that proves the branch's work landed through the merged delivery request's head identity, not through git ancestry, because a squash merge rewrites ancestry. |
| Merged head | The provider-resolved head commit identity of the merged delivery request; absent means unknown. |
| Integration base | The pinned v1 base for local checkouts (`main-tools`), used only when no merged target ref is observed; compiled contract data, not a configuration key in v1. |
| Protected ref | A ref that branch cleanup must never delete: `main`, `main-tools`, the resolved base, `HEAD`, and declared protected refs. |
| Read observation | The explicit discriminator on a closeout-relevant read: `observed`, `not-found`, `unavailable`, or `invalid`. It keeps an unasserted relation array from being read as an empty set. |
| Provider-asserted signal | A normalized value or set the provider actually supplied; an observed empty set means none, while an unavailable signal means unknown. |
| Reverse-read surface | The adapter's bounded query for dependents that declare the closed item as a blocker, expressed as a query-shaped form of `read-work-item`; it adds no closed operation. |
| Delivery request | The normalized PR/MR primitive: identity, source and target refs, review state, and threads. |
| Capability declaration | An adapter's explicit supported-operation set and declared gaps; absence of a flag is never implied parity. |
| Read-only command | `status`, `queue ready`, and `verify change`; these perform zero writes and zero process spawns. |

## 24. APPENDICES

### Appendix A — Ordered transaction plan (illustrative)

| Order | Step | Operation expansion | Provider path | Local path |
|---:|---|---|---|---|
| 1 | ticket-to-done | 1 transition operation | GitHub/Jira | — |
| 2 | lifecycle label sweep | up to 7 label operations | GitHub/Jira | — |
| 3 | unassign | 1 explicit clear operation | GitHub/Jira | — |
| 4 | owed-flip sweep | 1 operation per eligible direct dependent (cap 200) | GitHub/Jira, conditional on provider-asserted reverse/relation reads | — |
| 5 | comment resolution | 1 operation per unresolved thread (cap 100) | GitHub only | — |
| 6 | checkout restore | 1 operation | — | git seam |
| 7 | branch cleanup | 1 operation | — | git seam |

### Appendix B — Provider capability matrix

| Operation | GitHub | Jira | GitLab |
|---|---|---|---|
| `read-work-item` | supported | supported | gap (`adapter-not-implemented`) |
| `write-work-item` | supported (labels, assignee) | supported (labels replace, assignee clear) | gap (`adapter-not-implemented`) |
| `transition-work-item` | supported (close) | supported (data-driven done transition) | gap (`adapter-not-implemented`) |
| `read-delivery-request` | supported | gap (`provider-unsupported`) | supported |
| `write-delivery-request` | gap (`adapter-not-implemented`) | gap (`provider-unsupported`) | gap (`adapter-not-implemented`) |
| `read-pipeline-run` | supported | gap (`provider-unsupported`) | supported |
| `write-comment` | gap (`adapter-not-implemented`) | gap (`adapter-not-implemented`) | gap (`adapter-not-implemented`) |
| `resolve-delivery-thread` | supported | gap (`provider-unsupported`) | gap (`adapter-not-implemented`) |

The bounded reverse-dependent query is a query-shaped form of `read-work-item` and adds no closed operation. The read observation (DM-11) determines whether a relation signal is provider-asserted; it does not change the capability matrix.

### Appendix C — Label disposition table

| Label | Disposition | Idempotent behavior |
|---|---|---|
| `change` | keep | Always retained; no write |
| `planning` | remove | Absent → satisfied; present → remove operation |
| `spec-ready` | remove | Absent → satisfied; present → remove operation |
| `readiness-passed` | remove | Absent → satisfied; present → remove operation |
| `in-progress` | remove | Absent → satisfied; present → remove operation |
| `review` | remove | Absent → satisfied; present → remove operation |
| `blocked` | remove | Absent → satisfied; present → remove operation |
| `delivered` | add | Present → satisfied; absent → add operation |
| Any other label | preserve | No write |

### Appendix D — Error rows

See F-14 for the four `closeout` rows. Declared gaps are data outcomes, not error rows. State, config, input, and credential failures reuse their existing rows. The adapter-local `provider.payload.invalid` read failure is not an error-table row and is never used for an explicit provider not-found.

### Appendix E — Traceability

| Source | Where reflected |
|---|---|
| Ticket GH-183 goal and AC | §1, §3, §4, §17 (especially AC-F3-1, AC-F3-2) |
| Backlog M0-S14 tasks | §5.1 F-1 through F-10, §6, §17 |
| PM clarify_scope decisions 1–8 | DEC-1 through DEC-8 |
| PM pinned open questions (base, labels) | DEC-9, DEC-10 |
| `cli-command-registry.md` closeout row | §5.1 F-1, §8.1; ODR-0003 is the proposed naming lock pending owner acceptance at the GH-183 PR review |
| `user-journeys.md` step 9 | §1, §2, §6, §18 |
| `primitive-catalogue.md` CloseoutTransaction | §1, §5, §23 |
| ADR-0003 / ADR-0005 | Tier boundaries, runtime confinement, idempotency, state ledger |
| ADR-0004 / ADR-0006 | Absence semantics for assignee, labels, comments, and merged head |
| `feature-result-contract.md` | Error identities, projection, envelope, sync invariant |
| `feature-state-layer.md` | Record kinds, verified reads, fences, torn-state errors |
| `feature-adapter-ports.md` | Operation set, capability/gap declarations, credential port |
| `feature-provider-client-seeds.md` | GitHub/Jira/GitLab seeds, trap catalogs, read slices, absent GitLab relation signal |
| `feature-queue-ready.md` / `feature-verify-change-and-exit-taxonomy.md` | Read-only guarantees preserved |
| `.ai/agent/pm-instructions.md` | Label mapping and done-state disposition |
| `.ai/agent/pr-instructions.md` | GitHub GraphQL `resolveReviewThread` |
| Target read observation and not-found mapping | F-4, F-14, DM-11, AC-F4-4, §6 Flow 7 |
| Provider-asserted relation and reverse-read model | F-7, F-11, DM-11, DEC-16, AC-F7-4, AC-F7-6, AC-F7-7 |
| Detached-HEAD restore path | F-9, AC-F9-5 |
| Command registry description (M1-S11 deferral) | §16, §18, §22 |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-01 | Change Spec Writer | Initial specification for GH-183 (M0-S14). |
| 1.1 | 2026-11-01 | PM | Resolved OQ-1 with TDR-0008 and linked it; resolved OQ-2 as a PM scope decision; recorded the conformance-registry obligation. |
| 1.2 | 2026-11-01 | Change Spec Writer | Remediated DoR iteration 1: made owed-flip conditional on provider-asserted reverse/relation reads with an explicit read observation (DM-11); defined target not-found detection and mapping to `closeout.target.unobserved`; reconciled DM-5 to the flat `write-work-item` arguments; aligned the ref grammar to case-sensitive `input.value.rejected` for extra positionals; added AC-F9-5 for detached-HEAD restore; pinned the v1 integration base and its portability limit; corrected ODR-0003/TDR-0008 authority wording; added capability context to the operation identity; recorded the registry description sync obligation. |

---

## AUTHORING GUIDELINES

This spec was authored from the GH-183 ticket, the GH-183 PM clarify_scope notes, and the repository's current planning and system-spec truth: the M0-S14 backlog row, the command registry, the user-journey step 9, the primitive catalogue's `CloseoutTransaction`, ADR-0003/ADR-0005, ADR-0004/ADR-0006 absence semantics, ODR-0003 (proposed naming lock; owner acceptance at the GH-183 PR review), TDR-0008 (proposed additive-extension record; owner acceptance at the GH-183 PR review), the delivered result-contract/state-layer/adapter-ports/provider-seed/queue-ready/verify-change feature specs, and the PM and PR instruction surfaces. It records the eight PM scope decisions as DEC-1 through DEC-8, pins the two PM open questions as DEC-9 and DEC-10, and raises two genuinely unresolved governance questions (OQ-1, OQ-2) rather than silently changing scope.

The spec is deliberately technology-neutral at the contract level: it names package tiers, ports, operations, record kinds, outcomes, and provider surfaces, but it does not prescribe implementation steps or file-level code paths. The offline requirement is treated as a design constraint: provider behavior is proven through committed sanitized fixtures and injected transports, the local git seam is exercised against temporary repositories, and no live-network test is part of the gate battery.

Where the PM inputs and the repository docs create tension, the spec pins the safer default and records the tension: the PM label list includes `change`, while the PM mapping retains `change` in the done state, so DEC-10 keeps it as a type label; GH-188 mentions comment writes arriving with M0-S14, while the closeout task list does not post a comment, so OQ-2 records the boundary and defaults to no closure comment. Where a required `relations` array cannot distinguish an unknown provider signal from an observed empty set, the spec adds an explicit read observation (DM-11) rather than overloading the absent-signal rule.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-183`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/DEC- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Read-result discrimination is recorded (DM-11) and traced to AC-F4-4, AC-F7-4, AC-F7-6, and AC-F7-7
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
- [x] Out-of-scope items marked `[OUT]`
- [x] Every functional capability has a rationale
- [x] Open questions carry an explicit default and a decision path
