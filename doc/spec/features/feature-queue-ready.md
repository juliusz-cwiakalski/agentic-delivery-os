---
ados_distribution: internal
id: SPEC-QUEUE-READY
status: Current
created: 2026-10-31
last_updated: 2026-11-01
owners: ["engineering"]
service: delivery-os
summary: "The read-only queue-ready ready-set command: the `queue ready` grammar and canonical-ref bounds, the six closed tri-state readiness conditions and their declared sources, the all-six-satisfied ready rule with named blocking conditions, provider-agnostic identity resolution and the numeric suffix bridge, close association and classification by the repository branch convention, deterministic class ranking, the six-group bounded reason vocabulary, the nine provider-derived output caps with the single `value-clamped` marker and deterministic byte-budget reduction, the bounded `delivery.queue-ready.v1` machine payload and human digest, the read-only and credential boundary posture, error-identity reuse, and the fixture corpus plus opt-in live-smoke evidence model."
links:
  related_changes: ["GH-176", "GH-183"]
  related_decisions: ["ADR-0003", "ADR-0004", "ADR-0006", "ADR-0007", "ODR-0003"]
  contracts:
    - "packages/core/src/contracts/queue-ready.ts"
---

# Feature: Queue Ready

## Overview

The ready-set command answers one question at the start of a delivery pick: for an explicit set of candidate work items, what can start now, what is blocked, and what should be closed first. The command surface is `queue ready <ref>...`; it accepts one or more canonical work-item refs and only the global machine-output switch, and it is read-only by construction.

Every candidate carries exactly six readiness conditions in a fixed order — `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available` — each with one state from the closed tri-state `satisfied`, `unsatisfied`, `unknown` and bounded evidence. A candidate is ready only when all six are satisfied; every non-satisfied condition is named in `blockingConditions`. A failed, absent, unattempted, unavailable, unobserved, or unresolved source yields `unknown`, never `satisfied` and never a fabricated zero.

The command also classifies each candidate as a close item or a new start. A close item is an open pull request associated with the candidate by the repository branch convention. `merge-ready` requires an observed approval on a non-draft open pull request; `review-pending` covers every other associated open pull request, including an unknown review signal. Close items rank above ready new starts.

Machine mode returns one bounded `delivery.queue-ready.v1` payload in the standard `CommandResult` envelope. Human mode renders a deterministic digest from the same data. The command performs zero writes, fences, state mutations, network writes, provider-engine calls, child processes, and ambient credential reads. It reuses the delivered status read results and classifications and adds no adapter read, error-table row, configuration key, state-schema change, package, subpath, or runtime-API location. Closeout is a separate mutating surface: queue ready does not import or compose the closeout engine, the git branch/checkout seam, or provider write operations, and its read-only guarantees are unchanged.

The surrounding contracts are described in [Status Digest](feature-status-digest.md), [Provider Engine](feature-provider-engine.md), [State Layer](feature-state-layer.md), [Configuration Layer and Inspection](feature-config-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), and [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); absence semantics follow [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) and [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md); park semantics follow [ADR-0007](../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md); the command name is locked by [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md).

## Business Context

### Problem Statement

- **Problem:** The coordinator decides what to start by manually cross-checking dependencies, repository activity, tier labels, owner hand-backs, CI, and provider parks. Manual checks collapse distinct evidence states: "no dependencies found", "dependency source unavailable", "ticket not observed", and "all dependencies done" all look the same. A full queue also hides idle lanes, so merge-ready and review-pending work waits behind new starts.
- **Affected Users:** The coordinator and lifecycle agents selecting the next change; operators consuming the ready set; maintainers of the tracker, VCS, CI, provider, and local PM-context sources.
- **Business Impact:** An evidence-backed ready set makes blocked or degraded candidates visible by name, surfaces close items ahead of new starts, and prevents starting work whose conditions are unmet or unknown.

### Goals

- One read-only `queue ready` command accepting one or more work-item refs and only the global machine-output switch.
- Exactly six closed readiness conditions per candidate, in fixed order, each with a tri-state result and bounded evidence.
- A ready candidate only when every condition is satisfied, with every non-satisfied condition named.
- Truthful sourcing: dependency relations, the local PM context, declared triage and owner-attention labels, the checkout-head check-runs page, and the declared provider chain with the verified park fold.
- Close association by branch convention, observed-approval-only `merge-ready`, and deterministic ranking with close items above new starts.
- Bounded machine and human output with explicit truncation and clamp markers, and no fabricated all-clear.
- Reuse of the delivered status inputs with no new adapter read, error identity, configuration key, state-schema change, package, subpath, or runtime-API location.

## User Experience & Functionality

### Command surface and grammar

The command is `queue` with the subcommand positional `ready`, composed where the other top-level commands are composed. It accepts one or more `<workItemRef>` positionals; `--json` is the existing global machine-output switch and adds no command behavior.

Grammar is validated in the handler before any source read:

1. The first positional must be exactly `ready`.
2. Between one and `QUEUE_READY_MAX_CANDIDATES` (8) refs must follow.
3. Every ref must match `QUEUE_READY_WORK_ITEM_REF_PATTERN` (`^[A-Za-z][A-Za-z0-9]*-[0-9]+$`). The match is a whole-value, case-insensitive prefix test with an exact hyphen and digit substring; whitespace is never accepted or trimmed.
4. Each ref is canonicalized: the ASCII alphabetic prefix is uppercased and the hyphen and digit substring are preserved exactly, including leading zeros (`gh-176` → `GH-176`; `Gh-007` → `GH-007`).
5. The canonical ref must be at most `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` (64) characters. Exactly 64 is accepted; 65 or more is rejected.
6. Canonical duplicates are rejected and never silently merged.

A zero-ref, too-many-ref, over-length-ref, wrong-subcommand, malformed-ref, or duplicate-ref invocation fails as `input.value.rejected` (kind `input`, exit `1`) before any source read and emits no candidate. The global parser retains its existing `fallback.invocation` path for unknown flags, unknown command names, and invocations beyond `QUEUE_READY_MAX_POSITIONALS` (33 positionals: one subcommand plus 32 refs).

The handler owns no stream writes and chooses no exit code; it returns data or a classified failure, and the CLI edge renders and projects. The handler's own failures are only `input.value.rejected` (grammar) and `fallback.internal` (containment). Source read failures are condition evidence, so a successful run still returns every candidate with exit `0`.

The delivered CLI has no rendered command-help surface, and this command adds none. The command registry records the partial `queue` family as documentation only, so `queue ready` shipping ahead of the full `queue` family does not read as a defect.

### Six readiness conditions and their sources

The condition ids and order are fixed. Each condition carries exactly one state and bounded evidence; `provider-available` always carries two evidence records.

| Order | Condition | Declared source | `satisfied` | `unsatisfied` | `unknown` |
|---:|---|---|---|---|---|
| 1 | `deps-satisfied` | Normalized `blocked-by` relations on the observed work item plus the observed work-item set | Relations available; every target observed `done`/`canceled`, including zero targets | Relations available; at least one target observed with a non-done, non-canceled state | Candidate unobserved (evaluated first); relations declared unavailable while the candidate is observed; or at least one target unobserved and none known open |
| 2 | `repo-free` | Git-ignored local PM context `active_change` | No active change, or the active change is the candidate | Another active change is recorded | Context missing or malformed |
| 3 | `tier-known` | Candidate labels | Exactly one distinct recognized triage label | Two or more distinct recognized triage labels | Candidate unobserved (evaluated first); label signal unavailable; zero recognized labels |
| 4 | `no-owner-gate` | Candidate labels | No declared owner-attention label | At least one declared owner-attention label | Candidate unobserved (evaluated first) or label signal unavailable |
| 5 | `ci-healthy` | Current checkout HEAD plus one bounded check-runs page | Status CI classification `succeeded` | Status CI classification `failed`, `pending`, `canceled`, or `none` | SHA unresolved; binding unavailable so the read was not attempted; credential unavailable; a declared `not-configured` read; or the read was attempted and failed |
| 6 | `provider-available` | Declared provider configuration plus the verified park fold | Default chain resolved and at least one enabled entry unparked, with no active chain park | No enabled entry, every enabled entry parked, or an active chain park | Config invalid/unresolved, no declared default chain, chain does not resolve, or park fold failed |

Condition details:

- **`deps-satisfied`.** Evaluation order is candidate observation, relation-signal availability, then the target predicate. When the candidate work item is not observed, `work-item-unobserved` wins before any relation-signal check. With relations available: zero `blocked-by` relations is `no-blocked-dependencies`; every target observed done/canceled is `dependencies-done`; an observed non-done target is `dependency-open`; otherwise (at least one unobserved target and none known open) `dependency-unobserved`. A done target outside the observed page stays unobserved. The condition carries exactly one evidence record; target-derived details are the state-count summary `done:<n>; open:<n>; unknown:<n>` summing to the total `blocked-by` target count, never a target-ref list.
- **`repo-free`.** Missing context is `unknown` with `local-context-missing`; malformed YAML or wrong shape is `unknown` with `local-context-malformed`; no active change is `satisfied` with `no-active-change`; the candidate as active change is `satisfied` with `candidate-is-active`; another active change is `unsatisfied` with `other-active-change`. Observed states carry the proxy source detail `repo:local-context`, with `; active-change:<ref>` or `; candidate-is-active` where applicable. The local context is never written and a missing file never means "free". This condition is a local-context proxy: per-repo single-flight is not delivered, so it cannot see another machine's active change.
- **`tier-known`.** With labels observed: exactly one distinct recognized label from `priority:high`, `priority:medium`, `priority:low` (case-insensitive) is `satisfied` with `tier-label`; zero is `unknown` with `tier-absent`; two or more distinct recognized labels is `unsatisfied` with `tier-conflict`. Unrecognized labels neither satisfy nor conflict, and no default tier is invented. The detail names the proxy source `tier:priority-label`. This is a triage-label proxy: no per-ticket delivery-tier record exists.
- **`no-owner-gate`.** With labels observed: none of `hand-back` or `human-input-needed` is `satisfied` with `no-owner-labels`; any one or more is `unsatisfied` with `owner-labels:<sorted labels>`. `assignee` is not used because the normalized field is optional and absence means unknown.
- **`ci-healthy`.** The condition reuses the status CI classification on the current checkout HEAD: one bounded check-runs page at `QUEUE_READY_SOURCE_PIPELINE_LIMIT` (20), no pagination, no retry. Only `succeeded` satisfies. `failed`, `pending`, `canceled`, and `none` are `unsatisfied` with their matching reason. Each `unknown` mode carries exactly one reason: `commit-unresolved` for an unresolved SHA; `addressing-unresolved` or `remote-unsupported` for an unavailable binding, where the read was not attempted; `credential-unavailable`; `signal-unavailable` for a declared `not-configured` read, mapped distinctly from an attempted failure; or `read-failed` with a bounded failure code/class detail for a read that was attempted and failed. No run is never green, and an all-skipped page is never `succeeded`.
- **`provider-available`.** The condition reads the resolved provider configuration and verified active park views; it never calls the provider engine, `provider resolve`, `provider quota`, or any quota transport. A provider-config read failure is mapped by its read reason, never blanket-mapped: `config-invalid` stays `config-invalid` and `provider-chain-unresolved` stays `provider-chain-unresolved`. A verified park-fold failure is `state-unreadable` from `provider-parks`. With a resolved chain: an active chain park is `unsatisfied` with `chain-parked` and bounded cause/expiry; zero enabled entries is `unsatisfied` with `no-enabled-entry`; otherwise at least one enabled entry with no active provider park is `satisfied` with `no-active-park`; otherwise every enabled entry is parked and the condition is `unsatisfied` with `all-entries-parked`. Every instance carries the case record first and the fixed companion record `{ source: "provider-config", reason: "engine-not-run" }` with no detail. No provider evidence record or availability claim uses `available` as a claim or state; the pinned condition id `provider-available` and its condition-id references are exempt. The engine was not run, and the condition never claims engine verification.

### Ready semantics and blocking conditions

`ready` is true only when all six conditions are `satisfied`. Otherwise the candidate is not-ready and `blockingConditions` lists every non-satisfied condition in the fixed order with its state. `unknown` never contributes to `ready` and is never rendered as satisfied, ready, or zero. A condition may be `satisfied` only when its required source read succeeded and the observed value meets the predicate.

### Identity resolution

A validated candidate ref is matched to an observed normalized work item over full values, before any output clamp:

1. **Exact canonical match wins.** The observed full `identity.entityId` equals the canonical ref under an ASCII case-insensitive comparison.
2. **Numeric bridge.** Otherwise, when the observed full `identity.entityId` is a non-empty all-ASCII-digit string `d`, it matches the requested candidate whose canonical numeric suffix (the digits after the final hyphen, leading zeros preserved as text) equals `d` exactly, and only when exactly one requested candidate carries that suffix. An ambiguous suffix leaves the work item unobserved for every sharing candidate; caller order and precedence never resolve it.
3. **No other match.** There is no substring, prefix-only, or numeric-coercion match: `0176` does not match suffix `176`, and `007` does not match `7`.

`blocked-by` targets resolve against the observed work-item set, not the requested candidate set: an exact full-value match wins; a bare all-ASCII-digit target bridges only when exactly one observed work item carries that numeric suffix; ambiguity or no match is `dependency-unobserved`; and a canonical-shaped target that is not observed stays `dependency-unobserved` even when its ref equals a requested candidate. Matching always uses the full normalized value, so a projection clamp never changes a verdict.

### Close association and classification

The command reuses the delivered bounded open pull-request read (`?state=open`) bound to the `origin`-derived repository, so command-level association observes open pull requests only. A candidate is associated with an open pull request when the pull request's `sourceRef` follows the repository branch convention `<type>/<workItemRef>/<slug>`: at least three non-empty segments, with any segment equal to the canonical candidate ref case-insensitively.

The selected pull request is deterministic within one close class. The merge-ready set is preferred when non-empty; otherwise the full associated set is used. Within the selected set the order is `entityId` ascending with a numeric-aware comparison (equal numeric all-digit values tie at this key, otherwise lexical), then `sourceRef` ascending, then `targetRef` ascending, then the lexically smaller raw `entityId` string only when all three keys are equal. API return order never decides.

| Association | Review signal | Draft | Close class |
|---|---|---|---|
| Associated | Observed `approved` | Non-draft | `merge-ready` |
| Associated | Any other state, including unavailable | Any, including draft | `review-pending` |
| Not associated | — | — | `new-start` when ready, otherwise `not-ready` |
| Unknown | — | — | `unknown` when ready, otherwise `not-ready` |

`merge-ready` requires an observed approval on a non-draft open pull request. `review-pending` covers every other associated open pull request, including draft and unknown review state. A ready candidate whose association is unknown is `unknown`, never `new-start`; a not-ready candidate with an unknown association is `not-ready`. Association is `unknown` when the repository binding is unavailable, the pull-request read failed, or the read succeeded at its declared page limit and no open match was found. `associatedCount` counts open matches only, is exact below the page limit, is a page-bounded lower bound at the limit, is `0` when the read failed or the binding is unavailable, and is bounded by `0..QUEUE_READY_SOURCE_ITEM_LIMIT` (100) without a separate cap.

The delivered open-only read never contains a merged or closed object. In an evaluator-injected normalized view that contains a matching merged/closed request, that request is never selected, counted, or classified as an open close item; below the limit with no open match the association is `not-associated` with `pr-not-open` and the not-associated fallback class, while the at-limit rule still yields `unknown` with `pr-association-unknown`.

### Ranking

Candidates are ranked by class first:

| Class rank | Close class |
|---:|---|
| 0 | `merge-ready` |
| 1 | `review-pending` |
| 2 | `new-start` |
| 3 | `unknown` |
| 4 | `not-ready` |

Within a class, ties break on the numeric suffix of the work-item ref ascending, compared as an arbitrary-precision integer so suffixes at or above 2^53 still order numerically, then the canonical ref text ascending when the numeric values are equal. A ref without a numeric suffix ranks after every numeric suffix. `rank` is the 1-based position after sorting. Caller order and API return order never affect the result. A close item always ranks above a ready new start, and a not-ready candidate never outranks a close item.

### Reasons, bounds, and truncation

Top-level `reasons` is the unique union of six fixed groups, in this order:

1. Repository-binding outcome: `addressing-unresolved`, then `remote-unsupported`.
2. Payload bounding markers: `source-truncated`, then `value-clamped`.
3. Provider-config failure: `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`.
4. Park-fold failure: `state-unreadable`.
5. Condition-source failures from `QUEUE_READY_SOURCE_FAILURE_REASONS` (`read-failed`, `credential-unavailable`, `signal-unavailable`, `work-item-unobserved`, `commit-unresolved`, `local-context-missing`, `local-context-malformed`), walked across the ranked candidates in rank order, then in `QUEUE_READY_CONDITION_ORDER`, then in each condition's evidence order, at first occurrence only. The declared reason array is a membership set and never sets the emission order.
6. Close-association outcome: `pr-association-unknown` only.

`reasons` is capped at `QUEUE_READY_MAX_REASONS` (6) and `truncated` is set when more would remain. Verdict and observation reasons outside the source-failure subset (for example `ci-pending`, `tier-conflict`, `dependency-open`, `dependency-unobserved`, `pr-associated`, `pr-not-associated`, `pr-not-open`) stay in condition or close evidence and never enter top-level `reasons`. `source-truncated` and `value-clamped` are payload-level markers only and never condition or close evidence.

| Concern | Bound |
|---|---|
| Input refs | 1..`QUEUE_READY_MAX_CANDIDATES` (8); over-cap rejected |
| Canonical ref length | ≤`QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` (64); over-length rejected before any read |
| Conditions per candidate | 6, fixed order |
| Evidence per condition | ≤`QUEUE_READY_MAX_EVIDENCE_PER_CONDITION` (2); the delivered set emits one record for each non-provider condition and two for `provider-available` |
| Top-level reasons | ≤`QUEUE_READY_MAX_REASONS` (6) |
| Evidence detail | ≤`QUEUE_READY_MAX_DETAIL_CHARS` (160) |
| `associatedCount` | `0..QUEUE_READY_SOURCE_ITEM_LIMIT` (100), not separately capped |
| Serialized `data` | ≤`QUEUE_READY_MAX_MACHINE_BYTES` (65 536) UTF-8 bytes, measured on the serialized JSON |
| Human digest | ≤`QUEUE_READY_MAX_HUMAN_LINES` (16) lines and ≤`QUEUE_READY_MAX_HUMAN_BYTES` (4 096) UTF-8 bytes; provider segments ≤`QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32) UTF-8 bytes, header owner/name ≤128 and branch ≤256 UTF-8 bytes, candidate line ≤400 UTF-8 bytes, header plus summary ≤620 UTF-8 bytes, all enforced with a reverse-rank line drop that keeps the renderer total |
| Issues/pull-request page | `QUEUE_READY_SOURCE_ITEM_LIMIT` (100) |
| Check-runs page | `QUEUE_READY_SOURCE_PIPELINE_LIMIT` (20) |

Truncation flag scope is exact: evidence-cap overflow sets the affected candidate and the payload `truncated`; reason-cap overflow, a source page at its declared limit, a provider-derived clamp, and a byte-budget reduction set the payload `truncated` only; a derived-detail clamp sets no flag. A raw check-runs page of exactly 20 runs raises payload-level `source-truncated` and changes neither the `ci-healthy` classification, state, evidence, nor `blockingConditions`. A human-digest defensive line drop is renderer-only and never sets the payload `truncated` flag.

### Provider-derived output caps and the value clamp

Provider-derived values are projected only within nine declared caps. Projection is output-only: identity matching, label and dependency-target predicates, close association, and ranking always use the full normalized values, so a clamp never changes a verdict, close class, rank, `associatedCount`, or summary.

| Constant | Cap |
|---|---|
| `QUEUE_READY_MAX_IDENTITY_CHARS` | 128 per projected identity (`entityId` only; `systemName` is omitted) |
| `QUEUE_READY_MAX_REF_CHARS` | 128 per provider ref (`sourceRef`, `targetRef`) |
| `QUEUE_READY_MAX_LABEL_CHARS` | 128 per label |
| `QUEUE_READY_MAX_LABELS` | 16 labels per observation, provider order retained, reduced from the end |
| `QUEUE_READY_MAX_RELATIONS` | 16 `blocked-by` relations per observation; every other relation kind is filtered out, never clamped |
| `QUEUE_READY_MAX_OWNER_CHARS` | 128 repository owner characters |
| `QUEUE_READY_MAX_REPO_NAME_CHARS` | 128 repository name characters |
| `QUEUE_READY_MAX_BRANCH_CHARS` | 256 head-branch characters |
| `QUEUE_READY_MAX_TIMESTAMP_CHARS` | 40 provider `updatedAt` characters |

Any clamp sets payload `truncated` and adds the single `value-clamped` reason in group 2, after `source-truncated` when both are present. Provider-derived string caps and derived-detail clamps are applied by code point, so an astral character is never split into a lone surrogate. If the fully capped projection would still exceed `QUEUE_READY_MAX_MACHINE_BYTES` (65 536 UTF-8 bytes), trailing relations and then labels are dropped deterministically, last-ranked candidate first and highest index first within a candidate, and every recheck measures the same UTF-8 byte bound, with the same markers and no verdict change.

The human digest is byte-aware and total over every legal payload. Each per-candidate provider segment (pull-request identity rendered as `PR #<entityId>`, and the source ref) is rendered to at most `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32) UTF-8 bytes including a trailing `+` when shortened, with the `+` counting toward the 32-byte cap and no code point split; the header renders owner and name to at most 128 UTF-8 bytes each and the branch to at most 256 UTF-8 bytes, each with a trailing `+` when shortened. These are renderer rules only: they change no payload field and are not `value-clamped` clamps. A candidate line is at most 400 UTF-8 bytes and the header plus summary line at most 620 UTF-8 bytes. The renderer enforces the 16-line and `QUEUE_READY_MAX_HUMAN_BYTES` (4 096) UTF-8-byte bounds; if a legal payload would still exceed them after every renderer cap, it drops trailing candidate lines in reverse rank order (last-ranked candidate first), keeps the header when present and the summary line, and marks the drop with `+more` after the summary. It never throws, never exits non-zero, and never emits an unbounded digest; the line drop is renderer-only, changes no payload field, does not set the payload `truncated` flag, and adds no reason token.

### Machine payload

`queue ready --json` writes exactly one standard `CommandResult` envelope. Its `data` is the full bounded `delivery.queue-ready.v1` payload:

```
QueueReadyPayload {
  schemaVersion: "delivery.queue-ready.v1"
  generatedAt: ISO-8601 UTC
  repository: observed { host, owner, name, remoteName } | unavailable { reason }
  head: { branch?, sha? }
  candidates: ranked [
    {
      workItemRef, rank, ready, closeClass,
      workItem: observed { itemState, labels?, updatedAt?, relations? } | unknown { reason },
      close: { association, associatedCount, pullRequest?, reason },
      conditions: 6 × { id, state, evidence },
      blockingConditions: [ { id, state } ],
      truncated
    }
  ]
  summary: { candidates, ready, notReady, mergeReady, reviewPending, newStart, unknownClose }
  reasons: [unique, ordered, ≤6]
  truncated
}
```

The payload carries no raw provider payload, response body, credential, title, body, comment, assignee, or free-form message. Each projected relation has the shape `{ relationKind: "blocked-by", target: { entityId } }`, and every other relation kind is filtered out. Each projected provider-qualified identity (each relation target and the selected pull request) carries only `entityId`; `systemName` never enters the payload. Evidence records carry a closed source (`tracker`, `changes`, `ci`, `provider-config`, `provider-parks`, `local-context`, `repository-binding`), a closed reason, and an optional bounded detail. Safe detail examples are `tier:priority-label; label:priority:high`, `repo:local-context; active-change:GH-179`, `owner-labels:hand-back`, `done:2; open:0; unknown:0`, `result:pending`, `chain:default`, and the pinned failure-identity form `failureCode:<code>`, `failureClass:<class>`, or both joined by `; `.

### Human digest

Human mode renders a deterministic digest from the same payload, with no extra reads, no LLM, and no timestamps:

```
<binary> queue ready <owner>/<name> @ <branch|detached> <sha7>
ready <n> | not-ready <n> | merge-ready <n> | review-pending <n> | unknown-close <n>[+more]
<rank>. <ref>  <closeClass>  <detail>  [repo:local-context; tier:priority-label]
...
```

The header is optional and appears only when the repository binding is observed and the SHA is resolved. There is exactly one summary line and exactly one line per rendered candidate in rank order. `<detail>` is `PR #<entityId> <sourceRef>` for an associated close item, `all six readiness conditions satisfied` for a ready new start, `close association unknown` for the unknown class, and `blocking: <id>=<state>, ...` for a not-ready candidate; a close item that is also not-ready prints its close evidence followed by ` | blocking: ...`. Every candidate line ends with the fixed proxy-source suffix `[repo:local-context; tier:priority-label]`. `+more` follows the summary when the payload-level `truncated` is true or when a defensive line drop removed candidate lines. Each provider segment is byte-capped to 32 UTF-8 bytes including a trailing `+` when shortened; the header owner and name are byte-capped to 128 UTF-8 bytes each and the branch to 256 UTF-8 bytes, each with a trailing `+` when shortened. A candidate line is at most 400 UTF-8 bytes and the header plus summary at most 620 UTF-8 bytes. If a legal payload would still exceed `QUEUE_READY_MAX_HUMAN_BYTES` (4 096) UTF-8 bytes or `QUEUE_READY_MAX_HUMAN_LINES` (16) lines after every renderer cap, the renderer drops trailing candidate lines in reverse rank order (last-ranked candidate first), keeps the header when present and the summary line, and marks the drop with `+more`; it never throws, never exits non-zero, changes no payload field or reason token, and never emits an unbounded digest. The digest contains no titles, timestamps, raw payloads, secrets, or prose.

## Technical Architecture & Codebase Map

### Core components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/queue-ready.ts` | The complete `delivery.queue-ready.v1` vocabulary: condition ids and order, tri-state, close classes, evidence sources and reasons, reason groups, caps, limits, label sets, patterns, schema version, and payload types. Types and `as const` data only; no I/O. |
| `packages/core/src/domain/queue-ready.ts` | The pure evaluator, provider-agnostic identity resolver, close classifier, ranker, evidence assembler, provider-derived projection, and human renderer. No I/O, clock, randomness, or ambient environment; every variable fact arrives through `QueueReadyFacts`. |
| `packages/core/src/domain/ci-result.ts` | The shared pure `classifyPipelineRuns` classifier used by the status aggregator and the queue-ready evaluator, so the two cannot diverge. The classifier is module-internal: both domain modules import it directly, and it is not re-exported from the domain barrel or the core root. |
| `packages/core/src/contracts/index.ts` | Re-exports the queue-ready vocabulary through the shared contracts subpath. |
| `packages/core/src/domain/index.ts` | Re-exports `evaluateQueueReady` and `renderQueueReadyHuman`; `packages/core/src/index.ts` exposes them on the core root. |
| `packages/cli/src/commands/queue.ts` | The `queue` command definition with the `ready` subcommand positional, grammar validation, and the status-read composition; no stream writes and no exit-code choice. |
| `packages/cli/src/commands/status.ts` | The shared `collectStatusFacts` composition and `StatusCommandRuntime` reused verbatim by `queue ready`. |
| `packages/cli/src/edge.ts` | The runtime composition that admits `queue` beside `status` and wires the same injected reads. |

### Data flow

1. The CLI edge resolves the brand, the repository binding, and the checkout HEAD, then injects the read sources.
2. The handler validates and canonicalizes the grammar before any read; a rejection returns `input.value.rejected` with zero reads.
3. The handler calls the shared status-read composition once, producing the delivered status facts.
4. The pure evaluator observes each candidate through the identity rule, evaluates the six conditions, classifies the close association, ranks the candidates, and assembles the bounded evidence and reasons.
5. It projects provider-derived values within their caps, applies the deterministic byte budget, and returns the payload.
6. Machine mode wraps the payload in the envelope; human mode renders the deterministic digest from the same data.

### API and interface contracts

- **`evaluateQueueReady(facts: QueueReadyFacts): QueueReadyPayload`** — the pure evaluation surface over injected status facts plus the canonical candidate refs.
- **`renderQueueReadyHuman(payload, brand): string`** — the only human-rendering surface; it reads no source and derives everything from the payload plus the injected brand binary name.
- **`classifyPipelineRuns(runs): StatusCiResult`** — a module-internal helper shared by the status aggregator and the queue-ready evaluator; it is imported directly by both domain modules and is not part of the domain barrel or the core root export surface.
- **`createQueueReadyCommandDefinition(runtime): CommandDefinition`** — the command definition; it accepts the status runtime and returns data or a classified failure.
- **`QueueReadyFacts`** — `StatusFacts` plus the canonical candidate refs, so the command consumes the delivered status read results without a new adapter operation.

The contracts and domain import only the shared contracts and their own modules. The GitHub, repository, and file I/O stay in their already-admitted adapter subpaths. No new package, subpath, declared entrypoint, workspace edge, or runtime-API location is introduced.

## Security and Boundaries

- **Read-only by construction:** the command calls no write or fence API, no tracker, pull-request, or CI write, no provider engine, and no quota endpoint. It cannot mutate an artifact or provider state.
- **Credential centralization:** the only credential access is the credential port resolving the declared GitHub credential reference. Command code reads no ambient environment and adds no secret-read allowlist entry.
- **No shell or spawn:** repository binding and HEAD facts come from bounded git metadata reads through the repository adapter. The command spawns no child process and executes no shell.
- **Bounded addressing:** only the `origin` remote is read; only `github.com` is accepted; userinfo and credentials are discarded; non-GitHub hosts are unavailable, not attempted.
- **Bounded parsing:** the local PM context uses the existing bounded YAML read; parse failures are classified as evidence, never raw parser output.
- **Bounded input and output:** refs, conditions, evidence records, detail characters, provider-derived values, machine bytes, and human bytes are capped, with explicit truncation and `value-clamped` marking.
- **No leakage:** evidence carries closed reasons, counts, refs, label names, and bounded details only. The single serialization redaction path covers the envelope and human text, and planted-secret canaries apply.
- **Brand neutrality:** no product or binary literal is committed; the human header uses the injected brand binary name. The only provider-specific literals are the declared credential key and the GitHub host, both declared provider data.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Readiness totality | Exactly six conditions per candidate in fixed order; one state from the closed tri-state; bounded evidence present; `ready` equals all-six-satisfied; every not-ready candidate names at least one blocking condition. |
| Non-verdict guarantee | An absent, failed, unattempted, unavailable, unobserved, or unresolved source never yields `satisfied`, never contributes to `ready`, and never prints as zero; no `merge-ready` without observed approval on a non-draft open pull request; no-run CI is never healthy. |
| Identity truthfulness | Exact canonical matching and the unique numeric suffix bridge over full values; ambiguity and leading-zero mismatch stay unobserved; no substring, prefix-only, or numeric coercion. |
| Bounds | Input refs ≤8; canonical ref ≤64 characters with over-length rejection; evidence ≤2 per condition; reasons ≤6; detail ≤160 code points; nine provider-derived caps applied by code point; serialized `data` ≤65 536 UTF-8 bytes; human ≤16 lines and 4 096 UTF-8 bytes, with byte-capped header fields and provider segments (32-byte segments; owner/name ≤128 and branch ≤256 UTF-8 bytes), a ≤400-byte candidate line, a ≤620-byte header plus summary, and a reverse-rank line drop that keeps the renderer total; every dropped, limited, or clamped case marked. |
| Read-only and determinism | Zero writes, fences, state mutations, network writes, provider-engine calls, quota fetches, child processes, or ambient environment reads; identical injected inputs produce byte-identical payload and human text. |
| Read cost | At most three outbound read-only GitHub requests, one logical verified park-fold read, one configuration resolve, and one local PM-context read per invocation; zero retries or loops. |
| Output contract | `--json` produces exactly one valid envelope; human mode produces one summary line plus one line per candidate; rendering performs zero extra reads. |
| Error-table stability | Zero new rows or domain kinds; zero documented-table drift; the sync check stays green. |
| Boundaries and branding | Zero new packages, subpaths, runtime-API locations, secret-read allowlist entries, or product literals; structure, boundary, ambient, and literal gates stay green. |
| Performance | Pure evaluation, ranking, and rendering over cap-sized inputs completes within 50 ms on the reference environment; linear in candidates × conditions × evidence. |
| Privacy | Zero secrets or raw provider payloads in the payload, evidence, or human text; no ambient environment reads outside the allowlist. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract vocabulary, declared constants and caps, data-only contracts, pure domain imports, command composition, no new package/subpath/runtime-API, error-identity reuse, no product literals | `tests/structure/queue-ready-contract.test.ts`, `tests/structure/queue-ready-imports.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json` |
| Behaviour — command | Grammar, canonicalization, the 64-character bound, duplicate rejection, rejection before reads, parser fallback, edge exit projection | `tests/behaviour/queue-ready-command.test.ts` |
| Behaviour — conditions | Six-condition totality and tri-state, derivation matrix, deps, repo/tier/owner, CI | `tests/behaviour/queue-ready-conditions.test.ts`, `queue-ready-deps.test.ts`, `queue-ready-repo-tier-owner.test.ts`, `queue-ready-ci.test.ts` |
| Behaviour — identity | Exact canonical, bare-number bridge, wrong number, ambiguous suffix, leading zeros, relation-target resolution | `tests/behaviour/queue-ready-identity.test.ts` |
| Behaviour — provider and close | Provider availability and evidence pairing; association, classification, selection, `associatedCount`; ranking | `tests/behaviour/queue-ready-provider.test.ts`, `queue-ready-close.test.ts`, `queue-ready-ranking.test.ts` |
| Behaviour — output | Payload shape, provider-derived caps, reasons, truncation flags, negative controls, read-only execution, determinism | `tests/behaviour/queue-ready-output.test.ts`, `queue-ready-negative-controls.test.ts`, `queue-ready-readonly-determinism.test.ts` |
| Corpus, golden, performance | Every condition state, close class, rank rule, bound, and worked example; byte-identical payload and human text; read-cost and latency bounds | `tests/behaviour/queue-ready-corpus.test.ts`, `tests/golden/queue-ready.test.ts`, `tests/behaviour/queue-ready-performance.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

The default suite is fixture-driven with zero live network calls. Every condition state, close class, ranking rule, provider-derived cap, truncation flag, and worked example is committed under `tests/fixtures/queue-ready/**`, and the corpus meta-check requires complete coverage of the derivation matrix, the close classes, the named source failures, the identity rows, and the cap rows. Golden payload and human bytes pin deterministic output.

An opt-in live smoke runs against this repository with a resolvable credential and asserts structural invariants only: one valid payload, six conditions per candidate, at least one known candidate observed through the identity rule, no ready candidate with a non-satisfied condition, no `merge-ready` without observed approval, no provider evidence record or availability claim using `available`, the declared bounds, and no secrets. It never pins volatile item counts. The live smoke is enabled only by the test-harness-only live switch, read only under `tests/**` and enabled only when its value is exactly `1`; it is never a production or contract constant, configuration key, payload or evidence field, or human-digest token, and it is excluded from the aggregate check. A bounded, secret-free live evidence artifact may be attached to the pull request but is not committed by default.

## Operational & Support

### Configuration

The command consumes the resolved provider configuration branch, the repository binding from `origin`, the checkout HEAD, and the local PM context. It adds no configuration key and no queue-readiness cap or threshold setting; the declared caps, candidate limit, label sets, and byte bounds are contract data in `core ./contracts`.

### Observability

The payload is the observability surface: the standard envelope's `runId` and `timing`, the per-condition evidence (source, reason, bounded detail), the close association and selected pull request, the ranking, the summary counts, and the explicit truncation marker. No telemetry exporter, event sink, or background process is added.

### Cost and read cost

One invocation performs at most three outbound read-only GitHub requests (issues page, pull-request page, check-runs page), one logical verified park-fold read, one configuration resolve, and one local PM-context read. The pure evaluator is linear over capped input. There is no retry loop, pagination crawl, daemon, or new runtime dependency.

### Maintenance

- Adding a readiness condition is a contract change: condition id and order, derivation matrix, evidence, renderer line, and tests.
- Adding a close class or rank bucket is a contract change to the class vocabulary, ranking, payload, and tests.
- Changing the tier-label set, owner-attention label set, candidate cap, evidence cap, provider-derived caps, identity rule, or byte bounds updates the contract, tests, and docs without changing the evaluator architecture.
- A review-capable VCS source makes `merge-ready` reachable, and a relation-capable tracker source makes `deps-satisfied` achievable, without a command change.
- The command is provider-agnostic over normalized views; adding a tracker, VCS, or CI provider is an addressing and configuration story owned elsewhere.
- Condition reasons are evidence vocabulary, not error-table identities; promoting one to an error row requires a named consumer and a reviewed change.

## Dependencies & Risks

- **Depends on** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the bounded read seams, normalized views, CI classification, provider availability vocabulary, repository binding, HEAD facts, and local PM-context projection. Queue ready reuses them and adds no read.
- **Depends on** the provider engine ([feature-provider-engine.md](feature-provider-engine.md)) for the declared chain and verified park vocabulary; queue ready never runs the engine or fetches quota.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the read-only verified park fold; queue ready never writes or repairs the store.
- **Depends on** the configuration layer ([feature-config-layer.md](feature-config-layer.md)) for the resolved provider branch; queue ready adds no keys.
- **Depends on** the provider client seeds ([feature-provider-client-seeds.md](feature-provider-client-seeds.md)) for the bounded GitHub collection reads and normalized views; queue ready adds no adapter operation.
- **Depends on** the adapter ports and credential port ([feature-adapter-ports.md](feature-adapter-ports.md)) for the normalized primitive views, the external-system instance, and credential resolution.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, `input.value.rejected`, `fallback.internal`, and the redaction path; queue ready adds no rows.
- **Depends on** the monorepo scaffold ([feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)) for tiers, boundaries, and runtime-API confinement.
- **Precedes** the full queue family, lanes, dispatch, and per-repo single-flight, which own the queue engine.
- **Risk — a consumer reads `unknown` or `unsatisfied` as ready:** mitigated by the explicit tri-state, the all-six-satisfied rule, and the named blocking conditions.
- **Risk — a close item is missed and reported as a new start:** mitigated by the `unknown` association class and the at-limit rule; association is never invented.
- **Risk — `deps-satisfied` is overclaimed:** mitigated by treating an unavailable relation source and an unobserved target as `unknown`.
- **Risk — provider availability is overclaimed:** mitigated by never running the engine and by the fixed `engine-not-run` companion evidence.
- **Risk — no-run CI is read as green:** mitigated by `succeeded`-only satisfaction.
- **Risk — output grows unbounded or varies with API order:** mitigated by exact caps, deterministic rank and selection keys, truncation markers, and cap-sized golden fixtures.
- **Risk — documentation drift:** mitigated by this in-change current-truth spec and the reconciled status, provider, state, config, result, monorepo, registry, glossary, and index docs.

## Glossary & References

| Term | Definition |
|---|---|
| Ready set | The ranked set of caller-supplied candidate work items with their readiness and close classification. |
| Candidate | One caller-supplied canonical work-item ref evaluated by the command. |
| Readiness condition | One of the six closed predicates: `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available`. |
| Condition state | `satisfied`, `unsatisfied`, or `unknown`; describes the evidence for one condition only. |
| Tri-state | The closed condition-state set `satisfied`, `unsatisfied`, `unknown`, where `unknown` is never ready and never a clear zero. |
| Ready | All six conditions are `satisfied`; any unsatisfied or unknown condition makes the candidate not-ready. |
| Blocking condition | A non-satisfied condition, with its state, listed in `blockingConditions`. |
| Close item | An open pull request associated with the candidate by the repository branch convention; it ranks above a ready new start. |
| Close class | One of `merge-ready`, `review-pending`, `new-start`, `unknown`, `not-ready`. |
| Merge-ready | An associated non-draft open pull request with an observed approved review state; the first rank class. |
| Review-pending | Any other associated open pull request, including draft and unknown review state; the second rank class. |
| New start | A ready candidate whose pull-request association is observed absent; the third rank class. |
| Unknown close association | A ready candidate whose association could not be observed; the fourth rank class. |
| Association | The branch-convention link between a candidate ref and an open pull-request source branch; `associated`, `not-associated`, or `unknown`. |
| Identity bridge | The provider-agnostic rule that matches a canonical ref to an observed provider-native identity: exact canonical match first, then an unambiguous all-digit suffix bridge, never substring, prefix-only, or numeric coercion. |
| Tier label | One of the declared triage labels `priority:high`, `priority:medium`, `priority:low`. |
| Repo-free | No other active change is recorded in the local PM context; the candidate itself does not block itself. |
| Owner gate | An open work item carrying `hand-back` or `human-input-needed`. |
| Provider availability | `parked` when an active provider or chain park exists, otherwise "no active park, engine not run"; never engine-verified. |
| Engine not run | The fixed evidence reason for `provider-available`: the command read configuration and parks but never executed the provider engine. |
| Value-clamped | The payload-level marker that a provider-derived payload value or collection was shortened or reduced to its declared cap; it is verdict-neutral and sets payload `truncated`. |
| Source at limit | The raw source page returned exactly its declared read limit, so more items or matches may exist. |
| Truncation | The explicit marker that evidence records or source coverage were bounded: machine `truncated`, human `+more`; `+more` also marks a defensive reverse-rank drop of candidate lines in the human digest. |

See also: [Status Digest](feature-status-digest.md), [Provider Engine](feature-provider-engine.md), [State Layer](feature-state-layer.md), [Configuration Layer and Inspection](feature-config-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), the [repository glossary](../../overview/glossary.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md), [ADR-0007](../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md), and [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md).

**Change record:** `doc/changes/2026-10/2026-10-31--GH-176--queue-ready/`.
