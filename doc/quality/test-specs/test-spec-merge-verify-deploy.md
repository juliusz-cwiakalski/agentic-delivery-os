---
ados_distribution: internal
id: TEST-SPEC-MERGE-VERIFY-DEPLOY
status: Current
created: 2026-11-06
last_updated: 2026-11-18
owners: ["engineering"]
service: delivery-os
summary: "Nonfunctional test specification for the merge and verify-deploy engine: freshness and probe determinism, read budgets, output bounds, state-write discipline, error-identity stability, idempotency, no-force and coordinator-only invariants, privacy, the byte-pinned verify-gates non-regression, and the production composition's reachability and classification fidelity."
links:
  related_changes: ["GH-225", "GH-238", "GH-300", "GH-293"]
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
| verify-gates non-regression | Pre-change verdict/citation/order/human bytes remain golden-identical; exactly one appended record per full battery evaluation that is not refused for narrowed suite breadth, and none on a narrowed refusal | `tests/golden/verify-gates.test.ts`, `tests/behaviour/merge-verification-record.test.ts` |
| Composition reachability | The production composition performs the real work-item, check-run, and request-detail reads over injected transports and resolves its branch from the checkout's git facts, its base reference from the declared integration base (`CLOSEOUT_INTEGRATION_BASE`, `main-tools`), its configuration (the three declared `merge` keys), and the owner principal from the provider-resolved repository owner; an absent configuration document keeps the delivered defaults and an unreadable or invalid one forwards its own classified code; a dry run evaluates the merge-applicable battery, appends one verification, lands nothing, and exits `0` when every gate passes or classifies a gate refusal at exit `1` | `tests/behaviour/merge-production-composition.test.ts`, `tests/behaviour/merge-dry-run.test.ts` |
| Classification fidelity | Every failure the production composition emits carries the `domainKind` its resolved error-table row declares and that row's exit projection; a missing credential is `config.credential.missing` (`config`, `user-validation`, exit `1`) and never the contained `fallback.internal`; a rejected credential is `provider.auth.rejected` at exit `1`, an unreachable or malformed provider answer is `provider.outage` at exit `2`, and a non-resolving reference is `merge.transaction-aborted` at exit `1` | `tests/behaviour/merge-production-composition.test.ts`, `tests/behaviour/merge-classification.test.ts`, `tests/checks/error-table-sync.test.ts` |
| Emittable-code totality | `MERGE_COMPOSITION_EMITTABLE_CODES` is non-empty, duplicate-free, spans at least one member in each of the three domains the composition emits (`config`, `provider`, `merge`) and none in any other — it carries no `state.*` member, because the state-read refusal is the declared `merge.state-unverified` row (declared `domainKind: merge`) at its declared projection and exit `2` — every member resolves to a declared row whose `domainKind` equals the kind the composition emits, and every refusal branch has a member, including the configuration-read branch's forwarded `config.*` codes (`config.file.malformed`, `config.value.invalid`), each classified as its own row at its declared exit; the error-table row count, `DOMAIN_KINDS`, and exit classes are unchanged | `tests/structure/merge-classification-conformance.test.ts`, `tests/behaviour/merge-production-composition.test.ts` |

## Notes

The binding harness is in-process and offline; the landing, rebase, and
convergence cases use one temporary git repository per case with deterministic
identity and no remotes. All goldens are read-only at test time and carry a
mutation control. The verify-gates goldens are the pre-change oracle and are not
regenerated.

The production composition runs over injected provider transports and credential
ports, so reachability and classification are proven without a live network call
or a live credential read. `verify deploy`'s production target resolution remains
a declared residual: its delivered behaviour, goldens, and error identities are
unchanged and no test in this set claims an engine-verified deploy.
