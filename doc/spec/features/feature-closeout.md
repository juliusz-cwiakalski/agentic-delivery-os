---
ados_distribution: internal
id: SPEC-CLOSEOUT
status: Current
created: 2026-11-01
last_updated: 2026-11-13
owners: ["engineering"]
service: delivery-os
summary: "The delivered closeout transaction: a dry-run-by-default `closeout <workItemRef>` command, the deterministic twelve-step plan, SHA-256 operation identities and the append-only `closeout.operation` ledger over the real JSONL state driver, a production CLI composition over the real provider clients, git seam (including bounded merged-diff and worktree facts), state store, and resolved harness settings, GitHub and Jira writes with declared GitLab gaps, authorship-gated review-thread resolution, the tracker-relation owed-flip sweep, checkout restore, local worktree cleanup, squash-safe local branch cleanup, the detection-only merged-diff sweep, read-only retro coverage, the bounded session-compaction checkpoint, the change-capsule validation and promotion ceremony, the automatic `landed` queue-entry removal after the closeout writes inside the held fence with its additive non-step `queueRemoval` disclosure and fail-open skips, the bounded deterministically ordered judgment residue with the additive `attention` exit class, the discriminated work-item read observation and the separate reverse-dependent no-surface vocabulary, provider-asserted label/relation availability signals, bounded output measured in UTF-8 bytes, the five `closeout` error identities plus the `closeout.step.<id>.failed` family, and the non-gating, idempotent harness telemetry capture built from the configured harness settings with bounded disclosure."
links:
  related_changes: ["GH-183", "GH-221", "GH-231", "GH-233", "GH-240", "GH-242", "GH-292"]
  related_decisions: ["TDR-0008", "ODR-0003", "ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006", "ADR-0008", "TDR-0026"]
  contracts:
    - "packages/core/src/contracts/closeout.ts"
    - "packages/core/src/contracts/capsule.ts"
    - "packages/core/src/contracts/ports.ts"
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/state.ts"
---

# Feature: Closeout Transaction

> **Role of this Document:** Source of truth for the closeout feature. It describes the delivered command, plan, ledger, provider postures, safety predicates, output, and failure identities. Requirements live in the GH-183 change artifacts; this document describes current behavior.

## 1. Overview

`closeout <workItemRef>` is the Deliver-family post-merge transaction. One invocation computes a deterministic twelve-step plan across the tracker, review, checkout, local git, merged-diff, retro-registry, harness session-store, and change-capsule surfaces, renders it in dry-run mode by default, and applies it only with `--apply`. Every operation carries a deterministic operation identity; terminal outcomes are persisted in the append-only state ledger as `closeout.operation` records, so a re-run reuses completed work and converges instead of repeating effects. After a merge is observed, an apply run also retires the work item's queue entry with reason `landed`, inside the fence the transaction already holds and without changing a step outcome or the exit code.

Provider writes are delivered for GitHub and Jira. GitLab remains a read slice with declared write gaps. Checkout restore and local branch deletion run through a dedicated git branch/checkout seam, and branch deletion is permitted only when a squash-safety predicate proves the branch's work landed. The transaction is bounded in operations, time, and output, and it is proven offline against committed fixtures and temporary local repositories.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** The post-merge ceremony is manual or model-driven and routinely misses steps: a ticket stays open, lifecycle labels linger, an assignee remains, a dependent never learns the blocker cleared, review threads stay unresolved, a human reviewer's question is auto-resolved, a delivery worktree and an old local branch accumulate, owed-flip markers in the merged diff are only found by grepping, retro coverage is implicit, session state is compacted without a checkpoint, the change capsule is left open with unevaluated memory candidates, and the operator receives no bounded list of what still needs attention. Retrying a partial ceremony has no memory of what already landed, and deleting a branch after a squash merge cannot rely on git ancestry because a squash merge rewrites ancestry.
- **Affected Users:** Coordinators and delivery agents closing a merged change; operators who own the local checkout and worktrees; reviewers who expect their own threads to remain open; maintainers who own branch safety; the memory curator and the roles receiving promotion handoffs.
- **Business Impact:** Manual closeout misses create stale tracker state, misleading readiness inputs, erased human review questions, stranded worktrees and branches, an open capsule with no recorded promotion decisions, and unsafe deletions. One deterministic, idempotent transaction with a bounded residue removes the routine misses and makes retries safe.

### 2.2 Goals & Success Metrics

- **Primary goal:** Deliver one deterministic, dry-run-by-default, idempotent closeout transaction whose provider, local-git, retro, session, capsule, and promotion effects converge on re-run and whose remaining judgment items are reported as bounded residue.
- **KPIs:** zero routine manual misses after adoption; 100% of re-runs after a completed or partially completed apply perform zero duplicate effects; identical inputs yield byte-identical plans and operation identities; 100% of unsupported operations carry a valid declared-gap reason; 100% of closeout tests run offline without live credentials or network; zero branch deletions or worktree removals on unsafe fixtures; zero human-authored threads auto-resolved; zero telemetry records moved into the capsule; 100% of candidates carry exactly one promotion decision.

### 2.3 Non-Goals

- Telemetry capture outside closeout (phase boundaries, session end) and backfill of historical sessions; capture is a closeout-time operation only.
- Remote branch or worktree deletion, remote ref cleanup, force push, or history rewrite.
- GitLab write operations; GitLab writes and the work-item read remain declared gaps.
- The full GitHub adapter, full issue lifecycle, releases, and operations beyond closeout (M3-S3).
- Posting a closure comment or arbitrary tracker/PR comment writes; `write-comment` remains a declared gap.
- Merge execution or merge verification.
- Cross-repository closeout, global state, or multi-repo fan-out.
- MCP and OpenCode/host closeout surfaces.
- A new archive tree, capsule relocation, capsule compaction, or a full memory-index rebuild engine; "close the capsule" is a terminal event and closed state.
- Typed memory records, the preferences tree, guild trees, memory lint, the memory doctor, and the memory command family (M2-S8, M3-S8, M3-S9).
- Harness context-compaction invocation or any invented harness compaction API; the invocation is a declared capability gap.
- Source-code edits, marker removal, feature-flag code rewrites, commits, pushes, or history rewrites by closeout; the diff sweep detects and attributes only.
- Retro collection or report execution, retro evidence writes, or a synthetic `retro.run` record; a closeout coverage read never appends to the retro registry.
- Owner-gate SLA mechanics, board escalation, brief rendering, queue/lane/dispatch, or supervision behavior.
- Changing the behavior or guarantees of the read-only commands.

## 3. User Experience & Functionality

### 3.1 Capabilities

#### Command surface

`closeout <workItemRef> [--apply] [--json]` is a top-level Deliver-family command. The work-item ref must match the canonical uppercase `<PREFIX>-<digits>` shape (`^[A-Z][A-Z0-9]*-\d+$`); validation is case-sensitive, performs no case folding, and runs before any source read. Exactly one ref is accepted.

- Without `--apply` the command is a plan: it reads state, computes the transaction including the capsule pre-flight and candidate plan, and renders it with zero provider writes, zero git mutations, zero state appends, zero capsule appends, zero promotion writes, and zero fence acquisitions.
- With `--apply` it executes the same plan and persists operation outcomes.
- A missing, malformed, or lowercase ref, or exactly one extra positional, is `input.value.rejected`. Two or more extra positionals or an unknown flag are `fallback.invocation` before the handler. All grammar failures exit non-zero and perform no source read or mutation.
- The handler returns data or a classified failure; the CLI edge owns rendering and exit projection. No command-help surface is added.

#### Deterministic twelve-step plan

The plan is a pure function of observed work-item and read facts, provider capabilities, the merged delivery request, local repository and worktree facts, the recorded merge transaction's diff, the retro registry's coverage state, the delivery's session-attribution facts, the change capsule's pre-flight facts, declared contract data, and persisted terminal outcomes. Steps appear in this binding order; consumers resolve a step by its `stepId`, never by array position:

| Order | Step | Expansion |
|---:|---|---|
| 1 | `ticket-to-done` | One `transition-work-item` operation, or a gap when the transition is unsupported. |
| 2 | `lifecycle-label-sweep` | One removal operation per present lifecycle-state label plus one `delivered` add operation when absent. |
| 3 | `unassign` | One explicit clear operation with canonical `{ assignee: "none" }`. |
| 4 | `owed-flip-sweep` | One `write-work-item` operation per eligible direct dependent (cap 200). |
| 5 | `comment-resolution` | One `resolve-delivery-thread` operation per unresolved non-human thread on the merged delivery request (cap 100). |
| 6 | `checkout-restore` | One `restore-checkout` operation, or a satisfied/refused state. |
| 7 | `worktree-cleanup` | One `remove-worktree` operation, `satisfied/no-worktree`, or a `would-refuse` state. |
| 8 | `branch-cleanup` | One `delete-branch` operation, or a satisfied/refused state. |
| 9 | `merged-diff-sweep` | One bounded added-line read; attributed markers become resolved evidence, ambiguous hits become residue, or the step is a gap. |
| 10 | `retro-coverage-move` | One idempotent `capsule.retro-coverage` event, or a gap when the registry is unreadable. |
| 11 | `session-compaction` | One idempotent `capsule.compaction-checkpoint` event, a no-sessions no-op, or an attribution gap. |
| 12 | `capsule` | Read-only pre-flight; promotion decisions and exactly one terminal close in apply; `would-refuse` for an invalid capsule. |

Label operations follow the declared disposition order, dependents are ordered by provider entity identity, threads are ordered by thread identity, and diff hits are ordered by file path, added-line position, then marker kind. Each operation carries canonical arguments, a provider target, an engine identity (`git` for the local steps, the provider instance name otherwise), and an operation identity. No wall-clock time, randomness, API return order, or hash-map iteration order participates in the plan. Plan and apply compute the same plan; apply may reuse persisted terminal outcomes and execute only pending operations.

#### Operation identity and idempotency ledger

Every operation identity is a SHA-256 digest over canonical JSON (sorted keys, no insignificant whitespace) of the declared identity inputs: workspace identifier, work-item ref, engine, adapter capability context, operation name, canonical arguments, and provider target. The capability context is the adapter's declared `supported` posture or its gap reason for that operation, so a gap that later becomes supported produces a new identity instead of being permanently blocked by an old gap record.

On apply, the engine reads the persisted closeout history through a verified state read and folds it: the first terminal outcome per operation identity is authoritative. A terminal outcome (`applied`, `satisfied`, `skipped-gap`, `skipped-noop`) is reused without re-executing. A persisted `failed` record is retained as evidence but is not terminal; a re-run re-observes provider state, records `satisfied` when the effect already landed, and otherwise retries. Every closeout write is idempotent by construction (set done, add/remove a named label, clear assignee, add/remove a named label on a dependent, resolve a named thread, restore checkout, delete a named local branch), so a retry after an unknown outcome is safe. A crash between a provider effect and the ledger append converges on the next run as `satisfied`.

The ledger uses one additive record kind, `closeout.operation`, with payload schema `delivery.closeout.operation.v1`, under the store-scoped key prefix `closeout.operations:`. Each record carries the operation identity, work-item ref, engine, capability context, operation, canonical arguments, provider target, outcome, optional reason, bounded evidence, and an injected-clock timestamp. Each append serializes only that new record; the event history is folded from the ledger's verified records on read, so storage grows linearly with the number of operations. A record is admitted only after its operation identity, field types, closed outcome/step vocabularies, canonical argument shape, target, and evidence entries validate; a malformed or unknown value is a classified state error, never silently dropped. Apply acquires one single-writer fence, appends one record per attempted operation outcome through the fenced port, and releases the fence in a `finally` block. An absent per-work-item history is verified-empty and read as an empty history; torn or malformed ledger state is a classified `state.*` failure, never zeros.

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

#### Merged-diff owed-flip sweep

A separate detection-only step reads the merged change's introduced lines once, anchored to the verified merge transaction's squash SHA and its parent. The production composition resolves the latest verified `merge.transaction` with `result=merged` for the work item and performs one bounded read through the `./git` seam: fixed argv `git diff --no-color --unified=0 <squash>^ <squash>`, no shell string, no force, no remote, and no source edit; a 30 s timeout; a max buffer of the 1 MiB diff cap plus 64 KiB; and truncation at 1 MiB. The sweep counts files from the `diff --git` headers and the changed-file cap is 500, with 200 hits. A truncated read records the bound and the omitted count. When no merge transaction, no resolvable diff, or no diff capability is available, the step is `skipped-gap` with `merged-diff-unavailable` evidence and performs no guess.

The marker vocabulary is closed contract data with four kinds and a fixed kind-to-action mapping:

| Marker kind | Owed action |
|---|---|
| `todo-marker` | `close-todo` |
| `when-merges-note` | `remove-guard` |
| `feature-flag` | `retire-flag` |
| `class-string` | `rename-class` |

A hit is **resolved** only when its line names this work item and the marker's declared contract-data action is one of the four closed tokens and equals the kind's mapped action. The sweep reads an action token only from the marker's declared segment (from the marker pattern onward) or from an explicit `@action:<token>` context; ordinary hyphenated prose such as `retry-policy` never suppresses resolution. It becomes an idempotent `closeout.step` evidence event keyed by file path, a SHA-256 content hash of the trimmed added line, marker kind, and work-item ref; the payload's `lineHash` is that content hash, never a line number. A hit is **ambiguous** when it names no work item or another work item, when its declared action is outside the four tokens or does not match its kind's mapping, when it carries a recognized token that differs from the declared action, or when an explicit `@action:<token>` names an unknown token (`out-of-vocabulary-action`). Ambiguous hits carry `ambiguous-flip-hit` residue with a bounded `file:line` location. The plan carries the bounded ambiguous-hit locations, so plan mode renders the same residue before apply.

The sweep never edits a source file, removes a marker, commits, or pushes. "Resolved" means the owed action is attributed and recorded, not code-rewritten. A re-run re-detects the same diff, appends no duplicate resolved event, and re-emits the same deterministic residue. The merge transaction is described in [Merge and Verify Deploy](feature-merge-verify-deploy.md).

#### Review-thread resolution

The engine resolves unresolved review threads on the merged delivery request with an authorship gate. The merged request is resolved by a bounded source-ref lookup; because the REST pull-request list does not carry threads, the GitHub adapter re-reads the selected pull request's `reviewThreads` through GraphQL. The read requests the root comment author (login and actor type) and its author association for each thread. `DeliveryThread` carries `authorLogin`, `authorKind`, and `authorAssociation`. Normalization maps `User` to `human`, `Bot` and `App` to `non-human`, and `Mannequin` or an absent/unrecognized author to `unknown`. An unknown author is treated as human (fail-closed), so a Mannequin placeholder is never resolved. Production `planFacts` supplies one author fact per thread; an absent signal is `unknown`. Threads are processed in deterministic identity order, skipping already-resolved threads.

Each unresolved **non-human** thread yields one `resolve-delivery-thread` operation with canonical `{ deliveryRequest: <identity>, threadId: <id> }`. The GitHub adapter uses the GraphQL `resolveReviewThread` mutation behind the existing injected transport and only reports success when the provider asserts `isResolved: true`; a mutation response that still reports the thread unresolved is a classified write failure.

Each unresolved **human or unknown** thread is never resolved; there is no resolve-all fallback. It becomes an `unresolved-human-thread` residue item carrying the thread identity, the author principal, and a bounded `thread:<id>` location; the item never carries a comment body, title, subject, or review prose. Because the result contract permits exactly one of `data` or `error`, a run that ends in a command-level failure emits no structured residue and reports the refused or preserved items through the failed step's bounded evidence and the human diagnostic stream instead; the same residue remains assertable in plan mode for the same facts.

When the merged delivery request is not observed (no merged request), the step is `skipped-noop` with `no-delivery-request` evidence and is not a failure. When the merged request is observed but its thread read failed, `signals.threads` is `unavailable` and the step is `skipped-noop` with `thread-signal-unavailable` evidence, never satisfied. When the provider has no delivery-request or thread-resolution surface (Jira), the step is `skipped-gap` with `provider-unsupported`, and no residue is fabricated. Resolution is capped at 100 unresolved threads per delivery request; a truncated run records the bound, and a re-run continues because resolved threads are excluded. Human-thread residue beyond the 50-item bound is truncated with an additional `+N` sentinel item that is not counted toward the cap, and none beyond the cap is resolved. A thread-resolution write failure returns `closeout.write.failed`; completed outcomes are persisted and a retry converges.

#### Checkout restore

The restore target is the merged delivery request's target ref; when no merged request is observed, the fallback is the pinned v1 integration base `main-tools`. The integration base is compiled contract data, not a configuration key; an installed project whose integration branch differs relies on the merged request's target ref (the normal path). The resolved base is recorded in the plan and output.

- The current checkout is classified as already at the base, on the delivery branch, detached at the delivery head, unrelated, or missing.
- Already at the base is `satisfied` with zero switch. An unrelated checkout is `satisfied` with `already-elsewhere` evidence and is never hijacked.
- On the delivery branch or detached at the delivery head, the engine restores the base only when the worktree is clean and the base ref resolves locally. A dirty worktree, missing base ref, or missing checkout is a safety refusal.
- A safety refusal attempts no destructive action, deletes no branch, and makes apply return `closeout.branch.unsafe`.

#### Local worktree cleanup

`worktree-cleanup` removes a delivery-owned local worktree only when the full safety predicate holds. The production composition supplies the facts through the `./git` seam: `worktree list --porcelain` lists local worktrees, `rev-parse --show-toplevel` identifies the current checkout, and `-C <path> status --porcelain` checks cleanliness; removal is a fixed-argv, no-shell, local-only invocation with no force flag. Immediately before the destructive argv the seam re-reads the worktree head and cleanliness and refuses with `closeout.branch.unsafe` if the head no longer equals the planned `expectedHead` or the worktree became dirty or unreadable. The operation records under the local `git` engine with the supported capability context, so its identity does not depend on provider capabilities. A git refusal is a refusal, never a forced fallback. The step runs before branch cleanup so a delivery worktree no longer holds the branch when branch deletion evaluates its predicate, and the composition excludes the delivery's own worktree from the foreign-worktree check for that branch.

The predicate requires: the merged delivery request is observed merged; the worktree follows the delivery branch convention and its checked-out branch matches; the merged head and the worktree head are both known and exactly equal; the worktree is clean; it is not the current checkout; it is not locked and not referenced by another worktree; checkout restore succeeded when required; and no earlier non-gap step failed.

An absent worktree is `satisfied` with `no-worktree` evidence. A failing predicate performs no removal and renders `would-refuse` with `closeout.branch.unsafe` in plan mode; its bounded detail names the retained worktree count, path, head, and failing condition. In apply mode the refusal makes the command return `closeout.branch.unsafe` with the same retained-worktree facts in the error summary and no structured residue; the same `worktree-retained` residue is assertable in plan mode for the same facts. The worktree is always preserved on a refusal. A re-run after removal is `satisfied/no-worktree` and never removes twice.

The planner consumes the read-only worktree facts (`present`, `safe`, `path`, `head`, `branch`, `reason`). The predicate itself is the pure `evaluateWorktreeSafety` function.

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

#### Retro coverage

`retro-coverage-move` reads the delivered retro registry through its validated read surface and determines whether the work item already has a `retro.run` record at level `change`. The production `planFacts` performs the registry read and derives `collected`/`pending`; an injected retro fact overrides it for tests. It writes no registry record and adds no mode value. Instead it appends one idempotent `capsule.retro-coverage` event with payload `{level: "change", state: "collected" | "pending", runId?}` and reports the state in the step detail. A re-run appends nothing for the same work item and level. An unreadable registry makes the step `skipped-gap` with `retro-registry-unavailable` evidence, adds a `retro-coverage-unavailable` residue item, and lets the rest of closeout proceed; a validated registry with no matching run is `pending`, not a gap. The registry remains the authority for retro selection; the capsule records coverage at close. See [Retro Evidence Pipeline](feature-retro-pipeline.md).

#### Session compaction

`session-compaction` records the pre-compaction checkpoint for the delivery's attributed sessions. The production composition attributes sessions through the configured harness store: the opencode extractor reads the configured database with a work-item root, or the Claude Code reader derives the session tree from the configured session directory. An injected `sessions` value overrides the derived facts for tests. The step consumes an availability flag, bounded session identities, the last verified commit, the working-state and event-log flushed flags, the unresolved-question count, and an optional counted truncation at 64 sessions.

An empty store, or a store with no sessions attributed to the delivery, is `skipped-noop` with `no-sessions` and writes no zero checkpoint. When sessions are attributable, the step appends one `capsule.compaction-checkpoint` event carrying the bounded identities or counted truncation, the session count, the flushed flags, the unresolved-question count, the last verified commit, and the declared gap `harness-compaction-unavailable`. An unavailable store or a store whose sessions cannot be attributed to the delivery is `skipped-gap` with `session-attribution-unavailable`, adds a `session-attribution-gap` residue item, and guesses nothing.

The harness context-compaction invocation is a declared capability gap: no adapter surface exists, and closeout invents no API. The checkpoint event key derives from the sorted session-id set plus the last verified commit, so a changed session set or commit appends a new checkpoint and an identical re-run appends nothing. The `db` command family is unchanged: no subcommand or field is added, and `db list` remains a metadata administration surface with no work-item attribution.

#### Capsule validation, promotion, and close

The terminal `capsule` step runs the memory-consolidation ceremony for the change capsule. The capsule is the existing change folder plus `events.jsonl` and `candidates/`; its artifact contract, producers, candidate schema, and promotion rules are specified in [Change Capsule](feature-capsule.md).

Validation is a read-only pre-flight computed in both modes before any effect. It resolves the unique change folder, parses `events.jsonl` fully (no torn tail, CRLF, malformed line, non-contiguous sequence, duplicate event key, invalid kind/writer/payload, first event other than `capsule.opened`, or line after `capsule.closed`), enumerates `candidates/` under its count and size caps, enforces `<id>.yaml` naming, validates every candidate schema, checks that every candidate has exactly one durable promotion decision (zero or multiple is invalid), and resolves promotion path confinement. An invalid capsule renders the capsule step `would-refuse` with `closeout.capsule-invalid` in plan mode and returns `closeout.capsule-invalid` in apply mode before any provider write, git mutation, or state append, with zero promotion writes and zero effects. A confinement failure uses `closeout.step.capsule.failed`. Plan mode performs zero appends, zero promotion writes, and zero promotions.

A change folder with no capsule events is a pre-contract capsule. Apply creates `events.jsonl` and `candidates/`, appends `capsule.opened` and one `capsule.backfill-gap` with `state: "pre-contract"`, and proceeds; absence is not an error. Readable `code-review/review-iter-*.yaml` artifacts are ingested as `review.verdict` events keyed by iteration; an artifact whose `iteration:` or `status:` line cannot be read is `review-verdict-unreadable` residue, not capsule damage.

The step cross-checks the capsule against the durable state records: every `phase.transition`, `commit.telemetry`, and `merge.gate-verification` record for the change yields an expected capsule event key, and a missing expected event is `capsule-event-gap` residue, not an invalid capsule.

Candidates are evaluated once per candidate in sorted file order. A candidate that already carries a durable promotion decision is skipped so a re-run appends nothing. Each decision is appended as one `capsule.promotion` event keyed by candidate id. Accepted `lesson` and `tacit` candidates are home-written to the injected memory root as one record file plus one index row; accepted `fact`, `decision`, `norm`, and `workflow` candidates record a sanctioned handoff without editing the home; `preference` and `fleet` are rejected with their declared reasons. The applied payload projects each decision as `{id, decision, home?, reason?}`.

A closeable capsule receives exactly one terminal `capsule.closed` event carrying `{decisionCounts: {promoted, rejected}, eventCount, digest}`; the digest is lowercase SHA-256 over the canonical JSON of the pre-close event payloads. An already-closed capsule is `satisfied` with no second close. The applied payload carries `capsule: {closed, events, candidates[]}`.

#### Queue removal on landing

Apply mode retires the change's queue entry with reason `landed` once the merged delivery request is observed. The removal is not a plan step: it runs after the closeout's writes have completed, inside the single-writer fence the transaction already holds, and it shares the scheduling engine's reason-bearing removal seam through the transaction's own fence handle, so it acquires no second fence and adds no write location. The step inventory, every step outcome, and the command's exit code are identical with and without the hook.

The outcome is disclosed in one additive non-step `data` block, `queueRemoval`:

| Field | Contract |
|---|---|
| `outcome` | `removed`, `would-remove`, `satisfied`, or `skipped`. |
| `ref` | The canonical work-item ref; absent only when the ref itself is not canonical. |
| `reason` | `landed`, present only when the removal was recorded. |
| `skipReason` | Present only on `skipped`: `no-merge-truth`, `lease-held`, `state-unavailable`, or `ref-not-canonical`. |

- **When it runs.** Only with `--apply`, only after the merged delivery request is observed, and only when the ref's queue entry is present and no live lease holds its repository. Plan mode reads the same facts and reports `would-remove`, `satisfied`, or `skipped` without appending anything.
- **Idempotent.** A re-run over an already-removed ref, and a closeout for a ref that never entered the queue, both report `satisfied` at exit `0` with zero appends. The explicit `queue remove` verb is not idempotent; the automatic path must converge, because closeout is a re-runnable transaction.
- **Fail-open.** No merge truth, a live lane lease, unreadable queue state, or a non-canonical ref reports `skipped` with its closed reason and appends nothing. A skipped removal never changes a step outcome, the summary counts, or the exit code; the lease case is the normal one for a change still being dispatched.
- **Append-only.** A recorded removal is one `queue.removal` record, preceded by the delivered `queue.park` withdrawal record (`recoveryState: released`) when the entry had an active park. Nothing is deleted, and the scheduling engine's append-position presence rule makes the entry absent from every queue read and from the derived graph document.
- **Bounded cost.** At most one queue fold and two appends are added to an apply, and at most one read when no entry exists.

#### Judgment residue and exit semantics

The transaction reports a bounded `residue[]` of `{item, kind, location}` items. The `kind` vocabulary is closed: `unresolved-human-thread`, `ambiguous-flip-hit`, `capsule-event-gap`, `review-verdict-unreadable`, `retro-coverage-unavailable`, `worktree-retained`, `session-attribution-gap`, and `capsule-cap-reached`. Items are deduplicated by `(kind, location, item)`, then ordered by kind order then location. The list holds at most 50 real items; when items are omitted, an additional `capsule-cap-reached` sentinel item (`+N more items`, location `residue`) is appended and is not counted toward the 50-item cap. No item contains a comment body, title, transcript, credential, or free-form prose.

Plan mode renders the planned residue (machine data and the human `JUDGMENT RESIDUE` section) and exits 0 unless a hard plan failure occurs. Apply mode returns `data` with the residue and exits 1 through the additive `attention` projection class when residue remains on a run that completes without a command-level failure; the scripted success line is unchanged. A command-level failure returns the error envelope and emits no structured `residue[]`; the failed step's bounded evidence and the human diagnostic stream name the refused or preserved items, and the same residue remains assertable in plan mode for the same facts. A step failure uses the delivered classified identity where one exists, or `closeout.capsule-invalid` for capsule content damage, or the `closeout.step.<id>.failed` family row for another capsule-step failure. Exit literals exist only in the CLI projection module.

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

The merged delivery request is resolved by a bounded source-ref lookup that returns merged requests whose source ref follows the branch convention for the work item; the REST list's non-null `merged_at` timestamp is merge truth. Deterministic selection picks the request with the highest numeric provider entity identity; non-numeric identities compare lexically. The selected request's review threads are then read through GraphQL. When no merged request is found, delivery-request-dependent steps skip with `no-delivery-request` evidence and the checkout base falls back to the integration base.

`DeliveryRequest` carries an additive optional `headSha`: the provider-resolved head commit of the merged request, copied verbatim. Absent means unknown, never a guessed or derived value. GitHub normalizes the pull-request head SHA and GitLab normalizes the merge-request SHA when present; a provider that cannot supply it leaves it absent and branch cleanup refuses. The lookup and the field use the existing injected transport and credential port; no new network runtime location is introduced.

#### Read observation

Closeout-relevant work-item reads return a discriminated `CloseoutReadObservation`:

- `observed` — the provider asserted the entity or signal; an empty collection means none. The observation may carry `signals` with per-signal availability for labels, relations, and merged-request threads.
- `not-found` — the provider explicitly reports that the entity does not exist (HTTP 404).
- `unavailable` — the provider has no work-item read surface (for example GitLab) or the read cannot produce a value. An omitted label or relation container is not `unavailable`: it is an `observed` read whose `signals` mark that container unavailable. A merged request whose GraphQL thread read failed is likewise `observed` with `signals.threads: "unavailable"`.
- `invalid` — the payload or parse failed, or the HTTP read failed with an authentication, transport, or server error (any non-404 non-2xx response). HTTP 401/403/500 are therefore `invalid`, never a false capability claim.

The bounded reverse-dependent read uses the separate `CloseoutReverseDependentObservation` with the closed set `CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS`: `observed`, `no-surface`, `not-found`, `unavailable`, and `invalid`. `no-surface` is an absent surface and maps to a provider-level gap; `unavailable` is an existing surface whose current read failed. The distinction keeps an absent dependency surface from being reported as a signal-level skip.

A target work-item read maps `not-found` to `closeout.target.unobserved`, `unavailable` to a declared gap for ticket-dependent steps, and `invalid` to the adapter-local `provider.payload.invalid` while preserving a carried credential/config identity such as `config.credential.missing`. An observed read's availability signals make an unavailable label signal never an empty label set and an unasserted relation array never an empty blocker set. The observation is an adapter-I/O refinement: it adds no closed operation, no core primitive-port field, and no schema-version bump.

#### Output and evidence

Machine mode returns one `CommandResult` envelope whose `data` is a bounded `delivery.closeout.v1` payload: schema id, command `closeout`, work-item ref, mode (`plan` | `applied`), resolved base ref, optional bounded delivery-request summary (system, entity, refs, optional `headSha`), ordered steps with operations, outcomes, and an optional bounded `detail`, a summary count by outcome, truncation markers, the ledger key, an optional `telemetryCapture` disclosure, an optional bounded `residue[]`, an optional applied `capsule {closed, events, candidates[]}`, and an optional non-step `queueRemoval` block.

The schema id stays `delivery.closeout.v1`. `residue`, `capsule`, `queueRemoval`, and the step `detail` are additive optional fields; no field is removed or renamed. Consumers must resolve steps by `stepId` and tolerate unknown step ids and the additive fields. The `queueRemoval` block is machine data: the human digest renders the same steps, residue, and capsule summary and adds no queue line.

Plan mode uses `would-apply`, `satisfied`, `skipped-gap`, `skipped-noop`, and `would-refuse`. Apply mode uses `applied`, `satisfied`, `skipped-gap`, `skipped-noop`, `failed`, and `refused`. Human mode renders a deterministic digest from the same data without extra reads. When residue is present the digest includes a `JUDGMENT RESIDUE` section with one bounded line per item (`kind`, item, location, including the `+N` cap item), and an applied run with a capsule result includes a `capsule: closed=<bool> events=<n> candidates=<n>` summary line. The digest stays inside the human line and byte bounds.

Output is bounded at 64 KiB machine payload, 200 human lines, and 16 KiB human text, with every byte bound measured as UTF-8 bytes (multibyte characters count by encoded length, not UTF-16 code units), and deterministic truncation that drops trailing operations/evidence first and records the marker. Output never contains comment bodies, titles, raw provider payloads, credentials, environment values, command arguments, or free-form prose. Evidence names operations, provider targets, counts, refs, label names, outcomes, and classified reasons only. The single serialization redaction chokepoint covers machine and human output.

#### Harness session telemetry capture

When the composition provides a telemetry capture, apply mode runs it after the terminal
steps and before the applied payload is returned. The capability exposes two
operations: `extract` reads the configured harness store read-only and returns
one harness-neutral capture shape of one record per captured session group;
`append` writes the additive `harness.telemetry` records through the fenced state
port. The applied payload carries an optional `telemetryCapture` disclosure with
captured, degraded, and failed counts, closed warning reasons (a group truncation
surfaces as a `truncated` warning carrying the omitted-group and cap counts), and
the session truncation mark when one applies.

Capture is non-gating. An extraction or append failure changes no step outcome,
summary, or command verdict; the failure is disclosed in the counts and warning
reasons, and the closeout result is otherwise unchanged. A failed capture writes
no zero-valued record. Session-group capture is idempotent by (work item, run,
session, agent, model) and the capture outcome by (work item, run): a re-run
appends nothing already captured. Plan mode performs no
extraction and no telemetry append, preserving its zero-write, zero-append, and
zero-fence contract.

The production closeout composition constructs the capture from the resolved
typed harness settings when they are supplied: the opencode extractor over the
configured database or the Claude Code reader over the configured session
directory, appended through the state `harness.telemetry` writers for the
session-group records and the run-scoped capture outcome. An injected
`CloseoutComposition.telemetry` runtime overrides the constructed capture for
tests. Apply runs extraction after the terminal steps and before the applied
payload; plan performs no extraction and no append. The state-layer
`harness.telemetry` records remain the only source
`spend` reads, and the capsule stream carries no statistics. The extraction and
record contract is specified in
[Harness Adapters](feature-harness-adapters.md) and [State Layer](feature-state-layer.md).

#### Failure identities and exit projection

The feature adds one domain kind, `closeout`, five concrete rows, and one open-slot family row to the existing error table. It reuses the existing projection classes, adds the data-bearing `attention` class, and introduces no exit literals outside the CLI projection.

| Code | Category | Retryable | Consequence | Projection | Meaning |
|---|---|---|---|---|---|
| `closeout.target.unobserved` | user | false | not_landed | user-validation | The target work item was not observed (provider not-found). |
| `closeout.target.ambiguous` | user | false | not_landed | user-validation | More than one closeout target matched. |
| `closeout.write.failed` | transient | true | unknown | platform-provider | A closeout provider write did not land. |
| `closeout.branch.unsafe` | user | false | not_landed | user-validation | Branch, checkout, or worktree cleanup was refused for safety. |
| `closeout.capsule-invalid` | user | false | not_landed | user-validation | The change capsule is damaged and no promotion write landed. |
| `closeout.step.<id>.failed` | user | false | not_landed | user-validation | A closeout step failed; the slot must name a declared `CLOSEOUT_STEP_IDS` member (for example `closeout.step.capsule.failed`). |

Declared gaps are data outcomes, never error rows. State, config, input, and credential-resolution failures reuse their delivered identities. The adapter-local `provider.payload.invalid` is a distinct recognized identity for a malformed payload or an authentication/transport/server failure on a non-404 read; it is not an error-table row and is never used for an explicit provider not-found. A busy capsule lock is the retryable `state.lock.busy`, never `closeout.capsule-invalid`. In plan mode a checkout, worktree, or branch safety refusal is rendered as `would-refuse` plan data, and a branch ambiguity renders the `would-refuse` branch step for inspection; apply returns `closeout.branch.unsafe` or projects `closeout.target.ambiguous` before any mutation. A target not-found or an invalid target payload fails the command in both modes.

Exit codes remain only in the CLI projection: `user-validation` → 1, `platform-provider` → 2, `attention` → 1, success → 0. The `attention` class is data-bearing: apply returns a success envelope with `data.residue[]` and exits 1 when residue remains and no command-level failure occurred. The documented table and the machine table are bidirectionally synchronized.

#### Read-only command isolation

The git branch/checkout seam is a dedicated adapter I/O subpath behind a port. It is not the existing read-only repository metadata reader, and the read-only reader gains no spawn surface. `status`, `queue ready`, and `verify change` continue to consume only the read-only repository reader, read-only provider clients, and verified state reads. They do not import or compose the git cleanup seam, the closeout engine, or provider write operations. Boundary rules and negative fixtures prove the isolation, and their zero-write/zero-spawn tests remain green.

### 3.2 User Flows

**Plan (default).** Resolve config, provider instance, read credentials, work item, merged request, base ref, local branches, local worktrees (listed, current, and clean), the recorded merge transaction's bounded diff, the retro-coverage state, the harness-derived session attribution, and the capsule pre-flight; read persisted closeout history through a verified read; compute the twelve-step plan and canonical arguments; evaluate the checkout, worktree, and branch safety predicates and the candidate plan; read the queue-removal facts and report `would-remove`, `satisfied`, or `skipped` without appending; render the plan with any planned residue; exit 0 with zero writes, git mutations, state appends, capsule appends, promotion writes, telemetry appends, or fence acquisitions.

**Apply.** Validate the capsule read-only before any mutation; acquire the single-writer fence; read history and fold terminal outcomes; execute the ordered steps, reusing terminal outcomes and appending each outcome; provider steps run in order, then checkout restore, worktree cleanup, squash-safe branch cleanup, the merged-diff sweep, retro coverage, session compaction, and the capsule close; after those writes and still inside the fence, run the queue-removal hook; release the fence; extract and append the harness session statistics from the constructed capture without changing any step outcome; render the applied summary including the `queueRemoval` block. The run exits 0 when no residue remains, exits 1 through `attention` when data carries residue, and returns the classified error envelope on a command-level failure.

**Capsule close and promotion.** Validate the capsule; complete a pre-contract folder with `capsule.opened` and `capsule.backfill-gap`; ingest readable review verdicts; evaluate every candidate against the capture bar and evidence link; home-write accepted lessons/tacit with one index row; record sanctioned handoffs; reject preference/fleet and unsupported candidates with declared reasons; append one `capsule.promotion` event per decision and one terminal `capsule.closed` event; report the closed state and per-candidate projection.

**Human review thread.** A non-human thread resolves as delivered; a human or unknown thread stays unresolved and is reported as identity-only `unresolved-human-thread` residue, so apply exits 1 with attention while the thread remains open.

**Merged-diff sweep.** One bounded added-line read detects the four marker kinds; a marker naming this work item with the kind's mapped action is recorded as resolved evidence; an unattributed, other-work-item, or kind-mismatched marker becomes `ambiguous-flip-hit` residue; no source file is edited.

**Landing removal.** After an apply run's writes, an observed merged delivery request and a present queue entry with no live lease make the transaction append one `landed` removal (plus the park withdrawal when the entry was parked) and report `outcome: "removed"`; a re-run or a ref that never entered reports `satisfied`; no merge truth, a live lease, unreadable state, or a non-canonical ref reports `skipped` with its closed reason. No step outcome or exit code changes in any of these cases.

**Worktree cleanup.** A worktree satisfying the full predicate is removed locally with fixed argv and no force; an absent worktree is satisfied; a failing predicate retains the worktree and makes apply return `closeout.branch.unsafe` with the retained facts in the error summary, while plan shows `would-refuse` and `worktree-retained` residue.

**Retro coverage and compaction.** Retro coverage records the registry's `collected` or `pending` state as a capsule event and writes no registry record; an unreadable registry is a declared gap plus residue. Session compaction records the bounded pre-compaction checkpoint and declares the harness-compaction invocation a gap; no sessions is a no-op, and unattributable sessions are a gap plus residue.

**Re-run after restart.** Recover or acquire the fence; read history; reuse every terminal outcome; reuse every capsule event key and promotion decision; re-observe provider state only where no terminal outcome exists or a prior outcome failed; perform zero duplicate mutations; render converging terminal outcomes and the same deterministic residue.

**Declared capability gap.** On a GitLab-hosted change, provider steps become `skipped-gap` with reasons; checkout restore, worktree cleanup, and local branch cleanup still run from read evidence; the transaction succeeds with a gap summary and exit 0.

**Safety refusal.** Provider steps execute and persist; checkout restore refuses on a dirty worktree; worktree cleanup and branch cleanup are skipped and their targets retained; apply returns `closeout.branch.unsafe` with exit 1. After the operator cleans the worktree, a re-run reuses completed outcomes and finishes.

**Ambiguous branch.** Plan mode renders the branch step as `would-refuse` with `closeout.target.ambiguous` so the operator can inspect the ambiguity; apply projects `closeout.target.ambiguous` before any mutation and deletes nothing.

**Provider write failure.** Completed provider writes persist; the failed operation is recorded; remaining steps stop; a safe local checkout restore still runs; branch deletion is skipped because a transaction operation failed; apply returns `closeout.write.failed` with exit 2 and no structured residue. A re-run re-observes and retries safely.

**Invalid capsule.** Plan mode renders the capsule step `would-refuse` with `closeout.capsule-invalid`; apply returns `closeout.capsule-invalid` before any mutation with no promotion write. A busy capsule lock is instead the retryable `state.lock.busy`.

**Target not observed.** An explicit provider not-found returns `closeout.target.unobserved` with exit 1 and zero writes; a malformed payload or a non-404 authentication/transport/server failure surfaces as `provider.payload.invalid`; a provider without the work-item read yields a declared gap for ticket-dependent steps.

### 3.3 Edge Cases & Error Handling

- A second writer fails on fence acquisition with the classified `state.*` identity; no mutation is attempted.
- A torn or malformed ledger is a classified `state.*` failure, never a zeroed history.
- A state append failure stops execution and returns the classified state failure; the fence is still released.
- An unsupported operation can never be reported as applied or satisfied.
- An ambiguous local branch selection is a `would-refuse` plan step; apply returns `closeout.target.ambiguous` and deletes nothing.
- A protected ref is never deleted; the step records the protected state instead, and the git seam rejects a protected ref directly as defense in depth.
- A dirty worktree, missing base ref, foreign worktree, moved branch head (including one that moves after planning and is re-checked immediately before deletion), unknown merged head, or earlier non-gap failure refuses deletion and preserves the branch.
- A worktree that is dirty, moved, current, locked, foreign, restored into a failed checkout, or preceded by a failing step is never removed; the retained facts stay in plan residue or the failed-step evidence.
- A busy capsule lock is `state.lock.busy` and retryable; it never makes the capsule invalid.
- A capsule line after `capsule.closed`, a duplicate event key, a sequence gap, a torn tail, a malformed line, an invalid payload, or a first event other than `capsule.opened` refuses the append and close; the file is never repaired.
- A candidate file that is not named `<id>.yaml` or whose stem differs from its id is `closeout.capsule-invalid` before any home write; plan mode renders `would-refuse`.
- A candidate schema failure refuses the capsule step with `closeout.capsule-invalid` and performs no promotion write; an empty basis or evidence is a candidate rejection, not capsule damage.
- A candidate with zero or multiple promotion decisions is `closeout.capsule-invalid` before the terminal close; plan mode renders `would-refuse`.
- An invalid capsule is refused in pre-flight before any provider write, git mutation, or state append, so it produces zero effects.
- A promotion home outside the memory root is `closeout.step.capsule.failed` with zero writes; plan mode renders `would-refuse`.
- A missing expected capsule event is residue, never capsule damage.
- A re-run appends no duplicate capsule event, promotion decision, thread resolution, branch deletion, worktree removal, or telemetry record, and appends no second queue removal.
- A queue removal with no observed merge is skipped with `no-merge-truth`; a live lane lease skips it with `lease-held`; unreadable queue state skips it with `state-unavailable`; a non-canonical ref skips it with `ref-not-canonical`. Each leaves the entry in place and changes no step outcome or exit code.
- An already-removed entry and a ref that never entered the queue both report the queue removal as `satisfied` at exit 0, so a converging re-run never fails on work it already did.
- Output over the machine or human bounds is truncated deterministically with a marker; payload shape never changes. The human digest renders the bounded `JUDGMENT RESIDUE` section and capsule summary without an extra read.
- Residue over the declared cap is truncated to 50 real items with an additional `+N` `capsule-cap-reached` sentinel item that is not counted toward the cap; no item contains a body, title, transcript, or credential.
- Residue is deduplicated by `(kind, location, item)` before ordering and capping, so a fact produced by both the plan and an apply branch appears once.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

The closeout feature follows the delivered tier split. The runtime-neutral contracts tier declares the plan, step, operation, outcome, work-item and reverse-dependent observations, ledger, residue, capsule projection, and runtime types plus `as const` data. The pure domain tier computes plan step expansion, canonical operation arguments, SHA-256 identity, outcome folding, summary, output bounding, the merged-diff classification, the thread-authorship policy, the worktree predicate, residue ordering, and the apply orchestration over injected runtimes. The capsule's pure rules and candidate evaluator live in the same domain tier. The state tier implements the `closeout.operation` ledger over the existing fenced state port. Provider adapters implement closeout-relevant reads and writes behind their existing subpaths. A dedicated `adapters ./git` subpath owns local checkout, branch, worktree, and bounded merged-diff I/O; the file adapter owns capsule append and promotion home writes; the harness adapters own the read-only telemetry extractors and session attribution. The CLI command layer validates grammar, delegates to the closeout engine, and returns data or a classified failure; the edge owns composition, rendering, and exit projection. `createCloseoutComposition` performs the production read orchestration (`planFacts`) once from the injected provider client, git seam, state store, capsule runtime, resolved harness settings, and injected retro facts; it derives worktree facts and the merged-diff read, constructs the telemetry capture from the harness settings, and lets `createConfigProgram` register the command from the raw composition. The real ledger is consumed through `createCloseoutStateRuntime` over `readCloseoutHistory` and `appendCloseoutOutcome`. No runtime API, network, clock, or randomness enters the contracts or pure domain tier.

### 4.2 Core Components & Directory Structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/closeout.ts` | `delivery.closeout.v1` vocabulary: step ids, outcomes, gap reasons, operation names, disposition and protected-ref data, bounds, plan/step/operation/data types, work-item and reverse-dependent observations (`CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS`), canonical argument unions, identity inputs, ledger payload type, provider/git/state runtime contracts, and the additive residue/capsule/detail/worktree/retro/session facts. Types and `as const` data only. |
| `packages/core/src/contracts/capsule.ts` | The capsule event envelope, closed event-kind/writer vocabularies, payload field sets, caps, candidate model, promotion routing/rejection vocabularies, residue kinds, and merged-diff marker/action data. |
| `packages/core/src/contracts/ports.ts` | The primitive ports; `DeliveryRequest` carries the additive optional `headSha`. |
| `packages/core/src/contracts/adapter-capabilities.ts` | The closed `ADAPTER_OPERATIONS` set including `resolve-delivery-thread`, and capability/gap types. |
| `packages/core/src/contracts/error-table.ts` | The `closeout` domain kind, five concrete rows, and the `closeout.step.<id>.failed` family. |
| `packages/core/src/domain/closeout.ts` | Pure planner, canonical JSON and SHA-256 operation identity, branch selection and safety predicate, outcome fold, summary, output bounding, residue dedupe/ordering, complete capsule pre-flight/close orchestration, apply orchestrator, and human renderer. |
| `packages/core/src/app/queue.ts` | The scheduling engine's reason-bearing removal seam (`removeQueueEntryWithinFence`) that the closeout hook shares its fence with, and the one total closeout-removal function (`queueRemovalForCloseout`) that maps merge truth, the folded queue, and lease liveness to the closed outcome. |
| `packages/core/src/domain/capsule.ts`, `capsule-candidates.ts` | Pure capsule parsing/serialization, event-key and digest derivation, review ingestion and gap detection, candidate validation and evaluation, and confined promotion planning. |
| `packages/core/src/domain/closeout-diff-sweep.ts` | The bounded detection-only merged-diff classification. |
| `packages/core/src/domain/closeout-thread-policy.ts` | The human-vs-non-human authorship policy and identity-only human-thread residue. |
| `packages/core/src/domain/closeout-worktree.ts` | The pure worktree safety predicate. |
| `packages/core/src/domain/sha256.ts` | Pure SHA-256 implementation used by the operation identity and capsule digest; no runtime import in the domain path. |
| `packages/core/src/state/closeout.ts` | `closeout.operation` append with post-append coverage verification, verified history read, store-scoped key, record validation (including `remove-worktree` canonical arguments), and first-terminal fold over the injected state port. |
| `packages/adapters/src/github/{client,normalize}.ts` | Issue/PR reads, `merged_at` merge truth, merged-request lookup with a GraphQL thread re-read, head normalization, bounded reverse-dependent read (`/dependencies/blocking`) with a `no-surface` observation, blocker relations from `/dependencies/blocked_by`, label/relation/thread availability signals, thread root-author normalization, label/assignee writes, issue close, GraphQL thread resolution, and discriminated work-item observation. |
| `packages/adapters/src/jira/{client,normalize,workflow-map}.ts` | Issue reads, bounded outgoing-`blocks` dependent search with a `no-surface` observation, label/relation availability signals, transition-id done selection, raw-label full-array replace with preservation, assignee clear, and discriminated work-item observation. |
| `packages/adapters/src/gitlab/{client,normalize}.ts` | Merge-request and pipeline reads; merged-head normalization when present; no writes. |
| `packages/adapters/src/git/index.ts` | The dedicated branch/checkout/worktree/diff seam: fixed-argv, no-shell, local-only child processes with a 30 s default timeout, `SIGKILL`, and a bounded max buffer for the diff read; checkout facts, branch listing, ref resolution, cleanliness and worktree checks, `worktree list --porcelain`, `currentWorktreePath`, `isWorktreeClean`, bounded `readMergedDiff` over the recorded squash landing, local worktree removal with a pre-removal head/cleanliness re-check and no force flag, checkout restore, local branch deletion with a delete-time head re-check, and direct protected-ref rejection. |
| `packages/adapters/src/file/capsule.ts`, `change-folder.ts`, `memory-promotion.ts` | The append-only capsule runtime, the read-only change-folder resolver, candidate file reads with the `<id>.yaml` naming rule, and confined promotion home writes with memory facts. |
| `packages/adapters/src/harness/` | The read-only opencode/Claude telemetry extractors and harness-store session attribution consumed by the composition. |
| `packages/adapters/src/io/provider-transport.ts` | The shared injectable transport seam: `GET`, `POST`, `PATCH`, `PUT`, and `DELETE`, an optional serialized body, an optional per-request timeout, and the classified payload failure. |
| `packages/cli/src/commands/closeout.ts` | Command definition: canonical ref validation, `--apply` flag, one-ref positional rule, plan/apply delegation, the applied-residue `attention` exit projection, and human rendering hook. |
| `packages/cli/src/edge.ts` | `CloseoutComposition`, `CloseoutCompositionOptions`, `createCloseoutComposition`, `createCloseoutStateRuntime`, and `createCloseoutCommandRuntime`; `createCloseoutComposition` bridges raw GitHub/Jira/GitLab clients or an injected provider runtime, the real git seam, the `StateStorePort`, the capsule runtime, and resolved harness settings; its `planFacts` reads the work item, merged request (including thread root-author facts), dependents, checkout, branches, worktrees, recorded squash diff, retro registry coverage, persisted history, capsule pre-flight, and harness-derived session facts, and its telemetry capability is constructed from the resolved harness settings unless an injected runtime overrides it. |
| `packages/cli/src/classify.ts` | Classification chain plus the adapter-local `provider.payload.invalid` projection and the `closeout.step.<id>.failed` family slot resolution. |
| `scripts/checks/error-table-sync.ts` | Enforces the documented/machine table sync, recognizes `provider.payload.invalid` as an adapter-local identity with no table row, and validates the closeout step family slot against `CLOSEOUT_STEP_IDS`. |
| `.dependency-cruiser.cjs` | Admits `packages/adapters/src/git/` as the exact runtime-API confinement entry for the git seam. |

### 4.3 Key Classes & Functions

```ts
buildCloseoutPlan(facts: CloseoutPlanFacts): CloseoutPlan
deriveCloseoutOperationId(inputs: CloseoutOperationIdentityInputs): string
selectMatchingBranch(input): CloseoutBranchSelection
evaluateBranchSafety(input): CloseoutBranchSafetyVerdict
evaluateWorktreeSafety(input): WorktreeSafetyVerdict
evaluateDiffSweep({ diff?, workItemRef }): CloseoutDiffSweepResult
evaluateThreadPolicy({ threads? }): CloseoutThreadPolicyResult
foldCloseoutOutcomes(records): Record<string, CloseoutOperationRecord>
runCloseout(input: CloseoutRunInput): Promise<CloseoutRunResult>
queueRemovalForCloseout(store, input): CloseoutQueueRemovalData
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

The plan and output are bounded contract data. The durable record is one append-only `closeout.operation` record per attempted terminal operation under the store-scoped key `closeout.operations:<workItemRef>`; the payload schema is `delivery.closeout.operation.v1`. Each append payload is exactly one operation record; a verified read collects every ledger record under the key and folds the event history. The first terminal outcome per operation identity is authoritative; a failed record is retained but not terminal. The `queueRemoval` block is output only: the removal itself lands as one `queue.removal` record (plus a park withdrawal when needed) in the scheduling engine's queue ledger through the same fence, and closeout adds no queue ledger of its own. The telemetry capability (constructed from the harness settings, or an injected override) writes additive `harness.telemetry` records under the store-scoped record key per work item (one record per captured session group) and the capture key per run; those records are statistics and identity references only. The capsule events, candidate files, promotion records, and residue are file/output artifacts, not state-ledger records; the closeout transaction introduces no schema-version bump, migration, or derived document.

| Constant | Value | Rule |
|---|---|---|
| `CLOSEOUT_SCHEMA_ID` | `delivery.closeout.v1` | Machine payload schema identifier. |
| `CLOSEOUT_OPERATION_PAYLOAD_SCHEMA` | `delivery.closeout.operation.v1` | Ledger payload schema. |
| `CLOSEOUT_OPERATION_RECORD_KIND` | `closeout.operation` | Additive state record kind. |
| `CLOSEOUT_STEP_IDS` | twelve ordered ids | Binding plan order. |
| `CLOSEOUT_MAX_DEPENDENTS` | `200` | Owed-flip cap. |
| `CLOSEOUT_MAX_THREADS` | `100` | Thread-resolution cap per merged request. |
| `CAPSULE_MAX_RESIDUE_ITEMS` | `50` | Real residue item cap; the `+N` sentinel is additional. |
| `CAPSULE_MAX_DIFF_BYTES` | `1 MiB` | Merged-diff read cap. |
| `CAPSULE_MAX_DIFF_FILES` | `500` | Changed-file cap for the sweep. |
| `CAPSULE_MAX_DIFF_HITS` | `200` | Hit cap for the sweep. |
| `CAPSULE_MAX_SESSIONS` | `64` | Compaction-checkpoint identity cap. |
| `CLOSEOUT_OPERATION_TIMEOUT_MS` | `30_000` | Per-operation provider and git timeout. |
| `CLOSEOUT_MAX_MACHINE_BYTES` | `65_536` | Machine payload bound. |
| `CLOSEOUT_MAX_HUMAN_LINES` | `200` | Human output line bound. |
| `CLOSEOUT_MAX_HUMAN_BYTES` | `16_384` | Human output byte bound. |
| `CLOSEOUT_INTEGRATION_BASE` | `main-tools` | Pinned v1 fallback base; compiled data, not configuration. |
| `PROTECTED_REF_NAMES` | `main`, `main-tools`, `HEAD` | Base protected refs; the resolved base is added at plan time. |

The plan's step sequence is the declared `CLOSEOUT_STEP_IDS` order, and each step function owns its `stepId`; no positional re-mapping exists.

### 4.5 API & Interface Contracts

- **`closeout <workItemRef> [--apply] [--json]`** — CLI surface described in §3.1.
- **`CloseoutPlan` / `CloseoutStep` / `CloseoutOperation`** — runtime-neutral plan data; each step carries an ordered outcome, reason, operations, evidence, optional `detail`, and optional truncation; each operation carries an identity, name, engine, capability context, target, and canonical arguments. The plan may also carry a planned `residue[]`.
- **`CloseoutData`** — `delivery.closeout.v1` machine payload with plan/applied mode, base ref, optional delivery summary, ordered steps, summary counts, ledger key, optional `telemetryCapture`, optional `residue[]`, optional applied `capsule`, and optional non-step `queueRemoval` (`outcome`, optional `ref`, optional `reason`, optional `skipReason`).
- **`CloseoutQueueRemovalData`** — the additive queue-removal disclosure, with the closed outcome set `removed | would-remove | satisfied | skipped` and the closed skip-reason set `no-merge-truth | lease-held | state-unavailable | ref-not-canonical`.
- **`CloseoutOperationRecord`** — append-only ledger payload described in §3.1 and §4.4.
- **`CloseoutProviderRuntime`** — closeout-relevant provider reads and writes: `CloseoutReadObservation` work-item read, optional merged-request lookup, optional bounded reverse-dependent read returning `CloseoutReverseDependentObservation`, label/assignee write, done transition, and thread resolution.
- **`CloseoutGitRuntime`** — checkout facts, branch list/read, foreign-worktree and cleanliness checks, ref resolution, checkout restore, branch deletion whose optional `expectedHead` is re-checked immediately before deletion, optional `listWorktrees`, optional `currentWorktreePath`, optional `isWorktreeClean`, optional `readMergedDiff`, and optional `removeWorktree`.
- **`CloseoutStateRuntime`** — fence acquisition/release, append, and verified history read over the real `StateStorePort` ledger.
- **`CloseoutCapsuleFacts` / `CloseoutExpectedCapsuleEvent` / `CloseoutPromotionRuntime`** — the read-only capsule pre-flight facts, the expected events derived from durable state records, and the injected candidate/memory/write/preflight promotion runtime.
- **`CloseoutDiffRead` / `CloseoutDiffSweepResult` / `CloseoutThreadAuthorFact` / `CloseoutWorktreeFacts` / `CloseoutRetroFacts` / `CloseoutSessionFacts`** — the bounded inputs for the sweep, thread policy, worktree predicate, retro coverage, and compaction checkpoint.
- **`createCloseoutComposition(options)`** — builds the production composition from a raw provider source (`github`, `jira`, `gitlab`, or `declared`) or an injected provider runtime, an existing or constructible `GitBranchSeam`, a `StateStorePort`, an optional capsule runtime and memory root, resolved `HarnessSettings`, and injected retro facts. Its `planFacts` performs the read orchestration once, derives the worktree facts and bounded merged-diff read, derives session-attribution facts from the harness store, and reads retro coverage from the delivered registry; it exposes them through `sessionsFor`/`diffReadFor`/`retroFor` and constructs the telemetry capability from the harness settings unless `telemetry` overrides it. The engine then plans and applies over the bridge runtimes.
- **`createCloseoutStateRuntime(store)`** — bridges the fenced store to `appendCloseoutOutcome` and `readCloseoutHistory`.
- **`CloseoutTelemetryRuntime`** — the non-gating telemetry capability. The composition builds it from the harness settings; an injected runtime overrides it in tests. `extract({ workItemRef, runId })` returns a `HarnessResult<HarnessTelemetryCapture>`; `append(capture)` returns a state result carrying the appended and skipped counts.
- **`CloseoutTelemetryDisclosure`** — the bounded applied-payload disclosure under `telemetryCapture`: captured, degraded, and failed counts, closed warning reasons, and an optional session truncation mark.
- **`createCloseoutCommandRuntime(composition)`** — composes the pure plan and apply orchestrator over injected plan facts and runtimes.

## 5. Non-Functional Requirements

### 5.1 Security & Privacy

- **Mutation is opt-in.** Dry-run is the default; `--apply` is the only mutation switch. Plan mode performs zero provider writes, git mutations, state appends, capsule appends, promotion writes, and fence acquisitions.
- **Bounded write scope.** Writes target only the observed work item, its direct dependents, declared labels, the assignee clear, the merged request's named non-human threads, the matching local branch, the delivery-owned worktree, the change capsule, promotion homes under the injected memory root, and the landing work item's queue removal. There is no wildcard label rewrite, arbitrary comment write, remote deletion, source edit, or marker removal.
- **Credential discipline.** Every provider call resolves through the credential port. The secret-read boundary allowlist gains no entry from closeout.
- **Branch and worktree safety.** Branch deletion requires the full squash-safety predicate, merged-head equality re-checked at delete time, protected-ref checks with direct seam rejection, dirty-worktree and foreign-worktree checks, and a successful checkout restore when required. Worktree removal requires the full worktree predicate, exact head equality, cleanliness, current/locked/foreign checks, an earlier-failure gate, fixed argv, and no force flag. Unsafe states produce zero destructive action.
- **Capsule and promotion safety.** Capsule appends validate the whole file before writing, lock per capsule, deduplicate by event key, refuse a torn tail, and never repair or truncate. Promotion home writes are slug-validated and realpath-confined; the only status rewrite is the declared supersession mark. Closeout never pushes, writes a remote, or rewrites history.
- **Idempotency.** Deterministic identities and terminal-outcome reuse prevent duplicate writes; failed writes are safe to retry because every operation is idempotent by construction. Capsule events, promotion decisions, thread resolutions, branch deletions, worktree removals, telemetry records, and the queue removal are all identity-idempotent; a re-run reports the queue removal as satisfied and appends nothing.
- **Capability honesty.** Unsupported operations are declared gaps with valid reasons and can never be reported as success. The harness compaction invocation is a declared gap; no API is invented.
- **Runtime confinement.** The git seam is one exact, reason-bearing adapter I/O entry; the read-only repository reader remains no-spawn.
- **No session-content exposure.** Telemetry capture reads the configured harness store read-only (query-only pragma before the first opencode read, file reads for Claude Code with a bounded byte read before parsing) and emits numeric statistics and identity references only. The compaction checkpoint carries session identities, counts, flushed flags, an unresolved-question count, and a commit SHA — never session content. No prompt, message body, transcript, diff, tool output, or credential material enters a record or the output, and closeout performs no administration on a live session store.
- **Output redaction.** The single serialization chokepoint covers machine and human output; evidence and residue are bounded and contain no comment bodies, titles, transcripts, raw payloads, secrets, environment values, or command arguments.

### 5.2 Performance & Scalability

- At most 200 direct dependents, 100 unresolved threads per merged request, 500 changed files and 1 MiB of diff text, 64 attributed sessions, 100 candidates, and the declared label set per run.
- Every provider and git operation is bounded by a 30 s timeout; no operation waits unbounded.
- The reference-fixture apply budget is p95 ≤ 120 s. Capsule validation is ≤ 2 s, the diff scan ≤ 5 s, session attribution ≤ 5 s, and the retro-registry read ≤ 2 s on reference fixtures. The reference measurement is an optional non-CI artifact, not a merge gate.
- The plan is linear over bounded input; no retry loop, pagination crawl, daemon, or new runtime dependency exists.

### 5.3 Localization & Accessibility

No localization or accessibility surface is added. The human digest is deterministic plain text within the declared line and byte bounds; the machine envelope remains the canonical machine surface.

## 6. Quality Assurance Strategy

### 6.1 Testing Approach

| Level | Location | Scope |
|---|---|---|
| Structure | `tests/structure/closeout-contract.test.ts`, `closeout-imports.test.ts`, `closeout-additive.test.ts`, `closeout-contracts-git.test.ts`, `conformance-coverage.test.ts`, `error-table.test.ts` | Contract vocabulary, step/operation order, additive extensions, conformance operation set, error rows and the family slot, read-only import isolation, and the git-seam capability shapes. |
| Behaviour | `tests/behaviour/closeout-{plan,idempotency,request,branch,checkout,ticket-labels,unassign,owed-flip,threads,capabilities,output,read-observation,hermetic,integration,bounds}.test.ts` | Determinism, restart and retry, merged-request selection, branch safety, checkout restore, label sweep, unassign, owed-flip, thread resolution, capability gaps, UTF-8 bounds, output, read observations, the real JSONL ledger, and in-process CLI integration through the production composition over the real git seam. |
| Ceremony behaviour | `tests/behaviour/closeout-{worktree,worktree-refusal,worktree-idempotency,merged-diff,merged-diff-ambiguous,merged-diff-bounds,merged-diff-gap,retro-coverage,compaction,compaction-edges,residue,residue-provenance,attention-exit,thread-caps,telemetry-production,convergence}.test.ts`; `github-closeout-thread-{authorship,privacy}.test.ts` | Worktree cleanup and refusal matrix, diff attribution and bounds, retro coverage, compaction edges, residue ordering and provenance, the attention exit matrix, thread caps, production telemetry wiring, and convergence. |
| Production composition | `tests/behaviour/closeout-composition-facts.test.ts`; `tests/behaviour/github-closeout-thread-{authorship,privacy}.test.ts` | A real composition over a temp repository and harness store: worktree-cleanup and merged-diff-sweep reach `would-apply`/`applied`, session attribution feeds the checkpoint, a broken/unattributable store is a gap plus residue, no sessions is a no-op, harness telemetry lands in the state log while the capsule stays statistics-free, retro coverage reads the real registry, a human thread remains unresolved with identity-only residue, and an invalid capsule produces zero provider/git effects. |
| Capsule behaviour | `tests/behaviour/closeout-capsule-{validation,close,backfill,review-ingest,plan,schema,dedup,decisions,supersession,payload,gap,idempotency,promotion,routing,naming}.test.ts`; `tests/behaviour/capsule-{append,lock,reader,bounds,commit-producer,phase-producer,verify-producer,producer-nongating}.test.ts` | Capsule validation and backfill (including first-event and decision completeness), candidate file naming, review ingestion, candidate schema and dedup, promotion routing and confinement, cross-check residue, terminal close, re-run convergence, and the producer append points. |
| Provider behaviour | `tests/behaviour/providers/{github,jira,gitlab}-closeout.test.ts` and shared support | Provider write normalization, label/relation availability signals, auth/5xx → `invalid` mapping, merged head presence/absence, GraphQL thread resolution and root-author normalization, Jira label replace and transition, and reverse-dependent `no-surface` versus `unavailable` reads. |
| Golden | `tests/golden/closeout-{envelope,human,residue}.test.ts` | Recorded machine envelopes, human digests, and residue output for plan/apply outcomes. |
| Checks | `tests/checks/closeout-mutants.test.ts`, `capsule-{bounds,determinism,latency,mutants,privacy,ci-parity,cli-parity}.test.ts`, `error-table-sync.test.ts`, `fixture-sanitization.test.ts` | Source-mutation non-vacuity controls, capsule bounds/determinism/latency/privacy, bidirectional table sync, family-slot validation, and fixture hygiene. |
| Types | `tests/types/closeout-{headsha,attention}.type-test.ts`, `capsule.type-test.ts` | Optional `headSha`, the additive `attention` class, and capsule shapes through the root `typecheck`. |
| Conformance | `tests/conformance/mock-conformance.test.ts`, `broken-adapter-control.test.ts`, `capsule-events.test.ts` | Production write execution in the mock tier, capability-gated skips, runtime coverage over the eight operations, and capsule event conformance. |
| Aggregate | The whole workspace | `pnpm check`. |

### 6.2 Test Data & Scenarios

Closeout fixtures live under `tests/fixtures/closeout/` and the provider fixture area: plan, label, dependent, thread, request, branch, worktree, diff, retro, session, capability, read-observation, canary, golden, and mutant data. Capsule fixtures live under `tests/fixtures/capsule/`: a temporary change tree, memory filesystem, producer runtime, promotion harness, and named mutants. Production-composition coverage builds a temporary git repository with a squash landing and a delivery worktree, a temporary state store, and a synthetic opencode or Claude harness store. Local git scenarios use temporary repositories created by the test harness, including temporary worktrees. Provider fixtures are sanitized synthetic captures under `tests/fixtures/providers/{github,jira,gitlab}/closeout-*.json`.

The battery is offline and hermetic: no live provider credentials, network calls, host state, or real personal content. The mutant corpus copies fixtures into a temp directory and proves a named behavior fails when the corresponding rule is broken (for example, unknown-as-done, unavailable-as-empty, missing-head equality, gap-as-success, terminal-reuse bypass, non-SHA identity, success-on-partial, human-thread auto-resolution, unsafe worktree removal, telemetry copied into the capsule, or a missing promotion decision). A planted canary proves output, residue, and capsule evidence never leak it.

## 7. Operational & Support

### 7.1 Configuration

Closeout adds no configuration key. The v1 integration base is the compiled constant `main-tools`; the merged request's target ref takes precedence and is the normal path for installed projects. Adding a configuration key is a recorded revisit trigger. The lifecycle label disposition, protected-ref set, caps, outcomes, operation vocabulary, residue kinds, and merged-diff marker data are compiled contract data. Provider addressing and credentials come from the existing configured instance and credential port. The typed `harness` branch supplies the configured store location and kind used to construct the telemetry capture and the session-attribution facts; closeout adds no key of its own. The capsule runtime receives the changes directory, the promotion runtime receives the memory root, and the retro-coverage facts arrive as injected inputs.

### 7.2 Observability

The append-only `closeout.operation` ledger is the durable audit trail; a verified read reconstructs the transaction history. The capsule `events.jsonl` is the durable episode trail for the same change. The command reports counts by outcome, the ordered gap list with reasons, truncation markers, the resolved base, the selected delivery request, the bounded residue list, the capsule's closed state and per-candidate decisions, the queue-removal outcome with its ref and, where applicable, its reason or skip reason, and any worktree/retro/session/diff step evidence. When capture runs, the applied payload also discloses captured, degraded, and failed session counts, closed warning reasons, and any session truncation mark; those counts never alter a step outcome or verdict. Evidence and residue name only refs, provider entity identities, label names, operation names, counts, booleans, file paths, line positions, session identities, and classified failure codes/classes. Human mode renders a deterministic digest; when residue is present it includes the bounded `JUDGMENT RESIDUE` section, and an applied capsule close adds the `capsule: closed=... events=... candidates=...` line. Failure diagnostics go to the error stream with the classified identity and, for a retained worktree, the retained count/path/condition. No telemetry is sent to a network sink.

### 7.3 Cost & Infrastructure

Closeout adds no runtime dependency, service, daemon, or scheduled job. It reuses the existing provider transports, credential port, state store, and CLI surface. The ledger grows append-only per merge under the existing retention policy; there is no compaction or deletion surface in v1.

## 8. Dependencies & Risks

- **Depends on** the adapter port substrate ([Adapter Ports](feature-adapter-ports.md)) for primitive ports, the closed operation set, capability/gap declarations, and the credential port.
- **Depends on** the provider client seeds ([Provider Client Seeds](feature-provider-client-seeds.md)) for GitHub, Jira, and GitLab reads and the GitHub/Jira write slices.
- **Depends on** the scheduling engine ([Scheduling Engine](feature-scheduling-engine.md)) for the reason-bearing removal seam, the append-position presence rule, and the lease-liveness test the landing removal consults; the closeout run shares the transaction's fence with the removal and adds no second write location.
- **Depends on** the state layer ([State Layer](feature-state-layer.md)) for the append-only ledger, verified reads, fences, and the durable phase/commit/gate records the capsule cross-check consumes.
- **Depends on** the result contract ([Result Contract](feature-result-contract.md)) for the envelope, classification chain, error table, the additive `attention` class, and redaction.
- **Depends on** the harness adapter seam ([Harness Adapters](feature-harness-adapters.md)) for the read-only extractors, the telemetry capture constructed from resolved settings, harness-store session attribution, bounded Claude file reads, store-scoped orphan disclosure, and the additive `harness.telemetry` record shape; capture is non-gating.
- **Depends on** the change capsule ([Change Capsule](feature-capsule.md)) for the event contract, candidate model, capture bar, evidence shapes, promotion routing, and home-write confinement.
- **Depends on** the retro pipeline ([Retro Evidence Pipeline](feature-retro-pipeline.md)) for the read-only `retro.run`/level registry surface consumed by the coverage move.
- **Depends on** the merge transaction ([Merge and Verify Deploy](feature-merge-verify-deploy.md)) for the recorded squash SHA that anchors the merged-diff sweep.
- **Depends on** the session administration seam ([Session Database Administration](feature-session-database-admin.md)) for the read-only session-store discipline; `db` is consumed unchanged and supplies no attribution field.
- **Depends on** the adapter conformance suite ([Adapter Conformance](feature-adapter-conformance.md)) for the eight-operation registry and write execution.
- **Consumed by** coordinators and delivery agents performing post-merge closeout; the memory curator consumes the promotion decisions and home-written records, and later retro/ceremony surfaces consume the capsule coverage and residue.
- **Risk — provider write semantics diverge:** mitigated by offline write fixtures, trap catalogs, declared gaps, and capability-gated conformance.
- **Risk — unsafe branch or worktree deletion:** mitigated by the full safety predicates, merged-head equality, protected-ref and current/foreign/locked checks, dry-run default, and zero action on refusal.
- **Risk — human review threads erased:** mitigated by root-author normalization, fail-closed unknown authorship, and identity-only residue; no fallback resolves an unattributable thread.
- **Risk — capsule corruption or promotion pollution:** mitigated by per-capsule locking, whole-file validation, event-key dedup, terminal close, the capture bar, mandatory evidence, exact-statement dedup, and realpath-confined home writes.
- **Risk — ledger/provider divergence:** mitigated by idempotent writes, terminal-outcome reuse, failed-outcome retry, and the single-writer fence.
- **Risk — auto-removal fails or blocks closeout:** mitigated by running after the closeout writes inside the fence already held, never changing a step outcome or the exit code, reporting a skip with a closed reason, and reporting a missing entry as `satisfied`.
- **Risk — telemetry displaced by the capsule:** mitigated by two streams with two owners; the state log remains the only `spend` source and the capsule carries no statistics.
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
| Merged-diff sweep | The detection-only read of the merged change's added lines for the four closed marker kinds (`todo-marker`, `when-merges-note`, `feature-flag`, `class-string`); attributed hits become resolved evidence, ambiguous hits become residue. |
| Owed-flip marker | A declared marker kind indicating an action owed because the change merged; its mapped action token is `close-todo`, `remove-guard`, `retire-flag`, or `rename-class`. |
| Human thread | A review thread whose root author normalizes to `human` or `unknown` (fail-closed); it is never auto-resolved and becomes identity-only residue. |
| Worktree cleanup | Local removal of a delivery-owned worktree under the full safety predicate; fixed argv, no force, no remote. |
| Retro coverage | Whether the delivered `retro.run` registry already holds a change-level run for the work item; recorded as a capsule event, never as a synthetic run. |
| Compaction checkpoint | The pre-compaction capsule event: bounded session identities or counted truncation, flushed working state/event log, unresolved-question count, last verified commit, and the declared harness gap; its event key derives from the sorted session-id set plus the last verified commit. |
| Change capsule | The change folder plus append-only `events.jsonl` and `candidates/`; see [Change Capsule](feature-capsule.md). |
| Promotion decision | Exactly one `promoted` or `rejected` verdict per candidate, with a home/mode or a closed rejection reason. |
| Judgment residue | The bounded, ordered, body-free `residue[]` of items needing human attention after the sweep: human threads, ambiguous diff hits, capsule gaps, unreadable verdicts, retained worktrees, coverage/attribution gaps, and cap marks. Human mode renders it as a bounded `JUDGMENT RESIDUE` section. |
| Queue removal block | The additive non-step `queueRemoval` `data` block disclosing the landing removal: `outcome` (`removed`, `would-remove`, `satisfied`, `skipped`), the ref, the reason where recorded, and the skip reason where skipped. It never changes a step outcome or the exit code. |
| Landed removal | The automatic queue-entry removal closeout appends with reason `landed` after its writes, when the merged delivery request is observed; idempotent (`satisfied`) and fail-open (`skipped`). |
| `attention` outcome | The additive result-contract projection class that carries `data` plus residue and exits 1 for a non-failed applied run. |
| Lifecycle label sweep | The bounded removal of stale lifecycle-state labels and the addition of `delivered`, while preserving type and non-lifecycle labels. |
| Squash-safe | A deletion predicate that proves the branch's work landed through the merged delivery request's head identity, not through git ancestry. |
| Merged head | The provider-resolved head commit identity of the merged delivery request; absent means unknown. |
| Read observation | The explicit discriminator `observed`, `not-found`, `unavailable`, or `invalid` on a closeout-relevant work-item read; `invalid` covers a malformed payload and a non-404 authentication/transport/server failure. |
| Reverse-dependent observation | The distinct discriminator for the bounded reverse-dependent read: `observed`, `no-surface`, `not-found`, `unavailable`, or `invalid`. `no-surface` is a provider-level gap; `unavailable` is a signal-level skip. |
| Protected ref | A ref branch cleanup must never delete: `main`, `main-tools`, the resolved base, `HEAD`, and declared protected refs. |

See also: [Change Capsule](feature-capsule.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Harness Adapters](feature-harness-adapters.md), [Retro Evidence Pipeline](feature-retro-pipeline.md), [Session Database Administration](feature-session-database-admin.md), [Merge and Verify Deploy](feature-merge-verify-deploy.md), [Adapter Conformance Suite](feature-adapter-conformance.md), [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), the [repository glossary](../../overview/glossary.md), [TDR-0008](../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change records:** `doc/changes/2026-11/2026-11-01--GH-183--closeout-v1-branch-cleanup/`, `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/`, and `doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/` (the automatic `landed` queue removal and its `queueRemoval` block).

## Related

- [Change Capsule](feature-capsule.md) owns the capsule artifact, event producers, candidate schema, promotion routing, home-write confinement, and close semantics that the terminal `capsule` step executes.
- [Harness Adapters](feature-harness-adapters.md) provides the non-gating, idempotent telemetry capture point after the terminal steps: extraction reads the harness store read-only with a bounded Claude byte read and store-scoped orphan disclosure, and the additive `harness.telemetry` records carry numeric statistics only; capture outcomes are disclosed in the bounded output and never change a step, summary, or verdict.
- [Result Contract and Error Table](feature-result-contract.md) owns the `harness` error family raised by the adapters, the additive `attention` projection class, the `closeout` rows and step family, and the delivery-result token projection used by classification.
- [Retro Evidence Pipeline](feature-retro-pipeline.md) owns the read-only `retro.run`/level registry that the coverage step consults.
- [Session Database Administration](feature-session-database-admin.md) owns the unchanged metadata-only `db` surface; session attribution for the checkpoint does not come from `db`.
- [Merge and Verify Deploy](feature-merge-verify-deploy.md) owns the `merge.transaction` squash SHA and landing record that anchor the merged-diff sweep.
- [Spend Read Side](feature-spend.md) reads the `harness.telemetry` records this transaction captures into the state log.
- [Scheduling Engine](feature-scheduling-engine.md) owns the removal record, the append-position presence rule, and the lease-liveness test the landing removal uses; [TDR-0026](../../decisions/TDR-0026-queue-lifecycle-removal-single-flight.md) is the binding decision.
