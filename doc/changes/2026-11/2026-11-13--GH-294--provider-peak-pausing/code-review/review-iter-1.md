# Code Review Iteration 1

Status: FAIL
Work Item: GH-294
Mode: local (lifecycle phase 8 — review_fix, first review)
Branch: feat/GH-294/provider-peak-pausing (HEAD e5d4d4a115b8)
Base: main-tools @ 6af61a400
Date: 2026-11-13
Reviewer: @reviewer (local mode; diff `main-tools...HEAD`, 23 commits, 107 files, +11,400/−350)

Findings Count: 10 issues (1 critical / 2 high / 2 medium / 4 low / 1 info)
Spec Compliance: FAIL (AC-F1-1 and AC-F7-6 unmet in the production compositions — see F-1, F-2, F-3)
Plan Compliance: FAIL (phase-scope omission: the production wiring files for the delivered
capabilities are in no declared phase scope, so the commit primitive could never stage them —
same failure class as the Phase 11 landing gap the plan itself remediated)
Test Coverage Gaps: the CLI-edge happy paths for `queue release --park peak-window --until`,
the production status/brief lane-park projection, and the production nomination recording are
untested at the composition layer; every new suite proves the domain against injected ports
(fixture world), none proves the shipped edge (production resolution world — the GH-170 lesson)
Next Step: CALL_CODER — append remediation Phase 12 (proposed content below), execute, re-review

## Summary

The domain layer of this change is strong: the peak-rule schema, nomination predicate, watch/
park/resume decision modules, taxonomy v2 declaration, zero-spend evidence, and the DEC-12
owner-hold semantics are faithful to the spec, well-pinned by 41 TCs, and the delivered-suite
mechanical moves are exactly as disclosed (verified against the diffs). However, the review
found a systematic composition gap: three of the change's headline capabilities are wired into
core and tests but **not into any production composition**, so they silently do nothing in the
shipped CLI. Most severely, no production dispatch path supplies the nomination port, so the
spec's structural enforcement key (`providerProfile` on 100% of admitted dispatches) records on
0% of them — the entire peak-pause chain has no production data path. Second, every valid
`queue release --park peak-window --until <iso>` invocation is refused at the edge runtime
(empirically confirmed: exit 1, `input.value.rejected`), making the delivered grammar surface
unusable. Third, status/brief lane park fields have no runtime producer, so AC-F7-6's surface
half never renders in production. All three are wiring gaps, not logic errors — the suites stay
green because they exercise injected ports, never the composed edge.

## Method and Evidence

- Read spec v1.3, test-plan v1.2, plan.yaml (11 phases), pm-notes (per-phase evidence), TDR-0028
  ..0030, readiness iters 1-3, and the landed `doc/spec/features/feature-peak-pausing.md`.
- Reviewed every production diff hunk under `packages/**` and the material test/fixture diffs.
- Re-ran targeted suites (all green): queue-park-causes-s17, status-brief-park-fields,
  daemon-absent-degradation, spend-zero-window (22 pass); daemon-peak-window-{park,resume,
  isolation}, provider-nomination-admission, pause-episode-events, event-taxonomy-v2-compat,
  peak-window-utc-clock, peak-pause-determinism, peak-pause-hermetic (56 pass);
  provider-peak-rules-schema + event-taxonomy-{single-source,additive,declaration} (40 pass).
- Empirical probes over the REAL edge harness (`tests/fixtures/queue/cli/harness`) and the real
  projector (scripts under ignored `tmp/code-review-gh294/`): confirmed F-2 and F-4 below by
  execution, not reading alone.

## Findings

### F-1 [critical|confidence: high|category: spec-compliance/correctness] Production dispatch never nominates — AC-F1-1's record half and DM-1/DM-2 unmet in every shipped composition

- Location: `packages/cli/src/edge.ts:5266-5308` (`runDispatch` ports built without `nominate`),
  `packages/cli/src/edge.ts:5027` (`DispatchComposition` has no nomination channel at all),
  `packages/cli/src/production.ts:1680-1760` (`dispatchComposition` supplies none),
  `packages/cli/src/daemon-compose.ts:575-610` (supervision ports supply neither `nominate`
  nor `peakPause`).
- Message: `runDispatch` nominates only when `ports.nominate !== undefined` and
  `runSupervisionCycle` only when `ports.nominate` / `ports.peakPause` are defined — and no
  composition root anywhere wires them (`grep nominate|peakPause packages/{cli,mcp,opencode,
  adapters}/src` returns nothing; MCP composes no dispatch at all). Consequently every
  production dispatch after this change records **no** `providerProfile` on the attempt record
  (DM-1), the composed daemon claim records none and never refuses no-nomination (TDR-0028 D3's
  claim parity), and the watch — even once composed — would find no lane with a nomination to
  key on. The spec's success metric "dispatches whose nominated profile is visible on lane and
  attempt records: 100%" holds at 0% in production, silently (the attempt read renders a
  classified `null`). The optional-port doc comments ("absent keeps the delivered behavior for
  pre-change suites") frame absence as a test-compat mode, yet absence is the only shipped
  mode. `status.md` and the backlog marker claim "every delivery now nominates" — false in the
  production resolution world.
- Suggestion: add a nomination channel to `DispatchComposition` (profiles config + probe port +
  clock) and pass `nominate: () => nominateProviderProfile({...})` into `runDispatch` in
  `createDispatchRuntime`; wire the same predicate as the `nominate` port in
  `daemon-compose.ts`'s supervision composition (before the claim, per OQ-TP-4). Add at least
  one real-edge test proving a dispatched attempt record carries `providerProfile` and a
  no-nomination configuration refuses pre-session through the composed CLI. This needs a plan
  scope amendment (see F-10) because none of `edge.ts` (dispatch half), `production.ts`, or
  `daemon-compose.ts` is in any declared phase scope.

### F-2 [high|confidence: high|category: correctness] Every valid `queue release --park peak-window --until <iso>` is refused at the edge runtime

- Location: `packages/cli/src/edge.ts:4827-4842` (un-updated guards), against the updated
  command-layer grammar at `packages/cli/src/commands/queue.ts:669-688`.
- Message: the command layer correctly accepts `peak-window` + `--until` and refuses it
  without, but the edge runtime's release guards still read `parkCause === "provider-window"`
  only: line 4835 (`input.parkCause !== "provider-window" && input.parkUntil !== undefined`)
  rejects the accepted combination with `"--until is accepted only with --park provider-window"`.
  Empirically confirmed over the real edge harness: `queue add` → `queue claim` (exit 0) →
  `queue release --park peak-window --until <iso>` → exit 1. Without `--until` the command
  layer refuses (`until-required`), so **no invocation shape can land a peak-window park via
  the CLI**. The Phase 7 suite (TC-PAUSE-072) asserts only the refusal cases through the CLI;
  its writer test calls `releaseQueueLease` (core) directly, so the broken happy path is
  untested. The first guard (4827) is also missing the peak-window missing-`--until` check
  (defense-in-depth asymmetry).
- Suggestion: update both edge guards so `peak-window` behaves exactly like `provider-window`
  (require `--until`, accept `--until`), keep `owner-hold` refusing `--until`; add a real-edge
  happy-path test that lands a peak-window park and asserts the record (cause, conditionType
  `provider-window`, expiry).

### F-3 [high|confidence: high|category: spec-compliance] Status and brief lane park fields have no production producer — AC-F7-6's surface half never renders

- Location: `packages/cli/src/edge.ts:2512-2538` (`createStatusCommandRuntime` returns no
  `readLaneParks`), `packages/cli/src/production.ts:926-937` (statusComposition supplies no
  channel), `packages/cli/src/commands/status.ts:45,108` (the optional port).
- Message: `collectStatusFacts` includes `laneParks` only when `runtime.readLaneParks` is
  defined, and nothing defines it — moreover no code anywhere maps `QueueParkRecord` →
  `StatusLanePark` (grep across `packages/` finds the type only in contracts, the domain fold,
  and the port declaration). Production `status` and `brief` therefore never show parked
  count/reason/`until`/preservation for open episodes, even when peak-window park records
  exist. The suite injects `StatusLanePark` facts directly (fixture world), so this is
  invisible to the battery; the daemon-absent "no laneParks" assertion is trivially true in
  production. `status.md`'s "status and brief carry the open episodes' park fields" is
  inaccurate for the shipped surfaces, and NFR-8's "same collector pass" has no pass to join.
- Suggestion: implement the producer (read park records once in the collector pass; filter
  causes `peak-window`/`owner-hold` with `recoveryState: "parked"`, apply read-time expiry,
  bound by `STATUS_MAX_LANE_PARKS`, carry values verbatim) and wire it into
  `createStatusCommandRuntime` via the status composition; add an edge-level test with a
  seeded park record. Declare `packages/cli/src/edge.ts` (status half) in the remediation
  phase scope.

### F-4 [medium|confidence: high|category: correctness/event-contract] Projection emits degraded episode frames for operator-written peak-window parks (false `stop`, out-of-set `preservation`, empty `episodeId`)

- Location: `packages/core/src/domain/event-projection.ts:577-695` (the `queue.park` branch);
  writer shape at `packages/core/src/app/queue.ts:2249-2259`.
- Message: the projection keys episode emission on `cause === "peak-window"` regardless of
  writer, but `releaseQueueLease` writes operator parks without any DM-4 episode fields
  (no `episodeId`, `graceDeadline`, `stoppedAt`, `preservation`, `providerProfile`). Empirical
  probe over the real projector with that exact record shape emits:
  `stop {graceDeadline:"", providerProfile:"", windowEnd:"", stoppedAt:"", episodeId:""}` — a
  bounded-grace stop that never happened, violating EVT-1's payload semantics and the
  truthful-events discipline; `parked {preservation:"", episodeId:""}` — `preservation: ""` is
  outside the closed set `preserved | session-state-not-preserved` (LIT-P1: "exactly the
  two-member value set across every carrier"); and a `park-edge` with an empty episode identity,
  breaking ledger-only episode reconstruction. Currently latent only because F-2 blocks the CLI
  happy path; it becomes live for every CLI peak-window park the moment F-2 is fixed (and is
  reachable today via the core API).
- Suggestion: gate episode emission on the DM-4 episode fields' presence (e.g. require
  `episodeId` and `preservation` for the `stop`/`parked` frames) or have the release path stamp
  minimal episode identity for `peak-window` parks; pin with a projection test over the
  operator-shaped record. Fix together with F-2 so the fixed happy path cannot emit false
  frames.

### F-5 [medium|confidence: high|category: spec-compliance/truthfulness] `peakEnforcement.mode` claims `window-watch` for any reachable daemon while no composition can run the watch

- Location: `packages/cli/src/edge.ts:4986-4997` (`mode: daemonUnreachable ?
  "iteration-start-gating" : "window-watch"`); `packages/core/src/app/daemon-supervision.ts:48`
  (optional ports); docs `doc/spec/features/feature-peak-pausing.md:93` (§8) vs
  `doc/spec/features/feature-resident-daemon.md:349-351`.
- Message: the mode is derived from daemon reachability, but the watch itself runs only "when
  the composition supplies the peak-pause ports" (resident-daemon page) — and nothing supplies
  them (F-1). With today's supervise-only production composition, a reachable daemon reports
  `window-watch` while no window watcher exists in any shipped composition. `parkClaimed`
  stays honest (record-derived), but the mode label overclaims the active enforcement; the
  plan's COMPOSITION NOTE explicitly flagged this residual to @doc-syncer and @reviewer, and
  the two spec pages now state the contract differently (§8's unconditional "window-watch with
  a resident daemon" vs the ports-gated daemon page).
- Suggestion: either derive `mode` from an explicit composition fact (watch composed) instead
  of reachability, or — if daemon-residency is the intended contract — qualify §8/§9 of
  `feature-peak-pausing.md` (and the `lanes` surface bullet) with the supervise-only residual
  so the label's meaning is truthful today, and align both pages on one statement.

### F-6 [low|confidence: high|category: code-quality/layering] First domain→provider tier import sets precedent outside the stated tier contract

- Location: `packages/core/src/domain/daemon-peak-pause.ts:23-34` (imports
  `../provider/peak.js`, `../contracts/queue.js`, `../contracts/provider-profile.js`);
  cf. `.ai/rules/typescript.md` §4 ("domain … import `./contracts` only") and §2 (`#` aliases).
- Message: this is the only file under `domain/` importing the provider tier; depcruise does
  not forbid the edge (its `to:` set omits `provider`), so gates stay green, but the rules
  file's stated tier contract is now broken by precedent without the §4 "new allowed edge
  requires a matrix update plus a failing negative fixture" ceremony. The file also mixes
  relative `../contracts/…` imports with the workspace `#contracts` style used by its siblings
  (the symbols ARE re-exported through the barrel).
- Suggestion: either move the two shared boundary helpers (`peakWindowOpenSeconds` /
  `peakWindowEndSeconds`) to a contracts-visible location both tiers read, or add the
  domain→provider edge to the enforced matrix with a negative fixture in the same change;
  align the import style on `#contracts`.

### F-7 [low|confidence: medium|category: correctness/robustness] Session-resume route fabricates an empty-string session reference when none resolves

- Location: `packages/core/src/domain/daemon-peak-pause.ts:410`
  (`decision.sessionRef ?? input.sessionRefOf(decision.ref) ?? ""`).
- Message: the parked record never stores the session id (the watch's park record has no
  `sessionRef`), so the session-resume route depends entirely on `sessionRefOf(ref)`. If that
  lookup misses, `resumeSession` is invoked with `sessionRef: ""` and a successful resume
  records `sessionRef: ""` on the recovery record and (via the projection) on the `resumed`
  frame — a fabricated empty identity where a classified skip belongs. The path is untested
  (every resume test resolves `sessionRefOf` on the preserved route) and unreachable in
  current compositions (F-1), but it is the delivered seam for future wiring.
- Suggestion: when no session reference resolves, skip the episode for this pass (stay parked,
  re-observe next cycle) or refuse with a classified identity; pin with a test.

### F-8 [low|confidence: high|category: contract-hygiene] Window-evidence exclusion reasons mislabel non-boundary exclusions as `pre-park`

- Location: `packages/core/src/domain/spend.ts:936,947-949`; closed set at
  `packages/core/src/contracts/spend.ts` (`SpendWindowExclusion["reason"]: "pre-park" |
  "post-window"`).
- Message: a foreign-lane step inside the window is excluded with reason `"pre-park"` (the
  code comment itself says "out of the parked lane's attribution scope" — a different reason),
  and a step whose instant fails to parse also lands in `"pre-park"`. The scope disclosure
  exists so boundary scoping is visible; labeling attribution-scope and unreadable-instant
  exclusions as boundary exclusions is factually wrong disclosure.
- Suggestion: extend the closed reason set additively (e.g. `"other-lane"`,
  `"unreadable-instant"`) or omit non-boundary exclusions from the disclosure; adjust the
  spend-zero-window assertions accordingly.

### F-9 [low|confidence: high|category: documentation/comments] Orphaned and stale doc comments in `contracts/queue.ts`

- Location: `packages/core/src/contracts/queue.ts:877-878` (the `lanes list | show` payload
  doc comment now attaches to `QUEUE_PEAK_ENFORCEMENT_MODES` instead of `QueueLanesData`);
  `packages/core/src/contracts/queue.ts:127` (comment still opens "The declared one-to-one
  cause <-> condition-type pairing" while the array is two-to-one by DEC-2 design).
- Message: the Phase 8 insertion landed between a doc comment and its declaration, and the
  pairing comment's first line contradicts the (correctly explained) supersession below it.
- Suggestion: reattach the `QueueLanesData` comment; reword the pairing comment header to
  "cause → condition-type mapping (many-to-one per DEC-2)".

### F-10 [info|confidence: high|category: performance] Redundant rule lookup in `decidePeakStops`

- Location: `packages/core/src/domain/daemon-peak-pause.ts:122-133`.
- Message: after computing/caching the window state, the loop calls `input.rulesFor(profile)`
  a second time per open-profile lane just to read `graceSecondsDefault`; the cached window
  could carry the rules. Harmless today (config read, no production composition).
- Suggestion: optional cleanup — cache `{rules, window}` together.

## Disclosed-Deviation Verification (all as disclosed, none worse)

- Delivered-suite mechanical moves: stamps v1→v2 in goldens/fixtures show exactly
  version-bearing + additive deltas (BYTE-P1); attempt projection 16→17 with `providerProfile`
  appended; lanes read-cost bound 2→3 with the one bounded park read named; closed-sets
  pairing superseded to the DEC-2 two-to-one mapping; lanes-list/show goldens gained only the
  additive `peakEnforcement` block. Verified against the diffs.
- `catalog` fix making `peakWindows` optional is present
  (`packages/core/src/config/catalog.ts:157-193`): absence = no enforcement, required inner
  fields intact.
- Tier-discipline import corrections landed via `#contracts` where claimed, with the barrel
  re-exports present (exception noted as F-6).
- Composer-input constraint workaround (pm-notes pre-append) and Phase 11 landing via plain
  `commit GH-294` are process disclosures; the landed page is tracked and its content matches
  the phase-7 authorship story (cross-references from the 3c1c7a2c tree resolve).
- Full-battery claim (8108 pass / 4 skip / 0 fail, `pnpm check` exit 0) is recorded with
  pm-notes evidence at Phase 10; this review re-ran the targeted suites (118 tests) green.

## Verified Good (spot highlights)

- Nomination gate ordering matches OQ-TP-4 exactly (first predicate, resolve identities
  reused, no new `dispatch.*` identity; the closed-set guard in `nominateProviderProfile`
  throws fail-closed on an unmapped selection identity — currently unreachable, all four
  `selectProfile` codes mapped).
- Taxonomy v2: one `TAXONOMY_VERSION` constant, v1 kinds/payloads byte-identical, additive
  payload-field unions, goldens additive; v2-compat suite covers the six-point statement incl.
  the unix-socket variant; drift/single-source suites re-run green.
- DEC-12 owner-hold semantics chain is coherent end-to-end: classified-absence `until` on the
  record and the park-edge frame, `--until` refused for `owner-hold`, writer enumeration
  asserted (hold writes none; resume modules append no owner-hold park; watcher still parks
  `peak-window` under an active hold with record-level no-append).
- Zero-spend evidence: inclusive both boundary instants, falsifiable, absence never zero,
  basis named; hermetic suite has an armed fetch canary and module-marker scans.
- No `any`/`!`/`@ts-expect-error` added; narrowing casts on `unknown` are legitimate; no
  hardcoded product names; no license headers added by agents; changeset is one lockstep
  minor over the five publishables; TDR-0028..0030 tracked with matching index rows (landed
  with Phase 1 as the staging contract required).

## Plan Audit

- All 11 declared phases have pm-notes completion entries with commit hashes and per-phase
  gate results; phase scopes match the landed diffs (conditional rows untouched as allowed).
- Gap types: **SCOPE_DEVIATION/plan-scope omission** — `packages/cli/src/edge.ts` (release
  guards, status runtime, dispatch ports), `packages/cli/src/production.ts`, and
  `packages/cli/src/daemon-compose.ts` are in no declared phase scope (Phase 6 declared
  edge.ts only for the spend runtime), so the production wiring of nomination, the release
  grammar, and the status lane-park producer could never be staged — the same class of gap the
  plan's own Phase 11 remediated for the spec page. A remediation phase must declare them.
- Test scenarios vs plan: TC ownership map holds; the gaps above are missing composition-layer
  tests, not missing TCs.

## Proposed Remediation Phase 12 (append to plan; do not merge into prior phases)

Title: "Phase 12: Code Review Remediation (Iteration 1)" — kind: delivery.

1. (F-1, critical) Wire nomination into production: add the nomination channel to
   `DispatchComposition`; pass `nominate` into `runDispatch` in `createDispatchRuntime`
   (`packages/cli/src/edge.ts`); supply it from `dispatchComposition`
   (`packages/cli/src/production.ts`) via `nominateProviderProfile` over the resolved provider
   configuration, probe port, and clock; wire the same predicate as the supervision `nominate`
   port in `packages/cli/src/daemon-compose.ts` (before the claim). Add real-edge tests: an
   admitted dispatch records `providerProfile` on the attempt (and lane) record(s); each
   no-nomination shape refuses pre-session at its delivered exit through the composed CLI.
2. (F-2, high) Fix the edge release guards (`edge.ts:4827-4842`) so `peak-window` pairs with
   `--until` exactly like `provider-window`; add the real-edge happy-path test landing a
   peak-window park.
3. (F-4, medium) Gate the projection's `stop`/`parked` emission on the DM-4 episode fields
   (or stamp minimal episode identity in the release writer); add the operator-shaped-record
   projection test.
4. (F-3, high) Implement the `QueueParkRecord → StatusLanePark` producer and wire
   `readLaneParks` into `createStatusCommandRuntime` via the status composition
   (`production.ts` / `edge.ts`); add an edge-level status/brief test over a seeded park.
5. (F-5, medium) Resolve the `peakEnforcement.mode` truthfulness gap: derive mode from a
   composition fact or qualify the §8/§9 contract in `feature-peak-pausing.md` (and align with
   the resident-daemon page); update `doc/planning/oss-tooling/status.md` accordingly.
6. (F-6..F-9, low) Domain→provider import decision (move helpers or matrix+fixture), the
   `sessionRef` empty-string fallback, the exclusion-reason set extension, and the queue.ts
   comment repairs — each with its pinning test where applicable.
7. Re-run `TMPDIR="$PWD/tmp/tmpdir" pnpm check` plus the GH-294 suites; record the phase-12
   completion evidence in pm-notes.

Scope must declare: `packages/cli/src/edge.ts`, `packages/cli/src/production.ts`,
`packages/cli/src/daemon-compose.ts`, `packages/core/src/domain/event-projection.ts`,
`packages/core/src/domain/daemon-peak-pause.ts`, `packages/core/src/domain/spend.ts`,
`packages/core/src/contracts/spend.ts`, `packages/core/src/contracts/queue.ts`, the affected
test files, and the doc pages touched by item 5.

## Machine-Readable Consolidated State

```yaml
version: 1
iteration: 1
mode: local
work_item_ref: GH-294
branch: feat/GH-294/provider-peak-pausing
status: FAIL
summary: >-
  Domain layer faithful to spec (rules, nomination predicate, watch/park/resume, taxonomy v2,
  zero-spend evidence, DEC-12 owner-hold chain) and disclosed suite moves verified as
  disclosed; but three headline capabilities are missing from every production composition —
  dispatch never nominates (AC-F1-1/DM-1/DM-2 at 0% in production, silently), the CLI
  peak-window release happy path is refused at the edge runtime, and status/brief lane park
  fields have no producer — with a latent projection defect emitting false stop frames and an
  out-of-closed-set preservation value for operator-written peak-window parks once the release
  path is fixed.
severity_breakdown:
  critical: 1
  high: 2
  medium: 2
  low: 4
  info: 1
spec_compliance: FAIL
plan_compliance: FAIL
findings:
  - { id: F-1, severity: critical, confidence: high, category: spec-compliance, location: "packages/cli/src/edge.ts:5266", message: "No production composition wires the nomination port; no dispatched attempt/lane record ever carries providerProfile and no-nomination never refuses (AC-F1-1, DM-1/DM-2, TDR-0028 structural key unmet; silent).", suggestion: "Add a nomination channel to DispatchComposition and wire nominateProviderProfile into runDispatch (edge.ts), dispatchComposition (production.ts), and the supervision ports (daemon-compose.ts); add real-edge tests.", suppressed: false }
  - { id: F-2, severity: high, confidence: high, category: correctness, location: "packages/cli/src/edge.ts:4827", message: "Edge release guards reject every valid queue release --park peak-window --until invocation ('--until is accepted only with --park provider-window'); the delivered grammar surface cannot succeed via the CLI (empirically confirmed).", suggestion: "Treat peak-window exactly like provider-window in both edge guards; add the real-edge happy-path test.", suppressed: false }
  - { id: F-3, severity: high, confidence: high, category: spec-compliance, location: "packages/cli/src/edge.ts:2512", message: "readLaneParks is wired nowhere and no QueueParkRecord->StatusLanePark producer exists; production status/brief never render lane park fields (AC-F7-6 surface half unmet; status.md claim inaccurate).", suggestion: "Implement the bounded park-record producer over the collector pass and wire it into createStatusCommandRuntime; add an edge-level test.", suppressed: false }
  - { id: F-4, severity: medium, confidence: high, category: correctness, location: "packages/core/src/domain/event-projection.ts:577", message: "Operator-written peak-window parks (no DM-4 episode fields) project a false stop frame (empty graceDeadline/stoppedAt), preservation \"\" outside the closed set, and an empty episodeId (empirically confirmed; latent until F-2 is fixed).", suggestion: "Gate stop/parked emission on episode-field presence or stamp minimal episode identity in the release writer; pin with the operator-shaped-record test.", suppressed: false }
  - { id: F-5, severity: medium, confidence: high, category: spec-compliance, location: "packages/cli/src/edge.ts:4986", message: "peakEnforcement.mode reports window-watch for any reachable daemon while no composition supplies the watch (supervise-only residual); spec pages state the contract inconsistently.", suggestion: "Derive mode from a composition fact or qualify the mode contract in feature-peak-pausing.md and align both pages.", suppressed: false }
  - { id: F-6, severity: low, confidence: high, category: code-quality, location: "packages/core/src/domain/daemon-peak-pause.ts:23", message: "First domain->provider tier import breaks the stated tier contract (.ai/rules/typescript.md s4) without matrix update/negative fixture; mixed relative/#contracts import style.", suggestion: "Move shared boundary helpers to a contracts-visible location or add the edge to the enforced matrix with a fixture; align import style.", suppressed: false }
  - { id: F-7, severity: low, confidence: medium, category: correctness, location: "packages/core/src/domain/daemon-peak-pause.ts:410", message: "Session-resume route falls back to an empty-string sessionRef when none resolves and would record it on recovery and the resumed frame.", suggestion: "Skip the episode this pass (stay parked) or refuse with a classified identity; pin with a test.", suppressed: false }
  - { id: F-8, severity: low, confidence: high, category: contract-hygiene, location: "packages/core/src/domain/spend.ts:947", message: "Foreign-lane and unreadable-instant exclusions are disclosed as reason 'pre-park'; the closed reason set lacks attribution-scope/unreadable values.", suggestion: "Extend SpendWindowExclusion reason additively or omit non-boundary exclusions from the disclosure.", suppressed: false }
  - { id: F-9, severity: low, confidence: high, category: documentation, location: "packages/core/src/contracts/queue.ts:877", message: "Orphaned 'lanes payload' doc comment now attaches to QUEUE_PEAK_ENFORCEMENT_MODES; pairing comment still says 'one-to-one' under the DEC-2 two-to-one mapping.", suggestion: "Reattach the QueueLanesData comment and reword the pairing header.", suppressed: false }
  - { id: F-10, severity: info, confidence: high, category: performance, location: "packages/core/src/domain/daemon-peak-pause.ts:132", message: "decidePeakStops performs a redundant second rulesFor lookup per open-profile lane.", suggestion: "Optional: cache rules with the window state.", suppressed: false }
reviewed_at: 2026-11-13T22:30:00.000Z
next_step: CALL_CODER
```
