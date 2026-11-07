# Code Review Iteration 2 — GH-234 (M1-S21: Model profiles and provider watching)

- **Mode**: local (`workItemRef` GH-234, re-review after remediation phase 10)
- **Branch / base**: `feat/GH-234/model-profiles` vs `main-tools` (merge-base `a69b555e`)
- **Diff reviewed**: full branch `main-tools...HEAD` with focus on the remediation delta `0a2673a4..HEAD` — commits `9c3125ce` (fix: wire `--profile` and profile lifecycle into the production edge) and `e24d4a84` (docs: sync specs with remediated profile behavior); 16 files, +921/−48
- **Reviewer**: reviewer agent (spec/plan compliance + code-quality heuristics; adversarial stance on remediation-introduced regressions)
- **Date**: 2026-11-07
- **Prior verdict**: iteration 1 FAIL (F-1/F-2 must-fix, F-3..F-6 should-fix) — see `review-iter-1.md`

## Verdict

**Status: PASS** — both must-fix findings genuinely resolved on the production path (not cosmetically), all four should-fix findings resolved, no new blocking issues found in the adversarial sweep. 3 minor observations recorded below (1 low, 2 informational); none warrants a remediation phase.

| | critical | high | medium | low | info |
|---|---|---|---|---|---|
| New findings (iter 2) | 0 | 0 | 0 | 1 | 2 |

## Per-finding resolution evidence (iteration 1 → verified)

### F-1 [was must-fix] `provider resolve --profile` enforced in the production edge — RESOLVED

- The edge resolve handler validates the profile branch whenever the flag is present (`packages/cli/src/edge.ts:2300-2328`): unknown name → classified `provider.profile.invalid` (error-table `user-validation` → exit 1 — asserted on the real path, previously exit 0); known name → `ProviderResolveInput.profile` (`packages/core/src/provider/engine.ts:105-110`) restricts chain candidates to the named profile's providers (`engine.ts:359-369`), with an empty intersection failing as `provider.chain.empty`. Envelope shape unchanged; flag absent keeps the delivered resolve byte-identical.
- **The contract is now driven by the REAL edge, not the stub**: `tests/behaviour/provider-profile-edge-wiring.test.ts` imports `createConfigProgram` from `packages/cli/src/edge` and `runCli` from `packages/cli/src/index` with injected clock/credential/transport/state — no stub command runtime. Verified: known profile scopes the decision (`--profile base` → p0; unscoped → p1, a real engine effect at `:183-190`, `:199-206`); unknown name exits 1 with `provider.profile.invalid` (`:192-197`).
- Empty-config `--profile` spot-checked in this review: `provider.profile.absent` fail-closed. `--profile` + `--chain` compose (chain selected, then filtered; no overlap → classified refusal), documented in `doc/spec/features/feature-provider-profiles.md` ("enforced, not echoed" section). All four spec-declared flags (`--profile`, `--agent`, `--for-spawn`, `--provider`) now have real-edge coverage — the over-mocking root cause is closed.

### F-2 [was must-fix] lifecycle wired into production profileResolve; switched/reverted reachable — RESOLVED

- `profileResolve` (`packages/cli/src/edge.ts:2434-2510`) now composes `selectProfile` → base-provider sync-probe scan (`:2441-2454`) → `readProfileTarget` → `evaluateProfileLifecycle` → `persistProfileTarget` (fenced, latest-wins, verified post-append) for BOTH the plain and `--for-spawn` paths; `resolveProfileForSpawn` consumes the caller's projected selection (`packages/core/src/provider/profile.ts:474-477`).
- The outcome projection lives in **core**, not the edge: `evaluateProfileLifecycle` returns the re-projected `ProfileSelectionResult` with `outcome: "reverted"` (`packages/core/src/provider/profile-lifecycle.ts:240-246`) and `outcome: "switched"` (`:281-287`); `selectProfile`'s unconditional `selected` is superseded on the production path. The hand-built golden fixture is JOINED by an engine-path golden (`tests/golden/provider-profile-resolve.test.ts:40-135` — real `selectProfile` + `evaluateProfileLifecycle` composition, pinned with `toEqual`).
- Production-path tests through the real edge (`provider-profile-edge-wiring.test.ts:231-302`): peak-window park → outcome `switched`, EVT-1 evidence (previous/new target, revert condition `peak-window`, provider `p0`), EVT-4 record persisted (verified by direct store read); repeat resolve → outcome `selected`, zero duplicate switch events (no thrash, no state write); recovery → outcome `reverted` exactly once with the recovering provider, target record `base`/`revert`; third resolve stable. Human text `resolved X (switched|reverted)` now reachable (`packages/cli/src/commands/provider.ts:352`).
- The sync probe boundary is unchanged (enabled + UTC peak; quota facts stay injected — accepted deviation 2 / M1-S9 seam). `selectProfile` refuses without a preference chain (`provider.profile.absent`), so the `previous = … ?? "none"` fallback is defensive dead code, unreachable in production.

### F-3 [was should-fix] `provider.profile.capability-denied` honest — RESOLVED

Raised when every blocker on every losing candidate is a capability blocker (`packages/core/src/provider/profile.ts:371-395`), with a distinct event message/reason (`capability-gate`). Routing verified: only `provider.profile.unavailable` maps to the exit-2 `refused` data envelope (`provider.ts:332-343` + `:240-241`); `capability-denied` flows through `providerError` → error-table `user-validation` → exit 1, exactly as documented. TC-PROFILE-010 row updated (`tests/behaviour/provider-profile-selection.test.ts:235`); `error-table-sync` re-run green (91/91 both directions); spec rows synced (`feature-provider-profiles.md`, `feature-result-contract.md`).

### F-4 [was should-fix] structural NFR-8 bound — RESOLVED

Name caps at validation (`packages/core/src/provider/validate.ts:487-492, 530-534, 552-557` — 64 chars for profile, provider-reference, and seat names); evidence structurally capped at projection (string ≤128B, arrays ≤8 items, item ≤96B — `profile.ts:136-184`) with UTF-8-aware byte counting (no runtime text-encoding API); `createProfileEvent` shrinks evidence deterministically then **re-asserts the 1024-byte bound after message truncation** in a loop that accounts for JSON-escape widening (`profile.ts:249-304`). Overflow tests added, including a pathological 40-long-named-profile configuration (`tests/checks/provider-profile-evidence-bounds.test.ts:124-189`). This review's own adversarial spot-checks (astral-plane message ×600, surrogate-pair-heavy evidence, 3000-byte blockers) all terminate and serialize ≤1024 bytes.

### F-5 [was should-fix] envRecord.header LF/CR/NUL rejected at entry — RESOLVED

Rejected at config parse (`validate.ts:733-735`, classified, names the field), at serialization AND at record-parse validation (`packages/core/src/provider/profile-env-record.ts:121-127, 176-182`); the downstream byte-level wrapper validation is retained (fail-closed preserved). Name-allowlist regex now compiled once per resolved policy (`:90`, `:125`). Failure rows extended in both `provider-profile-config.test.ts:123-140` and `provider-profile-env-record.test.ts:91-107`.

### F-6 [was should-fix] test-plan §10 accuracy — RESOLVED

`chg-GH-234-test-plan.md` §10 aggregate row now reads "PASS (2 environmental)" naming TC-STATE-021 (Corepack pnpm download, no network) and CI-parity (cross-device `git clone --local`), and the remediation iteration row is appended with the same honesty rule. R-6 touched only §10 as contracted (the pm-notes phase-10 completion entry is separate phase evidence, not an R-6 violation).

## Adversarial sweep (regressions introduced by the remediation)

Checked, all clean:

- **State writes on unchanged targets**: appends are double-guarded (lifecycle `append` flag + `persistProfileTarget`'s own target+reason comparison, `profile-lifecycle.ts:133-140`); stable resolves write nothing (edge test asserts zero new events).
- **Switch thrash under probe flapping**: a genuine availability flip produces exactly one append per real transition; alternating availability records alternating switch/revert events — honest, bounded, no amplification; within-pass dedupe by identity intact.
- **Revert evidence correctness**: when base is selected all base providers are available, so the recovering provider correctly resolves from the persisted record (`profile-lifecycle.ts:216`, `providerName ?? persisted.providerName`) — this also fixes what would otherwise have been missing EVT-2 evidence.
- **`--profile` scoping × `--chain`**: compositional (select chain → filter to profile providers), empty intersection classified `provider.chain.empty`; documented.
- **Stub/real divergence**: no remaining flag without real-edge coverage; stub rows in `provider-profile-cli.test.ts` remain contract echoes only.
- **capability-denied exit routing**: verified not mis-projected to the exit-2 refused envelope.
- **Base-less lifecycle**: unreachable (no preference chain → `provider.profile.absent` before lifecycle).
- **Unicode/event-boundary**: astral and surrogate cases terminate within 1024 bytes (spot-checked in this review).
- **Secrets/hermeticity**: canary (`CANARY-SECRET`) absent from `--for-spawn` and watch-status envelopes (edge tests `:228`, `:314`).

### New findings

1. **[low · evidence hygiene] Phase-10 commit hash deferred but not yet recorded anywhere.** The pm-notes phase-10 entry says "commit hash recorded in the delivery completion report (a commit cannot contain its own hash)", but no artifact in the change folder names `9c3125ce` (grep: zero hits); the phases 1-9 ledger (`chg-GH-234-pm-notes.yaml:97`) consolidated hashes in a later entry and no phase-10 equivalent has been appended. Attribution is unambiguous from git history and the Conventional Commit message, so this is a ledger-discipline gap only. Fix opportunistically at the next pm-notes touch (dod_check/PR), not a remediation phase.
2. **[info] Phase-10 declared scope contains four benign declared-but-unchanged entries** (`provider-profile-cli.test.ts`, `provider-profile-park-switch-revert.test.ts`, `tests/fixtures/provider/profile/golden/data.ts`, `tests/fixtures/provider/profile/lifecycle/`) — the golden was *joined* by an engine-path golden (task 10.2's explicitly allowed branch) and the existing suites needed no changes. Same accepted class as iteration 1's declared-but-unchanged notes.
3. **[info] Production target records carry only `switch`/`revert` reasons.** A first plain selection of the base persists no EVT-4 record (appends occur only on change), so `reason: "selection"` remains machinery/test-reachable but not production-reachable. This matches the remediation contract (task 10.2) and the synced spec wording ("persists the target when it changed"); recorded for the record.

## Regression sweep (everything iteration 1 verified clean)

- **Five binding delivery decisions — all still honored**: declared-order pacing precedence (`profile-pacing.ts` untouched by remediation); legacy hook byte-unchanged (`git diff main-tools...HEAD -- scripts/ceo-loop.sh scripts/hooks/pre-opencode-iteration-zai.sh` empty + hook regression 39/39 + structure sha256 rows green); fixture-proven vendor mappings, zero live network (adapters untouched by the delta); `provider.profiles` empty-by-default fail-closed (defaults untouched; `provider.profile.absent` re-verified live); structured envRecord + serialized data-v1 both tested (both suites extended, not replaced).
- **Previously verified-clean surfaces**: env-record hardening intact (extended, wrapper validation kept); hermeticity (canaries, injected ports everywhere incl. the new suite); secret safety (allowlist still exactly 5 entries, 225 production files clean); boundary confinement (251 modules, 660 dependencies, 0 violations — no new edge); brand neutrality unaffected.

### Gates re-run in this review (all green)

| Gate | Result |
|---|---|
| `pnpm typecheck` | green (all 6 packages + `tests/types`) |
| edge-wiring + profile-cli + resolve golden | 35 pass / 0 fail |
| park-switch-revert + config + env-record + evidence-bounds | 62 pass / 0 fail |
| selection + probes + pacing + watch-mappings + watch-status + spawn + legacy table | 99 pass / 0 fail |
| structure(provider-surface) + hermetic + secret-read-boundary suites | 39 pass / 0 fail |
| `scripts/checks/error-table-sync.ts` | 91 entries / 91 documented, OK |
| `pnpm check:boundaries` + secret-read + ambient-globals + workspace-entrypoints | 251 modules 0 violations; 5 allowlisted; 95 files clean; declarations match |
| `bash scripts/.tests/test-hook-regression.sh` | 39 pass / 0 fail |
| `git diff --check`, working tree | clean |
| **Aggregate `pnpm check`** | **4742 pass / 4 skip / 2 fail (4748 tests, 469 files)** — the only failures are the two accepted environmental ones: TC-STATE-021 (Corepack pnpm 12.18.0 download, no network) and CI-parity (cross-device `git clone --local`); verified in two independent runs with identical results and no new failures |

## Spec & plan audit (phase 10)

- Tasks 10.1-10.7 all delivered in one Conventional Commit (`9c3125ce`) plus the docs-sync commit (`e24d4a84`), matching the phase summary and the one-commit constraint; test results recorded in the pm-notes completion entry.
- Phase-10 coverage extension rows (TC-PROFILE-043/044/046/024..028/009/010/040/042/002/035/037 production halves) all trace to the suites re-run above; no new TC ids, as contracted.
- Docs re-sync verified accurate against code: `--profile` enforcement/scoping/`provider.chain.empty`, lifecycle-on-every-resolve, capability-denied exit class, structural evidence bounds, header rejection — each cross-checked against the implementation in this review.
- Prior deviations 1-5 unchanged and still accurate; no new deviations.

## Structured report

```
Status: PASS
Remediation Phase: NONE (no plan changes required)
Findings Count: 3 new issues (0c / 0h / 0m / 1l / 2i) — all non-blocking observations
Must-fix: none (F-1, F-2 from iteration 1 verified resolved on the production path)
Should-fix: none (F-3..F-6 verified resolved)
Summary: The remediation is genuine end-to-end wiring, not cosmetic: --profile is validated and scoped through the real edge with the over-mocked gap closed by a real-edge test suite, and the switch/revert/persist lifecycle now runs on every production profile resolve with outcomes projected in core, persisted targets, and once-per-episode reverts. All four should-fix items landed with tests; the regression sweep kept every previously-clean surface clean and the aggregate gate matches the recorded ledger exactly (4742 pass, only the two accepted environmental failures).
Plan Status: ALL_TASKS_DONE (10/10 phases incl. remediation phase 10; ledger complete except the deferred phase-10 commit-hash consolidation note)
Plan Gaps: one low evidence-hygiene note (phase-10 commit hash not yet recorded in any artifact); benign declared-but-unchanged phase-10 scope entries
Spec Compliance: PASS (F-9 and F-6/AC-F6-2 production wiring now satisfied; docs re-synced accurately)
Test Coverage Gaps: none — every spec-declared flag and both lifecycle outcomes have production-path coverage
Next Step: PROCEED — continue the lifecycle (dod_check / pr_creation); no further coder remediation required
```
