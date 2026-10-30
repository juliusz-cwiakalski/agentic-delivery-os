# Code Review — GH-174 State Layer — Iteration 2 (Fix Verification)

| Field | Value |
|---|---|
| work_item_ref | GH-174 |
| mode | local (plan Phase 9 tasks 9.1–9.2; 9.3 gate repetition) |
| branch / HEAD | `feat/GH-174/state-layer` @ Phase 9 fix commit |
| base | `main-tools` |
| verified_at | 2026-10-30 (system clock; UTC) |
| verdict | **FIXES VERIFIED (executor self-check)** — independent re-review still pending |
| independence | **Not an independent `@reviewer` pass.** This record verifies the executor's own fixes; TC-REVIEW-001 remains a lifecycle gate. |
| scope of write | state code/tests, TDR-0004, feature-state-layer, plan, review artifacts |

## 1. Reproduction before fixes

Each accepted finding was reproduced before the smallest fix. The four focused suites
(index, permissions, contract, torn) were green at `8e5c22e` (38 pass); after adding the
regressions and before the code changes they produced:

- `state-index.test.ts` — payload-only divergence returned `"forged-index-value"` from the
  `sqlite` kind while the ledger held `{n:1}` (F-1).
- `state-contract.test.ts` — `checkIntegrity()` returned `ok:true` verified-empty on a
  `project`-level store while `read()` returned `state.level.unsupported` (F-2).
- `state-torn.test.ts` — repair truncated the tail and then returned
  `state.schema.mismatch`, so ledger bytes changed after a reported refusal (F-4).
- `state-permissions.test.ts` — the ACL helper did not exist yet (F-3); the current
  matcher `/BUILTIN\\\\Users/` was separately shown by a Node probe **not** to match
  `BUILTIN\Users`.

F-2's permission half was reproduced with an ephemeral probe
(`tmp/tmpdir/gh174-review-probe.ts`, not committed): a 0755 directory made `read()` fail
`state.permission.denied` while `checkIntegrity()` returned `ok:true`.

## 2. Fix verification

| Finding | Fix | Regression evidence | Result |
|---|---|---|---|
| F-1 | `strategy.ts` agreement now also compares `payload` with `JSON.stringify(record.payload)`. | `state-index.test.ts` "a payload-only index divergence is detected and rebuilt to ledger truth" asserts `{k1:{n:1}}`, `rebuild.reason === "divergent"`, ledger bytes unchanged. | PASS |
| F-2 | `checkIntegrity()` returns the construction-time `failure` before any read. | `state-permissions.test.ts` "checkIntegrity fails closed on a permission violation"; `state-contract.test.ts` project/global case also asserts `checkIntegrity()` → `state.level.unsupported`, zero writes. | PASS |
| F-3 | Extracted `hasForeignAclGrant()` with the corrected one-backslash expression; `verifyMode` uses it. | `state-permissions.test.ts` "the foreign-grant matcher rejects every non-current-user principal form" (BUILTIN\Users, Everyone, Authenticated Users true; current user false). Runs on every platform; **no Windows verification is claimed**. Named executable allowance registered in `content-inventory.test.ts`. | PASS |
| F-4 | `repairTornTail()` reads and returns the store-header verdict before any truncation. | `state-torn.test.ts` "repair refuses before mutating when the store version is unsupported" asserts `state.schema.mismatch` and byte equality. | PASS |
| F-5 | TDR-0004 §3 recovery wording corrected (clears the stale lock; caller re-acquires) and §4 agreement tuple corrected (adds `kind`/`payload`), with an Amendments row; `feature-state-layer.md` torn bullet now separates torn classes from index-divergence rebuild/`state.write.failed`. | Doc review against `index.ts:429-449` and `strategy.ts`; no behaviour claim added. | PASS |
| F-6 | Removed the four unused imports. | `biome lint` no longer reports any state test file. | PASS |
| F-7 | Plan Phase 7 tasks 7.1–7.5 checked with evidence; Phase 7/8/9 execution-log rows added; Phase 6 commit cell corrected to `f71d19d`. Task 7.6 left partial (bash/tool evidence absent, re-run at Phase 10.3). | Plan re-read after edit. | PASS |

Affected ACs remain traceable: F-1 → AC-F3-1/F-4 (values equal ledger truth, divergence
detected); F-2 → AC-F8-1/AC-F1-3 (fail-closed, no unsupported-level success); F-3 →
AC-F8-2 (delivered branch now detects foreign grants; still platform-conditional); F-4 →
AC-F2-2/AC-F4-3 (no coercion, refusal changes nothing).

## 3. Gate repetition (executor-run)

- Focused state suites after fixes: `bun test tests/behaviour/state-*.test.ts
  tests/structure/state-{contract,imports,scope}.test.ts` → **98 pass / 0 fail**, 527
  expectations, 13 files. `content-inventory` → 6 pass.
- Full `pnpm check` (log `tmp/tmpdir/gh174-phase9-pnpm-check.log`): **exit 0** —
  lint 258 files (3 warnings + 1 info, all pre-existing outside the state files), format
  clean, typecheck six packages, **627 pass / 0 fail across 62 files**, depcruise 64
  modules/76 dependencies with no violations, ambient-globals clean, exports-parity 5/5.
- Repository checks: error-table-sync (20/20), forbidden-literals (0 violations, state doc
  registered), license-audit, vulnerability-gate (0 high/critical), ci-topology (7 bash /
  16 TS jobs) — all exit 0.
- No `@runner` delegation was available in this execution environment; the executor ran
  the gate directly and captured the log. This is not independent evidence.

## 4. What this record is not

- It is **not** a PASS from an independent reviewer, and it does not close plan task 9.3
  (independent re-review until PASS).
- It does not re-verify the Phase 7 bash/tool run-only suites (Phase 10.3 owns them).
- The three information-only observations from iteration 1 remain open by design (binding-
  unavailable classification, non-Result `fenceStatus`, uncaught repair read I/O).
