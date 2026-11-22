# Review — GH-377 — iteration 1

- **Status:** **PASS** — no critical/high/medium finding; the production change is correct and all gates I ran are green. Seven low-severity documentation/test-quality nits and three informational notes remain, none blocking.
- **Date:** 2026-11-22
- **Reviewer:** `@reviewer` (local ADOS mode)
- **Branch:** `fix/GH-377/provider-profile-consumes-parks` vs `main-tools`
- **Artifacts read:** spec v1.3 (12 ACs, F-1..F-7, NFR-1..NFR-7, §8.6, §26 DOD-1..DOD-8), test plan v1.3 (39 cases, `TC-PROFILE-059..097`), `chg-GH-377-plan.yaml` (5 phases), `chg-GH-377-pm-notes.yaml`, `readiness-review/readiness-iter-3.md`, `doc/decisions/TDR-0075-watch-stale-as-profile-eligibility-blocker.md`, and the shipped code/tests/docs in `git diff main-tools...HEAD`.
- **Scope:** first review. Every AC/NFR and every plan phase audited against shipped code (not the plan's claims), plus the brief's axes: determinism/purity, fail-closed, bounded/secret-free evidence, no live fetch/credential/network/sleep, no added state write, one-fold-read/memoization, projection/event behaviour, seat substitution semantics (selection pass vs candidate probing), the `data` refusal envelope at exit 2, the no-profile-event rule, env-record/binding agreement, the TDR-0075 boundary, and the phase-7 doc reconciliation.

## Summary

The change is small in surface and faithful to spec v1.3. In `createResolvedProviderProbe` (`packages/cli/src/edge.ts`) the probe reads the verified provider-park ledger **once per resolution**, maps active provider-subject parks (excluding the two chain-level causes `chain-exhausted`/`reevaluation-cap`) keyed by subject name, converts a fold-read failure into a named `provider-outage` unavailable verdict (never clear), and evaluates the per-declared-target freshness predicate only after recorded parks (so a recorded peak park outranks the declared peak window, RSK-10). The three existing profile-resolve call sites (`edge.ts` handler, `resolveProfileContextFrom`, the dispatch nomination predicate) all pass the store; the spawn-context helper via `store`/`observations`, the nomination predicate via `store`/`watch`. No fourth call site and no second availability derivation exists (census test and manual read).

In `selectProfile` (`packages/core/src/provider/profile.ts`) the seat-level re-check is exactly the two-level rule the spec fixes: the selection pass still reports later profiles `shadowed` and does not probe them; the substitution search runs only for a recorded-unavailable effective seat, inspects later profiles in declared order through the same memoized probe, accepts the first profile that is eligible, declares the seat, and declares it on a not-recorded-unavailable (and, for the target seat under `requireVision`, capability-adequate) model, and writes no candidate verdict into `eligibility[]`. On no supplier it returns the delivered refusal shape (`ok:false`, `code:"provider.profile.unavailable"`, bounded `summary` naming seat and provider, `eligibility` carried unchanged, `events: []`). The substituted model lands in the existing `decision.seatModels` map, which `evaluateProfileLifecycle` preserves by spread and `resolveProfileForSpawn`/`buildProfileEnvRecord` and the per-spawn binding both read — so agreement is structural, and the seat refusal returns before lifecycle/target persistence, so the refusal path appends nothing.

All 12 acceptance criteria map to meaningful owning cases; the empirical evidence below is green; the committed `.jaiship/config.yaml` and any operator-local layer are untouched; no closed vocabulary member, error identity, event code, record kind, schema id, or envelope key is added; the contract subpath is unchanged (only internal CLI composition types and an optional 4th `createResolvedProviderProbe` parameter are added); and the phase-7 reconciliation of the five spec pages, the parks guide, TDR-0075 and the decision index is present, with no residual three-check or absolute-`watch-stale` contradiction. The remaining findings are documentation/test-quality nits (see below); none changes a shipped verdict.

## Evidence run

| Check | Result |
|---|---|
| `bun test` changed selection/probes/edge-wiring/spawn/nomination-admission + provider-contract + provider-profile-contract (7 suites) | **110 pass, 0 fail** (887 assertions) |
| `bun test` park-switch-revert/parks/chain-resolution + evidence-bounds/hermetic + profile-resolve golden (6 suites) | **82 pass, 0 fail** (526 assertions) |
| `bun test` content-inventory + provider-policy-adoption-reference + provider-zone-refusal + harness-profile-composition-mount + harness-profile-per-spawn (5 suites) | **79 pass, 0 fail** (743 assertions) |
| `bun test tests/boundaries/boundaries.test.ts` (import/tier/runtime-boundary + exports) | **149 pass, 0 fail** |
| `bun test tests/boundaries/fixture-coverage.test.ts` | **7 pass, 0 fail** |
| `pnpm typecheck` (6 packages + tests/types) | green |
| `bun packages/cli/bin/jaiship.ts plan validate GH-377` | `verdict=valid`, `artifact=yaml`, `tier=full`, `readyForDevelopment=true` |
| Target/host cross-check: `provider resolve` vs `provider profile resolve` share the same park fold | verified by TC-084 (chain skip/park/next-eligible/generation) and TC-059 (profile selection) on the same fact set |

## AC coverage matrix (12/12)

Legend: **PASS** = observable proven in shipped code by the owning case(s); **PASS (caveat)** = criterion met, one sub-arm is a proxy or relies on a delivered control (named).

| AC | Verdict | Owning case evidence |
|---|---|---|
| AC-F1-1 | **PASS** | TC-059 (edge + committed config + seeded z.ai quota park, no local override: paid selected, delivery ineligible `condition/quota-exhausted` naming z.ai, PM `deepseek/deepseek-flash`, no zai entry, config SHA unchanged, no `config.local.yaml` read); TC-089/091 (golden + selected-event evidence). Lifecycle `outcome` accepted as `selected`/`switched` per spec §8.5. |
| AC-F1-2 | **PASS** | TC-060 (healthy: delivery selected, delivery eligible, paid shadowed, PM `zai-coding-plan/glm-5.3-flash`); TC-090 (healthy golden decision). |
| AC-F1-3 | **PASS** | TC-061 (peak park vs quota park: identical decision/seatModels/eligibility, only blocker `value` differs). |
| AC-F2-1 | **PASS** | TC-062 (at bound → `watch-stale`, selection skips provider, no env value on it), TC-063 (bound−1s available), TC-064 (live age 0; absent observation inert), TC-065 + TC-090 + TC-097 (closed-set equality, `watch-stale` watch-only), TC-092 (profile.ineligible reason/blockers), TC-095/096 (per-target, undeclared never stale; only freshness consumed). |
| AC-F3-1 | **PASS** | TC-066 (declared-seat + rung arms + stale variant + no-park control), TC-067 (agent-override arm), TC-068 (per-seat routing, list unchanged), TC-069 (capability-inadequate substitute not used), TC-092. |
| AC-F3-2 | **PASS** | TC-069 (inadequate → `unavailable`), TC-070 (list carried unchanged, `events: []`), TC-071 (edge: exit 2, `data.outcome=refused`, `data.code`, no `error`, `data.envRecord` absent, `data.events=[]`, state key set unchanged), TC-093 (bounded/secret-free). |
| AC-F3-3 | **PASS** | TC-094 (undeclared / disabled / declared-peak-parked seat provider: delivered seat kept, no park/stale blocker, no substitution/refusal). |
| AC-F4-1 | **PASS** | TC-072 (per-seat env record == binding, no parked provider named), TC-073 (all-or-nothing: no record, no base values, no spawn call), TC-074 (nomination verdict parity incl. refusal), TC-059 (CLI). |
| AC-F5-1 | **PASS** | TC-075 (parked → paid, advance past expiry → reverted exactly once, park bytes unchanged, second read no revert), TC-076 (inactive at exactly `expiresAt`), TC-077 (cleared condition restores before expiry), TC-078 (expired ≡ never-parked, byte-identical selections), TC-079 (zero park/announcement/cleared writes). |
| AC-F6-1 | **PASS (caveat F-5)** | TC-080/083 (eight-cause table set-equality + six attributable + both budget scopes + drift fails by name), TC-081 (chain parks and provider-subject `reevaluation-cap` never block/clear), TC-082 window arm (budget park consumed), TC-061. Caveat: TC-082's ticket-scope arm is an empty-store proxy (F-5). |
| AC-F7-1 | **PASS (caveat F-6)** | TC-084 (`provider resolve`: quota skip, park cause + next-eligible == reset, deepseek selected, persisted generation `quota-exhausted:<reset>`), TC-085 (closed skip/park-cause sets exact). Caveat: TC-085's no-park arm asserts `"skipped"/"parks" in result` (vacuous on the result type) instead of driving a park-free resolve (F-6). |
| AC-NFR1-1 | **PASS** | TC-086 (three runs × two compositions byte-identical, `fetch` never called), TC-087 (one fold read, 100 probes for 100 providers per pass, three-call-site census), TC-088 (fold failure → named unavailable, never clear/crash, not cached into a later resolution). |

NFR-2/NFR-4 fold-read/memoization confirmed by TC-087 (`foldReads()==1`, `probeCalls==100`, no re-read on the second pass). NFR-3 set equality pinned by TC-065/085/097 and the unchanged contract file. NFR-5 boundaries by TC-062/063/076/095. NFR-6 caps/secret-free by TC-091/093. NFR-7 absent-facts/no-clear-on-failure by TC-060/078/088/094.

## Plan coverage

`plan validate` reports `valid`/`full`/`readyForDevelopment=true`. Four delivery phases carry pm-notes completion evidence (plan phase id, commit hash, targeted test result): phase 1 `8f0861ea` (86 pass), phase 2 `a89042d3` (49 pass), phase 3 `6cf2b4b7` (72 pass), phase 4 `3b7e2506` (114 / 192 pass). Phase 5 is `kind: planning`, declaration-only ("performs no delivery work; every declared file is reconciled by the doc-syncer"); its declared file set equals spec §22's page set and is present in the diff, delivered through lifecycle phase 7 (`system_spec_update` completed in the pm-notes). One out-of-scope doc file exists (F-4, glossary).

## Scope / boundary checks

- **Committed policy untouched:** `.jaiship/config.yaml` not in the diff; TC-059 hashes it before/after and asserts equality; no `config.local.yaml` read.
- **No unrelated scope:** diff is production (`edge.ts`, `production.ts`, `profile.ts`), the declared test/fixture set, the declared docs, TDR-0075 + index, and the change artifacts. No `.opencode/**`, no `.ados-claude/**`, no GH-366 work. Exception: `doc/overview/glossary.md` (F-4).
- **No new vocabulary/contract:** no park cause, condition kind, watch condition, skip reason, announcement code, error identity, event code, state record kind, schema id, envelope key, or `@delivery-os/core/contracts` member added. New symbols are internal CLI composition types (`ProviderAvailabilityFacts`, `ProviderAvailabilityObservation`) plus an optional 4th `createResolvedProviderProbe` parameter (backward compatible).
- **Read-only / no live I/O:** probe performs a single synchronous ledger read; no fetch/credential/network/sleep; TC-086 spies `fetch`, TC-079 compares park/announcement bytes, TC-071 compares state key sets.
- **Refusal shape:** `provider.profile.unavailable` remains the `data` envelope at exit 2 (`outcome:"refused"`, code, summary, eligibility, events) — TC-071 verifies no `error` envelope and no absent `data`; no profile event on the seat path.
- **TDR-0075 boundary:** narrows TDR-0062 D2 for profile eligibility only; TDR-0062 not superseded; TDR-0076 unused; index row present; `Proposed` status with `decision_date: null` pending owner acceptance. Two wording drift items remain (F-2, F-3).
- **Phase-7 doc reconciliation:** profiles, engine, peak-pausing, dispatch-engine, result-contract and parks-guide pages state recorded-park consumption + no live verification, the two refusal causes, and the positive `watch-stale` rule; no residual three-check or absolute-exclusion statement found. One row cell remains unqualified (F-7).

## Findings (10; 0 critical / 0 high / 0 medium / 7 low / 3 info)

| ID | Sev | Location | Finding |
|---|---|---|---|
| F-1 | low | plan:27 | Plan phase-2 summary still says "shadowed and unprobed"; the normative rule (selection pass does not probe; substitution search does) is correct, only this summary is stale. Reword to "shadowed and not re-verdicted in the list". |
| F-2 | low | TDR-0075:204/289 | Decision D1/evidence keep the "at least one stale declared target / any stale target blocks" multi-target framing that spec v1.3 §8.6/F-2 superseded for the delivered one-target-per-provider shape; behaviourally equivalent today. |
| F-3 | low | TDR-0075:317 | D5 says DEC-7 ("no decision record is authored") "is superseded", contradicting the revised spec DEC-7/NG-8 ("both statements stay in force") and the TDR's own Implementation Plan step 1. Reword to "the earlier statement is superseded; the current DEC-7 cites this record". |
| F-4 | low | glossary:33 | `doc/overview/glossary.md` reconciled outside declared phase/§22/DOD-8 scope (related and correct). Add it to the scope or disclose it in pm-notes. |
| F-5 | low | provider-parks.test.ts:646 | TC-082's ticket-scope arm never triggers a `ticket`-scope crossing; it asserts "empty store → clear". AC-F6-1's ticket-scope clause lacks a behavioural owning proof in this change. |
| F-6 | low | provider-chain-resolution.test.ts:588 | TC-085's `"skipped"/"parks" in result` assertions are vacuous on `ProfileSelectionResult`; only the closed-set equality is meaningful, so the no-park chain arm rests on delivered controls. |
| F-7 | low | feature-result-contract.md:156 | The `provider.profile.unavailable` error-table Description still reads all-candidates-only; the added paragraph clarifies both causes but the cell (DOD-8's sweep target) is unqualified. |
| F-8 | info | provider-profile-probes.test.ts:382 | TC-097's three "excluded reading" variants compare hand-written lambdas to the oracle rather than exercising the shipped probe; only the first assertion tests production. |
| F-9 | info | profile.ts:129 / edge.ts:2924 | The recorded-unavailability marker is an implicit two-module contract with duplicated local types and an `as` read; a rename/drop compiles cleanly and would silently disable the seat gate (caught only by behaviour tests). |
| F-10 | info | profile.ts:424 | The rung-derived substitution arm is reachable only through injected `options.seatModels`; no production caller wires `evaluatePacing` output into `selectProfile`, so the rung guarantee is unit-level today (consistent with spec, worth stating). |

## Blocking remediation tasks

None. All findings are low/info. Suggested, non-blocking cleanup to fold into the next plan touch / phase-7 doc pass: F-1 (plan wording), F-2/F-3 (TDR wording), F-4 (glossary scope), F-7 (result-contract row cell), and F-5/F-6 (test-arm fidelity).

## Verdict

**PASS.** Proceed to quality gates (phase 9). No spec, plan, correctness, safety, or vocabulary violation found.
