---
id: chg-GH-347-test-plan
status: Updated
created: 2026-11-19
last_updated: 2026-11-19
owners: ["engineering"]
service: "delivery-os dispatch engine"
labels: ["dispatch", "parity", "m4-s9", "lifecycle", "admission", "resume", "harness"]
version_impact: minor
summary: "Offline, deterministic parity battery for the typed dispatch lane: 11/11 result classes through the real derivation and command path, atomic admission over a real store, recorded-attempt resume, the tracker retry ladder, terminate/restart loop safety, spawn identity, and the no-shell proof — each mapped to one of the 42 acceptance criteria."
links:
  change_spec: ./chg-GH-347-spec.md
  implementation_plan: ./chg-GH-347-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S9: Dispatch core parity — durable lane, resume, admission, classifier (M4)

## 1. Scope and Objectives

This plan protects the ten parity contracts the change introduces — the durable dispatch lane, atomic admission, recorded-attempt resume, the tracker retry ladder, corroborated-stall termination, the in-process restart loop, spawn identity, the total derivation order, the parity battery, and the no-shell invariant — and it protects the closed vocabulary that must not move while they are introduced.

The integrity risks that shape the plan are: a race that is decided before the claim and double-claims; a resume that silently degrades to a fresh spawn; a tracker outage that either erases a decisive artifact verdict or invents a success claim; a terminate that signals an unrelated process; a loop that restarts a clean exit or burns a restart slot twice; a derivation that flips a verdict while the token set stays closed; and a "no shell" claim that is only asserted in prose. Every one of these is a case below with a named mutation that must make it fail.

The plan is offline and deterministic: no live opencode, no live GitHub, no model call, and no real child process anywhere in the battery. It extends the delivered dispatch conformance fixtures and the delivered production-composition harness rather than building a second harness; a second harness would prove a second implementation (spec §12, DEC-9).

### 1.1 In Scope

- `AC-F1-1`…`AC-F9-5` (42 acceptance criteria) — every one mapped in §3.1 with zero orphans.
- `NFR-1`…`NFR-11` and the interface/data-model contracts `API-1`…`API-7`, `DM-1`…`DM-9`.
- The additive contract surfaces this change introduces: the `dispatch.lane` record, the optional harness `terminate` operation, the spawn title fact, the `pmNotes` artifact fact, and the tracker ladder policy.
- Two mandated extra observations: the daemon-path regression observation required by the shared-derivation ruling (§5.2 `TC-PARITY-006`) and the R7 divergent-ledger `finished` observation (§5.2 `TC-DERIVE-004`).
- The no-shell proof: the injected process runner with its guard, and the static invariant with its planted-reference non-vacuity control.

### 1.2 Out of Scope & Known Gaps

Not tested, by design, and acceptable for the reasons given (design provenance: spec §25.3 Appendix C; risk `RSK-7`):

| Not proven | Why this is acceptable |
|------------|------------------------|
| Live opencode behaviour: a real session's resume after a real process exit, real stdout framing, real prefill timing | The contract being changed is the engine's decision and the adapter's invocation shape, both proven at the seam. Live behaviour is a deployment observation, not an engineering claim; the resume rule is proven by the recorded-lane resolver over a seeded lane. |
| Live provider behaviour: real GitHub issue/PR reads, throttling, authentication failure shapes | The tracker ladder and the artifact-first honesty are proven with injected reads and an injected delay, which is exactly the decision the change makes. Provider behaviour is unchanged by this change. |
| OS-level process-tree termination of a real child and a real escaped runtime | The battery proves the contract: TERM before KILL, the declared grace, the exact-identity selection, idempotence, and zero unrelated signals, over a process-tree model the adapter drives. Kernel signal delivery is not the property being changed. |
| A real lifecycle-agent outcome or a real merge | The change is parity of classification and supervision, not of the agent's work. Effects remain fixtures. |
| Cross-process race freedom beyond the state store's fence guarantee | The two-invocation interleaving is deterministic by construction (§6.2), which is what makes the verdict assertion meaningful; an arbitrary OS schedule would prove nothing repeatable. |
| Long-run retry behaviour under a real 30-second outage | The declared attempt/limit facts are asserted exactly with an injected recorder; the wall-clock duration adds no contract. |

This table documents the boundary; it is not the boundary's source. The permanent source is the fixture constant `PARITY_PROOF_BOUNDARY` in `tests/fixtures/dispatch/parity/evidence.ts` (eight proven ids, six not-proven ids, declared order), and `TC-PARITY-004` asserts only that constant. The same boundary is published on `doc/spec/features/feature-dispatch-engine.md` and reconciled there in lifecycle phase 7; a page/constant mismatch is a documentation-phase defect, verified by the current-truth doc guard that runs in the aggregate (`pnpm check` → `bun test tests/checks/doc-conformance.test.ts`), never by `TC-PARITY-004`. Neither this plan nor the change specification is a permanent source, and no permanent suite reads `doc/changes/**`.

Also out of scope (spec §7.2, `NG-1`…`NG-12`): the F1b operator surface (`status`, `log`, `is-delivering`, `last-message`, per-ref logs — GH-354), the retired pre-iteration hook, merge/closeout/queue CRUD/provider-policy/namespace-migration/installed-binary work, any change to tokens/projections/exits/error-table/domain kinds/attempt schema version, the shell entry points' deletion, and the `commitlint` PATH defect (M4-S3).

## 2. References

| Reference | Use |
|-----------|-----|
| `./chg-GH-347-spec.md` (v1.6) | Source of the 42 ACs, `F-1`…`F-9`, `API-1`…`API-7`, `DM-1`…`DM-9`, `NFR-1`…`NFR-11`, Appendix C (proof boundary), Appendix F (normative ladder C vs D), Appendix G (coverage matrix) |
| `./chg-GH-347-pm-notes.yaml` | Scope, the F1a/GH-354 split, rulings R1–R7, the staging note, the `TMPDIR`/`PATH` operational prerequisite |
| `doc/decisions/TDR-0044` | Dispatch-owned durable lane record (distinct kind, acquisition/terminal appends, latest-wins) |
| `doc/decisions/TDR-0045` | Atomic dispatch admission (verdict inside the claim, no dispatch renewal, bounded fence wait) |
| `doc/decisions/TDR-0046` | Harness `terminate` (capability gating, TERM→KILL, exact-identity reap, idempotence) |
| `doc/decisions/TDR-0047` | In-process bounded restart loop (clean exit terminal, stall-only restart, one attempt record) |
| `doc/decisions/TDR-0048` | Total derivation ladder and arm-aware corroboration |
| `doc/decisions/TDR-0049` | Spawn identity: `pm` agent, `ticket-<REF>` title, lifecycle prompt |
| `.ai/rules/testing-strategy.md` | Layers, module→test mapping, invariant-authoring rules, `pnpm check` as the aggregate |
| `doc/spec/features/feature-dispatch-engine.md`, `feature-session-lifecycle-economics.md`, `feature-harness-adapters.md`, `feature-resident-daemon.md`, `feature-result-contract.md` | Current truth this plan pins; the two stale "no kill operation" statements are reconciled in the documentation phase, not asserted here |
| `tests/conformance/dispatch/{controlled-repo.ts,dispatch-e2e.test.ts,dispatch-fixture.test.ts,dispatch-daemon-lane.test.ts}` | Fixtures and suites this change extends |
| `tests/fixtures/dispatch/{harness,truth,golden/harness,admission,ledger,attempt-records,evidence-windows}.ts` | Existing fixture surface this plan extends |
| `tests/fixtures/queue/single-flight/harness.ts` | The delivered real-store claim harness (sibling `queue claim` renewal, dispatch refusal) |
| `tests/checks/decision-record.test.ts`, `scripts/checks/forbidden-literals.ts` + `tests/checks/forbidden-literals.test.ts` | House conventions for record assertions and for a static invariant with a planted-reference control |

`./chg-GH-347-plan.yaml` is authored in `delivery_planning` (phase 4) after this plan; this plan is its input and fixes the plan-phase scope items it must carry (the six decision records and the index row per the pm-notes staging note, and the `TC-PARITY-006` regression observation).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

42 acceptance criteria, 42 mapped, 0 unmapped, 0 orphans. Every case in this column exists in §5.1/§5.2 and every case in §5.1 appears here or in §3.2/§3.3.

| AC | Capability | Case(s) | Status |
|----|-----------|---------|--------|
| `AC-F1-1` | F-1 | `TC-LANE-001`, `TC-LANE-002` | Planned |
| `AC-F1-2` | F-1 | `TC-LANE-003` | Planned |
| `AC-F1-3` | F-1 | `TC-LANE-004` | Planned |
| `AC-F1-4` | F-1 | `TC-LANE-005` | Planned |
| `AC-F2-1` | F-2 | `TC-ADMIT-001` | Planned |
| `AC-F2-2` | F-2 | `TC-ADMIT-002` | Planned |
| `AC-F2-3` | F-2 | `TC-ADMIT-003`, `TC-ADMIT-004` | Planned |
| `AC-F2-4` | F-2 | `TC-ADMIT-005` | Planned |
| `AC-F2-5` | F-2 | `TC-ADMIT-006` | Planned |
| `AC-F3-1` | F-3 | `TC-RESUME-101` | Planned |
| `AC-F3-2` | F-3 | `TC-RESUME-102` | Planned |
| `AC-F3-3` | F-3 | `TC-RESUME-103` | Planned |
| `AC-F3-4` | F-3 | `TC-RESUME-104` | Planned |
| `AC-F4-1` | F-4 | `TC-TRACKER-001` | Planned |
| `AC-F4-2` | F-4 | `TC-TRACKER-002` | Planned |
| `AC-F4-3` | F-4 | `TC-TRACKER-003` | Planned |
| `AC-F4-4` | F-4 | `TC-TRACKER-004` | Planned |
| `AC-F5-1` | F-5 | `TC-TERM-001` | Planned |
| `AC-F5-2` | F-5 | `TC-TERM-002` | Planned |
| `AC-F5-3` | F-5 | `TC-TERM-003`, `TC-TERM-004`, `TC-LOOP-003` | Planned |
| `AC-F5-4` | F-5 | `TC-TERM-005` | Planned |
| `AC-F5-5` | F-5 | `TC-TERM-006` | Planned |
| `AC-F6-1` | F-6 | `TC-LOOP-001` | Planned |
| `AC-F6-2` | F-6 | `TC-LOOP-002` | Planned |
| `AC-F6-3` | F-6 | `TC-LOOP-003` | Planned |
| `AC-F6-4` | F-6 | `TC-LOOP-004` | Planned |
| `AC-F6-5` | F-6 | `TC-LOOP-005` | Planned |
| `AC-F6-6` | F-6 | `TC-LOOP-006` | Planned |
| `AC-F7-1` | F-7 | `TC-SPAWN-001` | Planned |
| `AC-F7-2` | F-7 | `TC-SPAWN-002` | Planned |
| `AC-F7-3` | F-7 | `TC-SPAWN-003` | Planned |
| `AC-F7-4` | F-7 | `TC-SPAWN-004` | Planned |
| `AC-F8-1` | F-8 | `TC-DERIVE-001`, `TC-PARITY-006` | Planned |
| `AC-F8-2` | F-8 | `TC-DERIVE-002`, `TC-PARITY-006` | Planned |
| `AC-F8-3` | F-8 | `TC-DERIVE-003`, `TC-DERIVE-004`, `TC-PARITY-006` | Planned |
| `AC-F8-4` | F-8 | `TC-DERIVE-005`, `TC-PARITY-006` | Planned |
| `AC-F8-5` | F-8 | `TC-DERIVE-006`, `TC-PARITY-001` | Planned |
| `AC-F9-1` | F-9 | `TC-PARITY-001` | Planned |
| `AC-F9-2` | F-9 | `TC-PARITY-002` | Planned |
| `AC-F9-3` | F-9 | `TC-PARITY-003` | Planned |
| `AC-F9-4` | F-9 | `TC-SHELL-001` | Planned |
| `AC-F9-5` | F-9 | `TC-SHELL-002`, `TC-PARITY-004` | Planned |

**Arithmetic.** 4 + 5 + 4 + 4 + 5 + 6 + 4 + 5 + 5 = 42 acceptance criteria, reconciled against spec §17 (`F-1` 4, `F-2` 5, `F-3` 4, `F-4` 4, `F-5` 5, `F-6` 6, `F-7` 4, `F-8` 5, `F-9` 5). 42 of 42 appear above with at least one named case; 0 are marked TODO; 0 carry a case id that has no §5.2 entry. The matrix carries **53** AC→case links (42 + 11 extras) because nine criteria need more than one observation. The extras sum to 11 exactly: `AC-F1-1` (+1), `AC-F2-3` (+1), `AC-F5-3` (+2: `TC-TERM-003`, `TC-TERM-004`, `TC-LOOP-003`), `AC-F8-1` (+1), `AC-F8-2` (+1), `AC-F8-3` (+2: `TC-DERIVE-003`, `TC-DERIVE-004`, `TC-PARITY-006`), `AC-F8-4` (+1) — these four are the daemon-inheritance observation — `AC-F8-5` (+1), `AC-F9-5` (+1). Case inventory: **50** cases across 11 groups, every one linked back to an `AC-*` or an `NFR-*` — 0 orphan cases (`TC-PARITY-005` → `NFR-7`, `TC-CONTRACT-001` → `NFR-3`/`NFR-11`).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Contract | Case(s) | Note |
|----------|---------|------|
| `API-1` run contract | `TC-LOOP-005`, `TC-ADMIT-005`, `TC-PARITY-001` | Envelope `result`/`restarts`, one attempt record, refusal exits mapped with zero records |
| `API-2` admission claim | `TC-ADMIT-001`…`TC-ADMIT-006` | Declared kind/code pair, holder named, no `fallback.internal`, bounded fence wait |
| `API-3` resume resolution | `TC-RESUME-101`…`TC-RESUME-104` | Newest lane with a session identity, resume mode, no silent fresh spawn |
| `API-4` tracker truth read | `TC-TRACKER-001`…`TC-TRACKER-004` | ≤5 attempts, `min(2s·2^(n-1), 30s)`, injected delay, never a success-shaped failure |
| `API-5` harness terminate | `TC-TERM-001`, `TC-TERM-005`, `TC-TERM-006` | Optional member, capability gating, TERM→KILL, idempotence, reports `terminated`/`escalated`/`reaped` |
| `API-6` spawn invocation | `TC-SPAWN-001`…`TC-SPAWN-004` | One `--agent`, one `--model`, one `--title` fresh / none on resume, role-less unchanged |
| `API-7` process execution | `TC-SHELL-001`, `TC-SHELL-002` | Fixed argv, `shell:false`, no script path; a refused runner fails by name |
| `DM-1` dispatch lane record | `TC-LANE-001`…`TC-LANE-005` | Field set, append-only, latest-wins, dispatch-owned, no forbidden payload |
| `DM-2` attempt-record disclosure | `TC-LANE-004`, `TC-PARITY-005` | Shape unchanged; `lane:append-failed`, `tracker:exhausted`, `terminate:*` as bounded refs |
| `DM-3` artifact completeness fact | `TC-DERIVE-003`, `TC-TRACKER-003`, `TC-DERIVE-005` | `pmNotes` tri-state, fallible direction is never "finished" |
| `DM-4` total ladder + pre-restart set | `TC-DERIVE-001`…`TC-DERIVE-006`, `TC-TERM-003`, `TC-TERM-004`, `TC-LOOP-003`, `TC-PARITY-006` | One order, one shared implementation, the closed short-circuit set |
| `DM-5` terminate capability | `TC-TERM-005`, `TC-TERM-006` | Declared gap is never asked; no second session |
| `DM-6` spawn facts | `TC-SPAWN-002`, `TC-SPAWN-003`, `TC-SPAWN-004` | Title grammar/bound, prompt parameterization, no operator override |
| `DM-7` admission verdict facts | `TC-ADMIT-001`…`TC-ADMIT-004`, `TC-ADMIT-006` | Matched pair, atomic with the live-lease observation, no dispatch renewal |
| `DM-8` ladder policy | `TC-TRACKER-001`, `TC-TRACKER-004` | Constants and the injected delay function; no configuration key |
| `DM-9` parity coverage matrix | `TC-PARITY-001`, `TC-PARITY-002` | One row per case naming the seam exercised; no row satisfied by a reimplementation |
| `EVT-*` | — | No event, message, or telemetry record is added (spec §8.2); nothing to test |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Case(s) | Observation |
|-----|---------|-------------|
| `NFR-1` offline determinism | `TC-PARITY-003` | Two in-test runs; identical canonical envelopes, attempt counts, class coverage; 0 live network, 0 live child processes |
| `NFR-2` bounded ladder | `TC-TRACKER-001`, `TC-TRACKER-002`, `TC-TRACKER-004` | 5 attempts, 2/4/8/16 s waits, ≤30 s added, exhaustion never a success claim |
| `NFR-3` vocabulary invariance | `TC-CONTRACT-001`, `TC-DERIVE-006` | 0 new tokens/projections/exits/rows/kinds/schema versions; `state-unverified` 2, `partial` 1 |
| `NFR-4` attempt and lane cardinality | `TC-LANE-002`, `TC-LANE-003`, `TC-LOOP-001`, `TC-LOOP-005`, `TC-PARITY-005` | 0/0 for a refusal; exactly 1 attempt per classified dispatch; 0 for a restarted iteration; 1 active per acquisition, 1 terminal per classification |
| `NFR-5` no shell | `TC-SHELL-001`, `TC-SHELL-002` | 0 invocations, 0 script paths, fixed argv `shell:false`, planted reference fails by name |
| `NFR-6` bounded exact termination | `TC-TERM-001`, `TC-TERM-006` | TERM first, KILL only after the grace, idempotent, 0 unrelated signals |
| `NFR-7` record bounds and redaction | `TC-PARITY-005`, `TC-LANE-004` | Lane key allowlist, no prompt/transcript/diff/credential/provider payload, ≤16 evidence refs, single-line identifier-only diagnostics |
| `NFR-8` concurrency safety | `TC-ADMIT-001`, `TC-ADMIT-003`, `TC-ADMIT-004` | Exactly 1 admitted + 1 `queue.single-flight`, 0 `fallback.internal`, 0 double-claim, fence wait ≤ `queue.lease-ttl` |
| `NFR-9` resume continuity | `TC-RESUME-101`, `TC-RESUME-104` | 1/1 recorded `pr-open` resumes; unknown session is a classified failure, never a fresh spawn |
| `NFR-10` backward compatibility and proof honesty | `TC-PARITY-002`, `TC-PARITY-004`, `TC-LANE-005` | Real seams, no reimplementation, a permanent boundary constant consistent with the registry, pre-change records and daemon lanes read unchanged |
| `NFR-11` configuration invariance | `TC-CONTRACT-001`, `TC-LOOP-005`, `TC-TRACKER-004` | 0 new keys; defaults `30000`/`3`/`20000`/`90000` pinned |

**Exit-literal rule (`NFR-3`).** Every exit literal stated in §5.2 is the delivered projection of the token or error row that produces it, computed from `DELIVERY_RESULT_TAXONOMY` × `PROJECTION` (`success` → 0, `user-validation` → 1, `platform-provider` → 2): `merged`/0, `blocked`/0, `pr-open`/0, `pr-open-unverified`/0, `finished`/0, `noop-lane-nothing-to-do`/0, `failed`/1, `max-restarts`/1, `partial`/1, `noop-lane-permission`/1, `state-unverified`/2. No case may state an exit literal the delivered matrix does not project, and `TC-CONTRACT-001` pins the matrix (taxonomy, projection map, and every error-table row's projection class) against the baseline, so a case that contradicts the matrix fails the invariance check rather than silently editing a test expectation.

## 4. Test Types and Layers

All cases are automated, offline, and deterministic. Per `.ai/rules/testing-strategy.md`:

| Layer | Runner | Location | Used for |
|-------|--------|----------|----------|
| Conformance (integration) | `bun test` (`bun:test`) | `tests/conformance/dispatch/**` | The parity battery: real command path, real composition, real derivation, injected I/O edges |
| Behaviour | `bun test` | `tests/behaviour/dispatch-*.test.ts` | Pure derivation, resume admission, liveness, divergence/false-success, privacy/bounds, exit projection |
| Structure | `bun test` | `tests/structure/dispatch-*.test.ts` | Composition wiring, token home, error identity, help/grammar inventory |
| Repository invariant | `bun run scripts/checks/*.ts` + `bun test tests/checks/**` | `scripts/checks/`, `tests/checks/` | The no-shell static invariant and the closed-contract invariance check |
| Static/diff | `git diff --check` | — | Whitespace/conflict-marker guard before every commit |

No end-to-end live layer participates: `tests/conformance/live/**` and the scheduled live workflow are untouched (`NFR-1`). Unit-level assertions are folded into the behaviour cases where they are the same property (e.g. the ladder wait function inside `TC-TRACKER-004`), so no case exists only to restate a constant.

## 5. Test Scenarios

Two drivers are used and both are production code:

- **D1 — composed production program.** `createProductionComposer({...injected facts})(brand)` → `runCli([...])`. This is the shipped composition; the injected facts are the declared injection points (`harnessSpawnRunner`, `harnessSpawnStarter`, `githubTransport`, `gitChildRunner`, `credentials`, `repositoryFacts`, `processId`, `environment`, `cwd`, `homeDirectory`) plus the three offline determinism facts this plan requires: `delay(ms, reason)`, `fenceWait` (part of `delay`), and the seeded lane/product facts. Pattern: `tests/fixtures/dispatch/admission.ts`.
- **D2 — the real one-shot engine.** `runDispatch(ports)` over the real state store, reached directly only where a store wrapper or an attempt-record observation is required. Port doubles are allowed only at declared port boundaries (session port, truth reads, store wrapper, delay); D2 cases never re-express engine logic.

`TC-ADMIT-001`…`005`, `TC-RESUME-*`, `TC-TRACKER-*`, `TC-TERM-*`, `TC-LOOP-*`, `TC-SPAWN-*`, `TC-PARITY-001`, `TC-SHELL-001` run on D1 unless the case says otherwise.

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC / NFR | New or Extended |
|-------|-------|------|-------|----------|----------|-----------------|
| `TC-LANE-001` | Active lane appended at acquisition with the full field set | Integration | Conformance | High | `AC-F1-1` | New |
| `TC-LANE-002` | Every pre-session refusal appends no lane and no attempt | Integration | Conformance | High | `AC-F1-1`, `NFR-4` | New |
| `TC-LANE-003` | Terminal lane, append-only latest-wins, no terminal record for a restarted iteration | Integration | Conformance | Critical | `AC-F1-2` | New |
| `TC-LANE-004` | A lane append failure is disclosed, never silently claimed | Integration | Conformance | Important | `AC-F1-3` | New |
| `TC-LANE-005` | No-lane absence is classified; the daemon family never adopts a dispatch lane | Integration | Conformance | High | `AC-F1-4` | New |
| `TC-ADMIT-001` | Two concurrent same-ref dispatches: one admitted, one `queue.single-flight` naming the holder | Integration | Conformance | Critical | `AC-F2-1` | New |
| `TC-ADMIT-002` | A live other-ref lease refuses `queue.lease-conflict` pre-session | Integration | Conformance | High | `AC-F2-2` | New |
| `TC-ADMIT-003` | Fence contention is waited out and re-decided, never surfaced | Integration | Conformance | Critical | `AC-F2-3` | New |
| `TC-ADMIT-004` | A persistent state failure keeps its `state.*` kind at exit 2 within the bounded wait | Integration | Conformance | Critical | `AC-F2-3` | New |
| `TC-ADMIT-005` | Every refusal exits its mapped code with zero records and no crash | Integration | Conformance | High | `AC-F2-4` | New |
| `TC-ADMIT-006` | Sibling `queue claim` renewal unchanged; the dispatch claim never renews | Integration | Behaviour | Critical | `AC-F2-5` | Extended (`dispatch-single-flight.test.ts`) |
| `TC-RESUME-101` | `--resume-prompt` over a recorded `pr-open` lane resumes, never spawns | Integration | Conformance | Critical | `AC-F3-1` | New |
| `TC-RESUME-102` | An operator resume consumes no ordinal in either resume mode and is never budget-refused | Integration | Conformance | Critical | `AC-F3-2` | New |
| `TC-RESUME-103` | No recorded lane → an explicit fresh spawn with a recorded fresh-spawn fact | Integration | Conformance | High | `AC-F3-3` | New |
| `TC-RESUME-104` | An unknown session is a classified failure with exactly one attempt | Integration | Conformance | Critical | `AC-F3-4` | New |
| `TC-TRACKER-001` | Transient failure then success: 5-attempt ladder, 2/4/8/16 s waits | Integration | Conformance | Critical | `AC-F4-1` | New |
| `TC-TRACKER-002` | Exhaustion with no decisive artifact is `state-unverified` at exit 2 | Integration | Conformance | Critical | `AC-F4-2` | New |
| `TC-TRACKER-003` | Exhaustion with a decisive artifact resolves the artifact, never a tracker success | Integration | Conformance | Critical | `AC-F4-3` | New |
| `TC-TRACKER-004` | The ladder is declared policy with an injected delay and no configuration key | Structure+Unit | Behaviour | High | `AC-F4-4` | New |
| `TC-TERM-001` | A corroborated stall sends TERM first, KILL only after the grace, with evidence | Integration | Conformance | Critical | `AC-F5-1` | New |
| `TC-TERM-002` | A clean exit or a cleared stall invokes no terminate and no restart | Integration | Conformance | Critical | `AC-F5-2` | Extended (`dispatch-liveness.test.ts`) |
| `TC-TERM-003` | A stall short-circuits on each member of the terminal pre-restart verdict set | Integration | Conformance | Critical | `AC-F5-3` | New |
| `TC-TERM-004` | A decisive artifact outside the set does not stop a stall | Integration | Conformance | Critical | `AC-F5-3` | New |
| `TC-TERM-005` | A terminate-incapable adapter starts no second session | Integration | Conformance | Critical | `AC-F5-4` | New |
| `TC-TERM-006` | Terminate is idempotent, reaps only the exact identity, and signals no unrelated process | Integration | Conformance | Critical | `AC-F5-5` | New |
| `TC-LOOP-001` | A below-bound stall consumes exactly one ordinal and one `economics.restart` | Integration | Conformance | Critical | `AC-F6-1` | New |
| `TC-LOOP-002` | At or above the bound the loop produces `max-restarts` with the exhaustion record | Integration | Conformance | Critical | `AC-F6-2` | New |
| `TC-LOOP-003` | An unverified stall consumes no ordinal and starts no second session | Integration | Conformance | Critical | `AC-F6-3` | New |
| `TC-LOOP-004` | A clean exit is always terminal, whatever the harness outcome or the bound | Integration | Conformance | Critical | `AC-F6-4` | New |
| `TC-LOOP-005` | Envelope `restarts`, one attempt record, and the unchanged bound | Integration | Conformance | Critical | `AC-F6-5`, `NFR-4` | New |
| `TC-LOOP-006` | A persisted count at or above the bound admits one iteration | Integration | Conformance | Critical | `AC-F6-6` | Extended (`dispatch-restart-budget.test.ts`) |
| `TC-SPAWN-001` | A fresh spawn renders one `--agent pm` and one resolved `--model` | Integration | Conformance | Critical | `AC-F7-1` | New |
| `TC-SPAWN-002` | Exactly one deterministic `ticket-<REF>` title on a fresh spawn, none on a resume | Integration | Conformance | Critical | `AC-F7-2` | New |
| `TC-SPAWN-003` | The prompt is the lifecycle prompt parameterized by ref and base branch | Integration | Conformance | Critical | `AC-F7-3` | New |
| `TC-SPAWN-004` | Role-less stays role-less; the agent and title are not operator-overridable | Integration | Conformance | High | `AC-F7-4` | New + Extended (`dispatch-help-inventory.test.ts`) |
| `TC-DERIVE-001` | Tracker-done with no visible PR is `merged`, tracker-corroborated | Unit+Command | Behaviour | Critical | `AC-F8-1` | Extended (`dispatch-truth-derivation.test.ts`) |
| `TC-DERIVE-002` | Tracker-done wins over a blocking label | Unit+Command | Behaviour | Critical | `AC-F8-2` | Extended (`dispatch-truth-derivation.test.ts`) |
| `TC-DERIVE-003` | Commits + complete pm-notes → `finished`; incomplete/absent → `partial` | Unit+Command | Behaviour | Critical | `AC-F8-3` | Extended (`dispatch-truth-derivation.test.ts`) |
| `TC-DERIVE-004` | R7: a divergent ledger still yields `finished`, divergence delivered, `falseSuccess` never suppressed | Integration | Conformance | Critical | `AC-F8-3` | Extended (`dispatch-delivered-evidence-divergence.test.ts`, `dispatch-false-success.test.ts`) |
| `TC-DERIVE-005` | The nothing-to-do arm requires no commits and a readable tracker; the ledger arm is retired | Unit+Command | Behaviour | Critical | `AC-F8-4` | Extended (`dispatch-truth-derivation.test.ts`) |
| `TC-DERIVE-006` | The total order is disjoint, and the vocabulary/exits are unchanged | Unit | Behaviour | Critical | `AC-F8-5` | Extended (`dispatch-truth-derivation.test.ts`, `dispatch-token-closure.test.ts`) |
| `TC-PARITY-001` | All 11 classes replay through the real derivation and command path | Integration | Conformance | Critical | `AC-F9-1`, `AC-F8-5` | Extended (`dispatch-e2e.test.ts` fixtures) |
| `TC-PARITY-002` | Every case exercises the real production seam; a reimplementation is rejected | Structure | Conformance | Critical | `AC-F9-2` | New |
| `TC-PARITY-003` | Two consecutive runs are identical with zero live network and zero live processes | Integration | Conformance | Critical | `AC-F9-3`, `NFR-1` | New |
| `TC-PARITY-004` | The proved / not-proved boundary is a permanent constant and is self-consistent | Structure | Conformance | High | `AC-F9-5` | New |
| `TC-PARITY-005` | Record bounds and redaction hold across the whole battery | Integration | Conformance | Critical | `NFR-7`, `NFR-4` | Extended (`dispatch-privacy.test.ts`, `dispatch-attempts-bounds.test.ts`) |
| `TC-PARITY-006` | Daemon-path regression: it inherits tracker-done `merged`, artifact `partial`, the retired ledger arm | Integration | Conformance | Critical | `AC-F8-1`…`AC-F8-4`, `DM-4` | Extended (`dispatch-daemon-lane.test.ts`) |
| `TC-SHELL-001` | The injected runner records zero shell invocations across the battery | Integration | Conformance | Critical | `AC-F9-4` | New |
| `TC-SHELL-002` | The static no-shell invariant passes and a planted reference fails it by name | Invariant | Checks | Critical | `AC-F9-5` | New |
| `TC-CONTRACT-001` | The closed contract surface is unchanged against a pinned baseline | Invariant | Checks | Critical | `NFR-3`, `NFR-11` | Extended (`dispatch-additive-stability.test.ts`, `error-table-sync.test.ts`, `dispatch-exit-projection.test.ts`) |

Numbering note: `TC-RESUME-101`…`104` start at 101 because `TC-RESUME-001` and `TC-RESUME-002` already exist in `dispatch-resume.test.ts` and `dispatch-restart-budget.test.ts` for different scenarios; IDs are never reused. `TC-RESUME-002` is superseded by `TC-LOOP-006` (deliberate behaviour change, spec §8.5: a persisted count at or above the bound no longer refuses admission). That pre-existing test must be rewritten, not deleted-and-forgotten, and the rewrite is reviewed as part of this change.

### 5.2 Scenario Details

#### TC-LANE-001 - Active lane appended at acquisition with the full field set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, API-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real `dispatch.lane` append and the real lane read over the real state store

**Preconditions**:
- Composed production program (D1) over a temp checkout/state root with `processId: 4242` injected and a fixed clock.
- A scripted streaming starter that yields one session id on a fresh spawn.
- `lane.restart-budget` default (3), zero persisted restarts.

**Steps**:
1. Run `dispatch GH-347 --json`.
2. Read the `dispatch.lane` records for the ref with the real lane reader.
3. Assert the record's field set and each value.

**Expected Outcome**:
- Exactly one record exists; `state === "active"`.
- `sessionId` equals the starter's yielded identity; `repository` equals the normalized `github.com/owner/repo`; `attemptId` equals the injected attempt id; `harnessKind === "opencode"`.
- `owner.processId === 4242`; `owner.startedAt` equals the injected start instant; `iterationOrdinal === 1`; `restartsConsumed === 0`; `recordedAt` equals the fixed clock.
- The record is read before classification is observable (the lane exists at a moment when no attempt record does).
- `Object.keys(record)` is exactly the DM-1 field set — no extra key.

**Notes**: Fails if the lane is written only at classification (the delivered defect).

#### TC-LANE-002 - Every pre-session refusal appends no lane and no attempt

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-4, API-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-claim` + `S-lane` — every pre-session refusal point and the lane/attempt append counters over the real store

**Preconditions**:
- Table of nine pre-session refusal inputs: unknown harness kind, rejected input (non-canonical ref), nomination refusal, provider-profile admission preflight refusal, harness version/mode refusal, active owner hold, live same-ref lease, live other-ref lease, and a typed state failure on the claim.
- A counting store facade over the real store records every `dispatch.lane`/`dispatch.attempt` append attempt.

**Steps**:
1. For each row, run one dispatch that reaches the refusal.
2. Assert exit code, error pair, and the append counters.

**Expected Outcome**:
- Exit is the refusal's mapped code, taken from `ERROR_TABLE` (asserted through the table, not a literal) and never 0.
- `dispatch.lane` appends: 0; `dispatch.attempt` appends: 0; queue lease records: 0.
- No crash: the process returns an envelope and the store remains readable.
- For the state-failure row, the pair's kind is `state` and the exit is 2 (see `TC-ADMIT-004`).

**Notes**: The coverage of all nine rows is what makes `NFR-4`'s "0/0" non-vacuous.

#### TC-LANE-003 - Terminal lane, append-only latest-wins, no terminal record for a restarted iteration

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, DM-1, DM-4, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` + `S-loop` — the real lane append/read across a restarted iteration

**Preconditions**:
- A dispatch whose first iteration stalls below the bound and whose second iteration completes cleanly with a decisive artifact (`pr-open`).
- Seeded unrelated lane records for other refs.

**Steps**:
1. Run the loop dispatch to completion.
2. Read all lane records for the ref in append order, then read "the lane".

**Expected Outcome**:
- Records in order: `active` (ordinal 1), then `active` (ordinal 2, `restartsConsumed: 1`), then exactly one `terminal`.
- No `terminal` record exists between the two `active` records (the restarted iteration is not a classification).
- The terminal record carries `lastToken === "pr-open"` and `lastOutcome === "completed"`.
- "The lane" resolves to the terminal record; the list order equals append order (no rewrite, no reordering); other refs' records are untouched.
- A second identical run appends a new pair and never mutates the earlier records (byte-equal prefix).

#### TC-LANE-004 - A lane append failure is disclosed, never silently claimed

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-3, DM-2, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real lane append through a store wrapper that fails only that kind

**Preconditions**:
- D2: `runDispatch` over a store wrapper that fails only `dispatch.lane` appends (the delivered `failAppendFor` pattern from `dispatch-delivered-evidence-divergence.test.ts`).
- All truth reads readable; a decisive artifact yields `pr-open`.

**Steps**:
1. Run the dispatch.
2. Read the attempt record and the envelope.

**Expected Outcome**:
- The token is unchanged (`pr-open`) and the exit is unchanged (0).
- Exactly one attempt record exists and is readable.
- `evidenceRefs` contains `lane:append-failed` and no session/resumability claim appears anywhere in the envelope.
- `evidenceRefs.length <= 16`; every ref is a single-line identifier.
- No `dispatch.lane` record exists (the append genuinely failed) and no fabricated lane appears.

#### TC-LANE-005 - No-lane absence is classified; the daemon family never adopts a dispatch lane

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, DM-1, NFR-10, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real lane read, plus the real daemon reconcile over the same store

**Preconditions**:
- Pre-change state: an attempt record written before this change (fixture record with no lane fields) and a daemon lane record in `delivering`, seeded directly through the delivered ledger append.
- A second store seeded with a dispatch lane only.

**Steps**:
1. Read the attempt and daemon-lane history through the delivered readers and assert unchanged shapes.
2. Run `--resume-prompt` with no dispatch lane and no resumable daemon lane; assert "no lane" (fresh spawn, see `TC-RESUME-103`, which carries the spawn half).
3. Run `runSupervisionCycle` + the daemon reconcile over the store that holds a dispatch lane; compare the dispatch lane records before/after.
4. Read the daemon lane resolution over the dispatch-lane-only store.

**Expected Outcome**:
- The pre-change attempt record decodes with no lane field and no read error; the daemon lane record decodes unchanged.
- The dispatch-lane-only store yields no resumable daemon lane and no fabricated session.
- Daemon reconciliation appends/rewrites zero `dispatch.lane` records (append-order and bytes identical) and never returns a dispatch lane as a supervised lane.
- No `dispatch.lane` record is created by the daemon family.

#### TC-ADMIT-001 - Two concurrent same-ref dispatches: one admitted, one `queue.single-flight` naming the holder

**Scenario Type**: Negative / Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, API-2, DM-7, NFR-8, DEC-1, TDR-0045
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-admission.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-claim` — the real atomic claim over the real store, with the injected fence-wait latch

**Preconditions**:
- One composed production program (one shared store) used by two concurrent `runCli` invocations for the same ref, no pre-existing lease.
- The injected `delay(ms, reason)` is a latch: the first arrival at the fence wait parks; the harness releases it after the second invocation's claim resolves.
- Deterministic interleaving (§6.2), run in both directions (A parked then B wins; B parked then A wins).

**Steps**:
1. Start invocation A; await its arrival at the fence wait.
2. Start invocation B; await B's completion.
3. Release A; await A's completion.
4. Read lease records, attempt records, lane records.

**Expected Outcome**:
- Exactly one invocation exits 0 and proceeds to a spawn (starter recorded one session acquisition) with exactly one attempt record.
- The other exits 1 with `error.code === "queue.single-flight"`, a `holder` naming the winner's holder, and a retryable `user-validation` row read from `ERROR_TABLE`.
- `fallback.internal` appears in neither envelope; neither invocation throws.
- Exactly one `queue.lease` record was appended; the refusal appended 0 attempts and 0 lanes.
- Both directions produce the same verdict shape (which invocation wins may differ; that it is exactly one each may not).

**Notes**: The parked-then-released ordering is what a pre-read-only implementation cannot survive: it would have decided to proceed before the winner existed.

#### TC-ADMIT-002 - A live other-ref lease refuses `queue.lease-conflict` pre-session

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-2, AC-F2-2, API-2, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-admission.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-claim` — the real claim over the real store with a seeded cross-ref lease

**Preconditions**:
- A live lease on `GH-400` in the same repository, seeded through the real claim; the dispatch targets `GH-347`.

**Steps**:
1. Run `dispatch GH-347 --json`.
2. Read leases, attempts, lanes.

**Expected Outcome**:
- Exit 1, `error.code === "queue.lease-conflict"`, the summary names the holder.
- `fallback.internal` absent; 0 attempts; 0 lanes; 0 new lease records.
- The seeded lease is unmodified (holder, ref, heartbeat).

#### TC-ADMIT-003 - Fence contention is waited out and re-decided, never surfaced

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-7, NFR-8, TDR-0045
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-admission.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-claim` — the real fence, the real live-lease re-read, and the injected fence-wait recorder

**Preconditions**:
- A second store handle on the same state directory holds the fence (the "contending writer").
- The injected delay records every wait with ms and reason.

**Steps**:
1. Acquire the fence externally; start the dispatch; await its first fence wait.
2. Release the external fence; let the dispatch re-acquire and re-decide.
3. Repeat with the contender refreshed twice (short contention), then assert.

**Expected Outcome**:
- The dispatch proceeds to exactly one claim and one spawn; no envelope error.
- Every contention produced a recorded wait with reason `claim-fence`, each `<= queue.lease-ttl` (90000); total waits recorded are finite.
- No wait is reported as a verdict: `error.code` is never `queue.*` and never `fallback.internal`.
- One lease record, one attempt, one active lane.

#### TC-ADMIT-004 - A persistent state failure keeps its `state.*` kind at exit 2 within the bounded wait

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-7, NFR-8, API-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-admission.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-claim` — the real fence with a persistent contending writer and the injected fence-wait recorder

**Preconditions**:
- The external fence holder never releases for the whole bounded wait window.
- The injected delay advances a virtual clock and records cumulative ms.

**Steps**:
1. Run the dispatch.
2. Inspect the envelope, waits, and record counts.

**Expected Outcome**:
- The envelope error is a `state` kind with a `state.*` code (assert: the pair exists in `ERROR_TABLE`, its kind is `state`); exit 2.
- It is never relabelled `queue` and never `fallback.internal`.
- Cumulative recorded wait `<= queue.lease-ttl`; the wait loop terminated (bounded).
- 0 attempts, 0 lanes, 0 lease records; no crash.

#### TC-ADMIT-005 - Every refusal exits its mapped code with zero records and no crash

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-2, AC-F2-4, API-1, API-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-admission.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-claim` — every refusal producer, driven through the real command path

**Preconditions**:
- Refusal table: `queue.single-flight`, `queue.lease-conflict`, `queue.precondition.unmet` (owner hold), a `state.*` claim failure, plus the `TC-LANE-002` non-admission rows.

**Steps**:
1. For each row, run the dispatch and then `dispatch attempts <ref> --json`.
2. Assert the exit, the error pair, and the attempts read.

**Expected Outcome**:
- Exit equals the projection of the row's `ERROR_TABLE` projection class (computed through the delivered projection, never a literal).
- `dispatch attempts` returns the empty-history success envelope with zero records.
- No exception escapes; store stays readable and a subsequent successful dispatch for the same ref still works.

#### TC-ADMIT-006 - Sibling `queue claim` renewal unchanged; the dispatch claim never renews

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-5, DM-7, NG-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-single-flight.test.ts` (extend)
**Tags**: @backend, @queue, @offline
**Seam**: `S-claim` — the real `claimQueueLease` (sibling) beside the dispatch claim over one real store

**Preconditions**:
- The delivered real-store single-flight harness: a seeded live lease, a real `claimQueueLease`, a real `dispatchAdmissionRefusal`.

**Steps**:
1. Sibling path: holder `lane-1` claims its own live same-ref lease → assert the delivered renewal result (unchanged).
2. Sibling path: holder `lane-1` claims a live lease on a different ref → assert the delivered `queue.lease-conflict`.
3. Dispatch path (post-change): a live same-ref lease under another holder and under the `dispatch` holder both refuse `queue.single-flight` with the live holder named, and append no lease record.
4. Dispatch path: after the refusing holder releases, a fresh dispatch claim succeeds.

**Expected Outcome**:
- Steps 1–2 match the delivered assertions verbatim (the existing cases keep passing unchanged).
- Step 3: `{ok:false, code:"queue.single-flight", holder:<live holder>}` for both holders; the lease count is unchanged.
- Step 4: `{ok:true}` and the lease now records the dispatch holder.

**Notes**: Extension of the existing `TC-QLC-040` suite; the pre-read refusal cases stay and the new atomic-claim cases are added beside them.

#### TC-RESUME-101 - `--resume-prompt` over a recorded `pr-open` lane resumes, never spawns

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, API-3, NFR-9, TDR-0044
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real lane resolver over a seeded `dispatch.lane` record

**Preconditions**:
- A seeded dispatch lane: `state: "terminal"`, `lastToken: "pr-open"`, `sessionId: "ses-347"`, `harnessKind: "opencode"`.
- The starter records every spawn/resume with args.

**Steps**:
1. Run `dispatch GH-347 --resume-prompt "continue the merge" --json`.
2. Read the attempt record and the starter's recorded calls.

**Expected Outcome**:
- The resume path was taken: zero spawns, exactly one resume, and the resume targeted `ses-347`.
- The attempt record's `resumeMode === "attach-continue"` (the adapter declares resume injection).
- `sessionIds` contains `ses-347`; exactly one attempt record.
- The interrupted run appended no terminal lane record; the resumed acquisition appends one active lane record with `sessionId === "ses-347"` and `iterationOrdinal === 1`, and the newest lane record is the one the resolver read.

#### TC-RESUME-102 - An operator resume consumes no ordinal in either resume mode and is never budget-refused

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, API-3, DM-7, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real resolver plus the real persisted `economics.restart` read

**Preconditions**:
- Persisted restart count equal to and greater than the bound (3), seeded as real `economics.restart` records.
- A resumable lane with a session identity.
- Two adapter-double rows per count: (i) the double **with** resume injection (`adapterSupportsResumeInjection: true` → mode `attach-continue`); (ii) the double **without** it (`adapterSupportsResumeInjection: false` → mode `resume-prompt-reentry`).

**Steps**:
1. Run `--resume-prompt` for each (persisted count × adapter double) cell: 3 and 4 counts × `attach-continue` and `resume-prompt-reentry`.
2. Read the envelope's `restarts`, the economics restart records, and the attempt record.

**Expected Outcome**:
- Every cell is admitted (no `dispatch.restart-budget-exceeded`), resumes the session, and classifies normally — the budget never gates an operator resume in either mode.
- **`attach-continue` cells**: `attempt.resumeMode === "attach-continue"`, `prefillCostAcknowledged` absent, no ordinal consumed, `restarts` at the persisted total (3 and 4).
- **`resume-prompt-reentry` cells**: `attempt.resumeMode === "resume-prompt-reentry"` and `prefillCostAcknowledged === true`; appended `economics.restart` records: **0**; the envelope's `restarts` stays at the **persisted total** (3 and 4) — so the descriptive `consumesRestartOrdinal: true` this mode carries charges nothing.
- The count of `economics.restart` records is unchanged in every cell, and the envelope `restarts` uses the persisted-total definition `TC-LOOP-005` pins.
- Exactly one attempt record per cell.

#### TC-RESUME-103 - No recorded lane → an explicit fresh spawn with a recorded fresh-spawn fact

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-3, API-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real resolver over an empty state

**Preconditions**:
- Empty state (no dispatch lane, no resumable daemon lane).

**Steps**:
1. Run `dispatch GH-347 --resume-prompt "start over" --json`.
2. Assert the starter call and the recorded fresh-spawn fact.

**Expected Outcome**:
- Exactly one spawn, zero resumes, and the spawn input prompt is the operator-supplied text.
- The attempt/lane records disclose that this was a fresh spawn (resume mode absent or explicitly `fresh`), never a claimed resume.
- One active lane with the new session identity.

#### TC-RESUME-104 - An unknown session is a classified failure with exactly one attempt

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, API-3, NFR-9, RSK-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-lane` — the real resolver over a seeded lane, with the adapter's real unknown-session path

**Preconditions**:
- A seeded resumable lane whose `sessionId` the adapter reports unknown (`harness.session.unknown`).

**Steps**:
1. Run `dispatch GH-347 --resume-prompt "continue" --json`.
2. Read the envelope, attempts, and the starter calls.

**Expected Outcome**:
- Exit 1 (`failed` projection), the error pair is declared in `ERROR_TABLE`.
- Zero spawns: the recorded lane was never silently replaced.
- Exactly one attempt record with `token === "failed"` and the spawn-failure/resume-failure identity.
- No success token and no `falseSuccess === true` suppression of the failure.

#### TC-TRACKER-001 - Transient failure then success: 5-attempt ladder, 2/4/8/16 s waits

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, API-4, DM-8, NFR-2, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-tracker.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-ladder` — the real tracker read with the ladder and the injected delay recorder

**Preconditions**:
- The production tracker read composed with the injected `delay(ms, reason)` recorder.
- A scripted transport that fails attempts 1..3 and succeeds on attempt 4 with a readable, non-done, non-blocked tracker.

**Steps**:
1. Run a dispatch whose completed session has no other decisive arm.
2. Assert the recorder entries and the outcome.

**Expected Outcome**:
- Exactly 4 tracker read attempts; recorded waits `[2000, 4000, 8000]` in that order, each with reason `tracker-ladder`.
- Cumulative recorded wait 14000 `<= 30000`; zero real elapsed time is spent (the recorder is the only delay).
- The successful read is used: the derivation sees a readable tracker fact (observable through the resulting token/arm), and no exhaustion ref appears in evidence.

#### TC-TRACKER-002 - Exhaustion with no decisive artifact is `state-unverified` at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, API-4, DM-8, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-tracker.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-ladder` — the real ladder exhausting against a scripted transport

**Preconditions**:
- Transport fails all five attempts; no PR, zero commits, no other decisive artifact; ledger readable.

**Steps**:
1. Run the dispatch.
2. Assert attempts, waits, token, exit, and evidence.

**Expected Outcome**:
- Exactly 5 attempts; waits `[2000, 4000, 8000, 16000]`; cumulative 30000 `<= 30000`.
- `result === "state-unverified"`, exit 2.
- `evidenceRefs` contains `tracker:exhausted`; the attempt record's `falseSuccess` is `false` and the token is not a success token.
- No tracker success claim anywhere in envelope or record.

#### TC-TRACKER-003 - Exhaustion with a decisive artifact resolves the artifact, never a tracker success

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-3, API-4, DM-3, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-tracker.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-ladder` — the real ladder exhausting while the real artifact read stays decisive

**Preconditions**:
- Transport fails all five attempts; a table of four decisive artifact fixtures: open PR with URL, already-merged PR, commits > 0 + complete pm-notes, commits > 0 + incomplete pm-notes.

**Steps**:
1. For each artifact fixture, run a completed-session dispatch.
2. Assert token, exit, evidence, and corroboration.

**Expected Outcome**:
- Tokens/exits: `pr-open`/0, `merged`/0, `finished`/0, `partial`/1 respectively.
- `tracker:exhausted` is present in evidence for every row; the tracker fact is unreadable and no row claims a tracker success.
- Corroboration is not fabricated: a source that is unreadable stays unreadable, and `falseSuccess` is never `false` on a token whose required corroboration is unsatisfied.

#### TC-TRACKER-004 - The ladder is declared policy with an injected delay and no configuration key

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-4, AC-F4-4, DM-8, NFR-11
**Test Type(s)**: Unit + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts` (policy assertions) + `tests/checks/dispatch-contract-invariance.test.ts` (no key)
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-ladder` — the exported policy constants, the pure wait function, and the composition's delay fact

**Preconditions**:
- The exported ladder policy constants and the pure wait function; the resolved configuration key set.

**Steps**:
1. Assert the declared constants: attempts 5, base 2000 ms, cap 30000 ms.
2. Assert the wait function at n = 1..6 yields `2000, 4000, 8000, 16000, 30000, 30000`.
3. Assert the tracker read requires the injected delay (the composition fact is the only source) and that calling the ladder twice with the same recorder yields identical entries.
4. Assert the configuration key surface is unchanged (see `TC-CONTRACT-001`) and that the ladder module source references no ambient timer.

**Expected Outcome**:
- All constants and the wait table match exactly; the cap binds at n = 5.
- No configuration key is added (`lane.*`, `coordinator.*`, `queue.*` unchanged).
- A structural assertion over the ladder module fails if it references `setTimeout`, `setInterval`, `node:timers`, `Bun.sleep`, or a sleep helper.

#### TC-TERM-001 - A corroborated stall sends TERM first, KILL only after the grace, with evidence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, API-5, DM-5, NFR-6, DEC-4, TDR-0046
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-terminate` — the adapter's terminate over the injected streaming starter's process-tree model, driven by the engine's stall decision

**Preconditions**:
- The terminate-capable adapter double over the injected streaming starter: a process-tree model with the session's root pid and two descendants, recording `(signal, pid, virtualMs)`.
- Two consecutive sourced no-advance liveness readings, still current at collection; `coordinator.kill-grace` = 20000.
- The injected `delay(ms, reason)` advances the virtual clock for the grace.

**Steps**:
1. Run one iteration that stalls.
2. Assert the recorded signals, their timestamps, and the evidence.

**Expected Outcome**:
- Signals to the session's tree: `SIGTERM` at t, then `SIGKILL` at `t + 20000` — never KILL before TERM, never KILL earlier than the grace.
- `terminate` returned `{terminated:true, escalated:true, reaped:<bool>}`; the grace wait was recorded with reason `terminate-grace` and value 20000.
- `evidenceRefs` contains the stall verdict identifier (`liveness:stalled`) and the termination result identifier (`terminate:terminated`, `terminate:escalated` when escalated, `terminate:reaped` when reaped).
- No second session started before the first is confirmed terminated (starter record ordering).

#### TC-TERM-002 - A clean exit or a cleared stall invokes no terminate and no restart

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-2, API-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-liveness.test.ts` (extend) + `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-terminate` — the engine's terminate decision (never reached) plus the real liveness evaluator

**Preconditions**:
- (a) A session that exits cleanly while a mid-run stall was observed earlier in its liveness sequence.
- (b) A session whose liveness stalls then advances before collection resolves.

**Steps**:
1. Run (a); assert zero terminate calls, zero restarts, `liveness:progressing`/`liveness:stalled` recorded as the trail it was.
2. Run (b); assert zero terminate calls, zero restarts, and the stall was cleared.

**Expected Outcome**:
- `terminate` calls: 0 in both; `economics.restart` records: 0 in both.
- One iteration, one attempt, the classification that the collected evidence supports.
- The recorded verdict trail is preserved as evidence (the earlier stall is not erased).

#### TC-TERM-003 - A stall short-circuits on each member of the terminal pre-restart verdict set

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, DM-4, TDR-0047
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-terminate` + `S-derive` — the engine's short-circuit decision against the real derivation

**Preconditions**:
- A terminal stall at collection (two sourced no-advance readings) with restart count below the bound.
- Three truth fixtures: tracker readable + done; tracker readable + blocking; PR artifact open with a resolved URL.

**Steps**:
1. For each fixture, run the stalled dispatch.
2. Assert the token, exit, restart count, and the number of starter session acquisitions.

**Expected Outcome**:
- Tokens: `merged`/0, `blocked`/0, `pr-open`/0 (all three project `success`; `blocked` is not exit 1).
- `economics.restart` records: 0 for every member; `restarts` unchanged; exactly one starter session acquisition.
- The session was terminated (capable adapter) before the attempt was recorded, and the attempt carries the stall + termination evidence.

#### TC-TERM-004 - A decisive artifact outside the set does not stop a stall

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, DM-4, TDR-0047, R3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-terminate` + `S-derive` — the engine's non-short-circuit decision against the real derivation

**Preconditions**:
- A terminal stall with restart count 0 and bound 3.
- Three truth fixtures: commits + complete pm-notes (`finished`); commits + incomplete pm-notes (`partial`); zero commits + readable non-done non-blocked tracker (`noop-lane-nothing-to-do`).

**Steps**:
1. For each fixture, run the stalled dispatch.
2. Assert that a restart was consumed rather than a verdict returned.

**Expected Outcome**:
- Each row consumes exactly one ordinal, appends one `economics.restart` with reason `watchdog.liveness-stalled`, resumes, and runs a second iteration.
- The final token is the second iteration's (clean-exit) classification, not the artifact the first iteration could have claimed.
- No attempt record exists for the stalled iteration; the `finished`/`partial`/`nothing-to-do` artifact does **not** short-circuit.
- Exactly one attempt record at the end.

**Notes**: This is the R3 ruling; it is the case that fails if a decisive artifact is allowed to stop a stall.

#### TC-TERM-005 - A terminate-incapable adapter starts no second session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-4, API-5, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-terminate` — the capability gate over a double that declares the gap

**Preconditions**:
- The terminate-incapable adapter double (the Claude Code shape): declares the operation gap and exposes no `terminate` member; the port double records any attempt to call it as a failure.
- A terminal stall, restart count 0, bound 3.

**Steps**:
1. Run with a terminal pre-restart verdict available (tracker done).
2. Run with undecidable truth (unreadable tracker + no artifact).

**Expected Outcome**:
- Row 1: returns `merged`, exit 0, no restart, exactly one session acquisition, and the terminate member was never invoked (a call would be recorded as a violation and fail the case).
- Row 2: returns `state-unverified` at exit 2 with the stall evidence, no restart, exactly one session acquisition.
- No second session in either row; no new failure identity appears (`harness.capability.gap` is not synthesized as a verdict).

#### TC-TERM-006 - Terminate is idempotent, reaps only the exact identity, and signals no unrelated process

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-5, API-5, NFR-6, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-terminate` — the adapter's exact-identity reap over the process-tree model

**Preconditions**:
- Process-tree model seeded with: this lane's session root + descendants; an escaped runtime matched by session id; an escaped runtime matched only by `ticket-GH-347`; and three unrelated processes (another delivery's session `ses-999`, another `ticket-GH-348` runtime, and an unlabelled process).
- A second terminate call for an already-exited session.

**Steps**:
1. Terminate once; assert signals, report, and reaped pids.
2. Terminate again on the exited session; assert idempotence.
3. Assert every unrelated pid's signal list is empty.

**Expected Outcome**:
- First call reports `{terminated:true, escalated:<bool>, reaped:true}`; TERM reaches only the session tree; the escaped runtimes matched by session id and by `ticket-GH-347` are reaped.
- Second call returns success (`terminated:true`) and sends no additional signal (idempotent: signal lists unchanged).
- The three unrelated processes received zero signals; the reap never matched by broad pattern (an unrelated `opencode`-named process is untouched).
- The recorded signals are attributable per pid, so a broad-pattern implementation fails on the unrelated pid assertion.

#### TC-LOOP-001 - A below-bound stall consumes exactly one ordinal and one `economics.restart`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NFR-4, DM-1, TDR-0047
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-loop` — the real in-process loop in `runDispatch`, with the real economics and lane appends

**Preconditions**:
- Iteration 1 stalls (two consecutive no-advance readings); iteration 2 completes cleanly with `pr-open`.
- Restart count 0, bound 3; the recorded session is resumable.

**Steps**:
1. Run the dispatch.
2. Read iterations (starter calls), economics records, attempts, lanes, envelope.

**Expected Outcome**:
- Exactly 2 iterations: spawn then resume of the recorded session (no second spawn).
- Exactly one `economics.restart` with reason `watchdog.liveness-stalled` and the delivered shape.
- Exactly one attempt record (the terminal one); the stalled iteration appended none.
- `restarts === 1`; lane records: active(1), active(2), terminal(1) with no terminal between.
- Exit 0, `result === "pr-open"`.

#### TC-LOOP-002 - At or above the bound the loop produces `max-restarts` with the exhaustion record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, DM-5, TDR-0047
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-loop` + `S-terminate` — the real bound decision and the real exhaustion record

**Preconditions**:
- Bound 3, every iteration stalls; a terminate-capable adapter.

**Steps**:
1. Run the dispatch.
2. Assert iterations, termination, token, records.

**Expected Outcome**:
- The loop terminates at the bound: `result === "max-restarts"`, exit 1 (`max-restarts` projects `user-validation`).
- **4 iterations**: 1 fresh spawn (iteration 1) + 3 resumes (iterations 2–4), i.e. **4 sessions total**, matching `TC-LOOP-001`'s spawn-then-resume model and `TC-LANE-003`'s active-ordinal shape.
- `restarts === 3` — the persisted total after the dispatch (initialised from the recorded count 0 and incremented once per consumed ordinal).
- Exactly one attempt record with token `max-restarts`; exactly one delivered terminal exhaustion record.
- Each stalled session was terminated before the next iteration; no session is left running at the end (process-tree model: all started pids exited or signalled).
- 0 further session acquisitions after the bound decision (no fifth spawn or resume).

#### TC-LOOP-003 - An unverified stall consumes no ordinal and starts no second session

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-3, AC-F5-3, DM-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-loop` + `S-derive` — the real unverified-stall decision

**Preconditions**:
- Terminal stall; the tracker read exhausts the ladder; no decisive artifact; the ledger read is readable but the tracker is not.

**Steps**:
1. Run the dispatch.
2. Assert token, exit, records, iterations.

**Expected Outcome**:
- `state-unverified`, exit 2, with `liveness:stalled` and `tracker:exhausted` in evidence.
- `economics.restart` records: 0; `restarts` unchanged; exactly one iteration; exactly one attempt record.
- The session was terminated (capable adapter) and no second session started.

#### TC-LOOP-004 - A clean exit is always terminal, whatever the harness outcome or the bound

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-4, DM-4, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-loop` — the real clean-exit terminal decision across the harness-outcome matrix

**Preconditions**:
- Matrix of completed-session harness outcomes: completed, failure-reported (non-zero exit), tool-failure, premature-end.
- Restart count seeded at 0 and at the bound (3).

**Steps**:
1. For each (outcome, count) cell, run the dispatch.
2. Assert iterations, restarts, terminate calls.

**Expected Outcome**:
- Exactly one iteration in every cell; 0 `economics.restart`; 0 terminate calls.
- The token is the cell's derived classification (`finished`/`failed`/`partial`/`state-unverified` as the ladder dictates) and never `max-restarts` for a cell whose persisted count equals the bound.
- Exactly one attempt record per cell.

#### TC-LOOP-005 - Envelope `restarts`, one attempt record, and the unchanged bound

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-5, NFR-4, NFR-11, API-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-loop` — the real envelope projection, the real attempt ledger, and the real lane policy read

**Preconditions**:
- Three runs: clean exit, one restart then clean exit, refusal pre-session; restart bound default and a pinned non-default bound (1).

**Steps**:
1. Run each; assert `restarts`, attempt count, and the bound source.
2. Assert no dispatch ever has two attempt records.

**Expected Outcome**:
- `restarts` is the **persisted total after the dispatch**: initialised from the recorded restart count and incremented by each ordinal this invocation consumes. The three zero-baseline runs therefore report 0, 1, 0; a persisted-3 run with no consumption reports 3 (`TC-RESUME-102`).
- The reported value never exceeds the iterations actually restarted (no double count).
- Attempt count: 1, 1, 0.
- The default bound is 3 and the pinned bound is honoured; `coordinator.restart-budget` (10) is never consulted for this surface (assert by pinning it to a distinct value and observing no effect).
- No configuration key or default is added (`TC-CONTRACT-001` asserts the surface).

**Notes**: The mutation row `M53` states this definition directly: reporting only this invocation's consumed count where the persisted total is required fails by name.

#### TC-LOOP-006 - A persisted count at or above the bound admits one iteration

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-6, NFR-4, DM-4, R5, TDR-0047
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-restart-budget.test.ts` (rewrite of `TC-RESUME-002`) + `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-loop` — the real persisted restart-count read and the real bound decision

**Preconditions**:
- Persisted restart count 3 (equal) and 4 (above); bound 3.
- (a) a clean exit; (b) a stall in the single iteration.

**Steps**:
1. Run (a) for both counts; assert no admission refusal and the clean classification.
2. Run (b) for both counts; assert `max-restarts` with the exhaustion record.

**Expected Outcome**:
- No `dispatch.restart-budget-exceeded` refusal at admission in any row.
- (a): exactly one iteration, one attempt, the clean classification (e.g. `pr-open`), `restarts` unchanged.
- (b): exactly one iteration, one attempt with `max-restarts`, exactly one exhaustion record, and the session terminated before the record.
- The pre-change `TC-RESUME-002` assertions (refusal before any spawn) are removed and replaced by these; the suite keeps its file and its subject.

#### TC-SPAWN-001 - A fresh spawn renders one `--agent pm` and one resolved `--model`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, API-6, API-7, TDR-0049
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-spawn.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-spawn` — the real composition → `resolveHarnessAdmissionBinding` → adapter argv rendering → recorded starter invocation

**Preconditions**:
- The production composition with a declared provider profile whose `pm` seat resolves to a fixed model, injected through the configuration files in the temp checkout.
- The recording starter captures `file`, `args`, and options.

**Steps**:
1. Run a fresh dispatch.
2. Inspect the recorded invocation.

**Expected Outcome**:
- `args` contains exactly one `--agent` immediately followed by `pm`; exactly one `--model` immediately followed by the resolved seat model.
- The invocation's `file` is the harness command (never a shell); options carry no `shell` member other than the adapter's fixed `shell:false`; the runner guard records zero shell/script violations.
- The attempt record's `binding` equals the resolved `{agent:"pm", seat, model}`.

#### TC-SPAWN-002 - Exactly one deterministic `ticket-<REF>` title on a fresh spawn, none on a resume

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, API-6, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-spawn.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-spawn` — the real spawn-title fact through the composition and the adapter's argv rendering

**Preconditions**:
- A fresh dispatch and a resumable lane for the same ref.

**Steps**:
1. Run fresh; assert the title argument.
2. Run `--resume-prompt`; assert no title argument.
3. Assert the title grammar across two refs (`GH-347`, `PDEV-12`) and reject a malformed ref at input.

**Expected Outcome**:
- Fresh: exactly one `--title` followed by `ticket-GH-347`; the value is one token (no whitespace), matches `^ticket-[A-Z]+-[0-9]+$`, and is byte-identical across two runs.
- Resume: zero `--title` occurrences.
- A ref outside the work-item grammar is refused at input (`input.value.rejected`) before any spawn.

#### TC-SPAWN-003 - The prompt is the lifecycle prompt parameterized by ref and base branch

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-3, API-6, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-spawn.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-spawn` — the real composition prompt supply and the real base-branch resolution

**Preconditions**:
- The composition resolves a declared base branch (fixture: `main-tools`).
- A fresh spawn and a resume with and without an operator prompt.

**Steps**:
1. Run fresh for `GH-347` and for `GH-348`; capture the spawn prompt.
2. Run a resume with `--resume-prompt "operator text"` and a resume without it.

**Expected Outcome**:
- The fresh prompt contains the ref, the base branch, and the five required lifecycle sections (state detection, resume sync, actions by state, eleven-phase lifecycle, merge authority) — asserted by stable section markers, not by prose equality.
- The two refs' prompts differ; the base branch value appears literally; the prompt is not the delivered constant sentence (`Deliver change <ref> through the delivery lifecycle.` fails the section assertions).
- Resume with an operator prompt uses that text verbatim; resume without it uses the lifecycle prompt.
- The prompt never becomes part of argv (it is stdin/prompt data) and carries no shell metacharacter handling.

#### TC-SPAWN-004 - Role-less stays role-less; the agent and title are not operator-overridable

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-7, AC-F7-4, API-6, NFR-10
**Test Type(s)**: Integration + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-spawn.test.ts` + `tests/structure/dispatch-help-inventory.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-spawn` — the real role-less passthrough and the real command grammar/help surface

**Preconditions**:
- A role-less composition (harness port without an agent) and the production composition.
- The command grammar/help inventory.

**Steps**:
1. Run the role-less composition; assert no binding is recorded and no `--agent`/`--model` is rendered.
2. Run the production composition; assert the agent/binding are present (the production path is not role-less).
3. Attempt `dispatch GH-347 --agent reviewer --title custom --json`; assert the grammar rejects it.
4. Assert the help/usage surface lists no agent/title option.

**Expected Outcome**:
- Role-less: attempt record has no `binding`; args carry no `--agent`, `--model`, or `--title`; no refusal invented.
- Production: binding present.
- `--agent`/`--title` are unknown options: exit 1 with the delivered unknown-option identity, zero spawns.
- The help inventory count and the four-key recorded grammar are unchanged.

#### TC-DERIVE-001 - Tracker-done with no visible PR is `merged`, tracker-corroborated

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, DM-3, DM-4, TDR-0048, DEC-6
**Test Type(s)**: Unit + Command
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts` (extend) + `tests/conformance/dispatch/dispatch-parity-battery.test.ts`
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-derive` — the real `deriveDispatchResult` (pure and through the command path)

**Preconditions**:
- Tracker fact: `{state:"done", blocking:false}`; PR fact `none`; commits 0; pm-notes absent; CI unreadable.
- Two read-precedence rows: the same done tracker with an **unreadable artifact read** (`artifact.read-unreadable`), and with an **unreadable ledger read** (`ledger.read-unreadable`).

**Steps**:
1. Pure: `deriveDispatchResult(truthInput({tracker: readOk(tracker({state:"done"}))}))`, then the same input with `artifacts: readFail("artifact", …)` and with `ledger: readFail("ledger", …)`.
2. Command: all three inputs through the composed program.
3. Read the attempt record's corroboration and divergences.

**Expected Outcome**:
- All three inputs yield token `merged`, exit 0, `urlResolved === false`, `prUrl === ""` — the tracker-done arm precedes every artifact read, so an unreadable artifact or ledger does not degrade it to `state-unverified`.
- Corroboration: `tracker === "satisfied"` (arm-aware); `pmNotes`/`ci` do not gate the arm; the unreadable ledger is disclosed (`unreadable` corroboration source) without changing the token.
- `falseSuccess === false`; divergence count for the pair is 0 (absent pm-notes and unreadable CI raise no false-success incident for this arm).

#### TC-DERIVE-002 - Tracker-done wins over a blocking label

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-2, DM-4, RSK-4
**Test Type(s)**: Unit + Command
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts` (extend)
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-derive` — the real order (pure and through the command path)

**Preconditions**:
- `{state:"done", blocking:true}`; `{state:"delivery-blocked", blocking:true}` for the converse; and `{state:"delivery-blocked", blocking:true}` with an **unreadable artifact read** as the read-precedence row.

**Steps**:
1. Derive all three; assert tokens and order-sensitivity.
2. Command-run all three.

**Expected Outcome**:
- Done + blocking → `merged` (tracker-done precedes blocking).
- Blocking without done → `blocked`, exit 0 (the `blocked` row projects `success`; this is the delivered baseline, not a change).
- Blocking without done **plus an unreadable artifact read** → `blocked`, exit 0: the blocking arm precedes the artifact read, so an unreadable artifact never degrades it to `state-unverified`.
- The inputs are distinguishable: none yields two tokens, and swapping the ladder order changes the first assertion (see `M61`).

#### TC-DERIVE-003 - Commits + complete pm-notes → `finished`; incomplete/absent → `partial`

**Scenario Type**: Happy Path / Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-3, DM-3, DM-4
**Test Type(s)**: Unit + Command
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts` (extend)
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-derive` — the real artifact completeness arm and the real pm-notes read

**Preconditions**:
- Artifact table: commits 2 + pm-notes `complete`; commits 2 + `incomplete`; commits 2 + `absent`; commits 2 + malformed document (reads `incomplete`).
- Harness outcome carried (e.g. `completed`, and one row with `failed` non-zero exit).

**Steps**:
1. Derive each row; assert token, outcome, exit.
2. Assert `finished !== partial` as tokens and distinct projections.

**Expected Outcome**:
- `complete` → `finished`, exit 0, outcome carried from harness.
- `incomplete`/`absent`/malformed → `partial`, exit 1, and the harness outcome is carried on the record.
- The fallible direction holds: no malformed or absent document ever yields `finished`.
- The retired ledger arm does not interfere (`TC-DERIVE-005`).

#### TC-DERIVE-004 - R7: a divergent ledger still yields `finished`, divergence delivered, `falseSuccess` never suppressed

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-3, DM-3, DM-4, DEC-11, TDR-0024
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` + `tests/behaviour/dispatch-false-success.test.ts` (extend) + parity battery row
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-derive` + `S-lane` — the real derivation, the real corroboration/false-success classifier, the real divergence ledger

**Preconditions**:
- Two rows over the same divergent ledger: (a) the verify-change read reports **no outcome** (`verifyOutcome: null`); (b) the verify-change read reports a **non-complete** outcome (e.g. `partial`).
- Commits 2, PR `none`, pm-notes `complete` (real pm-notes file with a non-null `delivery` completion).
- Ledger fact: `progressed: false`, `completed < total` (not complete); `phasesComplete: false` (the ledger-sourced corroboration source, deliberately unchanged by DEC-11).
- Tracker readable, non-done, non-blocked.

**Steps**:
1. Row (a): run the dispatch twice against the same state; read the attempt record, the comparison, the divergences, and the false-success classification.
2. Row (b): run once; read the same observations and the appended divergence record.

**Expected Outcome**:
- Token `finished`, exit 0 in both rows — the divergent ledger does not move the token.
- `corroboration.pmNotes === "unsatisfied"` (ledger-sourced by design) and `falseSuccess === true` in both rows: the honesty signal is present and never silently suppressed.
- **No `state-unverified` delivered-evidence divergence in either row.** That path is `su`-gated over `isDeliveredEvidence`, and a `finished` token cannot reach it: assert the count of records matching the delivered-evidence shape (`comparisonClass === "not-applicable"`, `engineToken === "state-unverified"`, `comparisonToken === null`) is exactly 0.
- Row (a): the comparison class is `not-applicable` and the divergence count for `(repository, ref)` is exactly 0; the second run appends no divergence either.
- Row (b): exactly **one** divergence with `comparisonClass === "verify-change"`, `engineToken === "finished"`, and `comparisonToken` equal to the verify read's outcome — the delivered `verify-change` record shape, no new incident kind, no new divergence class. The delivered evidence-divergence dedupe is `su`-gated and is deliberately not claimed here; per-attempt `verify-change` records are the delivered behaviour.
- The delivered `isDeliveredEvidence` predicate is unchanged: the `state-unverified` delivered-evidence divergence path still behaves as its own suite asserts.

**Notes**: This is mandated observation (b) and the mechanism-precise half of finding 6. It pins the boundary DEC-11 records: the corroboration source stays the ledger, `falseSuccess` is never suppressed, and the only divergence a divergent-ledger `finished` can produce is the conditional `verify-change` record. Re-pointing the `pm-notes` source is out of scope and would be a different decision.

#### TC-DERIVE-005 - The nothing-to-do arm requires no commits and a readable tracker; the ledger arm is retired

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-4, DM-3, DM-4, R2
**Test Type(s)**: Unit + Command
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts` (extend)
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-derive` — the real nothing-to-do arm and the retired ledger arm

**Preconditions**:
- Rows: (a) commits 0, PR none, readable non-done non-blocked tracker → `noop-lane-nothing-to-do`; (b) same but tracker unreadable → `state-unverified`; (c) commits 0, PR none, complete phase ledger (`completed === total`, `workRemaining:false`), tracker in-progress → `noop-lane-nothing-to-do` (ledger does **not** gate); (d) commits 2 + complete ledger + pm-notes complete → `finished` (never nothing-to-do); (e) commits 2 + complete ledger + pm-notes incomplete → `partial`.

**Steps**:
1. Derive every row and assert the token; then command-run (a), (d), (e).
2. Assert the retraction explicitly: no row's token changes when `workRemaining` flips, except through the arms above.

**Expected Outcome**:
- (a) `noop-lane-nothing-to-do`, tracker-corroborated with no false-success incident: `corroboration` equals `{pmNotes:"not-applicable", tracker:"satisfied", ci:"not-applicable"}` and `falseSuccess === false`, so absent pm-notes and CI raise no incident for a true no-op.
- (b) `state-unverified` exit 2 — the arm is not taken on an unreadable tracker.
- (c) `noop-lane-nothing-to-do` only because the shell condition holds (commits 0, PR none, readable tracker) — not because the ledger is complete. Proven by flipping `workRemaining` and `completed/total` while holding the artifact/tracker facts: the token is unchanged.
- (d) `finished` / (e) `partial` — the retired ledger arm is what makes these two reachable.

#### TC-DERIVE-006 - The total order is disjoint, and the vocabulary/exits are unchanged

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-5, DM-4, NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts` + `tests/behaviour/dispatch-token-closure.test.ts` (extend)
**Tags**: @backend, @dispatch, @offline
**Seam**: `S-derive` — the real total order, the real taxonomy, and the real projection

**Preconditions**:
- A fixture table of **25 derivation-reachable inputs** (4 + 14 + 4 + 3):
  - **4 attempt-stage inputs** — Appendix F(B), the only B arms that are real `deriveDispatchResult` inputs: B1 `spawnFailure: true` → `failed`; B2 `resumeAdmission {admitted:false, reason:"uneconomical"}` → `failed`; B3 `resumeAdmission {admitted:false, reason:"unreadable-facts"}` → `state-unverified`; B4 an unreadable harness read (`harness` not ok) → `state-unverified`.
  - **14 completed-session ladder inputs** — C1–C14. C1–C9 are the single-arm rows; **C10 is rebuilt** as a non-clean end with no decisive artifact (tool failure, commits 0) so the classifier arm (arm 9) is genuinely exercised rather than re-matching the commits arm; **C11–C14 are the four ordering rows** where a decisive artifact beats a non-clean classifier token: C11 failed + open PR → `pr-open`; C12 failed + commits + complete pm-notes → `finished`; C13 premature end + open PR → `pr-open`; C14 tool failure + commits + complete pm-notes → `finished`.
  - **4 collision inputs** — done+blocking, done+open PR, open PR + commits, commits 0 + complete ledger (rows X1–X4).
  - **3 read-precedence inputs** — tracker-done + unreadable artifact read, tracker-blocking + unreadable artifact read, tracker-done + unreadable ledger (rows R1–R3).
- **Excluded by construction — Appendix F(A), A1–A9 (nine rows): no token, typed pre-session refusal.** `deriveDispatchResult` has no pre-session branch (its first arms are `spawnFailure`, `resumeAdmission`, the harness read, then the truth reads), so a pre-session refusal yields no token, no attempt record and no lane, and cannot be observed by this unit case. Their evidence is owned at the command level and is not re-asserted here: the typed refusals by `TC-ADMIT-001`…`005` and `TC-LANE-002` (zero attempts, zero lanes, declared pair, mapped exit), and the class replay by `TC-PARITY-001`.
- **Also excluded — the stall ladder (Appendix F(D)) and the restart-budget arm.** Both are loop/bound outcomes, owned by `TC-TERM-003`/`TC-TERM-004`/`TC-LOOP-001`…`003` and `TC-LOOP-002`/`TC-LOOP-006`; this table does not treat them as derivation inputs.
- Each input declares the one arm it must match and the token that arm projects.

**Steps**:
1. For each of the 25 inputs, assert the derived token equals the token its declared arm projects.
2. Assert per-input disjointness against the derivation's **returned declared `armId`**: `deriveDispatchResult(input).armId` equals the row's single declared arm, and every returned `armId` is a member of the closed declared arm set (14 ids). A row whose tag disagrees with the arm that actually fired fails by name — this is what closed the C10 mislabelling (dominated by the commits arm) rather than papering over it.
3. Assert the observed token set equals the taxonomy subset those arms project — **10 tokens**: `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`, `finished`, `state-unverified`, `partial`, `noop-lane-permission`, `noop-lane-nothing-to-do`. `max-restarts` is the eleventh token and is a loop/bound outcome covered by `TC-LOOP-002`/`TC-LOOP-006`.
4. Assert the taxonomy: 11 tokens, projection per token, exit per projection (`state-unverified` 2, `partial` 1, `blocked` 0, `max-restarts` 1), attempt-record schema version unchanged.

**Expected Outcome**:
- 25/25 inputs yield the token their declared arm projects; 0 inputs yield two arms (`armId` is exactly the declared arm for every row); 0 inputs yield a token outside the projected subset.
- The nine A rows are explicitly **not** asserted here and cannot be: they produce no token. AC-F8-5's eleven-class obligation is therefore covered jointly — 10 tokens by arm here, `max-restarts` by the loop cases, and all eleven replayed end-to-end by `TC-PARITY-001`.
- An arm is not a token: the 25 inputs cover **10 of the 11** tokens (`max-restarts` is the eleventh, a loop/bound outcome), with more than one arm each for `merged` (tracker-done ×5 rows, already-merged PR), `pr-open` (×4 rows), `partial` (incomplete pm-notes, classifier) and `failed` (spawn failure, resume-uneconomical).
- `DELIVERY_RESULT_TOKENS` length 11 and order unchanged; `DELIVERY_RESULT_TAXONOMY` projections unchanged; the exit of every token equals its projection's exit.
- `DISPATCH_ATTEMPT_PAYLOAD_SCHEMA` version unchanged.

#### TC-PARITY-001 - All 11 classes replay through the real derivation and command path

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-9, AC-F9-1, AC-F8-5, DM-9, NFR-1, NFR-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-battery.test.ts`
**Tags**: @backend, @dispatch, @parity, @offline
**Seam**: all five — `S-claim`, `S-lane`, `S-spawn`, `S-ladder`, `S-terminate` — plus `S-derive`, each row declaring the one it exercises

**Preconditions**:
- The registry `tests/fixtures/dispatch/parity/cases.ts`, filtered to its `class` group (11 rows).
- Every row declares: class, fixture inputs, production seam exercised, expected token, expected exit.

**Steps**:
1. For each `cases.ts` `class` entry, call its `scenario` builder and run one dispatch; capture exit, token, envelope, attempt record.
2. Assert the token and exit; assert the row's declared seam was actually exercised (e.g. spawn refusal row: the session port recorded a refusal; terminate row: the starter recorded signals).
3. Assert 11 distinct classes were observed exactly once each.

**Expected Outcome**:
- 11/11 tokens produced, each by its declared arm, each with the delivered exit.
- The observed class set equals the taxonomy set (no missing, no extra).
- Each row's `declaredSeam` is one of the five production seams (§7.1) and the corresponding observation is non-empty; a row whose seam observation is empty fails.
- This is the extension of the delivered `dispatch-e2e.test.ts` class driver, not a parallel table: the existing `ALL_CLASSES`/`drive` shape is reused and extended with the new arms and seams, and the rows come from the registry rather than being re-authored in this suite.

#### TC-PARITY-002 - Every case exercises the real production seam; a reimplementation is rejected

**Scenario Type**: Structure
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-9, AC-F9-2, DM-9, NFR-10, DEC-9
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-battery.test.ts` + `tests/fixtures/dispatch/parity/seams.ts`
**Tags**: @backend, @parity, @offline
**Seam**: the seam manifest: the production modules each seam is imported from

**Preconditions**:
- The production seam modules and the battery sources.

**Steps**:
1. Assert the battery fixture imports each production seam symbol from its production module (import identity), and that no battery file declares a local function whose name or body re-expresses a seam (`claim*`, `*Ladder*`, `*Terminate*`, `*Derive*` bodies containing the seam's decision logic).
2. Scan `tests/**` for the reimplementation signatures: the pre-read+claim pair (`dispatchAdmissionRefusal` and `claimQueueLease` in the same file without going through the exported claim seam), a local retry loop with a timer, a local `process.kill`/`child.kill` sequence, a local token ladder.
3. Planted control: a temporary copy of the fixture with a local claim reimplementation; assert the check rejects it by name.

**Expected Outcome**:
- The import-identity assertion passes for every seam: `claimDispatchLease`, `resolveDispatchLane`, `deriveDispatchResult`, `runDispatch`, the tracker ladder read, and the terminate port member.
- The forbidden-signature scan is empty on the live tree.
- The planted reimplementation is rejected with a message naming the file and the seam (`reimplementation of <seam> in <file>`), proving the check is not vacuous.

#### TC-PARITY-003 - Two consecutive runs are identical with zero live network and zero live processes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-9, AC-F9-3, NFR-1, DM-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-battery.test.ts`
**Tags**: @backend, @parity, @offline
**Seam**: all five — every seam is replayed under the guards and the canonicalizer

**Preconditions**:
- The registry `tests/fixtures/dispatch/parity/cases.ts` (§6.1): every group — `class` (11), `admission`, `resume`, `tracker-outage`, `loop`, `terminate`, `spawn`. The registry is the only place a parity scenario is defined.
- A fresh temp checkout/state per run, a fixed clock, a fixed id sequence, and the canonicalizer that replaces the temp root with `<root>`.
- Guards: the injected transport counts live requests; a network guard fails any real `fetch`; the runner/starter guard records real process starts.

**Steps**:
1. Call `runAllParityCases()` twice, in isolated roots. No scenario is re-authored in this suite: the registry is the driver, so "whole battery" is defined by the registry's contents, not by a list in the test body.
2. Canonicalize and compare envelopes, attempt counts per group and per class, and class coverage.
3. Assert the guard counters.
4. Assert the registry is complete: the observed groups equal the declared group set, and the observed case count equals `PARITY_CASES.length` (a registry row that is never executed fails).

**Expected Outcome**:
- Canonical output is byte-identical between the runs (fixed clock/ids make non-path values identical; only root paths are normalized).
- Per-group and per-class attempt counts identical; class coverage identical (11/11 both runs).
- `liveNetworkRequests === 0`, `realChildStarts === 0`, `shellInvocations === 0` across both runs; the injected transport saw every request.
- Every declared registry entry executed at least once in each run — no case is silently skipped.

#### TC-PARITY-004 - The proved / not-proved boundary is a permanent constant and is self-consistent

**Scenario Type**: Structure
**Impact Level**: High
**Priority**: High
**Related IDs**: F-9, AC-F9-5, NFR-10, RSK-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-battery.test.ts` + `tests/fixtures/dispatch/parity/evidence.ts`
**Tags**: @backend, @parity, @offline
**Seam**: none executed; the permanent fixture constant `PARITY_PROOF_BOUNDARY` is checked for shape, declared order, and consistency with the parity registry

**Preconditions**:
- `PARITY_PROOF_BOUNDARY` in `tests/fixtures/dispatch/parity/evidence.ts`: `proven` = exactly eight ids in the declared order (`claim`, `lane`, `spawn`, `ladder`, `terminate`, `loop`, `class-coverage`, `no-shell`); `notProven` = exactly six ids in the declared order (`live-opencode`, `live-provider`, `os-termination`, `real-lifecycle-outcome`, `cross-process-race`, `long-run-outage`).
- The registry `PARITY_CASES` from `tests/fixtures/dispatch/parity/cases.ts`, each entry carrying its `declaredSeam`.
- No other input: the case reads no change artifact, no `doc/changes/**` path, and no specification.

**Steps**:
1. Assert `PARITY_PROOF_BOUNDARY.proven` deep-equals the eight-id array above (count and order).
2. Assert `PARITY_PROOF_BOUNDARY.notProven` deep-equals the six-id array above (count and order).
3. Assert every `PARITY_CASES` entry's `declaredSeam` is a member of `proven`; assert no entry's seam is a member of `notProven` and none starts with `live-`.
4. Planted controls in a temp-workspace copy of the constant, each of which must fail by name: append a ninth id to `proven`; remove one id from `proven`; swap two ids in `proven`; append a seventh id to `notProven`; and add a registry entry whose `declaredSeam` is `live-opencode`.
5. Assert this suite's own source contains no `doc/changes/` reference, so the boundary check can never regress into reading a change artifact.

**Expected Outcome**:
- `proven` is exactly 8 ids and `notProven` is exactly 6 ids, each byte-equal and in the declared order; the check passes on the live tree.
- Every parity row's `declaredSeam` is a proven surface; zero rows declare a not-proven or unclassified surface.
- The planted controls fail by name: `proof boundary drift: proven expected 8 ids, received 9`; `proof boundary drift: proven expected 8 ids, received 7`; `proof boundary drift: proven order expected [<declared>], received [<swapped>]`; `proof boundary drift: notProven expected 6 ids, received 7`; `parity row <id> declares a not-proven seam live-opencode`.
- The suite source scan finds 0 `doc/changes/` references; a re-added one fails by name.
- The case asserts nothing about the current-truth page: publication and page/constant agreement belong to phase 7 and the doc guard in the aggregate (§1.2).

**Notes**: This is the permanent half of finding 12. The boundary's single source is the fixture constant; the same boundary is published on `doc/spec/features/feature-dispatch-engine.md` and reconciled in phase 7, whose page/constant mismatch is a documentation-phase defect caught by the doc guard in `pnpm check`. Neither the change specification nor this plan is read by a permanent suite.

#### TC-PARITY-005 - Record bounds and redaction hold across the whole battery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-7, NFR-4, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-battery.test.ts` + `tests/behaviour/dispatch-privacy.test.ts` (extend) + `tests/behaviour/dispatch-attempts-bounds.test.ts` (extend)
**Tags**: @backend, @parity, @offline
**Seam**: all record writers — `S-lane`, `S-derive`, the attempt ledger, and the economics ledger

**Preconditions**:
- Every lane, attempt, divergence, and economics record produced by the battery.
- Redaction canaries injected in the prompt, the resume prompt, the harness stdout, the credential, and a provider payload.

**Steps**:
1. For every lane record: assert the exact key set (no extra key) and scan every string value for the canaries and for prompt/transcript/diff-shaped content.
2. For every attempt and divergence: assert `evidenceRefs.length <= DISPATCH_MAX_EVIDENCE_REFS` (16), each ref matches the identifier pattern, and no ref carries a newline, whitespace, or a canary.
3. Feed `maximalEvidenceRefs()` plus six extra candidate refs into the engine and assert exactly 16 are retained, deterministic and ordered, and the 17th is dropped.
4. Assert every diagnostic/`lastMessage` is single-line and `<= DISPATCH_MAX_LAST_MESSAGE_CHARS`.

**Expected Outcome**:
- No canary appears in any record, envelope, or diagnostic.
- Lane records: one `owner` object, one session identity, zero prompt/transcript/diff/credential/provider keys.
- Evidence refs: `<= 16` everywhere; the 17-candidate case retains exactly 16, identical across two runs.
- Diagnostics single-line, bounded, identifier-only.

#### TC-PARITY-006 - Daemon-path regression: it inherits tracker-done `merged`, artifact `partial`, the retired ledger arm

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, AC-F8-2, AC-F8-3, AC-F8-4, DM-4, NFR-10, R2a
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` (extend)
**Tags**: @backend, @daemon, @offline
**Seam**: `S-derive` — the one shared derivation, driven through the real daemon lane harness

**Preconditions**:
- The delivered daemon lane harness (`createLaneExecutor` + `runSupervisionCycle` + `recordDaemonDispatchResult`) over the same evidence fixtures as the one-shot path.
- Rows: tracker done + no PR (the tracker-done `merged` arm); tracker done + blocking (a second tracker-done `merged` arm); already-merged PR with commits (the PR `merged` arm, the corroboration control); commits 2 + complete pm-notes; commits 2 + incomplete pm-notes; commits 2 + complete ledger + `workRemaining:false`.

**Steps**:
1. For each row, run the daemon path and the one-shot path over identical evidence.
2. Assert both tokens and exits; read the daemon attempt record's `corroboration` and `falseSuccess`.
3. Assert the daemon appends exactly one attempt record per classification.

**Expected Outcome**:
- Daemon tokens: `merged` (tracker-done), `merged` (tracker-done + blocking), `merged` (already-merged PR), `finished`, `partial`, `finished` — identical to the one-shot tokens for the same facts (no forked derivation).
- **Tracker-done `merged` rows** (both): the daemon attempt's `corroboration` equals `{pmNotes:"not-applicable", tracker:"satisfied", ci:"not-applicable"}` and `falseSuccess === false` — the arm-aware tracker-only corroboration is inherited, and absent pm-notes/CI create no false-success incident on the daemon path.
- **Already-merged-PR `merged` row**: `corroboration.tracker === "satisfied"` and `falseSuccess === false`. This arm keeps the token-keyed sufficiency (F-8 changes only the tracker-done arm and nothing-to-do), so `corroboration.pmNotes` and `corroboration.ci` carry the injected facts (`"satisfied"` in this fixture) and are **not** `"not-applicable"`; asserting the tracker-only triple here would encode the token-wide weakening F-8/DEC-6 reject.
- The retired ledger arm holds on the daemon path too: a complete ledger with commits never yields `noop-lane-nothing-to-do`.
- `recordDaemonDispatchResult` appends one attempt record; a replay/resume appends none (the delivered `TC-DAEMON-002` assertion still holds).

**Notes**: This is mandated observation (a); the spec makes it a plan obligation (`DM-4`, §8.5) because `deriveDispatchResult` is shared.

#### TC-SHELL-001 - The injected runner records zero shell invocations across the battery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-9, AC-F9-4, API-7, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-no-shell.test.ts`
**Tags**: @backend, @parity, @offline
**Seam**: `S-exec` — the guarded injected runner over every child seam (`harnessSpawnRunner`, `harnessSpawnStarter`, `gitChildRunner`, `githubCliRunner`)

**Preconditions**:
- The guarded process runner factory used for every injected child seam: `harnessSpawnRunner`, `harnessSpawnStarter`, `gitChildRunner`, `githubCliRunner`.
- The guard records `{seam, file, args}` and fails by name on a shell file (`bash|sh|zsh|dash|cmd|powershell`) or a script-path argument (a value ending `.sh`, or starting `scripts/`, `tools/`, or containing `deliver-ticket`).
- The whole registry `tests/fixtures/dispatch/parity/cases.ts` — every group it declares, no subset.

**Steps**:
1. Call `runAllParityCases()` under the guarded runner. The registry, not the test body, defines the sweep, so no group can be omitted by omission of a call site.
2. Assert the guard's records, the argv shape of every spawn, and the `shell` option.
3. Assert the executed case count equals `PARITY_CASES.length` and every group the registry declares was observed.

**Expected Outcome**:
- `shellInvocations === 0`, `scriptPathInvocations === 0` across every seam and every row, including the loop and terminate paths.
- Every harness invocation is the harness command with a fixed argv; `shell:false` is the only value observed at the spawn call site.
- No recorded argv element is a `.sh` path or a `scripts/`/`tools/` path.
- A requested shell or script path is a hard failure with the seam and the offending value in the message.

#### TC-SHELL-002 - The static no-shell invariant passes and a planted reference fails it by name

**Scenario Type**: Invariant
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-9, AC-F9-5, API-7, NFR-5, DOD-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts`
**Tags**: @backend, @checks, @offline
**Seam**: `S-exec` — the static invariant over the declared dispatch-flow surface

**Preconditions**:
- A declared dispatch-flow surface list (see §7.2), and a registry of precise rules (not a blanket grep): `R1` is anchored on whole string-literal values (ends `.sh`, is a `scripts/`/`tools/` path, or contains `deliver-ticket`), never on raw substrings.
- A temp workspace writer for the planted-reference control (the `forbidden-literals` pattern).

**Steps**:
1. Run the invariant over the live tree: assert zero violations and assert every declared surface file exists and is reachable from the dispatch entry (so the list cannot silently rot).
2. Write a temp workspace with one planted violation per rule class (a string literal `"scripts/deliver-ticket.sh"` for `R1`; a child-process `spawn(cmd, args, { shell: true })` for `R4`; an `import { execSync } from "node:child_process"` for `R3`) and assert each is reported by rule name and file.
3. Assert the rules do not fire on the legitimate controls: `shell: false` in the host starter; a `scripts/checks/*.ts` reference outside the surface; `scripts/` in documentation; the `.sha` member accesses in `packages/cli/src/edge.ts` (`facts.head.sha`, `head.sha`, `read.sha`) and any `.sha` member access in `packages/cli/src/production.ts`; `queue.shift()` in `packages/adapters/src/host/index.ts`; the five `RegExp.prototype.exec` calls in `packages/cli/src/edge.ts` (`regex.exec(text)`) for `R3`; and the two port `.spawn(` calls (`ports.harness.spawn` in `packages/core/src/app/dispatch.ts`, `resolvedHarness.port.spawn` in `packages/cli/src/production.ts`) for `R4`. A named control file that carries no such token today gets a planted one in the temp-workspace copy, so the control is never vacuous.
4. Negative control for `R1`'s anchoring: plant a member access/identifier shaped like a violating literal (`head.sha`, `queue.shift`) and assert it is **not** reported; then plant the literal `"head.sh"` and assert it **is** reported — proving the rule distinguishes a literal from a member name.
5. Negative control for `R3`/`R4`'s receiver binding: plant a `RegExp.prototype.exec` call (`regex.exec(text)`) and a port-method `.spawn(` call in the temp workspace and assert neither is reported; then plant `import { execSync } from "node:child_process"` and assert `R3` reports it by name, and plant `spawn(cmd, args, { shell: true })` against the child-process `spawn` import and assert `R4` reports it by name — proving that a name-only matcher (`exec`, `spawn`) and a shell-flag-only matcher each fail.

**Expected Outcome**:
- Live tree: 0 violations, surface list non-empty and all files present.
- Each planted reference fails by name (`no-shell invariant: script-path literal`, `no-shell invariant: shell-enabled spawn`, `no-shell invariant: shell-exec import`) with `file:line`.
- Zero false positives on every control; a `shell:false` call site is accepted, `.sha`/`shift` never match `R1`, `RegExp.prototype.exec` never matches `R3`, and a port `.spawn(` call never matches `R4`.
- The allowlist is empty; a violation cannot be silenced without a recorded justification in the check source.

#### TC-CONTRACT-001 - The closed contract surface is unchanged against a pinned baseline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-3, NFR-11, DOD-7, NG-4, NG-5
**Test Type(s)**: Invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-contract-invariance.test.ts` + extensions to `dispatch-additive-stability.test.ts`, `error-table-sync.test.ts`, `dispatch-exit-projection.test.ts`, `dispatch-token-home.test.ts`
**Tags**: @backend, @checks, @offline
**Seam**: none executed; the declared contracts, the error table, the taxonomy, and the configuration key surface are compared against the pinned baseline

**Preconditions**:
- The delivered baselines (taxonomy, projection map, error table, domain kinds, config defaults, attempt schema version) captured as a pinned fixture in this change.

**Steps**:
1. Compare the live taxonomy, projection classes, exits, error-table rows, and domain kinds against the pinned fixture.
2. Compare the resolved configuration key set and the four consumed default values (`30000`, `3`, `20000`, `90000`).
3. Assert the attempt-record payload schema version is unchanged.

**Expected Outcome**:
- 0 added/removed/changed tokens, projections, exits, error rows, or domain kinds.
- 0 new configuration keys; the four defaults are exactly unchanged.
- The attempt schema version is unchanged and pre-change fixture records still decode.

## 6. Environments and Test Data

**Environment.** Local developer workstation and CI, `bun test`, no network. Every run works inside the repository's approved temp root: `tmp/tmpdir` under `$PWD` (the `admission.ts` precedent), created with `mkdir -p tmp/tmpdir` and disposed in `finally`. `TMPDIR=$PWD/tmp/tmpdir` is exported for every command so `mkdtemp` never escapes the repo. The live state directory, `~/.config`, real provider credentials, and a real checkout are never read.

**Determinism devices.** Fixed clock instant; fixed id sequence; fixed liveness sequences; the injected `delay(ms, reason)` recorder; a virtual clock advanced only by that recorder; the fixed provider profile and base branch; a fixed evidence class.

### 6.1 Fixture inventory

**Exists — reuse, do not duplicate.**

| Fixture | What it gives |
|---------|----------------|
| `tests/fixtures/dispatch/harness.ts` | Temp state root, fixed clock, id sequence, scripted session port (spawn/resume/collect/liveness/listSessions, `spawnInputs` recorder), evidence constants (`COMPLETED_EVIDENCE`, `TIMED_OUT_EVIDENCE`, `SPAWN_REFUSED_EVIDENCE`, `TOOL_FAILURE_EVIDENCE`, `PREMATURE_END_EVIDENCE`) |
| `tests/fixtures/dispatch/truth.ts` | Read builders, `artifacts`/`ledger`/`tracker`/`restarts`/`prOpen`/`prMerged`, `readOk`/`readFail`, the unreadable and no-artifact inputs |
| `tests/fixtures/dispatch/golden/harness.ts` | Command-level scenario over the edge runtime, `readsFrom`, `exitOf` (projection-derived exit), lease/exhaustion recorders, append-failure store wrapper |
| `tests/fixtures/dispatch/admission.ts` | The production-composed harness pattern (temp checkout + derived state, injected runner/starter/transport/git/credentials, canary secret) — the base for the parity driver D1 |
| `tests/fixtures/dispatch/ledger.ts`, `attempt-records.ts` | `makeAttemptFor`, `REPOSITORY`, `maximalAttempt`, `maximalEvidenceRefs` (16), `ledgerOf`, divergence builders |
| `tests/fixtures/dispatch/attempts-harness.ts`, `evidence-windows.ts`, `attempts-production.ts`, `mutants/`, `golden/` | Attempt read harness, evidence windows, mutant corpus, golden texts |
| `tests/fixtures/queue/single-flight/harness.ts` | Real store with seeded entries/leases, `dispatchClaim`, `claim` (sibling), `TTL`, `seedLease` |
| `tests/fixtures/harness/harness-io.ts` | `createRecordingRunner`, `streamStarterFromRunner`, session-output framing helpers |
| `tests/conformance/dispatch/controlled-repo.ts` | Real store + real command path, `provenance()` guard, eleven-class `drive` shape |
| `tests/fixtures/state/harness.ts` | `makeIdentity`, `openStore`, `makeAuditStore`, `removeRoot` |

**Must be authored — extension of the above, in the same fixture family.**

| New file | Contents |
|----------|----------|
| `tests/fixtures/dispatch/parity/harness.ts` | Driver D1: one composed production program per run over a temp checkout/state; composes `createProductionComposer` with the guarded runner, the scripted starter, the scripted transport, the git runner, the credential port, `processId`, the fixed clock, the id sequence, and the injected `delay`. Exposes `run`, `observe()` (attempts, lanes, divergences, economics, envelopes), and `dispose()`. Parses envelopes through `runCli` exactly as `admission.ts` does. |
| `tests/fixtures/dispatch/parity/process-runner.ts` | The injected process runner and its guard: `guardedRunner({seam})` wrapping `harnessSpawnRunner`, `harnessSpawnStarter`, `gitChildRunner`, `githubCliRunner`; records `{seam,file,args,options}`; refuses shell files and script-path arguments by name; counts real starts (always 0 in the battery). |
| `tests/fixtures/dispatch/parity/terminate.ts` | The process-tree model (`root` pid, descendants, escaped runtimes tagged by session id and by `ticket-<REF>`, unrelated pids) with per-pid signal logs; **terminate-capable** adapter double (declares the operation, implements TERM→KILL after the injected grace, exact-identity reap) and **terminate-incapable** double (declares the gap, exposes no member, records any call as a violation). |
| `tests/fixtures/dispatch/parity/interleave.ts` | The deterministic two-invocation interleaving: a latch (`arrive`/`release`) wired to the injected fence wait; an external fence holder handle for the persistent-contention case; the virtual clock and the cumulative-wait recorder. |
| `tests/fixtures/dispatch/parity/lane.ts` | Seeders and readers for `dispatch.lane` (active/terminal) and daemon lane records; a store wrapper that fails only `dispatch.lane` appends; the "lane exists before any attempt" probe. |
| `tests/fixtures/dispatch/parity/pm-notes.ts` | Real pm-notes documents on disk: `complete` (delivery phase with a non-null completion), `incomplete` (delivery phase null), `absent` (no file), `malformed` (unparseable), plus the **divergent-ledger** document used by `TC-DERIVE-004` (complete document + a phase ledger that has not progressed and is not complete). |
| `tests/fixtures/dispatch/parity/cases.ts` | **The one case registry: 29 rows — 11 `class` rows and 18 non-class rows.** `PARITY_CASES` enumerates every parity row with `{ id, group, declaredSeam, scenario: (h) => Promise<Observation>, expected }`. Group vocabulary and row counts: `class` **11**; `admission` **2** (same-ref race, other-ref lease); `resume` **4** (`pr-open` lane, no lane, unknown session, `resume-prompt-reentry` mode); `tracker-outage` **2** (with artifact, without artifact); `loop` **5** (below-bound restart, at-bound `max-restarts`, unverified stall, clean-exit terminal, persisted ≥ bound); `terminate` **3** (capable, incapable, exact-identity reap); `spawn` **2** (fresh, resume). Exports `runParityCase(entry)` and `runAllParityCases()`. Every suite consumes its registry entry's `scenario` builder; no suite re-expresses a scenario. `TC-PARITY-001` drives the `class` group, `TC-PARITY-003` and `TC-SHELL-001` drive `runAllParityCases()`. |
| `tests/fixtures/dispatch/parity/evidence.ts` | The 11-row **class** fixture table (class, fixture inputs, production seam, expected token, expected exit) that `cases.ts` composes for its `class` group, the 11-arm mutation hooks, the **permanent `PARITY_PROOF_BOUNDARY`** (8 proven ids and 6 not-proven ids, declared order — the only source for the boundary, asserted by `TC-PARITY-004`), and the canonicalizer (temp-root normalization + stable JSON) for `TC-PARITY-003`. |
| `tests/fixtures/dispatch/parity/seams.ts` | Import-identity manifest: each production seam symbol → its production module → the battery consumer, plus the reimplementation-signature registry consumed by `TC-PARITY-002`. |
| `scripts/checks/no-shell-dispatch.ts` | The static invariant: declared surface list, rule set, `scan(root)` returning violations `{rule,file,line}`, exit non-zero and name the offending rule/file. |
| `tests/checks/no-shell-dispatch.test.ts` | Live-tree cleanliness, surface-list existence (non-vacuity), one planted reference per rule through a temp workspace, false-positive controls. |
| `tests/checks/dispatch-contract-invariance.test.ts` | The pinned baseline fixture comparison of §5.2 `TC-CONTRACT-001`. |

**Extensions to existing files (not new files).**

- `tests/fixtures/dispatch/truth.ts`: `pmNotes` on the artifact builders (`complete`/`incomplete`/`absent`), `tracker({state:"done"})`, and the divergent-ledger input.
- `tests/fixtures/dispatch/harness.ts`: an optional `terminate` member plus a capability flag on the scripted port, so a port double can be terminate-capable or declare the gap; keep the existing behaviour the default.
- `tests/fixtures/dispatch/golden/harness.ts`: forward the injected `delay` and the lane seed options.
- `tests/conformance/dispatch/controlled-repo.ts`: accept the new class rows (tracker-done, artifact partial, divergent ledger) in its `drive` table without changing its `provenance()` guard or its "no ledger writer" surface.

### 6.2 Seams and mechanisms the fixtures must provide

- **Deterministic two-invocation interleaving.** One composed program (one store) drives two concurrent `runCli` invocations. The injected `delay(ms, reason)` is the latch: invocation A's claim parks at its first fence wait; the harness starts B, awaits B's claim, then releases A. A re-acquires the fence and re-decides from the live lease. Both orderings are run. Determinism comes from the explicit latch, not from scheduler luck.
- **Seeded dispatch lane.** `lane.ts` appends real `dispatch.lane` records to the real store; the resolver reads them through the production read path. Seeds cover: `terminal` + `pr-open` + session, `active` + session, terminal without a session (not resumable), a daemon lane in each of `delivering`/`detached`/`preempted`/`completed`, and both records present (newest wins).
- **Injected delay recorder.** One `delay(ms, reason)` composition fact with reasons `claim-fence`, `tracker-ladder`, `terminate-grace`; records `(reason, ms)` and advances the virtual clock. Production binds a real timer. Used by the fence wait, the ladder, and the grace, so all three are observable without wall-clock time.
- **Terminate doubles.** The capable double implements the API-5 contract over the process-tree model; the incapable double declares `harness.capability.gap` for `terminate` and exposes no member. Neither replaces the engine's terminate *decision*, and neither is used by `TC-TERM-001`'s signal ordering assertion without the real adapter's own terminate implementation being the one under test where it exists — the double is the streaming starter's process model, which is the designed injection point.
- **Divergent-ledger pm-notes.** A real pm-notes document with a completed delivery phase, paired with a phase ledger that has not progressed and is not complete, and `phasesComplete: false`, so the ledger-sourced `pm-notes` corroboration is `unsatisfied` while the artifact arm is `complete`.
- **Scripted transport with ladder scripts.** A request handler that answers `/issues` and `/pulls?` from a scripted attempt counter, so the ladder can be told to fail 0..5 times and then succeed; it counts requests so the ladder's read count is observable independently of the token.

## 7. Automation Plan and Implementation Mapping

### 7.1 Parity battery architecture and seam exercise

**Five production seams, one per seam family, each exercised through the function production uses.** Two further identifiers appear in the cases: `S-loop` (the in-process loop inside `runDispatch` — engine logic, exercised through the real engine rather than an injected seam) and `S-exec` (the guarded injected runner, the no-shell observation).

| Seam | Production identity | Exercised by | What is real |
|------|--------------------|--------------|---------------|
| `S-claim` | the dispatch claim seam mounted at `DispatchComposition.claimLease` (atomic live-lease verdict + bounded fence wait); exported as `claimDispatchLease` for the battery | `TC-ADMIT-001`…`004` | the fence, the live-lease re-read, the verdict, the real store |
| `S-lane` | the lane resolver mounted at `existingLane` (dispatch lane newest-with-session + daemon resumable states, newest wins); exported as `resolveDispatchLane` | `TC-RESUME-101`…`104`, `TC-LANE-005` | the real store records and the real resolver |
| `S-spawn` | the real path composition → `resolveHarnessAdmissionBinding` → adapter `bindingSeams.invocationArgs` → starter | `TC-SPAWN-001`…`004` | the resolver, the adapter's argv rendering, the recorded invocation |
| `S-ladder` | the production tracker read with the ladder and the injected delay | `TC-TRACKER-001`…`004` | the ladder, the truth read, the artifact read |
| `S-terminate` | the optional port member implemented by the opencode adapter over the injected streaming starter; the engine's terminate decision | `TC-TERM-001`…`006` | the adapter's terminate contract over the process-tree model, and the engine's decision |
| `S-derive` | `deriveDispatchResult` (one implementation, shared with the daemon path) | `TC-DERIVE-001`…`006`, `TC-PARITY-006` | the derivation itself |

The engine (`runDispatch`), the command definition, the CLI runtime, the projection, the attempt ledger, and the state store are always the production ones.

**One case registry (`tests/fixtures/dispatch/parity/cases.ts`): 29 rows, 11 `class` + 18 non-class.** Every parity case — the 11 classes plus the same-ref race, the other-ref lease, the four resume rows (incl. the `resume-prompt-reentry` mode), tracker-outage with and without a decisive artifact, the five loop rows, the three terminate rows, and the two spawn rows — is one entry with a `scenario` builder. The dedicated suites import their entry's builder instead of re-expressing the scenario, so a suite and the whole-battery driver cannot drift. `TC-PARITY-001` drives the `class` group; `TC-PARITY-003` and `TC-SHELL-001` call `runAllParityCases()`, which is what makes "the full battery" a declared, runnable thing rather than a list in a test body.

**Reimplementation detection (three independent mechanisms, all in `TC-PARITY-002`):**

1. **Import identity.** `seams.ts` declares each seam symbol and its production module; the battery must import that symbol from that module. A test-local copy has a different module and fails.
2. **Forbidden signature scan.** The check fails if any `tests/**` file contains a seam's decision signature outside the seam consumer: `dispatchAdmissionRefusal` and `claimQueueLease` in the same file (the pre-read+claim pair that is exactly the old non-atomic admission), a local retry loop with a timer, a local `kill`/`process.kill` sequence, or a local token ladder.
3. **Planted control.** A temp copy of a battery fixture with a local claim reimplementation must be rejected by name. This proves mechanisms 1–2 are not vacuous.

No case may satisfy itself with a fixture-written record: `controlled-repo.ts`'s provenance guard and "no ledger writer" surface stay intact, and the parity harness exposes no attempt/lane/divergence writer.

### 7.2 No-shell proof design

Two complementary observations. Their permanent contract is the fixture constant `PARITY_PROOF_BOUNDARY` and the invariant check named below; the change specification is design provenance only.

**(a) The injected process runner.** `guardedRunner({seam})` wraps every injected child seam (`harnessSpawnRunner`, `harnessSpawnStarter`, `gitChildRunner`, `githubCliRunner`). It records `{seam, file, args}` and fails the run by name when:
- the executable is a shell (`bash`, `sh`, `zsh`, `dash`, `cmd`, `powershell`), or
- an argument is a script path (ends `.sh`, starts `scripts/` or `tools/`, or contains `deliver-ticket`), or
- the options carry a shell-enabling member.

It also asserts, for every spawn, that the call site passed `shell:false` (the adapter's fixed argv contract). The battery records `shellInvocations === 0` and `scriptPathInvocations === 0` for every entry in `PARITY_CASES` (the registry, not a list in the test body, defines the sweep).

**Publication is not this case's job.** The same boundary is published on `doc/spec/features/feature-dispatch-engine.md` and reconciled there in lifecycle phase 7; a page/constant mismatch is a documentation-phase defect verified by the current-truth doc guard in the aggregate (`pnpm check` → `bun test tests/checks/doc-conformance.test.ts`), not by `TC-PARITY-004`. Neither the change specification nor this plan is a permanent source, and no permanent suite reads `doc/changes/**`.

**(b) The static invariant.** `scripts/checks/no-shell-dispatch.ts`, mutation-tested by `tests/checks/no-shell-dispatch.test.ts`. It lives beside the repository's other invariant checks and follows `forbidden-literals`' shape (declared surface + precise rules + non-vacuity controls).

- **Surface (declared, not inferred):** the dispatch flow = `packages/core/src/app/dispatch.ts`, `packages/core/src/app/dispatch-*.ts`, `packages/core/src/domain/dispatch-*.ts`, `packages/core/src/domain/harness-spawn-env.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/edge.ts`, `packages/cli/src/production.ts`, `packages/adapters/src/harness/opencode.ts`, `packages/adapters/src/host/index.ts`, `packages/adapters/src/daemon/lane-executor.ts`. Each listed file must exist and must be reachable from the dispatch entry, asserted by the check, so the list cannot silently shrink to nothing.
- **Rules:** `R1` **script-path literals, matched on whole string-literal values, not substrings**: a string literal whose value *ends* in `.sh`, or *is* a path whose first segment is `scripts/` or `tools/`, or *contains* `deliver-ticket`. `R2` no `shell: true`.
  - `R3` **no shell-capable child-process import or call, bound to the `child_process` receiver**: the surface may import only `spawn` from `node:child_process`; any import — or call — of `exec`, `execSync`, `execFile`, `execFileSync`, `spawnSync`, or `fork` fails, as does any call on a `child_process` namespace binding whose member is not `spawn(`. `R3` deliberately does **not** match `RegExp.prototype.exec` (`pattern.exec(text)`) or a port method named `spawn` (`ports.harness.spawn(...)`).
  - `R4` **the one permitted child-process call carries `shell: false`**: every `spawn(` that resolves to the `child_process` import — directly, or through its namespace binding (`cp.spawn(`) — carries a literal `shell: false` in the same call. A port `.spawn(` call is not a child-process call and is outside `R4`'s scope.
  - `R1`'s literal anchoring is what keeps `.sha` member accesses (`head.sha`, `facts.head.sha`) and `queue.shift()` from matching, and the receiver binding is what keeps `RegExp.prototype.exec` and port `.spawn(` calls from matching. An unanchored substring, a bare-regex, or a name-only matcher is a defect, and the controls below prove the difference.
- **Avoiding false positives on legitimate shell usage elsewhere:** the surface is an explicit file list, so the repository's real shell scripts (`scripts/**`, `tools/**`, `tests/**/*.test.ts`, `tmp/**`) are out of scope entirely and are never scanned. Within the surface, `shell: false` (which the host starter legitimately uses) is accepted by `R4`; documentation and comment references are excluded by matching code tokens only, and `.md` files are out of scope. A line allowlist exists but starts empty; any future entry needs a written justification in the check source, so it cannot be used to silence a real violation.
- **Non-vacuity controls:** (i) the surface-existence assertion; (ii) one planted reference per rule class in a temp workspace, each of which must be reported by rule name and `file:line` (including a planted `childProcess.spawn(cmd, args, { shell: true })` for `R4` and a planted `import { execSync } from "node:child_process"` for `R3`); (iii) the false-positive controls, each of which must report nothing: `shell: false` in the host starter; a `scripts/checks` reference outside the surface; a `scripts/` mention in a doc; the `.sha` member accesses in `packages/cli/src/edge.ts` (e.g. `facts.head.sha`, `head.sha`, `read.sha`); `queue.shift()` in `packages/adapters/src/host/index.ts`; the **five `RegExp.prototype.exec` calls** in `packages/cli/src/edge.ts` (today at lines 1139, 1350, 1945, 3415, 3420) for `R3`; and the **two port `.spawn(` calls** — `ports.harness.spawn(...)` in `packages/core/src/app/dispatch.ts` (today line 859) and `resolvedHarness.port.spawn(...)` in `packages/cli/src/production.ts` (today line 3401) — for `R4`. Where a named control file carries no such token today, the control plants one in the temp-workspace copy so it can never become vacuous. All controls are inside the declared surface where applicable, so a substring/regex/name-only implementation fails the suite rather than passing it.

### 7.3 File mapping (new vs extended)

| TC | Target file | Status |
|----|-------------|--------|
| `TC-LANE-001`…`005`, `TC-RESUME-101`…`104` | `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts` | To implement (new) |
| `TC-ADMIT-001`…`005` | `tests/conformance/dispatch/dispatch-parity-admission.test.ts` | To implement (new) |
| `TC-ADMIT-006` | `tests/behaviour/dispatch-single-flight.test.ts` | Existing – update (append atomic-claim cases) |
| `TC-TRACKER-001`…`003` | `tests/conformance/dispatch/dispatch-parity-tracker.test.ts` | To implement (new) |
| `TC-TRACKER-004` | `tests/behaviour/dispatch-truth-derivation.test.ts` (policy) + `tests/checks/dispatch-contract-invariance.test.ts` | Existing – update + new |
| `TC-TERM-001`, `TC-TERM-003`…`006`, `TC-LOOP-001`…`005` | `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts` | To implement (new) |
| `TC-TERM-002` | `tests/behaviour/dispatch-liveness.test.ts` (extend) | Existing – update |
| `TC-LOOP-006` | `tests/behaviour/dispatch-restart-budget.test.ts` | Existing – update (rewrite `TC-RESUME-002`) |
| `TC-SPAWN-001`…`003` | `tests/conformance/dispatch/dispatch-parity-spawn.test.ts` | To implement (new) |
| `TC-SPAWN-004` | same + `tests/structure/dispatch-help-inventory.test.ts` | Existing – update |
| `TC-DERIVE-001`…`003`, `005`, `006` | `tests/behaviour/dispatch-truth-derivation.test.ts`, `tests/behaviour/dispatch-token-closure.test.ts` | Existing – update |
| `TC-DERIVE-004` | `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts`, `tests/behaviour/dispatch-false-success.test.ts` | Existing – update |
| `TC-PARITY-001`…`006`, `TC-SHELL-001` (all parity suites) | `tests/fixtures/dispatch/parity/cases.ts` — the one whole-battery registry every parity suite imports its `scenario` from | To implement (new) |
| `TC-PARITY-001`…`005` | `tests/conformance/dispatch/dispatch-parity-battery.test.ts` | To implement (new) |
| `TC-PARITY-006` | `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` | Existing – update |
| `TC-PARITY-005` (bounds/redaction half) | `tests/behaviour/dispatch-privacy.test.ts`, `tests/behaviour/dispatch-attempts-bounds.test.ts` | Existing – update |
| `TC-SHELL-001` | `tests/conformance/dispatch/dispatch-parity-no-shell.test.ts` | To implement (new) |
| `TC-SHELL-002` | `tests/checks/no-shell-dispatch.test.ts` (+ `scripts/checks/no-shell-dispatch.ts`) | To implement (new) |
| `TC-CONTRACT-001` | `tests/checks/dispatch-contract-invariance.test.ts` (+ extensions to `dispatch-additive-stability.test.ts`, `error-table-sync.test.ts`, `dispatch-exit-projection.test.ts`, `dispatch-token-home.test.ts`) | To implement (new) + existing – update |

Split: **9 new test suites** (`dispatch-parity-{lane-resume,admission,tracker,stall-loop,spawn,battery,no-shell}.test.ts` = 7 + `tests/checks/no-shell-dispatch.test.ts` + `tests/checks/dispatch-contract-invariance.test.ts`), **1 new check module** (`scripts/checks/no-shell-dispatch.ts`), **9 new fixture modules** under `tests/fixtures/dispatch/parity/` (including the `cases.ts` whole-battery registry), and **15 extended suites** (`dispatch-single-flight`, `dispatch-liveness`, `dispatch-restart-budget`, `dispatch-truth-derivation`, `dispatch-token-closure`, `dispatch-delivered-evidence-divergence`, `dispatch-false-success`, `dispatch-daemon-lane`, `dispatch-privacy`, `dispatch-attempts-bounds`, `dispatch-help-inventory`, `dispatch-additive-stability`, `error-table-sync`, `dispatch-exit-projection`, `dispatch-token-home`) plus **4 extended fixtures** (`truth.ts`, `harness.ts`, `golden/harness.ts`, `controlled-repo.ts`). Case-level split: **36 new cases, 13 extended cases, 1 new-and-extended** (`TC-SPAWN-004`) = 50. Everything shares the delivered fixtures rather than duplicating them; there is one parity fixture family under `tests/fixtures/dispatch/parity/`.

### 7.4 Mutation register

Each row is a source mutation applied to the implementation; the named case must fail, with the expected failure-message family. `M` rows are the non-vacuity proof for the load-bearing invariants. The register is executed by the reviewer/fixer, not committed as a permanent suite (a permanent mutation harness belongs to review tooling; the permanent suite is the case list itself).

**Per parity arm (11 arms; spec Appendix F, §25.6).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M1 | Delete arm 1 (spawn refusal) | `TC-PARITY-001` | `expected noop-lane-permission at exit 1, received <token> at exit <n>` |
| M2 | Delete arm 2 (tracker-done `merged`) | `TC-PARITY-001`, `TC-DERIVE-001` | `expected merged, received <token>` |
| M3 | Delete arm 3 (blocking `blocked`) | `TC-PARITY-001` | `expected blocked at exit 0, received <token>` |
| M4 | Delete arm 4 (open PR) | `TC-PARITY-001` | `expected pr-open at exit 0, received <token>` |
| M5 | Delete the URL-resolution branch (empty URL → `pr-open`) | `TC-PARITY-001` | `expected pr-open-unverified at exit 0, received pr-open` |
| M6 | Delete arm 5 (already-merged PR) | `TC-PARITY-001` | `expected merged, received <token>` |
| M7 | Delete arm 6 (commits + complete pm-notes) | `TC-PARITY-001` | `expected finished, received <token>` |
| M8 | Delete arm 7 (commits + incomplete pm-notes) | `TC-PARITY-001`, `TC-DERIVE-003` | `expected partial at exit 1, received finished` |
| M9 | Delete arm 8 (nothing-to-do) | `TC-PARITY-001`, `TC-DERIVE-005` | `expected noop-lane-nothing-to-do, received <token>` |
| M10 | Delete arm 9 (classifier token) | `TC-PARITY-001` | `expected failed at exit 1, received <token>` |
| M11 | Make an undecidable truth resolve a success arm | `TC-PARITY-001`, `TC-TRACKER-002` | `expected state-unverified at exit 2, received <success token>` |

**Admission refusal paths (10).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M12 | Decide the verdict from a pre-claim read (delete the in-fence re-decision) | `TC-ADMIT-001` | `expected {ok:false, code:"queue.single-flight"}; received {ok:true}` / `expected 1 lease record, received 2` |
| M13 | Let the dispatch claim renew a live same-ref lease | `TC-ADMIT-001`, `TC-ADMIT-006` | `expected queue.single-flight naming holder, received ok:true` |
| M14 | Relabel `state.lock.busy` as `queue` kind | `TC-ADMIT-004` | `expected kind state, received queue` |
| M15 | Surface fence contention as an immediate verdict | `TC-ADMIT-003` | `expected 1 admitted, received 2 refusals` |
| M16 | Remove the fence-wait bound (wait forever / ignore the TTL) | `TC-ADMIT-004` | `expected cumulative wait <= 90000, received <n>` |
| M17 | Append an attempt record on a refusal | `TC-ADMIT-001`, `TC-ADMIT-005` | `expected 0 attempts, received 1` |
| M18 | Map an other-ref live lease to `queue.single-flight` | `TC-ADMIT-002` | `expected queue.lease-conflict, received queue.single-flight` |
| M19 | Exit 0 (or throw) on a refusal | `TC-ADMIT-005` | `expected exit <mapped>, received 0` |
| M20 | Emit `fallback.internal` for an admission outcome | `TC-ADMIT-001`…`003` | `envelope error must not be fallback.internal` |
| M21 | Narrow or change the sibling `queue claim` renewal | `TC-ADMIT-006` | `expected renewal {ok:true}, received queue.lease-conflict` |

**Resume rules (6).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M22 | Keep the daemon-only lane filter | `TC-RESUME-101` | `expected resume call, received 0; spawn calls expected 0, received 1` |
| M23 | Consume a restart ordinal for an operator resume | `TC-RESUME-102` | `restarts expected <persisted>, received <persisted+1>` |
| M24 | Refuse an operator resume on the restart budget | `TC-RESUME-102` | `expected admitted, received dispatch.restart-budget-exceeded` |
| M25 | Fall back to a fresh spawn when the session is unknown | `TC-RESUME-104` | `spawn calls expected 0, received 1` / `expected failed, received <success>` |
| M26 | Fabricate a lane (or refuse) when no lane exists | `TC-RESUME-103` | `expected 1 spawn with the supplied prompt, received 0` |
| M27 | Charge an ordinal on `resume-prompt-reentry` (honour the descriptive `consumesRestartOrdinal`) | `TC-RESUME-102` | `economics.restart records expected 0, received 1` / `restarts expected 3 (persisted total), received 4` |

**Ladder bounds (7).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M28 | 4 attempts instead of 5 | `TC-TRACKER-001`, `TC-TRACKER-002` | `attempts expected 5, received 4` |
| M29 | Flat waits (2000 each) | `TC-TRACKER-001` | `waits expected [2000,4000,8000,16000], received [2000,2000,2000,2000]` |
| M30 | Cap ignored at n >= 5 | `TC-TRACKER-004` | `ladderWait(5) expected 30000, received 32000` |
| M31 | Exhaustion yields a readable stale tracker fact | `TC-TRACKER-002` | `expected state-unverified, received <success token>` |
| M32 | Return `state-unverified` before evaluating artifacts | `TC-TRACKER-003` | `expected pr-open, received state-unverified` |
| M33 | Drop the exhaustion evidence reference | `TC-TRACKER-002`, `TC-TRACKER-003` | `expected evidenceRefs to contain tracker:exhausted` |
| M34 | Resolve an ambient delay (real timer) instead of the injected one | `TC-TRACKER-004` | `tracker ladder resolves an ambient delay: <symbol>` |

**Terminate safety (10).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M35 | Send KILL before TERM | `TC-TERM-001` | `signal order expected [SIGTERM,SIGKILL], received [SIGKILL,...]` |
| M36 | Escalate before the grace elapses | `TC-TERM-001` | `SIGKILL recorded at +<n>ms; expected >= 20000` |
| M37 | Never invoke terminate on a corroborated stall | `TC-TERM-001` | `terminate calls expected 1, received 0` |
| M38 | Terminate on a clean exit | `TC-TERM-002` | `terminate calls expected 0, received 1` |
| M39 | Terminate a stall cleared by later progress | `TC-TERM-002` | `terminate calls expected 0 after later progress, received 1` |
| M40 | Short-circuit a stall on any decisive artifact | `TC-TERM-004` | `expected restart below the bound, received <artifact token>` |
| M41 | Skip the short-circuit for a set member | `TC-TERM-003` | `expected pr-open, received a restart` |
| M42 | Start a second session on a terminate-incapable adapter | `TC-TERM-005` | `session acquisitions expected 1, received 2` |
| M43 | Reap by broad process-name pattern | `TC-TERM-006` | `unrelated pid <unrelated> expected no signal, received SIGTERM` |
| M44 | Make terminate non-idempotent (error on the second call) | `TC-TERM-006` | `second terminate expected {terminated:true}, received error` |

**Loop decisions (9).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M45 | Restart a clean exit | `TC-LOOP-004` | `iterations expected 1, received 2` |
| M46 | Remove the in-process loop (one iteration always) | `TC-LOOP-001` | `iterations expected 2, received 1` |
| M47 | Consume two ordinals per restart | `TC-LOOP-001`, `TC-LOOP-005` | `economics.restart records expected 1, received 2` |
| M48 | Append an attempt record for a restarted iteration | `TC-LOOP-001`, `TC-LOOP-005` | `attempts expected 1, received 2` |
| M49 | Off-by-one bound (restart at the bound) | `TC-LOOP-002` | `expected max-restarts at count 3 of 3, received a 4th iteration` |
| M50 | Consume a slot for an unverified stall | `TC-LOOP-003` | `restarts expected 0, received 1` |
| M51 | Refuse admission when the persisted count >= bound | `TC-LOOP-006` | `expected one iteration, received a pre-session refusal` |
| M52 | Read the loop bound from `coordinator.restart-budget` (10) instead of `lane.restart-budget` (3) | `TC-LOOP-002`, `TC-LOOP-005` | `max-restarts expected at count 3 (iteration 4), received count 10 (iteration 11)` |
| M53 | Report only this invocation's consumed ordinals instead of the persisted total | `TC-RESUME-102`, `TC-LOOP-005` | `restarts expected 3 (persisted total, 0 consumed), received 0` |

**Spawn facts (7).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M54 | Drop `--agent pm` | `TC-SPAWN-001` | `args expected exactly one "--agent pm"` |
| M55 | Drop `--model`, or render two | `TC-SPAWN-001` | `expected exactly one --model <seat>, received <0|2>` |
| M56 | Omit the title, or make it non-deterministic | `TC-SPAWN-002` | `expected --title ticket-GH-347` |
| M57 | Carry a title on a resume | `TC-SPAWN-002` | `resume args must not contain --title` |
| M58 | Restore the constant prompt | `TC-SPAWN-003` | `prompt expected the ref, the base branch, and the lifecycle section <id>` |
| M59 | Record a binding for a role-less composition | `TC-SPAWN-004` | `binding expected absent, received {...}` |
| M60 | Expose the agent/title as a CLI flag | `TC-SPAWN-004`, `TC-CONTRACT-001` | `unknown option --agent must be rejected; received exit 0` |

**Derivation arms and boundaries (15).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M61 | Check blocking before tracker-done | `TC-DERIVE-002` | `expected merged, received blocked` |
| M62 | Require a visible PR for the tracker-done arm | `TC-DERIVE-001` | `expected merged, received <token>` |
| M63 | Let incomplete pm-notes fall through to the classifier | `TC-DERIVE-003` | `expected partial, received finished` |
| M64 | Invert the completeness arm (`complete` → `partial`) | `TC-DERIVE-003` | `expected finished, received partial` |
| M65 | Treat a malformed pm-notes document as complete | `TC-DERIVE-003` | `malformed pm-notes must read incomplete; received finished` |
| M66 | Keep the phase-ledger no-work arm as a token gate | `TC-DERIVE-005` | `complete ledger with commits expected finished|partial, received noop-lane-nothing-to-do` |
| M67 | Take nothing-to-do with an unreadable tracker | `TC-DERIVE-005` | `expected state-unverified, received noop-lane-nothing-to-do` |
| M68 | Project `partial` to exit 2 | `TC-DERIVE-006` | `partial exit expected 1, received 2` |
| M69 | Project `state-unverified` to exit 1 | `TC-DERIVE-006` | `state-unverified exit expected 2, received 1` |
| M70 | Let two arms claim one input | `TC-DERIVE-006` | `arm disjointness violated for input <id>` |
| M71 | Force `falseSuccess` to false on the divergent-ledger `finished` | `TC-DERIVE-004` | `falseSuccess expected true, received false` |
| M72 | Route a divergent-ledger `finished` through the `su`-gated delivered-evidence divergence (drop the `token === su` gate) | `TC-DERIVE-004` | `expected 0 delivered-evidence divergences for a finished token, received 1` |
| M73 | Suppress the `verify-change` record for a non-complete verify outcome, or change its shape | `TC-DERIVE-004` | `expected 1 verify-change divergence (engineToken finished), received 0` / `divergence outside the delivered shape: <field>` |
| M74 | Restore the early `state-unverified` return before the tracker arms (the delivered `read`-loop over ledger/tracker/artifact) | `TC-DERIVE-001`, `TC-DERIVE-002`, `TC-DERIVE-006` | `expected merged, received state-unverified (unreadable artifact read)` / `expected blocked, received state-unverified` |
| M75 | Leave `pmNotes: "unsatisfied"` on the nothing-to-do arm (keep the token-keyed `["pm-notes"]` sufficiency instead of the tracker-only arm) | `TC-DERIVE-005` | `corroboration.pmNotes expected "not-applicable", received "unsatisfied"` / `falseSuccess expected false, received true` |

**No-shell and parity machinery (7).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M76 | Invoke a shell with a script path in a parity case | `TC-SHELL-001` | `shell invocation recorded: bash scripts/deliver-ticket.sh` |
| M77 | Spawn with `shell: true` | `TC-SHELL-001` | `spawn option shell expected false, received true` |
| M78 | Plant a `.sh` literal in a dispatch-flow file | `TC-SHELL-002` | `no-shell invariant: script-path literal at <file>:<line>` |
| M79 | Reimplement the claim/ladder/terminate in a battery file | `TC-PARITY-002` | `reimplementation of <seam> in <file>` |
| M80 | Introduce nondeterminism (ambient clock/random) | `TC-PARITY-003` | `run 1 and run 2 differ: <field>` |
| M81 | Perform a live network call or start a real process | `TC-PARITY-003` | `live transport request observed: <url>` / `real process started: <file>` |
| M82 | Append a 17th evidence ref or a forbidden lane field | `TC-PARITY-005` | `evidenceRefs expected <= 16, received 17` / `lane record carries forbidden key <k>` |

**Lane record and proof boundary (5).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M83 | Write the lane only at classification (drop the acquisition-time append) | `TC-LANE-001`, `TC-LANE-003` | `expected 1 active lane record at acquisition, received a terminal-only record` |
| M84 | Append two active records per session acquisition | `TC-LANE-001`, `TC-LANE-003`, `TC-PARITY-005` | `expected 1 active record per acquisition, received 2` |
| M85 | Append a terminal record for a restarted stalled iteration | `TC-LANE-003` | `expected no terminal record between the two active records, received terminal at position 2` |
| M86 | Append a lane record on a pre-session refusal | `TC-LANE-002` | `expected 0 lane records for a pre-session refusal, received 1` |
| M87 | Add, drop, or reorder an id in `PARITY_PROOF_BOUNDARY` (or declare a not-proven surface in a parity row) | `TC-PARITY-004` | `proof boundary drift: <control>` / `parity row <id> declares a not-proven seam <seam>` |

**Shared derivation and closed contract (3).**

| # | Mutation | Must fail | Expected failure family |
|---|----------|-----------|-------------------------|
| M88 | Fork the daemon path to the old order | `TC-PARITY-006` | `daemon token expected merged, received blocked` |
| M89 | Keep the ledger no-work arm on the daemon path | `TC-PARITY-006` | `daemon token expected finished, received noop-lane-nothing-to-do` |
| M90 | Add a token, projection, error row, domain kind, config key, or schema version | `TC-CONTRACT-001` | `closed surface changed: <surface> +<added>` |

Total: **90 mutations**, M1–M90 contiguous (11 parity arms + 10 admission + 6 resume + 7 ladder + 10 terminate + 9 loop + 7 spawn + 15 derivation + 7 no-shell/machinery + 5 lane/boundary + 3 shared-derivation/contract); every load-bearing invariant named in `§1` has at least one row, and every row names the case that must fail.

### 7.5 Gate battery

Every command runs from the repository root with both environment prerequisites, because the lifecycle primitives (and the `commit` primitive in particular) probe the bare `commitlint` name and must not write outside the approved temp root:

```bash
mkdir -p tmp/tmpdir
export TMPDIR=$PWD/tmp/tmpdir
export PATH=$PWD/node_modules/.bin:$PATH
```

**Gates this test plan requires (run during delivery, after the relevant phase):**

```bash
# 1. The parity battery (new + extended conformance cases)
bun test tests/conformance/dispatch

# 2. The targeted behaviour and structure extensions
bun test tests/behaviour/dispatch-truth-derivation.test.ts \
         tests/behaviour/dispatch-single-flight.test.ts \
         tests/behaviour/dispatch-resume.test.ts \
         tests/behaviour/dispatch-restart-budget.test.ts \
         tests/behaviour/dispatch-liveness.test.ts \
         tests/behaviour/dispatch-delivered-evidence-divergence.test.ts \
         tests/behaviour/dispatch-false-success.test.ts \
         tests/behaviour/dispatch-privacy.test.ts \
         tests/behaviour/dispatch-attempts-bounds.test.ts \
         tests/behaviour/dispatch-exit-projection.test.ts \
         tests/behaviour/dispatch-token-closure.test.ts \
         tests/structure/dispatch-help-inventory.test.ts

# 3. The static invariant, directly (must exit non-zero and name the rule on a violation)
bun run scripts/checks/no-shell-dispatch.ts

# 4. The invariant and contract suites
bun test tests/checks/no-shell-dispatch.test.ts tests/checks/dispatch-contract-invariance.test.ts

# 5. Hygiene before every commit
git diff --check
```

The determinism gate needs no separate command: `TC-PARITY-003` runs the class battery twice inside the suite and compares canonical output, and `TC-SHELL-001`/`TC-PARITY-003` assert the zero-live-call counters. Re-running step 1 is the manual cross-run check.

**Gates owned by the lifecycle quality phase (phase 9), not by this plan's delivery-time battery:**

```bash
# The aggregate: lint → format:check → typecheck → test → check:boundaries → check:memory → prompt/help/exports
TMPDIR=$PWD/tmp/tmpdir PATH=$PWD/node_modules/.bin:$PATH pnpm check

# The branch-range commit-message gate (needs the branch's own commit range, so it only exists at PR time)
./scripts/lint-commit-range.sh --base origin/main-tools
```

Rationale for the split: `pnpm check` also builds, typechecks, and runs every unrelated suite, so it is the phase-9 aggregate rather than a per-phase loop; the range gate asserts the change branch's own commit messages against `origin/main-tools`, which is a delivery-lifecycle property, not a test-plan property. Both are recorded in the pm-notes; a `FAIL` is remediated in the mode the gate names and an unresolved `ERROR` is never recorded as a pass. The documentation-phase gates (`bun test tests/checks/doc-conformance.test.ts`, the stale "no kill operation" scan, `bash scripts/.tests/test-doc-distribution.sh` when a redistributable doc changes) belong to the system-spec-update phase (`DOD-6`).

### 7.6 Non-functional verification

**Offline determinism (`NFR-1`, `AC-F9-3`, `DOD-4`).** Two runs of the full battery in isolated roots with a fixed clock, a fixed id sequence, a fixed class order, and canonicalization that normalizes only the temp root. Assertions: canonical envelope JSON byte-identical; per-class attempt counts identical; class coverage identical (11/11 both runs); `liveNetworkRequests === 0`; `realChildStarts === 0`; `shellInvocations === 0`; the injected transport saw every request (so a native-`fetch` fallback would have been counted as live). No wall-clock assertion is used anywhere; the only time source is the injected delay recorder, so the suite cannot become flaky under load.

**Record bounds and redaction (`NFR-7`, `DOD-5`).** Assertions: the lane record's key set equals the DM-1 field list exactly; `owner` has exactly `{processId, startedAt}`; one session identity per record; no key or value carries a prompt, transcript, diff, credential, or provider payload (canary scan across prompt, resume prompt, harness stdout, credential, and a synthetic provider payload); every evidence ref and diagnostic is single-line and identifier-only; `lastMessage` is within `DISPATCH_MAX_LAST_MESSAGE_CHARS`.

**The 16-reference evidence bound (exact assertions).** `DISPATCH_MAX_EVIDENCE_REFS === 16`; every attempt and divergence in the battery has `evidenceRefs.length <= 16`; a dispatch engineered to hit all five evidence sources (attempt id, `lane:append-failed`, `tracker:exhausted`, the liveness verdict trail, the termination result, and a divergence reference) stays at or below 16; and the truncation is deterministic — feeding the `maximalEvidenceRefs()` fixture plus six extra candidate refs retains exactly the first 16 in the declared order, and two identical runs produce the identical retained set.

**Concurrency (`NFR-8`).** Exactly one admitted + one `queue.single-flight` naming the holder, in both interleaving directions; 0 `fallback.internal`; 0 double-claim; 0 lost request; every recorded fence wait `<= queue.lease-ttl`.

**Termination (`NFR-6`).** TERM before KILL; KILL `>= 20000` ms after TERM in virtual time; total termination bounded; the second call is a success with no extra signal; zero signals to unrelated pids.

**Cardinality (`NFR-4`).** 0 attempts + 0 lanes for every pre-session refusal; exactly one attempt per classified dispatch regardless of iteration count; 0 attempts for a restarted iteration; 1 active lane per session acquisition; 1 terminal lane per classification; no dispatch with 2 attempts; 0 attempts written by a resume replay.

**Configuration and vocabulary invariance (`NFR-3`, `NFR-11`).** The pinned baseline comparison in `TC-CONTRACT-001`: 0 new/changed tokens, projections, exits, error rows, domain kinds, or schema versions; 0 new configuration keys; the four consumed defaults unchanged.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation in this plan |
|------|--------|--------------------------|
| The battery proves fixtures, not behaviour (`RSK-7`) | H | Every case names the production seam it exercises; `TC-PARITY-002` rejects reimplementations; `TC-PARITY-004` checks the permanent `PARITY_PROOF_BOUNDARY` constant for shape, order and registry consistency, and the current-truth page carries the same boundary (reconciled in phase 7, guarded by the doc check). |
| A test becomes the second implementation | H | `TC-PARITY-002` import identity + forbidden-signature scan + planted control; D2 is limited to port boundaries and never re-expresses engine logic. |
| Timing flakiness | M | No wall-clock assertion; the injected delay recorder and virtual clock are the only time source; the two-invocation interleaving is a latch, not a sleep. |
| The interleaving is too weak (both invocations effectively serialized) | H | The loser's fence acquisition is *parked before* its verdict and released after the winner's lease is durable, so a pre-read-only implementation double-claims and fails `TC-ADMIT-001`; both orders run. |
| The static invariant is vacuous or over-broad | M | Declared surface with an existence/reachability assertion; per-rule planted references; explicit false-positive controls; an empty allowlist. |
| A deliberate behaviour change is "fixed" by editing the test to match the old expectation | H | `TC-LOOP-006` explicitly supersedes `TC-RESUME-002`; the review checklist requires any changed delivered assertion to cite the spec clause (`§8.5`, `DEC-5`, R5) that authorises it. |
| The daemon inheritance is missed because it is not a parity row | H | `TC-PARITY-006` is a mandatory case, carried from the spec's shared-derivation ruling; the implementation plan must declare it. |
| The R7 boundary is silently "improved" (re-pointing `pm-notes`) | M | `TC-DERIVE-004` pins `corroboration.pmNotes === "unsatisfied"`, `falseSuccess === true`, and the delivered divergence shape; re-pointing would be a different decision (§7.3 deferral). |
| The 16-ref bound truncates a load-bearing identifier | M | The truncation is asserted deterministic and the retained set is compared across runs; the newest load-bearing refs are asserted present for the cases that produce them. |

### 8.2 Assumptions

1. The six seam exports the battery needs (`claimDispatchLease`, `resolveDispatchLane`, the tracker ladder read, the terminate port member, `deriveDispatchResult`, `runDispatch`) exist or are created in this change; `deriveDispatchResult` and `runDispatch` already are. This is the testability consequence of `AC-F9-2` ("exercises the real production seam"), not a new requirement.
2. The composition accepts three additive, non-operator injection facts for offline determinism: `delay(ms, reason)` (used by the fence wait, the tracker ladder, and the terminate grace), and the existing `harnessSpawnStarter`/`harnessSpawnRunner`/`gitChildRunner`/`githubTransport`/`credentials`/`processId` facts. Lane, product, and pm-notes fixtures are seeded through the real store and the real files, never injected into the composition. This mirrors the delivered `waitForCadence`/`harnessSpawnStarter` pattern and adds no configuration key (`NFR-11`).
3. The production composition supplies `pm`, the title, and the lifecycle prompt as composition facts (`DM-6`); a role-less composition stays role-less, so `TC-SPAWN-004` can drive both.
4. `DISPATCH_MAX_EVIDENCE_REFS` stays 16 and the lane key set is exactly the `DM-1` list; both are asserted as data, not assumed.
5. The class driver in `dispatch-e2e.test.ts` is the right home for the 11-row parity table (extended, not duplicated): its `provenance()` guard and its no-ledger-writer surface are preserved.
6. The daemon-path observation runs through the delivered lane harness (`createLaneExecutor`, `runSupervisionCycle`, `recordDaemonDispatchResult`), so it does not need a new daemon fixture.
7. `state-unverified` stays exit 2 and `partial` stays exit 1; any assertion to the contrary is a defect in the test, not a behaviour change (`NG-8`).
8. The change folder's `tmp/` is git-ignored; no fixture writes outside `tmp/tmpdir`.

### 8.3 Open Questions

None blocking. Two implementation-decided details are delegated to `delivery_planning` and are already bounded by the spec (Appendix D): the exact identity of the lane store/read ports and the exact truncation order within the 16-ref bound. Neither changes a case's assertion; both are asserted only for determinism and determinism-derived bounds.

The one gap this plan cannot close alone: the seam exports in assumption 1 are production-code changes that the implementation plan must carry in an early phase, otherwise the admission, lane, ladder, and terminate cases have no honest seam to drive. If the implementation plan drops them, this test plan's `AC-F9-2` coverage becomes unachievable and must be reopened at the readiness gate rather than downgraded to a test-local reimplementation.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-19 | @test-plan-writer | Initial test plan for GH-347 against spec v1.3: 50 cases in 11 groups, 42/42 AC traceability (0 unmapped, 0 orphan), the parity battery design with five production seams, the no-shell proof with its static invariant and non-vacuity control, the 82-row mutation register, the fixture inventory (authored vs extended), the gate battery with the `TMPDIR`/`PATH` conventions, the non-functional verification, and the Appendix C not-proven list. |
| 0.2 | 2026-11-19 | @test-plan-writer | DoR-iteration-1 remediation (findings 1, 5, 6, 8, 9, 10, 13, 14, 15, 18). Corrected the two wrong exit literals (`blocked` 0, `max-restarts` 1), swept §5.2 against the delivered matrix, and added the exit-literal rule (`TC-CONTRACT-001` pins the matrix). Added the three read-precedence observations and mutation `M73`. Declared the whole-battery registry `tests/fixtures/dispatch/parity/cases.ts` and pointed `TC-PARITY-003`/`TC-SHELL-001` at it. Anchored no-shell rule `R1` on whole string literals and added the `head.sha`/`queue.shift()` false-positive controls. Added five lane/proof-boundary mutations (`M81`…`M85`), fixed the derivation heading and `M51`/`M52`. Restated `TC-DERIVE-006` as 30 inputs / 10 projected tokens, `TC-LOOP-002` as 4 iterations, `restarts` as the persisted total, and the `AC-F8-3` (+2) arithmetic. Case count unchanged at 50; mutations 82 → 88. |
| 0.3 | 2026-11-19 | @test-plan-writer | Finding-12 test half. `TC-PARITY-004` now reads only the permanent fixture constant `PARITY_PROOF_BOUNDARY`: eight proven ids and six not-proven ids in the declared order, every registry row's seam proven, no row on a not-proven surface, and planted add/drop/reorder/live-seam controls that fail by name. Removed the plan and spec reads from the case (seam line, preconditions, steps, outcome) and added a source scan forbidding `doc/changes/` references in the suite. §1.2 and §7.2 now state the permanent source, the phase-7 publication on `doc/spec/features/feature-dispatch-engine.md`, and the doc guard in the aggregate that owns page/constant agreement. Driver note and `M85` aligned. Counts unchanged: 50 cases, 42/42 ACs, 53 links, 88 mutations. |
| 0.4 | 2026-11-19 | @test-plan-writer | DoR-iteration-2 remediation (findings 3, 4, 5, 6, 9 assertion half, 10, 11). `TC-DERIVE-006` restricted to the 21 derivation-reachable inputs (4 attempt-stage + 10 ladder + 4 collision + 3 read-precedence), with Appendix F(A) A1–A9 declared "no token / typed pre-session refusal" and handed to `TC-ADMIT-*`/`TC-LANE-002`/`TC-PARITY-001`. `TC-RESUME-102` now pins both resume modes (`attach-continue` and `resume-prompt-reentry`) and mutation M27 charges an ordinal on prompt-reentry. §7.2 `R3`/`R4` rebound to the `child_process` receiver, the `.sha`/`RegExp.exec`/port-`.spawn` false-positive controls added, and the surface entry corrected to `packages/adapters/src/host/index.ts`. `TC-PARITY-006` asserts daemon attempt corroboration/false-success; `TC-DERIVE-005` row (a) asserts the arm-aware tracker-only corroboration with mutation M75. §2 cites spec v1.6; the arm citation is now §25.6. Registry counts stated (29 rows: 11 class + 18 non-class). Register renumbered to 90 contiguous rows; historical rows 0.2/0.3 cite the numbering in force at their version, and this row supersedes those ids: `M60`→`M61`, `M51`→`M52`, `M52`→`M53`, `M73`→`M74`, `M81`–`M85`→`M83`–`M87`. Cases unchanged at 50. |
| 0.5 | 2026-11-19 | @test-plan-writer | Corrected `TC-DERIVE-006`'s input count from 21 to **25**, caused by the delivered case in commit **9742e6a** (review remediation, plan phase 9), which added C11–C14 (failed+open PR → `pr-open`; failed+commits+complete pm-notes → `finished`; premature end+open PR → `pr-open`; tool failure+commits+complete pm-notes → `finished`) and rebuilt C10 as a non-clean end with no decisive artifact so arm 9 is genuinely exercised. Preconditions, step 1 and the expected outcome now state 25; step 2 records that per-input disjointness is asserted against the derivation's returned declared `armId` (14-id closed set), which is what exposes a mislabelled row. No case, AC link or register row changed: 50 cases, 42/42 ACs (53 links), 90 mutations (M1–M90) as at 0.4. The plan's phase 9 re-armed 31 existing mutation rows from the 0.4 numbering; its allocation stays 90 rows, so this register is unchanged and the 0.4 id mapping (`M60`→`M61` etc.) remains the mapping in force. 0.4 recorded 21 inputs; this row supersedes that number only. |

## 10. Test Execution Log

Populated during delivery. One row per case group; the battery is run whole before each phase boundary.

| TC ID(s) | Run Date | Result | Notes |
|----------|----------|--------|-------|
| — | — | Not run | Awaiting delivery |
