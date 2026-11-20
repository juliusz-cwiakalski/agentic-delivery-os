---
id: TDR-0056
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "The `loop` family (start/stop/status/log/reset) is a second composition profile over the delivered supervision engine's primitives under the distinct supervisor identity `loop-main` — the append-only instance lease over `coordinator.fence` (acquired/released/stale-takeover, liveness-first stale takeover, a live holder refused `coordinator.already-running`), the per-epoch restart budget over `coordinator.restart` with `evaluateCoordinatorRestartAdmission` counting only stuck restarts, the two-phase `coordinator.stuck` verdict/outcome pair with `foldCoordinatorStuck`, identity-verified kill-with-grace through `killCoordinatorProcess` (pid plus start time) and the delivered harness `terminate`, the six `coordinator.*` configuration keys unchanged, and `readCoordinatorRecords(store, loopId)` as the loop's verified read whose per-identity key scoping proves a second identity's records are skipped rather than rejected; it deliberately does not reuse `createCoordinatorSupervisor`'s delivery-expectation cycle, the artifact-evidence predicate `evaluateStuck`, `decideLifecycle`/`coordinator.iteration`, or `coordinator.exhaustion`, because a CEO blocked on a healthy, progressing delivery is not stuck (INV-DM-3/5); the loop owns one pure stuck predicate over sourced session progress, artifact advance, and a readable healthy-delivery corroborator read from the delivered `dispatch.lane`/`daemon.lane` records, and adds exactly two record kinds (`loop.session`, `loop.stop`) plus one additive optional spawned-session pid fact, while no coordinator module is modified and the coordinator family's behaviour is unchanged."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os supervision (CEO outer loop, instance lease, stuck detection, restart budget)"
decision_scope: repo
review_date: null
customer_impact: "Mode A's outer loop becomes a typed operator surface over the already-delivered supervision engine, so a stuck CEO is still restarted within the same budget and the same shell-tested stuck definition, while a CEO blocked on a healthy delivery is still never killed."
classification:
  domains: [architecture, contracts, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-348: clarify-scope recorded the coordinator/loop duplication risk and routed it here, alongside the flip plan's F3 target 'jaiship loop (over the delivered supervision engine)')"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-348 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (GH-348 scope: the `loop` verb set, the reuse mandate, the F3 verification bar)"
    - "@decision-advisor (the reused/not-reused surface split, the stuck-predicate analysis, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-348 PR review — this record fixes which engine semantics the CEO loop inherits and which it deliberately does not)"
  performers:
    - "@coder (GH-348: the loop family, the loop-local predicate, the two record kinds, the additive pid fact, the parity battery)"
    - "@doc-syncer (GH-348 documentation phase: the new loop page and the coordinator-supervision reconciliation)"
  informed:
    - "Operators switching from `ceo-loop.sh` to `jaiship loop` (same stuck definition, same restart budget, different stop carrier)"
    - "The coordinator family's consumers (`coordinator start/tick/status`), which keep their own target and behaviour unchanged"
    - "The daemon and dispatch lane readers that supply the healthy-delivery corroborator"
    - "F5/F6 (agent prompts and thin wrappers), which retire the shell entry points"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A false stuck verdict kills a CEO that was in fact blocked on a healthy delivery: strengthen the healthy-delivery corroborator and its readability rule first, and never widen the window to compensate; this record and INV-DM-3 are reopened together."
  - "The loop's restart must publish an owner question at exhaustion: `coordinator.exhaustion`, the reserved render slot, and the question channel are reopened as their own decision, never widened locally inside the loop."
  - "A resume-by-session rule is required for the loop (the shell resumes the previous session under `CEO_RESUME_TOKEN_LIMIT`): a total-context source or an explicit resume decision is needed first, and `decideLifecycle`'s `resume-context` branch is not adopted silently meanwhile."
  - "A second reason token is proposed for a loop stuck restart (rather than the reused `stuck-artifact-evidence`): the coordinator's closed restart-reason vocabulary reopens as a contract decision."
  - "An operator runs `coordinator start` and `loop start` in one workspace and treats them as one supervisor: the per-identity exclusion is revisited (a workspace-wide single-supervisor guarantee), not patched with a second lock file."
  - "The coordinator family is asked to absorb a loop verb, or the loop is asked to absorb `tick`: reopen this record, because two engine-level semantics on one surface is the rejected alternative here."
  - "A harness adapter always supplies a spawned pid, or a consumer requires it: the pid fact moves from additive-optional to required with the harness adapter contract (TDR-0043) and this record's DC-7."
  - "Any adapter that can report the spawned pid (or a harness contract that always supplies one): the DC-6 case-3 degradation disappears and the session rule collapses back to two cases with a verified identity; reopen with the adapter contract so an operator is not left with a permanently unkillable session class." 
links:
  related_changes: ["GH-348", "GH-347", "GH-241"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-coordinator-supervision.md"
    - "doc/spec/features/feature-autonomous-delivery.md"
    - "doc/planning/oss-tooling/milestones/m4/flip-plan.md"
  contracts:
    - "packages/core/src/contracts/coordinator.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/state/coordinator.ts"
    - "packages/core/src/domain/coordinator-fence.ts"
    - "packages/core/src/domain/coordinator-admission.ts"
    - "packages/core/src/domain/coordinator-evidence.ts"
    - "packages/core/src/config/defaults.ts"
    - "packages/adapters/src/daemon/process.ts"
    - "packages/cli/src/commands/coordinator-loop.ts"
    - "scripts/ceo-loop.sh"
  diagrams: []
  decisions: ["TDR-0017", "TDR-0018", "TDR-0049", "TDR-0051", "TDR-0052", "TDR-0057"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S10", "M4-S9", "M1-S23"]
---

# TDR-0056: Loop Supervision as a Profile over the Coordinator Supervision Engine

> **Traceability.** Flip plan F3 ("CEO loop supervision inside jaiship") — the current-gap row "Outer loop and liveness | `ceo-loop.sh` | `jaiship loop` (over the delivered supervision engine)", the stage row `F3 | GH-348 (M4-S10)`, and the F3 verification bar "loop start/stop/status/log/reset parity; durable stop across restarts; single instance; stuck session restarted". Composes the delivered supervision surface of [feature-coordinator-supervision.md](../spec/features/feature-coordinator-supervision.md) (§1, §2, §4, §5, §8, §10) under [TDR-0017](TDR-0017-coordinator-supervision-architecture.md) and [TDR-0018](TDR-0018-coordinator-artifact-evidence-and-brief-escalation.md), keeps the Mode A invariants INV-DM-3/4/5 of [feature-autonomous-delivery.md](../spec/features/feature-autonomous-delivery.md#behavioral-invariants-inv-dm-16), and leaves the durable stop marker to its companion record ([TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md) — cited, not decided here).

## Context

Mode A is today driven by one shell script that spawns a CEO session, watches it, kills and restarts it when it is genuinely stuck, and honours a durable stop marker. The flip plan names the typed replacement as `jaiship loop` **over the delivered supervision engine** — not as a new supervisor. The engine already exists on `main-tools` as the `coordinator` family, so the question is not *whether* a supervision engine exists but *which of its semantics transfer to a long-lived CEO session*.

- **FACT:** The `coordinator` family is delivered with `start --foreground`, `stop`, `status --live`, and `tick` (`doc/spec/features/feature-coordinator-supervision.md` §1, lines 33-47). *(read 2026-11-19)*
- **FACT:** Coordinator single-instance ownership is an append-only **instance lease** over `coordinator.fence` records with four actions — `acquired`, `released`, `stale-takeover`, `stop-requested` — folded from the latest record by ledger sequence; liveness is decided before age, so a live holder is refused `coordinator.already-running` regardless of lease age, a dead holder is takeover-eligible, an unanswered probe falls back to 2 × `coordinator.collection-interval`, and an undeclared alive capability is `coordinator.process.capability-gap` (`feature-coordinator-supervision.md` §2, lines 90-120; `packages/core/src/domain/coordinator-fence.ts:49-136`). *(read 2026-11-19)*
- **FACT:** The lease, budget, stuck, and append primitives are exported as pure/port functions with no command-tier coupling: `foldCoordinatorLease` and `decideCoordinatorClaim` (`coordinator-fence.ts:49,118`), `appendCoordinatorFence` (`packages/core/src/state/coordinator.ts:792`), `evaluateCoordinatorRestartAdmission` (`packages/core/src/domain/coordinator-admission.ts:33`), `foldCoordinatorStuck` (`state/coordinator.ts:566`), and `appendCoordinatorStuck` (`state/coordinator.ts:724`). *(read 2026-11-19)*
- **FACT:** Every coordinator record key is scoped by the coordinator identity, and the reader skips a record whose key belongs to another identity (`if (key !== coordinatorIterationKey(coordinatorId)) continue;`) instead of failing; an identity mismatch on the *same* key is `state.store.unknown` (`state/coordinator.ts:443-540`, especially lines 474-480 and the `coordinatorId !==` guards at 195, 232, 266, 318, 356, 387). This is what makes a second supervisor identity a composition rather than a contract change. *(read 2026-11-19)*
- **FACT:** The restart budget is per durable epoch and per `coordinator/<coordinatorId>` namespace, folded from contiguous ordinals starting at 1, with a torn or gapped set classified `unevaluable` rather than count 0; admission refuses at or above the bound (`coordinator-admission.ts:33-51`; `feature-coordinator-supervision.md` §5, lines 254-269). `coordinator.restart-budget` defaults to **10** (`packages/core/src/config/defaults.ts:85`). *(read 2026-11-19)*
- **FACT:** The six `coordinator.*` keys and their shipped defaults are declared in one branch (`config/defaults.ts:82-89`): `stuck-window` 600 000 ms, `kill-grace` 20 000 ms, `restart-budget` 10, `resume-context-limit` 100 000, `collection-interval` 30 000 ms, `progress-bound` 300 000 ms; the branch is validated with the existing configuration identities and no new key is required by this decision. *(read 2026-11-19)*
- **FACT:** The shell's knobs map onto five of those keys: stuck 10 min ↔ `stuck-window` 600 000 ms, poll 30 s ↔ `collection-interval` 30 000 ms, kill grace 20 s ↔ `kill-grace` 20 000 ms, restart cap 10 ↔ `restart-budget` 10, resume token limit 100 000 ↔ `resume-context-limit` 100 000 (`scripts/ceo-loop.sh:63-69`). `coordinator.progress-bound` has no shell equivalent — the shell's single traffic window serves as both threshold and progress window — and the shell's `LOOP_SLEEP_SECONDS` (2 s) and its `CEO_LOOP_MAX_ITERATIONS=0` "unbounded" default map to no key. *(read 2026-11-19)*
- **FACT:** The coordinator's cycle is a **delivery-expectation** cycle: it ranks blocker questions, issues one wake on a typed question, and evaluates a stuck verdict over three artifact classes — `digest-consumed` (state-sourced digest fingerprint plus a new turn), `merge` (`merge.transaction`), `answer` (`blocker.answer`) (`packages/cli/src/commands/coordinator-loop.ts:863-1060`; `packages/core/src/domain/coordinator-evidence.ts:100-145`; `feature-coordinator-supervision.md` §4, lines 194-232). *(read 2026-11-19)*
- **FACT:** `evaluateStuck` takes a fixed injected fact set whose only progress veto is a *positive sourced new turn* inside `progress-bound` (`coordinator-evidence.ts:20-39,100-123`); there is no input for "a delivery is in progress", so that corroborator cannot be supplied without changing the coordinator's domain facts. *(read 2026-11-19)*
- **FACT:** The shell's stuck predicate is explicitly *two-signal*: a CEO with no session traffic but a healthy delivery in progress (the race-free `delivering` marker with a live pid, or `deliver-ticket.sh --is-delivering`) is **not** stuck, and a degraded liveness probe with a known session id is also not stuck (`scripts/ceo-loop.sh:403-445`; INV-DM-3 at `feature-autonomous-delivery.md:163`). *(read 2026-11-19)*
- **FACT:** The shell increments its restart counter **only** when a session ended `stuck` and compares it after the increment, so a clean session end never consumes a restart and the cap permits exactly `MAX_RESTARTS` restarts (`scripts/ceo-loop.sh:652-716`). The reused admission refuses the `(bound + 1)`th restart, so the two counts coincide — unlike the dispatch lane's iteration-index offset recorded in [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md). *(read 2026-11-19)*
- **FACT:** Identity-verified kill-with-grace is a delivered helper that verifies the recorded pid **plus** process start time before any signal, sends TERM, waits the configured grace through an injected wait, escalates to SIGKILL only while the tree is alive, appends nothing itself, and returns the closed outcomes `terminated | forced | failed | capability-gap` (`packages/adapters/src/daemon/process.ts:117-146`; `feature-coordinator-supervision.md` §5, lines 234-252). *(read 2026-11-19)*
- **FACT:** The harness session port carries an additive optional `terminate` operation whose input reuses the `coordinator.kill-grace` value and whose report distinguishes signalled, escalated, and exact-identity reap (`packages/core/src/contracts/harness.ts:474-529`; [TDR-0051](TDR-0051-harness-terminate-operation.md)). *(read 2026-11-19)*
- **FACT:** `HarnessSessionHandle` carries `harnessKind`, `sessionId`, `treeRoot`, and `workItemRef` — no pid (`packages/core/src/contracts/harness.ts:270-275`), and the supervision spec declares this as a known limitation: "**No pid on a spawned handle.** … kill-with-grace stays unavailable for a coordinator-spawned session until a lane record supplies its pid and start time" (`feature-coordinator-supervision.md` §3, lines 182-186). *(read 2026-11-19)*
- **FACT:** Durable lane records already exist with an owner process identity and an `active | terminal` state: `dispatch.lane` (`packages/core/src/contracts/dispatch.ts:572-611`, under `dispatch.lanes:<ref>`, [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md)) and `daemon.lane` (`packages/core/src/contracts/daemon.ts:42-66`, under `daemon.lanes:<ref>`). *(read 2026-11-19)*
- **FACT:** Durable control is a named non-functional requirement: "`ceo-loop.sh`'s stop/park signal survives a loop restart; it is not wiped at startup" (`feature-autonomous-delivery.md:242`, NFR-5), and the shell's carrier is a plain workspace file (`scripts/ceo-loop.sh:93-96` `STOP_FILE`, written by `cmd_stop` and cleared by `cmd_reset` at line 731, `--stop`/`--reset` subcommands). *(read 2026-11-19)*
- **FACT:** `feature-coordinator-supervision.md` §10 keeps "`ceo-loop.sh` stays byte-unchanged" as a constraint (line 421), and §1 states "`ceo-loop.sh` is unchanged. The `coordinator` family is its typed replacement; the bash entry point retires at M4-S5" (lines 30-31). The second sentence is the current-truth tension this record must resolve without editing the spec. *(read 2026-11-19)*
- **Why now:** F3 is on the flip's critical path and the PM already recorded the duplication risk as a decision for this agent rather than resolving it in the change; delivery cannot start until it is settled which engine semantics the loop inherits, because that answer decides whether the coordinator family is touched at all.

## Problem Framing (Clarified)

The request looks like "add five verbs". It is actually three questions, and only the first is clerical:

1. **Is the loop a new supervisor or a second composition of the existing one?** The engine's *primitives* (lease, budget, kill, folds) are general; its *cycle* (blocker ranking, wake-on-typed-question, artifact-evidence expectation) is specific to delivering tickets through lanes. Reuse must therefore be decided primitive-by-primitive, not family-by-family.
2. **What does "stuck" mean for a session whose job is to wait?** A CEO blocked on `deliver-ticket.sh` (now `dispatch`) is doing exactly what Mode A asks: INV-DM-1 makes the call foreground and blocking, so a healthy CEO emits **no** session traffic for the whole delivery. The coordinator's stuck rule would call that session stuck once `coordinator.stuck-window` elapsed, because its three classes (`digest-consumed`, `merge`, `answer`) are coordinator-digest artifacts that a waiting CEO never produces. Applying it would kill a working CEO on every long delivery — the failure INV-DM-3 exists to prevent.
3. **Which durable carriers survive a restart, and which are per holder?** The lease is per supervisor instance; the shell's stop is per workspace and must survive a restart (NFR-5). The coordinator's `stop-requested` is a request against one holder, so it cannot be the shell's stop. That is a separate decision ([TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md)), and this record must not smuggle it in.

Root cause versus symptom: the symptom is "the coordinator family has no `log` or `reset` verb". The cause is that the coordinator family and the CEO loop share a *mechanism* (one instance, one budget, one kill) but not a *target* (a delivery lifecycle versus an operator session). Treating the shared mechanism as a shared command creates one surface with two meanings; treating it as a shared library creates one engine with two profiles. This record takes the second reading and states exactly where the seam is.

**Deliberately out of scope:** no change to any coordinator module or to coordinator behaviour; no second exclusion mechanism (no lock file, no pid file); no second kill path; no `tick` verb and no wake-on-typed-question for the loop; no owner escalation at exhaustion (`coordinator.exhaustion`, the reserved render slot, and the question channel are untouched); the durable stop record kind and its semantics ([TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md)); resume-by-session parity for the loop; retirement of `scripts/ceo-loop.sh` and the agent-prompt flip (F5/F6); the `log` file's retention policy beyond a bounded tail.

## Constraints (Hard Requirements)

### C-1: The Mode A outer loop is a typed `loop` family over the delivered engine

- **Statement:** `loop start | stop | status | log | reset` exists as a prompt-required command family whose supervision behaviour is composed from the delivered engine primitives; it is not a wrapper that shells out to `scripts/ceo-loop.sh`, and it is not a second supervision engine.
- **Source:** Blueprint (flip-plan current-gap row line 34; F3 stage row line 49; F3 verification bar line 117) + change scope (GH-348 clarify-scope decision 2)
- **Verification:** demonstration (the family runs against the real composition) + code review (the composition imports engine primitives and no shell script)
- **Negotiable:** no

### C-2: One exclusion mechanism, and it is the delivered instance lease

- **Statement:** Loop single-instance ownership is the append-only instance lease over `coordinator.fence` under the loop's own supervisor identity: `acquired` / `released` / `stale-takeover`, folded by ledger sequence, liveness decided before age, a live holder refused `coordinator.already-running` (exit 2, no lease record, no session). No lock file, pid file, marker, or second lease exists on the loop path.
- **Source:** AC (flip-plan F3 bar "single instance") + prior decision (TDR-0017 lease; `feature-coordinator-supervision.md` §2)
- **Verification:** test (two concurrent starts: one acquisition, one refusal, zero extra sessions; a dead holder is taken over; a live holder is refused regardless of age) + code review
- **Negotiable:** no

### C-3: A CEO blocked on a healthy, progressing delivery is never classified stuck and never killed

- **Statement:** A `stuck` verdict requires the window to have elapsed **and** no positive sourced session progress **and** no artifact advance **and** a readable healthy-delivery corroborator that reports no delivery in progress. A readable corroborator that reports a delivery in progress vetoes the verdict regardless of session silence. An unreadable corroborator, or an unreadable required progress reading, yields `unevaluable` with no kill — never a fabricated "no delivery".
- **Source:** AC (INV-DM-3 and INV-DM-5, `feature-autonomous-delivery.md:163,165`; the shell's decision table `scripts/ceo-loop.sh:403-445`) + flip-plan F3 bar "stuck session restarted" (which presupposes a correct stuck definition)
- **Verification:** test (delivery-in-progress negative control across more than the window; unreadable-store matrix producing `unevaluable` with zero kill invocations) + code review
- **Negotiable:** no

### C-4: A clean session end consumes no restart ordinal; only a stuck restart does, and exhaustion is a typed stop

- **Statement:** Exactly one restart ordinal and exactly one `coordinator.restart` record are consumed per admitted stuck restart. A session that ends cleanly (or ends for any non-stuck cause) consumes none and appends none. At or above `coordinator.restart-budget`, no restart record is appended, no replacement session starts, and the command returns the reused `coordinator.restart-budget-exhausted` identity at exit 1 with the durable history reference.
- **Source:** AC (flip-plan F3 bar; `feature-coordinator-supervision.md` §5) + parity reference (`scripts/ceo-loop.sh:652-716`)
- **Verification:** test (clean end after N sessions: zero ordinals, zero restart records; a stuck restart: one ordinal, one record; at the bound: exit 1, zero records, zero sessions) + code review
- **Negotiable:** no

### C-5: No coordinator module is modified and the coordinator family's behaviour is unchanged

- **Statement:** The change adds no field, branch, reason, record kind, verb, or default to the coordinator surface. The loop composes exported coordinator primitives from outside them; `packages/core/src/contracts/coordinator.ts`, `packages/core/src/state/coordinator.ts`, `packages/core/src/domain/coordinator-{fence,admission,evidence,lifecycle}.ts`, and `packages/cli/src/commands/coordinator*.ts` are unchanged, and the coordinator suites pass without edit.
- **Source:** Change scope (GH-348 clarify-scope decision 2: reuse is mandatory, a second supervisor is out of scope) + prior decision (TDR-0017/TDR-0018 own the coordinator semantics; `feature-coordinator-supervision.md` §10)
- **Verification:** code review (empty diff on the listed paths) + test (coordinator suites unchanged and green; a coordinator `status`/`tick` projection byte-identical before and after)
- **Negotiable:** no

### C-6: One kill path, identity-verified, and no signal without a verified identity

- **Statement:** Termination runs only through the delivered `killCoordinatorProcess` (recorded pid plus process start time) and the delivered harness `terminate` operation for the session tree. No name, pattern, shell interpolation, or `pkill`-style selection exists. An absent or mismatched start-time identity sends **no** signal and surfaces the capability-gap or kill-failed identity; an absent spawned pid is `null` and is never fabricated, so a session without a pid is reported as unkillable rather than killed by guess.
- **Source:** AC (`feature-coordinator-supervision.md` §5; flip-plan F3 bar) + prior decision (TDR-0051 terminate; ADR-0008 harness contract)
- **Verification:** test (identity-mismatch double: zero signals; absent capability: typed gap; absent pid: no kill attempt) + code review
- **Negotiable:** no

### C-7: The six `coordinator.*` keys are reused as shipped, and no key is added or defaulted differently

- **Statement:** The loop reads the delivered `coordinator` configuration branch (`stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, `progress-bound`) with its shipped defaults. No key is added, renamed, or re-defaulted; a malformed branch falls back to the shipped defaults; the shell's `LOOP_SLEEP_SECONDS` and unbounded-iteration default remain shell-only knobs and are not promoted to configuration.
- **Source:** AC (`feature-coordinator-supervision.md` §8, lines 340-355; `config/defaults.ts:82-89`) + change scope (no configuration change)
- **Verification:** test (config key-set equality; default resolution per key; a malformed branch still resolves every key) + code review
- **Negotiable:** no

### C-8: Identity isolation, and no escalation path is introduced

- **Statement:** Every loop record lands under the loop's own identity, and both families can fold the same store without a `state.*` failure: the coordinator fold skips loop records and the loop fold skips coordinator records. The loop appends no `coordinator.exhaustion` record and publishes no blocker question in this change; exhaustion is the typed exit of C-4.
- **Source:** AC (per-identity key scoping: `state/coordinator.ts:443-540`) + change scope (escalation is TDR-0018's surface and is a non-goal here) + prior decision (TDR-0018 reserved slot)
- **Verification:** test (both identities present in one store: both folds return their own records and no failure; exhaustion run appends zero exhaustion records and publishes zero questions) + code review
- **Negotiable:** no

**Table stakes** (every alternative below keeps them, acknowledged once): the local same-user trust model; deterministic ANSI-free bounded output; no CPU signal and no model call in any decision; evidence bounded to `key=value` at 512 UTF-8 bytes with no prompt, transcript, secret, or credential value.

## Decision Drivers

Ranked; the ordered list is authoritative.

1. **The invariants were bought with incidents.** INV-DM-3 and INV-DM-5 exist because a naive liveness rule killed a CEO that was legitimately waiting and because process-alive is not progress. A replacement that re-derives the rule from a different substrate re-opens that incident class.
2. **One exclusion mechanism and one kill path.** The highest-risk surfaces in supervision are "two supervisors ran" and "the wrong process was signalled". Every additional mechanism multiplies both risks, and the kill path is the only destructive operation here.
3. **The coordinator family keeps its own target.** Its cycle and its stuck predicate were designed for a lane-delivery expectation and are correct for that target (TDR-0018). Two engine-level semantics on one command surface is a permanent ambiguity for every future reader and test.
4. **Least contract surface.** Reuse six records, six keys, six error identities and their closed vocabularies; add only what the CEO target genuinely lacks.
5. **Solo-maintainer cost and the paved road.** One engine, two compositions, one place to fix a lease bug.
6. **Honest observation.** `status`/`log`/`reset` must tell the truth about a session that spans restarts, and unreadable evidence must be disclosed rather than coerced into "healthy" or "stuck".
7. **Documentation follows the mechanism, not the reverse.** The wording reconciliation of `feature-coordinator-supervision.md` §1 is a current-truth task for the change's documentation phase; it is not a reason to fork the runtime.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-348 clarify-scope routed the coordinator/loop duplication risk here; the flip plan's F3 target and verification bar are the binding scope.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-348 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (the verb set, the reuse mandate, the F3 bar); `@decision-advisor` (the primitive-by-primitive reuse split, the shell-parity reading, and this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (which engine semantics the CEO loop inherits is a contract-level answer).
- **Performers:** `@coder` (the family, the predicate, the two record kinds, the additive pid fact, the parity battery); `@doc-syncer` (the new loop page and the coordinator-supervision reconciliation).
- **Informed:** operators migrating off the shell; coordinator consumers; lane-record producers whose records feed the corroborator; F5/F6.

**Type note.** TDR. The supervision architecture and its restart regime were decided by TDR-0017, the stuck predicate and escalation by TDR-0018, the durable lane record by TDR-0049, and terminate by TDR-0051; this record decides which of those a second composition inherits. It is R2 because it fixes the semantics of a new prompt-required command family and the evidence rule for a destructive action; it is not R3 because every load-bearing fact is repo-local and readable, the predicate is pure and offline-provable, and reverting the family reverts the decision.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The lease, claim, budget-fold, stuck-fold, and append primitives are exported with no command-tier dependency. | FACT | `domain/coordinator-fence.ts:49,118`; `domain/coordinator-admission.ts:33`; `state/coordinator.ts:566,724,792` (read 2026-11-19) | Reuse would need a new abstraction layer, and C-2/C-5 would conflict. | High |
| Records are key-scoped per identity, and another identity's records are skipped rather than rejected. | FACT | `state/coordinator.ts:443-540`, skip at 474-480; same-key identity mismatch is `state.store.unknown` at 195, 232, 266, 318, 356, 387 (read 2026-11-19) | A second identity in one store would fail reads, and the whole profile approach would collapse. | High |
| The coordinator cycle is blocker-ranking + wake + `{digest-consumed, merge, answer}` artifact evidence. | FACT | `cli/src/commands/coordinator-loop.ts:863-1060`; `domain/coordinator-evidence.ts:100-145` (read 2026-11-19) | If the cycle were generic, reuse would dominate and ALT-1 would be over-engineered. | High |
| `evaluateStuck` has no input for a delivery-in-progress corroborator; its only veto is a positive sourced new turn. | FACT | `domain/coordinator-evidence.ts:20-39,100-123` (read 2026-11-19) | If such an input existed, ALT-1's own predicate would be avoidable and C-5 could be met by configuration. | High |
| A waiting CEO emits no session traffic for the whole delivery, and the shell therefore treats a delivery in progress as proof of health. | FACT | INV-DM-1/INV-DM-3 (`feature-autonomous-delivery.md:161,163`); `scripts/ceo-loop.sh:403-445` (read 2026-11-19) | If a blocked CEO produced traffic, the coordinator predicate would not misfire and the split would be less necessary. | High |
| The shell consumes a restart only on a stuck session end, and its cap permits exactly `MAX_RESTARTS` restarts, matching the reused admission's refuse-at-bound rule. | FACT | `scripts/ceo-loop.sh:652-716`; `coordinator-admission.ts:49-50` (read 2026-11-19) | A count mismatch would make the parity claim false and would need a recorded divergence like TDR-0052's. | High |
| Kill-with-grace verifies pid plus start time, appends nothing, and returns closed outcomes; `terminate` reuses the `kill-grace` value. | FACT | `adapters/src/daemon/process.ts:117-146`; `contracts/harness.ts:474-529` (read 2026-11-19) | A second kill path would be required, violating C-6. | High |
| `HarnessSessionHandle` carries no pid, and the spec declares the resulting kill limitation. | FACT | `contracts/harness.ts:270-275`; `feature-coordinator-supervision.md` §3, lines 182-186 (read 2026-11-19) | If a pid were present, the additive fact in DC-7 would be unnecessary. | High |
| Durable lane records with an owner process identity and an active/terminal state exist for both `dispatch` and `daemon`. | FACT | `contracts/dispatch.ts:572-611`; `contracts/daemon.ts:42-66` (read 2026-11-19) | The healthy-delivery corroborator would have no durable source and C-3 would be unimplementable without a new record kind. | High |
| An `active` lane record whose recorded owner process is alive (verified pid plus start time) is a sound proxy for "a healthy delivery is in progress". | ASSUMPTION | The shell's marker-plus-PID-probe semantic (`scripts/ceo-loop.sh:412-430`) mapped onto TDR-0049's owner facts | If unsound, either a wedged CEO is never killed (a stale-active record) or a healthy one is killed (a false negative). Mitigation: the corroborator requires the recorded owner to pass the same identity check the kill path uses, and requires readability for a verdict at all. | Medium-High |
| A stale `active` lane record whose owner is dead is detectable by the identity probe rather than by a timeout. | ASSUMPTION | `DispatchLaneOwner{processId, startedAt}` (`contracts/dispatch.ts:582-585`) plus the delivered process port | If not detectable, the corroborator degrades to "record exists", which biases toward never killing; the revisit trigger for a false negative covers it. | Medium |
| `status` can report the shell's `ceo_pid`/`ceo_session` equivalents across restarts only if the loop records its own session identity durably. | FACT | `scripts/ceo-loop.sh:93-96` state files (`ceo.pid`, `last-session`); spec §3 "No durable coordinator session identity", lines 177-181 (read 2026-11-19) | Without `loop.session`, `status` after a restart would report nulls, which the F3 bar reads as a parity failure. | High |

## Mental Models & Techniques Used

- **Inversion ("how does this kill a working CEO?"):** a session silent for ten minutes while a delivery runs; an unreadable lane store read as "no delivery"; a stale `active` record whose owner died; a degraded progress probe read as "no progress"; a restart that kills by name because no pid was recorded. Each yields a rule: the corroborator (C-3), `unevaluable` rather than a guessed negative (C-3), identity-verified owner checks in the corroborator, the `unevaluable` rule again for progress, and the additive pid fact with no-guess termination (C-6, DC-7).
- **Inversion ("how does this run two supervisors?"):** a lock file that disagrees with the lease; a pid file that outlives a crash; a second lease scoped differently; two identities mistaken for one guarantee. Each yields C-2 (one lease) and the recorded consequence that exclusion is per identity.
- **5 Whys ("why can't the coordinator cycle drive the CEO?"):** the cycle evaluates a delivery expectation → the expectation exists because a coordinator's job is to react to lane artefacts → the CEO's job is to *wait* for a delivery, which is the inverse → its healthy state produces no artefacts at all → so the same predicate is not merely imprecise for the CEO, it is inverted. That is why the split is at the predicate, not at a threshold.
- **Second-order thinking:** reusing the lease under a second identity turns one exclusion domain into two; that is the price of not touching the coordinator, and it is also the benefit (each family's exclusion reasoning stays local). The same insight explains why `stop-requested` cannot be reused: a per-holder record cannot express a per-workspace stop that must survive a restart (NFR-5).
- **Systems thinking:** the loop joins the lease, the budget, the stuck pair, the kill path, the lane records, the harness spawn, and the shell's parity table. Each join can double-count or lose a fact: a clean end that consumes an ordinal breaks the shell's counter; a stuck restart that appends no record breaks the budget; a kill without a pid breaks identity discipline; a corroborator read from a *different* store than the lineage that writes it can drift.
- **Paced road / KISS:** six primitives reused unchanged, two record kinds added, one predicate written. No new lease, no new kill path, no new configuration, no new error vocabulary.
- **Opportunity cost:** a second supervisor would buy independence from the coordinator's design at the price of a second exclusion mechanism, a second kill path, duplicated folds, and two places to fix every future supervision bug — the same trade TDR-0052 refused for the dispatch loop.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 typed loop | C-2 one lease | C-3 blocked CEO never killed | C-4 clean end free | C-5 coordinator untouched | C-6 one kill path | C-7 keys reused | C-8 identity isolation |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the shell only | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 selected: second composition profile under `loop-main` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 extend the `coordinator` family with the five verbs | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-3 independent supervisor with its own lease, kill, and budget | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-4 alias `loop start` to `coordinator start --foreground` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: Keep `ceo-loop.sh` as the Only Outer Loop

- **Eligibility:** Not eligible (fails C-1 — no typed family exists, so the F3 target and its bar are unmet).
- **Summary:** Leave Mode A on the shell; deliver nothing.
- **Constraint compliance:** Fails C-1. Passes C-2…C-8 vacuously, because nothing new supervises anything.
- **Driver fit:** Best on driver 5 (zero cost) and on driver 1 for as long as the shell exists; fails driver 6 (no typed observation) and the blueprint outright.
- **Pros:** Zero risk, zero code; the incident-tested script keeps running.
- **Cons:** The flip stalls at F3; the shell's stop file, log file, and pid file remain the only operator surface; nothing is attributable in the ledger.
- **Why rejected:** It is the gap the flip plan names, and F5/F6 cannot land while the outer loop is still a shell script.

### Alternative 1 — Selected: A Second Composition Profile Under `loop-main`

- **Eligibility:** Eligible.
- **Summary:** `loop start/stop/status/log/reset` composes the delivered primitives under its own supervisor identity: the `coordinator.fence` lease, the per-epoch `coordinator.restart` budget, the two-phase `coordinator.stuck` pair, `killCoordinatorProcess` plus harness `terminate`, the six configuration keys, and `readCoordinatorRecords(store, "loop-main")` as its verified read. It does not reuse the coordinator cycle, `evaluateStuck`, `decideLifecycle`/`coordinator.iteration`, or the exhaustion escalation; it adds one pure stuck predicate over session progress + artifact advance + a readable healthy-delivery corroborator, two record kinds (`loop.session`, `loop.stop`), and one additive optional spawned-pid fact. No coordinator module is modified.
- **Constraint compliance:** Passes C-1…C-8 (matrix above, attestation below).
- **Driver fit:** Best on every driver: the delivered invariants are reused verbatim (1), one lease and one kill path (2), the coordinator keeps its target (3), the smallest added surface (4), one engine to maintain (5), honest `status`/`log`/`reset` over a durable session record (6), and the wording reconciliation stays a documentation task (7).
- **Pros:** The destructive path is unchanged from the incident-tested one; the budget and its exhaustion identity are the delivered ones; the identity-scoped store makes two supervisors a fold-level non-event; the shell's parity table becomes an executable battery rather than an aspiration.
- **Cons:** Exclusion becomes per identity, so `coordinator start` and `loop start` can coexist in one workspace; the loop owns a second stuck predicate that must be argued for independently; the loop's history is spread across two record families.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and its novelty is confined to the one thing the engine genuinely lacks.

### Alternative 2 — Extend the `coordinator` Family With the Five Verbs

- **Eligibility:** Not eligible (fails C-3 and C-5).
- **Summary:** Add `start --foreground` variants plus `log` and `reset` to the coordinator family, and teach its cycle to recognise the CEO target.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-6, C-7, C-8. Fails C-3: the delivered cycle's only progress veto is a positive sourced new turn, so a CEO blocked on a healthy delivery is still `stuck` once the window elapses. Fails C-5: making the CEO safe requires a delivery-in-progress input in `CoordinatorEvidenceFacts` and a workspace-scoped stop alongside the per-holder `stop-requested` — two behaviour changes to a family whose semantics TDR-0017/TDR-0018 fixed for a different target.
- **Driver fit:** Good on driver 4 (no new identity, no new read) and 5; bad on driver 3, which is the reason the constraint exists.
- **Pros:** One command family to learn; no second identity; the lease and budget are shared by construction.
- **Cons:** The surface gains a mode in which `tick`, `wake`, and the artifact classes are meaningless; a future reader cannot tell whether `coordinator stop` means "stop this holder" or "stop the workspace loop"; every coordinator test must now carry the CEO arm.
- **Why rejected:** It pays a permanent semantic cost on a delivered surface to avoid one new identity, and it cannot satisfy C-3 without changing the coordinator's predicate — which is the thing the change is not allowed to do.

### Alternative 3 — A New Independent Supervisor With Its Own Lease, Kill, and Budget

- **Eligibility:** Not eligible (fails C-2 and C-6).
- **Summary:** Build a self-contained loop supervisor with its own exclusion, its own termination logic, and its own restart counter.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-5, C-7, C-8. Fails C-2 (a second exclusion mechanism beside the delivered lease) and C-6 (a second kill path beside `killCoordinatorProcess` and `terminate`).
- **Driver fit:** Best on driver 3 in one narrow sense (the coordinator is not touched at all) and worst on drivers 1, 2, 4, and 5.
- **Pros:** Full freedom to design for the CEO target; no coupling to coordinator vocabulary.
- **Cons:** Two ways to run two supervisors; the highest-risk surface written twice, one of them without the identity discipline the delivered helper already enforces; duplicate folds and duplicate budget arithmetic to keep in step; the flip plan explicitly names the target as "over the delivered supervision engine".
- **Why rejected:** Duplicating the two destructive surfaces is the exact risk this decision exists to avoid, and the blueprint's wording already excludes it.

### Alternative 4 — Alias `loop start` to `coordinator start --foreground`

- **Eligibility:** Not eligible (fails C-1, C-3, and the surface set).
- **Summary:** Make `loop` a thin alias for the delivered coordinator commands and accept their semantics.
- **Constraint compliance:** Passes C-2, C-4, C-5, C-6, C-7, C-8. Fails C-1 (no `log` and no `reset` verb exists to alias, so the family is incomplete) and C-3 (the aliased cycle kills a CEO blocked on a healthy delivery once the window elapses).
- **Driver fit:** Best on driver 4 (nearly zero added surface) and 5; worst on drivers 1 and 6.
- **Pros:** A few lines of wiring; the engine's behaviour is inherited by construction.
- **Cons:** Ships a command whose name promises Mode A semantics it does not have; the wake-on-typed-question path wakes a CEO for coordinator-audience questions; there is no budget backoff schedule and no `log`/`reset` carrier.
- **Why rejected:** An alias is a naming decision, not a supervision decision, and it hands the operator a destructive default that contradicts INV-DM-3.

## Decision

- **Decision:** Adopt **ALT-1**. The `loop` family is a second **composition profile** over the delivered supervision engine's primitives, under the distinct supervisor identity `loop-main`. The coordinator family keeps its own target and its behaviour unchanged, and no coordinator module is modified.

  1. **DC-1 — Profile, not fork, and not a mode.** `loop start | stop | status | log | reset` composes exported engine primitives from outside them. The loop's identity is a supervisor identity of the delivered family (`loop-main`), not a new family, not a new command mode, and not a wrapper around `scripts/ceo-loop.sh`. Coordinator and loop are two compositions of one engine; a reader is never asked which of two meanings on one command applies. (C-1, C-5.)
  2. **DC-2 — The lease is the delivered one, scoped to the loop's identity.** Claiming runs the delivered liveness-first decision over `coordinator.fence` under `loop-main` using `foldCoordinatorLease` + `decideCoordinatorClaim` and appends exactly one `acquired` or one `stale-takeover`; the loop appends `released` at loop exit (and at every clean stop) and never a per-cycle record. A live holder is refused `coordinator.already-running` at exit 2 with no lease record and no session. The loop does **not** use the delivered `stop-requested` action: a per-holder request cannot express a workspace-wide stop that must survive a restart (NFR-5), which is `loop.stop`'s subject ([TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md)). The loop's verified read is `readCoordinatorRecords(store, "loop-main")`; per-identity key scoping is what makes the coordinator's records skipped rather than rejected, and the same snapshot feeds the lane corroborator through the delivered cached-view pattern (`coordinator-loop.ts:197-203`). (C-2, C-8.)
  3. **DC-3 — The budget is the delivered one, and only stuck restarts consume it.** Each admitted stuck restart appends exactly one `coordinator.restart` with the next contiguous ordinal in the current epoch and consumes exactly one ordinal; admission is `evaluateCoordinatorRestartAdmission` with the resolved `coordinator.restart-budget` (default 10). A clean session end, a join of a live session, an operator stop, and an `unevaluable` verdict all consume none. At or above the bound the loop appends no restart record, starts no replacement session, and returns the reused `coordinator.restart-budget-exhausted` identity at exit 1 with the durable history reference. The reused closed reason is `stuck-artifact-evidence` — the loop's verdict is also an artifact-advance-and-progress predicate over the same ledger, and the distinguishing corroborator is carried in the stuck evidence corpus rather than in a new token. No `coordinator.exhaustion` record is appended and no owner question is published in this change. (C-4, C-8.)
  4. **DC-4 — The stuck verdict is the delivered two-phase pair.** Before any signal the loop appends one `coordinator.stuck` with `phase=verdict`, `killOutcome=not-attempted`, the closed reason, and a bounded `key=value` evidence corpus; after the kill it appends `phase=outcome` under the same `stuckId` with the resulting outcome and `killFailureReason`. The fold is `foldCoordinatorStuck` (latest wins per `stuckId`, ledger order, `recordedAt` descriptive only), so a replay appends nothing. The loop's `stuckId` and the record's `iterationId` are the loop's own session-iteration identity carried on `loop.session`, because the loop does not use `coordinator.iteration`. (C-4, C-8.)
  5. **DC-5 — The loop-local pure stuck predicate.** Inputs are injected facts: sourced session progress (`positive` / `zero` / `unknown`, the delivered progress vocabulary), artifact advance since the window opened (any ledger advance attributable to the session), and a **healthy-delivery corroborator** folded from the delivered durable lane records (`dispatch.lane`, `daemon.lane`) where a record is `active` and its recorded owner passes the same pid-plus-start-time identity check the kill path uses. The verdict is `stuck` only when the `coordinator.stuck-window` has elapsed **and** no positive sourced progress was observed **and** no artifact advanced **and** the corroborator is readable and reports no delivery in progress; any other positive reading is `progressing` (never persisted); an unreadable corroborator or an unreadable required progress reading is `unevaluable` — one `phase=verdict` record with reason `evidence-unevaluable`, no `phase=outcome`, and **no** kill. The predicate is pure, clock-injected, and offline-provable.
  6. **DC-6 — The session effect is a three-case rule over the recorded session, and `decideLifecycle` is not reused.** The rule reads `loop.session`, not the coordinator's expectation history:
     - **Live and verifiable** — the recorded session is `active` and its recorded process identity is known and alive with a matching start time: join and observe it; no spawn, no ordinal.
     - **Ended or proven dead** — the recorded session is `ended`, or is `active` with a known process identity that is dead or does not match: start exactly one fresh session.
     - **Active with no process identity** — the recorded session is `active` and no process identity is available (a harness kind whose adapter cannot report the spawned pid): do **not** spawn a second session and do **not** guess; resume the recorded session as the least-destructive action, report `session-pid-unknown` on the degradation list, and treat that session's liveness as unknown, so no stuck verdict is reached for it and nothing is signalled.

     The reason is structural, not stylistic: the host spawn starter runs the session detached in its own process group, so a session can outlive a killed loop process. Without a process identity the loop cannot distinguish an orphan from a dead session, so the invariant "at most one CEO session" is preserved by **never spawning when a recorded session might still be live**, and termination safety is preserved by **never signalling an identity it cannot verify** (C-6). Case 3 is therefore a resume, not a spawn; concurrent starts remain excluded by the lease alone (DC-2), which rules on the loop instance and says nothing about the session. The delivered `decideLifecycle`/`coordinator.iteration` pair is deliberately not adopted: with no total-context source the delivered decision can never reach `resume-context` in production (`feature-coordinator-supervision.md` §3, lines 171-176) and would record `spawn-fresh` with reason `context-unknown` on every unclean start, consuming an ordinal the shell's counter would not consume and — worse for the CEO target — spawning beside a session that may still be running. `loop.session` carries the session identity and the recorded process identity so a start after an unclean death re-finds its own session (for liveness, join, `status`, and case 3) rather than re-deriving it from the daemon lane table. (C-2, C-3, C-4, C-6.)
  7. **DC-7 — Exactly two additive record kinds and one additive optional fact.** `loop.session` records the loop's durable session identity (session id, harness kind, agent identity, spawned pid plus start time when available, iteration ordinal, state) so `status` can report the shell's `ceo_session`/`ceo_pid` equivalents across restarts and a restart can re-find its own session. `loop.stop` is the durable stop marker and is **[TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md)'s** decision, cited here only (one `requested` / `cleared` transition pair under `loop.stops:<loopId>`, latest-wins, never a state file). Neither kind carries the `coordinator.` prefix, so both coordinator folds skip them by the delivered `startsWith("coordinator.")` guard. The additive optional harness fact is the spawned session's pid on `HarnessSessionHandle` through the streaming spawn seam, because the delivered handle carries none and the spec already declares the resulting kill limitation. An absent pid stays `null` and is never fabricated: its consequence is case 3 of DC-6 — resume the recorded session, `session-pid-unknown` on the degradation list, liveness unknown, no stuck verdict, no signal — and never a guessed kill or a second spawn. No coordinator module is touched by any of this. (C-5, C-6, C-8.)
  8. **DC-8 — The operator surface tells the truth and mutates only what it owns.** `status` is read-only and never evaluates or mutates (the coordinator's `status` discipline) and reports the folded lease, the restart count and bound, the last persisted stuck verdict, the session identity from `loop.session`, and a bounded degradation list. `log` is a bounded tail of the loop's own log, never unbounded and never a transcript. `reset` clears the durable stop marker only: it does not delete coordinator-family history, does not open a budget epoch, and does not remove another holder's lease. `stop` appends the durable stop request ([TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md)) and never signals a session directly: a start that folds a requested stop exits 0 with `state=stopped` before claiming the lease, appending no lease record and spawning no session, and a running loop terminates the session it holds at its next cycle boundary **when it can verify that session's process identity** — a session with no process identity is reported on the degradation list rather than signalled (DC-6 case 3). (C-2, C-4, C-8.)

### The reused engine surface, and the four deliberate non-reuses

| Engine surface | Reused? | Why |
|---|---|---|
| `coordinator.fence` lease: `decideCoordinatorClaim` / `foldCoordinatorLease` / `appendCoordinatorFence` | Yes | One exclusion mechanism, liveness-first, identity-scoped; a second lease would be a second way to run two supervisors. |
| `coordinator.restart` + `evaluateCoordinatorRestartAdmission` | Yes | Per-epoch contiguous ordinals, torn-set `unevaluable`, refuse-at-bound; the shell's counter and the admission's arithmetic coincide. |
| `coordinator.stuck` pair + `appendCoordinatorStuck` / `foldCoordinatorStuck` | Yes | Two-phase persist-before-destroy under one durable identity; the fold already tolerates replay. |
| `killCoordinatorProcess` + harness `terminate` | Yes | Identity-verified pid plus start time, TERM→grace→KILL, appends nothing; the only destructive path. |
| Six `coordinator.*` keys and defaults | Yes | Five map onto shell knobs; `progress-bound` has no shell equivalent but is the delivered progress window; nothing is added or re-defaulted. |
| `readCoordinatorRecords(store, loopId)` | Yes | The per-identity key scoping is the proof that a second identity is skipped, not rejected. |
| `createCoordinatorSupervisor`'s cycle (blocker ranking + wake + artifact evidence) | **No** | It is a delivery-expectation cycle: its expectation substrate is a lane's lifecycle, and its wake path answers coordinator questions. Applied to a waiting CEO it would kill a healthy session (C-3). |
| `evaluateStuck` (artifact-evidence predicate) | **No** | Its only veto is a positive sourced new turn; there is no fact slot for "a delivery is in progress", and adding one would change the coordinator's domain module (C-5). |
| `decideLifecycle` / `coordinator.iteration` | **No** | With no total-context source, `resume-context` is unreachable in production, so the delivered decision would record `spawn-fresh`/`context-unknown` and consume an ordinal on every unclean start — the opposite of the shell's counter and of C-4. |
| `coordinator.exhaustion` + owner escalation | **No** | Escalation is TDR-0018's owned surface with a reserved render slot; introducing it here would be a second decision and a second owner-facing surface. The loop stops loudly at exit 1 instead. |

### The documented tension this record resolves, and who owns the wording

`feature-coordinator-supervision.md` §1 currently says "`ceo-loop.sh` is unchanged. The `coordinator` family is its typed replacement; the bash entry point retires at M4-S5" (lines 30-31), while §10 keeps "`ceo-loop.sh` stays byte-unchanged" (line 421). Both sentences remain true of their subjects, but "the coordinator family is its typed replacement" is no longer the whole current truth: the **loop** family is the Mode A operator surface over the same engine, and the coordinator family keeps its own target (lane supervision and wake) and its behaviour unchanged. This record decides the mechanism; it does **not** edit the spec. Reconciling the two sentences — and adding the new loop page the command will require — belongs to GH-348's documentation phase under `@doc-syncer`, which is where a current-truth edit belongs (driver 7). Until then, a reader must hold both facts: one engine, two composition profiles, one of which is the Mode A surface.

### One deliberate divergence from the shell, recorded

The shell, when the session id cannot be read **and** no delivery is in progress, falls back to "stuck-candidate" and lets the threshold timer kill the session (`scripts/ceo-loop.sh:435-445`). The loop classifies the same state as `unevaluable` with **no** kill, because a kill without a verified identity is refused by `killCoordinatorProcess` anyway (C-6): the shell's fallback produces a kill attempt that records an identity or capability failure, not a killed session. The divergence is bounded and safe — a wedged CEO whose identity cannot be read stays alive, is visible as `unevaluable` in `status`, and an operator can stop the loop — and it is the honest outcome under the delivered identity discipline rather than a silent downgrade of it.

### Constraint Compliance Attestation

ALT-1 satisfies C-1 through C-8. C-1: the family exists as the typed Mode A surface composed from engine primitives, verified against the real composition. C-2: single-instance ownership is the delivered `coordinator.fence` lease under `loop-main` with liveness-first takeover and the `coordinator.already-running` refusal, and no second mechanism exists. C-3: a stuck verdict requires the window, no sourced progress, no artifact advance, **and** a readable corroborator reporting no delivery in progress, with unreadable inputs mapped to `unevaluable` and no kill. C-4: one ordinal and one `coordinator.restart` per stuck restart, none for a clean end, and the reused `coordinator.restart-budget-exhausted` identity at exit 1 when no restart may land. C-5: no coordinator module is modified and the coordinator suites pass unedited. C-6: termination runs only through `killCoordinatorProcess` and harness `terminate`, with no signal on an unverified or absent identity. C-7: the six delivered keys and defaults are consumed unchanged, no key is added, and the shell-only knobs are not promoted. C-8: every loop record is key-scoped to `loop-main`, both folds tolerate the other identity's records, and no `coordinator.exhaustion` record or owner question is produced. No accepted-risk exception is claimed; the shell divergence above is a recorded justification, not a constraint violation, because no constraint requires the shell's degraded-probe kill.

## Trade-offs & Consequences

### Positive Outcomes

- The destructive path is the incident-tested one: identity-verified kill, one lease, one budget, one persisted verdict — the loop inherits them rather than re-deriving them.
- INV-DM-3/5 stop being a comment in a shell script and become a typed verdict rule with a named corroborator, an `unevaluable` outcome, and a durable evidence corpus.
- The coordinator family is untouched, so its target, tests, and observation payload keep their meaning; a reviewer can diff the coordinator paths to zero.
- The lease and the store already tolerate a second identity, so the "two supervisors" question is answered by key scoping rather than by a new lock.
- Exhaustion is a typed exit on a delivered identity rather than a new escalation surface, so the owner-facing contract does not grow in this change.
- `status`, `log`, and `reset` become real operator surfaces, and `status` can report the session identity across restarts, which the shell could only express through files on disk.
- The shell's parity table becomes an executable battery instead of an assertion, and the budget arithmetic is proven to coincide rather than assumed to.

### Negative Outcomes

- **Exclusion is per identity, not per workspace.** `coordinator start` and `loop start` can both hold leases in one workspace. That is intended (they supervise different sessions) and is what the split buys, but it is **not** a workspace-wide single-supervisor guarantee, and nothing prevents an operator from starting both and mistaking the pair for a single supervisor. Mitigation: the two identities appear separately in `status`, and revisit trigger 5 reopens a workspace-wide guarantee if it is actually wanted.
- The loop owns a second stuck predicate. It is small, pure, and separately justified, but it is a second place where "stuck" is defined, and the two definitions must never be conflated. Mitigation: the non-reuse table above is normative, and the record names the corroborator as the only difference.
- The loop's history is spread across two record families (`coordinator.*` for lease/budget/stuck, `loop.*` for session/stop), so an operator reconstructing "what happened" must read both. Mitigation: `status` folds them into one projection.
- The cost of DC-6 case 3: a harness kind whose adapter cannot report the spawned pid gets **no stuck-restart** for its session until a process identity is available — the loop resumes rather than spawns and reports `session-pid-unknown`, so a wedged session of that kind needs an operator. This is a documented degradation, not a silent gap, and it is the price of never spawning beside a possible orphan.
- `coordinator.progress-bound` has no shell knob, so a reader comparing the six keys to the six env knobs will find one key with no counterpart and two knobs with no key. Mitigation: stated explicitly here rather than papered over.
- The loop reuses the closed restart reason `stuck-artifact-evidence` for a verdict whose corroborator differs from the coordinator's, so a reader who assumes the coordinator's exact predicate is wrong. Mitigation: the difference is carried in the evidence corpus and named here; a new token would be a vocabulary decision with its own record.

### Unresolved Questions

- [ ] The shell resumes the previous CEO session when its context is under `CEO_RESUME_TOKEN_LIMIT`; the loop's effect rule spawns fresh where the shell would resume by session id (its only resume case is a recorded session whose process identity is unavailable, DC-6 case 3), so the mapped `coordinator.resume-context-limit` currently has no consumer on the loop path. Whether resume-by-session becomes loop parity depends on a total-context source or an explicit resume decision (owner: `@spec-writer` / `@pm`; revisit trigger 3).
- [ ] Whether a workspace-wide single-supervisor guarantee is wanted on top of the per-identity exclusion (owner: `@pm`; revisit trigger 5).
- [ ] The `log` tail length and the loop log's retention are an operator-surface detail that the F3 bar does not pin; the first retrospective should record what operators actually need (owner: `@coder` / owner at retro).
- [ ] Whether `status` should also expose the last `unevaluable` reason as a first-class field rather than a degradation entry is deferred until the first live run shows how often it occurs (owner: `@doc-syncer` / `@coder`).

## Implementation Plan

1. **Loop contract module.** Declare the loop's own closed sets and record kinds (`loop.session`, `loop.stop`), its bound and evidence limits, and its composition identity. Reuse the coordinator's record kinds, key prefixes, error identities, and configuration keys by import — declare no duplicate token and no widened vocabulary.
2. **Pure predicate.** Implement the loop-local stuck predicate over injected facts (sourced progress, artifact advance, corroborator state, window), returning `progressing | stuck | unevaluable` with a bounded evidence corpus; treat any unreadable required input as `unevaluable`. Unit-test each input combination including the delivery-in-progress veto and the unreadable matrix.
3. **Composition.** Compose the lease (claim/append/release), the budget (fold/admit/append), the stuck pair (persist verdict, kill, persist outcome), the corroborator fold over `dispatch.lane`/`daemon.lane`, and the two-case session effect over injected ports. Keep every decision pure and every port injected; no ambient clock, no shell call, no nested command.
4. **Surface.** Add the `loop` family to the CLI with `start`, `stop`, `status`, `log`, `reset`; `status` read-only; `log` bounded; `reset` stop-marker-only. Add the help entry and the M4 reference page so the help-structure check passes.
5. **Additive harness fact.** Extend the spawned-session handle with an optional pid through the streaming spawn seam, absent → `null`; wire the adapter and the composition so the identity-verified kill path receives a real pid for a loop-spawned session.
6. **Parity battery.** Replay the shell's decision table: stuck at the window with no corroborator; not stuck with a live delivery lane; clean end with zero ordinals; restart below the bound; typed exhaustion at the bound; second instance refused; identity mismatch sends no signal; both identities present in one store.
7. **Conformance and docs handoff.** Add the structural scans that prove no coordinator module changed and no `coordinator.`-prefixed kind was added; hand the loop page and the §1 wording reconciliation to `@doc-syncer` for the documentation phase.

## Verification Criteria

- Two concurrent `loop start` invocations in one workspace: exactly one acquisition, the other refused `coordinator.already-running` at exit 2, zero additional spawns, no lease record from the refused side.
- A past holder whose process is dead is taken over by exactly one `stale-takeover` (never a second `acquired`); a live holder is refused regardless of lease age.
- A CEO session with a live `dispatch.lane` (or `daemon.lane`) `active` record whose owner passes the identity check is never classified stuck, across at least two windows of session silence; `status` reports `progressing`.
- A session with no traffic, no artifact advance, and no delivery in progress produces exactly one `phase=verdict` record before any signal, exactly one `phase=outcome` record under the same `stuckId` after, exactly one `coordinator.restart` ordinal, and exactly one replacement session.
- An unreadable corroborator store (and, separately, an unreadable progress reading) produces exactly one `phase=verdict` record with reason `evidence-unevaluable`, no `phase=outcome`, zero kill invocations, and no restart ordinal.
- A clean session end appends zero `coordinator.restart` records and consumes zero ordinals regardless of how many sessions the loop has run.
- At `coordinator.restart-budget` (pinned and default): exit 1 with `coordinator.restart-budget-exhausted`, zero restart records, zero further sessions, zero `coordinator.exhaustion` records, zero published questions.
- A pinned non-default bound produces exactly that many restarts; the default resolves to 10; the configuration key set is unchanged.
- Identity mismatch on the recorded pid/start time: zero signals sent, the typed failure identity, one `phase=outcome` with `killFailureReason=identity-mismatch`.
- One store holding both `coordinator-main` and `loop-main` records: both folds return their own records with no `state.*` failure, and each family's `status` ignores the other's records.
- `git diff` on `packages/core/src/contracts/coordinator.ts`, `packages/core/src/state/coordinator.ts`, `packages/core/src/domain/coordinator-{fence,admission,evidence,lifecycle}.ts`, and `packages/cli/src/commands/coordinator*.ts` is empty; the coordinator suites pass unedited.
- `loop status` performs zero appends; `loop reset` clears only the stop marker and leaves lease, restart, and stuck records intact; `loop log` output is bounded.
- `scripts/ceo-loop.sh` is byte-unchanged.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the exported lease/budget/stuck/append primitives, the per-identity key scoping with its skip-versus-reject behaviour, the delivery-expectation cycle and the fixed evidence fact set that has no corroborator slot, the shell's two-signal stuck predicate and its restart counter, the identity-verified kill helper, the pid-less session handle with the spec's own limitation statement, the durable lane records, the six keys with their defaults, and the five-to-six knob mapping. The residual uncertainty is empirical, not documentary: whether an `active` lane record whose owner passes the identity check is a faithful proxy for "healthy delivery in progress", and how often the corroborator or the progress reading is unreadable in practice. Both are bias-checked by construction — an unreadable input can only produce `unevaluable`, never a kill — and both are named as revisit triggers rather than assumed away.

## References

- Flip plan: `doc/planning/oss-tooling/milestones/m4/flip-plan.md` — current-gap row "Outer loop and liveness" (line 34), stage row F3 (line 49), F3 verification bar (line 117).
- Specs: `doc/spec/features/feature-coordinator-supervision.md` §1 (command family), §2 (instance lease and fence rules), §3 (session facts and the declared limitations), §4 (artifact-evidence stuck detection), §5 (kill with grace and the restart budget), §8 (records, configuration, observation), §10 (constraints); `doc/spec/features/feature-autonomous-delivery.md` INV-DM-3/4/5 (lines 163-165), NFR-5 (line 242), and the `scripts/ceo-loop.sh` inventory row (line 205).
- Prior decisions: [TDR-0017](TDR-0017-coordinator-supervision-architecture.md) (supervision architecture); [TDR-0018](TDR-0018-coordinator-artifact-evidence-and-brief-escalation.md) (artifact-evidence stuck detection and escalation); [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md) (durable lane record); [TDR-0051](TDR-0051-harness-terminate-operation.md) (terminate); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the sibling bounded-loop decision this one deliberately does not repeat).
- Companion record (cited, not decided here): [TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md) — the durable operator stop as a state-ledger record (`loop.stop`, `loop.stops:<loopId>`, `requested`/`cleared`, folded before the claim). Same change, authored alongside this record; this record fixes only that the stop is not the coordinator's per-holder `stop-requested` action.
- Contracts and code (read 2026-11-19): `packages/core/src/contracts/coordinator.ts`; `packages/core/src/contracts/harness.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/daemon.ts`; `packages/core/src/state/coordinator.ts`; `packages/core/src/domain/coordinator-fence.ts`; `packages/core/src/domain/coordinator-admission.ts`; `packages/core/src/domain/coordinator-evidence.ts`; `packages/core/src/domain/coordinator-lifecycle.ts`; `packages/core/src/config/defaults.ts`; `packages/adapters/src/daemon/process.ts`; `packages/cli/src/commands/coordinator-loop.ts`.
- Parity reference (read 2026-11-19): `scripts/ceo-loop.sh` — env knobs (lines 63-69), delivering-marker and stuck predicate (lines 403-445), resume rule, restart counter and cap (lines 652-716), state files (lines 93-96), stop/reset subcommands (lines 725-739).
