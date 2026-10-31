---
change:
  ref: GH-175
  type: feat
  status: Proposed
  slug: status-v1
  title: "M0-S6: status v1"
  owners: [engineering]
  service: delivery-os CLI status digest
  labels: [change, planning]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - state layer
      - provider client seeds
      - adapter ports and credential port
      - configuration layer
      - result contract and error table
      - monorepo scaffold and toolchain
    external:
      - GitHub REST API
links:
  related_changes: ["GH-172", "GH-173", "GH-174", "GH-177", "GH-179", "GH-181", "GH-188"]
  related_decisions: ["ADR-0003", "ADR-0004", "ADR-0006"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Replace the coordinator's manual, per-session probing of tracker, pull requests, CI, lanes, providers, and parked work with one read-only `ados status` call that returns exactly six named sections, each carrying an explicit state and bounded evidence, and never lets an absent, failed, or unattempted network read masquerade as an all-clear.

## 1. SUMMARY

This change delivers M0-S6 `status v1`: the first call of every session returns a bounded, ranked digest of the delivery world. The command has exactly six sections — tracker, changes and pull requests, CI, lanes or queue, providers, and parked work — in a fixed order. Every section carries one state from a closed five-value vocabulary (`observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`), a bounded evidence record, counts, ranked items, and an explicit truncation marker. `--json` returns the full bounded structure in the standard `CommandResult` envelope; human mode returns a short deterministic digest rendered from the same data.

The tracker collector answers the four ticket-named families from normalized `WorkItem` data: owner hand-backs, blocked dependencies, stalls, and ticket hygiene. The changes and pull requests collector combines the local active-change record with open pull requests. The CI collector reads pipeline runs for the current checkout's pushed commit. The lanes-or-queue collector reports a declared, evidenced `not-delivered` state because no queue or lane engine exists until M2-S1. The providers collector reads the declared provider chain from configuration and active parks from the verified state layer without executing the provider engine. The parked-work collector reads non-provider parked delivery changes from the local, git-ignored PM context.

The change adds no error-table rows, no configuration keys, and no state-schema changes. It extends the minimal GitHub read slice with two bounded collection reads under the existing read operations, gives the existing check-runs read a declared page limit, adds the repository binding read and the local PM-context read, and introduces status contracts plus a pure aggregator in the runtime-neutral core tiers. Every degraded, unknown, unavailable, and not-delivered state is a first-class result, not a command failure: status always returns the six sections, and only broken invocations or an unclassifiable internal failure produce an error envelope.

## 2. CONTEXT

### 2.1 Current State Snapshot

- Dependencies are delivered on `main-tools` at `7155074`: GH-174 state layer (verified ledger reads, torn-state classification, provider park fold), GH-188 provider client seeds (Jira read slice, GitLab, minimal GitHub read slice with trap catalogs), GH-181 adapter ports and credential port, GH-173 configuration layer (typed `provider` branch only), GH-172 result contract and error table, GH-179 pm-notes lint and phase ledger, and GH-177 verify change.
- `ados status` is named by the command registry but no status command, status contract, status domain logic, or status collector exists. The command registry row says "One bounded, ranked digest of the delivery world: tracker, changes and PRs, CI, lanes or queue, providers, parked work", delivered by M0-S6, extended by M1-S10 and M2-S4.
- The minimal GitHub read slice supports `readWorkItem(issueNumber)`, `readDeliveryRequest(pullNumber)`, and `readPipelineRun(commitSha)`. It has no list or search read, so status cannot enumerate open issues or open pull requests today. The Jira read slice already treats query-shaped reads as `read-work-item` (`searchWorkItems`), which is the precedent for adding collection reads without changing the closed adapter-operation set.
- The GitHub issue normalizer reads a synthetic `issue_links` field. The real GitHub REST issue list does not supply structured issue links, and the GitHub PR list does not supply a review decision or review threads. The GH-188 seed spec's public surface therefore describes more than the real minimal REST read can supply. Status must not turn those absent signals into "no blocked dependencies", "open review", or "zero unresolved threads".
- The provider configuration branch exists and is validated; `provider.defaultChain` is absent by default and `provider.chains` ships empty. The provider engine's park records and `provider-parks.json` fold exist in the state layer; status can read active park views without running the engine.
- `.ai/local/pm-context.yaml` is the local, git-ignored PM coordination file. It carries `active_change` and `parked_changes`; it is absent in a clean checkout and in CI. The file is not committed and must never be committed by this change.
- The local `.ai/local/pm-context.yaml` in this worktree records active change GH-175 on `feat/GH-175/status-v1` and an empty `parked_changes` array. The current `origin` remote is `git@github.com:juliusz-cwiakalski/agentic-delivery-os.git`; the checkout HEAD is `7155074` on that branch.
- No queue or lane engine exists until M2-S1. No provider telemetry exists until M0-S13. No full GitHub adapter, GraphQL review-decision read, or issue-dependency read exists until M3-S3.
- The result contract declares `DOMAIN_KINDS = provider, input, config, state, lint, verify`; no status identity exists or is needed. The error table and its documented table are synchronized in both directions, and the sync check is binding.

### 2.2 Pain Points / Gaps

- The coordinator probes tracker, pull requests, CI, lanes, providers, and parked work by hand at the start of every session. This is the largest measured token cost in the delivery loop, and the probing is inconsistent between sessions.
- Probing produces non-evidence-backed signals: a missing network call, a missing token, an unsupported query, or an empty result can all look like "nothing to do". The most expensive failure is a false all-clear.
- There is no single bounded digest: the coordinator reads raw tracker and PR data, which is unbounded and expensive, and no two sessions see the same shape.
- The provider park vocabulary exists, but nothing surfaces active parks to the session bootstrap; an active provider park can look like available capacity.
- The queue/lane engine does not exist, but a naive status implementation would show an empty "lanes or queue" section, implying a clear queue rather than a missing capability.
- Parked delivery work has no canonical read from the session bootstrap. Provider parks and parked delivery changes are different concepts and are easily conflated.
- The minimal GitHub read slice cannot enumerate work items or pull requests, so dogfooding status on this repository requires a bounded read extension.

## 3. PROBLEM STATEMENT

Because the coordinator has no single typed, evidence-backed first-call digest, it must manually probe six different sources every session — the largest measured token cost in the delivery loop — and those probes silently conflate "read failed", "source absent", "capability not delivered", "signal omitted", and "nothing to report", so the coordinator cannot distinguish a genuinely quiet delivery world from an unobserved or degraded one, and provider parks, parked work, and a missing queue engine can all present as an all-clear.

## 4. GOALS

- **G-1**: One read-only `ados status` command, exactly named by the command registry, with no command-specific flags beyond the global `--json`.
- **G-2**: Exactly six named sections in a fixed order, each with a closed state vocabulary, bounded evidence, counts, ranked items, and a truncation marker.
- **G-3**: Evidence truthfulness: no failed, absent, unattempted, or unresolved network read may become an observed, clear, green, available, or zero claim.
- **G-4**: Tracker answers the four ticket-named families from normalized `WorkItem` data: owner hand-backs, blocked dependencies, stalls, and ticket hygiene.
- **G-5**: Changes and pull requests, CI, providers, and parked work each have a defined source, state model, and degradation behavior.
- **G-6**: The lanes-or-queue section reports a declared, evidenced `not-delivered` state; it never implies an empty queue and never duplicates `queue ready`.
- **G-7**: Providers read the declared chain from configuration and active parks from the verified state layer; status never executes the provider engine, fetches quota, or mutates parks.
- **G-8**: Parked work is non-provider parked delivery work with a defined source of truth, truthful absence, and a distinct label from provider parks.
- **G-9**: Bounded output: exact caps, deterministic ordering, truncation evidence, a short non-LLM human digest, and the standard machine JSON envelope.
- **G-10**: Minimal addressing and read surface: derive the GitHub repository from the checkout's `origin` remote, add only the bounded GitHub collection reads status needs, keep credentials through `CredentialPort`, and add no speculative configuration branch.
- **G-11**: Read-only, deterministic, tier-compliant, brand-neutral behavior with no new runtime-API location, no new secret-read allowlist entry, and no new error-table identity.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Named sections returned on every successful status run, in fixed order | 6/6 |
| Section states drawn from the closed vocabulary; sections missing evidence or truncation marker | 100% valid / 0 |
| Failed, absent, unattempted, or unresolved reads rendered as observed, clear, green, available, or zero | 0 |
| Tracker families answerable from normalized `WorkItem` data alone | 4/4 on the fixture corpus; blocked dependencies explicitly unavailable on the minimal GitHub slice, never empty |
| Active provider park reported as available | 0 |
| Lanes-or-queue section reported as an observed empty queue | 0 |
| CI with no reported pipeline reported as succeeded or green | 0 |
| Stalled-ticket fixtures with absent or invalid `updatedAt` reported as stalled or fresh | 0; all are `unknown` activity |
| Machine `data` digest size / human digest size | serialized `data` ≤ 64 KiB (65 536 bytes; envelope total recorded but not separately capped) / ≤ 24 lines and ≤ 4096 bytes |
| Writes, fence acquisitions, state mutations, network writes, child processes during status | 0 / 0 / 0 / 0 / 0 |
| Replay over identical injected inputs producing identical digest and human text | 100% |
| New error-table rows, new configuration keys, new state-schema changes, new secret-read allowlist entries | 0 / 0 / 0 / 0 |
| Default-CI live network calls / opt-in live smoke structural checks | 0 / 100% pass |
| Real-repository sample produces six sections with truthful states, including declared gaps | 6/6 sections; queue `not-delivered`; no false all-clear |

### 4.2 Non-Goals

- **NG-1**: A queue, lane, dispatch, supervision, board, brief, merge, deploy, or closeout engine. Lanes-or-queue is an explicit capability gap until M2-S1; board state is M2-S4; `queue ready` is M0-S7 and is not duplicated here.
- **NG-2**: Provider-engine execution, chain resolution, quota evaluation/fetch, announcements, park writes, provider telemetry, or spawn selection. M0-S13 owns engine telemetry; status only reads declared configuration and verified park state.
- **NG-3**: Any mutation: no state append, fence, park clear, projection rebuild, pm-notes write, PM-context write, or tracker/PR/CI write.
- **NG-4**: New typed configuration keys or a new configuration branch for tracker, VCS, CI, or repository addressing. Addressing is derived from the checkout's `origin` remote; a typed instance-addressing story is deferred.
- **NG-5**: Jira instance binding in the status composition. The tracker collector is provider-agnostic and is exercised against Jira-shaped normalized fixtures, but this repository's status composition binds GitHub. Jira addressing is deferred (OQ-1).
- **NG-6**: Full GitHub adapter, GraphQL review decisions/threads, structured issue-dependency reads, push-parity checks, or open-PR-head CI. Those are M3-S3/M0-S9 or later.
- **NG-7**: LLM summarization, semantic ranking, recommendations, or prose generation. Both the machine digest and the human digest are deterministic.
- **NG-8**: Cross-repository or fleet status, MCP/OpenCode surfaces, agent prompt adoption, or replacing the `queue ready`/`verify` commands.
- **NG-9**: New error-table rows or identities, result-envelope changes, state-schema changes, or a new package/subpath/runtime-API location.
- **NG-10**: Reading pm-notes phase ledgers or duplicating `verify change`. Status is a snapshot digest, not a verification verdict.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `ados status` command surface | The command registry names exactly this command; one first-call entry point. |
| F-2 | Six-section digest with a closed section-state vocabulary | The ticket's six collectors and the "evidence-backed states" AC. |
| F-3 | Tracker collector: owner hand-backs, blocked dependencies, stalls, hygiene | The four ticket-named tracker families from normalized `WorkItem` data. |
| F-4 | Changes and pull requests collector | Active local change plus open pull requests, without overclaiming review signals. |
| F-5 | CI collector | Pipeline runs for the pushed commit under observation; never green on an unresolved or failed read. |
| F-6 | Lanes-or-queue collector as a declared gap | M2-S1 has not delivered a queue/lane engine; an empty queue would lie. |
| F-7 | Providers collector from config and park state | The ticket names the config chain and state-layer parks, explicitly not the provider engine. |
| F-8 | Parked-work collector from local PM context | Non-provider parked delivery work, distinct from provider parks, with truthful absence. |
| F-9 | Evidence and non-verdict degradation rules | The ticket AC "no network call is treated as a verdict". |
| F-10 | Bounded output, deterministic ordering, truncation evidence | Replaces unbounded scripted probing and makes the digest cheap and stable. |
| F-11 | Human digest plus machine JSON | The coordinator needs a short read; agents need the full bounded structure. |
| F-12 | Repository binding from the git remote | Minimal addressing without a speculative configuration branch. |
| F-13 | Bounded GitHub collection reads and trap coverage | The minimal slice cannot enumerate issues/PRs; the extension stays inside the existing read operations. |
| F-14 | Read-only, deterministic, tier/brand-neutral execution | The session-start command must not mutate or leak, and must fit the workspace boundaries. |
| F-15 | Error-identity reuse with no new rows | Section failures are digest data; no new error kind is justified. |
| F-16 | Real-corpus and live-smoke evidence | Proves the six-section AC without making default CI flaky. |

### 5.1 Capability Details

- **F-1 — Command surface.** `status` is a new top-level command composed where `lint`, `phase`, `provider`, and `verify` are composed. Its grammar is exactly the command name with no positionals and no command-specific flags; `--json` is the existing global machine-output switch. An unexpected positional or unknown flag is rejected by the parser before any source read (`fallback.invocation`, exit `1`). The handler performs no stream writes and chooses no exit code; it returns the digest or a classified failure, and the CLI edge renders and projects. The command is read-only.
- **F-2 — Six-section digest.** The section ids and order are fixed: `tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`, `providers`, `parked-work`. Each section carries exactly one state from `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`; a bounded evidence record naming its sources and reasons; section-specific counts; a ranked, capped item list; and an explicit `truncated` marker. Item-level signals may be unknown inside an observed section; that is distinct from the section being unobserved. A success digest always contains all six sections, including sections that are unknown or unavailable.
- **F-3 — Tracker collector.** The collector consumes normalized `WorkItem` values from a tracker source and a declared per-family signal availability. It evaluates only open items (delivery state not `done` or `canceled`).
  - **Owner hand-backs:** an open item carrying a declared owner-attention label (`hand-back` or `human-input-needed`, case-insensitive). Absent `assignee` is not treated as unassigned: `WorkItem.assignee` is optional and absence means the provider did not supply the signal (ADR-0006), not that no assignee exists. Provider-asserted assignee-null representation is a future additive evolution, not part of this change.
  - **Blocked dependencies:** an open item with a `blocked-by` relation. A target observed as `done`/`canceled` does not leave the item blocked; a target observed as not done leaves it blocked with `dependencyState: open`; a target not observed leaves it blocked with `dependencyState: unknown` — never resolved. If the tracker source declares relations unavailable, the family is `unavailable` with `signal-unavailable`, never an observed empty family.
  - **Stalls:** an open item with a parseable `updatedAt` older than the declared 14-day threshold is `stalled` with its age; an item at or under the threshold is active and not listed; an item with absent or invalid `updatedAt` is `unknown` activity and is listed as such. The clock is injected. No timestamp is derived from comments, ordering, or the current time.
  - **Ticket hygiene:** conformance over mapped normalized data only. Findings are `missing-title` (blank/empty title) and `missing-labels` (empty label set). Comment conformance is not evaluated because absent comments mean unknown (ADR-0006); unmapped custom-field conformance is not evaluated because no named consumer requires it. A conforming item has no finding; the family never reports a pass based on an absent signal.
- **F-4 — Changes and pull requests collector.** The collector combines the local active change from the PM context (`workItemRef`, `branch`, `changeFolder`) with the open pull requests read from the VCS source (`sourceRef`, `targetRef`, delivery state/draft). The PM context is git-ignored local state: absent means the active change is unknown, never "none"; malformed means unknown, not empty. If the VCS source declares review state or review threads unavailable (as the minimal GitHub REST slice does), those item-level signals are `unknown` with `signal-unavailable`; they are never defaulted to `open` or zero. A partial source failure yields a degraded section.
- **F-5 — CI collector.** The collector resolves the commit under observation from the current checkout HEAD (branch name when attached, full SHA) through the repository adapter. It reads one bounded check-runs page for that SHA (`per_page=STATUS_SOURCE_PIPELINE_LIMIT`, no pagination) and classifies every run on that page: `failed` if any run failed, `pending` if any run is running/queued and none failed, `canceled` if any run canceled and none worse, `succeeded` if at least one run succeeded and all others are succeeded/skipped, and `none` if the read succeeded but no run was reported or every reported run was skipped (no effective job). `none` is explicitly not green, and an all-skipped set is never `succeeded`. The client reports the raw page size with the runs; a page returned at `STATUS_SOURCE_PIPELINE_LIMIT` is the at-limit input to F-10 and signals possible truncation. An unresolved SHA or a failed read is `unknown` with the reason and failure class; it is never `succeeded`. Only the current checkout HEAD is observed in v1; open-PR-head CI is deferred until a head-SHA signal exists.
- **F-6 — Lanes-or-queue collector.** The section is always `not-delivered` with reason `engine-not-delivered`, source `queue-engine`, zero items and zero counts, and an explicit note that no queue or lane engine exists in this release. It is never `observed` empty, never a fabricated queue, and never a duplicate of `queue ready`. The expected delivering story is M2-S1.
- **F-7 — Providers collector.** The collector reads the declared provider configuration (`provider.defaultChain`, `provider.chains`, `provider.entries`) from the existing resolved configuration snapshot and reads active park views from the verified state layer (`provider.park` records folded by the existing read-only park view). It does not call `provider resolve`, `provider quota`, or any provider engine function; it does not fetch quota; it does not write a park or announcement. An entry with an active provider park is `parked` with cause and expiry; an entry without a park is `unverified`, never `available`, because status did not run the engine. An active chain park marks the chain parked. An absent default chain is `unavailable` with `provider-chain-not-declared`. A park read failure is `degraded` (entries observed, parks unknown) or `unknown` when nothing usable remains, and it never claims "no parks". When several conditions hold at once the state is resolved by the fixed precedence in DM-9: config untrusted → `unknown`, otherwise no declared default chain → `unavailable`, otherwise park-fold failure → `degraded`, otherwise `observed`.
- **F-8 — Parked-work collector.** The source of truth is the local PM context's `parked_changes` array (`.ai/local/pm-context.yaml`), which is git-ignored local coordination state. The collector projects only `workItemRef`, optional `branch`, `changeFolder`, `reason`, and optional `parkedAt`; it never reads free-form `notes`. An absent file is `unavailable` with `local-context-missing` and an explicit git-ignored marker; malformed YAML or a non-array `parked_changes` is `unknown` with `local-context-malformed`; an explicit empty array is `observed` with `observed-empty`; an entry without `workItemRef` is item-level unknown. Age is derived only from a present, parseable `parkedAt`; otherwise age is unknown. Parked work is explicitly not a provider park.
- **F-9 — Evidence and non-verdict degradation.** A section is `observed` only when every required source read for that section succeeded (including verified-empty and provider-asserted empty results). A failed, absent, unattempted, unresolved, credential-denied, config-invalid, or state-unreadable read makes the section `unknown` (no usable evidence) or `degraded` (partial evidence); it never becomes an observed empty section or a clear/green/available/zero claim. Item-level signals are separately wrapped as observed or unknown; an unknown item signal is counted, never defaulted. The formal rule is normative, not prose guidance: the negative-control matrix in AC-F9-1 is exhaustive for the delivered sources.
- **F-10 — Bounds and ordering.** Section order, family order, item ranks, caps, and truncation are declared contracts. Counts report observed, unknown, total, and omitted items. `truncated` is true when output items were dropped or the raw source page returned exactly its declared read limit (`STATUS_SOURCE_ITEM_LIMIT` for the issues/pulls pages, `STATUS_SOURCE_PIPELINE_LIMIT` for the check-runs page; a possible "more" signal); the source-at-limit component is measured on the raw page size before any object filtering, so a full issue page that contained pull-request objects still signals `source-truncated` after filtering. Evidence names `source-truncated` when applicable. Tracker families cap independently at `STATUS_MAX_TRACKER_FAMILY_ITEMS` with no common section list; section `truncated` is true when any family dropped items, and section `counts.omitted` is the sum across families. Non-tracker lists are ordered by the rank keys in §8.3 and tracker items by the Appendix D keys. The digest never depends on API return order or object-map iteration order.
- **F-11 — Human and machine output.** `--json` emits exactly one standard `CommandResult` envelope whose `data` is the full bounded `delivery.status.v1` digest. Human mode emits a deterministic digest rendered from the same data: an optional header and exactly one line per section in fixed order, with the section state and bounded counts, at most 24 lines and 4096 bytes. The human renderer is pure and performs no extra reads. Neither mode uses an LLM.
- **F-12 — Repository binding and credential posture.** The runtime edge resolves the checkout's `origin` remote through the repository adapter (read-only, no child process), parses GitHub HTTPS/SSH forms, and binds `owner`, `name`, and `host: github.com`. Userinfo and credentials are discarded and never enter evidence. No `origin`, an unparseable remote, or a non-GitHub host yields an unavailable binding; the tracker, changes/PR, and CI sections then report unavailable/unknown with `addressing-unresolved`/`remote-unsupported`. No new configuration key and no alternate remote are invented. The composition admits only a GitHub `ExternalSystemInstance` whose `authMethod.mechanism` is `"credential-reference"`; an injected instance with any other mechanism (including `"anonymous"`) is refused at composition before any read. The refusal withholds only the GitHub reads — the local PM context is unaffected — so the per-section outcome is pinned: `tracker` is `unknown` (no usable tracker evidence) and `ci` is `unknown` (a commit may still resolve, but there is no usable pipeline evidence), while `changes-and-prs` is `degraded` when the local active change is observed, because that evidence remains and only the PR evidence is missing; `changes-and-prs` is `unknown`/`unavailable` only when the active-change source is itself absent or unusable. Refused reads carry `credential-unavailable`, and a degraded section carries `partial-evidence`. No affected section is ever `observed` under the guard. The credential-reference restored control returns the normal states of Appendix A: `tracker` `degraded` on the GitHub slice because blocked-dependency relations are unavailable (`observed` only when the bound source declares all four family signals), `ci` `observed`, and `changes-and-prs` `observed` when the bound source declares the review signals available, otherwise `degraded` (the GitHub slice declares review state/threads unavailable, so `degraded`). This composition-level guard, not any client tolerance of an anonymous instance, is what makes the credential-less/anonymous control satisfiable.
- **F-13 — GitHub collection reads.** The GitHub subpath gains two bounded collection reads under the existing read operations: open work items (issues, with pull-request objects filtered out) and open delivery requests (pull requests). Both accept a limit, request one bounded page, and return normalized views only. The closed adapter-operation set and the capability declaration are unchanged: collection reads are the query-shaped form of `read-work-item` / `read-delivery-request`, following the Jira `searchWorkItems` precedent. The change extends the GitHub trap catalog with entries for mixed issue/PR list payloads, the page limit, absent issue relations, and PR list state/review defaults, each with a matching assertion. Credentials resolve only through `CredentialPort`.
- **F-14 — Read-only, deterministic, tier/brand-neutral.** Status performs zero writes, fences, state mutations, network writes, and child processes. The pure aggregator and renderer have no I/O, clock, randomness, or ambient environment; the clock and all reads are injected. Runtime I/O stays in the already-admitted adapter subpaths (`github`, `repo`, `file`) and the CLI edge. No new package, subpath, runtime-API location, or secret-read allowlist entry is introduced. The human header uses the injected brand binary name; no product literal is committed.
- **F-15 — Error identity reuse.** No error-table row or domain kind is added. Section evidence carries an existing `config.*` or `state.*` code when a classified failure occurred, and an adapter-local failure class (for example `provider.payload.invalid`) when the adapter rejected a payload. Those classes are evidence, not error-table identities: an error-table code such as `provider.chain.invalid` is never used as a `failureClass`. Pinned mapping: a provider chain/config validation failure carries `failureCode: "config.value.invalid"` with reason `provider-chain-unresolved` and no `failureClass`; a configuration resolution failure carries reason `config-invalid` with the relevant existing `config.*` code. The status command itself can fail only through `fallback.invocation` (parser) or `fallback.internal` (containment), both existing. The documented-table sync is unaffected.
- **F-16 — Real-corpus and live evidence.** The default suite uses a committed fixture corpus for every section, state edge, cap, ordering rule, and negative control, with zero live network calls. An opt-in live smoke test runs against this repository when explicitly enabled by a test-only switch under `tests/**` together with a credential; it asserts only structural invariants (six sections, evidence present, bounds, no secrets, queue not-delivered, no provider `available`) and never pins volatile item counts. No product literal is committed for the switch: the harness and its literal live only in the test tree, and if a production edge ever exposes the switch it is derived from the injected `brand.environmentPrefix`, never a hardcoded product prefix. A bounded, secret-free live evidence artifact may be attached to the PR; it is not a default-CI gate.

## 6. USER & SYSTEM FLOWS

1. **Session bootstrap flow.** The coordinator runs `ados status` (human) or `ados status --json` (agent). The CLI edge resolves the brand and configuration, resolves the repository binding from `origin`, constructs the read sources (GitHub issues/PRs/check-runs, state park fold, provider config, local PM context), and injects them into the pure aggregator. The aggregator evaluates the six collectors, applies the state derivation rules, ranks and caps items, and returns one digest. Human mode renders the digest; machine mode wraps it in the envelope.
2. **Partial-source flow.** The issues read succeeds, the PR read fails, and the PM context is observed. The tracker section is evaluated from the issues; the changes/PRs section is `degraded` (active change observed, PRs unknown); CI is independent. The digest still contains all six sections, and the human line names the degraded source. The command exits `0`; the degradation is data, not a command failure.
3. **Credential/absence flow.** The repository binding resolves, but `GITHUB_TOKEN` is not resolvable through the credential port (or the injected instance is not a `credential-reference` instance and is refused at composition before any read). The tracker and CI sections are `unknown` with `credential-unavailable` and `config.credential.missing`; the changes/PRs section is `degraded`, because the local active change remains observed and only the PR evidence is missing (`partial-evidence`), and it is `unknown`/`unavailable` only when the active-change source is itself absent or unusable. No affected section is ever `observed`. The lanes section is `not-delivered`; providers are evaluated from local config/state; parked work is evaluated from local PM context. No section becomes an observed empty section.
4. **Provider park flow.** The provider config declares a chain and entries; the state fold reports an active `provider:<name>` park. The providers section lists the park with cause and expiry, marks that entry `parked`, and marks other entries `unverified`. The chain is not reported available, and no quota fetch occurs.
5. **Queue-gap flow.** Every status run reports the lanes-or-queue section as `not-delivered` with `engine-not-delivered`; the digest never shows an empty queue and never points the coordinator at a nonexistent engine.
6. **Parked-work absence flow.** In a clean checkout or CI, `.ai/local/pm-context.yaml` is absent. The parked-work section is `unavailable` with `local-context-missing` and a git-ignored marker, not "0 parked changes". In a PM session with an explicit empty `parked_changes`, the section is `observed` with `observed-empty`.
7. **Live-repository flow.** In an opt-in live smoke with a credential, status runs against this repository, returns six sections, and demonstrates the declared gaps: the queue section is `not-delivered`, providers are `unavailable` when no default chain is declared, tracker is `degraded` when blocked-dependency relations are unavailable, and changes/PRs are `degraded` when review state is unavailable. The structural assertions pass; volatile counts are not pinned.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `status` command definition, grammar, runtime composition, and human/machine rendering.
- The `delivery.status.v1` contract vocabulary: six section ids, five section states, evidence reasons, source ids, item shapes, counts, truncation, bounds, and the human digest grammar.
- The pure status aggregator and ranking/capping logic in the runtime-neutral core domain tier.
- The tracker collector and its four families over normalized `WorkItem` data, including per-family signal availability.
- The changes/PRs collector (active PM change plus open pull requests).
- The CI collector (current checkout HEAD plus pipeline runs per SHA).
- The lanes-or-queue declared-gap section.
- The providers collector (declared config plus verified read-only park views; no engine execution).
- The parked-work collector (git-ignored PM context; truthful absence/malformed/empty semantics).
- The repository binding read from `origin`, with no new configuration keys.
- The bounded GitHub collection reads (`listWorkItems`, `listDeliveryRequests`), the extended GitHub trap catalog and fixtures, and the unchanged capability declaration.
- A bounded local PM-context reader that projects only active/parked fields.
- Tests at structure, behaviour, boundary, checks, and golden levels, plus an opt-in live smoke.
- A minor changeset and the new current-truth feature spec; phase 7 reconciles the surrounding docs.

### 7.2 Out of Scope

- [OUT] Any queue, lane, dispatch, supervision, board, brief, merge, deploy, or closeout engine or command; `queue ready` (M0-S7) is not implemented or duplicated here.
- [OUT] Provider-engine execution, chain resolution, quota evaluation or fetch, announcements, park writes/clears, provider telemetry, spawn selection, or model selection.
- [OUT] Writes, fences, state mutations, park clears, projection rebuilds, pm-notes writes, PM-context writes, or tracker/PR/CI writes.
- [OUT] New typed configuration keys or a new config branch for tracker, VCS, CI, repository addressing, or status caps/thresholds.
- [OUT] Jira instance addressing/binding in the status composition; the collector is provider-agnostic and tested against Jira-shaped fixtures only.
- [OUT] Full GitHub adapter, GraphQL review decisions/threads, structured issue-dependency reads, push parity, open-PR-head CI, or merge-gate evaluation.
- [OUT] LLM summarization, semantic ranking, recommendations, prose generation, or agent prompt adoption.
- [OUT] Cross-repository/fleet status, MCP/OpenCode surfaces, and shared board state.
- [OUT] New error-table rows/identities, result-envelope changes, state-schema changes, new packages/subpaths, or new runtime-API locations.
- [OUT] Reading pm-notes phase ledgers or duplicating `verify change`.

### 7.3 Deferred / Maybe-Later

- Typed tracker/VCS/CI instance configuration and Jira binding in the status composition (OQ-1).
- GitHub structured issue-dependency and issue-link reads so blocked dependencies become available on GitHub (OQ-5).
- GitHub GraphQL review-decision and review-thread reads so changes/PRs can report review state and unresolved threads (OQ-3).
- Open-PR-head CI and push parity, likely with M0-S9's head-commit signal (OQ-3).
- Active-change phase-ledger summary from the registry/verify surface (M1-S10 collector expansion).
- Provider engine telemetry enrichment of the providers section (M0-S13).
- Queue/lane engine integration (M2-S1) and shared board state (M2-S4).
- Configurable caps, stall threshold, and owner-attention label set once a named consumer needs them.
- Anonymous GitHub reads or alternate remote selection if the operational model requires them (OQ-2).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. `ados status` is an in-process CLI command; it starts no listener and exposes no HTTP endpoint. It performs only outbound read-only GitHub REST requests through the delivered GitHub client (Section 8.4).

### 8.2 Events / Messages

None. The digest and its evidence are invocation-scoped result data; status emits no event, message, announcement, or telemetry record and writes no state record. Provider announcements remain the provider engine's concern.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | `StatusDigest` | `schemaVersion: "delivery.status.v1"`, `generatedAt` (injected clock, ISO-8601 UTC), `repository` (DM-11), `summary` counts, and exactly six `sections` (DM-2) in fixed order. `actionable` is the sum of the rendered `items` arrays of every section whose state is `observed` or `degraded`: tracker family items counted individually (each family list as rendered), plus rendered pull-request items, CI runs, provider entries, provider parks, and parked-work items. Sections in `unknown`, `unavailable`, or `not-delivered` state contribute zero; `actionable` is never a total or an estimate. |
| DM-2 | `StatusSection` | `id` from the six-value set, `title`, one `state` from the five-value set, `evidence` (DM-4), uniform `counts` (`observed`, `unknown`, `total`, `omitted`), section-specific fields, the ranked item list(s), and `truncated`. Non-tracker sections carry their ranked list under the section-specific field (`pullRequests`, `runs`, `entries`/`parks`, `items`); the tracker section carries only per-family lists (DM-5) and has no common `items` list. |
| DM-3 | Section states | `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`. `observed` requires every required source read to succeed; item-level unknown signals do not by themselves change the section state. `degraded` is partial evidence; `unknown` is no usable evidence; `unavailable` is a known-absent source; `not-delivered` is a missing capability. |
| DM-4 | Evidence model | Up to six source entries `{ source, outcome, failureCode?, failureClass? }` and up to six unique reasons from the closed reason set; no raw provider payload, response body, credential, or arbitrary message. `failureCode` is an existing `config.*`/`state.*` code only; `failureClass` is an adapter-local class such as `provider.payload.invalid` and is never an error-table identity. Pinned mapping: a provider chain/config validation failure carries `failureCode: "config.value.invalid"` with reason `provider-chain-unresolved` and no `failureClass`; a configuration resolution failure carries reason `config-invalid` with the relevant existing `config.*` code. A `provider.*` table code such as `provider.chain.invalid` is never used as a `failureClass` or `failureCode`. Source ids are `tracker`, `changes`, `ci`, `queue-engine`, `provider-config`, `provider-parks`, `local-context`, `repository-binding`; outcomes are `read`, `observed-empty`, `failed`, `not-configured`, `not-delivered`. |
| DM-5 | Tracker section | `families` in fixed order: `ownerHandBacks`, `blockedDependencies`, `stalls`, `hygiene`. Each family has `state` (`observed` or `unavailable`), `reason?`, up to `STATUS_MAX_TRACKER_FAMILY_ITEMS` (4) ranked items, and its own counts. The tracker section has no common `items` list: the four family lists are its only item surface, and the section-level `STATUS_MAX_ITEMS_PER_SECTION` pool does not apply to it, so a tracker section may render up to four families × 4 items. The section's `counts` aggregate the families (an item appearing in two families is counted in each family and in the section sum), section `counts.omitted` is the sum of the families' omitted items, and section `truncated` is true when any family dropped items (or when the source-at-limit signal applies, F-10). Tracker items carry `workItemRef`, capped `title`, family, item state, family-specific signals, and bounded evidence. |
| DM-6 | Changes and PRs section | `activeChange` (`observed` with `workItemRef`/`branch`/`changeFolder`, `observed-empty`, or `unknown` with reason) and `pullRequests` (capped, ranked items with `entityId`, `sourceRef`, `targetRef`, delivery state/draft, and observed-or-unknown review-state/thread signals). |
| DM-7 | CI section | `commit` (`branch`, `sha` when resolved), `result` (`failed`, `pending`, `succeeded`, `canceled`, `none`, `unknown`), and capped `runs` with pipeline name, identity, normalized job states, and trace evidence references. |
| DM-8 | Lanes-or-queue section | Always `state: not-delivered`, `capability: "queue-lane-engine"`, `expectedStory: "M2-S1"`, reason `engine-not-delivered`, zero items/counts, and a note that no queue/lane engine exists in this release. |
| DM-9 | Providers section | `chain` (`declared` with name/entries, `absent`, `parked`, or `unknown`), capped `entries` with class/enabled/peak/quota-declared/availability (`parked` or `unverified`, never `available`), and capped active `parks` from the verified fold with cause/conditions/expiry. Section state precedence is fixed and evaluated in this order: config read failed, config invalid, or a declared chain that does not resolve to declared entries → `unknown`; no declared default chain → `unavailable`; park-fold failure with config observed → `degraded`; otherwise `observed`. The unresolved-chain case carries the DM-4 identity: reason `provider-chain-unresolved`, `failureCode: "config.value.invalid"`, and no `failureClass`; a failed/invalid config read carries reason `config-invalid` and the relevant existing `config.*` code. |
| DM-10 | Parked-work section | `source` `{ kind: "local-pm-context", path, tracked: false }`, and capped `items` with `workItemRef`, optional branch/changeFolder/reason, optional `parkedAt`, optional `ageDays`, and item state (`observed` or `unknown`). No free-form notes. |
| DM-11 | Repository binding | `observed` `{ host: "github.com", owner, name, remoteName: "origin" }` or `unavailable` `{ reason: "addressing-unresolved" or "remote-unsupported" }`. No userinfo, credential, or raw remote URL in the digest. |
| DM-12 | Bounds and ordering | The fixed section/family order, per-list item caps, per-source read limits, deterministic rank keys (tracker keys in Appendix D, non-tracker keys in the rank-key table below), and truncation rules in Appendix C. Tracker families cap independently at 4 with no common section list; section `truncated` is true when any family dropped items, and section `counts.omitted` is the sum across families. `STATUS_MAX_ITEMS_PER_SECTION` applies to each non-tracker ranked list. The source-at-limit signal is measured on the raw page size returned by the source, before any object filtering (a full issue page that contained pull-request objects still signals `source-truncated` after filtering). Counts and `truncated` are part of the contract, not a renderer detail. |
| DM-13 | Human digest | The deterministic grammar in Appendix E: optional header plus exactly one line per section, bounded to 24 lines and 4096 bytes, derived only from the digest. |
| DM-14 | Source availability | A per-source/family declaration of which normalized signals the bound adapter supplies: tracker owner-handbacks/stalls/hygiene/blocked-dependencies; VCS pull-request state/refs/review-state/review-threads; CI pipeline runs. Unavailable signals produce family/item `unknown` or `unavailable`, never empty or zero. |
| DM-15 | Status schema version | `STATUS_SCHEMA_VERSION = "delivery.status.v1"`, additive within v1; a breaking section-shape change bumps it. |

**Section state derivation matrix.**

| Section | `observed` | `degraded` | `unknown` | `unavailable` | `not-delivered` |
|---|---|---|---|---|---|
| tracker | tracker list read succeeded and all four family signals are available (item-level unknowns allowed) | list read succeeded but at least one family signal is unavailable | tracker list read failed, credential unavailable, or no usable tracker evidence | no repository binding or no tracker source | never |
| changes-and-prs | PR list read succeeded and active change observed/observed-empty, with all required signals available | one of PR list or active change failed/unavailable, or a declared PR signal is unavailable | both sources failed with no usable evidence | no repository binding and active-change source absent | never |
| ci | commit resolved and pipeline read succeeded (including no reported runs) | never (single required read) | commit unresolved or pipeline read failed | no repository binding | never |
| lanes-or-queue | never | never | never | never | always |
| providers | provider config read succeeded, a default chain is declared, and park fold succeeded | config/entries observed but park fold failed | config read failed, config invalid, or the declared chain does not resolve to declared entries (`provider-chain-unresolved`) | no declared default chain | never |
| parked-work | PM context read succeeded and `parked_changes` is an array (including empty) | never (single required read) | PM context malformed or wrong shape | PM context absent | never |

**Providers precedence (normative).** The providers row is evaluated in the fixed order `unknown` → `unavailable` → `degraded` → `observed`: a failed/invalid config read or a declared chain that does not resolve yields `unknown` even when no default chain is declared; otherwise an absent default chain yields `unavailable` even when the park fold also failed; otherwise a park-fold failure yields `degraded`; otherwise the section is `observed`.

**Closed evidence reason set.** `observed`, `observed-empty`, `read-failed`, `source-unavailable`, `signal-unavailable`, `addressing-unresolved`, `remote-unsupported`, `credential-unavailable`, `config-invalid`, `state-unreadable`, `commit-unresolved`, `provider-chain-not-declared`, `provider-chain-unresolved`, `local-context-missing`, `local-context-malformed`, `local-state-untracked`, `engine-not-delivered`, `source-truncated`, `item-signal-absent`, `partial-evidence`. Reasons are unique per section, ordered by first occurrence in the fixed source/family order, and capped at six; the renderer never invents a reason.

**Normative non-verdict rule (F-9).** A section may be `observed` only when every required read for that section succeeded. A failed, absent, unattempted, unresolved, credential-denied, config-invalid, or state-unreadable read yields `unknown` or `degraded`; it never yields `observed` with zero items and never implies clear, green, available, or "nothing to do". A provider entry without park evidence is `unverified`, never `available`. CI with no reported pipeline is `none`, never `succeeded`. The lanes section is `not-delivered`, never an empty queue. An item signal that is absent (for example `updatedAt`) is `unknown`, never a fabricated value.

**Deterministic rank keys for non-tracker lists (DM-12).** Every ranked list is ordered by declared keys derived from item data only; the source's return order, object-map iteration order, and stable-sort side effects never influence the order. All lexicographic comparisons are ascending Unicode code-point comparisons on the normalized string value.

| List | Cap | Primary key | Tie-breakers (in order) |
|---|---|---|---|
| `pullRequests` | `STATUS_MAX_OPEN_PULL_REQUESTS` (8) | non-draft before draft | pull-request number ascending when the normalized identity carries one, otherwise lexical `entityId` ascending; then `sourceRef`; then `targetRef` |
| `runs` | `STATUS_MAX_PIPELINE_RUNS` (8) | severity rank: `failed`, `pending`/`running`, `canceled`, `succeeded`, `skipped` (most severe rendered first) | run identity descending (numeric-aware when both identities are numeric, otherwise lexical ascending); then pipeline name ascending |
| `entries` | `STATUS_MAX_PROVIDER_ENTRIES` (8) | availability rank: `parked` before `unverified` | `enabled` true before false; then entry name ascending; then provider class ascending |
| `parks` | `STATUS_MAX_PROVIDER_PARKS` (8) | soonest `expiresAt` ascending, parks without an expiry last | scope rank `chain` before `provider`; then park name ascending |
| `items` (parked work) | `STATUS_MAX_PARKED_CHANGES` (8) | oldest parseable `parkedAt` ascending, absent/invalid `parkedAt` last | `workItemRef` ascending (numeric-aware when both match `<PREFIX>-<number>`); entries without `workItemRef` last, ordered by `changeFolder`, then `branch`, then `reason` |

Tracker family ranks are the Appendix D keys and are not restated here. A list whose cap drops items records the drop in `counts.omitted`; ordering is applied before capping, so the retained items are the first N of the fully ranked list.

**Source-at-limit signal (F-10, DM-12).** `source-truncated` and the at-limit component of `truncated` are derived from the raw page size returned by the source, compared against the source's declared read limit, before any object filtering or normalization filtering. The declared limit is `STATUS_SOURCE_ITEM_LIMIT` for the issues and pull-request list reads and `STATUS_SOURCE_PIPELINE_LIMIT` for the check-runs read. A raw issues page of exactly `STATUS_SOURCE_ITEM_LIMIT` entries that contains pull-request objects still signals `source-truncated` even though fewer `WorkItem` values remain after filtering; a raw check-runs page of exactly `STATUS_SOURCE_PIPELINE_LIMIT` runs signals `source-truncated`; a raw page below its declared limit never signals it.

### 8.4 External Integrations

**GitHub REST API (read-only).** The status composition binds the repository derived from `origin` and uses the delivered GitHub client for:

| Read | Purpose | Bound |
|---|---|---|
| Open issues for the repository | Tracker families and work-item hygiene | One bounded page, limit declared by `STATUS_SOURCE_ITEM_LIMIT`; pull-request objects filtered out |
| Open pull requests for the repository | Changes and PRs | One bounded page, same limit |
| Check runs for the current checkout SHA | CI | One bounded page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), no pagination; the client returns the raw page size and status derives the at-limit signal from it; status caps the rendered runs |

The three reads are single bounded pages: the two list reads send `per_page=STATUS_SOURCE_ITEM_LIMIT`, and the check-runs read sends `per_page=STATUS_SOURCE_PIPELINE_LIMIT`. Each read reports the raw number of entries in the returned page alongside the normalized values; status compares that raw size with the same declared limit to derive `source-truncated`, and it paginates no read. A check-runs page of exactly `STATUS_SOURCE_PIPELINE_LIMIT` runs therefore signals possible truncation even when status renders fewer runs.

No GitHub write, comment, label, merge, or transition request is made. The client resolves `GITHUB_TOKEN` only through the injected `CredentialPort`; status code never reads the environment. A missing or rejected credential is a read failure reflected in the section, not a command failure. Jira and GitLab read slices are delivered but are not bound by this repository's status composition; the tracker collector is tested against Jira-shaped normalized fixtures. The provider quota endpoint is never called.

**Local integration surfaces.** The existing configuration resolver supplies the provider branch; the existing state layer supplies verified provider park views; the repository adapter supplies the `origin` binding and current HEAD; the file adapter supplies the bounded YAML read of `.ai/local/pm-context.yaml`. None of these is mutated.

### 8.5 Backward Compatibility

- **Additive command:** `status` is new; no existing command's grammar, output, or exit behavior changes.
- **Additive contracts:** `core ./contracts` gains the status vocabulary and `core` gains the pure status exports. No existing type is reshaped and no existing subpath is changed.
- **Additive GitHub surface:** `GithubClient` gains `listWorkItems` and `listDeliveryRequests`; the existing `readPipelineRun` gains an optional declared page limit — when omitted, the client applies `STATUS_SOURCE_PIPELINE_LIMIT` and sends it as `per_page` — and reports the raw page size together with the runs. The five exported names of the GitHub subpath are unchanged. The closed adapter-operation set and `GITHUB_ADAPTER_CONTRACT.supportedOperations` are unchanged; collection reads are the query-shaped form of the existing read operations. The provider client seed feature doc and the GitHub trap catalog are reconciled in the same change/phase 7.
- **Additive CLI hook:** the command-definition contract gains one optional pure human-text renderer used only by `status`; existing command definitions are unaffected.
- **No new error rows:** the machine and documented error tables are unchanged; section failures are digest data, and the sync check stays green.
- **No config/state compatibility surface:** no new configuration keys, no state-schema change, no store-format change, and no on-disk migration.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Section totality: exactly six sections in fixed order; one state from the five-value set per section; evidence, counts, items, and truncation present on every section | 6/6 sections, 5/5 valid states, 100% evidence presence; 0 missing or extra sections |
| NFR-2 | Output bounds: serialized `data` digest size; envelope total; human digest size; cap enforcement; truncation evidence | ≤ 64 KiB (65 536 bytes) on the serialized `data` digest; envelope total recorded but not separately capped; ≤ 24 lines and ≤ 4096 bytes human; 100% caps enforced; 100% dropped/limit-truncated cases marked |
| NFR-3 | Non-verdict guarantee: failed/absent/unattempted/unresolved reads rendered as observed, clear, green, available, or zero; active park reported available; no-run CI reported succeeded; queue reported as an observed empty queue | 0 / 0 / 0 / 0 across the exhaustive negative-control matrix |
| NFR-4 | Read-only and determinism: writes; fence acquisitions; state mutations; network writes; child processes; digest or human-text drift on identical injected inputs | 0 / 0 / 0 / 0 / 0 / 0 drift |
| NFR-5 | Output contract: `--json` runs producing exactly one valid envelope; human runs producing exactly six section lines plus an optional header; extra reads during rendering | 100% / 100% / 0 |
| NFR-6 | Real-corpus and live evidence: fixture corpus sections produced as expected; default-CI live network calls; opt-in live structural checks | 100% expected / 0 live calls / 100% pass, no volatile count pinned |
| NFR-7 | Boundaries and branding: runtime APIs in contracts/domain; new runtime-API locations; new secret-read allowlist entries; product literals; boundary/ambient/literal gates | 0 / 0 / 0 / 0 — all gates green |
| NFR-8 | Error-table stability: new rows/domain kinds; documented-table drift; existing row changes | 0 / 0 / 0 — sync check and existing classification tests green |
| NFR-9 | Performance and read cost: pure aggregation over cap-sized inputs; network reads per invocation; state reads; config resolves; retries/loops | ≤ 50 ms on the reference environment; ≤ 3 network reads (issues page, PR page, check-runs) and ≤ 1 logical park-fold read (exactly one `readProviderParkViews` invocation; the existing fold's documented internal verified reads are not multiplied by status) and ≤ 1 config resolve; 0 retries/loops |
| NFR-10 | Privacy: secrets or raw provider payloads in digest/evidence/human text; ambient environment reads outside the allowlist; planted-secret canary escapes | 0 / 0 / 0 |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No product telemetry, metric exporter, trace span, or event sink is added. The observability surface is the digest itself: the standard envelope's `runId` and `timing`, the per-section evidence (sources, reasons, failure codes/classes), the explicit truncation markers, and the deterministic human digest. The opt-in live smoke may write a bounded, secret-free evidence artifact for the PR; it is not a runtime telemetry channel. Provider announcements and provider-engine telemetry remain owned by the provider engine (M0-S13) and are not duplicated here.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A consumer reads `degraded`, `unknown`, `unavailable`, or `not-delivered` as "nothing to do" | H | M | The five-state vocabulary is explicit in machine and human output; the human line always prints the state; the AC-F9-1 negative-control matrix is exhaustive and non-vacuous. | L–M |
| RSK-2 | An active provider park is reported as available capacity | H | L | Entries without park evidence are `unverified`, never `available`; an active park is `parked` with cause/expiry; status never calls the provider engine. | L |
| RSK-3 | The lanes-or-queue section is mistaken for an empty queue | H | M | The section is always `not-delivered` with `engine-not-delivered` and zero items; no queue read exists; the human line says the engine is absent. | L |
| RSK-4 | Absent `updatedAt` is fabricated into stale/fresh, or absent `assignee`/`comments` becomes a false signal | H | M | Stalls report `unknown` activity when `updatedAt` is absent/invalid; owner hand-backs use labels only (absence = unknown per ADR-0006); hygiene never uses comments; fixtures include absent-signal negative controls. | L |
| RSK-5 | A network failure, missing credential, or unresolved commit is rendered as green/clear | H | M | Read failures produce `unknown`/`degraded`; CI `none` is not `succeeded`; the credential path is explicit; AC-F9-1 controls each failure class. | L |
| RSK-6 | The GitHub list extension overclaims capability, duplicates PRs in the issue list, or silently truncates | M | M | The list read filters PR objects, requests one bounded page, marks limit truncation, and adds trap entries plus assertions for mixed lists, page limits, absent relations, and PR review defaults. | L–M |
| RSK-7 | Repository addressing from `origin` fails in worktrees, non-git directories, or non-GitHub hosts | M | M | The repository adapter reads bounded git metadata without spawning; absent/unparseable/non-GitHub remotes yield an explicit unavailable binding; tests cover HTTPS, SSH, no-origin, and non-GitHub forms. | L |
| RSK-8 | The git-ignored PM context is absent in CI and creates noise or a false "no parked work" | L | M | The section is `unavailable` with `local-context-missing` and a git-ignored marker, never an observed empty section; an explicit empty array is the only observed-empty case. | L |
| RSK-9 | The digest grows unbounded and defeats the token-cost goal | M | M | Exact section/family/source caps, byte limits, truncation evidence, and a pure bounded renderer; cap-sized fixtures assert the limits. | L |
| RSK-10 | Credential or provider payload material leaks into evidence or human text | H | L | Credentials resolve only through the credential port; evidence carries codes/classes/counts only; no raw payloads; the serialization redaction chokepoint and canary tests apply. | L |
| RSK-11 | New status docs drift from the delivered behavior or the GH-188 seed surface | M | M | The new feature doc lands in-change; the GitHub surface/trap catalog and the provider-seed doc are reconciled in the same change/phase 7; the forbidden-literal/privacy checks cover the new doc. | L |
| RSK-12 | Scope creep into the queue engine, provider engine, GraphQL reads, or full GitHub adapter | M | M | Non-goals and deferred items are explicit; the queue section is a declared gap; the provider engine is not called; the GitHub extension is limited to two collection reads. | L–M |

## 12. ASSUMPTIONS

- The repository is a git checkout with an `origin` remote pointing at a GitHub repository. If not, the tracker, changes/PR, and CI sections are truthfully unavailable/unknown; status still returns six sections.
- A `GITHUB_TOKEN` credential is resolvable through the injected `CredentialPort` for live reads. If absent or rejected, `tracker` and `ci` are `unknown` and `changes-and-prs` is `degraded` while the local active change is observed; no anonymous fallback is attempted.
- The GitHub REST list endpoints return the declared fields (state, labels, assignee, updated_at for issues; state/draft/head/base for pull requests) and check runs for a SHA. The minimal slice does not supply structured issue links, review decisions, or review threads.
- `.ai/local/pm-context.yaml` is the canonical local PM coordination file and is git-ignored. Its absence in a clean checkout/CI is normal and must not become "no parked work".
- The provider configuration branch exists and resolves; `provider.defaultChain` is absent and `provider.chains` is empty in the shipped defaults.
- The state layer's verified park view is the park evidence; the derived `provider-parks.json` projection is not read as truth, consistent with the state layer's fold-first discipline.
- The queue/lane engine does not exist until M2-S1; the provider engine is not executed by status.
- The current checkout HEAD is the commit under CI observation; open-PR-head CI is deferred.
- Default CI has no live network or live credential; the live smoke is opt-in and structural.
- The status composition is wired where the existing command program is composed; tests inject the runtime composition directly.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-174 state layer | Verified reads, torn-state classification, provider park record kinds and the read-only park view fold. Status never writes or repairs the store. |
| Depends on | GH-188 provider client seeds | The GitHub read slice and trap-catalog mechanism; the Jira/GitLab read slices and normalized `WorkItem`/`DeliveryRequest`/`PipelineRun` shapes. Status extends the GitHub surface with two bounded collection reads, gives the existing check-runs read a declared page limit, and extends the trap catalog. |
| Depends on | GH-181 adapter ports and credential port | `WorkItem`, `DeliveryRequest`, `PipelineRun`, `ExternalSystemInstance`, and `CredentialPort`. All GitHub credentials flow through the port. |
| Depends on | GH-173 configuration layer | The resolved provider branch and the typed `provider.defaultChain`/`chains`/`entries` shape. Status adds no config keys. |
| Depends on | GH-172 result contract and error table | The `CommandResult` envelope, existing failure identities, exact-code classification, `{0,1,2}` projection, and the sole redaction path. Status adds no rows. |
| Depends on | GH-179 pm-notes/registry conventions | Change-folder naming and the local PM context's change references; status does not read phase ledgers. |
| Informed by | GH-177 verify change | Shared read-only/evidence discipline and the "no false success" precedent; status does not call verify. |
| Informed by | ADR-0004, ADR-0006 | Stalls read `updatedAt` with absence = unknown; comments absence = unknown; hygiene conformance over mapped normalized data only. |
| Informed by | ADR-0003 | Package tiers and runtime-API confinement; status adds no new location. |
| Blocks | M0-S7 `queue ready` | Provider availability is read from the declared chain and park states, as established here. |
| Blocks | M1-S10 collector expansion | The status contract and evidence model are the base for adding collectors. |
| Blocks | M2-S4 shared board state | The per-repo digest shape is the precursor to fleet/board views. |
| External | GitHub REST API | Read-only issues, pull requests, and check runs; credentials through the credential port. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should status gain typed tracker/VCS/CI instance configuration (and a Jira binding), or continue deriving the repository from `origin`? | The ticket precedes status with the Jira read slice, but the config catalog has no instance branch. M0-S6 binds GitHub on this repository; the collector is provider-agnostic. | Non-blocking for M0-S6. Decision needed before a Jira-backed repository uses status: consult `@decision-advisor` if the instance-addressing model becomes system-wide. |
| OQ-2 | Should public GitHub reads fall back to anonymous auth when no credential is configured? | Anonymous reads work for public repositories but have low rate limits and can mask a missing-credential configuration. This spec chooses credential-required, fail-loud reads. | Non-blocking. Revisit if the operational model needs tokenless public reads. |
| OQ-3 | Should CI observe open-PR heads, review decisions, and review threads? | The minimal GitHub REST list lacks a head SHA and review decision; GraphQL and per-PR reads are deferred. Status observes the current checkout HEAD only and reports review signals unknown. | Non-blocking; likely M0-S9/M3-S3. |
| OQ-4 | Is 14 days the right stall threshold, and is the owner-attention label set (`hand-back`, `human-input-needed`) complete? | The ticket does not pin either. The spec declares both as constants/data so a later named consumer can tune them without a contract change. | Non-blocking; no user input required for M0-S6. |
| OQ-5 | Should GitHub blocked dependencies become available through structured issue-dependency reads? | The minimal GitHub REST slice does not supply structured links, so the family is declared unavailable on GitHub rather than empty. | Non-blocking; a later GitHub read extension can make it available. |
| OQ-6 | Should parked changes carry a `parkedAt` field for age? | The PM context example has no `parkedAt`; age is unknown unless the field is present. Status never fabricates age. | Non-blocking; the PM context can add the optional field later. |
| OQ-7 | Does any other command need the optional human-text renderer? | Status is the first command with a non-JSON human digest; the hook is additive and unused elsewhere. | Non-blocking; future commands can opt in. |

**Test-plan clarifications folded into v1.1.** The test plan's recorded gaps GAP-2, GAP-3, GAP-4, GAP-5, GAP-6, GAP-7, and GAP-9 (with OQ-T1..OQ-T7) are now canonical rules rather than open questions: per-family tracker caps with no common tracker list (DM-5, DM-12, Appendix C), enumerated non-tracker rank keys and tie-breakers (§8.3, DM-12), providers state precedence (DM-9, Appendix A, §8.3), the exact `summary.actionable` definition (DM-1), the test-only live-smoke switch with brand-derived environment prefixing (F-16, Appendix G, AC-F16-1), the `data`-only 64 KiB bound (AC-F11-1, NFR-2, Appendix C), and the raw-page source-at-limit signal (F-10, DM-12, Appendix F, AC-F10-1). No scope, AC identity, section set, state vocabulary, error-table posture, or pinned behavior changes; the test plan remains authoritative for test execution at its current revision (v1.4), and this v1.5 revision does not modify it.

## 15. DECISION LOG

| ID | Decision | Rationale | Rejected alternatives |
|----|----------|-----------|-----------------------|
| DEC-1 | The surface is exactly `ados status`, with no positionals and no command-specific flags; `--json` is the existing global switch. | Matches the command registry and the `lint`/`phase`/`verify` surface precedent; no speculative filters or limits. | Section filters, `--limit`, `--since`, or a `status collect` subcommand. |
| DEC-2 | Six fixed sections and a five-value section state; item-level signals carry their own observed/unknown state. | The ticket names the six collectors; a boolean clear/not-clear vocabulary cannot express partial, absent, or not-delivered evidence. | Free-form sections; `clear`/`blocked` booleans; one global status. |
| DEC-3 | Section read failures are digest data; status exits `0` with all six sections whenever it can assemble a digest; only parser/invocation failures or containment produce an error envelope. | The first-call digest must still be useful when one source is down; failing the command would hide the other five sections and encourage ad-hoc probing. | Fail the command on any source failure; return success only when all sections are observed. |
| DEC-4 | Repository addressing is derived from the checkout's `origin` remote; no new config keys; `origin`-only; GitHub host only; absence is unavailable. | Minimal named-consumer surface; the repository already has an unambiguous remote; absence is represented truthfully. | New typed config branch; every-remote search; environment URL; guessing from the folder name. |
| DEC-5 | GitHub reads use a declared `GITHUB_TOKEN` credential reference through `CredentialPort`; no anonymous fallback; missing/rejected credentials or a refused non-`credential-reference` instance make only the dependent GitHub reads unusable. The status composition admits only a GitHub instance whose `authMethod.mechanism` is `"credential-reference"`; an injected `"anonymous"` instance is refused at composition before any read. Because the refusal withholds only the GitHub reads and never the local PM context, the per-section outcome is pinned: `tracker` and `ci` classify `unknown` (`credential-unavailable`), and `changes-and-prs` classifies `degraded` (`partial-evidence`) while the local active change is observed, falling to `unknown`/`unavailable` only when the active-change source is also absent or unusable. No affected section is ever `observed` under the guard, and the credential-reference restored control returns the normal Appendix A states. | Fail-loud, centralized credentials, and predictable rate limits; an anonymous fallback can mask a configuration problem and is unreliable for a first-call digest. Refusing only the GitHub reads keeps the observed local PM evidence visible instead of discarding it into an unobserved section. | Anonymous fallback; direct environment read; a config-declared credential reference. |
| DEC-6 | Collection reads are the query-shaped form of the existing `read-work-item`/`read-delivery-request` operations; the GitHub surface gains `listWorkItems`/`listDeliveryRequests`; the closed operation set and capability declaration are unchanged; the trap catalog is extended. | Follows the Jira `searchWorkItems` precedent and avoids a cross-provider operation-set change; no declared read gap becomes supported, so the GH-188 maintenance rule is not triggered, but its trap-coverage discipline still applies and the catalog extends in the same change. PM decision (GH-175): DEC-6 stays change-local; no separate decision record is authored for this change, and phase 7 extends the provider-client-seeds maintenance rule if the collection-read precedent needs durable documentation. | New `list-*` operations in the closed set; no list read (status cannot enumerate); a GraphQL surface. |
| DEC-7 | Tracker predicates: owner hand-backs by declared owner-attention label; blocked dependencies by `blocked-by` relation; stalls by `updatedAt` and a 14-day threshold; hygiene by title/labels/status conformance. | Directly answers the four ticket families from normalized data; honors ADR-0004/0006 absence semantics. | Comment-derived activity; absent assignee as unassigned; custom-field hygiene without a named consumer; label-only blocked dependencies. |
| DEC-8 | Source availability is declared per family/signal; GitHub blocked dependencies and review state/threads are unavailable on the minimal slice and are reported unknown/unavailable, never empty/zero. | The real REST list payload lacks structured links and review decisions; truthful evidence is more important than filling every family. | Treat absent relations/review data as empty; add GraphQL/issue-dependency reads now; suppress the families entirely. |
| DEC-9 | Changes/PRs combines the local active change with the open PR list; no per-PR detail reads; review state/threads are unknown on GitHub. | Bounded and truthful; detail reads still cannot obtain review decisions from the minimal REST slice. | N+1 PR detail reads; omit pull requests; list only the active change. |
| DEC-10 | CI observes the current checkout HEAD (branch + SHA); no reported pipeline is `none`, not green; open-PR-head CI is deferred. | The checkout HEAD is the available commit signal; `DeliveryRequest` has no head SHA. | Open-PR head (no SHA); all branches (unbounded); assuming green on no runs. |
| DEC-11 | Lanes-or-queue is always `not-delivered` with `engine-not-delivered`; never an observed empty queue. | M2-S1 has not delivered a queue/lane engine; an empty queue would be a fabricated capability. | Empty observed queue; omit the section; implement `queue ready` here. |
| DEC-12 | Providers read the declared chain/entries from config and active parks from the verified state fold; no engine/quota call; entry availability is `parked` or `unverified`, never `available`. | The ticket explicitly separates the config/state read from the provider engine; an active park must not look available. | Call `provider resolve`/`quota` (mutating/network); mark no-park entries available; read the derived projection as truth. |
| DEC-13 | Parked work uses `.ai/local/pm-context.yaml` `parked_changes`; git-ignored; missing = unavailable; malformed = unknown; empty array = observed-empty; no fabricated age. | Existing PM coordination source; distinct from provider parks; truthful absence semantics. | Tracker label (not local); change-folder scan (heuristic); free-form notes; provider parks reused. |
| DEC-14 | Exact section/family/source caps, deterministic rank keys, and truncation evidence. | Bounds the token cost, keeps output stable, and makes omissions visible. | Unbounded output; API return order; silent dropping. |
| DEC-15 | No new error-table rows or identities; section failures carry existing `config.*`/`state.*` codes or adapter-local failure classes; only `fallback.invocation`/`fallback.internal` can fail the command. | Status is a report; a status-specific failure kind would add a surface with no consumer; the sync check stays untouched. | `status.*` rows; a status-specific envelope; section failures as command errors. |
| DEC-16 | Human output is a pure bounded renderer from the same digest; `--json` carries the full structure; the command-definition contract gains one optional human renderer. | Short human digest plus machine parity; no second data path or extra reads. | Human prints the full JSON; separate human/agent digests; LLM summarization. |
| DEC-17 | Real-corpus evidence is fixture-driven in default CI plus an opt-in live smoke with structural assertions and a bounded artifact. | Proves the live-repository AC without flaky or credentialed default CI. | Live network in default CI; exact live item counts; screenshot-only evidence. |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `core ./contracts` | Extended — the `delivery.status.v1` vocabulary: section ids, states, reasons, source ids, evidence, item shapes, counts, bounds, repository binding, human-digest contract. No error-table rows. |
| `core` domain tier | New — pure status aggregation, state derivation, ranking, capping, and human rendering over injected facts. Imports contracts only; no I/O. |
| `core` state tier | Consumed — verified read-only provider park views; no change to the state layer. |
| `core` config tier | Consumed — the resolved provider branch; no new keys or schema. |
| `adapters ./github` | Extended — bounded `listWorkItems` and `listDeliveryRequests` reads under the existing operations, plus a declared page limit and raw-page-size reporting on the existing check-runs read; trap catalog and fixtures extended; capability declaration unchanged. |
| `adapters ./repo` | Extended — bounded `origin` remote and current HEAD facts, read-only, no child process; linked-worktree support. |
| `adapters ./file` | Extended — bounded YAML read of the local PM context with only active/parked projections; no writes. |
| `adapters ./credentials` | Consumed — `GITHUB_TOKEN` resolved only through `CredentialPort`; no new implementation or allowlist entry. |
| `cli` surface | Extended — the `status` command definition, runtime composition, the optional human-text renderer hook, and edge wiring beside `config`/`lint`/`phase`/`provider`/`verify`. |
| Result contract / error table | Unchanged — no rows, kinds, envelope fields, or exit behavior. The sync check remains green. |
| Command registry / glossary / index | Reconciled in phase 7 — status's six sections, the queue gap, the provider-park vs parked-work distinction, and the new terms. |
| New current-truth feature spec | New — `doc/spec/features/feature-status-digest.md`, `ados_distribution: internal`, authored in-change and registered in the required scans. |
| Provider client seed / state / provider engine / config / monorepo specs | Reconciled in phase 7 — GitHub collection reads and unavailable signals, status as a park/config consumer, no new modules/subpaths/runtime locations. |
| Tests and fixtures | New — structure, behaviour, boundary, checks, golden, and opt-in live suites plus the status fixture corpus. |
| Changeset | New — one minor changeset for the affected workspace packages. |
| Bash stack, `.opencode/`, `.ados-claude/` | Untouched. |

## 17. ACCEPTANCE CRITERIA

Ticket AC coverage: "status on a live repository returns the six sections with evidence-backed states" → AC-F1-1, AC-F2-1, AC-F2-2, AC-F16-1. "No network call is treated as a verdict" → AC-F9-1, with the per-collector controls in AC-F3-2, AC-F3-3, AC-F5-1, AC-F6-1, AC-F7-1, and AC-F8-1.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the composed command program, **when** `status` runs with no positionals and no command flags, **then** it returns one success digest; **when** an extra positional or unknown flag is supplied, **then** the parser rejects with `fallback.invocation`, exit `1`, and no source read occurs; `--json` is the only global output switch and adds no command behavior. | F-1, NFR-5 |
| AC-F1-2 | **Given** any status invocation, **when** it runs, **then** it performs zero writes, zero fence acquisitions, zero state mutations, zero network writes, and zero child processes; all reads are read-only; replay over identical injected inputs yields identical digest bytes. | F-14, NFR-4 |
| AC-F1-3 | **Given** a status run in which one or more sections are `unknown`, `degraded`, `unavailable`, or `not-delivered`, **when** the command completes, **then** it returns a success envelope with all six sections and exit `0`; section failures are evidence data, not command failures; only parser/invocation failures or an unclassifiable internal failure produce an error envelope, and a section failure never does. | F-2, F-9, NFR-3 |
| AC-F2-1 | **Given** any status digest, **when** inspected, **then** `sections` contains exactly the six ids in the fixed order `tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`, `providers`, `parked-work`; each section has exactly one state from `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`, a non-empty evidence record, counts, its ranked item list(s), and a truncation marker; no section or state is missing. | F-2, DM-1, DM-2, DM-3, NFR-1 |
| AC-F2-2 | **Given** the section state derivation matrix in Appendix A, **when** each fixture is aggregated, **then** the section state matches the matrix: `observed` only when every required source read succeeded; `degraded` when evidence is partial; `unknown` when no usable evidence remains; `unavailable` when the source is absent/not configured; `not-delivered` only for the queue section; item-level unknowns do not turn an `observed` section into a clear or zero claim. | F-2, F-9, DM-3, NFR-1, NFR-3 |
| AC-F3-1 | **Given** normalized open `WorkItem` fixtures carrying the owner-attention labels `hand-back` or `human-input-needed`, **when** the tracker collector runs, **then** each labeled item is listed as an owner hand-back with the label evidence; an item with absent `assignee` is not reported as unassigned (absence = unknown per ADR-0006); no item is fabricated; the family is deterministic and bounded. | F-3, DM-5, NFR-3 |
| AC-F3-2 | **Given** a tracker source that declares blocked-dependency relations unavailable (the minimal GitHub slice), **when** the tracker collector runs, **then** the blocked-dependencies family is `unavailable` with `signal-unavailable` and zero items — never an observed empty family; **given** a source that supplies `blocked-by` relations (Jira fixtures), **when** targets are observed, **then** open targets are reported blocked, done/canceled targets are not, and unobserved targets are reported with `dependencyState: unknown`, never as resolved. | F-3, DM-5, DM-14, NFR-3 |
| AC-F3-3 | **Given** open work items with `updatedAt` present and older than the declared 14-day threshold, **when** the stall family runs, **then** they are listed as `stalled` with their age; **given** an item with `updatedAt` absent or invalid, **then** it is listed as `unknown` activity, never `stalled` or `active`; **given** a fresh item, **then** it is not listed as stalled; the injected clock controls the threshold and no timestamp is derived from comments or ordering. | F-3, DM-5, NFR-3 |
| AC-F3-4 | **Given** normalized open items, **when** the hygiene family runs, **then** it reports `missing-title` for a blank/empty title and `missing-labels` for an empty label set; it never reports comment conformance (absent comments = unknown per ADR-0006) and never checks unmapped custom fields; conforming fixtures yield zero findings and non-conforming fixtures yield exactly the expected findings. | F-3, DM-5, NFR-3 |
| AC-F4-1 | **Given** a repository binding and an observed local PM context, **when** the changes-and-PRs collector runs, **then** it reports the active change (`workItemRef`, `branch`, `changeFolder`) and the open pull requests with source/target refs and delivery state; **given** the PM context is missing or malformed, **then** the active change is `unknown`, not none; **given** the VCS source declares review state/threads unavailable, **then** those signals are `unknown` with `signal-unavailable`, never `open` or zero; a partial source failure yields `degraded`. | F-4, DM-6, DM-14, NFR-3 |
| AC-F5-1 | **Given** the current checkout HEAD resolves to a branch and SHA, **when** the CI collector runs, **then** it reads the single bounded check-runs page for that SHA (`per_page=STATUS_SOURCE_PIPELINE_LIMIT`) and classifies every run on that page: `failed` if any failed, `pending` if any running/queued and none failed, `canceled` if canceled and none worse, `succeeded` if at least one run succeeded and all others are succeeded/skipped, and `none` if the read succeeded but no run was reported or every reported run was skipped; `none` is never `succeeded`, and an all-skipped set is never `succeeded`; **given** the SHA is unresolved or the read fails, **then** the section is `unknown` with the reason and failure class, never green. | F-5, DM-7, NFR-3 |
| AC-F6-1 | **Given** any status run, **when** the lanes-or-queue section is inspected, **then** it is `not-delivered` with `engine-not-delivered`, source `queue-engine`, zero items and zero counts, and an explicit note that no queue or lane engine exists in this release; it is never `observed` empty and never duplicates `queue ready`. | F-6, DM-8, NFR-3 |
| AC-F7-1 | **Given** a resolved provider config with a declared default chain and declared entries, **when** the providers collector runs, **then** it lists the chain/entries and active parks from the verified state fold; an entry with an active park is `parked` with cause and expiry, an entry without a park is `unverified` (never `available`), and an active chain park marks the chain parked; **given** no default chain, **then** the section is `unavailable` with `provider-chain-not-declared`; **given** a park read failure, **then** the section is `degraded` with the state failure code and no "no parks" claim. | F-7, DM-9, DM-14, NFR-3 |
| AC-F7-2 | **Given** a providers collector run, **when** it executes, **then** it performs no provider-engine `resolve`/`quota` call, no quota HTTP fetch, no announcement write, and no state mutation; only the config read and the verified park fold run. | F-7, F-14, NFR-4 |
| AC-F8-1 | **Given** `.ai/local/pm-context.yaml` (git-ignored), **when** the parked-work collector runs, **then** it reports `parked_changes` with `workItemRef`, optional branch/changeFolder/reason, and optional age from `parkedAt`; **given** the file is absent, **then** the section is `unavailable` with `local-context-missing` and an explicit git-ignored marker; **given** malformed YAML or a non-array `parked_changes`, **then** `unknown` with `local-context-malformed`; **given** an explicit empty array, **then** `observed` with `observed-empty`; it never fabricates age or parked items. | F-8, DM-10, NFR-3 |
| AC-F9-1 | **Given** the no-network-verdict negative-control matrix — a failed issues read, a failed PR read, a failed check-runs read, a missing credential, an unresolved SHA, an unresolved repository binding, a torn park store, a missing provider chain, a missing PM context, and a provider with an active park — **when** status runs, **then** no control yields `observed` with zero items or a clear/green/available claim; every failure is reflected in the section state and/or item state with a reason, and the queue section remains `not-delivered`. | F-9, DM-3, DM-14, NFR-3 |
| AC-F10-1 | **Given** cap-sized and over-cap source fixtures, **when** the aggregator runs, **then** each section respects its item caps — each tracker family independently capped at 4 with no common tracker list, and each non-tracker list at its declared cap — `counts.omitted` records every dropped item (for the tracker section, the sum across families), `truncated` is true when items were dropped or the raw source page reached its declared read limit (`STATUS_SOURCE_ITEM_LIMIT` for issues/pulls, `STATUS_SOURCE_PIPELINE_LIMIT` for check runs) before any object filtering, evidence includes `source-truncated` when applicable, and ordering follows the declared deterministic ranks; no API return order or map iteration order changes the digest. | F-10, DM-12, NFR-2, NFR-4 |
| AC-F11-1 | **Given** `status --json`, **when** it runs, **then** stdout contains exactly one valid `CommandResult` envelope whose `data` carries `schemaVersion: delivery.status.v1`, `generatedAt`, `repository`, `summary`, and the six sections; the serialized `data` digest is at most 64 KiB (65 536 bytes) and the bound applies to `data` only, while the total envelope size is observed and recorded but not separately hard-capped; no section data is omitted from the machine structure; success carries no `error` key. | F-11, DM-1, DM-13, NFR-2, NFR-5 |
| AC-F11-2 | **Given** human mode, **when** status succeeds, **then** stdout is a deterministic digest with an optional header and exactly one line per section in fixed order, each line naming the section state and bounded counts; the digest is at most 24 lines and 4096 bytes; it contains no raw provider payloads, no item titles, no secrets, and no LLM-generated prose; rendering performs zero extra reads and uses the same digest as `--json`. | F-11, DM-13, NFR-2, NFR-5 |
| AC-F12-1 | **Given** a checkout whose `origin` remote is a GitHub HTTPS or SSH URL, **when** status resolves addressing, **then** the binding is `{ owner, name, host: github.com, remoteName: origin }` with no userinfo or credential material; **given** no origin, an unparseable URL, or a non-GitHub host, **then** the binding is unavailable and the tracker/changes/CI sections report `unavailable`/`unknown` with `addressing-unresolved`/`remote-unsupported`; no new config key is read and no alternate remote is invented. | F-12, DM-11, NFR-3 |
| AC-F13-1 | **Given** the GitHub collection-read extension, **when** it reads open issues and open pull requests, **then** the issues list excludes pull-request objects, each read is bounded by the declared limit, and no provider-native payload crosses the subpath surface; the closed operation set and capability declaration are unchanged; the trap catalog contains entries for mixed issue/PR lists, the page limit, absent issue relations, and PR list state/review defaults, each with a matching assertion; credentials resolve only through `CredentialPort`. | F-13, DM-14, NFR-7, NFR-8 |
| AC-F14-1 | **Given** the delivered code, **when** the structure, boundary, ambient, forbidden-literal, privacy, and secret-read gates run, **then** the status contracts/domain import only contracts, no new runtime-API location or package subpath exists, the secret-read allowlist stays at four entries, no product literal appears, and the GitHub/repo/file reads stay in their admitted subpaths; status performs no writes or fences. | F-14, NFR-4, NFR-7, NFR-10 |
| AC-F15-1 | **Given** the error table and documented table, **when** the change lands, **then** no new row or domain kind is added; section evidence uses only existing `config.*`/`state.*` codes when a classified failure occurred and adapter-local failure classes that are not error-table identities; a provider chain/config validation failure uses `failureCode: "config.value.invalid"` with reason `provider-chain-unresolved` and no `failureClass`, and no `provider.*` error-table code is used as a failure class; the two-way sync check and existing classification tests remain green; status command failures use only `fallback.invocation` and `fallback.internal`. | F-15, NFR-8 |
| AC-F16-1 | **Given** the committed fixture corpus for all six sections and the state derivation matrix, **when** the default test suite runs, **then** the six sections are produced with the expected states, evidence, ordering, caps, and negative controls, with zero live network calls; **given** the opt-in live smoke (enabled only by a test-only switch under `tests/**` with a credential supplied), **when** it runs against this repository, **then** it asserts only structural invariants (six sections, evidence present, bounds, no secrets, queue `not-delivered`, no provider `available`) and never pins volatile item counts, so default CI stays deterministic; no product literal is committed for the switch, and any production edge that exposes it derives it from `brand.environmentPrefix`; the live evidence artifact is bounded and secret-free. | F-16, NFR-6, NFR-9 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR targeting `main-tools`; branch `feat/GH-175/status-v1`; one conventional commit per plan phase; the PM never merges.
- Fully additive command and contracts. No existing command, error row, configuration key, state schema, or on-disk artifact changes; rollback is a single PR revert.
- The new current-truth feature spec lands in-change; the provider client seed, state, provider engine, config, result contract, monorepo, command registry, glossary, and index docs are reconciled in the same delivery phase or phase 7.
- A minor changeset is recorded for the affected workspace packages (lockstep versioning).
- The opt-in live smoke is run once in the PR environment with a credential; its bounded, secret-free evidence artifact may be attached to the PR. Default CI uses fixtures only.
- Adoption: the coordinator can call `ados status` immediately; agent prompt adoption and MCP/OpenCode surfaces are separate operating-model changes (NG-8).
- No migration, seeding, or store-format change is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Not applicable. Status reads existing configuration, existing verified park state, existing repository metadata, the GitHub API, and the local PM context. It creates no records, changes no schema version, writes no files, and requires no seed data. The PM context and provider park store remain owned by their existing writers.

## 20. PRIVACY / COMPLIANCE REVIEW

- Status is read-only and collects no telemetry. It performs no network writes and sends no repository data to a vendor other than the read-only GitHub API requests required for issues, pull requests, and check runs.
- GitHub credentials resolve only through `CredentialPort`; resolved material never enters the digest, evidence, human text, logs, or diagnostics. The serialization redaction chokepoint covers the envelope and human output.
- Evidence is bounded to counts, ids, states, reasons, failure codes/classes, and safe locations. It carries no raw provider payload, response body, comment text, commit message, or repository file content.
- The local PM context is read with a bounded projection: only `active_change` and `parked_changes` fields (work-item ref, branch, change folder, reason, optional `parkedAt`). Free-form `notes` and unrelated fields are not read into the digest.
- The human digest prints work-item refs, branch names, and counts only; item titles appear only in the machine digest, capped and sanitized through the normal output path. Private-repository data remains local; no artifact is published by the command.
- The opt-in live evidence artifact must be bounded, secret-free, and reviewed before attachment; it is not committed by default.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Read-only by construction:** status calls no write/fence API, no tracker/PR/CI write, no provider engine, and no quota endpoint. It cannot mutate an artifact or provider state.
- **Credential centralization:** the only credential access is `CredentialPort.resolve` for `GITHUB_TOKEN`; status code reads no ambient environment. No new secret-read allowlist entry or credential-material path is added.
- **No shell or spawn:** repository binding and HEAD facts come from bounded git metadata reads through the repository adapter; status spawns no child process and executes no shell.
- **Bounded addressing:** only the `origin` remote is read; only `host: github.com` is accepted; userinfo and credentials in a remote URL are discarded; non-GitHub hosts are unavailable, not attempted.
- **Bounded parsing:** the local PM context is parsed with the same bounded YAML 1.2 core limits as existing file reads; parse failures are classified as evidence, never raw parser output.
- **Bounded input/output:** source pages, per-section items, evidence entries, machine bytes, and human bytes are capped; truncation is explicit. No unbounded loop, retry storm, or pagination crawl.
- **No secret or raw payload leakage:** evidence carries codes/classes/counts only; the single serialization redaction path and planted-secret canaries apply. Provider payload failures surface as adapter-local classes, never raw bodies.
- **Brand neutrality:** no product or binary literal is committed; the human header uses the injected brand binary name. The only provider-specific literals are the `GITHUB_TOKEN` credential key and the `github.com` host, both declared provider data.
- **Denial-of-service:** the pure aggregator is linear over the capped input; no recursion over unbounded provider graphs; no arbitrary URL construction beyond the bound repository and the declared read endpoints.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Adding a section is a contract change (section id/order, state derivation, renderer line, tests); adding a collector inside an existing section is a source/availability change plus fixtures.
- Adding a tracker/VCS/CI provider is an addressing/config story; the collectors and predicates are provider-agnostic and consume normalized views.
- The declared caps, stall threshold, and owner-attention label set are contract data; changing them updates the contract, tests, and docs without changing the collector architecture.
- The GitHub trap catalog is the early-warning surface for list/pagination/mixed-PR/absent-relation behavior; every new list-shaped quirk joins as a four-field entry with a fixture and an assertion.
- No new error row means the error-table sync check remains untouched; section failure classes are evidence, not identities, and must not be promoted to error rows without a named consumer.
- The human renderer is pure and bounded; a new section needs one line, and an over-cap digest is a test failure, not a runtime surprise.
- Docs to keep current: the new status feature spec, the provider client seed GitHub surface/trap catalog, the state/provider-engine/config consumer notes, the result contract (no new rows), the monorepo module/test inventory, the command registry, the glossary, and the index.
- Operational surface stays small: one read-only command, three outbound read calls bounded by one page each, one logical park-fold read (one `readProviderParkViews` invocation), one config resolve, no daemon, no background process, and no new configuration knob.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Status digest | The bounded `delivery.status.v1` payload returned by `ados status`: six sections, states, evidence, counts, ranked items, and truncation markers. |
| Section state | One of `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`; describes the quality/availability of the section's evidence, not a global all-clear. |
| Evidence record | The bounded sources/reasons/failure codes or classes that justify a section or item state; never raw provider payloads. |
| Observed | Every required source read for the section succeeded; item-level unknown signals may still exist and are counted. |
| Degraded | Some required evidence is present and some is missing/failed/unavailable; the digest is partial but truthful. |
| Unknown | No usable evidence remains for the section or signal; it is never a clear or zero claim. |
| Unavailable | The section's source is known to be absent or not configured (no binding, no provider chain, no PM context). |
| Not-delivered | The capability itself does not exist in this release; used only for the queue/lane section until M2-S1. |
| Item-level unknown | A signal on an individual item is absent or unavailable (for example `updatedAt`, review state); it is not a fabricated value and does not by itself make the section unobserved. |
| Source availability | The declared per-family/per-signal statement of what the bound adapter supplies; it determines whether a family is observed or unavailable. |
| Owner hand-back | An open work item carrying a declared owner-attention label; absence of `assignee` is not used because absence means unknown (ADR-0006). |
| Blocked dependency | An open work item with a `blocked-by` relation; the target's completion is observed, or explicitly unknown, never assumed resolved. |
| Stall | An open work item whose provider-native `updatedAt` is older than the declared threshold; absent/invalid activity is unknown, never stale or fresh. |
| Ticket hygiene | Conformance over mapped normalized data: non-blank title and non-empty label set; comment and unmapped custom-field conformance are out of scope/unknown. |
| Active change | The local PM context's `active_change`: work-item ref, branch, and change folder. Git-ignored local state; absence is unknown. |
| Parked work | A non-provider delivery change recorded in the local PM context's `parked_changes`; distinct from a provider park. |
| Provider park | A named, self-expiring AI-provider availability pause (`provider:<name>` or `chain:<name>`) read from the verified state fold; distinct from parked delivery work. |
| Provider entry availability | `parked` when an active park exists, `unverified` otherwise; status never claims `available` because it does not run the provider engine. |
| Repository binding | The `origin`-derived GitHub `owner`/`name`/`host` used for read-only tracker, PR, and CI reads; no credentials or userinfo. |
| Source truncation | The explicit marker that output items were dropped by a cap or that the source returned its declared read limit, so more may exist. |
| Live smoke | The opt-in, credentialed structural test against this repository; it is not a default-CI network test. |

## 24. APPENDICES

### Appendix A — Section state derivation matrix

| Section | `observed` | `degraded` | `unknown` | `unavailable` | `not-delivered` |
|---|---|---|---|---|---|
| tracker | issues read succeeded and all four family signals are available (item-level unknowns allowed) | issues read succeeded but at least one family signal is unavailable | issues read failed, credential unavailable, or no usable tracker evidence | no repository binding or no tracker source | never |
| changes-and-prs | PR list succeeded and active change observed/observed-empty, with all declared PR signals available | PR list or active change failed/unavailable, or a declared PR signal is unavailable | both sources failed with no usable evidence | no repository binding and active-change source absent | never |
| ci | commit resolved and pipeline read succeeded (including no reported runs) | never | commit unresolved or pipeline read failed | no repository binding | never |
| lanes-or-queue | never | never | never | never | always |
| providers | provider config read succeeded, a default chain is declared, and park fold succeeded; entries may be `unverified`/`parked` | config/entries observed but park fold failed | config read failed, config invalid, or the declared chain does not resolve | no declared default chain | never |
| parked-work | PM context read succeeded and `parked_changes` is an array (including empty) | never | PM context malformed or wrong shape | PM context absent | never |

For the `providers` row, the columns are evaluated in the fixed precedence `unknown` → `unavailable` → `degraded` → `observed` (see the normative precedence note in Section 8.3 and DM-9).

### Appendix B — Section shape summary

```
StatusDigest {
  schemaVersion: "delivery.status.v1"
  generatedAt: ISO-8601 UTC
  repository: { state: "observed", host, owner, name, remoteName } | { state: "unavailable", reason }
  summary: { sections, observed, degraded, unknown, unavailable, notDelivered, actionable }
  // actionable = summed rendered item arrays of observed|degraded sections; others contribute 0
  sections: [
    tracker, changes-and-prs, ci, lanes-or-queue, providers, parked-work
  ]
}

StatusSection {
  id, title, state,
  evidence: { sources: [...], reasons: [...] },   // bounded
  counts: { observed, unknown, total, omitted },
  items: [...],                                   // non-tracker ranked list; tracker has none
                                                  // bounded per list; ranked by declared keys
  truncated: boolean,
  ...section-specific fields (families, activeChange, pullRequests, commit, result,
     runs, capability, expectedStory, chain, entries, parks, source)
}
```

### Appendix C — Declared constants

| Constant | Value | Purpose |
|---|---|---|
| `STATUS_SECTION_ORDER` | `tracker`, `changes-and-prs`, `ci`, `lanes-or-queue`, `providers`, `parked-work` | Fixed section order. |
| `STATUS_SECTION_STATES` | `observed`, `degraded`, `unknown`, `unavailable`, `not-delivered` | Closed section-state vocabulary. |
| `STATUS_MAX_ITEMS_PER_SECTION` | 8 | Uniform rendered-item cap for each non-tracker ranked list. The tracker section has no common list and is governed by `STATUS_MAX_TRACKER_FAMILY_ITEMS`. |
| `STATUS_MAX_TRACKER_FAMILY_ITEMS` | 4 | Per-family tracker cap; each of the four families caps independently, so a tracker section may render up to 4 × 4 items and its `truncated`/`omitted` aggregate across families. |
| `STATUS_MAX_EVIDENCE_SOURCES` | 6 | Evidence source cap. |
| `STATUS_MAX_REASONS` | 6 | Unique reason cap. |
| `STATUS_MAX_PROVIDER_ENTRIES` | 8 | Provider entry cap. |
| `STATUS_MAX_PROVIDER_PARKS` | 8 | Active park cap. |
| `STATUS_MAX_PIPELINE_RUNS` | 8 | CI run cap. |
| `STATUS_MAX_OPEN_PULL_REQUESTS` | 8 | PR cap. |
| `STATUS_MAX_PARKED_CHANGES` | 8 | Parked-work cap. |
| `STATUS_SOURCE_ITEM_LIMIT` | 100 | One bounded issues/PRs page. |
| `STATUS_SOURCE_PIPELINE_LIMIT` | 20 | One bounded check-runs page, sent as `per_page`; the raw returned page size drives the at-limit signal. |
| `STATUS_MAX_TITLE_CHARS` | 120 | Item title cap. |
| `STATUS_MAX_DETAIL_CHARS` | 160 | Safe evidence/reason detail cap. |
| `STATUS_MAX_HUMAN_LINES` | 24 | Human digest line cap. |
| `STATUS_MAX_HUMAN_BYTES` | 4096 | Human digest byte cap. |
| `STATUS_MAX_MACHINE_BYTES` | 65536 | Byte cap on the serialized `data` digest; the total envelope size is recorded but not separately capped. |
| `STATUS_STALL_THRESHOLD_DAYS` | 14 | Declared stall threshold. |
| `STATUS_OWNER_ATTENTION_LABELS` | `hand-back`, `human-input-needed` | Declared owner-attention label set. |
| `STATUS_SCHEMA_VERSION` | `delivery.status.v1` | Status payload schema. |

### Appendix D — Tracker predicates and signal availability

| Family | Predicate over normalized `WorkItem` | GitHub minimal slice | Jira read slice |
|---|---|---|---|
| Owner hand-backs | Open item (delivery state not `done`/`canceled`) whose labels include a declared owner-attention label, case-insensitive. Absent `assignee` is **not** used (absence = unknown). | Available (labels) | Available (labels) |
| Blocked dependencies | Open item with a `blocked-by` relation. Target observed done/canceled → not blocked; target observed not done → blocked (`dependencyState: open`); target unobserved → blocked (`dependencyState: unknown`). | **Unavailable** (no structured issue-link read) | Available (`issuelinks`) |
| Stalls | Open item with parseable `updatedAt`; age > 14 days → `stalled`; age ≤ 14 days → active/not listed; absent/invalid → `unknown` activity. | Available (`updated_at`) | Available (`updated`) |
| Ticket hygiene | Open item with blank/empty title → `missing-title`; empty label set → `missing-labels`. Comments and unmapped custom fields are not evaluated. | Available (title/labels/status) | Available (title/labels/status) |

Deterministic ranks: owner hand-backs by label group then oldest `updatedAt` then ref; blocked dependencies by `dependencyState` unknown→open then ref; stalls by oldest stalled then unknown-activity ref; hygiene by finding count then ref.

These four tracker ranks are the only tracker ordering keys. Non-tracker rank keys and tie-breakers (pull requests, CI runs, provider entries/parks, parked work) are declared in §8.3. Each tracker family caps independently at `STATUS_MAX_TRACKER_FAMILY_ITEMS` (4), the tracker section has no common `items` list, and its section-level `truncated`/`omitted` aggregate across the families.

### Appendix E — Human digest grammar and example

```
<binary> status <owner>/<name> @ <branch|detached> <sha7>
tracker    <state>  hand-backs <n> | blocked <state> | stalls <n> (<unknown> unknown) | hygiene <n>
changes    <state>  active <ref|none> | PRs <n> (<signal state>)
ci         <state>  <failed|pending|succeeded|canceled|none-reported|unknown> (<failed>/<total> jobs)
lanes      not-delivered  no queue or lane engine in this release
providers  <state>  chain <name|none> | active parks <n> | <entries> entries
parked     <state>  <n> parked changes (git-ignored local state)
```

Rules: fixed section order; exactly one line per section; every line names its state; optional short reasons in parentheses; truncation `+N` on the affected line; no raw payloads, no item titles, no secrets, no timestamps, and no LLM prose; total at most 24 lines and 4096 bytes.

Example (illustrative, not pinned):

```
ados status owner/repo @ feat/GH-175/status-v1 7155074
tracker    degraded  hand-backs 3 | blocked unavailable | stalls 2 (1 unknown) | hygiene 1
changes    degraded  active GH-175 | PRs 2 (review state unavailable)
ci         observed  succeeded (5/5 jobs)
lanes      not-delivered  no queue or lane engine in this release
providers  unavailable  no default chain declared
parked     observed  0 parked changes (git-ignored local state)
```

### Appendix F — GitHub collection reads and trap coverage

| Read | Request shape | Normalized result | Trap entries and assertions |
|---|---|---|---|
| Open work items | One bounded issues page (`state=open`, declared limit, updated sort) | `WorkItem` set; pull-request objects filtered out | `GITHUB-LIST-EXCLUDES-PRS` (mixed list excludes PRs); `GITHUB-LIST-PAGE-LIMIT` (request uses the declared limit; status marks limit truncation from the raw page size before pull-request objects are filtered); `GITHUB-ISSUE-RELATIONS-ABSENT` (real-shaped issue without links stays `relations: []`; status declares blocked dependencies unavailable, not empty) |
| Open delivery requests | One bounded pulls page (`state=open`, declared limit, updated sort) | `DeliveryRequest` set with refs/draft/state | `GITHUB-PR-LIST-REVIEW-DEFAULT` (list payload without a review decision is not trusted as review state; status reports review state unknown) |
| Check runs for the checkout SHA | One bounded check-runs page (`per_page=STATUS_SOURCE_PIPELINE_LIMIT`, no pagination) | `PipelineRun` set for that SHA; no object filtering | The raw page size (up to 20) is the at-limit input: a page of exactly `STATUS_SOURCE_PIPELINE_LIMIT` runs signals `source-truncated` even when no rendered run is dropped; a smaller page never signals it. |

All three reads derive the source-at-limit signal from the raw number of entries in the returned page (100 issues, 100 pull requests, 20 check runs), compared against the declared limit (`STATUS_SOURCE_ITEM_LIMIT` for the list reads, `STATUS_SOURCE_PIPELINE_LIMIT` for check runs) before any object filtering; a filtered-down normalized count never suppresses the signal and never invents it.

No new exported provider-native type and no new adapter operation are introduced. The check-runs read keeps the `readPipelineRun` method name and gains only a declared page limit and raw-page-size reporting. The capability declaration's `supportedOperations` remains `read-work-item`, `read-delivery-request`, `read-pipeline-run`; write gaps are unchanged. The trap catalog keeps its four-field entry shape and bidirectional coverage.

### Appendix G — Live smoke evidence approach

- Default suite: committed fixtures only; zero live network calls; deterministic assertions for all six sections, states, caps, ordering, and negative controls.
- Opt-in live smoke: enabled only by a test-only switch that lives under `tests/**` (a test-tree literal is permitted there) together with a resolvable `GITHUB_TOKEN`; runs `status --json` against the current repository; asserts structural invariants (six sections in order, evidence present, bounds, no secrets, queue `not-delivered`, no provider `available`, no section observed-with-zero after a failed read); does not pin volatile counts.
- Brand neutrality of the switch: no product literal is committed. The forbidden-literal scan covers `ados`, `ADOS_`, and `~/.ados` under `packages/**` and registered `doc/**`; if a production edge ever exposes a live-smoke switch, it derives the variable name from the injected `brand.environmentPrefix` instead of hardcoding a product prefix.
- Evidence artifact: a bounded, secret-free JSON/text excerpt may be written under the change folder and attached to the PR; it is not a default-CI gate and is not committed unless the owner explicitly wants a one-time record.
- The live smoke is intentionally outside `pnpm check`/default CI to avoid flaky network, credential, and rate-limit failures.

### Appendix H — Documentation impacts to reconcile

- New current-truth doc: `doc/spec/features/feature-status-digest.md` (`ados_distribution: internal`), authored in-change.
- `feature-provider-client-seeds.md`: GitHub collection reads, unavailable review/relation signals, trap-catalog extension, unchanged operation set.
- `feature-state-layer.md`: status is a read-only consumer of the verified park fold; no writes.
- `feature-provider-engine.md`: status consumes config and parks; it does not run the engine or fetch quota.
- `feature-config-layer.md`: status consumes the provider branch; no new keys.
- `feature-result-contract.md`: no new rows; section failures are data, not envelope errors.
- `feature-monorepo-scaffold-toolchain.md`: new status modules/tests; no new package, subpath, or runtime-API location.
- `cli-command-registry.md`: status's six sections and the queue gap; `queue ready` remains M0-S7.
- `doc/overview/glossary.md` and `doc/00-index.md`: new terms and the new feature-spec link.
- Changeset: one minor changeset for the affected workspace packages.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | Change Spec Writer | Initial specification. Pins: exactly `ados status` with no command flags; six fixed sections and a five-value state vocabulary; evidence-backed non-verdict degradation; tracker four families with `updatedAt`-absent = unknown and ADR-0006 absence discipline; GitHub blocked-dependency and review-state signals declared unavailable rather than empty; changes/PRs from local active change plus open PRs; CI on the current checkout HEAD with `none` not green; lanes/queue always `not-delivered`; providers from config plus verified park fold with `unverified` not `available`; parked work from git-ignored PM context; `origin`-derived repository binding with no new config keys; bounded GitHub collection reads under the existing operations with trap coverage; no new error rows; fixture-driven CI plus opt-in live smoke; AC-F1..AC-F16. |
| 1.1 | 2026-10-31 | Change Spec Writer | Clarification pass driven by the GH-175 test plan (§3 GAP-2..GAP-7, GAP-9; §8.3 OQ-T1..OQ-T7). Pins: each tracker family caps independently at `STATUS_MAX_TRACKER_FAMILY_ITEMS` (4) with no common tracker `items` list, section `truncated` true when any family dropped items, and section `counts.omitted` the family sum (DM-5, DM-12, Appendix C, Appendix D); enumerated non-tracker rank keys and tie-breakers for pull requests, CI runs, provider entries, provider parks, and parked work (§8.3, DM-12, Appendix D); fixed providers precedence config-untrusted → `unknown`, no declared default chain → `unavailable`, park-fold failure with config observed → `degraded`, otherwise `observed` (DM-9, Appendix A, §8.3, F-7); exact `summary.actionable` definition as the summed rendered items of observed/degraded sections with tracker families counted individually and unknown/unavailable/not-delivered contributing zero (DM-1, Appendix B); test-only live-smoke switch under `tests/**` with any production edge deriving it from `brand.environmentPrefix` and no `ADOS_` literal committed (F-16, Appendix G, AC-F16-1); the 64 KiB bound applied to the serialized `data` digest with the envelope total recorded but not separately capped (AC-F11-1, NFR-2, Appendix C); and the source-at-limit signal derived from the raw page size before pull-request filtering (F-10, DM-12, Appendix F, AC-F10-1). No scope, AC identity, section set, state vocabulary, error-table posture, or pinned behavior changed. |
| 1.2 | 2026-10-31 | PM (planning reconciliation) | NFR-9 read-cost clarification driven by the implementation plan: the "≤ 1 state read" metric is a **logical park-fold read** — exactly one `readProviderParkViews` invocation — and the fold's documented internal verified reads are not multiplied by status. The state layer stays unchanged (no new state API). No behavior, AC identity, section set, or bound other than the metric unit changed. |
| 1.3 | 2026-10-31 | Change Spec Writer | DoR iteration-1 closeout for the specification-routed findings. Pins: (1) the GitHub check-runs read is one bounded page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), the client reports the raw page size, and the at-limit/`source-truncated` signal is derived from that raw size, replacing the unbounded "all runs reported for that SHA" reading (F-5, F-10, DM-12, §8.4, §8.5, Appendix C, Appendix F, AC-F5-1, AC-F10-1); (2) the provider-config failure identity mapping — a provider chain/config validation failure is `failureCode: "config.value.invalid"` with reason `provider-chain-unresolved` and no `failureClass`, a config resolution failure is `config-invalid` with the relevant existing `config.*` code, and no error-table code (for example `provider.chain.invalid`) is ever a `failureClass` (F-15, DM-4, DM-9, AC-F15-1); (3) the explicit PM decision that DEC-6 remains change-local with no new decision record and a phase-7 maintenance-rule extension if the collection-read precedent needs durable documentation (DEC-6); and (4) the §14 statement about the test-plan revision current at that time. No scope, AC identity, section set, state vocabulary, or error-table posture changed; the check-runs read bound and the provider-config failure identity are pinned more narrowly. |
| 1.4 | 2026-10-31 | Change Spec Writer | DoR iteration-2 closeout for the specification-routed findings. Pins: (1) the credential posture enforcement point — the status composition/edge admits only a GitHub `ExternalSystemInstance` whose `authMethod.mechanism` is `"credential-reference"`; an injected anonymous instance is refused at composition, so the tracker, changes-and-prs, and CI sections classify `unknown`/`unavailable` with `credential-unavailable`/`source-unavailable`, never `observed`, which is what makes the credential-less/anonymous control satisfiable (F-12, DEC-5; the per-section classification was refined in v1.5: the guard withholds only the GitHub reads, so `changes-and-prs` is `degraded` while the local active change is observed); and (2) the §14 reference to the test-plan revision is aligned to the current test plan v1.4, with the v1.3 history row scoped to the revision current at that time. No scope, AC identity, section set, state vocabulary, or error-table posture changed; no new AC was added. |
| 1.5 | 2026-10-31 | Change Spec Writer | DoR iteration-3 closeout for finding R-1 (specification route), a PM-authorized scoped correction with no design reopening and no scope, AC-ID, or state-vocabulary change. Corrects the anonymous/credential-less instance guard so the per-section outcome is pinned consistently with Appendix A, AC-F4-1, and TC-STATUS-013: the guard refuses only the GitHub reads and leaves the local PM context untouched, so `tracker` is `unknown` (no usable tracker evidence) and `ci` is `unknown` (a commit may resolve, but there is no usable pipeline evidence), while `changes-and-prs` is `degraded` (`partial-evidence`) whenever the local active change remains observed and only the PR evidence is missing, becoming `unknown`/`unavailable` only when the active-change source is itself absent or unusable; no affected section is ever `observed` under the guard, and the credential-reference restored control returns the normal states (`tracker` `degraded` on the GitHub slice because blocked-dependency relations are unavailable (`observed` only when the bound source declares all four family signals), `ci` `observed`; `changes-and-prs` `degraded` while the bound source declares review signals unavailable, otherwise `observed`) (F-12, DEC-5, §6 flow 3, §12 credential assumption). Appendix A and AC-F4-1 already derived `degraded` for the partial case and were left unchanged; the §14 self-reference now names v1.5, and the v1.4 history row notes the refinement. No new AC, section, state, reason, error identity, configuration key, or scope item was introduced; the test plan and plan were not modified. |
| 1.6 | 2026-10-31 | PM (DoR reconciliation) | Corrects the restored credential-reference control's tracker state: on the GitHub slice, `tracker` is `degraded` because blocked-dependency relations are unavailable (`signal-unavailable`), and `observed` only when the bound source declares all four family signals; `ci` remains `observed` and `changes-and-prs` remains `degraded` while review state/threads are unavailable. This aligns F-12/DEC-5 with Appendix A, §6 flow 7, Appendix D, and TC-STATUS-010. No scope, AC, state-vocabulary, error, config, or state-schema change. |

---

## AUTHORING GUIDELINES

This specification was authored from the verified GH-175 intake context, the M0-S6 backlog entry, the command registry, the current-truth specs for the state layer, adapter ports, provider client seeds, provider engine, configuration, result contract, pm-notes lint/phase transitions, verify change, and the monorepo scaffold, plus direct inspection of the delivered contracts and CLI composition. ADR-0004 and ADR-0006 are binding for stall and hygiene semantics. Where the ticket was terse (queue section, parked-work source, addressing, GitHub list extension, CI commit resolution, review/relation signal availability, live evidence), the spec records a decision with drivers and consequences rather than leaving an implementation choice. The spec deliberately adds no error identity, no configuration key, no state-schema change, and no new package/subpath/runtime-API location; those omissions are decisions, not gaps. The GitHub review-state and issue-relation gaps discovered during code inspection are surfaced as truthful unavailable signals and named for phase-7 reconciliation.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-175`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability
- [x] No implementation tasks, file-level code paths, or step-by-step delivery instructions
- [x] No content duplicated from linked docs
- [x] Front matter validates per front-matter rules
- [x] No new error-table rows, configuration keys, state-schema changes, or secret-read allowlist entries
