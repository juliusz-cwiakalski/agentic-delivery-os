# Review — GH-290 — iteration 1

- **Status:** FAIL — one reproduced correctness/data-loss defect in the projection's per-tick budget (**B-1**), plus contract-honesty gaps in the "single source cannot drift" claim and the documentation-impact set.
- **Date:** 2026-11-12
- **Reviewer:** `@reviewer` (local ADOS mode)
- **Branch:** `feat/GH-290/event-taxonomy` vs `main-tools` (`main-tools` = `355ce2d5`, HEAD = `46bfec02`)
- **Artifacts:** spec v1.4 (38 ACs), test plan v1.3 (45 TCs), plan (8 phases, all complete), pm-notes (8 phase notes), TDR-0025 (`Proposed`, amended in place)
- **Scope:** first review. All 38 ACs and 45 TCs audited against the shipped code (not the plan's claims), plus the taxonomy/projection/overflow/mount/additivity/docs axes named in the brief.

## Summary

The change is large but disciplined. The declaration is accurate and validated; the reference surface is genuinely generated from it; the control-plane widening, the unknown-topic refusal, the additive degraded-frame stamps, the mount, the error rows and the changeset are all implemented as specified, and every delivered control/watch/queue/lanes/heartbeat suite still passes unmodified. All 158 event suites and the 228 changed-gate tests are green.

Three things keep it from passing. First, the projection's per-topic per-tick budget treats the `began`/`completed` pair as *three* units, so at one exact budget value the `began` is emitted and its `completed` is skipped while the watermark has already advanced past it — a silent, permanent event drop. This is reproduced below at a small cap and follows arithmetically at 64. Second, the "one authored source / a second copy cannot drift" claim is not true for the *emission projection*: `event-projection.ts` imports only `TAXONOMY_VERSION` and hand-codes every kind and payload; the "single-source" scan cannot see it, the drift tests feed fixture-built frames rather than the real projector, and the shipped spec page states the opposite ("cannot drift apart"). Third, the documentation-impact set is breached: a brand-new system spec page and a `doc/00-index.md` row were added although spec §16 and the plan explicitly say no new spec page exists and `doc/00-index.md` needs no change, and neither is declared in a phase scope or disclosed in the pm-notes.

Two narrower correctness nits (same-tick dependency deltas computed against tick-start rather than the previous record; `events describe` with no topic reporting “`describe` is not an events verb”) and several weak-test cells are non-blocking but should be fixed in the same pass.

## Evidence run

| Check | Result |
|---|---|
| All GH-290 suites: `bun test tests/behaviour/events-*.test.ts tests/structure/event-*.test.ts tests/checks/event-*.test.ts tests/conformance/events/real-socket-subscribe.test.ts tests/golden/events-reference-page.test.ts` | 158 pass, 0 fail |
| Changed delivered gates: `error-table`, `error-table-sync`, `content-inventory`, `daemon-production-composition`, `reference-page-parity`, `entrypoint-help-coverage`, `help-guide-coverage`, `exports-parity`, `prompt-conformance` | 228 pass, 0 fail |
| Delivered control/daemon/watch suites (`control-codec`, `control-connection`, `control-session`, `daemon-watch-state-changes`, `queue-watch`, `lanes-watch`, `daemon-heartbeat`, `daemon-degradation`) | 30 pass, 0 fail |
| `events-tick-cost` log | `publish=1 heartbeat-fold=2 delivered-append=3 total=6`, p95 0.13 ms |
| `events-mount-help` log | root `--help` 46 lines / 1821 bytes, 19 families |
| `error-table-sync` | entries=127 documented=127 |
| Independent probe: projector with `maxPerTopicPerTick: 2`, one change with two first-completions | **tick1 `began` only; tick2 `began` only; every `completed` dropped** (B-1) |
| Independent probe: two `queue.dependency` records for one ref in one view | both diffed against tick-start; second `removed` is `[]` where it should name the edge the first record removed (M-2) |

## AC matrix (38)

Legend: PASS = observable proven in the shipped code; PARTIAL = proven in substance but a stated clause is false or an edge is unproven; FAIL = the criterion's observable is violated.

### F-1 Taxonomy declaration (5)

| AC | Verdict | Note |
|---|---|---|
| AC-F1-1 | PASS | `taxonomy.ts:88-328` = six topics, `status` absent, `queue.graph` the only parent, every topic declares shape/frame/lane/ordering/overflow/kinds; pinned by `event-taxonomy-declaration.test.ts:29-73`. |
| AC-F1-2 | PASS | Kind sets 4/3/3/3 exact, no S17 kind (`taxonomy.ts:121-326`; declaration test `:109-142`). |
| AC-F1-3 | PASS (caveat) | Declaration drift in version/kind/payload/ordering/overflow fails named tests (declaration `:110-116`, describe `:159`, ordering-contract `:15-30`, overflow-carriage `:21-25`). The dedicated drift suite is oracle-only — see M-1. |
| AC-F1-4 | PASS | `validateTaxonomy` (`taxonomy.ts:368-476`) covers every class; `events.ts:129-141` maps a failing declaration to `events.taxonomy-unavailable` exit 2 with no data (`events-errors.test.ts:54-86`). |
| AC-F1-5 | PASS | Unknown `data` fields decode (`events-decode-additive.test.ts:85-89`); declared payload lists are pinned exactly (`events-describe.test.ts:152-163`). |

### F-2 Reference surface (5)

| AC | Verdict | Note |
|---|---|---|
| AC-F2-1 | PASS | `events list --json` exits 0 with `taxonomyVersion`/`envelope`/six records exactly equal to the declaration (`events-list.test.ts:92-103`). |
| AC-F2-2 | PASS | Text names shape/kinds+`emitted`/payload/lane/ordering/overflow/frame; ≤40 lines/8192 bytes; one `--json` record (`events-describe.test.ts`, `events-purity.test.ts:76-91`). |
| AC-F2-3 | PASS | Unknown topic (incl. `status`) → `events.topic-unknown` exit 1 naming topic+six names; absent/unknown verb → `events.verb-unknown` naming list/describe (`events-errors.test.ts:15-52`). Message nit for `events describe` with no topic — L-3. |
| AC-F2-4 | **PARTIAL** | Purity is proven (no store/config/composer). But the quoted envelope `{ ok, command, data, error?, warnings? }` is not the delivered shape: it is `{ schemaVersion, runId, exitCode, timing, data|error }` (`packages/cli/src/index.ts:310-323`, `doc/spec/features/feature-result-contract.md:24,102`). `data.command` does carry `events list`/`events describe`. See L-1. |
| AC-F2-5 | PASS | Every `queue.graph` kind non-empty, `remove` alone `emitted:false`, union derived (`events-describe.test.ts:125-151`). |

### F-3 Envelope and per-topic emission (7)

| AC | Verdict | Note |
|---|---|---|
| AC-F3-1 | PASS | Eight keys in order, non-empty `lane`, per-topic `ref`, `occurredAt` from source, no `cursor` (`events-envelope-conformance.test.ts:114-161`). |
| AC-F3-2 | PASS | `entry` then `dependency-edge` with exact payloads (`events-subscribe-queue-graph.test.ts:26-86`). |
| AC-F3-3 | PASS | Identical folded edge set publishes nothing (`events-dependency-delta.test.ts:55-58`). |
| AC-F3-4 | PASS | `started`/`refused`/`completed` with `outcome` named for every other outcome (`events-subscribe-dispatch.test.ts`). |
| AC-F3-5 | **PARTIAL** | Normal case: `began`+`completed` ascending, later `completed` only, `reopened` with reason (`events-subscribe-phase.test.ts`). At the per-topic cap boundary the pair is not atomic and the `completed` can be lost — **B-1**. |
| AC-F3-6 | PASS | `published`/`updated`/`cleared` once per source record, question lane/ref throughout (`events-subscribe-blockers.test.ts`). |
| AC-F3-7 | PASS | Emitted kind set equals declared minus `remove`; no `remove` emitted; surface `emitted:false`; snapshot topics carry no kind (`events-emitted-kinds.test.ts:34-135`). |

### F-4 Ordering (3)

| AC | Verdict | Note |
|---|---|---|
| AC-F4-1 | PASS | Two subscribers agree; one lane's series 1,2,3 (`events-sequence-per-lane.test.ts:31-86`). |
| AC-F4-2 | PASS | Lanes/topics independent; descending `occurredAt` still ascending sequence; no `cursor` (`:88-166`). |
| AC-F4-3 | PASS | Fresh incarnation over the same store replays nothing and restarts at 1; page documents restart/repoll (`events-sequence-restart.test.ts`). |

### F-5 Overflow (3)

| AC | Verdict | Note |
|---|---|---|
| AC-F5-1 | PASS | All six topics: exactly one stamped degraded, that subscription removed, reading/bystander spared; one end-to-end `queue.graph` burst (`events-overflow-parity.test.ts`). Same-connection multi-subscription not exercised — L-5. |
| AC-F5-2 | PASS | `overflow === TAXONOMY_OVERFLOW` on every row and frame; no second literal (`event-overflow-carriage.test.ts`). |
| AC-F5-3 | PASS | Third subscription refused `daemon.subscriber-degraded`; single `daemon.subscription-buffer` key (`events-overflow-parity.test.ts:70-92`, `event-control-vocabulary.test.ts:58-63`). |

### F-6 Snapshot topics preserved (2)

| AC | Verdict | Note |
|---|---|---|
| AC-F6-1 | PASS (caveat) | Exact `{topic,cursor,snapshot}`, baseline 0, change-only, no envelope field, plus the five delivered suites (`events-snapshot-preserved.test.ts`). No byte-golden existed pre-change; the exact structural assertions are honest (M-4 accepted). |
| AC-F6-2 | PASS | Snapshot record shape/kinds[]/payloadFields[]/frame/ordering, no per-lane claim (`events-describe.test.ts:80-106`). |

### F-7 Mount (4)

| AC | Verdict | Note |
|---|---|---|
| AC-F7-1 | PASS | `PROMPT_REQUIRED_COMMANDS` length 19, composed unconditionally, handler reached with no inputs (`events-production-composition.test.ts`). |
| AC-F7-2 | PASS | Root help 19 families incl `events`; family page five sections + M2 see-also; both verb `--help` exit 0 (`events-mount-help.test.ts`). |
| AC-F7-3 | PASS | Coverage zero failures and reference-page parity (`help-guide-coverage`, `reference-page-parity`). |
| AC-F7-4 | PASS | 19/19/18 exact (not loosened); file-set + v1-contract inventories bidirectional; export allowances name the new files (`daemon-production-composition.test.ts:72,122,139`, `content-inventory`, `exports-parity`). |

### F-8 Additivity and error table (4)

| AC | Verdict | Note |
|---|---|---|
| AC-F8-1 | PASS | Wire types/frame kinds/degraded reasons/stop modes/protocol/buffer unchanged; `CONTROL_TOPICS` six; unknown subscribe refused `events.topic-unknown` before any read (`event-control-vocabulary.test.ts`, `events-subscribe-refusal.test.ts`). |
| AC-F8-2 | PASS | Additive event/degraded frames decode; delivered negative controls still refuse (`events-decode-additive.test.ts`). |
| AC-F8-3 | PASS | Exactly three `events` rows with declared classes/exits; no delivered row changed (baseline 124 rows byte-identical); documented table matches; exits `{0,1,2}` (`error-table.test.ts`, `error-table-sync.test.ts`, `events-errors.test.ts`). |
| AC-F8-4 | PASS | `STATE_SCHEMA_VERSION` and the record-kind/schema/prefix constant set unchanged; no migration/seed; no package/lockfile change (`event-state-additivity.test.ts`, `event-additivity-inventory.test.ts`; independently confirmed no `package.json`/`pnpm-lock.yaml` in the diff). |

### NFR acceptance (5)

| AC | Verdict | Note |
|---|---|---|
| AC-NFR-1 | PASS | No reads/writes/composer; p95 0.03-0.13 ms vs 100 ms (`events-purity.test.ts`). |
| AC-NFR-2 | PASS | One `readRecords()` per publish pass, constant across 1/5 subscribers and 2/4 topics; heartbeat folds excluded and reported (`events-tick-cost.test.ts`). Socket/probe are not directly counted — L-4. |
| AC-NFR-3 | **FAIL** | The per-tick cap/watermark works for single-frame groups (64 then 36, no dup) but the `began`/`completed` pair is mis-budgeted and can drop a `completed` permanently — **B-1**. |
| AC-NFR-4 | PASS (caveat) | Worst-case payload far below the bound; tested frames ≤ bound; no truncation marker. `evidenceRefs` string length has no declared cap (L-6). |
| AC-NFR-5 | **PARTIAL** | Canary/privacy scan passes and `repositoryRoot` is excluded, but `dispatch.attempt` payloads carry a field literally named `token` while NFR-10/AC-NFR-5 say "no … token" (L-2). |

## TC compliance summary (45)

- **Solid and not weakened:** TC-EVT-001/002 (declaration half), 004 (integrity, seven real mutants against the production validator), 010/011/012/013, 014, 016, 020, 021 (real socket), 022, 023, 024, 025, 026, 027, 030, 031, 032, 040/041/042, 050/051, 060, 061, 062, 063, 064, 070, 071, 072, 073, 074, 075, 080, 083, 084.
- **Pass with a caveat:** TC-EVT-050 (no pre-change byte golden — replaced by exact structural assertions plus five delivered suites; acceptance recorded in pm-notes), TC-EVT-081 (read/sleep proven; socket/probe not counted), TC-EVT-082 (cap proven for single-frame groups; pair boundary not covered).
- **Weak / self-referential (non-blocking but should be fixed):**
  - `tests/structure/event-taxonomy-additive.test.ts:26-34` is a tautology: it inspects `scriptedFrames(TAXONOMY)` (built from the declaration) and checks keys against the same declaration. It does not test the projection.
  - `tests/structure/event-taxonomy-drift.test.ts:22-85` mutates `scriptedRecords(cloneTaxonomy())` and `scriptedFrames(...)`, i.e. it proves the comparator is sensitive, not that the live surface/projection is pinned (the live surface is separately pinned by `event-taxonomy-single-source.test.ts:66-79` and `events-describe.test.ts:159`).
  - `tests/checks/event-taxonomy-conformance.test.ts:63-70` (TC-EVT-002 page half) asserts only the literal counts string `0/0/4/3/3/3` and S17 absence; a renamed kind with the same counts would pass.
  - `tests/checks/events-hermetic.test.ts:26-44` inspects only direct imports; the "no forbidden specifier is *reachable*" header overclaims.
  - `tests/structure/event-projection-bounds.test.ts:166-181` asserts only upper bounds on the watermark (an empty watermark passes); mitigated by other exact cells.
  - `tests/structure/event-additivity-inventory.test.ts` and `event-state-additivity.test.ts` use baselines created in this same change; they cannot by themselves prove additivity (the git diff does, and it is clean).

## Findings

### B-1 [high, blocking] — the `began`/`completed` pair is not atomic; `completed` is silently dropped at the per-topic cap

`packages/core/src/domain/event-projection.ts:594-610`. The `began` candidate declares `groupSize: 2` (`:449`) to reserve room for its pair, but the paired `completed` candidate is still processed as its own unit with the default `groupSize = 1` (`:600`), so one first-completion consumes **3** budget slots for 2 frames.

Consequence at the boundary: with `used = 62` and `maxPerTopic = 64`, `began` fits (`62 + 2 = 64`) and calls `candidate.commit()` (`:606`), which advances the watermark to the transition index (`:419`, `:162-164`). The `completed` then fails (`64 + 1 > 64`), is added to `skippedTopics` and skipped without commit — but the watermark is already past its index, so it is never reconsidered on a later tick. The event is lost permanently, violating AC-NFR-3 / NFR-3 ("no event is dropped") and AC-F3-5 ("`began` then `completed`").

Reproduced independently with `createEventProjector({ maxPerTopicPerTick: 2 })` over one change carrying two first-completions: tick 1 emits `began@seq1` only, tick 2 emits `began@seq2` only, and every `completed` is dropped while the watermark advances. The same arithmetic applies at 64 whenever a pair starts at `used = 62`; it also means an all-pairs stream emits ~42 frames per tick instead of 64.

**Fix:** treat the pair as one unit — give the `completed` candidate `groupSize: 0` (or compute `began`+`completed` together and advance the budget by 2 for the pair), and skip the whole pair without commit when it cannot fit. Add a boundary cell at `maxPerTopicPerTick: 2` (and one at 64 with 62 pre-consumed) asserting either both frames or neither, and that the watermark never advances past an unemitted transition.

### M-1 [medium] — "one authored source / a second copy cannot drift" is false for the emission projection

`packages/core/src/domain/event-projection.ts:12-22` imports only `TAXONOMY_VERSION`; every kind name, lane/ref rule and payload assembly is hand-coded (`:195-545`). The reference surface is genuinely generated from `TAXONOMY` (`packages/cli/src/commands/events.ts:10-16,75-93`), but the projection is a second, hand-authored copy.

The guards do not close it:
- `tests/structure/event-taxonomy-single-source.test.ts:97-126` only flags a *flat array* containing ≥3 declared kind names. `event-projection.ts` carries 11 declared kind names inside object literals and is not flagged; an object-map or nested-array duplicate would also pass.
- `tests/fixtures/events/drift-mutants.ts:273-301` builds frames from the declaration, so `compareFrames(TAXONOMY, scriptedFrames(TAXONOMY))` is a tautology; `compareFrames` only rejects *undeclared* payload keys (`:340-350`), never a missing declared one. `event-taxonomy-additive.test.ts:26-34` is the same tautology.
- `tests/behaviour/events-envelope-conformance.test.ts:129-130` checks the emitted payload is a **subset** of the declared fields; dropping a declared field (e.g. `completed.attemptId`/`token`/`finishedAt`, or any `release` field) is not caught. Kind-name drift is caught (`events-emitted-kinds.test.ts:103-111`).

DM-1 and spec §1 promise "One authored source for the declaration, the surface, the frames, the validator, and the tests" and "per-topic contract tests compare both the surface and the daemon-emitted frames against it". The frames half is only partially implemented. The shipped page states the stronger claim and is therefore false — see M-3.

**Fix:** either drive the projection's kind/payload mapping from the declaration, or add an exact per-kind emitted-payload-key test against `CONTRACT_PAYLOAD_FIELDS` for all 13 kinds (not a subset), and strengthen the single-source scan to catch object/array copies (e.g. a whole-tree scan for the kind tokens in `packages/*/src`). Make the drift suite feed the real surface/projection, not scripted fixtures.

### M-2 [medium] — same-tick dependency deltas are computed against tick-start, not the previous record

`packages/core/src/domain/event-projection.ts:229-260`. All candidates are created in the entering loop before any `commit()` runs, so `prior = lastEdges.get(lane)` (`:230`) is the edge set from the previous tick; `commit` only updates `lastEdges` later during emission (`:254`). If two `queue.dependency` records for one ref are observed in the same view, the second record's `added`/`removed` is relative to the tick-start set, not the first record.

Reproduced: two records for `GH-9` (`["GH-1"]` then `["GH-2"]`) in one view produce a second event with `removed: []` where the delta from the first record is `removed: ["GH-1"]`. A real idempotent re-write following a change in the same tick can also emit a duplicate `dependency-edge`.

**Fix:** compute the delta sequentially inside the entering loop (update `lastEdges` as each candidate is built, restoring on suppression/pending), or defer payload construction until emission so the previous record in the same view is the base. Add a two-records-one-view cell.

### M-3 [medium] — shipped spec page claims the wire and the surface "cannot drift apart"

`doc/spec/features/feature-event-taxonomy.md:31-34`: "The daemon's event projection and the `events` reference command both read that same declaration, so the wire and the documented surface cannot drift apart." The projection does not read the declaration (M-1), so the claim is false in a page with `status: Current`. Fix: state the accurate relationship (surface generated; projection hand-authored and contract-tested), or implement M-1 and then the claim.

### M-4 [medium] — the M2 "authority" page contradicts the delivered contract, yet spec §16 says it needs no change

`doc/planning/oss-tooling/milestones/m2/contracts.md:72-73` says `queue.graph` "publishes … remove kinds", but `taxonomy.ts:146-150` declares `remove` with `emitted: false` and no v1 path emits it. `:77-79` states a **seven**-field envelope and omits `taxonomyVersion`, while the delivered frame has eight. `:87-89` says "a client is expected to state the version it speaks", but no client frame carries a version (`ControlSubscribePayload` is `{topic, since?}`). Spec §16 (`chg-GH-290-spec.md:575`) says "no content change required: §Event taxonomy v1 is the authority this change implements verbatim" — which is not true of the implementation (DEC-G adds the stamp; DEC-J marks `remove` unemitted). Fix: reconcile `contracts.md` (or amend §16's "verbatim/no change" claim and route the page to a later doc phase).

### M-5 [medium] — new system spec page + `doc/00-index.md` contradict spec §16 and the plan, and are undeclared

The change adds `doc/spec/features/feature-event-taxonomy.md` (`A` on base) and edits `doc/00-index.md:34`. But spec §16 (`chg-GH-290-spec.md:579`) says "no new spec page is created; the taxonomy lives in the resident-daemon page", and the plan repeats it (`chg-GH-290-plan.yaml:845-847`: "spec §16 marks it unchanged (no spec page is created), so it is not declared"). `doc/00-index.md` is not in any phase's `scope.files`/`scope.folders` (Phase 8 folders are `doc/changes/…`, `doc/overview`, `doc/planning/oss-tooling`, `doc/quality/test-specs`, `doc/spec/features`), and neither the page nor the index row is disclosed in the pm-notes Phase-8 entry. The page itself is accurate (good) — the problem is the contradiction and the undeclared scope. Fix: either drop the new page and keep §16's plan, or amend spec §16 and the plan note to declare the page and add `doc/00-index.md` to the phase scope, and record it in the pm-notes.

### L-1 [low] — AC-F2-4's machine-envelope clause is stale

`chg-GH-290-spec.md:600` requires the envelope to match `{ ok, command, data, error?, warnings? }`. The delivered `CommandResult` is `{ schemaVersion, runId, exitCode, timing, data | error }` (`packages/cli/src/index.ts:310-323`; `doc/spec/features/feature-result-contract.md:24,102`). `command` lives inside `data` (`events.ts:151,164`). The purity and command identity hold; the shape clause does not. Fix: restate AC-F2-4 over the delivered envelope keys and `data.command`.

### L-2 [low] — NFR-10/AC-NFR-5 forbid "token" while the declared payload carries one

`chg-GH-290-spec.md:454,664` say no payload carries a "token". `dispatch.attempt` `refused`/`completed` payloads carry the attempt record's `token` (`event-projection.ts:380,388`), which the spec's own §5.1 F-3 table declares. The value is an evidence/correlation token (fixtures use `"finished"`), not a credential, but the wording is contradictory and the privacy test does not assert the bare field. Fix: distinguish credential tokens from the attempt token in NFR-10/AC-NFR-5, or drop the field from the payload.

### L-3 [low] — `events describe` with no topic reports a misleading identity text; `events list <topic>` is silently accepted

`packages/cli/src/commands/events.ts:158-159` routes a missing topic to `verbRefusal(verb)`, producing `"describe" is not an events verb` (confirmed by probe) even though `describe` is valid. Separately, `events list status` exits 0 and returns the full list, silently ignoring the extra positional (`positionals.max = 2`, `:123`). Fix: return a usage/`events.verb-unknown` message that names the missing topic, and refuse an extra positional on `list`.

### L-4 [low] — AC-NFR-2's "no socket / no process probe" is not asserted

`tests/behaviour/events-tick-cost.test.ts:88-89` asserts `sleeps() === 0` but the harness tracks no connect/probe counters, so the "opens no socket, probes no process" clause is inferred, not proven. Add connect/probe counters to the harness and assert zero on the counted pass.

### L-5 [low] — overflow parity does not exercise two subscriptions of the same topic on one connection

`tests/behaviour/events-overflow-parity.test.ts:94-162` places the slow and reading subscriptions in different sessions (connections). That proves cross-connection isolation but not "every other subscription of the same topic keeps receiving" within one connection. The session code does drop only the overflowing id, so behavior is correct; add the same-connection cell.

### L-6 [low] — the frame-bound proof for `dispatch.attempt.refused.evidenceRefs` has no per-ref length cap

`packages/core/src/domain/event-projection.ts:360` copies up to `DISPATCH_MAX_EVIDENCE_REFS` (16) strings with no length bound; `DispatchEvidenceReference` is `string` (`packages/core/src/contracts/dispatch.ts:187`) with no declared maximum. The frame-bound test exercises only short refs. Either declare/validate a per-ref cap (and cite it in AC-NFR-4) or bound the field in the projection.

### I-1 [info] — unrelated import reordering adds diff noise

`packages/core/src/domain/index.ts`, `packages/core/src/contracts/index.ts`, `packages/cli/src/production.ts`, `packages/core/src/app/queue.ts` and `packages/core/src/app/daemon.ts` carry large alphabetical reorderings unrelated to the change. Harmless, but they widen the review surface; keep future diffs focused.

## Plan / evidence audit

- All eight plan phases have a pm-notes `notes:` entry naming the phase, commit hash and gate result (`chg-GH-290-pm-notes.yaml:112-360`). Phase-completion evidence is present.
- **Plan-scope deviations (disclosed):** `packages/cli/src/daemon-compose.ts` edited in Phase 1 though declared only in Phase 4 (type-only widening, disclosed `:122-127`); `scripts/checks/error-table-sync.ts` allowlist and `tests/checks/error-table-sync.test.ts` count rows (124→127, baseline +90→+93) edited though declared in no phase (disclosed `:127-130,352-357`). Both are honest but remain `SCOPE_DEVIATION`.
- **Plan-scope deviations (not disclosed):** `doc/00-index.md` and the new `doc/spec/features/feature-event-taxonomy.md` contradict spec §16 and the plan's explicit "not declared / no spec page" note (M-5).
- **Deviations 1–8 in the brief:** #1 (daemon-compose type widening) honest and implemented; #2 (allowlist + counts) honest and verified; #3 (delivered `CommandResult`) accurate — which is why AC-F2-4 is PARTIAL; #4 (overflow seam + one burst) honest and matches the test; #5 (TC-EVT-050 golden replacement) honest — no stronger assertion was lost; #6 (`processBlockerAnswers` seam, `total=6`) honest and default behaviour unchanged; #7 (root help 46 lines / 1821 bytes, no cap) honest; #8 (doc-sync drift) partially: `error-table-sync` drift is disclosed, but `doc/00-index.md`/new page is not.

## Remediation list (for FAIL)

1. **B-1 (blocking):** fix the `began`/`completed` budget accounting in `event-projection.ts` (pair = one unit of 2; skip the pair without commit when it cannot fit) and add the boundary tests at 2 and 64.
2. **M-2:** compute same-tick dependency deltas against the previous record in the view; add a two-records-one-view test.
3. **M-1/M-3:** make the emitted payloads exactly contract-tested per kind (or drive the projection from the declaration); replace the "cannot drift apart" sentence in `feature-event-taxonomy.md:31-34` with the accurate relationship.
4. **M-4:** reconcile `contracts.md` (remove is `emitted:false`; eight-field envelope; client version statement) or amend spec §16's "verbatim/no change" claim.
5. **M-5:** resolve the new spec page + `doc/00-index.md` against spec §16/the plan — either remove them or declare/amend and record in the pm-notes.
6. **L-1:** restate AC-F2-4 over the delivered `CommandResult` envelope.
7. **L-2:** reconcile the `token` wording in NFR-10/AC-NFR-5 with the declared payload.
8. **L-3:** fix the `events describe`/`events list <extra>` usage errors.
9. **L-4/L-5/L-6:** add socket/probe counters, the same-connection overflow cell, and the evidence-ref length bound.
10. **Weak tests:** de-tautologise `event-taxonomy-additive.test.ts:26-34`, make the drift suite feed the real surface/projection, and pin the M2 page's kind table (not just the counts string).

## Disposition

The declaration, surface, control-plane widening, refusal, overflow carriage, mount, error rows, additivity and delivered-suite compatibility are correct and well tested. The change cannot ship as-is because **B-1** silently drops a `completed` event at the per-topic cap boundary, and because the central "second copy cannot drift" promise is false for the emission projection while a shipped `Current` page states it as fact. Remediating B-1, M-1/M-3 and M-4/M-5, with the smaller items in the same pass, is sufficient to re-review; no source-scope or dependency expansion is implied.
