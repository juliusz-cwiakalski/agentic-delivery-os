# Code Review — GH-181 Iteration 1 (Independent Local Review)

- **Change**: GH-181 — M0-S12: Primitive ports, credential port, and embedded metadata
- **Reviewer**: `@reviewer` (local mode), invoked as the Phase 5 independent review (P5 was skipped during delivery by instruction)
- **Date**: 2026-10-30T21:48:32Z
- **Diff ground truth**: `git diff origin/main-tools..HEAD` (base `main-tools`, head `feat/GH-181/primitive-ports-credential-metadata` @ `f6a5d50`)
- **Inputs**: spec v1.1 (17 ACs, DEC-1..DEC-9), test plan v1.1 (19 TCs, §10 execution log), plan v1.0 (7 phases / 35 tasks), pm-notes (DoR READY iter 1, 4 advisory carry-forwards)
- **Verdict**: **FAIL** — 0 blockers, **1 major**, 2 minor, 2 informational. PASS requires zero blockers and zero majors; remediation tasks R-1..R-3 have been appended to plan Phase 6.

## 1. Evidence Verification (spot-checked by re-running)

| Evidence claimed in test-plan §10 | Verified | Result |
|---|---|---|
| TC-PORT-005/006/008, TC-META-001/002/003/005/006, TC-PORT-003 behaviour suites | re-run | 36 pass / 0 fail across 5 files |
| TC-SECRET-001..004 | re-run | 14 pass / 0 fail; live scan read-only |
| `secret-read-boundary.ts` clean tree | re-run | OK — 51 production files clean, 3 allowlisted entries |
| `error-table-sync.ts` | re-run | entries=14 documented=14; both directions agree |
| `ambient-globals.ts` | re-run | OK — 18 neutral-set files clean |
| Structure suites (TC-PORT-001/002/004/007, TC-META-004/005, TC-ERR-001) | re-run | 121 pass / 0 fail across 19 files |
| Boundaries suite | re-run | 115 pass / 0 fail (incl. new `runtime-node-fs-adapter-io` negative fixture + `runtime-control-adapter-credentials` clean control) |
| Checks suites (TC-SECRET-002 wiring, exports parity) | re-run | 153 pass / 0 fail |
| `pnpm typecheck` incl. `tests/types` probe (OQ-D) | re-run | exit 0, 0 errors |
| `forbidden-literals`, doc-distribution guard, `git diff --check` | re-run | all green / clean |

§10 rows are truthful: claimed counts match observed output exactly (e.g. 51 scoped files, 14/14 error rows, 4-payload × 3-carrier golden matrix).

## 2. Spec & Plan Compliance

**All 17 ACs trace to passing, non-vacuous evidence** (verified above; mutation/negative controls are real `mkdtemp` or temp-copy mutations that fail by name — no silent passes found):

- AC-F1-1/2 — nine primitives keyed by catalogue names, fail-closed inventory both directions (add/remove/new-module mutations fail by name); contracts tier is types + `as const` only; ambient guard green.
- AC-F2-1/2 — capability/gap declaration typed data with undeclared-operation resolution; carrier selection constrained at runtime (`selectDeclaredCarrier`) and at type level (`tests/types` probe compiled by root `typecheck`, `@ts-expect-error` with reasons).
- AC-F3-1/2/3 — canary returned once (raw + JSON-escaped forms checked against capture sink); host-`process.env` isolation proven; absent/empty → exact `config.credential.missing` identity bound to the ERROR_TABLE row by field-equality; kind-only `config` lookup still throws; no mode discriminant (AST surface + injection mutation); sidecar constraint documented in the contract.
- AC-F4-1/2/3 — planted fixture fires naming rule/file/line; binding in `ts-invariants` (additions-only, one line) and `check:boundaries`, removal-by-name mutations on temp copies fail; mutations A–E fail closed; sole `credential-material` entry; non-vacuity (51 files) and fixture-coverage meta-check green. **Caveat: see Finding F-1 on coverage completeness.**
- AC-F5-1..6 — golden round-trip 4×3 within 2048 bytes; strip at beginning/middle/end exact, re-parse `missing`; six-case degradation matrix with closed DEC-8 taxonomy, identical heuristic fallback, valid control; closed payload schema with unknown/missing/nested-unknown rejection; credential canary never serialized; brand-neutral `delivery.*.v1` constants; adapter-only write path with no raw-carrier field on agent views; codec placement asserted (no core hoist, no `./io` subpath, no production cross-boundary import); version window older/newer → `unknown-version`.
- AC-F6-1 — machine + documented row synchronized (both tables verified green); classification behavior unchanged (provider/input singletons, config exact-code, containment fallback all asserted).

**Plan audit** — P1 (6/6), P2 (8/8), P3 (5/5, incl. 3.5 "not required — undisputed" note), P4 (5/5), P7 (7.1–7.4 done; 7.5 rollback recorded, PR honestly recorded as NOT created). P5 was skipped by instruction — this review is its execution. P6 was "not required" only because P5 was skipped; now activated with R-1..R-3. Gap types: none (no OPEN_TASKS in P1–P4/P7 beyond the disclosed 7.5 PR item; no DONE_BUT_UNCHECKED; no CHECKED_BUT_MISSING).

**DoR carry-forwards honored** (pm-notes decision 1): (1) root-test relative codec imports per plan, testkit package untouched ✓; (2) fixture adapters at `tests/fixtures/ports/**` ✓; (3) `tests/types` project chained into root `typecheck` ✓ (exit 0); (4) `file`|`directory` allowlist kinds with exact-path validation ✓; ci-topology wiring attribution via `ci-checks` assertions on both surfaces ✓.

**Known accepted deviation verified as described**: `tests/checks/exports-parity.test.ts:42` — only change is the explicit `240_000` ms timeout on the pre-existing attw pack-mutation test; no logic change. Not flagged.

**Deviations honestly recorded**: P5 skip, 7.5 pending PR, attw timeout remediation, 3.5 not-required — all disclosed in plan/pm-notes. One cosmetic inaccuracy noted as F-5 (timestamp drift).

## 3. Repo Rule Checks (binding)

- **License headers**: none added; all new files start with plain doc comments on non-header paths ✓
- **Protected paths**: `tools/**`, `.opencode/**`, `.ados-claude/**`, `scripts/*.sh` untouched; only permitted `scripts/checks/*.ts` + registry changes ✓
- **CI topology**: one added line inside `ts-invariants`; `TS_JOBS` unchanged; no bypass constructs (bindingness green) ✓
- **Error-table sync**: both directions green (14/14) ✓
- **Ambient-globals guard**: green, 18 neutral files ✓
- **Doc-distribution**: no drift (80 in-scope docs; install set matches markers) ✓; `feature-adapter-ports.md` registered in forbidden-literals registry ✓
- **Changeset**: minor × 5 publishables (`core`, `adapters`, `cli`, `mcp`, `opencode`), testkit excluded, GH-181 description ✓
- **Contracts-tier purity**: types + `as const` only; content-inventory allowances exact ✓
- **Branding neutrality**: zero product tokens; prefix derived from `BrandIdentity.environmentPrefix` as data (literal-prefix mutation test fails correctly); forbidden-literals green ✓
- **TypeScript strictness** (`.ai/rules/typescript.md`): no `any`, no `!`, casts limited to a justified post-guard narrowing (`value.kind as EnvelopeKind` after the closed-set includes check); optional props modelled as absent; indexed reads guarded ✓

## 4. Findings

### F-1 — MAJOR (security / invariant coverage) — `scripts/checks/secret-read-boundary.ts:138-151`

**Empirically proven.** The AST rule silently accepts computed-key ambient environment reads:

```ts
const key = "env";
export const secret = process[key].TOKEN;      // 0 violations
export const s2 = process[`env`].TOKEN;        // 0 violations (template literal)
const p = "proc" + "ess";
export const s3 = globalThis[p].env.TOKEN;     // 0 violations
```

Rule 3 (`sourceViolations`) only flags element access with a **string-literal** argument, and rule 4 explicitly skips an ambient-global identifier that is the *expression* of an element access (assuming rule 3 handled it). Result: `process[key]` fails no gate. Spec F-4 requires "every form either reported by the rule or rejected by a documented unsupported-form negative control, never silently accepted"; plan task 4.1 repeats it. No unsupported-form documentation or negative control exists for computed keys. This change's central claim — secret centralization is *mechanical*, not convention (spec §2.2, ticket AC-2) — has a hole a provider-adapter contributor can (even accidentally, via an indirect key) walk through. Conventional accidental forms (`process.env.X`, destructuring, aliasing, literal brackets, optional chaining) are all caught — verified — which is why this is major, not blocker.

**Required remediation (R-1)**: fail closed on `ElementAccessExpression` whose expression is an ambient-global identifier and whose argument is **not** a string literal (report `ambient element access with non-literal key`); add computed-key and template-literal fixtures to `tests/fixtures/secret-boundary/cases.ts`; alternatively document these forms as unsupported with negative-control fixtures per task 4.1's own clause. Keep the clean control green.

### F-2 — MINOR (performance / algorithmic DoS defense-in-depth) — `packages/adapters/src/io/envelope-codec.ts:33-34,149-162`

**Empirically measured.** A single `parseEnvelope` call on marker-dense hostile text (`<!-- delivery.metadata.v1 {` repeated, ~193 KB) took **1747 ms** — lazy-quantifier backtracking over start positions is O(n²) within one `exec`. Provider comment text will be external, user-controlled content once M0-S13 adapters land; a ~1 MB hostile comment extrapolates to tens of seconds on the event loop. No production consumer exists yet (NG-2), so this is a defense-in-depth fix before the first consumer — the right time per this change's own "substrate lands complete before adapters" principle.

**Required remediation (R-2)**: cap the scanned input (documented maximum; over-cap input degrades as `missing`) or use an equivalent non-quadratic scan; add a pathological-input regression test with a time bound.

### F-3 — MINOR (correctness / strip path) — `packages/adapters/src/io/envelope-codec.ts:149-171`

**Empirically proven.** `removeMarkers` collects spans from two global regexes and strips them sequentially with stale indices. When an envelope payload string contains a compact-marker lookalike and trailing human content follows the comment marker:

```
input : "<!-- delivery.metadata.v1 {...x[delivery.metadata.v1:{\"q\":1}]y...} -->\nTAIL line that must survive"
output: ""        (expected: "TAIL line that must survive")
```

Human-readable content is silently destroyed in the returned view **with no degradation evidence** — violating AC-F5-2's identity guarantee and DEC-5's visible-degradation philosophy (wrong content presented confidently is worse than a flagged degradation). Trigger requires self-referential payload content (an agent string containing a marker lookalike — plausible in meta-discussions about ADOS metadata itself), hence minor.

**Required remediation (R-3)**: rebuild the string from non-overlapping spans in a single pass (or one combined regex) so indices cannot go stale; add a regression fixture with a nested lookalike plus trailing content.

### F-4 — INFORMATIONAL (design note) — `packages/adapters/src/io/envelope-codec.ts:180-181`

Marker-lookalike text in plain human content is stripped as if it were an envelope: `See docs [delivery.metadata.v1:{"x":1}] for details` → `See docs  for details`. Inherent to text-marker carriers; AC-F5-2 does not apply (no envelope present). Recommend documenting the limitation in `feature-adapter-ports.md` for M0-S13 adapter authors; no code change required now.

### F-5 — INFORMATIONAL (process hygiene) — plan Execution Log / pm-notes

Wall-clock labels drift from git history: e.g. execution log records P1 completed "21:51Z" while commit `2beeaf2` is stamped 20:51:31Z; P7 "23:45Z" vs `ffd2a34` at 21:29:03Z; pm-notes phase windows skew similarly. No code impact and all substantive deviations are disclosed honestly; noting for timestamp discipline only. No action required.

## 5. What Is Good

The substrate is unusually well-tested for M0: every negative control is a real mutation that fails by name; the inventory is fail-closed in both directions; the credential implementation is minimal, injectable, and provably leak-free against raw and JSON-escaped canary forms; the allowlist registry is reason-bearing, class-tagged, and mutation-proven fail-closed; placement decisions (DEC-2, DEC-9) are honored exactly (codec adapter-internal, no new core subpath, `./credentials` registered on all five surfaces); doc sync is coherent. The three action findings are edge-hardening items on otherwise solid mechanisms, not structural flaws.

## 6. Verdict

```
Status: FAIL
Findings: 5 (0 blockers / 1 major / 2 minor / 2 informational)
Plan Status: ALL_TASKS_DONE (P1–P4, P7; disclosed 7.5 PR item pending phase 11)
Plan Gaps: none (CHECKED_BUT_MISSING / DONE_BUT_UNCHECKED: zero)
Test Coverage Gaps: computed-key invariant forms; adversarial-input and nested-lookalike codec cases (R-1..R-3)
Spec Compliance: FAIL against F-4's "never silently accepted" clause (F-1); all other 16 ACs PASS with verified evidence
Remediation: ADDED — tasks R-1..R-3 appended to plan Phase 6; re-review iteration 2 required (R-1 mandatory for PASS)
Next Step: EXECUTE_REMEDIATION_PHASE (Phase 6 / R-1..R-3 via @coder, then /review GH-181 iteration 2)
```

PASS at iteration 2 requires R-1 closed with new fixtures; R-2/R-3 closed or explicitly PM-accepted with TDR-grade rationale.
