# Code Review — GH-174 State Layer — Iteration 1

| Field | Value |
|---|---|
| work_item_ref | GH-174 |
| mode | local (chunked-delivery execution; plan Phase 8 tasks 8.1–8.3) |
| branch / HEAD | `feat/GH-174/state-layer` @ `8e5c22e` |
| base | `main-tools` |
| reviewed_at | 2026-10-30 (system clock; UTC) |
| verdict | **FINDINGS** — 6 actionable findings (0 critical / 0 high / 2 medium / 3 low / 1 hygiene) + 3 information-only observations |
| remediation phase | **REQUIRED** (plan Phase 9; findings F-1..F-6) |
| independence | **Self-review by the delivery executor.** No independent `@reviewer` sign-off is claimed; TC-REVIEW-001 remains a lifecycle gate. |
| scope of write | this file only (analysis); Phase 9 writes code/tests/docs/plan |

## 1. Review method

Read in full: spec v1.1 (§8.3 rows, §9 NFRs, §17 all 22 ACs, Appendix A), plan v1.1
(Phases 1–10, bindings D1–D8), TDR-0004, `feature-state-layer.md`, every
`packages/core/src/{contracts/state.ts,state/*.ts,state/driver/*.ts}` source file, the
error-table diff, `.dependency-cruiser.cjs` and forbidden-literal-registry diffs, and the
assertion bodies of all 10 state behaviour suites plus the structure/scope/imports/packed
suites. Two suspected defects were reproduced with an ephemeral probe
(`tmp/tmpdir/gh174-review-probe.ts`, not committed) before being recorded. Focused
baseline (`bun test` over index/permissions/contract/torn) was 38 pass / 0 fail at HEAD.

## 2. Hard-AC trace (spec v1.1 §17)

| Hard AC | Evidence read | Result |
|---|---|---|
| Torn never silent (AC-F4-1..3, AC-F2-2, AC-F5-1) | `ledger.ts:132-159` verifies framing→terminal→sequence→checksum→version before values; `index.ts:310-335` asserts keys after verification; `state-torn.test.ts` six variants + canaries + detection-disabled control; `state-keys.test.ts` falsy/missing. | PASS (except F-4 repair ordering) |
| No implementation-dependent call sites (AC-F1-2, AC-F3-1, AC-F10-1) | `contracts/state.ts:208-222` port has no kind discriminant; `state/index.ts:79-80` is the only kind selection; conformance parity 2/2 with divergent-driver control; depcruise allowance narrowed to `state/driver/` with fixtures. | PASS for call sites; **F-1** breaks values-equal-ledger-truth for a payload-only index divergence |
| Fence type-level enforcement (AC-F7-1..3, DEC-7) | unique-symbol brand `contracts/state.ts:164-171`; `append`/`replaceDocument` take the handle; negative compile fixture `state-fence.test.ts:117-164` fails with `StateFenceHandle|stateFenceHandleBrand`. | PASS |
| Injected identity (AC-F1-1, AC-F1-3, AC-F1-4) | every path from `identity`; `#contracts`-only imports; ambient-marker scan; level rejection zero-write recorder; workspace scoping test. | PASS; **F-2** exposes a classified-failure bypass through `checkIntegrity` |

Bindings D1–D8: D1 layout, D2 built-in SQLite + recorded matrix, D3 in-change rows
(sync run at HEAD: 20/20), D4 no CI/check topology change (diff confirms), D6/D5 belong to
Phase 10, D7 conformance harness with fixture-digest equality and map-relative guards,
D8 AST detector + tightened depcruise allowance with failing fixture and clean control.

## 3. Findings

| ID | Severity | Location | Mapping | Finding | Disposition |
|----|----------|----------|---------|---------|-------------|
| **F-1** | medium | `packages/core/src/state/driver/strategy.ts:59-71` | AC-F3-1, F-3/F-4/Appendix A "index/ledger divergence", NFR-1/NFR-8, TDR-0004 §4 | Index agreement compares `(sequence,key,kind,checksum)` but **not `payload`**. A payload-only divergence keeps the copied checksum, so agreement passes and `parseRowValues` returns the index payload: the `sqlite` kind served `"forged-index-value"` while the verified ledger and the `jsonl` kind returned `"ledger-truth"` (reproduced). This is a silent divergent read — exactly the class F-3 says is detected and rebuilt. | **Fix in Phase 9**: include payload equality in agreement; add regression; amend TDR-0004 §4. |
| **F-2** | medium | `packages/core/src/state/index.ts:451-455` | AC-F8-1 (fail closed), AC-F1-3 (unsupported level), F-8/F-1, NFR-5 | `checkIntegrity()` does not consult the construction-time `failure`. Reproduced: on a 0755 directory it returned `ok:true` with verified evidence while `read()` returned `state.permission.denied`; on a `project`-level store it returned `ok:true` verified-empty while `read()` returned `state.level.unsupported`. A public operation continues permissively past a fail-closed open verdict. | **Fix in Phase 9**: return `failure` first; add fail-closed regressions (permissions + level). |
| **F-3** | medium | `packages/core/src/state/driver/runtime-edge.ts:104` | AC-F8-2, F-8, TDR-0004 §6 | The Windows foreign-grant matcher is `/Everyone|BUILTIN\\\\Users|Authenticated Users/i`; in a regex literal `\\\\` matches **two** literal backslashes, so `BUILTIN\Users` (one) is not detected (verified with Node). An icacls listing granting `BUILTIN\Users` while naming the current user would verify as acceptable. The win32-only test grants `Everyone`, so the gap is invisible on Linux and on the current control. | **Fix in Phase 9**: correct the matcher and extract it as a pure, platform-independent helper with synthetic-icacls regressions. No Windows verification claimed. |
| **F-4** | low | `packages/core/src/state/index.ts:457-491` | AC-F2-2 (no coercion), AC-F4-3 (refusal changes nothing) | `repairTornTail()` does not read the store header before mutating. On a store whose header declares `delivery.state.v999` and whose ledger has a terminal partial tail, the tail is truncated **first**, then `verifiedState()` returns `state.schema.mismatch`: a failed report after bytes changed. A store-version verdict must precede any destructive step. | **Fix in Phase 9**: return the header verdict before truncation; add byte-equality regression. |
| **F-5** | low | `doc/decisions/TDR-0004-state-storage-engine.md` §3/§4; `doc/spec/features/feature-state-layer.md` "Torn-state detection" bullet | Phase 8.2 (TDR truthfulness), AC-F3-1, Phase 9.2 (docs with code) | TDR-0004 §3 says recovery "replaces the lock content with the recovering token"; the shipped `recoverFence` removes the stale lock, invalidates handles, and the caller re-acquires (`index.ts:429-449`, exercised by `state-fence.test.ts:190-222`). The feature doc says index/ledger divergence "fail[s] `state.store.torn`", while AC-F3-1 and the code rebuild-and-report or fail `state.write.failed`. | **Fix in Phase 9**: amend TDR-0004 §3 and §4 and correct the feature-doc bullet. |
| **F-6** | low (hygiene) | `tests/behaviour/state-{atomic-replace,fence,index,torn}.test.ts` | Phase 8.3 quality; repo lint gate | Four `noUnusedImports` warnings (the known non-blocking set): `withinFence` in atomic-replace:17 and fence:23, `join` in index:8, `readFileSync` in torn:8. | **Fix in Phase 9**: remove the dead imports (no behavior change). |
| **F-7** | low (traceability) | `chg-GH-174-plan.md` Phase 7 tasks 7.1–7.6; Execution Log | Plan §Execution Log, Phase 8.3 evidence audit | Phase 7 work is committed (`8e5c22e`) but all six Phase 7 boxes are unchecked and the Execution Log has no Phase 7 row; the Phase 6 row's commit cell is the placeholder `P6` although the commit is `f71d19d`. | **Fix in Phase 9**: reconcile the plan (check off with evidence, add the Phase 7 row, replace `P6`). |

No critical/high findings: no protected-path, credential, header, prompt, plugin, bash-stack,
or CI change appears in `git diff --name-only origin/main-tools...HEAD`; the only
configuration edits are the allowed runtime-allowance tightening and literal-registry row.

## 4. Information-only observations (no fix in this change)

1. `strategy.ts:100` classifies an unavailable SQLite binding as `state.write.failed` (the
   only runtime-matrix fallback path). Both supported runtimes have a binding, the matrix
   test fails rather than skips, and no code exists for "binding unsupported". A future
   matrix expansion should settle the identity with a decision; not invented here.
2. `fenceStatus()` is the only public operation outside `StateResult`; it performs a
   read-only lock inspection and returns token/held/stale. It cannot report the open
   failure without a port shape change; it exposes no record data.
3. `repairTornTail()` reads the ledger outside a `try`; an injected read I/O failure would
   throw instead of classifying. No read-fault seam exists and the behaviour is
   unreachable through the declared fault points; recorded for any future fault-matrix
   extension.

## 5. Negative-control audit (non-vacuity)

Live controls confirmed by reading: torn detection-disabled (planted canary would surface),
auto-repair control (would discard the first record), default substitution (would fabricate
a key), local fallback (would create the directory), lock-disabled double writer, silent
steal (unstale fence cannot be recovered), crash matrix pre-rename vs post-rename,
mode-ignoring control, payload-including formatter, packed non-existent subpath, seeded CLI
and config violations, and the divergent-driver control. No failed negative control found.
The fence "silent-steal control" at `state-fence.test.ts:224-231` is a shape-only assertion
(the behavioral control is the unstale-recovery refusal at lines 284-299); recorded as weak
but not failed.

## 6. Verdict

**FINDINGS** — Phase 9 runs. F-1 and F-2 are accepted as blockers for a PASS because each
breaks an AC property (values equal ledger truth; fail-closed public operations); F-3 is a
delivered-but-unverifiable platform branch with a real detection defect; F-4/F-5 close an
ordering and a documentation-truthfulness gap; F-6/F-7 are hygiene/traceability. No
owner/TDR acceptance is claimed.
