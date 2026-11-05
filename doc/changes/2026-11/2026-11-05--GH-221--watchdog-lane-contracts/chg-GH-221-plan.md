---
id: chg-GH-221-watchdog-lane-contracts
status: Proposed
created: 2026-11-05T00:00:00Z
last_updated: 2026-11-05T12:00:00Z
owners: [engineering]
service: delivery-os CLI watchdog command family and core contracts
labels: [change, m1]
links:
  change_spec: ./chg-GH-221-spec.md
  test_plan: ./chg-GH-221-test-plan.md
  pm_notes: ./chg-GH-221-pm-notes.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >
  Deliver the `watchdog` command family — `preflight <lane>`, `teardown <lane>`,
  `liveness <lane>` — as checks, not a runner: preflight refuses dirty or
  non-base checkouts with named evidence and mutates nothing, teardown restores
  on every exit path and reports each action while verifying agent-memory
  publications are committed or preserved (never discarded), and liveness ships
  contract-first with the verdict vocabulary, the signals envelope, and the
  `watchdog.signals-absent` classification for absent sources (unknown, never
  guessed; CPU is never the only signal). A `watchdog` domain kind joins the
  closed error-table union with exactly three identities; every probe projects
  through the existing v1 envelope and the `{0, 1, 2}` exit taxonomy.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-221: Watchdog and lane contracts (M1-S1)

## Context and Goals

This plan implements the completed specification `chg-GH-221-spec.md` v1.0 (F-1..F-6, DM-1..DM-5, NFR-1..NFR-7, DEC-1..DEC-5, 14 acceptance criteria, §8.1 interface matrix, Appendix B verdict/exit matrix) and the completed test plan `chg-GH-221-test-plan.md` v1.0 (35 TCs, `TC-WATCHDOG-001..070`, 14/14 AC coverage, §7 automation plan and expected suite homes). The spec and test plan are the source of truth; this plan sequences the work, binds each task to exact files, TCs, and ACs, and resolves the delivery-bound questions the test plan routed here (GAP-T4, OQ-T1, OQ-T3, OQ-T4, OQ-T5). It adds no product requirement and reshapes no TC identity, assertion, exit, or AC mapping.

**What this change delivers.** One check-only command family — `watchdog preflight <lane>`, `watchdog teardown <lane>`, `watchdog liveness <lane>` — over a data-only contract module, a pure domain tier, a bounded git seam extension, and the shared CLI edge. Preflight is fail-closed admission control: dirty checkout → `watchdog.checkout-dirty` (exit `1`), off-base checkout → `watchdog.checkout-non-base` (exit `1`), both with evidence naming expected-vs-actual or the dirt; clean on-base → `ok` (exit `0`); it performs zero mutation on every outcome. Teardown is the caller-invoked restoration contract: checkout restored to the lane's declared base, lane-attributable residue removed with report entries, stranded/detached commits preserved through attributed refs, unattributable content and uncommitted agent-memory publications preserved in place and reported — never discarded or clobbered. Liveness ships contract-first: the declared signals shape (`heartbeatAgeMs`, `tokenDelta`, `traffic`), no CPU field, and absent signal sources → `watchdog.signals-absent` (exit `2`, no verdict anywhere in the payload). Every invocation emits exactly one exclusive v1 envelope; exits stay in `{0, 1, 2}`; the surface renders through the branding seam and never dispatches, spawns a session, kills, restarts, or supervises.

**Code-reality facts this plan relies on (verified 2026-11-05).**

- `ERROR_TABLE` in `packages/core/src/contracts/error-table.ts` currently holds **41** entries (39 literal `code:` rows plus the two `fallback` constants); `DOMAIN_KINDS` ends with `closeout`. `tests/structure/error-table.test.ts` pins `expect(entries).toHaveLength(41)` at two occurrences (lines ~650, ~726) plus per-kind filters. `tests/checks/error-table-sync.test.ts` guards `live.length !== BASELINE_ROWS.length + 7` and `counts.sourceEntries === BASELINE_ROWS.length + 7` (the frozen baseline plus the 3 `verify` and 4 `db` rows). Adding 3 `watchdog` rows moves the total to **44** and both guards to `+10`; counts are updated to exact values, never loosened to bounds (TR-6).
- The documented binding table is `doc/spec/features/feature-result-contract.md`: the §"Machine-readable error table" prose lists `DOMAIN_KINDS` and per-kind identities; the row table ends with the four `closeout.*` rows. The two-way sync (`scripts/checks/error-table-sync.ts`, S1 = CLI + contracts scan) requires machine rows and documented rows to land in the same commit (NFR-7, test-plan §8.2).
- The v1 result envelope lives in `packages/core/src/contracts/result.ts`: exclusive `data`/`error`, four mandatory fields (`schemaVersion`, `runId`, `exitCode`, `timing`), and exit projection from the envelope side (`projectExitCode`) in `packages/cli/src/index.ts`. Handlers return `{ data }` or `{ error: { kind, code, summary } }` — the `queue` grammar rejection (`summary: "result=failed; reason=grammar"`) is the evidence-in-summary precedent. `scripts/checks/exit-code-literals.ts` confines exit literals to the CLI projection.
- The command pattern: `createQueueReadyCommandDefinition` / `createVerifyCommandDefinition` factories in `packages/cli/src/commands/`, exported via `packages/cli/src/commands/index.ts`, registered in `createConfigProgram` behind an optional `ConfigProgramOptions` member guarded by `!== undefined` in `packages/cli/src/edge.ts`. `CommandDefinition` carries `flags`, `positionals: { max }`, optional `humanText(data, brand)`, and `handler`. `--json` is stripped by the shared parser.
- The bounded git child seam `packages/adapters/src/git/index.ts` (GH-183) already exposes `GitChildRunner`, timeout/`killSignal` discipline, safe-ref validation, `readCheckout`/`isClean`/`resolveRef`/`restoreCheckout`/`deleteBranch`. `.dependency-cruiser.cjs` `runtime-apis-confinement` scopes `^packages/adapters/src/git/` by directory, so a new module inside that subpath needs **no rule change** and therefore no new negative fixture. The read-only `packages/adapters/src/repo/` reader (fs-only, no spawn) is unchanged by this change.
- The pure-domain pattern: `packages/core/src/domain/verify-gates.ts` / `verify-change.ts` / `closeout.ts` with injected ports, re-exported through `packages/core/src/domain/index.ts` and the package root `packages/core/src/index.ts` so `@delivery-os/cli` imports from `@delivery-os/core`.
- Workspace binding obligations: every new `packages/**/src/**` file lands in `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`; contract surfaces bind to `tests/fixtures/ports/v1-contract-inventory.json`; `scripts/checks/ambient-globals.ts` scopes `packages/core/src/{contracts,domain}/**` automatically by directory.
- The true-positive corpus is `tests/fixtures/result/code-corpora/true-positives.json`; the `unknown`-consequence allowlist is `tests/fixtures/result/unknown-consequence-allowlist.json` (not needed if all three rows use `not_landed`, the preferred consequence).
- Release versioning is lockstep: `.changeset/config.json` fixes the five publishables (`core`, `adapters`, `cli`, `mcp`, `opencode`); every prior feature change ships one `*-minor.md` changeset bumping all five.
- Real-git fixture precedent: `tests/fixtures/closeout/temp-git.ts` (`mkdtemp`, `git init -b main`, fixed author, `remove()`).

**Settled inputs — this plan does NOT re-decide them.** DEC-1 (memory-publish verification inside teardown), DEC-2 (liveness contract-first; ingestion is M1-S15/SC-M1-14), DEC-3 (CPU is never the only signal), DEC-4 (checks, not a runner), DEC-5 (a `watchdog` domain kind with exactly the three man-page identities). NG-1..NG-6 hold as written.

### Delivery pins (resolving test-plan OQ-T1, OQ-T3, OQ-T4, OQ-T5 and GAP-T5)

These pins bind delivery choices the tests deliberately leave open. They may not be re-bound during delivery; a challenge routes through PM/`@decision-advisor`, never a silent change.

| PIN | Binding |
|---|---|
| PIN-1 — failure evidence carrier (OQ-T1/GAP-T5) | Failure evidence rides `error.summary` on the failure envelope (the delivered `queue` grammar-rejection pattern); success evidence rides `data.evidence`. Tests assert a non-empty evidence string on the non-empty side plus the exact code/exit — no dedicated failure field is added and the envelope stays exclusive. |
| PIN-2 — unevaluable and torn facts (OQ-T3) | Unresolvable base ref, unreadable checkout facts, and contradictory checkout facts classify `input.value.rejected` (exit `1`) with evidence naming the unevaluable fact — fail-closed admission control; a torn state-store lane read keeps the delivered `state.store.torn` classification. No fourth watchdog identity is added; tests assert "classified, non-zero, never `ok`, resolvable in `ERROR_TABLE`" (TC-WATCHDOG-014/015), which these mappings satisfy. |
| PIN-3 — preservation locations (OQ-T4) | Stranded/detached commits reachable from no branch are preserved by creating/updating one attributed ref per lane (`watchdog-preserved/<lane>`) through the git seam, reported with the commit hash. A lane branch carrying the delivered commit is preserved as-is (it is already the attributed ref); teardown never deletes a commit-bearing branch — branch cleanup is the delivered `closeout` surface, not the watchdog's. Uncommitted memory publications, staged memory changes, and unattributable untracked content are preserved in place (no stage/commit/revert/clean) and reported. Lane-attributable workspace residue (paths under the lane's declared workspace) is removed with a report entry per item. |
| PIN-4 — adapter home (OQ-T5) | The watchdog git surface is a new module `packages/adapters/src/git/watchdog.ts` inside the existing `@delivery-os/adapters/git` subpath, reusing `GitChildRunner`, the timeout/`killSignal` discipline, and safe-ref validation. No new subpath, no dependency-cruiser rule change, no new negative fixture (the `^packages/adapters/src/git/` confinement entry already covers the directory). The read-only `repo` reader is untouched. |
| PIN-5 — lane context source | The lane identifier resolves to a lane record (declared base, lane workspace paths) through a state-layer read via the injected port (GH-174 consumed, not extended). An unknown/malformed lane → `input.value.rejected` (TC-WATCHDOG-053's handler identity); a torn record → `state.store.torn` (TC-WATCHDOG-015). Fixtures inject lane records; no `lanes` surface is added (NG-3). |
| PIN-6 — liveness M1-S1 wiring | The command runtime declares a signal-source enumeration port; the production edge wires zero sources in M1-S1, so every production liveness run classifies `watchdog.signals-absent`. The pure classifier accepts only the declared signals shape (no CPU field exists in the input type), making CPU-only `stalled` structurally impossible; `stalled` additionally requires corroboration across declared progress signals (TC-WATCHDOG-042). |
| PIN-7 — error-row binding columns | `watchdog.checkout-dirty` and `watchdog.checkout-non-base`: category `user`, `retryable: false`, consequence `not_landed`, `projectionClass: "user-validation"` (exit `1`). `watchdog.signals-absent`: category `platform`, `retryable: true`, consequence `not_landed`, `projectionClass: "platform-provider"` (exit `2`). Exact remediation-hint and summary text is delivery-bound within the sync check's column equality; hints are non-empty. Rows append in that exact order after the `closeout` rows. |

### Open questions

- **None blocking.** GAP-T4 (plan absent) is closed by this file. GAP-T1 (sourced liveness control) is deferred by design to M1-S15; TC-WATCHDOG-040 covers the reachable half.
- **GAP-T2 / OQ-T2 — `stalled` exit `1` machine representation (deferred, M1-S15).** The v1 projection derives exit from the envelope side and no error identity is declared for a sourced stall. Decision needed: consult `@decision-advisor` when M1-S15 (GH-232 area) delivers signal ingestion; decision-record placeholder: `doc/decisions/ADR-000X-m1s15-stalled-verdict-exit-representation.md`. Until then `stalled`/`progressing` are declared contract data only, and TC-WATCHDOG-005/041 assert exactly that (including the M1-S15 dependency note in the matrix fixture).

## Scope

### In Scope

- F-1: `watchdog preflight <lane>` — dirty/off-base refusal with named evidence, clean on-base admission, fail-closed unevaluable/torn handling, read-only on every outcome (AC-F1-1..3).
- F-2: `watchdog teardown <lane>` — restoration on every exit path with an evidence-bearing restoration report; the stranded/foreign fixture matrix ends refused or restored, zero silent outcomes (AC-F2-1..3).
- F-3: memory-publish verification inside teardown — committed → reported `committed`; uncommitted → preserved byte-identically and reported `preserved`; never deleted or clobbered (AC-F3-1, DEC-1).
- F-4: the liveness contract — verdict vocabulary, signals shape, evidence field, `watchdog.signals-absent` with no verdict and exit `2`, CPU-only-can-never-stall (AC-F4-1/2, DEC-2, DEC-3).
- F-5: the `watchdog` domain kind with exactly three rows, documented rows in the same phase, total `{0,1,2}` exit mapping, exactly one exclusive envelope per invocation, text/`--json` evidence parity, grammar and unknown-lane failures through existing identities (AC-F5-1..3).
- F-6: checks-not-runner surface — no dispatch/spawn/kill/restart/supervise, check-oriented grammar, brand-neutral rendering (AC-F6-1/2).
- The 35-TC verification battery across structure, behaviour (real temp git repos/worktrees), golden, and checks suites, plus NFR-4 replay determinism.

### Out of Scope

- [OUT] Real progress-signal ingestion and sourced `stalled`/`progressing` outcomes (NG-1, M1-S15 / SC-M1-14, GAP-T1/T2).
- [OUT] Daemon consumption (M1-S18), supervise (M2-S2), the `lanes` surface, scheduling, dispatch, restart budgeting, session kill (NG-2, NG-3).
- [OUT] State-layer contract changes, envelope-shape changes, exit codes beyond `{0,1,2}`, a fourth watchdog identity (NG-4, NG-5).
- [OUT] Bash-era stack changes or parity claims (NG-6).
- [OUT] Lane-branch deletion or any closeout-branch-cleanup behavior (delivered GH-183 surface; PIN-3).
- [OUT] New packages, subpaths, dependencies, configuration keys, or boundary-rule loosening.

### Constraints

- Tier rules (`.ai/rules/typescript.md`): contracts are data/types only (no runtime imports); domain is runtime-neutral (no clock/randomness/env/fs — injected ports only); I/O only in adapters and the CLI edge; no `any`/`!`/unjustified `as`.
- The v1 envelope, the closed domain-kind union, the `{0,1,2}` projection, and the branding seam are reused unchanged (NG-4, NG-5); exit literals stay confined to the CLI projection (`scripts/checks/exit-code-literals.ts`).
- NFR-7 same-phase obligation: machine rows, documented rows in `doc/spec/features/feature-result-contract.md`, and the binding-suite count updates land in one commit (Phase 1); counts move `41 → 44` and `+7 → +10` exactly, never to bounds.
- Checks-not-runner (DEC-4): no dispatch/session-spawn/kill/restart/supervise anywhere; local `git` child processes for inspection/restoration are the expected mechanism and are not "spawning a lane" (TC-WATCHDOG-060 note).
- Teardown preserves first: anything unattributable to the lane is preserved and reported, never silently removed (RSK-2); memory publications are protected by F-3 on every path.
- The battery is offline: `mkdtemp` temp repos, `git init -b main`, fixed author identity, injected clock/brand/run-id/streams, no network/credentials/host state; a guard rejects any fixture root equal to `process.cwd()` (TR-5).
- Suite homes follow test-plan §7 (GAP-T3: renames allowed, tier rules/TC assertions/AC mapping not); no test file precedes its subject.
- Every phase that adds `packages/**/src/**` files updates `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` in the same commit.

### Risks

- **RSK-1** — contract-first liveness mistaken for a working stall detector. Mitigated by exit `2` + no-verdict payloads (TC-WATCHDOG-040), declared-data-only assertions (TC-WATCHDOG-041/043), and the recorded M1-S15 decision dependency (GAP-T2).
- **RSK-2** — teardown damages unattributable work. Mitigated by PIN-3 preservation semantics, destructive-negative tests (TC-WATCHDOG-026), and the git call-log assertion scoping prohibitions to `.ai/memory` destructive ops.
- **RSK-3** — table/doc drift. Mitigated by the Phase 1 same-commit binding and the two-way sync check (TC-WATCHDOG-003/004).
- **RSK-4** — wrong refusals from base ambiguity. Mitigated by PIN-5 (declared base is the only comparison target) and expected-vs-actual evidence.
- **TR-3/TR-5 (delivery)** — git-fixture flakiness and live-tree safety. Mitigated by explicit `init -b main`, fixed author, bounded commands, `afterEach` cleanup, and the fixture-root guard.
- **TR-6 (delivery)** — stale hardcoded counts break suites mid-delivery. Mitigated by updating both `toHaveLength` sites and both `+7` guards in the Phase 1 commit.
- **TR-11 (delivery)** — unreachable verdicts asserted as reachable. Mitigated by TC-WATCHDOG-041/043 contract-only framing; reviews verify no fixture claims a sourced outcome.

### Success Metrics

| Metric | Target |
|--------|--------|
| Stranded/foreign fixtures refused or restored with named evidence | 100% (TC-WATCHDOG-030) |
| Exit-`0` outcomes for refused, stalled, or unavailable probes | 0 (NFR-1) |
| Refusals/restorations/verdicts without evidence | 0 (NFR-3) |
| Teardown runs discarding or clobbering uncommitted memory publications | 0 (NFR-5) |
| Verdicts produced from absent signal sources | 0 — always `watchdog.signals-absent` |
| Stall verdicts derivable from a single (CPU-only) signal | 0 |
| Invocations exiting outside `{0,1,2}` or emitting an invalid envelope | 0 (NFR-2) |
| Watchdog rows round-tripping with documented rows / existing rows modified | 3/3 / 0 (NFR-7) |
| Replay drift across identical checkout/lane facts | 0 (NFR-4, TC-WATCHDOG-070) |
| Product/binary literals in the new surface; contracts carrying behavior; domain importing beyond contracts | 0 / 0 / 0 (NFR-6) |

## Phases

### Phase 1: Watchdog contracts, error-table kind, and documented rows

**Goal**: Land the data-only contract module, the `watchdog` domain kind with exactly three rows, the documented rows, the corpora, and every binding-suite count update in one commit, so the two-way sync check never sees a half-added identity and later phases compile against one vocabulary.

**Tasks**:

- [ ] **1.1** Create `packages/core/src/contracts/watchdog.ts` — types and `as const` data only, no runtime imports: `WATCHDOG_VERDICTS = ["ok", "refused", "stalled", "progressing"]` with the `WatchdogVerdict` union derived from the same single declaration (DM-1); `WATCHDOG_SIGNAL_KEYS = ["heartbeatAgeMs", "tokenDelta", "traffic"]` and the `WatchdogSignals` shape declaring no CPU field (DM-2); the lane-reference and evidence types (expected-vs-actual finding, actions taken) (DM-3); the restoration-report types — ordered action entries (kind, observation, non-empty evidence) and memory-publication entries with `committed` / `preserved` status (DM-4); the preflight/teardown/liveness result-data types whose `--json` `data` carries `verdict`, `signals`, `evidence`; probe-kind distinctions (preflight/teardown/liveness). Export through `packages/core/src/contracts/index.ts`. **AC/TC**: AC-F4-2 (contract half), DM-1..DM-4; TC-WATCHDOG-001, TC-WATCHDOG-041 (structure halves). **Verify**: `pnpm typecheck`.
- [ ] **1.2** Extend `packages/core/src/contracts/error-table.ts`: append `"watchdog"` to `DOMAIN_KINDS` (after `closeout`); append the three rows in the pinned order and binding columns (PIN-7): `watchdog.checkout-dirty`, `watchdog.checkout-non-base` (both `user-validation`, exit `1`), `watchdog.signals-absent` (`platform-provider`, exit `2`), following the existing `ErrorTableEntry` shape. No existing row changes. **AC/TC**: AC-F5-1 (table half), DM-5, DEC-5; TC-WATCHDOG-003 (row half). **Verify**: `pnpm typecheck`.
- [ ] **1.3** Same-commit documented rows and binding-count updates: append the three documented rows to `doc/spec/features/feature-result-contract.md` after `closeout.branch.unsafe`; extend the §"Machine-readable error table" prose to list `watchdog` in `DOMAIN_KINDS` and name the three identities. Update `tests/checks/error-table-sync.test.ts`: both `BASELINE_ROWS.length + 7` guards become `+ 10` (lines ~962 and ~1056), and the kinds-map expectation gains `watchdog: 3`. Update `tests/structure/error-table.test.ts`: both `toHaveLength(41)` occurrences become `44`, and the per-kind filter block gains `watchdog` → `toHaveLength(3)`. Add one true-positive corpus row per watchdog code to `tests/fixtures/result/code-corpora/true-positives.json`. Exact counts only — no bound-loosening (TR-6). **AC/TC**: AC-F5-1, NFR-7; TC-WATCHDOG-003, TC-WATCHDOG-004 (binding halves). **Verify**: `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts`.
- [ ] **1.4** Extend `tests/structure/error-table.test.ts` with the full TC-WATCHDOG-003 assertions: exactly the three codes in order; every column valid with a non-empty remediation hint; the two refusal rows project `user-validation` and the signals-absent row `platform-provider` (Appendix B); `classifyDomainKind("watchdog", code)` returns the exact row, `resolveAppErrorCode` round-trips, `classifyThrown({ kind: "watchdog", code })` matches; a kind-only `"watchdog"` is ambiguous and contains `fallback.internal`; a wrong code under `watchdog` contains; the pre-existing provider/input/config/state/lint/verify/db/closeout rows stay byte-identical. **AC/TC**: AC-F5-1, NFR-7; TC-WATCHDOG-003. **Verify**: `bun test tests/structure/error-table.test.ts`.
- [ ] **1.5** Create `tests/structure/watchdog-contract.test.ts` — TC-WATCHDOG-001: exact ordered vocabulary, exact signal keys with no CPU field, the AST data-only detector over the module (type/interface/import/export/`as const` only), the no-second-home scan across `packages/`, and the temp-copy mutation probe (injected `import "node:fs"` or an executable statement is rejected naming file and kind). TC-WATCHDOG-041: exact set/order with no duplicate or extra member, one home, `as const` string literals so union and runtime list cannot drift, no M1-S1 runtime path emits `stalled`/`progressing` (asserted as declared contract values reserved for M1-S15, named in the test), and the fifth-value/second-declaration mutants fail. **AC/TC**: AC-F4-2, DM-1, DM-2, NFR-6; TC-WATCHDOG-001, TC-WATCHDOG-041. **Verify**: `bun test tests/structure/watchdog-contract.test.ts`.
- [ ] **1.6** Bind the new contract surface to the workspace inventories in the same commit: `tests/structure/inventory.json`, `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json`, and the port-neutrality scanned-module list. Confirm no subpath/entrypoint drift. **AC/TC**: NFR-6; supports TC-WATCHDOG-002. **Verify**: `bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts`.

**Acceptance Criteria**:

- Must: AC-F5-1 — `watchdog` is in `DOMAIN_KINDS` with exactly the three documented identities in order, correct projection classes, and the table at exactly 44 entries; the sync check is green in both directions.
- Must: AC-F4-2 (contract half) — the vocabulary and signals shape are exact, single-homed, data-only contract data.
- Must: zero existing rows or binding-suite assertions weakened.
- Should: `WatchdogVerdict` and the runtime vocabulary derive from one declaration.

**Files and modules**:

- Code areas: `packages/core/src/contracts/watchdog.ts` (new), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/contracts/error-table.ts` (updated), `doc/spec/features/feature-result-contract.md` (updated — three rows + prose), `tests/structure/error-table.test.ts` (updated), `tests/checks/error-table-sync.test.ts` (updated), `tests/fixtures/result/code-corpora/true-positives.json` (updated), `tests/structure/watchdog-contract.test.ts` (new), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (targeted same-phase update; the new watchdog feature spec is Phase 6).

**Tests**:

- `pnpm typecheck`
- `bun run scripts/checks/error-table-sync.ts`
- `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/structure/watchdog-contract.test.ts`
- `bun test tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/subpaths.test.ts`

**Completion signal**: `feat(GH-221): add watchdog contracts and error-table kind with documented rows`

---

### Phase 2: Pure domain evaluation services

**Goal**: Deliver the runtime-neutral evaluation core — preflight classification, teardown restoration planning/reporting with memory-publish verification, and liveness classification — with injected ports and no I/O, so the CLI phase is pure composition.

**Tasks**:

- [ ] **2.1** Add preflight evaluation to `packages/core/src/domain/watchdog.ts` (new): consumes the lane record (declared base, workspace paths — PIN-5) and checkout facts through injected port types; classifies admission (`ok`) versus `watchdog.checkout-dirty` / `watchdog.checkout-non-base` with evidence strings naming the dirt (expected base vs. actual, or the dirty state); unevaluable and contradictory facts fail closed per PIN-2 (`input.value.rejected`; torn reads surface `state.store.torn`); the evaluation is read-only — it returns a classification, never a mutation. Mirrors the `verify-gates.ts`/`verify-change.ts` injected-port pattern. **AC/TC**: AC-F1-1..3 (classification), NFR-1, NFR-3; grounds TC-WATCHDOG-010..015. **Verify**: `pnpm typecheck`.
- [ ] **2.2** Add teardown restoration planning and memory-publish verification (same module): from repository facts, build the ordered restoration plan — checkout restore to the declared base, lane-attributable residue removal (reported per item), stranded/detached-commit preservation via the attributed ref (PIN-3), unattributable-content preservation in place, and memory-publication verification (committed → reported `committed` with file+commit evidence; uncommitted/untracked/staged → preserved in place and reported `preserved`; never stage, commit, revert, or clean them); emit the restoration-report data (ordered action entries with kind/observation/evidence; memory entries with status) and the verdict-bearing data carrier (`verdict`, `signals` (empty when not applicable), `evidence`). Classification of restoration failures rides existing identities through the thrown-error chain (TC-WATCHDOG-029). **AC/TC**: AC-F2-1..3, AC-F3-1, DM-3, DM-4, NFR-3, NFR-5, DEC-1; grounds TC-WATCHDOG-020..030. **Verify**: `pnpm typecheck`.
- [ ] **2.3** Add liveness classification (same module): a pure classifier over the declared signals shape only — the input type has no CPU field, so a CPU-only reading cannot classify `stalled` (DEC-3); `stalled` additionally requires corroboration across declared progress signals; absent/unavailable sources classify as the absent outcome that the command boundary maps to `watchdog.signals-absent`; plus the verdict-bearing data builder (`verdict`, `signals`, `evidence`) used by all three probes. **AC/TC**: AC-F4-1, AC-F4-2 (classification halves), NFR-1, DEC-2, DEC-3; grounds TC-WATCHDOG-040/042/043. **Verify**: `pnpm typecheck`.
- [ ] **2.4** Re-export the new domain symbols through `packages/core/src/domain/index.ts` and the package root `packages/core/src/index.ts` (the CLI imports from `@delivery-os/core`); update `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` in the same commit. **AC/TC**: NFR-6; supports TC-WATCHDOG-002. **Verify**: `pnpm typecheck` and `bun test tests/structure/content-inventory.test.ts`.
- [ ] **2.5** Create `tests/behaviour/watchdog-liveness.test.ts` with the pure-classifier halves (the command-level halves land in Phase 5.5): TC-WATCHDOG-042 — absent/undefined signals plus CPU-busy/idle/high/low variants and an explicit `cpu`-field object all classify as the absent outcome, never a verdict; no path returns `stalled` without declared progress-signal corroboration; the CPU-busy→`stalled` mutant fails. TC-WATCHDOG-043 — the sourced-fact fixture (declared shape, not real ingestion) projects through the data builder with `verdict`/`signals`/`evidence` keys, valid value types, non-empty evidence, and `signals` carrying exactly the declared keys; the preflight-admission and teardown-success data builders also carry `verdict` and `evidence`. **AC/TC**: AC-F4-2, DM-2, NFR-1; TC-WATCHDOG-042, TC-WATCHDOG-043 (classifier/builder halves). **Verify**: `bun test tests/behaviour/watchdog-liveness.test.ts`.

**Acceptance Criteria**:

- Must: the domain module is pure (injected ports only; no clock/randomness/env/fs) and imports only contracts and local modules.
- Must: preflight fail-closes on unevaluable facts; teardown never plans a memory discard/clobber; the classifier cannot emit `stalled` from CPU-only input.
- Should: evidence strings are deterministic functions of the input facts (NFR-4 groundwork).

**Files and modules**:

- Code areas: `packages/core/src/domain/watchdog.ts` (new), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/behaviour/watchdog-liveness.test.ts` (new — classifier/builder halves), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated).
- System docs: none in this phase.

**Tests**:

- `pnpm typecheck`
- `bun test tests/behaviour/watchdog-liveness.test.ts`
- `bun test tests/structure/content-inventory.test.ts`

**Completion signal**: `feat(GH-221): add pure watchdog domain evaluation`

---

### Phase 3: Watchdog git seam (adapter tier)

**Goal**: Extend the existing bounded git subpath with the checkout-fact reads and restoration mutations the probes need — no new subpath, no boundary-rule change.

**Tasks**:

- [ ] **3.1** Create `packages/adapters/src/git/watchdog.ts` (PIN-4): `createWatchdogGitSeam` over the injected (or production) `GitChildRunner`, reusing the timeout/`killSignal` discipline and safe-ref validation from `packages/adapters/src/git/index.ts`. Reads: porcelain status (dirty/untracked/staged facts for evidence), HEAD/branch/commit facts versus a resolved base, worktree enumeration, detached-HEAD and unreachable-commit detection, and the `.ai/memory` tree scan (tracked-modified / untracked / staged / committed classification per path). Mutations: checkout restore to the base ref, lane-workspace residue removal, create/update of the `watchdog-preserved/<lane>` attributed ref — and no operation that stages, commits, reverts, or cleans memory paths. Fixed argv, no shell, no network, local-only. **AC/TC**: F-1..F-3 (mechanism), RSK-2; grounds TC-WATCHDOG-010..030. **Verify**: `pnpm typecheck`.
- [ ] **3.2** Export the seam through `packages/adapters/src/git/index.ts`; register the module in `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES`. Confirm `.dependency-cruiser.cjs` is unchanged (the `^packages/adapters/src/git/` confinement entry already covers the new module); if any rule change proves necessary during delivery, the matching failing negative fixture lands in the same commit (fixture-coverage meta-check). **AC/TC**: NFR-6; supports TC-WATCHDOG-002. **Verify**: `bun test tests/structure/content-inventory.test.ts tests/boundaries`.
- [ ] **3.3** Create `tests/fixtures/watchdog/temp-git.ts` (fixture helper, not a test): real temporary repositories — `mkdtemp` under the OS tmpdir with the `gh221-watchdog-` prefix, `git init -b main`, fixed author identity, a base branch and lane branch, configurable dirty / off-base / foreign-worktree (`git worktree add`) / stranded-commit / detached-HEAD / `.ai/memory`-publication states, and a `remove()` deleting the temp root; a guard rejects any fixture root equal to `process.cwd()` (TR-5). Modeled on `tests/fixtures/closeout/temp-git.ts`. **AC/TC**: test-plan §6 fixture strategy. **Verify**: `git diff --check` (exercised from Phase 5).

**Acceptance Criteria**:

- Must: every git child call is bounded, fixed-argv, local-only, and runs through the injected runner seam (test recording possible).
- Must: no mutation operation targets `.ai/memory` paths.
- Should: read operations return evidence-grade facts (file paths, refs, commit hashes), not raw porcelain dumps.

**Files and modules**:

- Code areas: `packages/adapters/src/git/watchdog.ts` (new), `packages/adapters/src/git/index.ts` (updated), `tests/fixtures/watchdog/temp-git.ts` (new), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated).
- System docs: none in this phase.

**Tests**:

- `pnpm typecheck`
- `bun test tests/structure/content-inventory.test.ts tests/boundaries`
- `git diff --check`

**Completion signal**: `feat(GH-221): extend git seam with watchdog checkout facts and restoration`

---

### Phase 4: CLI command surface, edge registration, and structure suites

**Goal**: Register the check-only `watchdog` family behind the shared parser and envelope/exit projection, and prove tier, brand, and grammar conformance structurally.

**Tasks**:

- [ ] **4.1** Create `packages/cli/src/commands/watchdog.ts`: `createWatchdogCommandDefinition(runtime)` with `WatchdogCommandRuntime` (injected lane-record read port, watchdog git seam, signal-source enumeration — zero sources wired in production M1-S1 per PIN-6). Grammar: subcommands exactly `preflight`, `teardown`, `liveness`, each taking exactly one `<lane>` positional; `positionals: { max }` bounded; grammar validation before any lane read (known-command grammar failures → `input.value.rejected`; parser-level failures → `fallback.invocation`); no run/mutate flags; `--json` is global and stripped by the shared parser. Handlers return `{ data }` or `{ error: { kind, code, summary } }` (PIN-1: failure evidence rides the summary); exit projection stays in the shared edge (`projectExitCode`); no exit literals in the command; text verdict/restoration lines via `humanText(data, brand)` carrying the same evidence; the binary name renders only through the injected brand. **AC/TC**: AC-F1..F5 (surface), AC-F6-2; grounds TC-WATCHDOG-005, 050..054. **Verify**: `pnpm typecheck`.
- [ ] **4.2** Wire registration: export the definition from `packages/cli/src/commands/index.ts`; add `watchdog?: WatchdogComposition` to `ConfigProgramOptions` and register `commands.watchdog = createWatchdogCommandDefinition(...)` behind the `!== undefined` guard in `packages/cli/src/edge.ts`, composing the production runtime (state-store lane reads, the watchdog git seam, zero signal sources). Existing command families, `createProductionDependencies`, and the shared parser stay unchanged. **AC/TC**: F-5, F-6; grounds TC-WATCHDOG-052/053. **Verify**: `pnpm typecheck`.
- [ ] **4.3** Create `tests/structure/watchdog-imports.test.ts`: TC-WATCHDOG-002 — the contracts module is data-only with no `node:`/`bun:` specifier; the domain module imports only `#contracts`/`#domain/*`/local relatives and calls no `Date.now`/`Math.random`/`performance.now`/`process.env`/`Bun.env`/`fetch`/filesystem API; the command module imports only `@delivery-os/core`(+`/contracts`) and local types; `scripts/checks/ambient-globals.ts` scopes the new files with zero violations; `bun test tests/boundaries` stays green on the production rules; the three temp-copy mutants (`node:fs` in contracts, `Date.now()` in domain, adapter import in the command) each fail naming file and kind. TC-WATCHDOG-006 — the seed-literal matcher over every new module finds zero matches; the synthetic brand renders wherever a binary name appears; `pnpm check:forbidden-literals` is green; the injected-literal mutant fails naming file and token. TC-WATCHDOG-007 — the exported subcommand set is exactly `preflight`/`teardown`/`liveness`; declared flags are read/selection only; the usage surface contains no runner verbs (`run`, `start`, `stop`, `kill`, `spawn`, `dispatch`, `restart`, `supervise`); the `run`-subcommand mutant fails. **AC/TC**: AC-F4-2, AC-F6-1 (structure half), AC-F6-2, NFR-6; TC-WATCHDOG-002, TC-WATCHDOG-006, TC-WATCHDOG-007. **Verify**: `bun test tests/structure/watchdog-imports.test.ts tests/boundaries` and `pnpm check:forbidden-literals`.
- [ ] **4.4** Bind the command module and edge change to the inventories (`tests/structure/inventory.json`, `EXECUTABLE_ALLOWANCES`) in the same commit. **AC/TC**: NFR-6; supports TC-WATCHDOG-002. **Verify**: `bun test tests/structure/content-inventory.test.ts`.

**Acceptance Criteria**:

- Must: AC-F6-1/AC-F6-2 (structure halves) — the grammar cannot express a run action; zero product/binary literals; tier boundaries hold with no rule loosening.
- Must: grammar rejections occur before any lane read and reuse `input.value.rejected`/`fallback.invocation`.
- Should: text and `--json` share one evidence source per outcome.

**Files and modules**:

- Code areas: `packages/cli/src/commands/watchdog.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/structure/watchdog-imports.test.ts` (new), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated).
- System docs: none in this phase.

**Tests**:

- `pnpm typecheck`
- `bun test tests/structure/watchdog-imports.test.ts tests/boundaries`
- `pnpm check:forbidden-literals`
- `bun test tests/structure/content-inventory.test.ts`

**Completion signal**: `feat(GH-221): add watchdog command family to the CLI edge`

---

### Phase 5: Behaviour, golden, and determinism suites

**Goal**: Implement the full TC matrix over real temporary git repositories and the wired CLI — admission truth, restoration truth, signal honesty, and machine-surface totality — plus the golden corpus and replay determinism.

**Tasks**:

- [ ] **5.1** Add the harness and committed matrix: `tests/fixtures/watchdog/harness.ts` — `runWatchdogCli` over `runCli` with buffer sinks, synthetic brand/clock/run-id, a recording lane runtime (read-only op log), and a recording git child runner (argv log); `tests/fixtures/watchdog/cases.ts` — the committed fixture/outcome matrix naming `FIX-CLEAN`, `FIX-DIRTY`, `FIX-OFFBASE`, `FIX-FOREIGN-WORKTREE`, `FIX-SUCCESS-RESIDUE`, `FIX-FAIL-EXIT`, `FIX-INTERRUPTED`, `FIX-MEM-COMMITTED`, `FIX-MEM-UNCOMMITTED`, `FIX-UNATTRIBUTED`, `FIX-NO-SIGNALS`, `FIX-PREFILL`, `FIX-BASE-MISSING`, `FIX-TORN` with expected family/outcome. **AC/TC**: test-plan §6/§7 fixture obligations; drives TC-WATCHDOG-005, 030, 050, 054, 070. **Verify**: `git diff --check`.
- [ ] **5.2** Create `tests/behaviour/watchdog-preflight.test.ts`: TC-WATCHDOG-010 (dirty refusal — exit `1`, exact code, category/retryable/consequence/hint, non-empty summary naming the dirt, exclusive payload, text parity, byte-for-byte unchanged tree/HEAD/branch, clean control negative), TC-WATCHDOG-011 (off-base and foreign-worktree refusals — expected-vs-actual evidence, no worktree mutation, on-base control admitted), TC-WATCHDOG-012 (clean admission — exit `0`, exclusive success envelope, `data.verdict === "ok"`, non-empty evidence, no side effects), TC-WATCHDOG-013 (read-only recording runtime across clean/dirty/off-base/torn — only read ops in the call log, repository facts unchanged, the `restoreCheckout`-in-preflight mutant fails), TC-WATCHDOG-014 (`FIX-BASE-MISSING` and injected read failure — fail-closed per PIN-2, non-zero, resolvable identity, never `ok`, the `ok`-mutant fails), TC-WATCHDOG-015 (torn record → `state.store.torn`; contradictory checkout facts → classified, non-zero, evidence-bearing, no new watchdog code). **AC/TC**: AC-F1-1..3, AC-F6-1 (behaviour half), NFR-1, NFR-3. **Verify**: `bun test tests/behaviour/watchdog-preflight.test.ts`.
- [ ] **5.3** Create `tests/behaviour/watchdog-teardown.test.ts`: TC-WATCHDOG-020 (success-exit restore — base checkout, residue removed or preserved-and-named, delivered commit stays reachable via its attributed ref, exit `0`, report with evidence), TC-WATCHDOG-021 (failure-exit restore — safe state, stray work restored or preserved-and-reported, no unreported residue), TC-WATCHDOG-022 (interrupted lane — detached HEAD + stranded commit + uncommitted change + uncommitted memory publication represented as repository facts, no signals to the test process (TR-4); stranded commit preserved via PIN-3 ref and named; the drop-without-report mutant fails), TC-WATCHDOG-023 (clean exit — teardown still runs and reports "nothing to restore" with evidence; second run idempotent), TC-WATCHDOG-027 (unattributable `notes.local` preserved and reported; the deleting mutant fails), TC-WATCHDOG-028 behaviour half (report shape: ordered actions with kind/observation/non-empty evidence, memory entries with status, stable ordering, the empty-evidence mutant fails), TC-WATCHDOG-029 (injected git child failure / unresolvable base — exit `1`/`2` per the classifying row, exactly one failure envelope, never `fallback.internal` for the documented class, the swallow-and-exit-`0` mutant fails), TC-WATCHDOG-030 (the full stranded/foreign matrix loop with preflight — every row refused or restored/preserved with evidence, zero silent outcomes, clean controls prove non-vacuity). **AC/TC**: AC-F2-1..3, AC-F5-2 (teardown half), DM-3, DM-4, NFR-1, NFR-3. **Verify**: `bun test tests/behaviour/watchdog-teardown.test.ts`.
- [ ] **5.4** Create `tests/behaviour/watchdog-memory.test.ts`: TC-WATCHDOG-024 (committed publication reported `committed` with file+commit evidence, byte-identical, single entry), TC-WATCHDOG-025 (modified-tracked + untracked memory files with canary bytes — path/bytes/SHA-256 identical after teardown, status `preserved` with path+reason evidence, working-tree/index state unchanged, exit `0`), TC-WATCHDOG-026 (four variants — modified tracked, untracked, staged, residue-resembling path — bytes/index/existence unchanged; the git call log contains no destructive op scoped to `.ai/memory` (no `checkout -- .ai/memory`, no `clean` covering it, no `reset --hard` while memory is dirty, no `stash drop`, no file delete); the destructive mutant fails in a temp fixture). **AC/TC**: AC-F3-1, NFR-5, DEC-1, RSK-2. **Verify**: `bun test tests/behaviour/watchdog-memory.test.ts`.
- [ ] **5.5** Extend `tests/behaviour/watchdog-liveness.test.ts` with the command-level half: TC-WATCHDOG-040 (`FIX-NO-SIGNALS` — exit `2`, exactly one failure envelope with `watchdog.signals-absent` and correct error fields, no `verdict` key or value anywhere in the payload, `data` absent, the evidence-bearing summary states the answer is unknown, replay identical). **AC/TC**: AC-F4-1, NFR-1, DEC-2, RSK-1. **Verify**: `bun test tests/behaviour/watchdog-liveness.test.ts`.
- [ ] **5.6** Create `tests/behaviour/watchdog-envelope.test.ts` and `tests/behaviour/watchdog-exit.test.ts`: TC-WATCHDOG-050 (full matrix through `runCli` — stdout parses as exactly one JSON document, four mandatory fields, exclusive `data`/`error`, failure errors carry code/category/retryable/consequence/hint and non-empty summary, stderr carries no envelope, envelope `exitCode` equals the return; reuses `assertEnvelopeContract` from `@delivery-os/testkit` — no second validator), TC-WATCHDOG-051 (text mode — verdict/restoration lines, no envelope JSON, same evidence tokens as `--json`, diagnostics on stderr with the injected brand), TC-WATCHDOG-052 (grammar matrix — no subcommand, `bogus`, missing lane, extra positional, `--bogus`, unknown top-level command → existing identities (`input.value.rejected` / `fallback.invocation`), zero `fallback.internal`, no lane I/O after rejection), TC-WATCHDOG-053 (unknown/malformed lane across all three probes → `input.value.rejected`, exit `1`, summary names the lane, no mutation, never `ok`), TC-WATCHDOG-005 (the Appendix B matrix — `ok`→`0`, refusals→`1`, `signals-absent`→`2`, classified teardown failure→`1`/`2` per its row, grammar→`1`; no outcome both success and error; the `progressing`→`0` and `stalled`→`1` rows asserted as declared contract data marked unreachable in M1-S1 with the GAP-T2 M1-S15 decision-dependency note; no fixture yields either value), TC-WATCHDOG-054 (every collected exit is a subset of `{0,1,2}`, returned code equals envelope code, exit `0` only for `ok`-class successes, exit `2` only for classified unavailability). **AC/TC**: AC-F5-1..3, NFR-2, NFR-3. **Verify**: `bun test tests/behaviour/watchdog-envelope.test.ts tests/behaviour/watchdog-exit.test.ts`.
- [ ] **5.7** Create `tests/behaviour/watchdog-checks-not-runner.test.ts`: TC-WATCHDOG-060 — every fixture across all three probes runs against the recording runtime with zero dispatch/session-spawn/kill/restart/supervise calls; the static scan finds no session/host/opencode adapter import or run-oriented port in the command module or adapter seam; grammar cross-ref to TC-WATCHDOG-007; the spawn-port mutant fails. Local `git` child processes are expected and not asserted against (TR-8). **AC/TC**: AC-F6-1 (behaviour half), DEC-4, NG-3. **Verify**: `bun test tests/behaviour/watchdog-checks-not-runner.test.ts`.
- [ ] **5.8** Add the golden corpus and determinism suite: `tests/golden/watchdog-output.test.ts` + `tests/fixtures/watchdog/golden/**` — TC-WATCHDOG-028/050/051 golden halves (canonical normalized envelopes and text reports for admission, refusal, teardown, and signals-absent; normalization replaces the temp root with a fixed token and removes `runId`/`timing` only — never branch names, refs, codes, or evidence text; goldens regenerated by explicit command). Create `tests/behaviour/watchdog-determinism.test.ts` — TC-WATCHDOG-070 (each probe twice against the same fixture and once against a structurally identical second temp root, with deterministic injected clock/run-id/brand; normalized comparison over verdict, evidence, report action order, and exit; the raw evidence still contains the semantic refs/branch names, proving normalization erased no meaning). **AC/TC**: NFR-4, DM-3; TC-WATCHDOG-028/050/051 (golden halves), TC-WATCHDOG-070. **Verify**: `bun test tests/golden/watchdog-output.test.ts tests/behaviour/watchdog-determinism.test.ts`.

**Acceptance Criteria**:

- Must: all 14 ACs verified behaviourally; every TC row in test-plan §5.1 has a passing home; the §7 gate battery (narrow iteration → binding/brand → boundaries) is green.
- Must: 100% of matrix rows end refused or restored with evidence; zero silent outcomes; zero memory loss.
- Should: full `tests/behaviour/watchdog-*.test.ts` + `tests/golden/watchdog-output.test.ts` run green in one invocation.

**Files and modules**:

- Code areas: `tests/fixtures/watchdog/harness.ts` (new), `tests/fixtures/watchdog/cases.ts` (new), `tests/fixtures/watchdog/golden/**` (new), `tests/behaviour/watchdog-preflight.test.ts` (new), `tests/behaviour/watchdog-teardown.test.ts` (new), `tests/behaviour/watchdog-memory.test.ts` (new), `tests/behaviour/watchdog-liveness.test.ts` (updated — command half), `tests/behaviour/watchdog-envelope.test.ts` (new), `tests/behaviour/watchdog-exit.test.ts` (new), `tests/behaviour/watchdog-checks-not-runner.test.ts` (new), `tests/behaviour/watchdog-determinism.test.ts` (new), `tests/golden/watchdog-output.test.ts` (new).
- System docs: none in this phase.

**Tests**:

- `bun test tests/behaviour/watchdog-preflight.test.ts tests/behaviour/watchdog-teardown.test.ts tests/behaviour/watchdog-memory.test.ts`
- `bun test tests/behaviour/watchdog-liveness.test.ts tests/behaviour/watchdog-envelope.test.ts tests/behaviour/watchdog-exit.test.ts`
- `bun test tests/behaviour/watchdog-checks-not-runner.test.ts tests/behaviour/watchdog-determinism.test.ts tests/golden/watchdog-output.test.ts`
- `bun test tests/boundaries`

**Completion signal**: `test(GH-221): add watchdog behaviour, golden, and determinism suites`

---

### Phase 6: Documentation, spec synchronization, and release marker

**Goal**: Land the current-truth feature spec and the release changeset (lifecycle phase 7, `@doc-syncer`); the binding result-contract rows already landed in Phase 1.

**Tasks**:

- [ ] **6.1** Create `doc/spec/features/feature-watchdog-lane-contracts.md` — the first system spec covering watchdog/lane contracts (spec §16): the contract data (verdict vocabulary, signals shape, evidence, restoration report), the three probes and their grammar, the Appendix B verdict/exit matrix, the three error identities, teardown preservation semantics (PIN-3), the M1-S15 ingestion boundary and the GAP-T2 decision dependency, and the checks-not-runner guarantee. Follow the repository's feature-spec conventions and distribution markers where applicable. **AC/TC**: spec §16, §22; supports NFR-7 cross-links. **Verify**: `bun run scripts/checks/forbidden-literals.ts` (doc registry scope).
- [ ] **6.2** Cross-link the new spec: extend the consumed-by/see-also lists in `doc/spec/features/feature-result-contract.md` (the `watchdog` kind and its three rows), and any feature index/register that lists feature specs; update only what the delivered surface changes — no broad reconciliation beyond watchdog scope. **AC/TC**: NFR-7 (documentation side). **Verify**: `bun run scripts/checks/error-table-sync.ts` (still green after doc edits).
- [ ] **6.3** Add `.changeset/gh-221-watchdog-lane-contracts-minor.md`: `minor` for all five fixed-group packages (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) per the lockstep convention, with the release note describing the command family, the contract, and the three identities. **AC/TC**: version bump per repo conventions. **Verify**: file present and well-formed.

**Acceptance Criteria**:

- Must: the feature spec exists, is cross-linked from the result contract, and states exactly the delivered behavior (no aspiration).
- Must: the changeset bumps the lockstep group by `minor`.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-watchdog-lane-contracts.md` (new), `doc/spec/features/feature-result-contract.md` (updated cross-links).

**Tests**:

- `bun run scripts/checks/forbidden-literals.ts`
- `bun run scripts/checks/error-table-sync.ts`

**Completion signal**: `docs(GH-221): add watchdog feature spec and release changeset`

---

### Phase 7: Code review (analysis)

**Goal**: Adversarial review of the delivered change against spec, plan, and repo rules (lifecycle phase 8, `@reviewer`).

**Tasks**:

- [ ] **7.1** Run the review over the full branch diff: spec/plan/AC traceability, tier and boundary conformance, evidence totality, checks-not-runner proof, TC assertions un-reshaped versus the test plan, and the Phase 1 count updates (no weakened assertions).
- [ ] **7.2** Triage findings into accepted (→ Phase 8) and rejected-with-reason; record the verdict. Confirm DEC-1 (memory verification inside teardown) at the PR review gate as the spec requires, and confirm no fixture claims a sourced liveness outcome (TR-11).

**Acceptance Criteria**:

- Must: a recorded PASS, or a FAIL with an actionable finding list for Phase 8.

**Files and modules**:

- Code areas: none (read-only analysis).
- System docs: none.

**Tests**: none beyond re-reading the Phase 1–6 evidence.

**Completion signal**: `review(GH-221): record code-review verdict`

---

### Phase 8: Post-code-review fixes (conditional)

**Goal**: Remediate accepted review findings and re-review to PASS. Skip when Phase 7 returns PASS with no accepted findings.

**Tasks**:

- [ ] **8.1** Apply each accepted finding as a targeted fix; re-run the affected focused suites from the phase that owned the touched files (and the binding checks if `error-table.ts` or the documented table moved).
- [ ] **8.2** Re-run the review; iterate 8.1 until PASS. Record each iteration in the Execution Log.

**Acceptance Criteria**:

- Must: every accepted finding closed with a passing focused suite; review verdict PASS.

**Files and modules**:

- Code areas: whichever files the findings target.
- System docs: updated only if a finding touches documented behavior.

**Tests**: the focused suites of the touched phases.

**Completion signal**: `fix(GH-221): apply code-review remediations`

---

### Phase 9: Finalize and release

**Goal**: Full-gate green, version bump in place, spec reconciliation confirmed, DoD walkthrough complete, PR-ready state (lifecycle phases 9–11).

**Tasks**:

- [ ] **9.1** Run the full aggregate battery: `pnpm check` (lint → format:check → typecheck → test → check:boundaries → exports parity) and `git diff --check`; fix-forward only through Phase 8 discipline if anything fails (lifecycle phase 9, `@runner`/`@fixer`).
- [ ] **9.2** Verify the version bump: the Phase 6 changeset is the single release marker and the lockstep group is coherent (no stray changesets from other work riding the branch).
- [ ] **9.3** Spec reconciliation check: `doc/spec/features/feature-watchdog-lane-contracts.md` and the result-contract rows match the delivered surface exactly (no drift between Phase 1/6 docs and the final code).
- [ ] **9.4** DoD walkthrough: all 14 ACs verified with their TC evidence, every plan task checked, the success-metrics table at target, and the Execution Log populated. Hand off to PR creation (lifecycle phase 11, `@pr-manager`).

**Acceptance Criteria**:

- Must: `pnpm check` fully green; 14/14 ACs met; 35/35 TCs implemented and passing; zero weakened assertions.
- Must: version bump present per repo conventions; spec reconciliation confirmed.

**Files and modules**:

- Code areas: none expected.
- System docs: final reconciliation only.

**Tests**:

- `pnpm check`
- `git diff --check`

**Completion signal**: `chore(GH-221): finalize watchdog delivery for PR`

---

## Test Scenarios

All 35 TCs from `chg-GH-221-test-plan.md` §5, mapped to the phase that implements each assertion set (TC identities, assertions, exits, and AC mapping are unchanged — GAP-T4 honored). Halves noted where a TC lands across two phases.

| TC ID | Scenario | Phase(s) | AC |
|-------|----------|----------|----|
| TC-WATCHDOG-001 | Contract data has one data-only home | 1 | AC-F4-2 |
| TC-WATCHDOG-002 | Tier boundaries respected | 4 (aggregate 9) | AC-F4-2, NFR-6 |
| TC-WATCHDOG-003 | `watchdog` kind: exactly three rows, round-trips | 1 | AC-F5-1, NFR-7 |
| TC-WATCHDOG-004 | Documented rows and corpora in two-way sync | 1 | AC-F5-1, NFR-7 |
| TC-WATCHDOG-005 | Exit mapping total over the verdict/exit matrix | 5 | AC-F5-1, NFR-2 |
| TC-WATCHDOG-006 | Surface is brand-neutral | 4 | AC-F6-2, NFR-6 |
| TC-WATCHDOG-007 | Grammar exposes checks, never runner verbs | 4 | AC-F6-1 |
| TC-WATCHDOG-010 | Dirty checkout refused, evidence, no mutation | 5 | AC-F1-1 |
| TC-WATCHDOG-011 | Non-base checkout refused with expected-vs-actual | 5 | AC-F1-2 |
| TC-WATCHDOG-012 | Clean on-base checkout admitted | 5 | AC-F1-3 |
| TC-WATCHDOG-013 | Preflight read-only on every outcome | 5 | AC-F1-1, AC-F6-1 |
| TC-WATCHDOG-014 | Unevaluable checkout fails closed | 5 | AC-F1-1 |
| TC-WATCHDOG-015 | Torn/impossible facts classified, never clean | 5 | AC-F1-1, AC-F5-2 |
| TC-WATCHDOG-020 | Teardown restores on success and reports | 5 | AC-F2-1 |
| TC-WATCHDOG-021 | Teardown restores after failure exit | 5 | AC-F2-2 |
| TC-WATCHDOG-022 | Teardown restores after interruption (stranded commit) | 5 | AC-F2-2 |
| TC-WATCHDOG-023 | Teardown unconditional on clean exit | 5 | AC-F2-1 |
| TC-WATCHDOG-024 | Committed publication reported committed | 5 | AC-F3-1 |
| TC-WATCHDOG-025 | Uncommitted publication preserved byte-identically | 5 | AC-F3-1 |
| TC-WATCHDOG-026 | Never deletes/clobbers memory (destructive negatives) | 5 | AC-F3-1 |
| TC-WATCHDOG-027 | Unattributable content preserved and reported | 5 | AC-F2-2 |
| TC-WATCHDOG-028 | Restoration report evidence-total | 5 (behaviour + golden) | AC-F2-1, AC-F2-2 |
| TC-WATCHDOG-029 | Teardown failure classified, never silent | 5 | AC-F5-2 |
| TC-WATCHDOG-030 | Stranded/foreign matrix exhaustively handled | 5 | AC-F2-3 |
| TC-WATCHDOG-040 | Absent signals: unknown, exit `2`, no verdict | 5 | AC-F4-1 |
| TC-WATCHDOG-041 | Verdict vocabulary exact, contract-only | 1 | AC-F4-2 |
| TC-WATCHDOG-042 | CPU-only can never classify `stalled` | 2 | AC-F4-2 |
| TC-WATCHDOG-043 | Verdict-bearing data carries verdict/signals/evidence | 2 (builder) + 5 (command data shapes) | AC-F4-2 |
| TC-WATCHDOG-050 | Exactly one valid exclusive envelope per invocation | 5 (behaviour + golden) | AC-F5-2 |
| TC-WATCHDOG-051 | Text lines carry the same evidence as `--json` | 5 (behaviour + golden) | AC-F5-2 |
| TC-WATCHDOG-052 | Grammar failures reuse existing identities | 5 | AC-F5-3 |
| TC-WATCHDOG-053 | Unknown lane reuses the handler identity | 5 | AC-F5-3 |
| TC-WATCHDOG-054 | Exits within `{0,1,2}`; exit `2` reserved | 5 | AC-F5-1, NFR-2 |
| TC-WATCHDOG-060 | Never dispatches, spawns, kills, or supervises | 5 | AC-F6-1 |
| TC-WATCHDOG-070 | Identical facts replay identically | 5 | NFR-4 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-221-spec.md` | Spec |
| Test plan | `./chg-GH-221-test-plan.md` | Test plan |
| PM notes | `./chg-GH-221-pm-notes.yaml` | PM record |
| Implementation plan | `./chg-GH-221-plan.md` (this file) | Plan |
| Watchdog contracts | `packages/core/src/contracts/watchdog.ts` | Code (new) |
| Error-table kind + rows | `packages/core/src/contracts/error-table.ts` | Code (updated) |
| Domain evaluation | `packages/core/src/domain/watchdog.ts` | Code (new) |
| Git seam extension | `packages/adapters/src/git/watchdog.ts` | Code (new) |
| CLI command | `packages/cli/src/commands/watchdog.ts` | Code (new) |
| Edge registration | `packages/cli/src/edge.ts`, `packages/cli/src/commands/index.ts` | Code (updated) |
| Documented error rows | `doc/spec/features/feature-result-contract.md` | System doc (updated, Phase 1) |
| Feature spec | `doc/spec/features/feature-watchdog-lane-contracts.md` | System doc (new, Phase 6) |
| Test suites | `tests/structure/watchdog-*.test.ts`, `tests/behaviour/watchdog-*.test.ts`, `tests/golden/watchdog-output.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` | Tests |
| Test fixtures | `tests/fixtures/watchdog/**`, `tests/fixtures/result/code-corpora/true-positives.json` | Fixtures |
| Release changeset | `.changeset/gh-221-watchdog-lane-contracts-minor.md` | Release |
| Testing strategy | `.ai/rules/testing-strategy.md` | Rules |
| TypeScript rules | `.ai/rules/typescript.md` | Rules |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | plan-writer | Initial plan derived from `chg-GH-221-spec.md` v1.0 and `chg-GH-221-test-plan.md` v1.0. Nine phases, 37 tasks; 35/35 TCs mapped; delivery pins resolve OQ-T1/T3/T4/T5 and GAP-T5; GAP-T2 recorded as a deferred M1-S15 decision (`@decision-advisor`). |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| — | Not started | — | — | — | Populated during delivery. |
