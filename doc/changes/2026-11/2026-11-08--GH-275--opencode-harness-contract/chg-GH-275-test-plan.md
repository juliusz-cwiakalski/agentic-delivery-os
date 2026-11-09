---
id: chg-GH-275-test-plan
status: Updated
version: 1.4
created: 2026-11-08T22:40:00Z
last_updated: 2026-11-09T01:10:00Z
owners: [engineering]
service: delivery-os harness adapters
labels: [change, harness, bug, dispatch]
links:
  change_spec: ./chg-GH-275-spec.md
  implementation_plan: ./chg-GH-275-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
version_impact: minor
summary: "Forty-six scenarios verifying GH-275: JSONL stream decoding and top-level sessionID acquisition, a non-blocking handle returned on the first identified line, completion-scoped collect with explicit legacy-envelope evidence precedence, identity-preserving non-blocking resume/deliver, a bounded handle-acquisition wait with no default whole-session bound and leak-free cleanup, the additive streaming-starter seam beside the unchanged one-shot runner and session port, conformance and type pinning of the real opencode v2.2.5 stream (including the retained six-case legacy classification floor and the pinned tool_use-error and error-event encodings), regression guards for the Claude adapter, session listing and the dispatch engine, and one bounded operator-run real-CLI dispatch proof. Every automated scenario is hermetic: zero real harness CLI invocations, all stream facts injected, and a long session simulated in virtual time so a regression fails by assertion, not by timeout."
---

# Test Plan - Fix opencode harness spawn: parse the JSONL stream and acquire the session handle without blocking on completion

## 1. Scope and Objectives

This plan protects one defect and four anti-recurrence claims that must be impossible to reintroduce silently. The defect is that a healthy `opencode run --format json` session cannot be spawned: the adapter `JSON.parse`s the whole stdout, never reads the top-level `sessionID`, awaits process close before returning a handle, and enforces a 300 s whole-session cap, so every dispatch collapses to `dispatch.session.spawn-failed`. The four anti-recurrence claims are: (a) the adapter decodes a JSONL stream line-independently and takes the identifier from the top-level `sessionID` (with the previously accepted fallbacks retained); (b) `spawn` returns a `HarnessSessionHandle` as soon as the first identified line arrives, before completion, and `collect` resolves only at completion; (c) resume/deliver acquire the same way while preserving the caller's handle identity; and (d) the remaining bound governs handle acquisition only, the host starter is the single child-process site, and every failed or abandoned acquisition kills its child.

The change is additive behind an unchanged session port (DEC-1) and leaves `packages/core/src/app/dispatch.ts`, the Claude adapter, the failure-code vocabulary, the classifier, and the delivery-result tokens untouched (DEC-7, NG-2, NG-3, NG-4). The test plan therefore has to prove two things at once: the new stream path works, and none of the preserved contracts moved. Both are gating.

The most dangerous testing mistakes this plan is designed against are: proving the fix with a fixture that encodes the same imagined single-document shape the defect assumed; "proving" non-blocking acquisition with a real wait, so the test is slow, flaky, or hangs instead of failing; leaving the long-session case untested because it needs hours; accepting a `collect` that returns in-flight evidence; losing the identity check on resume; and letting a nested real lifecycle mutate this change's worktree during the end-to-end proof.

### 1.1 In Scope

- JSONL decoding: LF split, CR strip, blank-line skip, per-line independent parse, scanning past non-JSON and non-object lines, identifier precedence `sessionID` → `session.id` → `sessionId` → `id`, and the retained single-document degenerate form (F-1, AC-F1-1..AC-F1-7, DEC-4).
- Non-blocking spawn acquisition: handle on the first identified line, `harnessKind: "opencode"`, `treeRoot` equal to the session id, `workItemRef` from input, no token or raw payload in the handle (F-2, AC-F2-1, AC-F2-2, AC-F2-3, DEC-1).
- Completion-scoped evidence: a per-session completion promise, `collect` pending before completion, no fabricated completion, and an explicit **source precedence** — a legacy single-document `result` envelope's facts (`completion`/`completed`, `refused`, `failure`/`status`, `toolFailure`) are authoritative, otherwise the JSONL rules apply (`completionMarker` only on exit 0 plus a terminal `step_finish` with `part.reason === "stop"`; `toolFailure` only from a `tool_use` part with `state.status === "error"`; `failureReported` only from an explicit failure fact — a JSONL `error` event or a legacy `result.failure`/`result.status` fact — never from the process exit), with the host `exitStatus`/`timedOut` merged on top (F-4, AC-F4-1..AC-F4-5, AC-F1-7, DEC-5). A non-zero exit is carried by `exitStatus` alone and classifies `failed` through the classifier's exit branch (`packages/core/src/domain/harness-classify.ts:50-52`); it is never copied into `failureReported`. `spawnRefused` is reachable on an identified session only through that legacy envelope; the JSONL path never sets it.
- Non-blocking resume/deliver with identity preservation: stream id must equal the caller's handle id; no-identifier and mismatch map to the existing `harness.session.unknown`; a post-handle non-zero exit is evidence, not an acquisition refusal (F-3, AC-F3-1..AC-F3-4, DEC-2).
- Bounds and hygiene: `handleTimeoutMs` default 60 s, `sessionTimeoutMs` absent/0 means unbounded, no 300 s whole-session cap on spawn/resume, idempotent kill on every failure and abandonment path, no orphaned child (F-5, AC-F5-1..AC-F5-3, DEC-3, DEC-6).
- The additive streaming starter seam in the runtime-neutral contract tier, the host implementation in the single child-process site, and the composition binding that gives opencode the starter plus the one-shot runner for listing and gives Claude only the one-shot runner (F-6, AC-F6-1, AC-F6-2, DEC-1, DEC-6).
- Contract, behaviour, conformance, and type pinning of the real v2.2.5 stream shape (F-7, AC-F7-1..AC-F7-4).
- One bounded operator-run real-CLI dispatch proof that reaches classification (F-8, AC-F8-1, AC-F8-2, RSK-1, RSK-2).

### 1.2 Out of Scope and Known Gaps

- **[OUT] No requirement change.** Every scenario derives from spec §5, §9, §15, and §17. No new failure code, delivery-result token, classifier rule, error-table row, configuration key, persisted shape, or CLI command is expected or tested for (NG-2, NG-3, NG-7, §8.5).
- **[OUT] Dispatch engine behaviour is not redesigned.** The only dispatch cases here are regressions: the pre-session failure identity and its `lastMessage` are unchanged, and a healthy acquisition is watched and classified (NFR-8, AC-F8-1). No test asserts a new dispatch branch.
- **[OUT] The Claude Code adapter's contract is not re-specified.** Its suite runs unchanged; only its opencode helper in the shared parity test is rewired to the fake stream (AC-F6-1, RSK-6).
- **[OUT] The bash stack is not exercised as an oracle.** `scripts/opencode-session.sh` already reads the first `.sessionID` line; the typed adapter is aligned to it by contract, not by script execution (§7.2 [OUT]). Its own suites run as a non-TC regression run (§6.4).
- **[OUT] No live-harness tier in CI.** NFR-5 forbids real CLI invocations in unit, behaviour, conformance, and type suites. The single real-CLI proof is the operator-run procedure in §6.3 (GAP-T1).
- **[OUT] No new telemetry, spend, liveness sourcing, or streaming per-event reporting** (NG-5, NG-8, spec §10). Liveness stays sourced from injected facts as today.
- **[GAP-T1 — the real CLI is proven once, manually]** AC-F8-1/AC-F8-2 cannot run in a deterministic suite: they need a live model session. They are proven by the bounded procedure in §6.3 during delivery (and re-run after merge), with recorded evidence in §10. No AC depends on a live CLI except AC-F8-1/AC-F8-2.
- **[GAP-T2 — closed by spec v1.2, rule finalised in v1.3]** The v2.2.5 failure encodings are no longer delivery-bound. Spec §8.4, F-4, F-7 and DEC-5 name them: a tool failure is a `tool_use` event whose `part.state.status === "error"`, and a stream/agent failure is an `error` event. Spec v1.3 fixes one `failureReported` rule — true only on an explicit failure fact (a JSONL `error` event or a legacy `result.failure`/`result.status` fact), never from a non-zero exit, which `exitStatus` carries. The pinned fixture set must carry one dedicated case for each encoding, and TC-OCS-042/TC-OCS-047 (tool) and TC-OCS-048 (stream error, including its non-zero-exit control) make AC-F4-3/AC-F4-4 fail if the adapter ignores either encoding. OQ-T1 is resolved in §8.3.
- **[GAP-T3 — evidence provenance is not observable from outside]** `completionMarker` is asserted through the public `collect` result, not by reading the adapter's internal terminal-fact record. The anti-fabrication table (TC-OCS-045) is the oracle for every combination; the internal representation is free.

### 1.3 Risk-Based Prioritization

**Must-pass (AC-gating).** Every scenario below is must-pass; the change is small and every claim in the ticket maps to one of them. The following are the leading indicators whose failure reopens the design rather than just the test: `TC-OCS-010` (real stream acquisition), `TC-OCS-020` (handle before completion in virtual time), `TC-OCS-021` (`collect` is completion-scoped), `TC-OCS-030`–`TC-OCS-033` (resume identity), `TC-OCS-040`–`TC-OCS-048` (evidence semantics, legacy precedence, and the two pinned failure encodings), `TC-OCS-050`–`TC-OCS-052` (kill and orphan hygiene), `TC-OCS-060` (composition), `TC-OCS-062` (the retained six-case legacy classification floor plus `TC-HARN-010`), `TC-OCS-082` (dispatch regression), and `TC-OCS-100`/`TC-OCS-101` (the real proof).

**Supplemental but still gating.** `TC-OCS-001`–`TC-OCS-005` (structure and the pinned fixture), `TC-OCS-070` (type), `TC-OCS-071` (hermeticity meta-check), `TC-OCS-072` (fixture non-vacuity), `TC-OCS-080`/`TC-OCS-081` (preserved adapters), and `TC-OCS-053` (bounds wiring). They fail loudly and cheaply, so they must stay green while iterating.

### 1.4 Binding Judgment Calls Enforced by This Plan

| # | Judgment call | Where enforced |
|---|---|---|
| 1 | The real stream is pinned as a committed JSONL fixture whose first line carries a top-level `sessionID`; the fixture is the only stream oracle for the adapter suites. | `TC-OCS-005`, `TC-OCS-010`, `TC-OCS-072` |
| 2 | Identifier precedence is `sessionID` → `session.id` → `sessionId` → `id`; the single-document forms remain accepted. | `TC-OCS-017` |
| 3 | "Non-blocking" is proven with a fake stream whose `completion` resolves only when the test says so, plus a virtual clock advanced past 300 s; a completion-gated regression fails an assertion after a bounded microtask flush and never hangs. | `TC-OCS-020`, `TC-OCS-021`, `TC-OCS-023` |
| 4 | Long-session proof uses virtual time only: no `sleep`, no wall-clock wait, no timer in the adapter. | `TC-OCS-020`, `TC-OCS-023`, `TC-OCS-071` |
| 5 | `collect` returns evidence only at completion; before completion it stays pending and never returns partial facts. | `TC-OCS-021`, `TC-OCS-045` |
| 6 | A post-handle non-zero exit is evidence (classifier `failed`), never an acquisition refusal. | `TC-OCS-015`, `TC-OCS-033` |
| 7 | Resume no-identifier and resume identity mismatch both map to the existing `harness.session.unknown`; no new code. | `TC-OCS-031`, `TC-OCS-032` |
| 8 | Completion requires exit 0 plus a terminal `step_finish` with `part.reason === "stop"`; truncation or a missing terminal event yields premature end. | `TC-OCS-016`, `TC-OCS-041`, `TC-OCS-043` |
| 9 | No whole-session default bound; the 60 s bound covers handle acquisition only; listing keeps its own one-shot timeout. | `TC-OCS-053`, `TC-OCS-023` |
| 10 | The adapter has no `node:*`/`bun:*` import, no timer, and no ambient runtime API; `node:child_process` remains exactly one allowlisted site in `packages/adapters/src/host/index.ts`. | `TC-OCS-003`, `TC-OCS-052` |
| 11 | "Dispatch unchanged" is a semantic invariant plus a behavioural case, not a file hash or a branch diff (testing-strategy: no moving-base diff assertions). | `TC-OCS-004`, `TC-OCS-082` |
| 12 | The end-to-end proof runs in a scratch clone outside this worktree, kills only its own `opencode` child after the handle window, and never lets a nested lifecycle touch this change's worktree. | `TC-OCS-100`, `TC-OCS-101`, §6.3 |
| 13 | The host starter's real-child cases spawn the Bun runtime as a synthetic child, never `opencode`/`claude`; NFR-5 is about harness CLIs. | `TC-OCS-052`, §6.1 |
| 14 | A legacy single-document `result` envelope's evidence facts are authoritative over the JSONL rules; host `exitStatus`/`timedOut` always merge on top, and `spawnRefused` is reachable on an identified session only through that envelope. | `TC-OCS-046`, `TC-OCS-061`, `TC-OCS-062` |
| 15 | The pinned fixture carries the real v2.2.5 failure encodings — a `tool_use` part with `state.status === "error"` and an `error` event — in dedicated cases, so AC-F4-3/AC-F4-4 fail if either is ignored. | `TC-OCS-042`, `TC-OCS-047`, `TC-OCS-048` |

## 2. References

- **Change specification**: [chg-GH-275-spec.md](./chg-GH-275-spec.md) — F-1..F-8, AC-F1-1..AC-F8-2 (30 ACs), NFR-1..NFR-9, DEC-1..DEC-8, RSK-1..RSK-9, §6 flows 1–4, §8.4 external contract, §12 assumptions, Appendix B (contract type sketch), Appendix C (failure mapping).
- **Implementation plan**: [chg-GH-275-plan.yaml](./chg-GH-275-plan.yaml) — authored after this file (phase 4). Where the plan and this test plan disagree on file placement, this plan's §7.1 names the required files and the plan owns sequencing.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun test` over `tests/**/*.test.ts`, fixtures never named `*.test.ts`, no moving-base diff assertions, permanent invariants as tree assertions, boundaries via `pnpm check:boundaries`, aggregate gate `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, no `any`/`!`/unjustified `as`, injected fakes over `mock.module`, deterministic tests with no real clock/network/`$HOME`/sleeps, optional props modelled as absent.
- **Delivered harness contract**: [packages/core/src/contracts/harness.ts](../../../../packages/core/src/contracts/harness.ts) — `HarnessSpawnRunner`, `HarnessSpawnRunnerResult`, `HarnessSessionPort`, `HarnessEvidence`, `HARNESS_FAILURE_CODES` (all unchanged), and the additive starter seam.
- **Delivered fixtures and suites**: `tests/fixtures/harness/harness-io.ts` (`createRecordingRunner`, `runnerResult`, `output`, `classifier`, `assembleLiveness`, `SPAWN_ARGS`, `RESUME_ARGS`, `LIST_ARGS`, `TIMEOUT_MS`), `tests/behaviour/harness-opencode-session.test.ts`, `tests/behaviour/harness-claude-session.test.ts`, `tests/structure/harness-imports.test.ts` (the exact 12-entry `node:child_process` allowlist), `tests/types/harness.type-test.ts`, `tests/conformance/harness-classification.test.ts`, `tests/fixtures/harness/scenarios/classification.ts`, `packages/testkit/src/conformance/harness.ts`.
- **Dispatch regression fixtures**: `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario`, `readsFrom`, `collectAfterPolls`, `livenessOf`), `tests/fixtures/dispatch/harness.ts` (`createScriptedHarness`, `COMPLETED_EVIDENCE`), `tests/structure/dispatch-composition.test.ts` (production composer over injected seams).
- **ADR-0008**: harness adapter contract — DC-2 is satisfied because the session port and lifecycle operations are unchanged. The additive streaming seam is record-governed at R2 by [TDR-0016](../../../../doc/decisions/TDR-0016-harness-streaming-spawn-seam.md); the change decision log (DEC-1) summarises it and does not replace it.
- **Bash precedent**: `scripts/opencode-session.sh` (`extract_session_id`) — the first-line `.sessionID` behaviour the typed adapter is aligned to; unchanged by this change.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | Three real-shape JSONL lines with a top-level `sessionID`; the returned handle carries it as `sessionId` and `treeRoot`. | TC-OCS-010, TC-OCS-022 | Covered |
| AC-F1-2 | Leading blank lines and a malformed non-JSON line before a valid `step_start`; the valid identifier is used, no failure. | TC-OCS-011 | Covered |
| AC-F1-3 | Stream ends with no identifier and exit 0 → `harness.spawn.invalid-output`, no fabricated handle. | TC-OCS-012 | Covered |
| AC-F1-4 | No identifier with non-zero exit or acquisition-bound expiry → `harness.spawn.refused` with the observed status and, for the bound case, a summary naming the acquisition timeout (the starter result carried `timedOut: true`; `HarnessFailure` has no timeout field). | TC-OCS-013, TC-OCS-014 | Covered |
| AC-F1-5 | Identifier on an early line and a later non-zero exit; the handle was already returned and `collect` evidence carries the exit → classifier `failed`. | TC-OCS-015 | Covered |
| AC-F1-6 | Truncation at the 16 MiB bound after acquisition but before the terminal `step_finish`; handle valid, `completionMarker` false, premature end, no new code. | TC-OCS-016, TC-OCS-045 | Covered |
| AC-F1-7 | A single-line JSON document carrying `session.id`, `sessionId`, or `id` is still accepted; when it also carries a legacy `result` object, that envelope's `completionMarker`/`spawnRefused`/`failureReported`/`toolFailure` facts are authoritative, merged with host `exitStatus`/`timedOut`. | TC-OCS-017, TC-OCS-046, TC-OCS-062 | Covered |
| AC-F2-1 | A simulated session completing after more than 300 s of virtual time resolves with a handle on the first identified line, before completion. | TC-OCS-020, TC-OCS-022, TC-OCS-082 | Covered |
| AC-F2-2 | `collect` called before completion stays pending and returns completion evidence only after the session closes. | TC-OCS-021 | Covered |
| AC-F2-3 | No `node:child_process`, `node:*`, timer, or ambient runtime API in the adapter; the session port has no new operation. | TC-OCS-001, TC-OCS-002, TC-OCS-003 | Covered |
| AC-F3-1 | A resumed stream whose first identified line matches the handle id returns the existing identity without waiting for completion. | TC-OCS-030, TC-OCS-034 | Covered |
| AC-F3-2 | A resumed stream with no identifier within the bound → `harness.session.unknown` with the observed status. | TC-OCS-031 | Covered |
| AC-F3-3 | A resumed stream identifying a different session → `harness.session.unknown`, never a silent lane switch (defence-in-depth; unreachable with `opencode run --session <id>`, which stamps the requested id onto every event). | TC-OCS-032 | Covered |
| AC-F3-4 | A resumed session that acquires and later exits non-zero: handle returned, `collect` carries the exit → classifier failure, not acquisition refusal. | TC-OCS-033 | Covered |
| AC-F4-1 | JSONL only: exit 0 plus a terminal `step_finish` with `part.reason === "stop"` → `completionMarker: true`, `exitStatus: 0`, `timedOut: false`; a legacy envelope's own completion fact takes precedence. | TC-OCS-040, TC-OCS-046 | Covered |
| AC-F4-2 | JSONL only: exit 0 but no terminal `step_finish` → `completionMarker: false`, premature end; a legacy envelope's own completion fact takes precedence. | TC-OCS-041, TC-OCS-046 | Covered |
| AC-F4-3 | JSONL only: exit 0, terminal `step_finish`, and a `tool_use` event whose `part.state.status === "error"` → `completionMarker: true`, `toolFailure: true`, token `partial`; a legacy envelope's `toolFailure` fact takes precedence. | TC-OCS-042, TC-OCS-047, TC-OCS-062 | Covered |
| AC-F4-4 | Abnormal end (non-zero exit, timeout, kill) → `completionMarker: false` with the observed facts; an `error` event sets `failureReported: true`, while a non-zero exit does not (it is carried by `exitStatus` only); a legacy envelope's facts merge under the same host facts (e.g. `completion: "complete"` under a host timeout reports `completionMarker: true` with `timedOut: true` and classifies `timed-out`). | TC-OCS-043, TC-OCS-015, TC-OCS-046, TC-OCS-048 | Covered |
| AC-F4-5 | `collect` with no collected facts → `harness.session.unknown`, never fabricated evidence. | TC-OCS-044 | Covered |
| AC-F5-1 | No identified line within the handle bound → the child is killed, the starter's `timedOut` is true, and spawn maps to the existing pre-session refusal with the observed status and a summary naming the acquisition timeout. | TC-OCS-050, TC-OCS-014 | Covered |
| AC-F5-2 | Every failed acquisition or abandoned stream in the fake starter has `kill` called and leaves no child. | TC-OCS-051, TC-OCS-052 | Covered |
| AC-F5-3 | A session running longer than 300 s with no session bound is not killed and `collect` eventually returns its evidence. | TC-OCS-023, TC-OCS-053 | Covered |
| AC-F6-1 | Production composition: opencode receives the streaming starter and the one-shot runner for listing; Claude receives only the one-shot runner. | TC-OCS-060, TC-OCS-080, TC-OCS-081 | Covered |
| AC-F6-2 | The contract module stays type-only data, the session-port shape is unchanged, and the child-process allowlist equality still passes with one site. | TC-OCS-001, TC-OCS-002, TC-OCS-003, TC-OCS-004, TC-OCS-052 | Covered |
| AC-F7-1 | The committed real-shape JSONL fixture drives assertions on line-independent parsing, top-level `sessionID`, the retained fallbacks, and the dedicated `tool_use`-with-`state.status === "error"` and `error`-event cases that exercise §8.4's failure encodings. | TC-OCS-005, TC-OCS-017, TC-OCS-047, TC-OCS-048, TC-OCS-061, TC-OCS-062 | Covered |
| AC-F7-2 | The simulated long-running fixture asserts handle-before-completion and completion-scoped `collect` deterministically, with no wall-clock race. | TC-OCS-020, TC-OCS-071 | Covered |
| AC-F7-3 | Malformed, blank-leading, no-id, non-zero, truncated, resume-mismatch, legacy-envelope, and failure-encoding fixtures each map to the code and evidence stated in DEC-4 and DEC-5. | TC-OCS-011, TC-OCS-012, TC-OCS-013, TC-OCS-014, TC-OCS-016, TC-OCS-031, TC-OCS-032, TC-OCS-041, TC-OCS-042, TC-OCS-043, TC-OCS-046, TC-OCS-047, TC-OCS-048, TC-OCS-062 | Covered |
| AC-F7-4 | Type tests: the starter/stream types accept the host implementation, and the unchanged session port still accepts the opencode port. | TC-OCS-070, TC-OCS-002 | Covered |
| AC-F8-1 | One real `dispatch <ref>` on the installed healthy CLI reaches classification with any result token; `lastMessage` is not `spawn failed before a session existed`. | TC-OCS-100, TC-OCS-082 | Covered |
| AC-F8-2 | The end-to-end proof is bounded and creates no nested lifecycle mutation in this change's worktree. | TC-OCS-101 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 005, 010–017, 046; F-2 → 020–023, 082; F-3 → 030–034; F-4 → 021, 040–048; F-5 → 014, 023, 050–053; F-6 → 001–004, 052, 060; F-7 → 005, 010–017, 020, 042, 047, 048, 061, 062, 070–072; F-8 → 100, 101.

**Decision coverage**: DEC-1 → 001, 002, 060; DEC-2 → 030–034; DEC-3 → 023, 053; DEC-4 → 010–017, 031, 032, 046; DEC-5 → 021, 040–048, 062; DEC-6 → 050–052; DEC-7 → 004, 082; DEC-8 → 001, 002 (no consumer-visible contract added).

**Risk coverage**: RSK-1 → 101; RSK-2 → 005, 011, 012; RSK-3 → 023, 053; RSK-4 → 051, 052; RSK-5 → 071 (continued draining); RSK-6 → 080, 081; RSK-7 → 032; RSK-8 → 015, 033; RSK-9 → 016, 041, 046.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint (§8.1 N/A), no event or message contract (§8.2 N/A), and no persisted data-model change (§8.3 N/A). There are therefore no `API-*`, `EVT-*`, or `DM-*` identifiers to trace. The interface this plan covers is internal and typed; it is enumerated here so no surface escapes the matrix.

| Surface | Declared change | TC ID(s) | Observable assertion |
|---|---|---|---|
| `HarnessSpawnStarter` / `HarnessSpawnStream` / `HarnessSpawnStreamOptions` (Appendix B) | Additive types in `packages/core/src/contracts/harness.ts` | TC-OCS-001, TC-OCS-070 | Types accept the host implementation and a fake; `sessionTimeoutMs` optional; stream exposes `lines`, `completion`, `acquired`, `kill` only |
| `HarnessSpawnRunner` / `HarnessSpawnRunnerResult` | Unchanged | TC-OCS-002, TC-OCS-070, TC-OCS-081 | Same four result fields; listing still invokes it once with its own timeout |
| `HarnessSessionPort` | Unchanged (7 members) | TC-OCS-002, TC-OCS-070 | Runtime key set and type arity unchanged; no `kill` operation on the port |
| `HarnessEvidence` | Unchanged shape; new fill semantics | TC-OCS-040–048, 062 | Six fields plus optional warnings; no token or harness name inside |
| `HARNESS_FAILURE_CODES` | Unchanged (nine codes) | TC-OCS-012, TC-OCS-013, TC-OCS-031, TC-OCS-032 | Every new stream case maps to an existing code; no code added |
| `opencode run --format json` stdout contract (§8.4) | Consumed for the first time | TC-OCS-005, TC-OCS-010, TC-OCS-011, TC-OCS-017, TC-OCS-047, TC-OCS-048 | JSONL, top-level `sessionID`, `step_start`/`text`/`step_finish`, terminal `part.reason`, `tool_use` error part, `error` event |
| Legacy single-document envelope (`result` + accepted identifier shapes) | Retained and authoritative for its own evidence facts (§8.5, F-4) | TC-OCS-017, TC-OCS-046, TC-OCS-061, TC-OCS-062 | `completion`/`completed`, `refused`, `failure`/`status`, `toolFailure` set the evidence; host `exitStatus`/`timedOut` merge on top |
| CLI production composition (`harnesses` map) | Starter added for opencode | TC-OCS-060, TC-OCS-082 | Each harness receives exactly its declared seams |
| Adapter conformance registry | opencode registration builds over the starter | TC-OCS-061 | Six classification scenarios on both adapters; registry coverage meta-check green |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | First identified line within 5 s typical; hard acquisition bound 60 s. | TC-OCS-050, TC-OCS-053, TC-OCS-020 | Covered (the 5 s typical value is a production observation recorded in §6.3, not a CI timing gate) |
| NFR-2 | 100% of runs return the handle before a simulated completion that resolves after more than 300 s of virtual time. | TC-OCS-020, TC-OCS-023, TC-OCS-053 | Covered |
| NFR-3 | 0 new failure codes, 0 new delivery-result tokens, 0 new error-table rows, 0 classifier changes. | TC-OCS-002, TC-OCS-004, TC-OCS-012, TC-OCS-013, TC-OCS-031, TC-OCS-032, TC-OCS-046, TC-OCS-062, TC-OCS-080, TC-OCS-081 | Covered |
| NFR-4 | Exactly one `node:child_process` import site; no new runtime API in the runtime-neutral contract tier. | TC-OCS-001, TC-OCS-003, TC-OCS-052 | Covered |
| NFR-5 | 0 real harness CLI invocations in unit, behaviour, conformance, and type suites. | TC-OCS-071 (plus every injected-fake suite) | Covered |
| NFR-6 | The existing 16 MiB stdout bound is preserved; no unbounded whole-session buffer in the adapter. | TC-OCS-016, TC-OCS-045, TC-OCS-071 | Covered |
| NFR-7 | 0 orphaned children in acquisition-failure and abandonment tests; kill idempotent and called on every failure path. | TC-OCS-050, TC-OCS-051, TC-OCS-052 | Covered |
| NFR-8 | Pre-session failures still collapse to `dispatch.session.spawn-failed`; a healthy spawn never takes that branch. | TC-OCS-004, TC-OCS-082, TC-OCS-100 | Covered |
| NFR-9 | `pnpm typecheck`, `pnpm test`, and `pnpm check:boundaries` pass, including the allowlist equality and the port type tests. | TC-OCS-002, TC-OCS-003, TC-OCS-070, TC-OCS-071 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 30 AC identifiers from spec §17 appear in §3.1 with at least one TC, and no AC identifier outside the spec is used.
- **Orphan TCs**: none. Every TC names at least one AC in §5.1 and §5.2; TCs also name the F-/NFR-/DEC- they discharge.
- **Partially testable, with the boundary recorded**: AC-F8-1/AC-F8-2 are operator-run once (GAP-T1); evidence provenance is asserted through `collect` only (GAP-T3); NFR-1's "5 s typical" is a recorded production observation, and the CI-gated half is the 60 s bound (TC-OCS-053). The tool-error and failure-fact encodings are no longer a gap: spec v1.2 pins them in §8.4/DEC-5, spec v1.3 fixes the single explicit-fact `failureReported` rule (a non-zero exit is `exitStatus` only), and TC-OCS-047/TC-OCS-048 assert the pinned lines are load-bearing.
- **Intentional duplicate coverage**: AC-F1-4 spans two TCs because the non-zero-exit and bound-expiry identities carry different observed facts; AC-F2-1 spans three because handle-before-completion, handle shape, and the dispatch-level watch are independently breakable; AC-F6-2 spans five because data-only typing, port shape, the allowlist, engine neutrality, and the real host implementation fail independently; AC-F7-3 spans the DEC-4/DEC-5 mapping battery because each case has a distinct failure mode; AC-F1-7/AC-F4-1..4 span TC-OCS-046 (precedence) and TC-OCS-062 (retained floor) because the source-precedence rule and the six delivered conformance cases can regress independently.
- **No moving-base diff assertion**: "the dispatch engine is untouched" is enforced as a semantic tree invariant (TC-OCS-004) plus a behavioural regression (TC-OCS-082). A file hash or `origin/main-tools...HEAD` diff is rejected as brittle and untruthful over time (testing-strategy §Invariant-test authoring).
- **Regression half**: the unchanged Claude suite, the unchanged listing cases, the six-scenario legacy classification floor, `TC-HARN-010`, and the full `pnpm check` battery run as-is; §6.4 lists the non-TC regression runs (bash suites, unchanged dispatch suites).

## 4. Test Types and Layers

| Layer | What it proves | Runner / invocation | Location |
|---|---|---|---|
| Structure (contract shape, imports, boundaries, engine neutrality) | The seam is additive and data-only; the port and runner are unchanged; the adapter cannot spawn; `node:child_process` stays at one site; `dispatch.ts` knows nothing about the seam | `bun test tests/structure/harness-stream-contract.test.ts tests/structure/harness-imports.test.ts`; `pnpm typecheck`; `pnpm check:boundaries` | `tests/structure/**`, `packages/core/src/contracts/harness.ts`, `packages/adapters/src/harness/opencode.ts`, `packages/adapters/src/host/index.ts`, `packages/core/src/app/dispatch.ts` (read-only) |
| Behaviour (adapter over injected fakes) | Stream decoding, acquisition, evidence and legacy precedence, pinned failure encodings, resume, bounds, hygiene | `bun test tests/behaviour/harness-opencode-stream.test.ts tests/behaviour/harness-opencode-resume-stream.test.ts tests/behaviour/harness-stream-hygiene.test.ts` | `tests/behaviour/**`, `tests/fixtures/harness/stream.ts` |
| Behaviour (host starter, real synthetic child) | The single child-process site streams lines, signals acquisition, resolves completion on close, kills idempotently with escalation, and leaves no orphan | `bun test tests/behaviour/harness-host-stream.test.ts` | `packages/adapters/src/host/index.ts`, `tests/behaviour/harness-host-stream.test.ts` |
| Type (compile level) | The host starter satisfies the contract; the port and runner are unchanged; no new port member | `pnpm typecheck` (`tsc -p tests/types/tsconfig.json`, glob `./**/*.type-test.ts`) | `tests/types/harness-stream.type-test.ts` |
| Conformance (shared registry, cross-adapter) | The opencode registration runs over the streaming seam; the six-scenario classification floor holds for both adapters; the six legacy envelopes keep their delivered evidence facts and tokens; `TC-HARN-010` stays green | `bun test tests/conformance/harness-classification.test.ts tests/structure/conformance-coverage.test.ts`; `bun test tests/behaviour/harness-opencode-session.test.ts` | `packages/testkit/src/conformance/harness.ts`, `tests/fixtures/harness/scenarios/classification.ts`, `tests/behaviour/harness-opencode-session.test.ts` |
| Checks / repository invariants | No new error row or token; the fixture is non-vacuous; the suites are hermetic and deterministic | `bun run scripts/checks/*.ts`; `bun test tests/checks/**`; `pnpm check` | `tests/checks/**`, `scripts/checks/**` |
| Manual (operator-run, not automated) | One real dispatch reaches classification, bounded and outside this worktree | §6.3 procedure; evidence in §10 | Scratch clone + installed `opencode v2.2.5` |

**Hermeticity rule (NFR-5).** No unit, behaviour, conformance, or type suite invokes `opencode` or `claude`. The only real child processes in the automated battery are (a) the synthetic Bun child in the host-starter suite, which runs a test-supplied script and never a harness CLI, and (b) the process-spawning checks tier that already exists. Every adapter fact is injected through `tests/fixtures/harness/stream.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

`TC-OCS` is a new prefix with no prior use in the repository; no delivered `TC-HARN-*`, `TC-DISP-*`, or other identifier is reused for a different scenario. The plan holds 46 scenarios, `TC-OCS-001`..`TC-OCS-101` (gaps in the sequence are intentional grouping, not missing rows), each present in this index, in §5.2, and in §7.2.

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-OCS-001 | Additive stream contract types: data-only, exported, no runtime import | Regression | Critical | High | AC-F2-3, AC-F6-2; F-6; NFR-4, NFR-9 |
| TC-OCS-002 | Session port and one-shot runner unchanged, structurally and by type | Regression | Critical | High | AC-F2-3, AC-F6-2, AC-F7-4; F-6; NFR-3, NFR-9 |
| TC-OCS-003 | Adapter confinement: no runtime API, no timer, one child-process site | Regression | Critical | High | AC-F2-3, AC-F6-2; F-2, F-6; NFR-4, NFR-9 |
| TC-OCS-004 | Dispatch engine knows nothing about the streaming seam | Regression | Critical | High | AC-F6-2; F-6; NFR-3, NFR-8 |
| TC-OCS-005 | Pinned real-shape v2.2.5 JSONL fixture and its provenance | Regression | Critical | High | AC-F7-1; F-1, F-7; RSK-2 |
| TC-OCS-010 | Real three-line JSONL stream acquires the handle from top-level `sessionID` | Happy Path | Critical | High | AC-F1-1; F-1; DEC-4 |
| TC-OCS-011 | Leading blank lines and a malformed non-JSON line are scanned past | Edge Case | Critical | High | AC-F1-2; F-1; DEC-4; RSK-2 |
| TC-OCS-012 | No identifier at exit 0 → `harness.spawn.invalid-output`, no fabricated handle | Negative | Critical | High | AC-F1-3; F-1; NFR-3; DEC-4 |
| TC-OCS-013 | No identifier with non-zero exit → `harness.spawn.refused` carrying the status | Negative | Critical | High | AC-F1-4; F-1, F-5; DEC-4 |
| TC-OCS-014 | No identifier at acquisition-bound expiry → `harness.spawn.refused` with the starter's `timedOut` fact | Negative | Critical | High | AC-F1-4, AC-F5-1; F-1, F-5; DEC-3, DEC-4 |
| TC-OCS-015 | Early identifier with a later non-zero exit: handle first, evidence carries the exit | Corner Case | Critical | High | AC-F1-5, AC-F4-4; F-1, F-4; DEC-2, DEC-5; RSK-8 |
| TC-OCS-016 | Truncation after acquisition, before the terminal event → premature end | Corner Case | Critical | High | AC-F1-6; F-1, F-4; NFR-6; RSK-9; DEC-4 |
| TC-OCS-017 | Single-document fallback shapes and identifier precedence | Regression | Critical | High | AC-F1-7, AC-F7-1; F-1; DEC-4 |
| TC-OCS-020 | Handle returned before completion with more than 300 s of virtual time | Happy Path | Critical | High | AC-F2-1, AC-F7-2; F-2, F-7; NFR-2; DEC-1 |
| TC-OCS-021 | `collect` before completion stays pending; resolves only at close | Regression | Critical | High | AC-F2-2, AC-F4-1; F-2, F-4; DEC-5 |
| TC-OCS-022 | Handle shape: identity and attribution only, no token or payload | Happy Path | Important | High | AC-F2-1, AC-F1-1; F-2 |
| TC-OCS-023 | A session past 300 s with no session bound is never killed | Regression | Critical | High | AC-F5-3; F-5; NFR-2; DEC-3; RSK-3 |
| TC-OCS-030 | Resume with a matching identifier returns the existing identity before completion | Happy Path | Critical | High | AC-F3-1; F-3; DEC-2 |
| TC-OCS-031 | Resume with no identifier within the bound → `harness.session.unknown` | Negative | Critical | High | AC-F3-2; F-3; NFR-3; DEC-2, DEC-4 |
| TC-OCS-032 | Resume identity mismatch is refused, never a silent lane switch | Negative | Critical | High | AC-F3-3; F-3; DEC-2; RSK-7 |
| TC-OCS-033 | Resume acquires, then exits non-zero: evidence failure, not acquisition refusal | Corner Case | Critical | High | AC-F3-4; F-3, F-4; DEC-2; RSK-8 |
| TC-OCS-034 | `deliver` shares the resume acquisition and identity rules | Regression | Important | High | AC-F3-1; F-3; DEC-1 |
| TC-OCS-040 | Completion: exit 0 plus terminal `step_finish` reason `stop` | Happy Path | Critical | High | AC-F4-1; F-4; DEC-5 |
| TC-OCS-041 | Exit 0 without a terminal `step_finish` → premature end | Negative | Critical | High | AC-F4-2; F-4; DEC-5; RSK-9 |
| TC-OCS-042 | Pinned `tool_use` error part → outcome `completed`, token `partial` | Corner Case | Critical | High | AC-F4-3, AC-F7-1; F-4, F-7; DEC-5 |
| TC-OCS-043 | Abnormal end (timeout, kill) reports the observed facts and no completion | Negative | Critical | High | AC-F4-4; F-4; DEC-5 |
| TC-OCS-044 | `collect` for an unknown handle → `harness.session.unknown`, no fabrication | Negative | Critical | High | AC-F4-5; F-4 |
| TC-OCS-045 | Anti-fabrication evidence table: completion, refusal, failure, tool-failure combinations | Regression | Critical | High | AC-F4-2, AC-F4-4, AC-F1-6; F-4; NFR-3, NFR-6; DEC-5 |
| TC-OCS-046 | Legacy single-document envelope evidence precedence over the JSONL rules | Regression | Critical | High | AC-F1-7, AC-F4-1, AC-F4-2, AC-F4-4; F-1, F-4; NFR-3; DEC-4, DEC-5 |
| TC-OCS-047 | Pinned `tool_use` error part makes `toolFailure` falsifiable | Regression | Critical | High | AC-F4-3, AC-F7-1; F-4, F-7; NFR-3; DEC-5 |
| TC-OCS-048 | Pinned `error` event makes `failureReported` falsifiable | Regression | Critical | High | AC-F4-4, AC-F7-1; F-4, F-7; NFR-3; DEC-5 |
| TC-OCS-050 | Handle-bound expiry kills the child, sets `timedOut`, and refuses pre-session | Negative | Critical | High | AC-F5-1; F-5; NFR-1, NFR-7; DEC-3, DEC-6 |
| TC-OCS-051 | Kill on every failure and abandonment path; kill is idempotent | Regression | Critical | High | AC-F5-2; F-5; NFR-7; DEC-6; RSK-4 |
| TC-OCS-052 | Host starter over a real synthetic child: lines, acquired, close, kill, escalation, no orphan | Regression | Critical | High | AC-F5-2, AC-F6-2; F-5, F-6; NFR-4, NFR-7; DEC-6 |
| TC-OCS-053 | Bounds wiring: 60 s acquisition default, no whole-session default, listing timeout separate | Regression | Critical | High | AC-F5-3; F-5; NFR-1, NFR-2; DEC-3 |
| TC-OCS-060 | Composition binding: opencode gets starter + runner; Claude gets runner only | Regression | Critical | High | AC-F6-1; F-6; DEC-1 |
| TC-OCS-061 | Conformance registry builds opencode over the streaming seam; six legacy cases + JSONL counterparts classify identically | Regression | Critical | High | AC-F1-7, AC-F7-1, AC-F7-3; F-1, F-4, F-7; NFR-3, NFR-5; DEC-5 |
| TC-OCS-062 | Retained legacy classification floor: six delivered cases and `TC-HARN-010` stay green through the new acquisition | Regression | Critical | High | AC-F1-7, AC-F7-1, AC-F7-3; F-1, F-4, F-7; NFR-3 |
| TC-OCS-070 | Type contract: starter/stream accept the host implementation; port unchanged | Regression | Critical | High | AC-F7-4, AC-F6-2; F-6, F-7; NFR-9 |
| TC-OCS-071 | Hermeticity and determinism meta-check: no real CLI, no timer, replay stability | Regression | Critical | High | AC-F7-2; F-7; NFR-5, NFR-6; RSK-5 |
| TC-OCS-072 | Fixture non-vacuity control: the stream fixture is the only reason acquisition works | Regression | Critical | High | AC-F7-1; F-7; NFR-5 |
| TC-OCS-080 | Claude adapter regression: headless session, gaps, and drift unchanged | Regression | Critical | High | AC-F6-1; F-6; NFR-3; RSK-6 |
| TC-OCS-081 | Session listing regression plus retained `TC-HARN-010` opencode behaviour | Regression | Critical | High | AC-F6-1, AC-F1-7; F-1, F-6; NFR-3; RSK-6 |
| TC-OCS-082 | Dispatch regression: spawn-failed identity unchanged; acquired session watched and classified | Regression | Critical | High | AC-F2-1, AC-F8-1; F-2, F-8; NFR-3, NFR-8; DEC-7 |
| TC-OCS-100 | End-to-end real dispatch reaches classification with any token | Happy Path | Critical | High | AC-F8-1; F-8; NFR-8 |
| TC-OCS-101 | End-to-end proof is bounded and mutates no file in this change's worktree | Regression | Critical | High | AC-F8-2; F-8; RSK-1 |

### 5.2 Scenario Details

#### TC-OCS-001 - Additive stream contract types: data-only, exported, no runtime import

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F2-3, AC-F6-2, NFR-4, NFR-9, DEC-1, DEC-8
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-stream-contract.test.ts`; `packages/core/src/contracts/harness.ts`
**Tags**: @backend, @static, @contract

**Preconditions**:

- The contract module remains type-plus-`as const` data only; the delivered `harness-contract` data-only scan already covers it.

**Steps**:

1. Import the new types from `packages/core/src/contracts/index` and assert they are usable as types only: `HarnessSpawnStreamOptions`, `HarnessSpawnStream`, `HarnessSpawnStarter`.
2. Assert `HarnessSpawnStreamOptions` carries `cwd`, `env`, optional `stdin`, `handleTimeoutMs`, and optional `sessionTimeoutMs` (Appendix B).
3. Assert `HarnessSpawnStream` exposes exactly `lines`, `completion`, `acquired`, `kill`, and that `completion` is a `Promise<HarnessSpawnRunnerResult>` and `lines` is an `AsyncIterable<string>` (type-level assertions in the type suite; runtime key check on a fake).
4. Run the delivered data-only statement scan over `packages/core/src/contracts/harness.ts` and assert only type aliases, imports, exports, and `as const` variable statements appear (existing `TC-HARN-001` scan, unchanged).
5. Assert the contracts directory contains no `from "node:` or `from "bun:` text (existing scan, unchanged).
6. Assert no new exported value (not type) was introduced for the seam: the module's runtime export set is unchanged apart from existing constants.

**Expected Outcome**:

- The seam is additive, type-only, and import-free of runtime APIs; the contract tier's data-only invariant still holds.

**Notes / Clarifications**:

- The existing scans must not be weakened to accommodate the new types; if a scan needs editing, that is a design signal, not a test edit.

#### TC-OCS-002 - Session port and one-shot runner unchanged, structurally and by type

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F2-3, AC-F6-2, AC-F7-4, NFR-3, NFR-9, DEC-1, DEC-8
**Test Type(s)**: Contract, Static, Type
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-stream-contract.test.ts`, `tests/types/harness-stream.type-test.ts`; `packages/core/src/contracts/harness.ts`
**Tags**: @backend, @static, @contract

**Preconditions**:

- A built opencode port exists over fakes (TC-OCS-010 helper).

**Steps**:

1. Assert the runtime key set of a constructed opencode port equals the delivered seven: `spawn`, `deliver`, `resume`, `collect`, `classify`, `liveness`, `listSessions`.
2. Assert the port object has no `kill`, `abort`, `sessionTimeout`, or other added member.
3. In the type suite, assert `HarnessSessionPort` still accepts the opencode port and that adding a member is rejected: a port object with an eighth member is not assignable where the delivered type is expected (or the reverse: an object missing a member is rejected).
4. Assert `HarnessSpawnRunner` still accepts a function of `(file, args, {cwd, env, timeout, stdin?})` returning `Promise<HarnessSpawnRunnerResult>` and that a result with a changed field set is rejected.
5. Assert `HarnessSpawnRunnerResult` still has exactly `stdout`, `stderr`, `status`, `timedOut`.
6. Assert the failure-code array is unchanged (nine codes) and that `harness.session.unknown`, `harness.spawn.refused`, and `harness.spawn.invalid-output` are present.

**Expected Outcome**:

- The delivered session port and one-shot runner contracts are byte-for-byte unchanged in shape; the streaming seam is the only addition.

#### TC-OCS-003 - Adapter confinement: no runtime API, no timer, one child-process site

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-6, AC-F2-3, AC-F6-2, NFR-4, NFR-9
**Test Type(s)**: Static, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-imports.test.ts` (extend the delivered scans); `packages/adapters/src/harness/opencode.ts`
**Tags**: @backend, @static, @boundary

**Preconditions**:

- The delivered `node:child_process` allowlist equality test exists with its 12 declared sites.

**Steps**:

1. Run the delivered adapter import scan over `packages/adapters/src/harness/**`; assert no `node:*`, no `bun:*`, no `@delivery-os/adapters/host`, and no classifier import.
2. Assert the opencode adapter source contains no `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `Date.now`, `performance.now`, `process.`, or `globalThis.` ambient read.
3. Run the delivered allowlist equality test unchanged; assert the observed set still equals the 12 declared sites and still includes exactly `packages/adapters/src/host/index.ts`.
4. Assert `createHostSpawnStarter` is exported from `packages/adapters/src/host/index.ts` and that no file under `packages/adapters/src/harness/` mentions `child_process`.
5. Assert with a positive control that a temporarily added `import "node:child_process"` in a scratch adapter copy fails the scan naming the file (the delivered boundary-fixture pattern; no committed mutant file).
6. Run `pnpm check:boundaries` and assert the existing `runtime-apis-confinement` rule and its negative fixture are unchanged.

**Expected Outcome**:

- The adapter remains runtime-neutral and timer-free; the repository still has exactly one child-process site, and it is the host subpath that now owns both seams.

#### TC-OCS-004 - Dispatch engine knows nothing about the streaming seam

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-3, NFR-8, DEC-7
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-stream-contract.test.ts`; `packages/core/src/app/dispatch.ts` (read-only)
**Tags**: @backend, @static, @engine-neutrality

**Preconditions**:

- None; this is a tree invariant, not a diff.

**Steps**:

1. Read `packages/core/src/app/dispatch.ts` and assert it contains no `HarnessSpawnStarter`, `HarnessSpawnStream`, `handleTimeoutMs`, `sessionTimeoutMs`, `sessionID`, `step_finish`, `JSONL`, or `JSON.parse` token.
2. Assert it imports only from the contract tier and the app/domain tiers (the delivered import shape) and imports no adapter subpath.
3. Assert it contains no harness-kind literal (`"opencode"`, `"claude-code"`) and no branch on `harnessKind`.
4. Assert the `dispatch.session.spawn-failed` identity is preserved, without asserting an occurrence count the source contradicts. The message string `"spawn failed before a session existed"` appears exactly once — the spawn-failure branch's `lastMessage` (`packages/core/src/app/dispatch.ts:482`) — and no other branch produces it. The code identifier appears three times in the delivered source, all describing the same one event: the comparison switch case (line 210), the attempt record's `errorCode` (line 471) and the `comparisonFor` call's `errorCode` (line 474). Assert the identity behaviourally as well: the single `!session.ok` branch (lines 466-486) is the only producer of that `errorCode`/`lastMessage` pair, and the behavioural proof that the branch returns it is TC-OCS-082 step 3. Do not assert "exactly once" for the code identifier.
5. Assert `HARNESS_FAILURE_CODES`, `HARNESS_CLASSIFICATION_TOKENS`, and the delivery-result token array are unchanged by diffing against the constants the test imports (not against a branch).
6. Assert `packages/core/src/domain/harness-classify.ts` is still the only classifier definition (delivered `TC-HARN-005` scan, unchanged).

**Expected Outcome**:

- The engine consumes the unchanged port and cannot observe the seam; the pre-session failure mapping is intact.

**Notes / Clarifications**:

- This is deliberately a semantic invariant, not a file hash or a branch diff. A hash would fail legitimate engine edits and would not prove the property; a moving-base diff is forbidden by the testing strategy.

#### TC-OCS-005 - Pinned real-shape v2.2.5 JSONL fixture and its provenance

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-7, AC-F7-1, RSK-2, DEC-4
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/fixtures/harness/stream/opencode-v2.2.5.jsonl` (base happy-path file of the three-file pinned set); `tests/structure/harness-stream-contract.test.ts`
**Tags**: @backend, @fixture, @contract

**Preconditions**:

- The pinned set is a committed capture of real `opencode v2.2.5` `run --format json` output, redacted of prompt content, with synthetic content in `part` payloads. The base file is the clean three-line happy path; the two failure encodings are pinned in their own files (`opencode-v2.2.5-tool-error.jsonl`, `opencode-v2.2.5-stream-error.jsonl`).

**Steps**:

1. Assert the base fixture file exists, is UTF-8 JSONL, and has at least three lines.
2. Assert every line parses independently as a JSON object; assert no line requires its neighbours (parse each line in isolation).
3. Assert line 1 has `type: "step_start"` and a top-level `sessionID` string with the `ses_` prefix.
4. Assert the `text` and `step_finish` lines carry the same top-level `sessionID`.
5. Assert the last line has `type: "step_finish"` and `part.reason === "stop"`.
6. Assert the sibling failure files each parse and carry their dedicated encoding (details in TC-OCS-047/TC-OCS-048); the base file stays a clean completion stream.
7. Assert no prompt text, credential, environment dump, or personal data appears in any file of the set (a canary scan).
8. Assert the set's `README.md` names `opencode v2.2.5` as its provenance and states the regeneration instruction.

**Expected Outcome**:

- The real stream shape is pinned, reviewable, and the single oracle for the adapter suites; a CLI shape change surfaces as a deliberate fixture edit.

#### TC-OCS-010 - Real three-line JSONL stream acquires the handle from top-level `sessionID`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, DEC-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/stream.ts`
**Tags**: @backend, @stream

**Preconditions**:

- A fake streaming starter is injected; the three fixture lines are queued; `completion` is gated.

**Steps**:

1. Invoke `spawn` with a work-item ref and a descriptor.
2. Assert `spawn` resolves `ok: true` and the handle's `sessionId` equals the fixture's top-level `sessionID`.
3. Assert `treeRoot` equals the same value and `workItemRef` equals the input ref.
4. Assert the fake recorded exactly one starter invocation with the configured file, args, cwd, env, and stdin.
5. Assert `acquired()` was called exactly once.
6. Assert a single-line `{ "session": { "id": "ses_x" } }` document is not what produced this result: the queued lines have no `session` key.

**Expected Outcome**:

- The real JSONL shape yields a handle whose identity comes from the top-level `sessionID`, not from a whole-buffer parse.

#### TC-OCS-011 - Leading blank lines and a malformed non-JSON line are scanned past

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F7-3, DEC-4, RSK-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/scenarios/stream.ts`
**Tags**: @backend, @stream, @negative

**Preconditions**:

- A named case `leading-noise` in the stream scenario fixture: `""`, `"\r"`, `"not-json"`, `"{\"type\":\"text\"}"` (object without id), then a valid `step_start` line.

**Steps**:

1. Invoke `spawn` over the case.
2. Assert the handle's `sessionId` is the valid line's id.
3. Assert blank lines, whitespace-only lines, the non-JSON line, and the id-less object were all skipped without aborting.
4. Assert the case produced no failure and exactly one `acquired()` call.
5. Repeat with the malformed line after a valid one; assert the first (earlier) identifier still wins.

**Expected Outcome**:

- The scan tolerates leading noise and never aborts on a malformed line; the first identified line wins.

#### TC-OCS-012 - No identifier at exit 0 → `harness.spawn.invalid-output`, no fabricated handle

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, AC-F7-3, NFR-3, DEC-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @negative

**Preconditions**:

- Queued lines are valid JSON objects with no accepted identifier; completion is `{status: 0, timedOut: false}`.

**Steps**:

1. Invoke `spawn`.
2. Assert `ok: false` and `error.code === "harness.spawn.invalid-output"`.
3. Assert the error carries no fabricated session id (`JSON.stringify(error)` contains no `ses_`).
4. Assert a follow-up `collect` for any handle shape is `harness.session.unknown` (no session was recorded) — this doubles as AC-F4-5 evidence.
5. Assert no retry and no second starter invocation.

**Expected Outcome**:

- A stream without an identifier stays a pre-session invalid-output refusal with no session record and no fabricated identity.

#### TC-OCS-013 - No identifier with non-zero exit → `harness.spawn.refused` carrying the status

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-4, AC-F7-3, DEC-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @negative

**Preconditions**:

- Queued lines carry no identifier; completion is `{status: 7, timedOut: false}`.

**Steps**:

1. Invoke `spawn`.
2. Assert `error.code === "harness.spawn.refused"` and `error.status === 7`.
3. Assert `timedOut` is not asserted as a structural refusal field (the timeout is observed from the starter's completion result; `HarnessFailure` has no timeout field, and the bound case is TC-OCS-014).
4. Assert no session record and no handle.
5. Assert the code is one of the delivered nine (no new code path).

**Expected Outcome**:

- A non-zero exit before any identifier maps to the existing pre-session refusal with the observed status.

#### TC-OCS-014 - No identifier at acquisition-bound expiry → `harness.spawn.refused` with the starter's `timedOut` fact

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-4, AC-F5-1, AC-F7-3, DEC-3, DEC-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @negative

**Preconditions**:

- The fake is set to deliver no lines and to complete with `{status: 1, timedOut: true}` when the test fires the bound.

**Steps**:

1. Invoke `spawn`.
2. Fire the fake's `expireHandleBound()` (end lines, resolve completion with `timedOut: true`, record kill).
3. Assert `error.code === "harness.spawn.refused"` and `error.status === 1`.
4. Assert the refusal's summary identifies a timeout without interpolating raw stream content.
5. Assert no session record and no handle.

**Expected Outcome**:

- Bound expiry maps to the existing pre-session refusal with the observed status and timeout fact. The timeout is the starter's `timedOut` fact and is reported only through the refusal summary: `HarnessFailure` (`packages/core/src/contracts/harness.ts:303-311`) has no structural timeout field, and no new field is added.

#### TC-OCS-015 - Early identifier with a later non-zero exit: handle first, evidence carries the exit

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-5, AC-F4-4, DEC-2, DEC-5, RSK-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @corner

**Preconditions**:

- The first line carries an identifier; the completion later resolves `{status: 3, timedOut: false}`.

**Steps**:

1. Invoke `spawn`; assert it resolves `ok: true` before completion (the fake's completion is still gated).
2. Assert the handle exists with the acquired id.
3. Release completion with status 3.
4. `collect` and assert `exitStatus: 3`, `completionMarker: false`, `spawnRefused: false`, and `failureReported: false` — the non-zero exit is carried by `exitStatus` only (spec v1.3 F-4).
5. Classify through the injected shared classifier and assert outcome `failed` (token `failed`), not a refusal.
6. Replay with status 0 but a missing terminal event; assert premature end instead (cross-check to TC-OCS-041).

**Expected Outcome**:

- A post-handle non-zero exit is evidence, never a pre-session refusal; the shared classifier decides the outcome.

#### TC-OCS-016 - Truncation after acquisition, before the terminal event → premature end

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-6, AC-F4-2, NFR-6, RSK-9, DEC-4
**Test Type(s)**: Unit, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`, `tests/structure/harness-stream-contract.test.ts`
**Tags**: @backend, @stream, @bounds

**Preconditions**:

- A truncated-shaped buffer: identifier present, `step_start` and `text` lines present, no terminal `step_finish`, completion `{status: 0, timedOut: false}`.

**Steps**:

1. Invoke `spawn`; assert the handle is returned (truncation must not invalidate it).
2. `collect`; assert `completionMarker: false`, `exitStatus: 0`, `timedOut: false`, and no warning claims completion.
3. Classify; assert outcome `premature-end`, token `partial`.
4. Assert the failure vocabulary gained nothing: the code set from TC-OCS-002 is unchanged.
5. Structurally assert the host's cap is still `16 * 1024 * 1024` and that the truncation marker is appended, so the adapter's degraded case matches the real bound.

**Expected Outcome**:

- Truncation degrades to premature end with the handle intact and no new code.

#### TC-OCS-017 - Single-document fallback shapes and identifier precedence

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-7, AC-F7-1, DEC-4
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/scenarios/stream.ts`
**Tags**: @backend, @stream, @compatibility

**Preconditions**:

- Four cases: `{"session":{"id":"ses_a"}}`, `{"sessionId":"ses_b"}`, `{"id":"ses_c"}`, and one line carrying both `sessionID` and `session.id` with different values.

**Steps**:

1. For each fallback case, invoke `spawn` and assert the accepted id.
2. For the precedence case, assert `sessionID` wins over `session.id`.
3. Assert precedence among fallbacks is `session.id` → `sessionId` → `id` when `sessionID` is absent.
4. Assert an empty-string identifier in any shape is not accepted (continues the scan).
5. Assert each case is delivered through the same single-line fake and produces no failure.

**Expected Outcome**:

- The previously accepted shapes remain readable and precedence is deterministic and documented.

#### TC-OCS-020 - Handle returned before completion with more than 300 s of virtual time

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-7, AC-F2-1, AC-F7-2, NFR-2, DEC-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/stream.ts` (`createVirtualClock`)
**Tags**: @backend, @stream, @determinism

**Preconditions**:

- The fake completion is gated on an explicit `finish()`; an injected virtual clock starts at 0; the fake exposes `acquiredCalls`, `completionSettled`, `kills`, and the bounded helper `flushUntil(predicate, turns)`.

**Steps**:

1. Call `spawn` and keep the promise; set `spawnSettled` in its `.then`.
2. Run the bounded flush helper — `flushUntil(() => spawnSettled || fake.acquiredCalls > 0, 64)` — a bounded loop of `await Promise.resolve()` turns, no timers, no sleeps; the helper drains one final turn after the predicate becomes true so the same-turn spawn settlement is observed. **Never `await` the fake's acquisition signal**: a completion-gated mutant never calls `acquired()`, so that await would hang instead of fail.
3. Assert `spawnSettled === true`, `fake.acquiredCalls === 1`, and `fake.completionSettled === false`: the handle exists while the session is open.
4. Advance the virtual clock by `39_600_000` ms (11 h, i.e. far beyond the old 300 s assumption); assert the handle value is unchanged and `kills === 0`.
5. Call `finish({status: 0})`; await `collect`; assert completed evidence.

**Expected Outcome**:

- Handle-before-completion is proven deterministically; a completion-gated regression leaves `spawnSettled` false and `acquiredCalls` 0 after 64 microtask turns, so step 3 fails by assertion in milliseconds — it does not hang and does not reach the runner timeout.

**Notes / Clarifications**:

- This is the plan's canonical long-session proof; it allocates no timers and takes milliseconds. The virtual clock is test data, not a wall clock.

#### TC-OCS-021 - `collect` before completion stays pending; resolves only at close

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-2, AC-F4-1, DEC-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream

**Preconditions**:

- A handle acquired from the fake (the TC-OCS-020 bounded gate has already asserted `spawnSettled === true` and `acquiredCalls === 1`); completion still gated.

**Steps**:

1. Call `collect` and hold the promise; set `collectSettled` in its `.then`.
2. Run `flushUntil(() => collectSettled, 64)`; assert `collectSettled === false` and `fake.completionSettled === false` — there is no early or partial settlement.
3. Assert no partial evidence object was produced or cached (the fake records zero collection reads).
4. Release completion with status 0 (`fake.finish(...)`); run `flushUntil(() => collectSettled, 64)`; assert `collectSettled === true` and `collect` resolved `ok: true` with evidence derived from the closed process.
5. Assert a second `collect` resolves the same evidence idempotently.
6. Repeat with an abnormal completion; assert `collect` still waits for close and then reports the abnormal facts.

**Expected Outcome**:

- `collect` is completion-scoped: pending before close, resolved with the closed session's evidence after; the proof is a before/after assertion around `finish()`, never an unbounded await.

#### TC-OCS-022 - Handle shape: identity and attribution only, no token or payload

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F1-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @contract

**Preconditions**:

- A completed real-shape stream.

**Steps**:

1. Spawn and assert `Object.keys(handle).sort()` equals `["harnessKind","sessionId","treeRoot","workItemRef"]`.
2. Assert `harnessKind === "opencode"`.
3. Assert the serialized handle contains no delivery-result token and no raw stream content.
4. Assert `treeRoot === sessionId` even when the fixture's `part` payload carries a directory-looking value (no inference from payload).

**Expected Outcome**:

- The handle carries identity and attribution only; nothing is inferred from stream payloads.

#### TC-OCS-023 - A session past 300 s with no session bound is never killed

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-2, DEC-3, RSK-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-stream-hygiene.test.ts`
**Tags**: @backend, @stream, @bounds, @determinism

**Preconditions**:

- The adapter is constructed with no `sessionTimeoutMs`; the fake records kill calls and the options it received.

**Steps**:

1. Spawn; assert the handle returns.
2. Advance the virtual clock by 11 h in several steps (e.g. 300 s, 600 s, then the remainder), asserting `kills === 0` and `completionSettled === false` at each step.
3. Assert the recorded stream options carry no positive `sessionTimeoutMs` (absent or 0).
4. Finish with status 0 and a terminal event; assert finished evidence.
5. Repeat with an explicit injected `sessionTimeoutMs` (e.g. 1) and assert the host would enforce it: the fake records the value on the options, proving the bound is injected data, not an adapter constant.
6. Assert the adapter never passes `timeoutMs` (the listing timeout) to the starter.

**Expected Outcome**:

- The default is unbounded; the only default bound is the 60 s acquisition wait; the optional whole-session bound is passed through as data.

#### TC-OCS-030 - Resume with a matching identifier returns the existing identity before completion

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DEC-2
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-resume-stream.test.ts`
**Tags**: @backend, @stream, @resume

**Preconditions**:

- An existing handle `{harnessKind: "opencode", sessionId: "ses_root_1", treeRoot: "ses_root_1", workItemRef: "GH-275"}`; a resumed stream whose first identified line carries `ses_root_1`; the fake exposes `acquiredCalls`, `completionSettled`, and `flushUntil`.

**Steps**:

1. Call `resume` with the handle and a steering prompt; set `resumeSettled` in its `.then`.
2. Run `flushUntil(() => resumeSettled || fake.acquiredCalls > 0, 64)`; **never `await` the fake's acquisition signal**. The helper drains one final turn after the predicate becomes true so the same-turn resume settlement is observed. Assert `resumeSettled === true`, `fake.acquiredCalls === 1`, and `fake.completionSettled === false`; the identity fields equal the input handle's.
3. Assert the recorded args are the configured resume args plus `ses_root_1`, and stdin is the steering prompt verbatim (not in argv).
4. Release completion; assert `collect` still waits for close.
5. Assert `deliver` behaves identically (delegated path) and never spawns a fresh session.

**Expected Outcome**:

- Resume/deliver acquire non-blockingly and preserve the caller's identity; a completion-gated resume mutant is caught by the bounded assertion, not by a hang. The prompt stays data.

#### TC-OCS-031 - Resume with no identifier within the bound → `harness.session.unknown`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-F7-3, NFR-3, DEC-2, DEC-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-resume-stream.test.ts`
**Tags**: @backend, @stream, @resume, @negative

**Preconditions**:

- A resumed stream with no identifier; completion `{status: 4, timedOut: false}` (and a second case with `timedOut: true`); the fake exposes `resumeSettled` control through the returned promise and `flushUntil`.

**Steps**:

1. Call `resume`; set `resumeSettled` in its `.then`; run `flushUntil(() => resumeSettled, 64)` and assert it is still `false` (no identifier, completion gated).
2. Release completion with status 4; run `flushUntil(() => resumeSettled, 64)`; assert `error.code === "harness.session.unknown"` and `error.status === 4`.
3. Repeat with bound expiry (`expireHandleBound()`); run `flushUntil(() => resumeSettled, 64)`; assert the same code with the observed timeout fact and a summary naming the acquisition timeout.
4. Assert no session record was created and no new id appears in the error.
5. Assert exactly one starter invocation and no `acquiredCalls`.
6. Assert the code is one of the delivered nine (no new code).

**Expected Outcome**:

- Resume no-identifier is the existing session-unknown refusal with the observed status; the bounded flush proves it does not settle before the stream ends and does not hang if it never does.

#### TC-OCS-032 - Resume identity mismatch is refused, never a silent lane switch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DEC-2, RSK-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-resume-stream.test.ts`
**Tags**: @backend, @stream, @resume, @negative

**Preconditions**:

- A handle with `sessionId: "ses_lane_a"`; a resumed stream whose first identified line carries `ses_lane_b`; the fake exposes `acquiredCalls` and `flushUntil`.

**Steps**:

1. Call `resume`; set `resumeSettled` in its `.then`.
2. Push the mismatching identifier; run `flushUntil(() => resumeSettled || fake.acquiredCalls > 0, 64)`; **never `await` the fake's acquisition signal**. Assert `resumeSettled === true` while `fake.acquiredCalls === 0` (the mismatch is refused, not acquired).
3. Assert `ok: false` and `error.code === "harness.session.unknown"`.
4. Assert the error carries no `ses_lane_b` and no fabricated handle.
5. Assert the session map still holds only the original handle's identity (a later `collect` for `ses_lane_a` still resolves its own evidence).
6. Assert the child is killed (mismatch is a failed acquisition) and exactly one starter invocation occurred.

**Expected Outcome**:

- A resumed stream can never switch lanes; mismatch is a classified refusal with cleanup, proven by a bounded assertion rather than an adapter-driven await.

#### TC-OCS-033 - Resume acquires, then exits non-zero: evidence failure, not acquisition refusal

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-4, AC-F4-4, DEC-2, RSK-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-resume-stream.test.ts`
**Tags**: @backend, @stream, @resume, @corner

**Preconditions**:

- A matching identifier, then completion `{status: 5, timedOut: false}`.

**Steps**:

1. Call `resume`; assert the handle returns before completion.
2. Release completion with status 5; `collect` and assert `exitStatus: 5`, `completionMarker: false`, `failureReported: false` (the exit is `exitStatus` only).
3. Classify and assert outcome `failed` (token `failed`), never `harness.session.unknown`.
4. Assert the handle identity is still the caller's.
5. Assert one attempt-level error identity at most: the refusal path was not taken.

**Expected Outcome**:

- A post-handle resume failure is evidence; the classifier decides, and the acquisition refusal path is not reused.

#### TC-OCS-034 - `deliver` shares the resume acquisition and identity rules

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DEC-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-resume-stream.test.ts`
**Tags**: @backend, @stream, @resume

**Preconditions**:

- The same fake starter for both `resume` and `deliver`.

**Steps**:

1. Run the TC-OCS-030 match case through `deliver`; assert the same identity, args, and prompt delivery.
2. Run the TC-OCS-031 no-identifier case through `deliver`; assert `harness.session.unknown`.
3. Run the TC-OCS-032 mismatch case through `deliver`; assert `harness.session.unknown`.
4. Assert both operations use one acquisition implementation: the fake records the same options shape and one `acquired()` per acquisition.
5. Assert neither operation falls back to `spawn` (no spawn invocation recorded).

**Expected Outcome**:

- `deliver` and `resume` are the same acquisition; no duplicated or divergent path.

#### TC-OCS-040 - Completion: exit 0 plus terminal `step_finish` reason `stop`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @evidence

**Preconditions**:

- The committed three-line JSONL fixture (no legacy `result` envelope) plus completion `{status: 0, timedOut: false}`.

**Steps**:

1. Spawn, finish, and `collect`.
2. Assert `completionMarker: true`, `exitStatus: 0`, `timedOut: false`, `spawnRefused: false`.
3. Assert `failureReported: false` and `toolFailure: false` when no such facts are present.
4. Assert `Object.keys(evidence)` contains no token, harness name, or raw payload.
5. Classify and assert outcome `completed`, token `finished`.

**Expected Outcome**:

- The only completion is exit 0 plus a terminal stop event, and it maps to the delivered completed classification.

#### TC-OCS-041 - Exit 0 without a terminal `step_finish` → premature end

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F7-3, DEC-5, RSK-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @evidence, @negative

**Preconditions**:

- A JSONL stream (no legacy `result` envelope) with `step_start` and `text` lines, no `step_finish`; completion `{status: 0, timedOut: false}`.

**Steps**:

1. Spawn and finish.
2. Assert `collect` yields `completionMarker: false` and `exitStatus: 0`.
3. Classify and assert outcome `premature-end`, token `partial`.
4. Repeat with a terminal `step_finish` whose `part.reason` is not `stop` (e.g. `"tool-calls"`); assert premature end as well.
5. Assert no failure code is raised: this is a completed collection with a non-completion verdict.

**Expected Outcome**:

- A clean exit alone never fabricates completion; only the declared terminal stop event does.

#### TC-OCS-042 - Pinned `tool_use` error part → outcome `completed`, token `partial`

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, AC-F4-3, AC-F7-1, DEC-5, NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/stream/opencode-v2.2.5-tool-error.jsonl`; `tests/fixtures/harness/scenarios/stream.ts` (`tool-error` case)
**Tags**: @backend, @stream, @evidence

**Preconditions**:

- `tests/fixtures/harness/stream/opencode-v2.2.5-tool-error.jsonl` carries a real-shape `tool_use` event whose `part.state.status === "error"` (spec §8.4); the `tool-error` case selects that line plus a valid terminal `step_finish` with `part.reason === "stop"`, exit 0.

**Steps**:

1. Spawn and finish.
2. Assert `completionMarker: true`, `toolFailure: true`, `failureReported: false`, `exitStatus: 0`.
3. Classify and assert outcome `completed` and token `partial`. The delivered `HARNESS_OUTCOMES` value is `completed`; the carried classification key `completed-with-tool-failure` is only the internal projection that maps to token `partial` (`packages/core/src/contracts/harness.ts:151-176`). Do not assert `completed-with-tool-failure` as an outcome value — it is not in `HARNESS_OUTCOMES`.
4. Assert the distinction from premature end is the `outcome`, not the token.
5. **Falsifiability guard:** assert the fixture line really is `type === "tool_use"` with `part.state.status === "error"` (structural read of the committed fixture, not a second invented shape).
6. **Negative control:** replay the same case with the `tool_use` line removed (or `part.state.status` mutated to a non-error value) and assert `toolFailure: false` and the completed token `finished`. This is what makes AC-F4-3 fail if the adapter ignores the encoding.

**Expected Outcome**:

- A tool-level failure is a completed session with `partial`, never a fabricated generic failure; the assertion is load-bearing because removing the pinned line changes the result.

**Notes / Clarifications**:

- The encoding is fixed by spec §8.4 and DEC-5: `tool_use` with `part.state.status === "error"`. The test reads that pinned line; it must not invent a second encoding. OQ-T1 is closed (§8.3).

#### TC-OCS-043 - Abnormal end (timeout, kill) reports the observed facts and no completion

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, DEC-5, DEC-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @evidence, @negative

**Preconditions**:

- Two JSONL completions (no legacy `result` envelope): `{status: 0, timedOut: true}` and `{status: 1, timedOut: false}` after a kill.
- The legacy-envelope equivalents (including `completion: "complete"` under a host timeout) are covered by TC-OCS-046.

**Steps**:

1. For each abnormal completion, spawn (identifier present), finish, and `collect`.
2. Assert `completionMarker: false` and the observed `exitStatus`/`timedOut` values.
3. Assert `spawnRefused: false` (a JSONL session existed and no legacy `refused` fact is present).
4. Classify: timeout → `timed-out`; non-zero → `failed`; assert the two tokens differ.
5. Assert no failure code is raised by `collect` itself; classification carries the verdict.

**Expected Outcome**:

- Abnormal ends are reported faithfully and classified by the shared classifier, with no fabricated completion.

#### TC-OCS-044 - `collect` for an unknown handle → `harness.session.unknown`, no fabrication

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`
**Tags**: @backend, @stream, @negative

**Preconditions**:

- A constructed port with no sessions.

**Steps**:

1. Call `collect` with a synthetic handle (`ses_missing`).
2. Assert `ok: false` and `error.code === "harness.session.unknown"`.
3. Assert the error carries no evidence-shaped fields (no `completionMarker`, `exitStatus`, `failureReported`).
4. Assert a `collect` after a *failed* spawn is also `harness.session.unknown` (no record was created).
5. Assert no evidence is cached or invented for a later call.

**Expected Outcome**:

- Absent collected facts are an explicit unknown, never a zeroed or completed evidence object.

#### TC-OCS-045 - Anti-fabrication evidence table: completion, refusal, failure, tool-failure combinations

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-4, AC-F1-6, NFR-3, NFR-6, DEC-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/scenarios/stream.ts`
**Tags**: @backend, @stream, @table

**Preconditions**:

- A declared case table: (exit 0 + terminal stop) → completed; (exit 0, no terminal) → premature; (exit 0, terminal + `tool_use` error part) → completed (token `partial`; the internal classification key is `completed-with-tool-failure`); (exit 0 + `error` event, no terminal stop) → failed; (exit != 0 + terminal stop) → failed; (timedOut) → timed-out; (truncated) → premature; (legacy envelope `completion: "complete"` under host timeout) → timed-out.

**Steps**:

1. Run every case through spawn → collect → classify.
2. Assert every `completionMarker` is true only for the cases whose declared source fact says so: the two JSONL completed cases (outcome `completed`, with and without the tool-failure key) and the legacy envelope that reports `completion: "complete"` under a host timeout.
3. Assert `spawnRefused` is false in every case (each produced an identifier).
4. Assert `failureReported`/`toolFailure` are set only from their explicit facts, never inferred from the exit status alone.
5. Assert the declared outcomes project to the delivered token mapping with exactly four distinct tokens (`finished`, `partial`, `failed`, `max-restarts`), and that the `error`-event case and the non-zero-exit case both land on `failed` without conflating their evidence facts.
6. Assert the table has no duplicate input shape: distinct inputs, distinct evidence.

**Expected Outcome**:

- Evidence is a pure function of observed facts; no combination invents completion, refusal, or failure.

#### TC-OCS-046 - Legacy single-document envelope evidence precedence over the JSONL rules

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-7, AC-F4-1, AC-F4-2, AC-F4-4, NFR-3, DEC-4, DEC-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/scenarios/classification.ts`; `tests/fixtures/harness/scenarios/stream.ts` (`legacy-precedence` cases)
**Tags**: @backend, @stream, @compatibility, @precedence

**Preconditions**:

- The six delivered single-document envelopes from `tests/fixtures/harness/scenarios/classification.ts`: `completed`, `tool-failure`, `premature-end`, `harness-failure`, `spawn-refusal` (status 126), and `timeout` (`spawnTimedOut: true`).
- The adapter's source precedence is the spec v1.2 rule: a legacy envelope's `result` facts are authoritative; otherwise the JSONL rules apply; host `exitStatus`/`timedOut` merge on top.

**Steps**:

1. For each of the six envelopes, run spawn over the single line through the new streaming starter, finish with the case's `spawnStatus`/`spawnTimedOut`, and `collect`.
2. Assert the envelope facts are authoritative even when the JSONL rules would disagree:
   - `completed` has no `step_finish` line yet `completionMarker: true` (JSONL alone would say premature end).
   - `harness-failure` has no `error` event yet `failureReported: true` from `result.status === "failed"`.
   - `spawn-refusal` carries an identifier yet `spawnRefused: true` from `result.refused === true`; this is the only form in which an identified session may report `spawnRefused`.
   - `timeout` reports `completionMarker: true` **and** `timedOut: true`; the shared classifier checks timeout before completion, so it classifies `timed-out` (token `max-restarts`).
   - `tool-failure` reports `completionMarker: true` and `toolFailure: true` from `result.toolFailure === true`.
   - `premature-end` reports `completionMarker: false`.
3. Assert the host facts merge on top in every case: `exitStatus` equals `spawnStatus` and `timedOut` equals `spawnTimedOut`, including `spawn-refusal` (126) and `timeout` (true).
4. **Precedence control:** feed a document carrying both a `result` object and a JSONL `step_finish` line with `part.reason === "stop"`, with `result.completion: "incomplete"`; assert `completionMarker: false` (the envelope wins). Feed the inverse (`result.completion: "complete"` with no terminal line); assert `completionMarker: true`.
5. **Non-legacy control:** feed a JSONL stream with a top-level `sessionID` and no `result`/fallback-id key; assert the JSONL rules apply (terminal stop required for completion).
6. Assert no new failure code, token, or classifier rule was introduced by the precedence.

**Expected Outcome**:

- The legacy envelope is an explicit, tested evidence source, not accidental fallback behaviour; the source precedence cannot be reversed silently, and `spawnRefused` on an identified session is confined to the envelope form.

#### TC-OCS-047 - Pinned `tool_use` error part makes `toolFailure` falsifiable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, AC-F4-3, AC-F7-1, NFR-3, DEC-5
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/harness-stream-contract.test.ts`; `tests/fixtures/harness/stream/opencode-v2.2.5-tool-error.jsonl`; `tests/fixtures/harness/scenarios/stream.ts` (`tool-error`)
**Tags**: @backend, @fixture, @falsifiability

**Preconditions**:

- The pinned set contains `opencode-v2.2.5-tool-error.jsonl`; `tool-error` is the dedicated case derived from it.

**Steps**:

1. Parse `opencode-v2.2.5-tool-error.jsonl` and assert at least one line has `type === "tool_use"`, `part.type === "tool"`, and `part.state.status === "error"` with a non-empty `part.state.error` message; assert the `tool-error` case selects exactly that line (plus a terminal `step_finish` with `part.reason === "stop"`).
2. Run spawn → finish → collect over the case and assert `toolFailure: true`, `completionMarker: true`, exit 0, token `partial`.
3. Run the same case with the `tool_use` line removed; assert `toolFailure: false` and token `finished`.
4. Run the same case with `part.state.status` changed to `"completed"`; assert `toolFailure: false`.
5. Assert the adapter's JSONL evidence path reads `state.status === "error"` only; no other field (e.g. `part.error`, `part.status`, or an exit code) can set `toolFailure`.

**Expected Outcome**:

- AC-F4-3 fails if the fixture loses the encoding or the adapter stops reading it; the fixture and the assertion cannot self-certify each other because the mutation flips the result.

#### TC-OCS-048 - Pinned `error` event makes `failureReported` falsifiable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, AC-F4-4, AC-F7-1, NFR-3, DEC-5
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-stream.test.ts`; `tests/structure/harness-stream-contract.test.ts`; `tests/fixtures/harness/stream/opencode-v2.2.5-stream-error.jsonl`; `tests/fixtures/harness/scenarios/stream.ts` (`stream-error`)
**Tags**: @backend, @fixture, @evidence, @falsifiability

**Preconditions**:

- `opencode-v2.2.5-stream-error.jsonl` carries a real-shape `error` event: `{ "type": "error", "timestamp", "sessionID", "error": { "type", "message" } }`; `stream-error` selects it after a valid identified line, with exit 0 and no terminal `step_finish`.

**Steps**:

1. Parse `opencode-v2.2.5-stream-error.jsonl` and assert at least one line has `type === "error"` and an `error` object with a string `type` and `message`; assert the `stream-error` case selects exactly that line.
2. Run spawn → finish (exit 0) → collect; assert `failureReported: true`, `completionMarker: false`, `exitStatus: 0`.
3. Classify; assert outcome `failed`, token `failed` (not `premature-end`/`partial`) — the `error` event alone changes the outcome.
4. **Falsifiability control:** remove the `error` line from the same case; assert `failureReported: false` and outcome `premature-end`/token `partial`. This is what makes AC-F4-4 fail if the adapter ignores the event.
5. Repeat with a non-zero exit and **no** `error` event, still over a JSONL stream: assert `failureReported: false`, `completionMarker: false`, and `exitStatus` non-zero — the exit is carried by `exitStatus` only and is not copied into `failureReported` (spec v1.3 F-4/§8.4/DEC-5). Classify and assert outcome `failed`, token `failed` through the classifier's exit branch (`packages/core/src/domain/harness-classify.ts:50-52`). This pairs with TC-OCS-045 step 4: the two failure facts stay separable, so a non-zero exit with no failure signal is not mislabelled as a provider-reported failure.
6. Assert the message text is never interpolated into evidence, a failure, or a log.

**Expected Outcome**:

- A stream/agent failure is detected from the real `error` event, and a regression that drops the event is caught by the outcome change, not by a self-certifying fixture.

#### TC-OCS-050 - Handle-bound expiry kills the child, sets `timedOut`, and refuses pre-session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-1, NFR-7, DEC-3, DEC-6
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-stream-hygiene.test.ts`
**Tags**: @backend, @stream, @hygiene

**Preconditions**:

- A fake stream that stays open with no lines; the test triggers bound expiry exactly once.

**Steps**:

1. Spawn; assert no handle is returned yet.
2. Fire `expireHandleBound()`: the fake ends lines, resolves completion `{status: 1, timedOut: true}`, and records the host-side kill.
3. Assert `spawn` resolves `harness.spawn.refused` with `timedOut` reflected in the refusal summary and the observed status.
4. Assert `kills === 1` and `acquired()` was never called.
5. Assert no session record exists; a later `collect` is `harness.session.unknown`.
6. Repeat on the resume path; assert `harness.session.unknown` plus one kill.

**Expected Outcome**:

- Bound expiry is a killed child, a pre-session refusal, and zero leaked state.

#### TC-OCS-051 - Kill on every failure and abandonment path; kill is idempotent

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-7, DEC-6, RSK-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-stream-hygiene.test.ts`
**Tags**: @backend, @stream, @hygiene

**Preconditions**:

- A fake starter that counts kills per stream and survives repeated `kill()` calls.

**Steps**:

1. Drive every failing path: no-id exit 0, no-id non-zero, bound expiry, resume no-id, resume mismatch, and a host-initiated kill after acquisition (external termination).
2. Assert `kills >= 1` on each path and exactly one kill on the single-shot paths (idempotent, not counted twice).
3. Call `kill()` twice on the same stream; assert no throw and the completion resolves once.
4. Assert a *successful* acquisition does not kill before completion; after completion, no kill is required and none is asserted.
5. Assert the fake reports zero live streams at case end (an explicit leak check on the fake's registry).

**Expected Outcome**:

- Every failed or abandoned acquisition kills its child exactly once; kill is safe to repeat.

#### TC-OCS-052 - Host starter over a real synthetic child: lines, acquired, close, kill, escalation, no orphan

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-2, AC-F6-2, NFR-4, NFR-7, DEC-6
**Test Type(s)**: Integration, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-host-stream.test.ts`; `packages/adapters/src/host/index.ts`
**Tags**: @backend, @host, @process

**Preconditions**:

- A test-supplied child script run by the Bun runtime (`process.execPath -e '<script>'`), never `opencode` or `claude`. The script prints one JSON line, optionally writes its PID to a temp file, and then either exits or waits.
- A temp root created with `mkdtempSync` and removed in `finally`.

**Steps**:

1. **Streaming:** start a child that prints two lines with a short internal delay; assert the `lines` iterator yields both and that `completion` resolves only after close with the accumulated stdout and status 0.
2. **Acquisition signal:** use `handleTimeoutMs: 100` and a child that prints its line immediately and exits at ~400 ms (child-side timer); await `completion`. Assert `timedOut: false` and status 0 — which is only possible if `acquired()` cancelled the handle timer. A regression that never signals acquisition kills the child at 100 ms and yields `timedOut: true`; the margins (100 ms vs 400 ms) make the case stable without any test-side wait.
3. **Bound expiry:** start a child that prints nothing and stays alive with `handleTimeoutMs: 50`; assert `completion` resolves `timedOut: true` and the child is killed.
4. **Kill semantics:** start a long-lived child; call `kill()`; assert `completion` resolves (status non-zero or signal-derived) and a second `kill()` does not throw.
5. **Escalation:** start a child that ignores `SIGTERM` and stays alive; call `kill()`; assert `completion` resolves within the bounded test window, proving the `SIGKILL` escalation.
6. **No orphan:** read the child's PID from the temp file; after `completion`, poll `process.kill(pid, 0)` a bounded number of times and assert it throws `ESRCH`.
7. **Truncation:** assert the source constant is `16 * 1024 * 1024` and the marker is appended (static assertion; no 16 MB allocation in the suite).

**Expected Outcome**:

- The one child-process site behaves as the contract requires, including kill escalation and no orphan, without ever invoking a harness CLI.

#### TC-OCS-053 - Bounds wiring: 60 s acquisition default, no whole-session default, listing timeout separate

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, NFR-1, NFR-2, DEC-3
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-stream-hygiene.test.ts`
**Tags**: @backend, @stream, @bounds

**Preconditions**:

- The fake starter records the options object it receives.

**Steps**:

1. Construct the adapter with no bounds; spawn; assert the recorded `handleTimeoutMs === 60_000`.
2. Assert `sessionTimeoutMs` is absent or `0` (unbounded).
3. Construct with `handleTimeoutMs: 1_234` and `sessionTimeoutMs: 5_678`; assert both are passed through verbatim.
4. Assert the spawn-path stream options never carry the listing timeout (`timeout`/`timeoutMs`).
5. Assert `listSessions` still invokes the one-shot runner once with the listing timeout (the delivered `TIMEOUT_MS` fixture) and never the starter.
6. Structurally assert that no `300_000` value and no `DEFAULT_TIMEOUT_MS` reference reaches the **spawn/resume starter options**: the options object handed to the starter carries `handleTimeoutMs`/`sessionTimeoutMs` only, with no `timeout`/`timeoutMs` key. The adapter's `DEFAULT_TIMEOUT_MS = 300_000` (`packages/adapters/src/harness/opencode.ts:76`) is legitimately retained for the `listSessions` one-shot runner (`opencode.ts:127,305`, spec §8.4 keeps session listing unchanged), so asserting "no `300_000` literal in the file" is wrong; assert the value is unreachable from the starter path instead.

**Expected Outcome**:

- The acquisition bound is the only default bound; the whole-session bound is opt-in data; listing keeps its own one-shot timeout with the delivered `DEFAULT_TIMEOUT_MS` (300 s) untouched.

#### TC-OCS-060 - Composition binding: opencode gets starter + runner; Claude gets runner only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-composition.test.ts` (extend); `packages/cli/src/production.ts`
**Tags**: @backend, @composition

**Preconditions**:

- The delivered production composer accepts injected seams; the existing suite already injects a recording `harnessSpawnRunner` and a fixed origin.

**Steps**:

1. Extend the composition facts with a recording starter and a recording runner.
2. Invoke a production-composed dispatch and assert the opencode spawn went through the starter (starter invocations = 1, runner invocations = 0 for spawn/resume).
3. Invoke `session list` through the composed program and assert it went through the runner with the listing args.
4. Build the Claude harness and assert a spawn uses the runner only; the starter records zero invocations.
5. Assert the opencode harness's `classify` is the shared `classifyHarnessEvidence` reference and the Claude harness's is the same reference.
6. Assert no harness receives a seam it does not declare (the composition fact set has one starter and one runner, no per-kind branches beyond the delivered selection).

**Expected Outcome**:

- Each harness receives exactly its declared seams; the port surface is unchanged.

**Notes / Clarifications**:

- Existing composition tests that inject only a runner must be updated to inject the starter as well; that edit is expected and part of this change, not a weakening.

#### TC-OCS-061 - Conformance registry builds opencode over the streaming seam; floor unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, F-7, AC-F1-7, AC-F7-1, AC-F7-3, NFR-3, NFR-5, DEC-5
**Test Type(s)**: Contract, Conformance
**Automation Level**: Automated
**Target Layer / Location**: `packages/testkit/src/conformance/harness.ts` (edit); `tests/conformance/harness-classification.test.ts` (extend); `tests/structure/conformance-coverage.test.ts`; `tests/fixtures/harness/scenarios/classification.ts`
**Tags**: @backend, @conformance

**Preconditions**:

- The six-scenario classification floor and the registry coverage meta-check are delivered. The exact delivered cases are `completed`, `tool-failure`, `premature-end`, `harness-failure`, `spawn-refusal` (status 126), and `timeout` (`completionMarker: true` + `timedOut: true` → `max-restarts`).

**Steps**:

1. Assert the opencode registration's `build` acquires from a **multi-line** `spawnStdout`: feed a JSONL stream of two or more lines whose first line carries a top-level `sessionID` (and a later terminal `step_finish`), and assert `spawn` resolves `ok: true` with that id and `collect` returns the derived evidence. This is the only observable seam — `HarnessConformanceIo` (`packages/testkit/src/conformance/harness.ts:41-47`) and `HarnessConformanceRegistration.build` (`:61-65`) expose `spawnStdout` plus the injected deps and nothing else, so a single-document `spawnStdout` is behaviourally indistinguishable between a one-shot runner and a starter. Do **not** assert "never over the one-shot runner" from this surface. If the delivery instead adds a recording starter seam to the registry, assert the recorded invocation there and record that addition in the plan; otherwise the multi-line assertion above is the requirement.
2. Run the delivered six scenarios on both adapters; assert identical outcome and token per scenario, and assert the delivered expected evidence per case: `completed` → `completionMarker: true`/`finished`; `tool-failure` → `completionMarker: true` + `toolFailure: true`/`partial`; `premature-end` → `completionMarker: false`/`partial`; `harness-failure` → `failureReported: true`/`failed`; `spawn-refusal` → `spawnRefused: true`/`noop-lane-permission`; `timeout` → `completionMarker: true` + `timedOut: true`/`max-restarts`.
3. **Legacy parity, named cases.** For the five cases that have an identified JSONL counterpart, add a real-shape JSONL variant with the same expected outcome/token and assert it classifies identically to the delivered single-document form: `completed` (terminal `step_finish` reason `stop`), `tool-failure` (`tool_use` with `state.status === "error"` plus terminal stop), `premature-end` (no terminal `step_finish`), `harness-failure` (`error` event), and `timeout` (terminal stop plus host `timedOut: true` → `max-restarts`; the legacy case keeps its envelope `completionMarker: true`, the JSONL case has `completionMarker: false`, and both classify `timed-out`). `spawn-refusal` is legacy-only by design (F-4: `spawnRefused` on an identified session exists only through the envelope); its JSONL counterpart is the pre-session no-identifier refusal path asserted by TC-OCS-013, not an identified classification. Assert the six legacy envelopes' evidence facts come from the envelope under F-4's precedence: `completionMarker` from `result.completion === "complete"` (even with no `step_finish`), `spawnRefused` from `result.refused === true` (even though the envelope carried `session.id`), `failureReported` from `result.status === "failed"`, and `toolFailure` from `result.toolFailure === true`; the host `spawnStatus`/`spawnTimedOut` merge on top.
4. Assert the Claude registration still builds over the one-shot runner and is untouched.
5. Assert `harnessConformanceViolations` still reports no drift and the coverage meta-check still requires a classification case per registration.
6. Assert the suite makes no real CLI invocation (all commands are synthetic).

**Expected Outcome**:

- The conformance floor holds over the new seam; the six named legacy cases and their JSONL counterparts cannot diverge silently, and a regression that drops the stream path or the legacy evidence source fails a named case.

**Notes / Clarifications**:

- The JSONL counterparts are derived inline in the conformance test from the delivered raw shapes; `tests/fixtures/harness/scenarios/classification.ts` is read-only for this change (no sixth/seventh scenario is added to the delivered six). This keeps the floor at six while still exercising both sources.

#### TC-OCS-062 - Retained legacy classification floor: six delivered cases and `TC-HARN-010` stay green through the new acquisition

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, F-7, AC-F1-7, AC-F7-1, AC-F7-3, NFR-3
**Test Type(s)**: Contract, Behavioural
**Automation Level**: Automated
**Target Layer / Location**: `tests/fixtures/harness/scenarios/classification.ts` (read-only); `tests/conformance/harness-classification.test.ts`; `tests/behaviour/harness-opencode-session.test.ts` (`TC-HARN-010`)
**Tags**: @backend, @conformance, @regression, @legacy

**Preconditions**:

- The delivered six cases are unchanged: `completed`, `tool-failure`, `premature-end`, `harness-failure`, `spawn-refusal` (status 126), `timeout` (`spawnTimedOut: true`).
- The delivered `TC-HARN-010` describe still asserts completed / premature-end / failed as three distinct outcomes.

**Steps**:

1. Assert structurally that `CLASSIFICATION_SCENARIOS` still contains exactly the six delivered ids with their delivered expected evidence/token pairs (`completed`→`finished`, `tool-failure`→`partial`, `premature-end`→`partial`, `harness-failure`→`failed`, `spawn-refusal`→`noop-lane-permission`, `timeout`→`max-restarts`). No fixture rewrite is permitted for this change.
2. Run all six through the opencode adapter over the new streaming starter (legacy single-document line; completion = `{status: spawnStatus, timedOut: spawnTimedOut}`); assert the expected evidence and token for each.
3. Run the same six through the unchanged Claude adapter; assert identical outcome and token per case, and no divergence record.
4. Run the delivered `TC-HARN-010` describe unchanged; assert the three outcomes remain distinct and the liveness case still declares the worktree kind absent.
5. Assert the correct mutation red/green set (M-17, §7.3). M-17 deletes the legacy-envelope branch in the adapter and does **not** touch `CLASSIFICATION_SCENARIOS`, so: step 1 stays **green** (the fixture is unchanged — it is the invariant, not the detector); step 2 goes **red** on the opencode run (`completed` loses `completionMarker`, `harness-failure` loses `failureReported`, `spawn-refusal` loses `spawnRefused`, `timeout` loses its completion fact, so the six cases diverge); step 3 stays **green** (the Claude adapter is untouched by M-17); step 4 goes **red** on its first assertion — the delivered `TC-HARN-010` describe runs the same single-document envelopes through the opencode adapter, so `completed` and `failed` both collapse to `premature-end` and the three outcomes are no longer distinct — while its liveness assertion stays green. Assert this set; a claim that "only step 2 is red" overstates the detector, and a claim that step 1 goes red is false. Note that the §7.3 M-17 command runs only the stream and conformance suites, so step 4's red is observable only when `tests/behaviour/harness-opencode-session.test.ts` is added to the mutation run.

**Expected Outcome**:

- The retained conformance floor and `TC-HARN-010` are explicitly guarded, not merely assumed; the new acquisition cannot change a delivered classification or evidence fact.

#### TC-OCS-070 - Type contract: starter/stream accept the host implementation; port unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F7-4, AC-F6-2, NFR-9
**Test Type(s)**: Type
**Automation Level**: Automated (compile)
**Target Layer / Location**: `tests/types/harness-stream.type-test.ts` (new; picked up by the `tests/types/tsconfig.json` glob)
**Tags**: @backend, @types

**Preconditions**:

- `pnpm typecheck` compiles `tests/types/**/*.type-test.ts`; `@ts-expect-error` comments are the assertions (with a one-line reason each, per the TS rules).

**Steps**:

1. Assign `createHostSpawnStarter` to `HarnessSpawnStarter`; compile.
2. Assign a fake starter returning `{lines, completion, acquired, kill}`; compile.
3. Assert a stream missing `kill` is rejected (`@ts-expect-error`).
4. Assert `sessionTimeoutMs` is optional: an options object without it compiles; with it compiles; with a string is rejected.
5. Assert `HarnessSessionPort` accepts the opencode port and rejects an object with an eighth member (`@ts-expect-error`).
6. Assert `HarnessSpawnRunner` still accepts a one-shot function and rejects a result without `timedOut` (`@ts-expect-error`).
7. Assert the stream's `completion` is assignable to `Promise<HarnessSpawnRunnerResult>` (one result type, not a second shape).

**Expected Outcome**:

- The additive seam type-checks against the real host implementation, and no delivered contract widened or moved.

#### TC-OCS-071 - Hermeticity and determinism meta-check: no real CLI, no timer, replay stability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-5, NFR-6, RSK-5
**Test Type(s)**: Static, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-stream-hygiene.test.ts`; static scan of the harness suites
**Tags**: @backend, @meta, @hermetic

**Preconditions**:

- None.

**Steps**:

1. **Adapter-suite command literals.** Scan the adapter behaviour suites only — `tests/behaviour/harness-opencode-stream.test.ts` and `tests/behaviour/harness-opencode-resume-stream.test.ts` — for `node:child_process`, `Bun.spawn`, `Bun.$`, `execFile`, and the literals `"opencode"`/`"claude"` used as a command; assert the only command values come from `tests/fixtures/harness/harness-io.ts` synthetic constants (`HARNESS_COMMAND`, `CLAUDE_COMMAND`).
2. **Host-suite exclusion, with reason.** `tests/behaviour/harness-host-stream.test.ts` is excluded from the command-literal scan because TC-OCS-052 deliberately runs `process.execPath -e '<script>'` as a synthetic Bun child, never a harness CLI. Assert `process.execPath` appears only in that host suite and never in the adapter suites; keep the `node:child_process`/`Bun.spawn`/`Bun.$`/`execFile` ban on **all** harness suites, including the host suite.
3. Scan `tests/fixtures/harness/stream.ts` for `setTimeout`, `setInterval`, `Date.now`, and `performance.now`; assert none.
4. Assert the fixture's virtual clock is plain data and that every wait in the suites is a promise gate or the bounded `flushUntil` helper, not a duration.
5. Replay the same fake script twice with fresh fakes; assert byte-identical `collect` evidence and identical classification.
6. Assert continued draining: after acquisition, deliver extra lines and assert the fake's delivered count reaches the total (the adapter does not stop consuming and cannot backpressure the child).
7. Assert the fixture exposes no way to reach a real process (no file path, no command execution, no network).

**Expected Outcome**:

- The battery is hermetic and deterministic by construction; replay is stable and the stream is fully drained.

#### TC-OCS-072 - Fixture non-vacuity control: the stream fixture is the only reason acquisition works

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-5
**Test Type(s)**: Unit, Meta
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-stream-hygiene.test.ts`; `tests/fixtures/harness/stream.ts`
**Tags**: @backend, @meta, @non-vacuity

**Preconditions**:

- The fake starter can be built with mutated scripts.

**Steps**:

1. Run the happy case and assert a handle is produced.
2. Re-run with the `sessionID` key renamed to `session_id`; assert acquisition fails with `harness.spawn.invalid-output` (the fixture is load-bearing).
3. Re-run with the first line removed; assert the handle still comes from the second line's identifier (the test is not accidentally reading line 0 only).
4. Re-run with all lines empty; assert the refusal.
5. Assert the handle's id is not equal to the work-item ref, the command name, or any test constant (no accidental echo).
6. Assert the fake can distinguish "delivered" from "queued" and that the happy case asserts delivery.

**Expected Outcome**:

- The happy path cannot pass for an unrelated reason; the fixture and the seam are both load-bearing.

#### TC-OCS-080 - Claude adapter regression: headless session, gaps, and drift unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-3, RSK-6
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-claude-session.test.ts` (assertions unchanged; only the opencode helper in the cross-adapter parity test is rewired to the fake starter)
**Tags**: @backend, @regression, @parity

**Preconditions**:

- The delivered Claude suite exists and is green before this change.

**Steps**:

1. Run the delivered suite unchanged in its assertions: headless args, prompt as stdin, descriptor env, shared classifier, resume/deliver gaps with zero invocations, declared-absent liveness, optional-field drift.
2. Assert the Claude spawn path uses the one-shot runner only (the starter is not referenced).
3. In the cross-adapter parity test, replace the opencode builder's one-shot fake with the fake starter while keeping the same raw single-document output and the same expected token; assert parity still holds.
4. Assert the Claude adapter source is unchanged in its observable contract: no starter option, no new failure code.
5. Assert the classifier reference is shared with opencode.

**Expected Outcome**:

- Claude behaviour is untouched; the parity assertion remains meaningful because both adapters still classify the same scenario identically.

#### TC-OCS-081 - Session listing regression plus retained `TC-HARN-010` opencode behaviour

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-3, RSK-6
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-opencode-session.test.ts` (listing describes kept; spawn/resume describes moved to the stream suites)
**Tags**: @backend, @regression, @listing

**Preconditions**:

- The delivered listing suite exists, and the delivered `TC-HARN-010` describe (completed / premature-end / failed) is still present in the same file.

**Steps**:

1. Run the delivered listing cases unchanged: capability declared, one invocation with `LIST_ARGS`, descriptor cwd/env, listing timeout, work-item attribution.
2. Assert the listing path uses the one-shot runner and never the starter (the fake starter records zero invocations).
3. Assert an empty listing, a malformed listing, and a non-zero listing remain the delivered outcomes (`harness.listing.invalid-output` / status).
4. Assert the session cap and truncation mark are unchanged.
5. Assert a declared listing gap still returns before any invocation.
6. **Retained behaviour:** run the delivered `TC-HARN-010` describe unchanged (completed, premature-end, failure distinct; liveness worktree kind absent) through the new acquisition and assert it stays green; a rewrite of those assertions is a coverage hole.

**Expected Outcome**:

- Read-only session listing is byte-for-byte the delivered behaviour and does not ride the new seam; the delivered `TC-HARN-010` outcomes survive the adapter rewrite unchanged.

#### TC-OCS-082 - Dispatch regression: spawn-failed identity unchanged; acquired session watched and classified

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-8, AC-F2-1, AC-F8-1, NFR-3, NFR-8, DEC-7
**Test Type(s)**: Integration, Behavioural
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-acquisition.test.ts` (new); `tests/fixtures/dispatch/golden/harness.ts` (add an injectable harness port)
**Tags**: @backend, @dispatch, @regression

**Preconditions**:

- The real opencode adapter is composed over the fake starter and injected as the dispatch harness port; truth reads and the clock are the delivered deterministic fakes.

**Steps**:

1. **Healthy acquisition:** spawn the adapter over a stream that identifies immediately and keeps `collect` pending; dispatch's liveness watch polls at the configured cadence. Assert more than one liveness poll occurs while `collect` is pending (the watch is observable during the session, which is impossible with a completion-gated spawn).
2. Finish the stream with exit 0 and a terminal stop; assert dispatch reaches classification with token `finished` (or the truth-derived token) and records exactly one attempt.
3. **Pre-session failure:** run the same composition over a stream with no identifier and a non-zero exit; assert the **envelope's** `data.error.code` is `dispatch.session.spawn-failed` and `data.lastMessage` is exactly `spawn failed before a session existed`, the delivered `data.result`/`data.outcome` pair is recorded, and exactly one attempt is recorded. Read both fields from `DispatchEnvelopeData` (`packages/core/src/contracts/dispatch.ts:278-296`). The attempt payload `DispatchAttemptRecord` (`contracts/dispatch.ts:189-210`) carries no `errorCode` and no `lastMessage`; do not read them from the attempt.
4. Assert dispatch's call order is spawn → collect (pending) → liveness → classification, never collect-before-spawn.
5. Assert the attempt record's own fields: a non-empty `attemptId`, the classified `token`/`outcome`, and `evidenceRefs` containing `attempt:<attemptId>` plus any `liveness:<verdict>` refs produced by the watch (`packages/core/src/app/dispatch.ts:684`). Assert the adapter recorded the spawn→collect handle through the injected fake starter (the starter's spawn ran, and the same handle value was passed to `collect`). Do not expect a `sessionId` in the attempt record or in its evidence refs: the record has no `sessionId` field (`contracts/dispatch.ts:189-210`) and the refs are only `attempt:<id>` and `liveness:<verdict>`; the handle is adapter-side, observable through the fake starter.
6. Assert no merge port is invoked and no additional spawn occurs on either path.

**Expected Outcome**:

- The engine needs no change: a healthy acquisition is watched and classified, and the preserved failure identity still collapses exactly as before.

**Notes / Clarifications**:

- Adding a `harnessPort` option to the dispatch fixture is a fixture change, not a production change. If the delivery prefers, the same assertions may live in `tests/behaviour/dispatch-watch.test.ts`; the fixture extension is required either way.
- This is the behavioural half of "dispatch unchanged"; TC-OCS-004 is the structural half. Neither is a file hash or a branch diff.

#### TC-OCS-100 - End-to-end real dispatch reaches classification with any token

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-8, RSK-1, RSK-2
**Test Type(s)**: E2E, Manual (operator-run)
**Automation Level**: Manual
**Target Layer / Location**: §6.3 procedure; scratch clone outside this worktree; installed `opencode v2.2.5`; `bun packages/cli/bin/delivery-os.ts`
**Tags**: @e2e, @operator, @real-cli

**Preconditions**:

- `opencode --version` reports `2.2.5` on a healthy install.
- This change's worktree is clean (`git status --porcelain` empty) before the run.
- The dispatch process can authenticate: `GITHUB_TOKEN` is exported in the invoking shell, `gh auth status` succeeds, and `gh issue view 275 -R juliusz-cwiakalski/agentic-delivery-os --json number` exits 0 (§6.3 step 0a). A missing credential is a blocked precondition, not a test failure.
- The clone's project-committed config (`<clone>/.delivery-os/config.yaml`, §6.3 step 1b) sets `lane.liveness-interval: 3000`, and `config get lane.liveness-interval --json` returns `3000`.
- A scratch clone exists outside this worktree with the delivered branch, the real origin `https://github.com/juliusz-cwiakalski/agentic-delivery-os.git`, and this worktree's built `dist` reachable through the reused `node_modules` (§6.3 steps 1–3).
- The queue entry for `GH-275` exists in the scratch clone.

**Steps**:

1. Run the §6.3 procedure exactly, capturing the dispatch log and envelope, the step 1c first-event latency probe, and the attempt record.
2. Kill only the dispatch's own `opencode` child after the handle window (§6.3 step 6); never kill the dispatch process before it classifies.
3. Read the envelope's `data.result`, `data.lastMessage` and `data.error.code`; read the attempt record's `attemptId`, `token`, `outcome` and `evidenceRefs` (`DispatchAttemptRecord`, `packages/core/src/contracts/dispatch.ts:189-210`; the record has no `errorCode`/`lastMessage`/`sessionId`).
4. Assert `data.result` is one of the eleven delivered tokens.
5. Assert `data.lastMessage` is not `spawn failed before a session existed` and `data.error.code` is not `dispatch.session.spawn-failed`.
6. Assert the attempt record's `evidenceRefs` contains `attempt:<attemptId>` and at least one `liveness:` reference. Treat the `liveness:` ref as **corroborating evidence only**, never as proof of non-blocking acquisition: the production opencode adapter receives no `livenessFacts` (`packages/cli/src/production.ts:443-458`; `packages/adapters/src/harness/opencode.ts:257`), so every reading is absent and the verdict can be `liveness:unknown`, which a completion-gated build can record just as well. The real discriminator for non-blocking acquisition is the deterministic suite — TC-OCS-020/TC-OCS-021, and TC-OCS-082 step 1 which requires `collect` to stay pending across at least one liveness poll.
7. Assert the elapsed wall time from start to classification is under 180 s.
7a. Assert the lease proof from §6.3 step 7a: `queue list --json` shows no active `GH-275` lease held by `dispatch` on `github.com/juliusz-cwiakalski/agentic-delivery-os`.
8. Record the observed token, exit code, harness kind, elapsed time, the step 1c first-event latency, the attempt record's `attemptId` and `evidenceRefs`, and the lease check result in §10.

**Expected Outcome**:

- One real dispatch on a healthy CLI reaches classification, records one attempt with a non-empty `attemptId`, and releases its `GH-275` lease; the spawn-failed identity is not taken. A `liveness:` ref corroborates that the watch ran while the session was live, but it is not the proof of non-blocking acquisition (see Notes).

**Notes / Clarifications**:

- The observed token may be `failed`/`partial` because the probe kills the session after the handle window; any token is an accepted pass per AC-F8-1. A `liveness:` evidence ref is required corroboration that the watch ran, but it does **not** on its own prove non-blocking acquisition: the production adapter is composed without `livenessFacts`, so the verdict can be `liveness:unknown` and a completion-gated build could record the same ref. The non-blocking property is proven deterministically by TC-OCS-020/TC-OCS-021 and, at the dispatch level, by TC-OCS-082 step 1 (`collect` pending across at least one poll). The operator adds the lease proof (§6.3 step 7a) to the PASS rule; a run that leaves the `GH-275` lease held is a FAIL even with a valid token.
- If the first identified event itself takes longer than the 60 s acquisition bound, the run is a **blocked precondition** (CLI/provider slowness), recorded per §6.3's pass/fail rule; it is not a product failure and no TC-OCS-100 result is written.

#### TC-OCS-101 - End-to-end proof is bounded and mutates no file in this change's worktree

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, RSK-1
**Test Type(s)**: E2E, Manual (operator-run)
**Automation Level**: Manual
**Target Layer / Location**: §6.3 procedure; scratch clone and its own state root
**Tags**: @e2e, @operator, @isolation

**Preconditions**:

- Same as TC-OCS-100, plus a pre-run `git status --porcelain` and `git rev-parse HEAD` snapshot taken in this change's worktree.
- The only clone-local edit is `<clone>/.delivery-os/config.yaml` (the probe's short liveness interval); it is removed with the clone and never touches this worktree.

**Steps**:

1. Confirm the dispatch ran with `cwd` inside the scratch clone (the log's composed work directory and the child's cwd), never inside this worktree.
2. Assert the proof never ran a nested lifecycle in this worktree: the pre/post `git status --porcelain` and `HEAD` of this worktree are identical.
3. Assert the kill was scoped to the dispatch's own child (recorded PID/`pgrep -P`), not a global `pkill`.
4. Assert the elapsed time is bounded (≤180 s from dispatch start to classification) and that a session still alive at the bound is killed, not abandoned.
5. Assert the attempt record carries `attempt:<attemptId>` plus a `liveness:` ref (§6.3 step 7), and assert the lease proof of §6.3 step 7a (no active `GH-275`/`dispatch` lease remains). The `liveness:` ref is corroborating only; it is not evidence of non-blocking acquisition (see TC-OCS-100 step 6). A run without the lease proof is not a valid proof.
6. Assert the step 1c first-event probe is recorded; if it exceeded the 60 s acquisition bound, the run is a blocked precondition (CLI/provider slowness), not a product failure, and no TC-OCS-101 result is written.
7. Record the scratch-clone `git status --porcelain` before and after: only state-root artefacts outside the clone are acceptable; a nested edit inside the clone is recorded as expected containment.
8. Clean up: kill any surviving child of the dispatch, remove the clone (including `.delivery-os/config.yaml`), confirm the lease was proven released in step 7a (force-release only if it was not), and confirm this worktree is still clean.

**Expected Outcome**:

- The proof is bounded, scoped, and leaves this change's worktree byte-identical; a nested lifecycle can only touch the disposable clone. The `liveness:` cadence corroborates that the watch ran, but the non-blocking claim rests on the deterministic suite (TC-OCS-020/021/082); the lease proof (§6.3 step 7a) is part of the PASS rule.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|-------------|----------------|------------|-------|
| Local iteration | Bun 1.4.4 (repo pin), pnpm 10.18.3 | `bun test tests/behaviour/harness-opencode-stream.test.ts`; `bun test tests/structure/harness-stream-contract.test.ts` | Narrow suites while implementing |
| Type and boundaries | Bun / TypeScript 6.0.3 | `pnpm typecheck`; `pnpm check:boundaries` | Type tests, data-only contract, runtime-API confinement, allowlist equality |
| Full automated battery | Bun | `bun test` | Every `*.test.ts`, including the conformance and checks tiers |
| Aggregate gate | Bun | `pnpm check` (lint → format:check → typecheck → test → boundaries → invariants) | Pre-finish gate (NFR-9) |
| Host-starter process cases | Bun (synthetic child) | `bun test tests/behaviour/harness-host-stream.test.ts` | Real child process for the single child-process site only |
| End-to-end proof | Installed `opencode v2.2.5` + Bun | §6.3 | One real dispatch, operator-run, outside the change worktree |

### 6.1 Test Data

- **Real-shape stream fixture set**: `tests/fixtures/harness/stream/opencode-v2.2.5.jsonl` (the three-line happy-path capture: `step_start`, `text`, terminal `step_finish` with `part.reason === "stop"`), `opencode-v2.2.5-tool-error.jsonl` (a `tool_use` event with `part.type === "tool"` and `part.state.status === "error"`, followed by a terminal stop), and `opencode-v2.2.5-stream-error.jsonl` (an `error` event with `{type, timestamp, sessionID, error:{type,message}}` after an identified line). All are committed captures, redacted of prompt content, with synthetic `part` payloads. The set is the only stream oracle for the adapter suites; each failure encoding is pinned in its own dedicated file so a case can select it without the happy-path stream losing its terminal stop.
- **Case table**: `tests/fixtures/harness/scenarios/stream.ts` — named cases derived from DEC-4/DEC-5/Appendix C: `real-three-line`, `leading-noise`, `no-id-exit-0`, `no-id-non-zero`, `no-id-bound`, `id-then-non-zero`, `truncated`, `single-session-id`, `single-sessionId`, `single-id`, `precedence`, `legacy-precedence`, `legacy-completion-under-timeout`, `tool-error`, `stream-error`, `no-terminal-event`, `abnormal-timeout`. Each declares the queued lines, the completion facts, the expected identity or failure code, and the expected evidence.
- **Legacy classification floor**: `tests/fixtures/harness/scenarios/classification.ts` — the six delivered single-document envelopes (`completed`, `tool-failure`, `premature-end`, `harness-failure`, `spawn-refusal`, `timeout`) with their delivered expected evidence/token pairs. Read-only for this change; TC-OCS-062 fails if they are rewritten.
- **Fake streaming starter**: `tests/fixtures/harness/stream.ts` — `createFakeStreamStarter()` returns a `HarnessSpawnStarter` plus a control object (`push`, `release`, `endLines`, `finish`, `expireHandleBound`, `kills`, `acquiredCalls`, `completionSettled`, `delivered`, `options`) and `createVirtualClock()` (`now`, `advance`). It also exports the bounded `flushUntil(predicate, turns)` helper: a loop of `await Promise.resolve()` turns with no timers and no wall clock; once the predicate becomes true it drains one final turn so a promise settled in the same turn is observed before the assertion. No file system, no process.
- **Reused delivered fixtures**: `tests/fixtures/harness/harness-io.ts` (`createRecordingRunner`, `runnerResult`, `output`, `classifier`, `assembleLiveness`, synthetic command/arg constants, `TIMEOUT_MS`), `tests/fixtures/harness/spawn-env.ts` (`createFakeCredentialPort`, `PARENT_ENVIRONMENT`, `SPAWN_ENV_DESCRIPTOR`, `DECLARED_VARIABLES`).
- **Synthetic identities**: fabricated session ids (`ses_*`), fabricated work-item refs (`GH-275`), fixed timestamps, synthetic command names (`synthetic-opencode`, `synthetic-claude`). No real session id, prompt, credential, repository name, or personal data appears.
- **Host-starter child script**: a test-supplied inline script run by the Bun runtime; it writes only inside a `mkdtemp` root and never to the repository.

### 6.2 Isolation and Cleanup

- Every filesystem-touching suite uses `mkdtempSync` and removes its root in `finally`, including on failure.
- The fake starter's stream registry is emptied per case; a helper asserts zero live streams at case end (leak check).
- The host-starter suite waits only on promises (child close/completion), never on a sleep; every case has a bounded test timeout so a broken kill fails rather than hangs.
- The real worktree is never written by any suite. A `git status --porcelain` snapshot around the suite is not a test assertion (the suites are read-only by construction); the end-to-end procedure is where the worktree snapshot is asserted (TC-OCS-101).
- No suite reads `process.env`, `$HOME`, the network, or a real credential; all environment facts are injected.

### 6.3 End-to-end proof procedure (operator-run, AC-F8-1/AC-F8-2)

Executed in the delivery (or verification) phase, not by any automated suite. It must not run inside this change's worktree.

```bash
# 0. Preconditions: this worktree is clean; the delivered dist is current; the CLI is
#    pinned; the dispatch process can authenticate to GitHub.
REPO=/home/juliusz/git/cwiakalski-pub-gh/agentic-delivery-os-gh-275
E2E=/tmp/opencode/gh275-e2e
LOG=$E2E/dispatch.log
TRACKER_REPO=juliusz-cwiakalski/agentic-delivery-os
# Pin the working name: configDirectoryName/stateDirectoryName derive from it.
# Unset (or `delivery-os`) yields `.delivery-os/config.yaml` and `~/.delivery-os-state`.
unset DELIVERY_OS_WORKING_NAME
git -C "$REPO" status --porcelain            # must print nothing
git -C "$REPO" rev-parse HEAD                # record as HEAD_before
opencode --version                           # must print 2.2.5
( cd "$REPO" && pnpm build )                 # the code under test is this worktree's delivered build

# 0a. HARD CREDENTIAL PRECONDITION. The production GitHub instance resolves the
#     `GITHUB_TOKEN` environment variable literally (packages/cli/src/production.ts,
#     githubInstance(): sourceKey { style: "literal", name: "GITHUB_TOKEN" }), so a
#     `gh` keyring login alone is not visible to the dispatch process. The token must
#     be exported in the invoking shell.
export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token 2>/dev/null)}"
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "STOP: blocked precondition - no GITHUB_TOKEN for the dispatch process"; exit 1
fi
gh auth status >/dev/null 2>&1 \
  || { echo "STOP: blocked precondition - gh is not authenticated"; exit 1; }
gh issue view 275 -R "$TRACKER_REPO" --json number >/dev/null \
  || { echo "STOP: blocked precondition - tracker read probe failed"; exit 1; }

# 1. A disposable clone outside the change worktree (own .git, own worktree).
rm -rf "$E2E"
git clone --no-hardlinks --single-branch \
  --branch fix/GH-275/opencode-harness-contract "$REPO" "$E2E"

# 1a. Reuse this worktree's pnpm install. Its relative workspace links resolve to
#     this worktree's packages, so the probe runs the delivered build (the intent).
#     The clone supplies the isolated cwd and git worktree; the state root stays the
#     real one and the appended attempt record is retained as production evidence.
ln -s "$REPO/node_modules" "$E2E/node_modules"

# 1b. PIN THE PROBE'S LIVENESS CADENCE INSIDE THE DISPOSABLE CLONE.
#     Mechanism verified in source: `lane.liveness-interval` is read only from the
#     layered YAML config; LANE_BRANCH (packages/core/src/config/catalog.ts:323-334)
#     declares neither `env` nor `flag`, so there is no environment variable and no
#     CLI flag for it. `dispatch` also rejects `--config` (only the `config` command
#     declares that flag; parseInvocation rejects unknown flags). The clone's
#     project-committed layer is `<clone>/<configDirectoryName>/config.yaml`
#     (packages/adapters/src/file/config-source.ts:156-168); the default working name
#     is `delivery-os`, so the directory is `.delivery-os`. The edit lives only in
#     the disposable clone and is removed with it.
mkdir -p "$E2E/.delivery-os"
printf 'lane:\n  liveness-interval: 3000\n' > "$E2E/.delivery-os/config.yaml"
( cd "$E2E" && bun packages/cli/bin/delivery-os.ts config get lane.liveness-interval --json ) \
  | tee "$E2E/liveness-config.json" | jq -e '.data == 3000'

# 1c. FIRST-EVENT LATENCY PROBE (environmental, independent of the product under
#     test). The adapter's handle bound is 60 s; a healthy local CLI emits its first
#     event in seconds. This probe measures the real first event inside the clone so
#     a slow provider/CLI is classified as a blocked precondition, never as a
#     product failure. It is bounded and never writes this change's worktree.
PROBE_START=$(date +%s%3N)
FIRST_EVENT=$( ( cd "$E2E" && printf 'Reply with the single word: ok\n' | timeout 70 opencode run --format json ) | head -n 1 )
FIRST_EVENT_MS=$(( $(date +%s%3N) - PROBE_START ))
printf 'first-event-ms=%s\n' "$FIRST_EVENT_MS" | tee "$E2E/first-event.txt"
printf '%s\n' "$FIRST_EVENT" | jq -e '.sessionID' >/dev/null \
  || { echo "STOP: blocked precondition - no JSONL first event from the CLI"; exit 1; }
if [ "$FIRST_EVENT_MS" -gt 60000 ]; then
  echo "STOP: blocked precondition - first event exceeded the 60 s acquisition bound (CLI/provider slowness)"; exit 1
fi

# 2. The origin must be the real repository: dispatch derives the repository identity
#    from the origin remote and then reads tracker and CI truth through that identity.
#    A local-path origin (or a different owner) does not resolve, the truth read
#    degrades, and the run ends as a `dispatch.state-unverified` error envelope
#    instead of a delivered result token - which would fail AC-F8-1.
git -C "$E2E" remote set-url origin https://github.com/juliusz-cwiakalski/agentic-delivery-os.git

# 3. Declare the queue entry (this also binds the repository identity). Release a
#    stale lease from an interrupted earlier probe first; `noop` from add is fine.
#    Grammar verified: packages/cli/src/commands/queue.ts:381-386 (add: exactly one
#    positional ref, no branch argument, optional --priority/--dep) and :431-434
#    (release: exactly one ref plus --holder; --holder is a value flag, :348).
( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue release GH-275 --holder dispatch --json ) >/dev/null 2>&1 || true
( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue add GH-275 --json )

# 4. Run one real dispatch in the background. `exec` keeps $! equal to the dispatch
#    process, so the opencode child is a direct child of it.
( cd "$E2E" && exec bun packages/cli/bin/delivery-os.ts dispatch GH-275 --json ) >"$LOG" 2>&1 &
DISPATCH_PID=$!

# 5. Observe the handle window: the opencode child must exist and the dispatch must
#    still be running (a completion-gated spawn would be blocked inside spawn here).
CHILD=""
for _ in $(seq 1 60); do
  CHILD=$(pgrep -P "$DISPATCH_PID" -f 'opencode run --format json' || true)
  [ -n "$CHILD" ] && break
  sleep 1
done
if [ -z "$CHILD" ]; then
  echo "FAIL: no opencode child within 60 s"; kill "$DISPATCH_PID" 2>/dev/null; wait "$DISPATCH_PID"; false
fi
sleep 15        # let the first identified line arrive and the 3 s liveness watch poll

# 6. End only this dispatch's session; never the dispatch parent.
kill -TERM "$CHILD" 2>/dev/null || true
wait "$DISPATCH_PID"; RC=$?

# 7. Evidence: envelope, then the durable attempt record.
jq -r '.data.result, .data.lastMessage, (.data.error.code // "-")' "$LOG"
echo "exit=$RC"
STATE_ROOT="$HOME/.delivery-os-state"        # brand.stateDirectoryName = .delivery-os-state
ATTEMPT=$(jq -r --arg ref GH-275 \
  'select(.kind=="dispatch.attempt") | select(.payload.ref==$ref) | .payload
   | [.attemptId, .recordedAt, .token, .outcome, (.evidenceRefs|join(","))] | @tsv' \
  "$STATE_ROOT/ledger.default.jsonl" | tail -1)
printf '%s\n' "$ATTEMPT" | tee "$E2E/attempt.tsv"
ATTEMPT_ID=$(printf '%s\n' "$ATTEMPT" | cut -f1)
[ -n "$ATTEMPT_ID" ] \
  || echo "FAIL: attempt record has no attemptId"
# The liveness: ref is corroboration only (the production adapter is composed without
# livenessFacts, so the verdict can be liveness:unknown; see "Expected evidence").
printf '%s\n' "$ATTEMPT" | grep -q 'attempt:' \
  || echo "FAIL: attempt record has no attempt:<attemptId> evidence ref"
printf '%s\n' "$ATTEMPT" | grep -q 'liveness:' \
  || echo "FAIL: attempt record has no liveness: evidence ref"

# 7a. LEASE PROOF - part of the PASS rule, not only cleanup. Step 3 acquired the
#     GH-275 repo-exclusive lease; a successful dispatch must have released it
#     (dispatch.ts `releaseLease` in the `finally`). `queue list --json` projects
#     `.data.leases[]` as QueueLeaseProjection
#     (packages/core/src/contracts/queue.ts:572-582; payload built at
#     packages/cli/src/commands/queue.ts:257-282).
ACTIVE_LEASES=$( ( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue list --json ) \
  | jq -r '.data.leases[]
      | select(.ref=="GH-275")
      | select(.repository=="github.com/juliusz-cwiakalski/agentic-delivery-os")
      | [.leaseId, .holder, .scope, (.heartbeatAgeMs|tostring)] | @tsv' )
printf '%s\n' "$ACTIVE_LEASES" | tee "$E2E/leases.tsv"
if [ -n "$ACTIVE_LEASES" ]; then
  echo "FAIL: GH-275 lease still active after dispatch (see leases.tsv)"
  ( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue release GH-275 --holder dispatch --json ) \
    || echo "FAIL: lease release failed"
fi
git -C "$REPO" status --porcelain            # must still print nothing
git -C "$REPO" rev-parse HEAD                # must equal HEAD_before
```

**Expected observable evidence.**

- Step 0a passes: `GITHUB_TOKEN` is non-empty in the invoking shell, `gh auth status` succeeds, and the tracker probe exits 0.
- Step 1b passes: `config get lane.liveness-interval --json` returns `.data == 3000`, proving the clone is using the short cadence (not the 30 000 ms default).
- Step 1c records a first event with a top-level `sessionID` and `first-event-ms` ≤60 000. A longer first event is a blocked precondition (CLI/provider slowness), not a product failure.
- Step 5 finds the `opencode run --format json` child and the dispatch is still alive (not exited with an envelope) — the handle window.
- Step 7 prints a `data.result` in the eleven-token set and a `data.lastMessage` that is not `spawn failed before a session existed`; `data.error.code` is not `dispatch.session.spawn-failed` and not `dispatch.state-unverified`; total wall time from step 4 to step 6 is ≤180 s.
- Step 7 prints the attempt record's `attemptId`, `recordedAt`, `token`, `outcome` and `evidenceRefs`. The refs contain `attempt:<attemptId>` and at least one `liveness:<verdict>` ref. The `liveness:` ref is **corroborating only**: the production adapter is composed without `livenessFacts` (`packages/cli/src/production.ts:443-458`; `packages/adapters/src/harness/opencode.ts:257`), so readings are all-absent and the verdict may be `liveness:unknown`, which a completion-gated build can record too. Non-blocking acquisition is proven by the deterministic suite (TC-OCS-020/TC-OCS-021, and TC-OCS-082 step 1's `collect`-pending-across-a-poll assertion), not by this ref. The repository key is `github.com/juliusz-cwiakalski/agentic-delivery-os`.
- Step 7a shows no active `GH-275` lease: `.data.leases[]` has no row for ref `GH-275` on `github.com/juliusz-cwiakalski/agentic-delivery-os`, proving the dispatch released the lease it acquired in step 3.
- This worktree's `git status --porcelain` is empty and `HEAD` is unchanged (AC-F8-2).

**Pass/fail rule.**

- PASS = token in the delivered set, `lastMessage` not the spawn-failed sentence, a non-empty `attemptId`, an `attempt:<attemptId>` ref, at least one `liveness:` ref (corroboration only), **no active `GH-275` lease** in `queue list --json` (§6.3 step 7a), elapsed ≤180 s, this worktree unchanged.
- FAIL = the spawn-failed identity appears without an acquisition-timeout explanation, no child within 60 s, elapsed >180 s, a missing `attempt:<attemptId>`/`liveness:` ref, an active `GH-275` lease after the run, or this worktree's status/HEAD changed. A failure reopens delivery, not the E2E wording.
- STOP (blocked precondition, not a product-test failure) = step 0a fails, step 1b does not return 3000, or step 1c records a first event later than the 60 s acquisition bound (CLI/provider slowness). Record the blocked precondition, restore the environment, and re-run; do not write a TC-OCS-100/TC-OCS-101 result and do not reopen delivery on it. If step 1c is healthy but the dispatch still ends in an acquisition-timeout refusal, record it as a product FAIL (the adapter did not see a first line the CLI emits).

**Cleanup.**

- Kill any surviving child of `DISPATCH_PID`, then the dispatch process if it is still alive.
- `rm -rf "$E2E"` (the clone, its `node_modules` symlink, and the clone-local `.delivery-os/config.yaml`; never `$REPO/node_modules`).
- The lease is proven released in step 7a and that proof is part of the PASS rule; if step 7a found an active lease, force-release it with `( cd "$E2E" && bun packages/cli/bin/delivery-os.ts queue release GH-275 --holder dispatch --json )` before removing the clone.
- The attempt record appended to the real state root is retained deliberately as production proof (spec §18); record its `attemptId`, token, `outcome` and `evidenceRefs` in §10.

### 6.4 Regression Runs Outside the TC Matrix

These run as part of delivery evidence but are not AC-bearing scenarios, so they carry no `TC-*` id:

- `bash scripts/.tests/test-opencode-session.sh` and `bash scripts/.tests/test-pm-liveness.sh` — prove the untouched bash stack still parses the first `.sessionID` line and still works (spec §7.2 [OUT]).
- `bun test tests/behaviour/dispatch-*` and `bun test tests/conformance/dispatch` — prove the dispatch engine's other behaviours are unchanged.
- `bun test tests/structure tests/boundaries` — prove the delivered structural and boundary invariants still hold.
- `pnpm check` — the aggregate gate (NFR-9).

## 7. Automation Plan and Implementation Mapping

### 7.1 Files the Delivery Must Add or Edit

**Test fixtures and suites (add or edit; no license headers — test files and change artifacts are exempt):**

| Path | Action | Purpose |
|---|---|---|
| `tests/fixtures/harness/stream/opencode-v2.2.5.jsonl` | add | Base three-line happy-path capture (TC-OCS-005) |
| `tests/fixtures/harness/stream/opencode-v2.2.5-tool-error.jsonl` | add | Dedicated `tool_use` error-part capture (TC-OCS-042, 047) |
| `tests/fixtures/harness/stream/opencode-v2.2.5-stream-error.jsonl` | add | Dedicated `error`-event capture (TC-OCS-048) |
| `tests/fixtures/harness/stream/README.md` | add | Provenance (`opencode v2.2.5`) and regeneration instruction for the set |
| `tests/fixtures/harness/stream.ts` | add | Fake streaming starter, virtual clock, bounded `flushUntil(predicate, turns)` helper |
| `tests/fixtures/harness/scenarios/stream.ts` | add | Named DEC-4/DEC-5 cases with expected identity/code/evidence, including `tool-error`, `stream-error`, and `legacy-precedence` |
| `tests/fixtures/harness/scenarios/classification.ts` | run unchanged (read-only) | The six delivered legacy envelopes and expected token/evidence; TC-OCS-062 fails if rewritten |
| `tests/fixtures/harness/harness-io.ts` | edit | Re-export the stream fixtures beside `createRecordingRunner`/`runnerResult`/`output` |
| `tests/fixtures/dispatch/golden/harness.ts` | edit | Accept an injected `HarnessSessionPort` (default: the delivered scripted port) |
| `tests/fixtures/queue/production/harness.ts` | edit | Inject a recording/streaming starter under the required `starter` seam so its queue-binding suite never reaches a real child (plan P2 migration rule; no new TC, NFR-5) |
| `tests/structure/harness-stream-contract.test.ts` | add | TC-OCS-001, 002, 004, 005, 047, 048 |
| `tests/structure/harness-imports.test.ts` | edit | Extend the adapter scans; allowlist expectation unchanged (TC-OCS-003) |
| `tests/structure/dispatch-composition.test.ts` | edit | Inject the starter; assert per-harness seam wiring (TC-OCS-060) |
| `tests/types/harness-stream.type-test.ts` | add | TC-OCS-070 (picked up by the `tests/types/tsconfig.json` glob) |
| `tests/behaviour/harness-opencode-stream.test.ts` | add | TC-OCS-010–017, 020–023, 040–048 |
| `tests/behaviour/harness-opencode-resume-stream.test.ts` | add | TC-OCS-030–034 |
| `tests/behaviour/harness-stream-hygiene.test.ts` | add | TC-OCS-023, 050, 051, 053, 071, 072 |
| `tests/behaviour/harness-host-stream.test.ts` | add | TC-OCS-052 (the only suite allowed `process.execPath`) |
| `tests/behaviour/harness-opencode-session.test.ts` | edit | Keep the listing describes and the delivered `TC-HARN-010`; move spawn/resume describes to the stream suites (TC-OCS-081) |
| `tests/behaviour/harness-claude-session.test.ts` | edit | Rewire only the opencode helper in the parity test to the fake starter (TC-OCS-080) |
| `tests/behaviour/dispatch-harness-acquisition.test.ts` | add | TC-OCS-082 |
| `tests/conformance/harness-classification.test.ts` | edit | Six legacy cases + six JSONL counterparts + seam assertion (TC-OCS-061, TC-OCS-062) |
| `tests/structure/conformance-coverage.test.ts` | run unchanged | Registry coverage meta-check |
| `tests/structure/content-inventory.test.ts` | edit | Admit `createHostSpawnStarter` in the exact host executable allowance (`["createHostSpawnRunner"]` at `tests/structure/content-inventory.test.ts:682`); no other scan weakened (plan P1; no new TC) |

**Migration edits forced by the new required `starter` seam and the async acquisition (they carry no new TC):**

| Path | Action | Purpose |
|---|---|---|
| `tests/behaviour/harness-spawn-env.test.ts` | edit | Construct the opencode port with the required `starter` seam (fake starter over the same single-document output) so the environment assertions stay green |
| `tests/behaviour/harness-spawn-credential.test.ts` | edit | Same migration for the credential-scoping cases |
| `tests/conformance/harness-liveness.test.ts` | edit | Same migration at the conformance construction site |
| `tests/structure/harness-neutrality.test.ts` | edit | Same migration for the neutrality scan's construction site |

**Product code (owned by the implementation plan; named here because the tests bind to these seams):**

| Path | Declared change |
|---|---|
| `packages/core/src/contracts/harness.ts` | Add `HarnessSpawnStreamOptions`, `HarnessSpawnStream`, `HarnessSpawnStarter` (Appendix B); everything else unchanged |
| `packages/core/src/contracts/index.ts` | Re-export the additive starter/stream types beside the existing harness contract exports (plan P1); no other export moves |
| `packages/adapters/src/harness/opencode.ts` | JSONL decode, `sessionID` precedence, non-blocking spawn/resume/deliver, completion promise, bounded acquisition options, kill on failure; listing unchanged |
| `packages/adapters/src/host/index.ts` | Add `createHostSpawnStarter` beside the unchanged `createHostSpawnRunner`; still the single `node:child_process` site |
| `packages/cli/src/production.ts` | Bind the starter for opencode; keep the one-shot runner for listing; Claude unchanged |
| `packages/testkit/src/conformance/harness.ts` | Build the opencode registration over the streaming seam |

### 7.2 TC → File / Command Mapping

| TC ID | File(s) to create or update | Execution command | Status |
|-------|------------------------------|-------------------|--------|
| TC-OCS-001 | `tests/structure/harness-stream-contract.test.ts`; `packages/core/src/contracts/harness.ts` | `bun test tests/structure/harness-stream-contract.test.ts` | To Implement |
| TC-OCS-002 | `tests/structure/harness-stream-contract.test.ts`, `tests/types/harness-stream.type-test.ts` | `bun test tests/structure/harness-stream-contract.test.ts`; `pnpm typecheck` | To Implement |
| TC-OCS-003 | `tests/structure/harness-imports.test.ts` | `bun test tests/structure/harness-imports.test.ts`; `pnpm check:boundaries` | Existing – Update |
| TC-OCS-004 | `tests/structure/harness-stream-contract.test.ts` | `bun test tests/structure/harness-stream-contract.test.ts` | To Implement |
| TC-OCS-005 | `tests/fixtures/harness/stream/opencode-v2.2.5.jsonl`, `tests/structure/harness-stream-contract.test.ts` | `bun test tests/structure/harness-stream-contract.test.ts` | To Implement |
| TC-OCS-010 | `tests/behaviour/harness-opencode-stream.test.ts`, `tests/fixtures/harness/stream.ts` | `bun test tests/behaviour/harness-opencode-stream.test.ts` | To Implement |
| TC-OCS-011 | same | same | To Implement |
| TC-OCS-012 | same | same | To Implement |
| TC-OCS-013 | same | same | To Implement |
| TC-OCS-014 | same | same | To Implement |
| TC-OCS-015 | same | same | To Implement |
| TC-OCS-016 | `tests/behaviour/harness-opencode-stream.test.ts`, `tests/structure/harness-stream-contract.test.ts` | `bun test tests/behaviour/harness-opencode-stream.test.ts tests/structure/harness-stream-contract.test.ts` | To Implement |
| TC-OCS-017 | `tests/behaviour/harness-opencode-stream.test.ts`, `tests/fixtures/harness/scenarios/stream.ts` | `bun test tests/behaviour/harness-opencode-stream.test.ts` | To Implement |
| TC-OCS-020 | `tests/behaviour/harness-opencode-stream.test.ts`, `tests/fixtures/harness/stream.ts` | same | To Implement |
| TC-OCS-021 | same | same | To Implement |
| TC-OCS-022 | same | same | To Implement |
| TC-OCS-023 | `tests/behaviour/harness-stream-hygiene.test.ts` | `bun test tests/behaviour/harness-stream-hygiene.test.ts` | To Implement |
| TC-OCS-030 | `tests/behaviour/harness-opencode-resume-stream.test.ts` | `bun test tests/behaviour/harness-opencode-resume-stream.test.ts` | To Implement |
| TC-OCS-031 | same | same | To Implement |
| TC-OCS-032 | same | same | To Implement |
| TC-OCS-033 | same | same | To Implement |
| TC-OCS-034 | same | same | To Implement |
| TC-OCS-040 | `tests/behaviour/harness-opencode-stream.test.ts` | `bun test tests/behaviour/harness-opencode-stream.test.ts` | To Implement |
| TC-OCS-041 | same | same | To Implement |
| TC-OCS-042 | same; `tests/fixtures/harness/scenarios/stream.ts` | same | To Implement |
| TC-OCS-043 | same | same | To Implement |
| TC-OCS-044 | same | same | To Implement |
| TC-OCS-045 | same; `tests/fixtures/harness/scenarios/stream.ts` | same | To Implement |
| TC-OCS-046 | `tests/behaviour/harness-opencode-stream.test.ts`; `tests/fixtures/harness/scenarios/classification.ts`; `tests/fixtures/harness/scenarios/stream.ts` | `bun test tests/behaviour/harness-opencode-stream.test.ts` | To Implement |
| TC-OCS-047 | `tests/structure/harness-stream-contract.test.ts`; `tests/behaviour/harness-opencode-stream.test.ts`; pinned fixture | `bun test tests/structure/harness-stream-contract.test.ts tests/behaviour/harness-opencode-stream.test.ts` | To Implement |
| TC-OCS-048 | `tests/behaviour/harness-opencode-stream.test.ts`; `tests/structure/harness-stream-contract.test.ts`; pinned fixture | same | To Implement |
| TC-OCS-050 | `tests/behaviour/harness-stream-hygiene.test.ts` | `bun test tests/behaviour/harness-stream-hygiene.test.ts` | To Implement |
| TC-OCS-051 | same | same | To Implement |
| TC-OCS-052 | `tests/behaviour/harness-host-stream.test.ts` | `bun test tests/behaviour/harness-host-stream.test.ts` | To Implement |
| TC-OCS-053 | `tests/behaviour/harness-stream-hygiene.test.ts` | same | To Implement |
| TC-OCS-060 | `tests/structure/dispatch-composition.test.ts` | `bun test tests/structure/dispatch-composition.test.ts` | Existing – Update |
| TC-OCS-061 | `packages/testkit/src/conformance/harness.ts`, `tests/conformance/harness-classification.test.ts` | `bun test tests/conformance/harness-classification.test.ts tests/structure/conformance-coverage.test.ts` | Existing – Update |
| TC-OCS-062 | `tests/fixtures/harness/scenarios/classification.ts` (read-only), `tests/conformance/harness-classification.test.ts`, `tests/behaviour/harness-opencode-session.test.ts` | `bun test tests/conformance/harness-classification.test.ts tests/behaviour/harness-opencode-session.test.ts` | Existing – Update (assertions unchanged) |
| TC-OCS-070 | `tests/types/harness-stream.type-test.ts` | `pnpm typecheck` | To Implement |
| TC-OCS-071 | `tests/behaviour/harness-stream-hygiene.test.ts` | `bun test tests/behaviour/harness-stream-hygiene.test.ts` | To Implement |
| TC-OCS-072 | same; `tests/fixtures/harness/stream.ts` | same | To Implement |
| TC-OCS-080 | `tests/behaviour/harness-claude-session.test.ts` | `bun test tests/behaviour/harness-claude-session.test.ts` | Existing – Update (helper only) |
| TC-OCS-081 | `tests/behaviour/harness-opencode-session.test.ts` | `bun test tests/behaviour/harness-opencode-session.test.ts` | Existing – Update (move spawn/resume; keep TC-HARN-010) |
| TC-OCS-082 | `tests/behaviour/dispatch-harness-acquisition.test.ts`; `tests/fixtures/dispatch/golden/harness.ts` | `bun test tests/behaviour/dispatch-harness-acquisition.test.ts` | To Implement |
| TC-OCS-100 | §6.3 procedure; no test file | Manual: §6.3 steps 0–7a | Manual Only |
| TC-OCS-101 | §6.3 procedure; no test file | Manual: §6.3 steps 0–7a + worktree snapshots + lease proof | Manual Only |

**Migration edits carrying no new TC (owned by plan P1/P2).** These files change only to keep the new required `starter` seam and the newly exported host starter admitted; every delivered assertion stays intact, so no new TC is attached:

| Path | Phase | Migration |
|---|---|---|
| `tests/behaviour/harness-spawn-env.test.ts` | P2 | Construct the port with a fake starter over the same single-document stdout |
| `tests/behaviour/harness-spawn-credential.test.ts` | P2 | Same migration for the credential cases |
| `tests/conformance/harness-liveness.test.ts` | P2 | Same migration at the conformance construction site |
| `tests/structure/harness-neutrality.test.ts` | P2 | Same migration for the neutrality scan |
| `tests/fixtures/queue/production/harness.ts` | P2 | Inject a recording/streaming starter where the queue-binding suite dispatches; omission still compiles but would start a real child (NFR-5). No new TC |
| `packages/core/src/contracts/index.ts` | P1 | Re-export the additive starter/stream types; no new TC |
| `tests/structure/content-inventory.test.ts` | P1 | Add `createHostSpawnStarter` to the exact host executable allowance; an unlisted exported host function fails the "undeclared executable export" check. No new TC |

**Sequencing notes.**

1. Contract types first (TC-OCS-001/002/070 unblock everything).
2. Fixtures second (`stream.ts`, the committed JSONL, the case table) so the behaviour suites are written against the real shape from the first run.
3. Adapter decoding + acquisition, then evidence, then resume; run the narrow suites between steps.
4. Host starter and composition; update `dispatch-composition.test.ts` in the same step that adds the starter fact.
5. Conformance registration last, so the six-scenario floor never goes red for a missing seam.
6. Never move a spawn/resume case out of `harness-opencode-session.test.ts` without landing its replacement in the stream suite in the same commit; a temporary deletion is a coverage hole.

### 7.3 Revert / Mutation Evidence (Executable)

Each anti-recurrence claim has a named mutation that must turn a named test red. The delivery (or reviewer) applies the mutation in a scratch copy, runs the command, records the failure, and reverts with `git checkout -- <file>`. No mutation is committed.

| # | Claim | Concrete mutation | Command | Must go red (assertion) | TC that goes red |
|---|---|---|---|---|---|
| M-1 | JSONL parsing | Replace the per-line scan with `JSON.parse(await stream.completion.stdout)` and use the single object | `bun test tests/behaviour/harness-opencode-stream.test.ts` | "spawn resolves ok:true" fails; error is `harness.spawn.invalid-output` | TC-OCS-010 |
| M-2 | Top-level `sessionID` | Delete the `sessionID` branch from identifier resolution | same | Handle id undefined; `harness.spawn.invalid-output` on the real fixture | TC-OCS-010, TC-OCS-017 |
| M-3 | Non-blocking acquisition | `await stream.completion` before returning the handle (apply to the spawn path; apply separately to the resume path) | `bun test tests/behaviour/harness-opencode-stream.test.ts tests/behaviour/harness-opencode-resume-stream.test.ts` | Spawn path: after `flushUntil(..., 64)` the assertion `spawnSettled === true` fails (it stays false; `acquiredCalls` is 0) rather than hanging. Resume path: `resumeSettled === true` fails the same way in TC-OCS-030, and TC-OCS-032's bounded mismatch gate sees neither settlement nor acquisition. TC-OCS-021 is **not** the M-3 oracle: with no handle it fails in its precondition, not by its `collect` assertion; M-4 owns TC-OCS-021. | TC-OCS-020 (spawn path), TC-OCS-030 and TC-OCS-032 (resume path when mutated there) |
| M-4 | Completion-scoped collect | Return the stored evidence from `spawn`/`collect` without awaiting completion | same | `collectSettled` true before `finish()` | TC-OCS-021 |
| M-5 | No whole-session cap | Set the default `sessionTimeoutMs = 300_000` (or pass the listing timeout to the starter) | `bun test tests/behaviour/harness-stream-hygiene.test.ts` | Recorded `sessionTimeoutMs` is 300000 / `kills` becomes 1 after the virtual advance | TC-OCS-023, TC-OCS-053 |
| M-6 | Completion marker | Set `completionMarker: true` whenever `status === 0` | `bun test tests/behaviour/harness-opencode-stream.test.ts` | Exit-0-without-terminal case reports completion | TC-OCS-041, TC-OCS-045 |
| M-7 | Resume identity | Accept any identifier on resume instead of comparing to the handle id | `bun test tests/behaviour/harness-opencode-resume-stream.test.ts` | Mismatch case resolves `ok:true` | TC-OCS-032 |
| M-8 | Kill on failure | Remove the `kill()` call on the no-identifier and mismatch paths | `bun test tests/behaviour/harness-stream-hygiene.test.ts` | `kills` is 0 on the failing path; live-stream count non-zero | TC-OCS-050, TC-OCS-051 |
| M-9 | Single child-process site | Add `import "node:child_process"` to `packages/adapters/src/harness/opencode.ts` | `bun test tests/structure/harness-imports.test.ts`; `pnpm check:boundaries` | Allowlist equality reports the extra file by name | TC-OCS-003 |
| M-10 | Adapter neutrality | Add a `setTimeout` handle timer inside the adapter | `bun test tests/structure/harness-imports.test.ts` | Timer scan names the file and token | TC-OCS-003 |
| M-11 | Port unchanged | Add a `kill` member to `HarnessSessionPort` | `pnpm typecheck` | The `@ts-expect-error` on the eight-member object becomes unused / the seven-key assertion fails | TC-OCS-002, TC-OCS-070 |
| M-12 | Runner unchanged | Add a required field to `HarnessSpawnRunnerResult` | `pnpm typecheck`; `bun test tests/behaviour/harness-claude-session.test.ts` | Type error in the Claude fixture; suite fails to compile | TC-OCS-002, TC-OCS-080 |
| M-13 | Claude untouched | Make the Claude adapter construct the starter seam (or branch on the new option) | `bun test tests/behaviour/harness-claude-session.test.ts` | Spawn path assertion / seam-absence assertion fails | TC-OCS-080 |
| M-14 | Dispatch unchanged | Add a harness-kind branch or change the spawn-failure `lastMessage` in `dispatch.ts` | `bun test tests/structure/harness-stream-contract.test.ts tests/behaviour/dispatch-harness-acquisition.test.ts` | Seam-symbol/literal scan or the exact `lastMessage` assertion fails | TC-OCS-004, TC-OCS-082 |
| M-15 | Conformance seam | Rebuild the opencode registration over the one-shot runner only | `bun test tests/conformance/harness-classification.test.ts` | The real-shape JSONL variant fails to acquire / classification diverges | TC-OCS-061 |
| M-16 | Composition | Give the Claude harness the starter (or the opencode harness only the runner) | `bun test tests/structure/dispatch-composition.test.ts` | Per-harness seam assertions fail | TC-OCS-060 |
| M-17 | Legacy evidence precedence | Delete the legacy-envelope branch so every line falls through to the JSONL rules | `bun test tests/behaviour/harness-opencode-stream.test.ts tests/conformance/harness-classification.test.ts` | `completed` loses `completionMarker`; `harness-failure` loses `failureReported`; `spawn-refusal` loses `spawnRefused`; `timeout` loses `completionMarker`; six-case tokens diverge | TC-OCS-046, TC-OCS-061, TC-OCS-062 |
| M-18 | Tool-error encoding | Delete the `tool_use`/`part.state.status === "error"` branch (or make `toolFailure` always false) | `bun test tests/behaviour/harness-opencode-stream.test.ts tests/structure/harness-stream-contract.test.ts` | `toolFailure` stays false and the token is `finished`, not `partial`; the negative control flips | TC-OCS-042, TC-OCS-047 |
| M-19 | Stream-error encoding | Delete the `error` event branch (or make `failureReported` depend only on a non-zero exit) | `bun test tests/behaviour/harness-opencode-stream.test.ts tests/structure/harness-stream-contract.test.ts` | Exit-0 `error`-event case reports `failureReported: false` and classifies `premature-end`/`partial`, not `failed` | TC-OCS-048 |

**Non-vacuity note.** TC-OCS-072 is the in-suite control: it mutates the *fixture* (not the product) and proves the happy path fails when the identifier is removed. It runs in CI, so the fixture cannot silently drift into a shape that passes for the wrong reason. TC-OCS-047/TC-OCS-048 are the failure-encoding controls: they prove the pinned lines are load-bearing. M-1..M-19 are delivery-time evidence recorded in §10.

### 7.4 Gate Commands

```bash
bun test tests/behaviour/harness-opencode-stream.test.ts \
         tests/behaviour/harness-opencode-resume-stream.test.ts \
         tests/behaviour/harness-stream-hygiene.test.ts \
         tests/behaviour/harness-host-stream.test.ts
bun test tests/structure/harness-stream-contract.test.ts tests/structure/harness-imports.test.ts
bun test tests/conformance/harness-classification.test.ts tests/structure/conformance-coverage.test.ts
bun test tests/behaviour/harness-claude-session.test.ts tests/behaviour/harness-opencode-session.test.ts
bun test tests/behaviour/dispatch-harness-acquisition.test.ts tests/structure/dispatch-composition.test.ts
pnpm typecheck
pnpm check:boundaries
pnpm check          # aggregate: lint, format, typecheck, tests, boundaries, invariants
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Testing Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| R-T1 | The "real shape" fixture encodes the old imagined shape, so the suite passes the defect. | The fixture is a committed capture with `type`/`timestamp`/`sessionID`/`part`, a provenance header naming `opencode v2.2.5`, and TC-OCS-072 mutates it to prove it is load-bearing. |
| R-T2 | "Handle before completion" is proven with a wall-clock wait, making the suite slow and flaky or hanging on regression. | Virtual clock + gated `completion` + the bounded `flushUntil(predicate, 64)` helper; no test awaits the fake's `acquired` signal. A completion-gated regression fails an assertion in milliseconds (TC-OCS-020/TC-OCS-030). |
| R-T3 | The fake starter is too permissive, so a wrong adapter passes. | The fake models all four members (`lines`, `completion`, `acquired`, `kill`), records options, counts kills and deliveries, and the case table covers every DEC-4 row. |
| R-T4 | The host-starter real-child tests become flaky or leak processes. | Children are Bun scripts that either exit or are killed by the test; every wait is a promise; a PID-file orphan probe; bounded test timeout; temp root removed in `finally`. |
| R-T5 | Updating the delivered suites (opencode session, Claude parity, conformance, dispatch composition) silently weakens them. | The plan names exactly what may change (helper wiring, describe placement, seam deps) and keeps every assertion; a deletion of a case is a coverage hole and review must reject it. |
| R-T6 | Kill semantics are asserted only on the fake, so the real host leaks. | TC-OCS-052 exercises the real child: bound expiry, kill, escalation, and an ESRCH orphan probe. |
| R-T7 | The end-to-end proof starts a nested lifecycle that mutates this worktree or runs for hours. | §6.3: disposable clone, kill scoped to the dispatch's own `pgrep -P` child, ≤180 s bound, worktree `status`/`HEAD` snapshots (TC-OCS-101). |
| R-T8 | The end-to-end proof fails for an unrelated reason (missing auth, unparseable origin, missing queue entry) and is misread as a product regression. | §6.3 preconditions: clean worktree, `opencode --version` 2.2.5, GitHub-parsable origin, `queue add GH-275`. A precondition miss fails the *procedure*, not the change; it is recorded and re-run. |
| R-T9 | The tool-error/failure-fact encoding is guessed, so AC-F4-3/AC-F4-4 is asserted against an invented shape. | Closed: spec §8.4/DEC-5 name the real encodings; TC-OCS-047 pins `tool_use` with `state.status === "error"`, TC-OCS-048 pins the `error` event, and both include a remove-the-line control that flips the outcome. |
| R-T10 | A new contract export breaks the content inventory or exports parity late. | TC-OCS-001/003 run `pnpm check` (which includes exports parity) and the inventory suites; the contract types are type-only, so no new runtime export is expected. |
| R-T11 | The dispatch fixture extension (`harnessPort`) accidentally changes dispatch behaviour under test. | The option defaults to the delivered scripted port; every existing dispatch suite runs unchanged, and TC-OCS-082 asserts the unchanged failure identity. |
| R-T12 | The new acquisition path silently changes a delivered legacy classification or evidence fact. | TC-OCS-046 asserts the source-precedence rule; TC-OCS-062 pins the six delivered cases and `TC-HARN-010`; M-17 proves a dropped legacy branch turns them red. |

### 8.2 Assumptions

- The installed CLI is `opencode v2.2.5` and its `run --format json` stdout is JSONL with a top-level `sessionID` on every event line (spec §12).
- The adapter receives the starter and the listing runner as injected options; the option spellings `handleTimeoutMs`/`sessionTimeoutMs` come from Appendix B and are treated as binding.
- The delivered seven-member session port and four-field runner result are unchanged; the type suite asserts this, so a delivery that reshapes them fails before behaviour.
- `HarnessSpawnStream.lines` is an `AsyncIterable<string>` whose iterator stays open until the host ends the stream; the fake models that.
- The conformance registry can build an opencode port over the starter while preserving the six existing raw shapes (single-document fallback), so the floor stays six; the adapter's legacy-envelope evidence precedence (F-4/DEC-5) is what makes those six shapes truthful.
- The fake starter exposes the bounded `flushUntil(predicate, turns)` helper and `completionSettled`; no test needs to await an adapter-driven signal, so a completion-gated mutant fails by assertion rather than hanging.
- The pinned JSONL fixture set carries the real `tool_use`-error and `error`-event lines in dedicated files; a CLI change that alters either encoding is a deliberate fixture edit, never a silent adapter guess.
- `dispatch` composes its harnesses only through the production composer, so a starter fact in `ProductionCompositionFacts` reaches both the runtime and the composition tests.
- **The end-to-end attempt record's repository key is the real binding.** §6.3 step 2 pins the scratch clone's origin to `https://github.com/juliusz-cwiakalski/agentic-delivery-os.git`, which `normalizeRepositoryKey` (`packages/core/src/domain/queue-graph.ts:76-91`) lowercases and normalizes to `github.com/juliusz-cwiakalski/agentic-delivery-os`. That key is what `queue add` binds, what the lease and the `dispatch.attempt` record carry, and what the tracker and CI truth reads address. A clone left on the local-path origin, or pointed at any other owner, yields a foreign or unresolvable identity: the truth read degrades and the run ends as `dispatch.state-unverified`, so AC-F8-1 cannot pass.
- The end-to-end probe may kill its own child after the handle window; any resulting token is accepted (AC-F8-1).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution path / status |
|----|----------|-----------|-------|--------------------------|
| OQ-T1 | Which stream facts encode a tool failure and a stream/agent failure, so `toolFailure` and `failureReported` are producible from a JSONL stream? | No | `@spec-writer` (closed) | **Resolved in spec v1.2 (§8.4, §14, F-4, F-7, DEC-5).** Tool failure = a `tool_use` event whose `part.state.status === "error"`; stream/agent failure = an `error` event (`{type:"error", timestamp, sessionID, error:{type,message}}`). Pinned locations: `tests/fixtures/harness/stream/opencode-v2.2.5-tool-error.jsonl` carries the `tool_use` error line, `opencode-v2.2.5-stream-error.jsonl` carries the `error` event, and `tests/fixtures/harness/scenarios/stream.ts` exposes the dedicated `tool-error` and `stream-error` cases; TC-OCS-042/TC-OCS-047 assert the tool encoding and TC-OCS-048 asserts the error event, each with a remove-the-line control. |
| OQ-T2 | Does the host starter take a kill-grace option, or is the grace a constant? | No | `@coder` | **Carried forward (spec v1.2 DEC-6 says "a short grace period" without fixing whether it is injected).** If injected, TC-OCS-052 shortens it; if constant, the test waits for close within a bounded window. Either way the escalation assertion stands; no AC depends on the answer. |
| OQ-T3 | Does the listing path keep the delivered 300 s `timeoutMs` option name, or is it renamed? | No | `@plan-writer` | **Carried forward (spec §8.4 leaves session listing unchanged).** Delivery-bound: TC-OCS-053/TC-OCS-081 assert the behaviour (listing uses the one-shot runner with its own timeout) and that the stream options never carry it; no AC depends on the spelling. The delivered `DEFAULT_TIMEOUT_MS = 300_000` (`packages/adapters/src/harness/opencode.ts:76,127,305`) stays reachable for listing only, and TC-OCS-053 step 6 asserts it does not reach the starter options. |
| OQ-T4 | Where do the spawn/resume describes move from `harness-opencode-session.test.ts`? | No | `@coder` | The plan's default: they move to `harness-opencode-stream*.test.ts`; keeping them in place with a starter-injected helper is also acceptable, as long as every delivered assertion (including `TC-HARN-010`) survives. |
| OQ-T5 | Is the end-to-end probe run in the delivery phase or the verification phase? | No | `@pm` | Either, per spec §18 and RSK-1; the evidence lands in §10 and the PR description. |

**Resolved by this revision (v1.2).** OQ-T1 is closed by the spec's real v2.2.5 encodings and is no longer a delivery-time guess; TC-OCS-047/TC-OCS-048 make both encodings falsifiable. OQ-T2/OQ-T3 are explicitly carried forward as non-blocking because spec v1.2 does not need to choose an option spelling or a grace mechanism: the behaviour is asserted and either implementation passes. The end-to-end credential and repository-identity questions resolved in v1.1 remain closed (§6.3 steps 0a/2). OQ-T2..OQ-T5 are the only open items.

**Updated by v1.3.** Spec v1.3 fixes a single `failureReported` rule (explicit failure fact only; a non-zero exit is `exitStatus` alone), so TC-OCS-048 step 5 now asserts `failureReported: false` on a non-zero exit and the §1.1 summary says the same. OQ-T3 is clarified: the delivered listing `DEFAULT_TIMEOUT_MS = 300_000` is retained, and TC-OCS-053 step 6 asserts only that it never reaches the spawn/resume starter options. No open question is added or reopened.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-08 | @test-plan-writer | Initial test plan for GH-275. 42 scenarios cover all 30 ACs (AC-F1-1..AC-F8-2), all nine NFRs, DEC-1..DEC-8, and RSK-1..RSK-9: JSONL decoding and `sessionID` acquisition, non-blocking handle with completion-scoped collect, identity-preserving non-blocking resume/deliver, bounded acquisition with no default whole-session bound and leak-free cleanup, the additive starter seam with the unchanged port/runner, conformance and type pinning, Claude/listing/dispatch regressions, the non-vacuity and hermeticity meta-checks, and a bounded operator-run real-CLI proof. Long sessions are simulated in virtual time; 0 real harness CLI invocations in every automated suite. |
| 1.1 | 2026-11-08 | @test-plan-writer | Corrected the §6.3 end-to-end procedure only; no TC, AC mapping, or other section changed (still 42 TCs, 30/30 ACs). (1) Step 3 now sets the scratch clone's origin to the real repository `https://github.com/juliusz-cwiakalski/agentic-delivery-os.git`; the previous owner made the tracker/CI truth read unresolvable, so the run would have ended as a `dispatch.state-unverified` error envelope instead of a delivered result token and AC-F8-1 could not pass. (2) Added step 0a, a hard authentication precondition: the production GitHub instance resolves the literal `GITHUB_TOKEN` environment variable (`packages/cli/src/production.ts`, `githubInstance()`), so a `gh` keyring login alone is invisible to the dispatch process; the step exports the token, checks `gh auth status`, and probes `gh issue view 275 -R juliusz-cwiakalski/agentic-delivery-os --json number`, with an explicit STOP rule that a missing credential is a blocked precondition, not a product-test failure. (3) Verified the queue grammar in `packages/cli/src/commands/queue.ts`: `queue add <ref>` (one positional ref, no branch argument, optional `--priority`/`--dep`; lines 381-386) and `queue release <ref> --holder <id>` (one ref plus the `--holder` value flag; lines 431-434, flag declared at line 348) are correct as written, so no command changed; the citation is recorded in the procedure. §8.2/§8.3 now confirm that the `dispatch.attempt` record's repository key is `github.com/juliusz-cwiakalski/agentic-delivery-os` (`normalizeRepositoryKey`, `packages/core/src/domain/queue-graph.ts:76-91`). |
| 1.2 | 2026-11-08 | @test-plan-writer | Reopened `test_planning` after DoR iteration 1 (`readiness/readiness-iter-1.md`, verdict NOT_READY); aligned to spec v1.2. **B-1 (legacy envelope parity)**: TC-OCS-061 now names the six delivered scenarios (`completed`, `tool-failure`, `premature-end`, `harness-failure`, `spawn-refusal` status 126, `timeout` → `max-restarts`) and their JSONL counterparts, and asserts the envelope's `completionMarker`/`spawnRefused`/`failureReported`/`toolFailure` facts under F-4 precedence; new TC-OCS-046 tests the precedence rule directly; new TC-OCS-062 pins the six cases plus `TC-HARN-010`; TC-OCS-081 explicitly keeps `TC-HARN-010`. **B-2 (failure encodings)**: new TC-OCS-047 pins `tool_use` with `part.state.status === "error"` and new TC-OCS-048 pins the `error` event, each with a remove-the-line control; TC-OCS-042 now reads the real encoding; OQ-T1 closed in §8.3 and GAP-T2 removed. **B-3 (deterministic acquisition)**: TC-OCS-020/021/030/031/032 no longer await the fake's `acquired` signal; they use `flushUntil(() => spawnSettled \|\| fake.acquiredCalls > 0, 64)` and assert `spawnSettled`/`acquiredCalls`/`completionSettled`; §7.3 M-3 now names TC-OCS-020 (spawn) and TC-OCS-030 (resume) and states that a completion-gated mutant fails by assertion, not by hang (TC-OCS-021 is M-4's oracle). **A-2**: TC-OCS-071 scopes the command-literal scan to the adapter suites and explicitly excludes `harness-host-stream.test.ts` because TC-OCS-052 legitimately uses `process.execPath`. **A-4**: §6.3 adds step 1b (clone-local `.delivery-os/config.yaml` with `lane.liveness-interval: 3000`; no env/flag mapping exists) and step 1c (bounded first-event probe); a `liveness:` attempt-ref is required for PASS, and a first event beyond the 60 s bound is a blocked precondition (CLI/provider slowness), not a product failure. Also set `version_impact: minor` per spec v1.1/DEC-8. Final count: **46 TCs**; AC coverage remains **30/30**. |
| 1.3 | 2026-11-09 | @test-plan-writer | Reopened `test_planning` after DoR iteration 2 (`readiness/readiness-iter-2.md`, verdict NOT_READY); aligned to spec v1.3. **B-1 (`failureReported`)**: the plan now states one explicit-fact rule — true only from a JSONL `error` event or a legacy `result.failure`/`result.status` fact; a non-zero exit is carried by `exitStatus` and classifies `failed` through `packages/core/src/domain/harness-classify.ts:50-52`. TC-OCS-048 step 5 asserts `failureReported: false` with a non-zero `exitStatus` (replacing the old `failureReported: true` from the exit mapping); TC-OCS-045 step 4 keeps "never inferred from the exit status alone"; the §1.1 summary, GAP-T2, §3.1 AC-F4-4 and §3.4 say the same. **B-2 (source-accurate assertions)**: TC-OCS-004 step 4 no longer asserts "exactly once" for `dispatch.session.spawn-failed` (delivered three times at `dispatch.ts:210,471,474`) and asserts the message once (`:482`) plus the single producing branch (behavioural proof in TC-OCS-082 step 3); TC-OCS-053 step 6 asserts no `300_000`/`DEFAULT_TIMEOUT_MS` reaches the spawn/resume starter options while listing keeps its delivered 300 s default (`opencode.ts:76,127,305`); TC-OCS-082 steps 3/5 and TC-OCS-100 step 3 read `data.error.code`/`data.lastMessage` from the envelope and assert the attempt's `attemptId`/`token`/`outcome`/`evidenceRefs` (`attempt:<attemptId>` + `liveness:<verdict>`, `dispatch.ts:684`), with the spawn→collect handle proven through the injected fake starter (no `sessionId` in `DispatchAttemptRecord`, `contracts/dispatch.ts:189-210`). **A-1 (lease proof)**: §6.3 step 7 now extracts `attemptId` and adds step 7a — `queue list --json` must show no active `GH-275`/`dispatch` lease on `github.com/juliusz-cwiakalski/agentic-delivery-os`, with `queue release GH-275 --holder dispatch --json` on failure — and the lease check is part of the PASS rule. **A-2 (migration files)**: §7.1/§7.2 list `packages/core/src/contracts/index.ts` (P1) and the four P2 migration suites (`harness-spawn-env`, `harness-spawn-credential`, `harness-liveness`, `harness-neutrality`), carrying no new TC. **A-3 (observability/mutation honesty)**: TC-OCS-061 step 1 asserts a multi-line `spawnStdout` acquisition (no "never over the one-shot runner" claim, since `HarnessConformanceRegistration.build` exposes no seam); TC-OCS-062 step 5 restates M-17's red/green set — step 1 green, step 2 red, step 3 green, step 4's distinctness assertion red. **A-4 (liveness ref)**: TC-OCS-100/TC-OCS-101 and §6.3 treat the `liveness:` ref as corroborating only (the production adapter receives no `livenessFacts`), with the deterministic suite (TC-OCS-020/021/082) as the discriminator. **A-6 (titles)**: TC-OCS-014 → "with the starter's `timedOut` fact"; TC-OCS-042 → outcome `completed`, token `partial` (delivered `HARNESS_OUTCOMES`). §2 now cites TDR-0016 and §8.3 records the v1.3 delta. Final count: **46 TCs**; AC coverage remains **30/30**. |
| 1.4 | 2026-11-09 | @test-plan-writer | Reopened `test_planning` after DoR iteration 3 (`readiness/readiness-iter-3.md`, verdict NOT_READY); **N-4 only**, no requirement, TC, or AC change. §7.1 now inventories the two plan-owned required edits it omitted: `tests/fixtures/queue/production/harness.ts` under the fixture edits (plan P2 — the fixture must inject a recording/streaming starter under the required `starter` seam because its queue-binding suite dispatches, and omission compiles but starts a real child, breaking NFR-5) and `tests/structure/content-inventory.test.ts` under the structure checks (plan P1 — the exact host executable allowance `["createHostSpawnRunner"]` at `tests/structure/content-inventory.test.ts:682` must admit `createHostSpawnStarter`, or the new exported host function fails the "undeclared executable export" check). §7.2's migration mapping carries both as migration/allowance edits with their phases (P2 and P1) and no new TC, and its intro now covers the allowance as well as the seam; §7.1/§7.2 and the plan now agree on the required file set. Counts re-confirmed unchanged: **46 TCs**, AC coverage **30/30**. |

## 10. Test Execution Log

Execution window: pending (delivery phase). Runtime: Bun 1.4.4 (repo pin), pnpm 10.18.3. Branch: `fix/GH-275/opencode-harness-contract`. The delivery fills in result and notes per row, and appends the §7.3 mutation evidence and the §6.3 end-to-end output below the table.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-OCS-001 | — | Pending | |
| TC-OCS-002 | — | Pending | |
| TC-OCS-003 | — | Pending | |
| TC-OCS-004 | — | Pending | |
| TC-OCS-005 | — | Pending | |
| TC-OCS-010 | — | Pending | |
| TC-OCS-011 | — | Pending | |
| TC-OCS-012 | — | Pending | |
| TC-OCS-013 | — | Pending | |
| TC-OCS-014 | — | Pending | |
| TC-OCS-015 | — | Pending | |
| TC-OCS-016 | — | Pending | |
| TC-OCS-017 | — | Pending | |
| TC-OCS-020 | — | Pending | |
| TC-OCS-021 | — | Pending | |
| TC-OCS-022 | — | Pending | |
| TC-OCS-023 | — | Pending | |
| TC-OCS-030 | — | Pending | |
| TC-OCS-031 | — | Pending | |
| TC-OCS-032 | — | Pending | |
| TC-OCS-033 | — | Pending | |
| TC-OCS-034 | — | Pending | |
| TC-OCS-040 | — | Pending | |
| TC-OCS-041 | — | Pending | |
| TC-OCS-042 | — | Pending | |
| TC-OCS-043 | — | Pending | |
| TC-OCS-044 | — | Pending | |
| TC-OCS-045 | — | Pending | |
| TC-OCS-046 | — | Pending | |
| TC-OCS-047 | — | Pending | |
| TC-OCS-048 | — | Pending | |
| TC-OCS-050 | — | Pending | |
| TC-OCS-051 | — | Pending | |
| TC-OCS-052 | — | Pending | |
| TC-OCS-053 | — | Pending | |
| TC-OCS-060 | — | Pending | |
| TC-OCS-061 | — | Pending | |
| TC-OCS-062 | — | Pending | |
| TC-OCS-070 | — | Pending | |
| TC-OCS-071 | — | Pending | |
| TC-OCS-072 | — | Pending | |
| TC-OCS-080 | — | Pending | |
| TC-OCS-081 | — | Pending | |
| TC-OCS-082 | — | Pending | |
| TC-OCS-100 | — | Pending | Operator-run; record token, exit code, elapsed time, `lastMessage` |
| TC-OCS-101 | — | Pending | Operator-run; record worktree `status`/`HEAD` before and after |

**Mutation evidence (M-1..M-19).** Pending: record mutation, command, observed failure, and the TC that went red. M-3's expected red is TC-OCS-020 on the spawn path (assertion, not hang) and TC-OCS-030/TC-OCS-032 when the resume path is mutated; TC-OCS-021 is M-4's oracle.

**End-to-end evidence.** Pending: paste the §6.3 envelope fields (`result`, `lastMessage`, `error.code`, exit code, elapsed seconds), the attempt record's `evidenceRefs`, and the before/after worktree snapshots.
