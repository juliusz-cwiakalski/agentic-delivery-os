# Code Review — GH-241 "M1-S23: Coordinator supervision"

- **Review mode:** local (ADOS pipeline), first review
- **Work item:** GH-241
- **Branch:** `feat/GH-241/coordinator-supervision` @ `9c4d1521`
- **Base:** `origin/main-tools` @ `dbbc62cf` (28 commits ahead, linear)
- **Change folder:** `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/`
- **Artifacts reviewed:** `chg-GH-241-spec.md` v1.5, `chg-GH-241-test-plan.md` v1.5, `chg-GH-241-plan.yaml` (canonical), `chg-GH-241-pm-notes.yaml`, `readiness-review/readiness-iter-5.md`, `doc/decisions/TDR-0017-*.md`, `doc/decisions/TDR-0018-*.md`, and the 171 changed files (implementation, tests, fixtures, docs).
- **Review date:** 2026-11-09
- **Reviewed by:** reviewer agent (local mode)

## Status: **FAIL**

The change is large, disciplined, and mostly high quality: the coordinator domain is pure, the state boundary is strongly validated, the claim is a single fenced critical section, the kill helper verifies PID plus start time before signalling, the reserved escalation slot is payload-only, and the error-table arithmetic (allowlist 36→38, identities 115→121) is exact with both gate files agreeing. All 302 coordinator tests and the broader delivered suites pass.

It cannot pass, however, because the pinned contract is not met end-to-end:

1. **The command family is unreachable in the shipped product.** No entrypoint composes `CoordinatorComposition`; `production.ts` does not register `coordinator`, and a real invocation returns `fallback.invocation`/“unexpected argument”.
2. **`--fresh-budget` is not durable.** The new epoch is derived only from the latest restart/exhaustion; a start whose lifecycle decision consumes no ordinal leaves no epoch marker, so a later `status`/`tick` reverts to the old exhausted epoch and can refuse the very recovery the owner requested.
3. **`start --foreground` reports a released instance** and prints `coordinator started … instance=none`, so AC-F1-1’s “reports state=running” and Appendix G’s start receipt are not satisfied.
4. **A `tick` never reports `no-pickup`**; `data.wake` falls back to the last durable wake, so after an answered question a tick still shows a stale `woken`.
5. **AC-F2-1 is not met for collection-cycle evaluation**: `join-live` is recorded only on `start`, never on a `tick`/loop cycle (the test asserts zero iteration records).
6. **The production process port cannot perform the identity check**: `createNodeProcessPort` does not implement `startTimeMs`, so identity-verified kill-with-grace always returns `capability-gap` outside tests.

Findings count: **21** (0 critical / 8 major / 12 minor / 1 nit). AC matrix: 39 PASS, 8 PARTIAL, 3 FAIL.

---

## Findings

Severity: `critical` (data loss / security / correctness bug) · `major` (blocks the pinned contract or the delivered surface) · `minor` (quality / robustness / traceability) · `nit` (style).

| ID | Severity | Location | Issue | Required fix |
|---|---|---|---|---|
| F-01 | major | `packages/cli/src/production.ts:1059-1112`; `packages/cli/src/edge.ts:3564-3571`; `packages/cli/src/help/prompt-required-commands.ts:13-29` | The coordinator family is never composed by a shipped entrypoint. `createConfigProgram` registers it only when `options.coordinator` is supplied, and `production.ts` never supplies it; `PROMPT_REQUIRED_COMMANDS` excludes it; there is no coordinator main. A real invocation (`bun packages/cli/bin/delivery-os.ts coordinator status`) fails `fallback.invocation`. All F-1/F-9/F-10 behaviour is only reachable from the test harness. | Compose the family in `production.ts` (store, clock, id/fence factories, resolved `CoordinatorSettings`, process port, harness session facts/effects, cycle driver), or amend the spec to declare the command out of the delivered surface. If it stays uncomposed, the ACs must not claim a runnable command. |
| F-02 | major | `packages/cli/src/commands/coordinator-loop.ts:198-216`, `:1242-1244`, `:1119` | The budget epoch is never persisted. `currentBudgetEpoch` derives it from the latest restart or exhaustion; `freshBudgetEpoch` is used only inside the `--fresh-budget` invocation. Because no record kind carries the epoch, a start whose decision consumes no ordinal (`join-live`, `initial-start`, `clean-iteration-end`) writes nothing for the new epoch: the next `status` reports the old exhausted epoch and a later `tick` that needs a recovery is refused `restart-budget-exhausted`. Reproduced with the harness: after `start --foreground --fresh-budget` (live session) `status` reports `epoch-1` `10/10` instead of `epoch-2` `0/10`. | Persist the epoch identity (e.g., carry `budgetEpochId` on the acquisition/start iteration or add a durable epoch marker), and make `currentBudgetEpoch` read it; add a test that a fresh budget survives a later `status`/`tick`/`start`. |
| F-03 | major | `packages/cli/src/commands/coordinator-loop.ts:1288`; `packages/cli/src/output/coordinator-text.ts:17-18`, `:71-76` | `start --foreground` builds its final observation after the loop has appended `released`, so `data.instance` is `null`; the human receipt is selected by the `supervisor-loop-stopped` marker and prints `coordinator started … instance=none pid=-`. AC-F1-1 (“reports state=running, and `status` reports that instance”) and Appendix G’s representative start line are not satisfied, and a stop/signal exit is reported as “started”. Reproduced: `coordinator started  scope=state-dir  instance=none  pid=-  …`. | Capture and report the acquisition instance (stream a real start receipt before the loop, and/or build `data.instance` from the acquisition record), and render `stopped`/`released` for the terminal result rather than “started”. Update `coordinator-start.test.ts`, which currently codifies `instance === null`. |
| F-04 | major | `packages/cli/src/commands/coordinator-loop.ts:790-798`, `:1164-1174` | A `no-pickup` cycle leaves `wakeOutcome` null, and `observation` then falls back to the last durable wake. A tick therefore never reports `no-pickup`; after a question is answered, a later tick still reports the previous `woken` outcome. AC-F7-3 (“the outcome is `no-pickup`”) is not met, and the tick data can mislead an operator. Reproduced: second tick after an answer returned `outcome: "woken"` for the answered question. | Report the current cycle’s wake result (`no-pickup` with a null question) in the tick data; reserve the “last wake” fallback for `status` only. Add a test for no-pickup after a prior wake. |
| F-05 | major | `packages/cli/src/commands/coordinator-loop.ts:588-601`, `:760` | A collection-cycle `join-live` is deliberately quiet (`recordDecision = trigger === "start"`). AC-F2-1 requires the live-session evaluation to record `join-live`; the `coordinator-tick` test asserts `read.iterations` is empty, and TC-COORD-020 only appends the record manually. The current-truth doc §3 narrows the spec instead of the implementation changing. | Either record `join-live` on every evaluation without making it the active expectation (e.g., mark the record so the expectation fold excludes collection joins), or amend AC-F2-1/F-2 explicitly and update the test plan proof. Do not leave the AC silently reshaped. |
| F-06 | major | `packages/adapters/src/daemon/process.ts:21-52`, `:92-98` | The additive `startTimeMs` identity capability is declared in the contract and consumed by `killCoordinatorProcess`, but the only production `DaemonProcessPort` factory (`createNodeProcessPort`) never implements it. In production every kill therefore returns `capability-gap` before TERM, so identity-verified kill-with-grace cannot run. Plan phase 5 claims “additive SIGKILL/startTimeMs” in the adapters. | Implement `startTimeMs(pid)` in the node adapter (e.g., platform-specific process start time) or declare and test the production gap explicitly; wire the capability through the composition. |
| F-07 | major | `packages/cli/src/commands/coordinator-loop.ts:677-687`, `706`; `tests/behaviour/coordinator-escalation-publish.test.ts:31-51` | The owner escalation question does not carry the durable history reference. AC-F6-1/F-6 require the question to carry “the restart count and bound, the durable history reference, and the declared options”; only the `coordinator.exhaustion` receipt carries `historyRef`, and TC-COORD-060’s “history reference” assertion checks the receipt, not the question. | Include the history reference in the bounded question text/payload (or amend AC-F6-1/F-6 and EVT-6 consistently) and assert it on the published question. |
| F-08 | major | `packages/cli/src/commands/coordinator-loop.ts:799-809` | The wake path calls one opaque `ports.session.wake()`; it does not select or perform the F-2 resume/spawn when the coordinator session is not live. F-7/AC-F7-1 require “a live wake, a resume, or a spawn per F-2”, and the `wake` port is not part of any production composition. | Choose the wake effect from the lifecycle decision (live attach, resume, or spawn) and expose it as an explicit port contract; or amend F-7/AC-F7-1 and document the single-effect seam as current truth with a test. |
| F-09 | minor | `packages/cli/src/commands/coordinator-loop.ts:540`, `:613-619`; `tests/behaviour/coordinator-restart-exhausted.test.ts:21-39` | The `coordinator.restart-budget-exhausted` result carries no history reference; the reference exists only on the side-effect receipt. AC-F5-3 says the command “returns … at exit 1 with the history reference”. The test name claims the reference but asserts the receipt. | Put the history reference into the failure summary (or return data alongside the failure if the envelope allows) and assert it on the returned error. |
| F-10 | minor | `packages/cli/src/commands/coordinator-loop.ts:1305-1311` | `status --live` adds no positive live process facts; when the probe answers, `--live` is a no-op, and when it does not answer it only appends `live-facts-unknown`. F-9 says “`--live` reports live process facts”; AC-F9-1’s “declares unknown/degraded” is met but the positive branch is not. | Add a bounded live-facts field (e.g., alive/start-time/lease verification) or amend F-9/AC-F9-1 to state that `--live` is a degradation probe only. |
| F-11 | minor | `packages/core/src/contracts/coordinator.ts:86-97`; `chg-GH-241-spec.md` Appendix B / EVT-1 | `COORDINATOR_ITERATION_REASONS` adds `expectation` and `live-session` to the closed reason vocabulary. Appendix B’s lifecycle reasons list only the five spawn/resume reasons; EVT-1 says `reason` is closed. The addition is a reasonable gap-fill but is a silent extension of a pinned set. | Amend Appendix B/EVT-1 to list the iteration reason set (including `none`-decision markers), or express the expectation marker through the existing `decision: "none"` plus a dedicated field. |
| F-12 | minor | `packages/cli/src/commands/coordinator-loop.ts:655-699` | After the owner answers the escalation, a later exhausted tick sees no open reserved question (`existing` excludes answered) while the terminal receipt exists, and publishes a second question. Reproduced: questions after first tick + answer + second tick = 2 (`q-q-0001`, `q-q-0002`), while status still points at the receipt’s question id. | Treat an existing terminal receipt as “already escalated” and do not publish a second question; or include the answered question as the reused escalation. Add a test for answer-then-tick. |
| F-13 | minor | `packages/cli/src/commands/coordinator-loop.ts:1314-1359` | `stop` reads the lease and probes liveness, then appends `stop-requested` without holding the state write fence across read→append. A takeover between the probe and the append can leave a `stop-requested` naming the old holder that the new holder honors (the cycle checks only `lease.action === "stop-requested"`). | Re-verify under the fence, or have the holder honor a `stop-requested` only when its `instanceId` matches the holder’s own instance. Add a race test. |
| F-14 | minor | `packages/cli/src/commands/coordinator-loop.ts:554-559` | If a restart record lands but the recovery effect does not (crash between append and effect), the next evaluation computes the next ordinal and appends a new restart, consuming a second ordinal for one logical recovery. | Make the effect idempotent under the restart identity (e.g., re-apply the recorded effect for the latest ordinal before admitting a new one), or document and test the crash window. |
| F-15 | minor | `packages/cli/src/commands/coordinator-loop.ts:548`, `551` | The produced restart record sets `sessionId` and `previousSessionId` to the same value (the current session id), so the schema’s distinction is never meaningful. | Set `sessionId` to the new/recovering session and `previousSessionId` to the replaced one, or amend EVT-2 semantics and assert it. |
| F-16 | minor | `packages/core/src/domain/status.ts:1665-1690` | The status `typed-questions` cap now uses `COORDINATOR_RENDERED_QUESTION_BOUND` instead of `STATUS_MAX_ITEMS_PER_SECTION`; the two are both 8 today, but the status contract’s cap is now governed by the coordinator contract. | Keep the status cap in the status contract (pass the bound as an argument) so the two contracts cannot drift. |
| F-17 | minor | `packages/cli/src/commands/coordinator-loop.ts:857-882`, `:897-899` | The active expectation and its ledger sequence are looked up by `recordedAt`, which is not unique (same-millisecond appends), and the expectation’s `digestFingerprint` is computed from the pre-append record count, so the cursor is stale by the cycle’s own appends. This only weakens evidence quality (not the newTurn gate), but it makes the evidence non-deterministic under same-ms appends. | Carry the expectation’s `iterationId`/sequence directly on the cycle context; compute the fingerprint with the post-append cursor. |
| F-18 | minor | `chg-GH-241-plan.yaml` (all phases) | Plan scope fidelity: 13 changed paths are outside every declared phase scope: `doc/decisions/00-index.md`, `doc/overview/architecture-overview.md`, `doc/overview/glossary.md`, `doc/quality/test-specs/test-spec-state-layer.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/spec/features/feature-config-layer.md`, `doc/spec/features/feature-state-layer.md`, `packages/core/src/index.ts`, `scripts/checks/forbidden-literals.registry.json`, `tests/behaviour/config-schema.test.ts`, `tests/fixtures/result/unknown-consequence-allowlist.json`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/state-scope.test.ts`. Phase 5 also declares no file under `tests/boundaries` although it declares that folder. Eight declared files were not changed (`config/resolver.ts`, `config/schema.ts`, `contracts/brief.ts`, `domain/brief.ts`, `cli/src/index.ts`, `secret-read-boundary.test.ts`, `fixtures/state/harness.ts`, `port-contract-inventory.test.ts`). | Extend the phase scopes for the doc-sync/barrel/supporting-test files (or record them as an explicit doc-sync phase), and drop the unused declarations. `plan validate` is otherwise valid. |
| F-19 | minor | `tests/behaviour/coordinator-escalation-failed.test.ts:44-52`; `coordinator-wake-failed.test.ts:40-56`; `coordinator-fence-records.test.ts:99-113`; `coordinator-start.test.ts:22-26` | Test proofs are weaker than the pinned behaviour: TC-062 only asserts `fenceStatus > 0` and never exercises a stale fence; TC-074 retries on a **new** harness root rather than the same durable state; TC-017’s “busy non-claim append” actually exercises the claim path; TC-020 appends the join-live record manually instead of driving a tick; no test covers fresh-budget durability or no-pickup after a prior wake; `coordinator-start` asserts the null-instance behaviour. | Strengthen the tests to the pinned contract (stale fence, same-state retry, append-level busy mapping, integrated join-live, fresh-budget durability, no-pickup after wake, non-null start instance). |
| F-20 | nit | `coordinator-loop.ts:843-844`, `:1068-1069`, `:1365`; `process.ts:57-65` | Two `ports.session.read()` calls in a row; `COORDINATOR_RESTART_NAMESPACE = "coordinator/"` duplicates the contract’s `COORDINATOR_RESTART_KEY_PREFIX` instead of importing it; the claim path re-implements the fence record shape rather than using the shared `appendFence` helper; `coordinatorKeyFor` has no `assertNever` default (per `.ai/rules/typescript.md`); the escalation question id is double-prefixed (`q-q-0001`). `biome check` also reports 4 `organizeImports` assists (not `pnpm lint`/`format:check` failures). | Read once per cycle, import the contract prefix, reuse the fence constructor, add the default, fix the id prefix, and run `biome check --write` (or equivalent) on the four files. |
| F-21 | minor | `packages/cli/src/commands/coordinator-loop.ts:760-764`, `:839-847`, `:1064-1071`; `doc/spec/features/feature-coordinator-supervision.md` §4 | F-3 says an expectation is created on “an actionable digest change while the coordinator is live”. The cycle never creates an expectation for a digest change: the only `expectation`-reason iterations are appended after a wake and after a stuck restart. The current-truth doc §4 was narrowed to “An expectation is the latest recorded iteration”, which silently drops the digest-change trigger. | Implement the digest-change expectation (record an iteration with `decision: none` when the fingerprint advances while live), or amend F-3/Appendix C and the current-truth doc with the rationale; add a test. |

---

## AC satisfaction matrix

Status key: **PASS** = observable satisfied and tested; **PARTIAL** = main observable satisfied but a pinned clause is unmet; **FAIL** = pinned observable not met; **NA** = not applicable (none).

### 17.1 Supervision process and command family

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F1-1 | **PARTIAL** | Claim, one `acquired`, second-start refusal (holder named in summary), bare-start `fallback.invocation`, and two-state-dir independence are tested (`coordinator-start.test.ts`). But no shipped entrypoint registers the family (F-01), and `start` reports a released instance / prints `instance=none` (F-03), so “reports state=running” is unmet. |
| AC-F1-2 | **PASS** | Claim-acquire rule, one lease pair, `released` on the failure/throw path, one verified read, non-null `tickVerdict`, no loop (`coordinator-tick.test.ts`, `coordinator-claim-*`). |
| AC-F1-3 | **PASS** | `stop` appends `stop-requested` (`requested=true`, `released=false`), `not-running` for released/dead/aged-unknown, capability gap for undeclared alive, never releases another handle (`coordinator-stop.test.ts`, `coordinator-lease-liveness.test.ts`). Minor stop read/append race F-13. |
| AC-F1-4 | **PASS** | Instance folded from the latest lease by ledger order, `startedAt` = acquisition time, no instance record kind (`coordinator-instance-lease.test.ts`). |
| AC-F1-5 | **PASS** | One acquisition + one release across N boundaries, stop/signal/fatal exits, release-failure identity (`coordinator-foreground-loop.test.ts`); the `state.lock.busy` release branch is untested (F-19). |
| AC-F9-1 | **PARTIAL** | `status` reports instance/session/decision/restarts/stuck/`tickVerdict=null`/wake/escalation/fence and never mutates/evaluates (`coordinator-status.test.ts`). `--live` only adds a degradation token and no positive live facts (F-10). |

### 17.2 Join-or-resume-or-spawn decision

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F2-1 | **FAIL** | `join-live` is recorded on `start` only; a `tick`/loop evaluation is quiet (`applyLifecycle:588-601`, `:760`), and the tick test asserts zero iterations. AC-F2-1 requires the evaluation to record it (F-05). |
| AC-F2-2 | **PASS** | `resume-context` for unclean/resumable/below-limit/declared resume, one ordinal, resume effect (`coordinator-decision-resume.test.ts`, `coordinator-decision-recovery.test.ts`). |
| AC-F2-3 | **PASS** | `spawn-fresh` with `context-pressure`/`context-unknown`/`session-interrupted`, one ordinal, no resume error (`coordinator-decision-spawn.test.ts`, `coordinator-capability-gap.test.ts`). |
| AC-F2-4 | **PASS** | Killed mid-iteration resumes/respawns without re-executing merge/answer/closed-out artifacts (`coordinator-decision-recovery.test.ts`). |
| AC-F2-5 | **PASS** | Decision and ordinal survive a reopened store and a later `status` (`coordinator-decision-durability.test.ts`). |
| AC-F2-6 | **PASS** | `initial-start`/`clean-iteration-end` consume zero (`coordinator-decision-spawn.test.ts`). |

### 17.3 Artifact-evidence stuck detection

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F3-1 | **PASS** | `stuck` verdict with `stuck-artifact-evidence`, `phase=verdict`, `killOutcome=not-attempted`, bounded evidence; fingerprint = record count + open coordinator questions (`coordinator-stuck-verdict/-matrix/-fingerprint`). Note: the F-3 “actionable digest change” expectation trigger is not implemented (F-21). |
| AC-F3-2 | **PASS** | Positive sourced progress inside `progress-bound` vetoes; past it does not (`coordinator-stuck-corroborator.test.ts`). |
| AC-F3-3 | **PASS** | Unknown/absent signals are `unknown`, never zero; all-unknown/unreadable → `unevaluable`, one verdict, no kill, exit 2 state identity (`coordinator-stuck-unknown/-unevaluable`). |
| AC-F3-4 | **PASS** | Two evaluations byte-identical; no CPU read (`coordinator-stuck-*`, `coordinator-no-cpu.test.ts`). |

### 17.4 Kill with grace

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F4-1 | **PARTIAL** | The helper verifies PID + start time, TERM, grace, conditional SIGKILL, `terminated`/`forced`, two-phase record (`coordinator-kill-grace/-kill-identity`). In production the only port lacks `startTimeMs`, so the verification cannot run (F-06). |
| AC-F4-2 | **PASS** | Failed kill → `phase=outcome` `failed`, `coordinator.session.kill-failed` exit 2, no retry loop (`coordinator-kill-failed.test.ts`). |
| AC-F4-3 | **PASS** | Target is the recorded pid; no name/pattern/shell (`coordinator-kill-target.test.ts`, structure marker scan). |
| AC-F4-4 | **PASS** | Mismatch sends no signal, `killFailureReason=identity-mismatch`, exit 2 (`coordinator-kill-identity.test.ts`). |

### 17.5 Restart budget

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F5-1 | **PASS** | Records under `coordinator/<coordinatorId>`, not lane/economics (`coordinator-restart-namespace.test.ts`). |
| AC-F5-2 | **PASS** | Below bound appends the next contiguous ordinal and proceeds (`coordinator-restart-admit.test.ts`). |
| AC-F5-3 | **PARTIAL** | At/above bound starts no replacement, exit 1, escalation runs; but the history reference is only on the receipt, not on the returned error (F-09). |
| AC-F5-4 | **PASS** | Reopened store keeps count/bound; replay appends nothing; duplicate ordinal → torn (`coordinator-restart-durability.test.ts`). |
| AC-F5-5 | **FAIL** | `--fresh-budget` opens a new epoch only for that invocation; the epoch is not persisted, so `status`/`tick` revert to the old exhausted epoch when no restart lands (F-02). |

### 17.6 Exhaustion escalation

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F6-1 | **PARTIAL** | Exactly one owner `decision-needed` question, `ref=<id>#<epoch>`, count/bound/options, reserved first-by-index in digest and (via the digest mirror) brief, up to seven others, lowest displaced and counted omitted (`coordinator-escalation-*`, `coordinator-escalation-slot`). The question omits the durable history reference (F-07). |
| AC-F6-2 | **PASS** | Publish failure → exit 2 `coordinator.escalation.publish-failed`, no receipt, status `exhausted-escalation-failed`; the stale-fence recovery path is only weakly tested (F-19). |
| AC-F6-3 | **PASS** | Repeated exhausted tick reuses the open question, no second receipt, exit 0 `exhausted-escalated` (`coordinator-escalation-idempotent`). Answered-then-tick duplicate question edge (F-12). |

### 17.7 Wake-on-typed-question

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F7-1 | **PARTIAL** | Strict pickup wakes within one cycle and appends one `woken` record. The wake effect is a single opaque call and does not choose resume/spawn per F-2 (F-08). |
| AC-F7-2 | **PASS** | Still-top already-woken appends nothing; dedupe key = coordinator + question + `askedAt` (`coordinator-wake-dedupe.test.ts`). |
| AC-F7-3 | **FAIL** | No wake / owner head / non-open / no question append nothing, but the tick reports `data.wake = null` or the **last durable wake**, not `no-pickup`; after an answer a tick still shows `woken` (F-04). |
| AC-F7-4 | **PARTIAL** | `answered-before-wake` exists only in the pure evaluator; in the integrated cycle the ranking excludes answered questions and uses the same snapshot, so the outcome is unreachable (F-19). |
| AC-F7-5 | **PASS** | Delivery failure → `coordinator.wake.delivery-failed` exit 2, no record, released lease (`coordinator-wake-failed`); retry-then-success on the same state is not proven (F-19). |
| AC-F7-6 | **PASS** | A new question replacing the answered head wakes normally (`coordinator-wake-next.test.ts`). |

### 17.8 Supervisor regime and single-instance lease

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F8-1 | **PASS** | Live holder refused regardless of age; declared-but-unanswered probe held until 2×interval; undeclared alive → capability gap; separate state dirs (`coordinator-lease-liveness`, `-claim-capability-gap`). |
| AC-F8-2 | **PASS** | Regime descriptor (state-dir, lease, unit identity, process kind, budget store, foreground, absent, M1-S18), bare start `fallback.invocation`, no installer (`coordinator-regime.test.ts`). |
| AC-F8-3 | **PASS** | Dead holder / aged-unknown → one `stale-takeover`, no second `acquired`, previous holder + fence age; live holder never taken over (`coordinator-lease-liveness`, `-fence-records`). |
| AC-F8-4 | **PASS** | Live old holder refused; `stop` appends `stop-requested`, requested/released; next boundary releases (`coordinator-lease-liveness`, `coordinator-foreground-loop`). |
| AC-F8-5 | **PASS** | Both non-blocking interleavings (contention, serialization) yield exactly one acquisition and one `already-running` (`coordinator-claim-race`, `-claim-serialized`). |
| AC-F8-6 | **PASS** | `tick` takes over a crashed holder, runs one cycle, releases (`coordinator-tick-takeover.test.ts`). |
| AC-F8-7 | **PASS** | Stale fence → one `recoverFence` + one retry for claim and non-claim append; non-stale still-busy → `already-running`/`state.lock.busy` (`coordinator-claim-stale-fence`, `coordinator-state-fence-recovery`). |

### 17.9 Configuration, state, and error contracts

| AC | Status | Evidence / gap |
|---|---|---|
| AC-F10-1 | **PARTIAL** | Six keys/defaults/domains are validated by `resolveCoordinatorSettings` (`coordinator-config`, `-budget-config`). The function is called only by tests; because the family is not composed, the shipped CLI never resolves/validates the branch beyond the generic “number” schema (F-01). |
| AC-F10-2 | **PASS** | `coordinator` domain kind, six rows with category/retryability/consequence/remediation and `{0,1,2}` projection; allowlist 36→38; identities 115→121; both gate files agree (`error-table.test`, `error-table-sync`). Verified: 121 code rows, 38 allowlist entries, 36 two-segment codes. |
| AC-F10-3 | **PASS** | Torn/unknown coordinator records → state identity exit 2; gapped ordinals unevaluable; claim busy → `already-running` with no append; non-claim busy → `state.lock.busy`; failed append → `state.write.failed` (`coordinator-records`, `-ordinals`, `-state-fence-recovery`, `-fence-records`). |
| AC-F10-4 | **PASS** | Missing alive/kill/start-time → `coordinator.process.capability-gap` exit 2 with no signal/lease; harness resume absence → spawn-fresh no error; harness spawn failure → `harness.spawn.refused` exit 1; absent progress → `unknown` (`coordinator-capability-gap`, `-claim-capability-gap`, `-kill-*`). The production adapter gap is F-06. |
| AC-F10-5 | **PASS** | Appendix A map has AC traces (TC-COORD-090 manual trace; the scenario and decision tests cover resume/stuck/kill/budget/wake). |

### 17.10 Non-functional acceptance

| AC | Status | Evidence / gap |
|---|---|---|
| AC-NFR-1 | **PASS** | Two identical ticks append only lease pairs; repeated stuck/wake/stop do not duplicate (`coordinator-idempotency`, `coordinator-scenario`). |
| AC-NFR-2 | **PASS** | No prompt/transcript/secret in records; evidence ≤512 bytes `key=value` (`coordinator-privacy`). |
| AC-NFR-3 | **PASS** | No model call, no CPU read (`coordinator-determinism`, `coordinator-no-cpu`). |
| AC-NFR-4 | **PASS** | tick/status p95 within bounds; one verified read per tick; ≤64 KiB data; ≤32 human lines (`coordinator-performance`, `-read-cost`). |

**Matrix tally:** PASS 39 · PARTIAL 8 · FAIL 3 (AC-F2-1, AC-F5-5, AC-F7-3; F-01/F-06 are cross-cutting majors that also affect F1-1/F4-1/F10-1).

---

## Deviation adjudications

### D-1. Iteration `reason` vocabulary (`live-session`, `expectation`)
**Verdict: ACCEPT the gap-fill, REJECT the silent extension.**
EVT-1 requires a closed `reason` for an iteration record, Appendix B defines only the five spawn/resume reasons, and an expectation-only record (`decision: "none"`) plus `join-live` have no value in that set. The two added markers are the right semantic gap-fill, but a pinned closed vocabulary changed without a spec amendment. Required: amend Appendix B/EVT-1 to list the iteration reason set (or add a dedicated expectation marker field). Code change is not otherwise required.

### D-2. Epoch derivation from the latest restart/exhaustion, `epoch-1` default, `exhausted-escalation-failed` derived
**Verdict: ACCEPT the derivation and the derived escalation state; REJECT the durability consequence.**
There is no epoch record kind in the pinned EVT set, so deriving the current epoch from the latest restart/exhaustion is a legitimate implementation choice, and `exhausted-escalation-failed` is explicitly declared “derived” in Appendix B. However, deriving the *fresh* epoch only inside the `--fresh-budget` invocation means the reset is not a durable identity: when the start decision consumes no ordinal, nothing records the new epoch and later commands revert to the old exhausted one (F-02). The spec’s F-5 “durable identity that survives supervisor restarts” therefore requires a persisted epoch marker (or an epoch carried on the acquisition/start iteration), not just a derivation.

### D-3. `--live` reports `live-facts-unknown` rather than fabricating facts
**Verdict: ACCEPT.**
AC-F9-1 explicitly allows `--live` to “declare unknown or degraded” when facts are unavailable; `live-facts-unknown` is a legitimate degradation token. Note (F-10): the positive branch adds no live fact, so the F-9 “reports live process facts” clause is only satisfied negatively. A bounded live-facts field or an explicit amendment is preferable.

### D-4. `packages/cli/src/production.ts` does not register the coordinator family
**Verdict: REJECT.**
The spec’s §7.1 in-scope list and AC-F1-1..F1-5/F9-1/F10-1 describe a runnable command family. `createConfigProgram` registers it only through an injected `CoordinatorComposition`; `production.ts` never supplies one and `PROMPT_REQUIRED_COMMANDS` excludes it, so the shipped binary returns `fallback.invocation`/“unexpected argument”. Documenting the gap as current truth does not satisfy the ACs. Either wire the composition and the required ports (including `startTimeMs`, F-06) or amend the spec to declare the command library-only and adjust the ACs.

### D-5. Doc-syncer strictness differences
- **Collection-cycle `join-live` is quiet (no decision record): REJECT.** AC-F2-1 requires the live-session evaluation to record `join-live`; the current-truth doc §3 narrows the spec instead. Either record without refreshing the expectation, or amend the AC and the test plan proof (F-05).
- **Escalation question does not carry the history reference (the receipt does): REJECT.** AC-F6-1 and F-6 say the question carries it; EVT-6’s field list is silent, which is the internal tension to resolve. Add it to the bounded question or amend both AC-F6-1/F-6 and EVT-6 (F-07).
- **Wake delivers one wake effect and does not choose live/resume/spawn: REJECT / needs amendment.** F-7 and AC-F7-1 explicitly require the F-2 choice; an opaque `session.wake()` with no production composition does not satisfy it. Make the effect explicit and tested, or amend F-7/AC-F7-1 (F-08).
- **`merge` evidence counts any `merge.transaction` record: ACCEPT.** `merge.transaction` is the delivered terminal merge transaction record (`result: merged | landing-unverified`); “a terminal merge record landed after the expectation” is reasonably satisfied by any such record after the expectation. No change required.

### D-6. No dedicated `test-spec-coordinator-supervision.md`
**Verdict: ACCEPT with a note.**
The documentation handbook says to “align broader test specs” with the per-change test plan; the change test plan (76 TCs) is a complete trace and the forbidden-literals registry constraint is a legitimate reason not to add a registered test spec. Note (minor): the spec’s §18 also names a “command page”; `doc/planning/oss-tooling/milestones/m1/commands/coordinator.md` does not exist (the registry row, man-page row, and contracts section do exist). Add the command page or amend §18.

---

## Plan and test-plan compliance

- **`plan validate GH-241`** → `verdict=valid`, `readyForDevelopment=true`, 10 phases. Phase titles and scopes match the delivered areas, with the exceptions in F-18 (13 out-of-scope changed paths; 8 declared-but-unchanged files; phase 5 declares a `tests/boundaries` folder with no file).
- **TC coverage:** all 76 TC ids appear in the test plan; 73 map to a test file that contains the TC id. TC-089 (non-regression run), TC-090 (Appendix A trace) and TC-092 (doc/registry/man-page review) are explicitly “Manual Only”/“Existing — Update”, which is acceptable, but TC-089’s automated form is the broad suite run below.
- **Test-proof quality:** several TCs assert a weaker observable than the pinned behaviour (F-19): stale-fence publish recovery, same-state wake retry, append-level non-claim busy, integrated join-live, fresh-budget durability, no-pickup after wake, and the non-null start instance.
- **pm-notes:** the notes explain the pre-primitive phase history and the rebase, but there is no per-phase completion entry (commit hash + test result) for the 10 plan phases. This is a DoD (`dod_check`) artifact concern, not a code defect; the retro in the notes covers the history.

---

## What is solid (for balance)

- Pure domain: no ambient clock/randomness/env/CPU/model in `coordinator-*`; mutation and determinism oracles pass.
- State boundary: strong validation (schema, closed vocabularies, verdict/reason coupling, duplicate/torn detection, contiguous ordinals), non-claim stale-fence recovery, fenced append, ledger-sequence folds.
- Claim: one fenced critical section with the under-fence read reused as the tick’s single verified read; liveness-first; single-record takeover.
- Kill helper: identity check before any signal, no shell/pattern kill, closed outcome, no record-before-verdict violation.
- Reserved slot: payload-only predicate, render-first at the cap, omitted count intact, brief mirrors the digest without a new anchor/section/type.
- Error table: exactly two two-segment coordinator codes, allowlist 38, identities 121, both gate files agree, reserved fallback unchanged.
- Documentation: new feature spec, two TDRs, registry/man-page/contracts rows, config/state/entrypoint/brief/status/blockers/harness/session/economics/result/daemon specs reconciled; `ados_distribution` markers and the distribution drift guard pass.
- Working tree clean at review start; `git diff --check` clean.

---

## Verification performed

All commands run from the repo root at `9c4d1521` (working tree clean).

| Command | Result |
|---|---|
| `git status --porcelain` / `git rev-parse` / `git rev-list --count origin/main-tools..HEAD` | clean; HEAD `9c4d1521`; base `dbbc62cf`; 28 commits |
| `git diff --shortstat origin/main-tools...HEAD` | 171 files, +21 837 / −75 |
| `bun packages/cli/bin/delivery-os.ts plan validate GH-241 --json` | `verdict=valid`, `readyForDevelopment=true` |
| `bun test tests/behaviour/coordinator- tests/checks/coordinator- tests/structure/coordinator- tests/golden/coordinator.test.ts tests/types/coordinator.type-test.ts` | 302 pass, 0 fail |
| `bun test tests/structure/error-table.test.ts config-contract state-contract daemon-contract coordinator-contract coordinator-imports coordinator-no-cpu coordinator-regime coordinator-kill-target cli-edge-seam state-scope` | 165 pass, 0 fail |
| `bun test tests/behaviour/coordinator-escalation-slot coordinator-escalation-surface tests/golden/status-digest tests/golden/brief coordinator-scenario coordinator-idempotency coordinator-performance coordinator-read-cost` | 43 pass, 0 fail |
| `bun test tests/checks/coordinator-determinism coordinator-privacy coordinator-mutants exit-code-literals error-table-sync secret-read-boundary` | 154 pass, 0 fail |
| `bun test tests/behaviour/status* brief* blockers* tests/golden` | 1012 pass, 2 skip, 0 fail |
| `pnpm exec tsc -p tsconfig.json --noEmit` | clean |
| `pnpm exec tsc -p tests/types/tsconfig.json --noEmit` | clean |
| `pnpm exec depcruise packages` | no dependency violations (370 modules, 1083 deps) |
| `pnpm exec biome lint <changed coordinator files>` / `biome format` | clean |
| `pnpm exec biome check <changed coordinator files>` | 4 `organizeImports` assists only (F-20) |
| `bun run scripts/checks/ambient-globals.ts` / `forbidden-literals.ts` / `privacy-literals.ts` / `secret-read-boundary.ts` / `help-guide-coverage.ts` / `exports-parity.ts` / `prompt-conformance.ts` | all exit 0 |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 (“no drift — 81 in-scope docs”) |
| `git diff --check origin/main-tools...HEAD` | clean |
| `bun packages/cli/bin/delivery-os.ts coordinator status --json` / `coordinator start --foreground` | `fallback.invocation` / “unexpected argument” (F-01) |
| `bun test tests/checks/ci-baseline-parity.test.ts` | fails `EXDEV` on `git clone --local` in `/tmp`; reproduced with a different filesystem, matches the disclosed environmental failure; not a code defect |
| Scratch harness runs (in `/tmp/opencode`, not committed) | fresh-budget `status` reverts to `epoch-1` `10/10` after `--fresh-budget` (F-02); start human receipt prints `instance=none` (F-03); no-pickup tick after an answer reports stale `woken` (F-04); answered escalation then tick publishes a second question (F-12) |

---

## Recommendation

**FAIL — return to `@coder` (and `@spec-writer` for the small amendments) before re-review.** Blocking work:

1. Wire the coordinator family into a shipped composition and implement the production `startTimeMs` process-identity capability, or amend the spec to make the family library-only and adjust F-1/F-9/F-10 ACs (F-01, F-06).
2. Persist the budget epoch so `--fresh-budget` survives a crash/restart and later commands see the new epoch (F-02).
3. Fix the start receipt/data to report the acquisition instance (and render the terminal result honestly) (F-03).
4. Report the current cycle’s wake outcome (`no-pickup`) instead of the last durable wake on a tick (F-04).
5. Resolve AC-F2-1 (record `join-live` on collection evaluation or amend the AC) and the escalation history-reference gap (F-05, F-07); implement the F-3 digest-change expectation or amend F-3 (F-21).
6. Amend the spec for the iteration-reason vocabulary and the wake-effect choice, and strengthen the weaker TC proofs (D-1, D-5, F-19); address the escalation-answer duplicate question and the remaining minor findings (F-12, F-13, F-14).

The fresh-budget, start-receipt, and no-pickup defects are reproducible with the existing harness and are not covered by the current tests; fixing the tests together with the code is required for a trustworthy re-review.
