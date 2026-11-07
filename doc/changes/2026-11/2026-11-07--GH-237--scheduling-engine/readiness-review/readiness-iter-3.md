# Readiness Review Iteration 3

Verdict: **READY_WITH_RISKS**
DoR gate result: **READY (PASS)** — no blocking findings; delivery may proceed.
Work Item: GH-237 (M1-S17: Scheduling engine: queue, lanes, dependency batching)
Date: 2026-11-07
Pause Required: no

## Gate Summary

- Artifact set reviewed: `chg-GH-237-spec.md` v1.3, `chg-GH-237-test-plan.md` v1.3, `chg-GH-237-plan.yaml` (delivery.plan.v1, revalidated), `chg-GH-237-pm-notes.yaml`, the ticket `juliusz-cwiakalski/agentic-delivery-os#237`, the M1 design pack, the backlog M1-S17 entry, the CLI registry, and the delivered contracts the change builds on.
- All seven iteration-2 findings are resolved. R2-01 (the only blocking one) is resolved by removing the recorded root from every read surface and pinning it as internal-only state; R2-02..R2-07 are resolved at the contract/task/test-plan level.
- Full gate re-run: ticket-task and AC coverage pass; AC quality/testability pass; 66/66 TC traceability pass; cross-artifact consistency passes with four non-blocking annotation residuals (N1–N4); phase ordering and gates are executable; system-spec consistency passes; decision capture passes; doc-update and code-area coverage pass; DoD is defined.
- Plan validator: `validatePlan` through the delivered `parseConfigYaml` wrapper returns `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, all eight phases echoed.
- Privacy-literal guard: `scripts/checks/privacy-literals.ts` exits 0 — 2 692 files scanned at the artifact gate and 2 693 including this verdict record, 7 rules, 0 violations.
- Structural counts: 66 TCs in the index = 66 detail sections = 66 TCs in plan `coverage`; 22 ACs in both spec and test plan; 14 NFRs in both; six seeded scenarios mapped; five new record kinds plus one derived document. The only count discrepancy is the partial-TC annotation count (N1), not a contract count.
- The Definition-of-Ready override is **not** available and was **not** used: the change adds behavior, introduces contracts (five record kinds, five error rows, one collector id, one configuration branch), and changes the command surface.

## Facet Summary

- spec_completeness: **PASS** — every ticket task and ticket AC is covered by F-1..F-12 and AC-F1-1..AC-F12-1; the one-shot narrowing is recorded with an explicit PM acknowledgement and a human-owner gate.
- ac_quality: **PASS** — 22 ACs are concrete, observable, non-overlapping; AC-F3-1(a)/(b) and AC-F1-1's root clause are now satisfiable as written.
- plan_coverage: **PASS** — all 66 TCs are mapped to Phases 1–8; no TC is marked "full" in a phase that precedes its completing surface; phase gates name only runnable rows.
- test_traceability: **PASS** — 22/22 ACs, 14/14 NFRs, six seeds, and all DM/EVT rows are traced; no orphan in either direction. N3 records one clause-level assertion residual inside an otherwise-covered AC.
- cross_artifact_consistency: **PASS** — AC ↔ Appendix C/DM ↔ TC ↔ plan agree on the substantive contracts. N1, N2, and N4 record non-blocking annotation/checklist drift, not implementable ambiguity.
- decision_capture: **PASS** — DEC-1..DEC-13, OQ-1..OQ-14, the R-08 one-shot acknowledgement, the R-12 digest follow-up ownership, and the OQ-2 preemption deferral are recorded in the right places.
- system_spec_consistency: **PASS** — F-11's lane-state provenance matches the M1 pack's shared contract plus this change's additive `failed`; the digest gap remains owned by the digest's own reconciliation (NG-10); `queue ready` is preserved.
- plan_doc_update_coverage: **PASS** — Phase 8 lists the new feature spec, seven neighbour specs, queue/lanes man pages, registry, glossary, changeset, and the distribution-marker guard.
- plan_code_area_coverage: **PASS** — every phase declares files and folders; Phase 2 now explicitly tasks recording the root that Phase 3/7 consume; every phase that creates a `packages/**` file registers it in the inventory.
- dod_defined: **PASS** — 22 ACs, 14 NFRs, measurable §4.1 zero-tolerance metrics, plan task 8.8's DoD checklist, and typed `doneArtifacts`.

## Previous Finding Status

| Finding | Status | Resolving text |
|---|---|---|
| R2-01 [major][B] root display vs envelope/goldens | **Resolved** | Spec v1.3 AC-F1-1 (line 504): "`queue list` shows the entry, its normalized repository key, its priority, and its edges — the recorded repository root is internal state used only for deploy-expectation discovery and is never rendered (no absolute path appears in the envelope, human output, or goldens)." Appendix C (line 634): "No read or mutation envelope carries the recorded repository root ... `queue list` and `queue plan` project the normalized `repository` key only." DM-13 (line 344): the root "is deliberately not folded into this document and is never rendered by a read surface." Test plan TC-SCHED-009 step 1 (line 525): "assert no `root` field is present and no absolute path or recorded repository root appears anywhere in the machine envelope or the human output (including goldens)." Plan Phase 7 coverage (line 653): the `queue list` projection renders "the normalized repository key ONLY — the recorded root is internal state ... and is never displayed, and the goldens assert no `root` field and no absolute path." |
| R2-02 [minor][N] TC-PARK-004 partial marking | **Resolved** | Test plan TC-PARK-004 (line 1590): "**Phase-surface split**: Partial — the closed-set, pairing, and one-active-park domain/state rows land in Phase 5; step 8's `queue release --park` CLI grammar and `fallback.invocation` exit assertion complete in Phase 7." Step 8 is split explicitly: "(Phase 5 contract half) ... (Phase 7 CLI half) ...". Plan Phase 5 coverage (line 553) marks the domain/state half; Phase 7 coverage (line 663) marks the completing CLI row. §7.1 (line 2175) and §7.2 (line 2190) carry the split. |
| R2-03 [minor][N] `degraded[]` on add/prioritize/dep | **Resolved** | Spec Appendix C (line 638): "`queue add | prioritize | dep` → `ref`, `entry` ..., `result` ..., `degraded[]`; ... `degraded[]` is a uniform field on every successful mutating subcommand envelope, not only on `claim` and `release` (F-10, AC-F10-2)." F-10 (line 149) keeps the same rule. The plan's task 7.2 (line 644) repeats "A successful mutation with no daemon reachable exits 0 with degraded [daemon-unreachable]". |
| R2-04 [minor][N] §20 privacy silence on the absolute root | **Resolved** | Spec §20 (line 542): "The one absolute value in scope is the repository root recorded on each queue entry (DM-1, DM-12): it is local, absolute, internal-only state ... It is never serialized to command envelopes, findings, incidents, logs, goldens, or telemetry, and read surfaces render the normalized repository key only." §21 (line 551): "The recorded repository root never leaves local state ... It is never emitted in an envelope, finding, incident, log line, golden, or telemetry event." |
| R2-05 [minor][N] Phase 2 not tasked to record the root | **Resolved** | Plan Phase 2 task 2.1 (line 377): "the declaring checkout's repository root recorded alongside that key with the SAME fence append (absolute path; absent exactly when the key is absent; internal-only ... never serialized into an envelope, finding, incident, golden, log line, or telemetry event, and never rendered by a read surface)." Task 2.3 (line 379): "the entry record carries BOTH the normalized repository key and the declaring checkout's absolute repository root ... the read projection, human text, and goldens contain neither a `root` field nor an absolute path ... the derived document ... contains no root." Completion criterion (line 387) restates the obligation, naming Phase 3 task 3.3 and Phase 7 task 7.3 as consumers. |
| R2-06 [nit][N] stale `tests/behaviour/queue-ready.test.ts` gate | **Resolved** | Plan Phase 2 gate (line 391) and Phase 4 gate (line 513) now run `tests/behaviour/queue-ready-command.test.ts tests/behaviour/queue-ready-output.test.ts`; Phase 7 gate (line 669) runs the output, command, golden, and structure ready suites. No gate names the nonexistent bare `queue-ready.test.ts`. |
| R2-07 [nit][N] `queue.park` kind wording | **Resolved** | Spec §19 (line 538): "`queue.park` ... is itself one of this change's five new record kinds, and its schema carries `clearObservedAt` and `recoveryState` from its first write. The durable clear-observed marker is another record of that same `queue.park` kind — an additive field set on that kind, not a sixth record kind and not a mutation of a pre-existing kind — so there is no pre-existing park record and no compatibility path to preserve." Appendix D (line 653) and test plan TC-VOCAB-001 step 7 (line 1895) repeat the five-kind inventory and the no-sixth-kind rule; plan task 5.7 (line 550) repeats it. |

## New Findings

Ordered by severity. `B` = blocking (must be fixed in an artifact phase before delivery starts); `N` = non-blocking (may be handled in delivery or accepted as risk). **No new blocking finding exists.**

### N1 [minor][N] cross_artifact_consistency / test_traceability — `chg-GH-237-test-plan.md` §7.1 line 2180 and §7 automation table lines 2085–2145; `chg-GH-237-plan.yaml` header lines 36–47

Gap: The plan header states that §7.1 tabulates 21 TCs and that "its footer plus its rule extend the set to TC-SCHED-002, TC-SCHED-015, and TC-SCHED-001 ..., giving 24 partial TCs." The test plan says "21 partial marks" in its v1.3 history (line 2256), and its §7.1 footer names only TC-SCHED-002 and TC-SCHED-015; TC-SCHED-001 is omitted. Those three TCs are not marked "Phase-surface split: Partial" in §5.2 and are not listed in §7.1, even though §7.1's own rule requires any TC spanning both surfaces to be marked and listed, and the plan marks them partial in Phase 2 and completes them in Phase 7. Separately, the §7 automation table lists only the domain suite for 19 of the 21 split TCs (TC-SCHED-002 and TC-PARK-008 are the exceptions), omitting the `queue-cli.test.ts` completing surface that §7.1 declares authoritative. No phase gate is broken: the plan's Phase 2/7 markings are correct and Phase 7 runs `queue-cli.test.ts`.

Suggested remediation target phase: **test_planning** (annotation only).
Suggested fix: Make the test plan's partial count and §7.1 coverage match the plan's 24-TC set — add TC-SCHED-001, TC-SCHED-002, and TC-SCHED-015 to the §7.1 table and/or the Phase 2 footer, mark them "Phase-surface split: Partial" in §5.2, and add `tests/behaviour/queue-cli.test.ts` / the relevant golden to their §7 automation rows. No contract or behavior change.

### N2 [minor][N] cross_artifact_consistency / dod_defined — `chg-GH-237-plan.yaml` task 8.8 line 706 vs `chg-GH-237-test-plan.md` §3.1 lines 98–118

Gap: The plan's DoD checklist (task 8.8) claims "all 22 AC rows traceable to green TCs", but its AC→TC map is not the test plan's §3.1 map. The material differences: AC-F12-1 is **omitted entirely** from the 8.8 list; AC-F4-1 lists TC-LEASE-006 but omits TC-LEASE-013 (the renewal control, which is AC-F4-1's own "repeat claim renews" clause; TC-LEASE-006 is AC-F4-2); AC-F1-1 omits TC-DEPEND-001; AC-F5-1 omits TC-WEIGHT-002; AC-F8-1 adds TC-PARK-007. Most additions are defensible related TCs, but the AC-F12-1 omission and the AC-F4-1 swap mean the PR readiness checklist does not cover the preserved `queue ready` contract or the renewal clause. The test plan §3.1 itself is complete, so the risk is a missed DoD check, not a missing test.

Suggested remediation target phase: **delivery_planning** (checklist only).
Suggested fix: Replace task 8.8's inline AC→TC list with the test plan's §3.1 mapping (or add the missing AC-F12-1/TC-COMPAT-001/VOCAB-001/002/003 row and TC-LEASE-013 under AC-F4-1, and reconcile the F1-1/F5-1/F8-1 sets). No scope or oracle change.

### N3 [minor][N] test_traceability — `chg-GH-237-test-plan.md` AC-F10-2 row line 115; TC-SCHED-002 lines 325–349; TC-SCHED-016 lines 688–708

Gap: AC-F10-2 requires that "any successful mutating `queue` subcommand with no daemon reachable ... the envelope reports the degradation". The AC is mapped to TC-SCHED-002, TC-SCHED-010, and TC-LEASE-010. TC-SCHED-010 covers claim (`queue plan`/`claim`), and TC-LEASE-010 covers release, but TC-SCHED-002 — the only TC covering `queue add`/`prioritize`/`dep` — never asserts `degraded[]` (its steps assert the record append, replay no-op, superseding projection, and derived-document equality). TC-SCHED-016 step 1 asserts `degraded[]` "for each success" but its precondition names only "one success case" and does not enumerate the three declaration mutations. The behavior is specified and implementable (Appendix C, F-10, plan task 7.2); only the explicit assertion is thin.

Suggested remediation target phase: **test_planning** (assertion row).
Suggested fix: Add a step to TC-SCHED-002 (or an explicit success case in TC-SCHED-016) asserting `degraded: ["daemon-unreachable"]` at exit 0 on a successful `queue add`/`prioritize`/`dep` with no daemon, and that a refused declaration mutation projects its own exit-1 identity without claiming degradation. No oracle change.

### N4 [nit][N] cross_artifact_consistency — `chg-GH-237-plan.yaml` header lines 215–217 vs task 2.1 line 377, task 2.3 line 379, and `chg-GH-237-spec.md` DM-13 line 344

Gap: The iteration-2 remediation note in the plan header says Phase 2 records the root "and fold[s] it into the entry projection". That directly conflicts with DM-13 ("The entry's recorded repository root ... is deliberately not folded into this document"), with task 2.1 ("DM-13 folds no root, because the root is internal-only"), and with task 2.3 ("the derived document ... contains no root"). The executable task text is correct; the header comment is stale relative to the chosen internal-only option and could mislead an implementer who reads the header first. This is the one inconsistency introduced by the iteration-3 edits.

Suggested remediation target phase: **delivery_planning** (comment wording only).
Suggested fix: Reword the header sentence to "record the root on the entry record and keep it out of the derived graph document and every read projection" (or delete "and fold it into the entry projection"). No task, gate, or contract change.

## Reopen Targets

None are required for delivery. The gate is PASS.

| Artifact phase | Findings | Required? |
|---|---|---|
| `test_planning` | N1 (partial-TC annotations), N3 (AC-F10-2 declaration-mutation assertion) | Optional — non-blocking; may be handled in delivery or a test-plan cleanup. |
| `delivery_planning` | N2 (task 8.8 AC→TC checklist), N4 (header root-fold wording) | Optional — non-blocking; N4 is a one-line comment fix. |
| `specification` | none | Not required. |

`delivery` is not reopened. If the PM clears the non-blocking residuals, re-running the gate is optional; none of them changes an executable contract or a phase gate.

## Regression Check (iteration-3 edits)

The iteration-3 edits are confined to: spec F-1/EVT-1/DM-1/DM-12/DM-13/AC-F1-1/§19/§20/§21/Appendix C/Appendix D/glossary/history; test-plan summary/AC-F1-1 coverage/TC-SCHED-001 step 2/TC-SCHED-009 step 1/TC-PARK-004 split/TC-VOCAB-001 step 7/§7.1/§7.2/history; plan header/Phase 2/Phase 5/Phase 7; pm-notes phase completion. No executable contract, gate path, or oracle was regressed. The only new textual conflict is N4 (plan header "fold it into the entry projection" vs DM-13 and tasks 2.1/2.3). N1–N3 are residuals that predate iteration 3 and were not previously flagged.

## Verification Notes (not findings)

- **Plan validator**: `validatePlan` + the edge `parseConfigYaml` wrapper returns `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, `truncated: false`, and echoes all eight phases with `kind: delivery`, `tier: full`, `weightClass: standard`, and the `repo:main-tools` lease.
- **Privacy literal**: `bun run scripts/checks/privacy-literals.ts` exits 0 — 2 692 files scanned at the artifact gate and 2 693 including this verdict record, 7 rules, 0 distinct lengths, 0 violations. No credential-shaped literal was introduced by the iteration-3 edits.
- **Counts**: test-plan index 66 = detail sections 66 = plan `coverage` 66 distinct TC ids; AC rows 22 in both spec and test plan; NFRs 14 in both; six seeds (SC-M1-08/09/10/11/17/17b) mapped; five new record kinds (`queue.entry`, `queue.dependency`, `queue.lease`, `queue.park`, `queue.incident`) plus one derived document (`delivery.queue.graph.v1`). The partial-TC count is the one disagreement (21 in the test plan vs 24 in the plan header — N1); it does not affect TC, AC, NFR, seed, or record-kind counts.
- **Root/golden check**: no read surface, human output, or golden asserts the recorded absolute root. TC-SCHED-009 step 1 explicitly forbids a `root` field and any absolute path; the golden rule (test plan line 220 and line 2059) forbids absolute paths including recorded roots; the plan's Phase 7 tasks 7.2/7.4/7.8 repeat the rule. The root remains recorded where deploy discovery needs it: spec F-6/DM-1/DM-12, plan Phase 2 tasks 2.1/2.3 and completion criterion, and test-plan TC-SCHED-001 step 2 / TC-DEPEND-003 step 6. TC-DEPEND-003's synthetic fixture root is input record data used to exercise discovery, not a read-surface or golden output.
- **Park kind inventory**: exactly five new kinds plus one derived document in F-12, §19, Appendix D, test-plan TC-VOCAB-001 steps 1 and 7, and plan task 5.7. No "sixth kind", "existing kind", "existing payload schema", or "older park record" wording remains outside the history sections; the clear-observed marker is a field of the same `queue.park` kind.
- **Mutating `degraded[]`**: Appendix C carries `degraded[]` on `add | prioritize | dep`, `claim`, and `release`, and states it is uniform on every successful mutating subcommand envelope (F-10/AC-F10-2). The plan task 7.2 repeats the uniform rule. N3 is the assertion-level residual for the three declaration mutations, not a contract gap.
- **TC-PARK-004 partiality**: exactly one "Phase-surface split: Partial" line in its §5.2 detail; the split is Phase 5 domain/state half and Phase 7 CLI half; Phase 7 `coverage` contains the completing row; no phase marks it "full" before Phase 7.
- **Gate paths**: every path named in a phase `testGate` either exists in the tree or is declared in that phase's `scope.files`/`scope.folders` (including the new `tests/behaviour/queue-*.test.ts`, `tests/golden/queue-*.test.ts`, `tests/checks/queue-*.test.ts`, and `tests/structure/queue-scheduling-contract.test.ts`). The only external check paths are `scripts/checks/error-table-sync.ts` (exists) and `scripts/checks/secret-read-boundary.ts` (exists).
- **Type probe**: `tests/types/queue-scheduling.type-test.ts` is declared in Phase 1 scope and task 1.6, and is compiled only through `pnpm typecheck` (`tests/types/tsconfig.json`). No `bun test` gate names it; Bun discovery rejects `*.type-test.ts`.
- **Phase ordering**: Phase 1 vocabulary/config/error rows (including the documented error table in the same commit) → Phase 2 declaration/graph → Phase 3 readiness/gates/ranking → Phase 4 leases → Phase 5 parks → Phase 6 lanes → Phase 7 queue CLI/envelopes/exits/hermetic battery → Phase 8 docs/aggregate gate. The subsystem dependencies are satisfied in that order; every phase's gate names only suites available at that point (or suites the phase creates).
- **"Full" placement**: no TC is marked "full" in a phase that precedes its completing surface; the 21 marked partial TCs plus the three Phase-2 partial TCs are completed in Phase 7 (queue) or Phase 6 (lanes). N1 concerns the test plan's annotation count, not the plan's placement.
- **System-spec consistency**: `queue ready`'s six-condition order/tri-state/evidence vocabulary and error rows are preserved (AC-F12-1, NG-4); the collector-id set extends from `{tracker}` to `{tracker, lanes}` (Appendix F, NFR-11) and the authoritative enumeration in `feature-result-contract.md` is updated in Phase 1 (task 1.4) and re-verified in Phase 8; the status digest's `lanes-or-queue` gap is left to its owner (NG-10, RSK-9, plan task 8.3a). F-11's lane-state provenance is the M1 pack's five shared states plus this change's additive `failed`; the digest's separate attention set is untouched.
- **Substrate**: all plan-asserted delivered paths exist (`contracts/queue-ready.ts`, `domain/queue-ready.ts`, `cli/commands/queue.ts`, `contracts/state.ts`, `state/merge.ts`, `contracts/plan.ts`, `domain/plan-validate.ts`, `domain/plan-overlap.ts`, `contracts/verify-deploy.ts`, `domain/verify-deploy.ts`, `contracts/economics.ts`, `domain/economics-view.ts`, `config/{catalog,schema,defaults}.ts`, `contracts/owner-gate-sla.ts`, `cli/edge.ts`, `tests/fixtures/state/harness.ts`, `tests/structure/inventory.json`, `tests/types/tsconfig.json`). The delivered facts the artifacts rely on are present: `QUEUE_READY_CONDITION_ORDER`, the tri-state and `dependency-open`/`dependency-unobserved` reasons, `BOARD_COLLECTOR_IDS = ["tracker"]`, `MERGE_DEPLOY_EXPECTATIONS_KEY`, `resolveLaneSettings`, `createQueueReadyCommandDefinition`, and `options.queueReady`.
- **No override record** was needed or used; the change is behavioral and contract-bearing.
