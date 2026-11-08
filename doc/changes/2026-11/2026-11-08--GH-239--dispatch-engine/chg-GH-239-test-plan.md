---
id: chg-GH-239-test-plan
status: Proposed
created: 2026-11-08T00:00:00Z
last_updated: 2026-11-08T00:00:00Z
owners: [engineering]
service: delivery-os dispatch engine
labels: [change, planning, m1, m1-s9, dispatch, dual-run, handover]
version_impact: minor
summary: "Seventy-eight scenarios verifying GH-239: one-shot typed dispatch with harness resolution and lease claim, progress-based liveness, truth-bound token derivation, resume and restart economics, durable dual-run evidence, the four-condition handover gate with per-repository reversible handover, CLI-independent bash fallback, daemon lane integration, dispatch registration and error identities, and a controlled-repository end-to-end proof that never fires a merge."
links:
  change_spec: ./chg-GH-239-spec.md
  implementation_plan: ./chg-GH-239-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S9: Dispatch engine: dual-run evidence and per-repo handover

## 1. Scope and Objectives

This plan protects the typed per-ticket dispatch loop and the evidence-based authority mechanism that lets one repository move from bash-authoritative to engine-authoritative and back. The core behaviors to protect are: (a) result derivation is bound to artifact, tracker, ledger, and CI truth rather than an exit code; (b) every dispatch leaves exactly one durable, bounded evidence record whose comparison and corroboration fields are complete; (c) eligibility is a four-condition conjunction whose floor is the only place "whichever comes first" applies; (d) authority transfer is recorded, per-repository, reversible, and readable by the four bash entry points without invoking the typed CLI; and (e) dispatch never fires a merge.

The highest integrity risks are an exit-0-with-no-artifact run counted as clean, a false-success incident silently zeroed, an unresolved divergence dropped from eligibility, a handover that flips the wrong repository, a bash fallback that breaks when the typed CLI is absent, and a corroboration claim accepted on the engine token alone. These are must-pass gates, not review notes. The change is proven on a controlled repository or injected fixture; no real repository is flipped (D2, NG-1, NG-9).

### 1.1 In Scope

- `dispatch REF`, including `--harness NAME` and `--resume-prompt TEXT`: harness resolution, repository lease claim, fresh spawn, resume, progress-based liveness, shared classification, truth-bound token derivation, exit projection, and the machine envelope.
- Text mode's exactly four keys (`result=`, `pr_url=`, `exit_code=`, `last_message=`) in order, with no fifth key; the bash-internal `closeout_unverified=` is not emitted (DEC-8).
- The `outcome` field as mandatory envelope data beside `result`, and the TDR-0010 rule that harness-path `noop-lane-permission` means spawn-refused.
- Three additive state record kinds (`dispatch.attempt`, `dispatch.divergence`, `dispatch.handover`), their payload schemas, and the derived per-repository authority view (`delivery.dispatch.authority.v1`) including its fail-safe absent/unreadable/malformed default of `dual-run`.
- `dispatch dual-run summary --repo REPO`, `dispatch dual-run resolve DIVERGENCE_ID --note TEXT`, `dispatch handover REPO`, and `dispatch handover REPO --revert` (DEC-6, DEC-7).
- The four-condition gate: zero false-success incidents and zero unresolved divergences in the window; all eleven TDR-0005 classes covered; at least 20 counted dispatches or at least 7 consecutive UTC dates with at least one counted dispatch, whichever comes first, binding only the floor; corroboration from completed pm-notes phases, tracker state, and CI on the pushed head.
- The family-wise comparison baseline: verify-class tokens compare to the verify-change ledger outcome; tracker-pr tokens compare to independent tracker truth; dispatch-session tokens compare at outcome level with an explicit not-applicable token baseline (DEC-3).
- Incident-reset window semantics: a false-success incident resets the window lower bound and forces floor and class coverage to re-accrue; a resolved divergence does not (DEC-10).
- Bash fallback in all four entry points (`deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, `ceo-loop.sh`) in dual-run, authoritative, and typed-CLI-absent conditions, with no new required arguments and no typed CLI invocation in the authority decision.
- Daemon lane integration: the production `LaneLaunchPlanner` and `createLaneExecutor` availability through the delivered `LaneExecutorPort`, plus the daemon-less one-shot path.
- Dispatch registration in the prompt-required composition, root and command help, the reference page, the two new error rows, and the retirement or inversion of the three delivered absence assertions.
- The F-9 host-runner deferral revisit: the record states the production-consumer outcome and is no longer a blanket "no dispatch surface" claim.
- Story-owned planning reconciliation: the dispatch reference page and seeded scenarios SC-M1-29 and SC-M1-30 carry the amended four-condition bar, not the superseded calendar proxy.

### 1.2 Out of Scope and Known Gaps

- **No real repository flip and no real pilot evidence.** All end-to-end proof uses a controlled repository or injected fixture. Real evidence accrual starts after merge (NG-9, RSK-10).
- **No vocabulary change.** The eleven-token set, projection classes, derivation classes, TDR-0005, and TDR-0010 are unchanged; the plan asserts the closed set rather than proposing a twelfth token (NG-2).
- **No merge authority and no merge test of the merge command.** Dispatch is asserted to have no merge port or merge code path; the delivered `merge` behavior itself is out of scope (NG-3).
- **No coordinator supervision.** `ceo-loop.sh`'s loop-driving function belongs to M1-S23 (NG-4).
- **No tracker or PR label migration at handover**, no cross-host authority sharing, no containerized or remote lane execution, and no bash re-architecture (NG-5 through NG-8).
- **No evidence retention, compaction, pruning, or import of pre-dispatch bash logs** (NG-11, Section 7.3 of the spec).
- **No `doc/spec/**` edits.** Current-truth reconciliation is phase 7 (NG-10).
- **Only the story-owned reference page and SC-M1-29/SC-M1-30 may be reconciled.** The GH-239 ticket body, `backlog-ranking.md`, `roadmap.md`, `cli-command-registry.md`, milestone journeys, user journeys, and the operator-input record remain unchanged and are reported, not edited.
- **Reference-host latency is not a shared-CI wall-clock gate.** The p95 summary bound is measured on the declared reference host; the deterministic bounded-read assertion is the default-suite gate (see OQ-T3).
- **Pre-session input refusals are envelope-only by interpretation.** AC-F4-1's "any dispatch" is read as any dispatch that reaches classification, because an attempt record requires an engine outcome and token (OQ-T2).

### 1.3 Risk-Based Prioritization

**Must-pass (AC-gating).** A failure blocks delivery: `TC-DISP-001` through `TC-DISP-004`, `TC-DISP-006` through `TC-DISP-011`; `TC-TRUTH-001` through `TC-TRUTH-004`, `TC-TRUTH-006`; `TC-RESUME-001` through `TC-RESUME-004`; `TC-EVID-001` through `TC-EVID-005`; `TC-GATE-001` through `TC-GATE-010`; `TC-HAND-001` through `TC-HAND-006`; `TC-BASH-001` through `TC-BASH-005`; `TC-E2E-001`, `TC-E2E-002`; `TC-MERGE-001` through `TC-MERGE-004`; `TC-DAEMON-001` through `TC-DAEMON-003`; `TC-HELP-001` through `TC-HELP-003`; `TC-PLANREC-001`; `TC-ERR-001` through `TC-ERR-005`; `TC-TOKEN-001`, `TC-TOKEN-002`; `TC-NFR-001`, `TC-NFR-002`, `TC-NFR-003`, `TC-NFR-005`, `TC-NFR-006`, `TC-NFR-007`; `TC-REG-001`.

**Nice-to-have (supplemental).** A failure improves diagnosis or exposes over-generalization but does not reopen an AC whose primary evidence is elsewhere: `TC-DISP-005` (stall corner; AC-F1-2 also carried by `TC-DISP-003` and `TC-DISP-004`), `TC-DISP-012` (noop nothing-to-do negative control; AC-F2-4 also carried by `TC-DISP-008` and `TC-DISP-011`), `TC-TRUTH-005` (blocked tracker case; AC-F2-2 also carried by `TC-TRUTH-002` through `TC-TRUTH-004`), `TC-DET-001` (determinism control; AC-F11-2 also carried by `TC-HELP-002`), `TC-E2E-003` (hand-insertion guard; AC-F8-1 also carried by `TC-E2E-001`), `TC-NFR-004` (truncation declaration; AC-F5-4 also carried by `TC-GATE-006`).

### 1.4 Binding Judgment Calls Enforced by This Plan

| # | Judgment call | Where enforced |
|---|---|---|
| 1 | Two surfaces beyond the synopsis exist: `dispatch handover REPO --revert` and `dispatch dual-run resolve DIVERGENCE_ID --note TEXT`. | `TC-HELP-001`, `TC-HAND-003`, `TC-EVID-002`, `TC-PLANREC-001` |
| 2 | Text mode emits exactly four keys; `closeout_unverified=` is not emitted; unverified state rides `pr-open-unverified` and `state-unverified`. | `TC-DISP-007`, `TC-DISP-011`, `TC-TRUTH-003`, `TC-TRUTH-006` |
| 3 | Family-wise comparison baseline; never assert a verify-change token against a `pr-open` result. | `TC-GATE-008`, `TC-EVID-002` |
| 4 | A false-success incident resets the evidence window lower bound; a resolved divergence does not. | `TC-EVID-003`, `TC-GATE-009` |
| 5 | Day floor = distinct UTC dates with at least one counted dispatch, in a run of at least 7 consecutive dates; "whichever comes first" binds only the floor. | `TC-GATE-003`, `TC-GATE-004`, `TC-GATE-005` |
| 6 | `outcome` is mandatory in envelope `data` beside `result`. | `TC-DISP-006`, `TC-DISP-011` |
| 7 | `dispatch.session.spawn-failed` exits 1; `dispatch.state-unverified` exits 2; existing dispatch rows are unchanged. | `TC-ERR-001`, `TC-ERR-002`, `TC-ERR-003` |
| 8 | Story-owned planning reconciliation is limited to the reference page and SC-M1-29/SC-M1-30. | `TC-PLANREC-001` |
| 9 | The F-9 host-runner deferral is revisited and recorded; the absence assertion is inverted, but F-9 need not be fully resolved. | `TC-HELP-003` |
| 10 | Proof boundary: end-to-end on a controlled repository/fixture with injected harness, tracker, CI, and state ports; no real repository flipped. | `TC-E2E-001`, `TC-E2E-002`, `TC-E2E-003` |
| 11 | `dispatch dual-run summary` exits 0 even when ineligible; handover refusal exits 1; noop reversal exits 0. | `TC-GATE-002`, `TC-HAND-001`, `TC-HAND-003` |

### 1.5 Test-Facing Names and Test Infrastructure Summary

The scenarios below bind behavior, commands, outputs, records, and exits. They also name the following test-facing seams so implementation and tests cannot drift silently. If the implementation plan chooses different symbol names, only the names in Section 7 change; the scenarios and assertions stay binding.

| Surface | Name used in this plan |
|---|---|
| CLI | `dispatch`, `dispatch dual-run summary`, `dispatch dual-run resolve`, `dispatch handover`, `--revert` |
| Result derivation | `deriveDispatchResult(...)` |
| Failure classification | `classifyDispatchFailure(...)` |
| Gate predicate | `evaluateHandoverGate(...)` |
| Evidence fold | `foldEvidenceWindow(...)` |
| Authority read | `readDispatchAuthority(stateRoot, repository)` |
| Attempt append | `appendDispatchAttempt(...)` |
| Divergence append | `appendDispatchDivergence(...)`, `resolveDispatchDivergence(...)` |
| Handover append | `appendDispatchHandover(...)` |
| Lane planning and execution | `planLaneLaunch(request)`, `createLaneExecutor(...)`, `runSupervisionCycle(...)` |
| Record schemas | `delivery.dispatch.attempt.v1`, `delivery.dispatch.divergence.v1`, `delivery.dispatch.handover.v1`, `delivery.dispatch.authority.v1` |
| Derived authority view fixture path | `dispatch/authority.json` under the temporary state root (the plan declares the production path; bash reads the same document) |

Test infrastructure in one paragraph: every TypeScript scenario runs in process with `bun:test` through `runEntrypoint` and injected `CliDependencies`; the harness session port is a scripted fake that supplies neutral evidence and the **real** shared classifier is used, so classification is never faked; tracker, CI, and VCS reads are injected read ports with recording fakes and deterministic truth fixtures; state is the real store over the existing test edge with fault injection for torn/failed appends; the clock, run-id sequence, and repository identities are injected; no test touches the live state directory, a live remote, the network, or a model. Bash scenarios run the four scripts against a temporary state root and a sanitized `PATH`, with the typed binary absent or present as the condition requires.

## 2. References

- Change specification: [chg-GH-239-spec.md](./chg-GH-239-spec.md) (Section 17 acceptance criteria, Section 17.1 Definition of Done, Appendix B gate predicate, Appendix C seeded inheritance, Appendix D bash-continuity summary).
- Implementation plan: `./chg-GH-239-plan.yaml` (authored in phase 4; this plan names behavior, commands, and fixture contracts, not final internal code paths).
- PM binding decisions D1-D5: [chg-GH-239-pm-notes.yaml](./chg-GH-239-pm-notes.yaml).
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md).
- TypeScript workspace rules: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md).
- M1 dispatch contract: [contracts.md, section `dispatch`](../../../planning/oss-tooling/milestones/m1/contracts.md).
- M1 dispatch reference page: [commands/dispatch.md](../../../planning/oss-tooling/milestones/m1/commands/dispatch.md).
- Seeded scenarios: [test-scenarios.md, SC-M1-26..SC-M1-30](../../../planning/oss-tooling/milestones/m1/test-scenarios.md).
- M1 architecture fallback table: [architecture.md](../../../planning/oss-tooling/milestones/m1/architecture.md).
- Token taxonomy: [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md); dispatch-session projection: [TDR-0010](../../../decisions/TDR-0010-dispatch-session-classification-token-projection.md).
- Amended handover evidence bar: [chg-GH-266-spec.md](../../2026-11/2026-11-07--GH-266--evidence-based-handover-gate/chg-GH-266-spec.md) and the M1-S9 entry in [backlog.md](../../../planning/oss-tooling/backlog.md).
- Delivered contracts reused: `packages/core/src/contracts/delivery-result.ts`, `harness.ts`, `daemon.ts`, `state.ts`, `error-table.ts`, `economics.ts`, `queue.ts`, and `packages/cli/src/help/prompt-required-commands.ts`.
- Aggregate gate and test conventions: `AGENTS.md` ("Running tests"), `pnpm check`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

All 47 acceptance criteria are covered. There are zero unassigned rows and zero unassigned ACs.

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | Harness from flag then config; unknown harness refuses; repository lease claimed; fresh spawn; conflicting lease refuses without spawning | TC-DISP-001, TC-DISP-002 | Covered |
| AC-F1-2 | Progress signals keep a session live; absent readings stay absent or unknown; stall needs no progress across two sourced evaluations, never elapsed time alone | TC-DISP-003, TC-DISP-004, TC-DISP-005 | Covered |
| AC-F1-3 | One of eleven tokens; `partial` carries `outcome`; envelope data carries the declared fields; text emits exactly four ordered keys | TC-DISP-006, TC-DISP-007, TC-DISP-008, TC-DISP-011 | Covered |
| AC-F1-4 | Full exit projection; failing run still emits a valid envelope with full error fields | TC-DISP-009, TC-DISP-010 | Covered |
| AC-F2-1 | Exit-0 with no branch commit, PR, or ledger progress is `failed` at exit 1; missing artifact named | TC-TRUTH-001 | Covered |
| AC-F2-2 | Open PR, unresolvable URL, already merged, blocking tracker map to the four tokens; tracker-derived tokens corroborated; missing tracker fact never clean | TC-TRUTH-002, TC-TRUTH-003, TC-TRUTH-004, TC-TRUTH-005 | Covered |
| AC-F2-3 | Unreadable ledger, tracker, artifact, or state read is `state-unverified` at exit 2 with a classified identity and remediation hint | TC-TRUTH-006 | Covered |
| AC-F2-4 | No token outside the eleven; `noop-lane-permission` is spawn-refused; `noop-lane-nothing-to-do` only when no work remains | TC-DISP-008, TC-DISP-011, TC-DISP-012 | Covered |
| AC-F3-1 | Resume records the mode, skips completed phases, continues from the ledger; no injection means `resume-prompt-reentry` with prefill cost acknowledged | TC-RESUME-001 | Covered |
| AC-F3-2 | At `lane.restart-budget`, another restart refuses at exit 1 with `dispatch.restart-budget-exceeded`, terminal record, escalation, no spawn, no requeue | TC-RESUME-002 | Covered |
| AC-F3-3 | Uneconomical prefill refuses with `dispatch.resume-uneconomical`; unreadable cost facts refuse; attach-and-continue consumes no ordinal | TC-RESUME-003 | Covered |
| AC-F3-4 | Identical resume replay consumes no duplicate ordinal, re-executes no phase, and does not spawn twice | TC-RESUME-004 | Covered |
| AC-F4-1 | Exactly one complete attempt record per dispatch; no prompt, transcript, credential, or raw payload | TC-EVID-001, TC-EVID-005 | Covered |
| AC-F4-2 | Comparison disagreement opens a divergence; resolution folds to resolved; the original open record remains; the summary reports both totals | TC-EVID-002, TC-GATE-008 | Covered |
| AC-F4-3 | A contradicted success claim is a false-success incident with bounded evidence; never clean; resets the window lower bound | TC-EVID-003, TC-GATE-009 | Covered |
| AC-F4-4 | Unevaluable comparison or corroboration is recorded with a classified identity; the gate does not treat it as clean; truncation is declared | TC-EVID-004, TC-GATE-006 | Covered |
| AC-F5-1 | Summary reports window start and reason, days, counted deliveries, incidents, divergences and identifiers, class coverage, corroboration, verdict | TC-GATE-001, TC-GATE-009 | Covered |
| AC-F5-2 | Eligibility is the four-condition conjunction; every unmet condition is named | TC-GATE-002, TC-GATE-005, TC-GATE-007, TC-GATE-008, TC-GATE-010 | Covered |
| AC-F5-3 | 20 counted dispatches or 7 consecutive UTC dates, whichever comes first; floor-only | TC-GATE-003, TC-GATE-004, TC-GATE-005 | Covered |
| AC-F5-4 | Unreadable, torn, or truncated evidence declares degradation and is unverifiable; an unresolvable repository identity is a clean refusal | TC-GATE-006, TC-NFR-004 | Covered |
| AC-F6-1 | Unmet gate refuses at exit 1, names every unmet condition, appends no authority-changing record, bash stays authoritative | TC-HAND-001 | Covered |
| AC-F6-2 | Met gate appends one handover record, flips only that repository, updates the view atomically, reports reversible; other repositories stay dual-run | TC-HAND-002, TC-HAND-006 | Covered |
| AC-F6-3 | Reversal appends a reversal record, restores dual-run, preserves history; already dual-run is an idempotent noop at exit 0 | TC-HAND-003 | Covered |
| AC-F6-4 | Derived view names repository, authority, handover reference, time, reversal availability; atomic; absent or malformed means dual-run | TC-HAND-004 | Covered |
| AC-F6-5 | Dual-run dispatch reports `handoverState: dual-run`, records evidence, claims no authority, blocks no bash path, fires no merge | TC-HAND-005 | Covered |
| AC-F7-1 | Dual-run bash entry points keep arguments and exit behavior, print no deprecation pointer, need no typed CLI | TC-BASH-001 | Covered |
| AC-F7-2 | Authoritative bash entry points print a deprecation pointer naming `dispatch` and reversal, remain executable | TC-BASH-002 | Covered |
| AC-F7-3 | Typed CLI absent or broken: bash runs normally; pure file read; absent, unreadable, or malformed view means dual-run | TC-BASH-003, TC-BASH-005 | Covered |
| AC-F8-1 | Controlled repository accrues genuine evidence to eligibility, flips, then dispatches end to end; no hand-inserted evidence | TC-E2E-001, TC-E2E-003 | Covered |
| AC-F8-2 | Reversal returns the repository to dual-run, bash runs normally, handover and reversal records remain | TC-E2E-002 | Covered |
| AC-F9-1 | Merge-ready PR emits `pr-open` or `pr-open-unverified` and fires no merge; structural boundary proves no merge path | TC-MERGE-001, TC-MERGE-003 | Covered |
| AC-F9-2 | Already-merged PR may report `merged` as detection with observed evidence; still no merge | TC-TRUTH-004, TC-MERGE-002 | Covered |
| AC-F10-1 | Planner returns the lifecycle prompt and declared environment allowlist; resolves no secret; executor reports available | TC-DAEMON-001 | Covered |
| AC-F10-2 | Daemon starts, records, observes, collects, and resumes a lane; final token and outcome agree with one-shot | TC-DAEMON-002 | Covered |
| AC-F10-3 | With no daemon, dispatch completes from state, appends the record, claims no daemon dependency; unavailable planner means supervise-only | TC-DAEMON-003 | Covered |
| AC-F11-1 | Dispatch present in prompt-required set, root and command help, and reference page with three execution forms plus resolution and reversal; page describes the evidence bar | TC-HELP-001, TC-PLANREC-001 | Covered |
| AC-F11-2 | Help and version perform no state, network, git, configuration, or model read and exit 0 | TC-HELP-002, TC-DET-001 | Covered |
| AC-F11-3 | Three absence assertions retired or inverted; F-9 deferral records the production-consumer outcome | TC-HELP-003 | Covered |
| AC-F12-1 | Spawn failure is `dispatch.session.spawn-failed` at exit 1; unverifiable truth is `dispatch.state-unverified` at exit 2; both tables carry both rows | TC-ERR-001, TC-ERR-002, TC-ERR-005 | Covered |
| AC-F12-2 | Existing dispatch rows unchanged; exact-code resolution; no kind-only single-row assumption | TC-ERR-003, TC-ERR-005, TC-REG-001 | Covered |
| AC-F12-3 | Every dispatch failure envelope carries a stable code, category, retryable flag, consequence, remediation hint, and summary; no prose identity; exit in 0, 1, 2 | TC-DISP-010, TC-ERR-004 | Covered |
| AC-NFR1-1 | Emitted token set is a subset of the eleven; no token literal outside the contracts home; no call-site exit literal outside the projection | TC-TOKEN-001, TC-TOKEN-002, TC-DISP-008, TC-REG-001 | Covered |
| AC-NFR4-1 | Bounded read; truncation declared; machine output at most 65,536 bytes; human output at most 40 lines and 8,192 bytes; p95 summary within 5 s on the reference host | TC-NFR-001, TC-NFR-002, TC-NFR-003, TC-NFR-004 | Covered |
| AC-NFR6-1 | Replaying summary, handover, reversal, or resume appends no duplicate record; authority unchanged; noop reported | TC-NFR-005, TC-RESUME-004, TC-HAND-003 | Covered |
| AC-NFR7-1 | No secret, credential, prompt, transcript, diff, or raw payload in output, records, help, or logs; child environment variables are all declared | TC-NFR-006, TC-NFR-007, TC-EVID-001 | Covered |
| AC-NFR8-1 | Four scripts across dual-run, authoritative, and typed-CLI-absent all complete with declared behavior and no new required argument | TC-BASH-004 | Covered |
| AC-NFR9-1 | No merge executor, port, or invocation reachable from dispatch composition; a source-level merge import fails the boundary check | TC-MERGE-003, TC-MERGE-004 | Covered |

#### 3.1.1 Seeded Scenario Inheritance (SC-M1-26 through SC-M1-30)

| Seeded scenario | Inherited assertion | TC ID(s) | Reconciliation note |
|---|---|---|---|
| SC-M1-26 | Happy path classifies `pr-open`; the four key=value keys match the bash shape; token parity with TDR-0005 | TC-TRUTH-002, TC-DISP-007 | Unchanged in substance. The attempt record and the mandatory `outcome` field are additive. |
| SC-M1-27 | Exit-0-with-no-artifact classifies `failed` at exit 1 and names the missing artifact | TC-TRUTH-001 | Unchanged. The attempt record adds the durable incident and evidence fields. |
| SC-M1-28 | Resume records `resume-prompt-reentry`, acknowledges prefill cost, and does not re-execute completed phases | TC-RESUME-001 | Unchanged. The resume mode also rides the attempt record. |
| SC-M1-29 | Handover flips one repository and leaves the other authoritative state untouched | TC-HAND-001, TC-HAND-002, TC-HAND-006, TC-E2E-001, TC-E2E-002, TC-BASH-001, TC-BASH-002 | **Reconciled.** The seeded parenthetical "two weeks, zero false-success, zero unresolved divergences" is superseded by the four-condition bar (DEC-1). The tests assert the evidence gate and per-repo isolation, never a calendar proxy. Delivery must edit SC-M1-29's wording in `test-scenarios.md` (story-owned) to name the four-condition bar; no other planning doc is edited. |
| SC-M1-30 | Summary counts days, deliveries, incidents, divergences, and states eligibility; an unresolved divergence blocks | TC-GATE-001, TC-GATE-002, TC-GATE-003, TC-GATE-004, TC-GATE-005, TC-GATE-007, TC-GATE-009 | **Reconciled.** The seeded "fourteen days" and "eligibility logic = clean window met" wording is superseded. The summary additionally reports class coverage, corroboration, window start and reason, and named unmet conditions; the floor is the only either/or. Delivery must edit SC-M1-30's wording in `test-scenarios.md` (story-owned); no other planning doc is edited. |

Inheritance rule: this plan inherits all five scenarios and may extend them. It does not weaken any inherited assertion. The two reconciled scenarios are the only planning surfaces this story may edit; `TC-PLANREC-001` asserts the reconciled content, and the "no other planning doc edited" obligation is a review gate recorded in Section 8. This test-plan author does not edit `test-scenarios.md`: the two-scenario reconciliation is a delivery action owned by the story and is a named dependency in the final report.

### 3.2 Interface Coverage (EVT-#, DM-#)

| Interface | Element | TC ID(s) | Evidence |
|---|---|---|---|
| EVT-1 | `dispatch.attempt` record, schema `delivery.dispatch.attempt.v1`, appended once per classified dispatch under the fence | TC-EVID-001, TC-EVID-005, TC-DISP-006 | Record count, field completeness, canary absence, fenced append and torn-read behavior |
| EVT-2 | `dispatch.divergence` record, schema `delivery.dispatch.divergence.v1`, open then resolved, never rewritten or deleted | TC-EVID-002 | Open record retained after resolution; latest-per-divergence fold; summary totals |
| EVT-3 | `dispatch.handover` record, schema `delivery.dispatch.handover.v1`, flip and reversal, conditions snapshot and evidence references | TC-HAND-002, TC-HAND-003, TC-HAND-004 | Record count, snapshot fields, history retention, folded latest per repository |
| DM-1 | Dispatch attempt record fields, including comparison token or not-applicable and tri-state corroboration | TC-EVID-001, TC-TRUTH-001, TC-GATE-008 | Field-level assertions and schema validation |
| DM-2 | Divergence record state vocabulary and bounded resolution note | TC-EVID-002 | `open` then `resolved`; principal and timestamp; bounded note |
| DM-3 | Handover record operations and conditions snapshot | TC-HAND-002, TC-HAND-003 | `authoritative` then `dual-run`; snapshot present |
| DM-4 | Derived repository authority view; absent or unreadable means dual-run | TC-HAND-004, TC-HAND-005, TC-BASH-003 | Field assertions, atomic replacement, fail-safe default |
| DM-5 | Dispatch envelope data, including mandatory `outcome` | TC-DISP-006, TC-DISP-009, TC-DISP-010 | Key set, token/exit matrix, failure envelope |
| DM-6 | Dual-run summary data: window, counts, class coverage, corroboration, verdict, unmet conditions | TC-GATE-001, TC-GATE-006 | Text and envelope assertions against the summary fixture set |
| DM-7 | Handover gate predicate, one declared home shared by summary and handover | TC-GATE-002, TC-GATE-005, TC-GATE-007, TC-HAND-001 | Same fixture yields the same verdict from both surfaces |
| DM-8 | Corroboration evidence set: completed phases, tracker state, CI on pushed head; family-wise sufficiency | TC-GATE-008, TC-GATE-010, TC-EVID-003 | Per-family sufficiency matrix and contradiction detection |
| Section 8.5 | Backward compatibility: four bash keys, retained error rows, bash arguments and exits | TC-DISP-007, TC-ERR-003, TC-BASH-001 | Golden keys, unchanged rows, unchanged script behavior |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Token and exit closure; no call-site exit literal | TC-DISP-008, TC-DISP-009, TC-TOKEN-001, TC-TOKEN-002, TC-ERR-004 | Covered |
| NFR-2 | Progress-based liveness truth; absent readings never zero; cadence from policy | TC-DISP-003, TC-DISP-004, TC-DISP-005 | Covered |
| NFR-3 | Determinism and zero model calls in help, summary, gate, classification, and render | TC-HELP-002, TC-DET-001 | Covered |
| NFR-4 | Bounded reads and output | TC-NFR-001, TC-NFR-002, TC-NFR-003, TC-NFR-004 | Covered |
| NFR-5 | Durable fenced appends; no clean verdict from a torn or unreadable read; atomic derived view | TC-EVID-005, TC-EVID-004, TC-HAND-004 | Covered |
| NFR-6 | Idempotent convergence | TC-NFR-005, TC-RESUME-004, TC-HAND-003 | Covered |
| NFR-7 | Secret containment and deny-by-default spawn environment | TC-NFR-006, TC-NFR-007, TC-EVID-001 | Covered |
| NFR-8 | Bash fallback compatibility in all four entry points | TC-BASH-001, TC-BASH-002, TC-BASH-003, TC-BASH-004, TC-BASH-005 | Covered |
| NFR-9 | Merge absence: no port, no code path, boundary check | TC-MERGE-001, TC-MERGE-002, TC-MERGE-003, TC-MERGE-004 | Covered |
| NFR-10 | Evidence completeness: comparison field and tri-state corroboration on every counted dispatch; no omitted unresolved divergence | TC-EVID-001, TC-EVID-002, TC-EVID-004, TC-GATE-007, TC-GATE-010 | Covered |

## 4. Test Types and Layers

| Layer | Framework / location | Purpose in this change |
|---|---|---|
| Unit / pure domain | `bun:test`, `tests/behaviour/dispatch-*.test.ts` importing `packages/core/src/domain` | Token derivation, liveness assembly, gate predicate, window fold, family comparison, classification dispatch. No I/O. |
| Behaviour | `bun:test`, `tests/behaviour/dispatch-*.test.ts`, in-process `runEntrypoint` with injected dependencies | Command-level dispatch, summary, resolve, handover, reversal, help, error envelopes, idempotency, privacy, bounds. |
| Structure | `bun:test`, `tests/structure/dispatch-*.test.ts` | Contracts (record kinds, payload schemas, gate predicate home), composition membership, import boundaries, merge absence, token and exit literal homes. |
| Types | `bun:test` type tests, `tests/types/dispatch-contract.type-test.ts` | Compile-time shape of attempt, divergence, handover, authority view, summary, and envelope data. |
| Repository invariants | `bun run scripts/checks/*.ts`, mutation-tested by `tests/checks/*.test.ts` | Error-table sync, exit-code literals, help/guide coverage, reference-page parity, doc conformance for the story-owned planning surfaces, privacy scans, boundary checks. |
| Golden | `bun:test`, `tests/golden/dispatch-*.test.ts` over committed fixtures | Byte-pinned four-key text, summary text, handover text, error envelopes. |
| Conformance / integration | `bun:test`, `tests/conformance/dispatch/*.test.ts` | Controlled-repository end-to-end proof, daemon lane cycle, bash matrix over temporary state roots. |
| Shell | `bash scripts/.tests/test-dispatch-bash-fallback.sh` plus the four retained script suites | Four scripts x three authority conditions, typed CLI absence, no new arguments. |
| Performance | `bun:test` tagged `@perf` in `tests/behaviour/dispatch-bounds.test.ts` | 5,000-record summary read and p95 latency on the reference host; deterministic bounded-read assertion stays in the default suite. |
| Manual | Review checklist in the PR | Reference-page readability, F-9 deferral wording, planning-scope diff, no real repository flip. |

Test IDs follow `TC-FEATURE-NNN`. Each test file carries its TC IDs in a header comment so traceability survives file moves. Fixtures are never named `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Test Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-DISP-001 | Harness resolution, lease claim, fresh spawn | Happy Path | Behaviour | High | AC-F1-1 |
| TC-DISP-002 | Conflicting lease refusal without spawn | Negative | Behaviour | High | AC-F1-1 |
| TC-DISP-003 | Progress signals keep a session live | Happy Path | Unit | High | AC-F1-2, NFR-2 |
| TC-DISP-004 | Absent liveness readings stay unknown | Corner Case | Unit | High | AC-F1-2, NFR-2 |
| TC-DISP-005 | Stall requires two sourced evaluations | Edge Case | Unit | Medium | AC-F1-2, NFR-2 |
| TC-DISP-006 | Machine envelope shape and mandatory outcome | Happy Path | Behaviour | High | AC-F1-3, DM-5 |
| TC-DISP-007 | Text mode emits exactly four ordered keys | Happy Path | Golden | High | AC-F1-3, AC-F2-4, NFR-1 |
| TC-DISP-008 | Emitted token set stays inside the eleven | Negative | Structure | High | AC-F1-3, AC-F2-4, AC-NFR1-1 |
| TC-DISP-009 | Exit projection matrix by token | Happy Path | Behaviour | High | AC-F1-4, NFR-1 |
| TC-DISP-010 | Failing run still emits a complete error envelope | Negative | Behaviour | High | AC-F1-4, AC-F12-3 |
| TC-DISP-011 | `partial` carries outcome; `noop-lane-permission` is spawn-refused | Corner Case | Unit | High | AC-F1-3, AC-F2-4 |
| TC-DISP-012 | `noop-lane-nothing-to-do` only with no remaining work | Negative | Unit | Medium | AC-F2-4 |
| TC-TRUTH-001 | Exit-0 with no artifact is `failed` | Negative | Behaviour | High | AC-F2-1 |
| TC-TRUTH-002 | Open PR is `pr-open` | Happy Path | Behaviour | High | AC-F2-2 |
| TC-TRUTH-003 | Unresolvable PR URL is `pr-open-unverified` | Edge Case | Behaviour | High | AC-F2-2 |
| TC-TRUTH-004 | Already-merged PR is detection-only `merged` | Edge Case | Behaviour | High | AC-F2-2, AC-F9-2 |
| TC-TRUTH-005 | Blocking tracker state is `blocked`; missing fact is not success | Negative | Behaviour | Medium | AC-F2-2 |
| TC-TRUTH-006 | Unreadable truth is `state-unverified` at exit 2 | Negative | Behaviour | High | AC-F2-3 |
| TC-RESUME-001 | Resume prompt records re-entry mode and skips completed phases | Happy Path | Behaviour | High | AC-F3-1 |
| TC-RESUME-002 | Restart budget exhaustion refuses loudly and never requeues | Negative | Behaviour | High | AC-F3-2 |
| TC-RESUME-003 | Resume economics refuses uneconomical re-pay | Negative | Behaviour | High | AC-F3-3 |
| TC-RESUME-004 | Identical resume replay converges without a second effect | Regression | Behaviour | High | AC-F3-4, AC-NFR6-1 |
| TC-EVID-001 | Exactly one complete attempt record per dispatch | Happy Path | Behaviour | High | AC-F4-1, AC-NFR7-1, NFR-10 |
| TC-EVID-002 | Divergence opens on disagreement and resolves append-only | Happy Path | Behaviour | High | AC-F4-2 |
| TC-EVID-003 | False success is recorded and resets the window | Negative | Behaviour | High | AC-F4-3 |
| TC-EVID-004 | Unevaluable evidence is recorded and blocks the gate | Negative | Behaviour | High | AC-F4-4 |
| TC-EVID-005 | Fenced append and torn reads never become clean | Negative | Behaviour | High | AC-F4-1, NFR-5 |
| TC-GATE-001 | Summary reports the full evidence window | Happy Path | Behaviour | High | AC-F5-1 |
| TC-GATE-002 | Eligibility is the four-condition conjunction | Happy Path | Unit | High | AC-F5-2 |
| TC-GATE-003 | Floor variant: 20 counted dispatches | Edge Case | Unit | High | AC-F5-3 |
| TC-GATE-004 | Floor variant: 7 consecutive UTC dates | Edge Case | Unit | High | AC-F5-3 |
| TC-GATE-005 | Floor never substitutes for the other conditions | Negative | Unit | High | AC-F5-2, AC-F5-3 |
| TC-GATE-006 | Unreadable or truncated evidence is unverifiable | Negative | Behaviour | High | AC-F5-4, AC-F4-4 |
| TC-GATE-007 | All eleven classes must be covered | Negative | Unit | High | AC-F5-2 |
| TC-GATE-008 | Family-wise comparison baseline | Corner Case | Unit | High | AC-F4-2, AC-F5-2 |
| TC-GATE-009 | Incident resets the window; resolved divergence does not | Corner Case | Unit | High | AC-F4-3, AC-F5-1 |
| TC-GATE-010 | Corroboration sufficiency per outcome family | Negative | Unit | High | AC-F5-2 |
| TC-HAND-001 | Unmet gate is a clean refusal | Negative | Behaviour | High | AC-F6-1 |
| TC-HAND-002 | Met gate flips one repository and records it | Happy Path | Behaviour | High | AC-F6-2 |
| TC-HAND-003 | Reversal restores dual-run; second reversal is a noop | Happy Path | Behaviour | High | AC-F6-3, AC-NFR6-1 |
| TC-HAND-004 | Derived authority view is complete, atomic, and fail-safe | Corner Case | Structure | High | AC-F6-4 |
| TC-HAND-005 | Dual-run dispatch claims no authority | Regression | Behaviour | High | AC-F6-5 |
| TC-HAND-006 | Handover is isolated per repository | Negative | Behaviour | High | AC-F6-2 |
| TC-BASH-001 | Dual-run bash entry points are unchanged | Regression | Shell | High | AC-F7-1, NFR-8 |
| TC-BASH-002 | Authoritative bash entry points print the deprecation pointer | Happy Path | Shell | High | AC-F7-2, NFR-8 |
| TC-BASH-003 | Bash fallback works with the typed CLI absent or broken | Corner Case | Shell | High | AC-F7-3, NFR-8 |
| TC-BASH-004 | Four scripts across three conditions all complete | Regression | Shell | High | AC-NFR8-1 |
| TC-BASH-005 | Bash never invokes the typed CLI to decide authority | Negative | Structure | High | AC-F7-3, NFR-8 |
| TC-E2E-001 | Controlled repository accrues evidence, flips, and dispatches | Happy Path | Conformance | High | AC-F8-1 |
| TC-E2E-002 | Reversal returns the repository to bash-authoritative | Happy Path | Conformance | High | AC-F8-2 |
| TC-E2E-003 | Fixture evidence is command-produced, never hand-inserted | Negative | Conformance | Medium | AC-F8-1 |
| TC-MERGE-001 | Merge-ready PR stays `pr-open`; no merge fires | Negative | Behaviour | High | AC-F9-1 |
| TC-MERGE-002 | Already-merged detection records observed evidence only | Edge Case | Behaviour | High | AC-F9-2 |
| TC-MERGE-003 | Structural boundary proves no merge path | Negative | Structure | High | AC-F9-1, AC-NFR9-1 |
| TC-MERGE-004 | Production composition has no reachable merge port | Negative | Structure | High | AC-NFR9-1 |
| TC-DAEMON-001 | Planner produces prompt and declared environment; executor available | Happy Path | Behaviour | High | AC-F10-1 |
| TC-DAEMON-002 | Daemon spawns, observes, collects, resumes a dispatch lane | Happy Path | Conformance | High | AC-F10-2 |
| TC-DAEMON-003 | One-shot dispatch works with no daemon | Corner Case | Behaviour | High | AC-F10-3 |
| TC-HELP-001 | Dispatch is registered and documented with the evidence bar | Happy Path | Structure | High | AC-F11-1 |
| TC-HELP-002 | Help and version remain pure and side-effect free | Negative | Behaviour | High | AC-F11-2, NFR-3 |
| TC-HELP-003 | Absence assertions are retired; F-9 is revisited | Regression | Structure | High | AC-F11-3 |
| TC-PLANREC-001 | Story-owned planning surfaces carry the evidence bar | Regression | Structure | High | AC-F11-1 |
| TC-ERR-001 | Spawn failure classifies as `dispatch.session.spawn-failed` | Negative | Behaviour | High | AC-F12-1 |
| TC-ERR-002 | Dispatch state failure classifies as `dispatch.state-unverified` | Negative | Behaviour | High | AC-F12-1 |
| TC-ERR-003 | Existing dispatch rows are unchanged and resolve by exact code | Regression | Structure | High | AC-F12-2 |
| TC-ERR-004 | Error envelopes carry stable identity and bounded exit | Negative | Golden | High | AC-F12-3 |
| TC-ERR-005 | Machine and documented error tables stay in sync | Regression | Checks | High | AC-F12-1, AC-F12-2 |
| TC-TOKEN-001 | Token literals have one home and the set is total | Negative | Structure | High | AC-NFR1-1 |
| TC-TOKEN-002 | No call-site exit literal outside the projection module | Negative | Checks | High | AC-NFR1-1 |
| TC-NFR-001 | Machine payload stays within 65,536 bytes | Corner Case | Behaviour | High | AC-NFR4-1 |
| TC-NFR-002 | Human output stays within 40 lines and 8,192 bytes | Corner Case | Behaviour | High | AC-NFR4-1 |
| TC-NFR-003 | Summary read is bounded and p95 stays within 5 s | Performance | Performance | High | AC-NFR4-1 |
| TC-NFR-004 | Truncation is declared, never fabricated as zero | Corner Case | Behaviour | High | AC-F5-4, AC-NFR4-1 |
| TC-NFR-005 | Replays append no duplicate records | Regression | Behaviour | High | AC-NFR6-1 |
| TC-NFR-006 | No secret, prompt, transcript, or payload leaks | Negative | Behaviour | High | AC-NFR7-1 |
| TC-NFR-007 | Spawn environment is deny-by-default | Negative | Behaviour | High | AC-NFR7-1 |
| TC-DET-001 | Deterministic render with zero model calls | Regression | Behaviour | Medium | AC-F11-2, NFR-3 |
| TC-REG-001 | Existing suites and rows stay green | Regression | Checks | High | AC-F12-2, AC-NFR1-1, NFR-8 |

**Scenario counts:** 78 total, 72 must-pass and 6 nice-to-have. Families: DISP 12, TRUTH 6, RESUME 4, EVID 5, GATE 10, HAND 6, BASH 5, E2E 3, MERGE 4, DAEMON 3, HELP 3, PLANREC 1, ERR 5, TOKEN 2, NFR 7, DET 1, REG 1.

### 5.2 Scenario Details

Each scenario uses the template's Preconditions / Steps / Expected Outcome form, which encodes Given / When / Then: the preconditions are the Given, the steps are the When, and the expected outcome is the Then. Every scenario names the exact CLI command or test-facing function, the expected output or exit code, the expected record effects, and its test file placement.

#### TC-DISP-001 - Harness resolution, lease claim, fresh spawn

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-12, AC-F1-1, DM-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-lease.test.ts`
**Tags**: @backend, @dispatch, @harness

**Preconditions**:
- A temporary state root with an empty queue ledger and a configured default harness of `opencode`.
- A scripted `HarnessSessionPort` whose `spawn` records its input and returns a session handle.
- Tracker, CI, and VCS read ports return a consistent open-PR truth fixture.

**Steps**:
1. Invoke `dispatch GH-301` through `runEntrypoint` with configuration selecting `opencode`.
2. Invoke `dispatch GH-302 --harness claude-code` and assert the flag wins over configuration.
3. Invoke `dispatch GH-303 --harness unknown-harness` and assert refusal.
4. Read the queue lease ledger and the harness spawn recorder after each invocation.

**Expected Outcome**:
- Runs 1 and 2 each claim the repository lease through `claimQueueLease`, spawn exactly once through the port, and record the harness name in the envelope.
- Run 2's spawn input names `claude-code`; the configured default is not used.
- Run 3 exits `1` with a declared user-validation code (an identity, not prose), does not claim a lease, and does not spawn.
- No invocation touches the network or a live remote.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-harness-lease.test.ts` exits 0; any missing lease claim, wrong harness, or spawn on the unknown-harness case fails.

#### TC-DISP-002 - Conflicting lease refusal without spawn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-12, AC-F1-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-lease.test.ts`
**Tags**: @backend, @dispatch, @queue

**Preconditions**:
- The state root holds an active repository lease for `GH-301` held by another runner.
- A scripted harness port counts every spawn.
- A pre-session input refusal is envelope-only by interpretation OQ-T2.

**Steps**:
1. Invoke `dispatch GH-301`.
2. Assert the exit code, the error envelope, the spawn count, and the lease ledger.
3. Assert the attempt-record count and that the authority view did not change.

**Expected Outcome**:
- Exit `1`; the envelope carries the delivered queue lease-conflict identity (or the declared input/refusal identity), category `user-validation`, and a remediation hint.
- Spawn count is `0`; the existing lease is unchanged; no second lease is created.
- No handover record and no authority change; if the record policy appends an attempt per OQ-T2, the record is a refusal, never a success.
- The bash stack remains authoritative and unblocked.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-harness-lease.test.ts` exits 0; a spawn, a stolen lease, or an authority change fails.

#### TC-DISP-003 - Progress signals keep a session live

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-liveness.test.ts`
**Tags**: @backend, @dispatch, @liveness

**Preconditions**:
- Four liveness reports, each with exactly one advancing sourced signal: token delta, session traffic, worktree activity, and prefill advancement.
- A fixed evaluation cadence from `lane.liveness-interval`.

**Steps**:
1. Call the delivered liveness assembly for each report twice, with the signal advancing between evaluations.
2. Assert the verdict and the reported signal names.
3. Repeat with two signals advancing and one absent.

**Expected Outcome**:
- Every case reports `progressing`; no stalled verdict is produced.
- The advancing signal is named in the report; an absent third signal is reported absent or unknown, never zero.
- The evaluation cadence is read from policy, not hardcoded.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-liveness.test.ts` exits 0; any stalled verdict while a sourced signal advances fails.

#### TC-DISP-004 - Absent liveness readings stay unknown

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-liveness.test.ts`
**Tags**: @backend, @dispatch, @liveness

**Preconditions**:
- All sourced readings are absent, with declared absence reasons.
- A timer has elapsed well beyond the cadence.

**Steps**:
1. Assemble the liveness report with every reading absent.
2. Assert the progress verdict and the absence representation.
3. Advance the clock only and reassemble.

**Expected Outcome**:
- The report says `unknown` (or absent) and names the absence reasons.
- No zero is fabricated for an absent reading.
- Advancing only the clock never produces a stalled verdict.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-liveness.test.ts` exits 0; a zero substitution or an elapsed-time stall fails.

#### TC-DISP-005 - Stall requires two sourced evaluations

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-2, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-liveness.test.ts`
**Tags**: @backend, @dispatch, @liveness

**Preconditions**:
- Sourced readings are present but do not advance.

**Steps**:
1. Evaluate once with sourced readings present and no progress.
2. Evaluate a second consecutive time with the same readings.
3. Compare with a run where the second evaluation has absent readings.

**Expected Outcome**:
- The first evaluation does not classify stalled.
- Two consecutive sourced evaluations with no progress may classify stalled.
- If the second evaluation's readings are absent, the verdict is unknown, not stalled.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-liveness.test.ts` exits 0; a single evaluation or an absent reading producing stalled fails.

#### TC-DISP-006 - Machine envelope shape and mandatory outcome

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, DM-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-envelope.test.ts`
**Tags**: @backend, @dispatch, @envelope

**Preconditions**:
- A successful dispatch fixture that ends `pr-open`.
- A `partial` fixture whose harness outcome is `completed-with-tool-failure`.

**Steps**:
1. Invoke `dispatch GH-301 --json` and parse the envelope.
2. Assert the `data` key set: `result`, `prUrl`, `phaseLedger` with `completed`, `total`, `variant`, `restarts`, `resumeAmplification`, `harness`, `handoverState`, `outcome`.
3. Invoke the `partial` fixture and assert `outcome` is present beside `result=partial`.

**Expected Outcome**:
- Exactly the declared keys are present; `outcome` is never omitted.
- `phaseLedger` carries all three fields; `handoverState` is `dual-run` when no handover exists.
- `result` is one of the eleven tokens and `outcome` is a value of the shared harness outcome vocabulary.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-envelope.test.ts` exits 0; a missing `outcome` or an undeclared key fails.

#### TC-DISP-007 - Text mode emits exactly four ordered keys

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, AC-F2-4, NFR-1
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/dispatch-text.test.ts`
**Tags**: @backend, @dispatch, @golden

**Preconditions**:
- Committed golden fixtures for a `pr-open` run, a `failed` run, and a `pr-open-unverified` run.
- The bash reference order: `result=`, `pr_url=`, `exit_code=`, `last_message=`.

**Steps**:
1. Run each fixture in text mode (no `--json`).
2. Split stdout into lines and assert the keys and their order.
3. Scan for `closeout_unverified=` and for any other `key=` at line start.

**Expected Outcome**:
- Exactly four lines in the declared order; no fifth key.
- `closeout_unverified=` is absent.
- `pr_url=` may be empty for unverified results; `exit_code=` matches the token projection.
- Byte equality with the committed goldens.

**Pass/Fail Evidence**:
- `bun test tests/golden/dispatch-text.test.ts` exits 0; an extra key, reordering, or an emitted `closeout_unverified=` fails.

#### TC-DISP-008 - Emitted token set stays inside the eleven

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-3, AC-F2-4, AC-NFR1-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-token-home.test.ts` and `tests/behaviour/dispatch-token-closure.test.ts`
**Tags**: @backend, @dispatch, @taxonomy

**Preconditions**:
- `DELIVERY_RESULT_TOKENS` and `DELIVERY_RESULT_TAXONOMY` are the delivered closed declarations.

**Steps**:
1. Drive every derivation branch (artifact, tracker-pr, dispatch-session, truth failure) through the dispatch derivation seam.
2. Collect every emitted token.
3. Assert the emitted set is a subset of the eleven and the taxonomy has exactly one row per token.
4. Scan dispatch production modules for a token literal outside the contracts home.

**Expected Outcome**:
- Zero tokens outside the eleven; zero duplicate or extra taxonomy rows.
- Every emitted token resolves to one projection class and one derivation class.
- No production dispatch module declares a second token list.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-token-home.test.ts tests/behaviour/dispatch-token-closure.test.ts` exits 0; an unknown token or a second token list fails.

#### TC-DISP-009 - Exit projection matrix by token

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-12, AC-F1-4, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-exit-projection.test.ts`
**Tags**: @backend, @dispatch, @exit

**Preconditions**:
- Fixtures for each of the eleven tokens and for restart-budget and resume-economics refusals.

**Steps**:
1. Project each token through the delivered result projection.
2. Assert the process exit and the precedence rule.
3. Assert `state-unverified` is `2`, not bash's `1`.

**Expected Outcome**:
- `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `finished`, `noop-lane-nothing-to-do` exit `0`.
- `failed`, `max-restarts`, `partial`, `noop-lane-permission`, restart-budget refusal, and resume-economics refusal exit `1`.
- `state-unverified` exits `2`; no exit outside `0`, `1`, `2`.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-exit-projection.test.ts` exits 0; any mismatch or an out-of-range exit fails.

#### TC-DISP-010 - Failing run still emits a complete error envelope

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-12, AC-F1-4, AC-F12-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-envelope.test.ts`
**Tags**: @backend, @dispatch, @envelope, @errors

**Preconditions**:
- A fixture where spawn fails before a session exists.
- An unreadable tracker fixture that prevents a verdict.

**Steps**:
1. Invoke each failing fixture with `--json`.
2. Validate the envelope against the delivered envelope schema.
3. Assert the error fields on each run.

**Expected Outcome**:
- Both runs emit a schema-valid envelope with `code`, `category`, `retryable`, `consequence`, `remediationHint`, and `summary`.
- Spawn failure exits `1`; the state failure exits `2`.
- No run emits prose instead of an identity or an exit outside `0`, `1`, `2`.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-envelope.test.ts` exits 0; an invalid or field-poor failure envelope fails.

#### TC-DISP-011 - `partial` carries outcome; `noop-lane-permission` is spawn-refused

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-3, AC-F2-4, DEC-14
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-token-closure.test.ts`
**Tags**: @backend, @dispatch, @taxonomy

**Preconditions**:
- The shared classifier's six-row projection is bound (`HARNESS_CLASSIFICATION_TOKENS`).
- A `refused` harness evidence set with `spawnRefused: true`.

**Steps**:
1. Classify `completed-with-tool-failure` and `premature-end`; assert the token is `partial` and the outcome is present in the classification.
2. Classify `refused` with `spawnRefused: true`; assert the token is `noop-lane-permission`.
3. Assert the record and output describe spawn-refused, never a lane-permission policy verdict.

**Expected Outcome**:
- Every `partial` carries its `outcome`; the envelope includes it.
- Harness-path `noop-lane-permission` is reported as spawn-refused in the record and in `last_message`.
- No lane-permission policy wording appears.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-token-closure.test.ts` exits 0; a `partial` without outcome or a permission-verdict wording fails.

#### TC-DISP-012 - `noop-lane-nothing-to-do` only with no remaining work

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-4, DEC-14
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-token-closure.test.ts`
**Tags**: @backend, @dispatch, @taxonomy

**Preconditions**:
- A lane whose queue entry and phase ledger show no remaining work.
- A second lane with an open phase but no harness progress.

**Steps**:
1. Derive the result for the exhausted lane.
2. Derive the result for the open-phase lane.
3. Assert the token and the reason recorded for each.

**Expected Outcome**:
- The exhausted lane yields `noop-lane-nothing-to-do`.
- The open-phase lane never yields that token; it is `partial`, `failed`, or `state-unverified` according to truth.
- The record names the ledger or queue fact that supports the no-work claim.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-token-closure.test.ts` exits 0; a no-work token on an open phase fails.

#### TC-TRUTH-001 - Exit-0 with no artifact is `failed`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, EVT-1, SC-M1-27
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts`
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- A scripted session exits `0` with a completion marker.
- Git shows no branch commit, the tracker shows no PR, and the phase ledger shows no progress.

**Steps**:
1. Invoke `dispatch GH-301`.
2. Assert the token, exit, and `last_message`.
3. Read the attempt record.

**Expected Outcome**:
- Result `failed`, exit `1`; never a success token.
- The missing artifact is named (no branch commit, no PR, no ledger progress).
- The attempt record carries the missing-artifact evidence and is never success-classified.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; an exit-0 success classification fails.

#### TC-TRUTH-002 - Open PR is `pr-open`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-1, DM-8, SC-M1-26
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts`
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- The tracker read reports one open PR with a resolvable URL.
- The branch has commits and the phase ledger shows a terminal phase.

**Steps**:
1. Invoke `dispatch GH-301`.
2. Assert the token and the URL.
3. Read the attempt record and the corroboration tri-state.

**Expected Outcome**:
- Result `pr-open`, exit `0`, `prUrl` set, `handoverState` `dual-run`.
- The attempt record's comparison field and corroboration tri-state are complete.
- The tracker-pr comparison baseline is the independent tracker fact, not the engine token.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a missing URL or an incomplete corroboration record fails.

#### TC-TRUTH-003 - Unresolvable PR URL is `pr-open-unverified`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts`
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- The tracker reports an open PR but the URL read fails or returns empty.
- The branch and phase ledger are otherwise consistent.

**Steps**:
1. Invoke `dispatch GH-301`.
2. Assert the token, exit, `pr_url=` value, and `last_message`.
3. Assert no `closeout_unverified=` key appears.

**Expected Outcome**:
- Result `pr-open-unverified`, exit `0`, `pr_url=` empty.
- The unverified reason rides the token, the `last_message`, and the attempt record; no extra bash key is emitted.
- The record is counted as exposure but its corroboration is explicitly unsatisfied.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a fabricated URL or an extra key fails.

#### TC-TRUTH-004 - Already-merged PR is detection-only `merged`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, AC-F2-2, AC-F9-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts`
**Tags**: @backend, @dispatch, @truth, @merge

**Preconditions**:
- Independent VCS and tracker reads report the PR already merged.
- A recording merge port is injected to prove zero calls.

**Steps**:
1. Invoke `dispatch GH-301`.
2. Assert the token, exit, and observed merged evidence.
3. Assert the merge recorder count is zero.

**Expected Outcome**:
- Result `merged`, exit `0`, only after the merged state is independently observed.
- The attempt record carries the observed merged evidence and corroboration references.
- No merge is fired; the merge recorder remains at zero.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a merge call or an unobserved `merged` fails.

#### TC-TRUTH-005 - Blocking tracker state is `blocked`; missing fact is not success

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-2, DM-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-truth-derivation.test.ts`
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- Tracker state reports a delivery-blocking status.
- A second fixture omits the tracker fact entirely.

**Steps**:
1. Invoke the blocking fixture and assert `blocked`.
2. Invoke the missing-fact fixture and assert the unverified behavior.
3. Assert both attempt records' corroboration.

**Expected Outcome**:
- The blocking fixture yields `blocked`, exit `0`, corroborated by the tracker fact.
- The missing-fact fixture never becomes a clean success; it is `state-unverified` (or an explicitly unevaluable record).
- The record names which tracker fact was missing.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a missing tracker fact producing a success token fails.

#### TC-TRUTH-006 - Unreadable truth is `state-unverified` at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-12, AC-F2-3, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-state-unverified.test.ts`
**Tags**: @backend, @dispatch, @truth, @errors

**Preconditions**:
- Four fixtures: unreadable ledger, unreadable tracker, unreadable artifact read, and torn state read.

**Steps**:
1. Invoke each fixture with `--json`.
2. Assert the token, exit, identity, and remediation hint.
3. Assert the bash fallback still runs for the same repository.

**Expected Outcome**:
- Result `state-unverified`, exit `2`; never exit `0`, never silently `failed`.
- The envelope carries `dispatch.state-unverified` (or a delivered `state.*` identity) and a remediation hint.
- The attempt record is unevaluable and blocks eligibility; the bash stack is not suppressed.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-state-unverified.test.ts` exits 0; exit `0` or `failed` on an unreadable truth read fails.

#### TC-RESUME-001 - Resume prompt records re-entry mode and skips completed phases

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-1, EVT-1, NFR-6, SC-M1-28
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resume.test.ts`
**Tags**: @backend, @dispatch, @resume

**Preconditions**:
- A lane parked on a typed question with completed phases 1 through 7 and an open phase 8.
- A harness adapter without resume injection; the session port records `resume`.

**Steps**:
1. Invoke `dispatch GH-301 --resume-prompt "plan tier: full"`.
2. Assert the resume call, the recorded mode, and the phase ledger.
3. Assert the prefill cost acknowledgement in the output and the attempt record.

**Expected Outcome**:
- The existing lane is resumed through the harness session port; no fresh spawn.
- Mode is `resume-prompt-reentry`; the prefill cost is acknowledged in output and record.
- Completed phases are not re-executed; the lane continues from the ledger position.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-resume.test.ts` exits 0; a re-executed completed phase or a missing prefill acknowledgement fails.

#### TC-RESUME-002 - Restart budget exhaustion refuses loudly and never requeues

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-12, AC-F3-2, EVT-1, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-restart-budget.test.ts`
**Tags**: @backend, @dispatch, @restart

**Preconditions**:
- The lane's restart count equals the policy `lane.restart-budget` (default 3).
- A recording harness port counts spawns and resumes.

**Steps**:
1. Attempt another restart through `dispatch GH-301 --resume-prompt "retry"`.
2. Assert the exit, identity, terminal record, and escalation.
3. Read the queue ledger to prove the delivery is not silently requeued.

**Expected Outcome**:
- Exit `1` with `dispatch.restart-budget-exceeded`; category `user-validation`.
- The delivered terminal exhaustion record is present; a typed escalation is surfaced.
- No spawn, no resume, no requeue; the delivery is not silently returned to the queue as fresh work.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-restart-budget.test.ts` exits 0; a spawn past the budget or a silent requeue fails.

#### TC-RESUME-003 - Resume economics refuses uneconomical re-pay

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-12, AC-F3-3, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resume-economics.test.ts`
**Tags**: @backend, @dispatch, @economics

**Preconditions**:
- A resume whose prefill re-pay exceeds the delivered economics admission for the unique progress available.
- A second fixture with unreadable token or cost facts.
- A third fixture declaring attach-and-continue.

**Steps**:
1. Invoke the uneconomical resume and assert the refusal identity and exit.
2. Invoke the unreadable-facts resume and assert refusal or unevaluable classification.
3. Invoke attach-and-continue and assert no restart ordinal is consumed.

**Expected Outcome**:
- Uneconomical: exit `1`, `dispatch.resume-uneconomical`, no spawn.
- Unreadable facts: refused or classified unevaluable, never admitted.
- Attach-and-continue: valid admission with zero ordinal consumption, recorded as such.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-resume-economics.test.ts` exits 0; admitting an uneconomical or unreadable resume fails.

#### TC-RESUME-004 - Identical resume replay converges without a second effect

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, AC-NFR6-1, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resume-economics.test.ts`
**Tags**: @backend, @dispatch, @idempotency

**Preconditions**:
- A completed resume with a recorded mode and a known lane position.
- A deterministic clock and id sequence.

**Steps**:
1. Replay the identical resume.
2. Compare restart ordinals, spawn/resume counts, completed-phase records, and lane position.
3. Assert the reported noop.

**Expected Outcome**:
- Zero duplicate restart ordinals; zero completed phases re-executed; no second spawn.
- The lane position is identical; the second run reports a noop rather than a second effect.
- No duplicate attempt record beyond the single record for the replay's own dispatch.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-resume-economics.test.ts` exits 0; a duplicate ordinal or a second spawn fails.

#### TC-EVID-001 - Exactly one complete attempt record per dispatch

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-1, DM-8, EVT-1, NFR-7, NFR-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-evidence-record.test.ts` and `tests/types/dispatch-contract.type-test.ts`
**Tags**: @backend, @dispatch, @evidence

**Preconditions**:
- Success, failure, and refusal fixtures.
- Canary prompt, transcript, credential, and raw payload strings are placed in harness evidence and parent environment.
- The type test imports the declared record types.

**Steps**:
1. Run each fixture once and read the attempt ledger.
2. Assert exactly one record per classified dispatch and validate every required field.
3. Serialize each record and scan for the canaries.
4. Compile the type test against the declared record and summary shapes.

**Expected Outcome**:
- Exactly one record per dispatch with repository, reference, start/finish, harness, handover state, outcome and token, comparison token or not-applicable, divergence reference, false-success classification, corroboration tri-state, and resume mode when applicable.
- No canary appears in any record.
- The type test fails if a required field is removed or widened.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-evidence-record.test.ts` and `bun test tests/types` exit 0; a missing field, a duplicate record, or a canary fails.

#### TC-EVID-002 - Divergence opens on disagreement and resolves append-only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-2, EVT-2, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-divergence.test.ts`
**Tags**: @backend, @dispatch, @divergence

**Preconditions**:
- Engine token `pr-open`, independent tracker truth `blocked` (or a verify-class token versus a contradicting ledger outcome).
- A deterministic divergence id sequence.

**Steps**:
1. Dispatch and assert an open divergence record.
2. Invoke `dispatch dual-run resolve DIV-1 --note "tracker was stale; PR reopened"`.
3. Read the divergence ledger and run `dispatch dual-run summary --repo REPO`.

**Expected Outcome**:
- The open record is appended with both tokens and evidence references.
- Resolution appends a `resolved` record with a bounded note, principal, and timestamp; the original open record remains byte-identical.
- The summary reports reported `1`, resolved `1`, unresolved `0`, and names the identifier only while unresolved.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-divergence.test.ts` exits 0; a rewritten or deleted open record fails.

#### TC-EVID-003 - False success is recorded and resets the window

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-3, DM-1, DM-8, NFR-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-false-success.test.ts`
**Tags**: @backend, @dispatch, @incident

**Preconditions**:
- Engine claims `pr-open`, but the tracker shows no PR and CI shows no pushed head.
- An earlier evidence set exists before the incident.

**Steps**:
1. Dispatch and assert the record's false-success classification and bounded evidence references.
2. Run the summary and assert the incident count and the window start.
3. Add evidence before the incident and re-evaluate.

**Expected Outcome**:
- The record is a false-success incident, never clean, with bounded references (no raw payload).
- The summary counts the incident and starts the window at the incident, excluding earlier evidence.
- Floor and class coverage must re-accrue after the incident.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-false-success.test.ts` exits 0; a zeroed incident or a pre-incident window fails.

#### TC-EVID-004 - Unevaluable evidence is recorded and blocks the gate

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-4, NFR-5, NFR-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-unevaluable.test.ts`
**Tags**: @backend, @dispatch, @evidence

**Preconditions**:
- The comparison token cannot be derived, or corroboration cannot be read.
- A bounded read omits some records.

**Steps**:
1. Dispatch and read the attempt record.
2. Run the summary over the bounded/truncated set.
3. Assert the gate verdict and the declaration.

**Expected Outcome**:
- The record is `unevaluable` and carries the classified state or provider identity.
- The gate never treats the record as clean; the summary declares truncation rather than reporting zero.
- Eligibility is unverifiable, not eligible.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-unevaluable.test.ts` exits 0; an unevaluable record counted clean fails.

#### TC-EVID-005 - Fenced append and torn reads never become clean

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-evidence-record.test.ts`
**Tags**: @backend, @dispatch, @state, @fault

**Preconditions**:
- The existing test state edge with injectable faults at append and read points.
- Torn attempt, divergence, and handover payload fixtures.

**Steps**:
1. Arm a pre-append fault and dispatch; repeat for a divergence append and a handover append.
2. Arm a torn-read fault and run the summary and the authority view read.
3. Assert the classified failure, the record count, and the verdict.

**Expected Outcome**:
- A failed attempt, divergence, or handover append yields a classified state failure; no clean verdict, no fabricated record.
- A torn read yields `state-unverified`, an unevaluable summary, or a dual-run authority default, never clean or authoritative.
- Every successful append of all three kinds is verified after write; the fence is released on both paths.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-evidence-record.test.ts` exits 0; a clean verdict from a torn read or a failed append fails.

#### TC-GATE-001 - Summary reports the full evidence window

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-6, DM-7, SC-M1-30
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-summary.test.ts` and `tests/golden/dispatch-summary.test.ts`
**Tags**: @backend, @dispatch, @summary

**Preconditions**:
- A seeded evidence window spanning several UTC dates with counted dispatches, incidents, and resolved and unresolved divergences.

**Steps**:
1. Invoke `dispatch dual-run summary --repo REPO` in text and JSON modes.
2. Assert every DM-6 field.
3. Compare the text with the committed golden.

**Expected Outcome**:
- The summary reports window start and reason, elapsed days, counted deliveries, false-success incidents, divergences (reported, resolved, unresolved) with identifiers, class coverage with missing classes, corroboration satisfaction, eligibility verdict, and every unmet condition.
- Text and envelope agree; the text is byte-identical to the golden.
- Exit `0` even when ineligible.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-summary.test.ts tests/golden/dispatch-summary.test.ts` exits 0; a missing field or a non-zero exit on an ineligible verdict fails.

#### TC-GATE-002 - Eligibility is the four-condition conjunction

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-summary.test.ts`
**Tags**: @backend, @dispatch, @gate

**Preconditions**:
- A fully eligible evidence fixture: zero incidents, zero unresolved divergences, all eleven classes, floor met, every success claim corroborated.
- Four mutants, each breaking exactly one condition.

**Steps**:
1. Call `evaluateHandoverGate(evidence)` on the eligible fixture.
2. Call it on each single-condition mutant.
3. Assert the verdict and the named conditions.

**Expected Outcome**:
- The eligible fixture returns eligible with no unmet condition.
- Each mutant returns ineligible and names exactly the broken condition.
- The summary and handover evaluate the same predicate and produce the same verdict for the same fixture.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` exits 0; a single unmet condition accepted as eligible fails.

#### TC-GATE-003 - Floor variant: 20 counted dispatches

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-7, DEC-12
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-floor.test.ts`
**Tags**: @backend, @dispatch, @gate, @floor

**Preconditions**:
- Evidence with 20 counted dispatches across 6 distinct UTC dates, all eleven classes covered, zero incidents, zero unresolved divergences, and full corroboration.
- A companion set with 19 counted dispatches on the same 6 dates.

**Steps**:
1. Evaluate the 20-dispatch set.
2. Evaluate the 19-dispatch set.
3. Assert the floor condition and the overall verdict.

**Expected Outcome**:
- The 20-dispatch set meets the floor and is eligible (all other conditions hold).
- The 19-dispatch set fails the floor and names the floor as unmet.
- The day count is reported as 6 distinct UTC dates, not 20.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` exits 0; a count-based floor computed from elapsed days or a 19-dispatch pass fails.

#### TC-GATE-004 - Floor variant: 7 consecutive UTC dates

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-7, DEC-12
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-floor.test.ts`
**Tags**: @backend, @dispatch, @gate, @floor

**Preconditions**:
- Evidence with 14 counted dispatches (2 per date) on 7 consecutive UTC dates, all other conditions satisfied.
- A companion set with 6 consecutive dates, a one-day gap, and then a seventh date.

**Steps**:
1. Evaluate the 7-consecutive-date set.
2. Evaluate the gapped set.
3. Assert the floor and the overall verdict.

**Expected Outcome**:
- The 7-consecutive-date set meets the floor with fewer than 20 dispatches and is eligible.
- The gapped set fails the "consecutive" requirement and names the floor as unmet.
- Dates are UTC calendar dates, independent of local timezone.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` exits 0; a 14-dispatch 7-date pass computed from local time or a gapped set passing fails.

#### TC-GATE-005 - Floor never substitutes for the other conditions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, AC-F5-3, DM-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-floor.test.ts`
**Tags**: @backend, @dispatch, @gate, @floor

**Preconditions**:
- Four fixtures, each meeting the floor (20 dispatches) but breaking one other condition: one missing class, one false-success incident, one unresolved divergence, and one uncorroborated success claim.

**Steps**:
1. Evaluate each fixture.
2. Assert the verdict and the named unmet conditions.
3. Assert the rendered summary's floor-only sentence.

**Expected Outcome**:
- Every fixture is ineligible with the specific non-floor condition named.
- The floor condition is reported separately and never masks the other failures.
- The summary states that the floor is floor-only and does not substitute for coverage, incident truth, or corroboration.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` exits 0; any fixture passing on the floor alone fails.

#### TC-GATE-006 - Unreadable or truncated evidence is unverifiable

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-4, NFR-4, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @gate, @fault

**Preconditions**:
- An unreadable evidence ledger; a torn record; a truncated read at the 5,000-record bound.
- A repository identity that cannot be resolved.

**Steps**:
1. Run the summary against each degraded fixture.
2. Assert the declaration, the counts, and the verdict.
3. Run handover against the unresolvable-identity fixture.

**Expected Outcome**:
- Degraded runs declare the degradation or truncation, do not fabricate zeros, and report `unverifiable`.
- The unresolvable repository identity is a clean refusal at exit `1`, not an empty success.
- No degraded case returns eligible.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; fabricated zeros, an eligible degraded verdict, or an empty success fails.

#### TC-GATE-007 - All eleven classes must be covered

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-7, DEC-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-summary.test.ts`
**Tags**: @backend, @dispatch, @gate, @coverage

**Preconditions**:
- A fixture covering all eleven tokens across counted dispatches.
- Eleven mutants, each removing one class.
- A fixture where dispatch-session tokens carry an explicit not-applicable token baseline.

**Steps**:
1. Evaluate the full-coverage fixture.
2. Evaluate each single-class-removal mutant.
3. Assert the missing class naming and the dispatch-session exposure rule.

**Expected Outcome**:
- Full coverage satisfies the class condition; `present` equals the eleven-token set.
- Each mutant names exactly the removed class and is ineligible.
- Dispatch-session tokens count as class exposure even though their token baseline is not-applicable.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` exits 0; a missing class not named or a dispatch-session class excluded fails.

#### TC-GATE-008 - Family-wise comparison baseline

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-2, AC-F5-2, DEC-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @comparison

**Preconditions**:
- Three fixture families: a verify-class token with a verify-change ledger outcome, a tracker-pr token with independent tracker truth, and a dispatch-session token with an outcome-level comparison.

**Steps**:
1. Derive the comparison for each family.
2. Assert which independent source is consulted.
3. Assert the dispatch-session comparison is outcome-level with an explicit not-applicable token baseline.
4. Assert a verify-class token is never compared against a `pr-open` result.

**Expected Outcome**:
- Verify-class compares to the ledger outcome; tracker-pr compares to tracker truth; dispatch-session compares outcomes with a not-applicable token baseline.
- A cross-family comparison is rejected as a fixture error, not counted as agreement.
- No divergence is recorded for a deliberately not-applicable token baseline.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a cross-family comparison or a not-applicable treated as divergence fails.

#### TC-GATE-009 - Incident resets the window; resolved divergence does not

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-3, AC-F5-1, DEC-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-window.test.ts`
**Tags**: @backend, @dispatch, @gate, @window

**Preconditions**:
- An evidence set with 20 dispatches before a false-success incident and 5 after.
- A second set with a resolved divergence in the middle of the window.

**Steps**:
1. Evaluate the incident set and assert the window start and counts.
2. Evaluate the resolved-divergence set.
3. Assert the floor and class coverage re-accrual.

**Expected Outcome**:
- The incident set's window starts at the incident; pre-incident dispatches are excluded from the floor and coverage.
- The resolved-divergence set keeps its original window start; the resolution does not reset it.
- The summary reports the window start and reason in both cases.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-window.test.ts` exits 0; an incident inside an eligible window or a resolved divergence resetting the window fails.

#### TC-GATE-010 - Corroboration sufficiency per outcome family

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @gate, @corroboration

**Preconditions**:
- A table of success-claimed outcomes and their required evidence: `merged` needs pushed head, CI on that head, tracker state, and completed phases; tracker-derived tokens need the tracker fact; `finished` needs the completed phase ledger; `noop-lane-nothing-to-do` needs the ledger or queue fact.

**Steps**:
1. For each family, evaluate with all required evidence present.
2. Remove exactly one required source and re-evaluate.
3. Assert the corroboration tri-state and the gate verdict.

**Expected Outcome**:
- Complete evidence satisfies corroboration; a missing required source is explicitly unsatisfied and blocks eligibility.
- The engine token alone never satisfies corroboration for any family.
- The summary lists satisfied and unsatisfied corroboration per family.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a token-only success satisfying corroboration fails.

#### TC-HAND-001 - Unmet gate is a clean refusal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-7, EVT-3, SC-M1-29
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover

**Preconditions**:
- A repository whose evidence is missing one class, has one unresolved divergence, and has not met the floor.
- A recording authority-view writer and a recording handover appender.

**Steps**:
1. Invoke `dispatch handover REPO`.
2. Assert the exit, the negative verdict, and the named conditions.
3. Assert the handover ledger and the authority view.

**Expected Outcome**:
- Exit `1` with a clean verification negative verdict; every unmet condition is named.
- Zero handover records are appended; the authority view is absent or unchanged and therefore `dual-run`.
- The bash stack remains authoritative and prints no deprecation pointer.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; an authority change on refusal or an unnamed condition fails.

#### TC-HAND-002 - Met gate flips one repository and records it

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DM-3, DM-4, EVT-3, SC-M1-29
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover

**Preconditions**:
- Repo-alpha meets all four conditions; repo-beta does not.
- A recording authority-view writer.

**Steps**:
1. Invoke `dispatch handover REPO-ALPHA`.
2. Assert the handover record, the authority view, and the reported flip.
3. Inspect repo-beta's authority.

**Expected Outcome**:
- One handover record with the conditions snapshot, evidence references, principal, and timestamp.
- Repo-alpha's view is `authoritative` with the handover reference, recorded time, and reversal availability; the write is atomic.
- Repo-beta remains `dual-run`; the announcement says the flip is recorded and reversible.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; a second record, a non-atomic write, or a beta flip fails.

#### TC-HAND-003 - Reversal restores dual-run; second reversal is a noop

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, DM-3, DM-4, EVT-3, AC-NFR6-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover, @idempotency

**Preconditions**:
- Repo-alpha is engine-authoritative with one handover record.
- A deterministic clock.

**Steps**:
1. Invoke `dispatch handover REPO-ALPHA --revert`.
2. Assert the reversal record, the authority view, and history retention.
3. Invoke the same reversal again.

**Expected Outcome**:
- One reversal record; the view returns to `dual-run`; the original handover record remains.
- The second reversal exits `0`, appends zero records, and reports a noop.
- The bash stack returns to normal authoritative behavior.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; a deleted history, a non-zero noop, or a duplicate reversal fails.

#### TC-HAND-004 - Derived authority view is complete, atomic, and fail-safe

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-4, DM-4, NFR-5
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-authority-view.test.ts`
**Tags**: @backend, @dispatch, @authority

**Preconditions**:
- Fixtures for a valid dual-run view, a valid authoritative view, an absent view, an unreadable view, a malformed JSON view, and a torn pair of prior and next files.
- An injected atomic writer.

**Steps**:
1. Validate the view fields against `delivery.dispatch.authority.v1`.
2. Replace the view and assert the reader observes only a complete prior or next version.
3. Read each degraded fixture through `readDispatchAuthority`.

**Expected Outcome**:
- The view names repository, authority, handover reference, recorded time, and reversal availability.
- Replacement is atomic; no torn mix is observed.
- Absent, unreadable, or malformed resolves to `dual-run`; no throw escapes to callers.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-authority-view.test.ts` exits 0; a torn read or a non-dual-run default fails.

#### TC-HAND-005 - Dual-run dispatch claims no authority

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-9, AC-F6-5, DM-5, DEC-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-authority-view.test.ts`
**Tags**: @backend, @dispatch, @authority

**Preconditions**:
- A repository with no handover record (dual-run default).
- A recording merge port and a recording bash-invocation guard.

**Steps**:
1. Dispatch once and assert `handoverState`.
2. Assert the attempt record and the merge recorder.
3. Run a bash entry point for the same repository.

**Expected Outcome**:
- `handoverState` is `dual-run`; evidence is recorded; no authority claim is made.
- The bash stack is neither suppressed nor blocked; no merge is fired.
- Authority changes only through a recorded handover.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-authority-view.test.ts` exits 0; an authority claim, a bash block, or a merge call fails.

#### TC-HAND-006 - Handover is isolated per repository

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DEC-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover, @isolation

**Preconditions**:
- Repo-alpha and repo-beta both have evidence; alpha meets the gate, beta does not.
- Repository identity resolves from the scheduling engine's `repository` field; a second case has no field and falls back to the checkout-root digest.

**Steps**:
1. Flip alpha and assert both authority views.
2. Revert alpha and assert both views again.
3. Repeat with the checkout-root fallback identity.

**Expected Outcome**:
- Every operation touches only the named repository; beta is byte-identical before and after.
- The fallback identity is stable across a checkout rename of the same root digest.
- No aggregate or global authority record is written.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; a beta change or a global flip fails.

#### TC-BASH-001 - Dual-run bash entry points are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-8
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh` plus the four retained suites
**Tags**: @bash, @dispatch, @fallback

**Preconditions**:
- A temporary state root with no authority view (dual-run).
- A sanitized `PATH` without the typed binary.

**Steps**:
1. Run `deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, and `ceo-loop.sh` with their existing arguments.
2. Capture stdout, stderr, and exit codes.
3. Scan output for a deprecation pointer.

**Expected Outcome**:
- All four scripts complete with their existing arguments and exit behavior.
- No deprecation pointer is printed; no typed CLI invocation occurs.
- No new required argument appears.

**Pass/Fail Evidence**:
- `bash scripts/.tests/test-dispatch-bash-fallback.sh` exits 0; a changed exit, a new argument requirement, or a typed CLI invocation fails.

#### TC-BASH-002 - Authoritative bash entry points print the deprecation pointer

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, NFR-8, SC-M1-29
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh`
**Tags**: @bash, @dispatch, @fallback

**Preconditions**:
- The authority view for the repository is `authoritative`.

**Steps**:
1. Run each of the four scripts.
2. Assert the deprecation pointer text.
3. Assert the script still executes its fallback path.

**Expected Outcome**:
- Each script prints a pointer naming `dispatch` and the reversal surface `dispatch handover REPO --revert`.
- Each script remains executable and does not refuse merely because authority moved.
- The pointer goes to the declared stream and is bounded.

**Pass/Fail Evidence**:
- `bash scripts/.tests/test-dispatch-bash-fallback.sh` exits 0; a missing pointer or a refusal fails.

#### TC-BASH-003 - Bash fallback works with the typed CLI absent or broken

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, NFR-8
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh`
**Tags**: @bash, @dispatch, @fallback, @fault

**Preconditions**:
- Three conditions: typed binary absent from `PATH`; typed binary present but exits non-zero; typed binary present but hangs beyond a bounded guard.
- Authority-view fixtures: absent, unreadable, malformed JSON, and a partial file.

**Steps**:
1. Run each script under each CLI condition and each authority-view fixture.
2. Assert the script exits normally and treats the repository as dual-run when the view is not valid.
3. Assert no hang or retry loop.

**Expected Outcome**:
- All runs complete normally; the fallback decision is a pure file read.
- Absent, unreadable, and malformed views resolve to `dual-run`.
- A broken or hanging typed binary is never invoked, so it cannot affect the outcome.

**Pass/Fail Evidence**:
- `bash scripts/.tests/test-dispatch-bash-fallback.sh` exits 0; any typed CLI invocation, hang, or non-dual-run default fails.

#### TC-BASH-004 - Four scripts across three conditions all complete

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR8-1, NFR-8
**Test Type(s)**: Shell
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh`
**Tags**: @bash, @dispatch, @fallback, @matrix

**Preconditions**:
- The full matrix: four scripts x three conditions (dual-run, authoritative, typed CLI absent).
- A fixed temporary root per cell.

**Steps**:
1. Execute all twelve cells.
2. Record exit code, deprecation-pointer presence, and whether the fallback path ran.
3. Assert the matrix table.

**Expected Outcome**:
- All twelve cells complete with the declared behavior: no pointer in dual-run, pointer in authoritative, normal run with the typed CLI absent.
- Zero new required arguments across the matrix.
- The matrix output is deterministic across a rerun.

**Pass/Fail Evidence**:
- `bash scripts/.tests/test-dispatch-bash-fallback.sh` exits 0; any cell missing from the matrix or diverging fails.

#### TC-BASH-005 - Bash never invokes the typed CLI to decide authority

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, NFR-8
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-bash-authority.test.ts`
**Tags**: @bash, @dispatch, @structure

**Preconditions**:
- The four scripts' source files.

**Steps**:
1. Scan the authority-detection region of each script for typed binary invocation, network use, and model use.
2. Assert the read is a plain file read and a parse with a safe default.
3. Mutation-test the scan by introducing a binary invocation in a temporary copy.

**Expected Outcome**:
- Zero typed CLI invocations, zero network calls, and zero model calls in the authority decision.
- The only inputs are the authority-view file and shell built-ins.
- The mutant is detected and named.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-bash-authority.test.ts` exits 0; an invocation or an undetected mutant fails.

#### TC-E2E-001 - Controlled repository accrues evidence, flips, and dispatches

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-1, F-5, F-6, AC-F8-1, SC-M1-29
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-e2e.test.ts`
**Tags**: @conformance, @dispatch, @handover

**Preconditions**:
- A controlled temporary repository with real state, git, and change files, plus injected harness, tracker, CI, and VCS read ports.
- A deterministic clock able to advance UTC dates without sleeping.
- A scripted harness evidence set able to produce all eleven classes across dispatches.

**Steps**:
1. Run genuine `dispatch` invocations through the real command path until the gate is met (all eleven classes, floor met, zero incidents, zero unresolved divergences, corroboration satisfied).
2. Run `dispatch dual-run summary --repo REPO` and assert eligibility.
3. Run `dispatch handover REPO` and assert the flip.
4. Run one more dispatch and assert a valid token, summary, and attempt record.

**Expected Outcome**:
- Every record is produced by the commands; the summary reaches eligibility with named conditions.
- Handover flips only the controlled repository and records the conditions snapshot.
- The post-handover dispatch completes end to end through the typed stack with a valid token and record.
- No real remote, network, or model is touched.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` exits 0; hand-inserted evidence, a pre-eligible flip, or a failed post-handover dispatch fails.

#### TC-E2E-002 - Reversal returns the repository to bash-authoritative

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-6, F-7, AC-F8-2, SC-M1-29
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-e2e.test.ts`
**Tags**: @conformance, @dispatch, @handover

**Preconditions**:
- The controlled repository from `TC-E2E-001` is authoritative with one handover record.

**Steps**:
1. Run `dispatch handover REPO --revert`.
2. Invoke a bash entry point for the repository.
3. Read the handover ledger and the authority view.

**Expected Outcome**:
- The repository returns to `dual-run`; the bash path runs normally with no deprecation pointer.
- Both the handover and reversal records remain in history.
- No other repository's authority changed.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` exits 0; lost history or a still-authoritative view fails.

#### TC-E2E-003 - Fixture evidence is command-produced, never hand-inserted

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F8-1
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-fixture.test.ts`
**Tags**: @conformance, @dispatch, @fixture

**Preconditions**:
- The controlled fixture exposes no direct attempt, divergence, or handover append helper to test bodies.
- A guard counts command-originated appends.

**Steps**:
1. Assert the fixture API surface has no ledger writer.
2. Assert the attempt count equals the number of dispatch invocations.
3. Attempt a test-local direct record write and assert the fixture guard rejects it or the record is not counted.

**Expected Outcome**:
- No test can hand-insert evidence through the fixture.
- Every counted record carries command-produced provenance (run id and attempt identity).
- A hand-inserted record is either impossible or explicitly excluded from the gate.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-fixture.test.ts` exits 0; a fixture writer or a mismatch between dispatches and records fails.

#### TC-MERGE-001 - Merge-ready PR stays `pr-open`; no merge fires

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-merge-absence.test.ts`
**Tags**: @backend, @dispatch, @merge

**Preconditions**:
- A PR that is merge-ready (green CI, approved, mergeable).
- A recording merge port that fails the test if called.

**Steps**:
1. Dispatch and assert the token.
2. Assert the merge recorder and the attempt record.
3. Repeat with an unresolvable URL.

**Expected Outcome**:
- Result is `pr-open` or `pr-open-unverified`; `merged` is never emitted for a merge-ready open PR.
- Zero merge calls; the record names the PR as awaiting the coordinator's merge decision.
- The delivery is left for `merge`, not merged by dispatch.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-merge-absence.test.ts` exits 0; any merge invocation or `merged` token on an open PR fails.

#### TC-MERGE-002 - Already-merged detection records observed evidence only

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DM-1, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-merge-absence.test.ts`
**Tags**: @backend, @dispatch, @merge

**Preconditions**:
- The PR was merged independently before dispatch; VCS and tracker reads agree.
- A recording merge port.

**Steps**:
1. Dispatch and assert `merged`.
2. Assert the observed merged evidence in the record.
3. Assert the merge recorder count.

**Expected Outcome**:
- `merged` is emitted only after independent observation; the evidence reference is recorded.
- Zero merge calls; dispatch does not re-merge or close anything.
- Corroboration includes the pushed head, CI on that head, tracker state, and completed phases where available.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-merge-absence.test.ts` exits 0; an unobserved `merged` or a merge call fails.

#### TC-MERGE-003 - Structural boundary proves no merge path

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, AC-NFR9-1, NFR-9
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-merge-boundary.test.ts`, `tests/structure/dispatch-imports.test.ts`, and `bun test tests/boundaries`
**Tags**: @backend, @dispatch, @boundary, @merge

**Preconditions**:
- The dependency-cruiser rules and the workspace entrypoint check.
- A temporary-workspace negative fixture that imports the merge module from a dispatch path.

**Steps**:
1. Run the boundary suite with the real rules.
2. Assert no dispatch module imports a merge module, merge port, or merge executor.
3. Add the forbidden import in the negative fixture and assert the check fails and names it.
4. Run `bun run scripts/checks/workspace-entrypoints.ts`.

**Expected Outcome**:
- The production tree has zero reachable merge imports from dispatch composition.
- The negative fixture fails the boundary check with a named finding.
- The fixture-coverage meta-check confirms the rule has a failing fixture.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-merge-boundary.test.ts tests/boundaries && bun run scripts/checks/workspace-entrypoints.ts` exits 0; a reachable merge import or a non-failing fixture fails.

#### TC-MERGE-004 - Production composition has no reachable merge port

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR9-1, NFR-9
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-composition.test.ts`
**Tags**: @backend, @dispatch, @composition, @merge

**Preconditions**:
- The production dispatch composition function and its dependency record.

**Steps**:
1. Inspect the composition's declared ports.
2. Assert no merge executor, merge port, or merge invocation is present.
3. Assert a source-level merge import added to the composition fails the structural check.

**Expected Outcome**:
- The composition exposes only the declared dispatch ports; merge is absent.
- The structural assertion fails closed if a merge port is added.
- The check is part of `pnpm check:boundaries`.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-composition.test.ts` exits 0; a merge port in composition fails.

#### TC-DAEMON-001 - Planner produces prompt and declared environment; executor available

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-daemon-planner.test.ts`
**Tags**: @backend, @dispatch, @daemon

**Preconditions**:
- A `LaneLaunchRequest` with a reference, repository, and weight class.
- A configured execution-environment descriptor with a declared variable-name allowlist.
- A recording harness session port.

**Steps**:
1. Call `planLaneLaunch(request)`.
2. Assert the returned prompt and environment.
3. Call `createLaneExecutor(...)` and assert availability.

**Expected Outcome**:
- The plan returns the lifecycle prompt and only declared environment variable names.
- No secret value is resolved; no credential value appears.
- `createLaneExecutor` reports available with the selected harness session port and descriptor.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-daemon-planner.test.ts` exits 0; a secret value or an unavailable executor with a valid plan fails.

#### TC-DAEMON-002 - Daemon spawns, observes, collects, resumes a dispatch lane

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-1, AC-F10-2, EVT-1
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-daemon-lane.test.ts`
**Tags**: @conformance, @dispatch, @daemon

**Preconditions**:
- The real planner and executor composition over a scripted harness port.
- A temporary state root with a lane record and a queue action.

**Steps**:
1. Call `runSupervisionCycle(...)` with the production planner and executor.
2. Assert start, the lane record, observation, and collection.
3. Resume the lane through the executor and compare the final token and outcome with a one-shot dispatch over the same evidence.

**Expected Outcome**:
- The lane is started, recorded, observed, collected, and resumed through the delivered seam.
- The daemon path and one-shot path agree on the final token and outcome for the same evidence.
- No duplicate lane record and no divergent classification.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-daemon-lane.test.ts` exits 0; a missing lane record or a token mismatch fails.

#### TC-DAEMON-003 - One-shot dispatch works with no daemon

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-1, AC-F10-3, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-daemonless.test.ts`
**Tags**: @backend, @dispatch, @daemon

**Preconditions**:
- No daemon process and no daemon socket; the state root has only a queue entry.
- A variant where the planner is unavailable or declares a capability gap.

**Steps**:
1. Invoke `dispatch GH-301` with no daemon.
2. Assert the exit, token, and attempt record.
3. Run the daemon supervision cycle with an unavailable planner.

**Expected Outcome**:
- The one-shot dispatch completes from state alone, appends the record, and does not fail, idle, or claim a daemon dependency.
- The daemon with an unavailable planner reports honest supervise-only mode, not a fake successful lane.
- No daemon is started by the one-shot path.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-daemonless.test.ts` exits 0; a daemon dependency, an idle, or a fake lane fails.

#### TC-HELP-001 - Dispatch is registered and documented with the evidence bar

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DEC-1, DEC-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/help-guide-coverage.test.ts`, and `tests/checks/reference-page-parity.test.ts`
**Tags**: @backend, @dispatch, @help, @docs

**Preconditions**:
- `PROMPT_REQUIRED_COMMANDS` and the help inventory.
- The reference page `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`.

**Steps**:
1. Assert `dispatch` is in the prompt-required set and root help lists it.
2. Run `dispatch --help` and assert the three execution forms plus `dual-run resolve` and `handover --revert`.
3. Assert the help points at the reference page.
4. Scan the reference page for the four-condition bar and the two new surfaces.

**Expected Outcome**:
- Dispatch is discoverable in root and command help and covered by the help/guide matrix.
- The reference page describes the evidence-based bar, the resolution surface, and the reversal surface.
- The page contains no superseded "two clean weeks" or "two-week" wording.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-help-inventory.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` exits 0; a missing form or stale wording fails.

#### TC-HELP-002 - Help and version remain pure and side-effect free

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-2, NFR-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-help-version.test.ts`
**Tags**: @backend, @dispatch, @help, @isolation

**Preconditions**:
- A poisoned composer that throws if invoked.
- Recording state, git, network, configuration, and model ports.

**Steps**:
1. Run `--help`, `dispatch --help`, and `--version` in an empty temporary directory.
2. Assert exit code, stdout, and stderr.
3. Assert every recorder count and the composer count.

**Expected Outcome**:
- All three exit `0` with the expected content.
- Zero state, network, git, configuration, or model reads; zero writes; composer never invoked.
- No temporary file is created.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-help-version.test.ts` exits 0; any non-zero recorder count or composer invocation fails.

#### TC-HELP-003 - Absence assertions are retired; F-9 is revisited

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-12, AC-F11-3, DEC-4
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-composition.test.ts` (updated), `tests/conformance/pilot/pilot-isolation.test.ts` (updated), and `tests/structure/harness-review-deferrals.test.ts` (updated)
**Tags**: @backend, @dispatch, @structure, @deferral

**Preconditions**:
- The three delivered assertions exist in the current tree.

**Steps**:
1. Assert the entrypoint composition test expects `dispatch` present and no longer asserts its absence.
2. Assert the pilot-isolation test expects dispatch composed and does not scan it as absent.
3. Assert the harness-review-deferrals test no longer asserts "no dispatch surface or spawn-failure row"; it asserts the F-9 record names dispatch as the production consumer and carries a status and revisit trigger.
4. Assert the F-9 status is either resolved or explicitly a follow-up, never the blanket absence claim.

**Expected Outcome**:
- None of the three assertions contradicts the delivered command.
- The F-9 record states the production-consumer outcome and a revisit trigger; full resolution is not required.
- A re-introduced absence assertion fails the suite.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-composition.test.ts tests/conformance/pilot/pilot-isolation.test.ts tests/structure/harness-review-deferrals.test.ts` exits 0; a stale absence assertion or a blanket deferral claim fails.

#### TC-PLANREC-001 - Story-owned planning surfaces carry the evidence bar

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1, DEC-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-doc-conformance.test.ts`
**Tags**: @docs, @dispatch, @planning

**Preconditions**:
- The reference page and SC-M1-29/SC-M1-30 in `doc/planning/oss-tooling/milestones/m1/test-scenarios.md`.
- A stale-phrase table: "two clean weeks", "two-week window", "fourteen days", and "eligibility logic = clean window met".
- A required-phrase table: "zero false-success incidents", "zero unresolved divergences", "all eleven", "20 counted dispatches", "7 consecutive UTC dates", "corroborat", "floor".

**Steps**:
1. Scan the reference page and the two seeded scenarios for stale phrases.
2. Assert every required phrase is present in the appropriate surface.
3. Assert the reference page names `dispatch dual-run resolve` and `dispatch handover --revert`.
4. Assert the scan does not inspect the GH-239 ticket body or any other planning file.

**Expected Outcome**:
- The three story-owned surfaces carry the amended bar; no stale calendar proxy remains.
- The reference page covers the resolution and reversal surfaces.
- The test's file allowlist proves it never asserts absence in out-of-scope planning docs.

**Pass/Fail Evidence**:
- `bun test tests/checks/dispatch-doc-conformance.test.ts` exits 0; a stale phrase or a missing required phrase fails with the file and phrase named.

#### TC-ERR-001 - Spawn failure classifies as `dispatch.session.spawn-failed`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-error-envelope.test.ts`
**Tags**: @backend, @dispatch, @errors

**Preconditions**:
- A harness port whose `spawn` fails before a session exists (transport failure or validated refusal distinct from harness-path `refused`).
- The machine and documented error tables.

**Steps**:
1. Dispatch and assert the exit and envelope.
2. Assert the machine row and the documented row.
3. Assert the attempt record, if any, is a failure not a success.

**Expected Outcome**:
- Identity `dispatch.session.spawn-failed`, category user-validation, exit `1`.
- Both the machine and documented tables carry the row with matching fields.
- No session handle is fabricated; no success token is emitted.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-error-envelope.test.ts` exits 0; a missing row or an exit other than `1` fails.

#### TC-ERR-002 - Dispatch state failure classifies as `dispatch.state-unverified`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-error-envelope.test.ts`
**Tags**: @backend, @dispatch, @errors, @state

**Preconditions**:
- A dispatch-specific unverifiable truth read that is not covered by a generic `state.*` identity.

**Steps**:
1. Dispatch and assert the identity and exit.
2. Assert both tables.
3. Assert the result token and remediation hint.

**Expected Outcome**:
- Identity `dispatch.state-unverified`, category platform-provider, exit `2`.
- The result token is `state-unverified`; the envelope carries a remediation hint.
- The machine and documented rows agree.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-error-envelope.test.ts` exits 0; exit `1` or a missing row fails.

#### TC-ERR-003 - Existing dispatch rows are unchanged and resolve by exact code

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2, NFR-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-error-identity.test.ts`
**Tags**: @backend, @dispatch, @errors

**Preconditions**:
- The delivered rows `dispatch.restart-budget-exceeded` and `dispatch.resume-uneconomical`.
- The dispatch domain kind already has multiple rows.

**Steps**:
1. Resolve each existing code and assert the same row, category, and projection as before the change.
2. Attempt kind-only resolution and assert it does not silently pick one row.
3. Assert the dispatch domain row count is four (two existing plus two new).

**Expected Outcome**:
- Existing rows are byte-identical in identity, category, retryable flag, consequence, and projection.
- Exact-code resolution returns exactly one row; kind-only resolution refuses or requires a code.
- No kind-only discriminant is assumed to resolve to a single row.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-error-identity.test.ts` exits 0; a changed existing row or a kind-only single-row resolution fails.

#### TC-ERR-004 - Error envelopes carry stable identity and bounded exit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-3, NFR-1
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/dispatch-errors.test.ts`
**Tags**: @backend, @dispatch, @errors, @golden

**Preconditions**:
- Committed error-envelope goldens for every dispatch failure class.

**Steps**:
1. Emit each failure envelope.
2. Assert the six error fields and the exit.
3. Compare against the goldens.

**Expected Outcome**:
- Every envelope carries code, category, retryable, consequence, remediation hint, and summary.
- No field contains prose in place of an identity; no exit outside `0`, `1`, `2`.
- Byte equality with the goldens.

**Pass/Fail Evidence**:
- `bun test tests/golden/dispatch-errors.test.ts` exits 0; a missing field or an out-of-range exit fails.

#### TC-ERR-005 - Machine and documented error tables stay in sync

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, AC-F12-2
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing, updated)
**Tags**: @checks, @dispatch, @errors

**Preconditions**:
- The two-way sync check between the machine table and the documented table.

**Steps**:
1. Run the sync check and assert both dispatch rows appear in both directions.
2. Mutate a temporary copy by removing a documented row and assert the check fails.
3. Mutate a temporary copy by adding an undocumented row and assert the check fails.

**Expected Outcome**:
- Both tables agree on all four dispatch rows.
- Each mutation fails and names the offending code.
- The check is part of `pnpm check`.

**Pass/Fail Evidence**:
- `bun test tests/checks/error-table-sync.test.ts` exits 0; an undetected one-way drift fails.

#### TC-TOKEN-001 - Token literals have one home and the set is total

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-1
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-token-home.test.ts` and `tests/structure/delivery-result-contract.test.ts` (existing, verified)
**Tags**: @backend, @dispatch, @taxonomy, @structure

**Preconditions**:
- `DELIVERY_RESULT_TOKENS` and `DELIVERY_RESULT_TAXONOMY` in the contracts tier.

**Steps**:
1. Assert the token set equals the taxonomy key set and the order matches the bash reference.
2. Scan production modules for a token literal outside the contracts home.
3. Introduce a second token list in a temporary copy and assert the scan fails.

**Expected Outcome**:
- Eleven tokens; one taxonomy row each; zero duplicates, extras, or omissions.
- No second production token list exists.
- The mutant is detected by file and token.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-token-home.test.ts tests/structure/delivery-result-contract.test.ts` exits 0; a second list or a set drift fails.

#### TC-TOKEN-002 - No call-site exit literal outside the projection module

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-1
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/exit-code-literals.test.ts` (existing, updated)
**Tags**: @checks, @dispatch, @exit

**Preconditions**:
- The delivered exit-code-literal scan.
- The dispatch projection module.

**Steps**:
1. Run the scan across dispatch production modules.
2. Assert exits derive only from the projection class.
3. Add a literal exit in a temporary copy and assert the scan fails.

**Expected Outcome**:
- Zero call-site exit literals outside the projection module.
- `state-unverified` exits `2` by projection, not by an override.
- The mutant is detected and named.

**Pass/Fail Evidence**:
- `bun test tests/checks/exit-code-literals.test.ts` exits 0; a literal exit or an undetected mutant fails.

#### TC-NFR-001 - Machine payload stays within 65,536 bytes

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-bounds.test.ts`
**Tags**: @backend, @dispatch, @bounds

**Preconditions**:
- A dispatch fixture with the largest declared `lastMessage` and evidence references.
- A summary fixture with the maximum bounded record set.

**Steps**:
1. Serialize the envelope with `JSON.stringify`.
2. Measure `Buffer.byteLength(..., "utf8")`.
3. Repeat for the largest summary envelope.

**Expected Outcome**:
- Every machine payload is at most 65,536 UTF-8 bytes.
- Bounded fields are truncated with an explicit marker, never silently dropped.
- No unbounded array or raw payload enters the envelope.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-bounds.test.ts` exits 0; a payload over the bound fails with the measured size.

#### TC-NFR-002 - Human output stays within 40 lines and 8,192 bytes

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-bounds.test.ts`
**Tags**: @backend, @dispatch, @bounds

**Preconditions**:
- Maximum-length summary, handover, and dispatch text fixtures.

**Steps**:
1. Capture stdout for each surface.
2. Count lines and measure UTF-8 bytes.
3. Assert the truncation marker when a field is bounded.

**Expected Outcome**:
- Human output is at most 40 lines and 8,192 bytes on every surface.
- `last_message` is single-line, bounded, and redacted.
- Truncation is declared, never silent.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-bounds.test.ts` exits 0; an over-bound or multi-line `last_message` fails.

#### TC-NFR-003 - Summary read is bounded and p95 stays within 5 s

**Scenario Type**: Performance
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-4
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-bounds.test.ts` (`@perf` case)
**Tags**: @backend, @dispatch, @perf

**Preconditions**:
- A generated state root with 5,000 attempt records plus divergence and handover records.
- The declared reference host metadata recorded in the test output.
- Twenty measured runs after one warm-up.
- The performance case title contains `@perf`, so the reference-host lane can select it with `-t "@perf"`.

**Steps**:
1. Run `dispatch dual-run summary --repo REPO` twenty times.
2. Assert the read never exceeds 5,000 attempt records and declares truncation when more exist.
3. Compute p95 latency and compare with 5,000 ms on the reference host.

**Expected Outcome**:
- The read is bounded at 5,000 records; a larger set declares truncation.
- p95 latency is at most 5,000 ms on the reference host, with host metadata recorded.
- On a shared CI runner, the bounded-read assertion is the gate and the latency result is recorded (OQ-T3).

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-bounds.test.ts -t "@perf"` exits 0 on the reference host; an unbounded read or a p95 over 5,000 ms fails.

#### TC-NFR-004 - Truncation is declared, never fabricated as zero

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, AC-F5-4, NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @bounds

**Preconditions**:
- A state root with 5,001 attempt records.
- A summary fixture that would omit the oldest record at the bound.

**Steps**:
1. Run the summary.
2. Assert the truncation declaration and the counts.
3. Assert the verdict.

**Expected Outcome**:
- The summary declares truncation and the omitted range; it does not report zero for an omitted category.
- Eligibility is unverifiable, not eligible.
- The bounded window is named in the output.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a silent omission or a fabricated zero fails.

#### TC-NFR-005 - Replays append no duplicate records

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR6-1, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-idempotency.test.ts`
**Tags**: @backend, @dispatch, @idempotency

**Preconditions**:
- A summary run, an eligible handover, a reversal, and an admitted resume already recorded.
- A deterministic clock and id sequence.

**Steps**:
1. Replay each verb identically.
2. Compare record counts and authority state.
3. Assert the noop reporting.

**Expected Outcome**:
- Zero duplicate attempt, divergence, handover, or reversal records.
- Authority state is unchanged by the replay; a noop is reported where nothing changed.
- No second effect or second spawn occurs.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-idempotency.test.ts` exits 0; a duplicate record or a changed authority state fails.

#### TC-NFR-006 - No secret, prompt, transcript, or payload leaks

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-privacy.test.ts` and `tests/checks/fixture-privacy.test.ts` (existing)
**Tags**: @backend, @dispatch, @privacy

**Preconditions**:
- Canary secret, credential value, full prompt, transcript, diff, and raw provider payload in harness evidence and environment.
- The dispatch output, envelope, records, and help pages.

**Steps**:
1. Run success, failure, summary, handover, and help paths with canaries present.
2. Scan every output and record for the canaries.
3. Assert `last_message` is bounded and redacted.

**Expected Outcome**:
- Zero canary occurrences in output, envelopes, records, help, and logs.
- The record contains only the declared bounded fields.
- The privacy fixture scan remains green.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-privacy.test.ts tests/checks/fixture-privacy.test.ts` exits 0; any canary occurrence fails with the field named.

#### TC-NFR-007 - Spawn environment is deny-by-default

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-privacy.test.ts` and `tests/behaviour/harness-spawn-env.test.ts` (existing, verified)
**Tags**: @backend, @dispatch, @privacy, @spawn

**Preconditions**:
- A parent environment containing undeclared canary variables and a canary secret.
- The declared execution-environment allowlist.

**Steps**:
1. Build the spawn environment through the planner and descriptor.
2. Assert the child environment keys equal the declared allowlist.
3. Assert no undeclared parent variable and no secret value is present.

**Expected Outcome**:
- Every child environment variable is declared; zero undeclared parent variables.
- No credential value is copied; a credential reference resolves only at use time.
- The canary is absent from the child environment.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-privacy.test.ts tests/behaviour/harness-spawn-env.test.ts` exits 0; an undeclared variable or a secret fails.

#### TC-DET-001 - Deterministic render with zero model calls

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F11-2, NFR-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-determinism.test.ts`
**Tags**: @backend, @dispatch, @determinism

**Preconditions**:
- Fixed state, fixed clock, fixed id sequence, and recording model and provider ports.

**Steps**:
1. Run summary, gate evaluation, classification, and render twice.
2. Compare ordered verdict, text, and envelope.
3. Assert the model and provider recorder counts.

**Expected Outcome**:
- The two runs are byte-identical and the verdict order is stable.
- Zero model or provider calls in help, summary, gate, classification, and render paths.
- No wall-clock value appears in an assertion-relevant field.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-determinism.test.ts` exits 0; a differing render or a model call fails.

#### TC-REG-001 - Existing suites and rows stay green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F12-2, AC-NFR1-1, NFR-8
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: Aggregate `pnpm check` plus the retained bash suites
**Tags**: @checks, @dispatch, @regression

**Preconditions**:
- The full workspace, the retained bash suites, and the delivered dispatch rows.

**Steps**:
1. Run `pnpm check`.
2. Run the four retained bash suites.
3. Compare the existing dispatch error rows and the eleven-token set with the pre-change declarations.

**Expected Outcome**:
- `pnpm check` passes: lint, format, typecheck, `bun test`, and boundaries.
- The four retained bash suites pass.
- The two existing dispatch rows and the eleven-token set are unchanged.

**Pass/Fail Evidence**:
- `pnpm check` and the retained bash suites exit 0; any regression or row drift fails.

## 6. Environments and Test Data

### 6.1 Environment Rules

- **In-process by default.** Unit, behaviour, structure, checks, types, golden, and conformance suites use `bun:test` with injected `CliDependencies`. No test reaches the live state directory, a live remote, the network, a model, or the wall clock.
- **Temporary roots.** Every file-touching suite uses `mkdtempSync` under `os.tmpdir()` (or the existing `makeTempRoot`) and removes the root in `afterAll` or `finally`.
- **Fixed clock and ids.** The dispatch suites use a fixed clock constant and a deterministic run-id and attempt-id sequence. UTC date advancement for the floor tests is a deterministic clock advance, never a sleep.
- **Sanitized environment.** Spawn-environment tests pass an explicit environment record; no test mutates `process.env` for another test.
- **Real state and local git.** Conformance suites use the real state store over the existing test edge and a local temporary git repository; only harness, tracker, CI, VCS, and provider surfaces are injected.
- **Bash isolation.** Bash suites use a temporary state root, a sanitized `PATH`, and a copy of the script under test when a mutation is required. The live tree is never written.
- **Determinism.** Two runs over the same state produce byte-identical text and envelope output. The p95 case records host metadata; wall-clock duration never gates any other scenario.
- **CI.** New invariants run with `bun run scripts/checks/*.ts` and are mutation-tested in `tests/checks/**`; the aggregate gate is `pnpm check`. Bash suites run via `bash scripts/.tests/test-*.sh`.

### 6.2 Harness, Tracker, CI, and State Stubbing Strategy

| Surface | Strategy | Determinism control |
|---|---|---|
| Harness session port | A scripted fake implements the full delivered `HarnessSessionPort` (`spawn`, `deliver`, `resume`, `collect`, `classify`, `liveness`, `listSessions`). It supplies neutral evidence only. | Scenario scripts are data; every call is recorded; the real shared classifier is used, never a fake. |
| Liveness | The fake returns declared token-delta, traffic, worktree, and prefill readings with explicit absence reasons. | Fixed readings per evaluation; the clock advances only when the scenario says so. |
| Tracker reads | An injected read port returns deterministic work-item, PR, and status truth; it records every query. | Truth fixtures per scenario; no HTTP. |
| CI reads | An injected read port returns pipeline and job state for the pushed head; it records every query. | Truth fixtures per scenario; no HTTP. |
| VCS reads | An injected read port returns branch commits, PR state, and merged state; it records every query. | Truth fixtures per scenario; local git only where the conformance path needs real objects. |
| State | The real `StateStorePort` over the existing test edge (`tests/fixtures/state/harness.ts`), with fault injection for pre-append, post-append, torn read, and read failure. | Temp root per case; fence token fixed; no test writes the live tree. |
| Queue lease | The real `claimQueueLease` over the temp store. | Fixed holder/runner identities and clock. |
| Clock and ids | Injected `nowIso`, date advance, and id sequence. | No `Date.now()` or random id in an assertion path. |
| Model and provider | Recording ports that fail the test if called. | Zero-call assertions in help, summary, gate, classification, and render. |
| Bash typed CLI | `PATH` excludes the binary, or points to a stub that exits non-zero or hangs. | Absence, broken, and hanging conditions; a bounded guard fails on hang. |
| Merge | A recording merge port and a structural import scan. | Zero-call and zero-import assertions. |

### 6.3 Test Data and Fixtures Inventory

| Fixture / data | Status | Purpose |
|---|---|---|
| `tests/fixtures/dispatch/harness.ts` | New | Temp state root, fixed clock, scripted harness session port, recording tracker/CI/VCS/model ports, id sequence. |
| `tests/fixtures/dispatch/ledger.ts` | New | Builders for attempt, divergence, handover, and authority-view records with deterministic identities. |
| `tests/fixtures/dispatch/evidence-windows.ts` | New | Window cases: 20 dispatches on 6 dates; 19 dispatches; 14 dispatches on 7 consecutive dates; gapped dates; incident reset; resolved divergence; all-eleven coverage; one-class-missing mutants; uncorroborated success. |
| `tests/fixtures/dispatch/truth.ts` | New | Tracker, CI, VCS, ledger, and phase truth fixtures for every token family and every contradiction case. |
| `tests/fixtures/dispatch/authority/` | New | Valid dual-run, valid authoritative, absent, unreadable, malformed, and torn authority-view fixtures. |
| `tests/fixtures/dispatch/golden/` | New | Byte-pinned four-key text, summary text, handover text, and error envelopes. |
| `tests/fixtures/dispatch/mutants/` | New | One mutant per negative rule: extra key, second token list, exit literal, merge import, stale planning phrase, silent truncation. |
| `tests/fixtures/dispatch/bash/` | New | Temp state roots and authority-view fixtures for the twelve-cell bash matrix. |
| `tests/conformance/dispatch/controlled-repo.ts` | New | Controlled repository with real state, git, and change files; injected external ports; deterministic date advance. |
| `tests/fixtures/state/harness.ts` | Existing | Real state store, fault injection, temp roots. |
| `tests/fixtures/economics/harness.ts` | Existing | Restart budget and resume economics fixtures reused by the resume scenarios. |
| `tests/fixtures/pilot/*` | Existing | Stub/real matrix and isolation guards reused by the conformance suite where the controlled repository needs the same no-spawn guard. |
| `tests/fixtures/result/code-corpora/` | Existing, updated | Add the two dispatch codes; keep the existing two. |
| `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md` | Story-owned, updated | Reference page reconciled to the evidence bar and the two extra surfaces. |
| `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` | Story-owned, two scenarios updated | SC-M1-29 and SC-M1-30 reconciled; no other scenario and no other planning file edited. |

### 6.4 Isolation and Cleanup

- One temp root per case; teardown removes it recursively, including on failure.
- The controlled repository uses a local bare remote inside the temp root; no network.
- Bash cells use a per-cell temp root and a sanitized environment; the script copies are removed.
- Goldens are never regenerated implicitly; a deliberate change requires the explicit regeneration command and a reviewed diff.
- Mutation scans copy the target to a temp root and never write the live tree.
- The live state directory and the real user home are never read or written.

## 7. Automation Plan and Implementation Mapping

### 7.1 Scenario-to-File Mapping

| TC ID | Test file / check | Execution command | Implementation status | Required mocks/stubs |
|---|---|---|---|---|
| TC-DISP-001 | `tests/behaviour/dispatch-harness-lease.test.ts` | `bun test tests/behaviour/dispatch-harness-lease.test.ts` | To Implement | Scripted harness port; temp queue ledger; truth ports |
| TC-DISP-002 | `tests/behaviour/dispatch-harness-lease.test.ts` | `bun test tests/behaviour/dispatch-harness-lease.test.ts` | To Implement | Active lease fixture; spawn recorder |
| TC-DISP-003 | `tests/behaviour/dispatch-liveness.test.ts` | `bun test tests/behaviour/dispatch-liveness.test.ts` | To Implement | Liveness reports; fixed clock |
| TC-DISP-004 | `tests/behaviour/dispatch-liveness.test.ts` | `bun test tests/behaviour/dispatch-liveness.test.ts` | To Implement | Absence reasons; clock-only advance |
| TC-DISP-005 | `tests/behaviour/dispatch-liveness.test.ts` | `bun test tests/behaviour/dispatch-liveness.test.ts` | To Implement | Two consecutive reports |
| TC-DISP-006 | `tests/behaviour/dispatch-envelope.test.ts` | `bun test tests/behaviour/dispatch-envelope.test.ts` | To Implement | Success and partial fixtures; envelope schema |
| TC-DISP-007 | `tests/golden/dispatch-text.test.ts`; `tests/fixtures/dispatch/golden/` | `bun test tests/golden/dispatch-text.test.ts` | To Implement | Committed text goldens |
| TC-DISP-008 | `tests/structure/dispatch-token-home.test.ts`; `tests/behaviour/dispatch-token-closure.test.ts` | `bun test tests/structure/dispatch-token-home.test.ts tests/behaviour/dispatch-token-closure.test.ts` | To Implement | Token taxonomy; derivation branches |
| TC-DISP-009 | `tests/behaviour/dispatch-exit-projection.test.ts` | `bun test tests/behaviour/dispatch-exit-projection.test.ts` | To Implement | Eleven-token fixtures; refusal fixtures |
| TC-DISP-010 | `tests/behaviour/dispatch-envelope.test.ts` | `bun test tests/behaviour/dispatch-envelope.test.ts` | To Implement | Spawn-failure and unreadable-truth fixtures |
| TC-DISP-011 | `tests/behaviour/dispatch-token-closure.test.ts` | `bun test tests/behaviour/dispatch-token-closure.test.ts` | To Implement | Shared classifier; `spawnRefused` evidence |
| TC-DISP-012 | `tests/behaviour/dispatch-token-closure.test.ts` | `bun test tests/behaviour/dispatch-token-closure.test.ts` | To Implement | Exhausted-lane and open-phase fixtures |
| TC-TRUTH-001 | `tests/behaviour/dispatch-truth-derivation.test.ts` | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` | To Implement | Exit-0/no-artifact truth fixture |
| TC-TRUTH-002 | `tests/behaviour/dispatch-truth-derivation.test.ts` | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` | To Implement | Open-PR truth fixture |
| TC-TRUTH-003 | `tests/behaviour/dispatch-truth-derivation.test.ts` | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` | To Implement | Empty-URL truth fixture |
| TC-TRUTH-004 | `tests/behaviour/dispatch-truth-derivation.test.ts` | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` | To Implement | Merged-state truth; merge recorder |
| TC-TRUTH-005 | `tests/behaviour/dispatch-truth-derivation.test.ts` | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` | To Implement | Blocking-state and missing-fact fixtures |
| TC-TRUTH-006 | `tests/behaviour/dispatch-state-unverified.test.ts` | `bun test tests/behaviour/dispatch-state-unverified.test.ts` | To Implement | Fault-injected reads; four degradation fixtures |
| TC-RESUME-001 | `tests/behaviour/dispatch-resume.test.ts` | `bun test tests/behaviour/dispatch-resume.test.ts` | To Implement | Blocked lane; adapter without injection |
| TC-RESUME-002 | `tests/behaviour/dispatch-restart-budget.test.ts` | `bun test tests/behaviour/dispatch-restart-budget.test.ts` | To Implement | Budget fixture; exhaustion record; escalation recorder |
| TC-RESUME-003 | `tests/behaviour/dispatch-resume-economics.test.ts` | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | To Implement | Economics fixtures; unreadable-facts fixture |
| TC-RESUME-004 | `tests/behaviour/dispatch-resume-economics.test.ts` | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | To Implement | Fixed clock/ids; replay harness |
| TC-EVID-001 | `tests/behaviour/dispatch-evidence-record.test.ts`; `tests/types/dispatch-contract.type-test.ts` | `bun test tests/behaviour/dispatch-evidence-record.test.ts tests/types` | To Implement | Record builders; canaries; declared types |
| TC-EVID-002 | `tests/behaviour/dispatch-divergence.test.ts` | `bun test tests/behaviour/dispatch-divergence.test.ts` | To Implement | Divergence fixture; resolve command; summary |
| TC-EVID-003 | `tests/behaviour/dispatch-false-success.test.ts` | `bun test tests/behaviour/dispatch-false-success.test.ts` | To Implement | Contradicting truth; prior-window fixture |
| TC-EVID-004 | `tests/behaviour/dispatch-unevaluable.test.ts` | `bun test tests/behaviour/dispatch-unevaluable.test.ts` | To Implement | Unresolvable comparison; bounded read |
| TC-EVID-005 | `tests/behaviour/dispatch-evidence-record.test.ts` | `bun test tests/behaviour/dispatch-evidence-record.test.ts` | To Implement | Test state edge faults; torn payload |
| TC-GATE-001 | `tests/behaviour/dispatch-dual-run-summary.test.ts`; `tests/golden/dispatch-summary.test.ts` | `bun test tests/behaviour/dispatch-dual-run-summary.test.ts tests/golden/dispatch-summary.test.ts` | To Implement | Seeded window; text/envelope goldens |
| TC-GATE-002 | `tests/behaviour/dispatch-dual-run-summary.test.ts` | `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` | To Implement | Eligible fixture plus four single-condition mutants |
| TC-GATE-003 | `tests/behaviour/dispatch-dual-run-floor.test.ts` | `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` | To Implement | 20/19-dispatch fixtures on 6 dates |
| TC-GATE-004 | `tests/behaviour/dispatch-dual-run-floor.test.ts` | `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` | To Implement | 7-consecutive-date and gapped fixtures |
| TC-GATE-005 | `tests/behaviour/dispatch-dual-run-floor.test.ts` | `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` | To Implement | Floor-met mutants |
| TC-GATE-006 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | Unreadable, torn, truncated, unresolvable-identity fixtures |
| TC-GATE-007 | `tests/behaviour/dispatch-dual-run-summary.test.ts` | `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` | To Implement | All-eleven fixture plus eleven removal mutants |
| TC-GATE-008 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | Three family fixtures; not-applicable baseline |
| TC-GATE-009 | `tests/behaviour/dispatch-gate-window.test.ts` | `bun test tests/behaviour/dispatch-gate-window.test.ts` | To Implement | Pre/post-incident fixture; resolved-divergence fixture |
| TC-GATE-010 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | Family sufficiency matrix |
| TC-HAND-001 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Unmet fixture; recording writers |
| TC-HAND-002 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Alpha-met/beta-unmet fixtures |
| TC-HAND-003 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Authoritative fixture; replay |
| TC-HAND-004 | `tests/structure/dispatch-authority-view.test.ts` | `bun test tests/structure/dispatch-authority-view.test.ts` | To Implement | Valid and degraded view fixtures; atomic writer |
| TC-HAND-005 | `tests/behaviour/dispatch-authority-view.test.ts` | `bun test tests/behaviour/dispatch-authority-view.test.ts` | To Implement | Dual-run fixture; merge and bash recorders |
| TC-HAND-006 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Two-repo fixtures; fallback identity case |
| TC-BASH-001 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Temp state root; sanitized PATH |
| TC-BASH-002 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Authoritative view fixture |
| TC-BASH-003 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Absent/broken/hanging CLI; degraded views |
| TC-BASH-004 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Twelve-cell matrix |
| TC-BASH-005 | `tests/structure/dispatch-bash-authority.test.ts` | `bun test tests/structure/dispatch-bash-authority.test.ts` | To Implement | Source scan; temp-copy mutant |
| TC-E2E-001 | `tests/conformance/dispatch/dispatch-e2e.test.ts` | `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` | To Implement | Controlled repo; injected ports; deterministic dates |
| TC-E2E-002 | `tests/conformance/dispatch/dispatch-e2e.test.ts` | `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` | To Implement | Handed-over controlled repo; bash runner |
| TC-E2E-003 | `tests/conformance/dispatch/dispatch-fixture.test.ts` | `bun test tests/conformance/dispatch/dispatch-fixture.test.ts` | To Implement | Fixture API guard; provenance counter |
| TC-MERGE-001 | `tests/behaviour/dispatch-merge-absence.test.ts` | `bun test tests/behaviour/dispatch-merge-absence.test.ts` | To Implement | Merge-ready truth; merge recorder |
| TC-MERGE-002 | `tests/behaviour/dispatch-merge-absence.test.ts` | `bun test tests/behaviour/dispatch-merge-absence.test.ts` | To Implement | Independently merged truth |
| TC-MERGE-003 | `tests/structure/dispatch-merge-boundary.test.ts`; `tests/structure/dispatch-imports.test.ts`; `tests/boundaries` | `bun test tests/structure/dispatch-merge-boundary.test.ts tests/structure/dispatch-imports.test.ts tests/boundaries` | To Implement | Dependency-cruiser rules; negative fixture |
| TC-MERGE-004 | `tests/structure/dispatch-composition.test.ts` | `bun test tests/structure/dispatch-composition.test.ts` | To Implement | Production composition dependency record |
| TC-DAEMON-001 | `tests/behaviour/dispatch-daemon-planner.test.ts` | `bun test tests/behaviour/dispatch-daemon-planner.test.ts` | To Implement | `LaneLaunchRequest`; descriptor; recording port |
| TC-DAEMON-002 | `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` | `bun test tests/conformance/dispatch/dispatch-daemon-lane.test.ts` | To Implement | Real planner/executor; scripted harness; temp lane ledger |
| TC-DAEMON-003 | `tests/behaviour/dispatch-daemonless.test.ts` | `bun test tests/behaviour/dispatch-daemonless.test.ts` | To Implement | No-daemon state; unavailable planner |
| TC-HELP-001 | `tests/structure/dispatch-help-inventory.test.ts`; `tests/checks/help-guide-coverage.test.ts`; `tests/checks/reference-page-parity.test.ts` | `bun test tests/structure/dispatch-help-inventory.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` | To Implement | Help inventory; reference page |
| TC-HELP-002 | `tests/behaviour/dispatch-help-version.test.ts` | `bun test tests/behaviour/dispatch-help-version.test.ts` | To Implement | Poisoned composer; recording ports |
| TC-HELP-003 | `tests/behaviour/entrypoint-composition.test.ts` (updated); `tests/conformance/pilot/pilot-isolation.test.ts` (updated); `tests/structure/harness-review-deferrals.test.ts` (updated) | `bun test tests/behaviour/entrypoint-composition.test.ts tests/conformance/pilot/pilot-isolation.test.ts tests/structure/harness-review-deferrals.test.ts` | Existing, updated | Updated expectations; deferral record |
| TC-PLANREC-001 | `tests/checks/dispatch-doc-conformance.test.ts` | `bun test tests/checks/dispatch-doc-conformance.test.ts` | To Implement | Stale and required phrase tables; file allowlist |
| TC-ERR-001 | `tests/behaviour/dispatch-error-envelope.test.ts` | `bun test tests/behaviour/dispatch-error-envelope.test.ts` | To Implement | Spawn-failure fixture; both tables |
| TC-ERR-002 | `tests/behaviour/dispatch-error-envelope.test.ts` | `bun test tests/behaviour/dispatch-error-envelope.test.ts` | To Implement | Unverifiable truth fixture; both tables |
| TC-ERR-003 | `tests/structure/dispatch-error-identity.test.ts` | `bun test tests/structure/dispatch-error-identity.test.ts` | To Implement | Delivered rows; kind-only negative case |
| TC-ERR-004 | `tests/golden/dispatch-errors.test.ts`; `tests/fixtures/dispatch/golden/` | `bun test tests/golden/dispatch-errors.test.ts` | To Implement | Error-envelope goldens |
| TC-ERR-005 | `tests/checks/error-table-sync.test.ts` | `bun test tests/checks/error-table-sync.test.ts` | Existing, updated | Temp-copy one-way drift mutants |
| TC-TOKEN-001 | `tests/structure/dispatch-token-home.test.ts`; `tests/structure/delivery-result-contract.test.ts` | `bun test tests/structure/dispatch-token-home.test.ts tests/structure/delivery-result-contract.test.ts` | Existing, verified | Taxonomy; second-list mutant |
| TC-TOKEN-002 | `tests/checks/exit-code-literals.test.ts` | `bun test tests/checks/exit-code-literals.test.ts` | Existing, updated | Exit-literal mutant |
| TC-NFR-001 | `tests/behaviour/dispatch-bounds.test.ts` | `bun test tests/behaviour/dispatch-bounds.test.ts` | To Implement | Maximum-size fixtures |
| TC-NFR-002 | `tests/behaviour/dispatch-bounds.test.ts` | `bun test tests/behaviour/dispatch-bounds.test.ts` | To Implement | Maximum-length text fixtures |
| TC-NFR-003 | `tests/behaviour/dispatch-bounds.test.ts` | `bun test tests/behaviour/dispatch-bounds.test.ts -t "@perf"` | To Implement | 5,000-record generated root; reference host metadata |
| TC-NFR-004 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | 5,001-record fixture |
| TC-NFR-005 | `tests/behaviour/dispatch-idempotency.test.ts` | `bun test tests/behaviour/dispatch-idempotency.test.ts` | To Implement | Replay harness; fixed clock/ids |
| TC-NFR-006 | `tests/behaviour/dispatch-privacy.test.ts`; `tests/checks/fixture-privacy.test.ts` | `bun test tests/behaviour/dispatch-privacy.test.ts tests/checks/fixture-privacy.test.ts` | To Implement | Canary corpus; fixture scan |
| TC-NFR-007 | `tests/behaviour/dispatch-privacy.test.ts`; `tests/behaviour/harness-spawn-env.test.ts` | `bun test tests/behaviour/dispatch-privacy.test.ts tests/behaviour/harness-spawn-env.test.ts` | Existing, verified | Parent environment canaries; allowlist |
| TC-DET-001 | `tests/behaviour/dispatch-determinism.test.ts` | `bun test tests/behaviour/dispatch-determinism.test.ts` | To Implement | Fixed state/clock/ids; model recorder |
| TC-REG-001 | Aggregate plus retained bash suites | `pnpm check` and `bash scripts/.tests/test-*.sh` | Existing, verified | None |

### 7.2 Execution Order

1. Static checks: `git diff --check`; markdown and YAML review for changed docs.
2. Structure, checks, and types: `bun test tests/structure tests/checks tests/types`.
3. Unit and behaviour: `bun test tests/behaviour`.
4. Golden: `bun test tests/golden`.
5. Conformance: `bun test tests/conformance/dispatch`.
6. Shell: `bash scripts/.tests/test-dispatch-bash-fallback.sh` plus the four retained suites.
7. Aggregate: `pnpm check`.
8. Performance (reference host): `bun test tests/behaviour/dispatch-bounds.test.ts -t "@perf"`.

### 7.3 Provisional Delivery Slices and Phase Mapping

The implementation plan (phase 4) will declare the real phases. This plan's provisional slices are a sequencing guide, not a delivery split; each slice must be independently green, and no AC-bearing behavior may be deferred into a "docs/tests only" phase.

| Provisional slice | Scope | TC IDs |
|---|---|---|
| A - Contracts and state | Token/gate declarations, record schemas, authority view, error rows, boundary rules | TC-DISP-008, TC-DISP-011, TC-DISP-012, TC-EVID-005, TC-ERR-001 through TC-ERR-005, TC-TOKEN-001, TC-TOKEN-002, TC-MERGE-003, TC-MERGE-004, TC-HAND-004 |
| B - One-shot core | Harness resolution, lease, spawn, liveness, classification, truth derivation, envelope, exits | TC-DISP-001 through TC-DISP-010, TC-TRUTH-001 through TC-TRUTH-006, TC-MERGE-001, TC-MERGE-002 |
| C - Resume and evidence | Resume modes, restart budget, economics, attempt and divergence records, false success, unevaluable | TC-RESUME-001 through TC-RESUME-004, TC-EVID-001 through TC-EVID-004, TC-NFR-006, TC-NFR-007, TC-DET-001 |
| D - Gate, handover, fallback | Window, floor, coverage, corroboration, summary, resolve, flip, revert, authority view, bash matrix | TC-GATE-001 through TC-GATE-010, TC-HAND-001, TC-HAND-002, TC-HAND-003, TC-HAND-005, TC-HAND-006, TC-BASH-001 through TC-BASH-005 |
| E - Daemon, registration, docs | Planner, executor, daemon lanes, daemonless path, prompt-required set, help, reference page, planning reconciliation, absence assertions | TC-DAEMON-001 through TC-DAEMON-003, TC-HELP-001 through TC-HELP-003, TC-PLANREC-001 |
| F - End-to-end and regression | Controlled repository proof, reversal proof, fixture guard, bounds, idempotency, aggregate gate | TC-E2E-001 through TC-E2E-003, TC-NFR-001 through TC-NFR-005, TC-REG-001 |

### 7.4 Entry and Exit Criteria

**Entry criteria (before delivery starts):**

- The change specification is approved and the DoR gate passes.
- The implementation plan names the dispatch composition, record kinds, gate predicate home, and test files consistently with Sections 1.5, 6.3, and 7.1.
- The dependency set (verify change, harness adapters, scheduling engine, resident daemon, state layer, economics, CLI composition) is present on the integration branch (D5).
- The controlled-repository fixture design is accepted: injected harness, tracker, CI, and state ports; no real remote or model.

**Exit criteria (before the change is done):**

- Every AC in Section 3.1 is `Covered` by a passing TC; zero unassigned rows; zero orphan TCs.
- Every must-pass TC passes; the six nice-to-have failures are triaged and recorded.
- `pnpm check` passes, including lint, format, typecheck, `bun test`, and boundaries.
- The four retained bash suites and the new bash matrix suite pass.
- The controlled-repository E2E proof runs evidence, eligibility, handover, authoritative dispatch, and reversal without hand-inserted evidence.
- The reference page and SC-M1-29/SC-M1-30 carry the amended bar; no other planning doc is edited.
- The F-9 deferral record carries the production-consumer outcome and a revisit trigger.
- The two new error rows are sync-checked in both directions; the two existing rows are unchanged.
- The execution log in Section 10 is populated with family-level commands and results, and pm-notes `notes:` carries the per-phase evidence.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|---|---|---|---|---|
| TR-1 | The stale two-week wording is implemented by mistake | H | H | `TC-GATE-003`, `TC-GATE-004`, `TC-GATE-005`, `TC-PLANREC-001`, and `TC-HAND-001` assert the four-condition bar; the reference page and the two scenarios are reconciled |
| TR-2 | The floor is misread as an alternative to class coverage, incident truth, or corroboration | H | M | One predicate, one fixture family, `TC-GATE-005` mutants; the floor-only sentence is asserted |
| TR-3 | An exit-0-with-no-artifact run is counted clean | H | M | `TC-TRUTH-001` plus `TC-EVID-003`; the attempt record must name the missing artifact |
| TR-4 | An uncorroborated success claim passes the gate | H | M | `TC-GATE-010` family matrix; `TC-EVID-003` contradiction; the token alone is never sufficient |
| TR-5 | Handover flips the wrong repository or leaks authority | H | L | `TC-HAND-006` two-repo isolation and the fallback identity case; every record carries repository identity |
| TR-6 | Reversal loses history or is not idempotent | M | M | `TC-HAND-003` append-only history and noop replay; `TC-NFR-005` |
| TR-7 | Bash fallback depends on the typed CLI | H | M | `TC-BASH-003`, `TC-BASH-005`; pure file read; typed CLI absent, broken, and hanging |
| TR-8 | Dispatch accidentally fires a merge | H | L | `TC-MERGE-001` through `TC-MERGE-004`; recording merge port; structural boundary check |
| TR-9 | Evidence records leak prompts, transcripts, or secrets | H | L | `TC-NFR-006`, `TC-NFR-007`, `TC-EVID-001`; canaries and the deny-by-default spawn environment |
| TR-10 | Daemon and one-shot paths classify the same evidence differently | M | M | `TC-DAEMON-002` compares final token and outcome; both paths use the same classifier |
| TR-11 | The controlled fixture hand-inserts evidence, making the E2E proof vacuous | H | M | `TC-E2E-003` fixture API guard and command-provenance count; the fixture exposes no ledger writer |
| TR-12 | The p95 latency gate is flaky on shared CI | M | M | `TC-NFR-003` keeps the bounded-read assertion in the default suite and measures p95 on the reference host; host metadata is recorded |
| TR-13 | The family comparison baseline is crossed, producing false divergences | M | M | `TC-GATE-008` rejects cross-family comparison and treats not-applicable as not-applicable |
| TR-14 | The two reconciled scenarios or the reference page drift back to the calendar proxy | M | L | `TC-PLANREC-001` scans for stale phrases and missing required phrases with the file named |
| TR-15 | The F-9 deferral is either silently resolved or left as a blanket absence claim | M | L | `TC-HELP-003` asserts a status, a production-consumer reason, and a revisit trigger, and rejects the blanket claim |
| TR-16 | Pre-session refusals are recorded inconsistently (attempt or envelope only) | M | L | OQ-T2 fixes the interpretation; `TC-DISP-002` asserts no success record and no authority change either way |

### 8.2 Assumptions

- The dependency set is delivered and stable on the integration branch (D5).
- The state layer admits the three additive record kinds and the derived document without a schema bump (DEC-18).
- Repository identity resolves from the scheduling engine's `repository` field, with a stable checkout-root digest fallback (DEC-13).
- The four bash entry points can read and parse the derived authority document with ordinary shell tooling and default to dual-run on any failure.
- A controlled fixture can exercise all eleven result classes and the floor without touching real pilot tickets.
- The real shared classifier is the only classification implementation; tests supply evidence, never classification.
- The test-facing names in Section 1.5 are the contract; the implementation plan may rename symbols but must update Section 7.1 and keep the scenarios binding.
- Goldens are byte-pinned and regenerated only by an explicit command with a reviewed diff.

### 8.3 Open Questions

| ID | Question | Proposed answer | Blocking? | Owner |
|---|---|---|---|---|
| OQ-T1 | What is the exact production path and encoding of the derived authority view? | The plan declares one path and schema; the test fixtures use `dispatch/authority.json` under the temp state root; bash reads the same document. | No; behavior is fixed, the path is a plan detail | engineering |
| OQ-T2 | Does a pre-session input refusal (unknown harness, lease conflict) append an attempt record? | No attempt record for refusals that never reach classification, because an attempt requires an engine outcome and token; the envelope is the record. `TC-DISP-002` asserts no success record and no authority change under either policy. | No; interpretation recorded | spec/plan owner |
| OQ-T3 | Is the p95 latency assertion gated on shared CI? | The bounded 5,000-record read is the default hard gate; p95 is measured on the declared reference host and recorded, with host metadata. | No; the AC bound is met on the reference host | engineering |
| OQ-T4 | Where does the resolution principal come from for `dispatch dual-run resolve`? | The delivered principal port; the fixture injects a fixed principal. | No | engineering |
| OQ-T5 | Is the F-9 deferral "resolved" or "resolved with follow-up"? | Either is accepted if the record names the production-consumer outcome and a revisit trigger; AC-F11-3 does not require full resolution. | No | engineering |
| OQ-T6 | Which planning files may the delivery edit? | Only the dispatch reference page and SC-M1-29/SC-M1-30. The ticket body and every other planning file remain unchanged and are reported. | No; review gate | pm |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-11-08 | test-plan-writer | Initial test plan derived from the GH-239 specification (47 ACs), PM decisions D1-D5, the M1 dispatch contract and reference page, TDR-0005/TDR-0010, seeded scenarios SC-M1-26..SC-M1-30, and the repository testing strategy. 78 TCs; 47/47 ACs covered; SC-M1-29/SC-M1-30 reconciled to the four-condition evidence bar. |

## 10. Test Execution Log

Populated during delivery. The per-phase command log is the `notes:` ledger in `chg-GH-239-pm-notes.yaml`; this table is the family-level summary. On disagreement, the pm-notes `notes:` entry and the raw log win.

| Family | Command | Tests | Result | Notes / Evidence |
|---|---|---|---|---|
| Contracts, state, error rows, boundaries | `bun test tests/structure tests/checks tests/types` | TBD | Not run | Slice A |
| One-shot dispatch and truth derivation | `bun test tests/behaviour/dispatch-*.test.ts` | TBD | Not run | Slice B |
| Resume and evidence | `bun test tests/behaviour/dispatch-resume*.test.ts tests/behaviour/dispatch-evid*.test.ts` | TBD | Not run | Slice C |
| Gate, handover, fallback | `bun test tests/behaviour/dispatch-gate*.test.ts tests/behaviour/dispatch-handover.test.ts tests/behaviour/dispatch-authority-view.test.ts`; `bash scripts/.tests/test-dispatch-bash-fallback.sh` | TBD | Not run | Slice D |
| Daemon, help, planning reconciliation | `bun test tests/behaviour/dispatch-daemon*.test.ts tests/structure/dispatch-help-inventory.test.ts tests/checks/dispatch-doc-conformance.test.ts` | TBD | Not run | Slice E |
| Controlled E2E and bounds | `bun test tests/conformance/dispatch tests/behaviour/dispatch-bounds.test.ts tests/behaviour/dispatch-idempotency.test.ts` | TBD | Not run | Slice F |
| Aggregate gate | `pnpm check` | TBD | Not run | Final |
| Reference-host performance | `bun test tests/behaviour/dispatch-bounds.test.ts -t "@perf"` | TBD | Not run | Record host metadata |
