---
id: chg-GH-377-test-plan
status: Updated
version: 1.3
created: 2026-11-22
last_updated: 2026-11-22
owners: ["Juliusz Ćwiąkalski"]
service: "provider profile selection and spawn admission (CLI resolver composition)"
labels: [provider, profiles, parks, eligibility, spawn, defect, m4]
version_impact: none
summary: "Pin the GH-377 correction as comparisons a test runs: recorded provider parks and recorded watch freshness become profile-eligibility inputs at the resolver/composition seam; staleness is evaluated per declared watch target under spec §8.6; a seat whose effective model — declared, rung-derived or override-targeted — pins a recorded-unavailable provider is substituted from the next valid, capability-adequate profile found by a substitution search over later candidates, or refused `provider.profile.unavailable` as the delivered `data` envelope at exit 2 naming seat and provider with the eligibility list carried unchanged and no profile event; the selection pass does not probe later profiles, and candidate verdicts are never written into the list; a seat on an undeclared, disabled or peak-parked provider keeps delivered behaviour (AC-F3-3); the `--for-spawn` env record and the spawn binding agree per seat; recovery is a pure read-time function of the clock; the eight-cause taxonomy is pinned with an explicit subject per cause; `provider resolve` is proven untouched — with zero vocabulary growth, zero policy edit and zero live fetch."
links:
  change_spec: ./chg-GH-377-spec.md
  implementation_plan: ./chg-GH-377-plan.yaml   # phase-4 artifact; not present when this plan was written
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S18: Provider profile selection must consume recorded parks

## 1. Scope and Objectives

The defect is a disagreement, not a missing command: `provider parks list` reports a provider parked while `provider profile resolve --for-spawn` emits a model on that provider at the same instant. This plan therefore proves the correction as a set of comparisons that fail by name — the profile verdict against the park fold, the seat verdict against the same fold, the emitted record against the binding, and the tolerated vocabulary against the delivered sets. It also protects the two properties a naive fix would trade away: the read-only, ref-free contract (no fetch, no credential read, no timer, no park write) and the unchanged behaviour of the mutating chain resolver.

The highest-risk failure modes are silent, so each gets an adversarial arm rather than a prose claim: a park-fold failure read as *clear* (`TC-PROFILE-088`), an over-broad attribution that blocks a healthy provider through a chain-level cause (`TC-PROFILE-081`), a seat routed past the profile's provider list through a plain declared seat model, a rung or an override (`TC-PROFILE-066`, `TC-PROFILE-067`), an env record that names a parked provider (`TC-PROFILE-072`), a substitution that silently buys availability by dropping a required capability (`TC-PROFILE-069`), and a taxonomy that "pins" eight causes without classifying any of them (`TC-PROFILE-080`, `TC-PROFILE-083`).

This is a verification map, not an execution claim: nothing here was run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-377-plan.yaml`, authored in phase 4 after this plan. All 12 acceptance criteria — including the AC-F3-3 boundary that proves the seat gate was not widened — are covered by at least one named case; there are no TODO rows, no orphan cases and no open questions. The plan is deliberately proportionate: it extends the delivered provider-profile, parks, chain-resolution, structure, checks and golden suites, adds one data-only classification fixture, and invents no framework and no new suite family.

This revision answers DoR iteration 1 on the test plan: the capability-inadequate-substitute arm now yields the refused `provider.profile.unavailable` (not `capability-denied`), the refusal's evidence position is pinned (eligibility list unchanged, bounded `summary` naming seat and provider), the watch-observation seam is pinned exactly to spec §8.6 with its three excluded readings tested as failing arms, the seat gate is bounded to recorded unavailability and AC-F3-3 is added as its regression boundary, and the two fixture and label defects are corrected. Section 3.4 maps every Definition-of-Done item in spec §26 to the case or gate that observes it.

This revision answers DoR iteration 2 against spec v1.2: the seat-level refusal's projection is restated against the delivered **`data`** envelope at exit 2 (never an `error` envelope, never absent `data`), with the unchanged eligibility list, the bounded `summary` and **no profile event of any kind** as the only evidence; the substitution-search wording now follows the spec's single two-level rule (the selection pass does not probe later profiles, the substitution search inspects candidates through the same memoized probe and writes no candidate verdict into the list, so "not probed" is no longer asserted in absolute terms anywhere a candidate is examined); the declared-seat substitution arm is added to `TC-PROFILE-066` alongside the rung arm and a no-park control, so the plain declared path is exercised with a park; and the committed-policy enumeration uses the same four identifiers everywhere.

### 1.1 In Scope

- Recorded provider-attributable parks as profile-eligibility inputs at read time, with `expiresAt > now` activity and the verified fold as the only park source (F-1; `AC-F1-1`, `AC-F1-2`, `AC-F1-3`; NFR-1, NFR-5, NFR-7; DM-1).
- Recorded watch condition and freshness as an eligibility input, expressed only through the delivered `watch-stale` value, evaluated per declared `provider.profiles.watch.<name>` target at the exact `ageSeconds = floor((nowMs − observedAtMs)/1000) >= maxAgeSeconds` predicate, with a provider that declares no watch target never stale and the three excluded readings (one global instant, staleness without a declared target, all-providers-stale on a global old instant) tested as failing arms (F-2; `AC-F2-1`; NFR-3, NFR-5; §8.6, TDR-0075).
- Seat-level re-check of the effective seat model's provider against **recorded unavailability only** — an active provider-attributable park or a stale observation — substitution from the next eligible, seat-declaring, capability-adequate profile in `preferenceChain` order, the preserved capability gate, and the `provider.profile.unavailable` refusal naming seat and provider in the bounded `summary` with the eligibility list carried unchanged (F-3; `AC-F3-1`, `AC-F3-2`; DM-2, DM-3).
- The seat-gate boundary: an effective seat model on an undeclared, disabled, or peak-parked provider keeps exactly the delivered behaviour with zero parks and zero observations, proving the gate was not widened (F-3; `AC-F3-3`; NFR-7).
- Truthful `--for-spawn`: per-seat agreement between the `data-v1` env record and the per-spawn binding, no emitted value on a parked or stale provider, all-or-nothing emission, and dispatch-nomination parity over the same probe (F-4; `AC-F4-1`; DM-3, DM-5; NFR-1).
- Read-time recovery on expiry or condition clear, the exact-expiry boundary, the never-parked equivalence, and the zero-write property of the read (F-5; `AC-F5-1`; NFR-2, NFR-5).
- The eight-cause taxonomy fixture with an explicit subject and effect per cause, including the `window` versus `ticket` `budget-exhausted` distinction (F-6; `AC-F6-1`; Appendix A).
- The unchanged `provider resolve` contract: skip reason, park cause, next-eligible time, payload keys, persisted park generation, and the closed skip/cause sets (F-7; `AC-F7-1`; NFR-3).
- Determinism and hermeticity across repeated runs and independent compositions, one park-fold read per resolution, memoized probes, and fail-closed fold failure (NFR-1, NFR-2, NFR-4, NFR-6, NFR-7; `AC-NFR1-1`).
- Vocabulary closure and bounded, secret-free evidence for the new blocker and refusal paths (NFR-3, NFR-6; `AC-F2-1`, `AC-F3-2`, `AC-F4-1`).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any live call: a z.ai or DeepSeek request, a balance read, a watch transport invocation, a credential read, a real sleep. No case may pass by reaching one; the spies fail instead (spec §7.2, NG-1).
- [OUT] Editing `.jaiship/config.yaml`, the operator-local slot, the seat matrix or any decision record. Acceptance fixtures *read* the committed document (or an injected fixture policy, `GAP-T4`) through the injected file system and assert its hash unchanged; they never write it (NG-3, NG-8).
- [OUT] A new park cause, condition kind, watch condition, skip reason, announcement code, error identity, event code, state record kind, schema identifier or envelope key. `TC-PROFILE-065` asserts the closure rather than leaving it to review (NG-2).
- [OUT] Budget evaluation or a work-item-ref read on the profile path; the `ticket`-scope crossing is exercised only as "no park was persisted, therefore nothing is readable" (NG-6).
- [OUT] Park creation, clearing, expiry writes, a daemon, a timer or a cache: `TC-PROFILE-079` asserts the write set, and no case starts a background process (NG-4).
- [OUT] Phase-7 documentation reconciliation of `feature-provider-profiles.md`, the parks guide and the GH-350 staleness boundary. The test plan verifies behaviour; it does not assert page prose (§22, NG-7).
- [OUT] Performance re-baselining. `AC-NFR1-1` carries the 100-provider cost arm, but this plan asserts read counts (`TC-PROFILE-087`) and leaves the delivered wall-clock bound to its existing case `TC-PROFILE-015` as an unedited control (NFR-4).
- [GAP-T1 — phase ownership] Phase boundaries, task ownership and per-phase test obligations live in `chg-GH-377-plan.yaml`; this plan declares what must be proven, not who runs it.
- [GAP-T2 — a diff-shaped clause is converted to a tree invariant] `AC-F7-1` says the persisted park generation is "the same as before this change". A permanent suite may not assert a diff against a moving base (`.ai/rules/testing-strategy.md`), so `TC-PROFILE-084` asserts the invariant instead: the persisted record's identity and generation are reproduced deterministically from the same inputs, with no new record and no new kind.
- [GAP-T3 — the operator-local arm is proven by content reads, not by absence alone] A missing local file could be silent. `TC-PROFILE-059` asserts both the absence and **zero `readText` (content) reads of any `config.local.yaml` path**, and that no local layer contributed a source or value. The delivered acquisition's existence probe (`fs.exists`) is acquisition behaviour, not "consulting" the override, so it is deliberately not counted (`GAP-T3`, finding 9).
- [GAP-T4 — the seat-level acceptance uses an injected fixture policy document] The committed `.jaiship/config.yaml` cannot reach the seat-level refusal: all `delivery` seats name its two declared providers, so parking either makes the whole profile ineligible at provider level. `TC-PROFILE-071` and `TC-PROFILE-074` therefore drive an injected fixture policy document whose selected profile is `eligible` on its `providers` while a seat model names a parked provider outside that list. The committed document is retained only for AC-F1-1/AC-F1-2 (`TC-PROFILE-059`, `TC-PROFILE-060`, `TC-PROFILE-089`, `TC-PROFILE-090`) (finding 6, finding 11).
- [GAP-T5 — new identifiers for plan ownership] This revision adds `TC-PROFILE-094` (AC-F3-3 seat-gate boundary) and `TC-PROFILE-095`..`TC-PROFILE-097` (the §8.6 watch-observation seam and its excluded readings). Proposed phase ownership for `chg-GH-377-plan.yaml`: `TC-PROFILE-094` → phase 2 (seat-level re-check); `TC-PROFILE-095`, `TC-PROFILE-096`, `TC-PROFILE-097` → phase 1 (park-aware probe and freshness). The plan is revised after this document; this note exists so every identifier is owned exactly once.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-377-spec.md`](./chg-GH-377-spec.md) **v1.3** | Binding source: **F-1..F-7**, **NFR-1..NFR-7**, **DM-1..DM-7**, **EVT-1..EVT-3**, **12 ACs** (`AC-F1-1`..`AC-F7-1`, `AC-F3-3`, `AC-NFR1-1`), **RSK-1..RSK-10**, **DEC-1..DEC-8**, **A-1..A-11**, §6 flows 1–6, §7.3 deferred items, §8.5 backward compatibility (including the delivered `data` refusal envelope at exit 2), **§8.6** (the park fold and watch-observation seam), **Appendix A** (cause taxonomy), **Appendix D** (proof matrix), **Appendix E** (vocabulary closure), **§26 DOD-1..DOD-8**. |
| [`doc/decisions/TDR-0075-watch-stale-as-profile-eligibility-blocker.md`](../../../../doc/decisions/TDR-0075-watch-stale-as-profile-eligibility-blocker.md) | Authority for the narrowed boundary: TDR-0062 D2 is narrowed for profile eligibility only; a stale **declared** watch target is a named blocker, never a clear reading, at zero acquisition cost. Fixes the per-target predicate, the undeclared-target case, the live-read age-0 case, and the "no production composition supplies a stale observation today" honesty limit that `TC-PROFILE-062`..`TC-PROFILE-065` and `TC-PROFILE-095`..`TC-PROFILE-097` pin. |
| [`chg-GH-377-pm-notes.yaml`](./chg-GH-377-pm-notes.yaml) | Context only: the binding implementation pointer (`createResolvedProviderProbe`), the no-live-fetch decision, the chain-level attribution decision, and the two resolved questions OQ-1/OQ-2. The specification is the source of truth. |
| `./chg-GH-377-plan.yaml` | Phase ownership and per-phase test obligations; owned there and not asserted here (`GAP-T1`). |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; layers `tests/{structure,behaviour,checks,golden,boundaries}`; permanent suites assert the current tree or HEAD and never a diff against a moving base; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate; a rule without a failing fixture is a gap. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing, injected clock and ports, data-only contracts, pure domain, adapters own I/O, injected fakes over `mock.module`. |
| [`doc/templates/test-plan-template.md`](../../../templates/test-plan-template.md) | Structural template for this document (front matter, sections, case fields). |
| [`chg-GH-350-test-plan.md`](../2026-11-19--GH-350--provider-policy/chg-GH-350-test-plan.md) | Format precedent: verification-map framing, exact-set-equality discipline, declared assertion bases, per-case negative controls, and the `TMPDIR=$PWD/tmp/tmpdir` gate-environment note. It also owns the delivered cases this plan treats as unchanged controls (`TC-WFRESH-002`, `TC-PROFILE-012..015`, `TC-PROV-001`, `TC-PROV-041`). |
| [`chg-GH-374--provider-policy-adoption`](../2026-11-20--GH-374--provider-policy-adoption/) | Delivered policy-adoption proof: the committed `delivery` → `paid` chain, the 24-seat matrix and the pinned policy values the acceptance cases reproduce (`TC-POL-CFG-001`, `TC-POL-DRIFT-004`). |
| **Delivered suites this change extends** | `tests/behaviour/provider-profile-probes.test.ts`, `tests/behaviour/provider-profile-selection.test.ts`, `tests/behaviour/provider-profile-edge-wiring.test.ts`, `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/behaviour/provider-profile-spawn.test.ts`, `tests/behaviour/provider-parks.test.ts`, `tests/behaviour/provider-chain-resolution.test.ts`, `tests/behaviour/provider-nomination-admission.test.ts`, `tests/structure/provider-contract.test.ts`, `tests/structure/provider-profile-contract.test.ts`, `tests/checks/provider-profile-hermetic.test.ts`, `tests/checks/provider-profile-evidence-bounds.test.ts`, `tests/golden/provider-profile-resolve.test.ts`. |
| **Delivered suites consumed as unedited controls** | `tests/behaviour/provider-profile-spawn.test.ts` `TC-PROFILE-033/034` (spawn-before/refusal and `data-v1` grammar), `tests/behaviour/provider-cli.test.ts` `TC-PROV-041` (resolve payload keys), `tests/behaviour/provider-chain-resolution.test.ts` `TC-PROV-007..010` (closed skip precedence), `tests/behaviour/provider-announcements.test.ts` `TC-PROV-034/035`, `tests/behaviour/provider-profile-selection.test.ts` `TC-PROFILE-010` (the selected profile's own capability-inadequate seat still yields the delivered `provider.profile.capability-denied`), `tests/behaviour/provider-nomination-admission.test.ts` `TC-PAUSE-002` (refusal identity and exit parity), `tests/behaviour/provider-policy-adoption.test.ts` `TC-POL-NOM-002` (the delivered `provider.profile.unavailable` projection: exit 2 with `data.outcome === "refused"`, `data.code`, `data.eligibility`, never an `error` envelope, never absent `data`), `tests/checks/provider-profile-hermetic.test.ts` `TC-PROFILE-054`, `tests/structure/provider-profile-contract.test.ts` `TC-PROFILE-039/055`. A case that relies on one of these labels it a control and does not rename it. |
| **Delivered seams consumed under test** | `createResolvedProviderProbe` and the `profile.resolve` handler (`packages/cli/src/edge.ts`), `createConfigProgram` / `runCli` (`packages/cli/src/edge.ts`, `packages/cli/src/index.ts`), `selectProfile` / `resolveProfileForSpawn` / `targetSeatName` (`packages/core/src/provider/profile.ts`), `evaluatePacing` / `activeRung` (`packages/core/src/provider/profile-pacing.ts`), `buildProfileEnvRecord` / `envRecordNameForSeat` (`packages/core/src/provider/profile-env-record.ts`), `foldParks` / `readProviderParkViews` / `createParkRecord` / `clearParkRecord` (`packages/core/src/provider/parks.ts`), `resolveProviderChain` (`packages/core/src/provider/chain.ts`), `buildHarnessSpawnEnvironment` (`packages/core/src/domain/harness-spawn-env.ts`), the `DispatchNominatePort` gate in `runDispatch` (`packages/core/src/app/dispatch.ts`), `PARK_CAUSES` / `PROVIDER_CONDITION_KINDS` / `PROVIDER_WATCH_CONDITIONS` / `PROVIDER_SKIP_REASONS` / `ANNOUNCEMENT_CODES` / `PROVIDER_RECORD_KINDS` (`packages/core/src/contracts/provider.ts`), `PROFILE_EVENT_CODES` / `PROFILE_BLOCKER_KINDS` / `ProfileProviderAvailability` (`packages/core/src/contracts/provider-profile.ts`), `ERROR_TABLE` (`packages/core/src/contracts/error-table.ts`). |
| **Test harness and fixtures** | `tests/fixtures/state/harness.ts` (`makeIdentity`, `makeTempRoot`, `openStore`, `removeRoot`), `tests/fixtures/provider/profile/selection/fixtures.ts`, `tests/fixtures/provider/profile/probes/fixtures.ts`, `tests/fixtures/provider/profile/lifecycle/fixtures.ts`, `tests/fixtures/provider/profile/golden/{run.ts,data.ts,profile-resolve.json,profile-resolve.txt}`, `tests/fixtures/provider/profile/contract-inventory.json`, `tests/fixtures/provider/contract-inventory.json`, `tests/fixtures/dispatch/harness.ts`; new data-only `tests/fixtures/provider/profile/parks/cause-taxonomy.ts`. |
| **Gate environment precedent** | `TMPDIR=$PWD/tmp/tmpdir` for every recorded gate command (GH-346/GH-350 precedent). |
| **Gates deliberately not test cases** | `./scripts/lint-commit-range.sh --base main-tools` is the supplementary pre-PR commit-message gate; profile resolution has no behaviour there, so it is evidence, never a `TC-`. |
| **Ticket** | GitHub issue `juliusz-cwiakalski/agentic-delivery-os#377`, milestone "M4: Jaiship-native delivery", story M4-S18. |

## 3. Coverage Overview

All 12 acceptance criteria map to at least one named case and no case is an orphan. The plan carries **39 cases** in one namespace, `TC-PROFILE-059`..`TC-PROFILE-097`, continuing the delivered profile family above its confirmed maximum of `TC-PROFILE-058` (`rg -o "TC-PROFILE-[0-9]+" tests | sort -u` at authoring time). `TC-PROFILE-094`..`TC-PROFILE-097` are added by this revision.

Coverage is deliberately uneven where the criterion spans independent observables: `AC-F1-1` by three (`TC-PROFILE-059`, `TC-PROFILE-089`, `TC-PROFILE-091`), `AC-F1-2` by two (`TC-PROFILE-060`, `TC-PROFILE-090`), `AC-F1-3` by one (`TC-PROFILE-061`), `AC-F2-1` by nine (`TC-PROFILE-062`..`TC-PROFILE-065`, `TC-PROFILE-092`, `TC-PROFILE-095`..`TC-PROFILE-097`), `AC-F3-1` by five (`TC-PROFILE-066`..`TC-PROFILE-069`, `TC-PROFILE-092`), `AC-F3-2` by four (`TC-PROFILE-069`..`TC-PROFILE-071`, `TC-PROFILE-093`), `AC-F3-3` by one (`TC-PROFILE-094`), `AC-F4-1` by four (`TC-PROFILE-072`..`TC-PROFILE-074`, `TC-PROFILE-059`), `AC-F5-1` by five (`TC-PROFILE-075`..`TC-PROFILE-079`), `AC-F6-1` by five (`TC-PROFILE-080`..`TC-PROFILE-083`, `TC-PROFILE-061`), `AC-F7-1` by two (`TC-PROFILE-084`, `TC-PROFILE-085`) and `AC-NFR1-1` by three (`TC-PROFILE-086`..`TC-PROFILE-088`).

**Identifier scoping (declared).** Every new case stays inside the existing `TC-PROFILE-###` namespace, so no new prefix is introduced. New `describe` titles are prefixed `GH-377` and existing titles are never renamed. No case reuses a delivered number.

**Permanent-suite discipline.** Three clauses that read as "unchanged since before" (`AC-F7-1`'s persisted generation, `AC-F4-1`'s parity, NFR-7's delivered equivalence) are converted into tree invariants: a deterministic re-derivation from fixed inputs, a shared-fixture equality, and a golden comparison. None asserts a diff against a moving base (`GAP-T2`).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | With the committed policy, z.ai carrying an active `quota-exhausted` park and DeepSeek clear, outside both declared entry peaks, `provider profile resolve --agent pm --for-spawn` exits 0 with `profile` `paid` and an `outcome` of `selected` or `switched` — the delivered lifecycle reports the first `delivery` → `paid` target move as `switched` and a stable target as `selected`, and spec §8.5 leaves that lifecycle unchanged, so the selection facts are the contract, not a forced lifecycle outcome — reports `delivery` `ineligible` with a `condition` blocker valued `quota-exhausted` naming z.ai, reports `paid` `eligible`, emits `deepseek/deepseek-flash` for PM, names z.ai in no env-record entry, and needs no operator-local override | TC-PROFILE-059, TC-PROFILE-089, TC-PROFILE-091 | Covered |
| AC-F1-2 | With no park and no observation, outside both declared entry peaks, `delivery` is selected, `delivery` `eligible`, `paid` `shadowed`, and the PM env-record entry is `zai-coding-plan/glm-5.3-flash` | TC-PROFILE-060, TC-PROFILE-090 | Covered |
| AC-F1-3 | An active `peak-window` park outside the declared entry peaks selects `paid` with a `peak-window` blocker, and the identical facts carrying `quota-exhausted` yield the identical decision, verdicts and model with only the blocker value differing | TC-PROFILE-061 | Covered |
| AC-F2-1 | A provider that declares a `provider.profiles.watch.<name>` target with its own `maxAgeSeconds`, carries no active park, and is supplied a clear observation whose `ageSeconds` is exactly `maxAgeSeconds` is `ineligible` with a `watch-stale` blocker and no env-record entry on that provider; one second younger is available; a provider that declares no watch target is never stale even with an old global instant; a live read reports age 0 and never produces `watch-stale`; the closed sets are exactly equal to the delivered ones | TC-PROFILE-062, TC-PROFILE-063, TC-PROFILE-064, TC-PROFILE-065, TC-PROFILE-092, TC-PROFILE-095, TC-PROFILE-096, TC-PROFILE-097 | Covered |
| AC-F3-1 | A seat whose effective model — **declared as a plain seat model**, rung-derived, or override-targeted — is recorded-unavailable (an active park or a stale observation) is taken from the next profile, in `preferenceChain` order, that is eligible under the same memoized probe, declares the seat on a provider that is not recorded-unavailable and satisfies the required capability; the emitted and bound value is that profile's declared seat model, profile/tier/rung/overrides are otherwise unchanged, the eligibility list is unchanged (no candidate verdict written into it), and a capability-inadequate substitute is never used as a source | TC-PROFILE-066 (declared-seat, rung and no-park-control arms), TC-PROFILE-067 (override arm), TC-PROFILE-068, TC-PROFILE-069 (adequate-substitute arm), TC-PROFILE-092 | Covered |
| AC-F3-2 | With no valid substitute — every later profile is ineligible under the same probe, does not declare the seat, or declares it only on a capability-inadequate model — resolution refuses `provider.profile.unavailable` **as the delivered `data` envelope at exit 2** (`outcome: "refused"`, `code`, `summary`, `eligibility`, `events`), emits no `error` envelope with absent `data`, no env record and no binding, invents no fallback model, and names both the seat and the parked provider in the bounded `summary`; the eligibility list is carried unchanged (selected profile `eligible`, later profiles `shadowed` — not probed during selection, while the substitution search inspects candidates separately and writes no candidate verdict into the list — no blocker appended, no verdict flip); **and the seat-level refusal emits no profile event of any kind** (`profile.selected`, `profile.ineligible`, `profile.switched`, `profile.reverted`, `profile.rung-changed` all absent, and any selection-time event computed before the seat check is not emitted), so the refusal envelope is the only evidence, with no new event code | TC-PROFILE-069 (inadequate-substitute and delivered-control arms), TC-PROFILE-070, TC-PROFILE-071, TC-PROFILE-093 | Covered |
| AC-F3-3 | With zero park records and zero supplied observations, an effective seat model naming a provider that is undeclared, disabled, or inside its declared peak window yields exactly the delivered behaviour: the seat is neither substituted nor refused, the emitted value is the delivered one, eligibility verdicts and exit code are unchanged, and no `watch-stale` or park blocker appears — proving the seat gate was not widened | TC-PROFILE-094 | Covered |
| AC-F4-1 | For every declared seat the env-record value equals the binding value, no emitted value names a provider with an active park or a stale observation, an unsatisfiable seat emits no record at all (never partial or placeholder), and the dispatch nomination verdict matches the CLI verdict over the same facts | TC-PROFILE-072, TC-PROFILE-073, TC-PROFILE-074, TC-PROFILE-059 | Covered |
| AC-F5-1 | Advancing the clock past the recorded expiry (or clearing the condition) restores `delivery` and its z.ai seats with no config edit, timer, daemon or write; exactly at `expiresAt` the park is inactive; a never-parked state yields the identical decision; the resolution appends zero park/announcement/cleared records and the delivered target persistence is the only write | TC-PROFILE-075, TC-PROFILE-076, TC-PROFILE-077, TC-PROFILE-078, TC-PROFILE-079 | Covered |
| AC-F6-1 | A committed fixture pins all eight causes: six make their named provider unavailable with the cause as the blocker value; `chain-exhausted` and `reevaluation-cap` make no provider unavailable and clear none; `window`-scope `budget-exhausted` is consumed while the `ticket`-scope crossing persists no readable park; and an added, removed, unclassified, silently ignored or silently clearing cause fails naming the cause | TC-PROFILE-080, TC-PROFILE-081, TC-PROFILE-082, TC-PROFILE-083, TC-PROFILE-061 | Covered |
| AC-F7-1 | On the AC-F1-1 facts the mutating `provider resolve` still skips z.ai with `quota-exhausted`, reports the park with cause and a next-eligible time equal to the reset instant, selects DeepSeek, keeps the delivered payload keys and the same persisted park generation; with no park, chain resolution, its skip reasons and its selection are unchanged; the skip-reason and park-cause sets are exactly equal to the delivered sets | TC-PROFILE-084, TC-PROFILE-085 | Covered |
| AC-NFR1-1 | Identical facts produce identical decisions, eligibility, models, event identities and refusal codes across three runs and two independent compositions with zero network calls, zero credential reads and zero sleeps, and no records beyond the delivered target persistence; a 100-provider configuration reads the park fold at most once and probes each distinct provider at most once per pass; a failed fold read yields a named unavailable verdict, never a clear one and never a crash, with no new identity | TC-PROFILE-086, TC-PROFILE-087, TC-PROFILE-088 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Element | TC ID(s) | Status |
|---|---|---|---|
| EVT-1 | `profile.selected` keeps its code, severity, evidence keys and identity derivation; park-derived blockers appear in the bounded `blockers` evidence using existing values | TC-PROFILE-091, TC-PROFILE-086 | Covered |
| EVT-2 | `profile.ineligible` keeps its code and shape and now names park causes and `watch-stale`, with `reason: capability-gate` only when every blocker is a capability blocker; a **seat-level refusal emits no profile event at all** — not `profile.selected`, `profile.ineligible`, `profile.switched`, `profile.reverted` or `profile.rung-changed` — so the refusal envelope is the only evidence, with no new event code, condition or evidence key | TC-PROFILE-092, TC-PROFILE-065, TC-PROFILE-070, TC-PROFILE-071 | Covered |
| EVT-3 | `profile.switched` / `profile.reverted` are unchanged and are driven by read-time expiry, with no new code, condition or evidence key | TC-PROFILE-075, TC-PROFILE-077 | Covered |
| DM-1 | The park-derived eligibility fact: verdict from descriptor, enablement, declared peak, active park and recorded observation freshness; activity `expiresAt > now`; nothing persisted | TC-PROFILE-059, TC-PROFILE-061, TC-PROFILE-076, TC-PROFILE-062, TC-PROFILE-095 | Covered |
| DM-2 | The parked-provider blocker in the delivered shape (`kind: condition`, `value` = cause or `watch-stale`, bounded `detail`) with no new blocker kind or identity; the seat-level refusal adds no evidence position — the eligibility list is carried unchanged, the substitution search writes no candidate verdict into it, the bounded refusal `summary` names both seat and provider, and no profile event is emitted | TC-PROFILE-062, TC-PROFILE-065, TC-PROFILE-091, TC-PROFILE-093, TC-PROFILE-070, TC-PROFILE-071, TC-PROFILE-096 | Covered |
| DM-3 | The substituted seat model written into the existing per-seat model map that both the env record and the binding read, with no new field | TC-PROFILE-066, TC-PROFILE-068, TC-PROFILE-072 | Covered |
| DM-4 | Durable vocabulary unchanged: no new record kind, payload schema, store key, park field or event evidence key; existing records are read and never written | TC-PROFILE-065, TC-PROFILE-079 | Covered |
| DM-5 | The `data-v1` env record keeps its grammar, header, allowlist, limits and set/unset shape; only substituted values differ and they validate identically | TC-PROFILE-072, TC-PROFILE-073 | Covered (delivered grammar control `TC-PROFILE-034`) |
| DM-6 | The park input to the probe: the verified fold keyed by `provider:<name>` and `chain:<name>`, closed cause and absolute expiry, one read per resolution, activity `expiresAtMs > nowMs`, no persistence or write | TC-PROFILE-084, TC-PROFILE-087, TC-PROFILE-079 | Covered |
| DM-7 | The observation input to the probe: composition-supplied, per provider, keyed by provider name, shape `{ condition, observedAtMs }`, consumed at the read instant with no persistence, fetch or write; only freshness is consumed | TC-PROFILE-062, TC-PROFILE-063, TC-PROFILE-064, TC-PROFILE-095, TC-PROFILE-096, TC-PROFILE-097 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Determinism and hermeticity: identical facts produce identical decisions, verdicts, records, identities and codes across repeated runs and independent compositions, with zero network, credential read, sleep or ambient clock read | TC-PROFILE-086, TC-PROFILE-074 | Covered |
| NFR-2 | Read-only consumption: zero park/announcement/cleared records written, at most one verified fold read per resolution, and only the delivered target persistence on change | TC-PROFILE-079, TC-PROFILE-087 | Covered |
| NFR-3 | Closed-vocabulary invariance: 8 causes, 6 condition kinds, 6 watch conditions, 9 skip reasons, the delivered announcement set, and 0 new error identities, event codes, state kinds, schema ids or envelope keys; `watch-stale` stays watch-only and the excluded freshness readings add no member | TC-PROFILE-065, TC-PROFILE-090, TC-PROFILE-085, TC-PROFILE-097 | Covered |
| NFR-4 | Evaluation cost: one probe per distinct provider per pass (memoized), one fold read per resolution, no per-seat re-read, and the delivered 50 ms reference bound retained | TC-PROFILE-087 | Covered (`GAP`-free: timing stays with the delivered `TC-PROFILE-015` control) |
| NFR-5 | Boundary correctness: active iff `expiresAt > now`, inactive at exactly `expiresAt`; per declared watch target stale iff `ageSeconds >= maxAgeSeconds`, with the bound stale and the preceding second not; a provider with no declared watch target is never stale | TC-PROFILE-062, TC-PROFILE-063, TC-PROFILE-076, TC-PROFILE-095, TC-PROFILE-097 | Covered |
| NFR-6 | Bounded, secret-free evidence: profile caps (≤ 20 fields, ≤ 1024 bytes, ≤ 128-byte strings, ≤ 8 items, ≤ 96-byte items) and no credential, authorization header, userinfo or raw body on any surface | TC-PROFILE-093, TC-PROFILE-071, TC-PROFILE-091, TC-PROFILE-070 | Covered |
| NFR-7 | Compatibility with absent facts: the zero-park, zero-observation decision, eligibility, env record and exit are identical to the delivered behaviour by golden comparison — including a seat model on an undeclared, disabled or peak-parked provider — and a fold failure is never clear | TC-PROFILE-060, TC-PROFILE-078, TC-PROFILE-088, TC-PROFILE-090, TC-PROFILE-094 | Covered |

### 3.4 Definition of Done Coverage (spec §26)

Every item in spec §26 is observed by a named case or by a declared gate command; **DOD-6, DOD-7 and DOD-8 are gate evidence, not test cases** — they describe delivery hygiene, ledger state and post-change documentation, none of which a `tests/**` suite can assert about itself.

| DOD | Item (condensed) | Evidence | Kind |
|---|---|---|---|
| DOD-1 | Every functional and NFR acceptance criterion is green. | The §3.1 matrix maps all 12 criteria to named cases; `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits 0 with every owning case green, none skipped, disabled or vacuous. | Cases + aggregate gate |
| DOD-2 | The committed policy and any operator-local file are untouched. | `TC-PROFILE-059` and `TC-PROFILE-060` capture the committed `config.yaml` SHA-256 before and after and assert it unchanged, and `TC-PROFILE-059` asserts zero `readText` content reads of any `config.local.yaml` path with no local layer contributing a source/value (`GAP-T3`). The change diff contains no policy edit and no new configuration key (`git diff --name-only` review). | Cases + diff review |
| DOD-3 | The vocabulary and the decision boundary are intact. | `TC-PROFILE-065`, `TC-PROFILE-085` and `TC-PROFILE-090` prove set equality and zero new envelope keys; `TC-PROFILE-080` pins the eight-cause classification. TDR-0075 is present, TDR-0062 is not superseded and TDR-0076 is unused (structure/content review of `doc/decisions/**` and its index). | Cases + structure/content review |
| DOD-4 | One probe factory, three call sites, one fold read. | `TC-PROFILE-087` counts exactly one verified fold read per resolution and one probe per distinct provider, and its source census asserts the probe is constructed through one factory at exactly three sites — the profile-resolve edge handler, the spawn-context helper (`resolveProfileContextFrom`) and the dispatch nomination predicate — with no fourth site and no second availability derivation. | Case (source census) + review |
| DOD-5 | The read-only contract is observed, not claimed. | `TC-PROFILE-086` records zero fetch, zero credential read, zero network call and zero sleep; `TC-PROFILE-079` records zero park, announcement or cleared writes, with the delivered target persistence the only write; `TC-PROFILE-093` proves the evidence is bounded and secret-free. | Cases |
| DOD-6 | Delivery hygiene and platform state are as declared. | Every commit created through the `commit` primitive; the PR open against `main-tools` and unmerged; the decision-ledger maximum re-verified at delivery time and TDR-0076 unused (§18). | **Gate evidence only** |
| DOD-7 | The delivery ledger and the gates support the claim. | Every declared plan phase complete with a per-phase pm-notes `notes:` entry naming the plan phase id, commit hash and test result; review `PASS`; quality gates green; `./scripts/lint-commit-range.sh --base main-tools` reports `PASS` and is recorded as a pm-notes `notes:` entry. | **Gate evidence only** |
| DOD-8 | Current-truth documentation carries no residual gap. | `@doc-syncer` reconciles the four pages named in §22 plus the decision ledger, and a residual-gap sweep finds zero statements presenting the three-check probe or the absolute `watch-stale` exclusion as current. | **Gate evidence only (phase 7 doc-sync)** |

## 4. Test Types and Layers

`bun:test` only, under `tests/**/*.test.ts`; fixtures are data modules and never named `*.test.ts`. No new framework, runner or suite family is introduced.

| Layer | Directory | Role in this plan | Commands |
|---|---|---|---|
| Structure / contract | `tests/structure/` | Closed-set and inventory equality, the eight-cause classification table, envelope-key closure, drift and mutation arms | `bun test tests/structure/provider-contract.test.ts`, `bun test tests/structure/provider-profile-contract.test.ts` |
| Behaviour (pure domain) | `tests/behaviour/` | Probe composition, selection blockers, seat re-check and substitution, freshness and expiry boundaries, agreement, recovery, taxonomy behaviour, chain-resolver regression | `bun test tests/behaviour/provider-profile-probes.test.ts`, `…-selection.test.ts`, `…-park-switch-revert.test.ts`, `provider-parks.test.ts`, `provider-chain-resolution.test.ts`, `provider-nomination-admission.test.ts` |
| Edge wiring (integration) | `tests/behaviour/` | Production `createConfigProgram` + `runCli` with a temp state store, injected clock and injected file system — no stubs of the decision | `bun test tests/behaviour/provider-profile-edge-wiring.test.ts` |
| Checks (invariants) | `tests/checks/` | Hermeticity and secret safety, evidence bounds, ambient-globals scan over the profile tier | `bun test tests/checks/provider-profile-hermetic.test.ts`, `bun test tests/checks/provider-profile-evidence-bounds.test.ts` |
| Golden | `tests/golden/` | Normalized CLI envelope for the quota-park and healthy facts, plus the unchanged delivered golden | `bun test tests/golden/provider-profile-resolve.test.ts` |
| Static / diff | repo root | Whitespace and conflict-marker guard; changed-file naming review | `git diff --check` |
| Aggregate gate | repo root | The single pre-review entry point | `TMPDIR=$PWD/tmp/tmpdir pnpm check` |

Test types used: **Contract** (structure and checks), **Integration** (edge wiring and store-backed regression), **E2E-equivalent** (CLI invocation through the production composer — no process spawn, in-process capture), **Regression** (chain resolution and delivered controls). No **Manual** case exists; no **Performance** case is re-baselined.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Layer | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-PROFILE-059 | Production acceptance: a quota park selects `paid` without a local override | Integration | Edge wiring | High | AC-F1-1, AC-F4-1 |
| TC-PROFILE-060 | Healthy facts select `delivery` and shadow `paid` | Integration | Edge wiring | High | AC-F1-2 |
| TC-PROFILE-061 | A peak park and a quota park are one eligibility rule | Behaviour | Pure domain | High | AC-F1-3, AC-F6-1 |
| TC-PROFILE-062 | For a declared watch target, an observation at the bound blocks as `watch-stale` | Behaviour | Pure domain | High | AC-F2-1, NFR-5, DM-7 |
| TC-PROFILE-063 | One second below the declared bound is available | Behaviour | Pure domain | High | AC-F2-1, NFR-5 |
| TC-PROFILE-064 | A live read has age 0; an absent observation is not stale | Behaviour | Pure domain | Medium | AC-F2-1 |
| TC-PROFILE-065 | The closed vocabularies and envelope keys are unchanged | Contract | Structure | Critical | AC-F2-1, NFR-3 |
| TC-PROFILE-066 | A plain declared or rung execution model on a recorded-unavailable provider is substituted | Behaviour | Pure domain | Critical | AC-F3-1 |
| TC-PROFILE-067 | An agent override routing to a recorded-unavailable-provider seat is substituted | Behaviour | Pure domain | Critical | AC-F3-1 |
| TC-PROFILE-068 | Substitution is per-seat routing with an unchanged eligibility list | Behaviour | Pure domain | High | AC-F3-1, DM-2, DM-3 |
| TC-PROFILE-069 | A capability-inadequate substitute is not used; the capability gate holds | Behaviour | Pure domain | Critical | AC-F3-1, AC-F3-2 |
| TC-PROFILE-070 | No valid substitute refuses `unavailable`, naming seat and provider, list unchanged | Behaviour | Pure domain | Critical | AC-F3-2, EVT-2, DM-2, NFR-6 |
| TC-PROFILE-071 | The seat-level refusal projects the delivered `data` envelope at exit 2 with no profile event | Integration | Edge wiring | High | AC-F3-2, EVT-2, NFR-6 |
| TC-PROFILE-072 | The env record and the spawn binding agree for every seat | Behaviour | Pure domain | Critical | AC-F4-1, DM-3, DM-5 |
| TC-PROFILE-073 | Emission is all-or-nothing | Behaviour | Pure domain | High | AC-F4-1, DM-5 |
| TC-PROFILE-074 | Dispatch nomination agrees with the CLI verdict over a seat-level fixture | Integration | Behaviour | High | AC-F4-1, NFR-1 |
| TC-PROFILE-075 | Advancing past expiry restores the preferred profile | Integration | Edge wiring | Critical | AC-F5-1, EVT-3 |
| TC-PROFILE-076 | The park is inactive at exactly its expiry | Behaviour | Pure domain | High | AC-F5-1, NFR-5 |
| TC-PROFILE-077 | A cleared condition restores the profile before expiry | Behaviour | Pure domain | High | AC-F5-1, EVT-3 |
| TC-PROFILE-078 | A never-parked state yields the identical decision | Behaviour | Pure domain | Medium | AC-F5-1, NFR-7 |
| TC-PROFILE-079 | The read writes no park, announcement or cleared record | Integration | Edge wiring | Critical | AC-F5-1, NFR-2 |
| TC-PROFILE-080 | The eight-cause table pins every cause and its subject | Contract | Structure | Critical | AC-F6-1 |
| TC-PROFILE-081 | Chain-level causes never block and never clear a provider | Behaviour | Pure domain | Critical | AC-F6-1 |
| TC-PROFILE-082 | `budget-exhausted` window scope is consumed, ticket scope is not readable | Behaviour | Pure domain | High | AC-F6-1 |
| TC-PROFILE-083 | Taxonomy drift fails by name, not by silence | Contract | Structure | High | AC-F6-1 |
| TC-PROFILE-084 | `provider resolve` keeps its skip, park, next-eligible time and generation | Regression | Store-backed | Critical | AC-F7-1 |
| TC-PROFILE-085 | Chain resolution with no parks and the closed skip set are unchanged | Regression | Pure domain | High | AC-F7-1, NFR-3 |
| TC-PROFILE-086 | Three runs and two compositions agree; zero network, credential or sleep | Contract | Checks | Critical | AC-NFR1-1, NFR-1 |
| TC-PROFILE-087 | One fold read and memoized probes over one hundred providers | Contract | Checks | High | AC-NFR1-1, NFR-4 |
| TC-PROFILE-088 | A failed fold read is a named unavailable verdict | Behaviour | Pure domain | Critical | AC-NFR1-1, NFR-7 |
| TC-PROFILE-089 | Golden `--for-spawn` envelope under a quota park | Contract | Golden | High | AC-F1-1, NFR-7, NFR-3 |
| TC-PROFILE-090 | Golden envelope under healthy facts matches the delivered selection | Contract | Golden | High | AC-F1-2, NFR-7, NFR-3 |
| TC-PROFILE-091 | `profile.selected` carries the park cause in bounded evidence | Contract | Behaviour | Medium | EVT-1, AC-F1-1, NFR-6 |
| TC-PROFILE-092 | `profile.ineligible` names park causes and `watch-stale`; capability precedence holds | Contract | Behaviour | High | EVT-2, AC-F2-1, AC-F3-1 |
| TC-PROFILE-093 | New blocker and refusal evidence is bounded and secret-free | Contract | Checks | High | NFR-6, DM-2 |
| TC-PROFILE-094 | The seat gate is not widened: undeclared, disabled or peak-parked seat provider keeps delivered behaviour | Behaviour | Pure domain | Critical | AC-F3-3, NFR-7 |
| TC-PROFILE-095 | Staleness is per declared target; a provider with no declared target is never stale | Behaviour | Pure domain | High | AC-F2-1, NFR-5, DM-7 |
| TC-PROFILE-096 | Only freshness is consumed: a condition that derived a park is that park | Behaviour | Pure domain | High | AC-F2-1, DM-2, DM-7 |
| TC-PROFILE-097 | The three excluded freshness readings fail by name | Contract | Behaviour | High | AC-F2-1, NFR-3, NFR-5 |

### 5.2 Scenario Details

#### TC-PROFILE-059 - Production acceptance: a quota park selects `paid` without a local override

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-1, AC-F4-1, DM-1, NFR-7, A-4, A-5
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-edge-wiring.test.ts`
**Tags**: @backend, @integration, @provider

**Preconditions**:
- The committed `.jaiship/config.yaml` is read as text at test start and served through the injected `fs.readText` double at the path the composer asks for; the file is never written. A SHA-256 of the text is captured before the run and re-checked after it.
- A temp state store from `makeTempRoot` / `openStore` / `removeRoot` holds one active `provider.park` record for `provider:zai-coding-plan`, subject `zai-coding-plan`, cause `quota-exhausted`, `expiresAtMs > nowMs`, plus the recorded reset instant in its evidence.
- The injected clock sits at an instant where `evaluatePeakWindow` returns non-parked for both declared entry peaks and both declared profile windows.
- No `config.local.yaml` is present. The injected file system records separately every `exists` probe and every `readText` content read; the delivered acquisition's existence probe is acquisition behaviour, not "consulting" the override (`GAP-T3`).

**Steps**:
1. Run `provider profile resolve --agent pm --for-spawn --json` through `createConfigProgram` + `runCli`.
2. Parse `data` from stdout and read `outcome`, `profile`, `eligibility`, `envRecord`.
3. Read the file-system double's recorded `exists` probes and `readText` reads, inspect the composed configuration's contributing layers, and re-check the committed policy SHA-256.

**Expected Outcome**:
- Exit code 0; `profile === "paid"`.
- `outcome` is `"selected"` **or** `"switched"`: the delivered lifecycle reports `switched` on the first `delivery` → `paid` target move and `selected` when the paid target is already stable, and spec §8.5 keeps that lifecycle unchanged (spec v1.3 accepts the delivered outcome). Asserting one literal would pin a lifecycle transition this change does not own; the contract is the selection result below, not the outcome word.
- `eligibility` contains `{profile: "delivery", verdict: "ineligible"}` with exactly one `condition` blocker whose `value === "quota-exhausted"` and whose `detail` names `zai-coding-plan`, and `{profile: "paid", verdict: "eligible"}`.
- The PM entry of the env record is a `set` operation with `value === "deepseek/deepseek-flash"`; no env-record entry value contains `zai-coding-plan`.
- The file-system double recorded **zero `readText` content reads of any `config.local.yaml` path** and no local layer contributed a source or value; zero writes occurred anywhere. The existence probe may have run and is not treated as a content read.
- The committed policy hash is unchanged.

**Notes / Clarifications**:
- This is the reproduced 2026-11-21 state from recorded facts alone (spec Appendix B); the live vendor state is never consulted (RSK-9).

#### TC-PROFILE-060 - Healthy facts select `delivery` and shadow `paid`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-2, NFR-7
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-edge-wiring.test.ts`
**Tags**: @backend, @integration, @provider

**Preconditions**:
- Same harness as `TC-PROFILE-059` with the committed policy text.
- The state store is opened empty (no park records) and composition supplies no observation.

**Steps**:
1. Run `provider profile resolve --agent pm --for-spawn --json`.
2. Inspect the envelope's `outcome`, `profile`, `eligibility` and the PM env-record entry.

**Expected Outcome**:
- Exit 0; `profile === "delivery"`; `eligibility` is `delivery: eligible`, `paid: shadowed` (no blockers on `paid`).
- The PM env-record entry is `zai-coding-plan/glm-5.3-flash`.
- Zero park records and zero observation records were created.

#### TC-PROFILE-061 - A peak park and a quota park are one eligibility rule

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-3, AC-F6-1, RSK-10
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- The committed policy (or the equivalent `delivery` → `paid` fixture) and a recording probe that returns the same unavailable verdict for z.ai under two causes.
- The clock instant is asserted non-parked by the delivered `evaluatePeakWindow` for both declared *entry* peaks, so only the recorded park can drive the outcome.

**Steps**:
1. Compose the probe over recorded park facts with cause `peak-window`, run `selectProfile`.
2. Recompose over the identical facts with cause `quota-exhausted`, run the same selection.
3. Compare the two results field by field.

**Expected Outcome**:
- Both select `paid` and emit `deepseek/deepseek-flash` for PM.
- `eligibility` is identical except that `delivery`'s first blocker `value` is `peak-window` in one run and `quota-exhausted` in the other; blocker count, order and `kind` match.
- The `profile.selected` evidence differs only in that blocker string.

**Notes / Clarifications**:
- The pair is table-driven from one fixture so a second eligibility implementation cannot satisfy one arm and fail the other silently.

#### TC-PROFILE-062 - For a declared watch target, an observation at the bound blocks as `watch-stale`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5, DM-2, DM-7, §8.6, TDR-0075, OQ-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A fixture provider declares exactly one `provider.profiles.watch.<name>` target with its own `maxAgeSeconds ≥ 1`; the provider is declared, enabled and peak-free, and carries no park record.
- The composition supplies an observation **keyed by provider name**, shape `{ condition, observedAtMs }` (DM-7, A-11), with `condition: "clear"` and `observedAtMs = nowMs - maxAgeSeconds * 1000`, so `ageSeconds = floor((nowMs − observedAtMs)/1000) === maxAgeSeconds` for **that declared target**.
- **Honesty note**: no production composition supplies a stale observation today (spec §8.6, A-10); the observation is injected at the probe seam to exercise the fail-loud guard. No state is persisted, fetched or written.

**Steps**:
1. Build the probe with the injected observation and the injected clock at `nowMs`.
2. Probe the provider and run `selectProfile` over the chain that uses it.
3. Run `resolveProfileForSpawn` for the `--for-spawn` record.

**Expected Outcome**:
- The probe verdict is `available: false` with `condition === "watch-stale"` and a `condition` blocker whose `value === "watch-stale"` and whose bounded `detail` names the provider, the declared target, the observed age and the bound.
- The profile using that provider is `ineligible` with that blocker (not `shadowed`), and the next eligible profile is selected.
- No env-record entry names a model on the stale provider.
- The rule is per declared target and the boundary value is stale: `ageSeconds === maxAgeSeconds` for that target is stale (no off-by-one).

#### TC-PROFILE-063 - One second below the declared bound is available

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5, DM-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- The same provider, declared watch target and injected `{ condition, observedAtMs }` observation as `TC-PROFILE-062`, with `observedAtMs = nowMs - (maxAgeSeconds - 1) * 1000`, so `ageSeconds === maxAgeSeconds - 1` under the delivered `floor`.
- **Honesty note**: as in `TC-PROFILE-062`, the observation is injected at the seam; no production composition supplies it.

**Steps**:
1. Probe the provider.
2. Run the selection and the `--for-spawn` resolution over the same configuration.

**Expected Outcome**:
- The verdict is available with `condition === "clear"` and zero blockers; `watch-stale` is never produced for this `ageSeconds` against this target's bound.
- The preferred profile is selected and the env record names that provider's seat model.

#### TC-PROFILE-064 - A live read has age 0; an absent observation is not stale

**Scenario Type**: Corner Case
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: F-2, AC-F2-1, A-6, A-10, DM-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A composed live read whose observation is stamped at the read instant (`observedAtMs === nowMs`), for a provider that declares a watch target, carries no park, at several declared `maxAgeSeconds` values including the smallest validated positive bound.
- A second arm in which the composition supplies **no observation** for the provider (the delivered steady state, A-10).

**Steps**:
1. Perform the live read with the injected clock at `nowMs`.
2. Compute `ageSeconds` with the delivered predicate and probe the composed availability.
3. Repeat across the declared bounds.
4. Probe the no-observation arm.

**Expected Outcome**:
- `ageSeconds === 0` in every live-read arm.
- The probe verdict is available and `watch-stale` never appears, because `0 >= maxAgeSeconds` is false for every validated bound.
- The absent-observation arm is available and contributes nothing, exactly as delivered (it is not stale).
- The read performs no transport call and no state write.

**Notes / Clarifications**:
- Staleness is the fail-loud guard for composition-supplied observations and the park clamp (spec F-2, A-6), not a steady-state ineligibility.

#### TC-PROFILE-065 - The closed vocabularies and envelope keys are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-3, AC-F2-1, DM-2, DM-4, EVT-2, NG-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-contract.test.ts`, `tests/structure/provider-profile-contract.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- The delivered inventories `tests/fixtures/provider/contract-inventory.json` and `tests/fixtures/provider/profile/contract-inventory.json`, and `ERROR_TABLE`.

**Steps**:
1. Compare each closed set with its inventory in both directions: `PARK_CAUSES` (8), `PROVIDER_CONDITION_KINDS` (6), `PROVIDER_WATCH_CONDITIONS` (6), `PROVIDER_SKIP_REASONS` (9), `ANNOUNCEMENT_CODES`, `PROVIDER_RECORD_KINDS`, `PROFILE_EVENT_CODES` (5), `PROFILE_BLOCKER_KINDS`, `PROFILE_ELIGIBILITY_VERDICTS`.
2. Assert the provider and provider-profile contract inventories are byte-unchanged (no new export, no removed export).
3. Assert the resolve envelope keys are exactly `outcome`, `profile`, `tier`, `rung`, `agentOverrides`, `eligibility`, `envRecord`, `events`, `summary`.
4. Assert no `provider.profile.*` error identity was added or removed.
5. Run the delivered mutation arm: append an extra cause and an extra export in a temp copy and assert both are named.

**Expected Outcome**:
- Every set equality holds; `watch-stale` remains watch-only and appears in no cause, condition-kind or skip-reason set.
- `PROVIDER_RECORD_KINDS` remains exactly `provider.park | provider.announcement` — an observation is never a record kind (DM-7).
- The inventories show zero differences in both directions.
- The envelope key list matches exactly (order included) and the mutation arm fails by name.
- Zero new error identities, event codes, state record kinds, schema identifiers or envelope keys; the excluded freshness readings of `TC-PROFILE-097` add no member either.

#### TC-PROFILE-066 - A plain declared or rung execution model on a recorded-unavailable provider is substituted

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DM-3, RSK-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A fixture built from `tests/fixtures/provider/profile/selection/fixtures.ts`, where the selected profile's declared `providers` list excludes the seat provider, the profile itself is eligible on its declared providers, and a later profile in `preferenceChain` is eligible under the same memoized probe and declares the same seat on an available provider.
- **Four arms over that one fixture**, so the declared path is exercised with a park rather than only at the zero-park AC-F3-3 boundary:
  1. **Declared-seat arm (production-reachable)**: the selected profile's own seat map names a `provider/model` expression on the recorded-unavailable provider for the target seat — no rung and no override involved, so the effective model is the plain declared one (F-3 "Reach").
  2. **Rung arm (contract-level)**: the profile's declared seat is not on that provider, while a pacing rung's `executionModel` carries the same `provider/model` expression; the `seatModels` map is supplied exactly as `evaluatePacing` produces it for the active rung, because no production caller supplies rung seat models today.
  3. **Stale-observation variant** over the declared and rung arms: the same provider carries no park but a stale declared watch observation under `TC-PROFILE-062`'s rule, so the recorded-unavailable fact is not park-specific.
  4. **No-park control arm**: the identical fixture with zero park records and zero supplied observations; the selected profile's declared seat model is emitted unchanged and nothing is substituted.
- The seat provider is **recorded-unavailable** in arms 1–3: an active provider-attributable park with a future expiry, or (arm 3) a stale declared watch observation. Declaration, enablement and declared peak are deliberately **outside** this case's scope; they are `TC-PROFILE-094`'s boundary.
- The override arm is `TC-PROFILE-067`; each arm of the three reach paths is owned by exactly one case.

**Steps**:
1. Resolve `--for-spawn` in the declared-seat arm with no rung seat models, then in the rung arm with the `evaluatePacing` output.
2. Repeat both over the stale-observation variant.
3. Resolve the no-park control arm over the same fixture.
4. Read `decision.seatModels`, `decision.profile`, `decision.rung`, `decision.tier`, `decision.agentOverrides` and the env record, and compare each arm with the control.

**Expected Outcome**:
- **Declared-seat arm**: `outcome === "selected"`; `profile` is the originally selected profile name; `rung` and `tier` are unchanged; `agentOverrides` is unchanged. The seat's value in `decision.seatModels` is the substitute profile's declared seat model on an available provider, not the recorded-unavailable provider's model, and the env-record entry for that seat carries the same substituted value.
- **Rung arm**: the same substitution, with `rung` reported exactly as the supplied `evaluatePacing` output produced it and the emitted value taken through the same `decision.seatModels` map (DM-3).
- **Stale-observation variant**: identical outcomes in both arms; only the recorded-unavailable cause differs.
- **No-park control arm**: the selected profile's own declared seat model is emitted and bound unchanged, no substitution occurs, and the value equals the delivered pre-park resolution for that fixture.
- In the three unavailable arms no emitted value names the recorded-unavailable provider.
- In every arm the full `eligibility` list is unchanged by the substitution (selected profile `eligible`, later profiles `shadowed`, no blocker appended, no verdict flip), per `TC-PROFILE-068`; a candidate inspected by the substitution search stays `shadowed`.

#### TC-PROFILE-067 - An agent override routing to a recorded-unavailable-provider seat is substituted

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DM-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A fixture where `agentOverrides` maps the resolved agent to a seat whose model pins a provider outside the profile's declared `providers` list, that provider is **recorded-unavailable** (an active park, or a stale declared watch observation), and the next eligible profile declares that seat on an available provider.
- Declaration, enablement and declared peak of the seat provider are deliberately outside this case; a seat on an undeclared, disabled or peak-parked provider is `TC-PROFILE-094`.

**Steps**:
1. Resolve `--for-spawn` for the overridden agent.
2. Compare the seat the agent targets (`targetSeatName`) with the emitted model and the binding value.

**Expected Outcome**:
- The substituted model is emitted for that seat and is the substitute profile's declared model on an available provider.
- The override mapping itself is unchanged in `decision.agentOverrides`.
- The env-record entry and the binding value for the agent are the same string.
- The eligibility list is unchanged (no blocker appended, no verdict flip).

**Notes / Clarifications**:
- This case owns the **override** arm of AC-F3-1; `TC-PROFILE-066` owns the plain **declared-seat** and **rung** arms and their no-park control, so all three reach paths named by F-3 are exercised once each.

#### TC-PROFILE-068 - Substitution is per-seat routing with an unchanged eligibility list

**Scenario Type**: Corner Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, DM-3, DEC-4, DEC-8, RSK-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- The configuration of `TC-PROFILE-066`, with at least two other seats whose models are on available providers and are unaffected by the recorded-unavailable one.

**Steps**:
1. Resolve the selection and the `--for-spawn` record.
2. Compare `eligibility`, `profile`, `rung`, `tier`, `agentOverrides` and every unaffected seat with the same resolution run without the recorded-unavailable provider.

**Expected Outcome**:
- `profile`, `rung`, `tier`, `agentOverrides` and the **full `eligibility` list** are byte-identical to the pre-park resolution: the selected profile stays `eligible`, later profiles stay `shadowed`, **no blocker is appended to any entry and no verdict flips**.
- Only the affected seat's value in `decision.seatModels` differs; every other seat keeps the selected profile's declared model.
- No `profile.switched`, `profile.reverted` or `profile.rung-changed` event is produced by the substitution, and the target record is not written because the substitution changed.
- A later profile inspected as a substitution candidate stays `shadowed`; substitute eligibility is not readable from the list (DM-2, DEC-8).

#### TC-PROFILE-069 - A capability-inadequate substitute is not used; the capability gate holds

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, AC-F3-2, DEC-4, DEC-8, RSK-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A resolution requiring a capability (`requireVision`) whose selected profile's own seat is capability-adequate but whose effective seat model is on a recorded-unavailable provider; the only later profile that declares the seat declares it capability-inadequate.
- A second arm where the later profile's seat is capability-adequate.
- A third, delivered-control arm where the **selected profile's own** seat is capability-inadequate and no park or stale fact is involved.

**Steps**:
1. Resolve in the inadequate-substitute arm.
2. Resolve in the adequate-substitute arm.
3. Resolve in the selected-profile's-own-seat arm and compare it with the delivered control `TC-PROFILE-010` (unedited, not renumbered).

**Expected Outcome**:
- **Inadequate-substitute arm**: the substitute profile is **not used as a source at all**; the capability gate is preserved by the substitute simply not being used (no model from the inadequate seat is emitted, and no capability classification is emitted for the substitute). Because no valid substitute exists, the resolution refuses `provider.profile.unavailable` (exit-2 identity), naming the seat and the recorded-unavailable provider in the bounded `summary` — this arm is governed by `AC-F3-2`, not `AC-F3-1`.
- **Adequate-substitute arm**: the substitution proceeds and the emitted model satisfies the required capability (`AC-F3-1`).
- **Delivered-control arm**: the selected profile's **own** capability-inadequate seat still yields the delivered `provider.profile.capability-denied` with the capability blocker and the delivered precedence — identical to `TC-PROFILE-010`, which remains the authority for that identity.
- In every arm the capability blocker `kind` and precedence are the delivered ones and no park cause changes the reason.

**Notes / Clarifications**:
- This split removes the DoR finding-1 overlap: `AC-F3-1` covers the successful substitution with a capability-adequate substitute; `AC-F3-2` covers the no-valid-substitute refusal, whether the disqualifier is ineligibility, an undeclared seat, or a capability-inadequate model. `capability-denied` is reserved for the selected profile's own seat.

#### TC-PROFILE-070 - No valid substitute refuses `unavailable`, naming seat and provider, list unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, EVT-2, DM-2, NFR-6, DEC-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- An injected fixture policy document (not the committed `.jaiship/config.yaml`, `GAP-T4`) whose **selected profile is `eligible` on its declared `providers`** while one effective seat model names a parked provider **outside** that list; no later profile is a valid supplier after substitution inspection — each is ineligible under the same probe, does not declare that seat, or declares it only on a capability-inadequate model.
- The refusal under test is the **seat-level** one, not the all-profiles-ineligible one: the selected profile's declared providers are all available.
- A recording event sink is installed so the refusal path's event emissions (if any) are observable, and a recording spawn port so a call would be visible.

**Steps**:
1. Call `resolveProfileForSpawn` (and `runProfileSpawn` with a recording port).
2. Inspect the refusal code, the bounded `summary`, the eligibility list, the recorded events and whether any record was built.

**Expected Outcome**:
- `ok === false`, `code === "provider.profile.unavailable"`.
- The bounded `summary` names **both** the seat and the parked provider.
- The delivered `eligibility` list is **carried unchanged**: the selected profile remains `eligible`, every later profile remains `shadowed`, **no blocker is appended to any entry and no verdict flips**. The list reports selection-time verdicts only — the selection pass never probed the later profiles — and the substitution search inspected candidates separately through the same memoized probe **without writing a candidate verdict** into the list, so a candidate stays `shadowed` and substitute eligibility is not readable from it.
- **No profile event of any kind is emitted**: `profile.selected`, `profile.ineligible`, `profile.switched`, `profile.reverted` and `profile.rung-changed` are all absent, and any selection-time event computed before the seat check is discarded on this path. The refusal envelope is the only evidence, and no new event code, condition or evidence key appears (EVT-2, DEC-8).
- `decision`/`envRecord` is absent; no fallback model is invented for the unsatisfiable seat.
- The spawn port is never called.

#### TC-PROFILE-071 - The seat-level refusal projects the delivered `data` envelope at exit 2 with no profile event

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-3, AC-F3-2, EVT-2, NFR-6, DM-2, DEC-8, GAP-T4
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-edge-wiring.test.ts`
**Tags**: @backend, @integration, @provider

**Preconditions**:
- An **injected fixture policy document** (not the committed `.jaiship/config.yaml`) served through the injected `fs.readText` double, whose selected profile is **`eligible` on its `providers`** while one effective seat model names a parked provider **outside** that list, and no later profile supplies that seat on an available provider. Same fixture family as `TC-PROFILE-070`.
- The refusal under test is the **seat-level** one, not the all-profiles-ineligible one. The committed document is kept for `AC-F1-1`/`AC-F1-2` only (`TC-PROFILE-059`, `TC-PROFILE-060`, `TC-PROFILE-089`, `TC-PROFILE-090`) and cannot express this state.
- A temp state store, an injected clock outside every declared peak, and an event sink that observes every emitted profile event.

**Steps**:
1. Run `provider profile resolve --agent pm --for-spawn --json`.
2. Parse the envelope and read `outcome`, `code`, `summary`, `eligibility`, `events`; assert `error` is absent and `data` is present.
3. Inspect the event sink and the state store's key set, and read the target record before and after the run.

**Expected Outcome**:
- Exit code **2**, projected through the delivered `platform-provider` projection read from `ERROR_TABLE` — asserted together with the projection shape of the delivered control `TC-POL-NOM-002`, which already proves this identity ships as a `data` envelope at exit 2.
- **`data` is present and `error` is absent**: `data.outcome === "refused"` and `data.code === "provider.profile.unavailable"`. This case must not assert an `error` envelope and must not assert absent `data` (spec §8.5).
- `data.summary` names **both** the seat and the parked provider, within the profile evidence caps (≤ 20 fields, ≤ 1024 bytes, ≤ 128-byte strings, ≤ 8 items, ≤ 96-byte items) and carrying no credential, authorization header, userinfo or raw body.
- `data.eligibility` is the **unchanged selection-time list**: the selected profile is `eligible`, every later profile is `shadowed`, no blocker is appended to any entry and no verdict flips. The list is not re-verdicted by the substitution search, so a candidate stays `shadowed` and substitute eligibility is not readable from it.
- `data.events` is empty of profile events: `profile.selected`, `profile.ineligible`, `profile.switched`, `profile.reverted` and `profile.rung-changed` are all absent, and any selection-time event computed before the seat check was discarded. The event sink records no profile emission for this run. The refusal envelope is the only evidence, and no new event code appears.
- No env record and no serialized `data-v1` record appears on any stream (stdout, stderr or the state store).
- Zero park, announcement and target writes: the state store's key set is byte-identical before and after, and the target record is unchanged.

**Notes / Clarifications**:
- The expected projection here is a **contract, not a new behaviour**: the delivered `data` refusal envelope is what `provider profile resolve` already returns for this identity, so a coder must neither introduce an `error` envelope nor rely on absent `data` to reach exit 2 (§8.5, AC-F3-2).

#### TC-PROFILE-072 - The env record and the spawn binding agree for every seat

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-3, F-4, AC-F4-1, DM-3, DM-5, NFR-1
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-spawn.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A fact matrix: the committed policy for the healthy and z.ai quota-park arms, and the injected fixture policies for the stale-observation arm and the substitution fixture of `TC-PROFILE-066` (`GAP-T4`).
- For each fact set, the same composed probe and clock are used for the env record and the binding.

**Steps**:
1. For every fact set, resolve `--for-spawn` and capture `decision.seatModels`, the env record entries and `variables`.
2. For every declared seat, compare the env-record `set` value with `decision.seatModels[seat]`.
3. Build the per-spawn binding with the delivered `buildHarnessSpawnEnvironment` for each agent that targets a seat and compare its model with the same map value.
4. For each emitted value, split the `provider/model[#variant]` expression at the first `/` and probe that provider.

**Expected Outcome**:
- Every seat's env-record value equals its `seatModels` value and the binding's value for that agent — one string, three surfaces.
- Every emitted value's provider segment is available under the same probe verdict; no value names a provider with an active park or a stale observation.
- No second derivation exists: changing one map entry changes all three surfaces in the same run.

#### TC-PROFILE-073 - Emission is all-or-nothing

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-spawn.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- An injected fixture policy (`GAP-T4`) in which every seat but one is satisfiable and the last seat cannot be supplied by any profile.

**Steps**:
1. Resolve `--for-spawn` and run `runProfileSpawn` with a recording port.
2. Inspect the outcome, the record and the recorded environments.

**Expected Outcome**:
- `ok === false`; `decision.envRecord` and the serialized record are absent; no variables are produced.
- The recording port received zero environments — no partial record, no placeholder value and no inherited parent value.
- The refusal names the unsatisfiable seat and its provider.

#### TC-PROFILE-074 - Dispatch nomination agrees with the CLI verdict over a seat-level fixture

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-1, RSK-6, GAP-T4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-nomination-admission.test.ts`
**Tags**: @backend, @integration, @provider

**Preconditions**:
- A `DispatchNominatePort` composed from the same probe factory, configuration, park facts, observation facts and clock as the CLI resolution — not a second probe.
- A dispatch harness from `tests/fixtures/dispatch/harness.ts` with its temp store.
- Two fixture families: the committed-policy facts for the **selection** parity arms (healthy, z.ai quota park, stale observation), and the **injected fixture policy of `TC-PROFILE-070`** — selected profile `eligible` while one seat model names a parked provider outside its list — for the **refusal** parity arm. The committed document cannot express the seat-level refusal (`GAP-T4`).

**Steps**:
1. For the healthy, quota-park and stale fact sets, run the CLI resolution and capture `profile`; for the seat-level fixture, capture the refusal code and the unchanged eligibility list.
2. Drive `runDispatch` with the nomination port over the same facts.
3. Compare the nominated profile (or refusal identity and eligibility) with the CLI verdict.
4. Cross-check the delivered identity parity against the unedited control `TC-PAUSE-002`.

**Expected Outcome**:
- **Selection parity arm**: the nominated profile equals the CLI `profile` for every resolving fact set.
- **Refusal parity arm**: the nomination refusal code is `provider.profile.unavailable` and its eligibility equals the CLI refusal's **unchanged** eligibility (selected `eligible`, later `shadowed`, no blocker appended, no verdict flip); the seat and provider are named in the bounded summary.
- Both consumers report the same provider availability; the run appends no park or announcement record.

**Notes / Clarifications**:
- The parity arm under test is **both** the selection (resolving fact sets) and the refusal (the seat-level fixture); the case is labelled Integration because it drives the dispatch admission path, not a pure-domain predicate.

#### TC-PROFILE-075 - Advancing past expiry restores the preferred profile

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, EVT-3, NFR-2, DM-1
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @integration, @provider

**Preconditions**:
- Committed policy (or the equivalent `delivery` → `paid` fixture), a temp state store with an active `quota-exhausted` park for z.ai expiring at `T`, and an injected clock at `T - 1` then `T + 1`.

**Steps**:
1. Resolve at `T - 1` and assert the paid selection.
2. Advance the injected clock to `T + 1` with no configuration edit and no timer.
3. Resolve again and inspect the profile, env record, events and the state store.

**Expected Outcome**:
- Second resolution selects `delivery` and emits the z.ai seat models again; the delivered `profile.reverted` lifecycle event appears once with the delivered evidence shape.
- No `profile.switched`/`profile.reverted` duplication on a third run.
- No park, announcement or cleared record was appended; the only write is the delivered target-record persistence for the change.

#### TC-PROFILE-076 - The park is inactive at exactly its expiry

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-5, DM-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- One active park record with `expiresAtMs = T`.

**Steps**:
1. Fold the ledger at `nowMs = T - 1`, `nowMs = T`, and `nowMs = T + 1`.
2. Probe the provider at each instant and run the selection.

**Expected Outcome**:
- `T - 1`: park view state `active`, provider unavailable with the park cause.
- `T`: park view state `expired`, provider available, preferred profile selected — the boundary value is inactive, not active.
- `T + 1`: identical to `T`.
- Zero writes and zero expiry records at every instant.

#### TC-PROFILE-077 - A cleared condition restores the profile before expiry

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-5, AC-F5-1, EVT-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A park generation for z.ai followed by a `cleared` record from `clearParkRecord` whose `expiresAtMs` is still in the future, so only the clear — not the clock — can change the verdict.

**Steps**:
1. Fold and probe before the clear record exists.
2. Fold and probe with the cleared record as the latest record for that park name.
3. Resolve and compare with `TC-PROFILE-075`'s post-expiry result.

**Expected Outcome**:
- Before: park active and provider unavailable.
- After: the fold selects the cleared generation, the provider is available, `delivery` is selected, and the z.ai seats are emitted again with no configuration edit.
- Zero writes and zero new records.

#### TC-PROFILE-078 - A never-parked state yields the identical decision

**Scenario Type**: Corner Case
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: F-5, AC-F5-1, NFR-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- Two stores at one clock instant `T`: one whose only park for z.ai expired at `T`, one that never contained a park for z.ai.
- Identical configuration, identical empty observation set, identical injected run id.

**Steps**:
1. Resolve from both stores.
2. Normalize both envelopes (drop volatile run metadata) and compare.

**Expected Outcome**:
- Decision, eligibility verdicts, blockers, emitted models, env record and exit code are identical.
- Neither resolution writes a park or announcement record.

#### TC-PROFILE-079 - The read writes no park, announcement or cleared record

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-2, DM-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/behaviour/provider-profile-edge-wiring.test.ts`
**Tags**: @backend, @integration, @provider

**Preconditions**:
- A recording state-store port (or a full key/value snapshot with `mtimeNs`) over a temp root, seeded with park and announcement records.
- The full read-only matrix: healthy, quota park, stale observation, substitution, refusal.

**Steps**:
1. Capture the seeded key set, each record's bytes and `mtimeNs`, and the park/announcement record counts.
2. Run every read-only resolution.
3. Re-read the same surface and compare; count writes per record kind.

**Expected Outcome**:
- Zero writes to any `provider.park`, `provider.announcement` or cleared-record key; the only allowed write is the delivered `provider.profile-target` persistence on switch/revert.
- Seeded park and announcement records are byte-identical, including their expiry fields.
- No delete, no clear and no expiry write occurs.

#### TC-PROFILE-080 - The eight-cause table pins every cause and its subject

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DEC-2, Appendix A
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-contract.test.ts`, fixture `tests/fixtures/provider/profile/parks/cause-taxonomy.ts`
**Tags**: @backend, @contract

**Preconditions**:
- The new data-only fixture maps every `PARK_CAUSES` member to `{subject, attributable, effect}` reproducing spec Appendix A.

**Steps**:
1. Compare the fixture's key set with `PARK_CAUSES` in both directions.
2. Assert the classification: `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected` are provider-attributable; `chain-exhausted` (subject `chain:<name>`) and `reevaluation-cap` are not.
3. Assert `budget-exhausted` carries both scope facts (`window` → park with durable expiry, consumed; `ticket` → entry failure, no park, not readable).

**Expected Outcome**:
- Set equality holds: 8 causes, 6 attributable, 2 chain-level, and every cause has a non-empty subject and effect.
- `chain-exhausted` names a chain subject; no attributable cause is classified as able to clear a provider.
- A missing row or an extra row fails naming the cause.

#### TC-PROFILE-081 - Chain-level causes never block and never clear a provider

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, DEC-2, RSK-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- Recorded state with an active `chain-exhausted` park on `chain:default`.
- Recorded state with an active `reevaluation-cap` park recorded on a **provider** subject, to prove classification is by cause and not by park-name prefix.
- A co-present active `quota-exhausted` park for the same provider in one arm.

**Steps**:
1. Probe and select over the `chain-exhausted`-only state; compare with the no-park state.
2. Probe and select over the provider-subject `reevaluation-cap` state.
3. Probe and select over the state where `reevaluation-cap` and `quota-exhausted` coexist for one provider.

**Expected Outcome**:
- The chain park and the loop-cap park each leave every provider available; decision, eligibility and emitted models equal the no-park case.
- In the coexistence arm the provider is unavailable **for `quota-exhausted` only** — the loop-cap park neither blocks nor clears the provider's own park.
- No blocker value is `chain-exhausted` or `reevaluation-cap` in any profile eligibility entry.

#### TC-PROFILE-082 - `budget-exhausted` window scope is consumed, ticket scope is not readable

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NG-6, Appendix A
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`, `tests/behaviour/provider-parks.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- Window arm: a provider-subject `budget-exhausted` park with a durable future expiry.
- Ticket arm: the state produced by a `ticket`-scope ceiling crossing — asserted to contain no park record for the entry.

**Steps**:
1. Window arm: probe and select; assert the provider is unavailable with blocker value `budget-exhausted`.
2. Ticket arm: assert the store holds no park and no fabricated expiry for the entry, then probe and select; compare with the clear-provider case.
3. Assert the profile path performed no spend read and no work-item-ref read (throwing port never called).

**Expected Outcome**:
- Window arm: consumed as an eligibility input; next eligible profile selected; no env-record value on that provider.
- Ticket arm: the provider is not blocked by this path because nothing is readable; the decision equals the clear case, and the delivered chain-resolver refusal is unchanged (cross-reference `TC-PROFILE-084`).
- Zero spend reads, zero ref reads, zero writes.

#### TC-PROFILE-083 - Taxonomy drift fails by name, not by silence

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-6, AC-F6-1, Appendix A
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/provider-contract.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- The classification fixture and a temp-copy mutation helper (the delivered pattern in `TC-PROV-001`).

**Steps**:
1. Drive the comparator over five mutated tables: a cause added without a row; a row removed; a chain-level cause reclassified as attributable; a verdict that would ignore a cause; a cause marked as clearing a provider.
2. Assert each mutation is rejected with the offending cause named.

**Expected Outcome**:
- Each mutation fails with the cause name in the message; no arm passes by returning an empty diff.
- The unmutated table passes, proving the comparator is non-vacuous in both directions.

#### TC-PROFILE-084 - `provider resolve` keeps its skip, park, next-eligible time and generation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, G-5, RSK-10, A-9
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-parks.test.ts`; payload-key control in `tests/behaviour/provider-cli.test.ts` (`TC-PROV-041`, unedited)
**Tags**: @backend, @integration, @provider

**Preconditions**:
- The AC-F1-1 recorded facts: z.ai active `quota-exhausted` park with the reset instant, DeepSeek clear.
- A temp state store and the injected clock, running the mutating `provider resolve` path.

**Steps**:
1. Run `provider resolve` with persistence and capture the decision, `skipped`, `parks`, and the persisted records.
2. Assert the skip reason, the park cause and the next-eligible time.
3. Re-derive the park's identity and generation from the same inputs with the delivered identity function and compare with the persisted record.
4. Run the delivered payload-key control.

**Expected Outcome**:
- `zai-coding-plan` is skipped with `reason === "quota-exhausted"`; the provider park is reported with cause `quota-exhausted` and a next-eligible time equal to the recorded reset instant (`waitSeconds` consistent with `floor`).
- DeepSeek is selected; the resolve payload keys are exactly the delivered ones (`TC-PROV-041` unchanged).
- The persisted park generation is deterministically reproduced from the same inputs; exactly one generation for the name, no new record kind and no change to any other parked name.

**Notes / Clarifications**:
- The "same as before this change" clause is asserted as a tree invariant per `GAP-T2`, never as a diff against a base branch.

#### TC-PROFILE-085 - Chain resolution with no parks and the closed skip set are unchanged

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-3
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-chain-resolution.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A configuration with no park record for any entry and the delivered skip-precedence table.

**Steps**:
1. Re-run the delivered chain-resolution arms (declared order, paid-fallback refusal, every closed skip reason, eligibility) as unedited controls.
2. Assert `PROVIDER_SKIP_REASONS` and `PARK_CAUSES` exactly equal their inventories and that the profile path introduces no reason.
3. Assert the profile resolution with no parks produces no `skipped` entry and no park object.

**Expected Outcome**:
- Every delivered selection and skip outcome is unchanged; no reason was added, renamed or reordered.
- The profile path adds no park, no announcement and no skip reason.
- Cross-references `TC-PROFILE-065` for the set equality and `TC-PROFILE-084` for the parked case.

#### TC-PROFILE-086 - Three runs and two compositions agree; zero network, credential or sleep

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR1-1, NFR-1, RSK-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-profile-hermetic.test.ts`, `tests/behaviour/provider-profile-edge-wiring.test.ts`
**Tags**: @backend, @checks, @provider

**Preconditions**:
- Two independently constructed compositions (separate program, separate temp store seeded identically, separate injected clock at the same instant) and a fixed injected `newRunId`.
- Spies or throwing fakes on `fetch`, the credential port, the sleep port and the transport.

**Steps**:
1. For each fact set (quota park, healthy, stale, substitution, refusal), run three times on composition A and three times on composition B.
2. Normalize envelopes by stripping only documented volatile fields and compare decisions, eligibility, emitted models, event identities and refusal codes.
3. Assert the spies were never called and the store's write set is only the delivered target persistence.

**Expected Outcome**:
- All six runs per fact set are identical.
- `fetch` was never called, the credential port never resolved, the sleep port never slept, the transport never sent.
- No ambient clock read occurs on the evaluated path (source scan arm from `TC-PROFILE-054` retained).

#### TC-PROFILE-087 - One fold read and memoized probes over one hundred providers

**Scenario Type**: Corner Case
**Impact Level**: High
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-4, NFR-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-profile-hermetic.test.ts`, `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @checks, @provider

**Preconditions**:
- A 100-provider configuration with several profiles and many seats, a recording park-fold read port, and a recording availability probe.

**Steps**:
1. Run one selection pass and one `--for-spawn` resolution.
2. Count fold reads per resolution and probe calls per distinct provider.
3. Add seats targeting already-probed providers and re-run, asserting no extra fold read.
4. Run the construction census: locate every `createResolvedProviderProbe` construction and assert exactly three — the profile-resolve edge handler, the spawn-context helper (`resolveProfileContextFrom`) and the dispatch nomination predicate — with no fourth site and no second availability derivation.

**Expected Outcome**:
- Exactly one verified fold read per resolution, independent of provider, profile and seat count.
- At most one probe per distinct provider per pass; no per-seat park read.
- The construction census finds one factory at exactly three call sites, with no fourth site and no second availability derivation (DOD-4, RSK-6).
- The delivered `TC-PROFILE-015` wall-clock bound remains the timing control and is not re-baselined.

#### TC-PROFILE-088 - A failed fold read is a named unavailable verdict

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR1-1, NFR-7, RSK-1, DEC-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- A park-fold port returning a delivered `state.*` failure; a provider otherwise declared, enabled and peak-free.

**Steps**:
1. Build the probe with the failing fold and probe the provider.
2. Run the selection and the `--for-spawn` resolution.
3. Inspect the code, the blocker and the written state.

**Expected Outcome**:
- The verdict is `available: false` through the delivered probe-failure path; the blocker is a `condition` with a delivered value (never `clear`, never a silent pass).
- When nothing is eligible the delivered `provider.profile.unavailable` refusal is returned; no new error identity, no internal crash, no stack trace on stdout.
- Zero writes; the failure is not cached into a later resolution.

#### TC-PROFILE-089 - Golden `--for-spawn` envelope under a quota park

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-7, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/provider-profile-resolve.test.ts`, fixture `tests/fixtures/provider/profile/golden/{data.ts,profile-resolve*.json,profile-resolve*.txt}`
**Tags**: @backend, @golden, @provider

**Preconditions**:
- A recorded-park fixture for the quota-park facts, and a golden runtime whose `profileResolve` returns the result of the **pure `selectProfile`** over that fixture's recorded-park probe — not a canned literal — so the pinned bytes come from the same verdict the behaviour cases assert.

**Steps**:
1. Run the golden invocation with `--for-spawn` against the recorded-park fixture.
2. Compare normalized JSON and text output with the committed golden.
3. Assert the envelope key list.

**Expected Outcome**:
- The envelope selects `paid`, carries the `quota-exhausted` blocker on `delivery`, and emits the DeepSeek PM model.
- Keys are exactly the delivered set with no new key; the golden is byte-stable across repeats.
- Regeneration happens only by the documented command and appears as a deliberate review diff.

#### TC-PROFILE-090 - Golden envelope under healthy facts matches the delivered selection

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-7, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/provider-profile-resolve.test.ts`
**Tags**: @backend, @golden, @provider

**Preconditions**:
- The delivered healthy golden (`profile-resolve.json`, `profile-resolve.txt`) and the current selection over zero parks and zero observations.

**Steps**:
1. Compare the current normalized output with the delivered golden.
2. Assert the delivered golden file is unchanged by this change.

**Expected Outcome**:
- Zero differences: the no-facts path renders exactly as delivered (`AC-F1-2`, §8.5).
- The env record under healthy facts names the z.ai PM seat.

#### TC-PROFILE-091 - `profile.selected` carries the park cause in bounded evidence

**Scenario Type**: Happy Path
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: EVT-1, AC-F1-1, NFR-6, DM-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`, `tests/checks/provider-profile-evidence-bounds.test.ts`
**Tags**: @backend, @contract, @provider

**Preconditions**:
- The quota-park selection from `TC-PROFILE-061`.

**Steps**:
1. Read the `profile.selected` event from the decision.
2. Inspect its `evidence.blockers`, `evidence.reason`, code, severity and identity.
3. Serialize and compare with the evidence caps.

**Expected Outcome**:
- `evidence.blockers` contains `condition:quota-exhausted` (delivered string form) and no new evidence key.
- `evidence.reason === "selection"`; the code, severity and identity derivation are unchanged.
- The serialized event is within ≤ 20 fields, ≤ 1024 bytes, ≤ 128-byte strings, ≤ 8 items, ≤ 96-byte items.

#### TC-PROFILE-092 - `profile.ineligible` names park causes and `watch-stale`; capability precedence holds

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: EVT-2, AC-F2-1, AC-F3-1, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @contract, @provider

**Preconditions**:
- Three arms: every profile blocked by park causes; every profile blocked by a stale observation; every profile blocked only by a capability blocker. A fourth mixed arm blocks by capability and a condition together.

**Steps**:
1. Run the selection in each arm and read the refusal code and the `profile.ineligible` event.
2. Inspect `evidence.reason` and `evidence.blockers`.

**Expected Outcome**:
- Park cause arms: `reason === "no-eligible-profile"`, blockers name each profile and cause, including `watch-stale` in the stale arm; code `provider.profile.unavailable`.
- Capability-only arm: `reason === "capability-gate"`, code `provider.profile.capability-denied` — the delivered precedence.
- Mixed arm: `reason === "no-eligible-profile"` (capability-only precedence requires *every* blocker to be a capability blocker).
- All evidence stays within the profile caps.

#### TC-PROFILE-093 - New blocker and refusal evidence is bounded and secret-free

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: NFR-6, DM-2, AC-F3-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/provider-profile-evidence-bounds.test.ts`, `tests/checks/provider-profile-hermetic.test.ts`
**Tags**: @backend, @checks, @provider

**Preconditions**:
- A canary credential value, an authorization header, an endpoint with userinfo and a raw response body, each planted where a careless implementation might echo it.
- Any new module added to the profile tier registered in the hermetic suite's `profileSources` with a non-zero floor.

**Steps**:
1. Produce the new blocker, the refusal summary and the eligibility entries from the parked, stale and refusal paths.
2. Serialize every envelope, event, refusal and diagnostic and scan for the canaries.
3. Run the ambient-globals scan, the forbidden-literal scan and the `node:`/`bun:`/`Date.now`/`process.env` source scan over the profile tier.

**Expected Outcome**:
- Every new evidence value is within the profile caps.
- No canary, header, userinfo or raw body appears on any surface; the canary scanner is itself driven over a planted string so it cannot pass vacuously.
- The ambient-globals and source scans are clean with a non-zero source floor.

#### TC-PROFILE-094 - The seat gate is not widened: undeclared, disabled or peak-parked seat provider keeps delivered behaviour

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, NFR-7, §8.5, §7.2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-selection.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- Zero park records and zero supplied observations.
- An injected fixture policy whose selected profile is eligible on its declared `providers`, while one effective seat model names a provider **outside** that list in three arms: (a) the provider is undeclared; (b) it is declared but disabled; (c) it is inside its declared peak window.
- Because the seat provider is outside the profile's `providers`, the profile-level eligibility is unaffected; this is exactly the boundary the seat gate must not cross.

**Steps**:
1. Resolve `--for-spawn` for the agent that targets the seat in each arm.
2. Read `outcome`, `profile`, `eligibility`, `decision.seatModels`, the env record and the exit code.
3. Compare each arm with the delivered baseline resolution in which the seat provider is declared, enabled and out of peak.

**Expected Outcome**:
- Exit 0 and `outcome === "selected"` in every arm; the seat is **neither substituted nor refused**.
- The emitted and bound value is the delivered effective seat model, unchanged.
- The eligibility verdicts equal the delivered profile-level verdicts (selected profile `eligible`, later profiles `shadowed`); no `watch-stale` and no park blocker appears.
- No `provider.profile.unavailable` refusal and no new refusal identity; the seat gate is proven not widened beyond recorded unavailability.

**Notes / Clarifications**:
- This is the regression boundary for `AC-F3-3`: it fails if a seat re-check consults declaration, enablement or the declared peak window. It is deliberately not a park or stale arm (those are `TC-PROFILE-066`/`TC-PROFILE-067`).

#### TC-PROFILE-095 - Staleness is per declared target; a provider with no declared target is never stale

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5, DM-7, §8.6, TDR-0075 C-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- Provider A declares one `provider.profiles.watch.<name>` target with a **short** `maxAgeSeconds`; provider B declares one such target with a **long** `maxAgeSeconds`; provider C declares **no** watch target. All three are declared, enabled, peak-free and carry no park record.
- The delivered `provider.profiles.watch` shape declares at most one target per provider name, so differing bounds are expressed across providers, not as two targets on one provider.
- One composition-supplied observation instant is keyed by provider name (DM-7), shape `{ condition, observedAtMs }`. At the same `nowMs`, A's `ageSeconds` is at or above its short bound (for example age 120 s against a 60 s bound) and B's `ageSeconds` is below its long bound (the same 120 s against a 900 s bound), so A is stale, B is fresh and C is never stale at that one instant.
- **Honesty note**: no production composition supplies a stale observation today (spec §8.6, A-10); the observation is injected.

**Steps**:
1. Probe A and B at the same `nowMs` and read each provider verdict and its blocker.
2. Probe C with the same old observation instant and read its verdict.
3. Choose an observation instant one second below A's short bound and probe A again.

**Expected Outcome**:
- At `nowMs`, A is unavailable with a `watch-stale` blocker whose bounded `detail` names A's declared target, the observed age and its short bound; B is available at the identical age because its own long bound is not reached; C is available with no `watch-stale` blocker, because it declares no watch target — an old global instant never makes an undeclared-target provider stale.
- A stale declared target blocks only its own provider: B fresh alongside A stale at one instant is what a single global bound cannot produce.
- One second below A's bound, A becomes available; the per-target predicate has no off-by-one.
- The negative readings this shape must fail are `TC-PROFILE-097`'s: one global instant, staleness for an undeclared target, and all-providers-stale.

**Notes / Clarifications**:
- This case pins §8.6's "per declared target, that target's own bound" and "no declared watch target ⇒ never stale" in one three-provider fixture, so a single global instant or a single global bound fails here; `TC-PROFILE-097` names the wrong readings directly.

#### TC-PROFILE-096 - Only freshness is consumed: a condition that derived a park is that park

**Scenario Type**: Corner Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, DM-7, §8.6, TDR-0075 D1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- Arm A: a provider declares a watch target and carries an active provider-attributable park whose cause the recorded condition produced; the composition supplies a **fresh** observation `{ condition: <that same condition>, observedAtMs: nowMs }` (age 0) keyed by provider.
- Arm B: the same provider with **no** park and a **fresh** observation whose `condition` is not `clear` (a condition value that persisted no park).

**Steps**:
1. Probe the provider and run the selection in arm A; count blockers and read the blocker value.
2. Probe in arm B; read the verdict and blockers.
3. Compare arm A with a run where the observation is absent.

**Expected Outcome**:
- Arm A: exactly **one** `condition` blocker, whose value is the park cause; the observation's condition value is not re-derived into a second `watch-stale` blocker, and the provider verdict equals the park-only verdict. The condition that derived a park is consumed as that park.
- Arm B: the provider is available with zero blockers; a fresh observation contributes only freshness and its non-`clear` condition value mints no blocker (no invented outage, no invented stale).
- In both arms the observation contributes no state write, no fetch and no second blocker.

#### TC-PROFILE-097 - The three excluded freshness readings fail by name

**Scenario Type**: Negative
**Impact Level**: High
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-3, NFR-5, §8.6, TDR-0075 C-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-profile-probes.test.ts`
**Tags**: @backend, @provider

**Preconditions**:
- The per-target staleness predicate and a comparator harness over deliberately wrong variants (the delivered mutation pattern of `TC-PROFILE-083`).
- Three excluded variants, each materially different from §8.6: **V1** one global observation instant applied to every provider as if each had the same bound; **V2** a staleness verdict for a provider that declares no watch target; **V3** "all providers are stale when a global observation is old".
- A fixture where the correct per-target verdict differs from each variant, so no arm can pass vacuously.

**Steps**:
1. Drive the comparator over V1, V2 and V3 in turn.
2. Assert each variant is rejected with a message naming that reading.
3. Run the unmutated per-target rule and assert it passes.

**Expected Outcome**:
- Each excluded reading fails by name — a distinct identifier such as `global-instant`, `undeclared-target-stale` and `all-providers-stale` appears in the failure, so the three cannot be confused with one another.
- No arm passes by returning an empty diff; the correct rule passes, proving the comparator is non-vacuous in both directions.
- No excluded reading adds a vocabulary member; `TC-PROFILE-065` remains the closure authority.

## 6. Environments and Test Data

- **Runtime**: Bun with `bun:test`; Node-compatible APIs only where the delivered suites already use them. No new dependency.
- **Platform matrix**: one Linux runner; no OS-specific assertion is introduced. Peak evaluation uses `UTC` zone facts or the injected `ProviderZoneFacts`, never host zone data.
- **State isolation**: every store-backed case builds a temp root with `makeTempRoot(...)`, opens it with `openStore(makeIdentity(root))`, and removes it in `afterEach`. No case touches the developer's real state directory or the repository's `.jaiship` state.
- **Committed policy**: read once per suite from `.jaiship/config.yaml` as text and served through the injected `fs.readText` double; a SHA-256 is asserted unchanged after every run. The file is never opened for writing, and no case asserts against an edited copy. The committed document is the fixture for `AC-F1-1`/`AC-F1-2` only (`TC-PROFILE-059`, `TC-PROFILE-060`, `TC-PROFILE-089`, `TC-PROFILE-090`).
- **Fixtures for the seat-level criteria**: `AC-F3-1`..`AC-F3-3` use injected fixture policy documents (data modules under `tests/fixtures/provider/profile/selection/`) served through the same `fs.readText` double, because the committed policy cannot express a seat whose provider is outside the selected profile's list. The document's selected profile is `eligible` on its `providers`; only a seat model is recorded-unavailable (`GAP-T4`).
- **Operator-local slot**: no fixture creates `config.local.yaml`; the file-system double records `exists` probes and `readText` content reads separately. `TC-PROFILE-059` asserts **zero `readText` (content) reads of any `config.local.yaml` path** and that no local layer contributed a source or value. The delivered existence probe is acquisition behaviour, not "consulting" the override (`GAP-T3`).
- **Park and observation fixtures**: parks are built with `createParkRecord` / `clearParkRecord`; observations are a composition-supplied map **keyed by provider name** with shape `{ condition, observedAtMs }` (DM-7). Expiry and observation instants are absolute milliseconds from the injected clock, never from the wall clock. No observation is persisted or written.
- **Honesty about the stale path**: no production composition supplies a stale observation today (spec §8.6, A-10). The staleness arms inject the observation directly at the probe seam and say so in their preconditions; they never claim a steady-state production input.
- **Clock**: always injected. Every evaluation instant is chosen to be outside the declared entry and profile peak windows, and the fact is asserted with `evaluatePeakWindow` rather than assumed.
- **Hermeticity**: `fetch` spied, credential port replaced by a counter or throwing fake, sleep port throwing, transport throwing, and a canary string planted for the redaction arms. No live z.ai or DeepSeek call, no real credential read, no real sleep.
- **Sleep**: the suite makes zero real sleeps; the only sleep seam present is the delivered `ProviderSleep` fake.
- **Temp directory**: `TMPDIR=$PWD/tmp/tmpdir` for every recorded gate command, so `mkdtempSync` roots and Bun's scratch files land inside the repository's ignored `tmp/` rather than a constrained system temp.
- **Golden data**: committed under `tests/fixtures/provider/profile/golden/`; regeneration is an explicit documented command and a reviewed diff, never a blanket rewrite.
- **Gate evidence**: final verification is `TMPDIR=$PWD/tmp/tmpdir pnpm check`, preceded by the targeted suites named in §7. The supplementary pre-PR commit-message gate `./scripts/lint-commit-range.sh --base main-tools` is recorded as command evidence only and is not a test case.

## 7. Automation Plan and Implementation Mapping

Execution commands assume the repo root. `TMPDIR=$PWD/tmp/tmpdir` is applied to every recorded invocation.

| TC ID | Test file | Implementation status | Execution command |
|---|---|---|---|
| TC-PROFILE-059 | `tests/behaviour/provider-profile-edge-wiring.test.ts` | Existing – Update | `bun test tests/behaviour/provider-profile-edge-wiring.test.ts` |
| TC-PROFILE-060 | `tests/behaviour/provider-profile-edge-wiring.test.ts` | Existing – Update | same |
| TC-PROFILE-061 | `tests/behaviour/provider-profile-selection.test.ts` | Existing – Update | `bun test tests/behaviour/provider-profile-selection.test.ts` |
| TC-PROFILE-062 | `tests/behaviour/provider-profile-probes.test.ts` | Existing – Update | `bun test tests/behaviour/provider-profile-probes.test.ts` |
| TC-PROFILE-063 | `tests/behaviour/provider-profile-probes.test.ts` | Existing – Update | same |
| TC-PROFILE-064 | `tests/behaviour/provider-profile-probes.test.ts` | Existing – Update | same |
| TC-PROFILE-065 | `tests/structure/provider-contract.test.ts`, `tests/structure/provider-profile-contract.test.ts` | Existing – Update | `bun test tests/structure/provider-contract.test.ts tests/structure/provider-profile-contract.test.ts` |
| TC-PROFILE-066 | `tests/behaviour/provider-profile-selection.test.ts` + `tests/fixtures/provider/profile/selection/fixtures.ts` | Existing – Update (adds the declared-seat and no-park-control arms) | as `TC-PROFILE-061` |
| TC-PROFILE-067 | `tests/behaviour/provider-profile-selection.test.ts` | Existing – Update | same |
| TC-PROFILE-068 | `tests/behaviour/provider-profile-selection.test.ts` | Existing – Update | same |
| TC-PROFILE-069 | `tests/behaviour/provider-profile-selection.test.ts` | Existing – Update | same |
| TC-PROFILE-070 | `tests/behaviour/provider-profile-selection.test.ts` | Existing – Update | same |
| TC-PROFILE-071 | `tests/behaviour/provider-profile-edge-wiring.test.ts` + injected fixture policy `tests/fixtures/provider/profile/selection/fixtures.ts` | Existing – Update | as `TC-PROFILE-059` |
| TC-PROFILE-072 | `tests/behaviour/provider-profile-spawn.test.ts` | Existing – Update | `bun test tests/behaviour/provider-profile-spawn.test.ts` |
| TC-PROFILE-073 | `tests/behaviour/provider-profile-spawn.test.ts` | Existing – Update | same |
| TC-PROFILE-074 | `tests/behaviour/provider-nomination-admission.test.ts` | Existing – Update | `bun test tests/behaviour/provider-nomination-admission.test.ts` |
| TC-PROFILE-075 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | Existing – Update | `bun test tests/behaviour/provider-profile-park-switch-revert.test.ts` |
| TC-PROFILE-076 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | Existing – Update | same |
| TC-PROFILE-077 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | Existing – Update | same |
| TC-PROFILE-078 | `tests/behaviour/provider-profile-park-switch-revert.test.ts` | Existing – Update | same |
| TC-PROFILE-079 | `tests/behaviour/provider-profile-park-switch-revert.test.ts`, `tests/behaviour/provider-profile-edge-wiring.test.ts` | Existing – Update | both files in one `bun test` invocation |
| TC-PROFILE-080 | `tests/structure/provider-contract.test.ts` + new fixture `tests/fixtures/provider/profile/parks/cause-taxonomy.ts` | Existing – Update (new data fixture) | as `TC-PROFILE-065` |
| TC-PROFILE-081 | `tests/behaviour/provider-profile-probes.test.ts` | Existing – Update | as `TC-PROFILE-062` |
| TC-PROFILE-082 | `tests/behaviour/provider-profile-probes.test.ts`, `tests/behaviour/provider-parks.test.ts` | Existing – Update | both files in one `bun test` invocation |
| TC-PROFILE-083 | `tests/structure/provider-contract.test.ts` | Existing – Update | as `TC-PROFILE-065` |
| TC-PROFILE-084 | `tests/behaviour/provider-parks.test.ts`; control `tests/behaviour/provider-cli.test.ts` | Existing – Update | `bun test tests/behaviour/provider-parks.test.ts tests/behaviour/provider-cli.test.ts` |
| TC-PROFILE-085 | `tests/behaviour/provider-chain-resolution.test.ts` | Existing – No Change (control) + one set-equality assertion | `bun test tests/behaviour/provider-chain-resolution.test.ts` |
| TC-PROFILE-086 | `tests/checks/provider-profile-hermetic.test.ts`, `tests/behaviour/provider-profile-edge-wiring.test.ts` | Existing – Update | `bun test tests/checks/provider-profile-hermetic.test.ts tests/behaviour/provider-profile-edge-wiring.test.ts` |
| TC-PROFILE-087 | `tests/checks/provider-profile-hermetic.test.ts`, `tests/behaviour/provider-profile-probes.test.ts` | Existing – Update (adds the one-factory/three-call-site census) | as `TC-PROFILE-086` plus `…-probes.test.ts` |
| TC-PROFILE-088 | `tests/behaviour/provider-profile-probes.test.ts` | Existing – Update | as `TC-PROFILE-062` |
| TC-PROFILE-089 | `tests/golden/provider-profile-resolve.test.ts` + `tests/fixtures/provider/profile/golden/` | Existing – Update | `bun test tests/golden/provider-profile-resolve.test.ts` |
| TC-PROFILE-090 | `tests/golden/provider-profile-resolve.test.ts` | Existing – No Change (control) | same |
| TC-PROFILE-091 | `tests/behaviour/provider-profile-selection.test.ts`, `tests/checks/provider-profile-evidence-bounds.test.ts` | Existing – Update | `bun test tests/behaviour/provider-profile-selection.test.ts tests/checks/provider-profile-evidence-bounds.test.ts` |
| TC-PROFILE-092 | `tests/behaviour/provider-profile-selection.test.ts` | Existing – Update | as `TC-PROFILE-061` |
| TC-PROFILE-093 | `tests/checks/provider-profile-evidence-bounds.test.ts`, `tests/checks/provider-profile-hermetic.test.ts` | Existing – Update | `bun test tests/checks/provider-profile-evidence-bounds.test.ts tests/checks/provider-profile-hermetic.test.ts` |
| TC-PROFILE-094 | `tests/behaviour/provider-profile-selection.test.ts` + injected fixture `tests/fixtures/provider/profile/selection/fixtures.ts` | Existing – Update (new case in existing file) | as `TC-PROFILE-061` |
| TC-PROFILE-095 | `tests/behaviour/provider-profile-probes.test.ts` + `tests/fixtures/provider/profile/probes/fixtures.ts` | Existing – Update (new case in existing file) | as `TC-PROFILE-062` |
| TC-PROFILE-096 | `tests/behaviour/provider-profile-probes.test.ts` + `tests/fixtures/provider/profile/probes/fixtures.ts` | Existing – Update (new case in existing file) | as `TC-PROFILE-062` |
| TC-PROFILE-097 | `tests/behaviour/provider-profile-probes.test.ts` + `tests/fixtures/provider/profile/probes/fixtures.ts` | Existing – Update (new case in existing file) | as `TC-PROFILE-062` |
| — (gate) | aggregate | — | `TMPDIR=$PWD/tmp/tmpdir pnpm check` |

**Mocking requirements (all cases)**: injected clock, injected state store, injected file system for the committed policy **and the seat-level fixture policy**, injected zone facts, injected `{ condition, observedAtMs }` observation map keyed by provider, recording or throwing ports for fold/probe/credential/transport/sleep. No `mock.module`, no process spawn, no network, no real sleep.

**Assertion bases (declared)**:
- **Direct assertion**: 36 cases observe the property on the surface that owns it.
- **Golden comparison**: `TC-PROFILE-089`, `TC-PROFILE-090` (normalized envelope).
- **Deterministic re-derivation**: `TC-PROFILE-084` (park identity/generation reproduced from inputs, per `GAP-T2`).
- **Delivered control**: `TC-PROFILE-085` (chain resolution unedited), `TC-PROFILE-090` (delivered golden unedited), `TC-PROFILE-072` (delivered `data-v1` grammar `TC-PROFILE-034`), `TC-PROFILE-087` (delivered 50 ms bound `TC-PROFILE-015`), `TC-PROFILE-069` (delivered `TC-PROFILE-010` capability-denied control), `TC-PROFILE-074` (delivered `TC-PAUSE-002` refusal-identity parity), `TC-PROFILE-071` (delivered `data` refusal projection shape `TC-POL-NOM-002`).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| RSK-T1 | The edge-wiring acceptance reads the real committed policy, so a later policy change would fail acceptance for the wrong reason | M | The case pins the policy hash and asserts the specific profile/seat values it depends on; a policy move fails loudly as a policy move, not as a park regression. |
| RSK-T2 | A regenerated golden could mask a regression | M | Golden bytes are derived from the pure selection over recorded park facts, not from canned literals; regeneration is an explicit command with a reviewed diff. |
| RSK-T3 | The 100-provider cost arm becomes environment-sensitive | L | `TC-PROFILE-087` asserts read counts; the wall-clock bound stays with the delivered `TC-PROFILE-015` and is not re-baselined. |
| RSK-T4 | An over-broad attribution blocks a healthy provider and the fixtures never notice | M | `TC-PROFILE-081` includes a provider-subject `reevaluation-cap` arm and a coexistence arm, so classification by cause rather than by park-name prefix is proven. |
| RSK-T5 | Two "independent" compositions share module-level state, making the determinism arm vacuous | M | Each composition is constructed fresh with its own program, store and clock; a module-level cache would surface as a divergence in runs 2–3. |
| RSK-T6 | "No local override required" passes because only the content read was asserted, not the layer's contribution | L | `TC-PROFILE-059` asserts the outcome, zero `readText` content reads of any `config.local.yaml` path, and that no local layer contributed a source or value; the existence probe is explicitly excluded as acquisition behaviour (`GAP-T3`). |
| RSK-T7 | Seat-substitution fixtures drift from the committed policy's shape | M | Substitution fixtures live in `selection/fixtures.ts` beside the delivered chains and reuse the seat/profile constructors; the committed document is used only where the real `delivery` → `paid` order matters, and the seat-level criteria use the injected fixture policy (`GAP-T4`). |
| RSK-T8 | A read-only case passes while the read wrote through an unobserved path | L | `TC-PROFILE-079` compares bytes and `mtimeNs` for every key and counts writes per record kind, rather than checking named keys only. |
| RSK-T9 | The refusal identities drift while every positive case stays green | M | `TC-PROFILE-092` exercises the capability-only, park-only and mixed arms; `TC-PROFILE-069` separates the capability-inadequate-substitute refusal (`unavailable`) from the selected profile's own-seat control (`capability-denied`, `TC-PROFILE-010`); `TC-PROFILE-065` pins the event codes. |
| RSK-T10 | A single global observation instant silently re-enters through a helper and the per-target arms never notice | M | `TC-PROFILE-095` uses three providers in one fixture — A with a short bound (stale), B with a long bound (fresh) and C with no target (never stale) — and `TC-PROFILE-097` rejects the global-instant, undeclared-target and all-providers readings by name. |
| RSK-T11 | The AC-F3-3 boundary is asserted only as prose, so a widened gate passes | M | `TC-PROFILE-094` resolves three arms (undeclared, disabled, peak-parked) with zero parks and zero observations and compares each with the delivered baseline; any substitution, refusal or new blocker fails it. |

### 8.2 Assumptions

- **A-T1**: `PARK_CAUSES`, `PROVIDER_CONDITION_KINDS`, `PROVIDER_WATCH_CONDITIONS`, `PROVIDER_SKIP_REASONS`, `ANNOUNCEMENT_CODES` and `PROVIDER_RECORD_KINDS` are delivered and unchanged by this change (asserted by `TC-PROFILE-065`).
- **A-T2**: `ProfileProviderAvailability.condition` is an open string value position, so `watch-stale` needs no contract change (spec DM-2). If the implementation must add a union member, `TC-PROFILE-065` fails and the spec, not the test, must change.
- **A-T3**: The committed policy text and the injected fixture policy documents can both be served through the injected `fs.readText` double at the composer's expected path, so acceptance needs no real repository write and no second configuration format. The committed document is the fixture for `AC-F1-1`/`AC-F1-2` only (`GAP-T4`).
- **A-T4**: `decision.seatModels` remains the single per-seat map both the env record and the binding read (spec DM-3); `TC-PROFILE-072` would fail if a second derivation appeared.
- **A-T5**: The delivered lifecycle persists the target record on switch/revert; that write is the only permitted one and is excluded from the zero-write assertion by key, not by running a different path.
- **A-T6**: A composed live read observes at the read instant (spec A-6), so `TC-PROFILE-064` can assert age 0 without a transport call; the observation seam is a per-provider map of `{ condition, observedAtMs }` (spec A-11, DM-7).
- **A-T7**: `createParkRecord` accepts any closed cause with either subject kind, so the provider-subject `reevaluation-cap` arm of `TC-PROFILE-081` is constructible without a production change.
- **A-T8**: The per-target staleness rule can be exercised by injecting an observation map into the probe without a production composition supplying one, which is the honesty limit stated in `TC-PROFILE-062` and `TC-PROFILE-095` (spec §8.6, A-10).
- **A-T9**: A fixture policy may place a seat model on a provider outside the selected profile's `providers` list, which is the shape `AC-F3-1`, `AC-F3-2` and `AC-F3-3` require; the delivered profile constructors accept it without a production change.

### 8.3 Open Questions

None open. No acceptance criterion was found untestable as written. Three clauses that needed translation rather than narrowing are recorded as declared bases, not gaps: `AC-F7-1`'s "same as before this change" became a tree invariant (`GAP-T2`, `TC-PROFILE-084`); `AC-F1-1`'s "no operator-local override present" became an absence plus a zero-content-read assertion (`GAP-T3`, `TC-PROFILE-059`); and the seat-level criteria use an injected fixture policy where the committed policy cannot express the state (`GAP-T4`, `TC-PROFILE-071`, `TC-PROFILE-074`). The three DoR-iteration-1 ambiguities are resolved by spec v1.1 and pinned here, not deferred: the capability-inadequate substitute yields `provider.profile.unavailable` (`TC-PROFILE-069`), the seat-level refusal carries the eligibility list unchanged with seat and provider in the bounded `summary` (`TC-PROFILE-070`, `TC-PROFILE-071`), and staleness is per declared target with the three excluded readings failing by name (`TC-PROFILE-095`..`TC-PROFILE-097`). The two DoR-iteration-2 questions are resolved by spec v1.2 and pinned here without a new question: the refusal's projection is the delivered `data` envelope at exit 2, asserted against the delivered control `TC-POL-NOM-002` (`TC-PROFILE-071`), and the seat-level refusal emits no profile event at all, so the refusal envelope is the only evidence (`TC-PROFILE-070`, `TC-PROFILE-071`, `TC-PROFILE-092`). The two-level eligibility rule is stated once and applied uniformly: the selection pass does not probe later profiles, while the substitution search inspects candidates through the same memoized probe and writes no candidate verdict into the list (`TC-PROFILE-066`, `TC-PROFILE-068`, `TC-PROFILE-070`).

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-22 | @test-plan-writer | Initial plan for GH-377: 35 cases (`TC-PROFILE-059`..`TC-PROFILE-093`) covering 11 acceptance criteria across structure/contract, behaviour, edge wiring, checks and golden layers; the eight-cause classification fixture with an explicit subject per cause and the `window`/`ticket` `budget-exhausted` split; exact park-expiry and observation-freshness boundaries; seat substitution through the rung and override paths with the capability gate preserved; per-seat env-record/binding agreement and dispatch-nomination parity; read-time recovery and the zero-write audit; the unchanged `provider resolve` regression; and declared assertion bases with no TODO rows and no open questions. |
| 1.1 | 2026-11-22 | @test-plan-writer | DoR-iteration-1 remediation against spec v1.1: (1) `TC-PROFILE-069` now refuses `provider.profile.unavailable` for a capability-inadequate substitute, with `TC-PROFILE-010` as the delivered `capability-denied` control, so `AC-F3-1`/`AC-F3-2` no longer overlap; (2) `TC-PROFILE-068`, `TC-PROFILE-070` and `TC-PROFILE-071` pin the refusal's evidence position — eligibility list unchanged, no blocker appended, no verdict flip, bounded `summary` naming seat and provider; (3) `TC-PROFILE-062`..`TC-PROFILE-065` and new `TC-PROFILE-095`..`TC-PROFILE-097` pin spec §8.6 per declared watch target, the undeclared-target case, the live-read age-0 case, the freshness-only seam, the production-honesty note and the three excluded readings; (4) `TC-PROFILE-066`/`TC-PROFILE-067` stay on recorded unavailability and new `TC-PROFILE-094` adds the AC-F3-3 seat-gate boundary (undeclared, disabled, peak-parked); (5) `TC-PROFILE-071` and `TC-PROFILE-074` use an injected fixture policy because the committed policy cannot express the seat-level refusal; (6) `GAP-T3`/`TC-PROFILE-059` assert zero `readText` content reads rather than zero existence probes; (7) `TC-PROFILE-074` is labelled Integration on `tests/behaviour/provider-nomination-admission.test.ts` with its fixture and parity arm named; and (8) a Definition-of-Done coverage table (§3.4) maps DOD-1..DOD-8, marking DOD-6..DOD-8 as gate evidence. New identifiers `TC-PROFILE-094`..`TC-PROFILE-097` are noted in `GAP-T5` for plan-phase ownership; `created` and every existing identifier are preserved. |
| 1.2 | 2026-11-22 | @test-plan-writer | DoR-iteration-2 remediation against spec v1.2 (findings 1, 4, 5, 7). **Finding 1:** `TC-PROFILE-071` now asserts the delivered `data` refusal envelope at exit 2 — `data.outcome === "refused"`, `data.code === "provider.profile.unavailable"`, `data.summary` naming seat and provider within the profile caps, `data.eligibility` unchanged, and **no** `error` envelope and **no** absent `data` — anchored to the delivered control `TC-POL-NOM-002`; the previous `error.code`/absent-`data` expectations are removed. **Finding 2:** `TC-PROFILE-070` and the §3.1 AC-F3-2 row now follow the spec's single two-level rule — the selection pass does not probe later profiles, the substitution search inspects candidates through the same memoized probe, and candidate verdicts are never written into the eligibility list, so "not probed" is no longer asserted in absolute terms where a candidate is examined. **Finding 5:** `TC-PROFILE-070` and `TC-PROFILE-071` assert that the seat-level refusal emits no profile event at all (`profile.selected`, `profile.ineligible`, `profile.switched`, `profile.reverted`, `profile.rung-changed` absent, selection-time events discarded), that the refusal envelope is the only evidence and that no new event code appears; `TC-PROFILE-071` also gains the "no `data-v1` record on any stream" and "zero park/announcement/target writes" arms, and the EVT-2 row gains `TC-PROFILE-070`/`TC-PROFILE-071`. **Finding 4:** `TC-PROFILE-066` becomes a four-arm case over `selection/fixtures.ts` — plain declared seat model on a parked provider outside `providers`, the rung arm, a stale-observation variant, and a no-park control arm — with `TC-PROFILE-067` explicitly owning the override arm and the AC-F3-1 row naming the declared-seat arm; no new identifier is added. **Finding 7:** `TC-PROFILE-071`'s committed-policy enumeration uses all four ids (`TC-PROFILE-059`, `TC-PROFILE-060`, `TC-PROFILE-089`, `TC-PROFILE-090`), matching §1.2 `GAP-T4` and §6. Housekeeping: `version` bumped to 1.2, the §2 reference row tracks spec v1.2, the §3.2 EVT-2/DM-2 rows and the §7 delivered-control list name the refusal projection and the no-event rule, and `TC-PROFILE-071`'s index title names the `data` envelope. Case count stays **39** (`TC-PROFILE-059`..`TC-PROFILE-097`), every AC remains covered and every arm is owned exactly once; `created` and every existing identifier are preserved. |
| 1.3 | 2026-11-22 | @test-plan-writer | Test-plan/delivered-behaviour alignment after implementation, against spec v1.3. **(1) `TC-PROFILE-059` outcome literal:** the expected outcome now accepts `outcome` `selected` **or** `switched` — the delivered lifecycle reports `switched` on the first `delivery` → `paid` target move and `selected` when the target is stable, and spec §8.5 keeps that lifecycle unchanged — with exit 0, `profile: paid`, the eligibility verdicts, blockers and env-record facts pinned exactly as before and no operator-local override; the selection facts are declared the contract, not a forced lifecycle outcome. The §3.1 `AC-F1-1` row is restated the same way; the front-matter summary asserted no outcome literal and is unchanged. **(2) `TC-PROFILE-095` watch-target shape:** the delivered `provider.profiles.watch` shape declares one target per provider name, so "provider A declares two targets with different bounds" is not expressible; the precondition becomes three providers at one observation instant — A with a short `maxAgeSeconds` (stale), B with a long `maxAgeSeconds` (fresh) and C with no target (never stale) — with the steps, expected outcome and `RSK-T10` mitigation adjusted to that shape, while the negative readings (global instant, undeclared-target staleness, all-providers-stale, owned by `TC-PROFILE-097`) and the one-second-below-bound arm are retained. No TC identifier is added or removed; the case count stays **39** and every AC remains covered. |

## 10. Test Execution Log

Populated during delivery; one row per case, replaced by the aggregate row once `pnpm check` is green. `created` and every case identifier in this plan are preserved on revision.

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| — | — | Not run | Plan authored in phase 3; execution evidence is recorded in phases 6 and 9. |
