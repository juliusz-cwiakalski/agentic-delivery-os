---
change:
  ref: GH-354
  type: feat
  status: Proposed
  slug: dispatch-operator-surface
  title: "M4-S12: Dispatch operator surface — status, log, is-delivering, last-message (M4)"
  owners: ["engineering"]
  service: delivery-os dispatch engine
  milestone: "M4: Jaiship-native delivery"
  labels: ["dispatch", "operator-surface", "m4-s12", "status", "log", "is-delivering", "last-message"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - dispatch-owned durable lane ledger (`dispatch.lane`) and its latest-wins read
      - dispatch project state root, repository identity resolver, and the durable state store read path
      - dispatch command family, its help entries, and the prompt-required command reference page
      - harness adapters' persisted session storage and their telemetry-capture read posture
      - dispatch composition at the CLI edge and the production composition
      - the no-shell invariant check over the declared dispatch-flow surface list
      - dispatch conformance fixtures and the offline battery
    external:
      - opencode persisted session storage (local sqlite store, read-only)
      - Claude Code per-session transcript files (local, bounded read)
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give the typed dispatch lane the per-ref operator surface the shell lane still owns — `status`, `log`, `is-delivering`, and `last-message` as one typed command family with `--json` — so an operator or the CEO agent can inspect a delivery (live, finished, or absent) without reading the shell's marker files, PID files, stdout captures, or last-message files, and without reading or executing a shell script. The durable `dispatch.lane` record is the state source; a bounded per-ref harness-stdout artifact and the harness's own persisted session transcript are the only two new persisted reads.

## 1. SUMMARY

The dispatch lane is parity-complete for delivery semantics but has no inspection surface: the four queries the CEO prompt uses today (`--status`, `--log`, `--is-delivering`, `--last-message`) exist only on `scripts/deliver-ticket.sh`, and the typed path persists nothing an operator can read back. This change delivers one typed command family — `dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`, `dispatch is-delivering [<ref>]`, `dispatch last-message <ref>`, each with the delivered global `--json` — and the two data sources they need.

The state source is the durable `dispatch.lane` record: `status` and `is-delivering` are pure folds over its newest record per ref, with the owner process facts read through an injected advisory liveness probe. `log` reads a new bounded, reference-scoped per-ref harness-stdout artifact that a dispatch writes while its session streams; `last-message` reads the harness's own persisted session transcript through an injected adapter-owned read seam and returns the PM's final assistant message, not a synthesized classifier sentence.

Nothing on the delivery write path changes: no result token, projection, exit, attempt-record field, lane-record field, or error identity moves, no new configuration key is added, and no read path writes, repairs, or clears anything. The shell entry points keep working as the documented fallback.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The durable lane exists and is the declared read surface.** `dispatch.lane` / `delivery.dispatch.lane.v1` / key prefix `dispatch.lanes:` is declared with the closed states `active` and `terminal` (`packages/core/src/contracts/dispatch.ts:571-579`), and the record type carries `schema`, `ref`, `repository`, `attemptId`, `sessionId`, `harnessKind`, `owner: { processId, startedAt }`, `iterationOrdinal`, `restartsConsumed`, `state`, optional `lastToken`/`lastOutcome`, and `recordedAt` (`contracts/dispatch.ts:594-608`). TDR-0049 names GH-354 as the record's deferred read surface and records that the owner facts are advisory, never an exclusion mechanism (`doc/decisions/TDR-0049-dispatch-owned-durable-lane-record.md:41,277`).
- **The lane read is a bounded prefix-scoped fold.** `readDispatchLanes` reads the kind/schema/prefix with the retained-window bound (`packages/core/src/app/dispatch-ledger.ts:468-479`), `latestDispatchLaneFor` returns the newest record for a ref (`dispatch-ledger.ts:498-...`), and `resolveDispatchLane` composes the dispatch lane with resumable daemon lanes for resume only (`packages/core/src/app/dispatch-lane.ts:70-...`). No read-side surface folds these records for an operator today.
- **The dispatch family has four write/read subfamilies and no inspection query.** The grammar table lists `dispatch <ref>`, `dispatch attempts`, `dispatch dual-run summary|resolve`, and `dispatch handover` (`doc/spec/features/feature-dispatch-engine.md:59-67`); the handler declares `--revert`, `--harness`, `--resume-prompt`, `--repo`, `--note` and refuses any undeclared flag as `fallback.invocation` (`packages/cli/src/commands/dispatch.ts:260-262,311-340`). There is no `status`, `log`, `is-delivering`, or `last-message` form.
- **`--json` is a global flag.** The CLI parses `--json`, `--verbose`, and `--pretty` at the root (`packages/cli/src/index.ts:434,549`), so a new subfamily inherits envelope output without a new flag.
- **Commands never choose an exit digit.** A command definition projects its data to a projection class (`exitProjection`) and the projection module owns the digits 0/1/2; the only permitted numeric exit sites are the CLI projection module and the MCP lifecycle (`scripts/checks/exit-code-literals.ts:1-26`). The dispatch definition already projects data-driven answers — `attempts` to `success`, an unmet handover to `user-validation` and a recorded flip to `success` (`commands/dispatch.ts:274-289`).
- **The attempt read side is the read-only-precedent.** `dispatch attempts` performs zero appends and zero fence acquisitions, resolves identity with persistence disabled so the checkout marker is never created or repaired, and reports an empty history as success (`feature-dispatch-engine.md:493-504`).
- **The lane record deliberately carries no content.** "No prompt, transcript, diff, credential, or provider payload" (`feature-dispatch-engine.md:218-220`, `contracts/dispatch.ts:587-593`), and the attempt record's evidence vocabulary is bounded to 16 identifier-only references (`contracts/dispatch.ts:554`).
- **Nothing persists per-ref session output in the typed path.** The production dispatch observes the session through the streaming spawn seam's line iterable (`packages/core/src/contracts/harness.ts:391-433`), and the opencode adapter already exposes a per-session observation side-channel — `telemetrySinkFor({ workItemRef })`, "ingest observes the decoded frames beside the delivered drain; an absent sink keeps the delivered stream behavior exactly … an ingest failure never changes the delivery's outcome" (`packages/adapters/src/harness/opencode.ts:93-103`). No equivalent sink writes a per-ref stdout artifact.
- **The session port has no transcript read.** The closed session port exposes spawn, deliver, resume, collect, classify, liveness, listSessions, and the additive optional `terminate` (`contracts/harness.ts:478-507`); `HarnessEvidence` carries completion/exit facts only and no assistant text (`harness.ts:206-215`). The adapters already read persisted session storage read-only for telemetry — the opencode message store and Claude Code transcript files with a declared per-file byte and line cap (`packages/core/src/contracts/harness-telemetry.ts:272-275`) — so the storage and the read-only posture exist; no shared read returns the final assistant message.
- **The typed envelope's `lastMessage` is a synthesized sentence.** It is the derivation's bounded summary (for example `harness evidence unreadable (…)` or `liveness stalled; …`) bounded to 512 characters (`contracts/dispatch.ts:379-380,551`; `packages/core/src/app/dispatch.ts:1146,1217,1236`). It is not the PM's final message.
- **Per-ref session output lives outside the store today and only for the shell lane.** The shell writes PM stdout to `tmp/deliver-ticket/<ref>.pm.out`, the final message to `.ai/local/delivery/<ref>.last-message`, the delivering marker to `.ai/local/delivery/delivering`, and PID files to `.ai/local/delivery/<REF>.pid` (`scripts/deliver-ticket.sh:1735,1755,1858-1868,793-810`).
- **The shell parity contract for the four queries is explicit.** `cmd_is_delivering` exits 0 when a delivery is in progress and prints nothing, with self-healing of a stale PID file (`deliver-ticket.sh:2131-2158`); `cmd_status` always exits 0 and prints `delivering`, `ref`, `pid`, `session_id`, `stale`, `delivering_marker`, where `stale=yes` means the PID file exists but its owner is dead (`deliver-ticket.sh:2164-2212`); `cmd_log` prints `tail -n` of the wrapper log with default 50 (`deliver-ticket.sh:2217-2242`); `cmd_last_message` prints the stored message and returns non-zero when nothing is stored (`deliver-ticket.sh:2252-2260`).
- **The owner probe is a start-time-tolerant liveness check.** The shell requires the recorded process to be alive, to match the script and working tree, and to have started within `PID_START_TOLERANCE_SECONDS = 5` of the recorded epoch, so a reused process id is rejected (`deliver-ticket.sh:637`, `owner_pid_if_live`).
- **The state layer keeps content out of the ledger and has a precedent for sidecar artifact families.** The store layout lists the ledger, header, index, fence, derived documents, and beside them the retro-evidence sidecar and the `ceremony-artifacts.<workspace>/` family, described as living "beside the ledger outside the store's record set" (`doc/spec/features/feature-state-layer.md:92,104-116`).
- **The operator routine does not yet name the typed queries.** `doc/guides/engine-first-operations.md` covers the daily dispatch/verify/merge loop, the gate, the flip, and the shell fallback; the four per-ref queries are absent, while the CEO prompt still names the shell forms (`/home/juliusz/git/jaiship/jaiship-gh-354/.opencode/agent/ceo.md:146-158,273,289-294`).
- **The milestone split is decided.** GH-347 records NG-1 and §7.3 deferring the operator surface to this change (`doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md:107,246`); the M4 backlog row requires per-ref status, a bounded per-ref log, the is-delivering query, last-message from the persisted transcript, and per-ref harness-output persistence (`doc/planning/oss-tooling/milestones/m4/backlog.md:46-53`); the flip plan places F1b after F1a and records that only `status` and `is-delivering` gate the F6 evidence window (`doc/planning/oss-tooling/milestones/m4/flip-plan.md:47,52,104-107`).

### 2.2 Pain Points / Gaps

- **PG-1 — No typed per-ref state query.** An operator or the CEO cannot ask the typed lane whether a ref is being delivered, by which owner, under which session, or with what last outcome; the durable lane record is inspectable only by reading the store.
- **PG-2 — The shell is the only inspection path.** Answering any of the four questions requires `scripts/deliver-ticket.sh`, whose marker/PID/stdout files are a second truth source the typed path never writes.
- **PG-3 — `stale` has no typed meaning.** The shell derives staleness from a PID-file-plus-liveness probe and silently repairs the file; the durable lane has an advisory owner but no read that says whether that owner is still the owner.
- **PG-4 — No per-ref session output survives a dispatch.** Nothing persists the harness's per-ref stdout, so a failed or stalled typed dispatch leaves no bounded tail to read, and a restart loses the previous iteration's output.
- **PG-5 — No typed access to the PM's final message.** The only typed "message" is a classifier-family sentence on the envelope, so an operator cannot tell a blocker explanation from an engine summary.
- **PG-6 — No boolean in-flight query for scripts.** The CEO loop's "is the CEO blocked on a delivery" check has no typed equivalent, and an exit-code-only convention is unreadable to a JSON consumer.

## 3. PROBLEM STATEMENT

Because the typed dispatch lane exposes no per-ref inspection surface and persists no per-ref session output, an operator or the CEO agent cannot ask `status`, `log`, `is-delivering`, or `last-message` of a typed delivery — live, finished, or absent — without falling back to `scripts/deliver-ticket.sh` and its marker/PID/stdout files, so the shell lane cannot stop being the operator's inspection path and the F6 evidence window cannot be gated on typed `status`/`is-delivering`, even though the durable lane that answers those questions already exists.

## 4. GOALS

- **G-1**: `dispatch status <ref>` answers a complete, honest per-ref state for a live dispatch, a finished dispatch, and a ref with no lane, from the durable lane record alone.
- **G-2**: `dispatch log <ref> [--tail <n>]` answers a bounded, reference-scoped tail of the harness output a dispatch persisted for that ref, and states honestly when nothing was persisted.
- **G-3**: `dispatch is-delivering [<ref>]` answers the in-flight question for one ref and for the repository, with a script-usable exit and a JSON boolean.
- **G-4**: `dispatch last-message <ref>` returns the PM's final assistant message from the persisted session transcript — never a synthesized classifier sentence — and names why it cannot when it cannot.
- **G-5**: The four queries are one command family with the delivered grammar, refusal identities, and `--json` envelope, and they add no token, projection, exit row, record kind, or configuration key.
- **G-6**: The operator read path is read-only and shell-free: zero ledger appends, zero fence acquisitions, zero repairs, zero process starts, and zero reads of any shell-lane artifact.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Lifecycle-state coverage | 4/4 queries answer all three states (live, finished, absent) = 12/12 combinations asserted by data and exit; 0 combinations that require a shell script |
| `status` completeness | 1/1 live answer carries `delivering`, `marker`, `pid`, `sessionId`, `probe`, and the lane facts; 1/1 finished answer carries `lastToken`, `lastOutcome`, and `recordedAt`; 1/1 absent answer carries `marker=absent` with null lane facts |
| `stale` honesty | 100% of active lanes whose owner is confirmed gone report `stale=true` and `delivering=false`; 0 unknown probes reported stale; 0 reused process ids reported live beyond the declared tolerance |
| `log` bound and scope | 1 048 576-byte artifact bound, default tail 50, accepted range 1..500, machine `data` ≤ 65 536 bytes, human ≤ 200 lines and 32 768 bytes; 0 lines from another ref's artifact; 0 unbounded reads |
| `last-message` fidelity | 1/1 answers equal the transcript's final assistant message; 0 answers composed from the derivation or the classifier; 0 session operations (spawn/resume/deliver/collect/terminate/list) per query |
| `is-delivering` contract | 1/1 "in progress" answers exit 0 and 1/1 "not in progress" answers exit 1; 1/1 `--json` answers carry the boolean with no error object; 0 answers derived from a shell marker |
| Read-only posture | 0 ledger appends, 0 fence acquisitions, 0 lane rewrites, 0 identity-marker writes, 0 process starts, 0 network reads across all four queries |
| Shell independence | 0 shell invocations and 0 script-path literals in the new surfaces; a checkout whose shell entry points are absent still answers 4/4 queries |
| Contract invariance | 0 new delivery-result tokens, 0 projection changes, 0 new error-table rows, 0 domain kinds, 0 attempt-record fields, 0 lane-record fields, 0 configuration keys |

### 4.2 Non-Goals

- **NG-1**: No daemon-lane inspection. The four queries read the dispatch-owned lane only; a daemon-supervised delivery is not reported by them (§7.3).
- **NG-2**: No change to the delivery write path: no token, projection, exit, classifier, derivation, restart, stall, or admission behaviour changes.
- **NG-3**: No attempt-record field, evidence identifier, schema version, lane-record field, or record kind is added or changed.
- **NG-4**: No per-ref lane history surface (all records), no cross-ref dashboard, and no change to the top-level `status` digest, the board, or `lanes list`.
- **NG-5**: No shell entry-point deletion, retirement, or modification; no reads of `tmp/deliver-ticket/**` or `.ai/local/delivery/**` by the typed path.
- **NG-6**: No new configuration key, CLI flag beyond the one `--tail` value flag, telemetry row, metric, alert, or event.
- **NG-7**: No merge, closeout, queue, provider-policy, namespace, install, or loop (`loop status/log`) work.
- **NG-8**: No transcript content other than the single bounded final message reaches any output, record, or file written by the engine.
- **NG-9**: No live-provider, live-opencode, or OS-kernel liveness parity claim beyond the declared proof boundary (Appendix C).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Per-ref `status` over the durable lane | The lane is the single typed truth for "is this ref being delivered, by whom, under which session, with what last outcome"; without a read fold an operator must read the store. |
| F-2 | Bounded, reference-scoped `log` | A failed delivery is diagnosed from its output; a tail must be bounded and must never mix two refs. |
| F-3 | `is-delivering` per ref and repository-wide | The CEO loop's single scriptable question is "is a delivery in progress"; it must answer without a marker file and read as a boolean in JSON. |
| F-4 | `last-message` from the persisted transcript | The message that explains a blocker is the PM's final assistant message; a synthesized sentence cannot replace it. |
| F-5 | One command family with `--json` | Four queries with one grammar, one refusal vocabulary, and one envelope keep the operator surface learnable and scriptable. |
| F-6 | Read-only, shell-free operator posture | An inspection surface must not perturb the lane it inspects, must preserve resumability, and must not reintroduce the shell dependency the typed path removed. |
| F-7 | Per-ref harness-stdout persistence | `log` needs a durable, bounded, reference-scoped artifact written during the dispatch, which does not exist today. |

### 5.1 Capability Details

**F-1 — Per-ref `status`.** The query resolves the repository identity of the current checkout with persistence disabled, then folds the newest `dispatch.lane` record for that `(repository, ref)` out of one bounded retained-window read. It answers `delivering`, `stale`, `marker`, `probe`, `pid`, `sessionId`, and the lane facts (`attemptId`, `harness`, `iterationOrdinal`, `restartsConsumed`, `ownerStartedAt`, `lastToken`, `lastOutcome`, `recordedAt`). `marker` is the shell's operator-visible marker name derived from the durable record's state: `active` for an `active` record, `terminal` for a `terminal` record, and `absent` when the ref has no lane in this repository. No marker file is read, written, or invented. `delivering` is true exactly when the newest record is `active` and the advisory probe has not confirmed the owner gone; `stale` is true exactly when the newest record is `active` and the probe reports the owner gone. The probe is tri-state — `live`, `dead`, `unknown` — and an `unknown` probe never asserts staleness: the durable state stands and the reader sees `probe=unknown`. The probe matches a process id with the recorded start instant within a declared 5 000 ms tolerance (the shell's tolerance), so a reused process id is not reported live. A `dead` verdict, and therefore a `stale` answer, is an observation about the advisory owner facts only: the queue lease remains the exclusion mechanism, and the read never rewrites, clears, or repairs the lane, because a stale-but-recorded lane is still the resumable artifact. An absent ref is a successful answer, not a failure. Source: ticket task "per-ref `status` (delivering, pid, session id, stale, marker)"; TDR-0049; `feature-dispatch-engine.md` lane-record section.

**F-2 — Bounded, reference-scoped `log`.** The query reads the per-ref artifact described in F-7 — one file per work-item reference, never a directory scan and never another ref's file — and returns the newest `--tail <n>` lines oldest-to-newest. `--tail` is a canonical decimal in 1..500 with a default of 50 (the shell's default), refused rather than clamped; a value outside the range, a sign, whitespace, or a leading zero is an input refusal. A tail is bounded twice: by the requested line count, and by the delivered machine `data` bound of 65 536 bytes and the declared human bound of 200 lines and 32 768 bytes. When a bound binds, the answer carries one truncation fact naming the scope (`tail` or `bytes`), the bound, and the omitted line count, following the delivered digest convention. A ref whose artifact does not exist — including any lane written before this change — answers `available=false` with the reason `no-log` at exit 0; an artifact that exists but cannot be read answers `available=false` with the reason `unreadable` at exit 1. A dispatch that acquired a session but emitted no stdout answers `available=true` with an empty line list, so "no output" and "no capture" are never conflated. Source: ticket task "per-ref `log` with bounded tail"; shell `cmd_log` parity.

**F-3 — `is-delivering`.** One query with two admissible forms inherited from the shell's `--is-delivering [REF]`: a per-ref form and a repository-wide form with no ref. The per-ref form answers whether that ref's newest lane is active and not stale; the repository-wide form answers whether any ref in the current repository has such a lane and lists up to 20 of them, with one truncation fact when more exist. The answer is a boolean fact, and the exit mirrors the shell: 0 for "in progress", 1 for "not in progress". The JSON form carries the boolean explicitly, so no consumer has to infer the answer from an exit code, and the negative answer is a data-bearing envelope with no error object. A stale active lane does not make the answer true (this is the one deliberate divergence from a naive state fold, and it matches the shell's live-PID semantics). A failed lane-store read is the store's typed failure at that row's projection, never a fabricated "no". Source: ticket task "`is-delivering`/is-delivering query"; the PM-recorded interpretation that both forms are admissible; shell `cmd_is_delivering` parity.

**F-4 — `last-message`.** The query resolves the newest `dispatch.lane` record for the `(repository, ref)`, takes its session identity and harness kind, and reads the harness's own persisted session transcript through one injected, adapter-owned read seam. It returns the final assistant message of that session — the PM's final message — bounded to 512 characters, flattened to a single line, and passed through the delivered serialization redaction chokepoint. It never composes a sentence: it reads no attempt record, no derivation payload, and no envelope field, and it performs zero session operations (no spawn, resume, deliver, collect, terminate, or listing), so reading a message can never start, resume, or disturb a delivery. The answer declares finality: `final` is true exactly when the lane's newest record is `terminal`; on an `active` lane the answer is the latest assistant message observed so far and is declared not final, so an in-flight message is never presented as a conclusion. The fallback ladder is closed and ordered: no lane → `no-lane`; the lane's harness declares no transcript read → `capability-gap`; the session is unknown to the harness storage → `session-unknown`; the transcript holds no assistant message → `no-message`; the storage cannot be read → `unreadable`. Every negative answer is a data-bearing envelope with the reason and exit 1; an unreadable lane store keeps its delivered `state.*` failure identity; no new error identity is introduced for any ladder step. Source: ticket task "`last-message` from the persisted session transcript"; ticket AC "returns the PM's final message rather than a classifier sentence"; shell `cmd_last_message` parity.

**F-5 — One command family with `--json`.** The four forms join the existing dispatch family rather than creating a top-level command: `dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`, `dispatch is-delivering [<ref>]`, `dispatch last-message <ref>`. The reference is the family's canonical `[A-Z]+-\d+` shape; an undeclared flag is `fallback.invocation` (the family's delivered guard), and a malformed or missing ref, an unexpected extra positional, or an invalid `--tail` value is `input.value.rejected`, each decided before any runtime call and therefore before any store read. Each answer carries one declared discriminator (`query`) and is available as human key=value output and as the standard machine envelope through the global `--json`; no query emits a delivery `result` token, appends an attempt record, or writes a lane record, so an inspection never changes what a later dispatch or attempt read reports. A surface that is not composed refuses `input.value.rejected` rather than crashing, following the delivered uncomposed-subfamily pattern. Source: ticket task "wire all four into one command family with `--json`"; delivered family grammar.

**F-6 — Read-only, shell-free operator posture.** All four queries resolve the repository identity with persistence disabled, perform at most one bounded lane-ledger read over the retained window and at most one bounded artifact or transcript read, take no fence, append nothing, start no process (the owner probe only observes the process table through the injected seam), and make no network call. They read no shell-lane artifact: the delivering marker, PID files, `<REF>.pm.out`, `<REF>.last-message`, and the wrapper log are neither read nor written, so the shell's files can never become a second answer for a typed dispatch, and the typed answer is unaffected by their presence, absence, or content. The new read surfaces join the declared dispatch-flow list the no-shell invariant scans, and a planted shell reference in them fails by name. Source: ticket AC "no shell script is read or executed"; TDR-0049 C-4; `feature-dispatch-engine.md` no-shell and read-only-posture sections.

**F-7 — Per-ref harness-stdout persistence.** During a dispatch, the engine writes the harness's per-ref stdout stream to one artifact per work-item reference: the artifact is created at session acquisition (the same point as the active lane append) and appended as the session streams, so iterations and restarts of one dispatch accumulate one history and a second dispatch for the same ref appends to the same artifact rather than replacing it. The artifact is append-only, capped at 1 048 576 bytes, trimmed from the front at a line boundary so the newest content always survives and a partial line is never kept, `0600`, inside the dispatch project state root and outside the delivery store's record set, derived-document set, salvage path, and repair path — the delivered sidecar-artifact pattern. Writing is an observation beside the delivered stream drain: it never blocks the drain, and a write failure never changes the delivery token, the exit, the attempt record, or the lane record, and adds no evidence identifier. The only payloads this change persists are harness stdout (this artifact) and the boundedly read final assistant message (never written by the engine); no prompt, diff, credential, tool argument, or provider payload is written by the engine, and the artifact never enters the ledger, a record, an evidence reference, or an envelope beyond the tail the operator asked for. Source: ticket task "persist harness stdout per ref during a dispatch"; backlog row M4-S12 "persist harness output per ref"; the delivered `telemetrySinkFor` observation seam and the state layer's sidecar-artifact pattern.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Operator inspects a live dispatch
  dispatch status GH-354
    → resolve identity (persistence disabled) → one bounded lane read
    → newest dispatch.lane for (repository, GH-354) = active
    → advisory owner probe on {processId, startedAt} → live, unknown, or dead
    → answer: delivering=true, marker=active, pid, sessionId, harness, iteration, restarts, probe
    → exit 0 (absent ref is also exit 0, with marker=absent)
```

```
Flow 2: CEO gates on a live delivery
  dispatch is-delivering GH-354        → exit 0 / 1, delivering=true/false
  dispatch is-delivering --json        → refs=[…] over this repository, exit 0 / 1
    → no marker file read; a stale active lane answers false
```

```
Flow 3: Diagnosing a failed dispatch
  dispatch log GH-354 --tail 200
    → read dispatch-logs/<GH-354>.out (one ref, no scan)
    → newest 200 lines oldest→newest, or truncation=bytes/… when a bound binds
    → no artifact → available=false, reason=no-log, exit 0
    → unreadable artifact → available=false, reason=unreadable, exit 1
```

```
Flow 4: Reading the PM's final message
  dispatch last-message GH-354
    → newest lane for the ref → sessionId, harnessKind
    → adapter-owned transcript read (read-only, no session operation)
    → final assistant message, 512 chars, one line, redacted; final=true iff lane terminal
    → otherwise one closed reason (no-lane | capability-gap | session-unknown | no-message | unreadable), exit 1
```

```
Flow 5: A dispatch persists its own log
  dispatch GH-354
    → acquire session → append active lane + create/append dispatch-logs/<GH-354>.out
    → stream drain observes lines → sink appends (non-blocking; failure changes nothing)
    → classification → terminal lane record; the artifact keeps the delivery's output
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The four query forms, their grammar, their refusal identities, their human and `--json` payloads, and their exit projections.
- The lane-view fold over the durable `dispatch.lane` record, including repository scoping and the absent-ref answer.
- The tri-state advisory owner-liveness probe and the declared start-instant tolerance.
- The bounded per-ref harness-stdout artifact family, its write points, its trimming bound, its posture, and its privacy boundary.
- The injected adapter-owned transcript read seam and the `last-message` fallback ladder.
- The read-only, shell-free operator posture across all four queries and the extension of the no-shell invariant to them.
- The dispatch composition seams the queries need (lane view, artifact tail, delivering fold, transcript read, owner probe) and the production supply of each.
- The decision log for the four-query interpretation, the marker derivation, the staleness rule, the log artifact, the transcript source, the exit projections, the read-only posture, and the scope boundaries.

### 7.2 Out of Scope

- [OUT] Daemon-lane inspection: `dispatch status`/`is-delivering` do not report a lane supervised by the resident daemon.
- [OUT] Any change to delivery semantics: result tokens, projection classes, exits, classifier, derivation, admission, restart, stall handling, or spawn identity.
- [OUT] Any attempt-record field, evidence identifier, schema version, record kind, or `dispatch.lane` field.
- [OUT] Per-ref lane history (all records), a cross-ref operator dashboard, and any change to the top-level `status` digest, `brief`, `board`, or `lanes list`.
- [OUT] Reading, writing, repairing, or deleting any shell-lane artifact (`tmp/deliver-ticket/**`, `.ai/local/delivery/**`), and any shell entry-point change.
- [OUT] New configuration keys, new flags beyond `--tail`, new telemetry rows, metrics, alerts, or events.
- [OUT] The CEO loop's own `loop status`/`loop log` surface (M4-S10), merge/closeout/queue/provider-policy work, and installed-binary work.
- [OUT] Live-kernel process-list parity beyond the declared probe contract and the offline proof boundary.

### 7.3 Deferred / Maybe-Later

- **Daemon-lane answers.** Reporting a daemon-supervised delivery from the same four queries needs a read-side agreement across two record owners (the dispatch lane and `daemon.lane`). TDR-0049 already names "a future shared lane-resolution implementation spanning one-shot and daemon lanes" as a revisit trigger; this change keeps the query surface dispatch-lane-only and defers the shared read. Owner: `@decision-advisor` if a daemon-driven delivery needs the operator surface.
- **Per-ref lane history.** "Show me every lane record for this ref" (iterations, restarts) rather than the newest: TDR-0049's unresolved question about lane history. Revisit when a restart-timeline question cannot be answered from the attempt record and the log artifact.
- **A phase-ledger position on the `status` payload.** TDR-0049's open question about carrying the phase position on the lane. This surface does not need it: the ledger remains the resume-position source, and adding a field would be a payload-schema decision under `delivery.dispatch.lane.v1` key-set rules.
- **Tunable bounds.** The log artifact bound, the tail range, and the probe tolerance are declared policy constants; a configuration key is added only if an operator need to tune them appears (the shell exposed `LOG_LINES` for the same reason the typed tail flag exists).
- **Redaction-at-write for the log artifact.** The artifact is the harness's own stream, operator-local and `0600`; a scrubbing pass at write time would alter the evidence an operator is trying to read. Revisit if the artifact ever leaves the local state root.
- **Log rotation by date or size generations.** Today one ref has one bounded artifact; rotating would break "reference-scoped" and complicate the tail contract.
- **Extending the surface to `batch-deliver`-style multi-ref views.** Out of scope for one milestone story.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound or outbound HTTP endpoint is added, changed, or removed. The interfaces are the command family, its payloads, and the injected seams:

| ID | Surface | Contract |
|----|---------|----------|
| API-1 | `dispatch status <ref> [--json]` | Answers the newest `dispatch.lane` record for `(resolved repository, ref)`: `delivering`, `stale`, `marker` (`active`\|`terminal`\|`absent`), `probe` (`live`\|`dead`\|`unknown`\|`not-applicable`), `pid`, `sessionId`, and the lane facts (`attemptId`, `harness`, `iterationOrdinal`, `restartsConsumed`, `ownerStartedAt`, `lastToken`, `lastOutcome`, `recordedAt`) or a null lane. Exit 0 whenever the reads succeed, including the absent answer; a failed lane-store or identity read is a typed failure at its row's projection. Zero appends. |
| API-2 | `dispatch log <ref> [--tail <n>] [--json]` | Answers `available`, the newest `n` lines oldest-to-newest, and at most one truncation fact (`scope` `tail`\|`bytes`, `bound`, `omittedLines`). `n` is a canonical decimal in 1..500, default 50, refused rather than clamped. Scoped to that ref's artifact only. `available=false` with `reason` `no-log` (exit 0) or `unreadable` (exit 1). Zero appends. |
| API-3 | `dispatch is-delivering [<ref>] [--json]` | Answers `delivering` for the ref, or for the repository with up to 20 delivering refs and one truncation fact. Exit 0 for in progress, 1 for not in progress; the JSON answer carries the boolean with no error object. A failed lane-store read keeps its typed identity. Zero appends. |
| API-4 | `dispatch last-message <ref> [--json]` | Answers `available`, `final`, `message` (bounded to 512 characters, single line, redacted), `truncated`, `recordedAt`, and one closed `reason` when unavailable (`no-lane`\|`capability-gap`\|`session-unknown`\|`no-message`\|`unreadable`). Exit 0 when produced, 1 for every closed negative reason, the store's typed failure when the lane store cannot be read. Performs zero session operations. |
| API-5 | Grammar and refusal contract | The canonical reference is `[A-Z]+-\d+`. An undeclared flag is `fallback.invocation`; a missing or malformed ref, an unexpected positional, and an invalid `--tail` value are `input.value.rejected`; each is decided before any runtime call. An uncomposed query surface is `input.value.rejected`, never a crash. Each answer carries exactly one `query` discriminator (`status`\|`log`\|`is-delivering`\|`last-message`). |
| API-6 | Lane-view read contract | One bounded retained-window read of kind `dispatch.lane`, schema `delivery.dispatch.lane.v1`, prefix `dispatch.lanes:`, folded to the newest record per ref and filtered to the resolved repository. Daemon lanes contribute nothing. An unreadable fold is the store's typed failure, never an empty answer. Identity resolves with persistence disabled, so no checkout marker is created, repaired, or re-persisted. |
| API-7 | Log artifact read contract | One per-ref artifact read, bounded to the requested tail and the declared byte bound. No directory scan, no glob across refs, no shell read. An absent artifact and an unreadable artifact are distinct answers. |
| API-8 | Per-session stdout observation seam | The dispatch composition supplies a per-ref sink built once per spawn that observes the same stdout lines the delivered drain observes. It appends to the ref's artifact and never blocks the drain; an absent sink keeps the delivered behaviour exactly; a sink failure never changes the delivery token, exit, attempt record, or lane record and adds no evidence identifier. |
| API-9 | Transcript read seam | An injected, adapter-owned, read-only read: given a harness kind, a session identity, and a work-item reference, it returns the session's final assistant message bounded to 512 characters single-line or one closed absence (`capability-gap`, `session-unknown`, `no-message`, `unreadable`). It takes no live handle, performs no session operation, spawns nothing, and administers nothing on a live session store. |
| API-10 | Owner-liveness probe seam | An injected advisory probe: given `{ processId, startedAt }`, it returns `live` when a process with that identity exists and its observed start instant is within the declared 5 000 ms tolerance of the recorded instant, `dead` when it is confirmed absent or outside the tolerance, and `unknown` when the process table cannot be read. It is advisory only: no admission, exclusion, or resumability decision reads it. |
| API-11 | Query exit projection | The query payloads project through the command definition's data projection: `status` → `success`; `is-delivering` → `success` when delivering, `user-validation` when not; `log` → `success` for a produced tail or `no-log`, `user-validation` for `unreadable`; `last-message` → `success` when produced, `user-validation` for every closed negative reason. No error-table row and no delivery-result token is involved. |
| API-12 | No-shell and no-script contract (extended) | The four query surfaces and the log sink are added to the declared dispatch-flow surface list the no-shell invariant scans. A script-path literal, a shell-capable child-process use, or a shell invocation in those surfaces fails the invariant by name. No query reads a shell-owned artifact path. |

### 8.2 Events / Messages

No event, message, or telemetry record is added. The four queries append no durable record and publish no event; their invocation is recorded only by the delivered command audit ledger entry that every command invocation already produces. The log artifact and the transcript read are data reads and not records. The delivery path's existing event and record families are untouched.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Lane view (derived) | A read-only fold over `dispatch.lane`: the newest record per ref, filtered to the resolved repository, joined with the advisory probe verdict. Derivation only — no new record kind, no new field on the lane record, and no rewrite. `marker` mirrors `state` (`active`/`terminal`) and adds `absent` for "no record". `delivering` = `active` and probe ≠ `dead`; `stale` = `active` and probe = `dead`. |
| DM-2 | Per-ref harness-stdout artifact family | `dispatch-logs.<workspace>/<REF>.out` beside the ledger, outside the store's record set, derived-document set, salvage path, and repair path: one file per work-item reference, created at session acquisition, appended while the session streams, `0600`, capped at 1 048 576 bytes and trimmed from the front at a line boundary, retained until trimmed by that bound. It is not a state record and never enters any record, evidence list, envelope, or derived document. |
| DM-3 | Transcript read seam | An injected adapter-owned read of the harness's persisted session storage returning the final assistant message (≤ 512 characters, single line) or one closed absence. It is a read seam, not a member of the closed harness session operation set: it takes no handle and performs no operation, so the delivered operation set, capability declaration, and adapter conformance parity are unchanged. |
| DM-4 | Owner-liveness probe facts | Closed verdicts `live`\|`dead`\|`unknown` from `{processId, startedAt}` with a declared 5 000 ms start-instant tolerance (the shell's `PID_START_TOLERANCE_SECONDS`). Advisory only; never an exclusion, admission, or resumability input, and never persisted. |
| DM-5 | Query payloads | Four data payloads, each with the `query` discriminator: `status` (`ref`, `repository`, `delivering`, `stale`, `marker`, `probe`, `pid`, `sessionId`, `lane` \| null); `log` (`ref`, `available`, `reason?`, `tail`, `lines[]`, `truncation?`); `is-delivering` (`delivering`, `repository`, `ref` \| null, `refs[]?`, `truncation?`); `last-message` (`ref`, `available`, `final`, `reason?`, `message` \| null, `truncated`, `recordedAt` \| null). No payload carries a delivery `result` token. |
| DM-6 | Declared bounds and constants | Log artifact 1 048 576 bytes; tail default 50, range 1..500, canonical decimal; machine `data` 65 536 bytes; human log output 200 lines and 32 768 bytes; `last-message` 512 characters single line (the delivered `DISPATCH_MAX_LAST_MESSAGE_CHARS`); delivering-ref list 20; owner start tolerance 5 000 ms; lane retained window 5 000 records. All are declared policy constants; no configuration key is added. |
| DM-7 | Exit and identity posture | The four payloads project to `success` or `user-validation` through the delivered data projection (API-11). No error-table row, domain kind, delivery-result token, or projection class changes, and `state-unverified` keeps exit 2. The `unreadable` artifact and transcript answers are data facts at exit 1, never new identities. |

### 8.4 External Integrations

Two local reads are added and no network integration is touched: the opencode persisted session store (read-only, bounded; the delivered telemetry capture already reads it with a query-only pragma) and Claude Code per-session transcript files (read-only, bounded by the delivered per-file byte and line caps). Both are local, adapter-owned, and absent from the offline battery, which injects the transcript seam. Live provider reads, credentials, and tracker access are untouched: no query resolves a credential, makes a network call, or performs a tracker read.

### 8.5 Backward Compatibility

- **Delivery behaviour unchanged.** No token, projection, exit, classifier, derivation, admission, restart, stall, or spawn fact moves. A dispatch invocation and its envelope are byte-identical to the delivered contract apart from the log artifact's side effect on local disk.
- **Lane and attempt records unchanged.** `dispatch.lane` keeps its kind, schema, fields, states, write points, and latest-wins read; `dispatch.attempt` keeps its schema version, field set, and 16-reference evidence budget. Pre-change records read unchanged and need no migration.
- **Pre-change lanes answer honestly.** A ref whose lane was written before this change has no log artifact, so `log` answers `no-log`; its lane record still answers `status`, `is-delivering`, and (through the transcript) `last-message`. Nothing is fabricated or backfilled.
- **Grammar additive.** Four new forms and one new value flag (`--tail`) are added to the dispatch family; the four delivered forms, the `attempts` subfamily's own refusal convention (unknown option → `input.value.rejected`), and `--resume-prompt` semantics are unchanged.
- **Exit convention declared.** `is-delivering` returns 1 for "not in progress" and `last-message` returns 1 for "no message", mirroring the shell's 0/non-zero contract. Because 1 is also the `user-validation` exit, every negative answer carries its fact in the payload (and in `--json`), and the reference page states the convention explicitly. This is a declared, documented divergence from "a non-zero exit always means a refusal" and it follows the delivered handover precedent where a readable-but-unmet bar projects `user-validation`.
- **Human-output shape for one query differs deliberately.** `dispatch log` human output is the raw tail (followed by at most one `truncation=` line), because a log rendered as key=value would not be a log; the family's other forms stay key=value. `last-message` human output is the declared key set (`available`, `final`, `reason`, `last_message`) rather than the shell's bare message line, so the family keeps one human convention while the message remains machine-extractable.
- **Shell lane untouched.** The shell keeps its files, its queries, its exits, and its self-healing behaviour. The typed path neither reads nor writes them, so a repository in `dual-run` can use both surfaces without either becoming a second truth source for the other.
- **Stale is not repaired.** The shell clears a stale PID file; the typed read does not touch the lane, because the lane is the resumable artifact and a read must not destroy resumability. An operator who wants the ref re-dispatched relies on the queue lease and the lane's own state, not on a repair side effect.
- **Documentation moves with the contract.** The current-truth dispatch page, the autonomous-delivery page, the engine-first operations guide, and the command reference page are reconciled in the documentation phase (Appendix A); no page is left saying the typed path has no status/log surface.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Bounded reads | Each query performs at most 1 lane-ledger read over the retained window (≤ 5 000 records), at most 1 artifact or transcript read, 0 network reads, 0 session operations, and 0 process starts |
| NFR-2 | Read-only posture | 0 ledger appends, 0 fence acquisitions, 0 lane rewrites, 0 identity-marker writes, 0 shell-artifact reads or writes across all four queries and both `is-delivering` forms |
| NFR-3 | Log bounds | Artifact ≤ 1 048 576 bytes trimmed at a line boundary; tail default 50, accepted 1..500 canonical decimal; machine `data` ≤ 65 536 bytes; human ≤ 200 lines and 32 768 bytes; every bound that binds is declared by one truncation fact |
| NFR-4 | Reference scoping | 0 lines from another ref's artifact and 0 lanes from another repository in any answer; `absent` is returned rather than a foreign record |
| NFR-5 | Contract invariance | 0 new delivery-result tokens, 0 projection changes, 0 new error-table rows, 0 domain kinds, 0 attempt-record fields, 0 lane-record fields, 0 configuration keys; `state-unverified` stays exit 2 |
| NFR-6 | No shell dependency | 0 shell invocations and 0 script-path literals or shell-owned artifact paths in the new surfaces; a checkout with the shell entry points absent answers 4/4 queries |
| NFR-7 | Determinism | The offline battery performs 0 live network calls, 0 live child-process starts, and 0 live process-table reads; two consecutive runs produce identical payloads and exits for all 12 lifecycle-state combinations |
| NFR-8 | Message fidelity and bounds | `last-message` equals the transcript's final assistant message; ≤ 512 characters, single line, redacted, `truncated` true exactly when cut; 0 answers composed from the derivation or classifier |
| NFR-9 | Staleness honesty | `stale` is reported only for an active lane whose owner is confirmed gone; an `unknown` probe never reports stale; a process id whose start instant is outside the 5 000 ms tolerance is `dead`; 0 unrelated process ids reported live |
| NFR-10 | Query latency budget (offline reference store) | Each query answers within 1 000 ms over the 5 000-record retained window on the reference test store, with the declared read counts of NFR-1 |
| NFR-11 | Privacy of persisted payloads | The only persisted payloads are harness stdout (bounded, `0600`, local state root) and the boundedly read final message (never written by the engine); 0 prompts, diffs, credentials, tool arguments, or provider payloads written by the engine |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The durable `dispatch.lane` record is the observability surface for per-ref state and becomes operator-visible through `status`; it gains no field.
- The per-ref log artifact is an operator debugging artifact, not telemetry: it is not a record, has no retention schedule beyond its own bound, and is not read by any evaluator, gate, summary, or fleet row.
- No new metric, alert, event, telemetry row, or derived document is introduced. The command audit ledger records the invocation as delivered for every command.
- `last-message` reads the harness transcript and writes nothing; no transcript content is copied into any record, evidence list, log line, or derived document.
- The probe verdict is reported in the answer (`probe`) and is never persisted, so a stale observation cannot become durable truth.
- An operator can distinguish "no capture" (`no-log`) from "no output" (available, empty) and "cannot read" (`unreadable`) without inspecting files.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Staleness is misreported (reused process id reported live, or a live owner reported dead on an unreadable process table) | M | M | Tri-state probe; 5 000 ms start-instant tolerance; `unknown` never asserts staleness; every verdict names `probe`; the answer is advisory and never an exclusion input | M |
| RSK-2 | The log artifact grows unbounded or persists sensitive content | H | M | 1 048 576-byte cap trimmed at a line boundary; one file per ref; `0600`; local state root outside the ledger; never committed, never in a record or envelope; engine writes only harness stdout; declared in the privacy and security sections | L |
| RSK-3 | Exit 1 for "not delivering" or "no message" is read as a failure by a scripted consumer | M | M | The fact is always in the payload; `--json` carries the boolean and the reason; the reference page states the convention; the convention mirrors the shell contract it replaces | M |
| RSK-4 | `last-message` returns a synthesized sentence or the wrong message | H | L | The source is the transcript seam only; the query reads no attempt record or derivation; AC-F4-2 asserts the distinction by construction; `final` prevents an in-flight message being read as a conclusion | L |
| RSK-5 | A read path writes, repairs, or clears state and destroys resumability or creates the identity marker | H | L | Declared read-only posture; identity resolution with persistence disabled; no repair on stale; zero-append and zero-marker ACs; the shell's self-healing is deliberately not ported | L |
| RSK-6 | An adapter cannot read a transcript, so `last-message` is unavailable on one harness | M | M | Capability-declared seam with a closed `capability-gap` reason, exit 1, and documentation; the other three queries are unaffected | M |
| RSK-7 | A pre-change lane or a crashed dispatch leaves no log and the operator reads "no log" as "nothing ran" | M | M | `available=false` with `reason=no-log`; `status` still answers the lane; documented; the artifact is created at acquisition so a crash mid-session leaves a partial artifact rather than nothing | M |
| RSK-8 | Scope creeps into daemon lanes, the loop surface, the status digest, or delivery semantics | M | M | Explicit non-goals; the query surface reads one record kind; no record, token, projection, or flag change | L |
| RSK-9 | Additive contract churn breaks pinned inventories (help entry count, adapter parity, coverage inventory) | M | L | Additive forms only; the help entry assertion moves with the four entries; the coverage inventory and page paths are unchanged; no session operation is added | L |
| RSK-10 | The shell and the typed surface drift into two answers with different meanings | M | L | The typed surface reads no shell artifact and the shell keeps its own; the doc phase states the typed semantics and the shell's retained fallback role | M |
| RSK-11 | The offline battery proves fixtures, not live storage | M | M | The proof boundary is declared (Appendix C); the battery injects the probe, the transcript seam, and the artifact path, and asserts the contract rather than the world | M |

## 12. ASSUMPTIONS

- The durable `dispatch.lane` record is the authoritative typed per-ref state and its latest-wins read is sufficient to answer `status` and `is-delivering`; no additional durable fact is required.
- The owner process facts are advisory; the queue lease remains the exclusion mechanism, and no query may derive an exclusion or admission decision from them (TDR-0049 C-1/C-6).
- A stale active lane is still resumable, so a read must not repair it; the shell's PID-file self-healing is a shell-file concern that does not transfer to a durable record.
- The harness session outlives its process, so a finished lane's session identity still resolves a transcript; a failure to resolve one is an honest negative answer.
- Both delivery adapters either can read their own persisted session storage or can declare the absence; the seam is capability-declared and the absence is a closed reason, not a crash.
- Harness stdout is the operator's diagnostic payload and may be persisted locally without redaction, matching the shell's existing `tmp/` capture; the artifact never leaves the local state root.
- The delivered retained-window bound (5 000 records) is an adequate scan bound for the repository-wide `is-delivering` form; refs beyond the window are indistinguishable from absent refs, which is the same trade the attempt read side already makes.
- `--json` is a global flag, so no per-command envelope work is required beyond a valid payload.
- The four queries are the complete F1b scope; `log` and `last-message` may land after `status` and `is-delivering` (flip-plan F6 gating), but the change delivers all four.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-347 (F1a) durable `dispatch.lane` record and its latest-wins read | Delivered; the data source for `status` and `is-delivering` |
| Depends on | Delivered per-ref lane append points (session acquisition and terminal classification) | The artifact is created at the same acquisition point |
| Depends on | Dispatch project state root and the repository identity resolver (persistence-disabled mode) | Delivered by the attempt read side |
| Depends on | Harness adapters' persisted session storage and their read-only telemetry posture | The transcript seam's implementation home |
| Depends on | Dispatch command family, its help entries, and the prompt-required reference page | Four forms and one flag are added |
| Depends on | `check:no-shell` declared dispatch-flow surface list | The new surfaces join it |
| Depends on | Dispatch conformance fixtures and the offline battery | Extended for the 12 lifecycle-state combinations |
| Blocks | F6 (GH-352) evidence-window gating | F6 needs `status` and `is-delivering` before the window starts (`flip-plan.md:107,120`) |
| Blocks | Retirement of the shell lane's operator role | The shell cannot stop being the inspection path until the typed surface answers all four queries |
| Related | M4-S10 (GH-348) `loop status`/`loop log` | A sibling surface; the artifact-family and read-only conventions decided here are its precedent, not its implementation |

## 14. OPEN QUESTIONS

No question blocks this change. Every contract-level fork is settled by a recorded decision in section 15: the four-query reading and the two `is-delivering` forms (DEC-1), the `marker` derivation and the staleness rule (DEC-2), the log artifact family and its bounds (DEC-3), the transcript source and the fallback ladder (DEC-4), the exit projections (DEC-5), the read-only posture and shell independence (DEC-6), the composition seams (DEC-7), the bounds policy (DEC-8), and the scope boundaries (DEC-9). Implementation-decided details are listed in Appendix D and do not reopen any decision.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None | All forks are decided; the remaining details are adapter- or fixture-decided (Appendix D). | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | **One family, four queries, two `is-delivering` forms.** Deliver `dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`, `dispatch is-delivering [<ref>]`, and `dispatch last-message <ref>`, each with `--json`, inside the existing dispatch family. `is-delivering` keeps both the per-ref and the ref-less form. | The ticket names one command family and an `is-delivering`/is-delivering query; the shell's `--is-delivering [REF]` is the parity reference and the CEO loop consumes the ref-less form, so both must answer. A new top-level command would add a family, a help page, and a discovery path for four read queries about one record kind. | 2026-11-19 |
| DEC-2 | **Marker from the lane state; staleness from the advisory probe.** `marker` is the durable record's state (`active`/`terminal`) plus `absent`; no marker file is introduced or read. `delivering` = active and probe ≠ dead; `stale` = active and probe = dead; the probe is tri-state and `unknown` never asserts staleness; a read never repairs the lane. The probe matches a reused process id with a 5 000 ms start-instant tolerance. | TDR-0049 makes the lane the single resumable-state artifact; a second marker file would be a second truth source. Staleness is what an operator needs and what the shell answered with a live-PID probe, so it must be answered from durable state plus an advisory observation — never by repairing the record, because a stale lane is still resumable. The tolerance is the shell's own PID-reuse guard. | 2026-11-19 |
| DEC-3 | **A bounded per-ref harness-stdout artifact outside the ledger.** Persist the observed harness stdout to `dispatch-logs.<workspace>/<REF>.out`: one file per ref, created at session acquisition, appended while the session streams, `0600`, capped at 1 048 576 bytes and trimmed at a line boundary, outside the record set, derived documents, salvage, and repair. `log` reads that file only, default 50 lines, range 1..500, refused rather than clamped, with the delivered machine and declared human output bounds. | The ticket requires per-ref harness stdout persistence and a bounded, reference-scoped log; the lane record may not carry content and the ledger is identifier-only, so the artifact must live beside the store — the delivered sidecar pattern. Refusing out-of-range values matches the delivered `--limit` contract; clamping would silently answer a different question. | 2026-11-19 |
| DEC-4 | **`last-message` from the persisted session transcript.** Answer the final assistant message of the recorded session, read through one injected adapter-owned read seam over the harness's own persisted storage (opencode session store; Claude Code transcript files), bounded to 512 characters single-line and redacted, with `final` true exactly for a terminal lane. Ladder: `no-lane`, `capability-gap`, `session-unknown`, `no-message`, `unreadable`. The seam is a read, not a member of the closed harness session operation set; it takes no handle and performs no session operation. | The ticket requires the PM's final message rather than a classifier sentence, from the persisted transcript. Adding a member to the closed operation set would ripple through the capability declaration and adapter conformance parity for a read that needs no live session; a declared read seam keeps the operation set closed and still leaves the storage ownership with the adapter. | 2026-11-19 |
| DEC-5 | **Query exit projections, declared.** `status` projects `success` on every successful read including an absent ref. `is-delivering` projects `success` when in progress and `user-validation` when not. `log` projects `success` for a produced tail or `no-log` and `user-validation` for `unreadable`. `last-message` projects `success` when produced and `user-validation` for every closed negative reason. No error-table row or delivery token is involved, and a failed store read keeps its typed identity. | The shell contract is 0/non-zero for `is-delivering` and `last-message`, and always 0 for `status`; parity is preserved through the delivered data-projection seam (the unmet-handover precedent), while the payload always carries the fact so no consumer depends on the digit. A new error identity would be a contract change the ticket does not ask for. | 2026-11-19 |
| DEC-6 | **Read-only, shell-independent posture.** Every query performs 0 appends, 0 fence acquisitions, 0 lane rewrites, 0 identity-marker writes, 0 process starts, and 0 network calls; identity resolves with persistence disabled; no shell-lane artifact is read or written; the new surfaces join the no-shell invariant's declared surface list. | The attempt read side already established the read-only posture; a status query that repaired a lane would be the one write path in the system that destroys resumability. The ticket's AC requires that no shell script is read or executed, and a typed answer must not become a second reading of the shell's files. | 2026-11-19 |
| DEC-7 | **The composition seam.** The CLI runtime gains four optional read surfaces (lane view with the probe, artifact tail, repository-wide delivering fold, transcript read); the production composition supplies all four, and an uncomposed surface refuses `input.value.rejected`. The CLI imports no shell, no script path, and no `scripts/` module. | The delivered family pattern composes optional read subfamilies and refuses an uncomposed one; keeping the CLI on typed ports preserves the no-shell invariant and lets the offline battery inject every fact. | 2026-11-19 |
| DEC-8 | **Bounds are declared policy constants.** Artifact 1 048 576 bytes; tail 50 default in 1..500; machine `data` 65 536 bytes; human log 200 lines / 32 768 bytes; message 512 characters; delivering-ref list 20; probe tolerance 5 000 ms; lane window 5 000 records. No configuration key is added. | A bound becomes configurable only when an operator need to tune it appears; the shell exposed `LOG_LINES` so offline tests could bound an unbounded `tail`, and the typed equivalent is the `--tail` flag. Adding a key now would be surface without a driver. | 2026-11-19 |
| DEC-9 | **Scope boundaries.** Do not read daemon lanes, do not add lane history, do not touch the top-level `status` digest, `brief`, `board`, or `lanes list`, do not add a delivery token, projection, exit row, record kind, attempt field, or lane field, do not read or modify shell artifacts, and do not add a second flags vocabulary beyond `--tail`. | The milestone story is the per-ref one-shot operator surface. A daemon-lane read is a cross-owner read agreement (TDR-0049 revisit trigger), and a delivery-contract change would turn a read surface into a behaviour change. | 2026-11-19 |

### 15.1 Decision records

No separate decision record is required for DEC-1, DEC-2, DEC-5, DEC-6, DEC-7, DEC-8, or DEC-9; they cite delivered contracts (TDR-0049, TDR-0024's read-side rulings, TDR-0051's capability-gated operation pattern) and are change-local. DEC-3 and DEC-4 introduce the first persisted non-identifier content artifact in the dispatch plane and its read seam; they are recommended for a technical decision record (see the note in section 25.4) and are cited here as change-local decisions until that record exists.

| DEC | Governing record |
|-----|------------------|
| DEC-2 | TDR-0049 — Dispatch-Owned Durable Lane Record (kind, fields, advisory owner facts, latest-wins read) |
| DEC-5 | TDR-0024 — Dispatch attempt read side (read-only posture, data projection of a read answer) |
| DEC-4 | TDR-0051 — Harness `terminate` operation (the capability-gated, declared-seam pattern reused for a read) |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Dispatch command family | Additive: four query forms, one `--tail` value flag, four data payloads, one discriminator, exit projection cases |
| Dispatch lane read side | Additive: an operator lane-view fold (newest per ref, repository-scoped) over the delivered lane read |
| Dispatch engine (write path) | Additive side effect only: a per-ref stdout sink at session acquisition; classification, token, records, and exits unchanged |
| Dispatch composition (CLI edge) | Four optional read surfaces plus the deliverability fold |
| Production composition | Supplies the lane view, the probe, the artifact tail, and the transcript read |
| Harness adapters | A read-only transcript read implementation per kind, or a declared `capability-gap` |
| Dispatch project state root | A new bounded artifact family `dispatch-logs.<workspace>/` beside the ledger |
| Help and reference surfaces | Four help entries and the family entry; one reference page updated; coverage inventory unchanged |
| Conformance fixtures and battery | Extended for 12 lifecycle-state combinations, bounds, scoping, and the read-only posture |
| No-shell invariant | The new surfaces join the declared scan list |
| Current-truth documentation | Reconciled in the documentation phase (Appendix A) |

## 17. ACCEPTANCE CRITERIA

### 17.1 Per-ref `status` (F-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an `active` lane for a ref in the current repository and a probe that reports the owner `live`, **when** `dispatch status <ref>` runs, **then** the answer is `delivering=true`, `marker=active`, `probe=live`, the recorded `pid` and `sessionId`, and the lane facts (`attemptId`, `harness`, `iterationOrdinal`, `restartsConsumed`, `ownerStartedAt`, `recordedAt`), at exit 0. | F-1, API-1, DM-1 |
| AC-F1-2 | **Given** a `terminal` lane for a ref, **when** `dispatch status <ref>` runs, **then** the answer is `delivering=false`, `marker=terminal`, `stale=false`, `probe=live` or `dead` per the observation, and carries `lastToken`, `lastOutcome`, and `recordedAt`, at exit 0. | F-1, API-1, DM-1 |
| AC-F1-3 | **Given** no lane for a ref in the current repository, **when** `dispatch status <ref>` runs in human and in `--json` form, **then** both answer `marker=absent`, `delivering=false`, `stale=false`, `probe=not-applicable`, `pid` and `sessionId` null, and a null lane, at exit 0, with no fabricated lane. | F-1, API-1, DM-1 |
| AC-F1-4 | **Given** an `active` lane whose recorded owner is confirmed gone, **when** `dispatch status <ref>` runs, **then** the answer is `delivering=false`, `stale=true`, `marker=active`, `probe=dead`, **and** the lane record is not rewritten, cleared, or repaired, so a subsequent `--resume-prompt` still resolves it. | F-1, API-1, NFR-2, DEC-2 |
| AC-F1-5 | **Given** a process table that cannot be read, **when** `dispatch status <ref>` runs over an `active` lane, **then** the answer is `probe=unknown`, `stale=false`, and `delivering` follows the durable active state; **and given** a live process whose observed start instant differs from the recorded instant by more than 5 000 ms, **then** `probe=dead` and the lane is reported stale rather than live. | F-1, API-10, NFR-9 |
| AC-F1-6 | **Given** a `dispatch.lane` record for the same ref under another repository, and separately a `daemon.lane` record for the ref, **when** `dispatch status <ref>` runs, **then** neither is reported: the answer is `marker=absent` in the first case and unchanged by the daemon lane in the second. | F-1, API-6, NFR-4, NG-1 |
| AC-F1-7 | **Given** any of the three states, **when** the query completes, **then** it performed exactly one bounded lane read, zero ledger appends, zero fence acquisitions, zero process starts, and wrote no identity marker. | F-1, F-6, API-6, NFR-1, NFR-2 |

### 17.2 Bounded, reference-scoped `log` (F-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a ref whose artifact holds at least 60 lines, **when** `dispatch log <ref>` runs without `--tail`, **then** the newest 50 lines are returned oldest-to-newest, and no line from another ref's artifact appears in either the human or the `--json` answer. | F-2, API-2, API-7, NFR-3, NFR-4 |
| AC-F2-2 | **Given** `--tail` values `0`, `501`, `1.5`, `-1`, `01`, and `abc`, **when** `dispatch log <ref>` runs, **then** each is refused `input.value.rejected` before any artifact read; **and given** an undeclared flag, **then** the refusal is `fallback.invocation`. | F-2, API-2, API-5 |
| AC-F2-3 | **Given** a ref with a lane written before this change and therefore no artifact, **when** `dispatch log <ref>` runs, **then** the answer is `available=false` with `reason=no-log`, an empty line list, and exit 0; nothing is fabricated from the lane or the attempt record. | F-2, API-2, API-7 |
| AC-F2-4 | **Given** an artifact that exists but cannot be read, **when** `dispatch log <ref>` runs, **then** the answer is `available=false` with `reason=unreadable` at exit 1, carrying no line list content. | F-2, API-2, API-7, DEC-5 |
| AC-F2-5 | **Given** a requested tail that would exceed an output bound, **when** the answer renders, **then** the machine `data` is at most 65 536 bytes and the human output at most 200 lines and 32 768 bytes, each carrying exactly one truncation fact naming its scope (`bytes` or `tail`), the bound, and the omitted line count. | F-2, API-2, DM-6, NFR-3 |
| AC-F2-6 | **Given** a dispatch whose session emits more than 1 048 576 bytes, **when** it completes, **then** the artifact is at most 1 048 576 bytes, ends at a line boundary, and the newest lines are present and readable through `dispatch log <ref> --tail 500`. | F-7, API-8, DM-2, NFR-3 |

### 17.3 `is-delivering` (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** an active, non-stale lane for a ref, **when** `dispatch is-delivering <ref>` runs, **then** it exits 0, reports `delivering=true` with that `ref` set, and carries no `refs` list. | F-3, API-3, DEC-5 |
| AC-F3-2 | **Given** a terminal lane or no lane for a ref, **when** `dispatch is-delivering <ref>` runs, **then** it exits 1; **and when** the same query runs with `--json`, **then** the envelope carries `delivering=false` in `data` with no `error` object. | F-3, API-3, DEC-5 |
| AC-F3-3 | **Given** two refs in the repository with active non-stale lanes, **when** `dispatch is-delivering` runs with no ref, **then** it exits 0 with `ref=null`, `delivering=true`, and `refs` listing both; **and given** 25 such refs, **then** `refs` lists 20 with one truncation fact; **and given** none, **then** it exits 1 with `delivering=false` and an empty list. | F-3, API-3, DM-6 |
| AC-F3-4 | **Given** only an active lane whose owner is confirmed gone, **when** `dispatch is-delivering <ref>` and `dispatch is-delivering` run, **then** both answer not in progress (exit 1), so a stale lane never makes the ref or the repository look busy. | F-3, API-3, DEC-2, NFR-9 |
| AC-F3-5 | **Given** an unreadable lane store, **when** any `is-delivering` form runs, **then** it refuses with the store's typed `state.*` identity and that row's projection, never a fabricated `delivering=false` at exit 1. | F-3, API-3, API-6, DM-7 |

### 17.4 `last-message` (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a `terminal` lane whose session has a persisted transcript, **when** `dispatch last-message <ref>` runs, **then** the answer is `available=true`, `final=true`, and `message` equal to the transcript's final assistant message, at exit 0. | F-4, API-4, API-9 |
| AC-F4-2 | **Given** a dispatch whose envelope `lastMessage` is a synthesized sentence distinct from the session's final assistant text, **when** `dispatch last-message <ref>` runs, **then** the answer is the assistant text and never the synthesized sentence, and the query reads no attempt record, derivation payload, or envelope field. | F-4, API-4, API-9, NFR-8 |
| AC-F4-3 | **Given** an `active` lane whose session has already produced assistant output, **when** `dispatch last-message <ref>` runs, **then** the answer is `available=true` with `final=false` and the latest assistant message observed so far. | F-4, API-4, DM-5 |
| AC-F4-4 | **Given** no lane for the ref in the current repository, **when** `dispatch last-message <ref>` runs, **then** the answer is `available=false` with `reason=no-lane`, a null message, and exit 1. | F-4, API-4, DEC-5 |
| AC-F4-5 | **Given** a lane whose harness declares no transcript read, a lane whose session is unknown to the harness storage, a transcript holding no assistant message, and unreadable storage, **when** `dispatch last-message <ref>` runs in each case, **then** the reasons are respectively `capability-gap`, `session-unknown`, `no-message`, and `unreadable`, each at exit 1 with a null message and no new error identity; **and given** an unreadable lane store, **then** the store's typed identity is refused instead. | F-4, API-4, API-9, DM-7 |
| AC-F4-6 | **Given** any `last-message` answer, **when** the query completes, **then** it performed zero spawn, resume, deliver, collect, terminate, or session-listing operations, started zero processes, and administered nothing on the session storage. | F-4, API-9, NFR-1 |
| AC-F4-7 | **Given** a final assistant message longer than 512 characters or containing line breaks, **when** the answer renders in human and `--json` form, **then** the message is at most 512 characters, single line, redacted through the delivered chokepoint, and `truncated` is true exactly when text was cut. | F-4, API-4, DM-6, NFR-8 |

### 17.5 One family, grammar, and `--json` (F-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** the four forms, **when** each runs with `--json`, **then** each emits the standard machine envelope whose `data` carries exactly one `query` discriminator (`status`, `log`, `is-delivering`, `last-message`) and the declared payload keys, and the human form emits its declared key set (or, for `log`, the raw tail). | F-5, API-1, API-2, API-3, API-4, DM-5 |
| AC-F5-2 | **Given** a non-canonical ref, a missing ref, an extra positional, and an invalid `--tail` value, **when** each form runs, **then** each is `input.value.rejected` decided before any runtime call; **and given** an undeclared flag, **then** it is `fallback.invocation`. | F-5, API-5 |
| AC-F5-3 | **Given** a composition that supplies no query surface, **when** the corresponding form runs, **then** it refuses `input.value.rejected` and never crashes or answers an empty success. | F-5, API-5, DEC-7 |
| AC-F5-4 | **Given** any of the four queries, **when** it runs and completes, **then** it emitted no delivery `result` token, appended no attempt record, appended no lane record, and left the next dispatch's and attempt read's answers unchanged. | F-5, F-6, NFR-2, NFR-5 |

### 17.6 Read-only posture and shell independence (F-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** any of the four queries and both `is-delivering` forms, **when** it completes, **then** the delivery state store's bytes, the lane records, and the identity marker are unchanged, with zero appends and zero fence acquisitions. | F-6, API-6, NFR-2 |
| AC-F6-2 | **Given** planted shell-lane artifacts — a delivering marker, a `<REF>.pid`, a `<REF>.pm.out`, and a `<REF>.last-message` with distinctive content — **when** all four queries run, **then** every answer is identical to the run without them and every planted file is byte- and mtime-identical afterwards (never read, never written, never repaired). | F-6, API-5, API-12, NFR-2, NFR-6 |
| AC-F6-3 | **Given** the no-shell invariant over the declared dispatch-flow surface list including the new surfaces, **when** the check runs, **then** it finds zero shell-execution references and zero script-path literals, and a planted reference fails it by name. | F-6, API-12, NFR-6 |
| AC-F6-4 | **Given** any query, **when** it completes, **then** zero child processes were started and zero network reads were made. | F-6, NFR-1, NFR-6 |
| AC-F6-5 | **Given** a checkout in which the shell entry points are absent from the repository, **when** all four queries run, **then** each answers from typed state and none fails because a script is missing. | F-6, NFR-6 |

### 17.7 Per-ref stdout persistence (F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** an admitted dispatch that acquires a session, **when** the acquisition completes, **then** the ref's artifact exists and every observed stdout line is appended as the session streams; two refs never share a file, and the artifact is created with `0600`. | F-7, API-8, DM-2 |
| AC-F7-2 | **Given** an injected sink write failure, **when** the dispatch completes, **then** the result token, exit, outcome, attempt-record count, and lane records are identical to the success path, and no evidence identifier is added for the failure. | F-7, API-8, NFR-5 |
| AC-F7-3 | **Given** a completed dispatch, **when** the store, the records, and the envelopes are inspected, **then** no log content appears in the ledger, any record, any evidence list, or any output beyond the tail the operator requested, and the engine wrote no prompt, diff, credential, tool argument, or provider payload. | F-7, DM-2, NFR-11 |
| AC-F7-4 | **Given** two successive dispatches for the same ref, **when** the second completes, **then** both deliveries' output is readable from one artifact, oldest content trimmed only by the 1 048 576-byte bound. | F-7, DM-2, DM-6 |

## 18. DEFINITION OF DONE

The change is done only when every item below is observed, not merely asserted. The AC count is 38 (reconciled against section 17), and each item names the evidence that closes it.

| ID | Definition-of-Done item | How observed |
|----|-------------------------|--------------|
| DOD-1 | All 38 acceptance criteria are satisfied, each with named evidence. | The DoD check maps every `AC-*` (38/38, reconciled against section 17) to its owning case through the test plan's coverage matrix, then confirms from the final aggregate-gate log that each owning case ran green; the matrix and the log are the evidence. |
| DOD-2 | The aggregate quality gate is green. | `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits 0; the captured log is attached to the change; no check is skipped, disabled, or made vacuous. |
| DOD-3 | The branch-range commit-message gate is `PASS`. | The repository's range lint gate prints `PASS` over the change branch's own commit range (not `SKIP`, not an unresolved `ERROR`); the verdict is recorded as a pm-notes `notes:` entry. |
| DOD-4 | The 12 lifecycle-state combinations answer, deterministically and offline. | Two consecutive battery runs assert 4 queries × 3 states with identical payloads and exits; zero live network calls, zero child processes, zero live process-table reads. |
| DOD-5 | The no-shell invariant is green with its non-vacuity control, and the shell-independence case passes. | The static invariant finds zero shell-execution references and zero script-path literals across the new surfaces; a planted reference fails by name; the decoy-artifact and shell-absent cases pass with byte-identical planted files. |
| DOD-6 | The read-only posture is proven, not asserted. | The store bytes, lane records, and identity marker are unchanged across all query cases; the read counter reports one lane read and at most one artifact read per query. |
| DOD-7 | Current-truth documentation is reconciled with no residual gap. | Every page named in Appendix A is updated in the documentation phase; a scan for stale "the typed path has no status/log surface" phrasing returns 0 hits; the dispatch page, the operations guide, and the reference page state the four queries, their exits, and the artifact family. |
| DOD-8 | The closed contracts are unchanged. | A contract diff or invariant check shows 0 token, projection, or exit changes; 0 new or changed error-table rows; 0 new domain kinds; 0 new configuration keys; the lane-record field set and schema identity identical to the delivered baseline. |

## 19. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one change on `feat/GH-354/dispatch-operator-surface` targeting the tooling integration branch; the PR stays open and merge authority stays outside this change.
- Landed by outcome so each fact is proven with the evidence that depends on it: (1) the lane-view fold and the advisory probe with `status`; (2) `is-delivering` and its exit projections; (3) the per-ref stdout artifact and `log`; (4) the transcript read seam and `last-message`; (5) the read-only and no-shell posture across all four; (6) current-truth documentation.
- Sequencing note: the flip plan gates F6 on `status` and `is-delivering` while allowing `log` and `last-message` to follow. All four ship in this change, but the first two are the ordering-safe half if delivery must pause between phases.
- No feature flag. The queries are additive read surfaces; a repository still using the shell keeps every shell behaviour, and the typed surface reads none of the shell's files.
- Operator-facing impact is limited to four new read forms and one `--tail` flag; the reference page and the operations guide are updated in the documentation phase.
- Release impact is a minor version change for a pre-1.0 CLI with no vocabulary, schema-version, or error-table change.
- Communication is internal to the dispatch, harness, and operator-documentation owners; reviewers should read the query answer matrix (Appendix C) as the authoritative statement of what each query answers.

## 20. DATA MIGRATION / SEEDING (IF APPLICABLE)

No migration is required and none is performed. The log artifact family is additive: a ref delivered before this change has no artifact and `dispatch log` reports `no-log`, which is a classified absence rather than a fabricated empty log. The lane record keeps its delivered schema, so pre-change lanes answer `status`, `is-delivering`, and `last-message` unchanged. No persisted record is rewritten, no key is renamed, no schema version is bumped, and nothing is backfilled from attempt history or from the shell's files.

## 21. PRIVACY / COMPLIANCE REVIEW

- **No personal data is introduced.** The answers carry a work-item reference, a repository identity, a session identity, a process id, timestamps, counts, closed reason words, and the PM's final message. The first five are operational identifiers already present in the delivered lane and attempt records.
- **The final message is the one content payload in output.** It is the PM's own final assistant text, bounded and redacted through the delivered serialization chokepoint, released only when an operator explicitly asks for it.
- **The log artifact is the one content payload at rest.** It is the harness's own stdout, kept in the local project state root with `0600`, capped at 1 048 576 bytes, never committed, never placed in the ledger or a record, and never served beyond the tail an operator requests. It mirrors the shell's pre-existing local stdout capture rather than introducing a new class of data.
- **No secret is written by the engine.** The engine writes only what the harness itself printed; it adds no prompt, environment value, credential, or tool argument to the artifact. The credential and environment seams are untouched.
- **No new flow of data leaves the machine.** Both added reads are local storage reads; no telemetry, network, or provider path carries session content.
- **Read-only posture over user data.** The transcript read is read-only, bounded, and administers nothing on a live session store, mirroring the delivered telemetry-capture posture.
- **Compliance posture is unchanged.** No retention, export, residency, or consent obligation is created by a local, bounded, operator-local debugging artifact.

## 22. SECURITY REVIEW HIGHLIGHTS

- **The inspection surface is not an authority.** The probe and the lane view are advisory; admission, exclusion, and resumability still come from the queue lease and the durable records. A stale answer can never authorise a second dispatch.
- **No write path is added to a read path.** Zero appends, zero fence acquisitions, zero repairs, and persistence-disabled identity resolution mean the queries cannot be used to mutate, truncate, or re-key delivery state — the failure mode that a "self-healing status" would introduce.
- **No shell surface.** The queries never read or execute a script, and never read a shell-owned path, so a stale or attacker-influenced file under `tmp/` or `.ai/local/` cannot steer a typed answer.
- **Bounded inputs and outputs.** Ref and `--tail` are shape-checked before any read; every read and every output has a declared bound; a bound that binds is declared rather than silently dropped.
- **Content at rest is local and minimal.** The artifact is `0600` under the project state root, one file per ref, bounded, and never indexed as evidence; the transcript read is read-only and returns one bounded message.
- **No new identity or taxonomy row.** Every negative answer is a data fact, so no error class is widened and no consumer can mistake a "no message" for a security event.
- **Scope safety.** No delivery semantic, record, or shell change is introduced, so the security review surface is the new read seam, the probe, and the artifact family — all explicitly bounded.

## 23. MAINTENANCE & OPERATIONS IMPACT

- **Four stable read forms:** an operator routine can be written against them, and the CEO prompt can name the typed forms instead of the shell ones.
- **One new artifact family with one bound:** operating it means knowing one path shape, one size cap, and one privacy boundary; there is no retention job, no rotation, and no index to maintain.
- **One new read seam per harness kind:** an adapter either implements the transcript read or declares the closed gap; a new harness that omits it degrades `last-message` only, and says so.
- **One derivation, one source.** `status` has no second truth source: given a lane record and a probe verdict, any reviewer can compute the answer.
- **No configuration surface to operate.** Every bound is declared policy; changing one is a documented contract change, not a config edit.
- **Diagnosis is cheaper.** A failed delivery now has a bounded typed tail and a real final message, so tokens are not spent rediscovering facts from files.
- **Cost:** four local reads per inspection; no session, no network, no model call. The write-side cost is one bounded append per observed stdout line.

## 24. GLOSSARY

| Term | Definition |
|------|------------|
| Lane view | The folded, repository-scoped newest `dispatch.lane` record for a work-item reference, joined with the advisory probe verdict; a derivation, not a record. |
| Marker | The operator-visible state name derived from the lane record's `state`: `active`, `terminal`, or `absent`. No marker file exists on the typed path. |
| Stale lane | An `active` lane record whose recorded owner process is confirmed gone; still the resumable artifact, never repaired by a read. |
| Advisory probe | The injected, tri-state (`live`/`dead`/`unknown`) observation of the recorded owner facts with a start-instant tolerance; never an exclusion input. |
| Log artifact | The bounded, per-ref, append-only harness-stdout file written during a dispatch and read by `dispatch log`; outside the state store's record set. |
| Reference-scoped | Bound to exactly one work-item reference: one artifact file, one lane folder, never a scan across refs. |
| Transcript read seam | The injected, adapter-owned, read-only read of the harness's persisted session storage that returns the final assistant message. |
| Final message | The final assistant message of the recorded session — the PM's own words — as distinct from the envelope's synthesized `lastMessage`. |
| Finality fact | The `final` boolean on a `last-message` answer: true exactly when the lane's newest record is `terminal`. |
| Closed negative reason | One of `no-lane`, `no-log`, `capability-gap`, `session-unknown`, `no-message`, `unreadable`; a data fact, not an error identity. |
| Read-only posture | Zero appends, zero fence acquisitions, zero repairs, zero process starts, zero network reads, persistence-disabled identity resolution. |

## 25. APPENDICES

### 25.1 Appendix A — Phase-7 documentation impacts

| Document | Required reconciliation |
|----------|-------------------------|
| `doc/spec/features/feature-dispatch-engine.md` | Add the four operator forms to the command grammar table; add a section stating the lane-view fold, the marker derivation, the staleness rule and tolerance, the log artifact family and its bounds, the transcript read seam and the fallback ladder, the exit projections of the query answers, and the read-only posture; state that the queries read no shell artifact. **Replace any statement that the typed path has no `status`/`log`/`is-delivering`/`last-message` surface.** |
| `doc/spec/features/feature-state-layer.md` | Record the `dispatch-logs.<workspace>/` artifact family beside the ledger, outside the record set, the derived-document set, the salvage path, and the repair path, with its bound, mode, and retention. |
| `doc/spec/features/feature-harness-adapters.md` | Record the read-only transcript read seam per adapter, its bounded payload, its closed absences, and that it is a read rather than a member of the closed session operation set. |
| `doc/spec/features/feature-autonomous-delivery.md` | State that the per-ref operator queries the shell exposes (`--status`, `--log`, `--is-delivering`, `--last-message`) have typed equivalents that read none of the shell's files, and keep the shell's retained-fallback role. |
| `doc/guides/engine-first-operations.md` | Add the operator routine for the four queries: reading a live delivery, gating on `is-delivering`, diagnosing a failure from the bounded tail, and reading the PM's final message; state the exit convention and that a stale lane is inspectable but not repaired. |
| `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md` | Add the four forms to SYNOPSIS; document `--tail` in OPTIONS; state the payloads and human output in OUTPUT; add the query exits to EXIT STATUS with the 0/non-zero convention; name the closed negative reasons in ERRORS. The page carries no license-header change and is a redistributable guide-class page: it currently carries no `ados_distribution` marker, and if the phase-7 change adds front matter it must declare `ados_distribution: redistributable`. |
| Help/reference coverage | `dispatch` stays one prompt-required command with one reference page, so `tests/fixtures/help-guide/coverage.json` and `doc/00-index.md` are unchanged. The four new help entries raise the family's help-entry count from five to nine; the structure assertion that pins that count is updated with the entries. |
| `doc/overview/glossary.md` | Add lane view, stale lane, log artifact, transcript read seam, final message, and closed negative reason. |

No new documentation page is created, so `doc/00-index.md` gains no entry. The `doc/guides/engine-first-operations.md` page is a distributable guide and already declares `ados_distribution: redistributable`; a page that gains the marker must declare that value.

### 25.2 Appendix B — Ticket-to-spec traceability

| Ticket / backlog element | Where satisfied |
|---|---|
| Ticket goal: the per-ref inspection surface exists on the typed path so no operator needs the shell lane | F-1…F-6; §1; §3 |
| Ticket task: per-ref `status` (delivering, pid, session id, stale, marker) | F-1; AC-F1-1…AC-F1-7; DM-1; DEC-2 |
| Ticket task: per-ref `log` with bounded tail | F-2; AC-F2-1…AC-F2-6; DM-2, DM-6; DEC-3 |
| Ticket task: `is-delivering`/is-delivering query | F-3; AC-F3-1…AC-F3-5; DEC-1, DEC-5 |
| Ticket task: `last-message` from the persisted session transcript | F-4; AC-F4-1…AC-F4-7; DM-3; DEC-4 |
| Ticket task: persist harness stdout per ref during a dispatch | F-7; AC-F7-1…AC-F7-4; DM-2; DEC-3 |
| Ticket task: wire all four into one command family with `--json` | F-5; AC-F5-1…AC-F5-4; API-1…API-5; DEC-1 |
| Ticket AC: the four queries answer for a live dispatch | AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-3 |
| Ticket AC: the four queries answer for a finished dispatch | AC-F1-2, AC-F2-1, AC-F3-2, AC-F4-1 |
| Ticket AC: the four queries answer for an absent ref | AC-F1-3, AC-F2-3, AC-F3-2, AC-F4-4 |
| Ticket AC: the log is bounded and reference-scoped | AC-F2-1, AC-F2-5, AC-F2-6; NFR-3, NFR-4 |
| Ticket AC: `last-message` returns the PM's final message rather than a classifier sentence | AC-F4-1, AC-F4-2; NFR-8 |
| Ticket AC: no shell script is read or executed | F-6; AC-F6-2…AC-F6-5; API-12; NFR-6 |
| Ticket depends on GH-347's durable lane record and persisted session | DM-1, DM-3; §13 |
| Backlog M4-S12 tasks and AC (`backlog.md:46-53`) | One row per task above; §4.1 |
| Flip-plan F1b placement, F6 gating on `status`/`is-delivering` (`flip-plan.md:47,104-107,120`) | §13 "Blocks" rows; §19 sequencing note |
| GH-347 deferral of the operator surface (NG-1, §7.3) | §7.1; DEC-9 |
| TDR-0049 informed party "GH-354 (the deferred operator surface reads this record's artifact)" | DM-1; §25.4 note |

### 25.3 Appendix C — Query answer matrix (normative)

| Query | Live lane (`active`, probe live) | Finished lane (`terminal`) | Absent ref | Exit |
|---|---|---|---|---|
| `status` | `delivering=true`, `marker=active`, `probe=live`, pid/session, lane facts | `delivering=false`, `marker=terminal`, `lastToken`/`lastOutcome`, `recordedAt` | `marker=absent`, `delivering=false`, `probe=not-applicable`, null lane | 0 in all three |
| `status` (probe dead) | `delivering=false`, `stale=true`, `marker=active`, `probe=dead` | unchanged (`stale=false`) | unchanged | 0 |
| `log` | artifact tail or `no-log` / `unreadable` | same | `no-log` | 0; 1 only for `unreadable` |
| `is-delivering <ref>` | exit 0, `delivering=true` | exit 1, `delivering=false` | exit 1, `delivering=false` | 0 / 1 |
| `is-delivering` | exit 0, `refs=[…]` over the repository | exit 1, empty `refs` | exit 1, empty `refs` | 0 / 1 |
| `last-message` | `available=true`, `final=false` | `available=true`, `final=true` | `reason=no-lane` | 0; 1 for every negative reason |

**What the offline battery proves.** That the lane-view fold, the probe verdict mapping, the repository scoping, the artifact tail and its bounds, the delivering fold, the transcript seam ladder, the exit projections, the read-only posture, and the no-shell invariant hold over declared fixtures, through the same composed functions the production path uses, with zero live calls.

**What it does not prove.** Live opencode or Claude Code storage layouts and their real failure shapes; real kernel process semantics behind the probe (the battery injects verdicts and asserts the contract, including the start-instant tolerance selection); real stdout framing across a live session; real disk-full or `0600` enforcement behaviour; long-run artifact growth under real session volume.

### 25.4 Appendix D — Fixture- and implementation-decided details

The following do not reopen any decision: the exact human key order within each declared key set (as long as every declared key appears); the exact rendering of the `log` truncation line; the exact probe implementation over the host process table and how start instants are read; the exact storage queries the adapters use for the transcript read, and their per-adapter bounds below the declared message bound; the exact artifact file naming beyond the declared per-ref shape; the exact wording of the closed reason summaries in human output; and the exact composition wiring of the four read surfaces. Not fixture-decided: whether the four queries exist, whether the marker comes from the lane state, whether a stale lane is repaired, whether the log artifact is bounded and reference-scoped, whether `last-message` reads a transcript rather than composing a sentence, and whether any read writes.

**Decision-record recommendation (not authored here).** DEC-3 and DEC-4 are precedent-setting together: they establish where a typed delivery's session output lives at rest, how it is bounded and scoped, and how a persisted session transcript is read without a session operation. The next consumer is the loop surface (`loop status`/`loop log`, M4-S10), which will want the same artifact-family and read-seam conventions. A technical decision record covering "dispatch session-output artifacts and the transcript read seam" is recommended before that surface is specified; this spec is authoritative until then, and no record is authored in this change.

### 25.5 Appendix E — Verified baseline

Every seam named in section 2.1 was verified on this branch at `feat/GH-354/dispatch-operator-surface` (base `main-tools`) with GH-347 merged, and the line citations above are from that read: the lane record and its constants (`packages/core/src/contracts/dispatch.ts`), the lane read and fold (`packages/core/src/app/dispatch-ledger.ts`, `dispatch-lane.ts`), the CLI dispatch grammar and its refusal guard (`packages/cli/src/commands/dispatch.ts`), the session port and evidence shape (`packages/core/src/contracts/harness.ts`), the opencode observation sink (`packages/adapters/src/harness/opencode.ts`), the shell parity queries and the probe tolerance (`scripts/deliver-ticket.sh`), the state-layer artifact pattern (`doc/spec/features/feature-state-layer.md`), and the deferral record (TDR-0049). The delivered help-entry count assertion and the coverage inventory root were read directly rather than assumed.

## 26. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-19 | @spec-writer | Initial specification for GH-354, grounded in the ticket body, the M4 backlog row M4-S12, the flip-plan F1b/F6 split, the GH-354 planning notes, TDR-0049, the delivered dispatch lane and command family, the shell parity contract, and decisions DEC-1…DEC-9. |

---

## AUTHORING GUIDELINES

- **Sources.** The GH-354 ticket body (source of truth), the committed M4 backlog row M4-S12 and flip-plan F1a/F1b split and F6 verification bar, the GH-354 planning notes (scope decisions, verified facts, risks, operational prerequisite), TDR-0049, the delivered dispatch-engine feature page and lane/attempt contracts, the shell parity queries in `scripts/deliver-ticket.sh`, the CEO prompt's operator surface, and the delivered state-layer artifact pattern. No behaviour is invented; implementation-decided details are listed in Appendix D.
- **Approach.** The spec is organised around the four queries and the two new data sources, then around outcomes: capabilities state behaviour and rationale, interfaces state contracts with closed vocabularies and bounds, and acceptance criteria are individually observable and traceable to the ticket, the backlog row, or a named repo contract.
- **Constraints applied.** Closed token, projection, exit, and identity vocabularies; additive contracts only; no new configuration key; no shell dependency and no shell-artifact read; read-only operator posture; no live-provider or live-kernel claim beyond the declared boundary.
- **Deliberate omissions.** No code file paths in the requirements (citations in §2.1 and Appendix E locate delivered facts), no step-by-step implementation tasks, no commit or merge instructions, and no technology tuning beyond what the outcomes require.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (`GH-354`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` is the tracker milestone title verbatim and equals the planning-notes milestone (`M4: Jaiship-native delivery`)
- [x] All sections present in order (1–26 + authoring guidelines + checklist)
- [x] A Definition of Done follows the acceptance criteria, every item names its observation, and the AC count reference matches the 38 declared criteria
- [x] ID prefixes are consistent and unique (`F-`, `API-`, `DM-`, `NFR-`, `AC-`, `RSK-`, `DEC-`, `PG-`, `DOD-`)
- [x] Every acceptance criterion references at least one `F-`/`API-`/`DM-`/`NFR-` ID and uses Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigation and residual risk
- [x] Out-of-scope items are prefixed `[OUT]`
- [x] No implementation details (no code file paths in requirements, no step-by-step tasks)
- [x] Open questions are empty; every routed question is settled by a cited decision
- [x] The three lifecycle states are covered for all four queries (Appendix C matrix; §17)
- [x] The log bound and reference scoping, the `last-message` fidelity distinction, `--json` for every query, and the no-shell/no-script invariant each have dedicated acceptance criteria
- [x] Every capability and criterion traces to the ticket body, backlog row M4-S12, or a named repo contract (Appendix B)
- [x] The doc-impact set for phase 7 is stated, including the reference page, the help-entry count change, and the unchanged coverage inventory and index
- [x] No license header and no `ados_distribution` marker were added to this change artifact; where a distributable page is touched, its required marker value is named
- [x] The precedent-setting decision is named and recommended for a technical decision record without authoring it (Appendix D)
