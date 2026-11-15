---
change:
  ref: GH-297
  type: feat
  status: Proposed
  slug: board
  title: "M2-S4: Board (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, cli, board, multi-repository, shared-state-source]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "GH-229 (M1-S5 owner-gate SLA board — delivered: `delivery.board.v1`, the 24 h / 72 h SLA, the PDR-0003 default map, the append-only decision record, the delivered bounds)"
      - "GH-237 (M1-S17 scheduling engine — delivered: the lane/queue fold and the `lanes` / `queue` read surfaces)"
      - "GH-288 (M2-S11 multi-repository workstations — delivered: the host root, the per-repository state scope, the host index)"
      - "GH-309 (M2-S18 project groups — delivered: `repos list`, the `repositories[]` naming rule, the repository-key boundary)"
      - "GH-230 (typed blocker channel — delivered: the owner/coordinator audience seam and the open-question views with age)"
      - "GH-294 (provider peak pausing — delivered: the park reasons and the open park episode projection)"
      - "Delivered result contract, error table, and `{0,1,2}` projection"
    external: []
  links:
    decisions: ["PDR-0003", "ODR-0003", "ODR-0004"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the full `board` command — lanes, gates, owner asks, and parked work on one screen, from the same state source `brief` and `status` read, spanning managed repositories by repository key — and mount it at the production entrypoint so the owner stops re-deriving the fleet by hand.

## 1. SUMMARY

The delivered `board` is the M1-S5 owner-gate SLA surface: it reads the tracker collector once, evaluates the 24 h / 72 h gate SLA, renders a bounded aging grid, and appends at most one decision record per newly defaulted gate. It carries `delivery.board.v1` with `gates[]` only, and its two declared collector ids (`tracker`, `lanes`) already include the lane collector the full board needs — but the definition is composed only when the edge is handed a board runtime, which the production entrypoint never supplies.

This change delivers the M2 board: four sections (lanes, gates, owner asks, parked work) projected from the one shared state source that `brief` and `status` already project from, plus the delivered lane/queue fold; `--all` spans every managed repository resolved from the delivered host index and per-repository state scopes, `--project <repoKey>` narrows to one repository key, and the default is the invoking checkout. The board's machine payload names its state source so the backlog acceptance criterion is checkable at runtime, and the delivered owner-gate SLA behaviour (states, thresholds, defaults, waiver recording, bounds) is preserved rather than replaced. The command is then mounted at the production entrypoint with its prompt-set entry, edge composition, help entries, reference page, and coverage-inventory row.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Delivered board (GH-229, M1-S5).** `board` is a render-once command over injected collectors. It accepts zero positionals and declares no command-specific flags; `--json` is the global machine-output switch. Each required collector is read exactly once and any collector failure withholds the whole board as `status.collector.<id>.unavailable` at exit `2`; a fully available run evaluates the owner-gate SLA (24 h escalation, 72 h default-on-expiry, `>=` boundaries, the PDR-0003 two-row policy map, the append-only decision record), ranks gates by severity then descending age then id, and renders at most 8 gates. The machine `data` payload is `{ schemaVersion: "delivery.board.v1", audience, gates, truncated, omitted, collectors }`; each gate record carries `id`, `kind`, `ref`, `age`, optional `ageUnknownReason`, `slaState`, `default`, `waivedBy`. Bounds: 8 gates, 65 536 serialized `data` bytes, 24 human lines / 4 096 human bytes, 160-char id/kind/ref caps, 120-char `waivedBy` cap, 400-byte human line.
- **The board's collector set already names the lane read.** The closed collector-id set is `{tracker, lanes}`; the delivered handler reads only the tracker collector today, so `lanes` is a declared id without a delivered read. The M1 board page records the command as "not mounted at the production entrypoint" and scopes the remainder to M2-S4.
- **Mounting is a prompt-set decision.** The entrypoint composes exactly the prompt-required set and drops extras; a definition existing in the edge composition is not enough to answer from root `--help`. Twenty families are registered today (`status`, `brief`, `queue`, `lanes`, `blockers`, `phase`, `commit`, `lint`, `plan`, `verify`, `merge`, `closeout`, `spend`, `retro`, `dispatch`, `coordinator`, `daemon`, `projects`, `repos`, `events`); `board` is composed by the edge only when a board runtime is supplied, and the production composition root supplies none. The help-coverage check requires a reference page per prompt-required command, and that page must mention `--help` and `--version`.
- **Brief and status share one fact bundle.** `collectStatusFacts` composes one injected `StatusFacts` bundle (repository binding and HEAD, tracker work items, delivery requests, CI runs, provider configuration and parks, lane park episodes, local PM context, blocker ledger, spend, optional owner hold and credential reference). `status` aggregates it into the nine-section digest; `brief` reuses the same collection so one brief invocation performs exactly the same read set. Neither payload names its source.
- **The lane/queue fold is shipped and read-only.** The scheduling engine folds queue entries, dependency edges, leases, parks, economics, and daemon lane evidence into the bounded `delivery.lanes.v1` payload (`lanes[]`, `findings[]`, `degraded[]`, counts, peak enforcement). A lane is a pure projection: its identity is the canonical ref, its state is one of `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`, `failed`, and a live lease makes it `delivering`. The projection does not currently name the lease holder or a phase.
- **Multi-repository state is delivered.** The host root is `<PREFIX>_STATE_DIR` or the home default; a per-repository root is `<host root>/projects/<project key>`, minted once from the checkout identity marker. The revisioned host index (`host-index.json`, schema `delivery.projects.host-index.v1`, bounded at 2 000 entries) records `projectKey`, `projectIdentifier`, `root`, `stateLocation`, and `lastWrittenAt`, and is maintained only by store-opening invocations other than the flat/group list reads. `repos list` is the flat record set under `repos.v1`; `projects list` is the group surface. An invocation outside any git work tree uses the declared `unbound` scope and is never an error.
- **Parked work and asks already have shipped surfaces.** Open lane park episodes are projected once from the verified park fold into the status digest's park fields (cause, `until`, preservation, provider profile); an `owner-hold` episode carries a classified absence of `until`. The typed blocker channel holds open owner/coordinator questions with a recorded `askedAt`, a computed `age`, a closed type set, and one shared ranking; the status digest's typed-questions section renders them.
- **Repository naming is settled.** The flat record set's field is `repoKey` (`repos.v1`), the host index keeps `projectKey`, and `board --project` takes a repository key. The board is never group-scoped and enumerates no groups (GH-309, ODR-0004 and its naming rule); the board's repository-list field is `repositories[]`, and because no delivered board payload ever carried a repository list there is no in-payload rename and no alias (GH-309 DEC-3).
- **Envelope continuity.** Every payload stays inside the delivered five-field `delivery.result.v1` envelope with new keys under `data`; exit codes keep their meaning (`0` declared verdict, `1` refused, `2` platform/state/provider failure).

### 2.2 Pain Points / Gaps

- **GAP-1**: The board renders only owner-gate SLA rows — no lanes, no owner asks, no parked work — so the four things the owner coordinates are never on one screen.
- **GAP-2**: The board is not mounted: the definition lives in the edge composition, the production entrypoint never supplies its runtime, and it does not answer from root `--help`.
- **GAP-3**: No surface names the state source it projects from, so "board, brief, and status share one state source" is a documentation claim, not an observable fact.
- **GAP-4**: Nothing reads more than one repository: every read is scoped to the invoking checkout, so a multi-repository fleet requires per-checkout invocations and manual correlation.
- **GAP-5**: The delivered lane projection cannot name the lease holder or the lifecycle phase of an active lane, so an active-lane row cannot say who is running it or where it is.
- **GAP-6**: The delivered board's repository-list vocabulary (`repositories[]`) and its error identities (`board.*`) exist only in the planning pack; no code or error-table row carries them.

## 3. PROBLEM STATEMENT

Because the delivered board renders only owner-gate SLA rows, is not composed by the production entrypoint, names no shared state source, and cannot span repositories, the owner cannot see lanes, gates, owner asks, and parked work on one screen — so coordination still re-derives the world per checkout, and the backlog acceptance criterion that board, brief, and status share one state source cannot be verified from any payload.

## 4. GOALS

- **G-1**: One screen with four sections — active lanes, open gates, owner asks, parked work — each row naming its repository key, ref, and owner.
- **G-2**: One shared state source with `brief` and `status`, named in the board payload and observable on the brief and status payloads, so the shared-source claim is machine-checkable.
- **G-3**: Repository scope without state mixing: the default is the invoking checkout, `--project <repoKey>` narrows to one managed repository, `--all` spans every managed repository on the host, and the board stays on repository keys and never enumerates groups.
- **G-4**: The delivered owner-gate SLA is preserved as the gates section — states, thresholds, waiver recording, default application and its decision record, ranking, and bounds.
- **G-5**: The command is mounted at the production entrypoint with the prompt-set entry, edge composition, help entries, reference page, and coverage-inventory row.
- **G-6**: The board is deterministic, bounded, read-only apart from the delivered decision append, brand-neutral, and uses no LLM and no network write.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated | 1 of 1 (the single backlog AC, mapped in Appendix B and decomposed into §17) |
| Sections rendered from the shared facts bundle | 3 of 4 sections (gates, asks, parked) project from the named shared bundle; the fourth (lanes) reads the delivered lane fold and is named as a collector — 0 sections read an unnamed source |
| Shared-source assertion | `board.data.stateSource` equals `status.data.stateSource` and `brief.data.stateSource` on every successful run (100%) |
| Row duplication across repositories | 0 duplicated row identities within each section; `--all` row count equals the sum of the included per-repository boards before any byte-guard drop, and every byte-guard drop is counted (the repository-list cap of DM-11 applies and is counted, never silent) |
| State mixing between repositories sharing a ref | 0 cross-repository rows: two repositories holding the same ref produce two distinct rows, one per repository key |
| Silent all-clear outcomes | 0: every unreadable source either withholds the board with a classified identity at exit 2 or is carried as classified evidence with an explicit omission count |
| Mounting completeness | 1 prompt-set entry, 1 root help entry, 1 board reference page, 1 coverage-inventory row, and 21 registered root families |
| Determinism | Two runs over unchanged facts produce byte-identical human text and byte-identical machine `data` (envelope timing/run id excluded) |
| Quality gates | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No steering surface — no steering notes, receipts, TTLs, or batched ask resolution (M2-S5, GH-298).
- **NG-2**: No metrics, alarms, burn-rate, or retro action registry (M2-S6, GH-299; M2-S10).
- **NG-3**: No group-scoped board — no `--project <groupKey>` meaning, no group enumeration, no member aggregation on the board; the board is repository-keyed only.
- **NG-4**: No new tracker read model, no second state layer, no new event topic, and no write beyond the delivered owner-gate decision record.
- **NG-5**: No LLM in the render path, no network write, and no mutation of a repository's tracker or delivery request.
- **NG-6**: No current-truth feature-spec amendment by this specification (phase 7 reconciles current truth; the one mechanical in-boundary exception is the error-table carrier, C-7).
- **NG-7**: No retirement of `projects list --flat` and no rename of any delivered command, field, or state artifact.
- **NG-8**: No change to the lane fold's rendered human output, the delivered gate-only semantics, or the delivered board bounds (the new board composes them; it does not widen them).
- **NG-9**: No provider-level or queue-level park projection — `parked[]` is the lane park episode population (`peak-window`, `owner-hold`); a `provider-quota` park is a provider/queue condition, not a lane, and stays off the board.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Four-section board (lanes, gates, owner asks, parked work) | The fleet must be legible on one screen instead of four separate reads |
| F-2 | One named shared state source with brief and status | The backlog AC must be observable at runtime, not only asserted in prose |
| F-3 | Repository scope: current checkout, `--project <repoKey>`, `--all` | A fleet view must span checkouts without mixing their state |
| F-4 | Delivered owner-gate SLA preserved as the gates section | The SLA is the delivered, PDR-0003-governed mechanism; a parallel one would fork policy |
| F-5 | Owner asks with age and drawn default | The contract's ask section requires both fields from shipped evidence |
| F-6 | Parked work with reason and until | Parked work is invisible today except inside status park fields |
| F-7 | Production mounting (prompt set, composition, help, page, inventory) | A definition in the edge is not a reachable command |
| F-8 | Classified refusals and failures with the declared exit projection | A partial or silent board is a false all-clear |
| F-9 | Deterministic, bounded, read-only, brand-neutral rendering | The board is a fleet-control surface and must be reproducible and safe |

### 5.1 Capability Details

- **F-1 — Four sections on one screen.** `board` renders exactly four sections in the declared order: `LANES`, `GATES`, `ASKS`, `PARKED`. Every row names its repository key, its ref (or the source's declared absence when it records none), and its owner. An active-lane row's `phase` is the one open entry of the delivered phase-state fold; a lane with no phase record carries `null` with `phaseUnknownReason: "phase-unrecorded"`, and a lane whose phase record exists with nothing in progress carries `null` with `"phases-complete"` (DM-4, DEC-15). The text surface is deterministic and TTY-independent, contains no ANSI escapes, titles, bodies, comments, or secrets, and takes its binary name from the brand seam. `--json` emits the machine envelope instead of the human screen. The human screen is not a substitute for `lanes list`, `queue list`, or `blockers list`: it is a bounded fleet summary, and each section's omission count states how much is not shown.
- **F-2 — One named shared state source.** The board's owner-facing evidence (gates, asks, parked) projects from the one fact bundle `collectStatusFacts` composes — the same bundle `status` aggregates and `brief` re-projects. The bundle's identity is a declared contract constant, and the payload names it as `stateSource`. The same additive key is carried on the brief and status payloads, so the shared-source claim is a runtime equality rather than a code-reading exercise. The board's lanes section reads the delivered lane/queue fold, which reads the same per-repository state layer; that read is named as the `lanes` collector in the payload's collector evidence so no section's provenance is implicit. No section introduces a parallel state vocabulary, a second state layer, or a duplicate tracker read model.
- **F-3 — Repository scope.** The default selection is the invoking checkout: its repository key comes from the delivered checkout identity, the same derivation the flat record set uses, and the default form performs zero host-index reads. `--project <repoKey>` narrows to one managed repository: a key not in the managed set is refused as `board.repository-unknown` at exit `1`. `--all` spans the managed set — the delivered host index's recorded checkouts plus the invoking checkout when it is bound — one row per included repository key, ordered ascending by key, bounded to `BOARD_MAX_REPOSITORIES` (128) included repositories with the overflow counted in `omittedBySection.repositories` and the invoking checkout included whenever the invocation is bound (DM-11, DEC-13). `--all` and `--project` together are refused as the delivered `fallback.invocation` at exit `1` (DEC-17). A recorded checkout whose root no longer exists is not a board repository (the delivered flat surface's rule); it is not silently skipped work, because a checkout that no longer exists holds no live delivery. When the default invocation is outside any work tree **or** its checkout identity cannot be derived, the board resolves the declared `unbound` scope: `scope: "unbound"` with `repositories: []` and empty sections, the delivered bounded warning attached, and exit `0` — never an error, never a host-index fallback, and never a claim about a repository (AC-F3-5, AC-F3-6). `--all` and `--project` resolve their repository set from the managed set regardless of the invoking checkout's bound state; both report `scope: "repository"`, and `repositories[]` is empty when the managed set is empty. No board form enumerates or infers a project group.
- **F-4 — Owner-gate SLA preserved.** The gates section is the delivered gate surface: the same collector mapping (owner-attention items as `owner-review`, recorded authorized waivers as `waiver` with their authorizer), the same 24 h escalation and 72 h default-on-expiry with `>=` boundaries, the same PDR-0003 two-row policy map, the same ranking (SLA severity, then descending age, unknown age before known age within a class, then id), the same per-repository gate cap of 8, and the same append-only idempotent decision record when a default is applied. Each gate row additionally names its repository key, its composed condition token, and its owner. The delivered collector-unavailable identities and their exit `2` projection are preserved.
- **F-5 — Owner asks.** `asks[]` is the open owner-audience population of the delivered typed-question ledger, projected through the delivered open-question view (id, closed type, lane, ref as the delivered `string` or bare `null`, bounded question text, `askedAt`, computed `age`) under the delivered ranking, bounded per repository. Each ask additionally carries the drawn default that would resolve silence for its ref: the delivered owner-gate policy's default for a defaultable gate on the same canonical ref, with `defaultState` `pending` (no decision recorded yet) or `applied` (a decision record exists), and `null` with `defaultState` `none` when no defaultable gate exists for that ref or the question names no ref. `none` is a declared value, never an omitted field: it states that silence will not resolve this ask on its own. `defaultState` observes the invocation's post-append decision set: when this run applies a default on the ref, the same run's ask row reads `applied`, and the join reuses the single decision-history read without a second read (DEC-16, NFR-5). A question whose stored record names no ref carries the delivered bare `ref: null`; the delivered typed-question view declares `ref: string | null` and carries no absence-reason token, so the board invents none (DEC-19).
- **F-6 — Parked work.** `parked[]` is the open lane park episodes of the delivered park fold, latest per ref, carrying the cause (`peak-window` or `owner-hold`), the `until` timestamp, the preservation classification, and the recorded provider profile. The population is the delivered lane park episode projection: `peak-window` and `owner-hold` only; a `provider-quota` park is a provider/queue condition, not a lane, and never appears in `parked[]` (DEC-18). An `owner-hold` episode carries `until: null` with `untilReason: "owner-hold-no-expiry"` — the declared classified absence, never a fabricated expiry. The host-wide owner hold is carried once on the payload so an idle fleet never reads as an unexplained all-clear.
- **F-7 — Production mounting.** The board joins the prompt-required command set, is composed unconditionally by the production composition root over the delivered adapters, is advertised in root `--help` and in its own family help, carries a reference page that serves the coverage check, and gains its coverage-inventory row. Mounting changes no other command's composition.
- **F-8 — Classified refusals and failures.** A repository key outside the managed set is `board.repository-unknown` at exit `1`. A host index, a repository state location, a source read, or a lane/phase read that cannot be read is `board.state-unavailable` at exit `2`, naming the failing repository key. Collector unavailability keeps the delivered `status.collector.<id>.unavailable` identity at exit `2`. The two board identities are exact two-segment additions to the closed allowlist (53 → 55); no `board.*` family is opened (DEC-20). Grammar violations (unknown flag, positional argument, `--all` with `--project`, `--project` with no value) are the delivered containment identity `fallback.invocation` at exit `1` (DEC-17). A produced board is exit `0`. No partial board is rendered: a section that cannot be read withholds the board rather than showing zero rows, and within a produced board every omission is counted.
- **F-9 — Deterministic, bounded, read-only, brand-neutral.** Two runs over unchanged facts produce byte-identical human text and byte-identical machine `data` (envelope timing and run id aside). Every array is ordered by repository key and then by the section's declared order; every row identity is unique within its array. The rendered output respects the delivered bounds and the new per-section caps, with every drop counted — including the `BOARD_MAX_REPOSITORIES` (128) repository-list cap and the declared byte-guard drop order (`parked` → `asks` → `lanes` → `gates`, tail first within a section); the repository list and collector evidence are never dropped by the byte guard (DM-11, DEC-13). The read path writes nothing except the delivered idempotent owner-gate decision record and the two delivered store-opening side effects (the create-once checkout identity marker and the removal of a leftover store sibling by the read-only store handle); it performs no host-index maintenance and no prune. It uses no LLM, makes no network write, and hardcodes no product name.

## 6. USER & SYSTEM FLOWS

```
Flow 1: The owner's morning fleet view (AC-F1-1, AC-F2-1)
  Owner runs `board` in a checkout with an active lane, an open owner ask,
  and a parked lane
  → one bounded screen with LANES / GATES / ASKS / PARKED
  → `board --json` carries lanes[], gates[], asks[], parked[], repositories[]
    and stateSource; stateSource equals the status and brief stateSource
  → each row names its repository key, ref, and owner.

Flow 2: Two repositories, one ref (AC-F3-1, AC-F3-2)
  Two managed checkouts share ref GH-244; one has an active lane, one a parked lane
  → `board --all` lists both repository keys in repositories[]
  → the two GH-244 rows stay distinct, each under its own repository key
  → total row count equals the sum of the two per-repository boards, 0 duplicates.

Flow 3: Narrow to one repository (AC-F3-3, AC-F3-4)
  Owner runs `board --project delivery-a-1a2b3c4d`
  → repositories[] names exactly that key; no other repository's state is read
  → an unmanaged key: board.repository-unknown, exit 1, nothing rendered.

Flow 4: Silence is impossible (AC-F4-1, AC-F4-2)
  A waiver gate crosses 72 h and a default applies
  → exactly one decision record is appended, idempotently
  → the row renders default-applied with its drawn default
  → a second run appends nothing and renders the same row.

Flow 5: A source cannot be read (AC-F2-3, AC-F8-2)
  One managed repository's state location is unreadable during `board --all`
  → the board is withheld: board.state-unavailable, exit 2, naming the key
  → no zero-row section and no partial fleet screen is produced.

Flow 6: Unbound scope (AC-F3-5)
  `board` runs outside any work tree
  → scope=unbound, repositories=[], empty sections, the bounded warning, exit 0
  → no repository is claimed and no error is fabricated.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The four-section board surface: `lanes[]`, `gates[]`, `asks[]`, `parked[]`, plus `repositories[]`, `stateSource`, `scope`, `selection`, the host-wide owner-hold fact, collector evidence per repository, and per-section omission counts under the `delivery.board.v1` payload.
- The one shared state source: the `collectStatusFacts` bundle consumed by gates, asks, and parked; the delivered lane/queue fold consumed by lanes; a declared source identity carried by the board, status, and brief payloads.
- Repository selection: default invoking checkout with zero host-index reads, `--project <repoKey>` narrowing, `--all` spanning the managed set (host index plus the invoking checkout) bounded to `BOARD_MAX_REPOSITORIES` (128) included repositories with counted overflow and the invoking checkout included when bound, with the delivered root-absent rule and the `unbound` scope rule.
- The delivered owner-gate SLA preserved on the full board, including the collector mapping, thresholds, ranking, waiver recording, default application, the append-only decision record, and the delivered bounds.
- Owner asks: the open owner-audience typed questions with age and the drawn-default join against the delivered owner-gate policy; the join observes the invocation's post-append decision set, and a ref-less question carries the delivered bare `ref: null`.
- Parked work: open lane park episodes (`peak-window`, `owner-hold`) with reason, until, preservation, provider profile, and the classified `owner-hold` absence; the host-wide owner hold as a payload fact; `provider-quota` parks are not board rows.
- An additive lease-holder field on the delivered lane projection, so an active-lane row can name who holds it.
- Phase resolution for active lanes from the delivered phase-state read, with `null` plus the closed reason token `phase-unrecorded` (no phase record) or `phases-complete` (a record exists and nothing is in progress).
- Two new error identities, `board.repository-unknown` and `board.state-unavailable`, registered in the error table with their exit rows, added to the closed two-segment allowlist exactly (53 → 55, with the identity-count updates in DM-8/DEC-20), and documented in the error-table carrier inside the delivering boundary.
- Production mounting: prompt-set entry, unconditional production composition, root and family help entries, the board reference page (serving the coverage check), and the coverage-inventory row.
- Determinism, bounds, read-only discipline, brand neutrality, and the per-section ordering and identity invariants, including the `BOARD_MAX_REPOSITORIES` (128) repository-list cap with counted overflow and the declared byte-guard drop order.

### 7.2 Out of Scope

- [OUT] Steering notes, receipts, TTLs, and batched ask resolution with owner-drawn defaults (M2-S5, GH-298); the board's asks carry the *delivered* drawn default only, and S5 may refine it later.
- [OUT] Metrics, burn-rate alarms, spend measurement, and the retro action registry (M2-S6 GH-299; M2-S10).
- [OUT] Any group-scoped board, group enumeration, group-key `--project`, or member aggregation (NG-3).
- [OUT] Parked work recorded only in the local PM context: it has no `until` and stays a status/brief surface; the board's `parked[]` is the lane-park population the contract's `until` column describes.
- [OUT] `provider-quota` parks and other provider- or queue-level park conditions: `parked[]` is the lane park episode population (`peak-window`, `owner-hold`), and provider-level park remains on the delivered provider and queue surfaces (NG-9).
- [OUT] A repository list beyond the declared cap: a board lists at most `BOARD_MAX_REPOSITORIES` (128) included repositories and counts the remainder in `omittedBySection.repositories`; a larger single-board fleet is not in this scope.
- [OUT] Idle and waiting (non-active) lanes: the section is the active-lane view, and `lanes list` remains the complete lane surface (DEC-7).
- [OUT] New tracker read models, new state families, new event topics, write endpoints, or network writes (NG-4, NG-5).
- [OUT] Changing the delivered lane human output, the delivered gate-only payload semantics, or the delivered board bounds (NG-8).
- [OUT] Retiring `projects list --flat`, renaming a delivered command, or renaming a delivered state artifact (NG-7).
- [OUT] Current-truth feature-spec amendments by this specification (NG-6, with the C-7 carrier exception).

### 7.3 Deferred / Maybe-Later

- Per-ask owner-drawn defaults and ask batching (M2-S5).
- Wiring the status digest's declared `lanes-or-queue` gap to the shipped lane fold — an independent collector task, not a prerequisite of the board.
- Idle/waiting lanes and queue-entry detail on the board if a future story asks for a fuller lane view.
- Cross-repository change members on the board (M2-S19's shared definition of done is a different surface).
- A group-level roll-up that composes per-repository boards without re-keying them (would still be repository-keyed rows).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed. The board performs only delivered read requests through the existing tracker client (bounded GET pages) and exposes one CLI command; no server endpoint is introduced.

### 8.2 Events / Messages

N/A — no new topic, kind, or payload shape. The board emits no events; the only durable record it can write is the delivered `owner-gate.decision` append, whose schema and record kind are unchanged.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Shared state-source identity | A declared contract constant naming the one fact bundle `collectStatusFacts` composes; carried additively as `stateSource` on the board payload and on the `delivery.status.v1` and `delivery.brief.v1` payloads (value identical on all three) |
| DM-2 | Full board payload (`delivery.board.v1`, additive) | `schemaVersion`, `audience` (unchanged), plus `scope`, `selection`, `repositories[]`, `lanes[]`, `asks[]`, `parked[]`, `stateSource`, `ownerHold`, and `omittedBySection` (`repositories`, `lanes`, `gates`, `asks`, `parked`); the delivered `gates[]`, `collectors[]`, `truncated`, `omitted` keys keep their names and meanings, with `truncated`/`omitted` extended to cover every section and the repository list |
| DM-3 | Gate row (delivered record extended) | Delivered `id`, `kind`, `ref`, `age`, optional `ageUnknownReason`, `slaState`, `default`, `waivedBy`, plus `repository`, `condition` (`<kind>:<slaState>`), `owner`, `ownerSource` |
| DM-4 | Lane row | `repository`, `ref`, `laneId`, `state` (`delivering` \| `failed`), `phase` (string or null), `phaseUnknownReason` (`phase-unrecorded` \| `phases-complete`, present exactly when `phase` is null), `holder` (lease holder or null), optional `leaseId`, optional `reason` (the delivered lane reason token). `phase` is the one phase-state entry the delivered fold reports in progress (`completed: null`); when more than one entry is open, the open entry latest in the canonical lifecycle order is reported. No phase record at all (no phase-state projection document, or a projection with no phase entries, and no `phase.transition` records) → `null` + `phase-unrecorded`; a record exists and every recorded entry is completed (nothing in progress) → `null` + `phases-complete`; the closed token set has exactly those two members (DEC-15) |
| DM-5 | Ask row | `repository`, `id`, `type` (the delivered closed question-type set), `ref` (string or the delivered bare `null`; the delivered typed-question view carries no absence reason, so no reason token is invented), `lane`, `question` (bounded), `askedAt`, `age` (ms), `status` (`open`), `owner`, `ownerSource`, `drawnDefault` (string or null), `defaultState` (`none` \| `pending` \| `applied`; the join observes the invocation's post-append decision set) (DEC-16, DEC-19) |
| DM-6 | Parked row | `repository`, `ref`, `reason` (`peak-window` \| `owner-hold` only; `provider-quota` is a provider/queue condition, not a lane park episode, and is never a `parked[]` row), `until` (string or null), optional `untilReason` (`owner-hold-no-expiry`), optional `preservation`, optional `providerProfile`, `owner`, `ownerSource` (DEC-18) |
| DM-7 | Repository selection and evidence | `repositories[]` (the included managed repository keys, ascending, unique, at most `BOARD_MAX_REPOSITORIES` = 128 with counted overflow and the selected repository always included), `scope` (`repository` \| `unbound`), `selection` (`current` \| `project` \| `all`), `collectors[]` entries carrying the delivered `{collector, outcome}` plus the `repository` the evidence belongs to, and `ownerHold` (`{active:false}` or `{active:true, source: env\|marker, reason?}`) |
| DM-8 | Error identities | `board.repository-unknown` (user, exit `1`: the requested key is not in the managed set) and `board.state-unavailable` (platform, exit `2`: a host index, repository state location, or required source cannot be read); both registered under a new `board` domain kind. Both are exact two-segment identities added to the closed `RESERVED_TWO_SEGMENT_CODES` allowlist — **53 → 55**, with no `board.*` family and no pattern widening — and the identity-table counts move **136 → 138** entries (**135 → 137** delivered rows) with exactly **2** `board` domain-kind rows and **136 → 138** documented identities (DEC-20, C-7). Grammar refusals (`--all` with `--project`, unknown flag, positional, `--project` with no value) are not new identities: they are the delivered `fallback.invocation` at exit `1` (DEC-17) |
| DM-9 | Lane lease-holder extension | The delivered lane projection gains an optional `leaseHolder`, present exactly when a live lease exists and equal to the lease's recorded holder; the payload identity and every delivered field are unchanged |
| DM-10 | `owner` provenance vocabulary | Closed `ownerSource` set — `lane-lease-holder`, `gate-waiver-authorizer`, `gate-audience`, `ask-audience`, `park-control` — stating where each row's `owner` value came from; `owner` is null only when the source records none, and never invented |
| DM-11 | Bounds and the repository cap | Per repository: gates 8 (delivered), lanes 20, asks 8, parked 8. `BOARD_MAX_REPOSITORIES` = 128 included repositories per board; `repositories[]` ascends by key, is unique, and always includes the selected repository (the invoking checkout for the default form and, when the invocation is bound, for `--all`; the requested key for `--project`). When the managed set exceeds 128, the retained set is the first 128 keys ascending when the invoking key is among them (or when the invocation is unbound), and otherwise the first 127 keys ascending plus the invoking key, re-sorted ascending; `truncated` is true and `omittedBySection.repositories` equals the number of managed keys not retained. Payload `data` ≤ 65 536 UTF-8 bytes; when the serialized payload exceeds the cap, rows are dropped tail-first in the fixed order `parked` → `asks` → `lanes` → `gates` (gates last), each drop incrementing `omitted` and its section counter; `repositories[]` and `collectors[]` are never dropped by the byte guard. At the 41-character key bound the repository list is ≤ 5 640 bytes, below 9% of the payload cap. Human screen ≤ 24 lines / 4 096 bytes at ≤ 400 bytes per line. Field caps: id/kind/ref/question 160, owner/waivedBy 120, reason 120, phase 60, until 40 characters (DEC-13) |

**Command grammar.** `<binary> board [--all] [--project <key>] [--json]`. `--all` takes no value; `--project` requires one; `--json` is the global machine-output switch. Zero positionals are accepted. Any other flag, any positional, the `--all` + `--project` combination, and a `--project` with no value are refused through the delivered containment identity `fallback.invocation` at exit `1` before any source is read (DEC-17).

**Contract shape.**

```
board.data = {
  schemaVersion: "delivery.board.v1",
  audience: "owner",
  scope: "repository" | "unbound",
  selection: "current" | "project" | "all",
  repositories: ["<repoKey>", ...],   // ascending, unique, ≤ BOARD_MAX_REPOSITORIES (128)
  lanes:   [{ repository, ref, laneId, state, phase, phaseUnknownReason?, holder, leaseId?, reason? }],
  gates:   [{ repository, id, kind, ref, age, ageUnknownReason?, slaState, default, waivedBy, condition, owner, ownerSource }],
  asks:    [{ repository, id, type, ref, lane, question, askedAt, age, status, owner, ownerSource, drawnDefault, defaultState }],
  parked:  [{ repository, ref, reason, until, untilReason?, preservation?, providerProfile?, owner, ownerSource }],
  collectors: [{ collector, outcome, repository }],
  ownerHold: { active: false } | { active: true, source, reason? },
  stateSource: "delivery.status-facts.v1",
  truncated: boolean,
  omitted: number,
  omittedBySection: { repositories, lanes, gates, asks, parked }
}
```

**Ordering and identity invariants** (normative). `repositories[]` ascends by repository key, unique, and is the retained set defined by DM-11: when the managed set exceeds `BOARD_MAX_REPOSITORIES`, the retained keys are the first 128 ascending when the invoking key is among them (or when the invocation is unbound), otherwise the first 127 ascending plus the invoking key, re-sorted ascending, with the drop counted in `omittedBySection.repositories`. `lanes[]` orders by repository key then ref ascending; identity `(repository, ref)`. `gates[]` orders by repository key then the delivered rank key (severity `escalated`, `default-applied`, `fresh`; descending age with unknown age first within a class; id ascending); identity `(repository, id)`. `asks[]` orders by repository key then the delivered blocker rank key; identity `(repository, id)`. `parked[]` orders by repository key then ref ascending; identity `(repository, ref)`. Every identity is unique within its array, and no ordering is influenced by collector, provider, filesystem, or host-index return order.

**Scope resolution.** The managed set is the host index's recorded checkouts whose root exists, plus the invoking checkout when its scope is bound and its key is not already recorded (the index record wins). The default form reads no host index and uses the invoking checkout only. `--project` resolves against the same managed set. `--all` reads the host index once. An absent host index means the managed set is the invoking checkout alone (or empty when unbound) — not an error; a present-but-unreadable or unparseable index is `board.state-unavailable` at exit `2`. The included set is the selected key for `current`/`project` and the retained ascending subset of at most `BOARD_MAX_REPOSITORIES` (128) for `all`, with the invoking checkout retained when the invocation is bound; the board reads only included repositories. `--project` resolves against the full managed set, so a key beyond the ascending cap is still a valid target and is always included. The `unbound` scope belongs to the default form's unbound invoking checkout or one whose identity cannot be derived (AC-F3-5); `--all` and `--project` report `scope: "repository"` even when `repositories[]` is empty.

**Exit projection.**

| Outcome | Envelope | Exit |
|---|---|---|
| Board produced (including empty sections and the `unbound` scope) | Success envelope, `delivery.board.v1` `data` | `0` |
| `--project` key outside the managed set | Error envelope, `board.repository-unknown` | `1` |
| Grammar violation (`--all` with `--project`, unknown flag, positional, `--project` with no value) | Error envelope, `fallback.invocation` (delivered) | `1` |
| Required collector unavailable | Error envelope, `status.collector.<id>.unavailable` (delivered) | `2` |
| Host index, repository state, or a required source unreadable | Error envelope, `board.state-unavailable`, naming the repository key | `2` |

### 8.4 External Integrations

N/A — no new vendor or API integration. The board reuses the delivered tracker client and credential posture for its bounded read page per repository; an unconfigured or uncredentialed tracker is the delivered collector-unavailable classification at exit `2`, never a fabricated empty fleet. No write request is issued to any provider.

### 8.5 Backward Compatibility

- **Payload identity is unchanged.** `delivery.board.v1` stays the board payload identity. The change adds keys, extends gate records with new fields, and extends the meaning of `truncated`/`omitted`; it removes, renames, and re-semantics nothing (DEC-2). The delivered gate fields keep their names, types, and meanings, so a consumer written against the M1 gate grid keeps reading valid gate records.
- **Delivered behaviour preserved.** The collector mapping, thresholds, `>=` boundaries, policy map, waiver recording, ranking, gate cap, decision-record append, collector-unavailable identities, and human bounds are preserved (AC-F4-1, AC-F4-2, AC-F4-3). The gate-only rendering path is the gates section, not a second mechanism.
- **Additive on brief and status.** `stateSource` is one new key appended to the `delivery.status.v1` and `delivery.brief.v1` `data` payloads; no delivered key changes, and the human screens are unaffected. The brief contract's declared member list and the brief machine golden are updated together with the key. The group-scoped `status --project <groupKey>` form returns its own group payload and does not carry `stateSource`; only the repository-scoped digest does.
- **Additive on the lane projection.** `leaseHolder` is optional; every delivered lane field, the human lane text, and the payload identity are unchanged.
- **New error identities.** `board.repository-unknown` and `board.state-unavailable` are new; the delivered `status.collector.<id>.unavailable` family and its exit rows are untouched in identity, category, and exit — only their explanatory wording is generalized from "gates" to "board", because the command now withholds more than a gate grid. Consumers matching the board's failures must accept the two new identities; no delivered identity changes meaning. The closed two-segment allowlist is widened by exactly these two codes (53 → 55, DEC-20), not by a family or pattern; the identity-table counts move 136 → 138 (135 → 137 delivered) with 2 `board` rows. Grammar refusals keep the delivered `fallback.invocation` identity at exit `1`, so a consumer that already classifies a broken invocation keeps working (DEC-17).
- **Bounded repository list.** `repositories[]` is a new key and is bounded to `BOARD_MAX_REPOSITORIES` (128) entries with the overflow counted in `omittedBySection.repositories`; the no-drop guarantee applies to the selected repository and to every key that fits the cap, not to an unbounded fleet (DEC-13).
- **No data migration.** No state file, index entry, store layout, or record payload is renamed, rewritten, or moved.
- **Naming boundary holds.** The board's repository-list field is `repositories[]` and no board surface names a group; `repoKey`, the host index's `projectKey`, and `--project` keep their delivered meaning.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope continuity: every new key lives under `data`, and the five-field `delivery.result.v1` envelope is untouched | 0 new top-level envelope keys; 0 `ok`/`command` fields anywhere |
| NFR-2 | Determinism and ordering: repeated runs over unchanged facts are stable, and every array order is the declared order | 2 of 2 runs byte-identical in human text and in JSON `data` (envelope timing/run id excluded); 0 order sources other than the declared keys |
| NFR-3 | Row identity and cross-repository containment: no duplicated row in a section and no state shared between repositories | 0 duplicate `(repository, …)` identities; `--all` row count = sum of the included per-repository boards before any byte-guard drop, with every such drop counted; 2 repositories holding one ref produce 2 rows |
| NFR-4 | Bounds: machine and human output stay within the delivered and declared caps, and every drop is counted | `data` ≤ 65 536 UTF-8 bytes; human ≤ 24 lines / 4 096 bytes; ≤ 400 bytes per human line; `repositories[]` ≤ `BOARD_MAX_REPOSITORIES` (128) entries with the selected repository always included and the overflow counted in `omittedBySection.repositories`; the byte guard drops rows tail-first in the order `parked` → `asks` → `lanes` → `gates` and never drops the repository list or collector evidence; `truncated` true whenever any row or repository is dropped |
| NFR-5 | Read cost: one bounded pass per included repository, no pagination, no retry, no duplicate client stack | ≤ 1 tracker page (100 items) + 1 delivery-request page (100) + 1 CI page (20) + 1 blocker read + 1 queue ledger read (entries, edges, leases) + 1 park read + 1 local-context read + 1 spend read + ≤ 1 phase read per active lane (≤ 20) + ≤ 1 decision-history read per repository (including the ask `defaultState` join, which performs no second read); 1 host-index read per `--all` or `--project` run and 0 for the default form; ≤ 128 included repositories (`BOARD_MAX_REPOSITORIES`), from a host index that admits up to 2 000 records |
| NFR-6 | Write discipline: the board mutates no delivery state except the delivered idempotent decision record | ≤ 1 appended decision record per newly defaulted gate and 0 when a record exists; 0 index maintenance, 0 prune, 0 edits/deletes; exactly the 2 delivered store-opening side effects |
| NFR-7 | Purity: no LLM, no network write, no timer, no daemon, no product literal | 0 LLM calls; 0 non-GET provider requests; 0 timers/loops; 0 hardcoded product or binary names (brand seam only) |
| NFR-8 | Responsiveness: the pure projection and render of a cap-sized two-repository board completes inside the delivered budget | warm median of 5 runs ≤ 50 ms, I/O excluded |
| NFR-9 | Quality gates for the delivering change | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |
| NFR-10 | Commit hygiene for the delivering change | Conventional commit subjects via the commit primitive; every commit body/footer line ≤ 100 characters |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no new telemetry ships. Observability is the payload's own evidence discipline:

- `collectors[]` names every collector that contributed, per repository, with `available` outcomes on a produced board — so a reader can see which repositories were read by which collector.
- `omitted` and `omittedBySection` count every dropped row and every dropped repository key, so a bounded screen never implies completeness.
- `scope`/`selection`/`repositories[]` state exactly what the board claims to cover; `repositories[]` is bounded to `BOARD_MAX_REPOSITORIES` (128) and its overflow is counted in `omittedBySection.repositories`.
- Failures are the classified identities `board.repository-unknown`, `board.state-unavailable`, and the delivered collector family, each with its exit row; the summary names the failing repository key.
- The delivered bounded warning channel carries the `unbound` scope notice and the delivered maintenance notices; warnings never change an exit code and never enter the payload.
- The delivered command-audit ledger records the invocation as it records every composed command; the board adds no counter, metric, or trace.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | False all-clear: a repository or collector cannot be read and the board renders as empty or zero | H | M | No partial board: any unreadable repository, host index, or required source withholds the board as `board.state-unavailable` at exit `2` naming the key; within a produced board every drop — row or repository — is counted (`truncated`, `omittedBySection`); the unbound scope is explicit (F-8, NFR-4) | Low |
| RSK-2 | Vocabulary divergence: board, brief, and status describe the same work with different words or different row populations | M | M | One shared fact bundle named by `stateSource` on all three payloads; gates, asks, and parked reuse the delivered gate vocabulary, blocker views, and park projection verbatim; the lanes section is the delivered lane fold (F-2, F-4–F-6) | Low |
| RSK-3 | Multi-repository cost and partial failure: `--all` issues N read sets and one failure loses everything | M | M | Bounded single pass per repository with no pagination or retry; declared cap of `BOARD_MAX_REPOSITORIES` (128) included repositories; fail-closed with the failing key named; sequential resolution keeps cost predictable; the read-cost requirement is measured (NFR-5, NFR-6) | Medium |
| RSK-4 | Payload identity break: extending a delivered payload breaks an M1 consumer | M | L | `delivery.board.v1` is extended additively — no key removed, renamed, or re-semanted; delivered gate fields keep names and types; no alias is needed because no delivered board repository list existed (DEC-2, DEC-12, §8.5) | Low |
| RSK-5 | Mounting gap: the command is composed but not reachable, or the coverage check fails | M | M | Mounting is a declared capability with a complete unit: prompt-set entry, production composition, root and family help, reference page serving `--help`/`--version`, coverage-inventory row; the family-count assertions are updated with the mount (F-7, AC-F7-1/2) | Low |
| RSK-6 | Ask provenance drift: `asks[]` grows into the S5 steering surface or invents a drawn default | M | M | The population is the delivered open owner-audience question set; the drawn default is the delivered PDR-0003 policy value for a defaultable gate on the same ref, with `none` declared when absent; S5 owns per-ask batching (F-5, DEC-4, NG-1) | Low |
| RSK-7 | Write creep under a read-only claim: multi-repository reads write into other repositories' state | H | L | The only write is the delivered idempotent decision record, scoped per repository, and it is declared rather than hidden; index maintenance is excluded and the board joins the read-only `maintainsIndex` exception set (NFR-6, DEC-6) | Low |
| RSK-8 | Phase/lease provenance invention: a lane row shows a phase or holder the engine never recorded | M | L | `holder` is the recorded lease holder (or null), `phase` is the delivered phase-state fold result (or null with `phase-unrecorded` / `phases-complete`); no ordering or rendering invents a value (F-1, DM-4, DEC-7) | Low |
| RSK-9 | Cap-induced blind spot: an `--all` run over more than 128 managed repositories lists only the retained set | M | L | The cap is declared (`BOARD_MAX_REPOSITORIES` = 128), the retained set is deterministic and ascending, the invoking checkout is included when bound, and `omittedBySection.repositories` plus `truncated` state how many are not listed; `--project <key>` always reaches a key beyond the cap (F-3, DM-11, AC-F9-4, DEC-13) | Low |

## 12. ASSUMPTIONS

- The delivered GH-229 board baseline (gate mapping, SLA, policy map, decision record, ranking, bounds) stays stable; this change composes it and does not re-derive it.
- The delivered GH-237 lane/queue fold, GH-230 typed-question ledger and views, and GH-294 park projection stay stable; this change consumes them and extends only the lane projection with an optional lease holder.
- The delivered GH-288 multi-repository state scope and host index stay stable; the board consumes them and adds no state family.
- The delivered GH-309 naming boundary holds: the board is repository-keyed, `repositories[]` is its list field, and no board form is group-scoped.
- The host index is maintained by the store-opening invocations that operate inside a checkout; the board itself does not maintain it, so a checkout first used only by the board appears in `--all` through the invoking-checkout clause and in later runs through the index once another command registers it. The index admits up to 2 000 records; a board run includes at most `BOARD_MAX_REPOSITORIES` (128) repositories and counts the remainder rather than reading it.
- `stateSource` is an identity token, not a payload schema id; adding it to the brief and status payloads is a contract-legal additive change.
- Owner asks are the open owner-audience typed questions; the delivered view's `ref` is a bare `string | null` with no absence-reason token, and the board carries it verbatim.
- A `provider-quota` park is a provider/queue condition, not a lane park episode; only `peak-window` and `owner-hold` reach `parked[]`.
- Only GitHub is exercised as a tracker; the board inherits the delivered credential posture and classifies an unconfigured tracker as collector-unavailable.
- The delivered five-field envelope shape, exit-code meaning, and error taxonomy remain unchanged.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-229 (M1-S5 owner-gate SLA) | **Delivered** — the gate mapping, SLA, policy map, decision record, ranking, and bounds the gates section preserves |
| Depends on | GH-237 (M1-S17 scheduling engine) | **Delivered** — the lane/queue fold, the park projection, and the `lanes` collector id the lanes and parked sections consume |
| Depends on | GH-288 (M2-S11 multi-repository workstations) | **Delivered** — the host root, the per-repository state scope, the `unbound` scope, and the host index |
| Depends on | GH-309 (M2-S18 project groups) | **Delivered** — `repos list`, the `repositories[]` naming rule, and the repository-key boundary |
| Depends on | GH-230 (typed blocker channel) | **Delivered** — the audience seam, the open-question views with age, and the shared ranking |
| Depends on | GH-294 (provider peak pausing) | **Delivered** — the `peak-window` / `owner-hold` park reasons, the open-episode projection, and the classified `owner-hold` absence of `until` |
| Depends on | Delivered result contract and error table | The new `board` domain kind and its two rows must be registered and documented in-boundary (C-7), including the exact closed two-segment allowlist widening (53 → 55) and the identity-count updates (136 → 138, 135 → 137, 2 board rows; DEC-20, C-16) |
| Blocks | Nothing in M2 | The board is a read surface; M2-S6 and M2-S10 consume their own evidence and do not require this command |
| Related | M2-S5 steer (GH-298) | A later surface may add per-ask drawn defaults and batched resolution; this board's ask schema is the extension point |

## 14. OPEN QUESTIONS

The seven test-plan review points and the DoR iteration-1 F2 remediation are closed; no question remains open. The planning open point (ask provenance) was already resolved in DEC-4, and the contract-shape questions (payload identity, state-source identity, selection semantics, bounds, lane phase and holder provenance) are pinned in DEC-2, DEC-3, DEC-5, DEC-7, DEC-8, DM-11, and DEC-13..DEC-20. Nothing in this specification defers a decision to plan or test authoring.

| ID | Question (raised at review) | Resolution | Where | Status |
|----|----------------------------------------|------------|-------|--------|
| OQ-1 | `DM-11`/`C-6` forbid truncating `repositories[]`, while NFR-4 caps `data` at 65 536 bytes and the host index admits 2 000 entries with keys up to 41 characters — both cannot hold. | The repository list is bounded: `BOARD_MAX_REPOSITORIES` = 128 included repositories, ascending, the selected repository always included, overflow counted in `omittedBySection.repositories` with `truncated: true`; row drops follow the declared byte-guard order, never the repository list. | DM-11, NFR-4, AC-F9-4, C-6, DEC-13 | Closed |
| OQ-2 | The default form (`scope: "repository"`, `selection: "current"`, exactly the invoking key, zero host-index reads) had no acceptance criterion of its own. | Added AC-F3-6; TC-BOARD-010 already exercises the behaviour and must cite the new criterion (with AC-NFR5-1 retained for the read-cost half). The test plan's AMB-TP-6/OQ-TP-1 are retired by this resolution. | AC-F3-6, DoD-3, Appendix B, DEC-14 | Closed |
| OQ-3 | `DM-4` closed the `phaseUnknownReason` set but did not state the cell where a phase record exists and no phase is in progress. | No phase record → `phase: null` + `phase-unrecorded`; a record exists and every recorded entry is completed → `phase: null` + `phases-complete`; an open entry → its phase id. The closed set is exactly those two tokens. | DM-4, F-1, DoD-8, DEC-15 | Closed |
| OQ-4 | Does the ask `defaultState` join observe a decision record appended during the same board run, or the pre-run snapshot? | Post-append: the join observes the invocation's decision set after its own append, so a default applied in this run reads `applied` on the same run's ask row; the single decision-history read is reused and no second read occurs. | F-5, DM-5, AC-F5-3, NFR-5, DEC-16 | Closed |
| OQ-5 | The grammar refusal was named only as "the delivered containment identity". | The delivered identity is `fallback.invocation` at exit `1` for unknown flag, positional, `--all` with `--project`, and `--project` with no value. | F-8, §8.3 grammar, exit projection, AC-F3-4, DEC-17 | Closed |
| OQ-6 | Are `provider-quota` parks in or out of `parked[]`? | Out. `parked[]` is the lane park episode projection (`peak-window`, `owner-hold`); a `provider-quota` park is a provider/queue condition, not a lane, and remains on the delivered provider and queue surfaces. | F-6, DM-6, §7.1, §7.2, NG-9, DEC-18 | Closed |
| OQ-7 | The ask row carried a bare `ref: null` with no declared absence reason. | Kept as the delivered bare `null`: the delivered typed-question view declares `ref: string \| null` and carries no absence-reason token, so the board invents none and carries the value verbatim. | F-5, DM-5, AC-F5-2, C-14, DEC-19 | Closed |
| OQ-8 | DoR iteration-1 F2: `feature-result-contract.md` declares the two-segment error-code allowlist closed, but the spec added `board.repository-unknown` and `board.state-unavailable` without declaring the exact allowlist widening or the identity-table count updates. | Declared as an explicit reviewed contract change: exactly the two board codes join `RESERVED_TWO_SEGMENT_CODES` (53 → 55) in the sync check and its structural mirror, with no family/pattern widening; the carrier expectations are 136 → 138 entries (all four structural assertions), 135 → 137 delivered rows, 2 `board` domain-kind rows, and 136 → 138 documented identities. Owned by AC-F8-3 and DoD-14. | DM-8, DEC-8, DEC-20, C-7, C-16, §16, §16.1, AC-F8-3, DoD-14 | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Scope is the backlog M2-S4 task line and the M2 board contract exactly: the full four-section board sharing the brief/status state source, spanning managed repositories by repository key, mounted at the entrypoint; M2-S5 steer, M2-S6 metrics, and group scoping are excluded | Backlog is canonical for scope; pm-notes DEC-1 records the same boundary; the pack's board page is the surface contract | 2026-11-15 |
| DEC-2 | The board payload keeps the `delivery.board.v1` identity and is extended additively; the schema version is **not** bumped | Repository precedent: the spend v2 delivery added five keys under the unchanged `delivery.spend.v1` identity and explicitly refused a v1 key rename (feature-spend DEC-6). The board adds keys, adds gate fields, and widens `truncated`/`omitted` coverage; it removes/renames/re-semantics nothing, so a bump would signal a breaking change that does not exist. A bump becomes mandatory only when a key is removed, renamed, or re-semanted | 2026-11-15 |
| DEC-3 | The state source is named `delivery.status-facts.v1` on the board, status, and brief payloads. It names the one fact bundle `collectStatusFacts` composes, from which status and brief project their digests and from which the board projects gates, asks, and parked; the board's lanes read the delivered lane fold, which is named as the `lanes` collector in `collectors[]` (the delivered closed collector-id set already contains it) | pm-notes DEC-2 defines the source as the status/brief facts plus the shipped lane fold. Naming it lets the backlog AC be asserted literally across three payloads (`board.data.stateSource === status.data.stateSource === brief.data.stateSource`), while naming the lane fold as a collector keeps the fourth section's provenance explicit instead of claiming the lane fold is part of the facts bundle | 2026-11-15 |
| DEC-4 | `asks[]` is the open **owner-audience typed-question** population, projected through the delivered open-question view (with its computed age and shared ranking), each row carrying the drawn default joined from the delivered owner-gate policy by canonical ref (`owner-review-first` for a defaultable gate on that ref, `pending` or `applied`; `null`/`none` otherwise). Rejected: (a) the owner-review subset of the owner-gate facts — it duplicates the gates population and its drawn-default column is always null because that class is never-merge and non-defaultable; (b) questions alone — the contract's drawn-default column would be permanently unpopulated | The board contract requires both `age` and a drawn default. Only two shipped sources carry a drawn default: the PDR-0003 policy map (owner-gate) and nothing else; only the typed-question channel is an "ask" population with an age. The join answers the owner's real question — "what happens if I stay silent on this ref?" — and the pack's own example (`default=hold`) matches `owner-review-first`'s hold posture. S5 owns per-ask batching later; this is the delivered-source projection, not a new mechanism | 2026-11-15 |
| DEC-5 | The managed set is the host index's live recorded checkouts **plus** the invoking checkout when it is bound; the index record wins on a key collision. `--all` reads the index once, `--project` resolves against the same set, the default form reads no index, and an absent index is not an error | The board does not maintain the host index (DEC-6 keeps the read-only claim), so a checkout first touched only by the board must still be visible to `--all`; the union keeps "every managed repository" true without a write. An absent index on a fresh host is an empty extension, not a failure | 2026-11-15 |
| DEC-6 | The board joins the read-only `maintainsIndex` exception set (with `repos` and `projects`), and its only state write is the delivered idempotent `owner-gate.decision` append per repository, plus the two delivered store-opening side effects | The planning constraint is "read-only". The delivered SLA's default application is a write AC-F4-2 must preserve; suppressing it would silently stall the SLA it claims to show. The honest contract is a declared, bounded, idempotent carve-out rather than a false read-only claim | 2026-11-15 |
| DEC-7 | `lanes[]` is the **active** lane view: lanes the delivered fold reports as `delivering` or `failed`. The lease holder comes from the delivered lease projection via an optional `leaseHolder` field; the phase comes from the delivered phase-state read for that ref, null with `phase-unrecorded` or `phases-complete` when absent. `holder` and `phase` are never inferred | The board contract's lane row is "active lanes with ref, phase, and lease holder" and the delivered lane projection carries neither the holder nor a phase. Extending the shipped projection with an optional holder is additive and keeps one lane model; a missing phase is classified, never fabricated. Idle/waiting lanes stay in `lanes list` | 2026-11-15 |
| DEC-8 | Two error identities are added under a new `board` domain kind: `board.repository-unknown` (user, exit `1`) and `board.state-unavailable` (platform, exit `2`). The delivered `status.collector.<id>.unavailable` family keeps its meaning and exit `2` for collector unavailability. The two identities also join the closed two-segment allowlist exactly (53 → 55, no `board.*` family); the allowlist and identity-count change is recorded in DEC-20 | The board contract declares exactly these two identities and the delivered board already owns the collector family. Both rows and the documented family text are carried in-boundary because the error-table sync gate requires each new row's documentation in the same change boundary (C-7). The allowlist is a closed exact set in current-truth (`feature-result-contract.md`), so adding two-member codes is a contract change, not an additive detail; leaving it undeclared would make the spec contradict the truth it cites | 2026-11-15 |
| DEC-9 | The delivered human bounds are preserved (24 lines / 4 096 bytes, 400 bytes per line) and the four sections fit them through declared per-section human caps (lanes 6, gates 6, asks 4, parked 3 rows, plus one header line and four section lines), each section's label line carrying its `+N more` marker | AC-F4-3 preserves delivered bounds; "one screen" is the point of the story. Raising the cap would weaken a delivered NFR, and a bounded screen with explicit omission counts is truthful | 2026-11-15 |
| DEC-10 | Mounting follows the delivered pattern exactly: prompt-set entry (21 families), unconditional production composition, root and family help entries, the M2 board reference page serving `--help`/`--version`, and the coverage-inventory row | Entrypoint-delta's "Mounting a new command" states the mandatory unit; GH-288, GH-289, GH-290, and GH-309 delivered the same pattern | 2026-11-15 |
| DEC-11 | `parked[]` is the open lane-park episode population (latest per ref) with reason, until, preservation, and provider profile; the host-wide owner hold is carried once as `ownerHold`; local-context parked work is not board content | The board contract's parked column is "reason and until", which is the lane park projection. The owner hold is a host-wide condition that would otherwise make an idle fleet look unexplained. PM-context parked entries have no `until` and remain a status/brief surface | 2026-11-15 |
| DEC-12 | `repositories[]` is introduced, not renamed: the delivered board payload never carried a repository list, so there is no `projects[]` to rename and no alias to keep | GH-309 DEC-3 already resolved this from pack status (board edge-composed only, page already names `repositories[]`); a non-existent field cannot break, and inventing an alias would invent a contract | 2026-11-15 |
| DEC-13 | `repositories[]` is bounded to `BOARD_MAX_REPOSITORIES` = 128 included repositories, ascending and unique; the selected repository is always included; when the managed set exceeds the cap, the retained set is the first 128 keys ascending when the invoking key is among them (or when the invocation is unbound), otherwise the first 127 keys ascending plus the invoking key, re-sorted ascending, and the drop is counted in `truncated`/`omittedBySection.repositories`. The 65 536-byte `data` cap holds for the whole payload; when it binds, rows are dropped tail-first in the fixed order `parked` → `asks` → `lanes` → `gates`, and the repository list and collector evidence are never dropped | The delivered invariant "`repositories[]` is never truncated" cannot hold with a 65 536-byte payload and a host index admitting 2 000 records with 41-character keys; 128 keys are ≤ 5 640 bytes at the key bound, leaving the budget to the rows, and 128 bounded read sets keep NFR-5 finite. Counting the overflow preserves the no-silent-all-clear principle: the board never claims completeness it does not have. Rejected: an unbounded repository exemption, which would raise the payload to ~90 KB of keys alone, break the delivered cap, and permit 2 000 read sets per run | 2026-11-15 |
| DEC-14 | The default form is its own criterion (AC-F3-6): a bound invoking checkout yields `scope: "repository"`, `selection: "current"`, `repositories[]` exactly its `repoKey`, and zero host-index reads; an unbound invoking checkout or one whose identity cannot be derived follows AC-F3-5. TC-BOARD-010 already exercises it and must cite AC-F3-6 (with AC-NFR5-1 retained for the read-cost half) | The default form is the board's primary invocation and was provable only indirectly through a section criterion and a read-cost criterion. A dedicated criterion makes the three properties (scope, selection, no index read) independently testable and closes the test plan's AMB-TP-6/OQ-TP-1 without adding a new mechanism | 2026-11-15 |
| DEC-15 | `phaseUnknownReason` is total: no phase record (no phase-state projection document, or a projection with no phase entries, and no `phase.transition` records) → `phase: null` + `phase-unrecorded`; a record exists with every recorded entry completed (nothing in progress) → `phase: null` + `phases-complete`; an open entry → that phase id, with multiple open entries resolving to the open entry latest in the canonical lifecycle order. The closed token set is exactly those two members | The delivered fold records a phase entry only after a transition, so "record exists but nothing in progress" is the all-completed cell; naming it removes the one undefined cell and makes every lane-row test deterministic without inventing a third token | 2026-11-15 |
| DEC-16 | The ask `defaultState` join observes the invocation's **post-append** decision set: the decision-history records read for the run plus the records this run appended. A default applied in the run therefore projects `applied` on the same run's ask rows; the join reuses the single history read and performs no second read | A pre-run snapshot would render `pending` on a row whose gate the same run just defaulted — a false statement the owner would act on. The delivered board already reads history before appending and appends before rendering, so post-append is the honest end-of-run state and needs no additional read | 2026-11-15 |
| DEC-17 | Grammar refusals use the delivered containment identity `fallback.invocation` at exit `1`: unknown flag, positional argument, `--all` with `--project`, and `--project` with no value. No `board.*` grammar identity is added | `fallback.invocation` is the delivered reserved containment code for broken invocations (`FALLBACK_INVOCATION_CODE`, user validation, exit `1`), produced by the shared parser before any command handler runs. Inventing a board-specific grammar code would fork the delivered classification and break consumers that already classify a broken invocation | 2026-11-15 |
| DEC-18 | `parked[]` excludes `provider-quota`: the population is the delivered open lane park episode projection (`peak-window`, `owner-hold`). Provider-level parks stay on the delivered provider and queue surfaces and are declared out of scope (NG-9) | The board's parked column is the lane park projection, whose closed read-time reason set is `peak-window`/`owner-hold`; `provider-quota` is a queue/provider condition with no lane episode, no `until`, and no preservation classification. Including it would require a second park model on a board that claims one — so the omission is declared rather than accidental | 2026-11-15 |
| DEC-19 | A ref-less ask carries the delivered bare `ref: null` and no absence-reason field | The delivered typed-question record and view declare `ref: string \| null` with no reason token; the ledger records no cause for a question that names no ref, so any reason string would be an invention. Carrying the delivered value verbatim is the only contract-legal choice; the board's classified-absence discipline applies where the source actually records a classification (the owner-hold `until`) | 2026-11-15 |
| DEC-20 | The two board identities are an explicit, reviewed widening of the closed two-segment error-code allowlist, GH-230 DEC-9 style: `RESERVED_TWO_SEGMENT_CODES` gains exactly `board.repository-unknown` and `board.state-unavailable` (**53 → 55**) in `scripts/checks/error-table-sync.ts` and its structural mirror `tests/structure/error-table.test.ts`, with no `board.*` family and no pattern widening. The carrier's exact count expectations are: `ERROR_TABLE` entries **136 → 138** (all four structural count assertions), delivered rows in the spend-exclusion assertion **135 → 137**, `board` domain-kind rows **2**, and documented identities **136 → 138**. The reconciled allowlist paragraph must state **55**, not 54: the current 52-entry count omits the delivered `verify.narrowed-scope` identity, so 53 delivered + 2 board = 55 | GH-230 DEC-9 precedent: a two-segment identity enters only by exact declaration, never by widening the three-segment minimum, and the check plus its mirror assert the exact set size so an undeclared addition is a red gate rather than a convention. Current truth calls the allowlist closed ("no pattern or family widening"), so the spec must own the exact two-code change and every count that follows; leaving it to delivery discovery would be undeclared drift and would contradict NG-6's posture. The documented table is the carrier's in-boundary write, so its identity count and allowlist paragraph must move with the table | 2026-11-16 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `board` CLI family (`packages/cli/src/commands/board.ts`) | Extended — four-section composition over the shared facts bundle, the lane fold, and the park projection; repository selection grammar (`--all`, `--project`); classified identities and the declared exit projection; the `unbound` scope |
| Board payload contract and pure projections (`packages/core/src/contracts/owner-gate-sla.ts`, `packages/core/src/domain/owner-gate-sla.ts`) | Extended — additive payload keys and row types, the shared source identity, per-section ordering/identity, omission accounting, and the four-section deterministic renderer |
| Board edge composition (`packages/cli/src/edge.ts`: board runtime seams; lane runtime seam) | Extended — per-repository read set, phase resolve, park classification, managed-set resolution, and the delivered collector evidence |
| Shared facts bundle (`packages/cli/src/commands/status.ts`, `brief.ts`) | Extended additively — `stateSource` on both payloads; the collection itself is unchanged |
| Status and brief contracts and projections (`packages/core/src/contracts/status.ts`, `brief.ts`, their domain modules) | Extended additively — one new `data` key each; goldens and contract member lists updated |
| Scheduling-engine lane projection (`packages/core/src/contracts/queue.ts`, `packages/core/src/domain/queue-lanes.ts`) | Extended additively — optional `leaseHolder`; delivered fields, human text, and payload identity unchanged |
| State scope and host index consumers (`packages/core/src/app/state-scope.ts`, `packages/adapters/src/file/host-index-store.ts`) | Consumed unchanged — host root, per-repository state root, unbound scope, one index read |
| Error table and classifier (`packages/core/src/contracts/error-table.ts`, `packages/cli/src/classify.ts`) | Extended — a new `board` domain kind and two rows; the closed two-segment allowlist gains exactly those two codes (53 → 55) with no family widening, and the identity counts move 136 → 138 (135 → 137 delivered; 2 board rows) |
| CLI entrypoint and help (`packages/cli/src/entrypoint.ts`, `production.ts`, `help.ts`, `help/prompt-required-commands.ts`, `scripts/checks/help-guide-coverage.ts`, `tests/fixtures/help-guide/coverage.json`) | Extended — prompt-set entry, unconditional composition, root and family help entries, reference page, coverage row; family-count assertions updated |
| Current-truth feature specs | Reconciled in phase 7 (see §16.1); the error-table carrier is the one in-boundary documentation write (C-7) |
| Planning corpus (backlog marker, status snapshot, CLI command registry, M2 board page status, entrypoint delta) | Maintained at delivery per milestone conventions |

### 16.1 Doc impact (phase-7 reconciliation)

| Document | Expected reconciliation |
|---|---|
| `doc/spec/features/feature-owner-gate-sla.md` | The board section becomes the four-section board; the "not-yet-delivered fleet grid" wording and the gate-only payload description are updated; the preserved gate mechanism is restated as the gates section |
| `doc/spec/features/feature-status-digest.md` | The digest payload gains `stateSource`; the shared-source statement names the board as a consumer of the same bundle; the `lanes-or-queue` declared gap remains a status gap and is not claimed as closed |
| `doc/spec/features/feature-brief.md` | The brief payload gains `stateSource`; the shared-truth section notes the same identity as status and board |
| `doc/spec/features/feature-scheduling-engine.md` | The lane projection gains the optional `leaseHolder`; the board is named as a consumer of the lane/park folds |
| `doc/spec/features/feature-projects.md` | The host index section notes the board's managed-set rule (index union invoking checkout) and that the board does not maintain the index |
| `doc/spec/features/feature-result-contract.md` | **In-boundary carrier (C-7):** the new `board` domain kind, `board.repository-unknown`, `board.state-unavailable`, and the board's exit projection rows; the two delivered `status.collector.<id>.unavailable` rows keep their identities and exits, with their explanatory wording generalized from "gates" to "board". The closed two-segment allowlist paragraph gains exactly `board.repository-unknown` and `board.state-unavailable` (53 → 55, no family/pattern widening) and the documented identity counts move 136 → 138 (both mentions) with the `board` kind's 2 rows; the paragraph's current 52-entry count is reconciled to 55 (it omits the delivered `verify.narrowed-scope` identity). Phase 7 reconciles the surrounding current-truth prose and confirms the same numbers |
| New current-truth feature spec (full board) | Authored in phase 7: the four sections, the shared source, the repository selection, the ask/parked provenance, the bounds, the exit projection, and the read-only carve-out |
| `doc/planning/oss-tooling/cli-command-registry.md` | The `board` row moves from "not delivered / M1-S5 only" to Delivery with the full-board scope |
| `doc/planning/oss-tooling/milestones/m2/commands/board.md` | Status flips to delivered; the page carries the `--help`/`--version` mentions the coverage check requires |
| `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | The observed root listing records 21 families with `board` mounted |
| `doc/planning/oss-tooling/backlog.md` | The M2-S4 progress marker records delivery |

## 17. ACCEPTANCE CRITERIA

**Four sections from one shared source**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a repository with an active lane, an open owner ask, an open gate, and a parked lane, **when** `<binary> board` runs, **then** the screen renders exactly the four sections `LANES`, `GATES`, `ASKS`, `PARKED` in that order, every row names its repository key, ref, and owner, and `board --json` carries `lanes`, `gates`, `asks`, and `parked` with at least one row in each (ticket AC; scenario seed SC-M2-S4-01 inherited, not restated) | F-1, DM-2, DM-3–DM-6 |
| AC-F2-1 | **Given** the same facts, **when** `board --json`, `status --json`, and `brief --json` run, **then** `board.data.stateSource` equals `status.data.stateSource` and `brief.data.stateSource`, and `board.data.stateSource` equals the declared shared-source identity — so the shared-source claim is asserted from the payloads, not from code reading (scenario seed SC-M2-S4-01 inherited, not restated) | F-2, DM-1, DM-2 |
| AC-F2-2 | **Given** the board's lane section, **when** the payload is inspected, **then** `lanes[]` is the delivered lane projection of the included repositories, `collectors[]` carries a `lanes` evidence entry per included repository, and no section names a source outside the shared facts bundle plus the delivered lane fold | F-1, F-2, DM-7, DM-9 |
| AC-F2-3 | **Given** an unreadable blocker ledger, park store, or gate source, **when** `board` runs, **then** the run is withheld with the declared identity at exit `2` naming the repository key, and no section renders zero rows for that source | F-8, NFR-4 |

**Repository scope without mixing**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** two managed repositories on one host, **when** `board --all` runs, **then** `repositories[]` holds both repository keys (both are within the 128 cap, so the seed's full set is retained), every lane appears under its own repository key, and each section's row count equals the sum of the included per-repository boards with no duplicated row identity (scenario seed SC-M2-S4-02 inherited, not restated) | F-3, F-9, DM-7, NFR-3 |
| AC-F3-2 | **Given** two managed repositories that both hold the same ref, **when** `board --all` runs, **then** the two rows stay distinct and each carries its own repository key, phase, holder, and state; no row merges or overwrites the other | F-3, F-9, DM-4, NFR-3 |
| AC-F3-3 | **Given** a repository key that is not in the managed set, **when** `board --project <key>` runs, **then** the run is refused with `board.repository-unknown` at exit `1` and no section or repository row is rendered | F-3, F-8, DM-8 |
| AC-F3-4 | **Given** `board --project <repoKey>` for a managed key, **when** it runs, **then** `selection` is `project`, `repositories[]` names exactly that key (even when the key sits beyond the ascending 128-key cap), and no other repository's state is read; **given** `board --all` with `--project`, **then** the invocation is refused with the delivered `fallback.invocation` at exit `1` | F-3, DM-7, DEC-17 |
| AC-F3-5 | **Given** a default-form `board` invocation outside any work tree **or** with an invoking checkout whose identity cannot be derived, **when** it runs, **then** `scope` is `unbound`, `repositories[]` is empty, every section is empty, the delivered bounded warning is attached, and the exit code is `0` — never an error, never a host-index fallback, and never a claim about a repository; `--all` and `--project` are not covered by this unbound rule | F-3, F-8, DM-7 |
| AC-F3-6 | **Given** a bound invoking checkout, **when** `board` runs with no `--project` and no `--all`, **then** `scope` is `repository`, `selection` is `current`, `repositories[]` is exactly the invoking checkout's repository key, the run performs zero host-index reads, and no other repository's state is read; **given** an unbound invoking checkout or one whose identity cannot be derived, **then** the run follows AC-F3-5. Test mapping: TC-BOARD-010 already asserts this behaviour and the test plan must add AC-F3-6 to its Related IDs (with AC-NFR5-1 retained for the read-cost half; retiring AMB-TP-6/OQ-TP-1) | F-3, DM-7, NFR-5, DEC-14 |

**Delivered SLA preserved**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** gates at the declared ages, **when** `board --json` runs, **then** each gate keeps the delivered `slaState` semantics (`fresh` under 24 h; `escalated` from 24 h; `default-applied` at or after 72 h for a defaultable `waiver` kind), the delivered `owner-review` kind remains never-merge and non-defaultable, a recorded authorized waiver still surfaces as `waiver` with its `waivedBy`, and the delivered rank order holds | F-4, DM-3 |
| AC-F4-2 | **Given** a `waiver` gate crossing 72 h, **when** `board` runs twice, **then** the first run appends exactly one decision record and renders `default-applied` with `owner-review-first`, and the second run appends nothing and renders the identical row — the delivered idempotent default application | F-4, NFR-6, DM-3 |
| AC-F4-3 | **Given** a produced board, **when** bounds are measured, **then** the delivered gate cap of 8 per repository, the per-section caps (lanes 20, asks 8, parked 8), the 65 536-byte `data` cap, the 24-line / 4 096-byte human cap, and the delivered field caps hold, and every drop — by a per-section cap or by the byte guard — sets `truncated` and increments `omittedBySection`; the repository-list cap is asserted by AC-F9-4 | F-4, F-9, DM-11, NFR-4 |

**Owner asks and parked work**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** an open `owner`-audience question for a ref that also holds a defaultable gate, **when** `board --json` runs, **then** the ask row carries the delivered question fields with its computed `age`, `drawnDefault` equal to the delivered policy default for that gate, and `defaultState` `pending` (or `applied` when a decision record exists, including one appended earlier in the same run) | F-5, F-4, DM-5 |
| AC-F5-2 | **Given** an open `owner`-audience question for a ref with no defaultable gate, **given** an owner question that names no ref, and **given** a `coordinator`-audience question, **when** `board --json` runs, **then** the first ask carries `drawnDefault: null` with `defaultState: "none"` (never an omitted field), the ref-less ask carries the delivered bare `ref: null` with no invented reason field, and the coordinator question is not an ask | F-5, DM-5, DEC-19 |
| AC-F5-3 | **Given** an open owner ask on a ref whose defaultable gate crosses 72 h during the run, **when** `board` runs, **then** the gate renders `default-applied`, exactly one decision record is appended, and the ask row **in the same payload** carries `defaultState: "applied"` — the join observes the invocation's post-append decision set, not a pre-run snapshot; a second run appends nothing and renders the identical ask row. The case also asserts no second decision-history read for the ask join (DEC-16, NFR-5) | F-5, F-4, DM-5, NFR-5, NFR-6, DEC-16 |
| AC-F6-1 | **Given** an open `peak-window` park, an open `owner-hold` park, and an open `provider-quota` park, **when** `board --json` runs, **then** both lane parks appear in `parked[]` with their causes, the peak-window row carries its `until` timestamp, the owner-hold row carries `until: null` with `untilReason: "owner-hold-no-expiry"` — never a fabricated expiry — and the `provider-quota` park produces no `parked[]` row (it is a provider/queue condition, not a lane park episode) | F-6, DM-6, DEC-18 |
| AC-F6-2 | **Given** an active host-wide owner hold, **when** `board --json` runs, **then** `ownerHold` carries the active hold with its source and sanitized reason, so an idle fleet is never rendered as an unexplained all-clear | F-6, DM-7 |

**Mounting**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the delivered entrypoint, **when** root `--help` runs, **then** `board` appears as a registered family among 21 families, and `board --help` answers at exit `0` with the command's summary, usage, options, examples, exit codes, and see-also pointer | F-7, F-8 |
| AC-F7-2 | **Given** the delivered help-coverage check, **when** it runs, **then** the board reference page exists, mentions `--help` and `--version`, and the coverage inventory carries the board row — the check reports zero failures | F-7 |

**Classified outcomes and determinism**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** any board invocation, **when** it completes, **then** its envelope is the five-field `delivery.result.v1` shape with all new keys under `data`, its exit code is `0`, `1`, or `2` exactly as §8.3 declares, and no failure envelope contains a partial board | F-8, NFR-1, DM-8 |
| AC-F8-2 | **Given** a host index that is present but unreadable, or a repository state location that cannot be read during `--all`, **when** `board` runs, **then** the run is `board.state-unavailable` at exit `2`, the summary names the failing repository key (or the index path), and nothing is rendered | F-8, DM-8 |
| AC-F8-3 | **Given** the delivered error-table sync check and its structural mirror, **when** the board identities land, **then** the closed two-segment allowlist contains exactly `board.repository-unknown` and `board.state-unavailable` and no other `board.*` code (**53 → 55**, exact declaration, no pattern or family widening); the table carries **138** entries (the four **136** structural assertions become **138**), **137** delivered rows in the spend-exclusion assertion (**135 → 137**), and exactly **2** `board` domain-kind rows; the documented table declares the same **138** identities and its allowlist paragraph states **55**; and a near-miss two-segment `board.*` code (for example `board.repository-unknowns` or `board.state`) is rejected by the check rather than accepted by family matching. Test mapping: the test plan must add/extend a structural case for the allowlist addition, the count bumps, and near-miss rejection | F-8, DM-8, DEC-20, C-7, C-16 |
| AC-F9-1 | **Given** unchanged facts, **when** `board` and `board --json` run twice, **then** the human text and the machine `data` are byte-identical (envelope timing and run id aside), and every array follows the declared repository-then-section order with unique row identities | F-9, NFR-2, NFR-3 |
| AC-F9-2 | **Given** any board run, **when** its writes are audited, **then** the only state mutation is the delivered idempotent decision record (≤ 1 per newly defaulted gate, 0 when present), there is no host-index maintenance, no prune, no edit or delete, and exactly the two delivered store-opening side effects occur | F-9, NFR-6, DEC-6 |
| AC-F9-3 | **Given** any board run, **when** its behaviour is inspected, **then** it makes no LLM call, no non-GET provider request, starts no timer or daemon, and renders no hardcoded product or binary name | F-9, NFR-7 |
| AC-F9-4 | **Given** an `--all` run whose managed set exceeds `BOARD_MAX_REPOSITORIES` (128), **when** the payload is measured, **then** `repositories[]` holds exactly the 128 retained keys in ascending order with the invoking checkout present when the invocation is bound, `omittedBySection.repositories` equals the number of managed keys not retained, `truncated` is `true`, and rows are dropped only by the declared byte-guard order (`parked` → `asks` → `lanes` → `gates`, tail first within a section) with each drop counted; the repository list and collector evidence are never dropped | F-3, F-9, DM-11, NFR-4, DEC-13 |
| AC-NFR5-1 | **Given** an `--all` run over two repositories, **when** reads are counted, **then** each repository performs at most the declared bounded read set with no pagination and no retry, the host index is read once, and the pure projection and render of the cap-sized two-repository board complete within the delivered 50 ms median budget | NFR-5, NFR-8 |
| AC-NFR9-1 | **Given** the delivering change, **when** quality gates run before the PR opens, **then** `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | NFR-9 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §17 acceptance criteria to a checkable outcome, names its verification method, and is proven in the delivering plan phase that owns the capability. This specification claims no passing evidence and no acceptance; the conditions define what must be proven.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The board renders exactly four sections from the shared facts bundle plus the delivered lane fold; every row names its repository key, ref, and owner | F-1, F-2, AC-F1-1, AC-F2-1, AC-F2-2 | SC-M2-S4-01 green; section-order and row-field contract tests green | Board-surface phase |
| DoD-2 | `stateSource` is the same declared identity on the board, status, and brief payloads, and the brief/status contract tests and goldens are updated with it | F-2, DM-1, AC-F2-1 | Cross-payload equality test green; brief/status contract and golden tests green | Shared-source phase |
| DoD-3 | Repository selection holds: the default form (scope `repository`, selection `current`, exactly the invoking key, zero host-index reads), `--project` narrowing, `--all` union of index and invoking checkout bounded to the 128-repository cap, the root-absent rule, the `unbound` scope (including an invoking identity that cannot be derived), and the `--all`/`--project` `fallback.invocation` refusal | F-3, DM-7, AC-F3-1..AC-F3-6, DEC-14 | TC-BOARD-010 related to AC-F3-6; SC-M2-S4-02 green; selection matrix tests green | Scope phase |
| DoD-4 | Two repositories sharing one ref produce two distinct rows in every section, with 0 duplicates and row counts equal to the sum of the included per-repository boards | F-3, F-9, AC-F3-1, AC-F3-2, NFR-3 | Cross-repository identity test green | Scope phase |
| DoD-5 | The delivered SLA is preserved: mapping, thresholds, policy map, waiver recording, ranking, gate cap, and idempotent default application with its decision record | F-4, AC-F4-1, AC-F4-2, AC-F4-3 | Delivered board suites still green after the composition change; idempotency test green | Gates phase |
| DoD-6 | Owner asks carry age and the drawn default joined from the delivered policy, with `none` declared for the no-default case, the post-append `applied` ordering, the delivered bare `ref: null`, and coordinator questions excluded | F-5, AC-F5-1, AC-F5-2, AC-F5-3, DEC-16, DEC-19 | Ask projection matrix tests green; TC-BOARD-031 same-run cell green | Asks/parked phase |
| DoD-7 | Parked work carries reason and until (with the classified owner-hold absence), excludes `provider-quota`, and places the host-wide owner hold on the payload | F-6, AC-F6-1, AC-F6-2, DEC-18 | Park projection tests green; a `provider-quota` fixture asserts no `parked[]` row | Asks/parked phase |
| DoD-8 | The lane section names the lease holder and the phase, with the closed null reasons `phase-unrecorded` (no record) and `phases-complete` (record exists, nothing in progress), and active-lane selection excludes idle/parked lanes | F-1, DM-4, DM-9, DEC-7, DEC-15 | Lane-row provenance tests green, including the middle phase cell | Board-surface phase |
| DoD-9 | Bounds hold: the `BOARD_MAX_REPOSITORIES` (128) cap with counted overflow and the selected repository always included, the per-repository caps, the 65 536-byte `data` cap, the 24-line / 4 096-byte human cap, the field caps, the declared byte-guard order, and counted omissions with `truncated` set | F-9, DM-11, AC-F4-3, AC-F9-4, NFR-4, DEC-13 | Bound and truncation tests green, including the over-cap repository fixture | Bounds phase |
| DoD-10 | Determinism and identity: two runs are byte-identical, arrays follow the declared order, and identities are unique | F-9, AC-F9-1, NFR-2, NFR-3 | Determinism and identity tests green | Bounds phase |
| DoD-11 | Write discipline: only the idempotent decision record is written; no index maintenance, prune, edit, or delete; the two delivered side effects hold | F-9, AC-F9-2, NFR-6, DEC-6 | Read-only audit test green; index-access counters assert zero maintenance writes | Mounting/write-discipline phase |
| DoD-12 | Purity: no LLM, no non-GET provider request, no timer or daemon, no hardcoded product name | F-9, AC-F9-3, NFR-7 | Purity and brand tests green | Every phase's gate |
| DoD-13 | Mounting is complete: prompt-set entry, unconditional production composition, root and family help, reference page serving the coverage check, coverage-inventory row, and updated family-count assertions | F-7, AC-F7-1, AC-F7-2 | Root `--help` snapshot test green; help-coverage check green | Mounting phase |
| DoD-14 | Error identities are registered under the new `board` domain kind and documented in the error-table carrier inside the boundary, including the exact closed two-segment allowlist widening (53 → 55, no family/pattern) and the identity-count expectations (136 → 138 entries, 135 → 137 delivered rows, 2 board rows, 136 → 138 documented identities) | F-8, DM-8, C-7, C-16, AC-F8-3, DEC-20 | Error-table sync test green with the 55-code allowlist and 138/137 counts; structural mirror green; near-miss rejection green; classifier tests green | Classification phase |
| DoD-15 | Read cost and responsiveness are within the declared bounds | NFR-5, NFR-8, AC-NFR5-1 | Read-count harness green; performance measurement recorded | Read-cost phase |
| DoD-16 | Full acceptance coverage: every §17 criterion green, with no uncovered criterion and no orphan test | §17, NFR-1..NFR-10 | Test-plan coverage matrix all Covered; execution evidence in pm-notes | Per-phase, roll-up at the final delivery phase |
| DoD-17 | The full gate battery is green at the delivered HEAD | NFR-9, AC-NFR9-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` recorded in pm-notes `notes:` | Final delivery phase / quality_gates |
| DoD-18 | PR posture: a pull request targets `main-tools` and is left open for human review with required CI green on the pushed HEAD; merge and owner acceptance are not claimed | §18 | PR record attached to the change | Lifecycle phase 11 |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: the full 11-phase lifecycle on the feature branch created from `main-tools`; the PR targets `main-tools` and stops open for human review. Commits go through the commit primitive with conventional subjects and every body/footer line ≤100 characters; `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens.
- **Sequencing inside the change**: the shared source identity and the additive brief/status key land before the board consumes them; the lane lease-holder extension lands before the lane row; error-table registration lands with the classification row; mounting lands after the surface is complete, so the prompt-set entry never advertises a command that cannot answer.
- **Adoption**: opt-in and additive. Existing single-repository habits keep working (`board` = the invoking checkout); `--all` is a new fleet read. No configuration key, no migration, and no operator action is required. The delivered gate-only consumers keep reading valid gate records.
- **Compatibility window**: the board payload stays `delivery.board.v1` with additive keys. If a consumer needs a distinguishing marker, it can key on the presence of `repositories`/`stateSource`; no alias or version bump is introduced (DEC-2).
- **Communication**: milestone bookkeeping through the backlog progress marker, the status snapshot, the CLI command registry, the M2 board page status, and the entrypoint delta; the current-truth feature specs are reconciled in phase 7.
- **Rollback**: revert-safe. The board is a read surface plus the delivered decision append; a revert restores the gate-only board (unmounted) and removes the additive keys, with no state to undo beyond already-recorded owner-gate decisions, which remain valid append-only history.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration and no seeding. The board introduces no state family, no record kind, no key prefix, and no store layout change; it reads the delivered per-repository state roots and the delivered host index as they are. The only durable write is the delivered `owner-gate.decision` append, which is idempotent and per repository, so a run against an existing store neither rewrites nor re-keys prior records. The additive lane `leaseHolder` is a projection field, not stored data.

## 20. PRIVACY / COMPLIANCE REVIEW

Low impact. The board reads facts the delivered surfaces already read and adds no new data flow off the host: tracker and delivery-request reads are the delivered bounded GET pages, and no record is transmitted anywhere. The payload carries bounded question text, refs, lane ids, principal tokens recorded by the waiver and lease paths, repository keys, filesystem roots only through the delivered repository records (not in the board payload), and the sanitized owner-hold reason (bounded by the delivered hold contract). No secrets or credential material are projected: the credential posture is the delivered admit/refuse check, and an unconfigured credential is a classified collector failure, never a rendered value. The human screen is ANSI-free and carries no titles, bodies, comments, or free-form notes.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Fail-closed rendering**: an unreadable repository, host index, or required source withholds the board instead of rendering zero rows — a degraded read cannot masquerade as a healthy empty fleet (F-8, NFR-4, RSK-1).
- **Bounded cross-repository reads**: the managed set is the delivered host index plus the invoking checkout, read at most `BOARD_MAX_REPOSITORIES` (128) included repositories per run (below the host index's 2 000-record bound); the board performs no filesystem crawl and no directory scan to discover repositories (F-3, NFR-5, DEC-13).
- **Write containment**: the only mutation is the delivered idempotent owner-gate decision append, scoped to each included repository; no index maintenance, no prune, no delete, no edit — declared rather than hidden (DEC-6, NFR-6).
- **No new trust boundary**: no new credential, socket, endpoint, or write request; the tracker read inherits the delivered admission rule and the shared credential port.
- **No execution surface**: no LLM in the render path, no shell-out, no timer, no daemon; the board is a bounded pure projection over injected facts.
- **Injection resistance**: the human screen is ANSI-free and every projected string is bounded and clamped, so a hostile tracker title, question text, or lane id cannot forge a section header or exceed the screen budget.
- **Principal accuracy**: `owner` is a recorded identity or a declared audience token with an explicit provenance (`ownerSource`), never an inferred principal.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **One board, one source**: future fleet surfaces should project from the same shared facts bundle and name it, rather than re-reading the world; the named identity is the contract that keeps divergence detectable.
- **Additive payload discipline**: `delivery.board.v1` evolves additively; a breaking change requires a version bump and is out of scope for this change. The gate record is the anchor for any future gate source.
- **Ask provenance ownership**: per-ask drawn defaults and batching belong to M2-S5; the board's `drawnDefault`/`defaultState` pair is the declared extension point, and S5 must extend rather than replace it.
- **Lane projection upkeep**: `leaseHolder` is now part of the lane contract; any future lane record must keep the holder accurate, and the board's phase read is bounded per active lane.
- **Read-only posture**: the board's membership in the read-only `maintainsIndex` exception set is deliberate; a future change that makes the board maintain the index must revisit the read-only claim and this decision.
- **Bounds upkeep**: the per-section caps, the `BOARD_MAX_REPOSITORIES` (128) repository cap, and the byte-guard drop order are declared constants; adding a fifth section requires re-balancing the 24-line budget rather than widening it, and raising the repository cap requires re-checking the 65 536-byte budget at the 41-character key bound (DM-11, DEC-13).
- **Planning corpus**: backlog markers, the status snapshot, registry rows, M2 page statuses, and the entrypoint delta are maintained per milestone conventions at delivery.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Full board | The `board` command's four-section fleet view: active lanes, open gates, owner asks, and parked work |
| Shared state source | The one fact bundle `collectStatusFacts` composes, named `delivery.status-facts.v1` and carried identically by the board, status, and brief payloads |
| Managed repository | A checkout recorded in the host index with an existing root, or the invoking checkout when it is bound |
| Included repository | A managed repository the board reads and lists: the selected key for the default and `--project` forms, or the retained ascending subset of at most `BOARD_MAX_REPOSITORIES` (128) for `--all`, with the invoking checkout retained when the invocation is bound |
| Repository key | The stable key derived from a checkout's identity (delivered as `projectKey` in the host index, `repoKey` in the flat record set) |
| `repositories[]` | The board's repository-list field: the included repository keys, ascending and unique, bounded to `BOARD_MAX_REPOSITORIES` (128) with counted overflow and the selected repository always included |
| Repository selection | The board's scope input: the invoking checkout (default), one key (`--project`), or every managed repository up to the cap (`--all`) |
| `unbound` scope | The declared scope of the default form when the invocation is outside any git work tree or the invoking identity cannot be derived: empty board, bounded warning, exit `0`, never an error |
| Active lane | A lane the delivered fold reports as `delivering` or `failed`; idle and waiting lanes stay in `lanes list` |
| Lease holder | The identity recorded on the live lease that makes a lane `delivering` |
| Lane phase | The lifecycle phase the ref's delivered phase-state fold reports as in progress, or `null` with the closed reason `phase-unrecorded` (no phase record) or `phases-complete` (record exists, nothing in progress) |
| Owner ask | An open owner-audience question from the delivered typed-question ledger; a question that names no ref carries the delivered bare `ref: null` |
| Drawn default | The delivered owner-gate policy value that resolves silence for a defaultable gate on the same ref; `none` when no such gate exists |
| `defaultState` | `pending` (default will apply at expiry), `applied` (a decision record exists, including one appended earlier in the same run), or `none` (no default will resolve it) |
| Park episode | One open lane park recorded by the delivered park fold (`peak-window` or `owner-hold`): cause, `until`, preservation, provider profile; `provider-quota` is a provider/queue condition, not a lane park episode |
| Owner hold | The delivered host-wide hold marker; one hold stops every project on the host and has no expiry |
| `owner` / `ownerSource` | A row's accountable identity and the closed provenance token stating which evidence supplied it |
| Omission count | `omitted`/`omittedBySection` (including `omittedBySection.repositories`): the number of rows or repositories dropped by a cap or the byte guard, always stated |
| Condition token | A gate row's composed `<kind>:<slaState>` condition |
| Decision record | The delivered append-only `owner-gate.decision` record written when a default applies |

## 24. APPENDICES

### Appendix A — Planning open-point resolutions

| # | Open point (from planning) | Resolution | Where |
|---|----------------------------|------------|-------|
| 1 | Provenance of `asks[]`: the owner-review subset of delivered SLA facts, the open owner-audience typed questions, or a join | **The open owner-audience typed questions, joined to the delivered policy default by canonical ref.** The owner-review subset duplicates the gates population and its drawn-default column can never be non-null (never-merge, non-defaultable); questions alone leave the contract's drawn-default column permanently unpopulated. The join uses only shipped sources: the delivered question views (age, ranking) and the delivered PDR-0003 policy map (drawn default) | DEC-4, F-5, AC-F5-1, AC-F5-2 |
| 2 | Relationship between the full board and the delivered `delivery.board.v1` schema: bump or extend additively? | **Extend additively, no bump.** The change adds keys and gate fields and widens two counters' coverage; it removes/renames/re-semantics nothing. Repository precedent (spend v2 under the unchanged `delivery.spend.v1` identity) governs, and a bump would falsely signal a breaking change | DEC-2, §8.5, RSK-4 |
| 3 | How `--all` composes per-repository reads without a second state model or N parallel tracker clients | **One sequential pass per included repository over the delivered read seams**: the shared facts bundle, the delivered lane/queue fold, the delivered park projection, and the delivered phase-state read; one tracker client per repository built by the delivered factory over the shared transport and credential port; the host index read once; the managed set is index ∪ invoking checkout; the board never maintains the index | DEC-5, DEC-6, F-3, NFR-5 |
| 4 | The four-section human screen versus the delivered 24-line bound | **Preserve the delivered bound** and fit the sections through declared per-section human caps with omission markers (lanes 6, gates 6, asks 4, parked 3) | DEC-9, DM-11 |
| 5 | The test-plan review's bounds contradiction: `repositories[]` unbounded versus the 65 536-byte cap and the 2 000-record host index | **Bound the repository list** at `BOARD_MAX_REPOSITORIES` = 128 included repositories, ascending, selected repository always included, overflow counted; row drops follow the declared byte-guard order and never touch the repository list | DEC-13, DM-11, NFR-4, AC-F9-4, C-6 |
| 6 | The test-plan review's remaining contract gaps (default-form criterion, phase-null cell, same-run `applied`, grammar identity, `provider-quota` population, bare `ref: null`) | **Closed in DEC-14..DEC-19**; each has one normative rule, one owning AC or contract row, and a test-plan mapping note in Appendix B | §14, DEC-14..DEC-19 |

### Appendix B — Ticket acceptance criteria mapping

The backlog story M2-S4 (GH-297) declares one acceptance criterion; it is decomposed below without adding a second meaning.

| Ticket AC (M2-S4) | Spec criteria | Scenario seeds |
|---|---|---|
| AC — board, brief, and status share one state source | AC-F1-1, AC-F2-1, AC-F2-2, AC-F2-3 (the sections render, the source is named and equal across payloads, and the lane read is contract-visible) | SC-M2-S4-01 (inherited by name) |
| Story task — full board of lanes, gates, owner asks, parked work on one screen | AC-F1-1, AC-F4-1..AC-F4-3, AC-F5-1..AC-F5-3, AC-F6-1/2 | SC-M2-S4-01 |
| Story task — one screen sharing the brief and status state source | AC-F2-1, AC-F2-2 | SC-M2-S4-01 |
| Story task — the default invocation | AC-F3-6 (the invoking checkout is the implicit scope; TC-BOARD-010) | SC-M2-S4-01 (default `board` invocation) |
| Story dependency / multi-repository clause (`--project`, `--all`, repository keys) | AC-F3-1..AC-F3-5 | SC-M2-S4-02 (inherited by name) |
| Story delivery convention (mounted, reviewable) | AC-F7-1, AC-F7-2, AC-F8-1, AC-F8-2, AC-F8-3, AC-F9-1..AC-F9-4, AC-NFR5-1, AC-NFR9-1 | New cases in the change test plan |

**Test-plan mapping note (binding on the reopened test plan).** `TC-BOARD-010` already asserts the default form; it must add `AC-F3-6` to its Related IDs (keeping `AC-NFR5-1` for the read-cost half), and `AMB-TP-6`/`OQ-TP-1` are retired by that mapping. `TC-BOARD-006` must assert the middle phase cell as `phases-complete` (retiring `OQ-TP-2`). `TC-BOARD-031` already asserts the same-run `applied` cell and now cites `AC-F5-3`; `OQ-TP-3` is closed. `TC-BOARD-014`/`TC-BOARD-051` must assert `fallback.invocation` (retiring `OQ-TP-4`). The parked cases must assert that a `provider-quota` park produces no `parked[]` row. The ask cases must assert the bare `ref: null` with no reason field. `TC-BOARD-070` and `AMB-TP-4` must assert `BOARD_MAX_REPOSITORIES` (128), not equality with the 2 000-record host-index bound; `AMB-TP-7`/`OQ-TP-6` are closed by DEC-13. The structural error-table case must add/extend an assertion set for AC-F8-3: the allowlist addition (**53 → 55**, exactly two `board.*` codes), the count bumps (**136 → 138** in all four structural count assertions; delivered **135 → 137**; exactly **2** `board` rows), the documented **138** identities with the allowlist paragraph at **55**, and rejection of a near-miss two-segment `board.*` code (no family matching).

### Appendix C — Constraint register (carried into plan and test authoring)

- C-1: The board payload identity is `delivery.board.v1` and the change is additive only — zero removed, renamed, or re-semanted keys (DEC-2).
- C-2: `stateSource` is identical on the board, status, and brief payloads; the lanes read is named as the `lanes` collector, never claimed as part of the facts bundle (DEC-3, F-2).
- C-3: The delivered SLA mechanism is reused, not re-implemented: the same evaluator, policy map, ranking, gate cap, and decision append (F-4, AC-F4-1/2).
- C-4: No partial board — an unreadable required source withholds at exit `2` with the failing repository key named (F-8, NFR-4).
- C-5: The managed set is index ∪ invoking checkout; the board performs no index maintenance and no directory scan (DEC-5, DEC-6).
- C-6: `repositories[]` is bounded to `BOARD_MAX_REPOSITORIES` = 128 included repositories, ascending, with the selected repository always included and the overflow counted in `omittedBySection.repositories`; every dropped row is counted in `omitted`/`omittedBySection`; the byte guard drops rows in the order `parked` → `asks` → `lanes` → `gates` and never drops the repository list or collector evidence (DM-11, NFR-4, DEC-13).
- C-7: **In-boundary documentation carrier**: the new `board` domain kind and its two rows are documented in `doc/spec/features/feature-result-contract.md` inside the delivering boundary, because the error-table sync gate inside `pnpm check` requires every new row's documentation in the same boundary (GH-288/289/290/292/309 precedent). The carrier also declares the exact closed two-segment allowlist widening (53 → 55) and the identity counts (136 → 138 entries, 135 → 137 delivered rows, 2 board rows, 136 → 138 documented identities) because the sync check and its structural mirror assert those exact values; the widening is a reviewed contract change (DEC-20), never a silent pattern/family broadening. No other behavioural current-truth prose flips in delivery — that remains phase 7 (NG-6).
- C-8: Gate battery and commit hygiene per ticket conventions: `TMPDIR=$PWD/tmp/tmpdir pnpm check` before the PR; conventional subjects; every body/footer line ≤100 chars; PR to `main-tools`, left open (NFR-9, NFR-10).
- C-9: Excluded scope is binding: no steer surface, no metrics/alarms, no group scope, no new state family or event topic, no network write, no LLM (§7.2, NG-1..NG-9).
- C-10: Grammar refusals are the delivered `fallback.invocation` at exit `1` for an unknown flag, a positional, `--all` with `--project`, and `--project` with no value; no `board.*` grammar identity exists (DEC-17, AC-F3-4).
- C-11: Lane `phaseUnknownReason` is total and closed: no phase record → `phase-unrecorded`; a record exists with nothing in progress → `phases-complete`; an open entry → its phase id (DEC-15, DM-4, AC-F3-2, DoD-8).
- C-12: The ask `defaultState` join observes the invocation's post-append decision set, so a default applied in the run reads `applied` on the same payload; the join reuses the one decision-history read (DEC-16, AC-F5-3, NFR-5).
- C-13: `parked[]` is the lane park episode population (`peak-window`, `owner-hold`); `provider-quota` is out and remains on the delivered provider/queue surfaces (DEC-18, NG-9).
- C-14: A ref-less ask carries the delivered bare `ref: null` with no invented reason field (DEC-19, DM-5, AC-F5-2).
- C-15: The default form is asserted by AC-F3-6 and TC-BOARD-010; scope `repository`, selection `current`, exactly the invoking key, zero host-index reads, and an unbound invoking checkout or one whose identity cannot be derived follows AC-F3-5 (DEC-14, DoD-3).
- C-16: The closed two-segment allowlist gains exactly `board.repository-unknown` and `board.state-unavailable` (**53 → 55**) in `scripts/checks/error-table-sync.ts` and its structural mirror `tests/structure/error-table.test.ts`, with no `board.*` family and no near-miss acceptance. Count expectations: `ERROR_TABLE` **136 → 138** (all four structural count assertions), delivered rows in the spend-exclusion assertion **135 → 137**, board domain-kind rows **2**, documented identities **136 → 138** with the allowlist paragraph reconciled to **55** (DEC-20, AC-F8-3, DoD-14).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | spec-writer (deepseek-flash) | Initial specification from GitHub issue #297 (M2-S4), the backlog story entry, the M2 milestone pack (board contract, contracts rename rule, scenario seeds, architecture, journeys, entrypoint delta), the delivered M1-S5 board and M1-S17 lane contracts, the delivered brief/status fact bundle, the M2-S11 state scope and host index, the M2-S18 naming boundary, and pm-notes decisions DEC-1..DEC-5; the planning open point (ask provenance) and the three interpretation points (payload identity, ask provenance, multi-repository composition) resolved in DEC-2..DEC-12 |
| 1.1 | 2026-11-15 | spec-writer (deepseek-flash) | Amendment closing seven test-plan review findings: the bounded `repositories[]` rule (`BOARD_MAX_REPOSITORIES` = 128, counted overflow, byte-guard order) resolves the DM-11/C-6 versus NFR-4 contradiction; AC-F3-6 gives the default form its own criterion; DM-4/F-1 make the lane phase-null cell total (`phase-unrecorded` / `phases-complete`); F-5/DM-5/AC-F5-3 pin the post-append `defaultState` join; F-8/§8.3/AC-F3-4 name `fallback.invocation` as the grammar-refusal identity; F-6/DM-6/NG-9 declare `provider-quota` out of `parked[]`; DM-5/AC-F5-2/glossary declare the delivered bare `ref: null`. Decisions DEC-13..DEC-19 added; §14 records all seven as closed; DoD-3/6/7/8/9, Appendix B, and Appendix C (C-6, C-10..C-15) updated |
| 1.2 | 2026-11-16 | spec-writer (deepseek-flash) | DoR iteration-1 F2 remediation: declares the exact reviewed widening of the closed two-segment error-code allowlist (`board.repository-unknown` and `board.state-unavailable`; 53 → 55) with no `board.*` family or pattern broadening, and the carrier's identity-count expectations (136 → 138 entries, 135 → 137 delivered rows, 2 `board` domain-kind rows, 136 → 138 documented identities; the allowlist paragraph reconciled to 55). DM-8, F-8, DEC-8, new DEC-20, C-7, new C-16, §13, §16, §16.1, new AC-F8-3, DoD-14, Appendix B, and §14/OQ-8 updated; the finding is closed |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #297 "M2-S4: Board (M2)"; the backlog story M2-S4 (canonical scope, AC, dependencies); the M2 milestone pack — `commands/board.md` (the full board contract: synopsis, four sections, envelope keys, exit status, error identities), `contracts.md` (shared continuity, the rename rule that names `repositories[]`, project-scoped aggregation, queue/park vocabularies), `test-scenarios.md` (SC-M2-S4-01/02, inherited by name, not restated), `architecture.md` (multi-repository overview, repository plane, per-repository state scope), `journeys.md` (multi-repo morning overview), `README.md` (story-to-artifact map), `entrypoint-delta.md` (mounting pattern and observed root listing), `commands/board.md` under M1 (the delivered SLA surface); the delivered current truth — `feature-owner-gate-sla.md` (board payload, gate mapping, SLA, policy map, bounds), `feature-status-digest.md` and `feature-brief.md` (the shared fact bundle and their payloads), `feature-scheduling-engine.md` (lane fold, park reasons, lane states), `feature-projects.md` (host root, per-repository state scope, host index, state-location outcomes), `feature-blockers.md` and `feature-peak-pausing.md` (the typed-question ledger and the park projection); and `chg-GH-297-pm-notes.yaml` (binding scope, state-source, repository-scope, mounting, and open-question entries).

Resolutions applied: the three interpretation points are resolved from pack truth plus shipped sources and recorded as decisions rather than deferred — ask provenance (DEC-4), schema version (DEC-2), multi-repository composition (DEC-5/DEC-6). The shared-source identity (DEC-3) is a declared addition because the pack's seed asserts a payload field that no delivered payload carries; it is introduced additively on all three surfaces rather than asserted in prose only. The v1.1 amendment closes the seven test-plan review findings in DEC-13..DEC-19; every affected contract row, acceptance criterion, DoD condition, and constraint now states the same rule, and no finding remains open (§14). The v1.2 amendment closes DoR iteration-1 F2 in DEC-20: the closed two-segment allowlist and the identity-table counts are declared exactly rather than discovered at delivery.

Constraints honored: capability-level scope only — no implementation steps and no code-level instructions. Module references in §16 identify affected components and the delivered evidence the change consumes; they are not implementation directives. Scenario seeds, contract pages, and delivered specs are referenced by name, never duplicated. The delivered bounds are preserved rather than renegotiated — the new board adds declared per-section caps and the bounded repository list under the delivered byte and line caps (DM-11, DEC-13) — and every deviation from the pack's example snippets (the envelope shape, the additive `stateSource`, the additive `ownerHold`) is recorded as a decision.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-297)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, DoD-, GAP-, NG-, G-, C-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] Change-specific Definition of Done present (§17.1) binding every AC with verification and plan-phase ownership
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Out-of-scope items start with `[OUT]`
- [x] Doc impact section present (§16.1) naming the phase-7 reconciliation set and the in-boundary error-table carrier
- [x] No implementation details (no step-by-step tasks, no code-level instructions)
- [x] No content duplicated from linked docs (contracts, command pages, and scenario seeds referenced by name only)
- [x] No unresolved contradiction: `repositories[]` is bounded by `BOARD_MAX_REPOSITORIES` (128) with counted overflow, consistent across DM-11, NFR-4, AC-F4-3, AC-F9-4, DoD-9, and C-6
- [x] Every test-plan review finding is closed with a normative rule and recorded in §14 (OQ-1..OQ-7) and DEC-13..DEC-19
- [x] DoR iteration-1 F2 is closed: the two-segment allowlist widening is exact and reviewed (53 → 55, no family/pattern), and the identity counts are declared (136 → 138, 135 → 137, 2 board rows, 136 → 138 documented) in DM-8, DEC-20, C-7, C-16, §16.1, AC-F8-3, and DoD-14
- [x] Front matter validates per front_matter_rules
