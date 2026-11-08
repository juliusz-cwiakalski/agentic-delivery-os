---
ados_distribution: internal
id: TEST-SPEC-MERGE-VERIFY-DEPLOY
status: Current
created: 2026-11-06
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "Nonfunctional test specification for the merge and verify-deploy engine: freshness and probe determinism, read budgets, output bounds, state-write discipline, error-identity stability, idempotency, no-force and coordinator-only invariants, privacy, and the byte-pinned verify-gates non-regression."
links:
  related_changes: ["GH-225", "GH-238"]
---

# Test Specification: Merge and Verify Deploy

## Nonfunctional coverage

| Area | Threshold | Evidence |
|---|---|---|
| Determinism | 20-run byte equality on success and four refusals; changed-fact control differs | `tests/behaviour/merge-determinism.test.ts`, `tests/golden/merge.test.ts`, `tests/golden/verify-deploy.test.ts` |
| Merge read budget | One verification read, one work-item read, one check-run page, one request-detail read; zero retries/pagination; mutations only on their declared paths | `tests/behaviour/merge-probe.test.ts` |
| Deploy read budget | One bounded trace read; zero trigger/re-run/schedule/cancel capability | `tests/behaviour/verify-deploy-read-budget.test.ts` |
| Output bounds | Machine `data` ≤ 65 536 bytes; human summary ≤ 24 lines / 4 096 bytes; every drop marked `+N` | `tests/behaviour/merge-bounds.test.ts`, `tests/behaviour/verify-deploy-bounds.test.ts` |
| State-write discipline | Every merge append fenced and verified post-append; an append failure is classified and never consumable | `tests/behaviour/merge-verification-record.test.ts`, `tests/behaviour/merge-convergence.test.ts` |
| Error-identity stability | Eleven new identities documented and machine-declared together; family slot registry-validated; sync green both ways | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` |
| Idempotency | Recorded contained landing replays with no second landing; waiver authorization deterministic per (record, policy) | `tests/behaviour/merge-convergence.test.ts`, `tests/behaviour/merge-waivers.test.ts` |
| No force | Operation union declares no force variant; production scan with a mandatory failing control | `tests/behaviour/merge-rebase.test.ts`, `tests/structure/merge-contract.test.ts` |
| Coordinator-only | No daemon/dispatch merge composition (the daemon has no merge code path and never fires a merge); the merge command is the only landing producer | `tests/behaviour/merge-coordinator-boundary.test.ts` |
| Privacy | No secret, title, body, comment, raw payload, or log body in any output or record; allowlist unchanged | `tests/behaviour/merge-privacy.test.ts`, `tests/checks/secret-read-boundary.test.ts` |
| No live calls | Static scan plus a throwing fetch guard with zero calls and a deliberate-call control | `tests/checks/merge-deploy-no-live-calls.test.ts` |
| verify-gates non-regression | Pre-change verdict/citation/order/human bytes remain golden-identical; exactly one appended record per full battery evaluation | `tests/golden/verify-gates.test.ts`, `tests/behaviour/merge-verification-record.test.ts` |

## Notes

The binding harness is in-process and offline; the landing, rebase, and
convergence cases use one temporary git repository per case with deterministic
identity and no remotes. All goldens are read-only at test time and carry a
mutation control. The verify-gates goldens are the pre-change oracle and are not
regenerated.
