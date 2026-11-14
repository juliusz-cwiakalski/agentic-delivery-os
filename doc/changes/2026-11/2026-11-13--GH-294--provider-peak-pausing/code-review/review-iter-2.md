# Code Review Iteration 2

Status: PASS
Work Item: GH-294
Mode: local (lifecycle phase 8 — review_fix, second review after Phase 12 remediation)
Branch: feat/GH-294/provider-peak-pausing (HEAD c768d798 + uncommitted docs-only reconciliation)
Base: main-tools @ 6af61a400
Date: 2026-11-14
Reviewer: @reviewer (local mode; re-verified from the code with no carry-over credit —
every remediation re-read in source and re-proven by execution)

Findings Count: 4 new non-blocking observations (0 critical / 0 high / 0 medium / 1 low / 3 info)
Iteration-1 Dispositions: F-1..F-10 all CLOSED
Spec Compliance: PASS (all 7 ACs now demonstrated through the production compositions)
Plan Compliance: PASS (Phase 12 declared, executed, and evidenced; untouched declared files are
conditional rows per the plan's scope convention)
Next Step: PROCEED (lifecycle phase 9 — quality_gates; commit the docs-only reconciliation with
the change so the F-5 doc half lands)

## Summary

Phase 12 (commit `c768d798`, 30 files, +1618/−133) closes all ten iteration-1 findings at the
layer where they lived — the production compositions. Every fix was re-verified against the
code and re-proven by execution: the reviewer's own iteration-1 empirical probes now pass
(`queue release --park peak-window --until <iso>` exits 0 and lands the record; the
operator-shaped park projects exactly one `park-edge`, never a false `stop` or an out-of-set
`preservation`), and the new `peak-pause-composed-edge` suite drives the real composition
factories over real stores — the production-resolution-world proof GH-170 asks for. The
remediation also surfaced and fixed a latent reader defect iteration 1 had missed (the
delivered `PARK_KEYS`/`isParkRecord` exact-key validator rejected every DM-4-carrying park
record as torn), disclosed honestly. The follow-up docs-only reconciliation (9 pages,
uncommitted) aligns every spec page on the composition-fact mode rule and correctly describes
the episode-frame gating, the four-value exclusion-reason set, and the bounded lane-park read;
it is coherent and must land with the change. Four minor non-blocking observations remain
(one test-quality low, three informational); none gates PASS.

## Evidence Re-verified (no carry-over credit)

- Re-read the full Phase 12 production diff: `edge.ts` (nominate channel + release guards +
  `laneParkViews` + `createResolvedProviderProbe` extraction + `peakWatchComposed`),
  `production.ts` (`nominationPredicate` over resolved config, delivered probe, clock;
  supplied to `dispatchComposition`), `daemon-compose.ts` (supervision `nominate` forwarding
  pre-claim), `app/queue.ts` (PARK_KEYS/isParkRecord DM-4 admission + closed preservation-set
  validation + release-writer episode stamp), `domain/event-projection.ts`
  (`episodeFrameComplete` gate), `domain/daemon-peak-pause.ts` (F-7 skip, F-10 cache),
  `domain/spend.ts` + `contracts/spend.ts` (four-value exclusion-reason set),
  `contracts/queue.ts` (comment repairs), `.dependency-cruiser.cjs` (`tier-domain-not-provider`
  with the `peak.ts` `pathNot` exception), boundary fixtures, registries, and all test diffs.
- Re-ran the reviewer's own iteration-1 failing probes over the fixed tree:
  `peak-window --until` happy path → **exit 0, result parked**; projector over the
  post-fix operator shape and even the bare pre-fix shape → **`queue.graph/park-edge` only**.
- Re-ran 423 tests green: composed-edge, pause-episode-events, spend-zero-window,
  queue-park-causes-s17, status-brief-park-fields, daemon-absent-degradation,
  status-performance (44); the park/resume/isolation/nomination/UTC/determinism/hermetic/
  queue-cli/queue-edge-wiring battery (88); boundaries + verify-imports + content-inventory +
  dispatch-composition + doc-conformance (205); `ci-baseline-parity` at HEAD (1 — green,
  confirming the disclosed pre-commit transient resolved by the commit itself); the taxonomy
  battery + goldens + provider-peak-rules-schema (78). Plus `pnpm typecheck` green and
  `scripts/.tests/test-doc-distribution.sh` green over the uncommitted doc edits.
- Verified the disclosed scope drift is exactly as disclosed and justified (below).

## Iteration-1 Finding Dispositions

### F-1 [critical] Production dispatch never nominates — **CLOSED**

- `DispatchComposition` gains the `nominate` channel (`edge.ts:5114-5125`) and
  `createDispatchCommandRuntime` forwards it into `runDispatch` (`edge.ts:5364`) before the
  preflight, owner-hold, and lease claim (OQ-TP-4 ordering preserved).
- `production.ts:1697-1758` builds `nominationPredicate` over `acquireFileConfig` →
  `resolveConfig` → `parseAndValidate{Provider,Profile}Configuration` →
  `nominateProviderProfile` with the delivered probe (`createResolvedProviderProbe`, extracted
  from the provider command path so both read one probe truth) and the production clock; it is
  supplied unconditionally at `production.ts:1787`.
- `daemon-compose.ts:592-597` forwards `composition.supervision?.nominate` into the
  supervision cycle's `nominate` port before the claim.
- Composed proof (`tests/behaviour/peak-pause-composed-edge.test.ts`): admitted dispatch
  records `providerProfile` on the attempt record, the attempt-history read, and a real store
  lease (exit 0); all four no-nomination shapes refuse pre-session through the composed CLI at
  their delivered exits (absent/invalid/capability-denied exit 1; unavailable exit 2 with the
  eligibility list on the runtime error) with zero records; the composed claim inherits the
  predicate and records the lane nomination (DM-2), and its no-nomination refusal leaves no
  lane, no lease, no spawn.
- The empty-branch fail-closed consequence (fresh installs refuse `provider.profile.absent`
  until profiles are declared) is the **delivered** provider-profiles contract
  (`feature-provider-profiles.md:23`: "ships empty by default: a fresh installation declares
  no profile and refuses a spawn with a classified error") — DEC-9's identity reuse is
  exactly spec'd; no backward-compat violation.
- Production-composer coverage: the GH-273 production harness (`tests/fixtures/queue/
  production/harness.ts`) composes the real `createProductionComposer`, and its checkouts now
  declare the minimal profiles branch — so the production predicate's file-config path is
  exercised end-to-end by the delivered production suites, not only by the mirrored predicate.

### F-2 [high] `queue release --park peak-window --until` refused at edge — **CLOSED**

- `edge.ts:4890-4913`: both guards now derive from `windowCause = provider-window ||
  peak-window` — `--until` required for both, accepted for both; every other cause (incl.
  `owner-hold`) still refuses `--until` (DEC-12 intact). Defense-in-depth restored symmetric
  with the command layer.
- Composed proof: the happy path lands through the real edge harness (exit 0; record asserts
  cause/conditionType/expiry/recoveryState and the stamped episode identity); refusal grammar
  re-pinned (no-until, owner-hold+until, delivered causes unchanged).
- Reviewer re-probe: **exit 0, result parked** (was exit 1 at iteration 1).

### F-3 [high] Status/brief lane park fields had no producer — **CLOSED**

- `edge.ts:2615-2641` `laneParkViews`: one bounded `readQueueParks` read, latest-record-per-ref,
  causes `peak-window`/`owner-hold` in `parked` state, read-time expiry for peak-window
  (`nowMs >= until` drops), values verbatim, owner-hold `until` stays absent, capped at
  `STATUS_MAX_LANE_PARKS`; unreadable store reads as no open episodes (digest data, not a
  command failure).
- Wired unconditionally into `createStatusCommandRuntime` (`edge.ts:2595-2596`) — every
  status/brief composition (production included, via `statusComposition`) gets it; no optional
  wiring left to miss.
- Composed proof: status and brief render both open episodes from real records landed through
  the CLI (owner-hold `until` absent), project identical values, and clear the expired
  peak-window episode at read time while the no-expiry owner-hold episode stays.
- Read-cost bound moved 3→4 with the one bounded read named in `status-performance.test.ts`
  and the NFR table updated in the uncommitted `feature-status-digest.md` — disclosed,
  documented, consistent with NFR-8 (same collector pass, one read per logical source).

### F-4 [medium] False episode frames for operator-shaped parks — **CLOSED**

- `event-projection.ts:599-613`: `episodeFrameComplete` gates `stop`/`parked` emission on the
  watcher-written facts (non-empty `episodeId`, closed-set `preservation`, non-empty
  `graceDeadline`, `windowEnd`, `stoppedAt`).
- `app/queue.ts:2293-2308`: the release writer stamps the minimal episode identity
  (`peak-<ref>-<nowIso>`) and the operator's `until` verbatim; the watcher's episode facts
  stay unwritten — nothing fabricated.
- Reviewer re-probe over the real projector: post-fix operator shape AND the bare pre-fix
  shape each project exactly one `queue.graph/park-edge` (with real identity and `until`),
  zero `dispatch.attempt` frames. Pinned in `pause-episode-events.test.ts` (both shapes).
- **Latent reader defect fixed and disclosed**: the delivered `PARK_KEYS` exact-key validator
  rejected every DM-4-carrying park record as torn (`isParkRecord` → `hasOnlyKeys` false →
  `readQueueParks` torn) — a real iteration-1 miss by this reviewer, honestly disclosed by the
  remediation ("latent defect the composed happy path exposed"). `PARK_KEYS` now admits the
  nine additive fields and `isParkRecord` validates them fail-closed (non-empty strings;
  `preservation` only from `QUEUE_PARK_PRESERVATIONS`). The composed happy path reads the
  stamped record back through `readQueueParks` green.
- Spec alignment: the uncommitted `feature-event-taxonomy.md` and `feature-peak-pausing.md`
  §6/§8 now state the episode-frame-complete rule and the operator-shaped park-edge-only
  behavior — declaration and code agree.

### F-5 [medium] `peakEnforcement.mode` overclaimed `window-watch` — **CLOSED**

- `edge.ts:5055-5079`: mode derives from `composition.peakWatchComposed === true` (a
  composition fact) — never from daemon reachability; `parkClaimed` is purely record-derived
  (whatever writer claimed the record; truthful per DM-4/§F-8: "always false when no park
  record exists" now holds in both directions).
- Composed proof: reachable daemon without a composed watch reads `iteration-start-gating`
  (the iteration-1 overclaim case, now pinned to fail); a watch-composed composition reads
  `window-watch`; an open park record flips `parkClaimed` true under the uncomposed mode.
- Spec alignment: the uncommitted docs state the identical composition-fact rule on
  `feature-peak-pausing.md` §8/§9, `feature-resident-daemon.md`, `feature-scheduling-engine.md`,
  the glossary, and `doc/00-index.md`; `doc/planning/oss-tooling/status.md` corrected (committed
  in Phase 12). The two-page inconsistency from iteration 1 is gone.

### F-6 [low] domain→provider tier import precedent — **CLOSED**

- Matrix half landed: `.dependency-cruiser.cjs` `tier-domain-not-provider` (error) forbids
  every `domain → provider` edge except `provider/peak.*` by name; firing negative fixture
  `tier-domain-provider` plus clean control `tier-domain-provider-peak-boundary` registered in
  `tests/boundaries` (fixture-coverage registry rows present); `feature-monorepo-scaffold-
  toolchain.md` documents the rule. Verified by running the boundaries suite (green with the
  new fixtures registered).
- Move half properly refused: contracts/provider-profile is pinned data-only (TC-PROFILE-055/
  039), so moving the boundary helpers there was non-compliant — the matrix-plus-exception
  decision is the right call and is recorded in the rule comment and `peak.ts`.
- Import style aligned: `daemon-peak-pause.ts` now imports the queue contracts via `#contracts`
  (the one remaining relative import is the declared provider/peak exception, comment-marked).

### F-7 [low] Empty-string sessionRef fallback — **CLOSED**

`daemon-peak-pause.ts:424-430`: when neither the record nor `sessionRefOf` resolves a session
reference, the episode skips this pass (stays parked, re-observed next cycle); no empty-string
identity is resumed or recorded.

### F-8 [low] Mislabeled `pre-park` exclusions — **CLOSED**

`SpendWindowExclusionReason` is now the closed four-value set (`pre-park`, `post-window`,
`other-lane`, `unreadable-instant`, `SPEND_WINDOW_EXCLUSION_REASONS` exported); the boundary
gate is split from the lane-scope gate so a foreign-lane step and an unreadable instant each
carry their own reason. Pinned in `spend-zero-window.test.ts` (including the closed-set
assertion); contract/barrel/inventory rows synchronized; `feature-spend.md` and
`feature-peak-pausing.md` §7 updated in the uncommitted edits.

### F-9 [low] Orphaned/stale queue.ts comments — **CLOSED**

`QueueLanesData` doc comment reattached (`queue.ts:893`); the pairing comment header now says
"many-to-one by design" with the DEC-2 mapping explained below it (`queue.ts:130-136`).

### F-10 [info] Redundant rule lookup — **CLOSED**

`decidePeakStops` caches `{rules, window}` per profile; the grace deadline derives from the
same lookup the window decision used.

## Disclosed Scope Drift — verified exactly as disclosed and justified

- **Production fixtures declare the minimal profiles branch** (`tests/fixtures/queue/
  production/harness.ts` `writeProviderProfilesConfig`; adopted by `projects-scope-isolation`,
  `projects-state-placement`, `fixtures/dispatch/admission`): the direct, necessary fallout of
  the always-on nomination gate reading the delivered fail-closed empty-default branch. Each
  adoption carries an explanatory comment. This is what gives the production predicate
  end-to-end coverage in the delivered suites — the drift is a coverage gain, not a mask.
- **Status read bound 3→4** (`status-performance.test.ts`): the one bounded lane-park records
  read, named in both moved assertions; `feature-status-digest.md` NFR table updated. Still
  one read per logical source (NFR-8).
- **Registries/inventories**: `content-inventory` (allowances for `createResolvedProviderProbe`,
  `SPEND_WINDOW_EXCLUSION_REASONS`), `verify-imports`, `v1-contract-inventory.json` (additive
  rows), `forbidden-literals.registry.json` (adds the peak-pausing page to the scanned set —
  additive), barrel re-exports (`contracts/index.ts`, `provider/index.ts` exports
  `nominateProviderProfile`). All mechanical, all consistent.
- **`status.md` overclaim corrections** (committed in Phase 12): verified accurate against the
  fixed code.
- **The pre-commit battery's one `ci-baseline-parity` failure**: disclosed as the clone-based
  test seeing only pre-commit state missing the registry addition; re-ran it at HEAD — **1
  pass / 0 fail**, confirming the explanation. The post-commit "8121 pass / 4 skip / 0 fail"
  claim is consistent with everything this review re-ran.

## New Observations (non-blocking; none requires another remediation phase)

### N-1 [low|confidence: high|category: test-quality] The fixture fallback that masked the latent reader defect is still in place

- Location: `tests/behaviour/daemon-peak-window-park.test.ts:111-113`
  (`read.ok ? read.records : parks`).
- Message: the park fixture still silently falls back to its in-memory `parks` array when
  `readQueueParks` fails — the exact masking pattern that hid the PARK_KEYS reader defect from
  iteration 1's green suite. With the reader fixed the fallback is dead weight; if a future
  reader regression rejects episode-shaped records again, this suite would stay green instead
  of failing.
- Suggestion: assert `read.ok` and drop the fallback (or fail loudly on a non-ok read). Safe
  to fold into the next touch of the suite or the phase-9 wrap-up; not a gate.

### N-2 [info] Cosmetic comment-formatting slip in edge.ts

- Location: `packages/cli/src/edge.ts:2659` — `*/ const spendDigestFor = (options: {`.
- Message: the Phase 12 edit left `spendDigestFor`'s doc-comment closer on the declaration
  line. Harmless; Biome accepts it.
- Suggestion: restore the newline on the next touch.

### N-3 [info] daemon-compose nominate forwarding has no direct composed test

- Location: `packages/cli/src/daemon-compose.ts:592-597`.
- Message: the composed suite proves the supervision `nominate` port semantics by building the
  ports directly; the four-line forwarding in `createDaemonCommandRuntime` is read-verified but
  not driven through `createDaemonCommandRuntime` itself. Low risk (trivial conditional
  spread); note for whenever the lane composition lands in production (GH-238).

### N-4 [info] No negative test for the hardened `isParkRecord` DM-4 validation

- Location: `packages/core/src/app/queue.ts:385-404`.
- Message: the new fail-closed validation (non-empty DM-4 strings; `preservation` only from the
  closed set → torn otherwise) is present and the valid shapes are proven through the composed
  happy path, but no test pins the rejection (e.g. a `preservation: "bogus"` record reading
  torn). A one-case addition would harden it against mutation.

## Spec/Plan Compliance Summary

- **Spec: PASS.** AC-F1-1 (nomination recorded + classified refusals, both admission paths,
  through the composed CLI), AC-F3-2/AC-F4-3 (unchanged from iteration 1, re-run green),
  AC-F5-4 (unchanged, re-run green incl. the F-7 skip semantics), AC-F6-5 (exclusion-reason
  set now closed and honest), AC-F7-6 (episode events truthful in both writer shapes; status/
  brief/lanes surfaces render from real records through the production compositions),
  AC-F8-7 (mode truthful by composition fact; `parkClaimed` record-derived). NFR-7/8 restored;
  tier matrix extended with the required ceremony (`.ai/rules/typescript.md` §4).
- **Plan: PASS.** Phase 12 declared (scope covering the previously undeclared wiring files),
  executed in one commit, with per-finding pm-notes evidence including the honest latent-defect
  disclosure; the plan-scope omission class from iteration 1 is closed. Untouched declared
  files (`daemon-supervision.ts`, `contracts/provider-profile.ts`,
  `boundary-ci-parity.test.ts`, `inventory.json`, three GH-294 suites, `tests/fixtures/daemon`)
  are conditional rows per the plan's stated convention.
- **Docs**: the uncommitted 9-page reconciliation is accurate against the code and internally
  consistent (one composition-fact rule stated identically everywhere); it must be committed
  with the change — flagged as the expected next write, not a finding.

## Machine-Readable Consolidated State

```yaml
version: 1
iteration: 2
mode: local
work_item_ref: GH-294
branch: feat/GH-294/provider-peak-pausing
status: PASS
summary: >-
  Phase 12 closes all ten iteration-1 findings in the production compositions, verified from
  source and re-proven by execution (reviewer probes now pass; 423 targeted tests, the parity
  test, typecheck, and the doc-distribution guard green). The latent park-record reader defect
  iteration 1 missed is fixed and disclosed; the docs-only reconciliation is coherent and
  aligned with the code. Four non-blocking observations remain (one low test-quality note on
  the masking fixture fallback, three informational).
severity_breakdown:
  critical: 0
  high: 0
  medium: 0
  low: 1
  info: 3
spec_compliance: PASS
plan_compliance: PASS
iteration_1_dispositions:
  F-1: closed
  F-2: closed
  F-3: closed
  F-4: closed
  F-5: closed
  F-6: closed
  F-7: closed
  F-8: closed
  F-9: closed
  F-10: closed
findings:
  - { id: N-1, severity: low, confidence: high, category: test-quality, location: "tests/behaviour/daemon-peak-window-park.test.ts:111", message: "The readQueueParks failure fallback to the in-memory parks array still exists — the same masking pattern that hid the latent reader defect in iteration 1; a future reader regression would keep this suite green.", suggestion: "Assert read.ok and drop the fallback (fold into the next suite touch; not a gate).", suppressed: false }
  - { id: N-2, severity: info, confidence: high, category: code-quality, location: "packages/cli/src/edge.ts:2659", message: "Doc-comment closer merged onto the spendDigestFor declaration line (cosmetic Phase 12 slip).", suggestion: "Restore the newline on the next touch.", suppressed: false }
  - { id: N-3, severity: info, confidence: high, category: test-coverage, location: "packages/cli/src/daemon-compose.ts:592", message: "The supervision nominate forwarding in createDaemonCommandRuntime is read-verified but has no direct composed test (the suite builds the ports itself).", suggestion: "Add a forwarding test when the lane composition lands (GH-238).", suppressed: false }
  - { id: N-4, severity: info, confidence: high, category: test-coverage, location: "packages/core/src/app/queue.ts:385", message: "The hardened isParkRecord DM-4 validation (closed preservation set) has no negative test pinning the torn rejection.", suggestion: "Add one rejection case on the next touch.", suppressed: false }
reviewed_at: 2026-11-14T00:00:00.000Z
next_step: PROCEED
```
