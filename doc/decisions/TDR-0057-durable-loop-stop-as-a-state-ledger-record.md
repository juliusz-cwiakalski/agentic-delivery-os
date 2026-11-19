---
id: TDR-0057
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "The durable operator stop for the `loop` family is a state-ledger record and not a state file: one additive record kind `loop.stop` with payload schema `delivery.loop.stop.v1` under the loop-identity-scoped key `loop.stops:<loopId>` (default `loop-main`), append-only and read latest-wins by ledger sequence, where `loop stop` appends exactly one `requested` record and appends nothing when the folded latest already requests a stop, `loop reset` appends exactly one `cleared` record only when a stop is folded as requested, `loop start --foreground` folds the stop before claiming the instance lease and exits 0 with `state=stopped` appending no lease record, spawning no session, and writing nothing when a stop is requested, and a running loop re-reads the same fold at every cycle boundary and terminates the session it holds within one `coordinator.collection-interval` (default 30 000 ms) plus `coordinator.kill-grace` (default 20 000 ms); the stop names the loop identity and never a process instance, adds no error identity (append failures reuse `state.write.failed`/`state.lock.busy`), and adds no configuration key."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os supervision (durable operator stop for the CEO outer loop)"
decision_scope: repo
review_date: null
customer_impact: "An operator's stop is durable: once requested it survives a restart, is visible as a ledger transition, and refuses the next start until it is explicitly cleared — instead of a file that a second durable truth and its absence must be reasoned about."
classification:
  domains: [architecture, contracts, state, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-348: the specification routes the durable operator stop and its storage as a decision; this record is authored before the `loop` family delivery so the record shape and the start-admission rule are fixed first)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-348 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (change scope: the `loop` family beside `coordinator`; the parity contract carried from ceo-loop.sh, INV-DM-4, and NFR-5; the clarify note on verified seams, item 5, records the file-versus-lease question for this record)"
    - "@decision-advisor (the coordinator lease and stop-requested semantics, the delivered record/boundary/fold pattern, the shell stop mechanism, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-348 PR review — the record introduces a new durable record kind and the pre-claim start-admission rule)"
  performers:
    - "@coder (GH-348: the record kind and boundary, the stop/reset appends, the pre-claim start fold, the cycle-boundary re-read and kill path)"
    - "@doc-syncer (GH-348 documentation phase: the loop page, the state-layer record-kind table, and the NFR-5 reconciliation)"
  informed:
    - "Operators of `loop start|stop|status|log|reset`"
    - "Readers of the state-layer record-kind table and the state-store single-truth contract"
    - "The `coordinator` surface (it keeps its own per-holder stop and is not changed by this record)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A `loop` stop is expected to stop `scripts/ceo-loop.sh`, or a `ceo-loop.sh --stop` is expected to stop `jaiship loop`: the two control surfaces are distinct by construction (INV-DM-4 keeps the shell executable), and unifying them is a handover/retirement question, never a record-shape change."
  - "The stop is proposed to name a holder or a process instance: that reintroduces the per-holder request semantics this record rejects, so the start-admission rule must be re-decided with it."
  - "`loop stop` is proposed to carry a reason, a message, or free text: C-5 is reopened only with evidence that a fixed action cannot express a real operator need, and the payload schema moves with it."
  - "A stop is proposed to be honoured by the lease claim rather than by a pre-claim read: the ordering is what keeps a refused start from writing a lease record, so the whole admission path is re-decided as one."
  - "The state ledger's append-only or latest-wins contract changes (compaction, pruning, bounded retention): the stop's durability is defined on that contract and moves with it."
  - "A surface that does not read the ledger is required to honour the stop (an external supervisor or OS unit): the single-durable-truth constraint is reopened deliberately rather than satisfied with a second store."
links:
  related_changes: ["GH-348"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-19--GH-348--loop-supervision/chg-GH-348-spec.md"
    - "doc/spec/features/feature-autonomous-delivery.md"
    - "doc/spec/features/feature-coordinator-supervision.md"
    - "doc/spec/features/feature-state-layer.md"
  contracts:
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/contracts/coordinator.ts"
    - "packages/core/src/state/coordinator.ts"
    - "packages/core/src/domain/coordinator-fence.ts"
    - "packages/core/src/config/defaults.ts"
    - "packages/cli/src/commands/coordinator-loop.ts"
    - "scripts/ceo-loop.sh"
  diagrams: []
  decisions: ["TDR-0004", "TDR-0005", "TDR-0017", "TDR-0052", "TDR-0056"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S10"]
---

# TDR-0057: The Durable Loop Stop Is a State-Ledger Record, Not a File

> **Traceability.** Change spec §5.1 **F-4** (durable stop), §8.3 **DM-2** (the `loop.stop` record), §17.4 AC-F4-1…AC-F4-5, and §15 **DEC-2** (`doc/changes/2026-11/2026-11-19--GH-348--loop-supervision/chg-GH-348-spec.md`); M4-S10 AC "durable stop across restarts" (`doc/planning/oss-tooling/milestones/m4/backlog.md:55-63`) and the M4 flip-plan F3 verification bar "durable stop across restarts" (`doc/planning/oss-tooling/milestones/m4/flip-plan.md:117`); spec NFR-5 (`doc/spec/features/feature-autonomous-delivery.md:242`); spec INV-DM-4, which keeps `ceo-loop.sh` executable as the documented fallback and therefore keeps its file stop as the parity reference (`feature-autonomous-delivery.md:164`); the change's clarify note that the file-versus-lease question must be stated rather than assumed (`chg-GH-348-pm-notes.yaml`, "verified seams" note, item (5)). Builds on [TDR-0017](TDR-0017-coordinator-supervision-architecture.md) (the supervision architecture and its instance lease), TDR-0004 (state storage engine), TDR-0005 (exit taxonomy), and [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the pattern of a supervision decision encoded against shell parity).

## Context

The CEO outer loop exists twice: as `scripts/ceo-loop.sh` today, and as the `loop` command family M4-S10 adds inside `jaiship`. The shell loop has a durable operator stop — a file at `.ai/local/ceo/stop` written by `--stop`, cleared by `--reset`, and checked at the top of every iteration — and the M4 blueprint requires the typed loop to reproduce that guarantee ("durable stop across restarts"). The typed loop must therefore answer a question the shell never had to: where the durable stop lives, now that the workspace has a state ledger that is already the single durable truth for every other supervision fact.

- **FACT:** The shell loop's control state is files: `.ai/local/ceo/stop` (`STOP_FILE`), beside `ceo.pid`, `last-session`, and `loop.pid` (`scripts/ceo-loop.sh:88-97`). *(read 2026-11-19)*
- **FACT:** `cmd_stop` writes the stop file unconditionally — it does not test whether a loop is running — and stamps a UTC timestamp into it; `cmd_reset` removes it and reports "nothing to reset" when absent (`scripts/ceo-loop.sh:725-737`). *(read 2026-11-19)*
- **FACT:** `run_loop` honours the stop file at the top of every iteration ("durable stop signal present; honoring and exiting", commented "Not wiped at startup"), after a session ends ("stop signal written during session; exiting"), and inside the hook-retry wait (`scripts/ceo-loop.sh:635-641,704-708,659`). The check is *between* sessions; nothing polls the file while a session runs. *(read 2026-11-19)*
- **FACT:** NFR-5 is the durable-control requirement: the stop/park signal "survives a loop restart; it is not wiped at startup", "Stop honored until explicitly cleared" (`doc/spec/features/feature-autonomous-delivery.md:242`). *(read 2026-11-19)*
- **FACT:** INV-DM-4 keeps `ceo-loop.sh` retained and executable as the documented fallback while the typed engine is the regular path, so the shell's own stop mechanism stays in service and is not touched by this change (`doc/spec/features/feature-autonomous-delivery.md:164`; `doc/spec/features/feature-coordinator-supervision.md:421` "`ceo-loop.sh` stays byte-unchanged"). *(read 2026-11-19)*
- **FACT:** The coordinator carries a *different* control concept: `coordinator stop` appends one `stop-requested` record on the instance lease against a live holder and reports `requested`/`not-running` (`feature-coordinator-supervision.md:63-85`), the four lease actions are `acquired | released | stale-takeover | stop-requested` (`packages/core/src/contracts/coordinator.ts:183-188`), and the live supervisor "honours a request only when the record's `instanceId` matches its own instance" (`feature-coordinator-supervision.md:83`). *(read 2026-11-19)*
- **FACT:** `stop-requested` is a *held-lease* action in the fold: `COORDINATOR_LEASE_HELD_ACTIONS` is `acquired | stale-takeover | stop-requested` (`packages/core/src/contracts/coordinator.ts:192-197`), and a held lease whose holder is alive is refused `coordinator.already-running` regardless of age (`packages/core/src/domain/coordinator-fence.ts:118-131`; `feature-coordinator-supervision.md:92-118`). *(read 2026-11-19)*
- **FACT:** The state layer is "the append-only, schema-versioned JSONL ledger … the single durable truth", reads every verified record in sequence order, and admits additive record kinds under `delivery.state.v1` with no schema bump and no migration (`doc/spec/features/feature-state-layer.md:49`, `:430-446`; `packages/core/src/contracts/state.ts:12,338-346`). *(read 2026-11-19)*
- **FACT:** The delivered coordinator records establish the pattern this decision mirrors: a per-identity store key (`coordinator.fence:<coordinatorId>`), one kind per payload schema, a boundary reader that classifies a torn or unknown record as a `state.*` failure, and folds that order by ledger sequence with `recordedAt` "descriptive only" (`packages/core/src/state/coordinator.ts:61-105,443-556,566-580,611-618`; `feature-coordinator-supervision.md:338-350`). *(read 2026-11-19)*
- **FACT:** The coordinator's non-claim append gives the append shape a stop-record writer needs: one fence acquisition, fence-status plus one stale recovery and one retry, a still-busy fence mapped to the delivered `state.lock.busy`, and a failed append mapped to `state.write.failed` (`packages/core/src/state/coordinator.ts:620-662`; `feature-coordinator-supervision.md:390-391`). *(read 2026-11-19)*
- **FACT:** The loop's own cadence is already configured: `coordinator.collection-interval` defaults to 30 000 ms and `coordinator.kill-grace` to 20 000 ms, and the delivered foreground loop re-reads durable state at every cycle boundary (`packages/core/src/config/defaults.ts:84,87`; `feature-coordinator-supervision.md:68`). *(read 2026-11-19)*
- **FACT:** `stopped` is already a delivered projection value: the coordinator status block renders `state=stopped` when no instance is folded (`packages/cli/src/output/coordinator-text.ts:44-52`). No new observation vocabulary is needed for a refused start. *(read 2026-11-19)*
- **Why now:** The stop is the one piece of operator control the typed loop cannot inherit from the coordinator, because the coordinator's stop is per-holder and a stopped loop must be the opposite of a live holder. Deciding it after the command is built would either entrench a state file that a second durable truth must then be managed around, or discover at integration time that a reused lease action refuses the next start.

## Problem Framing (Clarified)

"Make the stop durable" is four questions, and only one of them is about storage:

1. **Durability scope.** What does the stop outlive? The shell's answer is a fresh process, a startup, and a `--reset`; that is what NFR-5 requires. A per-process signal handler or a per-holder request outlives neither.
2. **Control identity.** What does a stop name — a running loop instance, or the loop itself? The shell names neither: it names a workspace. A durable stop that names a holder is unreadable after that holder dies, which is precisely the restart the requirement is about.
3. **Storage location.** Where may the intent live, given that the workspace already has one durable truth with a verified read, a fence, classified failure identities, and forever retention? A file adds a second truth with its own creation, permission, garbage-collection, and path-identity questions.
4. **Admission ordering.** When a stop is folded as requested, what must `loop start` *not* do? Anything that records an attempt to run: a lease record, a session, an observation about a loop that never ran.

Root cause versus symptom: the symptom is "the typed loop needs a stop file too". The cause is that the shell's control plane was files because the shell had no ledger, while the typed loop's control plane is the ledger for every other supervision fact (lease, restart ordinals, stuck verdicts, wakes). Copying the shell's storage mechanism would copy an accident of its architecture, not a decision it made; copying the shell's *contract* — durable intent, checked before work starts, cleared only explicitly — is the parity that matters.

Deliberately out of scope: no change to `scripts/ceo-loop.sh` (INV-DM-4, and the coordinator spec's §10 constraint); no change to the coordinator lease, its `stop-requested` semantics, or its per-holder rule; no new command grammar beyond the `loop` family's `start`/`stop`/`reset` verbs and their declared flags; no stop *reason* vocabulary; no per-cycle lease or heartbeat record; no kill semantics beyond the delivered kill-with-grace; no projection or receipt vocabulary for `loop status` beyond the delivered `stopped` state.

## Constraints (Hard Requirements)

### C-1: A requested stop survives a restart

- **Statement:** After `loop stop` returns, a `loop start --foreground` in a fresh process, with no memory of the previous invocation, must refuse to run until a `loop reset` clears it. No startup step wipes, expires, or ignores the intent.
- **Source:** AC (M4-S10 "durable stop across restarts", `backlog.md:55-63`; flip-plan F3, `flip-plan.md:117`) + spec NFR-5 (`feature-autonomous-delivery.md:242`)
- **Verification:** test (stop, then start in a new process over the same store: exit 0, `state=stopped`, zero sessions, zero lease records; reset, then start: one session) + code review
- **Negotiable:** no

### C-2: A stopped loop is never admitted as a live holder

- **Statement:** A loop whose stop is folded as requested must not be refused `coordinator.already-running` by the next `loop start`, and no delivered lease fold may read a stop as a still-held lease. The stop decision must not carry `instanceId`, `pid`, or `processStartTimeMs`.
- **Source:** Required behaviour (start exit 0 `state=stopped`) + prior decision (`COORDINATOR_LEASE_HELD_ACTIONS`, `packages/core/src/contracts/coordinator.ts:192-197`; `feature-coordinator-supervision.md:92-118`)
- **Verification:** test (stop while no loop runs, then start: one `loop.stop` record, zero `coordinator.fence` records, no `coordinator.already-running`) + code review
- **Negotiable:** no

### C-3: No new error identity

- **Statement:** A failed stop-record append is disclosed with the delivered `state.write.failed`, or `state.lock.busy` when the non-claim append still finds the fence busy after its one stale recovery. No `loop.*` error identity is introduced, and no filesystem failure is reclassified as a state operation that did not occur.
- **Source:** Internal standard (delivered state failure codes, `packages/core/src/contracts/state.ts:75-84`; coordinator non-claim append rule, `feature-coordinator-supervision.md:390-391`) + prior decision (TDR-0005 exit taxonomy)
- **Verification:** test (busy fence → `state.lock.busy`; failed append → `state.write.failed`; error-table drift check unchanged) + code review
- **Negotiable:** no

### C-4: No new configuration key, and no delivered kind, schema, or vocabulary changes

- **Statement:** No configuration key is added; the stop's identity and cadence come from the delivered `loop` identity default and the delivered `coordinator.collection-interval`/`coordinator.kill-grace`. No delivered record kind, payload schema, closed vocabulary, lease action, or error table row is modified, widened, or reinterpreted.
- **Source:** Internal standard (single source of truth for closed sets; TDR-0004 and TDR-0017 delivered contracts) + AC (parity with the shell surface, which has no such key)
- **Verification:** test (configuration key-set equality; the coordinator action and lease-held sets unchanged; no delivered payload schema edited) + code review
- **Negotiable:** no

### C-5: The record is identifier-only

- **Statement:** A stop record carries a fixed action plus timestamps and the loop identity, and — where the surface declares one — a closed enumeration such as the requested stop mode. It never carries a prompt, a transcript, a credential, a message, or a free-text reason.
- **Source:** Internal standard (no prompt/transcript/secret in any record; `feature-coordinator-supervision.md:411-412`)
- **Verification:** test (every payload field is identity, declared enumeration, or timestamp; an undeclared or free-text field is refused) + code review
- **Negotiable:** no

### C-6: The state ledger stays the single durable truth

- **Statement:** No file, marker, or second store holds operator control intent for the `loop` family. The ledger is where the intent lives, and the decision reads it through the verified state port rather than through the filesystem.
- **Source:** Internal standard (`feature-state-layer.md:49` "the single durable truth"; `.ai/agent/decision-instructions.md` "Single source of truth")
- **Verification:** test (no control path under the workspace state directory is created or read by the family; the stop survives a state-directory-content change that does not touch the ledger) + code review
- **Negotiable:** no

### C-7: Stops and resets are idempotent and bounded

- **Statement:** `loop stop` appends exactly one record per requested transition and appends nothing when the folded latest already requests a stop. `loop reset` appends exactly one record when a stop is folded as requested and appends nothing otherwise. Repeated operator commands never grow the ledger.
- **Source:** Internal standard (append-only retention is forever; `feature-state-layer.md:297`) + AC (bounded control surface)
- **Verification:** test (N repeated stops → exactly one record; N repeated resets after one stop → exactly one record; stop/reset/stop/reset → four records, alternating) + code review
- **Negotiable:** no

### C-8: An unreadable fold fails closed

- **Statement:** A torn, unknown, or otherwise unreadable stop fold is disclosed as the delivered `state.*` identity and never read as "no stop is requested". A `loop start` whose stop fold cannot be read does not spawn a session.
- **Source:** Internal standard (verified-read contract; `feature-state-layer.md:66,68`; TDR-0004) + spec NFR-5 (the stop is honoured until explicitly cleared)
- **Verification:** test (torn payload, unknown key under the prefix, and a failed verified read each produce a `state.*` failure and zero sessions) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered foreground cycle, the delivered instance lease and liveness-first claim, the delivered kill-with-grace, the delivered restart budget, and the operator's ability to clear a stop and resume. None of those eliminates an alternative, so none is scored below.

## Decision Drivers

1. **One durable truth per workspace.** Every other supervision fact is already a ledger record; a second control surface is a second set of creation, permission, garbage-collection, and path-identity questions for a solo maintainer to own.
2. **Durability is the requirement, not a side effect.** A stop that lives in a process, a request payload, or a lock file is durable only for as long as something keeps holding it.
3. **Auditable transitions.** An operator wants to know *when* the loop was stopped and *when* it was cleared, not only what the current value is. A current-value store keeps the present and throws away the history.
4. **No new per-cycle cost.** The loop already performs one verified state read per cycle; a control read that rides that read costs nothing measurable, while a control read that is a second I/O surface adds a failure mode per cycle.
5. **Timeliness.** A stop requested against a running loop must be *observed* at the next cycle boundary rather than at the next process start, and the terminating arm must end within a declared bound rather than an unbounded wait.
6. **Paved road.** The delivered coordinator records already prove the boundary, fold, fence, and failure-identity pattern for a per-identity control value; the smallest change reuses them.
7. **Legibility against the shell.** An operator who knows `ceo-loop.sh --stop`/`--reset` must be able to map the typed behaviour onto the familiar one in one sentence.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-348's clarify phase routes the durable stop and its storage here (the verified-seams note, item 5); the record is authored before the family is built.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-348 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (change scope and the parity contract carried from `ceo-loop.sh`, INV-DM-4, NFR-5), `@decision-advisor` (coordinator lease semantics, delivered record pattern, shell mechanism, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (a new durable record kind and the pre-claim admission rule are contract-level).
- **Performers:** `@coder` (record kind, boundary, appends, pre-claim fold, cycle-boundary re-read); `@doc-syncer` (loop page, state-layer table, NFR-5 reconciliation).
- **Informed:** operators of the `loop` family; readers of the state-layer record-kind table; the `coordinator` surface (unchanged).

**Type note.** TDR. The supervision architecture and its instance lease are TDR-0017's; the state layer is TDR-0004's; this record fixes one additive record kind and one admission ordering inside those, for a caller that is technically distinct from the supervision engine. It is R2 because it introduces a durable record kind and a start-admission rule that other surfaces will read; it is not R3 because every fact is repo-local, the mechanism is offline-provable against a doubled store, and reverting it (stop writing and reading the kind) needs no migration.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| NFR-5 requires the stop to survive a loop restart and be honoured until explicitly cleared. | FACT | `doc/spec/features/feature-autonomous-delivery.md:242` (read 2026-11-19) | The durability constraint would have no requirement behind it and a per-process signal would look sufficient. | High |
| INV-DM-4 keeps `ceo-loop.sh` executable as the fallback, so the shell's file stop stays in service and is the parity reference. | FACT | `feature-autonomous-delivery.md:164`; `feature-coordinator-supervision.md:421` (read 2026-11-19) | If the shell were retired, the stop file could be deleted rather than paralleled, and part of this record's framing would be moot. | High |
| M4-S10's AC and the flip plan's F3 bar both name "durable stop across restarts". | FACT | `doc/planning/oss-tooling/milestones/m4/backlog.md:55-63`; `flip-plan.md:117` (read 2026-11-19) | The change would have no binding parity bar for the stop. | High |
| The shell's stop is a file written unconditionally, cleared by `--reset`, and checked between sessions at three points. | FACT | `scripts/ceo-loop.sh:95,635-641,659,704-708,725-737` (read 2026-11-19) | The parity mechanism and the latency comparison would be invented rather than observed. | High |
| `stop-requested` is per-holder: honoured only when `instanceId` matches, and folded as a still-held lease. | FACT | `feature-coordinator-supervision.md:63-85`; `packages/core/src/contracts/coordinator.ts:192-197`; `packages/core/src/domain/coordinator-fence.ts:118-131` (read 2026-11-19) | Reusing the action would become a viable alternative and ALT-2's rejection would lose its reason. | High |
| A held lease with a live holder is refused `coordinator.already-running` regardless of lease age. | FACT | `packages/core/src/domain/coordinator-fence.ts:118-131`; `feature-coordinator-supervision.md:109-118` (read 2026-11-19) | A reused `stop-requested` might not refuse the next start, weakening C-2 rather than a whole alternative. | High |
| The state ledger is the single durable truth, append-only, verified-read, forever-retained, and additive kinds need no schema bump. | FACT | `feature-state-layer.md:49,297,430-446`; `packages/core/src/contracts/state.ts:12,338-346` (read 2026-11-19) | C-6 and C-7 would rest on nothing, and retention would have to be argued separately. | High |
| The delivered coordinator boundary/fold/fence pattern is directly reusable for a per-identity control value. | FACT | `packages/core/src/state/coordinator.ts:61-105,443-556,566-580,611-618,620-662`; `feature-coordinator-supervision.md:338-350,390-391` (read 2026-11-19) | A new read path and a new fence discipline would have to be designed, raising the cost of every alternative. | High |
| The loop cadence is `coordinator.collection-interval` 30 000 ms and `coordinator.kill-grace` 20 000 ms, and the delivered foreground loop re-reads durable state every cycle. | FACT | `packages/core/src/config/defaults.ts:84,87`; `feature-coordinator-supervision.md:68` (read 2026-11-19) | The timeliness claim would need a new key, which C-4 forbids. | High |
| `stopped` is already a delivered projection value, so a refused start needs no new vocabulary. | FACT | `packages/cli/src/output/coordinator-text.ts:44-52` (read 2026-11-19) | A new value would have to be declared, widening C-4's scope. | High |
| A stop is requested, not a kill: the running loop performs the termination it is capable of, so a stop's latency is bounded by cadence plus grace rather than being instantaneous. | ASSUMPTION | `feature-coordinator-supervision.md:63-70` (the loop ends at a cycle boundary); the delivered kill-with-grace path | If operators expect an immediate kill, the receipt must say otherwise or the interval must shorten — a documented expectation gap, not a correctness one. | Medium-High |
| During dual-run, an operator who stops the typed loop does not stop `ceo-loop.sh` on the same workspace, and vice versa, because each surface owns its own control mechanism. | ASSUMPTION | INV-DM-4 (the shell remains executable) and the change scope (no shell edit, no prompt re-pointing until F5/F6) | If both paths can run against one workspace concurrently, a stop is only half-effective and the operator must be told; a revisit trigger records this. | Medium |
| The `loop` identity defaults to `loop-main`, so the effective scope of a stop matches the shell's one-loop-per-workspace file. | ASSUMPTION | The clarify "verified seams" note, item (5) (the file is per-workspace); the loop-identity default this record adopts | If two loops could share a workspace under different identities, the file and the record would differ in scope and the parity claim would be narrower. | Medium-High |

## Mental Models & Techniques Used

- **First principles:** What must a durable stop guarantee? (i) it outlives the process that wrote it, (ii) it is readable before any work starts, (iii) it names something that still exists after the process dies, (iv) it can be cleared exactly once per transition, (v) it cannot be confused with "the loop is running", and (vi) an unreadable intent fails safe. C-1, C-2, C-7, and C-8 are these six properties; the storage choice follows from (iii) and (vi) rather than preceding them.
- **Inversion:** What makes a durable stop dangerous? A stop that reads as a live holder (the next start is refused forever, and the only cure is a lease surgery); a stop that a startup wipes (the loop silently resumes spending tokens); a stop that cannot be cleared (`--reset` broken, operator locked out); a stop that is invisible to the audit trail ("when did we stop this?"); a stop whose file is unreadable and therefore read as "run" (the exact wrong default for an autonomous agent).
- **Second-order thinking:** Two consequences drive the design. First, a stop that is recorded *before* the lease claim keeps a refused start from writing anything — otherwise each refused start leaves an `acquired` record whose holder is already dead, and the next start does a takeover of a loop that never ran. Second, because the stop names the loop and not the holder, clearing it is a *transition* rather than a value deletion, which is why `reset` appends instead of deleting: an append-only ledger has no delete, and pretending otherwise would put control state outside the fold.
- **Systems thinking:** The stop joins the operator surface, the state ledger, the instance lease, the cycle driver, and the delivered kill path. Each join can lose a fact: a stop written into the lease loses its independence from the holder; a stop written to a file loses its classification and its history; a stop checked after the claim loses its "nothing recorded" property; a stop checked only at startup loses its timeliness against a long session.
- **5 Whys (on "why does the shell use a file?"):** because the shell had no ledger → because it is a process wrapper, not an engine → because its durable facts were PIDs and markers → because the only durable store available to a shell script is the filesystem. The typed loop is not that: it already owns a verified ledger, so the fifth why does not apply to it.
- **Opportunity cost:** Each alternative is priced in the durable surfaces an operator must reason about: one (the ledger) versus two (ledger plus a control file), and each extra surface is a permission rule, a GC rule, a path-identity question, and a failure identity.
- **KISS / paved road:** One kind, one key, one fold, one append path copied from the delivered non-claim append, one pre-claim read, one cycle-boundary re-read. Nothing new is invented except the three constants and the fold.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 durable | C-2 not a holder | C-3 no new error | C-4 no new key/kind change | C-5 identifier-only | C-6 one truth | C-7 bounded | C-8 fails closed |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no durable stop in the typed loop | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 state file (the shell mechanism) | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-2 reuse the lease `stop-requested` action | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 durable flag on an existing record | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 selected: additive `loop.stop` record under a loop-scoped key | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: No Durable Stop in the Typed Loop

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Ship the `loop` family without a durable operator stop; an operator who wants the loop to stop signals the process (SIGTERM/SIGINT) and nothing survives a restart.
- **Constraint compliance:** Passes C-2…C-8 vacuously (there is no durable intent to misread, misfile, or fail to read). Fails C-1: NFR-5 is exactly the property this omits, and the M4 blueprint's AC names it.
- **Driver fit:** Serves driver 4 (no new read) and fails drivers 1, 2, 3, and 7 outright.
- **Pros:** Zero design cost; no new record kind; no admission ordering to reason about.
- **Cons:** A restart silently re-arms an autonomous loop, which is the failure mode NFR-5 exists to prevent; the shell keeps a guarantee the typed loop lacks, so "parity" is false for the surface operators touch most.
- **Why rejected:** It is the requirement. A stop that a restart forgets is not a stop.

### Alternative 1 — A State File, as `scripts/ceo-loop.sh` Does Today

- **Eligibility:** Not eligible (fails C-3, C-6, C-8).
- **Summary:** Port `.ai/local/ceo/stop` into the typed loop: `loop stop` writes the file with a timestamp, `loop reset` deletes it, `loop start` (and each cycle) tests for its existence.
- **Constraint compliance:** Passes C-1 (a file survives a process), C-2 (a file is not a lease action), C-4, C-5, and C-7 (overwrite is inherently bounded). Fails C-6: it adds a second durable truth beside the ledger, with its own directory creation, permission bits, cleanup expectations, and path-identity questions. Fails C-8: `[[ -f ]]` cannot distinguish "absent" from "unreadable", so a permission error reads as "not stopped" — the one direction an autonomous loop must never fail in. Fails C-3: a filesystem write failure has no delivered identity; reusing `state.write.failed` would name a state append that did not happen, and an honest classification would need a new identity, which C-3 forbids.
- **Driver fit:** Serves driver 7 (one-sentence legibility against the shell) and fails driver 1 (a second truth), driver 3 (no transition history beyond a timestamp that `rm` destroys), and driver 4 (a second I/O surface per cycle).
- **Pros:** Maximal mechanism parity with the fallback; trivial to implement; operators already know the path.
- **Cons:** Two truths diverge the moment one is written and the other is not; the file has no audit trail (the timestamp dies with the file); it inherits the shell's own acknowledged weakness rather than the typed loop's strengths.
- **Why rejected:** It copies the shell's storage accident instead of its contract, and it fails closed in the wrong direction.

### Alternative 2 — Reuse the Coordinator's `stop-requested` Instance-Lease Action

- **Eligibility:** Not eligible (fails C-2 and C-4).
- **Summary:** Append a `coordinator.fence` record with action `stop-requested` against the loop's lease, and let `loop start` read it like any other lease record.
- **Constraint compliance:** Passes C-1, C-3, C-5, C-6, C-7, and C-8 (it is a ledger record, so the read is verified and the appends reuse the delivered identities). Fails C-2 decisively: `stop-requested` is in `COORDINATOR_LEASE_HELD_ACTIONS` (`packages/core/src/contracts/coordinator.ts:192-197`), so the lease fold treats a stopped loop as a *still-held* lease, and a held lease is refused `coordinator.already-running` (`packages/core/src/domain/coordinator-fence.ts:118-131`). The next `loop start` after a stop would be refused — the exact opposite of C-1's required exit 0 `state=stopped`. Fails C-4 as well: the action's contract is deliberately per-holder ("honoured only when the record's `instanceId` matches its own instance", `feature-coordinator-supervision.md:83`), so making a second surface honour it would widen a delivered action's meaning and its closed per-holder rule.
- **Driver fit:** Serves driver 6 (reuses the delivered kind) and fails drivers 1, 2, and 7 — the mechanism would be durable but unusable.
- **Pros:** No new record kind; the append path and the read path are entirely delivered.
- **Cons:** A stopped loop is indistinguishable from a live holder to every existing lease reader; the operator's only recovery would be to wait for a takeover or hand-repair the lease; the per-holder matching rule would have to be relaxed for the loop, changing coordinator semantics for a non-coordinator caller.
- **Why rejected:** The action answers a different question ("stop *this holder*") than the requirement asks ("this loop is stopped, whoever is holding it"). Reusing it inverts the outcome.

### Alternative 3 — A Durable Flag on an Existing Record

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Carry the stop as a field on a record the loop already writes — an iteration record, a restart record, or a line in the `log` file — and read the latest for the flag.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5, C-6, C-7, C-8. Fails C-4: no delivered record carries operator control intent. Adding a stop field to the iteration or restart payload changes a delivered payload schema, and those vocabularies are closed; reading control intent out of a log file is not a contract at all (the log is a human artefact with an unbounded, undeclared line format). It also blurs ownership: the iteration and restart records are supervision *evidence* whose producers are the cycle, and an operator command would become a writer of evidence it did not observe.
- **Driver fit:** Serves driver 4 (no new read) and fails drivers 1 and 3 — a flag on supervision evidence is not a readable account of who stopped what, when.
- **Pros:** No new kind; the fold already exists for those records.
- **Cons:** Evidence and intent become one record; every consumer of the iteration/restart payload inherits a field it must ignore; the log arm is unverifiable and unbounded.
- **Why rejected:** A control plane and an evidence plane that share a record cannot be reasoned about separately, and one of them is already published.

### Alternative 4 — Selected: An Additive `loop.stop` Record Under a Loop-Scoped Key

- **Eligibility:** Eligible.
- **Summary:** One additive record kind `loop.stop` (`delivery.loop.stop.v1`) under `loop.stops:<loopId>` (default `loop-main`), append-only and read latest-wins by ledger sequence. `loop stop` appends one `requested`; `loop reset` appends one `cleared` only when a stop is folded as requested; `loop start --foreground` folds the stop *before* claiming the instance lease and exits 0 `state=stopped` writing nothing when a stop is requested; a running loop re-reads the fold at every cycle boundary and terminates the session it holds within one collection interval plus the declared kill grace.
- **Constraint compliance:** Passes C-1…C-8 (matrix above): durable in the ledger; not a lease action so never a holder; append failures reuse the delivered `state.*` identities; no configuration key and no delivered kind, schema, or vocabulary altered; identifier-only payload; the ledger stays the single truth; idempotent appends keep the ledger bounded; a torn fold is a `state.*` failure rather than "not stopped".
- **Driver fit:** Best on every driver — one truth (1), durable by construction (2), a transition history with `requested`/`cleared` (3), the read rides the existing verified read (4), a declared cadence plus grace (5), the delivered boundary/fold/fence pattern reused (6), and one sentence of parity ("`loop stop` is the durable stop; `loop reset` clears it").
- **Pros:** The workspace keeps one durable truth and one failure vocabulary; every stop and clear is auditable; a refused start writes nothing, so no dead lease record is produced; the stop is independent of any holder, so it survives the crash-and-restart case that motivates it; the mechanism is testable offline over a doubled store.
- **Cons:** A new record kind joins the state-layer table and its retention (one record per transition, forever); during dual-run the shell's file and the record are two distinct controls; the operator must learn `loop reset` as the single clearing verb; the fold is another read a reviewer must see is pre-claim.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it encodes the shell's *contract* (durable, honoured until explicitly cleared, checked before work starts) without inheriting its storage accident.

## Decision

- **Decision:** Adopt **ALT-4**.

  1. **DC-1 — One additive record kind, loop-identity scoped.** `loop.stop` with payload schema `delivery.loop.stop.v1`, appended under the store key `loop.stops:<loopId>`; the loop identity defaults to `loop-main`. The payload carries the loop identity, the `action` from the new closed two-value vocabulary `requested | cleared`, and a timestamp; where the surface needs a closed field such as the requested stop mode, it is an additive field of this same payload schema and never a second record kind. No process identity (`pid`, process start time, holder, `instanceId`) and no free text appears. The ledger is append-only and the key is read latest-wins **by ledger sequence**, never by timestamp; `recordedAt` is descriptive only. (Spec NFR-5; `feature-state-layer.md:49,430-446`; TDR-0004.)
  2. **DC-2 — `loop stop` appends exactly one `requested` record, idempotently.** It appends one record carrying the action, the loop identity, and the timestamp; it appends nothing when the folded latest already requests a stop, so repeated stops are idempotent and bounded. It does not require a live holder: the intent must be durable, and a stop written before a loop starts is exactly the case C-1 protects. (Shell parity: `cmd_stop` writes the file unconditionally, `scripts/ceo-loop.sh:725-729`.)
  3. **DC-3 — `loop reset` appends exactly one `cleared` record, conditionally.** When a stop is folded as requested it appends one `cleared`; otherwise it appends nothing. Clearing is a transition in the same ledger, not a deletion, because the ledger has no delete and because the history of the clear is as auditable as the history of the stop. (Shell parity: `cmd_reset` reports "nothing to reset" when absent, `scripts/ceo-loop.sh:731-737`.)
  4. **DC-4 — `loop start --foreground` folds the stop before claiming the instance lease.** When the fold reports a requested stop, the command exits successfully (exit 0) with `state=stopped`, appends no lease record, spawns no session, and records nothing. This ordering is what makes the stop durable **across restarts**: a fresh process discovers the intent before it can claim, record, or spawn, and it leaves no trace that a loop ran. `stopped` is a delivered projection value, so no new observation vocabulary is introduced. (Spec NFR-5; `packages/cli/src/output/coordinator-text.ts:44-52`.)
  5. **DC-5 — A running loop re-reads the same fold at every cycle boundary.** When a stop is folded as requested, the loop ends at that boundary. When the requested transition asks the loop to terminate the session it holds, the termination goes through the delivered kill-with-grace, so that arm ends within one `coordinator.collection-interval` (default 30 000 ms; `packages/core/src/config/defaults.ts:87`) plus the declared `coordinator.kill-grace` (default 20 000 ms; `defaults.ts:84`); a transition that lets the current session finish ends the loop when that session ends. Which arm a stop requests is a property of the stop, not of this mechanism; this record fixes only that the fold is re-read at every cycle boundary and that the terminating arm is bounded by delivered keys. No per-cycle stop record is written.
  6. **DC-6 — The stop names the loop, never a process instance.** No `pid`, `processStartTimeMs`, `instanceId`, holder, or session identity participates in the fold or in the admission decision, so a stop written by one invocation is honoured by the next, and a stop never makes the loop look like a live holder (`COORDINATOR_LEASE_HELD_ACTIONS` is untouched, `packages/core/src/contracts/coordinator.ts:192-197`).
  7. **DC-7 — Failures reuse the delivered identities and fail closed.** An append failure is `state.write.failed`, or `state.lock.busy` when the non-claim append still finds the fence busy after its one stale recovery (`packages/core/src/state/coordinator.ts:620-662`); an unreadable or torn fold is the delivered `state.*` identity and never "no stop". No `loop.*` error identity, no new configuration key, and no change to a delivered record kind, payload schema, vocabulary, or error table row is introduced.

  **One deliberate divergence from the shell, recorded.** The shell checks its stop file only *between* sessions, so a stop written while a long CEO session runs is not even *observed* until that session ends (`scripts/ceo-loop.sh:635-641`; nothing polls the file during a session). This decision makes the running loop re-read the fold at every cycle boundary, so the stop is observed promptly and, when the requested transition terminates the held session, ends within one collection interval plus the declared kill grace. The divergence is bounded and justified by C-1 and driver 5: NFR-5 requires the stop to be honoured, and an autonomous loop that spends tokens for another hour before even noticing the request is honouring the letter of the file, not the requirement. A stop remains a request, not a remote kill: the loop performs only the termination the requested transition asks for, exactly as the delivered loop already terminates its own session.

### Constraint Compliance Attestation

ALT-4 satisfies C-1 through C-8. C-1: the stop is a ledger record, so a fresh process folds it before claiming and refuses to run. C-2: the stop is not a lease action, carries no holder identity, and leaves `COORDINATOR_LEASE_HELD_ACTIONS` untouched, so the next start is not refused `coordinator.already-running`. C-3: appends reuse `state.write.failed` and `state.lock.busy`, and no filesystem failure is classified as a state operation. C-4: one kind, one payload schema, one key, one two-value action vocabulary; no configuration key and no delivered kind, schema, or closed set changes. C-5: the payload is the loop identity, the action, timestamps, and only declared closed enumerations — no prompt, transcript, credential, message, free text, or process identity. C-6: the intent lives in the state ledger, which remains the single durable truth; no control file is created or read. C-7: at most one record per transition, and repeated operator commands append nothing. C-8: a torn or unreadable fold is a `state.*` failure and a refused spawn, never "not stopped". No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The workspace keeps exactly one durable truth for supervision, so an operator or a diagnostic reads one store, one failure vocabulary, and one retention rule instead of two.
- Every stop and clear is an auditable transition: the question "when was this stopped, and who cleared it?" has an answer that survives the clear.
- A refused start writes nothing at all — no lease record, no session, no observation — so a stopped loop never leaves a dead lease for the next invocation to take over.
- The mechanism is holder-independent, so the crash-and-restart case that NFR-5 exists for is the *easy* case rather than the hard one.
- The control read rides the loop's existing verified read, so no new I/O surface, no new per-cycle failure mode, and no new configuration key is introduced.
- The stop is *observed* faster than the shell observes its file (at the next cycle boundary rather than only between sessions); whether it ends then or after the session finishes is the requested transition's own property.

### Negative Outcomes

- A new record kind joins the state-layer table with forever retention: one record per stop/clear transition accumulates and is never pruned. Mitigation: C-7 bounds appends at one per transition, so the growth is the operator's own action count.
- During dual-run the two surfaces are distinct: `loop stop` does not stop `scripts/ceo-loop.sh`, and `ceo-loop.sh --stop` does not stop `jaiship loop`. Mitigation: INV-DM-4 keeps the shell as a fallback rather than a peer, prompt re-pointing is F5/F6, and the distinction is recorded as a revisit trigger.
- A stop is a request, not an immediate kill: the terminating arm's worst case is one collection interval plus the kill grace, and a transition that lets the session finish waits for that session. Mitigation: the interval and grace are delivered, operator-configurable keys; the terminating bound is declared here, and the arm is chosen at stop time rather than discovered.
- The operator must learn `loop reset` as the single clearing verb, and clearing appends rather than deletes — a mental model that differs from `rm .ai/local/ceo/stop`. Mitigation: the transition history is the reason, and one command per direction keeps the surface small.
- `loop start` gains an ordering obligation (fold before claim) that a future refactor can silently invert. Mitigation: the verification criteria assert zero lease records and zero sessions on a refused start, so an inversion fails a test.

### Unresolved Questions

- [ ] Should `loop status` project the folded stop (for example the last `requested`/`cleared` transition and its timestamp) as a first-class field? This record fixes the mechanism and the start admission only; the observation vocabulary belongs to the loop page and its own contract. (owner: `@spec-writer` / `@pm`)
- [ ] Is a `loop stop` expected to stop `ceo-loop.sh` on the same workspace during dual-run? Today it does not, by construction and by INV-DM-4's scope boundary; if operators assume otherwise, the handover/retirement path (F6) must state it. (owner: `@pm` / human owner)
- [ ] Does anything read the loop identity other than the default `loop-main` in M4? If a second identity is introduced, the stop's effective scope becomes narrower than the shell's per-workspace file and the parity statement must be restated. (owner: `@pm`)

## Implementation Plan

1. **Contract.** Declare the record kind `loop.stop`, the payload schema `delivery.loop.stop.v1`, the key prefix `loop.stops:`, the key helper, the closed action set `requested | cleared`, and any additive closed field the surface declares (a stop mode, for example) in one runtime-neutral contract module beside the coordinator vocabulary — no clock, filesystem, or process access in it.
2. **Boundary and fold.** Add a loop-segment reader over the verified state port that accepts only records under the loop key prefixes and classifies a wrong key, a malformed payload, or an unknown kind as the delivered `state.store.torn`/`state.store.unknown`; fold latest-wins by ledger sequence with `recordedAt` descriptive only.
3. **Appends.** Append through the delivered non-claim fence discipline (one acquisition, fence-status plus one stale recovery and one retry, `state.lock.busy` on a still-busy fence, `state.write.failed` on a failed append), with the "already requested → append nothing" guard folded from the verified read performed inside the same operation.
4. **Commands.** `loop stop` appends the `requested` transition; `loop reset` appends `cleared` only when a stop is folded as requested. No other command writes the kind.
5. **Start admission.** In `loop start --foreground`, fold the stop first; on a requested stop, return exit 0 with `state=stopped` before any lease claim, session resolution, or spawn. Preserve the ordering in a single named step so it is not reordered by a later refactor.
6. **Cycle.** Re-read the same fold at each cycle boundary; on a requested stop, end the loop, terminating the held session through the delivered kill path when the transition requests termination.
7. **Tests.** Cover: stop→start in a fresh process (exit 0, `state=stopped`, zero lease records, zero sessions); reset→start (one session); repeated stop and repeated reset (append counts); stop during a running loop (loop ends and the session is terminated within the declared bound); stop with no loop running; torn payload, unknown key, and failed read each producing a `state.*` failure and zero sessions; configuration key-set equality; the coordinator lease action and held-action sets unchanged.
8. **Documentation.** Add the kind to the state-layer record-kind table, state the stop contract on the loop page, and reconcile NFR-5's "stop/park signal" wording with the record mechanism.

## Verification Criteria

- `loop stop` with no loop running, then `loop start --foreground` in a fresh process over the same store: exit 0, `state=stopped`, exactly one `loop.stop` record with action `requested`, zero `coordinator.fence` records written by the refused start, zero sessions spawned.
- `loop reset` after that stop, then `loop start --foreground`: exactly one additional `cleared` record, one session, one `acquired` lease record; the fold reads the latest `cleared` as "not stopped".
- `loop reset` with no stop requested: zero records appended (the receipt wording is not part of this decision).
- `loop stop` issued N times without an intervening reset: exactly one `requested` record; `loop reset` issued N times after that stop: exactly one `cleared` record.
- A running loop with a stop requested mid-cycle: the stop is folded at the next cycle boundary; when the transition requests termination of the held session, the loop ends within one `coordinator.collection-interval` plus `coordinator.kill-grace`; no per-cycle stop record is appended.
- A torn payload, an unknown key under the loop prefixes, and a failed verified read each surface the delivered `state.*` identity, and `loop start` spawns no session.
- A busy fence maps to `state.lock.busy`, and a failed append to `state.write.failed`; the error-table drift check reports no new identity.
- The configuration key set is unchanged; `COORDINATOR_FENCE_ACTIONS` and `COORDINATOR_LEASE_HELD_ACTIONS` are unchanged; no delivered payload schema is modified.
- The payload of a stop record contains the loop identity, the action, the timestamp, and only declared closed enumerations where the surface needs one — no message, prompt, transcript, credential, free-text, or process-identity field.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: NFR-5 and INV-DM-4 in the autonomous-delivery spec; the shell's stop file, its three check points, and its two commands; the coordinator's four lease actions, its held-action set, its per-holder honouring rule, and the claim refusal that follows from a held lease; the state layer's single-truth and additive-kind contract with its forever retention; the delivered boundary, fold, fence, and failure-identity pattern; the delivered cadence and grace defaults; and `stopped` as an existing projection value. The residual uncertainty is operational, not technical: whether dual-run operators expect one stop to rule both surfaces, which is recorded as an explicit scope statement and a revisit trigger rather than assumed away.

## References

- Change: `doc/changes/2026-11/2026-11-19--GH-348--loop-supervision/chg-GH-348-spec.md` — §5.1 F-4, §8.3 DM-2, §15 DEC-2, §17.4 AC-F4-1…AC-F4-5; and `chg-GH-348-pm-notes.yaml` — clarify-phase notes (scope, the `loop`-beside-`coordinator` decision, the file-versus-lease question recorded for this record, the NFR-5/INV-DM-3/INV-DM-5 parity contract).
- Milestone: `doc/planning/oss-tooling/milestones/m4/backlog.md` (M4-S10 goal, tasks, and AC); `doc/planning/oss-tooling/milestones/m4/flip-plan.md` (F3 verification bar); `doc/planning/oss-tooling/milestones/m4/ranking.md`.
- Specs: `doc/spec/features/feature-autonomous-delivery.md` (INV-DM-4, NFR-5, the Mode A outer loop); `doc/spec/features/feature-coordinator-supervision.md` (§1, §1.1, §2, §8, §10); `doc/spec/features/feature-state-layer.md` (single durable truth, additive kinds, retention).
- Prior decisions: TDR-0004 (state storage engine); TDR-0005 (result enum and exit taxonomy); [TDR-0017](TDR-0017-coordinator-supervision-architecture.md) (coordinator supervision architecture and instance lease); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (a supervision decision encoded against shell parity, including the pattern of recording a deliberate divergence).
- Contracts and code (read 2026-11-19): `packages/core/src/contracts/state.ts`; `packages/core/src/contracts/coordinator.ts`; `packages/core/src/state/coordinator.ts`; `packages/core/src/domain/coordinator-fence.ts`; `packages/core/src/config/defaults.ts`; `packages/cli/src/commands/coordinator-loop.ts`; `packages/cli/src/output/coordinator-text.ts`.
- Parity reference (read 2026-11-19): `scripts/ceo-loop.sh` — `STOP_FILE` (line 95), the durable-stop check at the top of each iteration (lines 635-641), the post-session check (lines 704-708), `cmd_stop` (lines 725-729), `cmd_reset` (lines 731-737).
