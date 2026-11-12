# Review — GH-290 — iteration 2 (post-remediation re-review)

- **Status:** **PASS** — the iteration-1 blocking defect (B-1) is correctly fixed and independently reproduced; all five mediums (M-1..M-5), all six lows (L-1..L-6) and the info item (I-1) are closed against the shipped code. Three new non-blocking findings remain (one medium, one low, one info), all documentation/traceability — no code defect.
- **Date:** 2026-11-12
- **Reviewer:** `@reviewer` (local ADOS mode)
- **Branch:** `feat/GH-290/event-taxonomy` vs `main-tools`
- **Reviewed commits:** remediation `351ee285` (plan phase 9, code/tests) + `59a8c6aa` (pm-notes) + `10878764` (spec v1.6 / pages)
- **Artifacts:** spec v1.6 (38 ACs), test plan **v1.3** (45 TCs — the v1.4 update that registers TC-EVT-085..092 is not on the branch), plan 9 phases (phase 9 complete), pm-notes (phase 9 evidence), review-iter-1 (`FAIL`).
- **Scope:** verify each iter-1 finding against the code (not the report); reproduce B-1 at the boundary; probe M-2 delta semantics; exercise the M-1 pin; check L-2..L-6 assertions are real; sweep for regressions (new `evidenceRefs` cap, AST allowlist, 63/62, 40-pair burst, additive-suite rewrite); judge spec v1.6 accuracy.

## Summary

The remediation is substantially correct. B-1 is fixed at the right layer: the `began` candidate reserves two budget slots and the paired `completed` now charges zero inside that reservation, so a pair consumes exactly two slots for two frames and an unfittable pair is skipped as a unit before any `commit()` — the watermark can no longer advance past an unemitted transition. I reproduced this independently with the real projector (cap 2 → one whole pair per tick; 62+pair → both; 63+pair → neither then both; 40 pairs → 64 then 16, total 80, never 42). M-2's per-call staged edge map is correct and safe against the cap's topic-skip; a two-records-in-one-view probe yields `removed: ["GH-1"]` and an idempotent rewrite emits nothing. M-1's claim is now honest: the projection stays hand-authored but its kind-name literal set is pinned bidirectionally to the declared emitted set (a rename/addition/removal fails) and an exact per-kind payload-key suite drives the **real** projector for all declared kinds (an undeclared key and a missing required key each fail); the drift suite feeds the live surface and live projector. M-3 and M-4 pages are corrected; M-5 is resolved by declaring the canonical page and its `doc/00-index.md` row in spec §16 and in Phase 8 scope. L-1..L-6 and I-1 are closed with real, non-tautological assertions.

Three new items remain. The most substantive is N-1: the L-6 fix introduced a module-local 256-char `evidenceRefs` truncation, but the spec still says every payload is "bounded … by caps the delivered contracts already enforce" and that "no payload is cut" — the cap is neither a delivered-contract cap nor declared, so §5.1 F-3's bound proof is now inaccurate (the truncation never triggers from shipped producers, which emit short refs). N-2 is bookkeeping: the plan header and the Phase-9 pm-notes note say the new TCs are registered by "test plan v1.4", but the test plan on the branch is still v1.3. N-3 is a minor wording overclaim ("all thirteen declared kinds" key-for-key, while `remove` has no emitted frame). None blocks the code; N-1 and N-2 should close in the same PR.

## Evidence run

| Check | Result |
|---|---|
| All GH-290 suites: `bun test tests/behaviour/events-*.test.ts tests/structure/event-*.test.ts tests/checks/event-*.test.ts tests/conformance/events/real-socket-subscribe.test.ts tests/golden/events-reference-page.test.ts` | **173 pass, 0 fail** (was 158; +15 from the new/rewritten cells) |
| Phase-9 projection-bound suite | 10 pass, 0 fail |
| Delivered gate suites (`content-inventory`, `error-table`) | 98 pass, 0 fail |
| `error-table-sync` | `entries=127 documented=127` — OK |
| Mount/help/parity/prompt/doc gates | 40 pass, 0 fail |
| Delivered control/queue/watch/heartbeat/degradation suites | 30 pass, 0 fail |
| `bun x tsc -p tests/types/tsconfig.json --noEmit` | exit 0 |
| `plan validate GH-290` (CLI) | exit 0 (valid) |
| Independent probe B-1 (cap 2) | tick1 `began:a,completed:a`; tick2 `began:b,completed:b`; tick3 none |
| Independent probe B-1 (62+pair / 63+pair) | 62+pair → 64 frames incl. both PAIR frames; 63+pair → 63 frames, PAIR absent, then `PAIR:began,PAIR:completed`, then none |
| Independent probe B-1 (40-pair burst) | `[64, 16, 0, 0, 0]` = 80 = 40 pairs; never 42/tick |
| Independent probe B-1 (mixed complete/reopen/complete) | `began,completed,reopened,completed` once, then nothing (no duplicate) |
| Independent probe M-2 (two records one view) | `added:["GH-1"] removed:[]`, then `added:["GH-2"] removed:["GH-1"]`; rewrite+change → `added:["GH-3"] removed:["GH-2"]` |
| Working tree after review | clean (`git status --porcelain` empty) |

## Closure table

Legend: **CLOSED** = the defect is fixed in code/spec and the proof is real; **CLOSED (caveat)** = fixed but leaves a non-blocking follow-up.

| Finding | Verdict | Evidence |
|---|---|---|
| **B-1** high — `began`/`completed` pair mis-budgeted, `completed` dropped at the cap | **CLOSED** | `event-projection.ts:508-514` gives the paired `completed` `groupSize: firstCompletion ? 0 : 1`; `:481` keeps `began` at `groupSize: 2`; `:639-645` charges and commits atomically; skip adds the topic so an unfittable pair never commits. Reproduced at cap 2, 64/62, 64/63 and over a 40-pair burst (table above). `event-projection-bounds.test.ts` adds the three cells; watermark held at 63/62. |
| **M-1** medium — "second copy cannot drift" false for the projection | **CLOSED** | `event-taxonomy-single-source.test.ts:243-256` pins `projection.kindValues` ⇄ `declaredEmittedNames()` (11 distinct names, bidirectional) and forbids any array/object kind group in the projection; `:258-294` walks `packages/*/src` with an exact per-file allowance. `event-taxonomy-additive.test.ts` (TC-EVT-088) drives the **real** projector via `projection-cases.ts` and compares each emitted payload key set against `CONTRACT_PAYLOAD_FIELDS` in both directions; `events-envelope-conformance.test.ts:172-179` adds `compareFrames` over the shipped stream; `drift-mutants.ts:348-366` makes `compareFrames` reject a missing required field. A dropped `priority`/`token` and an added `futureField` each fail. |
| **M-2** medium — same-tick deltas diff against tick-start | **CLOSED** | `event-projection.ts:206-208,255-264` stage the folded set in entering order; `commit` (`:283-286`) is the only promotion to `lastEdges`. Probe reproduces the correct sequential delta and no duplicate on rewrite. `events-dependency-delta.test.ts` "TC-EVT-087" cell is the real two-records-in-one-view proof. |
| **M-3** medium — page claimed the wire and surface "cannot drift apart" | **CLOSED** | `doc/spec/features/feature-event-taxonomy.md:27-39` now states: declaration authors the topics and the surface is generated from it; the projection is hand-authored and pinned bidirectionally; ordering/overflow pinned at declaration/surface only. Accurate. |
| **M-4** medium — M2 `contracts.md` contradicted the contract | **CLOSED** | `doc/planning/oss-tooling/milestones/m2/contracts.md:72-95`: `remove` "declared with `emitted: false` … no v1 path produces it", eight `data` keys (seven + `taxonomyVersion`), and "No client frame carries a version". Matches `taxonomy.ts` and `events.ts`. |
| **M-5** medium — new page + `doc/00-index.md` undeclared | **CLOSED** | spec §16 (v1.5) declares `feature-event-taxonomy.md` and its `doc/00-index.md` row as required outcomes; Phase 8 `scope.files` now lists `doc/00-index.md` (`plan.yaml`), and Phase 8 `scope.folders` already covers `doc/spec/features`. `plan validate` is green and the changed-file set is within declared scopes. |
| **L-1** low — AC-F2-4 stale envelope shape | **CLOSED** | AC-F2-4 restated over the delivered `CommandResult` (`spec:600`); §5.1 F-2 and DM-7 aligned; identity stays pinned via `data.command`. Not weakened. |
| **L-2** low — NFR-10/AC-NFR-5 "no token" vs delivered token | **CLOSED** | NFR-10 and AC-NFR-5 distinguish credential/secret tokens from the closed-vocabulary attempt token (`spec:455,664`); a glossary entry and §20 agree. `events-privacy.test.ts:105-170` asserts the projection emits `token` as a member of `DELIVERY_RESULT_TOKENS` and that the nested comparison `token` (a credential canary) never appears (flat payload, no `comparison` key). |
| **L-3** low — misleading `describe`-without-topic text; `list <extra>` silently accepted | **CLOSED** | `events.ts:165-172,185-187` add `argumentRefusal` with `reason=missing-topic` / `reason=unexpected-argument`, reusing `events.verb-unknown`; `events-errors.test.ts` asserts the wording and that `list status` returns no `data`. Table stays 127 rows. |
| **L-4** low — "no socket / no probe" inferred, not asserted | **CLOSED** | `event-harness.ts` adds live `connects()/listens()/probes()` counters (wrapping `ControlTransport` and `availability()`); `events-tick-cost.test.ts` asserts startup shows ≥1 listen/probe, then a counted pass is `reads=1, connects=0, listens=0, probes=0, sleeps=0`, then a `connect()` proves the counter is live. |
| **L-5** low — same-connection same-topic overflow not exercised | **CLOSED** | `events-overflow-parity.test.ts` adds a cell with two `queue.graph` subscriptions on one session: exactly one stamped degraded frame, only the overflowing id dropped (`subscriptions() == [sibling.id]`), the sibling keeps receiving (3 frames, then a 4th). |
| **L-6** low — `evidenceRefs` entry has no length bound | **CLOSED (caveat)** | `event-projection.ts:46,390-392` caps each ref at 256; `events-frame-bound.test.ts` proves it over 16 refs of 4 096 chars (count 16, each ≤256, exact prefix preserved). Caveat is **N-1**: the cap is module-local and the spec's bound proof still says "no payload is cut". |
| **I-1** info — unrelated alphabetical reorderings | **CLOSED** | Current diff vs `main-tools` for `domain/index.ts`, `contracts/index.ts`, `production.ts`, `queue.ts`, `daemon.ts` contains only this change's additions and the Phase-7 shared-view seam; no reorder noise remains. |

## New findings

### N-1 [medium, confidence high] — §5.1 F-3's payload-bound proof no longer matches the code: a module-local `evidenceRefs` cut is undeclared and the spec still says "no payload is cut"

- **Where:** `packages/core/src/domain/event-projection.ts:46,390-392` (new `EVIDENCE_REF_MAX_CHARS = 256` and `bounded(...)`) vs `chg-GH-290-spec.md:251` (§5.1 F-3 "Payload bounds — v1 has no truncation path … bounded … by caps the delivered contracts already enforce … no payload is cut"), `:539` (DEC-O), `:665` (AC-NFR-4).
- **What:** `bounded(value, max) = value.slice(0, max)` (`:100`) truncates. The new per-entry 256-char cap on `dispatch.attempt` `evidenceRefs` is the only thing that makes the frame bound provable for that field (the spec's proof counts refs, not ref length), yet 256 is not a delivered-contract cap — `DispatchEvidenceReference` is `string` with no maximum (`packages/core/src/contracts/dispatch.ts:187`). So §5.1 F-3's "bounded by caps the delivered contracts already enforce" is now false for `evidenceRefs`, and "no payload is cut" is contradicted: an evidence reference over 256 chars is silently shortened. The `events-frame-bound` test now *proves* the truncation, which is the opposite of "no payload is cut".
- **Practical impact:** low — every shipped producer emits short refs (`attempt:<id>`, `daemon:lane`, `window:<ts>`, `handover:<ts>`, `harness:spawn-failed`, …), so the cut is unreachable today and frames stay far below the bound. It is a contract-honesty defect of exactly the class iter-1 flagged, not a runtime bug.
- **Fix:** either declare the cap where the bound proof lives — add "each `evidenceRefs` entry is bounded to 256 characters by the projection (a defensive, non-contract cap)" to §5.1 F-3/DEC-O and reword AC-NFR-4's "no payload is cut" to "no declared-cap field is cut; an oversize evidence reference is capped at 256 by the projection" — or move the bound into the `DispatchEvidenceReference` contract as a declared maximum so the proof is true as written. If it is intended purely as defence, say so and name 256.

### N-2 [low, confidence high] — the test plan is still v1.3, but the plan and pm-notes claim "test plan v1.4" registers the eight new TCs

- **Where:** `chg-GH-290-test-plan.md:4` (`version: 1.3`, 45 TCs, no TC-EVT-085..092 anywhere) vs `chg-GH-290-plan.yaml:199` ("… which test plan v1.4 registers") and `chg-GH-290-pm-notes.yaml` Phase-9 note ("… TC-EVT-085..092 registered by test plan v1.4").
- **What:** Eight test cases (TC-EVT-085 atomic pair at cap 2, 086 pair at 64/62, 087 same-tick delta, 088 exact keys, 089 attempt token, 090 same-connection overflow, 091 connect/probe counters, 092 per-evidenceRef bound) are delivered and self-labelled in the test files, but the canonical test plan that binds AC↔TC still enumerates 45. The plan header and the pm-notes present the v1.4 registration as done, which it is not.
- **Why it is low, not blocking:** the test plan v1.3 still covers all 38 ACs; the eight new TCs are additional proof cells for already-covered ACs (chiefly AC-NFR-3/AC-F3-5 via the B-1 boundary). No AC loses traceability.
- **Fix:** land the test-plan v1.4 update registering TC-EVT-085..092 and the rewritten 002/003/005/006/014 cells before the phase-10 DoD gate, and correct the pm-notes tense. (Owner per the plan: `@test-plan-writer`.)

### N-3 [info, confidence high] — "all thirteen declared kinds" key-for-key slightly overclaims

- **Where:** `chg-GH-290-spec.md:62` (§1), `:111` (G-7), `:479` (RSK-9), `:529` (DEC-E).
- **What:** The exact emitted-payload-key comparison runs over the twelve **emitted** kinds; `remove` (declared `emitted: false`) has no frame, so only its declared field list is compared (`event-taxonomy-additive.test.ts:115-160`: the `!kind.emitted` branch `continue`s before the emitted-key loop). The declaration-vs-`CONTRACT_PAYLOAD_FIELDS` comparison does cover all thirteen. The prose reads as if all thirteen have emitted frames compared.
- **Fix (optional):** phrase as "all thirteen declared field lists, and the emitted payload keys of the twelve emitted kinds". No behaviour change.

## AC / TC compliance summary

- **38/38 ACs remain satisfied.** Re-verified the ones the remediation touched: **AC-F1-3** unchanged and satisfied (version/kind/payload-field/ordering/overflow each still fail a named test; ordering/overflow at declaration+surface where observable) — v1.6 reworded the surrounding prose but did not weaken this AC. **AC-NFR-3** unchanged and now genuinely satisfied (atomic pair, no drop, watermark held) — reproduced. **AC-F3-5** boundary now proven both-or-neither. **AC-F2-4** now PASS (delivered `CommandResult` restated). **AC-NFR-5** PASS (credential/secret vs declared attempt token reconciled and tested).
- **AC-NFR-4 — PASS (caveat, N-1):** the frame bound holds and no truncation marker appears, but the code now truncates an `evidenceRefs` entry at a 256-char module-local cap that the AC/spec bound proof neither declares nor cites; "no payload is cut" is technically contradicted for >256-char refs (unreachable from shipped producers).
- **TC compliance:** all 45 test-plan-v1.3 TCs still hold; the five whose assertions were rewritten (002 page half, 003, 005, 006, 014) are stronger, not weaker. **Registration gap (N-2):** the eight delivered TCs TC-EVT-085..092 are **not registered** in the test plan (still v1.3) even though the plan/pm-notes claim v1.4 does. This is a traceability defect, not an AC-coverage defect.
- **No delivered test was weakened.** The only removed cell is the tautology `event-taxonomy-additive.test.ts:26-34`, replaced by real-projector assertions; every other change strengthens (live surface/projector, bidirectional comparator, AST closure, live counters). Verified by reading each diff.

## Spec v1.6 accuracy

The reworded claims match the shipped code: the surface is generated from the declaration; the projection is hand-authored and imports only `TAXONOMY_VERSION`; it is pinned by a bidirectional kind-name literal-set pin plus an exact per-kind payload-key comparison; the drift suite consumes the live `events list --json` surface and the live projector; ordering and overflow are pinned only at declaration/surface because no frame carries them; "drift cannot pass a named test" replaces "impossible". No overclaim on AC-F1-3 (unchanged, satisfied) and no weakening of AC-NFR-3 (unchanged). The one residual inaccuracy is N-1 (§5.1 F-3 / DEC-O payload-bound wording) and the minor N-3 phrasing.

Caveat I checked and accepted: the M-1 kind pin is a **name-set** pin, so a topic/kind **pairing** swap (e.g. `began` emitted under `dispatch.attempt`) is not caught by that pin — it is caught by the case-view emitted-set test and `compareFrames`. The spec does not claim the name-set pin covers pairing, so this is consistent.

## Regression sweep

| Swept item | Result |
|---|---|
| New `EVIDENCE_REF_MAX_CHARS` truncation in `event-projection.ts` | Behaviour is a silent 256-char cut of a contract-unbounded field → **N-1** (medium). Unreachable from shipped producers. |
| AST scan allowance of six non-taxonomy groups | Exact and live: a listed file that loses its group, or a new group in a listed/unlisted file, fails (`event-taxonomy-single-source.test.ts:258-294`). The six entries are genuinely different vocabularies (harness outcomes, phase-ledger `{started,completed}`, pm-notes fields, merge-result discriminant). No real second copy is masked. |
| `63/62` behaviour | `63` fillers consume the budget; the pair (`63+2>64`) is skipped whole with no commit; next tick emits both and only then advances. Reproduced and tested. |
| 40-pair burst accounting | 32 pairs = 64 frames, then 8 pairs = 16, then 0; total 80. No `completed` lost, no 42/tick. Reproduced. |
| Additive-suite rewrite | The tautology is gone; the new cells drive `createEventProjector` and assert both directions and a dropped required field. Not self-referential. |
| Shared-view seam (`queue.ts`/`daemon.ts`) | `view === undefined ? store.readRecords() : {injected view}` preserves default behaviour; 30 delivered control/queue/watch/heartbeat/degradation tests pass. |
| `events list <extra>` semantics | Reuses `events.verb-unknown` for a valid verb with an extra positional; message names the argument, exit 1, no `data`; documented in the plan and tested. Acceptable; error table unchanged (127). |
| `events-hermetic` closure rewrite | Now resolves the relative-import closure and asserts it equals exactly the two surface modules; the runner boundary is asserted to be a relative `../index.js`. Stronger, correct. |
| Typecheck / plan validation / tree cleanliness | tsc exit 0, `plan validate` exit 0, `git status` clean. |

## Residual risks (PASS)

1. **N-1 (medium):** the spec's payload-bound proof does not declare the projection's 256-char `evidenceRefs` cap; "no payload is cut" is false for oversize refs. Low reachability (short shipped refs) but should be reconciled before merge so the change does not ship a false bound proof — the exact defect class iter-1 flagged.
2. **N-2 (low):** the test plan remains v1.3; TC-EVT-085..092 are unregistered and the plan/pm-notes assert a v1.4 that is not on the branch. Close before the phase-10 DoD gate.
3. **L-2 privacy relies on the record contract, not a projection check.** The projector copies `token` verbatim (`event-projection.ts:412,420`); NFR-10's "closed-vocabulary, non-secret" claim holds only because `DispatchAttemptRecord.token` is the closed `DeliveryResultToken` type and producers are typed. A hand-written malformed record on a same-user local store could carry an arbitrary string; that is outside the threat model, so it is a note, not a finding.
4. **N-3 (info):** minor wording overclaim about "all thirteen kinds" emitted-key coverage.
5. **No wire/state/protocol change** was introduced by the remediation (three error rows stay three, one `readRecords()` per publish tick, no package/lockfile change), so the additivity claims in iter-1 remain intact.

## Disposition

**PASS.** The blocking defect is fixed at the correct layer and independently reproduced; every iter-1 medium, low and info item is closed with real, non-tautological proof; the declared gates and the changed delivered suites are green; typecheck and `plan validate` are clean; and spec v1.6's reworded "single source / cannot drift" claims are accurate without weakening AC-F1-3 or AC-NFR-3. The three new findings are documentation/traceability only: close **N-1** (declare the 256-char `evidenceRefs` cap and fix "no payload is cut") and **N-2** (land the test-plan v1.4 registration) in this PR before the DoD gate; **N-3** is optional. No code change and no further re-review of the projection is required.
