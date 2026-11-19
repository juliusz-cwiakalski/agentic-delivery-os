# GH-335 Review — Iteration 1

- change: GH-335 (M3-S1: opencode v2.x harness and telemetry)
- date: 2026-11-18
- mode: local
- base: `main-tools`; range `main-tools...HEAD` (39 commits at review time, one permitted sync merge `f7e32768`)
- spec: `chg-GH-335-spec.md` v1.4 (27 ACs, DEC-1..DEC-17, DM-1..DM-10); test plan rev 1.6 (47 TCs); plan 8 delivery phases (47/47 TCs, 27/27 ACs) plus the appended remediation phase 9
- spot-run evidence: 241 tests / 0 fail across the spot-run suites listed below — `harness-telemetry-attribution`, `-classification`, `-seat-attribution`, `-seat-totals`, `-drift`, `-shape`, `-generation`, `-extraction-failure`, `-mandatory-usage`, `-divergence`, `-durations`, `-privacy`, `harness-profile-per-spawn`, `-precedence`, `-propagation`, `-unrepresentable`, `harness-refusal-side-effects`, `harness-version-gate`, `harness-mode-refusal`, `-selection`, `harness-resume-propagation`, `harness-attach`, `harness-closeout-capture`, `-nongating`, `-idempotency`, `closeout-composition-facts`, `dispatch-harness-verdict-mode`, `harness-mutants`, `harness-hermetic`, `harness-determinism`, `harness-probe-construction-site`, `harness-probe-grammar-contract`, `harness-version-window-contract`, `conformance-coverage`, `harness-extension-scenarios`, `dispatch-envelope-detail`, `harness-contract`, `fixture-store-shape`
- validators: `jaiship plan validate GH-335` = `verdict=valid`; `jaiship lint plan GH-335` = `verdict=valid`, 0 errors (re-run after the phase-9 append)
- empirical probe (throwaway, removed): the two resolution helpers return the swapped identities recorded as F-3

## Verdict

**FAIL** — three blocking (major) findings before PR; remediation phase appended to the plan. F-1 and F-2 are evidence/composition integrity defects the change's own plan anticipated; F-3 is a contract contradiction demonstrated by execution.

Findings: 14 total — 0 critical / 3 major / 1 medium / 6 minor / 4 info.

Severity mapping against the review contract: **major** = high, **minor** = medium (F-4) or low (F-5..F-10), **info** as listed.

## Findings

| ID | Severity | Location | Issue | Remediation |
|----|----------|----------|-------|-------------|
| F-1 | **MAJOR (blocking)** | `chg-GH-335-live-observation.md:18-102` | AC-F5-6 and AC-F3-1's live half are claimed "met" on a raw `opencode run --agent coder --model …` invocation — the argv convention plan 8.12 and DoD clause 4 forbid — that never ran a harness-port spawn, never produced a resolved binding, and never ran the delivered capture. §4's row table is a narrated projection ("the capture produces one row with:"), not observed output. Since the delivered capture scope is the recorded dispatch-attempt union (DM-8), a raw CLI run records no attempt, so the delivered capture would return `skipped-gap`, not the row described; the seat `coder-seat` is asserted nowhere observed. The record says "No deferral is claimed", so DoD clause 1's accepted-deferral escape is unavailable. | Re-run the observation through the delivered path: a port `spawn` with `agent: "coder"` (and the composition-resolved binding), record the attempt, run the capture/extractor, and paste the actual landed row plus state read — **or** record an owner/PM-accepted deferral with the exact boundary and stop claiming the ACs. |
| F-2 | **MAJOR (blocking)** | `packages/cli/src/production.ts:1151,2832-2835` | `createProductionComposer` hands out plain `harnessFor(...)` ports and supplies no `harnessAgent`/`harnessBinding`; `createHarnessProfilePort` and `resolveHarnessAdmissionBinding` are called only by `tests/fixtures/harness/propagation-harness.ts` (and each other). A caller supplying `agent` on the delivered production port is *refused* ("reached the adapter without a resolved single-seat binding"), not resolved, so AC-F3-1's offline "composition passes the supplied agent identity to the resolver" is true only of a test fixture. This is the plan's own escalation trigger ("the resolution rule has no production call site and only a test-built fixture proves it") and contradicts DM-4/§8.2/DEC-16. DEC-15 is not breached; DEC-15 does not license an unmounted call site. | Mount `createHarnessProfilePort({ port, profile, selection, resolve: resolveBinding })` on the production opencode port (role-less call = unchanged passthrough, preserving DEC-15); add a composition-level test driving the production-composed port with an agent. |
| F-3 | **MAJOR (blocking)** | `packages/cli/src/production.ts:1087-1205` | The two resolution helpers swap the refusal identities, demonstrated by execution: `resolveHarnessAdmissionBinding({agent:""})` → `provider.profile.invalid` (DEC-17/AC-F3-1 require `config.value.invalid` naming the agent-identity field); `createHarnessProfilePort(...).spawn({agent:"writer"})` on an unassigned multi-seat profile → `config.value.invalid` (AC-F3-4 requires `provider.profile.invalid` naming agent, profile, declared seats). The port wrapper masks the empty case via `harnessAgentIdentityViolation`, but the admission helper has no such check and the wrapper's unassigned branch is wrong. | Check `harnessAgentIdentityViolation` first in `resolveHarnessAdmissionBinding` (→ `config.value.invalid`); keep `unassigned` → `provider.profile.invalid` with agent/profile/seats; make the wrapper's `unassigned` branch delegate to that mapping. Add oracles through the mounted composition. |
| F-4 | MEDIUM | `packages/core/src/contracts/closeout.ts:562-568`; `contracts/harness-telemetry.ts:228-238`; `packages/cli/src/edge.ts:2490-2500` | `absences`, `unattributedAttempts`, `attemptTruncation` are computed and returned by the capture but dropped by `CloseoutTelemetryDisclosure`, the edge capture outcome, and the durable `HarnessCaptureOutcomeRecord`; an all-absent capture renders `{captured:0,degraded:0,failed:0,warnings:[]}`. ACs are satisfied at the capture envelope, so this is durability/observability, not an AC breach (the GH-291 F-2 class). | Project the three bounded facts into the closeout disclosure and the durable record; add a closeout oracle. |
| F-5 | LOW | `packages/cli/src/production.ts:975-980,1042-1066`; `packages/core/src/domain/harness-registry.ts:130` | `modeOrigin` never reaches the production attempt record: `ProductionHarnessFacts` omits it, `createHarnessAdmission` does not pass it, so `resolveHarnessInstance` always stamps `"defaults"` even when `harness.mode` is configured. DM-3 / plan 8.6 ("mode with its origin") is not observable on the attempt. | Thread `settings.modeOrigin` into `ProductionHarnessFacts`/`resolveHarnessInstance`; assert a configured mode records `configured`. |
| F-6 | LOW | `packages/adapters/src/harness/telemetry-opencode.ts:220-230,389-440` | Spec §8.3 / plan 5.1 name `agent-switched`/`model-switched` events as transitions; `messageSql` reads only `type='assistant'` and no switch rows exist in fixtures, so a message without `data.agent`/`data.model` falls back to the stale session baseline. Narrow impact; TDR-0035 omits the switch source (spec/TDR inconsistency). | Implement the transition (read switch rows in `seq` order; add fixture/oracle) or record an owner-accepted §8.3/plan-5.1 erratum. |
| F-7 | LOW | `packages/adapters/src/harness/telemetry-opencode.ts:415-420,437`; `packages/cli/src/edge.ts:2110-2125` | The `version-drift` warning (§10/DM-9) is never emitted in production: the extractor needs `options.pinnedVersion` and the production construction never supplies the probed version. The stamped row version is also the raw `session_v2.version`, not normalized per AC-F5-1. | Pass the admission's `observedVersion` as `pinnedVersion`; normalize the stored version; add a drift oracle. |
| F-8 | LOW | `packages/adapters/src/harness/telemetry-opencode.ts:237-258` | `durationsOf` has no range guard before `new Date(ms).toISOString()`; an out-of-range stored timestamp throws and the outer catch turns it into a whole-capture `extraction-failed`, losing all rows. Same class as GH-291 F-4. | Range-guard the pair, return `duration-absent`, and add an out-of-range decode test. |
| F-9 | LOW | `packages/adapters/src/harness/index.ts:20-25`; `tests/fixtures/harness/propagation-harness.ts:10-13` | `OpencodeBindingSeams` is not re-exported from the harness barrel, yet the fixture imports it from the barrel; it works only because the import is type-only and tests are not typechecked. pm-notes says "tests import it from the module" — false. | Re-export the type from the barrel (and root adapters barrel if public); fix the gap wording. |
| F-10 | LOW | `packages/adapters/src/harness/review-deferrals.ts:28-33` | F-11 text still describes "a bounded store-level warning" for parentless sessions — a store-wide scan the GH-335 extractor no longer performs (NG-11). | Restate F-11 to the held-identity/absence behaviour, or mark it superseded. |
| F-11 | INFO | `chg-GH-335-pm-notes.yaml:496-503` | Two declared gaps are misdescribed: `doc/00-index.md` **was** updated (five descriptor rows); `tests/fixtures/harness/scenarios/` already exists (pre-existing files) — only a new file was not added. Neither breaches the spec. | Correct the wording. |
| F-12 | INFO | `tests/structure/harness-probe-construction-site.test.ts:70-85` | The temp copy's `finally` is empty, so each run leaks a `packages/` tree. | `rmSync(copy, {recursive:true, force:true})`. |
| F-13 | INFO | `tests/behaviour/harness-telemetry-extraction-failure.test.ts` | TC-024 declares five damaged variants; two doubles are exercised (unrecognised generation is TC-028). Oracle met; traceability looser than declared. | Note the collapse or add doubles. |
| F-14 | INFO | `packages/cli/src/production.ts:2112-2126` | `dispatchHarnessFacts` is composition-instance mutable state; concurrent dispatches on one composer could interleave verdicts (single-dispatch-per-process today). | Pass facts per run, or document the invariant. |

## AC verification (observed behaviour, not summaries)

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-F1-1, AC-F1-4 | PASS | `resolveHarnessInstance` carries `versionVerdict`; window is pinned data with no config key (`HARNESS_SUPPORTED_VERSION_WINDOW`, `catalog.ts` has no window field). |
| AC-F1-2, AC-F1-3, AC-F1-5 | PASS | `evaluateHarnessVersion` grammar/normalization (`opencode v2.3.2`→`2.3.2`, `v2.2.5`→`2.2.5`, off-grammar/empty/multi-line→indeterminate); `harness.version.unsupported` / `harness.version.unknown` rows + exit projection; `harness-version-gate`/`-window`/`-probe-seam` green. |
| AC-F2-1, AC-F2-3, AC-F2-4 | PASS | `DEFAULT_HARNESS_MODE` + `PRODUCTION_OPENCODE_ARGS` always `--standalone`; non-default mode refuses `harness.mode.unavailable` pre-spawn; unknown mode `config.value.invalid`; `harness-mode-*` green. |
| AC-F2-2 | PASS | TDR-0034 chosen mode = `per-invocation-private-server` = constant; linked from feature spec; independent review artifact present. |
| AC-F3-1 (offline) | **FAIL** | Composition does not mount the resolver (F-2); production port refuses a caller-supplied agent. Binding content itself is correct in the wrapped fixture. |
| AC-F3-1 (live half), AC-F5-6 | **FAIL** | Live record is a raw CLI run, not a port spawn, and no capture ran (F-1). |
| AC-F3-2, AC-F3-3 | PASS | `buildHarnessSpawnEnvironment` record-wins / undeclared-ignored; `harness-profile-precedence`/`-neutrality` green. |
| AC-F3-4 | **FAIL** | Wrapper maps `unassigned` to `config.value.invalid` (F-3); admission helper maps empty to `provider.profile.invalid` (F-3). |
| AC-F4-1 | PASS | Resume re-applies the same binding, preserves tree root; `harness-resume-propagation`/`-attach` green. |
| AC-F5-1 | PASS (with F-6/F-7 caveats) | Rows land with schema id, session version, seat/resolved from the binding, observed agent/model, tokens, cost, durations; zero-row-for-held-session is a failed-session entry. |
| AC-F5-2 | PASS | Additive fields; pre-change payloads parse (`recordFrom`, `parseAbsentAxes`/`parseSeat`). |
| AC-F5-3 | PASS | Both values kept; `model-divergence`/`agent-divergence`; group scoping null-seat. |
| AC-F5-4 | PASS | Store timestamp pair or explicit `duration-absent`; no capture-time derivation. |
| AC-F5-5 | PASS | Union across recorded attempts, per-attempt binding attachment, counted unattributed, empty-union `skipped-gap`, truncated attempt read counted; `harness-telemetry-attribution` green (durability caveat F-4). |
| AC-F5-7 | PASS | `absentObservedAxes` names the axis, empty-string placeholder, same-axis `optional-field-absent`, no `invalid-session-identity`, null seat + `unresolved-seat`; `-observed-axis-absence` green. |
| AC-F6-1, AC-F6-2 | PASS (F-4 caveat) | Three classifications at the capture envelope; `spend.telemetry-absent` untouched; no `harness.telemetry.absent`; non-gating; closeout tests green. |
| AC-F7-1..3 | PASS | Six-scenario floor unchanged; four extension scenarios; missing-scenario fails; offline (`harness-extension-scenarios`, `conformance-coverage`, `harness-hermetic`). |
| AC-N1-1 | PASS | Admission before lease; refusal spawns 0 / appends 0 / writes 0; single reaped probe; `harness-refusal-side-effects` + `harness-probe-construction-site` green. |

## Pinned scenarios

- TC-M3-HARNESS-001 (opencode dispatch with profile propagation): **VERIFIED OFFLINE, LIVE HALF NOT EVIDENCED** — three spawns / three sessions / three row sets with distinct seats, one `--agent`/`--model` each, child env exactly the allowlist; the live half fails per F-1.
- TC-M3-HARNESS-002 (unsupported harness version): **VERIFIED** — out-of-window refuses `harness.version.unsupported`, zero sessions; unknown refuses `harness.version.unknown`.

## DEC / DM invariants

- DEC-1 (window rule + value `2.3.x`/`2.2.x`): **HOLDS**.
- DEC-2 (one default mode, no fallback): **HOLDS**.
- DEC-3 (distinct unknown identity, no fabrication): **HOLDS**.
- DEC-4 (additive telemetry, identity unchanged): **HOLDS**.
- DEC-5 (resolved beside observed, never overwrite): **HOLDS**.
- DEC-6, DEC-8, DEC-11, DEC-13, DEC-14: **HOLD**.
- DEC-9/DEC-10 (observed-store sourcing, absence taxonomy inside envelopes): **HOLDS**; durability caveat F-4.
- DEC-15 (port-boundary propagation; shipped dispatch binds nothing): **HOLDS**; the shipped dispatch supplies no agent and discloses `unresolved-seat`. F-2/F-3 are about the unmounted/inconsistent resolution helpers, not about DEC-15's scope.
- DEC-16 (caller agent on its own member; composition calls the resolver): **VIOLATED IN PRODUCTION** (F-2).
- DEC-17 (present empty/whitespace is invalid input → `config.value.invalid`): **HOLDS at the port wrapper, VIOLATED in the admission helper** (F-3).
- DM-3 (mode + origin): config **HOLDS**; attempt record **missing origin** (F-5).
- DM-8 (union attribution): **HOLDS**.
- DM-9 (stored version stamped, probed separate, divergence warned): stamp **HOLDS**; divergence warning **unwired** (F-7).

## Plan audit (YAML plan, 8 phases)

- Phase conformance: all 8 phases have pm-notes `notes:` evidence naming the plan phase, commit hash, and gate result (phase 1 `1be1e49a` … phase 8 `8f2ff139`, delivery boundary `f4140153`, post-boundary remediations `ce9899df`, `e1a65b16`, `2e2720bb`, `2afbf380`). No open phase.
- Scope: `plan diff` not run against the whole branch here, but every changed path inspected is inside a declared phase scope except the declared gaps (pm-notes). No undeclared behaviour found beyond the findings above.
- Gap types: none of OPEN_PHASES / EVIDENCE_MISSING / SCOPE_DEVIATION at the plan level. The blocking findings are behavioural, not plan-evidence gaps; a remediation phase (9) is appended for them.

## Declared gaps in pm-notes — assessment

1. **`tests/fixtures/harness/scenarios/` not added** — *acceptable, misdescribed.* The folder already exists (pre-existing `classification.ts`, `stream.ts`); the extension executor supplies facts inline (`harness-extension-scenarios.test.ts`) with an equivalent data path. Not a spec breach; no new file was needed.
2. **`OpencodeBindingSeams` not re-exported** — *acceptable today, but the description is wrong and the fixture import is a latent type error* (F-9). No delivered behaviour depends on it; fix the barrel and the wording.
3. **`doc/00-index.md` untouched** — *false.* The file was updated with five descriptor rows (and commit `cbf3b236`). Only a *new feature page* was not created, which the plan declared conditional. Not a gap.

---

## Other verified dimensions

- **Commit discipline:** PASS. 39 commits, all conventional `type(scope): …` subjects; zero body/footer lines > 100 chars; exactly one merge commit (`f7e32768`, the owner-requested `sync with main-tools`). `./scripts/lint-commit-range.sh --base main-tools` was recorded PASS over the 37 commits present when the gate ran (two docs commits landed after it; their subjects and lengths were re-checked here). Observation (not a finding): 30+ commits carry the commit primitive's mechanical subject `chore(GH-335): update <path>`, which is conventional but low-information for history.
- **Security/privacy:** deny-by-default spawn environment preserved (`buildHarnessSpawnEnvironment` record-wins/undeclared-ignored; `harness-hermetic` forbids `process.env` in the extractors; `harness-telemetry-privacy` pins identity/count/cost/duration keys and the content canary). Probe is one bounded, shell-free `--version` invocation with the declared deadline. Store reads are read-only with `PRAGMA query_only = ON` before the first read, identity-scoped, bounded at 64/16/16, no content projection.
- **Determinism/offline:** `harness-determinism` byte-identical on shuffled stores; `harness-hermetic` zero live invocations; conformance runs over injected facts.
- **Layer/tiers:** contracts (data) → domain (pure) → state (ledger) → adapters → CLI; no adapter-side classification; the core reads no ambient environment (home/OPENCODE_DB injected at the edge).
- **Mutations:** 27 named GH-335 mutants all produce their prohibited observable (non-vacuous; a stale transform fails via `passed()` throwing).
- **Docs:** phase-7/8 reconciliation landed across the feature pages, NFR rows, decision index, milestone status, and the four TDRs remain `Proposed`. `feature-closeout.md` was reconciled to the delivered `telemetryCapture` projection (consistent with F-4).

## Next step

`CALL_CODER` — execute remediation phase 9 (appended to `chg-GH-335-plan.yaml`), then re-review as iteration 2. F-1 and F-2 must be resolved (or F-1 replaced with an owner/PM-accepted deferral recorded in the change evidence); F-3 is a small, testable fix. F-4..F-10 are cheap and should ride the same remediation; F-11..F-14 are optional.
