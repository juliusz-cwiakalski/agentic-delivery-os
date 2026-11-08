---
id: chg-GH-239-test-plan
status: Updated
created: 2026-11-08T00:00:00Z
last_updated: 2026-11-08T13:00:00Z
owners: [engineering]
service: delivery-os dispatch engine
labels: [change, planning, m1, m1-s9, dispatch, dual-run, handover]
version_impact: minor
summary: "Eighty-two scenarios verifying GH-239: one-shot typed dispatch with harness resolution and lease claim, progress-based liveness, truth-bound token derivation, resume and restart economics, durable dual-run evidence carrying a declared evidence class and one comparison record, Appendix-G-pinned failure tokens and attempt-record policy, an incident-exclusive evidence window, a reachable four-condition handover gate with per-repository reversible handover and rename-invariant identity, CLI-independent bash fallback, daemon lane integration with an attempt record, dispatch registration and error identities, and a controlled-proof end-to-end proof that reaches eligibility with all eleven classes and never fires a merge. Every scenario declares its earliest executable phase and any cross-phase confirmation so phases 2-3 stay pure-domain/ledger-only and phase independence is truthful."
links:
  change_spec: ./chg-GH-239-spec.md
  implementation_plan: ./chg-GH-239-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S9: Dispatch engine: dual-run evidence and per-repo handover

## 1. Scope and Objectives

This plan protects the typed per-ticket dispatch loop and the evidence-based authority mechanism that lets one repository move from bash-authoritative to engine-authoritative and back. The core behaviors to protect are: (a) result derivation is bound to artifact, tracker, ledger, and CI truth rather than an exit code; (b) every dispatch that reaches classification leaves exactly one durable, bounded evidence record whose evidence class, comparison record, and corroboration fields are complete; (c) eligibility is a four-condition conjunction whose floor is the only place "whichever comes first" applies, whose class coverage is exposure rather than a success claim, and whose incident lower bound is exclusive so recovery is possible; (d) authority transfer is recorded, per-repository, reversible, and readable by the four bash entry points without invoking the typed CLI; and (e) dispatch never fires a merge.

The highest integrity risks are an exit-0-with-no-artifact run counted as clean, a false-success incident silently zeroed, an unresolved divergence dropped from eligibility, a gate made unreachable by treating rare classes as success claims, fixture or controlled-proof evidence counted as production evidence, a handover that flips the wrong repository or re-keys on a checkout rename, a bash fallback that breaks when the typed CLI is absent, and a corroboration claim accepted on the engine token alone. These are must-pass gates, not review notes. The change is proven on a controlled repository or injected fixture declaring `controlled-proof` evidence; no real repository is flipped and no evidence is hand-inserted into the ledger (D2, NG-1, NG-9, TDR-0015).

### 1.1 In Scope

- `dispatch REF`, including `--harness NAME` and `--resume-prompt TEXT`: harness resolution, repository lease claim, fresh spawn, resume, progress-based liveness, shared classification, truth-bound token derivation, exit projection, and the machine envelope.
- Pre-session refusals — unknown harness, rejected input, and a conflicting lease before any spawn — are envelope-only: they emit the classified envelope at exit 1 and append no attempt record (AC-F1-1, AC-F4-1, DEC-19).
- Attempt-stage failures are recorded attempts, never pre-session refusals: a harness spawn refusal (`noop-lane-permission`/`refused`), a spawn failure (`failed`/`failed`), a restart-budget refusal (`max-restarts`/`failed`), and a resume-economics refusal (`failed`/`failed`) each append exactly one attempt record at exit 1 with the comparison treatment pinned by Appendix G (AC-F2-4, AC-F4-1, AC-F12-1, AC-F12-2, DEC-19).
- Text mode's exactly four keys (`result=`, `pr_url=`, `exit_code=`, `last_message=`) in order, with no fifth key; the bash-internal `closeout_unverified=` is not emitted (DEC-8).
- The `outcome` field as mandatory envelope data beside `result`, and the TDR-0010 rule that harness-path `noop-lane-permission` means spawn-refused.
- Three additive state record kinds (`dispatch.attempt`, `dispatch.divergence`, `dispatch.handover`), their payload schemas, and the derived per-repository authority view (`delivery.dispatch.authority.v1`) including its fail-safe absent/unreadable/malformed default of `dual-run`.
- The declared `evidenceClass` on every attempt record (`pilot | controlled-proof | smoke | fixture`), attached at record creation from a declared invocation or composition input, immutable after append, and never inferred from the outcome; the counting rule that production handover counts only `pilot`, the controlled proof counts only `controlled-proof` in its own scope, and `smoke`/`fixture` never count (TDR-0015 §2).
- The one declared comparison record: class (`verify-change`, `tracker-truth`, or `not-applicable`), token or null, outcome (`match`, `mismatch`, or `not-applicable`), optional reason, and `urlResolved` for tracker facts; a divergence exists if and only if the outcome is `mismatch` (TDR-0015 §5).
- `dispatch dual-run summary --repo REPO`, `dispatch dual-run resolve DIVERGENCE_ID --note TEXT`, `dispatch handover REPO`, and `dispatch handover REPO --revert` (DEC-6, DEC-7).
- The four-condition gate: zero false-success incidents and zero unresolved divergences in the window; all eleven TDR-0005 classes covered as exposure; at least 20 counted dispatches or at least 7 consecutive UTC dates with at least one counted dispatch, whichever comes first, binding only the floor; corroboration from completed pm-notes phases, tracker state, and CI on the pushed head.
- Record-level degradation versus window-level unreadability: an attempt whose comparison or corroboration source cannot be read degrades only that record; an unreadable, torn, or truncated evidence-stream read makes eligibility unverifiable (TDR-0015 §1).
- Incident-exclusive window semantics: a false-success incident recorded at T is the exclusive lower bound, a record recorded exactly at T is excluded, post-incident recovery can reach eligibility, and a resolved divergence does not reset the window (DEC-10, TDR-0015 §3).
- Rename-invariant repository identity: the normalized scheduling `repository` key, then the normalized VCS remote, then a persisted first-use marker, with a clean refusal at exit 1 when none resolves and never a checkout-path digest presented as identity (DEC-13, TDR-0015 §6).
- Bash fallback in all four entry points (`deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, `ceo-loop.sh`) in dual-run, authoritative, and typed-CLI-absent conditions, with no new required arguments and no typed CLI invocation in the authority decision.
- Daemon lane integration: the production `LaneLaunchPlanner` and `createLaneExecutor` availability through the delivered `LaneExecutorPort`, the daemon path's final token, outcome, and attempt record, and the daemon-less one-shot path.
- Dispatch registration in the prompt-required composition, root and command help, the reference page, the two new error rows, and the retirement or inversion of the two production-surface absence assertions.
- The F-9 host-runner deferral revisit: the record states the production-consumer outcome and is no longer a blanket "no dispatch surface" claim.
- Story-owned planning reconciliation: the dispatch reference page and seeded scenarios SC-M1-29 and SC-M1-30 carry the amended four-condition bar, not the superseded calendar proxy.

### 1.2 Out of Scope and Known Gaps

- **No real repository flip and no real pilot evidence.** All end-to-end proof uses a controlled repository or injected fixture. Real evidence accrual starts after merge (NG-9, RSK-10).
- **No vocabulary change.** The eleven-token set, projection classes, derivation classes, TDR-0005, and TDR-0010 are unchanged; the plan asserts the closed set rather than proposing a twelfth token (NG-2).
- **No merge authority and no merge test of the merge command.** Dispatch is asserted to have no merge port or merge code path; the delivered `merge` behavior itself is out of scope (NG-3).
- **No coordinator supervision.** `ceo-loop.sh`'s loop-driving function belongs to M1-S23 (NG-4).
- **No tracker or PR label migration at handover**, no cross-host authority sharing, no containerized or remote lane execution, and no bash re-architecture (NG-5 through NG-8).
- **No evidence retention, compaction, pruning, or import of pre-dispatch bash logs** (NG-11, Section 7.3 of the spec).
- **No `doc/spec/**` current-truth reconciliation during delivery.** The only planned `doc/spec/**` edit is the two documented error rows in `doc/spec/features/feature-result-contract.md` that the two-way error-table sync mechanically requires; every other `doc/spec/**` change belongs to the `system_spec_update` phase (NG-10, AC-F12-1).
- **Only the story-owned reference page and SC-M1-29/SC-M1-30 may be reconciled.** The GH-239 ticket body, `backlog-ranking.md`, `roadmap.md`, `cli-command-registry.md`, milestone journeys, user journeys, and the operator-input record remain unchanged and are reported, not edited.
- **Reference-host latency is not a shared-CI wall-clock gate.** The p95 summary bound is measured on the declared reference host; the deterministic bounded-read assertion is the default-suite gate (see OQ-T3).
- **No historical evidence is imported or reclassified.** Bash delivery logs and tracker history before this change are not scored, and no record is backfilled into a counted evidence class (spec Section 19).
- **The `--evidence-class` surface and the persisted identity marker's storage name are implementation-plan details.** The plan declares one surface and one name; the scenarios assert the declared behavior, not a literal flag spelling (see OQ-T7 and OQ-T8).

### 1.3 Risk-Based Prioritization

**Must-pass (AC-gating).** A failure blocks delivery: `TC-DISP-001` through `TC-DISP-004`, `TC-DISP-006` through `TC-DISP-011`; `TC-TRUTH-001` through `TC-TRUTH-004`, `TC-TRUTH-006`; `TC-RESUME-001` through `TC-RESUME-004`; `TC-EVID-001` through `TC-EVID-007`; `TC-GATE-001` through `TC-GATE-011`; `TC-HAND-001` through `TC-HAND-007`; `TC-BASH-001` through `TC-BASH-005`; `TC-E2E-001`, `TC-E2E-002`; `TC-MERGE-001` through `TC-MERGE-004`; `TC-DAEMON-001` through `TC-DAEMON-003`; `TC-HELP-001` through `TC-HELP-003`; `TC-PLANREC-001`; `TC-ERR-001` through `TC-ERR-005`; `TC-TOKEN-001`, `TC-TOKEN-002`; `TC-NFR-001`, `TC-NFR-002`, `TC-NFR-003`, `TC-NFR-005`, `TC-NFR-006`, `TC-NFR-007`; `TC-REG-001`.

**Nice-to-have (supplemental).** A failure improves diagnosis or exposes over-generalization but does not reopen an AC whose primary evidence is elsewhere: `TC-DISP-005` (stall corner; AC-F1-2 also carried by `TC-DISP-003` and `TC-DISP-004`), `TC-DISP-012` (noop nothing-to-do negative control; AC-F2-4 also carried by `TC-DISP-008` and `TC-DISP-011`), `TC-TRUTH-005` (blocked tracker case; AC-F2-2 also carried by `TC-TRUTH-002` through `TC-TRUTH-004`), `TC-DET-001` (determinism control; AC-F11-2 also carried by `TC-HELP-002`), `TC-E2E-003` (hand-insertion and cross-class guard; AC-F8-1 and AC-F8-3 also carried by `TC-E2E-001` and `TC-GATE-011`), `TC-NFR-004` (truncation declaration; AC-F5-4 also carried by `TC-GATE-006`).

### 1.4 Binding Judgment Calls Enforced by This Plan

| # | Judgment call | Where enforced |
|---|---|---|
| 1 | Two surfaces beyond the synopsis exist: `dispatch handover REPO --revert` and `dispatch dual-run resolve DIVERGENCE_ID --note TEXT`. | `TC-HELP-001`, `TC-HAND-003`, `TC-EVID-002`, `TC-PLANREC-001` |
| 2 | Text mode emits exactly four keys; `closeout_unverified=` is not emitted; unverified state rides `pr-open-unverified` and `state-unverified`. | `TC-DISP-007`, `TC-DISP-011`, `TC-TRUTH-003`, `TC-TRUTH-006` |
| 3 | One declared comparison record per counted attempt; family-wise baseline; never compare a verify-change token against a `pr-open` result; a divergence exists if and only if the outcome is `mismatch`. | `TC-EVID-007`, `TC-GATE-008`, `TC-EVID-002` |
| 4 | `pr-open-unverified` corroborates on the tracker fact (PR open) with `urlResolved: false` as an attribute; it is not an unresolved divergence and not a permanently unsatisfied corroboration. | `TC-TRUTH-003`, `TC-GATE-007`, `TC-GATE-010` |
| 5 | `state-unverified` is exposure-only: it counts for class coverage, makes no success claim, creates no divergence, and does not by itself block eligibility; only that record degrades. | `TC-TRUTH-006`, `TC-EVID-004`, `TC-GATE-007` |
| 6 | A false-success incident at T is the exclusive lower bound; a record recorded exactly at T is excluded; post-incident re-accrual can reach eligibility; a resolved divergence does not reset the window. | `TC-EVID-003`, `TC-GATE-009` |
| 7 | Day floor = distinct UTC dates with at least one counted dispatch, in a run of at least 7 consecutive dates; "whichever comes first" binds only the floor. | `TC-GATE-003`, `TC-GATE-004`, `TC-GATE-005` |
| 8 | `outcome` is mandatory in envelope `data` beside `result`. | `TC-DISP-006`, `TC-DISP-011` |
| 9 | `dispatch.session.spawn-failed` exits 1 with token `failed`/outcome `failed`; `dispatch.state-unverified` exits 2 with token `state-unverified`; `dispatch.restart-budget-exceeded` exits 1 with `max-restarts`/`failed`; `dispatch.resume-uneconomical` exits 1 with `failed`/`failed`; existing dispatch rows are unchanged. | `TC-ERR-001`, `TC-ERR-002`, `TC-ERR-003`, `TC-RESUME-002`, `TC-RESUME-003` |
| 10 | Degraded exits are pinned: unreadable, torn, or malformed read exits 2; bounded-but-truncated valid read exits 0 with an unverifiable verdict; handover unreadable exits 2; handover readable-but-unmet exits 1. | `TC-GATE-006`, `TC-HAND-001`, `TC-NFR-004` |
| 11 | Story-owned planning reconciliation is limited to the reference page and SC-M1-29/SC-M1-30. | `TC-PLANREC-001` |
| 12 | The pilot-isolation test guards a deliberately reduced test-only fixture: it is not a production-surface absence claim, dispatch is not composed into it, and only its stale comment is narrowed. The two production-surface assertions (entrypoint composition, harness-review deferrals) are the only ones retired or inverted; F-9 still need not be fully resolved. | `TC-HELP-003` |
| 13 | Evidence class is declared, closed (`pilot`, `controlled-proof`, `smoke`, `fixture`), immutable, and never escalated; production counts only `pilot`, the controlled scope counts only `controlled-proof`, and `smoke`/`fixture` never count. | `TC-EVID-006`, `TC-GATE-011`, `TC-E2E-001`, `TC-E2E-003` |
| 14 | Pre-session refusals (unknown harness, rejected input, conflicting lease before a spawn) emit the classified envelope at exit 1 and append no attempt record (D6, DEC-19). A harness spawn refusal is not one of them: it is a recorded attempt. | `TC-DISP-002`, `TC-DISP-001`, `TC-DISP-011`, `TC-EVID-001` |
| 15 | Repository identity resolves in order from the normalized `repository` key, the normalized VCS remote, then a persisted first-use marker; a path digest is never presented as identity and an unresolvable identity refuses at exit 1. | `TC-HAND-007`, `TC-HAND-006`, `TC-GATE-006` |
| 16 | The controlled proof runs real state and command paths with injected harness, tracker, CI, and VCS ports under `controlled-proof` evidence, with a provenance guard; no real repository is flipped and no evidence is hand-inserted. | `TC-E2E-001`, `TC-E2E-002`, `TC-E2E-003` |
| 17 | `dispatch dual-run summary` exits 0 even when ineligible; handover refusal exits 1; noop reversal exits 0; the daemon path appends its own attempt record that agrees with one-shot dispatch. | `TC-GATE-002`, `TC-HAND-001`, `TC-HAND-003`, `TC-DAEMON-002` |
| 18 | Appendix G pins every failure class's result token, engine outcome, exit, attempt-record policy, and comparison treatment. No scenario invents a different pair or re-derives a comparison family. | `TC-EVID-001`, `TC-ERR-001`, `TC-ERR-002`, `TC-RESUME-002`, `TC-RESUME-003`, `TC-DISP-009`, `TC-DISP-011` |
| 19 | A harness spawn refusal (`noop-lane-permission`/`refused`) is a recorded attempt-stage failure, distinct from the three unrecorded pre-session refusals. Wording must never call a spawn refusal "pre-session". | `TC-DISP-011`, `TC-EVID-001`, `TC-DISP-002` |

### 1.5 Test-Facing Names and Test Infrastructure Summary

The scenarios below bind behavior, commands, outputs, records, and exits. They also name the following test-facing seams so implementation and tests cannot drift silently. If the implementation plan chooses different symbol names, only the names in Section 7 change; the scenarios and assertions stay binding.

| Surface | Name used in this plan |
|---|---|
| CLI | `dispatch`, `dispatch dual-run summary`, `dispatch dual-run resolve`, `dispatch handover`, `--revert` |
| Result derivation | `deriveDispatchResult(...)` |
| Failure classification | `classifyDispatchFailure(...)` |
| Gate predicate | `evaluateHandoverGate(...)` |
| Evidence fold | `foldEvidenceWindow(...)` |
| Evidence-class counting | `countedEvidenceClass(repositoryScope)` |
| Comparison record | `buildComparisonRecord(...)` |
| Repository identity | `resolveDispatchIdentity(checkout)` |
| Authority read | `readDispatchAuthority(stateRoot, repository)` |
| Attempt append | `appendDispatchAttempt(...)` |
| Divergence append | `appendDispatchDivergence(...)`, `resolveDispatchDivergence(...)` |
| Handover append | `appendDispatchHandover(...)` |
| Lane planning and execution | `planLaneLaunch(request)`, `createLaneExecutor(...)`, `runSupervisionCycle(...)` |
| Record schemas | `delivery.dispatch.attempt.v1`, `delivery.dispatch.divergence.v1`, `delivery.dispatch.handover.v1`, `delivery.dispatch.authority.v1` |
| Derived authority view fixture path | `dispatch/authority.json` under the temporary state root (the plan declares the production path; bash reads the same document) |

Test infrastructure in one paragraph: every TypeScript scenario runs in process with `bun:test` through `runEntrypoint` and injected `CliDependencies`; the harness session port is a scripted fake that supplies neutral evidence and the **real** shared classifier is used, so classification is never faked; tracker, CI, and VCS reads are injected read ports with recording fakes and deterministic truth fixtures; state is the real store over the existing test edge with fault injection for torn/failed appends and for one deliberately unreadable truth read; the clock, run-id sequence, and repository identities are injected, and the evidence class is a declared composition input rather than a test-side record field; the controlled-proof composition declares `controlled-proof` and its provenance guard counts command-originated appends; no test touches the live state directory, a live remote, the network, or a model. Bash scenarios run the four scripts against a temporary state root and a sanitized `PATH`, with the typed binary absent or present as the condition requires.

## 2. References

- Change specification: [chg-GH-239-spec.md](./chg-GH-239-spec.md) (Section 5.1 F-1 through F-12, Section 17 acceptance criteria — 53 ACs, Section 17.1 Definition of Done, Section 8.3 DM-1/DM-6/DM-7, Appendix B gate predicate, Appendix C seeded inheritance, Appendix D bash-continuity summary).
- Implementation plan: `./chg-GH-239-plan.yaml` (this plan names behavior, commands, record shapes, and fixture contracts, not final internal code paths; phase 9 owns the daemon-path attempt-record producer).
- Handover-gate operational semantics: [TDR-0015](../../../decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md) (gate reachability, evidence class, exclusive window, floor, comparison shape, identity, reversal).
- PM binding decisions D1-D6: [chg-GH-239-pm-notes.yaml](./chg-GH-239-pm-notes.yaml).
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

All 53 acceptance criteria are covered. There are zero unassigned rows and zero unassigned ACs.

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | Harness from flag then config; repository lease claimed; fresh spawn; exactly one attempt record once classification is reached; unknown harness, rejected input, or conflicting lease before a spawn emits the classified envelope at exit 1 and appends no attempt record | TC-DISP-001, TC-DISP-002 | Covered |
| AC-F1-2 | Progress signals keep a session live; absent readings stay absent or unknown; stall needs no progress across two sourced evaluations, never elapsed time alone | TC-DISP-003, TC-DISP-004, TC-DISP-005 | Covered |
| AC-F1-3 | One of eleven tokens; `partial` carries `outcome`; envelope data carries the declared fields; text emits exactly four ordered keys | TC-DISP-006, TC-DISP-007, TC-DISP-008, TC-DISP-011 | Covered |
| AC-F1-4 | Full exit projection; failing run still emits a valid envelope with full error fields | TC-DISP-009, TC-DISP-010 | Covered |
| AC-F2-1 | Exit-0 with no branch commit, PR, or ledger progress is `failed` at exit 1; missing artifact named | TC-TRUTH-001 | Covered |
| AC-F2-2 | Open PR, unresolvable URL, already merged, blocking tracker map to the four tokens; `merged` only after independent observation; tracker-derived tokens corroborated by the tracker fact; `pr-open-unverified` records `urlResolved: false` and is not a divergence; missing tracker fact never clean | TC-TRUTH-002, TC-TRUTH-003, TC-TRUTH-004, TC-TRUTH-005 | Covered |
| AC-F2-3 | Unreadable ledger, tracker, artifact, or state read is `state-unverified` at exit 2 with a classified identity and remediation hint | TC-TRUTH-006 | Covered |
| AC-F2-4 | No token outside the eleven; `noop-lane-permission` is spawn-refused, recorded as an attempt with token `noop-lane-permission`/outcome `refused` at exit 1; `noop-lane-nothing-to-do` only when no work remains | TC-DISP-008, TC-DISP-011, TC-DISP-012 | Covered |
| AC-F3-1 | Resume records the mode, skips completed phases, continues from the ledger; no injection means `resume-prompt-reentry` with prefill cost acknowledged | TC-RESUME-001 | Covered |
| AC-F3-2 | At `lane.restart-budget`, another restart refuses at exit 1 with `dispatch.restart-budget-exceeded`, token `max-restarts`/outcome `failed`, one attempt record, terminal record, escalation, no spawn, no requeue | TC-RESUME-002 | Covered |
| AC-F3-3 | Uneconomical prefill refuses with `dispatch.resume-uneconomical`, token `failed`/outcome `failed`, one attempt record; unreadable cost facts refuse; attach-and-continue consumes no ordinal | TC-RESUME-003 | Covered |
| AC-F3-4 | Identical resume replay consumes no duplicate ordinal, re-executes no phase, and does not spawn twice | TC-RESUME-004 | Covered |
| AC-F4-1 | Exactly one complete attempt record per dispatch that reaches classification, carrying evidence class and comparison record; every attempt-stage failure (including a spawn refusal) appends one with its Appendix G pair; only the three pre-session refusals append none; no prompt, transcript, credential, or raw payload | TC-EVID-001, TC-EVID-005, TC-DISP-002, TC-DISP-011 | Covered |
| AC-F4-2 | Comparison disagreement opens a divergence; resolution folds to resolved; the original open record remains; the summary reports both totals | TC-EVID-002, TC-EVID-007, TC-GATE-008 | Covered |
| AC-F4-3 | A contradicted success claim is a false-success incident with bounded evidence; never clean; its timestamp is the exclusive window lower bound, so floor and coverage re-accrue strictly after it | TC-EVID-003, TC-GATE-009 | Covered |
| AC-F4-4 | An unreadable comparison or corroboration source degrades only that attempt: a non-success token still counts for coverage and does not block; an uncorroborated success claim is one named unmet condition without a divergence or window reset; a window-level unreadable, torn, or truncated read is unverifiable and declared | TC-EVID-004, TC-TRUTH-006, TC-GATE-006 | Covered |
| AC-F4-5 | Exactly one declared `evidenceClass` (`pilot`, `controlled-proof`, `smoke`, `fixture`) attached at record creation from a declared input, never inferred, never read from user-editable content, immutable, not escalatable; production counts only `pilot` | TC-EVID-006, TC-GATE-011, TC-E2E-001 | Covered |
| AC-F4-6 | Comparison record shape: class, token or null, outcome; token null iff not-applicable; outcome not-applicable iff class; divergence iff mismatch; `pr-open-unverified` compares to tracker truth `pr-open` with `urlResolved`; dispatch-session tokens are not-applicable and exposure-only | TC-EVID-007, TC-GATE-008 | Covered |
| AC-F5-1 | Summary reports window start and reason, days, counted deliveries, evidence classes counted and exclusions, incidents, divergences and identifiers, class coverage with missing classes, corroboration, verdict | TC-GATE-001, TC-GATE-009, TC-GATE-011 | Covered |
| AC-F5-2 | Eligibility is the four-condition conjunction; coverage is exposure so `state-unverified` and dispatch-session tokens count without blocking; every unmet condition is named | TC-GATE-002, TC-GATE-005, TC-GATE-007, TC-GATE-008, TC-GATE-010 | Covered |
| AC-F5-3 | 20 counted dispatches or 7 consecutive UTC dates, whichever comes first; floor-only | TC-GATE-003, TC-GATE-004, TC-GATE-005 | Covered |
| AC-F5-4 | Unreadable, torn, or malformed evidence read exits 2 with `dispatch.state-unverified` or `state.*`; a bounded-but-truncated valid read exits 0 with a false/unverifiable verdict, declared truncation, and every unmet condition named; no fabricated zeros; an unresolvable repository identity refuses cleanly at exit 1 | TC-GATE-006, TC-NFR-004 | Covered |
| AC-F5-5 | Controlled-scope reachability: all eleven classes present — including `state-unverified` (exposure-only) and `pr-open-unverified` (tracker-corroborated, `urlResolved: false`) — with zero incidents, zero unresolved divergences, floor met, and every success claim corroborated yields eligibility true with no unmet condition | TC-GATE-007, TC-E2E-001 | Covered |
| AC-F5-6 | Incident at T is the exclusive lower bound (`windowStart = T`, `windowStartReason = false-success-incident-reset`), the incident and any same-instant record are outside the window, and sufficient post-T evidence yields eligibility true | TC-GATE-009, TC-EVID-003 | Covered |
| AC-F6-1 | Readable-but-unmet bar refuses at exit 1 as a clean verification negative, names every unmet condition, appends no authority-changing record, leaves bash authoritative; an unreadable or torn read refuses at exit 2 with a classified identity and appends no authority-changing record | TC-HAND-001 | Covered |
| AC-F6-2 | Met gate appends one handover record, flips only the repository identified by the resolved identity, updates the view atomically, reports reversible; other repositories stay dual-run | TC-HAND-002, TC-HAND-006, TC-HAND-007 | Covered |
| AC-F6-3 | Reversal appends a reversal record, restores dual-run, preserves history; already dual-run is an idempotent noop at exit 0 | TC-HAND-003 | Covered |
| AC-F6-4 | Derived view matches the folded ledger, names the resolved repository identity, authority, handover reference, time, reversal availability; atomic; absent, unreadable, or malformed means dual-run | TC-HAND-004, TC-HAND-007 | Covered |
| AC-F6-5 | Dual-run dispatch reports `handoverState: dual-run`, records evidence, claims no authority, blocks no bash path, fires no merge | TC-HAND-005 | Covered |
| AC-F6-6 | A persisted identity binding survives a checkout rename, a remote change, and a restart without re-keying; with no scheduler key, remote, or persisted marker, summary and handover refuse cleanly at exit 1 and never present a checkout-path digest | TC-HAND-007 | Covered |
| AC-F7-1 | Dual-run bash entry points keep arguments and exit behavior, print no deprecation pointer, need no typed CLI | TC-BASH-001 | Covered |
| AC-F7-2 | Authoritative bash entry points print a deprecation pointer naming `dispatch` and reversal, remain executable | TC-BASH-002 | Covered |
| AC-F7-3 | Typed CLI absent or broken: bash runs normally; pure file read; absent, unreadable, or malformed view means dual-run | TC-BASH-003, TC-BASH-005 | Covered |
| AC-F8-1 | A controlled repository scope runs the real state store and command path with injected external ports: `controlled-proof` dispatches accrue to eligibility, the repository flips, a later dispatch runs end to end, and a provenance guard proves no hand-inserted evidence | TC-E2E-001, TC-E2E-003 | Covered |
| AC-F8-2 | Reversal returns the repository to dual-run, bash runs normally, handover and reversal records remain | TC-E2E-002 | Covered |
| AC-F8-3 | Production counts zero non-`pilot` attempts; the controlled scope counts zero non-`controlled-proof` attempts; a controlled-proof attempt under a production identity is surfaced and not counted; `smoke` and `fixture` count toward no handover | TC-GATE-011, TC-E2E-001, TC-E2E-003 | Covered |
| AC-F9-1 | Merge-ready PR emits `pr-open` or `pr-open-unverified` and fires no merge; structural boundary proves no merge path | TC-MERGE-001, TC-MERGE-003 | Covered |
| AC-F9-2 | Already-merged PR may report `merged` as detection with observed evidence; still no merge | TC-TRUTH-004, TC-MERGE-002 | Covered |
| AC-F10-1 | Planner returns the lifecycle prompt and declared environment allowlist; resolves no secret; executor reports available | TC-DAEMON-001 | Covered |
| AC-F10-2 | Daemon starts, records, observes, collects, and resumes a lane; final token and outcome agree with one-shot, and the daemon path appends one attempt record that agrees with the one-shot record | TC-DAEMON-002 | Covered |
| AC-F10-3 | With no daemon, dispatch completes from state, appends the record, claims no daemon dependency; unavailable planner means supervise-only | TC-DAEMON-003 | Covered |
| AC-F11-1 | Dispatch present in prompt-required set, root and command help, and reference page with three execution forms plus resolution and reversal; page describes the evidence-based handover bar | TC-HELP-001, TC-PLANREC-001 | Covered |
| AC-F11-2 | Help and version perform no state, network, git, configuration, or model read and exit 0 | TC-HELP-002, TC-DET-001 | Covered |
| AC-F11-3 | The two production-surface absence assertions are retired or inverted; the pilot-isolation test keeps its deliberately reduced test-only fixture with a narrowed comment and is not required to compose dispatch; F-9 records the production-consumer outcome | TC-HELP-003 | Covered |
| AC-F12-1 | Spawn failure is `dispatch.session.spawn-failed` at exit 1 with token `failed`/outcome `failed` and exactly one attempt record; unverifiable truth is `dispatch.state-unverified` at exit 2 with token `state-unverified`; both tables carry both rows (Appendix G) | TC-ERR-001, TC-ERR-002, TC-ERR-005 | Covered |
| AC-F12-2 | Existing dispatch rows unchanged; restart-budget refusal emits token `max-restarts`/outcome `failed` at exit 1 with exactly one attempt record; resume-economics refusal emits token `failed`/outcome `failed` at exit 1 with exactly one attempt record; exact-code resolution; no kind-only single-row assumption (Appendix G) | TC-ERR-003, TC-ERR-005, TC-REG-001, TC-RESUME-002, TC-RESUME-003 | Covered |
| AC-F12-3 | Every dispatch failure envelope carries a stable code, category, retryable flag, consequence, remediation hint, and summary; no prose identity; exit in 0, 1, 2 | TC-DISP-010, TC-ERR-004 | Covered |
| AC-NFR1-1 | Emitted token set is a subset of the eleven; no token literal outside the contracts home; no call-site exit literal outside the projection | TC-TOKEN-001, TC-TOKEN-002, TC-DISP-008, TC-REG-001 | Covered |
| AC-NFR4-1 | Bounded read; truncation declared; machine output at most 65,536 bytes; human output at most 40 lines and 8,192 bytes; p95 summary within 5 s on the reference host | TC-NFR-001, TC-NFR-002, TC-NFR-003, TC-NFR-004 | Covered |
| AC-NFR6-1 | Replaying summary, handover, reversal, or resume appends no duplicate record; authority unchanged; noop reported | TC-NFR-005, TC-RESUME-004, TC-HAND-003 | Covered |
| AC-NFR7-1 | No secret, credential, prompt, transcript, diff, or raw payload in output, records, help, or logs; child environment variables are all declared | TC-NFR-006, TC-NFR-007, TC-EVID-001 | Covered |
| AC-NFR8-1 | Four scripts across dual-run, authoritative, and typed-CLI-absent all complete with declared behavior and no new required argument | TC-BASH-004 | Covered |
| AC-NFR9-1 | No merge executor, port, or invocation reachable from dispatch composition; a source-level merge import fails the boundary check | TC-MERGE-003, TC-MERGE-004 | Covered |

Traceability statement: all 53 ACs map to at least one TC; every TC in Section 5 maps to at least one AC (zero orphan TCs); the 82 TCs are enumerated in the Section 5.1 index, the Section 7.1 mapping, and the Section 7.5 per-phase executability table. No TC ID was split in this revision; mixed-layer TCs declare explicit per-phase executable slices so a phase-2 or phase-3 green claim never depends on a phase-4 command, a phase-6 summary, or a phase-8 bash surface. The two newly traced classes — `state-unverified` and `pr-open-unverified` — are covered positively by `TC-GATE-007` and `TC-E2E-001` and negatively by `TC-TRUTH-003`, `TC-TRUTH-006`, and `TC-EVID-004`.

#### 3.1.1 Seeded Scenario Inheritance (SC-M1-26 through SC-M1-30)

| Seeded scenario | Inherited assertion | TC ID(s) | Reconciliation note |
|---|---|---|---|
| SC-M1-26 | Happy path classifies `pr-open`; the four key=value keys match the bash shape; token parity with TDR-0005 | TC-TRUTH-002, TC-DISP-007 | Unchanged in substance. The attempt record with its evidence class, comparison record, and the mandatory `outcome` field are additive. |
| SC-M1-27 | Exit-0-with-no-artifact classifies `failed` at exit 1 and names the missing artifact | TC-TRUTH-001 | Unchanged. The attempt record adds the durable incident and evidence fields. |
| SC-M1-28 | Resume records `resume-prompt-reentry`, acknowledges prefill cost, and does not re-execute completed phases | TC-RESUME-001 | Unchanged. The resume mode also rides the attempt record. |
| SC-M1-29 | Handover flips one repository and leaves the other authoritative state untouched | TC-HAND-001, TC-HAND-002, TC-HAND-006, TC-HAND-007, TC-E2E-001, TC-E2E-002, TC-BASH-001, TC-BASH-002 | **Reconciled.** The seeded parenthetical "two weeks, zero false-success, zero unresolved divergences" is superseded by the four-condition bar (DEC-1). The tests assert the evidence gate (truth, coverage as exposure, floor-only, corroboration), rename-invariant per-repository isolation, and the controlled-proof path, never a calendar proxy. Delivery must edit SC-M1-29's wording in `test-scenarios.md` (story-owned) to name the four-condition bar; no other planning doc is edited. |
| SC-M1-30 | Summary counts days, deliveries, incidents, divergences, and states eligibility; an unresolved divergence blocks | TC-GATE-001, TC-GATE-002, TC-GATE-003, TC-GATE-004, TC-GATE-005, TC-GATE-007, TC-GATE-009, TC-GATE-011 | **Reconciled.** The seeded "fourteen days" and "eligibility logic = clean window met" wording is superseded. The summary additionally reports window start and reason, class coverage as exposure, evidence classes counted with cross-class exclusions, corroboration of success claims only, and named unmet conditions; the floor is the only either/or. Delivery must edit SC-M1-30's wording in `test-scenarios.md` (story-owned); no other planning doc is edited. |

Inheritance rule: this plan inherits all five scenarios and may extend them. It does not weaken any inherited assertion. The two reconciled scenarios are the only planning surfaces this story may edit; `TC-PLANREC-001` asserts the reconciled content, and the "no other planning doc edited" obligation is a review gate recorded in Section 8. This test-plan author does not edit `test-scenarios.md`: the two-scenario reconciliation is a delivery action owned by the story and is a named dependency in the final report.

### 3.2 Interface Coverage (EVT-#, DM-#)

| Interface | Element | TC ID(s) | Evidence |
|---|---|---|---|
| EVT-1 | `dispatch.attempt` record, schema `delivery.dispatch.attempt.v1`, appended once per dispatch that reaches classification under the fence; the three pre-session refusals append none; every attempt-stage failure appends one with its Appendix G pair; carries `evidenceClass` and the comparison record | TC-EVID-001, TC-EVID-005, TC-EVID-006, TC-EVID-007, TC-DISP-002, TC-DISP-011 | Record count, field completeness, declared evidence class, comparison shape, Appendix G token/outcome pair, canary absence, fenced append and torn-read behavior |
| EVT-2 | `dispatch.divergence` record, schema `delivery.dispatch.divergence.v1`, open then resolved, never rewritten or deleted; appended if and only if a comparison outcome is `mismatch` | TC-EVID-002, TC-EVID-007 | Open record retained after resolution; latest-per-divergence fold; summary totals; no divergence for `match` or `not-applicable` |
| EVT-3 | `dispatch.handover` record, schema `delivery.dispatch.handover.v1`, flip and reversal, conditions snapshot and evidence references, resolved repository identity | TC-HAND-002, TC-HAND-003, TC-HAND-004, TC-HAND-007 | Record count, snapshot fields, history retention, folded latest per repository |
| DM-1 | Dispatch attempt record fields, including `evidenceClass`, comparison record (class, token or null, outcome, reason, `urlResolved`), and tri-state corroboration | TC-EVID-001, TC-EVID-006, TC-EVID-007, TC-TRUTH-001, TC-TRUTH-003, TC-TRUTH-006 | Field-level assertions and schema validation |
| DM-2 | Divergence record state vocabulary and bounded resolution note | TC-EVID-002, TC-EVID-007 | `open` then `resolved`; principal and timestamp; bounded note; divergence-iff-mismatch |
| DM-3 | Handover record operations and conditions snapshot | TC-HAND-002, TC-HAND-003 | `authoritative` then `dual-run`; snapshot present |
| DM-4 | Derived repository authority view; derived from the folded ledger; absent or unreadable means dual-run | TC-HAND-004, TC-HAND-005, TC-HAND-007, TC-BASH-003 | Field assertions, atomic replacement, fail-safe default, resolved identity |
| DM-5 | Dispatch envelope data, including mandatory `outcome` | TC-DISP-006, TC-DISP-009, TC-DISP-010 | Key set, token/exit matrix, failure envelope |
| DM-6 | Dual-run summary data: window start and reason, counts, evidence classes counted and cross-class exclusions, class coverage as exposure, corroboration, verdict, unmet conditions | TC-GATE-001, TC-GATE-006, TC-GATE-011 | Text and envelope assertions against the summary fixture set |
| DM-7 | Handover gate predicate, one declared home shared by summary and handover; the comparison record shape and evidence-class counting rule are declared with it | TC-GATE-002, TC-GATE-005, TC-GATE-007, TC-GATE-011, TC-HAND-001 | Same fixture yields the same verdict from both surfaces; one counting rule and one comparison shape |
| DM-8 | Corroboration evidence set: completed phases, tracker state, CI on pushed head; family-wise sufficiency; `pr-open-unverified` corroborates on the tracker fact; non-success tokens satisfy it vacuously | TC-GATE-008, TC-GATE-010, TC-EVID-003, TC-TRUTH-003 | Per-family sufficiency matrix and contradiction detection |
| Section 8.5 | Backward compatibility: four bash keys, retained error rows, bash arguments and exits | TC-DISP-007, TC-ERR-003, TC-BASH-001 | Golden keys, unchanged rows, unchanged script behavior |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Token and exit closure; no call-site exit literal | TC-DISP-008, TC-DISP-009, TC-TOKEN-001, TC-TOKEN-002, TC-ERR-004 | Covered |
| NFR-2 | Progress-based liveness truth; absent readings never zero; cadence from policy | TC-DISP-003, TC-DISP-004, TC-DISP-005 | Covered |
| NFR-3 | Determinism and zero model calls in help, summary, gate, classification, and render | TC-HELP-002, TC-DET-001 | Covered |
| NFR-4 | Bounded reads and output; declared truncation with a non-eligible verdict | TC-NFR-001, TC-NFR-002, TC-NFR-003, TC-NFR-004, TC-GATE-006 | Covered |
| NFR-5 | Durable fenced appends; no clean verdict from a torn or unreadable read; atomic derived view | TC-EVID-005, TC-EVID-004, TC-TRUTH-006, TC-HAND-004, TC-GATE-006 | Covered |
| NFR-6 | Idempotent convergence | TC-NFR-005, TC-RESUME-004, TC-HAND-003 | Covered |
| NFR-7 | Secret containment and deny-by-default spawn environment | TC-NFR-006, TC-NFR-007, TC-EVID-001 | Covered |
| NFR-8 | Bash fallback compatibility in all four entry points | TC-BASH-001, TC-BASH-002, TC-BASH-003, TC-BASH-004, TC-BASH-005 | Covered |
| NFR-9 | Merge absence: no port, no code path, boundary check | TC-MERGE-001, TC-MERGE-002, TC-MERGE-003, TC-MERGE-004 | Covered |
| NFR-10 | Evidence completeness: declared evidence class, comparison record, and tri-state corroboration on every counted dispatch; zero non-`pilot` production counts; zero out-of-scope `controlled-proof` counts; no omitted unresolved divergence | TC-EVID-001, TC-EVID-002, TC-EVID-004, TC-EVID-006, TC-EVID-007, TC-GATE-007, TC-GATE-010, TC-GATE-011 | Covered |

## 4. Test Types and Layers

| Layer | Framework / location | Purpose in this change |
|---|---|---|
| Unit / pure domain | `bun:test`, `tests/behaviour/dispatch-*.test.ts` importing `packages/core/src/domain` | Token derivation, liveness assembly, gate predicate, window fold (inclusive/exclusive bounds), evidence-class counting, comparison record shape, family comparison, classification dispatch. No I/O. |
| Behaviour | `bun:test`, `tests/behaviour/dispatch-*.test.ts`, in-process `runEntrypoint` with injected dependencies | Command-level dispatch, summary, resolve, handover, reversal, help, error envelopes, idempotency, privacy, bounds, pre-session refusal envelopes, identity resolution. |
| Structure | `bun:test`, `tests/structure/dispatch-*.test.ts` | Contracts (record kinds, payload schemas, evidence-class closure, comparison record shape, gate predicate home), composition membership, import boundaries, merge absence, token and exit literal homes. |
| Types | `bun:test` type tests, `tests/types/dispatch-contract.type-test.ts` | Compile-time shape of attempt, comparison record, divergence, handover, authority view, summary, and envelope data. |
| Repository invariants | `bun run scripts/checks/*.ts`, mutation-tested by `tests/checks/*.test.ts` | Error-table sync, exit-code literals, help/guide coverage, reference-page parity, doc conformance for the story-owned planning surfaces, privacy scans, boundary checks. |
| Golden | `bun:test`, `tests/golden/dispatch-*.test.ts` over committed fixtures | Byte-pinned four-key text, summary text, handover text, error envelopes. |
| Conformance / integration | `bun:test`, `tests/conformance/dispatch/*.test.ts` | Controlled-proof end-to-end proof with a provenance guard, daemon lane cycle with its attempt record, bash matrix over temporary state roots. |
| Shell | `bash scripts/.tests/test-dispatch-bash-fallback.sh` plus the four retained script suites | Four scripts x three authority conditions, typed CLI absence, no new arguments. |
| Performance | `bun:test` tagged `@perf` in `tests/behaviour/dispatch-bounds.test.ts` | 5,000-record summary read and p95 latency on the reference host; deterministic bounded-read assertion stays in the default suite. |
| Manual | Review checklist in the PR | Reference-page readability, F-9 deferral wording, planning-scope diff, no real repository flip, pilot fixture left reduced. |

Test IDs follow `TC-FEATURE-NNN`. Each test file carries its TC IDs in a header comment so traceability survives file moves. Fixtures are never named `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Test Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-DISP-001 | Harness resolution, lease claim, fresh spawn, one attempt record | Happy Path | Behaviour | High | AC-F1-1, AC-F4-1 |
| TC-DISP-002 | Pre-session refusal: classified envelope and no attempt record | Negative | Behaviour | High | AC-F1-1, AC-F4-1 |
| TC-DISP-003 | Progress signals keep a session live | Happy Path | Unit | High | AC-F1-2, NFR-2 |
| TC-DISP-004 | Absent liveness readings stay unknown | Corner Case | Unit | High | AC-F1-2, NFR-2 |
| TC-DISP-005 | Stall requires two sourced evaluations | Edge Case | Unit | Medium | AC-F1-2, NFR-2 |
| TC-DISP-006 | Machine envelope shape and mandatory outcome | Happy Path | Behaviour | High | AC-F1-3, DM-5 |
| TC-DISP-007 | Text mode emits exactly four ordered keys | Happy Path | Golden | High | AC-F1-3, AC-F2-4, NFR-1 |
| TC-DISP-008 | Emitted token set stays inside the eleven | Negative | Structure | High | AC-F1-3, AC-F2-4, AC-NFR1-1 |
| TC-DISP-009 | Exit projection matrix by token | Happy Path | Unit | High | AC-F1-4, NFR-1 |
| TC-DISP-010 | Failing run still emits a complete error envelope | Negative | Behaviour | High | AC-F1-4, AC-F12-3 |
| TC-DISP-011 | `partial` carries outcome; a harness spawn refusal is a recorded `noop-lane-permission`/`refused` attempt | Corner Case | Unit | High | AC-F1-3, AC-F2-4, AC-F4-1 |
| TC-DISP-012 | `noop-lane-nothing-to-do` only with no remaining work | Negative | Unit | Medium | AC-F2-4 |
| TC-TRUTH-001 | Exit-0 with no artifact is `failed` | Negative | Unit | High | AC-F2-1 |
| TC-TRUTH-002 | Open PR is `pr-open` with a tracker-truth match | Happy Path | Unit | High | AC-F2-2, AC-F4-6 |
| TC-TRUTH-003 | Unresolvable PR URL is `pr-open-unverified`, corroborated by the tracker fact | Edge Case | Unit | High | AC-F2-2, AC-F4-6, AC-F5-2 |
| TC-TRUTH-004 | Already-merged PR is detection-only `merged` | Edge Case | Unit | High | AC-F2-2, AC-F9-2 |
| TC-TRUTH-005 | Blocking tracker state is `blocked`; missing fact is not success | Negative | Unit | Medium | AC-F2-2 |
| TC-TRUTH-006 | `state-unverified` degrades one record, not the window | Negative | Unit | High | AC-F2-3, AC-F4-4, AC-F5-2 |
| TC-RESUME-001 | Resume prompt records re-entry mode and skips completed phases | Happy Path | Behaviour | High | AC-F3-1 |
| TC-RESUME-002 | Restart budget exhaustion refuses loudly and never requeues | Negative | Behaviour | High | AC-F3-2 |
| TC-RESUME-003 | Resume economics refuses uneconomical re-pay | Negative | Behaviour | High | AC-F3-3 |
| TC-RESUME-004 | Identical resume replay converges without a second effect | Regression | Behaviour | High | AC-F3-4, AC-NFR6-1 |
| TC-EVID-001 | Exactly one complete attempt record per classified dispatch | Happy Path | Ledger | High | AC-F4-1, AC-NFR7-1, NFR-10 |
| TC-EVID-002 | Divergence opens on disagreement and resolves append-only | Happy Path | Behaviour | High | AC-F4-2, AC-F4-6 |
| TC-EVID-003 | False success is recorded; the incident resets the exclusive window | Negative | Behaviour | High | AC-F4-3, AC-F5-6 |
| TC-EVID-004 | Record-level degradation versus window-level unverifiability | Negative | Behaviour | High | AC-F4-4, AC-F5-4 |
| TC-EVID-005 | Fenced append and torn reads never become clean | Negative | Behaviour | High | AC-F4-1, NFR-5 |
| TC-EVID-006 | Evidence class is declared, closed, immutable, and never escalated | Negative | Unit | High | AC-F4-5, NFR-10 |
| TC-EVID-007 | Comparison record shape and divergence-iff-mismatch | Negative | Unit | High | AC-F4-6, AC-F4-2, NFR-10 |
| TC-GATE-001 | Summary reports the full evidence window | Happy Path | Behaviour | High | AC-F5-1 |
| TC-GATE-002 | Eligibility is the four-condition conjunction | Happy Path | Unit | High | AC-F5-2 |
| TC-GATE-003 | Floor variant: 20 counted dispatches | Edge Case | Unit | High | AC-F5-3 |
| TC-GATE-004 | Floor variant: 7 consecutive UTC dates | Edge Case | Unit | High | AC-F5-3 |
| TC-GATE-005 | Floor never substitutes for the other conditions | Negative | Unit | High | AC-F5-2, AC-F5-3 |
| TC-GATE-006 | Degraded evidence reads have pinned exits | Negative | Behaviour | High | AC-F5-4, AC-F4-4, AC-F6-1 |
| TC-GATE-007 | All eleven classes are coverable; full coverage is eligible | Corner Case | Unit | High | AC-F5-2, AC-F5-5 |
| TC-GATE-008 | Family-wise comparison record shape | Corner Case | Unit | High | AC-F4-2, AC-F4-6, AC-F5-2 |
| TC-GATE-009 | Incident lower bound is exclusive; post-incident recovery is eligible | Corner Case | Unit | High | AC-F4-3, AC-F5-1, AC-F5-6 |
| TC-GATE-010 | Corroboration sufficiency per outcome family | Negative | Unit | High | AC-F5-2 |
| TC-GATE-011 | Evidence-class counting per repository scope | Negative | Unit | High | AC-F8-3, AC-F4-5, AC-F5-1 |
| TC-HAND-001 | Readable-but-unmet refuses at exit 1; unreadable evidence at exit 2 | Negative | Behaviour | High | AC-F6-1 |
| TC-HAND-002 | Met gate flips one repository and records it | Happy Path | Behaviour | High | AC-F6-2 |
| TC-HAND-003 | Reversal restores dual-run; second reversal is a noop | Happy Path | Behaviour | High | AC-F6-3, AC-NFR6-1 |
| TC-HAND-004 | Derived authority view is complete, atomic, and fail-safe | Corner Case | Structure | High | AC-F6-4 |
| TC-HAND-005 | Dual-run dispatch claims no authority | Regression | Behaviour | High | AC-F6-5 |
| TC-HAND-006 | Handover is isolated per repository | Negative | Behaviour | High | AC-F6-2 |
| TC-HAND-007 | Repository identity is rename-invariant; unresolvable identity refuses | Corner Case | Behaviour | High | AC-F6-6, AC-F6-2, AC-F6-4 |
| TC-BASH-001 | Dual-run bash entry points are unchanged | Regression | Shell | High | AC-F7-1, NFR-8 |
| TC-BASH-002 | Authoritative bash entry points print the deprecation pointer | Happy Path | Shell | High | AC-F7-2, NFR-8 |
| TC-BASH-003 | Bash fallback works with the typed CLI absent or broken | Corner Case | Shell | High | AC-F7-3, NFR-8 |
| TC-BASH-004 | Four scripts across three conditions all complete | Regression | Shell | High | AC-NFR8-1 |
| TC-BASH-005 | Bash never invokes the typed CLI to decide authority | Negative | Structure | High | AC-F7-3, NFR-8 |
| TC-E2E-001 | Controlled-proof evidence reaches eligibility, flips, and dispatches | Happy Path | Conformance | High | AC-F8-1, AC-F5-5, AC-F4-5, AC-F8-3 |
| TC-E2E-002 | Reversal returns the repository to bash-authoritative | Happy Path | Conformance | High | AC-F8-2 |
| TC-E2E-003 | Fixture evidence is command-produced and never counted cross-scope | Negative | Conformance | Medium | AC-F8-1, AC-F8-3 |
| TC-MERGE-001 | Merge-ready PR stays `pr-open`; no merge fires | Negative | Behaviour | High | AC-F9-1 |
| TC-MERGE-002 | Already-merged detection records observed evidence only | Edge Case | Behaviour | High | AC-F9-2 |
| TC-MERGE-003 | Structural boundary proves no merge path | Negative | Structure | High | AC-F9-1, AC-NFR9-1 |
| TC-MERGE-004 | Production composition has no reachable merge port | Negative | Structure | High | AC-NFR9-1 |
| TC-DAEMON-001 | Planner produces prompt and declared environment; executor available | Happy Path | Behaviour | High | AC-F10-1 |
| TC-DAEMON-002 | Daemon lane produces the same token, outcome, and attempt record as one-shot | Happy Path | Conformance | High | AC-F10-2 |
| TC-DAEMON-003 | One-shot dispatch works with no daemon | Corner Case | Behaviour | High | AC-F10-3 |
| TC-HELP-001 | Dispatch is registered and documented with the evidence bar | Happy Path | Structure | High | AC-F11-1 |
| TC-HELP-002 | Help and version remain pure and side-effect free | Negative | Behaviour | High | AC-F11-2, NFR-3 |
| TC-HELP-003 | Production-surface absence assertions are inverted; the pilot fixture stays reduced | Regression | Structure | High | AC-F11-3 |
| TC-PLANREC-001 | Story-owned planning surfaces carry the evidence bar | Regression | Structure | High | AC-F11-1 |
| TC-ERR-001 | Spawn failure classifies as `dispatch.session.spawn-failed` with token `failed`/outcome `failed` | Negative | Behaviour | High | AC-F12-1 |
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

**Scenario counts:** 82 total, 76 must-pass and 6 nice-to-have. Families: DISP 12, TRUTH 6, RESUME 4, EVID 7, GATE 11, HAND 7, BASH 5, E2E 3, MERGE 4, DAEMON 3, HELP 3, PLANREC 1, ERR 5, TOKEN 2, NFR 7, DET 1, REG 1.

### 5.2 Scenario Details

Each scenario uses the template's Preconditions / Steps / Expected Outcome form, which encodes Given / When / Then: the preconditions are the Given, the steps are the When, and the expected outcome is the Then. Every scenario names the exact CLI command or test-facing function, the expected output or exit code, the expected record effects, and its test file placement. When a scenario declares **Executable Slices**, the steps are implemented in the named file for each labelled phase; a phase-2 or phase-3 file must not contain an unlabelled command, summary, handover, or bash step.

#### TC-DISP-001 - Harness resolution, lease claim, fresh spawn, one attempt record

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, F-12, AC-F1-1, AC-F4-1, DM-5, EVT-1, DEC-19
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-lease.test.ts`
**Tags**: @backend, @dispatch, @harness

**Preconditions**:
- A temporary state root with an empty queue ledger and a configured default harness of `opencode`.
- A scripted `HarnessSessionPort` whose `spawn` records its input and returns a session handle.
- Tracker, CI, and VCS read ports return a consistent open-PR truth fixture.
- A recording attempt-ledger reader over the same temp root.

**Steps**:
1. Invoke `dispatch GH-301` through `runEntrypoint` with configuration selecting `opencode`.
2. Invoke `dispatch GH-302 --harness claude-code` and assert the flag wins over configuration.
3. Invoke `dispatch GH-303 --harness unknown-harness` and assert refusal.
4. Read the queue lease ledger, the harness spawn recorder, and the attempt ledger after each invocation.

**Expected Outcome**:
- Runs 1 and 2 each claim the repository lease through `claimQueueLease`, spawn exactly once through the port, and record the harness name in the envelope.
- Runs 1 and 2 each append exactly one attempt record after classification, carrying the harness, the resolved repository identity, and a complete comparison record.
- Run 2's spawn input names `claude-code`; the configured default is not used.
- Run 3 exits `1` with a declared input-refusal code (an identity, not prose), does not claim a lease, does not spawn, and appends no attempt record (DEC-19; the detailed assertion is `TC-DISP-002`).
- No invocation touches the network or a live remote.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-harness-lease.test.ts` exits 0; any missing lease claim, wrong harness, spawn on the unknown-harness case, or attempt record for a refused dispatch fails.

#### TC-DISP-002 - Pre-session refusal: classified envelope and no attempt record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, F-12, AC-F1-1, AC-F4-1, DEC-19, D6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-harness-lease.test.ts`
**Tags**: @backend, @dispatch, @queue

**Preconditions**:
- The state root holds an active repository lease for `GH-301` held by another runner.
- A scripted harness port counts every spawn and resume.
- Three refusal shapes are available: an active conflicting lease, an unknown harness name, and a rejected input value.
- A recording attempt ledger and a recording authority-view reader.

**Steps**:
1. Invoke `dispatch GH-301` against the held lease.
2. Assert the exit code, the error envelope, the spawn count, and the lease ledger.
3. Assert the attempt-record count is unchanged and that the authority view did not change.
4. Repeat steps 1-3 with the unknown-harness and rejected-input shapes.
5. Run a harness spawn refusal (`refused`, `spawnRefused: true`) as a contrast and read the attempt ledger.

**Expected Outcome**:
- Exit `1`; the envelope carries the delivered queue lease-conflict identity (or the declared input-refusal identity), category `user-validation`, and a remediation hint; every envelope field is present.
- Spawn count is `0`; resume count is `0`; the existing lease is unchanged; no second lease is created.
- Zero attempt records are appended for all three pre-session refusal shapes, deterministically (DEC-19, PM D6): a refusal with no engine outcome and token cannot produce an attempt record, so the envelope is the only record.
- The harness spawn refusal contrast is **not** a pre-session refusal: it appends exactly one attempt record with token `noop-lane-permission` and outcome `refused` (the full record assertion is `TC-DISP-011` and `TC-EVID-001`). This scenario proves the two policies are distinct and never conflated.
- No divergence, no handover record, and no authority change.
- The bash stack remains authoritative and unblocked.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-harness-lease.test.ts` exits 0; a spawn, a stolen lease, a missing envelope field, or any attempt record for a pre-session refusal fails.

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
**Executable Slices**:
- Phase 1 (structure, `dispatch-token-home.test.ts`): token literal home and taxonomy totality.
- Phase 2 (pure behaviour, `dispatch-token-closure.test.ts`): every derivation branch emits only the closed set.
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
**Executable Slices**:
- Phase 2 (pure domain): the token-to-exit projection matrix needs no CLI and is green with the pure domain.
- Phase 4 (command): the real process exit is confirmed by `TC-DISP-001` and `TC-DISP-010` in phase 4; this file does not invoke the command.
**Tags**: @backend, @dispatch, @exit

**Preconditions**:
- Fixtures for each of the eleven tokens and for the four failure classes: harness spawn refusal, spawn failure, restart-budget refusal, and resume-economics refusal.

**Steps**:
1. Project each token through the delivered result projection.
2. Assert the process exit and the precedence rule.
3. Assert `state-unverified` is `2`, not bash's `1`.
4. Assert the Appendix G failure pairs: spawn failure `failed`/`failed`; restart-budget `max-restarts`/`failed`; resume-economics `failed`/`failed`; harness spawn refusal `noop-lane-permission`/`refused`.

**Expected Outcome**:
- `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `finished`, `noop-lane-nothing-to-do` exit `0`.
- `failed` (including an ordinary failure, a spawn failure, and a resume-economics refusal), `max-restarts` (including a restart-budget refusal), `partial`, and `noop-lane-permission` (a harness spawn refusal) exit `1`.
- `state-unverified` exits `2`; no exit outside `0`, `1`, `2`.
- The failure token/outcome pair is the Appendix G pair in every case; no failure class reuses another class's token.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-exit-projection.test.ts` exits 0; any mismatch or an out-of-range exit fails.

#### TC-DISP-010 - Failing run still emits a complete error envelope

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-12, AC-F1-4, AC-F12-3, DM-1, EVT-1, Appendix G
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
- Spawn failure exits `1`, emits result token `failed` with outcome `failed`, and appends exactly one attempt record whose comparison is `not-applicable`/`null`/`not-applicable` with reason `comparison-source-unavailable`, exposure-only and with no divergence.
- The state failure exits `2`, emits result token `state-unverified`, and appends one attempt record whose comparison is `not-applicable` with reason `comparison-source-unavailable` and no divergence.
- No run emits prose instead of an identity or an exit outside `0`, `1`, `2`.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-envelope.test.ts` exits 0; an invalid or field-poor failure envelope fails.

#### TC-DISP-011 - `partial` carries outcome; a harness spawn refusal is a recorded spawn-refused attempt

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-4, F-12, AC-F1-3, AC-F2-4, AC-F4-1, DEC-14, DEC-19, DM-1, EVT-1
**Test Type(s)**: Unit (classification) and ledger/behaviour (record policy)
**Automation Level**: Automated
**Target Layer / Location**: phase-2 classification `tests/behaviour/dispatch-token-closure.test.ts`; phase-3 ledger `tests/behaviour/dispatch-evidence-record.test.ts`; phase-4 command confirmation `tests/behaviour/dispatch-harness-lease.test.ts`
**Executable Slices**:
- Phase 2 (pure classification, `dispatch-token-closure.test.ts`): `partial` carries its outcome; `refused` with `spawnRefused: true` yields `noop-lane-permission`/`refused`.
- Phase 3 (ledger, `dispatch-evidence-record.test.ts`): the spawn refusal appends exactly one attempt record with its Appendix G pair and not-applicable comparison; the three pre-session refusal shapes append none (contrast asserted here, full envelope in `TC-DISP-002`).
- Phase 4 (command, `dispatch-harness-lease.test.ts`): a real harness spawn refusal records one attempt and never resets the pre-session policy.
**Tags**: @backend, @dispatch, @taxonomy

**Preconditions**:
- The shared classifier's six-row projection is bound (`HARNESS_CLASSIFICATION_TOKENS`).
- A `refused` harness evidence set with `spawnRefused: true`.
- A recording attempt ledger, plus the three pre-session refusal fixtures (unknown harness, rejected input, conflicting lease before a spawn).

**Steps**:
1. Classify `completed-with-tool-failure` and `premature-end`; assert the token is `partial` and the outcome is present in the classification.
2. Classify `refused` with `spawnRefused: true`; assert the token is `noop-lane-permission` and the outcome is `refused`.
3. Append the spawn-refusal attempt through the ledger (phase-3 slice) and assert exactly one record carrying token `noop-lane-permission`, outcome `refused`, and comparison `class: not-applicable`, `token: null`, `outcome: not-applicable`, `reason: dispatch-session-family`; zero divergences.
4. Phase-4 confirmation: run the three pre-session refusal shapes through the command and assert zero attempt records for them.
5. Assert the record and output describe spawn-refused, never a lane-permission policy verdict and never a pre-session refusal.
6. Phase-4 confirmation: dispatch a harness spawn refusal through the command and assert the same one-record policy.

**Expected Outcome**:
- Every `partial` carries its `outcome`; the envelope includes it.
- Harness-path `noop-lane-permission` is a recorded attempt-stage failure: token `noop-lane-permission`, outcome `refused`, exit `1`, exactly one attempt record, not-applicable comparison reason `dispatch-session-family`, exposure-only, no divergence.
- The three pre-session refusals remain unrecorded; the spawn refusal is never counted among them and is never called "pre-session".
- No lane-permission policy wording appears.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-token-closure.test.ts tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-harness-lease.test.ts` exits 0; a `partial` without outcome, a permission-verdict wording, a pre-session label on a spawn refusal, a second record, or a missing record fails.

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

#### TC-TRUTH-001 - Exit-0 with no artifact derives `failed`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, EVT-1, SC-M1-27
**Test Type(s)**: Unit (pure derivation) with ledger and command confirmations
**Automation Level**: Automated
**Target Layer / Location**: phase-2 pure domain `tests/behaviour/dispatch-truth-derivation.test.ts`; phase-3 ledger `tests/behaviour/dispatch-evidence-record.test.ts`; phase-4 command `tests/behaviour/dispatch-harness-lease.test.ts`
**Executable Slices**:
- Phase 2 (pure domain, `dispatch-truth-derivation.test.ts`): call `deriveDispatchResult(...)` on an exit-0/no-artifact input; assert token `failed`, exit `1`, missing artifact named. No CLI, no ledger.
- Phase 3 (ledger, `dispatch-evidence-record.test.ts`): append the attempt and assert it is never success-classified and carries the missing-artifact evidence.
- Phase 4 (command, `dispatch-harness-lease.test.ts`): cross-phase confirmation that a real `dispatch REF` emits the same token and exit.
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- A derivation input where the scripted session exits `0` with a completion marker.
- The input carries no branch commit, no PR, and no phase-ledger progress.

**Steps**:
1. Call `deriveDispatchResult(...)` with the no-artifact input.
2. Assert the token, exit, and `lastMessage`.
3. Phase-3 slice: append the attempt record and assert its false-success classification and missing-artifact evidence.
4. Phase-4 slice: invoke `dispatch GH-301` and assert the same token and exit.

**Expected Outcome**:
- Result `failed`, exit `1`; never a success token.
- The missing artifact is named (no branch commit, no PR, no ledger progress).
- Phase-3 slice: the attempt record carries the missing-artifact evidence and is never success-classified.
- The command-level confirmation emits the same pair; it does not change the phase-2 verdict.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; an exit-0 success classification fails.

#### TC-TRUTH-002 - Open PR derives `pr-open` with a tracker-truth match

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, AC-F4-6, DM-1, DM-8, SC-M1-26
**Test Type(s)**: Unit (pure derivation) with ledger and command confirmations
**Automation Level**: Automated
**Target Layer / Location**: phase-2 pure domain `tests/behaviour/dispatch-truth-derivation.test.ts`; phase-3 comparison record `tests/behaviour/dispatch-comparison.test.ts`; phase-4 command `tests/behaviour/dispatch-harness-lease.test.ts`
**Executable Slices**:
- Phase 2 (pure domain, `dispatch-truth-derivation.test.ts`): derive token `pr-open`, exit `0`, `prUrl` set, `handoverState: dual-run` from a consistent open-PR truth input.
- Phase 3 (comparison record, `dispatch-comparison.test.ts`): assert `class: tracker-truth`, `token: pr-open`, `outcome: match`, `urlResolved: true`, no divergence (`TC-EVID-007`).
- Phase 4 (command, `dispatch-harness-lease.test.ts`): cross-phase confirmation that a real dispatch appends one record with the same comparison.
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- A derivation input where the tracker read reports one open PR with a resolvable URL.
- The branch has commits and the phase ledger shows a terminal phase.

**Steps**:
1. Call `deriveDispatchResult(...)` with the open-PR truth input.
2. Assert the token, exit, and URL.
3. Phase-3 slice: read the comparison record and corroboration tri-state from the ledger fixture (full shape in `TC-EVID-007`).
4. Phase-4 slice: invoke `dispatch GH-301` and confirm the same token and one attempt record.

**Expected Outcome**:
- Result `pr-open`, exit `0`, `prUrl` set, `handoverState` `dual-run`.
- Phase-3 slice: the comparison record is `class: tracker-truth`, `token: pr-open`, `outcome: match`, and `urlResolved: true`; no divergence is appended.
- Phase-3 slice: the corroboration tri-state is complete and satisfied by the tracker fact; the tracker-truth comparison baseline is independent tracker truth, not the engine token.
- Phase-3 slice: the attempt record carries the declared evidence class.
- The phase-2 derivation is green without the command; the command confirmation adds no new rule.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a missing URL, an incomplete comparison record, or an incomplete corroboration record fails.

#### TC-TRUTH-003 - Unresolvable PR URL derives `pr-open-unverified`, corroborated by the tracker fact

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, F-5, AC-F2-2, AC-F4-6, AC-F5-2, DEC-3, TDR-0015
**Test Type(s)**: Unit (pure derivation) with ledger, command, and gate confirmations
**Automation Level**: Automated
**Target Layer / Location**: phase-2 pure domain `tests/behaviour/dispatch-truth-derivation.test.ts`; phase-3 comparison record `tests/behaviour/dispatch-comparison.test.ts`; phase-4 command `tests/behaviour/dispatch-harness-lease.test.ts`; phase-6 summary/gate `tests/behaviour/dispatch-gate-evidence.test.ts`
**Executable Slices**:
- Phase 2 (pure domain, `dispatch-truth-derivation.test.ts`): derive token `pr-open-unverified`, exit `0`, empty `prUrl`, engine-side `urlResolved: false`; no CLI.
- Phase 3 (comparison record, `dispatch-comparison.test.ts`): `class: tracker-truth`, `token: pr-open`, `outcome: match`, `urlResolved: false`, no divergence (`TC-EVID-007`, `TC-GATE-008`).
- Phase 4 (command, `dispatch-harness-lease.test.ts`): text mode emits empty `pr_url=` and no `closeout_unverified=` key.
- Phase 6 (summary/gate, `dispatch-gate-evidence.test.ts`): the tracker fact satisfies corroboration and the class does not block eligibility (`TC-GATE-007`).
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- A derivation input where the tracker reports an open PR (the independent tracker fact is "PR open, state `open`"), but the URL read fails or returns empty.
- The branch and phase ledger are otherwise consistent.
- A recording attempt ledger and a summary fixture are available for the later slices.

**Steps**:
1. Call `deriveDispatchResult(...)` with the empty-URL truth input; assert the token, exit, and `urlResolved: false`.
2. Phase-3 slice: read the comparison record and corroboration tri-state from the ledger fixture.
3. Phase-4 slice: invoke `dispatch GH-301` in text mode; assert empty `pr_url=` and no `closeout_unverified=`.
4. Phase-6 slice: run the gate over a window in which this is the only `pr-open-unverified` record and every other condition holds.

**Expected Outcome**:
- Result `pr-open-unverified`, exit `0`, `pr_url=` empty.
- Phase-3 slice: comparison record asserted exactly: `class: tracker-truth`, `token: pr-open` (independent tracker truth, at tracker-state granularity), `outcome: match`, `urlResolved: false`. URL resolution is an engine-side attribute, never part of the comparison and never a mismatch trigger.
- Phase-3/6 slices: the phase-3 slice asserts zero divergence records are appended; the phase-6 summary reports zero unresolved divergences attributable to this record.
- Phase-3 slice: corroboration for this success claim is **satisfied by the tracker fact** (the PR is open). The record is not "permanently uncorroborated" and its corroboration is not an unmet condition; only the URL remained unresolved.
- The unverified reason rides the token and `lastMessage`; no extra bash key is emitted.
- Phase-6 slice: the gate does not treat this class as blocking; a window containing it can be eligible (`TC-GATE-007`, `TC-E2E-001`).

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a fabricated URL, an extra key, a `mismatch`, a divergence for the unresolved URL, or an unsatisfied corroboration on the tracker fact fails.

#### TC-TRUTH-004 - Already-merged PR is detection-only `merged`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, AC-F2-2, AC-F9-2
**Test Type(s)**: Unit (pure derivation) with command confirmation
**Automation Level**: Automated
**Target Layer / Location**: phase-2 pure domain `tests/behaviour/dispatch-truth-derivation.test.ts`; phase-4 command `tests/behaviour/dispatch-merge-absence.test.ts`
**Executable Slices**:
- Phase 2 (pure domain, `dispatch-truth-derivation.test.ts`): derive `merged` only when the input carries independently observed merged state.
- Phase 4 (command, `dispatch-merge-absence.test.ts`): cross-phase confirmation with a recording merge port at zero calls.
**Tags**: @backend, @dispatch, @truth, @merge

**Preconditions**:
- Derivation input where independent VCS and tracker reads report the PR already merged.
- A recording merge port is injected at the command confirmation to prove zero calls.

**Steps**:
1. Call `deriveDispatchResult(...)` with the merged truth input; assert token `merged`, exit `0`, and the observed merged evidence.
2. Phase-4 slice: invoke `dispatch GH-301` and assert the same token, the observed merged evidence, and the merge recorder count is zero.

**Expected Outcome**:
- Result `merged`, exit `0`, only after the merged state is independently observed.
- The attempt record carries the observed merged evidence and corroboration references.
- No merge is fired; the merge recorder remains at zero.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a merge call or an unobserved `merged` fails.

#### TC-TRUTH-005 - Blocking tracker state derives `blocked`; a missing fact is not success

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-2, DM-8
**Test Type(s)**: Unit (pure derivation) with ledger and gate confirmations
**Automation Level**: Automated
**Target Layer / Location**: phase-2 pure domain `tests/behaviour/dispatch-truth-derivation.test.ts`; phase-3 ledger `tests/behaviour/dispatch-evidence-record.test.ts`; phase-6 corroboration `tests/behaviour/dispatch-gate-evidence.test.ts`
**Executable Slices**:
- Phase 2 (pure domain, `dispatch-truth-derivation.test.ts`): blocking tracker status derives `blocked`/exit `0`; a missing tracker fact derives `state-unverified`/exit `2`, never a success token.
- Phase 3 (ledger, `dispatch-evidence-record.test.ts`): both records carry their comparison and corroboration fields.
- Phase 6 (gate, `dispatch-gate-evidence.test.ts`): `blocked` corroborates on the blocking tracker fact; the missing-fact record is not a clean success (`TC-GATE-010`).
**Tags**: @backend, @dispatch, @truth

**Preconditions**:
- Derivation input where tracker state reports a delivery-blocking status.
- A second input that omits the tracker fact entirely.

**Steps**:
1. Call `deriveDispatchResult(...)` on the blocking input and assert `blocked`.
2. Call it on the missing-fact input and assert the unverified behavior (`state-unverified`, exit `2`).
3. Phase-3 slice: assert both attempt records' comparison and corroboration.
4. Phase-6 slice: assert the gate treats them per `TC-GATE-010`.

**Expected Outcome**:
- The blocking input yields `blocked`, exit `0`, corroborated by the tracker fact.
- The missing-fact input never becomes a clean success; it is `state-unverified` (or an explicitly unevaluable record).
- Phase-3 slice: the record names which tracker fact was missing.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-truth-derivation.test.ts` exits 0; a missing tracker fact producing a success token fails.

#### TC-TRUTH-006 - `state-unverified` degrades one record, not the window

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, F-5, F-12, AC-F2-3, AC-F4-4, AC-F5-2, NFR-1, NFR-5, TDR-0015
**Test Type(s)**: Unit (classification) with ledger, gate, and bash confirmations
**Automation Level**: Automated
**Target Layer / Location**: phase-2 pure domain `tests/behaviour/dispatch-state-unverified.test.ts`; phase-3 ledger `tests/behaviour/dispatch-evidence-record.test.ts`; phase-6 summary/gate `tests/behaviour/dispatch-gate-evidence.test.ts`; phase-8 bash `scripts/.tests/test-dispatch-bash-fallback.sh`
**Executable Slices**:
- Phase 2 (pure domain, `dispatch-state-unverified.test.ts`): each unreadable truth input derives `state-unverified`, exit `2`, with the classified identity and remediation hint. No CLI.
- Phase 3 (ledger, `dispatch-evidence-record.test.ts`): the record is unevaluable with comparison `not-applicable`/`comparison-source-unavailable`, makes no success claim, creates no divergence.
- Phase 6 (summary/gate, `dispatch-gate-evidence.test.ts`): the record counts for coverage as exposure and does not block; a window-level unreadable/torn stream is unverifiable at exit `2`.
- Phase 8 (bash, `test-dispatch-bash-fallback.sh`): the bash fallback still runs for the same repository.
**Tags**: @backend, @dispatch, @truth, @errors

**Preconditions**:
- Four blocking-verdict inputs: unreadable ledger, unreadable tracker, unreadable artifact read, and torn state read.
- A fifth input where the verdict itself is derivable as non-success but the comparison source is unreadable (the record-level case).
- A window fixture in which that `state-unverified` record supplies the otherwise-missing class, so the window reaches full eleven-class coverage only through this exposure record; every other condition holds.
- A window-level fixture where the attempt ledger itself cannot be read.

**Steps**:
1. Call `deriveDispatchResult(...)` for each blocking-verdict input; assert token `state-unverified`, exit `2`, identity, and remediation hint.
2. Phase-3 slice: read each attempt record and assert the comparison record and corroboration tri-state.
3. Phase-6 slice: run the summary over the window containing the `state-unverified` record and evaluate the gate.
4. Phase-6 slice: run the summary over the unreadable evidence stream and assert the verdict and exit.
5. Phase-8 slice: assert the bash fallback still runs for the same repository.

**Expected Outcome**:
- Result `state-unverified`, exit `2`; never exit `0`, never silently `failed`.
- The envelope carries `dispatch.state-unverified` (or a delivered `state.*` identity) and a remediation hint; category is `platform-provider`.
- Record-level: the attempt's comparison record is `class: not-applicable`, `token: null`, `outcome: not-applicable`, `reason: comparison-source-unavailable`. No divergence is appended.
- Record-level: the record makes no success claim, so it counts for class coverage as exposure, creates no divergence, and does not by itself block eligibility — the gate over a window whose other conditions hold returns eligible true with this class present.
- Window-level: an unreadable, torn, or malformed evidence-stream read makes eligibility `unverifiable` with the degradation declared and exit `2`; it never returns eligible and never fabricates zeros. The two scopes are asserted separately and are not conflated.
- The attempt record is durable and is not a fabricated success; the bash stack is not suppressed.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-state-unverified.test.ts` exits 0; exit `0` or `failed` on an unreadable truth read, a divergence for a not-applicable comparison, the record blocking a window by itself, or an eligible/zeroed window-level read fails.

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
**Related IDs**: F-3, F-12, AC-F3-2, DM-1, EVT-1, NFR-5, Appendix G
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-restart-budget.test.ts`
**Executable Slices**:
- Phase 5 (command + ledger): the refusal is produced by the command, and the attempt record is appended through the phase-3 ledger; both surfaces exist by phase 5.
**Tags**: @backend, @dispatch, @restart

**Preconditions**:
- The lane's restart count equals the policy `lane.restart-budget` (default 3).
- A recording harness port counts spawns and resumes.

**Steps**:
1. Attempt another restart through `dispatch GH-301 --resume-prompt "retry"`.
2. Assert the exit, identity, terminal record, and escalation.
3. Read the attempt ledger and assert exactly one record with token `max-restarts`, outcome `failed`, and comparison `not-applicable`/`null`/`not-applicable` reason `dispatch-session-family`; zero divergences.
4. Read the queue ledger to prove the delivery is not silently requeued.

**Expected Outcome**:
- Exit `1` with `dispatch.restart-budget-exceeded`; category `user-validation`.
- Result token `max-restarts` with outcome `failed` (Appendix G); exactly one attempt record carrying that pair and the not-applicable/exposure-only comparison; no divergence.
- The delivered terminal exhaustion record is present; a typed escalation is surfaced.
- No spawn, no resume, no requeue; the delivery is not silently returned to the queue as fresh work.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-restart-budget.test.ts` exits 0; a spawn past the budget, a silent requeue, a wrong token/outcome pair, or a missing/duplicate attempt record fails.

#### TC-RESUME-003 - Resume economics refuses uneconomical re-pay

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-12, AC-F3-3, DM-1, EVT-1, NFR-1, Appendix G
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-resume-economics.test.ts`
**Executable Slices**:
- Phase 5 (command + ledger): the refusal and its attempt record exist once resume admission is delivered; the comparison record primitive is phase 3.
**Tags**: @backend, @dispatch, @economics

**Preconditions**:
- A resume whose prefill re-pay exceeds the delivered economics admission for the unique progress available.
- A second fixture with unreadable token or cost facts.
- A third fixture declaring attach-and-continue.

**Steps**:
1. Invoke the uneconomical resume and assert the refusal identity and exit.
2. Read the attempt ledger and assert exactly one record with token `failed`, outcome `failed`, and comparison `not-applicable`/`null`/`not-applicable` reason `comparison-source-unavailable`; zero divergences.
3. Invoke the unreadable-facts resume and assert refusal or unevaluable classification.
4. Invoke attach-and-continue and assert no restart ordinal is consumed.

**Expected Outcome**:
- Uneconomical: exit `1`, `dispatch.resume-uneconomical`, result token `failed` with outcome `failed` (Appendix G), one attempt record with the not-applicable/exposure-only comparison, no divergence, no spawn.
- Unreadable facts: refused or classified unevaluable, never admitted.
- Attach-and-continue: valid admission with zero ordinal consumption, recorded as such.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-resume-economics.test.ts` exits 0; admitting an uneconomical or unreadable resume, a wrong token/outcome pair, or a missing/duplicate attempt record fails.

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

#### TC-EVID-001 - Exactly one complete attempt record per classified dispatch

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-5, DM-1, DM-8, EVT-1, NFR-7, NFR-10, Appendix G
**Test Type(s)**: Ledger (phase 3) with command and type confirmations
**Automation Level**: Automated
**Target Layer / Location**: phase-3 ledger `tests/behaviour/dispatch-evidence-record.test.ts`; phase-4 command `tests/behaviour/dispatch-harness-lease.test.ts`; type slice `tests/types/dispatch-contract.type-test.ts`
**Executable Slices**:
- Phase 3 (ledger, `dispatch-evidence-record.test.ts`): append exactly one record per attempt-stage fixture through `appendDispatchAttempt(...)`; assert every field, the Appendix G token/outcome pair, and the comparison treatment. No CLI command is required.
- Phase 4 (command, `dispatch-harness-lease.test.ts`): cross-phase confirmation that a real `dispatch REF` appends exactly one record per classified dispatch (`TC-DISP-001` carries the command path).
- Phase 3 (types): compile the declared record types.
**Tags**: @backend, @dispatch, @evidence

**Preconditions**:
- Attempt-stage fixtures only: a harness spawn refusal (`noop-lane-permission`/`refused`), a spawn failure (`failed`/`failed`), a restart-budget exhaustion (`max-restarts`/`failed`), a resume-economics refusal (`failed`/`failed`), plus a success and an ordinary failure fixture.
- The three pre-session refusals (unknown harness, rejected input, conflicting lease before a spawn) are excluded here and asserted by `TC-DISP-002`. A harness spawn refusal is an attempt-stage failure and **is** included.
- Canary prompt, transcript, credential, and raw payload strings are placed in harness evidence and parent environment.
- The type test imports the declared record types.

**Steps**:
1. Append one record for each attempt-stage fixture through `appendDispatchAttempt(...)` and read the attempt ledger.
2. Assert exactly one record per attempt and validate every required field, including `evidenceClass` and the comparison record.
3. Assert the Appendix G token/outcome pair and comparison treatment for each failure fixture:
   - harness spawn refusal → `noop-lane-permission`/`refused`, exit `1`, comparison `not-applicable` reason `dispatch-session-family`;
   - spawn failure → `failed`/`failed`, exit `1`, comparison `not-applicable` reason `comparison-source-unavailable`;
   - restart-budget refusal → `max-restarts`/`failed`, exit `1`, comparison `not-applicable` reason `dispatch-session-family`;
   - resume-economics refusal → `failed`/`failed`, exit `1`, comparison `not-applicable` reason `comparison-source-unavailable`.
4. Serialize each record and scan for the canaries.
5. Phase-4 slice: run a real `dispatch REF` for one success and one attempt-stage failure and confirm exactly one record each.
6. Compile the type test against the declared record and summary shapes.

**Expected Outcome**:
- Exactly one record per dispatch that reaches classification, with repository identity, reference, start/finish, harness, declared `evidenceClass` (one of the four closed values), handover state, outcome and token, the comparison record (class, token or null, outcome, reason, `urlResolved`), divergence reference, false-success classification, corroboration tri-state, and resume mode when applicable.
- Every attempt-stage failure appends exactly one record with its Appendix G pair; all four comparisons are `not-applicable`, `token: null`, `outcome: not-applicable`, and exposure-only with zero divergences.
- No pre-session refusal fixture is used in this scenario; those append no record (`TC-DISP-002`).
- No canary appears in any record.
- The type test fails if a required field is removed or widened.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-harness-lease.test.ts` and `bun test tests/types` exit 0; a missing field, a duplicate record, a wrong Appendix G pair, a pre-session refusal fixture used here, or a canary fails.

#### TC-EVID-002 - Divergence opens on disagreement and resolves append-only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-6, DM-2, EVT-2, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-divergence.test.ts` (phase 6)
**Executable Slices**:
- Phase 6 (command + summary): the resolve command and the summary totals exist only in phase 6. This TC's earliest executable phase is **6**, not 3; the phase-3 divergence-append primitive is covered by `TC-EVID-005` in `dispatch-evidence-record.test.ts`. The phase-6 plan test command runs this file.
**Tags**: @backend, @dispatch, @divergence

**Preconditions**:
- Engine token `pr-open`, independent tracker truth `blocked` (a `tracker-truth` mismatch), or a verify-class token versus a contradicting ledger outcome (a `verify-change` mismatch).
- A deterministic divergence id sequence.

**Steps**:
1. Dispatch and assert an open divergence record and the comparison record that produced it (`outcome: mismatch`).
2. Assert no divergence is appended for a `match` and for a `not-applicable` comparison in the same fixture family.
3. Invoke `dispatch dual-run resolve DIV-1 --note "tracker was stale; PR reopened"`.
4. Read the divergence ledger and run `dispatch dual-run summary --repo REPO`.

**Expected Outcome**:
- The open record is appended with both tokens, the comparison class, and evidence references; it exists because and only because the comparison outcome was `mismatch`.
- Resolution appends a `resolved` record with a bounded note, principal, and timestamp; the original open record remains byte-identical.
- The summary reports reported `1`, resolved `1`, unresolved `0`, and names the identifier only while unresolved.
- A `match` or `not-applicable` comparison in the same run produced zero divergence records.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-divergence.test.ts` exits 0; a rewritten or deleted open record, a divergence for a non-mismatch, or a missing divergence for a mismatch fails.

#### TC-EVID-003 - False success is recorded; the incident resets the exclusive window

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-3, AC-F5-6, DM-1, DM-8, NFR-10, DEC-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: phase-3 ledger `tests/behaviour/dispatch-false-success.test.ts`; phase-6 window `tests/behaviour/dispatch-gate-window.test.ts`
**Executable Slices**:
- Phase 3 (record, `dispatch-false-success.test.ts`): derive the failure result and append the attempt record; the record carries the false-success classification, bounded references, and timestamp T.
- Phase 6 (summary/window, `dispatch-gate-window.test.ts`): `windowStart`, `windowStartReason`, pre-incident exclusion, same-instant exclusion, and post-incident recovery.
**Tags**: @backend, @dispatch, @incident

**Preconditions**:
- Engine claims `pr-open`, but the tracker shows no PR and CI shows no pushed head.
- An earlier evidence set exists strictly before the incident timestamp T.
- A post-incident evidence set exists that covers all eleven classes, meets the floor, has no further incident or unresolved divergence, and corroborates every success claim.

**Steps**:
1. Phase-3 slice: derive the failure result and append the attempt record through the ledger; assert the record's false-success classification, bounded evidence references, and recorded completion timestamp T.
2. Phase-6 slice: run the summary and assert the incident count, `windowStart = T`, and `windowStartReason = false-success-incident-reset`.
3. Phase-6 slice: add attempts strictly before T and assert they remain excluded from floor, coverage, and counts.
4. Phase-6 slice: add an attempt recorded at exactly T and assert it is excluded as well (`>` comparison, not `>=`).
5. Phase-6 slice: evaluate the post-incident recovery set and assert eligibility.

**Expected Outcome**:
- The record is a false-success incident, never clean, with bounded references (no raw payload).
- The lower bound is exclusive: the incident at T and any same-instant record are outside the evaluated window and never counted; pre-incident evidence is excluded.
- Floor and class coverage re-accrue strictly after T; with sufficient post-T evidence the gate returns eligible true with zero in-window incidents.
- The summary always reports the window start and the reset reason.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-false-success.test.ts tests/behaviour/dispatch-gate-window.test.ts` exits 0; a zeroed incident, an inclusive bound, an in-window incident, or an unrecoverable window fails.

#### TC-EVID-004 - Record-level degradation versus window-level unverifiability

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-4, AC-F5-4, NFR-5, NFR-10, TDR-0015
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: phase-3 ledger `tests/behaviour/dispatch-unevaluable.test.ts`; phase-6 window `tests/behaviour/dispatch-gate-evidence.test.ts`
**Executable Slices**:
- Phase 3 (record, `dispatch-unevaluable.test.ts`): fixtures A and B produce an unevaluable attempt record with its classified identity; the record-level degradation is asserted without a summary.
- Phase 6 (window, `dispatch-gate-evidence.test.ts`): fixtures C (truncated valid) and D (unreadable/torn) assert the window verdict and exits.
**Tags**: @backend, @dispatch, @evidence

**Preconditions**:
- Fixture A: a non-success token whose comparison source cannot be read (`class: not-applicable`, `reason: comparison-source-unavailable`).
- Fixture B: a success-claimed token whose corroboration source cannot be read.
- Fixture C: a bounded valid read that omits some records (truncation).
- Fixture D: an unreadable or torn attempt-ledger read.

**Steps**:
1. Phase-3 slice: derive the fixture A result and append/read the attempt record through the ledger.
2. Phase-3 slice: derive the fixture B result and append/read the attempt record through the ledger.
3. Phase-6 slice: run the summary over fixture C.
4. Phase-6 slice: run the summary over fixture D.
5. Phase-6 slice: evaluate the gate over a window whose other conditions hold for fixtures A and B.

**Expected Outcome**:
- Fixture A: the record is recorded unevaluable with its classified state or provider identity; it still counts for class coverage as exposure, creates no divergence, and does not by itself block eligibility — the gate can return eligible with this record present.
- Fixture B: the success claim fails corroboration as exactly one named unmet condition; no divergence is created and the evidence window start does not move. The record is not a false-success incident.
- Fixture C: the summary declares the truncation and the omitted range, reports eligibility false/unverifiable, names every unmet condition, and exits `0` with no fabricated zeros (the pinned exit is asserted in `TC-GATE-006`).
- Fixture D: the summary declares the degradation, reports eligibility unverifiable, exits `2`, and never returns eligible.
- Record-level and window-level outcomes are asserted as distinct; no single degraded record makes the whole window unverifiable.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-unevaluable.test.ts tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a record-level degradation escalated to the window, a success claim silently counted clean, a divergence for an unevaluable record, or a truncated/unreadable window returning eligible fails.

#### TC-EVID-005 - Fenced append and torn reads never become clean

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: phase-3 ledger `tests/behaviour/dispatch-evidence-record.test.ts`; phase-6 summary/authority `tests/behaviour/dispatch-gate-evidence.test.ts`
**Executable Slices**:
- Phase 3 (append/torn record, `dispatch-evidence-record.test.ts`): failed attempt, divergence, and handover appends; torn attempt/divergence/handover payload reads; fence released.
- Phase 6 (window/authority, `dispatch-gate-evidence.test.ts`): the summary over a torn evidence stream and the authority-view read both degrade safely.
**Tags**: @backend, @dispatch, @state, @fault

**Preconditions**:
- The existing test state edge with injectable faults at append and read points.
- Torn attempt, divergence, and handover payload fixtures.

**Steps**:
1. Phase-3 slice: arm a pre-append fault and append an attempt; repeat for a divergence append and a handover append.
2. Phase-3 slice: arm a torn-read fault on each record kind and assert the classified failure and record count.
3. Phase-6 slice: arm a torn-read fault and run the summary and the authority view read.
4. Assert the verdicts, the record counts, and the fence release.

**Expected Outcome**:
- A failed attempt, divergence, or handover append yields a classified state failure; no clean verdict, no fabricated record.
- A torn read yields `state-unverified`, an unevaluable summary, or a dual-run authority default, never clean or authoritative.
- Every successful append of all three kinds is verified after write; the fence is released on both paths.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a clean verdict from a torn read or a failed append fails.

#### TC-EVID-006 - Evidence class is declared, closed, immutable, and never escalated

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-5, AC-F8-3, DM-1, EVT-1, NFR-10, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: phase-3 ledger `tests/behaviour/dispatch-evidence-class.test.ts`; phase-4 command `tests/behaviour/dispatch-harness-lease.test.ts`; phase-3 types `tests/types/dispatch-contract.type-test.ts`
**Executable Slices**:
- Phase 3 (ledger/type, `dispatch-evidence-class.test.ts` + `tests/types`): the class is declared, closed, immutable, never inferred, and never escalatable at the append boundary.
- Phase 4 (command, `dispatch-harness-lease.test.ts`): the production composition declares `pilot` on a real dispatch (cross-phase confirmation).
**Tags**: @backend, @dispatch, @evidence, @provenance

**Preconditions**:
- A production-default composition (no explicit class) and explicit compositions declaring `controlled-proof`, `smoke`, and `fixture`.
- A tampered-record fixture whose stored payload claims a different class than the one declared at creation.
- A record whose outcome is a success token but whose declaration is `fixture`.

**Steps**:
1. Phase-3 slice: append a record through a production-default composition input and assert `evidenceClass` is `pilot`.
2. Phase-3 slice: append under each explicit declaration and assert the record carries exactly that value.
3. Assert the stored value is one of the four closed literals; a fifth value is rejected at the contract boundary.
4. Run the same outcome under two different declarations and assert the classes differ, proving the class is not inferred from the outcome.
5. Append a record, then attempt an in-place class mutation and a second append that escalates the class; assert both are refused and the original record is byte-identical.
6. Supply a user-editable record payload that declares `pilot` from a `fixture` composition and assert the declared composition value wins or the payload is rejected.
7. Compile the type test against the closed union.
8. Phase-4 slice: dispatch once under the production default and confirm the command-level record carries `pilot`.

**Expected Outcome**:
- Exactly one declared class per attempt record, sourced from the declared invocation or composition input (or the documented configuration default), never inferred from the outcome and never read from record content.
- Immutable after append; no escalation path from `fixture`/`smoke`/`controlled-proof` to `pilot`.
- The type test fails if the union is widened or a class becomes optional.
- A production repository's counted window accepts only `pilot` records (the counting assertion is in `TC-GATE-011`).

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-evidence-class.test.ts tests/types` exits 0; a missing class, an inferred class, an accepted escalation, or an out-of-set value fails.

#### TC-EVID-007 - Comparison record shape and divergence-iff-mismatch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-6, AC-F4-2, DM-1, DM-2, DM-7, NFR-10, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: phase-3 unit `tests/behaviour/dispatch-comparison.test.ts`; phase-6 parity `tests/behaviour/dispatch-gate-evidence.test.ts`; phase-3 types `tests/types/dispatch-contract.type-test.ts`
**Executable Slices**:
- Phase 3 (unit/type, `dispatch-comparison.test.ts` + `tests/types`): the declared shape and all four invariants across the eleven tokens.
- Phase 6 (summary/handover parity, `dispatch-gate-evidence.test.ts`): both surfaces read the same comparison classification for the same attempt.
**Tags**: @backend, @dispatch, @comparison

**Preconditions**:
- One attempt record per token family, covering all eleven tokens.
- A declared comparison record type in the contracts tier.
- A deterministic divergence-id sequence.

**Steps**:
1. For each of the eleven tokens, read the comparison record and assert `class`, `token`, and `outcome`.
2. Assert the invariants: `token === null` if and only if `class === "not-applicable"`; `outcome === "not-applicable"` if and only if `class === "not-applicable"`.
3. Assert a divergence record is appended if and only if `outcome === "mismatch"`, and that `match` and `not-applicable` append none.
4. Assert `state-unverified` carries `reason: comparison-source-unavailable`; dispatch-session tokens carry `reason: dispatch-session-family`.
5. Phase-6 slice: assert the summary and the handover read the same comparison classification for the same attempt (`dispatch-gate-evidence.test.ts`).
6. Compile the type test against the record shape.

**Expected Outcome**:
- Exactly one declared shape: `class` in {`verify-change`, `tracker-truth`, `not-applicable`}, `token` a TDR-0005 token or null, `outcome` in {`match`, `mismatch`, `not-applicable`}, optional `reason`, and `urlResolved` present for tracker facts.
- All four invariants hold for all eleven tokens; a violation fails with the token named.
- No consumer re-derives family membership: both surfaces agree.
- The type test fails if the shape is widened or a field becomes optional.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-comparison.test.ts tests/behaviour/dispatch-gate-evidence.test.ts tests/types` exits 0; an invariant violation, a divergence for a non-mismatch, or a re-derived comparison fails.

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
- A seeded evidence window spanning several UTC dates with counted `pilot` dispatches, incidents, resolved and unresolved divergences, and a mix of counted and excluded evidence classes.

**Steps**:
1. Invoke `dispatch dual-run summary --repo REPO` in text and JSON modes.
2. Assert every DM-6 field, including the evidence classes counted and the cross-class exclusions.
3. Compare the text with the committed golden.

**Expected Outcome**:
- The summary reports window start and reason, elapsed days, counted deliveries, evidence classes counted with their exclusions, false-success incidents, divergences (reported, resolved, unresolved) with identifiers, class coverage as exposure with missing classes named, corroboration satisfaction for success claims, eligibility verdict, and every unmet condition.
- Text and envelope agree; the text is byte-identical to the golden.
- Exit `0` even when ineligible.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-summary.test.ts tests/golden/dispatch-summary.test.ts` exits 0; a missing field, an unreported class exclusion, or a non-zero exit on an ineligible verdict fails.

#### TC-GATE-002 - Eligibility is the four-condition conjunction

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, AC-F5-5, DM-7, DEC-11, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-summary.test.ts`
**Tags**: @backend, @dispatch, @gate

**Preconditions**:
- A fully eligible evidence fixture inside one evidence-class scope: zero incidents, zero unresolved divergences, all eleven classes including `state-unverified` and `pr-open-unverified`, floor met, every success claim corroborated.
- Four mutants, each breaking exactly one condition: a false-success incident, an unresolved divergence, a missing class, and an uncorroborated success claim.
- A floor-only mutant that meets the floor but fails coverage, to show the conjunction.

**Steps**:
1. Call `evaluateHandoverGate(evidence)` on the eligible fixture.
2. Call it on each single-condition mutant.
3. Assert the verdict and the named conditions.

**Expected Outcome**:
- The eligible fixture returns eligible `true` with no unmet condition, proving the conjunction is satisfiable.
- Each mutant returns ineligible and names exactly the broken condition; the rare classes never appear as unmet in the eligible fixture.
- The summary and handover evaluate the same predicate and produce the same verdict for the same fixture.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` exits 0; a single unmet condition accepted as eligible, or an eligible fixture blocked by a rare class, fails.

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
- Evidence with 20 counted `pilot`-class dispatches across 6 distinct UTC dates, all eleven classes covered, zero incidents, zero unresolved divergences, and full corroboration.
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
- Evidence with 14 counted `pilot`-class dispatches (2 per date) on 7 consecutive UTC dates, all other conditions satisfied.
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

#### TC-GATE-006 - Degraded evidence reads have pinned exits

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-4, AC-F4-4, AC-F6-1, NFR-4, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @gate, @fault

**Preconditions**:
- An unreadable evidence ledger; a torn record; a malformed payload.
- A valid but bounded read truncated at the 5,000-record bound, where more records exist.
- A repository identity that cannot be resolved.
- A handover over an unreadable evidence read and a handover over a readable-but-unmet bar.

**Steps**:
1. Run `dispatch dual-run summary --repo REPO` against the unreadable, torn, and malformed fixtures.
2. Run the summary against the bounded-but-truncated valid fixture.
3. Run `dispatch handover REPO` against the unreadable read and against the readable-but-unmet bar.
4. Run the summary and handover against the unresolvable-identity fixture.

**Expected Outcome**:
- Unreadable, torn, or malformed summary read: exit `2` with `dispatch.state-unverified` or a delivered `state.*` identity, the degraded field named, no fabricated zeros, and verdict `unverifiable`.
- Bounded-but-truncated valid read: exit `0`; the truncation and the omitted range are declared; eligibility is `false`/`unverifiable`; every unmet condition is named; no category is reported as zero merely because it was omitted.
- Handover with an unreadable or torn read: exit `2` with the classified identity and zero authority-changing records.
- Handover with a readable-but-unmet bar: exit `1` as a clean verification negative (asserted in detail by `TC-HAND-001`).
- Unresolvable repository identity: exit `1` clean refusal, not an empty success.
- No degraded case returns eligible, and no exit falls outside `0`, `1`, `2`.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; an unpinned exit, fabricated zeros, an eligible degraded verdict, or an empty success fails.

#### TC-GATE-007 - All eleven classes are coverable; full coverage is eligible

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, F-8, AC-F5-2, AC-F5-5, DM-7, DEC-11, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-dual-run-summary.test.ts`
**Tags**: @backend, @dispatch, @gate, @coverage

**Preconditions**:
- A positive fixture inside the controlled-proof scope covering all eleven tokens among counted dispatches, including:
  - a `state-unverified` record whose comparison is `not-applicable` and which creates no divergence;
  - a `pr-open-unverified` record whose comparison is `token: pr-open`, `outcome: match`, `urlResolved: false`.
- The same positive fixture has zero false-success incidents, zero unresolved divergences, the floor met, and every success claim corroborated.
- Eleven mutants, each removing exactly one class from the positive fixture.
- A fixture where dispatch-session tokens carry an explicit not-applicable comparison.

****Steps**:
1. Evaluate the positive fixture through `evaluateHandoverGate` and through `dispatch dual-run summary`.
2. Assert eligibility, the unmet-condition list, the class-coverage set, and the summary counts for the two previously unreachable classes.
3. Assert the same fixture is not refused by the handover surface: `dispatch handover` reads the same predicate and proceeds to the recorded flip (the full controlled-path flip is asserted by `TC-E2E-001` and `TC-HAND-002`).
4. Evaluate each single-class-removal mutant.
5. Assert the missing-class naming and the dispatch-session exposure rule.
6. Assert neither `state-unverified` nor `pr-open-unverified` produces a divergence or an unmet corroboration condition in the positive fixture.

**Expected Outcome**:
- The positive fixture returns eligible `true` with zero unmet conditions: coverage is exposure only, and both rare classes are simultaneously coverable, comparable, and (for `pr-open-unverified`) corroborable.
- `present` equals the eleven-token set; the two rare classes are named as present, not as missing or blocking.
- Each mutant names exactly the removed class and is ineligible.
- `state-unverified` counts for coverage, makes no success claim, and creates no divergence; `pr-open-unverified` counts as a corroborated success claim via the tracker fact.
- Dispatch-session tokens count as class exposure even though their token baseline is not-applicable.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` exits 0; a full-coverage fixture that is not eligible, a missing class not named, or a dispatch-session class excluded fails.

#### TC-GATE-008 - Family-wise comparison record shape

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-2, AC-F4-6, AC-F5-2, DM-1, DM-7, DEC-3, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @comparison

**Preconditions**:
- Three fixture families with their attempt records: a verify-class token with a verify-change ledger outcome, a tracker-pr token with independent tracker truth, and a dispatch-session token.
- The one declared comparison record builder and its shape declaration.

**Steps**:
1. Derive the comparison record for each family and assert the field values, not prose: `class`, `token`, `outcome`, `reason`, `urlResolved`.
2. Assert the `verify-change` family compares the engine token to the verify-change ledger outcome token by exact equality.
3. Assert the `tracker-truth` family compares at PR-state granularity: `pr-open-unverified` yields `token: pr-open`, `outcome: match`, `urlResolved: false`, and appends no divergence.
4. Assert the `dispatch-session` family yields `class: not-applicable`, `token: null`, `outcome: not-applicable`, `reason: dispatch-session-family`, and is exposure-only (no corroboration requirement, no divergence).
5. Assert a verify-class token is never compared against a `pr-open` result, and that a cross-family pairing is rejected as a fixture error.
6. Assert the summary and handover read the same comparison classification for each attempt.

**Expected Outcome**:
- Each family yields the declared record shape with the documented independent source; no comparison is asserted through prose or a free-text reason.
- `pr-open-unverified` produces a `match` at tracker-state granularity, never a permanent divergence.
- A not-applicable comparison is recorded as not-applicable, never as agreement and never as a divergence.
- Cross-family comparison is rejected as a fixture/contract error, not counted as agreement.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a cross-family comparison, a prose assertion, or a `pr-open-unverified` mismatch/divergence fails.

#### TC-GATE-009 - Incident lower bound is exclusive; post-incident recovery is eligible

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-3, AC-F5-1, AC-F5-6, DEC-10, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-window.test.ts`
**Tags**: @backend, @dispatch, @gate, @window

**Preconditions**:
- An incident set: 20 dispatches strictly before a false-success incident at T, 5 after.
- A recovery set: incident at T, then counted dispatches strictly after T covering all eleven classes, meeting the floor, with no further incidents or unresolved divergences and every success claim corroborated.
- A tie fixture: one dispatch recorded at exactly T.
- A resolved-divergence set with a resolution in the middle of the window.

**Steps**:
1. Evaluate the incident set and assert `windowStart`, `windowStartReason`, and counts.
2. Evaluate the recovery set and assert eligibility.
3. Evaluate the tie fixture and assert the same-instant dispatch is excluded.
4. Evaluate the resolved-divergence set.
5. Assert the floor and class-coverage re-accrual in each case.

**Expected Outcome**:
- The window lower bound is the most recent incident timestamp T, **exclusive**: `windowStart = T`, `windowStartReason = false-success-incident-reset`, and pre-incident dispatches are excluded from floor and coverage.
- The resetting incident never sits inside the evaluated window; the same-instant record at T is also excluded (`>` comparison, not `>=`).
- The recovery set returns eligible `true` with zero in-window incidents, all eleven classes, and the floor met.
- The resolved-divergence set keeps its original window start; the resolution does not reset it.
- The summary reports the window start and reason in every case.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-window.test.ts` exits 0; an inclusive bound, a same-instant record counted, an unrecoverable window, or a resolved divergence resetting the window fails.

#### TC-GATE-010 - Corroboration sufficiency per outcome family

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-8, AC-F5-2, AC-F5-5, DM-8, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-gate-evidence.test.ts`
**Tags**: @backend, @dispatch, @gate, @corroboration

**Preconditions**:
- A table of success-claimed outcomes and their required evidence: `merged` needs pushed head, CI on that head, tracker state, and completed phases; `pr-open` and `pr-open-unverified` need the tracker fact that the PR is open (not URL resolution); `blocked` needs the blocking tracker fact; `finished` needs the completed phase ledger; `noop-lane-nothing-to-do` needs the ledger or queue fact.
- A table of non-success tokens (`failed`, `partial`, `max-restarts`, `state-unverified`, `noop-lane-permission`) that make no success claim.

**Steps**:
1. For each success family, evaluate with all required evidence present.
2. Remove exactly one required source and re-evaluate.
3. Assert the corroboration tri-state and the gate verdict.
4. Evaluate the non-success tokens with no corroboration source at all.
5. Remove URL resolution from the `pr-open-unverified` fixture while keeping the tracker fact and re-evaluate.

**Expected Outcome**:
- Complete evidence satisfies corroboration; a missing required source is explicitly unsatisfied and blocks eligibility as one named condition.
- `pr-open-unverified` corroborates on the tracker fact; an unresolved URL alone never makes it unsatisfied and never creates a divergence.
- Non-success tokens satisfy corroboration vacuously and are never treated as uncorroborated success claims.
- The engine token alone never satisfies corroboration for any family.
- The summary lists satisfied and unsatisfied corroboration per family.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a token-only success satisfying corroboration, an unresolved URL blocking the tracker fact, or a non-success token counted as an uncorroborated claim fails.

#### TC-GATE-011 - Evidence-class counting per repository scope

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, F-8, AC-F8-3, AC-F4-5, AC-F5-1, DM-6, DM-7, NFR-10, TDR-0015
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-evidence-class.test.ts`
**Tags**: @backend, @dispatch, @gate, @provenance

**Preconditions**:
- A production repository identity whose ledger mixes `pilot` attempts with `controlled-proof`, `smoke`, and `fixture` attempts, where the non-pilot attempts alone would supply several missing classes and part of the floor.
- A controlled repository scope whose ledger mixes `controlled-proof` attempts with one `pilot` and one `fixture` attempt.
- A controlled-proof attempt recorded under the production repository identity.
- A summary reader over each scope.

**Steps**:
1. Run `dispatch dual-run summary --repo PROD`; assert the counted dispatch population and the excluded classes.
2. Build a variant where the production window can only reach full coverage and the floor by counting non-`pilot` records, and assert ineligibility with coverage and floor named.
3. Run the summary over the controlled scope; assert only `controlled-proof` attempts count and zero non-`controlled-proof` attempts count.
4. Assert `smoke` and `fixture` attempts contribute to no floor, no coverage, no incident count, and no corroboration in either scope.
5. Assert the cross-scope controlled-proof record under the production identity is surfaced as excluded rather than silently accepted.

**Expected Outcome**:
- Production counts exactly the `pilot` population; zero non-`pilot` attempts are counted; every excluded class is reported.
- The controlled scope counts exactly the `controlled-proof` population; zero non-`controlled-proof` attempts are counted.
- `smoke` and `fixture` evidence never advances a handover in any scope.
- A cross-scope count is surfaced in the summary and does not make the production repository eligible.
- The counting rule is the same predicate, differing only by the scope's counted class.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-evidence-class.test.ts` exits 0; a non-pilot production count, a non-controlled-proof controlled count, a silent cross-scope acceptance, or a fixture/smoke count fails.

#### TC-HAND-001 - Readable-but-unmet refuses at exit 1; unreadable evidence at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F5-4, DM-7, EVT-3, SC-M1-29
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover

**Preconditions**:
- A readable-but-unmet repository whose evidence is missing one class, has one unresolved divergence, and has not met the floor.
- A second repository whose evidence read is unreadable or torn.
- A recording authority-view writer and a recording handover appender.

**Steps**:
1. Invoke `dispatch handover REPO` on the readable-but-unmet repository.
2. Assert the exit, the negative verdict, and the named conditions.
3. Assert the handover ledger and the authority view.
4. Invoke `dispatch handover REPO` on the unreadable/torn repository.
5. Assert the exit, the classified identity, the handover ledger, and the authority view again.

**Expected Outcome**:
- Readable-but-unmet: exit `1` with a clean verification negative verdict; every unmet condition is named (including the missing class, the unresolved divergence identifier, the floor, and any uncorroborated success claim); zero authority-changing records are appended; the view stays absent or unchanged and therefore `dual-run`.
- Unreadable or torn: exit `2` with `dispatch.state-unverified` or a delivered `state.*` identity and a remediation hint; zero authority-changing records are appended; the view stays `dual-run`.
- In both cases the bash stack remains authoritative and prints no deprecation pointer.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; an authority change on refusal, an unnamed condition, exit `1` for an unreadable read, or exit `2` for a readable-but-unmet bar fails.

#### TC-HAND-002 - Met gate flips one repository and records it

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DM-3, DM-4, EVT-3, SC-M1-29, DEC-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover

**Preconditions**:
- Repo-alpha meets all four conditions, including all eleven classes with a `state-unverified` exposure record and a tracker-corroborated `pr-open-unverified` record; repo-beta does not.
- Both repositories resolve an identity through the declared resolution order (scheduler key first).
- A recording authority-view writer.

**Steps**:
1. Invoke `dispatch handover REPO-ALPHA`.
2. Assert the handover record, the recorded resolved identity, the authority view, and the reported flip.
3. Inspect repo-beta's authority.

**Expected Outcome**:
- One handover record with the conditions snapshot, bounded evidence references, the recording principal, the timestamp, and the resolved repository identity (`host/owner/name` form, not a checkout path).
- Repo-alpha's view is `authoritative` with the handover reference, recorded time, and reversal availability; the write is atomic.
- Repo-beta remains `dual-run` and is byte-identical before and after.
- The announcement says the flip is recorded and reversible.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; a second record, a non-atomic write, a path-shaped identity, or a beta flip fails.

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
**Related IDs**: F-6, F-7, AC-F6-4, DM-4, NFR-5, DEC-13
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: phase-3 structure `tests/structure/dispatch-authority-view.test.ts`; phase-6 fold parity `tests/behaviour/dispatch-handover.test.ts`
**Executable Slices**:
- Phase 3 (structure/unit, `dispatch-authority-view.test.ts`): schema fields, atomic replacement, rebuild from a folded-ledger fixture, and the absent/unreadable/malformed dual-run default.
- Phase 6 (fold parity, `dispatch-handover.test.ts`): the view equals the folded handover ledger after the real flip and reversal; this is a cross-phase confirmation in the handover suite, not in the phase-3 structure file.
**Tags**: @backend, @dispatch, @authority

**Preconditions**:
- Fixtures for a valid dual-run view, a valid authoritative view, an absent view, an unreadable view, a malformed JSON view, and a torn pair of prior and next files.
- A folded handover ledger with one flip and one reversal.
- An injected atomic writer.

**Steps**:
1. Validate the view fields against `delivery.dispatch.authority.v1`.
2. Phase-6 slice: in `dispatch-handover.test.ts`, rebuild the view from the folded ledger after the real flip and after the reversal, and assert it equals the folded truth.
3. Replace the view and assert the reader observes only a complete prior or next version.
4. Read each degraded fixture through `readDispatchAuthority`.

**Expected Outcome**:
- The view names the resolved repository identity, authority, handover reference, recorded time, and reversal availability.
- After any flip or reversal the view equals the folded ledger truth: no stale handover reference, no stale authority, no torn mix.
- Replacement is atomic; no torn mix is observed.
- Absent, unreadable, or malformed resolves to `dual-run`; no throw escapes to callers.

**Pass/Fail Evidence**:
- `bun test tests/structure/dispatch-authority-view.test.ts` (phase 3) and `bun test tests/behaviour/dispatch-handover.test.ts` (phase 6) exit 0; a torn read, a view that disagrees with the fold, or a non-dual-run default fails.

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
**Related IDs**: F-6, AC-F6-2, DEC-13, TDR-0015
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover.test.ts`
**Tags**: @backend, @dispatch, @handover, @isolation

**Preconditions**:
- Repo-alpha and repo-beta both have evidence; alpha meets the gate, beta does not.
- Both identities resolve from the scheduling engine's normalized `repository` field.
- A second fixture where the identity resolves from the normalized VCS remote, and a third where it resolves from the persisted first-use marker.

**Steps**:
1. Flip alpha and assert both authority views and both handover ledgers.
2. Revert alpha and assert both views again.
3. Repeat with the remote-derived and marker-derived identities.
4. Assert no aggregate or global authority record exists.

**Expected Outcome**:
- Every operation touches only the named repository; beta's view and ledger are byte-identical before and after.
- The identity is the resolved `host/owner/name` form (or the persisted marker's binding), never a checkout-path digest.
- No aggregate, global, or wildcard authority record is written.
- A flip or reversal for one repository never changes another's authority or evidence window.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-handover.test.ts` exits 0; a beta change, a global flip, or a path-derived identity fails.

#### TC-HAND-007 - Repository identity is rename-invariant; unresolvable identity refuses

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, AC-F6-4, AC-F6-6, DM-4, DEC-13, TDR-0015
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: phase-3 identity `tests/behaviour/dispatch-identity.test.ts`; phase-6 refusal `tests/behaviour/dispatch-handover.test.ts` and `tests/behaviour/dispatch-dual-run-summary.test.ts`
**Executable Slices**:
- Phase 3 (identity resolution, `dispatch-identity.test.ts`): call `resolveDispatchIdentity(...)` for the scheduler key, normalized remote, and persisted marker paths; assert rename/remote/restart reuse and no path digest. No `dispatch` or `handover` command.
- Phase 6 (summary/handover, `dispatch-handover.test.ts` + `dispatch-dual-run-summary.test.ts`): the unresolvable-identity refusal for `dispatch dual-run summary` and `dispatch handover`; step 5 is a cross-phase confirmation in those files, not in the phase-3 identity file.
**Tags**: @backend, @dispatch, @identity, @handover

**Preconditions**:
- A temporary checkout with a configured local bare remote and a state root.
- Three resolution paths available in order: the scheduling engine's normalized `repository` key, the normalized VCS remote, and a persisted first-use marker created through the store-managed artifact.
- A fixture where none of the three resolves.

**Steps**:
1. Phase-3 slice: call `resolveDispatchIdentity(...)` with the scheduler `repository` key present; assert the normalized `host/owner/name` identity.
2. Phase-3 slice: with no scheduler key, configure the local bare remote and assert the normalized remote identity; restart the process and assert the same identity is reused.
3. Phase-3 slice: with no scheduler key and no remote, create the persisted first-use marker through the store-managed artifact; rename the checkout and restart; assert the marker is reused and never regenerated.
4. Phase-3 slice: assert that no identity field or resolved value is ever a checkout-path digest.
5. Phase-6 slice: run `dispatch dual-run summary` and `dispatch handover` with none of the three resolvable, in `dispatch-dual-run-summary.test.ts` and `dispatch-handover.test.ts`.

**Expected Outcome**:
- Resolution follows the declared order; the first successful step is persisted and reused.
- A checkout rename, a remote change, or a restart does not re-key the identity: the same resolved identity is observed at the identity layer.
- The persisted marker is created once and refused a silent regeneration while guarded records exist.
- A checkout-path digest is never presented as a stable identity.
- The resolved identity is the key used by evidence records and the authority view, so a stable identity means no record or authority entry is re-keyed on rename or restart.
- Phase-6 confirmation: with no resolvable identity, summary and handover exit `1` as a clean refusal with a classified identity and append no authority-changing record; neither reports an empty success.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-identity.test.ts` (phase 3) and `bun test tests/behaviour/dispatch-dual-run-summary.test.ts tests/behaviour/dispatch-handover.test.ts` (phase 6) exit 0; an identity re-keyed after rename/restart, a regenerated marker, a path-digest identity, or an empty success on an unresolvable identity fails.

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

#### TC-E2E-001 - Controlled-proof evidence reaches eligibility, flips, and dispatches

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-1, F-4, F-5, F-6, AC-F8-1, AC-F8-3, AC-F5-5, AC-F4-5, SC-M1-29, TDR-0015
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-e2e.test.ts`
**Tags**: @conformance, @dispatch, @handover

**Preconditions**:
- A controlled temporary repository with the real state store, real local git, and real change files, plus injected harness, tracker, CI, and VCS read ports.
- A controlled composition that declares `evidenceClass: controlled-proof` for every dispatch it drives; a provenance guard counts command-originated appends and rejects test-local ledger writes.
- A deterministic clock able to advance UTC dates without sleeping.
- A scripted harness evidence set able to produce all eleven classes across real dispatch invocations, including:
  - one dispatch whose truth read is fault-injected so it classifies `state-unverified` (exposure-only, not-applicable comparison, no divergence);
  - one dispatch whose URL read returns empty while the tracker reports an open PR, so it classifies `pr-open-unverified` (tracker-truth match with `urlResolved: false`).

**Steps**:
1. Run real `dispatch` invocations through the command path until the gate is met inside the controlled scope: all eleven classes, floor met, zero incidents, zero unresolved divergences, every success claim corroborated.
2. Assert every produced attempt record carries `evidenceClass: controlled-proof`; assert the provenance guard shows attempt count equals dispatch count and that no record was hand-inserted.
3. Run `dispatch dual-run summary --repo REPO` and assert eligibility `true` with no unmet condition, `windowStart`, and `windowStartReason`.
4. Run `dispatch handover REPO` and assert the flip and the handover record.
5. Run one more dispatch and assert a valid token, the summary, and one new attempt record.
6. Assert zero non-`controlled-proof` attempts were counted in this scope and no record was counted toward a production repository identity.

**Expected Outcome**:
- Every record is produced by the real commands; the summary reaches eligibility through real dispatch invocations with injected external ports, not by seeding the ledger.
- All eleven classes are present, including `state-unverified` (coverage only) and `pr-open-unverified` (tracker-corroborated); neither blocks eligibility.
- Handover flips only the controlled repository and records the conditions snapshot.
- The post-handover dispatch completes end to end through the typed stack with a valid token and record.
- The provenance guard proves no hand-inserted evidence; the controlled scope counts zero non-`controlled-proof` attempts.
- No real remote, network, or model is touched.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` exits 0; hand-inserted evidence, an unreachable eligibility, a pre-eligible flip, a mis-declared evidence class, a cross-scope count, or a failed post-handover dispatch fails.

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

#### TC-E2E-003 - Fixture evidence is command-produced and never counted cross-scope

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, F-4, F-5, AC-F8-1, AC-F8-3, AC-F4-5
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-fixture.test.ts`
**Tags**: @conformance, @dispatch, @fixture

**Preconditions**:
- The controlled fixture exposes no direct attempt, divergence, or handover append helper to test bodies.
- A provenance guard counts command-originated appends and their declared evidence class.
- A controlled-proof record produced under a production repository identity is available as a fixture case.

**Steps**:
1. Assert the fixture API surface has no ledger writer.
2. Assert the attempt count equals the number of real dispatch invocations and that every record carries `controlled-proof`.
3. Attempt a test-local direct record write and assert the fixture guard rejects it or the record is not counted.
4. Record a controlled-proof attempt under a production repository identity, then run the production summary and assert the record is surfaced as excluded and does not count toward floor, coverage, incidents, or corroboration.
5. Repeat with `smoke` and `fixture` attempts and assert they count toward no handover in either scope.

**Expected Outcome**:
- No test can hand-insert evidence through the fixture.
- Every counted record carries command-produced provenance (run id and attempt identity) and the composition's declared evidence class.
- A hand-inserted record is either impossible or explicitly excluded from the gate.
- A cross-scope controlled-proof or smoke/fixture record is surfaced and never counted for the production repository.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-fixture.test.ts` exits 0; a fixture writer, a mismatch between dispatches and records, or a counted cross-scope record fails.

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

#### TC-DAEMON-002 - Daemon lane produces the same token, outcome, and attempt record as one-shot

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-1, F-4, AC-F10-2, AC-F4-1, EVT-1, NFR-10
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-daemon-lane.test.ts`
**Tags**: @conformance, @dispatch, @daemon

**Preconditions**:
- The real planner and executor composition over a scripted harness port, sharing the harness port and the shared classifier with the one-shot path.
- A temporary state root with a lane record and a queue action.
- A one-shot dispatch fixture over the same evidence set.
- A recording attempt-ledger reader and a deterministic clock and id sequence.

**Steps**:
1. Call `runSupervisionCycle(...)` with the production planner and executor.
2. Assert start, the delivered lane record, observation, and collection.
3. Assert the daemon path produces a final token and outcome and appends exactly one attempt record carrying the same derived fields as the one-shot record.
4. Compare final token, outcome, comparison record, evidence class, and corroboration tri-state with the one-shot dispatch over the same evidence.
5. Resume the lane through the executor and assert no second attempt record and no second effect for the same attempt.
6. Assert the attempt count equals the number of daemon-driven dispatch attempts that reached classification (the resume in step 5 adds none).

**Expected Outcome**:
- The lane is started, recorded, observed, collected, and resumed through the delivered seam.
- The daemon path and the one-shot path agree on the final token, outcome, comparison record, and corroboration tri-state for the same evidence; no second classification exists.
- The daemon path appends exactly one attempt record per attempt (the producer introduced in plan phase 9); a replay or resume appends none.
- No duplicate lane record and no divergent classification.

**Pass/Fail Evidence**:
- `bun test tests/conformance/dispatch/dispatch-daemon-lane.test.ts` exits 0; a missing lane record, a missing or duplicated attempt record, or a token/comparison mismatch against one-shot fails.

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

#### TC-HELP-003 - Production-surface absence assertions are inverted; the pilot fixture stays reduced

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, F-12, AC-F11-3, DEC-4, RSK-12
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-composition.test.ts` (updated), `tests/conformance/pilot/pilot-isolation.test.ts` (comment narrowed only), and `tests/structure/harness-review-deferrals.test.ts` (updated)
**Tags**: @backend, @dispatch, @structure, @deferral

**Preconditions**:
- The two production-surface absence assertions exist in the current tree: the entrypoint-composition expectation and the harness-review-deferrals assertion.
- `tests/conformance/pilot/pilot-isolation.test.ts` guards a deliberately reduced, test-only pilot fixture: an exact reduced command list and the fixture's non-import of production/entrypoint modules. It is not a production-surface absence claim.

**Steps**:
1. Assert the entrypoint-composition test expects `dispatch` present and no longer asserts its absence.
2. Assert the harness-review-deferrals test no longer asserts "no dispatch surface or spawn-failure row"; it asserts the F-9 record names dispatch as the production consumer and carries a status and revisit trigger.
3. Assert the pilot-isolation test still guards the reduced fixture: the exact reduced command list is asserted, the fixture still does not import production/entrypoint modules, and `dispatch` is **not** composed into that fixture.
4. Assert the pilot-isolation test's stale "no dispatch" comment is narrowed and that its assertion set is not weakened or widened.
5. Assert the F-9 status is either resolved or explicitly a follow-up, never the blanket absence claim.

**Expected Outcome**:
- Only the two production-surface assertions are retired or inverted; neither contradicts the delivered command.
- The pilot-isolation fixture stays reduced and is **not** required to compose dispatch; composing dispatch into it fails the isolation guard.
- The F-9 record states the production-consumer outcome and a revisit trigger; full resolution is not required.
- Re-introducing a production-surface absence assertion fails the suite.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-composition.test.ts tests/conformance/pilot/pilot-isolation.test.ts tests/structure/harness-review-deferrals.test.ts` exits 0; a stale production-surface absence assertion, a blanket deferral claim, a weakened isolation fixture, or dispatch composed into the reduced fixture fails.

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

#### TC-ERR-001 - Spawn failure classifies as `dispatch.session.spawn-failed` with `failed`/`failed`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, DM-1, EVT-1, NFR-1, Appendix G
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-error-envelope.test.ts`
**Executable Slices**:
- Phase 4 (command + ledger): the command path produces the failure and the phase-3 ledger appends its attempt record; both exist by phase 4.
**Tags**: @backend, @dispatch, @errors

**Preconditions**:
- A harness port whose `spawn` fails before a session exists (transport failure or validated refusal distinct from harness-path `refused`).
- The machine and documented error tables.

**Steps**:
1. Dispatch and assert the exit and envelope.
2. Read the attempt ledger and assert exactly one record with token `failed`, outcome `failed`, and comparison `class: not-applicable`, `token: null`, `outcome: not-applicable`, `reason: comparison-source-unavailable`; zero divergences.
3. Assert the machine row and the documented row.

**Expected Outcome**:
- Identity `dispatch.session.spawn-failed`, category user-validation, exit `1`.
- Result token `failed` with outcome `failed` (Appendix G); exactly one attempt record carrying that pair, exposure-only and with no divergence.
- Both the machine and documented tables carry the row with matching fields.
- No session handle is fabricated; no success token is emitted.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-error-envelope.test.ts` exits 0; a missing row, an exit other than `1`, a wrong token/outcome pair, or a missing/duplicate attempt record fails.

#### TC-ERR-002 - Dispatch state failure classifies as `dispatch.state-unverified`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, DM-1, EVT-1, NFR-1, Appendix G
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-error-envelope.test.ts`
**Executable Slices**:
- Phase 4 (command + ledger): the command path produces the failure and the phase-3 ledger appends its attempt record.
**Tags**: @backend, @dispatch, @errors, @state

**Preconditions**:
- A dispatch-specific unverifiable truth read that is not covered by a generic `state.*` identity.

**Steps**:
1. Dispatch and assert the identity and exit.
2. Read the attempt ledger and assert exactly one record with token `state-unverified`, comparison `class: not-applicable`, `token: null`, `outcome: not-applicable`, `reason: comparison-source-unavailable`; zero divergences.
3. Assert both tables.
4. Assert the result token and remediation hint.

**Expected Outcome**:
- Identity `dispatch.state-unverified`, category platform-provider, exit `2`.
- The result token is `state-unverified`; the envelope carries a remediation hint.
- Exactly one attempt record with the not-applicable/exposure-only comparison and no divergence.
- The machine and documented rows agree.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-error-envelope.test.ts` exits 0; exit `1`, a missing row, a missing/duplicate attempt record, or a divergence from a not-applicable comparison fails.

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
2. Assert the truncation declaration, the omitted range, and the counts.
3. Assert the verdict and the exit code.

**Expected Outcome**:
- The summary declares truncation and the omitted range; it does not report zero for an omitted category.
- Eligibility is reported false/unverifiable with every unmet condition named; it is never eligible.
- Exit is `0` for this bounded-but-truncated **valid** read (a truncated read is not an unreadable stream; the `2` case is pinned in `TC-GATE-006`).
- The bounded window is named in the output.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/dispatch-gate-evidence.test.ts` exits 0; a silent omission, a fabricated zero, an eligible verdict, or a non-zero exit for a truncated valid read fails.

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
- **Declared evidence class.** The evidence class is supplied by the composition under test (production default `pilot`, the controlled proof `controlled-proof`, explicit `smoke`/`fixture`), never by a test-side record field. A provenance guard counts command-originated appends and fails if a test writes the ledger directly.
- **Real state and local git.** Conformance suites use the real state store over the existing test edge and a local temporary git repository; only harness, tracker, CI, VCS, and provider surfaces are injected.
- **Deterministic identity fixtures.** Repository identity comes from injected scheduler keys, a local bare-remote configuration, and the store-managed persisted marker; tests rename the checkout and restart the process explicitly rather than mutating a path digest.
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
| Evidence class | Declared by the composition under test (`pilot` default, `controlled-proof`, `smoke`, `fixture`); never written by a test body. | Closed union assertion; provenance guard counts command-originated appends only. |
| Repository identity | Injected scheduler `repository` key, a local bare-remote configuration for the normalized remote path, and the real store-managed persisted marker for the third path. | Fixed identities; explicit rename and restart steps; no checkout-path digest in any assertion. |
| Clock and ids | Injected `nowIso`, date advance, and id sequence. | No `Date.now()` or random id in an assertion path. |
| Model and provider | Recording ports that fail the test if called. | Zero-call assertions in help, summary, gate, classification, and render. |
| Bash typed CLI | `PATH` excludes the binary, or points to a stub that exits non-zero or hangs. | Absence, broken, and hanging conditions; a bounded guard fails on hang. |
| Merge | A recording merge port and a structural import scan. | Zero-call and zero-import assertions. |

### 6.3 Test Data and Fixtures Inventory

| Fixture / data | Status | Purpose |
|---|---|---|
| `tests/fixtures/dispatch/harness.ts` | New | Temp state root, fixed clock, scripted harness session port, recording tracker/CI/VCS/model ports, id sequence. |
| `tests/fixtures/dispatch/ledger.ts` | New | Builders for attempt, comparison, divergence, handover, and authority-view records with deterministic identities. |
| `tests/fixtures/dispatch/evidence-windows.ts` | New | Window cases: 20 dispatches on 6 dates; 19 dispatches; 14 dispatches on 7 consecutive dates; gapped dates; incident reset at T; same-instant record at T; post-incident recovery; resolved divergence; all-eleven coverage including `state-unverified` and `pr-open-unverified`; one-class-missing mutants; uncorroborated success; bounded-but-truncated read. |
| `tests/fixtures/dispatch/evidence-classes.ts` | New | Mixed-class ledgers per repository scope: production `pilot` only, controlled `controlled-proof` only, mixed with `smoke`/`fixture`, and a controlled-proof record under a production identity. |
| `tests/fixtures/dispatch/truth.ts` | New | Tracker, CI, VCS, ledger, and phase truth fixtures for every token family and every contradiction case, including an open-PR fact with an empty URL read and an unreadable truth read for the `state-unverified` record. |
| `tests/fixtures/dispatch/identity.ts` | New | Scheduler-key, normalized-remote, persisted-marker, and unresolvable repository identity fixtures, with rename and restart steps. |
| `tests/fixtures/dispatch/comparison.ts` | New | One declared comparison record per family and per token, plus the `mismatch` and `not-applicable` negatives. |
| `tests/fixtures/dispatch/authority/` | New | Valid dual-run, valid authoritative, absent, unreadable, malformed, and torn authority-view fixtures. |
| `tests/fixtures/dispatch/golden/` | New | Byte-pinned four-key text, summary text, handover text, and error envelopes. |
| `tests/fixtures/dispatch/mutants/` | New | One mutant per negative rule: extra key, second token list, exit literal, merge import, stale planning phrase, silent truncation, escalated evidence class, inclusive incident bound. |
| `tests/fixtures/dispatch/bash/` | New | Temp state roots and authority-view fixtures for the twelve-cell bash matrix. |
| `tests/conformance/dispatch/controlled-repo.ts` | New | Controlled repository with real state, git, and change files; injected external ports; `controlled-proof` declaration; provenance guard; deterministic date advance; fault-injected unreadable read and empty URL read for the two rare classes. |
| `tests/fixtures/state/harness.ts` | Existing | Real state store, fault injection, temp roots. |
| `tests/fixtures/economics/harness.ts` | Existing | Restart budget and resume economics fixtures reused by the resume scenarios. |
| `tests/fixtures/pilot/*` | Existing | Stub/real matrix and isolation guards reused by the conformance suite where the controlled repository needs the same no-spawn guard; the pilot fixture itself stays reduced and does not compose dispatch. |
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

The earliest executable phase and the per-phase slice split for every TC are declared in Section 7.5. This table names the files and commands; a file listed with a phase marker (P2-P10) is run only in that phase for the marked slice.

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
| TC-DISP-011 | `tests/behaviour/dispatch-token-closure.test.ts`; `tests/behaviour/dispatch-evidence-record.test.ts`; `tests/behaviour/dispatch-harness-lease.test.ts` | `bun test tests/behaviour/dispatch-token-closure.test.ts tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-harness-lease.test.ts` | To Implement | Shared classifier; `spawnRefused` evidence; attempt ledger; three pre-session refusal fixtures |
| TC-DISP-012 | `tests/behaviour/dispatch-token-closure.test.ts` | `bun test tests/behaviour/dispatch-token-closure.test.ts` | To Implement | Exhausted-lane and open-phase fixtures |
| TC-TRUTH-001 | `tests/behaviour/dispatch-truth-derivation.test.ts` (P2); `tests/behaviour/dispatch-evidence-record.test.ts` (P3); `tests/behaviour/dispatch-harness-lease.test.ts` (P4 confirmation) | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` (P2); later slices per Section 7.5 | To Implement | Exit-0/no-artifact truth input; record builder |
| TC-TRUTH-002 | `tests/behaviour/dispatch-truth-derivation.test.ts` (P2); `tests/behaviour/dispatch-comparison.test.ts` (P3); `tests/behaviour/dispatch-harness-lease.test.ts` (P4 confirmation) | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` (P2); later slices per Section 7.5 | To Implement | Open-PR truth input; comparison record fixture |
| TC-TRUTH-003 | `tests/behaviour/dispatch-truth-derivation.test.ts` (P2); `tests/behaviour/dispatch-comparison.test.ts` (P3); `tests/behaviour/dispatch-harness-lease.test.ts` (P4 confirmation); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6 confirmation) | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` (P2); later slices per Section 7.5 | To Implement | Empty-URL truth input; comparison fixture; gate fixture |
| TC-TRUTH-004 | `tests/behaviour/dispatch-truth-derivation.test.ts` (P2); `tests/behaviour/dispatch-merge-absence.test.ts` (P4 confirmation) | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` (P2); `tests/behaviour/dispatch-merge-absence.test.ts` (P4) | To Implement | Merged-state truth input; merge recorder |
| TC-TRUTH-005 | `tests/behaviour/dispatch-truth-derivation.test.ts` (P2); `tests/behaviour/dispatch-evidence-record.test.ts` (P3); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6 confirmation) | `bun test tests/behaviour/dispatch-truth-derivation.test.ts` (P2); later slices per Section 7.5 | To Implement | Blocking-state and missing-fact inputs; corroboration fixture |
| TC-TRUTH-006 | `tests/behaviour/dispatch-state-unverified.test.ts` (P2); `tests/behaviour/dispatch-evidence-record.test.ts` (P3); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6); `scripts/.tests/test-dispatch-bash-fallback.sh` (P8 confirmation) | `bun test tests/behaviour/dispatch-state-unverified.test.ts` (P2); later slices per Section 7.5 | To Implement | Fault-injected read inputs; four degradation fixtures; window fixture; bash runner |
| TC-RESUME-001 | `tests/behaviour/dispatch-resume.test.ts` | `bun test tests/behaviour/dispatch-resume.test.ts` | To Implement | Blocked lane; adapter without injection |
| TC-RESUME-002 | `tests/behaviour/dispatch-restart-budget.test.ts` | `bun test tests/behaviour/dispatch-restart-budget.test.ts` | To Implement | Budget fixture; exhaustion record; escalation recorder |
| TC-RESUME-003 | `tests/behaviour/dispatch-resume-economics.test.ts` | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | To Implement | Economics fixtures; unreadable-facts fixture |
| TC-RESUME-004 | `tests/behaviour/dispatch-resume-economics.test.ts` | `bun test tests/behaviour/dispatch-resume-economics.test.ts` | To Implement | Fixed clock/ids; replay harness |
| TC-EVID-001 | `tests/behaviour/dispatch-evidence-record.test.ts`; `tests/behaviour/dispatch-harness-lease.test.ts`; `tests/types/dispatch-contract.type-test.ts` | `bun test tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-harness-lease.test.ts tests/types` | To Implement | Record builders; attempt-stage refusal fixtures only (incl. spawn refusal); canaries; declared types |
| TC-EVID-002 | `tests/behaviour/dispatch-divergence.test.ts` (phase 6; phase-3 divergence append primitive is covered by `TC-EVID-005` in `dispatch-evidence-record.test.ts`) | `bun test tests/behaviour/dispatch-divergence.test.ts` | To Implement | Mismatch and non-mismatch fixtures; resolve command; summary |
| TC-EVID-003 | `tests/behaviour/dispatch-false-success.test.ts` (P3); `tests/behaviour/dispatch-gate-window.test.ts` (P6) | `bun test tests/behaviour/dispatch-false-success.test.ts tests/behaviour/dispatch-gate-window.test.ts` (split by phase per Section 7.5) | To Implement | Contradicting truth; pre-incident, tie-at-T, and post-incident recovery fixtures |
| TC-EVID-004 | `tests/behaviour/dispatch-unevaluable.test.ts` (P3); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6) | `bun test tests/behaviour/dispatch-unevaluable.test.ts tests/behaviour/dispatch-gate-evidence.test.ts` (split by phase per Section 7.5) | To Implement | Unreadable comparison; unreadable corroboration; truncated and unreadable windows |
| TC-EVID-005 | `tests/behaviour/dispatch-evidence-record.test.ts` (P3); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6) | `bun test tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-gate-evidence.test.ts` (split by phase per Section 7.5) | To Implement | Test state edge faults; torn payload |
| TC-EVID-006 | `tests/behaviour/dispatch-evidence-class.test.ts` (P3); `tests/behaviour/dispatch-harness-lease.test.ts` (P4 confirmation); `tests/types/dispatch-contract.type-test.ts` | `bun test tests/behaviour/dispatch-evidence-class.test.ts tests/types` (P3); `tests/behaviour/dispatch-harness-lease.test.ts` (P4) | To Implement | Declared-class compositions; tampered payload; escalation mutant |
| TC-EVID-007 | `tests/behaviour/dispatch-comparison.test.ts` (P3); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6); `tests/types/dispatch-contract.type-test.ts` | `bun test tests/behaviour/dispatch-comparison.test.ts tests/types` (P3); `tests/behaviour/dispatch-gate-evidence.test.ts` (P6) | To Implement | One record per token family; shape declaration; divergence counter |
| TC-GATE-001 | `tests/behaviour/dispatch-dual-run-summary.test.ts`; `tests/golden/dispatch-summary.test.ts` | `bun test tests/behaviour/dispatch-dual-run-summary.test.ts tests/golden/dispatch-summary.test.ts` | To Implement | Seeded window; text/envelope goldens |
| TC-GATE-002 | `tests/behaviour/dispatch-dual-run-summary.test.ts` | `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` | To Implement | Eligible fixture plus four single-condition mutants |
| TC-GATE-003 | `tests/behaviour/dispatch-dual-run-floor.test.ts` | `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` | To Implement | 20/19-dispatch fixtures on 6 dates |
| TC-GATE-004 | `tests/behaviour/dispatch-dual-run-floor.test.ts` | `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` | To Implement | 7-consecutive-date and gapped fixtures |
| TC-GATE-005 | `tests/behaviour/dispatch-dual-run-floor.test.ts` | `bun test tests/behaviour/dispatch-dual-run-floor.test.ts` | To Implement | Floor-met mutants |
| TC-GATE-006 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | Unreadable, torn, malformed, truncated, unresolvable-identity fixtures; unreadable and unmet handover fixtures |
| TC-GATE-007 | `tests/behaviour/dispatch-dual-run-summary.test.ts` | `bun test tests/behaviour/dispatch-dual-run-summary.test.ts` | To Implement | Positive all-eleven fixture (incl. both rare classes) plus eleven removal mutants |
| TC-GATE-008 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | Three family fixtures; record-shape declaration; not-applicable baseline |
| TC-GATE-009 | `tests/behaviour/dispatch-gate-window.test.ts` | `bun test tests/behaviour/dispatch-gate-window.test.ts` | To Implement | Pre/post-incident fixture; same-instant tie; post-incident recovery; resolved divergence |
| TC-GATE-010 | `tests/behaviour/dispatch-gate-evidence.test.ts` | `bun test tests/behaviour/dispatch-gate-evidence.test.ts` | To Implement | Family sufficiency matrix; pr-open-unverified tracker fact; non-success vacuous case |
| TC-GATE-011 | `tests/behaviour/dispatch-evidence-class.test.ts` | `bun test tests/behaviour/dispatch-evidence-class.test.ts` | To Implement | Mixed-class ledgers per scope; cross-scope record; summary reader |
| TC-HAND-001 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Readable-but-unmet and unreadable fixtures; recording writers |
| TC-HAND-002 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Alpha-met/beta-unmet fixtures; resolved identities |
| TC-HAND-003 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Authoritative fixture; replay |
| TC-HAND-004 | `tests/structure/dispatch-authority-view.test.ts` (P3 structure); `tests/behaviour/dispatch-handover.test.ts` (P6 fold parity) | `bun test tests/structure/dispatch-authority-view.test.ts` (P3); `bun test tests/behaviour/dispatch-handover.test.ts` (P6) | To Implement | Valid and degraded view fixtures; folded ledger; atomic writer |
| TC-HAND-005 | `tests/behaviour/dispatch-authority-view.test.ts` | `bun test tests/behaviour/dispatch-authority-view.test.ts` | To Implement | Dual-run fixture; merge and bash recorders |
| TC-HAND-006 | `tests/behaviour/dispatch-handover.test.ts` | `bun test tests/behaviour/dispatch-handover.test.ts` | To Implement | Two-repo fixtures; scheduler/remote/marker identities |
| TC-HAND-007 | `tests/behaviour/dispatch-identity.test.ts` (P3 identity); `tests/behaviour/dispatch-handover.test.ts` + `tests/behaviour/dispatch-dual-run-summary.test.ts` (P6 refusal) | `bun test tests/behaviour/dispatch-identity.test.ts` (P3); `bun test tests/behaviour/dispatch-handover.test.ts tests/behaviour/dispatch-dual-run-summary.test.ts` (P6) | To Implement | Scheduler-key, remote, persisted-marker, unresolvable fixtures; rename and restart steps |
| TC-BASH-001 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Temp state root; sanitized PATH |
| TC-BASH-002 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Authoritative view fixture |
| TC-BASH-003 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Absent/broken/hanging CLI; degraded views |
| TC-BASH-004 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | To Implement | Twelve-cell matrix |
| TC-BASH-005 | `tests/structure/dispatch-bash-authority.test.ts` | `bun test tests/structure/dispatch-bash-authority.test.ts` | To Implement | Source scan; temp-copy mutant |
| TC-E2E-001 | `tests/conformance/dispatch/dispatch-e2e.test.ts` | `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` | To Implement | Controlled repo; injected ports; `controlled-proof` declaration; provenance guard; rare-class injections; deterministic dates |
| TC-E2E-002 | `tests/conformance/dispatch/dispatch-e2e.test.ts` | `bun test tests/conformance/dispatch/dispatch-e2e.test.ts` | To Implement | Handed-over controlled repo; bash runner |
| TC-E2E-003 | `tests/conformance/dispatch/dispatch-fixture.test.ts` | `bun test tests/conformance/dispatch/dispatch-fixture.test.ts` | To Implement | Fixture API guard; provenance counter; cross-scope cases |
| TC-MERGE-001 | `tests/behaviour/dispatch-merge-absence.test.ts` | `bun test tests/behaviour/dispatch-merge-absence.test.ts` | To Implement | Merge-ready truth; merge recorder |
| TC-MERGE-002 | `tests/behaviour/dispatch-merge-absence.test.ts` | `bun test tests/behaviour/dispatch-merge-absence.test.ts` | To Implement | Independently merged truth |
| TC-MERGE-003 | `tests/structure/dispatch-merge-boundary.test.ts`; `tests/structure/dispatch-imports.test.ts`; `tests/boundaries` | `bun test tests/structure/dispatch-merge-boundary.test.ts tests/structure/dispatch-imports.test.ts tests/boundaries` | To Implement | Dependency-cruiser rules; negative fixture |
| TC-MERGE-004 | `tests/structure/dispatch-composition.test.ts` | `bun test tests/structure/dispatch-composition.test.ts` | To Implement | Production composition dependency record |
| TC-DAEMON-001 | `tests/behaviour/dispatch-daemon-planner.test.ts` | `bun test tests/behaviour/dispatch-daemon-planner.test.ts` | To Implement | `LaneLaunchRequest`; descriptor; recording port |
| TC-DAEMON-002 | `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` | `bun test tests/conformance/dispatch/dispatch-daemon-lane.test.ts` | To Implement | Real planner/executor; scripted harness; temp lane ledger; one-shot comparison fixture; attempt ledger reader |
| TC-DAEMON-003 | `tests/behaviour/dispatch-daemonless.test.ts` | `bun test tests/behaviour/dispatch-daemonless.test.ts` | To Implement | No-daemon state; unavailable planner |
| TC-HELP-001 | `tests/structure/dispatch-help-inventory.test.ts`; `tests/checks/help-guide-coverage.test.ts`; `tests/checks/reference-page-parity.test.ts` | `bun test tests/structure/dispatch-help-inventory.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` | To Implement | Help inventory; reference page |
| TC-HELP-002 | `tests/behaviour/dispatch-help-version.test.ts` | `bun test tests/behaviour/dispatch-help-version.test.ts` | To Implement | Poisoned composer; recording ports |
| TC-HELP-003 | `tests/behaviour/entrypoint-composition.test.ts` (updated); `tests/conformance/pilot/pilot-isolation.test.ts` (comment narrowed only); `tests/structure/harness-review-deferrals.test.ts` (updated) | `bun test tests/behaviour/entrypoint-composition.test.ts tests/conformance/pilot/pilot-isolation.test.ts tests/structure/harness-review-deferrals.test.ts` | Existing, updated | Inverted production-surface expectations; reduced pilot fixture kept; deferral record |
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

Phase-aligned order (the authoritative per-TC phase declaration is Section 7.5). Pure-domain and ledger slices run before the CLI exists; command slices start at phase 4. A phase runs only the slices whose earliest executable phase is at or before it.

1. Phase 1: static checks and the contracts/structure/checks/types slices: `git diff --check`; `bun test tests/structure tests/checks tests/types`.
2. Phase 2: pure-domain slices only: `bun test tests/behaviour/dispatch-liveness.test.ts tests/behaviour/dispatch-token-closure.test.ts tests/behaviour/dispatch-exit-projection.test.ts tests/behaviour/dispatch-truth-derivation.test.ts tests/behaviour/dispatch-state-unverified.test.ts` — no `dispatch` command invocation.
3. Phase 3: ledger/record slices only: `bun test tests/behaviour/dispatch-evidence-record.test.ts tests/behaviour/dispatch-evidence-class.test.ts tests/behaviour/dispatch-comparison.test.ts tests/behaviour/dispatch-false-success.test.ts tests/behaviour/dispatch-unevaluable.test.ts tests/behaviour/dispatch-identity.test.ts tests/structure/dispatch-authority-view.test.ts` — no summary or handover command.
4. Phase 4: command/output/error slices: `bun test tests/behaviour/dispatch-harness-lease.test.ts tests/behaviour/dispatch-envelope.test.ts tests/behaviour/dispatch-error-envelope.test.ts tests/behaviour/dispatch-merge-absence.test.ts tests/golden/dispatch-text.test.ts tests/golden/dispatch-errors.test.ts`.
5. Phase 5: resume slices: `bun test tests/behaviour/dispatch-resume.test.ts tests/behaviour/dispatch-restart-budget.test.ts tests/behaviour/dispatch-resume-economics.test.ts`.
6. Phase 6: summary/gate/handover slices: `bun test tests/behaviour/dispatch-dual-run-summary.test.ts tests/behaviour/dispatch-dual-run-floor.test.ts tests/behaviour/dispatch-gate-evidence.test.ts tests/behaviour/dispatch-gate-window.test.ts tests/behaviour/dispatch-divergence.test.ts tests/behaviour/dispatch-handover.test.ts tests/behaviour/dispatch-authority-view.test.ts tests/golden/dispatch-summary.test.ts`.
7. Phase 7: registration/help/docs slices: `bun test tests/structure/dispatch-help-inventory.test.ts tests/behaviour/dispatch-help-version.test.ts tests/checks/dispatch-doc-conformance.test.ts`.
8. Phase 8: shell slices: `bash scripts/.tests/test-dispatch-bash-fallback.sh` plus the four retained suites.
9. Phase 9: daemon slices: `bun test tests/behaviour/dispatch-daemon-planner.test.ts tests/behaviour/dispatch-daemonless.test.ts tests/conformance/dispatch/dispatch-daemon-lane.test.ts`.
10. Phase 10: E2E and release slices: `bun test tests/conformance/dispatch tests/behaviour/dispatch-bounds.test.ts tests/behaviour/dispatch-determinism.test.ts tests/behaviour/dispatch-idempotency.test.ts tests/behaviour/dispatch-privacy.test.ts tests/checks/fixture-privacy.test.ts`; then `pnpm check`.
11. Reference host: `bun test tests/behaviour/dispatch-bounds.test.ts -t "@perf"`.

### 7.3 Provisional Delivery Slices and Phase Mapping

The implementation plan (phase 4) will declare the real phases. This plan's provisional slices are a sequencing guide, not a delivery split; each slice must be independently green, and no AC-bearing behavior may be deferred into a "docs/tests only" phase. The letters A-F below are **not** the plan phase numbers: the authoritative per-TC phase declaration is Section 7.5, and a slice letter may span several plan phases because it contains pure-domain, ledger, command, and gate slices.

| Provisional slice | Scope | TC IDs |
|---|---|---|
| A - Contracts and state | Token/gate declarations, record schemas (including `evidenceClass` and the comparison record shape), authority view, error rows, boundary rules | TC-DISP-008, TC-DISP-011, TC-DISP-012, TC-EVID-005, TC-EVID-007, TC-ERR-001 through TC-ERR-005, TC-TOKEN-001, TC-TOKEN-002, TC-MERGE-003, TC-MERGE-004, TC-HAND-004 |
| B - One-shot core | Harness resolution, lease, pre-session refusal, spawn, liveness, classification, truth derivation, envelope, exits | TC-DISP-001 through TC-DISP-010, TC-TRUTH-001 through TC-TRUTH-006, TC-MERGE-001, TC-MERGE-002 |
| C - Resume and evidence | Resume modes, restart budget, economics, attempt and divergence records, evidence class, false success, record-level degradation | TC-RESUME-001 through TC-RESUME-004, TC-EVID-001 through TC-EVID-006, TC-NFR-006, TC-NFR-007, TC-DET-001 |
| D - Gate, handover, fallback | Window (exclusive bound and recovery), floor, coverage (positive case), corroboration, comparison families, evidence-class counting, summary, resolve, flip, revert, identity, authority view, bash matrix | TC-GATE-001 through TC-GATE-011, TC-HAND-001, TC-HAND-002, TC-HAND-003, TC-HAND-005, TC-HAND-006, TC-HAND-007, TC-BASH-001 through TC-BASH-005 |
| E - Daemon, registration, docs | Planner, executor, daemon lanes with their attempt record, daemonless path, prompt-required set, help, reference page, planning reconciliation, production-surface absence assertions | TC-DAEMON-001 through TC-DAEMON-003, TC-HELP-001 through TC-HELP-003, TC-PLANREC-001 |
| F - End-to-end and regression | Controlled-proof proof (all eleven classes, provenance guard, cross-scope counting), reversal proof, fixture guard, bounds, idempotency, aggregate gate | TC-E2E-001 through TC-E2E-003, TC-NFR-001 through TC-NFR-005, TC-REG-001 |

### 7.4 Entry and Exit Criteria

**Entry criteria (before delivery starts):**

- The change specification is approved and the DoR gate passes.
- The implementation plan names the dispatch composition, record kinds (including `evidenceClass` and the comparison record), gate predicate home, evidence-class counting home, identity resolution home, and test files consistently with Sections 1.5, 6.3, and 7.1.
- The implementation plan's phase 9 names the daemon-path classification and attempt-record append producer.
- The dependency set (verify change, harness adapters, scheduling engine, resident daemon, state layer, economics, CLI composition) is present on the integration branch (D5).
- The controlled-proof fixture design is accepted: real state and command path, injected harness/tracker/CI/VCS ports, a `controlled-proof` declaration, and a provenance guard; no real remote or model.
- TDR-0015 is referenced by the spec and this plan; its acceptance at PR review is tracked but does not block delivery.

**Exit criteria (before the change is done):**

- Every AC in Section 3.1 is `Covered` by a passing TC; zero unassigned rows (53/53); zero orphan TCs; all 82 TCs appear in the Section 5.1 index, the Section 7.1 mapping, and the Section 7.5 per-phase executability table.
- Every phase's green set contains only slices whose earliest executable phase is at or before that phase; phases 2 and 3 run no `dispatch`, `dual-run summary`, `handover`, or bash command, and every later-layer assertion is a declared cross-phase confirmation.
- Every must-pass TC passes; the six nice-to-have failures are triaged and recorded.
- `pnpm check` passes, including lint, format, typecheck, `bun test`, and boundaries.
- The four retained bash suites and the new bash matrix suite pass.
- The controlled-proof E2E proof runs evidence, eligibility, handover, authoritative dispatch, and reversal without hand-inserted evidence, reaching eligibility with all eleven classes including `state-unverified` and `pr-open-unverified`.
- Production counting excludes every non-`pilot` evidence class, the controlled scope excludes every non-`controlled-proof` attempt, and a cross-scope controlled-proof record is surfaced and not counted.
- Post-incident recovery reaches eligibility with zero in-window incidents, and the same-instant record is excluded.
- Degraded exits are pinned: unreadable/torn/malformed summary exits `2`; truncated valid summary exits `0` with declared truncation; unreadable handover exits `2`; readable-but-unmet handover exits `1`.
- Pre-session refusals emit an envelope and append no attempt record; attempt-stage failures — including a harness spawn refusal — append exactly one record with the Appendix G pair.
- The reference page and SC-M1-29/SC-M1-30 carry the amended bar; no other planning doc is edited.
- The F-9 deferral record carries the production-consumer outcome and a revisit trigger; the pilot-isolation fixture stays reduced with a narrowed comment.
- The two new error rows are sync-checked in both directions; the two existing rows are unchanged; the only `doc/spec/**` edit is the two documented error rows in `feature-result-contract.md`.
- The execution log in Section 10 is populated with family-level commands and results, and pm-notes `notes:` carries the per-phase evidence.

### 7.5 Per-TC Phase Executability and Slice Declaration

This table is the authoritative declaration of **when each scenario can first be green**. A phase may claim independence only for slices whose earliest executable phase is at or before that phase; any later-phase slice in the same TC is a cross-phase confirmation, not a phase-green requirement. No TC ID was split in this revision: mixed-layer TCs are declared as separate executable slices in different files, and the later slice is explicitly labelled a confirmation.

Legend and rules:

- **P1** — contracts, structure, checks, types. No dispatch command, no ledger.
- **P2** — pure domain only (`deriveDispatchResult`, liveness assembly, token/exit projection, classification). No CLI command invocation and no ledger append in a P2 slice.
- **P3** — durable ledger and record shapes (`appendDispatchAttempt`, divergence/handover append, comparison record, evidence class, authority-view structure). No `dispatch`, `dual-run summary`, or `handover` command in a P3 slice.
- **P4** — the one-shot `dispatch` command: harness resolution, lease, envelope, text output, error envelopes, merge boundary.
- **P5** — resume command and admission.
- **P6** — summary, gate, divergence resolution, handover, reversal.
- **P7** — registration, help, reference page, planning reconciliation.
- **P8** — bash fallback.
- **P9** — daemon planner/executor and daemon lane.
- **P10** — controlled-proof E2E, bounds, determinism, privacy, idempotency, aggregate gate.
- A **cross-phase confirmation** row means the TC is green earlier for its declared slice and is re-confirmed later; the later phase must not be treated as the TC's owner.
- **Record assertion boundary:** a record-shape assertion that can be made by appending through the ledger builder is P3; a record assertion that requires a real command invocation to produce the record is P4. This is why `TC-EVID-001` and `TC-EVID-003..007` have a P3 slice and a P4/P6 confirmation rather than one phase claim.

| TC ID | Earliest executable phase | Executable slices by phase | Cross-phase confirmation |
|---|---|---|---|
| TC-DISP-001 | 4 | P4 command, lease, spawn, record | No |
| TC-DISP-002 | 4 | P4 command, envelope, zero-record refusal | No |
| TC-DISP-003 | 2 | P2 pure liveness | No |
| TC-DISP-004 | 2 | P2 pure liveness | No |
| TC-DISP-005 | 2 | P2 pure liveness | No |
| TC-DISP-006 | 4 | P4 envelope | No |
| TC-DISP-007 | 4 | P4 golden text | No |
| TC-DISP-008 | 1 | P1 structure token home; P2 pure token closure | Yes — P2 |
| TC-DISP-009 | 2 | P2 pure projection | Yes — P4 process exit via TC-DISP-001/TC-DISP-010 |
| TC-DISP-010 | 4 | P4 error envelope and record pair | No |
| TC-DISP-011 | 2 | P2 classification; P3 ledger record; P4 command confirmation | Yes — P3, P4 |
| TC-DISP-012 | 2 | P2 pure derivation | No |
| TC-TRUTH-001 | 2 | P2 pure derivation; P3 ledger record; P4 command confirmation | Yes — P3, P4 |
| TC-TRUTH-002 | 2 | P2 pure derivation; P3 comparison record; P4 command confirmation | Yes — P3, P4 |
| TC-TRUTH-003 | 2 | P2 pure derivation; P3 comparison record; P4 command confirmation; P6 summary/gate | Yes — P3, P4, P6 |
| TC-TRUTH-004 | 2 | P2 pure derivation; P4 command merge-recorder confirmation | Yes — P4 |
| TC-TRUTH-005 | 2 | P2 pure derivation; P3 ledger record; P6 corroboration | Yes — P3, P6 |
| TC-TRUTH-006 | 2 | P2 classification; P3 ledger record; P6 window; P8 bash | Yes — P3, P6, P8 |
| TC-RESUME-001 | 5 | P5 resume command | No |
| TC-RESUME-002 | 5 | P5 restart refusal and record | No |
| TC-RESUME-003 | 5 | P5 resume-economics refusal and record | No |
| TC-RESUME-004 | 5 | P5 idempotent replay | No |
| TC-EVID-001 | 3 | P3 ledger record and type; P4 command confirmation | Yes — P4 |
| TC-EVID-002 | 6 | P6 resolve command and summary | No (P3 divergence append primitive is TC-EVID-005) |
| TC-EVID-003 | 3 | P3 false-success record; P6 summary/window | Yes — P6 |
| TC-EVID-004 | 3 | P3 record-level degradation; P6 window-level degradation | Yes — P6 |
| TC-EVID-005 | 3 | P3 append/torn record; P6 summary/authority read | Yes — P6 |
| TC-EVID-006 | 3 | P3 class declaration/immutability and type; P4 production default | Yes — P4 |
| TC-EVID-007 | 3 | P3 unit comparison shape and type; P6 summary/handover parity | Yes — P6 |
| TC-GATE-001 | 6 | P6 summary | No |
| TC-GATE-002 | 6 | P6 gate predicate | No |
| TC-GATE-003 | 6 | P6 floor predicate | No |
| TC-GATE-004 | 6 | P6 floor predicate | No |
| TC-GATE-005 | 6 | P6 floor predicate | No |
| TC-GATE-006 | 6 | P6 summary/handover degraded reads | No |
| TC-GATE-007 | 6 | P6 positive all-eleven gate | Yes — P10 (TC-E2E-001) |
| TC-GATE-008 | 6 | P6 comparison families | No |
| TC-GATE-009 | 6 | P6 incident window | No |
| TC-GATE-010 | 6 | P6 corroboration | No |
| TC-GATE-011 | 6 | P6 evidence-class counting | Yes — P10 (TC-E2E-001, TC-E2E-003) |
| TC-HAND-001 | 6 | P6 handover refusal | No |
| TC-HAND-002 | 6 | P6 handover flip | Yes — P10 (TC-E2E-001) |
| TC-HAND-003 | 6 | P6 reversal/noop | No |
| TC-HAND-004 | 3 | P3 authority-view structure; P6 handover fold parity | Yes — P6 |
| TC-HAND-005 | 6 | P6 dual-run no-authority behavior | No |
| TC-HAND-006 | 6 | P6 per-repository isolation | No |
| TC-HAND-007 | 3 | P3 identity resolution order, marker reuse, rename/restart invariance; P6 summary/handover unresolvable refusal | Yes — P6 |
| TC-BASH-001 | 8 | P8 shell | No |
| TC-BASH-002 | 8 | P8 shell | No |
| TC-BASH-003 | 8 | P8 shell | No |
| TC-BASH-004 | 8 | P8 shell | No |
| TC-BASH-005 | 8 | P8 structure/shell scan | No |
| TC-E2E-001 | 10 | P10 conformance | Confirms P6 AC-F5-5 and AC-F8-3 |
| TC-E2E-002 | 10 | P10 conformance | No (owns AC-F8-2) |
| TC-E2E-003 | 10 | P10 conformance | Confirms P6 AC-F8-3 |
| TC-MERGE-001 | 4 | P4 command | No |
| TC-MERGE-002 | 4 | P4 command | No |
| TC-MERGE-003 | 4 | P4 structure/boundaries | No |
| TC-MERGE-004 | 4 | P4 structure composition | No |
| TC-DAEMON-001 | 9 | P9 planner/executor | No |
| TC-DAEMON-002 | 9 | P9 daemon lane conformance | No |
| TC-DAEMON-003 | 9 | P9 daemonless path | No |
| TC-HELP-001 | 7 | P7 registration/help inventory | No |
| TC-HELP-002 | 7 | P7 help/version purity | No |
| TC-HELP-003 | 7 | P4 run executes the pre-inversion assertion; P7 is the earliest green for the inverted assertion and the narrowed pilot comment | Yes — P4 pre-inversion run |
| TC-PLANREC-001 | 7 | P7 doc conformance | No |
| TC-ERR-001 | 4 | P4 command and ledger record | No |
| TC-ERR-002 | 4 | P4 command and ledger record | No |
| TC-ERR-003 | 1 | P1 structure identity | No |
| TC-ERR-004 | 4 | P4 golden errors | No |
| TC-ERR-005 | 1 | P1 checks sync | No |
| TC-TOKEN-001 | 1 | P1 structure | No |
| TC-TOKEN-002 | 1 | P1 checks | No |
| TC-NFR-001 | 10 | P10 bounds | No |
| TC-NFR-002 | 10 | P10 bounds | No |
| TC-NFR-003 | 10 | P10 performance | No |
| TC-NFR-004 | 10 | P10 truncated summary | No |
| TC-NFR-005 | 10 | P10 idempotency | No |
| TC-NFR-006 | 10 | P10 privacy | No |
| TC-NFR-007 | 10 | P10 spawn environment | No |
| TC-DET-001 | 10 | P10 determinism | No |
| TC-REG-001 | 10 | P10 aggregate gate | No |

**Per-phase executability summary (82 TCs, no split):**

| Phase | TCs whose earliest executable phase is this phase | Count |
|---|---|---|
| 1 | TC-DISP-008, TC-ERR-003, TC-ERR-005, TC-TOKEN-001, TC-TOKEN-002 | 5 |
| 2 | TC-DISP-003, TC-DISP-004, TC-DISP-005, TC-DISP-009, TC-DISP-011, TC-DISP-012, TC-TRUTH-001..006 | 12 |
| 3 | TC-EVID-001, TC-EVID-003, TC-EVID-004, TC-EVID-005, TC-EVID-006, TC-EVID-007, TC-HAND-004, TC-HAND-007 | 8 |
| 4 | TC-DISP-001, TC-DISP-002, TC-DISP-006, TC-DISP-007, TC-DISP-010, TC-MERGE-001..004, TC-ERR-001, TC-ERR-002, TC-ERR-004 | 12 |
| 5 | TC-RESUME-001..004 | 4 |
| 6 | TC-GATE-001..011, TC-HAND-001, TC-HAND-002, TC-HAND-003, TC-HAND-005, TC-HAND-006, TC-EVID-002 | 17 |
| 7 | TC-HELP-001..003, TC-PLANREC-001 | 4 |
| 8 | TC-BASH-001..005 | 5 |
| 9 | TC-DAEMON-001..003 | 3 |
| 10 | TC-E2E-001..003, TC-NFR-001..007, TC-DET-001, TC-REG-001 | 12 |

Note the deliberate reconciliations: `TC-EVID-002` is owned by phase 6 (its resolve command and summary do not exist until then), so the phase-3 divergence-append primitive stays with `TC-EVID-005`; `TC-TRUTH-001..006` keep a phase-2 pure-domain slice and do not invoke the command until phase 4; `TC-HAND-007` keeps its phase-3 identity-resolution slice (the plan runs `dispatch-identity.test.ts` in phase 3) and confirms the unresolvable summary/handover refusal in phase 6; `TC-DISP-009`, `TC-DISP-011`, `TC-EVID-001`, `TC-EVID-003..007`, and `TC-HAND-004` declare their later-layer assertions as confirmations rather than phase-2/3 green requirements.

**Cross-phase AC confirmations (additive, not ownership transfer):** AC-F5-5 is owned by the phase-6 positive gate case (`TC-GATE-007`) and confirmed by the phase-10 controlled proof (`TC-E2E-001`); AC-F8-3 counting is owned by the phase-6 predicate (`TC-GATE-011`) and confirmed by the phase-10 proof (`TC-E2E-001`, `TC-E2E-003`); AC-F12-1's error rows land in phase 1 (`TC-ERR-005`) and its classification is confirmed in phase 4 (`TC-ERR-001`, `TC-ERR-002`); AC-F12-2's rows land in phase 1 (`TC-ERR-003`, `TC-ERR-005`) and the refusal behavior is confirmed in phases 4-5 (`TC-ERR-001`, `TC-ERR-002`, `TC-RESUME-002`, `TC-RESUME-003`).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|---|---|---|---|---|
| TR-1 | The stale two-week wording is implemented by mistake | H | H | `TC-GATE-003`, `TC-GATE-004`, `TC-GATE-005`, `TC-PLANREC-001`, and `TC-HAND-001` assert the four-condition bar; the reference page and the two scenarios are reconciled |
| TR-2 | The floor is misread as an alternative to class coverage, incident truth, or corroboration | H | M | One predicate, one fixture family, `TC-GATE-005` mutants; the floor-only sentence is asserted |
| TR-3 | An exit-0-with-no-artifact run is counted clean | H | M | `TC-TRUTH-001` plus `TC-EVID-003`; the attempt record must name the missing artifact |
| TR-4 | An uncorroborated success claim passes the gate | H | M | `TC-GATE-010` family matrix; `TC-EVID-003` contradiction; the token alone is never sufficient |
| TR-5 | Handover flips the wrong repository, leaks authority, or re-keys on rename | H | L | `TC-HAND-006` two-repo isolation; `TC-HAND-007` rename/remote/restart binding and clean refusal; every record carries the resolved repository identity |
| TR-6 | Reversal loses history or is not idempotent | M | M | `TC-HAND-003` append-only history and noop replay; `TC-NFR-005` |
| TR-7 | Bash fallback depends on the typed CLI | H | M | `TC-BASH-003`, `TC-BASH-005`; pure file read; typed CLI absent, broken, and hanging |
| TR-8 | Dispatch accidentally fires a merge | H | L | `TC-MERGE-001` through `TC-MERGE-004`; recording merge port; structural boundary check |
| TR-9 | Evidence records leak prompts, transcripts, or secrets | H | L | `TC-NFR-006`, `TC-NFR-007`, `TC-EVID-001`; canaries and the deny-by-default spawn environment |
| TR-10 | Daemon and one-shot paths classify the same evidence differently, or the daemon path appends no attempt record | M | M | `TC-DAEMON-002` compares final token, outcome, comparison record, and attempt record against one-shot; plan phase 9 owns the producer |
| TR-11 | The controlled fixture hand-inserts evidence, making the E2E proof vacuous | H | M | `TC-E2E-003` fixture API guard and command-provenance count; the fixture exposes no ledger writer |
| TR-12 | The p95 latency gate is flaky on shared CI | M | M | `TC-NFR-003` keeps the bounded-read assertion in the default suite and measures p95 on the reference host; host metadata is recorded |
| TR-13 | The family comparison baseline is crossed, producing false divergences | M | M | `TC-GATE-008` and `TC-EVID-007` reject cross-family comparison and treat not-applicable as not-applicable |
| TR-14 | The two reconciled scenarios or the reference page drift back to the calendar proxy | M | L | `TC-PLANREC-001` scans for stale phrases and missing required phrases with the file named |
| TR-15 | The F-9 deferral is either silently resolved or left as a blanket absence claim, or the pilot fixture is wrongly forced to compose dispatch | M | L | `TC-HELP-003` asserts a status, a production-consumer reason, and a revisit trigger; it keeps the pilot fixture reduced and rejects composing dispatch into it |
| TR-16 | Pre-session refusals drift back to appending an attempt record, or a harness spawn refusal is mislabeled as pre-session and records nothing | M | L | DEC-19 and PM D6 fix the rule; `TC-DISP-002` asserts deterministically that the envelope is emitted and no attempt record is appended for all three pre-session shapes; `TC-DISP-011` and `TC-EVID-001` assert the spawn refusal is one recorded attempt with `noop-lane-permission`/`refused` |
| TR-17 | The gate becomes unreachable again because a rare class cannot be a success claim or a comparison | H | M | `TC-GATE-007` positive all-eleven fixture and `TC-E2E-001`; `state-unverified` is exposure-only and `pr-open-unverified` corroborates on the tracker fact |
| TR-18 | Fixture, smoke, or controlled-proof evidence inflates a production window | H | M | `TC-EVID-006` declaration/immutability, `TC-GATE-011` per-scope counting, `TC-E2E-003` cross-scope exclusion, and the provenance guard |
| TR-19 | Record-level degradation is conflated with window-level unreadability (either blocking forever or hiding a broken read) | H | M | `TC-TRUTH-006` and `TC-EVID-004` assert both scopes separately; `TC-GATE-006` pins the exits |
| TR-20 | The incident lower bound is implemented inclusively, so recovery is impossible | M | M | `TC-GATE-009` and `TC-EVID-003` assert `>` semantics, the same-instant exclusion, and the post-incident recovery case |
| TR-21 | A failure class is given the wrong result token, outcome, exit, or comparison treatment | H | M | Appendix G pins all four; `TC-EVID-001`, `TC-ERR-001`, `TC-ERR-002`, `TC-RESUME-002`, `TC-RESUME-003`, and `TC-DISP-009` assert the exact pair and record policy |
| TR-22 | A phase is declared independently green while running a behaviour-level TC whose command or gate does not exist yet | H | M | Section 7.5 declares the earliest executable phase per TC and separates later-layer confirmations; phases 2-3 run only pure-domain/ledger slices |

### 8.2 Assumptions

- The dependency set is delivered and stable on the integration branch (D5).
- The state layer admits the three additive record kinds and the derived document without a schema bump (DEC-18).
- Repository identity resolves from the normalized scheduling `repository` key, then the normalized VCS remote, then a persisted first-use marker created through the store-managed artifact; an unresolvable identity is a clean refusal and a checkout-path digest is never the identity (DEC-13, TDR-0015 §6).
- Every dispatch composition declares its evidence class: production defaults to `pilot`, the controlled proof declares `controlled-proof`, and `smoke`/`fixture` never count (TDR-0015 §2).
- The daemon path shares the harness port and the shared classifier with the one-shot path, and plan phase 9 supplies the classification and attempt-record append point in the daemon composition; this plan asserts the behavior regardless of the chosen home symbol.
- The four bash entry points can read and parse the derived authority document with ordinary shell tooling and default to dual-run on any failure.
- A controlled fixture can exercise all eleven result classes and the floor without touching real pilot tickets, including a fault-injected `state-unverified` run and an empty-URL `pr-open-unverified` run.
- The real shared classifier is the only classification implementation; tests supply evidence, never classification.
- The test-facing names in Section 1.5 are the contract; the implementation plan may rename symbols but must update Section 7.1 and keep the scenarios binding.
- Appendix G is the single binding failure-token mapping: every failure scenario reads its token, outcome, exit, record policy, and comparison treatment from it and never re-derives them.
- Section 7.5 is the binding phase-executability declaration: phases 2 and 3 run only pure-domain and ledger slices, and later command, gate, bash, daemon, and E2E assertions are cross-phase confirmations.
- Goldens are byte-pinned and regenerated only by an explicit command with a reviewed diff.

### 8.3 Open Questions

| ID | Question | Proposed answer | Blocking? | Status / Owner |
|---|---|---|---|---|
| OQ-T1 | What is the exact production path and encoding of the derived authority view? | The plan declares one path and schema; the test fixtures use `dispatch/authority.json` under the temp state root; bash reads the same document. | No; behavior is fixed, the path is a plan detail | Open — engineering |
| OQ-T2 | Does a pre-session input refusal (unknown harness, lease conflict, rejected input) append an attempt record? | **Resolved by PM D6 and spec DEC-19:** a pre-session refusal emits the classified envelope at exit 1 and appends no attempt record. `TC-DISP-002` asserts this deterministically for all three refusal shapes. | No | **Resolved** — spec/plan owner |
| OQ-T3 | Is the p95 latency assertion gated on shared CI? | The bounded 5,000-record read is the default hard gate; p95 is measured on the declared reference host and recorded, with host metadata. | No; the AC bound is met on the reference host | Open — engineering |
| OQ-T4 | Where does the resolution principal come from for `dispatch dual-run resolve`? | The delivered principal port; the fixture injects a fixed principal. | No | Open — engineering |
| OQ-T5 | Is the F-9 deferral "resolved" or "resolved with follow-up"? | Either is accepted if the record names the production-consumer outcome and a revisit trigger; AC-F11-3 does not require full resolution. | No | Open — engineering |
| OQ-T6 | Which planning files may the delivery edit? | Only the dispatch reference page and SC-M1-29/SC-M1-30. The ticket body and every other planning file remain unchanged and are reported. | No; review gate | Open — pm |
| OQ-T7 | What is the `--evidence-class` surface (flag vs configured default) and the controlled composition's declaration point? | The implementation plan declares one surface and one declaration point; the tests drive the declared composition input and assert the recorded class, not a literal flag spelling. | No; behavior is fixed by AC-F4-5 | Open — engineering / TDR-0015 unresolved item |
| OQ-T8 | What is the persisted identity marker's storage name/location, and what happens when a later derived key disagrees with the persisted binding? | The store-managed artifact owns the name; the persisted binding governs and the discrepancy is recorded as a bounded attribute, not a new identity (TDR-0015 §6). Tests assert behavior through the store edge, not the name. | No | Open — engineering / TDR-0015 unresolved item |
| OQ-T9 | Which timestamp drives the window lower bound and UTC-date attribution (start vs completion/recorded)? | The completion/recorded timestamp of the attempt record, per TDR-0015 §3; the incident tie uses a strict `>` comparison. Tests use the record's completion timestamp. | No | Open — engineering / TDR-0015 unresolved item |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-11-08 | test-plan-writer | Initial test plan derived from the GH-239 specification (47 ACs), PM decisions D1-D5, the M1 dispatch contract and reference page, TDR-0005/TDR-0010, seeded scenarios SC-M1-26..SC-M1-30, and the repository testing strategy. 78 TCs; 47/47 ACs covered; SC-M1-29/SC-M1-30 reconciled to the four-condition evidence bar. |
| 0.2 | 2026-11-08 | test-plan-writer | Revised to the GH-239 spec iteration 2 (53 ACs), TDR-0015, and PM decisions D1-D6; closes readiness iteration 1 findings F1, F2, F3, F4, F5, F6, F7, F11, F13, and F16 as they apply to test planning. Added `TC-EVID-006` (evidence class), `TC-EVID-007` (comparison record shape), `TC-GATE-011` (evidence-class counting), and `TC-HAND-007` (rename-invariant identity); 82 TCs, 53/53 ACs covered, zero orphans. TC-TRUTH-003 now asserts `pr-open-unverified` corroborates on the tracker fact with `urlResolved: false`; TC-TRUTH-006 separates record-level degradation from window-level unverifiability; TC-GATE-007 adds the positive all-eleven reachability case; TC-GATE-009 and TC-EVID-003 pin the exclusive incident bound and post-incident recovery; TC-DISP-002 closes OQ-T2 and asserts no attempt record for a pre-session refusal; TC-DAEMON-002 asserts the daemon-path attempt record; TC-HELP-003 keeps the pilot-isolation fixture reduced and inverts only the two production-surface assertions; TC-GATE-008 asserts the comparison record shape; TC-GATE-006 and TC-NFR-004 pin the degraded exits; TC-E2E-001 runs under `controlled-proof` with a provenance guard. Section 1.2 now allows only the two documented error rows as a `doc/spec/**` edit. |
| 0.3 | 2026-11-08 | test-plan-writer | DoR iteration 2 remediation (N1, N4, N5). **N4:** `TC-EVID-001` now asserts the Appendix G pair and comparison treatment for the harness spawn refusal (`noop-lane-permission`/`refused`), the spawn failure (`failed`/`failed`), the restart-budget refusal (`max-restarts`/`failed`), and the resume-economics refusal (`failed`/`failed`), each with exactly one attempt record; `TC-ERR-001`, `TC-ERR-002`, `TC-RESUME-002`, `TC-RESUME-003`, `TC-DISP-009`, and `TC-DISP-010` carry the same pairs. **N5:** `TC-DISP-011` now proves the spawn refusal is a recorded attempt and contrasts it with the three unrecorded pre-session refusals; `TC-DISP-002` carries the contrast; "post-spawn" wording was removed. **N1:** added Section 7.5 with the earliest executable phase and executable slices for all 82 TCs and the per-phase counts; phases 2-3 are pure-domain/ledger-only, command/output/record slices start at phase 4, summary/gate/handover at phase 6, bash at phase 8, daemon at phase 9, and E2E at phase 10. `TC-EVID-002` is reconciled to phase 6 (its file is run there; the phase-3 divergence-append primitive is `TC-EVID-005`). No TC ID was split: 82 TCs, 53/53 ACs covered, zero orphan TCs. Section 7.2 now runs the phase-aligned slice order. |

## 10. Test Execution Log

Populated during delivery. The per-phase command log is the `notes:` ledger in `chg-GH-239-pm-notes.yaml`; this table is the family-level summary. On disagreement, the pm-notes `notes:` entry and the raw log win.

| Family | Command | Tests | Result | Notes / Evidence |
|---|---|---|---|---|
| Contracts, state, error rows, boundaries | `bun test tests/structure tests/checks tests/types` | TBD | Not run | Slice A |
| One-shot dispatch and truth derivation | `bun test tests/behaviour/dispatch-*.test.ts` | TBD | Not run | Slice B |
| Resume and evidence | `bun test tests/behaviour/dispatch-resume*.test.ts tests/behaviour/dispatch-evidence-*.test.ts tests/behaviour/dispatch-comparison.test.ts tests/behaviour/dispatch-unevaluable.test.ts tests/behaviour/dispatch-false-success.test.ts tests/behaviour/dispatch-divergence.test.ts` | TBD | Not run | Slice C |
| Gate, handover, fallback, identity | `bun test tests/behaviour/dispatch-gate*.test.ts tests/behaviour/dispatch-dual-run-*.test.ts tests/behaviour/dispatch-handover.test.ts tests/behaviour/dispatch-identity.test.ts tests/behaviour/dispatch-authority-view.test.ts`; `bash scripts/.tests/test-dispatch-bash-fallback.sh` | TBD | Not run | Slice D |
| Daemon, help, planning reconciliation | `bun test tests/behaviour/dispatch-daemon*.test.ts tests/conformance/dispatch/dispatch-daemon-lane.test.ts tests/structure/dispatch-help-inventory.test.ts tests/checks/dispatch-doc-conformance.test.ts` | TBD | Not run | Slice E |
| Controlled-proof E2E and bounds | `bun test tests/conformance/dispatch tests/behaviour/dispatch-bounds.test.ts tests/behaviour/dispatch-idempotency.test.ts` | TBD | Not run | Slice F; assert `controlled-proof` class and provenance guard |
| Aggregate gate | `pnpm check` | TBD | Not run | Final |
| Reference-host performance | `bun test tests/behaviour/dispatch-bounds.test.ts -t "@perf"` | TBD | Not run | Record host metadata |
