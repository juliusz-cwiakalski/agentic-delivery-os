---
change:
  ref: GH-275
  type: fix
  status: Proposed
  slug: opencode-harness-contract
  title: "Fix opencode harness spawn: parse the JSONL stream and acquire the session handle without blocking on completion"
  owners: [engineering]
  service: delivery-os harness adapters
  labels: [change, harness, bug, dispatch]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [harness adapter contract, host spawn runner, harness session port, CLI production composition, adapter conformance suite, dispatch engine]
    external: [opencode CLI v2.2.5]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the opencode delivery adapter able to spawn and resume a real lifecycle session by reading the CLI's JSONL stream and returning a session handle as soon as the first identified line arrives, instead of requiring one JSON document and requiring the whole (multi-hour) session to exit, so `dispatch` no longer fails with `spawn failed before a session existed` on a healthy harness.

## 1. SUMMARY

Fix the opencode harness adapter's spawn and resume paths so they consume the real `opencode run --format json` contract: one JSON object per line, with the session identifier in the top-level `sessionID` field. Handle acquisition is separated from session completion through a new injected streaming starter seam: the adapter returns a `HarnessSessionHandle` as soon as the first line carrying a session identifier is seen, continues draining the stream in the background, and resolves `collect` only when the process completes.

The change also removes the five-minute whole-session timeout from the spawn path, replaces it with a bounded handle-acquisition wait, and pins the real stream shape in contract, behaviour, and type tests. The harness session port, the dispatch engine, the error vocabulary, the classifier, the delivery-result tokens, and the Claude Code adapter stay unchanged. End-to-end proof is one real dispatch on a healthy CLI that reaches classification rather than `dispatch.session.spawn-failed`.

## 2. CONTEXT

### 2.1 Current State Snapshot

The typed harness stack is delivered on the integration branch. Dispatch resolves a harness, claims the queue lease, spawns or resumes through `HarnessSessionPort`, watches progress, collects evidence, and classifies through one shared classifier. The opencode adapter is the production harness for this repository; the bash stack remains the working fallback.

The opencode adapter's spawn path was written against an imagined output shape: one JSON document whose identifier lives at `session.id`, `sessionId`, or `id`. The real CLI emits a JSONL event stream whose identifier is the top-level `sessionID` field, and `run` does not exit until the whole session completes. Diagnostic evidence:

| Component | Location | Observed behaviour |
|---|---|---|
| opencode adapter | `packages/adapters/src/harness/opencode.ts` (`createOpencodeSession` → `run`) | Does a single `JSON.parse(result.stdout)` over the entire stdout, so a JSONL stream fails to parse; `sessionIdOf` reads `session.id`, `sessionId`, and `id` only, never the top-level `sessionID`. |
| opencode adapter | `packages/adapters/src/harness/opencode.ts` (`DEFAULT_TIMEOUT_MS`) | `300_000` ms is applied to spawn, resume/deliver, and session listing. |
| opencode adapter | `packages/adapters/src/harness/opencode.ts` (`run`, `resume`) | Awaits the injected one-shot runner, which resolves only on process close, so no handle can exist before the session ends. |
| host runner | `packages/adapters/src/host/index.ts` (`createHostSpawnRunner`) | The repository's single `node:child_process` site. Resolves only on `close` or `error`, buffers stdout up to `MAX_OUTPUT_BYTES = 16 MiB`, and enforces `options.timeout` by `child.kill("SIGTERM")` with `timedOut` set. |
| CLI composition | `packages/cli/src/production.ts` (opencode binding) | Binds `spawnArgs = ["run","--format","json"]`, `resumeArgs = ["run","--format","json","--session"]`, `listArgs = ["session","list","--format","json"]`. |
| dispatch engine | `packages/core/src/app/dispatch.ts` (spawn/resume handling) | Any `spawn`/`resume` failure collapses to `dispatch.session.spawn-failed` with `lastMessage: "spawn failed before a session existed"`. |
| harness contract | `packages/core/src/contracts/harness.ts` | `HarnessSpawnRunner` returns one `{stdout, stderr, status, timedOut}` at completion; `HARNESS_FAILURE_CODES` is a closed vocabulary; `HarnessEvidence` carries `completionMarker`, `exitStatus`, `timedOut`, `spawnRefused`, `failureReported`, `toolFailure`. |
| Claude adapter | `packages/adapters/src/harness/claude.ts` | Uses the same one-shot runner for its headless spawn/collect and must keep working unchanged. |
| bash precedent | `scripts/opencode-session.sh` (`extract_session_id`) | The bash stack already reads the first line carrying a top-level `.sessionID` from `opencode run --format json`. The typed adapter is the outlier. |

Real CLI output observed on `opencode v2.2.5` (first line of a probe):

```json
{"type":"step_start","timestamp":...,"sessionID":"ses_e430b0300ffe...","part":{...}}
```

Followed by `text` and `step_finish` events carrying the same top-level `sessionID`. `opencode run` blocks until the whole session completes.

### 2.2 Pain Points / Gaps

- A healthy CLI cannot be spawned: the single `JSON.parse` throws on JSONL, so `parsed` is `undefined`, no identifier is found, and dispatch records `dispatch.session.spawn-failed`.
- The adapter does not read the identifier the real CLI actually emits (`sessionID`), so even a corrected parser would fail unless that field is accepted.
- The adapter's spawn is completion-gated: a handle cannot exist until the process exits, which contradicts the port's contract that `spawn` returns a handle and `collect` later returns evidence.
- The five-minute `DEFAULT_TIMEOUT_MS` kills any real lifecycle session, because a full delivery runs for hours.
- Because `spawn` blocks on completion, dispatch's progress-based liveness watch cannot observe the session while it runs; it only runs after the session has already ended.
- The Claude adapter and the one-shot runner are healthy and must not be disturbed by the fix.
- The adapter tests pin the imagined single-document shape, so the regression is not caught by the current suite.

## 3. PROBLEM STATEMENT

Because the opencode adapter requires a single JSON document and a process exit before it can produce a session handle, it cannot spawn a real `opencode run --format json` session, resulting in every dispatch on a healthy installed harness failing as `dispatch.session.spawn-failed` and the typed delivery path remaining unusable.

## 4. GOALS

- **G-1**: Parse the real JSONL stream: one JSON object per line, identifier from the top-level `sessionID`, with the previously accepted identifier shapes retained for robustness.
- **G-2**: Acquire and return the spawn handle as soon as the first identified line arrives, without waiting for process completion.
- **G-3**: Apply the same non-blocking acquisition to resume/deliver, with the existing handle identity preserved.
- **G-4**: Resolve `collect` only when the session completes, mapping the stream's terminal facts into the unchanged `HarnessEvidence` shape and never fabricating completion.
- **G-5**: Replace the whole-session five-minute timeout with a bounded handle-acquisition wait, no whole-session bound by default, and leak-free process cleanup.
- **G-6**: Pin the real CLI stream shape with contract, behaviour, and type tests, and prove one real dispatch reaches classification.
- **G-7**: Leave the dispatch engine, error vocabulary, classifier, result tokens, the harness session port, and the Claude Code adapter unchanged.

### 4.1 Success Metrics / KPIs

| Metric | Target for this change |
|---|---|
| Healthy-CLI spawns that return a handle before process completion | 100% |
| Dispatches on a healthy CLI that fail as `dispatch.session.spawn-failed` | 0 |
| New harness failure codes | 0 |
| New delivery-result tokens or error-table rows | 0 |
| `node:child_process` import sites in the repository after the change | 1 in `packages/adapters/src/host/index.ts`; no new site |
| Real CLI invocations inside unit/behaviour tests | 0 |
| Whole-session five-minute timeout on the spawn/resume path | 0 |
| Regressions in the Claude Code adapter | 0 |
| End-to-end real dispatches reaching classification (any token) | 1 of 1 |

### 4.2 Non-Goals

- **NG-1**: Changing dispatch truth derivation, attempt records, the handover gate, the queue/scheduler, or any dispatch command surface.
- **NG-2**: Changing the closed failure-code vocabulary, the delivery-result token set, the shared classifier, or the error table.
- **NG-3**: Adding a session-kill operation to `HarnessSessionPort` or a new CLI command.
- **NG-4**: Rewriting the Claude Code adapter, its output shape, or its timeout behavior.
- **NG-5**: Changing harness telemetry extraction, closeout capture, liveness sourcing, spend, or the economics surface.
- **NG-6**: Changing the bash delivery scripts or making them depend on the typed CLI.
- **NG-7**: Adding a user-facing configuration key for the new bounds. The bounds are injected adapter options; exposing them through configuration is not required by this change.
- **NG-8**: Streaming partial-token or per-event telemetry to consumers. The stream is consumed for handle acquisition and terminal evidence only.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | JSONL stream decoding and session-identifier acquisition from the real `opencode run --format json` shape | The current parser cannot read the stream at all; the real contract must be pinned. |
| F-2 | Non-blocking spawn handle acquisition with asynchronous completion | A handle must exist before the multi-hour session exits. |
| F-3 | Non-blocking resume/deliver acquisition with stable handle identity | A resumed lifecycle is equally long-lived and must not be completion-gated. |
| F-4 | Completion-scoped evidence and `collect` semantics | Evidence must describe the finished session, never an in-flight or fabricated one. |
| F-5 | Bounded handle acquisition, no default whole-session bound, and leak-free cleanup | Replace the 300 s defect without introducing an unbounded orphan risk. |
| F-6 | Streaming host starter seam and composition binding behind the unchanged session port | The runtime-neutral core needs an injectable streaming seam; only the host subpath owns the child process. |
| F-7 | Contract, behaviour, and type coverage pinned to the real stream shape | The regression must be impossible to reintroduce silently. |
| F-8 | End-to-end dispatch proof on a real ticket | The ticket's acceptance is a working spawn, not only a unit test. |

### 5.1 Capability Details

- **F-1**: The adapter splits stdout into lines, parses each line independently, strips a trailing carriage return, ignores blank lines, and accepts the first line that parses to an object carrying an identifier. The identifier precedence is top-level `sessionID` first, then the previously accepted `session.id`, `sessionId`, and `id` shapes. A line that is not JSON, or that parses to a non-object, does not abort the scan; the scan continues until an identifier is found or the stream ends. A single-line JSON document that carries one of the accepted identifier shapes remains accepted.
- **F-2**: When the first identified line arrives, the adapter constructs the handle with `harnessKind: "opencode"`, the acquired `sessionId`, `treeRoot` equal to the session id, and the input `workItemRef`, records the session, starts the completion-to-evidence path, and returns the handle immediately. It does not await process exit and does not require a terminal event before returning.
- **F-3**: `resume` and `deliver` use the same acquisition. The caller's existing handle identity is preserved: the resumed session id is the handle's `sessionId`, and the stream identifier must match it. A stream that identifies a different session is refused with the existing session-unknown identity. A resume that produces no identifier within the acquisition bound is refused with the existing session-unknown identity, carrying the observed status and timeout flag as today.
- **F-4**: The adapter keeps a per-session completion promise. `collect` awaits that promise and returns the evidence derived from the closed process and the bounded stdout. Before completion it neither returns evidence nor invents a partial result. A process that ends abnormally yields evidence with the observed exit, timeout, failure, and tool-failure facts; the shared classifier decides the outcome.
- **F-5**: The injected starter receives a handle-acquisition bound and an optional whole-session bound. If no identifier is acquired within the handle bound, the child is killed and the spawn is classified through the existing pre-session refusal path. The whole-session bound is disabled by default; a real lifecycle is bounded by progress-based liveness and the restart budget, not by an arbitrary minute-scale process cap. Every failed or abandoned acquisition kills the child; the kill operation is idempotent.
- **F-6**: The streaming starter is a new injected seam beside the unchanged one-shot runner. The host subpath implements it over `node:child_process`; it remains the single child-process site. The adapter receives both seams by composition: the streaming starter for spawn/resume/deliver and the one-shot runner for read-only session listing. Claude Code receives only the one-shot runner. `HarnessSessionPort` and `HarnessSpawnRunner` are unchanged.
- **F-7**: The test suite pins the real stream: JSONL, top-level `sessionID`, first-line handle acquisition, continued draining, malformed and blank leading lines, no identifier, non-zero exit with and without an identifier, truncation, a simulated long-running session beyond the old five-minute assumption, and resume. Type tests compile the new seam and prove the session port is unchanged.
- **F-8**: One real `dispatch <ref>` on the installed healthy CLI reaches classification with any result token rather than `dispatch.session.spawn-failed`. The proof is bounded so a nested lifecycle cannot mutate this change's worktree: either a probe-scale prompt or a session ended after the handle is observed, executed outside the change worktree.

## 6. USER & SYSTEM FLOWS

```
Flow 1: healthy spawn
  dispatch -> harness.spawn -> host streaming starter starts `opencode run --format json`
  -> first JSONL line carries sessionID -> adapter calls acquired() and returns handle
  -> dispatch starts collect (pending) and the liveness watch (now observable)
  -> host keeps draining stdout; adapter keeps the completion promise
  -> process closes -> evidence parsed from the bounded stream
  -> shared classifier -> dispatch truth derivation -> one result token

Flow 2: pre-session failure (no identifier)
  starter starts -> no identified line within the handle bound, or stream ends without an id
  -> host kills the child (bound expiry) or the stream closes
  -> status != 0 or timedOut -> harness.spawn.refused with the observed status
  -> status == 0 -> harness.spawn.invalid-output
  -> dispatch records dispatch.session.spawn-failed (unchanged path)

Flow 3: resume
  dispatch -> harness.resume with the existing handle -> starter starts with `--session <id>`
  -> first identified line must equal the handle's sessionId -> handle returned
  -> later non-zero exit is post-handle evidence -> collect -> classifier failed
  -> no identified line -> harness.session.unknown

Flow 4: long-running session
  first line arrives in seconds -> handle returned
  -> completion resolves hours later -> collect returns evidence then
  -> no five-minute process cap interrupts the session
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The opencode adapter spawn and resume/deliver path, including JSONL decoding and `sessionID` acquisition.
- A new injected streaming starter seam in the harness contract and its host implementation.
- The production composition binding for the streaming starter and the unchanged one-shot runner.
- Contract, behaviour, and type tests pinned to the real CLI stream shape, including a simulated long-running session.
- The end-to-end real-dispatch proof.
- Current-truth documentation updates flagged for the `system_spec_update` phase.
- Explicit confirmation that the dispatch engine needs no change.

### 7.2 Out of Scope

- [OUT] Any change to `packages/core/src/app/dispatch.ts`, dispatch truth derivation, attempt records, the handover gate, or the queue/scheduler.
- [OUT] Any new or changed failure code, delivery-result token, classifier rule, or error-table row.
- [OUT] Any change to the Claude Code adapter's behavior or output contract beyond keeping it working.
- [OUT] A session-kill operation on the harness session port or a new CLI command surface.
- [OUT] Harness telemetry extraction, closeout capture, spend, and the session lifecycle economics surface.
- [OUT] Bash stack changes, bash-to-typed-CLI dependencies, or script-side session parsing changes.
- [OUT] A user-facing configuration key for the new bounds.
- [OUT] Streaming per-event telemetry, partial-token reporting, or a new event vocabulary.
- [OUT] Retaining or persisting raw stream stdout after evidence is derived.

### 7.3 Deferred / Maybe-Later

- An operator-facing session bound exposed through typed configuration, if real operations show a need beyond the progress-based liveness and restart budget.
- A port-level session termination operation, which would let dispatch stop a hard-stalled session instead of only recording it.
- Reading richer per-event facts (token deltas, tool events) from the stream as a liveness or telemetry source.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change introduces no HTTP surface and changes no existing HTTP contract.

### 8.2 Events / Messages

N/A. No internal event, message, ledger record, or capsule event is added or changed. The JSONL stream is a child-process stdout format, not a product event contract.

### 8.3 Data Model Impact

N/A. No persisted data model, state record, event-log shape, or schema version changes. The session record stays in memory and holds a completion promise instead of completed evidence; it is not persisted.

### 8.4 External Integrations

The changed external contract is `opencode run --format json` on `opencode v2.2.5`:

| Aspect | Contract used by this change |
|---|---|
| Invocation | `run --format json` for spawn, `run --format json --session <id>` for resume; prompt on stdin; arguments otherwise unchanged. |
| Stdout framing | JSONL: one JSON object per line, `\n` separated, optional trailing `\r`. |
| Identifier | Top-level `sessionID` string on the event object; previously accepted `session.id`, `sessionId`, and `id` shapes retained as fallbacks. |
| Event types read | `step_start`, `text`, `step_finish`; `step_finish` carries `part.reason`, and its `part` may carry cost and token facts. No other event vocabulary is invented. |
| Termination | Process close status; `run` blocks until the session completes. |
| Output bound | The existing 16 MiB stdout bound and truncation marker are preserved. |
| Session listing | Unchanged: `session list --format json` through the one-shot runner. |

### 8.5 Backward Compatibility

- `HarnessSessionPort` is unchanged: `spawn` still returns `Promise<HarnessResult<HarnessSessionHandle>>`, and `collect` still returns `Promise<HarnessResult<HarnessEvidence>>`.
- `HarnessSpawnRunner` and `HarnessSpawnRunnerResult` are unchanged; the Claude Code adapter continues to use them and is not required to adopt the streaming seam.
- A single-line JSON document carrying `session.id`, `sessionId`, or `id` still acquires a handle, so existing synthetic fixtures and any non-JSONL provider shape remain readable.
- No CLI grammar, help entry, output envelope, exit projection, error code, result token, configuration key, or persisted shape changes.
- Dispatch consumes the same port with the same success and failure result types; its code does not branch on harness kind or on the new seam.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Handle acquisition latency for a healthy local CLI | First identified line observed within 5 s typical; hard acquisition bound 60 s. |
| NFR-2 | Spawn must not wait for session completion | A simulated session whose completion resolves after more than 300 s (virtual time) returns its handle before completion in 100% of runs. |
| NFR-3 | Contract and vocabulary stability | 0 new failure codes, 0 new delivery-result tokens, 0 new error-table rows, 0 classifier changes. |
| NFR-4 | Runtime confinement | Exactly one `node:child_process` import site in the repository (`packages/adapters/src/host/index.ts`); no new runtime API in the runtime-neutral contract tier. |
| NFR-5 | Test hermeticity | 0 real CLI invocations in unit, behaviour, conformance, or type suites; all stream facts injected. |
| NFR-6 | Memory bound | The existing 16 MiB stdout bound per invocation is preserved; no unbounded whole-session buffer is introduced in the adapter. |
| NFR-7 | Process hygiene | 0 orphaned children in acquisition-failure and abandonment tests; kill is idempotent and called on every failure path. |
| NFR-8 | Dispatch behavior stability | Pre-session failures still collapse to `dispatch.session.spawn-failed`; a healthy spawn never takes that branch. |
| NFR-9 | Gate health | `pnpm typecheck`, `pnpm test`, and `pnpm check:boundaries` pass, including the child-process allowlist equality and the session-port type tests. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new metric, log stream, trace, alert, or persisted telemetry record is required. Observable behavior stays within the delivered surfaces:

- A pre-session failure keeps its existing failure identity and status; a successful acquisition is observable as a returned handle and later collected evidence.
- The session stream is consumed for parsing and evidence only; raw stdout is not logged, persisted, or emitted to telemetry.
- Liveness observation stays sourced from the injected liveness facts as today. The stream is not a liveness source in this change.
- No secret, prompt content, environment dump, or credential value is emitted by any new path.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | The end-to-end proof starts a nested lifecycle that mutates this change's worktree or runs for hours. | H | M | Bound the proof to a probe-scale prompt or end the session after the handle is observed; run it outside the change worktree; record the bounded evidence in the plan and PR. | L |
| RSK-2 | The real `opencode` stream shape changes between versions or differs by provider. | M | M | Pin the v2.2.5 shape in a committed fixture; keep the accepted identifier fallbacks; a malformed stream maps to an existing failure code, never a crash. | M |
| RSK-3 | A hard-stalled session with no whole-session bound blocks `collect` indefinitely. | M | L | Progress-based liveness and the restart budget remain the operational controls; an optional injected session bound is available; daemon supervision can restart the lane. | M |
| RSK-4 | Killing or abandoning a stream leaks a child process or leaves a zombie writer. | M | L | Idempotent kill on every failure/abandonment path; the host starter owns close handling; tests assert kill invocation; the single child-process site is unchanged. | L |
| RSK-5 | The adapter stops draining after acquisition and backpressures the child. | M | L | The host starter continues buffering independently up to the 16 MiB bound; the adapter attaches completion without needing to consume every event. | L |
| RSK-6 | The shared contract change accidentally changes the Claude Code adapter or session listing. | M | L | The one-shot runner and Claude adapter are unchanged; existing Claude and listing tests stay green; type tests assert the port shape is unchanged. | L |
| RSK-7 | Resume acquires a different session than the caller's lane. | M | L | The resumed stream identifier must equal the caller's handle id; a mismatch maps to the existing session-unknown identity. | L |
| RSK-8 | A non-zero exit after handle acquisition is mistaken for a pre-session failure. | M | L | Only the no-identifier path maps to pre-session refusal; any acquired session records the exit as evidence and classifies normally. | L |
| RSK-9 | Truncated stdout drops the terminal `step_finish` and is misreported as completion. | M | L | Completion requires an explicit terminal `step_finish` with reason `stop` and exit 0; truncation without it yields premature end, not completion. | L |

## 12. ASSUMPTIONS

- The installed CLI is `opencode v2.2.5`, and its `run --format json` stdout is JSONL with a top-level `sessionID` on every event line.
- The first identified line arrives within seconds of process start for a healthy local CLI; the handle-acquisition bound only covers process startup and first output, not model work.
- `opencode run` and `opencode run --session <id>` both block until the session completes.
- A terminal `step_finish` event with `part.reason === "stop"` and exit status 0 is a reliable completion marker; the plan may enrich the pinned fixture with additional real events while preserving this contract.
- The existing 16 MiB stdout bound is sufficient for a lifecycle session's machine-readable output; truncation is an explicit degraded case, not the normal path.
- A single JSON document carrying an accepted identifier shape remains a valid degenerate JSONL stream.
- The dispatch engine's existing post-spawn classification path correctly handles a session acquired before its failure.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | Harness adapter contract (`packages/core/src/contracts/harness.ts`) | The new streaming seam is added here; existing runner and port types are unchanged. |
| Depends on | Host spawn runner (`packages/adapters/src/host/index.ts`) | Provides the only child-process implementation; the streaming starter lives beside the one-shot runner. |
| Depends on | CLI production composition (`packages/cli/src/production.ts`) | Binds the streaming starter for opencode and keeps the one-shot runner for listing. |
| Depends on | Adapter conformance suite (`packages/testkit/src/conformance/harness.ts`) | The opencode registration must build over the streaming seam. |
| Depends on | `opencode` CLI v2.2.5 | The pinned external stream contract. |
| Blocks | M1-S9 engine path on the installed harness | Dispatch cannot spawn a real opencode session until this lands. |
| Blocks | Any later harness telemetry or liveness work that needs a live opencode session | Those paths remain unexercised until a session can be acquired. |

## 14. OPEN QUESTIONS

None. Every decision needed for delivery is resolved in §15. No `@decision-advisor` consultation is required because the delivered session port and one-shot runner contract remain unchanged, and the additive streaming seam is recorded in this decision log.

| ID | Question | Context | Status |
|---|---|---|---|
| — | None | — | Resolved |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | Add a new streaming starter seam (`HarnessSpawnStarter` → `HarnessSpawnStream` with lines, completion, acquired signal, and kill) beside the unchanged one-shot `HarnessSpawnRunner`; do not reshape the existing runner. The opencode adapter uses the starter for spawn/resume/deliver and the runner only for session listing. | A completion-gated one-shot runner cannot express "handle now, completion later". Reshaping it would force listing and Claude onto a streaming model they do not need and would change a delivered contract. The session port stays unchanged, so ADR-0008 DC-2 is satisfied: the lifecycle operations stay behind the same port and no engine gains a harness branch. No new TDR is required because the delivered runner contract shape is unchanged; this decision log records the additive seam. | 2026-11-08 |
| DEC-2 | Resume and deliver use the same non-blocking acquisition. The caller's handle identity is preserved; the stream identifier must match it; no-identifier and mismatch map to the existing `harness.session.unknown`. A session that acquires and later exits non-zero is post-handle evidence, not an acquisition failure. | A resumed lifecycle is equally multi-hour. Preserving identity prevents a silent lane switch. The accepted consequence is that a mid-session resume failure is classified through collected evidence instead of collapsing into an acquisition refusal; dispatch already handles post-spawn evidence with no change. | 2026-11-08 |
| DEC-3 | The remaining bound governs handle acquisition only: default `60_000` ms from child start to the acquired signal. There is no whole-session timeout by default (`sessionTimeoutMs` absent or `0` means unbounded); it remains an injected optional safety bound. The 60 s figure is justified because a healthy CLI emits its first event within seconds and the bound covers only startup and first output, not model work. | A real 11-phase lifecycle runs for hours, so any fixed minute-scale session cap reintroduces the defect at a larger number. Progress-based liveness and the restart budget own session termination. The acquisition bound prevents a silent hang before a handle exists. | 2026-11-08 |
| DEC-4 | JSONL parsing contract: split stdout on LF, strip CR, skip blank lines, parse each line independently, scan past non-JSON lines while searching, and take the first line carrying an identifier with precedence `sessionID`, `session.id`, `sessionId`, `id`. Identifier found → acquire and return immediately. No identifier at stream end → `harness.spawn.refused` when status is non-zero or the acquisition timed out, else `harness.spawn.invalid-output`. Non-zero exit after acquisition → handle returned and evidence carries the exit. Truncation after acquisition keeps the handle; a lost terminal `step_finish` yields premature end, not completion. Resume no-identifier or identity mismatch → `harness.session.unknown`. No new failure codes. | Every observed and required stream case maps to an existing closed code, so the error vocabulary, classifier, and dispatch failure table stay intact. Scanning past malformed lines matches the ticket's "first line carrying a session identifier" and tolerates leading noise. | 2026-11-08 |
| DEC-5 | Evidence and collect: the adapter stores a per-session completion promise; `collect` awaits it and returns evidence only at completion. `completionMarker` is true only when exit status is 0, the session did not time out, and the final decoded `step_finish` carries `part.reason === "stop"`. `exitStatus` is the close status; `timedOut` is the host kill flag; `spawnRefused` is never set on a session that produced an identifier; `failureReported` and `toolFailure` are set only from explicit failure/tool-error facts present in the pinned stream, otherwise false. An abnormal end never reports completion. Liveness stays sourced from injected facts as today. | Evidence must describe a finished session and must not fabricate completion. Reusing the unchanged evidence type avoids a new classification path. | 2026-11-08 |
| DEC-6 | Process hygiene: the host streaming starter is the only child-process site and implements an idempotent `kill`. The adapter calls `kill` on every failed acquisition and on abandonment; completion resolves on close or error and never rejects. Kill sends `SIGTERM` and escalates to `SIGKILL` after a short grace period, so an unresponsive child cannot outlive the stream. No direct spawn is added to the adapter. | Prevents orphaned children and preserves the single-site conformance invariant. | 2026-11-08 |
| DEC-7 | The dispatch engine needs no change. `packages/core/src/app/dispatch.ts` is not modified; its collapse of any pre-session spawn/resume failure to `dispatch.session.spawn-failed` remains correct because a healthy CLI now returns a handle before that branch. The error vocabulary, classifier, result tokens, queue, scheduler, and command surface are untouched. | Explicit scope boundary requested by the ticket and the PM intake. Keeps the fix behind the adapter and the port. | 2026-11-08 |
| DEC-8 | `version_impact` is `minor`. The binding reason is the `TC-RELEASE-001` release invariant (`tests/checks/privacy-release.test.ts`): any branch whose diff touches `packages/**` must add exactly one changeset declaring exactly the five fixed-group packages — `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode` (testkit excluded) — at `minor`, and a `patch` entry for any of them fails validation. This change touches `packages/core`, `packages/adapters`, `packages/cli`, and `packages/testkit`, so the gate applies. The separate judgment still holds: the change fixes delivered behavior and adds an internal contract type without changing any public CLI, token, error, or persisted contract. | The changeset gate, not a consumer-visible semantic change, binds the declared impact: the fixed five-package `minor` block is the repository's lockstep release convention (precedent: `.changeset/gh-273-queue-repository-binding-minor.md`, also a `fix` change). Note: `minor` therefore reflects the lockstep release convention rather than a consumer-visible API addition. | 2026-11-08 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Harness contract (`packages/core/src/contracts/harness.ts`) | Updated: additive streaming starter types; runner, evidence, port, and failure codes unchanged. |
| opencode adapter (`packages/adapters/src/harness/opencode.ts`) | Updated: JSONL parsing, `sessionID`, non-blocking spawn/resume/deliver, completion-scoped evidence. |
| Host runner (`packages/adapters/src/host/index.ts`) | Updated: streaming starter implementation beside the unchanged one-shot runner; still the single child-process site. |
| Claude Code adapter (`packages/adapters/src/harness/claude.ts`) | Unchanged; verified regression-free. |
| CLI production composition (`packages/cli/src/production.ts`) | Updated: bind the streaming starter for opencode; keep the one-shot runner for listing. |
| Adapter conformance registry (`packages/testkit/src/conformance/harness.ts`) | Updated: opencode registration builds over the streaming seam and JSONL fixtures; Claude registration unchanged. |
| Harness test suites (`tests/behaviour`, `tests/structure`, `tests/types`, `tests/fixtures/harness`) | Updated/new: real-shape JSONL, non-blocking acquisition, long-running simulation, malformed/no-id/non-zero/truncated cases, type coverage. |
| Release metadata (`.changeset/gh-275-opencode-harness-contract-minor.md`) | Added: exactly one changeset declaring the five fixed-group packages (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) at `minor` with a non-empty body; no pre-existing changeset modified (TC-RELEASE-001). |
| Dispatch engine (`packages/core/src/app/dispatch.ts`) | Unchanged; no branch, error, or token change. |
| Current-truth feature specs (`doc/spec/features/feature-harness-adapters.md`, `feature-dispatch-engine.md`, adapter ports if the contract table lists the seam) | Updated in the `system_spec_update` phase. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** stdout containing the three real-shape JSONL lines (`step_start`, `text`, `step_finish`) with a top-level `sessionID`, **when** spawn runs, **then** the returned handle carries that `sessionID` as `sessionId` and `treeRoot`. | F-1 |
| AC-F1-2 | **Given** leading blank lines and a malformed non-JSON line before a valid `step_start` line, **when** the stream is scanned, **then** the valid line's identifier is used and no failure is raised. | F-1 |
| AC-F1-3 | **Given** a stream that ends without any identifier and exits 0, **when** spawn completes, **then** it returns `harness.spawn.invalid-output` and no fabricated handle. | F-1, NFR-3 |
| AC-F1-4 | **Given** a stream that ends without any identifier and exits non-zero or hits the acquisition bound, **when** spawn completes, **then** it returns `harness.spawn.refused` carrying the observed status and timeout flag. | F-1, F-5 |
| AC-F1-5 | **Given** an identifier on an early line and a later non-zero exit, **when** the session closes, **then** the handle was already returned and `collect` evidence carries the non-zero `exitStatus`, which the shared classifier maps to `failed`. | F-1, F-4 |
| AC-F1-6 | **Given** stdout truncated at the 16 MiB bound after the identifier was observed but before the terminal `step_finish`, **when** `collect` runs, **then** the handle remains valid and `completionMarker` is false, yielding premature end with no new failure code. | F-1, F-4, NFR-6 |
| AC-F1-7 | **Given** a single-line JSON document carrying `session.id`, `sessionId`, or `id`, **when** spawn runs, **then** the identifier is still accepted. | F-1, NFR-3 |
| AC-F2-1 | **Given** a simulated session whose completion resolves after more than 300 s of virtual time, **when** spawn is called, **then** it resolves with a handle as soon as the first identified line is delivered, before completion. | F-2, NFR-2 |
| AC-F2-2 | **Given** a handle returned by spawn, **when** `collect` is called before completion, **then** it remains pending and returns the completion evidence only after the session closes. | F-2, F-4 |
| AC-F2-3 | **Given** the adapter source, **when** the neutrality and import scans run, **then** no `node:child_process`, `node:*`, timer, or ambient runtime API appears in the adapter and the session port has no new operation. | F-2, F-6, NFR-4 |
| AC-F3-1 | **Given** an existing handle and a resumed stream whose first identified line carries the same `sessionId`, **when** `resume`/`deliver` is called, **then** it returns the existing handle identity without waiting for completion. | F-3 |
| AC-F3-2 | **Given** a resumed stream with no identifier within the bound, **when** resume completes, **then** it returns `harness.session.unknown` with the observed status. | F-3, NFR-3 |
| AC-F3-3 | **Given** a resumed stream that identifies a different session than the caller's handle, **when** resume completes, **then** it returns `harness.session.unknown` and never silently switches lanes. | F-3 |
| AC-F3-4 | **Given** a resumed session that acquires its handle and later exits non-zero, **when** the session closes, **then** the handle was returned and `collect` evidence carries the exit, yielding a classifier failure rather than an acquisition refusal. | F-3, F-4 |
| AC-F4-1 | **Given** exit status 0 and a final decoded `step_finish` with `part.reason === "stop"`, **when** `collect` runs, **then** evidence has `completionMarker: true`, `exitStatus: 0`, and `timedOut: false`. | F-4 |
| AC-F4-2 | **Given** exit status 0 but no terminal `step_finish`, **when** `collect` runs, **then** `completionMarker` is false and the classifier yields premature end. | F-4 |
| AC-F4-3 | **Given** exit status 0, a terminal `step_finish`, and an explicit tool-error fact in the stream, **when** `collect` runs, **then** evidence has `completionMarker: true` and `toolFailure: true`, projecting the completed-with-tool-failure classification (delivery token `partial`). | F-4 |
| AC-F4-4 | **Given** an abnormal end (non-zero exit, timeout, or kill), **when** `collect` runs, **then** `completionMarker` is false and the observed abnormal facts are reported. | F-4 |
| AC-F4-5 | **Given** a session with no collected facts, **when** `collect` is called, **then** it returns `harness.session.unknown` and never fabricates evidence. | F-4 |
| AC-F5-1 | **Given** no identified line within the handle bound, **when** the bound expires, **then** the child is killed, `timedOut` is true, and spawn maps to the existing pre-session refusal. | F-5, NFR-1 |
| AC-F5-2 | **Given** every failed acquisition or abandoned stream in the fake starter, **when** the case ends, **then** `kill` was called and no child remains. | F-5, NFR-7 |
| AC-F5-3 | **Given** a session that runs longer than 300 s with no session bound configured, **when** it continues, **then** it is not killed and `collect` eventually returns its evidence. | F-5, NFR-2 |
| AC-F6-1 | **Given** the production composition, **when** the harness port is built, **then** opencode receives the streaming starter and the one-shot runner for listing, and Claude Code receives only the one-shot runner. | F-6 |
| AC-F6-2 | **Given** the new contract types, **when** typecheck and boundary checks run, **then** the contract module remains type-only data, the session port shape is unchanged, and the child-process allowlist equality still passes with one site. | F-6, NFR-4, NFR-9 |
| AC-F7-1 | **Given** the committed real-shape JSONL fixture, **when** the contract tests run, **then** they assert line-independent parsing, top-level `sessionID` acquisition, and the retained fallback shapes. | F-7 |
| AC-F7-2 | **Given** the simulated long-running fixture, **when** the behaviour tests run, **then** they assert handle-before-completion and completion-scoped `collect` deterministically, with no wall-clock race. | F-7, NFR-2, NFR-5 |
| AC-F7-3 | **Given** malformed, blank-leading, no-id, non-zero, truncated, and resume-mismatch fixtures, **when** the behaviour tests run, **then** each maps to the code and evidence stated in DEC-4 and DEC-5. | F-7, NFR-3 |
| AC-F7-4 | **Given** the type tests, **when** they compile, **then** `HarnessSpawnStarter`/`HarnessSpawnStream` accept the host implementation and the unchanged `HarnessSessionPort` still accepts the opencode port. | F-7, NFR-9 |
| AC-F8-1 | **Given** the installed healthy opencode CLI and a real ticket, **when** one `dispatch <ref>` runs, **then** it reaches classification with any result token and its `lastMessage` is not `spawn failed before a session existed`. | F-8, NFR-8 |
| AC-F8-2 | **Given** the end-to-end proof, **when** it is executed, **then** it is bounded (probe-scale prompt or session ended after the handle is observed) and creates no nested lifecycle mutation in this change's worktree. | F-8, RSK-1 |

**Ticket acceptance traceability**

| Ticket acceptance bullet | Acceptance criteria |
|---|---|
| `dispatch` acquires a handle from the real `opencode run --format json` output and never reports `spawn failed before a session existed` for a healthy CLI. | AC-F1-1, AC-F2-1, AC-F8-1 |
| The adapter does not depend on the CLI exiting before a handle is available. | AC-F2-1, AC-F2-2, AC-F3-1 |
| Regression tests pin the JSONL contract and the `sessionID` field. | AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4 |
| End-to-end proof: one real dispatch reaches classification rather than `dispatch.session.spawn-failed`. | AC-F8-1, AC-F8-2 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Deliver as one change on `fix/GH-275/opencode-harness-contract` with a single pull request to `main-tools`.
- No migration, feature flag, staged rollout, or configuration change is required. The fix takes effect when the adapter and composition ship.
- Release obligation: add exactly one changeset, `.changeset/gh-275-opencode-harness-contract-minor.md`, declaring the five fixed-group packages (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) at `minor`, with a non-empty body, and modify no pre-existing changeset. This satisfies the `TC-RELEASE-001` invariant that binds any branch touching `packages/**`; the plan owns the file.
- The change is independently shippable: it does not depend on another in-flight change and does not require the dispatch engine to move first.
- After merge, re-run one real dispatch as the production proof and record the observed result token.
- Communicate the operational consequence: a healthy spawn now returns before completion, so the dispatch liveness watch becomes observable during the session; a hard-stalled session without a session bound is handled by liveness and restart policy, not by a five-minute process kill.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No stored data is migrated, seeded, rewritten, or invalidated. No schema version changes.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. The change reads an existing child-process stdout stream and adds no personal-data field, no new storage, no new external recipient, and no retention. Prompt and stream content are not logged or persisted. The existing redaction and credential boundaries are unchanged.

## 21. SECURITY REVIEW HIGHLIGHTS

- The single child-process boundary is preserved; the adapter never spawns directly and still receives the constructed environment as data.
- The deny-by-default execution environment, credential reference handling, and stdin prompt delivery are unchanged.
- The new parser accepts only structured identifiers and returns closed failure identities; it never interpolates raw stream content into an error, log, or command.
- The stdout bound remains 16 MiB, so a hostile or runaway stream cannot grow adapter memory without limit.
- Kill is idempotent and limited to the child the starter created.
- No new dependency, network call, file write, or ambient environment read is introduced.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The real stream shape is pinned in a committed fixture and tied to `opencode v2.2.5`; a CLI change that alters event framing, the `sessionID` field, or `step_finish.part.reason` must update the fixture and the mapping deliberately.
- The streaming starter adds one seam to maintain beside the one-shot runner; both share the same host subpath and output bound.
- Operators gain no new configuration key. The optional session bound is an injected adapter option for tests and future policy.
- A hard-stalled session without a session bound relies on liveness, restart budget, and daemon supervision; this is recorded as a residual operational risk.
- The `system_spec_update` phase must reconcile the opencode adapter paragraph and host-runner narrative in `feature-harness-adapters.md`, the spawn/timeout narrative in `feature-dispatch-engine.md`, and any contract table that lists the harness spawn seam.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| JSONL | Newline-delimited JSON: one complete JSON object per line, parsed independently. |
| `sessionID` | The top-level session identifier field emitted by the real opencode JSONL stream. |
| Handle acquisition | The moment the adapter has a valid `HarnessSessionHandle` and can return from `spawn`/`resume`; it precedes session completion. |
| Streaming starter | The new injected child-process seam that exposes stdout lines, a completion promise, an acquired signal, and an idempotent kill. |
| One-shot runner | The existing injected `HarnessSpawnRunner` that resolves once at process close; retained for session listing and the Claude adapter. |
| Completion evidence | The `HarnessEvidence` derived only after the session process closes; never produced for an in-flight session. |
| Pre-session refusal | A spawn/resume failure before any session identifier exists; maps to `harness.spawn.refused` or `harness.session.unknown` and, in dispatch, to `dispatch.session.spawn-failed`. |
| Premature end | A session that ended without a completion marker; classified as `partial`, never as completed. |
| Handle bound | The 60 s default bound from child start to handle acquisition. |
| Session bound | An optional whole-session timeout, disabled by default. |

## 24. APPENDICES

### A. Real stream sample (from the ticket)

```jsonl
{"type":"step_start","timestamp":...,"sessionID":"ses_e430b0300ffe...","part":{...}}
{"type":"text","timestamp":...,"sessionID":"ses_e430b0300ffe...","part":{...}}
{"type":"step_finish","timestamp":...,"sessionID":"ses_e430b0300ffe...","part":{...}}
```

### B. Contract type sketch (types only; no implementation)

```ts
export type HarnessSpawnStreamOptions = {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly stdin?: string;
  readonly handleTimeoutMs: number;
  readonly sessionTimeoutMs?: number; // absent or 0 = unbounded
};

export type HarnessSpawnStream = {
  readonly lines: AsyncIterable<string>;
  readonly completion: Promise<HarnessSpawnRunnerResult>;
  readonly acquired: () => void;
  readonly kill: () => void;
};

export type HarnessSpawnStarter = (
  file: string,
  args: readonly string[],
  options: HarnessSpawnStreamOptions,
) => HarnessSpawnStream;
```

Unchanged: `HarnessSpawnRunner`, `HarnessSpawnRunnerResult`, `HarnessSessionHandle`, `HarnessSessionPort`, `HarnessEvidence`, `HARNESS_FAILURE_CODES`.

### C. Failure mapping summary

| Case | Identity | Session record |
|---|---|---|
| No identifier, exit 0 | `harness.spawn.invalid-output` | None |
| No identifier, exit non-zero | `harness.spawn.refused` | None |
| No identifier, acquisition bound expired | `harness.spawn.refused` (timedOut) | None |
| Identifier found, later non-zero exit | None at acquisition; evidence exit non-zero | Present; classifier `failed` |
| Identifier found, truncated before terminal `step_finish` | None at acquisition; evidence premature end | Present |
| Resume no identifier | `harness.session.unknown` | None |
| Resume identifier mismatch | `harness.session.unknown` | None |

### D. Diagnostic evidence index

The root-cause and current-state evidence in §2.1 cites the adapter, host runner, composition, dispatch, contract, Claude adapter, and the bash precedent. These are diagnostic references, not implementation tasks; the delivery plan owns the exact edit sequence.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-08 | `@spec-writer` | Initial specification for GH-275. |
| 1.1 | 2026-11-08 | `@spec-writer` | Corrected `version_impact` from `patch` to `minor` (front matter and DEC-8), added the changeset release obligation in §18, and added the changeset to the affected list in §16. Evidence: the `TC-RELEASE-001` invariant in `tests/checks/privacy-release.test.ts` requires exactly one added changeset declaring the five fixed-group packages at `minor` for any branch whose diff touches `packages/**`; precedent `.changeset/gh-273-queue-repository-binding-minor.md`. No AC, F-, NFR-, RSK-, or DEC identifier changed; the 30 acceptance criteria and the traceability table are unchanged. |

---

## AUTHORING GUIDELINES

This specification was authored from the GH-275 ticket, the PM's verified root-cause evidence, and the delivered harness contract, host runner, opencode and Claude adapters, dispatch engine, ADR-0008, and the current feature specs. It deliberately resolves the six design questions the ticket raised as DEC-1 through DEC-6, keeps the dispatch engine and all closed vocabularies untouched (DEC-7), and confines the fix behind the harness session port. Implementation sequencing, test file placement, fixture mechanics, and the bounded end-to-end proof procedure belong to the plan and test plan.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-275`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation tasks or step-by-step delivery instructions
- [x] No content duplicated from linked docs
- [x] Front matter validates per `front_matter_rules`
