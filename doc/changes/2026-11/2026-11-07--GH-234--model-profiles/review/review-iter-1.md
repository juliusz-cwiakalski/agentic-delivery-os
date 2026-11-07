# Code Review Iteration 1 — GH-234 (M1-S21: Model profiles and provider watching)

- **Mode**: local (`workItemRef` GH-234, first review)
- **Branch / base**: `feat/GH-234/model-profiles` vs `main-tools` (merge-base `a69b555e`)
- **Diff reviewed**: `main-tools...HEAD` — 109 files, +11,276/−161; implementation commits `cb8c4285..318d3c4c`, docs commits `6d41c64c`/`f29d8f62`
- **Reviewer**: reviewer agent (spec/plan compliance + code-quality heuristics)
- **Date**: 2026-11-07

## Verdict

**Status: FAIL** — 2 must-fix findings (blocking), 4 should-fix (non-blocking), 2 informational.

| | critical | high | medium | low | info |
|---|---|---|---|---|---|
| Findings | 0 | 2 | 1 | 3 | 2 |

Both must-fix findings share one shape: **pure core machinery is delivered and well-tested, but the production composition/wiring is incomplete, and CLI tests pass against stub runtimes that enforce contracts the shipped edge does not.** Everything else in this change is in strong shape — the security surface (env-record hardening, credential port, secret-safety canaries) and the five binding delivery decisions verify clean.

## What was verified (evidence)

Re-run locally in this review, all green:

- New suites: selection/probes/park-switch-revert/pacing (48 pass), env-record/spawn/watch-mappings/watch-status/cli/legacy-decision-table (107 pass), hermetic/evidence-bounds/contract/surface/goldens (31 pass), config/error-table/content-inventory/provider-contract/error-table-sync (173 pass).
- `pnpm typecheck` (all packages incl. `tests/types` type-tests), `pnpm check:boundaries` (251 modules, 0 violations; secret-read allowlist unchanged at 5 entries), `bun run scripts/checks/error-table-sync.ts` (91/91 both directions).
- `bash scripts/.tests/test-hook-regression.sh` → 39 pass / 0 fail.
- Legacy hook byte-unchanged verified two ways: `git diff main-tools...HEAD -- scripts/ceo-loop.sh scripts/hooks/pre-opencode-iteration-zai.sh` is empty **and** the sha256 assertions in `tests/structure/provider-surface.test.ts` match the working-tree hashes (`ddf27f14…`, `67584d6f…`).
- Brand-neutrality: no `ADOS` literal in new production sources (only the pre-existing `packages/adapters/src/legacy/index.ts`); goldens use the synthetic brand; no absolute paths or wall-clock timestamps in goldens.

## Binding delivery decisions (all five honored)

1. **Pacing precedence = declared config order** — VERIFIED. `profile-pacing.ts:55-82` evaluates the first declared priority; no hardcoded ordering among the three goals; duplicate priorities rejected at validation (`validate.ts:631-633`). TC-PROFILE-031 asserts it.
2. **Legacy hook byte-unchanged** — VERIFIED (hash assertion test + direct diff + hook regression suite; see above).
3. **Vendor watch mappings fixture-proven, zero live network** — VERIFIED. The three normalizers are pure text→snapshot mappings; tests read committed fixtures and a missing fixture throws naming itself (`provider-watch-mappings.test.ts:20`); `fetch` spies throw if reached; bracket-access spies are an acceptable equivalent of the banned literal (recorded deviation 5).
4. **`provider.profiles` empty-by-default fail-closed** — VERIFIED. `defaults.ts` ships `profiles: {}`; empty config refuses with `provider.profile.absent` (user-validation → exit 1 per error table and projection.ts).
5. **Envelope envRecord structured map + serialized data-v1 wire form both tested** — VERIFIED. `EnvRecord` carries entries + `serialized` + `recordFormat: data-v1`; envelope/golden tests cover the structured side; the env-record suite validates the serialized grammar byte-level (header, set/unset, final LF, CR/NUL, duplicates, allowlist, homoglyph/metachar/equals-in-name rejection, byte/line/record limits, whole-record refusal).

## Spec & plan audit

- **Plan phases 1-9**: all delivered, one Conventional Commit per phase, ledger in pm-notes matches the commit chain; phase scopes reconcile with the diff except two benign declared-but-unchanged entries (`provider/parks.ts` reused via import, `tests/boundaries/**` already covered — both verified green) and the recorded edge.ts addition (deviation 2). `plan diff` unavailability was replaced by observational reconciliation (deviation 4) — acceptable.
- **Recorded deviations 1-5**: none creates a defect on its own. Watch-config placement (1) is validated fail-closed and keyed to declared providers/credentials; brand-neutral env-record defaults (3) preserve the legacy contract as injectable options exercised by TC-037; deviations (4)/(5) are observational/test-style only.
- **ACs**: AC-F8-1, AC-F6-1, AC-F3-3, AC-F7-4, AC-F1-5, AC-F11-6, AC-F9-7 satisfied with green, traceable suites; AC-F8-8 honestly recorded as milestone-external. **AC-F6-2 is satisfied at machinery level only** — see F2.
- **NFRs**: NFR-1/2/3/5/6/7/9/10/11 verified by suites and boundary checks run in this review; NFR-4 verified (canaries, one-time credential handoff, 0 allowlist growth); NFR-8 partially enforced (F4).

---

## Findings

### MUST-FIX (blocks)

#### F-1 [high · correctness/spec-compliance] `provider resolve --profile` is accepted, echoed, and semantically inert in production; its tested contract exists only in a stub

The grammar accepts `--profile <name>` and the handler passes it to the runtime and echoes it into the success envelope (`packages/cli/src/commands/provider.ts:261-263, 281`). But the production edge handler **ignores it entirely** — it forwards only `chainName` to `engine.resolve` (`packages/cli/src/edge.ts:2284-2302`), and `ProviderResolveInput` has no profile field at all (`packages/core/src/provider/engine.ts:98-102`). Consequences:

- `provider resolve --profile ghost` exits **0** in production and reports `"profile": "ghost"` alongside an unrelated chain decision — the flag implies association without validation or effect.
- The declared contract — spec F-9 ("resolve for a named profile context"), Appendix C, plan task 6.1, and the shipped man-page grammar — is not implemented on the shipped surface.
- `tests/behaviour/provider-profile-cli.test.ts:129-134` asserts the right behavior (unknown profile → exit 1, `provider.profile.invalid`), but only because the injected stub runtime (`:48-54`) enforces it. The over-mocked test masks the production gap (no test exercises the edge wiring for this flag).

**Remediation**: wire the edge `resolve` handler to consume `input.profile`: parse+validate the profile branch, reject unknown names with `provider.profile.invalid` (exit 1), and scope the resolution context (at minimum restrict candidate providers to the named profile's `providers`, or document precisely what "scopes the context" means and implement that). Add a production-wiring (edge-level) test for both the valid and unknown-name paths.

#### F-2 [high · spec-compliance] Profile lifecycle (EVT-1/2 switch/revert events, EVT-4 target persistence) is wired into no production surface; envelope outcomes `switched`/`reverted` are unreachable anywhere

`evaluateProfileLifecycle` / `persistProfileTarget` / `readProfileTarget` are exported from core but consumed by **no** production code (`packages/cli/src`, `packages/mcp/src`, `packages/opencode/src` — zero references; tests only). The edge `profileResolve` path calls only `selectProfile` / `resolveProfileForSpawn` (`packages/cli/src/edge.ts:2330-2398`). Additionally, `selectProfile` only ever returns `outcome: "selected"` (`packages/core/src/provider/profile.ts:314`); nothing in core composes a `ProfileSelectionResult` with `outcome: "switched" | "reverted"` even though the union declares them (`packages/core/src/contracts/provider-profile.ts:292`) — the golden `"outcome": "switched"` is hand-constructed in the fixture (`tests/fixtures/provider/profile/golden/data.ts:65`). Consequences:

- On current spawn surfaces, spec F-6/AC-F6-2's "the switch event carries the new target and the revert condition; the target persists in state" holds only under injected facts. A condition the production sync probe **can** detect today (a declared peak window parking the base profile's provider) silently selects the fallback with no EVT-1 event, no persisted target, and envelope outcome `selected` — the advertised `switched`/`reverted` outcomes and human text (`resolved X (switched)`) can never occur.
- The recorded deviation (2) covers the probe's synchronicity (async quota probing deferred to M1-S9); it does **not** record the lifecycle/persistence non-wiring or the unreachable envelope outcomes. Unrecorded + contradicts F-6/DM-8/KPI rows ("Exhaustion episodes without an automatic switch … 0").

**Remediation** (either):
1. Wire lifecycle into the edge `profileResolve` path: after selection, `readProfileTarget` → `evaluateProfileLifecycle` → `persistProfileTarget` (using the provider engine's state store discipline), and project the outcome (`switched`/`reverted`) into the returned `ProfileSelectionResult` in core so the envelope outcomes are real; add a production-path test; or
2. If the PM confirms deferral to M1-S9, record it as an explicit deviation in pm-notes, adjust the envelope/golden/man-page contract so `switched`/`reverted` is documented as daemon-activated, and note in §10 that EVT-1/2/4 are machinery-only in this change.

### SHOULD-FIX (non-blocking)

#### F-3 [medium · guarded-vocabulary hygiene] `provider.profile.capability-denied` is declared and documented but raised by no code path

Declared in the machine table (`packages/core/src/contracts/error-table.ts:191-201`) and the documented S2 row (`doc/spec/features/feature-result-contract.md:140`), but grep shows no raiser: all refusals — including all-capability-refused — raise `provider.profile.unavailable`. The error-table sync test checks bidirectional presence only, so dead rows persist silently (F-10/RSK-1 guard against vocabulary drift). Fix: raise `capability-denied` when every blocker on the losing candidates is a capability blocker (or drop the row in both tables).

#### F-4 [low · NFR-8 enforcement] Evidence 1024-byte bound enforced by message truncation only; evidence content can still exceed it

`createProfileEvent` truncates only `message` when the serialized event exceeds 1024 bytes (`packages/core/src/provider/profile.ts:176-181`); no re-check after truncation, and the arithmetic assumes 1-byte chars. Unbounded evidence values can still overflow the bound: `blockers[]` strings are built from all ineligible profiles (`profile.ts:263-264`), and profile/provider/seat names have no length cap in validation (`validate.ts:515-516`). NFR-8 targets 100% of events ≤1024 bytes. Fix: cap evidence array lengths and per-string sizes at projection time, and re-assert the bound after truncation.

#### F-5 [low · config hardening] `envRecord.header` validated only as non-empty; `namePattern` recompiled per name

A configured header containing LF/CR/NUL passes validation (`packages/core/src/provider/validate.ts:705-708`) and renders a serialized record (`profile-env-record.ts:99-102`) that the wrapper's byte-level validation will reject downstream — fail-closed at consumption (entries, not the header, feed the spawn environment, so nothing is injectable), but the misconfiguration should be a classified config error at parse time. Also `nameAllowed` compiles the allowlist `new RegExp(pattern)` per name per record (`profile-env-record.ts:90-93`); compile once per resolved policy.

#### F-6 [low · documentation accuracy] Test-plan §10 aggregate row overstates the gate result

`chg-GH-234-test-plan.md` §10 "Aggregate" row says "`pnpm check` green", while the pm-notes ledger records 4731/4733 with two named environmental failures (TC-STATE-021 corepack download; CI-parity cross-device clone). Plan task 9.5's own rule is "never record unrun results as passing" — the row should name the two environmental failures explicitly rather than read as fully green.

### INFORMATIONAL (no action required)

#### F-7 [info] Heuristic scoring and the vision gate await task-fact consumers

`scoreProfileTask` / `familyDiversityAllowed` (`profile.ts:63-79`) and `requireVision` (`profile.ts:240`) are pure, tested machinery, but no production surface supplies task facts — the edge never sets `requireVision`. Consistent with DEC-6/NG-1 (M1-S9 daemon / M1-S20 agent integration own task-fact surfaces); recorded so PR reviewers know the heuristics are not exercised by any production resolve today.

#### F-8 [info] Integer-only percentages classify fractional vendor data as outage

`Number.isInteger(percentage)` in the normalizers (`coding-plan.ts:48`, `openai.ts:55`) means a vendor reporting `61.5` percent classifies as malformed → outage — never a wrong clear condition. Safe direction; fixture shapes pin integers. Worth revisiting only if a vendor shape drifts.

---

## Positive observations (for the record / next-iteration dedup)

- Env-record hardening is genuinely strong: strict ASCII identifier + exact allowlist + duplicate/CR/NUL/final-LF/byte-limit checks; whole-record refusal; values are data everywhere; the `variables` map (not the serialized text) feeds the spawn port; `buildHarnessSpawnEnvironment` keeps deny-by-default with `record` values only filling declared variables.
- Config validation matrix is thorough (unknown keys/references, closed sets, regex-compilability of `namePattern`, HTTPS-no-userinfo endpoints, credential refs, duplicate chain/priority), pure, and names the offending field.
- Watch status reader is structurally zero-write (no store parameter), credential-port-only, one-time material handoff, transport failures and malformed bodies never clear.
- Docs reconciliation is complete: new `feature-provider-profiles.md` registered in the forbidden-literals registry; engine spec exclusion flipped with cross-links; error-table S2 rows synced 91/91; glossary/man page/registry updated; changeset matches the fixed five-package lockstep group.

## Environmental gate failures (excluded per review instructions, verified non-code)

TC-STATE-021 (corepack pnpm 12.18.0 download, no network) and CI-baseline parity (`git clone --local` cross-device). Neither touches provider/profile code; the affected suites are unchanged by this branch and the local re-runs above pass.

## Structured report

```
Status: FAIL
Remediation Phase: NOT APPENDED (reviewer ran read-only per invocation; orchestrator to append "Phase X: Code Review Remediation (Iteration 1)" covering F-1..F-6)
Findings Count: 8 issues (0c / 2h / 1m / 3l / 2i)
Must-fix: F-1 (resolve --profile inert in production), F-2 (lifecycle/persistence unwired; switched/reverted outcomes unreachable)
Summary: Strong, well-tested pure machinery and a verifiably hardened security surface; all five binding delivery decisions honored and the legacy hook is byte-unchanged. Two composition gaps block: the --profile flag is grammar-only in production behind a stub-tested contract, and the switch/revert/persist lifecycle (EVT-1/2/4) is unreachable on every production surface, leaving advertised envelope outcomes dead.
Plan Status: ALL_TASKS_DONE (9/9 phases, 56/56 tasks, ledger matches commits)
Plan Gaps: benign declared-but-unchanged scope entries (parks.ts, tests/boundaries/**); edge.ts addition recorded as deviation 2
Spec Compliance: FAIL (F-9 --profile semantics; F-6/AC-F6-2 production wiring)
Test Coverage Gaps: no production-wiring (edge-level) test for resolve --profile; no production-path test for switch/revert/persist outcomes
Next Step: CALL_CODER — remediate F-1 and F-2 (plus F-3..F-6 if cheap), then re-review (iteration 2)
```
