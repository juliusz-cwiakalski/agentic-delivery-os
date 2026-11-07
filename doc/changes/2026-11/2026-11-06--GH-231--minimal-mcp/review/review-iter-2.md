# Code Review — GH-231 (M1-S7: Minimal MCP) — Iteration 2

- **Reviewer**: `@reviewer` (local mode)
- **Range**: `origin/main-tools..HEAD`; this iteration re-review covers `1f1237c5` (fix: containment + truthful parks, per remediation phase 7), `7621a2bc` (doc re-sync), and `718fb7e9` (iteration-1 review record + plan phase 7)
- **Date**: 2026-11-06
- **Status**: **PASS** — 0 critical / 0 high / 0 medium / 1 low / 3 info; no remediation phase required
- **Canonical artifact**: `../code-review/review-iter-2.yaml` (this file is the human-readable report)
- **Prior**: iteration 1 FAIL (0c/2h/3m/2l/3i) — both blocking highs remediated and verified below

## Verdict summary

The iteration-1 remediation is complete and correct. Both blocking findings are fixed at the
preferred option, each verified independently by this review — re-run suites, re-run invariant
checks, and fresh empirical probes against the **built** `./serve` entry (the reviewer did not
rely on the coder's report). No regressions were found: the containment shape still matches the
CLI's `fallback.internal` semantics, the parks composition is truthful and write-free, the
protocol change respects the GAP-T3 oracle and the `{0,1,2}` lifecycle vocabulary, and the new
`./provider` workspace entrypoint passes every boundary check. Spec compliance moves
**FAIL → PASS**; plan compliance stays **PASS** (all 7 phases executed with recorded evidence).
Remaining findings are bookkeeping-level (one low, three info) and none blocks progression.

## Blocking-finding verification (iteration 1)

### MAJ-1 / F-1 — thrown-error containment: **RESOLVED** (verified three layers)

- **Code** (`packages/mcp/src/commands/toolset.ts:67-96`): the dispatch switch is wrapped in one
  `try/catch` returning `failureFromValue(thrown)` — the single site, exactly the suggested fix.
  Critically, every handler call inside the `try` is `await`ed (a missing `await` would let async
  rejections escape the catch — a classic containment bug this implementation avoids). The
  containment shape is the CLI's: `failureFromValue` runs the mirrored `classifyThrown` chain, so
  a thrown value with a declared `kind`/`code` still resolves to its real classified identity —
  programmer errors (undeclared throwables) become `fallback.internal`, exactly as
  `runCli`'s `failureOutcome(classifyThrown(thrown))` behaves (`packages/cli/src/index.ts:339-351`).
  No over-swallowing.
- **Tests (all re-run green by this review)**: `verify-containment` and `gate-containment` parity
  cases inject throwing runtimes into **both** surfaces and assert deep equality with the CLI
  `fallback.internal` error — and because they live in `ALL_CASES`, they are automatically
  exercised by the full parity battery (error-field exactness, ordered read-sequence parity,
  replay determinism, bounded-by-CLI) — 83 + 46 tests across the parity/error/readonly/injection
  suites. `mcp-error-payload.test.ts` adds the resolve-not-reject assertion plus a non-vacuity
  check that all three tools have a containment case. `mcp-lifecycle.test.ts` adds the
  thrown-then-valid row: the throwing call answers in-protocol (`isError: true`,
  `fallback.internal`), the next call returns `lint.target.missing`, outcome clean, exit 0.
- **Containment-serve-loop shape**: the lifecycle row drives the real `runProtocol` + real
  toolset + real `exitCodeFor` with an injected throwing runtime — the same probe shape that
  empirically produced the iteration-1 crash — and now yields exit 0.

### MAJ-2 / F-2 — truthful parks section: **RESOLVED** (preferred option; verified empirically)

- **Code** (`packages/mcp/src/serve.ts:113-123`): `readProviderParks` now composes
  `readProviderParkViews(store, nowMs)` — **character-identical** to the CLI status edge fold
  (`packages/cli/src/edge.ts` readProviderParks): same call, same failure mapping
  (`{ok:false, reason:"state-unreadable", failureCode: parks.error.code}`), same success mapping.
  The failure code is now the store's own, not a hardwired `state.store.unknown`.
- **Boundary** (`packages/mcp/package.json:32`, `scripts/checks/workspace-entrypoints.ts`):
  `./provider` added to `workspaceImports` and to `EXPECTED_ENTRYPOINTS.mcp`; reviewer re-ran
  `pnpm check:boundaries` — depcruise (203 modules, 0 violations), ambient-globals, workspace-
  entrypoints, and secret-read (179 files, **5** allowlisted entries, serve.ts still the only mcp
  env-read site) all green. `readProviderParkViews` is documented never-writes (PD-A); reviewer
  probes confirm the serve process created **zero** files in the state directory across full
  three-tool sessions.
- **Empirical probes (built entry, hermetic workspace, Node 24)**: healthy store → no
  `state.store.unknown` anywhere in the digest, parks read succeeds (empty views); corrupt state
  header (`delivery.state.v999`) → the parks read fails truthfully and the digest carries no
  hardwired code (the engine renders per its rules; exit stays 0 — degraded digest is data).
  Engine rendering of parks evidence (providers section, short-circuited when the provider
  config read fails) is shared CLI/engine behavior — serve composes identically, which is what
  F-2 required.
- **Parity**: the status parity harness parks cases (including the 8-park cap-sized case) run
  through both surfaces, green.

## Minor/low finding verification (iteration 1)

| Finding | Verdict | Evidence |
|---|---|---|
| F-3 batch frame exits 2 (medium) | **RESOLVED + pinned** | `protocol.ts:118-123`: valid-JSON non-frames answered `-32600 Invalid Request`, `id: null` (spec-correct for invalid request objects), serving continues; only unparseable bytes remain the transport fault. Reviewer probes: batch array, JSON primitive, and wrong-`jsonrpc`-version frames all → `-32600 id:null`, subsequent `tools/list` and tool calls succeed, exit 0; `not-json` → exit 2 with the transport-fault stderr diagnostic (GAP-T3 fixture intact). Process-level lifecycle row pins the batch behavior. Feature page transport-fault row corrected to "an unparseable JSON frame". |
| F-5 docs incomplete (medium) | **RESOLVED** | Feature page composition inventory now lists provider config (`provider-chain-unresolved`), parks (truthful read semantics incl. real failure code), the credential-backed gate reads (`credential-unavailable`/`config.credential.missing`), and the absent-override default working name. §7 status column annotated superseded by §10. Every vocabulary claim cross-checked against `serve.ts` and engine rendering (incl. `not-configured` → `source-unavailable` via `reasonForReadFailure`) — accurate. |
| F-6 positional name resolution (low) | **RESOLVED** | `protocol.ts:67` resolves served names via `toolIdByName(options.brand, name)`; brand threaded through `ProtocolOptions`; serve passes the same brand to toolset and protocol. Order-coupling gone; unknown prefixed names still `-32602` (probe-verified). |
| F-4 phase-6 scope deviation (medium) | Accepted as done (iter-1); process lesson recorded in pm-notes retro | — |
| F-7/LOW-2 constants sharing (low) | **Skip recorded** (task 7.4 allows); doc half done (default documented) | §10 remediation table records the skip with rationale |

## Skipped/advisory items spot-check

- **F-8** (provider-backed reads absent): correctly recorded posture; the re-synced feature page
  now states the per-runtime injection vocabulary precisely.
- **F-9** (dead `#commands/#output` aliases): still present, still dead, still housekeeping —
  correctly non-blocking.
- **F-10** (protocol metadata edges): still current behavior, still advisory, still unpinned.

## Regression sweep (`1f1237c5`, `7621a2bc`)

- **Containment**: no classified identity is swallowed (mirror chain resolves declared kinds);
  serialization queue unchanged; `inputRejection` paths unaffected.
- **Parks**: no writes, no boundary widening beyond the declared pin, no new env reads;
  readonly/injection oracles re-run green.
- **Protocol**: empty lines still skipped; `-32600` frames are fixed-shape (no injection
  surface); lifecycle `{0,1,2}` intact (probe-observed 0 and 2; configuration-error 1 covered by
  the lifecycle suite); exit-code-literals scan clean (167 files).
- **Docs** (`7621a2bc`): all ten files cross-checked against delivered behavior — import
  matrices, five-entry secret-read allowlist table, provider-read classification, MCP serve stdio
  edge in the runtime-API list. No stale claims found; forbidden-literals 0 violations over the
  updated docs; doc-distribution guard verified by the coder and consistent with the marker set.
- **Aggregate** (reviewer's own run): `pnpm check` PASS — 3764 pass / 4 skip / 0 fail across 371
  files; depcruise 203 modules / 517 dependencies, 0 violations; ambient-globals, workspace-
  entrypoints, secret-read, exports-parity all green.

## New findings (all non-blocking)

1. **LOW [plan-compliance]** Phase-7 completion evidence lacks the commit hashes
   (`1f1237c5`, `7621a2bc`) in test-plan §10, and pm-notes has no phase-7 completion note —
   breaking the per-phase evidence pattern of phases 1-6 (which name all their commits). The gate
   commands and counts are recorded, so this is weak-sense EVIDENCE_MISSING. *Fix*: append the
   hashes to the §10 phase-7 paragraph or add a one-line pm-notes note during dod_check
   bookkeeping.
2. **INFO [plan-compliance]** Phase 7's declared file list omitted task-mandated files
   (`protocol.ts` via task 7.4, `workspace-entrypoints.ts` via task 7.2) — self-recorded in the
   §10 scope notes; the MIN-1 authoring lesson now demonstrated twice.
3. **INFO [correctness]** F-10 carry-over unchanged: unknown tool `-32602`, initialize
   notification gets an id-null reply; unpinned, contract-neutral.
4. **INFO [documentation]** F-9 carry-over: dead `#commands/#output` aliases remain in mcp
   (and pre-existing in cli); housekeeping only.

## Spec / plan / test-plan audit

- **Spec compliance: PASS** — iteration-1's two violations (G-5/AC-F5-3 thrown-error path;
  F-2 truthful sections / §8.4 same-read-paths / UQ-7) are resolved at the preferred option; all
  13 ACs now hold on the paths previously failing.
- **Plan compliance: PASS** — OPEN_PHASES none (phase 7 executed); EVIDENCE_MISSING one weak
  instance (LOW-1); SCOPE_DEVIATION one self-recorded instance (INFO-2, task-mandated files).
  UQ-7 drift is moot: the composition now matches the CLI, so no drift record is needed.
- **Test quality**: the remediation added exactly the missing coverage classes (throwing-runtime
  parity for both tools, batch/non-frame process-level rows, containment resolve-not-reject) and
  wired them into the existing non-vacuity machinery (case floors, mutation controls, replay
  determinism) rather than as isolated one-offs.

**Next step**: PROCEED — quality gates (`pnpm check` already green under this review) → dod_check
→ pr_creation. LOW-1 can be folded into dod_check bookkeeping; no remediation phase appended.
