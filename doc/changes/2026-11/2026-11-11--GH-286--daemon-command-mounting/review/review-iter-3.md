# Review — GH-286 — iteration 3 (final)

- **Status:** FAIL at the time of the pass; the blocking items were artifact truthfulness plus two real-child races, all behavioural ACs green.
- **Date:** 2026-11-11
- **HEAD reviewed:** `52e921a7` (+ `92d2df11`)
- **Outcome:** 49 PASS / 1 declared PARTIAL (AC-NFR-2) / 0 FAIL.

## Iteration-2 closure

| Finding | Verdict |
|---|---|
| NF-1 engine reaps a proved-dead lock | Code + tests CLOSED (`daemon-runtime.ts:294-304`, `daemon-lock.ts:69-93`, crash-restart suite with a real SIGKILL); artifact half OPEN (NF3-1) |
| NF-2 six reconciled pages declared | NOT CLOSED — plan scopes yes, spec §16 no (NF3-2) |
| NF-3 receipt folds interval/staleness; install inspects once | CLOSED |
| NF-4 three-way staleness agreement | CLOSED |
| NF-5 accepted limitation recorded | CLOSED |
| NF-6 TC-030 extended | CLOSED |
| NF-7 uninstall unresolvable-root rule | CLOSED |
| NF-8 GH-238 out-of-scope comment | CLOSED |

## Remaining findings

- **NF3-1 [high, blocking]** — the spec's non-goals (§7.2, NG-1), §16 engine row and TDR-0022 ("no daemon engine edit") denied the engine start-semantics change the branch ships.
- **NF3-2 [medium]** — §16's "complete set the delivery reconciled" claim omitted six reconciled pages.
- **NF3-3 [medium]** — foreground listeners installed after the durable readiness point; a stop racing start could terminate the child without a `released` record. Observed as a 2/6 real-reentry failure when the two real-child files ran together.
- **NF3-4 [medium]** — the 1 s detached readiness window made the real-child crash-restart witness non-deterministic at default concurrency.
- **NF3-5 [low]** — a failed compare-and-delete degraded into a bare `daemon.already-running`.
- **NF3-6 [info]** — the delivered `daemon.takeover-refused` hint still implies a successful takeover after staleness (GH-238 text, out of scope).

## Evidence run

| Check | Result |
|---|---|
| 15 daemon/lock/lifecycle/status/degradation suites | 111 pass, 0 fail |
| 9 check suites | 137 pass, 0 fail |
| 79-file daemon/queue/lanes/dispatch/structure/conformance battery at `--max-concurrency 4` | 646 pass, 1 skip, 0 fail |
| reference-page-parity + mount-help + entrypoint help/coverage/composition | 29 pass, 0 fail |
| help-guide-coverage / doc-distribution / plan validate | all green |
| Real-child determinism (each file alone) | 0/8 failures |
| Real-child determinism (both files together) | 2/6 failures (NF3-3/NF3-4) |

## Owner-hold guard

`tests/checks/owner-hold-doc.test.ts` pins the current truth (absolute `<PREFIX>_STATE_DIR` relocates store and marker together; no marker-path override; no migration) and forbids the retired phrases. PASS.

## Disposition

NF3-1/NF3-2 were closed by amending the spec (v1.5: narrowed non-goal, §16 twenty pages, AC-F2-11), TDR-0022 (scoped engine exception) and the plan. NF3-3/NF3-4/NF3-5 were closed in code and tests: listeners registered before the readiness point with a buffered signal; a cross-file real-child gate plus a quiescent kill; the failed compare-and-delete now surfaces its recovery identity. A targeted confirmation pass follows.
