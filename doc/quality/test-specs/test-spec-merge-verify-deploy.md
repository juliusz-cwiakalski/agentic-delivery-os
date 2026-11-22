---
ados_distribution: internal
id: TEST-SPEC-MERGE-VERIFY-DEPLOY
status: Current
created: 2026-11-06
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
summary: "Nonfunctional test specification for the merge and verify-deploy engine: freshness and probe determinism, the declared and probed not-green required-job contract with its recorded-or-probe attribution, the crafted landing metadata and exact-head guard, the total mergeability refusal taxonomy, read budgets, output bounds, state-write discipline, error-identity stability, idempotency, no-head-mutation and coordinator-only invariants, privacy, the byte-pinned verify-gates non-regression, and the production composition's reachability and classification fidelity."
links:
  related_changes: ["GH-225", "GH-238", "GH-300", "GH-293", "GH-349"]
---

# Test Specification: Merge and Verify Deploy

## Nonfunctional coverage

| Area | Threshold | Evidence |
|---|---|---|
| Determinism | 20-run byte equality on success and four refusals; changed-fact control differs | `tests/behaviour/merge-determinism.test.ts`, `tests/golden/merge.test.ts`, `tests/golden/verify-deploy.test.ts` |
| Merge read budget | One verification read, one work-item read, one check-run page, and one request-detail read, plus at most one post-refusal re-read and at most one unknown-recovery re-read; ≤1 landing call; zero retries, zero pagination, zero head mutations | `tests/behaviour/merge-probe.test.ts`, `tests/behaviour/merge-refusal-taxonomy.test.ts` |
| Deploy read budget | One bounded trace read; zero trigger/re-run/schedule/cancel capability | `tests/behaviour/verify-deploy-read-budget.test.ts` |
| Output bounds | Machine `data` ≤ 65 536 bytes; human summary ≤ 24 lines / 4 096 bytes; every drop marked `+N` | `tests/behaviour/merge-bounds.test.ts`, `tests/behaviour/verify-deploy-bounds.test.ts` |
| State-write discipline | Every merge append fenced and verified post-append; an append failure is classified and never consumable | `tests/behaviour/merge-verification-record.test.ts`, `tests/behaviour/merge-convergence.test.ts` |
| Change-branch resolution | The branch comes from the change record read at the request head; the verified head is the request head; the convergence attempt decides from the matched-identities member (one replays, the empty set refuses `no-open-request`, many abort naming each, a fault reports the declared provider identity) with zero record reads on the replay; per-path provider requests peak at three |
| Required-check awareness | The shipped default set makes `ci-green` merge-applicable (two-entry projection); the required-check set derives once per invocation through the delivered workflow read and the exported `expectedSetValid` rule; the landing decision reads mergeability from the delivered single-request read, never the list |
| Error-identity stability | The `merge` kind declares twelve concrete rows plus the one open-slot family, the `verify` kind its three deploy rows; documented and machine-declared together at 172 identities with the family slot registry-validated and no pattern widening; sync green both ways | `tests/structure/error-table.test.ts`, `tests/structure/merge-refusal-rows.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` |
| Landing mechanism | Exactly one guarded provider-side landing call per invocation: the squash strategy, the verified head as the expected head, the crafted title, and the fixed verbatim message; no platform-CLI spawn and no local landing composition (production-source scans with mandatory failing controls); the exact-head guard refuses with zero landing calls when the head moves | `tests/behaviour/merge-landing.test.ts`, `merge-landing-metadata.test.ts`, `merge-head-guard.test.ts`; `tests/checks/merge-landing-retirement.test.ts` |
| Refusal taxonomy | One declared identity per observed mergeability state plus absence: `dirty` and `behind-unconfirmed` sync-required, the checks-posture row on a `not-mergeable` refusal (candidates limited to the effective gate set's declared `required-ci-job` entries, so an undeclared failing job is not evidence and the refusal stays `behind-unconfirmed`), one exact-head recovery read for `unknown`, `merge.mergeability-unknown` when it persists, and zero rebase attempts and head mutations on every path | `tests/behaviour/merge-refusal-taxonomy.test.ts`, `merge-refusal-surface.test.ts`, `merge-rebase.test.ts` |
| Required-check awareness | The declared gate evaluation treats `queued`/`running` as not green, the probe extends that to every not-green declared required job, each finding names exactly one attribution (`recorded` or `probe`), and a non-declared job or a page for another head is not evidence | `tests/behaviour/merge-required-job-probe.test.ts`, `merge-probe.test.ts`; `tests/checks/merge-check-path-scan.test.ts` |
| Idempotency | A recorded landing replays with the recorded provider identity and no second landing call; an already-merged request with no record converges with zero landing calls; waiver authorization is deterministic per (record, policy) | `tests/behaviour/merge-convergence.test.ts`, `tests/behaviour/merge-waivers.test.ts` |
| No head mutation | No path rebases, fetches, pushes, or mutates the verified head; force, bypass, auto-merge, queue, and landing-retry variants are unrepresentable in the declared union; the serial three-merge fixture asserts ≤1 landing call per invocation and zero head mutations | `tests/behaviour/defect-f8-serial-merge-churn.test.ts`, `tests/structure/merge-contract.test.ts` |
| Coordinator-only | No daemon/dispatch merge composition (the daemon has no merge code path and never fires a merge); the merge command is the only landing producer | `tests/behaviour/merge-coordinator-boundary.test.ts` |
| Privacy | No secret, title, body, comment, raw payload, or log body in any output or record; allowlist unchanged | `tests/behaviour/merge-privacy.test.ts`, `tests/checks/secret-read-boundary.test.ts` |
| No live calls | Static scan plus a throwing fetch guard with zero calls and a deliberate-call control | `tests/checks/merge-deploy-no-live-calls.test.ts` |
| verify-gates non-regression | Pre-change verdict/citation/order/human bytes remain golden-identical; exactly one appended record per full battery evaluation that is not refused for narrowed suite breadth, and none on a narrowed refusal | `tests/golden/verify-gates.test.ts`, `tests/behaviour/merge-verification-record.test.ts` |
| Composition reachability | The production composition performs the real work-item, check-run, and request-detail reads over injected transports and resolves its branch from the checkout's git facts, its base reference from the declared integration base (`CLOSEOUT_INTEGRATION_BASE`, `main-tools`), its configuration (the three declared `merge` keys), and the owner principal from the provider-resolved repository owner; the ref passes the one declared work-item-ref grammar the command validates, so a digit-bearing prefix (`ABC2-12`) resolves to its work item instead of being refused as unresolvable; an absent configuration document keeps the delivered defaults, while a malformed document (`config.file.malformed`) and an invalid `merge` value (`config.value.invalid` — one cell for an invalid `merge.gates` set, one for an invalid `gate-freshness`) each classify as its declared `config` row at exit `1` before any provider read and before any verification or transaction append; a dry run evaluates the merge-applicable battery, appends one verification, lands nothing, and exits `0` when every gate passes or classifies a gate refusal at exit `1` | `tests/behaviour/merge-production-composition.test.ts`, `tests/behaviour/merge-dry-run.test.ts` |
| Classification fidelity | Every failure the production composition emits carries the `domainKind` its resolved error-table row declares and that row's exit projection — the state-read and read-fault constructors derive the kind and the exit from the same resolved row, so a row whose projection class moves takes its emitted exit with it; a missing credential is `config.credential.missing` (`config`, `user-validation`, exit `1`) and never the contained `fallback.internal`; a rejected credential is `provider.auth.rejected` at exit `1`, an unreachable or malformed provider answer is `provider.outage` at exit `2`, and a non-resolving reference is `merge.transaction-aborted` at exit `1` | `tests/behaviour/merge-production-composition.test.ts`, `tests/behaviour/merge-classification.test.ts`, `tests/checks/error-table-sync.test.ts` |
| Emittable-code totality | `MERGE_COMPOSITION_EMITTABLE_CODES` is non-empty, duplicate-free, spans at least one member in each of the three domains the composition emits (`config`, `provider`, `merge`) and none in any other — it carries no `state.*` member, because the state-read refusal is the declared `merge.state-unverified` row (declared `domainKind: merge`) at its declared projection and exit `2` — every member resolves to a declared row whose `domainKind` equals the kind the composition emits, and every refusal branch has a member. The declaration is exhaustive over the codes the refusal branches emit **including** the `merge.gate.<gate-id>.failed` family that the transaction emits, so a declared refusal can never reach the containment identity; the configuration-read branch's forwarded codes are declared once in a tuple typed against the delivered configuration taxonomy (so a code the taxonomy does not declare cannot be forwarded), and the conformance case asserts that every member of that tuple is a member of the emittable declaration whose declared kind is `config` and is covered by the forwarded-code scan; the refusal-site scan covers the whole composition, matching both `return "<code>"` and `code: "<code>"` sites, so an emitted literal anywhere in the merge composition must be a declared member. A live mismatch control still reaches the containment identity, so an empty or hand-picked assertion set cannot pass | `tests/structure/merge-classification-conformance.test.ts`, `tests/structure/defect-f1-merge-refusal-containment.test.ts`, `tests/behaviour/merge-production-composition.test.ts` |

## Notes

The binding harness is in-process and offline; the landing, refusal-taxonomy, and
convergence cases drive the transaction through injected ports and an injected
recording transport, so the landing call's captured title and message bytes,
the expected head, and the call count are asserted without a live provider, and
the serial three-merge fixture uses a temporary git repository with deterministic
identity and no remotes. All goldens are read-only at test time and carry a
mutation control; the retired `refusal-rebase` pair is absent from the scenario
list while its identity stays machine-declared and reserved. The verify-gates
goldens are the pre-change oracle and are not regenerated.

The production composition runs over injected provider transports and credential
ports, so reachability and classification are proven without a live network call
or a live credential read. `verify deploy`'s production target resolution remains
a declared residual: its delivered behaviour, goldens, and error identities are
unchanged and no test in this set claims an engine-verified deploy.
