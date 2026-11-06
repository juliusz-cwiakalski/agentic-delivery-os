---
ados_distribution: internal
id: SPEC-STATUS-DIGEST
status: Current
created: 2026-10-31
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The read-only status command and its bounded delivery.status.v1 digest: nine fixed sections in order, a closed five-value section state, a closed finding-code registry with grouped ranked findings, tri-state hygiene assertions, owner-gate ages, parked conditions, a ready-to-merge action list, declared lane attention-state vocabulary, named spend/blockers placeholders, bounded evidence and counts, deterministic rank keys and truncation, the four tracker families, changes and pull requests, bounded check-runs CI classification, providers read from configuration and the verified park fold, parked work from the git-ignored local PM context, origin-derived repository binding under a credential-reference-only composition guard, the machine envelope and extended human digest grammar, error-identity reuse, and the fixture plus opt-in live-smoke evidence model."
links:
  related_changes: ["GH-175", "GH-176", "GH-183", "GH-178", "GH-228", "GH-224", "GH-243"]
  related_decisions: ["ADR-0003", "ADR-0004", "ADR-0006"]
  contracts:
    - "packages/core/src/contracts/status.ts"
---

# Feature: Status Digest

## Overview

The status command is the read-only first call of a delivery session. It returns one bounded digest of the delivery world instead of requiring the coordinator to probe the tracker, pull requests, CI, lanes, providers, and parked work by hand. The digest is `delivery.status.v1`: a schema version, an injected `generatedAt`, an origin-derived repository binding, summary counts, and exactly nine sections in a fixed order.

Each section carries one state from the closed set `observed`, `degraded`, `unknown`, `unavailable`, and `not-delivered`; a bounded evidence record naming its sources and reasons; uniform counts; a ranked, capped item surface; and an explicit truncation marker. Every section may also carry grouped, registry-coded `findings[]` describing the attention state of its observed evidence. A section state describes the quality and completeness of its evidence, never a global all-clear. A failed, absent, unattempted, or unresolved read is digest data, not a command failure: every successful run returns all nine sections, and only parser or containment failures produce an error envelope.

The machine mode is the standard `CommandResult` envelope whose `data` is the full digest. Human mode is a deterministic, bounded digest rendered from the same data. Status performs zero writes, fences, state mutations, network writes, or child processes. It adds no error-table row, no configuration key, and no state-schema change; it introduces no new package, subpath, or runtime-API location. Closeout is a separate mutating surface: status does not import or compose the closeout engine, the git branch/checkout seam, or provider write operations, and its read-only guarantees are unchanged.

The separate read-only ready-set command that consumes these inputs is specified in [Queue Ready](feature-queue-ready.md); it is a distinct command and does not change the status digest. The status digest's M1-S10 ready-to-merge section reuses the same merge-ready/review-pending classification and deterministic rank keys read-only, with zero new reads; the queue-ready command's own payload, ranking, and cap are unchanged. The owner-facing one-screen projection of the same collector state is specified in [Brief](feature-brief.md); it is a distinct read-only command that consumes these facts without adding a status section, schema, or read, and its nine-surface catalog is its own literal contract. The read-only pre-flight diagnostic is specified in [Doctor](feature-doctor.md); it is a distinct additional consumer of the `origin`-derived binding, the bounded single-page reads, the verified park fold, and the human-renderer hook, and it changes no status section, schema, or read. The surrounding contracts are described in [Result Contract and Error Table](feature-result-contract.md), [Configuration Layer and Inspection](feature-config-layer.md), [State Layer](feature-state-layer.md), [Provider Engine](feature-provider-engine.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), and [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md). Package tiers and runtime confinement follow [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); tracker absence semantics follow [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) and [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md).

## Business Context

### Problem Statement

- **Problem:** The coordinator probes six different sources at the start of every session. Those probes are inconsistent, unbounded, and unable to distinguish a failed read, an absent source, an omitted signal, a missing capability, and a genuinely quiet delivery world. The most expensive outcome is a false all-clear.
- **Affected Users:** The coordinator, lifecycle agents, and operators consuming the session bootstrap; maintainers of the tracker, VCS, CI, provider, and local PM-context sources.
- **Business Impact:** A single typed, evidence-backed digest replaces ad-hoc probing, bounds the session-start token cost, and makes absent or degraded evidence visible instead of presenting as "nothing to do".

### Goals

- Provide one read-only `status` command with no command-specific flags beyond the global machine-output switch.
- Return exactly nine named sections in fixed order, each with a closed state, bounded evidence, counts, ranked items, and truncation.
- Never turn a failed, absent, unattempted, or unresolved read into an observed, clear, green, available, or zero claim.
- Answer the four tracker families from normalized work-item data.
- Report changes and pull requests, CI, providers, and parked work from declared sources with explicit degradation.
- Report the lanes-or-queue section as a declared capability gap, never as an empty queue.
- Cover attention state with stable finding codes: grouped, deduplicated, deterministically ranked findings; a ready-to-merge action list; tri-state hygiene assertions; owner-gate ages; and parked re-entry conditions.
- Keep output deterministic, bounded, brand-neutral, read-only, and within the existing tiers, error table, configuration schema, and secret-read boundary.

## User Experience & Functionality

### Command surface

The command is exactly `status`, composed where the other top-level commands are composed. It accepts no positionals and declares no command-specific flags; `--json` is the existing global machine-output switch and adds no command behavior. An unexpected positional or unknown flag is rejected by the parser before any source read as `fallback.invocation` with exit `1`.

The command handler owns no stream writes and chooses no exit code. It reads the injected sources, assembles the digest, and returns it; the CLI edge renders the human text or the machine envelope. The optional human-text renderer hook on the command-definition contract is invoked by the CLI edge in human mode. Ten command declarers provide the hook: `board`, `brief`, `closeout`, `db`, `doctor`, `plan`, `queue`, `status`, `verify`, and `watchdog`; the CLI-edge seam test pins that exact set. Status is one of them, and doctor is an additional read-only consumer of the same seam, not a new hook.

### Nine sections and five states

The section ids and order are fixed:

| Order | Section id | Title | Primary sources |
|---:|---|---|---|
| 1 | `tracker` | Tracker | Tracker list read plus a declared per-family signal availability |
| 2 | `changes-and-prs` | Changes and pull requests | Local PM context plus the open pull-request list |
| 3 | `ci` | CI | Checkout HEAD plus one bounded check-runs page |
| 4 | `lanes-or-queue` | Lanes or queue | None; declared capability gap |
| 5 | `providers` | Providers | Provider configuration plus the verified park fold |
| 6 | `parked-work` | Parked work | Local PM context's `parked_changes` |
| 7 | `ready-to-merge` | Ready to merge | The existing open pull-request read plus the CI classification |
| 8 | `spend` | Spend | None; named placeholder until M1-S19 |
| 9 | `blockers` | Blockers | None; named placeholder until M1-S16 |

Every section has exactly one state:

| State | Meaning |
|---|---|
| `observed` | Every required source read for the section succeeded, including verified-empty and provider-asserted empty results. Item-level unknown signals may still exist and are counted. |
| `degraded` | Some required evidence is present and some is missing, failed, or declared unavailable. The digest is partial but truthful. |
| `unknown` | No usable evidence remains for the section; it is never a clear or zero claim. |
| `unavailable` | The section's source is known to be absent or not configured, such as no repository binding, no declared provider chain, or no local PM context. |
| `not-delivered` | The capability itself does not exist in this release; used by the lanes-or-queue section and the spend and blockers placeholders. |

Item-level unknown is distinct from a section state. An observed section may contain items whose review state, activity timestamp, or dependency target is unknown; those signals are counted and never fabricated.

### Evidence, counts, truncation, and bounds

The evidence record contains up to six source entries `{ source, outcome, failureCode?, failureClass? }` and up to six unique reasons from a closed set. Sources are `tracker`, `changes`, `ci`, `queue-engine`, `provider-config`, `provider-parks`, `local-context`, and `repository-binding`. Outcomes are `read`, `observed-empty`, `failed`, `not-configured`, and `not-delivered`. Evidence never carries a raw provider payload, response body, credential, arbitrary message, or free-form item content.

The closed reason set is `observed`, `observed-empty`, `read-failed`, `source-unavailable`, `signal-unavailable`, `addressing-unresolved`, `remote-unsupported`, `credential-unavailable`, `config-invalid`, `state-unreadable`, `commit-unresolved`, `provider-chain-not-declared`, `provider-chain-unresolved`, `local-context-missing`, `local-context-malformed`, `local-state-untracked`, `engine-not-delivered`, `source-truncated`, `item-signal-absent`, and `partial-evidence`. Reasons are unique per section and ordered by first occurrence in the fixed source and family order.

Every section owns uniform counts `{ observed, unknown, total, omitted }`. A rendered list that drops items records the drop in `omitted`. Tracker family counts aggregate over the fully ranked family before the render cap, so an observed or unknown item is counted even when the cap omits it; `omitted` remains the number of ranked items the cap dropped. `truncated` is true when output items were dropped, or when the raw source page returned exactly its declared read limit before any object filtering. The source-at-limit signal is therefore visible even when filtering reduces the normalized item count, for example a full issue page that contained pull-request objects.

Declared bounds:

| Constant | Value | Purpose |
|---|---|---|
| `STATUS_MAX_ITEMS_PER_SECTION` | 8 | Rendered-item cap for each non-tracker ranked list |
| `STATUS_MAX_TRACKER_FAMILY_ITEMS` | 4 | Per-family tracker cap; families cap independently |
| `STATUS_MAX_EVIDENCE_SOURCES` | 6 | Evidence source cap |
| `STATUS_MAX_REASONS` | 6 | Unique reason cap |
| `STATUS_MAX_PROVIDER_ENTRIES` | 8 | Provider entry cap |
| `STATUS_MAX_PROVIDER_PARKS` | 8 | Active park cap |
| `STATUS_MAX_PIPELINE_RUNS` | 8 | CI run cap |
| `STATUS_MAX_OPEN_PULL_REQUESTS` | 8 | Pull-request cap |
| `STATUS_MAX_PARKED_CHANGES` | 8 | Parked-work cap |
| `STATUS_MAX_FINDINGS_PER_SECTION` | 8 | Per-section grouped-findings cap; defensive headroom |
| `STATUS_MAX_FINDING_MEMBERS` | 8 | Per-finding member-identity cap |
| `STATUS_MAX_READY_ITEMS` | 8 | Ready-to-merge action-list cap |
| `STATUS_SOURCE_ITEM_LIMIT` | 100 | One bounded issues or pull-requests page |
| `STATUS_SOURCE_PIPELINE_LIMIT` | 20 | One bounded check-runs page, sent as `per_page` |
| `STATUS_MAX_TITLE_CHARS` | 120 | Item title cap |
| `STATUS_MAX_DETAIL_CHARS` | 160 | Safe evidence, reason, or parked-condition detail cap |
| `STATUS_MAX_HUMAN_LINES` | 32 | Human digest line cap; defensive headroom (worst case 11 lines) |
| `STATUS_MAX_HUMAN_BYTES` | 6144 | Human digest byte cap; the operative bound |
| `STATUS_MAX_MACHINE_BYTES` | 65536 | Byte cap on the serialized `data` digest; the envelope total is recorded but not separately capped |
| `STATUS_STALL_THRESHOLD_DAYS` | 14 | Declared stall threshold |
| `STATUS_OWNER_ATTENTION_LABELS` | `hand-back`, `human-input-needed` | Declared owner-attention labels |
| `STATUS_CI_RESULTS` | `failed`, `pending`, `succeeded`, `canceled`, `none`, `unknown` | Declared closed CI result vocabulary; `none` and `unknown` are never green |
| `STATUS_SCHEMA_VERSION` | `delivery.status.v1` | Digest schema version |

### Section state derivation

The matrix is normative. Item-level unknowns do not by themselves turn an observed section into a clear or zero claim.

| Section | `observed` | `degraded` | `unknown` | `unavailable` | `not-delivered` |
|---|---|---|---|---|---|
| tracker | Tracker list read succeeded and all four family signals are available | List read succeeded but at least one family signal is unavailable | List read failed, credential unavailable, or no usable tracker evidence | No repository binding or no tracker source | Never |
| changes-and-prs | Pull-request list succeeded and the active change is observed or observed-empty, with all required signals available | One of the pull-request list or active change failed or is unavailable, or a declared pull-request signal is unavailable | Both sources failed with no usable evidence | No repository binding and the active-change source is absent | Never |
| ci | Commit resolved and the pipeline read succeeded, including no reported runs | Never (single required read) | Commit unresolved or pipeline read failed | No repository binding | Never |
| lanes-or-queue | Never | Never | Never | Never | Always |
| providers | Provider config read succeeded, a default chain is declared, and the park fold succeeded | Config and entries observed but the park fold failed | Config read failed, config invalid, or the declared chain does not resolve to declared entries | No declared default chain | Never |
| parked-work | PM context read succeeded and `parked_changes` is an array, including empty | Never (single required read) | PM context malformed or wrong shape | PM context absent | Never |
| ready-to-merge | Pull-request list read succeeded with review signals available, including verified-empty | Review signals unavailable on any rendered item, or a partial source failure | Pull-request read failed or no usable evidence | No repository binding | Never |
| spend | Never | Never | Never | Never | Always |
| blockers | Never | Never | Never | Never | Always |

Providers resolve by fixed precedence: `unknown` first, then `unavailable`, then `degraded`, then `observed`. A failed or invalid config read, or a declared chain that does not resolve, yields `unknown` even when no default chain is declared. Otherwise an absent default chain yields `unavailable` even when the park fold also failed. Otherwise a park-fold failure yields `degraded`; otherwise the section is `observed`.

### Tracker collector

The tracker collector consumes normalized work items and a declared per-family signal availability. It evaluates only open items, meaning delivery state is neither `done` nor `canceled`. Families appear in the fixed order `ownerHandBacks`, `blockedDependencies`, `stalls`, and `hygiene`. Each family has its own state (`observed` or `unavailable`), its own counts, and at most four ranked items. A family's counts aggregate its fully ranked list before the four-item cap, so an unknown item is counted even when omitted from the rendered list. The tracker section has no common `items` list: the four family lists are its only item surface, so a tracker section may render up to four families of four items. The section's counts aggregate the families, its `omitted` is the family sum, and its `truncated` is true when any family dropped items or the source at-limit signal applies.

- **Owner hand-backs:** An open item carrying a declared owner-attention label, matched case-insensitively. `assignee` is not used because the normalized field is optional and absence means the provider did not supply the signal, not that no assignee exists ([ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md)). Each rendered hand-back carries additive `age`, `ageUnknownReason`, and `slaState` fields projected from the M1-S5 evaluator over the injected clock and the imported policy; unknown age uses the two declared markers and escalates, never `0` or `fresh`.
- **Blocked dependencies:** An open item with a `blocked-by` relation. A target observed as `done` or `canceled` does not leave the item blocked; a target observed as not done leaves it blocked with `dependencyState: open`; a target not observed leaves it blocked with `dependencyState: unknown`, never resolved. When the tracker source declares relations unavailable, the family is `unavailable` with `signal-unavailable`, never an observed empty family.
- **Stalls:** An open item with a parseable provider-native `updatedAt` older than the 14-day threshold is listed as `stalled` with its age. An item at or under the threshold is active and is not listed. An item with absent or invalid `updatedAt` is listed as `unknown` activity. The clock is injected, and no timestamp is derived from comments, ordering, or the current time ([ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md)).
- **Ticket hygiene:** Conformance over mapped normalized data only. Findings are `missing-title` for a blank or empty title and `missing-labels` for an empty label set. The hygiene family also exposes the three named assertions `epic-membership`, `story-points`, and `in-sprint` with additive tri-state counts (`violations`, `unknown`, `satisfied`). Each assertion is gated by a declared per-assertion availability that travels with the tracker read; within a declared available signal, an item carrying no conforming value is a violation (absence-as-violation), while an undeclared signal is all-unknown with `signal-unavailable` and never a violation. Epic membership maps a label equal to `epic` or prefixed `epic:`; story points maps a `points:` label with a parseable non-negative integer; in-sprint maps a present, non-empty milestone. Comment conformance is not evaluated because absent comments mean unknown; unmapped custom-field conformance is not evaluated because no named consumer requires it.

Tracker ranks are deterministic. Owner hand-backs order by label group, then oldest `updatedAt`, then reference. Blocked dependencies order by `unknown` before `open`, then reference. Stalls order oldest stalled first, then unknown-activity reference. Hygiene orders by finding count, then reference.

### Findings layer

Every section may carry an additive optional `findings[]` array. A finding is `{ code, severity, count, members[], evidenceRef }`:

- `code` is a member of the closed ten-code registry in `packages/core/src/contracts/status.ts`; `severity` is the registry default from the closed set `high`, `medium`, `low`.
- `count` is the exact number of coalesced observations. `members` holds at most eight unique identity values in the section's fixed rank order; `evidenceRef` is the first member. A repeated identity appears once while `count` stays exact.
- Findings rank by severity, then count descending, then code ascending, then first occurrence. A per-section cap of eight is defensive headroom: with the shipped registry the reachable maximum is seven in the tracker and one each in CI and parked work.
- Findings are observed-evidence claims (no-evidence-no-claim): a failed, unresolved, unavailable, or not-delivered section emits no finding; the section state and evidence reasons carry the failure.
- The shipped codes are `ci.red-on-main`, `tracker.owner-gate-escalated`, `tracker.stalled-ticket`, `tracker.hygiene.missing-title`, `tracker.hygiene.missing-labels`, `tracker.hygiene.epic-membership`, `tracker.hygiene.story-points`, `tracker.hygiene.in-sprint`, `lane.idle-no-reason` (dormant), and `parked.stale-no-condition`. Four failed runs on the declared primary branch coalesce into one `ci.red-on-main` finding with `count: 4`.

The section `truncated` flag declares a member or findings-cap drop; `counts.omitted` keeps its shipped meaning of ranked items the render cap dropped and is never inflated by member drops.

### Ready-to-merge

The `ready-to-merge` section is the ranked action list. It reuses the queue-ready classification over the existing open pull-request read: an item whose review signal is observed and whose delivery state is `approved` is `merge-ready`; every other open pull request is `review-pending`, including unknown review state. Items rank `merge-ready` first, then numeric-aware ref, then source ref, then target ref, and cap at eight. The section state follows the declared derivation row and is never `not-delivered`. Review signals unavailable degrades the section and renders `merge-ready ?`; a verified-empty list is an observed zero. Each item is `{ ref, class, sourceRef, targetRef, reviewState, ciResult }` and cites observed collector evidence only; it never issues a merge verdict.

### Lanes vocabulary and placeholders

The `lanes-or-queue` section remains exactly the shipped declared gap (capability `queue-lane-engine`, expected story `M2-S1`, reason `engine-not-delivered`) and gains only the additive declared attention-state vocabulary `delivering`, `idle-with-reason`, `idle-no-reason`. No per-lane state is fabricated and the dormant `lane.idle-no-reason` code is never emitted before the lane engine lands.

`spend` (capability `spend-summary`, expected story `M1-S19`) and `blockers` (capability `typed-blockers`, expected story `M1-S16`) are named `not-delivered` placeholders with zero items and counts. Their human lines are pinned: `spend summary arrives with M1-S19` and `typed blockers arrive with M1-S16`. They are removed only by their delivering stories.

### Parked conditions

A parked entry that records a condition projects it as an additive optional `condition` on the parked item, bounded by `STATUS_MAX_DETAIL_CHARS` multibyte-safely; entries without a condition render none. A parked entry with unknown age and no recorded condition contributes to the grouped `parked.stale-no-condition` finding. Free-form notes and undeclared local-context keys never project.

### Changes and pull requests

The section combines the local active change with the open pull-request list. The active change is projected from the local PM context as `workItemRef`, optional `branch`, and optional `changeFolder`, or as `observed-empty`. An absent PM context makes the active change `unknown`, never "none"; a malformed context is also `unknown`.

Open pull requests carry identity, source and target refs, delivery state, and draft status. Review state and review-thread counts are observed-or-unknown item signals. When the bound VCS source declares any of its four delivery signals (`state`, `refs`, `reviewState`, `reviewThreads`) unavailable, the section is `degraded` with `signal-unavailable`. An unavailable `reviewState` or `reviewThreads` signal makes that item-level signal `unknown`, as the minimal GitHub REST list does; review signals are never defaulted to open or zero, and `state` or `refs` unavailability degrades the section without rewriting the observed review signals. A partial source failure yields a `degraded` section. Pull requests rank non-draft before draft, then numeric-aware identity ascending, then source ref, then target ref, and are capped at eight.

### CI

The collector resolves the commit under observation from the current checkout HEAD: the branch name when attached and the full SHA. It reads exactly one bounded check-runs page for that SHA at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20) with no pagination, and classifies every run on that page over the closed `STATUS_CI_RESULTS` vocabulary:

- `failed` when any run failed;
- `pending` when any run is running or queued and none failed;
- `canceled` when any run canceled and none is worse;
- `succeeded` when at least one run succeeded and every run is succeeded or skipped;
- `none` when the read succeeded but no run was reported, or every reported run was skipped.

`none` is explicitly not green, and an all-skipped set is never `succeeded`; `unknown` is also never green. The client reports the raw page size alongside the runs; a raw page of exactly 20 runs drives the `source-truncated` signal even when fewer runs are rendered. An unresolved SHA or a failed read makes the section `unknown` with the reason and failure class, never green. Only the current checkout HEAD is observed; open-pull-request-head CI is deferred. Runs are capped at eight and ranked by severity, then descending numeric run identity when both identities are numeric (otherwise ascending identity text), then pipeline name ascending.

### Lanes or queue

The section is always `not-delivered` with capability `queue-lane-engine`, expected delivering story `M1-S17`, reason `engine-not-delivered`, source `queue-engine`, zero items, zero counts, and an explicit note that no queue or lane engine exists in this release. It is never an observed empty queue, never a fabricated queue, and never a duplicate of `queue ready` (M0-S7). The `queue ready` command is the separate read-only ready-set specified in [Queue Ready](feature-queue-ready.md); it consumes the same tracker, pull-request, CI, provider, and local PM-context inputs, adds no status behavior, and does not fill or change this section.

### Providers

The collector reads the declared provider configuration branch (`provider.defaultChain`, `provider.chains`, `provider.entries`) from the existing resolved configuration snapshot, and reads active park views from the verified state layer's read-only park fold. It does not call provider `resolve`, provider `quota`, or any provider-engine function; it fetches no quota; it writes no park or announcement.

An entry with an active provider park has availability `parked`; the matching active park carries the cause and expiry. An entry without a park is `unverified`, never `available`, because status did not run the engine. Each rendered entry carries `name`, `class`, `enabled`, `availability`, `quotaDeclared`, and `peakDeclared`; the two declaration flags reflect whether the resolved entry declares a quota policy or a UTC peak window. An active chain park marks the chain `parked`. The chain is `declared`, `parked`, `absent`, or `unknown`. A declared chain that does not resolve to declared entries makes the section and the chain `unknown` with reason `provider-chain-unresolved`, `failureCode: "config.value.invalid"`, no `failureClass`, and empty entries and parks; a configuration read that reports `provider-chain-unresolved` produces the same identity. A configuration read that reports `config-invalid` makes the section `unknown` with reason `config-invalid`, the relevant existing `config.*` code, and an `unknown` chain. An absent default chain makes the section `unavailable` with `provider-chain-not-declared` and an `absent` chain. A park-fold failure with observed configuration makes the section `degraded` with the state failure code and no "no parks" claim.

Entries rank `parked` before `unverified`, then enabled before disabled, then name, then class. Active parks rank by soonest expiry, parks without an expiry last, then chain before provider, then name. Both lists are capped at eight.

### Parked work

The source of truth is the local PM context's `parked_changes` array in the git-ignored `.ai/local/pm-context.yaml`. The collector projects only `workItemRef`, optional `branch`, `changeFolder`, `reason`, and optional `parkedAt`. Free-form notes and unrelated fields are never read. An absent file makes the section `unavailable` with `local-context-missing` and an explicit git-ignored marker. Malformed YAML or a non-array `parked_changes` makes it `unknown` with `local-context-malformed`. An explicit empty array is `observed` with `observed-empty`. An entry without `workItemRef` is item-level unknown. Age is derived only from a present, parseable `parkedAt`; otherwise age is unknown and never fabricated. Parked work is explicitly distinct from a provider park.

Parked entries rank by oldest parseable `parkedAt`, absent or invalid timestamps last, then `workItemRef` ascending with numeric-aware `PREFIX-number` comparison, then entries without a reference last ordered by change folder, branch, and reason. The list is capped at eight.

### Repository binding and credential posture

The runtime edge resolves the checkout's `origin` remote through the repository adapter, read-only and without a child process. It parses GitHub HTTPS and SSH forms and binds `owner`, `name`, and `host: github.com`. Userinfo and credentials are discarded and never enter evidence. No `origin`, an unparseable remote, or a non-GitHub host yields an unavailable binding with `addressing-unresolved` or `remote-unsupported`; the tracker, changes, and CI sections then report unavailable or unknown accordingly. No new configuration key and no alternate remote are read.

The status composition admits only a GitHub external-system instance with system kind `vcs` whose auth mechanism is `credential-reference`. An injected instance with any other mechanism, including `anonymous`, is refused at composition before any read. The refusal withholds only the GitHub reads and leaves the local PM context untouched, so the per-section outcome is fixed:

- `tracker` is `unknown` with `credential-unavailable`;
- `ci` is `unknown` with `credential-unavailable`;
- `changes-and-prs` is `degraded` with `partial-evidence` while the local active change is observed, and becomes `unknown` or `unavailable` only when the active-change source is itself absent or unusable.

No affected section is ever `observed` under the guard. Restoring a credential-reference instance returns the normal states: `tracker` is `degraded` on the GitHub slice because blocked-dependency relations are unavailable, and `observed` only when the bound source declares all four family signals; `ci` is `observed`; `changes-and-prs` is `degraded` while review state and threads are unavailable, otherwise `observed`.

### Machine envelope and human digest

`status --json` writes exactly one standard `CommandResult` envelope. Its `data` is the full `delivery.status.v1` digest: `schemaVersion`, `generatedAt`, `repository`, `summary`, and the nine sections. The serialized `data` digest is at most 65 536 bytes; the total envelope size is recorded but not separately hard-capped. A success envelope carries no `error` key.

`summary` counts the nine sections by state and reports `actionable` as the sum of the rendered item arrays of sections 1-6 whose state is `observed` or `degraded`. Tracker family items are counted individually; rendered pull requests, CI runs, provider entries, provider parks, and parked-work items are counted. The ready-to-merge action list and the placeholders contribute zero to `actionable`, so the shipped count is unchanged for identical facts. Two additive summary counts are present: `findingsTotal` (the number of grouped findings across observed and degraded sections) and `placeholderSectionCount` (exactly 2: `spend` and `blockers`; the lanes declared-gap section is excluded).

Human mode renders the same digest deterministically:

```
<binary> status <owner>/<name> @ <branch|detached> <sha7>
tracker    <state>  hand-backs <n> | blocked <state> | stalls <n> (<unknown> unknown) | hygiene <n>
changes    <state>  active <ref|none|unknown> | PRs <n|?> (review state <unavailable|observed|unknown>)
ci         <state>  <failed|pending|succeeded|canceled|none-reported|unknown> (<failed>/<total> jobs)
lanes      not-delivered  no queue or lane engine in this release
providers  <state>  chain <name|none|unknown> | active parks <n|?> | <entries|?> entries
parked     <state>  <n|?> parked changes (git-ignored local state)
```

The header is optional and appears only when the repository binding is observed and the commit SHA is resolved. There is exactly one line per section in the fixed nine-section order, then the attention rollup line. The exact grammar is:

```
<binary> status <owner>/<name> @ <branch|detached> <sha7>
tracker    <state>  hand-backs <n> | gates <n|?> escalated | blocked <state> | stalls <n> (<u> unknown) | hygiene <n> (<a> unknown)
changes    <state>  active <ref|none|unknown> | PRs <n|?> (review state <unavailable|observed|unknown>)
ci         <state>  <failed|pending|succeeded|canceled|none-reported|unknown> (<failed>/<total> jobs)
lanes      not-delivered  no queue or lane engine in this release
providers  <state>  chain <name|none|unknown> | active parks <n|?> | <entries|?> entries
parked     <state>  <n|?> parked changes (git-ignored local state)
ready      <state>  <n|?> ready-to-merge (merge-ready <m|?>)
spend      not-delivered  spend summary arrives with M1-S19
blockers   not-delivered  typed blockers arrive with M1-S16
attention  <n> findings (<code>×<count>[, <code>×<count>][, <code>×<count>][+N])
```

`gates <n>` counts hand-backs whose `slaState` is `escalated` or `default-applied`; `gates ?` appears only when the owner-hand-back family is unavailable. The attention line previews at most three severity-ordered groups, then `+N` counts grouped findings beyond the preview, never raw observations; it renders `attention  0 findings ()` when there are none. Truncation is marked with `+N` when items were omitted or `+more` for a source-at-limit signal. The digest never invents a zero for an unread source: `PRs ?` appears when the pull-request source was not read successfully, and review state is then `unknown`; `merge-ready ?` appears unless review signals are observed. The digest is at most 32 lines (defensive headroom; the structural worst case is 11 lines) and 6144 UTF-8 bytes (the operative enforced bound), contains no raw provider payloads, no item titles, no secrets, and no LLM-generated prose, performs no extra reads, and contains no timestamps.

### Error identity reuse

Status adds no error-table row and no domain kind. Section failures are digest data, not command failures. The status command itself can fail only through `fallback.invocation` for a rejected invocation or `fallback.internal` for containment, both existing entries.

Evidence reuses existing identities only. `failureCode` is an existing `config.*` or `state.*` code when a classified failure occurred. `failureClass` is an adapter-local class such as `provider.payload.invalid` and is never an error-table identity. A provider chain or configuration validation failure carries `failureCode: "config.value.invalid"` with reason `provider-chain-unresolved` and no `failureClass`; a configuration resolution failure carries reason `config-invalid` with the relevant existing `config.*` code. An error-table code such as `provider.chain.invalid` is never used as a `failureClass` or `failureCode`.

## Technical Architecture & Codebase Map

### Core components and directory structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/status.ts` | The complete `delivery.status.v1` vocabulary: section ids, states, reasons, source ids, outcomes, families, item shapes, counts, evidence, repository binding, bounds, rank data, and digest types. Types and `as const` data only. |
| `packages/core/src/domain/status.ts` | The pure aggregator and human renderer: nine section builders, state derivation, evidence assembly, the findings layer, tri-state hygiene assertions, owner-gate projection, ranking, capping, truncation, summary counts, and the extended deterministic grammar over injected facts. No I/O, clock, randomness, or ambient environment. |
| `packages/core/src/contracts/index.ts` | Re-exports the status vocabulary through the shared contracts subpath. |
| `packages/core/src/domain/index.ts` | Re-exports `aggregateStatus` and `renderStatusHuman`. |
| `packages/cli/src/commands/status.ts` | The `status` command definition over injected readers; no stream writes and no exit-code choice. |
| `packages/cli/src/edge.ts` | The status runtime composition: repository binding, credential-reference guard, GitHub collection reads, provider config and park fold, local PM-context read, and clock. |
| `packages/cli/src/index.ts` | The optional pure `humanText` command-definition hook the CLI edge invokes in human mode; ten declarers supply it: board, brief, closeout, db, doctor, plan, queue, status, verify, and watchdog. |
| `packages/cli/src/output/serialize.ts` | The single redacted output path; renders pre-rendered human text when supplied. |
| `packages/adapters/src/github/client.ts` | Bounded `listWorkItems`, `listDeliveryRequests`, and page-limited `readPipelineRun` over the existing read operations. |
| `packages/adapters/src/github/normalize.ts` | Issue-list, pull-list, and check-run normalization that preserves the raw page size and filters pull-request objects before issue normalization. |
| `packages/adapters/src/repo/index.ts` | Bounded `origin` and HEAD facts and GitHub HTTPS/SSH parsing; read-only, no child process. |
| `packages/adapters/src/file/pm-context.ts` | Bounded YAML read of the local PM context with only active-change and parked-change projections; no writes. |

### Data flow

1. The CLI edge resolves the brand and the repository binding from `origin`.
2. When the binding is observed, the edge reads one bounded issues page, one bounded pull-request page, and one bounded check-runs page for the checkout SHA. When it is not observed, it injects classified unavailable reads instead of inventing a target.
3. The edge reads the resolved provider configuration and folds the verified provider park views, then reads the local PM context.
4. The pure aggregator derives the nine section states, ranks and caps the item surfaces, groups findings, evaluates hygiene assertions and gate ages, assembles bounded evidence, and returns the digest.
5. Machine mode wraps the digest in the existing envelope; human mode renders the deterministic digest from the same data.

### API and interface contracts

- **`aggregateStatus(facts: StatusFacts): StatusDigest`** — the only executable aggregation surface. It consumes fully injected facts: clock facts, repository binding and HEAD, the tracker read, the changes read, the CI read, provider config and parks, and the local PM context.
- **`renderStatusHuman(digest, brand): string`** — the only human-rendering surface. It reads no source and derives everything from the digest plus the injected brand binary name.
- **Tracker read result** — either `{ ok: true, items, pageItemCount, availability }` with per-family availability, or a classified read failure.
- **Changes read result** — either `{ ok: true, items, pageItemCount, availability }` with per-signal availability, or a classified read failure.
- **CI read result** — either `{ ok: true, items, pageItemCount }` or a classified read failure.
- **Provider facts** — either a resolved configuration or `{ ok: false, reason: "config-invalid" | "provider-chain-unresolved", failureCode? }`, plus either verified park views or a `state-unreadable` failure.
- **Local-context read result** — either `{ ok: true, context: { path, tracked: false, activeChange?, parkedChanges } }` or `{ ok: false, reason: "missing" | "malformed", path }`.

The status contracts and domain import only the shared contracts and their own modules. The GitHub, repository, and file I/O stay in their already-admitted adapter subpaths. No new package, subpath, or runtime-API location is introduced.

## Security and Boundaries

- **Read-only by construction:** status calls no write or fence API, no tracker, pull-request, or CI write, no provider engine, and no quota endpoint. It cannot mutate an artifact or provider state.
- **Credential centralization:** the only credential access is the credential port resolving the declared GitHub credential reference. Status code reads no ambient environment, adds no secret-read allowlist entry, and adds no credential-material path.
- **Composition guard:** only a credential-reference GitHub instance is admitted; an anonymous or otherwise configured instance is refused before any GitHub read while the local PM context remains readable.
- **No shell or spawn:** repository binding and HEAD facts come from bounded git metadata reads through the repository adapter. Status spawns no child process and executes no shell.
- **Bounded addressing:** only the `origin` remote is read; only `github.com` is accepted; userinfo and credentials are discarded; non-GitHub hosts are unavailable, not attempted.
- **Bounded parsing:** the local PM context uses the same bounded YAML 1.2 core parsing as existing file reads; parse failures are classified as evidence, never raw parser output.
- **Bounded input and output:** source pages, per-section items, evidence entries, machine bytes, and human bytes are capped, and truncation is explicit.
- **No leakage:** evidence carries codes, classes, counts, and safe locations only. The serialization redaction chokepoint covers the envelope and human text, and provider payload failures surface as adapter-local classes, never raw bodies.
- **Brand neutrality:** no product or binary literal is committed. The human header uses the injected brand binary name. The only provider-specific literals are the declared credential key and the GitHub host.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Section totality | Exactly nine sections in fixed order; one state from the five-value set per section; evidence, counts, items, findings, and truncation present on every section; zero missing and zero extra sections. |
| Non-verdict guarantee | Failed, absent, unattempted, or unresolved reads never render as observed, clear, green, available, or zero; active parks are never available; no-run CI is never succeeded; the queue is never an observed empty queue. |
| Bounds | Serialized `data` digest at most 65 536 bytes; human digest at most 32 lines and 6144 bytes; every cap enforced; every dropped or limit-truncated case marked. |
| Read-only and determinism | Zero writes, fence acquisitions, state mutations, network writes, or child processes; identical injected inputs produce identical digest and human bytes. |
| Output contract | `--json` produces exactly one valid envelope; human mode produces exactly nine section lines plus the attention rollup and optional header; rendering performs zero extra reads. |
| Error-table stability | Zero new rows or domain kinds; zero documented-table drift; the sync check stays green. |
| Boundaries and branding | Zero new runtime-API locations or secret-read allowlist entries; zero product literals; structure, boundary, ambient, and literal gates stay green. |
| Performance and read cost | Pure aggregation over cap-sized inputs completes within 50 ms on the reference environment; at most three network reads, one logical park-fold read, and one configuration resolve per invocation; zero retries or loops. |
| Privacy | Zero secrets or raw provider payloads in the digest, evidence, or human text; no ambient environment reads outside the allowlist. |
| Real evidence | The default suite exercises every section and state edge from committed fixtures with zero live calls; the opt-in live smoke asserts structural invariants without pinning volatile counts. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract vocabulary, finding-code registry, declared constants and bounds, data-only contracts, pure domain imports, command import discipline, error-identity reuse, no product literals, inventory registration | `tests/structure/status-contract.test.ts`, `tests/structure/status-findings-contract.test.ts`, `tests/structure/status-imports.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json` |
| Behaviour | Command surface, nine-section totality, Appendix A state derivation, tracker families and tri-state hygiene assertions, changes and CI classification, lanes gap and vocabulary, providers and parks, parked work and conditions, owner-gate ages, ready-to-merge action list, placeholders, findings grouping and caps, repository binding, negative controls, evidence hygiene, read-only execution, determinism | `tests/behaviour/status-command.test.ts`, `status-section-states.test.ts`, `status-tracker.test.ts`, `status-changes-ci.test.ts`, `status-providers-parked.test.ts`, `status-repository.test.ts`, `status-findings.test.ts`, `status-findings-bounds.test.ts`, `status-hygiene.test.ts`, `status-owner-gate-age.test.ts`, `status-parked-conditions.test.ts`, `status-ready-to-merge.test.ts`, `status-placeholders.test.ts`, `status-negative-controls.test.ts`, `status-readonly-determinism.test.ts` |
| Output and golden | Machine envelope and 64 KiB bound, human grammar and bounds, caps and truncation, golden bytes | `tests/behaviour/status-output.test.ts`, `tests/golden/status-digest.test.ts` with `tests/fixtures/status/golden/**` |
| Corpus and performance | Committed fixture corpus for every section and state edge; injected-clock cap behaviour; three network reads, one park fold, one config resolve; 50 ms aggregation bound | `tests/behaviour/status-corpus.test.ts` with `tests/fixtures/status/corpus/**`, `tests/behaviour/status-performance.test.ts` |
| Provider read side | Bounded issue and pull-request list pages, at-limit raw page size, absent relations and review signals, check-runs page limit, trap replay and firing negative controls | `tests/behaviour/providers/github-collection.test.ts`, `tests/behaviour/providers/github-trap.test.ts`, `tests/structure/trap-catalog.test.ts` |
| Live smoke | Opt-in structural assertions against a real repository | `tests/behaviour/status-live.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

The fixture model is explicit. Each committed corpus case under `tests/fixtures/status/corpus/**` declares, for every section, the expected state, reasons, counts, ordered item identities, grouped findings tuples, hygiene tri-state counts, and truncation flag. The corpus covers fully observed data, the GitHub tracker-degraded slice, failed issues/pull-request/check-run reads, a missing credential, an unresolved SHA, an unresolved repository binding, a torn park store, a missing default chain, an unresolved declared chain, a missing PM context, a malformed PM context, an active provider park, four red primary-branch runs grouped into one finding, a failed CI read with no finding, the four hygiene arms (tri-state, absence, satisfied, all-unknown), observed and unknown owner-gate ages, parked conditions present and stale-grouped, the lanes vocabulary, the spend/blockers placeholders, ready-to-merge observed and degraded, and the all-caps machine-bound case. A completeness meta-check requires every section, every state in the derivation matrix, the named case classes, and the named AC-F9-1 controls; corrupted states, counts, identities, findings tuples, hygiene counts, or truncation flags fail by case name. The shared harness under `tests/fixtures/status/harness.ts` and the scenario map under `tests/fixtures/status/scenarios.ts` supply the injected facts and read results. The golden digest and human text under `tests/fixtures/status/golden/**` pin byte-identical output and are never rewritten by the suite.

The live smoke is opt-in and outside the aggregate check. It runs only when a test-only switch under `tests/**` is enabled together with a resolvable GitHub credential. It asserts structural invariants only: nine sections in order, evidence present, bounds, no secrets, the lanes/spend/blockers sections not delivered, the declared lane vocabulary without any per-lane state or dormant code, every finding registry-coded with a registry severity, no finding from a failed read, no provider entry `available`, and no observed-with-zero section after a failed read. It never pins volatile item counts. The switch literal lives only in the test tree; any production edge that exposes it derives the name from the injected brand environment prefix. A bounded, secret-free live evidence artifact may be attached to the pull request but is not committed by default.

## Operational & Support

### Configuration

The command consumes the resolved provider configuration branch and reads the repository binding from `origin`. It adds no configuration key, no tracker or VCS instance branch, and no status-specific cap or threshold setting. The declared caps, the 14-day stall threshold, and the owner-attention label set are contract data in `core ./contracts`.

### Observability

The digest itself is the observability surface: the standard envelope's `runId` and `timing`, the per-section evidence (sources, outcomes, reasons, failure codes or classes), the explicit truncation markers, and the deterministic human digest. No telemetry exporter, event sink, or background process is added.

### Cost and read cost

One invocation performs at most three outbound read-only GitHub requests, one logical verified park-fold read, and one configuration resolve. The pure aggregator is linear over capped input. There is no retry loop, pagination crawl, daemon, or new runtime dependency.

### Maintenance

- Adding a section is a contract change to the section id and order, state derivation, renderer line, and tests.
- Adding a collector inside an existing section is a source and availability change plus fixtures.
- Adding a tracker or VCS provider is an addressing and configuration story; the collectors and predicates consume normalized views and stay provider-agnostic.
- Changing a cap, the stall threshold, or the owner-attention label set updates the contract, tests, and documentation without changing the collector architecture.
- The GitHub trap catalog is the early-warning surface for list, page-limit, mixed-object, and absent-signal behavior. Every new list-shaped quirk joins as a four-field trap entry with a fixture and a matching assertion.
- Section failure classes are evidence, not error-table identities; promoting one to an error row requires a named consumer and a reviewed change.

## Dependencies & Risks

- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for verified reads and the read-only provider park fold; status never writes or repairs the store.
- **Depends on** the provider client seeds ([feature-provider-client-seeds.md](feature-provider-client-seeds.md)) for normalized work-item, delivery-request, and pipeline-run views and for the bounded GitHub collection reads.
- **Depends on** the adapter ports and credential port ([feature-adapter-ports.md](feature-adapter-ports.md)) for the primitive views, the external-system instance, and credential resolution.
- **Depends on** the configuration layer ([feature-config-layer.md](feature-config-layer.md)) for the resolved provider branch; status adds no keys.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, existing failure identities, exact-code classification, and the sole redaction path; status adds no rows.
- **Depends on** the monorepo scaffold ([feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)) for tiers, boundaries, and runtime-API confinement.
- **Enables** `queue ready` (M0-S7) ([Queue Ready](feature-queue-ready.md)), which consumes the read seams, normalized views, CI classification, and provider availability vocabulary established here without changing the digest; **enables** `brief` (M1-S6) ([Brief](feature-brief.md)), which projects the same collector facts into the owner's one-screen render with zero brief-specific reads; **precedes** M1-S10 collector expansion and M2-S4 shared board state.
- **Risk — degraded evidence read as an all-clear:** mitigated by the explicit five-state vocabulary, evidence reasons, and an exhaustive negative-control matrix.
- **Risk — provider park shown as available capacity:** mitigated by `parked`/`unverified` availability and by never running the provider engine.
- **Risk — queue gap mistaken for an empty queue:** mitigated by the always-`not-delivered` section and its explicit note.
- **Risk — absent signals fabricated:** mitigated by item-level unknown states, the declared per-source availability, and ADR-0004/ADR-0006 absence rules.
- **Risk — unbounded output:** mitigated by exact caps, source read limits, byte bounds, and truncation evidence.
- **Risk — credential or provider payload leakage:** mitigated by credential-port-only resolution, bounded evidence, and the serialization redaction chokepoint.
- **Risk — documentation drift:** mitigated by this in-change current-truth spec, the reconciled provider/state/config/result/monorepo docs, and the literal and distribution checks.

## Glossary & References

| Term | Definition |
|---|---|
| Status digest | The bounded `delivery.status.v1` payload: nine sections, states, evidence, counts, ranked items, findings, and truncation markers. |
| Finding | A grouped attention item: a registry code, severity, exact count, bounded identity members, and representative evidence. |
| Finding code | A stable symbolic identifier from the closed contract-data registry (`<surface>.<finding>`), referenced by agents and tests instead of re-derived. |
| Severity | The closed attention weight `high`, `medium`, `low`, declared per code in the registry. |
| Grouping | Per-section coalescing of same-code observations into one finding with an exact count and bounded member list. |
| Action list | The ready-to-merge section's ranked item surface: merge-ready first, deterministic rank keys, capped. |
| Hygiene assertion | A named mapped-data conformance check (`epic-membership`, `story-points`, `in-sprint`) with tri-state violation/unknown/satisfied counts. |
| Absence-as-violation | Within a declared, available signal, an item with no conforming value violates the assertion. |
| Mapped-signal availability | The declared per-assertion statement, traveling with the tracker read, that a hygiene signal is mapped and evaluable. |
| No-evidence-no-claim | A failed or unresolved read emits no finding for its section; the section state and evidence reasons carry the failure. |
| Unknown age | A declared marker for an absent or unparseable activity timestamp; the gate escalates and age is never fabricated. |
| Placeholder section | A named `not-delivered` section declaring a capability and its expected delivering story (`spend` → M1-S19, `blockers` → M1-S16). |
| Dormant code | A registry code declared but untriggerable until its delivering story lands (`lane.idle-no-reason` until M1-S17). |
| Attention rollup | The final bounded human line previewing up to three severity-ordered finding groups, then `+N`. |
| Section state | One of `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`; describes evidence quality and availability, not a global all-clear. |
| Evidence record | The bounded sources, outcomes, reasons, and failure codes or classes that justify a section or item state; never raw provider payloads. |
| Observed | Every required source read for the section succeeded; item-level unknown signals may still exist and are counted. |
| Degraded | Some required evidence is present and some is missing, failed, or unavailable; the digest is partial but truthful. |
| Unknown | No usable evidence remains for the section or signal; never a clear or zero claim. |
| Unavailable | The section's source is known to be absent or not configured. |
| Not-delivered | The capability itself does not exist in this release; used by the lanes section and the spend and blockers placeholders. |
| Item-level unknown | A signal on an individual item is absent or unavailable; it is counted and never fabricated. |
| Source availability | The declared per-family and per-signal statement of what the bound adapter supplies, which decides whether a family or item signal is observed or unavailable. |
| Owner hand-back | An open work item carrying a declared owner-attention label; absent assignee is not used as a signal. |
| Blocked dependency | An open work item with a `blocked-by` relation whose target completion is observed or explicitly unknown, never assumed resolved. |
| Stall | An open work item whose provider-native last-modified timestamp is older than the declared threshold; absent or invalid activity is unknown. |
| Ticket hygiene | Conformance over mapped normalized data: non-blank title and non-empty label set. |
| Active change | The local PM context's `active_change`: work-item ref, branch, and change folder; git-ignored local state whose absence is unknown. |
| Parked work | A non-provider delivery change recorded in the local PM context's `parked_changes`; distinct from a provider park. |
| Provider park | A named, self-expiring provider or chain availability pause read from the verified state fold; distinct from parked delivery work. |
| Provider entry availability | `parked` when an active park exists, `unverified` otherwise; status never claims `available` because it does not run the engine. |
| Repository binding | The `origin`-derived GitHub owner, name, and host used for read-only tracker, pull-request, and CI reads; no credentials or userinfo. |
| Source truncation | The explicit marker that output items were dropped by a cap or that the source returned its declared read limit, so more may exist. |
| Live smoke | The opt-in, credentialed structural test against a real repository; not a default-CI network test. |

See also: [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [State Layer](feature-state-layer.md), [Provider Engine](feature-provider-engine.md), [Configuration Layer and Inspection](feature-config-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Brief](feature-brief.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Verify Gates](feature-verify-gates.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), the [repository glossary](../../overview/glossary.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md). Verify Gates reuses `STATUS_OWNER_ATTENTION_LABELS`, `STATUS_CI_RESULTS` (including `unknown`), and `STATUS_SOURCE_PIPELINE_LIMIT` by reference; status remains a digest, not a merge-gate verdict.

**Change record:** `doc/changes/2026-10/2026-10-31--GH-175--status-v1/`.
