# Code Review — GH-241 "M1-S23: Coordinator supervision" (iteration 2)

- **Review mode:** local (ADOS pipeline), re-review after remediation
- **Work item:** GH-241
- **Branch:** `feat/GH-241/coordinator-supervision` @ `b8fa311a` (33 commits)
- **Base:** `origin/main-tools` @ `dbbc62cf` (merge-base; linear; working tree clean)
- **Change folder:** `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/`
- **Artifacts reviewed:** `chg-GH-241-spec.md` v1.6, `chg-GH-241-test-plan.md`, `chg-GH-241-plan.yaml` (revision 1.6), `chg-GH-241-pm-notes.yaml`, `review/review-iter-1.md`, `readiness-review/readiness-iter-5.md`, TDR-0017/TDR-0018, the reconciled current-truth docs, and the 187 changed files.
- **Review date:** 2026-11-09
- **Reviewed by:** reviewer agent (local mode)

## Status: **FAIL**

The remediation is substantial and, on the substance of the iteration-1 findings, largely successful. The four reproduced defects are fixed end-to-end and now proven by integrated tests (fresh-budget durability across `status`/`tick`/`start`; a real acquisition instance and terminal receipt on `start`; per-cycle `no-pickup`; no second escalation question after an answer). The coordinator family is composed by the shipped entrypoint and a real `bun packages/cli/bin/delivery-os.ts coordinator status` runs. The production start-time identity capability is implemented and tested. The error-table arithmetic is exact (allowlist 38, identity table 121, both gate copies byte-equal). `plan validate GH-241` is valid/ready. All 319 coordinator tests pass, as do the delivered status/brief/blockers/golden suites (1012 pass, 2 skip), the targeted structure/checks gates, `tsc`, `depcruise`, `pnpm lint`, `pnpm format:check`, and the doc-distribution guard.

It cannot ship as-is because **the repository's own help/guide conformance gate now fails**: `bun run scripts/checks/help-guide-coverage.ts` (part of `pnpm check` / `pnpm check:help`) exits 1 with `coordinator: doc/planning/oss-tooling/milestones/m1/commands/coordinator.md lacks --version`. The coordinator page was added by the remediation and the command was added to `PROMPT_REQUIRED_COMMANDS`, but the new reference page omits the mandatory `--version` help section that every other prompt-required page carries. That is a one-line documentation fix, but `pnpm check` is a merge gate.

Prior findings: **20 CLOSED (F-15 with a spec-clarification note), 1 PARTIAL (F-18)**. New findings: **6 (1 major/blocking, 1 medium, 2 minor, 2 nit)**. AC matrix: **49 PASS, 1 PARTIAL, 0 FAIL**.

---

## Findings (new / unresolved)

Severity: `critical` (data loss / security / correctness bug) · `major` (blocks the delivered surface or a repo gate) · `medium` (robustness / latent production defect) · `minor` (quality / traceability) · `nit` (style).

| ID | Severity | Location | Issue | Required fix |
|---|---|---|---|---|
| NF-01 | **major (blocking)** | `doc/planning/oss-tooling/milestones/m1/commands/coordinator.md`; `packages/cli/src/help/prompt-required-commands.ts:27` | The coordinator command page lacks the mandatory `--version` help section. `pnpm check:help` / `help-guide-coverage` now fails (`coordinator: … coordinator.md lacks --version`, exit 1). Coordinator was newly added to `PROMPT_REQUIRED_COMMANDS`, so the newly added page is subject to the gate. This is the only hard-gate failure. | Add the standard help section used by every other page (e.g. "Root `<binary> --help` and `<binary> --version` are …"), or add `--version` to the documented synopsis. Re-run `bun run scripts/checks/help-guide-coverage.ts`. |
| NF-02 | minor | `chg-GH-241-plan.yaml` (all phases); `doc/spec/features/feature-agents-and-commands.md` | F-18 residual: one changed path is outside every declared phase scope — `doc/spec/features/feature-agents-and-commands.md` (adds `coordinator`/`dispatch` to the prompt-required set and `GH-241`/`GH-239` to `related_changes`). Re-derived from the delivered diff: 187 changed paths, 1 uncovered, 0 declared-but-unchanged specific files. The Phase-11 summary claims "0 uncovered … 185 paths", which no longer holds. | Declare `doc/spec/features/feature-agents-and-commands.md` in the owning doc-sync phase (Phase 10 or 11), or record it as an explicit doc-sync artifact. Update the Phase-11 fidelity claim. |
| NF-03 | minor | `packages/cli/src/commands/coordinator-loop.ts:770` (`escalate` → `readOnce()`) | NFR-4 requires "at most one verified read per store per tick; the claim's under-fence state read is the tick's single verified state read". On the exhaustion/stuck-exhaustion path, `escalate()` performs a second `store.readRecords()` after the claim read, so such a tick performs two verified reads. The `coordinator-read-cost` test only exercises a non-exhaustion tick. | Thread the cycle's `raw`/ledger read into `escalate()` instead of re-reading; or explicitly scope NFR-4 to the non-escalation path in the spec and add a test asserting the escalation read cost. |
| NF-04 | medium | `packages/cli/src/commands/coordinator-loop.ts:885, 921-922`; `packages/cli/src/production.ts:1331-1332` | Wake effect selection uses the **pre-lifecycle** session facts. For a non-live session with a pickup question, `applyLifecycle` already applies `resume`/`spawn` (via `session.apply`), then `wakeEffectFor(session)` recomputes `resume`/`spawn` from the stale facts and `session.wake(effect)` runs the delivered adapter effect **a second time** in the same cycle. The fixture's `session.wake` only increments a counter, so the integrated tests cannot observe this; in production the second resume/spawn can fail and turn an otherwise-successful wake into `coordinator.wake.delivery-failed` (exit 2). | Select the wake effect from post-lifecycle facts (re-read `ports.session.read()` after `applyLifecycle`; a just-resumed/spawned session is then `alive` → `live` no-op), or skip the wake effect when the same cycle already applied that recovery. Add a production-composition test (or a fixture whose `wake` records the effect) for a non-live session + pickup question. |
| NF-05 | nit | `chg-GH-241-test-plan.md` (lines 25, 71); `chg-GH-241-plan.yaml` header | Version drift: the test plan still says it is "aligned to specification v1.4" and "trace every one of the 50 acceptance criteria of specification v1.4", while the spec is v1.6 and the plan header says "test-plan v1.5". All 76 TCs still map and 50 ACs are covered, so this is traceability prose only. | Bump the test-plan source/version references to v1.6 (or v1.5) so the traceability statement matches the artifact set. |
| NF-06 | nit | `packages/cli/src/commands/coordinator.ts:9-10` | `biome check` reports one `organizeImports` assist (value import before type import from the same module). This is not a `pnpm lint` / `pnpm format:check` failure, so `pnpm check` is unaffected here, but it is a residual of F-20's "run `biome check --write`". | Run `biome check --write packages/cli/src/commands/coordinator.ts` (or reorder the two imports). |

---

## Prior findings adjudication (F-01 … F-21)

Every iteration-1 finding was re-derived from the current tree and tests, not from the Phase-11 prose.

| ID | Verdict | Evidence (code + test) |
|---|---|---|
| F-01 (shipped composition) | **CLOSED** | `production.ts` builds `createProductionCoordinatorComposition()` and feeds `plan`… `coordinator` into the config program; `PROMPT_REQUIRED_COMMANDS` includes `"coordinator"`. Real invocation `bun packages/cli/bin/delivery-os.ts coordinator status --json` returns `delivery.coordinator.v1` (exit 0); `coordinator --help` prints the family. `tests/structure/coordinator-production-composition.test.ts` and `coordinator-production-session.test.ts` prove registration and real spawn/resume effects. |
| F-02 (fresh-budget durability) | **CLOSED** | The epoch is carried on every `coordinator.fence` record (`budgetEpochId`), and `currentBudgetEpoch` reads the latest non-null fence carrier before restart/exhaustion. `tests/behaviour/coordinator-fresh-budget.test.ts` ("the fresh epoch survives a later status, tick, and start") asserts `epoch-2` / `0/10` after `start --fresh-budget` then `status`, `tick`, and a second `start`. |
| F-03 (start receipt / instance) | **CLOSED** | `start` returns the acquisition `instance` (override) after the lifetime lease is released and renders the terminal receipt: `renderCoordinatorStarted` prints `coordinator stopped … released=true` (`coordinator-text.ts:17-21`). `coordinator-start.test.ts` asserts non-null `instance-0001`, `pid=9001`, `fence.action=released`, and the human line contains `coordinator stopped`/`released=true`, never `instance=none`. |
| F-04 (per-cycle no-pickup) | **CLOSED** | `cycle()` sets `wakeOutcome` from `evaluateWake` on every cycle (including `no-pickup` with a null question); only `observation()` for `status` falls back to the last durable wake. `coordinator-wake-pickup`/`-wake-answered`/`-tick` assert `no-pickup` and no durable wake after an answer. |
| F-05 (join-live on collection) | **CLOSED** | `applyLifecycle` records `join-live`/`live-session` on every evaluation (collection included); `durableExpectation` excludes `reason === "live-session"` from the expectation fold. `coordinator-tick` asserts one `join-live` iteration per live tick; `coordinator-foreground-loop` asserts N+1 join-live iterations for N boundaries. |
| F-06 (production startTimeMs) | **CLOSED** | `createNodeProcessPort.startTimeMs` parses `/proc/<pid>/stat` field 22 + `/proc/stat btime` (`process.ts:37-55`), returns `undefined` off Linux. `coordinator-kill-grace.test.ts` exercises the real port against `process.pid` on Linux and the documented `undefined` fallback otherwise; composition declares `startTimeIdentity` by method presence. |
| F-07 (historyRef on question) | **CLOSED** | The escalation question record carries `historyRef` (`coordinator-loop.ts:808`), `contracts/blockers.ts` adds optional `historyRef`, `state/blockers.ts` persists/validates it. `coordinator-escalation-publish.test.ts` asserts `escalation[0].historyRef === "coordinator/coordinator-main"`. |
| F-08 (explicit wake effect) | **CLOSED** | `session.wake(effect)` replaces the opaque call; `wakeEffectFor` selects live/resume/spawn from `decideLifecycle`; `wake.effect` is reported. `coordinator-wake-paths.test.ts` asserts `live`/`resume`/`spawn` per session facts. (See NF-04: the effect is then re-applied for non-live sessions.) |
| F-09 (history ref on refusal) | **CLOSED** | `applyRecovery` refusal returns summary `historyRef=coordinator/<id>`; `coordinator-restart-exhausted.test.ts` asserts the summary contains it. |
| F-10 (positive `--live` facts) | **CLOSED** | `status --live` populates `{alive, startTimeVerified, leaseAgeMs}` when the probe answers and falls back to `live-facts-unknown`. `coordinator-status.test.ts` asserts the exact positive object and the unknown degradation. |
| F-11 (iteration reason vocabulary) | **CLOSED** | Spec v1.6 EVT-1 and Appendix B declare the closed set including `live-session` and `expectation`; `COORDINATOR_ITERATION_REASONS` matches. |
| F-12 (duplicate escalation after answer) | **CLOSED** | `escalate` reuses the terminal receipt's question id per epoch (`coordinator-loop.ts:785-791`). `coordinator-escalation-reuse.test.ts` ("answered escalation never publishes a second question") passes. |
| F-13 (stop request race) | **CLOSED** | The loop honours `stop-requested` only when `lease.instanceId === expectedInstanceId` (`coordinator-loop.ts:873-880`). `coordinator-foreground-loop.test.ts` has a replaced-holder race test. |
| F-14 (crash window) | **CLOSED** | Documented current truth (`feature-coordinator-supervision.md:271-277`) and tested: `coordinator-restart-durability.test.ts` "a crash between the restart record and its effect consumes one ordinal (documented window)". |
| F-15 (redundant session pair) | **CLOSED (with note)** | The restart record now sets `sessionId: null` (recovering identity not known) and `previousSessionId` = replaced session; the doc states this. Note: EVT-2/Appendix E do not explicitly say `sessionId` may be null — a spec clarification would remove the remaining ambiguity. |
| F-16 (status cap drift) | **CLOSED** | `typedQuestionsSection` now passes `STATUS_MAX_ITEMS_PER_SECTION` explicitly into `projectReservedSlotQuestions` (`status.ts:1681-1685`); the coordinator bound is no longer imposed on the status contract. |
| F-17 (expectation cursor/sequence) | **CLOSED** | The expectation carries its ledged `sequence` found from raw records by `iterationId`, and `appendIteration` computes the fingerprint from the post-append cursor. No `recordedAt` tie-break remains in the evidence path. |
| F-18 (plan scope fidelity) | **PARTIAL** | 0 declared-but-unchanged specific files and 186/187 changed paths covered. One changed path is still undeclared: `doc/spec/features/feature-agents-and-commands.md` (see NF-02). |
| F-19 (test-proof strength) | **CLOSED** | Stale-fence same-store recovery (`coordinator-escalation-failed` "age-stale fence recovered once"); same-state wake retry (`coordinator-wake-failed` "later successful tick on the same state"); non-claim append busy (`coordinator-foreground-loop` "still-busy released append exits 2 with state.lock.busy"); integrated join-live (`coordinator-tick`); fresh-budget durability; no-pickup after wake; non-null start instance — all present and passing. (The test title in `coordinator-fence-records` still says "non-claim append" while its body exercises the claim refusal, but the release-busy test supplies the real proof.) |
| F-20 (nit set) | **CLOSED** | `COORDINATOR_RESTART_KEY_PREFIX` imported (no duplicate literal), `appendFence` reused, `coordinatorKeyFor` has `assertNever`, question id is `q-escalation-…` (no `q-q-`), one verified read per quiet cycle. Residual: one `organizeImports` assist in `coordinator.ts` (NF-06, not a `pnpm check` failure). |
| F-21 (digest-change expectation) | **CLOSED** | Live cycles append a `decision: none`/`reason: expectation` iteration when the state-sourced fingerprint advances (`coordinator-loop.ts:985-1014`); `coordinator-expectation-refresh.test.ts` proves exactly one refresh on an external record. The edge where no non-live-session iteration exists (no active expectation) is explicitly documented in the current-truth spec (§4). |

---

## Acceptance-criteria matrix (all 50)

Status key: **PASS** = observable satisfied and tested; **PARTIAL** = main observable satisfied but a pinned clause is proven only at a narrower level; **FAIL** = pinned observable not met.

### 17.1 Supervision process and command family

| AC | Status | Evidence / note |
|---|---|---|
| AC-F1-1 | PASS | Family composed and reachable; claim appends one `acquired` with holder/supervisorMode/externalUnit; second start refused (holder named); bare start `fallback.invocation` exit 1; `status` reports the instance from the lease fold. The blocking `start` receipt is terminal by design (the F-03 remedy); a running instance is reported by `status`. `coordinator-start`, `coordinator-production-composition`. |
| AC-F1-2 | PASS | Tick claims via the same path, one bounded cycle, one `released` in `finally`, `delivery.coordinator.v1` with all fields, no loop, one verified read, quiet cycle = lease pair. `coordinator-tick`, `coordinator-read-cost`. |
| AC-F1-3 | PASS | `stop` appends `stop-requested`, `requested=true`/`released=false`; `not-running` on released/dead/aged-unknown; capability gap on undeclared alive; never releases another handle. `coordinator-stop`, `coordinator-lease-liveness`. |
| AC-F1-4 | PASS | Instance folded from the latest lease by ledger order; `startedAt` = acquisition record; no instance record kind. `coordinator-instance-lease`. |
| AC-F1-5 | PASS | One acquisition + one `released` for N boundaries, no per-cycle lease; stop/fatal/signal exits with typed identities and `released` attempts. `coordinator-foreground-loop`. |
| AC-F9-1 | PASS | Status reports instance/session/decision/restarts/stuck/`tickVerdict=null`/wake/escalation/fence and never mutates/evaluates; `--live` gives positive `{alive,startTimeVerified,leaseAgeMs}` or `live-facts-unknown`. `coordinator-status`. |

### 17.2 Join-or-resume-or-spawn decision

| AC | Status | Evidence |
|---|---|---|
| AC-F2-1 | PASS | `join-live` recorded on every evaluation (collection included), zero ordinals, no spawn/resume; excluded from expectation fold. `coordinator-tick`, `coordinator-decision-join`. |
| AC-F2-2 | PASS | `resume-context` for unclean/resumable/below-limit/declared resume; one ordinal; resume effect. `coordinator-decision-resume`, `coordinator-production-session`. |
| AC-F2-3 | PASS | `spawn-fresh` with `context-pressure`/`context-unknown`/`session-interrupted`; one ordinal; no resume error. `coordinator-decision-spawn`, `coordinator-capability-gap`. |
| AC-F2-4 | PASS | Killed mid-iteration resumes/respawns without re-executing closed-out artifacts. `coordinator-decision-recovery`. |
| AC-F2-5 | PASS | Decision and ordinal survive a reopened store and later `status`. `coordinator-decision-durability`. |
| AC-F2-6 | PASS | `initial-start`/`clean-iteration-end` consume zero. `coordinator-decision-spawn`. |

### 17.3 Artifact-evidence stuck detection

| AC | Status | Evidence |
|---|---|---|
| AC-F3-1 | PASS | `stuck` verdict with `stuck-artifact-evidence`, `phase=verdict`, `killOutcome=not-attempted`, bounded evidence; fingerprint = record cursor + open coordinator questions. `coordinator-stuck-verdict/-matrix/-fingerprint`. |
| AC-F3-2 | PASS | Positive sourced progress inside `progress-bound` vetoes. `coordinator-stuck-corroborator`. |
| AC-F3-3 | PASS | Unknown/absent → `unknown`, never zero; all-unknown/unreadable → `unevaluable`, one verdict, no kill, exit 2. `coordinator-stuck-unknown/-unevaluable`. |
| AC-F3-4 | PASS | Two evaluations byte-identical; no CPU read. `coordinator-stuck-*`, `coordinator-no-cpu`. |

### 17.4 Kill with grace

| AC | Status | Evidence |
|---|---|---|
| AC-F4-1 | PASS | PID + start-time verified through the real node port; TERM, grace, conditional SIGKILL; two-phase record. `coordinator-kill-grace`, `coordinator-kill-fence`. |
| AC-F4-2 | PASS | Failed kill → `phase=outcome` `failed`, `coordinator.session.kill-failed` exit 2, no retry loop. `coordinator-kill-failed`. |
| AC-F4-3 | PASS | Target is the recorded pid; no name/pattern/shell. `coordinator-kill-target` + structure scan. |
| AC-F4-4 | PASS | Mismatch sends no signal, `killFailureReason=identity-mismatch`, exit 2. `coordinator-kill-identity`. |

### 17.5 Restart budget

| AC | Status | Evidence |
|---|---|---|
| AC-F5-1 | PASS | Records under `coordinator/<coordinatorId>`, not lane/economics. `coordinator-restart-namespace`. |
| AC-F5-2 | PASS | Below bound appends the next contiguous ordinal and proceeds. `coordinator-restart-admit`. |
| AC-F5-3 | PASS | At/above bound: no replacement, exit 1, history reference on the failure summary, escalation runs. `coordinator-restart-exhausted`. |
| AC-F5-4 | PASS | Reopened store keeps count/bound; replay appends nothing; duplicate ordinal → torn. `coordinator-restart-durability`. |
| AC-F5-5 | PASS | `--fresh-budget` opens a durable new epoch on the lease carrier; later `status`/`tick`/`start` observe it; old epoch/history remain. `coordinator-fresh-budget`. |

### 17.6 Exhaustion escalation

| AC | Status | Evidence |
|---|---|---|
| AC-F6-1 | PASS | One owner `decision-needed` question, `ref=<id>#<epoch>`, count/bound/`historyRef`/options, reserved render-first in digest and brief, seven others, lowest displaced. `coordinator-escalation-publish/-slot/-surface`, status/brief goldens. |
| AC-F6-2 | PASS | Publish failure → exit 2 `coordinator.escalation.publish-failed`, no receipt; status `exhausted-escalation-failed`; one-shot stale recovery before the append. `coordinator-escalation-failed`. |
| AC-F6-3 | PASS | Repeated exhausted tick reuses the open/answered question, no second receipt, exit 0 `exhausted-escalated`. `coordinator-escalation-idempotent/-reuse`. |

### 17.7 Wake-on-typed-question

| AC | Status | Evidence |
|---|---|---|
| AC-F7-1 | PASS | Strict pickup wakes within one cycle; effect selected live/resume/spawn and reported; one `woken` record with `askedAt`. `coordinator-wake-pickup/-paths`. |
| AC-F7-2 | PASS | Still-top already-woken appends nothing; dedupe on coordinator+question+`askedAt`. `coordinator-wake-dedupe`. |
| AC-F7-3 | PASS | Owner head / non-open / no question → `no-pickup`, null question, no record; absent status counts as open. `coordinator-wake-pickup/-wake-answered`. |
| AC-F7-4 | **PARTIAL** | The pure `evaluateWake` returns `answered-before-wake` with no persistence and is unit-tested (`coordinator-wake-answered`), but the integrated tick uses one verified snapshot, so a question answered before the cycle is `no-pickup` (AC-F7-3) and `answered-before-wake` is unreachable through the command. Proof is domain-level, not end-to-end. (Design consequence of the single-read rule; not a defect.) |
| AC-F7-5 | PASS | Delivery failure → `coordinator.wake.delivery-failed` exit 2, no record, released lease; same-state retry appends exactly one later. `coordinator-wake-failed`. |
| AC-F7-6 | PASS | A new top question after an answer wakes normally. `coordinator-wake-next`. |

### 17.8 Supervisor regime and single-instance lease

| AC | Status | Evidence |
|---|---|---|
| AC-F8-1 | PASS | Live holder refused regardless of age; declared-unanswered held until 2×interval; undeclared → capability gap; separate state dirs independent. `coordinator-lease-liveness`, `-claim-capability-gap`. |
| AC-F8-2 | PASS | Regime descriptor (state-dir, lease, unit identity, process kind, budget store, foreground, `externalUnit=absent`, M1-S18); bare start refused; no installer. `coordinator-regime`. |
| AC-F8-3 | PASS | Dead holder / aged-unknown → one `stale-takeover`, no second `acquired`, previous holder + fence age. `coordinator-lease-liveness`, `-fence-records`. |
| AC-F8-4 | PASS | Live old holder refused; `stop` requests; next boundary releases. `coordinator-lease-liveness`, `coordinator-foreground-loop`. |
| AC-F8-5 | PASS | Both non-blocking interleavings yield exactly one acquisition and one `already-running`. `coordinator-claim-race`, `-claim-serialized`. |
| AC-F8-6 | PASS | `tick` takes over a crashed holder, one cycle, releases. `coordinator-tick-takeover`. |
| AC-F8-7 | PASS | Stale fence → one `recoverFence` + one retry for claim; non-stale still-busy → `already-running`/`state.lock.busy`. `coordinator-claim-stale-fence`, `-state-fence-recovery`, `coordinator-foreground-loop` (release busy). |

### 17.9 Configuration, state, and error contracts

| AC | Status | Evidence |
|---|---|---|
| AC-F10-1 | PASS | Six keys/defaults/domains validated by `resolveCoordinatorSettings`; the shipped surface resolves them; no decision-code literals. `coordinator-config`, `-budget-config`, production composition. |
| AC-F10-2 | PASS | `coordinator` domain kind and six rows; `{0,1,2}`; allowlist 36→38 (both copies byte-equal, verified 38/38); identity table 121. `error-table.test`, `error-table-sync`. |
| AC-F10-3 | PASS | Torn/unknown → state identity exit 2; gapped ordinals unevaluable; claim busy → `already-running`; non-claim busy → `state.lock.busy`; failed append → `state.write.failed`. `coordinator-records`, `-ordinals`, `-fence-records`, `-state-fence-recovery`. |
| AC-F10-4 | PASS | Missing alive/kill/start-time → `coordinator.process.capability-gap` exit 2 with no signal/lease; harness resume absence → spawn-fresh; harness spawn refusal → `harness.spawn.refused`; absent progress → `unknown`. `coordinator-capability-gap`, `-claim-capability-gap`, `-kill-*`. |
| AC-F10-5 | PASS | Appendix A map has an AC trace per `ceo-loop.sh` function (TC-090 manual trace + AC traces). |

### 17.10 Non-functional acceptance

| AC | Status | Evidence |
|---|---|---|
| AC-NFR-1 | PASS | Two identical ticks append only lease pairs; repeated stuck/wake/stop do not duplicate. `coordinator-idempotency`, `-scenario`. |
| AC-NFR-2 | PASS | No prompt/transcript/secret in records; evidence ≤512 bytes `key=value`. `coordinator-privacy`. |
| AC-NFR-3 | PASS | No model call, no CPU read. `coordinator-determinism`, `coordinator-no-cpu`. |
| AC-NFR-4 | PASS | tick/status p95 within bounds; ≤64 KiB data; ≤32 human lines. `coordinator-performance`, `-read-cost`. (The NFR-4 one-read-per-tick requirement is still exceeded on the exhaustion path — NF-03.) |

**Matrix tally:** PASS 49 · PARTIAL 1 (AC-F7-4) · FAIL 0.

---

## Residual-limitation adjudication

The declared production limitations are real, documented as current truth, and not overclaimed.

| Limitation | Delivered behaviour | Documentation | Verdict |
|---|---|---|---|
| No total context-token source | `readCoordinatorSession` returns `contextTokens: null`; an unclean recorded session records `spawn-fresh` reason `context-unknown`; `resume-context` is unreachable in production. | `feature-coordinator-supervision.md:172-176`; `coordinator-production-session.test.ts` "absent context count spawns fresh rather than fabricating a resume". | **ACCEPT** — disclosed and tested. |
| No durable coordinator session identity | Session facts fall back to the newest recorded daemon lane row; a later invocation with no row starts fresh and consumes one ordinal. | `feature-coordinator-supervision.md:177-181`. | **ACCEPT** — disclosed; note the operational consequence (repeated ticks without a lane row consume ordinals) is implied but could be stated more bluntly. |
| No pid on a spawned handle | `HarnessSessionHandle` carries no pid; kill-with-grace reports the process capability gap rather than signalling an unverified pid. | `feature-coordinator-supervision.md:182-185`; `production.ts:1286-1288`. | **ACCEPT** — fail-closed and documented. |
| No sourced progress reading | New-turn fact is `unknown`; the `progress-bound` veto cannot fire in production; only a merge/answer advance keeps a cycle out of the stuck window. | `feature-coordinator-supervision.md:186-189, 217-227`. | **ACCEPT** — disclosed; behaviour is conservative (unknown never counts as stale). |
| claude-code resume absent | The adapter returns `harness.capability.gap`; the decision selects spawn-fresh. | `feature-coordinator-supervision.md:191-192`; `coordinator-production-session.test.ts` claude resume test. | **ACCEPT** — disclosed and tested. |
| Start-time identity is Linux-only | `startTimeMs` returns `undefined` off Linux (kill → `identity-mismatch`, no signal). Additionally, `ownIdentity()` is null off Linux, so a claim returns `coordinator.process.capability-gap` — i.e. supervision effectively requires a readable `/proc` start time. | `feature-coordinator-supervision.md:242-246`, `feature-harness-adapters.md:167-170` disclose the `/proc` dependency and the kill behaviour. The **claim-time** consequence on non-Linux is not stated. | **ACCEPT with a doc note** — fail-closed is correct; consider stating that supervision requires a readable own start time (Linux reference host), since the spec's platform assumption names POSIX and defers the Windows equivalent. |

---

## Plan / test-plan / spec compliance

- **`plan validate GH-241 --json`** → `verdict=valid`, `readyForDevelopment=true`, 11 phases. Phase 11 (review remediation) is present and its scope declarations were re-derived against the delivered diff.
- **Plan scope fidelity (F-18):** 187 changed paths; **1 uncovered** (`doc/spec/features/feature-agents-and-commands.md` — NF-02); **0 declared-but-unchanged specific files**. Everything else is covered by a declared file, glob, or folder.
- **`plan diff GH-241 --against origin/main-tools`** fails with `input.value.rejected` because the production `plan.readDiff` is an unconfigured fallback (`{ok:false}`). This is **pre-existing at `dbbc62cf`** (same `createPlanCommandRuntime` construction without `readDiff`), not a regression; scope fidelity was therefore verified by parsing the plan scope and the `git diff` path set directly.
- **TC coverage:** all 76 `TC-COORD-*` ids are in the test plan; 73 appear in a test file; TC-COORD-089, -090, -092 are explicitly manual/existing (non-regression run, Appendix A trace, documentation review) and accepted as such. No new TCs were required for Phase 11 (it re-runs the existing gates), consistent with the plan.
- **Spec compliance:** v1.6 contains the required amendments (EVT-1/Appendix B iteration reasons; F-5/AC-F5-5 durable epoch; EVT-6/F-6 question `historyRef`; F-7/AC-F7-1 wake effect; F-9/AC-F9-1 positive live facts; §18 command page). One stale internal literal remains: spec §8.2/§22 say "a quiet cycle grows the log by no records", but a live cycle now appends a `join-live` iteration record required by AC-F2-1 (v1.6 EVT-1 acknowledges collection-cycle joins). The current-truth doc is consistent ("appends no action record"). Minor prose inconsistency, not a code defect.
- **pm-notes:** per-phase completion evidence is still a DoD artifact concern; this review is a code/contract gate, not the DoD gate.

---

## Deviation adjudications (iteration-1 D-1 … D-6, re-checked)

- **D-1 (iteration reason vocabulary):** RESOLVED — spec v1.6 EVT-1/Appendix B and the contract set agree.
- **D-2 (epoch derivation):** RESOLVED — the epoch is now persisted on `coordinator.fence` and read by `currentBudgetEpoch`; the reset is no longer derivable-only.
- **D-3 (`--live` degradation):** RESOLVED — the positive branch now reports `alive`, `startTimeVerified`, `leaseAgeMs`; unknown stays `live-facts-unknown`.
- **D-4 (unshipped family):** RESOLVED — the family is composed by `production.ts` and prompt-required; a real invocation reaches the handler.
- **D-5 (doc-syncer strictness):**
  - Collection-cycle `join-live`: RESOLVED (recorded, excluded from the expectation fold).
  - Escalation question `historyRef`: RESOLVED (question carries it).
  - Wake effect: RESOLVED (explicit effect selected/reported) — but see NF-04 (duplicate application for non-live sessions).
  - `merge` evidence: unchanged ACCEPT.
- **D-6 (command page):** RESOLVED — `doc/planning/oss-tooling/milestones/m1/commands/coordinator.md` now exists; it is missing only the `--version` help section (NF-01).

---

## What is solid (for balance)

- **The four reproduced defects are fixed and tested end-to-end**, not just in prose: fresh-budget durability across `status`/`tick`/`start`; a real acquisition instance with an honest terminal receipt; per-cycle `no-pickup` after an answer; no second escalation question after an answer.
- **The family is truly shipped:** `production.ts` composes the store, clock, ids, resolved settings, node process port, delivered harness session port, session facts/effects, and the loop; real `coordinator status`/`--help` work; bare `start` returns the declared `fallback.invocation`.
- **Production process identity is real:** `startTimeMs` reads `/proc` + `btime`, and the real port is exercised in tests; non-Linux is a fail-closed, documented no-reading.
- **Error-table arithmetic exact:** allowlist 38 (both copies byte-equal), identity table 121, two two-segment coordinator codes, no wildcard/widening.
- **State discipline:** six additive record kinds, `STATE_SCHEMA_VERSION` unchanged, ledger-sequence folds, two-phase stuck, single-record takeover, non-claim per-append fence rule, durable epoch on the lease.
- **Determinism/privacy:** pure domain, no ambient clock/randomness/env/CPU/model in decision or render paths; bounded text/data; no secret/prompt material.
- **No regression:** `contracts/state.ts`, `ceo-loop.sh`, and the lane/economics modules are unchanged; the delivered status/brief/blockers/golden suites pass (1012 pass, 2 skip); depcruise clean; `tsc` clean; `pnpm lint`/`format:check` exit 0; doc-distribution no drift.
- **Documentation:** feature spec, test spec, command page, registry/man-page/contracts, config/state/entrypoint/harness/daemon/status/brief/blockers/economics docs reconciled; the declared platform limitations are disclosed without overclaiming.

---

## Verification performed

All commands run from the repo root at `b8fa311a` (working tree clean).

| Command | Result |
|---|---|
| `git status --porcelain` / `git rev-parse` / `git rev-list --count origin/main-tools..HEAD` | clean; HEAD `b8fa311a`; base `dbbc62cf`; 33 commits; linear |
| `git diff --shortstat origin/main-tools...HEAD` | 187 files, +24 085 / −86 |
| `bun packages/cli/bin/delivery-os.ts coordinator status --json` | `delivery.coordinator.v1`, exit 0 (no `fallback.invocation`) |
| `bun packages/cli/bin/delivery-os.ts coordinator --help` | usage + example + exit codes + "See also …/commands/coordinator.md", exit 0 |
| `bun packages/cli/bin/delivery-os.ts coordinator start --json` | `fallback.invocation`, summary names `--foreground`/M1-S18 |
| `bun packages/cli/bin/delivery-os.ts coordinator status --foreground --json` | `fallback.invocation` (`result=refused; reason=grammar`) |
| `bun packages/cli/bin/delivery-os.ts plan validate GH-241 --json` | `verdict=valid`, `readyForDevelopment=true`, 11 phases |
| Plan-scope re-derivation (YAML scope vs `git diff --name-only`) | 187 changed, 1 uncovered (NF-02), 0 declared-but-unchanged files |
| `bun test tests/behaviour/coordinator- tests/checks/coordinator- tests/structure/coordinator- tests/golden/coordinator.test.ts tests/types/coordinator.type-test.ts` | 319 pass, 0 fail |
| `bun test tests/behaviour/status* brief* blockers* tests/golden` | 1012 pass, 2 skip, 0 fail |
| `bun test tests/structure/content-inventory inventory state-contract config-contract daemon-contract coordinator-imports coordinator-no-cpu coordinator-kill-target coordinator-regime cli-edge-seam state-scope` | 80 pass, 0 fail |
| `bun test tests/checks/coordinator-determinism coordinator-privacy coordinator-mutants exit-code-literals error-table-sync secret-read-boundary` | 154 pass, 0 fail |
| `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` | 179 pass, 0 fail; allowlist copies equal (38/38); identity table 121 asserted |
| `pnpm exec tsc -p tsconfig.json --noEmit` / `-p tests/types/tsconfig.json --noEmit` | clean / clean |
| `pnpm exec depcruise packages` | no violations (370 modules, 1086 deps) |
| `pnpm lint` / `pnpm format:check` | exit 0 (62 pre-existing warnings / clean) |
| `bun run scripts/checks/{ambient-globals,forbidden-literals,privacy-literals,secret-read-boundary,exports-parity,prompt-conformance,workspace-entrypoints}.ts` | all exit 0 |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 ("no drift — 81 in-scope docs") |
| **`bun run scripts/checks/help-guide-coverage.ts` (`pnpm check:help`)** | **exit 1 — `coordinator: … coordinator.md lacks --version` (NF-01)** |
| `git diff --check origin/main-tools...HEAD` | clean |
| `bun test tests/checks/ci-baseline-parity.test.ts` | fails `EXDEV` on `git clone --local` in `/tmp` (different filesystem); reproduces at `dbbc62cf` — environmental, not a code defect |

Notes: a full `bun test` was started but not completed within the review window (it runs long, git-worktree/closeout integration suites); the targeted coordinator, status/brief/blockers/golden, structure, and checks suites above cover every changed surface. `biome check` (not part of `pnpm check`) reports one `organizeImports` assist in `coordinator.ts` (NF-06).

---

## Recommendation

**FAIL — one small blocking fix, then re-review (or a targeted re-run).**

1. **NF-01 (blocking):** add the mandatory `--version` help section to `doc/planning/oss-tooling/milestones/m1/commands/coordinator.md` so `pnpm check:help` / `pnpm check` passes. This is a documentation-only change.
2. **NF-02:** declare `doc/spec/features/feature-agents-and-commands.md` in a phase scope and correct the Phase-11 "0 uncovered / 185 paths" claim.
3. **NF-04 (recommended):** select the wake effect from post-lifecycle session facts (or skip the duplicate effect) so a non-live-session pickup does not resume/spawn twice in production; add a test that can observe the effect.
4. **NF-03:** avoid the second verified read in `escalate()` (thread the cycle read through), or scope NFR-4 explicitly and test the escalation path.
5. **NF-05 / NF-06:** align the test-plan version references and reorder the two imports.

On substance, the remediation meets the iteration-1 bar: all four reproduced defects are closed with integrated tests, the command family is genuinely shipped, the production identity capability exists, the error gate is exact, and no delivered surface regressed. The only reason the change cannot ship as-is is the help/guide conformance gate (NF-01), plus the minor traceability/robustness residuals above.
