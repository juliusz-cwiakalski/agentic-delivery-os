---
ados_distribution: internal
id: SPEC-BOARD
status: Current
created: 2026-11-16
last_updated: 2026-11-26
owners: ["engineering"]
service: delivery-os
summary: "The read-only `board` command and its bounded delivery.board.v1 payload: the delivered four sections (active lanes, open gates, owner asks, parked work) plus the additive actions section, in declared order from the one shared delivery.status-facts.v1 bundle, the repository's own action registry, and the shipped lane/phase fold; the preserved owner-gate SLA as the gates section; the additive optional lane-row worktree path, contributed by a (repository, ref)-keyed join over the newest dispatch lane record that never mints rows; repository selection (invoking checkout, `--project <repoKey>`, `--all`) over the managed set with the 128-included-repository cap and counted overflow; the additive `repositories[]`, `stateSource`, `scope`, `selection`, `ownerHold`, and `omittedBySection` members; per-section row identity, ordering, bounds, and the declared byte-guard drop order; the deterministic five-section human screen; exit `0`/`1`/`2` with `board.repository-unknown`, `board.state-unavailable`, the delivered collector family, and `fallback.invocation`; the read-only carve-out for the idempotent owner-gate decision record; and the mount as the 21st prompt-required family."
links:
  related_changes: ["GH-229", "GH-237", "GH-230", "GH-288", "GH-294", "GH-309", "GH-297", "GH-296", "GH-287", "GH-295", "GH-404", "GH-413"]
  related_decisions: ["PDR-0003", "ODR-0004"]
  contracts:
    - "packages/core/src/contracts/owner-gate-sla.ts"
    - "packages/core/src/contracts/status.ts"
    - "packages/cli/src/commands/board.ts"
---

# Feature: Board

## Overview

`board` is the owner's and coordinator's one-screen fleet view. One invocation renders the declared sections in fixed order — `LANES`, `GATES`, `ASKS`, `ACTIONS`, `PARKED` — covering the active lanes, the open owner gates with their SLA posture, the open owner questions with their drawn defaults, the open retro improvement obligations with their aging state (GH-287), and the parked lanes with their reason and expiry. Every row names its repository key, its ref, and its owner, so several checkouts never blend into one another. The delivered four sections keep their order, caps, and semantics; `ACTIONS` is additive under the kept `delivery.board.v1` identity.

The board reads from one named shared state source plus the repository's own action registry. `GATES`, `ASKS`, and `PARKED` read the same per-repository status facts (`delivery.status-facts.v1`) that `collectStatusFacts` composes for `status` and `brief` — tracker work items, the blocker ledger, and the park projection — and the payload names that source as `stateSource: "delivery.status-facts.v1"`. `LANES` reads the shipped lane/phase state, declared as the `lanes` collector in the payload's per-repository collector evidence. `ACTIONS` reads the repository's own action registry through one bounded read, declared as the `actions` collector in the same evidence. The same `stateSource` identity is carried additively on the `status` and `brief` payloads, so "board, brief, and status share one state source" is a runtime equality across three payloads, not a prose claim.

Repository scope is repository-keyed and never group-scoped. The default is the invoking checkout; `--project <repoKey>` narrows to one managed repository; `--all` spans every managed repository on the host, bounded to 128 included repositories with the overflow counted. The delivered owner-gate SLA is preserved verbatim as the gates section: the same collector mapping, 24 h escalation and 72 h default-on-expiry with `>=` boundaries, the PDR-0003 two-row policy map, waiver recording, ranking, gate cap, and append-only idempotent decision record ([Owner-Gate SLA](feature-owner-gate-sla.md)).

A board is a bounded summary, not a replacement for `lanes list`, `queue list`, or `blockers list`. Every drop — a row or a repository — is counted, so a short screen never implies a complete fleet.

## Business Context

### Problem Statement

- **Problem:** The four things a coordinator actually reconstitutes every morning — active lanes, open gates, owner asks, parked work — live on separate surfaces, in separate checkouts. Correlation is manual, so the fleet is re-derived per checkout and a multi-repository host has no single truthful screen. A gate-only view cannot answer who owns what, which ask is waiting on which ref, or why a lane is parked.
- **Affected Users:** The owner acting on gates and asks, the coordinator selecting next work across checkouts, lifecycle agents that consume machine output, and maintainers of the status fact bundle and the lane fold.
- **Business Impact:** One deterministic fleet screen turns four reads and a manual join into one bounded observation. Naming the shared source makes the "one state source" claim checkable at runtime, which protects every future surface from forking the state vocabulary.

### Goals

- Render the coordination sections on one deterministic, bounded screen.
- Project those sections from one named state source shared with `status` and `brief`.
- Span managed repositories without mixing their state, under a declared cap.
- Preserve the delivered owner-gate SLA rather than re-implement it.
- Fail closed: an unreadable source withholds the board with a classified identity; within a produced board every omission is counted.
- Mount the command at the production entrypoint with help, a reference page, and a coverage-inventory row.

## User Experience & Functionality

### Command surface

The command is exactly `<binary> board [--all] [--project <key>] [--json]`. `--all` takes no value; `--project` requires one; `--json` is the global machine-output switch. Zero positionals are accepted.

A grammar violation — an unknown flag, any positional, `--all` together with `--project`, or `--project` with no value — is refused through the delivered containment identity `fallback.invocation` at exit `1` before any source is read. The command handler owns no stream writes and chooses no exit code.

| Invocation | Meaning |
|---|---|
| `board` | The invoking checkout alone; zero host-index reads |
| `board --project <repoKey>` | One managed repository by clone identity (the delivered `repoKey` field) |
| `board --all` | Every managed repository on the host, under the 128 cap |
| `board --json` | The machine envelope instead of the human screen |

### Sections

The screen and the payload carry the same declared sections in the same declared order.

| Order | Section | Population | Row identity |
|---:|---|---|---|
| 1 | `LANES` | Active lanes only: the shipped fold's `delivering` and `failed` lanes | `(repository, ref)` |
| 2 | `GATES` | The delivered open owner-gate population with its SLA posture | `(repository, id)` |
| 3 | `ASKS` | Open `owner`-audience typed questions with their drawn default | `(repository, id)` |
| 4 | `ACTIONS` | Open retro improvement actions with owner, level, age, aging state, and window count/limit (GH-287) | `(repository, actionId)` |
| 5 | `PARKED` | Open lane park episodes with reason and `until` | `(repository, ref)` |

Every row names its repository key, its ref (or the source's declared absence), and its owner. Within each array the order is repository key ascending, then the section's declared rank or ref order; no collector, provider, filesystem, or host-index return order influences a rendered order. Every identity is unique within its array, so two repositories holding the same ref produce two distinct rows.

**Lanes.** An active-lane row carries `repository`, `ref`, `laneId`, `state` (`delivering` or `failed`), `phase`, optional `phaseUnknownReason`, `holder`, optional `leaseId`, optional `reason`, `owner`, `ownerSource: "lane-lease-holder"`, and one additive optional `worktreePath`. `phase` is the one phase-state entry the shipped fold reports in progress (`completed: null`); when several entries are open, the open entry latest in the canonical lifecycle order is reported. No phase record yields `phase: null` with `phaseUnknownReason: "phase-unrecorded"`; a record whose entries are all completed yields `phase: null` with `"phases-complete"`. `holder` is the recorded live lease holder, or `null`; the row's `owner` equals that holder. Neither value is inferred. A lane's `worktreePath` comes from a `(repository, ref)`-keyed join over each repository's own newest `dispatch.lane` record: every record's origin repository identity is re-keyed onto the board's repository key before projection, the newest record for the pair decides (a newer record with no worktree path removes the value rather than leaving a stale one), the join contributes a path to a row that already exists and never mints a row, and a lane with no worktree context (the disable-worktrees shape) renders byte-identically to a row with no worktree member. Idle, waiting, parked, merge-ready, and in-review lanes are not board rows; `lanes list` remains the complete lane surface ([Scheduling Engine](feature-scheduling-engine.md)).

**Gates.** A gate row extends the delivered gate record — `id`, `kind`, `ref`, `age`, optional `ageUnknownReason`, `slaState`, `default`, `waivedBy` — with `repository`, `condition` (`<kind>:<slaState>`), `owner`, and `ownerSource`. The owner is the recorded waiver authorizer for a `waiver` gate and the owner audience for an `owner-review` gate; `ownerSource` names which. The gates section carries the delivered SLA semantics unchanged; see [Owner-Gate SLA](feature-owner-gate-sla.md) for the mechanism.

**Asks.** An ask row carries `repository`, `id`, `type` (the delivered closed question-type set), `ref` (a string or the delivered bare `null`), `lane`, `question` (bounded), `askedAt`, `age` in milliseconds, `status: "open"`, `owner`, `ownerSource: "ask-audience"`, `drawnDefault`, and `defaultState`. `drawnDefault` is the delivered PDR-0003 policy default for a defaultable gate on the same canonical ref, or `null`. `defaultState` is `none` when no defaultable gate exists on that ref (or the question names no ref), `pending` when one exists with no decision record, and `applied` when a record exists — including one this same invocation appended, because the join reads the invocation's post-append decision set and performs no second history read. `none` is a declared value, never an omitted field. Coordinator-audience questions are not asks. A ref-less question carries the delivered bare `ref: null`; the delivered question view records no absence reason, so the board invents none.

**Parked.** A parked row carries `repository`, `ref`, `reason`, `until`, optional `untilReason`, optional `preservation` (`preserved` or `session-state-not-preserved`), optional `providerProfile`, `owner`, and `ownerSource: "park-control"`. The population is the shipped open lane park-episode projection — `peak-window` and `owner-hold` only — and its writers are the daemon's peak-window watch, the dispatch-owned peak-window watch for a lane a one-shot invocation started, and `dispatch stop <ref>`, so a dispatch-owned pause appears in `PARKED` from the same durable park record with no additional read and no second vocabulary. The dispatch-owned writer is composed only for a harness that declares the terminate operation: a terminate-less harness such as the Claude Code adapter produces no episode, so its lanes never appear here as parked for a peak window. A `provider-quota` park is a provider/queue condition, not a lane park episode, and never appears. A `liveness-stall` park is a lane-supervision condition surfaced by `lanes list|show`; it is not a board `PARKED` row. An `owner-hold` row carries `until: null` with `untilReason: "owner-hold-no-expiry"`, the classified absence — never a fabricated expiry. A parked row carries no refusal and projects no `recoveryRefusal` member: a refusal is never a park-record member, and a dispatch-owned episode's only refusal is its terminal exhaustion record with the delivered typed question. The host-wide owner hold is carried once on the payload as `ownerHold`, so an idle fleet never reads as an unexplained all-clear.

### Shared state source

`stateSource` is the declared identity token `delivery.status-facts.v1`. It names the per-repository status facts that `collectStatusFacts` composes: `status` aggregates them, `brief` re-projects them, and the board's gates, asks, and parked sections read them. The value is identical on all three payloads, so a consumer can assert the shared-source claim from payload data.

The board's lanes read is not part of that bundle: it is the shipped lane/queue fold, which reads the same per-repository state layer and is named per included repository in `collectors[]` as `{ collector: "lanes", outcome: "available", repository }`. The tracker read appears beside it as `{ collector: "tracker", ... }`. No section reads a source outside the shared bundle plus the shipped lane/phase fold, and the board declares no parallel state vocabulary, second state layer, or duplicate tracker read model.

The group-scoped `status --project <groupKey>` form is a different payload and carries no `stateSource`; only the repository-scoped digest, the brief, and the board carry the identity.

### Repository selection

Selection is repository-keyed throughout. The board never enumerates a project group and has no group-scoped form.

| Selection | `scope` | `selection` | Included repositories | Host-index reads |
|---|---|---|---|---|
| `board` | `repository` | `current` | Exactly the invoking checkout's repository key | 0 |
| `board --project <repoKey>` | `repository` | `project` | Exactly the requested key | 1 |
| `board --all` | `repository` | `all` | The retained managed set, ascending, ≤ 128 keys | 1 |

The managed set is the host index's recorded checkouts whose root still exists, plus the invoking checkout when it is bound and not already recorded; the index record wins on a key collision. A recorded checkout whose root is absent is not a board repository. An absent host index means the managed set is the invoking checkout alone (or empty when unbound) and is not an error; a present but unreadable or unparsable index is `board.state-unavailable` at exit `2`.

`--project <repoKey>` resolves against the full managed set, not the retained subset, so a key beyond the ascending cap is still a valid target. A key outside that set is refused as `board.repository-unknown` at exit `1`, with no section or repository row rendered.

The default form reads no host index. When the invocation is outside any work tree, or its clone identity cannot be derived, the board resolves the declared `unbound` scope: `scope: "unbound"`, `repositories: []`, empty sections, the delivered bounded unbound-scope warning where the invocation resolves outside a work tree, and exit `0` — never an error, never a host-index fallback, and never a claim about a repository. `--all` and `--project` always report `scope: "repository"`, even when `repositories[]` is empty.

### Repository cap and retained set

`BOARD_MAX_REPOSITORIES` is 128 included repositories per board. `repositories[]` ascends by key, is unique, and always includes the selected repository — the invoking checkout for the default form and, when the invocation is bound, for `--all`; the requested key for `--project`.

When the managed set exceeds 128, the retained set is the first 128 keys ascending if the invoking key is among them, or if the invocation is unbound; otherwise it is the first 127 keys ascending plus the invoking key, re-sorted ascending. `truncated` is `true` and `omittedBySection.repositories` equals the number of managed keys not retained. A `--project` target beyond the cap is still reached because `--project` resolves against the managed set, not the retained subset. The board reads only included repositories.

At the 41-character key bound the repository list stays under 9% of the payload byte cap, which leaves the row budget intact.

### Payload contract

The machine payload keeps the `delivery.board.v1` identity and is extended additively: nothing is removed, renamed, or re-semanted, so an M1 consumer written against the gate grid keeps reading valid gate records.

```
board.data = {
  schemaVersion: "delivery.board.v1",
  audience: "owner" | "coordinator",
  scope: "repository" | "unbound",
  selection: "current" | "project" | "all",
  repositories: ["<repoKey>", ...],
  lanes:   [{ repository, ref, laneId, state, phase, phaseUnknownReason?, holder, leaseId?, reason?, owner, ownerSource, worktreePath? }],
  gates:   [{ repository, id, kind, ref, age, ageUnknownReason?, slaState, default, waivedBy, condition, owner, ownerSource }],
  asks:    [{ repository, id, type, ref, lane, question, askedAt, age, status, owner, ownerSource, drawnDefault, defaultState }],
  actions: [{ repository, actionId, owner, level, age, agingState, window, windowOpenCount, windowLimit }],
  parked:  [{ repository, ref, reason, until, untilReason?, preservation?, providerProfile?, owner, ownerSource }],
  collectors: [{ collector, outcome, repository }],
  ownerHold: { active: false } | { active: true, source: "env" | "marker", reason? },
  stateSource: "delivery.status-facts.v1",
  truncated: boolean,
  omitted: number,
  omittedBySection: { repositories, lanes, gates, asks, actions, parked }
}
```

`truncated` is `true` when any row or repository was dropped by a cap or the byte guard, or when a displayed field was clamped. `ownerSource` is drawn from the closed set `lane-lease-holder`, `gate-waiver-authorizer`, `gate-audience`, `ask-audience`, `park-control`; `owner` is `null` only when the source records none, and is never invented. The payload lives inside the unchanged five-field `delivery.result.v1` envelope, with all new keys under `data`.

### Human screen

The human screen is deterministic, TTY-independent, ANSI-free, and takes its binary name from the brand seam. It renders one header, one label line per section, and the section's rows:

```
<binary> board  audience=owner  scope=repository  selection=all  repositories=2  collectors=tracker:available,lanes:available,...
LANES
<repository>  <ref>  state=<state>  phase=<phase|phaseUnknownReason|null>  holder=<holder|null>
GATES
<repository>  <id>  <kind>  <ref>  age=<age>  sla=<state>  default=<default|null>  waivedBy=<principal|null>  owner=<owner|null>  cond=<kind>:<slaState>
ASKS
<repository>  <id>  ref=<ref|null>  age=<age>  default=<drawnDefault|none>:<defaultState>  owner=<owner|null>
ACTIONS
<repository>  <actionId>  owner=<owner>  level=<level>  age=<age>  aging=<state>  window=<window>:<openCount>/<limit>
PARKED
<repository>  <ref>  reason=<cause>  until=<instant|untilReason|null>  owner=<owner|null>
```

An empty board or the `unbound` scope renders `<binary> board  observed-empty  scope=<scope>  selection=<selection>  repositories=<n>  collectors=<evidence>`. A section label appends ` +N more <section> omitted` when the human cap, the machine cap, or the byte guard dropped rows. `age` renders as `<n>m` under one hour, `<n>h` under two days, and `<n>d` thereafter; unknown age renders `unknown:<reason>`; a negative age renders its signed millisecond value. The screen contains no titles, bodies, comments, secrets, or generated prose.

### Bounds

| Bound | Value |
|---|---|
| Gates per repository | 8 (delivered `BOARD_MAX_GATES`) |
| Lanes per repository | 20 (`BOARD_MAX_LANES`) |
| Asks per repository | 8 (`BOARD_MAX_ASKS`) |
| Actions per repository | 8 (`BOARD_MAX_ACTIONS`) |
| Parked rows per repository | 8 (`BOARD_MAX_PARKED`) |
| Included repositories | 128 (`BOARD_MAX_REPOSITORIES`) |
| Serialized `data` | 65 536 UTF-8 bytes |
| Human screen | 24 lines / 4 096 UTF-8 bytes |
| Human row line | 400 UTF-8 bytes |
| Human rows per section | lanes 6, gates 6, asks 4, actions 6, parked 3 |
| Field caps | id/kind/ref/question 160, owner/waivedBy/reason 120, phase 60, until 40 characters |

Every cap drop increments `omitted` and its `omittedBySection` counter and sets `truncated`. The payload byte guard drops rows tail-first in the fixed order `parked` → `asks` → `actions` → `lanes` → `gates`; the repository list and collector evidence are never dropped by it. The human renderer applies the same drop order when it must drop lines to stay inside the line and byte bounds, and records the drops in the section's `+N more` marker. No drop is silent, and the repository cap is counted in `omittedBySection.repositories` rather than hidden.

### Exit projection and error identities

| Outcome | Envelope | Exit |
|---|---|---|
| Board produced, including empty sections and the `unbound` scope | Success envelope, `delivery.board.v1` `data` | `0` |
| `--project` key outside the managed set | Error envelope, `board.repository-unknown` | `1` |
| Grammar violation | Error envelope, `fallback.invocation` (delivered) | `1` |
| A required collector unavailable | Error envelope, `status.collector.<id>.unavailable` (delivered) | `2` |
| Host index, repository state location, or a required source unreadable | Error envelope, `board.state-unavailable`, naming the repository key | `2` |

`board.repository-unknown` is a `user` identity; `board.state-unavailable` is a `platform` identity. Both are exact two-segment codes under the `board` domain kind, registered in the error table and joined to the closed two-segment allowlist; no `board.*` family or pattern widening exists ([Result Contract and Error Table](feature-result-contract.md)). Grammar refusals add no identity. The failed summary names the failing repository key (or the index path) and no partial board is rendered: a section that cannot be read withholds the board instead of showing zero rows.

### Read-only posture and write carve-out

The board is read-only apart from one declared, bounded, idempotent write: when a `waiver` gate at or past 72 h has no decision record, the run appends exactly one `owner-gate.decision` record for that repository. A record that already exists is honored and nothing is appended, so a repeat run writes nothing. No index maintenance, prune, edit, or delete occurs; the only other side effects are the two delivered store-opening effects every composed command performs (the create-once clone identity marker and the removal of a leftover read-only store sibling). The board belongs to the read-only `maintainsIndex` exception set, so a board run never maintains the host index.

The board makes no LLM call, issues no non-GET provider request, starts no timer, loop, or daemon, and commits no product or binary literal.

### Mounting

The board is the 21st prompt-required command family. The production composition root composes it unconditionally, root `--help` lists it beside the other families, `board --help` answers from the static inventory at exit `0`, the M2 reference page serves the help-coverage check, and the coverage inventory carries the board row. Mounting changes no other command's composition.

### Actions surface (GH-287)

The actions rows project from the repository's own action registry through one
bounded read per repository; a failed read discloses the `actions` collector
evidence as `unavailable` and fabricates no row. Each row carries the action
identity, repository, owner, level, age in milliseconds, derived aging state
(`current`, `nudged`, `escalated`), and the improvement window's open count and
declared limit. The section participates in the declared drop order
(`parked`, `asks`, `actions`, `lanes`, `gates`); a dropped row is always
counted. See [Retro Action Registry](feature-retro-action-registry.md).

## Technical Architecture & Codebase Map

### Core components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/owner-gate-sla.ts` | The `delivery.board.v1` vocabulary: schema id, the delivered gate SLA vocabulary, the section row types including the additive actions row, `scope`/`selection`, the closed lane-state, phase-absence, owner-source, ask-default-state, and parked-reason sets, `stateSource`, the caps, the collector ids, and the projection input/output types. Types and `as const` data only. |
| `packages/core/src/domain/owner-gate-sla.ts` | The pure gate evaluator and the `projectBoard` and `renderBoardHuman` projection: per-repository gate evaluation, lane/ask/action/parked projection, drawn-default join, deterministic repository-then-section ordering, omission accounting, the machine byte guard, and the bounded human screen. No I/O, clock, randomness, or ambient environment. |
| `packages/core/src/contracts/status.ts` | Declares `STATUS_FACTS_SCHEMA_VERSION` (`delivery.status-facts.v1`), the one identity carried as `stateSource` on the board, status, and brief payloads. |
| `packages/cli/src/commands/board.ts` | The `board` command definition over injected repository resolution, per-repository loads, decision append, owner hold, policy, and clock; declares `--all`, `--project`, the conflict pair, and zero positionals; owns no stream writes or exit-code choice. |
| `packages/cli/src/edge.ts` | The board edge composition: managed-set resolution, per-repository read set (shared status facts, lane/phase fold, parks, decisions), phase resolution, park classification, decision append, and the board runtime seam. |
| `packages/cli/src/production.ts` | Composes the board unconditionally and joins the read-only `maintainsIndex` exception set. |
| `packages/cli/src/entrypoint.ts`, `help.ts`, `help/prompt-required-commands.ts` | The prompt-set entry, unconditional composition, and the root and family help entries. |
| `scripts/checks/help-guide-coverage.ts`, `tests/fixtures/help-guide/coverage.json` | The reference-page and coverage-inventory gate the board row must satisfy. |
| `packages/core/src/contracts/error-table.ts`, `packages/cli/src/classify.ts` | The `board` domain kind and its two rows, and the runtime classification of both codes plus the delivered collector family. |

### Data flow

1. The edge resolves the selection: the invoking checkout only, one requested key, or the managed set reduced to the retained 128-key subset. The default form reads no host index.
2. For each included repository, the edge reads the shared status facts, the lane/phase state, that repository's own dispatch lanes for the worktree-path join, the open park episodes, one bounded action-registry read, and — only when a gate is default-eligible — the verified decision history.
3. The pure projector evaluates the delivered SLA per repository, projects the declared sections with the drawn-default join over the post-append decision set, accounts for every cap and clamp, and applies the machine byte guard.
4. The edge appends at most one decision per newly defaulted gate per repository, idempotently.
5. The CLI edge renders the human screen or the standard envelope and projects the exit code from the classified outcome.

### API and interface contracts

- **`projectBoard(input: BoardProjectionInput): BoardProjection`** — the only board projection; returns the bounded payload and the per-repository decisions the edge must append.
- **`renderBoardHuman(data, brand): string`** — the only human renderer; reads no source and uses the injected brand binary name.
- **`evaluateOwnerGateSla(input)` / `toBoardData(...)`** — the delivered gate evaluation and gate payload projection the gates section composes; see [Owner-Gate SLA](feature-owner-gate-sla.md).
- **`createBoardCommandDefinition(runtime: BoardCommandRuntime): CommandDefinition`** — declares `flags: ["--all", "--project"]`, `requiresValue: ["--project"]`, the `--all`/`--project` conflict, `positionals.max: 0`, the human renderer, and a handler over `resolve`, `loadRepository`, `appendDecision`, `ownerHold`, `policy`, `nowIso`, and `nowMs`, plus the optional `dispatchWorktreePaths` join source, keyed `(repository, ref)` (absent leaves the delivered payload byte-identical; a store read failure contributes an empty map).

The contracts and domain import only the shared contracts; the CLI command composes the core root and the edge types. No new package, subpath, or runtime-API location is introduced.

### Data architecture

| Element | Shape and persistence |
|---|---|
| Board payload | `delivery.board.v1` `data` inside the `delivery.result.v1` envelope; projection only, never persisted |
| State-source identity | `delivery.status-facts.v1`, a contract constant carried on the board, status, and brief payloads |
| Lane lease holder | Additive optional `leaseHolder` on the shipped `delivery.lanes.v1` projection; present exactly when a live lease exists; every delivered lane field and the human lane text unchanged |
| Lane worktree path | Additive optional `worktreePath` on the board lane row, contributed by a `(repository, ref)`-keyed join over each included repository's own newest `dispatch.lane` record from that repository's one bounded retained-window read, re-keyed onto the board's repository identity; the newest record decides, absent on a lane with no worktree context, and the join never mints a row |
| Decision record | The delivered `delivery.owner-gate.decision.v1` payload under `owner-gate.decisions:<gateId>`; the only durable write |
| Host index | The shipped `delivery.projects.host-index.v1` document, read once for `--all`/`--project` and never maintained by the board |

## Security and Boundaries

- **Read-only carve-out:** the only delivery-state mutation is the delivered idempotent owner-gate decision record; the board maintains no index and performs no prune, edit, or delete.
- **Fail closed:** an unreadable repository, host index, or required source withholds the board with `board.state-unavailable` at exit `2`; a partial fleet screen is never rendered.
- **No fabricated provenance:** owner, phase, holder, `until`, and drawn default are recorded values or declared absences; the closed `ownerSource` vocabulary states where each owner came from.
- **No cross-repository mixing:** rows are keyed by repository, identities are unique per section, and two repositories holding one ref stay two rows.
- **Privacy:** repository keys, refs, ids, kinds, ages, bounded questions, bounded reasons, and principals only — no credentials, raw provider payloads, titles, bodies, comments, or free-form content.
- **Brand neutrality:** no product or binary literal is committed; the header uses the injected brand binary name.
- **No model or network write:** no LLM, no non-GET provider request, no timer, loop, or daemon.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Envelope continuity | Every new key lives under `data`; the five-field `delivery.result.v1` envelope and the `{0, 1, 2}` exit meanings are unchanged. |
| Determinism | Two runs over unchanged facts produce byte-identical human text and byte-identical machine `data` (envelope timing and run id aside); every array follows the declared repository-then-section order. |
| Shared source | `board.data.stateSource` equals `status.data.stateSource` and `brief.data.stateSource` on every successful repository-scoped run; 0 sections read an unnamed source. |
| Row identity and containment | 0 duplicate identities per section; two repositories holding one ref produce 2 rows; row counts equal the sum of the included per-repository boards before byte-guard drops, with every drop counted. |
| Bounds | Per-repository caps 8 gates / 20 lanes / 8 asks / 8 actions / 8 parked; 128 included repositories with counted overflow; `data` ≤ 65 536 UTF-8 bytes; human ≤ 24 lines / 4 096 bytes; ≤ 400 bytes per line; every drop or clamp marked. |
| Read cost | One bounded pass per included repository — one tracker page (100 items), one delivery-request page (100), one CI page (20), one blocker read, one queue ledger read, one park read, one action-registry read, one local-context read, one spend read, at most one phase read per active lane, at most one decision-history read (shared by the ask join), and one bounded retained-window dispatch-lane read per included repository for the lane-row worktree join; no pagination, retry, or duplicate client stack; one host-index read per `--all`/`--project` run and 0 for the default form. |
| Write discipline | ≤ 1 appended decision record per newly defaulted gate and 0 when one exists; 0 index maintenance, 0 prune, 0 edit or delete; exactly the 2 delivered store-opening side effects. |
| Purity | 0 LLM calls, 0 non-GET provider requests, 0 timers or loops, 0 hardcoded product or binary names. |
| Responsiveness | Pure projection and render of a cap-sized two-repository board completes inside 50 ms (warm median of 5 runs, I/O excluded). |
| Observability | Per-repository collector evidence, `scope`/`selection`/`repositories[]`, `ownerHold`, and the omission counters state exactly what the board covers and what it dropped; failures carry a classified identity naming the repository. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Contract data pinned exactly (sections, row fields, closed vocabularies, caps, `stateSource`, collector ids); pure-domain import confinement; inventory registration; production composition and prompt-set membership; the 28-family counts | `tests/structure/board-contract.test.ts`, `board-mounting.test.ts`, `board-nonregression.test.ts` |
| Behaviour | Section order and rows, shared-source equality, lane provenance, gates SLA preservation, asks join, actions projection and aging disclosure, parked population and owner hold, repository selection (default, project, all, unbound), the 128 cap and retained set, byte guard, bounds, determinism, privacy, purity, read cost, write discipline, classified errors | `tests/behaviour/board-sections.test.ts`, `board-rows.test.ts`, `board-lanes.test.ts`, `board-gates-sla.test.ts`, `board-asks.test.ts`, `board-actions.test.ts`, `board-parked.test.ts`, `board-shared-source.test.ts`, `board-selection-*.test.ts`, `board-repository-cap.test.ts`, `board-bounds.test.ts`, `board-byte-guard.test.ts`, `board-errors.test.ts`, `board-identity.test.ts`, `board-envelope.test.ts`, `board-command.test.ts`, `board-determinism.test.ts`, `board-read-cost.test.ts`, `board-performance.test.ts`, `board-privacy.test.ts`, `board-purity.test.ts`, `board-write-discipline.test.ts`, and the delivered `board-aging`, `board-escalation`, `board-defaults`, `board-defaults-idempotency`, `board-records`, `board-waiver-recording`, `board-collectors`, `board-never-silence`, `board-output`, and `board-corpus` suites |
| Mounting and help | Root and family help, reference-page coverage, coverage-inventory row, unmounted-mutant detection | `tests/behaviour/board-help.test.ts`, `tests/behaviour/entrypoint-help-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` |
| Golden | A committed full-board envelope plus human screen with an explicit regeneration path, byte-identical repeats, and permutation independence | `tests/golden/board-full.test.ts` with `tests/fixtures/board/golden/full-envelope.json`, `full-grid.txt`; `tests/golden/board-grid.test.ts` with the delivered gate goldens |
| Contract | Error table, structural mirror, sync check, and classifier agree on the board rows and the closed allowlist | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/board-contract.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

All suites inject facts through the shared board harness and selection fixtures; nothing reads the live tree, the network, the ambient clock, or an environment variable. The golden fixtures are never rewritten by a suite and are regenerated only by the explicit `tests/fixtures/board/golden/regenerate.ts` path.

## Operational & Support

### Configuration

The board adds no configuration key. `BOARD_MAX_REPOSITORIES`, the per-section caps, the field caps, the section order, the closed vocabularies, the collector ids, and the shared-source identity are contract data. The host root and per-repository state scope come from the delivered state-scope resolution; `--all` and `--project` require no additional configuration.

### Observability

The payload is the observability surface: the standard envelope's `runId` and `timing`, `scope`/`selection`/`repositories[]`, per-repository collector evidence, the per-section omission counters and `truncated`, `ownerHold`, and the classified failure identities. No telemetry exporter, event sink, alert channel, or background process is added.

### Cost and read cost

One invocation performs one bounded pass per included repository, one bounded action-registry read per repository, one host-index read for `--all`/`--project`, and at most one decision-history read per repository; each applied default adds one fenced append. There is no retry loop, pagination crawl, daemon, or new runtime dependency. The 128-repository cap bounds the worst-case read set.

### Maintenance

- Changing a section, row field, or cap is a contract-data change plus projection, renderer, tests, goldens, and documentation.
- Changing the delivered SLA vocabulary is owned by [Owner-Gate SLA](feature-owner-gate-sla.md) and consumed here; the board never forks the evaluator.
- Adding a repository-selection form is a grammar and contract change; the board stays repository-keyed and never group-scoped.
- A surface that starts maintaining the host index must leave the read-only `maintainsIndex` exception set and revisit this document.

## Dependencies & Risks

- **Depends on** the owner-gate SLA ([feature-owner-gate-sla.md](feature-owner-gate-sla.md)) for the gate population, thresholds, policy map, ranking, decision record, and the delivered gate cap.
- **Depends on** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the per-repository status facts, their vocabulary, and the `stateSource` identity.
- **Depends on** the brief ([feature-brief.md](feature-brief.md)) sharing the same bundle and identity.
- **Depends on** the scheduling engine ([feature-scheduling-engine.md](feature-scheduling-engine.md)) for the lane fold, active-lane states, park episodes, and the additive `leaseHolder`.
- **Depends on** repositories and the host overview ([feature-projects.md](feature-projects.md)) for the host root, per-repository state scope, host index, and the `unbound` scope.
- **Depends on** the typed blocker channel ([feature-blockers.md](feature-blockers.md)) for the open owner-audience question view, its computed age, and its ranking.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, the `board` domain kind and its two rows, the collector family, and the exit projection.
- **Risk — false all-clear:** mitigated by fail-closed withholding, counted omissions, and an explicit `unbound` scope.
- **Risk — vocabulary divergence between board, brief, and status:** mitigated by one named fact bundle and the cross-payload `stateSource` equality.
- **Risk — multi-repository reads mixing state or exploding cost:** mitigated by repository-keyed identities, a bounded single pass per repository, and the 128-repository cap with counted overflow.
- **Risk — write creep under a read-only claim:** mitigated by the single declared idempotent decision append and the `maintainsIndex` exception membership.
- **Risk — invented provenance:** mitigated by recorded values and classified absences only, with the closed `ownerSource` vocabulary.

## Glossary & References

| Term | Definition |
|---|---|
| Board | The bounded fleet screen and `delivery.board.v1` payload: lanes, gates, asks, actions, and parked work. |
| Shared state source | The `delivery.status-facts.v1` fact bundle that status, brief, and the board's gates, asks, and parked sections project. |
| Active lane | A shipped lane-fold lane in `delivering` or `failed`; the only lane population on the board. |
| Owner ask | An open `owner`-audience typed question with its computed age and its drawn default. |
| Drawn default | The delivered PDR-0003 policy default for a defaultable gate on the ask's ref, or a declared `none`. |
| Parked work | An open lane park episode (`peak-window` or `owner-hold`) with its reason and `until`, or the classified owner-hold absence. |
| Managed set | The host index's live recorded checkouts plus the bound invoking checkout; the only source of `--all` and `--project` targets. |
| Retained set | The at-most-128 ascending repository keys a board actually includes, with the overflow counted. |
| `unbound` scope | The declared no-repository scope of a default-form invocation outside a work tree or without a derivable identity; exit `0`, never an error. |
| Omission counter | `omitted` and `omittedBySection`, stating exactly how many rows or repositories a bounded board did not show. |

See also: [Owner-Gate SLA](feature-owner-gate-sla.md), [Status Digest](feature-status-digest.md), [Brief](feature-brief.md), [Scheduling Engine](feature-scheduling-engine.md), [Typed Blocker and Question Channel](feature-blockers.md), [Retro Action Registry](feature-retro-action-registry.md), [Repositories and the Host Overview](feature-projects.md), [Provider Peak Pausing](feature-peak-pausing.md), [Result Contract and Error Table](feature-result-contract.md), [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md), [PDR-0003](../../decisions/PDR-0003-owner-gate-sla-default-map.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), and the [repository glossary](../../overview/glossary.md).

**Change records:** `doc/changes/2026-11/2026-11-15--GH-297--board/` (the four delivered sections, shared state source, repository selection, and mounting), `doc/changes/2026-11/2026-11-16--GH-287--retro-action-registry/` (the additive `ACTIONS` section), and `doc/changes/2026-11/2026-11-06--GH-229--owner-gate-sla/` (the delivered gate SLA the gates section preserves).
