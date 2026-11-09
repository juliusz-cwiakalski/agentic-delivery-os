# Code Review — GH-241 "M1-S23: Coordinator supervision" (iteration 3)

- **Review mode:** local (ADOS pipeline), re-review after iteration-2 remediation
- **Work item:** GH-241
- **Branch:** `feat/GH-241/coordinator-supervision` @ `329d3c0e` (35 commits)
- **Base:** `origin/main-tools` @ `dbbc62cf` (merge-base; linear; working tree clean)
- **Change folder:** `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/`
- **Artifacts reviewed:** `chg-GH-241-spec.md` v1.6, `chg-GH-241-test-plan.md` (revision 1.6), `chg-GH-241-plan.yaml` (revision 1.7), `chg-GH-241-pm-notes.yaml`, `review/review-iter-1.md`, `review/review-iter-2.md`, `doc/planning/oss-tooling/milestones/m1/commands/coordinator.md`, the reconciled current-truth docs, and the two remediation commits `1a7a98c8`, `329d3c0e`.
- **Review date:** 2026-11-09
- **Reviewed by:** reviewer agent (local mode)

## Status: **PASS**

The iteration-2 remediation is correct, minimal, and — critically — **each fix is proven by a test that I verified fails against the pre-fix implementation**. The four changed source lines and two changed tests do exactly what the iteration-2 report asked and nothing more:

- **NF-01 (was blocking)** — the coordinator command page now carries the standard `## HELP` paragraph (root `<binary> --help`/`--version`), byte-identical to every other prompt-required page; `bun run scripts/checks/help-guide-coverage.ts` (`pnpm check:help`) is green. `--version` is root-only for *every* command (`coordinator`, `status`, `blockers`, `brief`, `dispatch`, `plan` all return `unknown flag "--version"` at the subcommand level), so the page matches the established convention exactly.
- **NF-04** — `applyRecovery` now returns `appliedRecovery`, and the wake effect is `live` whenever the lifecycle already applied a recovery, so a non-live-session pickup performs exactly one resume/spawn per cycle. I reproduced the pre-fix failure in a scratch worktree: with the old one-line `wakeEffectFor(session)` the new test fails with `effect="resume"`/`"spawn"` instead of `"live"`; with the fix it passes.
- **NF-03** — `escalate()` folds from `context.raw` (the cycle's single verified read), so an exhaustion tick performs one evaluation read. Pre-fix (`readOnce()` in `escalate`) the new test measured 2 evaluation reads; with the fix, 1.
- **NF-06** — `biome check` is clean on `coordinator.ts`/`coordinator-loop.ts`.
- **NF-02** — `doc/spec/features/feature-agents-and-commands.md` is declared on Phase 10; re-deriving the plan scopes against the live diff gives **0 uncovered and 0 unused specific files**.
- **NF-05** — the test plan is realigned to specification v1.6 and §8.5 records the readiness/review history without claiming unverified closures.

No regression: all iteration-1/2 closures still hold, all 320 coordinator tests pass (up from 319 — the new read-cost test), the delivered status/brief/blockers/golden suites pass (1191 pass, 2 skip), `tsc` (root + tests/types), `depcruise`, `pnpm lint`, `pnpm format:check`, the eight runnable conformance scripts, and the doc-distribution guard are all green. `plan validate GH-241` is valid/ready with 11 phases; the TC map is 76/76 and 50/50 ACs are covered. `contracts/state.ts`, `ceo-loop.sh`, and the brief contract/domain are unchanged.

Prior iteration-2 findings: **6/6 CLOSED (NF-01…NF-06)**. Iteration-1 findings: **F-01…F-20 still CLOSED; F-18 now CLOSED** (was PARTIAL). New findings: **1 minor (NF-07, non-blocking, test-traceability)**. AC matrix: **49 PASS, 1 PARTIAL (AC-F7-4, by design), 0 FAIL**.

---

## Iteration-2 finding disposition (NF-01 … NF-06)

Every disposition was re-derived from the current tree and by running the gates, not from the remediation prose.

| ID | Verdict | Evidence |
|---|---|---|
| **NF-01** (blocking) `pnpm check:help` | **CLOSED** | `doc/planning/oss-tooling/milestones/m1/commands/coordinator.md:74-80` now has the standard `## HELP` paragraph (`Root <binary> --help and <binary> --version are self-description only…`), textually identical to `status.md`/`blockers.md`. `bun run scripts/checks/help-guide-coverage.ts` → `help-guide-coverage: all prompt-required commands covered`, exit 0. Runtime: `coordinator --help` prints usage; `coordinator --version` → `delivery-os: unknown flag "--version"`, exactly as `status`/`blockers`/`brief`/`dispatch`/`plan` do — so `--version` is a root-only flag for every command, and the page's root-`--version` wording matches the convention. `coordinator` stays in `PROMPT_REQUIRED_COMMANDS` (`prompt-required-commands.ts:27`) and the coverage inventory. |
| **NF-02** (minor) plan scope | **CLOSED** | `chg-GH-241-plan.yaml:1179` declares `doc/spec/features/feature-agents-and-commands.md` on Phase 10 (with an explanatory v1.7 revision note at :89-95). Re-derivation with glob semantics over `git diff --name-only origin/main-tools...HEAD` (188 changed paths, including the committed `review-iter-2.md` which sits inside the declared change folder): **0 uncovered, 0 unused specific files** (the 6 no-glob entries that did not change are directory declarations, not files). The Phase-11 prose anchors its count to the `b8fa311a` snapshot honestly ("Fidelity re-derived at b8fa311a … 187 changed paths, 0 uncovered, 0 declared-but-unchanged specific files", `:1292-1294`); see INFO-01. |
| **NF-03** (minor) second read | **CLOSED** | `coordinator-loop.ts:786-789` — `escalate()` uses `const raw = context.raw;` (the cycle's single verified read) instead of `readOnce()`. `tests/behaviour/coordinator-read-cost.test.ts:24-36` asserts one evaluation read on an exhaustion tick. **Pre-fix reproduction (scratch worktree):** reverting `context.raw` → `readOnce()` makes the test measure `2` evaluation reads and fail; with the fix it is `1`. The reused ledger stays safe because `appendBlockerQuestion`/`appendRecord` enforce `expectedRecordCount` optimistically, so a concurrent blocker append fails closed rather than double-publishing (`state/blockers.ts:428-447`). |
| **NF-04** (medium) double resume/spawn | **CLOSED** | `applyRecovery` now returns `appliedRecovery` (`coordinator-loop.ts:633-683`), `applyLifecycle` propagates it on every branch (`:692-773`), and the wake effect is `lifecycle.appliedRecovery === null ? wakeEffectFor(session) : "live"` (`:944-945`). Production `runSessionEffect` sets `coordinatorHandle`, and `readCoordinatorSession` then reports `liveness: "alive"` (`production.ts:1165-1179,1238-1291`), so `wake("live")` is a no-op (`production.ts:1331-1332`) — no second resume/spawn. `tests/behaviour/coordinator-wake-paths.test.ts` now uses an `applyMakesAlive` fixture (which models the production handle becoming alive) and asserts `data.wake.effect === "live"`, `harness.session.wakeEffects === ["live"]`, and `resumes+spawns == 1` after tick 1 and tick 2. **Pre-fix reproduction (scratch worktree):** with `const effect = wakeEffectFor(session)` the two non-live tests fail with `Received: "resume"` / `"spawn"`; with the fix they pass. |
| **NF-05** (nit) version drift | **CLOSED** | Test plan front-matter `summary`/`last_updated` and §1 now say specification **v1.6**; `[PINNED — v1.6 observables]` and every per-TC "pinned by (spec v1.6)" note are v1.6. New **§8.5 Readiness and Review Disposition Register** (`chg-GH-241-test-plan.md:2865-2915`) records DoR 1-5 and code-review 1-2 with iteration 2 marked **"remediated, pending re-review"** and states "no closure that the review reports have not verified." No stale v1.4 alignment stamp remains. |
| **NF-06** (nit) import order | **CLOSED** | `pnpm exec biome check packages/cli/src/commands/coordinator.ts packages/cli/src/commands/coordinator-loop.ts` → `Checked 2 files … No fixes applied`, exit 0. `coordinator.ts:9-10` now orders the type import before the value import as the organizer wants. |

---

## New findings

Severity: `critical` (data loss / security / correctness bug) · `major` (blocks the delivered surface or a repo gate) · `medium` (robustness / latent production defect) · `minor` (quality / traceability) · `nit` (style).

| ID | Severity | Location | Issue | Suggested action |
|---|---|---|---|---|
| **NF-07** | **minor (non-blocking, test-traceability)** | `tests/behaviour/coordinator-wake-paths.test.ts`; TC-COORD-073 (`chg-GH-241-test-plan.md:327`, `:2683`) | After the NF-04 rewrite, TC-COORD-073 is still titled "The wake uses the live/resume/spawn path", but every integrated assertion now checks only the `live` effect (`data.wake.effect === "live"`, `wakeEffects === ["live"]`). The `wakeEffectFor(...)` resume/spawn branch is now reachable only when the lifecycle applied **no** recovery yet the session is non-live — i.e. an already-receipted exhaustion tick with a top pickup question, or an idempotent-replay append that applied nothing (`coordinator-loop.ts:944-945`, `:786-789`). That branch is correct but is not exercised by any test, so the AC-F7-1 "resume"/"spawn" wake-effect selection lost its integrated proof (it did exist pre-NF-04). | Either add one integrated test driving the already-receipted-exhaustion + pickup path and asserting a `resume`/`spawn` wake effect (the fixture's `wake` records the effect), or narrow the TC-COORD-073 title/traceability to "the wake observes live after a same-cycle lifecycle recovery". The single-recovery property itself is already strongly proven. |
| **INFO-01** | info | `chg-GH-241-plan.yaml:1292-1294`, `:98` | The plan's fidelity claim states "187 changed paths" as re-derived at `b8fa311a`. The live `origin/main-tools...HEAD` diff is now 188 because `review/review-iter-2.md` was committed afterwards (and becomes 189 with this report). The substantive claims (**0 uncovered, 0 unused specific files**) hold on the live tree — re-verified — so this is a point-in-time snapshot, not a defect. | None required. If a reviewer wants precision, the prose could say "187 at b8fa311a (plus later review artifacts, which fall inside the declared change folder)". |

No critical / major / medium findings. NF-07 is a test-traceability refinement on a *correct* branch and does not block shipping.

---

## Iteration-1 finding regression re-check (F-01 … F-21)

All remain closed; the relevant suites were re-run and pass. Compact confirmation (full evidence in `review-iter-2.md`):

| ID | Verdict | Current-tree evidence |
|---|---|---|
| F-01 shipped composition | CLOSED | Real `bun packages/cli/bin/delivery-os.ts coordinator status --json` → `delivery.coordinator.v1`, exit 0; `coordinator --help` prints the family; `coordinator` in `PROMPT_REQUIRED_COMMANDS`; `coordinator-production-composition`/`-production-session` pass. |
| F-02 fresh-budget durability | CLOSED | `coordinator-fresh-budget.test.ts` "the fresh epoch survives a later status, tick, and start (F-02 durability)" passes. |
| F-03 start receipt / instance | CLOSED | `coordinator-start.test.ts` "a fresh start … reports the instance" and "the human start receipt renders the terminal stopped/released result" pass. |
| F-04 per-cycle no-pickup | CLOSED | `coordinator-wake-answered` "an answered question never ranks, so the tick reports no wake"; `coordinator-tick` no-pickup assertions pass. |
| F-05 join-live on collection | CLOSED | `coordinator-tick` / `coordinator-foreground-loop` join-live iteration assertions pass. |
| F-06 production `startTimeMs` | CLOSED | `coordinator-kill-grace` exercises the real `/proc` port; composition declares `startTimeIdentity` by method presence. |
| F-07 question `historyRef` | CLOSED | `coordinator-escalation-publish` asserts `escalation[0].historyRef === "coordinator/coordinator-main"`. |
| F-08 explicit wake effect | CLOSED | Effect selected/reported; `coordinator-wake-paths` passes (see NF-04 / NF-07 for the post-fix coverage nuance). |
| F-09 refusal `historyRef` | CLOSED | `coordinator-restart-exhausted` asserts the summary reference. |
| F-10 positive `--live` facts | CLOSED | `coordinator-status` positive `{alive,startTimeVerified,leaseAgeMs}` + `live-facts-unknown`. |
| F-11 iteration-reason vocabulary | CLOSED | Spec v1.6 EVT-1/Appendix B list `live-session`/`expectation`; `COORDINATOR_ITERATION_REASONS` matches. |
| F-12 no duplicate escalation | CLOSED | `coordinator-escalation-reuse` "an answered escalation never publishes a second question (F-12)" passes. |
| F-13 stop race | CLOSED | Instance-id match guard; `coordinator-foreground-loop` replaced-holder race test. |
| F-14 crash window | CLOSED | Documented and tested (`coordinator-restart-durability`). |
| F-15 session pair | CLOSED (with note) | `sessionId: null` + `previousSessionId` = replaced; documented. |
| F-16 status cap drift | CLOSED | `STATUS_MAX_ITEMS_PER_SECTION` passed explicitly. |
| F-17 expectation cursor/sequence | CLOSED | Ledger-sequence expectation, post-append fingerprint. |
| **F-18 plan scope fidelity** | **CLOSED (was PARTIAL)** | 0 uncovered / 0 unused specific files on the live diff; `feature-agents-and-commands.md` now declared (NF-02). |
| F-19 test-proof strength | CLOSED | Stale-fence same-store recovery, same-state wake retry, release-busy, integrated join-live, fresh-budget durability, no-pickup after wake, non-null start instance — all present and passing. |
| F-20 nit set | CLOSED | Contract prefix imported, `appendFence` reused, `assertNever`, `q-escalation-…`; `biome check` clean (NF-06). |
| F-21 digest-change expectation | CLOSED | `coordinator-expectation-refresh` proves one refresh on an external record. |

---

## Acceptance-criteria matrix (all 50)

Status key: **PASS** = observable satisfied and tested; **PARTIAL** = main observable satisfied but a pinned clause proven only at a narrower level; **FAIL** = pinned observable not met.

### 17.1 Supervision process and command family

| AC | Status | Evidence / note |
|---|---|---|
| AC-F1-1 | PASS | Family composed and reachable; one `acquired` with holder/supervisorMode/externalUnit; second start refused (holder named); bare start `fallback.invocation` exit 1; `status` reports the instance. Terminal `start` receipt reports the acquisition instance. `coordinator-start`, `-production-composition`. |
| AC-F1-2 | PASS | Tick claims, one bounded cycle, one `released` in `finally`, `delivery.coordinator.v1`, no loop, one verified read, quiet cycle = lease pair. `coordinator-tick`, `-read-cost`. |
| AC-F1-3 | PASS | `stop` appends `stop-requested`; `not-running` degradation; capability gap on undeclared alive; never releases another handle. `coordinator-stop`, `-lease-liveness`. |
| AC-F1-4 | PASS | Instance folded from latest lease by ledger order; `startedAt` = acquisition record; no instance record kind. `coordinator-instance-lease`. |
| AC-F1-5 | PASS | One acquisition + one `released` for N boundaries; stop/fatal/signal exits typed; `released` attempted in `finally`. `coordinator-foreground-loop`. |
| AC-F9-1 | PASS | Status reports all fields, `tickVerdict=null`, never mutates/evaluates; `--live` positive facts or `live-facts-unknown`. `coordinator-status`. |

### 17.2 Join-or-resume-or-spawn decision

| AC | Status | Evidence |
|---|---|---|
| AC-F2-1 | PASS | `join-live` recorded on every evaluation (collection included), excluded from the expectation fold. `coordinator-tick`, `-decision-join`. |
| AC-F2-2 | PASS | `resume-context` for unclean/resumable/below-limit/declared resume; one ordinal; resume effect. `-decision-resume`, `-production-session`. |
| AC-F2-3 | PASS | `spawn-fresh` with `context-pressure`/`context-unknown`/`session-interrupted`; one ordinal. `-decision-spawn`, `-capability-gap`. |
| AC-F2-4 | PASS | Killed mid-iteration resumes/respawns without re-executing closed-out artifacts. `-decision-recovery`. |
| AC-F2-5 | PASS | Decision and ordinal survive a reopened store. `-decision-durability`. |
| AC-F2-6 | PASS | `initial-start`/`clean-iteration-end` consume zero. `-decision-spawn`. |

### 17.3 Artifact-evidence stuck detection

| AC | Status | Evidence |
|---|---|---|
| AC-F3-1 | PASS | `stuck` verdict with `stuck-artifact-evidence`, `phase=verdict`, `killOutcome=not-attempted`, bounded evidence; fingerprint = record cursor + open coordinator questions. `-stuck-verdict/-matrix/-fingerprint`. |
| AC-F3-2 | PASS | Positive sourced progress inside `progress-bound` vetoes. `-stuck-corroborator`. |
| AC-F3-3 | PASS | Unknown/absent → `unknown`; all-unknown/unreadable → `unevaluable`, one verdict, no kill, exit 2. `-stuck-unknown/-unevaluable`. |
| AC-F3-4 | PASS | Two evaluations byte-identical; no CPU read. `-stuck-*`, `-no-cpu`. |

### 17.4 Kill with grace

| AC | Status | Evidence |
|---|---|---|
| AC-F4-1 | PASS | PID + start-time verified through the real node port; TERM, grace, conditional SIGKILL; two-phase record. `-kill-grace`, `-kill-fence`. |
| AC-F4-2 | PASS | Failed kill → `phase=outcome` `failed`, `coordinator.session.kill-failed` exit 2, no retry loop. `-kill-failed`. |
| AC-F4-3 | PASS | Target is the recorded pid; no name/pattern/shell. `-kill-target` + structure scan. |
| AC-F4-4 | PASS | Mismatch sends no signal, `killFailureReason=identity-mismatch`, exit 2. `-kill-identity`. |

### 17.5 Restart budget

| AC | Status | Evidence |
|---|---|---|
| AC-F5-1 | PASS | Records under `coordinator/<coordinatorId>`. `-restart-namespace`. |
| AC-F5-2 | PASS | Below bound appends the next contiguous ordinal. `-restart-admit`. |
| AC-F5-3 | PASS | At/above bound: no replacement, exit 1, history reference on the failure summary, escalation runs. `-restart-exhausted`. |
| AC-F5-4 | PASS | Reopened store keeps count/bound; replay appends nothing; duplicate ordinal → torn. `-restart-durability`. |
| AC-F5-5 | PASS | `--fresh-budget` durable epoch on the lease carrier; later `status`/`tick`/`start` observe it. `-fresh-budget`. |

### 17.6 Exhaustion escalation

| AC | Status | Evidence |
|---|---|---|
| AC-F6-1 | PASS | One owner `decision-needed` question, `ref=<id>#<epoch>`, count/bound/`historyRef`/options, reserved render-first in digest and brief, seven others, lowest displaced. `-escalation-publish/-slot/-surface`, goldens. |
| AC-F6-2 | PASS | Publish failure → exit 2 `coordinator.escalation.publish-failed`, no receipt; one-shot stale recovery before the append. `-escalation-failed`. |
| AC-F6-3 | PASS | Repeated exhausted tick reuses the open/answered question, no second receipt, exit 0 `exhausted-escalated`. `-escalation-idempotent/-reuse`. |

### 17.7 Wake-on-typed-question

| AC | Status | Evidence |
|---|---|---|
| AC-F7-1 | PASS | Strict pickup wakes within one cycle; a non-live session is resumed/spawned once by the lifecycle and the wake reports `live` (NF-04); one `woken` record with `askedAt`. `-wake-pickup/-paths`. (Post-fix the `resume`/`spawn` *wake-effect value* branch is unasserted — NF-07, test-traceability only.) |
| AC-F7-2 | PASS | Still-top already-woken appends nothing; dedupe on coordinator+question+`askedAt`. `-wake-dedupe`. |
| AC-F7-3 | PASS | Owner head / non-open / no question → `no-pickup`, null question, no record; absent status counts as open. `-wake-pickup/-wake-answered`. |
| AC-F7-4 | **PARTIAL** | The pure `evaluateWake` returns `answered-before-wake` with no persistence (`-wake-answered` domain test), but the integrated tick uses one verified snapshot, so a question answered before the cycle is `no-pickup` (AC-F7-3) and `answered-before-wake` is unreachable through the command. Proof is domain-level, not end-to-end — an intrinsic consequence of the single-read rule; kept PARTIAL by design in test-plan §8.5. |
| AC-F7-5 | PASS | Delivery failure → `coordinator.wake.delivery-failed` exit 2, no record, released lease; same-state retry appends exactly one later. `-wake-failed`. |
| AC-F7-6 | PASS | New top question after an answer wakes normally. `-wake-next`. |

### 17.8 Supervisor regime and single-instance lease

| AC | Status | Evidence |
|---|---|---|
| AC-F8-1 | PASS | Live holder refused regardless of age; declared-unanswered held until 2×interval; undeclared → capability gap; separate state dirs independent. `-lease-liveness`, `-claim-capability-gap`. |
| AC-F8-2 | PASS | Regime descriptor complete; bare start refused; no installer. `-regime`. |
| AC-F8-3 | PASS | Dead/aged-unknown → one `stale-takeover`, no second `acquired`. `-lease-liveness`, `-fence-records`. |
| AC-F8-4 | PASS | Live old holder refused; `stop` requests; next boundary releases. `-lease-liveness`, `-foreground-loop`. |
| AC-F8-5 | PASS | Both non-blocking interleavings yield exactly one acquisition and one `already-running`. `-claim-race`, `-claim-serialized`. |
| AC-F8-6 | PASS | `tick` takes over a crashed holder, one cycle, releases. `-tick-takeover`. |
| AC-F8-7 | PASS | Stale fence → one `recoverFence` + one retry; non-stale still-busy → `already-running`/`state.lock.busy`. `-claim-stale-fence`, `-state-fence-recovery`, `-foreground-loop`. |

### 17.9 Configuration, state, and error contracts

| AC | Status | Evidence |
|---|---|---|
| AC-F10-1 | PASS | Six keys/defaults/domains validated by `resolveCoordinatorSettings`; shipped surface resolves them; no decision-code literals. `-config`, `-budget-config`, production composition. |
| AC-F10-2 | PASS | `coordinator` domain kind and six rows; `{0,1,2}`; allowlist 38 (both copies byte-equal); identity table 121. `error-table.test`, `error-table-sync`. |
| AC-F10-3 | PASS | Torn/unknown → state identity exit 2; gapped ordinals unevaluable; claim busy → `already-running`; non-claim busy → `state.lock.busy`; failed append → `state.write.failed`. `-records`, `-ordinals`, `-fence-records`, `-state-fence-recovery`. |
| AC-F10-4 | PASS | Missing alive/kill/start-time → `coordinator.process.capability-gap` exit 2; harness resume absence → spawn-fresh; harness spawn refusal → `harness.spawn.refused`; absent progress → `unknown`. `-capability-gap`, `-claim-capability-gap`, `-kill-*`. |
| AC-F10-5 | PASS | Appendix A map has an AC trace per `ceo-loop.sh` function (TC-090 manual trace). |

### 17.10 Non-functional acceptance

| AC | Status | Evidence |
|---|---|---|
| AC-NFR-1 | PASS | Two identical ticks append only lease pairs; repeated stuck/wake/stop do not duplicate. `-idempotency`, `-scenario`. |
| AC-NFR-2 | PASS | No prompt/transcript/secret in records; evidence ≤512 bytes `key=value`. `-privacy`. |
| AC-NFR-3 | PASS | No model call, no CPU read. `-determinism`, `-no-cpu`. |
| AC-NFR-4 | PASS | tick/status p95 within bounds; ≤64 KiB data; ≤32 human lines; **and now exactly one verified evaluation read per tick including the exhaustion/escalation path** (NF-03 fixed; `-performance`, `-read-cost`). |

**Matrix tally:** PASS 49 · PARTIAL 1 (AC-F7-4, by design) · FAIL 0.

---

## Residual-limitation adjudication

All declared production limitations are real, documented as current truth in `doc/spec/features/feature-coordinator-supervision.md` §3/§5, fail-closed, and not overclaimed. Re-checked at `329d3c0e`.

| Limitation | Delivered behaviour | Documentation | Verdict |
|---|---|---|---|
| No total context-token source | `readCoordinatorSession` returns `contextTokens: null`; an unclean recorded session records `spawn-fresh` reason `context-unknown`; `resume-context` unreachable in production. | `feature-coordinator-supervision.md:172-176`; `coordinator-production-session` "absent context count spawns fresh". | **ACCEPT** — disclosed and tested. |
| No durable coordinator session identity | Session facts fall back to the newest recorded daemon lane row; a later invocation with no row starts fresh and consumes one ordinal. | `:177-181`. | **ACCEPT** — disclosed; operational consequence implied. |
| No pid on a spawned handle | `HarnessSessionHandle` carries no pid; kill-with-grace reports the process capability gap rather than signalling an unverified pid. | `:182-185`; `production.ts:1286-1288`. | **ACCEPT** — fail-closed and documented. |
| No sourced progress reading | New-turn fact is `unknown`; the `progress-bound` veto cannot fire in production; only a merge/answer advance keeps a cycle out of the stuck window. | `:186-189, 217-227`. | **ACCEPT** — disclosed; conservative (unknown never counts as stale). |
| claude-code resume absent | Adapter returns `harness.capability.gap`; the decision selects spawn-fresh. | `:191-192`; `coordinator-production-session` claude resume test. | **ACCEPT** — disclosed and tested. |
| Start-time identity is Linux-only | `startTimeMs` parses `/proc/<pid>/stat` + `/proc/stat btime`; off Linux it yields no reading → `identity-mismatch`/capability-gap, fail-closed. | `:242-246`; `feature-harness-adapters.md:167-170`. | **ACCEPT** — fail-closed and documented. Carry-forward (from iteration-2): the **claim-time** consequence on non-Linux (`ownIdentity()` null → `coordinator.process.capability-gap`) could be stated more plainly; non-blocking doc nit. |

---

## Plan / test-plan / spec compliance

- **`plan validate GH-241 --json`** → `verdict=valid`, `readyForDevelopment=true`, **11 phases**.
- **Plan scope fidelity (F-18):** re-derived with glob semantics from `chg-GH-241-plan.yaml` against the live `git diff --name-only origin/main-tools...HEAD` (188 paths) → **0 uncovered, 0 unused specific files** (6 no-glob entries are folder declarations). 154 declared specific files all present at `b8fa311a`; the only scope edit in v1.7 is the Phase-10 `feature-agents-and-commands.md` declaration.
- **`plan diff` limitation:** the production `plan.readDiff` is an unconfigured fallback (`{ok:false}`) at base, so `plan diff` fails `input.value.rejected`; this is **pre-existing at `dbbc62cf`**, not a regression. Scope was verified by direct comparison instead.
- **TC coverage:** 76 distinct `TC-COORD-*` ids in the test plan and 76 in the plan; **76/76** mapped. **50 ACs**, all covered. TC-COORD-073's title still says "live/resume/spawn" while the resume/spawn wake-effect branch is no longer asserted — NF-07 (traceability, non-blocking).
- **Spec compliance:** v1.6 carries the iteration-1/2 amendments (durable epoch, escalation `historyRef`, wake effect, bounded `--live`, command page, closed iteration-reason set). The iteration-2 prose nit ("a quiet cycle grows the log by no records") is corrected to "…exactly this lease pair and **no action record**" (`chg-GH-241-spec.md:305`, AC-F1-2), consistent with the recorded `join-live` iteration.
- **pm-notes:** delivery/system_spec_update completed; `review_fix`/`quality_gates`/`dod_check`/`pr_creation` still open (expected mid-remediation). Per-phase delivery completion evidence (commit hash + test result) remains a `dod_check` (`@pm`) artifact concern, not a code/contract gate — not scored here.

---

## What is solid (for balance)

- **Each iteration-2 fix is minimal and machine-verified, and its new test is a genuine discriminator** — I confirmed empirically that the NF-03 and NF-04 tests fail against the pre-fix code and pass with the fix, so they are not vacuous.
- **The NF-04 fixture now models the production handle** (`applyMakesAlive`), so the "exactly one resume/spawn per cycle" assertion is faithful to `runSessionEffect` setting `coordinatorHandle` and subsequent reads reporting `alive`.
- **The NF-03 read reuse is fail-closed** — the escalation append keeps optimistic `expectedRecordCount`, so a concurrent blocker append cannot double-publish.
- **The help page matches the repo convention exactly** and the runtime confirms `--version` is root-only for every command.
- **No regression:** 320 coordinator tests pass; 1191 delivered status/brief/blockers/golden/error-table tests pass (2 skip); `tsc` (root + tests/types), `depcruise` (370 modules), `pnpm lint`, `pnpm format:check`, the eight runnable conformance scripts, and the doc-distribution guard are green; `contracts/state.ts`, `ceo-loop.sh`, and brief contract/domain unchanged; working tree clean; `findings`/diffs linear.
- **Honest artifacts:** test-plan §8.5 and the plan explicitly avoid claiming unverified closures and anchor point-in-time counts.

---

## Verification performed

All commands run from the repo root at `329d3c0e` (working tree clean). The two "pre-fix reproduction" rows were run in a throwaway `git worktree` at `HEAD` with only the specific fix reverted, then removed; the deliverable tree was never modified.

| Command | Result |
|---|---|
| `git status --porcelain` / `git rev-parse HEAD` / `git rev-list --count origin/main-tools..HEAD` / merge-base | clean; `329d3c0e`; 35 commits; base `dbbc62cf`; linear |
| `git diff --shortstat origin/main-tools...HEAD` | 188 files, +24 517 / −86 |
| **`bun run scripts/checks/help-guide-coverage.ts`** | **exit 0 — "all prompt-required commands covered"** |
| `bun packages/cli/bin/delivery-os.ts coordinator --help` | prints usage/options/exit codes/see-also, exit 0 |
| `bun packages/cli/bin/delivery-os.ts coordinator status --json` | `delivery.coordinator.v1`, exit 0 |
| `bun packages/cli/bin/delivery-os.ts coordinator --version` | `delivery-os: unknown flag "--version"` (root-only — same as `status`/`blockers`/`brief`/`dispatch`/`plan`) |
| `bun packages/cli/bin/delivery-os.ts plan validate GH-241 --json` | `verdict=valid`, `readyForDevelopment=true`, 11 phases |
| Plan-scope glob re-derivation (YAML scopes vs `git diff --name-only origin/main-tools...HEAD`) | 188 changed, **0 uncovered, 0 unused specific files** |
| Distinct `TC-COORD-*` ids / ACs in spec | 76 in test plan, 76 in plan; 50 ACs |
| `bun test tests/behaviour/coordinator- tests/checks/coordinator- tests/structure/coordinator- tests/golden/coordinator.test.ts tests/types/coordinator.type-test.ts` | **320 pass, 0 fail** |
| `bun test tests/behaviour/status tests/behaviour/brief tests/behaviour/blockers tests/golden tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` | **1191 pass, 2 skip, 0 fail** |
| `bun test tests/behaviour/coordinator-wake-paths.test.ts tests/behaviour/coordinator-read-cost.test.ts` | 9 pass, 0 fail |
| **Pre-fix reproduction — NF-04:** worktree `HEAD` + revert wake-effect line, run `coordinator-wake-paths.test.ts` | **2 fail** (`Received: "resume"` / `"spawn"` vs expected `"live"`); with fix 4/4 pass |
| **Pre-fix reproduction — NF-03:** worktree `HEAD` + revert `escalate` to `readOnce()`, run `coordinator-read-cost.test.ts` | **1 fail** (`evaluationReads` delta `2` vs expected `1`); with fix 5/5 pass |
| `pnpm exec tsc -p tsconfig.json --noEmit` / `-p tests/types/tsconfig.json --noEmit` | clean / clean |
| `pnpm exec depcruise packages` | no violations (370 modules, 1086 deps) |
| `pnpm lint` / `pnpm format:check` | exit 0 (62 pre-existing warnings) / exit 0 |
| `pnpm exec biome check packages/cli/src/commands/coordinator.ts commands/coordinator-loop.ts` | No fixes applied, exit 0 |
| `bun run scripts/checks/{ambient-globals,forbidden-literals,privacy-literals,secret-read-boundary,exports-parity,prompt-conformance,workspace-entrypoints,help-guide-coverage}.ts` | all exit 0 |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 ("no drift — 81 in-scope docs") |
| `git diff --name-only origin/main-tools...HEAD -- packages/core/src/contracts/state.ts scripts/ceo-loop.sh tools/ceo-loop.sh contracts/brief.ts domain/brief.ts` | empty — unchanged |
| `bun test tests/checks/ci-baseline-parity.test.ts` | fails `EXDEV` on `git clone --local` into `/tmp` (cross-device link); environmental, reproduces at `dbbc62cf`, not a code defect |

Note: a full `bun test` (whole repo, incl. git-worktree/closeout integration suites) was not run to completion within the review window; the targeted coordinator, delivered status/brief/blockers/golden/error-table, structure, and checks suites above cover every changed surface and the four reproduced defects.

---

## Recommendation

**PASS — the change can ship as-is.** `pnpm check:help` / `pnpm check` is no longer blocked (NF-01), and the other five iteration-2 findings are closed with machine-verified evidence. All four iteration-1 reproduced defects and every iteration-2 closure remain intact; no gate regressed.

Non-blocking follow-ups (optional, do not gate the merge):

1. **NF-07 (minor):** add one integrated test for the `resume`/`spawn` wake-effect branch (already-receipted exhaustion + pickup) or narrow the TC-COORD-073 title so the traceability matches the assertions.
2. **Residual doc nit (carry-forward):** state plainly that supervision requires a readable own start time (Linux reference host), so non-Linux claims fail closed at `coordinator.process.capability-gap`.
