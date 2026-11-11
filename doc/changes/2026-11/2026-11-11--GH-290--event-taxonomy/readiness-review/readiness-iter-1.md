# Readiness review — GH-290 — iteration 1

- **Verdict:** NOT_READY
- **Date:** 2026-11-11
- **Gate:** `@readiness-reviewer` (adversarial Definition of Ready)
- **Artifacts reviewed:** `chg-GH-290-spec.md` (v1.0, 38 ACs), `chg-GH-290-test-plan.md` (v1.0, 45 TCs), `chg-GH-290-plan.yaml` (7 phases, `tier: full`), `chg-GH-290-pm-notes.yaml`, ticket `juliusz-cwiakalski/agentic-delivery-os#290`, the M2 planning pack (`backlog.md` M2-S13, `m2/contracts.md` §Event taxonomy v1 and §S17 mapping, `m2/commands/events.md`, `m2/test-scenarios.md` SC-M2-S13-01/02, `m2/entrypoint-delta.md`), `doc/decisions/TDR-0024-public-event-taxonomy-v1-subscribe-surface.md` (untracked), `doc/spec/features/feature-resident-daemon.md` §Control protocol v1, and the delivered tree under `packages/core/src/{contracts,domain,app,state}` and `packages/cli/src`.
- **Pause required:** no — no finding needs a human decision before repair. RF-7 needs a TDR-0024 amendment, which follows the GH-286 RF-1 precedent (route to the record's owner, not a workflow stop).

## Facet summary

| Facet | Result |
|---|---|
| spec_completeness | FAIL (RF-3, RF-9) |
| ac_quality | FAIL (RF-2, RF-4, RF-6) |
| plan_coverage | FAIL (RF-1) |
| test_traceability | FAIL (RF-2, RF-3, RF-4) |
| cross_artifact_consistency | FAIL (RF-7, RF-8) |
| decision_capture | FAIL (RF-7, RF-8) |
| system_spec_consistency | FAIL (RF-5, RF-6, RF-8) |
| plan_doc_update_coverage | PASS (system and quality docs are covered by the Phase-7 folder scope; A-2 is a planning-corpus omission) |
| plan_code_area_coverage | FAIL (RF-1) |
| dod_defined | PASS (38 observable ACs plus per-phase gates; the untestable ones are scored above) |

## Blocking findings

### RF-1 [critical] — a delivered suite that counts the prompt-required set is in no phase scope, and `pnpm check` cannot be green

**Artifacts:** plan Phase 5 `scope.files` (lines 379-392) and Phase-7 gate (line 465); spec §8.5 permitted-edit derivation (line 402); test plan §7 (line 1658).

**Gap:** `tests/structure/daemon-production-composition.test.ts` asserts the prompt-required count three times and is declared in no phase.

**Evidence:**
- `tests/structure/daemon-production-composition.test.ts:71` — `expect([...PROMPT_REQUIRED_COMMANDS]).toHaveLength(18)`.
- `:138` — the same assertion in "a composition with every optional input absent".
- `:121` — `expect(mutated.PROMPT_REQUIRED_COMMANDS).toHaveLength(17)` (the daemon-omission mutant).
- `grep "daemon-production-composition"` over `chg-GH-290-plan.yaml` and `chg-GH-290-test-plan.md` returns nothing: it is in no `scope.files`, no phase gate, and no test-plan row.
- Phase 5 owns the mount; Phase 7's gate is `TMPDIR="$PWD/tmp/tmpdir" pnpm check`, which runs this suite.

**Why it blocks:** adding `events` turns 18 → 19, so lines 71 and 138 fail and the mutant at 121 fails too. The commit primitive stages only declared phase scope, so the repair cannot legally land where the red appears. The spec's "permitted-edit set is **derived, not enumerated** … found by searching the suites for those literals" is the root cause: the heuristic searches for command-name literals and therefore misses a bare count. That is the same defect class as GH-286 RF-3.

**Remediation:** declare `tests/structure/daemon-production-composition.test.ts` in Phase 5 `scope.files` and add it to the Phase-5 gate; correct its three counts (19, 19, 18); restate spec §8.5's edit-set rule to include count assertions (or enumerate the set), because a count is not a literal name.

**Reopen:** `delivery_planning`, `specification`.

### RF-2 [critical] — the nullable `lane` contract has no legal witness, and TDR DC-2 contradicts the spec's lane rule

**Artifacts:** spec §5.1 F-1 topic table (line 167), AC-F3-1 (line 564), §23 glossary "Lane" (line 676); test plan TC-EVT-022 step 4 and its precondition bullet; TDR-0024 DC-2 (line 300).

**Gap:** `AC-F3-1` requires `lane` to be "present and `null` where no lane holds the subject", but none of the four declared lane rules can produce `null`, and the one fixture the test plan relies on cannot exist.

**Evidence:**
- The four declared lane rules are the entry `ref`, the delivery `ref`, the `changeRef`, and "the blocker's recorded `lane`".
- `packages/core/src/contracts/blockers.ts:205` — `readonly lane: string` (not nullable); `packages/core/src/state/blockers.ts:66` — `{ name: "lane", type: "string", required: true }`; `:269` — `if (!isNonEmptyString(value.lane)) return fail(...)`.
- `packages/cli/src/commands/blockers.ts:139-141` — `blockers publish` **requires** `--lane`.
- TC-EVT-022 precondition: "A blocker question published with no recorded lane (the null-lane cell)"; step 4: "assert the null cell occurs for the lane-less blocker question".
- TDR-0024 DC-2: "`lane` is `null` when no lane holds the subject (an unleased queue entry)" — which directly contradicts the spec's `queue.graph` rule ("the entry `ref`") and TC-EVT-020 step 4 (`lane === "GH-999"` for an unleased entry).

**Why it blocks:** the AC's nullable clause is unprovable, TC-EVT-022 step 4 cannot pass against the delivered record shape, and the governing decision record states a different lane rule than the spec it is said to authorise unchanged.

**Remediation:** choose one contract and apply it in all three artifacts — either (a) `lane` is non-null on every v1 event and the AC drops the null clause and TC-EVT-022 drops the cell, or (b) `lane` names the holding lane (null when unleased), which changes the `queue.graph` and `dispatch.attempt` lane rules and TC-EVT-020's assertions. Amend TDR DC-2 to match.

**Reopen:** `specification` (+ TDR amendment), `test_planning`.

### RF-3 [critical] — the envelope's `ref` is undefined for `blockers.state`, and the test asserts a value the shipped producer never writes

**Artifacts:** spec §5.1 F-3 blockers rows (lines 218-220), AC-F3-1 (line 564), DM-2 (line 382); test plan TC-EVT-022 step 5.

**Gap:** `ref` is declared as "the subject identity" and required on every event, but a blocker question's `ref` is nullable and the shipped command always records `null`.

**Evidence:**
- `packages/core/src/contracts/blockers.ts:206` — `readonly ref: string | null`.
- `packages/core/src/domain/blockers.ts:221-223` — `const ref = input.ref === undefined || input.ref === null || input.ref === "" ? null : input.ref`.
- `packages/cli/src/commands/blockers.ts` — the publish path passes no `ref` (flags are `--lane`, `--options`, `--audience`, `--choice`, `--text`), so every CLI-published question has `ref: null`.
- TC-EVT-022 step 5: "Assert `ref` is a non-empty string on every frame".
- The spec's blockers payload table lists `id, type, audience, question, options[], askedAt` and never says what the envelope `ref` is for this topic.

**Why it blocks:** a `blockers.state.published` event produced by the shipped path has no non-null `ref`, so TC-EVT-022 cannot pass for a production-shaped question; and the declaration is silent on the one envelope field that a client must key on.

**Remediation:** declare the `ref` rule per topic (for `blockers.state`: the question id, or the record's nullable `ref` with the envelope field declared nullable), add it to the F-1/Appendix F tables, and align TC-EVT-022's assertion and fixture with the declared rule.

**Reopen:** `specification`, `test_planning`.

### RF-4 [major] — `emitted: true` on the snapshot `snapshot` kind makes AC-F3-7 and TC-EVT-027 unsatisfiable

**Artifacts:** spec §5.1 F-2 (line 199, "`emitted: false` appears exactly once"), AC-F3-7 (line 570), AC-F6-2 (line 593); test plan TC-EVT-051 step 2, TC-EVT-027 step 3.

**Gap:** `queue` and `lanes` declare one kind `snapshot` that counts as emitted, but no frame on those topics carries a `kind`, so the "emitted set equals declared set minus non-emitted kinds" comparison can never observe them.

**Evidence:**
- `packages/core/src/domain/control-session.ts:199-204` — a snapshot frame's `data` is `{ topic, cursor, snapshot }`; there is no `kind`.
- TC-EVT-051 step 2: "Assert `kinds.length === 1` with `name === "snapshot"` and `emitted === true`".
- TC-EVT-027 step 3: "Assert set equality — … no missing pair (every emitted kind appeared at least once)", over distinct `(topic, kind)` pairs collected from frames (step 1).
- AC-F3-7 says the equality holds "per topic", which includes the two snapshot topics.

**Why it blocks:** TC-EVT-027 fails on `(queue, snapshot)` and `(lanes, snapshot)`, or it is silently narrowed to the four event topics while the AC still claims a per-topic equality. Either way the pin is not what the AC says.

**Remediation:** either mark the snapshot kind `emitted: false` (which requires changing "appears exactly once" to twice and reconciling AC-F2-5/AC-F3-7), or define the snapshot frame as the emission of its kind and scope AC-F3-7 and TC-EVT-027 to event topics explicitly. State the choice in F-2, F-6 and DEC-B.

**Reopen:** `specification`, `test_planning`.

### RF-5 [major] — NFR-2's read model does not exist in the delivered state port, and TC-EVT-081's page bound has no seam

**Artifacts:** spec NFR-2 (line 411), AC-NFR-2 (line 618), §5.1 F-3 source map, RSK-2; test plan TC-EVT-081 steps 1 and 6; plan Phase 3/4 goal text.

**Gap:** the ACs promise "at most one bounded read per source ledger per tick (≤ 4 ledgers for the event topics)". The port has no per-ledger read: every delivered fold calls one whole-store `readRecords()`.

**Evidence:**
- `packages/core/src/contracts/state.ts:338-341` — `readRecords(): StateResult<{ records, evidence }>` takes no prefix, page, or limit.
- `packages/core/src/app/queue.ts:409-410` — `const verified = store.readRecords()` inside the local `readRecords` helper used by `readQueueEntries`, `readQueueDependencies`, `readQueueLeases`, `readQueueParks`.
- `packages/cli/src/daemon-compose.ts:336-355,384` — the delivered `stateChanges()` already performs two whole-store reads per tick (`readQueueEntries`, `readDaemonLanes`).
- The four event topics need eight source folds plus the lane read for `resumeIntent`; `readChangeTransitions` is keyed by `changeRef` (`packages/core/src/state/registry.ts:288`), and no change index is delivered or declared, so a per-change loop would be one whole-store read per change.
- TC-EVT-081 step 1 ("≤ 4 for the four event planes, plus the delivered snapshot reads") and step 6 ("the number of records read per tick equals a bounded page (not the whole ledger count)") both contradict the port.

**Why it blocks:** the acceptance test as written cannot be green, and RSK-2's mitigation ("one bounded ledger read per tick") names a mechanism that does not exist. It also hides a real design decision the plan does not declare: to hold the added-latency budget, the tick must perform **one** `store.readRecords()` and hand the same view to both the snapshot and event projections, which is a restructure of `createWatchState`/`stateChanges`/`publishState`, not "the snapshot projection gains four event topics".

**Remediation:** restate NFR-2 and AC-NFR-2 over the delivered seam ("one `store.readRecords()` per tick, folded once for every plane; no additional store scan per topic; no socket, probe, or sleep on the publish path"), delete the "≤ 4 ledgers" and page claims, re-derive TC-EVT-081, and declare the shared-read restructure in Phase 4's goal and Phase 3's projection signature.

**Reopen:** `specification`, `test_planning`, `delivery_planning`.

### RF-6 [major] — the truncation marker has no legal home and no declared cut order

**Artifacts:** spec AC-NFR-4 (line 620), NFR-5 (line 414), EVT-1 (line 371), DM-2 (line 382); test plan TC-EVT-083 steps 2-3, TC-EVT-022 step 7.

**Gap:** an over-bound event must carry `payload.truncated` and `payload.truncationReason`, but neither field is declared for any kind, and the envelope/payload rules forbid them.

**Evidence:**
- AC-F3-1 and TC-EVT-022 step 2 require `data` to have exactly the eight declared keys — so the marker cannot live at `data` level.
- EVT-1: "`payload` carries only its kind's declared fields"; TC-EVT-022 step 7: the observed payload union must be a subset of the declared `payloadFields`.
- No kind's `payloadFields` (F-3 table, Appendix E) contains `truncated` or `truncationReason`.
- TC-EVT-083 step 2 explicitly asserts `payload.truncated === true` and `payload.truncationReason === "frame-max-bytes"`.
- The delivered precedent puts the marker **outside** `data`, at frame top level (`packages/core/src/domain/watch-stream.ts:15-26`), which EVT-1's field rule forbids for control frames.
- No AC declares which fields a bound cuts first, so "cut" is undefined for the projection.

**Why it blocks:** two ACs and two TCs assert mutually exclusive shapes, and delivery has no declared rule for what to drop — so any implementation picks one AC to violate.

**Remediation:** declare the truncation contract in one place: either add `truncated`/`truncationReason` to a declared, optional, taxonomy-wide payload trailer (and relax EVT-1/TC-EVT-022 step 7 accordingly), or forbid the truncation path by proving every declared payload fits the bound (bounded caps already exist for blocker text and evidence refs) and delete AC-NFR-4's marker clause. In either case state the cut order.

**Reopen:** `specification`, `test_planning`.

### RF-7 [major] — `occurredAt` and sequence durability contradict TDR-0024, which the plan commits unamended

**Artifacts:** TDR-0024 DC-2 (line 300) and Implementation Plan item 2 (line 375); spec AC-F3-1, F-3 (line 204), DEC-D (line 487), DEC-I (line 492), Appendix B (line 703), §15 closing paragraph (line 498); test plan TC-EVT-020 steps 4/7, TC-EVT-032, §2 reference row; plan header SOURCES (lines 17-22) and Phase 7 `scope.files` (line 482).

**Gap:** the spec and test plan implement a source-record timestamp and a process-scoped counter; the binding record says injected-clock timestamp and "allocated from the durable state revision".

**Evidence:**
- TDR DC-2: "`occurredAt` is an injected-clock ISO-8601 UTC timestamp string."
- Spec §5.1 F-3: "`occurredAt` is the source record's own ISO-8601 UTC timestamp, so a re-observation of the same record yields the same value"; TC-EVT-020 step 4/7 asserts equality with the durable record's `recordedAt` and "not the tick time".
- TDR Implementation Plan item 2: "a per-(topic, lane) monotonic `sequence` allocated from the durable state revision".
- Spec DEC-I / AC-F4-3 / TC-EVT-032: process-scoped, "not seeded from a ledger", a restart restarts the counters.
- Spec §15: "`TDR-0024` … is consumed unchanged"; plan header: the Phase-7 commit "stages it unchanged because it is the only untracked artifact"; Appendix B maps DC-2 to DEC-B/DEC-D/DEC-G without noting either divergence.

**Why it blocks:** the change would ship a decision record that contradicts the implementation it governs, in the same commit, and one of the two `occurredAt` readings is directly test-visible. The spec's choice is the better one (stable re-observation); the record is what must move.

**Remediation:** amend TDR-0024 DC-2's `occurredAt` sentence to the source-record timestamp and its Implementation Plan item 2 to a process-scoped, non-durable counter (via `@decision-advisor` with the owner's acceptance at PR review), or change the spec to the record. Add the amendment to Phase 7's scope note so "unchanged" stops being claimed.

**Reopen:** `specification`, `delivery_planning` (Phase-7 note), TDR-0024 amendment.

### RF-8 [major] — DEC-L's delivered-behaviour premise is false: an unknown topic is accepted today, not refused

**Artifacts:** spec §2.1 (line 68), §2.2 "One mistake has no identity" (line 91), §8.5 (line 400), §18 "Disclosed behaviour change" (line 631), DEC-L (line 495); test plan TC-EVT-075 objective.

**Gap:** the spec states that a `subscribe` for a topic outside the closed set "was decoded and then refused as `daemon.state-recovery-failed`" and that the change leaves "the frame shape unchanged; only the identity in the error object differs". The delivered code accepts it and serves the `lanes` snapshot under the requested topic name.

**Evidence:**
- `packages/cli/src/daemon-compose.ts:1164-1171` — `subscribe: (payload) => { const snapshot = watchState.snapshot(payload.topic); if (snapshot === undefined) return { ok: false, code: "daemon.state-recovery-failed" } … }`: the refusal key is an unreadable snapshot, not an unknown topic.
- `:384` — `const snapshotOf = (topic) => topic === "queue" ? queueWatchSnapshot(store) : lanesWatchSnapshot(store)`: any topic other than `queue` resolves to the **lanes** snapshot.
- `packages/core/src/domain/control-session.ts` `subscribe` validates only the capacity bound; `packages/core/src/domain/control-codec.ts:94-124` does not validate the topic value.
- So today `subscribe { topic: "status" }` returns `{ ok: true, subscriptionId }` and then a frame carrying the lanes snapshot labelled `topic: "status"`.
- §2.1 also states "Subscriptions are accepted only for those two topics", which is false at runtime and contradicts §2.2's own claim in the same document.

**Why it blocks:** the change replaces an *accepted, wrongly labelled subscription* with a refusal — a larger and differently shaped behaviour change than the spec discloses — and the false premise is scheduled to be written into `doc/spec/features/feature-resident-daemon.md` and the result-contract page in Phase 7. The refusal itself is the right outcome; the description is not.

**Remediation:** restate §2.1, §2.2, §8.5, §18 and DEC-L over the real behaviour (accepted today with the lanes snapshot; refused after this change as `events.topic-unknown`, which also removes a wrong-data path), delete the "only the identity differs" sentence, and add the removal of the wrong-label acceptance to the disclosed-change list and the doc-impact bullets.

**Reopen:** `specification`.

### RF-9 [major] — `queue.graph.release` declares a `parkCause` field its declared source record does not have

**Artifacts:** spec §5.1 F-3 `release` row (line 210), Appendix E (line 749), AC-F2-5 / AC-F1-5; EVT-4 (line 374).

**Gap:** the `release` payload declares `parkCause?`, but `queue.lease` carries no such field; a `queue release --park` writes a separate `queue.park` record.

**Evidence:**
- `packages/core/src/contracts/queue.ts:42-57` — `QueueLeaseRecord` = `leaseId, scope, repository, holder, ref, runner, weightClass, operation, acquiredAt, heartbeatAt, ttlMs, recordedAt, takeover?`. No park cause; `grep parkCause packages/core/src/contracts/queue.ts` hits only the preemption projection at `:555`.
- `packages/cli/src/edge.ts:4460-4490` — `release` builds a `park: {cause, condition, recheckMs}` and `releaseQueueLease` writes it as a park record (`released.value.park`), returned separately from the lease.
- Appendix E maps `release` to "`queue.lease` … with `operation: released`" only.
- EVT-4 lists `queue.park` among the consumed records, but no declared kind consumes it.

**Why it blocks:** a declared payload field with no producer in the declared source is the exact failure mode AC-F2-5 and the `emitted` flag exist to prevent — the field is either always absent (a phantom) or requires an undeclared two-ledger join with its own watermark problem.

**Remediation:** either drop `parkCause?` from the `release` payload, or declare the join explicitly (source = the `queue.park` record written by the same release, statement of what happens when the park record is observed on a later tick), add `queue.park` to Appendix E's map, and align TC-EVT-022's payload expectations.

**Reopen:** `specification`.

## Advisory findings

| ID | Severity | Finding | Reopen |
|---|---|---|---|
| A-1 | minor | Undeclared payload renames/derivations: `completed.comparisonClass` from `comparison.class` (`dispatch.ts:92-98,203`), `updated.resumeMode` from `laneResume.mode` (`blockers.ts:226-231`), `cleared.id` from `resumeIntent.questionId`, `cleared.clearedAt` from the lane record's `recordedAt` (`daemon.ts:163-165`), and the payload `ref` duplicating the envelope `ref`. State each derivation in F-3 so a client and a test can tell a rename from a missing field. | specification |
| A-2 | minor | The ticket's delivery convention "Maintain `doc/planning/oss-tooling/` (backlog markers, status)" is uncovered: spec §16 does not list `doc/planning/oss-tooling/backlog.md` (M2-S11 carries a "Progress: delivered by GH-288" line, the precedent) and Phase 7's goal list does not name it; only the folder glob would permit the write, and no gate would notice its absence. | specification, delivery_planning |
| A-3 | minor | The M2 page reconciliation is assigned to two different phases: TDR DC-1, spec RSK-1 and test plan §7 (TC-EVT-062 "update, phase 7") say "phase-7 doc sync"; the plan reconciles it in Phase 5 because the Phase-5/6 gates read the page. Pick one and fix the other two. | delivery_planning, test_planning |
| A-4 | minor | Test plan §7 lists `entrypoint-help.test.ts`, `entrypoint-help-coverage.test.ts` and `entrypoint-composition.test.ts` as "(update)" in the TC rows and also in the "Delivered suites used as unmodified controls" paragraph (line 1719). Separately, the plan's TC map omits TC-EVT-016's `event-taxonomy-single-source.test.ts` half, which §7 assigns to Phase 6. One inventory per fact. | test_planning, delivery_planning |
| A-5 | minor | The watermark is named but not defined. `blockers.state` derives its three kinds from three different ledgers (`blocker.question`, `blocker.answer`, the lane's `resumeIntent`), so a single scalar per `(topic, lane)` cannot separate them, and TC-EVT-082's "entry count ≤ number of lanes" asserts a bound the design may not meet without replay or loss. Declare the watermark's identity (record key or append position per source) and its bound. | specification, test_planning |
| A-6 | nit | TDR-0024's Problem Framing declares "any new … error identity" out of scope while DC-4 declares the three `events.*` identities; the record is committed unamended, so it ships with the contradiction. | TDR-0024 amendment |
| A-7 | nit | Two stale citation/coverage details: `daemon.ts:22` is cited for the subscription buffer but `DAEMON_DEFAULT_SUBSCRIPTION_BUFFER = 256` is at `:23`; EVT-4 lists `queue.park` among consumed records although no declared kind consumes it (see RF-9). | specification |
| A-8 | nit | Phase 2 edits `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` but its gate does not run the inventory guard (Phase 3 and Phase 7 do); Phase 7 also declares `doc/00-index.md`, which spec §16 says needs no change. Harmless, but the gate/scope pair should agree. | delivery_planning |

## Verified sound (do not re-litigate)

- **Ticket coverage.** All three ticket ACs are mapped and tested: `queue.graph` entry+dependency through the delivered server/session (`AC-F3-2`, TC-EVT-020/021/023); version pinned by comparison (`AC-F1-3`, TC-EVT-003/006/011/022); overflow preserved for every topic (AC-F5-1..3, TC-EVT-040/041/042). The "extend beyond status/lanes" task is handled correctly (`status` is a wire type, `control.ts:25-40`).
- **DEC-B and DEC-C hold against the code.** `CONTROL_TOPICS = ["queue","lanes"]` (`control.ts:39`); the snapshot frame is exactly `{topic,cursor,snapshot}` (`control-session.ts:199-204`); the cursor is a per-topic revision from `lastPublished` (`control-server.ts:317-337`); overflow emits one `degraded` `subscriber-overflow` frame to the overflowing subscription only and drops only that subscription (`control-session.ts:195-220`); the capacity bound is the same `daemon.subscription-buffer` (default 256) and refuses with `daemon.subscriber-degraded` (`:186-194`). The additive stamp is legal: the codec validates body presence, not fields inside `data` (`control-codec.ts:103-124`).
- **DEC-G holds.** A version stamp inside `data` outside `payload` is additive and decodable by the delivered codec; `data` is open to extra fields.
- **DEC-H holds.** `since` seeds only `lastCursor`, which is reported and never used to filter (`control-session.ts:186-204, 228-236`); no event is suppressed or refused by it.
- **`phase.state.began` derivation is real.** `foldPhaseState` sets `started: previous?.started ?? transition.timestamp` on `complete` (`packages/core/src/state/registry.ts:377-397`), so "no prior `started`" is the first completion and a reopen-then-complete emits only `completed`. The declared derivation is honest and testable (DECL-G2, TC-EVT-025).
- **`queue.graph.remove` as `emitted: false` is honest.** No delivered verb removes an entry (`queue.ts` handlers: `ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, `release`, plus `--watch`); the S15 reason vocabulary `landed|abandoned|superseded|reconciled` matches `contracts.md`.
- **Each emitted kind has a delivered producer.** `queue.entry`/`queue.dependency`/`queue.lease` appenders, `daemon.lane` in state `delivering` (`daemon-supervision.ts:127`), `dispatch.attempt` with `HARNESS_OUTCOMES` including `refused`, `phase.transition` `complete|reopen`, `blocker.question`/`blocker.answer`, and the lane `resumeIntent` consumer (`daemon-compose.ts:426-464`).
- **The kind-set decision is correct.** `contracts.md` §Event taxonomy v1 enumerates 4/3/3/3 and assigns stop/parked/resumed/park-edge to S17; `m2/commands/events.md` prints 6/4 and stop/park/resume prose. DEC-A's authority call and the S17 boundary are right, and TC-EVT-002's token scan is the right pin.
- **The mount is genuinely one unit, and its guard set is nearly complete.** `PROMPT_REQUIRED_COMMANDS` is 18 today (`prompt-required-commands.ts:11-30`); `coverage.commands` is 18 and equals it (`tests/fixtures/help-guide/coverage.json`); `entrypoint-help-coverage.test.ts` hard-codes the 18-list and is in Phase 5 scope; `entrypoint-composition.test.ts`'s `EXPECTED` list is in scope; `entrypoint-help.test.ts` omits `coordinator`/`projects` as §8.5 says and needs no edit; `tests/fixtures/entrypoint/programs.ts` derives from the constant; `doc-conformance.test.ts`'s `PROMPT_REQUIRED_PAGES` is a hand list that needs no extension because the events page lives under the M2 root.
- **Additivity is otherwise real.** `DOMAIN_KINDS` lives in `error-table.ts` (Phase 1 scope); `AppErrorCode` is `string` (`result.ts:30`) so new rows need no union edit; `projection.ts` already maps `user-validation → 1` and `platform-provider → 2`; `STATE_SCHEMA_VERSION` is untouched; no `.opencode/**` prompt carries an allowed-command list (`tests/fixtures/prompt-inventory/lifecycle.json` scans five files for unrelated rules).
- **Inventory and allowance mechanics are correctly placed.** `tests/structure/inventory.json` covers package sources only (new test files need no row), and every new production module is declared in its phase with `inventory.json` and `content-inventory.test.ts` (`taxonomy.ts` Phase 1, the command/output modules Phase 2, the projection Phase 3). `tests/fixtures/ports/v1-contract-inventory.json` inventories contract modules only, so `taxonomy.ts` is the only addition.
- **Phase ordering avoids the strict-selection trap.** `events` is registered from Phase 2 and prompt-required only in Phase 5, and no Phase 1–4 gate asserts selection; the daemon/`projects` precedent supports this.
- **Traceability is complete on paper.** 38 ACs ↔ 45 TCs with no orphan and no TODO; the ledger-vs-45 map in the plan header is complete (49 entries, 4 dual-half TCs, 45 unique); the five substitute assertions are declared rather than hidden.

## Reopen routing

| Phase | Findings |
|---|---|
| `specification` | RF-2, RF-3, RF-4, RF-5 (NFR-2/AC-NFR-2), RF-6, RF-7 (spec side), RF-8, RF-9, A-1, A-2, A-5, A-7 |
| `test_planning` | RF-2 (TC-EVT-022), RF-3 (TC-EVT-022), RF-4 (TC-EVT-027/051), RF-5 (TC-EVT-081), RF-6 (TC-EVT-083/022), A-3, A-4, A-5 |
| `delivery_planning` | RF-1, RF-5 (Phase 4 goal and shared-read restructure), RF-7 (Phase-7 staging note), A-2, A-3, A-4, A-8 |
| TDR-0024 amendment (via `@decision-advisor`, owner acceptance) | RF-2 (DC-2 lane rule), RF-7 (DC-2 `occurredAt`, Implementation Plan item 2), A-6 |

No finding targets `delivery`.
